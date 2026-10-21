import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupScore, spreadScores, cardScores, band, WEIGHTS} from '../src/nba-matchup-score.js';
import {statGameLog} from '../src/unified-finder-data.js';

// Thirty teams. T0..T29, with IND among them as the soft, fast defense.
const TEAMS = ['IND', 'MIN', 'BOS', 'NY', ...[...Array(26)].map((_, i) => `T${i}`)];
const N = TEAMS.length;
// Every table ranks the thirty teams once, IND and BOS where named and the
// rest in order. Least-first ranks (1 allows the fewest) for points allowed
// and what guards get; most-first ranks (1 the highest) for rating and pace.
// IND: 6th-most points, 5th-highest rating, 7th-fastest; guards get the
// 7th-most points and the 3rd-fewest threes against them. BOS is the
// stingy, slow one.
function ranks(ind, bos) {
  const free = [...Array(N)].map((_, i) => i + 1).filter(rank => rank !== ind && rank !== bos);
  return Object.fromEntries(TEAMS.map(team => [team, team === 'IND' ? ind : team === 'BOS' ? bos : free.shift()]));
}
// A team's number, spread evenly from low (least-first rank 1) to high.
const even = (rank, low, high) => Math.round((low + (high - low) * (rank - 1) / (N - 1)) * 10) / 10;
const cell = (table, team, low, high) => [even(table[team], low, high), table[team]];
const flipped = (table, team, low, high) => [even(N + 1 - table[team], low, high), table[team]];
const G = {pts: [ranks(N - 6, 1), 18, 30], tpm: [ranks(3, 2), 2, 4], reb: [ranks(N - 2, 3), 5, 9], ast: [ranks(13, 4), 4, 7],
  stl: [ranks(15, 5), 0.8, 1.6], blk: [ranks(N - 11, 6), 0.3, 0.9]};
const ALLOWED = ranks(N - 5, 1), RATING = ranks(5, N), PACE = ranks(7, N - 1);
const league = {
  teamCount: N,
  dvp: Object.fromEntries(TEAMS.map(team => [team, {G: {stats: Object.fromEntries(Object.entries(G).map(([stat, [table, low, high]]) =>
    [stat, {szn: cell(table, team, low, high)}]))}}])),
  teamStats: Object.fromEntries(TEAMS.map(team => [team, {def: {pts: cell(ALLOWED, team, 106, 124)}}])),
  opportunity: {count: N, league: {poss: 100}, teams: Object.fromEntries(TEAMS.map(team => [team,
    {drtg: flipped(RATING, team, 108, 120), poss: flipped(PACE, team, 96, 104)}]))},
};
const row = (id, extra = {}) => ({id, sport: 'nba', player: `P${id}`, playerId: id, marketKey: 'player_points', position: 'G', teamAbbr: 'MIN',
  opponent: 'IND', line: 24.5, gameLog: [], ...extra});

test('a bad, fast defense lifts every stat; the stat\'s own matchup spreads them', () => {
  const points = matchupScore(row('1'), league), threes = matchupScore(row('2', {marketKey: 'player_threes'}), league);
  assert.equal(points.score, 82);
  assert.equal(band(points.score).label, 'Strong edge');
  assert.equal(threes.score, 53);
  assert.deepEqual(points.reads.map(read => read.key), ['defense', 'pace', 'position']);
  assert.match(points.reads[0].text, /IND gives up 120\.9 points a game \(6th most\) and 118\.3 per 100 possessions \(5th highest\)/);
  assert.match(points.reads[1].text, /102\.3 possessions a game \(7th fastest\)/);
  assert.match(threes.reads[2].text, /IND allows 2\.1 threes a game to guards \(3rd fewest\)/);
  // Assists they're a little tough on still read better than average: the defense carries it.
  assert.equal(band(matchupScore(row('3', {marketKey: 'player_assists'}), league).score).label, 'Edge');
  // Nothing piles up at 100 unless every read is the softest there is.
  assert.ok(points.score < 100);
});

test('a defense far worse than the rest reads as soft as it gets; the middle of the pack near 50', () => {
  // IND now gives up far more than anyone, plays far faster and lets guards
  // score far more: every read is well past the rest of the league.
  const far = structuredClone(league);
  far.teamStats.IND.def.pts = [134, N];
  far.opportunity.teams.IND = {drtg: [127, 1], poss: [109, 1]};
  far.dvp.IND.G.stats.pts.szn = [38, N];
  assert.equal(matchupScore(row('11'), far).score, 100);
  // The team with the 15th-most of everything sits at about average.
  const middle = TEAMS.find(team => ALLOWED[team] === 15);
  far.opportunity.teams[middle] = {drtg: [114, 15], poss: [100, 15]};
  far.dvp[middle].G.stats.pts.szn = [24, 15];
  const even = matchupScore(row('12', {opponent: middle}), far).score;
  assert.ok(Math.abs(even - 50) <= 6, String(even));
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
  assert.deepEqual(card.map(item => item.score), [82, 87, 66, 53, 70, 77]);
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
