import test from 'node:test';
import assert from 'node:assert/strict';
import {themedColor} from '../build/look-surfaces.mjs';

// color-mix(in srgb, page keep%, other) worked out by hand, for a page color.
function resolve(css, page) {
  if (css === 'var(--ls)') return page;
  const match = css.match(/^color-mix\(in srgb,var\(--ls\) ([\d.]+)%,#([0-9a-f]{6}|000)\)$/);
  const keep = +match[1] / 100, other = match[2] === '000' ? [0, 0, 0] : [0, 2, 4].map(at => parseInt(match[2].slice(at, at + 2), 16));
  return page.map((channel, index) => channel * keep + other[index] * (1 - keep));
}

test('on the site\'s own page every grey stays the grey it was', () => {
  for (const grey of [[10, 10, 10], [5, 5, 5], [19, 22, 27], [26, 26, 26], [44, 44, 44], [111, 115, 122], [155, 155, 155], [242, 243, 245].slice(0, 3)]) {
    const css = themedColor(...grey);
    if (!css) continue;
    resolve(css, [10, 10, 10]).forEach((value, index) => assert.ok(Math.abs(value - grey[index]) < 1.2, `${grey} -> ${css}`));
  }
});

test('on a green page the greys turn green, each as far above the page as before', () => {
  const page = [14, 60, 32];
  const card = resolve(themedColor(26, 26, 26), page), border = resolve(themedColor(44, 44, 44), page);
  assert.ok(card[1] > page[1] && border[1] > card[1]);
  assert.ok(card[1] > card[0]);
});

test('colors, black, white and see-through stay what they should', () => {
  assert.equal(themedColor(70, 217, 143), null);
  assert.equal(themedColor(0, 0, 0), null);
  assert.equal(themedColor(255, 255, 255), null);
  assert.match(themedColor(20, 20, 20, 0.8), /^color-mix\(in srgb,color-mix\(.*\),transparent 20%\)$/);
});
