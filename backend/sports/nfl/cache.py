from __future__ import annotations

from enum import StrEnum
from threading import Lock
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
}

T = TypeVar("T")
_memory: dict[str, tuple[float, object]] = {}
_lock = Lock()


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
    value = loader()
    with _lock:
        _memory[key] = (now, value)
    return value


def clear_nfl_cache() -> None:
    with _lock:
        _memory.clear()
