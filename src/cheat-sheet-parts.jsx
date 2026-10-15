import React,{useEffect,useMemo,useState} from 'react';
import {ArrowDown,ArrowUp,ChevronDown} from 'lucide-react';

// What the Cheat Sheets of every league share (CheatSheets.jsx for MLB,
// NflSheets.jsx for NFL): number formats, the sortable table that turns into
// cards on a phone, scores, tags and the questions at the foot of a sheet.

export const finite=value=>typeof value==='number'&&Number.isFinite(value);
export const nameKey=value=>String(value||'').normalize('NFKD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const pct=(value,digits=1)=>finite(value)?(value*100).toFixed(digits):'—';
export const num=(value,digits=1)=>finite(value)?(Number.isInteger(value)?String(value):value.toFixed(digits)):'—';
export const fixed=(value,digits=1)=>finite(value)?value.toFixed(digits):'—';
export const signed=(value,format)=>finite(value)?`${value>0?'+':value<0?'−':''}${format(Math.abs(value))}`:'—';
export const price=value=>finite(value)?(value>0?`+${value}`:String(value)):'—';
export const time=value=>{const date=new Date(value);return Number.isFinite(date.getTime())?date.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}):'';};
export const dayLabel=value=>{const date=new Date(`${value}T12:00:00`);return Number.isFinite(date.getTime())?date.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}):'';};
export const tone=score=>!finite(score)?'none':score>=65?'high':score>=50?'mid':'low';
export const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase();
export function Img({src,className,alt=''}){
 const [failed,setFailed]=useState(false);
 if(!src||failed)return null;
 return <img className={className} src={src} alt={alt} loading="lazy" onError={()=>setFailed(true)}/>;
}
// A score: the number inside a ring filled to it, out of 100.
export const Score=({value,label})=><span className="cs-score" data-tone={tone(value)} title={label} style={{'--v':finite(value)?Math.max(0,Math.min(value,100))/100:0}}><b>{finite(value)?value:'—'}</b></span>;
// How many stats a card's strip puts on a row: rows of the same length
// where the count allows, and a short last row stretched to fill. Five
// go three and two: five across leaves no room for a word like "Receptions".
export const stripColumns=count=>count<=4?Math.max(count,1):count===5?3:count%4===0?4:count%3===0?3:count%5===0?5:4;
export const Tag=({tone:kind,icon:Icon,children})=><span className="cs-tag" data-tone={kind}>{Icon&&<Icon aria-hidden="true"/>}{children}</span>;
// Phones get cards instead of a wide table: nothing slides sideways.
export const PHONE='(max-width: 640px)';
export function usePhone(){
 const [phone,setPhone]=useState(()=>typeof window!=='undefined'&&window.matchMedia(PHONE).matches);
 useEffect(()=>{const query=window.matchMedia(PHONE),sync=()=>setPhone(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync);},[]);
 return phone;
}
export const show=(column,row)=>column.render?column.render(row):column.format?column.format(column.value(row),row):column.value(row);

// The column a sheet ranks by: its score, else the one it sorts by first.
const headlineOf=(columns,initial)=>columns.find(column=>column.key==='score')||columns.find(column=>column.key===initial?.key)||columns.at(-1);
const share=(column,row)=>{const value=column?.value?.(row);return finite(value)?Math.max(0,Math.min(value,100))/100:null;};

// The top three on a podium: second, first and third, each on its step,
// with the number the sheet ranks by.
// A sheet's pick column (the line itself) also shows under each name on the
// podium: on a sheet of props the line is what matters most.
const noteOf=columns=>columns.find(column=>column.key==='pick');
export function Podium({rows,who,note,headline,rowKey,open,onPick}){
 if(rows.length<3)return null;
 return <div className="lb-podium" aria-label="Top three">{[1,0,2].map(place=>{const row=rows[place],key=rowKey(row);
  return <button type="button" key={key} className="lb-step" data-place={place+1} data-open={open===key?'':undefined} aria-expanded={open===key} onClick={()=>onPick(key)}>
   <span className="lb-step-who">{show(who,row)}</span>
   {note&&<span className="lb-step-note">{show(note,row)}</span>}
   <span className="lb-step-value">{show(headline,row)}</span>
   <span className="lb-step-block" aria-hidden="true"><b>{place+1}</b></span>
  </button>;})}</div>;
}

// A sortable table: the first column stays put when the rest scroll sideways.
// On a phone the same rows are a leaderboard (Board).
export function Table({rows,columns,initial,empty,rowKey=row=>row.id,expand,moreLabel='Details'}){
 const [sort,setSort]=useState(initial||{key:columns.at(-1).key,dir:-1});
 const [open,setOpen]=useState(null);
 const [limit,setLimit]=useState(TABLE_PAGE);
 useEffect(()=>setLimit(TABLE_PAGE),[rows]);
 const phone=usePhone();
 const headline=useMemo(()=>headlineOf(columns,initial),[columns,initial]);
 const sorted=useMemo(()=>{
  const column=columns.find(item=>item.key===sort.key);
  if(!column?.value)return rows;
  return [...rows].sort((a,b)=>{const x=column.value(a),y=column.value(b);return (finite(x)?0:1)-(finite(y)?0:1)||((finite(x)&&finite(y))?(x-y)*sort.dir:0);});
 },[rows,sort,columns]);
 if(!rows.length)return <p className="cs-empty">{empty}</p>;
 const toggle=key=>setOpen(current=>current===key?null:key);
 if(phone)return <Board rows={sorted} columns={columns} headline={headline} sort={sort} setSort={setSort} rowKey={rowKey} expand={expand} moreLabel={moreLabel}/>;
 return <div className="lb-desk">
  <Podium rows={sorted} who={columns[0]} note={noteOf(columns)} headline={headline} rowKey={rowKey} open={open} onPick={toggle}/>
  <div className="cs-table-wrap"><table className="cs-table">
  <thead><tr><th className="cs-rank">#</th>{columns.map(column=><th key={column.key} className={column.className} data-sorted={sort.key===column.key?(sort.dir>0?'up':'down'):undefined}>
   {column.value?<button type="button" onClick={()=>setSort(current=>({key:column.key,dir:current.key===column.key?-current.dir:-1}))}>{column.label}{sort.key===column.key&&(sort.dir>0?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>)}</button>:column.label}
  </th>)}{expand&&<th aria-label="Details"/>}</tr></thead>
  <tbody>{sorted.slice(0,limit).map((row,index)=><React.Fragment key={rowKey(row)}>
   <tr data-open={open===rowKey(row)?'':undefined} data-place={index<3?index+1:undefined} onClick={expand?()=>toggle(rowKey(row)):undefined} style={{'--i':Math.min(index,20)}}>
    <td className="cs-rank"><span>{index+1}</span></td>
    {columns.map(column=><td key={column.key} className={column.className} data-tone={column.tone?.(row)||undefined} data-headline={column===headline?'':undefined}
     style={column===headline&&share(column,row)!=null?{'--v':share(column,row)}:undefined}>{show(column,row)}</td>)}
    {expand&&<td className="cs-chevron"><ChevronDown aria-hidden="true"/></td>}
   </tr>
   {expand&&open===rowKey(row)&&<tr className="cs-expand"><td colSpan={columns.length+2}>{expand(row)}</td></tr>}
  </React.Fragment>)}</tbody>
 </table>{sorted.length>limit&&<button type="button" className="cs-show-more cs-table-more" onClick={()=>setLimit(count=>count+TABLE_PAGE)}>Show more<small>{sorted.length-limit} left</small></button>}</div>
 </div>;
}

// The phone leaderboard: the top three on a podium, then everyone else in
// order with a big rank, the number the sheet ranks by (and a bar when it's
// a 0-100 score) and three key stats. A tap opens all of his numbers.
export const PAGE=20;
const TABLE_PAGE=40;
export function Board({rows,columns,headline,sort,setSort,rowKey,expand,moreLabel='Details'}){
 const [limit,setLimit]=useState(PAGE);
 const [open,setOpen]=useState(null);
 useEffect(()=>{setLimit(PAGE);setOpen(null);},[rows]);
 const [who,...rest]=columns;
 const stats=rest.filter(column=>column!==headline);
 const keys=stats.slice(0,3);
 const sortable=columns.filter(column=>column.value);
 const toggle=key=>setOpen(current=>current===key?null:key);
 const podium=rows.length>=3;
 const list=podium?rows.slice(3):rows;
 const picked=podium?rows.slice(0,3).find(row=>rowKey(row)===open):null;
 const detail=row=><div className="lb-detail">
  <dl className="cs-mstats" style={{'--cols':stripColumns(stats.length)}}>{stats.map(column=><div key={column.key} data-tone={column.tone?.(row)||undefined}><dt>{column.short||column.label}</dt><dd>{show(column,row)}</dd></div>)}</dl>
  {expand&&<div className="lb-more"><h5>{moreLabel}</h5>{expand(row)}</div>}
 </div>;
 return <div className="lb-board">
  {sortable.length>1&&<div className="cs-sortbar">
   <label><span>Rank by</span><select value={sort.key} onChange={event=>setSort({key:event.target.value,dir:-1})}>{sortable.map(column=><option key={column.key} value={column.key}>{column.label}</option>)}</select><ChevronDown aria-hidden="true"/></label>
   <button type="button" onClick={()=>setSort(current=>({...current,dir:-current.dir}))} aria-label={sort.dir>0?'Lowest first':'Highest first'}>{sort.dir>0?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>}{sort.dir>0?'Lowest':'Highest'}</button>
  </div>}
  {podium&&<Podium rows={rows} who={who} note={noteOf(columns)} headline={headline} rowKey={rowKey} open={open} onPick={toggle}/>}
  {picked&&<div className="lb-picked">{detail(picked)}</div>}
  <ol className="lb-rows">{list.slice(0,limit).map((row,index)=>{const key=rowKey(row),shown=open===key,bar=headline?.key==='score'?share(headline,row):null;
   return <li key={key} className="lb-row" data-open={shown?'':undefined} style={{'--i':Math.min(index,12)}}>
    <button type="button" className="lb-row-top" onClick={()=>toggle(key)} aria-expanded={shown}>
     <span className="lb-rank">{index+(podium?4:1)}</span>
     <span className="lb-row-who">{show(who,row)}</span>
     <span className="lb-row-value">{show(headline,row)}</span>
    </button>
    {bar!=null&&<span className="lb-bar" style={{'--v':bar}} aria-hidden="true"/>}
    <p className="lb-keys">{keys.map(column=><span key={column.key} data-tone={column.tone?.(row)||undefined}><small>{column.short||column.label}</small><b>{show(column,row)}</b></span>)}</p>
    {shown&&detail(row)}
   </li>;})}</ol>
  {list.length>limit&&<button type="button" className="cs-show-more" onClick={()=>setLimit(count=>count+PAGE)}>Show more<small>{list.length-limit} left</small></button>}
 </div>;
}
// Good-for-the-pick colouring against the league's typical value.
export const better=(value,low,high)=>!finite(value)?undefined:value>=high?'good':value<=low?'bad':undefined;
export function Faq({items}){
 const [open,setOpen]=useState(null);
 if(!items?.length)return null;
 return <section className="cs-faq"><h3>Questions</h3>{items.map(([question,answer],index)=><div key={question} className="cs-faq-item" data-open={open===index?'':undefined}>
  <button type="button" onClick={()=>setOpen(current=>current===index?null:index)} aria-expanded={open===index}>{question}<ChevronDown aria-hidden="true"/></button>
  {open===index&&<p>{answer}</p>}
 </div>)}</section>;
}
export const Skeleton=()=><div className="cs-skeleton" aria-label="Loading">{Array.from({length:8},(_,index)=><i key={index} style={{'--i':index}}/>)}</div>;
