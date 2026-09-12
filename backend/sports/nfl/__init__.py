"""NFL contracts and boundaries. No production NFL data/model is active yet."""

from .domain import DataStatus, NFLPosition, NFLPropKey
from .research import build_research_result

__all__ = ["DataStatus", "NFLPosition", "NFLPropKey", "build_research_result"]

