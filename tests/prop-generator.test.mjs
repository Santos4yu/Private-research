// The NBA prop generator (src/prop-generator.js) on last season's real league numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analysisOf, bestSlips, generateProps, PAYOUTS} from '../src/prop-generator.js';
import {finderWindow} from '../src/unified-finder-data.js';

const real = JSON.parse(readFileSync(new URL('./fixtures/nba-2025-26-league.json', import.meta.url)));
const DAY = 86400000;
const later = new Date(Date.now() + 5 * 3600e3).toISOString();
const row = (id, values, line, {modifier = 'standard', opponent = 'DEN', marketKey = 'player_points', team = 'OKC', startsAt = later, game = 'g1'} = {}) => ({
  id: `${id}:${marketKey}:${line}:${modifier}`, sport: 'nba', player: id, playerId: id, position: 'G', teamAbbr: team, opponent, marketKey,
  market: 'Points', stat: 'Points', line, modifier, direction: 'OVER', historyStatus: 'ready', startsAt, gameId: game,
  windows: {l5: finderWindow(values.slice(-5), line), l10: finderWindow(values.slice(-10), line), l20: finderWindow(values.slice(-20), line),
    season: finderWindow(values, line), h2h: finderWindow([], line)},
  average: values.slice(-10).reduce((sum, value) => sum + value, 0) / 10,
  gameLog: values.map((value, i) => ({value, date: new Date(Date.now() - (values.length - i) * 2 * DAY).toISOString().slice(0, 10), opponent: 'BOS', usage: 30}))});
const HOT = [14, 16, 12, 18, 15, 17, 13, 19, 16, 14, 15, 18], COLD = [6, 8, 5, 9, 7, 6, 8, 5, 7, 6, 9, 7];

test('the props worth playing: overs the model likes, regular lines, one a player, best first', () => {
  const rows = [row('Hot Guy', HOT, 12.5), row('Hot Guy', HOT, 14.5), row('Cold Guy', COLD, 12.5),
    row('Demon Guy', HOT, 16.5, {modifier: 'demon'}), row('Early Guy', HOT, 12.5, {startsAt: new Date(Date.now() + 5 * 60000).toISOString()}),
    row('Warm Guy', [14, 16, 13, 15, 14, 15, 13, 16, 15, 14, 15, 14], 12.5, {team: 'LAL', opponent: 'BOS', game: 'g2'}),
    row('Low Line Guy', HOT, 8.5, {team: 'MIA', game: 'g3'})];
  const found = generateProps(rows, real);
  const names = found.map(item => item.row.player);
  assert.ok(names.includes('Hot Guy') && !names.includes('Cold Guy') && !names.includes('Demon Guy') && !names.includes('Early Guy'), names.join());
  // A line under the stat's smallest (11.5 points) isn't taken.
  assert.ok(!names.includes('Low Line Guy'));
  assert.equal(names.filter(name => name === 'Hot Guy').length, 1);
  // Its best line: the one with more to spare (12.5 rather than 14.5).
  assert.equal(found.find(item => item.row.player === 'Hot Guy').row.line, 12.5);
  for (const item of found) assert.ok(item.confidence >= 0 && item.confidence <= 100 && item.games.length === 10);
  for (const item of found) assert.ok(item.grade.edge > 0 && ['elite', 'strong', 'lean'].includes(item.grade.tier));
  assert.deepEqual(found.map(item => item.score), [...found.map(item => item.score)].sort((a, b) => b - a));
  assert.deepEqual(generateProps(rows, null), []);
});

test('the analysis says why in plain words', () => {
  const [item] = generateProps([row('Hot Guy', HOT, 12.5)], real);
  const parts = analysisOf(item);
  assert.deepEqual(parts.map(part => part.key).slice(0, 4), ['chance', 'form', 'role', 'matchup']);
  assert.match(parts[0].text, /^Our model has Hot Guy over 12\.5 points about \d+% of the time, \d+ points better than even\. A PrizePicks slip pays for itself from about 55-58% a pick/);
  assert.match(parts[1].text, /^He's gone over this line in 9 of his last 10 and 92% of his games this season\./);
  assert.match(parts[1].text, /averaging 15\.7 points over his last 10, above the line\./);
  assert.match(parts[3].text, /^A \d+ matchup against DEN \(/);
});

test('the best slips: every leg hitting, what a dollar returns, two legs a game at most', () => {
  const item = (id, chance, game) => ({row: {id, player: id, gameId: game}, grade: {chance}});
  const items = [item('a', 0.7, 'g1'), item('b', 0.68, 'g1'), item('c', 0.66, 'g1'), item('d', 0.6, 'g2'), item('e', 0.58, 'g3')];
  const slips = bestSlips(items, [2, 3]);
  assert.deepEqual(slips.map(slip => [slip.size, slip.payout]), [[2, 3], [3, 6]]);
  assert.deepEqual(slips[0].legs.map(leg => leg.row.id), ['a', 'b']);
  assert.ok(Math.abs(slips[0].chance - 0.7 * 0.68) < 1e-9 && Math.abs(slips[0].value - (0.7 * 0.68 * 3 - 1)) < 1e-9);
  // Not a third from g1: a, b and the best other game.
  assert.deepEqual(slips[1].legs.map(leg => leg.row.id), ['a', 'b', 'd']);
  assert.equal(PAYOUTS[6], 37.5);
  assert.deepEqual(bestSlips(items.slice(0, 1), [2]), []);
});

test('the main stats from the heart of the rotation: no bench minutes, no blocks or steals', () => {
  const bench = row('Bench Guy', HOT, 12.5, {team: 'LAL', game: 'g2'});
  bench.gameLog = bench.gameLog.map(game => ({...game, usage: 14}));
  const rows = [row('Hot Guy', HOT, 12.5), bench, row('Block Guy', HOT, 12.5, {marketKey: 'player_blocks', team: 'MIA', game: 'g3'}),
    row('Steal Guy', HOT, 12.5, {marketKey: 'player_steals', team: 'NYK', game: 'g4'})];
  const found = generateProps(rows, real);
  assert.deepEqual(found.map(item => item.row.player), ['Hot Guy']);
  assert.equal(Math.round(found[0].minutes), 30);
  const role = analysisOf(found[0]).find(part => part.key === 'role');
  assert.equal(role.text, '30 minutes a game over his last 10.');
  // With the rotation known: a starter on lighter minutes stays, a bench player on them doesn't.
  const rotation = (lastStart) => ({...real, rotation: {OKC: {players: [{id: 'Light Guy', name: 'Light Guy', games: 10, starts: lastStart ? 10 : 0, lastStart, playedLast: true, last3: true}]}}});
  const light = row('Light Guy', HOT, 12.5);
  light.gameLog = light.gameLog.map(game => ({...game, usage: 24}));
  assert.equal(generateProps([light], rotation(true)).length, 1);
  assert.equal(generateProps([light], rotation(false)).length, 0);
});

test('confidence: the four reads together', async () => {
  const {signalsOf, formRate} = await import('../src/prop-generator.js');
  // 4 for 5 isn't 80%: pulled toward even.
  assert.equal(Math.round(formRate({l10: {hits: 4, games: 5}}) * 100), 64);
  const strong = signalsOf({chance: 0.62, form: 0.75, matchup: 90, average: 30, line: 25});
  assert.deepEqual(strong, {signals: {model: 100, form: 100, matchup: 100, cushion: 100}, confidence: 100});
  const even = signalsOf({chance: 0.5, form: 0.5, matchup: 40, average: 25, line: 25});
  assert.equal(even.confidence, 0);
  assert.equal(signalsOf({chance: 0.56, form: 0.65, matchup: 65, average: 27.5, line: 25}).confidence, 53);
});
