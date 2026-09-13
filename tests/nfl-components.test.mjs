import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';

test('NFL research components render controls and supported outputs without production gate clutter',async()=>{
 const server=await createServer({server:{middlewareMode:true,hmr:false},logLevel:'error'});
 try {
  const {NFLTrendPanel}=await server.ssrLoadModule('/src/sports/nfl/TrendPanel.jsx');
  const prop={key:'passing_yards',label:'Passing Yards'};
  const logs=[{game_id:'mock-only',season:2025,week:1,team_id:'PIT',opponent_team_id:'ATL',is_home:true,stats:{passing_yards:210,attempts:30}}];
  const html=renderToStaticMarkup(React.createElement(NFLTrendPanel,{logs,selectedProp:prop,usage:[]}));
  for(const control of ['Comparison line','Filters','Include / exclude individual games','Number of games','L5','L20','More','Less'])assert.ok(html.includes(control),control);
  assert.ok(!html.includes('Production gate'));assert.ok(html.includes('210'));
  const {NFLProjectionPanel}=await server.ssrLoadModule('/src/sports/nfl/ProjectionPanel.jsx');
  assert.equal(renderToStaticMarkup(React.createElement(NFLProjectionPanel,{resource:{data:{propType:'passing_yards',promotion:'DISABLED',projectionMean:300}},selectedProp:prop})), '');
  const supported=renderToStaticMarkup(React.createElement(NFLProjectionPanel,{resource:{data:{propType:'passing_yards',promotion:'EXPERIMENTAL',projectionMean:210,status:'LOW_CONFIDENCE',opportunityInputs:{expectedPassAttempts:{mean:30}},efficiencyInputs:{missing:null},modelVersion:'MOCK_TEST_ONLY'}},selectedProp:prop}));
  assert.ok(supported.includes('Beta estimate'));assert.ok(supported.includes('Expected pass attempts'));assert.ok(!supported.includes('TAKE'));
  const {NFLMarketLines}=await server.ssrLoadModule('/src/sports/nfl/MarketLines.jsx');
  const market=renderToStaticMarkup(React.createElement(NFLMarketLines,{load:()=>Promise.resolve({data:[]}),player:{id:'mock-only'},prop:'passing_yards',onSelect:()=>{}}));
  const {SheetSelect}=await server.ssrLoadModule('/src/sports/nfl/ResearchSheet.jsx');
  const picker=renderToStaticMarkup(React.createElement(SheetSelect,{value:'home',label:'Location'},React.createElement('option',{value:'home'},'Home')));
  assert.ok(picker.includes('aria-haspopup="dialog"'));assert.ok(!picker.includes('<select'));assert.ok(picker.includes('Home'));
  assert.ok(!market.includes('<select'));assert.ok(!market.includes('More 212.5'));
  const {NFLMatchupPanel}=await server.ssrLoadModule('/src/sports/nfl/MatchupPanel.jsx');
  const matchup=renderToStaticMarkup(React.createElement(NFLMatchupPanel,{selectedProp:prop,resource:{data:{components:{defenseQuality:{score:0,contributors:[]}},matchupQuality:0,dataCoverage:40}}}));
  assert.ok(matchup.includes('Matchup score'));assert.ok(matchup.includes('Very difficult'));assert.ok(!matchup.split('</article>')[0].includes('NOT AVAILABLE'));
  assert.ok(matchup.includes('Matchup certainty NOT AVAILABLE')); // Missing certainty stays missing in the expanded methodology.
  const volume=renderToStaticMarkup(React.createElement(NFLMatchupPanel,{selectedProp:prop,resource:{data:{components:{},opponentVolume:{score:50,value:30,leagueMean:30,games:17,teams:32}}}}));
  assert.ok(volume.includes('Opponent volume'));assert.ok(volume.includes('Historical percentile'));assert.ok(!volume.includes('Matchup score'));
  assert.ok(market.includes('PrizePicks'));assert.ok(market.includes('Goblins'));assert.ok(market.includes('Demons'));assert.ok(market.includes('Loading lines'));
 }finally{await server.close();}
});
