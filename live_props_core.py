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


# First-inning props (hits / runs / pitches / walks / strikeouts allowed in
# the 1st) are not in MLB's game logs. They are read per start from the
# game's line score and play-by-play -- only when one of those markets is
# opened, and only for the most recent starts a chart can show.
FIRST_INNING_STARTS = 25
FIRST_INNING_FIELDS = "allPlays,about,inning,matchup,pitcher,id,playEvents,isPitch,result,eventType"


def first_inning(game_pk, pitcher_id, is_home):
    """The starter's first inning in one game, or None when MLB has no line
    score for it. The opposing half of the 1st is the starter's inning."""
    def load():
        linescore = mlb(f"/game/{game_pk}/linescore", {})
        first = next((inning for inning in linescore.get("innings") or [] if inning.get("num") == 1), None)
        if first is None:
            return None
        batting = first.get("away" if is_home else "home") or {}
        result = {"firstInningHits": batting.get("hits"), "firstInningRuns": batting.get("runs")}
        try:
            plays = mlb(f"/game/{game_pk}/playByPlay", {"fields": FIRST_INNING_FIELDS}).get("allPlays") or []
        except Exception:  # noqa: BLE001 -- hits and runs still stand
            return result
        pitches = walks = strikeouts = 0
        for play in plays:
            pitcher = ((play.get("matchup") or {}).get("pitcher") or {}).get("id")
            if (play.get("about") or {}).get("inning") != 1 or pitcher != pitcher_id:
                continue
            pitches += sum(1 for event in play.get("playEvents") or [] if event.get("isPitch"))
            kind = (play.get("result") or {}).get("eventType")
            walks += kind in ("walk", "intent_walk")
            strikeouts += kind in ("strikeout", "strikeout_double_play")
        return {**result, "firstInningPitches": pitches, "firstInningWalks": walks, "firstInningStrikeouts": strikeouts}
    # A finished game never changes.
    return cached(("first-inning", game_pk, pitcher_id), 7 * 86400, load)


def with_first_inning(games, pitcher_id):
    """Each recent start with its first-inning numbers added to `stat`."""
    recent = [game for game in games if game.get("gameId")][-FIRST_INNING_STARTS:]
    def load(game):
        try:
            return game["gameId"], first_inning(game["gameId"], pitcher_id, bool(game.get("isHome")))
        except Exception:  # noqa: BLE001 -- one missing game is a gap, not a failure
            return game["gameId"], None
    with ThreadPoolExecutor(max_workers=8) as pool:
        extra = dict(pool.map(load, recent))
    return [{**game, "stat": {**game["stat"], **(extra.get(game.get("gameId")) or {})}} for game in games]


def player_history(name, group, first_inning_stats=False):
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
    if first_inning_stats and group == "pitching":
        games = with_first_inning(games, player["id"])
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
