import test from 'node:test';
import assert from 'node:assert/strict';
import {researchData,shortDate,CS2_STATS,cs2Selection} from '../src/sports/cs2/research-data.js';
test('CS2 exposes map 2 and combined scopes without inventing book lines',()=>{
 assert.ok(CS2_STATS.some(s=>s.key==='map2headshots'));
 assert.ok(CS2_STATS.some(s=>s.key==='maps12headshots'));
 assert.ok(CS2_STATS.some(s=>s.key==='map2kills'));
 const selected=cs2Selection([],'map2headshots',{player:'Alpha'},[{values:{map2headshots:8}}]);
 assert.equal(selected.line,8);assert.equal(selected.id,'research:map2headshots');assert.deepEqual(selected.apps,[]);
 const posted={marketKey:'map2headshots',id:'pp:real',line:9,modifier:'standard'};
 assert.equal(cs2Selection([posted],'map2headshots',{},[]),posted);
});
test('research uses real maps, matched headshot denominator, and verified opponents',()=>{
 const games=[{gameId:'a',date:'2026-09-22',team:'Alpha',opponent:'Beta',values:{map1kills:10},mapDetails:[{number:1,map:'Mirage',kills:10,deaths:5,headshots:4}]},
 {gameId:'b',date:'2026-09-23',opponent:'Alpha / Beta',values:{map1kills:20},mapDetails:[{number:1,map:'Nuke',kills:20,deaths:10}]}];
 const result=researchData(games,'map1kills',15,'Beta','2026-10-01');
 assert.equal(result.average('kills'),15);assert.equal(result.kd,2);assert.equal(result.hs,40);assert.equal(result.h2h.length,1);
 assert.equal(researchData(games,'map1kills',15,'Beta','2026-09-23').maps.length,1);
 assert.equal(shortDate('bad'),'—');assert.ok(!shortDate('2026-09-22T14:00:00Z').includes('T14'));
});
