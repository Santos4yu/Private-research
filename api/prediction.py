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
import math
from copy import deepcopy
from concurrent.futures import Future
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import analyze  # noqa: E402
from vortextime import vortex_board_day
from prediction_core import compute_prediction, PlayerNotFound, NoGameFound, STAT_LABEL_TO_PROP_TYPE, MATCHUP_VERSION  # noqa: E402
from auth_core import session_with_live_access  # noqa: E402
from prizepicks_export_core import build_export  # noqa: E402


_ODDS_CACHE = {}
_PREDICTION_CACHE = {}
_PREDICTION_CACHE_LOCK = threading.Lock()
_PREDICTION_CACHE_SECONDS = 180
_PREDICTION_CACHE_MAX_ENTRIES = 128
_PREDICTION_INFLIGHT = {}
_MARKET_FOR_PROP = {
    "hits": "batter_hits", "total_bases": "batter_total_bases",
    "home_runs": "batter_home_runs", "rbis": "batter_rbis",
    "runs_scored": "batter_runs_scored", "strikeouts": "batter_strikeouts",
    "walks": "batter_walks", "hits_runs_rbis": "batter_hits_runs_rbis",
    "fantasy_score": "batter_fantasy_score",
    "pitcher_strikeouts": "pitcher_strikeouts", "pitcher_outs": "pitcher_outs",
    "pitcher_hits_allowed": "pitcher_hits_allowed",
    "pitcher_walks": "pitcher_walks",
    "pitcher_earned_runs": "pitcher_earned_runs",
    "pitcher_fantasy_score": "pitcher_fantasy_score",
}


def _cached_prediction(cache_key, compute):
    """Share one calculation between prefetch/open requests on this instance.

    Authorization stays in the handler before this cache. Never retain
    failures or extend the existing three-minute data freshness window.
    """
    now = time.monotonic()
    with _PREDICTION_CACHE_LOCK:
        for key, (cached_at, _) in list(_PREDICTION_CACHE.items()):
            if now - cached_at >= _PREDICTION_CACHE_SECONDS:
                del _PREDICTION_CACHE[key]
        cached = _PREDICTION_CACHE.get(cache_key)
        if cached is not None:
            return {**deepcopy(cached[1]), "cached": True}
        pending = _PREDICTION_INFLIGHT.get(cache_key)
        owner = pending is None
        if owner:
            pending = Future()
            _PREDICTION_INFLIGHT[cache_key] = pending

    if not owner:
        return {**deepcopy(pending.result()), "cached": True}

    try:
        result = compute()
        with _PREDICTION_CACHE_LOCK:
            while len(_PREDICTION_CACHE) >= _PREDICTION_CACHE_MAX_ENTRIES:
                del _PREDICTION_CACHE[next(iter(_PREDICTION_CACHE))]
            _PREDICTION_CACHE[cache_key] = (time.monotonic(), deepcopy(result))
        pending.set_result(deepcopy(result))
        return result
    except BaseException as exc:
        pending.set_exception(exc)
        raise
    finally:
        with _PREDICTION_CACHE_LOCK:
            _PREDICTION_INFLIGHT.pop(cache_key, None)


def _member_id(headers, session):
    """Whose graded slips these are: the signed-in account, else the
    session's own id; nobody for a shared visitor or beta session."""
    try:
        from account_auth import identity
        account = identity(headers)
        if account and account.get("id"):
            return str(account["id"])
    except Exception:  # noqa: BLE001
        pass
    member = str((session or {}).get("id") or "")
    return member if member and member not in ("public-visitor", "beta") else None


def _analyze_slip(image_bytes, admin=False):
    """The slip's legs as read from the screenshot (slip_reader.py); the
    browser grades them against the Finder's lines (src/slip-check.js).
    An admin also sees why reading failed."""
    import slip_reader
    slip = slip_reader.read_slip(image_bytes)
    if slip.get("error"):
        body = {"error": slip["error"]}
        if admin and slip.get("detail"):
            body["detail"] = slip["detail"]
        # Not set up or not reachable is the server's problem, not the screenshot's.
        return (503 if slip.get("reason") else 422), body
    # Which readers were skipped on the way to a good read stays in the
    # server log (slip_reader.py); the page shows only the slip.
    slip.pop("detail", None)
    return 200, slip


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
                                               "books": {}})
                side = str(outcome.get("name") or "").lower()
                if side == "over": row["ppOver"] = True
                if side == "under": row["ppUnder"] = True
                row["featured"] = row["featured"] or is_featured
    # Attach every quoting book's real odds, keyed by book, onto an
    # identical line only -- alternate lines are never requested for these
    # books and can never leak into this ladder. Which books actually come
    # back depends entirely on the market: traditional sportsbooks carry the
    # single-stat markets, while combo markets (hits+runs+RBIs) are usually
    # only quoted by the pick'em/exchange books.
    # Sportsbook prices are collected for EVERY line a book quotes, not just
    # the ones PrizePicks happens to post. Keeping them in their own map
    # matters for two reasons: "lines" below is the PrizePicks projection
    # ladder and must stay exactly that (adding lines PrizePicks doesn't
    # offer would put fictional entries in its picker), and odds should
    # still be available at whatever line the user steps to. Previously a
    # quote was dropped unless PrizePicks had the identical line, which --
    # combined with only the featured market being requested -- is why odds
    # showed at a single line and disappeared everywhere else.
    book_rows = {}
    quote_markets = {market, f"{market}_alternate"}
    for book in payload.get("quotes", {}).get("bookmakers", []):
        book_key = book.get("key")
        if not book_key:
            continue
        for market_row in book.get("markets", []):
            if market_row.get("key") not in quote_markets:
                continue
            for outcome in market_row.get("outcomes", []):
                if _norm(outcome.get("description")) != _norm(player_name):
                    continue
                try:
                    point, price = float(outcome.get("point")), int(outcome.get("price"))
                except (TypeError, ValueError):
                    continue
                side = str(outcome.get("name") or "").lower()
                if side not in ("over", "under"):
                    continue
                quote = book_rows.setdefault(point, {}).setdefault(book_key, {"over": None, "under": None})
                quote[side] = price
                # Mirrored onto the matching ladder row where one exists, so
                # existing consumers of "lines" keep working unchanged.
                row = rows.get(point)
                if row:
                    row["books"].setdefault(book_key, {"over": None, "under": None})[side] = price
    for row in rows.values():
        row["tier"] = ("STANDARD" if row["featured"] else
                       "DEMON" if row.get("prizePicksPrice") == 100 else "GOBLIN")
    result = {
        "player": player_name, "stat": stat_label, "book": "PrizePicks",
        "eventId": event["id"], "lastUpdate": updated,
        "lines": sorted(rows.values(), key=lambda row: row["line"]),
        "bookLines": [{"line": point, "books": books} for point, books in sorted(book_rows.items())],
    }
    _ODDS_CACHE[cache_key] = (time.time(), result)
    return result


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def _bets_list(self):
        """The member's own bets and unit size (bet_tracker.py), behind the My Bets switch."""
        from site_controls import allowed
        if not allowed(self.headers, 'bets'):
            return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
        session = session_with_live_access(self.headers)
        if not session:
            return self._send(401, {"error": "Sign in to see your bets.", "authRequired": True})
        member = _member_id(self.headers, session)
        if not member:
            return self._send(401, {"error": "Sign in to see your bets.", "authRequired": True})
        try:
            import bet_tracker
            return self._send(200, bet_tracker.listing(member))
        except Exception:
            return self._send(503, {"error": "Your bets are unavailable right now. Try again in a minute."})

    def do_GET(self):
        from site_controls import allowed
        if (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower() == "ping":
            # Wakes this function before a picture is sent to it (My Bets); nothing else.
            return self._send(200, {"ok": True})
        if (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower() == "bets":
            return self._bets_list()
        if not allowed(self.headers,'research'):
            return self._send(503, {"error":"This section is temporarily unavailable", "featureDisabled":True})
        # Live (uncached) Discord role check -- this is the "real data"
        # endpoint, so access revocation needs to be instant here, not
        # whenever a cached session cookie happens to expire.
        session = session_with_live_access(self.headers)
        if not session:
            return self._send(401, {"error": "Sign in with Discord to use live research.", "authRequired": True})

        qs = parse_qs(urlparse(self.path).query)
        if (qs.get("action", [""])[0]).strip().lower() == "slip-history":
            # The member's graded slips and how they finished, with the site's record (slip_ledger.py).
            import slip_ledger
            member = _member_id(self.headers, session)
            try:
                if not member:
                    return self._send(200, {"slips": [], "record": slip_ledger.record()})
                return self._send(200, slip_ledger.history(member))
            except Exception:
                return self._send(503, {"error": "Graded slips are unavailable right now."})
        if (qs.get("action", [""])[0]).strip().lower() == "learning":
            # What the results have taught the model (learning.py): the
            # corrections every page applies, the tiers and the record by grade.
            import learning
            try:
                found = learning.model() or {}
            except Exception:
                found = {}
            return self._send(200, {"version": found.get("version"), "at": found.get("at"), "picks": found.get("picks", 0),
                                    "groups": {name: {"points": group.get("points") or []} for name, group in (found.get("groups") or {}).items()},
                                    "tiers": found.get("tiers") or {}, "parlays": found.get("parlays") or {}, "parlayDays": found.get("parlayDays")})
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
            if not math.isfinite(line) or line < 0:
                raise ValueError("Line must be finite and nonnegative")
        except (TypeError, ValueError):
            return self._send(400, {"error": f"Invalid line value: {line_raw!r}"})

        if side not in {"over", "under"}:
            return self._send(400, {"error": "Side must be over or under."})

        prop_type = STAT_LABEL_TO_PROP_TYPE.get(stat_label)
        if not prop_type:
            return self._send(400, {"error": f"Unknown stat: {stat_label!r}"})

        try:
            player_id = int(player_id_raw) if player_id_raw else None
            team_id = int(team_id_raw) if team_id_raw else None
            cache_key = (player_id or _norm(player_name), prop_type, line, side,
                         team_id, _norm(team_name), MATCHUP_VERSION, vortex_board_day())
            result = _cached_prediction(cache_key, lambda: compute_prediction(
                player_name, prop_type, stat_label, line, side,
                player_id=player_id, team_id=team_id, team_name=team_name,
            ))
        except PlayerNotFound as exc:
            return self._send(404, {"error": str(exc)})
        except NoGameFound as exc:
            return self._send(404, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
            return self._send(500, {"error": f"Live lookup failed: {exc}"})

        return self._send(200, result)

    def do_POST(self):
        from site_controls import allowed
        # The Parlay page's export follows the Parlay section. The Pick Builder
        # in the side panel is there for everyone, so its export closes only
        # with the site itself (maintenance) or for a suspended member.
        source=(parse_qs(urlparse(self.path).query).get('from') or [''])[0]
        tab='slip' if 'slip-analyzer' in self.path else 'export' if 'slip-export' in self.path else 'bets' if 'action=bets-' in self.path else 'builder' if source=='parlay' else None
        if not allowed(self.headers,tab):return self._send(503,{'error':'This section is temporarily unavailable','featureDisabled':True})
        session = session_with_live_access(self.headers)
        if not session:
            return self._send(401, {
                "error": "Sign in with Discord to export PrizePicks lineups.",
                "authRequired": True,
            })
        action = (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower()
        if action == "slip-analyzer":
            content_type = (self.headers.get("Content-Type") or "").split(";", 1)[0].lower()
            if content_type not in {"image/png", "image/jpeg", "image/webp"}:
                return self._send(415, {"error": "Paste or upload a PNG, JPG, or WEBP screenshot."})
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                content_length = 0
            if content_length < 1 or content_length > 4 * 1024 * 1024:
                return self._send(413, {"error": "The screenshot must be smaller than 4 MB."})
            try:
                from v2.board import admin_auth
                status, body = _analyze_slip(self.rfile.read(content_length), admin_auth.is_admin_request(self.headers))
                return self._send(status, body)
            except Exception:
                return self._send(422, {"error": "That screenshot couldn't be read. Try again, or use a clearer one."})
        if action == "slip-export":
            # Slip to PrizePicks (its own section switch, checked above), in two
            # asks so neither runs out of time: a slip's picture read into its
            # picks (slip_reader.py), then those picks -- fixed on the page if
            # need be -- found on PrizePicks' boards in any league
            # (prizepicks_export_core.find_picks), with the link that opens them.
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                content_length = 0
            content_type = (self.headers.get("Content-Type") or "").split(";", 1)[0].lower()
            if content_length < 1 or content_length > 4 * 1024 * 1024:
                return self._send(413, {"error": "The picture must be smaller than 4 MB."})
            body = self.rfile.read(content_length)
            if content_type in {"image/png", "image/jpeg", "image/webp"}:
                import slip_reader
                try:
                    slip = slip_reader.read_slip(body)
                except Exception:  # noqa: BLE001
                    slip = {"error": "That picture couldn't be read. Try again, or use a clearer one."}
                if slip.get("error"):
                    return self._send(503 if slip.get("reason") else 422, {"error": slip["error"]})
                return self._send(200, {"app": slip.get("app"), "legs": slip.get("legs") or []})
            if content_type != "application/json":
                return self._send(415, {"error": "Paste or upload a PNG, JPG, or WEBP picture of a slip."})
            try:
                given = json.loads(body or b"{}").get("legs")
            except (ValueError, AttributeError):
                given = None
            if not isinstance(given, list) or not any(isinstance(leg, dict) for leg in given):
                return self._send(400, {"error": "No picks to find."})
            import prizepicks_export_core
            try:
                found = prizepicks_export_core.find_picks([leg for leg in given if isinstance(leg, dict)][:10])
            except Exception:  # noqa: BLE001 -- PrizePicks itself is the problem
                return self._send(502, {"error": "PrizePicks isn't answering right now. Try again in a minute."})
            picks = [item["pick"] for item in found if item.get("pick")]
            return self._send(200, {"legs": found, "url": prizepicks_export_core.picks_url(picks)})
        if action == "slip-save":
            # A graded slip's picks for the ledger (not the site's record), and the slip for its member when they track it (slip_ledger.py).
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
                if content_length < 1 or content_length > 32_768:
                    return self._send(413, {"error": "Invalid request size."})
                import slip_ledger
                member = _member_id(self.headers, session)
                if not member:
                    return self._send(200, {"saved": False})
                return self._send(200, {"saved": True, **slip_ledger.save(member, json.loads(self.rfile.read(content_length) or b"{}"))})
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                return self._send(400, {"error": str(exc) or "Invalid request."})
            except Exception:
                return self._send(503, {"error": "The slip couldn't be saved right now."})
        if action == "bets-read":
            # A picture of a bet for My Bets: what went in, what it pays or paid, how it stands (slip_reader.read_bet).
            content_type = (self.headers.get("Content-Type") or "").split(";", 1)[0].lower()
            if content_type not in {"image/png", "image/jpeg", "image/webp"}:
                return self._send(415, {"error": "Use a PNG, JPG or WEBP screenshot."})
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
            except ValueError:
                content_length = 0
            if content_length < 1 or content_length > 4 * 1024 * 1024:
                return self._send(413, {"error": "The picture must be smaller than 4 MB."})
            if not _member_id(self.headers, session):
                return self._send(401, {"error": "Sign in to keep your bets."})
            try:
                import slip_reader
                bet = slip_reader.read_bet(self.rfile.read(content_length))
                return self._send((503 if bet.get("reason") else 422) if bet.get("error") else 200,
                                  {"error": bet["error"]} if bet.get("error") else bet)
            except Exception:
                return self._send(422, {"error": "That picture couldn't be read. Try again, or use a clearer one."})
        if action in ("bets-save", "bets-remove", "bets-unit"):
            # The member's own bets (bet_tracker.py): add or change one, take one off, or set the unit size.
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
                if content_length < 1 or content_length > 16_384:
                    return self._send(413, {"error": "Invalid request size."})
                import bet_tracker
                member = _member_id(self.headers, session)
                if not member:
                    return self._send(401, {"error": "Sign in to keep your bets."})
                body = json.loads(self.rfile.read(content_length) or b"{}")
                if not isinstance(body, dict):
                    raise ValueError("Invalid request.")
                if action == "bets-save":
                    return self._send(200, bet_tracker.save(member, body.get("bet")))
                if action == "bets-remove":
                    return self._send(200, bet_tracker.remove(member, body.get("id")))
                return self._send(200, bet_tracker.set_unit(member, body.get("unit")))
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                return self._send(400, {"error": str(exc) or "Invalid request."})
            except Exception:
                return self._send(503, {"error": "Your bets couldn't be saved right now. Try again in a minute."})
        if action == "slip-learn":
            # The day's top picks as the site graded them, to learn from once
            # they're settled (slip_ledger.learn). Kept once each, capped a day.
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
                if content_length < 1 or content_length > 98_304:
                    return self._send(413, {"error": "Invalid request size."})
                import slip_ledger
                return self._send(200, slip_ledger.learn(json.loads(self.rfile.read(content_length) or b"{}")))
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                return self._send(400, {"error": str(exc) or "Invalid request."})
            except Exception:
                return self._send(503, {"error": "Not kept right now."})
        if action == "slip-remove":
            # Stop tracking a slip (slip_ledger.remove); its picks stay in the record.
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
                if content_length < 1 or content_length > 1_024:
                    return self._send(413, {"error": "Invalid request size."})
                import slip_ledger
                member = _member_id(self.headers, session)
                if not member:
                    return self._send(200, {"removed": 0})
                body = json.loads(self.rfile.read(content_length) or b"{}")
                return self._send(200, slip_ledger.remove(member, body.get("id") if isinstance(body, dict) else None))
            except (TypeError, ValueError, json.JSONDecodeError) as exc:
                return self._send(400, {"error": str(exc) or "Invalid request."})
            except Exception:
                return self._send(503, {"error": "The slip couldn't be removed right now."})
        if action == "slip-games":
            # Each pick's game: status, score, injuries, lineups and the
            # players' lines so far (slip_games.py). Free league sources only.
            try:
                content_length = int(self.headers.get("Content-Length") or 0)
                if content_length < 1 or content_length > 16_384:
                    return self._send(413, {"error": "Invalid request size."})
                import slip_games
                return self._send(200, slip_games.read(json.loads(self.rfile.read(content_length) or b"{}")))
            except (TypeError, ValueError, json.JSONDecodeError):
                return self._send(400, {"error": "Invalid request."})
            except Exception:
                return self._send(503, {"error": "Game updates are unavailable right now."})
        if action != "prizepicks-export":
            return self._send(404, {"error": "Unknown action."})
        try:
            content_length = int(self.headers.get("Content-Length") or 0)
            if content_length < 1 or content_length > 16_384:
                return self._send(413, {"error": "Invalid request size."})
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except (TypeError, ValueError, json.JSONDecodeError):
            return self._send(400, {"error": "Invalid JSON request."})
        status, body = build_export(payload.get("legs") if isinstance(payload, dict) else None)
        return self._send(status, body)

    def _send(self, status, body):
        # Serialize before committing the HTTP status. If a future response
        # accidentally contains a non-JSON value, return a real JSON 500
        # instead of sending "200 OK" and then closing with an empty body.
        try:
            payload = json.dumps(body).encode("utf-8")
        except (TypeError, ValueError):
            status = 500
            payload = json.dumps({
                "error": "Live research returned an invalid response. Please retry."
            }).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)
