import test from 'node:test';
import assert from 'node:assert/strict';
import {tintOf} from '../src/team-tint.js';

// Pixels as [r, g, b, a] runs.
const pixels = (...runs) => Uint8ClampedArray.from(runs.flatMap(([color, count]) => Array.from({length: count}, () => color).flat()));

test('a logo\'s color is its colorful pixels, not its outline or its background', () => {
  // Seahawks-ish: mostly navy-green with white and black outline and see-through corners.
  const color = tintOf(pixels([[105, 190, 40, 255], 300], [[255, 255, 255, 255], 400], [[0, 0, 0, 255], 300], [[0, 0, 0, 0], 600]));
  const [r, g, b] = color.match(/\d+/g).map(Number);
  assert.ok(g > r && g > b, color);
  // Never so dark or so bright a header can't be read on.
  const light = (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255;
  assert.ok(light >= 0.38 && light <= 0.57, String(light));
});

test('a logo with no color in it leaves the header as it is', () => {
  assert.equal(tintOf(pixels([[255, 255, 255, 255], 500], [[20, 20, 20, 255], 500])), null);
  assert.equal(tintOf(pixels([[200, 30, 30, 0], 500])), null);
});
