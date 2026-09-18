// Cache raw results, never a user's selected line or the derived hit rates.
export function createTrendCache({ maxAge = 600000, limit = 60, now = Date.now } = {}) {
  const values = new Map();
  const pending = new Map();
  const peek = key => {
    const entry = values.get(key);
    if (!entry) return null;
    if (now() - entry.at >= maxAge) { values.delete(key); return null; }
    return entry.value;
  };
  return {
    peek,
    request(key, loader) {
      const cached = peek(key);
      if (cached) return Promise.resolve(cached);
      if (!pending.has(key)) {
        const request = Promise.resolve().then(loader).then(value => {
          values.delete(key);
          values.set(key, { at: now(), value });
          while (values.size > limit) values.delete(values.keys().next().value);
          return value;
        }).finally(() => pending.delete(key));
        pending.set(key, request);
      }
      return pending.get(key);
    },
  };
}

export function trendContextKey({ player, stat, teamId, opponent }) {
  return JSON.stringify([player, stat, teamId || '', opponent || '']);
}

export function gradeTrendChart(chart, line) {
  return Object.fromEntries(Object.entries(chart || {}).map(([key, value]) => [key,
    Array.isArray(value) ? value.map(game => ({ ...game, over: Number(game.value) > Number(line) })) : value,
  ]));
}

export function mergeTrendCharts(current, incoming) {
  const result = { ...current, meta: { ...current?.meta, ...incoming?.meta } };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (Array.isArray(value) && (value.length || !result[key]?.length)) result[key] = value;
  }
  return result;
}
