// The basketball Opportunity card's words and numbers (src/sports/wnba/opportunity.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {absences, familyOf, gameRows, opportunityFacts, opportunityRead, playerTiles, seasonName, seasonsName, trackingTiles} from '../src/sports/wnba/opportunity.js';
import {matchupCase} from '../src/slip-matchup.js';
import {gradeProp} from '../src/prop-analyze.js';
import {buildInsight} from '../src/prop-insight.js';

const season = {games: 40, min: 34.2, usage: 28.4, fga: 18.1, fta: 6.2, tpa: 7.0, tpPct: 37.5, rebShare: 14.9, orebShare: 5.1, drebShare: 24.2,
  missesOn: 33.4, astShare: 31.0, mateFg: 47.2, possOn: 70.1, per36: {fga: 19.1}};
const chances = {games: 40, szn: season, l10: {...season, min: 36.0, usage: 30.1}};

test('each stat reads what it comes from', () => {
  assert.equal(familyOf('pts'), 'points');
  assert.equal(familyOf('tpm'), 'threes');
  assert.equal(familyOf('pra'), 'combo');
  assert.equal(familyOf('stl'), 'general');
  const keys = stat => playerTiles(stat, chances).map(tile => tile.key);
  assert.deepEqual(keys('pts'), ['min', 'usage', 'fga', 'fta']);
  assert.deepEqual(keys('reb'), ['min', 'rebShare', 'missesOn']);
  assert.deepEqual(keys('ast'), ['min', 'astShare', 'mateFg']);
  assert.deepEqual(keys('tpm'), ['min', 'tpa', 'fga']);
  assert.deepEqual(keys('pra'), ['min', 'usage', 'rebShare', 'missesOn', 'astShare', 'mateFg', 'possOn']);
  assert.deepEqual(playerTiles('pts', null), []);
});

test('tiles say what the number is', () => {
  const [minutes, usage] = playerTiles('pts', chances, {projected: 35.4});
  assert.equal(minutes.value, '34.2');
  assert.equal(minutes.note, 'Last 10: 36 · Projected tonight: 35.4');
  assert.equal(usage.value, '28.4%');
  assert.equal(usage.unit, 'while on the floor');
  assert.match(usage.note, /His shots, free-throw trips and turnovers \(usage\) · Last 10: 30.1%/);
});

test('NBA tracking tiles when the NBA answered', () => {
  const tracking = {available: true, season: '2025-26', passing: {potentialAst: 11.2, ast: 7.1}, rebounding: {chances: 15, chancePct: 65.3, contestedPct: 41},
    catchShoot: {fg3a: 4.2, fg3Pct: 38.9}, pullUp: {fg3a: 2.1}, touches: {touches: 70.4, timeOfPoss: 6.1}, recent: {passing: {potentialAst: 12.6}}};
  const assists = trackingTiles('ast', tracking);
  assert.equal(assists[0].value, '11.2');
  assert.equal(assists[0].note, 'Passes a teammate shot off; 63% became assists · Last 10: 12.6');
  assert.deepEqual(trackingTiles('reb', tracking).map(tile => tile.key), ['chances']);
  assert.match(trackingTiles('reb', tracking)[0].note, /grabs 65.3% · 41% contested/);
  assert.deepEqual(trackingTiles('tpm', tracking).map(tile => tile.key), ['catchShoot']);
  assert.deepEqual(trackingTiles('ast', {available: false}), []);
});

test('tonight: pace from both teams, and what the defense gives the stat', () => {
  const table = {count: 30, league: {poss: 99.0, drtg: 114.0, miss: 46.0, gameMiss: 92.0, tpaAllowed: 36.0, tpPctAllowed: 36.1},
    teams: {DEN: {poss: [102.0, 4]}, WAS: {poss: [101.0, 7], drtg: [119.5, 2], miss: [48.2, 5], gameMiss: [95.0, 3], tpaAllowed: [40.1, 1], tpPctAllowed: [37.9, 4]}}};
  const [pace, defense] = gameRows('pts', table, 'DEN', 'WAS');
  assert.equal(pace.value, '101.5 possessions');
  assert.equal(pace.words, '2.5 faster than average');
  assert.equal(pace.tone, 'good');
  assert.match(pace.note, /DEN 4th fastest, WAS 7th fastest/);
  assert.equal(defense.value, '119.5 per 100');
  assert.equal(defense.words, '2nd most');
  assert.equal(defense.league, 'league 114');
  assert.deepEqual(gameRows('reb', table, 'DEN', 'WAS').map(row => row.key), ['pace', 'miss', 'gameMiss']);
  const threes = gameRows('tpm', table, 'DEN', 'WAS');
  assert.equal(threes.find(row => row.key === 'tpaAllowed').words, 'the most');
  assert.equal(threes.find(row => row.key === 'tpPctAllowed').league, 'league 36.1%');
  assert.deepEqual(gameRows('pts', table, 'DEN', 'NOPE'), []);
});

test('teammates out tonight: what he did without them', () => {
  const injuries = [{id: '9', name: 'Jamal Murray', status: 'Out'}, {id: '8', name: 'Bench Guy', status: 'Day-To-Day'}, {id: '7', name: 'New Guy', status: 'Doubtful'}];
  const withWithout = [{id: '9', without: {games: 6, avg: 31.5, chances: {min: 37.1, fga: 21.0, usage: 32.0}}, with: {games: 30, avg: 26.0, chances: {min: 34.0, fga: 17.5, usage: 27.5}}}];
  const [murray, fresh] = absences('pts', injuries, withWithout, 'Points');
  assert.equal(murray.games, 6);
  assert.deepEqual(murray.parts, [{label: 'Minutes', without: '37.1', change: '+3.1'}, {label: 'Shots', without: '21', change: '+3.5'},
    {label: 'Usage', without: '32%', change: '+4.5'}]);
  assert.deepEqual(murray.stat, {label: 'Points', without: '31.5', change: '+5.5'});
  assert.equal(fresh.known, false);
  assert.equal(absences('pts', injuries, withWithout).length, 2);  // day-to-day isn't out
});

test('seasons by name', () => {
  assert.equal(seasonName(2026, 'nba'), '2025-26');
  assert.equal(seasonName(2025, 'wnba'), '2025');
  assert.equal(seasonsName([2026, 2027], 'nba'), '2025-26 and 2026-27');
});

// ---------------------------------------------------------------- Analyze

const scorer = {szn: {games: 40, min: 34, pts: 25, fga: 18, fta: 6, per36: {pts: 26.5}}, l10: {games: 10, min: 35, pts: 26, fga: 21, fta: 8}};

test('points: the shot and free-throw trips the line takes against what he gets', () => {
  const read = opportunityRead('pts', 26.5, 'OVER', {chances: scorer});
  // 25 points on 18 + 0.44 x 6 = 20.64 trips: 1.21 a trip. 27 takes 22.3; he's had 24.5 lately.
  assert.equal(read.verdict, 'backed');
  assert.equal(read.title, 'The chances are there');
  assert.equal(read.text, 'At his usual 1.2 points a shot or free-throw trip, 27 points takes about 22.3 shots and free-throw trips; he\'s had 24.5 a game in his last 10 (20.6 this season).');
  assert.equal(opportunityRead('pts', 26.5, 'UNDER', {chances: scorer}).verdict, 'short');
});

test('a streak on hot shooting reads as one', () => {
  const hot = {szn: scorer.szn, l10: {games: 10, min: 34, pts: 30, fga: 18, fta: 6}};
  const read = opportunityRead('pts', 26.5, 'OVER', {chances: hot});
  const point = read.points.find(item => /efficiency/.test(item.text));
  assert.equal(point.tone, 'down');
  assert.match(point.text, /His last 10 ran on efficiency, not more chances: 30 points a game \(25 this season\) on 20\.6 shots and free-throw trips/);
});

test('rebounds: missed shots while he plays; assists: the NBA\'s potential assists', () => {
  const big = {szn: {games: 40, min: 32, reb: 10, missesOn: 34}, l10: {games: 10, min: 32, reb: 10, missesOn: 36}};
  const boards = opportunityRead('reb', 11.5, 'OVER', {chances: big});
  assert.equal(boards.verdict, 'short');
  assert.match(boards.text, /^He grabs 1 of every 3\.4 missed shots while he’s on the floor, so 12 rebounds takes about 40\.8 missed shots while he plays/);
  assert.equal(opportunityRead('reb', 11.5, 'UNDER', {chances: big}).verdict, 'backed');
  const tracking = {available: true, passing: {potentialAst: 11.2, ast: 7.1}, recent: {passing: {potentialAst: 12.6}}};
  const passer = {szn: {games: 40, min: 34, ast: 7, per36: {ast: 7.4}}, l10: {games: 10, min: 34, ast: 7.5}};
  const assists = opportunityRead('ast', 6.5, 'OVER', {chances: passer, tracking});
  assert.equal(assists.verdict, 'backed');
  assert.match(assists.text, /^63% of his potential assists become assists \(NBA tracking\), so 7 assists takes about 11 potential assists; he's had 12\.6 a game/);
  // Without tracking: minutes at his rate, against the model's minutes.
  assert.match(opportunityRead('ast', 6.5, 'OVER', {chances: passer, projected: 35}).text, /^At his 7\.4 assists per 36 minutes, 7 assists takes about 34\.1 minutes; he's projected for 35/);
});

test('a teammate out tonight moves his chances, and grading hears it', () => {
  const injuries = [{id: '9', name: 'Jamal Murray', status: 'Out'}];
  const withWithout = [{id: '9', without: {games: 6, avg: 31.5, chances: {min: 37.1, fga: 21.0, usage: 32.0}}, with: {games: 30, avg: 26.0, chances: {min: 34.0, fga: 17.5, usage: 27.5}}}];
  const read = opportunityRead('pts', 26.5, 'OVER', {chances: scorer, injuries, withWithout, statLabel: 'Points'});
  const out = read.points.find(item => /Murray/.test(item.text));
  assert.equal(out.text, 'Jamal Murray is out: without Murray he\'s averaged 31.5 points (+5.5), 21 shots (+3.5), 32% usage (+4.5) in 6 games');
  assert.equal(out.tone, 'up');
  const facts = opportunityFacts(read, 1);
  assert.deepEqual(facts.map(item => item.key), ['opportunity', 'teammate-out']);
  assert.ok(facts[0].impact > 0 && facts[1].impact > 0);
  assert.ok(opportunityFacts(opportunityRead('pts', 26.5, 'UNDER', {chances: scorer}), -1)[0].impact < 0);
});

test('the matchup case reads the chances a defense gives and his own', () => {
  const opportunity = {count: 30, league: {poss: 99, miss: 46, tpaAllowed: 36, fgPctAllowed: 47},
    teams: {DEN: {poss: [101, 2]}, WAS: {poss: [103, 1], miss: [51, 1], tpaAllowed: [41, 1], fgPctAllowed: [49.5, 1]}, A: {}, B: {}, C: {}}};
  const row = {sport: 'nba', player: 'Nikola Jokic', teamAbbr: 'DEN', opponent: 'WAS', marketKey: 'player_rebounds', market: 'Rebounds', line: 11.5, gameLog: [],
    opportunity: {chances: {szn: {games: 40, min: 34, reb: 12.5, missesOn: 34}, l10: {games: 10, min: 35, reb: 13, missesOn: 37}}}};
  const read = matchupCase({row, side: 'OVER', grade: {records: {}}}, {nba: {opportunity}});
  const misses = read.facts.find(item => item.key === 'miss');
  assert.equal(misses.text, 'WAS misses 51 shots a game (1st-most), league 46: rebounds to be had');
  assert.equal(misses.tone, 'up');
  const own = read.facts.find(item => item.key === 'opportunity');
  assert.equal(own.read.verdict, 'backed');
  // Points read the possessions, not just the scoring.
  const points = matchupCase({row: {...row, marketKey: 'player_points', market: 'Points', opportunity: null}, side: 'OVER', grade: {records: {}}}, {nba: {opportunity}});
  assert.match(points.facts.find(item => item.key === 'pace').text, /fast game: about 102 possessions \(league 99\)/);
});

test('Analyze says whether the chances are there', async () => {
  const DAY = 86400000, later = new Date(Date.now() + 2 * DAY).toISOString();
  const log = [24, 28, 22, 30, 26, 25, 31, 27, 23, 29, 26, 28, 24, 30, 27];
  const w = (hits, games, average) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100, average});
  const row = {id: 'nba:jokic:pts:26.5', sport: 'nba', player: 'Nikola Jokic', playerId: '3112335', position: 'C', market: 'Points', marketKey: 'player_points',
    line: 26.5, modifier: 'standard', startsAt: later, teamAbbr: 'DEN', opponent: 'WAS', homeTeamAbbr: 'DEN', awayTeamAbbr: 'WAS', historyStatus: 'ready',
    gameLog: log.map((value, index) => ({value, usage: 34, date: new Date(Date.now() - (log.length - index) * 2 * DAY).toISOString().slice(0, 10), opponent: 'SEA', home: index % 2 === 0})),
    windows: {l5: w(3, 5, 27), l10: w(6, 10, 26.6), l20: w(8, 15, 26.3), season: w(8, 15, 26.3)}};
  const offline = {loadLines: async () => [], loadMatchups: async () => ({}), loadLearning: async () => null, loadGames: async () => ({}),
    loadTeammates: async () => ({}), loadSoccerOpponents: async () => null, enrich: () => null, loadOpportunity: async () => ({chances: scorer})};
  const {row: graded, over, under} = await gradeProp(row, {deps: offline});
  assert.ok(graded.opportunity.chances);
  const insight = buildInsight(graded, over, under);
  assert.ok(insight.opportunity);
  assert.match(insight.opportunity.text, /shots and free-throw trips/);
  assert.ok(['backed', 'edge', 'short'].includes(insight.opportunity.verdict));
  // Its sentence stays out of the reasons and the matchup list: it has its own section.
  assert.ok(!insight.reasons.some(item => /free-throw trips/.test(item.text)));
});
