import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,BarChart3,CalendarClock,Check,ChevronLeft,ChevronRight,CircleCheck,Crown,Layers,Lock,LockOpen,Pencil,RefreshCw,Repeat2,Rocket,Search,Share2,Shield,ShieldCheck,Stethoscope,Ticket as TicketIcon,TriangleAlert,UserRound,X,Zap} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';
import {siteFinderSportAllowed} from './site-access';
import {finderSlipProp} from './unified-finder-data';
import {loadBoard,loadLines} from './finder-pool';
import {TARGETS,MIXES,SPORT_NAMES,candidates,buildLadder,safest,exportLeg,isPrizePicksLine,gameKey,slateGames} from './smart-slip';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import {loadMatchups,withMatchups} from './slip-matchup';
import {withPoolDefense} from './slip-analyst';
import {gradeMatchups,withMatchup,passesMatchup,overOnly} from './krazy-bot';
import {loadGames,loadTeammates,withGame} from './slip-games';
import {HEADLINES,gradeTone} from './slip-score';
import {shareCard} from './slip-share';
import {builderSlip,handOff} from './slip-handoff';
import {loadLearning} from './learning';
import {logTopPicks,newSlipId,saveSlip,slipPayload} from './slip-history';
import {MatchupCase} from './MatchupCase';
import {opponentLogo,teamLogo,Img,Face,TierBadge,Records,Meter,Games} from './PickParts';
import './smart-slip.css';

// The Smart Slip page (the Parlay tab), one question at a time: a start
// screen, then the payout, the slip (how many picks, Power or Flex, which
// lines), the sports, a game or a player to build around, and a last look
// before building. The build plays out in the same card, then the slips
// show. smart-slip.js finds them.
const KEYS=['mlb','nba','wnba','nfl','nhl','soccer'];
const SIZES=['auto',2,3,4,5,6];
const PREFS_KEY='krazy-smart-slip';
const EXPORT_URL='/api/prediction?action=prizepicks-export&from=parlay';
// Phones and the home-screen app: PrizePicks comes up over this page and
// pauses it, so nothing may be left waiting here when it opens (app.js
// handheldExport, for the Pick Builder).
const handheld=()=>window.navigator.standalone===true||Boolean(window.matchMedia?.('(display-mode: standalone)').matches||window.matchMedia?.('(pointer: coarse)').matches);
const slipKey=slip=>slip?slip.legs.map(leg=>`${leg.id}:${leg.side}:${leg.line}`).join('|'):'';
const MODIFIER_ICON={goblin:'/prizepicks/goblin.png',demon:'/prizepicks/demon.png'};
// Each payout band's name and colour, safest to boldest.
const LEVELS={2:{name:'Safest',tone:'#5fe0a8',Icon:ShieldCheck},3:{name:'Solid',tone:'#00f58a',Icon:CircleCheck},5:{name:'Boost',tone:'#f6c35b',Icon:Zap},
 10:{name:'Big',tone:'#ff9f5a',Icon:Rocket},20:{name:'Long shot',tone:'#ff6b8b',Icon:Crown}};
const MIX_OPTIONS=[['regular','Regular only',['standard','standard'],'Standard PrizePicks lines'],['goblin','Regular + Goblin',['standard','goblin'],'Easier lines, lower payout'],
 ['demon','Regular + Demon',['standard','demon'],'Harder lines, higher payout'],['any','Mix it up',['standard','goblin','demon'],'Whatever builds the best slip']];
const PLAYS=[['power','Power',Zap,'Every pick has to hit. Pays the most.'],['flex','Flex',Shield,'Still pays if one pick misses.']];
const PAYOUT_HINT={2:'Likeliest to hit',3:'A steady win',5:'A bigger swing',10:'Big win, longer odds',20:'Swing for the fences'};
// The questions, in order (0 is the start screen).
const FLOW=[['payout','Payout','What are you going for?','Bigger payouts mean longer odds.'],
 ['slip','Slip','Set up your slip','How many picks, how it pays and which lines.'],
 ['sports','Sports','Which sports?','Leave them all on for the most picks to choose from.'],
 ['games','Games','Pick a game or a player','Or skip this and build from every game.'],
 ['build','Build','Ready to build','Tap anything to change it.']];
const LAST=FLOW.length;
// Players a slip can be built around.
const MOST_PLAYERS=3;
const STEPS=[['Pulling the lines',Layers],['Checking hit rates',BarChart3],['Matchups, injuries and odds',Stethoscope],['Building your slip',TicketIcon]];
const PRIZEPICKS_LOGO='/prizepicks/logo.png';
// The picks a slip is built from, judged as the Slip Analyzer and Krazy Bot
// judge them (krazy-bot.js withMatchup): the matchup first, then each one's
// game news (who's out, who starts, a teammate's absence) for the strongest
// of them. Only picks that pass (Elite or Strong; Lean where a league has no
// matchup reads) go on a slip, so nothing Risky or ruled out gets built in.
// Every pick a slip can be built from: the slip search takes at most this
// many of each kind of line (smart-slip.js buildLadder), and each one's
// game news is read, as the Slip Analyzer reads it for every pick.
const NEWS_FOR=60;
async function judged(rows,sports,{signal,now}){
 const tables=await loadMatchups(sports,{signal}).catch(()=>({}));
 const listed=withPoolDefense(rows.map(row=>withMatchups(row,tables)));
 // Overs only: an Under never makes a slip.
 const usable=leg=>passesMatchup(leg)&&overOnly(leg);
 const graded=gradeMatchups(candidates(listed,{now}),tables).filter(usable);
 const top=['standard','goblin','demon'].flatMap(kind=>graded.filter(leg=>leg.modifier===kind).sort((a,b)=>b.chance*b.factor-a.chance*a.factor).slice(0,NEWS_FOR));
 const asks=top.map(leg=>({key:leg.id,row:leg.row}));
 let found={},mates={};
 try{
  found=await loadGames(asks,{signal})||{};
  mates=await loadTeammates(asks.filter(item=>found[item.key]).map(item=>({key:item.key,row:withGame(item.row,found[item.key])})),{signal}).catch(()=>({}));
 }catch{/* built on the matchups alone */}
 return graded.map(leg=>{
  const game=found[leg.id];
  return game?withMatchup({...leg,chance:leg.trendChance??leg.chance,row:withGame(leg.row,{...game,teammates:mates[leg.id]||[]})},leg.matchupRequired,tables):leg;
 }).filter(usable);
}

const percent=value=>`${Math.round(value*100)}%`;
// A player's last name, without Jr. or III.
const shortName=name=>String(name||'').split(/\s+/).filter(word=>!/^(jr|sr|ii|iii|iv)\.?$/i.test(word)).at(-1)||name;
const times=(value,estimated)=>`${estimated?'≈':''}${value>=10?Math.round(value):Number(value.toFixed(value<3?2:1))}x`;
const figure=value=>String(value);
const when=iso=>{const time=Date.parse(iso||'');if(!Number.isFinite(time))return '';const date=new Date(time),today=new Date();
 const clock=date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 return date.toDateString()===today.toDateString()?clock:`${date.toLocaleDateString([],{weekday:'short'})} ${clock}`;};
// A line being checked, for the build's feed: who, what and his team's mark.
const scanItem=row=>({key:row.id,player:row.player,market:row.market,line:row.line,row});
const pause=(ms,signal)=>new Promise(resolve=>{const id=setTimeout(resolve,ms);signal?.addEventListener('abort',()=>{clearTimeout(id);resolve();},{once:true});});
const calm=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function readPrefs(){try{return JSON.parse(localStorage.getItem(PREFS_KEY)||'{}')||{};}catch{return {};}}

// A number that climbs to its value: from 1 when it first shows, then
// from wherever it was.
function useCountUp(value){
 const [shown,setShown]=useState(1);
 const last=useRef(1);
 useEffect(()=>{
  if(calm()){last.current=value;setShown(value);return;}
  let frame,start;const from=last.current;
  const run=time=>{start??=time;const t=Math.min(1,(time-start)/700);last.current=from+(value-from)*(1-Math.pow(1-t,3));setShown(last.current);if(t<1)frame=requestAnimationFrame(run);};
  frame=requestAnimationFrame(run);
  return()=>cancelAnimationFrame(frame);
 },[value]);
 return shown;
}

// A line on PrizePicks: a regular one is PrizePicks' own mark, Goblins and
// Demons their icons.
function Token({kind}){
 return <i className={`ss-token is-${MODIFIER_ICON[kind]?kind:'standard'}`}><img src={MODIFIER_ICON[kind]||PRIZEPICKS_LOGO} alt=""/></i>;
}

// A headshot is see-through around the player, so the initials beneath step aside once it's in.
const photoIn=event=>event.currentTarget.parentElement.classList.add('has-photo');
// A row of player photos, overlapping (initials when there's no photo).
function Faces({players,max=3}){
 const shown=(players||[]).slice(0,max),more=(players||[]).length-shown.length;
 return <span className="ss-faces" aria-hidden="true">{shown.map(player=><span key={player.name} className="ss-face-mini">
  <i>{String(player.name||'').split(/\s+/).map(part=>part[0]).join('').slice(0,2)}</i>
  {player.headshot&&<img src={player.headshot} alt="" loading="lazy" onLoad={photoIn} onError={event=>{event.currentTarget.hidden=true;}}/>}</span>)}
  {more>0&&<span className="ss-face-mini is-more"><i>+{more}</i></span>}</span>;
}

// The steps across the top: done ones ticked, the one showing lit, any of
// them a tap away.
function Progress({at,onGo}){
 return <nav className="ss-tabs" aria-label="Steps" style={{'--fill':(at-1)/(LAST-1)}}>
  <i className="ss-tabs-track" aria-hidden="true"><i/></i>
  {FLOW.map(([key,label],n)=>{const state=n+1<at?'done':n+1===at?'active':'next';
   return <button type="button" key={key} data-state={state} aria-current={state==='active'?'step':undefined} onClick={()=>onGo(n+1)}>
    <span>{state==='done'?<Check size={12} strokeWidth={3.4}/>:n+1}</span><small>{label}</small></button>;})}
 </nav>;
}

// A search box for the long lists.
function Find({value,onChange,label}){
 return <label className="ss-game-search"><Search size={15} aria-hidden="true"/>
  <input type="search" value={value} onChange={event=>onChange(event.target.value)} placeholder={label} aria-label={label}/>
  {value&&<button type="button" onClick={()=>onChange('')} aria-label="Clear search"><X size={14}/></button>}</label>;
}

// The games to build from: every game on the chosen sports' boards, its
// teams' logos, start and some of the players with lines in it. None
// picked means every game.
function GamePicker({games,picked,onToggle,loading}){
 const [query,setQuery]=useState('');
 const needle=query.trim().toLowerCase();
 const found=needle?games.filter(game=>[game.away.abbr,game.home.abbr,SPORT_NAMES[game.sport],...game.players.map(player=>player.name)].some(text=>String(text||'').toLowerCase().includes(needle))):games;
 if(loading&&!games.length)return <div className="ss-games is-loading" aria-label="Loading games">{[0,1,2].map(n=><span key={n} className="ss-game-skel"/>)}</div>;
 if(!games.length)return <p className="ss-games-none">No games with PrizePicks lines left today for these sports.</p>;
 return <>
  {games.length>5&&<Find value={query} onChange={setQuery} label="Search a team or player"/>}
  <div className="ss-games">{found.map((game,index)=>{
   const on=picked.includes(game.key);
   return <button type="button" key={game.key} className="ss-game" aria-pressed={on} onClick={()=>onToggle(game.key)} style={{'--i':Math.min(index,10)}}>
    <span className="ss-game-logos"><Img src={game.away.logo||LEAGUE_LOGOS[game.sport]}/><Img src={game.home.logo||LEAGUE_LOGOS[game.sport]}/></span>
    <span className="ss-game-text"><b>{game.away.abbr} <i>@</i> {game.home.abbr}</b>
     <small><Img className="ss-game-league" src={LEAGUE_LOGOS[game.sport]}/>{when(game.startsAt)} · {game.players.length} player{game.players.length===1?'':'s'}</small></span>
    <Faces players={game.players.filter(player=>player.headshot).concat(game.players.filter(player=>!player.headshot))}/>
    <span className="ss-game-tick" aria-hidden="true"><Check size={12} strokeWidth={3.4}/></span>
   </button>;})}
   {needle&&!found.length&&<p className="ss-games-none">No game matches “{query}”.</p>}
  </div>
 </>;
}

// The players to build around: each one's photo, team and game. A player
// picked is on the slip with their best pick, if they have one.
function PlayerPicker({players,picked,onToggle,loading}){
 const [query,setQuery]=useState('');
 const needle=query.trim().toLowerCase();
 const found=needle?players.filter(player=>[player.name,player.team,player.opp].some(text=>String(text||'').toLowerCase().includes(needle))):players;
 const listed=[...found.filter(player=>picked.includes(player.key)),...found.filter(player=>!picked.includes(player.key))].slice(0,needle?80:40);
 if(loading&&!players.length)return <div className="ss-games is-loading" aria-label="Loading players">{[0,1,2].map(n=><span key={n} className="ss-game-skel"/>)}</div>;
 if(!players.length)return <p className="ss-games-none">No players with PrizePicks lines left today for these sports.</p>;
 return <>
  <Find value={query} onChange={setQuery} label="Search a player or team"/>
  <div className="ss-games">{listed.map((player,index)=>{
   const on=picked.includes(player.key);
   return <button type="button" key={player.key} className="ss-game ss-player" aria-pressed={on} onClick={()=>onToggle(player.key)} style={{'--i':Math.min(index,10)}}>
    <span className="ss-player-face"><i>{String(player.name||'').split(/\s+/).map(part=>part[0]).join('').slice(0,2)}</i>
     {player.headshot&&<img src={player.headshot} alt="" loading="lazy" onError={event=>{event.currentTarget.hidden=true;}}/>}
     <Img className="ss-player-team" src={player.logo||LEAGUE_LOGOS[player.game.sport]}/></span>
    <span className="ss-game-text"><b>{player.name}</b>
     <small><Img className="ss-game-league" src={LEAGUE_LOGOS[player.game.sport]}/>{player.team} vs {player.opp} · {when(player.game.startsAt)}</small></span>
    <span className="ss-game-tick" aria-hidden="true"><Check size={12} strokeWidth={3.4}/></span>
   </button>;})}
   {needle&&!found.length&&<p className="ss-games-none">No player matches “{query}”.</p>}
   {!needle&&found.length>listed.length&&<p className="ss-games-more">Search to find any of {found.length} players.</p>}
  </div>
 </>;
}

function Segment({options,value,onChange,label}){
 const at=Math.max(0,options.findIndex(([key])=>key===value));
 return <div className="ss-seg" role="group" aria-label={label} style={{'--n':options.length,'--at':at}}>
  <i className="ss-seg-thumb" aria-hidden="true"/>
  {options.map(([key,text,Icon])=><button type="button" key={key} aria-pressed={key===value} onClick={()=>onChange(key)}>{Icon&&<Icon size={14}/>}{text}</button>)}
 </div>;
}

// The build, step by step: the slip on the left fills with the picks that
// make it (empty slots until then), the steps tick off on the right, and
// the lines being checked roll past with their photos and teams.
function BuildStage({step,share,sports,scan,legs,checked,total}){
 const [tick,setTick]=useState(0);
 useEffect(()=>{if(calm())return undefined;const id=setInterval(()=>setTick(n=>n+1),420);return()=>clearInterval(id);},[]);
 const lines=scan.current;
 const feed=lines.length?[0,1,2].map(k=>lines[(tick+k)%lines.length]):[];
 const done=step===0?8:step===1?15+share*65:step===2?88:100;
 const slots=legs?.length?legs:[null,null,null];
 return <div className="ss-stage sa-scope" role="status" aria-live="polite" aria-label={STEPS[step][0]}>
  <div className="ss-fill">
   <header><img src={PRIZEPICKS_LOGO} alt=""/><b>Your slip</b><span>{legs?.length?`${legs.length} picks`:'Picking…'}</span></header>
   <ol>{slots.map((leg,n)=><li key={leg?.id||`slot-${n}`} data-filled={leg?'true':undefined} style={{'--i':n}}>
    {leg?<><Face row={leg.row} leg={leg} tier={leg.tier}/>
      <span className="ss-fill-who"><b>{leg.row.player}</b><small>{leg.side==='UNDER'?'Less':'More'} {figure(leg.row.line)} {leg.row.market}</small></span>
      {leg.tier&&<TierBadge tier={leg.tier}/>}</>
     :<><i className="ss-slot-face"/><span className="ss-slot-text"><i/><i/></span></>}
   </li>)}</ol>
  </div>
  <div className="ss-stage-side">
   <ol className="ss-steps">{STEPS.map(([text,Icon],n)=><li key={text} data-state={n<step?'done':n===step?'active':'waiting'}>
    <span className="ss-step-icon">{n<step?<Check size={14} strokeWidth={3}/>:<Icon size={15}/>}</span><span>{text}</span>
    {n===0&&<span className="ss-step-logos">{sports.map(key=><Img key={key} src={LEAGUE_LOGOS[key]}/>)}</span>}</li>)}</ol>
   <ul className="ss-feed" aria-hidden="true">{feed.map((item,k)=><li key={`${item.key}-${tick+k}`} style={{'--k':k}}>
    <Face row={item.row} leg={item}/><span className="ss-feed-who"><b>{item.player}</b><small>{item.market} {figure(item.line)}</small></span>
    <Img className="ss-feed-team" src={teamLogo(item.row)||LEAGUE_LOGOS[item.row?.sport]}/></li>)}</ul>
   <div className="ss-progress"><span className="ss-progress-bar"><i style={{width:`${Math.round(done)}%`}}/></span>
    <span className="ss-progress-text">{total?`${Math.min(checked,total).toLocaleString()} of ${total.toLocaleString()} lines checked`:'Loading the board'}<b>{Math.round(done)}%</b></span></div>
  </div>
 </div>;
}

// A pick on the slip, read the Slip Analyzer's way: his photo and team,
// the tier, his chance against what each pick needs, the matchup, his
// records and last ten games -- then lock, swap or research it.
function Pick({leg,index,need,locked,onLock,onSwap,onResearch}){
 const row=leg.row;
 const average=row.windows?.l10?.average??row.average;
 return <article className="sa-prop ss-pick" data-tier={leg.tier||'none'} style={{'--i':index}}>
  <Img className="sa-prop-mark" src={teamLogo(row)}/>
  <header className="sa-prop-head">
   <Face row={row} leg={leg} tier={leg.tier}/>
   <div className="sa-who"><b>{row.player}</b>
    <span className="sa-who-game"><Img className="sa-who-league" src={LEAGUE_LOGOS[row.sport]}/>
     {[row.teamAbbr,row.position].filter(Boolean).join(' · ')||SPORT_NAMES[row.sport]}
     {row.opponent&&<span className="sa-who-vs"><span>{row.isHome===false?'@':'vs'}</span><Img src={opponentLogo(row)}/><span>{row.opponent}</span></span>}</span>
    {row.startsAt&&<small>{when(row.startsAt)}</small>}</div>
   {leg.tier&&<TierBadge tier={leg.tier}/>}
  </header>
  <div className="sa-prop-pick"><span className="sa-side" data-side={leg.side}>{leg.side==='UNDER'?'Less':'More'}</span><b>{figure(row.line)}</b><span>{row.market}</span>
   {MODIFIER_ICON[leg.modifier]&&<img src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="20" height="20"/>}</div>
  <Meter chance={leg.chance} need={need}/>
  <MatchupCase matchup={leg.matchup} limit={3}/>
  <div className="sa-form-head"><span>Recent form</span>
   <div className="sa-prop-figures">
    {typeof average==='number'&&Number.isFinite(average)&&<span><small>Avg L10</small><b>{figure(Math.round(average*10)/10)}</b></span>}
    {leg.book!=null&&<span><small>Books</small><b>{percent(leg.book)}</b></span>}
   </div></div>
  <Records grade={leg} row={row}/>
  <Games row={row} line={row.line} side={leg.side}/>
  {leg.read?.risks?.length>0&&<ul className="sa-risks">{leg.read.risks.slice(0,2).map(risk=><li key={risk}><TriangleAlert size={12}/>{risk}</li>)}</ul>}
  <footer className="sa-prop-actions">
   <button type="button" className="ss-lock" aria-pressed={locked} onClick={onLock}>{locked?<Lock size={14}/>:<LockOpen size={14}/>}{locked?'Locked':'Lock'}</button>
   <button type="button" onClick={onSwap} disabled={locked}><Repeat2 size={14}/>Swap</button>
   <button type="button" onClick={onResearch}><Search size={14}/>Research</button>
  </footer>
 </article>;
}

// The built slip as a picture to post: the slip card, each pick's line as PrizePicks shows it (slip-share.js drawCard).
async function shareBuilt(slip){
 await shareCard({letter:slip.letter,play:slip.play,payout:slip.payout,
  legs:slip.legs.map(leg=>({player:leg.row.player,team:leg.row.teamAbbr,position:leg.row.position,sport:leg.row.sport,headshot:leg.row.headshot,
   teamLogo:teamLogo(leg.row),side:leg.side,line:leg.row.line,stat:leg.row.market,modifier:leg.row.modifier}))});
}

function Ticket({slip,locked,onLock,onSwap,onResearch,onAdd,onExport,exporting,link,onCheck}){
 const [sharing,setSharing]=useState(false);
 const share=async()=>{if(sharing)return;setSharing(true);try{await shareBuilt(slip);}finally{setSharing(false);}};
 const level=LEVELS[slip.target]||LEVELS[2];
 const pays=useCountUp(slip.payout);
 // What each pick has to hit for the slip to pay its way.
 const need=Math.pow(1/slip.payout,1/slip.legs.length);
 return <div className="ss-ticket" style={{'--tone':level.tone}}>
  <div className="ss-ticket-head">
   <div className="ss-ticket-title">
    {slip.letter&&<span className="ss-grade" data-tone={gradeTone(slip.letter)} title="The grade the Slip Analyzer gives this slip"><b>{slip.letter}</b><small>Grade</small></span>}
    <div><span className="ss-ticket-kind"><i><level.Icon size={12} strokeWidth={2.6}/>{level.name}</i><img src={PRIZEPICKS_LOGO} alt=""/>{slip.legs.length}-pick {slip.play==='flex'?'Flex':'Power'} Play</span>
     <strong>Pays {times(pays,slip.estimated)}</strong>{slip.letter&&<span className="ss-grade-words">{HEADLINES[slip.letter]}</span>}</div></div>
   <dl>
    <div><dt>{slip.play==='flex'?'To profit':'All hit'}</dt><dd>{percent(slip.play==='flex'?slip.profit:slip.chance)}</dd></div>
    <div><dt>Edge</dt><dd className={slip.value>=1?'is-up':'is-down'}>{slip.value>=1?'+':'−'}{Math.abs(Math.round((slip.value-1)*100))}%</dd></div>
    <div><dt>Fair price</dt><dd>{times(slip.fair,false)}</dd></div>
   </dl>
  </div>
  <div className="ss-picks sa-scope" data-count={slip.legs.length}>{slip.legs.map((leg,index)=><Pick key={leg.id} leg={leg} index={index} need={need} locked={locked.includes(leg.id)}
   onLock={()=>onLock(leg.id)} onSwap={()=>onSwap(leg)} onResearch={()=>onResearch(leg)}/>)}</div>
  <div className="ss-ticket-actions">
   <button type="button" className="ss-add" onClick={onAdd}><Check size={16}/>Add to My Slip</button>
   {link&&!exporting?<a className="ss-primary" href={link} target="_blank" rel="noopener noreferrer"><img src={PRIZEPICKS_LOGO} alt=""/>Open in PrizePicks<ArrowUpRight size={16}/></a>
    :<button type="button" className="ss-primary" onClick={onExport} disabled={exporting}>{exporting?<RefreshCw size={16} className="ss-spin"/>:<img src={PRIZEPICKS_LOGO} alt=""/>}{exporting?'Checking picks…':'Open in PrizePicks'}<ArrowUpRight size={16}/></button>}
  </div>
  <div className="ss-ticket-more">
   <button type="button" className="ss-check-slip" onClick={onCheck}><ShieldCheck size={16}/>Check in Slip Analyzer<ArrowUpRight size={15}/></button>
   <button type="button" className="ss-share" onClick={share} disabled={sharing}><Share2 size={16}/>{sharing?'Making…':'Share'}</button>
  </div>
  {slip.estimated&&<p className="ss-fine">Payouts with Goblins or Demons are estimates. PrizePicks shows the exact payout before you submit.</p>}
 </div>;
}

export function SmartSlip(){
 const saved=useMemo(readPrefs,[]);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const bump=()=>setRevision(n=>n+1);window.addEventListener('vortex:site-policy',bump);return()=>window.removeEventListener('vortex:site-policy',bump);},[]);
 const allowed=useMemo(()=>KEYS.filter(siteFinderSportAllowed),[revision]);
 const [target,setTarget]=useState(TARGETS.includes(saved.target)?saved.target:2);
 const [mix,setMix]=useState(MIXES[saved.mix]?saved.mix:saved.alternates===false?'regular':'any');
 const [size,setSize]=useState(SIZES.includes(saved.size)?saved.size:'auto');
 const [play,setPlay]=useState(saved.play==='flex'?'flex':'power');
 const [sports,setSports]=useState(Array.isArray(saved.sports)?saved.sports:[]);
 const [sameGame,setSameGame]=useState(saved.sameGame===true);
 useEffect(()=>{try{localStorage.setItem(PREFS_KEY,JSON.stringify({target,mix,size,play,sports,sameGame}));}catch{}},[target,mix,size,play,sports,sameGame]);
 // No sport picked means every sport the site allows.
 const chosen=useMemo(()=>{const picked=sports.filter(key=>allowed.includes(key));return picked.length?picked:allowed;},[sports,allowed]);
 // Today's games on every allowed sport's board (the saved boards the
 // Finder keeps, else fresh ones): what the Games step lists, and how many
 // each sport has.
 const [slate,setSlate]=useState({loading:true,games:[]});
 useEffect(()=>{
  const control=new AbortController();
  setSlate(old=>({...old,loading:true}));
  Promise.allSettled(allowed.map(sport=>loadBoard(sport,{signal:control.signal,saved:true}))).then(results=>{
   if(control.signal.aborted)return;
   const rows=results.flatMap(result=>result.status==='fulfilled'?result.value.rows||[]:[]);
   setSlate({loading:false,games:slateGames(rows,{logo:teamLogo,opponentLogo})});
  });
  return()=>control.abort();
 },[allowed]);
 const [gamesPicked,setGamesPicked]=useState([]);
 const games=useMemo(()=>slate.games.filter(game=>chosen.includes(game.sport)),[slate,chosen]);
 const picked=useMemo(()=>gamesPicked.filter(key=>games.some(game=>game.key===key)),[gamesPicked,games]);
 const gameCount=useMemo(()=>slate.games.reduce((counts,game)=>({...counts,[game.sport]:(counts[game.sport]||0)+1}),{}),[slate]);
 const toggleGame=key=>setGamesPicked(old=>old.includes(key)?old.filter(item=>item!==key):[...old.filter(item=>games.some(game=>game.key===item)),key]);
 // Every player with a line in those games, soonest game first.
 const players=useMemo(()=>games.flatMap(game=>game.players.map(player=>{
  const away=player.team===game.away.abbr;
  return {...player,game,key:`${game.key}|${player.name}`,logo:(away?game.away:game.home).logo,opp:away?game.home.abbr:game.away.abbr};
 })),[games]);
 // The players the slip is built around.
 const [anchors,setAnchors]=useState([]);
 const anchored=useMemo(()=>players.filter(player=>anchors.includes(player.key)),[players,anchors]);
 // A few games picked: enough picks may come from each to fill a slip (all
 // six from one, in a one-game parlay). Players picked from one game may all
 // go on it.
 const perGame=useMemo(()=>{
  const counts=new Map();
  for(const player of anchored)counts.set(player.game.key,(counts.get(player.game.key)||0)+1);
  const most=Math.max(0,...counts.values());
  if(picked.length&&picked.length<=3)return Math.max(sameGame?2:1,Math.ceil(6/picked.length),most);
  return most>1?Math.max(most,sameGame?2:1):null;
 },[picked,anchored,sameGame]);

 const [status,setStatus]=useState('idle');
 const [step,setStep]=useState(0);
 const [progress,setProgress]=useState({});
 const [lineCount,setLineCount]=useState(0);
 const [pool,setPool]=useState([]);
 const [builtAt,setBuiltAt]=useState(0);
 // What the slips on hand were built from: change any of it and they need building again.
 const [builtFor,setBuiltFor]=useState('');
 // Locked by the member; swapped out; the slip a swap is working on (its
 // band, its size and the picks it keeps).
 const [locked,setLocked]=useState([]);
 const [excluded,setExcluded]=useState([]);
 const [swap,setSwap]=useState(null);
 const [selected,setSelected]=useState(null);
 const [notice,setNotice]=useState('');
 const [exporting,setExporting]=useState(false);
 // The PrizePicks link for the slip on screen, once its picks are checked.
 const [exported,setExported]=useState({key:'',url:''});
 const [toast,setToast]=useState('');
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(id);},[toast]);
 const controller=useRef(null),scan=useRef([]),pageRef=useRef(null);
 const builder=usePickBuilder();

 // Which question shows (0 the start screen), which way the last move went,
 // and whether the member came from the last look (so a change goes back there).
 const [at,setAt]=useState(0);
 const [dir,setDir]=useState(1);
 const [fromReview,setFromReview]=useState(false);
 const [editing,setEditing]=useState(true);
 const [findBy,setFindBy]=useState('games');
 const view=status==='loading'?'building':editing||status==='idle'?'setup':'result';
 // Every change of view or question starts at the top of the page.
 useEffect(()=>{
  const top=pageRef.current?.getBoundingClientRect().top??0;
  if(top<0)window.scrollTo({top:Math.max(0,window.scrollY+top-8),behavior:calm()?'auto':'smooth'});
 },[view,at]);
 const go=next=>{
  const to=Math.max(0,Math.min(LAST,next));
  setDir(to>=at?1:-1);setAt(to);
  if(to===LAST)setFromReview(false);
 };
 const edit=n=>{setFromReview(true);go(n);};
 const onward=()=>go(fromReview?LAST:at+1);
 // A single choice moves on by itself once its tick has shown.
 const advance=useRef(0);
 useEffect(()=>()=>clearTimeout(advance.current),[]);
 const chooseThenGo=()=>{clearTimeout(advance.current);advance.current=setTimeout(onward,calm()?0:320);};

 const base=useMemo(()=>pool.length?buildLadder(pool,{play,size,mix,sameGame,perGame,locked,excluded}):[],[pool,play,size,mix,sameGame,perGame,locked,excluded]);
 // A swap changes one pick of one slip: same band, same size, the rest kept.
 const swapped=useMemo(()=>swap&&pool.length?buildLadder(pool,{play,size:swap.size,mix,sameGame,perGame,locked:[...new Set([...locked,...swap.kept])],excluded,only:[swap.target]})[0]||null:null,
  [swap,pool,play,mix,sameGame,perGame,locked,excluded]);
 const ladder=useMemo(()=>{
  const bands=new Map(base.map(item=>[item.target,item]));
  if(swapped)bands.set(swapped.target,swapped);
  return TARGETS.filter(value=>bands.has(value)).map(value=>bands.get(value));
 },[base,swapped]);
 useEffect(()=>setSwap(null),[play,size,mix,sameGame,perGame]);
 // The one to point to: the likeliest to cash.
 const recommended=useMemo(()=>safest(ladder),[ladder]);
 // The band asked for, else the nearest bigger one, else the biggest there is.
 const slip=useMemo(()=>ladder.find(item=>item.target===selected)||ladder.find(item=>item.target>=target)||ladder.at(-1)||null,[ladder,selected,target]);

 const source=JSON.stringify([chosen,picked,anchored.map(player=>player.key)]);
 const build=useCallback(async()=>{
  controller.current?.abort();
  const control=new AbortController();controller.current=control;
  const started=Date.now();
  setEditing(false);
  setStatus('loading');setStep(0);setNotice('');setLocked([]);setSwap(null);setExcluded([]);setSelected(null);setProgress({});setPool([]);setLineCount(0);
  scan.current=[];
  // What the results have taught the model, before anything is graded.
  await loadLearning();
  const now=Date.now();
  // The games picked (and those of the players picked), else every game;
  // only their sports are loaded.
  const keys=picked.length?[...new Set([...picked,...anchored.map(player=>player.game.key)])]:[];
  const sportsFor=keys.length?[...new Set(slate.games.filter(game=>keys.includes(game.key)).map(game=>game.sport))]:chosen;
  const inGames=row=>!keys.length||keys.includes(gameKey(row));
  // Every kind of line, so a different mix needs no second build.
  const only=row=>isPrizePicksLine(row)&&Date.parse(row.startsAt||'')>now+10*60000&&inGames(row);
  let checked=false;
  const results=await Promise.allSettled(sportsFor.map(sport=>loadLines(sport,{signal:control.signal,only,onProgress:update=>{
   setProgress(old=>({...old,[sport]:update}));
   if(update.stage==='history'){checked=true;setStep(old=>Math.max(old,1));}
   if(update.rows?.length)scan.current=[...scan.current,...update.rows.map(scanItem)].slice(-60);
  }})));
  if(control.signal.aborted)return;
  const rows=results.flatMap(result=>result.status==='fulfilled'?result.value:[]).filter(inGames);
  const failed=sportsFor.filter((_,index)=>results[index].status==='rejected');
  let found=[];
  try{found=await judged(rows,sportsFor,{signal:control.signal,now:Date.now()});}
  catch{if(control.signal.aborted)return;found=candidates(rows,{now:Date.now()}).filter(leg=>leg.side!=='UNDER');}
  if(control.signal.aborted)return;
  // The day's best picks go back to be settled and learned from (learning.py).
  logTopPicks(found.map(leg=>({row:leg.row,side:leg.side,line:leg.line,modifier:leg.modifier,grade:leg})),{source:'board',limit:80});
  // Each player picked goes on with their best pick of the lines allowed.
  const kinds=(MIXES[mix]||MIXES.any).kinds,missing=[],around=[];
  for(const player of anchored){
   const best=found.filter(leg=>leg.row.player===player.name&&gameKey(leg.row)===player.game.key&&kinds.includes(leg.modifier)).sort((a,b)=>b.chance-a.chance)[0];
   if(best)around.push(best.id);else missing.push(player.name);
  }
  // Every step shows, even when every line was already saved.
  const lines=rows.filter(only);
  // The feed favours lines with a photo; every line still counts as checked.
  const pictured=lines.filter(row=>row.headshot);
  const pool_=pictured.length>=12?pictured:lines;
  if(pool_.length)scan.current=Array.from({length:Math.min(60,pool_.length)},()=>scanItem(pool_[Math.floor(Math.random()*pool_.length)]));
  setLineCount(lines.length);
  const quiet=calm();
  const hold=async(next,ms)=>{setStep(old=>Math.max(old,next));if(!quiet)await pause(ms,control.signal);return !control.signal.aborted;};
  if(!await hold(0,420-(Date.now()-started)))return;
  if(!await hold(1,checked?200:500))return;
  if(!await hold(2,550))return;
  // The picks drop into the slip on the last step, then the options show.
  setPool(found);setLocked(around);
  if(!await hold(3,1300))return;
  setBuiltAt(Date.now());setBuiltFor(source);
  setStatus(rows.length?'ready':'error');
  const notes=[];
  if(missing.length)notes.push(`No Elite or Strong pick for ${missing.join(' or ')} right now, so the slip is built without ${missing.length===1?'that player':'those players'}.`);
  if(failed.length)notes.push(`${failed.map(key=>SPORT_NAMES[key]).join(', ')} lines couldn’t load right now.`);
  setNotice(notes.join(' '));
 },[chosen,picked,anchored,slate,mix,source]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const cancel=()=>{controller.current?.abort();setStatus('idle');setEditing(true);setPool([]);go(LAST);};

 const toggleSport=key=>setSports(old=>{const base=old.filter(item=>allowed.includes(item));const current=base.length?base:allowed;
  const next=current.includes(key)?current.filter(item=>item!==key):[...current,key];return next.length===allowed.length?[]:next.length?next:[key];});
 const toggleAnchor=key=>setAnchors(old=>{
  if(old.includes(key))return old.filter(item=>item!==key);
  const kept=old.filter(item=>players.some(player=>player.key===item));
  if(kept.length>=MOST_PLAYERS){setToast(`Up to ${MOST_PLAYERS} players`);return kept;}
  return [...kept,key];
 });
 const lockLeg=id=>setLocked(old=>old.includes(id)?old.filter(item=>item!==id):[...old,id]);
 const swapLeg=leg=>{
  if(!slip)return;
  const kept=slip.legs.filter(other=>other.id!==leg.id).map(other=>other.id);
  // Nothing else fits: the slip stays as it is.
  const next=buildLadder(pool,{play,size:slip.legs.length,mix,sameGame,perGame,locked:[...new Set([...locked,...kept])],excluded:[...excluded,leg.id],only:[slip.target]})[0];
  if(!next){setToast('No other pick fits this slip right now');return;}
  setSwap({target:slip.target,size:slip.legs.length,kept});
  setExcluded(old=>[...old,leg.id]);setSelected(slip.target);
 };
 const choose=value=>{setSwap(null);setSelected(value);setTarget(value);};
 const research=leg=>{
  window.dispatchEvent(new CustomEvent('vortex:open-prop',{detail:{sport:leg.row.sport,player:leg.row.player,stat:leg.row.raw?.stat||leg.row.market}}));
  window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:'finder'}}));
 };
 // A slip the member takes (adds, opens in PrizePicks or checks) goes on the
 // site's record by grade, the way a slip graded in the Slip Analyzer does.
 const recorded=useRef(new Set());
 const recordSlip=item=>{
  if(!item||recorded.current.has(slipKey(item)))return;
  recorded.current.add(slipKey(item));
  saveSlip({...slipPayload(newSlipId(),{app:{key:'prizepicks',name:'PrizePicks'}},item.legs.map(leg=>({row:leg.row,side:leg.side,line:leg.line,modifier:leg.modifier,grade:leg})),
   {type:item.play,letter:item.letter,chance:item.chance,multiplier:item.payout,value:item.value},'builder'),track:false}).catch(()=>{});
 };
 const addToSlip=()=>{
  if(!slip)return;
  if(builder.legs.length&&!confirm(`Replace the ${builder.legs.length} pick${builder.legs.length===1?'':'s'} in your slip?`))return;
  recordSlip(slip);
  pickBuilder.clear();
  slip.legs.forEach(leg=>pickBuilder.set(finderSlipProp(leg.row),leg.side==='UNDER'?'Under':'Over'));
  pickBuilder.open();
 };
 // PrizePicks opens in a new tab or its app, never in place of this page
 // (that took the whole app away on a phone). On a computer the tab opens
 // with the tap, while the browser still allows it, and is pointed at
 // PrizePicks once every pick is checked. On a phone the picks are checked
 // here first and the button becomes a plain Open in PrizePicks link.
 const link=exported.key&&exported.key===slipKey(slip)?exported.url:'';
 const openPrizePicks=async()=>{
  if(!slip||exporting)return;
  const key=slipKey(slip),phone=handheld();
  let tab=null;
  if(!phone){
   try{tab=window.open('','_blank');}catch{tab=null;}
   try{if(tab)tab.opener=null;}catch{/* already elsewhere */}
   try{tab?.document.write('<title>PrizePicks</title><p style="font:16px system-ui,sans-serif;padding:24px;color:#555">Checking your picks on PrizePicks…</p>');}catch{/* not ours to write */}
  }
  setExporting(true);setNotice('Checking every pick on PrizePicks…');
  try{
   const response=await fetch(EXPORT_URL,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({legs:slip.legs.map(exportLeg)})});
   const payload=await response.json().catch(()=>({}));
   if(!response.ok||!payload.url){
    const detail=(payload.unmatched||[]).map(leg=>`${leg.player} ${leg.line} ${leg.stat}`).join('; ');
    throw new Error(detail?`${payload.error||'Some picks are gone'}: ${detail}`:payload.error||'PrizePicks is unavailable right now.');
   }
   setExported({key,url:payload.url});
   recordSlip(slip);
   if(tab&&!tab.closed){tab.location.replace(payload.url);setNotice('Your slip opened in PrizePicks in a new tab.');}
   else setNotice(phone?'Every pick checked. Tap Open in PrizePicks.':'Your browser blocked the new tab. Tap Open in PrizePicks.');
  }catch(error){
   try{tab?.close();}catch{/* gone already */}
   setNotice(error.name==='TimeoutError'||error.name==='AbortError'?'PrizePicks took too long to answer. Try again.':error.message||'PrizePicks is unavailable right now.');
  }finally{setExporting(false);}
 };

 const totals=Object.values(progress).reduce((sum,item)=>({done:sum.done+(item.done||0),total:sum.total+(item.total||0)}),{done:0,total:0});
 const sizes=SIZES.filter(value=>play!=='flex'||value==='auto'||value>=3);
 const level=LEVELS[target]||LEVELS[2];
 const mixText=(MIX_OPTIONS.find(([key])=>key===mix)||MIX_OPTIONS[3])[1];
 const sizeText=size==='auto'?'Best size':`${size} picks`;
 const sportsText=chosen.length===allowed.length?'All sports':chosen.map(key=>SPORT_NAMES[key]).join(', ');
 const pickedGames=games.filter(game=>picked.includes(game.key));
 const whereText=[pickedGames.length?pickedGames.length===1?`${pickedGames[0].away.abbr} @ ${pickedGames[0].home.abbr}`:`${pickedGames.length} games`:'Every game',
  anchored.length?`around ${anchored.map(player=>shortName(player.name)).join(', ')}`:''].filter(Boolean).join(' · ');
 const summary=[`${target}x+`,sizeText,play==='flex'?'Flex':'Power',mixText,sportsText,whereText];
 const hasSaved=typeof saved.target==='number';
 // The start screen's slip: a few of today's players, soonest games first.
 const faces=useMemo(()=>{
  const seen=new Set(),out=[];
  for(let round=0;round<3&&out.length<3;round++)for(const game of slate.games){
   const player=game.players.filter(item=>item.headshot).concat(game.players.filter(item=>!item.headshot))[round];
   if(player&&!seen.has(player.name)&&out.length<3){seen.add(player.name);out.push({...player,game});}
  }
  return out;
 },[slate]);
 const buildButton=<button type="button" className="ss-build" onClick={build} disabled={view==='building'||!allowed.length}>
  <TicketIcon size={18}/><span>Build my slip</span></button>;

 let body=null;
 if(at===1)body=<div className="ss-payouts">{TARGETS.map((value,index)=>{const item=LEVELS[value];
  return <button type="button" key={value} aria-pressed={target===value} style={{'--tone':item.tone,'--i':index}}
   onClick={()=>{setSwap(null);setTarget(value);setSelected(null);chooseThenGo();}}>
   <span className="ss-payout-icon">{React.createElement(item.Icon,{size:17,'aria-hidden':true})}</span>
   <span className="ss-payout-text"><b>{value}x<small>+</small></b><span className="ss-payout-name">{item.name}</span></span>
   <small className="ss-payout-hint">{PAYOUT_HINT[value]}</small>
   <i className="ss-meter" aria-hidden="true">{TARGETS.map((_,n)=><em key={n} className={n<=index?'is-on':''}/>)}</i>
   <i className="ss-picked" aria-hidden="true"><Check size={10} strokeWidth={3.5}/></i>
  </button>;})}</div>;
 if(at===2)body=<>
  <div className="ss-q" style={{'--i':0}}><span className="ss-label">How many picks</span>
   <Segment label="Picks" value={size} onChange={setSize} options={sizes.map(value=>[value,value==='auto'?'Best':String(value)])}/></div>
  <div className="ss-q" style={{'--i':1}}><span className="ss-label">How it pays</span>
   <div className="ss-plays">{PLAYS.map(([value,text,Icon,hint])=><button type="button" key={value} aria-pressed={play===value}
    onClick={()=>{setPlay(value);if(value==='flex'&&size===2)setSize('auto');}}>
    <span className="ss-play-icon"><Icon size={17}/></span><b>{text}</b><small>{hint}</small>
    <i className="ss-picked" aria-hidden="true"><Check size={10} strokeWidth={3.5}/></i></button>)}</div></div>
  <div className="ss-q" style={{'--i':2}}><span className="ss-label">Which lines</span>
   <div className="ss-mixes">{MIX_OPTIONS.map(([value,text,tokens,hint])=><button type="button" key={value} aria-pressed={mix===value} onClick={()=>setMix(value)}>
    <span className="ss-tokens">{tokens.map((kind,n)=><Token key={n} kind={kind}/>)}</span>
    <span className="ss-mix-text"><b>{text}</b><small>{hint}</small></span>
    <i className="ss-picked" aria-hidden="true"><Check size={10} strokeWidth={3.5}/></i>
   </button>)}</div></div>
  <label className="ss-switch" style={{'--i':3}}><input type="checkbox" checked={sameGame} onChange={event=>setSameGame(event.target.checked)}/>
   <span><b>Same-game picks</b><small>Up to 2 picks from one game</small></span></label>
 </>;
 if(at===3)body=<>
  <button type="button" className="ss-all ss-all-sports" aria-pressed={chosen.length===allowed.length} onClick={()=>setSports([])}><Check size={14}/>All sports</button>
  <div className="ss-sports">{allowed.map((key,index)=>{const count=gameCount[key]||0;
   return <button type="button" key={key} aria-pressed={chosen.includes(key)} onClick={()=>toggleSport(key)}
    data-empty={!slate.loading&&!count?'true':undefined} style={{'--i':index}}>
    <Img src={LEAGUE_LOGOS[key]}/>
    <span><b>{SPORT_NAMES[key]}</b><small>{slate.loading&&!count?'…':count?`${count} game${count===1?'':'s'}`:'No games'}</small></span>
    <i className="ss-picked" aria-hidden="true"><Check size={10} strokeWidth={3.5}/></i></button>;})}</div>
 </>;
 if(at===4)body=<>
  <Segment label="Pick by" value={findBy} onChange={setFindBy} options={[['games',`Games${picked.length?` · ${picked.length}`:''}`,CalendarClock],['players',`Players${anchored.length?` · ${anchored.length}`:''}`,UserRound]]}/>
  {findBy==='games'
   ?<GamePicker games={games} picked={picked} onToggle={toggleGame} loading={slate.loading}/>
   :<PlayerPicker players={players} picked={anchors} onToggle={toggleAnchor} loading={slate.loading}/>}
 </>;
 if(at===LAST)body=<>
  <ul className="ss-review">
   <li style={{'--i':0}}><button type="button" onClick={()=>edit(1)}>
    <span className="ss-review-icon" style={{'--tone':level.tone}}>{React.createElement(level.Icon,{size:17})}</span>
    <span className="ss-review-text"><small>Payout</small><b>{target}x+ · {level.name}</b></span><Pencil size={15} className="ss-review-edit"/></button></li>
   <li style={{'--i':1}}><button type="button" onClick={()=>edit(2)}>
    <span className="ss-tokens">{(MIX_OPTIONS.find(([key])=>key===mix)||MIX_OPTIONS[3])[2].map((kind,n)=><Token key={n} kind={kind}/>)}</span>
    <span className="ss-review-text"><small>Slip</small><b>{sizeText} · {play==='flex'?'Flex':'Power'}</b><span>{mixText}{sameGame?' · same-game picks':''}</span></span><Pencil size={15} className="ss-review-edit"/></button></li>
   <li style={{'--i':2}}><button type="button" onClick={()=>edit(3)}>
    <span className="ss-review-logos">{chosen.slice(0,4).map(key=><Img key={key} src={LEAGUE_LOGOS[key]}/>)}</span>
    <span className="ss-review-text"><small>Sports</small><b>{sportsText}</b></span><Pencil size={15} className="ss-review-edit"/></button></li>
   <li style={{'--i':3}}><button type="button" onClick={()=>edit(4)}>
    {anchored.length?<Faces players={anchored} max={3}/>:<span className="ss-review-icon"><CalendarClock size={17}/></span>}
    <span className="ss-review-text"><small>{anchored.length?'Games and players':'Games'}</small><b>{whereText}</b></span><Pencil size={15} className="ss-review-edit"/></button></li>
  </ul>
  <p className="ss-review-note" style={{'--i':4}}><ShieldCheck size={15}/>Only Elite and Strong picks, overs only, graded the way the Slip Analyzer grades them.</p>
 </>;

 const nextText=fromReview?'Done':at===4&&!picked.length&&!anchored.length?'Use every game':'Next';
 const flow=FLOW[at-1];

 return <section className="smart-slip" aria-labelledby="smart-slip-title" ref={pageRef} data-view={view}>
  <header className="ss-head">
   <div className="ss-title"><span className="ss-mark" aria-hidden="true"><TicketIcon size={22}/></span>
    <div><h1 id="smart-slip-title">Parlay Builder</h1>
     <p>Pick a payout, your lines and your games. Every slip is built from Elite and Strong picks, overs only.</p></div></div>
   <span className="ss-head-pp"><img src={PRIZEPICKS_LOGO} alt=""/>PrizePicks ready</span>
  </header>

  {view==='setup'&&<div className="ss-wiz" data-at={at}>
   {at===0?<div className="ss-intro">
    <div className="ss-intro-art" aria-hidden="true">
     <div className="ss-mini">
      <header><img src={PRIZEPICKS_LOGO} alt=""/><b>Your slip</b><span>Graded A+ to F</span></header>
      <ol>{[0,1,2].map(n=>{const player=faces[n];
       return <li key={n} style={{'--i':n}}>{player?<><span className="ss-face-mini"><i>{player.name.split(' ').map(part=>part[0]).join('').slice(0,2)}</i><img src={player.headshot} alt="" onLoad={photoIn} onError={event=>{event.currentTarget.hidden=true;}}/></span>
        <span className="ss-mini-who"><b>{player.name}</b><small>{player.team} · {SPORT_NAMES[player.game.sport]}</small></span><em>More</em></>
        :<><i className="ss-slot-face"/><span className="ss-slot-text"><i/><i/></span></>}</li>;})}</ol>
      <footer><span>3-pick Power</span><b>Pays 6x</b></footer>
     </div>
    </div>
    <div className="ss-intro-text">
     <h2>Build your parlay</h2>
     <p>Four quick questions and your slip is ready for PrizePicks. Only Elite and Strong picks, overs only.</p>
    </div>
    <div className="ss-intro-sports">{allowed.map(key=><span key={key}><Img src={LEAGUE_LOGOS[key]}/><b>{SPORT_NAMES[key]}</b>
     <small>{slate.loading&&!gameCount[key]?'…':gameCount[key]?`${gameCount[key]} game${gameCount[key]===1?'':'s'}`:'Off today'}</small></span>)}</div>
    <div className="ss-intro-go">
     <button type="button" className="ss-next" onClick={()=>go(1)}>Let’s go<ChevronRight size={18}/></button>
     {hasSaved&&<button type="button" className="ss-quick" onClick={build}><Zap size={16}/><span><b>Quick build</b><small>{summary.slice(0,3).join(' · ')}</small></span></button>}
    </div>
   </div>
   :<>
    <Progress at={at} onGo={go}/>
    <div className="ss-wiz-body" key={at} data-dir={dir}>
     {status==='ready'&&builtFor===source&&<button type="button" className="ss-to-result" onClick={()=>setEditing(false)}><ArrowLeft size={14}/>Back to your slip</button>}
     <header className="ss-q-head"><h2>{flow[2]}</h2><p>{flow[3]}</p></header>
     {body}
    </div>
    <footer className="ss-wiz-foot">
     <button type="button" className="ss-back" onClick={()=>go(at-1)}><ChevronLeft size={18}/>Back</button>
     {at<LAST?<button type="button" className="ss-next" onClick={onward}>{nextText}<ChevronRight size={18}/></button>:buildButton}
    </footer>
   </>}
  </div>}

  {view==='building'&&<div className="ss-wiz is-building">
   <header className="ss-building-head"><span><RefreshCw size={15} className="ss-spin"/>{STEPS[step][0]}…</span>
    <button type="button" onClick={cancel}><X size={15}/>Cancel</button></header>
   <BuildStage step={step} share={totals.total?totals.done/totals.total:1} sports={picked.length?[...new Set(pickedGames.map(game=>game.sport))]:chosen} scan={scan}
    legs={step>=3?slip?.legs:null} checked={totals.total?totals.done:lineCount} total={totals.total||lineCount}/>
  </div>}

  {view==='result'&&<>
   <div className="ss-result-bar">
    <button type="button" className="ss-edit" onClick={()=>{setEditing(true);go(LAST);}}><ChevronLeft size={16}/>Edit</button>
    <p className="ss-summary" aria-label="Your choices">{summary.map(item=><span key={item}>{item}</span>)}</p>
    <button type="button" className="ss-again" onClick={build} aria-label="Build again"><RefreshCw size={16}/></button>
    {/* Finished with this slip: straight back to the Builder's start, not back through every question. */}
    <button type="button" className="ss-done" onClick={()=>{setEditing(true);setSwap(null);go(0);}}><Check size={15} strokeWidth={3}/>Done</button>
   </div>
   {notice&&<p className="ss-notice" role="status">{notice}</p>}
   {status==='ready'&&!ladder.length&&<div className="ss-empty"><b>No slip clears the bar right now</b>
    <span>{anchored.length?'Try another payout, or build around another player.':picked.length?'Add another game, try another line mix, or a different payout.':'Try more sports, another line mix, or a different payout.'}</span>
    <button type="button" onClick={()=>{setEditing(true);go(LAST);}}>Change my choices</button></div>}
   {status==='error'&&<div className="ss-empty"><b>Lines couldn’t load</b><button type="button" onClick={build}>Try again</button></div>}
   {status==='ready'&&ladder.length>0&&<>
    <div className="ss-ladder" role="listbox" aria-label="Payout options">{ladder.map((item,index)=>{
     const active=item===slip;
     const odds=item.play==='flex'?item.profit:item.chance;
     return <button type="button" role="option" aria-selected={active} key={item.target} className={active?'is-active':''}
      style={{'--tone':(LEVELS[item.target]||LEVELS[2]).tone,'--i':index}} onClick={()=>choose(item.target)}>
      {item===recommended&&<em><ShieldCheck size={11} strokeWidth={2.6}/>Recommended</em>}
      <b>{React.createElement((LEVELS[item.target]||LEVELS[2]).Icon,{size:15,className:'ss-level-icon','aria-hidden':true})}{times(item.payout,item.estimated)}
       {item.letter&&<i className="ss-chip-grade" data-tone={gradeTone(item.letter)}>{item.letter}</i>}</b>
      <span>{percent(odds)} {item.play==='flex'?'to profit':'to hit'}</span>
      <i className="ss-odds" aria-hidden="true"><i style={{width:percent(odds)}}/></i>
      <Faces players={item.legs.map(leg=>({name:leg.row.player,headshot:leg.row.headshot}))} max={6}/>
      <small>{item.legs.length}-pick {item.play==='flex'?'Flex':'Power'}
       {item.legs.filter(leg=>MODIFIER_ICON[leg.modifier]).map(leg=><img key={leg.id} src={MODIFIER_ICON[leg.modifier]} alt={leg.modifier} width="13" height="13"/>)}</small>
     </button>;})}</div>

    {slip&&<Ticket key={slip.target} slip={slip} locked={locked} onLock={lockLeg} onSwap={swapLeg} onResearch={research}
     onAdd={addToSlip} onExport={openPrizePicks} exporting={exporting} link={link}
     onCheck={()=>{recordSlip(slip);handOff(builderSlip(slip));window.dispatchEvent(new CustomEvent('vortex:switch-tab',{detail:{tab:'slip'}}));}}/>}
    <p className="ss-meta">{pool.length} picks qualified · lines as of {new Date(builtAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</p>
   </>}
  </>}
  {toast&&<p className="ss-toast" role="status" key={toast}>{toast}</p>}
 </section>;
}
