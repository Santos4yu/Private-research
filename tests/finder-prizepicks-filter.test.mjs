import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesPrizePicksLine} from '../src/unified-finder-data.js';
test('All and Regular require a PrizePicks line; comparison books stay attached',()=>{
 const bookOnly={modifier:'standard',apps:[{key:'draftkings'}]};
 assert.equal(matchesPrizePicksLine(bookOnly),false);
 assert.equal(matchesPrizePicksLine(bookOnly,['standard']),false);
 const pp={modifier:'standard',apps:[{key:'prizepicks'},{key:'draftkings'}]};
 assert.equal(matchesPrizePicksLine(pp,['standard']),true);
 assert.equal(pp.apps.length,2);
 assert.equal(matchesPrizePicksLine({...pp,modifier:'goblin'},['standard']),false);
 assert.equal(matchesPrizePicksLine({...pp,modifier:'goblin'},['goblin']),true);
});
