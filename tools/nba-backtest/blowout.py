"""The game line (2025-26 only: ESPN keeps no lines for 2024-25; 980 of its
games, odds.csv from the nba-odds-history check): does a big spread (a
blowout risk) or a high total / team total say anything the current reads
and his recent games don't? Per half of the season (sign held in both).

  blow     |spread| beyond 7, in 10s (the prop model's current guess)
  spread   |spread| in 10s
  fav      his team's spread, favorite positive, in 10s
  own      his team's implied points (total less spread, halved) against
           what it has scored a game this season, in 10s
  total    the game total against 230, in 10s

Against beating his average (y), his last 10 (y10) and a model-like
projection (yM), for starters' minutes (28+ a game) and the rest."""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit9.py').read().split("\nfit = lambda")[0])
odds = pd.read_csv('odds.csv').dropna(subset=['home_spread', 'total']).rename(columns={'event': 'game_id'})
fit = lambda part, feats, y: LogisticRegression(C=1e4, max_iter=3000).fit(part[feats], part[y])
NEW = ['blow', 'fav', 'own', 'total']
for k, d in tables.items():
    d = d[d.season == 2026].copy()
    d['game_id'] = d.game_id.astype(int)
    d = d.merge(odds[['game_id', 'home_spread', 'total']], on='game_id', how='inner')
    d = d.merge(proj[['game_id', 'athlete_id', f'proj_{k}', 'before']].assign(game_id=lambda f: f.game_id.astype(int)), on=['game_id', 'athlete_id'], how='inner')
    d = d[d.before >= 5].copy()
    d['yM'] = (d[STATS[k]] > d[f'proj_{k}']).astype(int)
    spread = np.where(d.home_away == 'home', d.home_spread, -d.home_spread)
    d['fav'] = -spread / 10
    d['spread'] = np.abs(spread) / 10
    d['blow'] = np.maximum(np.abs(spread) - 7, 0) / 10
    # What his team has scored a game this season before tonight.
    teams = d[['game_id', 'team_abbreviation', 'date', 'team_score']].drop_duplicates(['game_id', 'team_abbreviation']).sort_values('date')
    teams['scored'] = teams.groupby('team_abbreviation').team_score.transform(lambda s: s.shift().expanding().mean())
    d = d.merge(teams[['game_id', 'team_abbreviation', 'scored']], on=['game_id', 'team_abbreviation'])
    d['own'] = ((d.total - spread) / 2 - d.scored) / 10
    d['total'] = (d.total - 230) / 10
    d = d.dropna(subset=['own', f'last10_{k}'])
    d['y10'] = (d[STATS[k]] > d[f'last10_{k}']).astype(int)
    half = d.date < d.date.median()
    if k == 'pts':
        g = d.drop_duplicates(['game_id', 'team_abbreviation'])
        print('check: corr(fav, margin) =', round(np.corrcoef(g.fav, g.team_score - g.opponent_team_score)[0, 1], 3), '| rows', len(d))
    for role, part in (('starters', d[d.base_min >= 28]), ('rest', d[d.base_min < 28])):
        h = part.date < d.date.median()
        line = []
        for target in ('y', 'y10', 'yM'):
            feats = SETS[k] + NEW
            a, b = (dict(zip(feats, fit(part[m], feats, target).coef_[0])) for m in (h, ~h))
            line.append(f'{target}: ' + ' '.join(f'{f} {a[f] * 133:+.1f}/{b[f] * 133:+.1f}{"*" if np.sign(a[f]) == np.sign(b[f]) else " "}' for f in NEW))
        big = part.spread >= 1.0
        mins = (part.minutes - part.base_min)
        print(f'{k} {role:8} n {len(part):5} | 10+ spread: {big.mean():.2f} of games, minutes {mins[big].mean():+.2f} vs {mins[~big].mean():+.2f}, '
              f'beat avg {part[big].y.mean():.3f} vs {part[~big].y.mean():.3f}, beat proj {part[big].yM.mean():.3f} vs {part[~big].yM.mean():.3f}')
        for item in line:
            print('     ', item)
    tables[k] = d
pd.to_pickle(tables, 'tables_odds.pkl')
