"""Resolve builder legs to exact, active PrizePicks MLB projections."""

import re
import threading
import time
import unicodedata

import requests


PRIZEPICKS_PROJECTIONS_URL = (
    "https://partner-api.prizepicks.com/projections"
    "?single_stat=true&league_id=2"
)
PRIZEPICKS_APP_URL = "https://app.prizepicks.com/?projections="
_CACHE_SECONDS = 120
_CACHE_LOCK = threading.Lock()
_PROJECTION_CACHE = {"loaded_at": 0.0, "rows": []}

_STAT_ALIASES = {
    "hitsrunsrbis": "hitsrunsrbis", "hits": "hits", "totalbases": "totalbases",
    "homeruns": "homeruns", "rbis": "rbis", "runsscored": "runs", "runs": "runs",
    "strikeouts": "hitterstrikeouts", "hitterstrikeouts": "hitterstrikeouts",
    "walks": "walks", "pitcherstrikeouts": "pitcherstrikeouts",
    "strikeoutspitcher": "pitcherstrikeouts", "pitchingouts": "pitchingouts",
    "outs": "pitchingouts", "hitsallowed": "hitsallowed",
    "earnedrunsallowed": "earnedrunsallowed", "earnedruns": "earnedrunsallowed",
    "walksallowed": "pitcherwalks", "pitcherwalksallowed": "pitcherwalks",
    "pitcherwalks": "pitcherwalks",
}


def _norm(value):
    ascii_value = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = ascii_value.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", ascii_value.lower())


def _norm_stat(value):
    normalized = _norm(value)
    return _STAT_ALIASES.get(normalized, normalized)


def _fetch_projection_rows():
    now = time.time()
    with _CACHE_LOCK:
        if _PROJECTION_CACHE["rows"] and now - _PROJECTION_CACHE["loaded_at"] < _CACHE_SECONDS:
            return _PROJECTION_CACHE["rows"]

    response = requests.get(
        PRIZEPICKS_PROJECTIONS_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; VORTEX-Private-Research/1.0)",
        },
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("error") or not isinstance(payload.get("data"), list):
        raise RuntimeError(payload.get("error") or "PrizePicks returned an invalid projection feed.")

    players = {
        str(item.get("id")): item.get("attributes") or {}
        for item in payload.get("included", []) if item.get("type") == "new_player"
    }
    rows = []
    for projection in payload["data"]:
        attrs = projection.get("attributes") or {}
        relationships = projection.get("relationships") or {}
        league_id = str(((relationships.get("league") or {}).get("data") or {}).get("id") or "")
        player_id = str(((relationships.get("new_player") or {}).get("data") or {}).get("id") or "")
        player = players.get(player_id) or {}
        if league_id != "2" and str(player.get("league") or "").upper() != "MLB":
            continue
        if attrs.get("status") != "pre_game" or attrs.get("is_live"):
            continue
        if "over" not in str(attrs.get("allowed_wager_types") or "").lower():
            continue
        line = attrs.get("flash_sale_line_score")
        if line is None:
            line = attrs.get("line_score")
        try:
            line = float(line)
        except (TypeError, ValueError):
            continue
        rows.append({
            "id": str(projection.get("id") or ""),
            "player": str(player.get("display_name") or player.get("name") or ""),
            "stat": str(attrs.get("stat_type") or attrs.get("stat_display_name") or ""),
            "line": line,
            "odds_type": str(attrs.get("odds_type") or "standard").lower(),
            "allowed_wager_types": str(attrs.get("allowed_wager_types") or "").lower(),
            "updated_at": str(attrs.get("updated_at") or ""),
        })
    if not rows:
        raise RuntimeError("PrizePicks returned no active MLB projections.")
    with _CACHE_LOCK:
        _PROJECTION_CACHE.update({"loaded_at": now, "rows": rows})
    return rows


def _resolve_legs(legs, rows):
    matches, unmatched, used_ids = [], [], set()
    for leg in legs:
        player = str(leg.get("player") or "").strip()
        stat = str(leg.get("stat") or "").strip()
        side = str(leg.get("side") or "over").strip().lower()
        try:
            line = float(leg.get("line"))
        except (TypeError, ValueError):
            unmatched.append({"player": player, "stat": stat, "line": leg.get("line"), "reason": "Invalid line"})
            continue
        if side not in {"over", "under"}:
            unmatched.append({"player": player, "stat": stat, "line": line, "reason": "Side must be More or Less"})
            continue
        candidates = [
            row for row in rows
            if _norm(row["player"]) == _norm(player)
            and _norm_stat(row["stat"]) == _norm_stat(stat)
            and abs(row["line"] - line) < 0.001
            and row["id"] not in used_ids
        ]
        candidates.sort(key=lambda row: (
            {"standard": 0, "goblin": 1, "demon": 2}.get(row["odds_type"], 3),
            row["updated_at"],
        ))
        if not candidates:
            unmatched.append({"player": player, "stat": stat, "line": line, "reason": "That exact line is not active on PrizePicks"})
            continue
        match = candidates[0]
        # Goblin/Demon alternate projections are More-only in the app even
        # when the partner feed's allowed_wager_types field is overly broad.
        if side == "under" and match["odds_type"] in {"goblin", "demon"}:
            unmatched.append({
                "player": player, "stat": stat, "line": line,
                "reason": f"PrizePicks {match['odds_type'].title()} lines are More-only",
            })
            continue
        if side not in match["allowed_wager_types"]:
            unmatched.append({
                "player": player, "stat": stat, "line": line,
                "reason": f"PrizePicks does not currently offer {side.title()} for that line",
            })
            continue
        used_ids.add(match["id"])
        line_token = f"{match['line']:g}"
        direction_token = "o" if side == "over" else "u"
        matches.append({
            "projectionId": match["id"], "player": player, "stat": match["stat"],
            "line": match["line"], "side": "More" if side == "over" else "Less",
            "oddsType": match["odds_type"],
            "projectionToken": f"{match['id']}-{direction_token}-{line_token}",
        })
    return matches, unmatched


def build_export(legs):
    """Return ``(http_status, response_body)`` for a validated lineup."""
    if not isinstance(legs, list) or not 2 <= len(legs) <= 6:
        return 400, {"error": "A PrizePicks lineup needs 2 to 6 legs."}
    if any(not isinstance(leg, dict) for leg in legs):
        return 400, {"error": "Every lineup leg must be an object."}
    try:
        matches, unmatched = _resolve_legs(legs, _fetch_projection_rows())
    except (requests.RequestException, RuntimeError, ValueError) as exc:
        return 502, {"error": f"PrizePicks projections are temporarily unavailable: {exc}"}
    if unmatched:
        return 409, {
            "error": "PrizePicks changed or removed one or more lines. Rebuild before exporting.",
            "matched": matches, "unmatched": unmatched,
        }
    # PrizePicks' outcome-level deep links encode both direction and line in
    # each projection token (``<id>-o-1.5`` / ``<id>-u-1.5``). A bare ID
    # lets the app choose a default side and can silently turn More into Less.
    projection_ids = ",".join(match["projectionToken"] for match in matches)
    return 200, {
        "url": PRIZEPICKS_APP_URL + projection_ids,
        "matches": matches, "reviewRequired": True,
    }
