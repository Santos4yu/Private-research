"""The final reads, fitted together. Who's out is in 30-minute units (a
starter's minutes) taken off a usual night's (CENTRES), so a night with the
usual absences reads even; the opponent's back-to-back likewise. Prints
per-season signs, pooled weights x K (top 2.5% at 90+), the centres, and the
out-of-sample bands against today's reads."""
import json, numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit5.py').read().split('\ntables = {k: frame(k)')[0])
tables = {k: frame(k) for k in STATS}
for d in tables.values():
    d['ownOutOther'] = d.ownOut - d.ownOutPos
    d['oppOutOther'] = d.oppOut - d.oppOutPos
SETS = {
    'pts': ['defense', 'pace', 'position', 'ownOutPos', 'ownOutOther', 'oppOutPos', 'oppOutOther', 'defense10'],
    'reb': ['position', 'rebAllowed', 'ownOutPos', 'ownOutOther', 'oppOutC', 'oppB2b', 'defense10'],
    'ast': ['pace', 'position', 'astAllowed', 'ownOutPos', 'ownOutOther', 'oppOut', 'defense10'],
    'tpm': ['attempts', 'ownOutPos', 'ownOutOther', 'defense10'],
    'stl': ['defense', 'position', 'turnovers', 'ownOutPos', 'ownOutOther', 'oppOut'],
    'blk': ['defense', 'pace', 'position', 'oppOut'],
}
CENTRED = ['ownOutPos', 'ownOutOther', 'oppOutPos', 'oppOutOther', 'oppOut', 'oppOutC', 'oppB2b', 'ownOut']
everyone = pd.concat(tables.values())
# Each player's own position's centre differs (a guard's teammates-at-his-position vs a center's): by position.
centres = {f: {q: float(everyone[everyone.pos == q][f].mean()) for q in 'GFC'} for f in ['ownOutPos', 'oppOutPos']}
centres.update({f: float(everyone[f].mean()) for f in ['ownOutOther', 'oppOutOther', 'oppOut', 'oppOutC', 'oppB2b']})
for k, d in tables.items():
    for f in ['ownOutPos', 'oppOutPos']:
        d[f] = d[f] - d.pos.map(centres[f])
    for f in ['ownOutOther', 'oppOutOther', 'oppOut', 'oppOutC', 'oppB2b']:
        d[f] = d[f] - centres[f]
fit = lambda part, feats: LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part.y)
print('per season, log-odds x 245:')
for k, d in tables.items():
    a, b = (dict(zip(SETS[k], fit(d[d.season == s], SETS[k]).coef_[0])) for s in (2025, 2026))
    print(f'  {k}: ' + '  '.join(f'{f} {a[f] * 245:+.0f}/{b[f] * 245:+.0f}{"" if np.sign(a[f]) == np.sign(b[f]) else " !"}' for f in SETS[k]))

def logodds(d, fitted_on):
    part = d if fitted_on is None else d[d.season == fitted_on]
    m = fit(part, SETS[d.stat.iloc[0]])
    return d[SETS[d.stat.iloc[0]]].values @ m.coef_[0], dict(zip(SETS[d.stat.iloc[0]], m.coef_[0]))
pooled = {k: logodds(d, None) for k, d in tables.items()}
allLO = np.concatenate([lo for lo, _ in pooled.values()])
K = 50 * np.arctanh(0.8) / np.quantile(allLO, 0.975)
rows = []
for k, d in tables.items():
    base = d.groupby('season').y.transform('mean')
    for a, b in ((2025, 2026), (2026, 2025)):
        lo, _ = logodds(d, a)
        sel = (d.season == b).values
        rows.append(pd.DataFrame({'score': 50 + 50 * np.tanh(K * lo[sel] / 50), 'y': d.y.values[sel], 'base': base.values[sel], 'stat': k}))
rows = pd.concat(rows)
print(f'\nK {K:.1f}; out of sample: share of props, beat-average edge (points of %)')
for lo_, hi in [(90, 101), (75, 90), (60, 75), (40, 60), (25, 40), (0, 25)]:
    sel = rows[(rows.score >= lo_) & (rows.score < hi)]
    print(f'   {lo_:>2}-{hi - 1:<3} {len(sel) / len(rows) * 100:5.1f}%   {(sel.y - sel.base).mean() * 100:+5.1f}')
q = rows.score.quantile([0.1, 0.9])
print(f'   best 10% vs worst 10%: {(rows[rows.score >= q[0.9]].y.mean() - rows[rows.score <= q[0.1]].y.mean()) * 100:.1f} points of % apart')
for k in STATS:
    r = rows[rows.stat == k]; q = r.score.quantile([0.1, 0.9])
    print(f'     {k}: best 10% vs worst 10% {(r[r.score >= q[0.9]].y.mean() - r[r.score <= q[0.1]].y.mean()) * 100:.1f}')
weights = {k: {f: round(v * K, 1) for f, v in c.items()} for k, (_, c) in pooled.items()}
print('weights:', json.dumps(weights))
print('centres:', json.dumps({k: (round(v, 3) if isinstance(v, float) else {q: round(x, 3) for q, x in v.items()}) for k, v in centres.items()}))
json.dump({'K': K, 'weights': weights, 'centres': centres}, open('weights_v2.json', 'w'), indent=1)
