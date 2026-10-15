"""Shared, provider-sourced Finder histories. Atomic per-player writes.

Snapshots never contain prices: each current line is graded against the raw
history by the existing frontend. Failed/partial reads cannot erase good data.

Each sport keeps two tables: the histories themselves, and a small index of
when each one was saved and last opened. The timer and the Finder pages read
the index and fetch only the histories that changed, never every saved
history on every look.
"""
import json
import time
import unicodedata
import re
from threading import Lock

SPORTS = ('wnba', 'nba', 'mlb', 'soccer', 'nhl', 'cfb', 'tennis')
MAX_AGE = 24 * 3600
FRESH = 30 * 60
# Players nobody has opened (and no board has listed) for a week stop being
# refreshed and are dropped; opening one again brings it straight back.
KEEP = 7 * 86400
JOBS = 'finder:history:jobs:v1'
INDEX_MEMORY_SECONDS = 10 * 60
SNAPSHOT_MEMORY_SECONDS = 120
TIDY_SECONDS = 86400
ENROLL_SECONDS = 3600
# Past this many changed players, one full read is cheaper than many small ones.
FULL_READ_AFTER = 150
CHUNK = 500

_lock = Lock()
_index = {}      # sport -> (read at, {key: {'at', 'seen', 'args'}})
_full = {}       # sport -> (read at, {key: {'at', 'payload', 'args'}})
_tidied = {}     # sport -> when this server last confirmed the daily tidy
_enrolled = {}   # sport -> (when, enrolled fields)
_jobs = {'at': 0.0, 'items': []}


def name_key(value):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', str(value)).encode('ascii', 'ignore').decode().lower())


def _histories_key(sport):
    return 'finder:history:v1:'+sport


def _index_key(sport):
    return 'finder:history:at:v1:'+sport


def _dump(value):
    return json.dumps(value, separators=(',', ':'))


def _pairs(raw):
    raw = raw or []
    return raw.items() if isinstance(raw, dict) else zip(raw[::2], raw[1::2])


def _chunks(items, size=CHUNK):
    items = list(items)
    return [items[i:i+size] for i in range(0, len(items), size)]


def command(*args):
    from v2.board import store
    if not store.configured():
        return None
    return store.pipeline([list(args)], timeout=3)[0]['result']


def commands(*rows):
    """Several commands in one request."""
    from v2.board import store
    if not rows or not store.configured():
        return [None]*len(rows)
    return [item['result'] for item in store.pipeline([list(row) for row in rows], timeout=3)]


def remember(sport, key, payload, args, seen=None):
    # An empty provider response can mean an outage/incomplete season. Keep
    # the last successful sample until its display age limit instead.
    if sport not in SPORTS or not isinstance(payload, dict) or payload.get('error') or payload.get('complete') is False:
        return payload
    if not (payload.get('rows') or payload.get('games')):
        return payload
    now = int(time.time()*1000)
    entry = {'at': now, 'payload': payload, 'args': args}
    stamp = {'at': now, 'seen': int(seen or now), 'args': args}
    try:
        commands(['HSET', _histories_key(sport), key, _dump(entry)],
                 ['HSET', _index_key(sport), key, _dump(stamp)])
    except Exception:
        return payload  # Cache outages never turn a successful provider read into an error.
    with _lock:
        if sport in _index:
            _index[sport][1][key] = stamp
        if sport in _full:
            _full[sport][1][key] = entry
    return payload


def _parse(value):
    try:
        item = json.loads(value)
        int(item['at'])
        return item
    except (ValueError, KeyError, TypeError):
        return None


def _read_histories(sport):
    result = {}
    for key, value in _pairs(command('HGETALL', _histories_key(sport))):
        item = _parse(value)
        if item is not None:
            result[key] = item
    return result


def _read_index(sport):
    result = {}
    for key, value in _pairs(command('HGETALL', _index_key(sport))):
        item = _parse(value)
        if item is not None:
            result[key] = item
    return result


def entries(sport, max_age=MAX_AGE):
    if sport not in SPORTS:
        raise ValueError('Unknown Finder sport')
    try:
        now = time.time()*1000
        return {key: item for key, item in _read_histories(sport).items() if 0 <= now - item['at'] < max_age*1000}
    except Exception:
        return {}


def tidy(sport):
    """Once a day: rebuild the index from the full table and drop players
    nobody has opened for a week. Returns the index, or None when it was
    already done today."""
    marker = 'finder:history:tidy:v1:'+sport
    if command('GET', marker):
        with _lock:
            _tidied[sport] = time.time()
        return None
    histories, index = _read_histories(sport), _read_index(sport)
    now = time.time()*1000
    kept, gone = {}, []
    for key, item in histories.items():
        seen = (index.get(key) or {}).get('seen') or item['at']
        if now - seen < KEEP*1000:
            kept[key] = {'at': item['at'], 'seen': seen, 'args': item.get('args') or {}}
        else:
            gone.append(key)
    orphans = [key for key in index if key not in histories]
    # Only stamps that are missing or behind; never wind a newer one back.
    behind = [(key, stamp) for key, stamp in kept.items() if (index.get(key) or {}).get('at', 0) < stamp['at']]
    rows = [['HDEL', _histories_key(sport), *chunk] for chunk in _chunks(gone)]
    rows += [['HDEL', _index_key(sport), *chunk] for chunk in _chunks(gone+orphans)]
    rows += [['HSET', _index_key(sport), *[part for key, stamp in chunk for part in (key, _dump(stamp))]]
             for chunk in _chunks(behind)]
    commands(*rows, ['SET', marker, '1', 'EX', TIDY_SECONDS])
    result = {key: {**(index.get(key) or {}), **stamp} if (index.get(key) or {}).get('at', 0) < stamp['at'] else index[key]
              for key, stamp in kept.items()}
    with _lock:
        _tidied[sport] = time.time()
        _index[sport] = (time.time(), dict(result))
        if sport in _full:
            for key in gone:
                _full[sport][1].pop(key, None)
    return result


def stamps(sport):
    """{key: {'at', 'seen', 'args'}} for a sport: when each saved history
    was fetched and last opened, without the histories themselves."""
    now = time.time()
    with _lock:
        hit = _index.get(sport)
        last = dict(hit[1]) if hit else {}
        if hit and now - hit[0] < INDEX_MEMORY_SECONDS:
            return last
        due = now - _tidied.get(sport, 0) >= TIDY_SECONDS
    try:
        result = tidy(sport) if due else None
        if result is None:
            result = _read_index(sport)
            with _lock:
                _index[sport] = (now, dict(result))
        return result
    except Exception:
        return last


def _histories(sport):
    """This server's copy of a sport's recent histories. After the first
    read only the players whose history changed are fetched again."""
    now = time.time()
    with _lock:
        hit = _full.get(sport)
        known = dict(hit[1]) if hit else {}
        if hit and now - hit[0] < SNAPSHOT_MEMORY_SECONDS:
            return known
    cutoff = now*1000 - MAX_AGE*1000
    last = dict(known)
    try:
        index = _read_index(sport) if hit else {}
        changed = [key for key, stamp in index.items()
                   if stamp['at'] >= cutoff and (key not in known or known[key]['at'] < stamp['at'])]
        if index and len(changed) <= FULL_READ_AFTER:
            for chunk in _chunks(changed, 100):
                for key, value in zip(chunk, commands(*[['HGET', _histories_key(sport), key] for key in chunk])):
                    item = _parse(value) if value else None
                    if item is not None:
                        known[key] = item
            result = known
        else:
            result = _read_histories(sport)
    except Exception:
        return last
    result = {key: item for key, item in result.items() if item['at'] >= cutoff}
    with _lock:
        _full[sport] = (now, dict(result))
        if index:
            _index[sport] = (now, dict(index))
    return result


def snapshot(sport):
    if sport not in SPORTS:
        raise ValueError('Unknown Finder sport')
    # Leave headroom below the hosting response limit. Unincluded players
    # continue through the normal individual-history path, never disappear.
    now = time.time()*1000
    recent = {key: item for key, item in _histories(sport).items() if 0 <= now - item['at'] < MAX_AGE*1000}
    result = {}; size = 0
    for key, item in sorted(recent.items(), key=lambda pair:pair[1]['at'], reverse=True):
        entry = {'at':item['at'], 'payload':item['payload']}
        weight = len(json.dumps(entry).encode('utf-8')) + len(key) + 8
        if size + weight <= 2_000_000:
            result[key] = entry; size += weight
    return {'histories':result}


def enroll_basketball(sport, board):
    from datetime import datetime, timezone
    year = datetime.now(timezone.utc).year
    fields = {}
    for row in board.get('rows', []):
        player = str(row.get('playerId') or '')
        if player.isdigit():
            key = f'{sport}:{player}:'+('recent' if sport == 'nba' else str(year))
            fields[sport+'|'+key] = json.dumps({'playerId':player,'season':year,'enrolledAt':time.time()})
    with _lock:
        last = _enrolled.get(sport)
        recent = last and set(fields) <= last[1] and time.time() - last[0] < ENROLL_SECONDS
    if fields and not recent:
        try:
            command('HSET', JOBS, *[value for pair in fields.items() for value in pair])
            with _lock:
                _enrolled[sport] = (time.time(), frozenset(fields))
        except Exception:
            pass
    return board


def enrolled():
    """[(sport, key, args)] for board players enrolled in the last two days.
    Older enrollments are deleted as they are found."""
    now = time.time()
    with _lock:
        if now - _jobs['at'] < INDEX_MEMORY_SECONDS:
            return list(_jobs['items'])
    items, expired = [], []
    try:
        for field, value in _pairs(command('HGETALL', JOBS)):
            try:
                sport, key = field.split('|', 1)
                args = json.loads(value)
                if sport in SPORTS and now - args.get('enrolledAt', 0) < 2*86400:
                    items.append((sport, key, args))
                    continue
            except (ValueError, AttributeError, TypeError):
                pass
            expired.append(field)
        if expired:
            commands(*[['HDEL', JOBS, *chunk] for chunk in _chunks(expired)])
    except Exception:
        return items
    with _lock:
        _jobs.update(at=now, items=list(items))
    return items


def refresh(sport, key, args, seen=None):
    if sport in ('wnba', 'nba'):
        from api.wnba import _history, _game_logs
        payload = {'rows': _history(args['playerId'], sport, args.get('season'))} if sport == 'nba' else _game_logs(args['playerId'], args['season'])
    elif sport == 'mlb':
        from live_props_core import player_history
        payload = player_history(args['player'], args['group'], first_inning_stats=args.get('innings', False))
    elif sport == 'soccer':
        from soccer_research import team_log
        payload = team_log(args['team'], args['event'], args.get('league') or None)
    elif sport == 'nhl':
        from nhl_research import team_log
        payload = team_log(args['team'], args.get('opponent') or None)
    elif sport == 'cfb':
        from cfb_research import team_log
        payload = team_log(args['team'], args.get('opponent') or None)
    else:
        from tennis_history import history
        payload = history(args['player'])
    return remember(sport, key, payload, args, seen=seen)


def _still_due(candidates):
    """Re-check the few chosen players against storage, so a history another
    server just refreshed is not fetched twice."""
    try:
        values = commands(*[['HGET', _index_key(sport), key] for _, sport, key, _ in candidates])
    except Exception:
        return candidates
    due, now = [], time.time()*1000
    for job, value in zip(candidates, values):
        stamp = _parse(value) if value else None
        if stamp is None or now - stamp['at'] >= FRESH*1000:
            due.append(job)
        else:
            with _lock:
                if job[1] in _index:
                    _index[job[1]][1][job[2]] = stamp
    return due


def warm(budget=8, limit=8):
    """Bounded work on the existing automatic timer, oldest histories first.

    Existing provider caches and tennis's quota gate stay authoritative.
    """
    from concurrent.futures import ThreadPoolExecutor, wait
    reader = ThreadPoolExecutor(max_workers=6)
    reads = {sport:reader.submit(stamps, sport) for sport in SPORTS}
    wait(reads.values(), timeout=3.2)
    saved = {sport:future.result() if future.done() else {} for sport,future in reads.items()}
    reader.shutdown(wait=False, cancel_futures=True)
    now = time.time()*1000
    listed = {}
    for sport, key, args in enrolled():
        listed[(sport, key)] = args
    jobs = []
    for sport in SPORTS:
        for key, item in saved[sport].items():
            # A player still listed on a board counts as opened.
            seen = max(item.get('seen') or item['at'], (listed.get((sport, key)) or {}).get('enrolledAt', 0)*1000)
            if now - item['at'] >= FRESH*1000 and now - seen < KEEP*1000:
                jobs.append((item['at'], sport, key, {'args': item.get('args') or {}, 'seen': seen}))
    for (sport, key), args in listed.items():
        if key not in saved[sport]:
            jobs.append((0, sport, key, {'args': args, 'seen': args.get('enrolledAt', 0)*1000}))
    jobs.sort(key=lambda job: job[0])
    chosen = _still_due(jobs[:limit*2])[:limit] if jobs else []
    pool = ThreadPoolExecutor(max_workers=2)
    futures = [pool.submit(refresh, sport, key, item['args'], item['seen']) for _, sport, key, item in chosen]
    done, pending = wait(futures, timeout=max(0, budget)) if futures else (set(), set())
    pool.shutdown(wait=False, cancel_futures=True)
    return {'completed': sum(f.exception() is None for f in done), 'remaining': len(jobs)-len(done)}
