import test from 'node:test';
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {createServer} from 'vite';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {topMoneylines,isMoneylinePlay} from '../src/moneyline-view.js';

const server=await createServer({server:{middlewareMode:true,hmr:false},logLevel:'error',plugins:[{
 name:'account-controls-stub',enforce:'pre',
 resolveId(id,importer){if(id==='./UnifiedFinder'&&importer?.endsWith('Moneylines.jsx'))return '\0moneyline-account';},
 load(id){if(id==='\0moneyline-account')return 'export const PhoneAccountButtons=()=>null;';}
}]});
after(()=>server.close());
const {Game,MatchupGrades,Record}=await server.ssrLoadModule('/src/Moneylines.jsx');
const render=(component,props)=>renderToStaticMarkup(React.createElement(component,props));
const game={id:'fixture',homeName:'Washington Commanders',awayName:'Indianapolis Colts',startsAt:'2026-10-04T13:30Z',
 fair:{home:.35,away:.65,homeOdds:185,awayOdds:-185},model:{home:.385,away:.615},books:[],best:{},ev:{},marketEv:{},
 prediction:{side:'away',team:'Indianapolis Colts',probability:.615,score:68},pick:null,reasons:[],
 target:{side:'home',price:186,best:170,bookName:'ESPN BET'},passReason:'No supported matchup clears the conservative price threshold'};

test('unavailable watch price is not a recommended play, and winner is explicit',()=>{
 const html=render(Game,{game});
 assert.match(html,/Projected winner/);assert.match(html,/Colts/);assert.match(html,/61\.5%/);
 assert.match(html,/Pass for now/);assert.match(html,/Watch price · not a play/);assert.match(html,/Target unavailable/);
 assert.doesNotMatch(html,/Play at|Suggested size/);assert.equal(isMoneylinePlay(game),false);
});
test('top plays use matchup score and exclude leans, watches and zero stakes',()=>{
 const row=(id,tier,score,units=.5)=>({id,pick:{tier,score,units,probability:.65,conservativeEv:.04}});
 const rows=[game,row('a','play',65),row('b','elite',89),row('c','lean',99,0),row('d','strong',81),row('e','elite',99,0)];
 assert.deepEqual(topMoneylines(rows).map(r=>r.id),['b','d','a']);assert.equal(rows[0],game);
});
test('both sides show missing components explicitly, not fake grades',()=>{
 const components=[{key:'offense',label:'Offense',score:70,detail:'25 points/game'},
  {key:'personnel',label:'Quarterback / report',score:null,detail:'Not verified'}];
 const grading={coverage:.6,teams:{home:{matchupScore:65,sample:8,components},away:{matchupScore:35,sample:8,components}},missing:['home: starter unresolved']};
 const html=render(MatchupGrades,{game:{grading},away:{abbr:'IND'},home:{abbr:'WSH'}});
 assert.match(html,/Both-team matchup grades/);assert.match(html,/Unavailable/);assert.match(html,/not win percentages/);assert.match(html,/60%/);
});
test('new model record is separate and does not disguise old losses',()=>{
 const html=render(Record,{record:{summary:{plays:3,wins:1,losses:2,pending:2,units:-.4,roi:-.12,curve:[]},plays:[],
  currentModel:{wins:0,losses:0,units:0,pending:1},validation:{games:0,brier:null,marketBrier:null,bins:[]}}});
 assert.match(html,/1–2/);assert.match(html,/−0\.4u/);assert.match(html,/New matchup model/);assert.match(html,/not yet|Not yet/);
});
