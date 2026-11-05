import React from 'react';

// The phone dock's own icons (MobileNavigation.jsx), drawn on one 24px grid
// with the same stroke so they read as a set. Each is outlined until its
// tab is the one showing, then filled in the member's color with its inner
// marks cut out in the dock's own dark, the way a phone app's tab bar does.

const INK = {stroke: 'var(--dock-ink, #141414)'};
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
  // A slip in the scanner's corners, a check on it: the Slip Analyzer.
  analyzer: active => <>
    <path d="M4 8.5V6.5A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2"/>
    <rect x="7.5" y="7.5" width="9" height="9" rx="2" fill={fill(active)}/>
    <path d="m10 12 1.5 1.5L14 10.5" style={active ? INK : undefined}/>
  </>,
  // A speech bubble with a spark: the assistant.
  assistant: active => <>
    <path d="M6.5 4.5h11A2.5 2.5 0 0 1 20 7v7.5a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.5V17h-1A2.5 2.5 0 0 1 4 14.5V7a2.5 2.5 0 0 1 2.5-2.5Z" fill={fill(active)}/>
    <path d="M12 7.5v5M9.5 10h5" style={active ? INK : undefined}/>
  </>,
  // A line rising, a line falling: line moves.
  moves: active => <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill={fill(active)}/>
    <path d="M9 16.5v-9m-2.5 2.5L9 7.5l2.5 2.5M15 7.5v9m-2.5-2.5 2.5 2.5 2.5-2.5" style={active ? INK : undefined}/>
  </>,
  // Three picks stacked into one slip: the Parlay Builder.
  builder: active => <>
    <path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" fill={fill(active)}/>
    <path d="m3.5 12 8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>
  </>,
  // A page with its lines: the cheat sheets.
  sheets: active => <>
    <path d="M7 3.5h6.5L19 9v9a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 18V6a2.5 2.5 0 0 1 2-2.5Z" fill={fill(active)}/>
    <path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h5" style={active ? INK : undefined}/>
  </>,
  // A price tag: the promo board.
  promos: active => <>
    <path d="M3.5 11.6V5.5a2 2 0 0 1 2-2h6.1a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.8l-6.1 6.1a2 2 0 0 1-2.8 0l-7.4-7.4a2 2 0 0 1-.6-1.4Z" fill={fill(active)}/>
    <circle cx="8.5" cy="8.5" r="1.5" style={active ? INK : undefined}/>
  </>,
  // A baseball, its seams: NRFI / YRFI.
  nrfi: active => <>
    <circle cx="12" cy="12" r="8.5" fill={fill(active)}/>
    <path d="M7.5 4.8a10 10 0 0 1 0 14.4M16.5 4.8a10 10 0 0 0 0 14.4" style={active ? INK : undefined}/>
  </>,
  // Two sliders: the tools.
  tools: active => <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill={fill(active)}/>
    <path d="M8 9h8M8 15h8" style={active ? INK : undefined}/>
    <circle cx="10" cy="9" r="1.6" style={active ? INK : undefined}/>
    <circle cx="14" cy="15" r="1.6" style={active ? INK : undefined}/>
  </>,
  // Two people: the community.
  community: active => <>
    <circle cx="9" cy="8.5" r="3.5" fill={fill(active)}/>
    <path d="M3 19.5a6 6 0 0 1 12 0" fill={fill(active)}/>
    <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14a6 6 0 0 1 3.5 5.5"/>
  </>,
  // A slip with an arrow leaving it: Slip to PrizePicks.
  export: active => <>
    <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h5M5 7.5v9A2.5 2.5 0 0 0 7.5 19h9a2.5 2.5 0 0 0 2.5-2.5v-5" />
    <rect x="5" y="5" width="14" height="14" rx="2.5" fill={active ? 'currentColor' : 'none'} stroke="none"/>
    <path d="M13 11l6.5-6.5M15 4.5h4.5V9" style={active ? INK : undefined}/>
  </>,
  // A line climbing out of a box: My Bets.
  bets: active => <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill={fill(active)}/>
    <path d="M7.5 15.5l3-3.5 2.5 2 3.5-5" style={active ? INK : undefined}/>
  </>,
  // A target with its center filled: the Game Predictor.
  predictor: active => <>
    <circle cx="12" cy="12" r="8.5"/>
    <circle cx="12" cy="12" r="4.5" fill={fill(active)}/>
    <path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/>
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
    {(ICONS[name] || ICONS.more)(Boolean(active))}
  </svg>;
}
