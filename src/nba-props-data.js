// The Props tab's NBA lines and league numbers, kept warm (props-data.js).
import {propsData, PROPS_FRESH} from './props-data.js';
import {listedTier} from './props-lines.js';

// The markets the list grades.
export const PROPS_MARKETS = ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds',
  'player_points_assists', 'player_points_rebounds_assists', 'player_steals', 'player_blocks'];
const MARKETS = new Set(PROPS_MARKETS);
/** A line the list may show: a standard, Goblin or Demon NBA line in a graded market, its game not started (props-lines.js picks one of each kind a stat). */
export const wanted = row => row.sport === 'nba' && MARKETS.has(row.marketKey) && listedTier(row) && !row.promo
  && (!row.startsAt || Date.parse(row.startsAt) > Date.now());

// League numbers for fewer teams than this are a season's first few games alone.
export const nba = propsData({sport: 'nba', wanted, minTeams: 25});
export const nbaProps = nba.get, onNbaProps = nba.on, savedNbaProps = nba.saved, refreshNbaProps = nba.refresh, warmNbaProps = nba.warm;
export {PROPS_FRESH};
