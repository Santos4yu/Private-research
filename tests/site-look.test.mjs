import test from 'node:test';
import assert from 'node:assert/strict';
import {lookOf, luminance, LOOKS, GRADIENTS, normalizeBase, normalizeBright, normalizeGrad, tintOf} from '../src/site-look.js';

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

test('a gradient draws both its colors, deep on a dark site and pale on a light one', () => {
  for (const [from, to] of GRADIENTS) {
    for (const base of ['#0a0a0a', '#ffffff']) {
      const look = lookOf(base, 0, [from, to]);
      assert.equal(look.mode, base === '#ffffff' ? 'light' : 'dark');
      assert.deepEqual(look.grad, [from, to]);
      for (const [page, lift] of [[look.page, look.lift], [look.page2, look.lift2]]) {
        const drawn = drawnPage({mode: look.mode, lift});
        rgb(page).forEach((want, i) => assert.ok(Math.abs(drawn[i] - want) < 0.02, `${from}-${to} on ${base}`));
      }
      // Readable under white (dark) or black (light) text.
      const lum = luminance(rgb(look.page2));
      assert.ok(look.mode === 'dark' ? lum <= 0.073 : lum >= 0.555);
    }
  }
  assert.equal(lookOf('#0a0a0a', 0, ['#2dd4bf', '#8b5cf6'], false).still, true);
  assert.equal(lookOf('#0a0a0a', 0, ['#2dd4bf', '#8b5cf6']).still, undefined);
});

test('a color from the account sheet tints the site, dark or light as it is; white is no tint', () => {
  const dark = tintOf('#00f58a', '#0a0a0a'), light = tintOf('#00f58a', '#ffffff');
  assert.ok(luminance(rgb(dark)) < 0.05 && rgb(dark)[1] > rgb(dark)[0]);
  assert.ok(luminance(rgb(light)) > 0.8 && rgb(light)[1] > rgb(light)[0]);
  assert.equal(tintOf('#ffffff', '#0a0a0a'), '#0a0a0a');
  assert.equal(tintOf('#ffffff', '#fbe2eb'), '#ffffff');
});

test('a gradient needs two good colors', () => {
  assert.equal(normalizeGrad(['#2dd4bf']), null);
  assert.equal(normalizeGrad(['#2dd4bf', 'red']), null);
  assert.deepEqual(normalizeGrad(['#2DD4BF', '#8b5cf6']), ['#2dd4bf', '#8b5cf6']);
});
