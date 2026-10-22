// The NFL matchup score: how good this game is for a stat, 0-100 for the
// over (50 an even matchup). One function for the Props list, the player
// page, the Slip Analyzer, the Parlay Builder and the assistant.
//
// Built from a backtest, not a feel: every 2024 and 2025 regular-season
// player-game with a real role, each scored with only what was known before
// kickoff, against whether he beat his own average (the season so far, last
// season worth three games of it). What held up out of sample, a season at a
// time, is all it reads, weighted by how much it predicted:
//
//   vs his position   what the defense allows his position in the stat
//                     (/api/nfl?resource=finder-league dvp), counted
//                     g/(g+4) while it has played only g games: six games
//                     is too few to trust an extreme
//   their defense     what it allows every offense in the stat (for a back's
//                     catches this predicted far better than what it allows
//                     backs)
//   game script       the spread (league.slate): a favorite runs more and
//                     throws less, an underdog the reverse
//   team scoring      the points the line expects his team to score: the
//                     one read that predicts touchdowns
//   his role          his share of his team's targets (receivers) or
//                     carries (backs) a game (league.usage)
//
// What didn't hold up isn't read: a wide receiver's matchup barely mattered
// in either season (his score stays near 50 unless his role is big), the
// defense's touchdowns allowed didn't predict touchdowns, and nothing
// predicted a quarterback's rushing or passing TDs (those stay close to even).
//
// The reads add up points (a read's weight times how far it sits from the
// league's average, in spreads, held to 3), and the total moves the score
// from 50 along 50 + 50 tanh(points / 50). The weights are the backtest's
// log-odds times 140, a scale that puts about 2.5% of props at 90 or more:
// scored on the season it wasn't fitted on, those beat their own average 7
// points more often than usual, 75-90 about 3 points, 40-60 even, under 40
// 3-4 points less (tests/nfl-matchup-score.test.mjs).
import {band} from './nba-matchup-score.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// Points per spread, by family: the backtest's log-odds x 140.
export const WEIGHTS = {
  passVolume: {position: 16, defense: 16, script: -17},
  passTds: {position: 7, defense: 7},
  qbRush: {position: 7},
  rbRush: {position: 27, script: 14, role: 17},
  rbRec: {position: 8, defense: 45},
  wrRec: {defense: 11, role: 5},
  teRec: {position: 22, defense: 19},
  tds: {scoring: 42},
};
// A defense's numbers count g/(g + SHRINK) after g games.
export const SHRINK = 4;
// The league's spreads for the game and role reads: a team's points (4.5),
// the spread (6), a target share (7 points around 20%), a carry share (18
// around 45%).
const SCALES = {scoring: [22.5, 4.5], script: [0, 6], targets: [0.20, 0.07], carries: [0.45, 0.18]};

// What each market reads: the position group's stats (a combo's parts are
// averaged) and the defense's overall stat.
const READS = {
  passing_yards: {parts: ['passing_yards'], team: 'passing_yards'},
  passing_touchdowns: {parts: ['passing_tds'], team: 'passing_tds'},
  pass_completions: {parts: ['completions'], team: 'completions'},
  passing_attempts: {parts: ['attempts'], team: 'attempts'},
  passing_rushing_yards: {parts: ['passing_yards', 'rushing_yards'], team: 'passing_yards'},
  rushing_yards: {parts: ['rushing_yards'], team: 'rushing_yards'},
  rush_attempts: {parts: ['carries'], team: 'carries'},
  receptions: {parts: ['receptions'], team: 'receptions'},
  targets: {parts: ['targets'], team: 'targets'},
  receiving_yards: {parts: ['receiving_yards'], team: 'receiving_yards'},
  rushing_receiving_yards: {parts: ['rush_rec_yards'], fallback: ['rushing_yards', 'receiving_yards'], team: 'rush_rec_yards'},
  touchdowns: {parts: ['rush_rec_tds'], team: 'rush_rec_tds'},
  rushing_tds: {parts: ['rushing_tds'], team: 'rush_rec_tds'},
  receiving_tds: {parts: ['receiving_tds'], team: 'rush_rec_tds'},
};
export const NFL_MARKETS = Object.keys(READS);
const TDS = new Set(['touchdowns', 'rushing_tds', 'receiving_tds']);
const PASS_VOLUME = new Set(['passing_yards', 'pass_completions', 'passing_attempts']);
const CATCHING = new Set(['receptions', 'targets', 'receiving_yards']);
/** Which weights a market reads at a position; a combo reads two families, averaged. */
export function familiesOf(marketKey, group) {
  if (TDS.has(marketKey)) return ['tds'];
  if (group === 'QB') {
    if (PASS_VOLUME.has(marketKey)) return ['passVolume'];
    if (marketKey === 'passing_touchdowns') return ['passTds'];
    if (marketKey === 'passing_rushing_yards') return ['passVolume', 'qbRush'];
    return ['qbRush'];
  }
  const catching = group === 'WR' ? 'wrRec' : group === 'TE' ? 'teRec' : 'rbRec';
  if (CATCHING.has(marketKey)) return [catching];
  if (marketKey === 'rushing_receiving_yards') return group === 'RB' ? ['rbRush', 'rbRec'] : [catching];
  return ['rbRush'];
}

const WORDS = {passing_yards: 'passing yards', passing_tds: 'passing TDs', completions: 'completions', attempts: 'pass attempts',
  rushing_yards: 'rushing yards', carries: 'carries', receptions: 'catches', targets: 'targets', receiving_yards: 'receiving yards',
  rush_rec_yards: 'rushing + receiving yards', rush_rec_tds: 'touchdowns', rushing_tds: 'rushing TDs', receiving_tds: 'receiving TDs'};
const GROUPS = {QB: 'quarterbacks', RB: 'running backs', WR: 'receivers', TE: 'tight ends'};
/** His position group: QB, RB (a fullback with them), WR or TE. */
export const positionOf = row => {
  const position = String(row?.position || '').toUpperCase();
  return position === 'FB' || position === 'HB' ? 'RB' : GROUPS[position] ? position : null;
};

/** How far a value sits from the league's average in spreads, held between -3 and 3; null with fewer than 8 teams. */
function spreads(value, values) {
  const known = values.filter(finite);
  if (!finite(value) || known.length < 8) return null;
  const average = mean(known), spread = Math.sqrt(mean(known.map(item => (item - average) ** 2)));
  return spread > 0 ? clamp((value - average) / spread, -3, 3) : 0;
}
// "3rd most" / "5th fewest": rank 1 allows the least.
function place(rank, count) {
  if (!finite(rank) || !count) return '';
  return rank > count / 2 ? `${ordinal(count - rank + 1)} most` : `${ordinal(rank)} fewest`;
}
const curve = total => 50 + 50 * Math.tanh(total / 50);
const scaled = (value, [center, spread]) => clamp((value - center) / spread, -3, 3);
// How much a defense's numbers count after g games (all of them with no count to go on).
const trust = games => finite(games) && games > 0 ? games / (games + SHRINK) : 1;
const weighted = (families, key) => mean(families.map(family => WEIGHTS[family][key] || 0));

function positionRead(row, league, read, group, weight) {
  const table = league?.dvp || {};
  const cell = key => table[row.opponent]?.[group]?.stats?.[key]?.szn;
  const keys = read.parts.every(key => cell(key)) ? read.parts : read.fallback?.every(key => cell(key)) ? read.fallback : null;
  if (!keys) return null;
  const parts = keys.map(key => {
    const [value, rank] = cell(key);
    const soft = spreads(value, Object.values(table).map(team => team?.[group]?.stats?.[key]?.szn?.[0]));
    return soft == null ? null : {key, value, rank, soft};
  });
  if (parts.some(part => !part)) return null;
  const count = Object.keys(table).length;
  const soft = mean(parts.map(part => part.soft)) * trust(table[row.opponent]?.[group]?.games);
  const said = parts.map(part => `${one(part.value)} ${WORDS[part.key]} (${place(part.rank, count)})`);
  return {key: `position-${keys.join('+')}`, kind: 'position', soft, raw: weight * soft,
    text: `${row.opponent} allows ${GROUPS[group]} ${said.join(' and ')} a game`};
}

function defenseRead(row, league, read, group, weight) {
  const stats = league?.teamStats || {};
  const cell = stats[row.opponent]?.def?.[read.team];
  if (!cell || !weight) return null;
  const [value, rank] = cell;
  const soft = spreads(value, Object.values(stats).map(team => team?.def?.[read.team]?.[0]));
  if (soft == null) return null;
  const shrunk = soft * trust(league?.dvp?.[row.opponent]?.[group]?.games);
  return {key: `defense-${read.team}`, kind: 'defense', soft: shrunk, raw: weight * shrunk,
    text: `${row.opponent} allows ${one(value)} ${WORDS[read.team]} a game to every offense (${place(rank, Object.keys(stats).length)})`};
}

// The game's line, from his side: favored by favBy, expected to score implied.
function gameOf(row, league) {
  const game = league?.slate?.[row.teamAbbr];
  return game && finite(game.favBy) && finite(game.implied) ? game : null;
}

function scriptRead(row, league, weight, families) {
  const game = gameOf(row, league);
  if (!game || !weight || Math.abs(game.favBy) < 1) return null;
  const soft = scaled(game.favBy, SCALES.script);
  const ahead = game.favBy > 0, side = `${row.teamAbbr} are ${one(Math.abs(game.favBy))}-point ${ahead ? 'favorites' : 'underdogs'}`;
  const why = families.includes('passVolume') ? (ahead ? 'a team ahead throws less' : 'a team behind throws more')
    : ahead ? 'a team ahead leans on the run' : 'a team behind runs less';
  return {key: 'script', kind: 'game', soft, raw: weight * soft, text: `${side}: ${why}`};
}

function scoringRead(row, league, weight) {
  const game = gameOf(row, league);
  if (!game || !weight) return null;
  const soft = scaled(game.implied, SCALES.scoring);
  const slate = Object.values(league.slate || {}).map(item => item?.implied).filter(finite).sort((a, b) => b - a);
  const rank = slate.indexOf(game.implied) + 1;
  const where = rank && slate.length > 1 ? ` (${rank <= slate.length / 2 ? `${ordinal(rank)} most` : `${ordinal(slate.length - rank + 1)} fewest`} this week)` : '';
  return {key: 'scoring', kind: 'game', soft, raw: weight * soft,
    text: `${row.teamAbbr} are expected to score ${one(game.implied)} points${where}, a ${one(game.total)}-point total`};
}

function roleRead(row, league, weight, families, group) {
  const usage = league?.usage?.[row.playerId];
  const carries = families.includes('rbRush');
  // A back's carries, a receiver's targets: the roles the backtest read.
  if (!usage || !weight || (carries && group !== 'RB')) return null;
  const share = carries ? usage[1] : usage[0];
  if (!finite(share)) return null;
  const soft = scaled(share, carries ? SCALES.carries : SCALES.targets);
  return {key: 'role', kind: 'role', soft, raw: weight * soft,
    text: `He gets ${Math.round(share * 100)}% of ${row.teamAbbr || 'his team'}’s ${carries ? 'carries' : 'targets'} a game`};
}

/**
 * {score, raw, reads} for an NFL line, or null when the opponent's numbers
 * (or the market) aren't there. Each read's `points` is its share of the
 * distance from 50, so they add up to the score.
 */
export function matchupScore(row, league) {
  const read = READS[row?.marketKey], group = positionOf(row);
  if (row?.sport !== 'nfl' || !read || !group || !row.opponent || !league) return null;
  const families = familiesOf(row.marketKey, group);
  // Only quarterbacks pass: what a defense allows them in a passing stat is
  // what it allows every offense, one read carrying both weights.
  const same = group === 'QB' && read.parts.includes(read.team);
  const weight = key => same && key === 'position' ? weighted(families, 'position') + weighted(families, 'defense')
    : same && key === 'defense' ? 0 : weighted(families, key);
  const position = positionRead(row, league, read, group, weight('position'));
  // No score without the defense's numbers at his position.
  if (!position) return null;
  const reads = [position, defenseRead(row, league, read, group, weight('defense')), scriptRead(row, league, weight('script'), families),
    scoringRead(row, league, weight('scoring')), roleRead(row, league, weight('role'), families, group)]
    .filter(item => item && (item.raw !== 0 || item.kind === 'position'));
  const total = reads.reduce((sum, item) => sum + item.raw, 0);
  const score = curve(total);
  return {score: Math.round(clamp(score, 0, 100)), raw: total,
    reads: reads.map(item => ({key: item.key, kind: item.kind, text: item.text, score: Math.round(curve(item.raw)),
      points: Math.round((total ? (score - 50) * item.raw / total : 0) * 10) / 10}))};
}

/** The week's props scored: a Map from row id to {score, label, tone, raw, reads}. */
export function spreadScores(rows, league) {
  const out = new Map();
  for (const row of rows) {
    const found = matchupScore(row, league);
    if (found) out.set(row.id, {...found, ...band(found.score)});
  }
  return out;
}

// The stats a position's page grades, in order.
export const CARD_MARKETS = {
  QB: [['passing_yards', 'PASS YDS'], ['passing_touchdowns', 'PASS TD'], ['pass_completions', 'CMP'], ['rushing_yards', 'RUSH YDS']],
  RB: [['rushing_yards', 'RUSH YDS'], ['rush_attempts', 'CAR'], ['receptions', 'REC'], ['receiving_yards', 'REC YDS'], ['touchdowns', 'TD']],
  WR: [['receiving_yards', 'REC YDS'], ['receptions', 'REC'], ['targets', 'TGT'], ['touchdowns', 'TD']],
  TE: [['receiving_yards', 'REC YDS'], ['receptions', 'REC'], ['targets', 'TGT'], ['touchdowns', 'TD']],
};

/** A player's scores in each of his position's stats (his page). */
export function cardScores(row, league, group = positionOf(row)) {
  return (CARD_MARKETS[group] || []).map(([marketKey, stat]) => {
    const read = matchupScore({...row, marketKey, position: group}, league);
    return read ? {marketKey, stat, score: read.score, ...band(read.score), reads: read.reads} : {marketKey, stat, score: null};
  });
}

export {band};
