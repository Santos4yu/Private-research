import test from 'node:test';
import assert from 'node:assert/strict';
import {promoCards} from '../src/promo-board-core.js';

const NOW = Date.parse('2026-10-13T18:00:00Z');
const LATER = '2026-10-13T23:30:00Z';
const w = (hits, games) => ({hits, misses: games - hits, pushes: 0, decisions: games, sample: games, hitRate: hits / games * 100});
const row = ({player, line, promo = false, modifier = 'standard', l10 = [9, 10], season = [40, 50], startsAt = LATER, id = `${player}:${line}:${modifier}`}) => ({
  id, sport: 'nba', player, market: 'Points', line, modifier, promo, direction: 'OVER', startsAt, teamAbbr: 'MIN', opponent: 'DEN', gameId: 'g1',
  raw: {stat: 'Points'}, windows: {l5: w(Math.round(l10[0] / 2), 5), l10: w(...l10), season: season && w(...season)},
  apps: [{key: 'prizepicks', name: 'PrizePicks', over: null, under: null}]});

test('the board lists promo lines only, read on the Over, with the line they were cut from', () => {
  const rows = [row({player: 'Anthony Edwards', line: 0.5, promo: true, l10: [10, 10], season: [50, 50]}), row({player: 'Anthony Edwards', line: 27.5}),
    row({player: 'Jamal Murray', line: 1.5, promo: true, l10: [6, 10], season: [30, 50]}), row({player: 'Jamal Murray', line: 21.5}),
    row({player: 'Nikola Jokic', line: 26.5})];
  const cards = promoCards(rows, {now: NOW});
  assert.deepEqual(cards.map(card => card.row.player), ['Anthony Edwards', 'Jamal Murray']);
  assert.equal(cards[0].leg.side, 'OVER');
  assert.equal(cards[0].usual.line, 27.5);
  assert.ok(cards[0].leg.chance > cards[1].leg.chance, 'the stronger promo first');
});

test('started games and lines without enough games are handled', () => {
  const started = row({player: 'Gone', line: 0.5, promo: true, startsAt: '2026-10-13T17:00:00Z'});
  const thin = {...row({player: 'Rookie', line: 0.5, promo: true}), windows: {l10: w(2, 2)}};
  const cards = promoCards([started, thin], {now: NOW});
  assert.deepEqual(cards.map(card => card.row.player), ['Rookie']);
  assert.equal(cards[0].leg, null);
});
