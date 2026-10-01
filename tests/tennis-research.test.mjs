import test from 'node:test';
import assert from 'node:assert/strict';
import {tennisSample,tennisMean,tennisSummary,courtKey,decimalToAmerican,tennisOddsRecord} from '../src/sports/tennis/tennis-research.js';
test('court, ranking and match format filters use recorded facts',()=>{
 const games=[{surface:'I.hard',opponentRank:8,bestOf:3},{surface:'Clay',opponentRank:null,bestOf:5}];
 assert.equal(courtKey('I.hard'),'hard');assert.equal(tennisSample(games,{rank:'10',format:'3'}).length,1);
 assert.equal(tennisSample(games,{hand:'Left'}).length,0);
});
test('missing statistics are excluded while zero remains real',()=>{
 assert.equal(tennisMean([{values:{aces:0}},{values:{aces:4}},{values:{}}],'aces'),2);
 assert.equal(tennisMean([{values:{}}],'aces'),null);
});
test('form totals, moneylines and similar-odds samples are exact',()=>{
 const games=[{result:'W',odds:2,values:{setswon:2,totalsets:3,totalgameswon:18,gameslost:13}}];
 assert.equal(tennisSummary(games).setsLost,1);assert.equal(decimalToAmerican(2),'+100');assert.equal(decimalToAmerican(1.5),'-200');assert.equal(tennisOddsRecord(games,2).wins,1);assert.equal(tennisOddsRecord(games,1.1),null);
});
