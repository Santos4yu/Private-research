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
