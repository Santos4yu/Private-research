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
export const Score=({value,label})=><span className="cs-score" data-tone={tone(value)} title={label}><b>{finite(value)?value:'—'}</b><i style={{'--v':finite(value)?Math.max(0,Math.min(value,100))/100:0}}/></span>;
export const Tag=({tone:kind,icon:Icon,children})=><span className="cs-tag" data-tone={kind}>{Icon&&<Icon aria-hidden="true"/>}{children}</span>;
// Phones get cards instead of a wide table: nothing slides sideways.
export const PHONE='(max-width: 640px)';
export function usePhone(){
 const [phone,setPhone]=useState(()=>typeof window!=='undefined'&&window.matchMedia(PHONE).matches);
 useEffect(()=>{const query=window.matchMedia(PHONE),sync=()=>setPhone(query.matches);sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync);},[]);
 return phone;
}
export const show=(column,row)=>column.render?column.render(row):column.format?column.format(column.value(row),row):column.value(row);

// A sortable table: the first column stays put when the rest scroll sideways.
export function Table({rows,columns,initial,empty,rowKey=row=>row.id,expand,moreLabel='Details'}){
 const [sort,setSort]=useState(initial||{key:columns.at(-1).key,dir:-1});
 const [open,setOpen]=useState(null);
 const [limit,setLimit]=useState(TABLE_PAGE);
 useEffect(()=>setLimit(TABLE_PAGE),[rows]);
 const phone=usePhone();
 const sorted=useMemo(()=>{
  const column=columns.find(item=>item.key===sort.key);
  if(!column?.value)return rows;
  return [...rows].sort((a,b)=>{const x=column.value(a),y=column.value(b);return (finite(x)?0:1)-(finite(y)?0:1)||((finite(x)&&finite(y))?(x-y)*sort.dir:0);});
 },[rows,sort,columns]);
 if(!rows.length)return <p className="cs-empty">{empty}</p>;
 const toggle=key=>setOpen(current=>current===key?null:key);
 if(phone)return <Cards rows={sorted} columns={columns} sort={sort} setSort={setSort} rowKey={rowKey} expand={expand} open={open} toggle={toggle} moreLabel={moreLabel}/>;
 return <div className="cs-table-wrap"><table className="cs-table">
  <thead><tr><th className="cs-rank">#</th>{columns.map(column=><th key={column.key} className={column.className} data-sorted={sort.key===column.key?(sort.dir>0?'up':'down'):undefined}>
   {column.value?<button type="button" onClick={()=>setSort(current=>({key:column.key,dir:current.key===column.key?-current.dir:-1}))}>{column.label}{sort.key===column.key&&(sort.dir>0?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>)}</button>:column.label}
  </th>)}{expand&&<th aria-label="Details"/>}</tr></thead>
  <tbody>{sorted.slice(0,limit).map((row,index)=><React.Fragment key={rowKey(row)}>
   <tr data-open={open===rowKey(row)?'':undefined} onClick={expand?()=>toggle(rowKey(row)):undefined} style={{'--i':Math.min(index,20)}}>
    <td className="cs-rank">{index+1}</td>
    {columns.map(column=><td key={column.key} className={column.className} data-tone={column.tone?.(row)||undefined}>{show(column,row)}</td>)}
    {expand&&<td className="cs-chevron"><ChevronDown aria-hidden="true"/></td>}
   </tr>
   {expand&&open===rowKey(row)&&<tr className="cs-expand"><td colSpan={columns.length+2}>{expand(row)}</td></tr>}
  </React.Fragment>)}</tbody>
 </table>{sorted.length>limit&&<button type="button" className="cs-show-more cs-table-more" onClick={()=>setLimit(count=>count+TABLE_PAGE)}>Show more<small>{sorted.length-limit} left</small></button>}</div>;
}

// The same rows as cards: who on top with their score, every stat in a grid
// under them, and a sort picker in place of the column headers.
export const PAGE=20;
const TABLE_PAGE=40;
export function Cards({rows,columns,sort,setSort,rowKey,expand,open,toggle,moreLabel='Details'}){
 const [limit,setLimit]=useState(PAGE);
 useEffect(()=>setLimit(PAGE),[rows]);
 const [who,...rest]=columns;
 const score=rest.at(-1)?.key==='score'?rest.at(-1):null;
 const stats=score?rest.slice(0,-1):rest;
 const sortable=columns.filter(column=>column.value);
 return <div className="cs-cards">
  {sortable.length>1&&<div className="cs-sortbar">
   <label><span>Sort by</span><select value={sort.key} onChange={event=>setSort({key:event.target.value,dir:-1})}>{sortable.map(column=><option key={column.key} value={column.key}>{column.label}</option>)}</select><ChevronDown aria-hidden="true"/></label>
   <button type="button" onClick={()=>setSort(current=>({...current,dir:-current.dir}))}>{sort.dir>0?<ArrowUp aria-hidden="true"/>:<ArrowDown aria-hidden="true"/>}{sort.dir>0?'Low to high':'High to low'}</button>
  </div>}
  {rows.slice(0,limit).map((row,index)=>{const key=rowKey(row),shown=open===key;return <article key={key} className="cs-mcard" data-open={shown?'':undefined} style={{'--i':Math.min(index,12)}}>
   <header onClick={expand?()=>toggle(key):undefined}>
    <span className="cs-mcard-rank">{index+1}</span>
    <div className="cs-mcard-who">{show(who,row)}</div>
    {score&&<div className="cs-mcard-score">{show(score,row)}</div>}
   </header>
   <dl className="cs-mstats">{stats.map(column=><div key={column.key} data-tone={column.tone?.(row)||undefined}><dt>{column.short||column.label}</dt><dd>{show(column,row)}</dd></div>)}</dl>
   {expand&&<button type="button" className="cs-mcard-more" onClick={()=>toggle(key)} aria-expanded={shown}>{shown?'Less':moreLabel}<ChevronDown aria-hidden="true"/></button>}
   {expand&&shown&&<div className="cs-mcard-detail">{expand(row)}</div>}
  </article>;})}
  {rows.length>limit&&<button type="button" className="cs-show-more" onClick={()=>setLimit(count=>count+PAGE)}>Show more<small>{rows.length-limit} left</small></button>}
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
