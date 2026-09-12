/** NFL volume-only estimates. No final prop model output is represented here. */
export interface NFLVolumeEstimate {
  status: 'AVAILABLE' | 'LOW_CONFIDENCE' | 'NOT_AVAILABLE' | 'NOT_APPLICABLE';
  mean: number | null;
  median?: number | null;
  standardDeviation?: number | null;
  variance?: number | null;
  sample?: number;
  effectiveSample?: number;
  reliability?: 'LOW' | 'MEDIUM' | 'HIGH';
  share?: number | null;
  reason?: string | null;
}
export interface NFLTeamVolume {
  expectedPlays: NFLVolumeEstimate;
  expectedDropbacks: NFLVolumeEstimate;
  expectedCalledRushAttempts: NFLVolumeEstimate;
  expectedRushAttempts: NFLVolumeEstimate;
  expectedTeamPassAttempts: NFLVolumeEstimate;
  expectedDrives: NFLVolumeEstimate;
  dataCoverage: number;
  volumeCertainty: 'LOW' | 'MEDIUM' | 'HIGH';
}
export interface NFLPlayerOpportunity {
  status: NFLVolumeEstimate['status'];
  roleStatus?: 'STABLE' | 'INCREASING' | 'DECREASING' | 'UNCERTAIN';
  metrics: Partial<Record<'expectedSnaps' | 'expectedRoutes' | 'expectedTargets' | 'expectedCarries' | 'expectedTouches' | 'expectedPassAttempts' | 'expectedDesignedRushes' | 'expectedScrambles' | 'expectedKneels', NFLVolumeEstimate>>;
  sampleReliability?: 'LOW' | 'MEDIUM' | 'HIGH';
  dataCoverage?: number;
}
