// Every league's lines with their hit rates, for the Finder and the Smart
// Slip alike. Both read and write the same saved boards (finder-store.js),
// so hit rates worked out on one page are there on the other.
import {loadFinderSport, enrichMlbRows, enrichWnbaRows, enrichSoccerRows, enrichNhlRows, enrichTennisRows, persistFinderCache, readFinderCache,
  carryHistory, loadFinderDefense, withDefense, loadMlbMatchups, withMlbMatchups} from './unified-finder-data';

// How each league's lines get their hit rates after the board arrives.
export const ENRICH = {wnba: enrichWnbaRows, nba: enrichWnbaRows, mlb: enrichMlbRows, soccer: enrichSoccerRows, nhl: enrichNhlRows, tennis: enrichTennisRows};
export const ENRICH_CONCURRENCY = {wnba: 6, nba: 6, mlb: 3, soccer: 4, nhl: 4, tennis: 2};
// A saved board younger than this is used without asking again.
export const BOARD_FRESH = 2 * 60 * 1000;
// When each line's hit rates were worked out, so a later board can keep them.
export const stamped = rows => {
  const now = Date.now();
  return rows.map(row => row.historyStatus === 'ready' && !row.enrichedAt ? {...row, enrichedAt: now} : row);
};
export const needsHistory = (sport, row) => row.historyStatus === 'pending'
  || ((sport === 'wnba' || sport === 'nba' || sport === 'mlb') && row.historyStatus !== 'ready' && row.historyStatus !== 'none');

/**
 * One league's current lines, hit rates filled in, (WNBA, NBA, NFL) what each
 * defense allows and (MLB) today's probable starters and lineups. `only` limits which lines get their hit rates worked out;
 * `onProgress` hears {sport, stage, done, total, rows} as it goes, `rows`
 * being the lines just filled in.
 */
export async function loadLines(sport, {signal, onProgress, only} = {}) {
  onProgress?.({sport, stage: 'lines', done: 0, total: 0});
  const cached = await readFinderCache(sport);
  let result = cached;
  if (!cached || Date.now() - Number(cached.ts || 0) >= BOARD_FRESH) {
    const fresh = await loadFinderSport(sport, {signal, fast: sport === 'wnba' || sport === 'nba'});
    result = {...fresh, ts: Date.now(), rows: carryHistory(fresh.rows, cached?.rows || [])};
    persistFinderCache(sport, result);
  }
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
  return rows;
}
