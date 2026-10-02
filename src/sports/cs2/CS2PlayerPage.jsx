import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Trophy,Activity} from 'lucide-react';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import {FinderResearchTabs,FinderResearchCard as Card,RESEARCH_TABS} from '../../FinderResearchSections';
import {finderPlayerRows,normalizeFinderRows,patientRequest} from '../../unified-finder-data';
import {wnbaChart,wnbaLines,wnbaOdds} from '../wnba/trend-data';
import '../wnba/wnba-context.css';

export function cs2Stats(rows){
 return [...new Map(rows.map(row=>[row.marketKey,{key:row.marketKey,label:row.market,code:row.market}])).values()];
}

export function CS2PlayerPage({row,playerRows,onBack}){
 const [selected,setSelected]=useState(row),[fresh,setFresh]=useState(null),[tab,setTab]=useState('matchup');
 const host=useRef(null);
 useEffect(()=>{const controller=new AbortController();let cancelled=false;
  const refresh=()=>patientRequest('/api/board?view=cs2',{signal:controller.signal}).then(payload=>{
   if(cancelled)return;
   const offers=finderPlayerRows(normalizeFinderRows('cs2',payload),row);
   setFresh(offers);setSelected(current=>offers.find(r=>r.id===current.id)||offers.find(r=>r.marketKey===current.marketKey)||current);
  }).catch(()=>{});
  refresh();const timer=setInterval(refresh,120000);
  return()=>{cancelled=true;clearInterval(timer);controller.abort();};
 },[row.player,row.opponent,row.startsAt]);
 const offers=fresh??playerRows,stats=useMemo(()=>cs2Stats(offers),[offers]);
 const history=selected.raw?.history||selected.history;
 const games=history?.games||[];
 const config=useMemo(()=>({sport:'CS2',player:row.player,headshot:row.headshot,teamAbbr:row.teamAbbr,
  opponent:row.opponent,matchupLabel:`${row.teamAbbr||row.player} vs ${row.opponent||'—'}`,
  statKey:selected.marketKey,stat:selected.market,line:selected.line,side:'Over',status:'Pre-game',
  stats,postedRows:offers,chart:wnbaChart(games,selected.marketKey,row.opponent),lines:wnbaLines(offers,selected.marketKey),odds:wnbaOdds(offers,selected.marketKey),
  linesStatus:'ready',loading:false,filters:['opponent'],
  onStat:key=>{const next=offers.find(r=>r.marketKey===key&&r.modifier==='standard')||offers.find(r=>r.marketKey===key);if(next)setSelected(next);}
 }),[row,selected,offers,stats,history]);
 const latest=useRef(config);latest.current=config;
 useLayoutEffect(()=>{const panel=window.vortexTrendPanel;panel?.mount(host.current,latest.current);return()=>panel?.unmount();},[]);
 useLayoutEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
 const section=RESEARCH_TABS.find(([key])=>key===tab);
 return <section className="finder-trend-view wnba-trend-page wnba-player-page">
  <FinderPlayerBanner row={selected} playerRows={offers} onBack={onBack}/>
  <div className="mlb-finder-workspace"><div className="mlb-trend-main">
   <div className="wnba-trend-host finder-mlb-trend-host" ref={host}/>
   <Card title="Supporting stats" note="Last 10 matches" className="mlb-supporting"><div className="mlb-support-tabs">{stats.map(stat=>{
    const sample=games.filter(g=>Number.isFinite(g.values?.[stat.key])).slice(-10);
    return <button type="button" key={stat.key} aria-pressed={selected.marketKey===stat.key} onClick={()=>config.onStat(stat.key)}>{stat.label}<strong>{sample.length?(sample.reduce((sum,g)=>sum+g.values[stat.key],0)/sample.length).toFixed(1):'—'} <small>avg.</small></strong></button>;
   })}</div></Card>
   <Card title="Game log" className="mlb-player-gamelog">{games.some(g=>Number.isFinite(g.values?.[selected.marketKey]))?<div className="mlb-context-table-wrap" tabIndex={0} role="region" aria-label="CS2 game log"><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th><th scope="col">{selected.market}</th></tr></thead><tbody>{[...games].reverse().filter(g=>Number.isFinite(g.values?.[selected.marketKey])).slice(0,20).map(g=><tr key={g.gameId}><td>{g.date}</td><td>{g.opponent}</td><td>{g.values[selected.marketKey]}</td></tr>)}</tbody></table></div>:<p className="mlb-context-note">No match history available.</p>}
    {history?.source==='bo3'&&<a href="https://bo3.gg" target="_blank" rel="noreferrer" className="mlb-context-note">BO3</a>}
   </Card>
  </div><aside className="mlb-finder-context wnba-finder-context" data-tab={tab} aria-label="CS2 matchup research">
   <FinderResearchTabs tab={tab} onChange={setTab}/>
   {tab==='matchup'?<Card title="CS2 matchup" icon={Trophy} note={row.startsAt?new Date(row.startsAt).toLocaleString():''}>
    <div className="mlb-win-body"><div className="mlb-win-team"><strong>{row.teamAbbr||row.player}</strong><small>{row.player}</small></div><div className="mlb-win-team"><strong>{row.opponent||'—'}</strong></div></div>
   </Card>:<Card title={section?.[1]||'Research'} icon={section?.[2]||Activity}><p className="mlb-context-note">No data available.</p></Card>}
  </aside></div>
 </section>;
}
