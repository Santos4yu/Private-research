"""The Finder's college football lines, from PrizePicks' CFB feed.

Each line comes as PrizePicks posts it -- its stat name, tier and opponent --
pinned to its game on ESPN's FBS scoreboard and to the player's ESPN id
(from his team's roster; cfb_research.py), so the Finder can load the
team's games for the hit rates and the player page. Stat names map the way
the NFL board's do (backend/sports/nfl/markets.py). A line whose game or
player can't be matched still shows, without hit rates.
"""
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from prizepicks_export_core import _fetch_projection_rows
from backend.sports.nfl import markets
import cfb_research as cfb

VERSION = "cfb-board-v1"
CACHE_SECONDS = 5 * 60
_cache = {"at": 0.0, "value": None}
_lock = threading.Lock()


def market_key(stat):
    return re.sub(r"[^a-z0-9]", "", str(stat or "").lower())


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _projections():
    try:
        return _fetch_projection_rows(league="CFB")
    except RuntimeError as error:
        # "no active projections" -- an empty slate, not an outage.
        if "no active" in str(error).lower():
            return []
        raise


def _schedule(lines, now):
    """The FBS games the lines can belong to: each US Eastern date with a
    start time on the board, and the day before (a late kickoff)."""
    days = set()
    for line in lines:
        stamp = _timestamp(line.get("start_time"))
        if stamp is None or stamp <= now:
            continue
        day = datetime.fromtimestamp(stamp, cfb.EASTERN).date()
        days.update({day, day - timedelta(days=1)})
    games = {}
    for day in sorted(days):
        try:
            for item in cfb.schedule_day(day):
                games[item["id"]] = item
        except Exception:  # noqa: BLE001 -- one day missing leaves its lines unmatched
            continue
    return list(games.values())


def _rosters(team_ids):
    out = {}

    def load(team):
        try:
            return team, cfb.roster(team)
        except Exception:  # noqa: BLE001 -- one roster missing leaves those lines unmatched
            return team, {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for team, players in pool.map(load, sorted(team_ids)):
            out[team] = players
    return out


def _place(line, games, now):
    """(game, side) for a line: by its team, else (resolved later) by whose
    roster has the player."""
    starts = _timestamp(line.get("start_time")) or now
    return cfb.find_game(starts, games, line.get("team") or "", line.get("team_name") or "", line.get("description") or "")


def build(projections=None, now=None, games=None, rosters=None):
    """Every upcoming single-player CFB line PrizePicks posts."""
    now = now or time.time()
    projections = _projections() if projections is None else projections
    live = [line for line in projections if not line.get("combo")]
    live = [line for line in live if (_timestamp(line.get("start_time")) or now + 1) > now]
    if games is None:
        games = _schedule(live, now)
    placed = {}
    for line in live:
        key = (line.get("team"), line.get("team_name"), line.get("description"), line.get("start_time"))
        if key not in placed:
            placed[key] = _place(line, games, now)
    # Rosters: every team a line was placed with, and both sides of the
    # games kicking off with a line that couldn't be placed by its team.
    wanted = {game[side]["id"] for game, side in placed.values() if game}
    unplaced_starts = {_timestamp(line.get("start_time")) for line in live
                       if not placed[(line.get("team"), line.get("team_name"), line.get("description"), line.get("start_time"))][0]}
    nearby = [game for game in games for stamp in unplaced_starts
              if stamp and (kick := _timestamp(game["start"])) is not None and abs(kick - stamp) <= 30 * 60]
    wanted |= {game[side]["id"] for game in nearby for side in ("home", "away")}
    if rosters is None:
        rosters = _rosters(wanted)
    rows = []
    for line in live:
        try:
            value = float(line.get("line"))
        except (TypeError, ValueError):
            continue
        starts = _timestamp(line.get("start_time"))
        found, side = placed[(line.get("team"), line.get("team_name"), line.get("description"), line.get("start_time"))]
        player_id = None
        if found:
            player_id = cfb.match_player(line.get("player"), rosters.get(found[side]["id"]) or {})
        else:
            # Not placed by its team: the one game kicking off then whose
            # roster has him.
            hits = []
            for game in games:
                kick = _timestamp(game["start"])
                if starts is None or kick is None or abs(kick - starts) > 30 * 60:
                    continue
                for option in ("home", "away"):
                    pid = cfb.match_player(line.get("player"), rosters.get(game[option]["id"]) or {})
                    if pid:
                        hits.append((game, option, pid))
            if len(hits) == 1:
                found, side, player_id = hits[0]
        info = (rosters.get(found[side]["id"]) or {}).get(player_id) or {} if found else {}
        position = info.get("pos") or str(line.get("position") or "").upper() or None
        market = markets.market_for(line.get("stat"), position or "")
        tier = str(line.get("odds_type") or "standard").lower()
        game = {}
        team, opponent = {}, {}
        if found:
            team, opponent = found[side], found["away" if side == "home" else "home"]
            game = {"gameId": found["id"], "homeTeamAbbr": found["home"]["abbr"], "awayTeamAbbr": found["away"]["abbr"],
                    "isHome": None if found.get("neutral") else side == "home", "gameKind": found.get("kind")}
        rows.append({
            "id": f"pp:{line.get('id')}", "player": line.get("player"), "playerId": player_id,
            "team": team.get("abbr") or str(line.get("team") or "").upper() or None, "teamId": team.get("id") or None,
            "teamName": team.get("name") or line.get("team_name") or None, "teamLogo": team.get("logo") or None,
            "opponent": opponent.get("abbr") or str(line.get("description") or "").upper() or None, "opponentId": opponent.get("id") or None,
            "opponentName": opponent.get("name") or None, "opponentLogo": opponent.get("logo") or None,
            "position": position, "number": info.get("number") or None,
            "headshot": info.get("headshot") or line.get("headshot") or (cfb.headshot(player_id) if player_id else None) or None,
            "stat": line.get("stat"), "marketKey": market_key(line.get("stat")), "valueKey": market,
            "line": value, "modifier": tier, "promo": bool(line.get("promo")),
            "startsAt": datetime.fromtimestamp(starts, timezone.utc).isoformat() if starts is not None else None,
            "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None, "modifier": tier,
                      "updatedAt": line.get("updated_at") or None}],
            **game,
        })
    rows.sort(key=lambda row: (row["startsAt"] or "", row["player"] or "", row["stat"] or "", row["line"]))
    cfb.remember_players(rows)
    return {"builtAt": datetime.now(timezone.utc).isoformat(), "source": "prizepicks", "rows": rows, "version": VERSION,
            "season": cfb.season_of()}


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
