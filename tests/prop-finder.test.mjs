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
test('live research clears the actual Builder gates; missing starter or samples fail',()=>{
  const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('const BUILDER_MODES ='),source.indexOf('function rankedParlayCandidates('));
  const candidate=new Function('BOT_PITCHER_STATS',`${code};return parlayCandidate;`)(new Set());
  const row={id:'live1',player:'Test Player',stat:'Pitcher Strikeouts',line:3.5};
  const live={player:row.player,betType:'Strikeouts (Pitcher)',isPitcherProp:true,line:3.5,side:'Over',tier:'Strong',
    matchupScore:80,matchupCoverage:.9,matchupAdjustment:0,hitRates:{l10:80,l20:75},
    matchup:{opponent:'Opponent'},starterProfile:{id:123,name:'Test Player'},
    builderEvidence:{sampleL10:10,sampleL20:20,starterConfirmed:true,projectionEdge:1,stability:'HIGH',gameId:1}};
  const good=liveBuilderProp(live,row,'over');
  assert.equal(candidate(good,'safe').valid,true);
  assert.equal(candidate({...good,stats:{...good.stats,sample_l10:1}},'safe').valid,false);
  assert.equal(candidate({...good,stats:{...good.stats,pitcher:{validated_role:false}}},'safe').valid,false);
});
