import type { SportId } from "./types";

export interface SportRegistration {
  id: SportId;
  label: string;
  enabled: boolean;
  apiNamespace: string;
  storageNamespace: string;
}

export const SPORTS: Readonly<Record<SportId, SportRegistration>> = Object.freeze({
  mlb: {
    id: "mlb",
    label: "MLB",
    enabled: true,
    apiNamespace: "/api",
    storageNamespace: "mlb",
  },
  nfl: {
    id: "nfl",
    label: "NFL",
    enabled: false,
    apiNamespace: "/api/nfl",
    storageNamespace: "nfl",
  },
});

