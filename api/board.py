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
        tab={'finder-history':'finder','prop-history':'research','moneyline':'moneyline','nrfi':'nrfi','soccer':'finder','nhl':'finder','cfb':'finder','tennis':'finder','moves':'moves','mlb-context':'finder','moneylines':'moneyline','mlb-sheet':'sheets','nfl-sheet':'sheets','mlb-matchups':'bot'}.get((parse_qs(urlparse(self.path).query).get('view') or [''])[0],'v2')
        if (parse_qs(urlparse(self.path).query).get('view') or [''])[0] == 'cs2':
            tab = 'finder'
        # Krazy Bot reads the MLB sheets and slate matchups too, so either tab opens them.
        reads_for_bot=(parse_qs(urlparse(self.path).query).get('view') or [''])[0] in ('mlb-sheet','mlb-matchups')
        if not (allowed(self.headers,tab) or (reads_for_bot and allowed(self.headers,'bot'))):return self._send(503,{'error':'This section is temporarily unavailable','featureDisabled':True})
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in with Discord to use live research.", "authRequired": True})

        view = (parse_qs(urlparse(self.path).query).get("view") or [""])[0]
        if view == "finder-history":
            from finder_history_store import SPORTS, snapshot
            from site_controls import finder_sport_allowed
            sport = (parse_qs(urlparse(self.path).query).get("sport") or [""])[0]
            if sport not in SPORTS:
                return self._send(400, {"error": "Unknown Finder sport"})
            if not finder_sport_allowed(self.headers, sport):
                return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
            return self._send(200, snapshot(sport))
        if view == "cs2":
            from site_controls import finder_sport_allowed
            if not finder_sport_allowed(self.headers, "cs2"):
                return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
            try:
                from cs2_board import board
                return self._send(200, board(force=(parse_qs(urlparse(self.path).query).get("refresh") or [""])[0] == "1"), compress=True)
            except Exception:
                return self._send(502, {"error": "CS2 lines are temporarily unavailable."})
        if view == "tennis":
            qs = parse_qs(urlparse(self.path).query)
            from site_controls import finder_sport_allowed
            if not finder_sport_allowed(self.headers, "tennis"):
                return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
            try:
                from tennis_board import board as tennis_board
                if (qs.get('resource') or [''])[0] == 'context':
                    from tennis_context import context
                    return self._send(200, context((qs.get('player') or [''])[0],(qs.get('opponent') or [''])[0],(qs.get('startsAt') or [''])[0]))
                if (qs.get('resource') or [''])[0] == 'history':
                    from tennis_history import history as tennis_history
                    from finder_history_store import remember
                    player = (qs.get('player') or [''])[0]
                    return self._send(200, remember('tennis', 'tennis:'+player, tennis_history(player), {'player':player}))
                force = (parse_qs(urlparse(self.path).query).get("refresh") or [""])[0] == "1"
                return self._send(200, tennis_board(force=force))
            except Exception:
                return self._send(502, {"error": "Tennis lines are temporarily unavailable."})
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
                        from finder_history_store import remember
                        return self._send(200, remember('soccer', f'soccer:{league}:{event}:{team}', soccer_research.team_log(team, event, league or None), {'team':team,'event':event,'league':league}))
                    return self._send(200, soccer_research.match(event, league or None))
                except Exception:
                    return self._send(502, {"error": "Match data is temporarily unavailable."})
            try:
                from soccer_board import board as soccer_board
                return self._send(200, soccer_board())
            except Exception:
                return self._send(502, {"error": "Soccer lines are temporarily unavailable."})
        if view == "nhl":
            # The Finder's NHL lines (nhl_board.py) and research
            # (nhl_research.py); its admin switch is "NHL in the Finder".
            from site_controls import finder_sport_allowed
            if not finder_sport_allowed(self.headers, "nhl"):
                return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
            qs = parse_qs(urlparse(self.path).query)
            arg = lambda name: (qs.get(name) or [""])[0].strip()
            resource = arg("resource")
            if resource:
                import nhl_research
                team, opponent, game = arg("team").upper(), arg("opponent").upper(), arg("game")
                if (team and not nhl_research.valid_team(team)) or (opponent and not nhl_research.valid_team(opponent)) \
                        or (game and not nhl_research.valid_id(game)):
                    return self._send(400, {"error": "Unknown team or game."})
                try:
                    if resource == "find":
                        # A slip's pick whose game has started (so it's off
                        # the board): the player's NHL id, team and photo.
                        who = arg("name")
                        if not who or len(who) > 60:
                            return self._send(400, {"error": "A player name is required."})
                        return self._send(200, {"rows": nhl_research.find(who, team or None)})
                    if resource == "log" and team:
                        from finder_history_store import remember
                        return self._send(200, remember('nhl', f'nhl:{team}:{opponent}', nhl_research.team_log(team, opponent or None), {'team':team,'opponent':opponent}))
                    if resource == "team" and team:
                        return self._send(200, nhl_research.team_context(team))
                    if resource == "matchup" and game:
                        # The line's teams and start, so the game need not be
                        # looked up on the NHL's schedule.
                        home, away, start = arg("home").upper(), arg("away").upper(), arg("start")
                        try:
                            datetime.fromisoformat(start.replace("Z", "+00:00"))
                        except ValueError:
                            start = ""
                        if not (nhl_research.valid_team(home) and nhl_research.valid_team(away) and start):
                            home = away = start = None
                        return self._send(200, nhl_research.matchup(game, home, away, start))
                    if resource == "league":
                        return self._send(200, nhl_research.league())
                    if resource == "similar" and opponent:
                        position, market = arg("position").upper(), arg("market")
                        if position not in {"C", "LW", "RW", "D", "G", "L", "R"} or not (market.replace("_", "").isalnum() and market.islower() and len(market) <= 24):
                            return self._send(400, {"error": "Unknown position or stat."})
                        return self._send(200, nhl_research.similar(opponent, position, market))
                except nhl_research.Busy:
                    # The NHL is refusing for a moment; the page asks again then.
                    return self._send(503, {"error": "NHL data is temporarily unavailable.", "retryAfter": nhl_research.retry_after()})
                except Exception:
                    return self._send(502, {"error": "NHL data is temporarily unavailable."})
                return self._send(400, {"error": "Unknown NHL resource."})
            try:
                from nhl_board import board as nhl_board
                return self._send(200, nhl_board())
            except Exception:
                return self._send(502, {"error": "NHL lines are temporarily unavailable."})
        if view == "cfb":
            # The Finder's college football lines (cfb_board.py) and each
            # team's games (cfb_research.py); its admin switch is "CFB in
            # the Finder".
            from site_controls import finder_sport_allowed
            if not finder_sport_allowed(self.headers, "cfb"):
                return self._send(503, {"error": "This section is temporarily unavailable", "featureDisabled": True})
            qs = parse_qs(urlparse(self.path).query)
            arg = lambda name: (qs.get(name) or [""])[0].strip()
            resource = arg("resource")
            if resource:
                import cfb_research
                team, opponent = arg("team"), arg("opponent")
                try:
                    if resource == "find":
                        # A slip's pick whose game has started (so it's off
                        # the board): the player's ESPN id, team and photo.
                        who = arg("name")
                        if not who or len(who) > 60 or len(team) > 40:
                            return self._send(400, {"error": "A player name is required."})
                        return self._send(200, {"rows": cfb_research.find(who, team or None)})
                    if resource == "league":
                        # Every FBS team's defense vs position, rankings and
                        # standings (the player page's tabs, the slip's matchup).
                        season = arg("season")
                        if season and not (season.isdigit() and 2015 <= int(season) <= 2100):
                            return self._send(400, {"error": "Unknown season."})
                        return self._send(200, cfb_research.league(int(season) if season else None))
                    if resource == "matchup":
                        event = arg("event")
                        if not cfb_research.valid_id(event):
                            return self._send(400, {"error": "Unknown game."})
                        return self._send(200, cfb_research.matchup(event))
                    if resource == "similar":
                        position, market, season = arg("position").upper(), arg("market"), arg("season")
                        if position not in cfb_research.DVP_POSITIONS or not (market.replace("_", "").isalnum() and market.islower() and len(market) <= 32) \
                                or not (opponent and len(opponent) <= 10 and opponent.replace("&", "").isalnum()) or (season and not season.isdigit()):
                            return self._send(400, {"error": "Unknown position, stat or team."})
                        return self._send(200, cfb_research.similar(opponent.upper(), position, market, int(season) if season else None))
                    if resource == "team":
                        event = arg("event")
                        if not cfb_research.valid_id(team) or (event and not cfb_research.valid_id(event)):
                            return self._send(400, {"error": "Unknown team."})
                        return self._send(200, cfb_research.team_context(team, event or None))
                    if resource == "log":
                        if not cfb_research.valid_id(team) or (opponent and not cfb_research.valid_id(opponent)):
                            return self._send(400, {"error": "Unknown team."})
                        from finder_history_store import remember
                        return self._send(200, remember('cfb', f'cfb:{team}:{opponent}', cfb_research.team_log(team, opponent or None),
                                                        {'team': team, 'opponent': opponent}))
                except Exception:
                    return self._send(502, {"error": "College football data is temporarily unavailable."})
                return self._send(400, {"error": "Unknown college football resource."})
            try:
                from cfb_board import board as cfb_board
                return self._send(200, cfb_board())
            except Exception:
                return self._send(502, {"error": "College football lines are temporarily unavailable."})
        if view == "moves":
            # The Line Moves page (line_moves.py): its own admin switch, and
            # only the leagues this viewer may see in the Finder. While it is
            # open it also keeps PrizePicks' feeds checked.
            import line_moves
            from site_controls import finder_sports_allowed
            sports = [sport for sport in finder_sports_allowed(self.headers) if sport in line_moves.SPORTS]
            line_moves.safely(line_moves.keep_fresh, sports)
            try:
                return self._send(200, {**line_moves.recent(sports), "sports": sports})
            except Exception:
                return self._send(502, {"error": "Line moves are temporarily unavailable."})
        if view == "moneylines":
            # The moneyline board (moneyline_model.py): one league's games
            # priced, or the record of every play.
            import moneyline_model
            qs = parse_qs(urlparse(self.path).query)
            try:
                if (qs.get("resource") or [""])[0] == "record":
                    return self._send(200, moneyline_model.record())
                sport = (qs.get("sport") or ["nfl"])[0].lower()
                if sport not in moneyline_model.SPORTS:
                    return self._send(400, {"error": "Unknown league."})
                return self._send(200, {**moneyline_model.board(sport), "leagues": moneyline_model.leagues()})
            except RuntimeError as exc:
                return self._send(503, {"error": str(exc)})
            except Exception:
                return self._send(502, {"error": "Moneylines are temporarily unavailable."})
        if view == "mlb-matchups":
            try:
                import mlb_prop_matchups
                return self._send(200, mlb_prop_matchups.slate_matchups((parse_qs(urlparse(self.path).query).get("day") or ["today"])[0]), compress=True)
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            except Exception:
                return self._send(502, {"error": "Matchups are temporarily unavailable."})
        if view == "nfl-sheet":
            # An NFL Cheat Sheet for this week (nfl_sheets.py). Each sheet has
            # its own admin switch.
            qs = parse_qs(urlparse(self.path).query)
            name = (qs.get("sheet") or [""])[0]
            from site_controls import sheet_allowed
            if not sheet_allowed(self.headers, f"nfl:{name}"):
                return self._send(503, {"error": "This sheet is switched off right now.", "featureDisabled": True})
            try:
                import nfl_sheets
                return self._send(200, nfl_sheets.sheet(name), compress=True)
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            except Exception:
                return self._send(502, {"error": "This sheet is unavailable right now."})
        if view == "mlb-sheet":
            # A Cheat Sheet for a day (mlb_sheets.py): built once, kept a while.
            qs = parse_qs(urlparse(self.path).query)
            try:
                import mlb_sheets
                return self._send(200, mlb_sheets.sheet((qs.get("sheet") or [""])[0], (qs.get("day") or ["today"])[0]), compress=True)
            except ValueError as exc:
                return self._send(400, {"error": str(exc)})
            except Exception:
                return self._send(502, {"error": "This sheet is temporarily unavailable."})
        if view == "mlb-context":
            # Today's probable starters and every team's season rates, for
            # the Smart Slip's matchup read (mlb_context.py).
            try:
                import mlb_context
                return self._send(200, mlb_context.context())
            except Exception:
                return self._send(502, {"error": "MLB matchups are temporarily unavailable."})
        if view == "prop-history":
            qs = parse_qs(urlparse(self.path).query)
            try:
                from finder_history_store import remember, name_key
                player = (qs.get("player") or [""])[0]
                group = (qs.get("group") or ["pitching"])[0]
                innings = (qs.get("innings") or [""])[0] == "1"
                key = f'{name_key(player)}|{group}'+('|innings' if innings else '')
                return self._send(200, remember('mlb', key, player_history(player, group, first_inning_stats=innings), {'player':player,'group':group,'innings':innings}))
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
                        from mlb_book_lines import attach, lines as book_lines
                        quotes = book_lines()
                        rows = attach(rows, quotes)
                        # Each book's main lines, for the Line Moves page.
                        import line_moves
                        line_moves.safely(line_moves.observe_books, "mlb", quotes)
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
            return self._send(200, {"generated_at": data.get("generated_at"), "nrfi": data.get("nrfi", [])})

        raw = store.get(BOT_BOARD_KEY)
        if not raw:
            return self._send(200, {"date": None, "generated_at": None, "props": []})
        try:
            data = json.loads(raw)
            data["games"] = _schedule_games(data.get("date")) if data.get("date") else []
            return self._send(200, data)
        except json.JSONDecodeError:
            return self._send(200, {"date": None, "generated_at": None, "props": []})

    def _send(self, status, body, compress=False):
        if compress:
            from cs2_board import response_bytes
            raw, encoding = response_bytes(body, self.headers.get('Accept-Encoding', ''))
        else:
            raw, encoding = json.dumps(body).encode('utf-8'), None
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if compress:
            self.send_header('Vary', 'Accept-Encoding')
        if encoding:
            self.send_header('Content-Encoding', encoding)
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
