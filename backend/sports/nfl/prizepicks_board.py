"""The Finder's NFL lines, straight from PrizePicks' own feed.

The Odds API only carries 13 NFL markets, and the old research board kept
just its standard PrizePicks lines that had moved in the last two minutes
for players with 8+ games -- so most lines never reached the Finder at all.
PrizePicks' feed has every market it posts (kickers, punters, defense, first
5 rushes / first 2 catches, goblins and demons), so the board is built from
it and each line gets its hit rates from nflverse (finder.game_values).

A line whose market we cannot chart, or whose player we cannot match, is
still shown; it simply has no hit rates.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone
from math import isfinite, sqrt

from . import finder, markets
from .cache import NFLCacheDomain, cached_nfl
from .services.nflverse import canonical_team

VERSION = "nfl-pp-board-v1"
WINDOWS = (5, 10, 15, 20)
CATEGORY = {"standard": "STANDARD", "goblin": "GOBLIN", "demon": "DEMON"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
# A PrizePicks start time and our schedule's kickoff for the same game.
SAME_GAME_SECONDS = 8 * 3600


def _finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def _name_key(value):
    parts = re.findall(r"[a-z0-9]+", str(value or "").lower().replace("'", ""))
    if parts and parts[-1] in SUFFIXES:
        parts = parts[:-1]
    return "".join(parts)


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _roster(season):
    """name key -> candidates, every position (kickers, punters, defenders
    included), current season first."""
    by_name = defaultdict(list)
    seen = set()
    for year in (season, season - 1):
        for row in finder.roster_rows(year):
            player_id = str(row.get("gsis_id") or "").strip()
            if not player_id or player_id in ("NA",) or player_id in seen:
                continue
            seen.add(player_id)
            espn = str(row.get("espn_id") or "").strip()
            entry = {"id": player_id, "team": canonical_team(row.get("team")),
                     "position": str(row.get("position") or "").upper(), "name": row.get("full_name") or "",
                     "headshot": f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn}.png"
                     if espn and espn not in ("NA", "0") else (row.get("headshot_url") or "")}
            names = {row.get("full_name"), f"{row.get('football_name') or ''} {row.get('last_name') or ''}",
                     f"{row.get('first_name') or ''} {row.get('last_name') or ''}"}
            for name in names:
                key = _name_key(name)
                if key and entry not in by_name[key]:
                    by_name[key].append(entry)
    return by_name


def _match(roster, name, team):
    candidates = roster.get(_name_key(name), [])
    same_team = [entry for entry in candidates if entry["team"] == team]
    if len(same_team) == 1:
        return same_team[0]
    return candidates[0] if len(candidates) == 1 else None


def _game(games, team, starts):
    """The team's game this line is for."""
    best, best_gap = None, None
    for game in games.values():
        if team not in (game["home"], game["away"]) or game["final"] or not game["kickoff"]:
            continue
        gap = abs(game["kickoff"] - starts) if starts else None
        if starts and gap > SAME_GAME_SECONDS:
            continue
        if best is None or (gap is not None and gap < best_gap):
            best, best_gap = game, gap
    return best


def window(values, line):
    """Hit/miss/push over the given games for a More pick at `line`."""
    if not values:
        return {"hits": 0, "misses": 0, "pushes": 0, "decisions": 0, "hitRate": None, "sample": 0, "average": None}
    pushes = sum(value == line for value in values)
    hits = sum(value > line for value in values)
    decisions = len(values) - pushes
    return {"hits": hits, "misses": decisions - hits, "pushes": pushes, "decisions": decisions,
            "hitRate": hits / decisions * 100 if decisions else None, "sample": len(values),
            "average": sum(values) / len(values)}


def _support(hits, decisions):
    # Wilson lower bound (95%), used only to order the board.
    if not decisions:
        return 0
    z, p = 1.96, hits / decisions
    return (p + z * z / (2 * decisions) - z * sqrt(p * (1 - p) / decisions + z * z / (4 * decisions * decisions))) / (1 + z * z / decisions)


def history_fields(games, market, line, opponent):
    """Windows, streak and support for one line from the player's games."""
    if not market:
        return {"windows": {}, "streak": None, "support": 0, "sample": 0}
    played = [(game, game["values"].get(market)) for game in games]
    values = [value for _game_row, value in played if _finite(value)]
    recent = values[-20:]
    windows = {f"l{n}": window(recent[-n:], line) for n in WINDOWS}
    windows["h2h"] = window([value for game, value in played if _finite(value) and game.get("opponent") == opponent], line)
    streak = 0
    for value in reversed(values):
        if value <= line:
            break
        streak += 1
    l20 = windows["l20"]
    return {"windows": windows, "streak": streak if values else None, "support": _support(l20["hits"], l20["decisions"]),
            "sample": len(recent), "average": windows["l10"]["average"]}


def _projections():
    from prizepicks_export_core import _fetch_projection_rows
    try:
        return _fetch_projection_rows(league="NFL")
    except RuntimeError as error:
        # "no active projections" -- an empty slate, not an outage.
        if "no active" in str(error).lower():
            return []
        raise


def build(season, projections=None, now=None):
    now = now or datetime.now(timezone.utc).timestamp()
    projections = _projections() if projections is None else projections
    games = finder.games_index()
    roster = _roster(season)
    histories = {}
    rows, events = [], {}
    for line in projections:
        if line.get("combo"):
            continue
        starts = _timestamp(line.get("start_time"))
        if starts is not None and starts <= now:
            continue
        team = canonical_team(line.get("team"))
        player = _match(roster, line.get("player"), team)
        team = team or (player or {}).get("team")
        position = str(line.get("position") or (player or {}).get("position") or "").upper()
        market = markets.market_for(line.get("stat"), position)
        game = _game(games, team, starts) if team else None
        opponent = (game["away"] if game["home"] == team else game["home"]) if game else canonical_team(line.get("description"))
        if player and player["id"] not in histories:
            try:
                histories[player["id"]] = finder.game_values(season, player["id"], cached=False)
            except Exception:  # noqa: BLE001 -- one player's history must not sink the board
                histories[player["id"]] = []
        category = CATEGORY.get(str(line.get("odds_type") or "standard").lower(), "STANDARD")
        value = line.get("line")
        history = history_fields(histories.get((player or {}).get("id"), []), market, value, opponent)
        game_id = game["game_id"] if game else None
        if game:
            events[game_id] = {"gameId": game_id, "awayTeamId": game["away"], "homeTeamId": game["home"],
                               "startsAt": datetime.fromtimestamp(game["kickoff"], timezone.utc).isoformat()}
        prop_type = market or f"pp:{markets.normalize(line.get('stat'))}"
        rows.append({
            "id": f"pp:{line.get('id')}", "playerId": (player or {}).get("id"), "playerName": line.get("player"),
            "position": position, "headshot": (player or {}).get("headshot") or line.get("headshot") or None,
            "propType": prop_type, "propLabel": line.get("stat"), "teamId": team, "opponentId": opponent,
            "gameId": game_id, "startsAt": datetime.fromtimestamp(starts, timezone.utc).isoformat() if starts else None,
            "line": {"verified": True, "bookmaker": "prizepicks", "platform": "PrizePicks", "category": category,
                     "value": value, "direction": "OVER", "price": None, "updatedAt": line.get("updated_at") or None,
                     "playerId": (player or {}).get("id"), "propType": prop_type, "gameId": game_id},
            **history,
        })
    rows.sort(key=lambda row: (row["startsAt"] or "", -row["support"], row["playerName"] or "",
                               markets.ORDER.get(row["propType"], 999), row["line"]["value"]))
    return {"builtAt": datetime.now(timezone.utc).isoformat(), "season": season, "source": "prizepicks + nflverse",
            "events": sorted(events.values(), key=lambda event: event["startsAt"]), "rows": rows,
            "labels": {key: label for key, label, _code in markets.MARKETS}, "version": VERSION}


def board(season):
    return cached_nfl(NFLCacheDomain.PROPS, (VERSION, "board", season), lambda: build(season))
