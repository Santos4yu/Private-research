import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, ClipboardList, FlaskConical, Search, Sparkles } from 'lucide-react';
import Dock from './Dock';
import { ExpandableTabs } from '../components/ui/expandable-tabs';
import { ResearchAILoader } from '../components/ui/research-ai-loader';
import { ActivityDropdown } from '../components/ui/activity-dropdown';
import './landing.css';
import './tailwind.css';
import './expandable-tabs.css';
import './ai-loader.css';
import './activity-dropdown.css';

const Icon = ({ children }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{children}</svg>;
const icons = {
  research: <Icon><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></Icon>,
  slate: <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Icon>,
  v2: <Icon><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></Icon>,
  builder: <Icon><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" strokeLinejoin="round"/></Icon>,
  saved: <Icon><path d="M5 5h14M5 12h14M5 19h9" strokeLinecap="round"/><circle cx="19" cy="19" r="2"/></Icon>,
};

function VortexDock() {
  const [tab, setTab] = useState('research');
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    const sync = (event) => { setTab(event.detail?.tab || 'research'); setSaved(event.detail?.saved ?? 0); };
    window.addEventListener('vortex:dock-sync', sync);
    return () => window.removeEventListener('vortex:dock-sync', sync);
  }, []);
  useEffect(() => { window.dispatchEvent(new Event('vortex:dock-ready')); }, []);
  const items = ['research', 'slate', 'v2', 'builder', 'saved'].map((key) => ({
    label: key === 'v2' ? 'Props' : key === 'builder' ? 'Parlay' : key === 'saved' ? 'Builder' : key[0].toUpperCase() + key.slice(1),
    className: tab === key ? 'active' : '',
    onClick: () => window.dispatchEvent(new CustomEvent(key === 'saved' ? 'vortex:toggle-bet-slip' : 'vortex:switch-tab', { detail: { tab: key } })),
    icon: <>{icons[key]}{key === 'saved' && saved > 0 && <span className="dock-count">{saved}</span>}</>,
  }));
  return <Dock items={items} panelHeight={58} baseItemSize={42} magnification={42} distance={120} dockHeight={76} />;
}

const topTabs = [
  { title: 'Research', icon: Search, value: 'research' },
  { title: 'Tools', icon: FlaskConical, value: 'slate' },
  { title: 'Props', icon: BarChart3, value: 'v2' },
  { title: 'Parlay', icon: Sparkles, value: 'builder' },
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
if (dockRoot) createRoot(dockRoot).render(<VortexDock />);
const tabsRoot = document.getElementById('tabs');
if (tabsRoot) createRoot(tabsRoot).render(<VortexTopTabs />);
const builderDropdownRoot = document.getElementById('prop-builder-dropdown-root');
if (builderDropdownRoot) createRoot(builderDropdownRoot).render(<ActivityDropdown />);

window.vortexMountResearchLoader = (host, props) => {
  const root = createRoot(host);
  root.render(<ResearchAILoader {...props} />);
  return () => root.unmount();
};
