import { Crosshair, Layers2 as BarChart3, Ticket as ClipboardList, TicketPercent, Radar as FlaskConical, ScanLine, Compass as Search, Sparkles, SearchCheck, Trophy, CircleDot, MessagesSquare, ShieldCheck, Activity, Bot, NotebookTabs, ImageUp, ChartNoAxesCombined } from 'lucide-react';

// Single source of truth for the site's primary navigation destinations,
// shared by the top pill bar (VortexTopTabs) and the computer top bar (TopBar)
// so the two can never drift apart on where a tab actually goes.
export const topTabs = [
  { title: 'Finder', icon: SearchCheck, value: 'finder' },
  { title: 'Scout Assistant', icon: Bot, value: 'bot' },
  { title: 'Cheat Sheets', icon: NotebookTabs, value: 'sheets' },
  { title: 'Line Moves', icon: Activity, value: 'moves' },
  { title: 'Promo Board', icon: TicketPercent, value: 'promos' },
  { title: 'My Bets', icon: ChartNoAxesCombined, value: 'bets' },
  { title: 'Research', icon: Search, value: 'research' },
  { title: 'Tools', icon: FlaskConical, value: 'slate' },
  { title: 'Props', icon: BarChart3, value: 'v2' },
  { title: 'Game Predictor', icon: Crosshair, value: 'predictor' },
  { title: 'Parlay', icon: Sparkles, value: 'builder' },
  { title: 'Slip Analyzer', icon: ScanLine, value: 'slip' },
  { title: 'Slip to PrizePicks', icon: ImageUp, value: 'export' },
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
