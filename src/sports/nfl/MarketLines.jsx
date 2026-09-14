import {ResearchSheet,SheetSelect} from './ResearchSheet';
import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw,ChevronDown,Check} from 'lucide-react';
import {NFLFreshness} from './Freshness';
import {quoteIdentity,filterOffers} from './trend-data';
import {NFL_PROP_DEFINITIONS} from './props';

const BOOKS=[['prizepicks','PrizePicks'],['underdog','Underdog'],['draftkings','DraftKings'],['fanduel','FanDuel'],['betmgm','BetMGM']];
// No official logos for these bundled in the app -- short colored badges
// instead of broken/missing <img> tags for every non-PrizePicks book.
const BOOK_BADGE={prizepicks:{label:'PP',color:'#7c3aed'},underdog:{label:'UD',color:'#22c55e'},draftkings:{label:'DK',color:'#00873c'},fanduel:{label:'FD',color:'#1493ff'},betmgm:{label:'MGM',color:'#b8860b'}};
const priceLabel=price=>Number.isFinite(price)?(price>0?`+${price}`:`${price}`):'';

// One row per posted line value, every book's price for that value shown
// together -- the "Alt Lines" picker from the reference app, not a
// horizontally-scrolling strip of single-book pills.
function altLineGroups(offers){
  const byValue=new Map();
  for(const row of offers){
    const line=row.line;if(!Number.isFinite(line?.value))continue;
    let group=byValue.get(line.value);if(!group){group=new Map();byValue.set(line.value,group);}
    let book=group.get(line.bookmaker);if(!book){book={bookmaker:line.bookmaker,platform:line.platform,category:line.category};group.set(line.bookmaker,book);}
    book[line.direction]={price:line.price,line};
  }
  return [...byValue.entries()].sort((a,b)=>a[0]-b[0]).map(([value,books])=>({value,books:[...books.values()]}));
}
const CATEGORIES=[['STANDARD','Regular'],['GOBLIN','Goblins'],['DEMON','Demons'],['ALTERNATE','All alternates'],['ALL','All lines']];
const categoryLabel=value=>CATEGORIES.find(([key])=>key===value)?.[1] || 'Alternate';
const directionLabel=value=>value==='OVER'?'More':'Less';
const propLabel=value=>NFL_PROP_DEFINITIONS.find(p=>p.key===value)?.label || value.replaceAll('_',' ');

// A compact "current line" chip + chevron that opens the Alt Lines sheet --
// replaces the old always-visible horizontally-scrolling line rail, which
// only ever showed one book at a time and ate a full row of screen space
// permanently instead of on demand.
function NFLAltLinesSheet({open,onClose,offers,selected,onSelect}) {
  const groups=altLineGroups(offers);
  return <ResearchSheet open={open} onClose={onClose} title="Alt Lines">
    <div className="nfl-alt-lines-list">
      {!groups.length && <p className="nfl-alt-lines-empty">No posted lines for this stat yet.</p>}
      {groups.map(({value,books})=>{
        const active=selected?.value===value;
        const pick=()=>{
          const preferred=books.find(b=>b.bookmaker===selected?.bookmaker)||books[0];
          const line=(selected?.direction==='UNDER'?preferred.UNDER:preferred.OVER)?.line || preferred.OVER?.line || preferred.UNDER?.line;
          if(line)onSelect(line);
          onClose();
        };
        return <button type="button" key={value} className={`nfl-alt-line-row${active?' active':''}`} aria-pressed={active} onClick={pick}>
          <strong>{value}</strong>
          <div className="nfl-alt-line-books">{books.map(b=>{
            const badge=BOOK_BADGE[b.bookmaker]||{label:(b.platform||b.bookmaker||'?').slice(0,3).toUpperCase(),color:'#5b6b7c'};
            return <span className="nfl-alt-line-book" key={b.bookmaker}>
              <i style={{background:badge.color}}>{badge.label}</i>
              {b.OVER && <em className="over">O{priceLabel(b.OVER.price)}</em>}
              {b.UNDER && <em className="under">U{priceLabel(b.UNDER.price)}</em>}
            </span>;
          })}</div>
          {active && <Check size={18}/>}
        </button>;
      })}
    </div>
  </ResearchSheet>;
}

export function NFLMarketLines({load,player,week,prop,onSelect,selected,onRefresh}) {
  const [body,setBody]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0),[altOpen,setAltOpen]=useState(false);
  const [book,setBook]=useState(selected?.bookmaker || 'prizepicks');
  useEffect(()=>{
    let active=true;setBody(null);setError('');
    load('props',{playerId:player.id,week}).then(result=>{if(active)setBody(result);}).catch(()=>{if(active)setError('Lines could not refresh. Try again.');});
    return ()=>{active=false;};
  },[load,player.id,week,reload]);
  // All books, not just the one currently preferred -- the Alt Lines sheet
  // shows every book's price for a value at once, the way the reference
  // app's picker does, instead of requiring a book to be chosen first.
  const allOffers=filterOffers(body?.data || [],{prop,bookmaker:'',category:'ALL'});
  useEffect(()=>{
    if(!body)return;
    const matches=filterOffers(body.data || [],{prop,bookmaker:book,category:'ALL'});
    const same=matches.find(row=>quoteIdentity(row.line)===quoteIdentity(selected));
    const standard=matches.find(row=>row.line.category==='STANDARD'&&row.direction==='OVER')||matches.find(row=>row.line.category==='STANDARD');
    onSelect((same||standard||matches.find(row=>row.direction==='OVER')||matches[0])?.line||null);
  },[body,prop,book,onSelect]);
  const badge=BOOK_BADGE[selected?.bookmaker]||BOOK_BADGE.prizepicks;
  return <div className="nfl-market-app">
    <div className="nfl-market-row">
      <button type="button" className="nfl-line-trigger" aria-haspopup="dialog" onClick={()=>setAltOpen(true)} disabled={!body}>
        <i style={{background:badge.color}}>{badge.label}</i>
        <span>{selected?`${directionLabel(selected.direction)} ${selected.value}`:body?'Select a line':'Loading…'}</span>
        {Number.isFinite(selected?.price) && <b>{priceLabel(selected.price)}</b>}
        <ChevronDown size={16}/>
      </button>
      <button type="button" className="nfl-line-refresh" aria-label="Refresh lines" onClick={()=>{onRefresh?.();onSelect(null);setReload(n=>n+1);}}><RefreshCw size={18}/></button>
    </div>
    {/* Deliberately doesn't touch `book` state here -- book only seeds the
        initial default selection below; changing it in response to an
        explicit pick would re-trigger that same effect and can fight the
        pick it just made. The trigger badge already reads the bookmaker
        straight off `selected`, so nothing depends on `book` tracking it. */}
    <NFLAltLinesSheet open={altOpen} onClose={()=>setAltOpen(false)} offers={allOffers} selected={selected} onSelect={onSelect}/>
    {error&&<small role="alert">{error}</small>}
    {body&&!allOffers.length&&<small>No posted line for this stat. Enter a comparison line below.</small>}
    {selected&&<div className="nfl-quote-time"><NFLFreshness timestamp={selected.updatedAt} staleAfter={120000}/></div>}
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
