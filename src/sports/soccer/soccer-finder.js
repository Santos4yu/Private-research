// The soccer page's requests, on top of soccer-stats.js.
import {useEffect,useState} from 'react';
export * from './soccer-stats.js';

const requests=new Map();
// One request per URL for the session; a failure is forgotten so Retry
// really asks again.
export function soccerGet(resource,params={}){
 const query=new URLSearchParams({view:'soccer',resource});
 Object.entries(params).forEach(([key,value])=>{if(value!=null&&value!=='')query.set(key,String(value));});
 const url='/api/board?'+query;
 if(!requests.has(url)){
  const promise=fetch(url,{credentials:'same-origin'}).then(async response=>{
   const data=await response.json().catch(()=>({}));
   if(!response.ok||data.error)throw new Error(data.error||'Match data is temporarily unavailable.');
   return data;
  });
  promise.catch(()=>requests.delete(url));
  requests.set(url,promise);
 }
 return requests.get(url);
}
export const teamLogParams=(row,team=row.teamId)=>({league:row.competition,event:row.eventId,team});
export function useSoccer(resource,params,enabled=true){
 const key=JSON.stringify(params);
 const [retry,setRetry]=useState(0),[state,setState]=useState({loading:enabled});
 useEffect(()=>{
  if(!enabled){setState({});return undefined;}
  let active=true;setState(old=>({loading:true,data:old.key===key?old.data:undefined,key}));
  soccerGet(resource,params).then(data=>{if(active)setState({data,key});}).catch(error=>{if(active)setState({error:error.message,key});});
  return()=>{active=false;};
 },[resource,key,enabled,retry]);
 return {...state,retry:()=>setRetry(n=>n+1)};
}
