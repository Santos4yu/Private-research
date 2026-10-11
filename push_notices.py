"""Announcements as phone notifications (Web Push).

Members turn alerts on in Settings; each device's push subscription is kept
in KV. The admin writes an announcement and it goes to every device -- or
only the admin's own, to try it first.

Web Push itself is two standards, done here with `cryptography` alone:
- RFC 8292 (VAPID): each send carries a short token signed with the site's
  key, so Apple's and Google's push services know it's this site.
- RFC 8291: the message is encrypted to the device's own key, so only that
  device can read it.
The site's key pair is made once and kept in KV (or set in the environment
as VAPID_PRIVATE_KEY, base64url).
"""
import base64
import hashlib
import json
import os
import re
import struct
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlparse

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from v2.board import store

VAPID_KEY = 'krazy:push:vapid'
SUBSCRIPTIONS_KEY = 'krazy:push:subscriptions'
LAST_KEY = 'krazy:push:last'
# The site's own address, noted when a member turns alerts on: automatic
# alerts (pick_alerts.py) sign with it, having no request of their own.
SITE_KEY = 'krazy:push:site'
TITLE_MAX, BODY_MAX, URL_MAX = 60, 180, 200
# How long a push service keeps trying a phone that is off.
TTL_SECONDS = 24 * 60 * 60
# Browsers' push services. A subscription pointing anywhere else is refused,
# so announcements only ever go to Apple, Google, Mozilla or Microsoft.
PUSH_HOSTS = ('push.apple.com', 'fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com',
              'notify.windows.com')


# ---------------------------------------------------------------- encoding

def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def unb64url(text):
    text = str(text or '')
    return base64.urlsafe_b64decode(text + '=' * (-len(text) % 4))


def _point(public_key):
    return public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)


# ---------------------------------------------------------------- storage

def _pipeline(commands):
    store.require_configured()
    return [entry['result'] for entry in store.pipeline(commands)]


def _pairs(flat):
    flat = flat or []
    return dict(zip(flat[0::2], flat[1::2]))


# ---------------------------------------------------------------- the site's key

_keys = {}


def vapid_keys():
    """(private key object, public key as base64url). Made once: set in the
    environment, else kept in KV -- the first request to need one makes it,
    and a request racing it takes whichever was stored first."""
    if _keys:
        return _keys['private'], _keys['public']
    raw = os.getenv('VAPID_PRIVATE_KEY', '').strip()
    if not raw:
        stored = _pipeline([['GET', VAPID_KEY]])[0]
        if not stored:
            fresh = ec.generate_private_key(ec.SECP256R1())
            candidate = b64url(fresh.private_numbers().private_value.to_bytes(32, 'big'))
            _pipeline([['SET', VAPID_KEY, candidate, 'NX']])
            stored = _pipeline([['GET', VAPID_KEY]])[0]
        raw = stored
    private = ec.derive_private_key(int.from_bytes(unb64url(raw), 'big'), ec.SECP256R1())
    _keys.update(private=private, public=b64url(_point(private.public_key())))
    return _keys['private'], _keys['public']


def public_key():
    return vapid_keys()[1]


def vapid_header(endpoint, subject, now=None):
    """The Authorization header for one send (RFC 8292): a JWT for the push
    service's origin, good for 12 hours, signed ES256 with the site's key."""
    private, public = vapid_keys()
    parts = urlparse(endpoint)
    claims = {'aud': f'{parts.scheme}://{parts.netloc}', 'exp': int((now or time.time()) + 12 * 3600), 'sub': subject}
    signing_input = '.'.join(b64url(json.dumps(part, separators=(',', ':')).encode())
                             for part in ({'typ': 'JWT', 'alg': 'ES256'}, claims))
    r, s = decode_dss_signature(private.sign(signing_input.encode(), ec.ECDSA(hashes.SHA256())))
    token = signing_input + '.' + b64url(r.to_bytes(32, 'big') + s.to_bytes(32, 'big'))
    return f'vapid t={token}, k={public}'


# ---------------------------------------------------------------- the message

def encrypt(payload, p256dh, auth, salt=None, sender=None):
    """The message encrypted to one device (RFC 8291, aes128gcm): a header
    carrying the salt and the sender's one-time public key, then the
    ciphertext. `salt` and `sender` are only passed by tests."""
    device_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), unb64url(p256dh))
    secret = unb64url(auth)
    sender = sender or ec.generate_private_key(ec.SECP256R1())
    salt = salt or os.urandom(16)
    sender_point = _point(sender.public_key())
    shared = sender.exchange(ec.ECDH(), device_key)
    ikm = HKDF(hashes.SHA256(), 32, secret, b'WebPush: info\x00' + unb64url(p256dh) + sender_point).derive(shared)
    content_key = HKDF(hashes.SHA256(), 16, salt, b'Content-Encoding: aes128gcm\x00').derive(ikm)
    nonce = HKDF(hashes.SHA256(), 12, salt, b'Content-Encoding: nonce\x00').derive(ikm)
    record_size = 4096
    ciphertext = AESGCM(content_key).encrypt(nonce, payload + b'\x02', None)
    return salt + struct.pack('!IB', record_size, len(sender_point)) + sender_point + ciphertext


# ---------------------------------------------------------------- subscriptions

def _subscription_id(endpoint):
    return hashlib.sha256(endpoint.encode()).hexdigest()[:32]


def valid_subscription(value):
    """A browser's push subscription (PushSubscription.toJSON()), checked:
    an https endpoint and the two keys, of the right sizes."""
    if not isinstance(value, dict):
        raise ValueError('Invalid subscription')
    endpoint = str(value.get('endpoint') or '')
    keys = value.get('keys') if isinstance(value.get('keys'), dict) else {}
    try:
        p256dh, auth = unb64url(keys.get('p256dh')), unb64url(keys.get('auth'))
    except (ValueError, TypeError):
        raise ValueError('Invalid subscription') from None
    host = (urlparse(endpoint).hostname or '').lower()
    known = any(host == name or host.endswith('.' + name) for name in PUSH_HOSTS)
    if not endpoint.startswith('https://') or not known or len(endpoint) > 1024 or len(p256dh) != 65 or len(auth) != 16:
        raise ValueError('Invalid subscription')
    return {'endpoint': endpoint, 'keys': {'p256dh': keys['p256dh'], 'auth': keys['auth']}}


def subscribe(account_id, subscription, site=None):
    subscription = valid_subscription(subscription)
    record = {'subscription': subscription, 'account': str(account_id or ''), 'at': int(time.time())}
    commands = [['HSET', SUBSCRIPTIONS_KEY, _subscription_id(subscription['endpoint']), json.dumps(record)]]
    if site and re.fullmatch(r'https://[a-z0-9.-]+(:[0-9]+)?', site):
        commands.append(['SET', SITE_KEY, site])
    _pipeline(commands)


def site_subject():
    """Who is sending, for alerts that aren't sent from a request."""
    configured = os.getenv('VAPID_SUBJECT', '').strip()
    if configured:
        return configured
    try:
        site = _pipeline([['GET', SITE_KEY]])[0]
    except Exception:  # noqa: BLE001
        site = None
    production = os.getenv('VERCEL_PROJECT_PRODUCTION_URL', '').strip()
    return site or (f'https://{production}' if production else 'mailto:alerts@krazydata.app')


def unsubscribe(endpoint):
    if endpoint:
        _pipeline([['HDEL', SUBSCRIPTIONS_KEY, _subscription_id(str(endpoint))]])


def subscriptions():
    records = {}
    for key, raw in _pairs(_pipeline([['HGETALL', SUBSCRIPTIONS_KEY]])[0]).items():
        try:
            records[key] = json.loads(raw)
        except (TypeError, ValueError):
            continue
    return records


def status():
    """Devices with alerts on, and the last announcement."""
    count, last = _pipeline([['HLEN', SUBSCRIPTIONS_KEY], ['GET', LAST_KEY]])
    try:
        last = json.loads(last) if last else None
    except (TypeError, ValueError):
        last = None
    return {'devices': int(count or 0), 'last': last}


# ---------------------------------------------------------------- sending

def valid_announcement(title, body, url='/'):
    title = ' '.join(str(title or '').split())[:TITLE_MAX] or 'Ace Props'
    body = str(body or '').strip()
    if not body:
        raise ValueError('Write a message first')
    if len(body) > BODY_MAX:
        raise ValueError(f'Keep the message under {BODY_MAX} characters')
    url = str(url or '/').strip()
    if not url.startswith('/') or url.startswith('//') or len(url) > URL_MAX:
        url = '/'
    return {'title': title, 'body': body, 'url': url}


def send_one(subscription, payload, subject):
    """One device: the push service's HTTP status."""
    keys = subscription['keys']
    response = requests.post(subscription['endpoint'], data=encrypt(payload, keys['p256dh'], keys['auth']), timeout=10,
                             headers={'Authorization': vapid_header(subscription['endpoint'], subject),
                                      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
                                      'TTL': str(TTL_SECONDS), 'Urgency': 'normal'})
    return response.status_code


def _send_all(jobs, subject):
    """Send each (subscription id, subscription, payload); drop devices whose
    subscription is gone. {sent, removed, failed}."""
    vapid_keys()  # loaded once here, not by every sending thread at the same time

    def deliver_one(job):
        key, subscription, payload = job
        try:
            return key, send_one(subscription, payload, subject)
        except Exception:  # noqa: BLE001 -- one device failing doesn't stop the rest
            return key, None
    with ThreadPoolExecutor(max_workers=16) as pool:
        results = list(pool.map(deliver_one, jobs))
    gone = sorted({key for key, code in results if code in (404, 410)})
    sent = sum(1 for _key, code in results if code is not None and 200 <= code < 300)
    if gone:
        _pipeline([['HDEL', SUBSCRIPTIONS_KEY, *gone]])
    return {'sent': sent, 'removed': len(gone), 'failed': len(results) - sent - sum(code in (404, 410) for _k, code in results)}


def deliver(messages, subject=None):
    """Personal notifications, {account id: [message]}, each message a dict
    with title, body, url and tag. Every device of each account gets its
    messages."""
    jobs = [(key, record['subscription'], json.dumps(message, separators=(',', ':')).encode())
            for key, record in subscriptions().items()
            for message in messages.get(str(record.get('account') or ''), [])]
    if not jobs:
        return {'sent': 0, 'removed': 0, 'failed': 0}
    return _send_all(jobs, subject or site_subject())


def announce(title, body, subject, url='/', account_id=None):
    """Send an announcement to every device, or only `account_id`'s. Devices
    whose subscription is gone (404 / 410) are dropped. {sent, removed, failed}."""
    message = valid_announcement(title, body, url)
    message['tag'] = f'announce-{int(time.time())}'
    payload = json.dumps(message, separators=(',', ':')).encode()
    targets = {key: record for key, record in subscriptions().items()
               if account_id is None or record.get('account') == str(account_id)}
    result = _send_all([(key, record['subscription'], payload) for key, record in targets.items()], subject)
    if account_id is None:
        _pipeline([['SET', LAST_KEY, json.dumps({**message, 'sent': result['sent'], 'at': int(time.time())})]])
    return result
