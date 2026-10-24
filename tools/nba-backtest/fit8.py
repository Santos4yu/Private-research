"""Teammates coming back and hot shooting, on top of the current reads
(fit7's, centred): per season, against beating his average (the score's
target) and against beating his last-10 average (the line proxy)."""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit7.py').read().split('\nfit = lambda')[0])
extra3 = pd.read_pickle('extra3.pkl')
fit = lambda part, feats, y: LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part[y])
NEW = {'pts': ['backPos', 'backOther', 'hotFg', 'hot3'], 'reb': ['backPos', 'backOther'], 'ast': ['backPos', 'backOther', 'hotFg'],
       'tpm': ['backPos', 'backOther', 'hot3'], 'stl': ['backPos', 'backOther'], 'blk': ['backPos', 'backOther']}
for k, d in tables.items():
    d = d.merge(extra3, on=['game_id', 'athlete_id'], how='inner')
    pick = lambda prefix: np.select([d.pos == q for q in 'GFC'], [d[f'{prefix}{q}'].values for q in 'GFC'], 0.0)
    d['backPos'] = pick('back') / 30
    d['backOther'] = (d.backG + d.backF + d.backC) / 30 - d.backPos
    d['y10'] = (d[STATS[k]] > d[f'last10_{k}']).astype(int)
    d = d.dropna(subset=[f'last10_{k}', 'hotFg', 'hot3'])
    tables[k] = d
    for target in ('y', 'y10'):
        feats = SETS[k] + NEW[k]
        a, b = (dict(zip(feats, fit(d[d.season == s], feats, target).coef_[0])) for s in (2025, 2026))
        print(f'{k} {target:3}: ' + '  '.join(f'{f} {a[f] * 133:+.1f}/{b[f] * 133:+.1f}{"*" if np.sign(a[f]) == np.sign(b[f]) else " "}' for f in NEW[k]))
    back = d.backPos + d.backOther
    print(f'      a teammate back: beat last-10 {d[back > 0].y10.mean():.3f} vs {d[back == 0].y10.mean():.3f}; beat average {d[back > 0].y.mean():.3f} vs {d[back == 0].y.mean():.3f}')
    if 'hot3' in NEW[k]:
        q = d.hot3.quantile([0.1, 0.9])
        print(f'      hottest tenth from three: beat last-10 {d[d.hot3 >= q[0.9]].y10.mean():.3f}, coldest {d[d.hot3 <= q[0.1]].y10.mean():.3f}; beat average {d[d.hot3 >= q[0.9]].y.mean():.3f} / {d[d.hot3 <= q[0.1]].y.mean():.3f}')
pd.to_pickle(tables, 'tables8.pkl')
