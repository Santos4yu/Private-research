// The Finder's search (src/finder-search.js): names the way they get typed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch, searchKey} from '../src/finder-search.js';

const find = (row, typed) => matchesSearch(row, searchKey(typed).split(' ').filter(Boolean));
const row = (player, extra = {}) => ({player, teamAbbr: 'MIN', opponent: 'DET', team: 'Minnesota Vikings', ...extra});

test('a name however it is typed', () => {
  assert.ok(find(row('Justin Jefferson'), 'jefferson'));
  assert.ok(find(row('Justin Jefferson'), 'Jefferson Justin'));
  assert.ok(find(row('Justin Jefferson'), 'just jeff'));
  assert.ok(find(row('Luka Dončić'), 'doncic'));
  assert.ok(find(row('Shai Gilgeous-Alexander'), 'gilgeous alexander'));
  assert.ok(find(row('De’Aaron Fox'), "deaaron"));
  assert.ok(find(row("Ja'Marr Chase"), 'jamarr chase'));
  assert.ok(find(row('Jaren Jackson Jr.'), 'jaren jackson jr'));
  assert.ok(find(row('O.G. Anunoby'), 'og anunoby'));
});

test('teams by abbreviation or name; nothing else matches', () => {
  assert.ok(find(row('Sam LaPorta', {teamAbbr: 'DET', opponent: 'MIN', team: 'Detroit Lions'}), 'lions'));
  assert.ok(find(row('Justin Jefferson'), 'det'));
  assert.ok(!find(row('Aaron Rodgers', {teamAbbr: 'PIT', opponent: 'NO', team: 'Pittsburgh Steelers'}), 'jefferson'));
  assert.ok(!find(row('Justin Jefferson'), 'jefferson chase'));
  assert.equal(searchKey('  Dončić — Mavs  '), 'doncic mavs');
});
