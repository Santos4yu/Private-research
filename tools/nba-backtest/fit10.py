"""How far to pull a hot or cold shooter's projection back: his actual over
the model-like projection, regressed on his hot shooting (points: FG% and
3P%; threes: 3P%), per season. A coefficient c means the projection times
(1 + c x hot)."""
import numpy as np, pandas as pd, warnings
warnings.filterwarnings('ignore')
exec(open('fit9.py').read().split("\nfit = lambda")[0])
for k, feats in (('pts', ['hotFg', 'hot3']), ('tpm', ['hot3'])):
    d = tables[k].merge(proj[['game_id', 'athlete_id', f'proj_{k}', 'before']], on=['game_id', 'athlete_id'])
    d = d[(d.before >= 5) & (d[f'proj_{k}'] > 0.3)]
    # Sum-of-actual over sum-of-projected by hot bins says it without a model too.
    out = []
    for s in (2025, 2026):
        part = d[d.season == s]
        X = np.column_stack([np.ones(len(part))] + [part[f] for f in feats])
        w = part[f'proj_{k}'].values
        y = part[STATS[k]].values / w - 1
        coef = np.linalg.lstsq(X * np.sqrt(w)[:, None], y * np.sqrt(w), rcond=None)[0]
        out.append(dict(zip(['base'] + feats, coef.round(3))))
    print(k, out)
    f = feats[-1]
    d['bin'] = pd.qcut(d[f], 5, labels=False)
    print('   by fifth of', f, (d.groupby('bin')[STATS[k]].sum() / d.groupby('bin')[f'proj_{k}'].sum()).round(3).tolist(), 'hot range', d.groupby('bin')[f].mean().round(3).tolist())
