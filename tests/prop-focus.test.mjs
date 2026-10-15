// The rows a player page's Matchup and Defense tabs light up and lead with
// for the line being researched (src/prop-focus.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {propFocus} from '../src/prop-focus.js';

test('NFL: a rush yards line leads with rush yards, then what feeds it', () => {
  const focus = propFocus({sport: 'nfl', marketKey: 'rushing_yards'});
  assert.equal(focus.of('rushing_yards'), 'key');
  assert.equal(focus.of('carries'), 'related');
  assert.equal(focus.of('receptions'), null);
  assert.deepEqual(focus.order(['receptions', 'rushing_tds', 'carries', 'rushing_yards', 'rush_rec_yards']),
    ['rushing_yards', 'carries', 'rush_rec_yards', 'receptions', 'rushing_tds']);
  // A tackles line counts every tackle he's in on.
  assert.equal(propFocus({sport: 'nfl', marketKey: 'tackles'}).of('tackles_assists'), 'key');
});

test('college lines and tables go by the market names', () => {
  const focus = propFocus({sport: 'cfb', valueKey: 'passing_touchdowns'});
  assert.equal(focus.of('passing_touchdowns'), 'key', 'the defense table');
  assert.equal(focus.of('passing_tds'), 'key', 'the team table');
  assert.equal(propFocus({sport: 'cfb', valueKey: 'rush_attempts'}).of('carries'), 'key');
});

test('basketball, hockey, soccer and baseball', () => {
  const points = propFocus({sport: 'wnba', marketKey: 'player_points'});
  assert.equal(points.of('pts'), 'key');
  assert.equal(points.of('pra'), 'related');
  assert.equal(propFocus({sport: 'nhl', valueKey: 'saves'}).of('shots_faced'), 'related');
  const saves = propFocus({sport: 'soccer', marketKey: 'goaliesaves'});
  assert.equal(saves.group, 'defense', 'the team comparison opens on its group');
  assert.equal(saves.of('Saves'), 'key');
  assert.equal(propFocus({sport: 'mlb', marketKey: 'pitching:strikeouts'}).of('kPer9'), 'key');
  assert.equal(propFocus({sport: 'mlb', marketKey: 'hitting:hr'}).of('opsAgainst'), 'related');
});

test('a line it doesn\'t know leaves every table as it is', () => {
  const focus = propFocus({sport: 'tennis', marketKey: 'aces'});
  assert.equal(focus.of('anything'), null);
  assert.deepEqual(focus.order(['b', 'a']), ['b', 'a']);
  assert.equal(propFocus(null).of('x'), null);
});
