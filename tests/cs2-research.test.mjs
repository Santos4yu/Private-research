import test from 'node:test';
import assert from 'node:assert/strict';
import {researchData,shortDate} from '../src/sports/cs2/research-data.js';
test('research uses real maps, matched headshot denominator, and verified opponents',()=>{
 const games=[{gameId:'a',date:'2026-09-22',team:'Alpha',opponent:'Beta',values:{map1kills:10},mapDetails:[{number:1,map:'Mirage',kills:10,deaths:5,headshots:4}]},
 {gameId:'b',date:'2026-09-23',opponent:'Alpha / Beta',values:{map1kills:20},mapDetails:[{number:1,map:'Nuke',kills:20,deaths:10}]}];
 const result=researchData(games,'map1kills',15,'Beta','2026-10-01');
 assert.equal(result.average('kills'),15);assert.equal(result.kd,2);assert.equal(result.hs,40);assert.equal(result.h2h.length,1);
 assert.equal(researchData(games,'map1kills',15,'Beta','2026-09-23').maps.length,1);
 assert.equal(shortDate('bad'),'—');assert.ok(!shortDate('2026-09-22T14:00:00Z').includes('T14'));
});
