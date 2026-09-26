"""Verified WNBA player-prop board backed by The Odds API.

The response is deliberately market-only: historical hit rates and player
profiles belong to a separate stats source and are never inferred from odds.
"""
from __future__ import annotations

import json
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
CACHE_KEY = "krazy_data:wnba:v6:finder_board"
ROSTER_CACHE_KEY = "krazy_data:wnba:v1:roster_directory"
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
BOOK_PRIORITY = {"prizepicks": 0, "underdog": 1, "draftkings": 2, "fanduel": 3, "betmgm": 4}
_memory = {"at": 0.0, "value": None}
_roster_memory = {"at": 0.0, "value": None}


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


def _game_logs(player_id, season):
    cache_key = f"krazy_data:wnba:v1:gamelog:{player_id}:{season}"
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
                rows.append({"gameId":event_id,"date":event.get("gameDate"),"season":season,"seasonType":season_type.get("displayName"),"opponent":(event.get("opponent") or {}).get("abbreviation"),"opponentLogo":(event.get("opponent") or {}).get("logo"),"isHome":event.get("atVs")=="vs","result":event.get("gameResult"),"score":event.get("score"),"minutes":_number(stats.get("minutes")),"values":values})
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
        logs = histories.get(row.get("playerId"), [])
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


def _board():
    cached = _cached()
    if cached is not None:
        return cached
    event_response = _get(f"/sports/{SPORT}/events", {})
    events = event_response.json()
    if not isinstance(events, list):
        raise RuntimeError("WNBA event schema unavailable")
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
        response = _get(f"/sports/{SPORT}/events/{event_id}/odds", {
            "markets": ",".join(MARKETS), "bookmakers": BOOKS, "oddsFormat": "american"
        })
        payload = response.json()
        grouped = {}
        for book in payload.get("bookmakers", []) if isinstance(payload, dict) else []:
            book_key = book.get("key")
            if book_key not in BOOK_PRIORITY:
                continue
            for market in book.get("markets", []):
                market_key = market.get("key")
                if market_key not in MARKETS:
                    continue
                updated = timestamp(market.get("last_update") or book.get("last_update"))
                for outcome in market.get("outcomes", []):
                    player = str(outcome.get("description") or "").strip()
                    side = outcome.get("name")
                    line = outcome.get("point")
                    price = outcome.get("price")
                    if not player or side not in ("Over", "Under") or not finite(line):
                        continue
                    key = (player.casefold(), market_key, float(line))
                    row = grouped.setdefault(key, {
                        "id": f"{event_id}:{market_key}:{player}:{line}", "sport": "wnba",
                        "eventId": event_id, "player": player, "marketKey": market_key,
                        "market": MARKETS[market_key], "line": float(line),
                        "homeTeam": event.get("home_team"), "awayTeam": event.get("away_team"),
                        "startsAt": starts_at.isoformat(), "apps": {}, "verified": True,
                    })
                    quote = row["apps"].setdefault(book_key, {
                        "key": book_key, "name": book.get("title") or book_key,
                        "over": None, "under": None, "updatedAt": updated.isoformat() if updated else None,
                    })
                    quote[side.lower()] = price if finite(price) else None
        for row in grouped.values():
            identities = directory["players"].get(_norm(row["player"]), [])
            identity = next((item for item in identities if item["team"] in (row["homeTeam"], row["awayTeam"])), identities[0] if len(identities) == 1 else None)
            if identity:
                row.update({key: identity.get(key) for key in ("headshot", "position", "team", "teamAbbr", "teamLogo")})
                row["playerId"] = identity.get("id")
            row["homeTeamLogo"] = (directory["teams"].get(_norm(row["homeTeam"])) or {}).get("logo")
            row["awayTeamLogo"] = (directory["teams"].get(_norm(row["awayTeam"])) or {}).get("logo")
            row["homeTeamAbbr"] = (directory["teams"].get(_norm(row["homeTeam"])) or {}).get("abbr")
            row["awayTeamAbbr"] = (directory["teams"].get(_norm(row["awayTeam"])) or {}).get("abbr")
            row["apps"] = sorted(row["apps"].values(), key=lambda app: BOOK_PRIORITY.get(app["key"], 99))
            if row["apps"]:
                row["primaryBook"] = row["apps"][0]["key"]
                rows.append(row)
    rows.sort(key=lambda row: (row["startsAt"], row["player"], row["market"], row["line"]))
    _attach_history(rows, now.year)
    remaining = event_response.headers.get("x-requests-remaining")
    result = {
        "status": "AVAILABLE", "source": "the-odds-api", "sport": "wnba",
        "fetchedAt": now.isoformat(), "creditsRemaining": int(remaining) if str(remaining).isdigit() else None,
        "events": len(events), "rows": rows,
    }
    _save(result)
    return result


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not session_with_live_access(self.headers):
            return _send(self, 401, {"error": "Sign in to use WNBA data.", "authRequired": True})
        query = parse_qs(urlparse(self.path).query)
        resource = query.get("resource", ["board"])[0]
        try:
            if resource == "gamelog":
                player_id = query.get("playerId", [""])[0].strip()
                try: season = int(query.get("season", [str(datetime.now(timezone.utc).year)])[0])
                except ValueError: return _send(self, 400, {"error": "A valid WNBA season is required."})
                if not player_id.isdigit() or not 2000 <= season <= 2100: return _send(self, 400, {"error": "A verified WNBA player and season are required."})
                return _send(self, 200, _game_logs(player_id, season))
            if resource != "board": return _send(self, 404, {"error": "Unknown WNBA resource."})
            return _send(self, 200, _board())
        except RuntimeError as exc:
            return _send(self, 503, {"error": str(exc), "rows": [], "source": "the-odds-api"})
        except Exception:
            return _send(self, 503, {"error": "WNBA lines are temporarily unavailable.", "rows": [], "source": "the-odds-api"})
