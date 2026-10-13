"""
Vercel serverless function: consolidates VORTEX V2's admin-only actions
(PIN auth, odds-key view/swap, board scan) into ONE function.

This exists because of a hard constraint, not a design preference: Vercel's
Hobby plan caps a deployment at 12 serverless functions total. The site was
already at 9 (prediction, players, team-insights, game-log-filters, slate,
and the 4 auth/* routes); splitting admin auth/key/scan into 3 separate
files pushed the total to 13 and the deployment was rejected. Dispatching on
an `action` field keeps this at one function instead of upgrading plans.

GET  ?action=members                 -- admin only (site_members.py)
POST {"action": "member-rule", ...}  -- admin only
GET  ?action=announce-status         -- admin only (push_notices.py)
GET  ?action=moves-tick&key=...      -- the line-check timer (line_moves.py)
POST {"action": "announce", ...}     -- admin only
GET  ?action=key-status              -- admin only
GET  ?action=cron-scan               -- Vercel Cron only
POST {"action": "auth", "pin": ...}
POST {"action": "key", "key": ...}   -- admin only
POST {"action": "scan", ...}         -- admin only
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.board import admin_auth, store  # noqa: E402

# odds_client and build_board are NOT imported here on purpose. They pull in
# the whole ML scoring stack (scikit-learn/numpy/model files), and an
# import-time failure anywhere in that chain used to crash this entire
# function before any handler ran -- so even the PIN "auth" action got
# Vercel's plain-text crash page instead of JSON, and the admin modal showed
# "Unexpected token 'A' ... is not valid JSON". They're imported lazily
# inside the actions that actually need them, where the blanket
# except-Exception handlers turn any import failure into a readable JSON
# error instead.


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        qs = parse_qs(urlparse(self.path).query)
        action = (qs.get("action") or [""])[0]

        try:
            if action == "site-settings":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                from site_controls import read_saved as read
                return self._send(200, read())
            if action == "members":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                import site_members
                from site_controls import read
                return self._send(200, {"members": site_members.list_members(), "items": site_members.access_items(),
                                        "badges": [{"key": key, "label": label} for key, label in site_members.BADGES.items()],
                                        "policy": read()})
            if action == "subscribers":
                # Everyone with a Whop membership (whop_billing.py); ?sync=1
                # also records each one, mending any webhook that was missed.
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                import whop_billing
                if not whop_billing.configured():return self._send(200, {"configured": False, "members": [], "counts": {}, "monthly": 0})
                try:
                    return self._send(200, {"configured": True, **whop_billing.subscribers(sync=(qs.get("sync") or [""])[0] == "1")})
                except whop_billing.BillingUnavailable as exc:
                    return self._send(503, {"error": str(exc)})
            if action == "announce-status":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                import line_moves
                import push_notices
                try:
                    status = push_notices.status()
                except Exception:  # noqa: BLE001
                    return self._send(503, {"error": "Alerts are unavailable right now"})
                # The line-check link for an outside timer, and when lines
                # were last checked, so the admin can see it running.
                try:
                    key = line_moves.timer_key()
                    status["timer"] = {"path": f"/api/v2-admin?action=moves-tick&key={key}" if key else None,
                                       "checked": line_moves.checked()}
                except Exception:  # noqa: BLE001
                    status["timer"] = None
                return self._send(200, status)
            if action == "moves-tick":
                return self._handle_moves_tick(qs)
            if action == "key-status":
                if not admin_auth.is_admin_request(self.headers):
                    return self._send(401, {"error": "Admin session required"})
                current_key = store.get_odds_api_key()
                if not current_key:
                    return self._send(200, {"keySet": False})
                from v2.board import odds_client  # lazy -- see module docstring
                result = odds_client.test_key(current_key)
                result["keySet"] = True
                return self._send(200, result)
            if action == "cron-scan":
                return self._handle_cron_scan()
            if action == "finder-history-cron":
                import hmac
                secret = os.getenv("CRON_SECRET", "")
                if not secret or not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer "+secret):
                    return self._send(401, {"error":"Cron auth required"})
                from finder_history_store import warm
                started = time.monotonic()
                from concurrent.futures import ThreadPoolExecutor
                from cs2_history import warm as cs2_warm
                pool = ThreadPoolExecutor(max_workers=1)
                cs2_job = pool.submit(cs2_warm, budget=45, limit=24)
                try:
                    result = warm(budget=40, limit=120)
                    try:
                        result['cs2'] = cs2_job.result(timeout=max(0, 55-(time.monotonic()-started)))
                    except Exception:
                        result['cs2'] = {'status':'retrying'}
                finally:
                    pool.shutdown(wait=False)
                return self._send(200, result)
            if action == "tennis-cron-scan":
                import hmac
                secret = os.getenv("CRON_SECRET", "")
                authorized = hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer "+secret) if secret else (
                    "vercel-cron" in self.headers.get("User-Agent", "").lower() or self.headers.get("x-vercel-cron", "") == "1")
                if not authorized:
                    return self._send(401, {"error":"Cron auth required"})
                import tennis_live
                from tennis_board import board
                try:
                    board(force=True)  # Enroll current PrizePicks players before discovery.
                except Exception:
                    pass  # A lines outage must not stop tracked-player result ingestion.
                return self._send(200, tennis_live.tick(budget=25))
            if action == "nfl-cron-scan":
                return self._handle_nfl_cron_scan()
            if action == "site-background":
                # Public and unauthenticated on purpose: this is the image
                # every visitor's browser fetches directly (not through the
                # JSON site-status poll), so it can be cached long-term.
                return self._handle_site_background()
            if action == "community-feed":
                from site_controls import allowed
                if not allowed(self.headers, "community"):
                    return self._send(403, {"error": "Community feed is not available"})
                from auth_core import session_from_request_headers
                session = session_from_request_headers(self.headers)
                if not session:
                    return self._send(401, {"error": "Sign in required"})
                import community_feed
                import site_members
                import account_profile
                posts = community_feed.list_posts()
                badges = site_members.author_badges(posts)
                posts = [{**post, "authorBadge": badges[post.get("id")]} if post.get("id") in badges else post for post in posts]
                # Names and photos from each author's profile; emails never leave the server.
                posts = account_profile.community_authors(posts)
                return self._send(200, {"posts": posts, "reactions": list(community_feed.REACTIONS), "viewerId": session["id"]})
            if action == "community-image":
                # Public and unauthenticated, same reasoning as site-background:
                # this is fetched directly by <img> tags, not through the feed
                # poll, so it can be cached long-term.
                return self._handle_community_image(qs)
            return self._send(400, {"error": "Unknown or missing action"})
        except store.StorageUnavailable as exc:
            return self._send(503, exc.payload())
        except Exception:  # noqa: BLE001 -- never expose internal service details
            return self._send(500, {"error": "Admin service temporarily unavailable. Please try again."})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0) or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, {"error": "Invalid request body"})

        action = body.get("action", "")
        try:
            if action == "site-settings":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                from site_controls import validate,same_origin,KEY
                if not same_origin(self.headers):return self._send(403,{"error":"Same-origin request required"})
                try: settings=validate(body.get('settings'))
                except ValueError as exc:return self._send(400,{"error":str(exc)})
                if settings['requireLogin']:
                    from account_auth import configured
                    if not configured():return self._send(409,{"error":"Configure email accounts before requiring login"})
                if settings['paidAccess']:
                    import whop_billing
                    if not settings['requireLogin']:return self._send(409,{"error":"Paid access needs “Require email account” on, so every subscription belongs to an account"})
                    if not whop_billing.configured() or not whop_billing.webhook_configured():return self._send(409,{"error":"Set WHOP_API_KEY, WHOP_WEBHOOK_SECRET and WHOP_PLAN_IDS before requiring a paid subscription"})
                if not store.set(KEY,json.dumps(settings)):return self._send(503,{"error":"Settings storage unavailable"})
                return self._send(200,settings)
            if action == "member-rule":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                from site_controls import same_origin
                if not same_origin(self.headers):return self._send(403,{"error":"Same-origin request required"})
                import site_members
                try:
                    email = site_members.normalize_email(body.get("email"))
                    if not email:raise ValueError("Enter a valid email")
                    site_members.save_rule(email, site_members.validate_rule(body.get("rule")))
                except ValueError as exc:
                    return self._send(400, {"error": str(exc)})
                except RuntimeError as exc:
                    return self._send(503, {"error": str(exc)})
                return self._send(200, {"member": site_members.member(email)})
            if action == "announce":
                return self._handle_announce(body)
            if action == "auth":
                return self._handle_auth(body)
            if action == "key":
                return self._handle_key(body)
            if action == "scan":
                return self._handle_scan(body)
            if action == "nfl-scan":
                if not admin_auth.is_admin_request(self.headers):
                    return self._send(401, {"error": "Admin session required"})
                return self._build_nfl_board(trigger="manual")
            if action in ("wnba-league-build", "nba-league-build"):
                if not admin_auth.is_admin_request(self.headers):
                    return self._send(401, {"error": "Admin session required"})
                return self._build_wnba_league(trigger="manual", league="nba" if action.startswith("nba") else "wnba")
            if action == "site-background-upload":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                from site_controls import same_origin
                if not same_origin(self.headers):return self._send(403,{"error":"Same-origin request required"})
                from site_background import save_image
                try:
                    version = save_image(body.get("image"))
                except ValueError as exc:
                    return self._send(400, {"error": str(exc)})
                return self._send(200, {"url": f"/api/v2-admin?action=site-background&v={version}"})
            if action == "community-post":
                from site_controls import allowed, same_origin
                if not allowed(self.headers, "community"):
                    return self._send(403, {"error": "Community feed is not available"})
                if not same_origin(self.headers):
                    return self._send(403, {"error": "Same-origin request required"})
                from auth_core import session_from_request_headers
                session = session_from_request_headers(self.headers)
                if not session:
                    return self._send(401, {"error": "Sign in required"})
                import community_feed
                try:
                    post = community_feed.create_post(session["id"], session.get("username") or session.get("email") or "Member", body.get("text"), body.get("image"))
                except ValueError as exc:
                    return self._send(400, {"error": str(exc)})
                import site_members
                import account_profile
                badge = site_members.author_badges([post]).get(post.get("id"))
                return self._send(200, {"post": account_profile.community_authors([{**post, "authorBadge": badge} if badge else post])[0]})
            if action == "community-react":
                from site_controls import allowed, same_origin
                if not allowed(self.headers, "community"):
                    return self._send(403, {"error": "Community feed is not available"})
                if not same_origin(self.headers):
                    return self._send(403, {"error": "Same-origin request required"})
                from auth_core import session_from_request_headers
                session = session_from_request_headers(self.headers)
                if not session:
                    return self._send(401, {"error": "Sign in required"})
                import community_feed
                try:
                    post = community_feed.toggle_reaction(body.get("postId"), body.get("emoji"), session["id"])
                except ValueError as exc:
                    return self._send(400, {"error": str(exc)})
                import site_members
                import account_profile
                badge = site_members.author_badges([post]).get(post.get("id"))
                post = account_profile.community_authors([{**post, "authorBadge": badge} if badge else post])[0]
                return self._send(200, {"post": post})
            if action == "community-delete":
                from site_controls import same_origin
                if not same_origin(self.headers):
                    return self._send(403, {"error": "Same-origin request required"})
                from auth_core import session_from_request_headers
                session = session_from_request_headers(self.headers)
                if not session or session.get('public'):
                    return self._send(401, {"error": "Sign in required"})
                import community_feed
                try:
                    community_feed.delete_post(body.get("postId"), session["id"], session["id"] == "admin")
                except ValueError as exc:
                    return self._send(400, {"error": str(exc)})
                return self._send(200, {"ok": True})
            return self._send(400, {"error": "Unknown action"})
        except store.StorageUnavailable as exc:
            return self._send(503, exc.payload())
        except Exception:  # noqa: BLE001 -- always return JSON, never let
            # Vercel's own generic (non-JSON) crash page reach the frontend,
            # which would otherwise fail res.json() with a confusing parse error.
            return self._send(500, {"error": "Admin service temporarily unavailable. Please try again."})

    def _handle_auth(self, body):
        locked, seconds_left = store.is_pin_locked_out()
        if locked:
            return self._send(429, {"error": f"Too many attempts. Try again in {seconds_left // 60 + 1} min."})

        pin = str(body.get("pin", ""))
        if not admin_auth.check_pin(pin):
            store.record_pin_failure()
            return self._send(401, {"error": "Incorrect PIN"})

        store.clear_pin_failures()
        token = admin_auth.create_admin_token()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Set-Cookie",
            f"{admin_auth.ADMIN_COOKIE_NAME}={token}; Path=/; HttpOnly; Secure; SameSite=Strict; "
            f"Max-Age={admin_auth.ADMIN_TTL_SEC}",
        )
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def _handle_announce(self, body):
        """A notification to every device with alerts on -- or, with
        "onlyMe", to the admin's own devices first."""
        if not admin_auth.is_admin_request(self.headers):
            return self._send(401, {"error": "Admin session required"})
        from site_controls import same_origin
        if not same_origin(self.headers):
            return self._send(403, {"error": "Same-origin request required"})
        import push_notices
        account_id = None
        if body.get("onlyMe"):
            from account_auth import identity
            account_id = (identity(self.headers) or {}).get("id")
            if not account_id:
                return self._send(400, {"error": "Sign in to send to your own phone"})
        subject = os.getenv("VAPID_SUBJECT", "").strip() or f"https://{self.headers.get('Host', '')}"
        try:
            result = push_notices.announce(body.get("title"), body.get("body"), subject, body.get("url") or "/",
                                           account_id=account_id)
        except ValueError as exc:
            return self._send(400, {"error": str(exc)})
        except Exception:  # noqa: BLE001
            return self._send(503, {"error": "Alerts are unavailable right now"})
        return self._send(200, {**result, **push_notices.status()})

    def _handle_key(self, body):
        if not admin_auth.is_admin_request(self.headers):
            return self._send(401, {"error": "Admin session required"})
        new_key = (body.get("key") or "").strip()
        if not new_key:
            return self._send(400, {"error": "No key provided"})
        from v2.board import odds_client  # lazy -- see module docstring
        result = odds_client.test_key(new_key)
        if not result.get("valid"):
            return self._send(400, {"saved": False, **result})
        store.set_odds_api_key(new_key)
        result["saved"] = True
        return self._send(200, result)

    def _handle_scan(self, body):
        if not admin_auth.is_admin_request(self.headers):
            return self._send(401, {"error": "Admin session required"})
        top_per_stat = int(body.get("top_per_stat", 4))
        min_edge = float(body.get("min_edge", 0.0))
        return self._run_scan(top_per_stat=top_per_stat, min_edge=min_edge)

    def _handle_site_background(self):
        import base64
        from site_background import read_image
        record = read_image()
        if not record:
            return self._send(404, {"error": "No site background image set"})
        try:
            raw = base64.b64decode(record["data"])
        except Exception:
            return self._send(404, {"error": "No site background image set"})
        self.send_response(200)
        self.send_header("Content-Type", record["contentType"])
        # The URL is cache-busted with ?v=<version> on every new upload, so
        # this can be cached aggressively without ever serving a stale image.
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _handle_community_image(self, qs):
        import base64
        import community_feed
        record = community_feed.read_image((qs.get("id") or [""])[0])
        if not record:
            return self._send(404, {"error": "Image not found"})
        try:
            raw = base64.b64decode(record["data"])
        except Exception:
            return self._send(404, {"error": "Image not found"})
        self.send_response(200)
        self.send_header("Content-Type", record["contentType"])
        self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _handle_moves_tick(self, qs):
        """Check every league's PrizePicks lines now (line_moves.py), which
        records moves and sends saved-pick alerts. Called every few minutes
        by an outside timer with the link from announce-status."""
        import hmac
        started = time.monotonic()
        import line_moves
        given = (qs.get("key") or [""])[0]
        secret = os.getenv("CRON_SECRET", "")
        try:
            key = line_moves.timer_key() or ""
        except Exception:  # noqa: BLE001
            key = ""
        bearer = self.headers.get("Authorization", "")
        if not ((key and given and hmac.compare_digest(given, key))
                or (secret and hmac.compare_digest(bearer, f"Bearer {secret}"))):
            return self._send(401, {"error": "Timer key required"})
        # Run beside existing work, so other sports cannot starve CS2 backfill.
        from concurrent.futures import ThreadPoolExecutor
        from cs2_history import warm as cs2_warm, due as cs2_due
        cs2_pool = ThreadPoolExecutor(max_workers=1)
        cs2_job = cs2_pool.submit(lambda: cs2_warm(budget=45, limit=24) if cs2_due() else {"waiting": True})
        cs2_pool.shutdown(wait=False)
        line_moves.safely(line_moves.keep_fresh, set(line_moves.SPORTS), budget=25)
        # Moneylines ride the same timer: prices near the start (closing
        # lines) and settling finished plays (moneyline_model.py).
        moneylines = None
        try:
            import moneyline_model
            moneylines = moneyline_model.tick()
        except Exception:  # noqa: BLE001 -- never at the cost of the line checks
            pass
        tennis = None
        try:
            import tennis_live
            tennis = tennis_live.tick(budget=10)
        except Exception:
            tennis = {"status":"unavailable"}
        # The NBA's season of box scores (backend/sports/wnba/league.py) fills
        # in a few hundred games a tick until it is complete; after that the
        # pages' own reads add each new final.
        nba = None
        try:
            from backend.sports.wnba import league as seasons
            season = seasons.current_season(league="nba")
            summary = seasons.progress(season, "nba")
            if (not summary or summary["partial"]) and not seasons._locked("nba"):
                seasons._set_lock(str(time.time()), "nba")
                try:
                    built = seasons.build(season, deadline_seconds=12, league="nba")
                    nba = {"season": season, "games": len(built["games"]), "partial": built["partial"]}
                finally:
                    seasons._set_lock("0", "nba")
        except Exception:  # noqa: BLE001 -- never at the cost of the line checks
            pass
        histories = None
        try:
            from finder_history_store import warm
            if time.monotonic()-started < 40:
                histories = warm(budget=5, limit=2)
        except Exception:
            pass
        # Graded slips: settle the picks whose games are over, and tell members
        # when a pending pick's news changes (slip_ledger.py).
        slips = None
        try:
            import slip_ledger
            if time.monotonic()-started < 38:
                slips = slip_ledger.tick(limit=6)
        except Exception:  # noqa: BLE001 -- never at the cost of the line checks
            pass
        cs2 = None
        try:
            cs2 = cs2_job.result(timeout=max(0, 55-(time.monotonic()-started)))
        except Exception:
            pass
        return self._send(200, {"ok": True, "checked": line_moves.checked(), "moneylines": moneylines, "nba": nba, "tennis": tennis, "histories":histories, "cs2":cs2,
                                "slips": slips})

    def _handle_cron_scan(self):
        secret = os.getenv("CRON_SECRET", "")
        auth = self.headers.get("Authorization", "")
        user_agent = self.headers.get("User-Agent", "")
        cron_header = self.headers.get("x-vercel-cron", "")
        if secret:
            if auth != f"Bearer {secret}":
                return self._send(401, {"error": "Cron auth required"})
        elif "vercel-cron" not in user_agent.lower() and cron_header != "1":
            return self._send(401, {"error": "Cron request required"})
        return self._run_scan(top_per_stat=6, min_edge=0.0, trigger="cron")

    def _handle_nfl_cron_scan(self):
        # Same gate as the MLB scan above: a Vercel cron secret if one is
        # configured, otherwise Vercel's own cron markers.
        secret = os.getenv("CRON_SECRET", "")
        auth = self.headers.get("Authorization", "")
        user_agent = self.headers.get("User-Agent", "")
        cron_header = self.headers.get("x-vercel-cron", "")
        if secret:
            if auth != f"Bearer {secret}":
                return self._send(401, {"error": "Cron auth required"})
        elif "vercel-cron" not in user_agent.lower() and cron_header != "1":
            return self._send(401, {"error": "Cron request required"})
        return self._build_nfl_board(trigger="cron")

    def _build_wnba_league(self, trigger="manual", league="wnba"):
        """Add every newly finished WNBA game to the stored season, on demand.

        Reads already top the season up every few hours (league.ensure), so
        this is only needed to force it. The matchup views (defense vs
        position, shot zones, similar players, with/without) read that stored
        season, and finished games are only ever fetched once."""
        try:
            from backend.sports.wnba.league import build, current_season
            payload = build(current_season(league=league), league=league)
        except Exception as exc:  # noqa: BLE001 -- report, don't hang the caller
            return self._send(500, {"error": f"{league.upper()} season build failed: {exc}"})
        return self._send(200, {"ok": True, "season": payload["season"], "trigger": trigger,
                                "games": len(payload["games"]), "failed": payload["failed"],
                                "partial": payload["partial"], "stored": payload.get("stored"),
                                "storedBytes": payload.get("storedBytes"), "builtAt": payload["builtAt"]})

    def _build_nfl_board(self, trigger="manual"):
        """Scan the NFL slate once and store the finished board.

        Shared by the daily cron and the admin panel's button, so a board can
        be built on demand instead of waiting for the next scheduled run --
        which otherwise means the props tab keeps scanning live in front of
        whoever opens it.
        """
        try:
            from datetime import datetime as _dt
            from backend.sports.nfl.board_snapshot import store_board
            now = _dt.now()
            season = now.year - 1 if now.month < 3 else now.year
            payload = store_board(season)
        except Exception as exc:  # noqa: BLE001 -- report, don't hang the caller
            return self._send(500, {"error": f"NFL scan failed: {exc}"})
        return self._send(200, {"ok": True, "season": payload["season"], "trigger": trigger,
                                "games": payload["gamesScanned"], "failed": payload["gamesFailed"],
                                "rows": len(payload["rows"]), "rowsAvailable": payload["rowsAvailable"],
                                "partial": payload.get("partial", False), "stored": payload.get("stored"),
                                "storedBytes": payload.get("storedBytes"),
                                "builtAt": payload["builtAt"]})

    def _run_scan(self, top_per_stat=4, min_edge=0.0, trigger="manual"):
        try:
            from v2.board.build_board import build  # lazy -- see module docstring
            result = build(top_per_stat=top_per_stat, min_edge=min_edge)
        except Exception as exc:  # noqa: BLE001 -- report the failure, don't leave the admin panel hanging
            return self._send(500, {"error": f"Scan failed: {exc}"})

        props = result["props"]
        bait = result["bait"]
        payload = {
            "date": datetime.now(timezone.utc).isoformat(),
            "top_per_stat": top_per_stat,
            "min_edge": min_edge,
            "trigger": trigger,
            "props": props,
            "bait": bait,
        }
        store.set(store.BOARD_STORAGE_KEY, json.dumps(payload))
        return self._send(200, {"ok": True, "n_props": len(props), "n_bait": len(bait), "props": props})

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        if status == 503 and body.get('retryAfter'):
            self.send_header('Retry-After', str(body['retryAfter']))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
