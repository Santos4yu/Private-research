// Who guards him (src/sports/wnba/defenders.js): today's opponent's players, less anyone out tonight.
import test from 'node:test';
import assert from 'node:assert/strict';
import {nameKey, theirDefenders, theirSeasons} from '../src/sports/wnba/defenders.js';

const data = {season: '2025-26', opponent: 'CHI',
  theirs: [{id: '1', name: 'Josh Giddey', poss: 60, share: 46, seasons: ['2025-26']},
    {id: '2', name: 'Isaac Okoro', poss: 65, share: 48, seasons: ['2026-27', '2025-26']},
    {id: '3', name: 'Matas Buzelis', poss: 6, share: 5, seasons: ['2025-26']}],
  defenders: [{id: '4', name: 'Jordan Hawkins', team: 'CHI', poss: 30}]};

test('the opponent-only list, most time first, anyone out tonight left off', () => {
  assert.deepEqual(theirDefenders(data).map(item => item.name), ['Isaac Okoro', 'Josh Giddey', 'Matas Buzelis']);
  const injuries = [{name: 'Josh Giddey', status: 'Out'}, {name: 'Matas Buzelis', status: 'Day-To-Day'}];
  assert.deepEqual(theirDefenders(data, injuries).map(item => item.name), ['Isaac Okoro', 'Matas Buzelis']);
  // An older answer without the list: the defenders on that team now, as before.
  assert.deepEqual(theirDefenders({opponent: 'CHI', defenders: data.defenders}).map(item => item.name), ['Jordan Hawkins']);
  assert.deepEqual(theirDefenders(null), []);
});

test('names and seasons as written', () => {
  assert.equal(nameKey('Nikola Jokić'), 'nikola jokic');
  assert.equal(nameKey("De'Aaron Fox Jr."), 'deaaron fox');
  assert.equal(nameKey('P.J. Washington'), nameKey('PJ Washington'));
  assert.equal(theirSeasons(data, data.theirs), '2025-26 and 2026-27');
  assert.equal(theirSeasons(data, []), '2025-26');
});
