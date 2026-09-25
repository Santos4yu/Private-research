"""Verified WNBA player-prop board backed by The Odds API.

The response is deliberately market-only: historical hit rates and player
profiles belong to a separate stats source and are never inferred from odds.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth_core import session_with_live_access  # noqa: E402
from backend.sports.nfl.services.odds import _get, finite, timestamp  # noqa: E402
from v2.board import store  # noqa: E402

SPORT = "basketball_wnba"
CACHE_KEY = "krazy_data:wnba:v1:finder_board"
CACHE_SECONDS = 10 * 60
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


def _board():
    cached = _cached()
    if cached is not None:
        return cached
    event_response = _get(f"/sports/{SPORT}/events", {})
    events = event_response.json()
    if not isinstance(events, list):
        raise RuntimeError("WNBA event schema unavailable")
    now = datetime.now(timezone.utc)
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
            row["apps"] = sorted(row["apps"].values(), key=lambda app: BOOK_PRIORITY.get(app["key"], 99))
            if row["apps"]:
                row["primaryBook"] = row["apps"][0]["key"]
                rows.append(row)
    rows.sort(key=lambda row: (row["startsAt"], row["player"], row["market"], row["line"]))
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
        try:
            return _send(self, 200, _board())
        except RuntimeError as exc:
            return _send(self, 503, {"error": str(exc), "rows": [], "source": "the-odds-api"})
        except Exception:
            return _send(self, 503, {"error": "WNBA lines are temporarily unavailable.", "rows": [], "source": "the-odds-api"})
