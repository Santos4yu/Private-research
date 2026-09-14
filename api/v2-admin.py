"""
Vercel serverless function: consolidates VORTEX V2's admin-only actions
(PIN auth, odds-key view/swap, board scan) into ONE function.

This exists because of a hard constraint, not a design preference: Vercel's
Hobby plan caps a deployment at 12 serverless functions total. The site was
already at 9 (prediction, players, team-insights, game-log-filters, slate,
and the 4 auth/* routes); splitting admin auth/key/scan into 3 separate
files pushed the total to 13 and the deployment was rejected. Dispatching on
an `action` field keeps this at one function instead of upgrading plans.

GET  ?action=key-status              -- admin only
GET  ?action=cron-scan               -- Vercel Cron only
POST {"action": "auth", "pin": ...}
POST {"action": "key", "key": ...}   -- admin only
POST {"action": "scan", ...}         -- admin only
"""
import json
import os
import sys
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
                from site_controls import read
                return self._send(200, read())
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
                return self._send(200, {"posts": community_feed.list_posts(), "reactions": list(community_feed.REACTIONS), "viewerId": session["id"]})
            if action == "community-image":
                # Public and unauthenticated, same reasoning as site-background:
                # this is fetched directly by <img> tags, not through the feed
                # poll, so it can be cached long-term.
                return self._handle_community_image(qs)
            return self._send(400, {"error": "Unknown or missing action"})
        except Exception as exc:  # noqa: BLE001 -- always return JSON, see do_POST
            return self._send(500, {"error": f"Unhandled error: {exc}"})

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
                if not store.set(KEY,json.dumps(settings)):return self._send(503,{"error":"Settings storage unavailable"})
                return self._send(200,settings)
            if action == "auth":
                return self._handle_auth(body)
            if action == "key":
                return self._handle_key(body)
            if action == "scan":
                return self._handle_scan(body)
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
                return self._send(200, {"post": post})
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
                return self._send(200, {"post": post})
            if action == "community-delete":
                from site_controls import same_origin
                if not same_origin(self.headers):
                    return self._send(403, {"error": "Same-origin request required"})
                from auth_core import session_from_request_headers
                session = session_from_request_headers(self.headers)
                if not session:
                    return self._send(401, {"error": "Sign in required"})
                import community_feed
                try:
                    community_feed.delete_post(body.get("postId"), session["id"], session["id"] == "admin")
                except ValueError as exc:
                    return self._send(400, {"error": str(exc)})
                return self._send(200, {"ok": True})
            return self._send(400, {"error": "Unknown action"})
        except Exception as exc:  # noqa: BLE001 -- always return JSON, never let
            # Vercel's own generic (non-JSON) crash page reach the frontend,
            # which would otherwise fail res.json() with a confusing parse error.
            return self._send(500, {"error": f"Unhandled error: {exc}"})

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
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
