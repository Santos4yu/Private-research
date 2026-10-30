import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ArrowLeft,Info,Layers,Percent,Swords,TrendingUp,UserRound} from 'lucide-react';
import {AnalyzeButton,ANALYZE_SPORTS} from './AnalyzeButton';
import './finder-player-banner.css';

// The player header on a Finder player page (WNBA and MLB): the page's own
// gradient header rather than a separate
// card -- back / brand / account, the player with team badge, position and
// height, the game, and the book odds for the line on the chart.
//
// The player sits on a grey card with his team's logo large and faint
// behind him, the pick in one line under his name (More 9.5 › Receiving
// Yards) and its price. On a page
// with the trend chart, the card goes into the chart panel itself
// (#gamelog-hero-slot) so it runs straight into the bars, and the odds go
// under the chart's numbers (#gamelog-quotes-slot).
//
// The odds follow the chart: app.js announces the quotes for whatever line
// the chart is on (vortex:trend-odds) every time it changes, and the chart
// panel's own odds row is hidden on these pages, so they live here only.

const finite=value=>typeof value==='number'&&Number.isFinite(value);
const american=value=>finite(value)?(value>0?'+':'')+Math.round(value):'—';
const priced=value=>finite(value)&&Math.abs(value)>=100;
const implied=odds=>odds<0?-odds/(-odds+100):100/(odds+100);
const PRIZEPICKS_LOGO='/prizepicks/logo.png';

function gameLabel(row){
 if(row.awayTeamAbbr&&row.homeTeamAbbr)return `${row.awayTeamAbbr} @ ${row.homeTeamAbbr}`;
 if(row.teamAbbr&&row.opponent)return `${row.teamAbbr} vs ${row.opponent}`;
 return row.teamAbbr||'';
}
function gameTime(value){
 const date=new Date(value);
 if(Number.isNaN(date.getTime()))return '';
 return `${date.toLocaleDateString([],{weekday:'short'})} ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`;
}
// Over/under chances from the first book pricing both sides, with the
// bookmaker's margin taken out. One-sided prices are shown as they are.
function chances(books){
 const paired=books.find(book=>priced(book.over)&&priced(book.under));
 if(paired){const over=implied(paired.over),under=implied(paired.under);return {book:paired,over:over/(over+under)*100,under:under/(over+under)*100,paired:true};}
 const single=books.find(book=>priced(book.over)||priced(book.under));
 if(!single)return null;
 return {book:single,over:priced(single.over)?implied(single.over)*100:null,under:priced(single.under)?implied(single.under)*100:null,paired:false};
}
const pressAccount=event=>{event.stopPropagation();document.querySelector('.site-account-trigger')?.click();};

// The chart panel's slots for the card and the odds, once the page has
// mounted the panel beside this header (it may do so after this renders).
function usePanelSlots(ref){
 const [slots,setSlots]=useState(null);
 useEffect(()=>{
  const scope=ref.current?.parentElement;
  if(!scope)return undefined;
  const look=()=>{
   const hero=scope.querySelector('#gamelog-hero-slot');
   if(!hero)return false;
   setSlots({hero,quotes:scope.querySelector('#gamelog-quotes-slot'),tabs:scope.querySelector('#gamelog-switch-slot'),tools:scope.querySelector('.gamelog-toolbar-head'),section:scope});
   return true;
  };
  if(look())return undefined;
  const watch=new MutationObserver(()=>{if(look())watch.disconnect();});
  watch.observe(scope,{childList:true,subtree:true});
  return()=>watch.disconnect();
 },[ref]);
 return slots;
}

// The page's three views: the trend (the chart and his own numbers), the
// matchup (the page's matchup panel) and the depth chart and usage. The
// switch marks the page (data-trend-tab) and trend-page.css shows the
// sections that belong to it; a view the sport doesn't have isn't offered.
// On a computer the matchup stays open in its own column, so the switch
// offers only Trends and Depth there.
const WIDE='(min-width: 1051px)';
const VIEWS=[['trends','Trends',TrendingUp],['matchup','Matchup',Swords],['depth','Depth',Layers]];
const VIEW_PARTS={matchup:'.mlb-finder-context',depth:'.wnba-depth,.nfl-pass-run,.nfl-share'};
function TrendSwitch({section}){
 const [view,setView]=useState('trends');
 const [have,setHave]=useState({matchup:false,depth:false});
 const [wide,setWide]=useState(()=>typeof matchMedia==='function'&&matchMedia(WIDE).matches);
 useEffect(()=>{if(typeof matchMedia!=='function')return undefined;const query=matchMedia(WIDE),on=()=>setWide(query.matches);on();query.addEventListener('change',on);return()=>query.removeEventListener('change',on);},[]);
 useEffect(()=>{
  const check=()=>setHave(old=>{
   const next={matchup:Boolean(section.querySelector(VIEW_PARTS.matchup)),depth:Boolean(section.querySelector(VIEW_PARTS.depth))};
   return old.matchup===next.matchup&&old.depth===next.depth?old:next;
  });
  check();
  const watch=new MutationObserver(check);
  watch.observe(section,{childList:true,subtree:true});
  return()=>{watch.disconnect();delete section.dataset.trendTab;};
 },[section]);
 const views=VIEWS.filter(([key])=>key==='trends'||(have[key]&&!(wide&&key==='matchup')));
 const current=views.some(([key])=>key===view)?view:'trends';
 useEffect(()=>{section.dataset.trendTab=current;},[section,current]);
 if(views.length<2)return null;
 const index=views.findIndex(([key])=>key===current);
 return <div className="fpb-switch" role="tablist" aria-label="Player research" style={{'--count':views.length,'--at':index}}>
  <span className="fpb-switch-pill" aria-hidden="true"/>
  {views.map(([key,label,Icon])=><button type="button" role="tab" key={key} aria-selected={key===current} className={key===current?'is-on':''}
   onClick={()=>setView(key)}><Icon size={16} aria-hidden="true"/>{label}</button>)}
 </div>;
}

// His hit rate over the last 10 at this line, for the card's ring.
function lastTen(row){
 const window=row.windows?.l10;
 const games=finite(window?.decisions)?window.decisions:finite(window?.sample)?window.sample:null;
 if(!games||!finite(window?.hits))return null;
 const over=String(row.direction||'OVER').toUpperCase()==='UNDER'?games-window.hits:window.hits;
 return {won:over,games,rate:over/games};
}
function HitRing({record}){
 const r=22,c=2*Math.PI*r;
 const tone=record.rate>=0.6?'up':record.rate>=0.5?'mid':'down';
 return <span className="fpb-ring" data-tone={tone} title={`${record.won} of his last ${record.games}`} style={{'--fill':c*(1-record.rate),'--full':c}}>
  <svg viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r={r} className="fpb-ring-track"/><circle cx="27" cy="27" r={r} className="fpb-ring-fill" strokeDasharray={c}/></svg>
  <b>{Math.round(record.rate*100)}<small>%</small></b><em>L{record.games}</em>
 </span>;
}

// layout "v2" (the NBA / WNBA page, finder-player-v2.css): one top bar with
// the player and the game; the chart's title (the stat, More or Less, the
// price) over the chart's own line - / +, PrizePicks lines and save star,
// with Analyze after them (Oct 30, the owner: the buttons sat too close to
// the line, then a reference with the title, one row of small even buttons
// and the filters under it); no Trends / Matchup / Depth switch (the page
// has its own section tabs).
export function FinderPlayerBanner({row,playerRows=[],onBack,layout}){
 const ref=useRef(null);
 const slots=usePanelSlots(ref);
 const [quotes,setQuotes]=useState(null);
 useEffect(()=>{
  setQuotes(null);
  const receive=({detail})=>{if(detail&&detail.player===row.player)setQuotes({line:Number(detail.line),books:detail.books||[]});};
  window.addEventListener('vortex:trend-odds',receive);
  return()=>window.removeEventListener('vortex:trend-odds',receive);
 },[row.player]);
 const line=finite(quotes?.line)?quotes.line:row.line;
 // Until the chart reports in, the row's own quotes stand in.
 const books=quotes?quotes.books:(row.apps||[]).filter(app=>app.key!=='prizepicks'&&(finite(app.over)||finite(app.under))).map(app=>({key:app.key,name:app.name,logo:`/sportsbooks/${app.key}.png`,over:app.over,under:app.under}));
 const odds=chances(books);
 // The PrizePicks card: whichever of this player's PrizePicks lines sits at
 // the line on the chart, with its Goblin/Demon tier.
 const pick=playerRows.find(item=>item.marketKey===row.marketKey&&Number(item.line)===Number(line)&&(item.apps||[]).some(app=>app.key==='prizepicks'));
 const tier=['goblin','demon'].includes(String(pick?.modifier).toLowerCase())?String(pick.modifier).toLowerCase():null;
 const time=gameTime(row.startsAt);
 const initials=String(row.player||'').split(' ').map(part=>part[0]).slice(0,2).join('');
 const side=String(row.direction||'OVER').toUpperCase()==='UNDER'?'Less':'More';
 const shownLine=finite(Number(line))?(Number.isInteger(Number(line))?String(line):Number(line).toFixed(1)):'';
 // The price for the side at the line: the first book quoting it.
 const sideKey=side==='Less'?'under':'over';
 const priced=books.find(book=>finite(book[sideKey])&&Math.abs(book[sideKey])>=100);
 const record=lastTen(row);
 const hero=<div className="fpb-hero">
  {row.teamLogo&&<img className="fpb-watermark" src={row.teamLogo} alt="" aria-hidden="true" onError={e=>{e.currentTarget.hidden=true;}}/>}
  <span className="fpb-avatar"><span className="fpb-initials" aria-hidden="true">{initials}</span>
   {row.headshot&&<img className="fpb-photo" src={row.headshot} alt="" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
  <div className="fpb-identity">
   <h1>{row.player}</h1>
   <p className="fpb-meta">{row.position&&<><b>{row.position}</b><i aria-hidden="true">·</i></>}<span>{gameLabel(row)}</span>
    {time&&<><i className="fpb-chev" aria-hidden="true">›</i><span>{time}</span></>}</p>
   {/* A research-only stat (WNBAPlayerPage researchRows): no line posted tonight. */}
   {row.market&&row.researchOnly?<p className="fpb-prop"><span>{row.market}</span><i aria-hidden="true">·</i><span>No PrizePicks line tonight</span></p>
    :row.market&&shownLine&&<p className="fpb-prop"><b>{side} {shownLine}</b><i aria-hidden="true">›</i><span>{row.market}</span></p>}
  </div>
  {(record||priced||(ANALYZE_SPORTS.has(row.sport)&&!row.researchOnly))&&<div className="fpb-side">
   {record&&<HitRing record={record}/>}
   {priced&&<span className="fpb-price" title={`${priced.name} ${american(priced[sideKey])}`}>
    <img src={priced.logo} alt={priced.name} width="18" height="18" onError={e=>{e.currentTarget.hidden=true;}}/>
    <b data-side={priced[sideKey]<0?'fav':'dog'}>{american(priced[sideKey])}</b></span>}
   {/* The line on the chart, graded the Slip Analyzer's way (AnalyzeProp.jsx). */}
   {!row.researchOnly&&<AnalyzeButton row={row} line={Number(line)} playerRows={playerRows}/>}
  </div>}
 </div>;
 const oddsRow=(odds||pick||books.length>0)?<div className="fpb-odds" role="list" aria-label={`Odds at ${line}`}>
  {odds&&<div className="fpb-card fpb-chance" role="listitem" title="Market chance">
   <span className="fpb-chance-mark" aria-hidden="true"><Percent size={17}/></span>
   <span className="fpb-lines"><span><b>O</b><em data-side="over">{finite(odds.over)?odds.over.toFixed(1)+'%':'—'}</em></span><span><b>U</b><em data-side="under">{finite(odds.under)?odds.under.toFixed(1)+'%':'—'}</em></span></span>
   <Info size={16} className="fpb-info" aria-label={`Chance implied by ${odds.book.name} odds`}/>
  </div>}
  {pick&&<div className="fpb-card fpb-pick" role="listitem" title={`PrizePicks ${tier?tier[0].toUpperCase()+tier.slice(1):'standard'} line at ${line}`}>
   <img src={PRIZEPICKS_LOGO} alt="PrizePicks" width="30" height="30"/>{tier?<img src={`/prizepicks/${tier}.png`} alt={tier} width="26" height="26"/>:<small>More / Less</small>}
  </div>}
  {books.map(book=><div className="fpb-card" role="listitem" key={book.key} title={book.name}>
   <img src={book.logo} alt={book.name} width="30" height="30" onError={e=>{e.currentTarget.hidden=true;}}/>
   <span className="fpb-lines"><span><b data-side="over">O</b>{american(book.over)}</span><span><b data-side="under">U</b>{american(book.under)}</span></span>
  </div>)}
 </div>:null;
 if(layout==='v2'){
  const canAnalyze=ANALYZE_SPORTS.has(row.sport)&&!row.researchOnly;
  const bet=<div className="fp2-bet">
   <h2 className="fp2-bet-title">{row.market}</h2>
   {row.researchOnly?<span className="fp2-bet-note">No PrizePicks line tonight</span>
    :<span className="fp2-bet-side" data-side={side==='Less'?'less':'more'}>{side} {shownLine}</span>}
   {tier&&!row.researchOnly&&<img src={`/prizepicks/${tier}.png`} alt={tier} width="18" height="18"/>}
   {priced&&<span className="fp2-bet-price" title={`${priced.name} ${american(priced[sideKey])}`}><img src={priced.logo} alt={priced.name} width="16" height="16" onError={e=>{e.currentTarget.hidden=true;}}/>
    <b data-side={priced[sideKey]<0?'fav':'dog'}>{american(priced[sideKey])}</b></span>}
   {canAnalyze&&!slots?.tools&&<AnalyzeButton row={row} line={Number(line)} playerRows={playerRows}/>}
  </div>;
  return <header ref={ref} className={`fpb fp2-head${slots?' fpb-merged':''}`}>
   <div className="fp2-top">
    <button type="button" className="fp2-back" aria-label="Back to Finder" onClick={onBack}><ArrowLeft size={19} aria-hidden="true"/></button>
    <span className="fp2-who">
     <span className="fpb-avatar fp2-avatar"><span className="fpb-initials" aria-hidden="true">{initials}</span>
      {row.headshot&&<img className="fpb-photo" src={row.headshot} alt="" onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
     <span className="fp2-name"><h1>{row.player}</h1>
      <small>{row.position&&<><b>{row.position}</b><i aria-hidden="true">·</i></>}{row.teamLogo&&<img src={row.teamLogo} alt="" width="14" height="14" onError={e=>{e.currentTarget.hidden=true;}}/>}<span>{gameLabel(row)}</span>
       {time&&<><i aria-hidden="true">·</i><span>{time}</span></>}</small></span>
    </span>
    <span className="fp2-actions">
     <button type="button" className="fpb-account fp2-account" aria-label="Your account" aria-haspopup="dialog" onClick={pressAccount}><UserRound size={18} aria-hidden="true"/></button></span>
   </div>
   {slots?createPortal(bet,slots.hero):bet}
   {canAnalyze&&slots?.tools&&createPortal(<span className="fp2-analyze"><AnalyzeButton row={row} line={Number(line)} playerRows={playerRows}/></span>,slots.tools)}
   {oddsRow&&(slots?.quotes?createPortal(oddsRow,slots.quotes):oddsRow)}
  </header>;
 }
 return <header ref={ref} className={`fpb${slots?' fpb-merged':''}`}>
  <div className="fpb-top">
   <button type="button" className="fpb-back" aria-label="Back to Finder" onClick={onBack}><ArrowLeft size={18} aria-hidden="true"/>Back</button>
   <span className="fpb-brand"><img src="/brand/propscout-logo.svg" alt="PropScout" width="119" height="22"/></span>
   <button type="button" className="fpb-account" aria-label="Your account" aria-haspopup="dialog" onClick={pressAccount}><UserRound size={18} aria-hidden="true"/></button>
  </div>
  {slots?.tabs&&createPortal(<TrendSwitch section={slots.section}/>,slots.tabs)}
  {slots?createPortal(hero,slots.hero):hero}
  {oddsRow&&(slots?.quotes?createPortal(oddsRow,slots.quotes):oddsRow)}
 </header>;
}
