"""Combos (PR, PA, RA, PRA): his parts' scores averaged evenly (today) or
weighted by each part's share of his usual total. Which tells overs of the
combo (beat his usual total) apart better, out of sample?"""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit7.py').read().split('\nfit = lambda')[0])
SETS['tpm'] = ['attempts', 'ownOutPos', 'ownOutOther', 'defense10']
fit = lambda part, feats: LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part.y)
lo = {}
for k in ('pts', 'reb', 'ast'):
    d = tables[k]
    parts = []
    for a, b in ((2025, 2026), (2026, 2025)):
        m = fit(d[d.season == a], SETS[k]); sel = d[d.season == b]
        parts.append(pd.DataFrame({'game_id': sel.game_id.values, 'athlete_id': sel.athlete_id.values, f'lo_{k}': sel[SETS[k]].values @ m.coef_[0],
                                   f'v_{k}': sel[STATS[k]].values, f'b_{k}': sel[f'base_{k}'].values}))
    lo[k] = pd.concat(parts)
m = lo['pts'].merge(lo['reb'], on=['game_id', 'athlete_id']).merge(lo['ast'], on=['game_id', 'athlete_id'])
for combo in (('pts', 'reb'), ('pts', 'ast'), ('reb', 'ast'), ('pts', 'reb', 'ast')):
    y = (sum(m[f'v_{k}'] for k in combo) > sum(m[f'b_{k}'] for k in combo)).astype(int)
    even = sum(m[f'lo_{k}'] for k in combo) / len(combo)
    total = sum(m[f'b_{k}'] for k in combo)
    weighted = sum(m[f'lo_{k}'] * m[f'b_{k}'] / total for k in combo)
    def spread(score):
        q = score.quantile([0.1, 0.9]); return (y[score >= q[0.9]].mean() - y[score <= q[0.1]].mean()) * 100
    print('+'.join(combo), f'even {spread(even):.1f}  weighted by his mix {spread(weighted):.1f}  (best 10% vs worst 10%, points of %)')
