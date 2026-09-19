import { canReuseResearch, MATCHUP_VERSION } from './matchup-rating.js';

// Keep exact research in memory only; saved slips have their own snapshot rules.
export function researchKey(context) {
  return JSON.stringify([MATCHUP_VERSION, String(context.player).trim().toLowerCase(),
    context.playerId || '', context.teamId || '', context.teamName || '', context.stat,
    Number(context.line), String(context.side).toLowerCase(), context.boardRevision || '']);
}

export function createResearchClient({ fetcher = (...args) => fetch(...args), now = Date.now,
  maxAge = 180000, limit = 32, timeout = 15000, endpoint = '/api/prediction' } = {}) {
  const values = new Map();
  const pending = new Map();
  let generation = 0;
  let lastPrefetch = -Infinity;
  const clear = () => {
    generation++;
    values.clear();
    pending.forEach(entry => entry.controller.abort());
    pending.clear();
    lastPrefetch = -Infinity;
  };
  const peek = context => {
    const key = researchKey(context);
    const entry = values.get(key);
    if (!entry) return null;
    if (now() - entry.at >= maxAge || !canReuseResearch(entry.value, now())) {
      values.delete(key);
      return null;
    }
    return entry.value;
  };
  const request = context => {
    const cached = peek(context);
    if (cached) return Promise.resolve(cached);
    const key = researchKey(context);
    if (pending.has(key)) return pending.get(key).promise;
    const controller = new AbortController();
    const epoch = generation;
    const timer = setTimeout(() => controller.abort(), timeout);
    const query = [['player', context.player], ['stat', context.stat], ['line', String(context.line)],
      ['side', String(context.side).toLowerCase()],
      ...(context.playerId ? [['playerId', String(context.playerId)]] : []),
      ...(context.teamId ? [['teamId', String(context.teamId)]] : []),
      ...(context.teamName ? [['team', context.teamName]] : [])]
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    const entry = { controller, promise: null };
    entry.promise = Promise.resolve().then(async () => {
      const response = await fetcher(`${endpoint}?${query}`, {
        signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
      });
      const value = await response.json();
      if (!response.ok || value.error) {
        if (response.status === 401 || response.status === 403) clear();
        throw new Error(value.error || `Request failed (${response.status})`);
      }
      if (epoch !== generation) throw new DOMException('Research request was cleared', 'AbortError');
      if (canReuseResearch(value, now())) {
        values.delete(key);
        values.set(key, { at: now(), value });
        while (values.size > limit) values.delete(values.keys().next().value);
      }
      return value;
    }).finally(() => {
      clearTimeout(timer);
      if (pending.get(key) === entry) pending.delete(key);
    });
    pending.set(key, entry);
    return entry.promise;
  };
  return {
    peek, request,
    prefetch(context) {
      const key = researchKey(context);
      if (peek(context) || pending.has(key)) return;
      // Speculation must never flood the data service or compete with a click.
      if (pending.size || now() - lastPrefetch < 1500) return;
      lastPrefetch = now();
      request(context).catch(() => {});
    },
    clear,
  };
}
