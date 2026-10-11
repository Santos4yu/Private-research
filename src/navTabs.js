import { Layers2 as BarChart3, Ticket as ClipboardList, Radar as FlaskConical, ScanLine, Compass as Search, Sparkles, SearchCheck, Trophy, CircleDot, MessagesSquare, ShieldCheck, Activity, Bot, NotebookTabs } from 'lucide-react';

// Single source of truth for the site's primary navigation destinations,
// shared by the top pill bar (VortexTopTabs) and the sidebar (VortexSidebar)
// so the two can never drift apart on where a tab actually goes.
export const topTabs = [
  { title: 'Finder', icon: SearchCheck, value: 'finder' },
  { title: 'Ace Assistant', icon: Bot, value: 'bot' },
  { title: 'Cheat Sheets', icon: NotebookTabs, value: 'sheets' },
  { title: 'Line Moves', icon: Activity, value: 'moves' },
  { title: 'Research', icon: Search, value: 'research' },
  { title: 'Tools', icon: FlaskConical, value: 'slate' },
  { title: 'Props', icon: BarChart3, value: 'v2' },
  { title: 'Parlay', icon: Sparkles, value: 'builder' },
  { title: 'Slip Analyzer', icon: ScanLine, value: 'slip' },
  { type: 'separator' },
  { title: 'Builder', icon: ClipboardList, value: 'saved' },
];

// Destinations that have no place in the rail or the phone dock and are
// reached from the side panel's menu (SideMenu.jsx) instead, below the
// topTabs above.
export const moreTabs = [
  { title: 'NRFI / YRFI', icon: CircleDot, value: 'nrfi' },
  { title: 'Community', icon: MessagesSquare, value: 'community' },
];

// Listed only for an admin session, under their own heading.
export const adminTabs = [
  { title: 'Moneylines', icon: Trophy, value: 'moneyline' },
  { title: 'Admin', icon: ShieldCheck, value: 'admin' },
];
