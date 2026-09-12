"""NFL distribution primitives. No live model is promoted by these utilities.

Empirical joint-game resampling preserves correlations in supplied historical
vectors. Callers must provide validated, pre-forecast records and parameter
draws; missing fields never become zero. This is not a calibrated prop model.
"""
import hashlib
import json
import math
import random
from statistics import mean, variance

VERSION = 'NFL_DISTRIBUTION_PRIMITIVES_V1'
COUNTS = {'plays', 'dropbacks', 'attempts', 'rushes', 'targets', 'receptions', 'carries', 'completions'}


def finite(value):
    return isinstance(value, (float, int)) and not isinstance(value, bool) and math.isfinite(value)


def validate_vector(row):
    if not isinstance(row, dict) or not row or not all(finite(v) for v in row.values()):
        raise ValueError('Complete finite simulation vector required')
    for key in COUNTS.intersection(row):
        if row[key] < 0 or int(row[key]) != row[key]:
            raise ValueError('Counts must be nonnegative integers')
    for child, parent in (('receptions', 'targets'), ('completions', 'attempts'),
                          ('targets', 'attempts'), ('carries', 'rushes'), ('attempts', 'dropbacks')):
        if child in row and parent in row and row[child] > row[parent]:
            raise ValueError(f'{child} exceeds {parent}')
    if all(k in row for k in ('dropbacks', 'rushes', 'plays')) and row['dropbacks'] + row['rushes'] > row['plays']:
        raise ValueError('Called plays exceed team volume')


def joint_bootstrap(records, forecast_season, forecast_week, count=10000, seed=0):
    """Resample entire game vectors, not independent final statistics.

    Unadjusted empirical baseline only; cannot substitute for Phase 6 projection.
    No future/same-week record is eligible. No injuries are assigned probabilities.
    """
    if not isinstance(count, int) or isinstance(count, bool) or not 100 <= count <= 100000:
        raise ValueError('Simulation count outside supported range')
    rows = []
    for record in records:
        season, week = record.get('season'), record.get('week')
        if not isinstance(season, int) or not isinstance(week, int):
            raise ValueError('Historical time identity required')
        if (season, week) >= (forecast_season, forecast_week):
            continue
        validate_vector(record.get('values'))
        rows.append(record['values'])
    if len(rows) < 8:
        raise ValueError('At least eight eligible joint observations required')
    keys = set(rows[0])
    if any(set(r) != keys for r in rows):
        raise ValueError('Mixed vector schemas; no missing-data zero fill')
    rng = random.Random(seed)
    return [dict(rng.choice(rows)) for _ in range(count)]


def percentile(values, probability):
    ordered = sorted(values)
    # Discrete inverse empirical CDF preserves attainable integer outcomes.
    return ordered[max(0, math.ceil(probability * len(ordered)) - 1)]


def summarize(values):
    if not values or not all(finite(v) for v in values):
        raise ValueError('Finite outcome sample required')
    spread = variance(values) if len(values) > 1 else 0.0
    return {'mean': mean(values), 'median': percentile(values, .5),
            'variance': spread, 'standardDeviation': math.sqrt(spread),
            'percentiles': {f'p{p}': percentile(values, p / 100) for p in (10, 25, 50, 75, 90)},
            'floorDefinition': 'P25', 'ceilingDefinition': 'P75',
            'simulationCount': len(values), 'distributionModelVersion': VERSION}


def compare_line(values, line):
    """Internal comparison only. Production must verify real line provenance first."""
    if not finite(line) or not values or not all(finite(v) for v in values):
        raise ValueError('Finite outcomes and verified line required')
    n = len(values)
    return {'rawOverProbability': sum(v > line for v in values) / n,
            'rawUnderProbability': sum(v < line for v in values) / n,
            'rawPushProbability': sum(v == line for v in values) / n,
            'calibratedOverProbability': None, 'calibratedUnderProbability': None,
            'calibrationStatus': 'UNCALIBRATED'}


def fingerprint(inputs, projection_version, seed, count):
    """Line-independent cache identity includes all football input snapshots."""
    payload = {'inputs': inputs, 'projectionVersion': projection_version,
               'distributionVersion': VERSION, 'seed': seed, 'count': count}
    return hashlib.sha256(json.dumps(payload, sort_keys=True, allow_nan=False).encode()).hexdigest()


def compare_mass(outcome_mass,line):
    """Exact server-CDF comparison port; no current market provider is implied."""
    if not finite(line) or not outcome_mass or any(not finite(v) or not isinstance(n,int) or isinstance(n,bool) or n<=0 for v,n in outcome_mass.items()):
        raise ValueError('Valid server outcome mass and verified threshold required')
    total=sum(outcome_mass.values())
    return {'rawOverProbability':sum(n for v,n in outcome_mass.items() if v>line)/total,
            'rawUnderProbability':sum(n for v,n in outcome_mass.items() if v<line)/total,
            'rawPushProbability':sum(n for v,n in outcome_mass.items() if v==line)/total,
            'calibratedOverProbability':None,'calibratedUnderProbability':None,'calibrationStatus':'NOT_AVAILABLE'}


def unavailable(projection):
    """Safe production boundary until prop-specific distribution validation exists."""
    return {'playerId': projection.get('playerId'), 'gameId': projection.get('gameId'),
            'propType': projection.get('propType'), 'projectionMean': projection.get('projectionMean'),
            'projectionMedian': None, 'percentiles': None, 'variance': None,
            'standardDeviation': None, 'outcomeVolatility': None, 'modelCertainty': None,
            'line': None, 'rawOverProbability': None, 'rawUnderProbability': None,
            'rawPushProbability': None, 'calibratedOverProbability': None,
            'calibratedUnderProbability': None, 'calibrationStatus': 'NOT_AVAILABLE',
            'simulationCount': None, 'distributionModelVersion': VERSION,
            'projectionModelVersion': projection.get('modelVersion'), 'status': 'NOT_AVAILABLE',
            'reason': 'Prop-specific distribution selection and chronological validation are not completed; no reliable current prop line feed.'}
