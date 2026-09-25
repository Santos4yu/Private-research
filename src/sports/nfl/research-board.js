// Mirrors LINE_MAX_AGE_SECONDS in backend/sports/nfl/research_board.py.
// The server already applies this window; re-applying it here on a timer
// is what made rows vanish from the board a couple of minutes after they
// appeared, while the scan that fetched them was often still running.
export const LINE_MAX_AGE_MS = 600000;
export function rankResearch(rows, {position='', game='', prop='', now=Date.now(), maxAge=LINE_MAX_AGE_MS}={}) {
  return rows.filter(r=>r.line?.verified && r.line.bookmaker==='prizepicks' && r.line.category==='STANDARD' && Number.isFinite(r.support) && r.decisions>=8 && Date.parse(r.startsAt)>now && now-Date.parse(r.line.updatedAt)>=0 && now-Date.parse(r.line.updatedAt)<=maxAge && (!position||r.position===position) && (!game||r.gameId===game) && (!prop||r.propType===prop)).sort((a,b)=>b.support-a.support || b.recentHits/b.recentDecisions-a.recentHits/a.recentDecisions);
}
export function researchPlayer(row,players) {
 const player=players.find(p=>p.id===row.playerId);
 return player ? {...player,researchProp:row.propType,researchLine:row.line,researchGameId:row.gameId,researchMatchup:row.matchupContext||null} : null;
}
