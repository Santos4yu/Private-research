"""How NBA picks in one game move together: the correlation (phi) between
two players each beating his own average, by how they're related (the same
player, teammates, opponents) and what each line measures (score: points or
threes, assist, board), per season."""
import numpy as np, pandas as pd, itertools
d = pd.read_pickle('games.pkl')
for k, c in {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'three_point_field_goals_made'}.items():
    d[f'y_{k}'] = (d[c] > d[f'base_{k}']).astype(float)
ROLE = {'pts': 'score', 'tpm': 'score', 'ast': 'assist', 'reb': 'board'}
cols = ['game_id', 'athlete_id', 'team_abbreviation', 'season', 'pos'] + [f'y_{k}' for k in ROLE]
d = d[cols]
pairs = d.merge(d, on=['game_id', 'season'], suffixes=('_a', '_b'))
pairs = pairs[pairs.athlete_id_a < pairs.athlete_id_b]
pairs['rel'] = np.where(pairs.team_abbreviation_a == pairs.team_abbreviation_b, 'team', 'opponents')
rows = []
for rel in ('team', 'opponents'):
    part = pairs[pairs.rel == rel]
    for a, b in itertools.combinations_with_replacement(['pts', 'tpm', 'ast', 'reb'], 2):
        for s in (2025, 2026):
            q = part[part.season == s]
            x = np.concatenate([q[f'y_{a}_a'], q[f'y_{b}_a']]); y = np.concatenate([q[f'y_{b}_b'], q[f'y_{a}_b']])
            rows.append({'rel': rel, 'pair': f'{a}|{b}', 'season': s, 'rho': np.corrcoef(x, y)[0, 1], 'n': len(q)})
same = []
for a, b in itertools.combinations(['pts', 'tpm', 'ast', 'reb'], 2):
    for s in (2025, 2026):
        q = d[d.season == s]
        same.append({'rel': 'same', 'pair': f'{a}|{b}', 'season': s, 'rho': np.corrcoef(q[f'y_{a}'], q[f'y_{b}'])[0, 1], 'n': len(q)})
t = pd.DataFrame(rows + same).pivot_table(index=['rel', 'pair'], columns='season', values='rho').round(3)
print(t.to_string())
# Guards and bigs on one team: a guard's assists with a big's points, a guard's points with a big's boards.
g = pairs[(pairs.rel == 'team')]
for pa, pb, sa, sb in (('G', 'C', 'ast', 'pts'), ('G', 'C', 'pts', 'reb'), ('G', 'G', 'pts', 'pts'), ('C', 'C', 'reb', 'reb'), ('G', 'F', 'ast', 'pts')):
    q1 = g[(g.pos_a == pa) & (g.pos_b == pb)]; q2 = g[(g.pos_a == pb) & (g.pos_b == pa)]
    x = np.concatenate([q1[f'y_{sa}_a'], q2[f'y_{sa}_b']]); y = np.concatenate([q1[f'y_{sb}_b'], q2[f'y_{sb}_a']])
    print(f'team {pa} {sa} with {pb} {sb}: {np.corrcoef(x, y)[0, 1]:+.3f} (n {len(x)})')
