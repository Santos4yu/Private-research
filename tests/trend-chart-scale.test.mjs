import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('  const scaleFloors =',source.indexOf('function renderGameLogChart()'));
const end=source.indexOf('  const track =',start);
const scale=new Function('games','gameLogState','line',source.slice(start,end)+'return max;');
test('changing the research line does not change chart scale or bar heights',()=>{
 const games=[6,3,9,4,5,5,4,6,7,5].map(value=>({value}));
 const maxima=[.5,3.5,11.5,14.5,100].map(line=>scale(games,{stat:'Hits Allowed'},line));
 assert.equal(new Set(maxima).size,1);
 assert.ok(maxima[0]>=9);
});
test('zero result charts retain a finite positive scale',()=>{
 assert.ok(scale([{value:0}],{stat:'Hits'},.5)>0);
});
