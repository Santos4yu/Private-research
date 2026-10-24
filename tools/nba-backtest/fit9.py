"""Against a projection shaped like src/prop-model.js's (his per-minute
rate, recent games counting most, half-life 12; his minutes, half-life 4):
do hot shooting and teammates coming back still miss it?"""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('build3.py').read().split("\nif __name__")[0])
tables = pd.read_pickle('tables8.pkl')
SETS = {'pts': ['defense', 'pace', 'position', 'ownOutPos', 'ownOutOther', 'oppOutPos', 'oppOutOther', 'defense10'],
        'reb': ['position', 'rebAllowed', 'ownOutPos', 'ownOutOther', 'oppOutC', 'defense10'],
        'ast': ['pace', 'position', 'astAllowed', 'ownOutPos', 'ownOutOther', 'oppOut', 'defense10'],
        'tpm': ['attempts', 'ownOutPos', 'ownOutOther', 'defense10'], 'stl': ['defense', 'position', 'turnovers', 'ownOutPos', 'ownOutOther', 'oppOut'],
        'blk': ['defense', 'pace', 'position', 'oppOut']}
proj = []
for year in (2025, 2026):
    p = box(year)
    q = p[p.played].sort_values(['athlete_id', 'date']).copy()
    g = q.groupby('athlete_id')
    out = q[['game_id', 'athlete_id']].copy()
    minutes = g.minutes.transform(lambda s: s.shift().ewm(halflife=4).mean())
    used = g.minutes.transform(lambda s: s.shift().ewm(halflife=12).mean())
    for k, c in STATS.items():
        made = g[c].transform(lambda s: s.shift().ewm(halflife=12).mean())
        out[f'proj_{k}'] = made / used * minutes
    out['before'] = g.cumcount()
    proj.append(out)
proj = pd.concat(proj)
fit = lambda part, feats, y: LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part[y])
NEW = {'pts': ['backPos', 'backOther', 'hotFg', 'hot3'], 'reb': ['backPos'], 'ast': ['backPos', 'backOther', 'hotFg'], 'tpm': ['backPos', 'backOther', 'hot3'],
       'stl': ['backPos', 'backOther'], 'blk': ['backPos']}
for k, d in tables.items():
    d = d.merge(proj[['game_id', 'athlete_id', f'proj_{k}', 'before']], on=['game_id', 'athlete_id'], how='inner')
    d = d[d.before >= 5].copy()
    d['yM'] = (d[STATS[k]] > d[f'proj_{k}']).astype(int)
    feats = SETS[k] + NEW[k]
    a, b = (dict(zip(feats, fit(d[d.season == s], feats, 'yM').coef_[0])) for s in (2025, 2026))
    print(f'{k} vs model-like projection: ' + '  '.join(f'{f} {a[f] * 133:+.1f}/{b[f] * 133:+.1f}{"*" if np.sign(a[f]) == np.sign(b[f]) else " "}' for f in NEW[k]))
    for f in [f for f in ('hot3', 'hotFg') if f in NEW[k]]:
        q = d[f].quantile([0.1, 0.9])
        print(f'      {f}: hottest tenth beat it {d[d[f] >= q[0.9]].yM.mean():.3f}, coldest {d[d[f] <= q[0.1]].yM.mean():.3f}, all {d.yM.mean():.3f}')
    back = d.backPos + d.backOther
    print(f'      teammate back: {d[back > 0].yM.mean():.3f} vs {d[back == 0].yM.mean():.3f}')
