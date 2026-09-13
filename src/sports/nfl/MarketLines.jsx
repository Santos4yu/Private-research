import {ResearchSheet,SheetSelect} from './ResearchSheet';
import React,{useEffect,useRef,useState} from 'react';
import {ChevronDown,RefreshCw} from 'lucide-react';
import {NFLFreshness} from './Freshness';
import {quoteIdentity,filterOffers,postedLineLevels} from './trend-data';
import {NFL_PROP_DEFINITIONS} from './props';

const BOOKS=[['prizepicks','PrizePicks'],['underdog','Underdog'],['draftkings','DraftKings'],['fanduel','FanDuel'],['betmgm','BetMGM']];
const CATEGORIES=[['STANDARD','Regular'],['GOBLIN','Goblins'],['DEMON','Demons'],['ALTERNATE','All alternates'],['ALL','All lines']];
const categoryLabel=value=>CATEGORIES.find(([key])=>key===value)?.[1] || 'Alternate';
const directionLabel=value=>value==='OVER'?'More':'Less';
const propLabel=value=>NFL_PROP_DEFINITIONS.find(p=>p.key===value)?.label || value.replaceAll('_',' ');

export function NFLMarketLines({load,player,week,prop,onSelect,selected,onRefresh}) {
  const [body,setBody]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[open,setOpen]=useState(false);
  const [book,setBook]=useState(selected?.bookmaker || 'prizepicks'),[category,setCategory]=useState(selected?.category || 'STANDARD');
  useEffect(()=>{
    let active=true;setBody(null);setError('');
    load('props',{playerId:player.id,week}).then(result=>{if(active)setBody(result);}).catch(()=>{if(active)setError('Lines could not refresh');});
    return ()=>{active=false;};
  },[load,player.id,week,reload]);
  const offers=filterOffers(body?.data || [],{prop,bookmaker:book,category});
  const levels=postedLineLevels(offers);
  useEffect(()=>{
    if(!body)return;
    const matches=filterOffers(body.data || [],{prop,bookmaker:book,category});
    const same=matches.find(row=>quoteIdentity(row.line)===quoteIdentity(selected));
    onSelect((same || matches.find(row=>row.direction==='OVER') || matches[0])?.line || null);
  },[body,prop,book,category,onSelect]);
  const categories=book==='prizepicks'?[['STANDARD','Regular'],['GOBLIN','Goblins'],['DEMON','Demons']]:[['STANDARD','Regular'],['ALTERNATE','Alternates']];
  const choose=value=>{const matches=offers.filter(row=>row.line.value===value);onSelect((matches.find(row=>row.direction===selected?.direction)||matches.find(row=>row.direction==='OVER')||matches[0])?.line||null);setOpen(false);};
  return <div className="nfl-market-app">
    <div className="nfl-line-categories" role="group" aria-label="Line category">{categories.map(([key,name])=><button type="button" key={key} className={key.toLowerCase()} aria-pressed={category===key} onClick={()=>setCategory(key)}>{name}</button>)}</div>
    <div className="nfl-market-row"><button type="button" className="nfl-market-trigger" aria-haspopup="dialog" onClick={()=>setOpen(true)}><span>{BOOKS.find(([key])=>key===book)?.[1]}<small>{category==='STANDARD'?'Regular line':categoryLabel(category)}</small></span><strong>{selected?.value ?? (body||error?'No line':'Loading lines…')}</strong><ChevronDown size={17} aria-hidden="true"/></button><button type="button" className="nfl-line-refresh" aria-label="Refresh lines" onClick={()=>{onRefresh?.();onSelect(null);setReload(n=>n+1);}}><RefreshCw size={18}/></button></div>
    {selected&&<div className="nfl-quote-time"><NFLFreshness timestamp={selected.updatedAt} staleAfter={120000}/></div>}{error&&<small role="alert">{error}</small>}
    <ResearchSheet open={open} title={`${propLabel(prop)} lines`} onClose={()=>setOpen(false)}><SheetSelect label="Platform" value={book} onChange={e=>{setBook(e.target.value);setCategory('STANDARD');}}>{BOOKS.map(([key,name])=><option key={key} value={key}>{name}</option>)}</SheetSelect><div className="nfl-line-categories" role="group" aria-label="Choose line category">{categories.map(([key,name])=><button type="button" key={key} aria-pressed={category===key} onClick={()=>setCategory(key)}>{name}</button>)}</div><div className="nfl-sheet-levels">{levels.map(value=><button type="button" key={value} aria-pressed={selected?.value===value} onClick={()=>choose(value)}><span>{category==='STANDARD'?'Regular':categoryLabel(category)}</span><strong>{value}</strong></button>)}</div>{!levels.length&&<p>No posted {category==='STANDARD'?'regular':categoryLabel(category).toLowerCase()} line for this stat. You can still edit a comparison line on the chart.</p>}</ResearchSheet>
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
