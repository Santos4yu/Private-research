export interface NFLStatProjection {
  playerId: string;
  gameId: string;
  propType: string;
  projectionMean: number | null;
  projectionMedianIfSupported: number | null;
  opportunityInputs: Record<string, { mean: number | null; sample?: number }>;
  efficiencyInputs: Record<string, { mean: number | null; sampleGames?: number; validExposure?: number; reliability?: number }>;
  matchupAdjustments: { feature: string; statAdjustment: number; enabled: boolean; sample: number }[];
  roleReliability: string;
  matchupReliability: string;
  sampleReliability: number | string;
  dataCoverage: number;
  modelVersion: string;
  generatedAt: string;
  status: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'NOT_AVAILABLE';
  promotion: 'EXPERIMENTAL' | 'VALIDATED' | 'DISABLED';
  reason?: string;
  components?: NFLStatProjection[];
}
