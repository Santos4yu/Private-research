"""Provider-neutral interaction math. No live charting is invented here."""
from math import isfinite, tanh

def unavailable(reason):
    return {'status':'NOT_AVAILABLE','score':None,'certainty':None,'dataCoverage':0,'contributors':[],'reason':reason}


def normalize(value,reference,reliability=1.,direction=1):
    mean,sd=reference.get('mean'),reference.get('standardDeviation')
    if value is None or mean is None or sd is None or not all(isfinite(v) for v in (value,mean,sd,reliability)) or sd<=0:
        return None
    z=direction*(value-reference['mean'])/reference['standardDeviation']
    return {'value':value,'referenceMean':reference['mean'],'referenceSD':reference['standardDeviation'],
            'normalized':z,'reliability':max(0,min(1,reliability)),'contribution':50*tanh(z/2)*max(0,min(1,reliability))}


def frequency_fit(mix,splits,reference,baseline=None,prior_exposure=None):
    """All means must share the same documented metric/unit.

    An adapter must supply real frequencies, split exposures, and an empirical
    broader baseline. Partial unsupported exposure remains unscored, not neutral.
    """
    if not mix or not splits or baseline is None or prior_exposure is None or not isfinite(baseline) or not isfinite(prior_exposure) or prior_exposure<=0 or abs(sum(mix.values())-1)>1e-6 or any(not isfinite(v) or v<0 for v in mix.values()):
        return unavailable('Validated exposure mix, comparable splits and broader baseline required')
    contributions=[]; coverage=0; delta=0; certainty=0
    for family,frequency in mix.items():
        split=splits.get(family)
        if not split or split.get('mean') is None or not isfinite(split['mean']) or not isfinite(split.get('n',0)) or split.get('n',0)<=0:
            continue
        rho=split['n']/(split['n']+prior_exposure)
        shrunk=rho*split['mean']+(1-rho)*baseline
        norm=normalize(shrunk,reference,rho)
        if norm is None:
            continue
        contribution=frequency*norm['contribution']
        contributions.append({'feature':family,**norm,'sample':split['n'],'shrunkValue':shrunk,'weight':frequency,'finalContribution':contribution})
        coverage+=frequency;delta+=contribution;certainty+=frequency*rho
    if not contributions:
        return unavailable('No supported interaction samples')
    return {'status':'AVAILABLE' if coverage>=.8 and certainty>=.5 else 'LOW_CONFIDENCE','score':50+delta,
            'certainty':100*certainty,'dataCoverage':100*coverage,'contributors':contributions,
            'reason':'Frequency-weighted research fit; not hit probability'}


def route_fit(route_mix,player_splits,defense_splits,reference,player_baseline,defense_baseline,prior_exposure):
    # Require BOTH player and defense support for each route. No one-sided bonus.
    combined={}
    if player_baseline is None or defense_baseline is None:
        return unavailable('Broader player/defense baselines unavailable')
    for route in route_mix or {}:
        p,d=player_splits.get(route),defense_splits.get(route)
        if p and d and p.get('mean') is not None and d.get('mean') is not None and p.get('n',0)>0 and d.get('n',0)>0:
            combined[route]={'mean':(p['mean']-player_baseline)+(d['mean']-defense_baseline),'n':min(p['n'],d['n'])}
    return frequency_fit(route_mix,combined,reference,0.,prior_exposure)


def run_concept_fit(mix,player,defense,blocking,reference,baselines,prior_exposure):
    if not blocking or not baselines or any(baselines.get(k) is None for k in ('player','defense','blocking')):
        return unavailable('Comparable player, defense and concept-blocking samples required')
    combined={}
    for concept in mix or {}:
        values=[v.get(concept) for v in (player,defense,blocking)]
        if all(v and v.get('mean') is not None and v.get('n',0)>0 for v in values):
            combined[concept]={'mean':sum(v['mean']-baselines[k] for v,k in zip(values,('player','defense','blocking')))/3,'n':min(v['n'] for v in values)}
    return frequency_fit(mix,combined,reference,0.,prior_exposure)


def pressure_fit(rate,qb_splits,reference,baseline,prior_exposure):
    if rate is None or not 0<=rate<=1:
        return unavailable('True pressure attribution required; sacks/hits are not pressure rate')
    return frequency_fit({'PRESSURED':rate,'CLEAN':1-rate},qb_splits,reference,baseline,prior_exposure)


def coverage_fit(mix,player_splits,qb_splits,player_reference,qb_reference,player_baseline,qb_baseline,route_prior,dropback_prior):
    """Separate units are normalized before combining receiver and QB fit."""
    player=frequency_fit(mix,player_splits,player_reference,player_baseline,route_prior)
    qb=frequency_fit(mix,qb_splits,qb_reference,qb_baseline,dropback_prior)
    if player['score'] is None or qb['score'] is None:
        return unavailable('Comparable receiver AND QB coverage evidence required')
    return {'status':'LOW_CONFIDENCE','score':(player['score']+qb['score'])/2,
            'certainty':min(player['certainty'],qb['certainty']),'dataCoverage':min(player['dataCoverage'],qb['dataCoverage']),
            'contributors':[{'channel':name,**c,'finalContribution':c['finalContribution']/2} for name,result in [('receiver',player),('qb',qb)] for c in result['contributors']],
            'reason':'Unit-normalized, frequency-weighted coverage research; requires future adapter/validation'}


def alignment_fit(mix,player,defense,reference,player_baseline,defense_baseline,prior_exposure):
    return route_fit(mix,player,defense,reference,player_baseline,defense_baseline,prior_exposure)
