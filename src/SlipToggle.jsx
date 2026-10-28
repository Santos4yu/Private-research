// Save a Props tab line to the slip (the Pick Builder, app.js savedProps)
// or take it off again (Oct 28, the owner: "add a button to save a prop to
// our bet slip"). The Props tab grades Overs, so a line goes on as More; the
// Pick Builder can still switch it. One `useSlipIds` per page (each one asks
// app.js for the slip), the ids handed down to every button.
import React,{useMemo} from 'react';
import {Check,Plus} from 'lucide-react';
import {finderSlipId,finderSlipProp} from './unified-finder-data';
import {pickBuilder,usePickBuilder} from './pick-builder-client';
import './slip-toggle.css';

/** The ids of the picks on the slip now. */
export function useSlipIds(){
 const builder=usePickBuilder();
 return useMemo(()=>new Set(builder.legs.map(leg=>String(leg.id))),[builder.legs]);
}

/** `full` adds the words; `stat` names the line for screen readers. */
export function SlipToggle({row,saved,full,stat,className=''}){
 const id=finderSlipId(row),on=saved.has(id);
 const what=`${row.player} more ${row.line}${stat?` ${stat}`:''}`;
 const toggle=event=>{
  event.stopPropagation();
  if(on)pickBuilder.remove(id);else pickBuilder.set(finderSlipProp(row),'Over');
 };
 return <button type="button" className={`slip-toggle ${className}`.trim()} data-on={on||undefined} data-full={full||undefined} aria-pressed={on} onClick={toggle}
  aria-label={on?`Take ${what} off your slip`:`Save ${what} to your slip`} title={on?'On your slip':'Save to slip'}>
  {on?<Check size={full?16:15} strokeWidth={2.6} aria-hidden="true"/>:<Plus size={full?16:15} strokeWidth={2.6} aria-hidden="true"/>}
  {full&&<span>{on?'On your slip':'Save to slip'}</span>}
 </button>;
}
