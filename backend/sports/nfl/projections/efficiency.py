"""Current-season efficiency: real positional priors and exposure shrinkage."""
from math import exp, isfinite
from statistics import median

RATES={'passingYPA':('passing_yards','attempts'), 'completionRate':('completions','attempts'),
       'interceptionRate':('passing_interceptions','attempts'), 'rushingYPC':('rushing_yards','carries'),
       'catchRate':('receptions','targets'), 'yardsPerReception':('receiving_yards','receptions')}

def valid_number(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and isfinite(value)

def rate_rows(logs, key, week):
    numerator,denominator=RATES[key]
    rows=[]
    for row in logs:
        if row['week']>=week:
            continue
        n,d=row['stats'].get(numerator),row['stats'].get(denominator)
        if not valid_number(n) or not valid_number(d) or d<=0:
            continue
        if key in ('completionRate','interceptionRate','catchRate') and not 0<=n<=d:
            continue
        rows.append((row['week'],n,d))
    return rows

def positional_prior(logs,position,player_id,key,week):
    peers=[r for r in logs if r['position']==position and r['id']!=player_id and r['week']<week]
    rows=rate_rows(peers,key,week)
    ids={r['id'] for r in peers if rate_rows([r],key,week)}
    if len(ids)<8 or not rows:
        return None
    exposure=sum(d for _,_,d in rows)
    return {'mean':sum(n for _,n,_ in rows)/exposure,'priorExposure':4*median(d for _,_,d in rows),
            'peerPlayers':len(ids),'peerExposure':exposure,'position':position}

def prior_table(logs,week):
    """Equivalent peer-excluding priors, preaggregated once per forecast week."""
    output={r['id']:{} for r in logs if r['week']<week}
    for position in ('QB','RB','WR','TE'):
        players={r['id'] for r in logs if r['position']==position and r['week']<week}
        selected=[r for r in logs if r['position']==position and r['week']<week]
        for key in RATES:
            rows=[(r['id'],*value) for r in selected for value in rate_rows([r],key,week)]
            valid_ids={pid for pid,_,_,_ in rows}
            n=sum(n for _,_,n,_ in rows);d=sum(d for _,_,_,d in rows)
            own={pid:(sum(v[2] for v in rows if v[0]==pid),sum(v[3] for v in rows if v[0]==pid)) for pid in players}
            for pid in players:
                peer_ids=len(valid_ids-{pid});exposure=d-own[pid][1]
                values=[v[3] for v in rows if v[0]!=pid]
                output[pid][key]=({'mean':(n-own[pid][0])/exposure,'priorExposure':4*median(values),
                                  'peerPlayers':peer_ids,'peerExposure':exposure,'position':position} if peer_ids>=8 and exposure>0 and values else None)
    return output

def efficiency(logs,key,week,prior,method='recency'):
    rows=rate_rows(logs,key,week)
    minimum=100 if key=='interceptionRate' else 20 if key in ('catchRate','yardsPerReception') else 40
    if len(rows)<4 or sum(d for _,_,d in rows)<minimum:
        return {'status':'NOT_AVAILABLE','mean':None,'reason':f'Four prior games and {minimum} valid opportunities required','sampleGames':len(rows)}
    if method!='historical' and prior is None:
        return {'status':'NOT_AVAILABLE','mean':None,'reason':'Empirical positional prior unavailable'}
    weights=[exp(-(week-w)/8) if method=='recency' else 1. for w,_,_ in rows]
    exposure=sum(a*d for a,(_,_,d) in zip(weights,rows))
    numerator=sum(a*n for a,(_,n,_) in zip(weights,rows))
    observed=numerator/exposure
    strength=0 if method=='historical' else prior['priorExposure']*(3 if key=='interceptionRate' else 1)
    mean=(numerator+strength*prior['mean'])/(exposure+strength) if strength else observed
    effective=sum(weights)**2/sum(a*a for a in weights)
    return {'status':'LOW_CONFIDENCE','mean':mean,'observedRate':observed,'rawSeasonRate':sum(n for _,n,_ in rows)/sum(d for _,_,d in rows),
            'validExposure':sum(d for _,_,d in rows),'weightedExposure':exposure,'sampleGames':len(rows),'effectiveGames':effective,
            'prior':prior if strength else None,'priorExposure':strength,'reliability':exposure/(exposure+strength) if strength else 1.,
            'method':method,'decayWeeks':8 if method=='recency' else None,'positionBaseline':prior['position'] if prior else None,
            'expectedTrackingMetrics':'NOT_AVAILABLE'}
