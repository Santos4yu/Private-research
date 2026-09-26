import test from 'node:test';
import assert from 'node:assert/strict';
import {createMLBContextClient,researchParams,statText,lineupState} from '../src/mlb-finder-research.js';

test('context cache coalesces requests and expires',async()=>{
 let calls=0,clock=0;
 const request=createMLBContextClient({now:()=>clock,fetcher:async()=>{calls++;return {ok:true,json:async()=>({starterProfile:{name:'Starter'}})};}});
 await Promise.all([request('/api/prediction',{player:'A'}),request('/api/prediction',{player:'A'})]);
 await request('/api/prediction',{player:'A'});assert.equal(calls,1);
 clock=180001;await request('/api/prediction',{player:'A'});assert.equal(calls,2);
 await request('/api/prediction',{player:'B'});assert.equal(calls,3);
});
test('failed requests are retryable, not cached',async()=>{
 let calls=0;const request=createMLBContextClient({fetcher:async()=>({ok:++calls>1,json:async()=>calls===1?{error:'Unavailable'}:{ok:true}})});
 await assert.rejects(request('/api/prediction',{}),/Unavailable/);
 assert.deepEqual(await request('/api/prediction',{}),{ok:true});
});
test('research keeps player identity, market, line and direction',()=>{
 assert.deepEqual(researchParams({player:'A',playerId:12,teamId:3,market:'Hits Allowed',line:5.5,direction:'UNDER'}),{player:'A',playerId:12,teamId:3,stat:'Hits Allowed',line:5.5,side:'under'});
});
test('missing stats and unconfirmed lineups never masquerade as zero or confirmed',()=>{
 assert.equal(statText(null,2),'—');assert.equal(statText('---',2),'—');assert.equal(statText(0,2),'0.00');
 assert.match(lineupState({}),/unconfirmed/);assert.match(lineupState({lineupProjected:true}),/^Projected/);assert.match(lineupState({lineupConfirmed:true}),/^Confirmed/);
});
