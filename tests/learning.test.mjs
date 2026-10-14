// Learning from results, in the browser: the day's corrections applied to
// every chance (learning.js) and the day's top picks sent back to be
// settled (slip-history.js logTopPicks).
import test from 'node:test';
import assert from 'node:assert/strict';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
};

const {calibrate, setLearning, learned, loadLearning} = await import('../src/learning.js');
const {logTopPicks} = await import('../src/slip-history.js');

const MODEL = {version: 1, basis: 2, at: '2026-10-11T12:00:00Z', picks: 400, groups: {
  all: {points: [[0.58, -0.02, 120, 0.56], [0.72, -0.06, 80, 0.66]]},
  mlb: {points: [[0.6, 0.03, 90, 0.63]]},
}};

test('no corrections leaves every chance as the model gave it', () => {
  setLearning(null);
  assert.equal(calibrate(0.64, 'mlb'), 0.64);
  setLearning({version: 2, groups: {}});
  assert.equal(learned(), null, 'an unknown version is ignored');
});

test('a sport with its own results uses them; others borrow all sports', () => {
  setLearning(MODEL);
  assert.ok(Math.abs(calibrate(0.6, 'mlb') - 0.63) < 1e-9);
  // Level past the ends of a group's points.
  assert.ok(Math.abs(calibrate(0.8, 'mlb') - 0.83) < 1e-9);
  // Between two bands: a straight line.
  assert.ok(Math.abs(calibrate(0.65, 'nfl') - (0.65 - 0.04)) < 1e-9);
  assert.ok(Math.abs(calibrate(0.5, 'nfl') - 0.48) < 1e-9);
  setLearning(null);
});

test('corrections fit on another model\'s picks leave the prop model\'s leagues alone', () => {
  setLearning({...MODEL, basis: undefined});
  assert.equal(calibrate(0.6, 'mlb'), 0.6);
  assert.equal(calibrate(0.6, 'nba'), 0.6);
  // Leagues it doesn't read still take them.
  assert.ok(calibrate(0.65, 'nfl') < 0.65);
  setLearning(null);
});

test('a corrected chance stays a chance', () => {
  setLearning({version: 1, basis: 2, groups: {all: {points: [[0.5, -0.15, 50, 0.35]]}}});
  assert.equal(calibrate(0.1, 'nba'), 0.03);
  setLearning({version: 1, basis: 2, groups: {all: {points: [[0.5, 0.15, 50, 0.65]]}}});
  assert.equal(calibrate(0.95, 'nba'), 0.97);
  assert.equal(calibrate(Number.NaN, 'nba'), Number.NaN);
  setLearning(null);
});

test('a failed or signed-out load is asked again, not kept for hours', async () => {
  memory.clear();
  let asked = 0;
  const refused = async () => { asked++; return {ok: false, json: async () => ({})}; };
  assert.equal(await loadLearning({fetcher: refused, now: 1000}), null);
  assert.equal(memory.has('ace-learning'), false);
  const served = async () => { asked++; return {ok: true, json: async () => MODEL}; };
  const found = await loadLearning({fetcher: served, now: 2000});
  assert.equal(asked, 2);
  assert.equal(found.picks, 400);
  assert.equal(JSON.parse(memory.get('ace-learning')).model.picks, 400);
  setLearning(null);
});

const NOW = Date.parse('2026-10-12T16:00:00Z');
const leg = (id, chance, startsAt = '2026-10-12T23:00:00Z') => ({
  side: 'OVER',
  row: {id, sport: 'nfl', player: `Player ${id}`, teamAbbr: 'KC', opponent: 'BUF', startsAt, line: 60.5, market: 'Receiving Yards'},
  grade: {chance, rawChance: chance - 0.02, tier: 'strong'},
});

test('the strongest picks before their games are sent once a day', async () => {
  memory.clear();
  const sent = [];
  const fetcher = async (url, options) => { sent.push(JSON.parse(options.body)); return {json: async () => ({kept: 1})}; };
  const legs = [leg('a', 0.61), leg('b', 0.72), leg('c', 0.66), leg('late', 0.9, '2026-10-12T16:05:00Z')];
  await logTopPicks(legs, {source: 'board', limit: 2, now: NOW, fetcher});
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].picks.map(pick => pick.player), ['Player b', 'Player c']);
  assert.equal(sent[0].picks[0].source, 'board');
  assert.ok(Math.abs(sent[0].picks[0].raw - 0.70) < 1e-9, 'learned from the chance before any correction');
  assert.equal(sent[0].picks[0].model, 2, 'and which model gave it');

  // The same picks again that day: only the one not sent yet goes.
  await logTopPicks(legs, {source: 'assistant', limit: 5, now: NOW + 60000, fetcher});
  assert.deepEqual(sent[1].picks.map(pick => pick.player), ['Player a']);
  // Nothing new: nothing sent.
  const result = await logTopPicks(legs, {limit: 5, now: NOW + 120000, fetcher});
  assert.equal(sent.length, 2);
  assert.equal(result.kept, 0);
});
