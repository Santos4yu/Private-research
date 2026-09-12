import type { NFLGame, NFLPlayerRef, NFLProp, NFLResearchResult } from "./types";

export function unavailableNFLResearch(
  player: NFLPlayerRef,
  game: NFLGame,
  prop: NFLProp,
  missing: string[] = [],
): NFLResearchResult {
  const generatedAt = new Date().toISOString();
  return {
    status: "NOT_AVAILABLE",
    player,
    game,
    prop,
    projection: {
      status: "NOT_AVAILABLE",
      propKey: prop.key,
      playerId: player.id,
      gameId: game.id,
      modelId: null,
      mean: null,
      median: null,
      distribution: null,
      overProbability: null,
      underProbability: null,
      generatedAt,
      reason: "The NFL projection model has not been implemented.",
    },
    dataQuality: { status: "NOT_AVAILABLE", missing, unreliable: [] },
    features: {},
    confidence: null,
    verdict: "NOT_AVAILABLE",
    generatedAt,
  };
}

