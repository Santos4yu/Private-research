"""Phase 5 research outputs are deliberately separate from NFLProjection."""
from typing import NotRequired,TypedDict,Literal

class NFLMatchupComponent(TypedDict):
    status:Literal['AVAILABLE','LOW_CONFIDENCE','NOT_AVAILABLE']
    score:float|None
    certainty:float|None
    dataCoverage:float
    contributors:list[dict]
    reason:NotRequired[str]

class NFLMatchupResult(TypedDict):
    status:str
    matchupQuality:float|None
    matchupCertainty:float|None
    dataCoverage:float
    components:NotRequired[dict[str,NFLMatchupComponent]]
    playerId:NotRequired[str]
    propKey:NotRequired[str]
    reason:NotRequired[str]
