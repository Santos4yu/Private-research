"""How the production NBA prop grades have done against real PrizePicks lines
(Phase 0 of the NBA prop model work; the owner: "measure whether the
existing model actually works"). Reads only; changes no grade.

Two records of the production grades, kept apart:
- "job": the snapshot job's grades (prop_snapshots.py, from Nov 19), the
  site's own code run on a schedule before each game: each line's Over and
  Under chance, tier and projection, its newest pregame copy;
- "list": the Props list's own reports (props_record.py, from Oct 30), the
  Over chance the page showed, its last report before the game; the Under
  there is 1 - Over (the list graded only the Over).

The rules, fixed before looking at results:
- One line per player, night, stat and kind of line. When a record holds
  several standard lines for one player-night-stat (the line moved), the
  latest pregame one counts (the job) or the middle one (the list: its
  reports carry no time). The rest are counted as duplicates removed.
- Results from the stored season's box scores. A player who didn't play is
  void; a push is left out. Today's games are never read.
- Over and Under are scored apart, each on its own chance. Standard lines
  are the main test; Goblins and Demons (Over only) are reported apart.
- Baselines, each on the same lines and fitted only on earlier nights:
  a coin flip; the line alone (each stat's Over rate on earlier nights,
  pulled toward all stats'); the player's average (his games this season
  before that night, at least 5; the chance from a logistic fit of
  over/under on (average - line) / line over all earlier nights, the line
  alone until there are MIN_FIT of them); and DraftKings, with the vig
  removed, on the lines it priced.
- Uncertainty: props of one player-game rise and fall together, so every
  interval resamples whole player-games (BOOT times); the main differences
  also resample whole nights, the stricter test.
"""
from __future__ import annotations

import math
import time
from collections import defaultdict

import numpy as np

import prop_snapshots
import props_record

BOOT = 400
MIN_FIT = 300
MIN_GAMES = 5
SHRINK = 30
EPS = 1e-4
BANDS = ((0.0, 0.40), (0.40, 0.45), (0.45, 0.50), (0.50, 0.55), (0.55, 0.60), (0.60, 0.65), (0.65, 0.70), (0.70, 1.0001))
GAPS = ((-math.inf, -0.20), (-0.20, -0.10), (-0.10, -0.05), (-0.05, 0.0), (0.0, 0.05), (0.05, 0.10), (0.10, 0.20), (0.20, math.inf))
THRESHOLDS = (0.50, 0.54, 0.57, 0.60)
TIERS = ('elite', 'strong', 'lean', 'risky', 'fade')
STATS = props_record.MARKETS


# ---------------------------------------------------------------- the lines and how they went

def _median_pick(items):
    items = sorted(items, key=lambda item: item['ln'])
    return items[(len(items) - 1) // 2]


def job_records(days, results, pipeline=None):
    """The snapshot job's newest pregame grade of each line, settled."""
    out, removed, void = [], 0, 0
    for day in days:
        kept = prop_snapshots.last_on(day, pipeline)
        groups = defaultdict(list)
        for entry in kept.values():
            row = entry.get('row') or {}
            if row.get('mk') in STATS:
                groups[(row['pid'], row['mk'], row['md'])].append(entry)
        for (pid, market, modifier), entries in groups.items():
            entries.sort(key=lambda entry: (entry.get('l') or 0, entry.get('f') or 0))
            removed += len(entries) - 1
            row = entries[-1]['row']
            value = (results.get((pid, day)) or {}).get(STATS[market])
            if value is None:
                void += 1
                continue
            over, under = row.get('o'), row.get('u')
            out.append({'src': 'job', 'day': day, 'pid': pid, 'mk': market, 'md': modifier, 'ln': row['ln'], 'actual': value,
                        'pOver': over[0] if over else None, 'pUnder': under[0] if under else None, 'implied': False,
                        'tierOver': over[3] if over else None, 'tierUnder': under[3] if under else None,
                        'needsOver': over[5] if over else None, 'proj': row.get('pj'),
                        'book': (row.get('dk') or [None])[0], 'score': row.get('sc'), 'at': entries[-1].get('l')})
    return out, {'duplicatesRemoved': removed, 'void': void}


def list_records(days, results, pipeline):
    """The Props list's reports (props_record.py), settled."""
    out, removed, void = [], 0, 0
    kept = props_record.reports(days, pipeline)
    for day, fields in kept.items():
        groups = defaultdict(list)
        for field, value in fields.items():
            pid, market, line = field.split('|')
            score, chance, tier, modifier, needs = (value + [None] * 6)[:5]
            book = value[5] if len(value) > 5 else None
            groups[(pid, market, modifier or 'standard')].append({'ln': float(line), 'chance': chance, 'tier': tier, 'needs': needs,
                                                                   'book': book, 'score': score})
        for (pid, market, modifier), items in groups.items():
            removed += len(items) - 1
            item = _median_pick(items)
            value = (results.get((pid, day)) or {}).get(STATS.get(market))
            if value is None:
                void += 1
                continue
            chance = item['chance']
            out.append({'src': 'list', 'day': day, 'pid': pid, 'mk': market, 'md': modifier, 'ln': item['ln'], 'actual': value,
                        'pOver': chance, 'pUnder': None if chance is None or modifier != 'standard' else 1 - chance, 'implied': True,
                        'tierOver': item['tier'], 'tierUnder': None, 'needsOver': item['needs'], 'proj': None,
                        'book': item['book'], 'score': item['score'], 'at': None})
    return out, {'duplicatesRemoved': removed, 'void': void}


def averages(payload, stat_value) -> dict:
    """(player id, US day) -> ({stat: his average this season before that
    day}, games): only games of earlier days."""
    from backend.sports.wnba import context
    minute = context._I['min']
    by_day = defaultdict(list)
    for game in ((payload or {}).get('games') or {}).values():
        start = props_record._start(game.get('date'))
        if start:
            by_day[props_record.day_of(start)].append(game)
    sums = defaultdict(lambda: defaultdict(float))
    out = {}
    for day in sorted(by_day):
        rows = [row for game in by_day[day] for side in (game.get('t') or {}).values() for row in side.get('p') or [] if row[minute]]
        for row in rows:
            past = sums.get(str(row[0]))
            if past and past['_n'] >= MIN_GAMES:
                out[(str(row[0]), day)] = ({stat: past[stat] / past['_n'] for stat in set(STATS.values())}, int(past['_n']))
        for row in rows:
            past = sums[str(row[0])]
            past['_n'] += 1
            for stat in set(STATS.values()):
                past[stat] += stat_value(row, stat) or 0
    return out


# ---------------------------------------------------------------- baselines (earlier nights only)

def _logistic(x, y, ridge=1e-6):
    x, y = np.asarray(x, float), np.asarray(y, float)
    beta = np.zeros(x.shape[1])
    for _ in range(50):
        p = 1 / (1 + np.exp(-(x @ beta)))
        gradient = x.T @ (y - p) - ridge * beta
        hessian = (x * (p * (1 - p))[:, None]).T @ x + ridge * np.eye(x.shape[1])
        step = np.linalg.solve(hessian, gradient)
        beta += step
        if np.max(np.abs(step)) < 1e-9:
            break
    return beta


def add_baselines(fit_records, score_records, avgs):
    """Each standard record in `score_records` gets `pLine` (its stat's Over
    rate on earlier nights, pulled toward all stats') and `pAvg` (the
    player-average fit on earlier nights) chances of the Over, and `gapAvg`,
    its (average - line) / line. Fitted on `fit_records` of earlier nights only."""
    for record in [*fit_records, *score_records]:
        found = avgs.get((record['pid'], record['day']))
        average = found[0].get(STATS[record['mk']]) if found else None
        record['gapAvg'] = None if average is None or not record['ln'] else max(-1.0, min(1.0, (average - record['ln']) / record['ln']))
    fit_by_day, score_by_day = defaultdict(list), defaultdict(list)
    for record in fit_records:
        if record['md'] == 'standard' and record['actual'] != record['ln']:
            fit_by_day[record['day']].append(record)
    for record in score_records:
        if record['md'] == 'standard':
            score_by_day[record['day']].append(record)
    overs, counts = defaultdict(float), defaultdict(int)
    fit_x, fit_y = [], []
    for day in sorted(set(fit_by_day) | set(score_by_day)):
        everyone = (overs['*'] + SHRINK * 0.5) / (counts['*'] + SHRINK)
        rate = {market: (overs[market] + SHRINK * everyone) / (counts[market] + SHRINK) for market in STATS}
        beta = _logistic(np.array(fit_x), np.array(fit_y)) if len(fit_y) >= MIN_FIT else None
        for record in score_by_day[day]:
            record['pLine'] = rate[record['mk']]
            fitted = beta is not None and record['gapAvg'] is not None
            record['pAvg'] = float(1 / (1 + math.exp(-(beta[0] + beta[1] * record['gapAvg'])))) if fitted else record['pLine']
            record['avgFitted'] = fitted
        # Only now does the night count.
        for record in fit_by_day[day]:
            over = 1.0 if record['actual'] > record['ln'] else 0.0
            overs[record['mk']] += over
            counts[record['mk']] += 1
            overs['*'] += over
            counts['*'] += 1
            if record['gapAvg'] is not None:
                fit_x.append([1.0, record['gapAvg']])
                fit_y.append(over)
    return score_records


# ---------------------------------------------------------------- scoring

def _weights(clusters, rng, boot=BOOT):
    """Bootstrap weights (boot x records) resampling whole clusters."""
    _, inverse = np.unique(np.asarray(clusters), return_inverse=True)
    size = int(inverse.max()) + 1 if len(inverse) else 0
    if not size:
        return np.zeros((boot, 0))
    draws = rng.integers(0, size, size=(boot, size))
    counts = np.zeros((boot, size))
    np.add.at(counts, (np.arange(boot)[:, None], draws), 1)
    return counts[:, inverse]


def _ci(weights, values, mask=None):
    if mask is not None:
        weights, values = weights[:, mask], values[mask]
    total = weights.sum(1)
    good = total > 0
    if not values.size or not good.any():
        return None
    means = (weights[good] @ values) / total[good]
    return [round(float(np.percentile(means, 2.5)), 4), round(float(np.percentile(means, 97.5)), 4)]


def _loss(p, y):
    p = np.clip(p, EPS, 1 - EPS)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p)), (p - y) ** 2


def _slope(p, y):
    """Calibration intercept and slope: y on logit(p) (intercept 0 and slope 1 when calibrated)."""
    if len(y) < 30 or y.min() == y.max():
        return None
    p = np.clip(p, EPS, 1 - EPS)
    beta = _logistic(np.column_stack([np.ones(len(p)), np.log(p / (1 - p))]), y)
    return {'intercept': round(float(beta[0]), 3), 'slope': round(float(beta[1]), 3)}


def score_side(records, side, rng):
    """One side (over / under) of the records that carry its chance: the
    production chance against each baseline, calibration, tiers,
    thresholds, stats and gaps."""
    key, tier_key = ('pOver', 'tierOver') if side == 'over' else ('pUnder', 'tierUnder')
    rows = [record for record in records if record.get(key) is not None and record['actual'] != record['ln']]
    if not rows:
        return {'n': 0}
    y = np.array([1.0 if (record['actual'] > record['ln']) == (side == 'over') else 0.0 for record in rows])
    p = np.clip(np.array([record[key] for record in rows], float), EPS, 1 - EPS)
    flip = (lambda value: value) if side == 'over' else (lambda value: 1 - value)
    clusters = [f"{record['pid']}|{record['day']}" for record in rows]
    nights = [record['day'] for record in rows]
    weights = _weights(clusters, rng)
    night_weights = _weights(nights, rng)
    loss, brier = _loss(p, y)
    models = {'production': p}
    if all('pLine' in record for record in rows):
        models['line'] = np.array([flip(record['pLine']) for record in rows])
        models['average'] = np.array([flip(record['pAvg']) for record in rows])
    models['coin'] = np.full(len(rows), 0.5)
    summary = []
    for name, chances in models.items():
        model_loss, model_brier = _loss(chances, y)
        entry = {'model': name, 'n': len(rows), 'logLoss': round(float(model_loss.mean()), 4), 'logLossCI': _ci(weights, model_loss),
                 'brier': round(float(model_brier.mean()), 4), 'brierCI': _ci(weights, model_brier),
                 'meanChance': round(float(chances.mean()), 4)}
        if name != 'production':
            # Production less this model: below 0 is production doing better.
            entry['logLossVsProduction'] = round(float((loss - model_loss).mean()), 4)
            entry['logLossVsProductionCI'] = _ci(weights, loss - model_loss)
            entry['logLossVsProductionNightCI'] = _ci(night_weights, loss - model_loss)
            entry['brierVsProduction'] = round(float((brier - model_brier).mean()), 4)
            entry['brierVsProductionCI'] = _ci(weights, brier - model_brier)
        summary.append(entry)
    # DraftKings, where it priced the line: production and DK on the same lines.
    priced = np.array([record.get('book') is not None and 0 < record['book'] < 1 for record in rows])
    if priced.sum() >= 20:
        book = np.clip(np.array([flip(record['book']) if record.get('book') is not None else 0.5 for record in rows]), EPS, 1 - EPS)
        book_loss, book_brier = _loss(book, y)
        summary.append({'model': 'draftkings', 'n': int(priced.sum()), 'logLoss': round(float(book_loss[priced].mean()), 4),
                        'logLossCI': _ci(weights, book_loss, priced), 'brier': round(float(book_brier[priced].mean()), 4),
                        'brierCI': _ci(weights, book_brier, priced), 'meanChance': round(float(book[priced].mean()), 4),
                        'productionLogLossSameLines': round(float(loss[priced].mean()), 4),
                        'logLossVsProduction': round(float((loss - book_loss)[priced].mean()), 4),
                        'logLossVsProductionCI': _ci(weights, loss - book_loss, priced),
                        'logLossVsProductionNightCI': _ci(night_weights, loss - book_loss, priced),
                        'brierVsProduction': round(float((brier - book_brier)[priced].mean()), 4),
                        'brierVsProductionCI': _ci(weights, brier - book_brier, priced)})

    def band_rows(chances, bands=BANDS):
        out = []
        for low, high in bands:
            mask = (chances >= low) & (chances < high)
            if mask.sum():
                out.append({'band': [low, min(high, 1.0)], 'n': int(mask.sum()), 'meanChance': round(float(chances[mask].mean()), 4),
                            'hitRate': round(float(y[mask].mean()), 4), 'hitRateCI': _ci(weights, y, mask)})
        return out
    calibration = band_rows(p)
    ece = sum(item['n'] * abs(item['meanChance'] - item['hitRate']) for item in calibration) / len(rows)
    tiers = []
    for tier in TIERS:
        mask = np.array([record.get(tier_key) == tier for record in rows])
        if mask.sum():
            tiers.append({'tier': tier, 'n': int(mask.sum()), 'meanChance': round(float(p[mask].mean()), 4),
                          'hitRate': round(float(y[mask].mean()), 4), 'hitRateCI': _ci(weights, y, mask),
                          'playerGames': len({clusters[i] for i in np.flatnonzero(mask)})})
    thresholds = []
    for floor in THRESHOLDS:
        mask = p >= floor
        if mask.sum():
            thresholds.append({'atLeast': floor, 'n': int(mask.sum()), 'hitRate': round(float(y[mask].mean()), 4), 'hitRateCI': _ci(weights, y, mask),
                               'playerGames': len({clusters[i] for i in np.flatnonzero(mask)})})
    markets = []
    for market in STATS:
        mask = np.array([record['mk'] == market for record in rows])
        if mask.sum():
            markets.append({'market': market, 'n': int(mask.sum()), 'meanChance': round(float(p[mask].mean()), 4),
                            'hitRate': round(float(y[mask].mean()), 4), 'logLoss': round(float(loss[mask].mean()), 4),
                            'brier': round(float(brier[mask].mean()), 4), 'logLossCI': _ci(weights, loss, mask)})
    gaps = []
    for label, gap_key in (('projection', 'proj'), ('average', 'gapAvg')):
        values = [None if record.get(gap_key) is None else
                  (record[gap_key] - record['ln']) / record['ln'] if gap_key == 'proj' and record['ln'] else record.get(gap_key) for record in rows]
        if sum(value is not None for value in values) < 20:
            continue
        for low, high in GAPS:
            mask = np.array([value is not None and low <= value < high for value in values])
            if mask.sum():
                gaps.append({'by': label, 'gap': [None if math.isinf(low) else low, None if math.isinf(high) else high], 'n': int(mask.sum()),
                             'meanChance': round(float(p[mask].mean()), 4), 'hitRate': round(float(y[mask].mean()), 4), 'hitRateCI': _ci(weights, y, mask)})
    return {'n': len(rows), 'playerGames': len(set(clusters)), 'nights': len(set(nights)), 'hitRate': round(float(y.mean()), 4),
            'summary': summary, 'calibration': calibration, 'ece': round(float(ece), 4), 'fit': _slope(p, y),
            'tiers': tiers, 'thresholds': thresholds, 'markets': markets, 'gaps': gaps}


def favored(records, rng):
    """Standard lines: how often the side production favored won (the higher
    of its Over and Under chances), against the player average's side."""
    rows = [record for record in records if record['md'] == 'standard' and record.get('pOver') is not None
            and record.get('pUnder') is not None and record['actual'] != record['ln']]
    if not rows:
        return {'n': 0}
    over = np.array([1.0 if record['actual'] > record['ln'] else 0.0 for record in rows])
    pick = np.array([1.0 if record['pOver'] >= record['pUnder'] else 0.0 for record in rows])
    right = (pick == over).astype(float)
    clusters = [f"{record['pid']}|{record['day']}" for record in rows]
    weights = _weights(clusters, rng)
    out = {'n': len(rows), 'right': round(float(right.mean()), 4), 'rightCI': _ci(weights, right),
           'overPicked': round(float(pick.mean()), 4), 'overRate': round(float(over.mean()), 4)}
    if all('pAvg' in record for record in rows):
        avg_right = ((np.array([record['pAvg'] for record in rows]) >= 0.5).astype(float) == over).astype(float)
        out['averageRight'] = round(float(avg_right.mean()), 4)
        out['rightVsAverageCI'] = _ci(weights, right - avg_right)
    return out


def errors(records):
    """Projection error by stat (the job's projections) beside the player
    average's, on the same lines."""
    out = []
    for market in STATS:
        rows = [record for record in records if record['mk'] == market and record.get('proj') is not None and record['md'] == 'standard']
        if not rows:
            continue
        actual = np.array([record['actual'] for record in rows], float)
        projected = np.array([record['proj'] for record in rows], float)
        entry = {'market': market, 'n': len(rows), 'mae': round(float(np.abs(projected - actual).mean()), 3),
                 'rmse': round(float(np.sqrt(((projected - actual) ** 2).mean())), 3), 'bias': round(float((projected - actual).mean()), 3),
                 'lineMae': round(float(np.abs(np.array([record['ln'] for record in rows]) - actual).mean()), 3)}
        with_avg = [record for record in rows if record.get('gapAvg') is not None]
        if with_avg:
            averages_ = np.array([record['ln'] * (1 + record['gapAvg']) for record in with_avg])
            entry['averageMae'] = round(float(np.abs(averages_ - np.array([record['actual'] for record in with_avg])).mean()), 3)
        out.append(entry)
    return out


def report(records, rng):
    standard = [record for record in records if record['md'] == 'standard']
    specials = {modifier: score_side([record for record in records if record['md'] == modifier], 'over', rng) for modifier in ('goblin', 'demon')}
    return {'lines': len(records), 'standard': len(standard), 'pushes': sum(1 for record in standard if record['actual'] == record['ln']),
            'from': min((record['day'] for record in records), default=None), 'to': max((record['day'] for record in records), default=None),
            'over': score_side(standard, 'over', rng), 'under': score_side(standard, 'under', rng), 'favored': favored(standard, rng),
            'errors': errors(records), 'specials': specials}


def evaluate(days=30, now=None, pipeline=None, payloads=None, stat_value=None):
    """The whole evaluation: both records, their baselines and scores."""
    started = time.time()
    now = time.time() if now is None else now
    pipeline = pipeline or prop_snapshots._pipeline
    if payloads is None or stat_value is None:
        from backend.sports.wnba import context, league
        season = league.current_season(league='nba')
        payloads = [league.stored(year, 'nba') for year in (season - 1, season)]
        stat_value = context.stat_value
    today = props_record.day_of(now)
    from datetime import date, timedelta
    first = date.fromisoformat(today) - timedelta(days=days)
    asked = [(first + timedelta(days=n)).isoformat() for n in range(days)]
    results = props_record.results(payloads, stat_value)
    avgs = averages(payloads[-1], stat_value)
    job, job_counts = job_records(asked, results, pipeline)
    listed, list_counts = list_records(asked, results, pipeline)
    # The baselines are fitted on every line either record holds (an
    # outcome is the line's, whichever record kept it), one per
    # player-night-stat, and only on nights before the one scored.
    union, seen = [], set()
    for record in job + listed:
        mark = (record['pid'], record['day'], record['mk'], record['md'])
        if mark not in seen:
            seen.add(mark)
            union.append(dict(record))
    add_baselines(union, job + listed, avgs)
    rng = np.random.default_rng(20261118)
    return {'generatedAt': int(time.time()), 'seconds': round(time.time() - started, 1), 'today': today, 'days': days,
            'job': {**job_counts, **report(job, rng)}, 'list': {**list_counts, **report(listed, rng)},
            'baselines': {'lines': len(union), 'averageFitted': sum(1 for record in job + listed if record.get('avgFitted')),
                          'averageMissing': sum(1 for record in job + listed if record['md'] == 'standard' and record.get('gapAvg') is None)}}
