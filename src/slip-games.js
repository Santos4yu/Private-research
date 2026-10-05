// Each pick's game, from /api/prediction?action=slip-games (slip_games.py):
// whether it has started, the score and the clock, the injury report, MLB's
// posted lineup and starters, and each player's line so far. All of it from
// the leagues' free sources.
//
// A row carries its game as `row.game` ({state, detail, period, clock,
// injuries, lineups, starters, team, opponent, player}). From it come
// the news on a pick (newsOf, newsFacts, newsCap: is he playing, who's out
// around him, where he bats) and how it's going (liveRead).
import {finderMarket, gameValue} from './prop-finder-core.js';
import {statKeyOf, valueOf} from './sports/soccer/soccer-stats.js';

const URL = '/api/prediction?action=slip-games';
const SPORTS = new Set(['nfl', 'nba', 'wnba', 'nhl', 'mlb', 'soccer']);
const finite = value => typeof value === 'number' && Number.isFinite(value);
const SUFFIX = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'v']);
const words = name => String(name || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/'/g, '')
  .replace(/[^a-z ]+/g, ' ').split(' ').filter(word => word && !SUFFIX.has(word));
const lastName = name => { const list = String(name || '').split(' ').filter(word => !SUFFIX.has(word.toLowerCase().replace('.', ''))); return list.at(-1) || name; };
const fmt = value => (finite(value) ? String(Math.round(value * 10) / 10) : '—');
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

/** Two spellings of one player: the full name, or the same last name and first initial. */
export function samePerson(a, b) {
  const [x, y] = [words(a), words(b)];
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  return x.at(-1) === y.at(-1) && x[0][0] === y[0][0];
}

// ---------------------------------------------------------------- loading

/** One game per pick's team and day; soccer by its match. */
export const gameKey = row => row.sport === 'soccer' ? `soccer:${row.eventId}`
  : [row.sport, row.teamAbbr || '', row.opponent || '', String(row.startsAt || '').slice(0, 10)].join(':');

/** The games a slip's picks ({key, row}) are in, each with the players asked about. */
export function gameRequests(legs) {
  const games = new Map();
  for (const leg of legs) {
    const row = leg?.row;
    if (!row?.player || !SPORTS.has(row.sport) || !(row.teamAbbr || row.eventId || row.teamId)) continue;
    const key = gameKey(row);
    if (!games.has(key)) {
      games.set(key, {key, sport: row.sport, team: row.teamAbbr || '', opponent: row.opponent || '', startsAt: row.startsAt || '',
        // The NHL row's game is the NHL's own; the NFL's is nflverse's, which ESPN doesn't know.
        gameId: row.sport === 'nhl' ? row.gameId || '' : '', eventId: row.eventId || '', teamId: row.teamId ?? '',
        opponentId: row.opponentId ?? '', competition: row.competition || '', players: []});
    }
    // ESPN's box score knows the basketball, NHL and MLB ids; the NFL's are nflverse's.
    games.get(key).players.push({key: String(leg.key), name: row.player, id: row.sport === 'nfl' || row.sport === 'soccer' ? '' : row.playerId ?? ''});
  }
  return [...games.values()];
}

/** Each pick's game ({leg key: game}), its own line as `game.player`. */
export async function loadGames(legs, {signal, fetcher = fetch} = {}) {
  const asked = gameRequests(legs);
  if (!asked.length) return {};
  const response = await fetcher(URL, {method: 'POST', credentials: 'same-origin', signal, headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({games: asked.map(({key, ...game}) => game)})});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Game updates are unavailable right now.');
  const out = {};
  asked.forEach((game, index) => {
    const view = payload.games?.[index];
    if (!view?.found) return;
    const {players = {}, ...rest} = view;
    for (const person of game.players) out[person.key] = {...rest, sport: game.sport, player: players[person.key] || null};
  });
  return out;
}

export const withGame = (row, game) => (row && game ? {...row, game} : row);

// What a teammate's absence has meant: the player page's with/without
// splits (api/nfl.py finder-player, api/wnba.py player-context).
const nflSeason = (now = new Date()) => (now.getMonth() < 2 ? now.getFullYear() - 1 : now.getFullYear());
function splitsUrl(row) {
  const query = new URLSearchParams();
  const set = (name, value) => { if (value != null && value !== '') query.set(name, String(value)); };
  if (row.sport === 'nfl') {
    set('resource', 'finder-player'); set('season', nflSeason()); set('playerId', row.playerId); set('team', row.teamAbbr);
    set('opponent', row.opponent); set('market', row.marketKey); set('line', row.line);
    return row.playerId && row.teamAbbr && row.opponent && row.marketKey ? `/api/nfl?${query}` : null;
  }
  if (row.sport === 'nba' || row.sport === 'wnba') {
    set('resource', 'player-context'); if (row.sport === 'nba') set('league', 'nba'); set('playerId', row.playerId);
    set('team', row.teamAbbr); set('opponent', row.opponent); set('market', row.marketKey); set('line', row.line);
    return row.playerId && row.teamAbbr && row.opponent && row.marketKey ? `/api/wnba?${query}` : null;
  }
  return null;
}

/**
 * The with/without split for each teammate listed Out or Doubtful
 * ({leg key: [{name, status, with, without}]}), for the picks whose
 * league has them. One request per pick, and only when someone is out.
 */
export async function loadTeammates(legs, {signal, fetcher = fetch} = {}) {
  const out = {};
  await Promise.all(legs.map(async leg => {
    const missing = newsOf(leg.row)?.out || [];
    const url = missing.length ? splitsUrl(leg.row) : null;
    if (!url) return;
    try {
      const response = await fetcher(url, {credentials: 'same-origin', signal});
      if (!response.ok) return;
      const payload = await response.json();
      const found = missing.map(person => {
        const split = (payload.withWithout || []).find(item => samePerson(item.name, person.name));
        return split ? {...person, with: split.with, without: split.without} : null;
      }).filter(Boolean);
      if (found.length) out[leg.key] = found;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
    }
  }));
  return out;
}

// ---------------------------------------------------------------- the news

/** A report status as one of out / doubtful / questionable / probable. */
export function statusLevel(text) {
  const value = String(text || '').toLowerCase();
  if (/\bout\b|injured reserve|\bir\b|\bil\b|\d+-day|suspen|inactive|physically unable|non-football/.test(value)) return 'out';
  if (/doubt/.test(value)) return 'doubtful';
  if (/question|day-to-day|day to day|game.?time/.test(value)) return 'questionable';
  if (/probable/.test(value)) return 'probable';
  return null;
}

const isPitcher = row => String(row.marketKey || '').startsWith('pitching:');

// Which teammates bear on a pick. The NFL: the offense's skill players for
// an offensive line, the defense for a defender's (a guard or a corner on
// his own team says nothing about a back's catches). The NHL: goalies for
// a goalie, skaters for a skater. MLB's report is its injured list, men
// out for weeks whose absence is already in his recent games: none.
const NFL_OFFENSE = new Set(['QB', 'RB', 'HB', 'FB', 'WR', 'TE']);
const NFL_DEFENSE = new Set(['DE', 'DT', 'NT', 'DL', 'LB', 'ILB', 'OLB', 'MLB', 'CB', 'S', 'SS', 'FS', 'DB', 'EDGE']);
const NFL_DEFENSIVE_MARKETS = /tackle|sack|def_|interceptions_def|defensive/;
const position = value => String(value || '').toUpperCase().split(/[-/]/)[0];
function bearsOn(row, mate) {
  const theirs = position(mate.position), mine = position(row.position);
  if (row.sport === 'nfl') {
    if (NFL_DEFENSE.has(mine) || NFL_DEFENSIVE_MARKETS.test(String(row.marketKey || ''))) return NFL_DEFENSE.has(theirs);
    return (NFL_OFFENSE.has(mine) || !mine) && NFL_OFFENSE.has(theirs);
  }
  if (row.sport === 'nhl') return (theirs === 'G') === (mine === 'G');
  if (row.sport === 'mlb') return false;
  return true;
}
// The same job: QB for a QB, a back for a back, guard for a guard.
const GROUP = {HB: 'RB', FB: 'RB', PG: 'G', SG: 'G', SF: 'F', PF: 'F'};
const group = value => { const pos = position(value); return GROUP[pos] || pos; };
const sameJob = (row, mate) => Boolean(group(row.position)) && group(row.position) === group(mate.position);
// Out for weeks (injured reserve, PUP, a suspension): already missing from his recent games.
const longTerm = status => /injured reserve|\bir\b|physically unable|\bpup\b|non-football|suspen|\d+-day/i.test(String(status || ''));
// His average in his recent games, on this line's stat.
export function recentAverage(row) {
  const kept = row.windows?.l10?.average ?? row.average;
  if (finite(kept)) return kept;
  const values = (row.gameLog || []).map(game => game.value).filter(finite).slice(-10);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/**
 * What the game's news says about a pick: his own report status, the
 * teammates listed Out or Doubtful, his lineup spot (MLB, soccer) and,
 * for a pitcher, who is listed to start.
 */
export function newsOf(row) {
  const game = row?.game;
  if (!game) return null;
  const team = game.team;
  const report = (game.injuries?.[team] || []).map(item => ({...item, level: statusLevel(item.status)}));
  const self = report.find(item => samePerson(item.name, row.player)) || null;
  const out = report.filter(item => item !== self && (item.level === 'out' || item.level === 'doubtful') && bearsOn(row, item));
  let lineup = null;
  const posted = game.lineups?.[team];
  if (posted && !(row.sport === 'mlb' && isPitcher(row))) {
    const index = (posted.order || []).findIndex(person => samePerson(person.name, row.player));
    lineup = {confirmed: Boolean(posted.confirmed), spot: game.player?.spot ?? (index >= 0 ? index + 1 : null), listed: index >= 0 || game.player?.spot != null};
  }
  let starter = null;
  if (row.sport === 'mlb' && isPitcher(row) && game.starters?.[team]?.name) {
    starter = {name: game.starters[team].name, him: samePerson(game.starters[team].name, row.player)};
  }
  return {self, out, lineup, starter, state: game.state};
}

const statWord = row => {
  const name = String(row.market || 'this stat').replace(/^pitcher\s+/i, '');
  return /[A-Z]{2}|\+/.test(name) ? name : name.toLowerCase();
};
// His own status first, then who starts (and a role that changed with it), his lineup spot, then teammates out.
const NEWS_ORDER = {status: 0, starter: 1, role: 1, lineup: 2};
const news = (key, text, impact, tone, extra = {}) => ({kind: 'news', key, text, impact: Math.round(impact * 10) / 10, tone,
  rank: NEWS_ORDER[key] ?? 3, ...extra});
// Batting higher means more trips to the plate: about 4.6 for the leadoff
// man, 3.8 for the ninth.
const SPOT_IMPACT = [0, 2.5, 2, 1.5, 1, 0, 0, -1, -1.5, -2];

/**
 * The news as matchup facts (kind 'news'), written for the pick's side.
 * `teammates` is loadTeammates' list for this pick (kept on its game).
 */
export function newsFacts(row, side, teammates = row?.game?.teammates || []) {
  const found = newsOf(row);
  if (!found) return [];
  const sign = side === 'UNDER' ? -1 : 1;
  const last = lastName(row.player);
  const facts = [];
  const {self} = found;
  if (self?.level === 'out') facts.push(news('status', `${last} is listed ${self.status}. Picks on a player who doesn't play are usually voided`, 0, 'down', {level: 'out'}));
  else if (self?.level === 'doubtful') facts.push(news('status', `${last} is listed Doubtful and may not play, or play less`, -6 * sign, 'down', {level: 'doubtful'}));
  else if (self?.level === 'questionable') facts.push(news('status', `${last} is listed ${self.status}. Check before the game`, -2 * sign, 'warn', {level: 'questionable'}));
  // A starter at his position out, and a line well above what he's been
  // doing: he steps into a bigger job (a backup quarterback or goalie
  // starting), so his recent games say little about today.
  const average = recentAverage(row);
  const line = finite(row.line) ? row.line : null;
  const bigger = line != null && line > 0 && finite(average) && (average <= 0 || line >= 1.4 * average);
  const replaced = bigger ? found.out.find(mate => sameJob(row, mate) && !longTerm(mate.status)) : null;
  if (replaced) {
    const starts = ['QB', 'G'].includes(group(row.position)) && ['nfl', 'nhl'].includes(row.sport);
    const was = finite(average) ? ` (${fmt(average)} a game against a ${fmt(line)} line)` : '';
    facts.push(news('role', `${lastName(replaced.name)} (${replaced.position}) is ${replaced.level === 'out' ? 'out' : 'doubtful'}, so ${last} likely `
      + `${starts ? 'starts' : 'steps into a bigger role'}. ${last}'s recent games came in a smaller role${was} and say little about today`,
    6 * sign, sign > 0 ? 'warn' : 'down', {level: 'role'}));
  }
  // The rest of who's out: those with a with/without split first (what
  // the absence has meant), then his own position; two at most.
  const mates = found.out.filter(mate => mate !== replaced).map(mate => {
    const split = teammates.find(item => samePerson(item.name, mate.name));
    const known = split?.without?.games >= 2 && split?.with?.games >= 2 && finite(split.without.avg) && finite(split.with.avg);
    return {mate, split: known ? split : null};
  }).filter(({mate, split}) => split || (!longTerm(mate.status) && sameJob(row, mate)))
    .sort((a, b) => Boolean(b.split) - Boolean(a.split) || sameJob(row, b.mate) - sameJob(row, a.mate));
  for (const {mate, split} of mates.slice(0, 2)) {
    const who = `${lastName(mate.name)}${mate.position ? ` (${mate.position})` : ''}`;
    const word = mate.level === 'out' ? 'out' : 'doubtful';
    if (split) {
      const scale = Math.max(Math.abs(row.line || 0), 1);
      const impact = clamp(((split.without.avg - split.with.avg) / scale) * 30, -8, 8) * sign;
      facts.push(news(`mate:${mate.name}`, `${who} is ${word}: ${last} averages ${fmt(split.without.avg)} ${statWord(row)} without ${lastName(mate.name)} `
        + `(${split.without.games} games) and ${fmt(split.with.avg)} with ${lastName(mate.name)} playing`, impact,
        impact >= 1.5 ? 'up' : impact <= -1.5 ? 'down' : 'flat'));
    } else {
      facts.push(news(`mate:${mate.name}`, `Teammate ${who} is ${word}`, 0, 'flat'));
    }
  }
  if (found.lineup && row.sport === 'mlb') {
    const {confirmed, spot, listed} = found.lineup;
    if (confirmed && !listed) facts.push(news('lineup', `${last} isn't in the posted lineup`, -10 * sign, 'down', {level: 'benched'}));
    else if (spot) facts.push(news('lineup', `Batting ${ordinal(spot)} in the ${confirmed ? 'posted' : 'early'} lineup`, (SPOT_IMPACT[spot] || 0) * sign,
      SPOT_IMPACT[spot] * sign >= 1.5 ? 'up' : SPOT_IMPACT[spot] * sign <= -1.5 ? 'down' : 'flat'));
    else if (found.state === 'pre') facts.push(news('lineup', 'The lineup isn\'t posted yet', 0, 'flat'));
  }
  if (found.lineup && row.sport === 'soccer' && found.lineup.confirmed) {
    facts.push(found.lineup.listed ? news('lineup', `${last} is in the starting lineup`, 2 * sign, sign > 0 ? 'up' : 'down')
      : news('lineup', `${last} starts on the bench`, -8 * sign, sign > 0 ? 'down' : 'up', {level: sign > 0 ? 'benched' : null}));
  }
  if (found.starter) {
    facts.push(found.starter.him ? news('starter', `Confirmed as the starting pitcher`, 0, 'flat')
      : news('starter', `${found.starter.name} is listed to start, not ${last}`, 0, 'down', {level: 'out'}));
  }
  return facts;
}

/**
 * The best tier the news allows, or null: a player who is out (or a
 * pitcher who isn't starting) is a Fade; Doubtful, out of the lineup or
 * in a bigger role than his recent games is Risky at best; Questionable
 * keeps him out of Elite.
 */
export function newsCap(facts = []) {
  const levels = new Set(facts.map(item => item.level).filter(Boolean));
  if (levels.has('out')) return 'fade';
  if (levels.has('doubtful') || levels.has('benched') || levels.has('role')) return 'risky';
  if (levels.has('questionable')) return 'strong';
  return null;
}

// ---------------------------------------------------------------- live

/** The player's number so far for the pick's stat, from his line in the box score. */
export function liveValue(row, player) {
  const line = player?.line;
  if (!line) return null;
  if (row.sport === 'nfl' || row.sport === 'nba' || row.sport === 'wnba') return finite(line[row.marketKey]) ? line[row.marketKey] : null;
  if (row.sport === 'nhl') return finite(line[row.valueKey]) ? line[row.valueKey] : null;
  if (row.sport === 'mlb') {
    const market = finderMarket(row.raw?.stat || row.market);
    if (!market || market.firstInning) return null;
    const stat = market.pitcher ? line.pitching : line.batting;
    return stat && Object.keys(stat).length ? gameValue(stat, market) : 0;
  }
  if (row.sport === 'soccer') return valueOf(line, statKeyOf(row.marketKey));
  return null;
}

const UNITS = {nfl: 'quarter', nba: 'quarter', wnba: 'quarter', nhl: 'period'};
/** Where the game is: "3rd quarter, 8:42", "Halftime", "Top 5th", "67'", "Final". */
export function clockText(game) {
  if (!game) return '';
  if (game.off) return game.detail || 'Postponed';
  if (game.state === 'post') return 'Final';
  if (game.state !== 'in') return '';
  const detail = String(game.detail || '');
  if (game.sport === 'mlb' || game.sport === 'soccer') return detail;
  if (/half/i.test(detail)) return 'Halftime';
  if (/^end/i.test(detail)) return detail.replace(/^end of/i, 'End of');
  const period = game.period;
  if (!finite(period)) return detail;
  const regulation = game.sport === 'nhl' ? 3 : 4;
  const name = period > regulation ? (game.sport === 'nhl' && period > 4 ? 'Shootout' : 'Overtime') : `${ordinal(period)} ${UNITS[game.sport]}`;
  if (game.intermission) return `${ordinal(period)} intermission`;
  return game.clock && !/^0?0:00$/.test(game.clock) ? `${name}, ${game.clock}` : name;
}

/**
 * How a pick in a started game is going: {value, line, progress (0-1, how
 * far to the line), result ('hit' | 'miss' | 'push' | null while it's
 * still open), text: "Downs 42 of 71.5 receiving yards", clock}.
 */
export function liveRead(row, side, line = row?.line) {
  const game = row?.game;
  if (!game || (game.state !== 'in' && game.state !== 'post') || game.off || !finite(line)) return null;
  const done = game.state === 'post';
  const player = game.player;
  let value = liveValue(row, player);
  if (value == null) {
    // Not in the box score at the final: he didn't play, and most apps void the pick.
    if (done && (!player || player.played === false)) {
      return {value: null, line, progress: 0, result: 'dnp', text: `${lastName(row.player)} didn't play`, clock: clockText(game), state: game.state};
    }
    // Nothing in the box score yet is nothing yet.
    value = 0;
  }
  const over = side !== 'UNDER';
  let result = null;
  if (over && value > line) result = 'hit';
  else if (!over && value > line) result = 'miss';
  else if (done) result = value === line ? 'push' : over ? 'miss' : 'hit';
  const progress = line > 0 ? clamp(value / line, 0, 1) : value > 0 ? 1 : 0;
  return {value, line, progress, result, clock: clockText(game), state: game.state,
    text: `${lastName(row.player)} ${fmt(value)} of ${fmt(line)} ${statWord(row)}`};
}

/** True while any pick's game is under way (or starts within the hour), so the page keeps checking. */
export function anyLive(rows, now = Date.now()) {
  return rows.some(row => row?.game?.state === 'in'
    || (row?.game?.state === 'pre' && Number.isFinite(Date.parse(row.startsAt)) && Date.parse(row.startsAt) - now < 60 * 60 * 1000));
}

/**
 * How a pick is settled from the final box score (slip_ledger.py): the
 * same number liveValue reads, named for the server. Null when the stat
 * can't be read from a box score (first-inning lines).
 */
export function settleKey(row) {
  if (!row) return null;
  if (row.sport === 'nfl' || row.sport === 'nba' || row.sport === 'wnba') return row.marketKey ? {kind: 'key', key: row.marketKey} : null;
  if (row.sport === 'nhl') return row.valueKey ? {kind: 'key', key: row.valueKey} : null;
  if (row.sport === 'mlb') {
    const market = finderMarket(row.raw?.stat || row.market);
    return market && !market.firstInning ? {kind: 'mlb', field: market.field, pitcher: Boolean(market.pitcher)} : null;
  }
  if (row.sport === 'soccer') {
    const key = statKeyOf(row.marketKey);
    return key ? {kind: 'soccer', key} : null;
  }
  return null;
}
