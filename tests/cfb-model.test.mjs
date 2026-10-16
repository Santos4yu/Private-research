// College football's prop model: a player's stat as his team's passes (or
// runs) times what he makes of each, today's plays read off the opponent's
// pace and the game's line, and games against FCS sides counting less.
import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCfbHistory, normalizeFinderRows, withCfbDefense} from '../src/unified-finder-data.js';
import {playShare, teamPlays, teamAverages} from '../src/sports/cfb/cfb-stats.js';
import {modelKey, profileOf, projectStat, modelMean, gameContext, usageWords} from '../src/prop-model.js';
import {readPick} from '../src/slip-analyst.js';

const near = (actual, expected, within) => assert.ok(Math.abs(actual - expected) <= within, `${actual} vs ${expected}`);
const day = index => `2026-${String(9 + Math.floor(index / 4)).padStart(2, '0')}-${String(1 + (index % 4) * 7).padStart(2, '0')}`;

// Purdue's games: 32 passes and 20 completions a game; Burhenn's catches,
// yards and longest catch in each. `fcs` marks the games against FCS sides.
function purdue({longest = [21, 17, 14, 26, 14, 30, 8, 15, 19, 22], catches = [4, 3, 3, 4, 3, 5, 2, 3, 4, 4], fcs = [], passes = 32} = {}) {
  const games = longest.map((value, index) => ({gameId: `g${index}`, date: day(index), season: 2026, seasonKind: 'regular', team: 'PUR', teamId: '2509',
    opponent: `O${index}`, opponentId: String(100 + index), opponentFbs: !fcs.includes(index), isHome: index % 2 === 0, result: 'L', score: '20-27',
    players: {'77': {receptions: catches[index], receiving_yards: value * 2, longest_reception: value}},
    totals: {passAttempts: typeof passes === 'function' ? passes(index) : passes, completions: 20, rushAttempts: 34, points: 24},
    against: {passYards: 240, passAttempts: 33, rushAttempts: 36, completions: 21, points: 28}}));
  return {team: 'PUR', teamId: '2509', players: {'77': {name: 'George Burhenn', pos: 'TE'}}, games};
}
const line = {id: 'pp:7', player: 'George Burhenn', playerId: '77', team: 'PUR', teamId: '2509', opponent: 'WASH', opponentId: '264', position: 'TE',
  stat: 'Longest Reception', marketKey: 'longestreception', valueKey: 'longest_reception', line: 12.5, modifier: 'standard',
  startsAt: '2099-10-18T21:00:00Z', homeTeamAbbr: 'PUR', awayTeamAbbr: 'WASH', isHome: true,
  apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}]};
const rowFrom = (log, extra = {}) => applyCfbHistory({...normalizeFinderRows('cfb', {rows: [line]})[0], ...extra}, log);

test('each college game says how many team plays the stat fed on, his share of them and who it came against', () => {
  const totals = {passAttempts: 30, rushAttempts: 40, completions: 18};
  assert.equal(teamPlays(totals, 'receiving_yards'), 30);
  assert.equal(teamPlays(totals, 'rushing_yards'), 40);
  assert.equal(teamPlays(totals, 'rushing_receiving_yards'), 70);
  assert.equal(teamPlays({}, 'receiving_yards'), null, 'nothing made up without the box score');
  assert.equal(teamPlays(totals, 'tackles'), null);
  near(playShare({values: {receptions: 6}, totals}, 'receiving_yards'), 1 / 3, 1e-9);
  near(playShare({values: {rush_attempts: 20}, totals}, 'rushing_yards'), 0.5, 1e-9);
  near(playShare({values: {passing_attempts: 29}, totals}, 'passing_yards'), 29 / 30, 1e-9);
  near(playShare({values: {rush_attempts: 10, receptions: 4}, totals}, 'rushing_receiving_yards'), 14 / 70, 1e-9);
  const row = rowFrom(purdue({fcs: [5]}));
  assert.equal(row.gameLog.length, 10);
  assert.deepEqual(row.gameLog.map(game => game.usage), Array(10).fill(32));
  near(row.gameLog[0].share, 4 / 20, 1e-9);
  assert.equal(row.gameLog[5].fbs, false, 'the FCS game is marked');
  assert.equal(row.gameLog[4].fbs, true);
  assert.deepEqual(teamAverages(purdue()), {games: 10, points: 24, passAttempts: 32, rushAttempts: 34});
  assert.equal(row.cfbTeam.points, 24);
});

test('a college line is projected from his team\'s passes and what he makes of each', () => {
  const row = rowFrom(purdue());
  assert.equal(modelKey(row), 'cfb:longest_reception');
  assert.equal(profileOf(row).unit, 'plays');
  assert.equal(modelKey({sport: 'cfb', valueKey: 'tackles'}), 'cfb:tackles');
  assert.equal(profileOf({sport: 'cfb', valueKey: 'tackles'}), null, 'a stat the model doesn\'t know keeps the old path');
  const model = projectStat(row);
  assert.equal(model.unit, 'plays');
  assert.equal(model.usage, 32);
  // His longest catch a game, recent games counting most: about 18 yards.
  near(modelMean(model), 18, 2);
  assert.equal(usageWords(model), '32 team passes');
});

test('a big day against an FCS side counts for less', () => {
  const longest = [14, 13, 15, 12, 14, 48, 13, 15, 14, 13];
  const fbs = projectStat(rowFrom(purdue({longest})));
  const fcs = projectStat(rowFrom(purdue({longest, fcs: [5]})));
  assert.ok(modelMean(fcs) < modelMean(fbs) - 1.5, `${modelMean(fcs)} vs ${modelMean(fbs)}`);
  // Unknown (an older saved log) is counted in full.
  const unknown = rowFrom({...purdue({longest}), games: purdue({longest}).games.map(({opponentFbs, ...rest}) => rest)});
  assert.equal(unknown.gameLog[5].fbs, undefined);
  near(modelMean(projectStat(unknown)), modelMean(fbs), 1e-9);
});

test('today\'s passes follow the opponent\'s pace, the spread\'s game script and the blowout risk', () => {
  const base = rowFrom(purdue());
  const profile = profileOf(base);
  // Washington faces 40 passes a game against a board average of 32.
  const opponent = {key: 'passYards', value: 260, average: 235, rank: 9, teams: 10, games: 7, passes: 40, runs: 30, passAverage: 32, runAverage: 35};
  const busy = gameContext({...base, cfbOpponent: opponent}, profile, 32);
  assert.ok(busy.usage > 1.08 && busy.usage <= 1.12, busy.usage);
  assert.ok(busy.used.includes('volume'));
  assert.match(busy.notes.find(note => note.key === 'volume').text, /WASH faces 40 passes a game \(board average 32\)/);
  // A per-game defense-vs-position number already carries the pace.
  assert.equal(gameContext({...base, cfbOpponent: opponent, defenseValue: 60}, profile, 32).usage, 1);
  // A 10.5-point underdog throws more as the game goes on.
  const game = spread => ({team: 'PUR', state: 'pre', odds: {total: 51.5, spread: {PUR: spread, WASH: -spread}, win: null}});
  const behind = gameContext({...base, game: game(10.5)}, profile, 32);
  assert.ok(behind.usage > 1.03, behind.usage);
  assert.match(behind.notes.find(note => note.key === 'script').text, /10\.5-point underdog: more passes/);
  // A 24.5-point favorite throws less, and its starters may sit late.
  const ahead = gameContext({...base, game: game(-24.5)}, profile, 32);
  assert.ok(ahead.usage < 0.85, ahead.usage);
  assert.ok(ahead.risks.some(risk => /Blowout risk \(24\.5-point spread\)/.test(risk)), JSON.stringify(ahead.risks));
  // Expected to score 20.5 (51.5 total, +10.5) against 24 a game: fewer yards.
  assert.ok(behind.rate < 1, behind.rate);
  assert.match(behind.notes.find(note => note.key === 'scoring').text, /expected to score about 20\.5 \(24 a game so far\)/);
  // Under way, the pregame line says nothing more.
  assert.equal(gameContext({...base, game: {...game(10.5), state: 'in'}}, profile, 32).used.includes('script'), false);
});

test('today\'s opponent is read from the defenses on the board, per pass it faces when the model counts the passes', () => {
  const logs = ['WASH', 'OSU', 'MICH', 'IOWA', 'MINN', 'ILL'].map((team, index) => ({team, games: [1, 2, 3].map(week => ({gameId: `${team}${week}`,
    date: `2026-09-0${week}`, season: 2026, team, opponent: 'X', players: {}, totals: {},
    against: {passYards: team === 'WASH' ? 290 : 220 + index, passAttempts: team === 'WASH' ? 38 : 32, rushAttempts: 35, points: 24}}))}));
  const [row] = withCfbDefense([rowFrom(purdue())], logs);
  const opponent = row.cfbOpponent;
  assert.equal(opponent.key, 'passYards');
  assert.equal(opponent.value, 290);
  assert.equal(opponent.rank, 6, 'gives up the most passing yards on the board');
  assert.equal(opponent.passes, 38);
  const read = readPick(row, 'OVER', {records: {}});
  assert.equal(read.model?.unit, 'plays');
  const matchup = read.factors.find(item => item.key === 'matchup');
  assert.match(matchup.text, /WASH allows 290 passing yards a game, \d+% more than the average defense on today's board/);
  // 290 on 38 passes faced is 7.6 a pass; the board's 230 on 33 is 7.0.
  // Per pass that's a smaller edge than per game.
  assert.ok(matchup.factor > 1 && matchup.factor < 1.05, matchup.factor);
  assert.ok(read.model.used.includes('volume'));
});

test('a college player\'s role is his share of the team\'s catches, not its plays', () => {
  const catches = [2, 2, 3, 2, 2, 3, 2, 6, 7, 6];
  const row = rowFrom(purdue({catches, passes: index => 30 + index}));
  const read = readPick(row, 'OVER', {records: {}});
  const role = read.factors.find(item => item.key === 'role');
  assert.match(role.text, /^Share of PUR's catches up to 32% over his last 3 games from 11%/);
  assert.ok(role.factor > 1);
  assert.ok(!read.factors.some(item => /Playing time/.test(item.text || '')), 'the team\'s plays aren\'t his playing time');
});

test('the screenshot\'s case: a tight end\'s longest catch gets an opponent read, not just splits and form', async () => {
  const {matchupCase, withMatchups} = await import('../src/slip-matchup.js');
  const base = rowFrom(purdue({fcs: [8], catches: [2, 2, 3, 2, 2, 3, 2, 6, 7, 6]}));
  // The league table keeps no tight-end longest catch; its team table has Washington's pass defense.
  const league = {teamCount: 4, teams: {WASH: {}, PUR: {}, OSU: {}, IOWA: {}},
    dvp: {WASH: {TE: {stats: {receptions: {szn: [4, 2]}}}}, PUR: {TE: {stats: {}}}, OSU: {TE: {stats: {}}}, IOWA: {TE: {stats: {}}}},
    teamStats: {WASH: {off: {}, def: {passing_yards: [262, 4]}}, PUR: {off: {}, def: {passing_yards: [230, 3]}}, OSU: {off: {}, def: {passing_yards: [170, 1]}},
      IOWA: {off: {}, def: {passing_yards: [190, 2]}}}};
  const row = {...withMatchups(base, {cfb: league}), game: {team: 'PUR', state: 'pre', odds: {total: 51.5, spread: {PUR: 10.5, WASH: -10.5}}}};
  const {facts, primary} = matchupCase({row, side: 'OVER'}, {cfb: league});
  const text = facts.map(item => item.text);
  assert.ok(primary, JSON.stringify(text));
  assert.ok(facts.some(item => item.key === 'team-defense' && /WASH allows 262 passing yards a game/.test(item.text) && item.impact > 0), JSON.stringify(text));
  assert.ok(facts.some(item => item.key === 'role' && /Share of PUR's catches up to/.test(item.text)), JSON.stringify(text));
  assert.ok(facts.some(item => item.key === 'fcs' && /1 of his last 10 games came against FCS teams/.test(item.text)), JSON.stringify(text));
  assert.ok(facts.some(item => item.key === 'pace' && /10\.5-point underdog, expected to score about 20\.5 \(24 a game so far\); more passes/.test(item.text)),
    JSON.stringify(text));
});

test('without the league table, the defenses on today\'s board stand in', async () => {
  const {matchupCase} = await import('../src/slip-matchup.js');
  const opponent = {key: 'passYards', value: 262, average: 228, rank: 8, teams: 8, games: 7, passes: 37, runs: 33, passAverage: 33, runAverage: 35};
  const row = {...rowFrom(purdue()), cfbOpponent: opponent};
  const {facts, primary} = matchupCase({row, side: 'UNDER'}, {});
  assert.ok(primary);
  const defense = facts.find(item => item.key === 'team-defense');
  assert.match(defense.text, /WASH allows 262 passing yards a game, 15% more than the average defense on today's board \(1st-most\)/);
  assert.ok(defense.impact < 0, 'a generous defense counts against the Under');
  assert.match(facts.find(item => item.key === 'volume').text, /WASH faces 37 passes a game \(board average 33\)/);
});
