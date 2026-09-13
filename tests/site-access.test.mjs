import test from 'node:test';
import assert from 'node:assert/strict';
import {accessGranted,canUseTab} from '../src/site-access-core.js';
const base={maintenance:false,requireLogin:true,account:null,isAdmin:false,disabledTabs:[]};
test('pending and signed out users cannot see or navigate research',()=>{assert.equal(accessGranted(null),false);assert.equal(accessGranted(base),false);assert.equal(canUseTab(base,'research'),false);});
test('account grants access but disabled tabs stay unavailable',()=>{const policy={...base,account:{id:'mock'},disabledTabs:['v2']};assert.equal(accessGranted(policy),true);assert.equal(canUseTab(policy,'research'),true);assert.equal(canUseTab(policy,'v2'),false);});
test('maintenance blocks accounts and preserves administrator recovery',()=>{assert.equal(accessGranted({...base,account:{id:'mock'},maintenance:true}),false);assert.equal(canUseTab({...base,isAdmin:true,maintenance:true,disabledTabs:['research']},'research'),true);});
