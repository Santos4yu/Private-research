"""Does a player's record against tonight's opponent (his last 3 meetings, any of the last 3 seasons,
against his usual) predict whether he beats his average, on top of the team reads?"""
import os
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss
warnings.filterwarnings('ignore')
exec(open('fit3.py').read().split('tables = {')[0])          # table(), STATS
# The sportsdataverse box scores (player_box_YYYY.csv, team_box_YYYY.csv), from NBA_DATA.
D = os.environ.get('NBA_DATA', 'data/')
box = pd.concat([pd.read_csv(D + f'player_box_{y}.csv', low_memory=False) for y in (2024, 2025, 2026)])
box = box[(box.season_type == 2) & (box.did_not_play != True) & (box.minutes > 0)][['athlete_id', 'game_id', 'game_date', 'opponent_team_abbreviation'] + list(STATS.values())]
box['date'] = pd.to_datetime(box.game_date)
box = box.sort_values('date')
KEEP = {'pts': ['defense', 'pace', 'position'], 'reb': ['defense', 'position', 'rebAllowed'], 'ast': ['defense', 'pace', 'position', 'astAllowed'],
        'tpm': ['attempts'], 'stl': ['defense', 'position', 'turnovers'], 'blk': ['defense', 'pace', 'position']}
for k, c in STATS.items():
    d = table(k)
    # his last 3 games against this opponent before tonight (any season), shrunk n/(n+3), vs his usual
    g = box.groupby(['athlete_id', 'opponent_team_abbreviation'])[c]
    box['h_sum'] = g.transform(lambda s: s.shift().rolling(3, min_periods=1).sum())
    box['h_n'] = g.transform(lambda s: s.shift().rolling(3, min_periods=1).count())
    d = d.merge(box[['athlete_id', 'game_id', 'h_sum', 'h_n']], on=['athlete_id', 'game_id'], how='left')
    base = d[f'base_{k}'].clip(lower=0.25)
    d['h2h'] = np.where(d.h_n > 0, (d.h_sum / d.h_n / base - 1).clip(-1, 1) * d.h_n / (d.h_n + 3), 0).astype(float)
    gains = {}
    for feats in (KEEP[k], KEEP[k] + ['h2h']):
        out = []
        for a, b in ((2025, 2026), (2026, 2025)):
            tr, te = d[d.season == a], d[d.season == b]
            m = LogisticRegression(C=1e4, max_iter=1000).fit(tr[feats], tr.y)
            out.append(1000 * (log_loss(te.y, np.full(len(te), tr.y.mean())) - log_loss(te.y, m.predict_proba(te[feats])[:, 1])))
            if 'h2h' in feats: gains.setdefault('coef', []).append(round(m.coef_[0][-1], 3))
        gains[len(feats)] = np.mean(out)
    print(f'{k}: {int((d.h_n > 0).mean() * 100)}% of games have a past meeting | team reads alone {gains[len(KEEP[k])]:.2f}/1000, '
          f'+ his games vs them {gains[len(KEEP[k]) + 1]:.2f}/1000 | its log-odds each season {gains["coef"]}')
