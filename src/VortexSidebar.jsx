import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarBody, SidebarLink } from '../components/ui/sidebar';
import { topTabs } from './navTabs';
import './vortex-sidebar.css';

// Same destinations, same dock-sync wiring as the top pill bar
// (VortexTopTabs in main.jsx) -- this is a second view onto the identical
// navigation state, not a separate nav system.
export function VortexSidebar() {
  const [tab, setTab] = useState('research');
  const [saved, setSaved] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const sync = (event) => {
      setTab(event.detail?.tab || 'research');
      setSaved(event.detail?.saved ?? 0);
    };
    window.addEventListener('vortex:dock-sync', sync);
    window.dispatchEvent(new Event('vortex:dock-ready'));
    return () => window.removeEventListener('vortex:dock-sync', sync);
  }, []);

  const go = (value) => window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: value } }));

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="vortex-sidebar-body">
        <div className="vortex-sidebar-top">
          <img src="/icons/kd-mark.png" alt="" className="vortex-sidebar-mark" width={28} height={28} />
          <span className="vortex-sidebar-wordmark">Krazy<b>Data</b></span>
        </div>
        <nav className="vortex-sidebar-links">
          {topTabs.map((item, index) => item.type === 'separator'
            ? <div className="vortex-sidebar-sep" key={`sep-${index}`} />
            : (
              <SidebarLink
                key={item.value}
                link={{
                  label: item.title,
                  icon: <item.icon size={19} strokeWidth={1.8} />,
                  active: tab === item.value,
                  onClick: () => go(item.value),
                  badge: item.value === 'saved' && saved > 0
                    ? <span className="vortex-sidebar-badge" aria-label={`${saved} saved props`}>{saved}</span>
                    : null,
                }}
              />
            ))}
        </nav>
      </SidebarBody>
    </Sidebar>
  );
}
