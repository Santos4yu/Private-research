const teams={108:'LAA',109:'ARI',110:'BAL',111:'BOS',112:'CHC',113:'CIN',114:'CLE',115:'COL',116:'DET',117:'HOU',118:'KC',119:'LAD',120:'WSH',121:'NYM',133:'ATH',134:'PIT',135:'SD',136:'SEA',137:'SF',138:'STL',139:'TB',140:'TEX',141:'TOR',142:'MIN',143:'PHI',144:'ATL',145:'CWS',146:'MIA',147:'NYY',158:'MIL'};
export function logOpponent(game){
 const opponent=game.opponent||{};
 const id=Number(opponent.id);
 return {label:teams[id]||opponent.abbreviation||opponent.name||(typeof opponent==='string'?opponent:'—'),name:opponent.name||'',logo:teams[id]?`https://www.mlbstatic.com/team-logos/${id}.svg`:null};
}
export function recentLogGames(history){return [...(history?.games||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date))||(Number(b.gameId)||0)-(Number(a.gameId)||0)).slice(0,15);}
