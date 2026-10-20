// Every league's lines with their hit rates, for the Finder and the Smart
// Slip alike. Both read and write the same saved boards (finder-store.js),
// so hit rates worked out on one page are there on the other.
import {withBookLines} from './line-value.js';
import {loadFinderSport, enrichMlbRows, enrichWnbaRows, enrichSoccerRows, enrichNhlRows, enrichCfbRows, enrichTennisRows, persistFinderCache, readFinderCache,
  carryHistory, loadFinderDefense, withDefense, loadMlbMatchups, withMlbMatchups} from './unified-finder-data.js';

// How each league's lines get their hit rates after the board arrives.
export const ENRICH = {wnba: enrichWnbaRows, nba: enrichWnbaRows, mlb: enrichMlbRows, soccer: enrichSoccerRows, nhl: enrichNhlRows, cfb: enrichCfbRows, tennis: enrichTennisRows};
export const ENRICH_CONCURRENCY = {wnba: 4, nba: 4, mlb: 3, soccer: 4, nhl: 4, cfb: 4, tennis: 2};
// A saved board younger than this is used without asking again.
export const BOARD_FRESH = 2 * 60 * 1000;
// When a new board can't be had (its source refusing for a moment), one
// saved within this long stands in: lines whose games have started drop
// out wherever they're used.
export const BOARD_FALLBACK = 60 * 60 * 1000;
// A failure this quick is asked again once, after a moment; a slow one
// (the server ran out of time) isn't, so nobody waits twice as long.
const QUICK_FAILURE = 12 * 1000;
const RETRY_AFTER = 1500;
// When each line's hit rates were worked out, so a later board can keep them.
export const stamped = rows => {
  const now = Date.now();
  return rows.map(row => row.historyStatus === 'ready' && !row.enrichedAt ? {...row, enrichedAt: now} : row);
};
export const needsHistory = (sport, row) => row.historyStatus === 'pending'
  || row.historyRefresh
  || ((sport === 'wnba' || sport === 'nba' || sport === 'mlb') && row.historyStatus !== 'ready' && row.historyStatus !== 'none');

/**
 * One league's board as it stands, without working out any hit rates: the
 * saved one while it is fresh (or, with `saved`, any from the last day),
 * else a new one, saved for next time.
 */
export async function loadBoard(sport, {signal, saved = false, load = loadFinderSport, read = readFinderCache, persist = persistFinderCache,
  wait = pause} = {}) {
  const cached = await read(sport);
  if (cached && (saved || Date.now() - Number(cached.ts || 0) < BOARD_FRESH)) return cached;
  const ask = () => load(sport, {signal, fast: sport === 'wnba' || sport === 'nba'});
  let fresh;
  const started = Date.now();
  try {
    fresh = await ask().catch(async error => {
      if (error?.name === 'AbortError' || Date.now() - started > QUICK_FAILURE) throw error;
      await wait(RETRY_AFTER, signal);
      return ask();
    });
  } catch (error) {
    if (error?.name !== 'AbortError' && cached?.rows?.length && Date.now() - Number(cached.ts || 0) < BOARD_FALLBACK) return cached;
    throw error;
  }
  const result = {...fresh, ts: Date.now(), rows: carryHistory(fresh.rows, cached?.rows || [])};
  persist(sport, result);
  return result;
}

const pause = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, {once: true});
});

/**
 * One league's current lines, hit rates filled in, (WNBA, NBA, NFL) what each
 * defense allows and (MLB) today's probable starters and lineups. `only` limits which lines get their hit rates worked out;
 * `onProgress` hears {sport, stage, done, total, rows} as it goes, `rows`
 * being the lines just filled in.
 */
export async function loadLines(sport, {signal, onProgress, only} = {}) {
  onProgress?.({sport, stage: 'lines', done: 0, total: 0});
  let result = await loadBoard(sport, {signal});
  const enrich = ENRICH[sport];
  const pending = result.rows.filter(row => (!only || only(row)) && needsHistory(sport, row));
  if (enrich && pending.length) {
    let done = 0;
    onProgress?.({sport, stage: 'history', done, total: pending.length});
    const enriched = await enrich(pending, {signal, concurrency: ENRICH_CONCURRENCY[sport], onRows: batch => {
      done = Math.min(pending.length, done + batch.length);
      onProgress?.({sport, stage: 'history', done, total: pending.length, rows: batch});
    }});
    const updates = new Map(stamped(enriched).map(row => [row.id, row]));
    result = {...result, rows: result.rows.map(row => updates.get(row.id) || row)};
    persistFinderCache(sport, result);
  }
  let rows = result.rows;
  onProgress?.({sport, stage: 'done', done: pending.length, total: pending.length});
  // Matchups add to a line; without them the line still stands.
  try {
    if (sport === 'wnba' || sport === 'nba' || sport === 'nfl') rows = withDefense(rows, await loadFinderDefense(sport, {signal}));
    if (sport === 'mlb') rows = withMlbMatchups(rows, await loadMlbMatchups({signal}));
  } catch (error) { if (error.name === 'AbortError') throw error; }
  // PrizePicks lines the books post at another number get the books' read
  // moved to theirs (line-value.js).
  return withBookLines(rows);
}
