import type { DataStatus } from "../types";
import type {
  NFLDefense, NFLDepthChart, NFLGame, NFLGameEnvironment, NFLGameLog,
  NFLInjury, NFLPlayer, NFLPlayerUsage, NFLProp, NFLTeam, NFLTeamUsage,
} from "./types";

export interface NFLProviderResult<T> {
  status: DataStatus;
  data: T | null;
  source: string;
  fetchedAt: string;
  observedAt: string | null;
  reason?: string;
}

export interface NFLDataServices {
  players: { list(season: number): Promise<NFLProviderResult<NFLPlayer[]>> };
  teams: { list(season: number): Promise<NFLProviderResult<NFLTeam[]>> };
  schedule: { week(season: number, week: number): Promise<NFLProviderResult<NFLGame[]>> };
  stats: { player(playerId: string, season: number): Promise<NFLProviderResult<Record<string, unknown>>> };
  gameLogs: { player(playerId: string, season: number): Promise<NFLProviderResult<NFLGameLog[]>> };
  usage: {
    player(playerId: string, season: number): Promise<NFLProviderResult<NFLPlayerUsage>>;
    team(teamId: string, season: number): Promise<NFLProviderResult<NFLTeamUsage>>;
  };
  injuries: { team(teamId: string, season: number, week?: number): Promise<NFLProviderResult<NFLInjury[]>> };
  depthCharts: { team(teamId: string, season: number): Promise<NFLProviderResult<NFLDepthChart>> };
  defense: { team(teamId: string, season: number): Promise<NFLProviderResult<NFLDefense>> };
  weather: { game(gameId: string): Promise<NFLProviderResult<NFLGameEnvironment>> };
  props: { game(gameId: string): Promise<NFLProviderResult<NFLProp[]>> };
}
