// The NBA matchup score: how good tonight's opponent is for a stat, 0-100
// for the over (50 an average matchup), built the way RotoBot grades a
// matchup. Like its grade, it's the same for every player at a position
// against a team (his own games don't move it; they're shown beside it),
// and a combo (points + rebounds...) is the average of its parts.
//
//   their defense    points allowed a game and per 100 possessions
//   their pace       possessions a game
//   vs his position  what they allow guards (forwards, centers) in the stat
//   threes           also the 3-point percentage they allow
//   assists          also the field-goal percentage they allow (made
//                    shots are what passes turn into assists)
//   steals           also how often they turn the ball over
//
// Each read is how far the team sits from the league's average in spreads
// (standard deviations), the soft side up, and moves the score from 50 by
// its gain a spread (GAINS); the total is held between 0 and 100. The
// gains are fitted to RotoBot's grades on two of its pages at once
// (Oct 2026, tests/nba-matchup-score.test.mjs):
//   Dallas, for a forward: 8th most points allowed, 11th highest rating,
//   4th fastest pace; forwards get the 5th most points, 7th most
//   rebounds, 6th most assists. RotoBot 91, 89, 90; these give 91, 89, 91.
//   Indiana, for a guard: 6th most points allowed, 5th highest rating,
//   7th fastest pace; guards get the 3rd most rebounds and 12th most
//   blocks, middling assists, but teams shoot the 4th-highest percentage
//   there. RotoBot rebounds 100, blocks 94, assists 100; these give the
//   same.
// The team's defense and pace set where a matchup starts; the position's
// own number moves it a little. So a soft, fast team is a good matchup in
// almost every stat, and a team far softer than the rest reads 100.
//
import {defenseCell, statGameLog} from './unified-finder-data.js';
import {MARKET_STAT, baseMarket} from './sports/wnba/wnba-research.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// Points a spread each read moves the score (see the top of the file).
export const GAINS = {allowed: 16, rating: 16, pace: 13, position: 7.5, shooting: 12, finishing: 8, turnovers: 12};
// A combo is the average of its parts' scores.
const COMBOS = {pr: ['player_points', 'player_rebounds'], pa: ['player_points', 'player_assists'], ra: ['player_rebounds', 'player_assists'],
  pra: ['player_points', 'player_rebounds', 'player_assists'], bs: ['player_blocks', 'player_steals']};
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

// The normal curve's place for a share p (0-1): Acklam's approximation.
function probit(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - 0.02425) return -probit(1 - p);
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
// How many spreads value sits above the league's numbers (held to 3 either
// way, so one freak number can't carry a score). null with fewer than 8 teams.
function spreads(value, values) {
  const kept = (values || []).filter(finite);
  if (!finite(value) || kept.length < 8) return null;
  const average = mean(kept), spread = Math.sqrt(mean(kept.map(item => (item - average) ** 2)));
  return spread > 0 ? clamp((value - average) / spread, -3, 3) : 0;
}
// From a place alone (rank 1 the most of `count`), where the numbers aren't there.
const fromRank = (rank, count) => finite(rank) && count > 1 ? probit(clamp(1 - (rank - 0.5) / count, 0.001, 0.999)) : null;
const column = (table, read) => Object.values(table || {}).map(read);
// A read's own 0-100 (its bar): 50 at average, 0 or 100 at 1.65 spreads.
const alone = soft => Math.round(50 + 50 * clamp(soft / 1.65, -1, 1));
// "7th most" / "3rd fewest" from a least-first rank.
function place(rank, count, [low, high] = ['fewest', 'most']) {
  if (!finite(rank) || !count) return '';
  return rank <= Math.ceil(count / 2) ? `${ordinal(rank)} ${low}` : `${ordinal(count - rank + 1)} ${high}`;
}

/** Their defense as a whole: points allowed a game and per 100 possessions. */
function defenseRead(row, league) {
  const allowed = league?.teamStats?.[row.opponent]?.def?.pts, count = league?.teamCount;
  const table = league?.opportunity, rating = table?.teams?.[row.opponent]?.drtg, teams = table?.count || count;
  // Points allowed rank least-first; the rating most-first.
  const fromAllowed = spreads(allowed?.[0], column(league?.teamStats, team => team?.def?.pts?.[0])) ?? fromRank(finite(allowed?.[1]) ? count - allowed[1] + 1 : null, count);
  const fromRating = spreads(rating?.[0], column(table?.teams, team => team?.drtg?.[0])) ?? fromRank(rating?.[1], teams);
  const parts = [fromAllowed, fromRating].filter(finite);
  if (!parts.length) return null;
  const words = [finite(allowed?.[0]) && `${row.opponent} gives up ${one(allowed[0])} points a game (${place(allowed[1], count)})`,
    finite(rating?.[0]) && `${one(rating[0])} per 100 possessions (${place(finite(rating[1]) ? teams - rating[1] + 1 : null, teams, ['lowest', 'highest'])})`];
  return {key: 'defense', kind: 'defense', soft: mean(parts), points: GAINS.allowed * (fromAllowed ?? 0) + GAINS.rating * (fromRating ?? 0),
    text: words.filter(Boolean).join(' and ')};
}

/** How fast they play. */
function paceRead(row, league) {
  const table = league?.opportunity, pace = table?.teams?.[row.opponent]?.poss, teams = table?.count || league?.teamCount;
  if (!finite(pace?.[0])) return null;
  const soft = spreads(pace[0], column(table.teams, team => team?.poss?.[0])) ?? fromRank(pace[1], teams);
  if (!finite(soft)) return null;
  const where = place(finite(pace[1]) ? teams - pace[1] + 1 : null, teams, ['slowest', 'fastest']);
  return {key: 'pace', kind: 'pace', soft, points: GAINS.pace * soft, text: `${row.opponent} plays at ${one(pace[0])} possessions a game${where ? ` (${where})` : ''}`};
}

/** What they allow his position in the stat (dvp: rank 1 allows the least). */
function positionRead(row, league, stat) {
  const cell = defenseCell(row, league);
  if (!cell || !finite(cell.value)) return null;
  const soft = spreads(cell.value, cell.values) ?? fromRank(league?.teamCount - cell.rank + 1, league?.teamCount);
  if (!finite(soft)) return null;
  return {key: `position-${stat}`, kind: 'position', soft, points: GAINS.position * soft,
    text: `${row.opponent} allows ${one(cell.value)} ${WORDS[stat] || 'of it'} a game to ${POSITIONS[cell.position] || 'his position'} (${place(cell.rank, league.teamCount)})`};
}

/** Threes: the 3-point percentage they allow (rank 1 the highest). */
function shootingRead(row, league) {
  const table = league?.opportunity, cell = table?.teams?.[row.opponent]?.tpPctAllowed, teams = table?.count || league?.teamCount;
  if (!finite(cell?.[0])) return null;
  const soft = spreads(cell[0], column(table.teams, team => team?.tpPctAllowed?.[0])) ?? fromRank(cell[1], teams);
  if (!finite(soft)) return null;
  const where = place(finite(cell[1]) ? teams - cell[1] + 1 : null, teams, ['lowest', 'highest']);
  return {key: 'shooting', kind: 'shooting', soft, points: GAINS.shooting * soft,
    text: `${row.opponent} lets teams make ${one(cell[0])}% of their threes${where ? ` (${where})` : ''}`};
}

/** Assists: the field-goal percentage they allow (rank 1 the highest). */
function finishingRead(row, league) {
  const table = league?.opportunity, cell = table?.teams?.[row.opponent]?.fgPctAllowed, teams = table?.count || league?.teamCount;
  if (!finite(cell?.[0])) return null;
  const soft = spreads(cell[0], column(table.teams, team => team?.fgPctAllowed?.[0])) ?? fromRank(cell[1], teams);
  if (!finite(soft)) return null;
  const where = place(finite(cell[1]) ? teams - cell[1] + 1 : null, teams, ['lowest', 'highest']);
  return {key: 'finishing', kind: 'finishing', soft, points: GAINS.finishing * soft,
    text: `${row.opponent} lets teams shoot ${one(cell[0])}% from the field${where ? ` (${where})` : ''}`};
}

/** Steals: how often they turn the ball over (offense; rank 1 the fewest). */
function turnoverRead(row, league) {
  const cell = league?.teamStats?.[row.opponent]?.off?.to, count = league?.teamCount;
  if (!finite(cell?.[0])) return null;
  const soft = spreads(cell[0], column(league.teamStats, team => team?.off?.to?.[0])) ?? fromRank(finite(cell[1]) ? count - cell[1] + 1 : null, count);
  if (!finite(soft)) return null;
  return {key: 'turnovers', kind: 'turnovers', soft, points: GAINS.turnovers * soft,
    text: `${row.opponent} turns it over ${one(cell[0])} times a game (${place(cell[1], count)})`};
}

/** His own games against them, against his usual: shown beside the score, not in it. */
function fitRead(row) {
  const games = (row.gameLog || []).filter(game => finite(game.value));
  const theirs = games.filter(game => game.opponent === row.opponent);
  const usual = mean(games.map(game => game.value));
  if (!theirs.length || !(usual > 0)) return null;
  const against = mean(theirs.map(game => game.value)), trust = theirs.length / (theirs.length + 3);
  return {key: 'fit', kind: 'fit', score: alone(clamp((against / usual - 1) * 2 * trust, -1, 1) * 1.65),
    text: `${theirs.length} ${theirs.length === 1 ? 'game' : 'games'} against ${row.opponent}: ${one(against)} a game, his usual ${one(usual)}`};
}

/**
 * One prop's matchup: {score, raw, reads, fit}, score 0-100 for the over;
 * each read {key, kind, text, score (its own 0-100), points (what it adds
 * to or takes from 50)}; fit is his own games against them, shown beside
 * the score. null when nothing is known about the opponent's defense.
 */
export function matchupScore(row, league) {
  const stat = statOf(row);
  if (row?.sport !== 'nba' || !stat || !row.opponent || !league) return null;
  // A combo's parts each read their own stat; the team's reads are shared.
  const parts = (COMBOS[stat] || [baseMarket(row.marketKey)]).map(marketKey => [marketKey, MARKET_STAT[marketKey]]);
  const shared = [defenseRead(row, league), paceRead(row, league)].filter(Boolean);
  const own = parts.flatMap(([marketKey, part]) => [positionRead({...row, marketKey}, league, part),
    part === 'tpm' ? shootingRead(row, league) : null, part === 'ast' ? finishingRead(row, league) : null,
    part === 'stl' ? turnoverRead(row, league) : null].filter(Boolean)
    .map(read => ({...read, points: read.points / parts.length})));
  const reads = [...shared, ...own];
  if (!reads.some(read => read.kind === 'defense' || read.kind === 'position')) return null;
  const raw = 50 + reads.reduce((sum, read) => sum + read.points, 0);
  return {score: Math.round(clamp(raw, 0, 100)), raw, fit: fitRead(row),
    reads: reads.map(read => ({key: read.key, kind: read.kind, text: read.text, score: alone(read.soft), points: Math.round(read.points * 10) / 10}))};
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
    return {marketKey, stat, score: read.score, ...band(read.score), reads: read.reads, fit: read.fit};
  });
}
