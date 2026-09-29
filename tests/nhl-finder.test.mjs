import test from 'node:test';
import assert from 'node:assert/strict';
import {applyNhlHistory,normalizeFinderRows} from '../src/unified-finder-data.js';
import {nhlChart,playerGames,seasonLabel,withWithout} from '../src/sports/nhl/nhl-stats.js';

// A team log as nhl_research.team_log returns it: CAR's games, each with its
// players' lines.
const game=(gameId,date,opponent,players,seasonKind='regular',season='20252026')=>({gameId,date,opponent,players,seasonKind,season,team:'CAR',isHome:true,result:'W',score:'3-2'});
const log={team:'CAR',players:{'1':{name:'Jordan Staal',pos:'C'},'2':{name:'Seth Jarvis',pos:'C'}},games:[
 game('a','2026-03-01','BOS',{'2':{sog:1}}),
 game('b','2026-03-03','FLA',{'1':{sog:2,goals:0},'2':{sog:4}}),
 game('c','2026-03-05','NYR',{'2':{sog:3}}),
 game('d','2026-03-07','FLA',{'1':{sog:4,goals:1}}),
 game('e','2026-09-22','CHI',{'1':{sog:1,goals:0},'2':{sog:2}},'preseason','20262027'),
]};

test('a player\'s games start at his first appearance and the ones he sat are DNP',()=>{
 const rows=playerGames(log,'1');
 assert.deepEqual(rows.map(row=>[row.gameId,row.dnp]),[['b',false],['c',true],['d',false],['e',false]]);
 assert.equal(rows[1].values.sog,undefined);
});

test('the chart skips DNP games and names seasons the hockey way',()=>{
 const chart=nhlChart(playerGames(log,'1'),'sog','FLA');
 assert.deepEqual(chart.all.map(game=>[game.value,game.season,game.seasonKind]),[[2,'2025-26','regular'],[4,'2025-26','regular'],[1,'2026-27','preseason']]);
 assert.deepEqual(chart.h2h.map(game=>game.value),[2,4]);
 assert.equal(seasonLabel('20262027'),'2026-27');
});

test('with / without a teammate covers the player\'s own games',()=>{
 const split=withWithout(log,'1','sog')['2'];
 assert.deepEqual(split.with.gameIds,['b','e']);
 assert.deepEqual(split.without.gameIds,['d']);
 assert.equal(split.with.avg,1.5);
});

test('NHL rows carry the game, the player\'s NHL id and export as NHL picks',()=>{
 const [row]=normalizeFinderRows('nhl',{rows:[{id:'pp:1',player:'Jordan Staal',playerId:'1',team:'CAR',opponent:'FLA',stat:'Shots On Goal',
  marketKey:'shotsongoal',valueKey:'sog',line:1.5,modifier:'standard',startsAt:'2099-01-01T00:00:00Z',gameId:'2026010080',homeTeamAbbr:'CAR',awayTeamAbbr:'FLA',
  apps:[{key:'prizepicks',name:'PrizePicks'}]}]});
 assert.equal(row.sport,'nhl');
 assert.equal(row.historyStatus,'pending');
 assert.equal(row.valueKey,'sog');
 // A line the board could not match to a player has no history to load.
 const [unmatched]=normalizeFinderRows('nhl',{rows:[{id:'pp:2',player:'New Guy',playerId:null,team:'CAR',stat:'Hits',marketKey:'hits',valueKey:'hits',line:0.5,startsAt:'2099-01-01T00:00:00Z'}]});
 assert.equal(unmatched.historyStatus,'none');
});

test('NHL hit rates come from the player\'s own games, DNP left out',()=>{
 const row={id:'nhl:1',sport:'nhl',player:'Jordan Staal',playerId:'1',opponent:'FLA',valueKey:'sog',line:1.5,direction:'OVER',apps:[]};
 const ready=applyNhlHistory(row,log);
 assert.equal(ready.historyStatus,'ready');
 assert.deepEqual([ready.windows.l5.hits,ready.windows.l5.decisions],[2,3]);
 assert.deepEqual([ready.windows.h2h.hits,ready.windows.h2h.decisions],[2,2]);
 // The latest season only: the one preseason game.
 assert.deepEqual([ready.windows.season.hits,ready.windows.season.decisions],[0,1]);
 assert.equal(ready.streak,-1);
 assert.equal(applyNhlHistory({...row,valueKey:null},log).historyStatus,'unavailable');
});
