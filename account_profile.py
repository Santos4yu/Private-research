"""Member profiles and synced settings, so an account carries its name, photo,
slip and appearance to every device it signs in on.

Everything is keyed by the Supabase user id, never the email:
  krazy_data:profile:v1:<uid>              {"name", "avatar": <version>|None, "updatedAt"}
  krazy_data:prefs:v1:<uid>                {"<pref>": {"value": ..., "at": <ms>}, ...}
  krazy_data:account_image:v1:<uid>:<slot> {"contentType", "data", "version"}

Settings merge one at a time, newest first (`at` is when the member changed it
on their device), so a phone and a laptop changing different things never
undo each other.
"""
import base64
import json
import re
import time
import unicodedata

import requests

from v2.board import store

PROFILE_KEY = 'krazy_data:profile:v1:'
PREFS_KEY = 'krazy_data:prefs:v1:'
IMAGE_KEY = 'krazy_data:account_image:v1:'
UID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
DATA_URL_RE = re.compile(r'^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$')
NAME_MAX = 32
# Names only the site itself may use on community posts.
RESERVED_NAMES = {'admin', 'administrator', 'krazydata', 'moderator', 'mod', 'staff', 'support', 'official'}
# Decoded bytes. The client shrinks photos well below these before upload.
IMAGE_SLOTS = {'avatar': 300 * 1024, 'background': 1536 * 1024}
# What follows the account, and the JSON shape each one must have.
PREFS = {'slip': list, 'accent': dict, 'accentPresets': list, 'background': dict,
         'recentResearch': list, 'recentNfl': list}
MAX_PREFS_BYTES = 200 * 1024


def valid_uid(uid):
    return bool(UID_RE.match(str(uid or '')))


def _now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def _pipeline(commands):
    if not store.KV_URL or not store.KV_TOKEN:
        return None
    response = requests.post(store.KV_URL.rstrip('/') + '/pipeline', json=commands,
                             headers=store._headers(), timeout=store.TIMEOUT)
    response.raise_for_status()
    return response.json()


def _load(raw):
    try:
        value = json.loads(raw) if raw else None
    except ValueError:
        return None
    return value if isinstance(value, dict) else None


# ---------------------------------------------------------------- profiles
def clean_name(value):
    """A display name, or '' to clear it. Raises ValueError when unusable."""
    if value is None:
        return ''
    if not isinstance(value, str):
        raise ValueError('Enter a name')
    name = unicodedata.normalize('NFKC', value)
    name = ''.join(char for char in name if unicodedata.category(char)[0] != 'C')
    name = ' '.join(name.split())
    if len(name) > NAME_MAX:
        raise ValueError(f'Names can be up to {NAME_MAX} characters')
    if re.sub(r'[^a-z0-9]', '', name.lower()) in RESERVED_NAMES:
        raise ValueError('That name is reserved. Try another one.')
    return name


def image_url(uid, slot, version):
    return f'/api/session?action=account-image&u={uid}&slot={slot}&v={version}' if version else None


def public_profile(uid, profile):
    profile = profile or {}
    return {'name': profile.get('name') or '', 'avatarUrl': image_url(uid, 'avatar', profile.get('avatar'))}


def read_profile(uid):
    return _load(store.get(PROFILE_KEY + uid)) or {}


def profiles_for(uids):
    """uid -> stored profile, for the uids that have one. One round trip."""
    uids = sorted({uid for uid in uids if valid_uid(uid)})
    if not uids:
        return {}
    result = _pipeline([['MGET', *[PROFILE_KEY + uid for uid in uids]]])
    values = (result or [{}])[0].get('result') or []
    return {uid: profile for uid, profile in zip(uids, map(_load, values)) if profile}


_KEEP = object()


def save_profile(uid, name=_KEEP, avatar=_KEEP):
    """Update the name and/or photo. avatar: a data URL, None to remove it."""
    if not valid_uid(uid):
        raise ValueError('Sign in to edit your profile')
    profile = read_profile(uid)
    if name is not _KEEP:
        profile['name'] = clean_name(name)
    if avatar is not _KEEP:
        profile['avatar'] = save_image(uid, 'avatar', avatar) if avatar else None
    profile['updatedAt'] = _now_iso()
    if not store.set(PROFILE_KEY + uid, json.dumps(profile)):
        raise RuntimeError('Profile storage unavailable')
    return profile


# ------------------------------------------------------------------ images
def save_image(uid, slot, data_url):
    if slot not in IMAGE_SLOTS:
        raise ValueError('Unknown image')
    match = DATA_URL_RE.match(data_url or '') if isinstance(data_url, str) else None
    if not match:
        raise ValueError('Expected a JPEG, PNG, or WEBP image')
    content_type, payload = match.groups()
    try:
        raw = base64.b64decode(payload, validate=True)
    except ValueError:
        raise ValueError('Invalid image data')
    if not raw:
        raise ValueError('Invalid image data')
    if len(raw) > IMAGE_SLOTS[slot]:
        raise ValueError('That photo is too large. Try a smaller one.')
    version = str(int(time.time() * 1000))
    record = json.dumps({'contentType': content_type, 'data': payload, 'version': version})
    if not store.set(f'{IMAGE_KEY}{uid}:{slot}', record):
        raise RuntimeError('Image storage unavailable')
    return version


def read_image(uid, slot):
    if not valid_uid(uid) or slot not in IMAGE_SLOTS:
        return None
    record = _load(store.get(f'{IMAGE_KEY}{uid}:{slot}'))
    return record if record and record.get('data') else None


# ---------------------------------------------------------------- settings
def read_prefs(uid):
    prefs = _load(store.get(PREFS_KEY + uid)) or {}
    return {name: entry for name, entry in prefs.items()
            if name in PREFS and isinstance(entry, dict) and 'at' in entry}


def validate_changes(changes):
    if not isinstance(changes, dict) or not changes:
        raise ValueError('Nothing to save')
    clean = {}
    for name, entry in changes.items():
        if name not in PREFS or not isinstance(entry, dict):
            raise ValueError('Unknown setting')
        at, value = entry.get('at'), entry.get('value')
        if isinstance(at, bool) or not isinstance(at, int) or at <= 0:
            raise ValueError('Invalid setting time')
        if value is not None and not isinstance(value, PREFS[name]):
            raise ValueError('Invalid setting')
        if name == 'background' and value is not None:
            url = value.get('url')
            # Photos go up as account images; only their link is a setting.
            if not isinstance(url, str) or url.startswith('data:') or len(url) > 2048:
                raise ValueError('Upload background photos first')
        clean[name] = {'value': value, 'at': at}
    return clean


def merge_prefs(uid, changes):
    """Apply each change unless the account already has a newer one."""
    if not valid_uid(uid):
        raise ValueError('Sign in to save settings')
    changes = validate_changes(changes)
    prefs = read_prefs(uid)
    for name, entry in changes.items():
        if entry['at'] >= prefs.get(name, {}).get('at', 0):
            prefs[name] = entry
    encoded = json.dumps(prefs, separators=(',', ':'))
    if len(encoded.encode('utf-8')) > MAX_PREFS_BYTES:
        raise ValueError('Settings are too large to save')
    if not store.set(PREFS_KEY + uid, encoded):
        raise RuntimeError('Settings storage unavailable')
    return prefs


# --------------------------------------------------------------- community
def community_authors(posts):
    """Each post as the public sees it: the author's display name and photo,
    never their email. Admin posts stay 'Administrator'."""
    profiles = profiles_for(post.get('authorId') for post in posts)
    shown = []
    for post in posts:
        author = post.get('authorId')
        if author == 'admin':
            name, avatar = 'Administrator', None
        else:
            profile = public_profile(author, profiles.get(author))
            # Older posts from Discord sign-ins carry a username, not an email.
            stored = str(post.get('authorName') or '')
            fallback = stored if stored and '@' not in stored and not valid_uid(author) else 'Member'
            name, avatar = profile['name'] or fallback, profile['avatarUrl']
        shown.append({**post, 'authorName': name, 'authorAvatar': avatar})
    return shown
