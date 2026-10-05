// Slip Analyzer: the legs read from a screenshot (slip_reader.py), matched
// to the Finder's lines and graded with the Smart Slip model.
//
// Each app words its stats its own way ("Pts+Rebs+Asts", "Points +
// Rebounds + Assists", "PRA"), so a stat is reduced to the same key on both
// sides before matching. A player is found by name (initials, accents,
// suffixes and small misspellings allowed), team breaking ties. When the
// slip's line isn't the one on the board, the player's own games are
// re-scored at the slip's number, so a 2.5 on Underdog is graded as a 2.5,
// not as PrizePicks' 1.5.
import {finderMarket} from './prop-finder-core.js';
import {finderWindow} from './unified-finder-data.js';
import {assessLeg, POWER, FLEX, SPORT_NAMES} from './smart-slip.js';
import {matchupCase, withMatchups} from './slip-matchup.js';
import {links, jointChance} from './slip-correlation.js';
import {newsCap} from './slip-games.js';

export const SLIP_SPORTS = ['mlb', 'nba', 'wnba', 'nfl', 'nhl', 'soccer'];
export {SPORT_NAMES};

const finite = value => typeof value === 'number' && Number.isFinite(value);
const squash = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

// ---------------------------------------------------------------- stats

// Whole-stat shorthands, before splitting on "+".
const WHOLE = {
  basketball: {pra: 'pts+reb+ast', pr: 'pts+reb', pa: 'pts+ast', ra: 'reb+ast', stocks: 'blk+stl', blksstls: 'blk+stl',
    stlsblks: 'blk+stl', blocksteals: 'blk+stl', blocksandsteals: 'blk+stl', stealsblocks: 'blk+stl', ptsrebsasts: 'pts+reb+ast',
    pointsreboundsassists: 'pts+reb+ast', ptsrebs: 'pts+reb', ptsasts: 'pts+ast', rebsasts: 'reb+ast'},
  nhl: {shotsongoal: 'sog', sog: 'sog', goalieshots: 'saves'},
  soccer: {goalassist: 'ast+goals', goalsassists: 'ast+goals', goalorassist: 'ast+goals', shotsontarget: 'sot', sot: 'sot',
    shotsongoal: 'sot'},
  nfl: {anytimetd: 'rec+rush+td', anytimetouchdown: 'rec+rush+td', anytimetouchdownscorer: 'rec+rush+td', tdscorer: 'rec+rush+td',
    touchdowns: 'rec+rush+td', tds: 'rec+rush+td', scoreatd: 'rec+rush+td', rushrectds: 'rec+rush+td', rushingreceivingtds: 'rec+rush+td',
    carries: 'att+rush', receptions: 'receptions', catches: 'receptions', rec: 'receptions', completions: 'cmp+pass',
    interceptionsthrown: 'int+pass', intsthrown: 'int+pass', passingints: 'int+pass', tacklesassists: 'tackles', tacklesast: 'tackles',
    totaltackles: 'tackles', longestcatch: 'longest+receptions', longestreception: 'longest+receptions'},
};
// Each part of a stat.
const PARTS = {
  basketball: {points: 'pts', point: 'pts', pts: 'pts', pt: 'pts', p: 'pts', rebounds: 'reb', rebound: 'reb', rebs: 'reb', reb: 'reb',
    r: 'reb', assists: 'ast', assist: 'ast', asts: 'ast', ast: 'ast', a: 'ast', '3ptmade': '3pm', '3pointersmade': '3pm',
    '3pointsmade': '3pm', threepointersmade: '3pm', threes: '3pm', threesmade: '3pm', '3pm': '3pm', '3pt': '3pm', '3s': '3pm',
    '3pointers': '3pm', madethrees: '3pm', '3ptm': '3pm', '3ptattempted': '3pa', '3pointersattempted': '3pa', '3pa': '3pa',
    '3ptattempts': '3pa', threepointersattempted: '3pa', '3pointattempts': '3pa', blocks: 'blk', block: 'blk', blk: 'blk',
    blks: 'blk', blockedshots: 'blk', steals: 'stl', steal: 'stl', stl: 'stl', stls: 'stl', turnovers: 'tov', turnover: 'tov',
    tov: 'tov', to: 'tov', fantasyscore: 'fantasy', fantasypoints: 'fantasy', fantasy: 'fantasy', fpts: 'fantasy',
    fgmade: 'fgm', fieldgoalsmade: 'fgm', fgm: 'fgm', fgattempted: 'fga', fieldgoalsattempted: 'fga', fga: 'fga', fgattempts: 'fga',
    freethrowsmade: 'ftm', ftmade: 'ftm', ftm: 'ftm', freethrowsattempted: 'fta', ftattempted: 'fta', fta: 'fta',
    doubledouble: 'dd', doubledoubles: 'dd', tripledouble: 'td', tripledoubles: 'td', dunks: 'dunks', personalfouls: 'pf',
    fouls: 'pf', offensiverebounds: 'oreb', offrebounds: 'oreb', defensiverebounds: 'dreb', defrebounds: 'dreb',
    twopointersmade: '2pm', '2ptmade': '2pm', '2pointersmade': '2pm'},
  nhl: {points: 'pts', pts: 'pts', goals: 'goals', goal: 'goals', assists: 'ast', assist: 'ast', shotsongoal: 'sog', sog: 'sog',
    shots: 'sog', hits: 'hits', blockedshots: 'blk', blocks: 'blk', shotsblocked: 'blk', powerplaypoints: 'ppp', ppp: 'ppp',
    powerplaypts: 'ppp', goaliesaves: 'saves', saves: 'saves', totalsaves: 'saves', goalsagainst: 'ga', goalsallowed: 'ga',
    faceoffswon: 'fow', faceoffwins: 'fow', timeonice: 'toi', toi: 'toi', fantasyscore: 'fantasy', goaliefantasyscore: 'fantasy',
    shotattempts: 'attempts', shotsattempted: 'attempts', penaltyminutes: 'pim', plusminus: 'pm'},
  soccer: {shots: 'shots', totalshots: 'shots', shotsontarget: 'sot', sot: 'sot', goals: 'goals', goal: 'goals', assists: 'ast',
    assist: 'ast', passesattempted: 'pass', passes: 'pass', passattempts: 'pass', tackles: 'tkl', tacklesmade: 'tkl',
    clearances: 'clr', goaliesaves: 'saves', saves: 'saves', fouls: 'fouls', foulscommitted: 'fouls', shotsassisted: 'sa',
    keypasses: 'sa', crosses: 'cross', attempteddribbles: 'drib', dribbles: 'drib', interceptions: 'int', goalsallowed: 'gc',
    goalsconceded: 'gc', shotsfaced: 'sotf', shotsontargetfaced: 'sotf', fouled: 'fd', foulsdrawn: 'fd', offsides: 'off'},
};
// NFL stats read as a set of words, so "Rush + Rec Yds" and "Rushing +
// Receiving Yards" agree.
const NFL_WORDS = {passing: 'pass', pass: 'pass', thrown: 'pass', rushing: 'rush', rush: 'rush', receiving: 'rec', rec: 'rec',
  yards: 'yds', yard: 'yds', yds: 'yds', yd: 'yds', touchdowns: 'td', touchdown: 'td', tds: 'td', td: 'td', attempts: 'att',
  attempt: 'att', att: 'att', completions: 'cmp', completion: 'cmp', comp: 'cmp', cmp: 'cmp', interceptions: 'int', ints: 'int',
  int: 'int', receptions: 'receptions', reception: 'receptions', catches: 'receptions', longest: 'longest', long: 'longest',
  fantasy: 'fantasy', score: '', points: 'points', kicking: 'kicking', fg: 'fg', field: 'fg', goal: '', goals: '', made: 'made',
  sacks: 'sacks', sack: 'sacks', tackles: 'tackles', tackle: 'tackles', solo: 'solo', assists: '', ast: '', and: '', plus: '',
  total: '', player: '', carries: 'att rush', taken: 'taken', percentage: 'pct', pct: 'pct', first: 'first', fumbles: 'fumbles',
  lost: 'lost', punts: 'punts', targets: 'targets', pat: 'pat', interception: 'int'};
const MLB_EXTRA = {hrr: 'hitsrunsrbis', hrrbi: 'hitsrunsrbis', hitsrunsrbi: 'hitsrunsrbis', hitsrunsrunsbattedin: 'hitsrunsrbis',
  hitsrunsandrbis: 'hitsrunsrbis', ks: 'pitcherstrikeouts', k: 'pitcherstrikeouts', pitcherks: 'pitcherstrikeouts',
  strikeoutsk: 'pitcherstrikeouts', tb: 'totalbases', bases: 'totalbases', hr: 'homeruns', homerun: 'homeruns', rbi: 'rbis',
  runsbattedin: 'rbis', er: 'earnedrunsallowed', earnedrunsgiven: 'earnedrunsallowed', bb: 'walks', basesonballs: 'walks',
  hitterfantasy: 'hitterfantasyscore', pitcherfantasy: 'pitcherfantasyscore', outspitched: 'pitchingouts', pitchesthrownpitcher: 'pitchesthrown'};
// A hitter's stat that means something else for a pitcher.
const MLB_PITCHER = {strikeouts: 'pitcherstrikeouts', walks: 'walksallowed', hits: 'hitsallowed', runs: 'runsallowed',
  homeruns: 'homerunsallowed', hitterfantasyscore: 'pitcherfantasyscore', fantasyscore: 'pitcherfantasyscore', fantasy: 'pitcherfantasyscore'};

const family = sport => sport === 'nba' || sport === 'wnba' ? 'basketball' : sport;
// "1+ Hits" and "Hits 1+" read as "Hits".
const bare = text => String(text || '').replace(/^\s*\d+(?:\.\d+)?\s*\+\s*/, '').replace(/\s*\d+(?:\.\d+)?\s*\+\s*$/, '')
  .replace(/\((?:combo|pitcher|batter|hitter)\)/gi, match => /pitcher/i.test(match) ? ' pitcher' : '').trim();

function mlbKeys(text) {
  const clean = bare(text);
  const key = squash(clean);
  const found = finderMarket(clean) || finderMarket(MLB_EXTRA[key] || '');
  if (!found) return [];
  const own = `${found.pitcher ? 'p' : 'h'}:${found.key}`;
  // Plain "Strikeouts" on a pitcher's slip is his strikeouts thrown.
  const other = !found.pitcher && !/pitch|allow|hitter|batter/.test(key) ? finderMarket(MLB_PITCHER[squash(found.label)] || MLB_PITCHER[key] || '') : null;
  return other ? [own, `p:${other.key}`] : [own];
}

/** The MLB markets a stat can be, best first ("Strikeouts": a hitter's, then a pitcher's). */
export function mlbMarkets(text) {
  const clean = bare(text);
  const key = squash(clean);
  const found = finderMarket(clean) || finderMarket(MLB_EXTRA[key] || '');
  if (!found) return [];
  const other = !found.pitcher && !/pitch|allow|hitter|batter/.test(key) ? finderMarket(MLB_PITCHER[squash(found.label)] || MLB_PITCHER[key] || '') : null;
  return other ? [found, other] : [found];
}

function nflKey(text) {
  const key = squash(bare(text));
  if (WHOLE.nfl[key]) return WHOLE.nfl[key].split('+').sort().join('+');
  const words = String(bare(text)).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ')
    .flatMap(word => (NFL_WORDS[word] ?? word).split(' ')).filter(Boolean);
  const set = new Set(words);
  // Only receivers are targeted: "Rec Targets" is "Targets".
  if (set.has('targets')) set.delete('rec');
  return [...set].sort().join('+');
}

/** The keys a stat can match on, best first (more than one where a word is ambiguous). */
export function statKeys(sport, text) {
  if (!text) return [];
  if (sport === 'mlb') return mlbKeys(text);
  if (sport === 'nfl') {
    const key = nflKey(text);
    // A quarterback's "Interceptions" and "Attempts" are thrown ones.
    const more = key === 'int' ? ['int+pass'] : key === 'att' ? ['att+pass', 'att+rush'] : key === 'yds' ? [] : [];
    return key ? [key, ...more] : [];
  }
  const fam = family(sport);
  const whole = WHOLE[fam]?.[squash(bare(text))];
  if (whole) return [whole.split('+').sort().join('+')];
  const parts = bare(text).split(/\s*(?:\+|&|\band\b)\s*/i).map(part => squash(part)).filter(Boolean);
  if (!parts.length) return [];
  const atoms = parts.map(part => PARTS[fam]?.[part] || part);
  return [[...new Set(atoms)].sort().join('+')];
}

/** The key of the stat on one of the Finder's lines. */
export function rowStatKey(row) {
  if (row.sport === 'mlb') return mlbKeys(row.raw?.stat || row.market || row.stat)[0] || null;
  return statKeys(row.sport, row.market || row.stat)[0] || null;
}

// ---------------------------------------------------------------- players

const SUFFIX = /\b(jr|sr|ii|iii|iv|v)\b\.?/g;
export const personKey = name => String(name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[.'’`]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(SUFFIX, ' ').replace(/\s+/g, ' ').trim();

function distance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let previous = Array.from({length: b.length + 1}, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    previous = current;
  }
  return previous[b.length];
}

/** How well a slip's name fits a player: 3 exact, 2 initial + surname, 1 a small misspelling, 0 none. */
export function nameFit(slipName, playerName) {
  const a = personKey(slipName), b = personKey(playerName);
  if (!a || !b) return 0;
  if (a === b || a.replace(/ /g, '') === b.replace(/ /g, '')) return 3;
  const as = a.split(' '), bs = b.split(' ');
  const lastA = as.at(-1), lastB = bs.at(-1);
  if (lastA === lastB && as[0][0] === bs[0][0] && (as[0].length === 1 || bs[0].length === 1 || as[0].startsWith(bs[0]) || bs[0].startsWith(as[0]))) return 2;
  if (a.length >= 8 && distance(a.replace(/ /g, ''), b.replace(/ /g, '')) <= 2) return 1;
  return 0;
}

/** The rows that are this leg's player: the best name fit, team breaking ties. */
export function playerRows(leg, rows) {
  let best = 0, found = [];
  for (const row of rows) {
    const fit = nameFit(leg.player, row.player);
    if (!fit || fit < best) continue;
    if (fit > best) { best = fit; found = []; }
    found.push(row);
  }
  if (leg.team && found.length) {
    const team = found.filter(row => String(row.teamAbbr || row.team || '').toUpperCase() === leg.team);
    if (team.length) found = team;
  }
  // Several people of one name: keep the one this leg's sport names.
  const people = new Set(found.map(row => `${row.sport}:${row.playerId || personKey(row.player)}`));
  if (people.size > 1 && leg.sport) found = found.filter(row => row.sport === leg.sport);
  return found;
}

// ---------------------------------------------------------------- lines

/** The board's lines for this leg's player and stat. */
export function statRows(leg, rows) {
  const sport = rows[0]?.sport || leg.sport;
  const wanted = [...statKeys(sport, leg.stat), ...statKeys(sport, leg.statName)];
  for (const key of wanted) {
    const found = rows.filter(row => rowStatKey(row) === key);
    if (found.length) return found;
  }
  return [];
}

const SEASON_START = sport => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = {nfl: 8, nba: 9, nhl: 9, mlb: 2, wnba: 4, soccer: 7}[sport] ?? 0;
  return new Date(Date.UTC(now.getUTCMonth() >= month ? year : year - 1, month, 1)).toISOString().slice(0, 10);
};

/**
 * One of the board's lines moved to the slip's number: its windows worked
 * out again from the player's games, and book prices dropped (they were for
 * the board's number). `enrich` (the sport's history loader) re-scores it
 * exactly; without one, the last games kept on the line are used.
 */
export async function relined(row, line, {enrich, signal} = {}) {
  const clone = {...row, id: `${row.id}|at:${line}`, line, apps: (row.apps || []).filter(app => app.key === 'prizepicks').map(app => ({...app, over: null, under: null})),
    diff: null, average: null, windows: null, streak: null, modifier: 'standard', relinedFrom: row.line};
  if (enrich) {
    try {
      const [scored] = await enrich([{...clone, historyStatus: 'pending', historyRefresh: false}], {signal, concurrency: 1});
      if (scored?.historyStatus === 'ready') return {...scored, id: clone.id, apps: clone.apps, modifier: 'standard', relinedFrom: row.line};
    } catch (error) { if (error.name === 'AbortError') throw error; }
  }
  const games = row.gameLog || [];
  const values = games.map(game => game.value);
  const since = SEASON_START(row.sport);
  const windows = Object.fromEntries([5, 10, 15, 20].map(size => [`l${size}`, finderWindow(values.slice(-size), line, 'OVER')]));
  windows.season = finderWindow(games.filter(game => !game.date || game.date >= since).map(game => game.value), line, 'OVER');
  windows.h2h = finderWindow(games.filter(game => row.opponent && game.opponent === row.opponent).map(game => game.value), line, 'OVER');
  const average = windows.l10.average;
  return {...clone, windows, average, diff: average == null ? null : average - line, historyStatus: games.length ? 'ready' : 'none'};
}

/**
 * Where a leg stands against the board: {state, sport, rows, board, line}.
 * state: 'ready' (graded on the board's own line), 'relined' (the player's
 * games re-scored at the slip's number), 'player' (not on any board),
 * 'stat' (player found, stat not offered), 'needs' (line or side unread).
 */
export function locate(leg, boards) {
  const sports = leg.sport ? (leg.sport === 'nba' || leg.sport === 'wnba' ? [leg.sport, leg.sport === 'nba' ? 'wnba' : 'nba'] : [leg.sport]) : SLIP_SPORTS;
  let people = [];
  for (const sport of sports) {
    people = playerRows(leg, boards[sport] || []);
    if (people.length) break;
  }
  if (!people.length && leg.sport) {
    // The sport may have been misread: look everywhere else.
    people = playerRows({...leg, sport: null}, SLIP_SPORTS.filter(sport => !sports.includes(sport)).flatMap(sport => boards[sport] || []));
  }
  if (!people.length) return {state: 'player'};
  const sport = people[0].sport;
  const lines = statRows(leg, people);
  const base = {sport, people, player: people[0]};
  if (!lines.length) return {...base, state: 'stat'};
  if (leg.line == null || !leg.side) return {...base, lines, state: 'needs'};
  const modifier = leg.modifier || 'standard';
  const exact = lines.find(row => row.line === leg.line && (row.modifier || 'standard') === modifier)
    || lines.find(row => row.line === leg.line && (modifier === 'standard' ? (row.modifier || 'standard') === 'standard' : true))
    || (modifier === 'standard' ? null : lines.find(row => row.line === leg.line));
  if (exact) return {...base, lines, board: exact, state: 'ready'};
  const standard = lines.filter(row => (row.modifier || 'standard') === 'standard');
  const near = (standard.length ? standard : lines).slice().sort((a, b) => Math.abs(a.line - leg.line) - Math.abs(b.line - leg.line))[0];
  return {...base, lines, board: near, state: 'relined'};
}

// ---------------------------------------------------------------- grading

const implied = odds => !finite(odds) ? null : odds < 0 ? -odds / (-odds + 100) : 100 / (odds + 100);
const decimal = odds => !finite(odds) ? null : odds < 0 ? 1 + 100 / -odds : 1 + odds / 100;

// What a pick is worth, in one word, from the best to the one to stay off.
export const TIERS = {
  elite: {label: 'Elite', rank: 5, text: 'A great matchup and the numbers behind it'},
  strong: {label: 'Strong', rank: 4, text: 'A good matchup and the numbers back it'},
  lean: {label: 'Lean', rank: 3, text: 'A small edge, nothing special in the matchup'},
  risky: {label: 'Risky', rank: 2, text: 'A tough matchup or about a coin flip'},
  fade: {label: 'Fade', rank: 1, text: 'The matchup and the numbers point the other way'},
};

// The chance a line needs to be worth taking: 50% for a regular line, the
// books' (or a usual) price for a Goblin or Demon.
const baselineOf = read => (read.modifier || 'standard') === 'standard' ? 0.5 : read.book ?? (read.modifier === 'goblin' ? 0.7 : 0.35);

/**
 * A pick's tier, matchup first: Elite needs a great matchup with something
 * known about the opponent, Strong a good one, and a tough matchup is
 * Risky at best however good his last ten look.
 */
export function tierOf(read) {
  if (!read) return null;
  const edge = read.chance - baselineOf(read);
  const score = read.matchup?.score ?? 50;
  if (read.matchup?.primary && score >= 68 && edge >= 0.08) return 'elite';
  if (score >= 56 && edge >= 0.04) return 'strong';
  if (score < 35 || edge < -0.04) return 'fade';
  if (score < 45 || edge < 0.01) return 'risky';
  return 'lean';
}

/**
 * A read judged on its matchup: the case for it (slip-matchup.js), its
 * chance with the matchup counting most and the recent games after
 * (`trendChance` keeps the games-only read), and its tier.
 */
export function judge(read, tables = {}) {
  if (!read) return null;
  const matchup = matchupCase({row: read.row, side: read.side, grade: read}, tables);
  const base = baselineOf(read);
  // A bigger role than his recent games (a backup starting) leaves those
  // games little to say (slip-games.js).
  const role = matchup?.facts?.some(item => item.level === 'role');
  const trend = role ? 0.15 : matchup?.primary ? 0.45 : 0.7;
  const chance = matchup ? Math.min(0.95, Math.max(0.05, base + trend * (read.chance - base) + 0.18 * (matchup.score - 50) / 50)) : read.chance;
  const judged = {...read, trendChance: read.chance, chance, matchup};
  // The news caps it: out is a Fade, Doubtful or out of the lineup Risky at
  // best, Questionable never Elite (slip-games.js).
  const cap = newsCap(matchup?.facts);
  const tier = tierOf(judged);
  return {...judged, tier: cap && TIERS[cap].rank < TIERS[tier].rank ? cap : tier, capped: cap && TIERS[cap].rank < TIERS[tier].rank ? cap : null};
}

/** A located leg graded: the matchup and the Smart Slip read, plus what the slip itself said. */
export function gradeLeg(leg, row, tables = {}) {
  if (!row || !leg.side) return null;
  const read = assessLeg(row, leg.side, {any: true, started: true});
  if (!read) return null;
  const judged = judge(read, tables);
  return {...judged, implied: implied(leg.odds), edge: leg.odds != null ? judged.chance - implied(leg.odds) : null};
}

/**
 * A grade judged again on a changed row (its game's news, say): the same
 * read of his recent games, the matchup case and the caps redone.
 */
export function regrade(grade, row, tables = {}) {
  if (!grade || !row) return grade;
  const judged = judge({...grade, chance: grade.trendChance ?? grade.chance, row}, tables);
  return {...judged, implied: grade.implied, edge: grade.implied != null ? judged.chance - grade.implied : null};
}

// The parlay's letter, from what it returns per $1 over time.
const LETTERS = [[1.35, 'A+'], [1.2, 'A'], [1.1, 'A-'], [1.02, 'B+'], [0.95, 'B'], [0.88, 'B-'], [0.8, 'C+'], [0.7, 'C'], [0.55, 'D']];
const letterFor = value => (LETTERS.find(([floor]) => value >= floor) || [0, 'F'])[1];

/**
 * The parlay as one: its chance, payout, worth and letter, the picks that
 * carry it and the one that holds it back. A pick that couldn't be graded
 * counts as a coin flip until it is (`partial`).
 */
export function scoreEntry(legs, {app, entry} = {}) {
  const graded = legs.filter(leg => leg.grade);
  const n = legs.length;
  if (!graded.length) return null;
  const complete = graded.length === n;
  const chances = legs.map(leg => leg.grade?.chance ?? 0.5);
  const independent = chances.reduce((product, value) => product * value, 1);
  // Picks from one game rise and fall together (slip-correlation.js).
  const pairs = links(legs.map(leg => leg.grade && leg.row ? {row: leg.row, side: leg.side, player: leg.row.player || leg.player} : null));
  const chance = jointChance(chances, pairs);
  let multiplier = entry?.multiplier ?? null, estimated = false;
  const type = entry?.type || (app?.key === 'prizepicks' ? 'power' : null);
  if (multiplier == null && app?.key === 'prizepicks' && type === 'power' && POWER[n]) {
    multiplier = POWER[n] * graded.reduce((product, leg) => product * (leg.grade.factor || 1), 1);
    estimated = graded.some(leg => leg.grade.modifier !== 'standard');
  }
  if (multiplier == null && legs.every(leg => finite(leg.odds))) multiplier = legs.reduce((product, leg) => product * decimal(leg.odds), 1);
  // No payout on the slip: a pick'em Power Play of this size is assumed.
  let assumed = false;
  if (multiplier == null && type !== 'flex' && POWER[n]) { multiplier = POWER[n]; assumed = true; }
  let value = multiplier ? chance * multiplier : null;
  if (type === 'flex' && FLEX[n]) {
    // Flex pays on all but one or two, so its worth counts those too.
    let dist = [1];
    for (const p of chances) {
      const next = new Array(dist.length + 1).fill(0);
      dist.forEach((q, k) => { next[k] += q * (1 - p); next[k + 1] += q * p; });
      dist = next;
    }
    // Correlated picks shift chance between all hitting and missing one.
    const extra = dist[n] * (chance / independent - 1);
    dist[n] += extra;
    dist[n - 1] = Math.max(0, dist[n - 1] - extra);
    const scale = entry?.multiplier ? entry.multiplier / FLEX[n][n] : 1;
    value = Object.entries(FLEX[n]).reduce((sum, [k, pay]) => sum + dist[Number(k)] * pay * scale, 0);
    multiplier = FLEX[n][n] * scale;
  }
  const byChance = graded.slice().sort((a, b) => a.grade.chance - b.grade.chance);
  const weakest = byChance[0];
  const best = byChance.at(-1);
  const average = graded.reduce((sum, leg) => sum + leg.grade.chance, 0) / graded.length;
  // Without a payout, the letter reads the picks themselves (55% a pick is
  // about what a pick'em slip needs to break even).
  const worth = value ?? (average / 0.55) ** Math.min(n, 4);
  const tiers = Object.fromEntries(Object.keys(TIERS).map(key => [key, graded.filter(leg => leg.grade.tier === key).length]));
  // Picks from one game rise and fall together.
  const games = new Map();
  for (const leg of graded) {
    const key = leg.grade.game;
    if (key && !/:$|:-?:/.test(key)) games.set(key, (games.get(key) || 0) + 1);
  }
  const shared = [...games.values()].filter(count => count > 1).reduce((sum, count) => sum + count, 0);
  const matchups = {good: graded.filter(leg => leg.grade.matchup?.score >= 60).length,
    tough: graded.filter(leg => leg.grade.matchup && leg.grade.matchup.score < 45).length,
    known: graded.filter(leg => leg.grade.matchup?.primary).length};
  const linked = pairs.filter(pair => Math.abs(pair.rho) >= 0.08)
    .map(pair => ({...pair, players: [legs[pair.a].row?.player || legs[pair.a].player, legs[pair.b].row?.player || legs[pair.b].player]}));
  return {chance, independent, links: linked, multiplier, estimated, assumed, value, breakEven: multiplier ? 1 / multiplier : null, weakest, best, average,
    letter: letterFor(worth), score: Math.max(4, Math.min(100, Math.round(worth * 70))), tiers, shared, matchups, partial: !complete,
    graded: graded.length, total: n, type};
}

/** Plain words for the parlay's grade. */
export function verdict(score) {
  if (!score) return '';
  const {letter, chance, multiplier, value, total, partial, assumed} = score;
  const odds = Math.max(1, Math.round(1 / chance));
  const often = odds <= 1 ? 'most of the time' : `about 1 in ${odds} times`;
  const head = letter.startsWith('A') ? 'A strong parlay.' : letter.startsWith('B') ? 'A playable parlay.'
    : letter.startsWith('C') ? 'A long shot for the price.' : 'The payout doesn\'t cover the risk.';
  const tail = partial ? ' Picks that couldn\'t be graded count as coin flips.' : '';
  if (value != null && multiplier) {
    const pays = `${assumed ? 'a usual ' : ''}${Number(multiplier.toFixed(2))}x`;
    const worth = value >= 1 ? `it returns about $${value.toFixed(2)} per $1 over time` : `it returns about ${Math.round(value * 100)}¢ per $1 over time`;
    return `${head} All ${total} hit ${often}, and at ${pays} ${worth}.${tail}`;
  }
  return `${head} All ${total} hit ${often}.${tail}`;
}

/** Better picks to swap in for a weak leg: backed reads from the boards, other players. */
export function swaps(legs, pool, {limit = 3} = {}) {
  const taken = new Set(legs.map(leg => personKey(leg.player)));
  const weakest = legs.filter(leg => leg.grade).sort((a, b) => a.grade.chance - b.grade.chance)[0];
  if (!weakest || weakest.grade.chance >= 0.58) return [];
  const sports = new Set(legs.map(leg => leg.sport).filter(Boolean));
  // Judged on their matchups (judge()), only Strong and Elite picks are offered.
  return pool.filter(read => (read.tier ? read.tier === 'elite' || read.tier === 'strong' : read.backed)
      && read.chance > weakest.grade.chance + 0.05 && !taken.has(personKey(read.player))
      && (!sports.size || sports.has(read.row.sport)) && read.modifier === 'standard')
    .sort((a, b) => b.chance - a.chance).slice(0, limit).map(read => ({...read, replaces: weakest}));
}

export const sideWord = (side, app) => {
  const pickem = !app || ['prizepicks', 'pick6', 'betr', 'dabble', 'chalkboard', 'parlayplay'].includes(app.key);
  if (app?.key === 'underdog') return side === 'UNDER' ? 'Lower' : 'Higher';
  return side === 'UNDER' ? (pickem ? 'Less' : 'Under') : (pickem ? 'More' : 'Over');
};

/**
 * A leg from the screenshot, checked: located on the boards, its hit rates
 * filled in if the board didn't have them yet, re-scored at the slip's own
 * number when that differs, and graded. `enrichFor(sport)` is the sport's
 * history loader (finder-pool.js ENRICH). A player who isn't on the board
 * (his game has started, or his stat isn't posted) is found through
 * `lookup(leg, sports)` (slip-lookup.js) and graded from his own games:
 * state 'history'.
 */
export async function checkLeg(read, boards, {enrichFor = () => null, lookup = null, sports = SLIP_SPORTS, tables = {}, signal} = {}) {
  // A side that couldn't be read is taken as More (the usual pick, and the
  // only one on a Goblin or Demon) and flagged, so the parlay still grades.
  const assumedSide = !read.side && read.line != null;
  const leg = assumedSide ? {...read, side: 'OVER', assumedSide} : read;
  const spot = locate(leg, boards);
  const base = {...leg, spot, state: spot.state, sport: spot.sport || leg.sport, row: spot.board || spot.player || null, grade: null};
  if ((spot.state === 'player' || spot.state === 'stat') && lookup && (leg.stat || leg.statName || spot.state === 'player')) {
    const known = spot.player;
    const where = known ? [known.sport] : leg.sport ? [leg.sport] : sports;
    let found = null;
    try {
      found = await lookup(known ? {...leg, player: known.player, team: known.teamAbbr || leg.team, sport: known.sport} : leg, where);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      return {...base, lookupError: error.message || 'Player data is unavailable right now.'};
    }
    if (!found) return base;
    const row = withMatchups(known ? {...found, headshot: found.headshot || known.headshot, teamLogo: found.teamLogo || known.teamLogo,
      opponent: found.opponent || known.opponent, startsAt: found.startsAt || known.startsAt} : found, tables);
    if (leg.line == null || !leg.side) return {...base, sport: row.sport, row, state: 'needs'};
    const grade = gradeLeg(leg, row, tables);
    return {...base, sport: row.sport, row, grade, state: grade ? 'history' : 'thin'};
  }
  if (spot.state !== 'ready' && spot.state !== 'relined') return base;
  const enrich = enrichFor(spot.sport);
  let row = spot.board;
  if (spot.state === 'ready' && enrich && row.historyStatus !== 'ready') {
    try {
      const [scored] = await enrich([{...row, historyStatus: 'pending'}], {signal, concurrency: 1});
      if (scored) row = scored;
    } catch (error) { if (error.name === 'AbortError') throw error; }
  }
  if (spot.state === 'relined') row = await relined(spot.board, leg.line, {enrich, signal});
  row = withMatchups(row, tables);
  const grade = gradeLeg(leg, row, tables);
  return {...base, row, grade, state: grade ? spot.state : 'thin'};
}

/** The stats the board offers for a leg's player, for fixing a misread stat. */
export function offeredStats(spot) {
  const seen = new Map();
  for (const row of spot?.people || []) if (!seen.has(rowStatKey(row))) seen.set(rowStatKey(row), row.market);
  return [...seen.values()].filter(Boolean).sort();
}
