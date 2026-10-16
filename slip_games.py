"""Each slip pick's game, from the leagues' own free sources: whether it has
started, the score and the clock, each player's line so far, the injury
report and, for MLB, the posted lineup with each hitter's batting spot.

* NFL, NBA, WNBA -- ESPN's game page (found on its scoreboard). Its box score
  is read by the same code the Finder's history uses (the NFL's preseason
  reader, the basketball season store), so a live number and a game-log
  number always agree.
* NHL -- the NHL's game center box score; ESPN's injury report.
* MLB -- MLB's schedule (status, inning, probable starters) and box score
  (lineups, batting order, each player's line); ESPN's injury report.
* Soccer -- ESPN's match page (lineups, injuries, each player's line).

Nothing here costs a credit. Answers are kept briefly in memory: a game in
progress for 20 seconds, one still to come for two minutes.
"""
from __future__ import annotations

import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

ESPN = "https://site.api.espn.com/apis/site/v2/sports"
PATHS = {"nfl": "football/nfl", "cfb": "football/college-football", "nba": "basketball/nba", "wnba": "basketball/wnba",
         "nhl": "hockey/nhl", "mlb": "baseball/mlb"}
SPORTS = ("nfl", "cfb", "nba", "wnba", "nhl", "mlb", "soccer")
MAX_GAMES = 8
MAX_PLAYERS = 12
# The same club under each source's code; both sides of a comparison are
# put through this first.
ALIASES = {
    "nfl": {"LAR": "LA", "WSH": "WAS", "JAC": "JAX", "LVR": "LV", "OAK": "LV"},
    "nba": {"GSW": "GS", "NYK": "NY", "NOP": "NO", "SAS": "SA", "UTA": "UTAH", "WAS": "WSH", "PHO": "PHX", "BRK": "BKN"},
    "wnba": {"LVA": "LV", "LAS": "LA", "CON": "CONN", "PHO": "PHX", "WAS": "WSH", "NYL": "NY", "GSV": "GS", "GSW": "GS"},
    "mlb": {"AZ": "ARI", "CWS": "CHW", "WAS": "WSH", "KCR": "KC", "SDP": "SD", "SFG": "SF", "TBR": "TB", "OAK": "ATH"},
    "nhl": {"TBL": "TB", "NJD": "NJ", "LAK": "LA", "SJS": "SJ", "UTA": "UTAH", "VEG": "VGK", "WAS": "WSH"},
}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
_memory: dict = {}


def code(sport, value):
    value = str(value or "").strip().upper()
    return ALIASES.get(sport, {}).get(value, value)


def photo(sport, ident, team="", starts_at=None):
    """A player's headshot from his id in the game's box score -- ESPN's for
    football, basketball and soccer, MLB's and the NHL's own -- or ""."""
    ident = str(ident or "").strip()
    if not ident.isdigit():
        return ""
    if sport in ("nfl", "nba", "wnba", "soccer"):
        return f"https://a.espncdn.com/i/headshots/{sport}/players/full/{ident}.png"
    if sport == "mlb":
        return f"https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/{ident}/headshot/67/current"
    if sport == "nhl" and team:
        import nhl_research
        moment = _time(starts_at)
        return nhl_research.mug(nhl_research.season_id(moment.date() if moment else None), team, ident)
    return ""


def team_logo(sport, team):
    """A club's logo from its code, where the league's code is enough: the
    NFL's own, ESPN's for basketball and baseball, the NHL's own; "" for
    soccer (its clubs go by ESPN id)."""
    team = code(sport, team)
    if not team or not re.fullmatch(r"[A-Z]{2,5}", team):
        return ""
    if sport == "nfl":
        return f"https://static.www.nfl.com/t_q-best/league/api/clubs/logos/{team}.svg"
    if sport in ("nba", "wnba", "mlb"):
        return f"https://a.espncdn.com/i/teamlogos/{sport}/500/{team.lower()}.png"
    if sport == "nhl":
        import nhl_research
        return nhl_research.logo(team)
    return ""


def _number(value):
    try:
        number = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def _time(value):
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _eastern_day(moment):
    import moneyline_model
    return moneyline_model._eastern(moment).date()


def words(name):
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    return [word for word in re.sub(r"[^a-z ]+", " ", text.replace("'", "")).split() if word not in SUFFIXES]


def find_person(people, name, ident=None):
    """The entry among `people` ([{id, name, ...}]) for a slip's player: the
    same id, else the full name, else the one with his last name and first
    initial."""
    if ident not in (None, ""):
        for person in people:
            if str(person.get("id")) == str(ident):
                return person
    wanted = words(name)
    if not wanted:
        return None
    exact = [person for person in people if words(person.get("name")) == wanted]
    if len(exact) == 1:
        return exact[0]
    close = [person for person in people if (found := words(person.get("name"))) and found[-1] == wanted[-1] and found[0][:1] == wanted[0][:1]]
    return close[0] if len(close) == 1 else None


def _kept(key, load, ttl):
    """`load()`, kept in memory for `ttl(value)` seconds."""
    hit = _memory.get(key)
    if hit and time.time() < hit[0]:
        return hit[1]
    value = load()
    _memory[key] = (time.time() + ttl(value), value)
    if len(_memory) > 400:
        for stale in [name for name, (until, _) in _memory.items() if until < time.time()]:
            _memory.pop(stale, None)
    return value


def _get(url, params=None):
    response = requests.get(url, params=params, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=10)
    response.raise_for_status()
    return response.json()


def _fresh(state):
    return 20 if state == "in" else 120 if state == "pre" else 600


# ---------------------------------------------------------------- ESPN (NFL, NBA, WNBA)

def espn_status(competition):
    status = competition.get("status") or {}
    kind = status.get("type") or {}
    name = str(kind.get("name") or "").upper()
    off = any(word in name for word in ("POSTPONED", "CANCELED", "CANCELLED", "SUSPENDED", "DELAYED"))
    return {"state": kind.get("state") or "pre", "detail": kind.get("shortDetail") or kind.get("detail") or "",
            "period": _number(status.get("period")), "clock": status.get("displayClock"),
            "completed": bool(kind.get("completed")), "off": off}


def espn_injuries(summary, sport):
    """ESPN's injury report on its game page, by club code."""
    found = {}
    for block in summary.get("injuries") or []:
        team = code(sport, (block.get("team") or {}).get("abbreviation"))
        listed = []
        for item in block.get("injuries") or []:
            athlete = item.get("athlete") or {}
            name = athlete.get("displayName") or athlete.get("fullName")
            status = item.get("status") or ((item.get("details") or {}).get("fantasyStatus") or {}).get("description") or ""
            if name and status:
                listed.append({"name": name, "status": str(status), "position": (athlete.get("position") or {}).get("abbreviation") or ""})
        if team:
            found[team] = listed
    return found


def _scoreboard(sport, day):
    key = f"board:{sport}:{day:%Y%m%d}"
    return _kept(key, lambda: _get(f"{ESPN}/{PATHS[sport]}/scoreboard", {"dates": f"{day:%Y%m%d}", "limit": 200}), lambda _: 60)


def find_event(sport, team, opponent, starts_at, events):
    """The ESPN game `team` plays (against `opponent` when known), nearest
    its start."""
    team, opponent = code(sport, team), code(sport, opponent)
    best, gap = None, None
    for event in events:
        competition = (event.get("competitions") or [{}])[0]
        sides = [code(sport, (side.get("team") or {}).get("abbreviation")) for side in competition.get("competitors") or []]
        if team not in sides or (opponent and opponent not in sides):
            continue
        when = _time(event.get("date"))
        distance = abs((when - starts_at).total_seconds()) if when and starts_at else 0
        if distance <= 18 * 3600 and (gap is None or distance < gap):
            best, gap = event, distance
    return best


def _espn_event(sport, item):
    starts = _time(item.get("startsAt"))
    now = datetime.now(timezone.utc)
    days = [_eastern_day(starts)] if starts else [_eastern_day(now), _eastern_day(now) - timedelta(days=1)]
    events = []
    for day in days:
        try:
            events.extend(_scoreboard(item["sport"], day).get("events") or [])
        except Exception:  # noqa: BLE001 -- the other day may still have it
            continue
    return find_event(item["sport"], item.get("team"), item.get("opponent"), starts, events)


def _summary(sport, event_id):
    key = f"summary:{sport}:{event_id}"
    hit = _memory.get(key)
    if hit and time.time() < hit[0]:
        return hit[1]
    value = _get(f"{ESPN}/{PATHS[sport]}/summary", {"event": event_id})
    competition = ((value.get("header") or {}).get("competitions") or [{}])[0]
    _memory[key] = (time.time() + _fresh(espn_status(competition)["state"]), value)
    return value


def _sides(competition, sport):
    sides = {}
    for side in competition.get("competitors") or []:
        team = side.get("team") or {}
        sides[code(sport, team.get("abbreviation"))] = {"score": _number(side.get("score")), "home": side.get("homeAway") == "home"}
    return sides


def nfl_lines(summary):
    """Each player's line so far, as the Finder's NFL markets
    (backend/sports/nfl/finder.py market_values): [{id, name, team, line}]."""
    from backend.sports.nfl import finder, preseason
    parsed = preseason.parse_summary(summary) or {}
    return [{"id": athlete_id, "name": entry["name"], "team": code("nfl", entry["team"]),
             "line": finder.market_values(preseason.full_row(entry))}
            for athlete_id, entry in (parsed.get("players") or {}).items()]


def basketball_lines(summary, sport):
    """Each player's line so far, as the basketball markets
    (backend/sports/wnba/context.py MARKET_STAT); `played` is False for a
    player who hasn't been on the floor."""
    from backend.sports.wnba import context, league
    directory = {}
    record = league.extract_game(summary, {"id": "", "date": "", "type": "", "home": "", "away": ""}, directory)
    out = []
    for team, block in (record.get("t") or {}).items():
        for row in block.get("p") or []:
            values = {market: context.stat_value(row, stat) for market, stat in context.MARKET_STAT.items()}
            out.append({"id": row[0], "name": (directory.get(row[0]) or [""])[0], "team": code(sport, team), "line": values,
                        "minutes": row[2], "starter": bool(row[1]), "played": True})
        for pid in block.get("dnp") or []:
            out.append({"id": pid, "name": (directory.get(pid) or [""])[0], "team": code(sport, team), "line": {}, "played": False})
    return out


def cfb_lines(summary):
    """Each player's line so far, under the college football Finder's value
    keys (cfb_research.parse_box): [{id, name, team, line}]."""
    import cfb_research
    return [{"id": pid, "name": entry["name"], "team": entry["team"], "line": entry["values"]}
            for pid, entry in cfb_research.parse_box(summary)["lines"].items()]


def _implied(price):
    if price is None or abs(price) < 100:
        return None
    return 100 / (price + 100) if price > 0 else -price / (-price + 100)


def game_odds(home, away, total, home_spread, home_moneyline, away_moneyline):
    """A game's betting line keyed by the teams' codes: its total, each
    side's spread and each side's chance to win (the moneylines with the
    margin taken out). None when there is none of it. The Parlay Builder's
    prop model reads blowout risk and expected scoring off it."""
    home_p, away_p = _implied(home_moneyline), _implied(away_moneyline)
    win = {home: round(home_p / (home_p + away_p), 4), away: round(away_p / (home_p + away_p), 4)} if home_p and away_p else None
    spread = {home: home_spread, away: -home_spread} if home_spread is not None else None
    if total is None and spread is None and win is None:
        return None
    return {"total": total, "spread": spread, "win": win}


def espn_odds(summary, teams):
    """The pregame line from ESPN's pick center (its spread is the home side's)."""
    home = next((team for team, side in teams.items() if side["home"]), None)
    away = next((team for team, side in teams.items() if not side["home"]), None)
    if not home or not away:
        return None
    for entry in summary.get("pickcenter") or []:
        odds = game_odds(home, away, _number(entry.get("overUnder")), _number(entry.get("spread")),
                         _number((entry.get("homeTeamOdds") or {}).get("moneyLine")),
                         _number((entry.get("awayTeamOdds") or {}).get("moneyLine")))
        if odds:
            return odds
    return None


def espn_view(sport, summary, item):
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    view = {"found": True, "id": str((summary.get("header") or {}).get("id") or competition.get("id") or ""),
            **espn_status(competition), "startsAt": competition.get("date"), "teams": _sides(competition, sport),
            "injuries": espn_injuries(summary, sport)}
    # The pregame line: the prop model's expected scoring and blowout risk
    # (basketball), a football team's game script and passing volume.
    if sport in ("nba", "wnba", "nfl", "cfb") and view["state"] == "pre":
        view["odds"] = espn_odds(summary, view["teams"])
    lines = []
    if view["state"] != "pre":
        try:
            lines = nfl_lines(summary) if sport == "nfl" else cfb_lines(summary) if sport == "cfb" else basketball_lines(summary, sport)
        except Exception:  # noqa: BLE001 -- the status and injuries still help
            lines = []
    view["players"] = _players(item, lines)
    return view


# ---------------------------------------------------------------- NHL

NHL_STATES = {"FUT": "pre", "PRE": "pre", "LIVE": "in", "CRIT": "in", "FINAL": "post", "OFF": "post"}


def nhl_view(box, item, injuries, odds=None):
    import nhl_research
    state = NHL_STATES.get(str(box.get("gameState") or "").upper(), "pre")
    period = (box.get("periodDescriptor") or {}).get("number")
    clock = box.get("clock") or {}
    teams = {}
    for side, home in (("homeTeam", True), ("awayTeam", False)):
        team = box.get(side) or {}
        teams[code("nhl", nhl_research.canonical(team.get("abbrev")))] = {"score": _number(team.get("score")), "home": home}
    lines = []
    if state != "pre":
        record = nhl_research.parse_box(box)
        lines = [{"id": pid, "name": entry["name"], "team": code("nhl", entry["team"]), "line": entry["line"]}
                 for pid, entry in record["lines"].items()]
    detail = "Final" if state == "post" else ("Intermission" if clock.get("inIntermission") else
                                              f"{clock.get('timeRemaining') or ''}").strip()
    return {"found": True, "id": str(box.get("id") or ""), "state": state, "detail": detail, "period": period,
            "clock": clock.get("timeRemaining"), "intermission": bool(clock.get("inIntermission")),
            "completed": state == "post", "off": str(box.get("gameScheduleState") or "OK").upper() not in ("OK", ""),
            "startsAt": box.get("startTimeUTC"), "teams": teams, "injuries": injuries, "odds": odds if state == "pre" else None,
            "players": _players(item, lines)}


def nhl_odds(box):
    """The NHL game's pregame line from ESPN's scoreboard (nhl_research.py)."""
    import nhl_research
    home, away = (nhl_research.canonical((box.get(side) or {}).get("abbrev")) for side in ("homeTeam", "awayTeam"))
    if not home or not away or not box.get("startTimeUTC"):
        return None
    found = nhl_research._odds({"start": box["startTimeUTC"], "home": home, "away": away})
    if not found:
        return None
    return game_odds(code("nhl", home), code("nhl", away), _number(found.get("total")), _number((found.get("home") or {}).get("spread")),
                     _number((found.get("home") or {}).get("moneyline")), _number((found.get("away") or {}).get("moneyline")))


def _nhl(item):
    import nhl_research
    game_id = str(item.get("gameId") or "")
    if not game_id.isdigit():
        starts = _time(item.get("startsAt")) or datetime.now(timezone.utc)
        games = nhl_research.schedule_day(_eastern_day(starts).isoformat())
        found = nhl_research.find_game(item.get("team"), item.get("opponent"), starts.timestamp(), games)
        game_id = (found or {}).get("id") or ""
    if not game_id:
        return None
    key = f"nhl:{game_id}"
    hit = _memory.get(key)
    if hit and time.time() < hit[0]:
        box = hit[1]
    else:
        box = nhl_research._web(f"/gamecenter/{game_id}/boxscore")
        _memory[key] = (time.time() + _fresh(NHL_STATES.get(str(box.get("gameState") or "").upper(), "pre")), box)
    injuries = {}
    for team in (item.get("team"), item.get("opponent")):
        if team:
            try:
                injuries[code("nhl", team)] = [{"name": entry["name"], "status": entry["status"], "position": entry["position"]}
                                               for entry in nhl_research.injuries(team)]
            except Exception:  # noqa: BLE001
                pass
    odds = None
    if NHL_STATES.get(str(box.get("gameState") or "").upper(), "pre") == "pre":
        try:
            odds = nhl_odds(box)
        except Exception:  # noqa: BLE001 -- the game reads without its line
            odds = None
    return nhl_view(box, item, injuries, odds)


# ---------------------------------------------------------------- MLB

MLB_OFF = ("Postponed", "Cancelled", "Canceled", "Suspended")


def mlb_view(game, box, item, injuries):
    """One MLB game: its status and inning, the starters, both lineups as
    posted (batting order, `confirmed` once nine are in) and each slip
    player's line so far (his batting and pitching, MLB's own fields)."""
    status = game.get("status") or {}
    abstract = status.get("abstractGameState") or "Preview"
    detailed = status.get("detailedState") or abstract
    state = "in" if abstract == "Live" else "post" if abstract == "Final" else "pre"
    linescore = game.get("linescore") or {}
    inning = linescore.get("currentInningOrdinal")
    half = linescore.get("inningState") or ""
    teams, lineups, starters, lines = {}, {}, {}, []
    for side in ("home", "away"):
        listed = (game.get("teams") or {}).get(side) or {}
        info = listed.get("team") or {}
        team = code("mlb", info.get("abbreviation"))
        teams[team] = {"score": _number(listed.get("score")), "home": side == "home", "id": info.get("id")}
        pitcher = listed.get("probablePitcher") or {}
        starters[team] = {"id": pitcher.get("id"), "name": pitcher.get("fullName")} if pitcher.get("fullName") else None
        own = ((box.get("teams") or {}).get(side) or {})
        players = own.get("players") or {}
        order = [players.get(f"ID{pid}") or {} for pid in own.get("battingOrder") or []]
        order = [(entry.get("person") or {}) for entry in order]
        lineups[team] = {"confirmed": len(order) >= 9, "order": [{"id": person.get("id"), "name": person.get("fullName")} for person in order]}
        for entry in players.values():
            person = entry.get("person") or {}
            stats = entry.get("stats") or {}
            spot = _number(entry.get("battingOrder"))
            lines.append({"id": person.get("id"), "name": person.get("fullName"), "team": team,
                          "line": {"batting": stats.get("batting") or {}, "pitching": stats.get("pitching") or {}},
                          "spot": int(spot // 100) if spot else None, "sub": bool(spot and spot % 100)})
    detail = detailed if state != "in" else " ".join(part for part in (half, inning) if part)
    return {"found": True, "id": str(game.get("gamePk") or ""), "state": state, "detail": detail,
            "period": _number(linescore.get("currentInning")), "half": half, "outs": _number(linescore.get("outs")),
            "completed": state == "post", "off": detailed in MLB_OFF, "startsAt": game.get("gameDate"),
            "teams": teams, "starters": starters, "lineups": lineups, "injuries": injuries,
            "players": _players(item, lines if state != "pre" or any(lineup["order"] for lineup in lineups.values()) else [])}


def _mlb(item):
    from live_props_core import mlb
    starts = _time(item.get("startsAt")) or datetime.now(timezone.utc)
    day = _eastern_day(starts).isoformat()
    schedule = _kept(f"mlb:schedule:{day}", lambda: mlb("/schedule", {"sportId": 1, "date": day, "hydrate": "team,linescore,probablePitcher"}),
                     lambda _: 30)
    team, opponent = code("mlb", item.get("team")), code("mlb", item.get("opponent"))
    best, gap = None, None
    for listed in (game for date in schedule.get("dates") or [] for game in date.get("games") or []):
        sides = (listed.get("teams") or {})
        codes = [code("mlb", ((sides.get(side) or {}).get("team") or {}).get("abbreviation")) for side in ("home", "away")]
        ids = [str(((sides.get(side) or {}).get("team") or {}).get("id")) for side in ("home", "away")]
        # A club plays once a day (twice in a doubleheader), so its own code
        # or id is enough; the opponent's code can differ between sources.
        if not (team in codes or str(item.get("teamId") or "") in ids):
            continue
        when = _time(listed.get("gameDate"))
        distance = abs((when - starts).total_seconds()) if when and item.get("startsAt") else 0
        # A doubleheader: the game nearer the pick's start, else the one under way.
        live = ((listed.get("status") or {}).get("abstractGameState") == "Live")
        rank = (distance, not live)
        if gap is None or rank < gap:
            best, gap = listed, rank
    if not best:
        return None
    pk = best.get("gamePk")
    abstract = (best.get("status") or {}).get("abstractGameState")
    box = _kept(f"mlb:box:{pk}", lambda: mlb(f"/game/{pk}/boxscore", {}),
                lambda _: 20 if abstract == "Live" else 120 if abstract == "Preview" else 600)
    injuries = {}
    try:
        import mlb_injuries
        for club in mlb_injuries.get_injury_report().get("teams") or []:
            club_code = code("mlb", club.get("abbr"))
            if club_code in (team, opponent):
                injuries[club_code] = [{"name": player["name"], "status": player["status"], "position": player["position"]}
                                       for player in club.get("players") or []]
    except Exception:  # noqa: BLE001
        pass
    return mlb_view(best, box, item, injuries)


# ---------------------------------------------------------------- soccer

def soccer_view(summary, item):
    import soccer_research
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    record = soccer_research.record(summary, item.get("competition") or "all")
    lines = []
    for team_id, players in (record.get("players") or {}).items():
        for player in players:
            lines.append({"id": player["id"], "name": player["name"], "team": team_id, "line": {"min": player.get("min"), "s": player.get("s") or {}},
                          "starter": player.get("starter")})
    teams = {str(team.get("id")): {"score": team.get("score"), "home": team.get("side") == "home"} for team in record.get("teams") or []}
    lineups = {team_id: {"confirmed": any(player.get("starter") for player in lineup["players"]),
                         "order": [{"id": player["id"], "name": player["name"]} for player in lineup["players"] if player.get("starter")]}
               for team_id, lineup in soccer_research._lineups(summary).items()}
    injuries = {team_id: [{"name": entry["name"], "status": entry["status"], "position": entry["pos"]} for entry in listed]
                for team_id, listed in soccer_research._injuries(summary).items()}
    status = espn_status(competition)
    return {"found": True, "id": str(item.get("eventId")), **status, "startsAt": competition.get("date"), "teams": teams,
            "lineups": lineups, "injuries": injuries, "players": _players(item, lines if status["state"] != "pre" else [])}


def _soccer(item):
    import soccer_research
    event_id = str(item.get("eventId") or "")
    if not event_id.isdigit():
        return None
    key = f"soccer:{event_id}"
    hit = _memory.get(key)
    if hit and time.time() < hit[0]:
        summary = hit[1]
    else:
        summary, _league = soccer_research._summary(event_id, item.get("competition"))
        competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
        _memory[key] = (time.time() + _fresh(espn_status(competition)["state"]), summary)
    return soccer_view(summary, item)


# ---------------------------------------------------------------- the slip

def _players(item, lines):
    """The slip's players among the game's lines, by the key each was asked with."""
    out = {}
    for person in item.get("players") or []:
        found = find_person(lines, person.get("name"), person.get("id"))
        out[str(person.get("key"))] = {**{k: v for k, v in found.items() if k != "id"},
                                       "headshot": photo(item.get("sport"), found.get("id"), found.get("team"), item.get("startsAt"))} if found else None
    return out


def read_game(item):
    sport = item.get("sport")
    try:
        if sport == "cfb" and str(item.get("gameId") or "").isdigit():
            # The line carries ESPN's own game id (cfb_board.py).
            view = espn_view(sport, _summary(sport, item["gameId"]), item)
        elif sport in ("nfl", "nba", "wnba", "cfb"):
            event = _espn_event(sport, item)
            view = espn_view(sport, _summary(sport, event["id"]), item) if event else None
        elif sport == "nhl":
            view = _nhl(item)
        elif sport == "mlb":
            view = _mlb(item)
        elif sport == "soccer":
            view = _soccer(item)
        else:
            view = None
    except Exception:  # noqa: BLE001 -- one game missing never sinks the rest
        view = None
    if not view:
        return {"found": False}
    # The pick's side and the other, under the codes the game is keyed by
    # (soccer's clubs by ESPN id).
    if sport == "soccer":
        view.update(team=str(item.get("teamId") or ""), opponent=str(item.get("opponentId") or ""))
    else:
        view.update(team=code(sport, item.get("team")), opponent=code(sport, item.get("opponent")))
    return view


def clean(payload):
    """The request's games, checked and trimmed: [{sport, team, opponent,
    startsAt, gameId, eventId, teamId, opponentId, competition, players:
    [{key, name, id}]}]."""
    games = payload.get("games") if isinstance(payload, dict) else None
    if not isinstance(games, list):
        raise ValueError("A list of games is required.")
    out = []
    short = lambda value, size=40: str(value or "")[:size]
    for game in games[:MAX_GAMES]:
        if not isinstance(game, dict) or game.get("sport") not in SPORTS:
            continue
        players = [{"key": short(person.get("key"), 20), "name": short(person.get("name"), 60), "id": short(person.get("id"), 20)}
                   for person in (game.get("players") or [])[:MAX_PLAYERS] if isinstance(person, dict) and person.get("name")]
        out.append({"sport": game["sport"], "team": short(game.get("team"), 8), "opponent": short(game.get("opponent"), 8),
                    "startsAt": short(game.get("startsAt")), "gameId": short(game.get("gameId"), 20),
                    "eventId": short(game.get("eventId"), 20), "teamId": short(game.get("teamId"), 12),
                    "opponentId": short(game.get("opponentId"), 12),
                    "competition": short(game.get("competition"), 30), "players": players})
    return out


def read(payload):
    games = clean(payload)
    with ThreadPoolExecutor(max_workers=6) as pool:
        return {"games": list(pool.map(read_game, games)), "at": datetime.now(timezone.utc).isoformat()}
