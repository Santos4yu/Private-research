import React,{Suspense,lazy,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ScanSearch} from 'lucide-react';
import './analyze-prop.css';

// The Analyze button on a Finder player card, beside the hit-rate ring: the line on the chart graded
// the Slip Analyzer's way. The grading and its screens (AnalyzeProp.jsx)
// load the first time it's pressed.
const AnalyzeLayer=lazy(()=>import('./AnalyzeProp'));

// The sports Analyze grades: the Slip Analyzer's (slip-check.js SLIP_SPORTS).
export const ANALYZE_SPORTS=new Set(['mlb','nba','wnba','nfl','cfb','nhl','soccer']);

export function AnalyzeButton({row,line,playerRows=[]}){
 const [open,setOpen]=useState(false);
 const origin=useRef(null);
 const at=Number(line??row?.line);
 if(!row||!ANALYZE_SPORTS.has(row.sport)||!Number.isFinite(at))return null;
 const start=event=>{
  const box=event.currentTarget.getBoundingClientRect();
  origin.current={left:box.left,top:box.top,width:box.width,height:box.height};
  setOpen(true);
 };
 return <>
  <button type="button" className="ap-trigger" onClick={start} aria-haspopup="dialog"><ScanSearch size={15} strokeWidth={2.5} aria-hidden="true"/><span>Analyze</span></button>
  {open&&typeof document!=='undefined'&&createPortal(<Suspense fallback={<div className="ap-layer"><div className="ap-dim" style={{opacity:1}}/></div>}>
   <AnalyzeLayer row={row} line={at} playerRows={playerRows} origin={origin.current} onClose={()=>setOpen(false)}/></Suspense>,document.body)}
 </>;
}
