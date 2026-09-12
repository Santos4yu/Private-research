"""Explicit operator CLI for real prospective shadow forecasts and final results.

No scheduler or deployment is installed. --db must identify durable local storage.
"""
import argparse
import json
from datetime import datetime,timezone
from .ledger import ShadowLedger
from .audit import audit_models
from .gates import policy
from .health import model_health
from .decisions import VERSION
from ..services import nflverse
from ..projections.service import projection
from ..distribution_service import distribution
from ..projections.dataset import weekly_logs
from ..projections.validate import truth

def capture(ledger,season,week,player_id,prop):
    player=next((p for p in nflverse.players(season).data or [] if p.id==player_id),None)
    if not player:raise ValueError('Player unresolved')
    game=next((g for g in nflverse.schedule(season,week,'REG').data or [] if player.team_id in (g.home_team.id,g.away_team.id)),None)
    if not game or game.starts_at<=datetime.now(timezone.utc):raise ValueError('Future scheduled player game required')
    point=projection(season,player_id,week,prop);dist=distribution(season,player_id,week,prop)
    model=next((r for r in audit_models()['models'] if r['modelKey']==player.position.value+'.'+prop),None)
    if not model or model['productionStatus']=='DISABLED':raise ValueError('Unsupported/disabled shadow model')
    opponent=game.away_team.id if player.team_id==game.home_team.id else game.home_team.id
    body={'mode':'SHADOW','publicVerdict':'PASS','verdict':'PASS','reasons':['Shadow-only; no real line or validated betting rule'],
        'playerId':player_id,'gameId':game.id,'team':player.team_id,'opponent':opponent,'position':player.position.value,'season':season,'week':week,'propType':prop,
        'projection':point.get('projectionMean'),'distribution':dist,'line':None,'direction':None,'probability':None,
        'modelVersion':model['modelVersion'],'distributionVersion':dist['distributionModelVersion'],'calibrationVersion':None,
        'decisionRuleVersion':VERSION,'featureVersion':point.get('policyVersion','NFL_PROJECTION_POLICY_V1'),
        'dataTimestamp':point.get('fetchedAt'),'pointStatus':point.get('promotion'),'distributionStatus':dist.get('status'),
        'availabilityReason':point.get('reason'),
        'sourceVersion':nflverse.SOURCE_VERSION,
        'features':{'opportunity':point.get('opportunityInputs'),'efficiency':point.get('efficiencyInputs'),'matchup':point.get('matchupAdjustments')},
        'risks':['Current injury completeness may be unknown','No current prop line provider']}
    return ledger.snapshot(body,game.starts_at.isoformat())

def settle(ledger,sid):
    snap=ledger.get(sid)
    game=next((g for g in nflverse.schedule(snap['season'],snap['week'],'REG').data or [] if g.id==snap['gameId']),None)
    if not game or game.status!='FINAL':raise ValueError('Official schedule not final')
    dataset=weekly_logs(snap['season'])
    row=next((r for r in dataset['logs'] if r['id']==snap['playerId'] and r['game_id']==snap['gameId']),None)
    if row is None:raise ValueError('Missing final player outcome is not zero')
    actual=truth(row,snap['propType'])
    return ledger.settle(sid,actual,'FINAL',result_source=dataset['sourceUrl'])

def health_dashboard(ledger):
    observations=ledger.observations();models=audit_models()['models'];out=[]
    for model in models:
        rows=[r for r in observations if r.get('modelVersion')==model['modelVersion']]
        baseline=model.get('pointMetrics',{}).get('MAE')
        source_changed=any(r.get('sourceVersion') and r['sourceVersion']!=nflverse.SOURCE_VERSION for r in rows[-100:])
        features_changed=any(r.get('featureVersion') and r['featureVersion']!='NFL_PROJECTION_POLICY_V1' for r in rows[-100:])
        health=model_health(rows,baseline,model['modelVersion'],policy(),source_changed,features_changed,model.get('distributionMetrics',{}).get('coverage'))
        if model['productionStatus']=='DISABLED':health.update(status='DISABLED',verdictsEnabled=False)
        out.append({**model,'prospectiveHealth':health,'prospectivePredictions':len(rows)})
    return {'mode':'SHADOW','models':out,'productionReady':0,'lineProviderStatus':'NOT_AVAILABLE'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('action',choices=('capture','settle','health'));parser.add_argument('--db',required=True)
    parser.add_argument('--season',type=int);parser.add_argument('--week',type=int);parser.add_argument('--player');parser.add_argument('--prop');parser.add_argument('--snapshot')
    args=parser.parse_args();ledger=ShadowLedger(args.db)
    try:
        if args.action=='capture':value={'snapshotId':capture(ledger,args.season,args.week,args.player,args.prop)}
        elif args.action=='settle':value=settle(ledger,args.snapshot)
        else:value=health_dashboard(ledger)
        print(json.dumps(value,indent=2,allow_nan=False))
    finally:ledger.close()
