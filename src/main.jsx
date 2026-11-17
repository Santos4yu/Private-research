import './request-guard';
import { watchForUpdates } from './app-update';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layers2 as BarChart3, CircleDot, LayoutGrid, Diamond, Crosshair, Target, ChartNoAxesCombined } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem } from '../components/ui/select';
import { MobileNavigation } from './MobileNavigation';
import { MobileSlipActions } from './MobileSlipActions';
import { PickBuilder } from './PickBuilder';
import { SideMenu } from './SideMenu';
import { ResearchHome } from './ResearchHome';
import { UnifiedFinder } from './UnifiedFinder';
import { WelcomeTour } from './WelcomeTour';
import { finderStartKeys, startFinder } from './finder-early';
import { siteFinderSportAllowed } from './site-access';
import { canUseTab, canUsePropsLeague } from './site-access-core';
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
import './site-look.css';
import './gamelog-fix.css';
import './research-polish.css';
import './prop-finder.css';
import './sports/nfl/nfl-research.css';
// The NFL sheets (alternate lines, filters) on the Finder's NFL player page.
import './sports/nfl/mobile-research.css';
import './community-feed.css';
import './vortex-sidebar.css';
import './gamelog-inline.css';
import './trend-workspace.css';
import './ace-theme.css';
import './ace-shell.css';
import './ace-pages.css';
import './trend-edge.css';
import './trend-page.css';
import './prop-focus.css';
import './page-switch.css';
import './gloss.css';
import './finish.css';
import './app-feel.css';

import { topTabs } from './navTabs';
import { VortexSidebar } from './VortexSidebar';

// Sections other than the Finder load their code the first time they're
// opened (and in idle time once the Finder is up), so signing in only waits
// for what's on screen.
const sections = {
  moves: () => import('./LineMoves').then(m => ({ default: m.LineMoves })),
  slip: () => import('./SmartSlip').then(m => ({ default: m.SmartSlip })),
  moneylines: () => import('./Moneylines').then(m => ({ default: m.Moneylines })),
  bot: () => import('./KrazyBot').then(m => ({ default: m.KrazyBot })),
  sheets: () => import('./CheatSheets').then(m => ({ default: m.CheatSheets })),
  promos: () => import('./PromoBoard').then(m => ({ default: m.PromoBoard })),
  predictor: () => import('./GamePredictor').then(m => ({ default: m.GamePredictor })),
  bets: () => import('./MyBets').then(m => ({ default: m.MyBets })),
  analyzer: () => import('./SlipAnalyzer').then(m => ({ default: m.SlipAnalyzer })),
  props: () => import('./PropsLeague').then(m => ({ default: m.PropsLeague })),
};
// The signed-out screens and the admin PIN load only when they're shown, so
// a signed-in member's first load doesn't carry them (or the sparkles).
const LandingPage = lazy(() => import('./LandingPage').then(m => ({ default: m.LandingPage })));
const SparklesBackground = lazy(() => import('./SparklesBackground').then(m => ({ default: m.SparklesBackground })));
const AuthCard = lazy(() => import('./AuthCard').then(m => ({ default: m.AuthCard })));
const AdminPinCard = lazy(() => import('./AdminPinCard').then(m => ({ default: m.AdminPinCard })));
const LineMoves = lazy(sections.moves);
const SmartSlip = lazy(sections.slip);
const Moneylines = lazy(sections.moneylines);
const KrazyBot = lazy(sections.bot);
const CheatSheets = lazy(sections.sheets);
const PromoBoard = lazy(sections.promos);
const GamePredictor = lazy(sections.predictor);
const MyBets = lazy(sections.bets);
const SlipAnalyzer = lazy(sections.analyzer);
const PropsLeague = lazy(sections.props);
// Admin only, so not among the sections every member's browser fetches ahead.
const SlipExport = lazy(() => import('./SlipExport').then(m => ({ default: m.SlipExport })));
const later = element => <Suspense fallback={null}>{element}</Suspense>;

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
// A first look around for new members, and Settings' "Take the tour".
createRoot(document.body.appendChild(document.createElement('div'))).render(<WelcomeTour />);
// A newer release reloads an open app (scores are worked out on the phone).
watchForUpdates();
const researchHomeRoot = document.getElementById('research-home-root');

const unifiedFinderRoot = document.getElementById('unified-finder-root');
const lineMovesRoot = document.getElementById('line-moves-root');
const smartSlipRoot = document.getElementById('smart-slip-root');
const slipAnalyzerRoot = document.getElementById('slip-analyzer-root');
const moneylinesRoot = document.getElementById('moneylines-root');
const slipExportRoot = document.getElementById('slip-export-root');
const krazyBotRoot = document.getElementById('krazy-bot-root');
const cheatSheetsRoot = document.getElementById('cheat-sheets-root');
const promoBoardRoot = document.getElementById('promo-board-root');
const myBetsRoot = document.getElementById('my-bets-root');
const gamePredictorRoot = document.getElementById('game-predictor-root');
// A section starts (mounts, and so fetches its data) the first time its tab
// is shown rather than at sign-in. Returns a function that stops waiting.
function whenShown(host, start) {
 const panel = host?.closest('.tab-panel');
 if (!host) return () => {};
 if (!panel || !panel.hidden) { start(); return () => {}; }
 const watch = new MutationObserver(() => { if (!panel.hidden) { watch.disconnect(); start(); } });
 watch.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
 return () => watch.disconnect();
}
// A root that renders when its tab is first shown; unmount() undoes either.
function shownRoot(host, element) {
 let root = null;
 const stop = whenShown(host, () => { root = createRoot(host); root.render(element); });
 return { unmount() { stop(); root?.unmount(); root = null; } };
}
// Once the Finder has its lines up, the other sections' code downloads in
// idle time, so opening one is instant.
let warmed = false;
function warmSections() {
 if (warmed) return; warmed = true;
 const go = () => Object.values(sections).forEach(load => load().catch(() => {}));
 setTimeout(() => (window.requestIdleCallback ? window.requestIdleCallback(go, { timeout: 8000 }) : go()), 2500);
}
let privateRoots=null;
function mountPrivateResearch(granted){
 if(granted&&!privateRoots){
  // The Finder's lines start loading now, while the page draws.
  try{startFinder(finderStartKeys(siteFinderSportAllowed,{search:location.search,storage:window.localStorage}));}catch{/* the Finder loads them itself */}
  privateRoots={home:researchHomeRoot?shownRoot(researchHomeRoot,<ResearchHome/>):null,finder:unifiedFinderRoot?createRoot(unifiedFinderRoot):null,
   moves:lineMovesRoot?shownRoot(lineMovesRoot,later(<LineMoves/>)):null,slip:smartSlipRoot?shownRoot(smartSlipRoot,later(<SmartSlip/>)):null,
   analyzer:slipAnalyzerRoot?shownRoot(slipAnalyzerRoot,later(<SlipAnalyzer/>)):null};
  privateRoots.finder?.render(<UnifiedFinder/>);
  warmSections();
 }else if(!granted&&privateRoots){privateRoots.home?.unmount();privateRoots.finder?.unmount();privateRoots.moves?.unmount();privateRoots.slip?.unmount();privateRoots.analyzer?.unmount();privateRoots=null;}
}
// Moneylines and Slip to PrizePicks are admin-only sections
// (site-access-core.js ADMIN_TABS): mounted, and so asking for data, only in
// an admin session.
let moneylinesMount=null,slipExportMount=null,krazyBotMount=null;
function mountAdminSections(admin){
 if(admin&&!moneylinesMount&&moneylinesRoot){moneylinesMount=shownRoot(moneylinesRoot,later(<Moneylines/>));}
 else if(!admin&&moneylinesMount){moneylinesMount.unmount();moneylinesMount=null;}
 if(admin&&!slipExportMount&&slipExportRoot){slipExportMount=shownRoot(slipExportRoot,later(<SlipExport/>));}
 else if(!admin&&slipExportMount){slipExportMount.unmount();slipExportMount=null;}
}
// Krazy Bot is a regular section the admin switches on for members (off
// until then); it mounts only for someone allowed to open it.
function mountKrazyBot(open){
 if(open&&!krazyBotMount&&krazyBotRoot){krazyBotMount=shownRoot(krazyBotRoot,later(<KrazyBot/>));}
 else if(!open&&krazyBotMount){krazyBotMount.unmount();krazyBotMount=null;}
}
// Cheat Sheets: mounted only for someone allowed to open them.
// The Promo Board: like Cheat Sheets, a section the admin switches on.
let promoBoardMount=null;
function mountPromoBoard(open){
 if(open&&!promoBoardMount&&promoBoardRoot){promoBoardMount=shownRoot(promoBoardRoot,later(<PromoBoard/>));}
 else if(!open&&promoBoardMount){promoBoardMount.unmount();promoBoardMount=null;}
}
// My Bets: each member's own bets, a section the admin switches on.
let myBetsMount=null;
function mountMyBets(open){
 if(open&&!myBetsMount&&myBetsRoot){myBetsMount=shownRoot(myBetsRoot,later(<MyBets/>));}
 else if(!open&&myBetsMount){myBetsMount.unmount();myBetsMount=null;}
}
// The Game Predictor: a section the admin switches on (off until then).
let gamePredictorMount=null;
function mountGamePredictor(open){
 if(open&&!gamePredictorMount&&gamePredictorRoot){gamePredictorMount=shownRoot(gamePredictorRoot,later(<GamePredictor/>));}
 else if(!open&&gamePredictorMount){gamePredictorMount.unmount();gamePredictorMount=null;}
}
// The Props tab's NBA side: its league switch mounts only for someone the
// NBA side is switched on for; everyone else sees the MLB board alone.
const propsLeagueRoot=document.getElementById('props-league-root');
let propsLeagueMount=null;
// The Props tab's leagues this person has (NBA, NFL): their lines and hit
// rates load in idle time after the site opens, each once, so the tab shows
// them at once.
const propsLeagues=policy=>['nba','nfl'].filter(league=>canUsePropsLeague(policy,league));
const propsWarmed=new Set();
function warmPropsLeague(leagues){
 const fresh=leagues.filter(league=>!propsWarmed.has(league));
 if(!fresh.length)return;
 fresh.forEach(league=>propsWarmed.add(league));
 const go=()=>{
  if(fresh.includes('nba')){import('./NbaMatchups').catch(()=>{});import('./nba-props-data').then(module=>module.warmNbaProps()).catch(()=>{});}
  if(fresh.includes('nfl')){import('./NflMatchups').catch(()=>{});import('./nfl-props-data').then(module=>module.nfl.warm()).catch(()=>{});}
 };
 setTimeout(()=>(window.requestIdleCallback?window.requestIdleCallback(go,{timeout:6000}):go()),3000);
}
function mountPropsLeague(leagues){
 if(leagues.length)warmPropsLeague(leagues);
 if(leagues.length&&!propsLeagueMount&&propsLeagueRoot){propsLeagueMount=shownRoot(propsLeagueRoot,later(<PropsLeague leagues={leagues}/>));}
 else if(!leagues.length&&propsLeagueMount){propsLeagueMount.unmount();propsLeagueMount=null;}
}
let cheatSheetsMount=null;
function mountCheatSheets(open){
 if(open&&!cheatSheetsMount&&cheatSheetsRoot){cheatSheetsMount=shownRoot(cheatSheetsRoot,later(<CheatSheets/>));}
 else if(!open&&cheatSheetsMount){cheatSheetsMount.unmount();cheatSheetsMount=null;}
}
window.addEventListener('vortex:site-policy',event=>{mountPrivateResearch(event.detail.accessGranted);mountAdminSections(Boolean(event.detail.accessGranted&&event.detail.isAdmin));mountKrazyBot(canUseTab(event.detail,'bot'));mountCheatSheets(canUseTab(event.detail,'sheets'));mountPromoBoard(canUseTab(event.detail,'promos'));mountMyBets(canUseTab(event.detail,'bets'));mountGamePredictor(canUseTab(event.detail,'predictor'));mountPropsLeague(propsLeagues(event.detail));});
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
  root.render(<Suspense fallback={null}><LandingPage {...props} /></Suspense>);
  return () => root.unmount();
};

// Same sparkles background as the landing page, mounted behind the vanilla
// sign-in/sign-up auth card (src/site-access.js renderAuthCard()) so the
// two screens visually match.
window.vortexMountSparklesBackground = (host, props) => {
  const root = createRoot(host);
  root.render(<Suspense fallback={null}><SparklesBackground {...props} /></Suspense>);
  return () => root.unmount();
};

// The sign-in/sign-up card (src/site-access.js renderAuthCard()), replacing
// the old vanilla authForm() markup with the pasted "login-signup" design.
window.vortexMountAuthCard = (host, props) => {
  const root = createRoot(host);
  root.render(<Suspense fallback={null}><AuthCard {...props} /></Suspense>);
  return () => root.unmount();
};

// The hidden in-app admin PIN prompt (3 rapid clicks on the settings gear,
// app.js's openV2PinPrompt()), styled the same as AuthCard's admin mode.
window.vortexMountAdminPin = (host, props) => {
  const root = createRoot(host);
  root.render(<Suspense fallback={null}><AdminPinCard {...props} /></Suspense>);
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
// Each row is the line and its marks only: the book's logo, and Goblin or
// Demon's beside PrizePicks' (Oct 30: "remove the little 1 book text and the
// others like goblin and demon ... keep the icons"). The tier's name is
// still read out (the row's aria-label).
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
            <SelectItem key={line.value} index={index} value={String(line.value)} aria-label={`${line.value} ${line.books?.length && !PP_TIER_ICON[line.tier] ? [...new Set(line.books.map(book => BOOK_NAME[book] || book))].join(', ') : PP_TIER_LABEL[line.tier] || 'Alt'}`}>
              <span className="pp-select-line-row">
                <span className="pp-select-line-value">{line.value}</span>
                <LinePrimaryMark line={line.books?.length ? line : {...line,primaryBook:'prizepicks'}} size={18} />
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
// An option may carry a `logo` (the Team and Opponent menus' team logos).
function OptionWithLogo({ option, size }) {
  return <span className="trend-opt"><img src={option.logo} alt="" width={size} height={size} loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} />{option.label}</span>;
}
function SimpleSelectHost({ controllerRef, onPick, ariaLabel, isTrend = false }) {
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState('');
  const [disabled, setDisabled] = useState(false);
  controllerRef.current = { setOptions, setValue, setDisabled };
  const picked = options.find((opt) => opt.value === value);
  return (
    <Select value={value} onValueChange={(next) => { setValue(next); onPick(next); }} disabled={disabled}>
      <SelectTrigger placeholder="All" aria-label={ariaLabel} displayValue={picked?.logo ? <OptionWithLogo option={picked} size={16} /> : undefined} />
      <SelectContent className={isTrend ? 'trend-select-menu' : undefined} align={isTrend ? 'end' : 'start'}>
        {options.map((opt, index) => <SelectItem key={opt.value} index={index} value={opt.value} aria-label={opt.label}>{opt.logo ? <OptionWithLogo option={opt} size={18} /> : opt.label}</SelectItem>)}
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
