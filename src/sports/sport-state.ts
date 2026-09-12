import type { SportId } from "./types";

const STORAGE_KEY = "krazy-data:selected-sport";
const DEFAULT_SPORT: SportId = "mlb";

export function isSportId(value: unknown): value is SportId {
  return value === "mlb" || value === "nfl";
}

export function getSelectedSport(storage: Pick<Storage, "getItem"> = window.localStorage): SportId {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    return isSportId(stored) ? stored : DEFAULT_SPORT;
  } catch {
    return DEFAULT_SPORT;
  }
}

export function setSelectedSport(
  sport: SportId,
  storage: Pick<Storage, "setItem"> = window.localStorage,
): SportId {
  storage.setItem(STORAGE_KEY, sport);
  return sport;
}

export { DEFAULT_SPORT, STORAGE_KEY as SPORT_STORAGE_KEY };

