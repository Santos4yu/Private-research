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
        if action == "site-status":
            from site_controls import read
            from account_auth import configured,identity,cookies,REFRESH
            from v2.board import admin_auth
            return self._json(200,{**read(),'accountsConfigured':configured(),'account':identity(self.headers),'refreshAvailable':bool(cookies(self.headers).get(REFRESH)),'isAdmin':admin_auth.is_admin_request(self.headers)})
        if action == "login":
            return self._login()
        if action == "callback":
            return self._callback(query)
        if action == "me":
            return self._me()
        if action == "logout":
            return self._logout()
        return self._json(404, {"error": "Unknown session action"})

    def do_POST(self):
        from site_controls import same_origin,read
        from account_auth import call,cookies,REFRESH,session_cookies,clear_cookies,identity
        if not same_origin(self.headers):return self._json(403,{'error':'Same-origin request required'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0<length<=8192:return self._json(400,{'error':'Invalid request size'})
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict):return self._json(400,{'error':'Invalid request'})
            action=body.get('action')
            email=body.get('email','');password=body.get('password','')
            if action in ('sign-in','sign-up','recover','verify-recovery','verify-email'):
                from account_auth import rate_allowed
                if not rate_allowed(self.headers,email):return self._json(429,{'error':'Too many account attempts. Try again in 15 minutes.'})
            if action in ('sign-in','sign-up','recover'):
                if not isinstance(email,str) or '@' not in email or len(email)>254:return self._json(400,{'error':'Enter a valid email'})
            if action in ('sign-in','sign-up','update-password'):
                if not isinstance(password,str) or not 8<=len(password)<=128:return self._json(400,{'error':'Password must contain 8–128 characters'})
            if action=='sign-up':
                if not read()['registrationOpen']:return self._json(403,{'error':'Registration is currently closed'})
                data=call('signup',{'email':email.strip(),'password':password})
                if data.get('access_token') and data.get('refresh_token'):
                    return self._account_response({'ok':True,'signedIn':True},session_cookies(data))
                return self._json(200,{'message':'Email confirmation is still enabled in Supabase. Disable Confirm email to allow immediate signup.'})
            if action=='sign-in':data=call('token?grant_type=password',{'email':email.strip(),'password':password})
            elif action=='refresh':data=call('token?grant_type=refresh_token',{'refresh_token':cookies(self.headers).get(REFRESH,'')})
            elif action in ('verify-recovery','verify-email'):
                data=call('verify',{'email':email.strip(),'token':body.get('code',''),'type':'recovery' if action=='verify-recovery' else 'email'})
            elif action=='recover':
                call('recover',{'email':email.strip()})
                return self._json(200,{'message':'If this account exists, recovery instructions will arrive by email.'})
            elif action=='update-password':
                from account_auth import ACCESS
                if not identity(self.headers):return self._json(401,{'error':'Sign in or verify a recovery code first'})
                call('user',{'password':password},token=cookies(self.headers).get(ACCESS),method='PUT')
                return self._json(200,{'message':'Password updated.'})
            elif action=='sign-out':
                from account_auth import ACCESS
                token=cookies(self.headers).get(ACCESS)
                if token:
                    try:call('logout',{},token=token)
                    except Exception:pass
                return self._account_response({'ok':True},clear_cookies())
            else:return self._json(400,{'error':'Unknown account action'})
            return self._account_response({'ok':True},session_cookies(data))
        except ValueError as exc:return self._json(400,{'error':str(exc) if str(exc).startswith('Account') else 'Invalid account request'})
        except Exception:return self._json(503,{'error':'Account service temporarily unavailable or not configured'})

    def _account_response(self,body,cookies):
        self.send_response(200)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','no-store')
        for cookie in cookies:self.send_header('Set-Cookie',cookie)
        self.end_headers();self.wfile.write(json.dumps(body).encode('utf-8'))

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
        from account_auth import identity
        payload=identity(self.headers)
        return self._json(200,{'authenticated':bool(payload),'username':payload.get('username') if payload else None})

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
