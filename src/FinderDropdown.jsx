import React,{createContext,useContext} from 'react';
import {Select,SelectTrigger,SelectContent,SelectItem,SelectLabel} from '../components/ui/select';

export const FinderDropdownAssets=createContext({});
function OptionLabel({text,logo}){
 return <span className="finder-option-label">{logo&&<img src={logo} alt="" decoding="async" onError={e=>{e.currentTarget.hidden=true;}}/>}<span>{text}</span></span>;
}
// An option may carry data-group (a heading shown above the first option of
// each group) and data-display (what the closed menu shows when it's picked).
export function FinderDropdown({value,onChange,children,'aria-label':label}){
 const assets=useContext(FinderDropdownAssets);
 const options=React.Children.toArray(children).filter(React.isValidElement).map(child=>({value:String(child.props.value??child.props.children),text:child.props.children,group:child.props['data-group'],display:child.props['data-display']}));
 const selected=options.find(option=>option.value===String(value))||options[0];
 const logoFor=key=>assets[label]?.[key];
 return <div className="finder-custom-select"><Select value={String(value)} onValueChange={next=>onChange({target:{value:next}})}><SelectTrigger aria-label={label} className="finder-select-trigger" displayValue={selected&&<OptionLabel text={selected.display||selected.text} logo={logoFor(selected.value)}/>}/><SelectContent className="finder-select-menu">{options.map((option,index)=><React.Fragment key={option.value}>{option.group&&option.group!==options[index-1]?.group&&<SelectLabel className="finder-select-group">{option.group}</SelectLabel>}<SelectItem index={index} value={option.value} aria-label={String(option.display||option.text)} className="finder-select-option"><OptionLabel text={option.text} logo={logoFor(option.value)}/></SelectItem></React.Fragment>)}</SelectContent></Select></div>;
}
