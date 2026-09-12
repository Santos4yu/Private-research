"""Production audit derives statuses from saved evidence, not UI labels."""
import json
from pathlib import Path
from math import sqrt
from ..props import NFL_PROP_DEFINITIONS
from ..projections.models import model_version
from .gates import eligible,policy

ROOT=Path(__file__).resolve().parents[4]

def read(name):
    try:return json.loads((ROOT/'docs'/name).read_text(encoding='utf-8'))
    except (OSError,ValueError):return {}

def audit_models():
    point=read('nfl-projection-backtest-results.json');distribution=read('nfl-distribution-results.json')
    points=point.get('reports',{}) if point.get('version')=='NFL_PROJECTION_POLICY_V1' else {}
    distributions=distribution.get('reports',{}) if distribution.get('version')=='NFL_PROCESS_DISTRIBUTION_V1' else {}
    records=[]
    for definition in NFL_PROP_DEFINITIONS:
        for position in sorted(definition.positions):
            key=position.value+'.'+definition.key.value;p=points.get(key,{});d=distributions.get(key,{})
            status=p.get('promotion','NOT_AVAILABLE');ds=d.get('distributionStatus','NOT_AVAILABLE')
            held=p.get('holdout2025',{});baselines=p.get('baselines2025',{})
            improvements={name:(baseline['MAE']-held['MAE'])/baseline['MAE'] if baseline.get('MAE') and held.get('MAE') is not None else None for name,baseline in baselines.items()}
            historic=p.get('ablations2025',{}).get('historical',{})
            improvements['historicalEfficiency']=(historic['MAE']-held['MAE'])/historic['MAE'] if historic.get('MAE') and held.get('MAE') is not None else None
            mae=held.get('MAE');bias=held.get('bias');rmse=held.get('RMSE')
            coverage=d.get('holdout',{}).get('coverage') or {}
            evidence={'pointStatus':status,'distributionStatus':ds,'calibrationStatus':'NOT_AVAILABLE','health':'DISABLED' if status in ('DISABLED','NOT_AVAILABLE') else 'WATCH',
              'screenSample':p.get('screeningSelected',{}).get('n',0),'holdoutSample':held.get('n',0),
              'forwardSample':0,'forwardWeeks':0,'historicalSeasons':2 if p else 0,
              'baselineImprovements':improvements,'absoluteBiasOverMAE':abs(bias)/mae if mae and bias is not None else None,
              'percentileError':max((abs(v-int(k[1:])/100) for k,v in coverage.items()),default=None),
              'rosterAvailability':p.get('servedRosterAvailability',0),'asOfSnapshots':False,'untouchedHoldout':False,
              'realTimestampedLines':False,'forwardCapturedBeforeKickoff':False}
            gate=eligible(evidence)
            records.append({'modelKey':key,'modelVersion':model_version(position.value,definition.key.value),'position':position.value,'propType':definition.key.value,'label':definition.label,
                'pointStatus':status,'distributionStatus':ds,'calibrationStatus':'NOT_AVAILABLE','health':evidence['health'],**gate,
                'totalKnownRosterForecasts':p.get('knownRosterForecasts',0),'eligibleOutcomeLogs':p.get('eligibleOutcomeLogs',0),
                'validationSample':evidence['screenSample'],'holdoutSample':evidence['holdoutSample'],'forwardSample':0,
                'pointMetrics':{**held,'errorStandardDeviation':sqrt(max(0,rmse*rmse-bias*bias)) if rmse is not None and bias is not None else None},
                'baselines':baselines,'historicalEfficiencyBaseline':historic,'baselineImprovements':improvements,
                'historicalErrorSlices':p.get('errorSlices',{}),
                'availability':p.get('servedRosterAvailability',0),'distributionMetrics':d.get('holdout',{}),
                'evidence':evidence,'rollingHealth':{'status':evidence['health'],'reason':'No stored prospective outcomes loaded; historical replay is not live forward evidence'}})
    return {'gateVersion':policy()['version'],'mode':'SHADOW','models':records,
            'productionReady':sum(r['productionStatus']=='PRODUCTION_READY' for r in records),
            'decisionThresholdStatus':'NOT_AVAILABLE','lineProviderStatus':'NOT_AVAILABLE'}
