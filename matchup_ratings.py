"""One rating contract for published matchup snapshots and live Research.

A rating is a context score, not a probability. Published totals are never
trusted: recompute from the explanatory factors, preserving their provenance.
"""
from copy import deepcopy
from datetime import datetime, timezone
import math

VERSION = "krazy-matchup-2026-09-19"
HITTER_WEIGHTS = {"handedness": 23, "pitcher_quality": 22, "arsenal_fit": 15,
                  "bvp": 20, "recent_form": 10, "park": 5, "weather": 5}
BOARD_MARKETS = {"Fantasy Score (PP)": "Fantasy Score", "Strikeouts": "Strikeouts (Pitcher)",
                 "Outs": "Pitching Outs", "Earned Runs": "Earned Runs Allowed"}
PITCHER_MARKETS = {"Strikeouts", "Outs", "Hits Allowed", "Earned Runs", "Walks Allowed"}


def number(value):
    if value is None or isinstance(value, bool) or value == "":
        return None
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def label(score, coverage):
    if score is None:
        return "Rating unavailable"
    band = ("Elite Matchup" if score >= 85 else "Strong Matchup" if score >= 75
            else "Favorable" if score >= 65 else "Slight Edge" if score >= 55
            else "Neutral" if score >= 45 else "Caution" if score >= 35 else "Unfavorable")
    return f"Limited data · {band}" if coverage < .65 else band


def finalize(factors, *, hitter=True, raw_scores=False):
    """Aggregate once, shrink raw factors, and measure confidence, not presence.

Hitter factor scores already include sample shrinkage. Pitcher factor scores
are raw and must be shrunk here. Missing weights stay neutral in the total.
"""
    rows, seen, total_impact = [], set(), 0.0
    for source in factors or []:
        if not isinstance(source, dict):
            continue
        key = source.get("key") or source.get("name")
        if not key or key in seen:
            continue
        seen.add(key)
        weight = HITTER_WEIGHTS.get(key) if hitter else number(source.get("weight"))
        if weight is None or not 0 < weight <= 100:
            continue
        score = number(source.get("score"))
        confidence = number(source.get("confidence"))
        # Older pitcher snapshots omitted confidence entirely. They cannot
        # claim full evidence or elite status until the current model runs.
        if confidence is None:
            confidence = .5 if raw_scores else 0
        available = source.get("available", score is not None) and score is not None and 0 <= score <= 100
        confidence = max(0, min(1, confidence)) if available else 0
        # Hitter factors are already sample-shrunk by analyze.py. Pitcher
        # strikeout factors pass raw directional scores and are shrunk here.
        adjusted = 50 + (score - 50) * confidence if raw_scores else score
        adjusted = max(0, min(100, adjusted)) if confidence else 50
        # Dividing by 50 doubles every edge and creates a -50..150 scale.
        # A weighted mean needs /100; missing factors occupy neutral weight.
        impact = (adjusted - 50) * weight / 100
        total_impact += impact
        rows.append({**source, "key": key, "weight": weight, "score": round(adjusted, 2),
                     "confidence": confidence, "available": bool(confidence), "impact": round(impact, 2)})
    # Unknown/missing hitter inputs must still occupy their allocation.
    if hitter:
        for key, weight in HITTER_WEIGHTS.items():
            if not any(row["key"] == key for row in rows):
                rows.append(dict(key=key, name=key.replace("_", " ").title(), weight=weight,
                                 score=50, confidence=0, available=False, impact=0,
                                 detail="Data unavailable"))
    core = [row for row in rows if not (hitter and row["key"] == "bvp")]
    denominator = 80 if hitter else 100
    coverage = min(1, sum(row["weight"] * row["confidence"] for row in core) / denominator)
    if not coverage or sum(row["weight"] for row in rows) > 100:
        return dict(score=None, label="Rating unavailable", coverage=0, factors=rows, version=VERSION)
    score = max(3, min(97, round(50 + total_impact)))
    # Strong/elite claims require enough reliable evidence. Cap both extremes
    # so sparse information cannot produce a near-certain negative either.
    cap = 74 if coverage < .65 else 84 if coverage < .80 else 97
    score = max(100 - cap, min(cap, score))
    support = sum(row["impact"] >= max(1.5, row["weight"] * .175) for row in rows)
    drags = sum(row["impact"] <= -max(1.5, row["weight"] * .125) for row in rows)
    if score >= 85 and (support < 3 or drags >= 2):
        score = 84
    return dict(score=score, label=label(score, coverage), coverage=round(coverage, 3),
                factors=rows, version=VERSION)


def context(row, data):
    stats = row.get("stats") or {}
    return {"playerId": stats.get("player_id"), "gameId": stats.get("game_pk"),
            "opponentId": stats.get("opponent_team_id"),
            "pitcherId": (stats.get("pitcher") or {}).get("pitcher_id"),
            "stat": BOARD_MARKETS.get(row.get("stat_type"), row.get("stat_type")), "line": number(row.get("line")),
            "side": str(stats.get("side") or row.get("side") or "").lower(),
            "date": data.get("date"), "updatedAt": data.get("generated_at"), "source": "board"}


def _fresh(stamp):
    try:
        parsed = datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
        age = (datetime.now(timezone.utc) - parsed).total_seconds()
        return -300 <= age <= 24 * 3600
    except (TypeError, ValueError):
        return False


def prepare_board(data, games=None):
    """Fast arithmetic only; never start hundreds of live player lookups."""
    result = deepcopy(data)
    snapshots = {}
    for collection in ("props", "matchup_research", "pitcher_research"):
        for row in result.get(collection) or []:
            if row.get("sport") != "MLB":
                continue
            stats = row.get("stats")
            if not isinstance(stats, dict):
                stats = row["stats"] = {}
            identity = context(row, result)
            key = tuple(identity.get(k) for k in ("playerId", "gameId", "opponentId", "pitcherId", "stat", "line", "side"))
            hitter = not stats.get("is_pitcher") and row.get("stat_type") not in PITCHER_MARKETS
            valid = (identity["playerId"] and identity["gameId"] and identity["opponentId"]
                     and identity["line"] is not None and identity["side"] in {"over", "under"}
                     and (not hitter or identity["pitcherId"]) and _fresh(identity["updatedAt"]))
            if games is not None:
                game = next((game for game in games if game.get("game_pk") == identity["gameId"]), None)
                valid = valid and game is not None
                if game:
                    opponent_side = "home" if game.get("home_id") == identity["opponentId"] else "away"
                    valid = valid and game.get(f"{opponent_side}_id") == identity["opponentId"]
                    if hitter:
                        valid = valid and game.get(f"{opponent_side}_pitcher_id") == identity["pitcherId"]
            if key not in snapshots:
                raw_scores = not hitter and stats.get("matchup_version") != VERSION
                rating = finalize(stats.get("matchup_factors"), hitter=hitter, raw_scores=raw_scores) if valid else finalize([])
                snapshots[key] = rating
            rating = snapshots[key]
            stats.update(matchup_score=rating["score"], matchup_label=rating["label"],
                         matchup_coverage=rating["coverage"], matchup_factors=rating["factors"],
                         matchup_version=VERSION, matchup_context=identity)
    return result


def reconcile_research(result, board, *, stat):
    """Use the same regraded snapshot only for the exact researched matchup.

Changing stat, line, side, game, opponent or starter leaves the live grade
intact. This never copies an unverified published headline into Research.
"""
    identity = result.get("matchupContext") or {}
    if not identity.get("playerId") or not identity.get("gameId"):
        return result
    for collection in ("props", "matchup_research", "pitcher_research"):
        for row in board.get(collection) or []:
            stats = row.get("stats") or {}
            source = stats.get("matchup_context") or {}
            if (stats.get("matchup_version") != VERSION or number(stats.get("matchup_score")) is None
                    or source.get("stat") != stat or not _fresh(source.get("updatedAt"))):
                continue
            fields = ("playerId", "gameId", "opponentId", "pitcherId", "line", "side")
            if all(source.get(field) == identity.get(field) for field in fields):
                return {**result, "matchupScore": stats["matchup_score"], "matchupLabel": stats["matchup_label"],
                        "matchupCoverage": stats["matchup_coverage"], "matchupFactors": stats["matchup_factors"],
                        "matchupVersion": VERSION, "matchupContext": source}
    return result
