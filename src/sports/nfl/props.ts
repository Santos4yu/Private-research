import type { NFLPosition, NFLPropKey } from "./types";

export interface NFLPropDefinition {
  key: NFLPropKey;
  label: string;
  positions: readonly NFLPosition[];
  modelId: string;
}

export const NFL_PROP_DEFINITIONS: readonly NFLPropDefinition[] = [
  { key: "passing_yards", label: "Passing Yards", positions: ["QB"], modelId: "nfl.qb.passing_yards" },
  { key: "passing_attempts", label: "Passing Attempts", positions: ["QB"], modelId: "nfl.qb.passing_attempts" },
  { key: "pass_completions", label: "Pass Completions", positions: ["QB"], modelId: "nfl.qb.pass_completions" },
  { key: "passing_touchdowns", label: "Passing TDs", positions: ["QB"], modelId: "nfl.qb.passing_touchdowns" },
  { key: "interceptions", label: "Interceptions", positions: ["QB"], modelId: "nfl.qb.interceptions" },
  { key: "rushing_yards", label: "Rushing Yards", positions: ["QB", "RB"], modelId: "nfl.position.rushing_yards" },
  { key: "rush_attempts", label: "Rush Attempts", positions: ["QB", "RB"], modelId: "nfl.position.rush_attempts" },
  { key: "passing_rushing_yards", label: "Passing + Rushing Yards", positions: ["QB"], modelId: "nfl.qb.passing_rushing_yards" },
  { key: "receiving_yards", label: "Receiving Yards", positions: ["RB", "WR", "TE"], modelId: "nfl.receiver.receiving_yards" },
  { key: "receptions", label: "Receptions", positions: ["RB", "WR", "TE"], modelId: "nfl.receiver.receptions" },
  { key: "targets", label: "Targets", positions: ["WR", "TE"], modelId: "nfl.receiver.targets" },
  { key: "longest_reception", label: "Longest Reception", positions: ["WR", "TE"], modelId: "nfl.receiver.longest_reception" },
  { key: "rushing_receiving_yards", label: "Rushing + Receiving Yards", positions: ["RB"], modelId: "nfl.rb.rushing_receiving_yards" },
  { key: "touchdowns", label: "Touchdowns", positions: ["RB", "WR", "TE"], modelId: "nfl.position.touchdowns" },
  { key: "fantasy_score", label: "Fantasy Score", positions: ["QB", "RB", "WR", "TE"], modelId: "nfl.position.fantasy_score" },
] as const;

export function nflPropsForPosition(position: NFLPosition): readonly NFLPropDefinition[] {
  return NFL_PROP_DEFINITIONS.filter((definition) => definition.positions.includes(position));
}

