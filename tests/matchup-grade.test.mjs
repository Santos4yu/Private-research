import test from 'node:test';
import assert from 'node:assert/strict';
import {matchupRead, matchupGrade, withPoolDefense} from '../src/slip-analyst.js';

const model = {pitcher: {id: 1, name: 'Dylan Dodd', hand: 'L'}, pitches: [{name: 'Sinker', pct: 60}, {name: 'Cutter', pct: 35}],
  grades: {hits: {score: 58, label: 'Slight Edge', coverage: 1, arsenal: {impact: 6, detail: 'Full mix · .310 weighted AVG'}},
    power: {score: 71, label: 'Favorable', coverage: 1, arsenal: {impact: 12, detail: 'Full mix · .590 weighted SLG'}},
    other: {score: 64, label: 'Slight Edge', coverage: 1, arsenal: {impact: 9, detail: 'Full mix · .380 weighted wOBA-equivalent'}}},
  factors: [{key: 'handedness', name: 'Splits vs LHP', impact: -1, available: true, detail: 'vs LHP .274 AVG'},
    {key: 'pitcher_quality', name: 'Pitcher quality', impact: 8, available: true, detail: 'Dylan Dodd · 4.90 ERA'},
    {key: 'arsenal_fit', name: 'Arsenal fit', impact: 9, available: true, detail: 'wOBA'},
    {key: 'bvp', name: 'Career BvP', impact: 0, available: false, detail: 'No meaningful history'}]};
const hitter = marketKey => ({sport: 'mlb', marketKey, market: 'x', hitterMatchup: model});

test('MLB hitters read the Research model for their kind of prop', () => {
  const power = matchupRead(hitter('hitting:tb'));
  assert.equal(power.score, 71);
  assert.match(power.text, /^Favorable matchup \(71\) vs Dylan Dodd: hits his pitch mix well \(\+12\), a hittable starter \(\+8\)$/);
  assert.ok(power.factor > 1);
  assert.equal(power.factors.find(item => item.key === 'arsenal_fit').detail, 'Full mix · .590 weighted SLG');
  assert.equal(matchupRead(hitter('hitting:hits')).score, 58);
  assert.equal(matchupRead(hitter('hitting:hrr')).score, 64);
  // A hitter's strikeouts go the other way.
  assert.equal(matchupRead(hitter('hitting:strikeouts')).score, 36);
  const read = {factors: [{key: 'matchup', ...power}]};
  assert.deepEqual([matchupGrade(read, 'OVER').score, matchupGrade(read, 'OVER').tone], [71, 'good']);
  assert.deepEqual([matchupGrade(read, 'UNDER').score, matchupGrade(read, 'UNDER').tone], [29, 'tough']);
  // Without a model score, the projection factor stands in.
  assert.equal(matchupGrade({factors: [{key: 'matchup', factor: 1.03}]}, 'OVER').score, 60);
  assert.equal(matchupGrade({factors: []}, 'OVER'), null);
});

test('NHL: what the opponent gives players like him, from the board\'s game logs', () => {
  const log = (values, opponent = 'MTL') => values.map((value, index) => ({value, opponent: index % 3 === 0 ? opponent : 'BUF', date: `2026-01-${index + 10}`}));
  const skater = (player, values, opponent = 'MTL') => ({sport: 'nhl', player, market: 'Shots On Goal', position: 'C', opponent, gameLog: log(values)});
  // Everyone else shoots well above his usual against MTL (every third game).
  const others = ['A', 'B', 'C'].map(name => skater(name, [6, 3, 3, 6, 3, 3, 6, 3, 3, 6], 'TOR'));
  const [target] = withPoolDefense([skater('Target', [3, 3, 3, 3, 3, 3], 'MTL'), ...others]);
  assert.ok(target.poolDefense.ratio > 1.1);
  assert.equal(target.poolDefense.games, 12);
  const read = matchupRead(target);
  assert.match(read.text, /^MTL has given forwards \d+% more shots on goal than they usually get \(12 games\)$/);
  assert.ok(read.factor > 1);
  // A league table wins over the pool's read.
  assert.equal(withPoolDefense([{...target, poolDefense: undefined, defenseValue: 5}])[0].poolDefense, undefined);
});
