"""
Vercel serverless function for the live prediction API.

Vercel auto-detects any api/*.py file with a class named `handler`
subclassing BaseHTTPRequestHandler and routes /api/prediction to it.
Vercel has solid, current Python function support (unlike Netlify --
see ../netlify/functions/prediction.py for why that path doesn't work).

All actual logic lives in predictions-site/prediction_core.py so both
platform wrappers share one implementation.
"""

import json
import re
import sys
import time
import unicodedata
import threading
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prediction_core import compute_prediction, PlayerNotFound, NoGameFound, STAT_LABEL_TO_PROP_TYPE  # noqa: E402
from auth_core import session_with_live_access  # noqa: E402


_ODDS_CACHE = {}
_PREDICTION_CACHE = {}
_PREDICTION_CACHE_LOCK = threading.Lock()
_PREDICTION_CACHE_SECONDS = 180
_MARKET_FOR_PROP = {
    "hits": "batter_hits", "total_bases": "batter_total_bases",
    "home_runs": "batter_home_runs", "rbis": "batter_rbis",
    "runs_scored": "batter_runs_scored", "strikeouts": "batter_strikeouts",
    "walks": "batter_walks", "hits_runs_rbis": "batter_hits_runs_rbis",
    "fantasy_score": "batter_fantasy_score",
    "pitcher_strikeouts": "pitcher_strikeouts", "pitcher_outs": "pitcher_outs",
    "pitcher_hits_allowed": "pitcher_hits_allowed",
    "pitcher_earned_runs": "pitcher_earned_runs",
    "pitcher_fantasy_score": "pitcher_fantasy_score",
}


def _norm(value):
    # Sports feeds commonly omit accents that MLB keeps in player names
    # (García/Garcia, Ramírez/Ramirez, Muñoz/Munoz). Transliterate before
    # removing punctuation so those are treated as the same player.
    ascii_value = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = ascii_value.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", ascii_value.lower())


def _prizepicks_lines(player_name, stat_label, opponent):
    prop_type = STAT_LABEL_TO_PROP_TYPE.get(stat_label)
    market = _MARKET_FOR_PROP.get(prop_type)
    if not market:
        raise ValueError(f"PrizePicks lines are not supported for {stat_label} yet.")
    cache_key = (_norm(player_name), market, _norm(opponent))
    cached = _ODDS_CACHE.get(cache_key)
    if cached and time.time() - cached[0] < 300:
        return {**cached[1], "cached": True}

    from v2.board import odds_client
    events = odds_client.list_events()
    opp_key = _norm(opponent)
    event = next((event for event in events if opp_key and opp_key in {
        _norm(event.get("home_team")), _norm(event.get("away_team"))
    }), None)
    if not event:
        raise LookupError("Could not match tonight's MLB game to PrizePicks.")

    payload = odds_client.fetch_prizepicks_prop_lines(event["id"], market)
    rows = {}
    updated = None
    for book in payload.get("prizepicks", {}).get("bookmakers", []):
        if book.get("key") != "prizepicks":
            continue
        for market_row in book.get("markets", []):
            is_featured = market_row.get("key") == market
            updated = market_row.get("last_update") or updated
            for outcome in market_row.get("outcomes", []):
                if _norm(outcome.get("description")) != _norm(player_name):
                    continue
                try:
                    point = float(outcome.get("point"))
                    price = int(outcome.get("price"))
                except (TypeError, ValueError):
                    continue
                row = rows.setdefault(point, {"line": point, "featured": False,
                                               "prizePicksPrice": price,
                                               "ppOver": False, "ppUnder": False,
                                               "dkOverOdds": None, "dkUnderOdds": None})
                side = str(outcome.get("name") or "").lower()
                if side == "over": row["ppOver"] = True
                if side == "under": row["ppUnder"] = True
                row["featured"] = row["featured"] or is_featured
    # Attach DK sportsbook odds only to an identical line. DK alternate lines
    # are never requested and can never leak into this ladder.
    for book in payload.get("draftkings", {}).get("bookmakers", []):
        if book.get("key") != "draftkings":
            continue
        for market_row in book.get("markets", []):
            if market_row.get("key") != market:
                continue
            for outcome in market_row.get("outcomes", []):
                if _norm(outcome.get("description")) != _norm(player_name):
                    continue
                try:
                    point, price = float(outcome.get("point")), int(outcome.get("price"))
                except (TypeError, ValueError):
                    continue
                row = rows.get(point)
                if not row:
                    continue
                side = str(outcome.get("name") or "").lower()
                if side == "over": row["dkOverOdds"] = price
                if side == "under": row["dkUnderOdds"] = price
    for row in rows.values():
        row["tier"] = ("STANDARD" if row["featured"] else
                       "DEMON" if row.get("prizePicksPrice") == 100 else "GOBLIN")
    result = {
        "player": player_name, "stat": stat_label, "book": "PrizePicks",
        "eventId": event["id"], "lastUpdate": updated,
        "lines": sorted(rows.values(), key=lambda row: row["line"]),
    }
    _ODDS_CACHE[cache_key] = (time.time(), result)
    return result


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        # Live (uncached) Discord role check -- this is the "real data"
        # endpoint, so access revocation needs to be instant here, not
        # whenever a cached session cookie happens to expire.
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in with Discord to use live research.", "authRequired": True})

        qs = parse_qs(urlparse(self.path).query)
        if (qs.get("action", [""])[0]).strip().lower() == "prizepicks-lines":
            player_name = (qs.get("player", [""])[0]).strip()
            stat_label = (qs.get("stat", [""])[0]).strip()
            opponent = (qs.get("opponent", [""])[0]).strip()
            if not player_name or not stat_label or not opponent:
                return self._send(400, {"error": "Missing player, stat, or opponent."})
            try:
                return self._send(200, _prizepicks_lines(player_name, stat_label, opponent))
            except (ValueError, LookupError) as exc:
                return self._send(404, {"error": str(exc)})
            except Exception as exc:
                return self._send(502, {"error": f"PrizePicks lines unavailable: {exc}"})

        player_name = (qs.get("player", [""])[0]).strip()
        stat_label = (qs.get("stat", [""])[0]).strip()
        side = (qs.get("side", [""])[0]).strip().lower()
        line_raw = qs.get("line", [None])[0]
        player_id_raw = qs.get("playerId", [None])[0]
        team_id_raw = qs.get("teamId", [None])[0]
        team_name = (qs.get("team", [""])[0]).strip()

        if not player_name or not stat_label or not side or line_raw is None:
            return self._send(400, {"error": "Missing required params: player, stat, line, side"})

        try:
            line = float(line_raw)
        except (TypeError, ValueError):
            return self._send(400, {"error": f"Invalid line value: {line_raw!r}"})

        if side != "over":
            return self._send(400, {"error": "Private Research supports Over props only."})

        prop_type = STAT_LABEL_TO_PROP_TYPE.get(stat_label)
        if not prop_type:
            return self._send(400, {"error": f"Unknown stat: {stat_label!r}"})

        try:
            player_id = int(player_id_raw) if player_id_raw else None
            team_id = int(team_id_raw) if team_id_raw else None
            cache_key = (player_id or _norm(player_name), prop_type, line, side,
                         team_id, _norm(team_name))
            with _PREDICTION_CACHE_LOCK:
                cached = _PREDICTION_CACHE.get(cache_key)
            if cached and time.time() - cached[0] < _PREDICTION_CACHE_SECONDS:
                result = {**cached[1], "cached": True}
            else:
                result = compute_prediction(player_name, prop_type, stat_label, line, side,
                                            player_id=player_id, team_id=team_id,
                                            team_name=team_name)
                with _PREDICTION_CACHE_LOCK:
                    _PREDICTION_CACHE[cache_key] = (time.time(), result)
        except PlayerNotFound as exc:
            return self._send(404, {"error": str(exc)})
        except NoGameFound as exc:
            return self._send(404, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
            return self._send(500, {"error": f"Live lookup failed: {exc}"})

        return self._send(200, result)

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
