// The Finder's Moneyline column: each row's team chance to win, matched from
// the slate's team chances (src/unified-finder-data.js withMoneylines).
import test from 'node:test';
import assert from 'node:assert/strict';
import {withMoneylines} from '../src/unified-finder-data.js';

const teams = {
  GS: [{chance: 0.584, opponent: 'HOU', startsAt: '2026-11-12T00:30:00Z'}, {chance: 0.41, opponent: 'LAL', startsAt: '2026-11-13T03:00:00Z'}],
  UTAH: [{chance: 0.3, opponent: 'ORL', startsAt: '2026-11-12T02:00:00Z'}],
};

test('a row takes its own game, not the next night\'s', () => {
  const [tonight, tomorrow] = withMoneylines([
    {id: 'a', teamAbbr: 'GS', opponent: 'HOU', startsAt: '2026-11-12T00:40:00Z'},
    {id: 'b', teamAbbr: 'GS', opponent: 'LAL', startsAt: '2026-11-13T03:00:00Z'},
  ], teams);
  assert.equal(tonight.winChance, 58.4);
  assert.equal(tomorrow.winChance, 41);
});

test('other spellings of a team, and rows left alone', () => {
  const kept = {id: 'c', teamAbbr: 'GS', startsAt: '2026-11-12T00:30:00Z', winChance: 70};
  const far = {id: 'd', teamAbbr: 'GS', startsAt: '2026-11-15T00:30:00Z'};
  const none = {id: 'e', teamAbbr: 'MIA', startsAt: '2026-11-12T00:30:00Z'};
  const [utah, k, f, n] = withMoneylines([{id: 'u', teamAbbr: 'UTA', startsAt: '2026-11-12T02:00:00Z'}, kept, far, none], teams);
  assert.equal(utah.winChance, 30);
  assert.equal(k, kept);
  assert.equal(f.winChance, undefined);
  assert.equal(n, none);
  const same = [none];
  assert.equal(withMoneylines(same, teams), same, 'nothing matched: the same list back');
  assert.equal(withMoneylines(same, null), same);
});
