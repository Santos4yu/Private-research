export type NFLProductionStatus='PRODUCTION_READY'|'SHADOW_ONLY'|'EXPERIMENTAL'|'DISABLED';
export type NFLModelHealth='HEALTHY'|'WATCH'|'DEGRADED'|'DISABLED';
export interface NFLDecision {
  verdict:'TAKE'|'LEAN'|'PASS';
  status:'AVAILABLE'|'NOT_AVAILABLE';
  productionStatus:NFLProductionStatus;
  confidence:'VERY HIGH'|'HIGH'|'MEDIUM'|'LOW';
  statisticalEdge:number|null;
  probabilityEdge:number|null;
  marketEdge:number|null;
  EV:null;
  probability:number|null;
  direction:'OVER'|'UNDER'|null;
  decisionRuleVersion:string;
  reasons:string[];
  risks:string[];
}
