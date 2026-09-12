import React, { useEffect, useRef, useState } from 'react';
import { NFLFreshness } from './Freshness';

export function NFLMarketLines({ load, player, week, prop, onSelect, selected }) {
  const [body, setBody] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setBody(null); setError('');
    load('props',{playerId:player.id,week}).then(result => { if(active)setBody(result); }).catch(() => { if(active)setError('NFL line source unavailable. Check the Odds API key and quota in Settings.'); });
    return () => { active = false; };
  },[load,player.id,week]);
  const rows = (body?.data || []).filter(row => row.propType === prop);
  useEffect(() => {
    if (!body) return;
    const offers=(body.data || []).filter(row=>row.propType===prop);
    const same=offers.find(row=>row.line.bookmaker===selected?.bookmaker && row.line.value===selected?.value && row.direction===selected?.direction);
    const first=same || offers.find(row=>row.line.bookmaker==='prizepicks' && row.direction==='OVER') || offers.find(row=>row.direction==='OVER');
    onSelect(first?.line || null);
  },[body,prop,onSelect]);
  return <section className="nfl-chart-card"><div className="nfl-section-title"><h3>Current prop lines</h3><small>Verified source · no invented lines</small></div>
    {!body && !error ? <p role="status">Loading available NFL lines…</p> : error ? <p role="alert">{error}</p> : !rows.length ? <p>{body.reason || 'No current line posted for this player and prop.'}</p> : <div className="nfl-market-quotes">{rows.map(row => <button type="button" key={`${row.line.bookmaker}.${row.line.value}.${row.direction}`} aria-pressed={selected?.bookmaker === row.line.bookmaker && selected?.value === row.line.value && selected?.direction === row.direction} onClick={() => onSelect(row.line)}><strong>{row.direction} {row.line.value}</strong><span>{row.line.platform}</span><NFLFreshness timestamp={row.line.updatedAt} staleAfter={120000} />{row.line.stale && <small>Stale quote · refresh required for decisions</small>}</button>)}</div>}
    <small>Source: The Odds API. DFS prices are indicative; no payout or betting EV is inferred.</small>
  </section>;
}

export function NFLPropBrowser({ load, players, onOpen }) {
  const [games,setGames] = useState(null);
  const [game,setGame] = useState('');
  const [body,setBody] = useState(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const request=useRef(0);
  const getGames = () => { setLoading(true);setError('');load('prop-games').then(result => {setGames(result);setGame(result.data[0]?.eventId || '');}).catch(()=>setError('NFL game/line provider unavailable.')).finally(()=>setLoading(false)); };
  const getLines = () => {const id=++request.current;setLoading(true);setError('');setBody(null);load('props',{eventId:game}).then(result=>{if(id===request.current)setBody(result);}).catch(()=>{if(id===request.current)setError('NFL lines unavailable. Check provider quota/key in Settings.');}).finally(()=>{if(id===request.current)setLoading(false);});};
  return <section className="nfl-chart-card"><h3>Browse NFL props</h3><p>Real current offers by game. Research browsing is separate from production-approved picks.</p>
    {!games ? <button type="button" className="nfl-refresh" onClick={getGames} disabled={loading}>Load NFL games</button> : <div className="nfl-board-filters"><label>Game<select value={game} onChange={event=>{request.current++;setLoading(false);setGame(event.target.value);setBody(null);setError('');}}>{games.data.map(item=><option key={item.eventId} value={item.eventId}>{item.awayTeamId} @ {item.homeTeamId} · {new Date(item.startsAt).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</option>)}</select></label><button type="button" className="nfl-refresh" onClick={getLines} disabled={loading || !game}>Load posted lines</button></div>}
    {loading && <p role="status">Loading NFL provider data…</p>}{error && <p role="alert">{error}</p>}{games && !games.data.length && <p>No verified upcoming NFL games.</p>}
    {body && !body.data.length && <p>{body.reason || 'No currently posted NFL lines for this game.'}</p>}
    {body?.data?.length > 0 && <div className="nfl-board-rows">{body.data.filter(row=>row.direction==='OVER').map(row=>{const player=players.find(player=>player.id===row.playerId);return <article key={`${row.playerId}.${row.propType}.${row.line.bookmaker}.${row.line.value}`}><strong>{row.playerName}</strong><p>{row.propType.replaceAll('_',' ')} · {row.line.value} · {row.line.platform}</p><NFLFreshness timestamp={row.line.updatedAt} staleAfter={120000} />{player && <button type="button" className="nfl-refresh" onClick={()=>onOpen({...player,researchProp:row.propType,researchLine:row.line,researchGameId:row.gameId})}>Open research</button>}</article>;})}</div>}
  </section>;
}
