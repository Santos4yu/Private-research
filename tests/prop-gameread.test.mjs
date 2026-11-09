// The prop generator's game read (src/prop-gameread.js) on last season's real league numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateProps} from '../src/prop-generator.js';
import {BLOWOUT_MINUTES, callsOf, deepCandidates, minutesPoints, readGame, scenariosOf, streakOf, summaryOf, teammateSplits, tonightGame} from '../src/prop-gameread.js';
import {finderWindow} from '../src/unified-finder-data.js';

const real = JSON.parse(readFileSync(new URL('./fixtures/nba-2025-26-league.json', import.meta.url)));
const DAY = 86400000;
const later = new Date(Date.now() + 5 * 3600e3).toISOString();
const VALUES = [24, 28, 22, 30, 26, 27, 21, 31, 29, 25, 27, 33, 24, 28, 30];
const MINUTES = [35, 36, 33, 37, 34, 38, 30, 36];
const row = (id, {values = VALUES, line = 24.5, minutes = MINUTES, team = 'OKC', opponent = 'DEN', marketKey = 'player_points'} = {}) => ({
  id: `${id}:${marketKey}:${line}`, sport: 'nba', player: id, playerId: id, position: 'G', teamAbbr: team, opponent, homeTeamAbbr: team, awayTeamAbbr: opponent,
  marketKey, market: 'Points', stat: 'Points', line, modifier: 'standard', direction: 'OVER', historyStatus: 'ready', startsAt: later, gameId: `${opponent}@${team}`,
  windows: {l5: finderWindow(values.slice(-5), line), l10: finderWindow(values.slice(-10), line), l20: finderWindow(values.slice(-20), line), season: finderWindow(values, line)},
  average: values.slice(-10).reduce((a, b) => a + b, 0) / 10,
  gameLog: values.map((value, i) => ({value, date: new Date(Date.now() - (values.length - i) * 2 * DAY).toISOString().slice(0, 10), opponent: i === 3 ? opponent : 'BOS',
    home: i % 2 === 0, usage: minutes[i % minutes.length]}))});
const player = (id, name, extra = {}) => ({id, name, pos: 'G', games: 5, starts: 5, lastStart: true, playedLast: true, last3: true, played10: 10, min10: 32, min: 32, playedSzn: 8, ...extra});
const leagueWith = ({injuries = [], theirs = [], spread = -5.5, total = 229.5, players = [], rest = {}} = {}) => ({...real,
  tonight: {teams: {OKC: {opponent: 'DEN', spread, total, injuries}, DEN: {opponent: 'OKC', spread: -spread, total, injuries: theirs}}},
  rotation: {OKC: {lastGame: new Date(Date.now() - DAY).toISOString(), players: [player('Shai Test', 'Shai Test', {min10: 35}), ...players]},
    DEN: {lastGame: new Date(Date.now() - DAY).toISOString(), players: [player('d1', 'Big Center', {pos: 'C', min10: 30})]}}, rest});
const mateOut = [{id: 'm1', name: 'Jalen Mate', position: 'G', status: 'Out', code: 'O'}];
const splits = (on, off) => ({position: 'G', withWithout: [{id: 'm1', name: 'Jalen Mate', with: on, without: off}],
  similar: {G: [3, 2, -1, 4, 1, 2, 5, -2, 3, 1].map(diff => ({diff}))}});
const candidate = league => generateProps([row('Shai Test')], league, {most: 60})[0];

test("tonight's game from the league's reports: injuries by team, the line, a game-time decision read as one", () => {
  const league = leagueWith({injuries: [{id: 'm1', name: 'Jalen Mate', status: 'Out', code: 'GTD'}], theirs: [{id: 'd1', name: 'Big Center', status: 'Out', code: 'O'}]});
  const game = tonightGame(row('Shai Test'), league);
  assert.equal(game.team, 'OKC');
  assert.deepEqual(game.odds, {spread: {OKC: -5.5, DEN: 5.5}, total: 229.5});
  assert.equal(game.injuries.OKC[0].status, 'Game-time decision');
  assert.equal(game.injuries.DEN[0].status, 'Out');
  // Unknown is unknown: no report for his team, or tonight is another opponent.
  assert.equal(tonightGame(row('Shai Test', {team: 'LAL'}), league), null);
  assert.equal(tonightGame(row('Shai Test', {opponent: 'BOS'}), league), null);
  // His splits for the teammates listed out.
  const found = teammateSplits(row('Shai Test'), tonightGame(row('Shai Test'), leagueWith({injuries: mateOut})), splits({games: 30, avg: 25.1}, {games: 6, avg: 30.4}));
  assert.deepEqual(found.map(mate => [mate.name, mate.without.avg]), [['Jalen Mate', 30.4]]);
});

test('how the game could go: close or a blowout, minutes and his number in each, averaging out to tonight', () => {
  const list = scenariosOf({spread: -5.5, projection: 28, minutes: 35, starter: true, line: 24.5, team: 'OKC', opponent: 'DEN'});
  assert.deepEqual(list.map(part => part.label), ['It stays close', 'OKC pulls away', 'DEN pulls away']);
  assert.ok(Math.abs(list.reduce((sum, part) => sum + part.chance, 0) - 1) < 1e-9);
  // Favored by 5.5: pulling away is likelier than falling behind.
  assert.ok(list[1].chance > list[2].chance && list[0].chance > 0.6);
  // A starter sits the fourth of a blowout; the three average out to his 35.
  assert.ok(Math.abs(list[1].minutes / list[0].minutes - BLOWOUT_MINUTES.starter) < 1e-9);
  assert.ok(Math.abs(list.reduce((sum, part) => sum + part.chance * part.minutes, 0) - 35) < 1e-9);
  assert.ok(Math.abs(list[0].projection / list[0].minutes - 28 / 35) < 1e-9);
  assert.equal(list[0].clears, true);
  // A bench player plays more of one.
  const bench = scenariosOf({spread: -5.5, projection: 12, minutes: 20, starter: false, line: 11.5});
  assert.ok(bench[1].minutes > bench[0].minutes);
  assert.equal(scenariosOf({spread: null, projection: 28, minutes: 35}), null);
});

test('a teammate out: what he did without him moves the read, and it says so with the numbers', () => {
  const league = leagueWith({injuries: mateOut, players: [player('m1', 'Jalen Mate')], theirs: [{id: 'd1', name: 'Big Center', position: 'C', status: 'Out', code: 'O'}]});
  const item = candidate(league);
  const read = readGame(item, league, splits({games: 30, avg: 25.1, hits: 14}, {games: 6, avg: 30.4, hits: 5}));
  const blind = readGame(item, league, null);
  assert.ok(read.chance > blind.chance, `${read.chance} vs ${blind.chance}`);
  assert.ok(read.projection > blind.projection);
  const out = read.beats.find(part => part.key === 'out:Jalen Mate');
  assert.equal(out.side, 'for');
  assert.equal(out.text, 'Jalen Mate (32 min a game) is out tonight. In the 6 games Test played without him, he averaged 30.4 points and went over 24.5 in 5; with Mate playing it\'s 25.1.');
  assert.equal(read.beats.find(part => part.key === 'their-out').text, 'DEN will be without Big Center (C, 30 min). A thinner rotation to guard him.');
  assert.match(read.beats.find(part => part.key === 'minutes').text, /^He's played 33, 37, 34, 38, 30 minutes in his last five\. In his \d+ games with \d+\+ minutes, he's averaged [\d.]+ and gone over 24\.5 in \d+\.$/);
  assert.match(read.beats.find(part => part.key === 'similar').text, /^The last 10 guards who played real minutes against DEN beat their own average by 1\.8 points \(8 of 10 went above it\)\.$/);
  assert.equal(read.call.play, true);
  assert.ok(['best', 'strong', 'play'].includes(read.call.strength));
  assert.ok(read.confidence > blind.confidence);
  assert.ok(read.scenarios.length === 3 && read.room > 0.03);
  assert.match(summaryOf(read), /^We have Test at [\d.]+ points in about \d+ minutes, [\d.]+ over the line\. Mate's out, and without him Test has averaged 30\.4\./);
});

test('a teammate back tonight who takes it away, or his own status, is a pass with the reason', () => {
  // Back after missing his team's last 3, not on tonight's report: with him, he's under the line.
  const back = player('m1', 'Jalen Mate', {last3: false, lastStart: false, playedLast: false, played10: 7, min: 33, games: 5});
  const league = leagueWith({players: [back]});
  const read = readGame(candidate(league), league, splits({games: 30, avg: 22.8, hits: 9}, {games: 6, avg: 30.4, hits: 5}));
  assert.equal(read.call.play, false);
  assert.equal(read.call.reason, 'Mate is back tonight, and with him playing Test averages 22.8 points, under the 24.5 line.');
  assert.equal(read.beats.find(part => part.key === 'back:Jalen Mate').side, 'against');
  // Listed out himself.
  const out = leagueWith({injuries: [{id: 'Shai Test', name: 'Shai Test', status: 'Out', code: 'O'}]});
  assert.equal(readGame(candidate(out), out, null).call.reason, 'He\'s listed out.');
  // Questionable: a point against, and never more than Strong.
  const unsure = leagueWith({injuries: [{id: 'Shai Test', name: 'Shai Test', status: 'Day-To-Day', code: 'Q'}]});
  const doubt = readGame(candidate(unsure), unsure, null);
  assert.equal(doubt.beats.find(part => part.key === 'status').text, 'He\'s listed questionable tonight. Check before tip-off: limited minutes would sink it.');
  assert.notEqual(doubt.tier, 'elite');
});

test('the game line: a big spread is a blowout risk for a starter, a close one isn\'t', () => {
  const big = leagueWith({spread: -13});
  const risky = readGame(candidate(big), big, null).beats.find(part => part.key === 'blowout');
  assert.equal(risky.side, 'against');
  assert.equal(risky.weight, 2);
  assert.match(risky.text, /^A 13-point spread\. There's about a \d+% chance this gets to 15 or more, and starters usually sit most of the fourth when it does\.$/);
  const close = leagueWith({spread: -2});
  assert.equal(readGame(candidate(close), close, null).beats.find(part => part.key === 'close').side, 'for');
  // A rested opponent; one on a back-to-back.
  const tired = leagueWith({rest: {DEN: [new Date(Date.now() - DAY + 5 * 3600e3).toISOString()]}});
  assert.equal(readGame(candidate(tired), tired, null).beats.find(part => part.key === 'rest-them').text, 'DEN played last night: tired legs on defense.');
});

test('which candidates get the full read, the calls, his games by minutes', () => {
  const strict = [{row: {playerId: 'a', teamAbbr: 'BOS'}, grade: {chance: 0.6}}, {row: {playerId: 'b', teamAbbr: 'BOS'}, grade: {chance: 0.58}}];
  const loose = [...strict, {row: {playerId: 'c', teamAbbr: 'OKC'}, grade: {chance: 0.5}}, {row: {playerId: 'd', teamAbbr: 'MIA'}, grade: {chance: 0.55}}];
  // OKC has a 32-minute starter out: its regulars are read too, whatever their record at tonight's line.
  const league = leagueWith({injuries: mateOut, players: [player('m1', 'Jalen Mate')]});
  assert.deepEqual(deepCandidates(strict, loose, league).map(item => item.row.playerId), ['a', 'b', 'c']);
  assert.deepEqual(deepCandidates(strict, loose, leagueWith()).map(item => item.row.playerId), ['a', 'b']);
  const calls = callsOf([{call: {play: false}, confidence: 40}, {call: {play: true}, score: 60}, {call: {play: true}, score: 75}, {call: {play: false}, confidence: 52}]);
  assert.deepEqual(calls.plays.map(item => item.score), [75, 60]);
  assert.deepEqual(calls.passes.map(item => item.confidence), [52, 40]);
  const points = minutesPoints(row('Shai Test'));
  assert.equal(points.length, 15);
  assert.deepEqual(Object.keys(points[0]).sort(), ['date', 'minutes', 'opponent', 'over', 'value']);
  // ...33, 24, 28, 30 against 24.5: the last two.
  assert.equal(streakOf(row('Shai Test')), 2);
});
