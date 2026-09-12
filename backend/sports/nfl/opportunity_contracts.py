"""NFL volume-only contracts; deliberately no probability/verdict fields."""
from typing import Literal, NotRequired, TypedDict

Availability=Literal['AVAILABLE','LOW_CONFIDENCE','NOT_AVAILABLE','NOT_APPLICABLE']
Reliability=Literal['LOW','MEDIUM','HIGH']

class NFLVolumeEstimate(TypedDict):
    status: Availability
    mean: float | None
    median: NotRequired[float | None]
    standardDeviation: NotRequired[float | None]
    variance: NotRequired[float | None]
    sample: NotRequired[int]
    effectiveSample: NotRequired[float]
    reliability: NotRequired[Reliability]
    reason: NotRequired[str | None]
    share: NotRequired[float | None]

class NFLTeamVolume(TypedDict):
    expectedPlays: NFLVolumeEstimate
    expectedDropbacks: NFLVolumeEstimate
    expectedRushAttempts: NFLVolumeEstimate
    expectedCalledRushAttempts: NFLVolumeEstimate
    expectedTeamPassAttempts: NFLVolumeEstimate
    expectedDrives: NFLVolumeEstimate
    dataCoverage: int
    volumeCertainty: Reliability

class NFLPlayerOpportunity(TypedDict):
    status: Availability
    metrics: dict[str,NFLVolumeEstimate]
    roleStatus: NotRequired[Literal['STABLE','INCREASING','DECREASING','UNCERTAIN']]
    roleStability: NotRequired[Reliability]
    sampleReliability: NotRequired[Reliability]
    dataCoverage: NotRequired[int]
    reason: NotRequired[str]
