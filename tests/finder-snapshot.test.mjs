import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFinderSnapshot,enrichWnbaRows,finderHistoryKey,loadFinderSport} from '../src/unified-finder-data.js';
const now=Date.now();
const row={id:'p:1',sport:'wnba',player:'Test Player',playerId:'1',marketKey:'player_assists',line:2.5,direction:'OVER',opponent:'LV',apps:[],historyStatus:'pending'};
const history={rows:[{date:'2026-09-28',gameId:'1',values:{player_assists:3}},{date:'2026-09-29',gameId:'2',values:{player_assists:2}}]};
const entry={at:now,payload:history};
test('one saved player sample grades fresh and moved lines immediately',()=>{
 const [first,moved]=applyFinderSnapshot([row,{...row,id:'p:2',line:1.5}],{[finderHistoryKey(row)]:entry},now);
 assert.equal(first.windows.l10.hits,1);assert.equal(moved.windows.l10.hits,2);
 assert.equal(first.line,2.5);assert.equal(first.historyRefresh,false);
 assert.equal(first.historyAsOf,now);
});
test('stale samples stay visible while flagged for automatic refresh; expired samples are excluded',()=>{
 const key=finderHistoryKey(row);
 const stale=applyFinderSnapshot([row],{[key]:{...entry,at:now-3600000}},now)[0];
 assert.equal(stale.historyStatus,'ready');assert.equal(stale.historyRefresh,true);
 assert.equal(applyFinderSnapshot([row],{[key]:{...entry,at:now-25*3600000}},now)[0],row);
});
test('failed background refresh does not erase last successful numbers',async()=>{
 const stale=applyFinderSnapshot([row],{[finderHistoryKey(row)]:{...entry,at:now-3600000}},now)[0];
 const result=await enrichWnbaRows([stale],{fetcher:async()=>{throw Error('outage');}});
 assert.equal(result[0].historyStatus,'ready');assert.equal(result[0].average,2.5);
 assert.equal(result[0].historyRefresh,true);
});
test('shared cache outage never blocks the posted board',async()=>{
 const payload={rows:[{id:'pp:1',player:'Test Player',stat:'Aces',marketKey:'aces',line:4.5,startsAt:'2099-01-01T00:00:00Z'}]};
 const board=await loadFinderSport('tennis',{fetcher:async url=>{
  if(url.includes('finder-history'))throw Error('cache down');
  return {ok:true,json:async()=>payload};
 }});
 assert.equal(board.rows[0].line,4.5);
});
