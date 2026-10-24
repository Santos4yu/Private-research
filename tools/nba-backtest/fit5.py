"""Do the new reads (who's out, rest, recent defense) predict beating his own
average on top of today's? Each fitted per season (signs must agree), then
scored out of sample against today's reads alone."""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit3.py').read().split('tables = {')[0])          # df, table(), STATS, col
extra = pd.read_pickle('extra.pkl').drop(columns=['team_abbreviation', 'opponent_team_abbreviation', 'season', 'pos'])
TODAY = {'pts': ['defense', 'pace', 'position'], 'reb': ['defense', 'position', 'rebAllowed'], 'ast': ['defense', 'pace', 'position', 'astAllowed'],
         'tpm': ['attempts'], 'stl': ['defense', 'position', 'turnovers'], 'blk': ['defense', 'pace', 'position']}
NEW = ['ownOut', 'ownOutPos', 'oppOut', 'oppOutPos', 'oppOutC', 'ownB2b', 'oppB2b', 'defense10', 'position10']

def frame(k):
    d = table(k).merge(extra, on=['game_id', 'athlete_id'], how='inner')
    pick = lambda prefix: np.select([d.pos == q for q in 'GFC'], [d[f'{prefix}{q}'].values for q in 'GFC'], np.nan)
    d['ownOut'] = d.own_out / 30; d['oppOut'] = d.opp_out / 30
    d['ownOutPos'] = pick('own_out') / 30; d['oppOutPos'] = pick('opp_out') / 30; d['oppOutC'] = d.opp_outC / 30
    d['ownB2b'] = d.own_b2b; d['oppB2b'] = d.opp_b2b
    d['defense10'] = (d.allowed10_z + d.rating10_z) / 2
    d['position10'] = np.select([d.pos == q for q in 'GFC'], [d[f'{q}10_{k}_z'].values for q in 'GFC'], np.nan)
    return d.dropna(subset=TODAY[k] + NEW)

tables = {k: frame(k) for k in STATS}
fit = lambda part, feats: LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part.y)
print('Each new read added to today\'s on its own: log-odds x 245 per unit (2024-25 / 2025-26)')
for k, d in tables.items():
    line = []
    for f in NEW:
        cs = [dict(zip(TODAY[k] + [f], fit(d[d.season == s], TODAY[k] + [f]).coef_[0]))[f] * 245 for s in (2025, 2026)]
        mark = '*' if np.sign(cs[0]) == np.sign(cs[1]) and min(abs(c) for c in cs) > 3 else ' '
        line.append(f'{f} {cs[0]:+.0f}/{cs[1]:+.0f}{mark}')
    print(f'  {k}: ' + '  '.join(line))
