"""2023 coefficient fit, 2024 feature screen, untouched 2025 final evaluation.

Diagnostic efficiency regressions evaluate features, not player prop models.
"""
import json
from math import sqrt
from pathlib import Path
from .services.matchup_data import season_data
from .matchup_profiles import profiles,pooled

CANDIDATES={'pass_epa':'ypa','run_epa':'ypc','completion_rate':'completion_rate','sack_rate':'sack_rate',
            'yac_per_reception':'yac_per_reception','pass_explosive':'pass_explosive','run_explosive':'run_explosive'}

def observations(season):
    games=season_data(season)['games']
    points={m:[] for m in CANDIDATES}
    for week in sorted({g['week'] for g in games if g['week']>=6}):
        defensive,reference=profiles(games,week)
        for game in [g for g in games if g['week']==week]:
            defense=defensive.get(game['opponent_team_id'])
            offense=[g for g in games if g['team_id']==game['team_id'] and g['week']<week]
            if not defense:
                continue
            for feature,target in CANDIDATES.items():
                m=defense['metrics'][feature]; ref=reference[feature]
                value=m['adjustedValue'] if m['adjustedValue'] is not None else m['rawValue']
                actual=game['metrics'].get(target); baseline=pooled(offense,target)
                if value is None or ref['mean'] is None or not actual or not actual['n'] or baseline['games']<4 or m['games']<4:
                    continue
                points[feature].append((value-ref['mean'],actual['sum']/actual['n']-baseline['value']))
    return points

def correlation(points):
    if len(points)<3:
        return None
    x=sum(x for x,y in points)/len(points); y=sum(y for x,y in points)/len(points)
    cross=sum((a-x)*(b-y) for a,b in points)
    denom=sqrt(sum((a-x)**2 for a,b in points)*sum((b-y)**2 for a,b in points))
    return cross/denom if denom else None

def evaluate(points,slope):
    if not points:
        return {'n':0,'baselineMAE':None,'featureMAE':None,'correlation':None}
    return {'n':len(points),'baselineMAE':sum(abs(y) for x,y in points)/len(points),
            'featureMAE':sum(abs(y-slope*x) for x,y in points)/len(points),'correlation':correlation(points)}

def validate():
    train=observations(2023); screen=observations(2024); final=observations(2025)
    result={}; policy={}
    for feature in CANDIDATES:
        denominator=sum(x*x for x,y in train[feature])
        slope=sum(x*y for x,y in train[feature])/denominator if denominator else 0
        screening=evaluate(screen[feature],slope); evaluation=evaluate(final[feature],slope)
        selected=slope>0 and screening['n']>=100 and screening['featureMAE']<screening['baselineMAE']
        retained=selected and evaluation['featureMAE'] is not None and evaluation['featureMAE']<evaluation['baselineMAE']
        # A final negative check can disable a feature, never increase/tune weight.
        policy[feature]=retained
        result[feature]={'targetMetric':CANDIDATES[feature],'trainingN':len(train[feature]),'frozenSlope':slope,
                         'screen2024':screening,'final2025':evaluation,'selectedBeforeFinal':selected,'enabled':retained}
    return {'method':'2023 frozen diagnostic slopes; 2024 selects; 2025 final check can only disable, never tune',
            'features':result,'policy':policy,
            'limitations':['Team efficiency validation, not receiver-specific outcome validation',
                           'Corrected releases, not historical provider snapshots','No current coverage/routes/pressure charting to validate',
                           'No inference of betting probabilities','Final veto means an additional untouched season is needed for post-veto policy validation']}

if __name__=='__main__':
    result=validate()
    root=Path(__file__).resolve().parents[3]
    (root/'docs/nfl-matchup-backtest-results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
    (Path(__file__).parent/'matchup_policy.json').write_text(json.dumps({'version':'screened-v1','enabled':result['policy']},indent=2),encoding='utf-8')
    print(json.dumps(result,indent=2))
