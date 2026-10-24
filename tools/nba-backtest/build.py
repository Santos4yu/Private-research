"""Every regular-season player-game of 2024-25 and 2025-26 with what was known about his opponent
before tip-off (the reads nba-matchup-score.js can make, z across teams, soft side up) and whether
he beat his own average (season so far, last season worth LAST games of it)."""
import os
import numpy as np, pandas as pd
# The sportsdataverse box scores (player_box_YYYY.csv, team_box_YYYY.csv), from NBA_DATA.
D = os.environ.get('NBA_DATA', 'data/')
POS = {'G': 'G', 'PG': 'G', 'SG': 'G', 'F': 'F', 'SF': 'F', 'PF': 'F', 'C': 'C'}
STATS = {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'three_point_field_goals_made', 'stl': 'steals', 'blk': 'blocks'}
LAST = 10

def teams(year):
    t = pd.read_csv(D + f'team_box_{year}.csv', low_memory=False)
    t = t[t.season_type == 2]
    keep = t.team_abbreviation.value_counts(); keep = keep[keep >= 50].index
    t = t[t.team_abbreviation.isin(keep)].copy()
    t['poss'] = t.field_goals_attempted + 0.44 * t.free_throws_attempted - t.offensive_rebounds + t.turnovers
    t['miss'] = t.field_goals_attempted - t.field_goals_made
    cols = ['team_score', 'poss', 'field_goals_made', 'field_goals_attempted', 'three_point_field_goals_made', 'three_point_field_goals_attempted',
            'free_throws_attempted', 'assists', 'total_rebounds', 'turnovers', 'miss']
    o = t[['game_id', 'team_abbreviation'] + cols].rename(columns={c: 'o_' + c for c in cols + ['team_abbreviation']})
    m = t.merge(o, on='game_id'); m = m[m.team_abbreviation != m.o_team_abbreviation]
    m['date'] = pd.to_datetime(m.game_date)
    return m

def players(year, games):
    p = pd.read_csv(D + f'player_box_{year}.csv', low_memory=False)
    p = p[(p.season_type == 2) & (p.did_not_play != True) & p.minutes.notna() & (p.minutes > 0) & p.game_id.isin(games)].copy()
    p['pos'] = p.athlete_position_abbreviation.map(POS)
    p['date'] = pd.to_datetime(p.game_date)
    return p

def snapshots(m, p):
    """Each team's defense as it stood the morning of every date: z across the league, soft up."""
    out = []
    for day in sorted(m.date.unique()):
        before = m[m.date < day]
        if before.empty: continue
        g = before.groupby('team_abbreviation')
        s = pd.DataFrame({'games': g.size(), 'allowed': g.o_team_score.mean(), 'rating': g.o_team_score.sum() / g.o_poss.sum() * 100,
                          'pace': (g.poss.mean() + g.o_poss.mean()) / 2,
                          'shooting': g.o_three_point_field_goals_made.sum() / g.o_three_point_field_goals_attempted.sum(),
                          'attempts': g.o_three_point_field_goals_attempted.mean(),
                          'finishing': g.o_field_goals_made.sum() / g.o_field_goals_attempted.sum(),
                          'turnovers': g.turnovers.mean(), 'astAllowed': g.o_assists.mean(), 'rebAllowed': g.o_total_rebounds.mean(),
                          'gameMiss': g.miss.mean() + g.o_miss.mean(), 'theirShots': g.field_goals_attempted.mean(),
                          'ftaAllowed': g.o_free_throws_attempted.mean()})
        pb = p[p.date < day]
        for pos in 'GFC':
            q = pb[pb.pos == pos]
            e = q.groupby('opponent_team_abbreviation')[list(STATS.values())].mean()
            sums = q.groupby('opponent_team_abbreviation')[list(STATS.values()) + ['minutes']].sum()
            tot = q.groupby(['opponent_team_abbreviation', 'game_id'])[list(STATS.values())].sum().groupby(level=0).mean()
            for k, c in STATS.items():
                s[f'{pos}_{k}'] = e[c]
                s[f'{pos}36_{k}'] = sums[c] / sums.minutes * 36
                s[f'{pos}t_{k}'] = tot[c]
        z = (s - s.mean()) / s.std(ddof=0)
        z = z.clip(-3, 3); z['games'] = s.games
        z['date'] = day
        out.append(z.reset_index().rename(columns={'index': 'team', 'team_abbreviation': 'team'}))
    return pd.concat(out)

def season(year):
    m = teams(year); p = players(year, set(m.game_id))
    last = players(year - 1, set(teams(year - 1).game_id))
    prior = last.groupby('athlete_id')[list(STATS.values()) + ['minutes']].mean()
    snap = snapshots(m, p)
    p = p.sort_values(['athlete_id', 'date'])
    rows = []
    for k, c in {**STATS, 'min': 'minutes'}.items():
        g = p.groupby('athlete_id')[c]
        p[f'sum_{k}'] = g.cumsum() - p[c]
    p['n'] = p.groupby('athlete_id').cumcount()
    p = p.join(prior.add_prefix('last_'), on='athlete_id')
    has_last = p['last_minutes'].notna()
    w = np.where(has_last, LAST, 0)
    for k, c in {**STATS, 'min': 'minutes'}.items():
        lastv = p[f'last_{c}'].fillna(0)
        p[f'base_{k}'] = (p[f'sum_{k}'] + w * lastv) / (p.n + w).replace(0, np.nan)
    keep = ((p.n >= 3) | has_last) & (p.base_min >= 15) & p.pos.notna()
    p = p[keep]
    p = p.merge(snap, left_on=['date', 'opponent_team_abbreviation'], right_on=['date', 'team'], how='inner', suffixes=('', '_opp'))
    p = p[p.games >= 8]
    p['season'] = year
    return p

if __name__ == '__main__':
    frames = [season(y) for y in (2025, 2026)]
    df = pd.concat(frames)
    df.to_pickle('games.pkl')
    print(len(df), 'player-games', df.groupby('season').size().to_dict(), df.pos.value_counts().to_dict())
