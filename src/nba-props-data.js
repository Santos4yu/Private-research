// The Props tab's NBA lines and league numbers, kept warm. Once NBA
// matchups are switched on for someone (main.jsx), they load in idle time
// after the site opens, and both are saved on the device: opening the tab
// shows the last board at once while a fresh one fills in, line by line,
// as each player's hit rates arrive.
import {loadLines, needsHistory} from './finder-pool.js';
import {loadFinderDefense, readFinderCache} from './unified-finder-data.js';
import {storeBoard, storedBoard} from './finder-store.js';

// The markets the list grades.
export const PROPS_MARKETS = ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds',
  'player_points_assists', 'player_points_rebounds_assists', 'player_steals', 'player_blocks'];
const MARKETS = new Set(PROPS_MARKETS);
/** A line the list shows: a standard NBA line in a graded market, its game not started. */
export const wanted = row => row.sport === 'nba' && MARKETS.has(row.marketKey) && (row.modifier || 'standard') === 'standard' && !row.promo
  && (!row.startsAt || Date.parse(row.startsAt) > Date.now());

const LEAGUE_KEY = 'nba:league-context';
// Saved league numbers this old still show while new ones load.
const LEAGUE_KEEP = 24 * 60 * 60 * 1000;
// A board this recent isn't asked for again when the tab opens.
export const PROPS_FRESH = 2 * 60 * 1000;

let state = {rows: null, league: null, at: 0, loading: false, progress: null, error: false};
const listeners = new Set();
let saved = null;
let running = null;

const publish = patch => { state = {...state, ...patch}; listeners.forEach(listener => listener(state)); };
const merged = (rows, fresh) => {
  if (!rows) return fresh;
  const byId = new Map(fresh.map(row => [row.id, row]));
  return rows.map(row => byId.get(row.id) || row);
};

/** What the list has right now: {rows, league, at, loading, progress, error}. */
export const nbaProps = () => state;
export function onNbaProps(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The board and league numbers saved on this device, read once. */
export function savedNbaProps() {
  saved ||= Promise.all([readFinderCache('nba').catch(() => null), storedBoard(LEAGUE_KEY).catch(() => null)]).then(([board, league]) => {
    publish({
      rows: state.rows || (board?.rows || []).filter(wanted),
      league: state.league || (league?.data && Date.now() - Number(league.ts || 0) < LEAGUE_KEEP ? league.data : null),
      at: state.at || Number(board?.ts) || 0,
    });
    return state;
  });
  return saved;
}

/** A new board and league numbers, hit rates filling in as they come. One run at a time. */
export function refreshNbaProps() {
  if (running) return running;
  running = (async () => {
    publish({loading: true, progress: null, error: false});
    try {
      const league = loadFinderDefense('nba').then(data => {
        if (data) {
          publish({league: data});
          storeBoard(LEAGUE_KEY, {ts: Date.now(), data}).catch(() => {});
        }
      }).catch(() => {});
      const rows = await loadLines('nba', {
        only: wanted,
        onBoard: board => publish({rows: merged(null, board.filter(wanted))}),
        onProgress: item => {
          if (item.stage !== 'history') return;
          publish({progress: {done: item.done, total: item.total}, ...(item.rows ? {rows: merged(state.rows, item.rows.filter(wanted))} : {})});
        },
      });
      await league;
      publish({rows: rows.filter(wanted), at: Date.now(), loading: false, progress: null});
    } catch {
      publish({loading: false, progress: null, error: true});
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Whether what's there needs a new load: an old board, no league numbers, or a line still without its hit rates. */
const stale = current => !current.rows?.length || Date.now() - current.at > PROPS_FRESH || !current.league
  || current.rows.some(row => needsHistory('nba', row));

/** The saved board read, and a new one loaded if it's stale (the tab opening, or idle time after the site opens). */
export function warmNbaProps() {
  return savedNbaProps().then(current => (stale(current) ? refreshNbaProps() : current));
}
