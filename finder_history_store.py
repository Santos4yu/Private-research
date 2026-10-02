"""Shared, provider-sourced Finder histories. Atomic per-player writes.

Snapshots never contain prices: each current line is graded against the raw
history by the existing frontend. Failed/partial reads cannot erase good data.
"""
import json
import time
import unicodedata
import re

SPORTS = ('wnba', 'nba', 'mlb', 'soccer', 'nhl', 'tennis')
MAX_AGE = 24 * 3600
FRESH = 30 * 60

def name_key(value):
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', str(value)).encode('ascii', 'ignore').decode().lower())

def command(*args):
    from v2.board import store
    if not store.configured():
        return None
    return store.pipeline([list(args)], timeout=3)[0]['result']

def remember(sport, key, payload, args):
    # An empty provider response can mean an outage/incomplete season. Keep
    # the last successful sample until its display age limit instead.
    if sport not in SPORTS or not isinstance(payload, dict) or payload.get('error') or payload.get('complete') is False:
        return payload
    if not (payload.get('rows') or payload.get('games')):
        return payload
    try:
        entry = {'at': int(time.time()*1000), 'payload': payload, 'args': args}
        command('HSET', 'finder:history:v1:'+sport, key, json.dumps(entry, separators=(',', ':')))
    except Exception:
        pass  # Cache outages never turn a successful provider read into an error.
    return payload

def entries(sport, max_age=MAX_AGE):
    if sport not in SPORTS:
        raise ValueError('Unknown Finder sport')
    try:
        raw = command('HGETALL', 'finder:history:v1:'+sport) or []
        pairs = raw.items() if isinstance(raw, dict) else zip(raw[::2], raw[1::2])
        result = {}
        for key, value in pairs:
            try:
                item = json.loads(value)
                if 0 <= time.time()*1000 - item['at'] < max_age*1000:
                    result[key] = item
            except (ValueError, KeyError, TypeError):
                continue
        return result
    except Exception:
        return {}

def snapshot(sport):
    # Leave headroom below the hosting response limit. Unincluded players
    # continue through the normal individual-history path, never disappear.
    result = {}; size = 0
    for key, item in sorted(entries(sport).items(), key=lambda pair:pair[1]['at'], reverse=True):
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
    if fields:
        try:
            command('HSET', 'finder:history:jobs:v1', *[value for pair in fields.items() for value in pair])
        except Exception:
            pass
    return board

def refresh(sport, key, args):
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
    else:
        from tennis_history import history
        payload = history(args['player'])
    return remember(sport, key, payload, args)

def warm(budget=8, limit=8):
    """Bounded work on the existing automatic timer, oldest histories first.

    Existing provider caches and tennis's quota gate stay authoritative.
    """
    from concurrent.futures import ThreadPoolExecutor, wait
    reader = ThreadPoolExecutor(max_workers=6)
    reads = {sport:reader.submit(entries, sport, 7*86400) for sport in SPORTS}
    wait(reads.values(), timeout=3.2)
    saved = {sport:future.result() if future.done() else {} for sport,future in reads.items()}
    reader.shutdown(wait=False, cancel_futures=True)
    jobs = [(item['at'], sport, key, item['args']) for sport in SPORTS
            for key, item in saved[sport].items() if time.time()*1000-item['at'] >= FRESH*1000]
    try:
        raw = command('HGETALL', 'finder:history:jobs:v1') or []
        pairs = raw.items() if isinstance(raw, dict) else zip(raw[::2], raw[1::2])
        for field, args in pairs:
            sport, key = field.split('|', 1)
            args = json.loads(args)
            if sport in SPORTS and key not in saved[sport] and time.time()-args.get('enrolledAt',0)<2*86400:
                jobs.append((0, sport, key, args))
    except Exception:
        pass
    jobs.sort(key=lambda job: job[0])
    pool = ThreadPoolExecutor(max_workers=2)
    futures = [pool.submit(refresh, sport, key, args) for _, sport, key, args in jobs[:limit]]
    done, pending = wait(futures, timeout=max(0, budget)) if futures else (set(), set())
    pool.shutdown(wait=False, cancel_futures=True)
    return {'completed': sum(f.exception() is None for f in done), 'remaining': len(jobs)-len(done)}
