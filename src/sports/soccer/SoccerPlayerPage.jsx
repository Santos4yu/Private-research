import React,{useMemo} from 'react';
import {Star} from 'lucide-react';
import {FinderPlayerBanner} from '../../FinderPlayerBanner';
import './soccer-player.css';

// The soccer player page: the shared player header, then every line
// PrizePicks posts for this player, grouped by stat. Each line saves to the
// picks list through the board's own Over / Under chooser.
const TIERS={goblin:'Goblin',demon:'Demon'};

export function SoccerPlayerPage({row,playerRows=[],onBack,picks,onPick}){
 const markets=useMemo(()=>{
  const groups=new Map();
  for(const item of playerRows.length?playerRows:[row]){
   if(!groups.has(item.market))groups.set(item.market,[]);
   groups.get(item.market).push(item);
  }
  for(const lines of groups.values())lines.sort((a,b)=>a.line-b.line);
  // The stat opened from the board first, then the rest A to Z.
  return [...groups].sort(([a],[b])=>(b===row.market)-(a===row.market)||a.localeCompare(b));
 },[playerRows,row]);
 return <section className="finder-trend-view soccer-player-page">
  <FinderPlayerBanner row={row} playerRows={playerRows} onBack={onBack}/>
  <div className="soccer-markets">
   {markets.map(([market,lines])=><section key={market} className="soccer-market" data-current={market===row.market?'true':undefined} aria-label={market}>
    <h2>{market}</h2>
    <ul>{lines.map(line=>{
     const pick=picks?.get(line.id),tier=TIERS[line.modifier];
     return <li key={line.id}>
      <img className="soccer-app" src="/prizepicks/logo.png" alt="PrizePicks" width="22" height="22"/>
      <span className="soccer-line"><b>{line.line}</b>{tier&&<img src={'/prizepicks/'+line.modifier+'.png'} alt={tier} width="16" height="16"/>}</span>
      <span className="soccer-tier">{tier||'Standard'}</span>
      <button type="button" className="soccer-save" data-requires-tab="saved" aria-haspopup="dialog" aria-pressed={Boolean(pick)} data-side={pick?pick.toLowerCase():undefined}
       aria-label={pick?`${row.player} ${line.line} ${market} is in your picks (${pick}). Change or remove`:`Add ${row.player} ${line.line} ${market} to your picks`}
       onClick={event=>onPick?.(line,event.currentTarget)}><Star size={17} fill={pick?'currentColor':'none'}/></button>
     </li>;})}</ul>
   </section>)}
  </div>
 </section>;
}
