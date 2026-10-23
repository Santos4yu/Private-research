// Player photos (src/photo-url.js): ESPN's full headshots asked for at about
// twice the size a circle shows, anything else as it is.
import test from 'node:test';
import assert from 'node:assert/strict';
import {sharpHead} from '../src/photo-url.js';

test('an ESPN headshot comes resized; other photos stay as they are', () => {
  assert.equal(sharpHead('https://a.espncdn.com/i/headshots/nba/players/full/4683678.png'),
    'https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/4683678.png&w=208&h=152');
  assert.equal(sharpHead('https://a.espncdn.com/i/headshots/nfl/players/full/4430807.png'),
    'https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/4430807.png&w=208&h=152');
  assert.equal(sharpHead('https://static.prizepicks.com/images/players/nba/x.webp'), 'https://static.prizepicks.com/images/players/nba/x.webp');
  assert.equal(sharpHead(null), null);
});
