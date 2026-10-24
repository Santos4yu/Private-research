// Picks from one game rise and fall together. A quarterback's passing yards
// and his receiver's catching yards hit together; a pitcher's strikeouts and
// the hitters he faces work against each other. Each pair of picks gets a
// correlation for its sides (rho, -1 to 1) from what each pick is and how the
// two players are related (the same player, teammates, opponents), and the
// parlay's chance of every pick hitting is adjusted for it.
//
// The numbers are deliberately modest, the size the research on same-game
// parlays tends to find; they never turn two coin flips into a lock. The
// basketball ones are measured: two NBA seasons of every pair of rotation
// players in one game, each beating his own average (tools/nba-backtest).
// Teammates' points barely move together, nor do opponents': only a
// teammate's assists with a scorer's points, and two centers splitting the
// boards, show up.
import {rowStatKey, personKey} from './slip-check.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const lastName = name => String(name || '').split(' ').filter(word => !/^(jr|sr|ii|iii|iv)\.?$/i.test(word)).at(-1) || name;

/** What a line measures, by sport, for pairing: passing, receiving, strikeouts... */
export function role(row) {
  const key = rowStatKey(row) || '';
  const sport = row.sport;
  if (sport === 'nfl' || sport === 'cfb') {
    const words = key.split('+');
    if (words.includes('fantasy')) return /QB/i.test(row.position || '') ? 'pass' : /RB/i.test(row.position || '') ? 'rush' : 'receive';
    if (words.includes('td') && words.includes('rush') && words.includes('rec')) return 'td';
    if (words.includes('pass')) return 'pass';
    if (words.includes('rec') || words.includes('receptions') || words.includes('targets')) return 'receive';
    if (words.includes('rush')) return 'rush';
    return 'other';
  }
  if (sport === 'mlb') {
    if (key === 'p:strikeouts') return 'pk';
    if (/^p:(hits|earned|runs|walks|home|hr)/.test(key)) return 'pallow';
    if (key.startsWith('p:')) return 'pouts';
    if (key === 'h:strikeouts') return 'hk';
    return 'hit';
  }
  if (sport === 'nba' || sport === 'wnba') {
    const parts = key.split('+');
    if (parts.includes('pts') || parts.includes('fantasy') || parts.includes('3pm')) return 'score';
    if (parts.includes('ast')) return 'assist';
    if (parts.includes('reb')) return 'board';
    return 'other';
  }
  if (sport === 'nhl') {
    if (key === 'saves') return 'saves';
    if (key === 'ga') return 'ga';
    if (key === 'sog' || key === 'attempts') return 'shots';
    if (/pts|goals|ast|ppp/.test(key)) return 'score';
    return 'other';
  }
  if (sport === 'soccer') {
    if (key === 'saves') return 'saves';
    if (/goals|ast|shots|sot/.test(key)) return 'attack';
    return 'other';
  }
  return 'other';
}

// rho for both picks on the over, by how the players are related and what
// each line measures; the order of the two roles doesn't matter.
const TABLE = {
  nfl: {
    team: {'pass|receive': [0.3, 'feed'], 'pass|td': [0.12, 'feed'], 'pass|rush': [-0.08, 'script'], 'receive|receive': [-0.06, 'share'],
      'receive|rush': [-0.03, 'script'], 'rush|td': [0.08, 'feed']},
    opponents: {'pass|pass': [0.12, 'shootout'], 'pass|receive': [0.08, 'shootout'], 'receive|receive': [0.06, 'shootout'],
      'pass|rush': [-0.05, 'script']},
  },
  mlb: {
    team: {'hit|hit': [0.12, 'rally']},
    opponents: {'hit|pk': [-0.2, 'pitcher'], 'hk|pk': [0.25, 'pitcher-k'], 'hit|pallow': [0.25, 'pitcher-hit'], 'hk|pallow': [-0.15, 'pitcher'],
      'hit|pouts': [-0.12, 'pitcher']},
  },
  basketball: {
    team: {'assist|score': [0.045, 'feed'], 'board|board': [0, 'share']},
  },
  nhl: {
    team: {'score|score': [0.12, 'line'], 'score|shots': [0.08, 'line']},
    opponents: {'saves|shots': [0.2, 'shots-faced'], 'ga|score': [0.3, 'goals-allowed'], 'saves|score': [-0.05, 'goalie']},
  },
  soccer: {
    team: {'attack|attack': [0.05, 'line']},
    opponents: {'attack|saves': [0.2, 'shots-faced']},
  },
};
const family = sport => sport === 'nba' || sport === 'wnba' ? 'basketball' : sport === 'cfb' ? 'nfl' : sport;

// One basketball player's two lines, by stat (measured the same way); a
// combo and a stat inside it ride on the same numbers, two others he has
// no measure for get the middle of the measured ones.
const SAME = {'3pm|pts': 0.48, 'pts|reb': 0.21, 'ast|reb': 0.165, 'ast|pts': 0.15, '3pm|ast': 0.09, '3pm|reb': 0.09};
function sameHoops(a, b) {
  const [x, y] = [rowStatKey(a) || '', rowStatKey(b) || ''];
  const measured = SAME[[x, y].sort().join('|')];
  if (measured != null) return measured;
  const parts = key => key === 'fantasy' ? ['pts', 'reb', 'ast'] : key.split('+');
  return parts(x).some(part => parts(y).includes(part)) ? 0.5 : 0.15;
}
const center = row => String(row.position || '').toUpperCase().split('-')[0].trim() === 'C';

// The two players' teams and game, when the lines say.
const team = row => String(row.teamAbbr || row.team || '').toUpperCase();
const opponent = row => String(row.opponent || '').toUpperCase();
function relation(a, b) {
  if (a.sport !== b.sport) return null;
  if (a.gameId && b.gameId && a.gameId !== b.gameId) return null;
  const same = (a.playerId != null && a.playerId === b.playerId) || personKey(a.player) === personKey(b.player);
  if (same) return 'player';
  if (!team(a) || !team(b)) return null;
  if (team(a) === team(b)) return 'team';
  if (opponent(a) && opponent(a) === team(b)) return 'opponents';
  if (opponent(b) && opponent(b) === team(a)) return 'opponents';
  return null;
}

// Why two picks move together, in a few words.
function words(kind, a, b) {
  const [x, y] = [lastName(a.player), lastName(b.player)];
  return {
    player: `${x}'s two lines ride on the same game`,
    feed: `${x} and ${y} feed each other`,
    script: `${x} and ${y} need different game scripts`,
    share: `${x} and ${y} split the same chances`,
    shootout: `a shootout helps both ${x} and ${y}`,
    rally: `${x} and ${y} score off each other`,
    pitcher: `${x} and ${y} are on opposite sides of the same at-bats`,
    'pitcher-k': `${x} and ${y} both want strikeouts`,
    'pitcher-hit': `${x} and ${y} both want hits`,
    pace: `a fast game helps both ${x} and ${y}`,
    line: `${x} and ${y} score together`,
    'shots-faced': `${y}'s shots are ${x}'s saves`,
    'goals-allowed': `${y}'s goals count against ${x}`,
    goalie: `${x}'s saves and ${y}'s scoring pull different ways`,
  }[kind] || `${x} and ${y} are in the same game`;
}

/**
 * How two picks ({row, side, player}) move together: {rho, kind, text}, or
 * null when they don't (different games, or nothing ties them).
 */
export function link(a, b) {
  const how = relation(a.row, b.row);
  if (!how) return null;
  let rho, kind;
  if (how === 'player') {
    [rho, kind] = [family(a.row.sport) === 'basketball' ? sameHoops(a.row, b.row) : 0.5, 'player'];
  } else {
    const roles = [role(a.row), role(b.row)];
    const key = [...roles].sort().join('|');
    const entry = TABLE[family(a.row.sport)]?.[how]?.[key];
    if (!entry) return null;
    [rho, kind] = entry;
    // Two centers on one team take the same misses; other teammates' boards don't touch.
    if (family(a.row.sport) === 'basketball' && key === 'board|board') rho = center(a.row) && center(b.row) ? -0.06 : 0;
    if (!rho) return null;
  }
  // An under turns a pairing around; two unders move like two overs.
  if ((a.side === 'UNDER') !== (b.side === 'UNDER')) rho = -rho;
  const ordered = how === 'opponents' && /saves|ga|^p/.test(role(b.row)) ? [b, a] : [a, b];
  return {rho, kind, text: words(kind, ...ordered)};
}

// Two picks that work against each other (a hitter and the pitcher
// striking him out, two receivers splitting one team's targets) never go on
// a slip the site builds; ones that help each other are sought out.
export const AGAINST = -0.03;
export const TOGETHER = 0.08;
export const against = found => Boolean(found) && found.rho <= AGAINST;
export const together = found => Boolean(found) && found.rho >= TOGETHER;

/** Every linked pair among the picks: [{a, b, rho, kind, text, tone}], a and b being indexes. */
export function links(picks) {
  const out = [];
  for (let i = 0; i < picks.length; i++) {
    for (let j = i + 1; j < picks.length; j++) {
      if (!picks[i]?.row || !picks[j]?.row) continue;
      const found = link(picks[i], picks[j]);
      if (found && Math.abs(found.rho) >= 0.03) out.push({...found, a: i, b: j, tone: found.rho > 0 ? 'together' : 'against'});
    }
  }
  return out;
}

/**
 * The chance every pick hits, its pairs' correlations counted: the
 * independent product, each linked pair scaled by 1 + rho * sqrt(q_i q_j /
 * p_i p_j) (the pair's joint chance over their product), held between half
 * the product and the least likely pick.
 */
export function jointChance(chances, pairs = []) {
  const product = chances.reduce((total, p) => total * p, 1);
  if (!pairs.length) return product;
  let scale = 1;
  for (const pair of pairs) {
    const [p, q] = [chances[pair.a], chances[pair.b]];
    if (!finite(p) || !finite(q) || p <= 0 || q <= 0) continue;
    scale *= Math.max(0.3, 1 + pair.rho * Math.sqrt(((1 - p) * (1 - q)) / (p * q)));
  }
  return Math.min(Math.min(...chances), Math.max(product * 0.5, product * scale));
}
