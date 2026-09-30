"""The WNBA season as box scores: the data behind every matchup view.

Defense vs position, offense vs defense, shot zones, similar players and
with/without splits all need every game of the season, not just one
player's log. ESPN's game summary has all of it -- positions, starters,
DNPs, every player's line and every shot's location -- but it is ~440KB
per game, so nothing that renders a page can afford to fetch it.

So this works like the NFL board: a build fetches each FINISHED game once,
keeps only the compact numbers, and stores the season as one KV record.
Finished games never change, so later builds only fetch games that have
finished since. The views read the stored season and never call ESPN for
box scores themselves.
"""
from __future__ import annotations

import base64
import gzip
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from datetime import datetime, timezone

import requests

ESPN = "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba"
LEAGUE_KEY = "krazy_data:wnba:v1:league:{season}"
BUILD_LOCK_KEY = "krazy_data:wnba:v1:league_building"
# The leagues kept this way: ESPN's path and the store's keys. An NBA season
# (about 1,300 games) is kept a month per record -- a whole one in a single
# record would pass the store's per-record limit (about 1MB).
LEAGUES = {
    "wnba": {"espn": ESPN, "key": LEAGUE_KEY, "lock": BUILD_LOCK_KEY, "monthly": False},
    "nba": {"espn": "https://site.api.espn.com/apis/site/v2/sports/basketball/nba",
            "key": "krazy_data:nba:v1:league:{season}", "lock": "krazy_data:nba:v1:league_building", "monthly": True},
}
BUILD_LOCK_SECONDS = 180
# A stored season older than this is topped up on the next read. Only newly
# finished games are fetched, so a top-up is a handful of requests.
REFRESH_SECONDS = 3 * 3600
# ...and sooner when a game on the stored schedule should be over by now but
# isn't recorded yet, so last night's game shows up within minutes of the
# final instead of up to three hours later. Checked at most this often.
FINISHED_AFTER_SECONDS = int(2.5 * 3600)
RECHECK_SECONDS = 10 * 60
# Same reasoning as the NFL board: stay well inside the 60s function limit,
# store what finished, and let the next build fetch the rest.
BUILD_DEADLINE_SECONDS = 40

# One player's line in one game, in this order.
FIELDS = ("min", "pts", "reb", "ast", "fgm", "fga", "tpm", "tpa", "ftm", "fta",
          "stl", "blk", "to", "pf", "oreb", "dreb")
# Shot zones, split the way the court is usually drawn.
ZONES = ("ra", "paint", "mid", "c3l", "c3r", "ab3")

_memory: dict = {}


def _store():
    from v2.board import store
    return store


def espn(path: str, params: dict | None = None, timeout: float = 15, league: str = "wnba"):
    response = requests.get(LEAGUES[league]["espn"] + path, params=params, headers={"Accept": "application/json"}, timeout=timeout)
    response.raise_for_status()
    return response.json()


def current_season(now: datetime | None = None, league: str = "wnba") -> int:
    """The season a page should show. Before tip-off, that is still last
    season -- an empty new season has nothing to compare against. WNBA
    seasons tip off in May; an NBA season (ESPN names it by the year it
    ends: 2026 is 2025-26) in late October."""
    now = now or datetime.now(timezone.utc)
    if league == "nba":
        return now.year + 1 if (now.month, now.day) >= (10, 21) else now.year
    return now.year if now.month >= 5 else now.year - 1


def setex(key: str, value: str, seconds: int) -> None:
    """SET with an expiry, so per-game caches clean themselves up."""
    store = _store()
    if not store.KV_URL or not store.KV_TOKEN:
        return
    try:
        requests.post(store.KV_URL.rstrip("/") + "/pipeline", json=[["SET", key, value, "EX", int(seconds)]],
                      headers=store._headers(), timeout=5)
    except Exception:  # noqa: BLE001 -- a cache write is never worth failing a page
        pass


_teams_memory: dict = {}


def team_directory(league: str = "wnba") -> dict:
    hit = _teams_memory.get(league)
    if hit and time.time() - hit[0] < 6 * 3600:
        return hit[1]
    teams = _fetch_team_directory(league)
    _teams_memory[league] = (time.time(), teams)
    return teams


def _fetch_team_directory(league: str = "wnba") -> dict:
    listing = espn("/teams", league=league)
    teams = {}
    for item in listing.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", []):
        team = item.get("team") or {}
        abbr = team.get("abbreviation")
        if not abbr:
            continue
        logo = next((logo.get("href") for logo in team.get("logos", []) if "default" in logo.get("rel", [])), None)
        teams[abbr] = {
            "id": str(team.get("id")), "abbr": abbr, "name": team.get("displayName"),
            "short": team.get("shortDisplayName") or team.get("name"), "logo": logo,
            "color": team.get("color"), "altColor": team.get("alternateColor"),
        }
    return teams


def schedule(season: int, teams: dict, league: str = "wnba") -> list[dict]:
    """Every regular-season and playoff game, finished or not. The All-Star
    game and preseason are left out -- neither says anything about how a
    team defends."""
    if league == "nba":
        return _team_schedules(season, teams)
    data = espn("/scoreboard", {"dates": str(season), "limit": 1000}, timeout=30)
    return _listing(data.get("events", []), teams)


def _team_schedules(season: int, teams: dict) -> list[dict]:
    """An NBA season from every team's own schedule (regular season and
    playoffs): a scoreboard asked for a year means the calendar year, and
    an NBA season spans two."""
    def load(job):
        team_id, kind = job
        try:
            events = espn(f"/teams/{team_id}/schedule", {"season": season, "seasontype": kind}, 20, league="nba").get("events", [])
        except Exception:  # noqa: BLE001 -- the next build asks again
            return []
        return [{**event, "season": {**(event.get("season") or {}), "type": kind}} for event in events]
    jobs = [(team["id"], kind) for team in teams.values() for kind in (2, 3)]
    events = {}
    with ThreadPoolExecutor(max_workers=12) as pool:
        for batch in pool.map(load, jobs):
            for event in batch:
                events.setdefault(str(event.get("id")), event)
    return _listing(events.values(), teams)


def _listing(events, teams: dict) -> list[dict]:
    known = {team["id"] for team in teams.values()}
    games = []
    for event in events:
        season_type = (event.get("season") or {}).get("type")
        if season_type not in (2, 3):
            continue
        competition = (event.get("competitions") or [{}])[0]
        sides = {c.get("homeAway"): c for c in competition.get("competitors", [])}
        home, away = sides.get("home"), sides.get("away")
        if not home or not away or {str(home["team"]["id"]), str(away["team"]["id"])} - known:
            continue
        status = (competition.get("status") or {}).get("type") or {}
        games.append({
            "id": str(event["id"]), "date": event.get("date"), "type": season_type,
            "completed": bool(status.get("completed")) and status.get("name") == "STATUS_FINAL",
            "home": home["team"]["abbreviation"], "away": away["team"]["abbreviation"],
        })
    games.sort(key=lambda game: game["date"] or "")
    return games


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    # Box scores are whole numbers; storing them as such keeps the season small.
    return int(number) if number.is_integer() else number


def _pair(value):
    made, _, attempted = str(value or "").partition("-")
    return _number(made), _number(attempted)


def zone_of(x: float, y: float, points: int) -> str:
    """ESPN puts shots on one half court in feet: x across (0-50, hoop at
    25), y out from the hoop. Calibrated against the distance in each play's
    own text ("makes 26-foot three pointer")."""
    across = x - 25
    if points == 3:
        # The straight part of the line in each corner.
        if y <= 7 and abs(across) >= 20:
            return "c3l" if across < 0 else "c3r"
        return "ab3"
    if math.hypot(across, y) <= 4:
        return "ra"
    if abs(across) <= 8 and y <= 14:
        return "paint"
    return "mid"


def extract_game(summary: dict, game: dict, players: dict) -> dict:
    """The compact record kept for one finished game. Fills `players` (the
    shared id -> [name, position, headshot, team] directory) on the way."""
    box = summary.get("boxscore") or {}
    record = {"id": game["id"], "date": game["date"], "type": game["type"],
              "home": game["home"], "away": game["away"], "t": {}}
    team_of_id = {}
    for side in box.get("players", []):
        abbr = (side.get("team") or {}).get("abbreviation")
        if not abbr:
            continue
        team_of_id[str(side["team"].get("id"))] = abbr
        stats = (side.get("statistics") or [{}])[0]
        keys = stats.get("keys") or []
        played, dnp = [], []
        for entry in stats.get("athletes", []):
            athlete = entry.get("athlete") or {}
            pid = str(athlete.get("id") or "")
            if not pid:
                continue
            players[pid] = [athlete.get("displayName") or athlete.get("shortName") or "",
                            ((athlete.get("position") or {}).get("abbreviation") or ""),
                            (athlete.get("headshot") or {}).get("href"), abbr]
            line = dict(zip(keys, entry.get("stats") or []))
            minutes = _number(line.get("minutes"))
            if entry.get("didNotPlay") or not line or not minutes:
                dnp.append(pid)
                continue
            fgm, fga = _pair(line.get("fieldGoalsMade-fieldGoalsAttempted"))
            tpm, tpa = _pair(line.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted"))
            ftm, fta = _pair(line.get("freeThrowsMade-freeThrowsAttempted"))
            values = {"min": minutes, "pts": _number(line.get("points")), "reb": _number(line.get("rebounds")),
                      "ast": _number(line.get("assists")), "fgm": fgm, "fga": fga, "tpm": tpm, "tpa": tpa,
                      "ftm": ftm, "fta": fta, "stl": _number(line.get("steals")), "blk": _number(line.get("blocks")),
                      "to": _number(line.get("turnovers")), "pf": _number(line.get("fouls")),
                      "oreb": _number(line.get("offensiveRebounds")), "dreb": _number(line.get("defensiveRebounds"))}
            played.append([pid, 1 if entry.get("starter") else 0] + [values[field] for field in FIELDS])
        record["t"][abbr] = {"p": played, "dnp": dnp, "z": []}
    # Shot locations, from the play-by-play. The first participant of a
    # shooting play is the shooter, also when it was blocked or assisted.
    zones: dict = {}
    for play in summary.get("plays", []):
        points = play.get("pointsAttempted")
        if not play.get("shootingPlay") or points not in (2, 3):
            continue
        participants = play.get("participants") or []
        team = team_of_id.get(str((play.get("team") or {}).get("id")))
        coordinate = play.get("coordinate") or {}
        x, y = coordinate.get("x"), coordinate.get("y")
        if not participants or not team or not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
            continue
        # Free throws and unlocated shots carry sentinel coordinates.
        if not (0 <= x <= 50 and -6 <= y <= 60):
            continue
        shooter = str((participants[0].get("athlete") or {}).get("id") or "")
        if not shooter:
            continue
        cell = zones.setdefault(team, {}).setdefault((shooter, zone_of(x, y, points)), [0, 0])
        cell[0] += 1 if play.get("scoringPlay") else 0
        cell[1] += 1
    for team, cells in zones.items():
        if team in record["t"]:
            record["t"][team]["z"] = [[pid, ZONES.index(zone), made, attempts]
                                      for (pid, zone), (made, attempts) in cells.items()]
    return record


# The KV store has a per-record limit; the same gzip envelope the NFL board
# uses keeps a full season comfortably inside it.
_GZIP_PREFIX = "gz:"


def _encode(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return _GZIP_PREFIX + base64.b64encode(gzip.compress(raw, 6)).decode("ascii")


def _decode(raw: str) -> dict:
    if raw.startswith(_GZIP_PREFIX):
        raw = gzip.decompress(base64.b64decode(raw[len(_GZIP_PREFIX):])).decode("utf-8")
    return json.loads(raw)


def _memory_key(season: int, league: str):
    # WNBA keeps its plain season key, which the tests and older callers use.
    return season if league == "wnba" else (league, season)


def _month_key(season: int, league: str, month: str) -> str:
    return LEAGUES[league]["key"].format(season=season) + f":{month}"


def stored(season: int, league: str = "wnba") -> dict | None:
    """The stored season, from this instance's memory when it is recent.
    Monthly leagues keep the schedule, teams and players in one record and
    each month's games in its own; they are read side by side."""
    cached = _memory.get(_memory_key(season, league))
    if cached and time.time() - cached[0] < 300:
        return cached[1]
    try:
        raw = _store().get(LEAGUES[league]["key"].format(season=season))
        value = _decode(raw) if raw else None
        if value and LEAGUES[league]["monthly"]:
            def month(name):
                blob = _store().get(_month_key(season, league, name))
                return _decode(blob) if blob else {}
            with ThreadPoolExecutor(max_workers=6) as pool:
                games = {}
                for part in pool.map(month, value.get("months") or []):
                    games.update(part)
            value = {**value, "games": games}
    except Exception:  # noqa: BLE001 -- an outage or unreadable record is "nothing stored"
        value = None
    if value:
        _memory[_memory_key(season, league)] = (time.time(), value)
    return value


def _save(season: int, payload: dict, league: str, changed: set) -> tuple[bool, int]:
    """Write the season: one record, or (monthly) the months with new games
    and the record naming every month. Returns (stored, bytes written)."""
    store = _store()
    if not LEAGUES[league]["monthly"]:
        blob = _encode(payload)
        return bool(store.set(LEAGUES[league]["key"].format(season=season), blob)), len(blob)
    months = {}
    for game_id, game in (payload.get("games") or {}).items():
        months.setdefault(str(game.get("date") or "")[:7] or "undated", {})[game_id] = game
    ok, size = True, 0
    for name in sorted(months):
        if name not in changed:
            continue
        blob = _encode(months[name])
        size += len(blob)
        ok = bool(store.set(_month_key(season, league, name), blob)) and ok
    meta = {key: value for key, value in payload.items() if key not in ("games", "stored", "storedBytes")}
    meta["months"] = sorted(months)
    blob = _encode(meta)
    return bool(store.set(LEAGUES[league]["key"].format(season=season), blob)) and ok, size + len(blob)


def build(season: int, deadline_seconds: float | None = BUILD_DEADLINE_SECONDS, store: bool = True,
          league: str = "wnba") -> dict:
    """Top up (or create) the stored season with every newly finished game."""
    started = time.monotonic()
    previous = stored(season, league) or {}
    games = dict(previous.get("games") or {})
    players = dict(previous.get("players") or {})
    teams = team_directory(league)
    listing = schedule(season, teams, league)
    missing = [game for game in listing if game["completed"] and game["id"] not in games]
    failed, partial = [], False
    if missing:
        executor = ThreadPoolExecutor(max_workers=12)
        try:
            futures = [(game, executor.submit(espn, "/summary", {"event": game["id"]}, 20, league)) for game in missing]
            for game, future in futures:
                remaining = None
                if deadline_seconds is not None:
                    remaining = deadline_seconds - (time.monotonic() - started)
                    if remaining <= 0:
                        partial = True
                        break
                try:
                    games[game["id"]] = extract_game(future.result(timeout=remaining), game, players)
                except FuturesTimeout:
                    partial = True
                    break
                except Exception:  # noqa: BLE001 -- one bad game must not lose the season
                    failed.append(game["id"])
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
    payload = {
        "season": season, "league": league, "builtAt": datetime.now(timezone.utc).isoformat(), "teams": teams,
        "schedule": listing, "games": games, "players": players,
        "partial": partial or bool(failed), "failed": failed,
    }
    if store:
        # Only months that gained games are rewritten (a new build writes them all).
        changed = {str((games.get(game["id"]) or {}).get("date") or "")[:7] or "undated"
                   for game in missing if game["id"] in games}
        if not previous:
            changed |= {str(game.get("date") or "")[:7] or "undated" for game in games.values()}
        try:
            payload["stored"], payload["storedBytes"] = _save(season, payload, league, changed)
        except Exception:  # noqa: BLE001 -- report it, keep serving what was built
            payload["stored"] = False
        _memory[_memory_key(season, league)] = (time.time(), payload)
    return payload


def _age_seconds(payload: dict) -> float:
    try:
        return (datetime.now(timezone.utc) - datetime.fromisoformat(payload["builtAt"])).total_seconds()
    except Exception:  # noqa: BLE001
        return float("inf")


def _locked(league: str = "wnba") -> bool:
    try:
        raw = _store().get(LEAGUES[league]["lock"])
        return bool(raw) and time.time() - float(raw) < BUILD_LOCK_SECONDS
    except Exception:  # noqa: BLE001
        return False


def _set_lock(value: str, league: str = "wnba") -> None:
    try:
        _store().set(LEAGUES[league]["lock"], value)
    except Exception:  # noqa: BLE001
        pass


def _game_due(payload: dict) -> bool:
    """A game that should have finished but isn't recorded. Only recent ones
    count, so a long-postponed game can't make every read re-check."""
    now = datetime.now(timezone.utc)
    recorded = payload.get("games") or {}
    for game in payload.get("schedule") or []:
        if game["id"] in recorded:
            continue
        try:
            started = datetime.fromisoformat(str(game.get("date")).replace("Z", "+00:00"))
        except ValueError:
            continue
        if FINISHED_AFTER_SECONDS < (now - started).total_seconds() < 2 * 86400:
            return True
    return False


def ensure(season: int, league: str = "wnba") -> dict | None:
    """The stored season, topped up first when it is stale or unfinished.

    A reader only ever waits on a top-up (a few newly finished games); the
    full backfill is the cron's job. Another instance already building
    means serving what is stored now."""
    payload = stored(season, league)
    age = _age_seconds(payload) if payload else float("inf")
    stale = age >= REFRESH_SECONDS or (age >= RECHECK_SECONDS and _game_due(payload))
    if payload and not payload.get("partial") and not stale:
        return payload
    if payload and payload.get("partial") and _age_seconds(payload) < 60:
        return payload
    if _locked(league):
        return payload
    _set_lock(str(time.time()), league)
    try:
        return build(season, league=league)
    except Exception:  # noqa: BLE001 -- ESPN down: keep serving the stored season
        return payload
    finally:
        _set_lock("0", league)
