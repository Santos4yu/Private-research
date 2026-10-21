// The NBA matchup score (src/nba-matchup-score.js), held to RotoBot's grades.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupScore, spreadScores, cardScores, band, GAINS} from '../src/nba-matchup-score.js';
import {statGameLog} from '../src/unified-finder-data.js';

// Thirty teams with their numbers spread like the normal curve, the named
// teams placed at given ranks (rank 1 the most) and the rest in order.
const N = 30, TEAMS = ['DAL', 'HOU', 'BOS', 'UTA', ...[...Array(26)].map((_, i) => `T${i}`)];
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
function quantile(rank) {
  const p = 1 - (rank - 0.5) / N;
  let low = -5, high = 5;
  for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (0.5 * (1 + erf(mid / Math.SQRT2)) < p) low = mid; else high = mid; }
  return (low + high) / 2;
}
// {team: [value, rank]} with rank 1 the most; `fewestFirst` turns ranks the other way (dvp, points allowed).
function table(placed, average, spread, fewestFirst = false) {
  const free = [...Array(N)].map((_, i) => i + 1).filter(rank => !Object.values(placed).includes(rank));
  return Object.fromEntries(TEAMS.map(team => {
    const rank = placed[team] ?? free.shift();
    return [team, [Math.round((average + spread * quantile(rank)) * 100) / 100, fewestFirst ? N - rank + 1 : rank]];
  }));
}
// RotoBot's Dallas page (Oct 2026): 8th most points allowed, 11th highest
// rating, 4th fastest pace; forwards get the 5th most points, 7th most
// rebounds, 6th most assists, 9th most threes, 12th fewest steals, about
// the 7th most blocks. BOS is at the stingy, slow end of everything.
const allowed = table({DAL: 8, BOS: 30}, 114, 4, true), rating = table({DAL: 11, BOS: 30}, 114, 3), pace = table({DAL: 4, BOS: 30}, 99.5, 2);
const F = {pts: table({DAL: 5, BOS: 30}, 10, 1.2, true), reb: table({DAL: 7, BOS: 30}, 4.2, 0.4, true), ast: table({DAL: 6, BOS: 30}, 1.9, 0.25, true),
  tpm: table({DAL: 9, BOS: 30}, 1.1, 0.15, true), stl: table({DAL: 19, BOS: 30}, 0.72, 0.06, true), blk: table({DAL: 7, BOS: 30}, 0.45, 0.08, true)};
const league = {
  teamCount: N,
  teamStats: Object.fromEntries(TEAMS.map(team => [team, {def: {pts: allowed[team]}}])),
  opportunity: {count: N, teams: Object.fromEntries(TEAMS.map(team => [team, {drtg: rating[team], poss: pace[team]}]))},
  dvp: Object.fromEntries(TEAMS.map(team => [team, {F: {stats: Object.fromEntries(Object.entries(F).map(([stat, cells]) => [stat, {szn: cells[team]}]))}}])),
};
const row = (id, extra = {}) => ({id, sport: 'nba', player: `P${id}`, playerId: id, marketKey: 'player_points', position: 'F', teamAbbr: 'HOU',
  opponent: 'DAL', line: 14.5, gameLog: [], ...extra});

test('reads Dallas the way RotoBot does for a forward', () => {
  const card = Object.fromEntries(cardScores(row('1'), league).map(item => [item.stat, item.score]));
  // RotoBot: PTS 91, REB 89, AST 90, BLK 89.
  assert.deepEqual([card.PTS, card.REB, card.AST, card.BLK], [91, 89, 90, 89]);
  assert.equal(band(card.PTS).label, 'Strong edge');
  // A combo is the average of its parts: RotoBot's points + rebounds 90.
  assert.equal(matchupScore(row('2', {marketKey: 'player_points_rebounds'}), league).score, 90);
  const points = matchupScore(row('3'), league);
  assert.deepEqual(points.reads.map(read => read.kind), ['defense', 'pace', 'position']);
  assert.match(points.reads[0].text, /DAL gives up .* points a game \(8th most\) and .* per 100 possessions \(11th highest\)/);
  assert.match(points.reads[2].text, /to forwards \(5th most\)$/);
  // The parts add up to the score from an even 50.
  assert.ok(Math.abs(50 + points.reads.reduce((sum, read) => sum + read.points, 0) - points.raw) < 0.2);
});

test('the same for every forward against a team: his own games sit beside it', () => {
  const quiet = matchupScore(row('4'), league);
  const log = [...[...Array(8)].map(() => ({value: 10, opponent: 'T1'})), ...[...Array(3)].map(() => ({value: 25, opponent: 'DAL'}))];
  const hot = matchupScore(row('5', {gameLog: log}), league);
  assert.equal(hot.score, quiet.score);
  assert.match(hot.fit.text, /^3 games against DAL: 25\.0 a game, his usual 14\.1$/);
  assert.ok(hot.fit.score > 60);
  assert.equal(quiet.fit, null);
});

test('threes read the 3-point percentage they allow; steals how often they turn it over', () => {
  const shooting = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 29}, 36, 1.2))) shooting.opportunity.teams[team].tpPctAllowed = cell;
  for (const [team, cell] of Object.entries(table({DAL: 6}, 14, 1.2, true))) shooting.teamStats[team].off = {to: cell};
  const before = Object.fromEntries(cardScores(row('6'), league).map(item => [item.stat, item.score]));
  const after = Object.fromEntries(cardScores(row('6'), shooting).map(item => [item.stat, item.score]));
  // Dallas holds teams to the 2nd-lowest 3-point percentage: threes drop (RotoBot 69).
  assert.ok(after['3PM'] < before['3PM'] - 15, `${before['3PM']} -> ${after['3PM']}`);
  assert.ok(Math.abs(after['3PM'] - 69) <= 4, String(after['3PM']));
  // It turns the ball over the 6th most: steals rise (RotoBot 87).
  assert.ok(after.STL > before.STL + 5, `${before.STL} -> ${after.STL}`);
  assert.equal(after.PTS, before.PTS);
  const threes = matchupScore(row('7', {marketKey: 'player_threes'}), shooting);
  assert.match(threes.reads.find(read => read.kind === 'shooting').text, /DAL lets teams make .*% of their threes \(2nd lowest\)/);
  assert.match(matchupScore(row('8', {marketKey: 'player_steals'}), shooting).reads.find(read => read.kind === 'turnovers').text,
    /DAL turns it over .* times a game \(6th most\)/);
});

test('far softer than everyone reads 100; the middle near 50; the stingy, slow end near 0', () => {
  const far = structuredClone(league);
  far.teamStats.UTA.def.pts = [128, N];
  far.opportunity.teams.UTA = {drtg: [124, 1], poss: [105, 1]};
  assert.equal(matchupScore(row('9', {opponent: 'UTA'}), far).score, 100);
  const middle = TEAMS.find(team => allowed[team][1] === 15);
  assert.ok(Math.abs(matchupScore(row('10', {opponent: middle}), league).score - 50) <= 8);
  const tough = matchupScore(row('11', {opponent: 'BOS'}), league);
  assert.ok(tough.score <= 5, String(tough.score));
  assert.equal(band(tough.score).label, 'Tough');
});

test('the list and the player card score a prop the same', () => {
  const scores = spreadScores([row('a'), row('b', {opponent: 'BOS'})], league);
  assert.equal(scores.get('a').score, 91);
  assert.equal(scores.get('a').label, 'Strong edge');
  assert.ok(scores.get('b').score < scores.get('a').score);
  const history = {rows: [...Array(12)].map((_, i) => ({date: `2026-0${1 + (i % 9)}-1${i % 10}`, opponent: i % 4 ? 'T3' : 'DAL', isHome: i % 2 === 0,
    minutes: 30, values: {player_points: i % 4 ? 12 : 20, player_blocks: i % 4 ? 0 : 3}}))};
  const card = cardScores(row('12'), league, history);
  const blocks = row('13', {marketKey: 'player_blocks', gameLog: statGameLog(history, 'player_blocks')});
  const shown = card.find(item => item.stat === 'BLK');
  assert.equal(shown.score, spreadScores([blocks], league).get('13').score);
  assert.ok(shown.fit);
  assert.equal(GAINS.position < GAINS.allowed, true);  // the team leads, the position nudges
});

test('nothing about the opponent, no score; bands by the number', () => {
  assert.equal(matchupScore(row('14', {opponent: 'XXX'}), league), null);
  assert.equal(matchupScore({...row('15'), sport: 'wnba'}, league), null);
  assert.deepEqual([band(80).label, band(65).label, band(50).label, band(20).label], ['Strong edge', 'Edge', 'Neutral', 'Tough']);
});
