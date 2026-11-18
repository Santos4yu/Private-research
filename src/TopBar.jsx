import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings, Ticket } from 'lucide-react';
import { adminTabs, moreTabs, topTabs } from './navTabs';
import { PickBuilder } from './PickBuilder';
import { accountProfile } from './account-sync';
import { dockTabs } from './mobile-nav-core.js';
import { siteDockTabs, siteIsAdmin, siteTabAllowed } from './site-access';
import './topbar.css';

// The computer's navigation (Nov 18, the redesign: docs/design/research-
// style/). A bar across the top instead of the old side rail: the logo, the
// admin's dock sections (the same four the phone's bar shows, so the two
// always agree), "More" for every other section, then the account, the
// settings and the slip. The Pick Builder opens in a panel on the right
// (it used to open inside the rail) and stays open while picks are added.
const ALL = [...topTabs.filter(item => item.value && item.value !== 'saved'), ...moreTabs];
const byKey = Object.fromEntries([...ALL, ...adminTabs].map(item => [item.value, item]));
// Shorter names where the bar is tight; the page titles stay as they are.
const SHORT = { bot: 'Assistant', builder: 'Parlay Builder', export: 'To PrizePicks' };
const nameOf = item => SHORT[item.value] || item.title;
const GROUPS = [
  { label: 'Discover', tabs: ['finder', 'bot', 'sheets', 'moves', 'research', 'predictor', 'v2'] },
  { label: 'Build', tabs: ['builder', 'slip', 'export', 'bets'] },
  { label: 'More', tabs: ['promos', 'slate', 'nrfi', 'community'] },
];

function useNav() {
  const [tab, setTab] = useState('finder');
  const [saved, setSaved] = useState(0);
  const [, setRevision] = useState(0);
  useEffect(() => {
    const sync = ({ detail }) => { setTab(detail?.tab || 'finder'); setSaved(detail?.saved ?? 0); };
    const refresh = () => setRevision(n => n + 1);
    window.addEventListener('vortex:dock-sync', sync);
    window.addEventListener('vortex:site-policy', refresh);
    window.dispatchEvent(new Event('vortex:dock-ready'));
    return () => {
      window.removeEventListener('vortex:dock-sync', sync);
      window.removeEventListener('vortex:site-policy', refresh);
    };
  }, []);
  return { tab, saved };
}

// Who's signed in: their photo or initial (never their email).
function useMember() {
  const read = policy => {
    const profile = accountProfile() || {};
    return { name: String(profile.name || policy?.account?.displayName || '').trim(), photo: profile.avatarUrl || '' };
  };
  const [policy, setPolicy] = useState(null);
  const [member, setMember] = useState(() => read(null));
  useEffect(() => {
    const onPolicy = ({ detail }) => { setPolicy(detail || null); setMember(read(detail)); };
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

export function TopBar() {
  const { tab, saved } = useNav();
  const member = useMember();
  const [moreOpen, setMoreOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [broken, setBroken] = useState('');
  const moreRef = useRef(null);

  // pick-builder-client.js opens the builder here on a computer.
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
    if (!builderOpen) return undefined;
    const escape = event => { if (event.key === 'Escape') setBuilderOpen(false); };
    const desktop = window.matchMedia('(min-width: 761px)');
    const resize = () => { if (!desktop.matches) setBuilderOpen(false); };
    document.addEventListener('keydown', escape);
    desktop.addEventListener?.('change', resize);
    return () => { document.removeEventListener('keydown', escape); desktop.removeEventListener?.('change', resize); };
  }, [builderOpen]);
  useEffect(() => {
    if (!moreOpen) return undefined;
    const away = event => { if (!moreRef.current?.contains(event.target)) setMoreOpen(false); };
    const escape = event => { if (event.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', escape); };
  }, [moreOpen]);

  const go = value => {
    setMoreOpen(false);
    window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab: value } }));
  };
  // Account and Settings work by pressing the page's own (hidden) buttons,
  // which keep the account dialog, the settings panel and its admin unlock.
  const press = selector => event => { event.stopPropagation(); document.querySelector(selector)?.click(); };

  const allowed = value => siteTabAllowed(value);
  const primary = dockTabs(siteDockTabs(), allowed).filter(key => key !== 'saved' && byKey[key]).map(key => byKey[key]);
  const inBar = new Set(primary.map(item => item.value));
  const groups = GROUPS.map(group => ({
    label: group.label,
    items: group.tabs.map(key => byKey[key]).filter(item => item && !inBar.has(item.value) && allowed(item.value)),
  }));
  const admin = adminTabs.filter(item => siteIsAdmin() || allowed(item.value));
  if (admin.length) groups.push({ label: 'Admin', items: admin });
  const moreHere = groups.some(group => group.items.some(item => item.value === tab));

  const initial = (member.name || 'A').slice(0, 1).toUpperCase();
  const avatar = member.photo && broken !== member.photo
    ? <img src={member.photo} alt="" onError={() => setBroken(member.photo)} />
    : <span aria-hidden="true">{initial}</span>;

  return (
    <>
      <header className="ps-top" aria-label="Site">
        <button type="button" className="ps-top-brand" onClick={() => go('finder')} aria-label="PropScout, go to the Finder">
          <img src="/brand/propscout-logo.svg" alt="PropScout" width={120} height={22} />
        </button>
        <nav className="ps-top-links" aria-label="Main">
          {primary.map(item => (
            <button key={item.value} type="button" data-requires-tab={item.value} className="ps-top-link"
              aria-current={tab === item.value ? 'page' : undefined} onClick={() => go(item.value)}>
              <item.icon size={16} strokeWidth={1.9} aria-hidden="true" /><span>{nameOf(item)}</span>
            </button>
          ))}
          <div className="ps-top-more" ref={moreRef}>
            <button type="button" className="ps-top-link" aria-haspopup="true" aria-expanded={moreOpen}
              aria-current={moreHere ? 'page' : undefined} onClick={() => setMoreOpen(open => !open)}>
              <span>More</span><ChevronDown size={15} aria-hidden="true" />
            </button>
            {moreOpen && (
              <div className="ps-top-menu" role="menu">
                {groups.filter(group => group.items.length).map(group => (
                  <div className="ps-top-menu-group" key={group.label}>
                    <p>{group.label}</p>
                    {group.items.map(item => (
                      <button key={item.value} type="button" role="menuitem" data-requires-tab={item.value}
                        aria-current={tab === item.value ? 'page' : undefined} onClick={() => go(item.value)}>
                        <item.icon size={16} strokeWidth={1.9} aria-hidden="true" /><span>{nameOf(item)}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>
        <div className="ps-top-end">
          <button type="button" className="ps-top-icon" aria-label="Settings" aria-haspopup="true" onClick={press('#settings-btn')}>
            <Settings size={17} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <button type="button" className="ps-top-me" aria-label="Your account" aria-haspopup="dialog" onClick={press('.site-account-trigger')}>{avatar}</button>
          <button type="button" className="ps-top-slip" data-requires-tab="saved" aria-expanded={builderOpen}
            onClick={() => setBuilderOpen(open => !open)}>
            <Ticket size={16} strokeWidth={2} aria-hidden="true" /><span>Slip</span>
            {saved > 0 && <b aria-label={`${saved} saved`}>{saved}</b>}
          </button>
        </div>
      </header>
      {builderOpen && (
        <aside className="ps-top-builder topbar-builder" data-requires-tab="saved" aria-label="Your slip">
          <PickBuilder compact titleId="top-pick-builder-title" onClose={() => setBuilderOpen(false)} />
        </aside>
      )}
    </>
  );
}
