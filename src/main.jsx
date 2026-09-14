import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layers2 as BarChart3, Ticket as ClipboardList, Radar as FlaskConical, ScanLine, Compass as Search, Sparkles, ShieldCheck, CircleDot, Trophy, LayoutGrid, Diamond, Crosshair, Target } from 'lucide-react';
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

const topTabs = [
  { title: 'Research', icon: Search, value: 'research' },
  { title: 'Tools', icon: FlaskConical, value: 'slate' },
  { title: 'Props', icon: BarChart3, value: 'v2' },
  { title: 'Parlay', icon: Sparkles, value: 'builder' },
  { title: 'Slip Analyzer', icon: ScanLine, value: 'slip' },
  { type: 'separator' },
  { title: 'Builder', icon: ClipboardList, value: 'saved' },
];

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
