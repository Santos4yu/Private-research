import test from 'node:test';
import assert from 'node:assert/strict';
import {teamProfile, withSoccerMatchups, soccerText} from '../src/soccer-matchup.js';
import {matchupRead, readPick} from '../src/slip-analyst.js';
import {matchupCase} from '../src/slip-matchup.js';
import {modelKey, projectStat} from '../src/prop-model.js';

const near = (actual, expected, within) => assert.ok(Math.abs(actual - expected) <= within, `${actual} vs ${expected}`);
// A team's last `n` matches: what it does (`own`) and what its opponents do against it (`opp`).
const log = (id, abbr, own, opp, n = 10) => ({team: {id, abbr, name: abbr}, games: Array.from({length: n}, (_, index) => ({
  id: `${id}-${index}`, date: `2026-09-${String(index + 1).padStart(2, '0')}`, goals: own.goals ?? 1, against: opp.goals ?? 1,
  teamStats: {totalShots: 12, shotsOnTarget: 4, possessionPct: 50, totalPasses: 450, totalTackles: 16, ...own},
  oppStats: {totalShots: 12, shotsOnTarget: 4, possessionPct: 50, totalPasses: 450, totalTackles: 16, ...opp}}))});
const LOGS = {
  // Seattle shoot a lot and give up a lot of shots; Dallas are average.
  SEA: log('2', 'SEA', {shotsOnTarget: 6.5, totalShots: 17, possessionPct: 58}, {totalShots: 18, shotsOnTarget: 6, possessionPct: 42}),
  DAL: log('1', 'DAL', {}, {}),
};
const logFor = (row, teamId) => Object.values(LOGS).find(item => item.team.id === teamId) || null;
const line = (extra = {}) => ({sport: 'soccer', eventId: '700', teamId: '1', opponentId: '2', teamAbbr: 'DAL', opponent: 'SEA', line: 3,
  marketKey: 'goaliesaves', market: 'Goalie Saves', position: 'GK', ...extra});

test('a team\'s recent matches as averages for and against, recent ones counting most', () => {
  const games = [3, 3, 3, 9].map((sot, index) => ({goals: 1, against: 2, teamStats: {shotsOnTarget: sot}, oppStats: {shotsOnTarget: 2}, date: `d${index}`}));
  const profile = teamProfile({team: {id: '9', abbr: 'X'}, games});
  assert.equal(profile.games, 4);
  assert.ok(profile.for.shotsOnTarget > 4.5 && profile.for.shotsOnTarget < 9, profile.for.shotsOnTarget);
  assert.equal(profile.for.goals, 1);
  assert.equal(profile.against.goals, 2);
  assert.equal(profile.against.shotsOnTarget, 2);
  assert.equal(teamProfile({games: []}), null);
});

test('a keeper\'s saves follow the shots on target the other side takes', () => {
  const [keeper] = withSoccerMatchups([line()], logFor);
  const read = keeper.soccerMatchup;
  assert.equal(read.key, 'shotsOnTarget');
  assert.equal(read.side, 'for');
  // SEA take 6.5 against a normal 5 (the two teams' average), pulled toward normal by 10 matches.
  near(read.ratio, 1 + (6.5 / 5.125 - 1) * 10 / 16, 1e-9);
  assert.match(soccerText(read), /^SEA take 6\.5 shots on target a game, \d+% more than a normal team \(last 10\)$/);
  const factor = matchupRead(keeper).factor;
  assert.ok(factor > 1.1, factor);
  // His Over reads a good matchup on the card, his Under a tough one.
  const over = matchupCase({row: keeper, side: 'OVER'}), under = matchupCase({row: keeper, side: 'UNDER'});
  assert.ok(over.primary && over.score >= 60, over.score);
  assert.ok(under.score <= 40, under.score);
  assert.equal(over.facts[0].key, 'defense');
});

test('a forward\'s shots follow the shots the other side gives up; passes and tackles follow the ball', () => {
  const rows = withSoccerMatchups([line({marketKey: 'shots', position: 'F', line: 1.5}), line({marketKey: 'passesattempted', position: 'M', line: 40.5}),
    line({marketKey: 'tackles', position: 'D', line: 1.5}), line({marketKey: 'shotsontarget', position: 'F', line: 0.5, teamId: '2', opponentId: '1', teamAbbr: 'SEA', opponent: 'DAL'})], logFor);
  const [shots, passes, tackles, seattle] = rows.map(row => row.soccerMatchup);
  assert.equal(shots.key, 'totalShots');
  assert.equal(shots.side, 'against');
  assert.ok(shots.ratio > 1.1, shots.ratio);
  assert.match(soccerText(shots), /^Teams average 18 shots a game against SEA/);
  // Dallas should have less of the ball against Seattle.
  assert.ok(passes.possession.expected < 50, passes.possession.expected);
  const card = matchupCase({row: rows[1], side: 'OVER'});
  assert.ok(card.facts.some(item => item.key === 'possession' && item.tone === 'down'));
  assert.ok(tackles.ball);
  // An average defense: no edge either way.
  near(seattle.ratio, 1, 0.15);
});

test('the match odds tilt it a little: a favorite shoots more, its keeper saves less', () => {
  const [shots, keeper] = withSoccerMatchups([line({marketKey: 'shots', position: 'F', line: 1.5, winChance: 70, drawChance: 20}),
    line({winChance: 70, drawChance: 20})], logFor);
  const plain = withSoccerMatchups([line({marketKey: 'shots', position: 'F', line: 1.5})], logFor)[0];
  assert.ok(matchupRead(shots).factor > matchupRead(plain).factor);
  const card = matchupCase({row: keeper, side: 'OVER'});
  const odds = card.facts.find(item => item.key === 'odds');
  assert.equal(odds.text, 'DAL 70% to win, 20% draw');
  assert.ok(odds.impact < 0);
});

test('no opponent matches, no read: the line is graded as before', () => {
  const [row] = withSoccerMatchups([line({opponentId: '99'})], logFor);
  assert.equal(row.soccerMatchup, undefined);
  assert.equal(matchupRead(row), null);
});

test('the prop model reads soccer per minute, and a posted lineup says whether he starts', () => {
  assert.equal(modelKey(line()), 'soccer:saves');
  assert.equal(modelKey(line({marketKey: 'shotsontarget'})), 'soccer:sot');
  // A rotation player: 90 minutes when he starts, 20 off the bench.
  const gameLog = Array.from({length: 12}, (_, index) => ({value: index % 2 ? 1 : 3, usage: index % 2 ? 20 : 90, date: `2026-09-${String(index + 1).padStart(2, '0')}`}));
  const player = line({marketKey: 'shots', market: 'Shots', position: 'F', line: 1.5, gameLog, player: 'Phil Foden'});
  const plain = projectStat(player);
  const lineup = listed => ({team: '1', state: 'pre', injuries: {}, lineups: {1: {confirmed: true, order: listed ? [{name: 'Phil Foden'}] : [{name: 'Someone Else'}]}}});
  const starting = projectStat({...player, game: lineup(true)}), benched = projectStat({...player, game: lineup(false)});
  assert.equal(starting.context.role, 'starter');
  near(starting.usage, 90, 1e-9);
  near(benched.usage, 20, 1e-9);
  assert.ok(plain.usage > 30 && plain.usage < 80, plain.usage);
  // The read carries the model and the opponent's matchup.
  const read = readPick(withSoccerMatchups([{...player, game: lineup(true)}], logFor)[0], 'OVER', {});
  assert.equal(read.model.key, 'soccer:shots');
  assert.ok(read.factors.some(item => item.key === 'matchup' && item.factor > 1));
});
