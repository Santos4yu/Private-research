// Requests for the Finder's college football player page:
// /api/board?view=cfb's resources (cfb_research.py). One request per URL for
// the session; a failure or a league still being gathered is forgotten, so
// Retry (or the next look) really asks again.
import {useEffect,useState} from 'react';
import {loadCfbLog,patientRequest} from '../../unified-finder-data';

const requests=new Map();
export function cfbGet(resource,params={}){
 if(resource==='log')return loadCfbLog(params.team);
 const query=new URLSearchParams({view:'cfb',resource});
 Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=='')query.set(key,String(value));});
 const url='/api/board?'+query;
 if(!requests.has(url)){
  const promise=patientRequest(url);
  promise.then(data=>{if(data?.complete===false)requests.delete(url);},()=>requests.delete(url));
  requests.set(url,promise);
 }
 return requests.get(url);
}
export function useCfb(resource,params,enabled=true){
 const key=JSON.stringify(params);
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:enabled});
 useEffect(()=>{
  if(!enabled){setState({});return undefined;}
  let active=true;setState(old=>({loading:true,data:old.key===key?old.data:undefined,key}));
  cfbGet(resource,params).then(data=>{if(active)setState({data,key});}).catch(error=>{if(active)setState({error:error.message,key});});
  return()=>{active=false;};
 },[resource,key,enabled,retry]);
 return {...state,retry:()=>setRetry(n=>n+1)};
}
export const opponentOf=row=>row.opponent||(row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr?row.awayTeamAbbr:row.homeTeamAbbr)||'';
// The college football season a day falls in (August through January).
export const cfbSeason=(now=new Date())=>now.getMonth()>=6?now.getFullYear():now.getFullYear()-1;
// The defense-vs-position group a player's position is judged in.
export const dvpPosition=value=>{const p=String(value||'').toUpperCase();return ['QB','RB','WR','TE','K'].includes(p)?p:p==='FB'?'RB':p==='PK'?'K':null;};
export function injuryCode(item){
 const status=String(item?.status||'').toUpperCase();
 if(!status)return null;
 if(status.startsWith('OUT')||status.includes('SEASON'))return 'OUT';
 if(status.startsWith('DOUBT'))return 'DOUBT';
 if(status.startsWith('QUEST'))return 'Q';
 if(status.startsWith('PROB'))return 'P';
 return status.includes('DAY')?'DTD':null;
}
export const INJURY_LEGEND=[['OUT','Out'],['DOUBT','Doubtful'],['Q','Questionable'],['P','Probable']];
