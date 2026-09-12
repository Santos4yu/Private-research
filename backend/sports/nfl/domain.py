from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from typing import Any, Generic, TypeVar


class DataStatus(StrEnum):
    AVAILABLE = "AVAILABLE"
    MISSING = "MISSING"
    UNRELIABLE = "UNRELIABLE"
    NOT_APPLICABLE = "NOT_APPLICABLE"
    NOT_AVAILABLE = "NOT_AVAILABLE"


class NFLPosition(StrEnum):
    QB = "QB"
    RB = "RB"
    WR = "WR"
    TE = "TE"


class NFLPropKey(StrEnum):
    PASSING_YARDS = "passing_yards"
    PASSING_ATTEMPTS = "passing_attempts"
    PASS_COMPLETIONS = "pass_completions"
    PASSING_TOUCHDOWNS = "passing_touchdowns"
    INTERCEPTIONS = "interceptions"
    RUSHING_YARDS = "rushing_yards"
    RUSH_ATTEMPTS = "rush_attempts"
    PASSING_RUSHING_YARDS = "passing_rushing_yards"
    RECEIVING_YARDS = "receiving_yards"
    RECEPTIONS = "receptions"
    TARGETS = "targets"
    LONGEST_RECEPTION = "longest_reception"
    RUSHING_RECEIVING_YARDS = "rushing_receiving_yards"
    TOUCHDOWNS = "touchdowns"
    FANTASY_SCORE = "fantasy_score"


T = TypeVar("T")


@dataclass(frozen=True)
class SourcedValue(Generic[T]):
    status: DataStatus
    value: T | None
    source: str | None
    observed_at: datetime | None
    fetched_at: datetime
    reason: str | None = None

    def __post_init__(self) -> None:
        if self.status == DataStatus.AVAILABLE and self.value is None:
            raise ValueError("AVAILABLE data must contain a value")
        if self.status in {DataStatus.MISSING, DataStatus.NOT_APPLICABLE, DataStatus.NOT_AVAILABLE} and self.value is not None:
            raise ValueError("Missing or unavailable data must not contain a value")


@dataclass(frozen=True)
class NFLPlayerRef:
    id: str
    name: str
    position: NFLPosition
    team_id: str | None


@dataclass(frozen=True)
class NFLTeamRef:
    id: str
    abbreviation: str
    name: str


@dataclass(frozen=True)
class NFLTeam(NFLTeamRef):
    city: str
    nickname: str
    conference: str | None = None
    division: str | None = None
    logo_url: str | None = None
    source_ids: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class NFLPlayer(NFLPlayerRef):
    first_name: str
    last_name: str
    status: str
    jersey_number: str | None = None
    headshot_url: str | None = None
    source_ids: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class NFLGame:
    id: str
    season: int
    season_type: str
    week: int
    starts_at: datetime
    status: str
    home_team: NFLTeamRef
    away_team: NFLTeamRef
    venue: str | None = None
    roof: str | None = None
    temperature_f: float | None = None
    wind_mph: float | None = None
    precipitation_probability: float | None = None
    source_ids: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class NFLGameLog:
    player_id: str
    player_name: str
    position: NFLPosition
    game_id: str
    season: int
    season_type: str
    week: int
    team_id: str
    opponent_team_id: str
    is_home: bool | None
    stats: dict[str, int | float | None]
    source: str


@dataclass(frozen=True)
class NFLTeamGameStats:
    game_id: str
    season: int
    season_type: str
    week: int
    team_id: str
    opponent_team_id: str
    stats: dict[str, int | float | None]
    source: str


@dataclass(frozen=True)
class NFLInjury:
    player_id: str
    player_name: str
    team_id: str
    position: str
    season: int
    season_type: str
    week: int
    injury: str | None
    game_status: str | None
    practice_status: str | None
    report_date: datetime | None
    source: str


@dataclass(frozen=True)
class NFLDepthChartEntry:
    team_id: str
    player_id: str
    player_name: str
    position: str
    role: str
    rank: int
    updated_at: datetime
    source: str


@dataclass(frozen=True)
class NFLPropLine:
    line: float
    side: str
    book: str
    observed_at: datetime
    price: int | None = None


@dataclass(frozen=True)
class NFLProp:
    id: str
    player: NFLPlayerRef
    game_id: str
    key: NFLPropKey
    label: str
    lines: tuple[NFLPropLine, ...]
    source: str
    observed_at: datetime


@dataclass(frozen=True)
class NFLProjection:
    status: DataStatus
    player_id: str
    game_id: str
    prop_key: NFLPropKey
    generated_at: datetime
    model_id: str | None = None
    mean: float | None = None
    median: float | None = None
    distribution: dict[str, float] | None = None
    over_probability: float | None = None
    under_probability: float | None = None
    reason: str | None = None


@dataclass(frozen=True)
class NFLResearchResult:
    status: DataStatus
    player: NFLPlayerRef
    game: NFLGame
    prop: NFLProp
    projection: NFLProjection
    features: dict[str, SourcedValue[Any]]
    missing: tuple[str, ...]
    unreliable: tuple[str, ...]
    confidence: float | None
    verdict: str
    generated_at: datetime
