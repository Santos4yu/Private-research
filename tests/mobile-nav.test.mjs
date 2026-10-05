import test from 'node:test';
import assert from 'node:assert/strict';
import {dockState} from '../src/mobile-nav-core.js';

const run = (positions, bottom = 4000, state = null) => positions.map(y => (state = dockState(state, y, bottom)).hidden);

test('the dock tucks away scrolling down and comes back scrolling up', () => {
  // Down the page: hidden once it has moved a little.
  assert.deepEqual(run([0, 10, 30, 60, 200, 600]), [false, false, true, true, true, true]);
  // Back up a bit: it returns; down again: it goes.
  assert.deepEqual(run([0, 200, 600, 590, 560, 540, 700]), [false, true, true, true, false, false, true]);
});

test('small jitters do not make it twitch', () => {
  // Hidden mid-page, a few pixels up and down leave it hidden.
  assert.deepEqual(run([0, 300, 295, 300, 290, 296]), [false, true, true, true, true, true]);
  // Shown, a few pixels down leave it shown.
  assert.deepEqual(run([0, 300, 200, 210]), [false, true, false, false]);
});

test('it always shows near the top, at the bottom and when the page bounces', () => {
  assert.deepEqual(run([0, 300, 20]), [false, true, false]);
  assert.deepEqual(run([0, 300, 3996], 4000), [false, true, false]);
  assert.equal(dockState({hidden: true, y: 300, travel: 40}, -30).hidden, false);
});
