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
        from backend.sports.nfl.request_guard import event
        try:
            return self._get()
        except Exception:
            event('request_failure', 'nfl')
            return send_json(self, 503, {'error': 'Data source temporarily unavailable.'})

    def _get(self):
        if not session_with_live_access(self.headers):
            return send_json(self, 401, {"error": "Sign in to use NFL data.", "authRequired": True})
        query = parse_qs(urlparse(self.path).query)
        resource = query.get("resource", [""])[0].strip().lower()
        if not resource:
            path_parts = [part for part in urlparse(self.path).path.split("/") if part]
            resource = path_parts[-1].lower() if len(path_parts) > 2 else ""
        from site_controls import allowed as feature_allowed
        tab='v2' if resource in ('research-board','value-board') else 'research'
        if not feature_allowed(self.headers,tab):return send_json(self,503,{'error':'This section is temporarily unavailable','featureDisabled':True})
        allowed = {'players','teams','schedule','game-logs','usage','defense','injuries','depth-chart','team-stats','opportunity','matchup','projection','distribution','decision','value-board','model-health','props','prop-games','reception-logs','research-board'}
        if resource not in allowed:
            return send_json(self, 404, {'error': 'Unknown NFL resource.'})
        if len(self.path) > 2048 or any(len(value) > 120 for values in query.values() for value in values):
            return send_json(self, 400, {'error': 'NFL query is too long.'})
        from backend.sports.nfl.request_guard import allow
        if not allow(self.headers, resource):
            return send_json(self, 429, {'error': 'Too many NFL requests. Retry shortly.'})
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

        if resource in ('props','prop-games'):
            if season_type!='REG' or (resource=='props' and not player_id and not query.get('eventId')):
                return send_json(self,400,{'error':'Current NFL lines require regular season and a playerId or eventId.'})
            from backend.sports.nfl.services import odds
            try:
                result=odds.events(season) if resource=='prop-games' else odds.lines(season,player_id or None,week,query.get('eventId',[None])[0])
                return send_json(self,200, result)
            except ValueError:
                return send_json(self,400,{'error':'Unresolved NFL event/player or invalid line source.'})
            except RuntimeError:
                return send_json(self,503,{'error':'NFL line provider unavailable. Check quota and key in Settings.'})

        if resource == 'research-board':
            event_id=query.get('eventId',[''])[0]
            if not event_id:return send_json(self,400,{'error':'An NFL event is required.'})
            from backend.sports.nfl.research_board import game_board
            try:return send_json(self,200,game_board(season,event_id))
            except ValueError:return send_json(self,400,{'error':'Upcoming NFL event required.'})

        if resource == 'model-health':
            from v2.board.admin_auth import is_admin_request
            if not is_admin_request(self.headers):return send_json(self,403,{'error':'Admin access required.'})
            from backend.sports.nfl.production.audit import audit_models
            import os
            ledger_path=os.getenv('NFL_SHADOW_DB')
            if ledger_path and Path(ledger_path).is_file():
                from backend.sports.nfl.production.ledger import ShadowLedger
                from backend.sports.nfl.production.shadow import health_dashboard
                ledger=ShadowLedger(ledger_path)
                try:return send_json(self,200,{'data':health_dashboard(ledger)})
                finally:ledger.close()
            return send_json(self,200,{'data':audit_models()})
        if resource == 'value-board':
            from backend.sports.nfl.production.service import board
            return send_json(self,200,{'data':board()})
        if resource == 'decision':
            position=query.get('position',[''])[0].upper();prop=query.get('prop',[''])[0]
            if any(query.get(k) for k in ('line','side','probability','status')):
                return send_json(self,400,{'error':'Decision inputs must come from verified server providers.'})
            from backend.sports.nfl.production.service import decision
            try:return send_json(self,200,{'data':decision(position,prop,player_id)})
            except ValueError:return send_json(self,400,{'error':'Valid NFL position and prop required.'})
        if resource == 'distribution':
            prop=query.get('prop',[''])[0].strip()
            if not player_id or week is None or not prop or season_type!='REG' or any(query.get(k) for k in ('line','side','over','under')):
                return send_json(self,400,{'error':'Distribution requires regular season player/week/prop without market inputs.'})
            from backend.sports.nfl.distribution_service import distribution
            try:return send_json(self,200,{'data':distribution(season,player_id,week,prop)})
            except ValueError:return send_json(self,400,{'error':'Invalid NFL identity or prop.'})
            except (RuntimeError,OSError,EOFError):return send_json(self,503,{'error':'NFL distribution sources unavailable.'})
        if resource == 'projection':
            prop = query.get('prop', [''])[0].strip()
            if not player_id or week is None or not prop or season_type != 'REG':
                return send_json(self, 400, {'error': 'Projection requires playerId, week, prop and regular season.'})
            if any(query.get(k) for k in ('line','side','over','under')):
                return send_json(self, 400, {'error': 'Statistical projections do not accept market lines or sides.'})
            from backend.sports.nfl.projections.service import projection
            try:
                return send_json(self, 200, {'data': projection(season, player_id, week, prop)})
            except ValueError:
                return send_json(self, 400, {'error': 'Invalid NFL projection identity or prop.'})
            except (RuntimeError, OSError, EOFError):
                return send_json(self, 503, {'error': 'Projection sources unavailable; no statistic fabricated.'})
        if resource == 'matchup':
            prop = query.get('prop', [''])[0].strip()
            if not player_id or week is None or not prop or season_type != 'REG':
                return send_json(self, 400, {'error': 'Matchup requires playerId, week, prop and regular season.'})
            from backend.sports.nfl.matchup_service import matchup
            try:
                return send_json(self, 200, {'data': matchup(season, player_id, week, prop)})
            except ValueError:
                return send_json(self, 400, {'error': 'Invalid matchup identity or prop data.'})
            except (RuntimeError, OSError, EOFError):
                return send_json(self, 503, {'error': 'Matchup sources unavailable; no score fabricated.'})
        if resource == "opportunity":
            if not player_id or week is None:
                return send_json(self, 400, {"error": "Opportunity requires a stable playerId and forecast week."})
            if season_type != 'REG':
                return send_json(self, 400, {"error": "Opportunity currently supports regular-season games only."})
            from backend.sports.nfl.opportunity_service import opportunity
            try:
                return send_json(self, 200, {"data": opportunity(season, player_id, week)})
            except (ValueError, RuntimeError, OSError):
                return send_json(self, 503, {"error": "Opportunity inputs unavailable"})
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
        elif resource == 'reception-logs':
            if not player_id or season_type != 'REG':
                return send_json(self, 400, {'error': 'Regular-season playerId required.'})
            from backend.sports.nfl.services.research_stats import reception_logs
            result = reception_logs(season, player_id)
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
