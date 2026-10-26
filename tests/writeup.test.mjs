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
  assert.equal(leg.facts[0].text, '🎯 The Heat give up the most points to guards in the league this season');
  assert.ok(kinds.includes('zones') && kinds.includes('hits') && kinds.includes('lastFaced'), kinds.join());
  // One game against them (over) is no reason on its own.
  assert.equal(kinds.includes('h2h'), false);
  assert.match(leg.facts.find(fact => fact.kind === 'zones').text, /^📍 (Most of|A big chunk of|A lot of) his points come (from above-break 3|in the paint), and that's one of the spots the Heat defend worst \(\d+(st|nd|rd|th) worst in the league this season\)$/);
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
  assert.match(text, /🧲 The Heat give up the most rebounds per game in the league this season/);
  assert.match(text, /🧱 Teams miss a lot of shots against the Heat this season, and every miss is a rebound up for grabs/);
  assert.match(text, /🧲 When a shot misses with him on the court, he's one of the guys who goes and gets it/);
  // A soft opponent's numbers only: a tough one says nothing.
  const tough = legFacts({row: {...row, opponent: 'T28'}, marketKey: 'player_rebounds', line: 9.5, league, games: [], ctx: null});
  assert.equal(tough.facts.length, 0);
});

test('a Discord post that is just the analysis: no site name, no grades', () => {
  const legs = [legFacts({row, marketKey: 'player_points', line: 20.5, league, games, ctx, score: 98}),
    legFacts({row: {...row, player: 'Luka Doncic', playerId: '2'}, marketKey: 'player_rebounds', line: 7.5, league, games: [], ctx})];
  const post = formatPost(legs, {units: '1.5u', tag: 'top pick', confidence: '4.5', perLeg: 2});
  const lines = post.split('\n');
  assert.equal(lines[0], '## 🏀 NBA TOP PICK · 2-Leg Parlay');
  assert.equal(lines[1], '-# 1.5 units · Confidence 4.5/5');
  assert.ok(lines.includes('### Kyrie Irving · Over 20.5 Points'));
  assert.equal(lines.filter(line => line.startsWith('> ')).length, 4);
  assert.equal(lines.at(-1).startsWith('> '), true);
  assert.doesNotMatch(post, /PropScout|grade|\/100|☢|BOL|Write-Up|Tailing/i);
  // Nothing set: no details line.
  assert.equal(formatPost([legs[0]], {perLeg: 1}).split('\n')[1], '');
  assert.equal(formatPost([]), '');
});

test('streaks: never under all season, a straight run, the last 5, never under vs them; a Goblin says so', () => {
  // Last season 2 games (one under), this season 7, all over a low line.
  const log = [[2026, 'BOS', 6], [2026, 'MIA', 12], ...[13, 9, 15, 11, 10, 14, 12].map((value, i) => [2027, i % 3 ? 'BOS' : 'MIA', value])]
    .map(([season, opponent, value]) => ({season, opponent, values: {player_points: value}}));
  const goblin = legFacts({row, marketKey: 'player_points', line: 7.5, kind: 'goblin', league, games: log});
  assert.equal(goblin.header, 'Kyrie Irving · Over 7.5 Points (Goblin)');
  assert.equal(goblin.key, '1|player_points|goblin');
  const text = kind => goblin.facts.find(fact => fact.kind === kind)?.text;
  // The run reaches back into last season (8 straight): said once, with this season in it; not a second "7 for 7".
  assert.equal(text('streak'), '✅ Over this line in his last 8 straight games, every game this season included');
  assert.equal(text('season'), undefined);
  assert.equal(text('last5'), undefined);
  assert.equal(text('hits'), undefined);
  assert.equal(text('h2h'), '🆚 Has never gone under against the Heat (4 for 4 in their recent games)');
  assert.match(text('cushion'), /^📊 He's been averaging about 11 points lately, well above this line$/);
  // The streaks lead.
  assert.equal(goblin.facts[0].kind, 'streak');
  // A regular line he has missed lately: no streak claims.
  const regular = legFacts({row, marketKey: 'player_points', line: 12.5, league, games: log});
  assert.ok(!regular.facts.some(fact => ['season', 'streak', 'last5'].includes(fact.kind) && /Hasn't|straight/.test(fact.text)));
});

test('early in a season: this season\'s games alone, said so; nothing on a team with under 3 games; ESPN\'s position', () => {
  // The blended numbers say MIA give up the most; this season alone, the least (rank 30 of 30 is the fewest... reversed).
  const fresh = {season: 2027, teamCount: 30, games: {MIA: 4, T3: 1},
    dvpEach: Object.fromEntries(TEAMS.map((team, i) => [team, {G: {stats: {pts: {szn: [9 + i * 0.1, i + 1]}}}, C: {stats: {reb: {szn: [12 - i * 0.1, 30 - i]}}}}])),
    opportunity: {count: 30, teams: {}}, zoneDefense: {}};
  const early = {...league, thisSeason: fresh};
  const now = legFacts({row, marketKey: 'player_points', line: 20.5, league: early, games: [], ctx: null});
  // This season MIA give up the fewest points to guards: no matchup brag at all.
  assert.equal(now.facts.some(fact => fact.kind === 'dvp'), false);
  // A team with 1 game this season: no team numbers said.
  const thin = legFacts({row: {...row, opponent: 'T3'}, marketKey: 'player_points', line: 20.5, league: early, games: [], ctx: null});
  assert.equal(thin.facts.length, 0);
  // ESPN calls him a center (the line said F): read as a center, "so far this season".
  const big = legFacts({row: {...row, position: 'F'}, marketKey: 'player_rebounds', line: 9.5,
    league: {...early, rotation: {DAL: {players: [{id: '1', pos: 'C'}]}}}, games: [], ctx: null});
  assert.equal(big.facts.find(fact => fact.kind === 'dvp')?.text, '🎯 The Heat give up the most rebounds to centers in the league so far this season');
});

test('the season line when his run starts this season; the writer can pick who he\'s compared with', () => {
  const log = [[2026, 'BOS', 3], ...[13, 9, 15, 11].map(value => [2027, 'BOS', value])].map(([season, opponent, value]) => ({season, opponent, values: {player_points: value}}));
  const leg = legFacts({row, marketKey: 'player_points', line: 7.5, league, games: log});
  assert.equal(leg.facts[0].text, "💯 Hasn't gone under this line once all season (4 for 4)");
  assert.equal(leg.facts.some(fact => fact.kind === 'streak'), false);
  const asCenter = legFacts({row, marketKey: 'player_rebounds', line: 9.5, league: {...league, dvpEach: {MIA: {C: {stats: {reb: {szn: [14, 30]}}}}, ...Object.fromEntries(TEAMS.slice(1).map((team, i) => [team, {C: {stats: {reb: {szn: [10, i + 1]}}}}]))}}, games: [], position: 'C'});
  assert.equal(asCenter.position, 'C');
  assert.match(asCenter.facts.find(fact => fact.kind === 'dvp').text, /to centers in the league this season$/);
});

test('a combo: each part they give up said on its own, ahead of pace; injuries only when ruled out and at his spot', () => {
  // MIA: middling in points to guards, the most rebounds and assists to guards; the fastest pace.
  const mixed = {...league, dvpEach: Object.fromEntries(TEAMS.map((team, i) => [team, {G: {stats: {
    pts: {szn: [10, team === 'MIA' ? 15 : (i % 29) + 1]}, reb: {szn: [4, 30 - i]}, ast: {szn: [5, 30 - i]}, pra: {szn: [20, team === 'MIA' ? 14 : (i % 29) + 1]}}}}]))};
  const pra = legFacts({row, marketKey: 'player_points_rebounds_assists', line: 25.5, league: mixed, games: [], ctx: null});
  const kinds = pra.facts.map(fact => fact.kind);
  assert.ok(kinds.includes('dvp-reb') && kinds.includes('dvp-ast') && !kinds.includes('dvp-pts'), kinds.join());
  assert.equal(pra.facts.find(fact => fact.kind === 'dvp-reb').text, '🎯 The Heat give up the most rebounds to guards in the league this season');
  assert.equal(kinds.at(-1), 'pace');
  // Tonight: a guard teammate ruled out (34 min) is said; a forward (27 min), a game-time decision and a 15-minute player are not.
  const night = {...league, tonight: {teams: {DAL: {injuries: [{id: 'a', status: 'Out', code: 'OUT'}, {id: 'b', status: 'Out', code: 'OUT'},
    {id: 'c', status: 'Out', code: 'GTD'}, {id: 'd', status: 'Out'}]}, MIA: {injuries: []}}},
    rotation: {DAL: {players: [{id: 'a', name: 'Kyrie Irving Jr', pos: 'PG', played10: 9, min10: 34, last3: true},
      {id: 'b', name: 'Naji Marshall', pos: 'SF', played10: 9, min10: 27, last3: true}, {id: 'c', name: 'Cooper Flagg', pos: 'F', played10: 9, min10: 33, last3: true},
      {id: 'd', name: 'Bench Guard', pos: 'SG', played10: 9, min10: 15, last3: true}]}, MIA: {players: []}}};
  const out = legFacts({row: {...row, playerId: 'x'}, marketKey: 'player_points', line: 20.5, league: night, games: [], ctx: null}).facts.filter(fact => fact.kind === 'out');
  assert.deepEqual(out.map(fact => fact.text), ['📋 Kyrie Irving Jr is ruled out, so more shots and minutes go his way']);
});

test('no repeats and no coin flips: a combo part only when clearly worse than the combo; vs them only when mostly over', () => {
  const close = {...league, dvpEach: Object.fromEntries(TEAMS.map((team, i) => [team, {G: {stats: {
    pts: {szn: [10, team === 'MIA' ? 25 : (i % 29) + 1]}, reb: {szn: [4, team === 'MIA' ? 30 : (i % 29) + 1]}, ast: {szn: [5, team === 'MIA' ? 22 : (i % 29) + 1]},
    pra: {szn: [20, team === 'MIA' ? 24 : (i % 29) + 1]}}}}]))};
  // PRA 7th most, points 6th (one spot better: no line), rebounds the most (six better: its own line).
  const kinds = legFacts({row, marketKey: 'player_points_rebounds_assists', line: 25.5, league: close, games: [], ctx: null}).facts.map(fact => fact.kind);
  assert.ok(kinds.includes('dvp') && kinds.includes('dvp-reb') && !kinds.includes('dvp-pts') && !kinds.includes('dvp-ast'), kinds.join());
  // Over in 1 of 2 against them: not said; 2 of 3: said.
  const vs = values => values.map((value, i) => ({season: 2027, opponent: i < values.length ? 'MIA' : 'BOS', values: {player_points: value}}));
  const said = values => legFacts({row, marketKey: 'player_points', line: 20.5, league, games: vs(values)}).facts.some(fact => fact.kind === 'h2h');
  assert.equal(said([25, 15]), false);
  assert.equal(said([25]), false);
  assert.equal(said([25, 15, 22]), true);
});
