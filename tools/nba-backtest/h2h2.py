import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit7.py').read().split('\nfit = lambda')[0])
K = 133.1
for k in ('tpm', 'blk'):
    h = pd.read_pickle(f'h2h_{k}.pkl')[['athlete_id', 'game_id', 'h2h', 'form10']]
    d = tables[k].merge(h, on=['athlete_id', 'game_id'], how='inner')
    feats = SETS[k] + ['form10', 'h2h']
    out = {}
    for label, part in (('2024-25', d[d.season == 2025]), ('2025-26', d[d.season == 2026]), ('both', d)):
        m = LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part.y)
        out[label] = round(m.coef_[0][-1] * K, 1)
    print(k, 'h2h points per unit at the new scale:', out, '| centre', round(d.h2h.mean(), 3), 'spread', round(d.h2h.std(), 3))
