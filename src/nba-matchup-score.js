// The NBA matchup score: how good tonight's opponent is for a stat, 0-100
// for the over (50 an even matchup). It's the same for every player at a
// position against a team (his own games against them are shown beside it,
// not counted), and a combo (points + rebounds...) averages its parts.
//
// Built from a backtest, the way the NFL score is: every 2024-25 and
// 2025-26 regular-season player-game with a real role (15+ minutes), each
// read with only what was known about the opponent that morning, against
// whether he beat his own average (the season so far, last season worth ten
// games of it). A read counts only where its sign held in both seasons:
//
//   their defense    points allowed a game and per 100 possessions (one
//                    read: the two say nearly the same thing)
//   their pace       possessions a game
//   vs his position  what they allow a player at his position in the stat,
//                    a player at a time (league.dvpEach). That beat the
//                    position's total and tied per-minute rates.
//   rebounds         also the rebounds they give up a game
//   assists          also the assists they give up a game
//   threes           only the threes they let teams take: nothing else
//                    held its sign for threes in both seasons
//   steals           also how often they turn the ball over
//
// What didn't hold up isn't read: the 3-point and field-goal percentages a
// defense allows (FG% allowed pointed the wrong way for assists), and pace
// for rebounds and steals.
//
// Each read is how far the team sits from the league's average in spreads
// (standard deviations, held to 3), the soft side up, times its weight
// (WEIGHTS: the backtest's log-odds times 245, a scale that puts the top
// 2.5% of props at 90 or more); the total moves the score from 50 along
// 50 + 50 tanh(points / 50). Scored on the season it wasn't fitted on,
// props at 90+ (3%) beat their own average 4.4 points of % more often than
// usual, 75-89 3.7, 60-74 2.3, 40-59 even, 25-39 2.3 less, under 25 3.9
// less. The weights fitted to RotoBot's grades before this put 19% of
// props at 90+, and those beat their average only 3.3 more often.
//
import {defenseCell, statGameLog} from './unified-finder-data.js';
import {MARKET_STAT, baseMarket} from './sports/wnba/wnba-research.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// Points a spread each read moves the score, by stat (see the top of the
// file). Stats the backtest didn't cover read the nearest one (FAMILY).
export const WEIGHTS = {
  pts: {defense: 19, pace: 12, position: 3.5},
  reb: {defense: 6, position: 6, rebounds: 18.5},
  ast: {defense: 5, pace: 7.5, position: 13, assists: 18},
  tpm: {attempts: 22},
  stl: {defense: 10, position: 6, turnovers: 18.5},
  blk: {defense: 7, pace: 9, position: 17.5},
};
const FAMILY = {oreb: 'reb', dreb: 'reb', tpa: 'tpm'};
const weightsOf = stat => WEIGHTS[stat] || WEIGHTS[FAMILY[stat]] || WEIGHTS.pts;
// A combo is the average of its parts' scores.
const COMBOS = {pr: ['player_points', 'player_rebounds'], pa: ['player_points', 'player_assists'], ra: ['player_rebounds', 'player_assists'],
  pra: ['player_points', 'player_rebounds', 'player_assists'], bs: ['player_blocks', 'player_steals']};
const WORDS = {pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', tpa: 'three-point tries', stl: 'steals', blk: 'blocks',
  bs: 'blocks + steals', pr: 'points + rebounds', pa: 'points + assists', ra: 'rebounds + assists', pra: 'points, rebounds and assists',
  fs: 'fantasy points', fgm: 'field goals', fga: 'shots', ftm: 'free throws', fta: 'free throws', twos: 'twos', twosa: 'twos',
  oreb: 'offensive rebounds', dreb: 'defensive rebounds', to: 'turnovers', pf: 'fouls', dd: 'double-doubles', td: 'triple-doubles'};
const POSITIONS = {G: 'guards', F: 'forwards', C: 'centers'};
const ONE = {G: 'guard', F: 'forward', C: 'center'};
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
  return {key: 'defense', kind: 'defense', soft: mean(parts), text: words.filter(Boolean).join(' and ')};
}

/** How fast they play. */
function paceRead(row, league) {
  const table = league?.opportunity, pace = table?.teams?.[row.opponent]?.poss, teams = table?.count || league?.teamCount;
  if (!finite(pace?.[0])) return null;
  const soft = spreads(pace[0], column(table.teams, team => team?.poss?.[0])) ?? fromRank(pace[1], teams);
  if (!finite(soft)) return null;
  const where = place(finite(pace[1]) ? teams - pace[1] + 1 : null, teams, ['slowest', 'fastest']);
  return {key: 'pace', kind: 'pace', soft, text: `${row.opponent} plays at ${one(pace[0])} possessions a game${where ? ` (${where})` : ''}`};
}

/**
 * What they allow a player at his position in the stat (dvpEach, a player
 * at a time; the position's total, dvp, from a server that doesn't send it
 * yet). Rank 1 allows the least.
 */
function positionRead(row, league, stat) {
  const each = Boolean(league?.dvpEach);
  const cell = defenseCell(row, each ? {...league, dvp: league.dvpEach} : league);
  if (!cell || !finite(cell.value)) return null;
  const soft = spreads(cell.value, cell.values) ?? fromRank(league?.teamCount - cell.rank + 1, league?.teamCount);
  if (!finite(soft)) return null;
  const who = each ? `each ${ONE[cell.position] || 'player at his position'}` : POSITIONS[cell.position] || 'his position';
  return {key: `position-${stat}`, kind: 'position', soft,
    text: `${row.opponent} allows ${who} ${one(cell.value)} ${WORDS[stat] || 'of it'} a game (${place(cell.rank, league.teamCount)})`};
}

/**
 * A number of theirs from the opportunity table (opportunity.team_table:
 * rank 1 the most), the more the softer: the threes they let teams take,
 * the rebounds and assists they give up.
 */
const OPPORTUNITY = {
  attempts: [cell => cell?.tpaAllowed, value => `lets teams take ${value} threes a game`],
  rebounds: [cell => cell?.rebAllowed, value => `gives up ${value} rebounds a game`],
  assists: [cell => cell?.astAllowed, value => `gives up ${value} assists a game`],
};
function opportunityRead(row, league, key) {
  const [pick, say] = OPPORTUNITY[key];
  const table = league?.opportunity, cell = pick(table?.teams?.[row.opponent]), teams = table?.count || league?.teamCount;
  if (!finite(cell?.[0])) return null;
  const soft = spreads(cell[0], column(table.teams, team => pick(team)?.[0])) ?? fromRank(cell[1], teams);
  if (!finite(soft)) return null;
  const where = place(finite(cell[1]) ? teams - cell[1] + 1 : null, teams);
  return {key, kind: key, soft, text: `${row.opponent} ${say(one(cell[0]))}${where ? ` (${where})` : ''}`};
}

/** Steals: how often they turn the ball over (offense; rank 1 the fewest). */
function turnoverRead(row, league) {
  const cell = league?.teamStats?.[row.opponent]?.off?.to, count = league?.teamCount;
  if (!finite(cell?.[0])) return null;
  const soft = spreads(cell[0], column(league.teamStats, team => team?.off?.to?.[0])) ?? fromRank(finite(cell[1]) ? count - cell[1] + 1 : null, count);
  if (!finite(soft)) return null;
  return {key: 'turnovers', kind: 'turnovers', soft, text: `${row.opponent} turns it over ${one(cell[0])} times a game (${place(cell[1], count)})`};
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
 * to or takes from the total that moves the score from 50; raw is 50 plus
 * them all)}; fit is his own games against them, shown beside the score. null when nothing is known about the opponent's defense.
 */
export function matchupScore(row, league) {
  const stat = statOf(row);
  if (row?.sport !== 'nba' || !stat || !row.opponent || !league) return null;
  // A combo's parts each read their own stat with their own weights; the
  // team's reads (defense, pace) are shared at the parts' average weight.
  const parts = (COMBOS[stat] || [baseMarket(row.marketKey)]).map(marketKey => [marketKey, MARKET_STAT[marketKey]]);
  const share = name => mean(parts.map(([, part]) => weightsOf(part)[name] || 0));
  const weighed = (read, weight) => read && {...read, points: weight * read.soft};
  const shared = [['defense', defenseRead], ['pace', paceRead]].filter(([name]) => share(name))
    .map(([name, read]) => weighed(read(row, league), share(name)));
  const own = parts.flatMap(([marketKey, part]) => {
    const weights = weightsOf(part);
    const extra = Object.keys(weights).filter(name => OPPORTUNITY[name] || name === 'turnovers')
      .map(name => weighed(name === 'turnovers' ? turnoverRead(row, league) : opportunityRead(row, league, name), weights[name] / parts.length));
    // His position is always shown; for threes it doesn't count (weight 0).
    return [weighed(positionRead({...row, marketKey}, league, part), (weights.position || 0) / parts.length), ...extra];
  });
  const reads = [...shared, ...own].filter(Boolean);
  if (!reads.some(read => read.kind === 'defense' || read.kind === 'position')) return null;
  const points = reads.reduce((sum, read) => sum + read.points, 0);
  return {score: Math.round(50 + 50 * Math.tanh(points / 50)), raw: 50 + points, fit: fitRead(row),
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
