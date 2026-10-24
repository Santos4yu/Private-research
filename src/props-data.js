// A Props tab league's lines and league numbers, kept warm (nba-props-data.js,
// nfl-props-data.js). Once a league is switched on for someone (main.jsx),
// they load in idle time after the site opens, and both are saved on the
// device: opening the tab shows the last board at once while a fresh one
// fills in, line by line, as each player's hit rates arrive.
import {loadLines, needsHistory} from './finder-pool.js';
import {loadFinderDefense, loadTonight, readFinderCache} from './unified-finder-data.js';
import {storeBoard, storedBoard} from './finder-store.js';
import {pickLines} from './props-lines.js';

// Saved league numbers this old still show while new ones load.
const LEAGUE_KEEP = 24 * 60 * 60 * 1000;
// The NBA's injury reports (loadTonight) are asked for again after this; never saved.
const TONIGHT_FRESH = 5 * 60 * 1000;
// A board this recent isn't asked for again when the tab opens.
export const PROPS_FRESH = 2 * 60 * 1000;
const teamsIn = league => Object.keys(league?.dvp || {}).length;

/**
 * One league's store: `wanted(row)` is a line its list shows; league numbers
 * for fewer than `minTeams` teams (a season's first few games read alone)
 * never replace the ones there.
 */
export function propsData({sport, wanted, minTeams}) {
  const leagueKey = `${sport}:league-context`;
  let state = {rows: null, league: null, tonight: null, tonightAt: 0, at: 0, loading: false, progress: null, error: false};
  const listeners = new Set();
  let saved = null, running = null;
  const publish = patch => { state = {...state, ...patch}; listeners.forEach(listener => listener(state)); };
  const merged = (rows, fresh) => {
    if (!rows) return fresh;
    const byId = new Map(fresh.map(row => [row.id, row]));
    return rows.map(row => byId.get(row.id) || row);
  };
  /** What the list has right now: {rows, league, at, loading, progress, error}. */
  const get = () => state;
  const on = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  /** The board and league numbers saved on this device, read once. */
  const savedProps = () => {
    saved ||= Promise.all([readFinderCache(sport).catch(() => null), storedBoard(leagueKey).catch(() => null)]).then(([board, league]) => {
      publish({
        rows: state.rows || pickLines((board?.rows || []).filter(wanted)),
        league: state.league || (league?.data && teamsIn(league.data) >= minTeams && Date.now() - Number(league.ts || 0) < LEAGUE_KEEP ? league.data : null),
        at: state.at || Number(board?.ts) || 0,
      });
      return state;
    });
    return saved;
  };
  /** Tonight's injury reports (the NBA), on their own: they change through the day. */
  let asking = null;
  const refreshTonight = () => {
    if (sport !== 'nba') return Promise.resolve(null);
    asking ||= loadTonight().then(tonight => { if (tonight?.teams) publish({tonight, tonightAt: Date.now()}); return tonight; })
      .catch(() => null).finally(() => { asking = null; });
    return asking;
  };
  /** A new board and league numbers, hit rates filling in as they come. One run at a time. */
  const refresh = () => {
    if (running) return running;
    running = (async () => {
      publish({loading: true, progress: null, error: false});
      refreshTonight();
      try {
        const league = loadFinderDefense(sport).then(data => {
          if (data && teamsIn(data) >= minTeams) {
            publish({league: data});
            storeBoard(leagueKey, {ts: Date.now(), data}).catch(() => {});
          }
        }).catch(() => {});
        const rows = await loadLines(sport, {
          only: wanted,
          onBoard: board => publish({rows: merged(null, pickLines(board.filter(wanted)))}),
          onProgress: item => {
            if (item.stage !== 'history') return;
            publish({progress: {done: item.done, total: item.total}, ...(item.rows ? {rows: merged(state.rows, item.rows.filter(wanted))} : {})});
          },
        });
        await league;
        publish({rows: pickLines(rows.filter(wanted)), at: Date.now(), loading: false, progress: null});
      } catch {
        publish({loading: false, progress: null, error: true});
      } finally {
        running = null;
      }
    })();
    return running;
  };
  // An old board, no league numbers, or a line still without its hit rates.
  const stale = current => !current.rows?.length || Date.now() - current.at > PROPS_FRESH || !current.league
    || current.rows.some(row => needsHistory(sport, row));
  /** The saved board read, and a new one loaded if it's stale. */
  const warm = () => savedProps().then(current => {
    if (stale(current)) return refresh();
    if (sport === 'nba' && Date.now() - current.tonightAt > TONIGHT_FRESH) refreshTonight();
    return current;
  });
  /** Tonight's reports again once they're older than TONIGHT_FRESH (a list left open through the evening). */
  const freshenTonight = () => { if (sport === 'nba' && Date.now() - state.tonightAt > TONIGHT_FRESH) refreshTonight(); };
  return {sport, wanted, get, on, saved: savedProps, refresh, warm, freshenTonight};
}
