// NFL-only, bounded, session-memory cache. Never persists authenticated research.
//
// How long a resource stays usable in memory, per resource. This used to be
// a flat 30 seconds for everything except players/teams, which meant simply
// stepping back to the player list and returning -- or letting a screen sit
// for half a minute -- refetched a player's entire research set from
// scratch. These values mirror the server's own cache TTLs in
// backend/sports/nfl/cache.py and stay at or under them, so nothing is
// shown staler than what the server would have returned anyway; completed
// game logs and snap counts in particular cannot change mid-week at all.
// The screen's Refresh button still calls clear() for a real reload.
const RESOURCE_TTL = {
  teams: 3600000, players: 1800000,
  schedule: 600000,
  'game-logs': 900000, 'reception-logs': 900000, usage: 900000,
  defense: 900000, 'team-stats': 900000, 'depth-chart': 900000,
  injuries: 300000,
  matchup: 300000, opportunity: 300000, projection: 300000, distribution: 300000, decision: 300000,
  props: 60000, 'prop-games': 60000, 'game-lines': 60000, 'research-board': 60000, 'value-board': 60000,
  // Prebuilt slate: rebuilt daily, so it does not need re-fetching per minute.
  board: 300000,
};
const DEFAULT_TTL = 60000;

export function createNFLClient({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map();
  const pending = new Map();
  let generation = 0;
  function clear() { generation++; cache.clear(); pending.clear(); }
  async function get(resource, params = {}) {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== '').sort(([a], [b]) => a.localeCompare(b)));
    const key = `/api/nfl/${resource}?${query}`;
    const hit = cache.get(key);
    if (hit && hit.until > now()) return hit.body;
    if (pending.has(key)) return pending.get(key);
    const epoch = generation;
    const promise = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetcher(key, { credentials: 'same-origin', signal: controller.signal });
        const body = await response.json();
        if (!response.ok || body.data == null) {
          if (response.status === 401 || response.status === 403) clear();
          throw new Error(response.status === 401 ? 'Sign in to access live NFL research.' : response.status === 429 ? 'Please wait briefly before refreshing research.' : 'Data source temporarily unavailable. Try again shortly.');
        }
        // Mutable personnel/game state expires sooner than roster metadata.
        const ttl = RESOURCE_TTL[resource] ?? DEFAULT_TTL;
        if (epoch === generation) {
          cache.set(key, { body, until: now() + ttl });
          if (cache.size > 120) cache.delete(cache.keys().next().value);
        }
        return body;
      } finally { clearTimeout(timeout); }
    })();
    pending.set(key, promise);
    try { return await promise; }
    finally { if (pending.get(key) === promise) pending.delete(key); }
  }
  return { get, clear };
}

export function freshness(timestamp, now = Date.now(), staleAfter = 900000) {
  const age = now - Date.parse(timestamp);
  if (!Number.isFinite(age) || age < -60000) return 'Timestamp unavailable';
  if (age >= staleAfter) return 'Stale · refresh research';
  return age < 60000 ? 'Updated just now' : `Updated ${Math.floor(age / 60000)}m ago`;
}
