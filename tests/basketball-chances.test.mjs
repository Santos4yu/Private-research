import test from 'node:test';
import assert from 'node:assert/strict';
import {loadChances, withChances} from '../src/basketball-chances.js';

const nba = (key, extra = {}) => ({key, row: {sport: 'nba', player: `P${key}`, playerId: `${key}`, teamAbbr: 'IND', opponent: 'NO',
  homeTeam: 'New Orleans Pelicans', awayTeam: 'Indiana Pacers', homeTeamAbbr: 'NO', awayTeamAbbr: 'IND', team: 'Indiana Pacers',
  marketKey: 'player_points', line: 12.5, ...extra}});

test('basketball picks get their chances; others and failures are left alone', async () => {
  const asked = [];
  const get = async (resource, params) => {
    asked.push(params.playerId);
    if (params.playerId === '2') throw new Error('down');
    return {opportunity: {szn: {min: 30, usg: 21}, l10: {min: 32}}};
  };
  const found = await loadChances([nba(1), nba(2), {key: 'x', row: {sport: 'mlb', player: 'Someone'}}, nba(3)], {get, limit: 2});
  assert.deepEqual(asked.sort(), ['1', '2']);   // the limit, basketball only
  assert.deepEqual(Object.keys(found), ['1']);
  const row = withChances(nba(1).row, found[1]);
  assert.deepEqual(row.opportunity.szn, {min: 30, usg: 21});
  assert.ok('projected' in row.opportunity);
  const plain = nba(4).row;
  assert.equal(withChances(plain, null), plain);
});
