"""Position-group allowed-volume context: what a defense has allowed to a
position group this season, using the same play-by-play aggregates the rest
of the matchup model uses (backend.sports.nfl.services.matchup_data).

Descriptive percentile only. Not a projection, hit probability, or score
input — matches the same rigor and thresholds as matchup_volume_context.py
(>=4 games faced, >=8 teams for a valid percentile), just grouped by
position instead of by team total.
"""
from collections import defaultdict

RB_POSITIONS = {'RB', 'FB'}

STATS = {
    'rush_attempts': {'label': 'Rush attempts allowed', 'metric': 'ypc', 'field': 'n', 'positions': RB_POSITIONS},
    'rushing_yards': {'label': 'Rush yards allowed', 'metric': 'ypc', 'field': 'sum', 'positions': RB_POSITIONS},
    'targets': {'label': 'Targets allowed', 'metric': 'yards_per_target', 'field': 'n', 'positions': None},
    'receptions': {'label': 'Receptions allowed', 'metric': 'yards_per_reception', 'field': 'n', 'positions': None},
    'receiving_yards': {'label': 'Receiving yards allowed', 'metric': 'yards_per_reception', 'field': 'sum', 'positions': None},
}

# Which stats are meaningful to show for a given researched position.
STATS_FOR_POSITION = {
    'RB': ('rush_attempts', 'rushing_yards', 'targets', 'receptions', 'receiving_yards'),
    'FB': ('rush_attempts', 'rushing_yards'),
    'WR': ('targets', 'receptions', 'receiving_yards'),
    'TE': ('targets', 'receptions', 'receiving_yards'),
    'QB': (),
}


def position_allowed(data, roster, opponent, position, stat, week):
    spec = STATS.get(stat)
    if not spec or not data:
        return None
    positions = spec['positions'] or {position}
    games_index = {g['game_id']: g for g in data.get('games', []) if g['week'] < week}
    faced = defaultdict(lambda: defaultdict(float))
    for row in data.get('players', []):
        game = games_index.get(row['game_id'])
        if not game:
            continue
        player = roster.get(row['player_id'])
        if not player or player.position not in positions:
            continue
        value = row.get('metrics', {}).get(spec['metric'], {}).get(spec['field'])
        if value:
            faced[game['opponent_team_id']][game['game_id']] += value
    per_game = {team: list(games.values()) for team, games in faced.items() if len(games) >= 4}
    if opponent not in per_game or len(per_game) < 8:
        return None
    means = {team: sum(values) / len(values) for team, values in per_game.items()}
    value = means[opponent]
    others = [mean for team, mean in means.items() if team != opponent]
    percentile = 100 * (sum(mean < value for mean in others) + .5 * sum(mean == value for mean in others)) / len(others)
    return {
        'stat': stat, 'label': spec['label'], 'position': position,
        'value': round(value, 1), 'leagueMean': round(sum(means.values()) / len(means), 1),
        'percentile': round(percentile), 'games': len(per_game[opponent]), 'teams': len(means),
        'definition': 'Percentile of per-game volume historically allowed to this position, prior weeks only. Higher means more opposing volume; not a projection or hit probability.',
        'version': 'NFL_POSITION_DEFENSE_V1',
    }


def position_defense_context(data, roster, opponent, position, week):
    stats = STATS_FOR_POSITION.get(position, ())
    results = [position_allowed(data, roster, opponent, position, stat, week) for stat in stats]
    return [r for r in results if r]
