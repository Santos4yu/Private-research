// Slip to PrizePicks (SlipExport.jsx): the page is for admins only, and its
// link opens each pick found on its side.
import test from 'node:test';
import assert from 'node:assert/strict';
import {after} from 'node:test';
import {createServer} from 'vite';
import {canUseTab,hiddenTabs} from '../src/site-access-core.js';

const server=await createServer({server:{middlewareMode:true,hmr:false},logLevel:'error'});
after(()=>server.close());
const {entryLink}=await server.ssrLoadModule('/src/SlipExport.jsx');

const pick=(projectionId,side='over',line=24.5)=>({pick:{projectionId,side,line}});

test('the link opens every pick found, each on its side, up to six', () => {
 assert.equal(entryLink([pick('1'),{read:{player:'Missing'},reason:'Not on PrizePicks right now'},pick('2','under',38)]),
  'https://app.prizepicks.com/?projections=1-o-24.5,2-u-38');
 assert.equal(entryLink([pick('1'),pick('1','under')]),'https://app.prizepicks.com/?projections=1-o-24.5','the same line once');
 const eight=Array.from({length:8},(_,index)=>pick(String(index)));
 assert.equal(entryLink(eight).split(',').length,6);
 assert.equal(entryLink([]),null);
});

test('only an admin sees Slip to PrizePicks', () => {
 const member={accessGranted:true,isAdmin:false,maintenance:false,suspended:false,requireLogin:false,disabledTabs:[],account:{id:'m'}};
 assert.equal(canUseTab(member,'export'),false);
 assert.ok(hiddenTabs(member,['finder','export']).includes('export'));
 assert.equal(canUseTab({...member,isAdmin:true},'export'),true);
});
