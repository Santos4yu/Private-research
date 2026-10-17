import test from 'node:test';
import assert from 'node:assert/strict';
import {NEW_FOR_DAYS,STEPS,TOUR_KEY,placement,readTour,saveTour,shouldStart,spotlight} from '../src/welcome-tour-core.js';

const NOW=Date.parse('2026-10-17T12:00:00Z');
const day=86400e3;

test('the tour opens by itself once, and only for new members', () => {
  assert.equal(shouldStart(null,new Date(NOW-2*day).toISOString(),NOW),true);
  assert.equal(shouldStart(null,new Date(NOW-(NEW_FOR_DAYS+1)*day).toISOString(),NOW),false,'a longtime member replays it from Settings');
  assert.equal(shouldStart(null,null,NOW),true,'no join date: counted as new');
  assert.equal(shouldStart({done:true,how:'skipped'},new Date(NOW).toISOString(),NOW),false,'skipped counts as seen');
});

test('a finished or skipped tour is kept under the synced key', () => {
  const values={};
  const storage={getItem:key=>values[key]??null,setItem:(key,value)=>{values[key]=value;}};
  assert.equal(readTour(storage),null);
  saveTour(storage,'finished',NOW);
  assert.deepEqual(JSON.parse(values[TOUR_KEY]),{done:true,how:'finished',at:NOW});
  assert.deepEqual(readTour(storage),{done:true,how:'finished',at:NOW});
  assert.equal(readTour({getItem:()=>'not json'}),null);
});

test('the steps go Finder, player page, Slip Analyzer', () => {
  const keys=STEPS.map(step=>step.key);
  assert.deepEqual(keys,['welcome','sports','search','card','star','player','research','slip','done']);
  assert.ok(STEPS.slice(1,-1).every(step=>step.target?.length&&step.title&&step.text));
  assert.ok(!STEPS[0].target&&!STEPS.at(-1).target,'the first and last cards stand in the middle');
});

test('the card sits under, over or beside what it points at, always on screen', () => {
  const view={width:390,height:844},card={width:366,height:220};
  const below=placement({top:100,bottom:160,left:20,right:370,width:350,height:60},card,view);
  assert.deepEqual(below,{top:174,left:12,side:'below'});
  const above=placement({top:700,bottom:760,left:20,right:370,width:350,height:60},card,view);
  assert.equal(above.side,'above');
  assert.equal(above.top,700-14-220);
  const tall=placement({top:40,bottom:800,left:0,right:390,width:390,height:760},card,view);
  assert.deepEqual(tall,{top:844-220-12,left:12,side:'over'});
  const centered=placement(null,card,{width:1440,height:900});
  assert.deepEqual(centered,{top:340,left:537,side:'center'});
  // A wide screen: centered on the target, but never off the right edge.
  const right=placement({top:100,bottom:140,left:1300,right:1430,width:130,height:40},{width:360,height:200},{width:1440,height:900});
  assert.equal(right.left,1440-360-12);
});

test('the spotlight pads the target and stays on screen', () => {
  assert.deepEqual(spotlight({top:100,bottom:160,left:20,right:370},{width:390,height:844}),{top:94,left:14,right:376,bottom:166,width:362,height:72});
  assert.deepEqual(spotlight({top:-50,bottom:900,left:-10,right:500},{width:390,height:844}),{top:4,left:4,right:386,bottom:840,width:382,height:836});
  // What the card is placed against: under a lit header there's room below.
  const view={width:1440,height:900};
  assert.equal(placement(spotlight({top:20,bottom:70,left:240,right:1200,width:960,height:50},view),{width:360,height:216},view).side,'below');
  assert.equal(spotlight(null,{width:390,height:844}),null);
});
