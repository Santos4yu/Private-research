import test from 'node:test';
import assert from 'node:assert/strict';
import { filterNFLPlayers, gameStatValue, NFL_RECENT_KEY, propsForPosition, researchHealth, selectNextGame, summarizeLogs, teamLogoUrl, visibleGame } from '../src/sports/nfl/nfl-ui-core.js';

const definitions = [
  { key: 'passing_yards', positions: ['QB'] },
  { key: 'receiving_yards', positions: ['RB', 'WR', 'TE'] },
];

test('position-aware props never mix quarterback and receiver markets', () => {
  assert.deepEqual(propsForPosition(definitions, 'QB').map((row) => row.key), ['passing_yards']);
  assert.deepEqual(propsForPosition(definitions, 'WR').map((row) => row.key), ['receiving_yards']);
});

test('NFL search and recent storage stay in the NFL namespace', () => {
  const players = [{ name: 'Josh Allen', position: 'QB', team_id: 'BUF' }, { name: 'Aaron Judge', position: 'OF', team_id: 'NYY', sport: 'MLB' }];
  assert.deepEqual(filterNFLPlayers(players.filter((row) => ['QB', 'RB', 'WR', 'TE'].includes(row.position)), 'allen').map((row) => row.name), ['Josh Allen']);
  assert.match(NFL_RECENT_KEY, /nfl/);
  assert.doesNotMatch(NFL_RECENT_KEY, /mlb/);
});

test('game identity and next opponent preserve home and away teams', () => {
  const games = [{ id: 'g1', starts_at: '2026-09-12T20:00:00Z', status: 'SCHEDULED', home_team: { id: 'MIN' }, away_team: { id: 'GB' } }];
  assert.equal(visibleGame(games[0], 'GB').location, 'AWAY');
  assert.equal(visibleGame(games[0], 'GB').opponent.id, 'MIN');
  assert.equal(selectNextGame(games, 'GB', new Date('2026-09-11T00:00:00Z')).id, 'g1');
});

test('missing game values stay missing while measured zero remains zero', () => {
  assert.equal(gameStatValue({ stats: { receiving_yards: 0 } }, 'receiving_yards'), 0);
  assert.equal(gameStatValue({ stats: {} }, 'receiving_yards'), null);
  assert.deepEqual(summarizeLogs([{ stats: { receiving_yards: 0 } }, { stats: {} }], 'receiving_yards'), { games: 1, average: 0, median: 0 });
});

test('research health measures connected data and does not produce a model score', () => {
  assert.deepEqual(researchHealth({ player: { id: '00-1' }, logsStatus: 'AVAILABLE', usageStatus: 'MISSING', injuryStatus: 'AVAILABLE', scheduleStatus: 'AVAILABLE' }), { label: 'GOOD', coverage: 80, lineAvailable: false });
});

test('team logos use the official NFL transparent SVG host', () => {
  assert.equal(teamLogoUrl('jax'), 'https://static.www.nfl.com/t_q-best/league/api/clubs/logos/JAX.svg');
  assert.equal(teamLogoUrl(''), '');
});
