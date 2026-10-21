// The NBA matchup score: how good tonight's opponent is for a stat, 0-100
// for the over (50 an average matchup). It reads the way a scout does: the
// opponent's defense as a whole first, then what it gives his position in
// the stat, then his own games against them.
//
//   their defense    40%  points allowed a game and per 100 possessions
//   their pace       15%  how fast they play: more trips, more of everything
//   vs his position  35%  what they allow guards (forwards, centers) in it
//   his games        10%  his games against them, held against his usual,
//                         trusted by how many there are
//
// Each read is how far the opponent's number sits from the league's
// average, in spreads (standard deviations), from -1 (1.65 spreads or more
// on the tough side: about the league's toughest 5%) to 1 (as far on the
// soft side). Measuring the gap, not the place, lets a defense far worse
// than everyone else read as soft as it gets, while teams bunched near the
// middle stay near 50. The score is the reads' weighted blend, from 0 to
// 100, a read with nothing behind it leaving its share to the others. A
// bad, fast defense lifts every stat, and the stat's own matchup spreads
// them: with every team's numbers spread evenly, a defense with the
// 6th-most points allowed, the 5th-worst rating and the 7th-fastest pace
// scores about 82 for points when it gives guards the 7th-most, and about
// 53 for threes when it holds them to the 3rd-fewest.
//
import {defenseCell, statGameLog} from './unified-finder-data.js';
import {MARKET_STAT, baseMarket} from './sports/wnba/wnba-research.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// Each read's share of the score (of the reads there are).
export const WEIGHTS = {defense: 40, pace: 15, position: 35, fit: 10};
const WORDS = {pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', tpa: 'three-point tries', stl: 'steals', blk: 'blocks',
  bs: 'blocks + steals', pr: 'points + rebounds', pa: 'points + assists', ra: 'rebounds + assists', pra: 'points, rebounds and assists',
  fs: 'fantasy points', fgm: 'field goals', fga: 'shots', ftm: 'free throws', fta: 'free throws', twos: 'twos', twosa: 'twos',
  oreb: 'offensive rebounds', dreb: 'defensive rebounds', to: 'turnovers', pf: 'fouls', dd: 'double-doubles', td: 'triple-doubles'};
const POSITIONS = {G: 'guards', F: 'forwards', C: 'centers'};
// The stats the player page scores side by side.
export const CARD_STATS = [['player_points', 'PTS'], ['player_rebounds', 'REB'], ['player_assists', 'AST'], ['player_threes', '3PM'],
  ['player_steals', 'STL'], ['player_blocks', 'BLK']];

export const BANDS = [[75, 'Strong edge', 'strong'], [60, 'Edge', 'edge'], [40, 'Neutral', 'neutral'], [0, 'Tough', 'tough']];
export function band(score) {
  const [, label, tone] = BANDS.find(([floor]) => score >= floor);
  return {label, tone};
}

const statOf = row => MARKET_STAT[baseMarket(row?.marketKey)] || null;
// A rank's place from -1 to 1. "Least first": rank 1 is the lowest number
// (the fewest allowed, the toughest); "most first": rank 1 is the highest.
const fromLeast = (rank, count) => finite(rank) && count > 1 ? clamp((rank - (count + 1) / 2) / ((count - 1) / 2), -1, 1) : null;
const fromMost = (rank, count) => finite(rank) && count > 1 ? clamp(((count + 1) / 2 - rank) / ((count - 1) / 2), -1, 1) : null;
// How far value sits from the league's numbers, -1 to 1 (FULL spreads or
// more is the end), a higher number the soft side. null when there aren't
// enough teams to measure against.
const FULL = 1.65;
function fromAverage(value, values) {
  const kept = (values || []).filter(finite);
  if (!finite(value) || kept.length < 8) return null;
  const average = mean(kept), spread = Math.sqrt(mean(kept.map(item => (item - average) ** 2)));
  if (!(spread > 0)) return 0;
  const gap = (value - average) / spread;
  return clamp(gap / FULL, -1, 1);
}
const column = (table, read) => Object.values(table || {}).map(read);
// "7th most" / "3rd fewest" from a least-first rank.
function place(rank, count, [low, high] = ['fewest', 'most']) {
  if (!finite(rank) || !count) return '';
  return rank <= Math.ceil(count / 2) ? `${ordinal(rank)} ${low}` : `${ordinal(count - rank + 1)} ${high}`;
}

/** Their defense as a whole: points allowed a game and per 100 possessions. */
function defenseRead(row, league) {
  const allowed = league?.teamStats?.[row.opponent]?.def?.pts, count = league?.teamCount;
  const table = league?.opportunity, rating = table?.teams?.[row.opponent]?.drtg, teams = table?.count || count;
  const parts = [fromAverage(allowed?.[0], column(league?.teamStats, team => team?.def?.pts?.[0])) ?? fromLeast(allowed?.[1], count),
    fromAverage(rating?.[0], column(table?.teams, team => team?.drtg?.[0])) ?? fromMost(rating?.[1], teams)].filter(finite);
  if (!parts.length) return null;
  const words = [finite(allowed?.[0]) && `${row.opponent} gives up ${one(allowed[0])} points a game (${place(allowed[1], count)})`,
    finite(rating?.[0]) && `${one(rating[0])} per 100 possessions (${place(finite(rating[1]) ? teams - rating[1] + 1 : null, teams, ['lowest', 'highest'])})`];
  return {key: 'defense', soft: mean(parts), text: words.filter(Boolean).join(' and ')};
}

/** How fast they play. */
function paceRead(row, league) {
  const table = league?.opportunity, pace = table?.teams?.[row.opponent]?.poss, teams = table?.count || league?.teamCount;
  if (!finite(pace?.[0])) return null;
  const soft = fromAverage(pace[0], column(table.teams, team => team?.poss?.[0])) ?? fromMost(pace[1], teams);
  if (!finite(soft)) return null;
  const where = place(finite(pace[1]) ? teams - pace[1] + 1 : null, teams, ['slowest', 'fastest']);
  return {key: 'pace', soft, text: `${row.opponent} plays at ${one(pace[0])} possessions a game${where ? ` (${where})` : ''}`};
}

/** What they allow his position in the stat (dvp: rank 1 allows the least). */
function positionRead(row, league, stat) {
  const cell = defenseCell(row, league);
  if (!cell || !finite(cell.value)) return null;
  const soft = fromAverage(cell.value, cell.values) ?? fromLeast(cell.rank, league?.teamCount);
  if (!finite(soft)) return null;
  return {key: 'position', soft,
    text: `${row.opponent} allows ${one(cell.value)} ${WORDS[stat] || 'of it'} a game to ${POSITIONS[cell.position] || 'his position'} (${place(cell.rank, league.teamCount)})`};
}

/** His own games against them, against his usual: worth more the more there are. */
function fitRead(row) {
  const games = (row.gameLog || []).filter(game => finite(game.value));
  const theirs = games.filter(game => game.opponent === row.opponent);
  const usual = mean(games.map(game => game.value));
  if (!theirs.length || !(usual > 0)) return null;
  const against = mean(theirs.map(game => game.value)), trust = theirs.length / (theirs.length + 3);
  return {key: 'fit', soft: clamp((against / usual - 1) * 2 * trust, -1, 1),
    text: `${theirs.length} ${theirs.length === 1 ? 'game' : 'games'} against ${row.opponent}: ${one(against)} a game, his usual ${one(usual)}`};
}

/**
 * One prop's matchup: {score, raw, reads}, score 0-100 for the over, each
 * read {key, score (0-100 on its own), text, weight (share of the score)}.
 * null when nothing is known about the opponent's defense.
 */
export function matchupScore(row, league) {
  const stat = statOf(row);
  if (row?.sport !== 'nba' || !stat || !row.opponent || !league) return null;
  const reads = [defenseRead(row, league), paceRead(row, league), positionRead(row, league, stat), fitRead(row)].filter(Boolean);
  if (!reads.some(read => read.key === 'defense' || read.key === 'position')) return null;
  const total = reads.reduce((sum, read) => sum + WEIGHTS[read.key], 0);
  const raw = 50 + 50 * reads.reduce((sum, read) => sum + WEIGHTS[read.key] * read.soft, 0) / total;
  return {score: Math.round(clamp(raw, 0, 100)), raw,
    reads: reads.map(read => ({key: read.key, text: read.text, score: Math.round(50 + 50 * read.soft), weight: Math.round(WEIGHTS[read.key] / total * 100)}))};
}

/** Tonight's props scored: a Map from row id to {score, label, tone, raw, reads}. */
export function spreadScores(rows, league) {
  const out = new Map();
  for (const row of rows) {
    const read = matchupScore(row, league);
    if (read) out.set(row.id, {...read, ...band(read.score)});
  }
  return out;
}

/**
 * A player's scores in each of the card's stats (player page). history is
 * his game-log payload ({rows}), so each stat reads his own games in it the
 * way that stat's line does on the list.
 */
export function cardScores(row, league, history = row.history) {
  return CARD_STATS.map(([marketKey, stat]) => {
    const games = history?.rows?.length ? statGameLog(history, marketKey) : marketKey === row.marketKey ? row.gameLog : [];
    const read = matchupScore({...row, marketKey, gameLog: games}, league);
    if (!read) return {marketKey, stat, score: null};
    return {marketKey, stat, score: read.score, ...band(read.score), reads: read.reads};
  });
}
