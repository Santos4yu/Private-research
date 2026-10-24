"""Rebound and assist chances: which of the opponent's numbers predict a
player beating his rebound / assist average, on top of today's reads?
Each team's season-to-date numbers the morning of every game, z across the
league (soft side up as named), fitted per season like fit5."""
import numpy as np, pandas as pd, warnings
from sklearn.linear_model import LogisticRegression
warnings.filterwarnings('ignore')
exec(open('fit7.py').read().split('\nfit = lambda')[0])
D = __import__('os').environ.get('NBA_DATA', 'data/')

def team_snapshots(year):
    t = pd.read_csv(D + f'team_box_{year}.csv', low_memory=False)
    t = t[t.season_type == 2].copy()
    t['date'] = pd.to_datetime(t.game_date)
    t['miss'] = t.field_goals_attempted - t.field_goals_made
    cols = ['field_goals_made', 'field_goals_attempted', 'miss', 'offensive_rebounds', 'defensive_rebounds', 'assists', 'turnovers', 'steals']
    o = t[['game_id', 'team_abbreviation'] + cols].rename(columns={c: 'o_' + c for c in cols + ['team_abbreviation']})
    m = t.merge(o, on='game_id'); m = m[m.team_abbreviation != m.o_team_abbreviation]
    out = []
    for day in sorted(m.date.unique()):
        before = m[m.date < day]
        if before.empty: continue
        g = before.groupby('team_abbreviation')
        s = pd.DataFrame({
            'theirMisses': g.miss.mean(),                                          # their own misses: his defensive chances
            'missesAllowed': g.o_miss.mean(),                                      # what opponents miss vs them
            'gameMisses': g.miss.mean() + g.o_miss.mean(),
            'theirOrebPct': g.offensive_rebounds.sum() / g.miss.sum(),             # they crash: fewer of their misses for him
            'orebAllowedPct': g.o_offensive_rebounds.sum() / g.o_miss.sum(),      # weak on their glass: his offensive chances
            'fgmAllowed': g.o_field_goals_made.mean(),
            'assistedAllowed': g.o_assists.sum() / g.o_field_goals_made.sum(),     # share of baskets vs them assisted
            'forcedTo': g.o_turnovers.mean(),                                       # turnovers they force
        })
        z = ((s - s.mean()) / s.std(ddof=0)).clip(-3, 3)
        z['date'] = day
        out.append(z.reset_index().rename(columns={'team_abbreviation': 'team'}))
    snap = pd.concat(out)
    games = t[['game_id', 'team_abbreviation', 'date']].rename(columns={'team_abbreviation': 'team'})
    return games.merge(snap, on=['team', 'date'])

snaps = pd.concat([team_snapshots(y).assign(season=y) for y in (2025, 2026)])
NEWS = {'reb': ['theirMisses', 'gameMisses', 'theirOrebPct', 'orebAllowedPct'], 'ast': ['fgmAllowed', 'assistedAllowed', 'forcedTo']}
fit = lambda part, feats: LogisticRegression(C=1e4, max_iter=2000).fit(part[feats], part.y)
for k, feats in NEWS.items():
    d = tables[k].merge(snaps.drop(columns=['date']).rename(columns={'team': 'opponent_team_abbreviation'}), on=['game_id', 'opponent_team_abbreviation', 'season'], how='inner')
    line = []
    for f in feats:
        cs = [dict(zip(SETS[k] + [f], fit(d[d.season == s], SETS[k] + [f]).coef_[0]))[f] * 133 for s in (2025, 2026)]
        mark = '*' if np.sign(cs[0]) == np.sign(cs[1]) and min(abs(c) for c in cs) > 1.5 else ' '
        line.append(f'{f} {cs[0]:+.1f}/{cs[1]:+.1f}{mark}')
    # On its own (no other reads), how strongly each one sorts overs: best third vs worst third.
    alone = []
    for f in feats:
        q = d[f].quantile([1 / 3, 2 / 3])
        alone.append(f'{f} {(d[d[f] >= q.iloc[1]].y.mean() - d[d[f] <= q.iloc[0]].y.mean()) * 100:+.1f}')
    print(f'{k} with today\'s reads (x133, 2024-25/2025-26): ' + '  '.join(line))
    print(f'{k} alone, top third vs bottom third (points of %): ' + '  '.join(alone))
