"""The Finder's NHL lines, from PrizePicks' NHL feed.

Each line comes as PrizePicks posts it -- its stat name, tier and opponent --
pinned to its game on the NHL's schedule and to the player's NHL id on his
team's roster (nhl_research.py), so the Finder can load the team's recent
games for the hit rates and the player page.
"""
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from prizepicks_export_core import _fetch_projection_rows
import nhl_research as nhl

VERSION = "nhl-board-v1"
CACHE_SECONDS = 5 * 60
_cache = {"at": 0.0, "value": None}
_lock = threading.Lock()

# PrizePicks' NHL stat names (lowercased, letters and digits only) -> the
# game-log value each one settles on (nhl_research.parse_game).
MARKETS = {
    "points": "points", "goals": "goals", "assists": "assists", "shotsongoal": "sog", "sog": "sog",
    "hits": "hits", "blockedshots": "blocked", "blocks": "blocked", "timeonice": "toi", "toi": "toi",
    "faceoffswon": "fow", "faceoffs": "faceoffs", "faceoffstaken": "faceoffs", "powerplaypoints": "ppp",
    "shotattempts": "attempts", "shotsattempted": "attempts", "penaltyminutes": "pim", "plusminus": "plus_minus",
    "goaliesaves": "saves", "saves": "saves", "goalsallowed": "ga", "goalsagainst": "ga", "fantasyscore": "fantasy",
    "hitsblockedshots": "hits_blocks", "blockedshotshits": "hits_blocks",
    "1stperiodpoints": "points_1p", "1stperiodgoals": "goals_1p", "1stperiodassists": "assists_1p",
    "1stperiodshotsongoal": "sog_1p", "1stperiodsog": "sog_1p", "1stperiodsaves": "saves_1p",
    "1stperiodgoaliesaves": "saves_1p", "1stperiodgoalsallowed": "ga_1p",
    "goalsallowedinfirst10minutes": "ga_first10", "goalsallowedfirst10minutes": "ga_first10",
}


def market_key(stat):
    return re.sub(r"[^a-z0-9]", "", str(stat or "").lower())


def value_key(stat):
    """The game-log value a PrizePicks stat settles on, or None."""
    return MARKETS.get(market_key(stat))


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _projections():
    try:
        return _fetch_projection_rows(league="NHL")
    except RuntimeError as error:
        # "no active projections" -- an empty slate, not an outage.
        if "no active" in str(error).lower():
            return []
        raise


def _schedule(projections, now):
    """The NHL games the lines can belong to: the schedule weeks covering
    every start time on the board."""
    days = sorted({(datetime.fromtimestamp(stamp, timezone.utc) - timedelta(hours=10)).date()
                   for line in projections if (stamp := _timestamp(line.get("start_time"))) is not None and stamp > now})
    weeks, games = [], {}
    for day in days:
        if not weeks or (day - weeks[-1]).days >= 7:
            weeks.append(day)
    for day in weeks:
        for item in nhl.schedule_day(day.isoformat()):
            games[item["id"]] = item
    return list(games.values())


def _rosters(teams):
    codes = sorted({nhl.canonical(code) for code in teams if nhl.valid_team(code)})
    rosters = {}

    def load(code):
        try:
            return code, nhl.roster(code)
        except Exception:  # noqa: BLE001 -- one roster missing leaves those lines unmatched
            return code, {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for code, players in pool.map(load, codes):
            rosters[code] = players
    return rosters


def build(projections=None, now=None, games=None, rosters=None):
    """Every upcoming single-player NHL line PrizePicks posts."""
    now = now or time.time()
    projections = _projections() if projections is None else projections
    live = [line for line in projections if not line.get("combo")]
    if games is None:
        try:
            games = _schedule(live, now)
        except Exception:  # noqa: BLE001 -- the lines still show, unmatched
            games = []
    if rosters is None:
        rosters = _rosters({line.get("team") for line in live} | {line.get("description") for line in live})
    rows, matched = [], {}
    for line in live:
        starts = _timestamp(line.get("start_time"))
        if starts is not None and starts <= now:
            continue
        try:
            value = float(line.get("line"))
        except (TypeError, ValueError):
            continue
        team, opponent = nhl.canonical(line.get("team")), nhl.canonical(line.get("description"))
        found = nhl.find_game(team, opponent, starts or now, games) if nhl.valid_team(team) else None
        key = (line.get("player"), team)
        if key not in matched:
            matched[key] = nhl.match_player(line.get("player"), team, rosters)
        player = matched[key]
        player_id, player_team = player if player else (None, team)
        info = (rosters.get(player_team) or {}).get(player_id) or {}
        tier = str(line.get("odds_type") or "standard").lower()
        game = {}
        if found:
            opponent = found["away"] if found["home"] == team else found["home"]
            game = {"gameId": found["id"], "homeTeamAbbr": found["home"], "awayTeamAbbr": found["away"],
                    "isHome": found["home"] == team, "gameKind": nhl.KIND.get(found["gameType"], "other")}
        rows.append({
            "id": f"pp:{line.get('id')}", "player": line.get("player"), "playerId": player_id,
            "team": team or None, "teamName": nhl.TEAMS.get(team) or line.get("team_name") or None, "teamLogo": nhl.logo(team) if nhl.valid_team(team) else None,
            "opponent": opponent or None, "opponentName": nhl.TEAMS.get(opponent), "opponentLogo": nhl.logo(opponent) if nhl.valid_team(opponent) else None,
            "position": nhl.POSITION_NAMES.get(info.get("pos"), info.get("pos")) or line.get("position") or None, "number": info.get("number"),
            "headshot": info.get("headshot") or line.get("headshot") or None,
            "stat": line.get("stat"), "marketKey": market_key(line.get("stat")), "valueKey": value_key(line.get("stat")),
            "line": value, "modifier": tier,
            "startsAt": datetime.fromtimestamp(starts, timezone.utc).isoformat() if starts is not None else None,
            "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None, "modifier": tier,
                      "updatedAt": line.get("updated_at") or None}],
            **game,
        })
    rows.sort(key=lambda row: (row["startsAt"] or "", row["player"] or "", row["stat"] or "", row["line"]))
    return {"builtAt": datetime.now(timezone.utc).isoformat(), "source": "prizepicks", "rows": rows, "version": VERSION,
            "season": nhl.season_id()}


def board():
    """build(), shared for a few minutes across requests on a warm instance."""
    now = time.time()
    with _lock:
        if _cache["value"] is not None and now - _cache["at"] < CACHE_SECONDS:
            return _cache["value"]
    value = build(now=now)
    with _lock:
        _cache.update(at=now, value=value)
    return value
