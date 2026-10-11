import React, { useEffect, useState } from 'react';
import { Sidebar, SidebarBody, SidebarLink } from '../components/ui/sidebar';
import { Settings, UserRound } from 'lucide-react';
import { topTabs } from './navTabs';
import { PickBuilder } from './PickBuilder';
import './vortex-sidebar.css';

// Same destinations, same dock-sync wiring as the top pill bar
// (VortexTopTabs in main.jsx) -- this is a second view onto the identical
// navigation state, not a separate nav system.
export function VortexSidebar() {
  const [tab, setTab] = useState('finder');
  const [saved, setSaved] = useState(0);
  const [open, setOpen] = useState(false);
  // The Pick Builder shows inside this rail (widened) rather than in a
  // second panel beside it. It stays open while picks are added from the
  // page, and closes from its own x, Esc, the Builder item or navigating.
  const [builderOpen, setBuilderOpen] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 761px)');
    window.vortexRailBuilder = {
      available: () => desktop.matches,
      open: () => setBuilderOpen(true),
      close: () => setBuilderOpen(false),
    };
    return () => { delete window.vortexRailBuilder; };
  }, []);
  useEffect(() => {
    // Closing the builder folds the rail back up (the pointer is usually
    // out on the page by then, so no mouse-out will come to do it).
    if (!builderOpen) { setOpen(false); return undefined; }
    const escape = (event) => { if (event.key === 'Escape') setBuilderOpen(false); };
    const leave = () => setBuilderOpen(false);
    // Down to phone width, the side panel holds the builder instead.
    const desktop = window.matchMedia('(min-width: 761px)');
    const resize = () => { if (!desktop.matches) setBuilderOpen(false); };
    document.addEventListener('keydown', escape);
    window.addEventListener('vortex:switch-tab', leave);
    desktop.addEventListener?.('change', resize);
    return () => {
      document.removeEventListener('keydown', escape);
      window.removeEventListener('vortex:switch-tab', leave);
      desktop.removeEventListener?.('change', resize);
    };
  }, [builderOpen]);

  useEffect(() => {
    const sync = (event) => {
      setTab(event.detail?.tab || 'finder');
      setSaved(event.detail?.saved ?? 0);
    };
    window.addEventListener('vortex:dock-sync', sync);
    window.dispatchEvent(new Event('vortex:dock-ready'));
    return () => window.removeEventListener('vortex:dock-sync', sync);
  }, []);

  // Builder opens (or closes) the Pick Builder right here in the rail.
  const go = (value) => value === 'saved' ? setBuilderOpen((current) => !current)
    : window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: value } }));

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
    <Sidebar open={open || builderOpen} setOpen={setOpen} width={builderOpen ? '380px' : undefined} pinned={builderOpen}>
      <SidebarBody className={`vortex-sidebar-body${builderOpen ? ' has-builder' : ''}`}>
        {/* The full wordmark while the rail is open, the spade A while it
            is compact (the wordmark is never just clipped by the narrow
            rail). */}
        <div className={`vortex-sidebar-top${!open && !builderOpen ? ' collapsed' : ''}`}>
          {open || builderOpen
            ? <img src="/brand/ace-props-wordmark.png" alt="Ace Props" className="vortex-sidebar-wordmark" width={92} height={35} />
            : <img src="/brand/ace-props-mark.png" alt="Ace Props" className="vortex-sidebar-mark" width={32} height={32} />}
        </div>
        <nav className="vortex-sidebar-links">
          {topTabs.map((item, index) => item.type === 'separator'
            // A divider goes with the item under it, so it doesn't dangle
            // when that item's section is switched off.
            ? <div className="vortex-sidebar-sep" key={`sep-${index}`} data-requires-tab={topTabs[index + 1]?.value} />
            : (
              <SidebarLink
                key={item.value}
                data-requires-tab={item.value}
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
                  active: item.value === 'saved' ? builderOpen : tab === item.value && !builderOpen,
                  onClick: () => go(item.value),
                }}
              />
            ))}
        </nav>
        {builderOpen && (
          <div className="vortex-sidebar-builder" data-requires-tab="saved">
            <PickBuilder titleId="rail-pick-builder-title" onClose={() => setBuilderOpen(false)} />
          </div>
        )}
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
