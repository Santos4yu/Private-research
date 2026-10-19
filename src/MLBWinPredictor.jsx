import React,{useEffect,useState} from 'react';
import {createMLBContextClient} from './mlb-finder-research';
const request=createMLBContextClient();
export default function MLBWinPredictor({row,data}){
 const [state,setState]=useState({});
 const team=row.teamAbbr||data?.team,opponent=data?.matchup?.opponent||row.opponent,start=data?.builderEvidence?.gameTime||row.startsAt;
 useEffect(()=>{let active=true;if(!team||!opponent||!start){setState({});return;}setState({loading:true});request('/api/slate',{tool:'mlb-matchup',team,opponent,startsAt:start}).then(value=>{if(active)setState(value);}).catch(()=>{if(active)setState({});});return()=>{active=false;};},[team,opponent,start]);
 const {away,home}=state;
 return <section className="mlb-context-card mlb-win-predictor"><header><h2>Win predictor</h2><small>Pregame</small></header>{state.available&&away&&home?<><div className="mlb-win-body">{[away,home].map((t,i)=><React.Fragment key={t.id}>{i===1&&<div className="mlb-win-ring" role="img" aria-label={`${away.name} ${away.percent}%, ${home.name} ${home.percent}%`} style={{background:`conic-gradient(#8c8c8c 0% ${away.percent}%, #f2f2f2 ${away.percent}% 100%)`}}><span>WIN<br/>CHANCE</span></div>}<div className="mlb-win-team">{t.logo&&<img src={t.logo} alt="" width="32" height="32"/>}<strong>{t.abbr}</strong><small>{t.record||'Record unavailable'}{i===1?' · Home':''}</small><b>{t.percent.toFixed(1)}%</b></div></React.Fragment>)}</div></>:<p className="mlb-context-note" role="status">{state.loading?'Checking matchup prediction…':'Matchup prediction is not available yet.'}</p>}</section>;
}
