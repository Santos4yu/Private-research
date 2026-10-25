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
// One read is his own (MEETINGS), for threes and blocks alone: his last
// three games against them (the two seasons a history holds) against his
// usual, ln((made + 0.5) / (games x usual + 0.5)) trusted n/(n + 3) and
// centred. With his recent form held, it predicted overs in both seasons
// for those two and for nothing else (points, rebounds, assists and steals
// flipped sign). Out of sample, threes and blocks at 90+ (3-4% of them)
// beat his average about 6 points of % more often than usual, 40-59 even,
// under 25 4-5 less. So against one team two guards' threes can differ;
// everything else is the same for every player at a position.
//
// Who's out tonight (Oct 24 backtest, the same games): the strongest read
// there is. A rotation player sitting (3+ of his team's last 10 games, one
// of its last 3, 15+ minutes in them) hands his minutes and shots to the
// rest: per 30 minutes out at his position, a player beat his average about
// 18 points of % more often in points, threes and assists (both seasons),
// 7-12 for anyone else out. The opponent's absences count too, less: a
// player at his position out (points), any of them (assists, steals,
// blocks), their center (rebounds). Read in 30-minute units against a usual
// night's (OUT_CENTRES: someone is nearly always out), from tonight's
// injury reports (league.tonight); no report, no read. Only the minutes out
// beyond a usual night count (Oct 25, the owner: Reaves against the
// league's softest defense read 44 for points because nobody on either team
// was out). A full roster is news of nothing: it no longer takes up to 38
// points off a score, so the opponent's defense decides an ordinary night. Also their last 10
// games' defense beside the season's (league.opportunity ptsAllowed10,
// drtg10): a defense that has changed. Fitted with these, their defense as
// a whole no longer held its sign for rebounds or assists, so it isn't read
// there; combos stay the even average of their parts (weighting by his mix
// read overs slightly worse).
//
// A teammate coming back (Oct 24, the same games): one who played 20+
// minutes a game, missed his team's last 3 and plays tonight takes his
// minutes and shots back. Per 30 of his minutes at his position, a player
// beat his average 4-8 points of % less often (both seasons; rebounds and
// blocks most), and 2-4 less for one elsewhere (points, assists, threes,
// steals). Read only when his team played lately (not a season's first
// game, whose last three are last season's) and its report is in: a player
// on it counts for the share of his minutes he's likely to play.
//
// Each read is how far the team sits from the league's average in spreads
// (standard deviations, held to 3), the soft side up, times its weight
// (WEIGHTS: the backtest's log-odds times 133, a scale that puts the top
// 2.5% of props at 90 or more); the total moves the score from 50 along
// 50 + 50 tanh(points / 50). Scored on the season it wasn't fitted on,
// props at 90+ (2.6%) beat their own average 13.5 points of % more often
// than usual, 75-89 6.9, 60-74 2.6, 40-59 even, 25-39 2.8 less, under 25
// 7.0 less: the best tenth and the worst tenth 15 points of % apart (8
// before who's out and the recent defense, 20 for points, 25 for PRA).
//
import {defenseCell, meetingsOf, statGameLog} from './unified-finder-data.js';
import {MARKET_STAT, baseMarket, positionOf} from './sports/wnba/wnba-research.js';
import {lineupRole} from './lineup-role.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

// Points a spread each read moves the score, by stat (see the top of the
// file). Stats the backtest didn't cover read the nearest one (FAMILY).
// teamPos / teamOther: his teammates out at his position / elsewhere;
// oppPos / oppOther / oppAll / oppC: the opponent's at his position,
// elsewhere, all of them, their centers; recent: their last 10 games.
// backPos / backOther: teammates back tonight, at his position / elsewhere.
export const WEIGHTS = {
  pts: {defense: 6, pace: 5.9, position: 2.2, recent: 4.2, teamPos: 39.5, teamOther: 27.8, oppPos: 4.2, oppOther: 7, backPos: -20.4, backOther: -9},
  reb: {position: 3.4, rebounds: 9.5, recent: 5.3, teamPos: 25.4, teamOther: 18.5, oppC: 12.9, backPos: -31.3},
  ast: {pace: 3.3, position: 7.5, assists: 8.2, recent: 5, teamPos: 29.3, teamOther: 18.3, oppAll: 4.9, backPos: -15.4, backOther: -8.8},
  tpm: {attempts: 11.1, recent: 3.1, teamPos: 24.5, teamOther: 7.6, backOther: -9.9},
  stl: {defense: 5.1, position: 3.4, turnovers: 9.5, teamPos: 15, teamOther: 7, oppAll: 2.5, backPos: -14, backOther: -17},
  blk: {defense: 3.1, pace: 4.9, position: 9.1, oppAll: 5.5, backPos: -20.2},
};
// A usual night's minutes back, in the same units, by his position.
export const BACK_CENTRES = {backPos: {G: 0.065, F: 0.055, C: 0.019}, backOther: {G: 0.06, F: 0.071, C: 0.106}};
// Who counts as back: 20+ minutes a game over 5+ games, out of the team's
// last 3 but in one of its last 10, its last game within BACK.days.
export const BACK = {minutes: 20, games: 5, days: 20};
// A usual night's minutes out, in 30-minute units (the backtest's average):
// at his position by position, elsewhere, all of the opponent's, their centers.
export const OUT_CENTRES = {teamPos: {G: 0.41, F: 0.323, C: 0.094}, teamOther: 0.57, oppPos: {G: 0.464, F: 0.354, C: 0.151}, oppOther: 0.589,
  oppAll: 0.969, oppC: 0.148};
// Who counts as out: on tonight's report and in the rotation lately. The
// backtest counted who sat; a report says how likely that is, so a listing
// counts as that share of his minutes (public rates: a Doubtful player sits
// about four times in five, a Questionable or Day-To-Day one about a third
// of the time).
export const ROTATION = {played: 3, minutes: 15};
export const SITS = {out: 1, suspension: 1, suspended: 1, doubtful: 0.8, questionable: 0.35, 'day-to-day': 0.35};
// ESPN's positions (PG, SG, SF, PF, C, G-F...) as guard, forward or center.
const CODES = {PG: 'G', SG: 'G', G: 'G', SF: 'F', PF: 'F', F: 'F', C: 'C'};
export const positionCode = value => CODES[String(value || '').toUpperCase().split('-')[0].trim()] || positionOf(value);
const FAMILY = {oreb: 'reb', dreb: 'reb', tpa: 'tpm'};
// His last three games against them (meetingsOf): points a unit, the
// league's average of the read (taken off), its spread (for its own bar).
export const MEETINGS = {tpm: {weight: 70.6, center: -0.095, spread: 0.27}, blk: {weight: 45.6, center: -0.114, spread: 0.31}};
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

// The opponent's reads, stretched (Oct 25, the owner: "his matchup is
// great", Reaves at the league's softest defense read 79). On the
// backtest's scale the 90s were left to injury nights: a defense alone
// topped out in the low 80s. Now each stat's opponent reads are stretched
// so an opponent 1.65 spreads soft on all of them reads 97, the way the
// softest defense tops a list. Who's out still adds on top (held to 100).
// The number reads as how soft the defense is more than as the backtest's
// odds; the track record shows how each band does.
const OPPONENT = ['defense', 'pace', 'position', 'recent', 'attempts', 'rebounds', 'assists', 'turnovers'];
export const STRETCH = Object.fromEntries(Object.entries(WEIGHTS).map(([stat, weights]) =>
  [stat, 50 * Math.atanh(0.94) / (1.65 * OPPONENT.reduce((sum, name) => sum + (weights[name] || 0), 0))]));
const stretchOf = stat => STRETCH[stat] || STRETCH[FAMILY[stat]] || STRETCH.pts;

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

/** Their last 10 games' defense: points allowed a game and per 100 possessions. */
function recentRead(row, league) {
  const table = league?.opportunity, cell = table?.teams?.[row.opponent];
  const parts = [spreads(cell?.ptsAllowed10?.[0], column(table?.teams, team => team?.ptsAllowed10?.[0])),
    spreads(cell?.drtg10?.[0], column(table?.teams, team => team?.drtg10?.[0]))].filter(finite);
  if (!parts.length) return null;
  const words = [finite(cell?.ptsAllowed10?.[0]) && `${one(cell.ptsAllowed10[0])} points a game`, finite(cell?.drtg10?.[0]) && `${one(cell.drtg10[0])} per 100 possessions`];
  return {key: 'recent', kind: 'recent', soft: mean(parts), text: `${row.opponent} over its last 10 games: ${words.filter(Boolean).join(', ')} allowed`};
}

/**
 * A team's players out tonight who've been in its rotation lately: [{name,
 * pos, min}] from its injury report (league.tonight) and recent minutes
 * (league.rotation). null when either is missing (unknown, not healthy):
 * a server that doesn't send the recent minutes yet, a game whose report
 * didn't come back.
 */
export function outTonight(team, league, skip = null) {
  const report = league?.tonight?.teams?.[team], players = league?.rotation?.[team]?.players;
  if (!report || !Array.isArray(report.injuries) || !Array.isArray(players) || !players.some(player => 'played10' in player)) return null;
  const chance = item => SITS[String(item?.status || '').trim().toLowerCase()] ?? (item?.out ? 1 : 0);
  const listed = new Map(report.injuries.filter(item => chance(item) > 0).map(item => [String(item.id), item]));
  return players.filter(player => String(player.id) !== String(skip) && listed.has(String(player.id))
    && player.played10 >= ROTATION.played && player.last3 && player.min10 >= ROTATION.minutes)
    .map(player => {
      const item = listed.get(String(player.id));
      return {id: String(player.id), name: player.name, pos: positionCode(player.pos) || 'F', min: player.min10, sits: chance(item), status: item.status};
    })
    .sort((a, b) => b.sits * b.min - a.sits * a.min);
}
/**
 * A team's players back tonight (see the top of the file): [{id, name, pos,
 * min, plays}], plays the share of his minutes he's likely to play. null
 * when the report or the recent minutes are missing, or the team hasn't
 * played lately.
 */
export function backTonight(team, league, skip = null, now = Date.now()) {
  const report = league?.tonight?.teams?.[team], side = league?.rotation?.[team], players = side?.players;
  if (!report || !Array.isArray(report.injuries) || !Array.isArray(players) || !players.some(player => 'played10' in player)) return null;
  const last = Date.parse(side.lastGame || '');
  if (!finite(last) || now - last > BACK.days * 864e5) return null;
  const chance = item => SITS[String(item?.status || '').trim().toLowerCase()] ?? (item?.out ? 1 : 0);
  const listed = new Map(report.injuries.map(item => [String(item.id), chance(item)]));
  return players.filter(player => String(player.id) !== String(skip) && player.last3 === false && player.played10 >= 1
    && player.games >= BACK.games && player.min >= BACK.minutes && (listed.get(String(player.id)) ?? 0) < 1)
    .map(player => ({id: String(player.id), name: player.name, pos: positionCode(player.pos) || 'F', min: player.min,
      plays: 1 - (listed.get(String(player.id)) ?? 0), status: report.injuries.find(item => String(item.id) === String(player.id))?.status || null}))
    .sort((a, b) => b.plays * b.min - a.plays * a.min);
}
const backMinutes = players => players.reduce((sum, player) => sum + player.min * player.plays, 0) / 30;
const listBack = players => players.map(player => `${player.name} (${player.pos}, ${Math.round(player.min)} min${player.plays < 1 ? `, ${String(player.status).toLowerCase()}` : ''})`).join(', ');

// Minutes out, in 30-minute units: each counted by how likely he is to sit.
const minutesOf = players => players.reduce((sum, player) => sum + player.min * player.sits, 0) / 30;
const listOut = players => players.map(player => `${player.name} (${player.pos}, ${Math.round(player.min)} min${player.sits < 1 ? `, ${String(player.status).toLowerCase()}` : ''})`).join(', ');
// Only minutes out beyond a usual night count; fewer reads even, not below.
const beyond = (units, centre) => Math.max(0, units - centre);

/**
 * Who's out tonight, his side and theirs (see the top of the file): each
 * part's weights (a combo's parts averaged), against a usual night.
 */
function absenceReads(row, league, parts) {
  const pos = positionCode(row.position);
  if (!pos) return [];
  const average = name => mean(parts.map(([, part]) => weightsOf(part)[name] || 0));
  const reads = [];
  // A starter's matchup is the opponent's (Oct 25, the owner: teammates in
  // or out shouldn't decide a starter's matchup). His minutes don't hang on
  // who else plays, so his own team's reads are left out for him; a bench
  // player, whose minutes do, still reads them. Who's out for the opponent
  // is part of the matchup and counts for everyone.
  const starter = lineupRole(row, league)?.starter === true;
  const mine = starter ? null : outTonight(row.teamAbbr, league, row.playerId);
  if (mine && (average('teamPos') || average('teamOther'))) {
    const at = mine.filter(player => player.pos === pos), rest = mine.filter(player => player.pos !== pos);
    const points = average('teamPos') * beyond(minutesOf(at), OUT_CENTRES.teamPos[pos]) + average('teamOther') * beyond(minutesOf(rest), OUT_CENTRES.teamOther);
    if (mine.length && Math.round(points)) reads.push({key: 'teammates', kind: 'teammates', points, soft: points / 15,
      text: `Out for ${row.teamAbbr} tonight: ${listOut(mine)}. Their minutes and shots go to the rest${at.length ? `, most to the ${POSITIONS[pos]}` : ''}`});
  }
  const back = !starter && (average('backPos') || average('backOther')) ? backTonight(row.teamAbbr, league, row.playerId) : null;
  if (back?.length) {
    const at = back.filter(player => player.pos === pos), rest = back.filter(player => player.pos !== pos);
    const points = average('backPos') * (backMinutes(at) - BACK_CENTRES.backPos[pos]) + average('backOther') * (backMinutes(rest) - BACK_CENTRES.backOther[pos]);
    reads.push({key: 'back', kind: 'back', points, soft: points / 15,
      text: `Back for ${row.teamAbbr} tonight after missing their last 3: ${listBack(back)}. ${back.length > 1 ? 'They take' : 'He takes'} minutes and shots back${at.length ? `, most from the ${POSITIONS[pos]}` : ''}`});
  }
  const theirs = outTonight(row.opponent, league);
  const oppNames = ['oppPos', 'oppOther', 'oppAll', 'oppC'].filter(name => average(name));
  if (theirs && oppNames.length) {
    const at = theirs.filter(player => player.pos === pos), centers = theirs.filter(player => player.pos === 'C');
    const value = {oppPos: beyond(minutesOf(at), OUT_CENTRES.oppPos[pos]), oppOther: beyond(minutesOf(theirs.filter(player => player.pos !== pos)), OUT_CENTRES.oppOther),
      oppAll: beyond(minutesOf(theirs), OUT_CENTRES.oppAll), oppC: beyond(minutesOf(centers), OUT_CENTRES.oppC)};
    const points = oppNames.reduce((sum, name) => sum + average(name) * value[name], 0);
    if (theirs.length && Math.round(points)) reads.push({key: 'missing', kind: 'missing', points, soft: points / 15,
      text: `Out for ${row.opponent} tonight: ${listOut(theirs)}. A thinner defense${centers.length && oppNames.includes('oppC') ? ', without its center on the glass' : ''}`});
  }
  return reads;
}

/** Threes and blocks: his last three games against them, against his usual (MEETINGS). */
function meetingsRead(row, stat) {
  const rule = MEETINGS[stat], last = (row.meetings?.values || []).filter(finite), usual = row.meetings?.usual;
  if (!rule || !last.length || !finite(usual)) return null;
  const n = last.length, made = last.reduce((sum, value) => sum + value, 0);
  const lean = Math.log((made + 0.5) / (n * Math.max(usual, 0.25) + 0.5)) * n / (n + 3) - rule.center;
  const games = n === 1 ? 'game' : `${n} games`;
  return {key: 'meetings', kind: 'meetings', soft: lean / rule.spread, points: rule.weight * lean, counted: true,
    text: `His last ${games} against ${row.opponent}: ${last.join(', ')} ${WORDS[stat] || ''} (${one(made / n)} a game), his usual ${one(usual)}`};
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
  const shared = [['defense', defenseRead], ['pace', paceRead], ['recent', recentRead]].filter(([name]) => share(name))
    .map(([name, read]) => weighed(read(row, league), share(name)));
  const own = parts.flatMap(([marketKey, part]) => {
    const weights = weightsOf(part);
    const extra = Object.keys(weights).filter(name => OPPORTUNITY[name] || name === 'turnovers')
      .map(name => weighed(name === 'turnovers' ? turnoverRead(row, league) : opportunityRead(row, league, name), weights[name] / parts.length));
    // His position is always shown; for threes it doesn't count (weight 0).
    return [weighed(positionRead({...row, marketKey}, league, part), (weights.position || 0) / parts.length), ...extra];
  });
  // Threes and blocks alone also read his last three games against them.
  const meetings = parts.length === 1 ? meetingsRead(row, parts[0][1]) : null;
  const reads = [...shared, ...own, ...absenceReads(row, league, parts), meetings].filter(Boolean);
  if (!reads.some(read => read.kind === 'defense' || read.kind === 'position')) return null;
  // The backtest's own number (`calibrated`) stays what the Analyzer's
  // chances read; the score shown has the opponent's reads stretched by the
  // parts' average (STRETCH).
  const calibrated = Math.round(50 + 50 * Math.tanh(reads.reduce((sum, read) => sum + read.points, 0) / 50));
  const stretch = mean(parts.map(([, part]) => stretchOf(part)));
  for (const read of reads) if (OPPONENT.includes(read.kind)) read.points *= stretch;
  const points = reads.reduce((sum, read) => sum + read.points, 0);
  const fit = meetings ? {key: 'meetings', kind: 'meetings', score: alone(meetings.soft), text: meetings.text, counted: true} : fitRead(row);
  return {score: Math.round(50 + 50 * Math.tanh(points / 50)), calibrated, raw: 50 + points, fit,
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
    const full = Boolean(history?.rows?.length), own = marketKey === row.marketKey;
    const games = full ? statGameLog(history, marketKey) : own ? row.gameLog : [];
    const meetings = full ? meetingsOf(history, marketKey, row.opponent) : own ? row.meetings : null;
    const read = matchupScore({...row, marketKey, gameLog: games, meetings}, league);
    if (!read) return {marketKey, stat, score: null};
    return {marketKey, stat, score: read.score, calibrated: read.calibrated, ...band(read.score), reads: read.reads, fit: read.fit};
  });
}
