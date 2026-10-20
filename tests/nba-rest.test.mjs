import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupCase, restBefore} from '../src/slip-matchup.js';

// Tip-offs in UTC: 7:30pm Eastern is 23:30Z (00:30Z the next day for 8:30).
const rest = {
  IND: ['2026-10-25T23:30:00Z', '2026-10-27T00:00:00Z'],          // Oct 25, Oct 26 (8pm ET)
  NO: ['2026-10-23T23:00:00Z', '2026-10-24T23:30:00Z', '2026-10-26T00:30:00Z'], // Oct 23, Oct 24, Oct 25 (8:30pm ET)
};
const row = side => ({sport: 'nba', player: 'Aaron Nesmith', teamAbbr: 'IND', opponent: 'NO', startsAt: '2026-10-27T00:00:00Z',
  market: 'Points', marketKey: 'player_points', line: 12.5, position: 'G', gameLog: []});

test('days before a game, by the Eastern calendar', () => {
  assert.deepEqual(restBefore(rest.IND, '2026-10-27T00:00:00Z'), {days: 1, backToBack: true, threeInFour: false});
  // NO tonight (Oct 26 Eastern): played Oct 25 (8:30pm ET is the 26th in UTC), 24 and 23.
  assert.deepEqual(restBefore(rest.NO, '2026-10-27T00:00:00Z'), {days: 1, backToBack: true, threeInFour: true});
  assert.equal(restBefore([], '2026-10-27T00:00:00Z'), null);
  assert.equal(restBefore(['2026-10-27T00:00:00Z'], '2026-10-27T00:00:00Z'), null);
});

test('a back-to-back counts against the Over, a tired opponent for it', () => {
  const both = matchupCase({row: row(), side: 'OVER'}, {nba: {rest}});
  const tired = both.facts.find(item => item.key === 'rest');
  assert.match(tired.text, /^Second night of a back-to-back for IND/);
  assert.ok(tired.impact < 0);
  // Both on a back-to-back: the opponent's tiredness isn't a plus.
  assert.equal(both.facts.find(item => item.key === 'rest-opponent'), undefined);
  // Only the opponent tired: a plus for the Over, a minus for the Under.
  const fresh = {...rest, IND: ['2026-10-23T23:30:00Z']};
  const over = matchupCase({row: row(), side: 'OVER'}, {nba: {rest: fresh}}).facts.find(item => item.key === 'rest-opponent');
  assert.match(over.text, /^NO played last night/);
  assert.ok(over.impact > 0);
  const under = matchupCase({row: row(), side: 'UNDER'}, {nba: {rest: fresh}}).facts.find(item => item.key === 'rest-opponent');
  assert.ok(under.impact < 0);
});
