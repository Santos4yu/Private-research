import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupScore, spreadScores, cardScores, band, WEIGHTS} from '../src/nba-matchup-score.js';
import {statGameLog} from '../src/unified-finder-data.js';

const TEAMS = ['IND', 'MIN', 'BOS', 'NY', 'MIA', 'DEN', 'GS', 'LAL'];
// What each team allows guards in points (season, last ten), and team-wide.
const allowed = {IND: 28, MIN: 22, BOS: 20, NY: 23, MIA: 24, DEN: 25, GS: 24, LAL: 26};
const league = {
  teamCount: TEAMS.length,
  dvp: Object.fromEntries(TEAMS.map(team => [team, {G: {stats: {
    pts: {szn: [allowed[team], TEAMS.slice().sort((a, b) => allowed[a] - allowed[b]).indexOf(team) + 1], l10: [allowed[team]]},
    reb: {szn: [4, 4], l10: [4]}, ast: {szn: [6, 4], l10: [6]}, tpm: {szn: [3, 4]}, stl: {szn: [1, 4]}, blk: {szn: [0.5, 4]}}}}])),
  teamStats: Object.fromEntries(TEAMS.map(team => [team, {def: {pts: [team === 'IND' ? 122 : 112, 1], reb: [44, 4], ast: [26, 4], tpm: [13, 4],
    stl: [team === 'IND' ? 9.5 : 7.5, 1], blk: [5, 4]}}])),
  opportunity: {teams: Object.fromEntries(TEAMS.map(team => [team, {poss: [team === 'IND' || team === 'MIN' ? 104 : 99, 1]}])), league: {poss: 100}},
};
const row = (id, extra = {}) => ({id, sport: 'nba', player: `P${id}`, playerId: id, marketKey: 'player_points', position: 'G', teamAbbr: 'MIN',
  opponent: 'IND', line: 24.5, gameLog: [], ...extra});

test('a soft, fast defense scores high for the over; a stingy one low', () => {
  const soft = matchupScore(row('1'), league), tough = matchupScore(row('2', {opponent: 'BOS', teamAbbr: 'MIA'}), league);
  assert.ok(soft.raw > 65, String(soft.raw));
  assert.ok(tough.raw < 45, String(tough.raw));
  assert.deepEqual(soft.reads.map(read => read.key), ['position', 'team', 'pace']);
  // Without a history against them, the other three share its weight.
  assert.equal(soft.reads.reduce((sum, read) => sum + read.weight, 0), 100);
  assert.match(soft.reads[0].text, /IND allows 28\.0 points a game to guards/);
});

test('his games against them count more the more there are', () => {
  const log = [...Array(10)].map((_, i) => ({value: 20, opponent: 'BOS'}));
  const once = matchupScore(row('3', {gameLog: [...log, {value: 40, opponent: 'IND'}]}), league);
  const thrice = matchupScore(row('4', {gameLog: [...log, ...[1, 2, 3].map(() => ({value: 40, opponent: 'IND'}))]}), league);
  const fit = read => read.reads.find(item => item.key === 'fit');
  assert.ok(fit(thrice).score > fit(once).score);
  assert.equal(fit(once).weight + 0, Math.round(WEIGHTS.fit * 100));
});

test('steals read how often the other team loses the ball', () => {
  const steals = matchupScore(row('5', {marketKey: 'player_steals'}), league);
  assert.match(steals.reads.find(read => read.key === 'team').text, /IND gives up 9\.5 steals a game/);
});

test('a score is placed against every team he could have faced', () => {
  const rows = TEAMS.filter(team => team !== 'LAL').flatMap((opponent, i) => [row(`a${i}`, {opponent, teamAbbr: 'LAL'}),
    row(`b${i}`, {opponent, teamAbbr: 'LAL', marketKey: 'player_rebounds'})]);
  const scores = spreadScores(rows, league);
  const best = scores.get('a0'), worst = scores.get('a2');
  assert.equal(rows.find(item => item.id === 'a0').opponent, 'IND');
  assert.ok(best.score >= 75, String(best.score));
  assert.equal(best.label, 'Strong edge');
  assert.ok(worst.score < 40, String(worst.score));
  assert.ok([...scores.values()].every(item => item.score >= 1 && item.score <= 99));
  // The same prop scores the same on a night of one game.
  assert.equal(spreadScores([rows[0]], league).get('a0').score, best.score);
});

test('the player card scores every stat the way the list does', () => {
  const card = cardScores(row('9', {teamAbbr: 'LAL'}), league);
  assert.deepEqual(card.map(item => item.stat), ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK']);
  assert.ok(card.every(item => item.score == null || (item.score >= 1 && item.score <= 99)));
  assert.equal(card[0].score, spreadScores([row('9', {teamAbbr: 'LAL'})], league).get('9').score);
});

test('the card reads each stat from his own games in it, same as that stat\'s line', () => {
  const history = {rows: [...Array(12)].map((_, i) => ({date: `2026-0${1 + (i % 9)}-1${i % 10}`, opponent: i % 4 ? 'BOS' : 'IND', isHome: i % 2 === 0,
    minutes: 30, values: {player_points: i % 4 ? 20 : 30, player_blocks: i % 4 ? 0 : 3}}))};
  const card = cardScores(row('9', {teamAbbr: 'LAL'}), league, history);
  const blocks = row('10', {teamAbbr: 'LAL', marketKey: 'player_blocks', gameLog: statGameLog(history, 'player_blocks')});
  const listed = spreadScores([blocks], league).get('10');
  const shown = card.find(item => item.stat === 'BLK');
  assert.equal(shown.score, listed.score);
  assert.ok(shown.reads.some(read => read.key === 'fit'));
});

test('nothing about the opponent, no score; bands by the number', () => {
  assert.equal(matchupScore(row('6', {opponent: 'XXX'}), league), null);
  assert.equal(matchupScore({...row('7'), sport: 'wnba'}, league), null);
  assert.deepEqual([band(80).label, band(65).label, band(50).label, band(20).label], ['Strong edge', 'Edge', 'Neutral', 'Tough']);
});
