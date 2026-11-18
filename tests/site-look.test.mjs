import test from 'node:test';
import assert from 'node:assert/strict';
import {lookOf, luminance, LOOKS, GRADIENTS, normalizeBase, normalizeBright, normalizeGrad, tintOf} from '../src/site-look.js';

const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16) / 255);
// What the browser draws for a color set before the flip on a light site:
// invert, hue-rotate(180deg), brightness(1 / (1 - native)).
const TURN = [[-0.574, 1.43, 0.144], [0.426, 0.43, 0.144], [0.426, 1.43, -0.856]];
const native = 10 / 255;
const flip = color => TURN.map(row => row.reduce((sum, w, i) => sum + w * (1 - color[i]), 0) / (1 - native));
const close = (a, b, label) => a.forEach((value, i) => assert.ok(Math.abs(value - b[i]) < 0.02, `${label}: ${a} vs ${b}`));
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

test('Charcoal is the default and first swatch, Black still a pick', () => {
  assert.deepEqual(LOOKS[0], ['#17181b', 'Charcoal']);
  assert.ok(LOOKS.some(([color, name]) => color === '#0a0a0a' && name === 'Black'));
  assert.deepEqual(lookOf('#17181b', 0), {mode: 'dark', page: '#17181b', surface: '#17181b', text: '#17181b'});
});

test('black is the site as it is: its own greys, not flipped', () => {
  assert.deepEqual(lookOf('#0a0a0a', 0), {mode: 'dark', page: '#0a0a0a', surface: '#0a0a0a', text: '#0a0a0a'});
});

test('white flips the site with its own greys: the flip alone makes it white', () => {
  assert.deepEqual(lookOf('#ffffff', 0), {mode: 'light', page: '#ffffff', surface: '#0a0a0a', text: '#0a0a0a'});
});

test('every swatch lands the page on its own color', () => {
  for (const [color] of LOOKS) {
    const look = lookOf(color, 0);
    close(rgb(look.page), rgb(color), color);
    // Dark: the greys follow the page color itself. Light: set before the flip, drawn as the color.
    if (look.mode === 'dark') assert.equal(look.surface, look.page);
    else close(flip(rgb(look.surface)), rgb(look.page), `${color} flipped`);
  }
});

test('grey text on a lighter dark page follows a lighter color, so the dimmest text reads as on black', () => {
  const faint = anchor => anchor.map(value => value * (1 - (96 / 255 - native) / (1 - native)) + (96 / 255 - native) / (1 - native));
  const onBlack = contrast([96 / 255, 96 / 255, 96 / 255], [native, native, native]);
  for (const color of ['#216635', '#3a2a55', '#0d1a33']) {
    const look = lookOf(color, 0);
    assert.ok(contrast(faint(rgb(look.text)), rgb(look.page)) >= onBlack - 0.02, color);
  }
});

test('brightness lifts or deepens the color, within readable limits', () => {
  const plain = luminance(rgb(lookOf('#221230', 0).page));
  assert.ok(luminance(rgb(lookOf('#221230', 20).page)) > plain);
  assert.ok(luminance(rgb(lookOf('#221230', -20).page)) < plain);
  // A dark page never gets too light for white text, a light one never too dark for black.
  assert.ok(luminance(rgb(lookOf('#606060', 30).page)) <= 0.101);
  assert.ok(luminance(rgb(lookOf('#a8a8a8', -30).page)) >= 0.495);
});

test('a gradient: both its colors on the moving page, the cards in their middle', () => {
  for (const [from, to] of GRADIENTS) {
    for (const base of ['#0a0a0a', '#ffffff']) {
      const look = lookOf(base, 0, [from, to]);
      assert.equal(look.mode, base === '#ffffff' ? 'light' : 'dark');
      assert.deepEqual(look.grad, [from, to]);
      const middle = rgb(look.layer[0]).map((value, i) => (value + rgb(look.layer[1])[i]) / 2);
      close(rgb(look.surface), middle, `${from}-${to} middle`);
      if (look.mode === 'light') close(flip(rgb(look.layer[1])), rgb(look.page2), `${from}-${to} on white`);
      else assert.equal(look.layer[1], look.page2);
      const lum = luminance(rgb(look.page2));
      assert.ok(look.mode === 'dark' ? lum <= 0.101 : lum >= 0.49);
    }
  }
  assert.equal(lookOf('#0a0a0a', 0, ['#2dd4bf', '#8b5cf6'], false).still, true);
  assert.equal(lookOf('#0a0a0a', 0, ['#2dd4bf', '#8b5cf6']).still, undefined);
});

test('a color from the account sheet tints the site, dark or light as it is; white is no tint', () => {
  const dark = tintOf('#00f58a', '#0a0a0a'), light = tintOf('#00f58a', '#ffffff');
  assert.ok(luminance(rgb(dark)) < 0.05 && rgb(dark)[1] > rgb(dark)[0]);
  assert.ok(luminance(rgb(light)) > 0.8 && rgb(light)[1] > rgb(light)[0]);
  // White is the plain page: the default, Charcoal.
  assert.equal(tintOf('#ffffff', '#0a0a0a'), '#17181b');
  assert.equal(tintOf('#ffffff', '#fbe2eb'), '#ffffff');
});

test('bad values fall back to the default (Charcoal), no brightness and no gradient', () => {
  assert.equal(normalizeBase('pink'), '#17181b');
  assert.equal(normalizeBright('x'), 0);
  assert.equal(normalizeBright(99), 30);
  assert.equal(normalizeGrad(['#2dd4bf']), null);
  assert.equal(normalizeGrad(['#2dd4bf', 'red']), null);
  assert.deepEqual(normalizeGrad(['#2DD4BF', '#8b5cf6']), ['#2dd4bf', '#8b5cf6']);
});
