// College football in the Finder: PrizePicks' CFB lines (cfb_board.py) as
// rows, their hit rates from the team's games (cfb_research.team_log), and
// how generous each defense on the board is.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCfbHistory, enrichCfbRows, normalizeFinderRows, withCfbDefense, finderHistoryKey} from '../src/unified-finder-data.js';
import {allowTable, allowedByTeam, cfbChart, playerGames} from '../src/sports/cfb/cfb-stats.js';

const game = (gameId, date, opponent, opponentId, players, against = {}, season = 2026, team = 'TEX') =>
  ({gameId, date, season, seasonKind: 'regular', team, teamId: '251', opponent, opponentId, isHome: true, result: 'W', score: '31-17', players, against});
const texas = {team: 'TEX', teamId: '251', players: {'4870906': {name: 'Arch Manning', pos: 'QB'}, '5000002': {name: 'Ryan Wingo', pos: 'WR'}}, games: [
  game('g1', '2025-11-29', 'TA&M', '245', {'4870906': {passing_yards: 210}}, {}, 2025),
  game('g2', '2026-09-06', 'OSU', '194', {'4870906': {passing_yards: 301}, '5000002': {receptions: 6}}),
  game('g3', '2026-09-13', 'SJSU', '23', {'5000002': {receptions: 2}}),
  game('g4', '2026-09-20', 'UTEP', '2638', {'4870906': {passing_yards: 260}, '5000002': {receptions: 5}}),
  game('g5', '2026-10-04', 'OU', '201', {'4870906': {passing_yards: 180}}),
]};
const line = {id: 'pp:1', player: 'Arch Manning', playerId: '4870906', team: 'TEX', teamId: '251', opponent: 'OU', opponentId: '201',
  position: 'QB', stat: 'Pass Yards', marketKey: 'passyards', valueKey: 'passing_yards', line: 249.5, modifier: 'standard',
  startsAt: '2099-10-17T19:30:00Z', gameId: '401700001', homeTeamAbbr: 'OU', awayTeamAbbr: 'TEX', isHome: false,
  apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}]};

test('CFB rows carry the ESPN team, game and player, and wait for their hit rates', () => {
  const [row] = normalizeFinderRows('cfb', {rows: [line]});
  assert.equal(row.id, 'cfb:pp:1');
  assert.equal(row.sport, 'cfb');
  assert.equal(row.historyStatus, 'pending');
  assert.deepEqual([row.teamAbbr, row.teamId], ['TEX', '251']);
  assert.equal(row.opponentId, '201');
  assert.equal(finderHistoryKey(row), 'cfb:251:', 'one saved log per team, the server\'s key');
  const [unmatched] = normalizeFinderRows('cfb', {rows: [{...line, id: 'pp:2', playerId: null}]});
  assert.equal(unmatched.historyStatus, 'none');
});

test('a player\'s hit rates leave out games he isn\'t in the box score for', () => {
  const [row] = normalizeFinderRows('cfb', {rows: [line]});
  const games = playerGames(texas, '4870906');
  assert.deepEqual(games.map(item => [item.gameId, item.dnp]), [['g1', false], ['g2', false], ['g3', true], ['g4', false], ['g5', false]]);
  const scored = applyCfbHistory(row, texas);
  assert.equal(scored.historyStatus, 'ready');
  assert.deepEqual([scored.windows.l5.hits, scored.windows.l5.decisions], [2, 4]);
  assert.deepEqual([scored.windows.season.hits, scored.windows.season.decisions], [2, 3], 'this season only');
  assert.deepEqual([scored.windows.h2h.hits, scored.windows.h2h.decisions], [0, 1], 'last time against Oklahoma');
  assert.equal(scored.streak, -1);
  assert.equal(scored.gameLog.length, 4);
  const chart = cfbChart(games, 'passing_yards', 'OU');
  assert.deepEqual(chart.h2h.map(item => item.value), [180]);
});

// Seven defenses on the board: Oklahoma gives up the most passing yards.
const logs = ['OU', 'UGA', 'ALA', 'LSU', 'OSU', 'TEX', 'MICH'].map((team, index) => ({team, games: [1, 2, 3].map(week =>
  game(`${team}${week}`, `2026-09-0${week}`, 'X', '1', {}, {passYards: team === 'OU' ? 300 : 200 + index, points: 20}, 2026, team))}));

test('each defense on the board is rated against the others, for what the stat feeds on', () => {
  const allowed = allowedByTeam(logs);
  assert.equal(allowed.OU.passYards, 300);
  const table = allowTable(allowed, 'receiving_yards');
  // 38% more than the average, pulled halfway in on three games.
  assert.ok(table.OU > 1.15 && table.OU < 1.25, table.OU);
  assert.ok(table.UGA < 1, table.UGA);
  assert.equal(allowTable(allowed, 'tackles'), null, 'a defender\'s stat has nothing to read');
  const [rated] = withCfbDefense(normalizeFinderRows('cfb', {rows: [line]}), logs);
  assert.equal(rated.allowTable.OU, allowTable(allowed, 'passing_yards').OU);
});

test('the board fills in one request per team, then every line gets its defense table', async () => {
  const rows = normalizeFinderRows('cfb', {rows: [line, {...line, id: 'pp:3', player: 'Ryan Wingo', playerId: '5000002', valueKey: 'receptions',
    stat: 'Receptions', marketKey: 'receptions', line: 4.5}]});
  const asked = [];
  const fetcher = async url => { asked.push(url); return {ok: true, status: 200, json: async () => texas}; };
  const updates = [];
  const out = await enrichCfbRows(rows, {fetcher, onRows: batch => updates.push(batch)});
  assert.equal(asked.length, 1);
  assert.match(asked[0], /view=cfb&resource=log&team=251/);
  assert.deepEqual(out.map(row => row.historyStatus), ['ready', 'ready']);
  assert.deepEqual([out[1].windows.l10.hits, out[1].windows.l10.decisions], [2, 3]);
  assert.equal(updates.length, 2, 'the rows as they fill, then once more with the defense tables');
});
