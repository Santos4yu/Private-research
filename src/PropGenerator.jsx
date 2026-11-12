// The Game Predictor's NBA prop generator (prop-generator.js finds the
// candidates, prop-gameread.js reads each one's game and makes the call;
// this shows it). Nov 8, the owner: "a nicer look and more options to see
// data ... cool animations and transitions and visual effects that dont look
// ai or robotic". Nov 9: "it should think more human less robot and actually
// make decisions that may happen in the game using real raw data to support
// it": each candidate's player context (with / without each teammate,
// players like him against them) is loaded and the game read in full, then
// it's a play or a pass, and a pass says why.
//  - Filters: the stat (a sliding strip), the game, the order.
//  - The best play: our number against his real games on one line, the read
//    in a few sentences, his games (last 10, or by minutes), how the game
//    could go (close or a blowout, his minutes and number in each), and the
//    case for and against, every point from his games or tonight's reports.
//  - The other plays, each opening to the same; then the passes and why.
//  - The best slips from the plays that pay for themselves.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Check,ChevronDown,Layers,RefreshCw,Trophy,X} from 'lucide-react';
import {CountUp} from './count-up.jsx';
import {Face} from './PickParts';
import {SlipToggle,useSlipIds} from './SlipToggle';
import {useInk,inkStyle} from './use-ink.js';
import {nba as store} from './nba-props-data.js';
import {loadLearning} from './learning.js';
import {bestSlips,generateProps,statWords} from './prop-generator.js';
import {propGrades} from './props-grade.js';
import {spreadScores} from './nba-matchup-score.js';
import {callsOf,deepCandidates,minutesPoints,readGame,summaryOf} from './prop-gameread.js';
import {hasPlayerContext,playerContextParams,wnbaGet} from './sports/wnba/wnba-research.js';
import {pickPayload} from './slip-history.js';
import {ChipMenu,Empty,Section,Shimmer} from './gp-parts.jsx';
import './prop-generator.css';

const STATS=[['all','All'],['player_points','Points'],['player_rebounds','Rebounds'],['player_assists','Assists'],
 ['player_points_rebounds_assists','PRA'],['player_points_rebounds','P+R'],['player_points_assists','P+A'],['player_threes','3PM']];
const SHORT={player_points:'PTS',player_rebounds:'REB',player_assists:'AST',player_points_rebounds_assists:'PRA',
 player_points_rebounds:'P+R',player_points_assists:'P+A',player_threes:'3PM'};
const SORTS=[{key:'best',text:'Best picks'},{key:'room',text:'Most over the line',short:'Most room'},{key:'chance',text:'Highest chance'},
 {key:'matchup',text:'Best matchup'},{key:'form',text:'Hottest form'}];
const ORDER={best:item=>item.score,room:item=>item.room??-1,chance:item=>item.chance,matchup:item=>item.read?.score??0,form:item=>item.form??0};
// How long the page waits on tonight's reports and the players' splits before reading without what's missing.
const WAIT_MS=12000,CONTEXT_MS=9000,AT_ONCE=4;

const pct=value=>value==null||!Number.isFinite(value)?'—':`${Math.round(value*100)}%`;
const one=value=>Number.isFinite(value)?String(Math.round(value*10)/10):'—';
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);
const clockText=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';};
const dayText=date=>{const time=Date.parse(`${date}T12:00:00Z`);return Number.isFinite(time)?new Date(time).toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}):'';};
const homeAway=row=>row.awayTeamAbbr&&row.teamAbbr===row.awayTeamAbbr?'@':'vs';
const gameKey=row=>row.gameId||`${row.awayTeamAbbr}@${row.homeTeamAbbr}`;
const gameWords=row=>`${row.teamAbbr||''}${row.opponent?` ${homeAway(row)} ${row.opponent}`:''}${row.startsAt?` · ${clockText(row.startsAt)}`:''}`;
const roleWords=item=>[item.role?.label,Number.isFinite(item.minutes)?`${Math.round(item.minutes)} min`:null].filter(Boolean).join(' · ');
const lineWords=row=>`Over ${row.line} ${statWords(row)}`;
const later=(promise,ms)=>Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(null),ms))]);

// Tonight's NBA board, the one the Props tab keeps warm (nba-props-data.js).
function usePropBoard(){
 const [data,setData]=useState(()=>store.get());
 const [learned,setLearned]=useState(0);
 useEffect(()=>{
  const stop=store.on(setData);
  store.warm();
  const retry=setInterval(()=>{if(!store.get().league)store.refresh();store.freshenTonight?.();},45000);
  // What results have taught the model (learning.js), as the Props tab reads it.
  let live=true;Promise.resolve().then(()=>loadLearning()).then(()=>{if(live)setLearned(Date.now());}).catch(()=>{});
  return()=>{stop();clearInterval(retry);live=false;};
 },[]);
 const rows=useMemo(()=>(data.rows||[]).filter(store.wanted),[data.rows]);
 const league=useMemo(()=>data.league&&data.tonight?{...data.league,tonight:data.tonight}:data.league,[data.league,data.tonight]);
 // Graded once, then picked from two ways: the board's best, and any regular for the full read to judge.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 const graded=useMemo(()=>league?{grades:propGrades(rows,league),reads:spreadScores(rows,league)}:null,[rows,league,learned]);
 const strict=useMemo(()=>graded?generateProps(rows,league,{most:60,...graded}):[],[graded]);
 const loose=useMemo(()=>graded&&league.tonight?generateProps(rows,league,{most:200,strict:false,...graded}):[],[graded]);
 return {data,rows,league,strict,loose};
}

// Each player's context (his splits with and without each teammate, players
// like him against tonight's opponent), kept for the visit: opening the
// generator again reads at once.
const CONTEXTS=new Map();
const contextKey=row=>JSON.stringify(playerContextParams(row));
const settled=row=>!hasPlayerContext(row)||CONTEXTS.has(contextKey(row));

/** The candidates read in full: {reads, done, total, ready}. */
function useGameReads(strict,loose,league,tonight){
 const candidates=useMemo(()=>league?deepCandidates(strict,loose,league):[],[strict,loose,league]);
 const ids=candidates.map(item=>item.row.id).join('|');
 const [tick,setTick]=useState(0),[waited,setWaited]=useState(false);
 const some=candidates.length>0;
 useEffect(()=>{if(!some)return undefined;const timer=setTimeout(()=>setWaited(true),WAIT_MS);return()=>clearTimeout(timer);},[some]);
 useEffect(()=>{
  let live=true;
  const missing=candidates.filter(item=>!settled(item.row));
  let next=0;
  const worker=async()=>{
   while(live&&next<missing.length){
    const {row}=missing[next++];
    const found=await later(wnbaGet('player-context',playerContextParams(row)).catch(()=>null),CONTEXT_MS);
    CONTEXTS.set(contextKey(row),found);
    if(live)setTick(n=>n+1);
   }
  };
  for(let index=0;index<AT_ONCE;index++)worker();
  return()=>{live=false;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ids]);
 const done=candidates.filter(item=>settled(item.row)).length;
 const ready=some&&(done===candidates.length||waited)&&(Boolean(tonight)||waited);
 const reads=useMemo(()=>ready?candidates.map(item=>readGame(item,league,CONTEXTS.get(contextKey(item.row))||null)):[],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [ready,candidates,league,tick]);
 return {reads,done,total:candidates.length,ready};
}

// The calls kept for the site's record (Nov 9, the owner wants the
// generator's full record in History; slip_ledger.generator_add): the plays
// and the passes on games still to start, sent again only when they change.
const SENT_KEY='pg-calls-sent';
const callPayload=read=>({...pickPayload({row:read.row,side:'OVER',grade:{tier:read.tier,chance:read.chance,rawChance:read.deep?.rawChance}}),
 strength:read.call.strength||null,confidence:read.confidence,projection:Number.isFinite(read.projection)?read.projection:null});
function useKeepCalls(reads,ready){
 useEffect(()=>{
  if(!ready||!reads.length)return;
  const open=reads.filter(read=>Date.parse(read.row.startsAt||'')>Date.now()+10*60000);
  const plays=open.filter(read=>read.call.play).slice(0,40),passes=open.filter(read=>!read.call.play).slice(0,40);
  if(!plays.length&&!passes.length)return;
  const sign=[...plays.map(read=>`${read.row.id}:${read.call.strength}:${read.confidence}`),...passes.map(read=>`x:${read.row.id}`)].sort().join('|');
  try{const last=JSON.parse(sessionStorage.getItem(SENT_KEY)||'null');if(last?.sign===sign)return;}catch{/* send it */}
  fetch('/api/prediction?action=game-prop-plays',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({plays:plays.map(callPayload),passes:passes.map(callPayload)})})
   .then(response=>{if(response.ok)try{sessionStorage.setItem(SENT_KEY,JSON.stringify({sign,at:Date.now()}));}catch{/* sent again next time */}})
   .catch(()=>{});
 },[reads,ready]);
}

// A row of choices with one soft pill gliding to the picked one (scrolls on a phone).
function ChipStrip({options,value,onChange,label,className=''}){
 const row=useRef(null),ink=useInk(row,value,'[aria-checked=true]');
 return <div className={`gp-daystrip pg-strip ${className}`} role="radiogroup" aria-label={label} ref={row}>
  <span className="gp-day-ink" style={inkStyle(ink)} aria-hidden="true"/>
  {options.map(([key,text])=><button type="button" role="radio" key={key} aria-checked={value===key} onClick={()=>onChange(key)}>{text}</button>)}
 </div>;
}

// How sure, 0-100, as a ring that fills when it shows.
function ConfidenceRing({value,size=74}){
 const radius=size/2-5,around=2*Math.PI*radius;
 const [shown,setShown]=useState(0);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setShown(value));return()=>cancelAnimationFrame(frame);},[value]);
 const tone=value>=70?'high':value>=56?'mid':'low';
 return <span className="pg-ring" data-tone={tone} style={{width:size,height:size}}>
  <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
   <circle cx={size/2} cy={size/2} r={radius} className="pg-ring-track"/>
   <circle cx={size/2} cy={size/2} r={radius} className="pg-ring-fill" strokeDasharray={around} strokeDashoffset={around*(1-shown/100)}/>
  </svg>
  <b><CountUp value={value} ms={900}/></b>
 </span>;
}

// Our number against his real games, on one line: a dot for each of his last
// 10 (bright when over the line), the line, and our number sliding out from it.
function NumberLine({item}){
 const {row}=item,line=Number(row.line),games=(item.games||[]).map(game=>game.value).filter(Number.isFinite);
 const ours=Number.isFinite(item.projection)?item.projection:null;
 const [moved,setMoved]=useState(false);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setMoved(true));return()=>cancelAnimationFrame(frame);},[]);
 if(!games.length||ours==null)return null;
 const low=Math.min(line,ours,...games),high=Math.max(line,ours,...games),pad=(high-low)*0.08||1;
 const at=value=>`${(value-low+pad)/(high-low+2*pad)*100}%`;
 // Games on one value stack up instead of hiding each other.
 const stacks=new Map();
 const dots=games.map((value,index)=>{const key=Math.round(value*2)/2,level=stacks.get(key)||0;stacks.set(key,level+1);return {value,index,level};});
 return <div className="pg-numline" role="img" aria-label={`Our number ${one(ours)} against a line of ${line}; his last ${games.length}: ${games.map(figure).join(', ')}`}>
  <div className="pg-numline-track">
   {dots.map(dot=><i key={dot.index} className="pg-numline-game" data-over={dot.value>line||undefined} style={{left:at(dot.value),'--lift':`${dot.level*9}px`,'--i':dot.index}}/>)}
   <span className="pg-numline-line" style={{left:at(line)}}><small>Line {line}</small></span>
   <span className="pg-numline-ours" data-over={ours>line||undefined} style={{left:moved?at(ours):at(line)}}><small>Our number <b>{one(ours)}</b></small></span>
  </div>
  <div className="pg-numline-key"><span className="is-over">Over the line</span><span className="is-under">Under it</span><span>His last {games.length}</span></div>
 </div>;
}

// His last 10 games in the stat: a bar each against the line (over in the
// pick's color, short of it muted), the values on top, the opponents under.
function GameChart({item}){
 const games=item.games||[],line=Number(item.row.line);
 if(games.length<3)return null;
 const top=Math.max(line*1.35,...games.map(game=>game.value))*1.08;
 const y=value=>`${Math.min(100,value/top*100)}%`;
 return <div className="pg-chart" role="img" aria-label={`His last ${games.length}: ${games.map(game=>figure(game.value)).join(', ')} against a line of ${line}`}>
  <div className="pg-chart-plot">
   <span className="pg-chart-line" style={{bottom:y(line)}}/>
   {item.average!=null&&<span className="pg-chart-avg" style={{bottom:y(item.average)}}/>}
   {games.map((game,index)=><span key={index} className="pg-chart-col" data-over={game.value>line||undefined} style={{'--i':index}}>
    <i style={{height:y(game.value)}}><small>{figure(game.value)}</small></i>
   </span>)}
  </div>
  <div className="pg-chart-axis">{games.map((game,index)=><small key={index}>{String(game.opponent||'').slice(0,3)}</small>)}</div>
  <div className="pg-chart-key"><span className="is-line">Line {line}</span>{item.average!=null&&<span className="is-avg">His average {figure(Math.round(item.average*10)/10)}</span>}
   <span className="is-over">Over the line</span></div>
 </div>;
}

// His last 15 by minutes played against what he did: the line across, a
// mark at the minutes we expect tonight. A tap anywhere picks the nearest game.
function MinutesChart({item}){
 const points=useMemo(()=>minutesPoints(item.row),[item.row]);
 const [picked,setPicked]=useState(null);
 const plot=useRef(null);
 if(points.length<5)return null;
 const line=Number(item.row.line),tonight=Number.isFinite(item.minutes)?item.minutes:null;
 const W=320,H=160,L=30,R=10,T=18,B=24;
 const xs=points.map(point=>point.minutes).concat(tonight??[]);
 const x0=Math.floor(Math.min(...xs)-2),x1=Math.ceil(Math.max(...xs)+2);
 const y1=Math.max(line*1.3,...points.map(point=>point.value))*1.08;
 const x=value=>L+(value-x0)/(x1-x0||1)*(W-L-R),y=value=>T+(1-value/y1)*(H-T-B);
 const ticks=[x0,Math.round((x0+x1)/2),x1];
 const shown=picked!=null?points[picked]:null;
 const pick=event=>{
  const box=plot.current?.getBoundingClientRect();
  if(!box?.width)return;
  const px=(event.clientX-box.left)/box.width*W,py=(event.clientY-box.top)/box.height*H;
  let best=null,far=Infinity;
  points.forEach((point,index)=>{const gap=(x(point.minutes)-px)**2+(y(point.value)-py)**2;if(gap<far){far=gap;best=index;}});
  if(far<=36*36)setPicked(best);
 };
 return <div className="pg-scatter">
  <svg ref={plot} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`His last ${points.length} games by minutes: ${points.map(point=>`${figure(point.value)} in ${Math.round(point.minutes)}`).join(', ')}; line ${line}`}>
   <line x1={L} x2={W-R} y1={H-B} y2={H-B} className="pg-scatter-axis"/>
   {ticks.map(tick=><text key={tick} x={x(tick)} y={H-B+15} textAnchor="middle" className="pg-scatter-tick">{tick}</text>)}
   <text x={L-6} y={y(line)+3.5} textAnchor="end" className="pg-scatter-tick">{line}</text>
   <line x1={L} x2={W-R} y1={y(line)} y2={y(line)} className="pg-scatter-line"/>
   {tonight!=null&&<g className="pg-scatter-tonight"><line x1={x(tonight)} x2={x(tonight)} y1={T-6} y2={H-B}/><text x={x(tonight)} y={T-8} textAnchor="middle">Tonight ~{Math.round(tonight)} min</text></g>}
   {points.map((point,index)=><circle key={index} cx={x(point.minutes)} cy={y(point.value)} r="5.5" className="pg-scatter-mark"
    data-over={point.over||undefined} data-picked={picked===index||undefined} style={{'--i':index}}/>)}
   <rect x={L} y={T-6} width={W-L-R} height={H-T-B+6} className="pg-scatter-hit" onClick={pick} onPointerMove={event=>{if(event.pointerType==='mouse')pick(event);}}/>
  </svg>
  <p className="pg-scatter-note">{shown?<><b>{figure(shown.value)} {statWords(item.row)}</b> in {Math.round(shown.minutes)} minutes{shown.opponent?` vs ${shown.opponent}`:''}{shown.date?`, ${dayText(shown.date)}`:''}</>
   :'Minutes across, what he did up. Tap a game.'}</p>
 </div>;
}

// His games, two ways.
function HisGames({item}){
 const [view,setView]=useState('last');
 const byMinutes=minutesPoints(item.row).length>=5;
 return <div className="pg-games">
  {byMinutes&&<ChipStrip className="pg-seg" options={[['last','Last 10'],['minutes','By minutes']]} value={view} onChange={setView} label="His games"/>}
  {view==='minutes'&&byMinutes?<MinutesChart item={item}/>:<GameChart item={item}/>}
 </div>;
}

// How the game could go: close, or a blowout either way, and what each means for him.
function Scenarios({item}){
 const list=item.scenarios;
 if(!list)return null;
 return <div className="pg-block"><h4>How the game could go</h4><ul className="pg-scen">{list.map((part,index)=><li key={part.key} style={{'--i':index}}>
  <span className="pg-scen-name">{part.label}<small>{pct(part.chance)} · about {Math.round(part.minutes)} min</small></span>
  <span className="pg-scen-bar"><i style={{'--w':part.chance}}/></span>
  <b data-clears={part.clears||undefined}>{one(part.projection)}{part.clears?<Check size={14} aria-label="over the line"/>:<X size={14} aria-label="under the line"/>}</b>
 </li>)}</ul></div>;
}

// The case for and against, each point from his games or tonight's reports.
function Case({item}){
 const order={for:0,against:1,info:2};
 const beats=[...item.beats].sort((a,b)=>order[a.side]-order[b.side]||b.weight-a.weight);
 const count=side=>item.beats.filter(part=>part.side===side).length;
 return <div className="pg-block"><h4>The case <small>{count('for')} for · {count('against')} against</small></h4>
  <ul className="pg-whylist">{beats.map((part,index)=><li key={part.key} data-side={part.side} style={{'--i':index}}>
   <b>{part.title}</b><p>{part.text}</p>
  </li>)}</ul>
 </div>;
}

function Details({item,saved}){
 return <>
  <NumberLine item={item}/>
  <p className="pg-summary">{summaryOf(item)}</p>
  <HisGames item={item}/>
  <Scenarios item={item}/>
  <Case item={item}/>
  <SlipToggle row={item.row} saved={saved} stat={statWords(item.row)} full className="pg-save"/>
 </>;
}

function Hero({item,saved}){
 const {row,call}=item;
 return <section className="gp-pick pg-hero" key={row.id}>
  <div className="gp-pick-top"><span className="gp-kicker"><Trophy size={14} aria-hidden="true"/>Best play tonight</span>
   <span className="pg-tier" data-strength={call.strength}>{call.label}</span></div>
  <div className="pg-hero-main">
   <Face row={row}/>
   <span className="pg-hero-who"><b>{row.player}</b><strong>{lineWords(row)}</strong><small>{[gameWords(row),roleWords(item)].filter(Boolean).join(' · ')}</small></span>
   <span className="pg-hero-ring"><ConfidenceRing value={item.confidence}/><small>Confidence</small></span>
  </div>
  <Details item={item} saved={saved}/>
 </section>;
}

function PropRow({item,index,open,onToggle,saved}){
 const {row,call}=item;
 const [seen,setSeen]=useState(open);
 useEffect(()=>{if(open)setSeen(true);},[open]);
 const games=item.games||[];
 return <li className="pg-row" data-open={open||undefined} data-pass={!call.play||undefined} style={{'--i':Math.min(index,14)}}>
  <button type="button" className="pg-row-head" onClick={onToggle} aria-expanded={open}>
   <Face row={row}/>
   <span className="pg-row-who"><b>{row.player}</b><small>Over {row.line} {SHORT[row.marketKey]||statWords(row)}{row.opponent?` · ${homeAway(row)} ${row.opponent}`:''}</small>
    {!call.play&&<em>{call.reason}</em>}</span>
   {call.play&&games.length>=3&&<MiniBars item={item}/>}
   <span className="pg-row-num"><b><CountUp value={item.confidence} ms={600}/></b>
    {call.play?<small data-strength={call.strength}>{one(item.projection)} proj</small>:<small>Pass</small>}</span>
  </button>
  <div className="pg-row-more"><div>{seen&&<>
   <small className="pg-row-game">{[call.play?call.label:null,gameWords(row),roleWords(item)].filter(Boolean).join(' · ')}</small>
   <Details item={item} saved={saved}/></>}</div></div>
 </li>;
}

// The last 10 as small bars beside a name: tall and bright over the line, short and dim under it.
function MiniBars({item}){
 const games=item.games||[],line=Number(item.row.line);
 const reach=Math.max(1,...games.map(game=>Math.abs(game.value-line)));
 return <span className="pg-mini" aria-hidden="true">{games.map((game,index)=><i key={index} data-over={game.value>line||undefined}
  style={{'--h':Math.max(0.18,Math.min(1,0.5+(game.value-line)/reach/2)),'--i':index}}/>)}</span>;
}

function Rows({items,saved,open,setOpen}){
 return <ul className="pg-list">{items.map((item,index)=><PropRow key={item.row.id} item={item} index={index}
  open={open===item.row.id} onToggle={()=>setOpen(old=>old===item.row.id?null:item.row.id)} saved={saved}/>)}</ul>;
}

function Reading({done,total}){
 return <div className="gp-gen-body"><div className="pg-reading">
  <p><b>Reading tonight's games</b><span>Injury reports, minutes, with and without teammates, matchups{total?` · ${done} of ${total} players`:''}</span></p>
  <span className="gp-meter pg-reading-bar" style={{'--w':total?Math.max(0.04,done/total):0.04}}/>
 </div><Shimmer rows={4}/></div>;
}

export function PropGenerator({admin}){
 const {data,rows,league,strict,loose}=usePropBoard();
 const {reads,done,total,ready}=useGameReads(strict,loose,league,data.tonight);
 useKeepCalls(reads,ready);
 const saved=useSlipIds();
 const [stat,setStat]=useState('all'),[sort,setSort]=useState('best'),[game,setGame]=useState('all');
 const [open,setOpen]=useState(null),[showPasses,setShowPasses]=useState(false);
 const games=useMemo(()=>{const seen=new Map();for(const item of reads){const key=gameKey(item.row);if(!seen.has(key))seen.set(key,{key,text:`${item.row.awayTeamAbbr||'?'} @ ${item.row.homeTeamAbbr||'?'}`,at:item.row.startsAt});}
  return [...seen.values()].sort((a,b)=>String(a.at).localeCompare(String(b.at)));},[reads]);
 const picked=games.some(item=>item.key===game)?game:'all';
 const {plays,passes}=useMemo(()=>{
  const kept=reads.filter(item=>(stat==='all'||item.row.marketKey===stat)&&(picked==='all'||gameKey(item.row)===picked));
  const calls=callsOf(kept);
  return {plays:calls.plays.sort((a,b)=>ORDER[sort](b)-ORDER[sort](a)),passes:calls.passes};
 },[reads,stat,picked,sort]);
 // Only slips that pay for themselves (a regular 2-pick needs about 58% a pick), from tonight's plays.
 const slips=useMemo(()=>bestSlips(callsOf(reads).plays).filter(slip=>slip.value>0),[reads]);
 const loading=data.rows==null||(!rows.length&&data.loading)||(rows.length&&!data.league);
 if(loading&&!strict.length)return <div className="gp-gen-body"><p className="gp-note pg-wait">Grading tonight's NBA props…</p><Shimmer rows={5}/></div>;
 if(!rows.length)return <div className="gp-gen-body"><Empty title={data.error?'NBA props couldn\'t load':'No NBA props posted right now'}
  text={data.error?(admin?'The board didn\'t load.':'Try again in a minute.'):'PrizePicks posts tonight\'s lines through the day. Check back soon.'}>
  {data.error&&<button type="button" className="gp-soft" onClick={()=>store.refresh()}><RefreshCw size={15} aria-hidden="true"/>Try again</button>}</Empty></div>;
 if(!strict.length&&!total)return <div className="gp-gen-body"><Empty title="Nothing strong enough yet" text={data.progress?'Still reading players\' games: picks show as they come in.':'No main-stat line tonight has the model, his record and his average all behind it. Check back after the lines move.'}/></div>;
 if(!ready)return <Reading done={done} total={total}/>;
 const [top,...rest]=plays;
 return <div className="gp-gen-body pg">
  <div className="pg-controls">
   <ChipStrip options={STATS} value={stat} onChange={value=>{setStat(value);setOpen(null);}} label="Stat"/>
   <div className="gp-menus">
    <ChipMenu label="Order" value={sort} onChange={setSort} options={SORTS}/>
    <ChipMenu label="Game" value={picked} onChange={value=>{setGame(value);setOpen(null);}} options={[{key:'all',text:'All games'},...games]}/>
   </div>
   <p className="gp-note pg-count"><b>{plays.length}</b> {plays.length===1?'play':'plays'} · {passes.length} passed · from {rows.length.toLocaleString()} lines tonight{data.progress?' · more coming in':''}</p>
  </div>
  {!top?<Empty title={reads.length?'No plays for this filter':'No plays tonight'} text={passes.length?'Every line we read came up short. The passes and why are below.':'Try another stat or game.'}/>:<>
   <Hero item={top} saved={saved}/>
   {rest.length>0&&<Section title="More plays"><Rows key={`p|${stat}|${picked}|${sort}`} items={rest} saved={saved} open={open} setOpen={setOpen}/></Section>}
  </>}
  {passes.length>0&&<Section title="We passed on">
   {showPasses||!top?<Rows key={`x|${stat}|${picked}`} items={passes} saved={saved} open={open} setOpen={setOpen}/>
    :<button type="button" className="gp-soft pg-more" onClick={()=>setShowPasses(true)}>See {passes.length} {passes.length===1?'pass':'passes'} and why<ChevronDown size={15} aria-hidden="true"/></button>}
  </Section>}
  {stat==='all'&&picked==='all'&&(slips.length>0?<Section title="Best slips tonight" icon={Layers}><ol className="gp-slips">{slips.map((slip,index)=><li key={slip.size} className="gp-slip" data-top={index===0?'':undefined} style={{'--i':index}}>
   <div className="gp-slip-top"><span className="gp-slip-name">{slip.size}-pick slip</span>{index===0&&<span className="gp-slip-tag">Best value</span>}</div>
   <ul className="gp-slip-legs">{slip.legs.map(item=><li key={item.row.id} className="gp-slip-leg">
    <Face row={item.row}/>
    <span className="gp-slip-who"><b>{item.row.player}</b><small>Over {item.row.line} {SHORT[item.row.marketKey]||statWords(item.row)}{item.row.opponent?` · ${homeAway(item.row)} ${item.row.opponent}`:''}</small></span>
    <span className="gp-slip-num"><b>{pct(item.grade.chance)}</b><small>to hit</small></span>
   </li>)}</ul>
   <dl className="gp-slip-foot">
    <div><dt>Pays</dt><dd>{slip.payout}x</dd></div>
    <div><dt>To hit</dt><dd>{pct(slip.chance)}</dd></div>
    <div><dt>Value</dt><dd data-tone="up">{`+${(slip.value*100).toFixed(1)}%`}</dd></div>
   </dl>
  </li>)}</ol></Section>
  :plays.length>1&&<Section title="Best slips tonight" icon={Layers}><p className="gp-note">No slip pays for itself tonight: PrizePicks needs about 58% a pick on a 2-pick. Play the strongest on their own.</p></Section>)}
 </div>;
}
