import React,{useRef,useState} from 'react';
import {Activity,ClipboardPaste,Crosshair,ImageUp,ScanLine,ShieldCheck,Sparkles,TrendingUp} from 'lucide-react';
import {LEAGUE_LOGOS} from './league-logos';

// The Slip Analyzer's front door: one stage with the pitch and the upload
// on the left and, on the right, what a graded slip looks like (marked as
// an example), the three steps along the bottom. The whole stage takes a
// dropped screenshot.
const APPS=['PrizePicks','Underdog','Sleeper','Pick6','Sportsbooks'];
const EXAMPLE=[
 {initials:'JA',name:'J. Allen',pick:'More 245.5 Pass Yds',hit:'8 of 10',tier:'strong',label:'Strong'},
 {initials:'SB',name:'S. Barkley',pick:'More 88.5 Rush Yds',hit:'7 of 10',tier:'solid',label:'Solid'},
 {initials:'JC',name:"J. Chase",pick:'More 6.5 Receptions',hit:'6 of 10',tier:'lean',label:'Lean'},
];
const STEPS=[
 {icon:ImageUp,title:'Upload your slip',text:'A screenshot from any app'},
 {icon:Crosshair,title:'Every pick checked',text:'Recent games, matchup, injuries and odds'},
 {icon:ShieldCheck,title:'Get the grade',text:'One grade for the slip, a read on each pick'},
];

// A league's logo, or its short name if the logo won't load.
function League({sport,name}){
 const [broken,setBroken]=useState(false);
 return <li title={name} data-broken={broken||undefined}>
  {broken?<em aria-hidden="true">{sport.toUpperCase()}</em>:<img src={LEAGUE_LOGOS[sport]} alt="" onError={()=>setBroken(true)}/>}<span>{name}</span>
 </li>;
}

export function SlipStage({sports,names,onFile,onPaste}){
 const input=useRef(null);
 const [over,setOver]=useState(false);
 return <section className="sa-stage" data-over={over||undefined}
  onDragOver={event=>{event.preventDefault();setOver(true);}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOver(false);}}
  onDrop={event=>{event.preventDefault();setOver(false);onFile(event.dataTransfer.files?.[0]);}}>
  <div className="sa-stage-main">
   <div className="sa-stage-copy">
    <span className="sa-stage-tag"><ScanLine size={14} aria-hidden="true"/>Slip Analyzer</span>
    <h1>Grade any slip<span> in seconds.</span></h1>
    <p>Drop in a screenshot of your picks. We check every pick against the player's recent games, the matchup and the sportsbook odds, then grade the whole slip.</p>
    <div className="sa-upload">
     <button type="button" className="sa-upload-main" onClick={()=>input.current?.click()}>
      <span className="sa-upload-icon"><ImageUp size={20} aria-hidden="true"/></span>
      <span><b>Upload slip</b><small>A screenshot, or drop one anywhere here</small></span>
     </button>
     <button type="button" className="sa-upload-paste" onClick={onPaste}><ClipboardPaste size={17} aria-hidden="true"/>Paste</button>
     <input ref={input} type="file" accept="image/*" hidden onChange={event=>{onFile(event.target.files?.[0]);event.target.value='';}}/>
    </div>
    <small className="sa-stage-hint">Tip: press Ctrl+V or ⌘V to paste a screenshot.</small>
    <div className="sa-stage-works">
     <span>Works with</span>
     <ul aria-label="Apps">{APPS.map(app=><li key={app}>{app}</li>)}</ul>
    </div>
    <ul className="sa-stage-leagues" aria-label="Sports">{sports.map(sport=><League key={sport} sport={sport} name={names[sport]}/>)}</ul>
   </div>

   <div className="sa-stage-demo" aria-hidden="true">
    <div className="sa-demo-card">
     <header><span className="sa-demo-flag">Example</span><b>3-Pick Power Play</b></header>
     <div className="sa-demo-grade">
      <svg viewBox="0 0 120 120"><defs><linearGradient id="sa-demo-ring" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0" stopColor="var(--a-accent)"/><stop offset="1" stopColor="#3fd0ff"/></linearGradient></defs>
       <circle cx="60" cy="60" r="50" className="sa-demo-track"/><circle cx="60" cy="60" r="50" className="sa-demo-arc" stroke="url(#sa-demo-ring)"/></svg>
      <div className="sa-demo-letter"><b>A-</b><small>Slip grade</small></div>
     </div>
     <ul className="sa-demo-picks">{EXAMPLE.map((pick,index)=><li key={pick.name} style={{'--i':index}}>
      <span className="sa-demo-face">{pick.initials}</span>
      <span className="sa-demo-what"><b>{pick.name}</b><small>{pick.pick}</small></span>
      <span className="sa-demo-hit"><TrendingUp size={12}/>{pick.hit}</span>
      <span className="sa-demo-tier" data-tier={pick.tier}>{pick.label}</span>
     </li>)}</ul>
    </div>
    <span className="sa-demo-chip is-one"><Activity size={13}/>Matchup checked</span>
    <span className="sa-demo-chip is-two"><Sparkles size={13}/>Injuries and odds</span>
   </div>
  </div>

  <ol className="sa-stage-steps">{STEPS.map(({icon:Icon,title,text},index)=><li key={title}>
   <span className="sa-step-num">{index+1}</span>
   <span className="sa-step-icon"><Icon size={17} aria-hidden="true"/></span>
   <span><b>{title}</b><small>{text}</small></span>
  </li>)}</ol>
  {over&&<div className="sa-stage-drop" aria-hidden="true"><ImageUp size={28}/><b>Drop it to grade it</b></div>}
 </section>;
}
