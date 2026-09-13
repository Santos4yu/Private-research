export function rankResearch(rows, {position='', game='', prop='', now=Date.now()}={}) {
  return rows.filter(r=>r.line?.verified && r.line.bookmaker==='prizepicks' && r.line.category==='STANDARD' && Number.isFinite(r.support) && r.decisions>=8 && Date.parse(r.startsAt)>now && now-Date.parse(r.line.updatedAt)>=0 && now-Date.parse(r.line.updatedAt)<=120000 && (!position||r.position===position) && (!game||r.gameId===game) && (!prop||r.propType===prop)).sort((a,b)=>b.support-a.support || b.recentHits/b.recentDecisions-a.recentHits/a.recentDecisions);
}
export function researchPlayer(row,players) {
 const player=players.find(p=>p.id===row.playerId);
 return player ? {...player,researchProp:row.propType,researchLine:row.line,researchGameId:row.gameId} : null;
}
