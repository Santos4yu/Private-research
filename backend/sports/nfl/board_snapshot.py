"""A prebuilt NFL props board, so opening the tab never runs a scan.

This is the MLB board's architecture, applied to NFL. MLB props load
instantly because nothing about viewing them does any work: a scan runs out
of band (Vercel cron, or the admin panel), writes the finished board to the
KV store as one blob, and api/v2-board.py just reads it back -- its own
docstring says it "never triggers a scan itself, so browsing this tab never
spends odds credits."

NFL had no such step. The browser drove a live 16-game scan, one request per
game, each one a paid Odds API call for 13 markets -- roughly 200 credits
for a full slate, every time the cache lapsed. That is why it counted games
on screen while MLB was simply there.

Building here changes nothing about HOW the board is computed: it calls the
same game_board() the live scan calls, so a row is identical either way.
The only difference is who pays for it and when.
"""
from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from .research_board import game_board
from .services import nflverse, odds

# Namespaced like the rest of this sport's keys (see odds.NFL_KEY_STORAGE).
NFL_BOARD_KEY = "krazy_data:nfl:board_v1"
# The board is a shortlist, not a dump of every posted line. Capping keeps
# the stored blob comfortably inside a KV record and matches what the screen
# can actually show.
MAX_ROWS = 400
LOOKAHEAD_DAYS = 7


def _store():
    from v2.board import store
    return store


def upcoming_events(season: int) -> list[dict]:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=LOOKAHEAD_DAYS)
    listing = odds.events(season)
    return [
        event for event in listing.get("data", [])
        if (start := odds.timestamp(event.get("startsAt"))) and now < start < horizon
    ]


def build_board(season: int) -> dict:
    """Scan every upcoming game once and return the finished board.

    game_board() is already cached per event, so a build that runs while a
    previous one is still warm costs no Odds API credits at all.
    """
    events = upcoming_events(season)
    rows: list[dict] = []
    failed = 0
    if events:
        # Same width the browser used, for the same reason: the per-event
        # cost is dominated by one network round trip, not by CPU.
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(game_board, season, event["eventId"]) for event in events]
            for future in futures:
                try:
                    rows.extend(future.result().get("data", []))
                except Exception:  # noqa: BLE001 -- one bad game must not lose the slate
                    failed += 1
    # Best support first, so a cap keeps the rows worth showing.
    rows.sort(key=lambda row: row.get("support") or 0, reverse=True)
    return {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "events": events,
        "rows": rows[:MAX_ROWS],
        "rowsAvailable": len(rows),
        "gamesScanned": len(events) - failed,
        "gamesFailed": failed,
    }


def store_board(season: int) -> dict:
    """Build and persist. Returns the payload actually stored."""
    payload = build_board(season)
    _store().set(NFL_BOARD_KEY, json.dumps(payload))
    return payload


def stored_board() -> dict | None:
    """Read the last stored board. Never scans, never spends credits."""
    try:
        raw = _store().get(NFL_BOARD_KEY)
    except Exception:  # noqa: BLE001 -- a KV outage is "no snapshot", not an error
        return None
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None
