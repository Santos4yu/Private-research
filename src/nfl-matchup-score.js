// The NFL matchup score: how good this week's opponent is for a stat, 0-100
// for the over (50 an average matchup), built the way RotoBot grades an NFL
// matchup. Like its grade, it's the same for every player at a position
// against a defense, and it's led by what that defense gives his position
// in the stat (/api/nfl?resource=finder-league dvp: the whole position
// group's total each game -- every receiver's yards added up -- averaged
// over the defense's games), with a light read of what it allows every
// offense in the same stat:
//
//   vs his position   what they allow QBs (backs, receivers, tight ends)
//                     in the stat; a combo reads each part
//   their defense     what they allow overall in the stat
//
// Each read is how far the defense sits from the league's average in
// spreads (standard deviations), the soft side up. Together they move the
// score from 50 along a curve that flattens near the ends (a defense twice
// as soft as the next isn't twice as good a matchup): 50 + 50 tanh(s / 50),
// s = 24 per spread at his position + 4 per spread overall. Fitted to
// RotoBot's week-7 2026 list (tests/nfl-matchup-score.test.mjs): Gibbs's
// touchdowns against Green Bay (2nd most allowed to backs) RotoBot 91, ours
// 87; Golden's receiving yards at Detroit (2nd most to receivers) 84 and 89;
// Stafford's passing TDs at Las Vegas 79 and 78; Skattebo's rushing yards
// at Houston (5th fewest to backs) 25 and 26; Boutte's receiving yards
// against the Giants (6th fewest to receivers) 41 and 30 -- about 10 apart
// on average over ten of its grades. RotoBot also moves some players'
// scores on things it doesn't show (Stroud's passing yards against the
// Giants, 4th fewest allowed, read 82; Jeudy's catches at Tennessee, 4th
// most allowed, 37); those this doesn't try to match.
import {band} from './nba-matchup-score.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1).replace(/\.0$/, '');
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

export const GAINS = {position: 24, defense: 4};
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

function positionRead(row, league, read, group) {
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
  const soft = mean(parts.map(part => part.soft));
  const said = parts.map(part => `${one(part.value)} ${WORDS[part.key]} (${place(part.rank, count)})`);
  return {key: `position-${keys.join('+')}`, kind: 'position', soft, raw: GAINS.position * soft,
    text: `${row.opponent} allows ${GROUPS[group]} ${said.join(' and ')} a game`};
}

function defenseRead(row, league, read) {
  const stats = league?.teamStats || {};
  const cell = stats[row.opponent]?.def?.[read.team];
  if (!cell) return null;
  const [value, rank] = cell;
  const soft = spreads(value, Object.values(stats).map(team => team?.def?.[read.team]?.[0]));
  if (soft == null) return null;
  return {key: `defense-${read.team}`, kind: 'defense', soft, raw: GAINS.defense * soft,
    text: `${row.opponent} allows ${one(value)} ${WORDS[read.team]} a game to every offense (${place(rank, Object.keys(stats).length)})`};
}

/**
 * {score, raw, reads} for an NFL line, or null when the opponent's numbers
 * (or the market) aren't there. Each read's `points` is its share of the
 * distance from 50, so they add up to the score.
 */
export function matchupScore(row, league) {
  const read = READS[row?.marketKey], group = positionOf(row);
  if (row?.sport !== 'nfl' || !read || !group || !row.opponent || !league) return null;
  const reads = [positionRead(row, league, read, group), defenseRead(row, league, read)].filter(Boolean);
  if (!reads.some(item => item.kind === 'position')) return null;
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
