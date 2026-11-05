import test from 'node:test';
import assert from 'node:assert/strict';
import {byText,evText,lineText,odds,pct,pull,recordText,resultOf,startText,twoCalls,unitsText,valueRows} from '../src/game-predictor-core.js';

const game={home:{abbr:'DEN',short:'Nuggets'},away:{abbr:'BOS',short:'Celtics'}};

test('numbers read plainly',()=>{
 assert.equal(pct(0.613),'61%');
 assert.equal(pct(null),'—');
 assert.equal(odds(150),'+150');
 assert.equal(odds(-190),'-190');
 assert.equal(odds(null),'—');
});

test('the line names the favorite',()=>{
 assert.equal(lineText({...game,line:{spread:-6.5,total:231.5}}),'DEN -6.5 · O/U 231.5');
 assert.equal(lineText({...game,line:{spread:3,total:null}}),'BOS -3.0');
 assert.equal(lineText({...game,line:null}),'');
});

test('a factor points at the team it helps',()=>{
 assert.deepEqual(pull(3.84,game),{side:'home',text:'+3.8 DEN'});
 assert.deepEqual(pull(-12.04,game),{side:'away',text:'+12 BOS'});
 assert.deepEqual(pull(0,game),{side:null,text:'Even'});
 assert.equal(byText(-5.5,game),'BOS by 5.5');
 assert.equal(byText(6.5,game),'DEN by 6.5');
});

test('the record and each result',()=>{
 assert.equal(recordText({games:17,correct:12,pct:12/17}),'12-5 · 71%');
 assert.equal(recordText({games:0}),null);
 assert.equal(resultOf({result:null}),'pending');
 assert.equal(resultOf({result:{winner:'home',correct:true}}),'win');
 assert.equal(resultOf({result:{winner:'away',correct:false}}),'loss');
});

test('each moneyline\'s value, away first',()=>{
 const prediction={...game,ev:{blend:{home:{price:-190,chance:0.62,ev:-0.0537,fair:-163},away:{price:160,chance:0.38,ev:-0.012,fair:163}},
  ours:{home:{price:-190,chance:0.7,ev:0.0684}},best:null}};
 const rows=valueRows(prediction);
 assert.deepEqual(rows.map(row=>[row.side,row.price,row.chance,row.text,row.fair,row.ours,row.best]),
  [['away','+160','38%','−1.2%','+163',null,false],['home','-190','62%','−5.4%','-163','+6.8%',false]]);
 assert.deepEqual(valueRows({...game}),[]);
 assert.equal(evText(0.032),'+3.2%');
 assert.equal(unitsText(1.43),'+1.4 units');
 assert.equal(unitsText(-2),'−2 units');
});

test('two predictions only when the line and ours both count',()=>{
 const ours={winner:'home',margin:6},blend={winner:'home',margin:5,weight:0.25};
 assert.equal(twoCalls({predictions:{ours,blend}}).share,'25% ours');
 assert.equal(twoCalls({predictions:{ours,blend:{...blend,weight:1}}}),null);
 assert.equal(twoCalls({predictions:{ours:null,blend}}),null);
});

test('start times say today and tomorrow',()=>{
 const now=new Date(2026,10,5,12,0);
 assert.match(startText(new Date(2026,10,5,19,30).toISOString(),now),/^Today 7:30/);
 assert.match(startText(new Date(2026,10,6,19,30).toISOString(),now),/^Tomorrow /);
 assert.equal(startText('nope',now),'');
});
