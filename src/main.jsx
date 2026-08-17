import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Dock from './Dock';
import './landing.css';

const Icon = ({ children }) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{children}</svg>;
const icons = {
  research: <Icon><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35" strokeLinecap="round"/></Icon>,
  slate: <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Icon>,
  v2: <Icon><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></Icon>,
  builder: <Icon><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" strokeLinejoin="round"/></Icon>,
  saved: <Icon><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/></Icon>,
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
    label: key === 'v2' ? 'Props' : key === 'builder' ? 'Parlay' : key[0].toUpperCase() + key.slice(1),
    className: tab === key ? 'active' : '',
    onClick: () => window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: key } })),
    icon: <>{icons[key]}{key === 'saved' && saved > 0 && <span className="dock-count">{saved}</span>}</>,
  }));
  return <Dock items={items} panelHeight={58} baseItemSize={42} magnification={42} distance={120} dockHeight={76} />;
}

createRoot(document.getElementById('dock-root')).render(<VortexDock />);
