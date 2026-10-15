import React from 'react';
import {FOCUS_TAG} from './prop-focus';

// The small tag on a research row that decides the line being looked at
// (prop-focus.js): "Your line" on its own stat, "Related" on what feeds it.
export default function PropFocusTag({focus}){
 return focus?<em className="prop-focus-tag" data-focus={focus}>{FOCUS_TAG[focus]}</em>:null;
}
