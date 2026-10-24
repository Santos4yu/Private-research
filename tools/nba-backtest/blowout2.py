"""How far a blowout risk moves a projection: his actual over the
model-like projection (fit9), least squares on blow (|spread| beyond 7, in
10s) and own (his team's implied points against its scoring, in 10s), by
minutes role, per half of 2025-26. c means the projection times (1 + c x
blow). Also his minutes against his usual by spread."""
import numpy as np, pandas as pd
tables = pd.read_pickle('tables_odds.pkl')
STATS = {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'three_point_field_goals_made', 'stl': 'steals', 'blk': 'blocks'}
for k, d in tables.items():
    d = d[d[f'proj_{k}'] > 0.3]
    for role, part in (('starters', d[d.base_min >= 28]), ('rest', d[d.base_min < 28])):
        out = []
        for h in (part.date < d.date.median(), part.date >= d.date.median()):
            q = part[h]
            X = np.column_stack([np.ones(len(q)), q.blow, q.own])
            w = q[f'proj_{k}'].values
            y = q[STATS[k]].values / w - 1
            out.append(np.linalg.lstsq(X * np.sqrt(w)[:, None], y * np.sqrt(w), rcond=None)[0].round(3).tolist())
        bins = pd.cut(part.spread * 10, [0, 4, 7, 10, 13, 30])
        ratio = (part.groupby(bins)[STATS[k]].sum() / part.groupby(bins)[f'proj_{k}'].sum()).round(3).tolist()
        print(f'{k} {role:8} [base, blow, own] halves {out[0]} {out[1]} | actual/proj by spread 0-4,4-7,7-10,10-13,13+: {ratio}')
d = tables['pts']
for role, part in (('starters', d[d.base_min >= 28]), ('rest', d[d.base_min < 28])):
    bins = pd.cut(part.spread * 10, [0, 4, 7, 10, 13, 30])
    print(role, 'minutes vs usual by spread', (part.minutes - part.base_min).groupby(bins).mean().round(2).tolist(), 'n', part.groupby(bins).size().tolist())
