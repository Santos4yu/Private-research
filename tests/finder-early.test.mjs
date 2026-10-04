import test from 'node:test';
import assert from 'node:assert/strict';
import {finderStartKeys, startFinder, takeEarly} from '../src/finder-early.js';

test('The Finder starts loading the leagues it will open on',()=>{
 const allowed=key=>['nba','wnba','mlb'].includes(key);
 // Every league the member can see, a linked one, or the leagues they last picked.
 assert.deepEqual(finderStartKeys(allowed),['nba','wnba','mlb']);
 assert.deepEqual(finderStartKeys(allowed,{search:'?sport=wnba&player=A%27ja%20Wilson'}),['wnba']);
 assert.deepEqual(finderStartKeys(allowed,{search:'?sport=nhl&player=X'}),['nba','wnba','mlb']);
 const storage={getItem:()=>JSON.stringify({at:Date.now(),picked:['mlb','nhl']})};
 assert.deepEqual(finderStartKeys(allowed,{storage}),['mlb']);
});

test('A head start is taken up once, and only while fresh',async()=>{
 let now=1000;
 const clock=()=>now;
 const realFetch=globalThis.fetch;
 const asked=[];
 globalThis.fetch=async url=>{asked.push(String(url));return {ok:true,status:200,json:async()=>({rows:[],fetchedAt:'x'})};};
 try{
  startFinder(['nhl'],clock);
  startFinder(['nhl'],clock);
  const early=takeEarly('nhl',clock);
  assert.ok(early);
  assert.equal(takeEarly('nhl',clock),null);
  const head=await early.live;
  await head.board;
  // Started twice, asked for once.
  assert.equal(asked.filter(url=>url.includes('nhl')&&!url.includes('finder-history')).length,1);
  startFinder(['tennis'],clock);
  now+=60*1000;
  assert.equal(takeEarly('tennis',clock),null);
 }finally{globalThis.fetch=realFetch;}
});
