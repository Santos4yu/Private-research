"""NFL-only summarized distribution service; football cache is line-independent."""
import json
from pathlib import Path
from datetime import datetime,timezone
from collections import Counter
from .cache import cached_nfl,NFLCacheDomain
from .projections.service import projection
from .opportunity_service import opportunity
from .distribution_engine import simulate,histogram,VERSION
from .distributions import fingerprint,summarize,unavailable

def distribution(season,player_id,week,prop):
    point=projection(season,player_id,week,prop)
    missing=unavailable(point)
    missing['pointModelStatus']=point.get('promotion','NOT_AVAILABLE')
    if point.get('promotion')=='DISABLED':missing['status']='DISABLED'
    missing['conditionalScenarios']=[{'condition':s.get('condition'),'status':'NOT_AVAILABLE','probability':None,
        'reason':'Alternative scenario efficiency/opportunity distribution not supported'} for s in point.get('injuryScenarios',[])]
    try:policy=json.loads(Path(__file__).with_name('distribution_policy.json').read_text())
    except (OSError,ValueError):return missing
    if policy.get('version')!=VERSION:return missing
    # Position is encoded in existing Phase 6 model version; no ID guessing.
    position=next((p for p in ('QB','RB','WR','TE') if point.get('modelVersion','').startswith('NFL_'+p+'_')),None)
    config=policy.get('models',{}).get(f'{position}.{prop}')
    if not config or config.get('status')!='EXPERIMENTAL' or point.get('projectionMean') is None:return missing
    volume=opportunity(season,player_id,week)
    record={'season':season,'week':week,'playerId':player_id,'gameId':point.get('gameId'),'position':position,
            'propType':prop,'projection':point,'teamVolume':volume.get('team',{}),'playerOpportunity':volume.get('player',{})}
    # Generated/fetched timestamps aren't statistical inputs. Source snapshot
    # values, role/injury context and all versioned model parameters remain keyed.
    def stable(value):
        if isinstance(value,dict):return {k:stable(v) for k,v in value.items() if k not in ('generatedAt','fetchedAt')}
        if isinstance(value,list):return [stable(v) for v in value]
        return value
    count=policy['simulationCount'];seed=17
    identity=fingerprint({'record':stable(record),'policy':config},point.get('modelVersion'),seed,count)
    def build():
        try:values=simulate(record,config['method'],config['parameters'],count,seed)
        except (ValueError,KeyError,ZeroDivisionError) as error:return {**missing,'reason':'Distribution unavailable: '+str(error)}
        result=summarize(values)
        if point.get('history',{}).get('usesPriorSeason'):
            result.update(distributionModelVersion='NFL_EARLY_SEASON_DISTRIBUTION_V1',history=point['history'],
                          projectionCondition=point.get('projectionCondition'),validationStatus='EXPERIMENTAL')
        sd=result['standardDeviation'];scale=max(1,abs(result['mean']));ratio=sd/scale
        return {**missing,**result,'status':'EXPERIMENTAL','pointModelStatus':point.get('promotion'),
                'projectionMean':result['mean'],'pointProjectionMean':point.get('projectionMean'),'projectionMedian':result['median'],'outcomeVolatility':'HIGH' if ratio>=.75 else 'MEDIUM' if ratio>=.35 else 'LOW',
                'histogram':histogram(values),'_outcomeMass':dict(Counter(values)),'dataCoverage':point.get('dataCoverage'),
                'roleReliability':point.get('roleReliability'),'sampleReliability':point.get('sampleReliability'),
                'simulationSeed':seed,'inputFingerprint':identity,'method':config['method'],
                'generatedAt':datetime.now(timezone.utc).isoformat(),
                'reason':'Experimental statistical distribution; no betting calibration or current line.'}
    cached=cached_nfl(NFLCacheDomain.PROJECTIONS,('distribution',identity),build)
    # Exact integer outcome mass stays server-side for future verified-line
    # comparisons; a new line can query the same cached CDF without resimulation.
    return {k:v for k,v in cached.items() if not k.startswith('_')}
