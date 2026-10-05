import React,{useState} from 'react';
import {Activity,ArrowDown,ArrowUp,ArrowUpRight,ChartColumn,Check,Flame,History,Link2,Plus,Share2,Snowflake,Swords,Target,Timer,TrendingDown,TrendingUp,TriangleAlert,Unlink} from 'lucide-react';
import {finderSlipProp} from './unified-finder-data';
import {pickBuilder} from './pick-builder-client';
import {sharePick} from './pick-share';
import {MatchupCase} from './MatchupCase';

// The data under a Krazy Bot answer (krazy-bot.js pickCard), drawn inside the
// answer card itself. Every section rises in once the card has opened (the
// `kb-rise` rules in krazy-bot.css key off the component's data-phase).

const pct=value=>Math.round(value*100);
// The Slip Analyzer's tiers, so a pick reads the same in both places.
const TIER_LABELS={elite:'Elite',strong:'Strong',lean:'Lean',risky:'Risky',fade:'Fade'};
function Tier({pick,size}){
 if(pick.tier)return <span className="kb-tier" data-tier={pick.tier} data-size={size}>{TIER_LABELS[pick.tier]}</span>;
 return pick.grade?<span className="kb-grade" data-grade={pick.grade} data-size={size} aria-label={`Grade ${pick.grade}`}>{pick.grade}</span>:null;
}
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const delay=seconds=>({'--kb-d':`${seconds}s`});
// Innings the way a box score writes them: 5.2 is five and two thirds.
const innings=value=>{const whole=Math.floor(value+1e-6);return `${whole}.${Math.round((value-whole)*3)}`;};

function Logo({src,alt='',fallback=null}){
 const [failed,setFailed]=useState(false);
 if(!src||failed)return fallback;
 return <img className="kb-logo" src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>;
}

// The player's photo (initials when there is none), with his team's logo pinned to it.
export function Face({src,name,logo,size='lg'}){
 const [failed,setFailed]=useState(false);
 const [noLogo,setNoLogo]=useState(false);
 return <span className="kb-face" data-size={size}>
  {src&&!failed?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<b>{initials(name)}</b>}
  {logo&&!noLogo&&<span className="kb-face-team"><img className="kb-logo" src={logo} alt="" loading="lazy" onError={()=>setNoLogo(true)}/></span>}
 </span>;
}

// A number whose digits roll into place as the card opens, like a counter:
// each digit is a strip of 0-9 twice over, spun to its value. Read out whole.
const STRIP=[...'01234567890123456789'];
function Roll({text}){
 let digit=0;
 return <span className="kb-roll"><span className="kb-sr">{text}</span><span className="kb-roll-face" aria-hidden="true">
  {[...String(text)].map((char,index)=>/\d/.test(char)
   ?<span key={index} className="kb-digit" style={{'--v':Number(char),'--n':digit++}}><span>{STRIP.map((item,j)=><i key={j}>{item}</i>)}</span></span>
   :<span key={index} className="kb-char">{char}</span>)}
 </span></span>;
}

function Game({pick}){
 if(!pick.team&&!pick.opponent)return pick.time?<span className="kb-game">{pick.time}</span>:null;
 return <span className="kb-game">
  {pick.team&&<><Logo src={pick.teamLogo}/>{pick.team}</>}
  {pick.opponent&&<><i>{pick.home===false?'@':'vs'}</i><Logo src={pick.opponentLogo}/>{pick.opponent}</>}
  {pick.time&&<><i>·</i>{pick.time}</>}
 </span>;
}

const Side=({pick})=><span className="kb-side" data-side={pick.side}>{pick.side==='UNDER'?<ArrowDown aria-hidden="true"/>:<ArrowUp aria-hidden="true"/>}{pick.side==='UNDER'?'Under':'Over'}</span>;

export function Bars({pick,compact=false}){
 const {last,line}=pick;
 // Big lines (points, strikeouts) chart from a floor, so the game-to-game swings show.
 const values=last.map(game=>game.value);
 const top=Math.max(...values,line*1.4,1)*1.12;
 const base=line>=5?Math.floor(Math.min(...values,line)*.6):0;
 const height=value=>(value-base)/(top-base)*100;
 const decided=last.filter(game=>game.hit!==null);
 const hits=decided.filter(game=>game.hit).length;
 return <div className="kb-trend" data-compact={compact?'':undefined}>
  {!compact&&<header><span><ChartColumn aria-hidden="true"/>Last {last.length}</span><strong data-good={hits/(decided.length||1)>=.5?'':undefined}><Roll text={`${hits}/${decided.length}`}/> {pick.side==='UNDER'?'under':'over'}</strong></header>}
  <div className="kb-bars" role="img" aria-label={`Last ${last.length} games: ${last.map(game=>figure(game.value)).join(', ')} against a ${figure(line)} line`}>
   <span className="kb-mark" style={{bottom:`${height(line)}%`}}>{!compact&&<em>{figure(line)}</em>}</span>
   {last.map((game,index)=><span key={index} className="kb-bar" data-hit={game.hit===null?'push':game.hit?'hit':'miss'} style={{'--i':index,'--bh':`${Math.max(height(game.value),3)}%`}}>
    {!compact&&<b>{figure(game.value)}</b>}
    <i/>
    {!compact&&<small>{game.label}</small>}
   </span>)}
  </div>
 </div>;
}

function Matchup({matchup,who=null}){
 const short=matchup.short&&/^[+−-]/.test(matchup.short)?matchup.short:null;
 return <div className="kb-matchup">
  {matchup.face?<Face src={matchup.photo} name={matchup.name} size="sm"/>:<span className="kb-matchup-logo"><Logo src={matchup.photo} fallback={<Swords aria-hidden="true"/>}/></span>}
  <p><span>{who?`${who}'s matchup`:'Matchup'}{matchup.hand?` · ${matchup.hand}HP`:''}</span>{matchup.text}</p>
  {matchup.tone&&<em data-tone={matchup.tone}>{matchup.tone==='up'?<TrendingUp aria-hidden="true"/>:<TrendingDown aria-hidden="true"/>}{short||(matchup.tone==='up'?'Edge':'Tough')}</em>}
 </div>;
}

// The matchup grade for the pick's side (0-100, 50 neutral) and what moved
// it most -- the Research model's factors for MLB hitters.
function Rating({rating,mix=false}){
 const top=Math.max(...(rating.factors||[]).map(factor=>Math.abs(factor.impact)),1);
 return <div className="kb-rating" data-tone={rating.tone}>
  <div className="kb-rating-head">
   <span className="kb-rating-ring" style={{'--v':rating.score/100}} aria-hidden="true"><b><Roll text={String(rating.score)}/></b></span>
   <span className="kb-rating-title"><strong>{rating.label} matchup{rating.versus?` vs ${rating.versus}`:''}</strong><small>{rating.tone==='good'?'Supports the pick':rating.tone==='tough'?'Works against the pick':'Neither helps nor hurts'}</small></span>
  </div>
  {rating.factors?.length>0&&<ul className="kb-rating-factors">{rating.factors.map((factor,index)=><li key={factor.name} style={{'--i':index}} data-tone={factor.impact>0?'up':factor.impact<0?'down':undefined}>
   <span><strong>{factor.name}</strong><small>{mix&&factor.name==='Arsenal fit'?factor.detail.split(' · ').slice(0,-1).join(' · '):factor.detail}</small></span>
   <b>{factor.impact>0?'+':factor.impact<0?'−':''}{Math.abs(Math.round(factor.impact))}</b>
   {/* How far it pushed, from the middle: right helps the pick, left hurts it. */}
   <span className="kb-factor-bar" aria-hidden="true"><i style={{'--v':Math.abs(factor.impact)/top}} data-side={factor.impact<0?'left':'right'}/></span>
  </li>)}</ul>}
  {!mix&&rating.pitches?.length>0&&<div className="kb-rating-pitches">{rating.pitches.map(pitch=><span key={pitch.name}>{pitch.name}<b>{Math.round(pitch.pct)}%</b></span>)}</div>}
 </div>;
}

// Where the projection lands against the line: the gap between them filled,
// green when it's on the pick's side.
function Gauge({pick}){
 const {projection,line}=pick;
 const low=line>=5?Math.min(projection,line)*.55:0,high=Math.max(projection,line)*1.35||1;
 const at=value=>(value-low)/(high-low)*100;
 const good=pick.side==='UNDER'?projection<line:projection>line;
 return <div className="kb-gauge" data-good={good?'':undefined} role="img" aria-label={`Projects for ${figure(projection)} against a ${figure(line)} line`}>
  <span className="kb-gauge-head"><Target aria-hidden="true"/>Projection<strong><Roll text={figure(projection)}/></strong></span>
  <span className="kb-gauge-track">
   <i className="kb-gauge-fill" style={{left:`${Math.min(at(projection),at(line))}%`,width:`${Math.abs(at(projection)-at(line))}%`,'--from':at(projection)<at(line)?'right':'left'}}/>
   <b className="kb-gauge-line" style={{left:`${at(line)}%`}}><em>Line {figure(line)}</em></b>
   <b className="kb-gauge-dot" style={{left:`${at(projection)}%`,'--from-left':`${at(line)}%`}}/>
  </span>
 </div>;
}

// ---------------------------------------------------------------- the scouting report

const pctText=value=>`${Math.round(value*100)}%`;
const price=value=>value>0?`+${value}`:String(value);
const nice=value=>Number.isInteger(value)?String(value):value.toFixed(1);

// How often he's cleared it over each window, as rings.
function Rings({rings}){
 return <div className="kb-rings">{rings.map((ring,index)=><div key={ring.key} className="kb-ringstat" data-tone={ring.rate>=.6?'up':ring.rate<.45?'down':undefined} style={{'--i':index}}>
  <span className="kb-ringstat-dial" style={{'--v':ring.rate}}><b>{Math.round(ring.rate*100)}<small>%</small></b></span>
  <strong>{ring.label}</strong><small>{ring.won}/{ring.games}</small>
 </div>)}</div>;
}

// How often each result came up over his last games, against the line:
// one column per result when they're few and whole, else even bins with
// the line on a bin's edge. Columns on the pick's side carry the accent.
function Distribution({report}){
 const values=report.games.map(game=>game.value);
 const {line,side}=report;
 const whole=values.every(Number.isInteger)&&Math.max(...values)-Math.min(...values)<=12;
 let bins;
 if(whole){
  const low=Math.min(...values,Math.floor(line)),high=Math.max(...values,Math.ceil(line));
  bins=Array.from({length:high-low+1},(_,index)=>({from:low+index,to:low+index,label:String(low+index)}));
 }else{
  const spread=Math.max(...values,line)-Math.min(...values,line)||1;
  const raw=spread/7,step=[1,2,2.5,5,10,20,25,50,100].find(item=>item>=raw)||Math.ceil(raw);
  const start=line-Math.ceil((line-Math.min(...values,line))/step)*step;
  const count=Math.max(1,Math.ceil((Math.max(...values)-start)/step));
  // Whole-number stats are labelled by the results in each bin (21–22), others by where it starts.
  const counts=values.every(Number.isInteger);
  bins=Array.from({length:count},(_,index)=>{
   const from=start+index*step,to=from+step;
   const first=Math.ceil(from),last=index===count-1?Math.floor(to):Math.ceil(to)-1;
   return {from,to,label:counts?(first===last?String(first):`${first}–${last}`):`${nice(from)}+`};
  });
 }
 const counted=bins.map(bin=>{
  const count=values.filter(value=>whole?value===bin.from:value>=bin.from&&(value<bin.to||bin===bins.at(-1)&&value<=bin.to)).length;
  const middle=whole?bin.from:(bin.from+bin.to)/2;
  return {...bin,count,hit:middle===line?null:side==='UNDER'?middle<line:middle>line};
 });
 const top=Math.max(...counted.map(bin=>bin.count),1);
 const at=whole?counted.findIndex(bin=>bin.from>line):counted.findIndex(bin=>bin.from>=line);
 // The line sits between columns, or on its own column's middle when it's whole.
 const own=whole&&Number.isInteger(line)?counted.findIndex(bin=>bin.from===line):-1;
 const place=own>=0?(own+.5)/counted.length*100:(at<0?counted.length:at)/counted.length*100;
 const cleared=report.games.filter(game=>game.hit).length;
 return <figure className="kb-dist">
  <figcaption><span><ChartColumn aria-hidden="true"/>Last {values.length}</span><strong>{cleared} of {values.length} {side==='UNDER'?'under':'over'}</strong></figcaption>
  <div className="kb-dist-plot" role="img" aria-label={`His last ${values.length} results against the ${nice(line)} line`}>
   {counted.map((bin,index)=><span key={bin.label} className="kb-dist-col" data-hit={bin.hit==null?'push':bin.hit?'hit':'miss'} style={{'--h':`${bin.count/top*100}%`,'--i':index}}
     title={`${bin.count} game${bin.count===1?'':'s'} at ${whole?bin.label:`${bin.label}–${nice(bin.to)}`}`}>
    {bin.count>0&&<b>{bin.count}</b>}<i/><small>{bin.label}</small>
   </span>)}
   <em className="kb-dist-line" style={{left:`${place}%`}}><span>{nice(line)}</span></em>
  </div>
  {report.stats&&<p className="kb-dist-note">Median {nice(report.stats.median)} · range {nice(report.stats.low)}–{nice(report.stats.high)}{report.stats.projection!=null?` · projects ${nice(Math.round(report.stats.projection*10)/10)}`:''}</p>}
 </figure>;
}

// Game by game with a five-game average through them and the line across;
// tap or hover for any game.
function TrendChart({report}){
 const games=report.games,{line}=report;
 const [hover,setHover]=useState(null);
 const W=400,H=130,padX=12,padR=60,top=14,bottom=18;
 // Scaled to his range, so a 26.5-point line doesn't flatten the games against the top.
 const lo=Math.min(...games.map(game=>game.value),line),hi=Math.max(...games.map(game=>game.value),line),spread=hi-lo||1;
 const low=Math.max(0,lo-spread*.3),high=hi+spread*.15;
 const x=index=>padX+index*(W-padX-padR)/Math.max(games.length-1,1);
 const y=value=>top+(1-(value-low)/(high-low))*(H-top-bottom);
 const rolling=games.map((_,index)=>{const window=games.slice(Math.max(0,index-4),index+1);return window.reduce((sum,game)=>sum+game.value,0)/window.length;});
 const path=rolling.map((value,index)=>`${index?'L':'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
 const shown=hover??games.length-1,game=games[shown];
 const pick=event=>{const box=event.currentTarget.getBoundingClientRect();const at=(event.clientX-box.left)/box.width*W;setHover(Math.max(0,Math.min(games.length-1,Math.round((at-padX)/((W-padX-padR)/Math.max(games.length-1,1))))));};
 return <figure className="kb-trendline">
  <figcaption><span><Activity aria-hidden="true"/>Game by game</span><span className="kb-legend"><i data-key="hit"/>{report.side==='UNDER'?'under':'over'}<i data-key="miss"/>{report.side==='UNDER'?'over':'under'}<i data-key="line"/>5-game avg</span></figcaption>
  <p className="kb-readout"><strong>{nice(game.value)}</strong>{game.date}{game.opponent?` ${game.home===false?'@':'vs'} ${game.opponent}`:''}<span>5-game avg {nice(Math.round(rolling[shown]*10)/10)}</span></p>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Each of his last ${games.length} games with a five-game average`} onPointerMove={pick} onPointerDown={pick} onPointerLeave={event=>{if(event.pointerType==='mouse')setHover(null);}}>
   <line className="kb-tl-line" x1={padX} x2={W-padR+4} y1={y(line)} y2={y(line)}/>
   <text className="kb-tl-label" x={W-padR+7} y={y(line)+3.5}>Line {nice(line)}</text>
   <line className="kb-tl-cross" x1={x(shown)} x2={x(shown)} y1={top-6} y2={H-bottom}/>
   <path className="kb-tl-avg" d={path} pathLength="1"/>
   {games.map((item,index)=><circle key={index} className="kb-tl-dot" data-hit={item.hit==null?'push':item.hit?'hit':'miss'} data-on={index===shown?'':undefined} cx={x(index)} cy={y(item.value)} r={index===shown?5.5:4}/>)}
   <text className="kb-tl-axis" x={padX} y={H-3}>{games[0].date}</text>
   <text className="kb-tl-axis" x={W-padR} y={H-3} textAnchor="end">{games.at(-1).date}</text>
  </svg>
 </figure>;
}

// Home and road, today's venue marked, and his games against this opponent.
function Splits({splits,side}){
 const rows=[['home','Home',splits.home],['away','Road',splits.away]].filter(([, , data])=>data&&data.decided);
 const word=side==='UNDER'?'under':'over';
 return <div className="kb-splits">
  {rows.map(([key,label,data],index)=><div key={key} className="kb-split" data-today={splits.today===key?'':undefined} style={{'--i':index}}>
   <span className="kb-split-name">{label}{splits.today===key&&<em>Today</em>}</span>
   <span className="kb-split-track"><i style={{'--v':data.won/data.decided}}/></span>
   <span className="kb-split-num"><strong>{data.won}/{data.decided}</strong><small>avg {nice(Math.round(data.avg*10)/10)}</small></span>
  </div>)}
  {splits.versus&&<div className="kb-versus-games">
   <span>{word==='over'?'Over':'Under'} {splits.versus.won}/{splits.versus.decided} vs {splits.versus.opponent||'them'}</span>
   <div>{splits.versus.games.map((item,index)=><b key={index} data-hit={item.hit==null?'push':item.hit?'hit':'miss'}>{nice(item.value)}<small>{item.date}</small></b>)}</div>
  </div>}
 </div>;
}

// The pitches he'll see and how he hits each, from the arsenal factor.
function pitchResults(rating){
 const detail=(rating.factors||[]).find(item=>item.name==='Arsenal fit')?.detail||'';
 const metric=/weighted AVG/.test(detail)?['AVG',.25]:/weighted SLG/.test(detail)?['SLG',.41]:['wOBA',.32];
 // "Full mix · 100% coverage · .330 weighted AVG · Sinker 60%/.340, Slider 25%/.290"
 const found=detail.split('·').at(-1).split(',').map(part=>part.trim().match(/^(.+?) (\d+)%\/(\d?\.\d+)$/)).filter(Boolean)
  .map(match=>({name:match[1],pct:Number(match[2]),value:Number(match[3])}));
 return {metric,rows:found.length?found:(rating.pitches||[]).map(item=>({name:item.name,pct:item.pct,value:null}))};
}
function PitchMix({rating}){
 const {metric,rows}=pitchResults(rating);
 if(!rows.some(row=>row.value!=null))return null;
 return <div className="kb-pitches">
  <p className="kb-section-title">{rating.versus?`${rating.versus.split(' ').at(-1)}'s pitches`:'The pitches he sees'} · how he hits them</p>
  {rows.map((row,index)=><div key={row.name} className="kb-pitch" style={{'--i':index}} data-tone={row.value==null?undefined:row.value>=metric[1]?'up':'down'}>
   <span>{row.name}</span>
   <span className="kb-pitch-track"><i style={{'--v':Math.min(row.pct,100)/100}}/></span>
   <b>{Math.round(row.pct)}%</b>
   <strong>{row.value==null?'—':row.value.toFixed(3).replace(/^0/,'')}<small>{metric[0]}</small></strong>
  </div>)}
 </div>;
}

// Where the opponent ranks against his position: toughest to easiest.
function DefenseTrack({defense,side}){
 const at=defense.teams>1?(defense.rank-1)/(defense.teams-1):.5;
 const good=side==='UNDER'?at<.34:at>.66;
 return <div className="kb-dtrack" data-tone={good?'up':at>.34&&at<.66?undefined:'down'}>
  <p className="kb-section-title">Defense vs {defense.position||'his position'}</p>
  <span className="kb-dtrack-bar"><i style={{left:`${at*100}%`}}/></span>
  <span className="kb-dtrack-ends"><small>Toughest</small><strong>{defense.rank} of {defense.teams}</strong><small>Easiest</small></span>
 </div>;
}

// Our chance against the books', each book's price, and his other lines.
function Market({report}){
 const {market,books,ladder}=report;
 return <div className="kb-market">
  {market.model!=null&&<div className="kb-vs">
   {[['Krazy model',market.model,'model'],['Books',market.books,'books']].filter(([, value])=>value!=null).map(([label,value,key],index)=><div key={key} className="kb-vs-row" data-key={key} style={{'--i':index}}>
    <span>{label}</span><span className="kb-vs-track"><i style={{'--v':value}}/></span><strong>{pctText(value)}</strong>
   </div>)}
   {market.edge!=null&&<p className="kb-edge" data-tone={market.edge>=.02?'up':market.edge<=-.02?'down':undefined}>{market.edge>=0?'+':'−'}{Math.abs(Math.round(market.edge*100))}% {market.edge>=0?'edge over':'behind'} the books</p>}
  </div>}
  {books.length>0&&<div className="kb-books">
   <p className="kb-section-title">Prices on this side</p>
   {books.map((book,index)=><div key={book.name} className="kb-book" data-best={index===0?'':undefined} style={{'--i':index}}>
    <span>{book.name}{index===0&&<em>Best</em>}</span><strong>{price(book.price)}</strong><small>{pctText(book.chance)}</small>
   </div>)}
  </div>}
  {ladder.length>1&&<div className="kb-ladder">
   <p className="kb-section-title">His lines on this stat</p>
   {ladder.map((rung,index)=><div key={`${rung.line}-${rung.modifier}`} className="kb-rung" data-current={rung.current?'':undefined} style={{'--i':index}}>
    <strong>{nice(rung.line)}</strong>
    <span className="kb-mod" data-mod={rung.modifier}>{rung.modifier==='standard'?'Line':rung.modifier}</span>
    <small>{rung.recent?`${rung.recent.won}/${rung.recent.games} last ${rung.recent.games}`:''}</small>
    <b>{rung.chance!=null?pctText(rung.chance):'—'}</b>
   </div>)}
  </div>}
 </div>;
}

// Put the pick in My Slip, open it in the Finder, or share it as an image.
function Actions({pick}){
 const [added,setAdded]=useState(false);
 const [sharing,setSharing]=useState(false);
 if(!pick.row)return null;
 const add=()=>{
  if(added){pickBuilder.open();return;}
  pickBuilder.set(finderSlipProp(pick.row),pick.side==='UNDER'?'Under':'Over');setAdded(true);
 };
 const open=()=>{
  window.dispatchEvent(new CustomEvent('vortex:open-prop',{detail:{sport:pick.row.sport,player:pick.row.player,stat:pick.row.raw?.stat||pick.row.market}}));
  window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:'finder'}}));
 };
 const share=async()=>{setSharing(true);try{await sharePick(pick);}finally{setSharing(false);}};
 return <div className="kb-actions">
  <button type="button" onClick={add} data-done={added?'':undefined}>{added?<Check aria-hidden="true"/>:<Plus aria-hidden="true"/>}{added?'Open slip':'Add to slip'}</button>
  <button type="button" onClick={open}><ArrowUpRight aria-hidden="true"/>Finder</button>
  <button type="button" onClick={share} disabled={sharing}><Share2 aria-hidden="true"/>{sharing?'Making…':'Share'}</button>
 </div>;
}

function PickCard({pick,verdict,reasons}){
 const chance=pct(pick.chance);
 const report=pick.report;
 const tabs=[['overview','Overview'],
  report?.games?.length>=5&&['trends','Trends'],
  (pick.case||pick.rating||pick.matchup||report?.defense)&&['matchup','Matchup'],
  report&&(report.books.length||report.ladder.length>1||report.market.model!=null)&&['market','Market']].filter(Boolean);
 const [tab,setTab]=useState('overview');
 const mixed=Boolean(pick.rating)&&pitchResults(pick.rating).rows.some(row=>row.value!=null);
 // Sections rise in one after another as the card opens; after a tab
 // change they come in quicker.
 const [moved,setMoved]=useState(false);
 const soon=seconds=>delay(moved?seconds*.25:seconds);
 return <div className="kb-card" data-kind="pick">
  <div className="kb-head kb-rise" style={delay(.04)}>
   <Face src={pick.headshot} name={pick.player} logo={pick.teamLogo}/>
   <div className="kb-who"><strong>{pick.player}</strong><Game pick={pick}/></div>
   {verdict?<span className="kb-verdict" data-tone={verdict.tone}>{verdict.label}</span>:<Tier pick={pick}/>}
  </div>
  <div className="kb-line kb-rise" style={delay(.12)}>
   <Side pick={pick}/>
   <span className="kb-line-text"><strong>{figure(pick.line)}</strong> {pick.stat}{pick.modifier!=='standard'&&<span className="kb-mod" data-mod={pick.modifier}>{pick.modifier}</span>}</span>
   <span className="kb-chance"><strong><Roll text={`${chance}%`}/></strong><small>to hit</small></span>
  </div>
  <div className="kb-meter kb-rise" style={delay(.16)} aria-hidden="true"><i style={{'--v':pick.chance}}/></div>
  {pick.redFlag&&<p className="kb-flag kb-rise" style={delay(.18)}><TriangleAlert aria-hidden="true"/><span><strong>Red flag</strong>{pick.redFlag}</span></p>}
  {tabs.length>1&&<div className="kb-tabs kb-rise" role="tablist" aria-label="Report" style={delay(.18)}>
   {tabs.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} data-on={tab===key?'':undefined} onClick={()=>{setTab(key);setMoved(true);}}>{label}</button>)}
  </div>}
  {/* Each tab in two columns (side by side when the card is wide, krazy-bot.css) and a full-width foot. */}
  {tab==='overview'&&<div className="kb-pane">
   <div className="kb-col">
    {pick.projection!=null&&<div className="kb-rise" style={soon(.2)}><Gauge pick={pick}/></div>}
    {pick.last.length>=3&&<div className="kb-rise" style={soon(.28)}><Bars pick={pick}/></div>}
   </div>
   <div className="kb-col">
    {report?.rings?.length>1&&<div className="kb-rise" style={soon(.34)}><Rings rings={report.rings}/></div>}
    {pick.tiles.length>0&&<div className="kb-tiles kb-rise" style={soon(.4)}>
     {pick.tiles.map((tile,index)=><div key={tile.key} className="kb-tile" data-tone={tile.tone||undefined} style={{'--i':index}}><b><Roll text={tile.value}/></b><span>{tile.label}</span></div>)}
    </div>}
   </div>
   <div className="kb-span">
    {pick.case?<div className="kb-rise" style={soon(.46)}><MatchupCase matchup={pick.case} limit={3} expandable={false}/></div>
     :pick.matchup&&<div className="kb-rise" style={soon(.46)}><Matchup matchup={pick.matchup}/></div>}
    {reasons?.length>0&&<ul className="kb-why kb-rise" style={soon(.54)}>{reasons.map((text,index)=><li key={text} style={{'--i':index}}><Check aria-hidden="true"/>{text}</li>)}</ul>}
    {pick.risks.length>0&&<p className="kb-risk kb-rise" style={soon(.6)}><TriangleAlert aria-hidden="true"/>{pick.risks.join(' · ')}</p>}
   </div>
  </div>}
  {tab==='trends'&&<div className="kb-pane">
   <div className="kb-col"><div className="kb-rise" style={delay(.04)}><Distribution report={report}/></div></div>
   <div className="kb-col"><div className="kb-rise" style={delay(.12)}><TrendChart report={report}/></div></div>
   <div className="kb-span"><div className="kb-rise" style={delay(.2)}><Splits splits={report.splits} side={pick.side}/></div></div>
  </div>}
  {tab==='matchup'&&<div className="kb-pane">
   <div className="kb-col">
    {pick.case?<div className="kb-rise" style={delay(.04)}><MatchupCase matchup={pick.case}/></div>
     :pick.rating?<div className="kb-rise" style={delay(.04)}><Rating rating={pick.rating} mix={mixed}/></div>
     :pick.matchup&&<div className="kb-rise" style={delay(.04)}><Matchup matchup={pick.matchup}/></div>}
   </div>
   <div className="kb-col">
    {mixed&&<div className="kb-rise" style={delay(.12)}><PitchMix rating={pick.rating}/></div>}
    {report?.defense&&<div className="kb-rise" style={delay(.16)}><DefenseTrack defense={report.defense} side={pick.side}/></div>}
    {report?.role&&<p className="kb-note kb-rise" style={delay(.2)}><Timer aria-hidden="true"/>{report.role.text}</p>}
   </div>
  </div>}
  {tab==='market'&&<div className="kb-rise" style={delay(.04)}><Market report={report}/></div>}
  <div className="kb-rise" style={delay(.62)}><Actions pick={pick}/></div>
 </div>;
}

function ComparePick({pick,best,index}){
 return <div className="kb-versus-side kb-rise" data-best={best?'':undefined} style={delay(.06+index*.1)}>
  {best&&<span className="kb-ribbon">My pick</span>}
  <Face src={pick.headshot} name={pick.player} logo={pick.teamLogo}/>
  <strong>{pick.player}</strong>
  <span className="kb-versus-line"><Side pick={pick}/><span>{figure(pick.line)} {pick.short}</span></span>
  <span className="kb-chance"><strong><Roll text={`${pct(pick.chance)}%`}/></strong><small>{pick.tier?TIER_LABELS[pick.tier]:pick.grade?`grade ${pick.grade}`:'to hit'}</small></span>
  {pick.last.length>=3?<Bars pick={pick} compact/>:<span className="kb-versus-none">No recent games</span>}
  {pick.record&&<span className="kb-versus-rec">{pick.record.won}/{pick.record.games} last {pick.record.games}</span>}
 </div>;
}

function Row({pick,tag,rank,index}){
 return <li className="kb-row kb-rise" style={delay(.06+index*.09)}>
  {rank!=null&&<span className="kb-rank">{rank}</span>}
  <Face src={pick.headshot} name={pick.player} logo={pick.teamLogo} size="md"/>
  <span className="kb-row-main">
   {tag&&<span className="kb-tag">{tag}</span>}
   <strong>{pick.player}</strong>
   <span className="kb-row-line"><Side pick={pick}/>{figure(pick.line)} {pick.short}{pick.opponent&&<i> {pick.home===false?'@':'vs'} {pick.opponent}</i>}</span>
   {tag==='Best matchup'&&pick.matchup?<span className="kb-row-note">{pick.matchup.text}</span>
    :pick.record?<span className="kb-row-note">{pick.record.won}/{pick.record.games} {pick.side==='UNDER'?'under':'over'} last {pick.record.games}</span>:null}
  </span>
  <span className="kb-row-end">
   <Tier pick={pick} size="sm"/>
   <span className="kb-row-pct"><Roll text={`${pct(pick.chance)}%`}/></span>
  </span>
  <span className="kb-row-meter" aria-hidden="true"><i style={{'--v':pick.chance}}/></span>
 </li>;
}

// A starter's last starts as bars of innings (pitch counts under them)
// against the innings he projects for.
function StartsChart({starts,projected}){
 const top=Math.max(7.5,...starts.map(start=>start.ip),projected||0)+.6;
 return <div className="kb-trend">
  <header><span><Timer aria-hidden="true"/>Last {starts.length} starts</span><strong data-good="">{innings(starts.reduce((sum,start)=>sum+start.ip,0)/starts.length)} avg</strong></header>
  <div className="kb-bars" role="img" aria-label={`Innings in his last ${starts.length} starts: ${starts.map(start=>innings(start.ip)).join(', ')}`}>
   {projected!=null&&<span className="kb-mark" style={{bottom:`${projected/top*100}%`}}><em>{figure(projected)}</em></span>}
   {starts.map((start,index)=><span key={index} className="kb-bar" data-hit={projected==null||start.ip>=projected?'hit':'push'} style={{'--i':index,'--bh':`${Math.max(start.ip/top*100,3)}%`}}>
    <b>{innings(start.ip)}</b><i/><small>{start.pitches?`${start.pitches}p`:start.label}</small>
   </span>)}
  </div>
 </div>;
}

function InningsCard({pitchers}){
 return <div className="kb-card" data-kind="innings">{pitchers.map((arm,index)=><div className="kb-arm" key={arm.player}>
  <div className="kb-head kb-rise" style={delay(.04+index*.2)}>
   <Face src={arm.headshot} name={arm.player} logo={arm.teamLogo}/>
   <div className="kb-who"><strong>{arm.player}</strong><Game pick={arm}/></div>
   {arm.projected!=null&&<span className="kb-big"><strong><Roll text={figure(arm.projected)}/></strong><small>proj. innings</small></span>}
  </div>
  {arm.starts.length>0&&<div className="kb-rise" style={delay(.12+index*.2)}><StartsChart starts={arm.starts} projected={arm.projected}/></div>}
  <div className="kb-tiles kb-rise" style={delay(.24+index*.2)}>
   {[arm.recent!=null&&{key:'recent',value:innings(arm.recent),label:'Last 5 avg'},arm.season!=null&&{key:'season',value:figure(arm.season),label:'Season IP/start'},
     arm.pitches!=null&&{key:'pitches',value:String(arm.pitches),label:'Pitches/start'},
     arm.outsLine!=null&&arm.projected!=null&&{key:'outs',value:`${Math.round(arm.projected*3)}`,label:`Outs vs ${figure(arm.outsLine)}`,tone:arm.projected*3>arm.outsLine?'up':'down'}]
    .filter(Boolean).map((tile,tileIndex)=><div key={tile.key} className="kb-tile" data-tone={tile.tone||undefined} style={{'--i':tileIndex}}><b><Roll text={tile.value}/></b><span>{tile.label}</span></div>)}
  </div>
 </div>)}</div>;
}

// Where a number sits among the league's teams (1st to 30th): a dot on a
// track, green when that helps the pick and red when it hurts.
function RankTrack({rank,of,tone}){
 if(!rank||!of)return null;
 return <span className="kb-rank-track" data-tone={tone||undefined} aria-label={`${rank} of ${of}`}>
  <i style={{left:`${(rank-1)/Math.max(of-1,1)*100}%`}}/>
 </span>;
}
const ordinal=n=>`${n}${n%100>=11&&n%100<=13?'th':['th','st','nd','rd'][n%10]||'th'}`;

function MatchupCard({card}){
 const {face,versus}=card;
 return <div className="kb-card" data-kind="matchup">
  <div className="kb-duel kb-rise" style={delay(.04)}>
   <span className="kb-duel-side"><Face src={face.headshot} name={face.player} logo={face.teamLogo}/><strong>{face.player.split(' ').at(-1)}</strong></span>
   <span className="kb-duel-vs"><Swords aria-hidden="true"/>{card.hand&&<em>{card.hand}HP</em>}</span>
   <span className="kb-duel-side">{versus.headshot?<Face src={versus.headshot} name={versus.name} logo={versus.logo}/>
    :<span className="kb-matchup-logo" data-size="lg"><Logo src={versus.logo} fallback={versus.abbr?<b>{versus.abbr}</b>:<Swords aria-hidden="true"/>}/></span>}
    <strong>{versus.headshot?versus.name.split(' ').at(-1):versus.abbr||versus.name}</strong></span>
  </div>
  {card.metrics.length>0&&<ul className="kb-metrics kb-rise" style={delay(.16)}>{card.metrics.map((metric,index)=><li key={metric.key} style={{'--i':index}} data-tone={metric.tone||undefined}>
   <span className="kb-metric-label">{metric.label}{metric.form==='hot'?<Flame aria-label="hot"/>:metric.form==='cold'?<Snowflake aria-label="cold"/>:null}</span>
   <strong><Roll text={metric.value}/></strong>
   {metric.rank?<span className="kb-metric-rank">{ordinal(metric.rank)}{metric.of?<small>/{metric.of}</small>:null}</span>:<span className="kb-metric-rank"/>}
   <RankTrack rank={metric.rank} of={metric.of} tone={metric.tone}/>
  </li>)}</ul>}
  {(card.history||card.h2h||card.projected!=null)&&<div className="kb-tiles kb-rise" style={delay(.3)}>
   {card.history&&<div className="kb-tile" style={{'--i':0}}><b><Roll text={`${card.history.k}`}/></b><span><History aria-hidden="true"/>K in {innings(card.history.ip)} IP</span></div>}
   {card.history&&<div className="kb-tile" style={{'--i':1}}><b><Roll text={`${card.history.er}`}/></b><span>ER vs {versus.abbr||'them'}</span></div>}
   {card.h2h&&<div className="kb-tile" data-tone={card.h2h.won/card.h2h.games>=.5?'up':'down'} style={{'--i':0}}><b><Roll text={`${card.h2h.won}/${card.h2h.games}`}/></b><span>{card.h2h.side} vs {card.h2h.opponent}</span></div>}
   {card.projected!=null&&<div className="kb-tile" style={{'--i':2}}><b><Roll text={figure(card.projected)}/></b><span>Proj. innings</span></div>}
  </div>}
  {card.pick&&<ol className="kb-rows"><Row pick={card.pick} tag="His line" index={4}/></ol>}
 </div>;
}

function TeamsCard({card}){
 const top=Math.max(...card.rows.map(row=>row.share||0),.0001);
 return <div className="kb-card" data-kind="teams">
  <header className="kb-card-title kb-rise" style={delay(.02)}><Activity aria-hidden="true"/>{card.title}</header>
  <ol className="kb-teams">{card.rows.map((team,index)=><li key={team.abbr||index} className="kb-team kb-rise" style={delay(.08+index*.08)} data-form={team.form||undefined}>
   <span className="kb-rank">{index+1}</span>
   <span className="kb-matchup-logo"><Logo src={team.logo} fallback={<b>{team.abbr}</b>}/></span>
   <span className="kb-team-main"><strong>{team.name}</strong>{team.note&&<small>{team.note}</small>}</span>
   <span className="kb-team-end"><strong><Roll text={team.value}/></strong>
    {team.delta!=null?<small data-up={team.delta>=0?'':undefined}>{team.delta>=0?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>}{Math.abs(team.delta).toFixed(3).replace(/^0/,'')}</small>
     :team.form==='hot'?<Flame aria-label="hot"/>:team.form==='cold'?<Snowflake aria-label="cold"/>:null}</span>
   <span className="kb-row-meter" aria-hidden="true"><i style={{'--v':Math.max((team.share||0)/top,.04)}}/></span>
  </li>)}</ol>
  {card.focus&&<div className="kb-tiles kb-rise" style={delay(.2)}>
   <div className="kb-tile" style={{'--i':0}}><b><Roll text={card.focus.recent}/></b><span>OPS, last 10 days</span></div>
   <div className="kb-tile" style={{'--i':1}}><b><Roll text={card.focus.season}/></b><span>OPS, season</span></div>
   {card.focus.runs!=null&&<div className="kb-tile" style={{'--i':2}}><b><Roll text={figure(Math.round(card.focus.runs*10)/10)}/></b><span>Runs/game</span></div>}
   {card.focus.kRate!=null&&<div className="kb-tile" style={{'--i':3}}><b><Roll text={`${pct(card.focus.kRate)}%`}/></b><span>K rate</span></div>}
  </div>}
 </div>;
}

function UsageCard({card}){
 const {face,values}=card;
 const average=Number(card.average);
 const top=Math.max(...values.map(item=>item.value),average)*1.12;
 const base=Math.floor(Math.min(...values.map(item=>item.value),average)*.6);
 const height=value=>(value-base)/(top-base)*100;
 return <div className="kb-card" data-kind="usage">
  <div className="kb-head kb-rise" style={delay(.04)}>
   <Face src={face.headshot} name={face.player} logo={face.teamLogo}/>
   <div className="kb-who"><strong>{face.player}</strong><Game pick={face}/></div>
   <span className="kb-big"><strong><Roll text={card.average}/></strong><small>{card.label} avg</small></span>
  </div>
  <div className="kb-rise" style={delay(.14)}><div className="kb-trend">
   <header><span><Timer aria-hidden="true"/>Last {values.length} games</span><strong data-good="">{card.recent} last 5</strong></header>
   <div className="kb-bars" role="img" aria-label={`${card.label} in his last ${values.length} games: ${values.map(item=>item.value).join(', ')}`}>
    <span className="kb-mark" style={{bottom:`${height(average)}%`}}><em>{card.average}</em></span>
    {values.map((item,index)=><span key={index} className="kb-bar" data-hit={item.value>=average?'hit':'push'} style={{'--i':index,'--bh':`${Math.max(height(item.value),3)}%`}}>
     <b>{figure(item.value)}</b><i/><small>{item.label}</small>
    </span>)}
   </div>
  </div></div>
 </div>;
}

// One row of a cheat-sheet answer: who (a player's photo or the teams'
// logos), a line under it, and the number that matters on the right.
function BoardRow({item,index}){
 return <li className="kb-row kb-board-row kb-rise" style={delay(.06+index*.08)}>
  {item.photo!==undefined&&item.name&&!item.logos?<Face src={item.photo} name={item.name} logo={item.logo} size="md"/>
   :<span className="kb-board-logos">{(item.logos||[]).map((logo,place)=><span key={place} className="kb-matchup-logo"><Logo src={logo} fallback={<Swords aria-hidden="true"/>}/></span>)}</span>}
  <span className="kb-row-main">
   {item.tag&&<span className="kb-tag">{item.tag}</span>}
   <strong>{item.name}</strong>
   {item.sub&&<span className="kb-row-note">{item.sub}</span>}
  </span>
  <span className="kb-row-end kb-board-end" data-tone={item.tone||undefined}>
   <span className="kb-row-pct"><Roll text={String(item.value)}/></span>
   {item.label&&<small>{item.label}</small>}
  </span>
  {item.meter!=null&&<span className="kb-row-meter" aria-hidden="true"><i style={{'--v':item.meter}}/></span>}
 </li>;
}

// A slip from the bot's Elite and Strong picks: each leg, the parlay graded
// as one (the Slip Analyzer's letter), the picks that help each other, and
// one tap to put them all on My Slip.
function SlipCard({card}){
 const [added,setAdded]=useState(false);
 const together=pct(card.together);
 const add=()=>{
  if(!added)card.picks.forEach(pick=>pickBuilder.set(finderSlipProp(pick.row),pick.side==='UNDER'?'Under':'Over'));
  setAdded(true);pickBuilder.open();
 };
 const after=.1+card.picks.length*.09;
 return <div className="kb-card" data-kind="slip">
  <ol className="kb-rows">{card.picks.map((pick,index)=><Row key={pick.player} pick={pick} rank={index+1} index={index}/>)}</ol>
  <div className="kb-slip-foot kb-rise" style={delay(after)}>
   {card.letter&&<span><small>Parlay grade</small><strong className="kb-slip-letter" data-letter={card.letter[0]}><Roll text={card.letter}/></strong></span>}
   <span><small>All {card.picks.length} hit</small><strong><Roll text={`${together}%`}/></strong></span>
   {card.payout&&<span><small>Power Play</small><strong><Roll text={`${card.payout}x`}/></strong></span>}
  </div>
  {card.links?.length>0&&<ul className="kb-slip-links kb-rise" style={delay(after+.06)}>{card.links.map(pair=><li key={pair.text} data-tone={pair.tone}>
   {pair.tone==='together'?<Link2 aria-hidden="true"/>:<Unlink aria-hidden="true"/>}{pair.text[0].toUpperCase()+pair.text.slice(1)}</li>)}</ul>}
  <div className="kb-actions kb-rise" style={delay(after+.12)}>
   <button type="button" onClick={add} data-done={added?'':undefined}>{added?<Check aria-hidden="true"/>:<Plus aria-hidden="true"/>}{added?'Open My Slip':'Add all to My Slip'}</button>
  </div>
 </div>;
}

export function BotCard({card}){
 if(!card)return null;
 if(card.kind==='innings')return <InningsCard pitchers={card.pitchers}/>;
 if(card.kind==='matchup')return <MatchupCard card={card}/>;
 if(card.kind==='teams')return <TeamsCard card={card}/>;
 if(card.kind==='usage')return <UsageCard card={card}/>;
 if(card.kind==='pick')return <PickCard key={`${card.pick.player}-${card.pick.stat}-${card.pick.line}-${card.pick.side}-${card.verdict?.label||''}`} pick={card.pick} verdict={card.verdict} reasons={card.reasons}/>;
 if(card.kind==='compare')return <div className="kb-card" data-kind="compare">
  <div className="kb-versus">{card.picks.map((pick,index)=><ComparePick key={pick.player} pick={pick} best={index===0} index={index}/>)}</div>
  {card.picks[0].matchup&&<div className="kb-rise" style={delay(.32)}><Matchup matchup={card.picks[0].matchup} who={card.picks[0].player.split(' ').at(-1)}/></div>}
 </div>;
 if(card.kind==='board')return <div className="kb-card" data-kind="board">
  {card.title&&<p className="kb-board-title kb-rise" style={delay(.02)}>{card.title}</p>}
  <ol className="kb-rows">{card.rows.map((item,index)=><BoardRow key={`${item.name}-${index}`} item={item} index={index}/>)}</ol>
 </div>;
 if(card.kind==='list')return <div className="kb-card" data-kind="list"><ol className="kb-rows">{card.picks.map((pick,index)=><Row key={pick.player} pick={pick} rank={index+1} index={index}/>)}</ol></div>;
 if(card.kind==='rundown')return <div className="kb-card" data-kind="rundown"><ol className="kb-rows">{card.rows.map((item,index)=><Row key={item.tag} pick={item.pick} tag={item.tag} index={index}/>)}</ol></div>;
 if(card.kind==='slip')return <SlipCard card={card}/>;
 return null;
}
