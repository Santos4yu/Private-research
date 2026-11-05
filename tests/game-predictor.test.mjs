import test from 'node:test';
import assert from 'node:assert/strict';
import {byText,edgeText,lineText,odds,pct,pull,recordText,resultOf,startText} from '../src/game-predictor-core.js';

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

test('the edge in words',()=>{
 const prediction={...game,chance:{home:0.64,away:0.36},market:{chance:{home:0.36,away:0.64}},edge:{side:'home',points:0.28,chance:0.64,price:170,fair:-178}};
 assert.deepEqual(edgeText(prediction),{team:game.home,price:'+170',fair:'-178',ours:'64%',market:'36%',gap:'+28.0%'});
 assert.equal(edgeText({...prediction,edge:{side:null}}),null);
});

test('start times say today and tomorrow',()=>{
 const now=new Date(2026,10,5,12,0);
 assert.match(startText(new Date(2026,10,5,19,30).toISOString(),now),/^Today 7:30/);
 assert.match(startText(new Date(2026,10,6,19,30).toISOString(),now),/^Tomorrow /);
 assert.equal(startText('nope',now),'');
});
