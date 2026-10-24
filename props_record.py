"""The Props tab's track record: what each NBA prop showed before its game
(its matchup score, Prop grade and line) and how those props went once the
games were played.

The scores are worked out on the phone (src/nba-matchup-score.js), so the
list sends what it shows (MatchupList.jsx) while the games are still to
come; the last report before a game starts is the one kept. Kept per game
day in one KV hash: "playerId|market|line" -> [score, chance, tier,
modifier, needs]. The results are the stored season's box scores
(backend/sports/wnba/league.py): an over when he beat the line, a push when
he landed on it (left out of the rates)."""
import json
import time
from collections import defaultdict
from datetime import datetime, timezone

PREFIX = 'krazy:props-record:v1:nba'
# A season and its playoffs.
KEEP_SECONDS = 270 * 86400
# The US day of a game: its start less six hours (as line_archive.py).
DAY_SHIFT = 6 * 3600
# One report's most lines (a full NBA night is a few hundred).
MAX_ROWS = 1000
# Matchup score bands and Prop grade tiers the record is told in.
BANDS = ((90, '90+'), (75, '75-89'), (60, '60-74'), (40, '40-59'), (0, 'Under 40'))
TIERS = ('elite', 'strong', 'lean', 'risky', 'fade')
# The stats the list grades (src/nba-props-data.js PROPS_MARKETS).
MARKETS = {'player_points': 'pts', 'player_rebounds': 'reb', 'player_assists': 'ast', 'player_threes': 'tpm',
           'player_steals': 'stl', 'player_blocks': 'blk', 'player_points_rebounds': 'pr', 'player_points_assists': 'pa',
           'player_points_rebounds_assists': 'pra'}


def day_of(start):
    """The US calendar day (YYYY-MM-DD) of a game starting at `start` (epoch seconds)."""
    return datetime.fromtimestamp(start - DAY_SHIFT, timezone.utc).date().isoformat()


def key(day):
    return f'{PREFIX}:{day}'


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _start(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
    except (TypeError, ValueError):
        return None


def remember(rows, pipeline, now=None):
    """Keep the list's report (rows of {id, market, line, start, score, chance,
    tier, modifier, needs}) for games not yet started. Returns how many were
    written."""
    now = time.time() if now is None else now
    by_day = defaultdict(dict)
    for row in (rows or [])[:MAX_ROWS]:
        if not isinstance(row, dict):
            continue
        pid, market, line, start = str(row.get('id') or ''), row.get('market'), _number(row.get('line')), _start(row.get('start'))
        score, chance = _number(row.get('score')), _number(row.get('chance'))
        if not pid.isdigit() or market not in MARKETS or line is None or not start or start <= now or score is None:
            continue
        tier = row.get('tier') if row.get('tier') in TIERS else None
        modifier = row.get('modifier') if row.get('modifier') in ('standard', 'demon', 'goblin') else 'standard'
        needs = _number(row.get('needs'))
        by_day[day_of(start)][f'{pid}|{market}|{format(line, "g")}'] = json.dumps(
            [round(score), None if chance is None else round(chance, 3), tier, modifier, None if needs is None else round(needs, 3)],
            separators=(',', ':'))
    commands = []
    for day, fields in by_day.items():
        commands += [['HSET', key(day), *[part for field, value in sorted(fields.items()) for part in (field, value)]],
                     ['EXPIRE', key(day), KEEP_SECONDS]]
    if not commands or pipeline(commands) is None:
        return 0
    return sum(len(fields) for fields in by_day.values())


def reports(days, pipeline):
    """{day: {field: [score, chance, tier, modifier, needs]}} for the days asked."""
    if not days:
        return {}
    replies = pipeline([['HGETALL', key(day)] for day in days]) or []
    out = {}
    for day, flat in zip(days, replies):
        kept = {}
        flat = flat or []
        for field, value in zip(flat[0::2], flat[1::2]):
            try:
                kept[field] = json.loads(value)
            except (TypeError, ValueError):
                continue
        if kept:
            out[day] = kept
    return out


def results(payloads, stat_value):
    """{(player id, US day): {stat key: value}} from stored seasons' box
    scores (league.stored), for the players who played."""
    from backend.sports.wnba.league import FIELDS
    index = {name: position + 2 for position, name in enumerate(FIELDS)}
    out = {}
    for payload in payloads:
        for game in ((payload or {}).get('games') or {}).values():
            start = _start(game.get('date'))
            if not start:
                continue
            day = day_of(start)
            for side in (game.get('t') or {}).values():
                for row in side.get('p') or []:
                    if not (row[index['min']] or 0) > 0:
                        continue
                    out[(str(row[0]), day)] = {stat: stat_value(row, stat) for stat in set(MARKETS.values())}
    return out


def _tally():
    return {'over': 0, 'under': 0, 'push': 0}


def _rate(tally):
    decided = tally['over'] + tally['under']
    return {**tally, 'props': decided + tally['push'], 'overRate': round(tally['over'] / decided * 100, 1) if decided else None}


def record(days, pipeline, payloads, stat_value, today=None):
    """How the props shown went, by matchup score band and Prop grade tier:
    {days, nights, bands: [{band, over, under, push, props, overRate}],
    tiers: [...], all: {...}}. Days still to finish (today) aren't read."""
    today = today or day_of(time.time())
    asked = sorted(day for day in days if day < today)
    kept = reports(asked, pipeline)
    found = results(payloads, stat_value) if kept else {}
    bands, tiers, overall, nights = defaultdict(_tally), defaultdict(_tally), _tally(), set()
    for day, fields in kept.items():
        for field, (score, chance, tier, modifier, needs) in fields.items():
            pid, market, line = field.split('|')
            value = (found.get((pid, day)) or {}).get(MARKETS.get(market))
            if value is None:
                continue
            line = float(line)
            outcome = 'over' if value > line else 'under' if value < line else 'push'
            nights.add(day)
            overall[outcome] += 1
            bands[next(label for floor, label in BANDS if score >= floor)][outcome] += 1
            if tier:
                tiers[tier][outcome] += 1
    return {'days': len(asked), 'nights': len(nights), 'from': asked[0] if asked else None, 'to': asked[-1] if asked else None,
            'bands': [{'band': label, **_rate(bands[label])} for _, label in BANDS],
            'tiers': [{'tier': tier, **_rate(tiers[tier])} for tier in TIERS],
            'all': _rate(overall)}
