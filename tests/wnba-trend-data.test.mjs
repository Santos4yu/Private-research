import test from 'node:test';
import assert from 'node:assert/strict';
import {wnbaChart,wnbaLines,wnbaOdds} from '../src/sports/wnba/trend-data.js';

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
