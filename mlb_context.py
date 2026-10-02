"""Today's MLB matchups for the Smart Slip: each team's probable starter
with his season line, every team's season hitting and pitching, and the
league's averages to hold them against. All of it from MLB's own stats
service (live_props_core.mlb); nothing here is estimated.

A hitter's line is judged against the pitcher he faces (his WHIP, K/9,
BB/9, HR/9); a pitcher's against the lineup he faces (its strikeout and
walk rates, average and runs per game). src/slip-analyst.js does the
judging; this only gathers the numbers.
"""
from concurrent.futures import ThreadPoolExecutor

from live_props_core import cached, mlb
from backend.vortextime import vortex_board_day

# Refreshed this often: probable starters change through the day.
TTL = 30 * 60


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


def build(schedule, people, team_hitting, team_pitching):
    """The matchup payload from MLB's four answers (schedule with probable
    pitchers, those pitchers' season lines, every team's hitting and
    pitching)."""
    hitting = {split["team"]["id"]: {"name": split["team"].get("name"), **hitting_line(split.get("stat") or {})}
               for split in _team_splits(team_hitting)}
    pitching = {split["team"]["id"]: pitcher_line(split.get("stat") or {}) for split in _team_splits(team_pitching)}
    lines = {}
    for person in people.get("people", []):
        season = [split.get("stat") or {} for block in person.get("stats", []) for split in block.get("splits", [])]
        lines[person.get("id")] = {"id": person.get("id"), "name": person.get("fullName"),
                                   "hand": (person.get("pitchHand") or {}).get("code"),
                                   **pitcher_line(season[0] if season else {})}
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
            for side, team_id in ((home, ids[0]), (away, ids[1])):
                pitcher = (side.get("probablePitcher") or {}).get("id")
                if team_id and pitcher and team_id not in probables:
                    probables[team_id] = lines.get(pitcher) or {"id": pitcher, "name": side["probablePitcher"].get("fullName")}
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
                                   "hydrate": f"stats(group=[pitching],type=[season],season={season})"})

        def teams(group):
            return mlb("/teams/stats", {"season": season, "group": group, "stats": "season", "sportIds": 1})

        with ThreadPoolExecutor(max_workers=3) as pool:
            found = pool.submit(people)
            hitting = pool.submit(teams, "hitting")
            pitching = pool.submit(teams, "pitching")
            payload = build(schedule, found.result(), hitting.result(), pitching.result())
        return {**payload, "day": day, "season": season}

    return cached(("mlb-context", day), TTL, load)
