import test from 'node:test';
import assert from 'node:assert/strict';
import {accessGranted,canUseTab,availableTab} from '../src/site-access-core.js';
const base={maintenance:false,requireLogin:true,account:null,isAdmin:false,disabledTabs:[]};
test('pending and signed out users cannot see or navigate research',()=>{assert.equal(accessGranted(null),false);assert.equal(accessGranted(base),false);assert.equal(canUseTab(base,'research'),false);});
test('account grants access but disabled tabs stay unavailable',()=>{const policy={...base,account:{id:'mock'},disabledTabs:['v2']};assert.equal(accessGranted(policy),true);assert.equal(canUseTab(policy,'research'),true);assert.equal(canUseTab(policy,'v2'),false);});
test('maintenance blocks accounts and preserves administrator recovery',()=>{assert.equal(accessGranted({...base,account:{id:'mock'},maintenance:true}),false);assert.equal(canUseTab({...base,isAdmin:true,maintenance:true,disabledTabs:['research']},'research'),true);});

test('a disabled current tab chooses an available exit',()=>{assert.equal(availableTab({...base,account:{id:'mock'},disabledTabs:['research']},'research'),'v2');});
test('all locked tabs have no false unlocked destination',()=>{assert.equal(availableTab({...base,account:{id:'mock'},disabledTabs:['research','v2']},'research',['research','v2']),null);});
test('clicking a locked tab retains a valid previous destination',()=>{const policy={...base,account:{id:'mock'},disabledTabs:['v2']};assert.equal(canUseTab(policy,'v2'),false);assert.equal(availableTab(policy,'research'),'research');});

 test('hidden NFL is unavailable to members but admins retain preview',async()=>{const {canUseSport}=await import('../src/site-access-core.js');const policy={requireLogin:false,disabledTabs:[],disabledSports:['nfl']};assert.equal(canUseSport(policy,'nfl'),false);assert.equal(canUseSport(policy,'mlb'),true);assert.equal(canUseSport({...policy,isAdmin:true},'nfl'),true);});
