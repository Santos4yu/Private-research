"""Experimental NFL candidate simulation; no market inputs or betting verdicts."""
import random
import math
from .distributions import finite, summarize

VERSION='NFL_PROCESS_DISTRIBUTION_V1'
COUNT_PROPS={'targets','receptions','rush_attempts','passing_attempts','pass_completions','interceptions'}

def metric(container,key):
    value=container.get(key,{}).get('mean')
    if not finite(value) or value<0: raise ValueError('Missing opportunity: '+key)
    return value

def binomial(rng,n,p):
    if hasattr(rng,'binomialvariate'):return rng.binomialvariate(n,p)
    return sum(rng.random()<p for _ in range(n))

def uncertain_rate(rng,p,n):
    if p<=0:return 0.0
    if p>=1:return 1.0
    if not finite(n) or n<=0:raise ValueError('Parameter exposure missing')
    return rng.betavariate(p*n,(1-p)*n)

def game_draw(rng,record):
    team=record['teamVolume']; player=record['playerOpportunity']; projection=record['projection']
    plays=metric(team,'expectedPlays'); drop=metric(team,'expectedDropbacks'); called=metric(team,'expectedCalledRushAttempts')
    attempts=metric(team,'expectedTeamPassAttempts'); official=metric(team,'expectedRushAttempts')
    if drop+called>plays+1e-6 or attempts>drop+1e-6:raise ValueError('Incoherent team volume')
    spread=team['expectedPlays'].get('standardDeviation')
    if not finite(spread):raise ValueError('Team variance missing')
    n=team['expectedPlays'].get('sample')
    if not finite(n) or n<=0:raise ValueError('Team sample missing')
    # Estimated mean uncertainty plus natural game-to-game play variation.
    play_mean=rng.gauss(plays,spread/math.sqrt(n))
    total=max(0,round(rng.gauss(play_mean,spread)))
    pass_rate=uncertain_rate(rng,drop/plays,n*plays)
    db=binomial(rng,total,pass_rate)
    called_rush=binomial(rng,total-db,min(1,called/max(1e-9,plays-drop)))
    spikes=total-db-called_rush
    att=binomial(rng,db,uncertain_rate(rng,attempts/drop,n*drop)) if drop else 0
    # Scramble rate inferred from actual Phase 4 official-minus-called accounting.
    scramble_mean=max(0,official-called)
    non_attempt=db-att
    scramble=binomial(rng,non_attempt,min(1,scramble_mean/max(1,drop-attempts)))
    rush_capacity=called_rush+scramble
    observations=max((m.get('sample',0) for m in player.get('metrics',{}).values() if finite(m.get('sample'))),default=0)
    if observations<4:raise ValueError('Role sample insufficient')
    # Changed/uncertain role uses smaller effective exposure, without lowering mean.
    effective=observations if player.get('roleStatus')=='STABLE' else max(1,observations/2)
    result={'plays':total,'dropbacks':db,'attempts':att,'teamAttempts':att,'sacks':non_attempt-scramble,'calledRushes':called_rush,'spikes':spikes,'scrambles':scramble,'rushes':rush_capacity}
    metrics=player.get('metrics',{}); inputs=projection.get('efficiencyInputs',{})
    if record.get('position')=='QB':
        qb_attempts=metric(metrics,'expectedPassAttempts')
        if qb_attempts>attempts+1e-6:raise ValueError('QB attempts exceed team attempts')
        share=qb_attempts/attempts if attempts else 0
        result['attempts']=binomial(rng,att,uncertain_rate(rng,share,effective*max(1,attempts)))
    for key,parent,base,out in (('expectedTargets',att,attempts,'targets'),('expectedCarries',rush_capacity,official,'carries')):
        value=metrics.get(key,{}).get('mean')
        if finite(value):
            if base<=0 and value>0:raise ValueError('No team capacity')
            share=value/base if base else 0
            if not 0<=share<=1:raise ValueError('Player share exceeds capacity')
            result[out]=binomial(rng,parent,uncertain_rate(rng,share,effective*max(1,base)))
    if 'catchRate' in inputs and 'targets' in result:
        e=inputs['catchRate']; result['receptions']=binomial(rng,result['targets'],uncertain_rate(rng,e['mean'],e['validExposure']))
    if 'completionRate' in inputs:
        e=inputs['completionRate']; result['completions']=binomial(rng,att,uncertain_rate(rng,e['mean'],e['validExposure']))
    # Gamma conditional totals are candidates, not assumed validated reception lengths.
    for key,opportunity,out in (('rushingYPC','carries','rushing_yards'),('yardsPerReception','receptions','receiving_yards'),('passingYPA','attempts','passing_yards')):
        if key in inputs and opportunity in result:
            e=inputs[key]; rate=e['mean']; exposure=e['validExposure']
            if rate<=0:raise ValueError('Positive yardage efficiency required for gamma candidate')
            parameter=rng.gammavariate(max(1,exposure),rate/max(1,exposure))
            opportunities=result[opportunity]
            result[out]=round(rng.gammavariate(opportunities,parameter)) if opportunities else 0
    return result

def draw_outcome(rng,record):
    prop=record['propType']; prediction=record['projection']
    if prop=='rushing_receiving_yards':
        children=prediction.get('components',[])
        if len(children)!=2:raise ValueError('Missing combined components')
        merged={**prediction,'efficiencyInputs':{k:v for c in children for k,v in c.get('efficiencyInputs',{}).items()}}
        record={**record,'projection':merged}
    state=game_draw(rng,record)
    key={'rush_attempts':'carries','pass_completions':'completions','passing_attempts':'attempts'}.get(prop,prop)
    if prop=='rushing_receiving_yards':
        value=state['rushing_yards']+state['receiving_yards']
    else:
        if key not in state:raise ValueError('Unsupported process component')
        value=state[key]
    return value,state

def simulate(record,method,parameters,count=10000,seed=17,states=False):
    if not isinstance(count,int) or not 100<=count<=100000:raise ValueError('Invalid simulation count')
    prediction=record['projection']; center=prediction.get('projectionMean')
    if not finite(center) or prediction.get('promotion')!='EXPERIMENTAL':raise ValueError('Unsupported point model')
    if prediction.get('injuryScenarios') or record['playerOpportunity'].get('roleStatus')=='UNCERTAIN':
        raise ValueError('Unresolved scenario: no unconditional distribution')
    rng=random.Random(seed); values=[]; joint=[]
    for _ in range(count):
        if method=='process':value,state=draw_outcome(rng,record); joint.append(state)
        elif method=='residual':
            residuals=parameters.get('residuals',[])
            if len(residuals)<100:raise ValueError('Residual training sample insufficient')
            value=round(center+rng.choice(residuals))
            if record['propType'] in COUNT_PROPS:
                state=game_draw(rng,record);joint.append(state)
                capacity={'targets':state['attempts'],'receptions':state.get('targets',0),
                          'rush_attempts':state['rushes'],'pass_completions':state['attempts']}.get(record['propType'])
                if capacity is None:raise ValueError('Unsupported marginal count capacity')
                value=min(capacity,max(0,value))
        elif method=='poisson' and record['propType'] in COUNT_PROPS:
            # Exact Poisson via exponential arrival times, no normal approximation.
            t=0;value=0
            while center>0:
                t+=rng.expovariate(center)
                if t>1:break
                value+=1
            state=game_draw(rng,record);joint.append(state)
            capacity={'targets':state['attempts'],'receptions':state.get('targets',0),
                      'rush_attempts':state['rushes'],'pass_completions':state['attempts']}.get(record['propType'])
            if capacity is None:raise ValueError('Unsupported Poisson capacity')
            value=min(capacity,value)
        else:raise ValueError('Unknown or incompatible distribution candidate')
        values.append(value)
    return (values,joint) if states else values

def crps(values,actual):
    ordered=sorted(values);n=len(values)
    return sum(abs(v-actual) for v in values)/n-sum((2*i-n+1)*v for i,v in enumerate(ordered))/(n*n)

def histogram(values,bins=20):
    low=min(values);high=max(values);width=max(1,(high-low+1)/bins)
    counts=[0]*bins
    for v in values:counts[min(bins-1,int((v-low)/width))]+=1
    return [{'lower':low+i*width,'upper':low+(i+1)*width,'mass':n/len(values)} for i,n in enumerate(counts)]

def roster_allocation(rng,capacity,shares):
    """Shared multinomial capacity port for multi-player simulation.

    Unassigned opportunity remains unassigned. Excess shares are proportionally
    reconciled, never added to team capacity. Not a QB/receiver yardage coupling.
    """
    if not isinstance(capacity,int) or capacity<0 or any(not finite(s) or s<0 for s in shares.values()):
        raise ValueError('Valid capacity and nonnegative roster shares required')
    total=sum(shares.values());factor=1/total if total>1 else 1
    remaining=capacity;remaining_share=1.0;out={}
    for pid,share in shares.items():
        adjusted=share*factor
        p=min(1,adjusted/remaining_share) if remaining_share>0 else 0
        out[pid]=binomial(rng,remaining,p)
        remaining-=out[pid];remaining_share=max(0,remaining_share-adjusted)
    return out
