"""Closing lines: the last PrizePicks number each NBA line had before its
game, kept by game day for the season.

A line on the board today says nothing about last week's; to grade how a
player did "at his own line that night" the night's numbers have to have
been kept. line_moves.observe_prizepicks hands every fresh PrizePicks feed
here (the line-check timer fetches each league every few minutes), and a
line is written again only when its number changed, so the number kept for
a game is the last one before it started.

Kept per sport and day in one KV hash: "player|stat" -> line, names in
line_moves.norm form. The day is the US day of the game (start time less
six hours: a 10:30 pm Eastern tip is still that day).
"""
import time
from datetime import datetime, timezone

PREFIX = 'krazy:lines:v1'
SPORTS = ('nba',)
# A season and its playoffs.
KEEP_SECONDS = 270 * 86400
DAY_SHIFT = 6 * 3600

# (sport, day) -> {field: line} this instance already wrote.
_written = {}


def day_of(start):
    """The US calendar day (YYYY-MM-DD) of a game starting at `start` (epoch seconds)."""
    return datetime.fromtimestamp(start - DAY_SHIFT, timezone.utc).date().isoformat()


def key(sport, day):
    return f'{PREFIX}:{sport}:{day}'


def record(sport, lines, pipeline, now=None):
    """Keep `lines` ([(player, stat, line, start)], names normed) for games
    not yet started. Returns how many numbers were written."""
    if sport not in SPORTS:
        return 0
    now = time.time() if now is None else now
    by_day = {}
    for player, stat, line, start in lines:
        if not player or not stat or line is None or not start or start <= now:
            continue
        by_day.setdefault(day_of(start), {})[f'{player}|{stat}'] = line
    commands, sent = [], []
    for day, numbers in by_day.items():
        seen = _written.get((sport, day), {})
        fresh = {field: line for field, line in numbers.items() if seen.get(field) != line}
        if not fresh:
            continue
        flat = [part for field, line in sorted(fresh.items()) for part in (field, format(line, 'g'))]
        commands += [['HSET', key(sport, day), *flat], ['EXPIRE', key(sport, day), KEEP_SECONDS]]
        sent.append((day, fresh))
    if not commands or pipeline(commands) is None:
        return 0
    for day, fresh in sent:
        _written.setdefault((sport, day), {}).update(fresh)
    # Days long past aren't written again on this instance.
    cutoff = day_of(now - 2 * 86400)
    for old in [entry for entry in _written if entry[1] < cutoff]:
        del _written[old]
    return sum(len(fresh) for _, fresh in sent)


def lines_on(sport, day, pipeline):
    """{"player|stat": line} kept for `sport` on `day`; {} when none."""
    reply = pipeline([['HGETALL', key(sport, day)]])
    flat = (reply or [[]])[0] or []
    out = {}
    for field, value in zip(flat[0::2], flat[1::2]):
        try:
            out[field] = float(value)
        except (TypeError, ValueError):
            continue
    return out

