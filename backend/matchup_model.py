"""The MLB hitter matchup grade (0-100): splits against the starter's hand,
the starter's quality, how the hitter does against his pitch mix, career
history against him, recent form, the park and the weather.

Pure arithmetic over numbers the caller has already fetched, so the live
Research card (analyze.py) and the bot's slate-wide read (mlb_prop_matchups.py)
grade a matchup the same way.
"""

MATCHUP_WEIGHTS = {
    "handedness": 23, "pitcher_quality": 22, "arsenal_fit": 15,
    "bvp": 20, "recent_form": 10, "park": 5, "weather": 5,
}


def matchup_score_100(splits, side="over", pitcher=None, bvp=None,
                       park_factor=1.0, weather=None, arsenal=None,
                       bat_vs_pitch=None, vs_hand_splits=None,
                       prop_type="") -> dict:
    """Direction-aware 0-100 matchup grade; thin samples shrink to neutral."""
    is_under = str(side).lower() == "under"
    pitcher, bvp = pitcher or {}, bvp or {}
    factors = []
    clamp = lambda value: max(0.0, min(100.0, float(value)))
    sided = lambda value: 100.0 - clamp(value) if is_under else clamp(value)

    def add(key, raw, detail, available=True, confidence=1.0):
        weight = MATCHUP_WEIGHTS[key]
        confidence = clamp(confidence * 100) / 100 if available else 0.0
        adjusted = 50.0 + ((clamp(raw) - 50.0) * confidence if available else 0.0)
        # Convert the factor grade to its full signed allocation. Confidence
        # shrinkage happens before this conversion, so trustworthy 100/0
        # evidence can earn +/- its full weight while thin samples stay near 0.
        impact = (adjusted - 50.0) / 50.0 * weight
        names = {"handedness": "Splits vs pitcher hand", "pitcher_quality": "Pitcher quality",
                 "arsenal_fit": "Arsenal fit", "bvp": "Career BvP", "recent_form": "Recent form",
                 "park": "Park factor", "weather": "Weather"}
        factors.append({"key": key, "name": names[key], "score": round(adjusted),
                        "impact": round(impact), "weight": weight, "available": bool(available),
                        "confidence": round(confidence, 2), "detail": detail})

    ph = pitcher.get("hand", "")
    hand = (vs_hand_splits or {}).get(ph, {}) if ph in ("L", "R") else {}
    hand_pa = int(hand.get("pa", 0) or 0)
    try: hand_ops = float(str(hand.get("ops", "") or 0))
    except (TypeError, ValueError): hand_ops = 0.0
    try: hand_avg = float(str(hand.get("avg", "") or 0))
    except (TypeError, ValueError): hand_avg = 0.0
    other = (vs_hand_splits or {}).get("L" if ph == "R" else "R", {})
    other_pa = int(other.get("pa", 0) or 0)
    try: other_ops = float(str(other.get("ops", "") or 0))
    except (TypeError, ValueError): other_ops = 0.0
    try: other_avg = float(str(other.get("avg", "") or 0))
    except (TypeError, ValueError): other_avg = 0.0
    hand_ok = hand_pa >= 20 and hand_ops > 0
    delta = hand_ops - other_ops if other_ops > 0 else 0.0
    avg_delta = hand_avg - other_avg if other_avg > 0 else 0.0
    other_label = "L" if ph == "R" else "R"
    detail = f"vs {ph}HP {hand_avg:.3f} AVG / {hand_ops:.3f} OPS ({hand_pa} PA)".replace(" 0.", " .")
    if hand_ok and other_ops > 0: detail += f" · vs {other_label}HP {other_avg:.3f} AVG / {other_ops:.3f} OPS ({hand_avg-other_avg:+.3f} AVG)".replace(" 0.", " .").replace("+0.", "+.").replace("-0.", "-.")
    # This is a *platoon advantage* grade, not a general hitter-quality grade.
    # Use the difference between tonight's AVG split and the opposite-hand
    # split as the primary signal. The 1000-point scale intentionally maps a
    # .020 AVG platoon difference to roughly 9 of the available 23 points.
    # That keeps the factor explainable and matches the observed grading of
    # established split samples much more closely than absolute OPS did.
    if other_ops > 0 and other_avg > 0:
        hand_raw = 50 + avg_delta * 1000
    elif other_ops > 0:
        hand_raw = 50 + delta * 350
    else:
        # With no comparison split, absolute OPS is the only honest fallback.
        hand_raw = 50 + (hand_ops - .720) * 110
    # A platoon edge is a comparison between two samples, so confidence must
    # reflect both sides of that comparison. Reaching the full 23-point
    # allocation after only 50 PA made extreme early-season splits look as
    # trustworthy as established multi-season splits. Use the smaller sample
    # and require roughly 75 PA on each side for full confidence. This still
    # heavily shrinks tiny samples while no longer suppressing established
    # half-season platoon evidence.
    comparison_pa = min(hand_pa, other_pa) if other_ops > 0 else hand_pa
    hand_confidence = min(1.0, comparison_pa / 75.0) ** .6 if hand_ok else 0
    add("handedness", sided(hand_raw),
        detail if hand_ok else "Split unavailable", hand_ok, hand_confidence)
    factors[-1]["name"] = f"Splits vs {ph}HP" if ph in ("L", "R") else "Handedness splits"

    try:
        era, fip = float(pitcher.get("era") or 0), float(pitcher.get("fip") or 0)
        whip, hr9 = float(pitcher.get("whip") or 0), float(pitcher.get("hr_per_9") or 0)
    except (TypeError, ValueError): era = fip = whip = hr9 = 0.0
    pq_ok = era > 0 or fip > 0
    blended = era * .6 + fip * .4 if era and fip else era or fip
    # ERA/FIP establish run prevention; WHIP is the strongest direct traffic
    # signal for batter counting-stat props. Increase both without allowing a
    # noisy ERA alone to overwhelm a healthy FIP/HR rate.
    pitcher_raw = 50 + (blended - 4.10) * 26
    if whip > 0: pitcher_raw += (whip - 1.28) * 35
    if hr9 > 0: pitcher_raw += (hr9 - 1.15) * 8
    pitcher_name = pitcher.get("name") or "Tonight's starter"
    quality_label = "very vulnerable starter" if pitcher_raw >= 75 else "below-average starter" if pitcher_raw >= 60 else "strong starter" if pitcher_raw <= 40 else "roughly average starter"
    pitcher_detail = f"{pitcher_name} · " + (f"{era:.2f} ERA / {fip:.2f} FIP" if fip else f"{blended:.2f} ERA")
    if whip > 0: pitcher_detail += f" · {whip:.2f} WHIP"
    if hr9 > 0: pitcher_detail += f" · {hr9:.2f} HR/9"
    pitcher_detail += f" · {quality_label}"
    # One volatile starter statistic should not consume the entire allocation.
    # Preserve meaningful ace/vulnerable-starter separation while reserving a
    # few points of uncertainty at both extremes.
    pitcher_raw = max(7.0, min(93.0, pitcher_raw))
    add("pitcher_quality", sided(pitcher_raw), pitcher_detail if pq_ok else "Starter metrics unavailable", pq_ok)

    pitch_rows = {r.get("pitch_type"): r for r in (bat_vs_pitch or [])}
    weighted = coverage = confidence_weighted = 0.0
    qualified_pitches = []
    if prop_type == "hits":
        arsenal_metric_key, arsenal_metric_label, arsenal_neutral = "avg", "AVG", .250
    elif prop_type in {"total_bases", "home_runs"}:
        arsenal_metric_key, arsenal_metric_label, arsenal_neutral = "slg", "SLG", .410
    else:
        arsenal_metric_key, arsenal_metric_label, arsenal_neutral = "woba", "wOBA-equivalent", .320
    for pitch in (arsenal or [])[:4]:
        row = pitch_rows.get(pitch.get("pitch_type"))
        if not row: continue
        try:
            # Arsenal fit must reflect the market being researched. Contact
            # props care about AVG, power/base props care about SLG, while
            # combined production props use wOBA/OPS as the broad fallback.
            raw_metric = row.get(arsenal_metric_key) or row.get("woba")
            used_ops_fallback = not raw_metric
            raw_metric = raw_metric or row.get("ops") or 0
            metric = float(str(raw_metric))
            # MLB's pitchArsenal response exposes OPS but not wOBA on some
            # slates. Normalize OPS only for that fallback; never shrink a
            # legitimate SLG value merely because it is above .550.
            if used_ops_fallback and arsenal_metric_key == "woba" and metric > 0:
                metric *= .445
            usage = float(pitch.get("pct", 0) or 0)
            pa = int(float(row.get("pa", 0) or 0))
        except (TypeError, ValueError): continue
        # Include secondary pitches down to 5% usage when the batter has a
        # real 10-PA sample. Excluding an 8% slider can incorrectly turn a
        # well-covered arsenal into "unavailable."
        if metric > 0 and usage >= 5 and pa >= 10:
            weighted += metric * usage; coverage += usage
            # Pitch-type results stabilize much more slowly than the basic
            # ten-PA inclusion floor. Preserve the complete pitch mix, but
            # shrink thin pitch samples toward neutral instead of treating a
            # 10-PA result like a 50-PA result.
            sample_confidence = min(1.0, pa / 50.0) ** .5
            confidence_weighted += usage * sample_confidence
            qualified_pitches.append((usage, pitch, row, metric, sample_confidence))
    # A couple of pitch-type rows must not become the card's largest penalty.
    # Require most of the starter's mix before arsenal evidence can move score.
    mix_ok = coverage >= 60; mix = weighted / coverage if mix_ok else arsenal_neutral
    arsenal_detail = (f"{mix:.3f} weighted {arsenal_metric_label} across {coverage:.0f}% of the starter's mix"
                      if mix_ok else f"Insufficient pitch-mix coverage ({coverage:.0f}% available; 60% required)")
    if mix_ok and qualified_pitches:
        labels = []
        for usage, pitch, row, metric, _sample_confidence in qualified_pitches:
            name = pitch.get("pitch_name") or row.get("pitch_name") or pitch.get("pitch_type") or "Pitch"
            labels.append(f"{name} {usage:.0f}%/{metric:.3f}")
        arsenal_detail = (f"Full mix · {coverage:.0f}% coverage · {mix:.3f} weighted {arsenal_metric_label} · "
                          + ", ".join(labels)).replace(" 0.", " .")
    # .320 is roughly neutral contact quality. A full-mix result around .380
    # is a genuinely strong fit (and .260 a genuinely poor one), so map that
    # observed range across most of the 0-100 factor scale. The previous slope
    # graded a .388 mix at only 61/100 and reduced an obvious arsenal advantage
    # to roughly +2 matchup points.
    arsenal_sample_confidence = (
        confidence_weighted / coverage if mix_ok and coverage else 0.0
    )
    arsenal_coverage_confidence = min(1.0, coverage / 70.0) ** .6 if mix_ok else 0.0
    arsenal_delta = mix - arsenal_neutral
    # AVG and SLG operate on different natural ranges. These slopes make a
    # clearly good/bad full-mix matchup matter without letting it dominate.
    if arsenal_metric_label == "AVG":
        arsenal_slope = 600.0 if arsenal_delta >= 0 else 520.0
    elif arsenal_metric_label == "SLG":
        arsenal_slope = 360.0 if arsenal_delta >= 0 else 320.0
    else:
        arsenal_slope = 500.0 if arsenal_delta >= 0 else 420.0
    add("arsenal_fit", sided(50 + arsenal_delta * arsenal_slope),
        arsenal_detail,
        mix_ok, arsenal_sample_confidence * arsenal_coverage_confidence)

    bvp_ab = int(bvp.get("ab", 0) or 0)
    try:
        avg_text = str(bvp.get("avg") or ".000"); bvp_avg = float("0" + avg_text) if avg_text.startswith(".") else float(avg_text)
    except (TypeError, ValueError): bvp_avg = 0.0
    # BvP stays heavily regressed, but 3+ AB can provide a small contextual
    # nudge. Five AB can move only about three points; a one-AB anecdote stays
    # neutral. This avoids both ignoring 2-for-5 history and overrating it.
    bvp_ok = bvp_ab >= 3
    bvp_sample = "large sample" if bvp_ab >= 20 else "moderate sample" if bvp_ab >= 10 else "small sample"
    add("bvp", sided(50 + (bvp_avg - .250) * 500),
        f"{bvp.get('hits', 0)}-for-{bvp_ab} ({bvp_avg:.3f} AVG) vs {pitcher_name} · {bvp_sample}".replace("(0.", "(.") if bvp_ok else f"No meaningful history vs {pitcher_name}",
        bvp_ok, min(1.0, bvp_ab / 30) if bvp_ok else 0)

    parts, form_weights = [], []
    for key, weight in (("l10", .55), ("l20", .30), ("l5", .15)):
        item = (splits or {}).get(key) or {}; rate = item.get("rate")
        if rate is not None and item.get("games", 0):
            parts.append(((100 - rate) if is_under else rate) * weight); form_weights.append(weight)
    batting_form = (splits or {}).get("recent_batting_form") or {}
    if batting_form.get("delta_pct") is not None:
        delta_pct = float(batting_form["delta_pct"])
        # Treat changes inside five percent as normal variance. Beyond that,
        # recent form rises gradually rather than instantly consuming almost
        # the full ten-point allocation.
        form_edge = max(0.0, abs(delta_pct) - 5.0) * 2.4
        form_score = sided(50 + (form_edge if delta_pct >= 0 else -form_edge))
        form_ok = True
        form_detail = f"L10 OPS {batting_form.get('l10_ops'):.3f} vs season {batting_form.get('season_ops'):.3f} ({delta_pct:+.1f}%)".replace(" 0.", " .")
    else:
        form_ok = bool(form_weights); form_score = sum(parts) / sum(form_weights) if form_ok else 50
        form_detail = f"Weighted recent hit rate {form_score:.0f}%" if form_ok else "Recent sample unavailable"
    add("recent_form", form_score, form_detail, form_ok)

    try: pf = float(park_factor or 1.0)
    except (TypeError, ValueError): pf = 1.0
    park_label = "hitter-friendly" if pf >= 1.04 else "pitcher-friendly" if pf <= .96 else "roughly neutral"
    add("park", sided(50 + (pf - 1.0) * 250), f"{pf:.2f} run factor · {park_label}")
    weather = weather or {}; weather_ok = bool(weather) and not weather.get("error") and not weather.get("dome")
    weather_over, weather_detail = 50.0, "Dome / indoor · neutral conditions" if weather.get("dome") else "Weather unavailable"
    if weather_ok:
        speed = float(weather.get("speed_mph", 0) or 0); friendly = weather.get("hitter_friendly")
        if friendly is True: weather_over += min(25, speed * 1.5)
        elif friendly is False: weather_over -= min(25, speed * 1.5)
        temp = weather.get("temp_f")
        # Temperature is a modifier to a known wind direction, not a standalone
        # edge. A crosswind/unknown wind stays neutral.
        if temp is not None and friendly is not None:
            weather_over += max(-10, min(10, (float(temp) - 70) * .5))
        weather_detail = f"{weather.get('temp_f', '—')}°F, {speed:.0f} mph wind"
    add("weather", sided(weather_over), weather_detail, weather_ok)

    # BvP is an optional modifier; a first-time matchup can still have complete
    # core evidence. Coverage therefore measures the six repeatable inputs.
    core_factors = [f for f in factors if f["key"] != "bvp"]
    core_weight = sum(f["weight"] for f in core_factors)
    data_coverage = (sum(f["weight"] for f in core_factors if f["available"]) / core_weight
                     if core_weight else 0.0)
    # A matchup grade can be exceptional without implying certainty. Reserve
    # a small amount of uncertainty even when every available factor aligns.
    score = max(0, min(97, round(50 + sum(f["impact"] for f in factors))))
    strong_support = sum(
        1 for f in factors if f["available"]
        and f["impact"] >= max(3, round(f["weight"] * .35))
    )
    meaningful_drags = sum(
        1 for f in factors if f["available"]
        and f["impact"] <= -max(3, round(f["weight"] * .25))
    )
    # Elite grades require three independent supporting signals. Do not add a
    # separate 95+ ceiling: a fully aligned three-pillar matchup can genuinely
    # reach 100, while one split or one noisy factor still cannot get there.
    if score >= 85 and (strong_support < 3 or meaningful_drags >= 2):
        score = 84
    if score >= 85: label = "Elite Matchup"
    elif score >= 75: label = "Strong Matchup"
    elif score >= 65: label = "Favorable"
    elif score >= 55: label = "Slight Edge"
    elif score >= 45: label = "Neutral"
    elif score >= 35: label = "Caution"
    else: label = "Unfavorable"
    return {"score": score, "label": label, "coverage": round(data_coverage, 2), "factors": factors}
