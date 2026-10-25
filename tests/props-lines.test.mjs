// The Props lists' lines (src/props-lines.js): per player and stat, the
// standard line, the highest Goblin and the lowest Demon (the list filters
// which kinds show); mainLines keeps the old one-line rule for the record.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pickLines, mainLines} from '../src/props-lines.js';

const line = (id, marketKey, value, modifier, player = 'Jared McCain') =>
  ({id, sport: 'nba', player, playerId: player, teamAbbr: 'OKC', marketKey, line: value, modifier, startsAt: '2026-10-23T01:30:00Z'});

test('each kind of line once a stat: the standard, the Goblin and the Demon nearest it', () => {
  const rows = [
    line('p-std', 'player_points', 10, 'standard'), line('p-gob', 'player_points', 7.5, 'goblin'), line('p-dem', 'player_points', 13.5, 'demon'),
    line('t-dem3', 'player_threes', 3.5, 'demon'), line('t-dem2', 'player_threes', 2.5, 'demon'), line('t-gob', 'player_threes', 1.5, 'goblin'),
    line('r-gob', 'player_rebounds', 1.5, 'goblin'),
    line('s-dem', 'player_threes', 2.5, 'demon', 'Shai Gilgeous-Alexander'), line('s-std', 'player_threes', 1.5, undefined, 'Shai Gilgeous-Alexander'),
  ];
  assert.deepEqual(pickLines(rows).map(row => row.id), ['p-std', 'p-gob', 'p-dem', 't-dem2', 't-gob', 'r-gob', 's-dem', 's-std']);
  // The track record's line: a standard one wins; only Demons, the lowest; Goblins never.
  assert.deepEqual(mainLines(rows).map(row => row.id), ['p-std', 't-dem2', 's-std']);
  // Two Goblins: the higher one (nearest the standard line).
  assert.deepEqual(pickLines([line('a', 'player_points', 6.5, 'goblin'), line('b', 'player_points', 8.5, 'goblin')]).map(row => row.id), ['b']);
});

test('the same player and stat in another game is its own line', () => {
  const later = {...line('t2', 'player_threes', 3.5, 'demon'), startsAt: '2026-10-25T01:30:00Z'};
  assert.deepEqual(pickLines([line('t1', 'player_threes', 2.5, 'demon'), later]).map(row => row.id), ['t1', 't2']);
});
