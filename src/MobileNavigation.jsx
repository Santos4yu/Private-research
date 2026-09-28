import React, { useEffect, useState } from 'react';
import { Layers2 as BarChart3, Ticket as ClipboardList, Grid2X2 as MoreHorizontal, Compass as Search, SearchCheck } from 'lucide-react';
import { pickBuilder } from './pick-builder-client';

const destinations = [
  { key: 'research', label: 'Research', icon: Search },
  { key: 'finder', label: 'Finder', icon: SearchCheck },
  { key: 'v2', label: 'Props', icon: BarChart3 },
  { key: 'saved', label: 'My Slip', icon: ClipboardList },
];

export function MobileNavigation() {
  const [tab, setTab] = useState('research');
  const [saved, setSaved] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const sync = ({ detail }) => {
      setTab(detail?.tab || 'research');
      setSaved(detail?.saved ?? 0);
    };
    const syncMore = ({ detail }) => setMoreOpen(Boolean(detail?.open));
    window.addEventListener('vortex:dock-sync', sync);
    window.addEventListener('vortex:more-sync', syncMore);
    window.dispatchEvent(new Event('vortex:dock-ready'));
    return () => {
      window.removeEventListener('vortex:dock-sync', sync);
      window.removeEventListener('vortex:more-sync', syncMore);
    };
  }, []);

  return (
    <nav className="mobile-app-nav" aria-label="Primary navigation">
      {destinations.map(({ key, label, icon: Icon }) => (
        // My Slip opens the side panel at the Pick Builder rather than the
        // old My Slip page.
        <button key={key} type="button" className="mobile-app-tab"
          aria-current={tab === key ? 'page' : undefined}
          {...(key === 'saved' ? { 'aria-controls': 'side-panel', 'aria-haspopup': 'dialog' } : {})}
          onClick={() => key === 'saved' ? pickBuilder.open()
            : window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: key } }))}>
          <span className="mobile-app-tab-icon"><Icon size={24} strokeWidth={2} aria-hidden="true" />
            {key === 'saved' && saved > 0 && <span className="mobile-app-count" aria-hidden="true">{saved}</span>}
          </span>
          <span>{label}</span>
          {key === 'saved' && <span className="mobile-sr-only">{saved} saved props</span>}
        </button>
      ))}
      <button type="button" id="mobile-more-trigger" className="mobile-app-tab"
        aria-controls="side-panel" aria-expanded={moreOpen} aria-haspopup="dialog"
        aria-current={!destinations.some(({ key }) => key === tab) ? 'page' : undefined}
        onClick={() => window.dispatchEvent(new Event('vortex:open-more'))}>
        <span className="mobile-app-tab-icon"><MoreHorizontal size={24} strokeWidth={2} aria-hidden="true" /></span>
        <span>More</span>
      </button>
    </nav>
  );
}
