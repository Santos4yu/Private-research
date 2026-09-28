import {finderMarket, gameValue, historyChart, nameKey} from './prop-finder-core.js';
import {teamLogoUrl} from './sports/nfl/nfl-ui-core.js';
import {MARKET_STAT as WNBA_DVP_STAT, positionOf} from './sports/wnba/wnba-research.js';
import {playerGames, statKeyOf, valueOf} from './sports/soccer/soccer-stats.js';

const WINDOW_KEYS = ['l5', 'l10', 'l15', 'l20', 'h2h', 'season'];
export const BOOK_NAMES = {prizepicks: 'PrizePicks', underdog: 'Underdog', pick6: 'DK Pick6', betr_us_dfs: 'Betr Picks',
  draftkings: 'DraftKings', fanduel: 'FanDuel', betmgm: 'BetMGM', williamhill_us: 'Caesars', espnbet: 'ESPN BET',
  fanatics: 'Fanatics', betrivers: 'BetRivers', hardrockbet: 'Hard Rock Bet', pinnacle: 'Pinnacle'};
const NFL_LABELS = {passing_yards: 'Passing Yards', passing_attempts: 'Passing Attempts', pass_completions: 'Pass Completions', passing_touchdowns: 'Passing TDs', interceptions: 'Interceptions', rushing_yards: 'Rushing Yards', rush_attempts: 'Rush Attempts', passing_rushing_yards: 'Passing + Rushing Yards', receiving_yards: 'Receiving Yards', receptions: 'Receptions', targets: 'Targets', longest_reception: 'Longest Reception', rushing_receiving_yards: 'Rushing + Receiving Yards', touchdowns: 'Touchdowns', fantasy_score: 'Fantasy Score'};
const historyCache = new Map();
const HISTORY_TTL = 10 * 60 * 1000;
const FINDER_CACHE_PREFIX = 'vortex:finder:board:v5:';
const FINDER_CACHE_TTL = 24 * 60 * 60 * 1000;

const number = value => value == null || value === '' || typeof value === 'boolean' ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const side = value => String(value || '').toUpperCase() === 'UNDER' ? 'UNDER' : 'OVER';
const optional = value => value || null;
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const photo = id => id ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${encodeURIComponent(id)}/headshot/silo/current` : null;
const mlbLogo = id => id ? `https://www.mlbstatic.com/team-logos/${encodeURIComponent(id)}.svg` : null;

function cacheStore() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

/** Persist the compact board snapshot so returning users paint before a fetch. */
export function readFinderCache(sport, now = Date.now()) {
  try {
    const store = cacheStore();
    if (!store) return null;
    const value = JSON.parse(store.getItem(FINDER_CACHE_PREFIX + sport) || 'null');
    if (!value || !Array.isArray(value.rows) || !value.rows.length || now - Number(value.ts || 0) > FINDER_CACHE_TTL) return null;
    const rows = value.rows.filter(row => !row.startsAt || !Number.isFinite(Date.parse(row.startsAt)) || Date.parse(row.startsAt) > now);
    return rows.length ? {...value, rows, persisted: true} : null;
  } catch { return null; }
}

export function persistFinderCache(sport, value) {
  try {
    const store = cacheStore();
    if (!store || !value?.rows?.length) return;
    const rows = value.rows.map(row => {
      const compact = {...row};
      // History/chart payloads are shared by many lines and can be re-fetched
      // from the in-memory cache. Keeping them out of storage avoids blocking
      // the main thread and keeps mobile localStorage well below quota.
      delete compact.history;
      delete compact.chart;
      return compact;
    });
    store.setItem(FINDER_CACHE_PREFIX + sport, JSON.stringify({
      ts: Date.now(), fetchedAt: value.fetchedAt || null, rows,
    }));
  } catch { /* Storage is an optimization; live data remains authoritative. */ }
}

function aborted(signal) {
  if (signal?.aborted) throw signal.reason || new DOMException('Request aborted', 'AbortError');
}

async function request(url, {signal, fetcher = fetch} = {}) {
  aborted(signal);
  const response = await fetcher(url, {signal, cache: 'no-store', credentials: 'same-origin'});
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Prop data is temporarily unavailable.');
  return data;
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
  if (!league?.dvp || !row?.opponent) return null;
  const wnba = row.sport === 'wnba';
  const position = wnba ? positionOf(row.position) : nflDvpPosition(row.position);
  const stat = wnba ? WNBA_DVP_STAT[row.marketKey] : NFL_DVP_STAT[row.marketKey];
  const rank = league.dvp[row.opponent]?.[position]?.stats?.[stat]?.szn?.[1];
  return typeof rank === 'number' && Number.isFinite(rank) ? rank : null;
}

export function withDefense(rows, league) {
  if (!league?.dvp || !Array.isArray(rows)) return rows;
  return rows.map(row => {
    const rank = defenseRank(row, league);
    return rank === row.defense ? row : {...row, defense: rank, defenseTeams: league.teamCount || null};
  });
}

/** The league table the defense ranks come from (WNBA and NFL). */
export function loadFinderDefense(sport, options = {}) {
  if (sport === 'wnba') return request('/api/wnba?resource=league-context', options);
  if (sport === 'nfl') {
    const today = new Date();
    const season = options.season || today.getUTCFullYear() - (today.getUTCMonth() < 2 ? 1 : 0);
    return request(`/api/nfl?resource=finder-league&season=${season}`, options);
  }
  return Promise.resolve(null);
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
    if (sport === 'wnba') {
      const opponent = raw.teamAbbr && raw.teamAbbr === raw.homeTeamAbbr ? raw.awayTeamAbbr
        : raw.teamAbbr && raw.teamAbbr === raw.awayTeamAbbr ? raw.homeTeamAbbr : null;
      return finish({...raw, id: `wnba:${raw.id}`, sport, player: raw.player, playerId: optional(raw.playerId),
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
        average: raw.windows?.l10?.average, windows: raw.windows, streak: raw.streak,
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
    return null;
  });
  return rows.filter(row => row && row.player && row.line != null &&
    (!row.startsAt || !Number.isFinite(Date.parse(row.startsAt)) || Date.parse(row.startsAt) > now));
}

/** Read existing sport feeds. NFL uses its saved board, never a browser-driven odds scan. */
export async function loadFinderSport(sport, options = {}) {
  if (sport === 'wnba') {
    const payload = await request(options.fast ? '/api/wnba?fast=1' : '/api/wnba', options);
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
  throw new Error('This sport is not supported by Finder.');
}

const wnbaHistoryKey = row => String(row.playerId || '');

export async function loadWnbaHistory(row, options = {}) {
  aborted(options.signal);
  const playerId = wnbaHistoryKey(row);
  if (!playerId) throw new Error('WNBA player identity unavailable.');
  const season = options.season || new Date().getUTCFullYear();
  const key = `${playerId}:${season}`;
  const cached = historyCache.get(`wnba:${key}`);
  if (cached && Date.now() - cached.at < HISTORY_TTL) return cached.value;
  const payload = await request(`/api/wnba?resource=gamelog&playerId=${encodeURIComponent(playerId)}&season=${season}`, options);
  historyCache.set(`wnba:${key}`, {at: Date.now(), value: payload});
  if (historyCache.size > 500) historyCache.delete(historyCache.keys().next().value);
  return payload;
}

export function applyWnbaHistory(row, payload) {
  const logs = (payload?.rows || []).filter(log => log?.date && number(log?.values?.[row.marketKey]) != null)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.gameId || '').localeCompare(String(b.gameId || '')));
  const values = logs.map(log => number(log.values[row.marketKey])).filter(value => value != null);
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
    historyStatus: 'ready', history: payload});
}

/** Hydrate WNBA history after the market rows are already visible. */
export async function enrichWnbaRows(rows, {signal, onRows, concurrency = 6, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'wnba' || row.historyStatus === 'ready' || !row.playerId) continue;
    const key = wnbaHistoryKey(row);
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
        const payload = await loadWnbaHistory(batch[0], {signal, ...options});
        aborted(signal);
        updates = batch.map(row => applyWnbaHistory(row, payload));
      } catch (error) {
        if (signal?.aborted || error.name === 'AbortError') throw error;
        updates = batch.map(row => ({...row, historyStatus: 'unavailable'}));
      }
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, Math.min(8, concurrency)))}, worker));
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
  const validGames = (payload.games || []).filter(game => game.date && strictMlbValue(game.stat || {}, definition) != null)
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.gameId || '').localeCompare(String(b.gameId || '')));
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
    average: mean(values.slice(-10)), windows, streak: values.length ? streak : null,
    historyStatus: 'ready', history: payload, chart});
}

/** Emits one batch per player/group so rows become useful before the full slate finishes. */
export async function enrichMlbRows(rows, {signal, onRows, concurrency = 4, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'mlb' || row.historyStatus === 'ready') continue;
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
  return finish({...row, average: mean(values.slice(-10)), windows, streak, historyStatus: 'ready'});
}

/** Hydrate soccer hit rates after the lines are already on the board. */
export async function enrichSoccerRows(rows, {signal, onRows, concurrency = 4, ...options} = {}) {
  const groups = new Map();
  for (const row of rows) {
    if (row.sport !== 'soccer' || row.historyStatus !== 'pending') continue;
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
      updates.forEach(row => enriched.set(row.id, row));
      onRows?.(updates);
    }
  }
  await Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, Math.min(6, concurrency)))}, worker));
  return rows.map(row => enriched.get(row.id) || row);
}
