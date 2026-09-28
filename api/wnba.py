"""Verified WNBA player-prop board backed by The Odds API.

The response is deliberately market-only: historical hit rates and player
profiles belong to a separate stats source and are never inferred from odds.
"""
from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth_core import session_with_live_access  # noqa: E402
from backend.sports.nfl.services.odds import _get, finite, timestamp  # noqa: E402
from v2.board import store  # noqa: E402
import requests  # noqa: E402

SPORT = "basketball_wnba"
CACHE_KEY = "krazy_data:wnba:v9:finder_board"
ROSTER_CACHE_KEY = "krazy_data:wnba:v2:roster_directory"  # v2: adds height
CACHE_SECONDS = 10 * 60
ROSTER_CACHE_SECONDS = 6 * 60 * 60
BOOKS = "prizepicks,underdog,draftkings,fanduel,betmgm"
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
BOOK_PRIORITY = {"prizepicks": 0, "underdog": 1, "draftkings": 2, "fanduel": 3, "betmgm": 4}
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
}
PRIZEPICKS_LABELS = {**MARKETS, "player_threes_attempts": "3-PT Attempted", "player_field_goals": "FG Made",
                     "player_frees_made": "Free Throws Made"}
_memory = {"at": 0.0, "value": None}
_roster_memory = {"at": 0.0, "value": None}
# The league context derived from the stored season, per (season, builtAt).
_league_memory = {}


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(text.casefold().replace(".", "").split())


def _espn_json(url):
    response = requests.get(url, headers={"Accept": "application/json"}, timeout=12)
    response.raise_for_status()
    return response.json()


def _roster_directory():
    now = time.time()
    if _roster_memory["value"] is not None and now - _roster_memory["at"] < ROSTER_CACHE_SECONDS:
        return _roster_memory["value"]
    try:
        raw = store.get(ROSTER_CACHE_KEY)
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < ROSTER_CACHE_SECONDS:
            _roster_memory.update(at=float(envelope["at"]), value=envelope["value"])
            return envelope["value"]
    except Exception:
        pass
    listing = _espn_json("https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams")
    teams = listing.get("sports", [{}])[0].get("leagues", [{}])[0].get("teams", [])
    team_meta = {}
    for item in teams:
        team = item.get("team", {})
        default_logo = next((logo.get("href") for logo in team.get("logos", []) if "default" in logo.get("rel", [])), None)
        team_meta[str(team.get("id"))] = {
            "name": team.get("displayName"), "abbr": team.get("abbreviation"), "logo": default_logo,
        }

    def load(team_id):
        return team_id, _espn_json(f"https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/{team_id}/roster")

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
    _roster_memory.update(at=now, value=value)
    try:
        store.set(ROSTER_CACHE_KEY, json.dumps({"at": now, "value": value}, separators=(",", ":")))
    except Exception:
        pass
    return value


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


def _game_logs(player_id, season):
    # v4: rows carry the full box line (attempts, fouls) for the game log
    # and supporting-stats views, are tagged by season type, and give the
    # score with this player's team first.
    cache_key = f"krazy_data:wnba:v5:gamelog:{player_id}:{season}"
    now = time.time()
    try:
        raw = store.get(cache_key)
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < 30 * 60:
            return envelope["value"]
    except Exception:
        pass
    data = _espn_json(f"https://site.web.api.espn.com/apis/common/v3/sports/basketball/wnba/athletes/{player_id}/gamelog?region=us&lang=en&contentorigin=espn&season={season}")
    names, events = data.get("names", []), data.get("events", {})
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
                box={"min":_number(stats.get("minutes")),"pts":points,"reb":rebounds,"ast":assists,"stl":steals,"blk":blocks,"to":turnovers,"pf":_number(stats.get("fouls")),
                     "fgm":_number(fg[0]) if len(fg)==2 else None,"fga":_number(fg[1]) if len(fg)==2 else None,"tpm":_number(tp[0]) if len(tp)==2 else None,"tpa":_number(tp[1]) if len(tp)==2 else None,"ftm":_number(ft[0]) if len(ft)==2 else None,"fta":_number(ft[1]) if len(ft)==2 else None}
                display_type=str(season_type.get("displayName") or "")
                kind="postseason" if "Postseason" in display_type else "preseason" if "Preseason" in display_type else "regular"
                rows.append({"gameId":event_id,"date":event.get("gameDate"),"season":season,"seasonType":display_type,"seasonKind":kind,"opponent":(event.get("opponent") or {}).get("abbreviation"),"opponentLogo":(event.get("opponent") or {}).get("logo"),"isHome":event.get("atVs")=="vs","result":event.get("gameResult"),"score":_own_score_first(event.get("score"),event.get("gameResult")),"minutes":_number(stats.get("minutes")),"values":values,"box":box})
    rows.sort(key=lambda row: row.get("date") or "")
    result={"status":"AVAILABLE","source":"espn","playerId":player_id,"season":season,"rows":rows,"fetchedAt":datetime.now(timezone.utc).isoformat()}
    try: store.set(cache_key,json.dumps({"at":now,"value":result},separators=(",",":")))
    except Exception: pass
    return result


def _window(values, line):
    decided = [value for value in values if value != line]
    hits = sum(value > line for value in decided)
    return {"hitRate": hits / len(decided) * 100 if decided else None, "hits": hits,
            "misses": len(decided) - hits, "pushes": len(values) - len(decided), "sample": len(values)}


def _attach_history(rows, season):
    player_ids = sorted({row.get("playerId") for row in rows if row.get("playerId")})
    histories = {}
    def load(player_id):
        try: return player_id, _game_logs(player_id, season).get("rows", [])
        except Exception: return player_id, []
    with ThreadPoolExecutor(max_workers=8) as pool:
        for player_id, logs in pool.map(load, player_ids): histories[player_id] = logs
    for row in rows:
        # Preseason games are not the player's real role or minutes; they
        # stay in the game log but never count toward a hit rate.
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


def _merge_prizepicks(rows, events, directory, now):
    """Add every line PrizePicks posts that the board does not have yet.
    A line both feeds carry keeps its comparison-book prices and takes
    PrizePicks' own tier (standard / goblin / demon)."""
    try:
        from prizepicks_export_core import _fetch_projection_rows
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
        market = PRIZEPICKS_MARKETS.get(stat) or f"pp:{stat}"
        modifier = str(line.get("odds_type") or "standard").lower()
        existing = by_key.get((name.casefold(), market, value))
        if existing:
            for app in existing["apps"]:
                if app.get("key") == "prizepicks":
                    app["modifier"] = existing["modifier"] = modifier
            continue
        identities = directory["players"].get(_norm(name), [])
        identity = next((item for item in identities if item.get("team") in by_team), identities[0] if len(identities) == 1 else None)
        event = by_team[identity["team"]][0] if identity and identity.get("team") in by_team else None
        row = {"id": f"pp:{line.get('id')}", "sport": "wnba", "eventId": event.get("id") if event else None,
               "player": name, "marketKey": market, "market": PRIZEPICKS_LABELS.get(market) or line.get("stat"),
               "line": value, "modifier": modifier, "homeTeam": event.get("home_team") if event else None,
               "awayTeam": event.get("away_team") if event else None, "startsAt": starts.isoformat(),
               "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None,
                         "updatedAt": line.get("updated_at") or None, "modifier": modifier}],
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
    for event in events:
        event_id = event.get("id") if isinstance(event, dict) else None
        starts_at = timestamp(event.get("commence_time")) if isinstance(event, dict) else None
        if not event_id or not starts_at or starts_at <= now:
            continue
        try:
            response = _get(f"/sports/{SPORT}/events/{event_id}/odds", {
                "markets": ",".join(ALL_MARKETS), "bookmakers": BOOKS, "oddsFormat": "american"
            })
            payload = response.json()
        except Exception:  # noqa: BLE001 -- one game must not sink the board
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
    _merge_prizepicks(rows, events, directory, now)
    if not rows and odds_error is not None:
        raise odds_error
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


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not session_with_live_access(self.headers):
            return _send(self, 401, {"error": "Sign in to use WNBA data.", "authRequired": True})
        # WNBA is only reachable through the Finder, so the Finder's admin
        # switches are enforced here too -- hiding it in the UI alone would
        # leave the data one URL away. Admins pass through.
        from site_controls import finder_sport_allowed
        if not finder_sport_allowed(self.headers, "wnba"):
            return _send(self, 503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
        query = parse_qs(urlparse(self.path).query)
        resource = query.get("resource", ["board"])[0]
        try:
            if resource == "gamelog":
                player_id = query.get("playerId", [""])[0].strip()
                try: season = int(query.get("season", [str(datetime.now(timezone.utc).year)])[0])
                except ValueError: return _send(self, 400, {"error": "A valid WNBA season is required."})
                if not player_id.isdigit() or not 2000 <= season <= 2100: return _send(self, 400, {"error": "A verified WNBA player and season are required."})
                return _send(self, 200, _game_logs(player_id, season))
            if resource in ("matchup", "league-context", "player-context"):
                return self._context(resource, query)
            if resource != "board": return _send(self, 404, {"error": "Unknown WNBA resource."})
            fast = query.get("fast", ["0"])[0].lower() in ("1", "true", "yes")
            return _send(self, 200, _board(include_history=not fast))
        except RuntimeError as exc:
            return _send(self, 503, {"error": str(exc), "rows": [], "source": "the-odds-api"})
        except Exception:
            return _send(self, 503, {"error": "WNBA lines are temporarily unavailable.", "rows": [], "source": "the-odds-api"})

    def _context(self, resource, query):
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
                event_id = matchup.find_event(home, away, arg("startsAt"))
                if not event_id:
                    return _send(self, 404, {"error": "This game is not on ESPN's schedule yet."})
                return _send(self, 200, matchup.matchup(event_id))
            season = league.current_season()
            payload = league.ensure(season)
            if not payload or not payload.get("games"):
                return _send(self, 503, {"error": "Season data is still being prepared. Try again shortly."})
            if resource == "league-context":
                built = payload.get("builtAt")
                if _league_memory.get("key") != (season, built):
                    _league_memory.update(key=(season, built), value=context.league_context(payload))
                return _send(self, 200, _league_memory["value"])
            player_id, team, opponent = arg("playerId"), team_code(arg("team")), team_code(arg("opponent"))
            if not player_id.isdigit() or not team or not opponent:
                return _send(self, 400, {"error": "A verified player, team and opponent are required."})
            market = arg("market")
            if market not in context.MARKET_STAT:
                return _send(self, 400, {"error": "Unknown market."})
            line = _number(arg("line"))
            return _send(self, 200, context.player_context(payload, player_id, team, opponent, market, line))
        except Exception:
            return _send(self, 503, {"error": "Matchup research is temporarily unavailable."})
