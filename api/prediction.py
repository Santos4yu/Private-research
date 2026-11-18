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

    def _game_predictor(self):
        """The Game Predictor (game_predictor.py), behind its own switch:
        action=game-slate (the games to pick from), game-predict (one game),
        game-board (every game still to start, for the best picks and the
        generator), game-chart (one game's chance over time, read again
        while it's open), game-live (the games on now, for the list) and game-history (the member's saved picks,
        settled); saving and removing a pick are POSTs (_game_predictor_post)."""
        from site_controls import allowed
        if not allowed(self.headers, 'predictor'):
            return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in to use the Game Predictor.", "authRequired": True})
        import game_predictor
        qs = parse_qs(urlparse(self.path).query)
        arg = lambda name: (qs.get(name, [""])[0]).strip()
        action, sport = arg("action").lower(), arg("sport").lower()
        if sport not in game_predictor.SPORTS:
            return self._send(400, {"error": "Pick the NBA or the NFL."})
        try:
            if action == "game-slate":
                return self._send(200, game_predictor.slate(sport))
            if action == "game-history":
                member = _member_id(self.headers, session_with_live_access(self.headers))
                if not member:
                    return self._send(401, {"error": "Sign in to see your picks.", "authRequired": True})
                return self._send(200, game_predictor.history(sport, member))
            if action in ("game-record", "game-prop-record"):
                # The site's own record, the admin's and Admin-badge members'
                # (site_members.py): every game the model picked
                # (game_record.py), or the props (the generator's plays, the
                # Props tab's top picks, the posted record).
                from v2.board import admin_auth
                from site_controls import member_full_access
                if not (admin_auth.is_admin_request(self.headers) or member_full_access(self.headers)):
                    return self._send(403, {"error": "Admins only."})
                # ?day=2026-11-11: every pick of that day (the record's calendar).
                day = arg("day")
                day = day if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day or "") else None
                if action == "game-record":
                    import game_record
                    return self._send(200, game_record.read(sport, member=_member_id(self.headers, session_with_live_access(self.headers)), day=day))
                import slip_ledger
                if day:
                    return self._send(200, {"day": slip_ledger.generator_day(day)})
                return self._send(200, {"generator": slip_ledger.generator_record(), "board": slip_ledger.board_record(),
                                        "posted": slip_ledger.record()})
            if action == "game-chart":
                event = arg("event")
                if not event.isdigit() or len(event) > 14:
                    return self._send(400, {"error": "Pick a game first."})
                return self._send(200, game_predictor.chart(sport, event))
            if action == "game-live":
                # The games on now for the games list: scores, time left, each one's chance line (game_live.py).
                import game_live
                return self._send(200, game_live.live_list(sport))
            if action == "game-analysis":
                # The Why tab's analyst write-up (game_predictor.analysis): the pick worked out, the words by Groq.
                event = arg("event")
                if not event.isdigit() or len(event) > 14:
                    return self._send(400, {"error": "Pick a game first."})
                return self._send(200, game_predictor.analysis(sport, event))
            if action == "game-board":
                # A date (the generator, the member's own today to a week
                # ahead: a day either side of the US East's for time zones),
                # or the slate.
                day = arg("day")
                if day:
                    from datetime import datetime, timedelta, timezone
                    today = datetime.now(timezone.utc) - timedelta(hours=5)
                    allowed_days = {(today + timedelta(days=offset)).strftime("%Y%m%d") for offset in range(-1, 8)}
                    if day not in allowed_days:
                        return self._send(400, {"error": "Pick a day this week."})
                return self._send(200, game_predictor.board(sport, day=day or None))
            if action == "game-predict":
                event = arg("event")
                if not event.isdigit() or len(event) > 14:
                    return self._send(400, {"error": "Pick a game first."})
                return self._send(200, game_predictor.predict(sport, event))
        except LookupError as exc:
            return self._send(404, {"error": str(exc)})
        except Exception:  # noqa: BLE001 -- ESPN or the stored season can't be read right now
            return self._send(503, {"error": "The predictor can't reach its data right now. Try again in a minute."})
        return self._send(404, {"error": "Unknown predictor action."})

    def _game_record_post(self, action):
        """The site's own record: a step of filling in the season so far
        (game-record-fill: {sport}, the admin's), or the prop generator's
        calls from a page view (game-prop-plays: {plays, passes}, anyone
        signed in to the section; slip_ledger.generator_add)."""
        from site_controls import allowed
        if not allowed(self.headers, 'predictor'):
            return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in first.", "authRequired": True})
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length > 98_304:
            return self._send(413, {"error": "That request is too large."})
        try:
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        except ValueError:
            body = {}
        body = body if isinstance(body, dict) else {}
        try:
            if action == "game-record-fill":
                from v2.board import admin_auth
                if not admin_auth.is_admin_request(self.headers):
                    return self._send(403, {"error": "Admins only."})
                import game_predictor
                import game_record
                sport = str(body.get("sport") or "").lower()
                if sport not in game_predictor.SPORTS:
                    return self._send(400, {"error": "Pick the NBA or the NFL."})
                return self._send(200, game_record.fill(sport))
            import slip_ledger
            return self._send(200, slip_ledger.generator_add(body))
        except Exception:  # noqa: BLE001
            return self._send(503, {"error": "Not kept right now. Try again in a minute."})

    def _game_predictor_post(self, action):
        """Save a pick (game-save: {sport, event, side, stake?}) to the
        member's history, or take one back (game-remove: {sport, event})."""
        session = session_with_live_access(self.headers)
        member = _member_id(self.headers, session) if session else None
        if not member:
            return self._send(401, {"error": "Sign in to save picks.", "authRequired": True})
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        if length > 4096:
            return self._send(413, {"error": "That request is too large."})
        try:
            body = json.loads(self.rfile.read(length) or b"{}") if length else {}
        except ValueError:
            body = {}
        import game_predictor
        sport, event = str(body.get("sport") or "").lower(), str(body.get("event") or "")
        if sport not in game_predictor.SPORTS or not event.isdigit() or len(event) > 14:
            return self._send(400, {"error": "Pick a game first."})
        try:
            if action == "game-save":
                stake = body.get("stake")
                stake = float(stake) if stake not in (None, "") else None
                return self._send(200, {"pick": game_predictor.save_pick(sport, member, event, str(body.get("side") or ""), stake)})
            if action == "game-remove":
                return self._send(200, {"removed": game_predictor.remove_pick(sport, member, event)})
        except (ValueError, TypeError) as exc:
            return self._send(400, {"error": str(exc) if isinstance(exc, ValueError) and str(exc) else "Check the amount."})
        except LookupError as exc:
            return self._send(409, {"error": str(exc)})
        except Exception:  # noqa: BLE001
            return self._send(503, {"error": "Your pick couldn't be saved right now. Try again in a minute."})
        return self._send(404, {"error": "Unknown predictor action."})

    def _learning(self):
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

    def do_GET(self):
        from site_controls import allowed
        if (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower() == "ping":
            # Wakes this function before a picture is sent to it (My Bets); nothing else.
            return self._send(200, {"ok": True})
        if (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower() == "bets":
            return self._bets_list()
        if (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower().startswith("game-"):
            return self._game_predictor()
        if (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower() == "learning" and self.headers.get("X-GitHub-OIDC"):
            # The prop snapshot job (snapshot_runner.py) grades with the same
            # corrections every page applies.
            import snapshot_runner
            if snapshot_runner.verified(self.headers):
                return self._learning()
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
            return self._learning()
        if (qs.get("action", [""])[0]).strip().lower() == "player-news":
            # What the news says about a player for a line (player_news.py):
            # ESPN's player news, read by Groq into a few notes.
            import player_news
            arg = lambda name: (qs.get(name, [""])[0]).strip()
            sport, player_id = arg("sport").lower(), arg("playerId")
            if sport not in player_news.GAMES or not player_id or len(player_id) > 20:
                return self._send(400, {"error": "A sport and an ESPN player are required."})
            try:
                line = float(arg("line")) if arg("line") else None
            except ValueError:
                line = None
            try:
                return self._send(200, player_news.read(sport, player_id, arg("player")[:60], arg("team")[:6], arg("market")[:40],
                                                        line, arg("when")[:30]))
            except Exception:
                return self._send(503, {"error": "Player news is unavailable right now."})
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
        tab='slip' if 'slip-analyzer' in self.path else 'export' if 'slip-export' in self.path else 'bets' if 'action=bets-' in self.path else 'predictor' if 'action=game-' in self.path else 'builder' if source=='parlay' else None
        if not allowed(self.headers,tab):return self._send(503,{'error':'This section is temporarily unavailable','featureDisabled':True})
        game_action = (parse_qs(urlparse(self.path).query).get("action", [""])[0]).strip().lower()
        if game_action in ("game-save", "game-remove"):
            return self._game_predictor_post(game_action)
        if game_action in ("game-record-fill", "game-prop-plays"):
            return self._game_record_post(game_action)
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
        if action in ("bets-save", "bets-remove", "bets-unit", "bets-bank"):
            # The member's own bets (bet_tracker.py): add or change one, take one off, set the unit size or the balance.
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
                if action == "bets-bank":
                    return self._send(200, bet_tracker.set_bank(member, body))
                return self._send(200, bet_tracker.set_unit(member, body.get("unit"), every=body.get("every") is True))
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
