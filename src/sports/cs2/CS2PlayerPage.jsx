import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Trophy,Map as MapIcon,User,ChartPie,ListOrdered} from 'lucide-react';
import {FinderPlayerLayout} from '../../FinderPlayerLayout';
import {FinderResearchCard as Card} from '../../FinderResearchSections';
import {finderPlayerRows,normalizeFinderRows,patientRequest} from '../../unified-finder-data';
import {wnbaChart,wnbaLines,wnbaOdds} from '../wnba/trend-data';
import '../wnba/wnba-context.css';
import {researchData,shortDate,CS2_STATS,cs2Selection,cs2Sample,cs2Coverage} from './research-data';
import './cs2-context.css';
import {useTrendPanel} from '../../trend-panel.js';
export const CS2_TABS=[['matchup','Matchup',Trophy],['maps','Maps',MapIcon],['stats','Player Stats',User],['odds','Prop Odds',ChartPie],['form','Recent Form',ListOrdered]];

function MapSummary({maps}){
 const grouped=new Map();
 for(const m of maps){const key=m.map.toLowerCase();if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(m);}
 const avg=(rows,field)=>{const valid=rows.filter(r=>Number.isFinite(r[field]));return valid.length?(valid.reduce((n,r)=>n+r[field],0)/valid.length).toFixed(1):'—';};
 return <Card title="Map performance" note={`${maps.length} recorded maps`}><div className="cs2-map-list">{[...grouped].sort((a,b)=>b[1].length-a[1].length).map(([name,rows])=><article className="cs2-map-card" key={name}><header><strong>{name.charAt(0).toUpperCase()+name.slice(1)}</strong><small>{rows.length} maps</small></header><dl><div><dt>Kills</dt><dd>{avg(rows,'kills')}</dd></div><div><dt>Headshots</dt><dd>{avg(rows,'headshots')}</dd></div><div><dt>Deaths</dt><dd>{avg(rows,'deaths')}</dd></div></dl></article>)}</div>{!maps.length&&<p className="mlb-context-note">Map records unavailable.</p>}</Card>;
}

function Results({games,statKey,label}){
 return games.length?<div className="mlb-context-table-wrap" tabIndex={0} role="region" aria-label={label}><table><thead><tr><th>Date</th><th>Opponent</th><th>{label}</th></tr></thead><tbody>{games.map(g=><tr key={g.gameId}><td>{shortDate(g.date)}</td><td>{g.opponent}</td><td>{Number.isFinite(g.values?.[statKey])?g.values[statKey]:<span className="cs2-missing-value">Unavailable</span>}</td></tr>)}</tbody></table></div>:<p className="mlb-context-note">No recorded matches for this map scope.</p>;
}
export function CS2Research({tab,row,selected,games,offers=[]}){
 const data=researchData(games,selected.marketKey,selected.line,row.opponent,row.startsAt);
 const fmt=n=>Number.isFinite(n)?n.toFixed(1):'—';
 if(tab==='maps')return <MapSummary maps={data.maps}/>;
 if(tab==='form')return <Card title="Recent results" note="Last 15 series"><Results games={data.results} statKey={selected.marketKey} label={selected.market}/></Card>;
 if(tab==='odds')return <Card title="Posted prop lines" note={selected.market}><div className="mlb-context-table-wrap"><table><thead><tr><th>App</th><th>Line</th><th>Over</th><th>Under</th></tr></thead><tbody>{offers.filter(o=>o.marketKey===selected.marketKey).flatMap(o=>(o.apps||[]).map(app=><tr key={`${o.id}:${app.key}`}><td>{app.name||app.key}{o.modifier&&o.modifier!=='standard'?` · ${o.modifier}`:''}</td><td>{o.line}</td><td>{app.over==null?'More':app.over>0?`+${app.over}`:app.over}</td><td>{app.under==null?'Less':app.under>0?`+${app.under}`:app.under}</td></tr>))}</tbody></table></div></Card>;
 if(tab==='stats')return <><Card title="Player Stats" note={`${data.maps.length} recorded maps`}><div className="mlb-support-tabs">{[['Kills / map',data.average('kills')],['Headshots / map',data.average('headshots')],['Deaths / map',data.average('deaths')],['Assists / map',data.average('assists')],['K/D',data.kd],['Headshot %',data.hs]].map(([label,value])=><div key={label}>{label}<strong>{fmt(value)}</strong></div>)}</div></Card><MapSummary maps={data.maps}/></>;
 if(tab==='defense')return <Card title="Opponent results" note={row.opponent}><Results games={data.results} statKey={selected.marketKey} label={selected.market}/></Card>;
 if(tab==='shooting')return <><Card title="Player performance" note={`${data.maps.length} recorded maps`}><div className="mlb-support-tabs">{[['Kills / map',data.average('kills')],['Headshots / map',data.average('headshots')],['Deaths / map',data.average('deaths')],['Assists / map',data.average('assists')],['K/D',data.kd],['Headshot %',data.hs]].map(([label,value])=><div key={label}>{label}<strong>{fmt(value)}</strong></div>)}</div></Card><Card title="Map stats"><div className="mlb-context-table-wrap"><table><thead><tr><th>Map</th><th>Kills</th><th>Deaths</th><th>HS</th></tr></thead><tbody>{data.maps.map(m=><tr key={`${m.gameId}:${m.number}`}><td>{m.map} · M{m.number}</td><td>{m.kills??'—'}</td><td>{m.deaths??'—'}</td><td>{m.headshots??'—'}</td></tr>)}</tbody></table></div></Card></>;
 if(tab==='similar')return <Card title="Head-to-head" note={row.opponent}><Results games={data.h2h} statKey={selected.marketKey} label={selected.market}/></Card>;
 if(tab==='injuries')return <Card title="Roster status"><p className="mlb-context-note">No confirmed roster updates.</p></Card>;
 if(tab==='rankings')return <Card title="Team rankings"><p className="mlb-context-note">Rankings unavailable.</p></Card>;
 return <Card title="CS2 matchup" icon={Trophy} note={row.startsAt?new Date(row.startsAt).toLocaleString():''}><div className="mlb-win-body"><div className="mlb-win-team"><strong>{row.teamAbbr||row.player}</strong><small>{row.player}</small></div><div className="mlb-win-team"><strong>{row.opponent||'—'}</strong></div></div><Results games={data.h2h} statKey={selected.marketKey} label={selected.market}/></Card>;
}

export function cs2Stats(rows){
 return [...new Map([...CS2_STATS,...rows.map(row=>({key:row.marketKey,label:row.market,code:row.market}))].map(stat=>[stat.key,stat])).values()];
}

export function CS2PlayerPage({row,playerRows,onBack}){
 const [selected,setSelected]=useState(row),[fresh,setFresh]=useState(null);
 const host=useRef(null);
 useEffect(()=>{const controller=new AbortController();let cancelled=false;
  const refresh=()=>patientRequest('/api/board?view=cs2',{signal:controller.signal}).then(payload=>{
   if(cancelled)return;
   const offers=finderPlayerRows(normalizeFinderRows('cs2',payload),row);
   setFresh(offers);setSelected(current=>offers.find(r=>r.id===current.id)||offers.find(r=>r.marketKey===current.marketKey)||{...current,raw:offers[0]?.raw||current.raw});
  }).catch(()=>{});
  refresh();const timer=setInterval(refresh,120000);
  return()=>{cancelled=true;clearInterval(timer);controller.abort();};
 },[row.player,row.opponent,row.startsAt]);
 const offers=fresh??playerRows,stats=useMemo(()=>cs2Stats(offers),[offers]);
 const history=selected.raw?.history||selected.history;
 const games=history?.games||[];
 const coverage=cs2Coverage(games,selected.marketKey);
 const config=useMemo(()=>({sport:'CS2',player:row.player,headshot:row.headshot,teamAbbr:row.teamAbbr,
  opponent:row.opponent,matchupLabel:`${row.teamAbbr||row.player} vs ${row.opponent||'—'}`,
  statKey:selected.marketKey,stat:selected.market,line:selected.line,side:'Over',status:'Pre-game',
  stats,postedRows:offers,chart:wnbaChart(games,selected.marketKey,row.opponent),lines:wnbaLines(offers,selected.marketKey),odds:wnbaOdds(offers,selected.marketKey),
  linesStatus:'ready',loading:false,filters:['opponent'],researchOnly:String(selected.id).startsWith('research:'),
  onStat:key=>{const next=cs2Selection(offers,key,row,games);if(next)setSelected(next);}
 }),[row,selected,offers,stats,history]);
 useTrendPanel(host,config);
 const supporting=<Card title="Supporting stats" note="Last 10 matches" className="mlb-supporting"><div className="mlb-support-tabs">{stats.map(stat=>{
    const played=cs2Sample(games,stat.key,10),sample=played.filter(g=>Number.isFinite(g.values?.[stat.key]));
    return <button type="button" key={stat.key} aria-pressed={selected.marketKey===stat.key} onClick={()=>config.onStat(stat.key)}>{stat.label}<strong>{sample.length?(sample.reduce((sum,g)=>sum+g.values[stat.key],0)/sample.length).toFixed(1):'—'} <small>avg.</small></strong><small>{sample.length} / {played.length} recorded</small></button>;
   })}</div></Card>;
 const gamelog=<Card title="Game log" className="mlb-player-gamelog"><Results games={researchData(games,selected.marketKey,selected.line,row.opponent,row.startsAt).results} statKey={selected.marketKey} label={selected.market}/>
    {history?.source==='bo3'&&<a href="https://bo3.gg" target="_blank" rel="noreferrer" className="mlb-context-note">BO3</a>}
   </Card>;
 return <FinderPlayerLayout row={selected} playerRows={offers} onBack={onBack} className="cs2-player-page"
  chart={<>   <div className="wnba-trend-host finder-mlb-trend-host" ref={host}/>
   <div className="cs2-coverage" role="status" aria-live="polite" aria-atomic="true"><strong>{coverage.recorded} / {coverage.played} recorded results</strong><span>{coverage.missing?`${coverage.missing} missing · Rates use recorded results only`:'In saved history · Only played maps count'}{history?.coverage?.listingComplete===false?' · Older history incomplete':''}</span></div>
   {String(selected.id).startsWith('research:')&&<p className="mlb-context-note">Research only · No posted line · Comparison based on recent average.</p>}</>}
  his={[['log','Game log',gamelog],['stats','Stats',supporting]]}
  research={CS2_TABS} renderResearch={tab=><aside className="mlb-finder-context wnba-finder-context" data-tab={tab} aria-label="CS2 matchup research">
   <CS2Research tab={tab} row={row} selected={selected} games={games} offers={offers}/></aside>}/>;
}
