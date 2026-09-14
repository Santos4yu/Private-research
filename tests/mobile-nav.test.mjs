import test from 'node:test';
import assert from 'node:assert/strict';
import {dockHiddenAt} from '../src/mobile-nav-core.js';
test('dock hides after leaving top and stays hidden while scrolling either way',()=>{
 let hidden=false;
 for(const y of [19,20,21,20,150,140,8,3]){hidden=dockHiddenAt(y,hidden);assert.equal(hidden,true);}
 assert.equal(dockHiddenAt(0,hidden),false);
});
test('top tolerance avoids twitching and handles iOS overscroll',()=>{
 assert.equal(dockHiddenAt(10,false),false);
 assert.equal(dockHiddenAt(2,true),false);
 assert.equal(dockHiddenAt(-30,true),false);
});
