// The NBA matchup score: how good tonight's opponent is for a stat, 0-100,
// for the over (50 is an average matchup). Four reads, weighted:
//
//   what they allow his position   40%  the opponent's defense vs position
//                                       (league-context dvp), season with
//                                       its last ten mixed in
//   their defense for the stat     25%  what the whole team gives up in it
//                                       (teamStats.def): points for points,
//                                       steals they cough up for steals
//   game speed                     15%  the two teams' possessions a game
//                                       against the league's (opportunity)
//   how he fits                    20%  his own games against them, held
//                                       against his usual, trusted by how
//                                       many there are
//
// A read with nothing behind it is left out and the rest share its weight.
// Every number comes from ESPN box scores (backend/sports/wnba/context.py,
// opportunity.py); early in a season they carry last season's games.
//
// The score is then placed against the same read for every team in the
// league (placed): the best opponent there is for his position and stat
// sits near the top, the worst near the bottom, instead of a dozen props
// all reading 100.
import {defenseCell, statGameLog} from './unified-finder-data.js';
import {MARKET_STAT, baseMarket} from './sports/wnba/wnba-research.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => (Math.round(value * 10) / 10).toFixed(1);
const ordinal = n => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;

export const WEIGHTS = {position: 0.4, team: 0.25, pace: 0.15, fit: 0.2};
// How far each read moves for a given gap from average: 10% more allowed
// to his position is +22, 10% more by the team +25, 4% faster +24.
const STRETCH = {position: 220, team: 250, pace: 600, fit: 100};
// The team box score parts behind each stat (teamStats keys).
const PARTS = {pts: ['pts'], reb: ['reb'], ast: ['ast'], tpm: ['tpm'], tpa: ['tpm'], stl: ['stl'], blk: ['blk'], bs: ['blk', 'stl'],
  pr: ['pts', 'reb'], pa: ['pts', 'ast'], ra: ['reb', 'ast'], pra: ['pts', 'reb', 'ast'], fs: ['pts', 'reb', 'ast', 'blk', 'stl'],
  fgm: ['fgm'], fga: ['fgm'], ftm: ['ftm'], fta: ['ftm'], twos: ['fgm'], twosa: ['fgm'], oreb: ['reb'], dreb: ['reb'], dd: ['pts', 'reb', 'ast'],
  td: ['pts', 'reb', 'ast']};
const WORDS = {pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', tpa: 'three-point tries', stl: 'steals', blk: 'blocks',
  bs: 'blocks + steals', pr: 'points + rebounds', pa: 'points + assists', ra: 'rebounds + assists', pra: 'points, rebounds and assists',
  fs: 'fantasy points', fgm: 'field goals', fga: 'shots', ftm: 'free throws', fta: 'free throws', twos: 'twos', twosa: 'twos',
  oreb: 'rebounds', dreb: 'rebounds', dd: 'counting stats', td: 'counting stats'};
const POSITIONS = {G: 'guards', F: 'forwards', C: 'centers'};
// The stats the player page scores side by side.
export const CARD_STATS = [['player_points', 'PTS'], ['player_rebounds', 'REB'], ['player_assists', 'AST'], ['player_threes', '3PM'],
  ['player_steals', 'STL'], ['player_blocks', 'BLK']];

export const BANDS = [[75, 'Strong edge', 'strong'], [60, 'Edge', 'edge'], [40, 'Neutral', 'neutral'], [0, 'Tough', 'tough']];
export function band(score) {
  const [, label, tone] = BANDS.find(([floor]) => score >= floor);
  return {label, tone};
}

const stretch = (ratio, key) => clamp(50 + (ratio - 1) * STRETCH[key], 0, 100);
const statOf = row => MARKET_STAT[baseMarket(row?.marketKey)] || null;

function placeWord(rank, teams, most) {
  if (!finite(rank) || !finite(teams) || teams < 6) return '';
  const fromTop = teams - rank + 1;
  if (rank <= Math.round(teams / 3)) return most ? ` (${ordinal(rank)}-most)` : ` (${ordinal(rank)}-fewest)`;
  if (fromTop <= Math.round(teams / 3)) return most ? ` (${ordinal(fromTop)}-fewest)` : ` (${ordinal(fromTop)}-most)`;
  return '';
}

/** What the opponent allows his position in the stat (dvp: rank 1 allows the least). */
function positionRead(row, league, stat) {
  const cell = defenseCell(row, league);
  if (!cell || !finite(cell.value) || !(cell.average > 0)) return null;
  const allowed = finite(cell.recent) ? 0.7 * cell.value + 0.3 * cell.recent : cell.value;
  const ratio = allowed / cell.average;
  const gap = Math.round((cell.value / cell.average - 1) * 100);
  const who = POSITIONS[cell.position] || 'his position';
  return {key: 'position', score: stretch(ratio, 'position'), ratio,
    text: `${row.opponent} allows ${one(cell.value)} ${WORDS[stat] || 'of it'} a game to ${who}, ${Math.abs(gap)}% ${gap >= 0 ? 'more' : 'less'} than average${placeWord(cell.rank, league.teamCount, false)}`};
}

/** What the whole team gives up in the stat, against every team's average. */
function teamRead(row, league, stat) {
  const stats = league?.teamStats, theirs = stats?.[row.opponent]?.def;
  const parts = PARTS[stat];
  if (!theirs || !parts) return null;
  const value = parts.reduce((sum, key) => sum + (finite(theirs[key]?.[0]) ? theirs[key][0] : NaN), 0);
  const usual = parts.reduce((sum, key) => sum + (mean(Object.values(stats).map(team => team?.def?.[key]?.[0]).filter(finite)) ?? NaN), 0);
  if (!finite(value) || !(usual > 0)) return null;
  const ratio = value / usual;
  const rank = parts.length === 1 ? theirs[parts[0]]?.[1] : null;
  // Steals and blocks are the other team's doing: how often they lose the
  // ball, how often their shots get blocked.
  const words = stat === 'stl' ? `${row.opponent} gives up ${one(value)} steals a game` : stat === 'blk' ? `${row.opponent} has ${one(value)} shots blocked a game`
    : `${row.opponent} gives up ${one(value)} ${WORDS[stat] || 'of it'} a game`;
  return {key: 'team', score: stretch(ratio, 'team'), ratio,
    text: `${words}, league ${one(usual)}${placeWord(rank, league.teamCount, false)}`};
}

/** The two teams' possessions a game, against the league's. */
function paceRead(row, league) {
  const table = league?.opportunity, mine = table?.teams?.[row.teamAbbr]?.poss?.[0], theirs = table?.teams?.[row.opponent]?.poss?.[0];
  const usual = table?.league?.poss;
  if (!finite(mine) || !finite(theirs) || !(usual > 0)) return null;
  const pace = (mine + theirs) / 2, ratio = pace / usual;
  const kind = ratio >= 1.015 ? 'A fast game' : ratio <= 0.985 ? 'A slow game' : 'An average-pace game';
  return {key: 'pace', score: stretch(ratio, 'pace'), ratio, text: `${kind}: about ${one(pace)} possessions, league ${one(usual)}`};
}

/** His own games against them, against his usual: worth more the more there are. */
function fitRead(row) {
  const games = (row.gameLog || []).filter(game => finite(game.value));
  const theirs = games.filter(game => game.opponent === row.opponent);
  const usual = mean(games.map(game => game.value));
  if (!theirs.length || !(usual > 0)) return null;
  const against = mean(theirs.map(game => game.value)), trust = theirs.length / (theirs.length + 3);
  const ratio = 1 + (against / usual - 1) * trust;
  return {key: 'fit', score: stretch(ratio, 'fit'), ratio,
    text: `${theirs.length} ${theirs.length === 1 ? 'game' : 'games'} against ${row.opponent}: ${one(against)} a game, his usual ${one(usual)}`};
}

/**
 * One prop's matchup before the night's spread: {raw, reads}, raw 0-100
 * for the over, each read {key, score, text, weight}. null when nothing is
 * known about the opponent.
 */
export function matchupScore(row, league) {
  const stat = statOf(row);
  if (row?.sport !== 'nba' || !stat || !row.opponent || !league) return null;
  const reads = [positionRead(row, league, stat), teamRead(row, league, stat), paceRead(row, league), fitRead(row)].filter(Boolean);
  // Without the defense itself there is no matchup to speak of.
  if (!reads.some(read => read.key === 'position' || read.key === 'team')) return null;
  const total = reads.reduce((sum, read) => sum + WEIGHTS[read.key], 0);
  const raw = reads.reduce((sum, read) => sum + read.score * WEIGHTS[read.key], 0) / total;
  return {raw, reads: reads.map(read => ({...read, weight: Math.round(WEIGHTS[read.key] / total * 100)}))};
}

/**
 * A raw score placed on the scale against every matchup he could have had:
 * the same read of his stat against each of the league's teams. The best
 * opponent in the league for it lands near the top and the worst near the
 * bottom, the same on any night and on any page.
 */
const SPREAD = 16;
const spreads = new WeakMap();
function placed(row, league, raw) {
  let cache = spreads.get(league);
  if (!cache) spreads.set(league, cache = new Map());
  const key = `${row.position}|${statOf(row)}|${row.teamAbbr}`;
  if (!cache.has(key)) {
    const raws = Object.keys(league.dvp || {}).filter(team => team !== row.teamAbbr)
      .map(opponent => matchupScore({...row, opponent, gameLog: []}, league)?.raw).filter(finite);
    const center = mean(raws) ?? 50;
    cache.set(key, {center, sd: raws.length >= 8 ? Math.sqrt(mean(raws.map(value => (value - center) ** 2))) : 0});
  }
  const {center, sd} = cache.get(key);
  return Math.round(clamp(sd > 0.5 ? 50 + (raw - center) / sd * SPREAD : raw, 1, 99));
}

/** Tonight's props scored: a Map from row id to {score, label, tone, raw, reads}. */
export function spreadScores(rows, league) {
  const out = new Map();
  for (const row of rows) {
    const read = matchupScore(row, league);
    if (!read) continue;
    const score = placed(row, league, read.raw);
    out.set(row.id, {score, ...band(score), raw: read.raw, reads: read.reads});
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
    const line = {...row, marketKey, gameLog: games};
    const read = matchupScore(line, league);
    if (!read) return {marketKey, stat, score: null};
    const score = placed(line, league, read.raw);
    return {marketKey, stat, score, ...band(score), reads: read.reads};
  });
}
