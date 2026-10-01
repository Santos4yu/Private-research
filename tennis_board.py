"""PrizePicks' complete pre-game tennis projection board for Finder.

Stat names are deliberately not allowlisted. PrizePicks can add a market
without a deploy and Finder will still show the exact posted name and line.
Historical context is attached separately, so an unknown stat never makes a
real projection disappear.
"""
import re
import threading
import time
from datetime import datetime, timezone

from prizepicks_export_core import _fetch_projection_rows

VERSION = "tennis-board-v2"
CACHE_SECONDS = 2 * 60
_cache = {"at": 0.0, "value": None}
_lock = threading.Lock()


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def market_key(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def build(projections=None, now=None):
    now = time.time() if now is None else now
    if projections is None:
        try:
            projections = _fetch_projection_rows(league="TENNIS")
        except RuntimeError as error:
            if "no active" in str(error).lower():
                projections = []
            else:
                raise
    rows = []
    for line in projections:
        starts = _timestamp(line.get("start_time"))
        if starts is not None and starts <= now:
            continue
        try:
            value = float(line.get("line"))
        except (TypeError, ValueError):
            continue
        player = str(line.get("player") or "").strip()
        stat = str(line.get("stat") or "").strip()
        if not player or not stat:
            continue
        tier = str(line.get("odds_type") or "standard").lower()
        opponent = str(line.get("description") or "").strip() or None
        rows.append({
            "id": f"pp:{line.get('id')}", "projectionId": str(line.get("id") or ""),
            "player": player, "playerId": str(line.get("player_id") or "") or None,
            "opponent": opponent, "headshot": line.get("headshot") or None,
            "position": line.get("position") or None, "stat": stat,
            "marketKey": market_key(stat), "line": value, "modifier": tier,
            "combo": bool(line.get("combo")),
            "allowedWagerTypes": line.get("allowed_wager_types") or "over,under",
            "startsAt": datetime.fromtimestamp(starts, timezone.utc).isoformat() if starts is not None else None,
            "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None,
                      "modifier": tier, "updatedAt": line.get("updated_at") or None}],
        })
    rows.sort(key=lambda row: (row["startsAt"] or "", row["player"], row["stat"], row["line"], row["modifier"]))
    return {"builtAt": datetime.now(timezone.utc).isoformat(), "source": "prizepicks", "rows": rows,
            "version": VERSION, "historyAvailable": True}


def board(force=False):
    now = time.time()
    with _lock:
        if not force and _cache["value"] is not None and now - _cache["at"] < CACHE_SECONDS:
            return _cache["value"]
    value = build(now=now)
    with _lock:
        _cache.update(at=now, value=value)
    return value
