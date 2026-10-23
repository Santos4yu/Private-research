import test from 'node:test';
import assert from 'node:assert/strict';
import {baseMarket, isPeriodMarket, periodless, playerContextParams, hasPlayerContext} from '../src/sports/wnba/wnba-research.js';
import {WNBA_STATS, gameDetails, researchRows, wnbaChart} from '../src/sports/wnba/trend-data.js';
import {withDefense} from '../src/unified-finder-data.js';
import {matchupCase} from '../src/slip-matchup.js';

const row = {sport: 'nba', player: 'Nikola Jokic', playerId: '3112335', team: 'Denver Nuggets', homeTeam: 'Denver Nuggets', teamAbbr: 'DEN',
  homeTeamAbbr: 'DEN', awayTeamAbbr: 'WAS', opponent: 'WAS', marketKey: 'player_rebounds_1q', market: '1Q Rebounds', line: 3.5, position: 'C', gameLog: []};

test('a period line and the whole-game market it belongs to', () => {
  assert.equal(isPeriodMarket('player_points_1q'), true);
  assert.equal(isPeriodMarket('player_points_rebounds_assists_1h'), true);
  assert.equal(isPeriodMarket('player_points'), false);
  assert.equal(baseMarket('player_points_rebounds_assists_1h'), 'player_points_rebounds_assists');
  assert.equal(baseMarket('player_points'), 'player_points');
  assert.equal(periodless('1Q Points'), 'Points');
  assert.equal(periodless('Points 1st Half'), 'Points');
  assert.equal(periodless('1H Pts+Rebs+Asts'), 'Pts+Rebs+Asts');
  // His page asks for the whole game's context, without the 1Q number.
  assert.deepEqual(playerContextParams(row), {playerId: '3112335', team: 'DEN', opponent: 'WAS', market: 'player_rebounds', line: undefined, league: 'nba'});
  assert.equal(hasPlayerContext(row), true);
  assert.equal(playerContextParams({...row, marketKey: 'player_rebounds'}).line, 3.5);
});

test('every period line has a chart tab', () => {
  const keys = WNBA_STATS.map(stat => stat.key);
  for (const key of ['player_points_1q', 'player_threes_1q', 'player_points_rebounds_assists_1h', 'player_rebounds_assists_1h']) assert.ok(keys.includes(key), key);
  assert.deepEqual(WNBA_STATS.find(stat => stat.key === 'player_points_1q'), {key: 'player_points_1q', label: '1Q Points', code: '1Q PTS'});
});

test("a period line's game card adds that part of the game", () => {
  const game = {gameId: '401', date: '2026-10-22T23:30:00Z', opponent: 'WAS', box: {pts: 28, reb: 13, ast: 9, min: 35},
    values: {player_points_1q: 8, player_rebounds_1q: 4, player_assists_1q: 2, player_threes_1q: 1, player_rebounds: 13}};
  assert.deepEqual(gameDetails(game, 'player_rebounds_1q').period, {label: '1Q', pts: 8, reb: 4, ast: 2, tpm: 1});
  assert.deepEqual(gameDetails(game, 'player_rebounds_1q').focus, []);
  assert.equal(gameDetails(game, 'player_rebounds').period, null);
  // The chart plots the period's number; a game without it is left off.
  const chart = wnbaChart([game, {...game, gameId: '402', values: {player_rebounds: 9}}], 'player_rebounds_1q', 'WAS');
  assert.deepEqual(chart.all.map(item => item.value), [4]);
});

test("a period line is graded on the defense's whole-game numbers as a ratio, never on his whole-game chances", () => {
  const dvp = Object.fromEntries(['WAS', 'BOS', 'NYK', 'MIA', 'LAL'].map((team, index) => [team, {C: {stats: {reb: {szn: [12 + index, index + 1]}}}}]));
  const defended = withDefense([row], {dvp, teamCount: 5})[0];
  assert.equal(defended.defenseValue, 12);
  const opportunity = {count: 30, league: {poss: 99, miss: 46}, teams: {DEN: {poss: [101, 2]}, WAS: {poss: [103, 1], miss: [51, 1]}, A: {}, B: {}, C: {}}};
  const chances = {chances: {szn: {games: 40, min: 34, reb: 12.5, missesOn: 34}, l10: {games: 10, min: 35, reb: 13, missesOn: 37}}};
  const read = matchupCase({row: {...defended, opportunity: chances}, side: 'OVER', grade: {records: {}}}, {nba: {opportunity}});
  assert.match(read.facts.find(item => item.key === 'defense').text, /^WAS allows 12 rebounds a game to centers/);
  assert.ok(read.facts.find(item => item.key === 'miss'));
  assert.equal(read.facts.find(item => item.key === 'opportunity'), undefined);
  // The whole-game line does read his chances.
  const whole = matchupCase({row: {...defended, marketKey: 'player_rebounds', market: 'Rebounds', line: 11.5, opportunity: chances}, side: 'OVER', grade: {records: {}}}, {nba: {opportunity}});
  assert.ok(whole.facts.find(item => item.key === 'opportunity'));
});

test('an NBA page charts his dunks on a night with no Dunks line', () => {
  const row = {id: 'zubac|pts', sport: 'nba', player: 'Ivica Zubac', marketKey: 'player_points', market: 'Points', line: 10.5,
    windows: {l10: {hits: 6, sample: 10}}, apps: [{key: 'prizepicks'}]};
  const logs = [{seasonKind: 'preseason', values: {player_dunks: 9}}, ...[1, 2, 3, 1, 0, 2, 4, 1, 2, 1, 3].map(value => ({seasonKind: 'regular', values: {player_dunks: value}})),
    {seasonKind: 'regular', values: {player_points: 12}}];
  const [dunks] = researchRows(row, [row], logs);
  // His last 10 counted games (preseason and uncounted games aside) average 1.9: the chart starts at 1.5.
  assert.deepEqual({key: dunks.marketKey, market: dunks.market, line: dunks.line, only: dunks.researchOnly, windows: dunks.windows, apps: dunks.apps},
    {key: 'player_dunks', market: 'Dunks', line: 1.5, only: true, windows: null, apps: []});
  assert.equal(researchRows(row, [row], [{values: {player_dunks: 0}}])[0].line, 0.5);
  // A posted Dunks line, no counted games or another league: nothing extra.
  assert.deepEqual(researchRows(row, [row, {...row, marketKey: 'player_dunks'}], logs), []);
  assert.deepEqual(researchRows(row, [row], [{values: {player_points: 12}}]), []);
  assert.deepEqual(researchRows({...row, sport: 'wnba'}, [row], logs), []);
});
