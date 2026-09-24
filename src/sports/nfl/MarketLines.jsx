import {SheetSelect} from './ResearchSheet';
import React,{useEffect,useRef,useState} from 'react';
import {RefreshCw,ChevronDown} from 'lucide-react';
import {NFLFreshness} from './Freshness';
import {quoteIdentity,filterOffers} from './trend-data';
import {NFL_PROP_DEFINITIONS} from './props';
import {Select,SelectTrigger,SelectContent,SelectItem} from '../../../components/ui/select';

const BOOKS=[['prizepicks','PrizePicks'],['underdog','Underdog'],['draftkings','DraftKings'],['fanduel','FanDuel'],['betmgm','BetMGM']];
// Real book icons via each site's own favicon (small, official, made for
// exactly this kind of "which site is this from" identification -- not the
// marketing logo). PrizePicks already ships a bundled mark; falls back to a
// colored-letter badge if a given icon ever fails to load.
const BOOK_BADGE={
  prizepicks:{label:'PP',color:'#7c3aed',icon:'/prizepicks/logo.png'},
  underdog:{label:'UD',color:'#22c55e',icon:'/sportsbooks/underdog.png'},
  draftkings:{label:'DK',color:'#00873c',icon:'/sportsbooks/draftkings.png'},
  fanduel:{label:'FD',color:'#1493ff',icon:'/sportsbooks/fanduel.png'},
  betmgm:{label:'MGM',color:'#b8860b',icon:'/sportsbooks/betmgm.png'},
};
function BookIcon({bookmaker,size=18}){
  const badge=BOOK_BADGE[bookmaker]||{label:(bookmaker||'?').slice(0,3).toUpperCase(),color:'#5b6b7c'};
  const [failed,setFailed]=useState(false);
  if(badge.icon && !failed)return <img className="nfl-book-icon" src={badge.icon} alt="" width={size} height={size} onError={()=>setFailed(true)}/>;
  return <i className="nfl-book-icon nfl-book-icon-fallback" style={{background:badge.color,width:size,height:size}}>{badge.label}</i>;
}
const priceLabel=price=>Number.isFinite(price)?(price>0?`+${price}`:`${price}`):'';
const bookLabel=(bookmaker,platform)=>platform || BOOKS.find(([key])=>key===bookmaker)?.[1] || bookmaker || 'Sportsbook';
// Goblins/demons are a PrizePicks-only concept (an easier/harder version of
// the same stat, not a different price) -- shown as their own small badge
// instead of folded into the book icon, so a Goblin/Demon line still reads
// as PrizePicks at a glance while making which tier it is obvious.
export const tierIcon=category=>category==='GOBLIN' ? '/prizepicks/goblin.png' : category==='DEMON' ? '/prizepicks/demon.png' : null;
export const tierLabel=category=>category==='GOBLIN' ? 'Goblin' : category==='DEMON' ? 'Demon' : null;


// One row per posted line value, every book's price for that value shown
// together -- the "Alt Lines" picker from the reference app, not a
// horizontally-scrolling strip of single-book pills.
export function altLineGroups(offers){
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

// The "current line" picker -- alt lines (and PrizePicks Goblin/Demon
// tiers) grouped one row per posted value, every book's price for that
// value shown together, using the same Select component as the MLB stat
// and PrizePicks-line pickers.
function NFLAltLinesSelect({offers,selected,onSelect}) {
  const groups=altLineGroups(offers);
  const currentValue=selected?.value!=null?String(selected.value):'';
  const pick=(value)=>{
    const group=groups.find(g=>String(g.value)===value);
    if(!group)return;
    const preferred=group.books.find(b=>b.bookmaker===selected?.bookmaker)||group.books[0];
    const line=(selected?.direction==='UNDER'?preferred.UNDER:preferred.OVER)?.line || preferred.OVER?.line || preferred.UNDER?.line;
    if(line)onSelect(line);
  };
  const TriggerIcon=({size})=><BookIcon bookmaker={selected?.bookmaker} size={size}/>;
  return <Select value={currentValue} onValueChange={pick}>
    <SelectTrigger icon={TriggerIcon} placeholder="Lines" aria-label={`Available lines, ${groups.length} ${groups.length===1?'line':'lines'}`}/>
    <SelectContent>
      {!groups.length && <SelectItem index={0} value="" disabled>No posted lines for this stat yet.</SelectItem>}
      {groups.map(({value,books},index)=>{
        const prices=books.map(b=>`${bookLabel(b.bookmaker,b.platform)}${tierLabel(b.category)?` ${tierLabel(b.category)}`:''}: ${[b.OVER&&`More ${priceLabel(b.OVER.price)}`,b.UNDER&&`Less ${priceLabel(b.UNDER.price)}`].filter(Boolean).join(', ')}`).join('; ');
        return <SelectItem key={value} index={index} value={String(value)} aria-label={`${value}, ${prices}`}>
          <span className="nfl-alt-line-row">
            <strong>{value}</strong>
            <span className="nfl-alt-line-books">{books.map(b=>
              <span className="nfl-alt-line-book" key={b.bookmaker} title={`${bookLabel(b.bookmaker,b.platform)}${tierLabel(b.category)?` ${tierLabel(b.category)}`:''}`}>
                <BookIcon bookmaker={b.bookmaker} size={16}/>
                {tierIcon(b.category) && <img className="nfl-alt-line-tier" src={tierIcon(b.category)} width="14" height="14" alt={tierLabel(b.category)}/>}
                <span className="nfl-alt-line-prices">
                  {b.OVER && <em className="over">O {priceLabel(b.OVER.price)}</em>}
                  {b.UNDER && <em className="under">U {priceLabel(b.UNDER.price)}</em>}
                </span>
              </span>
            )}</span>
          </span>
        </SelectItem>;
      })}
    </SelectContent>
  </Select>;
}

export function NFLMarketLines({load,player,week,prop,onSelect,selected,onRefresh}) {
  const [body,setBody]=useState(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
  const [book,setBook]=useState(selected?.bookmaker || 'prizepicks');
  useEffect(()=>{
    let active=true;setBody(null);setError('');
    load('props',{playerId:player.id,week}).then(result=>{if(active)setBody(result);}).catch(()=>{if(active)setError('Lines could not refresh. Try again.');});
    return ()=>{active=false;};
  },[load,player.id,week,reload]);
  // All books, not just the one currently preferred -- the dropdown shows
  // every book's price for a value at once, the way the reference app's
  // picker does, instead of requiring a book to be chosen first.
  const allOffers=filterOffers(body?.data || [],{prop,bookmaker:'',category:'ALL'});
  const altCount=Math.max(0,new Set(allOffers.map(row=>row.line?.value).filter(Number.isFinite)).size-1);
  const platform=bookLabel(selected?.bookmaker||book,selected?.platform);
  const loading=!body&&!error;
  useEffect(()=>{
    if(!body)return;
    const matches=filterOffers(body.data || [],{prop,bookmaker:book,category:'ALL'});
    const same=matches.find(row=>quoteIdentity(row.line)===quoteIdentity(selected));
    const standard=matches.find(row=>row.line.category==='STANDARD'&&row.direction==='OVER')||matches.find(row=>row.line.category==='STANDARD');
    onSelect((same||standard||matches.find(row=>row.direction==='OVER')||matches[0])?.line||null);
  },[body,prop,book,onSelect]);
  return <>
    {/* Deliberately doesn't touch `book` state here -- book only seeds the
        initial default selection below; changing it in response to an
        explicit pick would re-trigger that same effect and can fight the
        pick it just made. The trigger icon already reads the bookmaker
        straight off `selected`, so nothing depends on `book` tracking it. */}
    {body ? <NFLAltLinesSelect offers={allOffers} selected={selected} onSelect={onSelect}/> : <button type="button" className="nfl-line-trigger" aria-label={`${platform}, ${altCount} alternate ${altCount===1?'line':'lines'}`} aria-busy={loading} disabled>
      <BookIcon bookmaker={selected?.bookmaker||book}/>
      <span className="nfl-line-trigger-label">Lines</span>
      <ChevronDown size={14}/>
    </button>}
    <button type="button" className="nfl-line-refresh" aria-label="Refresh lines" title="Refresh lines" disabled={loading} onClick={()=>{onRefresh?.();onSelect(null);setReload(n=>n+1);}}><RefreshCw size={16}/></button>
    <div className="nfl-market-meta">
    {loading&&<small role="status">Loading lines…</small>}
    {error&&<small role="alert">{error}</small>}
    {body&&!allOffers.length&&<small>No posted line for this stat. Enter a comparison line below.</small>}
    </div>
  </>;
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
