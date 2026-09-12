"""Field-specific defensive profiles and chronological offense-strength residuals."""
from math import isfinite
from statistics import median, pstdev

METRICS=('pass_epa','pass_success','ypa','completion_rate','cpoe','pass_explosive','yac_per_reception',
         'sack_rate','scramble_rate','run_epa','run_success','ypc','run_explosive','stuff_rate','adot')

def pooled(rows,metric,field='metrics'):
    values=[r.get(field,{}).get(metric) for r in rows]
    values=[v for v in values if v and v.get('n',0)>0 and isfinite(v.get('sum',float('nan')))]
    n=sum(v['n'] for v in values)
    return {'value':sum(v['sum'] for v in values)/n if n else None,'n':n,'games':len(values)}


def profiles(games,week):
    history=[r for r in games if r['week']<week]
    defenses=sorted({r['opponent_team_id'] for r in history})
    league={m:pooled(history,m) for m in METRICS}
    typical={m:median([r['metrics'][m]['n'] for r in history if r['metrics'].get(m,{}).get('n',0)>0]) if any(r['metrics'].get(m,{}).get('n',0)>0 for r in history) else None for m in METRICS}
    adjusted_cache={}
    result={}
    for defense in defenses:
        faced=[r for r in history if r['opponent_team_id']==defense]
        metrics={}
        for metric in METRICS:
            raw=pooled(faced,metric)
            residual,total,adjusted_games=0.,0,0
            for game in faced:
                observation=game['metrics'].get(metric)
                if not observation or not observation['n']:
                    continue
                key=(game['team_id'],game['week'],defense,metric)
                if key not in adjusted_cache:
                    prior=[r for r in history if r['team_id']==game['team_id'] and r['week']<game['week'] and r['opponent_team_id']!=defense]
                    offense=pooled(prior,metric)
                    adjusted_cache[key]=offense
                offense=adjusted_cache[key]
                if offense['games']<2 or league[metric]['value'] is None or typical[metric] is None:
                    continue
                # A typical game of empirical league evidence stabilizes offense strength.
                strength=(offense['value']*offense['n']+league[metric]['value']*typical[metric])/(offense['n']+typical[metric])
                residual+=(observation['sum']/observation['n']-strength)*observation['n']
                total+=observation['n']; adjusted_games+=1
            value=league[metric]['value']+residual/total if total and adjusted_games>=3 else None
            metrics[metric]={**raw,'rawValue':raw['value'],'adjustedValue':value,'adjustedN':total,'adjustedGames':adjusted_games,
                             'adjustmentCoverage':total/raw['n'] if raw['n'] else 0,
                             'adjustment':'OFFENSE_STRENGTH_RESIDUAL' if value is not None else 'RAW_ONLY',
                             'priorExposure':4*typical[metric] if typical[metric] is not None else None}
        result[defense]={'teamId':defense,'metrics':metrics,'games':len(faced),'sampleWeeks':[r['week'] for r in faced]}
    reference={}
    for metric in METRICS:
        values=[p['metrics'][metric]['adjustedValue'] if p['metrics'][metric]['adjustedValue'] is not None else p['metrics'][metric]['rawValue'] for p in result.values()]
        values=[v for v in values if v is not None and isfinite(v)]
        reference[metric]={'mean':sum(values)/len(values) if len(values)>=8 else None,
                           'standardDeviation':pstdev(values) if len(values)>=8 else None,'teams':len(values)}
    return result,reference
