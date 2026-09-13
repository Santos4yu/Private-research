import React,{useEffect,useRef,useState} from 'react';
import {NFLFreshness} from './Freshness';
import {quoteIdentity,filterOffers} from './trend-data';
import {NFL_PROP_DEFINITIONS} from './props';

const BOOKS=[['prizepicks','PrizePicks'],['underdog','Underdog'],['draftkings','DraftKings'],['fanduel','FanDuel'],['betmgm','BetMGM']];
const CATEGORIES=[['STANDARD','Standard'],['GOBLIN','Goblins'],['DEMON','Demons'],['ALTERNATE','All alternates'],['ALL','All lines']];
const categoryLabel=value=>CATEGORIES.find(([key])=>key===value)?.[1] || 'Alternate';
const directionLabel=value=>value==='OVER'?'More':'Less';
const propLabel=value=>NFL_PROP_DEFINITIONS.find(p=>p.key===value)?.label || value.replaceAll('_',' ');

export function NFLMarketLines({load,player,week,prop,onSelect,selected,onRefresh}) {
  const [body,setBody]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const [book,setBook]=useState(selected?.bookmaker || 'prizepicks'),[category,setCategory]=useState(selected?.category || 'STANDARD');
  useEffect(()=>{
    let active=true;setBody(null);setError('');
    load('props',{playerId:player.id,week}).then(result=>{if(active)setBody(result);}).catch(()=>{if(active)setError('Live lines could not load. Retry, or set a custom line in Trends.');});
    return ()=>{active=false;};
  },[load,player.id,week,reload]);
  const offers=filterOffers(body?.data || [],{prop,bookmaker:book,category}).sort((a,b)=>a.line.value-b.line.value || a.direction.localeCompare(b.direction));
  useEffect(()=>{
    if(!body)return;
    const matches=filterOffers(body.data || [],{prop,bookmaker:book,category});
    const same=matches.find(row=>quoteIdentity(row.line)===quoteIdentity(selected));
    onSelect((same || matches.find(row=>row.direction==='OVER') || matches[0])?.line || null);
  },[body,prop,book,category,onSelect]);
  const current=offers.find(row=>quoteIdentity(row.line)===quoteIdentity(selected));
  return <section className="nfl-chart-card nfl-posted-lines nfl-market-compact">
    <div className="nfl-line-selectors nfl-offer-controls"><label>Platform<select value={book} onChange={e=>{setBook(e.target.value);setCategory('STANDARD');}}>{BOOKS.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>Line type<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.filter(([key])=>book==='prizepicks' || !['GOBLIN','DEMON'].includes(key)).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>{propLabel(prop)}<select value={current?quoteIdentity(current.line):''} onChange={e=>{const row=offers.find(row=>quoteIdentity(row.line)===e.target.value);onSelect(row?.line || null);}} disabled={!offers.length}><option value="">{!body&&!error?'Loading lines…':offers.length?'Choose a line':'No posted line'}</option>{offers.map(row=><option key={quoteIdentity(row.line)} value={quoteIdentity(row.line)}>{directionLabel(row.direction)} {row.line.value}{category==='ALL'||category==='ALTERNATE'?` · ${categoryLabel(row.line.category)}`:''}</option>)}</select></label></div>
    {current && <div className="nfl-selected-quote"><strong>{current.line.platform} · {directionLabel(current.direction)} {current.line.value}</strong><span className={`nfl-offer-category ${current.line.category.toLowerCase()}`}>{categoryLabel(current.line.category)}</span><NFLFreshness timestamp={current.line.updatedAt} staleAfter={120000}/></div>}
    {error && <p role="alert">{error}</p>}
    {body && !offers.length && <p>{body.reason || `No ${category==='STANDARD'?'standard':'matching'} ${BOOKS.find(([key])=>key===book)?.[1]} line is posted for this stat. Try another line type or use a custom trend line.`}</p>}
    <button className="nfl-reset" type="button" onClick={()=>{onRefresh?.();onSelect(null);setReload(n=>n+1);}}>Refresh lines</button>
  </section>;
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
    {!games?<button type="button" className="nfl-refresh" onClick={getGames} disabled={loading}>Browse games</button>:<div className="nfl-board-filters"><label>Game<select value={game} onChange={e=>{request.current++;setLoading(false);setGame(e.target.value);setBody(null);setError('');}}>{games.data.map(item=><option key={item.eventId} value={item.eventId}>{item.awayTeamId} @ {item.homeTeamId} · {new Date(item.startsAt).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</option>)}</select></label><button type="button" className="nfl-refresh" onClick={getLines} disabled={loading||!game}>Load lines</button></div>}
    {body && <div className="nfl-board-filters"><label>Platform<select value={book} onChange={e=>{setBook(e.target.value);setCategory('STANDARD');}}>{BOOKS.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>Line type<select value={category} onChange={e=>setCategory(e.target.value)}>{CATEGORIES.filter(([key])=>book==='prizepicks'||!['GOBLIN','DEMON'].includes(key)).map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label><label>Position<select value={position} onChange={e=>setPosition(e.target.value)}><option value="">All positions</option>{['QB','RB','WR','TE'].map(v=><option key={v}>{v}</option>)}</select></label><label>Stat<select value={prop} onChange={e=>setProp(e.target.value)}><option value="">All stats</option>{NFL_PROP_DEFINITIONS.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}</select></label><label>Player<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search players"/></label></div>}
    {loading&&<p role="status">Loading current offers…</p>}{error&&<p role="alert">{error}</p>}{games&&!games.data.length&&<p>No upcoming games posted.</p>}{body&&!rows.length&&<p>{body.reason || 'No posted offers match these filters.'}</p>}
    {!!rows.length&&<><p>{rows.length} matching offers</p><div className="nfl-board-rows">{rows.slice(0,limit).map(row=>{const player=players.find(p=>p.id===row.playerId);return <article key={quoteIdentity(row.line)}><strong>{row.playerName}</strong><p>{propLabel(row.propType)} · {directionLabel(row.direction)} {row.line.value}</p><span className={`nfl-offer-category ${row.line.category.toLowerCase()}`}>{categoryLabel(row.line.category)}</span><small>{row.line.platform}</small><NFLFreshness timestamp={row.line.updatedAt} staleAfter={120000}/>{player&&<button className="nfl-refresh" type="button" onClick={()=>onOpen({...player,researchProp:row.propType,researchLine:row.line,researchGameId:row.gameId})}>Open research</button>}</article>;})}</div>{rows.length>limit&&<button className="nfl-refresh" type="button" onClick={()=>setLimit(n=>n+40)}>Show more offers</button>}</>}
  </section>;
}
