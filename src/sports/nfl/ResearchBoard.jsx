import React,{useEffect,useState} from 'react';
import {RefreshCw,ArrowUpRight,Shield} from 'lucide-react';
import {SheetSelect} from './ResearchSheet';
import {NFL_PROP_DEFINITIONS} from './props';
import {rankResearch,researchPlayer} from './research-board';

export function NFLResearchBoard({load,players,onOpen}) {
 const [rows,setRows]=useState([]),[events,setEvents]=useState([]),[progress,setProgress]=useState(null),[error,setError]=useState(''),[failed,setFailed]=useState(0),[refresh,setRefresh]=useState(0);
 const [position,setPosition]=useState(''),[game,setGame]=useState(''),[prop,setProp]=useState(''),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{
  let active=true;setRows([]);setError('');setFailed(0);setProgress({done:0,total:0});
  (async()=>{
   try {
    const listing=await load('prop-games');
    const upcoming=listing.data.filter(e=>Date.parse(e.startsAt)>Date.now()&&Date.parse(e.startsAt)<Date.now()+7*86400000);
    if(!active)return;setEvents(upcoming);setProgress({done:0,total:upcoming.length});
    let index=0;
    async function worker(){while(active&&index<upcoming.length){const event=upcoming[index++];try{const response=await load('research-board',{eventId:event.eventId});if(active)setRows(old=>[...old,...response.data.map(r=>({...r,injuryReportAvailable:response.injuryReportAvailable}))]);}catch{if(active)setFailed(n=>n+1);}finally{if(active){setNow(Date.now());setProgress(p=>({...p,done:p.done+1}));}}}}
    await Promise.all([worker(),worker(),worker()]);
   }catch{if(active)setError('Live props could not load. Refresh to try again.');}
   finally{if(active)setProgress(null);}
  })();return()=>{active=false;};
 },[load,refresh]);
 const ranked=rankResearch(rows,{position,game,prop,now});
 const labels=Object.fromEntries(NFL_PROP_DEFINITIONS.map(p=>[p.key,p.label]));
 return <section className="nfl-discovery" aria-label="NFL props board">
  <header><div><h2>NFL props</h2><p>PrizePicks · Next 7 days</p></div><button type="button" className="nfl-refresh" disabled={!!progress} aria-label="Refresh NFL props board" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={18}/></button></header>
  <div className="nfl-board-filters"><SheetSelect label="Position" value={position} onChange={e=>setPosition(e.target.value)}><option value="">Position</option>{['QB','RB','WR','TE'].map(p=><option key={p}>{p}</option>)}</SheetSelect><SheetSelect label="Game" value={game} onChange={e=>setGame(e.target.value)}><option value="">All games</option>{events.map(e=><option key={e.gameId} value={e.gameId}>{e.awayTeamId} @ {e.homeTeamId}</option>)}</SheetSelect><SheetSelect label="Prop" value={prop} onChange={e=>setProp(e.target.value)}><option value="">All props</option>{NFL_PROP_DEFINITIONS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</SheetSelect></div>
  <p className="nfl-board-caption">Sorted by sample-adjusted historical support. Hit rates describe past games at today's line.</p>
  <div role="status" className="nfl-board-caption">{progress?`Checking ${progress.done} of ${progress.total || '…'} games…`:`${ranked.length} props to research`}{failed>0&&` · ${failed} games could not load`}</div>
  {error&&<p role="alert">{error}</p>}
  {!progress&&!ranked.length&&!error&&<div className="nfl-chart-card">No fresh props match this view. Try another filter or refresh. Players remain available in Research.</div>}
  <div className="nfl-discovery-grid">{ranked.map(row=>{const player=researchPlayer(row,players);return <button type="button" className="nfl-discovery-card" key={`${row.gameId}.${row.playerId}.${row.propType}`} disabled={!player} onClick={()=>onOpen(player)}>
   <div className="nfl-discovery-identity">{player?.headshot_url&&<img src={player.headshot_url} width="58" height="58" loading="lazy" alt=""/>}<div><strong>{row.playerName}</strong><small>{row.position} · {row.teamId} vs {row.opponentId} · {new Date(row.startsAt).toLocaleDateString([],{weekday:'short'})}</small></div><ArrowUpRight size={18}/></div>
   <div className="nfl-discovery-line"><img src="/prizepicks/logo.png" width="22" height="22" alt="PrizePicks"/><strong>{row.line.direction==='OVER'?'More':'Less'} {row.line.value} {labels[row.propType]}</strong></div>
   <div className="nfl-discovery-stats"><span>Last {row.recentSample}<b>{row.recentHits}/{row.recentDecisions} hit</b></span><span>Sample<b>{row.hits}/{row.decisions} hit</b></span><span>Average<b>{Number(row.average.toFixed(1))}</b></span></div>
   {row.opponentVolume && <div className={`nfl-discovery-volume ${row.opponentVolume.score>=60?'good':row.opponentVolume.score<=40?'bad':''}`}><Shield size={14}/><span>{row.opponentVolume.label}: {row.opponentVolume.score}th percentile vs league</span></div>}
   <small className="nfl-board-caption">{row.seasons.join(' / ')} · {row.sample} games{row.pushes?` · ${row.pushes} pushes`:''} · {row.injuryReportAvailable?'Open research':'Injury report unavailable'}</small>
  </button>;})}</div>
 </section>;
}
