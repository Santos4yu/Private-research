from __future__ import annotations

from datetime import datetime, timezone

from .domain import DataStatus, NFLGame, NFLPlayerRef, NFLProjection, NFLProp, NFLResearchResult


def build_research_result(*, player: NFLPlayerRef, game: NFLGame, prop: NFLProp,
                          missing: tuple[str, ...] = ()) -> NFLResearchResult:
    """Safe pre-model boundary. It never fabricates a projection or verdict."""
    now = datetime.now(timezone.utc)
    projection = NFLProjection(
        status=DataStatus.NOT_AVAILABLE,
        player_id=player.id,
        game_id=game.id,
        prop_key=prop.key,
        generated_at=now,
        reason="The NFL projection model has not been implemented.",
    )
    return NFLResearchResult(
        status=DataStatus.NOT_AVAILABLE,
        player=player,
        game=game,
        prop=prop,
        projection=projection,
        features={},
        missing=missing,
        unreliable=(),
        confidence=None,
        verdict="NOT_AVAILABLE",
        generated_at=now,
    )

