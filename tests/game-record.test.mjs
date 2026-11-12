// The admin's record in History: its text and the day-by-day chart (src/game-record-core.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {dayBars, decidedOf, gameRow, rateOf, recordText, shortDay} from '../src/game-record-core.js';

test('a record as text, its rate, either kind of tally', () => {
  assert.equal(recordText({wins: 12, losses: 5}), '12-5');
  assert.equal(recordText({hits: 3, misses: 1}), '3-1');
  assert.equal(recordText({wins: 0, losses: 0}), '—');
  assert.equal(recordText(null), '—');
  assert.equal(decidedOf({hits: 3, misses: 1}), 4);
  assert.equal(rateOf({wins: 3, losses: 1}), 0.75);
  assert.equal(rateOf({wins: 0, losses: 0}), null);
  assert.equal(shortDay('2026-11-07'), 'Nov 7');
});

test('the day-by-day chart: oldest first, days without games left out, the busiest day fills its half', () => {
  const days = [{day: '2026-11-08', wins: 6, losses: 2, units: 1.8}, {day: '2026-11-07', wins: 0, losses: 0}, {day: '2026-11-06', wins: 3, losses: 4, units: -1.2}];
  const bars = dayBars(days);
  assert.deepEqual(bars.map(bar => bar.day), ['2026-11-06', '2026-11-08']);
  assert.deepEqual(bars.map(bar => [bar.up, bar.down]), [[0.5, 4 / 6], [1, 2 / 6]]);
  assert.equal(bars[1].units, 1.8);
  assert.equal(dayBars([{day: 'x', hits: 2, misses: 1}])[0].wins, 2);
  assert.equal(dayBars(days, 1).length, 1);
});

test('a kept game as a row: the team taken, the result, the final score', () => {
  const entry = {side: 'away', home: 'DEN', away: 'BOS', result: {home: 104, away: 112, winner: 'away', correct: true}};
  assert.deepEqual(gameRow(entry), {team: 'BOS', against: 'DEN', result: 'win', score: 'BOS 112-104 DEN'});
  assert.equal(gameRow({...entry, result: {...entry.result, correct: false, winner: 'home'}}).result, 'loss');
  assert.equal(gameRow({...entry, result: null}).result, null);
});

test('by date: the month grid, tallies across both leagues, how a day went', async () => {
  const {monthGrid, mergeTally, dayTallies, dayTone, byDay, longDay} = await import('../src/game-record-core.js');
  const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(grid.length, 42);
  assert.deepEqual(grid[0], {day: '2026-11-01', date: 1, inMonth: true});
  assert.equal(grid.filter(cell => cell.inMonth).length, 30);
  assert.equal(grid[41].inMonth, false);
  assert.deepEqual(mergeTally({wins: 3, losses: 1, units: 1.5}, {hits: 2, misses: 2}, null), {wins: 5, losses: 3, pushes: 0, units: 1.5});
  const days = dayTallies([{day: '2026-11-11', wins: 5, losses: 2, units: 2}], [{day: '2026-11-11', wins: 1, losses: 3, units: -2.2}, {day: '2026-11-10', wins: 0, losses: 1}]);
  assert.deepEqual(days['2026-11-11'], {wins: 6, losses: 5, pushes: 0, units: -0.2});
  assert.equal(dayTone(days['2026-11-11']), 'up');
  assert.equal(dayTone(days['2026-11-10']), 'down');
  assert.equal(dayTone({wins: 0, losses: 0}), null);
  assert.deepEqual(byDay([{day: '2026-11-10', id: 1}, {day: '2026-11-11', id: 2}, {day: '2026-11-10', id: 3}]).map(([day, items]) => [day, items.length]), [['2026-11-11', 1], ['2026-11-10', 2]]);
  assert.equal(longDay('2026-11-12', '2026-11-12'), 'Today');
  assert.equal(longDay('2026-11-11', '2026-11-12'), 'Yesterday');
  assert.equal(longDay('2026-11-09', '2026-11-12'), 'Mon, Nov 9');
});
