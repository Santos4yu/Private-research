import test from 'node:test';
import assert from 'node:assert/strict';
import {linkTarget, findLinkedRow, propStatKey, readFinderView, saveFinderView, FINDER_VIEW_KEY} from '../src/unified-finder-data.js';

const row = (id, player, market, extra = {}) => ({id, sport: 'nhl', player, market, modifier: 'standard', ...extra});

test('a notification link names a prop by sport, player and stat', () => {
  assert.deepEqual(linkTarget('?sport=NHL&player=Aleksander+Barkov&stat=Shots+On+Goal'), {sport: 'nhl', player: 'Aleksander Barkov', stat: 'Shots On Goal'});
  assert.equal(linkTarget('?sport=nhl'), null);
  assert.equal(linkTarget(''), null);
});

test('the linked prop is found by name, standard line first, whatever the stat is called', () => {
  const rows = [row('a', 'Aleksander Barkov', 'Points'), row('g', 'Aleksander Barkov', 'Shots On Goal', {modifier: 'goblin'}),
    row('s', 'Aleksander Barkov', 'Shots On Goal'), row('w', "A'ja Wilson", 'Points + Rebounds + Assists', {sport: 'wnba'})];
  assert.equal(findLinkedRow(rows, {sport: 'nhl', player: 'aleksander barkov', stat: 'Shots On Goal'}).id, 's');
  assert.equal(findLinkedRow(rows, {sport: 'wnba', player: 'Aja Wilson', stat: 'Pts+Rebs+Asts'}).id, 'w');
  assert.equal(findLinkedRow(rows, {sport: 'nhl', player: 'Aleksander Barkov', stat: 'Assists'}), null);
  assert.equal(propStatKey('3-Pointers Made'), propStatKey('3-PT Made'));
});

test('the Finder comes back as it was left, for a day, with only sensible values', () => {
  const store = new Map();
  const storage = {getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value)};
  const now = Date.parse('2026-09-29T20:00:00Z');
  saveFinderView(storage, {picked: ['nhl'], teamFilter: ['FLA', 7], sorts: [{key: 'line', direction: 'asc'}, {key: 'x', direction: 'up'}],
    pageSize: 50, hitFilter: {windows: ['l10'], min: 60, max: 100}}, now);
  assert.deepEqual(readFinderView(storage, now + 60 * 1000), {picked: ['nhl'], teamFilter: ['FLA'], sorts: [{key: 'line', direction: 'asc'}],
    pageSize: 50, hitFilter: {windows: ['l10'], min: 60, max: 100}});
  assert.deepEqual(readFinderView(storage, now + 25 * 60 * 60 * 1000), {});
  store.set(FINDER_VIEW_KEY, 'not json');
  assert.deepEqual(readFinderView(storage, now), {});
  assert.deepEqual(readFinderView(null, now), {});
});
