"""Phase 0 of the NBA prop model work (Nov 18; the owner approved Phase 0
only): reliable pregame data, each piece kept with the time it was known,
so the production model can be measured. Nothing here changes a
projection, a grade, a confidence score or a recommendation.

Four records in KV under PREFIX, filed by US game day (props_record.day_of):

1. lines -- every NBA PrizePicks line (standard, Goblin, Demon), as the feed
   showed it. line_moves.observe_prizepicks hands each fresh feed here
   (observe_lines); an event is written only when a line first appears, moves
   to another number, or is taken down before its game. Identical snapshots
   are never written twice.
2. reports -- each team's ESPN injury report, its projected starters (the
   newest depth chart read before tip, depth.py) and, if ESPN lists them
   before tip, its confirmed starters. Checked every CHECK_SECONDS on the
   line-check timer (tick) from the game summaries the site already keeps
   for ten minutes (backend/sports/wnba/matchup.py), so this adds no calls
   to ESPN beyond its usual refresh; a version is written only when it
   changed.
3. runs -- the production grades. A GitHub Actions job runs the site's own
   grading code (tools/prop-snapshot/run.mjs) on the data members get and
   posts every line's Over and Under grade, projection, DraftKings price,
   lineup read and the inputs' times (accept_run). `last:{day}` keeps each
   line's newest pregame grade with a trail of its changes; each run's full
   rows stay RUN_KEEP_SECONDS.
4. health -- anything missing, stale or failed (a report ESPN didn't publish,
   one older than STALE_REPORT_SECONDS before a game, a graded run that
   didn't arrive, the job's own problems), so none of it is counted as
   valid by accident. prop_eval.py reads all four.
"""
from __future__ import annotations

import base64
import hashlib
import json
import math
import os
import time
import zlib
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from uuid import uuid4

PREFIX = 'krazy:propsnap:v1:nba'
KEEP_SECONDS = 270 * 86400
# Each run's full rows (the inputs as read, every line's grade): a few days,
# for checking a run; each line's changes stay in `last` (KEEP_SECONDS).
RUN_KEEP_SECONDS = 3 * 86400
# The reports are checked this often (the timer ticks every ~90 seconds).
CHECK_SECONDS = 10 * 60
# Games starting within this are checked.
WINDOW_SECONDS = 14 * 3600
# An ESPN report read longer ago than this, with its game still to come, is stale.
STALE_REPORT_SECONDS = 30 * 60
# The game summaries are waited on this long at most (the timer has a minute in all).
REPORT_WAIT = 15
# With a game this close and no graded run for RUN_GAP_SECONDS, the run is missing.
RUN_AHEAD_SECONDS = 150 * 60
RUN_GAP_SECONDS = 80 * 60
# A feed missing more than this share of its lines at once is incomplete, not lines taken down.
PULL_SHARE = 0.3
# A line gone this close to its start is its game starting, not a pull.
PULL_BEFORE_START = 10 * 60
HEALTH_KEEP = 500
# A full NBA night lists over 3,000 lines (Goblins and Demons included).
MAX_ROWS = 8000
MAX_BODY = 3_500_000
TRAIL_KEEP = 16
MODIFIERS = ('standard', 'goblin', 'demon')
TIERS = ('elite', 'strong', 'lean', 'risky', 'fade')
# The props the list grades (props_record.MARKETS).
MARKETS = ('player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_steals', 'player_blocks',
           'player_points_rebounds', 'player_points_assists', 'player_points_rebounds_assists')

_lines = {'fp': None, 'days': {}}


# ---------------------------------------------------------------- helpers

def enabled():
    """Only the deployed site writes (or a process that asks with
    PROP_SNAPSHOTS=1): a test run never reaches the real records."""
    from v2.board import store
    return store.configured() and any(os.getenv(name) for name in ('VERCEL', 'AWS_LAMBDA_FUNCTION_NAME', 'PROP_SNAPSHOTS'))


def _pipeline(commands, timeout=6):
    from v2.board import store
    try:
        return [entry.get('result') for entry in store.pipeline(commands, timeout=timeout)]
    except Exception:  # noqa: BLE001 -- storage down: nothing written, the caller says so
        return None


def pack(value) -> str:
    return base64.b64encode(zlib.compress(json.dumps(value, separators=(',', ':')).encode(), 6)).decode()


def unpack(text):
    try:
        return json.loads(zlib.decompress(base64.b64decode(text)))
    except Exception:  # noqa: BLE001 -- a damaged copy is no copy
        return None


def _dump(value) -> str:
    return json.dumps(value, separators=(',', ':'))


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _epoch(value):
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    try:
        moment = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return (moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)).timestamp()


def day_of(start: float) -> str:
    """The US game day of a start (props_record.day_of: start less six hours)."""
    return datetime.fromtimestamp(start - 6 * 3600, timezone.utc).date().isoformat()


def key(*parts) -> str:
    return ':'.join([PREFIX, *[str(part) for part in parts]])


def _pairs(flat):
    flat = flat or []
    if isinstance(flat, dict):
        return list(flat.items())
    return list(zip(flat[0::2], flat[1::2]))


def _digest(value) -> str:
    return hashlib.sha1(_dump(value).encode()).hexdigest()[:12]


# ---------------------------------------------------------------- health

def note(level: str, kind: str, text: str, *, once: str | None = None, every: int = 3600, now=None, pipeline=None):
    """Log a problem (newest first). With `once`, the same problem is logged
    at most once every `every` seconds."""
    pipeline = pipeline or _pipeline
    now = time.time() if now is None else now
    entry = _dump({'at': int(now), 'level': level, 'kind': kind, 'text': str(text)[:300]})
    commands = []
    if once:
        commands.append(['SET', key('once', kind, once), '1', 'NX', 'EX', int(every)])
    commands += [['LPUSH', key('health'), entry], ['LTRIM', key('health'), 0, HEALTH_KEEP - 1]]
    if once:
        # Only when the claim is new: the claim and the push go separately.
        reply = pipeline(commands[:1])
        if not reply or reply[0] != 'OK':
            return False
        commands = commands[1:]
    return pipeline(commands) is not None


def _status(name: str, value: dict, pipeline):
    pipeline([['HSET', key('status'), name, _dump(value)]])


# ---------------------------------------------------------------- 1. lines

def _line_state(value):
    """lstate's 'line|start' (line 'x' once taken down) as (line or None, start)."""
    try:
        line, start = str(value).split('|', 1)
        return (None if line == 'x' else float(line)), float(start)
    except (TypeError, ValueError):
        return None, 0.0


def observe_lines(rows, fetched_at=None, pipeline=None, memory=None):
    """A fresh NBA PrizePicks feed (prizepicks_export_core rows). Writes an
    event [time, projection id, line] for each line that is new or moved,
    and [time, id, null] for one taken down before its game; nothing when
    the feed is the same as the last one seen. Returns the events written."""
    pipeline = pipeline or _pipeline
    memory = _lines if memory is None else memory
    fetched_at = float(fetched_at or time.time())
    entries, meta = {}, {}
    for row in rows or []:
        if not isinstance(row, dict) or row.get('combo') or row.get('flash'):
            continue
        pp, line, start = str(row.get('id') or ''), _number(row.get('line')), _epoch(row.get('start_time'))
        if not pp or line is None or not start or start <= fetched_at:
            continue
        entries[pp] = (line, start)
        meta[pp] = [str(row.get('player') or '')[:60], str(row.get('player_id') or '')[:20], str(row.get('team') or '')[:6],
                    str(row.get('description') or '')[:12], str(row.get('stat') or '')[:40],
                    str(row.get('odds_type') or 'standard')[:10], int(start)]
    if not entries:
        return 0
    fingerprint = _digest(sorted((pp, line) for pp, (line, _) in entries.items()))
    if memory.get('fp') == fingerprint:
        return 0
    by_day = defaultdict(dict)
    for pp, value in entries.items():
        by_day[day_of(value[1])][pp] = value
    days = sorted(by_day)
    unknown = [day for day in days if day not in memory['days']]
    if unknown:
        replies = pipeline([['HGETALL', key('lstate', day)] for day in unknown])
        if replies is None:
            return 0
        for day, flat in zip(unknown, replies):
            memory['days'][day] = {pp: _line_state(value) for pp, value in _pairs(flat)}
    commands, written, updates = [], 0, {}
    stamp = int(fetched_at)
    for day in days:
        state, seen = memory['days'][day], by_day[day]
        events, fields, fresh = [], {}, []
        for pp, (line, start) in seen.items():
            before = state.get(pp)
            if before is None or before[0] != line:
                events.append([stamp, pp, line])
                fields[pp] = (line, start)
                if before is None:
                    fresh.append(pp)
        live = [pp for pp, (line, _) in state.items() if line is not None]
        gone = [pp for pp in live if pp not in seen]
        # A feed missing a large share at once is incomplete: nothing is called taken down.
        if gone and len(gone) <= PULL_SHARE * len(live):
            for pp in gone:
                start = state[pp][1]
                if start - fetched_at > PULL_BEFORE_START:
                    events.append([stamp, pp, None])
                fields[pp] = (None, start)
        if not events and not fields:
            continue
        if events:
            commands.append(['LPUSH', key('lines', day), *[_dump(event) for event in events]])
            commands.append(['EXPIRE', key('lines', day), KEEP_SECONDS])
        if fields:
            commands.append(['HSET', key('lstate', day), *[part for pp, (line, start) in fields.items()
                                                          for part in (pp, f"{'x' if line is None else format(line, 'g')}|{int(start)}")]])
            commands.append(['EXPIRE', key('lstate', day), KEEP_SECONDS])
        if fresh:
            commands.append(['HSET', key('lmeta', day), *[part for pp in fresh for part in (pp, _dump(meta[pp]))]])
            commands.append(['EXPIRE', key('lmeta', day), KEEP_SECONDS])
        updates[day] = fields
        written += len(events)
    if commands and pipeline(commands) is None:
        note('error', 'storage', 'Storage did not keep the PrizePicks line feed', once='line-write',
             every=1800, now=fetched_at, pipeline=pipeline)
        return 0
    for day, fields in updates.items():
        memory['days'][day].update(fields)
    # Only today's and later days stay in memory.
    for day in [day for day in memory['days'] if day < day_of(fetched_at) and day not in days]:
        memory['days'].pop(day, None)
    memory['fp'] = fingerprint
    if written:
        _status('lines', {'at': stamp, 'events': written, 'lines': len(entries)}, pipeline)
    return written


def line_history(day: str, pipeline=None) -> dict:
    """{projection id: {meta: [player, pp player id, team, opponent, stat,
    type, start], moves: [[time, line or None], ...]}} for one day, repeated
    events (two servers seeing one change) folded."""
    pipeline = pipeline or _pipeline
    replies = pipeline([['LRANGE', key('lines', day), 0, -1], ['HGETALL', key('lmeta', day)]]) or [[], []]
    meta = {}
    for pp, value in _pairs(replies[1]):
        try:
            meta[pp] = json.loads(value)
        except (TypeError, ValueError):
            continue
    out = {}
    events = []
    for raw in replies[0] or []:
        try:
            at, pp, line = json.loads(raw)
        except (TypeError, ValueError):
            continue
        events.append((at, pp, line))
    for at, pp, line in sorted(events, key=lambda event: event[0]):
        entry = out.setdefault(pp, {'meta': meta.get(pp), 'moves': []})
        if not entry['moves'] or entry['moves'][-1][1] != line:
            entry['moves'].append([at, line])
    return out


def closing_lines(day: str, pipeline=None) -> dict:
    """(player name, stat, type) -> the last line PrizePicks showed before
    the game (None when taken down), from line_history."""
    out = {}
    for pp, entry in line_history(day, pipeline).items():
        meta = entry.get('meta') or []
        if len(meta) < 7 or not entry['moves']:
            continue
        before = [move for move in entry['moves'] if move[0] < meta[6]]
        if before:
            out[(meta[0], meta[4], meta[5])] = before[-1][1]
    return out


# ---------------------------------------------------------------- 2. reports

def _games(now, fetch=None):
    """ESPN's NBA games on today's and tomorrow's US dates: [{id, start,
    state, home, away}]."""
    if fetch is None:
        from backend.sports.wnba.league import espn

        def fetch(day):
            return espn('/scoreboard', {'dates': day}, timeout=10, league='nba')
    east = datetime.fromtimestamp(now, timezone.utc) - timedelta(hours=5)
    games = []
    for offset in (0, 1):
        day = (east + timedelta(days=offset)).strftime('%Y%m%d')
        try:
            data = fetch(day) or {}
        except Exception as error:  # noqa: BLE001 -- that day's games stay unknown, and say so
            games.append({'error': f'{day}: {type(error).__name__}'})
            continue
        for event in data.get('events') or []:
            competition = (event.get('competitions') or [{}])[0]
            sides = {item.get('homeAway'): (item.get('team') or {}).get('abbreviation') for item in competition.get('competitors') or []}
            start = _epoch(event.get('date'))
            if start and sides.get('home') and sides.get('away'):
                games.append({'id': str(event.get('id')), 'start': start, 'home': sides['home'], 'away': sides['away'],
                              'state': ((event.get('status') or {}).get('type') or {}).get('state') or 'pre'})
    return games


def _injury_rows(listed):
    rows = []
    for item in listed or []:
        rows.append([str(item.get('id') or ''), str(item.get('name') or '')[:60], str(item.get('status') or '')[:30],
                     str(item.get('code') or '')[:8], str(item.get('date') or '')[:25], str(item.get('injury') or '')[:40],
                     str(item.get('detail') or '')[:40], str(item.get('returnDate') or '')[:25], str(item.get('comment') or '')[:200]])
    return sorted(rows)


def check_reports(games, now, pipeline=None, report_of=None, depth_index=None):
    """Each game still to come within WINDOW_SECONDS: both teams' injury
    reports and their projected and (if ESPN lists them) confirmed starters,
    written when changed. Returns counts."""
    pipeline = pipeline or _pipeline
    if report_of is None:
        from backend.sports.wnba import matchup as game_reports

        def report_of(event_id):
            return game_reports.matchup(event_id, 'nba')
    upcoming = [game for game in games if 'id' in game and game['state'] == 'pre' and now < game['start'] <= now + WINDOW_SECONDS]
    found = {'games': len(upcoming), 'teams': 0, 'changed': 0, 'stale': 0, 'missing': 0, 'failed': 0, 'confirmed': 0}
    if not upcoming:
        return found
    state_fields = [f'{kind}|{team}|{game["id"]}' for game in upcoming for team in (game['away'], game['home'])
                    for kind in ('inj', 'proj', 'conf')]
    replies = pipeline([['HGETALL', key('rstate')]])
    if replies is None:
        note('error', 'storage', 'Storage did not answer the report check', once='report-check', every=1800, now=now, pipeline=pipeline)
        return found
    before = {}
    stored = dict(_pairs(replies[0]))
    for field in state_fields:
        value = stored.get(field)
        try:
            before[field] = json.loads(value) if value else None
        except (TypeError, ValueError):
            before[field] = None
    events, fields = defaultdict(list), {}

    def keep(kind, team, game, value, fetched, extra=None):
        field = f'{kind}|{team}|{game["id"]}'
        digest = _digest(value)
        old = before.get(field)
        if not old or old[0] != digest:
            events[day_of(game['start'])].append(_dump({'k': kind, 't': team, 'e': game['id'], 'at': int(now), 'f': fetched,
                                                         'tip': int(game['start']), 'h': digest, 'v': value, **(extra or {})}))
            found['changed'] += 1
            fields[field] = _dump([digest, int(now), int(now), fetched])
        else:
            fields[field] = _dump([old[0], old[1], int(now), fetched])

    # The game summaries, side by side, for at most REPORT_WAIT seconds:
    # mostly the copies the site already keeps, so quick.
    from concurrent.futures import ThreadPoolExecutor, wait
    pool = ThreadPoolExecutor(max_workers=6)
    futures = {game['id']: pool.submit(report_of, game['id']) for game in upcoming}
    wait(list(futures.values()), timeout=REPORT_WAIT)
    pool.shutdown(wait=False)
    for game in upcoming:
        tip_minute = int(game['start'] // 60)
        future = futures[game['id']]
        try:
            if not future.done():
                raise TimeoutError('no answer in time')
            report = future.result() or {}
        except Exception as error:  # noqa: BLE001
            found['failed'] += 1
            note('warn', 'report-failed', f'ESPN report for {game["away"]} @ {game["home"]} could not be read ({type(error).__name__})',
                 once=f'fail:{game["id"]}', every=3600, now=now, pipeline=pipeline)
            continue
        fetched = _epoch(report.get('fetchedAt'))
        if (report.get('status') or {}).get('state') not in (None, 'pre') or (fetched and fetched >= game['start']):
            found['missing'] += 1
            continue
        injuries = report.get('injuries') or {}
        stale = fetched is None or now - fetched > STALE_REPORT_SECONDS
        if stale:
            found['stale'] += 1
            note('warn', 'report-stale', f'Injury report for {game["away"]} @ {game["home"]} was last read '
                 f'{"at an unknown time" if fetched is None else f"{int((now - fetched) // 60)} minutes ago"}',
                 once=f'stale:{game["id"]}', every=3600, now=now, pipeline=pipeline)
        if not injuries:
            # Nobody listed on either side can't be told from a report not published.
            found['missing'] += 1
            note('warn', 'report-missing', f'ESPN lists no injury report for either team in {game["away"]} @ {game["home"]}',
                 once=f'missing:{game["id"]}', every=4 * 3600, now=now, pipeline=pipeline)
        starters = report.get('starters') or {}
        for team in (game['away'], game['home']):
            found['teams'] += 1
            if injuries:
                keep('inj', team, game, _injury_rows(injuries.get(team)), int(fetched) if fetched else None, {'stale': 1} if stale else None)
            if depth_index is not None:
                digest, read, status = depth_index.chart_before(team, tip_minute)
                chart = (depth_index.charts.get(digest) or {}) if digest else {}
                value = {slot: (chart.get(slot) or [None])[0] for slot in ('pg', 'sg', 'sf', 'pf', 'c')} if chart else None
                keep('proj', team, game, {'starters': value, 'status': status}, int(read * 60) if read else None, {'src': 'espn depth chart'})
                if status != 'ok':
                    note('warn', 'depth-stale', f'No current depth chart for {team} before tonight ({status})',
                         once=f'depth:{team}:{day_of(game["start"])}', every=12 * 3600, now=now, pipeline=pipeline)
            listed = starters.get(team)
            if isinstance(listed, list) and len(listed) == 5:
                found['confirmed'] += 1
                keep('conf', team, game, sorted(str(item) for item in listed), int(fetched) if fetched else None, {'src': 'espn before tip'})
    commands = []
    for day, items in events.items():
        commands += [['LPUSH', key('reports', day), *items], ['EXPIRE', key('reports', day), KEEP_SECONDS]]
    if fields:
        commands += [['HSET', key('rstate'), *[part for item in fields.items() for part in item]], ['EXPIRE', key('rstate'), 4 * 86400]]
    if commands and pipeline(commands) is None:
        note('error', 'storage', 'Storage did not keep the report check', once='report-write', every=1800, now=now, pipeline=pipeline)
    return found


def reports_on(day: str, pipeline=None) -> list:
    """The day's report events, oldest first."""
    pipeline = pipeline or _pipeline
    reply = pipeline([['LRANGE', key('reports', day), 0, -1]]) or [[]]
    out = []
    for raw in reply[0] or []:
        try:
            out.append(json.loads(raw))
        except (TypeError, ValueError):
            continue
    return sorted(out, key=lambda event: event['at'])


def watch_runs(games, now, pipeline=None):
    """A graded run is due while a game is close: say so when it is missing."""
    pipeline = pipeline or _pipeline
    soon = [game for game in games if 'id' in game and game['state'] == 'pre' and now < game['start'] <= now + RUN_AHEAD_SECONDS]
    if not soon:
        return {'due': False}
    reply = pipeline([['HGET', key('status'), 'run']]) or [None]
    try:
        last = json.loads(reply[0]) if reply[0] else None
    except (TypeError, ValueError):
        last = None
    at = float((last or {}).get('at') or 0)
    if now - at > RUN_GAP_SECONDS:
        ago = 'no graded run yet' if not at else f'the last graded run was {int((now - at) // 60)} minutes ago'
        note('error', 'run-missing', f'{len(soon)} game{"s" if len(soon) != 1 else ""} start within '
             f'{RUN_AHEAD_SECONDS // 60} minutes and {ago}', once='run-missing', every=3600, now=now, pipeline=pipeline)
        return {'due': True, 'missing': True, 'lastRun': at or None}
    return {'due': True, 'missing': False, 'lastRun': at}


def tick(now=None, pipeline=None, games_of=None, report_of=None, depth_index=None):
    """The line-check timer's turn (every ~90 seconds): once every
    CHECK_SECONDS across all servers, the reports and the runs' watch."""
    pipeline = pipeline or _pipeline
    now = time.time() if now is None else now
    claim = pipeline([['SET', key('claim'), '1', 'NX', 'EX', CHECK_SECONDS - 30]])
    if not claim or claim[0] != 'OK':
        return {'waiting': True}
    games = (games_of or _games)(now)
    for item in games:
        if 'error' in item:
            note('warn', 'schedule-failed', f'ESPN schedule could not be read ({item["error"]})', once='schedule', every=3600, now=now, pipeline=pipeline)
    if depth_index is None:
        try:
            from backend.sports.wnba import depth, league
            depth_index = depth.index_for(league.current_season(league='nba'))
        except Exception:  # noqa: BLE001 -- projected starters wait for the store
            depth_index = None
    found = check_reports(games, now, pipeline, report_of=report_of, depth_index=depth_index)
    runs = watch_runs(games, now, pipeline)
    _status('reports', {'at': int(now), **found}, pipeline)
    return {'reports': found, 'runs': runs}


# ---------------------------------------------------------------- 3. graded runs

def _clean_side(value):
    """A side's grade: [chance, raw chance, chance before the matchup and
    calibration, tier, capped tier, needs, book chance, hit-rate chance,
    model chance, model weight, backed]."""
    if not isinstance(value, list) or len(value) < 6:
        return None
    out = []
    for index, item in enumerate(value[:11]):
        if index in (3, 4):
            out.append(item if item in TIERS else None)
        elif index == 10:
            out.append(1 if item else 0)
        else:
            number = _number(item)
            out.append(None if number is None else round(number, 4))
    chance = out[0]
    return out if chance is not None and 0 < chance < 1 else None


def _clean_row(row):
    """One graded line as the job sends it, checked; None when unusable."""
    if not isinstance(row, dict):
        return None
    pid, market, line, modifier = str(row.get('pid') or ''), row.get('mk'), _number(row.get('ln')), row.get('md') or 'standard'
    start = _epoch(row.get('st'))
    if not pid.isdigit() or market not in MARKETS or line is None or modifier not in MODIFIERS or not start:
        return None
    over = _clean_side(row.get('o'))
    under = _clean_side(row.get('u')) if modifier == 'standard' else None
    if over is None and under is None:
        return None

    def numbers(value, size, digits=4):
        if not isinstance(value, list):
            return None
        out = [None if _number(item) is None else round(_number(item), digits) for item in value[:size]]
        return out if any(item is not None for item in out) else None
    lineup = row.get('ro') if isinstance(row.get('ro'), list) else None
    return {'pid': pid, 'pl': str(row.get('pl') or '')[:60], 'tm': str(row.get('tm') or '')[:6], 'op': str(row.get('op') or '')[:6],
            'mk': market, 'ln': line, 'md': modifier, 'st': int(start), 'event': str(row.get('event') or '')[:24] or None, 'pp': str(row.get('pp') or '')[:24],
            'sc': None if _number(row.get('sc')) is None else round(_number(row.get('sc'))),
            'o': over, 'u': under,
            'pj': None if _number(row.get('pj')) is None else round(_number(row.get('pj')), 3),
            # The prop model: [expected minutes, rate a minute, recent minutes, games, prior rate, weight].
            'm': numbers(row.get('m'), 6),
            # DraftKings: [chance over at this line, its line, over price, under price, moved 1/0].
            'dk': numbers(row.get('dk'), 5),
            # Lineup (lineup-role.js): [starter 1/0, sat last game 1/0, starts, games].
            'ro': [None if item is None else int(_number(item) or 0) for item in lineup[:4]] if lineup else None,
            # His own report status tonight and ESPN's code, as the grade read it.
            'ns': [str(item or '')[:30] for item in row.get('ns')[:2]] if isinstance(row.get('ns'), list) else None,
            # Newest game in his log the grade read (ISO day) and how many games.
            'lg': str(row.get('lg') or '')[:10] or None, 'gn': None if _number(row.get('gn')) is None else int(_number(row.get('gn')))}


def row_key(row) -> str:
    return f"{row['pid']}|{row['mk']}|{format(row['ln'], 'g')}|{row['md']}"


def _material(row) -> list:
    """What makes two snapshots of a line different (not when they were taken)."""
    return [row['ln'], row['o'], row['u'], row['pj'], row['m'], row['dk'], row['ro'], row['ns'], row['sc'], row['lg']]


def accept_run(body, now=None, pipeline=None, site_sha=None):
    """The graded run posted by the snapshot job. Keeps each line whose game
    hasn't started: the run's full rows (RUN_KEEP_SECONDS), its inputs, and
    each line's newest grade with a trail of changes (`last`)."""
    pipeline = pipeline or _pipeline
    now = time.time() if now is None else now
    if not isinstance(body, dict) or not isinstance(body.get('rows'), list):
        return {'error': 'A graded run is required.'}
    rows, rejected, late = [], 0, 0
    # Lines past MAX_ROWS are counted as rejected, never dropped silently.
    rejected += max(0, len(body['rows']) - MAX_ROWS)
    for raw in body['rows'][:MAX_ROWS]:
        row = _clean_row(raw)
        if row is None:
            rejected += 1
        elif row['st'] <= now:
            late += 1
        else:
            rows.append(row)
    run_id = int(now)
    sha, model = str(body.get('sha') or '')[:40], body.get('model') if isinstance(body.get('model'), dict) else {}
    # The inputs' times and counts (small, in the runs list) and the inputs
    # themselves as the grades read them (tonight's injury reports, the
    # calibration's version: in the run's own record).
    data = {name: value for name, value in (body.get('data') or {}).items()
            if isinstance(name, str) and (value is None or isinstance(value, (str, int, float)))} if isinstance(body.get('data'), dict) else {}
    inputs = body.get('inputs') if isinstance(body.get('inputs'), dict) else {}
    problems = [str(item)[:300] for item in (body.get('problems') or []) if item][:40]
    meta = {'id': run_id, 'at': run_id, 'started': _epoch(body.get('startedAt')), 'sha': sha, 'siteSha': (site_sha or '')[:40],
            'model': {name: str(value)[:80] for name, value in model.items() if isinstance(value, (str, int, float))},
            'data': data, 'rows': len(rows), 'late': late, 'rejected': rejected, 'problems': problems}
    by_day = defaultdict(list)
    for row in rows:
        by_day[day_of(row['st'])].append(row)
    if not rows:
        # Nothing to keep: a failed run, or every game already started. Its
        # problems are logged; the watch still counts the run as missing.
        _status('attempt', {'at': run_id, 'late': late, 'rejected': rejected, 'sha': sha, 'problems': len(problems)}, pipeline)
        for problem in problems or ['A graded run arrived with no line still to be played']:
            note('warn' if late and not problems else 'error', 'run-problem', problem, once=f'problem:{_digest(problem)}',
                 every=6 * 3600, now=now, pipeline=pipeline)
        return {'kept': 0, 'late': late, 'rejected': rejected, 'days': [], 'run': None}
    for day, day_rows in by_day.items():
        commands = [['SET', key('run', day, run_id), pack({'meta': meta, 'inputs': inputs, 'rows': day_rows}), 'EX', RUN_KEEP_SECONDS],
                    ['LPUSH', key('runs', day), _dump({**meta, 'rows': len(day_rows)})], ['EXPIRE', key('runs', day), KEEP_SECONDS]]
        if not _merge_last(day, day_rows, run_id, now, pipeline, commands):
            note('error', 'storage', f'Storage did not keep the graded run for {day}', once=f'run-write:{day}', every=1800, now=now, pipeline=pipeline)
            return {'error': 'Storage unavailable.'}
    _status('run', {'at': run_id, 'rows': len(rows), 'late': late, 'rejected': rejected, 'sha': sha, 'model': meta['model'].get('hash'),
                    'problems': len(problems), 'days': sorted(by_day)}, pipeline)
    for problem in problems:
        note('warn', 'run-problem', problem, once=f'problem:{_digest(problem)}', every=6 * 3600, now=now, pipeline=pipeline)
    if rejected:
        note('warn', 'run-rejected', f'{rejected} graded lines in the run were not usable', once='rejected', every=6 * 3600, now=now, pipeline=pipeline)
    if site_sha and sha and site_sha[:12] != sha[:12]:
        note('warn', 'version', f'The snapshot job ran code {sha[:7]} while the site runs {site_sha[:7]}', once=f'sha:{sha[:12]}',
             every=6 * 3600, now=now, pipeline=pipeline)
    return {'kept': len(rows), 'late': late, 'rejected': rejected, 'days': sorted(by_day), 'run': run_id}


def _merge_last(day, rows, run_id, now, pipeline, archive):
    """`last:{day}`: line key -> {f: first seen with this content, l: last
    seen, r: run, row, tr: trail of [time, line, over chance, under chance,
    over tier, projection]} -- a change only when the content changed."""
    lock = key('lock', 'last', day)
    owner = uuid4().hex
    for _ in range(10):
        reply = pipeline([['SET', lock, owner, 'NX', 'EX', 30]])
        if reply and reply[0] == 'OK':
            break
        time.sleep(0.5)
    else:
        note('warn', 'storage', f'The latest grades for {day} were busy; the run could not be saved', once=f'lock:{day}', every=1800,
             now=now, pipeline=pipeline)
        return False
    try:
        reply = pipeline([['GET', key('last', day)]])
        if not reply:
            return False
        kept = unpack(reply[0]) if reply[0] is not None else {}
        if not isinstance(kept, dict):
            return False
        for row in rows:
            field = row_key(row)
            digest = _digest(_material(row))
            entry = kept.get(field)
            if entry and entry.get('l', 0) > run_id:
                continue
            point = [run_id, row['ln'], row['o'][0] if row['o'] else None, row['u'][0] if row['u'] else None,
                     row['o'][3] if row['o'] else None, row['pj']]
            if not entry or entry.get('h') != digest:
                trail = ((entry or {}).get('tr') or [])[-(TRAIL_KEEP - 1):] + [point]
                kept[field] = {'f': run_id, 'l': run_id, 'r': run_id, 'h': digest, 'row': row, 'tr': trail, 'n': (entry or {}).get('n', 0) + 1}
            else:
                entry.update(l=run_id, r=run_id)
        written = pipeline([['SET', key('last', day), pack(kept), 'EX', KEEP_SECONDS], *archive])
        return bool(written and written[0] == 'OK' and written[1] == 'OK')
    finally:
        pipeline([['COMPAREDEL', lock, owner]])


def last_on(day: str, pipeline=None) -> dict:
    pipeline = pipeline or _pipeline
    reply = pipeline([['GET', key('last', day)]])
    return (unpack(reply[0]) if reply and reply[0] else None) or {}


def runs_on(day: str, pipeline=None) -> list:
    pipeline = pipeline or _pipeline
    reply = pipeline([['LRANGE', key('runs', day), 0, -1]]) or [[]]
    out = []
    for raw in reply[0] or []:
        try:
            out.append(json.loads(raw))
        except (TypeError, ValueError):
            continue
    return sorted(out, key=lambda run: run['at'])


# ---------------------------------------------------------------- what's recorded

def recording(days=None, now=None, pipeline=None) -> dict:
    """What is being kept, for the admin: the status of each record, the
    newest problems, the counts and a few real entries of each kind for
    today and yesterday, and the storage they take."""
    pipeline = pipeline or _pipeline
    now = time.time() if now is None else now
    days = sorted(set(days or [day_of(now - 86400), day_of(now)]))
    commands = [['HGETALL', key('status')], ['LRANGE', key('health'), 0, 59]]
    for day in days:
        commands += [['LLEN', key('lines', day)], ['HLEN', key('lstate', day)], ['LLEN', key('reports', day)],
                     ['LRANGE', key('runs', day), 0, -1], ['GET', key('last', day)]]
    replies = pipeline(commands)
    if replies is None:
        return {'error': 'Storage unavailable.'}
    # The whole store's key count, where the storage answers it.
    from v2.board import store
    size = pipeline([['DBSIZE']]) if store.STORAGE_BACKEND == 'upstash' else None
    status = {}
    for name, value in _pairs(replies[0]):
        try:
            status[name] = json.loads(value)
        except (TypeError, ValueError):
            continue
    health = []
    for raw in replies[1] or []:
        try:
            health.append(json.loads(raw))
        except (TypeError, ValueError):
            continue
    out = {'at': int(now), 'status': status, 'health': health, 'keys': size[0] if size else None, 'days': []}
    for index, day in enumerate(days):
        base = 2 + index * 5
        runs = []
        for raw in replies[base + 3] or []:
            try:
                runs.append(json.loads(raw))
            except (TypeError, ValueError):
                continue
        packed = replies[base + 4]
        last = (unpack(packed) or {}) if packed else {}
        runs.sort(key=lambda run: run['at'])
        history = line_history(day, pipeline) if replies[base] else {}
        reports = reports_on(day, pipeline) if replies[base + 2] else []
        moved = [(pp, entry) for pp, entry in history.items() if sum(1 for move in entry['moves'] if move[1] is not None) > 1]
        sample = sorted(last.values(), key=lambda entry: (-(entry.get('n') or 0), entry['row']['pl']))[:6]
        out['days'].append({
            'day': day,
            'lines': {'events': replies[base], 'tracked': replies[base + 1], 'moved': len(moved),
                      'pulled': sum(1 for _, entry in history.items() if entry['moves'] and entry['moves'][-1][1] is None),
                      'sample': [{'player': (entry.get('meta') or [''])[0], 'stat': (entry.get('meta') or ['', '', '', '', ''])[4],
                                  'type': (entry.get('meta') or [''] * 6)[5], 'moves': entry['moves'][-6:]} for _, entry in moved[:5]]},
            'reports': {'events': replies[base + 2], 'kinds': _count_kinds(reports), 'sample': reports[-6:]},
            'runs': [{key_: run.get(key_) for key_ in ('id', 'at', 'started', 'rows', 'late', 'rejected', 'sha', 'model', 'problems', 'data')} for run in runs[-12:]],
            'grades': {'lines': len(last), 'changed': sum(1 for entry in last.values() if (entry.get('n') or 0) > 1),
                       'sample': [{**entry['row'], 'first': entry['f'], 'last': entry['l'], 'trail': entry.get('tr', [])[-6:]} for entry in sample]},
            'bytes': {'grades': len(packed or '')},
        })
    return out


def _count_kinds(reports):
    counts = defaultdict(int)
    for item in reports:
        counts[item.get('k')] += 1
    return dict(counts)
