import test from 'node:test';
import assert from 'node:assert/strict';
import {finderMarket,gameValue} from '../src/prop-finder-core.js';
import {statKeyOf} from '../src/sports/soccer/soccer-stats.js';

test('MLB: doubles, triples and the combined hitter stats read the game log',()=>{
 const game={hits:3,doubles:1,triples:1,homeRuns:0,runs:2,rbi:1,baseOnBalls:1};
 assert.equal(gameValue(game,finderMarket('Doubles')),1);
 assert.equal(gameValue(game,finderMarket('Triples')),1);
 assert.equal(gameValue(game,finderMarket('Runs+RBIs')),3);
 assert.equal(gameValue(game,finderMarket('Hits+Walks')),4);
 assert.equal(gameValue(game,finderMarket('Extra Base Hits')),2);
 assert.equal(finderMarket('Batter Walks').key,'walks');
});

test('MLB: pitcher runs, home runs allowed and batters faced',()=>{
 const start={runs:4,earnedRuns:3,homeRuns:2,battersFaced:24};
 assert.equal(gameValue(start,finderMarket('Runs Allowed')),4);
 assert.equal(finderMarket('Runs Allowed').pitcher,true);
 assert.equal(gameValue(start,finderMarket('Home Runs Allowed')),2);
 assert.equal(gameValue(start,finderMarket('Batters Faced')),24);
});

test('soccer: interceptions, blocked shots, accurate crosses and tackles won',()=>{
 assert.equal(statKeyOf('Interceptions'),'int');
 assert.equal(statKeyOf('Blocked Shots'),'blk');
 assert.equal(statKeyOf('Accurate Crosses'),'crossAcc');
 assert.equal(statKeyOf('Tackles Won'),'tacklesWon');
});
