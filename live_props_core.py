"""Small MLB lookups for autocomplete and the finder; no analysis-engine import."""
import json
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from backend.vortextime import vortex_day, vortex_board_day

_cache = {}
_locks = {}
_guard = Lock()


def cached(key, ttl, loader):
    with _guard:
        lock = _locks.setdefault(key, Lock())
    with lock:
        entry = _cache.get(key)
        if entry and time.time() - entry[0] < ttl:
            return entry[1]
        result = loader()
        _cache[key] = (time.time(), result)
        return result


def mlb(path, params):
    error = None
    for base in ("https://mlb-proxy.damian209466-d45.workers.dev/api/v1", "https://statsapi.mlb.com/api/v1"):
        try:
            request = Request(base + path + "?" + urlencode(params), headers={"Accept": "application/json"})
            with urlopen(request, timeout=7) as response:
                return json.load(response)
        except Exception as exc:
            error = exc
    raise error


def name_key(value):
    return "".join(c for c in unicodedata.normalize("NFKD", str(value)).lower() if c.isalnum() and not unicodedata.combining(c))


def player_catalog():
    year = int(vortex_day()[:4])
    def load():
        people = mlb("/sports/1/players", {"season": year, "hydrate": "currentTeam"}).get("people", [])
        return [{"id": p["id"], "name": p["fullName"], "team": p.get("currentTeam", {}).get("name", ""),
                 "team_id": p.get("currentTeam", {}).get("id"), "position": p.get("primaryPosition", {}).get("abbreviation", "")}
                for p in people if p.get("id") and p.get("fullName") and p.get("currentTeam", {}).get("id")]
    return cached(("roster", year), 21600, load)


def search_players(query, limit=10):
    key = name_key(query)
    if len(key) < 2:
        return []
    return sorted((p for p in player_catalog() if key in name_key(p["name"])),
                  key=lambda p: (not name_key(p["name"]).startswith(key), p["name"]))[:limit]


def player_history(name, group):
    if group not in {"pitching", "hitting"}:
        raise ValueError("Unknown player group")
    matches = [p for p in player_catalog() if name_key(p["name"]) == name_key(name)]
    if len(matches) != 1:
        raise ValueError("Player could not be uniquely resolved")
    player = matches[0]
    day = vortex_board_day()
    year = int(vortex_day()[:4])

    def load():
        def season_log(season):
            payload = mlb(f"/people/{player['id']}/stats", {"stats": "gameLog", "group": group, "season": season})
            return [split for item in payload.get("stats", []) for split in item.get("splits", [])]
        # One request per season contains every market for this player.
        with ThreadPoolExecutor(max_workers=2) as pool:
            seasons = list(pool.map(season_log, [year, year - 1]))
        games = []
        seen = set()
        for split in seasons[0] + seasons[1]:
            stat = split.get("stat") or {}
            game_id = split.get("game", {}).get("gamePk")
            identity = game_id or (split.get("date"), split.get("opponent", {}).get("id"))
            if identity in seen:
                continue
            if group == "pitching" and not stat.get("gamesStarted"):
                continue
            if group == "hitting" and not stat.get("plateAppearances"):
                continue
            # Exclude the board's game day: in-progress results are not history.
            if not split.get("date") or split["date"] >= day:
                continue
            seen.add(identity)
            games.append({"date": split["date"], "gameId": game_id, "isHome": split.get("isHome"),
                          "opponent": split.get("opponent", {}), "stat": stat})
        games.sort(key=lambda g: (g["date"], g["gameId"] or 0))
        return games

    games = cached(("history", player["id"], group, day), 600, load)
    schedule = cached(("schedule", day), 120, lambda: mlb("/schedule", {"sportId": 1, "date": day}))
    matchup = None
    for date in schedule.get("dates", []):
        for game in date.get("games", []):
            teams = game.get("teams", {})
            for own, other in (("home", "away"), ("away", "home")):
                if teams.get(own, {}).get("team", {}).get("id") == player["team_id"]:
                    matchup = {"opponent": teams.get(other, {}).get("team", {}), "isHome": own == "home",
                               "gameId": game.get("gamePk"), "startTime": game.get("gameDate")}
                    break
    return {"player": player, "games": games, "matchup": matchup, "season": year, "boardDay": day,
            "h2hLabel": f"{year - 1}–{year} vs today's opponent", "updatedAt": int(time.time() * 1000)}
