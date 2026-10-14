import test from 'node:test';
import assert from 'node:assert/strict';
import {modelKey, profileOf, withModelPriors, projectStat, modelChance, modelMean, modelRead} from '../src/prop-model.js';
import {readPick} from '../src/slip-analyst.js';
import {assessLeg} from '../src/smart-slip.js';
import {judge} from '../src/slip-check.js';
import {matchupCase} from '../src/slip-matchup.js';

const NOW = Date.parse('2026-09-30T18:00:00Z');
const LATER = '2026-09-30T23:10:00Z';
const near = (actual, expected, within) => assert.ok(Math.abs(actual - expected) <= within, `${actual} vs ${expected}`);
const day = index => `2026-08-${String(index + 1).padStart(2, '0')}`;
const games = (values, usage) => values.map((value, index) => ({value, date: day(index), home: index % 2 === 0, opponent: 'BOS',
  usage: typeof usage === 'function' ? usage(index) : usage}));
const w = (hits, n) => ({hits, misses: n - hits, pushes: 0, decisions: n, sample: n, hitRate: hits / n * 100});
// `made` of `n` games with one (and the rest none).
const some = (made, n) => Array.from({length: n}, (_, index) => (index * made % n < made ? 1 : 0));
const hitter = (player, values, extra = {}) => ({id: `mlb:${player}:${extra.marketKey || 'hitting:hits'}`, sport: 'mlb', player,
  market: 'Hits', marketKey: 'hitting:hits', line: 0.5, modifier: 'standard', direction: 'OVER', teamAbbr: 'NYY', opponent: 'BOS',
  startsAt: LATER, isHome: false, raw: {stat: 'Hits'}, apps: [{key: 'prizepicks', name: 'PrizePicks'}],
  gameLog: games(values, 4.4), windows: {l5: w(4, 5), l10: w(8, 10), l20: w(15, 20), season: w(40, 55)}, ...extra});

test('which stats the model reads, and how far it runs off in each', () => {
  const mlb = key => ({sport: 'mlb', marketKey: key});
  assert.equal(modelKey(mlb('hitting:hits')), 'hitting:hits');
  assert.equal(modelKey({sport: 'nhl', valueKey: 'saves', position: 'G'}), 'goalie:saves');
  // A league or stat the model doesn't read keeps its old path.
  assert.equal(modelKey({sport: 'nfl', marketKey: 'receiving_yards'}), null);
  // The model runs further off in swingy stats than steady ones.
  const error = row => profileOf(row).error;
  assert.ok(error(mlb('hitting:hits')) < error(mlb('hitting:hrr')));
  assert.ok(error(mlb('hitting:hrr')) < error(mlb('hitting:rbi')));
  assert.ok(error({sport: 'nhl', valueKey: 'sog'}) < error({sport: 'nhl', valueKey: 'goals'}));
  // One number for nearly everyone (0.5 hits) sits further from even than a line set for each player.
  assert.ok(profileOf(mlb('hitting:hits')).market > profileOf({sport: 'nba', marketKey: 'player_points'}).market);
});

test('one hit or none each trip to the plate: the chance follows his trips and his power', () => {
  const model = {shape: 'binary', rate: 0.25, usage: 4, usageSd: 0.5, spread: 1, plain: 1, variance: 1};
  // A .250 hitter with four trips: about 1 - 0.75^4.
  near(modelChance(model, 0.5, 'OVER'), 1 - 0.75 ** 4, 0.015);
  near(modelChance(model, 0.5, 'OVER') + modelChance(model, 0.5, 'UNDER'), 1, 1e-9);
  assert.ok(modelChance({...model, usage: 4.65}, 0.5, 'OVER') > modelChance({...model, usage: 3.8}, 0.5, 'OVER'));
  // A tougher starter (a lower rate per trip) cuts it.
  assert.ok(modelChance(model, 0.5, 'OVER', {rate: 0.9}) < modelChance(model, 0.5, 'OVER'));
  // Total bases: a league hitter clears 1.5 about 40% of the time; the
  // same hits with more power clear it more often.
  const bases = {...model, shape: 'bases', rate: 0.25 * 1.663};
  near(modelChance(bases, 1.5, 'OVER'), 0.41, 0.03);
  assert.equal(modelMean(bases), 0.25 * 1.663 * 4);
  assert.ok(modelChance({...bases, rate: 0.25 * 2, basesPerHit: 2}, 1.5, 'OVER') > modelChance(bases, 1.5, 'OVER'));
});

test('a hot month is pulled toward what the board does per trip, by how much it takes to say something', () => {
  const others = Array.from({length: 7}, (_, index) => hitter(`Regular ${index}`, some(23 + (index % 3), 25)));
  const hot = hitter('Hot Hand', some(25, 25).map((value, index) => value + (index % 2)));
  const rows = withModelPriors([...others, hot]);
  const read = rows.at(-1);
  // The others' hits per plate appearance: about 24 in 110.
  near(read.modelPrior, 24 / 110, 0.01);
  const own = (25 + 12) / 110;
  const model = projectStat(read);
  assert.ok(model.rate < own - 0.08 && model.rate > read.modelPrior, model.rate);
  // Fewer than six others to go by: no board rate, his own stands.
  assert.equal(withModelPriors([hot, ...others.slice(0, 5)])[0].modelPrior, undefined);
  near(projectStat(hot).rate, own, 0.02);
  // His hits line gives a total bases line his own power.
  const tb = hitter('Hot Hand', some(25, 25).map((value, index) => value * (index % 3 === 0 ? 4 : 1)), {id: 'tb', marketKey: 'hitting:tb', market: 'Total Bases'});
  const powered = withModelPriors([hot, tb]).at(-1);
  near(powered.basesPerHit, (9 * 4 + 16) / 37, 0.01);
});

test('an edge is kept by how sure the model can be against how far the lines tend to be off', () => {
  const settled = {shape: 'count', rate: 0.6, usage: 34, usageSd: 1, spread: 1.8, market: 0.055, error: 0.05, evidence: 2000,
    meanUsage: 34, plain: 20.4, variance: 37, counts: true, context: {}};
  const read = modelRead(settled, 17.5, 'OVER');
  assert.ok(read.raw > 0.6 && read.chance < read.raw && read.chance > 0.5, JSON.stringify(read));
  near(read.chance - 0.5, (read.raw - 0.5) * read.weight, 1e-9);
  // Fewer games behind his rate and swingier minutes: less of the edge stands.
  const unsettled = modelRead({...settled, evidence: 150, usageSd: 6}, 17.5, 'OVER');
  assert.ok(unsettled.weight < read.weight && unsettled.chance < read.chance);
  // Lines that tend to be further off leave a projection more room.
  assert.ok(modelRead({...settled, market: 0.09}, 17.5, 'OVER').weight > read.weight);
  // A Goblin's or Demon's edge is held toward its own break-even.
  near(modelRead(settled, 17.5, 'OVER', {baseline: 0.7}).chance - 0.7, (read.raw - 0.7) * read.weight, 1e-9);
});

test('his lineup spot sets his trips: leading off beats batting ninth', () => {
  const order = spot => Array.from({length: 9}, (_, index) => ({name: index === spot - 1 ? 'Aaron Judge' : `Batter ${index}`}));
  const at = spot => hitter('Aaron Judge', some(26, 25), {game: {team: 'NYY', state: 'pre', injuries: {}, lineups: {NYY: {confirmed: true, order: order(spot)}}}});
  const first = projectStat(at(1)), ninth = projectStat(at(9));
  assert.equal(first.usage, 4.65);
  near(ninth.usage, 3.8, 1e-9);
  assert.deepEqual(first.context.used, ['lineup']);
  assert.ok(modelChance(first, 0.5, 'OVER') > modelChance(ninth, 0.5, 'OVER') + 0.04);
  // No lineup yet: his own recent trips.
  near(projectStat(hitter('Aaron Judge', some(26, 25))).usage, 4.4, 1e-9);
});

test('basketball: his minutes, a teammate out, a blowout and the game\'s scoring', () => {
  const guard = (extra = {}) => ({sport: 'wnba', player: 'Kelsey Plum', market: 'Points', marketKey: 'player_points', position: 'G', line: 19.5,
    teamAbbr: 'LA', opponent: 'LV', startsAt: LATER, gameLog: games([20, 22, 18, 21, 19, 23, 20, 18, 22, 21, 20, 19], index => (index >= 9 ? 36 : 32)),
    scoring: {normal: 82, expected: 82}, ...extra});
  const plain = projectStat(guard());
  // Minutes lately count most.
  assert.ok(plain.usage > 33.5 && plain.usage < 36, plain.usage);
  // A teammate out: what he has done without her, by how many games say so.
  const injuries = {LA: [{name: 'Dearica Hamby', status: 'Out', position: 'F'}]};
  const split = {name: 'Dearica Hamby', with: {games: 14, avg: 18}, without: {games: 6, avg: 24}};
  const without = projectStat(guard({game: {team: 'LA', injuries, teammates: [split]}}));
  assert.ok(without.context.rate > 1.15, without.context.rate);
  assert.ok(without.context.used.includes('mate:Dearica Hamby'));
  // A big spread: fewer minutes for a starter if it gets out of hand.
  const blowout = projectStat(guard({game: {team: 'LA', injuries: {}, odds: {total: 164, spread: {LA: -14.5, LV: 14.5}}}}));
  assert.ok(blowout.usage < plain.usage * 0.96, blowout.usage);
  assert.ok(blowout.context.risks.some(risk => risk.startsWith('Blowout risk')));
  // The game's total and spread: a team expected to score more.
  const high = projectStat(guard({game: {team: 'LA', injuries: {}, odds: {total: 176, spread: {LA: -2, LV: 2}}}}));
  const low = projectStat(guard({game: {team: 'LA', injuries: {}, odds: {total: 154, spread: {LA: 2, LV: -2}}}}));
  assert.ok(high.context.rate > 1.03 && low.context.rate < 0.97, `${high.context.rate} ${low.context.rate}`);
  assert.ok(high.context.used.includes('pace'));
});

test('hockey: a skater\'s shots are a rate per minute on the ice times his minutes', () => {
  const skater = (toi, extra = {}) => ({sport: 'nhl', player: 'Seth Jarvis', valueKey: 'sog', marketKey: 'sog', position: 'RW', line: 2.5,
    teamAbbr: 'CAR', opponent: 'FLA', startsAt: LATER, gameLog: games([3, 2, 4, 3, 2, 3, 4, 2, 3, 3], toi), ...extra});
  const steady = projectStat(skater(18)), promoted = projectStat(skater(index => (index >= 7 ? 21 : 18)));
  assert.ok(promoted.usage > steady.usage + 1.2, promoted.usage);
  assert.ok(modelChance(promoted, 2.5, 'OVER') > modelChance(steady, 2.5, 'OVER'));
  // Points follow the goals his team is expected to score.
  const points = (odds) => projectStat(skater(18, {valueKey: 'points', gameLog: games([1, 0, 1, 2, 0, 1, 1, 0, 1, 1], 18),
    game: {team: 'CAR', injuries: {}, odds}}));
  const favored = points({total: 6.5, win: {CAR: 0.68, FLA: 0.32}}), dog = points({total: 5.5, win: {CAR: 0.36, FLA: 0.64}});
  assert.ok(favored.context.rate > 1.05 && dog.context.rate < 0.95, `${favored.context.rate} ${dog.context.rate}`);
});

test('a swingy stat keeps less of its edge than a steady one', () => {
  const hits = hitter('Steady Eddie', some(28, 25).map((value, index) => value + (index % 4 === 0 ? 1 : 0)));
  const read = readPick(hits, 'OVER', {});
  assert.ok(read.model && read.model.key === 'hitting:hits');
  // Held toward even by how sure the model can be.
  near(read.projected - 0.5, (read.model.raw - 0.5) * read.model.weight, 1e-9);
  assert.ok(read.model.weight > 0.5 && read.model.weight < 1, read.model.weight);
  const leg = assessLeg(hits, 'OVER', {now: NOW});
  assert.ok(leg.backed, `chance ${leg.chance}`);
  const rbi = hitter('Steady Eddie', some(20, 25), {id: 'rbi', market: 'RBIs', marketKey: 'hitting:rbi'});
  const swingy = assessLeg(rbi, 'OVER', {now: NOW});
  // Still allowed on a slip, but only when its held-back chance clears the bar.
  assert.ok(swingy.chance < leg.chance);
  assert.ok(Math.abs(swingy.read.projected - 0.5) < Math.abs(swingy.read.model.raw - 0.5) * 0.4);
});

test('with the game in, the pick is read again, and what the model counted isn\'t counted twice', () => {
  const order = spot => Array.from({length: 9}, (_, index) => ({name: index === spot - 1 ? 'Aaron Judge' : `Batter ${index}`}));
  const row = hitter('Aaron Judge', some(26, 25));
  const leg = assessLeg(row, 'OVER', {now: NOW});
  const at = spot => judge({...leg, row: {...row, game: {team: 'NYY', state: 'pre', injuries: {}, lineups: {NYY: {confirmed: true, order: order(spot)}}}}});
  const first = at(1), ninth = at(9);
  assert.ok(first.chance > ninth.chance + 0.02, `${first.chance} ${ninth.chance}`);
  assert.equal(first.read.model.spot, 1);
  // The lineup fact is still shown, but the model already counted it.
  const lineup = first.matchup.facts.find(item => item.key === 'lineup');
  assert.ok(lineup && lineup.modelled);
  const counted = matchupCase({row: first.row, side: 'OVER', grade: {...first, read: {...first.read, model: {...first.read.model, used: []}}}});
  assert.ok(counted.score > first.matchup.score, `${counted.score} ${first.matchup.score}`);
});
