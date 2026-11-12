"""Saved-pick alerts: a member whose saved picks include a PrizePicks line
that moves or is pulled gets a notification on every device with alerts on
(push_notices.py), and tapping it opens that prop in the Finder.

Each account's saved picks (the synced slip, account_profile.py) are kept
here in one small hash -- written when the slip is saved and when the member
turns alerts on -- so checking a batch of moves reads a single key.
line_moves.py calls notify() with each batch it finds.

Ruled out (Nov 12): a saved NBA pick whose player turns up Out on ESPN's
injury report gets one notification that day (injury_tick, from the timer,
at most every INJURY_EVERY; OUT_KEY remembers who was told).
"""
import hashlib
import json
import re
from urllib.parse import urlencode

import line_moves
import push_notices

WATCH_KEY = 'krazy:alerts:watch'
MAX_PICKS = 12
# The NBA and college football joined Nov 12 (the owner: things that can be
# added for free): their lines were already checked, nobody heard of a move.
SPORTS = {'mlb', 'wnba', 'nfl', 'nhl', 'soccer', 'nba', 'cfb'}
# The Finder labels some stats in full where PrizePicks abbreviates them
# ("Points + Rebounds + Assists" / "Pts+Rebs+Asts"); both read the same here.
WORDS = {'points': 'pts', 'point': 'pts', 'score': 'pts', 'rebounds': 'rebs', 'rebound': 'rebs', 'assists': 'asts',
         'assist': 'asts', 'blocks': 'blks', 'block': 'blks', 'steals': 'stls', 'steal': 'stls', 'pointers': 'pt',
         'pointer': 'pt', 'turnovers': 'to', 'yards': 'yds', 'yard': 'yds', 'receiving': 'rec', 'rushing': 'rush',
         'passing': 'pass', 'strikeouts': 'ks', 'strikeout': 'ks', 'and': ''}


def stat_key(value):
    words = re.findall(r'[a-z0-9]+', str(value or '').lower())
    return ''.join(WORDS.get(word, word) for word in words)


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def pick_view(prop):
    """The parts of a saved pick an alert needs, or None for one that can't
    be matched (no player, stat or line)."""
    if not isinstance(prop, dict):
        return None
    sport = str(prop.get('sport') or 'mlb').lower()
    player = str(prop.get('player') or '').strip()
    stat = str(prop.get('exportStat') or prop.get('betType') or prop.get('stat') or '').strip()
    line = _number(prop.get('line'))
    if sport not in SPORTS or not player or not stat or line is None:
        return None
    return {'sport': sport, 'player': player, 'stat': stat, 'line': line,
            'side': 'Under' if str(prop.get('side') or '').lower() == 'under' else 'Over',
            'modifier': str(prop.get('modifier') or 'standard').lower()}


def watch(uid, slip):
    """Keep `uid`'s saved picks for alerts (none: forget them). Only the
    deployed site writes (line_moves.enabled)."""
    if not uid or not line_moves.enabled():
        return
    picks = [pick for pick in map(pick_view, slip if isinstance(slip, list) else []) if pick][:MAX_PICKS]
    command = ['HSET', WATCH_KEY, str(uid), json.dumps(picks, separators=(',', ':'))] if picks \
        else ['HDEL', WATCH_KEY, str(uid)]
    push_notices._pipeline([command])


def matches(pick, move):
    if pick['sport'] != move.get('sport') or line_moves.norm(pick['player']) != line_moves.norm(move.get('player')):
        return False
    if stat_key(pick['stat']) != stat_key(move.get('stat')):
        return False
    # A Goblin's or Demon's number isn't the standard line; only a pull
    # speaks for it.
    return move.get('kind') == 'pulled' or pick['modifier'] in ('', 'standard')


def _figure(value):
    return f'{value:g}' if isinstance(value, (int, float)) else str(value)


def message(pick, move):
    """What the member sees, and where tapping it goes: that prop in the Finder."""
    mine = f"Your {move.get('player') or pick['player']} {_figure(pick['line'])} {pick['stat']}"
    if move['kind'] == 'pulled':
        title, body = 'Line pulled', f'{mine} was pulled from PrizePicks.'
    elif move.get('to') == pick['line']:
        title, body = 'Line moved', f"{mine} is back to {_figure(move['to'])}."
    else:
        title, body = 'Line moved', f"{mine} just moved to {_figure(move['to'])}."
    prop = '|'.join((move['sport'], line_moves.norm(move.get('player')), stat_key(move.get('stat'))))
    return {'title': title, 'body': body[:push_notices.BODY_MAX],
            'url': '/finder?' + urlencode({'sport': move['sport'], 'player': move.get('player') or pick['player'],
                                           'stat': move.get('stat') or pick['stat']}),
            # A newer alert for the same prop replaces the last one.
            'tag': 'pick-' + hashlib.sha1(prop.encode()).hexdigest()[:12]}


def notify(moves):
    """Tell each member whose saved picks are among `moves`. {sent, removed,
    failed}, or {} when no one was affected."""
    moves = [move for move in moves or [] if move.get('app') == 'prizepicks' and move.get('kind') in ('line', 'pulled')]
    if not moves:
        return {}
    flat = (push_notices._pipeline([['HGETALL', WATCH_KEY]]) or [[]])[0] or []
    messages = {}
    for uid, raw in zip(flat[0::2], flat[1::2]):
        try:
            picks = json.loads(raw)
        except (TypeError, ValueError):
            continue
        for pick in picks if isinstance(picks, list) else []:
            for move in moves:
                if isinstance(pick, dict) and pick.get('sport') and matches(pick, move):
                    messages.setdefault(uid, []).append(message(pick, move))
    return push_notices.deliver(messages) if messages else {}


# ---------------------------------------------------------------- ruled out

INJURY_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
INJURY_AT_KEY = 'krazy:alerts:injury-at'
OUT_KEY = 'krazy:alerts:out'
INJURY_EVERY = 15 * 60
OUT_KEEP = 3 * 24 * 3600


def ruled_out(payload):
    """{player name (line_moves.norm): ESPN's short comment} for every NBA
    player listed Out on ESPN's injury report (not questionable or doubtful)."""
    out = {}
    for team in (payload or {}).get('injuries') or []:
        for item in (team or {}).get('injuries') or []:
            status = str(item.get('status') or (item.get('type') or {}).get('description') or '').strip().lower()
            name = str(((item.get('athlete') or {}).get('displayName')) or '').strip()
            if name and status in ('out', 'out for season'):
                out[line_moves.norm(name)] = str(item.get('shortComment') or '')
    return out


def out_message(pick):
    """What a member sees when their saved pick's player is ruled out."""
    who = pick['player']
    return {'title': 'Ruled out',
            'body': f"{who} is listed Out on the injury report. Your {_figure(pick['line'])} {pick['stat']} pick may not play."[:push_notices.BODY_MAX],
            'url': '/finder?' + urlencode({'sport': pick['sport'], 'player': who, 'stat': pick['stat']}),
            'tag': 'out-' + hashlib.sha1(f"{pick['sport']}|{line_moves.norm(who)}".encode()).hexdigest()[:12]}


def injury_tick(now=None, fetch=None):
    """Tell each member whose saved NBA picks include a player now listed Out,
    once a day per player. {sent, removed, failed}, {} when nothing to do or
    it isn't time yet (INJURY_EVERY)."""
    import time
    from datetime import datetime, timezone
    now = now or time.time()
    if not line_moves.enabled():
        return {}
    at, flat = (push_notices._pipeline([['GET', INJURY_AT_KEY], ['HGETALL', WATCH_KEY]]) or [None, []])[:2]
    try:
        if at and now - float(at) < INJURY_EVERY:
            return {}
    except (TypeError, ValueError):
        pass
    watched = []
    for uid, raw in zip((flat or [])[0::2], (flat or [])[1::2]):
        try:
            picks = json.loads(raw)
        except (TypeError, ValueError):
            continue
        watched += [(uid, pick) for pick in picks if isinstance(pick, dict) and pick.get('sport') == 'nba' and pick.get('player')]
    push_notices._pipeline([['SET', INJURY_AT_KEY, str(now)]])
    if not watched:
        return {}
    if fetch is None:
        import requests
        fetch = lambda: requests.get(INJURY_URL, timeout=8).json()
    out = ruled_out(fetch())
    day = datetime.fromtimestamp(now, timezone.utc).strftime('%Y-%m-%d')
    hits = [(uid, pick, f"{uid}|{line_moves.norm(pick['player'])}|{day}") for uid, pick in watched if line_moves.norm(pick['player']) in out]
    if not hits:
        return {}
    told = push_notices._pipeline([['HSETNX', OUT_KEY, key, '1'] for _, _, key in hits] + [['EXPIRE', OUT_KEY, OUT_KEEP]])
    messages = {}
    seen = set()
    for (uid, pick, key), fresh in zip(hits, told):
        if fresh and key not in seen:
            seen.add(key)
            messages.setdefault(uid, []).append(out_message(pick))
    return push_notices.deliver(messages) if messages else {}
