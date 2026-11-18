// Saved colour themes that were only a brand's default give way to the
// current look (brand-colors.js); a member's own choice is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import {isOldBrandTheme, onCharcoal, DEFAULT_ACCENT} from '../src/brand-colors.js';

test('PropScout blue gives way to black and white unless saved since', () => {
  assert.equal(isOldBrandTheme({primary: '#3D7BFF', secondary: '#dce6ff', tint: 0, scout: true}), true);
  assert.equal(isOldBrandTheme({primary: '#3d7bff', secondary: '#dce6ff', tint: 0}), true);
  assert.equal(isOldBrandTheme({primary: '#3d7bff', secondary: '#a3a3a3', tint: 0, scout: true, mono: true}), false);
});

test('a colour a member picked is kept, and older brand defaults still give way', () => {
  assert.equal(isOldBrandTheme({primary: '#ffffff', secondary: '#a3a3a3', tint: 0, scout: true, mono: true}), false);
  assert.equal(isOldBrandTheme({primary: '#f43f5e', secondary: '#ffe4e6', tint: 4, scout: true}), false);
  assert.equal(isOldBrandTheme({primary: '#0082fe', secondary: '#dce6ff'}), true);
  assert.equal(isOldBrandTheme({primary: '#00f58a', ace: true}), true);
  assert.equal(isOldBrandTheme(null), false);
});

test('Charcoal: a theme on the old defaults moves to orange and the Charcoal page once', () => {
  assert.equal(DEFAULT_ACCENT, '#ff7a33');
  const old = {primary: '#FFFFFF', secondary: '#a3a3a3', tint: 0, base: '#0a0a0a', bright: 0, grad: null, sway: true, scout: true, mono: true};
  const moved = onCharcoal(old);
  assert.equal(moved.primary, '#ff7a33');
  assert.equal('base' in moved, false);
  assert.equal(old.primary, '#FFFFFF', 'the saved theme itself is left alone');
});

test('Charcoal: what was picked stays, and anything saved since is kept as saved', () => {
  // A background picked (Navy), a gradient or a brightness over black, an accent of their own.
  assert.equal(onCharcoal({primary: '#ffffff', base: '#0d1a33'}).base, '#0d1a33');
  assert.equal(onCharcoal({primary: '#ffffff', base: '#0a0a0a', grad: ['#2dd4bf', '#8b5cf6']}).base, '#0a0a0a');
  assert.equal(onCharcoal({primary: '#ffffff', base: '#0a0a0a', bright: 12}).base, '#0a0a0a');
  assert.equal(onCharcoal({primary: '#f43f5e', base: '#0a0a0a'}).primary, '#f43f5e');
  // Black and white picked since Charcoal.
  const kept = {primary: '#ffffff', base: '#0a0a0a', charcoal: true};
  assert.equal(onCharcoal(kept), kept);
  assert.equal(onCharcoal(null), null);
});
