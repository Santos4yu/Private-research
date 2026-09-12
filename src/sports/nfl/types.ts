import type { DataStatus, SourcedValue } from "../types";

export type NFLPosition = "QB" | "RB" | "WR" | "TE";
export type NFLGameStatus = "SCHEDULED" | "IN_PROGRESS" | "FINAL" | "POSTPONED" | "CANCELLED";
export type NFLPropSide = "OVER" | "UNDER";

export interface NFLTeamRef { id: string; abbreviation: string; name: string; }
export interface NFLPlayerRef { id: string; name: string; position: NFLPosition; teamId: string | null; }

export interface NFLTeam extends NFLTeamRef {
  conference?: "AFC" | "NFC";
  division?: string;
  logoUrl?: string;
  sourceIds: Record<string, string>;
}

export interface NFLPlayer extends NFLPlayerRef {
  firstName: string;
  lastName: string;
  jerseyNumber?: string;
  status: "ACTIVE" | "INACTIVE" | "PRACTICE_SQUAD" | "RESERVE" | "UNKNOWN";
  headshotUrl?: string;
  sourceIds: Record<string, string>;
}

export interface NFLGame {
  id: string;
  season: number;
  seasonType: "PRE" | "REG" | "POST";
  week: number;
  startsAt: string;
  status: NFLGameStatus;
  homeTeam: NFLTeamRef;
  awayTeam: NFLTeamRef;
  venue?: string;
  sourceIds: Record<string, string>;
}

export interface NFLStatLine {
  passing?: { attempts?: number; completions?: number; yards?: number; touchdowns?: number; interceptions?: number };
  rushing?: { attempts?: number; yards?: number; touchdowns?: number };
  receiving?: { targets?: number; receptions?: number; yards?: number; touchdowns?: number; longestReception?: number };
  fantasy?: { points?: number; scoringSystem: string };
  extras?: Record<string, number | string | boolean | null>;
}

export interface NFLGameLog {
  playerId: string;
  gameId: string;
  teamId: string;
  opponentTeamId: string;
  playedAt: string;
  isHome: boolean;
  snaps?: number;
  stats: NFLStatLine;
  source: string;
}

export type NFLPropKey =
  | "passing_yards" | "passing_attempts" | "pass_completions" | "passing_touchdowns"
  | "interceptions" | "rushing_yards" | "rush_attempts" | "passing_rushing_yards"
  | "receiving_yards" | "receptions" | "targets" | "longest_reception"
  | "rushing_receiving_yards" | "touchdowns" | "fantasy_score";

export interface NFLPropLine {
  line: number;
  side: NFLPropSide;
  price?: number;
  book: string;
  marketId?: string;
  observedAt: string;
}

export interface NFLProp {
  id: string;
  player: NFLPlayerRef;
  gameId: string;
  key: NFLPropKey;
  label: string;
  lines: NFLPropLine[];
  source: string;
  observedAt: string;
}

export interface NFLInjury {
  playerId: string;
  status: "OUT" | "DOUBTFUL" | "QUESTIONABLE" | "PROBABLE" | "IR" | "PUP" | "UNKNOWN";
  practiceStatus?: "DNP" | "LIMITED" | "FULL" | "NOT_REPORTED";
  description?: string;
  reportedAt: string;
}

export interface NFLDepthChartEntry { playerId: string; position: NFLPosition; role: string; rank: number; }
export interface NFLDepthChart { teamId: string; entries: NFLDepthChartEntry[]; observedAt: string; }

export interface NFLPlayerUsage {
  playerId: string;
  sample: { season: number; fromWeek?: number; toWeek?: number; games: number };
  snapRate: SourcedValue<number>;
  routeRate: SourcedValue<number>;
  targetShare: SourcedValue<number>;
  carryShare: SourcedValue<number>;
  redZoneShare: SourcedValue<number>;
  extras: Record<string, SourcedValue<number>>;
}

export interface NFLTeamUsage {
  teamId: string;
  sample: { season: number; fromWeek?: number; toWeek?: number; games: number };
  playsPerGame: SourcedValue<number>;
  passRate: SourcedValue<number>;
  neutralPassRate: SourcedValue<number>;
  paceSeconds: SourcedValue<number>;
  extras: Record<string, SourcedValue<number>>;
}

export interface NFLDefense {
  teamId: string;
  season: number;
  games: number;
  vsPosition: Partial<Record<NFLPosition, Record<string, SourcedValue<number>>>>;
  scheme: Record<string, SourcedValue<number | string>>;
  extras: Record<string, SourcedValue<number>>;
}

export interface NFLWeather {
  gameId: string;
  temperatureF: SourcedValue<number>;
  windMph: SourcedValue<number>;
  precipitationProbability: SourcedValue<number>;
  dome: SourcedValue<boolean>;
}

export interface NFLGameEnvironment {
  gameId: string;
  spread: SourcedValue<number>;
  total: SourcedValue<number>;
  impliedTeamTotal: SourcedValue<number>;
  weather: NFLWeather;
  extras: Record<string, SourcedValue<number | string | boolean>>;
}

export interface NFLProjection {
  status: DataStatus;
  propKey: NFLPropKey;
  playerId: string;
  gameId: string;
  modelId: string | null;
  mean: number | null;
  median: number | null;
  distribution: Record<string, number> | null;
  overProbability: number | null;
  underProbability: number | null;
  generatedAt: string;
  reason?: string;
}

export interface NFLResearchResult {
  status: DataStatus;
  player: NFLPlayerRef;
  game: NFLGame;
  prop: NFLProp;
  projection: NFLProjection;
  dataQuality: { status: DataStatus; missing: string[]; unreliable: string[] };
  features: Record<string, SourcedValue<unknown>>;
  confidence: number | null;
  verdict: "OVER" | "UNDER" | "PASS" | "NOT_AVAILABLE";
  generatedAt: string;
}

