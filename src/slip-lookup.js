// A slip's pick whose player isn't on today's board -- his game has
// started (the boards drop those), or no app posts his stat -- is still
// graded: the player is looked up by name in his league, and his own games
// are scored at the slip's number, the same way a board line would be.
import {normalizeFinderRows} from './unified-finder-data.js';
import {statKeys, mlbMarkets} from './slip-check.js';

// The slip's stat (slip-check.js keys) as each league's game-log field.
const BASKETBALL = {pts: 'player_points', reb: 'player_rebounds', ast: 'player_assists', '3pm': 'player_threes',
  '3pa': 'player_threes_attempts', fgm: 'player_field_goals', fga: 'player_field_goals_attempts', ftm: 'player_frees_made',
  fta: 'player_frees_attempts', blk: 'player_blocks', stl: 'player_steals', tov: 'player_turnovers',
  'pts+reb': 'player_points_rebounds', 'ast+pts': 'player_points_assists', 'ast+reb': 'player_rebounds_assists',
  'ast+pts+reb': 'player_points_rebounds_assists', 'blk+stl': 'player_blocks_steals', fantasy: 'player_fantasy_points',
  '2pm': 'player_twos', pf: 'player_fouls', oreb: 'player_offensive_rebounds', dreb: 'player_defensive_rebounds',
  dd: 'player_double_double', td: 'player_triple_double'};
const NHL = {pts: 'points', goals: 'goals', ast: 'assists', sog: 'sog', hits: 'hits', blk: 'blocked', toi: 'toi', fow: 'fow',
  ppp: 'ppp', attempts: 'attempts', pim: 'pim', pm: 'plus_minus', saves: 'saves', ga: 'ga', fantasy: 'fantasy',
  'blk+hits': 'hits_blocks'};

const nflSeason = (now = new Date()) => now.getUTCFullYear() - (now.getUTCMonth() < 2 ? 1 : 0);
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

async function get(url, {signal, fetcher = fetch} = {}) {
  const response = await fetcher(url, {signal, cache: 'no-store', credentials: 'same-origin'});
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || 'Player lookup failed.');
  return data;
}

// Every lookup keeps games that have started: that's the point of it.
const normalized = (sport, payload) => normalizeFinderRows(sport, payload, [], {now: 0});

async function nfl(leg, options) {
  const query = new URLSearchParams({resource: 'finder-find', season: String(nflSeason()), name: leg.player,
    stat: leg.stat || leg.statName || '', line: String(leg.line ?? '')});
  if (leg.team) query.set('team', leg.team);
  return normalized('nfl', await get(`/api/nfl?${query}`, options))[0] || null;
}

async function basketball(leg, sport, options) {
  const query = new URLSearchParams({resource: 'find', name: leg.player});
  if (sport === 'nba') query.set('league', 'nba');
  if (leg.team) query.set('team', leg.team);
  const [who] = (await get(`/api/wnba?${query}`, options)).rows || [];
  if (!who?.playerId) return null;
  const key = [...statKeys(sport, leg.stat), ...statKeys(sport, leg.statName)].find(item => BASKETBALL[item]);
  const [row] = normalized(sport, {rows: [{id: `slip:${who.playerId}:${slug(leg.stat)}:${leg.line}`, player: who.name || leg.player,
    playerId: who.playerId, marketKey: BASKETBALL[key] || null, market: leg.stat, line: leg.line, modifier: 'standard',
    headshot: who.headshot, position: who.position, height: who.height, team: who.team, teamAbbr: who.teamAbbr,
    teamLogo: who.teamLogo, apps: []}]});
  if (!row || !key) return row ? {...row, historyStatus: 'none'} : null;
  const [scored] = await options.enrich(sport)([row], {signal: options.signal, concurrency: 1});
  return scored || row;
}

async function mlb(leg, options) {
  // "Strikeouts" may be a hitter's or a pitcher's: the first with games wins.
  // MLB players are looked up by name alone, so no games means no player.
  for (const market of mlbMarkets(leg.stat || leg.statName)) {
    const [row] = normalized('mlb', {props: [{id: `slip:${slug(leg.player)}:${market.key}:${leg.line}`, player: leg.player,
      stat: market.label, line: leg.line, odds_type: 'standard', team: leg.team || null, apps: []}]});
    if (!row) continue;
    const [scored] = await options.enrich('mlb')([row], {signal: options.signal, concurrency: 1});
    if (scored?.historyStatus === 'ready' && scored.gameLog?.length) return scored;
  }
  return null;
}

async function nhl(leg, options) {
  const query = new URLSearchParams({view: 'nhl', resource: 'find', name: leg.player});
  if (leg.team) query.set('team', leg.team);
  const [who] = (await get(`/api/board?${query}`, options)).rows || [];
  if (!who?.playerId) return null;
  const key = [...statKeys('nhl', leg.stat), ...statKeys('nhl', leg.statName)].find(item => NHL[item]);
  const [row] = normalized('nhl', {rows: [{...who, id: `slip:${who.playerId}:${slug(leg.stat)}:${leg.line}`, stat: leg.stat,
    marketKey: slug(leg.stat).replace(/-/g, ''), valueKey: NHL[key] || null, line: leg.line, modifier: 'standard', apps: []}]});
  if (!row || row.historyStatus !== 'pending') return row;
  const [scored] = await options.enrich('nhl')([row], {signal: options.signal, concurrency: 1});
  return scored || row;
}

/**
 * The leg's player as a board line at the slip's number, his hit rates
 * worked out from his games; null when no one by that name is found.
 * `sports` are the leagues to look in (the leg's own first), `enrich(sport)`
 * the league's history loader (finder-pool.js ENRICH).
 */
export async function lookupRow(leg, {sports = [], enrich, signal, fetcher} = {}) {
  if (!leg.player) return null;
  const options = {signal, fetcher, enrich: sport => enrich?.(sport) || (async rows => rows)};
  // No line read: the player is still found (his photo, team and game), at
  // a stand-in line whose hit rates are then dropped.
  const unread = leg.line == null;
  const asked = unread ? {...leg, line: 0} : leg;
  let failure = null, answered = false;
  for (const sport of sports) {
    try {
      const row = sport === 'nfl' ? await nfl(asked, options)
        : sport === 'nba' || sport === 'wnba' ? await basketball(asked, sport, options)
          : sport === 'mlb' ? await mlb(asked, options)
            : sport === 'nhl' ? await nhl(asked, options) : null;
      answered = true;
      if (row) return unread ? {...row, line: null, windows: null, average: null, streak: null} : row;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      failure ||= error;
    }
  }
  // Not one league answered: the data is out of reach, not the player unknown.
  if (failure && !answered) throw Object.assign(new Error(failure.message || 'Player data is unavailable right now.'), {lookup: true});
  return null;
}
