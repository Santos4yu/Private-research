import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarBody, SidebarLink } from '../components/ui/sidebar';
import { Settings, UserRound } from 'lucide-react';
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

  // Account and Settings used to float over the top-right corner of every
  // page, on top of whatever each tab put there (the Finder's header lost
  // its label and Saved button under them). On desktop they are rail items
  // instead. The original buttons stay in the page, hidden, and keep doing
  // the work -- the gear still owns the settings panel and its triple-click
  // admin unlock, the account button still owns the account dialog -- so
  // these only press them.
  const press = (selector) => (event) => {
    // The page closes the settings panel on any click that reaches the
    // document; stop this one before it does, exactly as the gear itself does.
    event.stopPropagation();
    document.querySelector(selector)?.click();
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const panel = document.getElementById('settings-panel');
    if (!panel) return undefined;
    const sync = () => setSettingsOpen(!panel.hidden);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sidebar open={open} setOpen={setOpen}>
      <SidebarBody className="vortex-sidebar-body">
        {/* Wordmark only exists in the DOM while expanded -- previously it
            was always rendered and just clipped by overflow:hidden, which
            let a sliver of "Ki" show through in the collapsed rail. */}
        <div className={`vortex-sidebar-top${!open ? ' collapsed' : ''}`}>
          <img src="/icons/kd-mark.png" alt="" className="vortex-sidebar-mark" width={28} height={28} />
          {open && <span className="vortex-sidebar-wordmark">Krazy<b>Data</b></span>}
        </div>
        <nav className="vortex-sidebar-links">
          {topTabs.map((item, index) => item.type === 'separator'
            ? <div className="vortex-sidebar-sep" key={`sep-${index}`} />
            : (
              <SidebarLink
                key={item.value}
                link={{
                  label: item.title,
                  // Badge lives inside the icon's own wrapper (not after the
                  // label) so it can sit pinned to the icon's corner like a
                  // notification dot, in both the collapsed and expanded rail.
                  icon: (
                    <span className="vortex-sidebar-icon-wrap">
                      <item.icon size={19} strokeWidth={1.8} />
                      {item.value === 'saved' && saved > 0 && (
                        <span className="vortex-sidebar-notif" aria-label={`${saved} saved props`}>{saved}</span>
                      )}
                    </span>
                  ),
                  active: tab === item.value,
                  onClick: () => go(item.value),
                }}
              />
            ))}
        </nav>
        <div className="vortex-sidebar-footer">
          <SidebarLink
            link={{
              label: 'Account',
              icon: <span className="vortex-sidebar-icon-wrap"><UserRound size={19} strokeWidth={1.8} /></span>,
              onClick: press('.site-account-trigger'),
            }}
            aria-haspopup="dialog"
          />
          <SidebarLink
            className={settingsOpen ? 'is-open' : undefined}
            link={{
              label: 'Settings',
              icon: <span className="vortex-sidebar-icon-wrap"><Settings size={19} strokeWidth={1.8} /></span>,
              onClick: press('#settings-btn'),
            }}
            aria-haspopup="true"
            aria-expanded={settingsOpen}
          />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
