// The QB rushing card's season math (src/sports/nfl/qb-rushing.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import {QB_RUSH_MARKETS, qbSeason, rankTone, rankWords, weekOf} from '../src/sports/nfl/qb-rushing.js';

const game = (week, extra = {}) => ({week, opponent: 'DEN', dropbacks: 30, scrambles: 2, scrambleYards: 20, designed: 2, designedYards: 6, sneaks: 1,
  kneels: 0, kneelYards: 0, pressured: 6, sacked: 1, underPressure: null, ...extra});

test('his season counts the games he played, not a relief series', () => {
  const season = qbSeason({games: [game(1, {kneels: 3, kneelYards: -3}), game(2, {pressured: null}), game(3, {dropbacks: 4, scrambles: 5})]});
  assert.equal(season.games, 2);
  assert.equal(season.scrambles, 4);
  assert.equal(season.scrambleYards, 40);
  assert.equal(season.designed, 4);
  assert.equal(season.sneaks, 2);
  assert.equal(season.kneelYards, -3);
  // Pressure only from the games the advanced stats cover: 6 of 30 dropbacks.
  assert.equal(season.pressuredGames, 1);
  assert.equal(season.pressureRate, 0.2);
  assert.equal(season.under, null);
  assert.equal(qbSeason({games: [game(1, {dropbacks: 3})]}), null);
});

test('runs under pressure add up over the charted games', () => {
  const season = qbSeason({games: [game(1, {underPressure: {dropbacks: 8, scrambles: 2, yards: 14}}), game(2, {underPressure: {dropbacks: 6, scrambles: 1, yards: 9}}), game(3)]});
  assert.deepEqual(season.under, {games: 2, dropbacks: 14, scrambles: 3, yards: 23});
});

test('a rank reads as the most, the fewest or its place', () => {
  assert.equal(rankWords(1, 32), 'the most');
  assert.equal(rankWords(6, 32), '6th most');
  assert.equal(rankWords(29, 32), '4th fewest');
  assert.equal(rankWords(32, 32), 'the fewest');
  assert.equal(rankWords(16, 32), '16th of 32');
  assert.equal(rankWords(22, 32), '22nd of 32');
  // Near the top helps a rushing line, unless more of it hurts (pressures turned into sacks).
  assert.equal(rankTone(2, 32), 'good');
  assert.equal(rankTone(30, 32), 'poor');
  assert.equal(rankTone(29, 32, false), 'good');
  assert.equal(rankTone(16, 32), 'neutral');
});

test('the card is for a quarterback\'s rushing lines', () => {
  for (const market of ['rushing_yards', 'rush_attempts', 'longest_rush', 'passing_rushing_yards']) assert.ok(QB_RUSH_MARKETS.has(market), market);
  assert.ok(!QB_RUSH_MARKETS.has('passing_yards'));
  assert.ok(!QB_RUSH_MARKETS.has('rushing_tds'));
});

test('against the blitz, the long ones and close games, added up over his games', () => {
  const season = qbSeason({games: [
    game(1, {vsBlitz: {dropbacks: 12, scrambles: 2}, noBlitz: {dropbacks: 24, scrambles: 1}, longest: 14, long: 1, close: {runs: 3, plays: 40}, other: {runs: 1, plays: 30}}),
    game(2, {vsBlitz: {dropbacks: 10, scrambles: 1}, noBlitz: {dropbacks: 20, scrambles: 1}, longest: 6, long: 0, close: {runs: 2, plays: 30}, other: {runs: 0, plays: 20}}),
  ]});
  assert.equal(season.vsBlitz, 3 / 22);
  assert.equal(season.noBlitz, 2 / 44);
  assert.equal(season.blitzedDropbacks, 22);
  assert.equal(season.longGames, 1);
  assert.equal(season.longest, 14);
  assert.equal(season.close, 5 / 70);
  assert.equal(season.other, 1 / 50);
  // Too few to say: under 20 blitzed dropbacks, 60 close plays.
  const thin = qbSeason({games: [game(1, {vsBlitz: {dropbacks: 8, scrambles: 1}, close: {runs: 1, plays: 20}})]});
  assert.equal(thin.vsBlitz, null);
  assert.equal(thin.close, null);
});

test('the week of a game, and a gap that reads most and least', () => {
  assert.equal(weekOf('2026_07_SF_WAS'), 7);
  assert.equal(weekOf(''), null);
  assert.equal(rankWords(3, 32, 10, {most: 'most', fewest: 'least'}), '3rd most');
  assert.equal(rankWords(31, 32, 10, {most: 'most', fewest: 'least'}), '2nd least');
});
