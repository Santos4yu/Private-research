import test from 'node:test';
import assert from 'node:assert/strict';
import {reportRows, shouldSend, reportProps} from '../src/props-record.js';

const NOW = Date.parse('2026-11-03T18:00:00Z');
const row = (id, extra = {}) => ({id, playerId: `p${id}`.replace('p', '10'), marketKey: 'player_points', line: 20.5, startsAt: '2026-11-04T00:30:00Z', modifier: 'demon', ...extra});

test('the report: each scored prop still to come, its score, grade and line', () => {
  const rows = [row('a'), row('b', {startsAt: '2026-11-03T17:00:00Z'}), row('c'), row('d', {playerId: null})];
  const scores = new Map([['a', {score: 82}], ['b', {score: 60}], ['d', {score: 70}]]);
  const grades = new Map([['a', {chance: 0.47, tier: 'elite', needs: 0.35}]]);
  // c has no score yet, b has started, d has no player id.
  assert.deepEqual(reportRows(rows, scores, grades, NOW),
    [{id: '10a', market: 'player_points', line: 20.5, start: '2026-11-04T00:30:00Z', score: 82, chance: 0.47, tier: 'elite', modifier: 'demon', needs: 0.35}]);
});

test('sent at most every ten minutes, unless many more props are scored', () => {
  assert.equal(shouldSend(0, null, NOW), false);
  assert.equal(shouldSend(100, null, NOW), true);
  assert.equal(shouldSend(110, {at: NOW - 60000, count: 100}, NOW), false);
  assert.equal(shouldSend(200, {at: NOW - 60000, count: 100}, NOW), true);
  assert.equal(shouldSend(100, {at: NOW - 11 * 60000, count: 100}, NOW), true);
  const sent = [], storage = new Map();
  const store = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value)};
  const fetcher = (url, options) => { sent.push([url, JSON.parse(options.body).rows.length]); return Promise.resolve({ok: true}); };
  assert.equal(reportProps([{id: '1'}], {fetcher, storage: store}), true);
  assert.equal(reportProps([{id: '1'}], {fetcher, storage: store}), false);
  assert.deepEqual(sent, [['/api/wnba?league=nba&resource=props-log', 1]]);
});

test('a grade is hitting once its props beat what they needed, over enough of them', async () => {
  const {hittingTiers, HOT} = await import('../src/props-record.js');
  const tier = (name, priced, pricedRate, needed) => ({tier: name, priced, pricedRate, needed});
  const found = hittingTiers({tiers: [tier('elite', 60, 64, 52), tier('strong', 60, 55, 52), tier('lean', 20, 80, 50), tier('fade', 80, 30, 50)]});
  // Elite: 12 points over with 60 props (one error is about 6.5). Strong: 3 over, not enough. Lean: too few.
  assert.deepEqual([...found.keys()], ['elite']);
  assert.deepEqual(found.get('elite'), {rate: 64, needed: 52, props: 60});
  assert.equal(HOT.props, 40);
  assert.equal(hittingTiers(null).size, 0);
});
