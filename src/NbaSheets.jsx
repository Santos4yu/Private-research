import React,{useEffect,useMemo,useState} from 'react';
import {Clock,Flame,Gauge,RefreshCw,Search,UserMinus,Zap} from 'lucide-react';
import {finite,nameKey,num,fixed,time,initials,Img,Score,Tag,Table,Faq,Skeleton} from './cheat-sheet-parts';
import {loadLines} from './finder-pool';
import './nba-sheets.css';
import {useIsAdmin} from './admin-notice.js';

// NBA Cheat Sheets: the next slate read for pace and for who's out
// (nba_sheets.py). Each sheet is one request, kept here for a few minutes,
// and has its own admin switch; CheatSheets.jsx only offers the ones on.

const SHEET_TINT='#E8E8E8';
export const NBA_SHEETS=[
 {key:'pace',tint:SHEET_TINT,title:'Pace-up Games',kicker:'Possessions',icon:Gauge,blurb:'Two fast teams mean more trips, so more shots for everyone.',
  about:"Each team's pace is the possessions its games average this season: shots, less the offensive rebounds that keep a trip alive, plus turnovers and free-throw trips. A game projects to the two teams' paces met halfway, set against the league's average; a pace-up game is two teams that both play faster than average. Projected points are each offense's points per 100 possessions against the other defense's, at that pace. A player's extra is his last 10 games scaled by tonight's pace against his own team's usual pace. At the start of a season last season's games count too."},
 {key:'out',tint:SHEET_TINT,title:'Teammate Out',kicker:'Injury report',icon:UserMinus,blurb:'Who gains when a rotation player is ruled out.',
  about:"Every player on ESPN's injury report as out or doubtful who plays real minutes for his team (18 a game, at least three games). For each teammate: his numbers in the games that player missed against the games they played together, since the player joined the team, with usage (his share of the team's shots, free-throw trips and turnovers while he's on the floor). Two or three games without him is a small sample, so the score leans on it less until there are more."},
];
const FAQ={
 pace:[['Why does pace matter for props?','More possessions mean more shots, rebounds and assists to go around. A game a few possessions faster than a team usually plays gives everyone in it a few percent more chances.'],
  ['What makes it a pace-up game?','Both teams play faster than the league average. Those games tend to stay fast; a fast team against a slow one meets somewhere in the middle.']],
 out:[['Why does "First game out" matter?','The first night a player sits, lines are often still set off the usual roles. Once he has missed a few games the books have usually caught up.'],
  ['What if there are no games without him?','Then there is nothing to measure yet. The sheet lists the bench players at his position who would take his minutes.']],
};

const teamLogo=team=>team?`https://a.espncdn.com/i/teamlogos/nba/500/${String(team).toLowerCase()}.png`:null;
const kick=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?`${date.toLocaleDateString([],{weekday:'short'})} ${time(value)}`:'';};
const last=name=>String(name||'').split(' ').filter(Boolean).at(-1)||'';
const plus=(value,digits=1)=>finite(value)?`${value>0?'+':value<0?'−':''}${Math.abs(value).toFixed(digits)}`:'—';
const tone=value=>!finite(value)||Math.abs(value)<0.05?undefined:value>0?'good':'bad';

// ---------------------------------------------------------------- data

const store=new Map();
export async function fetchSheet(sheet,force=false){
 const kept=store.get(sheet);
 if(!force&&kept&&Date.now()-kept.at<4*60000)return kept.data;
 const response=await fetch(`/api/board?view=nba-sheet&sheet=${sheet}`,{credentials:'same-origin',cache:'no-store'});
 const body=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(body.error||'This sheet is unavailable right now.');
 store.set(sheet,{at:Date.now(),data:body});
 return body;
}
// Each player's PrizePicks points line, from the lines the Finder loads.
let linesPending=null;
function usePoints(){
 const [points,setPoints]=useState(null);
 useEffect(()=>{
  let live=true;
  linesPending||=loadLines('nba',{only:()=>false}).then(rows=>{
   const found=new Map();
   for(const row of rows||[])if(row.marketKey==='player_points'&&String(row.modifier||'standard').toLowerCase()==='standard')found.set(nameKey(row.player),row.line);
   return found;
  }).catch(()=>new Map());
  linesPending.then(found=>{if(live)setPoints(found);});
  return()=>{live=false;};
 },[]);
 return points;
}

// ---------------------------------------------------------------- pieces

function Face({who,size}){
 const [failed,setFailed]=useState(false);
 return <span className="cs-face" data-size={size||undefined}>
  {who?.headshot&&!failed?<img src={who.headshot} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<b>{initials(who?.name)}</b>}
  {who?.team&&<span className="cs-face-team"><Img src={teamLogo(who.team)}/></span>}
 </span>;
}
function Who({who,meta,tag}){
 return <span className="cs-who">
  <Face who={who}/>
  <span className="cs-who-main">
   <span className="cs-who-name"><strong>{who?.name||'—'}</strong>{tag}</span>
   <span className="cs-who-meta">{meta}</span>
  </span>
 </span>;
}
function Matchup({game}){
 return <span className="cs-who nba-matchup">
  <span className="nba-logos"><Img src={teamLogo(game.away)}/><Img src={teamLogo(game.home)}/></span>
  <span className="cs-who-main">
   <span className="cs-who-name"><strong>{game.away} @ {game.home}</strong>{game.paceUp&&<Tag tone="hot" icon={Zap}>Pace-up</Tag>}</span>
   <span className="cs-who-meta">{kick(game.startsAt)}</span>
  </span>
 </span>;
}
function Seg({value,options,onChange,label}){
 return <div className="cs-seg" role="tablist" aria-label={label}>{options.map(([key,text])=><button key={key} type="button" role="tab" aria-selected={value===key} data-active={value===key?'':undefined} onClick={()=>onChange(key)}>{text}</button>)}</div>;
}
const Two=({value,sub,tone:kind})=><span className="nfl-two"><b data-tone={kind}>{value}</b>{sub&&<small>{sub}</small>}</span>;

// ---------------------------------------------------------------- pace

function PaceSide({side}){
 const points=usePoints();
 return <div className="nba-side">
  <header><Img className="nba-side-logo" src={teamLogo(side.team)}/><b>{side.team}</b>
   <span>{fixed(side.pace,1)} pace<small>#{side.rank}</small></span>
   {finite(side.recent)&&<span>{fixed(side.recent,1)} last 10</span>}
   {side.backToBack&&<Tag tone="limited" icon={Clock}>Back-to-back</Tag>}
  </header>
  {side.players?.length>0&&<ul>{side.players.map(item=>{const line=points?.get(nameKey(item.who.name));
   return <li key={item.who.id}><Face who={item.who} size="sm"/><span className="nba-side-who"><b>{item.who.name}</b><small>{fixed(item.avg.min,0)} min · {fixed(item.avg.pts,1)} pts{finite(line)?<> · line {num(line,1)}</>:null}</small></span>
    <span className="nba-side-gain" data-tone={tone(item.extraPts)}><b>{plus(item.extraPts)}</b><small>pts</small></span>
    <span className="nba-side-gain" data-tone={tone(item.extraFga)}><b>{plus(item.extraFga)}</b><small>shots</small></span></li>;})}</ul>}
 </div>;
}
function PaceSheet({data,filter}){
 const [view,setView]=useState('games');
 const points=usePoints();
 // A game shows while no one is searched for, or when a player searched for is in it.
 const games=useMemo(()=>(data.rows||[]).filter(game=>filter({gameId:game.gameId,who:{name:''}})
  ||game.sides.some(side=>side.players.some(item=>filter({gameId:game.gameId,who:item.who})))),[data,filter]);
 const players=useMemo(()=>(data.players||[]).filter(filter),[data,filter]);
 return <>
  <div className="nfl-controls"><Seg value={view} onChange={setView} label="Show" options={[['games','Games'],['players','Players']]}/></div>
  {view==='games'?<Table rows={games} rowKey={row=>row.gameId} empty="No games on the slate right now." moreLabel="Who gets the extra trips" expand={row=><div className="nba-sides">{row.sides.map(side=><PaceSide key={side.team} side={side}/>)}</div>} columns={[
   {key:'game',label:'Game',className:'cs-sticky',render:row=><Matchup game={row}/>},
   {key:'pace',label:'Pace',value:row=>row.projected,render:row=><Two value={fixed(row.projected,1)} sub={`league ${fixed(row.league,1)}`}/>},
   {key:'versus',label:'vs avg',value:row=>row.versus,render:row=><Two value={`${plus((row.versus||0)*100)}%`} tone={tone(row.versus)} sub={row.tier==='fast'?'Fast':row.tier==='slow'?'Slow':'Average'}/>},
   {key:'total',label:'Points',value:row=>row.total,render:row=><Two value={fixed(row.total,0)} sub="projected"/>},
   {key:'teams',label:'Pace ranks',short:'Ranks',render:row=><Two value={row.sides.map(side=>`#${side.rank}`).join(' · ')} sub={row.sides.map(side=>side.team).join(' · ')}/>},
   {key:'score',label:'Pace score',value:row=>row.score,render:row=><Score value={row.score} label="Pace score"/>},
  ]}/>
  :<Table rows={players} rowKey={row=>`${row.gameId}:${row.who.id}`} initial={{key:'extra',dir:-1}} empty="No players to show yet." columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} meta={<>{row.who.position}<i>·</i>{row.who.team} vs {row.opponent}</>} tag={row.paceUp&&<Tag tone="hot" icon={Zap}>Pace-up</Tag>}/>},
   {key:'pick',label:'Points',render:row=>{const line=points?.get(nameKey(row.who.name));return <Two value={finite(line)?num(line,1):'—'} sub={`avg ${fixed(row.avg.pts,1)}`}/>;}},
   {key:'pace',label:'Pace',value:row=>row.pace,render:row=><Two value={fixed(row.pace,1)} sub={`${plus((row.lift||0)*100)}% for him`}/>},
   {key:'shots',label:'+Shots',value:row=>row.extraFga,render:row=><Two value={plus(row.extraFga)} tone={tone(row.extraFga)} sub={`of ${fixed(row.avg.fga,1)}`}/>},
   {key:'extra',label:'+Points',value:row=>row.extraPts,render:row=><Two value={plus(row.extraPts)} tone={tone(row.extraPts)} sub={`${plus(row.extraReb)} reb · ${plus(row.extraAst)} ast`}/>},
  ]}/>}
 </>;
}

// ---------------------------------------------------------------- teammate out

const SPLITS=[['min','MIN'],['pts','PTS'],['reb','REB'],['ast','AST'],['fga','FGA'],['usg','USG%']];
function Gains({card}){
 if(!card.gainers.length){
  if(card.sample<2)return <div className="nba-none"><p>{card.sample?`Only one game without ${last(card.who.name)} so far: too few to read.`:`No games without ${last(card.who.name)} on record yet.`}</p>
   {card.nextUp?.length>0&&<p className="nba-next"><span>Next up at his spot</span>{card.nextUp.map(item=><i key={item.id}>{item.name}<b>{fixed(item.min,0)} min</b></i>)}</p>}</div>;
  return <div className="nba-none"><p>No teammate has gained in the {card.sample} games {last(card.who.name)} missed.</p></div>;
 }
 return <div className="nba-gains-wrap"><table className="nba-gains">
  <thead><tr><th>Without {last(card.who.name)}</th><th>Games</th>{SPLITS.map(([key,label])=><th key={key}>{label}</th>)}</tr></thead>
  <tbody>{card.gainers.map(gain=><tr key={gain.who.id}>
   <td><span className="nba-gain-who"><Face who={gain.who} size="sm"/><b>{gain.who.name}</b></span></td>
   <td className="nba-games">{gain.games}</td>
   {SPLITS.map(([key])=><td key={key}><b>{fixed(gain.without?.[key],1)}</b><small data-tone={tone(gain.diff?.[key])}>{plus(gain.diff?.[key])}</small></td>)}
  </tr>)}</tbody>
 </table></div>;
}
function OutCard({card}){
 const role=card.role||{};
 return <article className="nba-out">
  <header>
   <Face who={card.who}/>
   <div className="nba-out-who"><strong>{card.who.name}</strong>
    <small>{card.team} vs {card.opponent}<i>·</i>{kick(card.startsAt)}</small></div>
   <span className="nba-out-tags"><span className="nba-status" data-status={String(card.who.status).toLowerCase().includes('doubt')?'doubtful':'out'}>{card.who.status}</span>
    {card.fresh?<Tag tone="hot" icon={Flame}>First game out</Tag>:<Tag tone="limited">Out {role.missed} straight</Tag>}</span>
  </header>
  <p className="nba-role">{role.starter?'Starter':'Bench'}<i>·</i><b>{fixed(role.min,1)}</b> min<i>·</i><b>{fixed(role.pts,1)}</b> pts<i>·</i><b>{fixed(role.reb,1)}</b> reb<i>·</i><b>{fixed(role.ast,1)}</b> ast{finite(role.usg)&&<><i>·</i><b>{fixed(role.usg,1)}%</b> usage</>}</p>
  <Gains card={card}/>
 </article>;
}
function OutSheet({data,filter}){
 const [view,setView]=useState('players');
 const cards=useMemo(()=>(data.outs||[]).filter(card=>filter({gameId:card.gameId,who:card.who})),[data,filter]);
 const rows=useMemo(()=>(data.rows||[]).filter(filter),[data,filter]);
 return <>
  <div className="nfl-controls"><Seg value={view} onChange={setView} label="Show" options={[['players','Players out'],['gains','Who gains']]}/></div>
  {view==='players'?(cards.length?<div className="nba-outs">{cards.map(card=><OutCard key={card.id} card={card}/>)}</div>
   :<p className="cs-empty">No rotation players are ruled out for these games right now.</p>)
  :<Table rows={rows} empty="No one has gained yet with tonight's absences." moreLabel="With and without" expand={row=><p className="nfl-why">With {row.out.name} on the floor {row.who.name} has averaged <b>{fixed(row.with?.pts,1)}</b> points in {fixed(row.with?.min,1)} minutes; in the {row.games} games {last(row.out.name)} missed, <b>{fixed(row.without?.pts,1)}</b> points in {fixed(row.without?.min,1)} minutes{finite(row.without?.usg)&&finite(row.with?.usg)?<>, usage {fixed(row.with.usg,1)}% to <b>{fixed(row.without.usg,1)}%</b></>:null}.</p>} columns={[
   {key:'player',label:'Player',className:'cs-sticky',render:row=><Who who={row.who} meta={<>{row.who.position}<i>·</i>{row.team} vs {row.opponent}</>} tag={row.fresh&&<Tag tone="hot" icon={Flame}>New</Tag>}/>},
   {key:'pick',label:'Without',render:row=><Two value={row.out.name} sub={`${row.out.status} · ${row.games} games`}/>},
   {key:'min',label:'+MIN',value:row=>row.diff?.min,render:row=><Two value={plus(row.diff?.min)} tone={tone(row.diff?.min)} sub={`${fixed(row.without?.min,1)} min`}/>},
   {key:'pts',label:'+PTS',value:row=>row.diff?.pts,render:row=><Two value={plus(row.diff?.pts)} tone={tone(row.diff?.pts)} sub={`${fixed(row.without?.pts,1)} pts`}/>},
   {key:'reb',label:'+REB',value:row=>row.diff?.reb,render:row=><Two value={plus(row.diff?.reb)} tone={tone(row.diff?.reb)} sub={`${fixed(row.without?.reb,1)} reb`}/>},
   {key:'ast',label:'+AST',value:row=>row.diff?.ast,render:row=><Two value={plus(row.diff?.ast)} tone={tone(row.diff?.ast)} sub={`${fixed(row.without?.ast,1)} ast`}/>},
   {key:'score',label:'Gain score',value:row=>row.score,render:row=><Score value={row.score} label="Gain score"/>},
  ]}/>}
 </>;
}

// ---------------------------------------------------------------- the view

export function NbaSheetView({sheetKey,sheets,onOpen}){
 const admin=useIsAdmin();
 const sheet=sheets.find(item=>item.key===sheetKey)||sheets[0];
 const [state,setState]=useState({loading:true,data:null,error:null});
 const [game,setGame]=useState('all');
 const [query,setQuery]=useState('');
 const load=(force=false)=>{
  setState(current=>({...current,loading:true,error:null}));
  fetchSheet(sheet.key,force).then(data=>setState({loading:false,data,error:null})).catch(error=>setState({loading:false,data:null,error:error.message}));
 };
 useEffect(()=>{setGame('all');setQuery('');load();},[sheet.key]);
 const data=state.data?.sheet===sheet.key?state.data:null;
 const filter=useMemo(()=>{const wanted=nameKey(query);return row=>(game==='all'||row.gameId===game)&&(!wanted||nameKey(row.who?.name).includes(wanted));},[game,query]);
 const games=data?.games||[];
 const Icon=sheet.icon;
 return <div className="cs-view" style={{'--sheet':sheet.tint}}>
  <nav className="cs-tabs" aria-label="Sheets">{sheets.map(item=>{const ItemIcon=item.icon;return <button key={item.key} type="button" style={{'--tab':item.tint}} aria-current={item.key===sheet.key?'page':undefined} data-active={item.key===sheet.key?'':undefined} onClick={()=>onOpen(item.key)}>
   <ItemIcon aria-hidden="true"/>{item.title}
  </button>;})}</nav>
  <section className="cs-sheet">
   <header className="cs-sheet-head">
    <div className="cs-sheet-title"><span className="cs-sheet-kicker"><span className="cs-icon"><Icon aria-hidden="true"/></span>{sheet.kicker}</span><h2>{sheet.title}</h2><p>{sheet.blurb}</p>
     <small>{data?<>{games.length} game{games.length===1?'':'s'}<i>·</i>updated {time(data.updatedAt)}</>:'Loading…'}</small></div>
    <div className="cs-sheet-actions">
     <button type="button" className="cs-icon-btn" onClick={()=>load(true)} aria-label="Refresh" disabled={state.loading}><RefreshCw data-spin={state.loading?'':undefined} aria-hidden="true"/></button>
    </div>
   </header>
   {data&&games.length>0&&<div className="cs-filters">
    <div className="cs-chips-row cs-scroll" role="tablist" aria-label="Game"><button type="button" data-active={game==='all'?'':undefined} onClick={()=>setGame('all')}>All games</button>
     {games.map(item=><button key={item.gameId} type="button" data-active={game===item.gameId?'':undefined} onClick={()=>setGame(item.gameId)}><Img className="cs-logo" src={teamLogo(item.away)}/>{item.away}<i>@</i><Img className="cs-logo" src={teamLogo(item.home)}/>{item.home}</button>)}</div>
    <label className="cs-search"><Search aria-hidden="true"/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Find a player" aria-label="Find a player"/></label>
   </div>}
   <div className="cs-body" data-loading={state.loading?'':undefined}>
    {state.error?<div className="cs-error"><p>{admin?state.error:'This sheet is still being put together. Check back in a minute.'}</p><button type="button" onClick={()=>load(true)}>{admin?'Try again':'Refresh'}</button></div>
     :!data?<Skeleton/>
     :sheet.key==='pace'?<PaceSheet data={data} filter={filter}/>
     :<OutSheet data={data} filter={filter}/>}
   </div>
   <Faq items={[['What\'s on this sheet?',sheet.about],...(FAQ[sheet.key]||[])]}/>
  </section>
 </div>;
}
