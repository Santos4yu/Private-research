"""Explainable pitcher context, separate from calibrated probability and tiers.

Weights are heuristic allocations, not fitted probabilities. Missing and thin
inputs shrink to neutral; market/side determine which direction supports a prop.
"""
import math
from matchup_ratings import finalize


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


def _strikeout_grade(*, k_card, opp_k, opponent_offense, arsenal,
                     team_pitch_types, side, line):
    season = (k_card or {}).get('season_stats') or {}
    starts = (k_card or {}).get('last_5_starts') or []
    is_under = str(side).lower() == 'under'
    line_value = number(line)
    factors = []

    def directed(score):
        score = max(0, min(100, score))
        return 100 - score if is_under else score

    def add(key, name, weight, score, detail, confidence=1):
        available = score is not None and confidence > 0
        confidence = max(0, min(1, confidence)) if available else 0
        final_score = directed(score) if available else 50
        impact = (final_score - 50) / 50 * weight * confidence if available else 0
        factors.append(dict(key=key, name=name, weight=weight,
                            score=round(final_score), impact=round(impact, 1),
                            available=available, confidence=round(confidence, 2),
                            detail=detail))

    league_k = 22.0
    offense = opponent_offense or {}
    metrics = {row.get('key'): row for row in offense.get('metrics', [])}
    hand_row = metrics.get('k_pct') or {}
    hand_rate = number(hand_row.get('value'))
    hand_pa = number((offense.get('totals') or {}).get('plate_appearances'))
    venue_rate = number((opp_k or {}).get('k_pct'))
    venue_pa = number((opp_k or {}).get('pa'))
    season_rate = number((opp_k or {}).get('season_k_pct'))
    season_pa = number((opp_k or {}).get('season_pa'))
    if season_rate is None and not (opp_k or {}).get('season_rank'):
        season_rate, season_pa = venue_rate, venue_pa

    sources = []
    for rate, pa, weight in ((season_rate, season_pa, .35),
                             (hand_rate, hand_pa, .40),
                             (venue_rate, venue_pa, .25)):
        if rate is None or not pa:
            continue
        reliability = pa / (pa + 180)
        sources.append((league_k + (rate - league_k) * reliability, weight, rate, pa))
    opponent_rate = (sum(rate * weight for rate, weight, _, _ in sources)
                     / sum(weight for _, weight, _, _ in sources)) if sources else None
    add('k_pct', 'Opponent strikeout profile', 25,
        50 + (opponent_rate - league_k) * 9 if opponent_rate is not None else None,
        f'{opponent_rate:.1f}% stabilized current-season K rate' if opponent_rate is not None else 'Opponent K data unavailable')

    pitcher_k_pct = number(season.get('k_pct'))
    pitcher_k9 = number(season.get('k_per_9'))
    season_gs = number(season.get('games_started'))
    season_bf = number(season.get('batters_faced'))
    season_ks = number(season.get('strikeouts') or season.get('strike_outs'))
    if pitcher_k_pct is None and season_ks is not None and season_bf:
        pitcher_k_pct = season_ks / season_bf * 100
    skill_parts = []
    if pitcher_k_pct is not None:
        skill_parts.append((50 + (pitcher_k_pct - 22) * 4, .55))
    if pitcher_k9 is not None:
        skill_parts.append((50 + (pitcher_k9 - 8.5) * 8, .45))
    skill = (sum(value * weight for value, weight in skill_parts) /
             sum(weight for _, weight in skill_parts)) if skill_parts else None
    skill_confidence = min(1, .4 + .6 * min(1, (season_gs or 0) / 10)) if skill is not None else 0
    skill_detail = 'Pitcher season data unavailable'
    if skill is not None:
        detail_parts = []
        if pitcher_k_pct is not None:
            detail_parts.append(f'{pitcher_k_pct:.1f}% K')
        if pitcher_k9 is not None:
            detail_parts.append(f'{pitcher_k9:.1f} K/9')
        skill_detail = ' · '.join(detail_parts) + (f' · {int(season_gs)} GS' if season_gs else '')
    add('skill', 'Current-season K skill', 20, skill,
        skill_detail, skill_confidence)

    season_ip = innings({'ip': season.get('innings_pitched')})
    recent_ip = [innings(start) for start in starts[:5]]
    recent_ip = [value for value in recent_ip if value is not None and value > 0]
    season_ip_start = season_ip / season_gs if season_ip and season_gs else None
    recent_ip_start = sum(recent_ip) / len(recent_ip) if recent_ip else None
    projected_ip = (season_ip_start * .65 + recent_ip_start * .35
                    if season_ip_start and recent_ip_start else season_ip_start or recent_ip_start)
    projected_k = None
    if pitcher_k_pct is not None and season_bf and season_ip and projected_ip and opponent_rate is not None:
        projected_k = projected_ip * (season_bf / season_ip) * pitcher_k_pct * (opponent_rate / league_k) / 100
    elif pitcher_k9 is not None and projected_ip and opponent_rate is not None:
        projected_k = pitcher_k9 * projected_ip / 9 * (opponent_rate / league_k)
    add('projection', 'Projection vs line', 25,
        50 + (projected_k - line_value) * 20 if projected_k is not None and line_value is not None else None,
        f'{projected_k:.1f} projected Ks vs {line_value:g}' if projected_k is not None and line_value is not None else 'Projection unavailable')
    add('workload', 'Projected workload', 12,
        50 + (projected_ip - 5.3) * 20 if projected_ip is not None else None,
        f'{projected_ip:.1f} projected innings' if projected_ip is not None else 'Workload unavailable')

    recent_ks = [number(start.get('k')) for start in starts[:5]]
    recent_ks = [value for value in recent_ks if value is not None]
    recent_avg = sum(recent_ks) / len(recent_ks) if len(recent_ks) >= 3 else None
    add('form', 'Recent strikeout output', 8,
        50 + (recent_avg - line_value) * 12 if recent_avg is not None and line_value is not None else None,
        f'{recent_avg:.1f} Ks/start over last {len(recent_ks)}' if recent_avg is not None else 'Recent sample unavailable',
        min(1, len(recent_ks) / 5))

    pitch_rows = {row.get('pitch_type'): row for row in team_pitch_types or []}
    mix = coverage = sample = 0
    for pitch in arsenal or []:
        usage = number(pitch.get('pct')) or 0
        row = pitch_rows.get(pitch.get('pitch_type')) or {}
        rate, pa = number(row.get('k_pct')), number(row.get('pa')) or 0
        if usage < 5 or rate is None or pa < 40:
            continue
        mix += max(0, min(100, 50 + (rate - league_k) * 5)) * usage
        coverage += usage
        sample += min(1, pa / 200) * usage
    mix_ok = coverage >= 60
    add('arsenal', 'Lineup vs pitch mix', 10, mix / coverage if mix_ok else None,
        f'{coverage:.0f}% arsenal coverage · current-season batter results' if mix_ok else 'Pitch-mix sample unavailable',
        sample / coverage if mix_ok else 0)

    return dict(**finalize(factors, hitter=False, raw_scores=True), side=str(side).lower(),
                market='pitcher_strikeouts', projected_ks=round(projected_k, 2) if projected_k is not None else None,
                projected_ip=round(projected_ip, 2) if projected_ip is not None else None)


def pitcher_matchup_grade(*, k_card, opp_k=None, splits=None,
                          opponent_offense=None, prop_type='pitcher_strikeouts',
                          park_factor=None, weather=None, umpire=None,
                          arsenal=None, team_pitch_types=None, side='over', line=None):
    if prop_type not in WEIGHTS:
        return dict(**finalize([], hitter=False), side=str(side).lower(), market=prop_type)
    if prop_type == 'pitcher_strikeouts':
        return _strikeout_grade(
            k_card=k_card or {}, opp_k=opp_k or {},
            opponent_offense=opponent_offense or {}, arsenal=arsenal or [],
            team_pitch_types=team_pitch_types or [], side=side, line=line,
        )
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

    def metric_text(key):
        value = number((metrics.get(key) or {}).get('value'))
        if value is None:
            return '—'
        if key == 'avg':
            return f'{value:.3f}'.lstrip('0')
        if key in ('k_pct', 'bb_pct'):
            return f'{value:.1f}'
        return f'{value:.2f}'

    # AVG directly supports hits; run/HR production broadens the ER/outs view.
    offense_keys = [('avg', 1)] if prop_type == 'pitcher_hits_allowed' else [('avg', .5), ('runs_pg', .3), ('hr_pg', .2)]
    valid = [(rank(key), weight) for key, weight in offense_keys if rank(key) is not None]
    edge = sum(r * w for r, w in valid) / sum(w for _, w in valid) if valid else None
    add('offense', 'Opponent offense quality', weights[0], edge,
        (' · '.join(f"{key}: {metric_text(key)} (#{int(number(metrics[key].get('rank')) or 0)}/30)" for key, _ in offense_keys if rank(key) is not None)
         + ' · AVG vs hand; R/HR full season') if valid else 'Opponent offense unavailable',
        team_conf * sum(w for _, w in valid))
    for key, name, weight in [('k_pct', 'Opponent K%', weights[1]), ('bb_pct', 'Opponent BB%', weights[2])]:
        row = metrics.get(key) or {}
        add(key, name, weight, rank(key),
            f"{metric_text(key)}% vs pitcher hand · rank #{int(number(row.get('rank')) or 0)}/30 · {int(pa or 0)} PA",
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
    return dict(**finalize(factors, hitter=False), side=str(side).lower(), market=prop_type)
