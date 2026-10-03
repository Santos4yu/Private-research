import React, { Suspense, lazy, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layers2 as BarChart3, CircleDot, LayoutGrid, Diamond, Crosshair, Target, ChartNoAxesCombined } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../components/ui/select';
import { LandingPage } from './LandingPage';
import { SparklesBackground } from './SparklesBackground';
import { AuthCard } from './AuthCard';
import { AdminPinCard } from './AdminPinCard';
import { MobileNavigation } from './MobileNavigation';
import { MobileSlipActions } from './MobileSlipActions';
import { PickBuilder } from './PickBuilder';
import { SideMenu } from './SideMenu';
import { ResearchHome } from './ResearchHome';
import { UnifiedFinder } from './UnifiedFinder';
import { LineMoves } from './LineMoves';
import { SmartSlip } from './SmartSlip';
import { Moneylines } from './Moneylines';
import { KrazyBot } from './KrazyBot';
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
import './vortex-sidebar.css';
import './gamelog-inline.css';
import './trend-workspace.css';

import { topTabs } from './navTabs';
import { VortexSidebar } from './VortexSidebar';

function VortexTopTabs() {
  const [tab, setTab] = useState('finder');
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    const sync = (event) => {
      setTab(event.detail?.tab || 'finder');
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
const sidebarRoot = document.getElementById('sidebar-root');
if (sidebarRoot) createRoot(sidebarRoot).render(<VortexSidebar />);
const builderDropdownRoot = document.getElementById('prop-builder-dropdown-root');
if (builderDropdownRoot) createRoot(builderDropdownRoot).render(<ActivityDropdown />);
const mobileSlipRoot = document.getElementById('mobile-slip-actions-root');
if (mobileSlipRoot) createRoot(mobileSlipRoot).render(<MobileSlipActions />);
const sideMenuRoot = document.getElementById('side-menu-root');
if (sideMenuRoot) createRoot(sideMenuRoot).render(<SideMenu />);
const pickBuilderRoot = document.getElementById('pick-builder-root');
if (pickBuilderRoot) createRoot(pickBuilderRoot).render(<PickBuilder />);
const researchHomeRoot = document.getElementById('research-home-root');

const sportResearchRoot = document.getElementById('sport-research-root');
const unifiedFinderRoot = document.getElementById('unified-finder-root');
const lineMovesRoot = document.getElementById('line-moves-root');
const smartSlipRoot = document.getElementById('smart-slip-root');
const moneylinesRoot = document.getElementById('moneylines-root');
const krazyBotRoot = document.getElementById('krazy-bot-root');
let privateRoots=null;
function mountPrivateResearch(granted){
 if(granted&&!privateRoots){
  privateRoots={home:researchHomeRoot?createRoot(researchHomeRoot):null,sport:sportResearchRoot?createRoot(sportResearchRoot):null,finder:unifiedFinderRoot?createRoot(unifiedFinderRoot):null,moves:lineMovesRoot?createRoot(lineMovesRoot):null,slip:smartSlipRoot?createRoot(smartSlipRoot):null};
  privateRoots.home?.render(<ResearchHome/>);
  privateRoots.sport?.render(<Suspense fallback={<div role="status">Loading sport research…</div>}><SportResearch/></Suspense>);
  privateRoots.finder?.render(<UnifiedFinder/>);
  privateRoots.moves?.render(<LineMoves/>);
  privateRoots.slip?.render(<SmartSlip/>);
 }else if(!granted&&privateRoots){privateRoots.home?.unmount();privateRoots.sport?.unmount();privateRoots.finder?.unmount();privateRoots.moves?.unmount();privateRoots.slip?.unmount();privateRoots=null;}
}
// Moneylines and Krazy Bot are admin-only sections (site-access-core.js
// ADMIN_TABS): mounted, and so asking for data, only in an admin session.
let moneylinesMount=null,krazyBotMount=null;
function mountAdminSections(admin){
 if(admin&&!moneylinesMount&&moneylinesRoot){moneylinesMount=createRoot(moneylinesRoot);moneylinesMount.render(<Moneylines/>);}
 else if(!admin&&moneylinesMount){moneylinesMount.unmount();moneylinesMount=null;}
 if(admin&&!krazyBotMount&&krazyBotRoot){krazyBotMount=createRoot(krazyBotRoot);krazyBotMount.render(<KrazyBot/>);}
 else if(!admin&&krazyBotMount){krazyBotMount.unmount();krazyBotMount=null;}
}
window.addEventListener('vortex:site-policy',event=>{mountPrivateResearch(event.detail.accessGranted);mountAdminSections(Boolean(event.detail.accessGranted&&event.detail.isAdmin));});
mountPrivateResearch(document.documentElement.dataset.siteAccess==='granted');

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

// The signed-out landing page (src/LandingPage.jsx), mounted by
// site-access.js's renderStatus() every time it rebuilds the gate for a
// signed-out visitor -- same factory-takes-a-host pattern as
// vortexMountResearchLoader since the host is built at runtime.
window.vortexMountLandingPage = (host, props) => {
  const root = createRoot(host);
  root.render(<LandingPage {...props} />);
  return () => root.unmount();
};

// Same sparkles background as the landing page, mounted behind the vanilla
// sign-in/sign-up auth card (src/site-access.js renderAuthCard()) so the
// two screens visually match.
window.vortexMountSparklesBackground = (host, props) => {
  const root = createRoot(host);
  root.render(<SparklesBackground {...props} />);
  return () => root.unmount();
};

// The sign-in/sign-up card (src/site-access.js renderAuthCard()), replacing
// the old vanilla authForm() markup with the pasted "login-signup" design.
window.vortexMountAuthCard = (host, props) => {
  const root = createRoot(host);
  root.render(<AuthCard {...props} />);
  return () => root.unmount();
};

// The hidden in-app admin PIN prompt (3 rapid clicks on the settings gear,
// app.js's openV2PinPrompt()), styled the same as AuthCard's admin mode.
window.vortexMountAdminPin = (host, props) => {
  const root = createRoot(host);
  root.render(<AdminPinCard {...props} />);
  return () => root.unmount();
};

// Bridges the MLB "select a stat" picker into the new Select component.
// The hidden native <select id="profile-stats"> stays the real value/
// change-event source everything else in app.js reads and writes -- this
// only owns the visual dropdown, imperatively driven from vanilla via the
// returned {setOptions,setValue} controller (app.js has no reactive state
// of its own to hand this a live `options`/`value` prop).
function StatSelectHost({ controllerRef, onPick }) {
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState('');
  // Assigned during render, not inside useEffect: an effect only runs after
  // the browser has painted, which is too late if app.js calls setOptions()
  // in the same synchronous pass right after mounting this (as it does on
  // the very first player selected). React's initial root.render() commits
  // synchronously, so this ref is already live the instant render() returns.
  controllerRef.current = { setOptions, setValue };
  return (
    <Select value={value} onValueChange={(next) => { setValue(next); onPick(next); }}>
      <SelectTrigger icon={ChartNoAxesCombined} placeholder="Select a stat" aria-label="Select a stat" />
      <SelectContent>
        {options.map((stat, index) => <SelectItem key={stat} index={index} value={stat}>{stat}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

window.vortexMountStatSelect = (host, { onPick }) => {
  const controllerRef = { current: null };
  createRoot(host).render(<StatSelectHost controllerRef={controllerRef} onPick={onPick} />);
  return {
    setOptions: (list) => controllerRef.current?.setOptions(list),
    setValue: (v) => controllerRef.current?.setValue(v),
  };
};
const statSelectRoot = document.getElementById('profile-stats-select-root');
if (statSelectRoot) {
  window.vortexStatSelect = window.vortexMountStatSelect(statSelectRoot, {
    onPick: (value) => {
      const nativeSelect = document.getElementById('profile-stats');
      if (nativeSelect && nativeSelect.value !== value) {
        nativeSelect.value = value;
        nativeSelect.dispatchEvent(new Event('change'));
      }
    },
  });
}

// A tiny image "icon" shaped like a LucideIcon (accepts size/strokeWidth,
// ignores what it doesn't need) so the PrizePicks/goblin/demon art can ride
// along in SelectTrigger's single icon slot the same way a lucide icon would.
function imageIcon(src, label = '') {
  const IconFromImage = ({ size = 16 }) => <img src={src} width={size} height={size} alt={label} />;
  return IconFromImage;
}
const PP_LOGO_ICON = imageIcon('/prizepicks/logo.png', 'PrizePicks');
const PP_TIER_ICON = { GOBLIN: imageIcon('/prizepicks/goblin.png', 'Goblin'), DEMON: imageIcon('/prizepicks/demon.png', 'Demon') };
const BOOK_ICON_SRC = {
  prizepicks: '/prizepicks/logo.png',
  draftkings: '/sportsbooks/draftkings.png',
  draftkings_pick6: '/sportsbooks/dkpick6.png',
  fanduel: '/sportsbooks/fanduel.png',
  betmgm: '/sportsbooks/betmgm.png',
  underdog: '/sportsbooks/underdog.png',
  underdogfantasy: '/sportsbooks/underdog.png',
};
const BOOK_NAME = { prizepicks: 'PrizePicks', draftkings: 'DraftKings', draftkings_pick6: 'DK Pick6', fanduel: 'FanDuel', betmgm: 'BetMGM', underdog: 'Underdog', underdogfantasy: 'Underdog' };
function LinePrimaryMark({ line, size = 22 }) {
  const tierIcon = line?.primaryBook === 'prizepicks' ? PP_TIER_ICON[line?.tier] : null;
  if (line?.primaryBook === 'prizepicks') {const TierIcon=tierIcon;return <span className="posted-line-primary"><PP_LOGO_ICON size={size}/>{TierIcon&&<TierIcon size={size}/>}</span>;}
  const book = line?.primaryBook || line?.books?.[0];
  return <span className="posted-line-primary" aria-label={BOOK_NAME[book] || book || 'Sportsbook'}>{BOOK_ICON_SRC[book]
    ? <img src={BOOK_ICON_SRC[book]} width={size} height={size} alt={BOOK_NAME[book] || book} />
    : <i>{String(book || '?').slice(0, 2).toUpperCase()}</i>}</span>;
}
// Only Goblin and Demon have an icon, so STANDARD and ALT rows rendered
// identically -- value plus the PrizePicks mark -- and there was no way to
// tell the regular posted line from an alternate. Every row is PrizePicks
// (the trigger already carries the mark), so the per-row logo said nothing
// and the tier now gets the space instead.
const PP_TIER_LABEL = { STANDARD: 'Standard', GOBLIN: 'Goblin', DEMON: 'Demon', ALT: 'Alt' };

// Bridges the MLB "PrizePicks lines" alt-line picker into the same Select
// component -- same reasoning as StatSelectHost above: app.js keeps owning
// the fetch/cache/eligibility logic (loadPrizePicksLines in app.js) and just
// hands this bridge a ready-to-render list plus the current line/status.
function AltLinesSelectHost({ controllerRef, onPick, canAdjustLine = false }) {
  const [lines, setLines] = useState([]);
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('loading');
  controllerRef.current = { setLines, setValue, setStatus };
  const ready = status === 'ready' && lines.length > 0;
  const current = ready ? lines.find((line) => String(line.value) === String(value)) : null;
  const isMultiBook = Boolean(lines.some(line => line.books?.some(book => book !== 'prizepicks')));
  const placeholder = status === 'loading' ? 'Loading…' : status === 'error' ? 'Unavailable' : ready ? 'Lines' : 'No lines';
  const lineHint = canAdjustLine ? ' You can still adjust the research line with the minus and plus buttons.' : '';
  const description = status === 'loading'
    ? `Loading posted lines.${lineHint}`
    : status === 'error'
      ? `Posted lines are unavailable.${lineHint}`
      : ready ? 'Choose a posted line from the available books.' : `No lines are posted for this stat.${lineHint}`;
  const TriggerIcon = current?.books?.length
    ? ({ size = 20 }) => <LinePrimaryMark line={current} size={size} />
    : (PP_TIER_ICON[current?.tier] ?? PP_LOGO_ICON);
  return (
    <Select key={status} value={current ? String(current.value) : ''} onValueChange={(next) => {
      if (ready && lines.some((line) => String(line.value) === next)) onPick(next);
    }} disabled={!ready}>
      <SelectTrigger icon={TriggerIcon} placeholder={placeholder} aria-label={`${isMultiBook ? 'Sportsbook' : 'PrizePicks'} lines: ${current ? `${current.value} ${PP_TIER_LABEL[current.tier] || 'Alt'}` : placeholder}`} title={description} aria-busy={status === 'loading'} />
      <SelectContent className={canAdjustLine ? 'trend-select-menu trend-lines-menu' : undefined}>
        {(ready ? lines : []).map((line, index) => {
          return (
            <SelectItem key={line.value} index={index} value={String(line.value)}>
              <span className="pp-select-line-row">
                <span className="pp-select-line-value">{line.value}</span>
                {line.books?.length ? <LinePrimaryMark line={line} /> : PP_TIER_ICON[line.tier] && <LinePrimaryMark line={{...line,primaryBook:'prizepicks'}} />}
                <span className={`pp-select-line-tier is-${String(line.tier || 'alt').toLowerCase()}`}>
                  {PP_TIER_ICON[line.tier] ? PP_TIER_LABEL[line.tier] : line.books?.length ? `${new Set(line.books.map(book => BOOK_NAME[book] || book)).size} ${new Set(line.books.map(book => BOOK_NAME[book] || book)).size === 1 ? 'book' : 'books'}` : PP_TIER_LABEL[line.tier] || 'Alt'}
                </span>
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

window.vortexMountAltLinesSelect = (host, { onPick }) => {
  const controllerRef = { current: null };
  createRoot(host).render(<AltLinesSelectHost controllerRef={controllerRef} onPick={onPick} canAdjustLine={host.id === 'gamelog-lines-select-root'} />);
  return {
    setLines: (list) => controllerRef.current?.setLines(list),
    setValue: (v) => controllerRef.current?.setValue(v),
    setStatus: (s) => controllerRef.current?.setStatus(s),
  };
};
const ppLinesSelectRoot = document.getElementById('pp-lines-select-root');
if (ppLinesSelectRoot) {
  window.vortexAltLinesSelect = window.vortexMountAltLinesSelect(ppLinesSelectRoot, {
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:pp-line-pick', { detail: { value: Number(value) } })),
  });
}
// The Trend tab's own alt-lines picker -- same component, separate mount
// (own value/status state, own pick event) since it drives gameLogState
// in app.js rather than the main finder's cmd state.
const gamelogLinesSelectRoot = document.getElementById('gamelog-lines-select-root');
if (gamelogLinesSelectRoot) {
  window.vortexGamelogLinesSelect = window.vortexMountAltLinesSelect(gamelogLinesSelectRoot, {
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:gamelog-line-pick', { detail: { value: Number(value) } })),
  });
}

// A plain single-value picker (Season/Matchup/Location on the Trend tab):
// same Select component as the stat/alt-lines pickers above, just with a
// caller-supplied, static-ish option list instead of a fetched one. Value
// updates locally on pick (like StatSelectHost) since there's no external
// "is this pick still valid" check the way PrizePicks lines needs.
function SimpleSelectHost({ controllerRef, onPick, ariaLabel, isTrend = false }) {
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState('');
  const [disabled, setDisabled] = useState(false);
  controllerRef.current = { setOptions, setValue, setDisabled };
  return (
    <Select value={value} onValueChange={(next) => { setValue(next); onPick(next); }} disabled={disabled}>
      <SelectTrigger placeholder="All" aria-label={ariaLabel} />
      <SelectContent className={isTrend ? 'trend-select-menu' : undefined}>
        {options.map((opt, index) => <SelectItem key={opt.value} index={index} value={opt.value}>{opt.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
window.vortexMountSimpleSelect = (host, { onPick, ariaLabel }) => {
  const controllerRef = { current: null };
  createRoot(host).render(<SimpleSelectHost ariaLabel={ariaLabel} controllerRef={controllerRef} onPick={onPick} isTrend={host.id.startsWith('gamelog-')} />);
  return {
    setOptions: (list) => controllerRef.current?.setOptions(list),
    setValue: (v) => controllerRef.current?.setValue(v),
    setDisabled: (d) => controllerRef.current?.setDisabled(d),
  };
};
const gamelogSeasonSelectRoot = document.getElementById('gamelog-season-select-root');
if (gamelogSeasonSelectRoot) {
  window.vortexGamelogSeasonSelect = window.vortexMountSimpleSelect(gamelogSeasonSelectRoot, {
    ariaLabel: 'Season year',
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:gamelog-season-pick', { detail: { value } })),
  });
}
const gamelogKindSelectRoot = document.getElementById('gamelog-kind-select-root');
if (gamelogKindSelectRoot) {
  window.vortexGamelogKindSelect = window.vortexMountSimpleSelect(gamelogKindSelectRoot, {
    ariaLabel: 'Season',
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:gamelog-kind-pick', { detail: { value } })),
  });
}
const gamelogHandSelectRoot = document.getElementById('gamelog-hand-select-root');
if (gamelogHandSelectRoot) {
  window.vortexGamelogHandSelect = window.vortexMountSimpleSelect(gamelogHandSelectRoot, {
    ariaLabel: 'Matchup',
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:gamelog-hand-pick', { detail: { value } })),
  });
}
window.vortexGamelogExtraSelects = Object.fromEntries([['opponent', 'Opponent'], ['league', 'League'], ['team', 'Team']].map(([field, label]) => {
  const root = document.getElementById(`gamelog-${field}-select-root`);
  return [field, root ? window.vortexMountSimpleSelect(root, {
    ariaLabel: label,
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:gamelog-extra-pick', { detail: { field, value } })),
  }) : null];
}));
const gamelogVenueSelectRoot = document.getElementById('gamelog-venue-select-root');
if (gamelogVenueSelectRoot) {
  window.vortexGamelogVenueSelect = window.vortexMountSimpleSelect(gamelogVenueSelectRoot, {
    ariaLabel: 'Location',
    onPick: (value) => window.dispatchEvent(new CustomEvent('vortex:gamelog-venue-pick', { detail: { value } })),
  });
}
