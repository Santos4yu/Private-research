"""The Game Predictor: who wins an NBA or NFL game, by how much, the final
score, and where our number and the betting market disagree.

The owner, Nov 5, with another app's simple "pick a game, predict" screens:
"a crazy moneyline predictor for nfl and nba ... finds the edge with free
sources like players injuries who's playing who's out spreads ... blowout
potentials pace defense matchups for each players who has the best edge on
the team for a good game ... include a number prediction on what the bot
thinks the game will end in like 112-96".

Free sources only:
* ESPN's scoreboard and game summary: the schedule, the sportsbook line it
  carries (moneylines, spread, total), its own win projection, both injury
  reports and each team's last five.
* NBA: the stored seasons of ESPN box scores (backend/sports/wnba/league.py).
* NFL: nflverse's schedule (every final score) and its weekly player and
  team stats (backend/sports/nfl/finder.py).

How the number is made, backtested on real games (Nov 5):
* NBA, 2025-26 (979 games with their lines): each team's points scored and
  allowed per 100 possessions and its pace, this season with last season's
  worth NBA prior_games games, met the usual way (home offense against away
  defense, relative to the league), plus home court, back-to-backs, the last
  ten games' form and who is out (each missing regular's average Game Score
  over the last 20 games, times how often he had been playing in them, so a
  player out for weeks is already in the team's numbers). Alone it picked
  74% of the second half's winners (the line 73%) but missed the margin by a
  little more (11.3 points, the line 11.0); a quarter ours and three
  quarters the line did best.
* NFL, 2013-25 (3,562 games): points scored and allowed a game with last
  season's worth four games, home field, rest and a starting quarterback out
  (3.2 points). The line alone was better (66% of winners, ours 63%), so
  ours is a tenth of the final number: it matters when news (a QB ruled out)
  is newer than the line.
* The total is the line's when there is one (ours was no closer), else ours.
* Win chance: the final margin over a normal spread of finals (NBA 12.5
  points, NFL 12), calibrated on the same games; the blowout chance the same
  way (NBA by 15 or more, NFL by 14 or more).

Every prediction made before tip-off is kept (HISTORY_KEY) and settled from
ESPN's final scores, so the page shows how often it has been right, beside
how often the market's favorite was.
"""
from __future__ import annotations

import json
import math
import re
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

SPORTS = ("nba", "nfl")
ESPN = "https://site.api.espn.com/apis/site/v2/sports/"
PATHS = {"nba": "basketball/nba", "nfl": "football/nfl"}
MODELS = {
    "nba": {"scale": 0.75, "home": 1.6, "injury": 0.19, "b2b": 1.2, "form": 0.2, "ours": 0.25, "sigma": 12.5,
            "blowout": 15, "blowout_sigma": 15.0, "prior_games": 12, "prior_keep": 0.67, "pace_keep": 0.8,
            "window": 20, "regular_minutes": 12, "unit": "pts"},
    "nfl": {"scale": 1.53, "home": 2.1, "qb": 3.2, "rest": 0.1, "ours": 0.1, "sigma": 12.0,
            "blowout": 14, "blowout_sigma": 13.5, "prior_games": 4, "prior_keep": 0.5, "unit": "pts"},
}
# Listed this way, a player is out (ESPN's NBA "Day-To-Day" and the NFL's
# "Questionable" leave him in, the way the rest of the site counts).
OUT_STATUSES = ("out", "doubtful", "suspension", "suspended", "injured reserve", "ir", "pup", "nfi")
# An edge smaller than this (our win chance less the market's) is no edge.
EDGE_MIN = 0.02
SLATE_SECONDS = 5 * 60
SUMMARY_SECONDS = 5 * 60
TABLE_SECONDS = 15 * 60
HISTORY_KEY = "krazy_data:predictor:v1:history:{sport}"
PRIOR_KEY = "krazy_data:predictor:v1:nba-prior:{season}"
MAX_HISTORY = 400
# A game is settled once ESPN calls it final; asked about this long after its start.
SETTLE_AFTER = {"nba": 2.5 * 3600, "nfl": 3.5 * 3600}
# Games settled per read of the history (a summary each); the rest wait for the next.
SETTLE_MOST = 16
_memory: dict = {}


def _kept(key, seconds, load):
    """`load()` once per `seconds` per key, in this instance's memory."""
    now = time.time()
    hit = _memory.get(key)
    if hit and now - hit[0] < seconds:
        return hit[1]
    value = load()
    _memory[key] = (now, value)
    if len(_memory) > 200:
        _memory.pop(next(iter(_memory)))
    return value


def _espn(sport, path, params=None):
    response = requests.get(ESPN + PATHS[sport] + path, params=params,
                            headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=12)
    response.raise_for_status()
    return response.json()


def _num(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _when(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def phi(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def american(chance):
    """A win chance as American odds (-150, +130)."""
    if chance is None or not 0 < chance < 1:
        return None
    return round(-100 * chance / (1 - chance)) if chance >= 0.5 else round(100 * (1 - chance) / chance)


def implied(moneyline):
    if moneyline is None or abs(moneyline) < 100:
        return None
    return -moneyline / (-moneyline + 100) if moneyline < 0 else 100 / (moneyline + 100)


def _key(name) -> str:
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", text)
    return re.sub(r"[^a-z]", "", text)


def is_out(status) -> bool:
    return str(status or "").strip().lower() in OUT_STATUSES


# ------------------------------------------------------------------ the schedule

def _competitor(competitor):
    team = competitor.get("team") or {}
    records = competitor.get("records") or competitor.get("record") or []
    record = next((item.get("summary") for item in records if item.get("type") in ("total", None)), None) if isinstance(records, list) else None
    logo = team.get("logo") or next((item.get("href") for item in team.get("logos") or []), None)
    return {"abbr": team.get("abbreviation"), "name": team.get("displayName"), "short": team.get("shortDisplayName") or team.get("name"),
            "logo": logo, "color": team.get("color"), "record": record, "score": _num(competitor.get("score"))}


def _line(raw, sides):
    """A sportsbook line from ESPN (its scoreboard's odds or the summary's
    pick center): the home spread (negative: home favored), the total and
    both moneylines, with the market's win chances with the margin taken out."""
    from backend.sports.wnba import matchup
    teams = [{"side": side, "abbr": (sides.get(side) or {}).get("abbr")} for side in ("away", "home")]
    found = matchup._odds({"pickcenter": [raw]}, teams) if raw else None
    if not found:
        return None
    home, away = found.get("home") or {}, found.get("away") or {}
    # ESPN's newer scoreboard files the moneylines apart: {"moneyline": {"home": {"close": {"odds": "-300"}}}}.
    listed = raw.get("moneyline") if isinstance(raw.get("moneyline"), dict) else {}
    price = lambda side: (found.get(side) or {}).get("moneyline") if (found.get(side) or {}).get("moneyline") is not None else _price(listed.get(side))
    line = {"provider": found.get("provider"), "spread": home.get("spread"), "total": found.get("total"),
            "moneyline": {"home": price("home"), "away": price("away")}, "chance": None}
    home_p, away_p = implied(line["moneyline"]["home"]), implied(line["moneyline"]["away"])
    if home_p and away_p:
        line["chance"] = {"home": home_p / (home_p + away_p), "away": away_p / (home_p + away_p)}
    if line["spread"] is None and line["total"] is None and not line["chance"]:
        return None
    return line


def _price(entry):
    """American odds from ESPN's {"close": {"odds": "-300"}, "open": ...}; EVEN is +100."""
    for moment in ("close", "current", "open"):
        odds = str(((entry or {}).get(moment) or {}).get("odds") or "").strip().upper()
        if odds == "EVEN":
            return 100.0
        if (value := _num(odds.replace("+", ""))) is not None:
            return value
    return None


def _event(sport, event):
    competition = (event.get("competitions") or [{}])[0]
    sides = {competitor.get("homeAway"): _competitor(competitor) for competitor in competition.get("competitors") or []}
    status = ((competition.get("status") or event.get("status") or {}).get("type") or {})
    return {"id": str(event.get("id")), "sport": sport, "startsAt": event.get("date"), "state": status.get("state"),
            "detail": status.get("shortDetail") or status.get("detail"), "neutral": bool(competition.get("neutralSite")),
            "home": sides.get("home"), "away": sides.get("away"),
            "line": _line((competition.get("odds") or [None])[0], sides)}


def _us_day(moment: datetime) -> str:
    return (moment - timedelta(hours=5)).strftime("%Y%m%d")


def slate(sport, now=None) -> dict:
    """{sport, games}: the games still to start, and those on now, soonest
    first -- the NBA's today and tomorrow, the NFL's week (the next one too
    once this week's are all played)."""
    now = now or datetime.now(timezone.utc)

    def load():
        if sport == "nba":
            events = []
            for day in (_us_day(now + timedelta(days=offset)) for offset in (0, 1)):
                events += _espn(sport, "/scoreboard", {"dates": day, "limit": 100}).get("events") or []
            return [_event(sport, event) for event in events]
        # ESPN's NFL scoreboard answers a date range with 400 (Nov 5); its
        # plain scoreboard is the current week.
        board = _espn(sport, "/scoreboard")
        games = [_event(sport, event) for event in board.get("events") or []]
        week, kind = (board.get("week") or {}).get("number"), (board.get("season") or {}).get("type")
        if week and kind and not any(game["state"] == "pre" for game in games):
            try:
                games += [_event(sport, event) for event in _espn(sport, "/scoreboard", {"week": week + 1, "seasontype": kind}).get("events") or []]
            except Exception:  # noqa: BLE001 -- this week's list stands
                pass
        return games
    games = _kept(f"slate:{sport}:{_us_day(now)}", SLATE_SECONDS, load)
    games = [game for game in games if game["home"] and game["away"] and game["state"] in ("pre", "in")]
    games.sort(key=lambda game: game["startsAt"] or "")
    return {"sport": sport, "games": games, "fetchedAt": now.isoformat()}


def _summary(sport, event_id):
    """One game from ESPN's summary: teams, status, line, its projection,
    both injury reports and each team's last five."""
    from backend.sports.wnba import matchup

    def load():
        summary = _espn(sport, "/summary", {"event": event_id})
        competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
        sides = {competitor.get("homeAway"): _competitor(competitor) for competitor in competition.get("competitors") or []}
        status = (competition.get("status") or {}).get("type") or {}
        predictor = summary.get("predictor") or {}
        home_p = _num((predictor.get("homeTeam") or {}).get("gameProjection"))
        away_p = _num((predictor.get("awayTeam") or {}).get("gameProjection"))
        venue = (summary.get("gameInfo") or {}).get("venue") or {}
        return {"id": str(event_id), "sport": sport, "startsAt": competition.get("date"), "state": status.get("state"),
                "detail": status.get("shortDetail") or status.get("detail"), "neutral": bool(competition.get("neutralSite")),
                "venue": venue.get("fullName"), "home": sides.get("home"), "away": sides.get("away"),
                "line": _line((summary.get("pickcenter") or [None])[0], sides),
                "espn": {"home": home_p / 100, "away": away_p / 100} if home_p is not None and away_p is not None else None,
                "injuries": matchup._injuries(summary), "lastFive": matchup._last_five(summary)}
    return _kept(f"summary:{sport}:{event_id}", SUMMARY_SECONDS, load)


# ------------------------------------------------------------------ NBA numbers

def _gmsc(row, index) -> float:
    """Hollinger's Game Score for one box-score line."""
    v = lambda key: row[index[key]] or 0
    return (v("pts") + 0.4 * v("fgm") - 0.7 * v("fga") - 0.4 * (v("fta") - v("ftm")) + 0.7 * v("oreb") + 0.3 * v("dreb")
            + v("stl") + 0.7 * v("ast") + 0.7 * v("blk") - 0.4 * v("pf") - v("to"))


def _nba_games(payload) -> dict:
    """team -> its finished games in order: date, points, allowed, possessions, both boxes."""
    from backend.sports.wnba import context, opportunity
    out = {}
    for team, games in context.team_games(payload or {}).items():
        rows = []
        for game in games:
            own, opp = opportunity.side_totals(game["own"]), opportunity.side_totals(game["opp"])
            if not own["min"] or not opp["min"]:
                continue
            rows.append({"date": game["date"], "pts": own["pts"], "opp": opp["pts"], "poss": opportunity.possessions(own, opp),
                         "own": game["own"].get("p") or [], "against": game["opp"].get("p") or []})
        out[team] = rows
    return out


def _ratings(games: dict) -> tuple[dict, dict]:
    """({team: {ortg, drtg, pace, n}}, league {ortg, pace}) from _nba_games."""
    teams, pts, poss, count = {}, 0.0, 0.0, 0
    for team, rows in games.items():
        if not rows:
            continue
        p = sum(row["poss"] for row in rows)
        teams[team] = {"ortg": 100 * sum(row["pts"] for row in rows) / p, "drtg": 100 * sum(row["opp"] for row in rows) / p,
                       "pace": p / len(rows), "n": len(rows)}
        pts += sum(row["pts"] for row in rows)
        poss += p
        count += len(rows)
    league = {"ortg": 100 * pts / poss, "pace": poss / count} if poss else None
    return teams, league


def _nba_prior(season, load=None, store=None) -> dict | None:
    """Last season's ratings, worked out once and kept (they never change)."""
    key = PRIOR_KEY.format(season=season)
    hit = _memory.get(key)
    if hit:
        return hit[1]
    store = _store() if store is None else store
    try:
        raw = store.get(key) if store else None
        if raw:
            value = json.loads(raw)
            _memory[key] = (time.time(), value)
            return value
    except Exception:  # noqa: BLE001
        pass
    if load is None:
        from backend.sports.wnba import league
        load = lambda: league.stored(season, "nba")
    payload = load()
    if not payload or not payload.get("games"):
        return None
    teams, lg = _ratings(_nba_games(payload))
    value = {"teams": teams, "league": lg}
    _memory[key] = (time.time(), value)
    try:
        if store:
            store.set(key, json.dumps(value, separators=(",", ":")))
    except Exception:  # noqa: BLE001
        pass
    return value


def nba_tables(payload, prior) -> dict:
    """Every team's numbers for tonight: ratings and pace blended with last
    season, last-ten form, its last game's date, its regulars' values and
    what it allows each position per 36 minutes."""
    from backend.sports.wnba import context
    from backend.sports.wnba.league import FIELDS
    model = MODELS["nba"]
    index = {name: i + 2 for i, name in enumerate(FIELDS)}
    games = _nba_games(payload)
    now_teams, now_league = _ratings(games)
    prior_teams = (prior or {}).get("teams") or {}
    prior_league = (prior or {}).get("league") or now_league or {"ortg": 112.0, "pace": 99.0}
    total_games = sum(len(rows) for rows in games.values()) / 2
    league = now_league if now_league and total_games >= 60 else prior_league
    players = (payload or {}).get("players") or {}
    teams = {}
    # This season's teams once it has games (last season's list holds the
    # All-Star teams too), else last season's.
    for team in [team for team in games if games[team]] or list(prior_teams):
        rows = games.get(team) or []
        before = prior_teams.get(team)
        keep, k = model["prior_keep"], model["prior_games"]
        p_ortg = league["ortg"] + ((before["ortg"] - prior_league["ortg"]) * keep if before else 0)
        p_drtg = league["ortg"] + ((before["drtg"] - prior_league["ortg"]) * keep if before else 0)
        p_pace = league["pace"] + ((before["pace"] - prior_league["pace"]) * model["pace_keep"] if before else 0)
        poss = sum(row["poss"] for row in rows)
        weight = k * p_pace
        row = {"games": len(rows),
               "ortg": (100 * sum(r["pts"] for r in rows) + p_ortg * weight) / (poss + weight),
               "drtg": (100 * sum(r["opp"] for r in rows) + p_drtg * weight) / (poss + weight),
               "pace": (poss + k * p_pace) / (len(rows) + k),
               "lastGame": rows[-1]["date"] if rows else None, "form": None, "players": {}}
        recent = rows[-10:]
        if len(recent) >= 5:
            p = sum(r["poss"] for r in recent)
            row["form"] = 100 * (sum(r["pts"] for r in recent) - sum(r["opp"] for r in recent)) / p
            row["last10"] = [sum(1 for r in recent if r["pts"] > r["opp"]), sum(1 for r in recent if r["pts"] < r["opp"])]
        window = rows[-model["window"]:]
        apps = defaultdict(list)
        for game_index, game in enumerate(window):
            for line in game["own"]:
                minutes = line[index["min"]] or 0
                if minutes > 0:
                    apps[str(line[0])].append((game_index, minutes, _gmsc(line, index), line[index["pts"]] or 0,
                                               line[index["reb"]] or 0, line[index["ast"]] or 0))
        for pid, lines in apps.items():
            minutes = sum(line[1] for line in lines) / len(lines)
            info = players.get(pid) or ["", "", None, team]
            row["players"][pid] = {"id": pid, "name": info[0], "pos": context.primary_position(info), "headshot": context.headshot(pid, info, "nba"),
                                   "share": len(lines) / len(window), "games": len(lines), "min": minutes,
                                   "gmsc": sum(line[2] for line in lines) / len(lines),
                                   "pts": sum(line[3] for line in lines) / len(lines), "reb": sum(line[4] for line in lines) / len(lines),
                                   "ast": sum(line[5] for line in lines) / len(lines),
                                   "last5": sum(line[3] for line in lines if line[0] >= len(window) - 5) / max(1, sum(1 for line in lines if line[0] >= len(window) - 5)),
                                   "recent": any(line[0] >= len(window) - 3 for line in lines),
                                   "regular": minutes >= model["regular_minutes"] and len(lines) >= 2}
        teams[team] = row
    # What each defense allows guards, forwards and centers per 36 minutes.
    allowed = {team: {position: defaultdict(float) for position in context.POSITIONS} for team in games}
    league_allowed = {position: defaultdict(float) for position in context.POSITIONS}
    for team, rows in games.items():
        for game in rows:
            for line in game["against"]:
                position = context.primary_position(players.get(str(line[0])))
                minutes = line[index["min"]] or 0
                if not position or minutes <= 0:
                    continue
                for bucket in (allowed[team][position], league_allowed[position]):
                    bucket["min"] += minutes
                    for stat in ("pts", "reb", "ast"):
                        bucket[stat] += line[index[stat]] or 0
    per36 = lambda bucket, stat: bucket[stat] / bucket["min"] * 36 if bucket["min"] else None
    defense = {}
    for position in context.POSITIONS:
        for stat in ("pts", "reb", "ast"):
            base = per36(league_allowed[position], stat)
            column = {team: per36(allowed[team][position], stat) for team in games}
            ranked = sorted((value for value in column.values() if value is not None), reverse=True)
            for team, value in column.items():
                if value is None or not base:
                    continue
                n = len(games[team])
                defense.setdefault(team, {}).setdefault(position, {})[stat] = {
                    "per36": value, "factor": 1 + (value / base - 1) * n / (n + 10), "rank": ranked.index(value) + 1}
    return {"teams": teams, "league": league, "defense": defense, "count": len(games), "season": (payload or {}).get("season")}


def _nba_numbers(now=None):
    from backend.sports.wnba import league
    season = league.current_season(league="nba")
    payload = league.ensure(season, "nba") or {}
    built = (season, payload.get("builtAt"), len(payload.get("games") or {}))
    hit = _memory.get("nba-tables")
    if hit and hit[1][0] == built and time.time() - hit[0] < TABLE_SECONDS:
        return hit[1][1]
    prior = _nba_prior(season - 1)
    tables = nba_tables(payload, prior)
    _memory["nba-tables"] = (time.time(), (built, tables))
    return tables


def _rest_days(last, starts_at) -> int | None:
    last, start = _when(last), _when(starts_at)
    if not last or not start:
        return None
    return ((start - timedelta(hours=5)).date() - (last - timedelta(hours=5)).date()).days


def _rank_of(values: dict, team, high_first=True):
    known = sorted((value for value in values.values() if value is not None), reverse=high_first)
    value = values.get(team)
    return known.index(value) + 1 if value is not None else None


def ordinal(n) -> str:
    if n is None:
        return ""
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


POSITION_WORDS = {"G": "guards", "F": "forwards", "C": "centers"}


def nba_model(game, tables) -> dict:
    """Our own margin and total for one game, with what moved it."""
    model = MODELS["nba"]
    home, away = game["home"]["abbr"], game["away"]["abbr"]
    teams, league = tables["teams"], tables["league"]
    h, a = teams.get(home), teams.get(away)
    if not h or not a:
        return None
    poss = h["pace"] * a["pace"] / league["pace"]
    home_ppp, away_ppp = h["ortg"] * a["drtg"] / league["ortg"], a["ortg"] * h["drtg"] / league["ortg"]
    base = poss * (home_ppp - away_ppp) / 100
    total = poss * (home_ppp + away_ppp) / 100
    injuries = game.get("injuries") or {}
    lost, out = {}, {}
    for side, abbr, row in (("home", home, h), ("away", away, a)):
        lost[side], out[side] = 0.0, []
        by_name = {_key(player["name"]): player for player in row["players"].values()}
        for item in injuries.get(abbr) or []:
            player = row["players"].get(str(item.get("id") or "")) or by_name.get(_key(item.get("name")))
            entry = {"name": item.get("name"), "position": item.get("position"), "status": item.get("status"),
                     "injury": item.get("injury"), "out": is_out(item.get("status")), "impact": 0.0}
            if entry["out"] and player and player["regular"]:
                entry["impact"] = round(model["injury"] * player["share"] * player["gmsc"], 1)
                entry["min"] = round(player["min"], 1)
                entry["pts"] = round(player["pts"], 1)
                lost[side] += player["share"] * player["gmsc"]
            out[side].append(entry)
        out[side].sort(key=lambda entry: (-entry["impact"], not entry["out"]))
    rest = {"home": _rest_days(h.get("lastGame"), game["startsAt"]), "away": _rest_days(a.get("lastGame"), game["startsAt"])}
    b2b = {side: int(days is not None and days <= 1) for side, days in rest.items()}
    form = (h["form"] or 0) - (a["form"] or 0) if h.get("form") is not None and a.get("form") is not None else 0
    home_court = 0 if game.get("neutral") else model["home"]
    parts = [
        ("ratings", "Team ratings", model["scale"] * base,
         f"Net rating {h['ortg'] - h['drtg']:+.1f} vs {a['ortg'] - a['drtg']:+.1f} per 100 possessions"),
        ("home", "Home court", home_court, "Neutral floor" if game.get("neutral") else f"{home} at home"),
        ("injuries", "Who's out", model["injury"] * (lost["away"] - lost["home"]),
         ", ".join(f"{entry['name']} ({abbr}) -{entry['impact']}" for side, abbr in (("home", home), ("away", away))
                   for entry in out[side] if entry["impact"] > 0)[:160] or None),
        ("rest", "Rest", model["b2b"] * (b2b["away"] - b2b["home"]),
         " · ".join(f"{abbr} on a back-to-back" for side, abbr in (("home", home), ("away", away)) if b2b[side]) or None),
        ("form", "Last 10 games", model["form"] * form,
         f"{home} {h['form']:+.1f}, {away} {a['form']:+.1f} net per 100 lately" if form else None),
    ]
    margin = sum(part[2] for part in parts)
    total -= 0.05 * (lost["home"] + lost["away"])
    ortg = {team: row["ortg"] for team, row in teams.items() if row["games"]}
    drtg = {team: row["drtg"] for team, row in teams.items() if row["games"]}
    pace = {team: row["pace"] for team, row in teams.items() if row["games"]}
    profile = lambda abbr, row: {"ortg": [round(row["ortg"], 1), _rank_of(ortg, abbr)], "drtg": [round(row["drtg"], 1), _rank_of(drtg, abbr, high_first=False)],
                                 "pace": [round(row["pace"], 1), _rank_of(pace, abbr)], "net": round(row["ortg"] - row["drtg"], 1),
                                 "last10": row.get("last10"), "games": row["games"]}
    return {"margin": margin, "total": total, "poss": poss, "lost": lost, "out": out, "rest": rest,
            "parts": [{"key": key, "label": label, "points": round(points, 1), "text": text} for key, label, points, text in parts],
            "teams": {"home": profile(home, h), "away": profile(away, a)}, "leaguePace": league["pace"]}


def nba_players(game, tables, built) -> dict:
    """Each side's player with the best matchup tonight: his average
    points, rebounds and assists moved by what this defense allows his
    position per 36 minutes, the game's pace against his team's, and a share
    of what teammates out tonight usually score."""
    teams, defense = tables["teams"], tables["defense"]
    result = {}
    for side, other in (("home", "away"), ("away", "home")):
        abbr, opponent = game[side]["abbr"], game[other]["abbr"]
        row = teams.get(abbr) or {}
        out_names = {_key(entry["name"]) for entry in built["out"][side] if entry["out"]}
        roster = [p for p in (row.get("players") or {}).values() if p["regular"] and p["recent"] and p["min"] >= 22
                  and _key(p["name"]) not in out_names]
        lost_points = sum(p["pts"] * p["share"] for p in (row.get("players") or {}).values()
                          if p["regular"] and _key(p["name"]) in out_names)
        team_points = sum(p["pts"] for p in roster) or 1
        pace = built["poss"] / row["pace"] if row.get("pace") else 1
        best = None
        for player in roster:
            spot = (defense.get(opponent) or {}).get(player["pos"]) or {}
            boost = 0.5 * lost_points * player["pts"] / team_points
            proj = {stat: player[stat] * (spot.get(stat) or {}).get("factor", 1) * pace + (boost if stat == "pts" else 0)
                    for stat in ("pts", "reb", "ast")}
            gain = (proj["pts"] - player["pts"]) + 1.2 * (proj["reb"] - player["reb"]) + 1.5 * (proj["ast"] - player["ast"])
            if best is None or gain > best[0]:
                best = (gain, player, proj, spot, boost)
        if not best:
            continue
        gain, player, proj, spot, boost = best
        why = []
        stat = max(("pts", "reb", "ast"), key=lambda key: (spot.get(key) or {}).get("factor", 1))
        if spot.get(stat) and spot[stat]["rank"] <= 10:
            word = {"pts": "points", "reb": "rebounds", "ast": "assists"}[stat]
            why.append(f"{opponent} allows the {ordinal(spot[stat]['rank'])} most {word} to {POSITION_WORDS.get(player['pos'], 'his position')}")
        if pace >= 1.02:
            why.append(f"Faster game than usual: {built['poss']:.0f} possessions, {abbr} averages {row['pace']:.0f}")
        if boost >= 1:
            names = [entry["name"].split(" ")[-1] for entry in built["out"][side] if entry["out"] and entry["impact"] > 0][:2]
            if names:
                why.append(f"More shots with {' and '.join(names)} out")
        if player["last5"] >= player["pts"] + 3:
            why.append(f"Averaging {player['last5']:.1f} points his last 5")
        result[side] = {"id": player["id"], "name": player["name"], "position": player["pos"], "headshot": player["headshot"],
                        "team": abbr, "avg": {key: round(player[key], 1) for key in ("pts", "reb", "ast")},
                        "proj": {key: round(value, 1) for key, value in proj.items()}, "edge": round(gain, 1), "why": why}
    return result


# ------------------------------------------------------------------ NFL numbers

def _nfl_season(now=None):
    now = now or datetime.now(timezone.utc)
    return now.year if now.month >= 3 else now.year - 1


def nfl_tables(games: dict, season: int, player_rows=(), last_rows=()) -> dict:
    """Every team's points scored and allowed a game (last season's worth
    MODELS prior_games games, a half of it kept), its last game, and its
    main quarterback (most attempts this season, else last season)."""
    from backend.sports.nfl.services.nflverse import canonical_team
    model = MODELS["nfl"]
    finals = lambda year: sorted((g for g in games.values() if str(g.get("season")) == str(year) and g.get("final")),
                                 key=lambda g: g.get("kickoff") or 0)
    score = lambda g, side: _num(g.get(f"{side}_score")) or 0

    def per_team(year):
        out = defaultdict(list)
        for g in finals(year):
            out[g["home"]].append((score(g, "home"), score(g, "away"), g.get("kickoff")))
            out[g["away"]].append((score(g, "away"), score(g, "home"), g.get("kickoff")))
        return out
    before, now = per_team(season - 1), per_team(season)
    league = (sum(x[0] for rows in before.values() for x in rows) / max(1, sum(len(rows) for rows in before.values()))) or 22.5
    teams = {}
    for team in set(before) | set(now):
        rows, last = now.get(team) or [], before.get(team) or []
        pf0 = league + ((sum(x[0] for x in last) / len(last) - league) * model["prior_keep"] if last else 0)
        pa0 = league + ((sum(x[1] for x in last) / len(last) - league) * model["prior_keep"] if last else 0)
        k = model["prior_games"]
        teams[team] = {"games": len(rows), "pf": (sum(x[0] for x in rows) + k * pf0) / (len(rows) + k),
                       "pa": (sum(x[1] for x in rows) + k * pa0) / (len(rows) + k),
                       "pfSeason": sum(x[0] for x in rows) / len(rows) if rows else None,
                       "paSeason": sum(x[1] for x in rows) / len(rows) if rows else None,
                       "lastKickoff": rows[-1][2] if rows else None,
                       "last5": [x[0] > x[1] for x in rows[-5:]]}
    quarterbacks = {}
    for rows in (last_rows, player_rows):
        attempts = defaultdict(lambda: defaultdict(float))
        names = {}
        for row in rows:
            if str(row.get("position") or "").upper() != "QB" or str(row.get("season_type") or "").upper() not in ("REG", "POST"):
                continue
            team = canonical_team(row.get("team"))
            attempts[team][row.get("player_id")] += _num(row.get("attempts")) or 0
            names[row.get("player_id")] = row.get("player_display_name") or row.get("player_name") or ""
        for team, by_player in attempts.items():
            pid = max(by_player, key=by_player.get)
            if by_player[pid] > 0:
                quarterbacks[team] = {"id": pid, "name": names.get(pid, "")}
    return {"teams": teams, "league": league, "qb": quarterbacks, "season": season}


def _nfl_numbers(now=None):
    def load():
        from backend.sports.nfl import finder
        season = _nfl_season(now)
        games = finder.games_index()
        try:
            rows = finder.player_rows(season)
        except Exception:  # noqa: BLE001 -- early in a season the file may not exist yet
            rows = []
        try:
            last = finder.player_rows(season - 1) if not rows else []
        except Exception:  # noqa: BLE001
            last = []
        tables = nfl_tables(games, season, rows, last)
        try:
            tables["league_data"] = finder.league(season)
            tables["rows"] = rows
        except Exception:  # noqa: BLE001 -- the player matchups are left off
            tables["league_data"] = None
        return tables
    return _kept("nfl-tables", TABLE_SECONDS, load)


def nfl_model(game, tables) -> dict | None:
    from backend.sports.nfl.services.nflverse import canonical_team
    model = MODELS["nfl"]
    home, away = canonical_team(game["home"]["abbr"]), canonical_team(game["away"]["abbr"])
    h, a = tables["teams"].get(home), tables["teams"].get(away)
    if not h or not a:
        return None
    net = ((h["pf"] - h["pa"]) - (a["pf"] - a["pa"])) / 2
    injuries = game.get("injuries") or {}
    out, qb_out = {}, {}
    for side, team in (("home", home), ("away", away)):
        quarterback = tables["qb"].get(team) or {}
        qb_out[side] = None
        out[side] = []
        for item in injuries.get(game[side]["abbr"]) or []:
            entry = {"name": item.get("name"), "position": item.get("position"), "status": item.get("status"),
                     "injury": item.get("injury"), "out": is_out(item.get("status")), "impact": 0.0}
            if entry["out"] and str(item.get("position") or "").upper() == "QB" and quarterback and _key(item.get("name")) == _key(quarterback.get("name")):
                entry["impact"] = model["qb"]
                qb_out[side] = item.get("name")
            out[side].append(entry)
        out[side].sort(key=lambda entry: (-entry["impact"], not entry["out"]))
    start = _when(game["startsAt"])
    rest = {}
    for side, row in (("home", h), ("away", a)):
        rest[side] = round((start.timestamp() - row["lastKickoff"]) / 86400) if start and row.get("lastKickoff") else None
    rest_diff = max(-7, min(7, (rest["home"] or 7) - (rest["away"] or 7))) if rest["home"] and rest["away"] else 0
    home_field = 0 if game.get("neutral") else model["home"]
    qb = model["qb"] * ((1 if qb_out["away"] else 0) - (1 if qb_out["home"] else 0))
    parts = [
        ("ratings", "Team ratings", model["scale"] * net,
         f"{home} {h['pf']:.1f} scored / {h['pa']:.1f} allowed, {away} {a['pf']:.1f} / {a['pa']:.1f} a game"),
        ("home", "Home field", home_field, "Neutral site" if game.get("neutral") else f"{home} at home"),
        ("qb", "Quarterback", qb, " · ".join(f"{name} out" for name in (qb_out["home"], qb_out["away"]) if name) or None),
        ("rest", "Rest", model["rest"] * rest_diff, f"{home} {rest['home']} days, {away} {rest['away']} days" if rest_diff else None),
    ]
    margin = sum(part[2] for part in parts)
    total = (h["pf"] + a["pa"]) / 2 + (a["pf"] + h["pa"]) / 2
    pf = {team: row["pfSeason"] for team, row in tables["teams"].items() if row["games"]}
    pa = {team: row["paSeason"] for team, row in tables["teams"].items() if row["games"]}
    profile = lambda team, row: {"pf": [round(row["pfSeason"], 1) if row["pfSeason"] is not None else None, _rank_of(pf, team)],
                                 "pa": [round(row["paSeason"], 1) if row["paSeason"] is not None else None, _rank_of(pa, team, high_first=False)],
                                 "games": row["games"], "qb": (tables["qb"].get(team) or {}).get("name")}
    plays = _nfl_pace(tables.get("league_data"), home, away)
    return {"margin": margin, "total": total, "out": out, "rest": rest, "qbOut": qb_out, "plays": plays,
            "parts": [{"key": key, "label": label, "points": round(points, 1), "text": text} for key, label, points, text in parts],
            "teams": {"home": profile(home, h), "away": profile(away, a)}}


def _nfl_pace(league_data, home, away):
    """Each team's plays a game (passes, sacks and runs) and its rank."""
    stats = (league_data or {}).get("teamStats") or {}
    plays = {}
    for team, sides in stats.items():
        off = sides.get("off") or {}
        values = [(off.get(key) or [None])[0] for key in ("attempts", "carries", "sacks_taken")]
        if values[0] is not None and values[1] is not None:
            plays[team] = sum(value or 0 for value in values)
    if home not in plays or away not in plays:
        return None
    return {"home": [round(plays[home], 1), _rank_of(plays, home)], "away": [round(plays[away], 1), _rank_of(plays, away)],
            "league": round(sum(plays.values()) / len(plays), 1)}


NFL_SKILL = {"QB": ("passing_yards", "Pass yds"), "RB": ("rushing_yards", "Rush yds"), "WR": ("receiving_yards", "Rec yds"),
             "TE": ("receiving_yards", "Rec yds")}
NFL_WORDS = {"QB": "quarterbacks", "RB": "running backs", "WR": "receivers", "TE": "tight ends"}


def nfl_players(game, tables, built) -> dict:
    """Each side's player with the best matchup: his fantasy points a game
    and main yards moved by what this defense allows his position, among its
    quarterback, top two backs by carries and top three targets."""
    from backend.sports.nfl import finder
    from backend.sports.nfl.services.nflverse import canonical_team
    data, rows = tables.get("league_data"), tables.get("rows") or []
    if not data or not rows:
        return {}
    usage, dvp = data.get("usage") or {}, data.get("dvp") or {}
    mine = defaultdict(list)
    info = {}
    for row in rows:
        if str(row.get("season_type") or "").upper() != "REG":
            continue
        mine[row.get("player_id")].append(row)
        info[row.get("player_id")] = row
    league_allowed = {}
    for position in NFL_SKILL:
        values = [((dvp.get(team) or {}).get(position) or {}).get("stats", {}) for team in dvp]
        fantasy = [v["fantasy"]["szn"][0] for v in values if v.get("fantasy", {}).get("szn")]
        yards = [v[NFL_SKILL[position][0]]["szn"][0] for v in values if v.get(NFL_SKILL[position][0], {}).get("szn")]
        league_allowed[position] = (sum(fantasy) / len(fantasy) if fantasy else None, sum(yards) / len(yards) if yards else None)
    result = {}
    for side, other in (("home", "away"), ("away", "home")):
        team, opponent = canonical_team(game[side]["abbr"]), canonical_team(game[other]["abbr"])
        out_names = {_key(entry["name"]) for entry in built["out"][side] if entry["out"]}
        candidates = []
        quarterback = (tables["qb"].get(team) or {}).get("id")
        by_team = [pid for pid, games in mine.items() if games and canonical_team(games[-1].get("team")) == team]
        backs = sorted((pid for pid in by_team if str(info[pid].get("position")).upper() == "RB"), key=lambda pid: -(usage.get(pid) or [0, 0])[1])[:2]
        catchers = sorted((pid for pid in by_team if str(info[pid].get("position")).upper() in ("WR", "TE")), key=lambda pid: -(usage.get(pid) or [0, 0])[0])[:3]
        for pid in ([quarterback] if quarterback in mine else []) + backs + catchers:
            if _key(info[pid].get("player_display_name")) in out_names:
                continue
            candidates.append(pid)
        best = None
        for pid in candidates:
            games, position = mine[pid], str(info[pid].get("position")).upper()
            stat, label = NFL_SKILL[position]
            fantasy = [v for g in games if (v := finder.prizepicks_fantasy(g)) is not None]
            yards = [_num(g.get(stat)) or 0 for g in games]
            if len(fantasy) < 2:
                continue
            spot = ((dvp.get(opponent) or {}).get(position) or {}).get("stats") or {}
            lg_fantasy, lg_yards = league_allowed[position]
            n = (dvp.get(opponent) or {}).get(position, {}).get("games") or 0
            factor = lambda found, base: 1 + ((found / base) - 1) * n / (n + 4) if found is not None and base else 1
            f_factor = factor((spot.get("fantasy") or {}).get("szn", [None])[0], lg_fantasy)
            y_factor = factor((spot.get(stat) or {}).get("szn", [None])[0], lg_yards)
            avg_f, avg_y = sum(fantasy) / len(fantasy), sum(yards) / len(yards)
            gain = avg_f * (f_factor - 1)
            if best is None or gain > best[0]:
                rank = (spot.get("fantasy") or {}).get("szn", [None, None])[1]
                best = (gain, pid, position, label, avg_f, avg_f * f_factor, avg_y, avg_y * y_factor, rank, usage.get(pid))
        if not best:
            continue
        gain, pid, position, label, avg_f, proj_f, avg_y, proj_y, rank, share = best
        teams_count = len(dvp) or 32
        why = []
        if rank and rank >= teams_count - 9:
            why.append(f"{opponent} allows the {ordinal(teams_count - rank + 1)} most fantasy points to {NFL_WORDS[position]}")
        if share and position in ("WR", "TE") and share[0] >= 0.18:
            why.append(f"Gets {share[0] * 100:.0f}% of {team}'s targets")
        if share and position == "RB" and share[1] >= 0.45:
            why.append(f"Gets {share[1] * 100:.0f}% of {team}'s carries")
        row = info[pid]
        result[side] = {"id": pid, "name": row.get("player_display_name") or row.get("player_name"), "position": position,
                        "headshot": row.get("headshot_url") or None, "team": game[side]["abbr"],
                        "avg": {"fantasy": round(avg_f, 1), "yards": round(avg_y, 1)},
                        "proj": {"fantasy": round(proj_f, 1), "yards": round(proj_y, 1)}, "yardsLabel": label,
                        "edge": round(gain, 1), "why": why}
    return result


# ------------------------------------------------------------------ the prediction

def combine(sport, game, built) -> dict:
    """The final number: ours with the line's, by the backtested weights."""
    model = MODELS[sport]
    line = game.get("line") or {}
    ours = built["margin"] if built else None
    market_margin = -line["spread"] if line.get("spread") is not None else None
    if market_margin is not None and ours is not None:
        margin = (1 - model["ours"]) * market_margin + model["ours"] * ours
    elif market_margin is not None:
        margin = market_margin
    elif ours is not None:
        margin = ours
    elif game.get("espn"):
        # ESPN's projection alone, as a margin.
        p = min(0.99, max(0.01, game["espn"]["home"]))
        margin = model["sigma"] * math.sqrt(2) * _erfinv(2 * p - 1)
    else:
        return None
    total = line.get("total") if line.get("total") is not None else (built["total"] if built else None)
    return {"margin": margin, "total": total}


def _erfinv(y: float) -> float:
    """The inverse error function (Winitzki's approximation, refined by two Newton steps)."""
    a = 0.147
    ln = math.log(1 - y * y)
    x = math.copysign(math.sqrt(math.sqrt((2 / (math.pi * a) + ln / 2) ** 2 - ln / a) - (2 / (math.pi * a) + ln / 2)), y)
    for _ in range(2):
        x -= (math.erf(x) - y) / (2 / math.sqrt(math.pi) * math.exp(-x * x))
    return x


def final_score(margin: float, total: float) -> tuple[int, int]:
    """(home, away) points: the total split by the margin, never a tie."""
    home, away = round((total + margin) / 2), round((total - margin) / 2)
    if home == away:
        home, away = (home + 1, away) if margin >= 0 else (home, away + 1)
    return home, away


def prediction(sport, game, built, players=None, now=None) -> dict:
    """The page's prediction for one game (game: _summary; built: nba_model / nfl_model)."""
    model = MODELS[sport]
    final = combine(sport, game, built)
    if not final:
        return None
    margin, total = final["margin"], final["total"]
    home_chance = phi(margin / model["sigma"])
    winner = "home" if margin > 0 or (margin == 0 and home_chance >= 0.5) else "away"
    chance = {"home": home_chance, "away": 1 - home_chance}
    line = game.get("line")
    market = None
    if line:
        # The moneylines' chances with the margin taken out, else the spread's.
        prices = line.get("moneyline") or {}
        home_p, away_p = implied(prices.get("home")), implied(prices.get("away"))
        market_chance = ({"home": home_p / (home_p + away_p), "away": away_p / (home_p + away_p)} if home_p and away_p
                         else {"home": phi(-line["spread"] / model["sigma"]), "away": 1 - phi(-line["spread"] / model["sigma"])}
                         if line.get("spread") is not None else None)
        market = {**line, "chance": market_chance}
    edge = None
    if market and market.get("chance"):
        # Only our own disagreement counts: how far our number moves the
        # line's chance (both read the same way), laid on the moneyline's.
        # The spread and the moneyline can differ by a point or two of
        # chance on their own; that isn't an edge of ours.
        shift = home_chance - (phi(-line["spread"] / model["sigma"]) if line.get("spread") is not None else market["chance"]["home"])
        ours_now = {"home": min(0.99, max(0.01, market["chance"]["home"] + shift))}
        ours_now["away"] = 1 - ours_now["home"]
        side = "home" if shift >= 0 else "away"
        gap = abs(shift)
        price = (market.get("moneyline") or {}).get(side)
        edge = {"side": side if gap >= EDGE_MIN else None, "points": round(gap, 4), "price": price, "chance": round(ours_now[side], 4),
                "fair": american(ours_now[side]),
                "value": (ours_now[side] * (100 / abs(price) if price < 0 else price / 100) - (1 - ours_now[side])) if price else None}
    ours = None
    if built:
        ours = {"margin": round(built["margin"], 1), "total": round(built["total"], 1) if built.get("total") else None,
                "chance": phi(built["margin"] / model["sigma"])}
    # How many of the three views (ours alone, the market, ESPN's) pick the same winner.
    views = [view for view in ((ours or {}).get("chance"), ((market or {}).get("chance") or {}).get("home"), (game.get("espn") or {}).get("home"))
             if view is not None]
    agree = sum(1 for view in views if (view >= 0.5) == (winner == "home"))
    views = len(views)
    big = max(chance.values())
    confidence = "High" if big >= 0.7 and agree == views else "Medium" if big >= 0.58 else "Low"
    blow = model["blowout"]
    blowout = phi((abs(margin) - blow) / model["blowout_sigma"]) + phi((-abs(margin) - blow) / model["blowout_sigma"])
    score = final_score(margin, total) if total is not None else None
    team = lambda side: {key: (game[side] or {}).get(key) for key in ("abbr", "name", "short", "logo", "color", "record")}
    return {"sport": sport, "id": game["id"], "startsAt": game.get("startsAt"), "state": game.get("state"), "detail": game.get("detail"),
            "venue": game.get("venue"), "neutral": bool(game.get("neutral")),
            "home": team("home"), "away": team("away"), "winner": winner,
            "chance": {side: round(value, 4) for side, value in chance.items()},
            "margin": round(margin, 1), "total": round(total, 1) if total is not None else None,
            "score": {"home": score[0], "away": score[1]} if score else None,
            "market": market, "espn": game.get("espn"), "ours": ours, "edge": edge,
            "blowout": {"chance": round(blowout, 3), "by": blow, "level": "High" if blowout >= 0.45 else "Medium" if blowout >= 0.3 else "Low"},
            "confidence": confidence, "agree": [agree, views],
            "factors": (built or {}).get("parts") or [], "teams": (built or {}).get("teams"), "out": (built or {}).get("out"),
            "rest": (built or {}).get("rest"), "pace": _pace(sport, built), "players": players or {},
            "lastFive": game.get("lastFive") or {}, "madeAt": (now or datetime.now(timezone.utc)).isoformat()}


def _pace(sport, built):
    if not built or not built.get("teams"):
        return None
    if sport == "nba":
        possessions, league = built["poss"], built["leaguePace"]
        diff = possessions - league
        return {"value": round(possessions, 1), "league": round(league, 1), "unit": "possessions",
                "level": "Fast" if diff >= 1.5 else "Slow" if diff <= -1.5 else "Average",
                "home": built["teams"]["home"]["pace"], "away": built["teams"]["away"]["pace"]}
    plays = built.get("plays")
    if not plays:
        return None
    combined = (plays["home"][0] + plays["away"][0]) / 2
    return {"value": round(combined, 1), "league": plays["league"], "unit": "plays a team",
            "level": "Fast" if combined - plays["league"] >= 2 else "Slow" if combined - plays["league"] <= -2 else "Average",
            "home": plays["home"], "away": plays["away"]}


def predict(sport, event_id, now=None, store=None) -> dict:
    """Predict one game (ESPN's event id) and keep it for the history while
    the game is still to start."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)
    game = _summary(sport, event_id)
    if not game.get("home") or not game.get("away"):
        raise LookupError("That game isn't on ESPN's schedule.")
    built, players = None, {}
    try:
        if sport == "nba":
            tables = _nba_numbers(now)
            built = nba_model(game, tables)
            players = nba_players(game, tables, built) if built else {}
        else:
            tables = _nfl_numbers(now)
            built = nfl_model(game, tables)
            players = nfl_players(game, tables, built) if built else {}
    except Exception:  # noqa: BLE001 -- the line and ESPN's projection still make a prediction
        built = built or None
    found = prediction(sport, game, built, players, now)
    if not found:
        raise LookupError("There isn't enough on this game yet to predict it.")
    start = _when(found["startsAt"])
    if found["state"] == "pre" and start and start > now:
        try:
            record(sport, found, store=store)
        except Exception:  # noqa: BLE001 -- the history is never worth failing a prediction
            pass
    return found


# ------------------------------------------------------------------ the history

def _store():
    try:
        from v2.board import store
        return store
    except Exception:  # noqa: BLE001
        return None


def _entry(found) -> dict:
    """What the history keeps of a prediction."""
    team = lambda side: {key: found[side].get(key) for key in ("abbr", "short", "logo")}
    market = found.get("market") or {}
    market_chance = market.get("chance") or {}
    return {"id": found["id"], "startsAt": found["startsAt"], "madeAt": found["madeAt"], "home": team("home"), "away": team("away"),
            "pick": found["winner"], "chance": found["chance"][found["winner"]], "score": found["score"],
            "marketPick": ("home" if market_chance.get("home", 0.5) >= 0.5 else "away") if market_chance else None,
            "spread": market.get("spread"), "total": market.get("total"),
            "edge": (found.get("edge") or {}).get("side"), "result": None}


def _read(sport, store):
    try:
        raw = store.get(HISTORY_KEY.format(sport=sport)) if store else None
        value = json.loads(raw) if raw else []
        return value if isinstance(value, list) else []
    except Exception:  # noqa: BLE001
        return []


def _write(sport, items, store):
    if store:
        store.set(HISTORY_KEY.format(sport=sport), json.dumps(items[:MAX_HISTORY], separators=(",", ":")))


def record(sport, found, store=None):
    """Keep the latest prediction made before the game starts (one per game)."""
    store = _store() if store is None else store
    items = [item for item in _read(sport, store) if item.get("id") != found["id"]]
    items.insert(0, _entry(found))
    items.sort(key=lambda item: item.get("startsAt") or "", reverse=True)
    _write(sport, items, store)


def final_of(summary):
    """(home points, away points) when ESPN's summary calls the game final, else None."""
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    if (((competition.get("status") or {}).get("type") or {}).get("state")) != "post":
        return None
    sides = {competitor.get("homeAway"): _num(competitor.get("score")) for competitor in competition.get("competitors") or []}
    if sides.get("home") is None or sides.get("away") is None:
        return None
    return int(sides["home"]), int(sides["away"])


def _finals(sport, event_ids):
    """{event id: (home points, away points)} for the games ESPN calls final,
    a summary each (the same request for both leagues; the NFL's scoreboard
    won't take every date form)."""
    def one(event_id):
        try:
            return event_id, final_of(_espn(sport, "/summary", {"event": event_id}))
        except Exception:  # noqa: BLE001 -- that game waits for the next look
            return event_id, None
    with ThreadPoolExecutor(max_workers=6) as pool:
        return {event_id: final for event_id, final in pool.map(one, event_ids) if final}


def settle(item, final) -> dict:
    home, away = final
    winner = "home" if home > away else "away" if away > home else None
    result = {"home": home, "away": away, "winner": winner, "correct": winner is not None and item["pick"] == winner,
              "market": None if not item.get("marketPick") or winner is None else item["marketPick"] == winner}
    if item.get("score"):
        result["miss"] = abs(item["score"]["home"] - home) + abs(item["score"]["away"] - away)
    return {**item, "result": result}


def record_summary(items) -> dict:
    settled = [item for item in items if item.get("result") and item["result"].get("winner")]
    market = [item for item in settled if item["result"].get("market") is not None]
    misses = [item["result"]["miss"] for item in settled if item["result"].get("miss") is not None]
    correct = sum(1 for item in settled if item["result"]["correct"])
    return {"games": len(settled), "correct": correct, "pct": correct / len(settled) if settled else None,
            "market": {"games": len(market), "correct": sum(1 for item in market if item["result"]["market"])},
            "scoreMiss": sum(misses) / len(misses) / 2 if misses else None,
            "pending": sum(1 for item in items if not item.get("result"))}


def history(sport, now=None, store=None, finals=None) -> dict:
    """{items, record}: the kept predictions, newest first, the finished
    ones settled from ESPN's final scores."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)
    store = _store() if store is None else store
    items = _read(sport, store)
    due = [item for item in items if not item.get("result") and (start := _when(item.get("startsAt")))
           and (now - start).total_seconds() >= SETTLE_AFTER[sport]]
    if due:
        found = (finals or _finals)(sport, [item["id"] for item in due][:SETTLE_MOST])
        changed = False
        for index, item in enumerate(items):
            if item in due and item["id"] in found:
                items[index] = settle(item, found[item["id"]])
                changed = True
        if changed:
            try:
                _write(sport, items, store)
            except Exception:  # noqa: BLE001
                pass
    return {"sport": sport, "items": items[:60], "record": record_summary(items)}
