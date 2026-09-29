// Requests for the Finder's NHL player page: /api/board?view=nhl's
// resources (nhl_research.py). One request per URL for the session; a
// failure is forgotten so Retry really asks again.
import {useEffect,useState} from 'react';
import {loadNhlLog,patientRequest} from '../../unified-finder-data';

const requests=new Map();
export function nhlGet(resource,params={}){
 if(resource==='log')return loadNhlLog(params.team,params.opponent);
 const query=new URLSearchParams({view:'nhl',resource});
 Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=='')query.set(key,String(value));});
 const url='/api/board?'+query;
 if(!requests.has(url)){
  const promise=patientRequest(url);
  promise.then(data=>{if(data?.complete===false)requests.delete(url);},()=>requests.delete(url));
  requests.set(url,promise);
 }
 return requests.get(url);
}
export function useNhl(resource,params,enabled=true){
 const key=JSON.stringify(params);
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:enabled});
 useEffect(()=>{
  if(!enabled){setState({});return undefined;}
  let active=true;setState(old=>({loading:true,data:old.key===key?old.data:undefined,key}));
  nhlGet(resource,params).then(data=>{if(active)setState({data,key});}).catch(error=>{if(active)setState({error:error.message,key});});
  return()=>{active=false;};
 },[resource,key,enabled,retry]);
 return {...state,retry:()=>setRetry(n=>n+1)};
}
export const opponentOf=row=>row.opponent||(row.teamAbbr&&row.teamAbbr===row.homeTeamAbbr?row.awayTeamAbbr:row.homeTeamAbbr)||'';
