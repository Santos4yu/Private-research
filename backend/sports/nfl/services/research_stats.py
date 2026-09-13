"""Descriptive NFL statistics only. These are not projections or model inputs.

Scoring: https://www.prizepicks.com/playbook-article/how-to-play-prizepicks-nfl-fantasy-scoring-system
Source field definitions: https://nflfastr.com/reference/nfl_stats_variables.html
"""
import math
from dataclasses import replace

FANTASY_VERSION = 'PRIZEPICKS_NFL_FULL_PPR_V1'
FANTASY_WEIGHTS = {
    'passing_yards': .04, 'passing_tds': 4, 'passing_interceptions': -1,
    'rushing_yards': .1, 'rushing_tds': 6, 'receiving_yards': .1,
    'receptions': 1, 'receiving_tds': 6, 'fumbles_lost_total': -1,
    'passing_2pt_conversions': 2, 'rushing_2pt_conversions': 2,
    'receiving_2pt_conversions': 2, 'special_teams_tds': 6,
}


def numeric(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else None
    except (TypeError, ValueError):
        return None


def prizepicks_fantasy(row):
    values = {key: numeric(row.get(key)) for key in FANTASY_WEIGHTS}
    recoveries, defense = numeric(row.get('fumble_recovery_tds')), numeric(row.get('def_tds'))
    if any(value is None for value in values.values()) or recoveries is None or defense is None:
        return None
    if any(value < 0 for key, value in values.items() if not key.endswith('_yards')) or recoveries < 0 or defense < 0:
        return None
    # Recovery TDs can belong to any unit. Without play-level attribution, do
    # not double count a special-teams TD or include a defensive recovery TD.
    if recoveries and (defense or values['special_teams_tds']):
        return None
    return round(sum(values[key] * weight for key, weight in FANTASY_WEIGHTS.items()) + recoveries * 6, 2)


def with_reception_lengths(logs, players):
    by_game = {(row['game_id'], row['player_id']): row.get('receptionDetails') for row in players}
    output = []
    for log in logs:
        detail = by_game.get((log.game_id, log.player_id))
        count = numeric(log.stats.get('receptions'))
        yards = numeric(log.stats.get('receiving_yards'))
        longest = None
        if count == 0 and yards == 0:
            longest = 0
        elif detail and detail['complete'] and count == detail['count'] and len(detail['lengths']) == count and yards is not None and abs(sum(detail['lengths']) - yards) < .01:
            longest = max(detail['lengths']) if detail['lengths'] else None
        output.append(replace(log, stats={**log.stats, 'longest_reception': longest}))
    return output


def reception_logs(season, player_id):
    from . import nflverse, matchup_data
    result = nflverse.game_logs(season, player_id, 'REG')
    if not result.data:
        return result
    pbp = matchup_data.season_data(season)
    return replace(result, data=with_reception_lengths(result.data, pbp['players']))
