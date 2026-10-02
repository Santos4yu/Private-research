import test from 'node:test';
import assert from 'node:assert/strict';
import {accessGranted,canUseTab,availableTab} from '../src/site-access-core.js';
import {accountControlsVisible} from '../src/site-access-core.js';
const base={maintenance:false,requireLogin:true,account:null,isAdmin:false,disabledTabs:[]};
test('temporary visitors enter research without being shown a fake account or admin controls',()=>{
 const policy={...base,requireLogin:false,temporaryPublicAccess:true,disabledTabs:['community','moves','moneyline']};
 assert.equal(accessGranted(policy),true);
 assert.equal(canUseTab(policy,'research'),true);
 assert.equal(canUseTab(policy,'moneyline'),false);
 assert.equal(canUseTab(policy,'community'),false);
 assert.equal(accountControlsVisible(policy),false);
 assert.equal(accountControlsVisible({...policy,isAdmin:true}),true);
 assert.equal(accountControlsVisible({...base,account:{id:'member'}}),true);
});
test('pending and signed out users cannot see or navigate research',()=>{assert.equal(accessGranted(null),false);assert.equal(accessGranted(base),false);assert.equal(canUseTab(base,'research'),false);});
test('account grants access but disabled tabs stay unavailable',()=>{const policy={...base,account:{id:'mock'},disabledTabs:['v2']};assert.equal(accessGranted(policy),true);assert.equal(canUseTab(policy,'research'),true);assert.equal(canUseTab(policy,'v2'),false);});
test('maintenance blocks accounts and preserves administrator recovery',()=>{assert.equal(accessGranted({...base,account:{id:'mock'},maintenance:true}),false);assert.equal(canUseTab({...base,isAdmin:true,maintenance:true,disabledTabs:['research']},'research'),true);});

test('a disabled current tab chooses an available exit',()=>{assert.equal(availableTab({...base,account:{id:'mock'},disabledTabs:['research']},'research'),'finder');});
test('all locked tabs have no false unlocked destination',()=>{assert.equal(availableTab({...base,account:{id:'mock'},disabledTabs:['research','v2']},'research',['research','v2']),null);});
test('clicking a locked tab retains a valid previous destination',()=>{const policy={...base,account:{id:'mock'},disabledTabs:['v2']};assert.equal(canUseTab(policy,'v2'),false);assert.equal(availableTab(policy,'research'),'research');});

 test('hidden NFL is unavailable to members but admins retain preview',async()=>{const {canUseSport}=await import('../src/site-access-core.js');const policy={requireLogin:false,disabledTabs:[],disabledSports:['nfl']};assert.equal(canUseSport(policy,'nfl'),false);assert.equal(canUseSport(policy,'mlb'),true);assert.equal(canUseSport({...policy,isAdmin:true},'nfl'),true);});
test('the Tennis Finder switch hides tennis for members but keeps admin preview',async()=>{const {canUseFinderSport,FINDER_SPORTS}=await import('../src/site-access-core.js');const policy={requireLogin:false,disabledTabs:[],disabledFinderSports:['tennis']};assert.ok(FINDER_SPORTS.includes('tennis'));assert.equal(canUseFinderSport(policy,'tennis'),false);assert.equal(canUseFinderSport(policy,'mlb'),true);assert.equal(canUseFinderSport({...policy,isAdmin:true},'tennis'),true);});

test('switched-off sections are hidden from members only, never from admins',async()=>{
 const {hiddenTabs}=await import('../src/site-access-core.js');
 const tabs=['research','finder','slip','community','saved'];
 const policy={...base,account:{id:'mock'},disabledTabs:['slip','community']};
 assert.deepEqual(hiddenTabs(policy,tabs),['slip','community']);
 assert.deepEqual(hiddenTabs({...policy,isAdmin:true},tabs),[]);
 // Nothing to hide for someone who can't open the site at all.
 assert.deepEqual(hiddenTabs({...policy,account:null},tabs),[]);
 assert.deepEqual(hiddenTabs(null,tabs),[]);
});
test('admin-only sections are for an admin session alone, whatever the switches say',async()=>{
 const {hiddenTabs,ADMIN_TABS}=await import('../src/site-access-core.js');
 assert.ok(ADMIN_TABS.includes('moneyline'));
 const member={...base,account:{id:'mock'}};
 assert.equal(canUseTab(member,'moneyline'),false);
 assert.equal(canUseTab({...member,isAdmin:true},'moneyline'),true);
 assert.deepEqual(hiddenTabs(member,['finder','moneyline']),['moneyline']);
 assert.equal(availableTab(member,'moneyline'),'finder');
});
test('a suspended member is signed in but let into nothing, admins never suspended',()=>{
 const policy={...base,account:{id:'mock'},suspended:true};
 assert.equal(accessGranted(policy),false);assert.equal(canUseTab(policy,'research'),false);
 assert.equal(accessGranted({...policy,isAdmin:true}),true);
});
