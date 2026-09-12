"""Auditable abstention-first rules. No learned betting thresholds exist yet."""
from datetime import datetime,timezone
from ..distributions import finite
from .gates import policy

VERSION='NFL_DECISION_RULES_V1'

def timestamp(value):
    if not isinstance(value,str):raise ValueError('Timestamp missing')
    dt=datetime.fromisoformat(value.replace('Z','+00:00'))
    if dt.tzinfo is None:raise ValueError('Timezone required')
    return dt

def decide(context,gate,now=None,rules=None):
    rules=rules or policy();now=now or datetime.now(timezone.utc);reasons=[]
    line=context.get('line');projection=context.get('projection');distribution=context.get('distribution',{})
    answer={'verdict':'PASS','status':'NOT_AVAILABLE','confidence':'LOW','direction':None,
            'statisticalEdge':None,'probabilityEdge':None,'marketEdge':None,'EV':None,
            'probability':None,'analyzedLine':line,'decisionRuleVersion':VERSION,'reasons':reasons,'risks':[],
            'generatedAt':now.isoformat(),'productionStatus':gate.get('productionStatus','DISABLED')}
    for field in ('playerId','gameId','position','team','opponent','propType','modelVersion','distributionVersion','roleStatus','modelHealth','dataCoverage','pointStatus','distributionStatus','calibrationStatus'):
        answer[field]=context.get(field)
    answer['projection']=projection;answer['median']=distribution.get('projectionMedian')
    if gate.get('productionStatus')!='PRODUCTION_READY':reasons.append('Model is not production-approved')
    for key in ('playerId','gameId','team','opponent','propType'):
        if not context.get(key):reasons.append('Unresolved '+key)
    if context.get('requiresStartingQB') is not False and not context.get('startingQB'):reasons.append('Starting QB unresolved')
    if context.get('playerStatus')!='ACTIVE' or context.get('injuryCertainty')!='VERIFIED':reasons.append('Player/injury status unresolved')
    if context.get('roleStatus')!='STABLE':reasons.append('Role is not stable')
    if context.get('opportunityStatus')!='AVAILABLE':reasons.append('Opportunity unavailable or uncertain')
    if not finite(projection):reasons.append('Projection unavailable')
    if distribution.get('status')!='VALIDATED':reasons.append('Required distribution is not validated')
    if context.get('calibrationStatus')!='VALIDATED':reasons.append('Probability calibration is not validated')
    if context.get('modelHealth')!='HEALTHY':reasons.append('Model health prevents verdicts')
    coverage=context.get('dataCoverage')
    if not finite(coverage) or coverage<rules['minimumCurrentCoverage']:reasons.append('Current coverage below acceptance threshold')
    for key,age in (('dataTimestamp',rules['maximumDataAgeSeconds']),):
        try:
            delta=(now-timestamp(context.get(key))).total_seconds()
            if not 0<=delta<=age:reasons.append('Stale or future '+key)
        except (ValueError,TypeError):reasons.append('Missing valid '+key)
    if not isinstance(line,dict) or not finite(line.get('value')) or not line.get('platform') or not line.get('source') or line.get('provenance')!='VERIFIED_CURRENT_PROVIDER':
        reasons.append('Real current line missing')
    else:
        if any(line.get(k)!=context.get(k) for k in ('playerId','gameId','propType')):reasons.append('Line identity/prop mismatch')
        try:
            age=(now-timestamp(line.get('timestamp'))).total_seconds()
            if not 0<=age<=rules['maximumLineAgeSeconds']:reasons.append('Line stale or future-dated')
        except (ValueError,TypeError):reasons.append('Line timestamp invalid')
        if context.get('currentLineValue')!=line['value']:reasons.append('Analyzed line moved; recalculation required')
        if finite(projection):answer['statisticalEdge']=projection-line['value']
    probabilities=context.get('calibratedProbabilities') or {}
    if not isinstance(probabilities,dict):probabilities={}
    if not all(finite(probabilities.get(k)) and 0<=probabilities[k]<=1 for k in ('over','under','push')) or abs(sum(probabilities.get(k,0) for k in ('over','under','push') if finite(probabilities.get(k)))-1)>1e-6:
        reasons.append('Coherent calibrated outcome probabilities unavailable')
    learned=rules.get('decisionRules')
    if not isinstance(learned,dict) or learned.get('status')!='VALIDATED' or learned.get('lineDataStatus')!='REAL_TIMESTAMPED_LINES' or learned.get('holdoutSample',0)<500:
        reasons.append('No validated TAKE/LEAN thresholds from legitimate line observations')
    if reasons:return answer
    # This branch is intentionally unreachable with the shipped null decision policy.
    direction=max(('over','under'),key=lambda k:probabilities[k]);p=probabilities[direction]
    reference=context.get('referenceProbability')
    if not finite(reference) or not 0<reference<1 or not context.get('referenceSource'):
        reasons.append('Verified probability reference unavailable; no 50% assumption');return answer
    edge=p-reference
    for field in ('takeProbability','takeProbabilityEdge','leanProbability','leanProbabilityEdge'):
        if not finite(learned.get(field)):
            reasons.append('Incomplete validated decision thresholds');return answer
    verdict='TAKE' if p>=learned['takeProbability'] and edge>=learned['takeProbabilityEdge'] else 'LEAN' if p>=learned['leanProbability'] and edge>=learned['leanProbabilityEdge'] else 'PASS'
    answer.update(verdict=verdict,status='AVAILABLE',direction=direction.upper(),probability=p,probabilityEdge=edge,
                  confidence=learned.get('confidenceLabel','LOW') if verdict!='PASS' else 'LOW')
    reasons.append('Decision reconstructed from validated probability and reference thresholds')
    return answer

def value_board(rows,filters=None):
    filters=filters or {}
    eligible=[r for r in rows if r.get('productionStatus')=='PRODUCTION_READY' and r.get('verdict') in ('TAKE','LEAN') and r.get('status')=='AVAILABLE' and isinstance(r.get('analyzedLine'),dict)
              and r.get('pointStatus')=='VALIDATED' and r.get('distributionStatus')=='VALIDATED' and r.get('calibrationStatus')=='VALIDATED' and r.get('modelHealth')=='HEALTHY'
              and r['analyzedLine'].get('provenance')=='VERIFIED_CURRENT_PROVIDER'
              and finite(r.get('probability')) and finite(r.get('probabilityEdge')) and finite(r.get('dataCoverage'))]
    for key in ('position','propType','team','gameId','verdict','pointStatus','productionStatus'):
        if filters.get(key):eligible=[r for r in eligible if r.get(key)==filters[key]]
    for key in ('probability','probabilityEdge','dataCoverage'):
        if filters.get('minimum'+key[0].upper()+key[1:]) is not None:
            threshold=filters['minimum'+key[0].upper()+key[1:]]
            eligible=[r for r in eligible if finite(r.get(key)) and r[key]>=threshold]
    sort_by=filters.get('sortBy','probabilityEdge')
    if sort_by not in ('probabilityEdge','probability','dataCoverage'):raise ValueError('Unsupported Value Board sort')
    return sorted(eligible,key=lambda r:(r[sort_by],r['probabilityEdge'],r['dataCoverage']),reverse=True)
