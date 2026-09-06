"""
Vercel serverless function for the game-log modal's handedness/venue
filter chips (vs LHP / vs RHP / Home / Road).

Deliberately separate from api/prediction.py: resolving each game's
opposing starting pitcher's hand costs ~10 extra parallelized network
calls (~3s cold), which would undo the site's existing prediction-
latency work if it ran on every card load. Only called when a user
actually opens the game-log modal.
"""

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prediction_core import get_game_log_filters, PlayerNotFound, NoGameFound, STAT_LABEL_TO_PROP_TYPE, stats_mlb, vortex_research  # noqa: E402
from backend.vortextime import vortex_board_day  # noqa: E402
from auth_core import session_with_live_access  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in with Discord to use live research.", "authRequired": True})

        qs = parse_qs(urlparse(self.path).query)
        player_name = (qs.get("player", [""])[0]).strip()
        stat_label = (qs.get("stat", [""])[0]).strip()
        line_raw = qs.get("line", [None])[0]
        team_id = (qs.get("teamId", [""])[0]).strip()
        opponent = (qs.get("opponent", [""])[0]).strip()
        season = (qs.get("season", [""])[0]).strip()

        if not player_name or not stat_label or line_raw is None:
            return self._send(400, {"error": "Missing required params: player, stat, line"})

        try:
            line = float(line_raw)
        except (TypeError, ValueError):
            return self._send(400, {"error": f"Invalid line value: {line_raw!r}"})

        prop_type = STAT_LABEL_TO_PROP_TYPE.get(stat_label)
        if not prop_type:
            return self._send(400, {"error": f"Unknown stat: {stat_label!r}"})

        # Finder rows come straight from the live projection feed and may not
        # exist on the smaller recommended board. Resolve today's opponent on
        # demand so H2H still works for every active pitcher line.
        resolved_player_id = None
        if not team_id and not opponent:
            try:
                matches = vortex_research.fuzzy_search(player_name)
                resolved_player_id = matches[0]["id"] if matches else None
                own_team_id = stats_mlb.get_player_current_team(resolved_player_id) if resolved_player_id else None
                for game in stats_mlb.get_todays_schedule(vortex_board_day()).values():
                    if own_team_id == game.get("home_team_id"):
                        team_id = str(game.get("away_team_id") or "")
                        opponent = game.get("away_team_name") or ""
                        break
                    if own_team_id == game.get("away_team_id"):
                        team_id = str(game.get("home_team_id") or "")
                        opponent = game.get("home_team_name") or ""
                        break
            except Exception:
                pass

        try:
            result = get_game_log_filters(
                player_name, prop_type, line, team_id or None, opponent or None,
                season or None,
            )
            result.setdefault("meta", {})
            result["meta"].update({
                "player_id": result["meta"].get("player_id") or resolved_player_id,
                "opponent_team_id": int(team_id) if str(team_id).isdigit() else None,
                "opponent": opponent or None,
            })
        except PlayerNotFound as exc:
            return self._send(404, {"error": str(exc)})
        except NoGameFound as exc:
            return self._send(404, {"error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            return self._send(500, {"error": f"Game log filter lookup failed: {exc}"})

        return self._send(200, result)

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
