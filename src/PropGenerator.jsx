// The Game Predictor's NBA prop generator (prop-generator.js picks and
// explains; this shows it). Nov 8, the owner on the first version: "is this
// really the best we can do and i want a nicer look and more options to see
// data and things like that with cool animations and transitions and visual
// effects that dont look ai or robotic".
//  - Filters: the stat (a sliding strip), the game, and the order (best
//    picks, highest chance, best matchup, hottest form, most room).
//  - The top pick: his last 10 games as bars against the line, a confidence
//    ring, the four reads behind it as bars, the reasons in plain words.
//  - The rest: each with his last 10 in small bars; tap to open the chart,
//    the reads and the reasons (the row grows open).
//  - The best slips that pay for themselves.
import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ChevronDown,Layers,RefreshCw,Trophy} from 'lucide-react';
import {CountUp} from './count-up.jsx';
import {Face} from './PickParts';
import {SlipToggle,useSlipIds} from './SlipToggle';
import {useInk,inkStyle} from './use-ink.js';
import {nba as store} from './nba-props-data.js';
import {loadLearning} from './learning.js';
import {analysisOf,bestSlips,generateProps,statWords} from './prop-generator.js';
import {ChipMenu,Empty,Section,Shimmer} from './gp-parts.jsx';
import './prop-generator.css';

const STATS=[['all','All'],['player_points','Points'],['player_rebounds','Rebounds'],['player_assists','Assists'],
 ['player_points_rebounds_assists','PRA'],['player_points_rebounds','P+R'],['player_points_assists','P+A'],['player_threes','3PM']];
const SHORT={player_points:'PTS',player_rebounds:'REB',player_assists:'AST',player_points_rebounds_assists:'PRA',
 player_points_rebounds:'P+R',player_points_assists:'P+A',player_threes:'3PM'};
const SORTS=[{key:'best',text:'Best picks'},{key:'chance',text:'Highest chance'},{key:'matchup',text:'Best matchup'},
 {key:'form',text:'Hottest form'},{key:'cushion',text:'Most room over the line',short:'Most room'}];
const ORDER={best:item=>item.score,chance:item=>item.grade.chance,matchup:item=>item.read?.score??0,form:item=>item.form??0,
 cushion:item=>item.average!=null?(item.average-item.row.line)/item.row.line:0};
const TIER_WORDS={elite:'Elite',strong:'Strong',lean:'Lean'};

const pct=value=>value==null||!Number.isFinite(value)?'—':`${Math.round(value*100)}%`;
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);
const clockText=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';};
const homeAway=row=>row.awayTeamAbbr&&row.teamAbbr===row.awayTeamAbbr?'@':'vs';
const gameKey=row=>row.gameId||`${row.awayTeamAbbr}@${row.homeTeamAbbr}`;
const gameWords=row=>`${row.teamAbbr||''}${row.opponent?` ${homeAway(row)} ${row.opponent}`:''}${row.startsAt?` · ${clockText(row.startsAt)}`:''}`;
const roleWords=item=>[item.role?.label,item.minutes!=null?`${Math.round(item.minutes)} min`:null].filter(Boolean).join(' · ');
const lineWords=row=>`Over ${row.line} ${statWords(row)}`;

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
 const props=useMemo(()=>league?generateProps(rows,league,{most:60}):[],[rows,league,learned]);
 return {data,rows,props};
}

// A row of choices with one soft pill gliding to the picked one (scrolls on a phone).
function ChipStrip({options,value,onChange,label}){
 const row=useRef(null),ink=useInk(row,value,'[aria-checked=true]');
 return <div className="gp-daystrip pg-strip" role="radiogroup" aria-label={label} ref={row}>
  <span className="gp-day-ink" style={inkStyle(ink)} aria-hidden="true"/>
  {options.map(([key,text])=><button type="button" role="radio" key={key} aria-checked={value===key} onClick={()=>onChange(key)}>{text}</button>)}
 </div>;
}

// How sure, 0-100, as a ring that fills when it shows.
function ConfidenceRing({value,size=74}){
 const radius=size/2-5,around=2*Math.PI*radius;
 const [shown,setShown]=useState(0);
 useEffect(()=>{const frame=requestAnimationFrame(()=>setShown(value));return()=>cancelAnimationFrame(frame);},[value]);
 const tone=value>=70?'high':value>=50?'mid':'low';
 return <span className="pg-ring" data-tone={tone} style={{width:size,height:size}}>
  <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
   <circle cx={size/2} cy={size/2} r={radius} className="pg-ring-track"/>
   <circle cx={size/2} cy={size/2} r={radius} className="pg-ring-fill" strokeDasharray={around} strokeDashoffset={around*(1-shown/100)}/>
  </svg>
  <b><CountUp value={value} ms={900}/></b>
 </span>;
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

// The last 10 as small bars beside a name: tall and bright over the line, short and dim under it.
function MiniBars({item}){
 const games=item.games||[],line=Number(item.row.line);
 if(games.length<3)return null;
 const reach=Math.max(1,...games.map(game=>Math.abs(game.value-line)));
 return <span className="pg-mini" aria-hidden="true">{games.map((game,index)=><i key={index} data-over={game.value>line||undefined}
  style={{'--h':Math.max(0.18,Math.min(1,0.5+(game.value-line)/reach/2)),'--i':index}}/>)}</span>;
}

// The four reads behind the confidence, each a bar and what it is.
function Signals({item}){
 const {records,read,row}=item;
 const rows=[
  ['model','The model',`${pct(item.grade.chance)} to go over`],
  ['form','His record',records.l10?`${records.l10.hits} of last ${records.l10.games}${records.season?` · ${Math.round(records.season.rate)}% season`:''}`:'—'],
  ['matchup','Matchup',read?`${read.score} vs ${row.opponent||'them'}`:'—'],
  ['cushion','His average',item.average!=null?`${figure(Math.round(item.average*10)/10)} vs ${row.line}`:'—'],
 ];
 return <ul className="pg-signals">{rows.map(([key,label,text],index)=><li key={key} style={{'--i':index}}>
  <span>{label}</span><span className="pg-signal-bar"><i style={{'--w':item.signals[key]/100}}/></span><b>{text}</b>
 </li>)}</ul>;
}

function Why({item}){
 return <ul className="pg-whylist">{analysisOf(item).map(part=><li key={part.key} data-tone={part.tone}>
  <b>{part.title}</b><p>{part.text}</p>
  {part.points?.length>0&&<ul>{part.points.map(point=><li key={point.text} data-tone={point.tone}>{point.text}</li>)}</ul>}
 </li>)}</ul>;
}

function Hero({item,saved}){
 const {row,grade}=item;
 return <section className="gp-pick pg-hero" key={row.id}>
  <div className="gp-pick-top"><span className="gp-kicker"><Trophy size={14} aria-hidden="true"/>Best pick</span>
   <span className="pg-tier" data-tier={grade.tier}>{TIER_WORDS[grade.tier]}</span></div>
  <div className="pg-hero-main">
   <Face row={row}/>
   <span className="pg-hero-who"><b>{row.player}</b><strong>{lineWords(row)}</strong><small>{[gameWords(row),roleWords(item)].filter(Boolean).join(' · ')}</small></span>
   <span className="pg-hero-ring"><ConfidenceRing value={item.confidence}/><small>Confidence</small></span>
  </div>
  <GameChart item={item}/>
  <Signals item={item}/>
  <details className="pg-why" open><summary>Why we like it<ChevronDown size={15} aria-hidden="true"/></summary><Why item={item}/></details>
  <SlipToggle row={row} saved={saved} stat={statWords(row)} full className="pg-save"/>
 </section>;
}

function PropRow({item,index,open,onToggle,saved}){
 const {row,grade}=item;
 const [seen,setSeen]=useState(open);
 useEffect(()=>{if(open)setSeen(true);},[open]);
 return <li className="pg-row" data-open={open||undefined} style={{'--i':Math.min(index,14)}}>
  <button type="button" className="pg-row-head" onClick={onToggle} aria-expanded={open}>
   <Face row={row}/>
   <span className="pg-row-who"><b>{row.player}</b><small>Over {row.line} {SHORT[row.marketKey]||statWords(row)} · {row.opponent?`${homeAway(row)} ${row.opponent}`:''}</small></span>
   <MiniBars item={item}/>
   <span className="pg-row-num"><b><CountUp value={item.confidence} ms={600}/></b><small data-tier={grade.tier}>{pct(grade.chance)} chance</small></span>
  </button>
  <div className="pg-row-more"><div>{seen&&<>
   <small className="pg-row-game">{[gameWords(row),roleWords(item)].filter(Boolean).join(' · ')}</small>
   <GameChart item={item}/><Signals item={item}/><Why item={item}/>
   <SlipToggle row={row} saved={saved} stat={statWords(row)} full className="pg-save"/></>}</div></div>
 </li>;
}

export function PropGenerator({admin}){
 const {data,rows,props}=usePropBoard();
 const saved=useSlipIds();
 const [stat,setStat]=useState('all'),[sort,setSort]=useState('best'),[game,setGame]=useState('all');
 const [open,setOpen]=useState(null);
 const games=useMemo(()=>{const seen=new Map();for(const item of props){const key=gameKey(item.row);if(!seen.has(key))seen.set(key,{key,text:`${item.row.awayTeamAbbr||'?'} @ ${item.row.homeTeamAbbr||'?'}`,at:item.row.startsAt});}
  return [...seen.values()].sort((a,b)=>String(a.at).localeCompare(String(b.at)));},[props]);
 const picked=games.some(item=>item.key===game)?game:'all';
 const shown=useMemo(()=>props.filter(item=>(stat==='all'||item.row.marketKey===stat)&&(picked==='all'||gameKey(item.row)===picked))
  .sort((a,b)=>ORDER[sort](b)-ORDER[sort](a)),[props,stat,picked,sort]);
 // Only slips that pay for themselves (a regular 2-pick needs about 58% a pick), from the best picks.
 const slips=useMemo(()=>bestSlips(props).filter(slip=>slip.value>0),[props]);
 const loading=data.rows==null||(!rows.length&&data.loading)||(rows.length&&!data.league);
 if(loading&&!props.length)return <div className="gp-gen-body"><p className="gp-note pg-wait">Grading tonight's NBA props…</p><Shimmer rows={5}/></div>;
 if(!rows.length)return <div className="gp-gen-body"><Empty title={data.error?'NBA props couldn\'t load':'No NBA props posted right now'}
  text={data.error?(admin?'The board didn\'t load.':'Try again in a minute.'):'PrizePicks posts tonight\'s lines through the day. Check back soon.'}>
  {data.error&&<button type="button" className="gp-soft" onClick={()=>store.refresh()}><RefreshCw size={15} aria-hidden="true"/>Try again</button>}</Empty></div>;
 if(!props.length)return <div className="gp-gen-body"><Empty title="Nothing strong enough yet" text={data.progress?'Still reading players\' games: picks show as they come in.':'No main-stat line tonight has the model, his record and his average all behind it. Check back after the lines move.'}/></div>;
 const [top,...rest]=shown;
 return <div className="gp-gen-body pg">
  <div className="pg-controls">
   <ChipStrip options={STATS} value={stat} onChange={value=>{setStat(value);setOpen(null);}} label="Stat"/>
   <div className="gp-menus">
    <ChipMenu label="Order" value={sort} onChange={setSort} options={SORTS}/>
    <ChipMenu label="Game" value={picked} onChange={value=>{setGame(value);setOpen(null);}} options={[{key:'all',text:'All games'},...games]}/>
   </div>
   <p className="gp-note pg-count"><b>{shown.length}</b> {shown.length===1?'pick':'picks'} from {rows.length.toLocaleString()} lines tonight{data.progress?' · more coming in':''}</p>
  </div>
  {!top?<Empty title="None for this filter" text="Try another stat or game."/>:<>
   <Hero item={top} saved={saved}/>
   {rest.length>0&&<Section title="More picks"><ul className="pg-list" key={`${stat}|${picked}|${sort}`}>{rest.map((item,index)=><PropRow key={item.row.id} item={item} index={index}
    open={open===item.row.id} onToggle={()=>setOpen(old=>old===item.row.id?null:item.row.id)} saved={saved}/>)}</ul></Section>}
  </>}
  {stat==='all'&&picked==='all'&&(slips.length>0?<Section title="Best slips tonight" icon={Layers}><ol className="gp-parlays">{slips.map((slip,index)=><li key={slip.size} style={{'--i':index}}>
   <div className="gp-parlay-head">
    <span className="gp-parlay-pays"><b>{slip.payout}x</b><small>{slip.size} picks</small></span>
    <span className="gp-parlay-hit"><span className="gp-meter" style={{'--w':slip.chance}}/><small>{pct(slip.chance)} to hit</small></span>
    <strong data-tone="up">{`+${(slip.value*100).toFixed(1)}%`}<small>value</small></strong>
   </div>
   <ul className="gp-legchips">{slip.legs.map(item=><li key={item.row.id}><b>{item.row.player.split(' ').slice(-1)[0]}</b><small>{item.row.line} {SHORT[item.row.marketKey]||''}</small></li>)}</ul>
  </li>)}</ol></Section>
  :props.length>1&&<Section title="Best slips tonight" icon={Layers}><p className="gp-note">No slip pays for itself tonight: PrizePicks needs about 58% a pick on a 2-pick. Play the strongest on their own.</p></Section>)}
 </div>;
}
