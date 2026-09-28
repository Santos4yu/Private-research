import { Layers2 as BarChart3, Ticket as ClipboardList, Radar as FlaskConical, ScanLine, Compass as Search, Sparkles, SearchCheck, Trophy, CircleDot, MessagesSquare, ShieldCheck } from 'lucide-react';

// Single source of truth for the site's primary navigation destinations,
// shared by the top pill bar (VortexTopTabs) and the sidebar (VortexSidebar)
// so the two can never drift apart on where a tab actually goes.
export const topTabs = [
  { title: 'Research', icon: Search, value: 'research' },
  { title: 'Finder', icon: SearchCheck, value: 'finder' },
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
  { title: 'Moneylines', icon: Trophy, value: 'moneyline' },
  { title: 'NRFI / YRFI', icon: CircleDot, value: 'nrfi' },
  { title: 'Community', icon: MessagesSquare, value: 'community' },
  { title: 'Admin', icon: ShieldCheck, value: 'admin' },
];
