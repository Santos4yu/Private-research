import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('research cards omit long implementation explanations',()=>{
 const sources=['src/sports/tennis/TennisFinderContext.jsx','src/FinderTrendView.jsx','src/FinderPlayerBanner.jsx','src/UnifiedFinder.jsx'].map(read).join('\n');
 for(const phrase of ['margin removed','not a model prediction','Lines are live. Player context','Provider pregame moneylines']) assert.ok(!sources.includes(phrase),phrase);
 assert.ok(read('src/sports/nfl/SportResearch.jsx').includes('CC BY 4.0'));
});
test('tennis ring scales its inner label with its mobile size',()=>{
 assert.match(read('src/sports/tennis/tennis-context.css'),/\.tennis-matchup \.mlb-win-ring>span\{width:74%;height:74%\}/);
});
