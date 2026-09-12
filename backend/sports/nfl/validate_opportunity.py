"""Rolling volume-only evaluation including historical roster reconciliation.

Only earlier logs build profiles. Outcome rows are used solely for error scoring.
End-season corrections are not point-in-time snapshots; disclose this limitation.
"""
import argparse
import json
from collections import defaultdict
from .services.nflverse import _source_rows, _number, RELEASE, canonical_team
from .services.play_by_play import season_summary
from .opportunity import team_volume, player_opportunity
from .allocation import allocate


def validate(season=2025):
    pbp=season_summary(season)
    rows=pbp['teams']
    players,_,_=_source_rows(f'{RELEASE}/stats_player/stats_player_week_{season}.csv')
    extra={(r['game_id'],r['player_id']):r['stats'] for r in pbp['players']}
    logs=[]
    for r in players:
        if r['season_type']!='REG' or r['position'] not in ('QB','RB','WR','TE'):
            continue
        stats={k:_number(r,k) for k in ('targets','carries','attempts')}
        stats.update({k:extra.get((r['game_id'],r['player_id']),{}).get(k) for k in ('dropbacks','scrambles','kneels','non_scramble_rushes','sacks_suffered')})
        logs.append({'id':r['player_id'],'position':r['position'],'team_id':canonical_team(r['team']),
                     'game_id':r['game_id'],'week':int(r['week']),'stats':stats})
    errors=defaultdict(list); baseline_errors=defaultdict(list); skipped=defaultdict(int)
    team_mapping={'expectedPlays':'offensive_plays','expectedDropbacks':'dropbacks','expectedRushAttempts':'carries','expectedTeamPassAttempts':'attempts','expectedDrives':'drives'}
    invariant_failures=0
    for actual in rows:
        if actual['week']<6:
            continue
        week=actual['week']; team=actual['team_id']
        own=[r for r in rows if r['team_id']==team and r['week']<week]
        allowed=[r for r in rows if r['opponent_team_id']==actual['opponent_team_id'] and r['week']<week]
        volume=team_volume(own,allowed,week)
        for metric,field in team_mapping.items():
            truth=actual['stats'].get(field); value=volume[metric]['mean']
            if value is not None and truth is not None:
                errors[metric].append(abs(value-truth))
                observed=[r['stats'][field] for r in own if r['stats'].get(field) is not None]
                if observed:
                    baseline_errors[metric].append(abs(sum(observed)/len(observed)-truth))
        history=[r for r in logs if r['team_id']==team and r['week']<week]
        by_player=defaultdict(list)
        for r in history:
            by_player[r['id']].append(r)
        profiles={}
        recent_week=max((r['week'] for r in own),default=0)
        recent_qbs=[r for r in history if r['position']=='QB' and r['week']==recent_week and r['stats'].get('attempts') is not None]
        observed_starter=max(recent_qbs,key=lambda r:r['stats']['attempts'])['id'] if recent_qbs else None
        for pid,previous in by_player.items():
            identity=max(previous,key=lambda r:r['week'])
            profile=player_opportunity({'id':pid,'team_id':team,'position':identity['position']},previous,own,volume,week)
            if identity['position']=='QB' and pid!=observed_starter:
                for m in profile['metrics'].values():
                    m.update(mean=None,status='NOT_AVAILABLE')
            profiles[pid]=profile
        profiles,allocation=allocate(profiles,volume)
        for a in allocation.values():
            if a['assigned'] is not None and a['assigned']>a['capacity']+1e-8:
                invariant_failures+=1
        outcomes=[r for r in logs if r['game_id']==actual['game_id'] and r['team_id']==team]
        for outcome in outcomes:
            previous=by_player.get(outcome['id'],[])
            if len(previous)<4:
                continue
            profile=profiles[outcome['id']]
            for metric,field in [('expectedTargets','targets'),('expectedCarries','carries'),('expectedPassAttempts','attempts')]:
                m=profile['metrics'].get(metric)
                if m is None:
                    continue
                value=m.get('mean'); truth=outcome['stats'].get(field)
                if value is None or truth is None:
                    skipped[metric]+=1
                    continue
                if metric=='expectedPassAttempts' and volume['expectedDropbacks']['mean'] is not None and value>volume['expectedDropbacks']['mean']+1e-8:
                    invariant_failures+=1
                errors[metric].append(abs(value-truth))
                observed=[r['stats'][field] for r in previous if r['stats'].get(field) is not None]
                baseline_errors[metric].append(abs(sum(observed)/len(observed)-truth))
    return {'season':season,'method':'Weeks 6–18, prior same-season games only; ≥4 earlier player logs; full known-history roster reconciliation',
            'metrics':{k:{'n':len(v),'MAE':round(sum(v)/len(v),3) if v else None,
                          'historicalMeanBaselineMAE':round(sum(baseline_errors[k])/len(baseline_errors[k]),3) if baseline_errors[k] else None,
                          'unavailable':skipped[k]} for k,v in errors.items()},
            'invariantFailures':invariant_failures,'routes':{'status':'NOT_AVAILABLE','reason':'No route data'},
            'limitations':['Conditional on appearing in outcome logs; missed games not scored','Corrected releases, not historical as-of snapshots',
                           'No historical injury or depth-chart information assumed','Known-history roster can retain departed players until new team evidence']}

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--season',type=int,default=2025)
    print(json.dumps(validate(parser.parse_args().season),indent=2))
