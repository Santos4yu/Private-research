import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupScore, spreadScores, cardScores, band, WEIGHTS} from '../src/nba-matchup-score.js';
import {statGameLog} from '../src/unified-finder-data.js';

// Thirty teams. T0..T29, with IND among them as the soft, fast defense.
const TEAMS = ['IND', 'MIN', 'BOS', 'NY', ...[...Array(26)].map((_, i) => `T${i}`)];
const N = TEAMS.length;
// Least-first ranks (1 allows the fewest) for points allowed and what guards
// get; most-first ranks (1 the highest) for rating and pace. IND: 6th-most
// points, 5th-highest rating, 7th-fastest; guards get the 7th-most points
// and the 3rd-fewest threes against them. BOS is the stingy, slow one.
const rankOf = (team, ind, bos) => team === 'IND' ? ind : team === 'BOS' ? bos : 3 + TEAMS.indexOf(team) % 20;
const league = {
  teamCount: N,
  dvp: Object.fromEntries(TEAMS.map(team => [team, {G: {stats: {
    pts: {szn: [team === 'IND' ? 28 : 24, rankOf(team, N - 6, 1)]}, tpm: {szn: [team === 'IND' ? 2.1 : 3, rankOf(team, 3, 2)]},
    reb: {szn: [7, rankOf(team, N - 2, 3)]}, ast: {szn: [5, rankOf(team, 13, 4)]}, stl: {szn: [1, rankOf(team, 15, 5)]},
    blk: {szn: [0.5, rankOf(team, N - 11, 6)]}}}}])),
  teamStats: Object.fromEntries(TEAMS.map(team => [team, {def: {pts: [team === 'IND' ? 120.4 : 112, rankOf(team, N - 5, 1)]}}])),
  opportunity: {count: N, league: {poss: 100}, teams: Object.fromEntries(TEAMS.map(team => [team,
    {drtg: [team === 'IND' ? 117.9 : 112, rankOf(team, 5, N)], poss: [team === 'IND' ? 101.8 : 99, rankOf(team, 7, N - 1)]}]))},
};
const row = (id, extra = {}) => ({id, sport: 'nba', player: `P${id}`, playerId: id, marketKey: 'player_points', position: 'G', teamAbbr: 'MIN',
  opponent: 'IND', line: 24.5, gameLog: [], ...extra});

test('a bad, fast defense lifts every stat; the stat\'s own matchup spreads them', () => {
  const points = matchupScore(row('1'), league), threes = matchupScore(row('2', {marketKey: 'player_threes'}), league);
  assert.equal(points.score, 82);
  assert.equal(band(points.score).label, 'Strong edge');
  assert.equal(threes.score, 53);
  assert.deepEqual(points.reads.map(read => read.key), ['defense', 'pace', 'position']);
  assert.match(points.reads[0].text, /IND gives up 120\.4 points a game \(6th most\) and 117\.9 per 100 possessions \(5th highest\)/);
  assert.match(points.reads[1].text, /101\.8 possessions a game \(7th fastest\)/);
  assert.match(threes.reads[2].text, /IND allows 2\.1 threes a game to guards \(3rd fewest\)/);
  // Assists they're a little tough on still read better than average: the defense carries it.
  assert.equal(band(matchupScore(row('3', {marketKey: 'player_assists'}), league).score).label, 'Edge');
  // Nothing piles up at 100 unless every read is the softest there is.
  assert.ok(points.score < 100);
});

test('a stingy, slow defense reads tough', () => {
  const tough = matchupScore(row('4', {opponent: 'BOS'}), league);
  assert.ok(tough.score < 10, String(tough.score));
  assert.equal(band(tough.score).label, 'Tough');
});

test('his games against them count more the more there are', () => {
  const log = [...Array(10)].map(() => ({value: 20, opponent: 'T1'}));
  const quiet = {...league, opportunity: undefined, teamStats: {}};
  const once = matchupScore(row('5', {opponent: 'NY', gameLog: [...log, {value: 30, opponent: 'NY'}].slice(1)}), quiet);
  const thrice = matchupScore(row('6', {opponent: 'NY', gameLog: [...log.slice(3), ...[1, 2, 3].map(() => ({value: 30, opponent: 'NY'}))]}), quiet);
  const fit = read => read.reads.find(item => item.key === 'fit');
  assert.ok(fit(thrice).score > fit(once).score);
  assert.ok(thrice.score > once.score);
  // Each read's share of the score is its weight among the reads there are.
  assert.equal(fit(once).weight, Math.round(WEIGHTS.fit / (WEIGHTS.position + WEIGHTS.fit) * 100));
});

test('the list scores each prop on its own: same prop, same number, any night', () => {
  const scores = spreadScores([row('a'), row('b', {opponent: 'BOS'})], league);
  assert.equal(scores.get('a').score, 82);
  assert.equal(scores.get('a').label, 'Strong edge');
  assert.equal(spreadScores([row('a')], league).get('a').score, 82);
  assert.ok(scores.get('b').score < scores.get('a').score);
});

test('the player card scores every stat the way the list does', () => {
  const card = cardScores(row('9'), league);
  assert.deepEqual(card.map(item => item.stat), ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK']);
  assert.deepEqual(card.map(item => item.score), [82, 87, 67, 53, 70, 75]);
  assert.equal(card[0].score, spreadScores([row('9')], league).get('9').score);
});

test('the card reads each stat from his own games in it, same as that stat\'s line', () => {
  const history = {rows: [...Array(12)].map((_, i) => ({date: `2026-0${1 + (i % 9)}-1${i % 10}`, opponent: i % 4 ? 'NY' : 'BOS', isHome: i % 2 === 0,
    minutes: 30, values: {player_points: i % 4 ? 20 : 30, player_blocks: i % 4 ? 0 : 3}}))};
  const card = cardScores(row('9', {opponent: 'BOS'}), league, history);
  const blocks = row('10', {opponent: 'BOS', marketKey: 'player_blocks', gameLog: statGameLog(history, 'player_blocks')});
  const shown = card.find(item => item.stat === 'BLK');
  assert.equal(shown.score, spreadScores([blocks], league).get('10').score);
  assert.ok(shown.reads.some(read => read.key === 'fit'));
});

test('nothing about the opponent, no score; bands by the number', () => {
  assert.equal(matchupScore(row('6', {opponent: 'XXX'}), league), null);
  assert.equal(matchupScore({...row('7'), sport: 'wnba'}, league), null);
  assert.deepEqual([band(80).label, band(65).label, band(50).label, band(20).label], ['Strong edge', 'Edge', 'Neutral', 'Tough']);
});
