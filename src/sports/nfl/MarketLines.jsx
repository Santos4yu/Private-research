import {SheetSelect} from './ResearchSheet';
import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {NFLFreshness} from './Freshness';
import {quoteIdentity,filterOffers} from './trend-data';
import {NFL_PROP_DEFINITIONS} from './props';

const BOOKS=[['prizepicks','PrizePicks'],['underdog','Underdog'],['draftkings','DraftKings'],['fanduel','FanDuel'],['betmgm','BetMGM']];
const CATEGORIES=[['STANDARD','Regular'],['GOBLIN','Goblins'],['DEMON','Demons'],['ALTERNATE','All alternates'],['ALL','All lines']];
const categoryLabel=value=>CATEGORIES.find(([key])=>key===value)?.[1] || 'Alternate';
const directionLabel=value=>value==='OVER'?'More':'Less';
const propLabel=value=>NFL_PROP_DEFINITIONS.find(p=>p.key===value)?.label || value.replaceAll('_',' ');

export function NFLLineRail({offers,selected,onSelect}) {
  const rail=useRef(null);
  const unique=new Map();
  for(const row of offers){
    const line=row.line;if(!Number.isFinite(line?.value))continue;
    const key=[line.gameId,line.category,line.value].join('|');
    const prior=unique.get(key);
    if(!prior || line.direction===(selected?.direction||'OVER'))unique.set(key,line);
  }
  const lines=[...unique.values()].sort((a,b)=>a.value-b.value);
  useEffect(()=>{const button=rail.current?.querySelector('[aria-pressed="true"]');if(button)rail.current.scrollLeft=button.offsetLeft-(rail.current.clientWidth-button.offsetWidth)/2;},[selected?.value,selected?.category,selected?.gameId,lines.length]);
  return <div ref={rail} className="nfl-posted-rail" role="group" aria-label="Posted prop lines">{lines.map(line=>{
    const name=categoryLabel(line.category);
    const icon=line.category==='GOBLIN'?'goblin':line.category==='DEMON'?'demon':line.category==='STANDARD'&&line.bookmaker==='prizepicks'?'logo':null;
    return <button type="button" key={[line.gameId,line.category,line.value].join('|')} aria-label={`${line.value} ${name} line`} aria-pressed={selected?.value===line.value&&selected?.category===line.category&&selected?.gameId===line.gameId} onClick={()=>onSelect(line)}><strong>{line.value}</strong>{icon&&<img src={`/prizepicks/${icon}.png`} alt={name} width="25" height="25"/>}</button>;
  })}</div>;
}

export function NFLMarketLines({load,player,week,prop,onSelect,selected,onRefresh}) {
  const [body,setBody]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const [book,setBook]=useState(selected?.bookmaker || 'prizepicks');
  useEffect(()=>{
    let active=true;setBody(null);setError('');
    load('props',{playerId:player.id,week}).then(result=>{if(active)setBody(result);}).catch(()=>{if(active)setError('Lines could not refresh. Try again.');});
    return ()=>{active=false;};
  },[load,player.id,week,reload]);
  const offers=filterOffers(body?.data || [],{prop,bookmaker:book,category:'ALL'});
  useEffect(()=>{
    if(!body)return;
    const matches=filterOffers(body.data || [],{prop,bookmaker:book,category:'ALL'});
    const same=matches.find(row=>quoteIdentity(row.line)===quoteIdentity(selected));
    const standard=matches.find(row=>row.line.category==='STANDARD'&&row.direction==='OVER')||matches.find(row=>row.line.category==='STANDARD');
    onSelect((same||standard||matches.find(row=>row.direction==='OVER')||matches[0])?.line||null);
  },[body,prop,book,onSelect]);
  return <div className="nfl-market-app">
    <div className="nfl-market-row"><SheetSelect label="Line source" value={book} onChange={e=>{onSelect(null);setBook(e.target.value);}}>{BOOKS.map(([key,name])=><option key={key} value={key}>{name}</option>)}</SheetSelect><button type="button" className="nfl-line-refresh" aria-label="Refresh lines" onClick={()=>{onRefresh?.();onSelect(null);setReload(n=>n+1);}}><RefreshCw size={18}/></button></div>
    {!body&&!error?<small role="status">Loading lines…</small>:<NFLLineRail offers={offers} selected={selected} onSelect={onSelect}/>}
    {body&&!offers.length&&<small>No posted line for this stat. Enter a comparison line below.</small>}
    {selected&&<div className="nfl-quote-time"><NFLFreshness timestamp={selected.updatedAt} staleAfter={120000}/></div>}{error&&<small role="alert">{error}</small>}
  </div>;
}

export function NFLPropBrowser({load,players,onOpen}) {
  const [games,setGames]=useState(null),[game,setGame]=useState(''),[body,setBody]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [book,setBook]=useState('prizepicks'),[category,setCategory]=useState('STANDARD'),[position,setPosition]=useState(''),[prop,setProp]=useState(''),[query,setQuery]=useState(''),[limit,setLimit]=useState(40);
  const request=useRef(0);
  useEffect(()=>()=>{request.current++;},[]);
  const getGames=()=>{setLoading(true);setError('');load('prop-games').then(result=>{setGames(result);setGame(result.data[0]?.eventId || '');}).catch(()=>setError('Game schedule could not load. Try again.')).finally(()=>setLoading(false));};
  const getLines=()=>{const id=++request.current;setLoading(true);setError('');setBody(null);setLimit(40);load('props',{eventId:game}).then(result=>{if(id===request.current)setBody(result);}).catch(()=>{if(id===request.current)setError('Live lines could not load. Try again.');}).finally(()=>{if(id===request.current)setLoading(false);});};
  const rows=filterOffers(body?.data || [],{bookmaker:book,category,prop}).filter(row=>(!position||row.position===position)&&row.playerName.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.playerName.localeCompare(b.playerName)||a.propType.localeCompare(b.propType)||a.line.value-b.line.value);
  return <section className="nfl-chart-card nfl-prop-browser"><h3>NFL props</h3>
    {!games?<button type="button" className="nfl-refresh" onClick={getGames} disabled={loading}>Browse games</button>:<div className="nfl-board-filters"><label>Game<SheetSelect label="Game" value={game} onChange={e=>{request.current++;setLoading(false);setGame(e.target.value);setBody(null);setError('');}}>{games.data.map(item=><option key={item.eventId} value={item.eventId}>{item.awayTeamId} @ {item.homeTeamId} · {new Date(item.startsAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</option>)}</SheetSelect></label><button type="button" className="nfl-refresh" onClick={getLines} disabled={loading||!game}>Load lines</button></div>}
    {body && <div className="nfl-board-filters"><label>Platform<SheetSelect label="Platform" value={book} onChange={e=>{setBook(e.target.value);setCategory('STANDARD');}}>{BOOKS.map(([key,name])=><option key={key} value={key}>{name}</option>)}</SheetSelect></label><label>Line type<SheetSelect label="Line category" value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.filter(([key])=>book==='prizepicks'||!['GOBLIN','DEMON'].includes(key)).map(([key,name])=><option key={key} value={key}>{name}</option>)}</SheetSelect></label><label>Position<SheetSelect label="Position" value={position} onChange={e=>setPosition(e.target.value)}><option value="">All positions</option>{['QB','RB','WR','TE'].map(v=><option key={v}>{v}</option>)}</SheetSelect></label><label>Stat<SheetSelect label="Statistic" value={prop} onChange={e=>setProp(e.target.value)}><option value="">All stats</option>{NFL_PROP_DEFINITIONS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</SheetSelect></label><label>Player<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players"/></label></div>}
    {loading&&<p role="status">Loading current offers…</p>}{error&&<p role="alert">{error}</p>}{games&&!games.data.length&&<p>No upcoming games posted.</p>}{body&&!rows.length&&<p>{body.reason || 'No posted offers match these filters.'}</p>}
    {!!rows.length&&<><p>{rows.length} matching offers</p><div className="nfl-board-rows">{rows.slice(0,limit).map(row=>{const player=players.find(p=>p.id===row.playerId);return <article key={quoteIdentity(row.line)}><strong>{row.playerName}</strong><p>{propLabel(row.propType)} · {directionLabel(row.direction)} {row.line.value}</p><span className={`nfl-offer-category ${row.line.category.toLowerCase()}`}>{categoryLabel(row.line.category)}</span><small>{row.line.platform}</small><NFLFreshness timestamp={row.line.updatedAt} staleAfter={120000}/>{player&&<button className="nfl-refresh" type="button" onClick={()=>onOpen({...player,researchProp:row.propType,researchLine:row.line,researchGameId:row.gameId})}>Open research</button>}</article>;})}</div>{rows.length>limit&&<button className="nfl-refresh" type="button" onClick={()=>setLimit(n=>n+40)}>Show more offers</button>}</>}
  </section>;
}
