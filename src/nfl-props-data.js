// The Props tab's NFL lines and league numbers, kept warm (props-data.js):
// the Finder's NFL board (PrizePicks' lines with hit rates from nflverse)
// and its league numbers (what each defense allows each position).
import {propsData} from './props-data.js';
import {NFL_MARKETS, positionOf} from './nfl-matchup-score.js';

const MARKETS = new Set(NFL_MARKETS);
const onPrizePicks = row => Array.isArray(row.apps) && row.apps.some(app => app?.key === 'prizepicks');
/** A line the list shows: a standard PrizePicks NFL line for a QB, back, receiver or tight end in a graded market, its game not started. */
export const wanted = row => row.sport === 'nfl' && MARKETS.has(row.marketKey) && String(row.modifier || 'standard').toLowerCase() === 'standard'
  && !row.promo && onPrizePicks(row) && Boolean(positionOf(row)) && (!row.startsAt || Date.parse(row.startsAt) > Date.now());

// Every team has played by the first week's end.
export const nfl = propsData({sport: 'nfl', wanted, minTeams: 28});
