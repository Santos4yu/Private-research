import React, { useEffect, useState } from 'react';
import { DockIcon } from './DockIcons';
import { pickBuilder } from './pick-builder-client';

const destinations = [
  { key: 'finder', label: 'Finder', icon: 'finder' },
  { key: 'research', label: 'Research', icon: 'research' },
  { key: 'v2', label: 'Props', icon: 'props' },
  { key: 'saved', label: 'My Slip', icon: 'slip' },
];

export function MobileNavigation() {
  const [tab, setTab] = useState('finder');
  const [saved, setSaved] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    const sync = ({ detail }) => {
      setTab(detail?.tab || 'finder');
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
      {destinations.map(({ key, label, icon }) => (
        // My Slip opens the side panel at the Pick Builder rather than the
        // old My Slip page.
        <button key={key} type="button" className="mobile-app-tab" data-requires-tab={key}
          aria-current={tab === key ? 'page' : undefined}
          {...(key === 'saved' ? { 'aria-controls': 'side-panel', 'aria-haspopup': 'dialog' } : {})}
          onClick={() => key === 'saved' ? pickBuilder.open()
            : window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: key } }))}>
          <span className="mobile-app-tab-icon"><DockIcon name={icon} active={tab === key} />
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
        <span className="mobile-app-tab-icon"><DockIcon name="more" active={!destinations.some(({ key }) => key === tab)} /></span>
        <span>More</span>
      </button>
    </nav>
  );
}
