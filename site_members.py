"""Per-member access, set from the admin panel's Members tab.

site_controls.py's switches apply to everyone. A member rule adjusts them
for one person, keyed by email so it can be set up before that person has
ever signed in:

- access: {'tab:finder': True, 'finderSport:nfl': True, 'tab:community': False}
  True keeps an item on for them while it is switched off for everyone
  (early access); False keeps it off for them while everyone else has it.
  An item that isn't listed follows the site switch.
- suspended: locked out of the whole site until the admin lifts it.
- badge: a role shown next to their name (account menu, community posts).
- note: a private admin note. Never sent to the member.

Maintenance mode still closes the site to everyone but admins.
"""
import json
import time
from datetime import datetime, timezone

import requests

from v2.board import store

RULES_KEY = 'krazy_data:member_rules:v1'
# Who has signed in: email -> {"id", "lastSeen"}, and email -> first seen.
SEEN_KEY = 'krazy_data:members_seen:v1'
FIRST_SEEN_KEY = 'krazy_data:members_first_seen:v1'
BADGES = {'vip': 'VIP', 'pro': 'Pro', 'tester': 'Tester', 'staff': 'Staff'}
# The site policy list each kind of access item overrides.
LISTS = {'tab': 'disabledTabs', 'sport': 'disabledSports', 'finderSport': 'disabledFinderSports'}
RESEARCH_SPORTS = ('nfl',)
NOTE_MAX = 200
# Every data request checks the rules, so a warm instance reuses them for a
# few seconds. A change reaches every open page within this long.
RULES_FRESH_SECONDS = 10
# The site-status poll runs every 30s per open page; "last seen" only needs
# to be roughly right, so each instance records a member at most this often.
TOUCH_EVERY_SECONDS = 10 * 60


def access_items():
    from site_controls import ADMIN_TABS, FINDER_SPORTS, TABS
    return ([f'tab:{tab}' for tab in TABS if tab not in ADMIN_TABS] + [f'sport:{sport}' for sport in RESEARCH_SPORTS]
            + [f'finderSport:{sport}' for sport in FINDER_SPORTS])


def normalize_email(value):
    email = str(value or '').strip().lower()
    if not 3 <= len(email) <= 254 or email.count('@') != 1 or any(char.isspace() for char in email):
        return ''
    name, domain = email.split('@')
    return email if name and domain else ''


def _now():
    return datetime.now(timezone.utc).isoformat()


def _stored_rules():
    raw = store.get(RULES_KEY)
    rules = (json.loads(raw).get('rules') if raw else None) or {}
    return rules if isinstance(rules, dict) else {}


_rules_cache = [0.0, None]


def read_rules():
    now = time.monotonic()
    if _rules_cache[1] is not None and now - _rules_cache[0] < RULES_FRESH_SECONDS:
        return _rules_cache[1]
    rules = _stored_rules()
    _rules_cache[:] = [now, rules]
    return rules


def forget_cached_rules():
    _rules_cache[:] = [0.0, None]


def rule_for(rules, account):
    email = normalize_email((account or {}).get('email'))
    return rules.get(email) if email else None


def validate_rule(body):
    """A clean rule, or None when everything is back to the site default."""
    if not isinstance(body, dict):
        raise ValueError('Invalid member settings')
    access = body.get('access')
    access = {} if access is None else access
    if not isinstance(access, dict):
        raise ValueError('Invalid access settings')
    items = set(access_items())
    if any(key not in items or not isinstance(value, bool) for key, value in access.items()):
        raise ValueError('Invalid access setting')
    suspended = body.get('suspended', False)
    if not isinstance(suspended, bool):
        raise ValueError('Suspended must be true or false')
    badge = body.get('badge') or ''
    if badge not in ('', *BADGES):
        raise ValueError('Unknown badge')
    note = body.get('note') or ''
    if not isinstance(note, str) or len(note.strip()) > NOTE_MAX:
        raise ValueError(f'Notes can be up to {NOTE_MAX} characters')
    if not (access or suspended or badge or note.strip()):
        return None
    return {'access': dict(sorted(access.items())), 'suspended': suspended, 'badge': badge,
            'note': note.strip(), 'updatedAt': _now()}


def save_rule(email, rule):
    email = normalize_email(email)
    if not email:
        raise ValueError('Enter a valid email')
    rules = _stored_rules()
    if rule is None:
        rules.pop(email, None)
    else:
        rules[email] = rule
    if not store.set(RULES_KEY, json.dumps({'rules': rules, 'updatedAt': _now()})):
        raise RuntimeError('Member storage unavailable')
    forget_cached_rules()
    return rules.get(email)


def item_open(policy, rule, item):
    """Whether an access item ('tab:finder', 'sport:nfl', 'finderSport:wnba')
    is on for a viewer with this rule (None: no rule)."""
    override = ((rule or {}).get('access') or {}).get(item)
    if override is not None:
        return override
    kind, value = item.split(':', 1)
    return value not in (policy.get(LISTS[kind]) or [])


def badge_of(rule):
    key = (rule or {}).get('badge')
    return {'key': key, 'label': BADGES[key]} if key in BADGES else None


def viewer_policy(policy, rule):
    """The site policy's switches as this member sees them. The client code
    that hides switched-off sections reads these same lists, so it needs no
    idea that per-member rules exist."""
    from site_controls import FINDER_SPORTS, TABS
    return {
        'disabledTabs': [tab for tab in TABS if not item_open(policy, rule, f'tab:{tab}')],
        'disabledSports': [sport for sport in RESEARCH_SPORTS if not item_open(policy, rule, f'sport:{sport}')],
        'disabledFinderSports': [sport for sport in FINDER_SPORTS if not item_open(policy, rule, f'finderSport:{sport}')],
        'suspended': bool(rule and rule.get('suspended')),
        'badge': badge_of(rule),
    }


def decides(rules, items):
    """Whether any rule could change the answer for these items. When none
    can, a request is answered without looking up who is asking."""
    return any(rule.get('suspended') or any(item in (rule.get('access') or {}) for item in items)
               for rule in rules.values())


def is_suspended(account):
    rule = rule_for(read_rules(), account) if account else None
    return bool(rule and rule.get('suspended'))


def _pipeline(commands, timeout=None):
    if not store.KV_URL or not store.KV_TOKEN:
        return None
    response = requests.post(store.KV_URL.rstrip('/') + '/pipeline', json=commands,
                             headers=store._headers(), timeout=timeout or store.TIMEOUT)
    response.raise_for_status()
    return response.json()


_touched = {}


def touch(account):
    """Record that a member was here, for the admin's member list."""
    email = normalize_email((account or {}).get('email'))
    now = time.time()
    if not email or now - _touched.get(email, 0) < TOUCH_EVERY_SECONDS:
        return
    _touched[email] = now
    if len(_touched) > 4096:
        _touched.pop(next(iter(_touched)))
    stamp = _now()
    try:
        _pipeline([['HSET', SEEN_KEY, email, json.dumps({'id': account.get('id'), 'lastSeen': stamp})],
                   ['HSETNX', FIRST_SEEN_KEY, email, stamp]], timeout=2)
    except Exception:  # noqa: BLE001 -- bookkeeping; never fails the member's request
        pass


def _pairs(flat):
    flat = flat or []
    return dict(zip(flat[0::2], flat[1::2]))


def list_members():
    """Everyone who has signed in, plus everyone with a rule, newest first."""
    result = _pipeline([['HGETALL', SEEN_KEY], ['HGETALL', FIRST_SEEN_KEY]]) or [{}, {}]
    seen, first = (_pairs(entry.get('result')) for entry in result)
    rules = _stored_rules()
    members = []
    for email in set(seen) | set(rules):
        try:
            record = json.loads(seen[email]) if email in seen else {}
        except (TypeError, ValueError):
            record = {}
        members.append({'email': email, 'id': record.get('id'), 'lastSeen': record.get('lastSeen'),
                        'firstSeen': first.get(email), 'rule': rules.get(email), 'name': '', 'avatarUrl': None})
    # Their profile name and photo (account_profile.py), when they set one.
    import account_profile
    try:
        profiles = account_profile.profiles_for(entry['id'] for entry in members)
    except Exception:  # noqa: BLE001 -- the list still works without them
        profiles = {}
    for entry in members:
        if entry['id'] in profiles:
            entry.update(account_profile.public_profile(entry['id'], profiles[entry['id']]))
    members.sort(key=lambda member: (member['lastSeen'] or '', member['email']), reverse=True)
    return members


def member(email):
    email = normalize_email(email)
    return next((entry for entry in list_members() if entry['email'] == email),
                {'email': email, 'id': None, 'lastSeen': None, 'firstSeen': None, 'rule': None, 'name': '', 'avatarUrl': None})


def author_badges(posts):
    """Badges for community post authors. Posts carry the author's email as
    their name; the admin's own posts are marked Admin."""
    rules = read_rules()
    badges = {}
    for post in posts:
        if post.get('authorId') == 'admin':
            badges[post.get('id')] = {'key': 'admin', 'label': 'Admin'}
            continue
        badge = badge_of(rules.get(normalize_email(post.get('authorName'))))
        if badge:
            badges[post.get('id')] = badge
    return badges
