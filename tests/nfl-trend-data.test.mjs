import test from 'node:test';
import assert from 'node:assert/strict';
import {selectTrendGames,compareTrend,filterOffers,quoteIdentity,opportunityField} from '../src/sports/nfl/trend-data.js';
import {gameStatValue} from '../src/sports/nfl/nfl-ui-core.js';
import {gradeTrendChart} from '../src/trend-data.js';
// All records in this file are explicit test fixtures, never live player data.
const logs=Array.from({length:6},(_,i)=>({game_id:`mock-${i}`,season:i===5?2026:2025,week:i+1,team_id:'PIT',opponent_team_id:i%2?'ATL':'BAL',is_home:i%2===0,stats:{passing_yards:i*50,attempts:10+i*5,carries:i,targets:i+1,receptions:i,receiving_yards:i*10,rushing_yards:i*5,receiving_tds:0,rushing_tds:0,longest_reception:i*4,prizepicks_fantasy_score:i*2}}));
test('sample counts add older games; excluding a game refills without mutating source',()=>{
 const one=selectTrendGames(logs,[],'passing_yards',{},[],1);assert.equal(one.selected[0].game_id,'mock-5');
 assert.equal(selectTrendGames(logs,[],'passing_yards',{},[],6).selected.length,6);
 const removed=selectTrendGames(logs,[],'passing_yards',{},['mock-5'],5);assert.equal(removed.selected.at(-1).game_id,'mock-4');assert.equal(logs.length,6);
 assert.equal(selectTrendGames(logs,[],'passing_yards',{},[],5).selected.at(-1).game_id,'mock-5');
});
test('venue, opponent, season, team and prop-specific opportunity filters combine',()=>{
 assert.equal(selectTrendGames(logs,[],'passing_yards',{venue:'HOME',opponent:'BAL',season:'2025',team:'PIT',minVolume:15,maxVolume:25},[],20).selected.length,1);
 assert.equal(selectTrendGames(logs,[],'rushing_yards',{minVolume:4},[],20).selected.length,2);
 assert.equal(selectTrendGames(logs,[],'receiving_yards',{minVolume:4},[],20).selected.length,3);
 assert.equal(selectTrendGames(logs,[],'receiving_yards',{team:'KC'},[],20).selected.length,0);
});
test('snap filter requires actual mapped percentage; unknown does not become zero',()=>{
 const usage=[{game_id:'mock-0',offense_snap_rate:0},{game_id:'mock-1',offense_snap_rate:.8}];
 assert.equal(selectTrendGames(logs,usage,'passing_yards',{minSnaps:70}).selected[0].game_id,'mock-1');
 assert.equal(selectTrendGames(logs,usage,'passing_yards',{minSnaps:0}).selected.length,2);
});
test('moving line and direction recalculates hits, misses and pushes',()=>{
 const more=compareTrend(logs,'passing_yards',100,'OVER');assert.deepEqual([more.hits,more.misses,more.pushes],[3,2,1]);assert.equal(more.hitRate,60);
 const less=compareTrend(logs,'passing_yards',100,'UNDER');assert.equal(less.hitRate,40);
 assert.equal(compareTrend(logs,'passing_yards',100.5).pushes,0);
 assert.equal(compareTrend(logs,'passing_yards',null).hitRate,null);
 assert.equal(compareTrend([],'passing_yards',0).average,null);
 assert.equal(compareTrend([logs[0]],'passing_yards',0).hitRate,null);
});
test('shared trend chart grades the selected More or Less direction',()=>{
 const chart={all:[{value:10},{value:30}]};
 assert.deepEqual(gradeTrendChart(chart,20,'Over').all.map(row=>row.over),[false,true]);
 assert.deepEqual(gradeTrendChart(chart,20,'Under').all.map(row=>row.over),[true,false]);
});
test('each stat uses its own raw field; incomplete combined totals stay missing',()=>{
 assert.equal(gameStatValue(logs[3],'passing_yards'),150);assert.equal(gameStatValue(logs[3],'rushing_yards'),15);
 assert.equal(gameStatValue(logs[3],'longest_reception'),12);assert.equal(gameStatValue(logs[3],'fantasy_score'),6);
 assert.equal(gameStatValue(logs[3],'rushing_receiving_yards'),45);
 assert.equal(gameStatValue({stats:{rushing_yards:12}},'rushing_receiving_yards'),null);
 assert.equal(gameStatValue({stats:{fantasy_points_ppr:99}},'fantasy_score'),null);
 assert.equal(opportunityField('passing_attempts').key,'attempts');assert.equal(opportunityField('rush_attempts').key,'carries');assert.equal(opportunityField('receptions').key,'targets');
});
test('platform, category and stat selection never invents offers or directions',()=>{
 const rows=['STANDARD','GOBLIN','DEMON','ALTERNATE'].map((category,i)=>({propType:'passing_yards',line:{bookmaker:'prizepicks',category,value:200+i,direction:'OVER',propType:'passing_yards'}}));
 rows.push({propType:'passing_yards',line:{bookmaker:'draftkings',category:'STANDARD',value:201,direction:'UNDER'}});
 assert.equal(filterOffers(rows,{category:'STANDARD'}).length,1);assert.equal(filterOffers(rows,{category:'ALTERNATE'}).length,3);
 assert.equal(filterOffers(rows,{category:'GOBLIN'}).length,1);assert.equal(filterOffers(rows,{prop:'receptions'}).length,0);
 assert.ok(filterOffers(rows).every(row=>row.line.direction==='OVER'));
 assert.notEqual(quoteIdentity(rows[0].line),quoteIdentity({...rows[0].line,category:'DEMON'}));
});


test('line levels deduplicate More/Less without mixing prop categories', async()=>{
 const {postedLineLevels,filterOffers}=await import('../src/sports/nfl/trend-data.js');
 const rows=[['STANDARD',200,'OVER'],['STANDARD',200,'UNDER'],['GOBLIN',150,'OVER'],['DEMON',250,'OVER']].map(([category,value,direction])=>({propType:'passing_yards',direction,line:{category,value,bookmaker:'prizepicks'}}));
 assert.deepEqual(postedLineLevels(filterOffers(rows,{prop:'passing_yards',category:'STANDARD'})),[200]);
 assert.deepEqual(postedLineLevels(filterOffers(rows,{category:'GOBLIN'})),[150]);
 assert.deepEqual(postedLineLevels(filterOffers(rows,{category:'DEMON'})),[250]);
 assert.deepEqual(postedLineLevels([{line:{value:null}}]),[]);
});
