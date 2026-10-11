import test from 'node:test';
import assert from 'node:assert/strict';
import { loadNFLHistory, historicalUsage, compareHistoryLine } from '../src/sports/nfl/nfl-history.js';
// Mock records are confined to tests.
const row = (season,week,stats={attempts:30}) => ({ season,week,game_id:`mock-${season}-${week}`,stats });
test('real quote history comparisons exclude pushes and missing values',()=>{
  const quote={verified:true,propType:'passing_yards',direction:'OVER',value:200};
  const logs=[{value:201},{value:199},{value:200},{value:null}];
  assert.deepEqual(compareHistoryLine(logs,'passing_yards',quote,row=>row.value),{games:3,hits:1,misses:1,pushes:1,hitRate:50});
  assert.equal(compareHistoryLine(logs,'receptions',quote,row=>row.value),null);
  assert.equal(compareHistoryLine(logs,'passing_yards',{...quote,verified:false},row=>row.value),null);
});
test('all pushes do not fabricate a hit rate',()=>{
  const quote={verified:true,propType:'receptions',direction:'UNDER',value:0};
  assert.equal(compareHistoryLine([{value:0}],'receptions',quote,row=>row.value).hitRate,null);
});
test('early-season history uses previous-season real adapter rows in chronological order',async()=>{
  const calls=[]; const load=async(resource,{season})=>{calls.push(season);return {status:'AVAILABLE',data:season===2026?[row(2026,1)]:[row(2025,18),row(2025,17)]};};
  const output=await loadNFLHistory(load,'game-logs',{playerId:'mock'},2026);
  assert.deepEqual(calls,[2026,2025]);assert.deepEqual(output.data.map(r=>r.week),[17,18,1]);
  assert.equal(output.history.label,'2025 + 2026');assert.equal(output.history.currentGames,1);
});
test('adequate current history is never contaminated with a prior season',async()=>{
  // Both seasons are asked for side by side (one round trip instead of two
  // in a row); the previous one is only used when the current is short.
  const output=await loadNFLHistory(async(_,{season})=>({data:season===2026?Array.from({length:20},(_,i)=>row(2026,i+1)):[row(2025,18)],status:'AVAILABLE'}),'game-logs',{},2026);
  assert.equal(output.data.length,20);assert.ok(output.data.every(r=>r.season===2026));assert.equal(output.history.includedPrevious,false);
});
test('explicit season selection never falls back silently',async()=>{
  const calls=[];const load=async(_,params)=>{calls.push(params.season);return {status:'AVAILABLE',data:[]};};
  await loadNFLHistory(load,'game-logs',{},2026,'current');await loadNFLHistory(load,'game-logs',{},2026,'previous');
  assert.deepEqual(calls,[2026,2025]);
});
test('current provider failure preserves labelled last-season data, without inventing current games',async()=>{
  const output=await loadNFLHistory(async(_,p)=>{if(p.season===2026)throw Error('test outage');return {data:[row(2025,18)],status:'AVAILABLE'};},'game-logs',{},2026);
  assert.equal(output.history.historicalOnly,true);assert.equal(output.history.currentGames,0);assert.match(output.reason,/unavailable/);
});
test('no history is not a fake zero; descriptive usage never creates expected routes or touches',async()=>{
  const output=await loadNFLHistory(async()=>({data:[],status:'AVAILABLE'}),'game-logs',{},2026);
  assert.equal(output.data.length,0);
  const metrics=historicalUsage([row(2025,18,{carries:0,targets:null})],[],'RB');
  assert.equal(metrics.find(m=>m.key==='carries').value,0);assert.equal(metrics.find(m=>m.key==='targets').value,null);
  assert.ok(!metrics.some(m=>/expected|routes|touches/i.test(m.label)));
});
