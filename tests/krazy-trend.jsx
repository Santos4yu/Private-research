// Local-only visual fixture. All stats/quotes below are synthetic; production
// renderers, templates, styles and shared Select controls provide the actual UI.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../components/ui/select';
import { mountResearchTabs } from '../src/report-tabs.js';

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
    const start = app.indexOf(`function ${name}(`);
    if (start < 0) throw new Error(`Production function missing: ${name}`);
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
    player:'Fernando Tatis Jr.', playerId:665487, teamId:135, team:'SD', sport:'MLB',
    side:'Over', line:1.5, betType:'Hits+Runs+RBIs', location:'SD @ MIA · Sample matchup',
    headshot:'https://img.mlbstatic.com/mlb-photos/image/upload/w_180/v1/people/665487/headshot/67/current',
    verdict:'Sample research', verdictDetail:'Synthetic stats: design preview', score:82, tier:'STRONG',
    matchup:{opponent:'MIA',time:'Fri · 6:40 PM'}, gameTime:'2026-09-18T22:40:00Z',
  };
  new Function('escapeHtml', `${extract('fillHeader')};return fillHeader;`)(escapeHtml)(report, prop);
  report.querySelector('.rt-avatar-slot').innerHTML = `<img src="${prop.headshot}" alt="Fernando Tatis Jr.">`;
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
  ].map(([key,id]) => [key,document.getElementById(id)]));

  function SelectHost({controller, onPick, label, icon}) {
    const [options,setOptions] = useState([]), [value,setValue] = useState(''), [disabled,setDisabled] = useState(false);
    controller.current = {setOptions,setValue,setDisabled};
    return <Select value={value} onValueChange={next => {setValue(next);onPick(next);}} disabled={disabled}>
      <SelectTrigger placeholder="All" aria-label={label} icon={icon}/>
      <SelectContent>{options.map((option,index) => <SelectItem key={option.value} index={index} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
    </Select>;
  }
  function mountSelect(id, eventName, label, icon) {
    const controller = {current:null};
    flushSync(() => createRoot(document.getElementById(id)).render(<SelectHost controller={controller} label={label} icon={icon} onPick={value => window.dispatchEvent(new CustomEvent(eventName,{detail:{value}}))}/>));
    return Object.fromEntries(['setOptions','setValue','setDisabled'].map(name => [name, value => controller.current[name](value)]));
  }
  els.gamelogSeasonBridge = mountSelect('gamelog-season-select-root','vortex:gamelog-season-pick','Season');
  els.glHandFilterBridge = mountSelect('gamelog-hand-select-root','vortex:gamelog-hand-pick','Matchup');
  els.glVenueFilterBridge = mountSelect('gamelog-venue-select-root','vortex:gamelog-venue-pick','Location');
  const PrizePicksIcon = ({size=16}) => <img src="/prizepicks/logo.png" width={size} height={size} alt="PrizePicks"/>;
  const lines = mountSelect('gamelog-lines-select-root','vortex:gamelog-line-pick','PrizePicks lines',PrizePicksIcon);
  els.gamelogLinesBridge = lines;
  document.getElementById('gl-hand-field').hidden = false;

  const functions = ['snapPropLine','gameLogStatCode','regradeGameLog','syncGameLogContext','setGameLogPreviewLine',
    'captureGameLogViewport','restoreGameLogViewport','populateGameLogStats','renderGameLogBookOdds','filterGames',
    'renderGameLogSubfilters','windowStat','renderGameLogTabs','stabilizeGameLogLayout','formatGameLogDate',
    'renderGameLogChart','wireGameLogModal','recentGameLogSource','gameLogPool','setGameLogCount','setGameLogWindow'];
  const program = [
    segment('let gameLogState = {','function snapPropLine('),
    segment('const GAMELOG_STAT_CODES = {','function gameLogStatCode('),
    segment('const GAMELOG_ODDS_BOOKS = [','let gamelogBookOddsToken'),
    segment('const GL_HAND_PAIRS =','function renderGameLogSubfilters('),
    'let gameLogLayoutFrame=0,gameLogLayoutSignature="",activeFinderProp=null;',
    'let gamelogBookOddsRows=[];const gamelogPostedLinesContext={};',
    ...functions.map(extract),
    'return {state:gameLogState,renderGameLogTabs,renderGameLogChart,populateGameLogStats,syncGameLogContext,regradeGameLog,wireGameLogModal,setGameLogPreviewLine,setGameLogWindow,renderGameLogBookOdds,setOdds:rows=>{gamelogBookOddsRows=rows;}};',
  ].join('\n');
  const engine = new Function('els','escapeHtml','americanOdds','loadGameLogStat','renderLineMovement',program)(els,escapeHtml,value=>Number(value)>0?`+${value}`:String(value),stat=>setSample(stat),()=>{});
  const state = engine.state;
  const defaultGameCount = state.gameCount;
  let sampleMode = 'normal';
  const values = [1,3,0,2,4,1,3,5,2,0,4,2,3,1,0,4,2,1,3,5,2,4,4,1];
  function sampleGames(stat) {
    if (sampleMode === 'empty') return [];
    const count = sampleMode === 'dense' ? 180 : values.length;
    return Array.from({length:count},(_,index) => {
      const date = new Date(Date.UTC(2026,8,17-count+index+1));
      const value = stat === 'Runs Scored' ? [1,1,0,1,2,0,1,1][index%8] : values[index%values.length];
      return {fullDate:date.toISOString().slice(0,10),season:2026,opponent:['SF','COL','MIA','LAD'][index%4],
        opponentTeamId:[137,115,146,119][index%4],isHome:index%3===0,oppHand:index%3===0?'L':'R',value,over:value>state.line};
    });
  }
  function setSample(stat='Hits+Runs+RBIs') {
    state.player = prop.player; state.stat = stat; state.isPitcher = false;
    state.availableStats = ['Hits+Runs+RBIs','Runs Scored'];
    state.line = stat === 'Runs Scored' ? 0.5 : 1.5;
    state.season = 'all'; state.handFilter = 'all'; state.venueFilter = 'all'; state.window = 'recent';
    state.windowKey = String(defaultGameCount); state.gameCount = defaultGameCount; state.animationDirection = 'none';
    const all = sampleGames(stat);
    state.chart = {all,l5:all.slice(-5),l10:all.slice(-10),l20:all.slice(-20),h2h:all.filter(game=>game.opponent==='MIA')};
    state.opponent='MIA'; state.teamId=146;
    engine.setOdds([0.5,1.5,2.5,3.5,4.5].map(line => ({line,books:{
      prizepicks:{over:-119,under:-119},draftkings:{over:-126,under:110},underdog:{over:-179,under:-117},
      betrivers:{over:-107,under:-107},fliff:{over:-145,under:-115},fanatics:{over:-140},
    }})));
    lines.setOptions([0.5,1.5,2.5,3.5,4.5].map(line=>({value:String(line),label:String(line)})));
    lines.setValue(String(state.line));
    document.getElementById('gamelog-title').textContent=prop.player;
    document.getElementById('gamelog-prop-badge').textContent=stat==='Runs Scored'?'R':'HRR';
    document.getElementById('gamelog-player-cutout').innerHTML=`<img src="${prop.headshot}" alt="">`;
    document.getElementById('gamelog-market-matchup').textContent='SD @ MIA';
    document.getElementById('gamelog-market-time').textContent='Fri · 6:40 PM · Sample';
    document.getElementById('gamelog-matchup-logos').innerHTML=[135,146].map(id=>`<span><img src="https://www.mlbstatic.com/team-logos/${id}.svg" alt=""></span>`).join('');
    els.gamelogLineValue.textContent=state.line.toFixed(1);
    engine.syncGameLogContext({matchup:'SD @ MIA · Fri 6:40 PM · Sample'});
    engine.populateGameLogStats(); engine.regradeGameLog(state.line);
    engine.renderGameLogTabs(); engine.renderGameLogChart(); engine.renderGameLogBookOdds();
    status.textContent=`Ready · ${all.length} synthetic games · production chart, window/line handlers, and shared dropdowns.`;
  }
  engine.wireGameLogModal();
  setSample();
  document.getElementById('fixture-reset').onclick=()=>{sampleMode='normal';setSample();};
  document.getElementById('fixture-empty').onclick=()=>{sampleMode='empty';setSample(state.stat);};
  document.getElementById('fixture-dense').onclick=()=>{sampleMode='dense';setSample(state.stat);engine.setGameLogWindow('season');};
  // Convenient read-only inspection for browser layout QA.
  window.krazyTrendPreview={state,report,overlay};
}
