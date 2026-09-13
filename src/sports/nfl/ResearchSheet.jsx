import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,Check,X} from 'lucide-react';

let activeSheets=0;
let savedOverflow='';

export function ResearchSheet({open,onClose,title,children}) {
  const ref=useRef(null),id=useId();
  useEffect(()=>{
    if(!open)return;
    const trigger=document.activeElement,dialog=ref.current;
    if(activeSheets===0)savedOverflow=document.body.style.overflow;
    activeSheets++;
    document.body.style.overflow='hidden';
    dialog?.showModal();
    return ()=>{
      dialog?.close();
      activeSheets=Math.max(0,activeSheets-1);
      if(activeSheets===0)document.body.style.overflow=savedOverflow;
      if(trigger instanceof HTMLElement && trigger.isConnected)trigger.focus({preventScroll:true});
    };
  },[open]);
  if(!open)return null;
  return createPortal(<dialog ref={ref} className="nfl-research-sheet" aria-labelledby={id} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="nfl-sheet-inner"><div className="nfl-sheet-handle"/><header><h2 id={id}>{title}</h2><button type="button" aria-label={`Close ${title}`} onClick={onClose}><X size={20}/></button></header><div className="nfl-sheet-body">{children}</div></div></dialog>,document.body);
}

// Controlled app picker. No native select or operating-system option popup.
export function SheetSelect({value,onChange,children,disabled,label='Choose option',...rest}) {
  const [open,setOpen]=useState(false);
  const options=React.Children.toArray(children).filter(child=>React.isValidElement(child)&&child.type==='option').map(child=>({value:String(child.props.value??child.props.children),label:child.props.children,disabled:child.props.disabled}));
  const selected=options.find(option=>option.value===String(value));
  return <><button type="button" className="nfl-sheet-select" id={rest.id} disabled={disabled} aria-label={rest['aria-label']||label} aria-haspopup="dialog" aria-expanded={open} onClick={e=>{e.preventDefault();setOpen(true);}}><span>{selected?.label || 'Choose'}</span><ChevronDown size={16}/></button><ResearchSheet open={open} title={label} onClose={()=>setOpen(false)}><div className="nfl-sheet-options">{options.map(option=><button type="button" key={option.value} disabled={option.disabled} aria-pressed={String(value)===option.value} onClick={()=>{onChange?.({target:{value:option.value}});setOpen(false);}}><span>{option.label}</span>{String(value)===option.value&&<Check size={19}/>}</button>)}</div></ResearchSheet></>;
}
