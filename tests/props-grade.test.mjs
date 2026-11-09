// The Props list's Prop grade (src/props-grade.js): the over at tonight's
// line as the Analyzer grades it (slip-check.js gradeLeg), on last
// season's real league numbers.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {propGrades} from '../src/props-grade.js';
import {finderWindow} from '../src/unified-finder-data.js';

const real = JSON.parse(readFileSync(new URL('./fixtures/nba-2025-26-league.json', import.meta.url)));
const DAY = 86400000;
const row = (id, values, line, {modifier = 'standard', opponent = 'DEN'} = {}) => ({id, sport: 'nba', player: id, playerId: id, position: 'G',
  teamAbbr: 'OKC', opponent, marketKey: 'player_points', market: 'Points', stat: 'Points', line, modifier, direction: 'OVER', historyStatus: 'ready',
  windows: {l5: finderWindow(values.slice(-5), line), l10: finderWindow(values.slice(-10), line), l20: finderWindow(values.slice(-20), line),
    season: finderWindow(values, line), h2h: finderWindow([], line)},
  average: values.slice(-10).reduce((sum, value) => sum + value, 0) / 10,
  // Games every other day up to now: no long layoff to read as a return.
  gameLog: values.map((value, i) => ({value, date: new Date(Date.now() - (values.length - i) * 2 * DAY).toISOString().slice(0, 10), opponent: 'BOS', usage: 30}))});
const HOT = [14, 16, 12, 18, 15, 17, 13, 19, 16, 14, 15, 18], COLD = [6, 8, 5, 9, 7, 6, 8, 5, 7, 6, 9, 7];

test('his form and the matchup together: hot leans over, cold fades, a tough matchup holds a hot one back', () => {
  const grades = propGrades([row('hot', HOT, 10.5), row('cold', COLD, 10.5), row('tough', HOT, 10.5, {opponent: 'BOS'})], real);
  const hot = grades.get('hot'), cold = grades.get('cold'), tough = grades.get('tough');
  assert.ok(hot.chance > 0.6 && cold.chance < 0.45, `${hot.chance} ${cold.chance}`);
  assert.ok(hot.rank > cold.rank);
  assert.equal(cold.tier, 'fade');
  // Boston were the stingiest on points last season: the same form grades lower.
  assert.ok(tough.rank < hot.rank && tough.chance < hot.chance);
  assert.deepEqual(Object.keys(hot).sort(), ['blowout', 'chance', 'edge', 'label', 'needs', 'priced', 'projection', 'rank', 'tier', 'tone']);
  assert.equal(hot.blowout, null);
  assert.equal(hot.needs, 0.5);
});

test('a Demon is measured against what it pays; a line without his games waits', () => {
  const grades = propGrades([row('demon', HOT, 16.5, {modifier: 'demon'}), {...row('empty', HOT, 10.5), windows: null, gameLog: []}], real);
  const demon = grades.get('demon');
  assert.ok(demon.chance < 0.5 && demon.edge > -0.05, `${demon.chance} ${demon.edge}`);   // about 35% is what a Demon needs
  // What it needs is shown beside its grade, so a sub-50% Demon graded well reads right.
  assert.equal(demon.needs, 0.35);
  assert.equal(demon.priced, false);
  assert.equal(Math.round((demon.chance - demon.needs) * 1000), Math.round(demon.edge * 1000));
  assert.equal(grades.has('empty'), false);
  assert.equal(propGrades([row('x', HOT, 10.5)], null).size, 0);
});

test('tonight\'s line: a big spread takes a little off a starter and adds to a bench player, and tags both', () => {
  const night = spread => ({...real, tonight: {teams: {OKC: {opponent: 'DEN', spread, total: 228.5, injuries: []}}}});
  const starter = row('s', HOT, 14.5), bench = {...row('b', HOT, 14.5), gameLog: row('b', HOT, 14.5).gameLog.map(game => ({...game, usage: 20}))};
  const close = propGrades([starter, bench], night(-2.5)), wide = propGrades([starter, bench], night(-14.5));
  assert.ok(wide.get('s').chance < close.get('s').chance, `${wide.get('s').chance} ${close.get('s').chance}`);
  assert.ok(wide.get('b').chance > close.get('b').chance, `${wide.get('b').chance} ${close.get('b').chance}`);
  assert.deepEqual([wide.get('s').blowout.role, wide.get('s').blowout.spread, wide.get('b').blowout.role], ['starter', -14.5, 'bench']);
  assert.equal(close.get('s').blowout, null);
  // A line for another game (tomorrow's, against someone else) isn't read.
  assert.equal(propGrades([{...starter, opponent: 'LAL'}], night(-14.5)).get('s').blowout, null);
});
