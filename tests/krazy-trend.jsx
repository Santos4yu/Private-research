// Local-only visual fixture. All stats/quotes below are synthetic; production
// renderers, templates, styles and shared Select controls provide the actual UI.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../components/ui/select';
import { mountResearchTabs } from '../src/report-tabs.js';
import { createTrendCache, trendContextKey, gradeTrendChart, mergeTrendCharts } from '../src/trend-data.js';
import { finderMarket, historyChart, nameKey } from '../src/prop-finder-core.js';

const status = document.getElementById('fixture-status');
try {
  await initialize();
} catch (error) {
  status.textContent = `Preview failed: ${error.message}`;
  status.style.color = '#ff8f9c';
  console.error(error);
}

async function initialize() {
  const [html, app] = await Promise.all([
    fetch('/index.html').then(response => response.text()),
    fetch('/app.js').then(response => response.text()),
  ]);
  const template = new DOMParser().parseFromString(html, 'text/html');
  // Keep the same stylesheet cascade as the real entry point without running
  // its authentication/network startup. ?raw is a Vite JS string module.
  const rawMain = (await import('/src/main.jsx?raw')).default;
  const urls = [...template.querySelectorAll('link[rel="stylesheet"]')].map(link => new URL(link.getAttribute('href'), location.origin).href);
  for (const match of rawMain.matchAll(/import\s+['"](.+?\.css)['"]/g)) urls.push(new URL(match[1], `${location.origin}/src/`).href);
  const stylesReady = urls.map(href => new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href;
    link.onload = resolve; link.onerror = resolve;
    document.head.append(link);
  }));
  await Promise.all(stylesReady);

  const overlay = template.getElementById('gamelog-overlay').cloneNode(true);
  overlay.hidden = false;
  document.body.append(overlay);
  const report = template.getElementById('report-template').content.firstElementChild.cloneNode(true);
  const escapeHtml = text => String(text ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const extract = name => {
    let start = app.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`Production function missing: ${name}`);
    if (app.slice(start - 6, start) === 'async ') start -= 6;
    const end = app.indexOf('\n}', start);
    if (end < 0) throw new Error(`Production function is incomplete: ${name}`);
    return app.slice(start, end + 2);
  };
  const segment = (start, end) => {
    const from = app.indexOf(start), to = app.indexOf(end, from);
    if (from < 0 || to < 0) throw new Error(`Production section missing: ${start}`);
    return app.slice(from, to);
  };
  const prop = {
    player:'Shohei Ohtani', playerId:660271, teamId:119, team:'LAD', sport:'MLB', isTwoWay:true,
    side:'Over', line:1.5, betType:'Hits+Runs+RBIs', location:'LAD @ SF · Sample matchup',
    headshot:'https://img.mlbstatic.com/mlb-photos/image/upload/w_180/v1/people/660271/headshot/67/current',
    verdict:'Sample research', verdictDetail:'Synthetic stats: design preview', score:82, tier:'STRONG',
    matchup:{opponent:'SF',time:'Fri · 6:40 PM'}, gameTime:'2026-09-18T22:40:00Z',
  };
  new Function('escapeHtml', `${extract('fillHeader')};return fillHeader;`)(escapeHtml)(report, prop);
  report.querySelector('.rt-avatar-slot').innerHTML = `<img src="${prop.headshot}" alt="${prop.player}">`;
  report.querySelector('.score-num').textContent = '82';
  report.querySelector('.save-btn-label').textContent = 'Add to My Slip';
  report.querySelectorAll('[data-reveal],.report-block').forEach(block => block.classList.add('in'));
  report.querySelector('.save-btn').addEventListener('click', event => {
    const button = event.currentTarget;
    button.classList.toggle('saved');
    button.querySelector('.save-btn-label').textContent = button.classList.contains('saved') ? 'Sample saved' : 'Add to My Slip';
  });
  mountResearchTabs(report, prop);
  document.getElementById('fixture-report').append(report);
  report.querySelector('[data-research-tab="trend"]')?.click();
  const trendTab = [...report.querySelectorAll('[role="tab"]')].find(button => button.textContent.trim() === 'Trend');
  trendTab?.click();
  const els = Object.fromEntries([
    ['gamelogOverlay','gamelog-overlay'], ['gamelogTitle','gamelog-title'],
    ['gamelogTabs','gamelog-tabs'], ['gamelogSub','gamelog-sub'], ['gamelogChart','gamelog-chart'],
    ['gamelogOddsRow','gamelog-odds-row'], ['gamelogStatTabs','gamelog-stat-tabs'],
    ['gamelogLineValue','gamelog-line-value'], ['gamelogLineDown','gamelog-line-down'], ['gamelogLineUp','gamelog-line-up'],
    ['gamelogPropBadge','gamelog-prop-badge'], ['gamelogHandField','gl-hand-field'],
  ].map(([key,id]) => [key,document.getElementById(id)]));

  function SelectHost({controller, onPick, label, icon, postedLines}) {
    const [options,setOptions] = useState([]), [value,setValue] = useState(''), [disabled,setDisabled] = useState(false);
    const [status,setStatus] = useState('loading');
    controller.current = {setOptions,setValue,setDisabled,setStatus,
      setLines:rows=>setOptions(rows.map(row=>({value:String(row.value),label:String(row.value)})))};
    const ready = !postedLines || (status === 'ready' && options.length > 0);
    const selected = ready && options.some(option=>option.value===String(value)) ? String(value) : '';
    const placeholder = !postedLines ? 'All' : status === 'loading' ? 'Loading…' : status === 'error' ? 'Unavailable' : ready ? 'Lines' : 'No lines';
    return <Select key={postedLines ? status : 'filter'} value={selected} onValueChange={next => {setValue(next);onPick(next);}} disabled={disabled || !ready}>
      <SelectTrigger placeholder={placeholder} aria-label={label} icon={icon} aria-busy={postedLines && status==='loading'}/>
      <SelectContent>{(ready ? options : []).map((option,index) => <SelectItem key={option.value} index={index} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>;
  }
  function mountSelect(id, eventName, label, icon, postedLines=false) {
    const controller = {current:null};
    flushSync(() => createRoot(document.getElementById(id)).render(<SelectHost controller={controller} label={label} icon={icon} postedLines={postedLines} onPick={value => window.dispatchEvent(new CustomEvent(eventName,{detail:{value}}))}/>));
    return Object.fromEntries(['setOptions','setValue','setDisabled','setStatus','setLines'].map(name => [name, value => controller.current[name](value)]));
  }
  els.gamelogSeasonBridge = mountSelect('gamelog-season-select-root','vortex:gamelog-season-pick','Season');
  els.glHandFilterBridge = mountSelect('gamelog-hand-select-root','vortex:gamelog-hand-pick','Matchup');
  els.glVenueFilterBridge = mountSelect('gamelog-venue-select-root','vortex:gamelog-venue-pick','Location');
  const PrizePicksIcon = ({size=16}) => <img src="/prizepicks/logo.png" width={size} height={size} alt="PrizePicks"/>;
  const lines = mountSelect('gamelog-lines-select-root','vortex:gamelog-line-pick','PrizePicks lines',PrizePicksIcon,true);
  els.gamelogLinesBridge = lines;
  document.getElementById('gl-hand-field').hidden = false;

  const functions = ['snapPropLine','gameLogStatCode','regradeGameLog','syncGameLogContext','setGameLogPreviewLine',
    'captureGameLogViewport','restoreGameLogViewport','populateGameLogStats','renderGameLogBookOdds','filterGames',
    'renderGameLogSubfilters','windowStat','renderGameLogTabs','stabilizeGameLogLayout','formatGameLogDate',
    'renderGameLogChart','wireGameLogModal','recentGameLogSource','gameLogPool','setGameLogCount','setGameLogWindow',
    'loadGameLogStat','loadGameLogPostedLines','gamelogLineTier','pitcherFinderStat','requestGameLogDetails','loadGameLogBookOdds'];
  const program = [
    segment('const BATTER_STATS = [','const state = {'),
    segment('let gameLogState = {','function snapPropLine('),
    segment('const GAMELOG_STAT_CODES = {','function gameLogStatCode('),
    segment('const GAMELOG_ODDS_BOOKS = [','let gamelogBookOddsToken'),
    segment('const GL_HAND_PAIRS =','function renderGameLogSubfilters('),
    'let gameLogLayoutFrame=0,gameLogLayoutSignature="",activeFinderProp=null;',
    'let gamelogBookOddsRows=[],gamelogBookOddsToken=0,postedLinesToken=0,gamelogPostedLinesContext={};const API_SOURCE="/api/prediction";',
    ...functions.map(extract),
    'return {state:gameLogState,renderGameLogTabs,renderGameLogChart,populateGameLogStats,syncGameLogContext,wireGameLogModal,setGameLogWindow,loadGameLogStat,clearCustomLines:()=>gameLogCustomLines.clear()};',
  ].join('\n');

  let fixtureTime = Date.now();
  let sampleMode = 'normal';
  let failureMode = false;
  let failedRequests = new Set();
  let historyCache = createTrendCache(), feedCache = createTrendCache();
  const requests = [];
  const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const groupKey = row => `${nameKey(row.player)}|${finderMarket(row.stat)?.pitcher ? 'pitching' : 'hitting'}`;
  const cachedFinderHistory = row => historyCache.peek(groupKey(row));
  const openingLines = {'Hits+Runs+RBIs':2.5,'Runs Scored':0.5,'Strikeouts (Pitcher)':6.5,'Pitching Outs':17.5,'Hits Allowed':4.5};
  function rawPayload(group, mode=sampleMode) {
    const count = mode === 'empty' ? 0 : mode === 'dense' ? 180 : 24;
    const games = Array.from({length:count},(_,index) => {
      const date = new Date(Date.UTC(2026,8,17-count+index+1));
      return {date:date.toISOString().slice(0,10),opponent:{name:['SF','COL','MIA','SD'][index%4],id:[137,115,146,135][index%4]},
        isHome:index%3===0,stat:group==='pitching'
          ? {strikeOuts:[4,8,5,9,6,3][index%6],outs:[15,18,21,17,19,16][index%6],hits:[2,6,4,3,7,5][index%6],
              earnedRuns:index%4,baseOnBalls:index%3,inningsPitched:['5.0','6.0','7.0','5.2','6.1','5.1'][index%6],gamesStarted:1}
          : {hits:[0,1,2,1,0,3][index%6],runs:[1,1,0,1,2,0][index%6],rbi:[0,1,2,0,1,0][index%6],
              strikeOuts:index%3,baseOnBalls:index%2,doubles:index%4===0?1:0,triples:0,homeRuns:index%6===5?1:0}};
    });
    return {updatedAt:Date.now(),player:{id:prop.playerId},matchup:{opponent:{id:137,name:'SF'}},games,h2hLabel:'Synthetic sample vs SF'};
  }
  async function mockRequest(key, wait, payload, canFail=true) {
    const shouldFail = canFail && failureMode && !failedRequests.has(key);
    if (shouldFail) failedRequests.add(key);
    const request = {key,startedAt:performance.now(),status:'pending'};
    requests.push(request);
    await delay(wait);
    request.finishedAt = performance.now();
    request.status = shouldFail ? 'failed' : 'complete';
    updateStatus();
    if (shouldFail) throw new Error('Synthetic connection failure');
    return payload;
  }
  const requestFinderHistory = row => historyCache.request(groupKey(row), ()=>mockRequest(`history:${groupKey(row)}`,1000,rawPayload(finderMarket(row.stat)?.pitcher?'pitching':'hitting')));
  const requestFinderFeed = () => feedCache.request('feed', ()=>mockRequest('posted-lines',1800,sampleMode==='empty'?[]:
    Object.entries(openingLines).flatMap(([stat,line])=>[0,-1,1].map((offset,index)=>({player:prop.player,stat,line:Math.max(.5,line+offset),odds_type:['standard','goblin','demon'][index]}))),false));
  async function mockFetch(input) {
    const url = new URL(input,location.origin);
    const stat = url.searchParams.get('stat');
    let payload;
    if (url.pathname==='/api/game-log-filters') {
      payload=historyChart(rawPayload(finderMarket(stat)?.pitcher?'pitching':'hitting'),{stat,line:.5});
      for (const games of Object.values(payload)) if (Array.isArray(games)) games.forEach((game,index)=>{game.oppHand=index%3===0?'L':'R';});
      payload=await mockRequest(`details:${stat}`,1600,payload);
    } else if (url.pathname==='/api/prediction') {
      const center=openingLines[stat]||.5;
      payload=await mockRequest(`odds:${stat}`,700,{bookLines:sampleMode==='empty'?[]:[-2,-1,0,1,2].map(offset=>({line:Math.max(.5,center+offset),books:{
        draftkings:{over:-126,under:110},underdog:{over:-179,under:-117},betrivers:{over:-107,under:-107},fliff:{over:-145,under:-115},fanatics:{over:-140},
      }}))},false);
    } else throw new Error(`Unexpected fixture request: ${url.pathname}`);
    return {ok:true,json:async()=>payload};
  }
  const dependencies={els,escapeHtml,americanOdds:value=>Number(value)>0?`+${value}`:String(value),renderLineMovement:()=>{},
    createTrendCache:options=>createTrendCache({...options,now:()=>fixtureTime}),trendContextKey,gradeTrendChart,mergeTrendCharts,
    finderMarket,historyChart,nameKey,cachedFinderHistory,requestFinderHistory,requestFinderFeed,fetch:mockFetch};
  const engine=new Function(...Object.keys(dependencies),program)(...Object.values(dependencies));
  const state=engine.state;
  state.player=prop.player;state.opponent='SF';state.teamId=137;
  state.availableStats=['Hits+Runs+RBIs','Runs Scored','Strikeouts (Pitcher)','Pitching Outs','Hits Allowed'];
  document.getElementById('gamelog-player-cutout').innerHTML=`<img src="${prop.headshot}" alt="">`;
  document.getElementById('gamelog-market-matchup').textContent='LAD @ SF';
  document.getElementById('gamelog-market-time').textContent='Fri · 6:40 PM · Sample';
  document.getElementById('gamelog-matchup-logos').innerHTML=[119,137].map(id=>`<span><img src="https://www.mlbstatic.com/team-logos/${id}.svg" alt=""></span>`).join('');
  engine.populateGameLogStats();
  function updateStatus() {
    const pending=requests.filter(request=>request.status==='pending').length;
    status.textContent=`Synthetic ${sampleMode} sample · ${pending} pending requests · history 1s / details 1.6s / posted lines 1.8s. Pitching stats reuse one cached history.`;
  }
  function reloadSample({mode=sampleMode,fail=false,reset=false,dense=false}={}) {
    sampleMode=mode;failureMode=fail;failedRequests=new Set();
    fixtureTime+=600001;historyCache=createTrendCache();feedCache=createTrendCache();
    if(reset) {
      engine.clearCustomLines();
      state.season='all';state.handFilter='all';state.venueFilter='all';state.window='recent';state.windowKey='10';state.gameCount=10;
    }
    engine.loadGameLogStat(reset?'Hits+Runs+RBIs':state.stat).then(updateStatus);
    if(dense) engine.setGameLogWindow('season');
    updateStatus();
  }
  engine.wireGameLogModal();
  reloadSample({mode:'normal',reset:true});
  document.getElementById('fixture-reset').onclick=()=>reloadSample({mode:'normal',reset:true});
  document.getElementById('fixture-slow').onclick=()=>reloadSample();
  document.getElementById('fixture-failure').onclick=()=>reloadSample({mode:'normal',fail:true});
  document.getElementById('fixture-empty').onclick=()=>reloadSample({mode:'empty'});
  document.getElementById('fixture-dense').onclick=()=>reloadSample({mode:'dense',dense:true});
  // Cloned snapshots permit inspection without exposing mutation hooks.
  window.krazyTrendPreview=Object.freeze({get state(){return structuredClone(state);},get requests(){return structuredClone(requests);}});
}
