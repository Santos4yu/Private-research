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

test('the dock shows the admin\'s four sections, and a section someone can\'t open is filled in its own slot', async () => {
  const {dockTabs, DOCK_DEFAULT, DOCK_ITEMS, DOCK_FILL} = await import('../src/mobile-nav-core.js');
  assert.deepEqual(dockTabs(null), DOCK_DEFAULT, 'before the admin chooses: the dock it always had');
  assert.deepEqual(dockTabs(['bot', 'finder', 'slip', 'v2']), ['bot', 'finder', 'slip', 'v2'], 'in the order chosen');
  // Research switched off for members: the next in line takes its slot, not the end.
  const off = key => key !== 'research';
  assert.deepEqual(dockTabs(['finder', 'research', 'v2', 'saved'], off), ['finder', 'slip', 'v2', 'saved']);
  // Two off: each slot filled in turn, never with a section already there.
  assert.deepEqual(dockTabs(['finder', 'research', 'v2', 'saved'], key => !['research', 'v2'].includes(key)), ['finder', 'slip', 'bot', 'saved']);
  // Fewer than four chosen, a repeat or an unknown section: topped up to four.
  assert.deepEqual(dockTabs(['finder', 'finder', 'made-up']), ['finder', 'research', 'v2', 'saved']);
  // Hardly anything open: only what can be opened, no empty slots.
  assert.deepEqual(dockTabs(['finder', 'research', 'v2', 'saved'], key => key === 'finder' || key === 'moves'), ['finder', 'moves']);
  for (const key of DOCK_FILL) assert.ok(DOCK_ITEMS[key]?.label && DOCK_ITEMS[key]?.icon, `${key} has a label and an icon`);
});
