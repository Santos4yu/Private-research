// The player page's News card (player_news.py through api/prediction.py
// action=player-news): ESPN's player news read for this line into a few
// notes, each marked as helping the over, hurting it or neither, with how
// old it is and a link to the item it came from. The owner, Nov 1, with
// another app's cards: "We need information like this this is super
// important." Behind the "news" research switch (site_controls), off until
// the admin turns it on; admins always see it.
import React,{useEffect,useState} from 'react';
import {ExternalLink,Minus,Newspaper,RefreshCw,ThumbsDown,ThumbsUp} from 'lucide-react';
import {FinderResearchCard as Card} from './FinderResearchSections';
import {useIsAdmin,QUIET} from './admin-notice.js';
import {siteResearchAllowed} from './site-access';
import './player-news.css';

export const NEWS_SPORTS=new Set(['nba','wnba','nfl']);
const TONE_ICON={up:ThumbsUp,down:ThumbsDown,flat:Minus};
const TONE_WORD={up:'Helps the over',down:'Hurts the over',flat:'Neutral'};

/** Whether the News tab shows (the "news" research switch), following the site's switches as they change. */
export function useNewsAllowed(){
 const [allowed,setAllowed]=useState(()=>siteResearchAllowed('news'));
 useEffect(()=>{
  const update=()=>setAllowed(siteResearchAllowed('news'));
  update();
  window.addEventListener('vortex:site-policy',update);
  return()=>window.removeEventListener('vortex:site-policy',update);
 },[]);
 return allowed;
}
const NEWS_TAB=['news','News'];
/** A page's research tabs, with News last when it's on. */
export const withNews=(tabs,on)=>on?[...tabs,NEWS_TAB]:tabs;

/** How long ago, short: 13h, 2d. */
export function newsAge(value,now=Date.now()){
 const then=Date.parse(value||'');
 if(!Number.isFinite(then))return '';
 const hours=Math.max(0,(now-then)/36e5);
 return hours<1?'now':hours<24?`${Math.floor(hours)}h`:`${Math.floor(hours/24)}d`;
}
/** The request for a row's news: null when the row can't be looked up. */
export function newsUrl(row){
 if(!row?.playerId||!NEWS_SPORTS.has(row.sport))return null;
 const query=new URLSearchParams({action:'player-news',sport:row.sport,playerId:String(row.playerId),player:row.player||'',
  team:row.teamAbbr||'',market:row.market||'',line:row.line??''});
 if(row.startsAt){const date=new Date(row.startsAt);if(!Number.isNaN(date.getTime()))query.set('when',date.toLocaleDateString('en-US',{month:'short',day:'numeric'}));}
 return `/api/prediction?${query}`;
}

export default function PlayerNews({row}){
 const admin=useIsAdmin(),url=newsUrl(row);
 const [state,setState]=useState({loading:true}),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!url){setState({data:{notes:[]}});return undefined;}
  const control=new AbortController();setState(old=>({loading:true,data:old.url===url?old.data:null,url}));
  fetch(url,{signal:control.signal,credentials:'same-origin'})
   .then(async response=>{const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||'Player news is unavailable.');setState({data,url});})
   .catch(error=>{if(error.name!=='AbortError')setState({error:error.message,url});});
  return()=>control.abort();
 },[url,retry]);
 const data=state.data,notes=data?.notes||[];
 return <Card title="News" icon={Newspaper} className="player-news" note={data?.items?`${data.items} ${data.items===1?'item':'items'}, last 3 weeks`:null}>
  {state.loading&&!data?<div className="mlb-context-skeleton" role="status" aria-label="Loading news"><span/><span/><span/></div>
  :state.error&&!data?<p className="mlb-context-note">{admin?<>{state.error} <button type="button" onClick={()=>setRetry(n=>n+1)}><RefreshCw size={13} aria-hidden="true"/> Retry</button></>:QUIET}</p>
  :!notes.length?<p className="mlb-context-note">No news on {row.player} in the last three weeks.</p>
  :<>
   {data.read&&<p className="player-news-read">{data.read}</p>}
   <ul className="player-news-list">{notes.map((note,index)=>{const Icon=TONE_ICON[note.tone]||Minus;return <li key={index} data-tone={note.tone}>
    <span className="player-news-tone" title={TONE_WORD[note.tone]}><Icon size={15} aria-label={TONE_WORD[note.tone]}/></span>
    <span><b>{note.text}</b><small>{[newsAge(note.published),note.source].filter(Boolean).join(' · ')}
     {note.link&&<a href={note.link} target="_blank" rel="noopener noreferrer" aria-label="Read it on ESPN"><ExternalLink size={12} aria-hidden="true"/></a>}</small></span>
   </li>;})}</ul>
  </>}
 </Card>;
}
