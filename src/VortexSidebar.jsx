import React, { useEffect, useState } from 'react';
import { ChevronRight, Settings, Ticket } from 'lucide-react';
import { topTabs } from './navTabs';
import { PickBuilder } from './PickBuilder';
import { accountProfile } from './account-sync';
import './vortex-sidebar.css';

// The rail's sections, in topTabs' order within each. A destination not
// listed here lands in the last one.
const GROUPS = [
  { key: 'discover', label: 'Discover', tabs: ['finder', 'bot', 'sheets', 'moves', 'research'] },
  { key: 'build', label: 'Build', tabs: ['builder', 'slip', 'export', 'saved', 'bets'] },
  { key: 'more', label: 'More', tabs: ['promos', 'slate', 'v2'] },
];
const items = topTabs.filter((item) => item.type !== 'separator');
const grouped = GROUPS.map((group, index) => ({
  ...group,
  items: items.filter((item) => group.tabs.includes(item.value)
    || (index === GROUPS.length - 1 && !GROUPS.some((other) => other.tabs.includes(item.value)))),
}));

// The sections switched off for this member (site-access.js marks them on
// <html>), so a heading never sits over nothing.
function useHiddenTabs() {
  const read = () => new Set((document.documentElement.dataset.hiddenTabs || '').split(/\s+/).filter(Boolean));
  const [hidden, setHidden] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setHidden(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-hidden-tabs'] });
    return () => observer.disconnect();
  }, []);
  return hidden;
}

// Who's signed in, for the account card: their photo or initial, the name
// on their profile (never their email) and whether they're the admin.
function useMember() {
  const read = (policy) => {
    const profile = accountProfile() || {};
    const name = String(profile.name || policy?.account?.displayName || '').trim();
    return { name, photo: profile.avatarUrl || '', admin: Boolean(policy?.isAdmin), badge: policy?.badge?.label || '' };
  };
  const [policy, setPolicy] = useState(null);
  const [member, setMember] = useState(() => read(null));
  useEffect(() => {
    const onPolicy = (event) => { setPolicy(event.detail || null); setMember(read(event.detail)); };
    window.addEventListener('vortex:site-policy', onPolicy);
    return () => window.removeEventListener('vortex:site-policy', onPolicy);
  }, []);
  useEffect(() => {
    const onProfile = () => setMember(read(policy));
    window.addEventListener('vortex:account-profile', onProfile);
    return () => window.removeEventListener('vortex:account-profile', onProfile);
  }, [policy]);
  return member;
}

// One destination in the rail: its icon tile, and its name beside it while
// the rail is open (always in the page, faded in and out by the stylesheet).
function RailLink({ label, icon, active, onClick, ...props }) {
  return (
    <button type="button" className={`vortex-sidebar-link${active ? ' active' : ''}`} onClick={onClick}
      aria-current={active ? 'page' : undefined} aria-label={label} {...props}>
      <span className="vortex-sidebar-link-icon">{icon}</span>
      <span className="vortex-sidebar-link-label">{label}</span>
    </button>
  );
}

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

  const hidden = useHiddenTabs();
  const member = useMember();
  const [broken, setBroken] = useState('');
  const wide = open || builderOpen;
  const initial = (member.name || 'A').slice(0, 1).toUpperCase();
  const avatar = member.photo && broken !== member.photo
    ? <img src={member.photo} alt="" onError={() => setBroken(member.photo)} />
    : <span aria-hidden="true">{initial}</span>;

  // Opening and closing only move layers the browser has already drawn
  // (vortex-sidebar.css): the rail's backdrop unfolds with a transform, the
  // names fade in, and nothing on the page is laid out again mid-way.
  return (
    <aside className={`vortex-sidebar-desktop vortex-sidebar-body${builderOpen ? ' has-builder' : ''}${wide ? ' is-wide' : ''}`}
      style={{ '--rail-open': builderOpen ? 380 : 244 }} aria-label="Site"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (!builderOpen) setOpen(false); }}>
      <span className="vortex-sidebar-shade" aria-hidden="true" />
      <span className="vortex-sidebar-sheet" aria-hidden="true" />
      <span className="vortex-sidebar-edge" aria-hidden="true" />
      <div className="vortex-sidebar-inner">
        {/* The full logo while the rail is open, the P mark while it is
            compact, one fading into the other. */}
        <div className="vortex-sidebar-top">
          <img src="/brand/propscout-mark.svg" alt={wide ? '' : 'PropScout'} className="vortex-sidebar-mark" width={32} height={29} />
          <img src="/brand/propscout-logo.svg" alt={wide ? 'PropScout' : ''} className="vortex-sidebar-wordmark" width={140} height={26} />
        </div>
        <nav className="vortex-sidebar-links" aria-label="Main">
          {grouped.map((group) => {
            const showing = group.items.filter((item) => !hidden.has(item.value));
            if (!showing.length) return null;
            return (
              <div className="vortex-sidebar-group" key={group.key} role="group" aria-label={group.label}>
                {/* The heading, or a short rule while the rail is compact. */}
                <div className="vortex-sidebar-heading" aria-hidden="true"><span>{group.label}</span><i /></div>
                {group.items.map((item) => (
                  <RailLink
                    key={item.value}
                    data-requires-tab={item.value}
                    title={builderOpen ? item.title : undefined}
                    label={item.title}
                    // Badge lives inside the icon's own wrapper (not after the
                    // label) so it can sit pinned to the icon's corner like a
                    // notification dot, in both the collapsed and expanded rail.
                    icon={(
                      <span className="vortex-sidebar-icon-wrap">
                        <item.icon size={18} strokeWidth={1.9} />
                        {item.value === 'saved' && saved > 0 && (
                          <span className="vortex-sidebar-notif" aria-label={`${saved} saved props`}>{saved}</span>
                        )}
                      </span>
                    )}
                    active={item.value === 'saved' ? builderOpen : tab === item.value && !builderOpen}
                    onClick={() => go(item.value)}
                  />
                ))}
              </div>
            );
          })}
        </nav>
        {builderOpen && (
          <div className="vortex-sidebar-builder" data-requires-tab="saved">
            <PickBuilder titleId="rail-pick-builder-title" onClose={() => setBuilderOpen(false)} />
          </div>
        )}
        <div className="vortex-sidebar-footer">
          {/* Your slip at a glance, while the rail is open. */}
          {wide && !builderOpen && (
            <button type="button" className="vortex-sidebar-slip" data-requires-tab="saved" onClick={() => go('saved')}>
              <span className="vortex-sidebar-slip-icon"><Ticket size={17} strokeWidth={1.9} aria-hidden="true" /></span>
              <span className="vortex-sidebar-slip-text">
                <b>{saved ? `${saved} pick${saved === 1 ? '' : 's'} saved` : 'Your slip is empty'}</b>
                <small>{saved ? 'Open the Builder' : 'Tap a star to save a pick'}</small>
              </span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
          <div className={`vortex-sidebar-account${settingsOpen ? ' is-open' : ''}`}>
            <button type="button" className="vortex-sidebar-me" aria-label="Your account" aria-haspopup="dialog" onClick={press('.site-account-trigger')}>
              <span className="vortex-sidebar-avatar">{avatar}</span>
              {wide && (
                <span className="vortex-sidebar-me-text">
                  <b>{member.name || 'Your account'}</b>
                  <small data-admin={member.admin || undefined}>{member.admin ? 'Admin' : member.badge || 'Member'}</small>
                </span>
              )}
            </button>
            <button type="button" className="vortex-sidebar-gear" aria-label="Settings" aria-haspopup="true" aria-expanded={settingsOpen}
              onClick={press('#settings-btn')}>
              <Settings size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
