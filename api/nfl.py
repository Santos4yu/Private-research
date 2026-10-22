"""Single NFL data handler, keeping the Vercel deployment under its function cap."""
import re
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from auth_core import session_with_live_access
from backend.sports.nfl.api import response_payload, send_json
from backend.sports.nfl.cache import NFLCacheDomain, cached_nfl
from backend.sports.nfl.services import nflverse

# Every resource below is a pure, read-only projection of one of nflverse's
# season-wide CSVs, so its whole response can be cached durably -- and it
# very much needs to be.
#
# cached_nfl's Upstash L2 exists precisely because a Vercel function
# cold-starts constantly, but it has never actually held ANY nflverse data:
# every loader in services/nflverse.py returns
# (list[dataclass], datetime, datetime | None), and cache._kv_set silently
# drops any value json.dumps rejects. So the durable cache was a no-op for
# teams, players, schedule, game-logs, usage, defense, injuries, depth
# charts AND the shared raw-CSV cache underneath them. Every cold instance
# re-downloaded ~9MB of stats_player_week and re-parsed ~19k rows just to
# project one player's 8KB of game logs -- twice over, since the research
# screen asks for the current AND previous season.
#
# Caching the FINISHED payload instead fixes that with a value that
# round-trips by construction (it is already the JSON we send), and it is
# small: 8KB for a player's game logs, 4KB for usage, 6KB for defense,
# 444KB for the full season roster. The TTL comes from the matching cache
# domain, so nothing is served staler than it would have been anyway.
RESPONSE_VERSION = 'nfl-response-v3'
RESPONSE_DOMAINS = {
    'teams': NFLCacheDomain.TEAMS,
    'players': NFLCacheDomain.PLAYERS,
    'schedule': NFLCacheDomain.SCHEDULE,
    'game-logs': NFLCacheDomain.GAME_LOGS,
    'reception-logs': NFLCacheDomain.GAME_LOGS,
    'injuries': NFLCacheDomain.INJURIES,
    'depth-chart': NFLCacheDomain.DEPTH_CHARTS,
    'team-stats': NFLCacheDomain.STATS,
    'defense': NFLCacheDomain.DEFENSE,
    'usage': NFLCacheDomain.USAGE,
}


class SourceUnavailable(RuntimeError):
    """Raised instead of returning, so a failed provider read is never
    written to either cache layer -- a 30-minute cached outage would be far
    worse than re-asking the provider on the next request."""

    def __init__(self, payload):
        super().__init__('nfl source unavailable')
        self.payload = payload


def _source_result(resource, season, week, season_type, team, player_id, season_type_given):
    if resource == 'teams':
        return nflverse.teams(season)
    if resource == 'players':
        return nflverse.players(season)
    if resource == 'schedule':
        return nflverse.schedule(season, week, season_type if season_type_given else None)
    if resource == 'game-logs':
        return nflverse.game_logs(season, player_id, season_type)
    if resource == 'reception-logs':
        from backend.sports.nfl.services.research_stats import reception_logs
        return reception_logs(season, player_id)
    if resource == 'injuries':
        result = nflverse.injuries(season, week)
        if team and result.data is not None:
            canonical = nflverse.canonical_team(team)
            result = type(result)(result.status, [row for row in result.data if row.team_id == canonical],
                                  result.source, result.fetched_at, result.observed_at, result.reason)
        return result
    if resource == 'depth-chart':
        return nflverse.depth_chart(season, team or None)
    if resource == 'team-stats':
        return nflverse.team_game_stats(season, team, season_type)
    if resource == 'defense':
        return nflverse.defense_game_stats(season, team, season_type)
    if resource == 'usage':
        return nflverse.provider.player_usage(player_id=player_id, season=season)
    return None


def _source_payload(resource, season, week, season_type, team, player_id, season_type_given):
    result = _source_result(resource, season, week, season_type, team, player_id, season_type_given)
    payload = response_payload(result)
    if resource in ('injuries', 'depth-chart') and payload.get('data'):
        photos = nflverse.roster_headshots(season)
        payload['data'] = [{**row, 'headshot_url': photos.get(row.get('player_id'))} for row in payload['data']]
    payload['sourceVersion'] = nflverse.SOURCE_VERSION
    if result.data is None:
        raise SourceUnavailable(payload)
    return payload


# The Finder's NFL player page (backend/sports/nfl/finder.py).
FINDER_RESOURCES = ('finder-board', 'finder-find', 'finder-log', 'finder-pbp', 'finder-league', 'finder-team', 'finder-matchup', 'finder-player',
                    'finder-scout', 'finder-weather', 'finder-qb-rush', 'finder-plays')
PLAYER_ID = re.compile(r'^\d{2}-\d{7}$')
TEAM = re.compile(r'^[A-Z]{2,3}$')
GAME_ID = re.compile(r'^\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}$')


class handler(BaseHTTPRequestHandler):
    def _finder(self, resource, query, season):
        from backend.sports.nfl import finder
        arg = lambda name: (query.get(name) or [''])[0].strip()
        player_id, team, opponent, game_id = arg('playerId'), arg('team').upper(), arg('opponent').upper(), arg('gameId')
        if resource in ('finder-log', 'finder-pbp', 'finder-player', 'finder-qb-rush', 'finder-plays') and not PLAYER_ID.match(player_id):
            return send_json(self, 400, {'error': 'A verified NFL player is required.'})
        if resource in ('finder-team', 'finder-player') and not TEAM.match(team):
            return send_json(self, 400, {'error': 'A team abbreviation is required.'})
        try:
            if resource == 'finder-board':
                # Every line PrizePicks posts, with hit rates from nflverse
                # (backend/sports/nfl/prizepicks_board.py).
                from backend.sports.nfl.prizepicks_board import board
                payload = board(season)
                return send_json(self, 200, {**payload, 'data': payload['rows']})
            if resource == 'finder-find':
                # A slip's pick whose player isn't on the board (his game
                # has started): who he is and his games at the slip's line.
                from backend.sports.nfl.prizepicks_board import lookup
                name = arg('name')
                if not name or len(name) > 60 or (team and not TEAM.match(team)):
                    return send_json(self, 400, {'error': 'A player name is required.'})
                row = lookup(season, name, team or None, arg('stat')[:60] or None, arg('line') or None)
                return send_json(self, 200, {'rows': [row] if row else [], 'events': [row['event']] if row and row.get('event') else []})
            if resource == 'finder-log':
                return send_json(self, 200, finder.player_log(season, player_id))
            if resource == 'finder-pbp':
                return send_json(self, 200, finder.pbp_resource(season, player_id))
            if resource == 'finder-league':
                return send_json(self, 200, finder.league(season))
            if resource == 'finder-scout':
                # This week's scouting notes for every player (nfl_scouting.py):
                # blitz, pressure, boxes, run defense, splits and usage.
                import nfl_scouting
                return send_json(self, 200, nfl_scouting.report(season))
            if resource == 'finder-qb-rush':
                # A quarterback's scrambles, designed runs and kneel-downs, and
                # what this defense gives quarterbacks (nfl_scouting.py).
                if not TEAM.match(opponent):
                    return send_json(self, 400, {'error': 'An opponent is required.'})
                import nfl_scouting
                week = nfl_scouting.week_of(game_id) if GAME_ID.match(game_id) else None
                return send_json(self, 200, nfl_scouting.qb_rush(season, player_id, opponent, week))
            if resource == 'finder-plays':
                # How the matchup plays (box count, direction, depth, coverage),
                # his metrics ranked at his position, and who at his position
                # has faced the opponent (nfl_plays.py). This season or last.
                import nfl_plays
                if opponent and not TEAM.match(opponent):
                    return send_json(self, 400, {'error': 'A valid opponent is required.'})
                # A browser's season turns over on its own clock: a day's slack.
                if not nfl_plays.season_now() - 2 <= season <= nfl_plays.season_now():
                    return send_json(self, 400, {'error': 'Only this season and last are kept.'})
                return send_json(self, 200, nfl_plays.for_player(season, player_id, opponent or None))
            if resource == 'finder-weather':
                # Kickoff weather for the week's games (football_weather.py).
                import football_weather
                return send_json(self, 200, football_weather.nfl_slate(season))
            if resource == 'finder-team':
                return send_json(self, 200, finder.team_context(season, team))
            if resource == 'finder-matchup':
                if not GAME_ID.match(game_id):
                    return send_json(self, 400, {'error': 'A verified NFL game is required.'})
                return send_json(self, 200, finder.matchup(season, game_id))
            market = arg('market')
            from backend.sports.nfl import markets
            if not TEAM.match(opponent) or market not in markets.LABELS:
                return send_json(self, 400, {'error': 'Opponent and a supported market are required.'})
            try:
                line = float(arg('line')) if arg('line') else None
            except ValueError:
                return send_json(self, 400, {'error': 'The line must be a number.'})
            return send_json(self, 200, finder.player_context(season, player_id, team, opponent, market, line))
        except ValueError:
            return send_json(self, 404, {'error': 'That NFL game is not on the schedule.'})
        except Exception:  # noqa: BLE001 -- provider outage; never a stack trace
            return send_json(self, 503, {'error': 'NFL research is temporarily unavailable. Try again shortly.'})

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
        from site_controls import allowed as feature_allowed, finder_sport_allowed
        if resource in FINDER_RESOURCES:
            # The Finder's NFL player page answers to the Finder's own NFL
            # switch, like api/wnba.py, not to Research's.
            if not finder_sport_allowed(self.headers, 'nfl'):
                return send_json(self, 503, {'error': 'This section is temporarily unavailable', 'featureDisabled': True})
        else:
            tab='v2' if resource in ('research-board','value-board') else 'research'
            if not feature_allowed(self.headers,tab,sport='nfl'):return send_json(self,503,{'error':'This section is temporarily unavailable','featureDisabled':True})
        allowed = {'players','teams','schedule','game-logs','usage','defense','injuries','depth-chart','team-stats','opportunity','matchup','projection','distribution','decision','value-board','model-health','props','prop-games','game-lines','reception-logs','research-board','board', *FINDER_RESOURCES}
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

        if resource in FINDER_RESOURCES:
            return self._finder(resource, query, season)

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

        if resource == 'game-lines':
            game_id=query.get('gameId',[''])[0].strip()
            if not game_id:return send_json(self,400,{'error':'A verified NFL game is required.'})
            from backend.sports.nfl.services import odds
            try:return send_json(self,200,odds.game_lines(season,game_id))
            except (RuntimeError,ValueError):return send_json(self,503,{'error':'Verified NFL game lines are temporarily unavailable.'})

        if resource == 'board':
            # The prebuilt slate, exactly like api/v2-board.py does for MLB:
            # read what the last build wrote and return it. Never scans, so
            # opening the props tab costs nothing and waits for nothing.
            from backend.sports.nfl.board_snapshot import ensure_board
            try:
                snapshot, reason = ensure_board(season)
            except Exception as exc:  # noqa: BLE001 -- fall back to the live scan
                snapshot, reason = None, f'{type(exc).__name__}: {exc}'
            if not snapshot:
                # Nothing stored and nothing built. Say why: the client falls
                # back to scanning live either way, but an invisible failure
                # here looks identical to "slow" and is untraceable.
                return send_json(self, 200, {'data': [], 'builtAt': None, 'events': [],
                                             'pending': True, 'reason': reason})
            return send_json(self, 200, {**snapshot, 'data': snapshot.get('rows', []), 'reason': reason})

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
        domain = RESPONSE_DOMAINS.get(resource)
        if domain is None:
            return send_json(self, 404, {"error": "Unknown NFL data resource."})
        # Argument checks stay OUT of the cached loader: they are free, and a
        # rejection must never occupy a cache slot.
        if resource in ('game-logs', 'usage') and not player_id:
            return send_json(self, 400, {"error": "A stable GSIS playerId is required."})
        if resource == 'reception-logs' and (not player_id or season_type != 'REG'):
            return send_json(self, 400, {'error': 'Regular-season playerId required.'})
        if resource in ('team-stats', 'defense') and not team:
            return send_json(self, 400, {"error": "A team abbreviation is required."})

        season_type_given = bool(query.get("seasonType"))
        parts = (RESPONSE_VERSION, resource, season, season_type, season_type_given,
                 week if week is not None else 'all',
                 nflverse.canonical_team(team) or 'all', player_id or 'all')
        try:
            payload = cached_nfl(domain, parts, lambda: _source_payload(
                resource, season, week, season_type, team, player_id, season_type_given))
        except SourceUnavailable as unavailable:
            return send_json(self, 503, unavailable.payload)
        send_json(self, 200, payload)
