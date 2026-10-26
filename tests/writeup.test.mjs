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
  teams: {MIA: {short: 'Heat'}},
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

test('reasons for the over in plain words, strongest first: his position, their defense, his zones, his games', () => {
  const leg = legFacts({row, marketKey: 'player_points', line: 20.5, league, games, ctx, score: 98});
  assert.equal(leg.header, 'Kyrie Irving · Over 20.5 Points');
  assert.equal(leg.label, 'Strong edge');
  const kinds = leg.facts.map(fact => fact.kind);
  assert.equal(kinds[0], 'dvp');
  assert.equal(leg.facts[0].text, '🎯 The Heat give up the 1st most points to guards in the league');
  assert.ok(kinds.includes('zones') && kinds.includes('hits') && kinds.includes('lastFaced') && kinds.includes('h2h'), kinds.join());
  assert.match(leg.facts.find(fact => fact.kind === 'zones').text, /^📍 (Most of|A big chunk of|A lot of) his points come (from above-break 3|in the paint), and that's one of the spots the Heat defend worst \(\d+(st|nd|rd|th) worst in the league\)$/);
  assert.equal(leg.facts.find(fact => fact.kind === 'hits').text, "📈 He's gone over this line in 8 of his last 10 games");
  assert.equal(leg.facts.find(fact => fact.kind === 'lastFaced').text, '👀 The last guard to face the Heat (D. Schroder) went well over his usual');
  // Plain words: no decimals anywhere.
  for (const fact of leg.facts) assert.doesNotMatch(fact.text, /\d\.\d/, fact.text);
  // Rebound reasons don't show on a points line.
  assert.ok(!kinds.includes('boards') && !kinds.includes('rebChances'));
});

test('rebounds read their misses and his work on the glass; nothing against the over is written', () => {
  const leg = legFacts({row, marketKey: 'player_rebounds', line: 9.5, league, games: [], ctx: {...ctx, opportunity: {l10: {games: 10, rebShare: 17}}}});
  const text = leg.facts.map(fact => fact.text).join('\n');
  assert.match(text, /🧲 The Heat give up the 1st most rebounds in the league/);
  assert.match(text, /🧱 Teams miss a lot of shots against the Heat, and every miss is a rebound up for grabs/);
  assert.match(text, /🧲 When a shot misses with him on the court, he's one of the guys who goes and gets it/);
  // A soft opponent's numbers only: a tough one says nothing.
  const tough = legFacts({row: {...row, opponent: 'T28'}, marketKey: 'player_rebounds', line: 9.5, league, games: [], ctx: null});
  assert.equal(tough.facts.length, 0);
});

test('a Discord post in PropScout\'s own style: title, details, each leg with its reasons and grade', () => {
  const legs = [legFacts({row, marketKey: 'player_points', line: 20.5, league, games, ctx, score: 98}),
    legFacts({row: {...row, player: 'Luka Doncic', playerId: '2'}, marketKey: 'player_rebounds', line: 7.5, league, games: [], ctx})];
  const post = formatPost(legs, {units: '1.5u', tag: 'top pick', confidence: '4.5', perLeg: 2});
  const lines = post.split('\n');
  assert.equal(lines[0], '## 🔎 PropScout TOP PICK · 2-Leg Parlay');
  assert.equal(lines[1], '-# 🏀 NBA · 1.5 units · Confidence 4.5/5');
  assert.ok(lines.includes('### Kyrie Irving · Over 20.5 Points'));
  assert.equal(lines.filter(line => line.startsWith('> ')).length, 4);
  assert.ok(lines.includes('-# 📊 Matchup grade 98/100 · Strong edge'));
  assert.match(lines.at(-1), /^-# Researched with PropScout/);
  assert.doesNotMatch(post, /☢|BOL|Write-Up|Tailing/);
  assert.equal(formatPost([]), '');
});
