"""NBA player tracking: the chances behind a stat as the NBA's own cameras
count them -- potential assists (passes a teammate shot off, made or not),
rebound chances (rebounds he was close enough to get), catch-and-shoot and
pull-up shots, touches and time with the ball. From stats.nba.com, the
NBA's stats site; the WNBA has no such feed.

The site's servers may not reach it: stats.nba.com is known to turn away
requests from cloud hosts. So it is asked with a short timeout, an answer
is kept for six hours, and a refusal is remembered for an hour so pages
don't keep waiting on it. Nothing depends on it: without it, the
opportunity card shows the box-score numbers (opportunity.py) alone.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import requests

URL = "https://stats.nba.com/stats/leaguedashptstats"
# What stats.nba.com expects from a browser on nba.com.
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nba.com", "Referer": "https://www.nba.com/",
    "x-nba-stats-origin": "stats", "x-nba-stats-token": "true",
}
TIMEOUT = (4, 9)
KEEP_SECONDS = 6 * 3600
DOWN_SECONDS = 3600
KEY = "krazy_data:nba:v2:tracking:{season}"
DOWN_KEY = "krazy_data:nba:v2:tracking-down:{season}"
# A season with fewer of his games than this reads last season's instead.
MIN_GAMES = 5
RECENT = 10

# Each tracking table, and what's kept from it: its column -> our name.
MEASURES = {
    "Passing": {"POTENTIAL_AST": "potentialAst", "AST": "ast", "AST_POINTS_CREATED": "astPts", "PASSES_MADE": "passes",
                "SECONDARY_AST": "secondaryAst", "FT_AST": "ftAst"},
    "Rebounding": {"REB_CHANCES": "chances", "REB": "reb", "REB_CHANCE_PCT": "chancePct", "REB_CONTEST": "contested",
                   "REB_UNCONTEST": "uncontested", "REB_CONTEST_PCT": "contestedPct", "OREB_CHANCES": "orebChances",
                   "DREB_CHANCES": "drebChances"},
    "CatchShoot": {"CATCH_SHOOT_FGA": "fga", "CATCH_SHOOT_FG3A": "fg3a", "CATCH_SHOOT_FG3_PCT": "fg3Pct", "CATCH_SHOOT_PTS": "pts"},
    "PullUpShot": {"PULL_UP_FGA": "fga", "PULL_UP_FG3A": "fg3a", "PULL_UP_FG3_PCT": "fg3Pct", "PULL_UP_PTS": "pts"},
    "Possessions": {"TOUCHES": "touches", "TIME_OF_POSS": "timeOfPoss", "AVG_SEC_PER_TOUCH": "secPerTouch",
                    "POINTS_PER_TOUCH": "ptsPerTouch", "PAINT_TOUCHES": "paintTouches"},
}
GROUP = {"Passing": "passing", "Rebounding": "rebounding", "CatchShoot": "catchShoot", "PullUpShot": "pullUp", "Possessions": "touches"}
# The last ten games, for the two that move most with a role.
RECENT_MEASURES = ("Passing", "Rebounding")
# stats.nba.com gives these as fractions; shown as percentages.
FRACTIONS = {"chancePct", "contestedPct", "fg3Pct"}
# ESPN's abbreviations where the NBA's differ.
TEAM_CODES = {"GS": "GSW", "NO": "NOP", "NY": "NYK", "SA": "SAS", "UTAH": "UTA", "WSH": "WAS"}


def season_label(season: int) -> str:
    """ESPN names a season by the year it ends (2026); the NBA as 2025-26."""
    return f"{season - 1}-{str(season)[-2:]}"


def name_key(name: str) -> str:
    """A name as both sites can agree on: no accents, punctuation or suffix."""
    plain = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    words = [word for word in re.sub(r"[^a-z ]", " ", plain.replace("'", "").replace(".", "")).split()
             if word not in ("jr", "sr", "ii", "iii", "iv", "v")]
    return " ".join(words)


def parse(payload: dict) -> list[dict]:
    """A stats.nba.com answer's first table, as rows keyed by column."""
    sets = payload.get("resultSets") or payload.get("resultSet") or []
    table = sets[0] if isinstance(sets, list) and sets else sets if isinstance(sets, dict) else {}
    headers = table.get("headers") or []
    return [dict(zip(headers, row)) for row in table.get("rowSet") or []]


def _params(measure: str, season: int, last: int) -> dict:
    return {"College": "", "Conference": "", "Country": "", "DateFrom": "", "DateTo": "", "Division": "", "DraftPick": "",
            "DraftYear": "", "GameScope": "", "Height": "", "LastNGames": last, "LeagueID": "00", "Location": "", "Month": 0,
            "OpponentTeamID": 0, "Outcome": "", "PORound": 0, "PerMode": "PerGame", "PlayerExperience": "",
            "PlayerOrTeam": "Player", "PlayerPosition": "", "PtMeasureType": measure, "Season": season_label(season),
            "SeasonSegment": "", "SeasonType": "Regular Season", "StarterBench": "", "TeamID": 0, "VsConference": "",
            "VsDivision": "", "Weight": ""}


def _relayed(endpoint, params):
    """The copy of an NBA.com table the admin's phone sent (nba_relay.py), or None."""
    try:
        import nba_relay
    except ImportError:
        return None
    return nba_relay.rows(endpoint, params)


def _refuse(*_args, **_kwargs):
    raise requests.ConnectionError("NBA.com is known to be down for the site.")


def _fetch(job, get=requests.get):
    measure, season, last = job
    relayed = _relayed("leaguedashptstats", _params(measure, season, last))
    if relayed is not None:
        return job, relayed
    response = get(URL, params=_params(measure, season, last), headers=HEADERS, timeout=TIMEOUT)
    response.raise_for_status()
    return job, parse(response.json())


def _value(key, value):
    if not isinstance(value, (int, float)):
        return None
    return round(value * 100, 1) if key in FRACTIONS else round(value, 2)


def build(season: int, get=requests.get) -> dict:
    """Every player's tracking for a season: {name key: [entry, ...]} (a
    list, for the rare two players with one name). Raises when the NBA's
    site can't be had."""
    jobs = [(measure, season, 0) for measure in MEASURES] + [(measure, season, RECENT) for measure in RECENT_MEASURES]
    with ThreadPoolExecutor(max_workers=len(jobs)) as pool:
        answers = list(pool.map(lambda job: _fetch(job, get), jobs))
    players: dict = {}
    for (measure, _season, last), rows in answers:
        for row in rows:
            pid = str(row.get("PLAYER_ID") or "")
            if not pid:
                continue
            entry = players.setdefault(pid, {"name": row.get("PLAYER_NAME"), "team": row.get("TEAM_ABBREVIATION"),
                                             "games": None, "min": None})
            values = {ours: _value(ours, row.get(theirs)) for theirs, ours in MEASURES[measure].items()}
            if last:
                recent = entry.setdefault("recent", {})
                recent["games"] = row.get("GP")
                recent[GROUP[measure]] = values
            else:
                entry[GROUP[measure]] = values
                entry["games"] = entry["games"] or row.get("GP")
                entry["min"] = entry["min"] or _value("min", row.get("MIN"))
    by_name: dict = {}
    for entry in players.values():
        by_name.setdefault(name_key(entry["name"]), []).append(entry)
    return {"season": season, "label": season_label(season), "builtAt": time.time(), "players": by_name}


def _store():
    from v2.board import store
    return store


def table(season: int, get=requests.get, store=None) -> dict | None:
    """The season's tracking, kept six hours; None when the NBA's site
    can't be reached (remembered for an hour)."""
    store = store or _store()
    try:
        raw = store.get(KEY.format(season=season))
        if raw:
            kept = json.loads(raw)
            if time.time() - float(kept.get("builtAt") or 0) < KEEP_SECONDS:
                return kept
        down = bool(store.get(DOWN_KEY.format(season=season)))
    except Exception:  # noqa: BLE001 -- no cache, ask the site
        down = False
    try:
        # While NBA.com is down for the site, only what the phone sent.
        built = build(season, _refuse if down else get)
    except Exception:  # noqa: BLE001 -- refused, timed out or changed: remembered as down
        try:
            store.pipeline([["SET", DOWN_KEY.format(season=season), "1", "EX", DOWN_SECONDS]], timeout=5)
        except Exception:  # noqa: BLE001
            pass
        return None
    try:
        store.pipeline([["SET", KEY.format(season=season), json.dumps(built, separators=(",", ":")), "EX", 2 * KEEP_SECONDS]], timeout=5)
    except Exception:  # noqa: BLE001 -- a cache write is never worth failing a page
        pass
    return built


def find(built: dict | None, name: str, team: str = "") -> dict | None:
    """His entry, by name (and team, when two share one)."""
    if not built:
        return None
    found = (built.get("players") or {}).get(name_key(name)) or []
    if len(found) > 1 and team:
        code = TEAM_CODES.get(team.upper(), team.upper())
        found = [entry for entry in found if entry.get("team") == code] or found
    return found[0] if found else None


def player(season: int, name: str, team: str = "", get=requests.get, store=None) -> dict:
    """His tracking this season, or last season's when this one has too few
    of his games. {"available": False, "reason": ...} when it can't be had."""
    built = table(season, get, store)
    if built is None:
        return {"available": False, "reason": "unreachable"}
    entry = find(built, name, team)
    label = built.get("label")
    mine = (entry or {}).get("games") or 0
    if mine < MIN_GAMES:
        before = table(season - 1, get, store)
        earlier = find(before, name, team)
        if earlier and (earlier.get("games") or 0) > mine:
            entry, label = earlier, before.get("label")
    if not entry:
        return {"available": False, "reason": "not-found"}
    return {"available": True, "season": label, **entry}
