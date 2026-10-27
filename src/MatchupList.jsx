// A Props tab league's list (NbaMatchups.jsx, NflMatchups.jsx): a table row
// for every prop PrizePicks posts in it, with how good the opponent is for
// it (the row's big number) and how often it has cleared its line lately,
// sortable by each from the buttons or the column headings. Oct 25, the
// owner: just the matchup, clean like RotoBot. The Prop grade, Hitting,
// Blowout and Starter/Bench marks are off the rows; a big spread and his
// role are still in the Why panel. A row opens that
// player's matchup page; its arrow shows what made the scores.
// `config` says which league: its stats, its lines (props-data.js), its score
// and page.
// Oct 27, the owner: the tab is theirs alone, nicer and premium, but "I
// don't want it to look like it was made with AI ... not the futuristic
// look". So: a plain title with when the board last updated, a soft-spots
// map of every defense by stat that filters the list on a tap, rows ranked
// with Last 10 as ten tiny bars against the line, and calm motion (an
// underline that glides between tabs, rows easing in). No glows, no
// pulsing, no gradient text.
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,Check,ChevronDown,LayoutGrid,LineChart,RefreshCw,Search,SlidersHorizontal,X} from 'lucide-react';
import {windowGames,windowRate} from './unified-finder-data';
import {Face,Img} from './PickParts';
import {propGrades} from './props-grade';
import {loadLearning} from './learning';
import {lineupRole} from './lineup-role';
import {ENOUGH,loadRecord,reportProps,reportRows} from './props-record';
import {mainLines,tierOf} from './props-lines';
import {CountUp} from './count-up';
import {useWide} from './use-wide';
import {inkStyle,useInk} from './use-ink';
import './nba-matchups.css';

const SORTS=[['matchup','Matchup'],['hit','Last 10']];
// Which lines and players show (Oct 25, the owner: only regular lines and
// starters, or only Goblins, or only Demons). Kept on the device per league.
const KINDS=[['standard','Regular'],['goblin','Goblins'],['demon','Demons'],['all','All']];
const ROLES=[['all','All players'],['starter','Starters'],['bench','Bench']];
const remembered=(key,fallback,allowed)=>{try{const value=localStorage.getItem(key);return allowed.some(([option])=>option===value)?value:fallback;}catch{return fallback;}};
const remember=(key,value)=>{try{localStorage.setItem(key,value);}catch{/* this device only */}};
const PICS={demon:['/prizepicks/demon-64.png','Demon','PrizePicks Demon: a higher line that pays more'],
 goblin:['/prizepicks/goblin.png','Goblin','PrizePicks Goblin: a lower line that pays less']};
// The table's headings for the sorted columns: full, and on a phone.
const HEADS={matchup:['Matchup','Match'],hit:['Last 10','L10']};
const READS={teammates:'His teammates out',back:'Teammates back',missing:'Their players out',recent:'Their last 10 games',defense:'Their defense',pace:'Their pace',position:'vs his position',attempts:'Threes they allow',rebounds:'Rebounds they allow',assists:'Assists they allow',turnovers:'Their turnovers',meetings:'His games vs them',
 script:'The game line',scoring:'His team’s scoring',role:'His role'};
// What a read adds to (or takes from) the even 50.
const added=points=>`${points>0?'+':points<0?'−':''}${Math.abs(Math.round(points))} ${Math.abs(Math.round(points))===1?'point':'points'}`;
const figure=value=>Number.isInteger(Number(value))?String(Number(value)):Number(value).toFixed(1);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
// One game, whatever start time each of its lines carries (PrizePicks posts
// some at 6:30 and some at 6:40): the two teams on the day.
const dayOf=iso=>{const time=Date.parse(iso||'');return Number.isFinite(time)?new Date(time).toDateString():'';};
const gameOf=row=>`${row.awayTeamAbbr||''}@${row.homeTeamAbbr||''}|${dayOf(row.startsAt)}`;
const teamColor=(league,team)=>{const color=league?.teams?.[team]?.color;return color?`#${String(color).replace('#','')}`:null;};
const hitOf=row=>{const window=row.windows?.l10;const games=windowGames(window);return games?{rate:windowRate(window),hits:window.hits,games}:null;};

function Bar({value,tone}){
 return <span className="nm-bar" data-tone={tone||undefined}><i style={{width:`${Math.max(4,Math.min(100,value))}%`}}/></span>;
}

// One of the row's numbers under its heading: the number, colored by
// what it means, and for the matchup a bar under it.
function Cell({kind,value,tone,bar,children}){
 return <span className={`nm-cell nm-${kind}`} data-tone={tone||undefined}><b>{value}</b>{Number.isFinite(bar)&&<Bar value={bar} tone={tone}/>}{children}</span>;
}

// His last 10 games in the stat as ten tiny bars against tonight's line
// (over in green), the line drawn across.
function Spark({row}){
 const games=(row.gameLog||[]).filter(game=>Number.isFinite(game?.value)).slice(-10),line=Number(row.line);
 if(games.length<3||!Number.isFinite(line))return null;
 const top=Math.max(1,line*1.6,...games.map(game=>game.value));
 return <span className="nm-spark" aria-hidden="true">{games.map((game,index)=><i key={index} data-over={game.value>line||undefined}
  style={{height:`${Math.max(10,Math.min(100,game.value/top*100))}%`}}/>)}<s style={{bottom:`${Math.min(100,line/top*100)}%`}}/></span>;
}

// A big spread tonight (props-grade.js): what it does to him, in a sentence.
const blowoutText=found=>`his team is a ${figure(Math.abs(found.spread))}-point ${found.spread<0?'favorite':'underdog'}. `
 +(found.role==='starter'?`In games like that, starters sit late and come in about ${Math.round(-found.change*100)}% under their usual`
  :`In games like that, the bench plays the late minutes and comes in about ${Math.round(found.change*100)}% over its usual`);

// One prop: who and when, the line, then Matchup and Last 10.
// The first rows in view slide in one after another and count their scores
// up; each row carries his team's color (a ring on his photo, a wash behind).
const FIRST=14;
// What made the scores (a row's Why, and the preview beside the list).
function Reads({read,prop,role,hit,brief}){
 return <ul className="nm-reads">{!brief&&<li className="nm-read-note">{read.score} matchup, {read.label.toLowerCase()}{hit?`. Over his line in ${hit.hits} of his last ${hit.games}`:''}.</li>}
  {prop?.blowout&&<li className="nm-read-note">{prop.blowout.role==='starter'?'Blowout risk':'Blowout boost'}: {blowoutText(prop.blowout)}.</li>}
  {role&&<li className="nm-read-note">{role.label}: {role.sat?`he started ${role.starts} of his last ${role.games} and sat out his team’s last game`:`${role.starter?'he started his team’s last game':'he didn’t start his team’s last game'} and ${role.starts} of his last ${role.games}`}. Tonight’s lineup is announced about half an hour before tip-off.</li>}
  <li className="nm-read-note">An even matchup is 50. Each part adds or takes away points.</li>{read.reads.map(item=><li key={item.key}>
  <span className="nm-read-head"><b>{READS[item.kind]||READS[item.key]||'Their defense'}</b><em>{added(item.points)}</em></span>
  <span className="nm-read-text">{item.text}</span>
  <Bar value={item.score} tone={item.score>=60?'edge':item.score>=40?'neutral':'tough'}/>
 </li>)}</ul>;
}

// On a big screen (`picking`) a row picks the prop shown beside the list
// instead of opening his page, and has no Why arrow: the preview says why.
function PropRow({row,read,hit,prop,role,open,onToggle,onOpen,short,index=0,color,picking,selected,onSelect}){
 const rank=index+1;
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 const kind=tierOf(row),pic=PICS[kind];
 const stat=short[row.marketKey]||row.market;
 const waiting=row.historyStatus==='pending'||row.historyRefresh;
 const said=[read&&`matchup ${read.score}, ${read.label.toLowerCase()}`,hit&&`last 10 ${hit.hits} of ${hit.games}`].filter(Boolean).join(', ');
 return <li className="nm-row" data-open={open||undefined} data-selected={selected||undefined} style={{'--i':Math.min(index,FIRST),...(color?{'--team':color}:{})}}>
  <button type="button" className="nm-main" onClick={()=>picking?onSelect(row.id):onOpen(row)} aria-pressed={picking?Boolean(selected):undefined}
   aria-label={`${row.player}, more ${figure(row.line)} ${stat}${pic?` ${pic[1]}`:''}${said?`: ${said}`:''}. ${picking?'Show his matchup beside the list':'Open his matchup page'}`}>
   <span className="nm-rank" data-top={rank<=3||undefined}>{rank}</span>
   <Face row={row}/>
   <b className="nm-name">{row.player}</b>
   <small className="nm-when">{row.position&&<span className="nm-pos">{row.position} · </span>}
    {row.teamAbbr&&row.opponent?<><span className="nm-own">{row.teamAbbr} </span>{home?'vs':'@'} {row.opponent}</>:row.teamAbbr}{row.startsAt&&` · ${when(row.startsAt)}`}</small>
   <span className="nm-line"><small>More</small><b>{figure(row.line)}</b><em>{stat}</em>{pic&&<img className="nm-demon" src={pic[0]} alt={pic[1]} title={pic[2]} width="18" height="18"/>}</span>
   <Cell kind="score" value={read?(index<FIRST?<CountUp value={read.score} delay={index*35+120}/>:read.score):'—'} tone={read?.tone} bar={read?read.score:null}/>
   <Cell kind="hit" value={hit?`${hit.hits}/${hit.games}`:waiting?'…':'—'}><Spark row={row}/></Cell>
  </button>
  {picking?null:read?<button type="button" className="nm-why" aria-expanded={open} aria-label={`Why ${row.player}'s scores`} title="Why these scores" onClick={onToggle}><ChevronDown size={16}/></button>:<span aria-hidden="true"/>}
  {!picking&&open&&read&&<Reads read={read} prop={prop} role={role} hit={hit}/>}
 </li>;
}

// The picked prop beside the list on a big screen (Oct 27, the owner: "make
// a better layout design" for the computer; the list had been split into
// two columns that read 1 left, 2 right, with gaps across each row). Who and
// when, the line and the matchup, his last 10 games against the line, his
// hit rates, what made the score, his other lines tonight and the way to
// his full page. It stays in view while the list scrolls.
const POS_NAMES={G:'Guard',F:'Forward',C:'Center'};
const WINDOWS=[['l5','L5'],['l10','L10'],['l20','L20'],['season','Season']];
function Preview({item,others,league,short,color,onOpen,onPick}){
 const {row,read,hit,prop,role}=item;
 const home=row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr;
 const team=league?.teams?.[row.teamAbbr],opponent=league?.teams?.[row.opponent];
 const pic=PICS[tierOf(row)],stat=short[row.marketKey]||row.market;
 const line=Number(row.line);
 const games=(row.gameLog||[]).filter(game=>Number.isFinite(game?.value)).slice(-10);
 const top=Math.max(1,Number.isFinite(line)?line*1.4:0,...games.map(game=>game.value));
 const rates=WINDOWS.map(([key,label])=>{const window=row.windows?.[key],count=windowGames(window);
  return count?{key,label,hits:window.hits,games:count,rate:windowRate(window)}:null;}).filter(Boolean);
 return <aside className="nm-preview" aria-label={`${row.player}, ${stat}`} style={color?{'--team':color}:undefined}>
  <div className="nm-pv-card" key={row.id}>
   <header className="nm-pv-head"><Face row={row}/>
    <div className="nm-pv-who"><b>{row.player}</b>
     <small>{[POS_NAMES[String(row.position||'')[0]]||row.position,team?.short||team?.name||row.teamAbbr,role?.label].filter(Boolean).join(' · ')}</small>
     <span className="nm-pv-game">{opponent?.logo&&<Img src={opponent.logo}/>}{home?'vs':'@'} {opponent?.short||row.opponent}{row.startsAt&&` · ${when(row.startsAt)}`}</span></div>
   </header>
   <div className="nm-pv-main">
    <div className="nm-pv-line"><small>More</small><span><b>{figure(row.line)}</b><em>{stat}</em>{pic&&<img src={pic[0]} alt={pic[1]} title={pic[2]} width="18" height="18"/>}</span></div>
    <div className="nm-pv-score" data-tone={read?.tone||undefined}><small>Matchup</small>
     {read?<><span><b><CountUp value={read.score}/></b><em>{read.label}</em></span><Bar value={read.score} tone={read.tone}/></>:<span><b>—</b></span>}</div>
   </div>
   {games.length>0&&<section className="nm-pv-part"><h3>Last {games.length} games</h3>
    <div className="nm-pv-chart" role="img" aria-label={`${stat}, last ${games.length}: ${games.map(game=>figure(game.value)).join(', ')}`}>
     <div className="nm-pv-bars">
      {Number.isFinite(line)&&<i className="nm-pv-at" style={{bottom:`${Math.min(100,line/top*100)}%`}}/>}
      {games.map((game,index)=><span key={`${game.date}-${index}`} data-over={game.value>line||undefined} style={{'--k':index,height:`${Math.max(3,game.value/top*100)}%`}}>
       <b>{figure(game.value)}</b></span>)}
     </div>
     <div className="nm-pv-opps" aria-hidden="true">{games.map((game,index)=><small key={index}>{game.opponent||''}</small>)}</div>
    </div></section>}
   {rates.length>0&&<div className="nm-pv-rates">{rates.map(item=><span key={item.key} data-tone={item.rate>=60?'good':item.rate<=40?'poor':undefined}>
    <small>{item.label}</small><b>{item.hits}/{item.games}</b></span>)}</div>}
   {read&&<section className="nm-pv-part nm-pv-why"><h3>What makes the {read.score}</h3><Reads read={read} prop={prop} role={role} hit={hit} brief/></section>}
   {others.length>0&&<section className="nm-pv-part"><h3>His other lines tonight</h3><div className="nm-pv-others">{others.map(other=>
    <button type="button" key={other.row.id} onClick={()=>onPick(other.row.id)}><small>{short[other.row.marketKey]||other.row.market}</small><b>{figure(other.row.line)}</b>
     {other.read&&<em data-tone={other.read.tone}>{other.read.score}</em>}</button>)}</div></section>}
   <button type="button" className="nm-pv-open" onClick={()=>onOpen(row)}>Open his matchup page<ArrowRight size={16} aria-hidden="true"/></button>
  </div>
 </aside>;
}

// How the props the list showed went (props-record.js): by matchup score
// band, over each one's line, once enough have been played. The NBA's
// only. `recordOf` says it in a few words for its fold; RecordTable is the
// fold opened.
function recordOf(record){
 const bands=(record?.bands||[]).filter(item=>item.props>=ENOUGH);
 if(!record||!bands.length)return record?.nights>0?{bands:[],line:`${record.all.props} props so far`}:null;
 const top=bands[0];
 return {bands,line:`${top.band} went over ${Math.round(top.overRate)}%`,
  long:`Last ${record.nights} ${record.nights===1?'night':'nights'}: matchup ${top.band} went over ${Math.round(top.overRate)}% of ${top.props}`};
}
function RecordTable({record,summary}){
 if(!summary.bands.length)return <p className="nm-record-note">{record.all.props} props over {record.nights} {record.nights===1?'night':'nights'} so far. Rates show once each band has {ENOUGH}.</p>;
 return <div className="nm-record-body">
  <table><caption>{summary.long}</caption>
   <thead><tr><th scope="col">Matchup</th><th scope="col">Over</th><th scope="col">Props</th></tr></thead>
   <tbody>{summary.bands.map(item=><tr key={item.band}><th scope="row">{item.band}</th>
    <td><span className="nm-rate"><i style={{width:`${Math.min(100,item.overRate)}%`}}/></span>{Math.round(item.overRate)}%</td><td>{item.props}</td></tr>)}</tbody></table>
 </div>;
}

// Every defense on the board by stat: the average matchup of the props
// against it, colored by band. A tap shows that game and stat in the list.
const bandTone=score=>score>=75?'strong':score>=60?'edge':score>=40?'neutral':'tough';
function SoftSpots({spots,stat,facing,onPick,wide,league}){
 const cell=(team,key)=>{const value=team.cells[key];
  if(value==null)return <span className="nm-spot-cell" key={key} aria-hidden="true"/>;
  return <button type="button" className="nm-spot-cell" key={key} data-score={Math.round(value)} data-tone={bandTone(value)} style={{'--heat':Math.min(1,Math.abs(value-50)/45)}}
   aria-pressed={stat===key&&facing===team.team} onClick={()=>onPick(key,team.team)} aria-label={`${team.team} defense, ${spots.names[key]}: ${Math.round(value)}`}>{Math.round(value)}</button>;};
 const logo=team=>league?.teams?.[team]?.logo;
 // A computer: the defenses across, the stats down; a phone the other way.
 if(wide)return <div className="nm-spots-grid" data-wide style={{'--cols':spots.teams.length}}>
  <span/>{spots.teams.map(team=><span className="nm-spot-team" key={team.team} title={`${team.team} defense, vs ${team.vs}`}>{logo(team.team)&&<Img src={logo(team.team)}/>}<b>{team.team}</b></span>)}
  {spots.columns.map(([key,text])=><React.Fragment key={key}><span className="nm-spot-stat">{text}</span>{spots.teams.map(team=>cell(team,key))}</React.Fragment>)}
 </div>;
 return <div className="nm-spots-grid" style={{'--cols':spots.columns.length}}>
  <span className="nm-spot-corner">Defense</span>{spots.columns.map(([key,text])=><span className="nm-spot-stat" key={key}>{text}</span>)}
  {spots.teams.map(team=><React.Fragment key={team.team}><span className="nm-spot-team">{logo(team.team)&&<Img src={logo(team.team)}/>}<b>{team.team}</b><small>vs {team.vs}</small></span>
   {spots.columns.map(([key])=>cell(team,key))}</React.Fragment>)}
 </div>;
}

// The game menu: each game once, with both teams' logos, its time and how
// many props it has. Opens under the button; Escape, a tap outside or a pick
// closes it, and the arrow keys move through it.
function GamePicker({games,value,onChange}){
 const [open,setOpen]=useState(false);
 const box=useRef(null),button=useRef(null),list=useRef(null);
 const options=useMemo(()=>[{key:'all',label:'All games',count:games.reduce((sum,game)=>sum+game.count,0)},...games],[games]);
 const chosen=options.find(option=>option.key===value)||options[0];
 useEffect(()=>{
  if(!open)return undefined;
  const away=event=>{if(box.current&&!box.current.contains(event.target))setOpen(false);};
  document.addEventListener('pointerdown',away);
  requestAnimationFrame(()=>list.current?.querySelector('[aria-selected=true]')?.focus());
  return()=>document.removeEventListener('pointerdown',away);
 },[open]);
 const pick=key=>{onChange(key);setOpen(false);button.current?.focus();};
 const keys=event=>{
  const items=[...(list.current?.querySelectorAll('[role=option]')||[])],at=items.indexOf(document.activeElement);
  if(event.key==='Escape'){event.preventDefault();setOpen(false);button.current?.focus();}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[Math.max(0,Math.min(items.length-1,at+(event.key==='ArrowDown'?1:-1)))]?.focus();}
  else if(event.key==='Home'||event.key==='End'){event.preventDefault();(event.key==='Home'?items[0]:items.at(-1))?.focus();}
 };
 return <div className="nm-game" ref={box} data-open={open||undefined}>
  <button type="button" ref={button} className="nm-game-button" aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(value=>!value)}
   onKeyDown={event=>{if(event.key==='ArrowDown'&&!open){event.preventDefault();setOpen(true);}}}>
   <span className="nm-label">Game</span><span className="nm-game-now">{chosen.key==='all'?'All games':`${chosen.away} @ ${chosen.home}`}</span><ChevronDown size={14} aria-hidden="true"/></button>
  {open&&<ul className="nm-game-menu" role="listbox" aria-label="Game" ref={list} onKeyDown={keys}>{options.map(option=>
   <li key={option.key} role="option" aria-selected={option.key===chosen.key} tabIndex={-1} onClick={()=>pick(option.key)}
    onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();pick(option.key);}}}>
    {option.key==='all'?<span className="nm-game-teams"><b>All games</b></span>
     :<span className="nm-game-teams"><Img src={option.awayLogo}/><b>{option.away}</b><i>@</i><Img src={option.homeLogo}/><b>{option.home}</b></span>}
    <span className="nm-game-when">{option.key==='all'?`${option.count} props`:`${when(option.startsAt)} · ${option.count}`}</span>
    {option.key===chosen.key&&<Check size={14} aria-hidden="true"/>}
   </li>)}</ul>}
 </div>;
}

// A computer's sidebar: every game listed with both logos, its time and props.
function GameList({games,value,onChange}){
 const total=games.reduce((sum,game)=>sum+game.count,0);
 return <nav className="nm-games" aria-label="Games"><span className="nm-games-head">Games</span>
  <button type="button" aria-pressed={value==='all'} onClick={()=>onChange('all')}><span className="nm-game-teams"><b>All games</b></span><em>{total}</em></button>
  {games.map(game=><button type="button" key={game.key} aria-pressed={value===game.key} onClick={()=>onChange(game.key)}>
   <span className="nm-game-teams"><Img src={game.awayLogo}/><b>{game.away}</b><i>@</i><Img src={game.homeLogo}/><b>{game.home}</b></span>
   <small>{when(game.startsAt)}</small><em>{game.count}</em></button>)}
 </nav>;
}

export function MatchupList({config}){
 const {store,stats:STATS,score,Page,words}=config;
 const SHORT=useMemo(()=>Object.fromEntries(STATS),[STATS]);
 // The lines and league numbers live in props-data.js, loaded before the
 // tab opens and saved on the device: what's there shows at once and a
 // fresh board fills in behind it.
 const [data,setData]=useState(store.get);
 const [stat,setStat]=useState('all');
 const [game,setGameNow]=useState('all');
 // A soft spot tapped: only the props against that defense.
 const [facing,setFacing]=useState('');
 const setGame=value=>{setGameNow(value);setFacing('');};
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState('matchup');
 const [kind,setKindNow]=useState(()=>remembered(`props-kind:${config.key}`,'standard',KINDS));
 const [roleShown,setRoleNow]=useState(()=>remembered(`props-role:${config.key}`,'all',ROLES));
 const setKind=value=>{setKindNow(value);remember(`props-kind:${config.key}`,value);};
 const setRole=value=>{setRoleNow(value);remember(`props-role:${config.key}`,value);};
 const [filtersOpen,setFiltersOpen]=useState(false);
 // A computer: the controls sit in a sidebar, always open, with the games listed.
 const wide=useWide();
 // A big screen also shows the picked prop beside the list.
 const roomy=useWide('(min-width: 1500px)'),picking=wide&&roomy;
 const [selectedId,setSelectedId]=useState(null);
 const showFilters=wide||filtersOpen;
 const [openId,setOpenId]=useState(null);
 const [page,setPage]=useState(null);
 const listScroll=useRef(0);
 useEffect(()=>{
  const stop=store.on(setData);
  store.warm();
  // League numbers the server wasn't ready with are asked for again.
  // Tonight's injury reports (the NBA) are asked for again every few minutes.
  const retry=setInterval(()=>{if(!store.get().league)store.refresh();store.freshenTonight?.();},45000);
  return()=>{stop();clearInterval(retry);};
 },[store]);
 const load=useCallback(()=>{store.refresh();},[store]);
 const rows=useMemo(()=>(data.rows||[]).filter(store.wanted),[data.rows,store]);
 // Tonight's injury reports (the NBA) ride with the league numbers into the score.
 const league=useMemo(()=>data.league&&data.tonight?{...data.league,tonight:data.tonight}:data.league,[data.league,data.tonight]);
 const progress=data.progress,at=data.at;
 // Something to show beats a spinner: the list stays up while a board loads.
 const status=data.rows==null||(!rows.length&&data.loading)?'loading':!rows.length&&data.error?'error':data.loading?'refreshing':'ready';
 const scores=useMemo(()=>league?score(rows,league):new Map(),[rows,league,score]);
 // What results have taught the model (learning.js): the Analyzer's correction, once loaded.
 const [learned,setLearned]=useState(0);
 useEffect(()=>{let live=true;Promise.resolve().then(()=>loadLearning()).then(()=>{if(live)setLearned(Date.now());}).catch(()=>{});return()=>{live=false;};},[]);
 const grades=useMemo(()=>propGrades(rows,league),[rows,league,learned]);
 // The NBA list reports what it shows for the track record (props-record.js).
 useEffect(()=>{
  if(config.key!=='nba'||!scores.size)return undefined;
  const wait=setTimeout(()=>reportProps(reportRows(mainLines(rows),scores,grades)),4000);
  return()=>clearTimeout(wait);
 },[config.key,rows,scores,grades]);
 // How the props it showed went (the NBA's): the record above the list.
 const [record,setRecord]=useState(null);
 useEffect(()=>{if(config.key!=='nba')return undefined;let live=true;loadRecord(14).then(found=>{if(live)setRecord(found);}).catch(()=>{});return()=>{live=false;};},[config.key]);
 const games=useMemo(()=>{
  const seen=new Map();
  for(const row of rows){
   const key=gameOf(row),game=seen.get(key);
   if(!game)seen.set(key,{key,away:row.awayTeamAbbr||'?',home:row.homeTeamAbbr||'?',awayLogo:row.awayTeamLogo||null,homeLogo:row.homeTeamLogo||null,startsAt:row.startsAt,count:1});
   else{game.count+=1;if(String(row.startsAt)<String(game.startsAt))game.startsAt=row.startsAt;}
  }
  return [...seen.values()].sort((a,b)=>String(a.startsAt).localeCompare(String(b.startsAt)));
 },[rows]);
 // A picked game that has since left the board (it started) shows them all again.
 const picked=games.some(item=>item.key===game)?game:'all';
 const needle=query.trim().toLowerCase();
 // The lines of the picked kind, and whether the league knows starters at all (the NBA's does).
 const ofKind=useMemo(()=>kind==='all'?rows:rows.filter(row=>tierOf(row)===kind),[rows,kind]);
 const roles=useMemo(()=>rows.some(row=>lineupRole(row,league)),[rows,league]);
 // What's set away from the usual (Regular lines, everyone, by matchup), shown as chips.
 const changed=[kind!=='standard'&&{key:'kind',label:KINDS.find(([key])=>key===kind)?.[1]+(kind==='all'?' lines':''),pic:PICS[kind]?.[0],clear:()=>setKind('standard')},
  roles&&roleShown!=='all'&&{key:'role',label:ROLES.find(([key])=>key===roleShown)?.[1],clear:()=>setRole('all')},
  sort!=='matchup'&&{key:'sort',label:`By ${SORTS.find(([key])=>key===sort)?.[1]}`,clear:()=>setSort('matchup')}].filter(Boolean);
 const shown=useMemo(()=>ofKind
  .filter(row=>(stat==='all'||row.marketKey===stat)&&(picked==='all'||gameOf(row)===picked)&&(!facing||row.opponent===facing)&&(!needle||row.player.toLowerCase().includes(needle)))
  .map(row=>({row,read:scores.get(row.id)||null,hit:hitOf(row),prop:grades.get(row.id)||null,role:lineupRole(row,league)}))
  // Starters or bench: a player the rotation doesn't list yet shows under neither.
  .filter(item=>!roles||roleShown==='all'||(item.role&&item.role.starter===(roleShown==='starter')))
  .sort((a,b)=>sort==='hit'?(b.hit?.rate??-1)-(a.hit?.rate??-1)||(b.read?.score??-1)-(a.read?.score??-1)
   :(b.read?.score??-1)-(a.read?.score??-1)||(b.hit?.rate??-1)-(a.hit?.rate??-1))
  // All stats: each player once, at his best line by the sort; a stat chip lists that stat's line.
  .filter((item,index,list)=>stat!=='all'||list.findIndex(other=>other.row.player===item.row.player&&other.row.teamAbbr===item.row.teamAbbr)===index),
  [ofKind,scores,grades,stat,picked,facing,needle,sort,league,roles,roleShown]);
 // The soft-spots map reads the whole board of the picked kind.
 const spots=useMemo(()=>{
  const teams=new Map();
  for(const row of ofKind){
   const value=scores.get(row.id)?.score;if(!Number.isFinite(value)||!row.opponent)continue;
   const team=teams.get(row.opponent)||{team:row.opponent,vs:row.teamAbbr||'',game:gameOf(row),stats:{},sum:0,n:0};
   const cell=team.stats[row.marketKey]||(team.stats[row.marketKey]={sum:0,n:0});
   cell.sum+=value;cell.n+=1;team.sum+=value;team.n+=1;teams.set(row.opponent,team);
  }
  const list=[...teams.values()].map(team=>({...team,avg:team.sum/team.n,cells:Object.fromEntries(Object.entries(team.stats).map(([key,{sum,n}])=>[key,sum/n]))}))
   .sort((a,b)=>b.avg-a.avg);
  const columns=STATS.filter(([key])=>key!=='all'&&list.some(team=>team.cells[key]!=null));
  let best=null;for(const team of list)for(const [key,value] of Object.entries(team.cells))if(!best||value>best.value)best={team:team.team,key,value};
  return {teams:list,columns,names:SHORT,best};
 },[ofKind,scores,STATS,SHORT]);
 // The soft-spots map and the track record fold open under one row, both
 // closed at first; each device keeps what was left open.
 const [fold,setFoldNow]=useState(()=>{try{return localStorage.getItem('props-fold')||'';}catch{return '';}});
 const setFold=value=>{setFoldNow(value);remember('props-fold',value);};
 const tableRef=useRef(null);
 const pickSpot=(key,team)=>{setStat(key);setGameNow('all');setFacing(team);if(!wide)setFold('');
  requestAnimationFrame(()=>tableRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));};
 const recordSummary=config.key==='nba'?recordOf(record):null;
 const counts=useMemo(()=>ofKind.reduce((out,row)=>({...out,[row.marketKey]:(out[row.marketKey]||0)+1}),{}),[ofKind]);
 // The prop beside the list: the one picked, else the list's first. One of
 // his other lines can be picked from the preview even when the list shows
 // another stat. His other lines are each stat's line of the picked kind.
 const itemOf=useCallback(row=>({row,read:scores.get(row.id)||null,hit:hitOf(row),prop:grades.get(row.id)||null,role:lineupRole(row,league)}),[scores,grades,league]);
 const chosen=useMemo(()=>{
  if(!picking)return null;
  const found=shown.find(item=>item.row.id===selectedId);
  if(found)return found;
  const row=selectedId&&ofKind.find(item=>item.id===selectedId);
  return row?itemOf(row):shown[0]||null;
 },[picking,shown,selectedId,ofKind,itemOf]);
 const others=useMemo(()=>chosen?ofKind.filter(row=>row.player===chosen.row.player&&row.teamAbbr===chosen.row.teamAbbr&&row.id!==chosen.row.id)
  .filter((row,index,list)=>list.findIndex(other=>other.marketKey===row.marketKey)===index).map(itemOf):[],[chosen,ofKind,itemOf]);
 // The stat tabs' underline glides to the picked one.
 const statRow=useRef(null);
 const statInk=useInk(statRow,`${stat}|${Object.keys(counts).length}|${page?page.id:''}`);
 // A player's page: its own history entry, so the phone's back gesture
 // closes it the same as the page's back button. Each entry carries a mark
 // made when this visit opened it (Oct 25, the owner: the back arrow went to
 // the Parlay Builder). An entry left from before a reload (the app updates
 // itself) still said a player was open; back then trusted it and went one
 // page too far. Now only this visit's own mark counts: anything else is
 // cleared, and back closes the page without leaving the Props tab.
 // Also (Oct 25, again "sometimes it goes to another page"): the site's tab
 // switch copied the mark onto the next screen's entry, so back from a page
 // left open while visiting another tab went to that tab. app.js no longer
 // copies it, and back steps through history only when nothing has been
 // added since the page opened (history.length the same); else it just closes.
 const opened=useRef(null),depth=useRef(0);
 const marked=()=>Boolean(opened.current)&&history.state?.nbaMatchup===opened.current;
 const clearMark=()=>{if(history.state?.nbaMatchup){const {nbaMatchup,...rest}=history.state;history.replaceState(rest,'',location.href);}};
 useEffect(()=>{if(!opened.current)clearMark();},[]);
 const openPage=useCallback(row=>{
  listScroll.current=window.scrollY;
  opened.current=`${row.id}:${Date.now()}`;
  history.pushState({...history.state,nbaMatchup:opened.current},'',location.href);
  depth.current=history.length;
  setPage(row);window.scrollTo(0,0);
 },[]);
 const closePage=useCallback(()=>{
  if(marked()&&history.length===depth.current){history.back();return;}
  opened.current=null;clearMark();setPage(null);
 },[]);
 useEffect(()=>{
  const onPop=()=>{if(!marked()){opened.current=null;clearMark();setPage(null);}};
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 useEffect(()=>{
  const root=document.getElementById('props-league-root');
  if(root)root.dataset.page=page?'player':'';
  if(!page)requestAnimationFrame(()=>window.scrollTo(0,listScroll.current));
  return()=>{if(root)root.dataset.page='';};
 },[page]);
 if(page)return <Page key={page.id} row={page} lines={rows.filter(item=>item.player===page.player&&item.teamAbbr===page.teamAbbr)} league={league} onBack={closePage}/>;

 return <section className="nba-matchups" data-league={config.key} data-wide={wide||undefined} data-preview={picking||undefined} aria-labelledby={`${config.key}-matchups-title`}>
  {/* Oct 25, the owner: "I see all buttons then I have to scroll down to
     see props". One slim title row, then search, game and a Filters button;
     sort, lines and players open under it, and what's picked shows as small
     chips that clear with a tap. */}
  <div className="nm-side">
  <header className="nm-head">
   <h2 id={`${config.key}-matchups-title`}>{words.title}</h2>
   <span className="nm-updated">{status==='loading'||status==='refreshing'?'Updating…':at?`Updated ${new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:''}{rows.length>0&&` · ${ofKind.length} props`}</span>
   <button type="button" className="nm-refresh" onClick={load} disabled={status==='loading'||status==='refreshing'} aria-label="Refresh">
    <RefreshCw size={15} className={status==='refreshing'?'nm-spin':undefined}/></button>
  </header>

  <div className="nm-tools">
   <label className="nm-search"><Search size={15} aria-hidden="true"/>
    <input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" enterKeyHint="search" aria-label="Find a player"/>
    {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search"><X size={14}/></button>}</label>
   {!wide&&<GamePicker games={games} value={picked} onChange={setGame}/>}
   {!wide&&<button type="button" className="nm-filter-button" aria-expanded={filtersOpen} aria-controls={`${config.key}-filters`} onClick={()=>setFiltersOpen(value=>!value)}
    aria-label={`Filters${changed.length?`, ${changed.length} on`:''}`}><SlidersHorizontal size={16} aria-hidden="true"/>{changed.length>0&&<i>{changed.length}</i>}</button>}
  </div>
  {showFilters&&<div className="nm-filters" id={`${config.key}-filters`}>
   <div className="nm-filter-row"><span>Sort</span><div className="nm-chips" role="group" aria-label="Sort by">
    {SORTS.map(([key,text])=><button type="button" key={key} aria-pressed={sort===key} onClick={()=>setSort(key)}>{text}</button>)}</div></div>
   <div className="nm-filter-row"><span>Lines</span><div className="nm-chips" role="group" aria-label="Lines">
    {KINDS.map(([key,text])=><button type="button" key={key} aria-pressed={kind===key} onClick={()=>setKind(key)}>
     {PICS[key]&&<img src={PICS[key][0]} alt="" width="14" height="14"/>}{text}</button>)}</div></div>
   {roles&&<div className="nm-filter-row"><span>Players</span><div className="nm-chips" role="group" aria-label="Players">
    {ROLES.map(([key,text])=><button type="button" key={key} aria-pressed={roleShown===key} onClick={()=>setRole(key)}>{text}</button>)}</div></div>}
  </div>}
  {!showFilters&&changed.length>0&&<div className="nm-active" aria-label="Filters on">{changed.map(item=>
   <button type="button" key={item.key} onClick={item.clear} aria-label={`Clear ${item.label}`}>{item.pic&&<img src={item.pic} alt="" width="13" height="13"/>}{item.label}<X size={12} aria-hidden="true"/></button>)}</div>}
  {wide&&<GameList games={games} value={picked} onChange={setGame}/>}
  </div>
  <div className="nm-maincol">
  <div className="nm-stats" role="group" aria-label="Stat" ref={statRow}>
   {STATS.filter(([key])=>key==='all'||counts[key]).map(([key,text])=><button type="button" key={key} aria-pressed={stat===key} onClick={()=>setStat(key)}>{text}</button>)}
   <i className="nm-ink" aria-hidden="true" style={inkStyle(statInk)}/>
  </div>

  {status==='loading'&&<div className="nm-empty"><RefreshCw size={18} className="nm-spin"/><b>{words.loading}</b>
   {progress?.total>0&&<span>Hit rates {progress.done} of {progress.total}</span>}</div>}
  {status==='error'&&<div className="nm-empty"><b>{words.failed}</b><button type="button" onClick={load}>Try again</button></div>}
  {(status==='ready'||status==='refreshing')&&!rows.length&&<div className="nm-empty"><b>{words.none}</b>
   <span>{words.noneText}</span></div>}
  {(spots.teams.length>0||recordSummary)&&<div className="nm-folds" data-two={spots.teams.length>0&&recordSummary?true:undefined}>
   {spots.teams.length>0&&<button type="button" className="nm-fold" data-kind="spots" aria-expanded={fold==='spots'} onClick={()=>setFold(fold==='spots'?'':'spots')}>
    <LayoutGrid size={16} aria-hidden="true"/><span><b>Soft spots</b><small>{spots.best?`${spots.best.team} ${SHORT[spots.best.key]} · ${Math.round(spots.best.value)}`:'By defense'}</small></span><ChevronDown size={15} aria-hidden="true"/></button>}
   {recordSummary&&<button type="button" className="nm-fold" data-kind="record" aria-expanded={fold==='record'} onClick={()=>setFold(fold==='record'?'':'record')}>
    <LineChart size={16} aria-hidden="true"/><span><b>Track record</b><small>{recordSummary.line}</small></span><ChevronDown size={15} aria-hidden="true"/></button>}
  </div>}
  {fold==='spots'&&spots.teams.length>0&&<section className="nm-spots" aria-label="Soft spots by defense"><SoftSpots spots={spots} stat={stat} facing={facing} onPick={pickSpot} wide={wide} league={league}/></section>}
  {fold==='record'&&recordSummary&&<section className="nm-record" aria-label="Track record"><RecordTable record={record} summary={recordSummary}/></section>}
  {facing&&<div className="nm-active nm-facing"><button type="button" onClick={()=>setFacing('')} aria-label={`Clear: against ${facing}'s defense`}>
   {league?.teams?.[facing]?.logo&&<img src={league.teams[facing].logo} alt="" width="13" height="13"/>}Against {facing}’s defense<X size={12} aria-hidden="true"/></button></div>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!league&&<p className="nm-note">Matchup scores are still loading the league’s numbers. Hit rates are below.</p>}

  <div className="nm-work">
  <div className="nm-workmain">
  {shown.length>0&&<div className="nm-table" ref={tableRef}>
   <div className="nm-thead"><span className="nm-th-rank">#</span><span className="nm-th-player">Player</span><span className="nm-th-line">Line</span>
    {SORTS.map(([key])=><button type="button" key={key} className={`nm-th nm-th-${key}`} aria-pressed={sort===key} onClick={()=>setSort(key)}
     aria-label={`Sort by ${HEADS[key][0]}`}><span className="nm-long">{HEADS[key][0]}</span><span className="nm-short">{HEADS[key][1]}</span>{sort===key&&<ArrowDown size={13} aria-hidden="true"/>}</button>)}</div>
   <ul className="nm-list">{shown.map(({row,read,hit,prop,role},index)=><PropRow key={row.id} row={row} read={read} hit={hit} prop={prop} role={role} index={index} color={teamColor(league,row.teamAbbr)} short={SHORT}
    open={openId===row.id} onToggle={()=>setOpenId(id=>id===row.id?null:row.id)} onOpen={openPage}
    picking={picking} selected={chosen?.row.id===row.id} onSelect={setSelectedId}/>)}</ul></div>}
  {(status==='ready'||status==='refreshing')&&rows.length>0&&!shown.length&&<div className="nm-empty"><b>Nothing matches</b>
   <span>Try another stat, game or filter, or clear the search.</span></div>}

  {at>0&&rows.length>0&&<p className="nm-meta">{shown.length} {shown.length===1?'prop':'props'} · updated {new Date(at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>}
  </div>
  {chosen&&<Preview item={chosen} others={others} league={league} short={SHORT} color={teamColor(league,chosen.row.teamAbbr)} onOpen={openPage} onPick={setSelectedId}/>}
  </div>
  </div>
 </section>;
}
