"""Reproducible chronological statistical distribution screening, not betting calibration."""
import json
import time
import sys
from pathlib import Path
from collections import defaultdict
from statistics import mean
from .projections.validate import observations
from .projections.models import load_policy
from .distribution_engine import simulate,crps,VERSION
from .distributions import summarize
from .distribution_validation import percentile_coverage,convergence

ROOT=Path(__file__).resolve().parents[3]

def evaluate(rows,method,parameters):
    summaries=[];loss=[];available=0;outer=[];sd=[];gaps=[]
    for row in rows:
        if row['actual'] is None:continue
        try:values=simulate(row,method,parameters,512,17)
        except (ValueError,KeyError,ZeroDivisionError):continue
        available+=1;s=summarize(values)
        summaries.append({'actual':row['actual'],'percentiles':s['percentiles']})
        loss.append(crps(values,row['actual']))
        outer.append(s['percentiles']['p90']-s['percentiles']['p10']);sd.append(s['standardDeviation']);gaps.append(s['mean']-s['median'])
    return {**percentile_coverage(summaries),'CRPS':mean(loss) if loss else None,
            'availability':available/len(rows) if rows else 0,'meanP10P90Width':mean(outer) if outer else None,
            'meanStandardDeviation':mean(sd) if sd else None,'meanMinusMedian':mean(gaps) if gaps else None}

def validate():
    policy=load_policy();coefficients={k:v.get('coefficient',0) for k,v in policy.items()}
    datasets={}
    path=ROOT/'docs/nfl-distribution-forecasts.jsonl'
    if '--reuse-capture' in sys.argv and path.exists():
        datasets={year:[] for year in (2023,2024,2025)}
        with path.open(encoding='utf-8') as f:
            for line in f:
                row=json.loads(line)
                if row['latestInputWeek']>=row['week']:raise ValueError('Future input in capture')
                datasets[row['season']].append(row)
    else:
        for season in (2023,2024,2025):
            print('Capture',season,flush=True)
            datasets[season]=observations(season,coefficients,capture=True)['forecasts']
    # Captured means use the Phase 6 frozen policy, whose 2025 veto is explicitly
    # inherited. This evaluates distributions, not a clean independent point policy.
    with path.open('w',encoding='utf-8') as f:
        for rows in datasets.values():
            for r in rows:f.write(json.dumps(r,allow_nan=False)+'\n')
    grouped={}
    for year,rows in datasets.items():
        groups=defaultdict(list)
        for r in rows:groups[r['position']+'.'+r['propType']].append(r)
        grouped[year]=groups
    if '--augment-final' in sys.argv:
        artifact=json.loads((ROOT/'docs/nfl-distribution-results.json').read_text(encoding='utf-8'))
        saved=json.loads(Path(__file__).with_name('distribution_policy.json').read_text(encoding='utf-8'))
        for key,config in saved['models'].items():
            artifact['reports'][key]['holdout']=evaluate(grouped[2025][key],config['method'],config['parameters'])
        (ROOT/'docs/nfl-distribution-results.json').write_text(json.dumps(artifact,indent=2,allow_nan=False),encoding='utf-8')
        return artifact
    reports={};serving={}
    for key,config in policy.items():
        if config['promotion']=='DISABLED':
            reports[key]={'pointModelStatus':'DISABLED','distributionStatus':'DISABLED'};continue
        train=grouped[2023][key];screen=grouped[2024][key];hold=grouped[2025][key]
        residuals=[r['actual']-r['projection']['projectionMean'] for r in train if r['actual'] is not None]
        params={'residuals':residuals}
        candidates=['residual','process']
        if key.split('.')[1] in ('targets','receptions','rush_attempts','pass_completions'):candidates.append('poisson')
        if key.endswith('rushing_receiving_yards'):candidates=['process']
        screened={m:evaluate(screen,m,params) for m in candidates}
        eligible=[m for m,s in screened.items() if s['n']>=100 and s['CRPS'] is not None]
        method=min(eligible,key=lambda m:screened[m]['CRPS']) if eligible else None
        final=evaluate(hold,method,params) if method else {'n':0}
        # Conservative inclusive-count tolerances, not significance claims.
        coverage=final.get('coverage') or {}
        acceptable=method and final['n']>=100 and all(abs(coverage.get(f'p{p}',0)-p/100)<=.20 for p in (10,25,50,75,90))
        status='EXPERIMENTAL' if acceptable else 'DISABLED'
        reports[key]={'pointModelStatus':'EXPERIMENTAL','distributionStatus':status,'trainingSample':len(residuals),
                      'screeningCandidates':screened,'selectedMethod':method,'holdout':final,
                      'bettingCalibration':'NOT AVAILABLE — NO HISTORICAL TIMESTAMPED LINE DATA'}
        if acceptable:serving[key]={'method':method,'parameters':params,'status':status}
        print(key,method,status,flush=True)
    convergence_rows=[]
    for key,config in serving.items():
        row=next((r for r in grouped[2025][key] if not r['projection'].get('injuryScenarios') and r['playerOpportunity'].get('roleStatus')!='UNCERTAIN'),None)
        if not row:continue
        start=time.monotonic()
        runs=convergence(lambda n,s:simulate(row,config['method'],config['parameters'],n,s),row['projection']['projectionMean'])
        convergence_rows.append({'key':key,'thresholdType':'MODEL_MEAN_STATISTICAL_DIAGNOSTIC_NOT_MARKET_LINE',
                                 'runtimeSeconds':time.monotonic()-start,'runs':runs})
    # Numerical serving gate: across three seeds, diagnostic event probability
    # range <=1.5 percentage points, mean range <=5% scale and P90 range <=10%.
    passing=[]
    for count in (5000,10000,25000,50000):
        good=True
        for context in convergence_rows:
            runs=[r for r in context['runs'] if r['count']==count]
            scale=max(1,abs(mean(r['mean'] for r in runs)))
            if max(r['rawOverProbability'] for r in runs)-min(r['rawOverProbability'] for r in runs)>.015 or max(r['mean'] for r in runs)-min(r['mean'] for r in runs)>.05*scale or max(r['percentiles']['p90'] for r in runs)-min(r['percentiles']['p90'] for r in runs)>.10*scale:
                good=False
        if good and convergence_rows:passing.append(count)
    selected_count=min(passing) if passing else 50000
    result={'version':VERSION,'reports':reports,'convergence':convergence_rows,'servingCount':selected_count,'convergenceGatePassed':bool(passing),
            'limitations':['Inherited Phase 6 2025 veto; another untouched season required',
            'Corrected releases are not archived pregame snapshots','No historical timestamped betting lines',
            'Process gamma omits negative yards and is only a tested candidate','Residual outputs are univariate, not roster-joint',
            '512 draws per historical candidate forecast; serving count evaluated separately']}
    (ROOT/'docs/nfl-distribution-results.json').write_text(json.dumps(result,indent=2,allow_nan=False),encoding='utf-8')
    (Path(__file__).with_name('distribution_policy.json')).write_text(json.dumps({'version':VERSION,'models':serving if passing else {},'simulationCount':selected_count},allow_nan=False),encoding='utf-8')
    return result

if __name__=='__main__':validate()
