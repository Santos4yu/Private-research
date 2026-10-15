import {finderMarket, gameValue, historyChart, nameKey} from './prop-finder-core.js';
import {teamLogoUrl} from './sports/nfl/nfl-ui-core.js';
import {MARKET_STAT as WNBA_DVP_STAT, positionOf} from './sports/wnba/wnba-research.js';
import {playerGames, statKeyOf, valueOf} from './sports/soccer/soccer-stats.js';
import {playerGames as nhlPlayerGames, statValue as nhlValue} from './sports/nhl/nhl-stats.js';
import {playerGames as cfbPlayerGames, statValue as cfbValue, allowedByTeam as cfbAllowed, allowTable as cfbAllowTable} from './sports/cfb/cfb-stats.js';
import {storedBoard, storeBoard} from './finder-store.js';

const WINDOW_KEYS = ['l5', 'l10', 'l15', 'l20', 'h2h', 'season'];
export const BOOK_NAMES = {prizepicks: 'PrizePicks', underdog: 'Underdog', pick6: 'DK Pick6', betr_us_dfs: 'Betr Picks',
  draftkings: 'DraftKings', fanduel: 'FanDuel', betmgm: 'BetMGM', williamhill_us: 'Caesars', espnbet: 'ESPN BET',
  fanatics: 'Fanatics', betrivers: 'BetRivers', hardrockbet: 'Hard Rock Bet', pinnacle: 'Pinnacle'};
const NFL_LABELS = {passing_yards: 'Passing Yards', passing_attempts: 'Passing Attempts', pass_completions: 'Pass Completions', passing_touchdowns: 'Passing TDs', interceptions: 'Interceptions', rushing_yards: 'Rushing Yards', rush_attempts: 'Rush Attempts', passing_rushing_yards: 'Passing + Rushing Yards', receiving_yards: 'Receiving Yards', receptions: 'Receptions', targets: 'Targets', longest_reception: 'Longest Reception', rushing_receiving_yards: 'Rushing + Receiving Yards', touchdowns: 'Touchdowns', fantasy_score: 'Fantasy Score'};
const historyCache = new Map();
const HISTORY_TTL = 10 * 60 * 1000;
/** The two basketball leagues: one row shape, one history source (api/wnba.py). */
export const BASKETBALL = new Set(['wnba', 'nba']);
export function finderPlayerRows(rows, selected) {
  if(!selected)return [];
  return rows.filter(row=>{
    if(row.sport!==selected.sport)return false;
    if(row.sport==='cs2')return nameKey(row.player)===nameKey(selected.player)&&row.opponent===selected.opponent&&Number.isFinite(Date.parse(row.startsAt))&&Date.parse(row.startsAt)===Date.parse(selected.startsAt);
    if(row.sport!=='tennis')return selected.playerId?row.playerId===selected.playerId:row.player===selected.player;
    if(nameKey(row.player)!==nameKey(selected.player))return false;
    const opponent=value=>nameKey(String(value||'').replace(/\s+1st\s+set.*$/i,''));
    if(opponent(row.opponent)!==opponent(selected.opponent))return false;
    const a=Date.parse(row.startsAt),b=Date.parse(selected.startsAt);
    return !Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)<=12*60*60*1000;
  });
}
const FINDER_CACHE_PREFIX = 'vortex:finder:board:v6:';
const FINDER_CACHE_TTL = 24 * 60 * 60 * 1000;

const number = value => value == null || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const side = value => String(value || '').toUpperCase() === 'UNDER' ? 'UNDER' : 'OVER';
const optional = value => value || null;
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const photo = id => id ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${encodeURIComponent(id)}/headshot/silo/current` : null;
const mlbLogo = id => id ? `https://www.mlbstatic.com/team-logos/${encodeURIComponent(id)}.svg` : null;

function legacyStore() {
  try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; }
}

function usableBoard(value, now) {
  if (!value || !Array.isArray(value.rows) || !value.rows.length || now - Number(value.ts || 0) > FINDER_CACHE_TTL) return null;
  const rows = value.rows.filter(row => !row.startsAt || !Number.isFinite(Date.parse(row.startsAt)) || Date.parse(row.startsAt) > now);
  return rows.length ? {...value, rows, persisted: true} : null;
}

/** The saved board for a sport (IndexedDB, finder-store.js), so a returning
 * user sees props and hit rates before any request: null when there is none
 * from the last day. Boards saved by older versions in localStorage are
 * read once, then cleared. */
export async function readFinderCache(sport, now = Date.now()) {
  try {
    const saved = usableBoard(await storedBoard(sport), now);
    if (saved) return sport === 'tennis' ? {...saved,rows:saved.rows.map(row=>row.historyStatus==='none'?{...row,historyStatus:'pending'}:row)} : saved;
    const legacy = legacyStore();
    const value = legacy ? JSON.parse(legacy.getItem(FINDER_CACHE_PREFIX + sport) || 'null') : null;
    legacy?.removeItem(FINDER_CACHE_PREFIX + sport);
    return usableBoard(value, now);
  } catch { return null; }
}

export function persistFinderCache(sport, value) {
  if (!value?.rows?.length) return Promise.resolve();
  const rows = value.rows.map(row => {
    const compact = {...row};
    // History and chart payloads are shared by many lines and are fetched
    // again when a player page needs them.
    delete compact.history;
    delete compact.chart;
    // A basketball line already carries everything in its board row, so the
    // copy of that row is left out (a fifth of what's saved).
    if (BASKETBALL.has(compact.sport)) delete compact.raw;
    return compact;
  });
  // ts is when the board was fetched (kept through later saves), so a board
  // re-saved from the screen doesn't pass for a newer one.
  return storeBoard(sport, {ts: Number(value.ts) || Date.now(), fetchedAt: value.fetchedAt || null, rows}).catch(() => {});
}

// A line's hit rates stay good until the player's next game, and a line is
// for one upcoming game, so a refreshed board keeps them for every line
// that is still the same prop at the same number. Only new lines, and lines
// that moved, load history again.
const HISTORY_KEEP = 6 * 60 * 60 * 1000;
const HISTORY_FIELDS = ['average', 'windows', 'streak', 'diff', 'averageDelta', 'historyStatus', 'enrichedAt', 'gameLog', 'historyAsOf', 'historyRefresh'];
// What history fills in that a board can leave blank (an MLB player's id,
// photo and opponent). Prices and odds are never carried: the new board's
// are the current ones.
const IDENTITY_FIELDS = ['playerId', 'headshot', 'teamLogo', 'position', 'opponent', 'opponentTeamId', 'startsAt', 'isHome'];
export function carryHistory(rows, previous = [], now = Date.now()) {
  const before = new Map();
  for (const row of previous || []) {
    if (row?.historyStatus === 'ready' && now - Number(row.enrichedAt || 0) < HISTORY_KEEP) before.set(row.id, row);
  }
  if (!before.size) return rows;
  return rows.map(row => {
    const old = before.get(row.id);
    if (!old || (row.historyStatus === 'ready' && Number(row.enrichedAt||0)>=Number(old.enrichedAt||0)) || old.line !== row.line || old.direction !== row.direction
      || (old.valueKey || old.marketKey || old.stat) !== (row.valueKey || row.marketKey || row.stat)) return row;
    const kept = {...row};
    for (const key of IDENTITY_FIELDS) if (kept[key] == null && old[key] != null) kept[key] = old[key];
    for (const key of HISTORY_FIELDS) kept[key] = old[key];
    return kept;
  });
}

function aborted(signal) {
  if (signal?.aborted) throw signal.reason || new DOMException('Request aborted', 'AbortError');
}

async function request(url, {signal, fetcher = fetch} = {}) {
  aborted(signal);
  const response = await fetcher(url, {signal, cache: 'no-store', credentials: 'same-origin'});
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(data.error || 'Prop data is temporarily unavailable.');
    if (data.retryAfter > 0) error.retryAfter = data.retryAfter;
    throw error;
  }
  return data;
}

const pause = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, {once: true});
});
// The NHL refuses for a minute when asked too often; the server says how
// long, and the request waits that out a few times before giving up.
export async function patientRequest(url, options = {}, tries = 5) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await request(url, options);
    } catch (error) {
      if (!error.retryAfter || attempt >= tries) throw error;
      await pause(Math.min(error.retryAfter, 65) * 1000, options.signal);
    }
  }
}

// ---------------------------------------------------------------- matchup

// Pick'em apps. PrizePicks' prices are fixed payouts, never odds, and any
// app quoting the same price on both sides (-137 / -137) says nothing about
// which side is likelier -- both are left out. A pick'em app that does
// price the sides apart (Underdog's adjusted payouts) counts, at half weight.
export const PICKEM_APPS = new Set(['prizepicks', 'underdog', 'sleeper', 'dabble', 'betr', 'betr_us_dfs', 'pick6', 'parlayplay', 'chalkboard']);
// Pinnacle's lines move on sharp money: when it prices a line, it counts
// three times.
const SHARP_WEIGHT = {pinnacle: 3};
// What a book's two prices usually add up to on a player prop (about
// -115 / -115 on a main line, more on alternates). A line quoted on one
// side only -- most alternate "Over" lines behind Goblins and Demons -- is
// read as if its other side filled out this total.
export const ONE_SIDED_OVERROUND = 1.08;
const validPrice = price => typeof price === 'number' && Number.isFinite(price) && Math.abs(price) >= 100;
const impliedChance = price => price < 0 ? -price / (-price + 100) : 100 / (price + 100);

/**
 * Fair chance of the first side, with the book's margin removed by the
 * power method: the k where a^k + b^k = 1. Unlike scaling both sides by the
 * same factor, it takes more margin off the long shot than the favorite,
 * which is how books price lopsided lines (-650 / +375).
 */
export function powerDevig(a, b) {
  let low = 0.05, high = 20;
  for (let step = 0; step < 60; step += 1) {
    const k = (low + high) / 2;
    if (a ** k + b ** k > 1) low = k; else high = k;
  }
  return a ** ((low + high) / 2);
}

function bookChance(app) {
  const over = validPrice(app.over) ? impliedChance(app.over) : null;
  const under = validPrice(app.under) ? impliedChance(app.under) : null;
  if (over != null && under != null) return {over: powerDevig(over, under), twoSided: true};
  if (over != null) return {over: powerDevig(over, Math.max(0.01, ONE_SIDED_OVERROUND - over)), twoSided: false};
  if (under != null) return {over: 1 - powerDevig(under, Math.max(0.01, ONE_SIDED_OVERROUND - under)), twoSided: false};
  return null;
}

/**
 * The Over / Under chance the books' prices imply for this line: each
 * book's margin removed, then a weighted average -- a book pricing both
 * sides counts twice as much as one quoting only the Over, Pinnacle three
 * times as much, a pick'em app half. Null when no book prices the line --
 * never a made-up 50/50.
 */
export function bookProbability(apps) {
  const books = [];
  for (const app of Array.isArray(apps) ? apps : []) {
    if (!app || app.key === 'prizepicks' || (PICKEM_APPS.has(app.key) && app.over === app.under)) continue;
    const chance = bookChance(app);
    if (!chance) continue;
    const weight = (SHARP_WEIGHT[app.key] || 1) * (chance.twoSided ? 1 : 0.5) * (PICKEM_APPS.has(app.key) ? 0.5 : 1);
    books.push({name: app.name || BOOK_NAMES[app.key] || app.key, over: chance.over * 100, twoSided: chance.twoSided, weight});
  }
  if (!books.length) return null;
  const total = books.reduce((sum, book) => sum + book.weight, 0);
  const over = books.reduce((sum, book) => sum + book.over * book.weight, 0) / total;
  return {over, under: 100 - over, books};
}

// NFL market -> the stat the league's defense-vs-position table ranks
// (backend/sports/nfl/finder.py DVP_STATS).
const NFL_DVP_STAT = {
  passing_yards: 'passing_yards', passing_touchdowns: 'passing_tds', passing_attempts: 'attempts',
  pass_completions: 'completions', interceptions: 'interceptions', rushing_yards: 'rushing_yards',
  rush_attempts: 'carries', receptions: 'receptions', receiving_yards: 'receiving_yards', targets: 'targets',
  rushing_receiving_yards: 'rush_rec_yards', fantasy_score: 'fantasy', fg_made: 'fg_made',
  kicking_points: 'kicking_points', tackles: 'tackles_assists', sacks: 'sacks', def_interceptions: 'interceptions_def',
};
function nflDvpPosition(value) {
  const position = String(value || '').toUpperCase();
  if (['QB', 'RB', 'WR', 'TE', 'FB', 'K'].includes(position)) return position;
  if (['DE', 'DT', 'NT', 'DL', 'EDGE'].includes(position)) return 'DL';
  if (['LB', 'OLB', 'ILB', 'MLB'].includes(position)) return 'LB';
  if (['CB', 'S', 'SS', 'FS', 'DB', 'SAF'].includes(position)) return 'DB';
  return null;
}

/**
 * The opponent's season rank for what it allows the player's position in
 * this stat -- the player page's Defense vs position numbers. Rank 1 allows
 * the least (toughest); the last rank allows the most.
 */
export function defenseRank(row, league) {
  return defenseCell(row, league)?.rank ?? null;
}

/**
 * What the opponent allows the player's position in this stat: its season
 * number and rank, its recent number (last 10, else last 5) and the
 * league's average, for the Smart Slip's matchup read.
 */
export function defenseCell(row, league) {
  if (!league?.dvp || !row?.opponent) return null;
  const hoops = BASKETBALL.has(row.sport);
  const position = hoops ? positionOf(row.position) : nflDvpPosition(row.position);
  const stat = hoops ? WNBA_DVP_STAT[row.marketKey] : NFL_DVP_STAT[row.marketKey];
  const cell = league.dvp[row.opponent]?.[position]?.stats?.[stat];
  const rank = cell?.szn?.[1];
  if (typeof rank !== 'number' || !Number.isFinite(rank)) return null;
  const everyone = Object.values(league.dvp).map(team => number(team?.[position]?.stats?.[stat]?.szn?.[0])).filter(value => value != null);
  return {rank, value: number(cell.szn[0]), recent: number((cell.l10 || cell.l5)?.[0]), average: mean(everyone), position};
}

// What every team allows a position in a stat, against the league's
// average (1 is average; above 1 gives up more): for judging the games a
// player has already played by who they came against (slip-analyst.js).
// One table per league, position and stat, shared by every line on it.
const allowTables = new WeakMap();
export function defenseAllowTable(row, league) {
  if (!league?.dvp || !row) return null;
  const hoops = BASKETBALL.has(row.sport);
  const position = hoops ? positionOf(row.position) : nflDvpPosition(row.position);
  const stat = hoops ? WNBA_DVP_STAT[row.marketKey] : NFL_DVP_STAT[row.marketKey];
  if (!position || !stat) return null;
  let tables = allowTables.get(league);
  if (!tables) allowTables.set(league, tables = new Map());
  const key = `${position}|${stat}`;
  if (!tables.has(key)) {
    const values = Object.entries(league.dvp).map(([team, cell]) => [team, number(cell?.[position]?.stats?.[stat]?.szn?.[0])]).filter(([, value]) => value != null);
    const average = mean(values.map(([, value]) => value));
    tables.set(key, values.length >= 4 && average > 0 ? Object.fromEntries(values.map(([team, value]) => [team, value / average])) : null);
  }
  return tables.get(key);
}

export function withDefense(rows, league) {
  if (!league?.dvp || !Array.isArray(rows)) return rows;
  return rows.map(row => {
    const cell = defenseCell(row, league);
    const rank = cell?.rank ?? null;
    const allowTable = defenseAllowTable(row, league);
    if (rank === row.defense && (cell?.value ?? null) === (row.defenseValue ?? null) && allowTable === (row.allowTable ?? null)) return row;
    return {...row, defense: rank, defenseTeams: league.teamCount || null, defenseValue: cell?.value ?? null,
      defenseRecent: cell?.recent ?? null, defenseAverage: cell?.average ?? null, defensePosition: cell?.position ?? null, allowTable};
  });
}

/** Today's MLB matchups: probable starters, every team's rates (mlb_context.py). */
export function loadMlbMatchups(options = {}) {
  return request('/api/board?view=mlb-context', options);
}

/**
 * Each MLB line with what it faces: a hitter the opponent's probable
 * starter (and its staff), a pitcher the opposing lineup, with the
 * league's averages alongside.
 */
export function withMlbMatchups(rows, context) {
  if (!context || !Array.isArray(rows)) return rows;
  // Every team's staff and lineup, for judging a player's past games by
  // who they came against (slip-analyst.js), shared by every line.
  const teams = {pitching: context.pitching || null, hitting: context.hitting || null, league: context.league || null};
  return rows.map(row => {
    const opponent = row.opponentTeamId == null ? null : String(row.opponentTeamId);
    if (row.sport !== 'mlb' || !opponent) return row;
    const pitcher = String(row.marketKey || '').startsWith('pitching:');
    const team = row.teamId == null ? null : String(row.teamId);
    // A pitcher's own starter line (his hand, recent starts, projected
    // innings) when he is his team's probable today.
    const own = team ? context.probables?.[team] || null : null;
    const self = own && (row.playerId == null || String(own.id) === String(row.playerId)) ? own : null;
    const matchup = pitcher ? {kind: 'lineup', lineup: context.hitting?.[opponent] || null, self, league: context.league || null}
      : {kind: 'pitcher', pitcher: context.probables?.[opponent] || null, staff: context.pitching?.[opponent] || null,
        lineup: team ? context.hitting?.[team] || null : null, league: context.league || null};
    return {...row, matchup, mlbTeams: teams};
  });
}

/** Every hitter's matchup today, graded the way Research grades one (mlb_prop_matchups.py). */
export function loadHitterMatchups(options = {}) {
  return request('/api/board?view=mlb-matchups', options);
}

/** Each MLB hitter line with its matchup grades (pitchers keep their lineup read). */
export function withHitterMatchups(rows, data) {
  const players = data?.players;
  if (!players || !Array.isArray(rows)) return rows;
  return rows.map(row => {
    if (row.sport !== 'mlb' || String(row.marketKey || '').startsWith('pitching:') || row.playerId == null) return row;
    const found = players[String(row.playerId)];
    return found ? {...row, hitterMatchup: found} : row;
  });
}

/** The league table the defense ranks come from (WNBA, NBA and NFL). */
export function loadFinderDefense(sport, options = {}) {
  if (sport === 'wnba') return request('/api/wnba?resource=league-context', options);
  if (sport === 'nba') return request('/api/wnba?league=nba&resource=league-context', options);
  if (sport === 'nfl') {
    const today = new Date();
    const season = options.season || today.getUTCFullYear() - (today.getUTCMonth() < 2 ? 1 : 0);
    return request(`/api/nfl?resource=finder-league&season=${season}`, options);
  }
  return Promise.resolve(null);
}

// The games behind a line, newest last, for the Smart Slip's projection
// (slip-analyst.js): each game's value, date, venue, opponent and the
// player's playing time (minutes, plate appearances, pitches).
const GAME_LOG = 25;
export function gameLog(entries) {
  return (entries || []).map(entry => ({value: number(entry.value), date: entry.date ? String(entry.date).slice(0, 10) : null,
    home: typeof entry.home === 'boolean' ? entry.home : null, opponent: entry.opponent ?? null, usage: number(entry.usage)}))
    .filter(entry => entry.value != null).slice(-GAME_LOG);
}

export function finderWindow(values, line, direction = 'OVER') {
  const valid = values.map(number).filter(value => value != null);
  const threshold = number(line);
  const pushes = threshold == null ? null : valid.filter(value => value === threshold).length;
  const hits = threshold == null ? null : valid.filter(value => side(direction) === 'UNDER' ? value < threshold : value > threshold).length;
  const decisions = threshold == null ? 0 : valid.length - pushes;
  return {hits, misses: threshold == null ? null : decisions - hits, pushes, decisions, sample: valid.length,
    hitRate: decisions ? hits / decisions * 100 : null, average: mean(valid)};
}

function normalizeWindows(windows) {
  return Object.fromEntries(WINDOW_KEYS.map(key => {
    const source = windows?.[key] || (key === 'season' ? windows?.szn : null);
    if (!source) return [key, null];
    const sample = number(source.sample);
    return [key, {...source, sample, hits: number(source.hits), misses: number(source.misses), pushes: number(source.pushes),
      hitRate: sample === 0 ? null : number(source.hitRate), average: number(source.average)}];
  }));
}

function applications(apps) {
  return (Array.isArray(apps) ? apps : []).map(app => ({...app, key: app.key,
    name: app.name || BOOK_NAMES[app.key] || app.key, over: number(app.over), under: number(app.under)}))
    .sort((a, b) => (a.key === 'prizepicks' ? -1 : b.key === 'prizepicks' ? 1 : 0));
}

// A notification's link (pick_alerts.py) names a prop as sport, player and
// PrizePicks' stat: /finder?sport=mlb&player=Aaron+Judge&stat=Total+Bases.
// The Finder's labels sometimes spell a stat out where PrizePicks abbreviates
// it ("Points + Rebounds + Assists" / "Pts+Rebs+Asts"); both read the same.
const STAT_WORDS = {points: 'pts', point: 'pts', score: 'pts', rebounds: 'rebs', rebound: 'rebs', assists: 'asts',
  assist: 'asts', blocks: 'blks', block: 'blks', steals: 'stls', steal: 'stls', pointers: 'pt', pointer: 'pt',
  turnovers: 'to', yards: 'yds', yard: 'yds', receiving: 'rec', rushing: 'rush', passing: 'pass', strikeouts: 'ks',
  strikeout: 'ks', and: ''};
export const propStatKey = value => (String(value || '').toLowerCase().match(/[a-z0-9]+/g) || [])
  .map(word => STAT_WORDS[word] ?? word).join('');
const playerKey = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function linkTarget(search) {
  const params = new URLSearchParams(search || '');
  const sport = (params.get('sport') || '').toLowerCase(), player = params.get('player') || '';
  return sport && player ? {sport, player, stat: params.get('stat') || ''} : null;
}

/** The board line a link names: that player's line for that stat, the
 * standard one first. Null when it's no longer posted. */
export function findLinkedRow(rows, target) {
  if (!target) return null;
  const stat = propStatKey(target.stat);
  const theirs = rows.filter(row => row.sport === target.sport && playerKey(row.player) === playerKey(target.player));
  const same = theirs.filter(row => !stat || [row.market, row.raw?.stat, row.raw?.propLabel].some(value => value && propStatKey(value) === stat));
  return same.find(row => (row.modifier || 'standard') === 'standard') || same[0] || null;
}

// Where the Finder was left: leagues, filters, sort and page size, brought
// back when it opens again within a day. Game and date filters stay out --
// those games are over by then.
export const FINDER_VIEW_KEY = 'krazy-finder-view';
const VIEW_KEEP = 24 * 60 * 60 * 1000;
const VIEW_LISTS = ['picked', 'marketFilter', 'bookFilter', 'teamFilter', 'modifierFilter'];

export function readFinderView(storage, now = Date.now()) {
  try {
    const view = JSON.parse(storage?.getItem(FINDER_VIEW_KEY) || 'null');
    if (!view || typeof view !== 'object' || !(now - Number(view.at) < VIEW_KEEP)) return {};
    const out = {};
    for (const name of VIEW_LISTS) if (Array.isArray(view[name])) out[name] = view[name].filter(item => typeof item === 'string').slice(0, 40);
    const hit = view.hitFilter;
    if (hit && Array.isArray(hit.windows) && Number.isFinite(hit.min) && Number.isFinite(hit.max)) out.hitFilter = {windows: hit.windows.filter(item => typeof item === 'string'), min: hit.min, max: hit.max};
    if (Array.isArray(view.sorts)) out.sorts = view.sorts.filter(item => item && typeof item.key === 'string' && ['asc', 'desc'].includes(item.direction)).slice(0, 6);
    if ([10, 20, 50, 100].includes(view.pageSize)) out.pageSize = view.pageSize;
    return out;
  } catch { return {}; }
}

export function saveFinderView(storage, view, now = Date.now()) {
  try { storage?.setItem(FINDER_VIEW_KEY, JSON.stringify({...view, at: now})); } catch { /* private mode */ }
}

// Every app's lines show. Choosing a line type (Regular / Goblins / Demons)
// narrows the board to PrizePicks lines of that tier.
export function matchesPrizePicksLine(row,modifiers=[]){
 return !modifiers.length||(row.apps?.some(app=>app.key==='prizepicks')&&modifiers.includes(row.modifier));
}

/**
 * The board line a player's trend panel is showing, for its save star: the
 * panel's market at the panel's line when that line is posted (a Goblin or
 * Demon included), otherwise that market's nearest posted line. NFL and WNBA
 * panels name the market by key; MLB's by its label.
 */
export function trendPickRow(rows, {stat, statKey, line} = {}) {
  const same = (Array.isArray(rows) ? rows : []).filter(row => statKey ? row.marketKey === statKey : row.market === stat);
  if (!same.length) return null;
  const target = Number(line);
  return same.reduce((best, row) => Math.abs(Number(row.line) - target) < Math.abs(Number(best.line) - target) ? row : best);
}

/** Book prices kept on a saved pick: just enough for the Pick Builder. */
export function slipApps(apps) {
  return (Array.isArray(apps) ? apps : []).filter(app => app?.key).map(app => ({key: app.key,
    name: app.name || BOOK_NAMES[app.key] || app.key, over: number(app.over), under: number(app.under)}));
}

export const finderSlipId = row => `finder:${row.id}`;

/**
 * A Finder row as a pick in the site's one saved-picks list (My Slip / Prop
 * Builder, app.js state.savedProps). The side is chosen separately. MLB rows
 * keep PrizePicks' own stat name for the export, which matches legs against
 * the live PrizePicks board (prizepicks_export_core.py).
 */
export function finderSlipProp(row) {
  return {
    id: finderSlipId(row), finderId: row.id, source: 'finder', sport: String(row.sport || '').toUpperCase(),
    player: row.player, playerId: row.playerId || null, position: row.position || '',
    betType: row.market, exportStat: row.sport === 'mlb' ? row.raw?.stat || row.market : row.market,
    line: row.line, side: side(row.direction) === 'UNDER' ? 'Under' : 'Over',
    team: row.teamAbbr || '', teamAbbr: row.teamAbbr || '', teamId: row.teamId || null, teamLogo: row.teamLogo || '',
    opponent: row.opponent || '', startsAt: row.startsAt || '', headshot: row.headshot || '',
    modifier: String(row.modifier || 'standard').toLowerCase(), apps: slipApps(row.apps),
  };
}

function finish(row) {
  const average = number(row.average);
  const line = number(row.line);
  const direction = side(row.direction);
  return {...row, average, line, direction, windows: normalizeWindows(row.windows),
    diff: average == null || line == null ? null : (average - line) * (direction === 'UNDER' ? -1 : 1),
    averageDelta: average == null || line == null ? null : average - line,
    modifier: String(row.modifier || 'standard').toLowerCase(),
    // A PrizePicks promo line (prizepicks_export_core.py _mark_promos): one per entry at most.
    promo: Boolean(row.promo ?? row.raw?.promo),
    streak: number(row.streak), moneyline: number(row.moneyline), defense: number(row.defense),
    apps: applications(row.apps)};
}

/** Normalize verified provider rows; never infer missing prices or game results. */
export function normalizeFinderRows(sport, payload, players = [], {now = Date.now()} = {}) {
  const playerList = Array.isArray(players) ? players : [];
  const byId = new Map(playerList.map(player => [String(player.id), player]));
  const names = new Map();
  for (const player of playerList) {
    const key = nameKey(player.name);
    names.set(key, names.has(key) ? null : player);
  }
  const source = sport === 'mlb' ? payload.props : payload.rows || payload.data;
  const rows = (Array.isArray(source) ? source : []).map(raw => {
    if(sport==='cs2'&&payload.histories?.[nameKey(raw.player)])raw={...raw,history:payload.histories[nameKey(raw.player)]};
    if (BASKETBALL.has(sport)) {
      // WNBA (The Odds API and PrizePicks) and NBA (PrizePicks) rows share
      // one shape (api/wnba.py) and the same ESPN game-log history.
      const opponent = raw.teamAbbr && raw.teamAbbr === raw.homeTeamAbbr ? raw.awayTeamAbbr
        : raw.teamAbbr && raw.teamAbbr === raw.awayTeamAbbr ? raw.homeTeamAbbr : null;
      return finish({...raw, id: `${sport}:${raw.id}`, sport, player: raw.player, playerId: optional(raw.playerId),
        headshot: optional(raw.headshot), position: optional(raw.position), teamAbbr: optional(raw.teamAbbr),
        teamLogo: optional(raw.teamLogo), opponent, startsAt: optional(raw.startsAt), direction: 'OVER',
        modifier: raw.modifier || raw.odds_type || 'standard',
        historyStatus: raw.windows && Object.keys(raw.windows).length ? 'ready' : 'pending', raw});
    }
    if (sport === 'nfl') {
      const player = byId.get(String(raw.playerId));
      const quote = raw.line || {};
      // PrizePicks' own stat name (backend/sports/nfl/prizepicks_board.py),
      // so every market it posts shows and Export matches it exactly.
      const label = raw.propLabel || NFL_LABELS[raw.propType];
      if (!quote.verified || !label) return null;
      const direction = side(quote.direction || raw.direction);
      const key = quote.bookmaker;
      const event = (payload.events || []).find(item => item.gameId === raw.gameId);
      // Every app posting this line (backend/sports/nfl/prizepicks_board.py).
      const apps = Array.isArray(raw.apps) && raw.apps.length ? raw.apps
        : key ? [{key, name: quote.platform || BOOK_NAMES[key] || key,
          over: direction === 'OVER' ? quote.price : null, under: direction === 'UNDER' ? quote.price : null}] : [];
      return finish({id: `nfl:${raw.id || [raw.playerId, raw.gameId, raw.propType, key, quote.category, quote.value, direction].join(':')}`,
        sport, player: raw.playerName || player?.name, playerId: optional(raw.playerId), headshot: optional(player?.headshot_url || raw.headshot),
        position: optional(raw.position || player?.position), teamAbbr: optional(raw.teamId || player?.team_id),
        teamLogo: optional(teamLogoUrl(raw.teamId || player?.team_id)), opponent: optional(raw.opponentId),
        awayTeamAbbr: event?.awayTeamId || null, homeTeamAbbr: event?.homeTeamId || null,
        startsAt: optional(raw.startsAt), market: label, marketKey: raw.propType,
        line: quote.value, direction, modifier: quote.category,
        apps,
        // The NFL row.average is L20; only the explicit L10 average belongs in Avg L10.
        average: raw.windows?.l10?.average, windows: raw.windows, streak: raw.streak, gameLog: gameLog(raw.gameLog),
        defense: raw.matchupContext?.positionDefense?.rank, raw, playerObject: player || null});
    }
    if (sport === 'mlb') {
      const definition = finderMarket(raw.stat);
      if (!definition) return null;
      const player = names.get(nameKey(raw.player));
      const playerId = player?.id || raw.playerId || null;
      return finish({id: `mlb:${raw.id || [nameKey(raw.player), nameKey(raw.stat), raw.line, raw.odds_type].join(':')}`,
        sport, player: raw.player, playerId, headshot: photo(playerId) || optional(raw.headshot),
        position: definition.pitcher ? 'P' : optional(raw.position || player?.position),
        teamId: optional(player?.team_id || raw.teamId), teamAbbr: optional(raw.team), teamLogo: mlbLogo(player?.team_id), opponent: optional(raw.opponent),
        startsAt: optional(raw.start_time), market: definition.label, marketKey: `${definition.pitcher ? 'pitching' : 'hitting'}:${definition.key}`,
        line: raw.line, direction: 'OVER', modifier: raw.odds_type,
        // PrizePicks plus every book pricing the same number (mlb_book_lines.py).
        apps: Array.isArray(raw.apps) && raw.apps.length ? raw.apps : [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}],
        average: null, windows: null, raw, historyStatus: 'pending'});
    }
    if (sport === 'soccer') {
      // PrizePicks' soccer lines as posted (soccer_board.py). There is no
      // match history behind them yet, so the hit-rate cells stay blank.
      // Pinned to its ESPN match (soccer_research.py), the row can load its
      // team's recent matches for the hit rates.
      const matched = Boolean(raw.eventId && raw.teamId && statKeyOf(raw.marketKey));
      return finish({id: `soccer:${raw.id}`, sport, player: raw.player, playerId: null, headshot: optional(raw.headshot),
        position: optional(raw.position), teamAbbr: optional(raw.team), teamLogo: optional(raw.teamLogo), teamName: optional(raw.teamName),
        opponent: optional(raw.opponent), opponentLogo: optional(raw.opponentLogo), opponentName: optional(raw.opponentName),
        homeTeamAbbr: optional(raw.homeTeamAbbr), awayTeamAbbr: optional(raw.awayTeamAbbr), isHome: raw.isHome ?? null,
        eventId: optional(raw.eventId), competition: optional(raw.competition), competitionName: optional(raw.competitionName),
        teamId: optional(raw.teamId), opponentId: optional(raw.opponentId), winChance: number(raw.winChance), drawChance: number(raw.drawChance),
        startsAt: optional(raw.startsAt), market: raw.stat, marketKey: raw.marketKey, line: raw.line, direction: 'OVER',
        modifier: raw.modifier, apps: Array.isArray(raw.apps) && raw.apps.length ? raw.apps : [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}],
        average: null, windows: null, raw, historyStatus: matched ? 'pending' : 'none'});
    }
    if (sport === 'nhl') {
      // PrizePicks' NHL lines (nhl_board.py), pinned to the game and the
      // player's NHL id; the hit rates fill in from his team's recent games.
      const ready = Boolean(raw.playerId && raw.valueKey && raw.team);
      return finish({id: `nhl:${raw.id}`, sport, player: raw.player, playerId: optional(raw.playerId), headshot: optional(raw.headshot),
        position: optional(raw.position), teamAbbr: optional(raw.team), teamLogo: optional(raw.teamLogo), teamName: optional(raw.teamName),
        opponent: optional(raw.opponent), opponentLogo: optional(raw.opponentLogo), opponentName: optional(raw.opponentName),
        homeTeamAbbr: optional(raw.homeTeamAbbr), awayTeamAbbr: optional(raw.awayTeamAbbr), isHome: raw.isHome ?? null,
        gameId: optional(raw.gameId), gameKind: optional(raw.gameKind), startsAt: optional(raw.startsAt), market: raw.stat,
        marketKey: raw.marketKey, valueKey: optional(raw.valueKey), line: raw.line, direction: 'OVER', modifier: raw.modifier,
        apps: Array.isArray(raw.apps) && raw.apps.length ? raw.apps : [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}],
        average: null, windows: null, raw, historyStatus: ready ? 'pending' : 'none'});
    }
    if (sport === 'cfb') {
      // PrizePicks' college football lines (cfb_board.py), pinned to the
      // ESPN game and player; the hit rates fill in from his team's games.
      const ready = Boolean(raw.playerId && raw.valueKey && raw.teamId);
      return finish({id: `cfb:${raw.id}`, sport, player: raw.player, playerId: optional(raw.playerId), headshot: optional(raw.headshot),
        position: optional(raw.position), teamAbbr: optional(raw.team), teamId: optional(raw.teamId), teamLogo: optional(raw.teamLogo),
        teamName: optional(raw.teamName), opponent: optional(raw.opponent), opponentId: optional(raw.opponentId),
        opponentLogo: optional(raw.opponentLogo), opponentName: optional(raw.opponentName),
        homeTeamAbbr: optional(raw.homeTeamAbbr), awayTeamAbbr: optional(raw.awayTeamAbbr), isHome: raw.isHome ?? null,
        gameId: optional(raw.gameId), startsAt: optional(raw.startsAt), market: raw.stat, marketKey: raw.marketKey,
        valueKey: optional(raw.valueKey), line: raw.line, direction: 'OVER', modifier: raw.modifier,
        apps: Array.isArray(raw.apps) && raw.apps.length ? raw.apps : [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}],
        average: null, windows: null, raw, historyStatus: ready ? 'pending' : 'none'});
    }
    if (sport === 'tennis' || sport === 'cs2') {
      const row = finish({id: `${sport}:${raw.id}`, sport, player: raw.player, playerId: optional(raw.playerId),
        headshot: optional(raw.headshot), position: optional(raw.position), teamAbbr: optional(raw.teamAbbr), teamLogo: null,
        opponent: optional(raw.opponent), startsAt: optional(raw.startsAt), market: raw.stat,
        marketKey: raw.marketKey || String(raw.stat || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
        line: raw.line, direction: 'OVER', modifier: raw.modifier,
        apps: Array.isArray(raw.apps) && raw.apps.length ? raw.apps : [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}],
        average: null, windows: null, raw, historyStatus: sport==='cs2'?'none':'pending'});
      return sport==='cs2'&&raw.history ? applyCs2History(row,raw.history) : row;
    }
    return null;
  });
  return rows.filter(row => row && row.player && row.line != null &&
    (!row.startsAt || !Number.isFinite(Date.parse(row.startsAt)) || Date.parse(row.startsAt) > now));
}

/** Read existing sport feeds. NFL uses its saved board, never a browser-driven odds scan. */
export async function loadFinderSportRaw(sport, options = {}) {
  if (sport === 'wnba') {
    const payload = await request(options.fast ? '/api/wnba?fast=1' : '/api/wnba', options);
    return {...payload, rows: normalizeFinderRows(sport, payload), fetchedAt: payload.fetchedAt || null};
  }
  if (sport === 'nba') {
    // Every line PrizePicks posts; each player's history fills in afterwards.
    const payload = await request('/api/wnba?league=nba&fast=1', options);
    return {...payload, rows: normalizeFinderRows(sport, payload), fetchedAt: payload.fetchedAt || null};
  }
  if (sport === 'mlb') {
    const [board, roster] = await Promise.allSettled([
      request('/api/board?view=props&apps=1', options), request('/api/players?catalog=1', options),
    ]);
    aborted(options.signal);
    if (board.status === 'rejected') throw board.reason;
    return {...board.value, rows: normalizeFinderRows(sport, board.value, roster.status === 'fulfilled' ? roster.value.players : []),
      fetchedAt: board.value.fetchedAt || null};
  }
  if (sport === 'nfl') {
    const today = new Date();
    const season = options.season || today.getUTCFullYear() - (today.getUTCMonth() < 2 ? 1 : 0);
    const [board, roster] = await Promise.allSettled([
      request(`/api/nfl?resource=finder-board&season=${season}`, options),
      request(`/api/nfl?resource=players&season=${season}`, options),
    ]);
    aborted(options.signal);
    if (board.status === 'rejected') throw board.reason;
    return {...board.value, rows: normalizeFinderRows(sport, board.value, roster.status === 'fulfilled' ? roster.value.data : []),
      fetchedAt: board.value.builtAt || board.value.fetchedAt || null};
  }
  if (sport === 'soccer') {
    const payload = await request('/api/board?view=soccer', options);
    return {...payload, rows: normalizeFinderRows(sport, payload), fetchedAt: payload.builtAt || null};
  }
  if (sport === 'nhl') {
    const payload = await request('/api/board?view=nhl', options);
    return {...payload, rows: normalizeFinderRows(sport, payload), fetchedAt: payload.builtAt || null};
  }
  if (sport === 'cfb') {
    const payload = await request('/api/board?view=cfb', options);
    return {...payload, rows: normalizeFinderRows(sport, payload), fetchedAt: payload.builtAt || null};
  }
  if (sport === 'tennis' || sport === 'cs2') {
    const payload = await request(`/api/board?view=${sport}`, options);
    return {...payload, rows: normalizeFinderRows(sport, payload), fetchedAt: payload.builtAt || null};
  }
  throw new Error('This sport is not supported by Finder.');
}

export function finderHistoryKey(row, season=new Date().getUTCFullYear()) {
  if(BASKETBALL.has(row.sport))return `${wnbaHistoryKey(row)}:${row.sport==='nba'?'recent':season}`;
  if(row.sport==='mlb')return mlbHistoryKey(row);
  if(row.sport==='soccer')return `soccer:${soccerLogKey(row)}`;
  if(row.sport==='nhl')return `nhl:${nhlLogKey(row.teamAbbr,row.opponent)}`;
  if(row.sport==='cfb')return `cfb:${row.teamId||''}:`;
  if(row.sport==='tennis')return `tennis:${row.player}`;
  return null;
}

// Current prices still come from the existing line source. One shared raw
// history sample serves all that player's lines, including moved/new lines.
export function applyFinderSnapshot(rows, histories={}, now=Date.now()) {
  return rows.map(row=>{
    const key=finderHistoryKey(row),entry=histories[key];
    if(!entry?.payload||!Number.isFinite(entry.at)||now-entry.at<0||now-entry.at>24*60*60*1000)return row;
    const apply=BASKETBALL.has(row.sport)?applyWnbaHistory:({mlb:applyMlbHistory,soccer:applySoccerHistory,nhl:applyNhlHistory,cfb:applyCfbHistory,tennis:applyTennisHistory})[row.sport];
    if(!apply)return row;
    const result=apply(row,entry.payload);
    if(result.historyStatus!=='ready')return row;
    historyCache.set(key,{at:entry.at,value:entry.payload});
    return {...result,enrichedAt:entry.at,historyAsOf:entry.at,historyRefresh:now-entry.at>=HISTORY_TTL};
  });
}

// Leagues whose hit rates the server keeps (finder_history_store.py). NFL
// boards come with theirs; CS2 history remains unavailable, not fabricated.
export const hasFinderSnapshot = sport => sport !== 'nfl' && sport !== 'cs2';

/** Every player's saved history for a league ({key: {at, payload}}), or {} when there is none to be had. */
export function loadFinderSnapshot(sport, options = {}) {
  return request(`/api/board?view=finder-history&sport=${encodeURIComponent(sport)}`, options)
    .then(snapshot => snapshot?.histories || {})
    .catch(error => { if (error.name === 'AbortError') throw error; return {}; });
}

/** A promise's value if it settles within `ms`, else `fallback`. */
export function within(promise, ms, fallback = null) {
  let timer;
  return Promise.race([promise, new Promise(resolve => { timer = setTimeout(() => resolve(fallback), ms); })]).finally(() => clearTimeout(timer));
}

export async function loadFinderSport(sport, options={}) {
  if(!hasFinderSnapshot(sport))return loadFinderSportRaw(sport,options);
  const saved=within(loadFinderSnapshot(sport,options),1500,{});
  const [board,histories]=await Promise.all([loadFinderSportRaw(sport,options),saved]);
  return {...board,rows:applyFinderSnapshot(board.rows,histories)};
}

const wnbaHistoryKey = row => `${row.sport === 'nba' ? 'nba' : 'wnba'}:${row.playerId || ''}`;
/** A player's ESPN game logs: the WNBA season, or the NBA's last two. */
export function basketballLogUrl(row, season = new Date().getUTCFullYear()) {
  const id = encodeURIComponent(String(row.playerId || ''));
  return row.sport === 'nba' ? `/api/wnba?league=nba&resource=gamelog&playerId=${id}`
    : `/api/wnba?resource=gamelog&playerId=${id}&season=${season}`;
}

const basketballCacheKey = (row, season) => `${wnbaHistoryKey(row)}:${row.sport === 'nba' ? 'recent' : season}`;
function keepHistory(key, payload) {
  historyCache.set(key, {at: Date.now(), value: payload});
  if (historyCache.size > 500) historyCache.delete(historyCache.keys().next().value);
}
function savedHistory(key) {
  const cached = historyCache.get(key);
  return cached && Date.now() - cached.at < HISTORY_TTL ? cached.value : null;
}

export async function loadWnbaHistory(row, options = {}) {
  aborted(options.signal);
  if (!row.playerId) throw new Error('Player identity unavailable.');
  const season = options.season || new Date().getUTCFullYear();
  const key = basketballCacheKey(row, season);
  const cached = savedHistory(key);
  if (cached) return cached;
  const payload = await request(basketballLogUrl(row, season), options);
  keepHistory(key, payload);
  return payload;
}

// Up to this many players' logs come back from one request (api/wnba.py
// resource=gamelogs), so a league's histories take a few dozen round trips
// instead of one per player.
export const GAMELOG_BATCH = 8;
export function basketballLogsUrl(rows, season = new Date().getUTCFullYear()) {
  const ids = rows.map(row => encodeURIComponent(String(row.playerId))).join(',');
  return `/api/wnba?${rows[0]?.sport === 'nba' ? 'league=nba&' : ''}resource=gamelogs&playerIds=${ids}&season=${season}`;
}

/** Several players' logs at once, each a payload or an Error; one player alone uses the single request. */
async function loadWnbaHistories(rows, options = {}) {
  aborted(options.signal);
  const season = options.season || new Date().getUTCFullYear();
  const result = new Map(), asking = [];
  for (const row of rows) {
    const cached = savedHistory(basketballCacheKey(row, season));
    if (cached) result.set(row.playerId, cached); else asking.push(row);
  }
  const one = row => loadWnbaHistory(row, options).then(payload => result.set(row.playerId, payload),
    error => { if (options.signal?.aborted || error.name === 'AbortError') throw error; result.set(row.playerId, error); });
  if (asking.length === 1) await one(asking[0]);
  else if (asking.length) {
    let histories;
    try { histories = (await request(basketballLogsUrl(asking, season), options))?.histories; }
    catch (error) { if (options.signal?.aborted || error.name === 'AbortError') throw error; }
    // Without the batch answer, each player is asked for on their own.
    if (!histories || typeof histories !== 'object') await Promise.all(asking.map(one));
    else for (const row of asking) {
      const payload = histories[row.playerId];
      if (!payload || payload.error) result.set(row.playerId, new Error(payload?.error || 'Game log unavailable.'));
      else { keepHistory(basketballCacheKey(row, season), payload); result.set(row.playerId, payload); }
    }
  }
  return result;
}

// A player's games in date order, sorted once per history and shared by all
// his lines (ISO dates sort as plain strings).
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || (String(a.gameId ?? '') < String(b.gameId ?? '') ? -1 : String(a.gameId ?? '') > String(b.gameId ?? '') ? 1 : 0);
const datedLogs = new WeakMap();
function inDateOrder(payload, list) {
  if (!payload || typeof payload !== 'object') return [];
  let sorted = datedLogs.get(payload);
  if (!sorted) { sorted = (list || []).filter(item => item?.date).map(item => ({...item, date: String(item.date)})).sort(byDate); datedLogs.set(payload, sorted); }
  return sorted;
}

// Each stat's games and values, worked out once per history and shared by
// that player's lines on the stat (goblin, standard, demon).
const statSeries = new WeakMap();
function seriesFor(payload, marketKey) {
  let byStat = statSeries.get(payload);
  if (!byStat) { byStat = new Map(); statSeries.set(payload, byStat); }
  let series = byStat.get(marketKey);
  if (!series) {
    // Preseason games stay on the chart but never in the hit rates: starters
    // play short minutes, so those games would make every Under look safe.
    const logs = inDateOrder(payload, payload?.rows).filter(log => log?.seasonKind !== 'preseason' && number(log?.values?.[marketKey]) != null);
    series = {logs, values: logs.map(log => number(log.values[marketKey]))};
    byStat.set(marketKey, series);
  }
  return series;
}

export function applyWnbaHistory(row, payload) {
  const {logs, values} = payload && typeof payload === 'object' ? seriesFor(payload, row.marketKey) : {logs: [], values: []};
  const h2hValues = logs.filter(log => !row.opponent || log.opponent === row.opponent)
    .map(log => number(log.values[row.marketKey])).filter(value => value != null);
  const windows = Object.fromEntries([5, 10, 15, 20].map(size => [`l${size}`, finderWindow(values.slice(-size), row.line, row.direction)]));
  windows.h2h = finderWindow(h2hValues, row.line, row.direction);
  windows.season = finderWindow(values, row.line, row.direction);
  let streak = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] === row.line) break;
    const sign = values[index] > row.line ? 1 : -1;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  return finish({...row, average: mean(values.slice(-10)), windows, streak: values.length ? streak : null,
    gameLog: gameLog(logs.map(log => ({value: log.values[row.marketKey], date: log.date, home: log.isHome, opponent: log.opponent, usage: log.minutes}))),
    historyStatus: 'ready', historyRefresh:false, historyAsOf:Date.now(), enrichedAt:Date.now(), history: payload});
}

/** Hydrate WNBA history after the market rows are already visible. */
export async function enrichWnbaRows(rows, {signal, onRows, concurrency = 6, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (!BASKETBALL.has(row.sport) || row.historyStatus === 'ready' && !row.historyRefresh || !row.playerId) continue;
    const key = wnbaHistoryKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  // Players in the order given (the caller puts what's on screen first),
  // asked for a few at a time; each request is one league's.
  const players = [...groups.values()];
  const workers = Math.max(1, Math.min(8, concurrency));
  const size = Math.max(1, Math.min(GAMELOG_BATCH, Math.ceil(players.length / workers)));
  const queue = [];
  for (const sport of new Set(players.map(group => group[0].sport))) {
    const mine = players.filter(group => group[0].sport === sport);
    for (let index = 0; index < mine.length; index += size) queue.push(mine.slice(index, index + size));
  }
  const enriched = new Map();
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      aborted(signal);
      const chunk = queue[next++];
      const histories = await loadWnbaHistories(chunk.map(group => group[0]), {signal, ...options});
      aborted(signal);
      const updates = [];
      for (const group of chunk) {
        const payload = histories.get(group[0].playerId);
        for (const row of group) {
          const update = payload && !(payload instanceof Error) ? applyWnbaHistory(row, payload) : {...row, historyStatus: 'unavailable'};
          updates.push(row.historyStatus === 'ready' && update.historyStatus !== 'ready' ? {...row, historyRefresh: true} : update);
        }
      }
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, workers)}, worker));
  return rows.map(row => enriched.get(row.id) || row);
}

const mlbHistoryKey = row => {
  const market = finderMarket(row.raw?.stat || row.stat);
  // First-inning markets need each start's inning data (a heavier request).
  return `${nameKey(row.player)}|${market?.pitcher ? 'pitching' : 'hitting'}${market?.firstInning ? '|innings' : ''}`;
};
const mlbHistoryPending = new Map();

/** Shared by progressive table enrichment and the inline Trends view. */
export async function loadMlbHistory(row, options = {}) {
  aborted(options.signal);
  const key = mlbHistoryKey(row);
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.value;
  const group = key.split('|')[1];
  // The supporting chart and game log mount together. Share their transport,
  // but keep abortable board requests independent of component lifetimes.
  const url = `/api/board?view=prop-history&player=${encodeURIComponent(row.player)}&group=${group}${key.endsWith('|innings') ? '&innings=1' : ''}`;
  let task = !options.signal && mlbHistoryPending.get(key);
  if (!task) {
    task = request(url, options);
    if (!options.signal) {
      task = task.finally(() => mlbHistoryPending.delete(key));
      mlbHistoryPending.set(key, task);
    }
  }
  const payload = await task;
  historyCache.set(key, {at: Date.now(), value: payload});
  if (historyCache.size > 500) historyCache.delete(historyCache.keys().next().value);
  return payload;
}

function strictMlbValue(stat, definition) {
  const outs = stat.outs == null ? 'inningsPitched' : 'outs';
  const requirements = definition.field === 'hrr' ? ['hits', 'runs', 'rbi']
    : definition.field === 'fantasy' ? ['hits', 'doubles', 'triples', 'homeRuns', 'runs', 'rbi', 'baseOnBalls', 'hitByPitch', 'stolenBases']
    : definition.field === 'totalBases' && stat.totalBases == null ? ['hits', 'doubles', 'triples', 'homeRuns']
    : definition.field === 'singles' ? ['hits', 'doubles', 'triples', 'homeRuns']
    : definition.field === 'numberOfPitches' ? [stat.numberOfPitches == null ? 'pitchesThrown' : 'numberOfPitches']
    : definition.field === 'pitcherFantasy' ? ['strikeOuts', 'earnedRuns', outs]
    : definition.field === 'outs' && stat.outs == null ? ['inningsPitched'] : [definition.field];
  if (requirements.some(key => number(stat[key]) == null)) return null;
  return number(gameValue(stat, definition));
}

export function applyMlbHistory(row, payload) {
  const definition = finderMarket(row.raw?.stat || row.stat);
  if (!definition) return row;
  const validGames = inDateOrder(payload, payload.games).filter(game => strictMlbValue(game.stat || {}, definition) != null);
  const chart = historyChart({...payload, games: validGames}, {...row.raw, stat: row.raw?.stat || row.stat,
    line: row.line, teamId: payload.matchup?.opponent?.id});
  const values = chart.all.map(game => game.value);
  const windows = Object.fromEntries([5, 10, 15, 20].map(size => [`l${size}`, finderWindow(values.slice(-size), row.line, row.direction)]));
  windows.h2h = finderWindow(chart.h2h.map(game => game.value), row.line, row.direction);
  windows.season = payload.season == null ? null : finderWindow(chart.all.filter(game => String(game.season) === String(payload.season)).map(game => game.value), row.line, row.direction);
  let streak = 0;
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index] === row.line) break;
    const hit = side(row.direction) === 'UNDER' ? values[index] < row.line : values[index] > row.line;
    const sign = hit ? 1 : -1;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  return finish({...row, playerId: payload.player?.id || row.playerId,
    headshot: photo(payload.player?.id) || row.headshot, teamLogo: mlbLogo(payload.player?.team_id) || row.teamLogo,
    position: row.position || optional(payload.player?.position),
    opponent: optional(payload.matchup?.opponent?.abbreviation || payload.matchup?.opponent?.name),
    opponentTeamId: payload.matchup?.opponent?.id || null,
    startsAt: row.startsAt || optional(payload.matchup?.startTime),
    isHome: typeof payload.matchup?.isHome === 'boolean' ? payload.matchup.isHome : row.isHome ?? null,
    average: mean(values.slice(-10)), windows, streak: values.length ? streak : null,
    gameLog: gameLog(validGames.map(game => ({value: strictMlbValue(game.stat || {}, definition), date: game.date, home: game.isHome,
      opponent: game.opponent?.id ?? null,
      usage: definition.pitcher ? game.stat?.numberOfPitches ?? game.stat?.pitchesThrown : game.stat?.plateAppearances}))),
    historyStatus: 'ready', historyRefresh:false, historyAsOf:Date.now(), enrichedAt:Date.now(), history: payload, chart});
}

/** Emits one batch per player/group so rows become useful before the full slate finishes. */
export async function enrichMlbRows(rows, {signal, onRows, concurrency = 4, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'mlb' || row.historyStatus === 'ready' && !row.historyRefresh) continue;
    const key = mlbHistoryKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const queue = [...groups.values()];
  const enriched = new Map();
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      aborted(signal);
      const batch = queue[next++];
      let updates;
      try {
        const payload = await loadMlbHistory(batch[0], {signal, ...options});
        aborted(signal);
        updates = batch.map(row => applyMlbHistory(row, payload));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        updates = batch.map(row => ({...row, historyStatus: 'unavailable'}));
      }
      updates=updates.map((update,i)=>batch[i].historyStatus==='ready'&&update.historyStatus!=='ready'?{...batch[i],historyRefresh:true}:update);
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, Math.min(8, concurrency)))}, worker));
  return rows.map(row => enriched.get(row.id) || row);
}

// ---------------------------------------------------------------- soccer

// One request per team and match: the team's recent matches carry every
// player's line (soccer_research.team_log), so the whole squad's rows fill
// from it.
const soccerLogKey = row => `${row.competition || ''}:${row.eventId}:${row.teamId}`;
export async function loadSoccerLog(row, options = {}) {
  const key = soccerLogKey(row);
  const cached = historyCache.get(`soccer:${key}`);
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.value;
  const query = new URLSearchParams({view: 'soccer', resource: 'log', event: row.eventId, team: row.teamId});
  if (row.competition) query.set('league', row.competition);
  const payload = await request(`/api/board?${query}`, options);
  historyCache.set(`soccer:${key}`, {at: Date.now(), value: payload});
  if (historyCache.size > 500) historyCache.delete(historyCache.keys().next().value);
  return payload;
}

export function applySoccerHistory(row, log) {
  const stat = statKeyOf(row.marketKey);
  const games = playerGames(log, row.player).filter(game => number(valueOf(game, stat)) != null);
  if (!stat || !games.length) return {...row, historyStatus: 'unavailable'};
  const values = games.map(game => valueOf(game, stat));
  const season = games.at(-1).season;
  const windows = Object.fromEntries([5, 10, 15, 20].map(size => [`l${size}`, finderWindow(values.slice(-size), row.line, row.direction)]));
  windows.h2h = finderWindow(games.filter(game => row.opponent && game.opponent === row.opponent).map(game => valueOf(game, stat)), row.line, row.direction);
  windows.season = finderWindow(games.filter(game => game.season === season).map(game => valueOf(game, stat)), row.line, row.direction);
  let streak = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] === row.line) break;
    const sign = values[index] > row.line ? 1 : -1;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  return finish({...row, average: mean(values.slice(-10)), windows, streak, historyStatus: 'ready', historyRefresh:false, historyAsOf:Date.now(), enrichedAt:Date.now(),
    gameLog: gameLog(games.map(game => ({value: valueOf(game, stat), date: game.date, home: game.isHome, opponent: game.opponent, usage: game.min})))});
}

/** Hydrate soccer hit rates after the lines are already on the board. */
export async function enrichSoccerRows(rows, {signal, onRows, concurrency = 4, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'soccer' || row.historyStatus !== 'pending' && !row.historyRefresh) continue;
    const key = soccerLogKey(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const queue = [...groups.values()];
  const enriched = new Map();
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      aborted(signal);
      const batch = queue[next++];
      let updates;
      try {
        const log = await loadSoccerLog(batch[0], {signal, ...options});
        aborted(signal);
        updates = batch.map(row => applySoccerHistory(row, log));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        updates = batch.map(row => ({...row, historyStatus: 'unavailable'}));
      }
      updates=updates.map((update,i)=>batch[i].historyStatus==='ready'&&update.historyStatus!=='ready'?{...batch[i],historyRefresh:true}:update);
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, Math.min(6, concurrency)))}, worker));
  return rows.map(row => enriched.get(row.id) || row);
}

// ---------------------------------------------------------------- NHL

// One request per team and opponent: the team's recent games carry every
// player's line (nhl_research.team_log), so the whole roster's rows fill
// from it.
const nhlLogKey = (team, opponent) => `${team || ''}:${opponent || ''}`;
export async function loadNhlLog(team, opponent, options = {}) {
  const key = nhlLogKey(team, opponent);
  const cached = historyCache.get(`nhl:${key}`);
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.value;
  const query = new URLSearchParams({view: 'nhl', resource: 'log', team});
  if (opponent) query.set('opponent', opponent);
  const payload = await patientRequest(`/api/board?${query}`, options);
  // A log still being gathered is not kept, so the next look asks again.
  if (payload?.complete !== false) historyCache.set(`nhl:${key}`, {at: Date.now(), value: payload});
  if (historyCache.size > 500) historyCache.delete(historyCache.keys().next().value);
  return payload;
}

export function applyNhlHistory(row, log) {
  const games = nhlPlayerGames(log, row.playerId).filter(game => !game.dnp && number(nhlValue(game, row.valueKey)) != null);
  if (!row.valueKey || !games.length) return {...row, historyStatus: 'unavailable'};
  const values = games.map(game => nhlValue(game, row.valueKey));
  const season = games.at(-1).season;
  const windows = Object.fromEntries([5, 10, 15, 20].map(size => [`l${size}`, finderWindow(values.slice(-size), row.line, row.direction)]));
  windows.h2h = finderWindow(games.filter(game => row.opponent && game.opponent === row.opponent).map(game => nhlValue(game, row.valueKey)), row.line, row.direction);
  windows.season = finderWindow(games.filter(game => game.season === season).map(game => nhlValue(game, row.valueKey)), row.line, row.direction);
  let streak = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] === row.line) break;
    const sign = values[index] > row.line ? 1 : -1;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  return finish({...row, average: mean(values.slice(-10)), windows, streak, historyStatus: 'ready', historyRefresh:false, historyAsOf:Date.now(), enrichedAt:Date.now(),
    gameLog: gameLog(games.map(game => ({value: nhlValue(game, row.valueKey), date: game.date, home: game.isHome, opponent: game.opponent,
      usage: game.values?.toi})))});
}

/** Hydrate NHL hit rates after the lines are already on the board. */
export async function enrichNhlRows(rows, {signal, onRows, concurrency = 4, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'nhl' || row.historyStatus !== 'pending' && !row.historyRefresh) continue;
    const key = nhlLogKey(row.teamAbbr, row.opponent);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const queue = [...groups.values()];
  const enriched = new Map();
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      aborted(signal);
      const batch = queue[next++];
      let updates;
      try {
        const log = await loadNhlLog(batch[0].teamAbbr, batch[0].opponent, {signal, ...options});
        aborted(signal);
        updates = batch.map(row => applyNhlHistory(row, log));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        updates = batch.map(row => ({...row, historyStatus: 'unavailable'}));
      }
      updates=updates.map((update,i)=>batch[i].historyStatus==='ready'&&update.historyStatus!=='ready'?{...batch[i],historyRefresh:true}:update);
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, Math.min(6, concurrency)))}, worker));
  return rows.map(row => enriched.get(row.id) || row);
}

// ---------------------------------------------------------------- college football

// One request per team: its games this season and last carry every
// player's line (cfb_research.team_log), so the whole roster's rows fill
// from it, and what it gave up in each game rates its defense.
export async function loadCfbLog(team, options = {}) {
  const key = `cfb:${team}:`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.value;
  const payload = await patientRequest(`/api/board?${new URLSearchParams({view: 'cfb', resource: 'log', team})}`, options);
  // A log still being gathered is not kept, so the next look asks again.
  if (payload?.complete !== false) historyCache.set(key, {at: Date.now(), value: payload});
  if (historyCache.size > 500) historyCache.delete(historyCache.keys().next().value);
  return payload;
}

export function applyCfbHistory(row, log) {
  const games = cfbPlayerGames(log, row.playerId).filter(game => !game.dnp && number(cfbValue(game, row.valueKey)) != null);
  if (!row.valueKey || !games.length) return {...row, historyStatus: 'unavailable'};
  const values = games.map(game => cfbValue(game, row.valueKey));
  const season = games.at(-1).season;
  const windows = Object.fromEntries([5, 10, 15, 20].map(size => [`l${size}`, finderWindow(values.slice(-size), row.line, row.direction)]));
  const faced = game => row.opponentId ? String(game.opponentId) === String(row.opponentId) : row.opponent && game.opponent === row.opponent;
  windows.h2h = finderWindow(games.filter(faced).map(game => cfbValue(game, row.valueKey)), row.line, row.direction);
  windows.season = finderWindow(games.filter(game => game.season === season).map(game => cfbValue(game, row.valueKey)), row.line, row.direction);
  let streak = 0;
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (values[index] === row.line) break;
    const sign = values[index] > row.line ? 1 : -1;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  const position = row.position || log?.players?.[row.playerId]?.pos || null;
  return finish({...row, position, average: mean(values.slice(-10)), windows, streak, historyStatus: 'ready', historyRefresh: false,
    historyAsOf: Date.now(), enrichedAt: Date.now(),
    gameLog: gameLog(games.map(game => ({value: cfbValue(game, row.valueKey), date: game.date, home: game.isHome, opponent: game.opponent})))});
}

/** Each college football line's defense table: how much each team on the
 * board gives up of what the stat feeds on, from the teams' own logs. */
export function withCfbDefense(rows, logs) {
  const allowed = cfbAllowed(logs);
  const tables = new Map();
  return rows.map(row => {
    if (row.sport !== 'cfb' || !row.valueKey) return row;
    if (!tables.has(row.valueKey)) tables.set(row.valueKey, cfbAllowTable(allowed, row.valueKey));
    const table = tables.get(row.valueKey);
    return table ? {...row, allowTable: table} : row;
  });
}

/** Hydrate college football hit rates after the lines are already on the board. */
export async function enrichCfbRows(rows, {signal, onRows, concurrency = 4, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'cfb' || !row.teamId || row.historyStatus !== 'pending' && !row.historyRefresh) continue;
    if (!groups.has(row.teamId)) groups.set(row.teamId, []);
    groups.get(row.teamId).push(row);
  }
  const queue = [...groups.values()];
  const enriched = new Map(), logs = [];
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      aborted(signal);
      const batch = queue[next++];
      let updates;
      try {
        const log = await loadCfbLog(batch[0].teamId, {signal, ...options});
        aborted(signal);
        logs.push(log);
        updates = batch.map(row => applyCfbHistory(row, log));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        updates = batch.map(row => ({...row, historyStatus: 'unavailable'}));
      }
      updates=updates.map((update,i)=>batch[i].historyStatus==='ready'&&update.historyStatus!=='ready'?{...batch[i],historyRefresh:true}:update);
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, Math.min(6, concurrency)))}, worker));
  // Every team's log is in: each line gets its defense table.
  const out = withCfbDefense(rows.map(row => enriched.get(row.id) || row), logs);
  if (logs.length) onRows?.(out.filter(row => enriched.has(row.id)));
  return out;
}

export async function loadTennisHistory(player, options = {}) {
  const key = `tennis:${player}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.value;
  const payload = await patientRequest(`/api/board?view=tennis&resource=history&player=${encodeURIComponent(player)}`, options);
  historyCache.set(key, {at: Date.now(), value: payload});
  return payload;
}

// Lines refresh independently of history; a research fallback is not an offer.
export async function loadTennisLines(row,options={}) {
  const payload=await patientRequest('/api/board?view=tennis',options);
  return finderPlayerRows(normalizeFinderRows('tennis',payload),row);
}

export async function loadTennisContext(row, options={}) {
  const key=`tennis-context:${row.player}:${row.opponent}:${row.startsAt}`;
  const cached=historyCache.get(key);
  if(cached&&Date.now()-cached.at<HISTORY_TTL)return cached.value;
  const query=new URLSearchParams({view:'tennis',resource:'context',player:row.player,opponent:row.opponent||'',startsAt:row.startsAt||''});
  const payload=await patientRequest(`/api/board?${query}`,options);
  historyCache.set(key,{at:Date.now(),value:payload});
  return payload;
}

export function tennisOpponentMatches(actual, expected) {
  const clean = String(expected || '').replace(/\s+1st Set.*$/i, '').trim();
  const parts = clean.split(/\s+/);
  if (!clean) return false;
  const names = [clean];
  if (parts.length > 1) names.push(parts.slice(1).join(' ')+' '+parts[0][0],parts.at(-1)+' '+parts[0][0]);
  return names.some(name => nameKey(name) === nameKey(actual));
}

export function applyTennisHistory(row, log) {
  const key = row.marketKey;
  const games = (log.games || []).filter(game => number(game.values?.[key]) != null);
  if (!games.length) return {...row, historyStatus: 'unavailable'};
  const values = games.map(game => game.values[key]);
  const windows = Object.fromEntries([5,10,15,20].map(size => [`l${size}`, finderWindow(values.slice(-size), row.line, row.direction)]));
  const opponent = String(row.opponent || '').replace(/\s+1st Set.*$/i, '');
  windows.h2h = finderWindow(games.filter(game => tennisOpponentMatches(game.opponent, opponent)).map(game => game.values[key]), row.line, row.direction);
  windows.season = finderWindow(games.filter(game => String(game.season) === String(new Date().getUTCFullYear())).map(game => game.values[key]), row.line, row.direction);
  let streak = 0;
  for (let i = values.length-1; i >= 0; i--) {
    if (values[i] === row.line) break;
    const sign = values[i] > row.line ? 1 : -1;
    if (streak && Math.sign(streak) !== sign) break;
    streak += sign;
  }
  return finish({...row, average: mean(values.slice(-10)), windows, streak, historyStatus: 'ready', historyRefresh:false, historyAsOf:Date.now(), enrichedAt:Date.now(),
    gameLog: gameLog(games.map(game => ({value: game.values[key], date: game.date, opponent: game.opponent}))), history: log});
}

export function applyCs2History(row, log) {
  const cutoff=Date.parse(row.startsAt)||Date.now();
  const games=(log.games||[]).filter(game=>Date.parse(game.date)<cutoff&&Number.isFinite(game.values?.[row.marketKey]))
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return applyTennisHistory(row,{...log,games});
}

export async function enrichTennisRows(rows, {signal, onRows, concurrency = 2, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'tennis' || row.historyStatus !== 'pending' && !row.historyRefresh) continue;
    if (!groups.has(row.player)) groups.set(row.player, []);
    groups.get(row.player).push(row);
  }
  const queue = [...groups.values()], result = new Map();
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      aborted(signal);
      const batch = queue[next++];
      let updates;
      try {
        const log = await loadTennisHistory(batch[0].player, {signal, ...options});
        updates = batch.map(row => applyTennisHistory(row, log));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        updates = batch.map(row => ({...row, historyStatus: 'unavailable'}));
      }
      updates=updates.map((update,i)=>batch[i].historyStatus==='ready'&&update.historyStatus!=='ready'?{...batch[i],historyRefresh:true}:update);
      updates.forEach(row => result.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, concurrency)}, worker));
  return rows.map(row => result.get(row.id) || row);
}
