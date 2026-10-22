// The NBA matchup score (src/nba-matchup-score.js), built on a backtest of
// 2024-25 and 2025-26 (the weights and what they meant: the top of that file).
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupScore, spreadScores, cardScores, band, WEIGHTS} from '../src/nba-matchup-score.js';
import {meetingsOf, statGameLog} from '../src/unified-finder-data.js';
import {readFileSync} from 'node:fs';

// Thirty teams with their numbers spread like the normal curve, the named
// teams placed at given ranks (rank 1 the most) and the rest in order.
const N = 30, TEAMS = ['DAL', 'HOU', 'BOS', 'UTA', 'IND', 'NO', ...[...Array(24)].map((_, i) => `T${i}`)];
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
// the 7th most blocks (its field-goal percentage allowed isn't shown:
// taken as average). Its Indiana page: 6th most points allowed, 5th
// highest rating, 7th fastest pace, the 4th highest field-goal percentage
// allowed and 17th highest from three; guards get the 7th most points, 3rd
// most rebounds, 13th fewest assists, 3rd fewest threes, 12th most blocks.
// BOS is at the stingy, slow end of everything.
const allowed = table({DAL: 8, IND: 6, BOS: 30}, 114, 4, true), rating = table({DAL: 11, IND: 5, BOS: 30}, 114, 3), pace = table({DAL: 4, IND: 7, BOS: 30}, 99.5, 2);
const fgPct = table({IND: 4, DAL: 15, BOS: 30}, 47, 1), tpPct = table({IND: 17, DAL: 16, BOS: 30}, 36, 1.2);
const F = {pts: table({DAL: 5, IND: 15, BOS: 30}, 10, 1.2, true), reb: table({DAL: 7, IND: 15, BOS: 30}, 4.2, 0.4, true), ast: table({DAL: 6, IND: 15, BOS: 30}, 1.9, 0.25, true),
  tpm: table({DAL: 9, IND: 15, BOS: 30}, 1.1, 0.15, true), stl: table({DAL: 19, IND: 15, BOS: 30}, 0.72, 0.06, true), blk: table({DAL: 7, IND: 15, BOS: 30}, 0.45, 0.08, true)};
const G = {pts: table({IND: 7, DAL: 15, BOS: 30}, 10.5, 1.2, true), reb: table({IND: 3, DAL: 15, BOS: 30}, 3, 0.3, true), ast: table({IND: 18, DAL: 15, BOS: 30}, 3.1, 0.3, true),
  tpm: table({IND: 28, DAL: 15, BOS: 30}, 1.6, 0.2, true), stl: table({IND: 16, DAL: 15, BOS: 30}, 0.8, 0.07, true), blk: table({IND: 12, DAL: 15, BOS: 30}, 0.3, 0.05, true)};
const positions = {F, G};
const league = {
  teamCount: N,
  teamStats: Object.fromEntries(TEAMS.map(team => [team, {def: {pts: allowed[team]}}])),
  opportunity: {count: N, teams: Object.fromEntries(TEAMS.map(team => [team, {drtg: rating[team], poss: pace[team], fgPctAllowed: fgPct[team], tpPctAllowed: tpPct[team]}]))},
  dvp: Object.fromEntries(TEAMS.map(team => [team, Object.fromEntries(Object.entries(positions).map(([position, stats]) =>
    [position, {stats: Object.fromEntries(Object.entries(stats).map(([stat, cells]) => [stat, {szn: cells[team]}]))}]))])),
};
const row = (id, extra = {}) => ({id, sport: 'nba', player: `P${id}`, playerId: id, marketKey: 'player_points', position: 'F', teamAbbr: 'HOU',
  opponent: 'DAL', line: 14.5, gameLog: [], ...extra});

// Last season's real numbers in league-context's shape (ESPN box scores):
// what both sites read before a team has played this season.
const real = JSON.parse(readFileSync(new URL('./fixtures/nba-2025-26-league.json', import.meta.url)));
test('last season’s real numbers: Denver for a guard, and how the scores spread', () => {
  const card = Object.fromEntries(cardScores(row('d1', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN'}), real).map(item => [item.stat, item.score]));
  // RotoBot (Oct 2026) moves each guard on something of its own: points 89
  // McCain, 73 Wallace, 63 Gilgeous-Alexander; steals 40-51. Denver turn it
  // over the fewest times, which is what predicted steals.
  assert.deepEqual(card, {PTS: 56, REB: 44, AST: 62, '3PM': 72, STL: 25, BLK: 66});
  const scores = Object.keys(real.teamStats).flatMap(opponent => ['G', 'F', 'C'].flatMap(position =>
    cardScores(row(`${opponent}${position}`, {position, teamAbbr: 'OKC', opponent}), real).map(item => item.score))).sort((a, b) => a - b);
  const top = scores.filter(score => score >= 90).length / scores.length;
  assert.ok(top > 0.01 && top < 0.05, String(top));                  // the backtest's scale: about 2.5% at 90+
  assert.ok(Math.abs(scores[Math.floor(scores.length / 2)] - 50) <= 5);
});

test('what a defense allows his position is a player at a time, as RotoBot counts it', () => {
  // RotoBot: Denver allow each guard 11.0 points, 1.5 threes a game.
  const threes = matchupScore(row('w', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN', marketKey: 'player_threes'}), real);
  // Threes read only the threes they let teams take; his position is shown, not counted.
  assert.deepEqual(threes.reads.map(read => [read.kind, read.points === 0]), [['position', true], ['attempts', false]]);
  assert.equal(threes.reads[0].text, 'DEN allows each guard 1.5 threes a game (10th most)');
  assert.equal(threes.reads[1].text, 'DEN lets teams take 39.1 threes a game (4th most)');
  const points = matchupScore(row('p', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN'}), real);
  assert.deepEqual(points.reads.map(read => read.kind), ['defense', 'pace', 'position']);
  assert.match(points.reads[0].text, /^DEN gives up 116\.9 points a game \(10th most\) and .* per 100 possessions \(10th highest\)$/);
  assert.equal(matchupScore(row('a', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN', marketKey: 'player_assists'}), real).reads.at(-1).text,
    'DEN gives up 27.5 assists a game (10th most)');
  // An older server's totals still score, read as the position's.
  const older = {...real, dvpEach: undefined};
  assert.match(matchupScore(row('w2', {position: 'G', teamAbbr: 'OKC', opponent: 'DEN'}), older).reads[2].text, /^DEN allows guards 57\.1 points a game/);
  // The parts add up to the score from an even 50.
  assert.ok(Math.abs(50 + threes.reads.reduce((sum, read) => sum + read.points, 0) - threes.raw) < 0.2);
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

test('threes rise with the threes a team allows, not the percentage made; steals with turnovers; assists with assists, not FG%', () => {
  const shooting = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 29}, 36, 1.2))) shooting.opportunity.teams[team].tpPctAllowed = cell;
  for (const [team, cell] of Object.entries(table({DAL: 6}, 14, 1.2, true))) shooting.teamStats[team].off = {to: cell};
  const before = Object.fromEntries(cardScores(row('6'), league).map(item => [item.stat, item.score]));
  const after = Object.fromEntries(cardScores(row('6'), shooting).map(item => [item.stat, item.score]));
  // RotoBot's threes don't follow it (Denver: 3rd lowest, Wallace 91).
  assert.equal(after['3PM'], before['3PM']);
  // They follow the tries: Dallas letting teams take the 2nd most lifts them.
  const tries = structuredClone(shooting);
  for (const [team, cell] of Object.entries(table({DAL: 2}, 36, 2))) tries.opportunity.teams[team].tpaAllowed = cell;
  const more = Object.fromEntries(cardScores(row('6'), tries).map(item => [item.stat, item.score]));
  assert.ok(more['3PM'] > after['3PM'] + 10, `${after['3PM']} -> ${more['3PM']}`);
  assert.equal(more.PTS, after.PTS);
  assert.match(matchupScore(row('7', {marketKey: 'player_threes'}), tries).reads.at(-1).text, /^DAL lets teams take .* threes a game \(2nd most\)$/);
  // Dallas turns the ball over the 6th most: steals rise (RotoBot 87).
  assert.ok(after.STL > before.STL + 3, `${before.STL} -> ${after.STL}`);
  assert.equal(after.PTS, before.PTS);
  assert.match(matchupScore(row('8', {marketKey: 'player_steals'}), shooting).reads.find(read => read.kind === 'turnovers').text,
    /DAL turns it over .* times a game \(6th most\)/);
  // The FG% a defense allows pointed the wrong way for assists in the backtest: not read.
  const finishing = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 1}, 49, 1.5))) finishing.opportunity.teams[team].fgPctAllowed = cell;
  assert.equal(cardScores(row('6'), finishing).find(item => item.stat === 'AST').score, before.AST);
  const passing = structuredClone(league);
  for (const [team, cell] of Object.entries(table({DAL: 2}, 26, 1.8))) passing.opportunity.teams[team].astAllowed = cell;
  assert.ok(cardScores(row('6'), passing).find(item => item.stat === 'AST').score > before.AST + 8);
});

test('far softer than everyone reads near 100; the middle near 50; the stingy, slow end near 0', () => {
  const far = structuredClone(league);
  far.teamStats.UTA.def.pts = [128, N];
  far.opportunity.teams.UTA = {drtg: [124, 1], poss: [105, 1]};
  assert.ok(matchupScore(row('9', {opponent: 'UTA'}), far).score >= 95);
  const middle = TEAMS.find(team => allowed[team][1] === 15);
  assert.ok(Math.abs(matchupScore(row('10', {opponent: middle}), league).score - 50) <= 8);
  const tough = matchupScore(row('11', {opponent: 'BOS'}), league);
  assert.ok(tough.score <= 12, String(tough.score));
  assert.equal(band(tough.score).label, 'Tough');
});

test('the list and the player card score a prop the same', () => {
  const scores = spreadScores([row('a'), row('b', {opponent: 'BOS'})], league);
  assert.equal(scores.get('a').score, cardScores(row('a'), league).find(item => item.stat === 'PTS').score);
  assert.equal(scores.get('a').label, 'Strong edge');
  assert.ok(scores.get('b').score < scores.get('a').score);
  const history = {rows: [...Array(12)].map((_, i) => ({date: `2026-0${1 + (i % 9)}-1${i % 10}`, opponent: i % 4 ? 'T3' : 'DAL', isHome: i % 2 === 0,
    minutes: 30, values: {player_points: i % 4 ? 12 : 20, player_blocks: i % 4 ? 0 : 3}}))};
  const card = cardScores(row('12'), league, history);
  // A board row carries the meetings its history gave it (applyWnbaHistory).
  const blocks = row('13', {marketKey: 'player_blocks', gameLog: statGameLog(history, 'player_blocks'), meetings: meetingsOf(history, 'player_blocks', 'DAL')});
  const shown = card.find(item => item.stat === 'BLK');
  assert.equal(shown.score, spreadScores([blocks], league).get('13').score);
  assert.ok(shown.fit.counted);
  assert.ok(!card.find(item => item.stat === 'PTS').fit.counted);
  assert.ok(WEIGHTS.pts.position < WEIGHTS.pts.defense);  // for points the team leads, the position nudges
});

test('threes and blocks count his last three games against them; points don’t', () => {
  // Two guards, one Denver: McCain made 2, 3, 3 threes in his last three
  // meetings (1.5 usual), Gilgeous-Alexander 1, 0, 3 (1.7).
  const guard = (id, meetings, marketKey) => row(id, {position: 'G', teamAbbr: 'OKC', opponent: 'DEN', marketKey, meetings});
  const mccain = {values: [2, 3, 3], usual: 1.5}, shai = {values: [1, 0, 3], usual: 1.7};
  const hot = matchupScore(guard('m', mccain, 'player_threes'), real), cold = matchupScore(guard('s', shai, 'player_threes'), real);
  assert.ok(hot.score > cold.score + 10, `${hot.score} vs ${cold.score}`);
  assert.equal(hot.reads.at(-1).text, 'His last 3 games against DEN: 2, 3, 3 threes (2.7 a game), his usual 1.5');
  assert.equal(hot.fit.text, hot.reads.at(-1).text);
  const none = matchupScore(guard('n', null, 'player_threes'), real);
  assert.ok(hot.score > none.score && cold.score < none.score);
  // Points: his games against them predicted nothing, so they stay out.
  assert.equal(matchupScore(guard('m2', {values: [30, 30, 30], usual: 8}, 'player_points'), real).score,
    matchupScore(guard('s2', {values: [5, 5, 5], usual: 30}, 'player_points'), real).score);
  // One meeting is trusted half as much as three (n / (n + 3)).
  const once = matchupScore(guard('o', {values: [3], usual: 1.5}, 'player_threes'), real);
  assert.ok(once.score < hot.score && once.reads.at(-1).text.startsWith('His last game against DEN: 3 threes'));
});

test('his meetings: the last three against them, his usual with last season worth ten games', () => {
  const games = [...[...Array(20)].map((_, i) => ({date: `2026-01-${String(i + 1).padStart(2, '0')}`, season: 2026, opponent: i % 5 ? 'BOS' : 'DEN',
    values: {player_threes: 1}})), ...[...Array(4)].map((_, i) => ({date: `2026-11-0${i + 1}`, season: 2027, opponent: i === 3 ? 'DEN' : 'BOS',
    values: {player_threes: i === 3 ? 4 : 3}}))];
  const found = meetingsOf({season: 2027, rows: games}, 'player_threes', 'DEN');
  assert.deepEqual(found.values, [1, 1, 4]);
  assert.equal(found.usual, Math.round((3 + 3 + 3 + 4 + 10 * 1) / 14 * 100) / 100);
  assert.equal(meetingsOf({season: 2027, rows: games}, 'player_threes', 'LAL').values.length, 0);
  assert.equal(meetingsOf(null, 'player_threes', 'DEN'), null);
});

test('nothing about the opponent, no score; bands by the number', () => {
  assert.equal(matchupScore(row('14', {opponent: 'XXX'}), league), null);
  assert.equal(matchupScore({...row('15'), sport: 'wnba'}, league), null);
  assert.deepEqual([band(80).label, band(65).label, band(50).label, band(20).label], ['Strong edge', 'Edge', 'Neutral', 'Tough']);
});
