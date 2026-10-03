"""Today's MLB matchups for the Smart Slip: each team's probable starter
with his season line, every team's season hitting and pitching, and the
league's averages to hold them against. All of it from MLB's own stats
service (live_props_core.mlb); nothing here is estimated.

On top of the season lines: how each lineup hits against left- and
right-handed pitching, how it has hit over the last ten days (hot or
cold), where it ranks (1-30) in each, and each starter's recent starts --
how deep he has gone, his pitch counts, and what he did against today's
opponent -- with the innings he projects for from those.

A hitter's line is judged against the pitcher he faces (his WHIP, K/9,
BB/9, HR/9); a pitcher's against the lineup he faces (its strikeout and
walk rates, average and runs per game). src/slip-analyst.js does the
judging; this only gathers the numbers.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import date as Date, timedelta

from live_props_core import cached, mlb
from backend.vortextime import vortex_board_day

# Refreshed this often: probable starters change through the day.
TTL = 30 * 60
# "Hot or cold" is the last this many days.
RECENT_DAYS = 10
# Starts behind a starter's recent workload.
RECENT_STARTS = 5


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number not in (float("inf"), float("-inf")) else None


def innings(value):
    """MLB writes innings as whole.outs: "180.1" is 180 and a third."""
    number = _number(value)
    if number is None:
        return None
    whole = int(number)
    return whole + round((number - whole) * 10) / 3


def _rate(part, whole, digits=4):
    part, whole = _number(part), _number(whole)
    return round(part / whole, digits) if part is not None and whole else None


def _per_nine(count, pitched):
    count = _number(count)
    return round(count * 9 / pitched, 2) if count is not None and pitched else None


def pitcher_line(stat):
    """A pitcher's season rates from MLB's season stat line."""
    pitched = innings(stat.get("inningsPitched"))
    hits, walks = _number(stat.get("hits")), _number(stat.get("baseOnBalls"))
    return {
        "ip": round(pitched, 1) if pitched is not None else None,
        "era": _number(stat.get("era")),
        "whip": round((hits + walks) / pitched, 2) if pitched and hits is not None and walks is not None else _number(stat.get("whip")),
        "k9": _per_nine(stat.get("strikeOuts"), pitched),
        "bb9": _per_nine(stat.get("baseOnBalls"), pitched),
        "hr9": _per_nine(stat.get("homeRuns"), pitched),
        "starts": _number(stat.get("gamesStarted")),
    }


def hitting_line(stat):
    """A lineup's season rates from a team's season hitting line."""
    games = _number(stat.get("gamesPlayed"))
    return {
        "games": games,
        "kRate": _rate(stat.get("strikeOuts"), stat.get("plateAppearances")),
        "bbRate": _rate(stat.get("baseOnBalls"), stat.get("plateAppearances")),
        "hrRate": _rate(stat.get("homeRuns"), stat.get("plateAppearances")),
        "avg": _number(stat.get("avg")),
        "ops": _number(stat.get("ops")),
        "runsPerGame": round(_number(stat.get("runs")) / games, 2) if games and _number(stat.get("runs")) is not None else None,
    }


def _team_splits(payload):
    return [split for block in payload.get("stats", []) for split in block.get("splits", [])
            if (split.get("team") or {}).get("id")]


def _league(values):
    present = [value for value in values if value is not None]
    return round(sum(present) / len(present), 4) if present else None


def _league_line(lines):
    lines = [line for line in lines if line]
    return {key: _league(line.get(key) for line in lines)
            for key in ("kRate", "bbRate", "hrRate", "avg", "ops", "runsPerGame")} if lines else None


def _rank(lines, key):
    """Rank each line's `key` among the teams, 1 the highest."""
    present = sorted((line for line in lines if line and line.get(key) is not None), key=lambda line: -line[key])
    for place, line in enumerate(present, 1):
        line[key + "Rank"] = place


def _blocks(person):
    """A person's stat blocks by type; an untyped block is the season line."""
    found = {}
    for block in person.get("stats", []) or []:
        kind = ((block.get("type") or {}).get("displayName") or "season").lower()
        found.setdefault(kind, []).extend(block.get("splits", []) or [])
    return found


def recent_starts(log, opponent=None):
    """A starter's workload from his game log: his last starts (innings,
    pitches, strikeouts), how deep he has gone on average, and his starts
    against `opponent` this season."""
    starts = []
    for split in log:
        stat = split.get("stat") or {}
        pitched = innings(stat.get("inningsPitched"))
        if pitched is None or not (_number(stat.get("gamesStarted")) or 0) >= 1:
            continue
        starts.append({"date": str(split.get("date") or "")[:10] or None,
                       "opponent": (split.get("opponent") or {}).get("id"),
                       "home": split.get("isHome") if isinstance(split.get("isHome"), bool) else None,
                       "ip": round(pitched, 2), "k": _number(stat.get("strikeOuts")),
                       "pitches": _number(stat.get("numberOfPitches") or stat.get("pitchesThrown")),
                       "er": _number(stat.get("earnedRuns"))})
    starts.sort(key=lambda start: start["date"] or "")
    last = starts[-RECENT_STARTS:]
    out = {"starts": last,
           "recentIp": round(sum(start["ip"] for start in last) / len(last), 2) if last else None,
           "recentPitches": _league(start["pitches"] for start in last)}
    if opponent is not None:
        faced = [start for start in starts if start["opponent"] == opponent]
        if faced:
            out["vsOpponent"] = {"starts": len(faced), "ip": round(sum(start["ip"] for start in faced), 2),
                                 "k": sum(start["k"] or 0 for start in faced),
                                 "er": sum(start["er"] or 0 for start in faced)}
    return out


def projected_innings(line):
    """How deep a starter should go: his last starts, weighted toward his
    season's innings per start (a short recent sample says less)."""
    season = line.get("ip") / line["starts"] if line.get("ip") and line.get("starts") else None
    recent, count = line.get("recentIp"), len(line.get("lastStarts") or [])
    if recent is None and season is None:
        return None
    if recent is None or season is None:
        return round(recent if season is None else season, 1)
    weight = count / (count + 3)
    return round(weight * recent + (1 - weight) * season, 1)


def build(schedule, people, team_hitting, team_pitching, splits=None, recent=None):
    """The matchup payload from MLB's answers: the schedule with probable
    pitchers, those pitchers' season lines and game logs, every team's
    hitting and pitching, and (when MLB gave them) each team's hitting
    against left- and right-handers and over the last ten days."""
    hitting = {split["team"]["id"]: {"name": split["team"].get("name"), **hitting_line(split.get("stat") or {})}
               for split in _team_splits(team_hitting)}
    pitching = {split["team"]["id"]: pitcher_line(split.get("stat") or {}) for split in _team_splits(team_pitching)}
    # Against each hand (MLB's statSplits: vl / vr) and lately (byDateRange).
    for split in _team_splits(splits or {}):
        code = ((split.get("split") or {}).get("code") or "").lower()
        team = hitting.get(split["team"]["id"])
        if team is not None and code in ("vl", "vr"):
            team.setdefault("vs", {})["L" if code == "vl" else "R"] = hitting_line(split.get("stat") or {})
    for split in _team_splits(recent or {}):
        team = hitting.get(split["team"]["id"])
        if team is not None:
            team["recent"] = hitting_line(split.get("stat") or {})
    lineups = list(hitting.values())
    for key in ("kRate", "ops", "runsPerGame"):
        _rank(lineups, key)
        _rank([team.get("recent") for team in lineups], key)
        for hand in ("L", "R"):
            _rank([(team.get("vs") or {}).get(hand) for team in lineups], key)
    lines, logs = {}, {}
    for person in people.get("people", []):
        blocks = _blocks(person)
        season = [split.get("stat") or {} for split in blocks.get("season", [])]
        lines[person.get("id")] = {"id": person.get("id"), "name": person.get("fullName"),
                                   "hand": (person.get("pitchHand") or {}).get("code"),
                                   **pitcher_line(season[0] if season else {})}
        logs[person.get("id")] = blocks.get("gamelog", [])
    probables, games = {}, []
    for date in schedule.get("dates", []):
        for game in date.get("games", []):
            teams = game.get("teams") or {}
            home, away = (teams.get("home") or {}), (teams.get("away") or {})
            ids = (home.get("team") or {}).get("id"), (away.get("team") or {}).get("id")
            starters = {}
            for key, side in (('home', home), ('away', away)):
                probable = side.get('probablePitcher') or {}
                starters[key] = lines.get(probable.get('id')) or ({'id': probable['id'], 'name': probable.get('fullName')} if probable.get('id') else None)
            games.append({"gameId": game.get("gamePk"), "home": ids[0], "away": ids[1], "startTime": game.get("gameDate"), 'starters': starters})
            for side, team_id, opponent in ((home, ids[0], ids[1]), (away, ids[1], ids[0])):
                pitcher = (side.get("probablePitcher") or {}).get("id")
                if team_id and pitcher and team_id not in probables:
                    line = dict(lines.get(pitcher) or {"id": pitcher, "name": side["probablePitcher"].get("fullName")})
                    if logs.get(pitcher):
                        work = recent_starts(logs[pitcher], opponent)
                        line.update({"lastStarts": work["starts"], "recentIp": work["recentIp"],
                                     "recentPitches": work["recentPitches"]})
                        if work.get("vsOpponent"):
                            line["vsOpponent"] = work["vsOpponent"]
                    line["opponent"] = opponent
                    line["projectedIp"] = projected_innings(line)
                    probables[team_id] = line
    league = {
        "kRate": _league(team["kRate"] for team in hitting.values()),
        "bbRate": _league(team["bbRate"] for team in hitting.values()),
        "hrRate": _league(team["hrRate"] for team in hitting.values()),
        "avg": _league(team["avg"] for team in hitting.values()),
        "ops": _league(team["ops"] for team in hitting.values()),
        "runsPerGame": _league(team["runsPerGame"] for team in hitting.values()),
        "whip": _league(team["whip"] for team in pitching.values()),
        "k9": _league(team["k9"] for team in pitching.values()),
        "bb9": _league(team["bb9"] for team in pitching.values()),
        "hr9": _league(team["hr9"] for team in pitching.values()),
        "era": _league(team["era"] for team in pitching.values()),
        "vs": {hand: _league_line((team.get("vs") or {}).get(hand) for team in lineups) for hand in ("L", "R")},
        "recent": _league_line(team.get("recent") for team in lineups),
        "teams": len(lineups),
    }
    # Keys go out as strings: JSON object keys are strings either way.
    return {"probables": {str(key): value for key, value in probables.items()},
            "hitting": {str(key): value for key, value in hitting.items()},
            "pitching": {str(key): value for key, value in pitching.items()},
            "league": league, "games": games}


def context(day=None):
    day = day or vortex_board_day()
    season = int(day[:4])

    def load():
        schedule = mlb("/schedule", {"sportId": 1, "date": day, "hydrate": "probablePitcher"})
        pitcher_ids = sorted({side["probablePitcher"]["id"] for date in schedule.get("dates", [])
                              for game in date.get("games", []) for side in (game.get("teams") or {}).values()
                              if isinstance(side, dict) and (side.get("probablePitcher") or {}).get("id")})

        def people():
            if not pitcher_ids:
                return {"people": []}
            return mlb("/people", {"personIds": ",".join(map(str, pitcher_ids)),
                                   "hydrate": f"stats(group=[pitching],type=[season,gameLog],season={season})"})

        def teams(group):
            return mlb("/teams/stats", {"season": season, "group": group, "stats": "season", "sportIds": 1})

        # The extras are worth having, not worth failing over.
        def optional(params):
            try:
                return mlb("/teams/stats", {"season": season, "group": "hitting", "sportIds": 1, **params})
            except Exception:
                return {}

        today = Date.fromisoformat(day)
        lately = {"stats": "byDateRange", "startDate": (today - timedelta(days=RECENT_DAYS)).isoformat(),
                  "endDate": (today - timedelta(days=1)).isoformat()}
        with ThreadPoolExecutor(max_workers=5) as pool:
            found = pool.submit(people)
            hitting = pool.submit(teams, "hitting")
            pitching = pool.submit(teams, "pitching")
            splits = pool.submit(optional, {"stats": "statSplits", "sitCodes": "vl,vr"})
            recent = pool.submit(optional, lately)
            payload = build(schedule, found.result(), hitting.result(), pitching.result(), splits.result(), recent.result())
        return {**payload, "day": day, "season": season}

    return cached(("mlb-context", day), TTL, load)
