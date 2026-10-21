"""Verified WNBA player-prop board backed by The Odds API, and the NBA's
(`?league=nba`), built from PrizePicks' own lines.

The response is deliberately market-only: historical hit rates and player
profiles belong to a separate stats source and are never inferred from odds.
Both leagues' history, matchups and season context come from ESPN.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth_core import session_with_live_access  # noqa: E402
from backend.sports.nfl.services.odds import _get, finite, timestamp  # noqa: E402
from v2.board import store  # noqa: E402
import requests  # noqa: E402

SPORT = "basketball_wnba"
CACHE_KEY = "krazy_data:wnba:v10:finder_board"
ROSTER_CACHE_KEY = "krazy_data:wnba:v2:roster_directory"  # v2: adds height
CACHE_SECONDS = 10 * 60
ROSTER_CACHE_SECONDS = 6 * 60 * 60
# Up to 10 bookmakers cost The Odds API credits of one. If the provider ever
# refuses the longer list, the original five are asked instead.
BOOKS = "prizepicks,underdog,pick6,draftkings,fanduel,betmgm,williamhill_us,espnbet,fanatics,pinnacle"
CORE_BOOKS = "prizepicks,underdog,draftkings,fanduel,betmgm"
MARKETS = {
    "player_points": "Points",
    "player_rebounds": "Rebounds",
    "player_assists": "Assists",
    "player_threes": "3-Pointers Made",
    "player_blocks": "Blocks",
    "player_steals": "Steals",
    "player_blocks_steals": "Blocks + Steals",
    "player_turnovers": "Turnovers",
    "player_points_rebounds": "Points + Rebounds",
    "player_points_assists": "Points + Assists",
    "player_rebounds_assists": "Rebounds + Assists",
    "player_points_rebounds_assists": "Points + Rebounds + Assists",
    "player_fantasy_points": "Fantasy Points",
}
# The Odds API exposes PrizePicks' alternate lines through the matching
# `_alternate` market. Keep the base label while retaining the line tier so
# Finder can distinguish Regular, Goblin, and Demon rows.
ALTERNATE_MARKETS = {f"{key}_alternate": label for key, label in MARKETS.items()}
ALL_MARKETS = {**MARKETS, **ALTERNATE_MARKETS}
BOOK_PRIORITY = {key: index for index, key in enumerate(BOOKS.split(","))}
# PrizePicks' own stat names (normalized) -> the board's market keys. Its
# feed carries markets The Odds API does not (3-PT Attempted, FG Made, Free
# Throws Made), and every line it posts, not just the ones The Odds API
# relays.
PRIZEPICKS_MARKETS = {
    "points": "player_points", "rebounds": "player_rebounds", "assists": "player_assists",
    "3ptmade": "player_threes", "3pointersmade": "player_threes", "threepointersmade": "player_threes",
    "3ptattempted": "player_threes_attempts", "3pointersattempted": "player_threes_attempts",
    "3ptattempts": "player_threes_attempts",
    "fgmade": "player_field_goals", "fieldgoalsmade": "player_field_goals",
    "freethrowsmade": "player_frees_made", "ftmade": "player_frees_made",
    "blockedshots": "player_blocks", "blocks": "player_blocks", "steals": "player_steals",
    "turnovers": "player_turnovers", "ptsrebs": "player_points_rebounds", "ptsasts": "player_points_assists",
    "rebsasts": "player_rebounds_assists", "ptsrebsasts": "player_points_rebounds_assists",
    "blksstls": "player_blocks_steals", "fantasyscore": "player_fantasy_points",
    "fgattempted": "player_field_goals_attempts", "fieldgoalsattempted": "player_field_goals_attempts",
    "fgattempts": "player_field_goals_attempts",
    "freethrowsattempted": "player_frees_attempts", "ftattempted": "player_frees_attempts",
    "twopointersmade": "player_twos", "2ptmade": "player_twos", "2pointersmade": "player_twos",
    "twopointersattempted": "player_twos_attempts", "2ptattempted": "player_twos_attempts", "2pointersattempted": "player_twos_attempts",
    "personalfouls": "player_fouls", "fouls": "player_fouls",
    "offensiverebounds": "player_offensive_rebounds", "offrebounds": "player_offensive_rebounds",
    "defensiverebounds": "player_defensive_rebounds", "defrebounds": "player_defensive_rebounds",
    "doubledouble": "player_double_double", "doubledoubles": "player_double_double",
}
PRIZEPICKS_LABELS = {**MARKETS, "player_threes_attempts": "3-PT Attempted", "player_field_goals": "FG Made",
                     "player_frees_made": "Free Throws Made", "player_field_goals_attempts": "FG Attempted",
                     "player_frees_attempts": "Free Throws Attempted", "player_twos": "Two Pointers Made",
                     "player_twos_attempts": "Two Pointers Attempted", "player_fouls": "Personal Fouls",
                     "player_offensive_rebounds": "Offensive Rebounds", "player_defensive_rebounds": "Defensive Rebounds",
                     "player_double_double": "Double-Double"}
PRIZEPICKS_MARKETS.update({"tripledouble": "player_triple_double", "tripledoubles": "player_triple_double"})
PRIZEPICKS_LABELS["player_triple_double"] = "Triple-Double"
# First-quarter and first-half lines (backend/sports/wnba/periods.py): any of
# PrizePicks' spellings ("1Q Points", "Points - 1st Half", "1H Pts+Rebs").
from backend.sports.wnba import periods as _periods  # noqa: E402
PRIZEPICKS_LABELS.update(_periods.LABELS)
_PERIOD_TOKENS = {"1q": ("1stquarter", "firstquarter", "1stqtr", "1qtr", "1q", "q1"),
                  "1h": ("1sthalf", "firsthalf", "1h", "h1")}
_PERIOD_BASES = {**PRIZEPICKS_MARKETS, "pts": "player_points", "rebs": "player_rebounds", "asts": "player_assists"}


def _market_of(stat):
    """PrizePicks' stat name (lower case, letters and digits only) as the
    board's market key: its full-game stats, then a first quarter or first
    half of one (periods.py), else its own name."""
    if stat in PRIZEPICKS_MARKETS:
        return PRIZEPICKS_MARKETS[stat]
    for suffix, tokens in _PERIOD_TOKENS.items():
        for token in tokens:
            if stat.startswith(token):
                rest = stat[len(token):]
            elif stat.endswith(token):
                rest = stat[:-len(token)]
            else:
                continue
            key = f"{_PERIOD_BASES[rest]}_{suffix}" if rest in _PERIOD_BASES else None
            if key in _periods.PERIOD_FIELDS:
                return key
    return f"pp:{stat}"


_period_memory = {}


def _period_rows(league, seasons):
    """player id -> {game id: his first-quarter/first-half row} over the
    stored seasons (periods.py), kept while those seasons are unchanged."""
    from backend.sports.wnba import league as season_store
    payloads = [(year, season_store.stored(year, league)) for year in seasons]
    key = (league, tuple((year, (payload or {}).get("builtAt"), len((payload or {}).get("games") or {})) for year, payload in payloads))
    if _period_memory.get(league, (None,))[0] == key:
        return _period_memory[league][1]
    index = {}
    for _year, payload in payloads:
        for game_id, game in ((payload or {}).get("games") or {}).items():
            for side in (game.get("t") or {}).values():
                for row in side.get("h") or []:
                    index.setdefault(row[0], {})[str(game_id)] = row
    _period_memory[league] = (key, index)
    return index


def _with_periods(rows, player_id, league, seasons):
    """`rows` (his game logs) with each game's first-quarter and first-half
    values among its markets, where the stored season has them."""
    try:
        mine = _period_rows(league, seasons).get(str(player_id)) or {}
    except Exception:  # noqa: BLE001 -- the full-game history still stands
        return rows
    if not mine:
        return rows
    out = []
    for row in rows:
        found = mine.get(str(row.get("gameId")))
        out.append({**row, "values": {**(row.get("values") or {}), **_periods.values_of(found)}} if found else row)
    return out
_memory = {"at": 0.0, "value": None}
_roster_memory = {}
# The league context derived from the stored season, per (league, season, builtAt).
_league_memory = {}
# league -> {"key": the stored season's build, "table": scout.season_table}
_scout_memory = {}
# A PrizePicks stat (line_moves.norm) -> the game stat it counts (scout.GAME_STATS).
_ARCHIVE_STATS = {"points": "pts", "rebounds": "reb", "assists": "ast", "3ptmade": "tpm", "threepointersmade": "tpm",
                  "ptsrebsasts": "pra", "pointsreboundsassists": "pra"}


def _archived_lines(league_name):
    """lines(day, name) -> {stat: line}: each night's PrizePicks lines as
    line_archive.py kept them (the NBA only), read once a day per request."""
    if league_name != "nba":
        return None
    import line_archive
    import line_moves
    days = {}

    def lines(day, name):
        if day not in days:
            kept = {}
            try:
                for field, line in line_archive.lines_on("nba", day, line_moves._pipeline).items():
                    player, _, stat = field.partition("|")
                    if stat in _ARCHIVE_STATS:
                        kept.setdefault(player, {})[_ARCHIVE_STATS[stat]] = line
            except Exception:  # noqa: BLE001 -- the games show without their lines
                kept = {}
            days[day] = kept
        return days[day].get(line_moves.norm(name)) or {}
    return lines


def _scout(payload, season, player_id, opponent, league_name):
    """The scouting cards' data (scout.py): who at each position faced the
    opponent lately and how, and where he ranks at his position."""
    from backend.sports.wnba import opportunity, scout
    from backend.sports.wnba.context import team_games
    from backend.sports.wnba import league
    # Early in a season the opponent's latest games and everyone's averages
    # take last season's games too.
    played = sum(1 for game in payload["games"].values() if opponent in (game.get("t") or {}))
    if played < opportunity.BLEND_GAMES:
        payload = opportunity.blend(league.stored(season - 1, league_name), payload)
    built = (payload.get("builtAt"), tuple(payload.get("blended") or ()))
    memory = _scout_memory.get(league_name) or {}
    by_team = team_games(payload)
    players = payload.get("players") or {}
    if memory.get("key") != built:
        memory = {"key": built, "table": scout.season_table(by_team, players)}
        _scout_memory[league_name] = memory
    table = memory["table"]
    return {"opponent": opponent, "seasons": list(payload.get("blended") or [payload.get("season")]),
            "faced": scout.faced(by_team, players, table, opponent, me=player_id, lines=_archived_lines(league_name), league=league_name),
            "peers": scout.peer_ranks(table, player_id),
            "me": {key: _round_or_none((table.get(player_id) or {}).get(key)) for key in ("usage", "pts", "ast", "gp")}}


def _with_box_stats(card):
    """Each defender's steals and blocks a game, from ESPN's box scores (NBA.com's
    defender tables have none). The card as it was when the season isn't stored."""
    try:
        from backend.sports.wnba import league, opportunity, scout
        from backend.sports.wnba.context import team_games
        season = league.current_season(league="nba")
        payload = league.stored(season, "nba")
        if not payload or len(payload.get("games") or {}) < opportunity.BLEND_GAMES * 15:
            payload = opportunity.blend(league.stored(season - 1, "nba"), payload or {})
        if not payload or not payload.get("games"):
            return card
        built = (payload.get("builtAt"), tuple(payload.get("blended") or ()))
        memory = _scout_memory.get("nba") or {}
        if memory.get("key") != built:
            memory = {"key": built, "table": scout.season_table(team_games(payload), payload.get("players") or {})}
            _scout_memory["nba"] = memory
        names = scout.by_name(memory["table"], payload.get("players") or {})
        for item in card.get("defenders") or []:
            row = names.get(nba_name_key(item.get("name")))
            if row:
                item["stlBlk"] = round(row["stlblk"], 1)
    except Exception:  # noqa: BLE001 -- the card stands without them
        pass
    return card


def nba_name_key(name):
    from backend.sports.wnba.tracking import name_key
    return name_key(name or "")


def _round_or_none(value):
    return None if value is None else round(value, 1)

# The NBA: every line PrizePicks posts, on ESPN's rosters and schedule. No
# sportsbook comparison here -- player props from The Odds API are asked per
# game and per market, which would cost about 26 credits a game each refresh.
NBA_CACHE_SECONDS = 90
LEAGUES = ("wnba", "nba")
ROSTER_KEYS = {"wnba": ROSTER_CACHE_KEY, "nba": "krazy_data:nba:v1:roster_directory"}
# PrizePicks' NBA team codes, where ESPN's differ.
NBA_TEAM_CODES = {"GSW": "GS", "NYK": "NY", "SAS": "SA", "NOP": "NO", "NOR": "NO", "UTA": "UTAH", "WAS": "WSH",
                  "PHO": "PHX", "BRK": "BKN"}
_nba_memory = {"at": 0.0, "value": None}
_nba_days = {}


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(text.casefold().replace(".", "").split())


def _espn_json(url):
    response = requests.get(url, headers={"Accept": "application/json"}, timeout=12)
    response.raise_for_status()
    return response.json()


def _team_rosters(league="wnba"):
    """({team code: {id: {name, pos, headshot}}}, when they were read), from
    the roster directory; (None, 0) when it can't be read."""
    try:
        directory = _roster_directory(league)
    except Exception:  # noqa: BLE001 -- the charts fall back to the games alone
        return None, 0
    rosters = {}
    for entries in (directory.get("players") or {}).values():
        for entry in entries:
            if entry.get("id") and entry.get("teamAbbr"):
                rosters.setdefault(entry["teamAbbr"], {})[str(entry["id"])] = {
                    "name": entry.get("name"), "pos": entry.get("position"), "headshot": entry.get("headshot")}
    return rosters, (_roster_memory.get(league) or (0,))[0]


def _roster_directory(league="wnba"):
    now = time.time()
    memory = _roster_memory.get(league)
    if memory and now - memory[0] < ROSTER_CACHE_SECONDS:
        return memory[1]
    try:
        raw = store.get(ROSTER_KEYS[league])
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < ROSTER_CACHE_SECONDS:
            _roster_memory[league] = (float(envelope["at"]), envelope["value"])
            return envelope["value"]
    except Exception:
        pass
    listing = _espn_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/teams")
    teams = listing.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
    team_meta = {}
    for item in teams:
        team = item.get("team", {})
        default_logo = next((logo.get("href") for logo in team.get("logos", []) if "default" in logo.get("rel", [])), None)
        team_meta[str(team.get("id"))] = {
            "name": team.get("displayName"), "abbr": team.get("abbreviation"), "logo": default_logo,
        }

    def load(team_id):
        return team_id, _espn_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/teams/{team_id}/roster")

    players = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        for team_id, roster in pool.map(load, team_meta):
            team = team_meta[team_id]
            for athlete in roster.get("athletes", []):
                name = athlete.get("displayName") or athlete.get("fullName")
                if not name:
                    continue
                players.setdefault(_norm(name), []).append({
                    "id": athlete.get("id"), "name": name, "team": team["name"], "teamAbbr": team["abbr"],
                    "teamLogo": team["logo"], "headshot": (athlete.get("headshot") or {}).get("href"),
                    "position": (athlete.get("position") or {}).get("abbreviation"),
                    # ESPN writes 6' 3"; the player banner shows 6'3.
                    "height": str(athlete.get("displayHeight") or "").replace("' ", "'").rstrip('"') or None,
                })
    value = {"players": players, "teams": {_norm(meta["name"]): meta for meta in team_meta.values()}}
    _roster_memory[league] = (now, value)
    try:
        store.set(ROSTER_KEYS[league], json.dumps({"at": now, "value": value}, separators=(",", ":")))
    except Exception:
        pass
    return value


def _find(name, team="", league="wnba"):
    """The ESPN player a slip names, for a pick whose game has started (so
    it's off the board): the full name, else the one player with that last
    name and first initial, the team breaking ties. None when there's none."""
    players = _roster_directory(league)["players"]
    team = NBA_TEAM_CODES.get(team, team) if league == "nba" else team
    found = players.get(_norm(name), [])
    if not found:
        words = _norm(name).replace("'", "").split()
        if len(words) >= 2:
            found = [item for entries in players.values() for item in entries
                     if (other := _norm(item["name"]).replace("'", "").split()) and len(other) >= 2
                     and other[-1] == words[-1] and other[0][0] == words[0][0]]
    same_team = [item for item in found if team and item.get("teamAbbr") == team]
    if len(same_team) == 1:
        return same_team[0]
    return found[0] if len(found) == 1 else None


def _send(handler, status, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "private, max-age=60, stale-while-revalidate=300")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _cached():
    now = time.time()
    if _memory["value"] is not None and now - _memory["at"] < CACHE_SECONDS:
        return _memory["value"]
    try:
        raw = store.get(CACHE_KEY)
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < CACHE_SECONDS:
            _memory.update(at=float(envelope["at"]), value=envelope["value"])
            return envelope["value"]
    except Exception:
        pass
    return None


def _save(value):
    now = time.time()
    _memory.update(at=now, value=value)
    try:
        store.set(CACHE_KEY, json.dumps({"at": now, "value": value}, separators=(",", ":")))
    except Exception:
        pass


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _made(value):
    return _number(str(value or "").split("-", 1)[0])


def _own_score_first(score, result):
    """ESPN writes scores winner-first ("102-85" for an 85-102 loss, and
    "86-84 OT" with the overtime marker after both numbers)."""
    match = re.match(r"^\s*(\d+)-(\d+)(.*)$", str(score or ""))
    return f"{match[2]}-{match[1]}{match[3]}" if result == "L" and match else score


def _rebound_split(player_id, season, league_name="wnba"):
    """event id -> (offensive, defensive) rebounds for one player, from the
    stored season of box scores (backend/sports/wnba/league.py) -- ESPN's
    player game log only has total rebounds."""
    try:
        from backend.sports.wnba import league
        stored = league.stored(season, league_name) or {}
        at = (2 + league.FIELDS.index("oreb"), 2 + league.FIELDS.index("dreb"))
    except Exception:  # noqa: BLE001 -- no split, just the totals
        return {}
    split = {}
    for event_id, record in (stored.get("games") or {}).items():
        for side in (record.get("t") or {}).values():
            for line in side.get("p") or []:
                if str(line[0]) == str(player_id) and line[at[0]] is not None and line[at[1]] is not None:
                    split[str(record.get("id") or event_id)] = (line[at[0]], line[at[1]])
    return split


def _game_logs(player_id, season, league="wnba"):
    # v4: rows carry the full box line (attempts, fouls) for the game log
    # and supporting-stats views, are tagged by season type, and give the
    # score with this player's team first.
    cache_key = f"krazy_data:{league}:v6:gamelog:{player_id}:{season}"
    now = time.time()
    # A season that is over never changes; the current one is re-read.
    fresh = 12 * 3600 if league == "nba" and season < _nba_seasons()[-1] else 30 * 60
    try:
        raw = store.get(cache_key)
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < fresh:
            return envelope["value"]
    except Exception:
        pass
    data = _espn_json(f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/{league}/athletes/{player_id}/gamelog?region=us&lang=en&contentorigin=espn&season={season}")
    names, events = data.get("names", []), data.get("events", {})
    boards = _rebound_split(player_id, season, league)
    rows, seen = [], set()
    for season_type in data.get("seasonTypes", []):
        for category in season_type.get("categories", []):
            for item in category.get("events", []):
                event_id = str(item.get("eventId") or ""); event = events.get(event_id, {})
                if not event_id or event_id in seen or not event: continue
                seen.add(event_id); stats = dict(zip(names, item.get("stats", [])))
                points=_number(stats.get("points")); rebounds=_number(stats.get("totalRebounds")); assists=_number(stats.get("assists")); steals=_number(stats.get("steals")); blocks=_number(stats.get("blocks")); turnovers=_number(stats.get("turnovers"))
                values={"player_points":points,"player_rebounds":rebounds,"player_assists":assists,"player_threes":_made(stats.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted")),"player_blocks":blocks,"player_steals":steals,"player_turnovers":turnovers,"player_field_goals":_made(stats.get("fieldGoalsMade-fieldGoalsAttempted")),"player_frees_made":_made(stats.get("freeThrowsMade-freeThrowsAttempted"))}
                if all(v is not None for v in (blocks,steals)): values["player_blocks_steals"]=blocks+steals
                if all(v is not None for v in (points,rebounds)): values["player_points_rebounds"]=points+rebounds
                if all(v is not None for v in (points,assists)): values["player_points_assists"]=points+assists
                if all(v is not None for v in (rebounds,assists)): values["player_rebounds_assists"]=rebounds+assists
                if all(v is not None for v in (points,rebounds,assists)): values["player_points_rebounds_assists"]=points+rebounds+assists
                if all(v is not None for v in (points,rebounds,assists,blocks,steals,turnovers)): values["player_fantasy_points"]=round(points+1.2*rebounds+1.5*assists+3*blocks+3*steals-turnovers,1)
                fg=str(stats.get("fieldGoalsMade-fieldGoalsAttempted") or "").split("-"); tp=str(stats.get("threePointFieldGoalsMade-threePointFieldGoalsAttempted") or "").split("-"); ft=str(stats.get("freeThrowsMade-freeThrowsAttempted") or "").split("-")
                values["player_threes_attempts"]=_number(tp[1]) if len(tp)==2 else None
                values["player_field_goals_attempts"]=_number(fg[1]) if len(fg)==2 else None
                values["player_frees_attempts"]=_number(ft[1]) if len(ft)==2 else None
                values["player_fouls"]=_number(stats.get("fouls"))
                # Two-pointers: field goals less threes.
                if len(fg)==2 and len(tp)==2 and None not in (_number(fg[0]),_number(tp[0]),_number(fg[1]),_number(tp[1])):
                    values["player_twos"]=_number(fg[0])-_number(tp[0]); values["player_twos_attempts"]=_number(fg[1])-_number(tp[1])
                # A double-double: 10 or more in two of points, rebounds,
                # assists, steals and blocks (1 if so, 0 if not).
                counting=[points,rebounds,assists,steals,blocks]
                if all(v is not None for v in counting): values["player_double_double"]=1.0 if sum(v>=10 for v in counting)>=2 else 0.0
                if all(v is not None for v in counting): values["player_triple_double"]=1.0 if sum(v>=10 for v in counting)>=3 else 0.0
                split=boards.get(event_id)
                if split: values["player_offensive_rebounds"],values["player_defensive_rebounds"]=split
                box={"min":_number(stats.get("minutes")),"pts":points,"reb":rebounds,"ast":assists,"stl":steals,"blk":blocks,"to":turnovers,"pf":_number(stats.get("fouls")),
                     "fgm":_number(fg[0]) if len(fg)==2 else None,"fga":_number(fg[1]) if len(fg)==2 else None,"tpm":_number(tp[0]) if len(tp)==2 else None,"tpa":_number(tp[1]) if len(tp)==2 else None,"ftm":_number(ft[0]) if len(ft)==2 else None,"fta":_number(ft[1]) if len(ft)==2 else None}
                display_type=str(season_type.get("displayName") or "")
                kind="postseason" if "Postseason" in display_type or "Play" in display_type else "preseason" if "Preseason" in display_type else "regular"
                rows.append({"gameId":event_id,"date":event.get("gameDate"),"season":season,"seasonType":display_type,"seasonKind":kind,"opponent":(event.get("opponent") or {}).get("abbreviation"),"opponentLogo":(event.get("opponent") or {}).get("logo"),"isHome":event.get("atVs")=="vs","result":event.get("gameResult"),"score":_own_score_first(event.get("score"),event.get("gameResult")),"minutes":_number(stats.get("minutes")),"values":values,"box":box})
    rows.sort(key=lambda row: row.get("date") or "")
    result={"status":"AVAILABLE","source":"espn","playerId":player_id,"season":season,"rows":rows,"fetchedAt":datetime.now(timezone.utc).isoformat()}
    try: store.set(cache_key,json.dumps({"at":now,"value":result},separators=(",",":")))
    except Exception: pass
    return result


def _nba_seasons(now=None):
    """The NBA seasons a player's history covers: the one under way (or next,
    from September) and the one before, so the first weeks of a season still
    have ten and twenty games behind every line. ESPN names a season by the
    year it ends."""
    now = now or datetime.now(timezone.utc)
    latest = now.year + 1 if now.month >= 9 else now.year
    return [latest - 1, latest]


def _history(player_id, league="wnba", season=None):
    """A player's game logs, oldest first: the WNBA season asked for, or the
    NBA's last two seasons together."""
    if league != "nba":
        season = season or datetime.now(timezone.utc).year
        return _with_periods(_game_logs(player_id, season).get("rows", []), player_id, "wnba", [season])
    rows, seen = [], set()
    for year in _nba_seasons():
        try:
            logs = _game_logs(player_id, year, "nba").get("rows", [])
        except Exception:  # noqa: BLE001 -- a season ESPN has nothing for yet
            logs = []
        for log in logs:
            if log.get("gameId") not in seen:
                seen.add(log.get("gameId"))
                rows.append(log)
    rows.sort(key=lambda row: row.get("date") or "")
    return _with_periods(rows, player_id, "nba", _nba_seasons())


# The most game logs one request may ask for (resource=gamelogs).
MAX_GAMELOG_BATCH = 8


def _nba_gamelog(player_id):
    """An NBA player's last two seasons of games, as the Finder reads them."""
    seasons = _nba_seasons()
    return {"status": "AVAILABLE", "source": "espn", "playerId": player_id, "season": seasons[-1],
            "seasons": seasons, "rows": _saved_history(player_id, "nba")["rows"],
            "fetchedAt": datetime.now(timezone.utc).isoformat()}


def _saved_history(player_id, league, season=None):
    from finder_history_store import remember
    season = season or datetime.now(timezone.utc).year
    payload = {"rows": _history(player_id, league, season)} if league == 'nba' else _game_logs(player_id, season)
    return remember(league, f"{league}:{player_id}:{'recent' if league == 'nba' else season}",
                    payload, {"playerId": player_id, "season": season})


def _window(values, line):
    decided = [value for value in values if value != line]
    hits = sum(value > line for value in decided)
    return {"hitRate": hits / len(decided) * 100 if decided else None, "hits": hits,
            "misses": len(decided) - hits, "pushes": len(values) - len(decided), "sample": len(values)}


def _attach_history(rows, season, league="wnba"):
    player_ids = sorted({row.get("playerId") for row in rows if row.get("playerId")})
    histories = {}
    def load(player_id):
        try: return player_id, _history(player_id, league, season)
        except Exception: return player_id, []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for player_id, logs in pool.map(load, player_ids): histories[player_id] = logs
    for row in rows:
        # Preseason games stay on the player page's chart but never in the
        # hit rates: starters play short minutes, so they'd make every Under
        # look safe.
        logs = [log for log in histories.get(row.get("playerId"), []) if log.get("seasonKind") != "preseason"]
        values = [(log.get("values") or {}).get(row["marketKey"]) for log in logs]
        values = [value for value in values if value is not None]
        recent = values[-10:]
        row["average"] = sum(recent) / len(recent) if recent else None
        row["diff"] = row["average"] - row["line"] if row["average"] is not None else None
        opponent = row.get("awayTeamAbbr") if row.get("teamAbbr") == row.get("homeTeamAbbr") else row.get("homeTeamAbbr")
        h2h = [(log.get("values") or {}).get(row["marketKey"]) for log in logs if log.get("opponent") == opponent]
        h2h = [value for value in h2h if value is not None]
        row["windows"] = {key: _window(values[-size:], row["line"]) for key, size in (("l5", 5), ("l10", 10), ("l15", 15), ("l20", 20))}
        row["windows"]["h2h"] = _window(h2h, row["line"])
        # An NBA history runs two seasons (so the first weeks still have ten
        # and twenty games); its season rate is the one under way alone.
        if league == "nba":
            latest = _nba_seasons()[-1]
            season_values = [(log.get("values") or {}).get(row["marketKey"]) for log in logs if log.get("season") == latest]
            row["windows"]["season"] = _window([value for value in season_values if value is not None], row["line"])
        else:
            row["windows"]["season"] = _window(values, row["line"])
        row["season"] = season
        streak = 0
        for value in reversed(values):
            if value == row["line"]:
                break
            sign = 1 if value > row["line"] else -1
            if streak and (streak > 0) != (sign > 0):
                break
            streak += sign
        row["streak"] = streak if values else None
    return rows


def _events_by_team(events, now):
    """Full team name -> (the team's next event, its start)."""
    index = {}
    for event in events:
        starts = timestamp(event.get("commence_time")) if isinstance(event, dict) else None
        if not starts or starts <= now:
            continue
        for side in ("home_team", "away_team"):
            name = event.get(side)
            if name and (name not in index or starts < index[name][1]):
                index[name] = (event, starts)
    return index


def _merge_prizepicks(rows, events, directory, now, alternates=None, lines=None):
    """Add every line PrizePicks posts that the board does not have yet.
    A line both feeds carry keeps its comparison-book prices and takes
    PrizePicks' own tier (standard / goblin / demon). A new line picks up
    the books' alternate prices at the same number (`alternates`), which is
    where a Goblin's or Demon's odds come from."""
    alternates = alternates or {}
    try:
        from prizepicks_export_core import _fetch_projection_rows
        if lines is None:
            lines = _fetch_projection_rows(league="WNBA")
    except Exception:  # noqa: BLE001 -- the Odds API rows still stand alone
        return rows
    by_key = {(row["player"].casefold(), row["marketKey"], row["line"]): row for row in rows}
    by_team = _events_by_team(events, now)
    for line in lines:
        starts = timestamp(line.get("start_time"))
        try:
            value = float(line.get("line"))
        except (TypeError, ValueError):
            continue
        if line.get("combo") or not starts or starts <= now:
            continue
        name = str(line.get("player") or "").strip()
        stat = re.sub(r"[^a-z0-9]", "", str(line.get("stat") or "").lower())
        market = _market_of(stat)
        modifier = str(line.get("odds_type") or "standard").lower()
        existing = by_key.get((name.casefold(), market, value))
        if existing:
            for app in existing["apps"]:
                if app.get("key") == "prizepicks":
                    app["modifier"] = existing["modifier"] = modifier
            existing["promo"] = bool(line.get("promo"))
            continue
        identities = directory["players"].get(_norm(name), [])
        identity = next((item for item in identities if item.get("team") in by_team), identities[0] if len(identities) == 1 else None)
        event = by_team[identity["team"]][0] if identity and identity.get("team") in by_team else None
        row = {"id": f"pp:{line.get('id')}", "sport": "wnba", "eventId": event.get("id") if event else None,
               "player": name, "marketKey": market, "market": PRIZEPICKS_LABELS.get(market) or line.get("stat"),
               "line": value, "modifier": modifier, "promo": bool(line.get("promo")), "homeTeam": event.get("home_team") if event else None,
               "awayTeam": event.get("away_team") if event else None, "startsAt": starts.isoformat(),
               "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None,
                         "updatedAt": line.get("updated_at") or None, "modifier": modifier}]
               + [app for app in alternates.get((name.casefold(), market, value), []) if app["key"] != "prizepicks"],
               "verified": True, "primaryBook": "prizepicks", "source": "prizepicks"}
        if identity:
            row.update({key: identity.get(key) for key in ("headshot", "position", "height", "team", "teamAbbr", "teamLogo")})
            row["playerId"] = identity.get("id")
        elif line.get("headshot"):
            row["headshot"] = line["headshot"]
        for side in ("home", "away"):
            team = directory["teams"].get(_norm(row.get(f"{side}Team"))) or {}
            row[f"{side}TeamLogo"], row[f"{side}TeamAbbr"] = team.get("logo"), team.get("abbr")
        rows.append(row)
        by_key[(name.casefold(), market, value)] = row
    return rows


def _board(include_history=True):
    cached = _cached()
    if cached is not None:
        return cached
    from prizepicks_export_core import _fetch_projection_rows
    pp_error = None
    try:
        pp_lines = _fetch_projection_rows(league="WNBA")
    except Exception as exc:
        pp_lines = []
        pp_error = exc
        print(f"[wnba-board] PrizePicks feed failed: {type(exc).__name__}")
    # PrizePicks' feed can carry the board on its own, so an Odds API outage
    # (or spent credits) no longer blanks it.
    try:
        event_response = _get(f"/sports/{SPORT}/events", {})
        events = event_response.json()
        if not isinstance(events, list):
            raise RuntimeError("WNBA event schema unavailable")
        odds_error = None
    except Exception as error:  # noqa: BLE001
        event_response, events, odds_error = None, [], error
    now = datetime.now(timezone.utc)
    try:
        directory = _roster_directory()
    except Exception:
        directory = {"players": {}, "teams": {}}
    rows = []
    # Books' alternate prices at numbers no main line is on -- held for the
    # PrizePicks lines added below.
    alternates = {}
    # Each book's main lines, for the Line Moves page (line_moves.py).
    main_quotes = {}
    for event in events:
        event_id = event.get("id") if isinstance(event, dict) else None
        starts_at = timestamp(event.get("commence_time")) if isinstance(event, dict) else None
        if not event_id or not starts_at or starts_at <= now or (starts_at - now).total_seconds() > 36 * 3600:
            continue
        payload = None
        for books in ((BOOKS, CORE_BOOKS) if pp_lines else ("prizepicks",)):
            try:
                response = _get(f"/sports/{SPORT}/events/{event_id}/odds", {
                    "markets": ",".join(MARKETS if pp_lines else ALL_MARKETS), "bookmakers": books, "oddsFormat": "american"
                }, cache_only=bool(pp_lines))
                payload = response.json()
                break
            except Exception:  # noqa: BLE001 -- one game must not sink the board
                continue
        if payload is None:
            continue
        grouped = {}
        standard_prices = {}
        # Capture standard PrizePicks prices first. The provider documents
        # +100 alternate offers as Demons and uses the standard price for
        # Goblins, matching the existing NFL line classification.
        for book in payload.get("bookmakers", []) if isinstance(payload, dict) else []:
            book_key = book.get("key")
            if book_key not in BOOK_PRIORITY:
                continue
            for market in book.get("markets", []):
                market_key = market.get("key")
                if market_key not in MARKETS:
                    continue
                for outcome in market.get("outcomes", []):
                    side = outcome.get("name")
                    price = outcome.get("price")
                    if side in ("Over", "Under") and finite(price):
                        standard_prices.setdefault((book_key, market_key, side), set()).add(price)
        for book in payload.get("bookmakers", []) if isinstance(payload, dict) else []:
            book_key = book.get("key")
            if book_key not in BOOK_PRIORITY:
                continue
            for market in book.get("markets", []):
                market_key = market.get("key")
                if market_key not in ALL_MARKETS:
                    continue
                base_market_key = market_key.removesuffix("_alternate")
                updated = timestamp(market.get("last_update") or book.get("last_update"))
                for outcome in market.get("outcomes", []):
                    player = str(outcome.get("description") or "").strip()
                    side = outcome.get("name")
                    line = outcome.get("point")
                    price = outcome.get("price")
                    if not player or side not in ("Over", "Under") or not finite(line):
                        continue
                    if market_key in MARKETS and book_key != "prizepicks":
                        main = main_quotes.setdefault((book_key, player, market_key, float(line)), {
                            "book": book_key, "player": player, "stat": MARKETS[market_key], "line": float(line),
                            "over": None, "under": None, "startsAt": starts_at.isoformat(),
                            "updatedAt": updated.isoformat() if updated else None})
                        if finite(price):
                            main[side.lower()] = price
                    # Same player/market/threshold across main and alternate
                    # feeds is one line. Otherwise matching Under prices and
                    # comparison books can be stranded on a separate row.
                    key = (player.casefold(), base_market_key, float(line))
                    modifier = "standard"
                    if market_key in ALTERNATE_MARKETS and book_key == "prizepicks":
                        modifier = "alternate"
                        if price == 100:
                            modifier = "demon"
                        elif finite(price) and standard_prices.get((book_key, base_market_key, side)) == {price}:
                            modifier = "goblin"
                    row = grouped.setdefault(key, {
                        "id": f"{event_id}:{market_key}:{player}:{line}", "sport": "wnba",
                        "eventId": event_id, "player": player, "marketKey": base_market_key,
                        "market": ALL_MARKETS[market_key], "line": float(line), "modifier": modifier,
                        "homeTeam": event.get("home_team"), "awayTeam": event.get("away_team"),
                        "startsAt": starts_at.isoformat(), "apps": {}, "verified": True,
                    })
                    # A line only another book's alternate market carries is
                    # a comparison price, not a line of its own (see below).
                    if market_key in MARKETS or book_key == "prizepicks":
                        row["main"] = True
                    quote = row["apps"].setdefault(book_key, {
                        "key": book_key, "name": book.get("title") or book_key,
                        "over": None, "under": None, "updatedAt": updated.isoformat() if updated else None,
                    })
                    if finite(price):
                        quote[side.lower()] = price
                    # A PrizePicks tier is the row's source of truth even when
                    # the same line also has comparison-book quotes.
                    if book_key == "prizepicks":
                        if "modifier" not in quote or market_key in MARKETS:
                            quote["modifier"] = modifier
                        row["modifier"] = quote["modifier"]
        for row in grouped.values():
            # Each book's main line is a row; another book's alternates only
            # add prices to a line that is already on the board.
            if not row.pop("main", False):
                alternates[(row["player"].casefold(), row["marketKey"], row["line"])] = sorted(
                    row["apps"].values(), key=lambda app: BOOK_PRIORITY.get(app["key"], 99))
                continue
            identities = directory["players"].get(_norm(row["player"]), [])
            identity = next((item for item in identities if item["team"] in (row["homeTeam"], row["awayTeam"])), identities[0] if len(identities) == 1 else None)
            if identity:
                row.update({key: identity.get(key) for key in ("headshot", "position", "height", "team", "teamAbbr", "teamLogo")})
                row["playerId"] = identity.get("id")
            row["homeTeamLogo"] = (directory["teams"].get(_norm(row["homeTeam"])) or {}).get("logo")
            row["awayTeamLogo"] = (directory["teams"].get(_norm(row["awayTeam"])) or {}).get("logo")
            row["homeTeamAbbr"] = (directory["teams"].get(_norm(row["homeTeam"])) or {}).get("abbr")
            row["awayTeamAbbr"] = (directory["teams"].get(_norm(row["awayTeam"])) or {}).get("abbr")
            row["apps"] = sorted(row["apps"].values(), key=lambda app: BOOK_PRIORITY.get(app["key"], 99))
            if row["apps"]:
                row["primaryBook"] = row["apps"][0]["key"]
                rows.append(row)
    try:
        import line_moves
        line_moves.observe_books("wnba", list(main_quotes.values()))
    except Exception:  # noqa: BLE001 -- never at the cost of the board
        pass
    _merge_prizepicks(rows, events, directory, now, alternates, lines=pp_lines)
    if not rows and (odds_error is not None or pp_error is not None):
        raise RuntimeError("PrizePicks lines are temporarily unavailable from both sources. Please retry shortly.")
    rows.sort(key=lambda row: (row["startsAt"], row["player"], row["market"], row["line"]))
    # The prop board itself is useful before the comparatively expensive
    # ESPN game-log fan-out finishes.  The Finder asks for this fast shape
    # first and hydrates the history progressively in the browser.
    if include_history:
        _attach_history(rows, now.year)
    remaining = event_response.headers.get("x-requests-remaining") if event_response is not None else None
    result = {
        "status": "AVAILABLE", "source": "the-odds-api + prizepicks", "sport": "wnba",
        "fetchedAt": now.isoformat(), "creditsRemaining": int(remaining) if str(remaining).isdigit() else None,
        "events": len(events), "rows": rows,
    }
    # Never replace a warm, history-complete cache with the lightweight shape.
    if include_history:
        _save(result)
    return result


def _nba_day(day):
    """ESPN's NBA games on one US date, kept ten minutes."""
    hit = _nba_days.get(day)
    if hit and time.time() - hit[0] < 10 * 60:
        return hit[1]
    data = _espn_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates={day}")
    games = []
    for event in data.get("events") or []:
        competition = (event.get("competitions") or [{}])[0]
        sides = {}
        for competitor in competition.get("competitors") or []:
            team = competitor.get("team") or {}
            sides[competitor.get("homeAway")] = {"abbr": team.get("abbreviation"), "name": team.get("displayName"),
                                                 "logo": team.get("logo")}
        start = timestamp(event.get("date"))
        if start and sides.get("home", {}).get("abbr") and sides.get("away", {}).get("abbr"):
            games.append({"id": str(event.get("id")), "start": start, "home": sides["home"], "away": sides["away"]})
    _nba_days[day] = (time.time(), games)
    return games


def _nba_games(lines, now):
    """Team code -> its games on the days the lines are for (ESPN's
    scoreboard files a game under its US date, so a late tip is still the
    day before in UTC)."""
    days = sorted({(start - timedelta(hours=5)).strftime("%Y%m%d") for line in lines
                   if (start := timestamp(line.get("start_time"))) and start > now})
    by_team = {}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for games in pool.map(lambda day: _safe(_nba_day, day, []), days):
            for game in games:
                for side in ("home", "away"):
                    by_team.setdefault(game[side]["abbr"], []).append(game)
    return by_team


def _safe(function, argument, fallback):
    try:
        return function(argument)
    except Exception:  # noqa: BLE001 -- one day's scoreboard must not sink the board
        return fallback


def _nba_row(line, starts, directory, by_team):
    """One PrizePicks NBA line as a board row, on ESPN's player and game."""
    name = str(line.get("player") or "").strip()
    stat = re.sub(r"[^a-z0-9]", "", str(line.get("stat") or "").lower())
    market = _market_of(stat)
    modifier = str(line.get("odds_type") or "standard").lower()
    code = str(line.get("team") or "").upper()
    code = NBA_TEAM_CODES.get(code, code)
    identities = directory["players"].get(_norm(name), [])
    identity = next((item for item in identities if item.get("teamAbbr") == code), identities[0] if len(identities) == 1 else None)
    team_code = (identity or {}).get("teamAbbr") or code
    # The team's game nearest the line's start (a team plays once a day).
    games = by_team.get(team_code) or []
    game = min(games, key=lambda item: abs((item["start"] - starts).total_seconds()), default=None)
    if game and abs((game["start"] - starts).total_seconds()) > 12 * 3600:
        game = None
    teams = {meta.get("abbr"): meta for meta in directory["teams"].values()}
    row = {"id": f"pp:{line.get('id')}", "sport": "nba", "eventId": game["id"] if game else None, "player": name,
           # PrizePicks' own stat name, so the board reads like the app and Export matches it exactly.
           "marketKey": market, "market": str(line.get("stat") or "").strip() or PRIZEPICKS_LABELS.get(market),
           "line": float(line["line"]), "modifier": modifier, "promo": bool(line.get("promo")), "startsAt": starts.isoformat(),
           "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None,
                     "updatedAt": line.get("updated_at") or None, "modifier": modifier}],
           "verified": True, "primaryBook": "prizepicks", "source": "prizepicks"}
    if game:
        for side in ("home", "away"):
            row[f"{side}Team"], row[f"{side}TeamAbbr"] = game[side]["name"], game[side]["abbr"]
            row[f"{side}TeamLogo"] = game[side]["logo"] or (teams.get(game[side]["abbr"]) or {}).get("logo")
    if identity:
        row.update({key: identity.get(key) for key in ("headshot", "position", "height", "team", "teamAbbr", "teamLogo")})
        row["playerId"] = identity.get("id")
    else:
        team = teams.get(team_code) or {}
        row.update({"headshot": line.get("headshot") or None, "position": line.get("position") or None,
                    "team": team.get("name") or line.get("team_name") or None, "teamAbbr": team_code or None,
                    "teamLogo": team.get("logo")})
    return row


def _nba_board(include_history=False):
    """Every NBA line PrizePicks posts -- each stat, each tier -- on ESPN's
    player (for his game logs) and game (for the matchup)."""
    now_stamp = time.time()
    if not include_history and _nba_memory["value"] is not None and now_stamp - _nba_memory["at"] < NBA_CACHE_SECONDS:
        return _nba_memory["value"]
    from prizepicks_export_core import _fetch_projection_rows
    try:
        lines = _fetch_projection_rows(league="NBA")
    except RuntimeError as error:
        # "no active projections" -- an empty slate, not an outage.
        if "no active" not in str(error).lower():
            raise
        lines = []
    now = datetime.now(timezone.utc)
    try:
        directory = _roster_directory("nba")
    except Exception:  # noqa: BLE001 -- the lines still stand without ESPN's rosters
        directory = {"players": {}, "teams": {}}
    by_team = _nba_games(lines, now)
    rows = []
    for line in lines:
        starts = timestamp(line.get("start_time"))
        try:
            float(line.get("line"))
        except (TypeError, ValueError):
            continue
        # Two-player combo lines ("A + B") belong to no one player's page.
        if line.get("combo") or not starts or starts <= now:
            continue
        rows.append(_nba_row(line, starts, directory, by_team))
    rows.sort(key=lambda row: (row["startsAt"], row["player"], row["market"], row["line"]))
    if include_history:
        _attach_history(rows, None, "nba")
    result = {"status": "AVAILABLE", "source": "prizepicks", "sport": "nba", "fetchedAt": now.isoformat(),
              "seasons": _nba_seasons(now), "rows": rows}
    if not include_history:
        _nba_memory.update(at=now_stamp, value=result)
    return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        league = "nba" if query.get("league", ["wnba"])[0].strip().lower() == "nba" else "wnba"
        name = league.upper()
        if not session_with_live_access(self.headers):
            return _send(self, 401, {"error": f"Sign in to use {name} data.", "authRequired": True})
        # Both leagues are only reachable through the Finder, so its admin
        # switches ("WNBA in the Finder", "NBA in the Finder") are enforced
        # here too -- hiding a league in the UI alone would leave the data one
        # URL away. Admins pass through.
        from site_controls import finder_sport_allowed
        if not finder_sport_allowed(self.headers, league):
            return _send(self, 503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
        resource = query.get("resource", ["board"])[0]
        try:
            if resource == "gamelog":
                player_id = query.get("playerId", [""])[0].strip()
                if league == "nba":
                    if not player_id.isdigit():
                        return _send(self, 400, {"error": "A verified NBA player is required."})
                    return _send(self, 200, _nba_gamelog(player_id))
                try: season = int(query.get("season", [str(datetime.now(timezone.utc).year)])[0])
                except ValueError: return _send(self, 400, {"error": "A valid WNBA season is required."})
                if not player_id.isdigit() or not 2000 <= season <= 2100: return _send(self, 400, {"error": "A verified WNBA player and season are required."})
                return _send(self, 200, _saved_history(player_id, "wnba", season))
            if resource == "gamelogs":
                # Several players' game logs in one request: the Finder asks
                # in batches instead of once per player. A player whose log
                # can't be had comes back as an error; the rest still arrive.
                ids = [value.strip() for value in query.get("playerIds", [""])[0].split(",") if value.strip()]
                if not ids or len(ids) > MAX_GAMELOG_BATCH or not all(value.isdigit() for value in ids):
                    return _send(self, 400, {"error": f"Up to {MAX_GAMELOG_BATCH} verified {name} players are required."})
                try: season = int(query.get("season", [str(datetime.now(timezone.utc).year)])[0])
                except ValueError: return _send(self, 400, {"error": f"A valid {name} season is required."})
                if not 2000 <= season <= 2100: return _send(self, 400, {"error": f"A valid {name} season is required."})

                def one(player_id):
                    try:
                        return player_id, _nba_gamelog(player_id) if league == "nba" else _saved_history(player_id, "wnba", season)
                    except Exception:  # noqa: BLE001 -- one player's log never fails the batch
                        return player_id, {"error": f"{name} game log unavailable."}

                with ThreadPoolExecutor(max_workers=len(ids)) as pool:
                    return _send(self, 200, {"histories": dict(pool.map(one, dict.fromkeys(ids)))})
            if resource == "find":
                who = query.get("name", [""])[0].strip()
                team = query.get("team", [""])[0].strip().upper()
                if not who or len(who) > 60 or len(team) > 4:
                    return _send(self, 400, {"error": "A player name is required."})
                identity = _find(who, team, league)
                if not identity:
                    return _send(self, 200, {"rows": []})
                return _send(self, 200, {"rows": [{key: identity.get(key) for key in (
                    "name", "headshot", "position", "height", "team", "teamAbbr", "teamLogo")} | {"playerId": identity.get("id")}]})
            if resource == "defender":
                # Who guards him (NBA.com's season matchups): the NBA only.
                if league != "nba":
                    return _send(self, 404, {"error": "Defender matchups are for the NBA."})
                who, team, opponent = (query.get(key, [""])[0].strip() for key in ("player", "team", "opponent"))
                if not who or len(who) > 60 or len(team) > 4 or len(opponent) > 4:
                    return _send(self, 400, {"error": "A player, his team and the opponent are required."})
                import nba_matchups
                try:
                    card = nba_matchups.defender(who, team, opponent)
                except nba_matchups.Unreachable as error:
                    return _send(self, 503, {"error": str(error)})
                return _send(self, 200, _with_box_stats(card))
            if resource == "play-types":
                # How he scores and how the opponent defends it (NBA.com's play types): the NBA only.
                if league != "nba":
                    return _send(self, 404, {"error": "Play types are for the NBA."})
                who, team, opponent = (query.get(key, [""])[0].strip() for key in ("player", "team", "opponent"))
                if not who or len(who) > 60 or len(team) > 4 or len(opponent) > 4:
                    return _send(self, 400, {"error": "A player, his team and the opponent are required."})
                import nba_matchups
                return _send(self, 200, nba_matchups.play_types(who, team, opponent))
            if resource in ("matchup", "league-context", "player-context", "game-notes", "scout"):
                return self._context(resource, query, league)
            if resource == "player-tracking":
                # The NBA's own tracking (backend/sports/wnba/tracking.py):
                # potential assists, rebound chances, catch-and-shoot, touches.
                who = query.get("name", [""])[0].strip()
                team = query.get("team", [""])[0].strip().upper()
                if league != "nba" or not who or len(who) > 60 or len(team) > 4:
                    return _send(self, 400, {"error": "An NBA player's name is required."})
                from backend.sports.wnba import league as stored_league, tracking
                found = tracking.player(stored_league.current_season(league="nba"), who, team)
                if found.get("reason") == "unreachable":
                    return _send(self, 503, {"error": "NBA tracking stats (stats.nba.com) didn't answer the site's server.", **found})
                return _send(self, 200, found)
            if resource != "board": return _send(self, 404, {"error": f"Unknown {name} resource."})
            fast = query.get("fast", ["0"])[0].lower() in ("1", "true", "yes")
            from finder_history_store import enroll_basketball
            if league == "nba":
                return _send(self, 200, enroll_basketball('nba', _nba_board(include_history=not fast)))
            return _send(self, 200, enroll_basketball('wnba', _board(include_history=not fast)))
        except RuntimeError as exc:
            return _send(self, 503, {"error": str(exc), "rows": [], "source": "prizepicks" if league == "nba" else "the-odds-api"})
        except Exception:
            return _send(self, 503, {"error": f"{name} lines are temporarily unavailable.", "rows": [],
                                     "source": "prizepicks" if league == "nba" else "the-odds-api"})

    def _context(self, resource, query, league_name="wnba"):
        """Matchup research for the player page. All of it comes from ESPN:
        the game summary for the matchup itself, and the stored season of
        box scores (backend/sports/wnba/league.py) for everything else."""
        from backend.sports.wnba import context, league, matchup
        arg = lambda name: (query.get(name) or [""])[0].strip()
        team_code = lambda value: value.upper() if value.isalnum() and 1 < len(value) <= 4 else ""
        try:
            if resource == "matchup":
                home, away = team_code(arg("home")), team_code(arg("away"))
                if not home or not away or not arg("startsAt"):
                    return _send(self, 400, {"error": "Both teams and the start time are required."})
                event_id = matchup.find_event(home, away, arg("startsAt"), league_name)
                if not event_id:
                    return _send(self, 404, {"error": "This game is not on ESPN's schedule yet."})
                return _send(self, 200, matchup.matchup(event_id, league_name))
            if resource == "game-notes":
                # The trend chart's game cards: this season and last, from
                # what is stored (no rebuild for a card).
                player_id = arg("playerId")
                if not player_id.isdigit():
                    return _send(self, 400, {"error": "A verified player is required."})
                season = league.current_season(league=league_name)
                payloads = [league.stored(year, league_name) for year in (season - 1, season)]
                return _send(self, 200, {"games": context.game_notes(payloads, player_id)})
            season = league.current_season(league=league_name)
            payload = league.ensure(season, league_name)
            # Tip-off day, before a game has finished: the player's page reads last season.
            if resource in ("player-context", "scout") and (not payload or not payload.get("games")):
                payload, season = league.stored(season - 1, league_name), season - 1
            if resource == "league-context":
                # The start of a season: defenses ranked, rotations and shot
                # zones read on a game or two would be noise (or nothing, at
                # tip-off), so last season's games join this season's until
                # each team has played enough (opportunity.blend).
                from backend.sports.wnba import opportunity
                games = len((payload or {}).get("games") or {})
                teams = len({team for game in ((payload or {}).get("games") or {}).values() for team in (game.get("t") or {})}) or 1
                if games * 2 / teams < opportunity.BLEND_GAMES:
                    previous = league.stored(season - 1, league_name)
                    payload = opportunity.blend(previous, payload) if games else previous
            if not payload or not payload.get("games"):
                return _send(self, 503, {"error": "Season data is still being prepared. Try again shortly."})
            if resource == "league-context":
                # The depth charts read each team's players now (ESPN's
                # rosters), so a signing shows before his first game there.
                rosters, roster_at = _team_rosters(league_name)
                built = (payload.get("builtAt"), tuple(payload.get("blended") or ()), roster_at)
                memory = _league_memory.get(league_name) or {}
                if memory.get("key") != (season, built):
                    memory = {"key": (season, built), "value": context.league_context(payload, rosters=rosters)}
                    _league_memory[league_name] = memory
                return _send(self, 200, memory["value"])
            player_id, team, opponent = arg("playerId"), team_code(arg("team")), team_code(arg("opponent"))
            if not player_id.isdigit() or not team or not opponent:
                return _send(self, 400, {"error": "A verified player, team and opponent are required."})
            if resource == "scout":
                return _send(self, 200, _scout(payload, season, player_id, opponent, league_name))
            market = arg("market")
            if market not in context.MARKET_STAT:
                return _send(self, 400, {"error": "Unknown market."})
            line = _number(arg("line"))
            # The start of a season: too few of his team's games to split or
            # share out, so last season's join them (opportunity.blend).
            from backend.sports.wnba import opportunity
            played = sum(1 for game in payload["games"].values() if team in (game.get("t") or {}))
            if played < opportunity.BLEND_GAMES:
                payload = opportunity.blend(league.stored(season - 1, league_name), payload)
            return _send(self, 200, context.player_context(payload, player_id, team, opponent, market, line))
        except Exception:
            return _send(self, 503, {"error": "Matchup research is temporarily unavailable."})
