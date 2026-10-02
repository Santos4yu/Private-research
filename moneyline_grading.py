"""Evidence-based moneyline grading, not a fitted/calibrated probability model.

Scores describe a matchup on a 0–100 scale, NOT its win percentage. Inputs
are existing public league/ESPN observations; unavailable inputs stay null.
Scoring offense/defense replaces part of SRS rather than being added to it.
The resulting probability and staking policy require prospective validation.
"""
import math


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def clamp(value, low=0, high=100):
    return max(low, min(high, value))


def percentile(value, pool, higher=True):
    values = [v for v in pool if finite(v)]
    if not finite(value) or len(values) < 4:
        return None
    # Mid-rank: tied observations receive the same score.
    score = 100 * (sum(v < value for v in values) + 0.5 * sum(v == value for v in values)) / len(values)
    return round(score if higher else 100 - score, 1)


def scoring_matchup(rated, home, away, hfa, rating_margin):
    """Scoring vs opposing defense, shrunk for observed sample size.

    An explicit 20% replacement avoids counting run/point differential twice.
    This is a descriptive scoring baseline, not projected final game scores.
    """
    table = rated.get('stats') or {}
    h, a = table.get(home) or {}, table.get(away) or {}
    if not all(finite(row.get(key)) for row in (h, a) for key in ('for', 'against')):
        return None
    baseline = ((h['for'] + a['against']) - (a['for'] + h['against'])) / 2 + hfa
    sample = min((r.get('games') or 0) + (min(4, r.get('priorGames') or 0) if r.get('usesPrior') else 0) for r in (h, a))
    weight = 0.2 * min(1, sample / 8)
    return {'homeScoring': round((h['for'] + a['against']) / 2, 2),
            'awayScoring': round((a['for'] + h['against']) / 2, 2),
            'margin': baseline, 'weight': weight,
            'adjustment': weight * (baseline - rating_margin) if rating_margin is not None else 0}


def grade_matchup(sport, rated, context, teams, factors, margin, sd, neutral=False, extras=None):
    """League-relative strengths plus opponent-specific advantages, by side."""
    table = rated.get('stats') or {}
    extras = extras or {}
    pool_for = [row.get('for') for row in table.values()]
    pool_against = [row.get('against') for row in table.values()]
    rows, coverage, missing = {}, {}, []
    component_weights = {'offense': 30, 'defense': 30, 'personnel': 20, 'form': 10, 'availability': 10}
    for side, team in teams.items():
        stats = table.get(team) or {}
        offense = percentile(stats.get('for'), pool_for)
        defense = percentile(stats.get('against'), pool_against, False)
        sample = stats.get('games') or 0
        form = [g for g in (context.get('form') or {}).get(side) or [] if finite(g.get('margin'))]
        recent = clamp(50 + 30 * sum(g['margin'] for g in form) / len(form) / sd) if len(form) >= 3 else None
        reports = (context.get('injuries') or {}).get(side)
        leaders = (context.get('leaders') or {}).get(side) or {}
        personnel, label, detail, unresolved = None, 'Key players', 'Not verified', False
        if sport == 'mlb':
            team_id = (rated.get('ids') or {}).get(team)
            pitcher = (rated.get('probables') or {}).get(team_id) or {}
            staff = (rated.get('staffs') or {}).get(team_id) or {}
            label = 'Probable starter'
            if pitcher.get('name') and finite(pitcher.get('era')) and finite(pitcher.get('ip')) and pitcher['ip'] >= 20 and finite(staff.get('era')):
                starter_views = [clamp(50 + (staff['era'] - pitcher['era']) * 12)]
                for field, multiplier in (('whip', -35), ('k9', 5), ('bb9', -7), ('hr9', -15)):
                    if finite(pitcher.get(field)) and finite(staff.get(field)):
                        starter_views.append(clamp(50 + (pitcher[field] - staff[field]) * multiplier))
                personnel = round(sum(starter_views) / len(starter_views), 1)
                detail = f"{pitcher['name']} · {pitcher['era']:.2f} ERA · {pitcher['ip']:g} IP"
            unresolved = personnel is None
        elif sport == 'nfl':
            label = 'Quarterback / report'
            qb = leaders.get('passingyards') or {}
            if qb.get('name') and reports is not None:
                report = next((p for p in reports if str(p.get('name', '')).casefold() == qb['name'].casefold()), {})
                status = str(report.get('status') or '').lower()
                cost = {'out': 40, 'injured reserve': 40, 'doubtful': 30, 'questionable': 10}.get(status, 0)
                personnel = 60 - cost
                detail = f"{qb['name']} · {report.get('status') or 'no listed injury'} (not a confirmed lineup)"
                unresolved = status in ('out', 'injured reserve', 'doubtful', 'questionable')
            else:
                unresolved = True
        elif sport == 'nhl':
            label = 'Likely goalie'
            goalie_factor = next((f for f in factors if f['key'] == 'goalies'), {})
            goalie = next((g for g in (goalie_factor.get('detail') or {}).get('goalies') or [] if g.get('side') == side), {})
            if goalie.get('name') and finite(goalie.get('savePct')):
                personnel = clamp(50 + (goalie['savePct'] - 0.9) * 1000)
                detail = f"{goalie['name']} · {goalie['savePct']:.3f} SV% · likely, not confirmed"
            # The existing source estimates the goalie. Do not sell it as confirmed.
            unresolved = True
        else:
            if leaders and reports is not None:
                personnel = 60
                detail = 'Statistical leaders and injury report available; lineup unconfirmed'
                unresolved = any(str(p.get('status') or '').lower() in ('out', 'doubtful', 'questionable', 'day-to-day') for p in reports)
            else:
                unresolved = True
        availability = None if reports is None else clamp(70 - 8 * sum(
            str(p.get('status') or '').lower() in ('out', 'doubtful', 'questionable', 'day-to-day', 'injured reserve') for p in reports))
        components = [
            {'key': 'offense', 'label': 'Offense', 'score': offense, 'detail': f"{stats['for']:.2f} scored/game · {sample} current games" + (' · prior-season baseline included' if stats.get('usesPrior') else '') if finite(stats.get('for')) else 'Unavailable'},
            {'key': 'defense', 'label': 'Defense', 'score': defense, 'detail': f"{stats['against']:.2f} allowed/game · {sample} current games" + (' · prior-season baseline included' if stats.get('usesPrior') else '') if finite(stats.get('against')) else 'Unavailable'},
            {'key': 'personnel', 'label': label, 'score': personnel, 'detail': detail},
            {'key': 'form', 'label': 'Recent form', 'score': round(recent, 1) if recent is not None else None, 'detail': f'{len(form)} completed games' if form else 'Unavailable'},
            {'key': 'availability', 'label': 'Injury report', 'score': availability, 'detail': 'Report available; no inferred full-lineup confirmation' if reports is not None else 'Unavailable'},
        ]
        available = [c for c in components if c['score'] is not None]
        weight = sum(component_weights[c['key']] for c in available)
        sample_quality = min(1, sample / 8)
        if stats.get('usesPrior') and (stats.get('priorGames') or 0) >= 8:
            sample_quality = min(0.85, 0.55 + 0.45 * min(1, sample / 8))
            missing.append(f'{side}: early-season scoring uses prior-season baseline')
        coverage[side] = weight / 100 * sample_quality
        if unresolved:
            coverage[side] = min(coverage[side], 0.74)
            missing.append(f'{side}: starter/key-player confirmation unresolved')
        missing.extend(f"{side}: {c['label']} unavailable" for c in components if c['score'] is None)
        rows[side] = {'team': team, 'score': round(sum(c['score'] * component_weights[c['key']] for c in available) / weight, 1) if weight else None,
                      'components': components, 'sample': sample, 'personnelUnresolved': unresolved}
    for side, sign, other in (('home', 1, 'away'), ('away', -1, 'home')):
        opponent = rows[other]
        advantages = []
        for key in ('offense', 'defense'):
            own = next(c['score'] for c in rows[side]['components'] if c['key'] == key)
            opposing = next(c['score'] for c in opponent['components'] if c['key'] == ('defense' if key == 'offense' else 'offense'))
            advantages.append(own - opposing if own is not None and opposing is not None else None)
        # Grade combines the predicted margin with the two matchup comparisons.
        # Never interpret this score as a probability or feed it back into the model.
        score = 50 + sign * margin / sd * 35 if finite(margin) else None
        if score is not None and all(v is not None for v in advantages):
            score += sum(advantages) / 2 * 0.15
        rows[side].update(matchupScore=round(clamp(score), 1) if score is not None else None,
                          offenseVsDefense=advantages[0], defenseVsOffense=advantages[1])
    return {'teams': rows, 'coverage': round(min(coverage.values()), 3), 'missing': missing,
            'neutral': neutral, 'method': 'Descriptive matchup grade, not a win probability',
            'validation': 'Prospective tracking; not yet calibrated'}


def decision(probability, matchup_probability, espn_probability, market_probability, price, grading, side, book_count, sharp):
    """Require both team support and a price that survives an uncertainty haircut.

    Heuristic safety policy, not a statistical confidence interval. Never
    promote negative EV just to produce plays or increase size after losses.
    """
    payout = 1 + (price / 100 if price > 0 else 100 / -price)
    quality = grading['coverage']
    score = grading['teams'][side]['matchupScore']
    disagreement = abs(probability - matchup_probability) if finite(matchup_probability) else 0.2
    haircut = 0.015 + (1 - quality) * 0.025 + min(0.03, disagreement * 0.15)
    conservative = max(0.01, probability - haircut)
    ev = probability * payout - 1
    risk_ev = conservative * payout - 1
    support = sum(p > 0.5 for p in (matchup_probability, espn_probability, market_probability) if finite(p))
    qualified = finite(matchup_probability) and matchup_probability >= 0.53 and probability >= 0.53 and quality >= 0.5 and book_count >= 3
    tier = None
    if qualified and risk_ev >= 0.02 and ev >= 0.03 and finite(score) and score >= 60:
        tier = 'play'
        if score >= 72 and probability >= 0.6 and quality >= 0.7 and support >= 2 and risk_ev >= 0.035:
            tier = 'strong'
        if score >= 82 and probability >= 0.65 and quality >= 0.85 and support >= 2 and risk_ev >= 0.05 and sharp:
            tier = 'elite'
    elif ev >= 0.01 and finite(matchup_probability) and matchup_probability > 0.5:
        tier = 'lean'
    if price > 400 and tier in ('elite', 'strong', 'play'):
        tier = 'lean'
    # Eighth Kelly, rounded DOWN; no minimum-size inflation for thin edges.
    raw_units = max(0, risk_ev / (payout - 1) * 0.125 * 100) * quality
    cap = {'elite': 1.0, 'strong': 0.75, 'play': 0.5}.get(tier, 0)
    stake = min(cap, math.floor((raw_units + 1e-9) * 4) / 4)
    if tier in ('elite', 'strong', 'play') and stake < 0.25:
        tier, stake = 'lean', 0
    return {'tier': tier, 'units': stake, 'ev': ev, 'conservativeEv': risk_ev,
            'conservativeProbability': conservative, 'uncertaintyHaircut': haircut,
            'score': score, 'coverage': quality, 'agreement': support,
            'minimumPrice': None, 'stakePolicy': 'Eighth Kelly, coverage-adjusted; provisional maximum 1u; 1u = 1% bankroll'}
