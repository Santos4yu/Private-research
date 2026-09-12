"""Offline diagnostics; no fitted calibration is implicitly promoted."""
import math
from .distributions import finite, summarize, compare_line


def probability_metrics(observations):
    """One real-line binary event per observation. Pushes require separate reporting.

    Each row must explicitly carry line provenance and split identity. Synthetic
    thresholds must not be labelled as sportsbook probability validation.
    """
    if not observations:
        return {'status': 'NOT_AVAILABLE', 'n': 0, 'Brier': None, 'logLoss': None, 'ECE': None, 'buckets': []}
    for r in observations:
        if not r.get('lineSource') or not finite(r.get('probability')) or not 0 <= r['probability'] <= 1 or r.get('hit') not in (0, 1):
            raise ValueError('Verified line source, probability and binary outcome required')
    n = len(observations)
    brier = sum((r['probability'] - r['hit']) ** 2 for r in observations) / n
    loss = -sum(r['hit'] * math.log(max(1e-12, r['probability'])) + (1-r['hit']) * math.log(max(1e-12, 1-r['probability'])) for r in observations) / n
    buckets = []
    for lo, hi in ((0, .5), (.5, .55), (.55, .6), (.6, .65), (.65, .7), (.7, 1.000001)):
        rows = [r for r in observations if lo <= r['probability'] < hi]
        expected = sum(r['probability'] for r in rows)
        actual = sum(r['hit'] for r in rows)
        buckets.append({'lower': lo, 'upper': min(1, hi), 'n': len(rows), 'actualHits': actual,
                        'expectedHits': expected, 'error': (actual-expected)/len(rows) if rows else None})
    return {'status': 'EXPERIMENTAL', 'n': n, 'Brier': brier, 'logLoss': loss,
            'ECE': sum(abs(b['actualHits']-b['expectedHits']) for b in buckets)/n,
            'buckets': buckets, 'calibrationSlope': None, 'calibrationIntercept': None}


def percentile_coverage(records):
    if not records:
        return {'n': 0, 'coverage': None, 'meanInterquartileWidth': None}
    for row in records:
        if not finite(row.get('actual')) or not all(finite(row.get('percentiles', {}).get(f'p{p}')) for p in (10,25,50,75,90)):
            raise ValueError('Actual and forecast percentiles required')
    return {'n': len(records), 'coverage': {f'p{p}': sum(r['actual'] <= r['percentiles'][f'p{p}'] for r in records)/len(records) for p in (10,25,50,75,90)},
            'meanInterquartileWidth': sum(r['percentiles']['p75']-r['percentiles']['p25'] for r in records)/len(records),
            'discreteCoverageNote': 'Inclusive CDF coverage; ties can exceed nominal percentiles for counts.'}


def convergence(simulator, line, counts=(5000,10000,25000,50000), seeds=(11,23,37)):
    """Offline numerical diagnostic only; line may be a test threshold here."""
    output = []
    for count in counts:
        for seed in seeds:
            values = simulator(count, seed)
            if len(values) != count: raise ValueError('Simulator count mismatch')
            output.append({'count': count, 'seed': seed, **summarize(values), **compare_line(values, line)})
    return output
