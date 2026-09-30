"""The matchup behind each moneyline: everything about the two teams that
the odds alone don't show, read from free sources, each turned into a small,
capped change to our expected margin (moneyline_model.read_game).

ESPN's game page (one request per game) gives the matchup itself: ESPN's own
win-probability model, each team's last five games, this season's
head-to-head, the injury report, each team's statistical leaders and its
home and road records. Each league adds what matters most to it:

* NFL -- rest days and five seasons of meetings (nflverse, via the ratings).
* MLB -- tonight's starters (mlb_context), each bullpen's work over the
  last three days (MLB's box scores) and each lineup against the starter's
  hand (MLB's split stats).
* NHL -- each team's likely goalie against its usual save rate (the NHL's
  stats service), second nights of back-to-backs.
* WNBA -- back-to-backs, and stars on the injury report.

Every adjustment is in the league's own unit (points, runs, goals), positive
favoring the home team, pulled toward nothing on thin samples and capped. The
market already knows most of this; the point is that our ratings know it too,
so they don't argue with a price for a reason the price already has.
"""
from __future__ import annotations

import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

ESPN = "https://site.api.espn.com/apis/site/v2/sports"
CONTEXT_FRESH = 20 * 60
_memory: dict = {}

# Caps on each adjustment, in each league's unit.
CAPS = {
    "form": {"nfl": 2.5, "mlb": 0.35, "nhl": 0.3, "wnba": 3.0},
    "splits": {"nfl": 1.5, "mlb": 0.2, "nhl": 0.15, "wnba": 2.0},
    "rest": {"nfl": 2.0, "mlb": 0.0, "nhl": 0.25, "wnba": 2.0},
    "injuries": {"nfl": 7.0, "mlb": 0.3, "nhl": 0.4, "wnba": 6.0},
    "h2h": {"nfl": 1.0, "mlb": 0.15, "nhl": 0.1, "wnba": 1.5},
}
# What a missing leader costs, by the stat he leads.
LEADER_VALUE = {
    "nfl": {"passingyards": 5.5, "rushingyards": 0.8, "receivingyards": 0.8},
    "wnba": {"points": 3.5, "rebounds": 1.5, "assists": 1.5},
    "nhl": {"points": 0.2, "goals": 0.12, "assists": 0.08},
    "mlb": {"homeruns": 0.1, "battingaverage": 0.08, "rbis": 0.08},
}
# How much of a player each report status takes away.
STATUS_SHARE = {"out": 1.0, "injured reserve": 1.0, "suspension": 1.0, "doubtful": 0.75, "questionable": 0.25, "day-to-day": 0.3}


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _number(value):
    try:
        number = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _time(value):
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _key(value):
    return "".join(char for char in str(value or "").lower() if char.isalnum())


def cap(value, limit):
    return max(-limit, min(limit, value))


def kept(name, ttl, loader):
    """`loader()`'s answer, kept in this instance's memory and the shared
    store (moneyline_model's) for `ttl` seconds, so a fresh server doesn't
    fetch it all again."""
    cached = _memory.get(name)
    if cached and time.time() - cached[0] < ttl:
        return cached[1]
    import moneyline_model
    stored = moneyline_model._load(f"ctx:{name}")
    if stored and time.time() - stored.get("at", 0) < ttl:
        _memory[name] = (stored["at"], stored.get("value"))
        return stored.get("value")
    value = loader()
    if value is None:
        # A failed read is asked again in two minutes, and never shared.
        _memory[name] = (time.time() - ttl + 120, None)
        return None
    _memory[name] = (time.time(), value)
    moneyline_model._save(f"ctx:{name}", {"at": time.time(), "value": value}, ex=int(ttl) + 60)
    return value


# ---------------------------------------------------------------- ESPN's game page

def record_pct(summary):
    """"10-6" / "10-6-2" (NHL overtime losses count as losses) as a win share and games."""
    parts = [_number(part) for part in str(summary or "").split("-")]
    if len(parts) < 2 or any(part is None for part in parts):
        return None, 0
    games = sum(parts)
    return (parts[0] / games if games else None), games


def parse_summary(payload):
    """ESPN's game page, reduced to what the model and the page use, by side."""
    header = ((payload.get("header") or {}).get("competitions") or [{}])[0]
    ids, sides = {}, {}
    for team in header.get("competitors") or []:
        side = team.get("homeAway")
        info = team.get("team") or {}
        if side not in ("home", "away"):
            continue
        ids[str(info.get("id"))] = side
        records = {item.get("type"): item.get("summary") for item in team.get("record") or team.get("records") or []}
        sides[side] = {"id": str(info.get("id")), "abbr": info.get("abbreviation"), "records": records}

    def side_of(team):
        return ids.get(str((team or {}).get("id")))

    out = {"sides": sides, "predictor": None, "form": {}, "series": None, "injuries": {}, "leaders": {}}
    predictor = payload.get("predictor") or {}
    home_chance = _number((predictor.get("homeTeam") or {}).get("gameProjection"))
    away_chance = _number((predictor.get("awayTeam") or {}).get("gameProjection"))
    if home_chance is not None and away_chance is not None and home_chance + away_chance > 0:
        out["predictor"] = {"home": home_chance / (home_chance + away_chance), "away": away_chance / (home_chance + away_chance)}

    for block in payload.get("lastFiveGames") or []:
        side = side_of(block.get("team"))
        if not side:
            continue
        games = []
        for event in block.get("events") or []:
            own_id = str((block.get("team") or {}).get("id"))
            home_score, away_score = _number(event.get("homeTeamScore")), _number(event.get("awayTeamScore"))
            at_home = str(event.get("homeTeamId")) == own_id
            margin = None
            if home_score is not None and away_score is not None:
                margin = (home_score - away_score) * (1 if at_home else -1)
            games.append({"date": event.get("gameDate"), "result": event.get("gameResult"), "score": event.get("score"),
                          "opponent": (event.get("opponent") or {}).get("abbreviation"), "home": at_home, "margin": margin})
        out["form"][side] = sorted(games, key=lambda game: game.get("date") or "")

    for series in payload.get("seasonseries") or []:
        meetings = []
        for event in series.get("events") or []:
            teams = {team.get("homeAway"): team for team in event.get("competitors") or []}
            home, away = teams.get("home") or {}, teams.get("away") or {}
            if _number(home.get("score")) is None or _number(away.get("score")) is None:
                continue
            meetings.append({"date": event.get("date"), "home": (home.get("team") or {}).get("abbreviation"),
                             "away": (away.get("team") or {}).get("abbreviation"),
                             "homeScore": _number(home.get("score")), "awayScore": _number(away.get("score"))})
        out["series"] = {"summary": series.get("summary") or series.get("description"), "meetings": meetings}
        break

    for block in payload.get("injuries") or []:
        side = side_of(block.get("team"))
        if not side:
            continue
        players = []
        for item in block.get("injuries") or []:
            athlete = item.get("athlete") or {}
            status = str(item.get("status") or ((item.get("details") or {}).get("fantasyStatus") or {}).get("description") or "")
            players.append({"name": athlete.get("displayName") or athlete.get("fullName"), "status": status,
                            "position": (athlete.get("position") or {}).get("abbreviation")})
        out["injuries"][side] = [player for player in players if player["name"]]

    for block in payload.get("leaders") or []:
        side = side_of(block.get("team"))
        if not side:
            continue
        leaders = {}
        for category in block.get("leaders") or []:
            top = (category.get("leaders") or [{}])[0]
            name = (top.get("athlete") or {}).get("displayName")
            if name:
                leaders[_key(category.get("name") or category.get("displayName"))] = {
                    "name": name, "label": category.get("displayName"), "value": top.get("displayValue")}
        out["leaders"][side] = leaders
    return out


def espn_context(sport, espn_path, event_id):
    """One game's page from ESPN, parsed, kept CONTEXT_FRESH."""
    if not event_id:
        return None

    def load():
        try:
            response = requests.get(f"{ESPN}/{espn_path}/summary", params={"event": event_id}, headers={"Accept": "application/json"}, timeout=10)
            response.raise_for_status()
            return parse_summary(response.json())
        except Exception:  # noqa: BLE001 -- the game is still priced without it
            return None
    return kept(f"espn:{sport}:{event_id}", CONTEXT_FRESH, load)


def contexts(sport, espn_path, event_ids):
    ids = [event_id for event_id in dict.fromkeys(event_ids) if event_id]
    with ThreadPoolExecutor(max_workers=8) as pool:
        return dict(zip(ids, pool.map(lambda event_id: espn_context(sport, espn_path, event_id), ids)))


# ---------------------------------------------------------------- each team, from its league

# Nicknames of two words; every other club goes by its last word.
TWO_WORD = ("Red Sox", "White Sox", "Blue Jays", "Maple Leafs", "Red Wings", "Blue Jackets", "Golden Knights")
# nflverse codes ESPN's logos spell differently.
ESPN_NFL = {"LA": "lar", "WAS": "wsh"}


def nickname(name):
    name = str(name or "")
    return next((tail for tail in TWO_WORD if name.endswith(tail)), name.split(" ")[-1] if name else "")


def team_facts(sport, rated, now):
    """Each team's short name, code, logo, records (overall, home, road) and
    last five games from the league's own sources -- the same things ESPN's
    scoreboard and game page give, for any game ESPN leaves out. Keyed by
    the team's full name."""
    loaders = {"mlb": lambda: _mlb_facts(rated, now), "nfl": lambda: _nfl_facts(now),
               "nhl": lambda: _nhl_facts(rated), "wnba": _wnba_facts}
    return kept(f"facts:{sport}", 30 * 60, loaders[sport]) or {}


def _team(name, short, abbr, logo, records=None, form=None):
    return {"name": name, "short": short or nickname(name), "abbr": abbr, "logo": logo,
            "records": {key: value for key, value in (records or {}).items() if value}, "form": form or []}


def _mlb_facts(rated, now):
    """MLB: the standings (with each club's home and road records) and the
    last five finished games of every club, from one schedule read."""
    from live_props_core import mlb
    facts, by_id = {}, {}
    for name, row in (rated.get("records") or {}).items():
        logo = f"https://www.mlbstatic.com/team-logos/team-cap-on-dark/{row['id']}.svg" if row.get("id") else None
        facts[name] = _team(name, row.get("short"), row.get("abbr"), logo,
                            {"total": row.get("total"), "home": row.get("home"), "road": row.get("road")})
        by_id[row.get("id")] = name
    end = now.date()
    schedule = mlb("/schedule", {"sportId": 1, "startDate": (end - timedelta(days=14)).isoformat(), "endDate": end.isoformat()})
    games = []
    for date in schedule.get("dates") or []:
        for game in date.get("games") or []:
            if (game.get("status") or {}).get("abstractGameState") != "Final":
                continue
            home, away = (game.get("teams") or {}).get("home") or {}, (game.get("teams") or {}).get("away") or {}
            home_runs, away_runs = _number(home.get("score")), _number(away.get("score"))
            if home_runs is not None and away_runs is not None:
                games.append((game.get("gameDate") or "", home, away, home_runs, away_runs))
    for when, home, away, home_runs, away_runs in sorted(games, key=lambda game: game[0]):
        for own, other, mine, theirs, at_home in ((home, away, home_runs, away_runs, True), (away, home, away_runs, home_runs, False)):
            name = by_id.get(str((own.get("team") or {}).get("id")))
            if not name:
                continue
            opponent = facts.get(by_id.get(str((other.get("team") or {}).get("id")))) or {}
            facts[name]["form"].append({"date": when, "result": "W" if mine > theirs else "L", "score": f"{int(mine)}-{int(theirs)}",
                                        "opponent": opponent.get("abbr"), "home": at_home, "margin": mine - theirs})
    for item in facts.values():
        item["form"] = item["form"][-5:]
    return facts


def _nfl_facts(now):
    """NFL: this season's records (overall, home, road) and last five games
    from nflverse's schedule."""
    from backend.sports.nfl import finder
    season = now.year if now.month >= 3 else now.year - 1
    names = finder.team_names(season) or finder.team_names(season - 1)
    facts, tally = {}, {}
    for abbr, name in names.items():
        facts[name] = _team(name, None, abbr, f"https://a.espncdn.com/i/teamlogos/nfl/500/{ESPN_NFL.get(abbr, abbr).lower()}.png")
        tally[name] = {"total": [0, 0, 0], "home": [0, 0, 0], "road": [0, 0, 0]}
    rows = [row for row in finder.schedule_rows() if str(row.get("season")) == str(season)
            and str(row.get("game_type") or "").upper() in finder.SEASON_KIND]
    for row in sorted(rows, key=lambda row: str(row.get("gameday") or "")):
        home, away = names.get(finder.canonical_team(row.get("home_team"))), names.get(finder.canonical_team(row.get("away_team")))
        home_score, away_score = _number(row.get("home_score")), _number(row.get("away_score"))
        if not home or not away or home_score is None or away_score is None:
            continue
        for own, other, mine, theirs, at_home in ((home, away, home_score, away_score, True), (away, home, away_score, home_score, False)):
            slot = 0 if mine > theirs else 1 if mine < theirs else 2
            for key in ("total", "home" if at_home else "road"):
                tally[own][key][slot] += 1
            facts[own]["form"].append({"date": f"{row.get('gameday')}T17:00:00+00:00", "result": "WLT"[slot],
                                       "score": f"{int(mine)}-{int(theirs)}", "opponent": facts[other]["abbr"], "home": at_home,
                                       "margin": mine - theirs})
    for name, item in facts.items():
        item["form"] = item["form"][-5:]
        item["records"] = {key: f"{w}-{l}" + (f"-{t}" if t else "") for key, (w, l, t) in tally[name].items() if w + l + t}
    return facts


def _nhl_facts(rated):
    """NHL: each club's code and logo, and this season's record once it has one."""
    import nhl_research
    records = rated.get("records") or {}
    return {name: _team(name, None, abbr, nhl_research.logo(abbr), {"total": (records.get(name) or {}).get("total")})
            for abbr, name in nhl_research.TEAMS.items()}


def _wnba_facts():
    """WNBA: each club's name, code and logo from the stored season."""
    from backend.sports.wnba import league
    payload = league.stored(league.current_season()) or {}
    return {team["name"]: _team(team["name"], team.get("short"), abbr, team.get("logo"))
            for abbr, team in (payload.get("teams") or {}).items() if team.get("name")}


def fill(game, espn, page, facts):
    """The game as ESPN has it (scoreboard `espn`, game page `page`), with
    whatever ESPN left out filled from the league's own sources (`facts`)."""
    import moneyline_model
    espn, context = dict(espn or {}), dict(page or {})
    sides, form = dict(context.get("sides") or {}), dict(context.get("form") or {})
    for side in ("home", "away"):
        name = game[f"{side}Name"]
        fact = next((item for full, item in facts.items() if moneyline_model.same_team(name, full, item.get("short"))), None)
        if not fact:
            continue
        team = dict(espn.get(side) or {})
        for key in ("name", "short", "abbr", "logo"):
            team[key] = team.get(key) or fact.get(key)
        team["record"] = team.get("record") or fact["records"].get("total")
        espn[side] = team
        own = dict(sides.get(side) or {})
        own["abbr"] = own.get("abbr") or fact.get("abbr")
        own["records"] = {**fact["records"], **{key: value for key, value in (own.get("records") or {}).items() if value}}
        sides[side] = own
        if not form.get(side) and fact["form"]:
            form[side] = fact["form"]
    if sides:
        context["sides"], context["form"] = sides, form
    return {"espn": espn or None, "context": context or None}


# ---------------------------------------------------------------- MLB extras

def mlb_bullpens(now):
    """Each MLB team's relief innings and pitches over the last three days,
    from the box scores of its finished games."""
    return kept("mlb:bullpens", 30 * 60, lambda: _bullpens(now))


def _bullpens(now):
    from live_props_core import mlb
    end = (now - timedelta(hours=10)).date()
    start = end - timedelta(days=2)
    schedule = mlb("/schedule", {"sportId": 1, "startDate": start.isoformat(), "endDate": end.isoformat()})
    games = [game.get("gamePk") for date in schedule.get("dates") or [] for game in date.get("games") or []
             if ((game.get("status") or {}).get("abstractGameState") == "Final")]

    def box(game_pk):
        memo = _memory.get(f"mlb:box:{game_pk}")
        if memo:
            return memo
        try:
            value = mlb(f"/game/{game_pk}/boxscore", {})
        except Exception:  # noqa: BLE001
            return None
        _memory[f"mlb:box:{game_pk}"] = value
        return value

    usage = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for payload in pool.map(box, games):
            for team in ((payload or {}).get("teams") or {}).values():
                team_id = str((team.get("team") or {}).get("id"))
                pitchers = team.get("pitchers") or []
                row = usage.setdefault(team_id, {"innings": 0.0, "pitches": 0, "games": 0})
                row["games"] += 1
                for pitcher in pitchers[1:]:
                    stats = ((team.get("players") or {}).get(f"ID{pitcher}") or {}).get("stats", {}).get("pitching") or {}
                    innings = _number(stats.get("inningsPitched"))
                    if innings is not None:
                        whole = int(innings)
                        row["innings"] += whole + round((innings - whole) * 10) / 3
                    row["pitches"] += int(_number(stats.get("numberOfPitches") or stats.get("pitchesThrown")) or 0)
    return usage


def mlb_platoon(season):
    """Each MLB lineup's OPS against left- and right-handed pitching."""
    return kept("mlb:platoon", 6 * 3600, lambda: _platoon(season))


def _platoon(season):
    from live_props_core import mlb
    payload = mlb("/teams/stats", {"season": season, "group": "hitting", "stats": "statSplits", "sitCodes": "vl,vr", "sportIds": 1})
    splits = {}
    for block in payload.get("stats") or []:
        for split in block.get("splits") or []:
            team_id = str((split.get("team") or {}).get("id"))
            code = (split.get("split") or {}).get("code")
            ops = _number((split.get("stat") or {}).get("ops"))
            if team_id and code in ("vl", "vr") and ops is not None:
                splits.setdefault(team_id, {})["L" if code == "vl" else "R"] = ops
    return splits


# ---------------------------------------------------------------- NHL extras

def nhl_goalies():
    """Each NHL team's goalies: starts and save rate, this season (last
    season's until a team has started five games)."""
    return kept("nhl:goalies", 6 * 3600, _goalies)


def _goalies():
    import nhl_research
    season = nhl_research.season_id()
    teams = {}
    for year in (season, nhl_research.previous_season(season)):
        rows = nhl_research._stats("goalie/summary", f"seasonId={year} and gameTypeId=2", game=False) or []
        found = {}
        for row in rows:
            code = nhl_research.canonical(str(row.get("teamAbbrevs") or "").split(",")[-1].strip())
            name = nhl_research.TEAMS.get(code)
            if not name:
                continue
            found.setdefault(name, []).append({"name": row.get("goalieFullName"), "starts": _number(row.get("gamesStarted")) or 0,
                                               "savePct": _number(row.get("savePct")), "shots": _number(row.get("shotsAgainst")) or 0})
        for name, goalies in found.items():
            if name not in teams or sum(goalie["starts"] for goalie in teams[name]) < 5:
                teams.setdefault(name, goalies)
    return teams


# ---------------------------------------------------------------- the factors

def factor(key, label, margin, text, detail=None):
    return {"key": key, "label": label, "margin": round(margin, 3), "text": text, "detail": detail}


def form(sport, context, ratings):
    """Recent results against the season: the last five games' average
    margin next to the season rating, a quarter of the difference."""
    out = 0.0
    parts = []
    for side, sign in (("home", 1), ("away", -1)):
        games = [game["margin"] for game in (context.get("form") or {}).get(side) or [] if finite(game.get("margin"))]
        rating = ratings.get(side)
        if len(games) < 3 or rating is None:
            continue
        recent = sum(games) / len(games)
        shift = 0.25 * (recent - rating) * len(games) / (len(games) + 2)
        out += sign * shift
        wins = sum(1 for game in (context.get("form") or {}).get(side) or [] if game.get("result") == "W")
        parts.append((side, wins, len(games), recent))
    if not parts:
        return None
    margin = cap(out, CAPS["form"][sport])
    return factor("form", "Recent form", margin, None, {"teams": {side: {"wins": wins, "games": games, "margin": recent} for side, wins, games, recent in parts}})


def splits(sport, context, sd):
    """Home record at home, road record on the road, against their overall."""
    sides = context.get("sides") or {}
    home, away = sides.get("home") or {}, sides.get("away") or {}
    overall_home, games_home = record_pct((home.get("records") or {}).get("total"))
    at_home, n_home = record_pct((home.get("records") or {}).get("home"))
    overall_away, games_away = record_pct((away.get("records") or {}).get("total"))
    on_road, n_road = record_pct((away.get("records") or {}).get("road"))
    edge = 0.0
    if overall_home is not None and at_home is not None and n_home >= 3:
        edge += (at_home - overall_home) * n_home / (n_home + 10)
    if overall_away is not None and on_road is not None and n_road >= 3:
        edge += (overall_away - on_road) * n_road / (n_road + 10)
    if not edge:
        return None
    margin = cap(0.75 * sd * edge, CAPS["splits"][sport])
    return factor("splits", "Home and road", margin, None, {"home": (home.get("records") or {}).get("home"),
                                                             "road": (away.get("records") or {}).get("road")})


def rest(sport, context, starts, names):
    """Days since each team last played: a back-to-back's second night (NHL,
    WNBA), extra rest (NFL, when nflverse doesn't say)."""
    if sport == "mlb" or not starts:
        return None
    days = {}
    for side in ("home", "away"):
        games = (context.get("form") or {}).get(side) or []
        last = _time(games[-1]["date"]) if games else None
        if last:
            days[side] = (starts - last).total_seconds() / 86400
    if len(days) < 2:
        return None
    if sport in ("nhl", "wnba"):
        penalty = {"nhl": 0.2, "wnba": 1.5}[sport]
        tired = {side for side, value in days.items() if value < 1.6}
        if not tired or len(tired) == 2:
            return None
        side = next(iter(tired))
        return factor("rest", "Rest", penalty if side == "away" else -penalty, f"{names[side]} on the second night of a back-to-back",
                      {"tired": side})
    gap = days["home"] - days["away"]
    if abs(gap) < 2:
        return None
    rested = "home" if gap > 0 else "away"
    return factor("rest", "Rest", cap(0.3 * gap, CAPS["rest"][sport]), f"{names[rested]} have {round(abs(gap))} more days of rest")


def injuries(sport, context, names):
    """Each team's statistical leaders on the injury report: what a missing
    leader costs, by the stat he leads, times how likely he sits."""
    values = LEADER_VALUE.get(sport) or {}
    total, notes, listed = 0.0, [], {}
    for side, sign in (("home", -1), ("away", 1)):
        report = {_key(player["name"]): player for player in (context.get("injuries") or {}).get(side) or []}
        leaders = (context.get("leaders") or {}).get(side) or {}
        counted = set()
        cost = 0.0
        for category, value in values.items():
            leader = leaders.get(category)
            if not leader:
                continue
            player = report.get(_key(leader["name"]))
            share = STATUS_SHARE.get(str((player or {}).get("status") or "").lower(), 0)
            if not share or _key(leader["name"]) in counted:
                continue
            counted.add(_key(leader["name"]))
            cost += value * share
            notes.append(f"{leader['name']} ({player['status']}) leads {names[side]} in {str(leader.get('label') or category).lower()}")
        total += sign * cost
        listed[side] = [player for player in (context.get("injuries") or {}).get(side) or []
                        if str(player.get("status") or "").lower() in ("out", "doubtful", "injured reserve", "questionable", "day-to-day", "suspension")][:5]
    if not total:
        return None
    return factor("injuries", "Injuries", cap(total, CAPS["injuries"][sport]), "; ".join(notes))


def head_to_head(sport, meetings, home_name, expected):
    """This matchup's recent meetings, home side's margin against what the
    ratings expect -- a tenth of it, since a handful of games says little."""
    margins = []
    for meeting in meetings or []:
        if not finite(meeting.get("homeScore")) or not finite(meeting.get("awayScore")):
            continue
        at_home = meeting.get("homeName") == home_name or meeting.get("homeIsHome") is True
        margins.append((meeting["homeScore"] - meeting["awayScore"]) * (1 if at_home else -1))
    if len(margins) < 2 or expected is None:
        return None
    average = sum(margins) / len(margins)
    margin = cap(0.1 * (average - expected) * len(margins) / (len(margins) + 5), CAPS["h2h"][sport])
    return factor("h2h", "Head to head", margin, None) if abs(margin) >= 0.01 else None


def bullpen(usage, home_id, away_id, names):
    """A bullpen that has thrown more than the league's usual over three days
    gives up more late: 0.035 runs per extra inning, at most a quarter run."""
    if not usage or home_id not in usage or away_id not in usage:
        return None
    league = sum(row["innings"] for row in usage.values()) / len(usage)
    effects = {side: cap(-0.035 * (usage[team]["innings"] - league), 0.25) for side, team in (("home", home_id), ("away", away_id))}
    margin = effects["home"] - effects["away"]
    if abs(margin) < 0.02:
        return None
    tired = "home" if effects["home"] < effects["away"] else "away"
    team = home_id if tired == "home" else away_id
    owner = f"{names[tired]}'" if names[tired].endswith("s") else f"{names[tired]}'s"
    return factor("bullpen", "Bullpens", margin, f"{owner} bullpen threw {usage[team]['innings']:.1f} innings the last three days (league {league:.1f})")


def platoon(splits_by_team, hitting, probables, home_id, away_id, names):
    """Each lineup against the starter's hand: its OPS against that hand next
    to its overall, over the starter's share of the game (about 60%)."""
    effects, notes = {}, []
    for side, team, opponent in (("home", home_id, away_id), ("away", away_id, home_id)):
        hand = (probables.get(opponent) or {}).get("hand")
        vs = (splits_by_team.get(team) or {}).get(hand)
        overall = (hitting.get(team) or {}).get("ops")
        runs = (hitting.get(team) or {}).get("runsPerGame") or 4.4
        if not hand or not finite(vs) or not finite(overall) or not overall:
            continue
        effects[side] = cap((vs / overall - 1) * runs * 0.6, 0.35)
        notes.append(f"{names[side]} hit {vs:.3f} OPS against {'lefties' if hand == 'L' else 'righties'} ({overall:.3f} overall)".replace("0.", "."))
    if len(effects) < 2:
        return None
    margin = effects["home"] - effects["away"]
    return factor("platoon", "Lineups vs starters", margin, "; ".join(notes)) if abs(margin) >= 0.02 else None


def goalie(goalies, home_name, away_name, back_to_back, names):
    """Each NHL team's likely goalie (the one with the most starts, the other
    on a back-to-back's second night) against the team's usual save rate,
    over thirty shots, his rate pulled toward the team's by 600 shots."""
    effects, notes = {}, []
    for side, team in (("home", home_name), ("away", away_name)):
        pool = sorted([goalie for goalie in goalies.get(team) or [] if finite(goalie.get("savePct"))], key=lambda goalie: -goalie["starts"])
        if not pool:
            continue
        shots = sum(goalie["shots"] for goalie in pool) or 1
        team_rate = sum(goalie["savePct"] * goalie["shots"] for goalie in pool) / shots
        likely = pool[1] if back_to_back.get(side) and len(pool) > 1 else pool[0]
        rate = (likely["savePct"] * likely["shots"] + team_rate * 600) / (likely["shots"] + 600)
        effects[side] = cap((rate - team_rate) * 30, 0.3)
        notes.append({"side": side, "name": likely["name"], "savePct": likely["savePct"], "backup": likely is not pool[0]})
    if len(effects) < 2:
        return None
    margin = effects["home"] - effects["away"]
    text = " vs ".join(f"{note['name']} ({note['savePct']:.3f}{', likely backup' if note['backup'] else ''})".replace("(0.", "(.") for note in notes)
    return factor("goalies", "Likely goalies", margin, f"Likely goalies: {text}", {"goalies": notes})
