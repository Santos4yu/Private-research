import React from 'react';

// The phone dock's own icons (MobileNavigation.jsx), drawn on one 24px grid
// with the same stroke so they read as a set. Each is outlined until its
// tab is the one showing, then filled in the member's color with its inner
// marks cut out in the dock's own dark, the way a phone app's tab bar does.

const INK = {stroke: 'var(--dock-ink, #111418)'};
const fill = active => (active ? 'currentColor' : 'none');

const ICONS = {
  // A lens over three bars: finding the numbers.
  finder: active => <>
    <circle cx="10.5" cy="10.5" r="6.5" fill={fill(active)}/>
    <path d="m15.4 15.4 4.6 4.6"/>
    <path d="M8 12.6v-1.4M10.5 12.6V8.4M13 12.6v-2.6" style={active ? INK : undefined}/>
  </>,
  // A rising line on its axes, the space under it shaded when showing.
  research: active => <>
    {active && <path d="M7.5 15 11 11.5l3 2.5 5-6V20H7.5Z" fill="currentColor" stroke="none" opacity=".35"/>}
    <path d="M4 4v16h16"/>
    <path d="M7.5 15 11 11.5l3 2.5 5-6"/>
  </>,
  // A prop card with another behind it.
  props: active => <>
    <path d="M8.5 4.5h8A2.5 2.5 0 0 1 19 7v9"/>
    <rect x="4.5" y="7.5" width="11.5" height="13" rx="2.5" fill={fill(active)}/>
    <path d="M7.5 12.5H13M7.5 16H11" style={active ? INK : undefined}/>
  </>,
  // A ticket, notched on both sides, torn along the dotted line.
  slip: active => <>
    <path d="M4 8a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 8v1.6a2.4 2.4 0 0 0 0 4.8V16a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16v-1.6a2.4 2.4 0 0 0 0-4.8Z" fill={fill(active)}/>
    <path d="M14.5 8v1.3M14.5 11.35v1.3M14.5 14.7V16" style={active ? INK : undefined}/>
  </>,
  // Three tiles and a dot: everything else.
  more: active => <>
    <rect x="4" y="4" width="6.5" height="6.5" rx="2" fill={fill(active)}/>
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="2" fill={fill(active)}/>
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="2" fill={fill(active)}/>
    <circle cx="16.75" cy="16.75" r="3.25" fill={fill(active)}/>
  </>,
};

export function DockIcon({name, active}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name](Boolean(active))}
  </svg>;
}
