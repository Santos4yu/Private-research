from __future__ import annotations

import json
import sys
from enum import StrEnum
from pathlib import Path
from threading import Lock
from concurrent.futures import Future
import time
from typing import Callable, TypeVar

# The in-process _memory dict below is worthless on Vercel: a serverless
# function can cold-start on every request (or land on a different warm
# instance than the one that populated it), so in practice almost every
# request was a full cache miss -- exactly why the NFL research board and
# player screens recomputed everything (including per-player nflverse
# game-log fetches) from scratch on nearly every load. Reusing the same
# Upstash Redis store already backing the MLB props board (v2/board/store.py)
# as a durable L2 gives every serverless instance a shared cache instead of
# each one starting cold.
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))
try:
    from v2.board import store as _kv_store  # noqa: E402
except Exception:  # pragma: no cover - KV store must never be required to run
    _kv_store = None


class NFLCacheDomain(StrEnum):
    PLAYERS = "players"
    TEAMS = "teams"
    SCHEDULE = "schedule"
    STATS = "stats"
    GAME_LOGS = "game_logs"
    USAGE = "usage"
    INJURIES = "injuries"
    DEPTH_CHARTS = "depth_charts"
    DEFENSE = "defense"
    WEATHER = "weather"
    PROPS = "props"
    PROJECTIONS = "projections"
    OPPORTUNITY = "opportunity"
    MATCHUP = "matchup"
    SOURCE_ROWS = "source_rows"


NFL_CACHE_TTLS = {
    NFLCacheDomain.TEAMS: 24 * 60 * 60,
    NFLCacheDomain.PLAYERS: 6 * 60 * 60,
    NFLCacheDomain.SCHEDULE: 15 * 60,
    NFLCacheDomain.STATS: 30 * 60,
    NFLCacheDomain.GAME_LOGS: 30 * 60,
    NFLCacheDomain.USAGE: 30 * 60,
    NFLCacheDomain.INJURIES: 10 * 60,
    NFLCacheDomain.DEPTH_CHARTS: 30 * 60,
    NFLCacheDomain.DEFENSE: 30 * 60,
    NFLCacheDomain.WEATHER: 10 * 60,
    NFLCacheDomain.PROPS: 2 * 60,
    NFLCacheDomain.PROJECTIONS: 10 * 60,
    NFLCacheDomain.OPPORTUNITY: 10 * 60,
    NFLCacheDomain.MATCHUP: 10 * 60,
    NFLCacheDomain.SOURCE_ROWS: 15 * 60,
}

T = TypeVar("T")
_memory: dict[str, tuple[float, object]] = {}
_lock = Lock()
_pending: dict[str, Future] = {}
_generation = 0


def nfl_cache_key(domain: NFLCacheDomain, *parts: object) -> str:
    """Produce a namespace that cannot collide with existing MLB keys."""
    clean = [str(part).strip().lower().replace(" ", "_") for part in parts]
    if any(not part for part in clean):
        raise ValueError("NFL cache key parts cannot be empty")
    return ":".join(("krazy_data", "nfl", "v1", domain.value, *clean))


def _kv_get(key: str, ttl: float) -> object | None:
    """Best-effort durable-cache read. Never raises -- a KV outage or a
    value that was never written must degrade to "cache miss", not break
    the request."""
    if _kv_store is None:
        return None
    try:
        raw = _kv_store.get(key)
        if not raw:
            return None
        envelope = json.loads(raw)
        if time.time() - envelope["ts"] >= ttl:
            return None
        return envelope["value"]
    except Exception:
        return None


def _kv_set(key: str, value: object) -> None:
    """Best-effort durable-cache write. Silently does nothing for a value
    that can't round-trip through JSON (e.g. a dataclass-bearing result) --
    those domains just keep behaving exactly as before, no regression."""
    if _kv_store is None:
        return
    try:
        _kv_store.set(key, json.dumps({"ts": time.time(), "value": value}))
    except Exception:
        pass


def cached_nfl(domain: NFLCacheDomain, parts: tuple[object, ...], loader: Callable[[], T]) -> T:
    key = nfl_cache_key(domain, *parts)
    now = time.time()
    with _lock:
        entry = _memory.get(key)
        if entry and now - entry[0] < NFL_CACHE_TTLS[domain]:
            return entry[1]  # type: ignore[return-value]
        pending = _pending.get(key)
        owner = pending is None
        if owner:
            pending = Future()
            _pending[key] = pending
        generation = _generation
    if not owner:
        return pending.result()
    try:
        kv_value = _kv_get(key, NFL_CACHE_TTLS[domain])
        if kv_value is not None:
            with _lock:
                if generation == _generation:
                    _memory[key] = (time.time(), kv_value)
            pending.set_result(kv_value)
            return kv_value  # type: ignore[return-value]
        value = loader()
        with _lock:
            if generation == _generation:
                _memory[key] = (time.time(), value)
                if len(_memory) > 1024:
                    _memory.pop(next(iter(_memory)))
        _kv_set(key, value)
        pending.set_result(value)
        return value
    except BaseException as error:
        pending.set_exception(error)
        raise
    finally:
        with _lock:
            if _pending.get(key) is pending:
                del _pending[key]


def clear_nfl_cache() -> None:
    global _generation
    with _lock:
        _generation += 1
        _memory.clear()
        _pending.clear()
