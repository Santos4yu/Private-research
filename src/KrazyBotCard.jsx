import React,{useState} from 'react';
import {ArrowDown,ArrowUp,ChartColumn,Check,Swords,TrendingDown,TrendingUp,TriangleAlert} from 'lucide-react';

// The data under a Krazy Bot answer (krazy-bot.js pickCard), drawn inside the
// answer card itself. Every section rises in once the card has opened (the
// `kb-rise` rules in krazy-bot.css key off the component's data-phase).

const pct=value=>Math.round(value*100);
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);
const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
const delay=seconds=>({'--kb-d':`${seconds}s`});

function Logo({src,alt=''}){
 const [failed,setFailed]=useState(false);
 if(!src||failed)return null;
 return <img className="kb-logo" src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>;
}

// The player's photo (initials when there is none), with his team's logo pinned to it.
function Face({src,name,logo,size='lg'}){
 const [failed,setFailed]=useState(false);
 const [noLogo,setNoLogo]=useState(false);
 return <span className="kb-face" data-size={size}>
  {src&&!failed?<img src={src} alt="" loading="lazy" onError={()=>setFailed(true)}/>:<b>{initials(name)}</b>}
  {logo&&!noLogo&&<span className="kb-face-team"><img className="kb-logo" src={logo} alt="" loading="lazy" onError={()=>setNoLogo(true)}/></span>}
 </span>;
}

// A number that counts up as the card opens (CSS --kb-n), read out whole.
const Count=({value,suffix='%'})=><><span className="kb-count" style={{'--to':value}} data-suffix={suffix} aria-hidden="true"/><span className="kb-sr">{value}{suffix}</span></>;

function Game({pick}){
 if(!pick.team&&!pick.opponent)return pick.time?<span className="kb-game">{pick.time}</span>:null;
 return <span className="kb-game">
  {pick.team&&<><Logo src={pick.teamLogo}/>{pick.team}</>}
  {pick.opponent&&<><i>{pick.home===false?'@':'vs'}</i><Logo src={pick.opponentLogo}/>{pick.opponent}</>}
  {pick.time&&<><i>·</i>{pick.time}</>}
 </span>;
}

const Side=({pick})=><span className="kb-side" data-side={pick.side}>{pick.side==='UNDER'?<ArrowDown aria-hidden="true"/>:<ArrowUp aria-hidden="true"/>}{pick.side==='UNDER'?'Under':'Over'}</span>;

function Bars({pick,compact=false}){
 const {last,line}=pick;
 // Big lines (points, strikeouts) chart from a floor, so the game-to-game swings show.
 const values=last.map(game=>game.value);
 const top=Math.max(...values,line*1.4,1)*1.12;
 const base=line>=5?Math.floor(Math.min(...values,line)*.6):0;
 const height=value=>(value-base)/(top-base)*100;
 const decided=last.filter(game=>game.hit!==null);
 const hits=decided.filter(game=>game.hit).length;
 return <div className="kb-trend" data-compact={compact?'':undefined}>
  {!compact&&<header><span><ChartColumn aria-hidden="true"/>Last {last.length}</span><strong data-good={hits/(decided.length||1)>=.5?'':undefined}>{hits}/{decided.length} {pick.side==='UNDER'?'under':'over'}</strong></header>}
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
  {matchup.face?<Face src={matchup.photo} name={matchup.name} size="sm"/>:<span className="kb-matchup-logo">{matchup.photo?<Logo src={matchup.photo}/>:<Swords aria-hidden="true"/>}</span>}
  <p><span>{who?`${who}'s matchup`:'Matchup'}{matchup.hand?` · ${matchup.hand}HP`:''}</span>{matchup.text}</p>
  {matchup.tone&&<em data-tone={matchup.tone}>{matchup.tone==='up'?<TrendingUp aria-hidden="true"/>:<TrendingDown aria-hidden="true"/>}{short||(matchup.tone==='up'?'Edge':'Tough')}</em>}
 </div>;
}

function PickCard({pick,verdict,reasons}){
 const chance=pct(pick.chance);
 return <div className="kb-card" data-kind="pick">
  <div className="kb-head kb-rise" style={delay(.04)}>
   <Face src={pick.headshot} name={pick.player} logo={pick.teamLogo}/>
   <div className="kb-who"><strong>{pick.player}</strong><Game pick={pick}/></div>
   {verdict?<span className="kb-verdict" data-tone={verdict.tone}>{verdict.label}</span>
    :pick.grade&&<span className="kb-grade" data-grade={pick.grade} aria-label={`Grade ${pick.grade}`}>{pick.grade}</span>}
  </div>
  <div className="kb-line kb-rise" style={delay(.12)}>
   <Side pick={pick}/>
   <span className="kb-line-text"><strong>{figure(pick.line)}</strong> {pick.stat}{pick.modifier!=='standard'&&<span className="kb-mod" data-mod={pick.modifier}>{pick.modifier}</span>}</span>
   <span className="kb-chance"><Count value={chance}/><small>to hit</small></span>
  </div>
  <div className="kb-meter kb-rise" style={delay(.16)} aria-hidden="true"><i style={{'--v':pick.chance}}/></div>
  {pick.last.length>=3&&<div className="kb-rise" style={delay(.24)}><Bars pick={pick}/></div>}
  {pick.tiles.length>0&&<div className="kb-tiles kb-rise" style={delay(.36)}>
   {pick.tiles.map(tile=><div key={tile.key} className="kb-tile" data-tone={tile.tone||undefined}><b>{tile.value}</b><span>{tile.label}</span></div>)}
  </div>}
  {pick.matchup&&<div className="kb-rise" style={delay(.46)}><Matchup matchup={pick.matchup}/></div>}
  {reasons?.length>0&&<ul className="kb-why kb-rise" style={delay(.54)}>{reasons.map(text=><li key={text}><Check aria-hidden="true"/>{text}</li>)}</ul>}
  {pick.risks.length>0&&<p className="kb-risk kb-rise" style={delay(.6)}><TriangleAlert aria-hidden="true"/>{pick.risks.join(' · ')}</p>}
 </div>;
}

function ComparePick({pick,best,index}){
 return <div className="kb-versus-side kb-rise" data-best={best?'':undefined} style={delay(.06+index*.1)}>
  {best&&<span className="kb-ribbon">My pick</span>}
  <Face src={pick.headshot} name={pick.player} logo={pick.teamLogo}/>
  <strong>{pick.player}</strong>
  <span className="kb-versus-line"><Side pick={pick}/><span>{figure(pick.line)} {pick.short}</span></span>
  <span className="kb-chance"><Count value={pct(pick.chance)}/><small>{pick.grade?`grade ${pick.grade}`:'to hit'}</small></span>
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
   {pick.grade&&<span className="kb-grade" data-grade={pick.grade} data-size="sm">{pick.grade}</span>}
   <span className="kb-row-pct"><Count value={pct(pick.chance)}/></span>
  </span>
  <span className="kb-row-meter" aria-hidden="true"><i style={{'--v':pick.chance}}/></span>
 </li>;
}

export function BotCard({card}){
 if(!card)return null;
 if(card.kind==='pick')return <PickCard pick={card.pick} verdict={card.verdict} reasons={card.reasons}/>;
 if(card.kind==='compare')return <div className="kb-card" data-kind="compare">
  <div className="kb-versus">{card.picks.map((pick,index)=><ComparePick key={pick.player} pick={pick} best={index===0} index={index}/>)}</div>
  {card.picks[0].matchup&&<div className="kb-rise" style={delay(.32)}><Matchup matchup={card.picks[0].matchup} who={card.picks[0].player.split(' ').at(-1)}/></div>}
 </div>;
 if(card.kind==='list')return <div className="kb-card" data-kind="list"><ol className="kb-rows">{card.picks.map((pick,index)=><Row key={pick.player} pick={pick} rank={index+1} index={index}/>)}</ol></div>;
 if(card.kind==='rundown')return <div className="kb-card" data-kind="rundown"><ol className="kb-rows">{card.rows.map((item,index)=><Row key={item.tag} pick={item.pick} tag={item.tag} index={index}/>)}</ol></div>;
 if(card.kind==='slip'){
  const together=pct(card.together);
  return <div className="kb-card" data-kind="slip">
   <ol className="kb-rows">{card.picks.map((pick,index)=><Row key={pick.player} pick={pick} rank={index+1} index={index}/>)}</ol>
   <div className="kb-slip-foot kb-rise" style={delay(.1+card.picks.length*.09)}>
    <span><small>All {card.picks.length} hit</small><strong><Count value={together}/></strong></span>
    {card.payout&&<span><small>Power Play</small><strong>{card.payout}x</strong></span>}
   </div>
  </div>;
 }
 return null;
}
