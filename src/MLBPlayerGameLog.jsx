import React,{useEffect,useState} from 'react';
import {loadMlbHistory} from './unified-finder-data';
import {ListOrdered} from 'lucide-react';
import {supportingValue} from './mlb-finder-research';

export function gameLogColumns(pitcher){return pitcher?
 [['inningsPitched','IP'],['numberOfPitches','Pitches'],['strikeOuts','K'],['hits','HA'],['baseOnBalls','BB'],['earnedRuns','ER'],['homeRuns','HR']]:
 [['atBats','AB'],['hits','H'],['runs','R'],['rbi','RBI'],['homeRuns','HR'],['baseOnBalls','BB'],['strikeOuts','K'],['stolenBases','SB']];}
export function gameLogValue(game,key){const value=supportingValue(game,key);return value==null?'—':key==='inningsPitched'?`${Math.floor(value)}${['','⅓','⅔'][Math.round(value*3)%3]}`:value;}
export default function MLBPlayerGameLog({row}){
 const [history,setHistory]=useState(row.history),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setHistory(row.history);setLoading(true);setError(false);loadMlbHistory(row).then(value=>{if(active)setHistory(value);}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[row.id,retry]);
 const onRetry=()=>setRetry(value=>value+1);
 const pitcher=row.marketKey?.startsWith('pitching:');
 const games=[...(history?.games||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15);
 const columns=gameLogColumns(pitcher);
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log</h2><small>{row.player} · Last {games.length||15} games</small></header>
 {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<p className="mlb-context-note" role="status">Game log could not load. <button type="button" onClick={onRetry}>Retry</button></p>:games.length?<div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th>{columns.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{games.map((game,index)=>{
 const opponent=typeof game.opponent==='string'?game.opponent:game.opponent?.abbreviation||game.opponent?.name||'—';
 return <tr key={game.gameId||`${game.date}-${index}`}><th scope="row" title={game.date}>{game.date?.slice(5).replace('-','/')||'—'}</th><td>{game.isHome===false?'@ ':game.isHome===true?'vs ':''}{opponent}</td>{columns.map(([key])=><td key={key}>{gameLogValue(game,key)}</td>)}</tr>;
 })}</tbody></table></div>:<p className="mlb-context-note">No recent games are available for this player.</p>}
 </section>;
}
