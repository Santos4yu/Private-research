"""Each NFL team's offense and defense a game, from nflverse's play-by-play:
plays, EPA, success, dropbacks and runs, turnovers; and each quarterback's
dropbacks and EPA a game. The Game Predictor's NFL ratings read these
(game_predictor.py, predictor_nfl.py).

Counted the usual way: designed runs and dropbacks (passes, sacks and
scrambles), without kneel-downs, spikes or two-point tries. A play with no
EPA is left out (never counted as 0). Built once a day by the NFL plays
cron (api/v2-admin.py) and kept; a finished season is kept for two weeks
at a time, the same as nfl_plays.py's table.
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timezone

from backend.sports.nfl.cache import NFLCacheDomain, cached_nfl, store_nfl
from backend.sports.nfl.services.nflverse import RELEASE, canonical_team

VERSION = "nfl-team-epa-v1"
FIELDS = ("game_id", "season_type", "week", "posteam", "defteam", "play_type", "qb_dropback", "qb_kneel", "qb_spike",
          "two_point_attempt", "epa", "qb_epa", "success", "interception", "fumble_lost", "id", "passer_player_name", "name")


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def summarize(plays) -> dict:
    """{teams: [{game, team, side, plays, epa, succ, db, db_epa, rush, rush_epa, to}], qbs: [{game, team, qb, name, db, epa}]}."""
    teams = defaultdict(lambda: defaultdict(float))
    qbs = defaultdict(lambda: defaultdict(float))
    names, kinds = {}, {}
    for row in plays:
        if row.get("play_type") not in ("pass", "run") or "1" in (row.get("qb_kneel"), row.get("qb_spike"), row.get("two_point_attempt")):
            continue
        epa = _num(row.get("epa"))
        game, offense, defense = row.get("game_id"), canonical_team(row.get("posteam")), canonical_team(row.get("defteam"))
        if epa is None or not game or not offense or not defense:
            continue
        kinds[game] = row.get("season_type") or ""
        dropback = row.get("qb_dropback") == "1"
        success = _num(row.get("success")) or 0.0
        turnover = (row.get("interception") == "1") + (row.get("fumble_lost") == "1")
        for side, team in (("o", offense), ("d", defense)):
            cell = teams[(game, team, side)]
            cell["plays"] += 1
            cell["epa"] += epa
            cell["succ"] += success
            cell["to"] += turnover
            if dropback:
                cell["db"] += 1
                cell["db_epa"] += epa
            else:
                cell["rush"] += 1
                cell["rush_epa"] += epa
        if dropback and row.get("id"):
            cell = qbs[(game, offense, row["id"])]
            cell["db"] += 1
            qb_epa = _num(row.get("qb_epa"))
            cell["epa"] += qb_epa if qb_epa is not None else epa
            names[row["id"]] = row.get("passer_player_name") or row.get("name") or names.get(row["id"], "")
    return {"teams": [{"game": game, "team": team, "side": side, "kind": kinds.get(game, ""), **{k: round(v, 4) for k, v in cell.items()}}
                      for (game, team, side), cell in teams.items()],
            "qbs": [{"game": game, "team": team, "qb": qb, "name": names.get(qb, ""), **{k: round(v, 4) for k, v in cell.items()}}
                    for (game, team, qb), cell in qbs.items()],
            "builtAt": datetime.now(timezone.utc).isoformat()}


def build(season: int) -> dict:
    import nfl_plays
    rows = nfl_plays._read(f"{RELEASE}/pbp/play_by_play_{season}.csv.gz", FIELDS, gz=True)
    value = summarize(rows or [])
    if not value["teams"]:
        raise LookupError(f"No play-by-play for {season} yet")
    return {**value, "season": season, "version": VERSION}


def _domain(season):
    import nfl_plays
    return NFLCacheDomain.PLAYS if season >= nfl_plays.season_now() else NFLCacheDomain.PLAYS_PAST


def table(season: int) -> dict:
    """The season's table: the stored one, else built now (and kept)."""
    return cached_nfl(_domain(season), (VERSION, "teams", season), lambda: build(season))


def refresh(season: int):
    """Build and store now (the daily cron). Returns (bytes, stored)."""
    return store_nfl(_domain(season), (VERSION, "teams", season), build(season))


def stored(season: int, max_age_days: float = 9.0):
    """The season's table if one has been built and kept (never builds it:
    a request can't wait on streaming a season of play-by-play); None when
    there's none yet. A current season's older than `max_age_days` is
    still returned (the predictor shows its age)."""
    from backend.sports.nfl import cache
    key = cache.nfl_cache_key(_domain(season), VERSION, "teams", season)
    hit = cache._memory.get(key)
    if hit:
        return hit[1]
    ttl = (max_age_days if _domain(season) == NFLCacheDomain.PLAYS else 120) * 86400
    value = cache._kv_get(key, ttl)
    if value is not None:
        with cache._lock:
            cache._memory[key] = (time.time(), value)
    return value
