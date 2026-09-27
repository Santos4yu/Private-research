import test from 'node:test';
import assert from 'node:assert/strict';
import {createMLBContextClient,researchParams,statText,lineupState,battingBand,mergeLineupSplits,supportingChoices,supportingValue,pitchTypeStats} from '../src/mlb-finder-research.js';

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

test('batting bands respect metric direction and sample size',()=>{
 assert.equal(battingBand('avg',.280,100).tone,'good');
 assert.equal(battingBand('avg',.250,100).tone,'fair');
 assert.equal(battingBand('avg',.210,100).tone,'poor');
 assert.equal(battingBand('ops',.810,100).tone,'good');
 assert.equal(battingBand('k_pct',18,100).tone,'good');
 assert.equal(battingBand('k_pct',30,100).tone,'poor');
 assert.equal(battingBand('avg',.500,5).tone,'neutral');
 assert.equal(battingBand('avg',null,100).tone,'neutral');
});
test('split merge preserves season stats, roster order and confirmed status',()=>{
 const summary={lineupConfirmed:true,battingOrder:[{id:1,order:1,season:{avg:.270}},{id:2,order:2,season:{avg:.240}}]};
 const details={lineupConfirmed:false,battingOrder:[{id:2,order:1,season:null,handSplitL:{avg:.300}},{id:3,order:2}]};
 const merged=mergeLineupSplits(summary,details);
 assert.equal(merged.lineupConfirmed,true);
 assert.deepEqual(merged.battingOrder.map(p=>p.id),[1,2]);
 assert.equal(merged.battingOrder[1].season.avg,.240);
 assert.equal(merged.battingOrder[1].handSplitL.avg,.300);
});
test('equivalent parameter order shares cache without duplicate loads',async()=>{
 let calls=0;const request=createMLBContextClient({fetcher:async()=>{calls++;return {ok:true,json:async()=>({ok:true})};}});
 await request('/api/team-insights',{teamId:1,detail:'summary'});
 await request('/api/team-insights',{detail:'summary',teamId:1});
 assert.equal(calls,1);
});
test('pitchers and batters have distinct supporting metrics',()=>{
 assert.equal(supportingChoices(true)[0][0],'inningsPitched');
 assert.equal(supportingChoices(false)[0][0],'plateAppearances');
 assert.ok(supportingChoices(true).some(([key])=>key==='earnedRuns'));
});
test('innings use outs, never baseball decimal notation as decimal math',()=>{
 assert.equal(supportingValue({stat:{inningsPitched:'5.2'}},'inningsPitched'),17/3);
 assert.equal(supportingValue({stat:{outs:16,inningsPitched:'5.2'}},'inningsPitched'),16/3);
 assert.equal(supportingValue({stat:{inningsPitched:'5.8'}},'inningsPitched'),null);
 assert.equal(supportingValue({stat:{}},'earnedRuns'),null);
});
test('pitch-type totals weight available rates and preserve missing stats',()=>{
 const row={byPitch:{FF:{pa:100,pitches:400,k_pct:20,woba:.300},SL:{pa:50,pitches:200,k_pct:35,woba:.330}}};
 assert.deepEqual(pitchTypeStats(row,'FF'),row.byPitch.FF);
 const all=pitchTypeStats(row,'all');assert.equal(all.pa,150);assert.equal(all.k_pct,25);assert.ok(Math.abs(all.woba-.310)<.0001);
 assert.deepEqual(pitchTypeStats(row,'CH'),{});
 row.byPitch.SL.woba=null;assert.equal(pitchTypeStats(row,'all').woba,null);
});
