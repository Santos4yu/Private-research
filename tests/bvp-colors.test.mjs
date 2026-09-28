import test from 'node:test';
import assert from 'node:assert/strict';
import {battingBand} from '../src/mlb-finder-research.js';
test('BvP colors actual samples but keeps absent data gray',()=>{
 assert.equal(battingBand('avg',.5,4,true).tone,'good');
 assert.equal(battingBand('avg',0,9,true).tone,'poor');
 assert.match(battingBand('avg',.5,4,true).label,/Small BvP/);
 assert.equal(battingBand('avg',0,0,true).tone,'neutral');
 assert.equal(battingBand('avg',null,4,true).tone,'neutral');
 assert.equal(battingBand('avg',.5,4).tone,'neutral');
});
