// The Parlay Builder and the Slip Analyzer are one brain: a slip the
// Builder makes gets the very same chance, worth and letter when the
// Analyzer grades it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {candidates, buildLadder} from '../src/smart-slip.js';
import {scoreEntry} from '../src/slip-check.js';

const NOW = Date.parse('2026-09-30T18:00:00Z');
const LATER = '2026-09-30T23:10:00Z';
const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100});
function row({player, team, opponent, game, market = 'Total Bases', line = 1.5, modifier = 'standard', l10 = [7, 10], season = [30, 50]}) {
  return {id: `mlb:${player}:${market}:${line}:${modifier}`, sport: 'mlb', player, market, line, modifier, direction: 'OVER', startsAt: LATER,
    teamAbbr: team, opponent, gameId: game, raw: {stat: market},
    windows: {l5: w(Math.round(l10[0] / 2), 5), l10: w(...l10), season: w(...season)},
    apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}]};
}
// What the Analyzer is handed for a Builder slip: each pick graded as the Builder graded it.
const analyzed = slip => scoreEntry(slip.legs.map(leg => ({grade: leg, row: leg.row, side: leg.side, player: leg.row.player})),
  {app: {key: 'prizepicks'}, entry: {type: slip.play}});

const rows = [
  row({player: 'Judge', team: 'NYY', opponent: 'BOS', game: 'g1', l10: [8, 10], season: [36, 50]}),
  row({player: 'Soto', team: 'NYY', opponent: 'BOS', game: 'g1', l10: [8, 10], season: [34, 50]}),
  row({player: 'Volpe', team: 'NYY', opponent: 'BOS', game: 'g1', l10: [7, 10], season: [31, 50]}),
  row({player: 'Devers', team: 'BOS', opponent: 'NYY', game: 'g1', l10: [7, 10], season: [32, 50]}),
  row({player: 'Duran', team: 'BOS', opponent: 'NYY', game: 'g1', l10: [7, 10], season: [30, 50]}),
  row({player: 'Ohtani', team: 'LAD', opponent: 'SD', game: 'g2', l10: [8, 10], season: [35, 50]}),
  row({player: 'Machado', team: 'SD', opponent: 'LAD', game: 'g2', l10: [7, 10], season: [31, 50]}),
  row({player: 'Freeman', team: 'LAD', opponent: 'SD', game: 'g2', modifier: 'goblin', line: 0.5, l10: [9, 10], season: [44, 50]}),
];

for (const [label, options] of [['one per game', {}], ['same-game picks', {sameGame: true}], ['a one-game parlay', {perGame: 6}],
  ['Flex', {play: 'flex', sameGame: true}], ['same-game Flex', {play: 'flex', perGame: 6}]]) {
  test(`${label}: the Analyzer gives every Builder slip the same chance, worth and letter`, () => {
    const pool = candidates(rows, {now: NOW}).filter(leg => leg.side === 'OVER');
    const ladder = buildLadder(pool, options);
    assert.ok(ladder.length, 'some slip is built');
    for (const slip of ladder) {
      const score = analyzed(slip);
      assert.ok(Math.abs(score.chance - slip.chance) < 1e-12, `${slip.target}x: chance ${score.chance} vs ${slip.chance}`);
      assert.ok(Math.abs(score.value - slip.value) < 1e-12, `${slip.target}x: worth ${score.value} vs ${slip.value}`);
      assert.equal(score.letter, slip.letter, `${slip.target}x`);
    }
  });
}

test('picks from one game that rise together lift the slip in both, the same amount', () => {
  const pool = candidates(rows, {now: NOW}).filter(leg => leg.side === 'OVER');
  const teammates = buildLadder(pool, {perGame: 6, size: 2}).flatMap(slip => slip.links?.length ? [slip] : []);
  for (const slip of teammates) {
    assert.ok(slip.chance > slip.independent, 'teammates hitting together count for more than two separate picks');
    assert.ok(Math.abs(analyzed(slip).chance - slip.chance) < 1e-12);
  }
});

test('a Builder slip handed to the Analyzer names its exact lines, and changes are spelled out', async () => {
  const {builderSlip, changesSince} = await import('../src/slip-handoff.js');
  const {locate} = await import('../src/slip-check.js');
  const pool = candidates(rows, {now: NOW}).filter(leg => leg.side === 'OVER');
  const [slip] = buildLadder(pool, {perGame: 6});
  const read = builderSlip(slip, NOW);
  assert.equal(read.app.key, 'prizepicks');
  assert.deepEqual(read.legs.map(leg => leg.rowId), slip.legs.map(leg => leg.row.id));
  // The exact line is found, even with another of his lines on the board.
  const boards = {mlb: [...rows, {...rows[0], id: 'other', line: 2.5}]};
  for (const leg of read.legs) assert.equal(locate(leg, boards).board.id, leg.rowId);
  // Graded the same: the grade matches and nothing is listed.
  const graded = slip.legs.map(leg => ({rowId: leg.row.id, player: leg.row.player, row: leg.row, grade: leg}));
  assert.deepEqual(changesSince(read.builder, graded, {letter: slip.letter}), {same: true, letter: slip.letter, now: slip.letter, items: []});
  // A moved line is named.
  const moved = graded.map((leg, index) => index ? leg : {...leg, spot: {board: {line: leg.row.line + 1}}});
  const changed = changesSince(read.builder, moved, {letter: slip.letter});
  assert.equal(changed.same, false);
  assert.match(changed.items[0].text, /line moved/);
});
