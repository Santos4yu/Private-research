"""NBA.com's numbers, carried by the admin's phone.

stats.nba.com turns away every server the site can use -- Vercel, GitHub's
machines and Cloudflare's all went unanswered (2026-10-21) -- but answers a
home or phone connection. So an iPhone Shortcut on the admin's phone asks
it once a day: it reads the list of tables to fetch from here (jobs), asks
NBA.com for each, and posts each answer back unchanged (accept). The
readers (nba_matchups.py, backend/sports/wnba/tracking.py) look here first
and only ask NBA.com themselves when the phone has sent nothing.

NBA.com echoes each request's name and parameters in its answer, so an
answer says which table it is. Season matchups come by offensive team and
are kept by player (who guarded him, every team he played for).

Both calls carry a key made once and kept in KV (key()); the admin panel
shows the link with it, for the Shortcut.
"""
import base64
import json
import secrets
import time
import zlib
from datetime import datetime, timezone
from urllib.parse import quote, urlencode

PREFIX = 'nba:relay:v1'
KEY_KEY = f'{PREFIX}:key'
# fingerprint -> when the phone last sent that table.
SENT_KEY = f'{PREFIX}:sent'
# The last upload the site turned away, described (describe()).
PROBLEM_KEY = f'{PREFIX}:problem'
STATS = 'https://stats.nba.com/stats'
# This season's tables are asked again after this long; last season's once.
FRESH_SECONDS = 20 * 3600
KEEP_CURRENT = 30 * 86400
KEEP_PAST = 400 * 86400
# A phone run fetches at most this many (a few minutes); the rest wait for the next.
MAX_JOBS = 70
# What Vercel takes in one request, less room for the rest of it.
MAX_BODY = 4_200_000
TEAM_IDS = [str(1610612737 + index) for index in range(30)]
PLAY_TYPES = ('Isolation', 'Transition', 'PRBallHandler', 'PRRollman', 'Postup', 'Spotup', 'Handoff', 'Cut', 'OffScreen',
              'OffRebound', 'Misc')
DEFENSE_CATEGORIES = ('Overall', '3 Pointers', 'Less Than 6Ft')
# The parameters that tell one table of each kind from another.
IDENTITY = {
    'commonallplayers': ('Season',),
    'leagueseasonmatchups': ('Season', 'OffTeamID'),
    'leaguedashptstats': ('Season', 'PtMeasureType', 'LastNGames'),
    'leaguedashptdefend': ('Season', 'DefenseCategory'),
    'synergyplaytypes': ('SeasonYear', 'PlayType', 'PlayerOrTeam', 'TypeGrouping'),
}
_BLANK = {'College': '', 'Conference': '', 'Country': '', 'DateFrom': '', 'DateTo': '', 'Division': '', 'DraftPick': '',
          'DraftYear': '', 'GameSegment': '', 'Height': '', 'LastNGames': 0, 'LeagueID': '00', 'Location': '', 'Month': 0,
          'OpponentTeamID': 0, 'Outcome': '', 'PORound': 0, 'PerMode': 'PerGame', 'Period': 0, 'PlayerExperience': '',
          'PlayerPosition': '', 'SeasonSegment': '', 'SeasonType': 'Regular Season', 'StarterBench': '', 'TeamID': 0,
          'VsConference': '', 'VsDivision': '', 'Weight': ''}

_memory = {}


class Rejected(ValueError):
    """An upload that isn't one of the tables asked for."""


def _pipeline(commands, timeout=8):
    from v2.board import store
    if not store.configured():
        return None
    return [entry['result'] for entry in store.pipeline(commands, timeout=timeout)]


def _pack(value):
    return base64.b64encode(zlib.compress(json.dumps(value, separators=(',', ':')).encode(), 6)).decode()


def _unpack(text):
    try:
        return json.loads(zlib.decompress(base64.b64decode(text)))
    except Exception:  # noqa: BLE001 -- a damaged copy is no copy
        return None


def season_label(end_year):
    return f'{end_year - 1}-{str(end_year)[2:]}'


def current_season(now=None):
    """The season under way, by the year it ends (late October on)."""
    now = now or datetime.now(timezone.utc)
    return now.year + 1 if (now.month, now.day) >= (10, 21) else now.year


def _norm(value):
    return str(value if value is not None else '').strip().lower()


def fingerprint(endpoint, params):
    """One table's name: its kind and the parameters that set it apart
    (any letter case, numbers as text)."""
    endpoint = _norm(endpoint)
    lowered = {_norm(name): value for name, value in (params or {}).items()}
    return endpoint + ''.join(f'|{_norm(name)}={_norm(lowered.get(_norm(name)))}' for name in IDENTITY.get(endpoint, ()))


def _season_of(endpoint, params):
    lowered = {_norm(name): value for name, value in (params or {}).items()}
    return str(lowered.get('seasonyear' if _norm(endpoint) == 'synergyplaytypes' else 'season') or '')


def tables(season):
    """Every table the phone fetches for a season: [(endpoint, params)]."""
    from backend.sports.wnba.tracking import MEASURES, RECENT, RECENT_MEASURES, _params
    label = season_label(season)
    out = [('commonallplayers', {'LeagueID': '00', 'Season': label, 'IsOnlyCurrentSeason': '1'})]
    out += [('leagueseasonmatchups', {'LeagueID': '00', 'Season': label, 'SeasonType': 'Regular Season', 'PerMode': 'Totals',
                                      'OffTeamID': team}) for team in TEAM_IDS]
    out += [('leaguedashptstats', _params(measure, season, 0)) for measure in MEASURES]
    out += [('leaguedashptstats', _params(measure, season, RECENT)) for measure in RECENT_MEASURES]
    out += [('leaguedashptdefend', {**_BLANK, 'Season': label, 'DefenseCategory': category, 'PlayerID': ''})
            for category in DEFENSE_CATEGORIES]
    synergy = {'LeagueID': '00', 'SeasonYear': label, 'SeasonType': 'Regular Season', 'PerMode': 'PerGame'}
    out += [('synergyplaytypes', {**synergy, 'PlayType': kind, 'PlayerOrTeam': 'P', 'TypeGrouping': 'offensive'}) for kind in PLAY_TYPES]
    out += [('synergyplaytypes', {**synergy, 'PlayType': kind, 'PlayerOrTeam': 'T', 'TypeGrouping': 'defensive'}) for kind in PLAY_TYPES]
    return out


def url(endpoint, params):
    return f'{STATS}/{endpoint}?{urlencode(params, quote_via=quote)}'


def _sent():
    reply = _pipeline([['HGETALL', SENT_KEY]])
    flat = (reply or [[]])[0] or []
    out = {}
    for name, value in zip(flat[0::2], flat[1::2]):
        try:
            out[name] = float(value)
        except (TypeError, ValueError):
            continue
    return out


def jobs(now=None):
    """The NBA.com links for the phone to fetch now: last season's tables it
    hasn't sent yet (what the pages lean on in the season's first weeks),
    then this season's that are a day old or never sent."""
    now = time.time() if now is None else now
    season = current_season(datetime.fromtimestamp(now, timezone.utc))
    sent = _sent()
    past = [job for job in tables(season - 1) if fingerprint(*job) not in sent]
    current = [job for job in tables(season) if now - sent.get(fingerprint(*job), 0) >= FRESH_SECONDS]
    return [url(*job) for job in (past + current)[:MAX_JOBS]]


def _table(payload):
    """(headers, rows) of an NBA.com answer's first table."""
    sets = payload.get('resultSets') if 'resultSets' in payload else payload.get('resultSet')
    table = sets[0] if isinstance(sets, list) and sets else sets if isinstance(sets, dict) else None
    if not isinstance(table, dict):
        raise Rejected('No table in it.')
    headers, rows = table.get('headers'), table.get('rowSet')
    if not isinstance(headers, list) or not isinstance(rows, list) or not all(isinstance(row, list) for row in rows):
        raise Rejected('The table is damaged.')
    if headers and isinstance(headers[0], dict):
        # Some tables put a row of column groups first; the names are last.
        headers = headers[-1].get('columnNames') or []
    if any(len(row) != len(headers) for row in rows):
        raise Rejected('The table is damaged.')
    return headers, rows


def accept(payload, now=None):
    """Keep one NBA.com answer the phone sent. Returns what it was; raises
    Rejected when it isn't one of the tables asked for."""
    now = time.time() if now is None else now
    if not isinstance(payload, dict):
        raise Rejected('Not an NBA.com answer.')
    endpoint = _norm(payload.get('resource'))
    params = payload.get('parameters')
    if isinstance(params, list):
        # Older tables list their parameters one per entry.
        params = {name: value for entry in params if isinstance(entry, dict) for name, value in entry.items()}
    params = params if isinstance(params, dict) else {}
    name = fingerprint(endpoint, params)
    season = current_season(datetime.fromtimestamp(now, timezone.utc))
    wanted = {fingerprint(*job): job for job in tables(season) + tables(season - 1)}
    if name not in wanted:
        raise Rejected(f'Not a table the site asks for ({endpoint or "unnamed"}).')
    headers, rows = _table(payload)
    label = _season_of(endpoint, params)
    keep = KEEP_CURRENT if label == season_label(season) else KEEP_PAST
    commands = []
    if endpoint == 'leagueseasonmatchups':
        # Kept by offensive player, one field per team he played for.
        column = headers.index('OFF_PLAYER_ID') if 'OFF_PLAYER_ID' in headers else None
        if column is None:
            raise Rejected('The table is damaged.')
        team = _norm({_norm(field): value for field, value in params.items()}.get('offteamid'))
        by_player = {}
        for row in rows:
            by_player.setdefault(str(row[column]), []).append(row)
        for player, theirs in by_player.items():
            key = f'{PREFIX}:off:{label}:{player}'
            commands += [['HSET', key, team, _pack({'headers': headers, 'rows': theirs})], ['EXPIRE', key, keep]]
    else:
        key = f'{PREFIX}:t:{name}'
        commands.append(['SET', key, _pack({'headers': headers, 'rows': rows}), 'EX', keep])
    # A table taken clears the last turned-away note: the phone works now.
    commands += [['HSET', SENT_KEY, name, str(int(now))], ['DEL', PROBLEM_KEY]]
    for start in range(0, len(commands), 60):
        if _pipeline(commands[start:start + 60], timeout=10) is None:
            raise Rejected('The site has nowhere to keep it.')
    _memory.clear()
    return {'table': name, 'rows': len(rows)}


def _dicts(table):
    if not table:
        return None
    headers = table.get('headers') or []
    return [dict(zip(headers, row)) for row in table.get('rows') or []]


def rows(endpoint, params):
    """A table the phone sent, as dicts like NBA.com's: None when it hasn't
    sent it (ask NBA.com), [] when it has and there's nothing in it."""
    try:
        endpoint = _norm(endpoint)
        lowered = {_norm(name): value for name, value in (params or {}).items()}
        cached = _memory.get((endpoint, json.dumps(lowered, sort_keys=True, default=str)))
        if cached and time.time() - cached[0] < 600:
            return cached[1]
        if endpoint == 'leagueseasonmatchups' and _norm(lowered.get('offplayerid')):
            label = str(lowered.get('season') or '')
            reply = _pipeline([['HGETALL', f"{PREFIX}:off:{label}:{_norm(lowered['offplayerid'])}"], ['HGETALL', SENT_KEY]])
            if reply is None:
                return None
            flat, sent = reply[0] or [], reply[1] or []
            found = [row for value in flat[1::2] for row in (_dicts(_unpack(value)) or [])]
            covered = any(name.startswith(f'leagueseasonmatchups|season={_norm(label)}|') for name in sent[0::2])
            value = found if found or covered else None
        else:
            reply = _pipeline([['GET', f'{PREFIX}:t:{fingerprint(endpoint, lowered)}']])
            value = _dicts(_unpack(reply[0])) if reply and reply[0] else None
        if value is not None:
            _memory[(endpoint, json.dumps(lowered, sort_keys=True, default=str))] = (time.time(), value)
        return value
    except Exception:  # noqa: BLE001 -- the store is a convenience, never a reason to fail
        return None


def key():
    """The secret in the phone's link, made once and kept in KV."""
    reply = _pipeline([['GET', KEY_KEY]])
    if reply is None:
        return None
    if not reply[0]:
        _pipeline([['SET', KEY_KEY, secrets.token_urlsafe(24), 'NX']])
        reply = _pipeline([['GET', KEY_KEY]])
    return reply[0]


def describe(raw, payload=None):
    """What an upload the site turned away looked like, for the admin to
    see: its top-level names and how it starts."""
    text = raw.decode('utf-8', 'replace') if isinstance(raw, (bytes, bytearray)) else str(raw or '')
    names = f"names: {', '.join(map(str, list(payload)[:8]))}; " if isinstance(payload, dict) else ''
    return f"{names}{len(text)} characters, starting {' '.join(text[:160].split())!r}"


def note_problem(text):
    """Keep the last turned-away upload's description (a week) for the admin panel."""
    try:
        _pipeline([['SET', PROBLEM_KEY, str(text)[:400], 'EX', 7 * 86400]])
    except Exception:  # noqa: BLE001 -- a note is never worth failing on
        pass


def status(now=None):
    """For the admin panel: when the phone last sent anything, how many of
    this season's tables are current, and the last upload turned away."""
    now = time.time() if now is None else now
    season = current_season(datetime.fromtimestamp(now, timezone.utc))
    sent = _sent()
    wanted = [fingerprint(*job) for job in tables(season)]
    problem = (_pipeline([['GET', PROBLEM_KEY]]) or [None])[0]
    return {'last': max(sent.values()) if sent else None,
            'current': sum(now - sent.get(name, 0) < FRESH_SECONDS + 6 * 3600 for name in wanted), 'tables': len(wanted),
            'problem': problem}
