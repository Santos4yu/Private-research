import React from 'react';
import {Activity,HeartPulse,ListOrdered,Shield,Target,Trophy,Users} from 'lucide-react';

export const RESEARCH_TABS=[['matchup','Matchup',Trophy],['defense','Defense',Shield],['shooting','Shooting',Target],['similar','Similar',Users],['injuries','Injuries',HeartPulse],['rankings','Rankings',ListOrdered]];
export function FinderResearchTabs({tab,onChange}){
 return <nav className="mlb-context-tabs" aria-label="Research sections">{RESEARCH_TABS.map(([key,label,Icon])=><button key={key} data-section={key} type="button" aria-pressed={tab===key} onClick={()=>onChange(key)}><Icon size={18} aria-hidden="true"/>{label}</button>)}</nav>;
}
export function FinderResearchCard({title,note,children,icon:Icon=Activity,className=''}){
 return <section className={'mlb-context-card '+className}><header><h2><Icon size={16} aria-hidden="true"/>{title}</h2>{note&&<small>{note}</small>}</header>{children}</section>;
}
