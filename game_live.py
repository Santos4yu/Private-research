"""A game while it's on (Nov 8, the owner, offered seven ideas for live
games: "Yes add all").

  - feed: the last play, the run going now ("PHX on a 9-0 run"), each
    quarter's score, each team's top players and the biggest lead each had.
  - swings: the two or three plays that moved the win chance most.
  - momentum: who outscored whom in each stretch of the game.
  - props: every player with a prop line in the game, what he has so far
    against it.
  - live_list: the games on now, for the games list: score, time left and
    a small line of the win chance.

All of it from ESPN's game summary (the one the chart already reads every
few seconds) and the prop lines line_archive.py kept from before the game
(the lines come down at tip-off). game_predictor.chart adds the first four
to a game's chart; nothing here is ever worth failing the chart for.
"""
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import game_predictor as gp

# Unanswered points that make a run worth saying.
RUN_MIN = {"nba": 7, "nfl": 10}
# A swing: a play that moved the win chance at least this much, the ones kept
# at least this far apart in the game (seconds).
SWING_MIN = 0.05
SWING_APART = {"nba": 90, "nfl": 150}
# Momentum stretches (seconds): in regulation, in overtime.
STRETCH = {"nba": (180, 150), "nfl": (300, 300)}
# The games list reads the scores and each game's chance line this often.
LIST_SECONDS = 15
LIST_POINTS = 40
PROP_LINES_SECONDS = 120
PROPS_MOST = 60


def period_label(number) -> str:
    number = int(gp._num(number) or 1)
    return f"Q{number}" if number <= 4 else "OT" if number == 5 else f"OT{number - 4}"


def plays(summary) -> list:
    """Every play in order: the NBA's `plays`, the NFL's within its drives
    (the drive on now last), each NFL play with its drive's team."""
    found = list((summary or {}).get("plays") or [])
    drives = (summary or {}).get("drives") or {}
    seen = {str(play.get("id")) for play in found if play.get("id") is not None}
    for drive in (drives.get("previous") or []) + [drives.get("current") or {}]:
        for play in drive.get("plays") or []:
            key = str(play.get("id")) if play.get("id") is not None else None
            if key and key in seen:
                continue
            if key:
                seen.add(key)
            found.append(play if play.get("team") or not drive.get("team") else {**play, "team": drive["team"]})
    return found


def _competition(summary) -> dict:
    return (((summary or {}).get("header") or {}).get("competitions") or [{}])[0]


def sides_of(summary) -> dict:
    """{a team's ESPN id or abbreviation: "home" | "away"}."""
    out = {}
    for competitor in _competition(summary).get("competitors") or []:
        team = competitor.get("team") or {}
        for key in (competitor.get("id"), team.get("id"), team.get("abbreviation")):
            if key not in (None, ""):
                out[str(key)] = competitor.get("homeAway")
    return out


def _side_of(play, sides):
    team = play.get("team") or {}
    for key in (team.get("id"), team.get("abbreviation")):
        if key not in (None, "") and str(key) in sides:
            return sides[str(key)]
    return None


def _elapsed(sport, play):
    return gp.game_elapsed(sport, (play.get("period") or {}).get("number"), (play.get("clock") or {}).get("displayValue"))


def _when(play) -> str:
    clock = str((play.get("clock") or {}).get("displayValue") or "").strip()
    period = (play.get("period") or {}).get("number")
    return f"{period_label(period)} {clock}".strip() if period else clock


def _text(play, most=150) -> str:
    text = " ".join(str(play.get("text") or "").split())
    return text if len(text) <= most else text[:most - 1].rstrip() + "…"


# ------------------------------------------------------------------ the score as it went

def score_timeline(sport, all_plays) -> list:
    """[(seconds into the game or None, home, away)] at each play that
    changed the score."""
    out, last = [], (0, 0)
    for play in all_plays:
        home, away = gp._num(play.get("homeScore")), gp._num(play.get("awayScore"))
        if home is None or away is None or (home, away) == last:
            continue
        out.append((_elapsed(sport, play), int(home), int(away)))
        last = (home, away)
    return out


def current_run(sport, timeline) -> dict | None:
    """{side, points}: the points one team has scored since the other last
    did, when that's a run worth saying."""
    changes, before = [], (0, 0)
    for _at, home, away in timeline:
        changes.append((home - before[0], away - before[1]))
        before = (home, away)
    side, points = None, 0
    for home, away in reversed(changes):
        if home > 0 and away > 0:
            break
        scorer = "home" if home > 0 else "away" if away > 0 else None
        if scorer is None:
            continue   # A score taken back (a review): not a basket either way.
        if side is None:
            side = scorer
        if scorer != side:
            break
        points += home if scorer == "home" else away
    return {"side": side, "points": points} if side and points >= RUN_MIN[sport] else None


def biggest_leads(timeline) -> dict:
    lead = {"home": 0, "away": 0}
    for _at, home, away in timeline:
        lead["home"], lead["away"] = max(lead["home"], home - away), max(lead["away"], away - home)
    return lead


def quarters(summary) -> dict | None:
    """{labels ["Q1".."Q4", "OT"], home [points], away [points]}."""
    rows = {}
    for competitor in _competition(summary).get("competitors") or []:
        values = []
        for item in competitor.get("linescores") or []:
            value = gp._num(item.get("value"))
            value = gp._num(item.get("displayValue")) if value is None else value
            values.append(int(value) if value is not None and float(value).is_integer() else value)
        rows[competitor.get("homeAway")] = values
    count = max(len(rows.get("home") or []), len(rows.get("away") or []))
    if not count:
        return None
    pad = lambda values: [values[index] if index < len(values) else None for index in range(count)]
    return {"labels": [period_label(index + 1) for index in range(count)], "home": pad(rows.get("home") or []), "away": pad(rows.get("away") or [])}


# ------------------------------------------------------------------ the box score

NBA_COLUMNS = {"minutes": "min", "MIN": "min", "points": "pts", "PTS": "pts", "rebounds": "reb", "REB": "reb", "assists": "ast", "AST": "ast",
               "steals": "stl", "STL": "stl", "blocks": "blk", "BLK": "blk", "turnovers": "to", "TO": "to", "fouls": "pf", "PF": "pf",
               "offensiveRebounds": "oreb", "OREB": "oreb", "defensiveRebounds": "dreb", "DREB": "dreb",
               "fieldGoalsMade-fieldGoalsAttempted": ("fgm", "fga"), "FG": ("fgm", "fga"),
               "threePointFieldGoalsMade-threePointFieldGoalsAttempted": ("tpm", "tpa"), "3PT": ("tpm", "tpa"),
               "freeThrowsMade-freeThrowsAttempted": ("ftm", "fta"), "FT": ("ftm", "fta")}


def _nba_line(group, values) -> dict:
    keys, labels = group.get("keys") or [], group.get("labels") or group.get("names") or []
    fields = {}
    for index, value in enumerate(values):
        name = keys[index] if index < len(keys) else labels[index] if index < len(labels) else None
        target = NBA_COLUMNS.get(name)
        if target is None:
            continue
        if isinstance(target, tuple):
            for field, part in zip(target, str(value).split("-")):
                if (number := gp._num(part)) is not None:
                    fields[field] = number
        elif (number := gp._num(value)) is not None:
            fields[target] = number
    return fields


def box_score(sport, summary) -> dict:
    """{side: [{id, name, short, headshot, starter, stats}]}: each player's
    line so far (NBA: pts, reb, ast, ...; NFL: nflverse's columns, as
    backend/sports/nfl/preseason.py reads ESPN's groups)."""
    sides = sides_of(summary)
    out = {"home": [], "away": []}
    read_nfl = None
    if sport == "nfl":
        from backend.sports.nfl.preseason import _read_group as read_nfl
    for team in ((summary or {}).get("boxscore") or {}).get("players") or []:
        info = team.get("team") or {}
        side = sides.get(str(info.get("id"))) or sides.get(str(info.get("abbreviation")))
        if side not in out:
            continue
        people = {}
        for group in team.get("statistics") or []:
            for entry in group.get("athletes") or []:
                athlete = entry.get("athlete") or {}
                key = str(athlete.get("id") or athlete.get("displayName") or "")
                if not key:
                    continue
                person = people.setdefault(key, {"id": key, "name": athlete.get("displayName") or athlete.get("shortName") or "",
                                                 "short": athlete.get("shortName") or athlete.get("displayName") or "",
                                                 "headshot": (athlete.get("headshot") or {}).get("href"),
                                                 "starter": bool(entry.get("starter")), "stats": {}})
                if entry.get("didNotPlay"):
                    person["out"] = True
                    continue
                values = entry.get("stats") or []
                person["stats"].update(_nba_line(group, values) if sport == "nba" else read_nfl(group, values))
        out[side] = list(people.values())
    return out


def _number_text(value) -> str:
    value = gp._num(value) or 0
    return str(int(value)) if float(value).is_integer() else f"{value:g}"


def leaders(sport, box) -> dict:
    """{side: [{name, text}]}: the NBA's top two scorers ("28 pts · 7 reb ·
    5 ast"); the NFL's top passer, rusher and receiver."""
    out = {}
    for side, people in box.items():
        found = []
        playing = [person for person in people if not person.get("out") and person["stats"]]
        if sport == "nba":
            stat = lambda person, key: gp._num(person["stats"].get(key)) or 0
            ranked = sorted(playing, key=lambda person: (-stat(person, "pts"), -(stat(person, "reb") + stat(person, "ast"))))
            for person in ranked[:2]:
                if stat(person, "min") or stat(person, "pts"):
                    found.append({"name": person["short"], "text": f"{_number_text(stat(person, 'pts'))} pts · {_number_text(stat(person, 'reb'))} reb · {_number_text(stat(person, 'ast'))} ast"})
        else:
            stat = lambda person, key: gp._num(person["stats"].get(key)) or 0
            passer = max((person for person in playing if stat(person, "attempts")), key=lambda person: stat(person, "passing_yards"), default=None)
            rusher = max((person for person in playing if stat(person, "carries")), key=lambda person: stat(person, "rushing_yards"), default=None)
            catcher = max((person for person in playing if stat(person, "receptions")), key=lambda person: stat(person, "receiving_yards"), default=None)
            if passer:
                text = f"{_number_text(stat(passer, 'completions'))}/{_number_text(stat(passer, 'attempts'))} · {_number_text(stat(passer, 'passing_yards'))} pass yds"
                touchdowns = stat(passer, "passing_tds")
                found.append({"name": passer["short"], "text": text + (f" · {_number_text(touchdowns)} TD" if touchdowns else "")})
            if rusher:
                found.append({"name": rusher["short"], "text": f"{_number_text(stat(rusher, 'carries'))} car · {_number_text(stat(rusher, 'rushing_yards'))} rush yds"})
            if catcher:
                found.append({"name": catcher["short"], "text": f"{_number_text(stat(catcher, 'receptions'))} rec · {_number_text(stat(catcher, 'receiving_yards'))} yds"})
        out[side] = found
    return out


# ------------------------------------------------------------------ the feed, swings, momentum

def feed(sport, summary, box=None) -> dict:
    """{last {text, when, side}, run, quarters, leaders, lead}."""
    sides = sides_of(summary)
    every = plays(summary)
    last = next((play for play in reversed(every) if str(play.get("text") or "").strip()), None)
    timeline = score_timeline(sport, every)
    box = box_score(sport, summary) if box is None else box
    return {"last": {"text": _text(last), "when": _when(last), "side": _side_of(last, sides)} if last else None,
            "run": current_run(sport, timeline), "quarters": quarters(summary), "leaders": leaders(sport, box),
            "lead": biggest_leads(timeline)}


def swings(sport, summary, most=3) -> list:
    """The plays that moved the win chance most, in game order: {at (seconds
    into the game), home (the chance after), delta (home's change), side
    (who it helped), text, when}. The jump to 0 or 100% at the final buzzer
    isn't a play."""
    # Walked in the game's play order: ESPN's win probability list isn't
    # always in it (the Nov 8 check: a substitution came out as a 17% swing).
    chance_of = {str(point.get("playId")): gp._num(point.get("homeWinPercentage")) for point in (summary or {}).get("winprobability") or []}
    timed = []
    for play in plays(summary):
        chance = chance_of.get(str(play.get("id")))
        at = _elapsed(sport, play) if chance is not None else None
        if at is not None:
            timed.append((at, chance, play))
    moves = sorted(((abs(after - before), at, after, after - before, play)
                    for (_a, before, _p), (at, after, play) in zip(timed, timed[1:])
                    if 0.001 < after < 0.999), key=lambda move: -move[0])
    picked = []
    for size, at, after, delta, play in moves:
        if size < SWING_MIN or len(picked) >= most:
            break
        if any(abs(at - other["at"]) < SWING_APART[sport] for other in picked) or not _text(play):
            continue
        picked.append({"at": round(at, 1), "home": round(after, 4), "delta": round(delta, 4), "side": "home" if delta > 0 else "away",
                       "text": _text(play, 120), "when": _when(play)})
    return sorted(picked, key=lambda swing: swing["at"])


def stretches(sport, length) -> list:
    quarter, extra = gp.PERIODS[sport]
    regular, overtime = STRETCH[sport]
    edges = list(range(0, 4 * quarter, regular)) + [4 * quarter + step for step in range(0, max(0, int(length) - 4 * quarter), overtime)]
    return [(start, min(edges[index + 1] if index + 1 < len(edges) else length, length)) for index, start in enumerate(edges)]


def momentum(sport, summary, length=None, now=None) -> list:
    """[{start, end, home, away}]: the points each team scored in each
    stretch of the game so far (NBA three minutes, NFL five)."""
    clock = None
    if length is None or now is None:
        clock = gp.game_clock_series(sport, summary)
        if not clock:
            return []
        length, now = clock["length"], clock["now"]
    if now is None:
        return []
    timeline = [entry for entry in score_timeline(sport, plays(summary)) if entry[0] is not None]
    out = [{"start": start, "end": end, "home": 0, "away": 0} for start, end in stretches(sport, length) if start < now or start == 0]

    def score_before(moment):
        """The score after the last play (in play order) before `moment`: a
        score ESPN shows and then corrects (Nov 8: an NFL stretch strip
        added up to 34 for a final 33) counts as corrected."""
        found = (0, 0)
        for at, home, away in timeline:
            if at < moment:
                found = (home, away)
        return found
    final = timeline[-1][1:] if timeline else (0, 0)
    for index, stretch in enumerate(out):
        start = score_before(stretch["start"])
        end = final if index == len(out) - 1 else score_before(stretch["end"])
        stretch["home"], stretch["away"] = max(0, end[0] - start[0]), max(0, end[1] - start[1])
    return out


# ------------------------------------------------------------------ the prop tracker

def _sum(*keys):
    return lambda stats: sum(gp._num(stats.get(key)) or 0 for key in keys)


def _fantasy(stats):
    """PrizePicks' NBA fantasy score: points 1, rebounds 1.2, assists 1.5,
    blocks and steals 3 each, turnovers -1."""
    value = lambda key: gp._num(stats.get(key)) or 0
    return round(value("pts") + 1.2 * value("reb") + 1.5 * value("ast") + 3 * (value("blk") + value("stl")) - value("to"), 1)


# A PrizePicks stat (line_moves.norm) -> (what the page calls it, the count from a box score line).
NBA_PROPS = {
    "points": ("Points", _sum("pts")), "rebounds": ("Rebounds", _sum("reb")), "assists": ("Assists", _sum("ast")),
    "3ptmade": ("3-pointers", _sum("tpm")), "ptsrebsasts": ("Pts + Reb + Ast", _sum("pts", "reb", "ast")),
    "ptsrebs": ("Pts + Reb", _sum("pts", "reb")), "ptsasts": ("Pts + Ast", _sum("pts", "ast")), "rebsasts": ("Reb + Ast", _sum("reb", "ast")),
    "blockedshots": ("Blocks", _sum("blk")), "steals": ("Steals", _sum("stl")), "blksstls": ("Blocks + Steals", _sum("blk", "stl")),
    "turnovers": ("Turnovers", _sum("to")), "fantasyscore": ("Fantasy score", _fantasy),
    "freethrowsmade": ("Free throws made", _sum("ftm")), "fgmade": ("Field goals made", _sum("fgm")),
    "fieldgoalsmade": ("Field goals made", _sum("fgm")), "fgattempted": ("Field goals tried", _sum("fga")),
    "3ptattempted": ("3-pointers tried", _sum("tpa")), "offensiverebounds": ("Offensive rebounds", _sum("oreb")),
    "defensiverebounds": ("Defensive rebounds", _sum("dreb")), "personalfouls": ("Fouls", _sum("pf")),
    "twopointersmade": ("2-pointers", lambda stats: (gp._num(stats.get("fgm")) or 0) - (gp._num(stats.get("tpm")) or 0)),
}
# An NFL market (backend/sports/nfl/markets.market_for) -> (its name, the count from nflverse's columns).
NFL_PROPS = {
    "passing_yards": ("Pass yards", _sum("passing_yards")), "passing_touchdowns": ("Pass TDs", _sum("passing_tds")),
    "passing_attempts": ("Pass attempts", _sum("attempts")), "pass_completions": ("Completions", _sum("completions")),
    "interceptions": ("Interceptions", _sum("passing_interceptions")), "rushing_yards": ("Rush yards", _sum("rushing_yards")),
    "rush_attempts": ("Rush attempts", _sum("carries")), "receptions": ("Receptions", _sum("receptions")),
    "receiving_yards": ("Receiving yards", _sum("receiving_yards")), "targets": ("Targets", _sum("targets")),
    "rushing_receiving_yards": ("Rush + rec yards", _sum("rushing_yards", "receiving_yards")),
    "passing_rushing_yards": ("Pass + rush yards", _sum("passing_yards", "rushing_yards")),
    "touchdowns": ("Rush + rec TDs", _sum("rushing_tds", "receiving_tds")),
}
SUFFIXES = ("jr", "sr", "iii", "ii", "iv", "v")


def person_key(name) -> str:
    """A name as one key, its Jr./III dropped (the books and ESPN don't always agree on it)."""
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower().replace("'", "")
    parts = re.findall(r"[a-z0-9]+", text)
    if len(parts) > 1 and parts[-1] in SUFFIXES:
        parts = parts[:-1]
    return "".join(parts)


def _prop_kind(sport, stat):
    if sport == "nba":
        return NBA_PROPS.get(stat)
    try:
        from backend.sports.nfl.markets import market_for
    except Exception:  # noqa: BLE001
        return None
    return NFL_PROPS.get(market_for(stat) or "")


def prop_lines(sport, starts_at) -> dict:
    """{"player|stat": line} line_archive.py kept for the game's day (names
    and stats in line_moves.norm form)."""
    start = gp._when(starts_at)
    if not start:
        return {}
    import line_archive
    import line_moves
    day = line_archive.day_of(start.timestamp())
    return gp._kept(f"props:{sport}:{day}", PROP_LINES_SECONDS, lambda: line_archive.lines_on(sport, day, line_moves._pipeline))


def props(sport, box, lines) -> list:
    """Each prop line of a player in this game, what he has so far: {name,
    short, side, headshot, stat, line, now, minutes}, the closest to (or
    past) its line first."""
    people = {}
    for side, players in box.items():
        for person in players:
            if person.get("out"):
                continue
            for key in {person_key(person["name"]), re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", person["name"]).encode("ascii", "ignore").decode().lower())}:
                people.setdefault(key, (side, person))
    rows = []
    for field, line in (lines or {}).items():
        name, _, stat = field.partition("|")
        found = people.get(name) or next((people[name[:-len(suffix)]] for suffix in SUFFIXES if name.endswith(suffix) and name[:-len(suffix)] in people), None)
        kind = _prop_kind(sport, stat) if found else None
        if not kind or line is None:
            continue
        side, person = found
        label, count = kind
        rows.append({"name": person["name"], "short": person["short"], "side": side, "headshot": person.get("headshot"), "stat": label,
                     "line": line, "now": round(count(person["stats"]), 1),
                     "minutes": gp._num(person["stats"].get("min")) if sport == "nba" else None})
    rows.sort(key=lambda row: (-(row["now"] / row["line"] if row["line"] else 1), row["name"], row["stat"]))
    return rows[:PROPS_MOST]


# ------------------------------------------------------------------ for the chart, and the games list

def extras(sport, summary, starts_at=None, clock=None) -> dict:
    """The chart's live parts, each on its own: one that can't be worked out
    is left out, the rest stand."""
    out = {}
    try:
        box = box_score(sport, summary)
    except Exception:  # noqa: BLE001
        box = {"home": [], "away": []}
    for name, work in (("feed", lambda: feed(sport, summary, box)),
                       ("swings", lambda: swings(sport, summary)),
                       ("momentum", lambda: momentum(sport, summary, *((clock["length"], clock["now"]) if clock else (None, None)))),
                       ("props", lambda: props(sport, box, prop_lines(sport, starts_at)))):
        try:
            out[name] = work()
        except Exception:  # noqa: BLE001 -- the chart stands without it
            out[name] = None
    return out


def spark(sport, summary, most=LIST_POINTS) -> dict | None:
    """{points [[seconds into the game, home chance]], length}: the game's
    chance line cut to a few dozen points."""
    clock = gp.game_clock_series(sport, summary)
    if not clock:
        return None
    points = clock["points"]
    step = max(1, -(-len(points) // most))
    kept = points[::step]
    if kept[-1] != points[-1]:
        kept.append(points[-1])
    return {"points": kept, "length": clock["length"]}


def live_list(sport, now=None) -> dict:
    """The games on now and just ended, for the games list (Nov 8, the owner:
    live games at the top with the score, the time left and a small line of
    the win chance): {games [{id, state, detail, home {score}, away {score},
    spark}]}. Read every 15 seconds at most (the slate is kept 5 minutes)."""
    if sport not in gp.SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)

    def load():
        if sport == "nba":
            # A late tip runs past midnight in the East: yesterday's games too until morning.
            days = sorted({gp._us_day(now - timedelta(hours=6)), gp._us_day(now)})
            events = []
            for day in days:
                events += gp._espn(sport, "/scoreboard", {"dates": day, "limit": 100}).get("events") or []
        else:
            events = gp._espn(sport, "/scoreboard").get("events") or []
        return [gp._event(sport, event) for event in events]

    games = gp._kept(f"scores:{sport}:{gp._us_day(now)}", LIST_SECONDS, load)
    on = [game for game in games if game["state"] == "in"][:16]

    def one(game):
        try:
            summary = gp._kept(f"spark:{sport}:{game['id']}", LIST_SECONDS, lambda: gp._espn(sport, "/summary", {"event": game["id"]}))
            return game["id"], spark(sport, summary)
        except Exception:  # noqa: BLE001 -- the score shows without its line
            return game["id"], None

    with ThreadPoolExecutor(max_workers=8) as pool:
        lines = dict(pool.map(one, on)) if on else {}
    score = lambda game, side: {"score": (game.get(side) or {}).get("score")}
    return {"sport": sport, "games": [{"id": game["id"], "state": game["state"], "detail": game["detail"],
                                       "home": score(game, "home"), "away": score(game, "away"), "spark": lines.get(game["id"])}
                                      for game in games if game["state"] in ("in", "post")],
            "fetchedAt": now.isoformat()}
