import React,{useEffect,useMemo,useRef} from 'react';
import {WNBA_STATS,wnbaChart,wnbaLines,wnbaOdds} from './trend-data';

const display=value=>Number.isFinite(value)?Number(value.toFixed(1)).toLocaleString():'—';
const average=values=>{const valid=values.filter(Number.isFinite);return valid.length?valid.reduce((sum,value)=>sum+value,0)/valid.length:null;};
function Team({name,logo}){return <div className="wnba-match-team">{logo&&<img src={logo} alt="" onError={e=>{e.currentTarget.hidden=true;}}/>}<strong>{name||'Team pending'}</strong></div>;}

function ResearchContext({row,logs,opponent,loading}){
 const games=[...logs].sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const h2h=opponent?games.filter(game=>game.opponent===opponent):[];
 const stats=WNBA_STATS.filter(stat=>['player_points','player_rebounds','player_assists','player_threes'].includes(stat.key));
 return <aside className="wnba-research-context" aria-label="Player matchup research">
  <section className="wnba-research-card"><h2>Matchup</h2><div className="wnba-match-teams"><Team name={row.awayTeam} logo={row.awayTeamLogo}/><span>@</span><Team name={row.homeTeam} logo={row.homeTeamLogo}/></div><p className="wnba-game-time">{row.startsAt?new Date(row.startsAt).toLocaleString([],{weekday:'long',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time not posted'}</p><div className="wnba-context-summary"><span>{row.team===row.homeTeam?'Home':row.team===row.awayTeam?'Away':'Location unavailable'}</span><span>{row.market} · {row.line}</span></div></section>
  <section className="wnba-research-card"><h2>vs {opponent||'upcoming opponent'} <small>This season</small></h2><div className="wnba-context-metrics"><div><span>Games</span><strong>{loading?'…':h2h.length}</strong></div><div><span>Avg {row.market}</span><strong>{loading?'…':display(average(h2h.map(game=>game.values?.[row.marketKey])))}</strong></div></div>{!loading&&!h2h.length&&<p className="wnba-context-note">No recorded meetings in the loaded season.</p>}</section>
  <section className="wnba-research-card"><h2>Season averages <small>{loading?'Loading':games.length+' games'}</small></h2><div className="wnba-season-metrics">{stats.map(stat=><div key={stat.key}><span>{stat.label}</span><strong>{loading?'…':display(average(games.map(game=>game.values?.[stat.key])))}</strong></div>)}</div></section>
  <section className="wnba-research-card"><h2>Recent games</h2><div className="wnba-recent-games">{games.slice(-5).reverse().map(game=><div key={game.gameId||game.date}><span>{new Date(game.date).toLocaleDateString([],{month:'short',day:'numeric'})}</span><span>{game.isHome?'vs':'@'} {game.opponent}</span><b data-result={game.result}>{game.result||'—'}</b><strong>{game.score||'—'}</strong></div>)}</div>{loading&&<p className="wnba-context-note">Loading game history…</p>}</section>
 </aside>;
}

export function WNBATrendHost({row,playerRows,logs,loading,onStat}){
 const host=useRef(null);const opponentAbbr=row.team===row.homeTeam?row.awayTeamAbbr:row.homeTeamAbbr;const available=new Set(playerRows.map(item=>item.marketKey));
 const config=useMemo(()=>({sport:'WNBA',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent:opponentAbbr||'',opponentLogo:row.team===row.homeTeam?row.awayTeamLogo:row.homeTeamLogo,matchupLabel:`${row.awayTeam} @ ${row.homeTeam}`,kickoffLabel:new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),status:'Pre-game',headshot:row.headshot||null,stats:WNBA_STATS.filter(stat=>available.has(stat.key)),statKey:row.marketKey,stat:row.market,side:'Over',line:row.line,chart:wnbaChart(logs,row.marketKey,opponentAbbr),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),loading,onStat}),[row,playerRows,logs,loading,onStat,opponentAbbr]);
 const latest=useRef(config);latest.current=config;
 useEffect(()=>{const panel=window.vortexTrendPanel;if(!panel||!host.current)return;panel.mount(host.current,latest.current);return()=>panel.unmount();},[]);
 useEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
 const recent=[...logs].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-10);
 const minutes=recent.map(game=>game.minutes);const maxMinutes=Math.max(1,...minutes.filter(Number.isFinite));
 return <div className="wnba-research">
  <header className="wnba-player-banner"><div className="wnba-player-avatar">{row.headshot?<img src={row.headshot} alt={row.player} onError={e=>{e.currentTarget.hidden=true;}}/>:<span>{row.player?.split(' ').map(part=>part[0]).slice(0,2).join('')}</span>}{row.teamLogo&&<img className="wnba-player-team-logo" src={row.teamLogo} alt=""/>}</div><div><span className="wnba-player-league">WNBA · {row.position||'Player'}</span><h1>{row.player}</h1><p>{row.teamAbbr||row.team} {row.team===row.homeTeam?'vs':'@'} {opponentAbbr||'Opponent pending'}<span> · </span>{row.startsAt?new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}):'Time pending'}</p></div></header>
  <div className="wnba-research-columns"><div className="wnba-research-main"><div className="wnba-trend-host" ref={host}/>
   <section className="wnba-research-card wnba-supporting"><h2>Supporting stats <small>Last {recent.length} games</small></h2><div className="wnba-season-metrics">{[['Minutes',average(minutes)],['Points',average(recent.map(g=>g.values?.player_points))],['Rebounds',average(recent.map(g=>g.values?.player_rebounds))],['Assists',average(recent.map(g=>g.values?.player_assists))]].map(([label,value])=><div key={label}><span>{label}</span><strong>{loading?'…':display(value)} <small>avg.</small></strong></div>)}</div><div className="wnba-minutes-chart" aria-label="Minutes played in recent games">{recent.map((game,index)=><div className="wnba-minutes-column" key={game.gameId||game.date}><div className="wnba-minutes-track"><div style={{height:Number.isFinite(minutes[index])?`${minutes[index]/maxMinutes*100}%`:'0%'}}><span>{display(minutes[index])}</span></div></div><small>{new Date(game.date).toLocaleDateString([],{month:'numeric',day:'numeric'})}<br/>{game.opponent}</small></div>)}</div></section>
  </div><ResearchContext row={row} logs={logs} opponent={opponentAbbr} loading={loading}/></div>
 </div>;
}
