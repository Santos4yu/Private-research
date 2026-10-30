import test from 'node:test';
import assert from 'node:assert/strict';
import {lookOf, luminance, LOOKS, normalizeBase, normalizeBright} from '../src/site-look.js';

const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
// The page under each look, worked forward the way the browser draws it.
const TURN = [[-0.574, 1.43, 0.144], [0.426, 0.43, 0.144], [0.426, 1.43, -0.856]];
const native = 10 / 255;
function drawnPage(look) {
  const lift = look.lift ? rgb(look.lift) : [0, 0, 0];
  if (look.mode === 'dark') return lift.map(c => native + c - native * c);
  // screen with the layer, invert, hue-rotate(180deg), brightness(1 / (1 - native))
  const flipped = lift.map(c => (1 - native) * (1 - c));
  return TURN.map(row => row.reduce((sum, w, i) => sum + w * flipped[i], 0) / (1 - native));
}

test('black is the site as it is: no layer, not flipped', () => {
  assert.deepEqual(lookOf('#0a0a0a', 0), {mode: 'dark', page: '#0a0a0a', lift: null});
});

test('white flips the site light with no tint', () => {
  assert.deepEqual(lookOf('#ffffff', 0), {mode: 'light', page: '#ffffff', lift: null});
});

test('every swatch lands the page on its own color', () => {
  for (const [color] of LOOKS) {
    const look = lookOf(color, 0), drawn = drawnPage(look);
    rgb(look.page).forEach((want, i) => assert.ok(Math.abs(drawn[i] - want) < 0.02, `${color}: channel ${i} ${drawn[i]} vs ${want}`));
  }
});

test('brightness lifts or deepens the color, within readable limits', () => {
  const plain = luminance(rgb(lookOf('#221230', 0).page));
  assert.ok(luminance(rgb(lookOf('#221230', 20).page)) > plain);
  assert.ok(luminance(rgb(lookOf('#221230', -20).page)) < plain);
  // A dark page never gets too light for white text, a light one never too dark for black.
  assert.ok(luminance(rgb(lookOf('#606060', 30).page)) <= 0.073);
  assert.ok(luminance(rgb(lookOf('#d0d0d0', -30).page)) >= 0.555);
});

test('bad values fall back to black and to no brightness', () => {
  assert.equal(normalizeBase('pink'), '#0a0a0a');
  assert.equal(normalizeBright('x'), 0);
  assert.equal(normalizeBright(99), 30);
});
