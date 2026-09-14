"""The Phase 5 API consumes Phase 4; no MLB or opportunity logic is changed."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from .services import nflverse
from .services.matchup_data import season_data
from .opportunity_service import opportunity
from .matchup import build_matchup
from .props import props_for_position
from .cache import NFLCacheDomain,cached_nfl
from .api import _json_value
from .history_inputs import compact_history

def matchup(season,player_id,week,prop):
    return cached_nfl(NFLCacheDomain.MATCHUP,('nfl-matchup-v4-context',season,week,player_id,prop),lambda:_load(season,player_id,week,prop))

def _load(season,player_id,week,prop):
    roster=nflverse.players(season)
    player=next((p for p in roster.data or [] if p.id==player_id),None)
    if not player or not player.team_id:
        return {'status':'NOT_AVAILABLE','reason':'Unresolved player/team identity'}
    if prop not in [p.key.value for p in props_for_position(player.position)]:
        raise ValueError('Prop is incompatible with player position')
    schedule=nflverse.schedule(season,week,'REG')
    game=next((g for g in schedule.data or [] if player.team_id in (g.home_team.id,g.away_team.id)),None)
    if not game:
        return {'status':'NOT_AVAILABLE','reason':'No scheduled matchup'}
    opponent=game.away_team.id if game.home_team.id==player.team_id else game.home_team.id
    with ThreadPoolExecutor(max_workers=3) as executor:
        raw=executor.submit(compact_history,season_data,season,week,('games','players','connections')) if week<=4 else executor.submit(season_data,season)
        volume=executor.submit(opportunity,season,player_id,week)
        injuries=executor.submit(nflverse.injuries,season,week)
        data=raw.result();opp=volume.result();reports=injuries.result()
    if not data:return {'status':'NOT_AVAILABLE','reason':'Validated current/prior defensive data unavailable'}
    impacts={'CB':['coverageFit','alignmentFit'],'S':['coverageFit','explosiveFit'],'FS':['coverageFit','explosiveFit'],'SS':['coverageFit','explosiveFit'],
             'LB':['coverageFit','runSchemeFit'],'ILB':['coverageFit','runSchemeFit'],'OLB':['trenchFit','runSchemeFit'],
             'DE':['trenchFit','pressureInteraction','runSchemeFit'],'EDGE':['trenchFit','pressureInteraction'],'DT':['trenchFit','runSchemeFit'],
             'T':['trenchFit'],'OT':['trenchFit'],'G':['trenchFit'],'OG':['trenchFit'],'C':['trenchFit'],'OL':['trenchFit'],
             'QB':['pressureInteraction','yacFit'],'WR':['opportunity'],'TE':['opportunity','trenchFit'],'RB':['opportunity','trenchFit']}
    relevant=[{**asdict(i),'affectedComponents':impacts.get(i.position,[])} for i in reports.data or [] if i.team_id in (player.team_id,opponent)]
    personnel={'status':reports.status.value,'reports':_json_value(relevant),'reason':'Reports affect named component context only; no score points or presumed shadow defender'}
    environment={'roof':game.roof,'venue':game.venue,'forecastStatus':'NOT_AVAILABLE','reason':'Schedule weather is not a timestamped forecast; no weather adjustment'}
    result=build_matchup(data,asdict(player),opponent,prop,week,opp,environment,personnel)
    from .matchup_volume_context import opponent_volume
    result['opponentVolume'] = opponent_volume(data,asdict(player),opponent,prop,week,{p.id for p in roster.data or [] if p.position == 'QB'})
    from .position_defense import position_defense_context
    result['positionDefense'] = position_defense_context(data,{p.id:p for p in roster.data or []},opponent,player.position,week)
    if data.get('history',{}).get('usesPriorSeason'):
        result.update(history=data['history'],modelVersion='NFL_MATCHUP_V3_EARLY_SEASON',status='LOW_CONFIDENCE')
    result.update(source='nflverse',sourceUrl=data['sourceUrl'],fetchedAt=data['fetchedAt'],observedAt=data.get('observedAt'))
    return result
