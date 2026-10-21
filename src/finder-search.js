// The Finder's search (UnifiedFinder.jsx), the way names get typed: no accents, dots, apostrophes or
// hyphens ("doncic", "gilgeous alexander", "deaaron fox"), each word
// anywhere in his name, team or opponent ("jefferson justin", "lakers").
export const searchKey=text=>String(text||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’.]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const searchText=new WeakMap();
export function matchesSearch(row,words){
 let text=searchText.get(row);
 if(text==null){text=searchKey([row.player,row.teamAbbr,row.opponent,row.team,row.homeTeam,row.awayTeam].filter(Boolean).join(' '));searchText.set(row,text);}
 return words.every(word=>text.includes(word));
}
