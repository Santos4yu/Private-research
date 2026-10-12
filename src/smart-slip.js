// Smart Slip: PrizePicks slips built from the Finder's lines, every sport.
//
// Each pick's chance comes from three things a member can check for
// themselves: the player's own record at this line (last 5/10/15/20 games
// and the season, pulled toward 50/50 when the sample is small), a
// projection from the games themselves adjusted for today's matchup, venue,
// head-to-head and playing time (slip-analyst.js), and, where sportsbooks
// price the line, their odds with the margin taken out. A pick the numbers
// don't back -- or where they argue with each other -- is never offered;
// the rest are graded A, B or C with a note saying why.
//
// Payouts follow PrizePicks' tables. Goblins and Demons change them by how
// likely they are (a Goblin pays less, a Demon more); PrizePicks sets those
// per line, so here they are estimated from the line's odds and shown with ≈.
// Payouts come in bands (2x up to 3x, 3x up to 5x, ... 20x and up); the
// search finds, in each band, the likeliest slip that is still a fair bet
// -- a ladder from safer to bigger, never under 2x. The member picks how the
// lines mix: all regular, regular with a Goblin, regular with a Demon, or
// anything.
import {bookProbability} from './unified-finder-data.js';
import {readPick, grade, conflicted, analystNote} from './slip-analyst.js';
import {link} from './slip-correlation.js';
import {scoreParlay} from './slip-score.js';

export const POWER = {2: 3, 3: 6, 4: 10, 5: 20, 6: 37.5};
// Flex: hits -> multiplier.
export const FLEX = {3: {3: 3, 2: 1}, 4: {4: 6, 3: 1.5}, 5: {5: 10, 4: 2, 3: 0.4}, 6: {6: 25, 5: 2, 4: 0.4}};
export const TARGETS = [2, 3, 5, 10, 20];
// Which lines a slip may use, which it must have at least one of, and
// whether its Goblins or Demons may outnumber its regular lines.
export const MIXES = {
  regular: {kinds: ['standard'], needs: [], balanced: false},
  goblin: {kinds: ['standard', 'goblin'], needs: ['standard', 'goblin'], balanced: true},
  demon: {kinds: ['standard', 'demon'], needs: ['standard', 'demon'], balanced: true},
  any: {kinds: ['standard', 'goblin', 'demon'], needs: [], balanced: false},
};
// A slip this close to breaking even (or better) counts as a fair bet; in
// each band the likeliest fair slip is the one shown.
const FAIR = 0.95;
// An estimated payout (Goblins, Demons) must clear the lowest band by this
// much, so a slip PrizePicks prices a little lower still pays 2x.
const ESTIMATE_CUSHION = 1.05;
export const SPORT_NAMES = {mlb: 'MLB', nba: 'NBA', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL', soccer: 'Soccer'};
// A game starting sooner than this is too close to pick.
const LOCK_MINUTES = 10;
// Games of 50/50 each record is pulled toward: 6 games at 50% weigh as much
// as six real ones, so 3 for 3 reads as 67%, not 100%.
const PRIOR = 6;
const WINDOW_WEIGHTS = {l5: 0.10, l10: 0.30, l15: 0.10, l20: 0.15, season: 0.35};

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const round = value => Math.round(value * 100);

/** The record for one side of a line in one window: won of games. */
export function sideRecord(row, key, side) {
  const window = row?.windows?.[key];
  if (!window) return null;
  const hits = finite(window.hits) ? window.hits : null;
  const misses = finite(window.misses) ? window.misses : null;
  let games = finite(window.decisions) ? window.decisions : hits != null && misses != null ? hits + misses : null;
  if (games == null && finite(window.sample)) games = window.sample - (finite(window.pushes) ? window.pushes : 0);
  let rowSide = hits;
  if (rowSide == null && finite(window.hitRate) && games) rowSide = Math.round(window.hitRate / 100 * games);
  if (!games || games <= 0 || rowSide == null) return null;
  // Windows count the row's own direction (the Over, almost always).
  const over = row.direction === 'UNDER' ? games - rowSide : rowSide;
  const won = side === 'UNDER' ? games - over : over;
  return {won, games, rate: won / games};
}

export const isPrizePicksLine = row => Array.isArray(row?.apps) && row.apps.some(app => app?.key === 'prizepicks')
  && ['standard', 'goblin', 'demon'].includes(String(row.modifier || 'standard').toLowerCase());

export const gameKey = row => `${row.sport}:${row.gameId || row.eventId
  || [row.teamAbbr, row.opponent].filter(Boolean).sort().join('-') + ':' + String(row.startsAt || '').slice(0, 10)}`;

// Which side of a game each team is: home and away when the board says,
// else from the row's own team and opponent.
function sides(row) {
  if (row.homeTeamAbbr && row.awayTeamAbbr) return [row.awayTeamAbbr, row.homeTeamAbbr];
  if (row.isHome === true) return [row.opponent, row.teamAbbr];
  if (row.isHome === false) return [row.teamAbbr, row.opponent];
  return [row.teamAbbr, row.opponent];
}

/**
 * The games on the boards that a slip can still be built from: each one's
 * teams (away first) and logos, start, and the players with a PrizePicks
 * line in it, soonest first. `logo(row)` and `opponentLogo(row)` give the
 * row's team and opponent marks.
 */
export function slateGames(rows, {now = Date.now(), logo = () => null, opponentLogo = () => null} = {}) {
  const games = new Map();
  for (const row of rows || []) {
    const starts = Date.parse(row.startsAt || '');
    if (!isPrizePicksLine(row) || !(starts > now + 10 * 60000) || !row.teamAbbr) continue;
    const key = gameKey(row);
    let game = games.get(key);
    if (!game) {
      const [away, home] = sides(row);
      game = {key, sport: row.sport, startsAt: row.startsAt, away: {abbr: away || '', logo: null}, home: {abbr: home || '', logo: null}, players: new Map()};
      games.set(key, game);
    }
    for (const team of [game.away, game.home]) {
      if (!team.logo && team.abbr === row.teamAbbr) team.logo = logo(row) || null;
      if (!team.logo && team.abbr === row.opponent) team.logo = opponentLogo(row) || null;
    }
    const known = game.players.get(row.player);
    if (!known || (!known.headshot && row.headshot)) game.players.set(row.player, {name: row.player, headshot: row.headshot || known?.headshot || '', team: row.teamAbbr});
  }
  return [...games.values()].map(game => ({...game, players: [...game.players.values()]}))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.key.localeCompare(b.key));
}

function sidePrice(apps, side) {
  const field = side === 'UNDER' ? 'under' : 'over';
  const priced = (apps || []).filter(app => app.key !== 'prizepicks' && finite(app[field]) && Math.abs(app[field]) >= 100);
  priced.sort((a, b) => (a.key === 'pinnacle' ? -1 : b.key === 'pinnacle' ? 1 : 0));
  return priced[0] ? {book: priced[0].name || priced[0].key, price: priced[0][field]} : null;
}

/**
 * One side of one PrizePicks line, judged: its chance, the evidence behind
 * it and (for Goblins and Demons) how it changes the payout. Null when it
 * isn't a pick the numbers back.
 */
export function judgeLeg(row, side, options = {}) {
  const leg = assessLeg(row, side, options);
  return leg?.backed ? leg : null;
}

/**
 * The same read for any side of any line, whether or not the numbers back
 * it (`backed`): what Krazy Bot needs to answer "should I take this?".
 * Null only when there isn't enough to read (no history, too close to the
 * start, or an Under on a Goblin or Demon). The Slip Analyzer reads lines
 * from any app (`any`) and slips whose games have started (`started`).
 */
export function assessLeg(row, side, {now = Date.now(), any = false, started = false} = {}) {
  if (!any && !isPrizePicksLine(row)) return null;
  const modifier = String(row.modifier || 'standard').toLowerCase();
  if (modifier !== 'standard' && side === 'UNDER') return null;  // Goblins and Demons are More only
  const starts = Date.parse(row.startsAt || '');
  if (!started && (!Number.isFinite(starts) || starts - now < LOCK_MINUTES * 60000)) return null;
  const records = Object.fromEntries(['l5', 'l10', 'l15', 'l20', 'season', 'h2h'].map(key => [key, sideRecord(row, key, side)]));
  const recent = records.l10 || records.l5;
  if (!(recent && recent.games >= 5) && !(records.season && records.season.games >= 8)) return null;

  // The player's record, each window pulled toward 50/50 by its size.
  let weight = 0, total = 0;
  for (const [key, share] of Object.entries(WINDOW_WEIGHTS)) {
    const record = records[key];
    if (!record) continue;
    weight += share;
    total += share * (record.won + PRIOR * 0.5) / (record.games + PRIOR);
  }
  if (!weight) return null;
  let history = total / weight;

  const books = bookProbability(row.apps);
  const bookOver = books ? books.over / 100 : null;
  const book = bookOver == null ? null : side === 'UNDER' ? 1 - bookOver : bookOver;
  const twoSided = books?.books.some(item => item.twoSided);
  // The chance this kind of line needs to break even, without a book: a
  // Goblin is usually priced around 70%, a Demon around 35%.
  const baseline = modifier === 'standard' ? 0.5 : book ?? (modifier === 'goblin' ? 0.7 : 0.35);
  const read = readPick(row, side, {records, book, baseline});
  const projected = read.projected;
  if (projected == null) {
    // No projection to carry the matchup: head-to-head and the defense
    // rank nudge the record a little instead.
    if (records.h2h && records.h2h.games >= 3) history += clamp((records.h2h.rate - history) * 0.15, -0.03, 0.03);
    const teams = finite(row.defenseTeams) ? row.defenseTeams : null;
    if (finite(row.defense) && teams && teams > 1) {
      const soft = (row.defense - 1) / (teams - 1) - 0.5;
      history += (side === 'UNDER' ? -soft : soft) * 0.06;
    }
  }
  const chance = clamp(projected == null
    ? book == null ? 0.5 + (history - 0.5) * 0.8 : (twoSided ? 0.6 : 0.4) * book + (twoSided ? 0.4 : 0.6) * history
    : book == null ? 0.5 + (0.55 * projected + 0.45 * history - 0.5) * 0.85
      : twoSided ? 0.5 * book + 0.25 * projected + 0.25 * history : 0.35 * book + 0.35 * projected + 0.3 * history, 0.03, 0.95);

  // Only picks the numbers back: the recent record and the books (where
  // they price it) must not argue against it.
  const recentRate = recent && recent.games >= 5 ? recent.rate : records.season.rate;
  const backed = !(book != null && book < (modifier === 'demon' ? 0.25 : 0.47))
    && !(modifier === 'standard' && !(chance >= 0.53 && (recentRate >= 0.55 || (book ?? 0) >= 0.55)))
    && !(modifier === 'goblin' && !(chance >= 0.62 && recentRate >= 0.65))
    && !(modifier === 'demon' && !(chance >= 0.33 && recentRate >= 0.4))
    && !conflicted(read);

  // A Goblin or Demon scales the payout by how its chance compares with a
  // standard line's even odds: the market's chance when books price it.
  const fair = modifier === 'standard' ? 0.5 : book ?? chance;
  const factor = modifier === 'goblin' ? clamp(0.5 / fair, 0.45, 0.92) : modifier === 'demon' ? clamp(0.5 / fair, 1.1, 3.2) : 1;
  return {id: `${row.id}|${side}`, row, side, modifier, chance, history, book, factor, records, read, backed,
    grade: grade(read, chance, modifier === 'standard' ? 0.5 : fair, modifier), note: analystNote(row, side, read, {records, book}),
    price: sidePrice(row.apps, side), game: gameKey(row), player: row.player};
}

/** Every pick worth considering from these rows. */
export function candidates(rows, {now = Date.now(), alternates = true} = {}) {
  const out = [];
  for (const row of rows || []) {
    if (!alternates && String(row.modifier || 'standard').toLowerCase() !== 'standard') continue;
    for (const side of ['OVER', 'UNDER']) {
      const leg = judgeLeg(row, side, {now});
      if (leg) out.push(leg);
    }
  }
  return out;
}

// ---------------------------------------------------------------- slips

// Two picks from one game and how they move together (slip-correlation.js),
// or null: picks from different games don't.
const pairLink = (a, b) => !a.row || !b.row || !a.game || a.game !== b.game ? null
  : link({row: a.row, side: a.side, player: a.row?.player || a.player}, {row: b.row, side: b.side, player: b.row?.player || b.player});

/**
 * Payout, chance and worth of a slip, scored as the Slip Analyzer scores
 * one (slip-score.js): picks from one game counted as moving together, and
 * the same letter. `linkOf` is how two picks are linked (remembered across
 * a search).
 */
export function scoreSlip(legs, play = 'power', linkOf = pairLink) {
  const n = legs.length;
  const scale = legs.reduce((product, leg) => product * leg.factor, 1);
  const estimated = legs.some(leg => leg.modifier !== 'standard');
  const table = play === 'flex' ? FLEX[n] : POWER[n];
  if (!table) return null;
  const pairs = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const found = legs[a].game && legs[a].game === legs[b].game ? linkOf(legs[a], legs[b]) : null;
    if (found && Math.abs(found.rho) >= 0.03) pairs.push({...found, a, b});
  }
  const chances = legs.map(leg => leg.chance);
  if (play === 'flex') {
    const flex = Object.fromEntries(Object.entries(table).map(([k, pay]) => [k, pay * scale]));
    const scored = scoreParlay(chances, pairs, {flex});
    return {legs, play, payout: table[n] * scale, ...scored, estimated, fair: 1 / scored.chance, links: pairs};
  }
  const payout = table * scale;
  const scored = scoreParlay(chances, pairs, {pays: payout});
  return {legs, play, payout, ...scored, estimated, fair: 1 / scored.chance, links: pairs};
}

function fits(leg, chosen, perGame) {
  let sameGame = 0;
  for (const other of chosen) {
    if (other.player === leg.player || other.row.id === leg.row.id) return false;
    if (other.game === leg.game && ++sameGame >= perGame) return false;
  }
  return true;
}

/** The payout band a slip falls in: the highest target it reaches. */
export function band(payout, targets = TARGETS) {
  let found = null;
  for (const target of targets) if (payout + 1e-9 >= target) found = target;
  return found;
}

const odds = slip => slip.play === 'flex' ? slip.profit : slip.chance;
// Is `slip` a better pick for its band than `current`? The likeliest to
// cash among fair slips, the better value on a near tie; with no fair
// slip in the band, the best value.
function better(slip, current) {
  const fair = slip.value >= FAIR, currentFair = current.value >= FAIR;
  if (fair !== currentFair) return fair;
  const [first, second] = fair ? [odds, s => s.value] : [s => s.value, odds];
  const gap = first(slip) - first(current);
  return gap > 0.005 || (Math.abs(gap) <= 0.005 && second(slip) > second(current));
}

/**
 * The best slip in each payout band (2x up to 3x, 3x up to 5x, ...), by
 * `better`. `size` is a number of picks, or 'auto' for any size; `mix` is
 * one of MIXES. Locked picks stay in; excluded ones never come in. `only`
 * limits which bands are filled.
 */
export function buildLadder(pool, {play = 'power', size = 'auto', mix = 'any', sameGame = false, perGame: most = null, locked = [], excluded = [], targets = TARGETS, only = null} = {}) {
  // Picks one game may give a slip: `perGame` when the member chose a few
  // games (a one-game parlay takes them all from it), else one, or two
  // with same-game picks on.
  const perGame = Number(most) > 0 ? Number(most) : sameGame ? 2 : 1;
  // How each pair of picks moves together, worked out once for the search.
  const known = new Map();
  const linkOf = (a, b) => {
    const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (!known.has(key)) known.set(key, pairLink(a, b));
    return known.get(key);
  };
  const rule = MIXES[mix] || MIXES.any;
  const lockedLegs = pool.filter(leg => locked.includes(leg.id));
  const open = pool.filter(leg => !locked.includes(leg.id) && !excluded.includes(leg.id) && rule.kinds.includes(leg.modifier));
  const sizes = (size === 'auto' ? [2, 3, 4, 5, 6] : [Number(size)]).filter(n => (play === 'flex' ? FLEX[n] : POWER[n]) && n >= lockedLegs.length);
  const best = new Map();
  const count = (slip, kind) => slip.legs.filter(leg => leg.modifier === kind).length;
  const consider = slip => {
    const target = slip && band(slip.payout, targets);
    if (target == null || (only && !only.includes(target))) return;
    if (slip.estimated && slip.payout < targets[0] * ESTIMATE_CUSHION) return;
    if (!rule.needs.every(kind => count(slip, kind) > 0)) return;
    if (rule.balanced && count(slip, 'standard') < slip.legs.length - count(slip, 'standard')) return;
    // PrizePicks takes no slip whose players all play for one team.
    if (new Set(slip.legs.map(leg => `${leg.game}|${leg.row?.teamAbbr || leg.player}`)).size < 2) return;
    const current = best.get(target);
    if (!current || better(slip, current)) best.set(target, slip);
  };
  // Of each shortlist, the share for each kind of line.
  const shares = rule.kinds.length === 1 ? {standard: 1} : rule.kinds.length === 2 ? {standard: 0.7, goblin: 0.3, demon: 0.3}
    : {standard: 0.7, goblin: 0.15, demon: 0.15};
  for (const n of sizes) {
    const slots = n - lockedLegs.length;
    if (lockedLegs.some((leg, i) => !fits(leg, lockedLegs.slice(0, i), perGame))) continue;
    // The strongest picks of each kind allowed, so every payout level has
    // something to reach for. Fewer candidates for bigger slips keeps the
    // search quick.
    const limit = {0: 0, 1: 60, 2: 60, 3: 44, 4: 32, 5: 26, 6: 22}[slots];
    const shortlist = rule.kinds.flatMap(kind => open.filter(leg => leg.modifier === kind)
      .sort((a, b) => b.chance * b.factor - a.chance * a.factor).slice(0, Math.ceil(limit * shares[kind])));
    const chosen = [...lockedLegs];
    const walk = start => {
      if (chosen.length === n) { consider(scoreSlip([...chosen], play, linkOf)); return; }
      for (let i = start; i <= shortlist.length - (n - chosen.length); i++) {
        const leg = shortlist[i];
        if (!fits(leg, chosen, perGame)) continue;
        chosen.push(leg);
        walk(i + 1);
        chosen.pop();
      }
    };
    walk(0);
  }
  return targets.filter(target => best.has(target))
    .map(target => ({...best.get(target), target, key: best.get(target).legs.map(leg => leg.id).sort().join(',')}));
}

/** The slip to point to: the likeliest to cash, the better value on a near tie. */
export function safest(ladder) {
  return (ladder || []).reduce((top, slip) => !top || odds(slip) > odds(top) + 0.01
    || (Math.abs(odds(slip) - odds(top)) <= 0.01 && slip.value > top.value) ? slip : top, null);
}

// ---------------------------------------------------------------- reasons

const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
const formatPrice = price => (price > 0 ? '+' : '−') + Math.abs(price);
const figure = value => Number.isInteger(value) ? String(value) : value.toFixed(1);

/**
 * Why a pick is on the slip, in numbers anyone can check on the player's
 * page: its record, the books' odds, the matchup. Strongest first.
 */
export function reasons(leg) {
  const {records, row, side} = leg;
  const out = [];
  const add = (key, strong, label, detail, tone = null) => out.push({key, strong, label, detail, tone});
  if (records.l10) add('l10', `${records.l10.won}/${records.l10.games}`, 'last 10', `${round(records.l10.rate)}%`);
  else if (records.l5) add('l5', `${records.l5.won}/${records.l5.games}`, 'last 5', `${round(records.l5.rate)}%`);
  if (records.season && records.season.games > (records.l10?.games || 0)) add('season', `${records.season.won}/${records.season.games}`, 'this season', `${round(records.season.rate)}%`);
  if (leg.book != null) add('books', `${round(leg.book)}%`, 'sportsbooks', leg.price ? `${leg.price.book} ${formatPrice(leg.price.price)}` : null);
  const projection = leg.read?.projection;
  if (finite(projection)) add('projection', figure(Math.round(projection * 10) / 10), 'projection', `line ${figure(row.line)}`);
  const matchup = leg.read?.factors.find(item => item.key === 'matchup');
  if (matchup) add('matchup', matchup.short, matchup.label, null, (matchup.factor - 1) * (side === 'UNDER' ? -1 : 1) >= 0 ? 'up' : 'down');
  if (records.h2h && records.h2h.games >= 2 && row.opponent) add('h2h', `${records.h2h.won}/${records.h2h.games}`, `vs ${row.opponent}`, null);
  const venue = leg.read?.factors.find(item => item.key === 'venue');
  if (venue?.record) add('venue', `${venue.record.won}/${venue.record.games}`, venue.label, null);
  const role = leg.read?.factors.find(item => item.key === 'role');
  if (role) add('role', role.short, role.label, null);
  const average = row.windows?.l10?.average ?? row.average;
  if (!finite(projection) && finite(average) && finite(row.line)) add('average', figure(Math.round(average * 10) / 10), 'avg last 10', `line ${figure(row.line)}`);
  if (!matchup && finite(row.defense) && finite(row.defenseTeams) && row.opponent) {
    const mostAllowed = row.defenseTeams - row.defense + 1;
    const helps = side === 'UNDER' ? row.defense <= row.defenseTeams / 3 : mostAllowed <= row.defenseTeams / 3;
    if (helps) add('defense', side === 'UNDER' ? ordinal(row.defense) : ordinal(mostAllowed),
      side === 'UNDER' ? `toughest defense (${row.opponent})` : `most allowed (${row.opponent})`, null);
  }
  const streak = finite(row.streak) ? (side === 'UNDER' ? -row.streak : row.streak) : 0;
  if (streak >= 3) add('streak', String(streak), 'straight hits', null);
  return out;
}

/** A pick as the member's saved-pick list and PrizePicks export take it. */
export function exportLeg(leg) {
  const row = leg.row;
  return {league: String(row.sport || '').toUpperCase(), player: row.player,
    stat: row.sport === 'mlb' ? row.raw?.stat || row.market : row.market,
    line: row.line, side: leg.side === 'UNDER' ? 'under' : 'over', modifier: leg.modifier};
}
