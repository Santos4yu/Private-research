// NFL-only, bounded, session-memory cache. Never persists authenticated research.
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
        const ttl = ['players', 'teams'].includes(resource) ? 300000 : 30000;
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

export function freshness(timestamp, now = Date.now()) {
  const age = now - Date.parse(timestamp);
  if (!Number.isFinite(age) || age < -60000) return 'Timestamp unavailable';
  if (age >= 900000) return 'Stale · refresh research';
  return age < 60000 ? 'Updated just now' : `Updated ${Math.floor(age / 60000)}m ago`;
}
