"""Explainable pitcher context, separate from calibrated probability and tiers.

Weights are heuristic allocations, not fitted probabilities. Missing and thin
inputs shrink to neutral; market/side determine which direction supports a prop.
"""
import math


WEIGHTS = {
    'pitcher_strikeouts': (15, 25, 10, 15, 20, 10, 3, 2),
    'pitcher_outs': (20, 10, 15, 10, 10, 25, 7, 3),
    'pitcher_hits_allowed': (30, 10, 5, 20, 15, 10, 7, 3),
    'pitcher_earned_runs': (25, 10, 10, 20, 15, 5, 10, 5),
}


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None


def innings(start):
    outs = number(start.get('outs'))
    if outs is not None:
        return outs / 3 if outs >= 0 else None
    # MLB notation: 5.2 is five innings plus two outs, never 5.2 innings.
    text = str(start.get('ip', ''))
    whole, _, fraction = text.partition('.')
    if not whole.isdigit() or fraction not in ('', '0', '1', '2'):
        return None
    return int(whole) + int(fraction or 0) / 3


def pitcher_matchup_grade(*, k_card, opp_k=None, splits=None,
                          opponent_offense=None, prop_type='pitcher_strikeouts',
                          park_factor=None, weather=None, umpire=None,
                          arsenal=None, team_pitch_types=None, side='over', line=None):
    if prop_type not in WEIGHTS:
        return dict(score=50, label='Matchup model unavailable', coverage=0,
                    factors=[], version='pitcher-context-v2', side=str(side).lower(), market=prop_type)
    weights = WEIGHTS[prop_type]
    prevention = prop_type in ('pitcher_hits_allowed', 'pitcher_earned_runs')
    direction = (-1 if prevention else 1) * (-1 if str(side).lower() == 'under' else 1)
    offense = opponent_offense or {}
    metrics = {r.get('key'): r for r in offense.get('metrics', [])}
    pa = number((offense.get('totals') or {}).get('plate_appearances'))
    team_conf = min(1, pa / 400) if pa is not None and pa >= 50 else 0
    factors = []

    def add(key, name, weight, edge, detail, confidence=1, orientation=direction):
        available = edge is not None and confidence > 0
        confidence = max(0, min(1, confidence)) if available else 0
        impact = max(-1, min(1, edge or 0)) * weight * confidence * orientation
        factors.append(dict(key=key, name=name, weight=weight,
                            score=round(50 + impact / weight * 50),
                            impact=round(impact, 1), available=available,
                            confidence=round(confidence, 2), detail=detail))

    def rank(key):
        value = number((metrics.get(key) or {}).get('rank'))
        return (value - 15.5) / 14.5 if value is not None and 1 <= value <= 30 else None

    # AVG directly supports hits; run/HR production broadens the ER/outs view.
    offense_keys = [('avg', 1)] if prop_type == 'pitcher_hits_allowed' else [('avg', .5), ('runs_pg', .3), ('hr_pg', .2)]
    valid = [(rank(key), weight) for key, weight in offense_keys if rank(key) is not None]
    edge = sum(r * w for r, w in valid) / sum(w for _, w in valid) if valid else None
    add('offense', 'Opponent offense quality', weights[0], edge,
        (' · '.join(f"{key}: {metrics[key].get('value')} (#{metrics[key].get('rank')}/30)" for key, _ in offense_keys if rank(key) is not None)
         + ' · AVG vs hand; R/HR full season') if valid else 'Opponent offense unavailable',
        team_conf * sum(w for _, w in valid))
    for key, name, weight in [('k_pct', 'Opponent K%', weights[1]), ('bb_pct', 'Opponent BB%', weights[2])]:
        row = metrics.get(key) or {}
        add(key, name, weight, rank(key),
            f"{row.get('value', '—')}% vs pitcher hand · rank #{row.get('rank', '—')}/30 · {int(pa or 0)} PA",
            team_conf)

    starts = (k_card or {}).get('last_5_starts') or []
    valid_starts = [(s, innings(s)) for s in starts[:5] if innings(s) is not None and innings(s) > 0]
    stat, baseline, scale = ('k', 8.5, 4) if prop_type == 'pitcher_strikeouts' else ('hits', 8.5, 4) if prop_type == 'pitcher_hits_allowed' else ('er', 4.2, 3)
    recent = [(s, ip) for s, ip in valid_starts if number(s.get(stat)) is not None]
    ip_sum = sum(ip for _, ip in recent)
    rate = sum(number(s[stat]) for s, _ in recent) * 9 / ip_sum if ip_sum else None
    edge = ((rate - baseline) / scale * (1 if stat == 'k' else -1)) if rate is not None else None
    add('form', 'Recent pitching form', weights[3], edge,
        f"{rate:.2f} {'K/9' if stat == 'k' else 'H/9' if stat == 'hits' else 'ERA'} across {len(recent)} starts / {ip_sum:.2f} innings" if rate is not None else 'Recent pitching sample unavailable',
        min(1, ip_sum / 25, len(recent) / 5))

    pitch_rows = {p.get('pitch_type'): p for p in team_pitch_types or []}
    mix, coverage, sample = 0, 0, 0
    metric, neutral, spread = ('k_pct', 22, 12) if prop_type == 'pitcher_strikeouts' else ('avg', .250, .080) if prop_type == 'pitcher_hits_allowed' else ('woba', .320, .080)
    for pitch in arsenal or []:
        usage = number(pitch.get('pct')) or 0
        row = pitch_rows.get(pitch.get('pitch_type')) or {}
        value, pitch_pa = number(row.get(metric)), number(row.get('pa')) or 0
        if usage < 5 or usage > 100 or value is None or value <= 0 or pitch_pa < 40:
            continue
        pitch_edge = (value - neutral) / spread * (1 if metric == 'k_pct' else -1)
        mix += max(-1, min(1, pitch_edge)) * usage
        coverage += usage
        sample += min(1, pitch_pa / 200) * usage
    mix_ok = 60 <= coverage <= 101
    add('arsenal', 'Pitch-mix fit', weights[4], mix / coverage if mix_ok else None,
        f"Usage-weighted opponent {metric} · {coverage:.0f}% arsenal coverage · posted lineup or active-roster sample",
        min(1, coverage / 100) * sample / coverage if mix_ok else 0)

    avg_outs = sum(ip * 3 for _, ip in valid_starts) / len(valid_starts) if valid_starts else None
    # Longer outings increase every counting stat, including hits and ER.
    exposure_direction = -1 if str(side).lower() == 'under' else 1
    target = number(line) if prop_type == 'pitcher_outs' else 16.5
    target = target if target is not None else 16.5
    add('workload', 'Workload / opportunity', weights[5], (avg_outs - target) / 6 if avg_outs is not None else None,
        f"{avg_outs:.1f} outs/start across {len(valid_starts)} starts · {'compared with line ' + str(target) if prop_type == 'pitcher_outs' else 'recent outing length'}" if avg_outs is not None else 'Recent workload unavailable',
        min(1, len(valid_starts) / 5), exposure_direction)
    pf = number(park_factor)
    add('park', 'Park', weights[6], (1 - pf) / .15 if pf is not None and .5 <= pf <= 1.5 else None,
        f'{pf:.2f} run factor' if pf is not None else 'Park unavailable')
    weather = weather or {}
    dome = bool(weather.get('dome'))
    temp, speed = number(weather.get('temp_f')), number(weather.get('speed_mph'))
    wind = weather.get('hitter_friendly')
    known = not weather.get('error') and (dome or temp is not None or (speed is not None and isinstance(wind, bool)))
    weather_edge = 0 if dome else (max(-.4, min(.4, (70 - temp) / 50)) if temp is not None else 0)
    if not dome and speed is not None and isinstance(wind, bool):
        weather_edge += min(.6, max(0, speed) / 25) * (-1 if wind else 1)
    add('weather', 'Weather', weights[7], weather_edge if known else None,
        'Indoor · neutral' if dome else f"{temp if temp is not None else '—'}°F · wind {speed if speed is not None else '—'} mph" if known else 'Weather unavailable')
    score = max(3, min(97, round(50 + sum(f['impact'] for f in factors))))
    coverage = sum(f['weight'] * f['confidence'] for f in factors) / 100
    label = 'Strong support' if score >= 75 else 'Favorable' if score >= 65 else 'Slight support' if score >= 55 else 'Neutral' if score >= 45 else 'Caution' if score >= 35 else 'Tough matchup'
    if coverage < .5:
        label = 'Limited data · ' + label.lower()
    return dict(score=score, label=label, coverage=round(coverage, 2), factors=factors,
                version='pitcher-context-v2', side=str(side).lower(), market=prop_type)
