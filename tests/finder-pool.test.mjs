import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBoard, BOARD_FALLBACK} from '../src/finder-pool.js';

const board = rows => ({rows, fetchedAt: '2026-10-20T18:00:00Z'});
const kept = [];
const options = extra => ({read: async () => null, persist: (sport, value) => kept.push([sport, value]), wait: async () => {}, ...extra});

test('a lines request that fails at once is asked again once', async () => {
  let asks = 0;
  const load = async () => { asks += 1; if (asks === 1) throw new Error('NHL lines are temporarily unavailable.'); return board([{id: 'a'}]); };
  const result = await loadBoard('nhl', options({load}));
  assert.equal(asks, 2);
  assert.deepEqual(result.rows.map(row => row.id), ['a']);
});

test('when the lines can\'t be had, a board saved within the hour stands in', async () => {
  const fail = async () => { throw new Error('NHL lines are temporarily unavailable.'); };
  const recent = {ts: Date.now() - 20 * 60 * 1000, rows: [{id: 'saved'}]};
  assert.deepEqual((await loadBoard('nhl', options({load: fail, read: async () => recent}))).rows, [{id: 'saved'}]);
  // Older than that, or nothing saved: it says the lines couldn't load.
  const old = {ts: Date.now() - BOARD_FALLBACK - 1000, rows: [{id: 'old'}]};
  await assert.rejects(loadBoard('nhl', options({load: fail, read: async () => old})), /temporarily unavailable/);
  await assert.rejects(loadBoard('nhl', options({load: fail})), /temporarily unavailable/);
});

test('a stopped build is never asked again', async () => {
  let asks = 0;
  const load = async () => { asks += 1; throw new DOMException('Aborted', 'AbortError'); };
  await assert.rejects(loadBoard('nhl', options({load, read: async () => ({ts: Date.now() - 5 * 60 * 1000, rows: [{id: 'x'}]})})), {name: 'AbortError'});
  assert.equal(asks, 1);
});
