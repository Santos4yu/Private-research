from __future__ import annotations

from enum import StrEnum
from threading import Lock
from concurrent.futures import Future
import time
from typing import Callable, TypeVar


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
        value = loader()
        with _lock:
            if generation == _generation:
                _memory[key] = (time.time(), value)
                if len(_memory) > 1024:
                    _memory.pop(next(iter(_memory)))
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
