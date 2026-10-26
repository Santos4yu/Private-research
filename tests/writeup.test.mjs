// Write-ups for Discord posts (src/writeup.js): reasons for the over from
// the matchup numbers, his games and his chances; Discord markdown out.
import test from 'node:test';
import assert from 'node:assert/strict';
import {legFacts, formatPost} from '../src/writeup.js';

const TEAMS = ['MIA', ...[...Array(29)].map((_, i) => `T${i}`)];
// MIA: the most of everything (rank 1), the lowest FG% allowed.
const cell = (i, base) => [base - i * 0.5, i + 1];
const league = {
  teamCount: 30,
  dvpEach: Object.fromEntries(TEAMS.map((team, i) => [team, {G: {stats: {pts: {szn: [12 - i * 0.1, 30 - i]}, reb: {szn: [4 - i * 0.05, 30 - i]}}}}])),
  opportunity: {count: 30, teams: Object.fromEntries(TEAMS.map((team, i) => [team, {drtg: cell(i, 121), poss: cell(i, 105), rebAllowed: cell(i, 47),
    astAllowed: cell(i, 29), tpaAllowed: cell(i, 41), tpPctAllowed: cell(i, 38), fgPctAllowed: [44 + i * 0.1, 30 - i]}]))},
  zoneDefense: {MIA: {ab3: [36.3, 28], paint: [50.4, 29], ra: [66, 10], mid: [40, 12], c3l: [38, 15], c3r: [39, 16]}},
};
const row = {player: 'Kyrie Irving', playerId: '1', teamAbbr: 'DAL', opponent: 'MIA', position: 'PG'};
const games = [18, 25, 22, 30, 15, 27, 24, 21, 29, 26].map((value, i) => ({opponent: i === 9 ? 'MIA' : 'BOS', values: {player_points: value}}));
const ctx = {market: 'player_points', zones: {ab3: [20, 55], paint: [25, 50], ra: [10, 14], mid: [4, 12], c3l: [1, 4], c3r: [0, 2]},
  opportunity: {l10: {games: 10, usage: 29.4, tpa: 7.1, tpPct: 38, missesOn: 41, rebShare: 9}},
  similar: {G: [{name: 'Dennis Schroder', value: 25, diff: 11.5}, {name: 'Seth Curry', value: 12, diff: 2}, {name: 'X Y', value: 8, diff: -1}, {name: 'A B', value: 20, diff: 4}]}};

test('reasons for the over, strongest first: his position, their defense, his zones, his games', () => {
  const leg = legFacts({row, marketKey: 'player_points', line: 20.5, league, games, ctx, score: 98});
  assert.equal(leg.header, 'Kyrie Irving O 20.5 PTS');
  const kinds = leg.facts.map(fact => fact.kind);
  assert.equal(kinds[0], 'dvp');
  assert.match(leg.facts[0].text, /^MIA allow the 1st most PTS to guards \(12 a game\) 🔥$/);
  assert.ok(kinds.includes('zones') && kinds.includes('hits') && kinds.includes('lastFaced') && kinds.includes('h2h'), kinds.join());
  assert.match(leg.facts.find(fact => fact.kind === 'zones').text, /% of his pts come (from above-break 3|in the paint): MIA allow .* \(\d+(st|nd|rd|th) highest\) 🏀$/);
  assert.match(leg.facts.find(fact => fact.kind === 'hits').text, /^Over in 8\/10 of his last 10 📈$/);
  assert.match(leg.facts.find(fact => fact.kind === 'lastFaced').text, /^Last G who faced MIA put up 25 PTS \(D\. Schroder, \+11\.5 over his avg\)$/);
  // Rebound reasons don't show on a points line.
  assert.ok(!kinds.includes('boards') && !kinds.includes('rebChances'));
});

test('rebounds read their misses and his share of the boards; nothing against the over is written', () => {
  const leg = legFacts({row, marketKey: 'player_rebounds', line: 9.5, league, games: [], ctx});
  const text = leg.facts.map(fact => fact.text).join('\n');
  assert.match(text, /MIA give up 47 rebounds a game \(1st most\) 🧹/);
  assert.match(text, /MIA hold teams to 44% shooting \(1st lowest\): more misses to clean up/);
  assert.match(text, /~41 missed shots a game while he's on the floor, he grabs 9% of the boards/);
  // A soft opponent's numbers only: a tough one says nothing.
  const tough = legFacts({row: {...row, opponent: 'T28'}, marketKey: 'player_rebounds', line: 9.5, league, games: [], ctx: null});
  assert.equal(tough.facts.length, 0);
});

test('a Discord post: title, write-up, each leg with its reasons and score', () => {
  const legs = [legFacts({row, marketKey: 'player_points', line: 20.5, league, games, ctx, score: 98}),
    legFacts({row: {...row, player: 'Luka Doncic', playerId: '2'}, marketKey: 'player_rebounds', line: 7.5, league, games: [], ctx})];
  const post = formatPost(legs, {units: '1.5', tag: 'mini nuke', confidence: '4.5', perLeg: 2});
  const lines = post.split('\n');
  assert.equal(lines[0], '## 1.5U NBA 🏀 MINI NUKE ☢️ (2X)');
  assert.equal(lines[1], '**🏷️ Confidence Rating ⭐ 4.5/5**');
  assert.equal(lines[2], '-# **Write-Up 📝 :**');
  assert.equal(lines[3], '**Kyrie Irving O 20.5 PTS ☢️**');
  assert.equal(lines.filter(line => line.startsWith('• ')).length, 4);
  assert.ok(lines.includes('-# PropScout matchup 98/100 vs MIA'));
  assert.equal(lines.at(-1), '### BOL & React With 💰 If Tailing 🍀');
  assert.equal(formatPost([]), '');
});
