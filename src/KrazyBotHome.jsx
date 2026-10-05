import React from 'react';
import {ArrowDown,ArrowUp,ArrowUpRight,Flame,Layers,ShieldCheck,Swords,Target} from 'lucide-react';
import {Bars,Face} from './KrazyBotCard';

// Krazy Bot before a question: what's on today's board, its top plays and a
// few quick looks, each one a question away (krazy-bot.js today()). Tapping
// anything asks it, and the answer opens with the full report.

const pct=value=>Math.round(value*100);
const figure=value=>Number.isInteger(value)?String(value):value.toFixed(1);

// The questions behind the quick looks, so the example chips don't repeat them.
export const LOOK_QUESTIONS=['Safest pick','Best matchup today','Build me a 3-pick slip','nrfi today?','Best value play'];

function looks(today){
 const safest=today?.safest,matchup=today?.matchup;
 return [
  {key:'safest',icon:ShieldCheck,title:'Safest pick',question:'Safest pick',
   detail:safest?`${safest.player} · ${pct(safest.chance)}%`:'The likeliest hit on the board'},
  {key:'matchup',icon:Swords,title:'Best matchup',question:'Best matchup today',
   detail:matchup?`${matchup.player}${matchup.rating?` · ${matchup.rating.label} ${matchup.rating.score}`:''}`:'The softest spot today'},
  {key:'slip',icon:Layers,title:'3-pick slip',question:'Build me a 3-pick slip',detail:'B or better, from different games'},
  today?.mlb===false
   ?{key:'value',icon:Flame,title:'Best value',question:'Best value play',detail:'A demon worth the payout'}
   :{key:'nrfi',icon:Target,title:'NRFI / YRFI',question:'nrfi today?',detail:'First-inning chances by game'},
 ];
}

function Play({play,index,onAsk,tabIndex}){
 const chance=pct(play.chance);
 return <button type="button" className="kb-play" style={{'--i':index}} onClick={()=>onAsk(play.question)} tabIndex={tabIndex}
  aria-label={`${play.player} ${play.side==='UNDER'?'under':'over'} ${figure(play.line)} ${play.stat}, ${chance}% to hit`}>
  <span className="kb-play-head">
   <Face src={play.headshot} name={play.player} logo={play.teamLogo} size="md"/>
   <span className="kb-play-who"><strong>{play.player}</strong><small>{[play.team&&play.opponent?`${play.team} ${play.home===false?'@':'vs'} ${play.opponent}`:play.team,play.time].filter(Boolean).join(' · ')}</small></span>
   {play.grade&&<span className="kb-grade" data-grade={play.grade} data-size="sm">{play.grade}</span>}
  </span>
  <span className="kb-play-line">
   <span className="kb-side" data-side={play.side}>{play.side==='UNDER'?<ArrowDown aria-hidden="true"/>:<ArrowUp aria-hidden="true"/>}{play.side==='UNDER'?'Under':'Over'}</span>
   <strong>{figure(play.line)}</strong><span>{play.stat}</span>
  </span>
  <span className="kb-play-foot">
   {play.last.length>=3?<Bars pick={play} compact/>:<span/>}
   <span className="kb-play-ring" style={{'--v':play.chance}}><b>{chance}<small>%</small></b></span>
  </span>
  {play.rating&&<span className="kb-play-tag" data-tone={play.rating.tone}>{play.rating.label} matchup · {play.rating.score}</span>}
 </button>;
}

export function KrazyBotHome({today,failed,onAsk,idle}){
 const tabIndex=idle?0:-1;
 const plays=today?.top?.filter(Boolean)||[];
 return <div className="kb-home">
  <p className="kb-home-live" data-ready={today?'':undefined}>
   <i aria-hidden="true"/>
   {today?<>{today.props.toLocaleString()} props<em>·</em>{today.games} games{today.next&&<><em>·</em>next start {today.next}</>}</>
    :failed?'The board is unavailable right now':'Loading today\'s board…'}
  </p>
  {(plays.length>0||!today&&!failed)&&<section className="kb-home-section" aria-label="Top plays right now">
   <h2>Top plays right now</h2>
   <div className="kb-home-plays" style={{'--n':Math.min(Math.max(plays.length||4,2),4)}}>
    {plays.length?plays.map((play,index)=><Play key={`${play.player}-${play.stat}-${play.line}`} play={play} index={index} onAsk={onAsk} tabIndex={tabIndex}/>)
     :[0,1,2,3].map(index=><span key={index} className="kb-play kb-play-ghost" style={{'--i':index}} aria-hidden="true"/>)}
   </div>
  </section>}
  <section className="kb-home-section" aria-label="Quick looks">
   <h2>Quick looks</h2>
   <div className="kb-home-looks">
    {looks(today).map(({key,icon:Icon,title,detail,question},index)=><button key={key} type="button" className="kb-look" style={{'--i':index}} onClick={()=>onAsk(question)} tabIndex={tabIndex}>
     <span className="kb-look-icon"><Icon aria-hidden="true"/></span>
     <span className="kb-look-text"><strong>{title}</strong><small>{detail}</small></span>
     <ArrowUpRight className="kb-look-go" aria-hidden="true"/>
    </button>)}
   </div>
  </section>
 </div>;
}
