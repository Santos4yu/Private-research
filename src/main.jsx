import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layers2 as BarChart3, Ticket as ClipboardList, Radar as FlaskConical, ScanLine, Compass as Search, Sparkles, ShieldCheck, CircleDot, Trophy, LayoutGrid, Diamond, Crosshair, Target, ChartNoAxesCombined } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../components/ui/select';
import { MobileNavigation } from './MobileNavigation';
import { MobileSlipActions } from './MobileSlipActions';
import { ResearchHome } from './ResearchHome';
const SportResearch = lazy(() => import('./sports/nfl/SportResearch').then(module => ({ default: module.SportResearch })));
import { ExpandableTabs } from '../components/ui/expandable-tabs';
import { ResearchAILoader } from '../components/ui/research-ai-loader';
import { ActivityDropdown } from '../components/ui/activity-dropdown';
import './landing.css';
import './tailwind.css';
import './expandable-tabs.css';
import './ai-loader.css';
import './activity-dropdown.css';
import './mobile-app.css';
import './sports-app.css';
import './report-tabs.css';
import './research-cards.css';
import './builder-app.css';
import './pitcher-finder.css';
import './accent-studio.css';
import './gamelog-fix.css';
import './research-polish.css';
import './prop-finder.css';
import './sports/nfl/nfl-research.css';
import './community-feed.css';
import './vortex-sidebar.css';

import { topTabs } from './navTabs';
import { VortexSidebar } from './VortexSidebar';

function VortexTopTabs() {
  const [tab, setTab] = useState('research');
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    const sync = (event) => {
      setTab(event.detail?.tab || 'research');
      setSaved(event.detail?.saved ?? 0);
    };
    window.addEventListener('vortex:dock-sync', sync);
    window.dispatchEvent(new Event('vortex:dock-ready'));
    return () => window.removeEventListener('vortex:dock-sync', sync);
  }, []);

  const tabs = topTabs.map((item) => item.value === 'saved'
    ? { ...item, badge: saved > 0 ? <span className="tab-count" aria-label={`${saved} saved props`}>{saved}</span> : null }
    : item);
  const selectedIndex = tabs.findIndex((item) => item.value === tab);

  return (
    <ExpandableTabs
      tabs={tabs}
      selectedIndex={selectedIndex < 0 ? 0 : selectedIndex}
      collapseOnOutside={false}
      className="vortex-expandable-tabs"
      onChange={(index) => {
        if (index == null) return;
        const selected = tabs[index];
        if (selected && selected.type !== 'separator') {
          window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: selected.value } }));
        }
      }}
    />
  );
}

const dockRoot = document.getElementById('dock-root');
if (dockRoot) createRoot(dockRoot).render(<MobileNavigation />);
const tabsRoot = document.getElementById('tabs');
if (tabsRoot) createRoot(tabsRoot).render(<VortexTopTabs />);
const sidebarRoot = document.getElementById('sidebar-root');
if (sidebarRoot) createRoot(sidebarRoot).render(<VortexSidebar />);
const builderDropdownRoot = document.getElementById('prop-builder-dropdown-root');
if (builderDropdownRoot) createRoot(builderDropdownRoot).render(<ActivityDropdown />);
const mobileSlipRoot = document.getElementById('mobile-slip-actions-root');
if (mobileSlipRoot) createRoot(mobileSlipRoot).render(<MobileSlipActions />);
const researchHomeRoot = document.getElementById('research-home-root');

const sportResearchRoot = document.getElementById('sport-research-root');
let privateRoots=null;
function mountPrivateResearch(granted){
 if(granted&&!privateRoots){
  privateRoots={home:researchHomeRoot?createRoot(researchHomeRoot):null,sport:sportResearchRoot?createRoot(sportResearchRoot):null};
  privateRoots.home?.render(<ResearchHome/>);
  privateRoots.sport?.render(<Suspense fallback={<div role="status">Loading sport research…</div>}><SportResearch/></Suspense>);
 }else if(!granted&&privateRoots){privateRoots.home?.unmount();privateRoots.sport?.unmount();privateRoots=null;}
}
window.addEventListener('vortex:site-policy',event=>mountPrivateResearch(event.detail.accessGranted));
mountPrivateResearch(document.documentElement.dataset.siteAccess==='granted');

const menuIcons = { research: Search, slate: FlaskConical, v2: BarChart3, saved: ClipboardList, builder: Sparkles, slip: ScanLine, moneyline: Trophy, nrfi: CircleDot, admin: ShieldCheck };
document.querySelectorAll('.side-link').forEach((button) => {
  const MenuIcon = menuIcons[button.dataset.tab];
  if (!MenuIcon) return;
  [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => node.remove());
  const iconHost = document.createElement('span');
  iconHost.className = 'side-link-icon';
  iconHost.setAttribute('aria-hidden', 'true');
  button.prepend(iconHost);
  createRoot(iconHost).render(<MenuIcon size={21} strokeWidth={1.8} />);
});

const filterIcons = { all: LayoutGrid, hrr: BarChart3, 'total-bases': Diamond, hits: CircleDot, strikeouts: Target, matchup: Crosshair };
document.querySelectorAll('[data-board-filter]').forEach((button) => {
  button.setAttribute('aria-pressed', String(button.classList.contains('active')));
  const FilterIcon = filterIcons[button.dataset.boardFilter];
  if (!FilterIcon) return;
  const iconHost = document.createElement('span');
  iconHost.className = 'props-filter-icon';
  iconHost.setAttribute('aria-hidden', 'true');
  button.prepend(iconHost);
  createRoot(iconHost).render(<FilterIcon size={18} strokeWidth={1.8} />);
});

window.vortexMountResearchLoader = (host, props) => {
  const root = createRoot(host);
  root.render(<ResearchAILoader {...props} />);
  return () => root.unmount();
};

// Bridges the MLB "select a stat" picker into the new Select component.
// The hidden native <select id="profile-stats"> stays the real value/
// change-event source everything else in app.js reads and writes -- this
// only owns the visual dropdown, imperatively driven from vanilla via the
// returned {setOptions,setValue} controller (app.js has no reactive state
// of its own to hand this a live `options`/`value` prop).
function StatSelectHost({ controllerRef, onPick }) {
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState('');
  // Assigned during render, not inside useEffect: an effect only runs after
  // the browser has painted, which is too late if app.js calls setOptions()
  // in the same synchronous pass right after mounting this (as it does on
  // the very first player selected). React's initial root.render() commits
  // synchronously, so this ref is already live the instant render() returns.
  controllerRef.current = { setOptions, setValue };
  return (
    <Select value={value} onValueChange={(next) => { setValue(next); onPick(next); }}>
      <SelectTrigger icon={ChartNoAxesCombined} placeholder="Select a stat" aria-label="Select a stat" />
      <SelectContent>
        {options.map((stat, index) => <SelectItem key={stat} index={index} value={stat}>{stat}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

window.vortexMountStatSelect = (host, { onPick }) => {
  const controllerRef = { current: null };
  createRoot(host).render(<StatSelectHost controllerRef={controllerRef} onPick={onPick} />);
  return {
    setOptions: (list) => controllerRef.current?.setOptions(list),
    setValue: (v) => controllerRef.current?.setValue(v),
  };
};
const statSelectRoot = document.getElementById('profile-stats-select-root');
if (statSelectRoot) {
  window.vortexStatSelect = window.vortexMountStatSelect(statSelectRoot, {
    onPick: (value) => {
      const nativeSelect = document.getElementById('profile-stats');
      if (nativeSelect && nativeSelect.value !== value) {
        nativeSelect.value = value;
        nativeSelect.dispatchEvent(new Event('change'));
      }
    },
  });
}

// A tiny image "icon" shaped like a LucideIcon (accepts size/strokeWidth,
// ignores what it doesn't need) so the PrizePicks/goblin/demon art can ride
// along in SelectTrigger's single icon slot the same way a lucide icon would.
function imageIcon(src, label = '') {
  const IconFromImage = ({ size = 16 }) => <img src={src} width={size} height={size} alt={label} />;
  return IconFromImage;
}
const PP_LOGO_ICON = imageIcon('/prizepicks/logo.png', 'PrizePicks');
const PP_TIER_ICON = { GOBLIN: imageIcon('/prizepicks/goblin.png', 'Goblin'), DEMON: imageIcon('/prizepicks/demon.png', 'Demon') };

// Bridges the MLB "PrizePicks lines" alt-line picker into the same Select
// component -- same reasoning as StatSelectHost above: app.js keeps owning
// the fetch/cache/eligibility logic (loadPrizePicksLines in app.js) and just
// hands this bridge a ready-to-render list plus the current line/status.
function AltLinesSelectHost({ controllerRef, onPick }) {
  const [lines, setLines] = useState([]);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('loading');
  controllerRef.current = { setLines, setValue, setStatus };
  const current = lines.find((line) => String(line.value) === value);
  const placeholder = status === 'loading' ? 'Loading lines…' : status === 'error' ? 'Lines unavailable' : 'PrizePicks lines';
  return (
    <Select value={value} onValueChange={onPick} disabled={status !== 'ready'}>
      <SelectTrigger icon={current ? (PP_TIER_ICON[current.tier] ?? PP_LOGO_ICON) : PP_LOGO_ICON} placeholder={placeholder} aria-label="PrizePicks lines" />
      <SelectContent>
        {lines.map((line, index) => {
          const TierIcon = PP_TIER_ICON[line.tier];
          return (
            <SelectItem key={line.value} index={index} value={String(line.value)}>
              <span className="pp-select-line-row">
                <span>{line.value}</span>
                <img src="/prizepicks/logo.png" width={14} height={14} alt="" />
                {TierIcon && <TierIcon size={14} />}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

window.vortexMountAltLinesSelect = (host, { onPick }) => {
  const controllerRef = { current: null };
  createRoot(host).render(<AltLinesSelectHost controllerRef={controllerRef} onPick={onPick} />);
  return {
    setLines: (list) => controllerRef.current?.setLines(list),
    setValue: (v) => controllerRef.current?.setValue(v),
    setStatus: (s) => controllerRef.current?.setStatus(s),
  };
};
const ppLinesSelectRoot = document.getElementById('pp-lines-select-root');
if (ppLinesSelectRoot) {
  window.vortexAltLinesSelect = window.vortexMountAltLinesSelect(ppLinesSelectRoot, {
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:pp-line-pick', { detail: { value: Number(value) } })),
  });
}
