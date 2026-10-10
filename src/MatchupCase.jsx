import React,{useState} from 'react';
import {Activity,ArrowLeftRight,ChevronDown,Crosshair,History,ListOrdered,MapPin,Stethoscope,Users} from 'lucide-react';
import './matchup-case.css';

// The matchup panel: the case for a pick (slip-matchup.js matchupCase), its
// band and score, then each fact with what it's about. The Slip Analyzer's
// picks and Krazy Bot's cards both show it, so they read the same.
const FACT_ICON={opponent:Crosshair,history:History,split:ArrowLeftRight,venue:MapPin,usage:Users,form:Activity};
// The news: his status, a teammate out, his lineup spot or the starter.
const newsIcon=key=>key==='lineup'||key==='starter'?ListOrdered:String(key).startsWith('mate:')?Users:Stethoscope;

// `limit` shows the first few facts (the news and the opponent come first);
// `expandable` adds a tap to see the rest.
export function MatchupCase({matchup,limit=null,expandable=true}){
 const [all,setAll]=useState(false);
 if(!matchup?.facts?.length)return null;
 const hidden=limit&&!all?Math.max(0,matchup.facts.length-limit):0;
 const facts=hidden?matchup.facts.slice(0,limit):matchup.facts;
 return <section className="sa-case" data-tone={matchup.tone}>
  <header><b>{matchup.label}</b><span className="sa-case-score" style={{'--w':`${matchup.score}%`}}><i/><em>{matchup.score}</em></span></header>
  <ul>{facts.map(item=>{const Icon=item.kind==='news'?newsIcon(item.key):FACT_ICON[item.kind]||Activity;
   return <li key={item.key} data-kind={item.kind} data-tone={item.tone}><Icon size={14}/><span>{item.text}</span></li>;})}</ul>
  {expandable&&limit&&matchup.facts.length>limit&&<button type="button" className="sa-case-more" onClick={()=>setAll(value=>!value)} aria-expanded={all}>
   {all?'Show less':`Show all ${matchup.facts.length}`}<ChevronDown size={13}/></button>}
 </section>;
}

export default MatchupCase;
