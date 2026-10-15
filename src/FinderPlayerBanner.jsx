import React,{useEffect,useState} from 'react';
import {ArrowLeft,Info,Percent,UserRound} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {useTeamTint} from './team-tint';
import './finder-player-banner.css';

// The player header on a Finder player page (WNBA and MLB): the page's own
// gradient header rather than a separate
// card -- back / brand / account, the player with team badge, position and
// height, the game, and the book odds for the line on the chart.
//
// The player sits on a card washed in his team's color (read off its logo,
// team-tint.js) with the logo large and faint behind him, and the pick in
// one line under his name: More 9.5 › Receiving Yards.
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
 return `${date.toLocaleDateString([],{weekday:'short'})} @ ${date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(/\s/g,'')}`;
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

export function FinderPlayerBanner({row,playerRows=[],onBack}){
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
 const time=gameTime(row.startsAt),league=LEAGUE_LOGOS[String(row.sport||'').toLowerCase()];
 const initials=String(row.player||'').split(' ').map(part=>part[0]).slice(0,2).join('');
 const tint=useTeamTint(row.teamLogo);
 const side=String(row.direction||'OVER').toUpperCase()==='UNDER'?'Less':'More';
 const shownLine=finite(Number(line))?(Number.isInteger(Number(line))?String(line):Number(line).toFixed(1)):'';
 return <header className="fpb" style={tint?{'--fpb-team':tint}:undefined} data-tinted={tint?'true':'false'}>
  <div className="fpb-top">
   <button type="button" className="fpb-back" aria-label="Back to Finder" onClick={onBack}><ArrowLeft size={18} aria-hidden="true"/>Back</button>
   <span className="fpb-brand"><img src="/brand/ace-props-wordmark.png" alt="Ace Props" width="84" height="32"/></span>
   <button type="button" className="fpb-account" aria-label="Your account" aria-haspopup="dialog" onClick={pressAccount}><UserRound size={18} aria-hidden="true"/></button>
  </div>
  <div className="fpb-hero">
  {row.teamLogo&&<img className="fpb-watermark" src={row.teamLogo} alt="" aria-hidden="true" onError={e=>{e.currentTarget.hidden=true;}}/>}
  <div className="fpb-player">
   <span className="fpb-avatar"><span className="fpb-initials" aria-hidden="true">{initials}</span>
    {row.headshot&&<img className="fpb-photo" src={row.headshot} alt="" onError={e=>{e.currentTarget.hidden=true;}}/>}
    {row.teamLogo&&<img className="fpb-team" src={row.teamLogo} alt={row.teamAbbr||''} onError={e=>{e.currentTarget.hidden=true;}}/>}</span>
   <div className="fpb-identity">
    <h1>{row.player}{row.position&&<span>{row.position}</span>}{row.height&&<span>{row.height}</span>}</h1>
    <p>{gameLabel(row)}{time&&<><i aria-hidden="true">•</i>{time}</>}{league&&<img className="fpb-league" src={league} alt={String(row.sport||'').toUpperCase()}/>}</p>
    {row.market&&shownLine&&<p className="fpb-prop"><b>{side} {shownLine}</b><i aria-hidden="true">›</i><span>{row.market}</span></p>}
   </div>
  </div>
  </div>
  {(odds||pick||books.length>0)&&<div className="fpb-odds" role="list" aria-label={`Odds at ${line}`}>
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
  </div>}
 </header>;
}
