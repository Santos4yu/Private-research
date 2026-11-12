// The Line Movement card's rows (PropTrail.jsx), apart so tests can read them.

// The server's names (line_moves.norm): lower case letters and digits.
const norm=value=>String(value||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');
// A move belongs to tonight's game when its start is within a few hours of it.
const SAME_GAME=3*3600e3;

/** This line's moves, newest first, then where it opened ({line, from?, at?, note?, tone?}). */
export function lineTrail(row,moves){
 const start=Date.parse(row.startsAt||'');
 // Moves are kept for the standard line; a goblin or demon line shows as it stands.
 const standard=(row.modifier||'standard')==='standard';
 const mine=standard?(moves||[]).filter(move=>norm(move.stat)===norm(row.market)
  &&(!Number.isFinite(start)||Math.abs(Date.parse(move.startsAt||'')-start)<SAME_GAME))
  .sort((a,b)=>String(b.at).localeCompare(String(a.at))):[];
 const out=mine.map(move=>move.kind==='pulled'?{key:`p${move.at}`,line:move.from,at:move.at,note:'Pulled',tone:'pulled'}
  :{key:`m${move.at}`,line:move.to,from:move.from,at:move.at,tone:move.to>move.from?'up':'down'});
 if(mine.length)out.push({key:'open',line:mine.at(-1).from,note:'Opened'});
 else out.push({key:'now',line:row.line,note:'No moves yet'});
 return out;
}
