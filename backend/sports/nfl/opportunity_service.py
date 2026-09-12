"""Isolated provider orchestration; no per-player network waterfall."""
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from datetime import datetime, timezone
from .services import nflverse as source
from .services.play_by_play import season_summary
from .opportunity import team_volume, player_opportunity
from .allocation import allocate, absence_scenario
from .cache import NFLCacheDomain, cached_nfl

VERSION='opportunity-v3'

def _optional_pbp(season):
    try:
        return season_summary(season),None
    except (OSError,ValueError,RuntimeError,EOFError) as exc:
        return None,str(exc)

def opportunity(season, player_id, week):
    if not player_id or week is None:
        return {'status':'NOT_AVAILABLE','reason':'Resolved player and forecast week required'}
    return cached_nfl(NFLCacheDomain.OPPORTUNITY,(VERSION,season,week,player_id),lambda:_load(season,player_id,week))

def _load(season, player_id, week):
    roster=source.players(season)
    player=next((p for p in roster.data or [] if p.id==player_id),None)
    if player is None or not player.team_id:
        return {'status':'NOT_AVAILABLE','reason':'Unresolved player identity or team'}
    games=source.schedule(season,week,'REG')
    game=next((g for g in games.data or [] if player.team_id in (g.home_team.id,g.away_team.id)),None)
    if not game:
        return {'status':'NOT_AVAILABLE','reason':'No scheduled matchup'}
    opponent=game.away_team.id if game.home_team.id==player.team_id else game.home_team.id
    with ThreadPoolExecutor(max_workers=4) as executor:
        pbp_future=executor.submit(_optional_pbp,season)
        logs_future=executor.submit(source._source_rows,f'{source.RELEASE}/stats_player/stats_player_week_{season}.csv')
        injuries_future=executor.submit(source.injuries,season,week)
        snaps_future=executor.submit(source.snap_counts,season)
        pbp,pbp_error=pbp_future.result()
        raw_players,logs_fetched,logs_observed=logs_future.result()
        injuries=injuries_future.result()
        snaps=snaps_future.result()
    if pbp:
        team_rows=[r for r in pbp['teams'] if r['team_id']==player.team_id]
        allowed=[r for r in pbp['teams'] if r['opponent_team_id']==opponent]
    else:
        team=source.team_game_stats(season,player.team_id)
        team_rows=[asdict(r) for r in team.data or []]
        allowed=[]
    if not any(r['week']<week for r in team_rows):
        return {'status':'NOT_AVAILABLE','reason':'No earlier same-season team volume'}
    volume=team_volume(team_rows,allowed,week)
    by_player=defaultdict(list)
    pbp_by_player={(r['game_id'],r['player_id']):r for r in pbp['players']} if pbp else {}
    for row in raw_players:
        if row.get('season_type')!='REG' or source.canonical_team(row.get('team'))!=player.team_id:
            continue
        row_week=source._integer(row,'week',required=True)
        if row_week>=week:
            continue
        pid=row.get('player_id')
        stats={k:source._number(row,k) for k in ('targets','carries','attempts')}
        extra=pbp_by_player.get((row.get('game_id'),pid),{}).get('stats',{})
        stats.update({k:extra.get(k) for k in ('dropbacks','scrambles','kneels','non_scramble_rushes','sacks_suffered')})
        by_player[pid].append({'game_id':row.get('game_id'),'week':row_week,'team_id':player.team_id,'stats':stats})
    injury_map={i.player_id:str(i.game_status or '').upper() for i in injuries.data or []}
    injury_known=bool(injuries.data) and all(i.season==season and i.week==week for i in injuries.data)
    depth=source.depth_chart(season,player.team_id,latest_only=False)
    now=datetime.now(timezone.utc)
    depth_rows=[d for d in depth.data or [] if d.updated_at<=min(now,game.starts_at)]
    latest=max((d.updated_at for d in depth_rows),default=None)
    starters=[d.player_id for d in depth_rows if d.updated_at==latest and d.position=='QB' and d.rank==1 and 0<=(now-d.updated_at).total_seconds()<48*3600]
    starting_qb=starters[0] if len(set(starters))==1 else None
    profiles={}; conditional={}; logs_for_absence={}
    all_games=source.schedule(season,season_type='REG')
    for member in roster.data or []:
        if member.team_id!=player.team_id:
            continue
        usage=[r for r in snaps.data or [] if r['pfr_player_id']==member.source_ids.get('pfr_id')]
        logs=by_player[member.id]
        logs_for_absence[member.id]=logs
        events=[]
        snapshots=sorted([d for d in depth_rows if d.player_id==member.id and d.position==member.position],key=lambda d:d.updated_at)
        for previous,current in zip(snapshots,snapshots[1:]):
            if previous.rank==current.rank:
                continue
            affected=[g for g in all_games.data or [] if member.team_id in (g.home_team.id,g.away_team.id) and g.starts_at>=current.updated_at and g.week<=week]
            if affected:
                event_week=min(g.week for g in affected)
                events.append({'kind':'DEPTH_RANK_CHANGE','week':event_week,'verified':True,'direction':'INCREASING' if current.rank<previous.rank else 'DECREASING',
                               'previousRank':previous.rank,'rank':current.rank,'observedAt':current.updated_at.isoformat()})
        base=player_opportunity(asdict(member),logs,team_rows,volume,week,usage=usage,role_events=events)
        injury=injury_map.get(member.id)
        if str(member.status or '').upper() in ('IR','RES','INA','INACTIVE') and not injury:
            injury='UNCERTAIN_ROSTER'
        if member.position=='QB' and starting_qb and starting_qb!=member.id:
            base.update(status='NOT_AVAILABLE',reason='Not the current listed starting QB')
            for m in base['metrics'].values():
                m.update(mean=None,status='NOT_AVAILABLE')
        if not starting_qb or not injury_known or not injury:
            if base['status']=='AVAILABLE':
                base['status']='LOW_CONFIDENCE'
        base['injuryCertainty']='REPORTED' if injury else 'UNKNOWN'
        base['startingQBCertainty']='LISTED' if starting_qb else 'UNKNOWN'
        conditional[member.id]=base
        profiles[member.id]={'status':'NOT_AVAILABLE','roleStatus':'UNCERTAIN','metrics':{},'reason':f'{injury}: active/out scenarios require confirmation','sampleReliability':base.get('sampleReliability','LOW')} if injury else base
    profiles,allocation=allocate(profiles,volume)
    conditional,_=allocate(conditional,volume)
    selected=profiles[player_id]
    scenarios=[]
    if player_id in injury_map or selected.get('reason','').startswith('UNCERTAIN_ROSTER'):
        scenarios=[{'condition':'Player active with observed role','probability':None,'status':'LOW_CONFIDENCE','player':conditional[player_id]},
                   {'condition':'Player inactive','probability':None,'status':'NOT_APPLICABLE','player':{'metrics':{}}}]
    verified_absences={}
    for member in roster.data or []:
        if member.team_id==player.team_id and member.source_ids.get('pfr_id'):
            verified_absences[member.id]=[r['game_id'] for r in snaps.data or [] if r['pfr_player_id']==member.source_ids['pfr_id'] and r.get('offense_snaps')==0 and r['week']<week and r['team_id']==player.team_id]
    outs={pid for pid,status in injury_map.items() if status=='OUT' and pid in conditional}
    vacated=absence_scenario(conditional,outs,logs_for_absence,team_rows,volume,week,verified_absences) if outs else {'status':'NOT_APPLICABLE','reason':'No verified inactive teammate scenario'}
    if vacated.get('players'):
        selected=vacated['players'].get(player_id,selected)
        selected['status']='LOW_CONFIDENCE'
        allocation=vacated['allocation']
    uncertain=[pid for pid,status in injury_map.items() if status in ('QUESTIONABLE','DOUBTFUL') and pid in conditional and pid!=player_id]
    for pid in uncertain[:4]:
        inactive=absence_scenario(conditional,{pid},logs_for_absence,team_rows,volume,week,verified_absences)
        scenarios.append({'condition':f'Teammate {pid} inactive','probability':None,'status':inactive['status'],
                          'player':inactive['players'].get(player_id) if inactive.get('players') else None,'reason':inactive.get('reason')})
    if uncertain and selected['status']=='AVAILABLE':
        selected['status']='LOW_CONFIDENCE'
    coverage=selected.get('dataCoverage',0)
    return {'status':selected['status'],'team':volume,'player':selected,'allocation':allocation,'scenarios':scenarios,'vacatedOpportunity':vacated,'startingQB':starting_qb,
            'health':{'opportunityData':'STRONG' if volume['dataCoverage']==100 and coverage>=50 else 'PARTIAL','roleCertainty':selected.get('roleStability','LOW'),
                      'volumeCertainty':volume['volumeCertainty'],'sampleReliability':selected.get('sampleReliability','LOW'),'injuryCertainty':'PARTIAL_REPORTS' if injury_known else 'UNKNOWN'},
            'source':'nflverse','fetchedAt':logs_fetched.isoformat(),'observedAt':logs_observed.isoformat() if logs_observed else None,
            'sources':{'playByPlay':{'status':'AVAILABLE' if pbp else 'NOT_AVAILABLE','reason':pbp_error,'fetchedAt':pbp.get('fetchedAt') if pbp else None},
                       'snaps':{'status':snaps.status.value,'reason':snaps.reason},'injuries':{'status':injuries.status.value,'reason':injuries.reason}},
            'modelVersion':VERSION,'limitations':['No routes provider; snaps do not imply routes','Script weights are historical exposure, not future scenario probabilities',
            'Historical verified injury absences unavailable; no blind redistribution','Non-scramble QB rushes are a designed-opportunity proxy, not charted design']}
