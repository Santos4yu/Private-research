// Saved colour themes that were only a brand's default give way to the
// current look (brand-colors.js); a member's own choice is kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import {isOldBrandTheme} from '../src/brand-colors.js';

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
