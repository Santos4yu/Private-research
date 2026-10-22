import test from 'node:test';
import assert from 'node:assert/strict';
import {carryHistory, readFinderCache, persistFinderCache, packGameLogs, unpackGameLogs, gameLog} from '../src/unified-finder-data.js';

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

test('a basketball line saved before histories carried his meetings loads again', () => {
  const nba = {sport: 'nba', stat: undefined, marketKey: 'player_threes'};
  const [old, kept] = carryHistory([fresh('nba:1', nba), fresh('nba:2', nba)],
    [ready('nba:1', nba), ready('nba:2', {...nba, meetings: {values: [2, 3, 3], usual: 1.5}})], NOW);
  assert.equal(old.historyStatus, 'pending');
  assert.equal(kept.historyStatus, 'ready');
  assert.deepEqual(kept.meetings, {values: [2, 3, 3], usual: 1.5});
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

test('saved game logs come back exactly, each player\'s games kept once', () => {
  const games = gameLog([{value: 24, date: '2026-10-20', home: true, opponent: 'BOS', usage: 34},
    {value: 31, date: '2026-10-22', home: false, opponent: 'NY', usage: 36}]);
  const college = gameLog([{value: 88, date: '2026-10-04', home: true, opponent: 'UGA', usage: 70, share: 0.21, fbs: true},
    {value: 41, date: '2026-10-11', home: false, opponent: 'Kent St', usage: 64}]);
  const rows = [
    {id: 'a', gameLog: games},
    {id: 'b', gameLog: games.map(game => ({...game, value: game.value / 2}))},
    {id: 'c', gameLog: college},
    {id: 'd', gameLog: []},
    {id: 'e'},
  ];
  const saved = rows.map(row => ({...row}));
  const logs = packGameLogs(saved);
  assert.equal(logs.length, 2);
  assert.equal(saved[0].gameLog, undefined);
  // What IndexedDB hands back is a structured copy.
  const back = unpackGameLogs(structuredClone(saved), structuredClone(logs));
  assert.deepEqual(back, rows);
  // The games the second college game didn't have stay left out.
  assert.equal('share' in back[2].gameLog[1], false);
});

test('a board saved before game logs were packed reads as it was', () => {
  const rows = [{id: 'a', gameLog: [{value: 1, date: '2026-10-20'}]}];
  assert.equal(unpackGameLogs(rows, undefined), rows);
});
