"""Phase 6 mean-statistic contract deliberately has no side/probability/verdict."""
from typing import Literal,NotRequired,TypedDict

class NFLStatProjection(TypedDict):
    playerId:str
    gameId:str
    propType:str
    projectionMean:float|None
    projectionMedianIfSupported:float|None
    opportunityInputs:dict
    efficiencyInputs:dict
    matchupAdjustments:list[dict]
    roleReliability:str
    matchupReliability:str
    sampleReliability:float|str
    dataCoverage:float
    modelVersion:str
    generatedAt:str
    status:Literal['AVAILABLE','LOW_CONFIDENCE','NOT_AVAILABLE']
    promotion:Literal['EXPERIMENTAL','VALIDATED','DISABLED']
    reason:NotRequired[str]
    components:NotRequired[list['NFLStatProjection']]
