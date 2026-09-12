export type SportId = "mlb" | "nfl";

export type DataStatus =
  | "AVAILABLE"
  | "MISSING"
  | "UNRELIABLE"
  | "NOT_APPLICABLE"
  | "NOT_AVAILABLE";

export interface SourcedValue<T> {
  status: DataStatus;
  value: T | null;
  source: string | null;
  observedAt: string | null;
  fetchedAt: string;
  reason?: string;
}

