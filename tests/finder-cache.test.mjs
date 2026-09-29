import test from 'node:test';
import assert from 'node:assert/strict';
import {carryHistory, readFinderCache, persistFinderCache} from '../src/unified-finder-data.js';

const NOW = Date.parse('2026-09-29T20:00:00Z');
const ready = (id, extra = {}) => ({id, sport: 'mlb', player: 'Aaron Judge', stat: 'Total Bases', line: 1.5, direction: 'OVER',
  historyStatus: 'ready', average: 2.1, windows: {l10: {hits: 7, games: 10}}, streak: 3, diff: 0.6, averageDelta: 0.6,
  enrichedAt: NOW - 60 * 1000, apps: [{key: 'prizepicks', over: null}], moneyline: -120, headshot: 'judge.png', playerId: '592450', ...extra});
const fresh = (id, extra = {}) => ({id, sport: 'mlb', player: 'Aaron Judge', stat: 'Total Bases', line: 1.5, direction: 'OVER',
  historyStatus: 'pending', average: null, windows: null, streak: null, apps: [{key: 'prizepicks', over: null}, {key: 'draftkings', over: -135}],
  moneyline: null, headshot: null, playerId: null, ...extra});

test('an unchanged line keeps its hit rates and takes the new board\'s prices', () => {
  const [row] = carryHistory([fresh('mlb:1')], [ready('mlb:1')], NOW);
  assert.equal(row.historyStatus, 'ready');
  assert.deepEqual(row.windows, {l10: {hits: 7, games: 10}});
  assert.equal(row.average, 2.1);
  assert.equal(row.streak, 3);
  // Identity the history filled in comes along...
  assert.equal(row.headshot, 'judge.png');
  assert.equal(row.playerId, '592450');
  // ...prices never do: the new board's are current.
  assert.equal(row.apps.length, 2);
  assert.equal(row.moneyline, null);
});

test('new lines, moved lines and old hit rates load again', () => {
  const rows = carryHistory([fresh('mlb:2'), fresh('mlb:1', {line: 2.5}), fresh('mlb:3')],
    [ready('mlb:1'), ready('mlb:3', {enrichedAt: NOW - 7 * 60 * 60 * 1000})], NOW);
  assert.deepEqual(rows.map(row => row.historyStatus), ['pending', 'pending', 'pending']);
});

test('a line that switched stat or side is not the same prop', () => {
  const rows = carryHistory([fresh('mlb:1', {stat: 'Hits'}), fresh('mlb:4', {direction: 'UNDER'})],
    [ready('mlb:1'), ready('mlb:4')], NOW);
  assert.deepEqual(rows.map(row => row.historyStatus), ['pending', 'pending']);
});

test('no saved board anywhere is simply nothing', async () => {
  assert.equal(await readFinderCache('mlb', NOW), null);
  await persistFinderCache('mlb', {rows: [ready('mlb:1')]});
});
