"""Single NFL data handler, keeping the Vercel deployment under its function cap."""
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from auth_core import session_with_live_access
from backend.sports.nfl.api import response_payload, send_json
from backend.sports.nfl.services import nflverse


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not session_with_live_access(self.headers):
            return send_json(self, 401, {"error": "Sign in to use NFL data.", "authRequired": True})
        query = parse_qs(urlparse(self.path).query)
        resource = query.get("resource", [""])[0].strip().lower()
        if not resource:
            path_parts = [part for part in urlparse(self.path).path.split("/") if part]
            resource = path_parts[-1].lower() if len(path_parts) > 2 else ""
        try:
            season = int(query.get("season", [""])[0])
            week = int(query["week"][0]) if query.get("week") else None
        except ValueError:
            return send_json(self, 400, {"error": "Season and week must be numeric."})
        if not 1999 <= season <= 2100:
            return send_json(self, 400, {"error": "A valid NFL season is required."})
        if week is not None and not 1 <= week <= 22:
            return send_json(self, 400, {"error": "Week must be between 1 and 22."})

        season_type = query.get("seasonType", ["REG"])[0].upper()
        team = query.get("team", [""])[0].strip()
        player_id = query.get("playerId", [""])[0].strip()
        if season_type not in nflverse.VALID_GAME_TYPES:
            return send_json(self, 400, {"error": "Unknown NFL season type."})

        if resource == "teams":
            result = nflverse.teams(season)
        elif resource == "players":
            result = nflverse.players(season)
        elif resource == "schedule":
            result = nflverse.schedule(season, week, season_type if query.get("seasonType") else None)
        elif resource == "game-logs":
            if not player_id:
                return send_json(self, 400, {"error": "A stable GSIS playerId is required."})
            result = nflverse.game_logs(season, player_id, season_type)
        elif resource == "injuries":
            result = nflverse.injuries(season, week)
            if team and result.data is not None:
                canonical = nflverse.canonical_team(team)
                result = type(result)(result.status, [row for row in result.data if row.team_id == canonical],
                                      result.source, result.fetched_at, result.observed_at, result.reason)
        elif resource == "depth-chart":
            result = nflverse.depth_chart(season, team or None)
        elif resource == "team-stats":
            if not team:
                return send_json(self, 400, {"error": "A team abbreviation is required."})
            result = nflverse.team_game_stats(season, team, season_type)
        elif resource == "defense":
            if not team:
                return send_json(self, 400, {"error": "A team abbreviation is required."})
            result = nflverse.defense_game_stats(season, team, season_type)
        elif resource == "usage":
            if not player_id:
                return send_json(self, 400, {"error": "A stable GSIS playerId is required."})
            result = nflverse.provider.player_usage(player_id=player_id, season=season)
        else:
            return send_json(self, 404, {"error": "Unknown NFL data resource."})

        payload = response_payload(result)
        payload["sourceVersion"] = nflverse.SOURCE_VERSION
        send_json(self, 200 if result.data is not None else 503, payload)
