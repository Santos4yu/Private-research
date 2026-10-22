// A newer release reloads an open app (src/app-update.js): at once as it
// comes back to the front, otherwise after a while untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldReload} from '../src/app-update.js';

test('a newer release reloads as the app comes back, or once it sits untouched', () => {
  assert.equal(shouldReload({mine: 'a', id: 'b', resuming: true, idleFor: 0}), true);
  assert.equal(shouldReload({mine: 'a', id: 'b', resuming: false, idleFor: 10 * 1000}), false);       // mid-use: wait
  assert.equal(shouldReload({mine: 'a', id: 'b', resuming: false, idleFor: 4 * 60 * 1000}), true);
  assert.equal(shouldReload({mine: 'a', id: 'a', resuming: true, idleFor: 0}), false);                // same release
  assert.equal(shouldReload({mine: 'a', id: null, resuming: true, idleFor: 0}), false);               // couldn't ask
  assert.equal(shouldReload({mine: null, id: 'b', resuming: true, idleFor: 0}), false);               // a dev copy
});
