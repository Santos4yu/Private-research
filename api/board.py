"""
Vercel serverless function: public read of the Discord bot's props board.

backend/update_board.py (the Vortex Data Engine that feeds the Discord bot's
/menu) mirrors its props_board table to the KV store after every run — this
endpoint just reads that mirror, so the site's Props tab always shows the
exact same board the bot serves. Never computes anything and never spends
odds credits.
"""
import json
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from auth_core import session_with_live_access  # noqa: E402
from v2.board import store  # noqa: E402
from v2.board import admin_auth  # noqa: E402
from prizepicks_export_core import _fetch_projection_rows, _norm_stat  # noqa: E402
from live_props_core import player_history  # noqa: E402

BOT_BOARD_KEY = "vortex:site_board"
SPECIALS_KEY = "vortex:site_specials"
MLB_BASE = "https://mlb-proxy.damian209466-d45.workers.dev/api/v1"
PITCHER_MARKETS = {
    "pitcherstrikeouts", "pitchingouts", "hitsallowed",
    "earnedrunsallowed", "pitcherwalks",
}


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(text.lower().replace(".", "").split())


def _json_get(path, params=None):
    url = f"{MLB_BASE}{path}"
    if params:
        url += "?" + urlencode(params)
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "Krazy-Picks/1.0"})
    with urlopen(req, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def _schedule_games(date_str):
    """Compact official matchup index used by the mobile game filter."""
    try:
        schedule = _json_get("/schedule", {"sportId": 1, "date": date_str, "hydrate": "probablePitcher"})
    except Exception:
        return []
    result = []
    for day in schedule.get("dates", []):
        for game in day.get("games", []):
            teams = game.get("teams", {})
            away = teams.get("away", {}).get("team", {})
            home = teams.get("home", {}).get("team", {})
            result.append({
                "game_pk": game.get("gamePk"), "start_time": game.get("gameDate"),
                "away_id": away.get("id"), "away": away.get("abbreviation") or away.get("name"),
                "home_id": home.get("id"), "home": home.get("abbreviation") or home.get("name"),
                "away_pitcher_id": (teams.get("away", {}).get("probablePitcher") or {}).get("id"),
                "home_pitcher_id": (teams.get("home", {}).get("probablePitcher") or {}).get("id"),
            })
    return result


def _live_game(game):
    pk = game.get("gamePk")
    status = game.get("status", {})
    abstract = status.get("abstractGameState", "Preview")
    try:
        box = _json_get(f"/game/{pk}/boxscore")
    except Exception:
        box = {}
    linescore = game.get("linescore", {})
    inning = linescore.get("currentInningOrdinal") or ""
    inning_state = linescore.get("inningState") or ""
    away = game.get("teams", {}).get("away", {})
    home = game.get("teams", {}).get("home", {})
    game_info = {
        "game_pk": pk,
        "game_key": str(pk),
        "away": away.get("team", {}).get("abbreviation") or away.get("team", {}).get("name", "Away"),
        "home": home.get("team", {}).get("abbreviation") or home.get("team", {}).get("name", "Home"),
        "away_score": away.get("score", 0),
        "home_score": home.get("score", 0),
        "abstract": abstract,
        "detailed": status.get("detailedState", abstract),
        "inning": " ".join(part for part in (inning_state, str(inning)) if part),
        "is_live": abstract == "Live",
        "is_final": abstract == "Final",
        "start_time": game.get("gameDate"),
    }
    players = {}
    for side in ("away", "home"):
        team = box.get("teams", {}).get(side, {})
        team_name = game_info[side]
        used_pitchers = team.get("pitchers", []) or []
        latest_pitcher_id = int(used_pitchers[-1]) if used_pitchers else None
        for pdata in team.get("players", {}).values():
            name = pdata.get("person", {}).get("fullName")
            player_id = pdata.get("person", {}).get("id")
            if not name:
                continue
            batting = pdata.get("stats", {}).get("batting", {})
            pitching = pdata.get("stats", {}).get("pitching", {})
            game_status = pdata.get("gameStatus", {})
            hits = int(batting.get("hits", 0) or 0)
            runs = int(batting.get("runs", 0) or 0)
            rbi = int(batting.get("rbi", 0) or 0)
            players[_norm(name)] = {
                **game_info,
                "team": team_name,
                "hits": hits,
                "runs": runs,
                "rbi": rbi,
                "hrr": hits + runs + rbi,
                "total_bases": int(batting.get("totalBases", 0) or 0),
                "home_runs": int(batting.get("homeRuns", 0) or 0),
                "at_bats": int(batting.get("atBats", 0) or 0),
                "plate_appearances": int(batting.get("plateAppearances", 0) or 0),
                "strikeouts": int(pitching.get("strikeOuts", 0) or 0),
                "pitch_count": int(pitching.get("numberOfPitches", pitching.get("pitchesThrown", 0)) or 0),
                "outs": int(pitching.get("outs", 0) or 0),
                "hits_allowed": int(pitching.get("hits", 0) or 0),
                "earned_runs": int(pitching.get("earnedRuns", 0) or 0),
                "is_current_pitcher": bool(game_status.get("isCurrentPitcher")),
                "pitched": bool(pitching.get("outs") or pitching.get("battersFaced") or pitching.get("numberOfPitches") or pitching.get("pitchesThrown")),
                "pitcher_replaced": bool(abstract == "Live" and pitching.get("battersFaced") and latest_pitcher_id and player_id != latest_pitcher_id),
            }
    return players


def _attach_live_records(data):
    records = data.get("records", {})
    props = records.get("props", [])
    if not props:
        return data
    dates = [str(row.get("game_date")) for row in props if row.get("game_date")]
    game_date = max(dates) if dates else str((datetime.now(timezone.utc) - timedelta(hours=10)).date())
    try:
        schedule = _json_get("/schedule", {"sportId": 1, "date": game_date, "hydrate": "linescore"})
        games = [g for day in schedule.get("dates", []) for g in day.get("games", [])]
        live_players = {}
        with ThreadPoolExecutor(max_workers=6) as pool:
            futures = [pool.submit(_live_game, game) for game in games]
            for future in as_completed(futures):
                live_players.update(future.result())
        for row in props:
            live = live_players.get(_norm(row.get("player_name")))
            if live:
                row["live"] = live
    except Exception:
        pass
    return data


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        from site_controls import allowed
        tab={'prop-history':'research','moneyline':'moneyline','nrfi':'nrfi','soccer':'finder'}.get((parse_qs(urlparse(self.path).query).get('view') or [''])[0],'v2')
        if not allowed(self.headers,tab):return self._send(503,{'error':'This section is temporarily unavailable','featureDisabled':True})
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in with Discord to use live research.", "authRequired": True})

        view = (parse_qs(urlparse(self.path).query).get("view") or [""])[0]
        if view == "soccer":
            # The Finder's soccer lines (soccer_board.py); its admin switch
            # is the "Soccer in the Finder" league setting.
            from site_controls import finder_sport_allowed
            if not finder_sport_allowed(self.headers, "soccer"):
                return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
            qs = parse_qs(urlparse(self.path).query)
            arg = lambda name: (qs.get(name) or [""])[0].strip()
            resource = arg("resource")
            if resource in {"log", "match", "club"}:
                # A team's recent matches, the match's own context, or a
                # player's club matches (soccer_research.py). ESPN ids and
                # slugs only.
                import soccer_research
                event, league, team, athlete = arg("event"), arg("league"), arg("team"), arg("athlete")
                if resource == "club":
                    if not soccer_research.valid_id(athlete) or not soccer_research.valid_id(team):
                        return self._send(400, {"error": "Unknown player."})
                elif not soccer_research.valid_id(event) or (league and not soccer_research.valid_slug(league)) \
                        or (resource == "log" and not soccer_research.valid_id(team)):
                    return self._send(400, {"error": "Unknown match."})
                try:
                    if resource == "club":
                        return self._send(200, soccer_research.club_log(athlete, team))
                    if resource == "log":
                        return self._send(200, soccer_research.team_log(team, event, league or None))
                    return self._send(200, soccer_research.match(event, league or None))
                except Exception:
                    return self._send(502, {"error": "Match data is temporarily unavailable."})
            try:
                from soccer_board import board as soccer_board
                return self._send(200, soccer_board())
            except Exception:
                return self._send(502, {"error": "Soccer lines are temporarily unavailable."})
        if view == "prop-history":
            qs = parse_qs(urlparse(self.path).query)
            try:
                return self._send(200, player_history((qs.get("player") or [""])[0], (qs.get("group") or ["pitching"])[0],
                                                      first_inning_stats=(qs.get("innings") or [""])[0] == "1"))
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            except Exception:
                return self._send(502, {"error": "Player history is temporarily unavailable."})
        if view in {"pitcher-props", "props"}:
            try:
                force = (parse_qs(urlparse(self.path).query).get("refresh") or [""])[0] == "1"
                rows = [row for row in _fetch_projection_rows(force=force)
                        if view == "props" or _norm_stat(row.get("stat")) in PITCHER_MARKETS]
                # The Finder asks for every book's price at each line too
                # (mlb_book_lines.py). Without them the lines still stand.
                if view == "props" and (parse_qs(urlparse(self.path).query).get("apps") or [""])[0] == "1":
                    try:
                        from mlb_book_lines import attach
                        rows = attach(rows)
                    except Exception:
                        pass
                rows.sort(key=lambda row: (
                    0 if row.get("odds_type") == "goblin" else 1,
                    str(row.get("player") or ""),
                    str(row.get("stat") or ""),
                    float(row.get("line") or 0),
                ))
                return self._send(200, {"props": rows})
            except Exception as exc:
                return self._send(502, {
                    "error": f"Active pitcher lines are temporarily unavailable: {exc}"
                })
        if view in ("specials", "results"):
            if view == "results" and not admin_auth.is_admin_request(self.headers):
                return self._send(401, {"error": "Admin passcode required"})
            raw = store.get(SPECIALS_KEY)
            try:
                data = json.loads(raw) if raw else {"moneylines": [], "nrfi": [], "records": {}}
            except json.JSONDecodeError:
                data = {"moneylines": [], "nrfi": [], "records": {}}
            if view == "results":
                result = {"generated_at": data.get("generated_at"), "records": data.get("records", {})}
                return self._send(200, _attach_live_records(result))
            return self._send(200, {"generated_at": data.get("generated_at"), "moneylines": data.get("moneylines", []), "moneyline_research": data.get("moneyline_research", []), "nrfi": data.get("nrfi", [])})

        raw = store.get(BOT_BOARD_KEY)
        if not raw:
            return self._send(200, {"date": None, "generated_at": None, "props": []})
        try:
            data = json.loads(raw)
            data["games"] = _schedule_games(data.get("date")) if data.get("date") else []
            return self._send(200, data)
        except json.JSONDecodeError:
            return self._send(200, {"date": None, "generated_at": None, "props": []})

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
