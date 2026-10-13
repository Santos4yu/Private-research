"""The Finder's soccer lines, from PrizePicks' own soccer feed.

PrizePicks keeps every competition it covers (Premier League, La Liga, MLS,
Champions League...) under one soccer league, so one feed read gives the
whole board. Each line comes as PrizePicks posts it -- its stat name, tier
and opponent -- pinned to its ESPN match (soccer_research.py) so the Finder
can load both teams' recent matches for the hit rates and player page.
"""
import re
import threading
import time
from datetime import datetime, timezone

from prizepicks_export_core import _fetch_projection_rows

VERSION = "soccer-board-v3"
CACHE_SECONDS = 5 * 60
_cache = {"at": 0.0, "value": None}
_lock = threading.Lock()


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


# PrizePicks spells soccer positions out; the board shows them short.
_POSITIONS = {"goalkeeper": "GK", "goalie": "GK", "defender": "D", "midfielder": "M", "attacker": "F", "forward": "F", "striker": "F"}


def _position(value):
    text = str(value or "").strip()
    return _POSITIONS.get(text.lower(), text) or None


def market_key(stat):
    return re.sub(r"[^a-z0-9]", "", str(stat or "").lower())


def _projections():
    try:
        return _fetch_projection_rows(league="SOCCER")
    except RuntimeError as error:
        # "no active projections" -- an empty slate, not an outage.
        if "no active" in str(error).lower():
            return []
        raise


def _fixtures(now, projections=None):
    """(fixtures, report): the ESPN matches the lines can belong to, and how
    fetching them went (shown to admins on the board)."""
    try:
        from soccer_research import fixture_scan, _scoreboard, _cached, fetch_error
        from concurrent.futures import ThreadPoolExecutor
        # International slates often contain thousands of lines for only a
        # handful of dates. Try their competition first; scan all leagues
        # only when actual lines remain unmatched.
        dates = sorted({datetime.fromtimestamp(stamp, timezone.utc).date()
                        for line in (projections or [])
                        if (stamp := _timestamp(line.get("start_time"))) is not None and stamp > now})
        if dates and len(dates) <= 7:
            def load(day):
                try:
                    return _cached(f"soccer:nations-day:v3:{day}", 600,
                                   lambda: _scoreboard("uefa.nations", day, day)), None
                except Exception as error:
                    return [], fetch_error(error)
            with ThreadPoolExecutor(max_workers=7) as pool:
                results = list(pool.map(load, dates))
            early = [game for batch, _ in results for game in batch]
            if early:
                found = {}
                active = [line for line in projections if not line.get("combo")
                          and (_timestamp(line.get("start_time")) or 0) > now]
                if active and all(_match_info(line, early, found) for line in active):
                    return early, {"source": "uefa.nations", "requests": len(dates), "found": len(early), "errors": {}}
        scan = fixture_scan(now)
        return scan["fixtures"], scan["report"]
    except Exception as error:
        return [], {"errors": {f"{type(error).__name__}: {error}"[:120]: 1}}


def _match_info(line, fixture_list, found):
    from soccer_research import match_fixture
    key = (line.get("team"), line.get("description"), line.get("start_time"))
    if key not in found:
        found[key] = match_fixture(line.get("team"), line.get("description"), line.get("start_time"), fixture_list,
                                   team_name=line.get("team_name")) if fixture_list else None
    return found[key]


def build(projections=None, now=None, fixture_list=None):
    """Every upcoming single-player soccer line PrizePicks posts."""
    now = now or time.time()
    projections = _projections() if projections is None else projections
    report = None
    if fixture_list is None:
        fixture_list, report = _fixtures(now, projections)
    found = {}
    rows = []
    for line in projections:
        if line.get("combo"):
            continue
        starts = _timestamp(line.get("start_time"))
        if starts is not None and starts <= now:
            continue
        try:
            value = float(line.get("line"))
        except (TypeError, ValueError):
            continue
        tier = str(line.get("odds_type") or "standard").lower()
        info = _match_info(line, fixture_list, found)
        game = {}
        if info:
            team, opponent = info["team"], info["opponent"]
            game = {"eventId": info["eventId"], "competition": info["league"], "competitionName": info["leagueName"],
                    "teamId": team["id"], "teamName": team["name"] or line.get("team"), "teamLogo": team["logo"], "opponentId": opponent["id"],
                    "opponentName": opponent["name"] or line.get("description"), "opponentLogo": opponent["logo"], "isHome": info["isHome"],
                    "homeTeamAbbr": info["homeTeam"]["abbr"] or None, "awayTeamAbbr": info["awayTeam"]["abbr"] or None,
                    "winChance": info["winChance"], "drawChance": info["drawChance"]}
        rows.append({
            "id": f"pp:{line.get('id')}", "player": line.get("player"),
            # Matched, the teams go by ESPN's short codes (ARS, AZE) so the
            # match logs' opponents and head-to-head line up with them.
            "team": (info and info["team"]["abbr"]) or line.get("team") or None,
            "opponent": (info and info["opponent"]["abbr"]) or line.get("description") or None,
            "position": _position(line.get("position")),
            "headshot": line.get("headshot") or None, "stat": line.get("stat"), "marketKey": market_key(line.get("stat")),
            "line": value, "modifier": tier, "promo": bool(line.get("promo")),
            "startsAt": datetime.fromtimestamp(starts, timezone.utc).isoformat() if starts is not None else None,
            "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None, "modifier": tier,
                      "updatedAt": line.get("updated_at") or None}],
            **game,
        })
    rows.sort(key=lambda row: (row["startsAt"] or "", row["player"] or "", row["stat"] or "", row["line"]))
    # How many lines found their match, and why not when they didn't -- the
    # board shows this to admins.
    unmatched = [row for row in rows if not row.get("eventId")]
    seen, sample = set(), []
    for row in unmatched:
        key = (row["team"], row["opponent"], row["startsAt"])
        if key not in seen and len(sample) < 6:
            seen.add(key)
            sample.append({"team": row["team"], "opponent": row["opponent"], "startsAt": row["startsAt"]})
    diagnostics = {"fixtures": len(fixture_list), "lines": len(rows), "matched": len(rows) - len(unmatched),
                   "scan": report, "unmatched": sample}
    return {"builtAt": datetime.now(timezone.utc).isoformat(), "source": "prizepicks", "rows": rows, "version": VERSION,
            "diagnostics": diagnostics}


def board():
    """build(), shared for a few minutes across requests on a warm instance."""
    now = time.time()
    with _lock:
        if _cache["value"] is not None and now - _cache["at"] < CACHE_SECONDS:
            return _cache["value"]
    value = build(now=now)
    with _lock:
        _cache.update(at=now, value=value)
    return value
