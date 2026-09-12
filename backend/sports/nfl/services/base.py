from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Generic, Protocol, TypeVar

from ..domain import DataStatus, NFLGame, NFLPlayerRef, NFLProp, NFLTeamRef

T = TypeVar("T")


@dataclass(frozen=True)
class ProviderResult(Generic[T]):
    status: DataStatus
    data: T | None
    source: str
    fetched_at: datetime
    observed_at: datetime | None = None
    reason: str | None = None

    def __post_init__(self) -> None:
        if self.status == DataStatus.AVAILABLE and self.data is None:
            raise ValueError("AVAILABLE provider results require data")
        if self.status in {DataStatus.MISSING, DataStatus.NOT_APPLICABLE, DataStatus.NOT_AVAILABLE} and self.data is not None:
            raise ValueError("Missing or unavailable provider results cannot carry data")


class NFLDataProvider(Protocol):
    """Normalized provider boundary; no external response shape crosses it."""

    name: str

    def players(self, *, season: int) -> ProviderResult[list[NFLPlayerRef]]: ...
    def teams(self, *, season: int) -> ProviderResult[list[NFLTeamRef]]: ...
    def games(self, *, season: int, week: int) -> ProviderResult[list[NFLGame]]: ...
    def props(self, *, game_id: str) -> ProviderResult[list[NFLProp]]: ...
    def player_stats(self, *, player_id: str, season: int) -> ProviderResult[dict]: ...
    def game_logs(self, *, player_id: str, season: int) -> ProviderResult[list[dict]]: ...
    def player_usage(self, *, player_id: str, season: int) -> ProviderResult[dict]: ...
    def team_usage(self, *, team_id: str, season: int) -> ProviderResult[dict]: ...
    def injuries(self, *, team_id: str, season: int, week: int | None = None) -> ProviderResult[list[dict]]: ...
    def depth_chart(self, *, team_id: str, season: int) -> ProviderResult[dict]: ...
    def defense(self, *, team_id: str, season: int) -> ProviderResult[dict]: ...
    def weather(self, *, game_id: str) -> ProviderResult[dict]: ...
