from __future__ import annotations

from enum import StrEnum


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


def nfl_cache_key(domain: NFLCacheDomain, *parts: object) -> str:
    """Produce a namespace that cannot collide with existing MLB keys."""
    clean = [str(part).strip().lower().replace(" ", "_") for part in parts]
    if any(not part for part in clean):
        raise ValueError("NFL cache key parts cannot be empty")
    return ":".join(("krazy_data", "nfl", "v1", domain.value, *clean))

