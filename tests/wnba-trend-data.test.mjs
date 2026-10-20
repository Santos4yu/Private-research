import test from 'node:test';
import assert from 'node:assert/strict';
import {wnbaChart,wnbaLines,wnbaOdds} from '../src/sports/wnba/trend-data.js';

test('WNBA line picker retains PrizePicks Goblin and Demon identities',()=>{
 const rows=[{marketKey:'player_points',line:7.5,modifier:'goblin',apps:[{key:'prizepicks'}]},{marketKey:'player_points',line:12.5,modifier:'demon',apps:[{key:'prizepicks'}]},{marketKey:'player_points',line:7.5,apps:[{key:'draftkings'}]}];
 const lines=wnbaLines(rows,'player_points');
 assert.equal(lines[0].tier,'GOBLIN');
 assert.equal(lines[0].primaryBook,'prizepicks');
 assert.equal(lines[1].tier,'DEMON');
});

test('WNBA trend adapter keeps verified game values and H2H',()=>{
 const logs=[{gameId:'1',date:'2026-01-01',season:2026,opponent:'PHX',isHome:true,values:{player_points:22}},{gameId:'2',date:'2026-01-03',season:2026,opponent:'SEA',isHome:false,values:{player_points:18}}];
 const chart=wnbaChart(logs,'player_points','PHX');
 assert.deepEqual(chart.all.map(game=>game.value),[22,18]);
 assert.equal(chart.h2h.length,1);
});

test('WNBA trend adapter preserves posted ladders and per-book prices',()=>{
 const rows=[{marketKey:'player_points',line:20.5,apps:[{key:'prizepicks',over:-119,under:-119},{key:'fanduel',over:-110,under:-120}]}];
 assert.equal(wnbaLines(rows,'player_points')[0].primaryBook,'prizepicks');
 assert.equal(wnbaOdds(rows,'player_points')[0].books.fanduel.over,-110);
});

test('each chart game carries its card: box line, result, usage and who sat out', async () => {
  const {wnbaChart: chart} = await import('../src/sports/wnba/trend-data.js');
  const logs = [{gameId: '401', date: '2026-04-15T23:00Z', opponent: 'GS', opponentLogo: 'gs.png', isHome: false, result: 'L', score: '121-126',
    minutes: 31, values: {player_points: 21, player_points_rebounds_assists: 34, player_offensive_rebounds: 2, player_defensive_rebounds: 3},
    box: {min: 31, pts: 21, reb: 5, ast: 8, stl: 1, blk: 0, to: 2, pf: 6, fgm: 8, fga: 15, tpm: 2, tpa: 4, ftm: 3, fta: 3}}];
  const notes = {401: {usage: 23, started: true, out: [{id: '9', name: 'Brandon Ingram', ppg: 20.9}]}};
  const [game] = chart(logs, 'player_points_rebounds_assists', 'GS', notes).all;
  assert.deepEqual(game.details.focus, ['pts', 'reb', 'ast']);
  assert.equal(game.details.kind, 'hoops');
  assert.equal(game.details.usage, 23);
  assert.equal(game.details.started, true);
  assert.deepEqual([game.details.fgm, game.details.fga, game.details.oreb, game.details.dreb, game.details.pf], [8, 15, 2, 3, 6]);
  assert.equal(game.details.out[0].name, 'Brandon Ingram');
  // A game the stored seasons don't have: the box line alone.
  const [plain] = chart(logs, 'player_points', 'GS').all;
  assert.deepEqual([plain.details.usage, plain.details.started, plain.details.out], [null, null, []]);
});
