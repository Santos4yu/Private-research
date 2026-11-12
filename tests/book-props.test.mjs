import test from 'node:test';
import assert from 'node:assert/strict';
import {bookChance, nameKey, priceText} from '../src/book-props.js';

const players = {lukadoncic: {pts: [32.5, -140, 110, 0.56], reb: [8.5, -110, -110, 0.5]}, jarenjackson: {blk: [1.5, 120, -150, 0.42]}};
const row = (player, marketKey, line) => ({player, marketKey, line});

test('names read the same with accents and suffixes', () => {
  assert.equal(nameKey('Luka Dončić'), 'lukadoncic');
  assert.equal(nameKey('Jaren Jackson Jr.'), 'jarenjackson');
});

test('the same line: DraftKings\' chance as it is', () => {
  const found = bookChance(row('Luka Doncic', 'player_points', 32.5), players);
  assert.equal(found.chance, 0.56);
  assert.equal(found.moved, false);
  assert.deepEqual([found.line, found.over, found.under], [32.5, -140, 110]);
});

test('a lower PrizePicks line is likelier to go over, a higher one less', () => {
  const lower = bookChance(row('Luka Doncic', 'player_points', 30.5), players);
  const higher = bookChance(row('Luka Doncic', 'player_points', 34.5), players);
  assert.ok(lower.moved && lower.chance > 0.56 && lower.chance < 0.8, lower.chance);
  assert.ok(higher.chance < 0.56 && higher.chance > 0.3, higher.chance);
  // A whole-number line: over means one more than it.
  const whole = bookChance(row('Luka Doncic', 'player_rebounds', 9), players);
  assert.ok(whole.chance < 0.5);
  const even = bookChance(row('Luka Doncic', 'player_rebounds', 8.5), players);
  assert.equal(even.chance, 0.5);
});

test('nothing when DraftKings has no price for him in the stat', () => {
  assert.equal(bookChance(row('Luka Doncic', 'player_assists', 8.5), players), null);
  assert.equal(bookChance(row('Nobody', 'player_points', 10.5), players), null);
  assert.equal(bookChance(row('Luka Doncic', 'player_points', 32.5), null), null);
  assert.equal(bookChance(row('Jaren Jackson Jr.', 'player_blocks', 1.5), players).chance, 0.42);
});

test('prices as DraftKings shows them', () => {
  assert.equal(priceText(-140), '−140');
  assert.equal(priceText(120), '+120');
  assert.equal(priceText(null), '');
});
