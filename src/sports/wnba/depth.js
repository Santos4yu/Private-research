// A basketball depth chart from the rotation a coach has actually used
// (league-context `rotation`; ESPN publishes none): last game's starters fill
// the five slots by position, then the bench joins its position's rows by
// minutes, and anyone on the injury report who hasn't been playing joins at
// the end. The Finder's depth card (WNBAPlayerPage.jsx) and the Props tab's
// NBA page (NbaDepth.jsx) both read it.
import {positionOf} from './wnba-research';

export const SLOTS=[['G1','G'],['G2','G'],['F1','F'],['F2','F'],['C','C']];
// A starter with no slot left at her own position (a third guard, say) takes
// the nearest open one.
const OVERFLOW={G:['F1','F2','C'],F:['C','F2','F1','G2','G1'],C:['F2','F1','G2','G1']};
const BENCH_ROWS={G:['G1','G2'],F:['F1','F2'],C:['C']};
/** [[slot, players]] in slot order; `position` reads a player's G / F / C. */
export function depthRows(players,injuries,position=positionOf){
 const rows=Object.fromEntries(SLOTS.map(([slot])=>[slot,[]]));
 const starters=players.filter(player=>player.lastStart).sort((a,b)=>b.min-a.min),overflow=[];
 for(const player of starters){const slot=SLOTS.find(([name,spot])=>spot===position(player.pos)&&!rows[name].length);if(slot)rows[slot[0]].push(player);else overflow.push(player);}
 for(const player of overflow){const slot=(OVERFLOW[position(player.pos)]||SLOTS.map(([name])=>name)).find(name=>!rows[name].length);if(slot)rows[slot].push(player);}
 const inRotation=new Set(players.map(player=>player.id));
 const bench=[...players.filter(player=>!player.lastStart).sort((a,b)=>b.min-a.min),
  ...injuries.filter(item=>item.id&&!inRotation.has(item.id)).map(item=>({id:item.id,name:item.name,pos:item.position,headshot:item.headshot,min:null,injuredOnly:true}))];
 for(const player of bench){const options=BENCH_ROWS[position(player.pos)]||['F1','F2'];rows[options.reduce((best,name)=>rows[name].length<rows[best].length?name:best,options[0])].push(player);}
 return SLOTS.map(([slot])=>[slot,rows[slot]]);
}
const INJURY_CODES={OUT:'OUT',O:'OUT',OFS:'OFS',D:'DOUBT',DOUBTFUL:'DOUBT',Q:'Q',QUESTIONABLE:'Q',GTD:'GTD','DAY-TO-DAY':'DTD',DTD:'DTD',SUSP:'SUSP'};
/** An injury report entry's code (OUT, DOUBT, Q, GTD, DTD, OFS, SUSP), or null. */
export const injuryCode=item=>item?INJURY_CODES[String(item.code||item.status||'').toUpperCase()]||String(item.code||item.status||'').toUpperCase():null;
