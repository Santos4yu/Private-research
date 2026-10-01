import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
function block(marker){const start=source.indexOf(marker);assert.ok(start>=0);return source.slice(start,source.indexOf('\n};',start)+3);}
function harness(){
 const paints=[],opens=[];
 const state={windowKey:'L20',filters:{opponent:'example'},line:2.5};
 const ctx={window:{},gameLogState:state,externalTrendConfig:null,trendAdapter:null,activeFinderProp:null,
  captureGameLogViewport:()=>({scroll:120}),restoreGameLogViewport:()=>{},
  gradeTrendChart:chart=>chart,syncTrendStatHeader:()=>{},populateGameLogStats:()=>{},
  renderGameLogTabs:()=>{},renderGameLogChart:()=>paints.push(state.stat),
  applyExternalTrendMarket:()=>{},renderExternalTrendChips:()=>{},
  openGameLogModal:prop=>opens.push(prop)};
 vm.createContext(ctx);
 vm.runInContext(block('const EXTERNAL_TREND_ADAPTER = ')+block('window.vortexTrendPanel = '),ctx);
 return {ctx,state,paints,opens,panel:ctx.window.vortexTrendPanel};
}
for(const sport of ['TENNIS','NBA','WNBA','NFL','SOCCER','NHL']){
 test(`${sport} stat changes update in place and preserve the selected window and filters`,()=>{
  const h=harness();
  const first={sport,player:'Example',statKey:'sets',stat:'Total Sets',line:2.5,chart:{all:[2,3]}};
  h.panel.update(first,true);
  const next={...first,statKey:'aces',stat:'Aces',line:10.5,chart:{all:[8,12]}};
  h.panel.update(next);
  assert.equal(h.opens.length,1);
  assert.equal(h.state.windowKey,'L20');
  assert.equal(h.state.filters.opponent,'example');
  assert.equal(h.state.stat,'Aces');
  assert.equal(h.state.line,10.5);
  assert.equal(h.state.animationDirection,'none');
  assert.equal(h.state.chart,next.chart);
  assert.deepEqual(h.paints,['Aces']);
  h.panel.update(next);
  assert.equal(h.paints.length,1);
 });
}
test('external tab click never paints old data under the newly requested title',()=>{
 const h=harness(),requested=[];
 h.panel.update({sport:'TENNIS',player:'Example',statKey:'sets',stat:'Total Sets',line:2.5,
  stats:[{label:'Total Sets',key:'sets'},{label:'Aces',key:'aces'}],onStat:key=>requested.push(key)},true);
 vm.runInContext("EXTERNAL_TREND_ADAPTER.loadStat('Aces')",h.ctx);
 assert.deepEqual(requested,['aces']);
 assert.equal(h.paints.length,0);
});
