"""New reads for every player-game in games.pkl, as they stood before tip-off:

  who's out   each team's recent rotation players (played 3+ of its last 10
              games, one of its last 3, 15+ minutes in them) who sat this one
              while still on the team: their minutes, all and by position, for
              his own team and the opponent
  rest        whether each team played the day before
  recent D    the opponent's last 10 games: points allowed, per 100, and what
              a player at each position got in each stat

Saved as extra.pkl keyed by (game_id, athlete_id)."""
import os
import numpy as np, pandas as pd
# The sportsdataverse box scores (player_box_YYYY.csv, team_box_YYYY.csv), from NBA_DATA.
D = os.environ.get('NBA_DATA', 'data/')
POS = {'G': 'G', 'PG': 'G', 'SG': 'G', 'F': 'F', 'SF': 'F', 'PF': 'F', 'C': 'C'}
STATS = {'pts': 'points', 'reb': 'rebounds', 'ast': 'assists', 'tpm': 'three_point_field_goals_made', 'stl': 'steals', 'blk': 'blocks'}
WINDOW, RECENT, MIN_MIN = 10, 3, 15

def season(year):
    p = pd.read_csv(D + f'player_box_{year}.csv', low_memory=False)
    p = p[p.season_type == 2].copy()
    p['date'] = pd.to_datetime(p.game_date)
    p['pos'] = p.athlete_position_abbreviation.map(POS)
    p['played'] = (p.did_not_play != True) & p.minutes.notna() & (p.minutes > 0)
    games = p[['game_id', 'team_abbreviation', 'date']].drop_duplicates().sort_values('date')
    # Last appearance (any row) of each player for each team: still on it?
    last_row = p.groupby(['athlete_id', 'team_abbreviation']).date.max()
    pos_of = p.dropna(subset=['pos']).groupby('athlete_id').pos.agg(lambda s: s.mode().iloc[0])
    team_rows = {}
    out_rows = []
    played = p[p.played]
    by_team = {t: g.sort_values('date') for t, g in games.groupby('team_abbreviation')}
    played_by_game = {k: set(v) for k, v in played.groupby(['game_id', 'team_abbreviation']).athlete_id}
    mins = played.set_index(['game_id', 'team_abbreviation', 'athlete_id']).minutes
    for team, tg in by_team.items():
        ids = list(tg.game_id); dates = list(tg.date)
        for i, (gid, day) in enumerate(zip(ids, dates)):
            before = ids[max(0, i - WINDOW):i]
            if len(before) < 5:
                continue
            recent = set().union(*(played_by_game.get((g, team), set()) for g in ids[max(0, i - RECENT):i]))
            count, total = {}, {}
            for g in before:
                for a in played_by_game.get((g, team), ()):
                    count[a] = count.get(a, 0) + 1
                    total[a] = total.get(a, 0) + mins.get((g, team, a), 0)
            tonight = played_by_game.get((gid, team), set())
            out = {'G': 0.0, 'F': 0.0, 'C': 0.0}
            for a, n in count.items():
                avg = total[a] / n
                if n < 3 or a not in recent or avg < MIN_MIN or a in tonight:
                    continue
                if last_row.get((a, team), pd.Timestamp.min) < day:
                    continue          # gone from the team (traded, waived)
                out[pos_of.get(a, 'F')] += avg
            prev = dates[i - 1] if i else None
            out_rows.append({'game_id': gid, 'team': team, 'out': sum(out.values()), 'outG': out['G'], 'outF': out['F'], 'outC': out['C'],
                             'b2b': int(prev is not None and (day - prev).days == 1)})
    tf = pd.DataFrame(out_rows)

    # The opponent's last 10 games: points allowed, per 100, and each position's stats a player.
    t = pd.read_csv(D + f'team_box_{year}.csv', low_memory=False)
    t = t[t.season_type == 2].copy()
    t['date'] = pd.to_datetime(t.game_date)
    t['poss'] = t.field_goals_attempted + 0.44 * t.free_throws_attempted - t.offensive_rebounds + t.turnovers
    o = t[['game_id', 'team_abbreviation', 'team_score', 'poss']].rename(columns={'team_abbreviation': 'opp', 'team_score': 'o_score', 'poss': 'o_poss'})
    m = t.merge(o, on='game_id'); m = m[m.team_abbreviation != m.opp].sort_values('date')
    rec = []
    for team, g in m.groupby('team_abbreviation'):
        g = g.sort_values('date')
        allowed = g.o_score.shift(1).rolling(WINDOW, min_periods=5).mean()
        rating = (g.o_score.shift(1).rolling(WINDOW, min_periods=5).sum() / g.o_poss.shift(1).rolling(WINDOW, min_periods=5).sum()) * 100
        rec.append(pd.DataFrame({'game_id': g.game_id.values, 'team': team, 'allowed10': allowed.values, 'rating10': rating.values}))
    rec = pd.concat(rec)
    # Per position, a player at a time, in the opponent's last 10 games.
    pl = played.dropna(subset=['pos'])
    pp = pl.groupby(['opponent_team_abbreviation', 'game_id', 'date', 'pos'])[list(STATS.values())].mean().reset_index()
    pos_rows = []
    for (team, q), g in pp.groupby(['opponent_team_abbreviation', 'pos']):
        g = g.sort_values('date')
        r = g[list(STATS.values())].shift(1).rolling(WINDOW, min_periods=5).mean()
        r.columns = [f'{q}10_{k}' for k in STATS]
        r['game_id'] = g.game_id.values; r['team'] = team
        pos_rows.append(r)
    pr = pd.concat(pos_rows).groupby(['game_id', 'team']).first().reset_index()
    rec = rec.merge(pr, on=['game_id', 'team'], how='left')
    # z across teams on each date, like the season reads.
    rec = rec.merge(m[['game_id', 'team_abbreviation', 'date']].rename(columns={'team_abbreviation': 'team'}), on=['game_id', 'team'])
    cols = [c for c in rec.columns if c not in ('game_id', 'team', 'date')]
    def zday(g):
        return (g - g.mean()) / g.std(ddof=0)
    # Each date has only that night's teams: z over a rolling league snapshot instead (every team's latest value).
    snap = []
    latest = {}
    for day, g in rec.sort_values('date').groupby('date'):
        for _, row in g.iterrows():
            latest[row.team] = row[cols]
        frame = pd.DataFrame(latest).T.astype(float)
        z = ((frame - frame.mean()) / frame.std(ddof=0)).clip(-3, 3)
        for _, row in g.iterrows():
            snap.append({'game_id': row.game_id, 'team': row.team, **{c + '_z': z.loc[row.team, c] for c in cols}})
    rz = pd.DataFrame(snap)
    return tf, rz

if __name__ == '__main__':
    base = pd.read_pickle('games.pkl')[['game_id', 'athlete_id', 'team_abbreviation', 'opponent_team_abbreviation', 'season', 'pos']]
    parts = []
    for year in (2025, 2026):
        tf, rz = season(year)
        b = base[base.season == year]
        b = b.merge(tf.add_prefix('own_').rename(columns={'own_game_id': 'game_id', 'own_team': 'team_abbreviation'}), on=['game_id', 'team_abbreviation'], how='left')
        b = b.merge(tf.add_prefix('opp_').rename(columns={'opp_game_id': 'game_id', 'opp_team': 'opponent_team_abbreviation'}), on=['game_id', 'opponent_team_abbreviation'], how='left')
        b = b.merge(rz.rename(columns={'team': 'opponent_team_abbreviation'}), on=['game_id', 'opponent_team_abbreviation'], how='left')
        parts.append(b)
        print(year, len(b), 'rows; own out>0', round((b.own_out > 0).mean(), 3), 'opp out>0', round((b.opp_out > 0).mean(), 3),
              'opp b2b', round(b.opp_b2b.mean(), 3), 'recent missing', round(b.allowed10_z.isna().mean(), 3))
    extra = pd.concat(parts)
    extra.to_pickle('extra.pkl')
