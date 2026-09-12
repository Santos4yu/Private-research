// Descriptive research history only. Current model, injury and game requests
// never consume these merged records or silently switch season.
export async function loadNFLHistory(load, resource, params, season, mode = 'recent') {
  const requested = mode === 'previous' ? season - 1 : season;
  let current;
  try { current = await load(resource, { ...params, season: requested }); }
  catch { current = { status: 'UNRELIABLE', data: [], reason: 'Selected-season source temporarily unavailable.' }; }
  const rows = Array.isArray(current.data) ? current.data : [];
  if (mode !== 'recent' || rows.length >= 20) return withHistory(current, rows, requested, season, false);
  let previous;
  try { previous = await load(resource, { ...params, season: season - 1 }); }
  catch { previous = { status: 'UNRELIABLE', data: [] }; }
  const older = Array.isArray(previous.data) ? previous.data : [];
  // Require a verified season and identity supplied by the provider adapter.
  const combined = [...older, ...rows].filter(row => row.season === season || row.season === season - 1);
  const unique = [...new Map(combined.map(row => [`${row.season}.${row.game_id}`,row])).values()];
  unique.sort((a,b) => a.season - b.season || a.week - b.week);
  return withHistory({ ...current, status: unique.length ? 'AVAILABLE' : current.status, fetchedAt: current.fetchedAt || previous.fetchedAt, source: current.source || previous.source,
    reason: current.status === 'UNRELIABLE' || previous.status === 'UNRELIABLE' ? 'One season source is temporarily unavailable; showing available records.' : null }, unique, requested, season, older.length > 0);
}

function withHistory(body, rows, requested, season, includedPrevious) {
  const seasons = [...new Set(rows.map(row => row.season))].sort();
  return { ...body, data: rows, history: { seasons, requestedSeason: requested, currentSeason: season, includedPrevious,
    label: seasons.length ? seasons.join(' + ') : String(requested), currentGames: rows.filter(row => row.season === season).length,
    historicalOnly: rows.length > 0 && rows.every(row => row.season < season) } };
}

export function historicalUsage(logs, usage, position, limit = 10) {
  const rows = logs.slice(-limit);
  const mean = (records, key, nested = false) => {
    const values = records.map(row => nested ? row.stats?.[key] : row[key]).filter(Number.isFinite);
    return values.length ? { value: values.reduce((sum,n) => sum+n,0)/values.length, sample: values.length } : { value: null, sample: 0 };
  };
  const fields = position === 'QB' ? [['attempts','Pass attempts / game'],['carries','QB carries / game']] : position === 'RB' ? [['carries','Carries / game'],['targets','Targets / game'],['receptions','Receptions / game']] : [['targets','Targets / game'],['receptions','Receptions / game']];
  const games = new Set(rows.map(row => row.game_id));
  const snaps = usage.filter(row => games.has(row.game_id));
  return [...fields.map(([key,label]) => ({ key,label,...mean(rows,key,true) })),
    { key:'snaps',label:'Offensive snaps / game',...mean(snaps,'offense_snaps') },
    { key:'snapRate',label:'Offensive snap %',...mean(snaps,'offense_snap_rate'), percent:true }];
}

export function compareHistoryLine(logs, prop, quote, statValue) {
  if (!quote?.verified || quote.propType !== prop || !Number.isFinite(quote.value) || !['OVER','UNDER'].includes(quote.direction)) return null;
  const values = logs.map(row => statValue(row,prop)).filter(Number.isFinite);
  const pushes = values.filter(value => value === quote.value).length;
  const hits = values.filter(value => quote.direction === 'OVER' ? value > quote.value : value < quote.value).length;
  const decided = values.length - pushes;
  return { games:values.length,hits,misses:decided-hits,pushes,hitRate:decided ? hits/decided*100 : null };
}
