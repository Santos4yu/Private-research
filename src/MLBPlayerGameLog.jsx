import React,{useEffect,useState} from 'react';
import {loadMlbHistory} from './unified-finder-data';
import {ListOrdered} from 'lucide-react';
import {supportingValue} from './mlb-finder-research';
import {logOpponent,recentLogGames} from './mlb-game-log';
import {CalendarDays,Shield} from 'lucide-react';

export function gameLogColumns(pitcher){return pitcher?
 [['inningsPitched','IP'],['numberOfPitches','Pitches'],['strikeOuts','K'],['hits','HA'],['baseOnBalls','BB'],['earnedRuns','ER'],['homeRuns','HR']]:
 [['atBats','AB'],['hits','H'],['runs','R'],['rbi','RBI'],['homeRuns','HR'],['baseOnBalls','BB'],['strikeOuts','K'],['stolenBases','SB']];}
export function gameLogValue(game,key){const value=supportingValue(game,key);return value==null?'—':key==='inningsPitched'?`${Math.floor(value)}${['','⅓','⅔'][Math.round(value*3)%3]}`:value;}
export default function MLBPlayerGameLog({row}){
 const [history,setHistory]=useState(row.history),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;setHistory(row.history);setLoading(true);setError(false);loadMlbHistory(row).then(value=>{if(active)setHistory(value);}).catch(()=>{if(active)setError(true);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[row.id,retry]);
 const onRetry=()=>setRetry(value=>value+1);
 const pitcher=row.marketKey?.startsWith('pitching:');
 const games=recentLogGames(history);
 const columns=gameLogColumns(pitcher);
 return <section className="mlb-context-card mlb-player-gamelog"><header><h2><ListOrdered size={15} aria-hidden="true"/>Game log · Last 15 games</h2><small>{row.player}</small></header>
 {loading&&!games.length?<p className="mlb-context-note" role="status">Loading player game log…</p>:error&&!games.length?<p className="mlb-context-note" role="status">Game log could not load. <button type="button" onClick={onRetry}>Retry</button></p>:games.length?<div className="mlb-player-log-scroll" tabIndex={0} role="region" aria-label={`${row.player} recent game statistics; scroll for more columns`}><table><thead><tr><th scope="col">Date</th><th scope="col">Opponent</th>{columns.map(([key,label])=><th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>{games.map((game,index)=>{
 const opponent=logOpponent(game);
 return <tr key={game.gameId||`${game.date}-${index}`}><th scope="row" title={game.date}><span className="mlb-log-date"><CalendarDays size={12} aria-hidden="true"/>{game.date?.slice(5).replace('-','/')||'—'}</span></th><td><span className="mlb-log-opponent" title={`${game.isHome===false?'Away at ':game.isHome===true?'Home vs ':''}${opponent.name||opponent.label}`}><span className="mlb-log-logo"><Shield size={17} aria-hidden="true"/>{opponent.logo&&<img src={opponent.logo} width="20" height="20" alt="" loading="lazy" onError={e=>{e.currentTarget.hidden=true;}}/>}</span><span>{game.isHome===false?'@ ':''}{opponent.label}</span></span></td>{columns.map(([key])=><td key={key}>{gameLogValue(game,key)}</td>)}</tr>;
 })}</tbody></table></div>:<p className="mlb-context-note">No recent games are available for this player.</p>}
 {!loading&&games.length>0&&games.length<15&&<p className="mlb-context-note">{games.length} MLB {pitcher?'starts':'games'} available across the current and previous season. Showing all available results.</p>}
 </section>;
}
