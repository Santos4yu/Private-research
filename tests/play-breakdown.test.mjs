// The assistant's breakdown of a play (src/play-breakdown.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {playBreakdown} from '../src/play-breakdown.js';

const NBA_CUTS = {elite: 75, strong: 60, good: 60, risky: 40, fade: 20};
const values = [18, 22, 40, 19, 21, 17, 20, 23, 14, 19];
const row = (extra = {}) => ({sport: 'nba', player: 'Ace Bailey', market: 'Pts+Asts', marketKey: 'player_points_assists', line: 13.5, teamAbbr: 'UTA',
  opponent: 'MEM', gameLog: values.map((value, i) => ({value, opponent: i === 2 ? 'TOR' : 'DEN'})), windows: {season: {average: 16.1}},
  scoring: {normal: 115}, game: {state: 'pre', team: 'UTA', odds: {total: 241.5, spread: {UTA: 3, MEM: -3}}},
  opportunity: {chances: {szn: {min: 28, usage: 20.7, fga: 12, fta: 3, pts: 13.2, astShare: 14}, l10: {min: 31.8, usage: 25.2, fga: 15, astShare: 16}},
    tracking: {available: true, passing: {potentialAst: 3.8}}}, ...extra});
const pick = (extra = {}) => ({side: 'OVER', chance: 0.67, tier: 'strong', modifier: 'standard', book: 0.55, read: {projection: 19.2},
  records: {l10: {won: 10, games: 10}, h2h: {won: 2, games: 3}},
  matchup: {score: 88, label: 'Strong edge', cuts: NBA_CUTS, facts: [
    {kind: 'opponent', key: 'nba-defense', tone: 'up', text: 'MEM gives up 121.5 points a game (3rd most)'},
    {kind: 'opponent', key: 'nba-pace', tone: 'down', text: 'MEM plays at 97 possessions a game (5th slowest)'}]}, ...extra});

test('every part of the play, the read first, with a verdict each', () => {
  const parts = playBreakdown(row(), pick());
  assert.deepEqual(parts.map(part => part.key), ['read', 'matchup', 'form', 'game', 'role']);
  const by = Object.fromEntries(parts.map(part => [part.key, part]));
  assert.equal(by.read.verdict, 'helps');
  assert.equal(by.read.lead, 'More 13.5 points + assists: Strong. We have it at 67% to hit, 17 points better than the 50% this line needs.');
  assert.match(by.read.body[0], /^Going for it: MEM grades 88 out of 100 for it, he's 10 of 10 over it, averaging 21\.3 and his minutes and usage are up\.$/);
  assert.equal(by.matchup.verdict, 'helps');
  assert.match(by.matchup.lead, /^MEM is a soft draw for his points \+ assists: 88 out of 100 \(Strong edge\)\.$/);
  assert.ok(by.matchup.body.includes('Working against it: MEM plays at 97 possessions a game (5th slowest).'), by.matchup.body.join(' | '));
  assert.equal(by.form.verdict, 'helps');
  assert.equal(by.form.lead, "He's gone over 13.5 in 10 of his last 10, with room to spare.");
  // The 40 against Toronto carries the average: said, with the average without it.
  assert.ok(by.form.body.some(text => /The 40 against TOR is an outlier; without it his last-10 average is 19\.2/.test(text)), by.form.body.join(' | '));
  assert.ok(by.form.body.some(text => /Even his quietest game in the last 10 \(14\) went over/.test(text)));
  assert.equal(by.role.verdict, 'helps');
  assert.match(by.role.lead, /^His role has grown: 31\.8 minutes and 25\.2% usage over his last 10, up from 28 and 20\.7% for the season\.$/);
  assert.ok(by.role.body.some(text => /3\.8 potential assists/.test(text)));
  assert.ok(by.game.body.some(text => /The total is 241\.5 against a usual 230/.test(text)));
  assert.ok(by.form.body[0].startsWith('His average is 21.3 over the last 10, 18.6 over the last 5 and 18.7 over the last 3, against 16.1 for the season'), by.form.body[0]);
  // A short log says each window once.
  const short = playBreakdown(row({gameLog: [25, 22, 30, 21, 24].map(value => ({value}))}), pick());
  assert.match(short.find(part => part.key === 'form').body[0], /^His average is 24\.4 over the last 5 and 25 over the last 3/);
  assert.ok(parts.every(part => ['Helps', 'Mixed', 'Hurts'].includes(part.label) && part.lead && part.takeaway));
});

test('a tough night reads as one', () => {
  const cold = row({gameLog: [9, 10, 8, 12, 11, 9, 15, 10, 9, 8].map(value => ({value}))});
  const parts = playBreakdown(cold, pick({tier: 'risky', chance: 0.44, records: {l10: {won: 1, games: 10}},
    matchup: {score: 31, label: 'Tough', cuts: NBA_CUTS, facts: [{kind: 'opponent', key: 'nba-defense', tone: 'down', text: 'MEM gives up 108 points a game (2nd fewest)'}]}}));
  const by = Object.fromEntries(parts.map(part => [part.key, part]));
  assert.equal(by.read.verdict, 'hurts');
  assert.equal(by.matchup.verdict, 'hurts');
  assert.equal(by.form.verdict, 'hurts');
  assert.match(by.form.lead, /^He's gone over 13\.5 in only 1 of his last 10\.$/);
  assert.match(by.read.lead, /6 points worse than the 50%/);
});

test('a WNBA player is spoken of as she is; nothing to say, no section', () => {
  const parts = playBreakdown(row({sport: 'wnba', player: 'Caitlin Clark', opportunity: null, game: null}), pick({matchup: null}));
  assert.deepEqual(parts.map(part => part.key), ['read', 'form']);
  assert.match(parts[1].lead, /^She's gone over 13\.5/);
});
