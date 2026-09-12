"""NFL-only orchestration; model API has no market/side input."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from .dataset import weekly_logs
from .models import ProjectionContext,project,SUPPORTED,load_policy,model_key
from ..services import nflverse
from ..services.matchup_data import season_data
from ..matchup_profiles import profiles
from ..opportunity_service import opportunity
from ..cache import cached_nfl,NFLCacheDomain

def projection(season,player_id,week,prop):
    return cached_nfl(NFLCacheDomain.PROJECTIONS,('nfl-projection-v1',season,week,player_id,prop),lambda:_load(season,player_id,week,prop))

def _load(season,player_id,week,prop):
    player=next((p for p in nflverse.players(season).data or [] if p.id==player_id),None)
    if not player or not player.team_id:
        return {'status':'NOT_AVAILABLE','projectionMean':None,'reason':'Player/team unresolved'}
    from ..props import props_for_position
    if prop not in [p.key.value for p in props_for_position(player.position)]:
        raise ValueError('Incompatible prop')
    game=next((g for g in nflverse.schedule(season,week,'REG').data or [] if player.team_id in (g.home_team.id,g.away_team.id)),None)
    if not game:return {'status':'NOT_AVAILABLE','projectionMean':None,'reason':'No scheduled player game'}
    policy=load_policy()
    config=policy.get(model_key(player.position.value,prop),{})
    if prop not in SUPPORTED.get(player.position.value,()) or not config or config.get('promotion')=='DISABLED':
        return project(ProjectionContext(asdict(player),game.id,week,[],[],{}, {},season),prop,policy)
    opponent=game.away_team.id if game.home_team.id==player.team_id else game.home_team.id
    with ThreadPoolExecutor(max_workers=3) as pool:
        a=pool.submit(weekly_logs,season);b=pool.submit(opportunity,season,player_id,week);c=pool.submit(season_data,season)
        logs,volume=a.result(),b.result()
        try:pbp=c.result()
        except (OSError,RuntimeError,EOFError):pbp=None
    defense,reference=profiles(pbp['games'],week) if pbp else ({},{})
    profile=defense.get(opponent,{})
    latest=max(profile.get('sampleWeeks',[]),default=0)
    matchup={'defenseProfile':profile,'references':reference,'freshness':{'factor':1 if latest and week-latest<=2 else .5 if latest and week-latest<=3 else 0,
              'latestOpponentWeek':latest,'fetchedAt':pbp.get('fetchedAt') if pbp else None,'observedAt':pbp.get('observedAt') if pbp else None}}
    context=ProjectionContext(asdict(player),game.id,week,logs['logs'],logs['logs'],volume,matchup,season)
    output=project(context,prop,policy)
    output.update(source='nflverse',sourceUrl=logs['sourceUrl'],fetchedAt=logs['fetchedAt'],observedAt=logs['observedAt'],opportunityVersion=volume.get('modelVersion'),
                  matchupSourceAvailable=pbp is not None,opportunityFreshness=volume.get('fetchedAt'))
    return output
