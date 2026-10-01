import test from 'node:test';
import assert from 'node:assert/strict';
import {finderPlayerRows} from '../src/unified-finder-data.js';
import {wnbaLines} from '../src/sports/wnba/trend-data.js';
import {tennisPostedSelection} from '../src/sports/tennis/tennis-research.js';

test('fresh PrizePicks quote replaces a research-average fallback with its exact line',()=>{
 const current={id:'research:totalsets',marketKey:'totalsets',line:2.7};
 const quote={id:'pp-rublev-sets',marketKey:'totalsets',line:2.5,modifier:'demon'};
 assert.equal(tennisPostedSelection([quote],'totalsets',current),quote);
 assert.equal(tennisPostedSelection([],'totalsets',current),null);
});

test('posted selection preserves selected alternate quotes and prefers standard otherwise',()=>{
 const standard={id:'standard',marketKey:'aces',line:8.5,modifier:'standard'};
 const demon={id:'demon',marketKey:'aces',line:10.5,modifier:'demon'};
 assert.equal(tennisPostedSelection([demon,standard],'aces',{id:'research:aces'}),standard);
 assert.equal(tennisPostedSelection([demon,standard],'aces',demon),demon);
});
test('tennis joins alternate player IDs without losing posted lines or tiers',()=>{
 const base={sport:'tennis',player:'Anastasia Zakharova',opponent:'Yushan Shao',startsAt:'2099-10-01T02:00:00Z',playerId:'standard'};
 const rows=[{...base,marketKey:'totalgames',line:18}, {...base,playerId:'demon',marketKey:'totalgameswon',line:12.5,modifier:'demon',apps:[{key:'prizepicks'}]}, {...base,playerId:'demon',marketKey:'totalsets',line:2.5,modifier:'demon',apps:[{key:'prizepicks'}]}, {...base,opponent:'Yushan Shao 1st Set',marketKey:'1stsettotalgames',line:8.5}, {...base,opponent:'Someone Else',line:9}, {...base,startsAt:'2099-10-03T02:00:00Z',line:10}];
 const grouped=finderPlayerRows(rows,base);
 assert.equal(grouped.length,4);
 assert.equal(wnbaLines(grouped,'totalgameswon')[0].value,12.5);
 assert.equal(wnbaLines(grouped,'totalsets')[0].tier,'DEMON');
});
