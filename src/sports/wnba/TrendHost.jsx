import React,{useEffect,useMemo,useRef} from 'react';
import {WNBA_STATS,wnbaChart,wnbaLines,wnbaOdds} from './trend-data';

export function WNBATrendHost({row,playerRows,logs,loading,onStat}){
 const host=useRef(null);const opponentAbbr=row.team===row.homeTeam?row.awayTeamAbbr:row.homeTeamAbbr;const available=new Set(playerRows.map(item=>item.marketKey));
 const config=useMemo(()=>({sport:'WNBA',player:row.player,teamAbbr:row.teamAbbr||'',teamLogo:row.teamLogo||'',opponent:opponentAbbr||'',opponentLogo:row.team===row.homeTeam?row.awayTeamLogo:row.homeTeamLogo,matchupLabel:`${row.awayTeam} @ ${row.homeTeam}`,kickoffLabel:new Date(row.startsAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'}),status:'Pre-game',headshot:row.headshot||null,stats:WNBA_STATS.filter(stat=>available.has(stat.key)),statKey:row.marketKey,stat:row.market,side:'Over',line:row.line,chart:wnbaChart(logs,row.marketKey,opponentAbbr),lines:wnbaLines(playerRows,row.marketKey),linesStatus:'ready',odds:wnbaOdds(playerRows,row.marketKey),loading,onStat}),[row,playerRows,logs,loading,onStat,opponentAbbr]);
 const latest=useRef(config);latest.current=config;
 useEffect(()=>{const panel=window.vortexTrendPanel;if(!panel||!host.current)return;panel.mount(host.current,latest.current);return()=>panel.unmount();},[]);
 useEffect(()=>{window.vortexTrendPanel?.update(config);},[config]);
 return <div className="wnba-trend-host" ref={host}/>;
}
