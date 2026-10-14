// The prop model: a stat projected the way it is produced -- a rate per
// opportunity times today's opportunities -- instead of an average of past
// games. The opportunities are what the game logs count beside the stat
// (gameLog `usage`): an MLB hitter's plate appearances, a pitcher's
// pitches, an NHL player's minutes on the ice, a basketball or soccer
// player's minutes. Splitting the two reads a hitter moved to leadoff, a starter on
// a short leash, a forward with more ice time or a guard in for more
// minutes for what they are, and turns the projection into a chance the
// way the stat actually falls: one hit or none in each trip to the plate
// (binomial), total bases from what each hit is worth, counts with their
// own spread (negative binomial), big stats on a curve.
//
// Each rate is pulled toward the board's own (every other player at the
// position with a line in the stat) by how much evidence is behind it,
// `k` opportunities of the board's rate against his: a hitter's hits per
// plate appearance need hundreds of trips to say much (luck on balls in
// play), a basketball player's points per minute a few games. `k` is the
// stat's game-to-game noise per opportunity over how much players really
// differ in it.
//
// Then the chance is held toward the line's break-even by how sure the
// model can be against how far PrizePicks' lines tend to be off. The
// lines are set from the sportsbooks' numbers, so a projection far from
// one is more often a projection that's wrong than a line that is: the
// best-looking picks on a board are, more than anything, the ones whose
// recent games ran luckiest. So each projection carries its own
// uncertainty (how many games are behind his rate, how settled his
// playing time is, how far the model runs off in the stat) and keeps only
// the part of its edge that survives it. Steady stats keep more than
// swingy ones (RBIs, runs, goals), which make a slip only when the case
// for them is strong.
import {newsOf, samePerson} from './slip-games.js';
import {statKeyOf} from './sports/soccer/soccer-stats.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const one = value => String(Math.round(value * 10) / 10);

// ---------------------------------------------------------------- distributions

// log Γ(x), Lanczos.
function logGamma(x) {
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function normalCdf(z) {
  // Abramowitz-Stegun 7.1.26 on erf.
  const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// P(X = k) for a count with this mean and variance: negative binomial when
// the games spread wider than a Poisson, Poisson otherwise.
function countPmf(k, mu, variance) {
  if (k < 0) return 0;
  if (variance > mu * 1.05) {
    const r = mu * mu / (variance - mu), p = r / (r + mu);
    return Math.exp(logGamma(k + r) - logGamma(k + 1) - logGamma(r) + r * Math.log(p) + k * Math.log(1 - p));
  }
  return Math.exp(k * Math.log(mu) - mu - logGamma(k + 1));
}

/**
 * The chance a stat with this mean and spread lands on `side` of `line`,
 * pushes (an exact whole-number line) left out. Counts use a count
 * distribution; big or fractional stats a normal curve.
 */
export function sideChance(mu, variance, line, side, {counts = true} = {}) {
  if (!finite(mu) || !finite(line)) return null;
  if (mu <= 0) return side === 'UNDER' ? 1 : 0;
  let over, push = 0;
  if (counts && (variance > mu * 1.05 || mu < 4)) {
    const k = Math.floor(line);
    let atMost = 0;
    for (let i = 0; i <= k; i++) atMost += countPmf(i, mu, variance);
    push = Number.isInteger(line) ? countPmf(line, mu, variance) : 0;
    over = 1 - atMost;
  } else {
    const sd = Math.sqrt(Math.max(variance, counts ? mu * 0.3 : (mu * 0.12) ** 2, 0.25));
    if (counts) {
      const k = Math.floor(line);
      over = 1 - normalCdf((k + 0.5 - mu) / sd);
      push = Number.isInteger(line) ? normalCdf((line + 0.5 - mu) / sd) - normalCdf((line - 0.5 - mu) / sd) : 0;
    } else over = 1 - normalCdf((line - mu) / sd);
  }
  const decided = 1 - push;
  if (decided <= 0) return null;
  const chance = side === 'UNDER' ? (1 - over - push) / decided : over / decided;
  return clamp(chance, 0.01, 0.99);
}

// The chance off a whole distribution ([P(0), P(1), ...]), pushes left out.
function pmfChance(pmf, line, side) {
  let over = 0, push = 0, total = 0;
  pmf.forEach((p, k) => { total += p; if (k > line) over += p; else if (k === line) push += p; });
  const decided = total - push;
  if (!(decided > 0)) return null;
  return clamp(side === 'UNDER' ? (decided - over) / decided : over / decided, 0.01, 0.99);
}

function convolve(a, b) {
  const out = new Array(a.length + b.length - 1).fill(0);
  a.forEach((x, i) => { if (x) b.forEach((y, j) => { out[i + j] += x * y; }); });
  return out;
}

// How many times he gets to do it (trips to the plate): spread around the
// expected number the way a lineup's trips are (a short game, a long one),
// most often the nearest one or two.
function trips(expected) {
  const out = [];
  let total = 0;
  for (let n = 1; n <= Math.ceil(expected) + 3; n++) {
    const weight = Math.exp(-((n - expected) ** 2) / (2 * 0.7 ** 2));
    if (weight > 1e-4) { out.push([n, weight]); total += weight; }
  }
  return out.map(([n, weight]) => [n, weight / total]);
}

// Per trip: nothing, or a hit worth 1-4 bases. A league hit is 64% singles,
// 20% doubles, 1.7% triples and 14.3% homers (1.66 bases); a hitter's own
// bases per hit tilts the extra-base share.
const LEAGUE_BASES_PER_HIT = 1.663;
function basesPerTrip(hit, perHit = LEAGUE_BASES_PER_HIT) {
  const extra = clamp((perHit - 1) / 1.8417, 0.05, 0.7);
  return [1 - hit, hit * (1 - extra), hit * extra * 0.2 / 0.36, hit * extra * 0.017 / 0.36, hit * extra * 0.143 / 0.36];
}

// ---------------------------------------------------------------- the stats

// unit: the opportunity -- 'pa' plate appearances, 'pitches', 'toi' minutes
// on the ice, 'min' minutes. shape: 'binary' (one at most a trip),
// 'bases' (total bases), 'count' (negative binomial, `spread` times a
// Poisson's variance), 'curve' (a normal curve), 'self' (the stat is the
// opportunity: pitches, ice time). k: see above. market: how far, as a
// chance, PrizePicks' regular lines in the stat tend to sit from even --
// wide where one number is posted for nearly everyone (0.5 hits, 0.5
// points in hockey), narrow where each player gets his own (basketball).
// error: how far off the model itself runs, as a share of the projection,
// beyond what his games leave unknown (runs and RBIs ride on teammates).
const stat = (shape, k, market, error, extra = {}) => ({shape, k, market, error, ...extra});
const PROFILES = {
  // MLB hitters, per plate appearance.
  'hitting:hits': stat('binary', 450, 0.09, 0.06, {unit: 'pa'}),
  'hitting:singles': stat('binary', 450, 0.09, 0.06, {unit: 'pa'}),
  'hitting:tb': stat('bases', 200, 0.08, 0.07, {unit: 'pa'}),
  'hitting:hits-walks': stat('count', 300, 0.08, 0.06, {unit: 'pa', spread: 0.9}),
  'hitting:hrr': stat('count', 250, 0.07, 0.1, {unit: 'pa', spread: 1.6}),
  'hitting:strikeouts': stat('binary', 60, 0.08, 0.06, {unit: 'pa'}),
  'hitting:walks': stat('binary', 120, 0.07, 0.1, {unit: 'pa'}),
  'hitting:hr': stat('binary', 170, 0.05, 0.15, {unit: 'pa'}),
  'hitting:doubles': stat('binary', 300, 0.05, 0.15, {unit: 'pa'}),
  'hitting:triples': stat('binary', 300, 0.04, 0.2, {unit: 'pa'}),
  'hitting:xbh': stat('binary', 250, 0.06, 0.12, {unit: 'pa'}),
  'hitting:rbi': stat('count', 400, 0.06, 0.15, {unit: 'pa', spread: 1.6}),
  'hitting:runs': stat('count', 400, 0.06, 0.15, {unit: 'pa', spread: 1.5}),
  'hitting:runs-rbis': stat('count', 400, 0.06, 0.15, {unit: 'pa', spread: 1.6}),
  'hitting:sb': stat('count', 300, 0.05, 0.2, {unit: 'pa', spread: 1.3}),
  'hitting:fantasy': stat('curve', 300, 0.05, 0.12, {unit: 'pa'}),
  // MLB pitchers, per pitch.
  'pitching:strikeouts': stat('count', 400, 0.06, 0.07, {unit: 'pitches', spread: 1.1}),
  'pitching:outs': stat('curve', 1000, 0.05, 0.08, {unit: 'pitches'}),
  'pitching:batters-faced': stat('curve', 1000, 0.05, 0.08, {unit: 'pitches'}),
  'pitching:pitches': stat('self', 0, 0.04, 0.06, {unit: 'pitches'}),
  'pitching:pitcher-fantasy': stat('curve', 800, 0.05, 0.08, {unit: 'pitches'}),
  'pitching:hits': stat('count', 2000, 0.06, 0.1, {unit: 'pitches', spread: 1.25}),
  'pitching:walks': stat('count', 900, 0.06, 0.1, {unit: 'pitches', spread: 1.2}),
  'pitching:earned-runs': stat('count', 2500, 0.06, 0.15, {unit: 'pitches', spread: 1.7}),
  'pitching:runs-allowed': stat('count', 2500, 0.06, 0.15, {unit: 'pitches', spread: 1.7}),
  'pitching:hr-allowed': stat('count', 3000, 0.05, 0.2, {unit: 'pitches', spread: 1.2}),
  // One inning says next to nothing.
  'pitching:first-hits': stat(null, 0, 0.04, 0.2),
  'pitching:first-runs': stat(null, 0, 0.04, 0.2),
  'pitching:first-walks': stat(null, 0, 0.04, 0.2),
  'pitching:first-pitches': stat(null, 0, 0.04, 0.2),
  'pitching:first-ks': stat(null, 0, 0.04, 0.2),
  // NHL skaters, per minute on the ice.
  'skater:sog': stat('count', 100, 0.07, 0.06, {unit: 'toi', spread: 1.15}),
  'skater:attempts': stat('count', 100, 0.06, 0.06, {unit: 'toi', spread: 1.2}),
  'skater:hits': stat('count', 120, 0.07, 0.08, {unit: 'toi', spread: 1.35}),
  'skater:blocked': stat('count', 150, 0.07, 0.08, {unit: 'toi', spread: 1.35}),
  'skater:hits_blocks': stat('count', 120, 0.07, 0.08, {unit: 'toi', spread: 1.3}),
  'skater:fow': stat('count', 100, 0.05, 0.06, {unit: 'toi', spread: 1.1}),
  'skater:faceoffs': stat('count', 100, 0.05, 0.06, {unit: 'toi', spread: 1.05}),
  'skater:toi': stat('self', 0, 0.04, 0.04, {unit: 'toi'}),
  'skater:points': stat('count', 300, 0.09, 0.08, {unit: 'toi', spread: 1.05}),
  'skater:fantasy': stat('curve', 250, 0.05, 0.1, {unit: 'toi'}),
  'skater:goals': stat('count', 600, 0.08, 0.12, {unit: 'toi', spread: 1}),
  'skater:assists': stat('count', 450, 0.08, 0.12, {unit: 'toi', spread: 1}),
  'skater:ppp': stat('count', 600, 0.08, 0.15, {unit: 'toi', spread: 1}),
  'skater:pim': stat(null, 0, 0.05, 0.2),
  'skater:plus_minus': stat(null, 0, 0.05, 0.2),
  // NHL goalies: saves follow the shots, and whether he starts.
  'goalie:saves': stat('count', 300, 0.045, 0.08, {unit: 'toi', spread: 1.1}),
  'goalie:ga': stat('count', 900, 0.06, 0.12, {unit: 'toi', spread: 1.1}),
  'goalie:fantasy': stat('curve', 600, 0.05, 0.12, {unit: 'toi'}),
  // Basketball, per minute.
  'basketball:pts': stat('count', 50, 0.055, 0.05, {unit: 'min', spread: 1.8}),
  'basketball:reb': stat('count', 40, 0.055, 0.05, {unit: 'min', spread: 1.3}),
  'basketball:ast': stat('count', 40, 0.055, 0.05, {unit: 'min', spread: 1.4}),
  'basketball:pr': stat('count', 50, 0.055, 0.05, {unit: 'min', spread: 1.7}),
  'basketball:pa': stat('count', 50, 0.055, 0.05, {unit: 'min', spread: 1.7}),
  'basketball:ra': stat('count', 40, 0.055, 0.05, {unit: 'min', spread: 1.4}),
  'basketball:pra': stat('count', 50, 0.055, 0.05, {unit: 'min', spread: 1.8}),
  'basketball:fs': stat('curve', 50, 0.055, 0.05, {unit: 'min'}),
  'basketball:tpm': stat('count', 100, 0.05, 0.07, {unit: 'min', spread: 1.15}),
  'basketball:tpa': stat('count', 60, 0.05, 0.06, {unit: 'min', spread: 1.2}),
  'basketball:fgm': stat('count', 60, 0.05, 0.06, {unit: 'min', spread: 1.3}),
  'basketball:fga': stat('count', 50, 0.05, 0.06, {unit: 'min', spread: 1.3}),
  'basketball:ftm': stat('count', 80, 0.05, 0.08, {unit: 'min', spread: 1.4}),
  'basketball:fta': stat('count', 80, 0.05, 0.08, {unit: 'min', spread: 1.4}),
  'basketball:twos': stat('count', 60, 0.05, 0.06, {unit: 'min', spread: 1.3}),
  'basketball:twosa': stat('count', 50, 0.05, 0.06, {unit: 'min', spread: 1.3}),
  'basketball:oreb': stat('count', 60, 0.05, 0.07, {unit: 'min', spread: 1.3}),
  'basketball:dreb': stat('count', 50, 0.05, 0.07, {unit: 'min', spread: 1.3}),
  'basketball:to': stat('count', 100, 0.05, 0.08, {unit: 'min', spread: 1.2}),
  'basketball:bs': stat('count', 100, 0.05, 0.08, {unit: 'min', spread: 1.2}),
  'basketball:blk': stat('count', 100, 0.06, 0.1, {unit: 'min', spread: 1.2}),
  'basketball:stl': stat('count', 100, 0.06, 0.1, {unit: 'min', spread: 1.1}),
  'basketball:pf': stat('count', 100, 0.05, 0.1, {unit: 'min', spread: 1.1}),
  // Soccer, per minute played. One number for most players (0.5 shots on
  // target, 1.5 shots, 2.5 saves) sits further from even than basketball's.
  'soccer:saves': stat('count', 300, 0.07, 0.08, {unit: 'min', spread: 1.1}),
  'soccer:sotf': stat('count', 300, 0.07, 0.08, {unit: 'min', spread: 1.1}),
  'soccer:gc': stat('count', 600, 0.06, 0.12, {unit: 'min', spread: 1.1}),
  'soccer:shots': stat('count', 270, 0.07, 0.07, {unit: 'min', spread: 1.3}),
  'soccer:sot': stat('count', 450, 0.07, 0.08, {unit: 'min', spread: 1.2}),
  'soccer:sa': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.3}),
  'soccer:goals': stat('count', 900, 0.06, 0.12, {unit: 'min', spread: 1.05}),
  'soccer:ast': stat('count', 900, 0.06, 0.12, {unit: 'min', spread: 1.05}),
  'soccer:ga': stat('count', 900, 0.06, 0.12, {unit: 'min', spread: 1.05}),
  'soccer:passAtt': stat('count', 180, 0.06, 0.06, {unit: 'min', spread: 1.3}),
  'soccer:passes': stat('count', 180, 0.06, 0.06, {unit: 'min', spread: 1.3}),
  'soccer:touch': stat('count', 180, 0.06, 0.06, {unit: 'min', spread: 1.3}),
  'soccer:cross': stat('count', 270, 0.06, 0.08, {unit: 'min', spread: 1.4}),
  'soccer:crossAcc': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.3}),
  'soccer:clear': stat('count', 270, 0.07, 0.08, {unit: 'min', spread: 1.4}),
  'soccer:tackles': stat('count', 270, 0.07, 0.08, {unit: 'min', spread: 1.3}),
  'soccer:tacklesWon': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.3}),
  'soccer:int': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.3}),
  'soccer:blk': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.3}),
  'soccer:fouls': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.2}),
  'soccer:fd': stat('count', 450, 0.06, 0.1, {unit: 'min', spread: 1.3}),
  'soccer:drib': stat('count', 270, 0.06, 0.08, {unit: 'min', spread: 1.4}),
  'soccer:off': stat('count', 600, 0.05, 0.12, {unit: 'min', spread: 1.2}),
  'soccer:yc': stat('count', 900, 0.05, 0.15, {unit: 'min', spread: 1.05}),
  'basketball:dd': stat(null, 0, 0.05, 0.15),
  'basketball:td': stat(null, 0, 0.04, 0.2),
};
const BASKETBALL_STATS = {player_points: 'pts', player_rebounds: 'reb', player_assists: 'ast', player_threes: 'tpm',
  player_blocks: 'blk', player_steals: 'stl', player_blocks_steals: 'bs', player_turnovers: 'to', player_points_rebounds: 'pr',
  player_points_assists: 'pa', player_rebounds_assists: 'ra', player_points_rebounds_assists: 'pra', player_fantasy_points: 'fs',
  player_threes_attempts: 'tpa', player_field_goals: 'fgm', player_frees_made: 'ftm', player_field_goals_attempts: 'fga',
  player_frees_attempts: 'fta', player_twos: 'twos', player_twos_attempts: 'twosa', player_fouls: 'pf',
  player_offensive_rebounds: 'oreb', player_defensive_rebounds: 'dreb', player_double_double: 'dd', player_triple_double: 'td'};

const isGoalie = row => String(row.position || '').toUpperCase() === 'G';

/** The model's name for a line's stat ('hitting:hits', 'skater:sog', 'basketball:pts'), or null. */
export function modelKey(row) {
  if (!row) return null;
  if (row.sport === 'mlb') return row.marketKey ? String(row.marketKey) : null;
  if (row.sport === 'nhl') return row.valueKey ? `${isGoalie(row) ? 'goalie' : 'skater'}:${row.valueKey}` : null;
  if (row.sport === 'nba' || row.sport === 'wnba') {
    const key = BASKETBALL_STATS[row.marketKey];
    return key ? `basketball:${key}` : null;
  }
  if (row.sport === 'soccer') {
    const key = statKeyOf(row.marketKey);
    return key ? `soccer:${key}` : null;
  }
  return null;
}

/** What the model knows about a line's stat, or null. */
export const profileOf = row => PROFILES[modelKey(row)] || null;


// ---------------------------------------------------------------- the board's rates

// Who a player is compared with: the same job.
function peerGroup(row) {
  const position = String(row.position || '').toUpperCase();
  if (row.sport === 'nhl') return isGoalie(row) ? 'G' : position === 'D' ? 'D' : 'F';
  if (row.sport === 'nba' || row.sport === 'wnba') return /C/.test(position) ? 'C' : /F/.test(position) ? 'F' : 'G';
  if (row.sport === 'soccer') return ['G', 'D', 'M', 'F'].find(letter => position.startsWith(letter)) || '';
  return '';
}

const played = row => (row.gameLog || []).filter(game => finite(game.value) && finite(game.usage) && game.usage > 0);

/**
 * Each line with what the rest of the board does per opportunity in its
 * stat (`modelPrior`, the median of every other player at the position
 * with a line in it, six at least) and, for total bases, the hitter's
 * bases per hit from his own hits line (`basesPerHit`).
 */
export function withModelPriors(rows) {
  if (!Array.isArray(rows)) return rows;
  const groups = new Map(), hits = new Map();
  for (const row of rows) {
    const key = modelKey(row);
    const profile = PROFILES[key];
    if (!profile?.unit || profile.shape === 'self') continue;
    const games = played(row);
    if (games.length < 5) continue;
    const usage = games.reduce((sum, game) => sum + game.usage, 0);
    const group = `${row.sport}|${key}|${peerGroup(row)}`;
    if (!groups.has(group)) groups.set(group, new Map());
    if (!groups.get(group).has(row.player)) groups.get(group).set(row.player, games.reduce((sum, game) => sum + game.value, 0) / usage);
    if (key === 'hitting:hits' && !hits.has(row.player)) hits.set(row.player, new Map(games.map(game => [game.date, game.value])));
  }
  return rows.map(row => {
    const key = modelKey(row);
    if (!PROFILES[key]?.unit) return row;
    const extra = {};
    const peers = groups.get(`${row.sport}|${key}|${peerGroup(row)}`);
    if (peers) {
      const others = [...peers].filter(([player]) => player !== row.player).map(([, rate]) => rate).sort((a, b) => a - b);
      if (others.length >= 6) extra.modelPrior = others[Math.floor(others.length / 2)];
    }
    if (key === 'hitting:tb' && hits.has(row.player)) {
      const byDate = hits.get(row.player);
      let bases = 0, count = 0;
      for (const game of played(row)) if (byDate.has(game.date)) { bases += game.value; count += byDate.get(game.date); }
      // Twenty hits at least say something about his power.
      if (count >= 20) extra.basesPerHit = clamp(bases / count, 1.1, 2.6);
    }
    return Object.keys(extra).length ? {...row, ...extra} : row;
  });
}

// ---------------------------------------------------------------- today's game

// Trips to the plate by lineup spot (the home side skips the bottom of the
// ninth when ahead, about a tenth of a trip).
const PA_BY_SPOT = [null, 4.65, 4.55, 4.45, 4.35, 4.25, 4.1, 4.0, 3.9, 3.8];
// How much a team's expected scoring moves each stat (basketball, NHL).
const SCORING_WEIGHT = {pts: 0.5, pr: 0.45, pa: 0.45, pra: 0.45, fs: 0.45, ast: 0.4, ra: 0.35, reb: 0.3, tpm: 0.4, tpa: 0.4, fgm: 0.4,
  fga: 0.4, ftm: 0.4, fta: 0.4, twos: 0.4, twosa: 0.4, points: 0.8, goals: 0.8, assists: 0.8, ppp: 0.8, sog: 0.3, attempts: 0.3,
  fantasy: 0.5};
const LEAGUE_GOALS = 3.05;

// The team's expected scoring today against a normal game: from the
// game's odds when they're in (its total and spread or moneyline), else
// from both teams' scoring for and against (slip-matchup.js withMatchups).
function scoringRatio(row) {
  const odds = row.game?.odds, team = row.game?.team;
  const normal = row.scoring?.normal;
  if (odds && finite(odds.total) && team) {
    let own = null;
    if (row.sport === 'nhl') {
      const win = odds.win?.[team];
      if (finite(win)) own = (odds.total + (win - 0.5) * 3) / 2;
    } else if (finite(odds.spread?.[team])) own = (odds.total - odds.spread[team]) / 2;
    const base = finite(normal) && normal > 0 ? normal : row.sport === 'nhl' ? LEAGUE_GOALS : null;
    if (finite(own) && base) return {ratio: own / base, text: `${row.teamAbbr || 'His team'} is expected to score about ${one(own)} (${row.sport === 'nhl' ? 'goals' : 'points'})`, odds: true};
  }
  if (row.scoring && finite(row.scoring.expected) && finite(normal) && normal > 0) {
    // Team ratings say less than the market: half as much.
    return {ratio: 1 + (row.scoring.expected / normal - 1) * 0.5, text: null, odds: false};
  }
  return null;
}

/**
 * What today's game changes before a ball is thrown or a puck dropped:
 * his lineup spot (MLB), whether he starts (soccer), who's out around him and what that has meant
 * (basketball), the chance of a blowout and the scoring the game is
 * expected to have. `rate` and `usage` scale the model's rate and
 * opportunities; `used` names the game-news facts it has counted
 * (slip-matchup.js leaves them out of the matchup score); `notes` say it.
 */
export function gameContext(row, profile = profileOf(row), expectedUsage = null) {
  const out = {rate: 1, usage: 1, spot: null, role: null, used: [], notes: [], risks: []};
  if (!row?.game || !profile) return out;
  const key = modelKey(row).split(':')[1];
  const news = newsOf(row);
  if (row.sport === 'mlb' && profile.unit === 'pa' && news?.lineup?.spot) {
    out.spot = news.lineup.spot;
    out.used.push('lineup');
  }
  // Soccer: a posted lineup says whether he starts or comes off the bench.
  if (row.sport === 'soccer' && news?.lineup?.confirmed) out.role = news.lineup.listed ? 'starter' : 'bench';
  if (row.sport === 'nba' || row.sport === 'wnba') {
    // Who's out: what his numbers have been without them, by how many games say so.
    let scale = 1;
    for (const mate of news?.out || []) {
      const split = (row.game.teammates || []).find(item => samePerson(item.name, mate.name));
      if (!(split?.without?.games >= 2 && split?.with?.games >= 2 && finite(split.without.avg) && finite(split.with.avg) && split.with.avg > 0)) continue;
      const weight = split.without.games / (split.without.games + 5) * (mate.level === 'doubtful' ? 0.6 : 1);
      scale *= 1 + (clamp(split.without.avg / split.with.avg, 0.5, 2) - 1) * weight;
      out.used.push(`mate:${mate.name}`);
      out.notes.push({key: 'teammates', text: `Without ${mate.name}: ${one(split.without.avg)} a game in ${split.without.games} (${one(split.with.avg)} with)`});
    }
    out.rate *= clamp(scale, 0.8, 1.3);
    // A big favorite or underdog: starters sit the fourth quarter of a blowout.
    const spread = row.game.odds?.spread?.[row.game.team];
    if (finite(spread) && Math.abs(spread) > 7 && finite(expectedUsage) && expectedUsage >= 24) {
      const cut = Math.min(0.07, (Math.abs(spread) - 7) * 0.006);
      out.usage *= 1 - cut;
      out.notes.push({key: 'blowout', text: `A ${one(Math.abs(spread))}-point spread: about ${one(expectedUsage * cut)} fewer minutes if it gets out of hand`});
      if (cut >= 0.03) out.risks.push(`Blowout risk (${one(Math.abs(spread))}-point spread)`);
    }
  }
  const weight = SCORING_WEIGHT[key];
  if (weight && ['nba', 'wnba', 'nhl'].includes(row.sport) && (row.sport !== 'nhl' || !isGoalie(row))) {
    const scoring = scoringRatio(row);
    if (scoring) {
      const cap = row.sport === 'nhl' ? 0.15 : 0.08;
      out.rate *= clamp(1 + (scoring.ratio - 1) * weight, 1 - cap, 1 + cap);
      out.used.push('pace');
      if (scoring.text) out.notes.push({key: 'scoring', text: scoring.text});
    }
  }
  return out;
}

// ---------------------------------------------------------------- one line

const HALF_LIFE = {pa: 30, pitches: 8, toi: 20, min: 12};
// His opportunities lately: the last this many games, a game this many back counting half.
const USAGE_GAMES = {pa: 15, pitches: 6, toi: 10, min: 10};
const USAGE_HALF_LIFE = {pa: 6, pitches: 3, toi: 4, min: 4};

function weighted(games, halfLife, value) {
  const n = games.length;
  let weights = 0, total = 0, square = 0;
  games.forEach((game, index) => {
    const weight = 0.5 ** ((n - 1 - index) / halfLife);
    const x = value(game);
    weights += weight; total += weight * x; square += weight * x * x;
  });
  const average = total / weights;
  return {average, sd: Math.sqrt(Math.max(0, square / weights - average * average))};
}

// His opportunities today, before the game's news: his recent ones,
// recent games counting most. A basketball game he left early (under 40%
// of his usual minutes) is left out; a soccer match off the bench isn't,
// since rotation is part of what a soccer line risks.
function expectedUsage(games, unit, early = true) {
  let recent = games.slice(-USAGE_GAMES[unit]);
  if (unit === 'min' && early && recent.length >= 4) {
    const sorted = recent.map(game => game.usage).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const kept = recent.filter(game => game.usage >= 0.4 * median);
    if (kept.length >= 3) recent = kept;
  }
  return weighted(recent, USAGE_HALF_LIFE[unit], game => game.usage);
}

/**
 * A line's stat projected: his rate per opportunity (recent games counting
 * most, the rest of his season at half weight, pulled toward the board's
 * rate by `k`), his opportunities today (his lineup spot when it's posted)
 * and today's game. Null when the model doesn't know the stat or he has
 * fewer than five games with their opportunities counted.
 */
export function projectStat(row) {
  const profile = profileOf(row);
  if (!profile?.unit || !profile.shape) return null;
  const games = played(row);
  if (games.length < 5) return null;
  const n = games.length;
  const values = games.map(game => game.value);
  const plain = mean(values);
  const variance = n > 1 ? values.reduce((sum, value) => sum + (value - plain) ** 2, 0) / (n - 1) : plain;
  const usage = expectedUsage(games, profile.unit, row.sport !== 'soccer');
  const context = gameContext(row, profile, usage.average);
  let opportunities = usage.average;
  if (context.spot) opportunities = PA_BY_SPOT[context.spot] - (row.isHome === true ? 0.1 : 0);
  if (context.role) {
    // Starting: his minutes in the matches he started (60+); on the bench: in the ones he didn't.
    const matches = games.slice(-15).filter(game => (game.usage >= 60) === (context.role === 'starter'));
    opportunities = matches.length >= 2 ? weighted(matches, 4, game => game.usage).average : context.role === 'starter' ? 85 : 20;
  }
  opportunities *= context.usage;

  let rate = 1, volume = 0, prior = null;
  if (profile.shape !== 'self') {
    const totalUsage = games.reduce((sum, game) => sum + game.usage, 0);
    const meanUsage = totalUsage / n;
    let weights = 0, made = 0, used = 0;
    games.forEach((game, index) => {
      const weight = 0.5 ** ((n - 1 - index) / HALF_LIFE[profile.unit]);
      weights += weight; made += weight * game.value; used += weight * game.usage;
    });
    let own = made / used;
    volume = totalUsage;
    // The rest of his season, beyond the games in the log, at half weight.
    const season = row.windows?.season;
    const seasonGames = finite(season?.sample) ? season.sample : null;
    if (finite(season?.average) && seasonGames > n) {
      const rest = (seasonGames * season.average - n * plain) / (seasonGames - n);
      if (rest >= 0) {
        const extra = (seasonGames - n) * meanUsage * 0.5;
        own = (volume * own + extra * rest / meanUsage) / (volume + extra);
        volume += extra;
      }
    }
    prior = finite(row.modelPrior) ? row.modelPrior : null;
    rate = prior != null && profile.k ? (volume * own + profile.k * prior) / (volume + profile.k) : own;
  }
  const meanUsage = games.reduce((sum, game) => sum + game.usage, 0) / n;
  return {key: modelKey(row), shape: profile.shape, unit: profile.unit, spread: profile.spread ?? 1, market: profile.market, error: profile.error,
    rate, usage: opportunities, usageSd: usage.sd, recentUsage: usage.average, meanUsage, games: n, volume,
    evidence: volume + (prior != null ? profile.k : 0), prior, plain, variance,
    counts: values.every(value => Number.isInteger(value) && value >= 0), basesPerHit: row.basesPerHit ?? null, context};
}

/** The model's expected value for the stat, with its rate and opportunities scaled. */
export function modelMean(model, {rate = 1, usage = 1} = {}) {
  if (!model) return null;
  return model.shape === 'self' ? model.usage * usage : model.rate * rate * model.usage * usage;
}

/**
 * The chance the stat lands on `side` of `line` under the model, its rate
 * and opportunities scaled (`rate` by the matchup, say), pushes left out.
 */
export function modelChance(model, line, side, {rate = 1, usage = 1} = {}) {
  if (!model || !finite(line)) return null;
  const expected = model.usage * usage;
  if (model.shape === 'binary' || model.shape === 'bases') {
    const perHit = model.shape === 'bases' ? model.basesPerHit || LEAGUE_BASES_PER_HIT : 1;
    const p = clamp(model.rate * rate / perHit, 0.0005, 0.9);
    const trip = model.shape === 'bases' ? basesPerTrip(p, perHit) : [1 - p, p];
    const pmf = [];
    let power = [1], done = 0;
    for (const [n, weight] of trips(expected)) {
      while (done < n) { power = convolve(power, trip); done += 1; }
      power.forEach((value, k) => { pmf[k] = (pmf[k] || 0) + weight * value; });
    }
    return pmfChance(pmf, line, side);
  }
  const mu = modelMean(model, {rate, usage});
  if (!(mu > 0)) return side === 'UNDER' ? 1 : 0;
  // His own games' spread, scaled to today's projection, and the stat's
  // usual spread around a Poisson with his opportunities' own swing.
  const games = model.plain > 0 ? model.variance * mu / model.plain : model.variance;
  if (model.shape === 'self') return sideChance(mu, Math.max(model.usageSd ** 2, games), line, side, {counts: model.counts});
  if (model.shape === 'curve') return sideChance(mu, games, line, side, {counts: false});
  const usual = mu * model.spread + (model.rate * rate * model.usageSd * usage) ** 2;
  return sideChance(mu, 0.5 * usual + 0.5 * games, line, side, {counts: model.counts});
}

// How unsure the projection is, as a share of it: his rate (by the
// opportunities behind it), his opportunities today (by how much they've
// swung lately; little once his lineup spot is posted) and the model's own
// error in the stat.
function uncertainty(model) {
  const evidence = Math.max(1, model.evidence || model.volume || 1);
  let rate = 0;
  if (model.rate > 0) {
    if (model.shape === 'binary') { const p = clamp(model.rate, 0.001, 0.95); rate = Math.sqrt((1 - p) / (p * evidence)); }
    else if (model.shape === 'bases') rate = Math.sqrt(2.4 / (model.rate * evidence));
    else if (model.shape === 'count') rate = Math.sqrt(model.spread / (model.rate * evidence));
    else if (model.shape === 'curve') rate = model.plain > 0 ? Math.sqrt(model.variance / model.plain ** 2 / Math.max(1, evidence / model.meanUsage)) : 0.3;
  } else if (model.shape !== 'self') rate = 0.5;
  const usage = model.context?.spot || model.context?.role === 'starter' ? 0.03 : model.usage > 0 ? model.usageSd / model.usage / Math.sqrt(5) : 0;
  return Math.min(0.6, Math.sqrt(rate ** 2 + usage ** 2 + model.error ** 2));
}

/**
 * The model's chance for a side (`raw`), and that chance held toward the
 * line's break-even (`baseline`) by how sure it can be against how far the
 * stat's lines tend to be off: `weight` is the share of its edge it keeps,
 * `unsure` how far the chance itself could be off.
 */
export function modelRead(model, line, side, {rate = 1, baseline = 0.5} = {}) {
  const raw = modelChance(model, line, side, {rate});
  if (raw == null) return null;
  const spread = uncertainty(model);
  const at = factor => modelChance(model, line, side, model.shape === 'self' ? {rate, usage: factor} : {rate: rate * factor});
  const unsure = Math.abs(at(1 + spread) - at(Math.max(0.05, 1 - spread))) / 2;
  const weight = model.market ** 2 / (model.market ** 2 + unsure ** 2);
  return {raw, chance: clamp(baseline + (raw - baseline) * weight, 0.02, 0.98), weight, unsure, spread};
}

/** What the model expects of his opportunities, in words ("4.6 trips to the plate"). */
export function usageWords(model) {
  if (!model) return null;
  const amount = model.usage;
  if (model.unit === 'pa') return `${one(amount)} plate appearances`;
  if (model.unit === 'pitches') return `${Math.round(amount)} pitches`;
  if (model.unit === 'toi') return `${one(amount)} minutes on the ice`;
  return `${one(amount)} minutes`;
}
