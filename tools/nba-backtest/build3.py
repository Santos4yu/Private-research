"""More reads for every player-game in games.pkl, before tip-off:

  returning   teammates back tonight after missing their team's last 3
              games (20+ minutes a game when they played this season, 5+
              games): their minutes, at his position and elsewhere
  hot         his shooting over his last 10 games against his usual
              (this season so far, last season worth 10 games): FG% and
              3P%, shrunk by the tries behind them
  last10      his average over his last 10 games in each stat (the line
              proxy: PrizePicks' lines lean on recent games)

Saved as extra3.pkl keyed by (game_id, athlete_id)."""
import os
import numpy as np, pandas as pd
D = os.environ.get('NBA_DATA', 'data/')
POS = {'G': 'G', 'PG': 'G', 'SG': 'G', 'F': 'F', 'SF': 'F', 'PF': 'F', 'C': 'C'}
STATS = {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'three_point_field_goals_made', 'stl': 'steals', 'blk': 'blocks'}
SHOTS = ['field_goals_made', 'field_goals_attempted', 'three_point_field_goals_made', 'three_point_field_goals_attempted']


def box(year):
    p = pd.read_csv(D + f'player_box_{year}.csv', low_memory=False)
    p = p[p.season_type == 2].copy()
    p['date'] = pd.to_datetime(p.game_date)
    p['pos'] = p.athlete_position_abbreviation.map(POS)
    p['played'] = (p.did_not_play != True) & p.minutes.notna() & (p.minutes > 0)
    return p


def returning(p):
    """team-game -> minutes of teammates back tonight after 3+ games out, by position."""
    played = p[p.played]
    pos_of = p.dropna(subset=['pos']).groupby('athlete_id').pos.agg(lambda s: s.mode().iloc[0])
    games = p[['game_id', 'team_abbreviation', 'date']].drop_duplicates().sort_values('date')
    on = {k: set(v) for k, v in played.groupby(['game_id', 'team_abbreviation']).athlete_id}
    mins = played.set_index(['game_id', 'team_abbreviation', 'athlete_id']).minutes
    rows = []
    for team, tg in games.groupby('team_abbreviation'):
        ids = list(tg.sort_values('date').game_id)
        count, total = {}, {}
        for i, gid in enumerate(ids):
            tonight = on.get((gid, team), set())
            last3 = set().union(*(on.get((g, team), set()) for g in ids[max(0, i - 3):i])) if i >= 3 else None
            back = {'G': 0.0, 'F': 0.0, 'C': 0.0}
            if last3 is not None:
                for a in tonight:
                    n = count.get(a, 0)
                    if n >= 5 and a not in last3 and total[a] / n >= 20:
                        back[pos_of.get(a, 'F')] += total[a] / n
            rows.append({'game_id': gid, 'team': team, 'backG': back['G'], 'backF': back['F'], 'backC': back['C']})
            for a in tonight:
                count[a] = count.get(a, 0) + 1
                total[a] = total.get(a, 0) + mins.get((gid, team, a), 0)
    return pd.DataFrame(rows)


def form(p, prior):
    """His last 10 games' averages and shooting against his usual, before each game."""
    q = p[p.played].sort_values(['athlete_id', 'date']).copy()
    g = q.groupby('athlete_id')
    out = q[['game_id', 'athlete_id']].copy()
    for k, c in STATS.items():
        out[f'last10_{k}'] = g[c].transform(lambda s: s.shift().rolling(10, min_periods=5).mean())
    for c in SHOTS:
        q[f'cum_{c}'] = g[c].cumsum() - q[c]
        q[f'r10_{c}'] = g[c].transform(lambda s: s.shift().rolling(10, min_periods=5).sum())
    q = q.join(prior, on='athlete_id')
    w = 10  # last season's games counted, as games.pkl's average
    for made, tries, name, shrink in (('field_goals_made', 'field_goals_attempted', 'hotFg', 60), ('three_point_field_goals_made', 'three_point_field_goals_attempted', 'hot3', 25)):
        usual = (q[f'cum_{made}'] + w * q[f'last_{made}'].fillna(0)) / (q[f'cum_{tries}'] + w * q[f'last_{tries}'].fillna(0)).replace(0, np.nan)
        recent = q[f'r10_{made}'] / q[f'r10_{tries}'].replace(0, np.nan)
        out[name] = ((recent - usual) * q[f'r10_{tries}'] / (q[f'r10_{tries}'] + shrink)).fillna(0)
    return out


if __name__ == '__main__':
    base = pd.read_pickle('games.pkl')[['game_id', 'athlete_id', 'team_abbreviation', 'season', 'pos']]
    parts = []
    for year in (2025, 2026):
        p, last = box(year), box(year - 1)
        prior = last[last.played].groupby('athlete_id')[SHOTS].mean().add_prefix('last_')
        r = returning(p).rename(columns={'team': 'team_abbreviation'})
        b = base[base.season == year].merge(r, on=['game_id', 'team_abbreviation'], how='left').merge(form(p, prior), on=['game_id', 'athlete_id'], how='left')
        parts.append(b)
        back = b[['backG', 'backF', 'backC']].sum(axis=1)
        print(year, len(b), 'rows; a teammate back', round((back > 0).mean(), 3), '| hot3 spread', b.hot3.quantile([.05, .95]).round(3).tolist(),
              '| last10 missing', round(b.last10_pts.isna().mean(), 3))
    pd.concat(parts).drop(columns=['team_abbreviation', 'season', 'pos']).to_pickle('extra3.pkl')
