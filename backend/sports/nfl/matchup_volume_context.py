"""Descriptive opponent-volume percentile, separate from validated model scores.

No prop line, betting probability, model promotion or projection adjustment.
Higher means opponents historically received more of the named volume statistic.
"""
from collections import defaultdict


def opponent_volume(data, player, opponent, prop, week, quarterback_ids=None):
    qb = player['position'] == 'QB'
    kind = 'qb_yards' if qb and prop == 'rushing_yards' else 'qb_rushes' if qb and prop == 'rush_attempts' else 'called_rushes' if prop == 'rush_attempts' else 'attempts' if prop == 'passing_attempts' else None
    if kind is None:
        return None
    if kind.startswith('qb_') and not quarterback_ids:
        return None
    players = defaultdict(list)
    for row in data.get('players', []):
        players[(row['game_id'], row['team_id'])].append(row)
    faced = defaultdict(list)
    for game in data.get('games', []):
        if game['week'] >= week:
            continue
        metrics = game['metrics']
        if kind.startswith('qb_'):
            participants = players[(game['game_id'], game['team_id'])]
            # Reconcile all known rushers to the complete team event totals.
            # Missing runner identities/yardage must not turn into zero QB yards.
            called = metrics.get('ypc', {}).get('n')
            scrambles = metrics.get('scramble_rate', {}).get('sum')
            if called is None or scrambles is None:
                continue
            if sum(row.get('metrics', {}).get('ypc', {}).get('n', 0) for row in participants) != called + scrambles:
                continue
            passers = [row for row in participants if row.get('player_id') in quarterback_ids and row.get('metrics', {}).get('sack_rate', {}).get('n', 0) > 0]
            if not passers:
                continue
            field = 'sum' if kind == 'qb_yards' else 'n'
            value = sum(row['metrics'].get('ypc', {}).get(field, 0) for row in passers)
        else:
            metric = metrics.get('completion_rate' if kind == 'attempts' else 'ypc')
            if not metric:
                continue
            value = metric['n']
        faced[game['opponent_team_id']].append(value)
    means = {team: sum(values)/len(values) for team, values in faced.items() if len(values) >= 4}
    if opponent not in means or len(means) < 8:
        return None
    value = means[opponent]
    others = [mean for team, mean in means.items() if team != opponent]
    percentile = 100 * (sum(mean < value for mean in others) + .5*sum(mean == value for mean in others))/len(others)
    labels = {'qb_yards':'QB rushing yards allowed, excluding kneels','qb_rushes':'QB rushes allowed, excluding kneels','called_rushes':'Called rushes faced, excluding scrambles','attempts':'Pass attempts faced, excluding spikes'}
    return {'score':round(percentile), 'value':value, 'leagueMean':sum(means.values())/len(means),
            'label':labels[kind], 'games':len(faced[opponent]), 'teams':len(means),
            'definition':'Opponent-volume percentile. Higher means more historical opposing volume; not a player projection or hit probability.',
            'version':'NFL_OPPONENT_VOLUME_CONTEXT_V1', 'source':'nflverse',
            'limitations':'QB identification uses roster positions and recorded dropbacks; rushing totals must reconcile. Role, game script and offseason changes are not adjusted.'}
