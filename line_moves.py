"""Line moves: each change to a line, as the site sees it.

Two kinds of line are watched:
- PrizePicks' standard lines, every league. prizepicks_export_core reports
  each fresh fetch of a league's feed here (observe_prizepicks).
- Sportsbooks' main lines -- MLB, WNBA, NFL, the leagues whose boards carry
  books. Each board reports its books' quotes as it builds (observe_books).
Each report is compared with the last one kept for that sport and source
(in KV). A line on a new number is a move; so is a sportsbook price that
shifts enough at the same number, and a PrizePicks line taken down before
its game ("pulled"). Moves go on one list, newest first, which the Line
Moves page reads (recent); members whose saved picks moved are told
(pick_alerts.py).

Nothing here may break a board: every entry point swallows its own errors
and does nothing when KV is not configured.
"""
import base64
import hashlib
import json
import os
import re
import secrets
import time
import unicodedata
import zlib
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import datetime, timezone

import requests

from v2.board import store

PREFIX = 'krazy:moves:v1'
LIST_KEY = f'{PREFIX}:list'
# sport -> when its lines were last compared, for the page's "updated" time.
CHECKED_KEY = f'{PREFIX}:checked'
# The secret in the line-check link an outside timer calls (timer_key).
TIMER_KEY = f'{PREFIX}:timer'
KEEP_MOVES = 1500
# How many of the newest the page reads.
READ_MOVES = 500
# A line not in the feeds for this long is forgotten; until then a line that
# drops out and comes back on another number still counts as a move.
FORGET_SECONDS = 8 * 3600
# A price move counts from 3 points of implied chance (-110 to -125, say).
ODDS_STEP = 0.03
# The page keeps PrizePicks' feeds this fresh while someone is watching it.
POLL_SECONDS = 90
# A line gone this close to its start is the game starting, not a pull.
PULL_BEFORE_START = 10 * 60
# A feed missing more than this share of its lines at once is taken as
# incomplete (a page that failed to load), not as lines pulled.
PULL_SHARE = 0.3
LEAGUES = {'MLB': 'mlb', 'WNBA': 'wnba', 'NFL': 'nfl', 'NHL': 'nhl', 'SOCCER': 'soccer'}
SPORTS = tuple(LEAGUES.values())
BOOK_NAMES = {'prizepicks': 'PrizePicks', 'underdog': 'Underdog', 'pick6': 'DK Pick6', 'betr_us_dfs': 'Betr Picks',
              'draftkings': 'DraftKings', 'fanduel': 'FanDuel', 'betmgm': 'BetMGM', 'williamhill_us': 'Caesars',
              'espnbet': 'ESPN BET', 'fanatics': 'Fanatics', 'hardrockbet': 'Hard Rock Bet', 'pinnacle': 'Pinnacle',
              'betrivers': 'BetRivers', 'betonlineag': 'BetOnline', 'bovada': 'Bovada'}

# (sport, source) -> (fingerprint, when written): an unchanged report on
# this instance is not compared again.
_last = {}


# ---------------------------------------------------------------- helpers

def enabled():
    """Only the deployed site keeps line moves (or a process that asks with
    LINE_MOVES=1): a test run feeding a board sample lines must never reach
    the real list, whatever credentials its machine has."""
    return bool(store.KV_URL) and any(os.getenv(name) for name in ('VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'LINE_MOVES'))


def _pipeline(commands, timeout=4):
    if not store.KV_URL or not store.KV_TOKEN:
        return None
    response = requests.post(store.KV_URL.rstrip('/') + '/pipeline', json=commands, headers=store._headers(),
                             timeout=timeout)
    response.raise_for_status()
    return [entry.get('result') for entry in response.json()]


def _pack(value):
    return base64.b64encode(zlib.compress(json.dumps(value, separators=(',', ':')).encode(), 6)).decode()


def _unpack(text):
    try:
        return json.loads(zlib.decompress(base64.b64decode(text)))
    except Exception:  # noqa: BLE001 -- a damaged copy is simply no copy
        return None


def norm(value):
    text = unicodedata.normalize('NFKD', str(value or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', text)


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float('inf') else None


def _timestamp(value):
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return float(value)
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
    except (TypeError, ValueError):
        return None


def _iso(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat(timespec='seconds')


def chance(price):
    """American odds as implied chance."""
    price = _number(price)
    if price is None or -100 < price < 100:
        return None
    return -price / (-price + 100) if price < 0 else 100 / (price + 100)


def _hour(value):
    seconds = _timestamp(value)
    return str(int(seconds // 3600)) if seconds else ''


def _when(updated, previous, fetched_at):
    """When a move happened: the feed's own update time when it falls after
    the line was last seen unmoved, else when it was noticed."""
    updated = _timestamp(updated)
    if updated and previous < updated <= fetched_at + 60:
        return updated
    return fetched_at


def _move(sport, kind, app, player, stat, frm, to, at, **extra):
    move = {'sport': sport, 'kind': kind, 'app': app, 'appName': BOOK_NAMES.get(app, app), 'player': player,
            'stat': stat, 'from': frm, 'to': to, 'at': _iso(at)}
    if kind == 'line':
        move['change'] = round(to - frm, 2)
    move.update({key: value for key, value in extra.items() if value not in (None, '')})
    move['id'] = hashlib.sha1(json.dumps([sport, kind, app, player, stat, frm, to, move['at']]).encode()).hexdigest()[:12]
    return move


# ---------------------------------------------------------------- comparing

def _checked(sport, fetched_at):
    """Record that `sport` was just checked, at most every couple of minutes
    from one server."""
    if fetched_at - _checked_at.get(sport, 0) >= 120:
        _checked_at[sport] = fetched_at
        _pipeline([['HSET', CHECKED_KEY, sport, int(fetched_at)]])


_checked_at = {}


def _compare(sport, source, entries, fetched_at, find_moves, extra=None, width=None):
    """Compare this report (`entries`: key -> values) with the last one kept,
    keep the new one, and add the moves `find_moves(before, now, previous_at,
    state, old)` finds. `state` is kept with the copy for the next report;
    `extra(old, kept)` adds to the copy. Runs under a short lock so two
    servers never compare the same change twice; a report older than the one
    kept is ignored. A report whose first `width` values match the last one
    this server compared is skipped, unless something is waiting on the
    next look."""
    fingerprint = hashlib.sha1(json.dumps(sorted((key, value[:width]) for key, value in entries.items())).encode()).hexdigest()
    last = _last.get((sport, source))
    if last and last[0] == fingerprint and not last[2] and fetched_at - last[1] < 15 * 60:
        _checked(sport, fetched_at)
        return []
    snap_key, lock_key = f'{PREFIX}:snap:{sport}:{source}', f'{PREFIX}:lock:{sport}:{source}'
    reply = _pipeline([['SET', lock_key, '1', 'NX', 'EX', 20], ['GET', snap_key]])
    if not reply or reply[0] != 'OK':
        return []
    try:
        old = _unpack(reply[1]) if reply[1] else None
        if old and float(old.get('at') or 0) > fetched_at:
            _pipeline([['DEL', lock_key]])
            return []
        before = (old or {}).get('lines') or {}
        state = dict((old or {}).get('state') or {})
        moves = find_moves(before, entries, float((old or {}).get('at') or 0), state, old) if old else []
        kept = {key: value for key, value in before.items()
                if key not in entries and fetched_at - float(value[-1] or 0) < FORGET_SECONDS}
        kept.update({key: [*value, fetched_at] for key, value in entries.items()})
        snapshot = {'at': fetched_at, 'lines': kept, 'state': state, **(extra(old or {}, kept) if extra else {})}
        _checked_at[sport] = fetched_at
        commands = [['SET', snap_key, _pack(snapshot)], ['HSET', CHECKED_KEY, sport, int(fetched_at)]]
        if moves:
            moves.sort(key=lambda move: move['at'])  # LPUSH puts the last one first
            commands += [['LPUSH', LIST_KEY, *(json.dumps(move, separators=(',', ':')) for move in moves)],
                         ['LTRIM', LIST_KEY, 0, KEEP_MOVES - 1]]
        _pipeline([*commands, ['DEL', lock_key]])
        _last[(sport, source)] = (fingerprint, fetched_at, bool(state.get('pending')))
        return moves
    except Exception:
        try:
            _pipeline([['DEL', lock_key]])
        except Exception:  # noqa: BLE001 -- the lock runs out on its own
            pass
        raise


def observe_prizepicks(league, rows, fetched_at=None):
    """A fresh PrizePicks feed for `league` (prizepicks_export_core rows).
    Standard lines only: a Goblin's or Demon's number is set from the
    standard line, so it moves with it."""
    sport = LEAGUES.get(str(league or '').upper())
    if not sport or not enabled():
        return []
    fetched_at = fetched_at or time.time()
    entries, rows_by_key, people, stats = {}, {}, {}, {}
    for row in rows or []:
        # A flash sale is a promotion, not the line moving.
        if row.get('combo') or row.get('flash') or str(row.get('odds_type') or 'standard') != 'standard':
            continue
        line = _number(row.get('line'))
        player, stat = str(row.get('player') or '').strip(), str(row.get('stat') or '').strip()
        if line is None or not player or not stat:
            continue
        key = f"{norm(player)}|{norm(stat)}|{_hour(row.get('start_time'))}"
        if key in entries:
            continue
        entries[key] = [line, _timestamp(row.get('updated_at')) or 0, _timestamp(row.get('start_time')) or 0]
        rows_by_key[key] = row
        people.setdefault(norm(player), [player, row.get('team') or '', row.get('headshot') or '',
                                         row.get('description') or ''])
        stats.setdefault(norm(stat), stat)

    def find_moves(before, now, previous_at, state, old):
        moves = []
        for key, (line, updated, _start) in now.items():
            if key not in before or before[key][0] == line:
                continue
            row, was = rows_by_key[key], before[key]
            moves.append(_move(sport, 'line', 'prizepicks', row['player'], row['stat'], was[0], line,
                               _when(updated, max(float(was[1] or 0), previous_at), fetched_at),
                               team=row.get('team'), opponent=row.get('description'), headshot=row.get('headshot'),
                               startsAt=row.get('start_time')))
        return moves + _pulled(sport, before, now, fetched_at, state, old)

    def extra(old, kept):
        # Names, teams and stat names for lines no longer in the feed, so a
        # pulled line can still be described; only for lines still kept.
        players = {key.split('|', 1)[0] for key in kept}
        known = {**(old.get('people') or {}), **people}
        return {'people': {key: value for key, value in known.items() if key in players},
                'stats': {**(old.get('stats') or {}), **stats}}
    # Only the numbers decide whether anything moved; PrizePicks' update
    # times change far more often than its lines.
    moves = _compare(sport, 'pp', entries, fetched_at, find_moves, extra, width=1)
    if moves:
        try:
            import pick_alerts
            pick_alerts.notify(moves)
        except Exception:  # noqa: BLE001 -- the moves stand without their alerts
            pass
    return moves


def _pulled(sport, before, now, fetched_at, state, old):
    """PrizePicks lines taken down before their game. A line is pulled once it
    is still gone on the next look (PrizePicks sometimes drops and reposts a
    line within moments), its game has not started, and the same prop is not
    back under another start time. A feed missing a large share of its lines
    at once is taken as incomplete: nothing is called pulled from it."""
    pending = state.setdefault('pending', {})
    previous_at = float(old.get('at') or 0)
    people, stats = old.get('people') or {}, old.get('stats') or {}
    present = {key.rsplit('|', 1)[0] for key in now}
    for key in [key for key in pending if key in now or key not in before]:
        pending.pop(key)  # back, or forgotten
    last_seen = [key for key, value in before.items() if float(value[-1] or 0) >= previous_at - 1]
    gone = [key for key in last_seen if key not in now]
    if len(gone) > max(10, PULL_SHARE * len(last_seen)):
        return []

    def upcoming(key):
        start = float(before[key][2] or 0) if len(before[key]) > 3 else 0
        return start > fetched_at + PULL_BEFORE_START and key.rsplit('|', 1)[0] not in present
    moves = []
    for key, first_gone in list(pending.items()):
        pending.pop(key)
        if not upcoming(key):
            continue
        player_key, stat_key = key.split('|')[:2]
        person = people.get(player_key) or []
        moves.append(_move(sport, 'pulled', 'prizepicks', person[0] if person else player_key,
                           stats.get(stat_key, stat_key), before[key][0], None, float(first_gone),
                           team=person[1] if len(person) > 1 else None, headshot=person[2] if len(person) > 2 else None,
                           opponent=person[3] if len(person) > 3 else None, startsAt=_iso(float(before[key][2]))))
    for key in gone:
        if upcoming(key):
            pending[key] = fetched_at
    return moves


def observe_books(sport, quotes, fetched_at=None):
    """A board's sportsbook quotes: dicts with book, player, stat, line,
    over, under and, when known, alternate, startsAt, updatedAt. Main lines
    only; a book showing two main numbers for one prop is left out, since
    which one moved can't be told."""
    if sport not in SPORTS or not enabled():
        return []
    fetched_at = fetched_at or time.time()
    entries, quotes_by_key, doubled = {}, {}, set()
    for quote in quotes or []:
        if quote.get('alternate') or quote.get('book') in (None, '', 'prizepicks'):
            continue
        line = _number(quote.get('line'))
        player, stat = str(quote.get('player') or '').strip(), str(quote.get('stat') or '').strip()
        if line is None or not player or not stat:
            continue
        key = f"{quote['book']}|{norm(player)}|{norm(stat)}|{_hour(quote.get('startsAt'))}"
        if key in entries and entries[key][0] != line:
            doubled.add(key)
        entries[key] = [line, _number(quote.get('over')), _number(quote.get('under'))]
        quotes_by_key[key] = quote
    for key in doubled:
        entries.pop(key, None)

    def find_moves(before, now, previous_at, state, old):
        # Faces and teams come from PrizePicks' copy of the same sport, read
        # only when there is something to compare.
        people = {}
        try:
            reply = _pipeline([['GET', f'{PREFIX}:snap:{sport}:pp']])
            people = ((_unpack(reply[0]) or {}).get('people') or {}) if reply and reply[0] else {}
        except Exception:  # noqa: BLE001 -- a nicety
            pass
        moves = []
        for key, (line, over, under) in now.items():
            if key not in before:
                continue
            old_line, old_over, old_under = before[key][:3]
            quote = quotes_by_key[key]
            person = people.get(norm(quote['player'])) or []
            extra = {'team': person[1] if len(person) > 1 else None, 'headshot': person[2] if len(person) > 2 else None,
                     'opponent': person[3] if len(person) > 3 else None, 'startsAt': quote.get('startsAt'),
                     'over': over, 'under': under}
            at = _when(quote.get('updatedAt'), previous_at, fetched_at)
            if line != old_line:
                moves.append(_move(sport, 'line', quote['book'], person[0] if person else quote['player'], quote['stat'],
                                   old_line, line, at, **extra))
                continue
            for side, new, old in (('over', over, old_over), ('under', under, old_under)):
                if chance(new) is None or chance(old) is None:
                    continue
                shift = chance(new) - chance(old)
                if abs(shift) >= ODDS_STEP:
                    moves.append(_move(sport, 'odds', quote['book'], person[0] if person else quote['player'],
                                       quote['stat'], old, new, at, side=side, line=line,
                                       change=round(100 * shift, 1), **extra))
                break  # one side tells it; the other mirrors
        return moves
    return _compare(sport, 'books', entries, fetched_at, find_moves)


def safely(function, *args, **kwargs):
    """For the boards: a line-move report that fails must never fail them."""
    try:
        return function(*args, **kwargs)
    except Exception:  # noqa: BLE001
        return []


# ---------------------------------------------------------------- the page

_polled = {}


def keep_fresh(sports, fetch=None, budget=6.0):
    """Fetch the PrizePicks feed of each sport no server has checked in the
    last POLL_SECONDS (the fetch reports its lines here). Waits at most
    `budget` seconds; a slow feed finishes on its own."""
    if not enabled():
        return
    if fetch is None:
        from prizepicks_export_core import _fetch_projection_rows as fetch
    now = time.time()
    leagues = {sport: league for league, sport in LEAGUES.items()
               if sport in sports and now - _polled.get(sport, 0) >= POLL_SECONDS / 2}
    if not leagues:
        return
    _polled.update({sport: now for sport in leagues})
    claims = _pipeline([['SET', f'{PREFIX}:poll:{sport}', '1', 'NX', 'EX', POLL_SECONDS] for sport in leagues]) or []
    due = [league for (sport, league), claim in zip(leagues.items(), claims) if claim == 'OK']
    if not due:
        return
    pool = ThreadPoolExecutor(max_workers=len(due))
    futures = [pool.submit(safely, fetch, league=league) for league in due]
    wait(futures, timeout=budget)
    pool.shutdown(wait=False)


def timer_key():
    """The secret in the line-check link (api/v2-admin.py moves-tick), made
    once and kept in KV. The admin copies the link into a free timer service
    so lines are checked even when no one has the site open."""
    reply = _pipeline([['GET', TIMER_KEY]])
    if reply is None:
        return None
    if not reply[0]:
        _pipeline([['SET', TIMER_KEY, secrets.token_urlsafe(24), 'NX']])
        reply = _pipeline([['GET', TIMER_KEY]])
    return reply[0]


def checked():
    """sport -> when its lines were last compared."""
    flat = (_pipeline([['HGETALL', CHECKED_KEY]]) or [[]])[0] or []
    return {sport: _iso(float(seconds)) for sport, seconds in zip(flat[0::2], flat[1::2]) if _number(seconds)}


def recent(sports, limit=500):
    """The newest moves in `sports`, and when each sport was last checked."""
    reply = _pipeline([['LRANGE', LIST_KEY, 0, READ_MOVES - 1], ['HGETALL', CHECKED_KEY]]) or [[], []]
    moves = []
    for raw in reply[0] or []:
        try:
            move = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if move.get('sport') in sports:
            moves.append(move)
            if len(moves) >= limit:
                break
    flat = reply[1] or []
    checked = {sport: _iso(float(seconds)) for sport, seconds in zip(flat[0::2], flat[1::2])
               if sport in sports and _number(seconds)}
    return {'moves': moves, 'checked': checked}
