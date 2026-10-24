import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
df = pd.read_pickle('games.pkl')
col = lambda name: name + '_opp' if name + '_opp' in df.columns else name
STATS = {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'three_point_field_goals_made', 'stl': 'steals', 'blk': 'blocks'}
FEATS = {'pts': ['defense', 'pace', 'position'], 'reb': ['defense', 'pace', 'position', 'rebAllowed'],
         'ast': ['defense', 'pace', 'position', 'astAllowed'], 'tpm': ['defense', 'pace', 'position', 'attempts'],
         'stl': ['defense', 'pace', 'position', 'turnovers'], 'blk': ['defense', 'pace', 'position']}

def table(k):
    d = df.copy()
    d['y'] = (d[STATS[k]] > d[f'base_{k}']).astype(int)
    d['position'] = np.select([d.pos == q for q in 'GFC'], [d[f'{q}_{k}'].values for q in 'GFC'], np.nan)
    d['defense'] = (d[col('allowed')] + d[col('rating')]) / 2
    for name in ['pace', 'rebAllowed', 'astAllowed', 'attempts', 'turnovers']: d[name] = d[col(name)]
    d['stat'] = k
    return d.dropna(subset=['position'])

tables = {k: table(k) for k in STATS}
coef = {}
for k, d in tables.items():
    by = {}
    for label, part in (('2024-25', d[d.season == 2025]), ('2025-26', d[d.season == 2026]), ('both', d)):
        m = LogisticRegression(C=1e4, max_iter=1000).fit(part[FEATS[k]], part.y)
        by[label] = dict(zip(FEATS[k], m.coef_[0]))
    coef[k] = by
    print(k, {lab: {f: round(v * 140, 1) for f, v in c.items()} for lab, c in by.items()})
pd.to_pickle(coef, 'coef.pkl')
