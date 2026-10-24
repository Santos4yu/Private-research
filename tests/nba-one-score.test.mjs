// One NBA matchup score: the Slip Analyzer, Parlay Builder, Analyze and the
// assistant (slip-matchup.js matchupCase) read the Props tab's number
// (nba-matchup-score.js), on its own bands.
import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupCase} from '../src/slip-matchup.js';
import {spreadScores} from '../src/nba-matchup-score.js';
import {tierOf} from '../src/slip-check.js';

// Thirty teams spread evenly, SOFT giving up the most of everything, HARD the least.
const TEAMS = ['SOFT', ...[...Array(28)].map((_, i) => `T${i}`), 'HARD'];
const cell = (index, average, spread, mostFirst) => [Math.round((average + spread * (1.6 - index * 0.11)) * 10) / 10, mostFirst ? index + 1 : 30 - index];
const league = {
  teamCount: 30,
  teamStats: Object.fromEntries(TEAMS.map((team, i) => [team, {def: {pts: cell(i, 114, 4, false)}}])),
  opportunity: {count: 30, teams: Object.fromEntries(TEAMS.map((team, i) => [team, {drtg: cell(i, 114, 3, true), poss: cell(i, 99.5, 2, true)}]))},
  dvp: Object.fromEntries(TEAMS.map((team, i) => [team, {F: {stats: {pts: {szn: cell(i, 10, 1.2, false)}}}}])),
};
const row = (opponent, extra = {}) => ({id: `r-${opponent}`, sport: 'nba', player: 'RJ Barrett', marketKey: 'player_points', market: 'Points', position: 'F',
  teamAbbr: 'TOR', opponent, line: 20.5, gameLog: [], ...extra});

test('a line reads the Props tab number in the slips', () => {
  for (const opponent of ['SOFT', 'T13', 'HARD']) {
    const props = spreadScores([row(opponent)], league).get(`r-${opponent}`);
    const over = matchupCase({row: row(opponent), side: 'OVER', grade: {}}, {nba: league});
    assert.equal(over.score, props.score, opponent);
    assert.equal(over.label, props.label, opponent);
    assert.ok(over.primary);
    // The Less reads it the other way round.
    assert.equal(matchupCase({row: row(opponent), side: 'UNDER', grade: {}}, {nba: league}).score, 100 - props.score);
  }
  // The softest defense alone is an edge; tonight's absences (a starter at
  // his position out) make it a strong one, in the slips too.
  const soft = matchupCase({row: row('SOFT'), side: 'OVER', grade: {}}, {nba: league});
  assert.ok(soft.score >= 70, String(soft.score));
  assert.equal(soft.tone, 'good');
  const night = {...league, rotation: {TOR: {players: [{id: 'f9', name: 'Scottie Barnes', pos: 'SF', played10: 10, min10: 35, last3: true}]}},
    tonight: {teams: {TOR: {injuries: [{id: 'f9', name: 'Scottie Barnes', status: 'Out', out: true}]}}}};
  const short = matchupCase({row: row('SOFT'), side: 'OVER', grade: {}}, {nba: night});
  assert.equal(short.score, spreadScores([row('SOFT')], night).get('r-SOFT').score);
  assert.ok(short.score >= 80 && short.score > soft.score + 8, String(short.score));
  assert.equal(short.tone, 'excellent');
  assert.ok(short.facts.some(item => /^Out for TOR tonight: Scottie Barnes \(F, 35 min\)/.test(item.text)));
  // The reasons are the Props tab's reads.
  assert.ok(soft.facts.some(item => item.kind === 'opponent' && /SOFT gives up/.test(item.text)));
});

test('its own bands: Neutral is not Tough', () => {
  const read = score => tierOf({chance: 0.56, matchup: {score, primary: true, cuts: {elite: 75, strong: 60, good: 60, risky: 40, fade: 20}}});
  assert.equal(read(62), 'strong');
  assert.equal(read(45), 'lean');       // Neutral on the Props tab: no longer Risky
  assert.equal(read(38), 'risky');
  assert.equal(read(15), 'fade');
  // Other sports keep theirs.
  assert.equal(tierOf({chance: 0.56, matchup: {score: 44, primary: true}}), 'risky');
});

test('the WNBA keeps its own read', () => {
  const wnba = matchupCase({row: row('SOFT', {sport: 'wnba'}), side: 'OVER', grade: {}}, {wnba: league});
  assert.ok(!wnba || wnba.cuts.risky === 45);
});
