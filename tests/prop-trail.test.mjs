// The player page's Line Movement card (src/sports/wnba/prop-trail.js):
// this line's PrizePicks moves for tonight's game, newest first, then where it opened.
import test from 'node:test';
import assert from 'node:assert/strict';
import {lineTrail} from '../src/sports/wnba/prop-trail.js';

const row = {market: 'Points', line: 23.5, modifier: 'standard', startsAt: '2026-11-12T00:00:00Z'};
const moves = [
  {kind: 'line', stat: 'Points', from: 22.5, to: 23.5, at: '2026-11-11T20:00:00Z', startsAt: '2026-11-12T00:00:00Z'},
  {kind: 'line', stat: 'Points', from: 21.5, to: 22.5, at: '2026-11-11T15:00:00Z', startsAt: '2026-11-12T00:00:00Z'},
  {kind: 'line', stat: 'Rebounds', from: 6.5, to: 7.5, at: '2026-11-11T16:00:00Z', startsAt: '2026-11-12T00:00:00Z'},
  {kind: 'line', stat: 'Points', from: 25.5, to: 24.5, at: '2026-11-09T16:00:00Z', startsAt: '2026-11-10T00:00:00Z'},
];

test('tonight\'s moves for this stat, newest first, then where it opened', () => {
  const rows = lineTrail(row, moves);
  assert.deepEqual(rows.map(item => [item.line, item.tone || item.note]), [[23.5, 'up'], [22.5, 'up'], [21.5, 'Opened']]);
});

test('no moves, a pulled line, and a goblin line', () => {
  assert.deepEqual(lineTrail(row, []).map(item => [item.line, item.note]), [[23.5, 'No moves yet']]);
  const pulled = lineTrail(row, [{kind: 'pulled', stat: 'points', from: 23.5, at: '2026-11-11T22:00:00Z', startsAt: '2026-11-12T00:30:00Z'}]);
  assert.equal(pulled[0].note, 'Pulled');
  assert.equal(pulled[0].line, 23.5);
  assert.deepEqual(lineTrail({...row, modifier: 'goblin', line: 19.5}, moves).map(item => item.line), [19.5]);
});
