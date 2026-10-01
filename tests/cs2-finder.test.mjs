import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeFinderRows,finderPlayerRows} from '../src/unified-finder-data.js';

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
