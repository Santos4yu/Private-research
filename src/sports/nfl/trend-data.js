import {gameStatValue} from './nfl-ui-core.js';

export function opportunityField(prop) {
  if (['passing_yards','passing_attempts','pass_completions','passing_touchdowns','interceptions','passing_rushing_yards'].includes(prop)) return {key:'attempts',label:'Pass attempts'};
  if (['rushing_yards','rush_attempts','rushing_receiving_yards'].includes(prop)) return {key:'carries',label:'Carries'};
  if (prop==='fantasy_score') return null;
  return {key:'targets',label:'Targets'};
}

export function selectTrendGames(logs,usage,prop,filters={},excluded=[],count=5) {
  const snaps=new Map(usage.map(row=>[row.game_id,row]));
  const field=opportunityField(prop);
  const eligible=[...logs].filter(row=>{
    if (!Number.isFinite(gameStatValue(row,prop))) return false;
    if(filters.season && String(row.season)!==String(filters.season)) return false;
    if(filters.venue && (row.is_home==null || (row.is_home ? 'HOME':'AWAY')!==filters.venue)) return false;
    if(filters.opponent && row.opponent_team_id!==filters.opponent) return false;
    if(filters.team && row.team_id!==filters.team) return false;
    const volume=field ? row.stats?.[field.key] : null;
    if(filters.minVolume!=='' && filters.minVolume!=null && (!Number.isFinite(volume) || volume<Number(filters.minVolume)))return false;
    if(filters.maxVolume!=='' && filters.maxVolume!=null && (!Number.isFinite(volume) || volume>Number(filters.maxVolume)))return false;
    const snap=snaps.get(row.game_id)?.offense_snap_rate;
    if(filters.minSnaps!=='' && filters.minSnaps!=null && (!Number.isFinite(snap) || snap*100<Number(filters.minSnaps)))return false;
    return true;
  }).sort((a,b)=>a.season-b.season || a.week-b.week || a.game_id.localeCompare(b.game_id));
  const included=eligible.filter(row=>!excluded.includes(row.game_id));
  const selected=included.slice(-Math.max(1,Math.floor(count)));
  return {eligible,included,selected};
}

export function compareTrend(logs,prop,line,direction='OVER') {
  const values=logs.map(row=>gameStatValue(row,prop)).filter(Number.isFinite);
  const sorted=[...values].sort((a,b)=>a-b);const n=values.length;
  const comparison=Number.isFinite(line) && ['OVER','UNDER'].includes(direction);
  const pushes=comparison ? values.filter(v=>v===line).length : null;
  const hits=comparison ? values.filter(v=>direction==='OVER' ? v>line : v<line).length : null;
  const decisions=comparison ? n-pushes : 0;
  return {games:n,average:n?values.reduce((a,b)=>a+b,0)/n:null,median:n?(sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2:null,
    hits,misses:comparison?decisions-hits:null,pushes,hitRate:decisions?hits/decisions*100:null};
}

export function quoteIdentity(line) {
  return line ? [line.playerId,line.gameId,line.propType,line.bookmaker,line.category,line.value,line.direction].join('|') : '';
}

export function filterOffers(rows,{prop,bookmaker='prizepicks',category='ALL'}={}) {
  return rows.filter(row=>(!prop || row.propType===prop) && (!bookmaker || row.line.bookmaker===bookmaker) &&
    (category==='ALL' || category==='ALTERNATE' ? category==='ALL' || row.line.category!=='STANDARD' : row.line.category===category));
}
