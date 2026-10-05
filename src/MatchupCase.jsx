import React from 'react';
import {Activity,ArrowLeftRight,Crosshair,History,ListOrdered,MapPin,Stethoscope,Users} from 'lucide-react';
import './matchup-case.css';

// The matchup panel: the case for a pick (slip-matchup.js matchupCase), its
// band and score, then each fact with what it's about. The Slip Analyzer's
// picks and Krazy Bot's cards both show it, so they read the same.
const FACT_ICON={opponent:Crosshair,history:History,split:ArrowLeftRight,venue:MapPin,usage:Users,form:Activity};
// The news: his status, a teammate out, his lineup spot or the starter.
const newsIcon=key=>key==='lineup'||key==='starter'?ListOrdered:String(key).startsWith('mate:')?Users:Stethoscope;

export function MatchupCase({matchup,limit=null}){
 if(!matchup?.facts?.length)return null;
 const facts=limit?matchup.facts.slice(0,limit):matchup.facts;
 return <section className="sa-case" data-tone={matchup.tone}>
  <header><b>{matchup.label}</b><span className="sa-case-score" style={{'--w':`${matchup.score}%`}}><i/><em>{matchup.score}</em></span></header>
  <ul>{facts.map(item=>{const Icon=item.kind==='news'?newsIcon(item.key):FACT_ICON[item.kind]||Activity;
   return <li key={item.key} data-kind={item.kind} data-tone={item.tone}><Icon size={14}/><span>{item.text}</span></li>;})}</ul>
 </section>;
}

export default MatchupCase;
