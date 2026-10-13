"""Combined Discord session endpoint for Vercel Hobby deployments.

The public URLs remain /api/auth/login, /callback, /me and /logout. Vercel
rewrites them here so the complete OAuth flow consumes one Serverless Function.
"""
import json
import re
import secrets
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.board.store import StorageUnavailable
from auth_core import (  # noqa: E402
    FREE_BETA_MODE, PREMIUM_ROLE_ID, SESSION_COOKIE_NAME, SESSION_TTL_SEC,
    TESTER_ROLE_ID, _beta_payload, create_session_token, exchange_code,
    get_guild_member, get_identity, get_oauth_url, has_access,
    parse_cookie_header, verify_session_token,
)


ACCOUNT_DATA_ACTIONS = ('profile-save', 'prefs-save', 'account-image-save')
ACCOUNT_BODY_MAX = 2200 * 1024
PUSH_ACTIONS = ('push-subscribe', 'push-unsubscribe')
BILLING_ACTIONS = ('checkout-start', 'billing-confirm', 'billing-refresh')
WEBHOOK_BODY_MAX = 512 * 1024


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            return self._get()
        except StorageUnavailable as exc:
            return self._json(503, exc.payload())

    def _get(self):
        query = parse_qs(urlparse(self.path).query)
        action = (query.get("action") or [""])[0].strip().lower()
        if action == "site-status":
            from site_controls import read
            from account_auth import configured,ensure_session
            from v2.board import admin_auth
            # This poll runs every 30s on every open page, which makes it the
            # natural place to keep the session alive: ensure_session()
            # refreshes ahead of expiry and returns the cookies to set.
            # `refreshAvailable` now means "not confirmed yet, but still
            # recoverable" -- the client retries instead of signing out.
            policy=read()
            if policy.get('temporaryPublicAccess'):
                # Do not refresh or clear existing account cookies during the
                # temporary guest mode. They are not needed for public research.
                account,session_updates,pending=None,[],False
            else:
                account,session_updates,pending=ensure_session(self.headers)
            # A member sees the site's switches with their own rule applied
            # (site_members.py): early access, removed sections, suspension
            # and their badge. Admin notes stay server-side.
            viewer={}
            if account:
                import site_members
                viewer=site_members.viewer_policy(policy,site_members.rule_for(site_members.read_rules(),account))
                site_members.touch(account)
                if policy.get('paidAccess'):viewer['subscription']=self._subscription(account)
            # Something stopped (the line-check timer)? The admin hears about
            # it from here, at most every few minutes (site_health.py).
            import site_health
            site_health.light_check()
            return self._json(200,{**policy,**viewer,'accountsConfigured':configured() and not policy.get('temporaryPublicAccess',False),'account':account,'refreshAvailable':pending,'isAdmin':admin_auth.is_admin_request(self.headers)},session_updates)
        if action == "account":
            # The member's own profile and synced settings (account_profile.py).
            import account_profile
            from account_auth import identity
            account=identity(self.headers)
            if not account or not account_profile.valid_uid(account.get('id')):return self._json(401,{'error':'Sign in to load your account'})
            uid=account['id']
            return self._json(200,{'profile':account_profile.public_profile(uid,account_profile.read_profile(uid)),'prefs':account_profile.read_prefs(uid)})
        if action == "account-image":
            return self._account_image(query)
        if action == "pricing":
            return self._pricing()
        if action == "push-key":
            # The site's public key, which a browser needs to turn alerts on.
            import push_notices
            try:return self._json(200,{'key':push_notices.public_key()})
            except Exception:return self._json(503,{'error':'Alerts are unavailable right now'})
        if action == "providers":
            # Which sign-in buttons to show (Google once it's on in Supabase).
            from account_auth import configured,enabled_providers
            return self._json(200,{'providers':enabled_providers() if configured() else []})
        if action == "oauth":
            return self._oauth_start(query)
        if action == "oauth-callback":
            return self._oauth_callback(query)
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
        # Whop's webhook comes from Whop's servers, so it is checked by its
        # signature instead of the same-origin rule below.
        if (parse_qs(urlparse(getattr(self,'path','')).query).get('action') or [''])[0]=='whop-webhook':
            return self._whop_webhook()
        from site_controls import same_origin,read
        from account_auth import call,cookies,REFRESH,session_cookies,clear_cookies,identity,refresh_session,remembered
        if not same_origin(self.headers):return self._json(403,{'error':'Same-origin request required'})
        try:
            length=int(self.headers.get('Content-Length','0'))
            # Photos and synced settings are the only large bodies.
            if not 0<length<=ACCOUNT_BODY_MAX:return self._json(400,{'error':'Invalid request size'})
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict):return self._json(400,{'error':'Invalid request'})
            action=body.get('action')
            if action in ACCOUNT_DATA_ACTIONS:return self._account_data(action,body)
            if length>8192:return self._json(400,{'error':'Invalid request size'})
            if action in PUSH_ACTIONS:return self._push(action,body)
            if action in BILLING_ACTIONS:return self._billing(action,body)
            email=body.get('email','');password=body.get('password','')
            # Remember me: persistent cookies that survive closing the browser,
            # or session cookies that don't. Defaults to remembering, which is
            # what someone expects from a site they signed into on purpose.
            remember=body.get('remember',True)
            if not isinstance(remember,bool):return self._json(400,{'error':'Invalid request'})
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
                    return self._account_response({'ok':True,'signedIn':True},session_cookies(data,remember))
                return self._json(200,{'message':'Email confirmation is still enabled in Supabase. Disable Confirm email to allow immediate signup.'})
            if action=='sign-in':data=call('token?grant_type=password',{'email':email.strip(),'password':password})
            elif action=='refresh':
                data=refresh_session(cookies(self.headers).get(REFRESH,''))
                remember=remembered(self.headers)
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
                    # This device only. Supabase's default ends the member's
                    # sessions everywhere, so signing out on a phone used to
                    # sign them out on their computer too.
                    try:call('logout?scope=local',{},token=token)
                    except Exception:pass
                from v2.board import admin_auth
                logout_cookies=clear_cookies()+[f'{admin_auth.ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',f'{SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax']
                return self._account_response({'ok':True},logout_cookies)
            else:return self._json(400,{'error':'Unknown account action'})
            return self._account_response({'ok':True},session_cookies(data,remember))
        except StorageUnavailable as exc:return self._json(503,exc.payload())
        except ValueError as exc:return self._json(400,{'error':str(exc) if str(exc).startswith('Account') else 'Invalid account request'})
        except Exception:return self._json(503,{'error':'Account service temporarily unavailable or not configured'})

    def _push(self,action,body):
        """Alerts on this device: its push subscription is kept so
        announcements reach it (push_notices.py)."""
        import push_notices
        from account_auth import identity
        account=identity(self.headers)
        if not account:return self._json(401,{'error':'Sign in to turn on alerts'})
        subscription=body.get('subscription')
        try:
            if action=='push-subscribe':
                push_notices.subscribe(account.get('id'),subscription,site='https://'+str(self.headers.get('Host') or ''))
                # Picks saved before alerts were on count too (pick_alerts.py).
                self._watch_picks(account.get('id'))
            else:push_notices.unsubscribe(subscription.get('endpoint') if isinstance(subscription,dict) else None)
        except ValueError as exc:return self._json(400,{'error':str(exc)})
        except Exception:return self._json(503,{'error':'Alerts are unavailable right now'})
        return self._json(200,{'ok':True})

    def _subscription(self,account):
        """The member's own subscription, for their page. A Whop or storage
        hiccup reads as unknown rather than failing the whole status poll."""
        import whop_billing
        try:return whop_billing.public_subscription(whop_billing.subscription(account))
        except Exception:return None

    def _pricing(self):
        """The plans on the pricing page: to signed-in members, and to the
        admin previewing it."""
        import whop_billing
        from account_auth import identity
        from v2.board import admin_auth
        if not identity(self.headers) and not admin_auth.is_admin_request(self.headers):
            return self._json(401,{'error':'Sign in to see plans'})
        if not whop_billing.configured():return self._json(200,{'configured':False,'plans':[]})
        try:return self._json(200,{'configured':True,'plans':whop_billing.plans()})
        except whop_billing.BillingUnavailable as exc:return self._json(503,{'error':str(exc)})

    def _billing(self,action,body):
        """Subscribing through Whop, for the signed-in member only."""
        import whop_billing
        from account_auth import identity
        account=identity(self.headers)
        if not account:return self._json(401,{'error':'Sign in to subscribe'})
        try:
            if action=='checkout-start':
                origin=self._site_origin()
                session=whop_billing.start_checkout(account,body.get('plan'),origin+'/?checkout=done' if origin else None)
                return self._json(200,{'session':session})
            if action=='billing-confirm':
                record=whop_billing.confirm_payment(account,body.get('payment'))
            else:
                record=whop_billing.subscription(account)
                if record and record.get('membershipId'):record=whop_billing.sync_membership(record['membershipId']) or record
            return self._json(200,{'subscription':whop_billing.public_subscription(record)})
        except ValueError as exc:return self._json(400,{'error':str(exc)})
        except whop_billing.BillingUnavailable as exc:return self._json(503,{'error':str(exc)})

    def _whop_webhook(self):
        """Whop telling us a membership started, renewed or ended. Answered
        with an error only when Whop should send it again."""
        import whop_billing
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:length=0
        if not 0<length<=WEBHOOK_BODY_MAX:return self._json(400,{'error':'Invalid request size'})
        raw=self.rfile.read(length)
        headers={name.lower():value for name,value in self.headers.items()}
        try:event=whop_billing.verify_webhook(headers,raw)
        except ValueError:return self._json(401,{'error':'Invalid signature'})
        try:whop_billing.handle_event(event)
        except (whop_billing.BillingUnavailable,StorageUnavailable):return self._json(503,{'error':'Try again'})
        return self._json(200,{'ok':True})

    def _watch_picks(self,uid,prefs=None):
        """Keep this member's saved picks where alerts look for them. A
        failure here never fails what the member was doing."""
        try:
            import account_profile,pick_alerts
            prefs=account_profile.read_prefs(uid) if prefs is None else prefs
            pick_alerts.watch(uid,(prefs.get('slip') or {}).get('value'))
        except Exception:pass

    def _account_data(self,action,body):
        """Profile edits, photo uploads and settings sync for the signed-in
        member. Only ever touches their own records."""
        import account_profile
        from account_auth import identity
        account=identity(self.headers)
        if not account or not account_profile.valid_uid(account.get('id')):return self._json(401,{'error':'Sign in to save to your account'})
        uid=account['id']
        try:
            if action=='profile-save':
                fields={key:body[key] for key in ('name','avatar') if key in body}
                if not fields:return self._json(400,{'error':'Nothing to save'})
                profile=account_profile.save_profile(uid,**fields)
                return self._json(200,{'profile':account_profile.public_profile(uid,profile)})
            if action=='account-image-save':
                slot=body.get('slot')
                if slot!='background':return self._json(400,{'error':'Unknown image'})
                version=account_profile.save_image(uid,slot,body.get('image'))
                return self._json(200,{'url':account_profile.image_url(uid,slot,version)})
            prefs=account_profile.merge_prefs(uid,body.get('changes'))
            if 'slip' in (body.get('changes') or {}):self._watch_picks(uid,prefs)
            return self._json(200,{'prefs':prefs})
        except ValueError as exc:return self._json(400,{'error':str(exc)})
        except Exception:return self._json(503,{'error':'Account storage is temporarily unavailable'})

    def _account_image(self,query):
        import base64
        import account_profile
        record=account_profile.read_image((query.get('u') or [''])[0],(query.get('slot') or [''])[0])
        if not record:return self._json(404,{'error':'No image'})
        try:raw=base64.b64decode(record['data'])
        except Exception:return self._json(404,{'error':'No image'})
        self.send_response(200)
        self.send_header('Content-Type',record['contentType'])
        # Every upload gets a new ?v=, so a URL never changes what it shows.
        self.send_header('Cache-Control','public, max-age=31536000, immutable')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Length',str(len(raw)))
        self.end_headers();self.wfile.write(raw)

    def _site_origin(self):
        host=str(self.headers.get('Host') or '').strip().lower()
        if not re.fullmatch(r'[a-z0-9.-]+(:[0-9]{1,5})?',host):return None
        return ('http://' if host.split(':')[0] in ('localhost','127.0.0.1') else 'https://')+host

    def _go(self,location,cookies=None):
        self.send_response(302)
        self.send_header('Location',location)
        self.send_header('Cache-Control','no-store')
        for cookie in cookies or []:self.send_header('Set-Cookie',cookie)
        self.end_headers()

    def _oauth_start(self,query):
        """Continue with Google: off to Supabase, which sends the browser to
        Google and back to _oauth_callback()."""
        from account_auth import oauth_start
        origin=self._site_origin()
        if not origin:return self._json(400,{'error':'Invalid request'})
        remember=(query.get('remember') or ['1'])[0]!='0'
        try:url,cookie=oauth_start((query.get('provider') or [''])[0],origin+'/api/session?action=oauth-callback',remember)
        except Exception:return self._go('/sign-in?auth=google-failed')
        return self._go(url,[cookie])

    def _oauth_callback(self,query):
        from account_auth import oauth_pending,oauth_finish,oauth_clear,session_cookies,is_new_account,refuse_account,was_refused,call
        from site_controls import read
        clear=[oauth_clear()]
        code=(query.get('code') or [''])[0];error=(query.get('error') or [''])[0]
        verifier,remember=oauth_pending(self.headers)
        if error or not code:return self._go('/sign-in?auth='+('google-cancelled' if error=='access_denied' else 'google-failed'),clear)
        if not verifier:return self._go('/sign-in?auth=google-expired',clear)
        try:data=oauth_finish(code,verifier)
        except Exception:return self._go('/sign-in?auth=google-failed',clear)
        user=data.get('user') or {}
        # With sign-ups closed, Google still signs existing members in, but
        # an account it has just made is removed again. If the setting
        # can't be read, new accounts wait.
        try:registration_open=bool(read().get('registrationOpen'))
        except Exception:registration_open=False
        if not registration_open and (is_new_account(user) or was_refused(user.get('id'))):
            try:call('logout?scope=local',{},token=data['access_token'])
            except Exception:pass
            refuse_account(user.get('id'))
            return self._go('/sign-in?auth=google-closed',clear)
        return self._go('/',session_cookies(data,remember)+clear)

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

    def _json(self, status, payload, cookies=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        if status == 503 and payload.get('retryAfter'):
            self.send_header('Retry-After', str(payload['retryAfter']))
        for cookie in cookies or []:
            self.send_header("Set-Cookie", cookie)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
