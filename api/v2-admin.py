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
GET  ?action=record                  -- admin only: the site's record (slip_ledger.py)
POST {"action": "record-add" | "record-enter" | "record-enter-many" | "record-group" | "record-remove" | "record-result" | "record-clear", ...} -- admin only
GET  ?action=moves-tick&key=...      -- the line-check timer (line_moves.py)
GET  ?action=nba-depth-test          -- Vercel Cron, the depth-chart test workflow or admin (depth_probe.py)
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


# Phase 0's evaluation (prop_eval.py) reads the season's box scores and every
# recorded line: kept a while, here and in storage, so the admin's page
# doesn't redo it on every open.
_EVAL_SECONDS = 20 * 60
_eval_memory = {}


def _prop_evaluation(days, fresh=False):
    import prop_eval
    import prop_snapshots
    hit = _eval_memory.get(days)
    if hit and not fresh and time.time() - hit[0] < _EVAL_SECONDS:
        return hit[1]
    kept_key = prop_snapshots.key("eval", days)
    if not fresh:
        reply = prop_snapshots._pipeline([["GET", kept_key]])
        kept = prop_snapshots.unpack(reply[0]) if reply and reply[0] else None
        if kept and time.time() - float(kept.get("generatedAt") or 0) < _EVAL_SECONDS:
            _eval_memory[days] = (float(kept["generatedAt"]), kept)
            return kept
    try:
        value = prop_eval.evaluate(days)
    except Exception as error:  # noqa: BLE001 -- the page says so instead of failing
        return {"error": f"The evaluation could not run ({type(error).__name__}: {str(error)[:160]})"}
    _eval_memory[days] = (time.time(), value)
    prop_snapshots._pipeline([["SET", kept_key, prop_snapshots.pack(value), "EX", _EVAL_SECONDS]])
    return value


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
            if action == "health-cron":
                # The daily check (site_health.py): a Vercel cron, which the
                # firewall never challenges.
                import hmac
                secret = os.getenv("CRON_SECRET", "")
                authorized = hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer "+secret) if secret else (
                    "vercel-cron" in self.headers.get("User-Agent", "").lower() or self.headers.get("x-vercel-cron", "") == "1")
                if not authorized:
                    return self._send(401, {"error":"Cron auth required"})
                import site_health
                return self._send(200, site_health.daily())
            if action == "site-health":
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                import site_health
                return self._send(200, site_health.status())
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
            if action == "record":
                # The site's record: only what the admin posts (slip_ledger.record_add).
                if not admin_auth.is_admin_request(self.headers):return self._send(401, {"error":"Admin session required"})
                import slip_ledger
                picks = slip_ledger.record_picks()
                return self._send(200, {"picks": picks, "summary": slip_ledger.public_results(entries=[(p["day"], p["key"], p) for p in picks])})
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
                # The link the admin's phone Shortcut uses to carry NBA.com's
                # tables (nba_relay.py), and when it last did.
                try:
                    import nba_relay
                    phone = nba_relay.key()
                    status["phone"] = {"path": f"/api/v2-admin?action=nba-phone&key={phone}" if phone else None,
                                       **nba_relay.status()}
                except Exception:  # noqa: BLE001
                    status["phone"] = None
                return self._send(200, status)
            if action == "moves-tick":
                return self._handle_moves_tick(qs)
            if action == "nba-phone":
                return self._handle_nba_phone(qs)
            if action == "nba-depth-test":
                return self._handle_nba_depth_test(qs)
            if action == "nba-depth-sync":
                return self._handle_nba_depth_sync()
            if action == "nba-prop-eval":
                return self._handle_nba_prop_eval(qs)
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
            if action == "nfl-plays-cron":
                return self._handle_nfl_plays_cron()
            if action == "predictor-cron":
                return self._handle_predictor_cron((qs.get("step") or ["snapshot"])[0])
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
        query = parse_qs(urlparse(getattr(self, "path", "")).query)
        if (query.get("action") or [""])[0] == "nba-phone":
            return self._handle_nba_phone(query, upload=True)
        length = int(self.headers.get("Content-Length", 0) or 0)
        try:
            body = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, {"error": "Invalid request body"})

        action = body.get("action", "")
        try:
            if action == "nba-depth-import":
                return self._handle_nba_depth_import(body)
            if action == "nba-prop-snapshot":
                return self._handle_nba_prop_snapshot(body)
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
            if action in ("record-add", "record-enter", "record-enter-many", "record-group", "record-remove", "record-result", "record-clear"):
                return self._handle_record(action, body)
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
            admin_auth.admin_cookie(token),
        )
        self.end_headers()
        self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))

    def _handle_record(self, action, body):
        """The admin's record (slip_ledger.py): post a graded slip's picks,
        type in a finished play, take one off, call one's result, or erase it all."""
        if not admin_auth.is_admin_request(self.headers):
            return self._send(401, {"error": "Admin session required"})
        from site_controls import same_origin
        if not same_origin(self.headers):
            return self._send(403, {"error": "Same-origin request required"})
        import slip_ledger
        try:
            if action == "record-add":
                return self._send(200, slip_ledger.record_add(body))
            if action == "record-enter":
                return self._send(200, slip_ledger.record_enter(body))
            if action == "record-enter-many":
                return self._send(200, slip_ledger.record_enter_many(body.get("plays")))
            if action == "record-group":
                return self._send(200, slip_ledger.record_group(body.get("picks"), body.get("app") or ""))
            if action == "record-remove":
                return self._send(200, slip_ledger.record_remove(body.get("day"), body.get("key")))
            if action == "record-result":
                return self._send(200, slip_ledger.record_set_result(body.get("day"), body.get("key"), body.get("result"), body.get("value")))
            if body.get("confirm") is not True:
                return self._send(400, {"error": "Confirm erasing the record."})
            return self._send(200, slip_ledger.record_clear())
        except ValueError as exc:
            return self._send(400, {"error": str(exc)})

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

    def _handle_nba_phone(self, qs, upload=False):
        """The admin's phone carrying NBA.com's tables (nba_relay.py): a GET
        lists the NBA.com links to fetch, a POST hands back one answer."""
        import hmac
        import nba_relay
        given = (qs.get("key") or [""])[0]
        try:
            key = nba_relay.key() or ""
        except Exception:  # noqa: BLE001
            key = ""
        if not (key and given and hmac.compare_digest(given, key)):
            return self._send(401, {"error": "Phone key required"})
        if not upload:
            return self._send(200, nba_relay.jobs())
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0 or length > nba_relay.MAX_BODY:
            return self._send(413, {"error": "Too large" if length else "Nothing sent"})
        raw = self.rfile.read(length)
        payload = None
        try:
            payload = json.loads(raw)
            return self._send(200, nba_relay.accept(payload))
        except (json.JSONDecodeError, UnicodeDecodeError, nba_relay.Rejected) as error:
            # What arrived, so the admin can see why (admin panel, and the Shortcut's own result).
            seen = nba_relay.describe(raw, payload)
            reason = str(error) if isinstance(error, nba_relay.Rejected) else "Not an NBA.com answer."
            nba_relay.note_problem(f"{reason} {seen}")
            return self._send(400, {"error": reason, "received": seen})

    def _handle_nba_depth_test(self, qs):
        """The private test of ESPN's live NBA depth charts (Nov 18,
        backend/sports/wnba/depth_probe.py). Only Vercel's cron (_vercel_cron),
        the repository's "NBA depth chart test" workflow (GitHub's signed
        token, github_oidc.py) or an admin session. ?part=run (default) asks
        ESPN and keeps the result; status, the kept result's time and the last
        runs; games, the stored season's played rows for the workflow's
        SportsDataverse check."""
        trigger = "cron" if self._vercel_cron("nba-depth-test") else None
        if trigger and (qs.get("part") or ["run"])[0] == "run":
            from backend.sports.wnba import depth_probe
            if depth_probe.ran_within(20 * 60):
                return self._send(200, {"skipped": "ran in the last 20 minutes"})
        if not trigger and self.headers.get("X-GitHub-OIDC"):
            import github_oidc
            if github_oidc.verify(self.headers.get("X-GitHub-OIDC", ""), audience="aceprops-nba-depth-test", workflow="nba-depth-test.yml"):
                trigger = "github"
        if not trigger and admin_auth.is_admin_request(self.headers):
            trigger = "admin"
        if not trigger:
            return self._send(401, {"error": "Not allowed"})
        from backend.sports.wnba import depth_probe
        part = (qs.get("part") or ["run"])[0]
        if part == "status":
            return self._send(200, depth_probe.status())
        if part == "games":
            return self._send(200, depth_probe.games_export())
        if part == "depth":
            # The dated depth-chart store (depth.py) and how the season's minutes are placed.
            return self._send(200, depth_probe.store_report())
        if part == "backtest":
            from backend.sports.wnba import dvp_backtest
            return self._send(200, dvp_backtest.run())
        return self._send(200, depth_probe.run(trigger))

    def _vercel_cron(self, name: str) -> bool:
        """Vercel's cron, the way this site's other crons take it
        (predictor-cron): CRON_SECRET's bearer when the secret is set, else
        Vercel's cron headers. Every call that says it is Vercel's cron is
        noted (depth_probe.note_cron), accepted or not, so a schedule that
        never arrives -- or is turned away -- shows in the test's status."""
        import hmac
        secret = os.getenv("CRON_SECRET", "")
        agent = self.headers.get("User-Agent", "")
        says_cron = "vercel-cron" in agent.lower() or self.headers.get("x-vercel-cron", "") == "1"
        if secret:
            accepted = hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {secret}")
        else:
            accepted = says_cron
        if says_cron or accepted:
            from backend.sports.wnba import depth_probe
            depth_probe.note_cron(name, accepted=accepted, secret_set=bool(secret),
                                  bearer=bool(self.headers.get("Authorization")), agent=agent[:60])
        return accepted

    def _handle_nba_depth_sync(self):
        """Vercel's cron (twice a day): read every NBA team's ESPN depth chart
        and keep it in the dated store (backend/sports/wnba/depth.py)."""
        cron = self._vercel_cron("nba-depth-sync")
        if not cron and not admin_auth.is_admin_request(self.headers):
            return self._send(401, {"error": "Not allowed"})
        from backend.sports.wnba import depth
        if cron and depth.synced_within(20):
            return self._send(200, {"skipped": "read in the last 20 minutes"})
        return self._send(200, depth.sync_live())

    def _handle_nba_depth_import(self, body):
        """SportsDataverse's archive of ESPN's depth charts, posted by the
        "NBA depth chart sync" workflow on GitHub's machines (GitHub's signed
        token for that workflow only, github_oidc.py): this season's history
        and each day's new reads, merged into the dated store."""
        import github_oidc
        if not github_oidc.verify(self.headers.get("X-GitHub-OIDC", ""), audience="aceprops-nba-depth-sync", workflow="nba-depth-sync.yml"):
            return self._send(401, {"error": "Not allowed"})
        from backend.sports.wnba import depth
        report = depth.import_snapshots(body)
        return self._send(400 if report.get("error") else 200, report)

    def _handle_nba_prop_snapshot(self, body):
        """A graded run from the prop snapshot job (Phase 0, prop_snapshots.py):
        GitHub's signed token for that workflow only (snapshot_runner.py)."""
        import snapshot_runner
        if not snapshot_runner.verified(self.headers):
            return self._send(401, {"error": "Not allowed"})
        import prop_snapshots
        report = prop_snapshots.accept_run(body, site_sha=os.getenv("VERCEL_GIT_COMMIT_SHA", "") or os.getenv("RENDER_GIT_COMMIT", ""))
        status = 200 if not report.get("error") else 503 if report["error"] == "Storage unavailable." else 400
        return self._send(status, report)

    def _handle_nba_prop_eval(self, qs):
        """Phase 0's admin report (prop_snapshots.recording, prop_eval.evaluate):
        what is being recorded and how the production grades have done.
        An admin session, or the snapshot job's signed token (its report run)."""
        allowed = admin_auth.is_admin_request(self.headers)
        if not allowed and self.headers.get("X-GitHub-OIDC"):
            import snapshot_runner
            allowed = snapshot_runner.verified(self.headers)
        if not allowed:
            return self._send(401, {"error": "Admin session required"})
        import prop_snapshots
        part = (qs.get("part") or ["all"])[0]
        try:
            days = max(1, min(60, int((qs.get("days") or ["30"])[0])))
        except ValueError:
            days = 30
        out = {}
        if part in ("all", "recording"):
            out["recording"] = prop_snapshots.recording()
        if part in ("all", "evaluation"):
            out["evaluation"] = _prop_evaluation(days, fresh=(qs.get("fresh") or [""])[0] == "1")
        return self._send(200, out)

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
        # At most one full check every five minutes, however often the outside
        # timer calls. Nov 23: the timer (cron-job.org) calling every minute or
        # two, each run up to a minute, used up Vercel's free allowance and the
        # account was paused ("402 Payment required" from Nov 19). A call
        # inside the window answers at once and does nothing else.
        if not self._moves_gate_open():
            return self._send(200, {"ok": True, "skipped": "checked under five minutes ago"})
        # Run beside existing work, so other sports cannot starve CS2 backfill.
        from concurrent.futures import ThreadPoolExecutor
        from cs2_history import warm as cs2_warm, due as cs2_due
        cs2_pool = ThreadPoolExecutor(max_workers=1)
        cs2_job = cs2_pool.submit(lambda: cs2_warm(budget=20, limit=12) if cs2_due() else {"waiting": True})
        cs2_pool.shutdown(wait=False)
        # The NBA's season of box scores (backend/sports/wnba/league.py) fills
        # in a few hundred games a tick until it is complete; after that the
        # pages' own reads add each new final, and the catch-up gives games
        # stored before first-quarter lines and dunks were kept their share
        # (this season, then last, newest first). Beside the line checks from
        # the start, like CS2: waiting its turn behind them it rarely got one.
        def nba_tick():
            from backend.sports.wnba import league as seasons
            season = seasons.current_season(league="nba")
            summary = seasons.progress(season, "nba")
            if seasons._locked("nba"):
                return {"waiting": True}
            seasons._set_lock(str(time.time()), "nba")
            try:
                if not summary or summary["partial"]:
                    built = seasons.build(season, deadline_seconds=12, league="nba")
                    return {"season": season, "games": len(built["games"]), "partial": built["partial"]}
                for year in (season, season - 1):
                    filled = seasons.backfill_periods(year, "nba", deadline_seconds=12)
                    if filled["done"] or filled["left"]:
                        return {"season": year, "periods": filled}
                return {"complete": True}
            finally:
                seasons._set_lock("0", "nba")
        nba_pool = ThreadPoolExecutor(max_workers=1)
        nba_job = nba_pool.submit(nba_tick)
        nba_pool.shutdown(wait=False)
        # Phase 0 of the NBA prop model work (prop_snapshots.py): every ten
        # minutes, tonight's injury reports and starters, and whether the
        # graded run is overdue. Beside the rest, never in its way.
        def snapshot_tick():
            import prop_snapshots
            return prop_snapshots.tick() if prop_snapshots.enabled() else None
        snapshot_pool = ThreadPoolExecutor(max_workers=1)
        snapshot_job = snapshot_pool.submit(snapshot_tick)
        snapshot_pool.shutdown(wait=False)
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
        # Saved NBA picks whose player is now listed Out (pick_alerts.py).
        try:
            import pick_alerts
            if time.monotonic()-started < 36:
                pick_alerts.injury_tick()
        except Exception:  # noqa: BLE001 -- never at the cost of the line checks
            pass
        cs2 = None
        try:
            cs2 = cs2_job.result(timeout=max(0, 55-(time.monotonic()-started)))
        except Exception:
            pass
        nba = None
        try:
            nba = nba_job.result(timeout=max(0, 55-(time.monotonic()-started)))
        except Exception:  # noqa: BLE001 -- never at the cost of the line checks
            pass
        snapshots = None
        try:
            snapshots = snapshot_job.result(timeout=max(0, 56-(time.monotonic()-started)))
        except Exception:  # noqa: BLE001 -- never at the cost of the line checks
            pass
        return self._send(200, {"ok": True, "checked": line_moves.checked(), "moneylines": moneylines, "nba": nba, "tennis": tennis, "histories":histories, "cs2":cs2,
                                "slips": slips, "snapshots": snapshots})

    MOVES_EVERY_SECONDS = 290

    def _moves_gate_open(self):
        """The timer's five-minute gate: the first call claims it (SET NX with
        an expiry), every other call until it expires finds it taken. Storage
        down: the check runs, as it always did."""
        try:
            claimed = store.pipeline([["SET", "moves-tick:gate", str(int(time.time())), "NX", "EX", self.MOVES_EVERY_SECONDS]])
            return claimed[0].get("result") == "OK"
        except Exception:  # noqa: BLE001
            return True

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

    def _handle_nfl_plays_cron(self):
        """Rebuild the NFL player pages' matchup splits and metrics
        (nfl_plays.py) once nflverse has published the night's games, so no
        page waits on streaming the season's play-by-play. Same gate as the
        NFL scan, the secret compared in constant time."""
        import hmac
        secret = os.getenv("CRON_SECRET", "")
        if secret:
            if not hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {secret}"):
                return self._send(401, {"error": "Cron auth required"})
        elif "vercel-cron" not in self.headers.get("User-Agent", "").lower() and self.headers.get("x-vercel-cron", "") != "1":
            return self._send(401, {"error": "Cron request required"})
        try:
            import nfl_plays
            season = nfl_plays.season_now()
            size, stored = nfl_plays.refresh(season)
        except LookupError as exc:
            return self._send(200, {"ok": False, "skipped": str(exc)})
        except Exception as exc:  # noqa: BLE001 -- report, don't hang the caller
            return self._send(500, {"error": f"NFL plays build failed: {exc}"})
        # Built but not kept: every page would rebuild it, so say so.
        return self._send(200 if stored else 500, {"ok": stored, "season": season, "bytes": size, "stored": stored})

    def _handle_predictor_cron(self, step):
        """The Game Predictor's daily jobs (game_predictor.py), same gate as
        the NFL plays cron: step=epa builds this season's NFL play-by-play
        table (nfl_team_epa.py) once nflverse has the night's games;
        step=epa-last builds last season's if it isn't kept yet (its
        ratings' starting point); step=snapshot adds each game's market
        chance to its chart in both leagues; step=record keeps every game's
        pick for the admin's record, settles it and fills in the season so
        far (game_record.py)."""
        import hmac
        secret = os.getenv("CRON_SECRET", "")
        if secret:
            if not hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {secret}"):
                return self._send(401, {"error": "Cron auth required"})
        elif "vercel-cron" not in self.headers.get("User-Agent", "").lower() and self.headers.get("x-vercel-cron", "") != "1":
            return self._send(401, {"error": "Cron request required"})
        try:
            if step in ("epa", "epa-last"):
                import nfl_plays
                import nfl_team_epa
                season = nfl_plays.season_now() - (1 if step == "epa-last" else 0)
                if step == "epa-last" and nfl_team_epa.stored(season):
                    return self._send(200, {"ok": True, "season": season, "skipped": "already kept"})
                size, stored = nfl_team_epa.refresh(season)
                return self._send(200 if stored else 500, {"ok": stored, "season": season, "bytes": size, "stored": stored})
            if step == "record":
                # The site's own moneyline record (game_record.py): today's
                # picks kept, what's due settled, a step of the season so far.
                from concurrent.futures import ThreadPoolExecutor
                import game_predictor
                import game_record

                def keep(sport):
                    try:
                        return game_record.timer(sport)
                    except Exception as exc:  # noqa: BLE001 -- the other league still runs
                        return {"sport": sport, "error": type(exc).__name__}
                with ThreadPoolExecutor(max_workers=2) as pool:
                    return self._send(200, {"ok": True, "leagues": list(pool.map(keep, game_predictor.SPORTS))})
            if step == "snapshot":
                from concurrent.futures import ThreadPoolExecutor
                import game_predictor

                def one(sport):
                    try:
                        return game_predictor.snapshot(sport)
                    except Exception as exc:  # noqa: BLE001 -- the other league still runs
                        return {"sport": sport, "error": type(exc).__name__}
                with ThreadPoolExecutor(max_workers=2) as pool:
                    return self._send(200, {"ok": True, "leagues": list(pool.map(one, game_predictor.SPORTS))})
        except LookupError as exc:
            return self._send(200, {"ok": False, "skipped": str(exc)})
        except Exception as exc:  # noqa: BLE001 -- report, don't hang the caller
            return self._send(500, {"error": f"Predictor {step} failed: {type(exc).__name__}"})
        return self._send(400, {"error": "Unknown step"})

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
