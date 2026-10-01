import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Database } from 'lucide-react';
import MLBFinderContext from './MLBFinderContext';
import MLBSupportingStats from './MLBSupportingStats';
import MLBPlayerGameLog from './MLBPlayerGameLog';
import { FinderPlayerBanner } from './FinderPlayerBanner';
import { NFLPlayerPage } from './sports/nfl/NFLPlayerPage';
import {loadTennisHistory,loadTennisContext,tennisOpponentMatches} from './unified-finder-data';
import {wnbaChart,wnbaLines,wnbaOdds} from './sports/wnba/trend-data';
import TennisFinderContext from './sports/tennis/TennisFinderContext';
import {TENNIS_MARKET_TABS} from './sports/tennis/tennis-research';
import './sports/wnba/wnba-context.css';

function TennisTrends({row,playerRows,onBack}) {
  const host=useRef(null), [selected,setSelected]=useState(row), [data,setData]=useState(null), [loading,setLoading]=useState(true), [error,setError]=useState('');
  const [support,setSupport]=useState('totalgames');
  const [context,setContext]=useState(null);
  useEffect(()=>{const controller=new AbortController();setContext(null);loadTennisContext(row,{signal:controller.signal}).then(setContext).catch(e=>{if(e.name!=='AbortError')setContext({message:'Current matchup details could not load; historical data remains available.'});});return()=>controller.abort();},[row.player,row.opponent,row.startsAt]);
  useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');setData(null);
    loadTennisHistory(row.player,{signal:controller.signal}).then(setData).catch(e=>{if(e.name!=='AbortError')setError('Match history could not load. Refresh to retry.');}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();},[row.player]);
  const games=context?.players?.[0]?.games||data?.games||[];
  const opponent=String(row.opponent||'').replace(/\s+1st Set.*$/i,'');
  const config=useMemo(()=>({sport:'TENNIS',player:row.player,headshot:row.headshot,opponent,
    matchupLabel:`${row.player} vs ${opponent}`,statKey:selected.marketKey,stat:selected.market,line:selected.line,
    side:selected.direction==='UNDER'?'Under':'Over',status:'Pre-game',kickoffLabel:row.startsAt?new Date(row.startsAt).toLocaleString():'',
    stats:TENNIS_MARKET_TABS,
    chart:wnbaChart(games.map(game=>({...game,opponent:tennisOpponentMatches(game.opponent,opponent)?opponent:game.opponent})),selected.marketKey,opponent),lines:wnbaLines(playerRows,selected.marketKey),
    odds:wnbaOdds(playerRows,selected.marketKey),linesStatus:'ready',loading,filters:['opponent'],researchOnly:String(selected.id).startsWith('research:'),
    onStat:key=>{const next=playerRows.find(item=>item.marketKey===key);if(next)setSelected(next);else{const stat=TENNIS_MARKET_TABS.find(item=>item.key===key),values=games.map(game=>game.values?.[key]).filter(Number.isFinite);if(stat)setSelected({...row,id:`research:${key}`,marketKey:key,market:stat.label,line:values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:0,apps:[],modifier:null});}}}),[row,selected,playerRows,data,context,loading,opponent]);
  const latest=useRef(config);latest.current=config;
  useEffect(()=>{const panel=window.vortexTrendPanel;panel?.mount(host.current,latest.current);return()=>panel?.unmount();},[]);
  useEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
  return <section className="finder-trend-view wnba-trend-page wnba-player-page">
    <FinderPlayerBanner row={selected} playerRows={playerRows} onBack={onBack}/>
    <div className="mlb-finder-workspace"><div className="mlb-trend-main">
      <div className="wnba-trend-host finder-mlb-trend-host" ref={host}/>
      {error&&<p className="mlb-context-note" role="status">{error}</p>}
      {String(selected.id).startsWith('research:')&&<p className="mlb-context-note">Research-only stat. The adjustable comparison starts at the historical average; it is not a posted PrizePicks line.</p>}
      <section className="mlb-context-card mlb-supporting"><header><h2>Supporting stats</h2><small>Last 10 matches</small></header>
        <div className="mlb-support-tabs">{[['totalgames','Total Games'],['totalsets','Total Sets'],['aces','Aces'],['doublefaults','Double Faults']].map(([key,label])=>{const sample=games.slice(-10).map(g=>g.values[key]).filter(Number.isFinite);return <button type="button" key={key} aria-pressed={support===key} onClick={()=>setSupport(key)}>{label}<strong>{sample.length?(sample.reduce((a,b)=>a+b,0)/sample.length).toFixed(1):'—'} <small>avg.</small></strong></button>;})}</div>
        <div className="mlb-support-chart">{games.slice(-10).map(game=>{const value=game.values[support],max=Math.max(1,...games.slice(-10).map(g=>g.values[support]).filter(Number.isFinite));return <div key={game.gameId}><div className="mlb-support-track"><div style={{height:Number.isFinite(value)?`${value/max*100}%`:'0%'}}><span>{value??'—'}</span></div></div><small>{new Date(game.date).toLocaleDateString([],{month:'numeric',day:'numeric'})}<br/>{game.opponent}</small></div>;})}</div>
      </section>
      <section className="mlb-context-card mlb-player-gamelog"><header><h2>Game log · Last 15 matches</h2><small>{data?.updatedAt?'Updated '+new Date(data.updatedAt).toLocaleDateString():row.player}</small></header>
        <div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label="Tennis match statistics; scroll for more columns"><table><thead><tr><th>Date</th><th>Opponent</th><th>Result</th><th>Score</th><th>Surface</th>{[['totalgameswon','GW'],['totalgames','Games'],['aces','Aces'],['doublefaults','DF'],['fantasyscore','FP']].map(([key,label])=><th key={key}>{label}</th>)}</tr></thead><tbody>{games.slice(-15).reverse().map(game=><tr key={game.gameId}><td>{new Date(game.date).toLocaleDateString()}</td><td>{game.opponent}</td><td>{game.result}</td><td>{game.score}</td><td>{game.surface||'—'}</td>{['totalgameswon','totalgames','aces','doublefaults','fantasyscore'].map(key=><td key={key}>{game.values[key]??'—'}</td>)}</tr>)}</tbody></table></div>
      </section>
    </div><TennisFinderContext row={selected} games={games} playerRows={playerRows} loading={loading} context={context}/></div>
  </section>;
}

function MLBTrends({ row, playerRows, onBack }) {
  const host = useRef(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const panel = window.vortexTrendPanel;
    setAvailable(Boolean(panel?.mountMlb(host.current, row)));
    return () => panel?.unmount();
  }, [row]);
  return <section className="finder-trend-view wnba-trend-page">
    <FinderPlayerBanner row={row} playerRows={playerRows} onBack={onBack} />
    {!available && <div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true" /><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}
    <div className="mlb-finder-workspace"><div className="mlb-trend-main"><div className="wnba-trend-host finder-mlb-trend-host" ref={host} /><MLBSupportingStats key={row.id} row={row}/><MLBPlayerGameLog key={`log-${row.id}`} row={row}/></div><MLBFinderContext key={row.id} row={row}/></div>
  </section>;
}

// This host never dispatches navigation events or changes the URL. Closing
// it returns to the same sport, filters and page in the unified Finder.
// NFL uses the WNBA/MLB player page layout (sports/nfl/NFLPlayerPage.jsx).
export function FinderTrendView({ row, playerRows, onBack }) {
  if (row.sport === 'tennis') return <TennisTrends row={row} playerRows={playerRows} onBack={onBack}/>;
  return String(row.sport).toLowerCase() === 'nfl'
    ? <NFLPlayerPage row={row} playerRows={playerRows} onBack={onBack} />
    : <MLBTrends row={row} playerRows={playerRows} onBack={onBack} />;
}
