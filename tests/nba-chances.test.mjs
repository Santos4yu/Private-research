// Rebound and assist chances for the NBA player page (src/sports/wnba/chances.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {assistChances, reboundChances} from '../src/sports/wnba/chances.js';

// His team MIN and tonight's opponent MIA in the opportunity table's shape ([value, rank], 1 the most).
const table = {count: 30, teams: {
  MIN: {miss: [45, 12], missAllowed: [44, 15], orebPct: [25, 14], orebAllowedPct: [26, 16], fgm: [42, 10], assistedPct: [60, 15]},
  MIA: {miss: [48, 4], missAllowed: [46, 8], orebPct: [30, 3], orebAllowedPct: [28, 6], fgm: [40, 20], fgmAllowed: [44, 5],
    assistedPct: [62, 9], assistedAllowed: [66, 2], rebAllowed: [46, 7], astAllowed: [28, 4], fgPctAllowed: [48, 6]},
}};
const player = {opportunity: {
  szn: {games: 40, dreb: 7, oreb: 2, ast: 6, drebShare: 22, orebShare: 8, missesOn: 60, astShare: 30, mateFg: 47},
  l10: {games: 10, dreb: 8, oreb: 2, ast: 7},
}};

test('rebounds: tonight\'s misses on each end against his team\'s usual game, his own boards moved by as much', () => {
  const read = reboundChances(player, table, 'MIN', 'MIA');
  // Defense: MIA's misses (48) and what MIN forces (44) halfway, 46; MIA get
  // back 30% and teams 26% vs MIN, 28%: 46 x 0.72 = 33.12 against MIN's
  // usual 44 x 0.74 = 32.56. Offense: MIN's 45 misses and MIA's 46 allowed,
  // 45.5, at 26.5% (25 and 28) = 12.06 against 45 x 25% = 11.25.
  assert.ok(Math.abs(read.ends[0].tonight - 33.12) < 0.01 && Math.abs(read.ends[0].usual - 32.56) < 0.01);
  assert.ok(Math.abs(read.ends[1].tonight - 45.5 * 0.265) < 0.01 && Math.abs(read.ends[1].usual - 11.25) < 0.01);
  // His last 10 (8 defensive, 2 offensive) moved by each: 8 x 33.12/32.56 + 2 x 12.0575/11.25.
  assert.ok(Math.abs(read.expected - (8 * 33.12 / 32.56 + 2 * 45.5 * 0.265 / 11.25)) < 0.001);
  assert.equal(read.usual, 10);
  assert.equal(read.basis, 'his last 10');
  assert.deepEqual(read.mine.map(item => [item.key, item.value]), [['drebShare', '22.0%'], ['orebShare', '8.0%'], ['missesOn', '60.0']]);
  const rows = Object.fromEntries(read.rows.map(item => [item.key, [item.value, item.words, item.tone]]));
  assert.deepEqual(rows.miss, ['48.0 a game', '4th most', 'good']);
  // The more they crash, the fewer fall to him: 3rd most is against him.
  assert.deepEqual(rows.orebPct, ['30.0%', '3rd most', 'poor']);
});

test('assists: tonight\'s baskets and the share assisted against his team\'s usual', () => {
  const read = assistChances(player, table, 'MIN', 'MIA');
  // MIN make 42, MIA allow 44: 43; 60% and 66% assisted: 63%. 43 x 0.63 = 27.09
  // assisted baskets against MIN's usual 42 x 0.60 = 25.2; his last 10's 7 moved by as much.
  assert.equal(read.makes, 43);
  assert.equal(read.assisted, 63);
  assert.ok(Math.abs(read.expected - 7 * 27.09 / 25.2) < 0.001);
  assert.equal(read.text, 'MIN baskets: about 43.0 tonight (usually 42.0), 63% assisted (usually 60%)');
  assert.deepEqual(read.rows.map(item => item.key), ['fgmAllowed', 'assistedAllowed', 'fgPctAllowed', 'astAllowed']);
  assert.equal(read.rows[1].words, '2nd most');
});

test('not enough to go on: no read', () => {
  assert.equal(reboundChances(player, table, 'MIN', 'XXX'), null);
  assert.equal(assistChances({opportunity: null}, table, 'MIN', 'MIA'), null);
  // A short last 10 reads the season instead.
  const early = {opportunity: {szn: player.opportunity.szn, l10: {games: 3, ast: 12}}};
  assert.equal(assistChances(early, table, 'MIN', 'MIA').basis, 'this season');
});
