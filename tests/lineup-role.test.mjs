import test from 'node:test';
import assert from 'node:assert/strict';
import {lineupRole} from '../src/lineup-role.js';

const league = {rotation: {CHI: {games: 5, players: [
  {id: '4433134', name: 'Leonard Miller', lastStart: true, starts: 5, games: 5, min: 31.2},
  {id: '4432158', name: 'Jalen Smith', lastStart: false, starts: 1, games: 5, min: 18.4},
  {id: '5000001', name: 'New Signing', lastStart: false, starts: 0, games: 0, min: 0}]}}};

test('a player in his team\'s last starting five is a Starter, anyone else on the rotation Bench', () => {
  assert.deepEqual(lineupRole({playerId: '4433134', teamAbbr: 'CHI'}, league),
    {starter: true, label: 'Starter', starts: 5, games: 5, text: 'In his team’s starting five: started 5 of his last 5 games'});
  const bench = lineupRole({playerId: 4432158, teamAbbr: 'CHI'}, league);
  assert.equal(bench.label, 'Bench');
  assert.equal(bench.text, 'Off the bench: started 1 of his last 5 games');
});

test('no Starter or Bench without the rotation, the player in it or a game for him', () => {
  assert.equal(lineupRole({playerId: '5000001', teamAbbr: 'CHI'}, league), null);
  assert.equal(lineupRole({playerId: '4433134', teamAbbr: 'WSH'}, league), null);
  assert.equal(lineupRole({playerId: '1', teamAbbr: 'CHI'}, league), null);
  assert.equal(lineupRole({playerId: '4433134', teamAbbr: 'CHI'}, {dvp: {}}), null);
  assert.equal(lineupRole({playerId: '4433134', teamAbbr: 'CHI'}, null), null);
});
