"""Validated, compact nflverse PBP summaries; raw seasons never enter the UI."""
import csv
import gzip
import io
import json
import math
import tempfile
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen
from .nflverse import RELEASE, ProviderError, canonical_team
from ..cache import NFLCacheDomain, cached_nfl

VERSION = 'nfl-pbp-volume-v2'
REQUIRED = {'game_id', 'week', 'season_type', 'posteam', 'defteam', 'play_type',
            'qb_dropback', 'qb_scramble', 'rush_attempt', 'pass_attempt', 'sack',
            'qb_kneel', 'qb_spike', 'score_differential', 'passer_player_id',
            'rusher_player_id', 'receiver_player_id', 'fixed_drive', 'play_deleted', 'two_point_attempt'}


def number(row, field):
    raw = row.get(field)
    if raw in (None, '', 'NA', 'NaN'):
        return None
    value = float(raw)
    return value if math.isfinite(value) else None


def summarize(records):
    games = {}
    players = {}
    for r in records:
        if r.get('season_type') != 'REG' or number(r, 'play_deleted') == 1:
            continue
        team, opponent = canonical_team(r.get('posteam')), canonical_team(r.get('defteam'))
        if not team or not opponent or r.get('play_type') not in ('pass', 'run', 'qb_kneel', 'qb_spike') or number(r, 'two_point_attempt') == 1:
            continue
        week = number(r, 'week')
        flags = [number(r, k) for k in ('qb_dropback', 'qb_scramble', 'rush_attempt', 'pass_attempt', 'sack', 'qb_kneel', 'qb_spike')]
        if week is None or any(v is None or v not in (0, 1) for v in flags):
            raise ProviderError('Missing/invalid required PBP opportunity indicator')
        drop, scramble, rush, attempt, sack, kneel, spike = flags
        attempt = attempt * (1 - sack)
        key = (r['game_id'], team)
        if key not in games:
            games[key] = {'game_id': key[0], 'team_id': team, 'opponent_team_id': opponent, 'week': int(week),
                          'is_home': r.get('posteam_type') == 'home', 'stats': defaultdict(float),
                          'states': {}, '_drives': set(), '_previous': None, 'flags': []}
        g = games[key]
        s = g['stats']
        s['offensive_plays'] += 1
        s['dropbacks'] += drop
        s['scrambles'] += scramble
        s['carries'] += rush
        s['called_rushes'] += rush - scramble
        s['attempts'] += attempt
        s['sacks_suffered'] += sack
        s['spikes'] += spike
        s['pass_plays'] += attempt + sack
        # Partition: dropbacks + called rushes + spikes = plays.
        drive = r.get('fixed_drive')
        if drive:
            g['_drives'].add(drive)
        differential = number(r, 'score_differential')
        state = 'LEADING' if differential is not None and differential > 7 else 'TRAILING' if differential is not None and differential < -7 else 'CLOSE' if differential is not None else None
        if state:
            st = g['states'].setdefault(state, {'plays': 0, 'dropbacks': 0, 'paceSeconds': []})
            st['plays'] += 1
            st['dropbacks'] += drop
            clock = number(r, 'game_seconds_remaining')
            previous = g['_previous']
            if previous and clock is not None and previous[0] == drive:
                delta = previous[1] - clock
                if 0 < delta <= 60:
                    st['paceSeconds'].append(delta)
            g['_previous'] = (drive, clock) if clock is not None else None
        if number(r, 'qtr') is not None and number(r, 'qtr') > 4 and 'OVERTIME' not in g['flags']:
            g['flags'].append('OVERTIME')
        if differential is not None and abs(differential) >= 28 and 'EXTREME_SCORE_STATE' not in g['flags']:
            g['flags'].append('EXTREME_SCORE_STATE')
        for pid in {r.get('passer_player_id'), r.get('rusher_player_id'), r.get('receiver_player_id')} - {None, ''}:
            pk = (r['game_id'], team, pid)
            p = players.setdefault(pk, {'game_id':r['game_id'], 'team_id':team, 'player_id':pid, 'week':int(week), 'stats':defaultdict(float)})
            ps = p['stats']
            if pid == r.get('passer_player_id'):
                ps['dropbacks'] += drop
                ps['attempts'] += attempt
                ps['sacks_suffered'] += sack
            if pid == r.get('rusher_player_id'):
                ps['carries'] += rush
                ps['scrambles'] += scramble
                ps['kneels'] += kneel
                ps['non_scramble_rushes'] += rush - scramble - kneel
                if scramble and pid != r.get('passer_player_id'):
                    ps['dropbacks'] += drop
            if pid == r.get('receiver_player_id') and attempt:
                ps['targets'] += 1
    for g in games.values():
        g['stats']['drives'] = len(g.pop('_drives')) or None
        g.pop('_previous')
        g['stats'] = dict(g['stats'])
        for state in g['states'].values():
            pace = state.pop('paceSeconds')
            state['secondsPerPlay'] = sum(pace)/len(pace) if pace else None
    for p in players.values():
        # Flags were validated for every accepted play, so observed non-occurrence is zero.
        for k in ('targets','carries','attempts','dropbacks','scrambles','kneels','non_scramble_rushes','sacks_suffered'):
            p['stats'].setdefault(k, 0)
        p['stats'] = dict(p['stats'])
    if not games:
        raise ProviderError('No validated regular-season PBP')
    return {'teams': list(games.values()), 'players': list(players.values())}


def season_summary(season):
    def load():
        path = Path(tempfile.gettempdir()) / f'krazy-data-{VERSION}-{season}.json'
        if path.exists() and time.time() - path.stat().st_mtime < 1800:
            try:
                return json.loads(path.read_text(encoding='utf-8'))
            except (ValueError, OSError):
                pass
        url = f'{RELEASE}/pbp/play_by_play_{season}.csv.gz'
        with urlopen(Request(url, headers={'User-Agent':'KrazyData-NFL-research/1.0'}), timeout=30) as response:
            reader = csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=response), encoding='utf-8-sig'))
            if not REQUIRED.issubset(reader.fieldnames or []):
                raise ProviderError('PBP schema missing required columns')
            result = summarize(reader)
            result.update(source='nflverse', sourceUrl=url, fetchedAt=datetime.now(timezone.utc).isoformat(),
                          observedAt=response.headers.get('Last-Modified'), version=VERSION)
        temporary = path.with_suffix('.tmp')
        try:
            temporary.write_text(json.dumps(result), encoding='utf-8')
            temporary.replace(path)
        except OSError:
            pass  # Disk cache is optional; successful data remains in warm memory.
        return result
    return cached_nfl(NFLCacheDomain.STATS, (VERSION, season), load)
