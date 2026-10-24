import test from 'node:test';
import assert from 'node:assert/strict';
import {link, links, jointChance, role} from '../src/slip-correlation.js';
import {scoreEntry} from '../src/slip-check.js';

const row = (player, sport, team, opponent, market, extra = {}) => ({player, sport, teamAbbr: team, opponent, market, marketKey: extra.marketKey,
  raw: {stat: market}, position: extra.position, gameId: extra.gameId, playerId: extra.playerId ?? player});
const pick = (r, side = 'OVER') => ({row: r, side, player: r.player});

test('lines are sorted into what they measure', () => {
  assert.equal(role(row('Dak Prescott', 'nfl', 'DAL', 'TB', 'Pass Yards')), 'pass');
  assert.equal(role(row('CeeDee Lamb', 'nfl', 'DAL', 'TB', 'Receiving Yards')), 'receive');
  assert.equal(role(row('Chris Sale', 'mlb', 'ATL', 'LAD', 'Pitcher Strikeouts')), 'pk');
  assert.equal(role(row('Freddie Freeman', 'mlb', 'LAD', 'ATL', 'Hits')), 'hit');
  assert.equal(role(row('Igor Shesterkin', 'nhl', 'NYR', 'BOS', 'Goalie Saves')), 'saves');
});

test('a quarterback and his receiver hit together; a pitcher\'s strikeouts and the hitters he faces work against each other', () => {
  const dak = pick(row('Dak Prescott', 'nfl', 'DAL', 'TB', 'Pass Yards'));
  const lamb = pick(row('CeeDee Lamb', 'nfl', 'DAL', 'TB', 'Receiving Yards'));
  const together = link(dak, lamb);
  assert.equal(together.rho, 0.3);
  assert.equal(together.text, 'Prescott and Lamb feed each other');
  // Lamb's under against Dak's over: now they pull apart.
  assert.equal(link(dak, {...lamb, side: 'UNDER'}).rho, -0.3);
  const sale = pick(row('Chris Sale', 'mlb', 'ATL', 'LAD', 'Pitcher Strikeouts'));
  const freeman = pick(row('Freddie Freeman', 'mlb', 'LAD', 'ATL', 'Hits'));
  const against = link(sale, freeman);
  assert.ok(against.rho < 0);
  assert.equal(against.text, 'Sale and Freeman are on opposite sides of the same at-bats');
  // Freeman's under goes with Sale's strikeouts.
  assert.ok(link(sale, {...freeman, side: 'UNDER'}).rho > 0);
  // A goalie's saves and the shooters he faces.
  const goalie = pick(row('Igor Shesterkin', 'nhl', 'NYR', 'BOS', 'Goalie Saves'));
  const shooter = pick(row('David Pastrnak', 'nhl', 'BOS', 'NYR', 'Shots On Goal'));
  assert.equal(link(shooter, goalie).text, "Pastrnak's shots are Shesterkin's saves");
});

test('players in different games, or from different sports, are not linked', () => {
  const dak = pick(row('Dak Prescott', 'nfl', 'DAL', 'TB', 'Pass Yards'));
  assert.equal(link(dak, pick(row('Josh Downs', 'nfl', 'IND', 'LV', 'Receiving Yards'))), null);
  assert.equal(link(dak, pick(row('Stephen Curry', 'nba', 'GS', 'LAL', 'Points'))), null);
  assert.equal(links([dak, null, pick(row('CeeDee Lamb', 'nfl', 'DAL', 'TB', 'Receiving Yards'))]).length, 1);
});

test('the joint chance moves with the links, within sane bounds', () => {
  const independent = 0.6 * 0.6;
  const up = jointChance([0.6, 0.6], [{a: 0, b: 1, rho: 0.3}]);
  const down = jointChance([0.6, 0.6], [{a: 0, b: 1, rho: -0.2}]);
  assert.ok(up > independent && up <= 0.6);
  assert.ok(down < independent && down >= independent * 0.5);
  assert.equal(jointChance([0.6, 0.6], []), independent);
});

test('the parlay grade uses the linked chance and names the pairs', () => {
  const grade = chance => ({chance, tier: 'strong', modifier: 'standard', factor: 1});
  const legs = [
    {key: '1', player: 'Dak Prescott', side: 'OVER', row: row('Dak Prescott', 'nfl', 'DAL', 'TB', 'Pass Yards'), grade: grade(0.6)},
    {key: '2', player: 'CeeDee Lamb', side: 'OVER', row: row('CeeDee Lamb', 'nfl', 'DAL', 'TB', 'Receiving Yards'), grade: grade(0.6)},
    {key: '3', player: 'Josh Downs', side: 'OVER', row: row('Josh Downs', 'nfl', 'IND', 'LV', 'Receiving Yards'), grade: grade(0.6)},
  ];
  const score = scoreEntry(legs, {app: {key: 'prizepicks'}, entry: {type: 'power'}});
  assert.ok(Math.abs(score.independent - 0.216) < 1e-9);
  assert.ok(score.chance > score.independent);
  assert.equal(score.links.length, 1);
  assert.deepEqual(score.links[0].players, ['Dak Prescott', 'CeeDee Lamb']);
  assert.equal(score.links[0].tone, 'together');
});

test('basketball pairs use the measured numbers', () => {
  const nba = (player, team, opponent, market, position) => pick(row(player, 'nba', team, opponent, market, {position, gameId: 'g1'}));
  const brunson = nba('Jalen Brunson', 'NY', 'BOS', 'Assists', 'G');
  const towns = nba('Karl-Anthony Towns', 'NY', 'BOS', 'Points', 'C');
  assert.equal(link(brunson, towns).rho, 0.045);
  // Teammates' points, and opponents' points, barely move together: no link.
  assert.equal(link(nba('Jalen Brunson', 'NY', 'BOS', 'Points', 'G'), towns), null);
  assert.equal(link(towns, nba('Jayson Tatum', 'BOS', 'NY', 'Points', 'F')), null);
  // Two centers' boards pull apart; a guard's and a center's don't.
  const robinson = nba('Mitchell Robinson', 'NY', 'BOS', 'Rebounds', 'C');
  assert.equal(link(nba('Karl-Anthony Towns', 'NY', 'BOS', 'Rebounds', 'C'), robinson).rho, -0.06);
  assert.equal(link(nba('Josh Hart', 'NY', 'BOS', 'Rebounds', 'G'), robinson), null);
  // One player's points and threes ride together far more than his points and assists.
  const same = market => pick(row('Jalen Brunson', 'nba', 'NY', 'BOS', market, {gameId: 'g1', playerId: 7}));
  assert.equal(link(same('Points'), same('3-PT Made')).rho, 0.48);
  assert.equal(link(same('Points'), same('Assists')).rho, 0.15);
  assert.equal(link(same('Pts+Rebs+Asts'), same('Points')).rho, 0.5);
  // Other sports keep their figure for one player's two lines.
  const dak = market => pick(row('Dak Prescott', 'nfl', 'DAL', 'TB', market, {playerId: 4}));
  assert.equal(link(dak('Pass Yards'), dak('Rush Yards')).rho, 0.5);
});
