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

import base64
import gzip
import json
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
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
# Both the cron and the read-path build run inside a 60s Vercel function. A
# full cold slate measured ~29s locally, which is inside that but not by
# much, and a Lambda is slower than a laptop. Rather than risk the whole
# build dying at the limit with nothing stored, stop at this deadline and
# store what finished -- a partial board beats no board, and because each
# game's result is cached for 10 minutes the next run starts with most of
# them already done and completes the rest quickly.
BUILD_DEADLINE_SECONDS = 40
# How long a partial board is left alone before a read triggers the second
# pass that finishes it.
PARTIAL_RETRY_SECONDS = 60


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


def build_board(season: int, deadline_seconds: float | None = BUILD_DEADLINE_SECONDS) -> dict:
    """Scan every upcoming game once and return the board.

    game_board() is already cached per event, so a build that runs while a
    previous one is still warm costs no Odds API credits at all.

    Stops at `deadline_seconds` and returns what finished, flagged partial.
    """
    events = upcoming_events(season)
    rows: list[dict] = []
    failed = 0
    scanned = 0
    partial = False
    if events:
        started = time.monotonic()
        # Same width the browser used, for the same reason: the per-event
        # cost is dominated by one network round trip, not by CPU.
        # Not a context manager: its __exit__ waits for running tasks, which
        # is exactly what a deadline must not do.
        executor = ThreadPoolExecutor(max_workers=5)
        try:
            # max_line_age=None: store every posted prop. The live window is
            # applied when the board is READ, not when it is built.
            futures = [executor.submit(game_board, season, event["eventId"], None) for event in events]
            for future in futures:
                remaining = None
                if deadline_seconds is not None:
                    remaining = deadline_seconds - (time.monotonic() - started)
                    if remaining <= 0:
                        partial = True
                        break
                try:
                    rows.extend(future.result(timeout=remaining).get("data", []))
                    scanned += 1
                except FuturesTimeout:
                    partial = True
                    break
                except Exception:  # noqa: BLE001 -- one bad game must not lose the slate
                    failed += 1
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
    # Best support first, so a cap keeps the rows worth showing.
    rows.sort(key=lambda row: row.get("support") or 0, reverse=True)
    return {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "season": season,
        "events": events,
        "rows": rows[:MAX_ROWS],
        "rowsAvailable": len(rows),
        "gamesScanned": scanned,
        "gamesFailed": failed,
        "gamesTotal": len(events),
        "partial": partial,
    }


# The board is written straight to the KV store, which has a per-record
# limit. 400 rows measured ~1.6KB each, so an uncompressed blob lands around
# 640KB -- close enough to the limit that a busy slate would start failing
# the write silently, leaving the tab scanning live forever. Same gzip
# envelope the NFL cache uses (see cache.py), and the row count is trimmed
# to fit rather than letting the write fail.
_GZIP_PREFIX = "gz:"
_COMPRESS_OVER = 32 * 1024
_MAX_BYTES = 800 * 1024


def _encode(payload: dict) -> str:
    blob = json.dumps(payload)
    if len(blob) > _COMPRESS_OVER:
        blob = _GZIP_PREFIX + base64.b64encode(gzip.compress(blob.encode("utf-8"), 6)).decode("ascii")
    return blob


def _decode(raw: str) -> dict:
    if isinstance(raw, str) and raw.startswith(_GZIP_PREFIX):
        raw = gzip.decompress(base64.b64decode(raw[len(_GZIP_PREFIX):])).decode("utf-8")
    return json.loads(raw)


def store_board(season: int, deadline_seconds: float | None = BUILD_DEADLINE_SECONDS) -> dict:
    """Build and persist. Returns the payload actually stored."""
    payload = build_board(season, deadline_seconds)
    blob = _encode(payload)
    # Drop the weakest rows until it fits. Losing the tail of a shortlist is
    # far better than storing nothing at all.
    while len(blob) > _MAX_BYTES and len(payload["rows"]) > 25:
        payload = {**payload, "rows": payload["rows"][: max(25, len(payload["rows"]) // 2)], "trimmed": True}
        blob = _encode(payload)
    payload = {**payload, "storedBytes": len(blob)}
    payload["stored"] = bool(_store().set(NFL_BOARD_KEY, _encode(payload)))
    return payload


# A best-effort cross-instance lock, so a cold start seen by several people
# at once does not kick off several identical builds. Not a correctness
# guarantee -- the worst case is a duplicate build, whose per-event work is
# already cached -- just a cost guard.
BUILD_LOCK_KEY = "krazy_data:nfl:board_building"
BUILD_LOCK_SECONDS = 180


def _age_seconds(snapshot: dict) -> float:
    try:
        built = datetime.fromisoformat(snapshot["builtAt"])
        return (datetime.now(timezone.utc) - built).total_seconds()
    except Exception:  # noqa: BLE001 -- unreadable timestamp means "old"
        return float("inf")


def _build_in_progress() -> bool:
    try:
        raw = _store().get(BUILD_LOCK_KEY)
        return bool(raw) and (time.time() - float(raw)) < BUILD_LOCK_SECONDS
    except Exception:  # noqa: BLE001 -- no lock is "not locked", never an error
        return False


def _set_lock(value: str) -> None:
    try:
        _store().set(BUILD_LOCK_KEY, value)
    except Exception:  # noqa: BLE001
        pass


def ensure_board(season: int) -> tuple[dict | None, str]:
    """The stored board, built once if nothing is stored yet.

    Returns (snapshot, reason). `reason` explains an empty result so the
    failure is visible instead of showing as a permanently empty tab --
    three rounds of this were lost to guessing at an invisible one.
    """
    snapshot = stored_board()
    # A partial board finishes itself: the second pass starts with most games
    # already cached from the first, so it is quick and cheap.
    if snapshot and not snapshot.get("partial"):
        return snapshot, "stored"
    if snapshot and _age_seconds(snapshot) < PARTIAL_RETRY_SECONDS:
        return snapshot, "partial-recent"
    if _build_in_progress():
        return snapshot, "another build is already running"
    _set_lock(str(time.time()))
    try:
        built = store_board(season)
        if not built.get("stored"):
            return built, "built but the store rejected the write"
        return built, "built"
    except Exception as exc:  # noqa: BLE001 -- serve the partial board we had
        return snapshot, f"{type(exc).__name__}: {exc}"
    finally:
        _set_lock("0")


def stored_board() -> dict | None:
    """Read the last stored board. Never scans, never spends credits."""
    try:
        raw = _store().get(NFL_BOARD_KEY)
    except Exception:  # noqa: BLE001 -- a KV outage is "no snapshot", not an error
        return None
    if not raw:
        return None
    try:
        return _decode(raw)
    except Exception:  # noqa: BLE001 -- an unreadable record is "no snapshot"
        return None
