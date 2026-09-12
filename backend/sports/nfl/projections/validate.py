"""Walk-forward statistic-only validation. 2023 fit, 2024 select, 2025 holdout."""
import json
from collections import defaultdict
from math import exp,sqrt
from pathlib import Path
from statistics import median
from .dataset import weekly_logs
from .models import ProjectionContext,SUPPORTED,FEATURES,model_key,project
from .efficiency import prior_table,valid_number
from ..services.play_by_play import season_summary
from ..services.matchup_data import season_data
from ..opportunity import team_volume,player_opportunity
from ..allocation import allocate
from ..matchup_profiles import profiles

OUTCOMES={'passing_attempts':'attempts','passing_yards':'passing_yards','pass_completions':'completions','interceptions':'passing_interceptions',
          'rush_attempts':'carries','rushing_yards':'rushing_yards','receptions':'receptions','receiving_yards':'receiving_yards','targets':'targets'}
METHODS=('historical','shrink','recency','opponent')

def truth(log,prop):
    if prop=='rushing_receiving_yards':
        values=[log['stats'].get(k) for k in ('rushing_yards','receiving_yards')]
        return sum(values) if all(valid_number(v) for v in values) else None
    return log['stats'].get(OUTCOMES.get(prop,''))

def mean_baseline(previous,prop,week,weighted=False):
    rows=[(r['week'],truth(r,prop)) for r in previous if r['week']<week and valid_number(truth(r,prop))]
    if not rows:return None
    weights=[exp(-(week-w)/8) if weighted else 1 for w,v in rows]
    return sum(v*a for (w,v),a in zip(rows,weights))/sum(weights)

def observations(season,coefficients=None,capture=False):
    pbp=season_summary(season); box=weekly_logs(season)['logs'];advanced=season_data(season)
    extra={(r['game_id'],r['player_id']):r['stats'] for r in pbp['players']}
    logs=[]
    for r in box:
        stats={**r['stats'],**{k:extra.get((r['game_id'],r['id']),{}).get(k) for k in ('dropbacks','scrambles','kneels','non_scramble_rushes','sacks_suffered')}}
        logs.append({**r,'stats':stats})
    output=defaultdict(list); attempted=defaultdict(int); absent=defaultdict(int); forecasts=[]
    for week in range(6,19):
        prior=[r for r in logs if r['week']<week]
        defense,reference=profiles(advanced['games'],week)
        by_team=defaultdict(list)
        # Latest known assignment from earlier games only; no final roster inference.
        latest={}
        for r in prior:
            if r['id'] not in latest or r['week']>latest[r['id']]['week']:latest[r['id']]=r
        for r in prior:
            if latest[r['id']]['team_id']==r['team_id']:by_team[r['team_id']].append(r)
        priors=prior_table(prior,week)
        for game in [r for r in pbp['teams'] if r['week']==week]:
            team=game['team_id'];own=[r for r in pbp['teams'] if r['team_id']==team and r['week']<week]
            allowed=[r for r in pbp['teams'] if r['opponent_team_id']==game['opponent_team_id'] and r['week']<week]
            volume=team_volume(own,allowed,week)
            by_player=defaultdict(list)
            for r in by_team[team]:by_player[r['id']].append(r)
            recent=max((r['week'] for r in own),default=0)
            qbs=[r for r in by_team[team] if r['week']==recent and r['position']=='QB' and valid_number(r['stats'].get('attempts'))]
            starter=max(qbs,key=lambda r:r['stats']['attempts'])['id'] if qbs else None
            role_profiles={}
            for pid,previous in by_player.items():
                identity=latest[pid]
                p=player_opportunity({'id':pid,'team_id':team,'position':identity['position']},previous,own,volume,week)
                if identity['position']=='QB' and pid!=starter:
                    p.update(status='NOT_AVAILABLE')
                    for metric in p['metrics'].values():metric.update(mean=None,status='NOT_AVAILABLE')
                role_profiles[pid]=p
            role_profiles,_=allocate(role_profiles,volume)
            outcomes={r['id']:r for r in logs if r['game_id']==game['game_id'] and r['team_id']==team}
            profile=defense.get(game['opponent_team_id'],{})
            last=max(profile.get('sampleWeeks',[]),default=0)
            matchup={'defenseProfile':profile,'references':reference,'freshness':{'factor':1 if last and week-last<=2 else .5 if last and week-last<=3 else 0}}
            for pid,role in role_profiles.items():
                identity=latest[pid];position=identity['position']
                previous=[r for r in prior if r['id']==pid]
                if len(previous)<4:continue
                opportunity={'status':role['status'],'player':role,'team':volume,'startingQB':starter,'health':{'injuryCertainty':'UNKNOWN'}}
                ctx=ProjectionContext({'id':pid,'team_id':team,'position':position},game['game_id'],week,previous,prior,opportunity,matchup,season,priors[pid])
                if capture:
                    from .models import load_policy
                    for prop in SUPPORTED[position]:
                        prediction=project(ctx,prop,load_policy())
                        if prediction.get('projectionMean') is not None:
                            forecasts.append({'season':season,'week':week,'gameId':game['game_id'],'playerId':pid,
                                'position':position,'team':team,'opponent':game['opponent_team_id'],'propType':prop,
                                'teamVolume':volume,'playerOpportunity':role,'projection':prediction,
                                'actual':truth(outcomes[pid],prop) if pid in outcomes else None,
                                'informationCutoff':None,'latestInputWeek':max((r['week'] for r in previous),default=None),
                                'snapshotStatus':'CORRECTED_RELEASE_PRIOR_WEEK_REPLAY',
                                'injurySnapshot':None,'weatherSnapshot':None,'depthSnapshot':None})
                config={model_key(position,p):{'promotion':'EXPERIMENTAL','coefficient':(coefficients or {}).get(model_key(position,p),0)} for p in SUPPORTED[position]}
                predictions={}
                for prop in SUPPORTED[position]:
                    key=model_key(position,prop);attempted[key]+=1
                    if pid not in outcomes:
                        absent[key]+=1;continue
                    actual=truth(outcomes[pid],prop)
                    if not valid_number(actual):continue
                    models={m:project(ctx,prop,config,m) for m in METHODS}
                    values={m:r['projectionMean'] for m,r in models.items()}
                    predictions[prop]=values
                    chosen=models['recency']
                    row={'week':week,'position':position,'playerId':pid,'actual':actual,'predictions':values,
                         'seasonMean':mean_baseline(previous,prop,week),'recentMean':mean_baseline(previous,prop,week,True),
                         'feature':chosen.get('matchupFeature',{}).get('unitEffect'),
                         'role':role['roleStatus'],'sampleReliability':role['sampleReliability'],'dataCoverage':chosen['dataCoverage']}
                    if prop=='rushing_receiving_yards':
                        row['componentPredictions']={p:predictions.get(p,{}) for p in ('rushing_yards','receiving_yards')}
                    output[key].append(row)
    return {'season':season,'rows':dict(output),'knownRosterForecasts':dict(attempted),'noOutcomeLog':dict(absent),'forecasts':forecasts}

def statistics(rows,method):
    selected=[(r,r['predictions'].get(method)) for r in rows if valid_number(r['actual']) and valid_number(r['predictions'].get(method))]
    errors=[p-r['actual'] for r,p in selected]
    return {'n':len(errors),'MAE':sum(abs(e) for e in errors)/len(errors) if errors else None,
            'MedianAE':median(abs(e) for e in errors) if errors else None,
            'RMSE':sqrt(sum(e*e for e in errors)/len(errors)) if errors else None,'bias':sum(errors)/len(errors) if errors else None}

def baseline(rows,field,method):
    common=[r for r in rows if valid_number(r['predictions'].get(method)) and valid_number(r.get(field))]
    return statistics([{**r,'predictions':{field:r[field]}} for r in common],field)

def validate():
    print('Projection validation: 2023 training',flush=True)
    train=observations(2023)
    coefficients={}
    for key,rows in train['rows'].items():
        valid=[r for r in rows if valid_number(r['feature']) and valid_number(r['predictions'].get('recency'))]
        xx=sum(r['feature']**2 for r in valid)
        xy=sum(r['feature']*(r['actual']-r['predictions']['recency']) for r in valid)
        # Nonnegative constrained linear effect, no rankings or score multiplier.
        coefficients[key]=max(0,min(1,xy/xx)) if xx and len(valid)>=200 else 0
    print('Projection validation: 2024 screening',flush=True)
    screen=observations(2024,coefficients)
    policy={};reports={}
    for key,rows in screen['rows'].items():
        ablations={m:statistics(rows,m) for m in METHODS}
        eligible=[m for m in METHODS if ablations[m]['n']>=100]
        method=min(eligible,key=lambda m:ablations[m]['MAE']) if eligible else 'recency'
        policy[key]={'method':method,'coefficient':coefficients.get(key,0) if method=='opponent' else 0,'promotion':'EXPERIMENTAL',
                     'reason':'Frozen 2024 selection; corrected releases and absent as-of injury/depth snapshots prevent validated promotion'}
        reports[key]={'trainN':len(train['rows'].get(key,[])),'frozenCoefficient':coefficients.get(key,0),'screen2024':ablations,
                      'selectedMethod':method,'advancedChartingAblation':'NOT_AVAILABLE','roleSnapshots':'NOT_AVAILABLE'}
    print('Projection validation: 2025 holdout',flush=True)
    final=observations(2025,coefficients)
    for key,config in policy.items():
        method=config['method']
        if key=='RB.rushing_receiving_yards':
            for dataset in (screen,final):
                for r in dataset['rows'].get(key,[]):
                    pieces=[r['componentPredictions'].get(p,{}).get(policy.get(model_key('RB',p),{}).get('method','recency')) for p in ('rushing_yards','receiving_yards')]
                    r['predictions']['componentSum']=sum(pieces) if all(valid_number(v) for v in pieces) else None
            config['method']='componentSum';method='componentSum'
        rows=final['rows'].get(key,[])
        measured=statistics(rows,method);screened=statistics(screen['rows'].get(key,[]),method)
        simple={f:baseline(rows,f,method) for f in ('seasonMean','recentMean')}
        screen_simple={f:baseline(screen['rows'].get(key,[]),f,method) for f in ('seasonMean','recentMean')}
        gains=measured['n']>=100 and screened['n']>=100 and all(v['MAE'] is not None and measured['MAE']<v['MAE'] for v in simple.values()) and all(v['MAE'] is not None and screened['MAE']<v['MAE'] for v in screen_simple.values())
        if not gains:
            config.update(promotion='DISABLED',reason='Insufficient sample or fails at least one simple baseline across screening/holdout; not served as a supported projection')
        report=reports[key]
        report.update(selectedMethod=method,promotion=config['promotion'],reason=config['reason'],holdout2025=measured,baselines2025=simple,baselines2024=screen_simple,
                      screeningSelected=screened,ablations2025={m:statistics(rows,m) for m in METHODS},
                      eligibleOutcomeLogs=len(rows),knownRosterForecasts=final['knownRosterForecasts'].get(key,0),noOutcomeLog=final['noOutcomeLog'].get(key,0),
                      conditionalAvailability=measured['n']/len(rows) if rows else 0,
                      rosterAvailability=measured['n']/final['knownRosterForecasts'].get(key,1),
                      errorSlices={field:{value:statistics([r for r in rows if str(r.get(field))==value],method) for value in sorted({str(r.get(field)) for r in rows})} for field in ('position','week','sampleReliability','role','dataCoverage')})
    # Component sums cannot be promoted when either selected child is disabled.
    combined=policy.get('RB.rushing_receiving_yards')
    if combined and any(policy.get(model_key('RB',p),{}).get('promotion')=='DISABLED' for p in ('rushing_yards','receiving_yards')):
        combined.update(promotion='DISABLED',reason='A required component model is disabled')
        reports['RB.rushing_receiving_yards'].update(promotion='DISABLED',reason=combined['reason'])
    for report in reports.values():
        report['servedConditionalAvailability']=report['conditionalAvailability'] if report['promotion']!='DISABLED' else 0
        report['servedRosterAvailability']=report['rosterAvailability'] if report['promotion']!='DISABLED' else 0
    return {'version':'NFL_PROJECTION_POLICY_V1','method':'2023 fit; 2024 frozen selection; 2025 holdout can only disable; walk-forward prior-week inputs',
            'models':policy,'reports':reports,'limitations':['No VALIDATED promotion without as-of snapshots/prospective validation',
            'Outcome-log conditional errors; missed games have unknown outcomes, never synthetic zeros','No route/coverage/true pressure/weather ablation',
            'Current same-season minimum four logs; early-season availability intentionally limited','Final veto needs another untouched season for prospective post-veto policy validation']}

if __name__=='__main__':
    result=validate()
    root=Path(__file__).resolve().parents[4]
    (root/'docs/nfl-projection-backtest-results.json').write_text(json.dumps(result,indent=2,allow_nan=False),encoding='utf-8')
    (Path(__file__).parent/'policy.json').write_text(json.dumps({'version':result['version'],'models':result['models']},indent=2),encoding='utf-8')
    print(json.dumps({'models':result['models'],'summary':{k:{'promotion':v['promotion'],'n':v['holdout2025']['n'],'MAE':v['holdout2025']['MAE'],'baseline':v['baselines2025'],'availability':v['conditionalAvailability']} for k,v in result['reports'].items()}},indent=2))
