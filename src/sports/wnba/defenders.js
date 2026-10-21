// Who guards him (nba_matchups.py through /api/wnba?resource=defender):
// today's opponent's players who guarded him, from the games they played for
// that team against him, less anyone out tonight. Shared by the matchup
// page's card (NbaScout.jsx) and the Finder's (WNBAFinderContext.jsx).

// Names as the injury report and NBA.com both write them.
export const nameKey=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’.]/g,'').replace(/\b(jr|sr|ii|iii|iv)\b/g,'').replace(/[^a-z]+/g,' ').trim();

export function theirDefenders(data,injuries){
 const out=new Set((injuries||[]).filter(item=>/out/i.test(item.status||'')||item.code==='OFS').map(item=>nameKey(item.name)));
 const theirs=data?.theirs||(data?.defenders||[]).filter(item=>item.team===data?.opponent);
 return theirs.filter(item=>!out.has(nameKey(item.name))).sort((a,b)=>b.poss-a.poss);
}

// "2025-26 and 2026-27": the seasons the time on him comes from.
export function theirSeasons(data,list){
 const seasons=[...new Set(list.flatMap(item=>item.seasons||[]))].sort();
 return seasons.length?seasons.join(' and '):data?.season;
}
