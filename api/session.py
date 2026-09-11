"""Combined Discord session endpoint for Vercel Hobby deployments.

The public URLs remain /api/auth/login, /callback, /me and /logout. Vercel
rewrites them here so the complete OAuth flow consumes one Serverless Function.
"""
import json
import secrets
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from auth_core import (  # noqa: E402
    FREE_BETA_MODE, PREMIUM_ROLE_ID, SESSION_COOKIE_NAME, SESSION_TTL_SEC,
    TESTER_ROLE_ID, _beta_payload, create_session_token, exchange_code,
    get_guild_member, get_identity, get_oauth_url, has_access,
    parse_cookie_header, verify_session_token,
)


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        action = (query.get("action") or [""])[0].strip().lower()
        if action == "login":
            return self._login()
        if action == "callback":
            return self._callback(query)
        if action == "me":
            return self._me()
        if action == "logout":
            return self._logout()
        return self._json(404, {"error": "Unknown session action"})

    def _login(self):
        state = secrets.token_urlsafe(24)
        self.send_response(302)
        self.send_header("Location", get_oauth_url(state))
        self.send_header("Set-Cookie", f"vortex_oauth_state={state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax")
        self.end_headers()

    def _callback(self, query):
        code = (query.get("code") or [""])[0].strip()
        state = (query.get("state") or [""])[0].strip()
        saved_state = parse_cookie_header(self.headers.get("Cookie", ""), "vortex_oauth_state")
        clear_state = "vortex_oauth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax"
        if not code or not state or state != saved_state:
            return self._redirect_home("error", [("Set-Cookie", clear_state)])
        token_data = exchange_code(code)
        if not token_data or not token_data.get("access_token"):
            return self._redirect_home("error", [("Set-Cookie", clear_state)])
        access_token = token_data["access_token"]
        user = get_identity(access_token)
        if not user.get("id"):
            return self._redirect_home("error", [("Set-Cookie", clear_state)])
        member = get_guild_member(access_token, user["id"])
        if not member or not has_access(member):
            return self._redirect_home("denied", [("Set-Cookie", clear_state)])
        roles = {str(role) for role in member.get("roles") or []}
        session_token = create_session_token(
            user, has_premium=str(PREMIUM_ROLE_ID) in roles,
            has_tester=str(TESTER_ROLE_ID) in roles,
        )
        session_cookie = f"{SESSION_COOKIE_NAME}={session_token}; Path=/; Max-Age={SESSION_TTL_SEC}; HttpOnly; Secure; SameSite=Lax"
        self._redirect_home("success", [
            ("Set-Cookie", clear_state), ("Set-Cookie", session_cookie),
        ])

    def _me(self):
        if FREE_BETA_MODE:
            payload = _beta_payload()
        else:
            token = parse_cookie_header(self.headers.get("Cookie", ""), SESSION_COOKIE_NAME)
            payload = verify_session_token(token)
        if not payload:
            return self._json(200, {"authenticated": False})
        return self._json(200, {
            "authenticated": True,
            "username": payload.get("username"),
            "hasPremium": payload.get("has_premium", False),
            "hasTester": payload.get("has_tester", False),
        })

    def _logout(self):
        self.send_response(302)
        self.send_header("Location", "/")
        self.send_header("Set-Cookie", f"{SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax")
        self.end_headers()

    def _redirect_home(self, result, headers=None):
        self.send_response(302)
        self.send_header("Location", f"/?auth={result}")
        for name, value in headers or []:
            self.send_header(name, value)
        self.end_headers()

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
