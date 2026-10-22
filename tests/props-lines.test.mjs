// The Props lists' lines (src/props-lines.js): the standard line; a stat
// posted only as Demons shows its lowest Demon; never a Goblin.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pickLines} from '../src/props-lines.js';

const line = (id, marketKey, value, modifier, player = 'Jared McCain') =>
  ({id, sport: 'nba', player, playerId: player, teamAbbr: 'OKC', marketKey, line: value, modifier, startsAt: '2026-10-23T01:30:00Z'});

test('a standard line wins; a stat posted only as Demons shows the lowest; Goblins never', () => {
  const rows = [
    line('p-std', 'player_points', 10, 'standard'), line('p-gob', 'player_points', 7.5, 'goblin'), line('p-dem', 'player_points', 13.5, 'demon'),
    line('t-dem3', 'player_threes', 3.5, 'demon'), line('t-dem2', 'player_threes', 2.5, 'demon'), line('t-gob', 'player_threes', 1.5, 'goblin'),
    line('r-gob', 'player_rebounds', 1.5, 'goblin'),
    line('s-dem', 'player_threes', 2.5, 'demon', 'Shai Gilgeous-Alexander'), line('s-std', 'player_threes', 1.5, undefined, 'Shai Gilgeous-Alexander'),
  ];
  assert.deepEqual(pickLines(rows).map(row => row.id), ['p-std', 't-dem2', 's-std']);
});

test('the same player and stat in another game is its own line', () => {
  const later = {...line('t2', 'player_threes', 3.5, 'demon'), startsAt: '2026-10-25T01:30:00Z'};
  assert.deepEqual(pickLines([line('t1', 'player_threes', 2.5, 'demon'), later]).map(row => row.id), ['t1', 't2']);
});
