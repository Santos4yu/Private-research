/** Research scores, not final projections or hit probabilities. */
export interface NFLMatchupContributor {
  feature: string;
  value: number;
  normalized: number;
  weight: number;
  sample: number;
  reliability: number;
  finalContribution: number;
}
export interface NFLMatchupComponent {
  status: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'NOT_AVAILABLE';
  score: number | null;
  certainty: number | null;
  dataCoverage: number;
  contributors: NFLMatchupContributor[];
  reason?: string;
}
export interface NFLMatchupResult {
  status: string;
  matchupQuality: number | null;
  matchupCertainty: number | null;
  dataCoverage: number;
  components?: Record<string, NFLMatchupComponent>;
  propKey?: string;
  playerId?: string;
  reason?: string;
}
