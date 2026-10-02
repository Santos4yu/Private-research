import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeFinderRows,finderPlayerRows} from '../src/unified-finder-data.js';

test('CS2 saved histories grade every exact map market at its current line',()=>{
 const history={source:'bo3',games:[{gameId:'a',date:'2026-09-01',season:'2026',opponent:'Beta',values:{map1kills:10,map1headshots:4,maps12kills:25,maps12headshots:12}},
  {gameId:'b',date:'2026-09-02',season:'2026',opponent:'Beta',values:{map1kills:20,map1headshots:9,maps12kills:40,maps12headshots:20}}]};
 const rows=normalizeFinderRows('cs2',{rows:['MAP 1 Kills','MAP 1 Headshots','MAPS 1-2 Kills','MAPS 1-2 Headshots'].map((stat,i)=>({id:String(i),player:'alpha0',opponent:'Beta',startsAt:'2099-01-01T00:00:00Z',stat,line:[15,6,30,15][i],history}))});
 assert.ok(rows.every(row=>row.historyStatus==='ready'));
 assert.deepEqual(rows.map(row=>row.average),[15,6.5,32.5,16]);
 assert.ok(rows.every(row=>row.windows.l5.hitRate===50));
 assert.equal(rows[0].history.games.length,2);
 const unavailable=normalizeFinderRows('cs2',{rows:[{id:'a',player:'alpha0',stat:'MAP 1 Headshots',line:5,history:{games:[{date:'2026-09-01',values:{map1kills:10}}]}}]})[0];
 assert.equal(unavailable.historyStatus,'unavailable');
});

test('CS2 compact prebuilt response includes lines and histories together',()=>{
 const rows=normalizeFinderRows('cs2',{rows:[{id:'a',player:'alpha0',stat:'MAP 1 Kills',line:15}],histories:{alpha0:{games:[{date:'2026-09-01',values:{map1kills:20}}]}}});
 assert.equal(rows[0].average,20);
 assert.equal(rows[0].windows.l10.hitRate,100);
});

test('CS2 exact map markets retain lines and never fabricate hit rates',()=>{
 const rows=normalizeFinderRows('cs2',{rows:[{id:'pp:1',player:'junior',playerId:'a',opponent:'Team B',startsAt:'2099-01-01T00:00:00Z',stat:'MAP 1 Kills',line:17.5},
  {id:'pp:2',player:'junior',playerId:'b',opponent:'Team B',startsAt:'2099-01-01T00:00:00Z',stat:'MAPS 1-2 Kills',line:33.5},
  {id:'pp:3',player:'junior',opponent:'Other match',startsAt:'2099-01-02T00:00:00Z',stat:'MAP 1 Kills',line:14.5}]});
 assert.equal(rows[0].marketKey,'map1kills');assert.equal(rows[1].marketKey,'maps12kills');
 assert.equal(rows[0].historyStatus,'none');assert.ok(Object.values(rows[0].windows).every(value=>value===null));
 assert.equal(finderPlayerRows(rows,rows[0]).length,2);
});
test('CS2 uses the existing shared layout and tabs, not a separate design',()=>{
 const source=readFileSync(new URL('../src/sports/cs2/CS2PlayerPage.jsx',import.meta.url),'utf8');
 for(const shared of ['FinderPlayerBanner','FinderResearchTabs','vortexTrendPanel','mlb-finder-workspace','wnba-trend-host'])assert.ok(source.includes(shared));
 assert.ok(source.includes('useLayoutEffect'));
});

test('CS2 player page renders all six shared research tabs',async()=>{
 const {createServer}=await import('vite');
 const server=await createServer({server:{middlewareMode:true},appType:'custom'});
 try{
  const {CS2PlayerPage}=await server.ssrLoadModule('/src/sports/cs2/CS2PlayerPage.jsx');
  const React=(await import('react')).default;
  const {renderToStaticMarkup}=await import('react-dom/server');
  const row={sport:'cs2',player:'junior',market:'MAP 1 Kills',marketKey:'map1kills',line:17.5,apps:[]};
  const html=renderToStaticMarkup(React.createElement(CS2PlayerPage,{row,playerRows:[row],onBack:()=>{}}));
  for(const label of ['Matchup','Defense','Shooting','Similar','Injuries','Rankings'])assert.ok(html.includes(label));
  assert.ok(html.includes('finder-mlb-trend-host'));
 }finally{await server.close();}
});
