import React,{useState} from 'react';
import {Activity,ArrowDown,ArrowUp,ChartColumn,Check,Flame,History,Snowflake,Swords,Target,Timer,TrendingDown,TrendingUp,TriangleAlert} from 'lucide-react';

// The data under a Krazy Bot answer (krazy-bot.js pickCard), drawn inside the
// answer card itself. Every section rises in once the card has opened (the
// `kb-rise` rules in krazy-bot.css key off the component's data-phase).

const pct=value=>Math.round(value*100);
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
function Face({src,name,logo,size='lg'}){
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
function Rating({rating}){
 return <div className="kb-rating" data-tone={rating.tone}>
  <div className="kb-rating-head">
   <span className="kb-rating-ring" style={{'--v':rating.score/100}} aria-hidden="true"><b><Roll text={String(rating.score)}/></b></span>
   <span className="kb-rating-title"><strong>{rating.label} matchup{rating.versus?` vs ${rating.versus}`:''}</strong><small>{rating.tone==='good'?'Supports the pick':rating.tone==='tough'?'Works against the pick':'Neither helps nor hurts'}</small></span>
  </div>
  {rating.factors?.length>0&&<ul className="kb-rating-factors">{rating.factors.map((factor,index)=><li key={factor.name} style={{'--i':index}} data-tone={factor.impact>0?'up':factor.impact<0?'down':undefined}>
   <span><strong>{factor.name}</strong><small>{factor.detail}</small></span>
   <b>{factor.impact>0?'+':factor.impact<0?'−':''}{Math.abs(Math.round(factor.impact))}</b>
  </li>)}</ul>}
  {rating.pitches?.length>0&&<div className="kb-rating-pitches">{rating.pitches.map(pitch=><span key={pitch.name}>{pitch.name}<b>{Math.round(pitch.pct)}%</b></span>)}</div>}
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
   <span className="kb-chance"><strong><Roll text={`${chance}%`}/></strong><small>to hit</small></span>
  </div>
  <div className="kb-meter kb-rise" style={delay(.16)} aria-hidden="true"><i style={{'--v':pick.chance}}/></div>
  {pick.redFlag&&<p className="kb-flag kb-rise" style={delay(.18)}><TriangleAlert aria-hidden="true"/><span><strong>Red flag</strong>{pick.redFlag}</span></p>}
  {pick.projection!=null&&<div className="kb-rise" style={delay(.2)}><Gauge pick={pick}/></div>}
  {pick.last.length>=3&&<div className="kb-rise" style={delay(.28)}><Bars pick={pick}/></div>}
  {pick.tiles.length>0&&<div className="kb-tiles kb-rise" style={delay(.36)}>
   {pick.tiles.map((tile,index)=><div key={tile.key} className="kb-tile" data-tone={tile.tone||undefined} style={{'--i':index}}><b><Roll text={tile.value}/></b><span>{tile.label}</span></div>)}
  </div>}
  {pick.matchup&&!pick.rating?.factors?.length&&<div className="kb-rise" style={delay(.46)}><Matchup matchup={pick.matchup}/></div>}
  {pick.rating&&<div className="kb-rise" style={delay(.5)}><Rating rating={pick.rating}/></div>}
  {reasons?.length>0&&<ul className="kb-why kb-rise" style={delay(.54)}>{reasons.map((text,index)=><li key={text} style={{'--i':index}}><Check aria-hidden="true"/>{text}</li>)}</ul>}
  {pick.risks.length>0&&<p className="kb-risk kb-rise" style={delay(.6)}><TriangleAlert aria-hidden="true"/>{pick.risks.join(' · ')}</p>}
 </div>;
}

function ComparePick({pick,best,index}){
 return <div className="kb-versus-side kb-rise" data-best={best?'':undefined} style={delay(.06+index*.1)}>
  {best&&<span className="kb-ribbon">My pick</span>}
  <Face src={pick.headshot} name={pick.player} logo={pick.teamLogo}/>
  <strong>{pick.player}</strong>
  <span className="kb-versus-line"><Side pick={pick}/><span>{figure(pick.line)} {pick.short}</span></span>
  <span className="kb-chance"><strong><Roll text={`${pct(pick.chance)}%`}/></strong><small>{pick.grade?`grade ${pick.grade}`:'to hit'}</small></span>
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

export function BotCard({card}){
 if(!card)return null;
 if(card.kind==='innings')return <InningsCard pitchers={card.pitchers}/>;
 if(card.kind==='matchup')return <MatchupCard card={card}/>;
 if(card.kind==='teams')return <TeamsCard card={card}/>;
 if(card.kind==='usage')return <UsageCard card={card}/>;
 if(card.kind==='pick')return <PickCard pick={card.pick} verdict={card.verdict} reasons={card.reasons}/>;
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
 if(card.kind==='slip'){
  const together=pct(card.together);
  return <div className="kb-card" data-kind="slip">
   <ol className="kb-rows">{card.picks.map((pick,index)=><Row key={pick.player} pick={pick} rank={index+1} index={index}/>)}</ol>
   <div className="kb-slip-foot kb-rise" style={delay(.1+card.picks.length*.09)}>
    <span><small>All {card.picks.length} hit</small><strong><Roll text={`${together}%`}/></strong></span>
    {card.payout&&<span><small>Power Play</small><strong><Roll text={`${card.payout}x`}/></strong></span>}
   </div>
  </div>;
 }
 return null;
}
