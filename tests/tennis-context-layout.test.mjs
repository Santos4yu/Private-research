import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('tennis and basketball use the same research tab and card components',()=>{
 for(const path of ['src/sports/wnba/WNBAFinderContext.jsx','src/sports/tennis/TennisFinderContext.jsx']){
  const source=read(path);
  assert.match(source,/FinderResearchCard as Card/);
  assert.match(source,/<FinderResearchTabs tab=\{tab\} onChange=\{setTab\}/);
 }
 const tabs=read('src/FinderResearchSections.jsx');
 for(const label of ['Matchup','Defense','Shooting','Similar','Injuries','Rankings']) assert.ok(tabs.includes("'"+label+"'"));
});
test('shared trend host cannot grow over the research column',()=>{
 assert.match(read('src/mlb-finder-context.css'),/\.mlb-trend-main>\.wnba-trend-host\{[^}]*min-width:0[^}]*max-width:100%[^}]*overflow-x:auto/);
});
test('unposted historical stats cannot be saved as PrizePicks props',()=>{
 assert.match(read('app.js'),/button.hidden = !trendSave \|\| Boolean\(externalTrendConfig\?\.researchOnly\)/);
 assert.match(read('src/FinderTrendView.jsx'),/researchOnly:String\(selected.id\)/);
});
