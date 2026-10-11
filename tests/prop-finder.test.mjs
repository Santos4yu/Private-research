import test from 'node:test';
import assert from 'node:assert/strict';
import {finderMarket,finderRows,gameValue,historyChart} from '../src/prop-finder-core.js';
import {historicalSides,liveBuilderProp} from '../src/builder-live-core.js';
import {readFileSync} from 'node:fs';
test('regular lines remain separate from goblin and demon; category and stat filters combine',()=>{
  const rows=['standard','goblin','demon'].map((odds_type,i)=>({player:'José Test',stat:'Pitcher Strikeouts',line:i+.5,odds_type}));
  rows.push({player:'Batter',stat:'Hits',line:.5,odds_type:'standard'});
  assert.equal(finderRows(rows).length,3);
  assert.equal(finderRows(rows,{modifier:'standard',query:'Jose'}).length,1);
  assert.equal(finderRows(rows,{category:'batters',modifier:'standard',stat:'hits'}).length,1);
  assert.equal(finderMarket('Strikeouts').pitcher,false);
  assert.equal(finderMarket('Strikeouts (Pitcher)').pitcher,true);
  assert.equal(finderMarket('Walks Allowed').pitcher,true);
});
test('shared raw history computes exact different markets and lines without treating innings as decimal',()=>{
  assert.equal(gameValue({inningsPitched:'5.2'},finderMarket('Pitching Outs')),17);
  assert.equal(gameValue({hits:3,doubles:1,triples:0,homeRuns:1,runs:2,rbi:3,baseOnBalls:1,hitByPitch:1,stolenBases:1},finderMarket('Fantasy Score')),37);
  assert.equal(gameValue({hits:3,runs:2,rbi:1},finderMarket('Hits+Runs+RBIs')),6);
  const payload={games:[{date:'2026-08-01',opponent:{id:1},stat:{strikeOuts:4}}],matchup:{opponent:{id:1}}};
  assert.equal(historyChart(payload,{stat:'Pitcher Strikeouts',line:3.5}).all[0].over,true);
  assert.equal(historyChart(payload,{stat:'Pitcher Strikeouts',line:4.5}).all[0].over,false);
});
test('short samples and pushes never become false wins; goblins stay More-only',()=>{
  const row={line:2,odds_type:'standard',allowed_wager_types:'over,under'};
  assert.deepEqual(historicalSides(row,{all:[{value:3}]},50),[]);
  const games=Array.from({length:10},()=>({value:2}));
  assert.deepEqual(historicalSides(row,{all:games},1),[]);
  assert.deepEqual(historicalSides({...row,odds_type:'goblin'},{all:games.map(()=>({value:1}))},50),[]);
});
test('Builder rejects mismatched or missing research evidence',()=>{
  const row={player:'Test Player',stat:'Hits',line:.5};
  assert.equal(liveBuilderProp({player:row.player},row,'over'),null);
  const live={player:row.player,betType:'Hits',line:.5,side:'Over',builderEvidence:{sampleL10:10},headshot:'https://img.mlbstatic.com/people/123/headshot/67/current'};
  assert.equal(liveBuilderProp({...live,line:1.5},row,'over'),null);
  assert.equal(liveBuilderProp(live,row,'under'),null);
  assert.equal(liveBuilderProp(live,row,'over').stats.player_id,'123');
  assert.equal(liveBuilderProp(live,row,'over').stats.lineup_confirmed,false);
});
test('restored MLB markets are recognized and charted from game logs',()=>{
 for(const [stat,key,pitcher] of [['Stolen Bases','sb',false],['Singles','singles',false],['Pitches Thrown','pitches',true],['Pitcher Fantasy Score','pitcher-fantasy',true],
  ['Fantasy Score (Pitcher)','pitcher-fantasy',true],['1st Inning Hits Allowed','first-hits',true],['1st Inning Runs Allowed','first-runs',true],['1st Inning Pitches Thrown','first-pitches',true]]){
  const market=finderMarket(stat);assert.ok(market,stat);assert.equal(market.key,key);assert.equal(market.pitcher,pitcher);
 }
 assert.equal(finderMarket('1st Inning Runs Allowed').firstInning,true);assert.equal(finderMarket('Pitches Thrown').firstInning,undefined);
 assert.equal(gameValue({hits:3,doubles:1,triples:0,homeRuns:1},finderMarket('Singles')),1);
 assert.equal(gameValue({stolenBases:2},finderMarket('Stolen Bases')),2);
 assert.equal(gameValue({numberOfPitches:97},finderMarket('Pitches Thrown')),97);
 // Win 6 + quality start 4 - 2 ER x3 + 7 K x3 + 19 outs
 assert.equal(gameValue({wins:1,earnedRuns:2,strikeOuts:7,inningsPitched:'6.1'},finderMarket('Pitcher Fantasy Score')),6+4-6+21+19);
 // No quality start with 4 earned runs.
 assert.equal(gameValue({wins:0,earnedRuns:4,strikeOuts:5,outs:18},finderMarket('Pitcher Fantasy Score')),-12+15+18);
 assert.equal(gameValue({firstInningRuns:0},finderMarket('1st Inning Runs Allowed')),0);
 assert.equal(gameValue({},finderMarket('1st Inning Hits Allowed')),null);
});
