"""Server-only Supabase email authentication. Tokens never enter client storage.

Why members were being signed out, and what this module now does about it:

1. The access token lives one hour, and every request checked it by calling
   Supabase's /user endpoint. ANY failure there -- a timeout, a 5xx, a rate
   limit -- came back as "not signed in", so a slow Supabase response on a
   phone connection logged people out. identity() now tells a definite
   rejection apart from "couldn't get an answer", and remembers tokens it has
   already verified, so a hiccup keeps the member signed in.

2. Supabase rotates refresh tokens: each refresh returns a new one and
   revokes the old. If a refresh finished at Supabase but its response never
   reached the browser (dropped connection, app suspended), the browser kept
   the dead token, the next refresh failed, and with reuse detection on
   Supabase revoked the whole session -- a permanent sign-out that looked
   random. refresh_session() now keeps the result of each rotation for a few
   minutes, so presenting the old token again gets the new session back
   instead of tripping reuse detection.

3. Refresh only ever happened after the access token had already expired.
   ensure_session() now refreshes ahead of expiry, so a member with the site
   open never meets an expired token at all.

4. "Remember me" did nothing. It now decides whether the session cookies are
   persistent (kept across browser restarts, sliding 180 days) or end with
   the browser session.

5. Members were still signed out a few times a day. A rotation kept for only
   ten minutes didn't cover a browser that lost a refresh's reply (phone
   locked, network switched) and came back later: it presented the old,
   rotated token, Supabase saw it reused and ended the session. Rotations
   are now kept for a month and followed link by link, so any token this
   browser ever held leads to the session's current one. Two refreshes of
   the same token at once (two server instances) wait for each other
   instead of racing. A refresh that worked but whose member couldn't be
   confirmed this instant reports "still checking", not "signed out". And
   when a session does end, the reason Supabase gave is logged.
"""
import base64
import contextvars
import hashlib
import ipaddress
import json
import os
import secrets
import time
from datetime import datetime, timezone
from urllib.parse import urlencode
import requests
from http.cookies import SimpleCookie
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env.local")
ACCESS='vortex_account_access'
REFRESH='vortex_account_refresh'
# Whether this device asked to be remembered, so every refresh re-issues the
# cookies the same way the member originally chose.
REMEMBER='vortex_account_remember'
# Sliding: every refresh re-issues the cookies, so an account that is used
# never gets anywhere near this. Only a device left untouched for six months
# has to sign in again.
REMEMBER_SECONDS=180*24*3600
# Refresh this long before the access token expires.
REFRESH_AHEAD_SECONDS=10*60
# A verified token is trusted without re-asking Supabase for this long.
# Revoking an account therefore takes effect within five minutes.
IDENTITY_FRESH_SECONDS=5*60
# How long the result of a refresh-token rotation is kept for replay: long
# enough for a browser that lost a reply to come back days later.
ROTATION_GRACE_SECONDS=30*24*3600
# How many rotations a replay may follow to reach the current session.
ROTATION_HOPS=48
# A refresh of one token runs once at a time; others wait this long for it.
REFRESH_LOCK_SECONDS=15
REFRESH_WAIT_SECONDS=4
_COOKIE_FLAGS='; Path=/; HttpOnly; Secure; SameSite=Strict'


class AccountRejected(ValueError):
    """Supabase gave a verdict: bad credentials, or an invalid/revoked token.

    A ValueError subclass, and its message starts with "Account", so the
    session handler's existing error path reports it exactly as before.
    `reason` is Supabase's own code (for the logs), never shown to members."""
    def __init__(self,message,reason=''):
        super().__init__(message)
        self.reason=reason


class AccountUnavailable(RuntimeError):
    """Supabase could not be reached or was overloaded. Not a verdict on the
    member -- nobody should be signed out because of this."""


def configured():return bool(os.getenv('SUPABASE_URL') and os.getenv('SUPABASE_ANON_KEY'))


# Supabase limits sign-ins and refreshes per address. Every call comes from
# this server, so without help all members shared one address's allowance
# (30 sign-ins per 5 minutes for the whole site). With a secret key
# (sb_secret_..., SUPABASE_SECRET_KEY) the member's own address goes along in
# Sb-Forwarded-For, and Supabase counts each member separately once "IP
# address forwarding" is on (Authentication -> Rate Limits). Without a
# secret key, calls go out as before.
_client_ip=contextvars.ContextVar('account_client_ip',default='')


def use_client(headers):
    """Remember the member's address for this request's calls to Supabase."""
    get=getattr(headers,'get',None)
    raw=''
    if get:
        raw=(get('x-real-ip') or get('X-Real-IP') or (get('x-forwarded-for') or get('X-Forwarded-For') or '').split(',')[0] or '').strip()
    try:ip=str(ipaddress.ip_address(raw))
    except ValueError:ip=''
    _client_ip.set(ip)
    return ip


def _secret_key():
    key=os.getenv('SUPABASE_SECRET_KEY','')
    return key if key.startswith('sb_secret_') else ''


def _auth_headers(token=None):
    headers={'apikey':os.environ['SUPABASE_ANON_KEY'],'Content-Type':'application/json'}
    ip,secret=_client_ip.get(),_secret_key()
    if ip and secret:headers.update({'apikey':secret,'Sb-Forwarded-For':ip})
    if token:headers['Authorization']='Bearer '+token
    return headers


def call(path,body=None,token=None,method=None):
    if not configured():raise RuntimeError('Email accounts are not configured yet')
    url=os.environ['SUPABASE_URL'].rstrip('/')
    if not url.startswith('https://'):raise RuntimeError('Invalid account configuration')
    headers=_auth_headers(token)
    try:
        response=requests.request(method or ('POST' if body is not None else 'GET'),url+'/auth/v1/'+path,json=body,headers=headers,timeout=12)
    except requests.RequestException as exc:
        raise AccountUnavailable('Account service unreachable') from exc
    if response.status_code==429 or response.status_code>=500:
        raise AccountUnavailable('Account service busy')
    if not response.ok:
        try:
            body=response.json()
            reason=str(body.get('error_code') or body.get('error') or body.get('msg') or '')[:80]
        except Exception:
            reason=''
        raise AccountRejected('Account request unsuccessful. Check your credentials or email confirmation and try again.',f'{response.status_code} {reason}'.strip())
    return response.json() if response.content else {}


def cookies(headers):
    cookie=SimpleCookie()
    try:cookie.load(headers.get('Cookie',''))
    except Exception:return {}
    return {k:v.value for k,v in cookie.items()}


def token_expiry(token):
    """The access token's own `exp`, read without verifying the signature.

    Used ONLY to decide when to refresh and how long a verification may be
    reused -- never as proof of identity. A forged token cannot borrow a real
    one's verification, because verifications are keyed by a hash of the
    entire token string."""
    try:
        payload=token.split('.')[1]
        payload+='='*(-len(payload)%4)
        return int(json.loads(base64.urlsafe_b64decode(payload))['exp'])
    except Exception:
        return None


def _digest(value):return hashlib.sha256(value.encode('utf-8')).hexdigest()


def _kv():
    try:
        from v2.board import store
    except Exception:
        return None
    return store if store.configured() else None


def _kv_get(key):
    store=_kv()
    if not store:return None
    try:
        raw=store.get(key,timeout=2)
        return json.loads(raw) if raw else None
    except Exception:
        return None


def _kv_setex(key,value,seconds):
    """SET with expiry, via the same pipeline call rate_allowed() uses."""
    store=_kv()
    if not store:return
    try:
        store.pipeline([['SET',key,json.dumps(value),'EX',int(seconds)]],timeout=2)
    except Exception:
        pass


def _kv_claim(key,seconds):
    """True when this call claimed `key` (it wasn't held), else False. With no
    storage, or storage failing, every caller may go ahead."""
    store=_kv()
    if not store:return True
    try:
        result=store.pipeline([['SETNX',key,'1'],['EXPIRE',key,int(seconds)]],timeout=2)
        return result[0].get('result') in (1,True,'1','OK')
    except Exception:
        return True


def _kv_release(key):
    store=_kv()
    if not store:return
    try:store.pipeline([['DEL',key]],timeout=2)
    except Exception:pass


# token hash -> (verified_at, identity). Shared across instances through KV,
# with this in-process copy saving the round trip on a warm instance.
_identity_cache={}


def _identity_from_user(user):
    if not user.get('id') or not user.get('email'):return None
    return {'id':user['id'],'username':user.get('email'),'email':user.get('email'),'has_premium':False,'has_tester':False,'account':True}


def _remember_identity(token,identity,exp):
    # Only real, unexpired Supabase access tokens are ever remembered. They
    # are always JWTs with an `exp`; anything else is not worth trusting.
    if not exp or exp<=time.time():return
    key=_digest(token)
    _identity_cache[key]=(time.time(),identity)
    if len(_identity_cache)>2048:_identity_cache.pop(next(iter(_identity_cache)))
    _kv_setex('krazy_data:account_identity:'+key,{'verifiedAt':time.time(),'identity':identity},exp-time.time())


def _recall_identity(token):
    key=_digest(token)
    hit=_identity_cache.get(key)
    if hit:return hit
    stored=_kv_get('krazy_data:account_identity:'+key)
    if stored and stored.get('identity'):
        hit=(stored.get('verifiedAt',0),stored['identity'])
        _identity_cache[key]=hit
        return hit
    return None


def identity_for_token(token):
    if not token:return None
    exp=token_expiry(token)
    if exp is None:
        # Not shaped like a Supabase access token, so no stored verification
        # is ever consulted for it -- only a live answer from Supabase counts.
        # This is what stops a stray cache entry for an arbitrary string from
        # ever standing in for a sign-in.
        try:return _identity_from_user(call('user',token=token))
        except (RuntimeError,ValueError):return None
    if exp<=time.time():return None  # expired: refreshing is ensure_session()'s job
    hit=_recall_identity(token)
    if hit and time.time()-hit[0]<IDENTITY_FRESH_SECONDS:return hit[1]
    try:
        user=call('user',token=token)
    except AccountRejected:
        return None
    except (RuntimeError,ValueError):
        # No answer from Supabase. A token already verified, and not yet
        # expired, is still good -- a network hiccup must not sign anyone out.
        return hit[1] if hit else None
    identity=_identity_from_user(user)
    if identity:_remember_identity(token,identity,exp)
    return identity


def identity(headers):
    use_client(headers)
    return identity_for_token(cookies(headers).get(ACCESS))


def _rotation(refresh_token):
    return _kv_get('krazy_data:account_rotated:'+_digest(refresh_token))


def _latest_rotation(refresh_token):
    """The newest session this token was ever rotated into, following each
    stored rotation in turn (old token -> next -> ... -> current), or None."""
    found,seen,token=None,set(),refresh_token
    for _ in range(ROTATION_HOPS):
        step=_rotation(token)
        if not (step and step.get('access_token') and step.get('refresh_token')) or step['refresh_token'] in seen:break
        found=step;seen.add(token);token=step['refresh_token']
    return found


def _usable(session):
    exp=token_expiry(session.get('access_token','')) if session else None
    return bool(exp and exp-time.time()>REFRESH_AHEAD_SECONDS)


def refresh_session(refresh_token):
    """Exchange a refresh token, safely under Supabase's rotation.

    Every rotation is kept for a month, keyed by a hash of the OLD token.
    Presenting an old token again -- a retry after a lost response, a browser
    back days later, two tabs refreshing at once -- follows those rotations to
    the session's current token instead of reusing a revoked one. One refresh
    of a token runs at a time across server instances; the others wait for
    its result."""
    if not refresh_token:raise AccountRejected('Account session unavailable','no refresh token')
    latest=_latest_rotation(refresh_token)
    if latest and _usable(latest):return latest
    # The token to present to Supabase: the newest in the chain, which has
    # never been rotated (or there would be another link).
    current=latest['refresh_token'] if latest else refresh_token
    lock='krazy_data:account_refreshing:'+_digest(current)
    claimed=_kv_claim(lock,REFRESH_LOCK_SECONDS)
    if not claimed:
        deadline=time.time()+REFRESH_WAIT_SECONDS
        while time.time()<deadline:
            time.sleep(.25)
            done=_rotation(current)
            if done and done.get('access_token') and done.get('refresh_token'):return done
    try:
        data=call('token?grant_type=refresh_token',{'refresh_token':current})
        if not data.get('access_token') or not data.get('refresh_token'):raise AccountRejected('Account session unavailable','no tokens returned')
        result={'access_token':data['access_token'],'refresh_token':data['refresh_token'],'expires_in':data.get('expires_in',3600)}
        _kv_setex('krazy_data:account_rotated:'+_digest(current),result,ROTATION_GRACE_SECONDS)
    finally:
        if claimed:_kv_release(lock)
    # Seed the verification from the user Supabase just returned, so the very
    # next request does not have to ask again.
    identity=_identity_from_user(data.get('user') or {})
    if identity:_remember_identity(result['access_token'],identity,token_expiry(result['access_token']))
    return result


def remembered(headers):
    """Sessions from before this setting existed are treated as remembered."""
    return cookies(headers).get(REMEMBER,'1')!='0'


def session_cookies(data,remember=True):
    access=data.get('access_token');refresh=data.get('refresh_token')
    if not access or not refresh:raise AccountRejected('Account session unavailable')
    # No Max-Age makes a cookie last only for this browser session -- which
    # is exactly what "don't remember me" means.
    access_age=f'; Max-Age={int(data.get("expires_in",3600))}' if remember else ''
    long_age=f'; Max-Age={REMEMBER_SECONDS}' if remember else ''
    return [f'{ACCESS}={access}{_COOKIE_FLAGS}{access_age}',
            f'{REFRESH}={refresh}{_COOKIE_FLAGS}{long_age}',
            f'{REMEMBER}={"1" if remember else "0"}{_COOKIE_FLAGS}{long_age}']


def clear_cookies():return [f'{name}={_COOKIE_FLAGS}; Max-Age=0' for name in (ACCESS,REFRESH,REMEMBER)]


def ensure_session(headers):
    """(identity, cookies to set, pending) for the current request.

    Refreshes ahead of expiry, so a member keeping the site open never meets
    an expired token, and after expiry when they come back. Only a definite
    rejection from Supabase ends the session; a failed attempt leaves the
    cookies alone and reports `pending` so the client simply tries again."""
    use_client(headers)
    jar=cookies(headers)
    access=jar.get(ACCESS);refresh=jar.get(REFRESH)
    exp=token_expiry(access) if access else None
    due=not access or exp is None or exp-time.time()<REFRESH_AHEAD_SECONDS
    if refresh and due:
        try:
            data=refresh_session(refresh)
            member=identity_for_token(data['access_token'])
            # Refreshed but not confirmed this instant (Supabase slow): still
            # signed in, so the page keeps asking instead of signing out.
            return member,session_cookies(data,remembered(headers)),member is None
        except AccountRejected as exc:
            print(f'[account] session ended: refresh rejected ({exc.reason or "no reason given"})',flush=True)
            return None,clear_cookies(),False
        except (RuntimeError,ValueError):
            pass
    current=identity_for_token(access)
    return current,[],bool(refresh) and not current


# --- Google sign-in -------------------------------------------------------
# Supabase runs the Google side (Authentication -> Providers -> Google); this
# server starts it and finishes it, so the session lands in the same HttpOnly
# cookies as an email sign-in and nothing reaches client storage. The PKCE
# verifier waits in a short-lived cookie scoped to /api/session. It is
# SameSite=Lax because the return from Google is a cross-site navigation,
# which a Strict cookie would not come back on.
OAUTH_PROVIDERS=('google',)
OAUTH_COOKIE='krazy_oauth'
OAUTH_SECONDS=10*60
_OAUTH_FLAGS='; Path=/api/session; HttpOnly; Secure; SameSite=Lax'
# An account made this recently was made by this sign-in.
NEW_ACCOUNT_SECONDS=10*60
PROVIDERS_FRESH_SECONDS=5*60
_providers={'at':0,'value':None}


def oauth_start(provider,callback,remember=True):
    """(Supabase URL to send the browser to, cookie holding the verifier)."""
    if provider not in OAUTH_PROVIDERS:raise AccountRejected('Account provider unavailable')
    if not configured():raise RuntimeError('Email accounts are not configured yet')
    verifier=secrets.token_urlsafe(48)
    challenge=base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
    query=urlencode({'provider':provider,'redirect_to':callback,'code_challenge':challenge,'code_challenge_method':'s256'})
    url=os.environ['SUPABASE_URL'].rstrip('/')+'/auth/v1/authorize?'+query
    return url,f'{OAUTH_COOKIE}={verifier}.{1 if remember else 0}{_OAUTH_FLAGS}; Max-Age={OAUTH_SECONDS}'


def oauth_pending(headers):
    """(verifier, remember) from the cookie oauth_start() set, or (None, True)."""
    verifier,_,remember=cookies(headers).get(OAUTH_COOKIE,'').partition('.')
    return (verifier or None),remember!='0'


def oauth_clear():return f'{OAUTH_COOKIE}={_OAUTH_FLAGS}; Max-Age=0'


def oauth_finish(code,verifier):
    """The session for the code Google's sign-in came back with."""
    if not code or not verifier:raise AccountRejected('Account session unavailable')
    data=call('token?grant_type=pkce',{'auth_code':code,'code_verifier':verifier})
    if not data.get('access_token') or not data.get('refresh_token'):raise AccountRejected('Account session unavailable')
    identity=_identity_from_user(data.get('user') or {})
    if identity:_remember_identity(data['access_token'],identity,token_expiry(data['access_token']))
    return data


def is_new_account(user,now=None):
    try:created=datetime.fromisoformat(str(user.get('created_at')).replace('Z','+00:00'))
    except (TypeError,ValueError):return False
    if created.tzinfo is None:created=created.replace(tzinfo=timezone.utc)
    return (now or time.time())-created.timestamp()<NEW_ACCOUNT_SECONDS


def remove_account(user_id):
    """Deletes an account Google sign-in just made while sign-ups are closed,
    with the server key (never the anonymous one). False when it can't."""
    key=os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY','')
    url=os.getenv('SUPABASE_URL','').rstrip('/')
    if not key or not url.startswith('https://') or not user_id:return False
    headers={'apikey':key}
    if not key.startswith('sb_secret_'):headers['Authorization']='Bearer '+key
    try:return requests.delete(f'{url}/auth/v1/admin/users/{user_id}',headers=headers,timeout=12).ok
    except requests.RequestException:return False


def refuse_account(user_id):
    """An account Google sign-in made while sign-ups are closed: removed, or
    when that can't be done, remembered so it stays refused."""
    if not user_id or remove_account(user_id):return
    _kv_setex('krazy_data:refused_account:'+_digest(str(user_id)),{'at':time.time()},400*24*3600)


def was_refused(user_id):
    return bool(user_id) and bool(_kv_get('krazy_data:refused_account:'+_digest(str(user_id))))


def enabled_providers():
    """The sign-in providers switched on in Supabase, so the sign-in screen
    only offers what works. Asked at most every five minutes."""
    now=time.time()
    if _providers['value'] is not None and now-_providers['at']<PROVIDERS_FRESH_SECONDS:return _providers['value']
    try:
        external=(call('settings') or {}).get('external') or {}
        value=[name for name in OAUTH_PROVIDERS if external.get(name) is True]
    except Exception:
        return _providers['value'] or []
    _providers.update(at=now,value=value)
    return value


def rate_allowed(headers,email=''):
    """Shared Redis counter; no emails, passwords or raw addresses in keys."""
    import hashlib
    from v2.board import store
    store.require_configured()
    address=headers.get('x-forwarded-for','unknown').split(',')[0].strip()
    digest=hashlib.sha256((address+'|'+str(email).strip().lower()).encode()).hexdigest()
    key='krazy_data:account_rate:'+digest
    result=store.pipeline([['INCR',key],['EXPIRE',key,900,'NX']])
    if type(result[0].get('result')) is not int or result[0]['result'] < 1 or type(result[1].get('result')) is not int or result[1]['result'] not in (0,1):raise store.StorageUnavailable()
    return result[0]['result']<=20
