import {dockState} from './src/mobile-nav-core.js';
import {initSiteAccess,siteTabAllowed,siteIsAdmin,loadSiteControls,showLockedTab,availableSiteTab,refreshSiteAccess,dismissBootLoader} from './src/site-access.js';
import {ADMIN_TABS} from './src/site-access-core.js';
import {isOldBrandTheme} from './src/brand-colors.js';
import {LOOKS,GRADIENTS,DEFAULT_BASE,lookOf,applyLook,normalizeBase,normalizeBright,normalizeGrad,tintOf} from './src/site-look.js';
/* =========================================================
   PropScout research — client-side renderer
   No backend, no database, no odds API. Reads a single JSON
   file and lets you search + render one full prop breakdown
   at a time (mirrors the /prediction command output).
   Saved props persist locally via localStorage only.
   ========================================================= */


/**
 * Single source of truth for where prop research data comes from.
 * Swap this one line later (e.g. a KV store URL or API endpoint)
 * and nothing else in this file needs to change, as long as the
 * response shape matches { props: [...] }.
 */
import { mountResearchTabs, focusResearchTab } from './src/report-tabs.js';
import { finderMarket, finderRows, historyChart, nameKey } from './src/prop-finder-core.js';
import { createTrendCache, trendContextKey, gradeTrendChart, mergeTrendCharts } from './src/trend-data.js';
import { matchupNumber, boardResearchSide, matchupUpdatedText, canReuseResearch } from './src/matchup-rating.js';
import { createResearchClient } from './src/research-client.js';

/**
 * Live-compute endpoint — used for every searched player/stat/line/side
 * (there is no static seed of props any more). One-line-swap contract:
 * change this and nothing else needs to change, as long as the response
 * matches a single prop object (same shape as one entry in props[]).
 */
const API_SOURCE = "/api/prediction";
const API_PLAYERS_SOURCE = "/api/players";
const API_PRIZEPICKS_EXPORT = "/api/prediction?action=prizepicks-export";
const researchClient = createResearchClient({ endpoint: API_SOURCE });

const SAVED_KEY = "vortex_saved_prop_ids";
const AVATAR_HUES = [168, 262, 24, 200, 330, 48, 140, 300];

// Just names, not data -- every lookup still goes through the live API.
const SUGGESTED_PLAYERS = ["Shohei Ohtani", "Freddie Freeman", "Aaron Judge"];

// Standard MLB batter prop types, always offered for a batter even with no
// static entry — the live API can compute any of these on demand.
// "Strikeouts" here is the BATTER'S OWN strikeouts (as a hitter) -- a
// completely different prop_type from "Strikeouts (Pitcher)" below.
const BATTER_STATS = [
  "Hits+Runs+RBIs", "Hits", "Total Bases", "Home Runs",
  "RBIs", "Runs Scored", "Strikeouts", "Walks", "Fantasy Score",
];

// Pitcher prop types -- shown instead of BATTER_STATS when the searched
// player is a pitcher (position "P").
const PITCHER_STATS = [
  "Strikeouts (Pitcher)", "Pitching Outs", "Earned Runs Allowed",
  "Hits Allowed", "Walks Allowed", "Fantasy Score (Pitcher)",
];

// Combined list used only when a player's position isn't known yet (e.g.
// typed-then-Entered names that never went through autocomplete) -- shows
// everything rather than guessing wrong and hiding a valid option.
const STANDARD_STATS = [...BATTER_STATS, ...PITCHER_STATS];

// Typical opening line per stat, used only when there's no static data to
// infer a line from. A flat fallback capped every stat's slider at the
// same narrow range regardless of typical scale (a pitcher K prop routinely
// opens at 5.5+, a batter's own K prop rarely clears 1.5) -- this gives
// each stat a sane starting point and a proportional slider range.
// The board mirrors the Discord bot's engine, whose MLB stat labels
// (backend/update_board.py MARKET_LABELS) don't all match Research's display
// stat strings 1:1 — the bot calls the pitcher-K market plain "Strikeouts",
// Research calls it "Strikeouts (Pitcher)". This maps a board prop to the
// exact Research stat string so Deep Dive opens the right dropdown option.
// Bot labels missing here (NBA/WNBA stats) simply don't offer Deep Dive —
// Research is MLB-only.
const BOT_STAT_TO_RESEARCH_STAT = {
  "Hits": "Hits",
  "Total Bases": "Total Bases",
  "Home Runs": "Home Runs",
  "RBIs": "RBIs",
  "Runs Scored": "Runs Scored",
  "Hits+Runs+RBIs": "Hits+Runs+RBIs",
  "Fantasy Score (PP)": "Fantasy Score",
  "Strikeouts": "Strikeouts (Pitcher)",
  "Outs": "Pitching Outs",
  "Hits Allowed": "Hits Allowed",
  "Earned Runs": "Earned Runs Allowed",
  "Walks Allowed": "Walks Allowed",
};
// Bot labels that belong to the pitcher pipeline (position "P" in Research).
const BOT_PITCHER_STATS = new Set(["Strikeouts", "Outs", "Hits Allowed", "Earned Runs", "Walks Allowed"]);

const STAT_DEFAULT_LINE = {
  "Hits+Runs+RBIs": 1.5,
  "Hits": 0.5,
  "Total Bases": 1.5,
  "Home Runs": 0.5,
  "RBIs": 0.5,
  "Runs Scored": 0.5,
  "Strikeouts": 1.5,
  "Walks": 0.5,
  "Fantasy Score": 8.5,
  "Strikeouts (Pitcher)": 5.5,
  "Pitching Outs": 15.5,
  "Earned Runs Allowed": 2.5,
  "Hits Allowed": 5.5,
  "Walks Allowed": 1.5,
  "Fantasy Score (Pitcher)": 15.5,
  "Stolen Bases": 0.5,
  "Singles": 0.5,
  "Pitches Thrown": 85.5,
  "Pitcher Fantasy Score": 15.5,
  "1st Inning Hits Allowed": 0.5,
  "1st Inning Runs Allowed": 0.5,
  "1st Inning Pitches Thrown": 15.5,
  "1st Inning Walks Allowed": 0.5,
  "1st Inning Strikeouts": 0.5,
};

const state = {
  props: [],
  activeIndex: -1,
  savedProps: loadSaved(), // Map<id, prop>
  // When Research is opened from a board prop, keep the board refresh's
  // matchup grade authoritative for that exact player/stat/line/side.
  boardResearchContext: null,


  parlaySelection: new Set(),
  currentTab: "finder",
  slateLoaded: false,
  v2BoardLoaded: false,
  v2BoardData: null,
  v2RenderedProps: [],
  boardFilter: "all",
  matchupDisplayLimit: 40,
  matchupGameFilter: "all",
  pitcherFinderLoaded: false,
  pitcherFinderProps: [],
  pitcherFinderFilter: "all",
  specialsLoaded: false,
  specialsData: null,
  adminRecords: null,
  adminRecordTab: "props",
  adminUnlocked: false,
  adminLiveTimer: null,
};

const els = {};
let lineDebounceTimer = null;
let lineSelectionToken = 0;
let researchPrefetchTimer = null;

const THEME_KEY = "vortex_theme_mode";
const ACCENT_THEME_KEY = "vortex_custom_accents";
const ACCENT_PRESETS_KEY = "vortex_accent_presets";
const BG_IMAGE_KEY = "vortex_bg_image";
const DEFAULT_ACCENTS = Object.freeze({ primary: "#ffffff", secondary: "#a3a3a3", tint: 0, base: DEFAULT_BASE, bright: 0, grad: null, sway: true });
// What's on the page now (applyAccentTheme): the account sheet's colors read it.
let appliedTheme = { ...DEFAULT_ACCENTS };
// The old blue brand colours give way to the new default (src/brand-colors.js).
const isLegacyAccent = isOldBrandTheme;
try {
  const savedAccent = JSON.parse(localStorage.getItem(ACCENT_THEME_KEY) || "null");
  if (isLegacyAccent(savedAccent)) localStorage.removeItem(ACCENT_THEME_KEY);
} catch (_) { /* private mode or a bad value: nothing to move */ }

const EXPERIENCE_KEY = "private_jarvis_interface";
// User accents are applied before the first paint and remain independent of
// the fixed charcoal surface system. The site's own theme (if any) arrives
// later via the site-status poll and is applied by applyEffectiveAccentTheme
// once it's known -- this first pass just avoids a flash of unstyled colors.
applyAccentTheme(loadAccentTheme(), { persist: false });
applyExperience(localStorage.getItem(EXPERIENCE_KEY) === "true");

const SCREEN_TITLES = Object.freeze({ research: "Research", finder: "Finder", moves: "Line Moves", v2: "Props", slate: "Tools", saved: "My Slip", builder: "Parlay Builder", slip: "Slip Analyzer", moneyline: "Moneylines", export: "Slip to PrizePicks", bot: "Scout Assistant", sheets: "Cheat Sheets", promos: "Promo Board", bets: "My Bets", predictor: "Game Predictor", nrfi: "NRFI / YRFI", community: "Community", admin: "Admin Results" });
// The URL path for each tab differs from its internal id in a few cases
// (v2 -> /props, slate -> /tools, slip -> /slip-analyzer) so the address
// bar reads naturally -- everything else just uses its id as-is.
const SCREEN_SLUGS = Object.freeze({ v2: "props", slate: "tools", slip: "slip-analyzer", sheets: "cheat-sheets", export: "slip-to-prizepicks", bets: "my-bets", predictor: "game-predictor" });
const SLUG_TO_TAB = Object.freeze(Object.fromEntries(Object.keys(SCREEN_TITLES).map((tab) => [SCREEN_SLUGS[tab] || tab, tab])));
const screenScroll = new Map();
let screenHistoryReady = false;

init();

async function init() {
  cacheEls();
  try {
    const access=await checkAuth();
    state.adminUnlocked=Boolean(access?.isAdmin);
  } catch (err) {
    console.error("checkAuth failed:", err);
  }
  try {
    wireSettingsPanel();
  } catch (err) {
    console.error("wireSettingsPanel failed:", err);
  }
  try {
    wireGameLogModal();
  } catch (err) {
    console.error("wireGameLogModal failed:", err);
  }
  try {
    wireResearchPolish();
  } catch (err) {
    console.error("wireResearchPolish failed:", err);
  }
  try {
    wireTeamModal();
  } catch (err) {
    console.error("wireTeamModal failed:", err);
  }
  try {
    wireChromeAutoHide();
  } catch (err) {
    console.error("wireChromeAutoHide failed:", err);
  }
  wireBrandLoop();
  wireTabs();
  wireMainMenu();
  try {
    wireCommunityFeed();
  } catch (err) {
    console.error("wireCommunityFeed failed:", err);
  }
  try {
    wireSlipShare();
  } catch (err) {
    console.error("wireSlipShare failed:", err);
  }

  // There is no static seed of props: the old predictions.json was never
  // deployed, so asking for it only held up the start of every page load
  // for a round trip and logged an error. Every prop comes from live
  // research.
  state.props = [];

  clearIntroAnimations();
  wireSearch();
  wireLinePicker();
  renderBrowseChips();
  renderRecentSearches();
  wireSavedToolbar();
  wireManualBetSlip();
  renderSavedGrid();
  wireSlate();
  wireV2Board();
  wireAdminPanel();
  wireSidePanel();
  wireSpecialMarkets();
  wirePlayerDetailModal();
  updateSavedCount();
  updateParlayBar();
  await finishPrivateLoader();
  wireAppNavigation();
  const warmSlate = () => requestSlateData(false).catch(() => {});
  warmPlayerCatalog();
  loadPitcherFinder();
  if ("requestIdleCallback" in window) requestIdleCallback(warmSlate, { timeout: 2200 });
  else setTimeout(warmSlate, 900);
}

// Wraps a React-island bridge (src/main.jsx, e.g. window.vortexStatSelect)
// so a problem inside it can never cascade into breaking the vanilla code
// that calls it -- one such regression already took down the rest of
// selectPlayer() (skipped hiding search/recent-players, left the report
// half-rendered) when an unrelated bug threw partway through.
function wireBridge(raw, methodNames) {
  if (!raw) return null;
  const safe = {};
  for (const name of methodNames) {
    safe[name] = (...args) => {
      try { raw[name](...args); } catch (err) { console.error(`bridge ${name} failed:`, err); }
    };
  }
  return safe;
}

function cacheEls() {
  els.searchInput = document.getElementById("search-input");
  els.searchResults = document.getElementById("search-results");
  els.recentSearches = document.getElementById("recent-searches");
  els.reportWrap = document.getElementById("report-wrap");
  els.emptyState = document.getElementById("empty-state");
  els.browseChips = document.getElementById("browse-chips");
  els.v2BackBtn = document.getElementById("v2-back-btn");

  els.playerProfile = document.getElementById("player-profile");
  els.profileAvatar = document.getElementById("profile-avatar");
  els.profileName = document.getElementById("profile-name");
  els.profileSub = document.getElementById("profile-sub");
  els.profileStats = document.getElementById("profile-stats");
  els.profileStatsWrap = document.getElementById("profile-stats-wrap");
  // The visual picker is a React-mounted Select (src/main.jsx); this hidden
  // <select> stays the real value/change-event source everything else here
  // reads and writes.
  els.profileStatsBridge = wireBridge(window.vortexStatSelect, ["setOptions", "setValue"]);

  els.linePicker = document.getElementById("line-picker");
  els.sideToggle = document.getElementById("side-toggle");
  els.lineNumber = document.getElementById("line-number");
  els.lineSlider = document.getElementById("line-slider");
  els.lineStepDown = document.getElementById("line-step-down");
  els.lineStepUp = document.getElementById("line-step-up");
  els.lineNoData = document.getElementById("line-no-data");
  els.ppLinesWrap = document.getElementById("pp-lines-wrap");
  // The visual picker is a React-mounted Select (src/main.jsx); loadPrizePicksLines()
  // below stays the real fetch/cache/eligibility source of truth and just
  // hands this a ready-to-render list, same pattern as profileStatsBridge.
  els.ppLinesBridge = wireBridge(window.vortexAltLinesSelect, ["setLines", "setValue", "setStatus"]);
  // Same bridge pattern, separate mount -- the Trend tab's own alt-lines
  // picker (src/main.jsx's second AltLinesSelectHost instance).
  els.gamelogLinesBridge = wireBridge(window.vortexGamelogLinesSelect, ["setLines", "setValue", "setStatus"]);

  els.tabs = document.getElementById("tabs");
  els.tabIndicator = document.getElementById("tab-indicator");
  els.panelResearch = document.getElementById("panel-research");
  els.panelSaved = document.getElementById("panel-saved");
  els.savedCount = document.getElementById("saved-count");

  els.panelSlate = document.getElementById("panel-slate");
  els.slateList = document.getElementById("slate-list");
  els.slateEmpty = document.getElementById("slate-empty");
  els.slateLoading = document.getElementById("slate-loading");
  els.slateError = document.getElementById("slate-error");
  els.slateDate = document.getElementById("slate-date");
  els.slateRefreshBtn = document.getElementById("slate-refresh-btn");

  els.panelV2 = document.getElementById("panel-v2");
  els.panelFinder = document.getElementById("panel-finder");
  els.panelMoves = document.getElementById("panel-moves");
  els.panelBuilder = document.getElementById("panel-builder");
  els.panelSlip = document.getElementById("panel-slip");
  els.panelMoneyline = document.getElementById("panel-moneyline");
  els.panelBot = document.getElementById("panel-bot");
  els.panelSheets = document.getElementById("panel-sheets");
  els.panelPromos = document.getElementById("panel-promos");
  els.panelBets = document.getElementById("panel-bets");
  els.panelPredictor = document.getElementById("panel-predictor");
  els.panelExport = document.getElementById("panel-export");
  els.panelNrfi = document.getElementById("panel-nrfi");
  els.panelAdmin = document.getElementById("panel-admin");
  els.panelCommunity = document.getElementById("panel-community");
  els.communityRefresh = document.getElementById("community-refresh");
  els.communityComposer = document.getElementById("community-composer");
  els.communityComposerText = document.getElementById("community-composer-text");
  els.communityComposerPreview = document.getElementById("community-composer-preview");
  els.communityComposerPreviewImg = document.getElementById("community-composer-preview-img");
  els.communityComposerRemoveImage = document.getElementById("community-composer-remove-image");
  els.communityComposerUpload = document.getElementById("community-composer-upload");
  els.communityComposerFile = document.getElementById("community-composer-file");
  els.communityComposerSubmit = document.getElementById("community-composer-submit");
  els.communityComposerStatus = document.getElementById("community-composer-status");
  els.communityFeedList = document.getElementById("community-feed-list");
  els.communityEmpty = document.getElementById("community-empty");
  els.communitySignedOut = document.getElementById("community-signed-out");
  els.nrfiList = document.getElementById("nrfi-list");
  els.nrfiEmpty = document.getElementById("nrfi-empty");
  els.nrfiRefresh = document.getElementById("nrfi-refresh");
  els.adminUnlock = document.getElementById("admin-unlock");
  els.adminResultTabs = document.getElementById("admin-result-tabs");
  els.adminResultsList = document.getElementById("admin-results-list");
  els.sidePanel = document.getElementById("side-panel");
  els.sideScrim = document.getElementById("side-scrim");
  els.sideMenuToggle = document.getElementById("side-menu-toggle");
  els.sideMenuClose = document.getElementById("side-menu-close");
  els.v2BoardList = document.getElementById("v2-board-list");
  els.v2BoardEmpty = document.getElementById("v2-board-empty");
  els.v2BoardError = document.getElementById("v2-board-error");
  els.v2BoardDate = document.getElementById("v2-board-date");
  els.v2RefreshBtn = document.getElementById("v2-refresh-btn");
  els.boardFilterRow = document.getElementById("board-filter-row");
  els.matchupGamePicker = document.getElementById("matchup-game-picker");
  els.matchupGameTrigger = document.getElementById("matchup-game-trigger");
  els.matchupGameMenu = document.getElementById("matchup-game-menu");
  els.matchupGameLabel = document.getElementById("matchup-game-label");
  els.matchupGameMeta = document.getElementById("matchup-game-meta");
  els.pitcherFinder = document.getElementById("pitcher-finder");
  els.pitcherFinderTabs = document.getElementById("pitcher-finder-tabs");
  els.pitcherFinderList = document.getElementById("pitcher-finder-list");
  els.pitcherFinderState = document.getElementById("pitcher-finder-state");
  els.pitcherFinderCount = document.getElementById("pitcher-finder-count");
  els.pitcherFinderRefresh = document.getElementById("pitcher-finder-refresh");
  els.pitcherBoardLabel = document.getElementById("pitcher-board-label");
  els.autoBoardState = document.getElementById("auto-board-state");
  els.autoActiveCadence = document.getElementById("auto-active-cadence");
  els.autoPregameCadence = document.getElementById("auto-pregame-cadence");
  els.autoCreditBudget = document.getElementById("auto-credit-budget");
  els.autoMonthlyReserve = document.getElementById("auto-monthly-reserve");

  els.v2AdminOverlay = document.getElementById("v2-admin-overlay");
  els.v2AdminClose = document.getElementById("v2-admin-close");
  els.v2AdminKeyStatus = document.getElementById("v2-admin-key-status");
  els.v2AdminKeyInput = document.getElementById("v2-admin-key-input");
  els.v2AdminKeySave = document.getElementById("v2-admin-key-save");
  els.v2AdminKeyMsg = document.getElementById("v2-admin-key-msg");
  els.v2AdminScanBtn = document.getElementById("v2-admin-scan-btn");
  els.v2AdminScanMsg = document.getElementById("v2-admin-scan-msg");
  els.nflAdminScanBtn = document.getElementById("nfl-admin-scan-btn");
  els.nflAdminScanMsg = document.getElementById("nfl-admin-scan-msg");

  els.savedGrid = document.getElementById("saved-grid");
  els.savedEmpty = document.getElementById("saved-empty");
  els.clearSavedBtn = document.getElementById("clear-saved-btn");
  els.shareSlipBtn = document.getElementById("share-slip-btn");

  els.parlayBar = document.getElementById("parlay-bar");
  els.parlaySelectedCount = document.getElementById("parlay-selected-count");
  els.parlayClearBtn = document.getElementById("parlay-clear-btn");
  els.parlayCompareBtn = document.getElementById("parlay-compare-btn");
  els.parlayView = document.getElementById("parlay-view");

  els.headerBuilderTrigger = document.getElementById("header-builder-trigger");
  els.headerBuilderCount = document.getElementById("header-builder-count");
  els.betSlipScrim = document.getElementById("bet-slip-scrim");
  els.betSlipDrawer = document.getElementById("bet-slip-drawer");
  els.betSlipClose = document.getElementById("bet-slip-close");
  els.betSlipHeadline = document.getElementById("bet-slip-headline");
  els.betSlipLegs = document.getElementById("bet-slip-legs");
  els.betSlipEmpty = document.getElementById("bet-slip-empty");
  els.betSlipStatus = document.getElementById("bet-slip-status");
  els.betSlipClear = document.getElementById("bet-slip-clear");
  els.betSlipExport = document.getElementById("bet-slip-export");

  els.toastStack = document.getElementById("toast-stack");

  els.appShell = document.getElementById("app-shell");
  els.mainMenu = document.getElementById("main-menu");
  els.authGate = document.getElementById("auth-gate");
  els.authGateMsg = document.getElementById("auth-gate-msg");
  els.userBadge = document.getElementById("user-badge");
  els.userBadgeName = document.getElementById("user-badge-name");

  els.settingsBtn = document.getElementById("settings-btn");
  els.settingsPanel = document.getElementById("settings-panel");
  els.primaryAccent = document.getElementById("primary-accent");
  els.secondaryAccent = document.getElementById("secondary-accent");
  els.accentTint = document.getElementById("accent-tint");
  els.lookSwatches = document.getElementById("look-swatches");
  els.lookBright = document.getElementById("look-bright");
  els.lookBrightValue = document.getElementById("look-bright-value");
  els.lookGrads = document.getElementById("look-grads");
  els.lookGradA = document.getElementById("look-grad-a");
  els.lookGradB = document.getElementById("look-grad-b");
  els.lookSway = document.getElementById("look-sway");
  renderLookSwatches();
  const shown = loadAccentTheme();
  syncLookControls(shown.base, shown.bright, shown.grad, shown.sway);
  els.primaryAccentValue = document.getElementById("primary-accent-value");
  els.secondaryAccentValue = document.getElementById("secondary-accent-value");
  els.accentTintValue = document.getElementById("accent-tint-value");
  els.accentPresetName = document.getElementById("accent-preset-name");
  els.accentPresetSave = document.getElementById("accent-preset-save");
  els.accentPresets = document.getElementById("accent-presets");
  els.accentReset = document.getElementById("accent-reset");
  els.accentStatus = document.getElementById("accent-status");
  els.appearanceNotice = document.getElementById("site-appearance-notice");
  els.appearanceNoticeText = document.getElementById("site-appearance-notice-text");
  els.appearanceToggle = document.getElementById("site-appearance-toggle");
  els.bgImageLayer = document.getElementById("user-bg-layer");
  els.bgImageUrl = document.getElementById("bg-image-url");
  els.bgImageOpacity = document.getElementById("bg-image-opacity");
  els.bgImageOpacityValue = document.getElementById("bg-image-opacity-value");
  els.bgImageApply = document.getElementById("bg-image-apply");
  els.bgImageRemove = document.getElementById("bg-image-remove");
  els.bgImageStatus = document.getElementById("bg-image-status");
  els.bgImageUploadBtn = document.getElementById("bg-image-upload");
  els.bgImageFile = document.getElementById("bg-image-file");
  els.gamelogOverlay = document.getElementById("gamelog-overlay");
  els.gamelogTitle = document.getElementById("gamelog-title");
  els.gamelogSave = document.getElementById("gamelog-save");
  els.gamelogPropBadge = document.getElementById("gamelog-prop-badge");
  els.gamelogTeamMark = document.getElementById("gamelog-team-mark");
  els.gamelogPlayerCutout = document.getElementById("gamelog-player-cutout");
  els.gamelogTabs = document.getElementById("gamelog-tabs");
  els.gamelogSub = document.getElementById("gamelog-sub");
  els.gamelogChart = document.getElementById("gamelog-chart");
  els.gamelogOddsRow = document.getElementById("gamelog-odds-row");
  // Season/Matchup/Location used to be native <select> elements; now
  // React-mounted Selects (src/main.jsx's SimpleSelectHost) -- these
  // bridges are the same setOptions/setValue/setDisabled pattern as
  // profileStatsBridge/ppLinesBridge above.
  els.glHandFilterBridge = wireBridge(window.vortexGamelogHandSelect, ["setOptions", "setValue", "setDisabled"]);
  els.glVenueFilterBridge = wireBridge(window.vortexGamelogVenueSelect, ["setOptions", "setValue"]);
  els.gamelogSeasonBridge = wireBridge(window.vortexGamelogSeasonSelect, ["setOptions", "setValue"]);
  els.gamelogStatTabs = document.getElementById("gamelog-stat-tabs");
  els.gamelogLineDown = document.getElementById("gamelog-line-down");
  els.gamelogLineUp = document.getElementById("gamelog-line-up");
  els.gamelogLineValue = document.getElementById("gamelog-line-value");
  els.gamelogFilterPanel = document.getElementById("gamelog-filter-panel");
  els.gamelogStudio = document.getElementById("gamelog-studio");
  els.gamelogHandField = document.getElementById("gl-hand-field");
  els.glExtraFields = Object.fromEntries(["opponent", "league", "team"].map((field) => [field, document.getElementById(`gl-${field}-field`)]));
  els.glExtraBridges = Object.fromEntries(["opponent", "league", "team"].map((field) => [field, wireBridge(window.vortexGamelogExtraSelects?.[field], ["setOptions", "setValue"])]));
  els.glKindField = document.getElementById("gl-kind-field");
  els.glKindBridge = wireBridge(window.vortexGamelogKindSelect, ["setOptions", "setValue"]);
  els.glYearLabel = document.getElementById("gl-year-label");

  els.teamOverlay = document.getElementById("team-overlay");
  els.teamTitle = document.getElementById("team-title");
  els.teamLineupNote = document.getElementById("team-lineup-note");
  els.teamClose = document.getElementById("team-close");
  els.teamTabs = document.getElementById("team-tabs");
  els.teamViewOrder = document.getElementById("team-view-order");
  els.teamViewArsenal = document.getElementById("team-view-arsenal");
  els.orderFilterRow = document.getElementById("order-filter-row");
  els.orderTbody = document.getElementById("order-tbody");
  els.orderVolumeHead = document.getElementById("order-volume-head");
  els.orderEmpty = document.getElementById("order-empty");
  els.arsenalFilterRow = document.getElementById("arsenal-filter-row");
  els.arsenalSummary = document.getElementById("arsenal-summary");
  els.arsenalTbody = document.getElementById("arsenal-tbody");
  els.arsenalEmpty = document.getElementById("arsenal-empty");
  els.arsenalModePitches = document.getElementById("arsenal-mode-pitches");
  els.arsenalModeArm = document.getElementById("arsenal-mode-arm");
  els.arsenalPitchesPanel = document.getElementById("arsenal-pitches-panel");
  els.arsenalArmPanel = document.getElementById("arsenal-arm-panel");
  els.armSlotProfile = document.getElementById("arm-slot-profile");
  els.armSlotTbody = document.getElementById("arm-slot-tbody");
  els.armSlotEmpty = document.getElementById("arm-slot-empty");
}

/* ---------- Theme (mode + accent) ---------- */

function normalizeAccentHex(value, fallback) {
  const hex = String(value || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : fallback;
}

function normalizeTint(value, fallback = DEFAULT_ACCENTS.tint) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(0, Math.min(35, Math.round(num))) : fallback;
}

function loadAccentTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCENT_THEME_KEY) || "null");
    return withBackground({
      primary: normalizeAccentHex(saved?.primary, DEFAULT_ACCENTS.primary),
      secondary: normalizeAccentHex(saved?.secondary, DEFAULT_ACCENTS.secondary),
      tint: normalizeTint(saved?.tint),
      base: saved?.base, bright: saved?.bright, grad: saved?.grad, sway: saved?.sway,
    });
  } catch (_) {
    return { ...DEFAULT_ACCENTS };
  }
}

// The background color (src/site-look.js). A theme saved before it had a
// Background tint instead (the secondary color mixed into the page):
// that becomes the background it made, so the page looks the same.
function withBackground(theme) {
  if (theme.base == null && normalizeTint(theme.tint) > 0) {
    const share = normalizeTint(theme.tint) / 100, from = normalizeAccentHex(theme.secondary, DEFAULT_ACCENTS.secondary);
    const base = "#" + [1, 3, 5].map((at) => Math.round(parseInt(from.slice(at, at + 2), 16) * share + 10 * (1 - share)).toString(16).padStart(2, "0")).join("");
    return { ...theme, tint: 0, base, bright: 0, grad: null, sway: true };
  }
  return { ...theme, tint: normalizeTint(theme.tint), base: normalizeBase(theme.base), bright: normalizeBright(theme.bright),
    grad: normalizeGrad(theme.grad), sway: theme.sway !== false };
}

function accentTextColor(hex) {
  const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = rgb.reduce((sum, channel, index) => {
    const linear = channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  return luminance > .42 ? "#121212" : "#ffffff";
}

function applyAccentTheme(theme, { persist = true, syncControls = true } = {}) {
  const primary = normalizeAccentHex(theme?.primary, DEFAULT_ACCENTS.primary);
  const secondary = normalizeAccentHex(theme?.secondary, DEFAULT_ACCENTS.secondary);
  const { tint, base, bright, grad, sway } = withBackground({ secondary, tint: theme?.tint, base: theme?.base, bright: theme?.bright, grad: theme?.grad, sway: theme?.sway });
  const look = lookOf(base, bright, grad, sway);
  applyLook(look);
  appliedTheme = { primary, secondary, tint, base, bright, grad, sway };
  const root = document.documentElement;
  root.setAttribute("data-theme", "obsidian");
  root.setAttribute("data-custom-accents", "true");
  root.style.setProperty("--theme-accent", primary);
  root.style.setProperty("--theme-accent-soft", `color-mix(in srgb, ${primary} 72%, white)`);
  root.style.setProperty("--theme-secondary", secondary);
  root.style.setProperty("--theme-bg-tint", `${tint}%`);
  root.style.setProperty("--theme-bg2-tint", `${Math.min(40, tint + 3)}%`);
  root.style.setProperty("--theme-panel-tint", `${Math.round(tint * .7)}%`);
  root.style.setProperty("--theme-panel2-tint", `${Math.min(40, tint + 2)}%`);
  root.style.setProperty("--theme-border-tint", `${Math.min(45, tint + 7)}%`);
  root.style.setProperty("--theme-accent-dim", `color-mix(in srgb, ${primary} 14%, transparent)`);
  root.style.setProperty("--theme-on-accent", accentTextColor(primary));
  localStorage.removeItem(THEME_KEY);
  if (persist) localStorage.setItem(ACCENT_THEME_KEY, JSON.stringify({ primary, secondary, tint, base, bright, grad, sway, look, scout: true, mono: true }));
  if (syncControls) syncLookControls(base, bright, grad, sway);
  window.dispatchEvent(new CustomEvent("propscout:colors"));
  if (syncControls && els.primaryAccent) {
    els.primaryAccent.value = primary;
    els.secondaryAccent.value = secondary;
    if (els.accentTint) els.accentTint.value = String(tint);
    els.primaryAccentValue.textContent = primary.toUpperCase();
    els.secondaryAccentValue.textContent = secondary.toUpperCase();
    if (els.accentTintValue) els.accentTintValue.textContent = `${tint}%`;
  }
}

// The admin's site-wide color theme (from site-status, sent to every
// visitor) normally only ever the *fallback* -- a member's own personal
// accent choice in Settings wins on their device, exactly like the
// background image above. But every time the admin actually publishes a
// NEW site appearance (a new `updatedAt`), it's pushed as forced for
// everyone at least once, even over an existing personal choice -- a
// member can then explicitly switch back to their own colors, which is
// remembered per-version via APPEARANCE_REVERT_KEY, so the next time the
// admin pushes yet another change it forces again regardless of that
// earlier opt-out. `hasPersonalAccentTheme` distinguishes "never
// customized" from "customized to the same hex as the default", since
// loadAccentTheme() always returns a full object either way.
const APPEARANCE_REVERT_KEY = "vortex_appearance_reverted_version";
let siteTheme = null;
let siteUpdatedAt = null;
// The Background swatches (index.html #look-swatches): one per LOOKS color,
// then Custom, a color of the member's own (lit when the background is
// none of the others).
function renderLookSwatches() {
  if (!els.lookSwatches) return;
  els.lookSwatches.innerHTML = LOOKS.map(([color, name]) => `<button type="button" class="look-swatch" data-base="${color}" aria-pressed="false" style="--swatch:${color}"><i aria-hidden="true"></i><span>${name}</span></button>`).join("")
    + `<label class="look-swatch look-custom" data-base="custom"><i aria-hidden="true"></i><input type="color" id="look-custom" value="#3a3a3a" aria-label="Pick your own background color" /><span>Custom</span></label>`;
  els.lookCustom = document.getElementById("look-custom");
  if (els.lookGrads) els.lookGrads.innerHTML = `<button type="button" class="look-grad-chip" data-grad="" aria-pressed="false"><i aria-hidden="true"></i><span>Off</span></button>`
    + GRADIENTS.map(([from, to, name]) => `<button type="button" class="look-grad-chip" data-grad="${from},${to}" aria-pressed="false"><i aria-hidden="true" style="--a:${from};--b:${to}"></i><span>${name}</span></button>`).join("");
}
// The account sheet (AccountSheet.jsx) changes the colors through here, so
// they save and sync like the settings panel's.
window.propscoutColors = {
  current: () => ({ ...appliedTheme }),
  // A color: the accent, and the background a tint of it (no gradient).
  pickColor(hex) {
    applyAccentTheme({ ...appliedTheme, primary: hex, base: tintOf(hex, appliedTheme.base), bright: 0, grad: null });
  },
  // A gradient: its first color the accent.
  pickGradient(pair) {
    applyAccentTheme({ ...appliedTheme, primary: pair[0], grad: pair });
  },
};
function syncLookControls(base, bright, grad = null, sway = true) {
  if (els.lookGrads) {
    const key = grad ? grad.join(",") : "";
    els.lookGrads.dataset.grad = key;
    els.lookGrads.querySelectorAll(".look-grad-chip").forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.grad === key)));
    if (grad && els.lookGradA) { els.lookGradA.value = grad[0]; els.lookGradB.value = grad[1]; }
    if (els.lookSway) els.lookSway.checked = sway !== false;
  }
  if (!els.lookSwatches) return;
  const known = LOOKS.some(([color]) => color === base);
  els.lookSwatches.dataset.base = base;
  els.lookSwatches.querySelectorAll(".look-swatch").forEach((swatch) => {
    const on = swatch.dataset.base === base || (!known && swatch.dataset.base === "custom");
    if (swatch.tagName === "BUTTON") swatch.setAttribute("aria-pressed", String(on));
    swatch.toggleAttribute("data-on", on);
  });
  const custom = els.lookSwatches.querySelector(".look-custom");
  if (custom) custom.style.setProperty("--swatch", known ? "" : base);
  if (els.lookCustom && !known) els.lookCustom.value = base;
  if (els.lookBright) els.lookBright.value = String(bright);
  if (els.lookBrightValue) els.lookBrightValue.textContent = bright > 0 ? `+${bright}` : String(bright);
}

function hasPersonalAccentTheme() {
  // Checked on every use, not only at start-up: signing in can bring an
  // old blue back from the account's synced settings.
  try {
    const saved = JSON.parse(localStorage.getItem(ACCENT_THEME_KEY) || "null");
    return !!saved && !isLegacyAccent(saved);
  } catch (_) { return false; }
}
// True unless this exact site update has already been explicitly opted out
// of on this device (see the Settings-panel "Use my own instead" toggle).
function isAppearanceForced() {
  if (!siteUpdatedAt) return false;
  return localStorage.getItem(APPEARANCE_REVERT_KEY) !== siteUpdatedAt;
}
function applyEffectiveAccentTheme() {
  if (isAppearanceForced()) { applyAccentTheme(siteTheme || DEFAULT_ACCENTS, { persist: false }); return; }
  if (hasPersonalAccentTheme()) { applyAccentTheme(loadAccentTheme(), { persist: false }); return; }
  applyAccentTheme(siteTheme || DEFAULT_ACCENTS, { persist: false });
}
// Shows a small notice in Settings whenever the admin's site-wide colors or
// background are the ones actually in effect (forced or not), with a
// one-click toggle to switch to/from this device's own personal choice.
function renderAppearanceNotice() {
  if (!els.appearanceNotice) return;
  if (!siteUpdatedAt || !(siteTheme || siteBackgroundImage?.url)) { els.appearanceNotice.hidden = true; return; }
  els.appearanceNotice.hidden = false;
  if (isAppearanceForced()) {
    els.appearanceNoticeText.textContent = "The site admin set custom colors and/or a background for everyone.";
    els.appearanceToggle.textContent = "Use my own instead";
  } else {
    els.appearanceNoticeText.textContent = "You're using your own colors/background instead of the site's.";
    els.appearanceToggle.textContent = "Use the site's instead";
  }
}
window.addEventListener("vortex:site-policy", (event) => {
  const detail = event.detail || {};
  if (detail.accessGranted === false) {
    researchClient.clear();
    lineSelectionToken++;
    clearTimeout(lineDebounceTimer);
    clearTimeout(researchPrefetchTimer);
    if (els.reportWrap) clearReport();
  }
  siteUpdatedAt = detail.updatedAt || null;
  const bg = detail.backgroundImage;
  siteBackgroundImage = bg?.url ? { url: bg.url, opacity: normalizeBgOpacity(bg.opacity) } : null;
  const theme = detail.theme;
  siteTheme = theme?.primary && !isLegacyAccent(theme) ? { primary: theme.primary, secondary: theme.secondary, tint: normalizeTint(theme.tint) } : null;
  applyEffectiveAccentTheme();
  applyEffectiveBackground();
  renderAppearanceNotice();
});
// Lets the admin panel show a live, unsaved preview of candidate site
// colors on this page only -- always non-persistent, and re-resolves back
// to the real effective theme (personal, then site, then default) the next
// time either of those actually changes.
window.addEventListener("vortex:site-theme-preview", (event) => {
  applyAccentTheme(event.detail, { persist: false, syncControls: false });
});

function loadAccentPresets() {
  try {
    const saved = JSON.parse(localStorage.getItem(ACCENT_PRESETS_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => item && item.name).slice(0, 12) : [];
  } catch (_) { return []; }
}

function renderAccentPresets() {
  const presets = loadAccentPresets();
  els.accentPresets.innerHTML = presets.length ? "" : `<p class="accent-presets-empty">No saved presets yet.</p>`;
  presets.forEach((preset, index) => {
    const row = document.createElement("div");
    row.className = "accent-preset";
    const presetTint = normalizeTint(preset.tint);
    const presetLook = withBackground(preset), presetPage = lookOf(presetLook.base, presetLook.bright).page;
    row.innerHTML = `<span class="accent-preset-preview" style="--preset-primary:${normalizeAccentHex(preset.primary, DEFAULT_ACCENTS.primary)};--preset-secondary:${normalizeAccentHex(preset.secondary, DEFAULT_ACCENTS.secondary)};--preset-tint:${presetTint}%;--preset-base:${presetPage}"><i></i><i></i></span><span class="accent-preset-name">${escapeHtml(preset.name)}</span><button type="button" aria-label="Delete ${escapeHtml(preset.name)} preset"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="accent-preset-apply" role="button" tabindex="0" aria-label="Apply ${escapeHtml(preset.name)} preset"></span>`;
    const apply = () => {
      applyAccentTheme(preset);
      els.accentStatus.textContent = `${preset.name} applied.`;
    };
    const applyButton = row.querySelector(".accent-preset-apply");
    applyButton.addEventListener("click", apply);
    applyButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); apply(); }
    });
    row.querySelector("button").addEventListener("click", (event) => {
      event.stopPropagation();
      const next = loadAccentPresets();
      next.splice(index, 1);
      localStorage.setItem(ACCENT_PRESETS_KEY, JSON.stringify(next));
      renderAccentPresets();
      els.accentStatus.textContent = `${preset.name} deleted.`;
    });
    els.accentPresets.appendChild(row);
  });
}

/* ---------- Background image (Accent studio) ---------- */

function normalizeBgOpacity(value, fallback = 35) {
  const num = Number(value);
  return Number.isFinite(num) ? Math.max(5, Math.min(100, Math.round(num))) : fallback;
}

// Only http(s) links, a same-origin data: image (from the device-upload
// flow below), or our own relative hosted-image path (from the admin's
// site-wide upload, e.g. /api/v2-admin?action=site-background&v=...) are
// accepted -- background-image never executes a URL as script either way,
// but rejecting anything else keeps the field predictable and gives a
// clear error instead of a silently blank layer.
function normalizeBgUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(trimmed)) return trimmed;
  try {
    // A base is required to resolve our own relative paths -- passed for
    // every case since it's a no-op when `trimmed` is already absolute.
    const parsed = new URL(trimmed, window.location.origin);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
  } catch (_) {
    return "";
  }
}

// Downscales only if larger than maxDim (never upscales a smaller photo,
// which would soften it) and re-encodes at high JPEG quality -- keeps a
// phone-camera-sized photo well under localStorage's quota without a
// visible quality hit at normal background-image viewing sizes.
function resizeImageFile(file, maxDim = 2560) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not decode image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const width = Math.max(1, Math.round(img.naturalWidth * scale));
        const height = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// A photo uploaded from a device (or carried over from the member's account)
// rather than a link they pasted -- the link field stays empty for those.
function isUploadedBackground(url) {
  return url.startsWith("data:") || url.includes("action=account-image");
}

function loadBackgroundImage() {
  try {
    const saved = JSON.parse(localStorage.getItem(BG_IMAGE_KEY) || "null");
    return { url: normalizeBgUrl(saved?.url), opacity: normalizeBgOpacity(saved?.opacity) };
  } catch (_) {
    return { url: "", opacity: 35 };
  }
}

// Tracks whatever is actually live on screen (a pasted link or an
// uploaded photo's data URL) so opacity changes and Remove work the same
// way regardless of which source produced it -- the visible text field
// only ever holds the pasted-link case.
let activeBgUrl = "";

// Verifies the image actually loads before committing it as the live
// background -- a broken URL should produce a clear error, not a blank
// layer or a stuck spinner-less failure.
// The app's own base layers (body/#app-shell/.hero/every .tab-panel) each
// paint their own solid background by default -- a stylesheet override
// alone proved unreliable for some of them (this app's cascade is deep and
// inconsistent across theme passes), so this sets/clears the same effect
// as a direct, guaranteed-to-win inline style instead of trusting a
// selector to out-specificity whatever else targets these elements.
function setBaseBackgroundsCleared(active) {
  const targets = [document.body, document.getElementById("app-shell"), ...document.querySelectorAll(".hero, .tab-panel")];
  for (const el of targets) {
    if (!el) continue;
    if (active) el.style.setProperty("background-color", "transparent", "important");
    else el.style.removeProperty("background-color");
  }
}

function applyBackgroundImage({ url, opacity }, { persist = true, onError, onSuccess } = {}) {
  const cleanUrl = normalizeBgUrl(url);
  const cleanOpacity = normalizeBgOpacity(opacity);
  if (els.bgImageOpacity) els.bgImageOpacity.value = String(cleanOpacity);
  if (els.bgImageOpacityValue) els.bgImageOpacityValue.textContent = `${cleanOpacity}%`;
  if (!cleanUrl) {
    activeBgUrl = "";
    els.bgImageLayer.hidden = true;
    els.bgImageLayer.style.backgroundImage = "";
    document.documentElement.removeAttribute("data-user-bg");
    setBaseBackgroundsCleared(false);
    if (persist) localStorage.removeItem(BG_IMAGE_KEY);
    return;
  }
  const probe = new Image();
  probe.onload = () => {
    activeBgUrl = cleanUrl;
    els.bgImageLayer.style.backgroundImage = `url("${cleanUrl}")`;
    els.bgImageLayer.style.opacity = String(cleanOpacity / 100);
    els.bgImageLayer.hidden = false;
    // The data-user-bg attribute also drives a stylesheet override (see
    // styles.css) as a first line of defense; the inline call below is
    // what actually guarantees it takes effect.
    document.documentElement.setAttribute("data-user-bg", "true");
    setBaseBackgroundsCleared(true);
    if (persist) {
      try {
        localStorage.setItem(BG_IMAGE_KEY, JSON.stringify({ url: cleanUrl, opacity: cleanOpacity }));
      } catch (_) {
        // A very large data URL can exceed the per-origin quota -- the
        // image still displays for this session, it just won't survive
        // a reload. Surfaced to the user via onError rather than silently
        // dropped.
        onError?.(new Error("storage-quota"));
        return;
      }
    }
    onSuccess?.();
  };
  probe.onerror = () => onError?.();
  probe.src = cleanUrl;
}

// The admin's site-wide background (from site-status, sent to every
// visitor) normally only ever the *fallback* -- a member's own personal
// choice in Settings wins on their device -- except right after the admin
// actually publishes a new one, when it's forced at least once; see
// isAppearanceForced() above. Re-resolved whenever either source changes.
let siteBackgroundImage = null;
function applyEffectiveBackground() {
  if (isAppearanceForced()) { applyBackgroundImage(siteBackgroundImage || { url: "", opacity: 35 }, { persist: false }); return; }
  const personal = loadBackgroundImage();
  if (personal.url) { applyBackgroundImage(personal, { persist: false }); return; }
  if (siteBackgroundImage?.url) { applyBackgroundImage(siteBackgroundImage, { persist: false }); return; }
  applyBackgroundImage({ url: "", opacity: 35 }, { persist: false });
}

function wireBackgroundImage() {
  if (!els.bgImageUrl) return;
  const saved = loadBackgroundImage();
  els.bgImageUrl.value = isUploadedBackground(saved.url) ? "" : saved.url;
  applyEffectiveBackground();
  els.bgImageOpacity.addEventListener("input", () => {
    els.bgImageOpacityValue.textContent = `${normalizeBgOpacity(els.bgImageOpacity.value)}%`;
    if (els.bgImageLayer.style.backgroundImage) {
      els.bgImageLayer.style.opacity = String(normalizeBgOpacity(els.bgImageOpacity.value) / 100);
    }
  });
  els.bgImageOpacity.addEventListener("change", () => {
    // The image is already showing and verified; just persist the new
    // opacity rather than re-fetching it to re-validate.
    if (els.bgImageLayer.hidden || !activeBgUrl) return;
    try {
      localStorage.setItem(BG_IMAGE_KEY, JSON.stringify({ url: activeBgUrl, opacity: normalizeBgOpacity(els.bgImageOpacity.value) }));
    } catch (_) { /* Quota already surfaced when the image was first applied. */ }
  });
  els.bgImageApply.addEventListener("click", () => {
    const typed = els.bgImageUrl.value.trim();
    if (!typed) { els.bgImageStatus.textContent = "Paste an image URL first."; return; }
    if (!normalizeBgUrl(typed)) { els.bgImageStatus.textContent = "That doesn't look like a valid http(s) image URL."; return; }
    els.bgImageStatus.textContent = "Loading image…";
    applyBackgroundImage({ url: typed, opacity: els.bgImageOpacity.value }, {
      onError: () => { els.bgImageStatus.textContent = "Couldn't load that image. Check the URL and try again."; },
      onSuccess: () => { els.bgImageStatus.textContent = "Background image applied."; },
    });
  });
  els.bgImageRemove.addEventListener("click", () => {
    els.bgImageUrl.value = "";
    localStorage.removeItem(BG_IMAGE_KEY);
    // Falls back to the site's own background (if the admin has set one)
    // instead of forcing a blank background for everyone.
    applyEffectiveBackground();
    els.bgImageStatus.textContent = siteBackgroundImage?.url
      ? "Personal background removed — showing the site default."
      : "Background image removed.";
  });
  els.bgImageUploadBtn?.addEventListener("click", () => els.bgImageFile.click());
  els.bgImageFile?.addEventListener("change", async () => {
    const file = els.bgImageFile.files?.[0];
    els.bgImageFile.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { els.bgImageStatus.textContent = "Please choose an image file."; return; }
    els.bgImageStatus.textContent = "Processing photo…";
    try {
      const dataUrl = await resizeImageFile(file);
      els.bgImageUrl.value = "";
      applyBackgroundImage({ url: dataUrl, opacity: els.bgImageOpacity.value }, {
        onSuccess: () => { els.bgImageStatus.textContent = "Photo applied from your device."; },
        onError: (error) => {
          els.bgImageStatus.textContent = error?.message === "storage-quota"
            ? "That photo is too large to save on this device; it's applied for now but won't survive a refresh. Try a smaller image."
            : "Couldn't apply that photo.";
        },
      });
    } catch (_) {
      els.bgImageStatus.textContent = "Couldn't read that file. Try a different image.";
    }
  });
}

/* ---------- Community feed ---------- */
// Member picks feed -- visibility is gated entirely server-side by the
// admin's "community" entry in disabledTabs (site_controls.py), so this
// tab simply loads or 401s/403s depending on that and sign-in state; no
// separate feature flag needed here.
let communityPosts = [];
let communityReactionSet = [];
let communityViewerId = null;
let communityPendingImage = null;
let communityLoading = false;

function communityRelativeTime(epochSeconds) {
  if (!epochSeconds) return "";
  const diff = Date.now() / 1000 - epochSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function communityPostCard(post) {
  const mine = post.authorId === communityViewerId;
  const canDelete = mine || communityViewerId === "admin";
  const reactionsHtml = communityReactionSet.map((emoji) => {
    const reactors = post.reactions?.[emoji] || [];
    const active = Boolean(communityViewerId) && reactors.includes(communityViewerId);
    return `<button type="button" class="community-reaction${active ? " active" : ""}" data-community-react="${emoji}" aria-pressed="${active}">${emoji}${reactors.length ? `<b>${reactors.length}</b>` : ""}</button>`;
  }).join("");
  const imageHtml = post.imageId ? `<img class="community-post-image" src="/api/v2-admin?action=community-image&id=${encodeURIComponent(post.imageId)}" alt="" loading="lazy" />` : "";
  return `<article class="community-post" data-post-id="${escapeHtml(post.id)}">
    <div class="community-post-head">
      <span class="community-post-avatar">${escapeHtml((post.authorName || "?").slice(0, 1).toUpperCase())}${post.authorAvatar ? `<img src="${escapeHtml(post.authorAvatar)}" alt="" loading="lazy" onerror="this.remove()" />` : ""}</span>
      <div class="community-post-who"><strong>${escapeHtml(post.authorName || "Member")}${post.authorBadge ? ` <span class="member-badge" data-badge="${escapeHtml(post.authorBadge.key)}">${escapeHtml(post.authorBadge.label)}</span>` : ""}</strong><small>${communityRelativeTime(post.createdAt)}</small></div>
      ${canDelete ? `<button type="button" class="community-post-delete" data-community-delete aria-label="Delete post">✕</button>` : ""}
    </div>
    ${post.text ? `<p class="community-post-text">${escapeHtml(post.text)}</p>` : ""}
    ${imageHtml}
    <div class="community-reactions">${reactionsHtml}</div>
  </article>`;
}

function renderCommunityFeed() {
  els.communityEmpty.hidden = communityPosts.length > 0;
  els.communityFeedList.innerHTML = communityPosts.map(communityPostCard).join("");
  els.communityFeedList.querySelectorAll("[data-community-react]").forEach((btn) => {
    btn.addEventListener("click", () => communityReact(btn.closest("[data-post-id]").dataset.postId, btn.dataset.communityReact));
  });
  els.communityFeedList.querySelectorAll("[data-community-delete]").forEach((btn) => {
    btn.addEventListener("click", () => communityDelete(btn.closest("[data-post-id]").dataset.postId));
  });
}

async function loadCommunityFeed() {
  if (communityLoading || !els.communityFeedList) return;
  communityLoading = true;
  try {
    const res = await fetch("/api/v2-admin?action=community-feed", { cache: "no-store", credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      els.communitySignedOut.hidden = false;
      els.communityComposer.hidden = true;
      els.communityFeedList.innerHTML = "";
      els.communityEmpty.hidden = true;
      return;
    }
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    els.communitySignedOut.hidden = true;
    els.communityComposer.hidden = false;
    communityPosts = data.posts || [];
    communityReactionSet = data.reactions || [];
    communityViewerId = data.viewerId || null;
    renderCommunityFeed();
  } catch (err) {
    console.error("loadCommunityFeed failed:", err);
    els.communityFeedList.innerHTML = `<p class="empty-state">${forMember("Couldn't load the feed. Try again.", "No posts to show yet.")}</p>`;
  } finally {
    communityLoading = false;
  }
}

async function communityReact(postId, emoji) {
  try {
    const res = await fetch("/api/v2-admin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "community-react", postId, emoji }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't react");
    const index = communityPosts.findIndex((p) => p.id === postId);
    if (index >= 0) communityPosts[index] = data.post;
    renderCommunityFeed();
  } catch (err) {
    showToast(err.message || "Couldn't react", "warn");
  }
}

async function communityDelete(postId) {
  if (!confirm("Delete this post?")) return;
  try {
    const res = await fetch("/api/v2-admin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "community-delete", postId }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Couldn't delete");
    communityPosts = communityPosts.filter((p) => p.id !== postId);
    renderCommunityFeed();
  } catch (err) {
    showToast(err.message || "Couldn't delete", "warn");
  }
}

function wireCommunityFeed() {
  if (!els.communityComposer) return;
  els.communityRefresh?.addEventListener("click", () => loadCommunityFeed());
  els.communityComposerUpload?.addEventListener("click", () => els.communityComposerFile.click());
  els.communityComposerFile?.addEventListener("change", async () => {
    const file = els.communityComposerFile.files?.[0];
    els.communityComposerFile.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { els.communityComposerStatus.textContent = "Please choose an image file."; return; }
    try {
      communityPendingImage = await resizeImageFile(file, 1600);
      els.communityComposerPreviewImg.src = communityPendingImage;
      els.communityComposerPreview.hidden = false;
    } catch (_) {
      els.communityComposerStatus.textContent = "Couldn't read that image.";
    }
  });
  els.communityComposerRemoveImage?.addEventListener("click", () => {
    communityPendingImage = null;
    els.communityComposerPreview.hidden = true;
    els.communityComposerPreviewImg.src = "";
  });
  els.communityComposer.addEventListener("submit", async (event) => {
    event.preventDefault();
    const text = els.communityComposerText.value.trim();
    if (!text && !communityPendingImage) {
      els.communityComposerStatus.textContent = "Write something or attach a screenshot first.";
      return;
    }
    els.communityComposerSubmit.disabled = true;
    els.communityComposerStatus.textContent = "Posting…";
    try {
      const res = await fetch("/api/v2-admin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "community-post", text, image: communityPendingImage }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't post");
      communityPosts.unshift(data.post);
      renderCommunityFeed();
      els.communityComposerText.value = "";
      communityPendingImage = null;
      els.communityComposerPreview.hidden = true;
      els.communityComposerPreviewImg.src = "";
      els.communityComposerStatus.textContent = "Posted.";
    } catch (err) {
      els.communityComposerStatus.textContent = err.message || "Couldn't post.";
    } finally {
      els.communityComposerSubmit.disabled = false;
    }
  });
}

function applyExperience(enabled) {
  document.documentElement.removeAttribute("data-jarvis");
}

/* ---------- Keep navigation out of the way once the reader leaves the top ---------- */

function wireChromeAutoHide() {
  // App navigation remains reachable while reading a long report.
  els.settingsBtn.classList.remove("mobile-chrome-hidden");
}

const BRAND_LOOP_WORDS = ["Data", "Props", "Edge", "Signal"];

// The "Data" half of the header wordmark cycles through a short list of
// brand terms (highlight box + blinking cursor, CSS-driven in styles.css)
// instead of sitting static -- purely decorative, so it degrades silently
// with no rotor element or under reduced-motion.
function wireBrandLoop() {
  const rotor = document.querySelector(".brand-loop-rotor");
  const wordEl = document.getElementById("brand-loop-word");
  if (!rotor || !wordEl) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  requestAnimationFrame(() => rotor.classList.add("is-in"));
  if (reduceMotion) return;

  let index = 0;
  setInterval(() => {
    rotor.classList.remove("is-in");
    setTimeout(() => {
      index = (index + 1) % BRAND_LOOP_WORDS.length;
      wordEl.textContent = BRAND_LOOP_WORDS[index];
      rotor.classList.add("is-in");
    }, 320);
  }, 3000);
}

function wireSettingsPanel() {
  applyEffectiveAccentTheme();
  renderAccentPresets();
  wireBackgroundImage();
  renderAppearanceNotice();
  els.appearanceToggle?.addEventListener("click", () => {
    if (isAppearanceForced()) localStorage.setItem(APPEARANCE_REVERT_KEY, siteUpdatedAt || "");
    else localStorage.removeItem(APPEARANCE_REVERT_KEY);
    applyEffectiveAccentTheme();
    applyEffectiveBackground();
    renderAppearanceNotice();
  });

  // 3 rapid clicks on the settings gear opens the hidden admin PIN prompt
  // instead of the normal theme panel -- the PIN itself is never checked
  // here, only on the server (api/v2-admin-auth.py).
  let v2ClickTimes = [];
  els.settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const now = Date.now();
    // Window measured from the FIRST click in the run, not a rolling
    // per-click cutoff -- gives 3 real clicks (mouse or trackpad) a full
    // 4 seconds to land instead of resetting after any single gap.
    if (v2ClickTimes.length === 0 || now - v2ClickTimes[0] > 4000) {
      v2ClickTimes = [now];
    } else {
      v2ClickTimes.push(now);
    }
    if (v2ClickTimes.length >= 3) {
      v2ClickTimes = [];
      els.settingsPanel.hidden = true;
      openV2PinPrompt();
      return;
    }
    els.settingsPanel.hidden = !els.settingsPanel.hidden;
  });
  document.addEventListener("click", (e) => {
    if (!els.settingsPanel.hidden && !els.settingsPanel.contains(e.target) && e.target !== els.settingsBtn) {
      els.settingsPanel.hidden = true;
    }
  });
  let accentFrame = 0;
  let accentSaveTimer = 0;
  const updateAccents = ({ saveNow = false } = {}) => {
    const theme = { primary: els.primaryAccent.value, secondary: els.secondaryAccent.value, tint: 0, base: currentBase(), bright: normalizeBright(els.lookBright?.value), grad: currentGrad(), sway: els.lookSway?.checked !== false };
    clearTimeout(accentSaveTimer);
    cancelAnimationFrame(accentFrame);
    accentFrame = requestAnimationFrame(() => {
      applyAccentTheme(theme, { persist: false, syncControls: false });
      syncLookControls(theme.base, theme.bright, theme.grad, theme.sway);
      els.primaryAccentValue.textContent = theme.primary.toUpperCase();
      els.secondaryAccentValue.textContent = theme.secondary.toUpperCase();
    });
    const save = () => {
      localStorage.setItem(ACCENT_THEME_KEY, JSON.stringify({ ...theme, look: lookOf(theme.base, theme.bright, theme.grad, theme.sway), scout: true, mono: true }));
      appliedTheme = { ...theme, tint: 0 };
      window.dispatchEvent(new CustomEvent("propscout:colors"));
      els.accentStatus.textContent = "Colors saved automatically on this device.";
    };
    if (saveNow) save();
    else accentSaveTimer = setTimeout(save, 180);
  };
  els.primaryAccent.addEventListener("input", () => updateAccents());
  els.secondaryAccent.addEventListener("input", () => updateAccents());
  els.accentTint?.addEventListener("input", () => updateAccents());
  els.primaryAccent.addEventListener("change", () => updateAccents({ saveNow: true }));
  els.secondaryAccent.addEventListener("change", () => updateAccents({ saveNow: true }));
  els.accentTint?.addEventListener("change", () => updateAccents({ saveNow: true }));
  // The background: a swatch, the member's own color, the brightness.
  const currentBase = () => normalizeBase(els.lookSwatches?.dataset.base);
  const currentGrad = () => normalizeGrad(String(els.lookGrads?.dataset.grad || "").split(","));
  els.lookSwatches?.addEventListener("click", (event) => {
    const swatch = event.target.closest("button.look-swatch");
    if (!swatch) return;
    els.lookSwatches.dataset.base = swatch.dataset.base;
    // A plain color in place of a gradient.
    if (els.lookGrads) els.lookGrads.dataset.grad = "";
    // A new color starts at its own brightness.
    if (els.lookBright) els.lookBright.value = "0";
    updateAccents({ saveNow: true });
  });
  els.lookCustom?.addEventListener("input", () => { els.lookSwatches.dataset.base = els.lookCustom.value; updateAccents(); });
  els.lookCustom?.addEventListener("change", () => { els.lookSwatches.dataset.base = els.lookCustom.value; updateAccents({ saveNow: true }); });
  els.lookBright?.addEventListener("input", () => updateAccents());
  els.lookBright?.addEventListener("change", () => updateAccents({ saveNow: true }));
  // The gradient: a ready-made one (or Off), two colors of the member's own, Sway.
  els.lookGrads?.addEventListener("click", (event) => {
    const chip = event.target.closest(".look-grad-chip");
    if (!chip) return;
    els.lookGrads.dataset.grad = chip.dataset.grad;
    updateAccents({ saveNow: true });
  });
  const ownGrad = (saveNow) => { els.lookGrads.dataset.grad = `${els.lookGradA.value},${els.lookGradB.value}`; updateAccents({ saveNow }); };
  [els.lookGradA, els.lookGradB].forEach((input) => {
    input?.addEventListener("input", () => ownGrad(false));
    input?.addEventListener("change", () => ownGrad(true));
  });
  els.lookSway?.addEventListener("change", () => updateAccents({ saveNow: true }));
  els.accentReset.addEventListener("click", () => {
    localStorage.removeItem(ACCENT_THEME_KEY);
    applyEffectiveAccentTheme();
    els.accentStatus.textContent = siteTheme ? "Reset — using the site's default colors." : "Default accents restored.";
  });
  els.accentPresetSave.addEventListener("click", () => {
    const name = els.accentPresetName.value.trim();
    if (!name) {
      els.accentPresetName.focus();
      els.accentStatus.textContent = "Name the preset before saving it.";
      return;
    }
    const presets = loadAccentPresets();
    const preset = { name, primary: els.primaryAccent.value, secondary: els.secondaryAccent.value, tint: 0, base: normalizeBase(els.lookSwatches?.dataset.base), bright: normalizeBright(els.lookBright?.value), grad: normalizeGrad(String(els.lookGrads?.dataset.grad || "").split(",")), sway: els.lookSway?.checked !== false };
    const existing = presets.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
    if (existing >= 0) presets[existing] = preset;
    else presets.unshift(preset);
    localStorage.setItem(ACCENT_PRESETS_KEY, JSON.stringify(presets.slice(0, 12)));
    els.accentPresetName.value = "";
    renderAccentPresets();
    els.accentStatus.textContent = `${name} saved.`;
  });
  els.accentPresetName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); els.accentPresetSave.click(); }
  });
}

/* ---------- Tabs ---------- */

function wireTabs() {
  if (!els.tabs.dataset.reactTabs) {
    els.tabs.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    requestAnimationFrame(() => moveIndicator(els.tabs.querySelector(".tab-btn.active")));
    window.addEventListener("resize", () => moveIndicator(els.tabs.querySelector(".tab-btn.active")));
  }

  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) {
    bottomNav.querySelectorAll(".bottom-nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchTab(btn.dataset.tab);
      });
    });
  }

  document.querySelectorAll("[data-home-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.homeTab));
  });
  wireMobileNavAutoHide();
  freezeStatusInset();
}

// The profile/settings buttons are pinned with
// top: calc(14px + var(--site-status-inset)), and that variable resolves to
// the safe-area inset plus iOS 26's glass band (src/site-access.css). On iOS Safari
// env(safe-area-inset-top) is NOT constant: it changes as the browser's top
// toolbar collapses and expands during scrolling, so the variable
// recalculates mid-scroll and slides both buttons down and back up. They are
// position:fixed and provably don't move under plain window scroll, which is
// why this only ever showed up on a real iPhone. Measuring the inset once and
// writing it back as a static px value pins them for good; re-measured on
// orientation change (a real layout change) but deliberately never on scroll.
function freezeStatusInset() {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);";
  const apply = () => {
    document.documentElement.style.removeProperty("--site-status-inset");
    document.body.appendChild(probe);
    const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    // Same formula as src/site-access.css: the inset, plus -- when the page
    // runs under the clock at all -- the ~35px glass blur band iOS 26+ draws
    // below it. 0 with the solid status bar, so no empty band at the top.
    document.documentElement.style.setProperty("--site-status-inset", `${Math.round(inset + Math.min(inset, 36))}px`);
  };
  apply();
  window.addEventListener("orientationchange", () => setTimeout(apply, 250));
}


function wireMobileNavAutoHide() {
  let dock = null;
  let ticking = false;
  const update = () => {
    const bottom = document.documentElement.scrollHeight - window.innerHeight;
    dock = dockState(dock, window.scrollY || 0, bottom);
    document.body.classList.toggle('mobile-dock-hidden', dock.hidden);
    ticking = false;
  };
  update();
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
}


function wireMainMenu() {
  if (!els.mainMenu) return;
  const closeMenu = (tab) => {
    els.mainMenu.hidden = true;
    switchTab(tab);
  };

  els.mainMenu.querySelectorAll("[data-launch-tab]").forEach((btn) => {
    btn.addEventListener("click", () => closeMenu(btn.dataset.launchTab));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !els.mainMenu.hidden) closeMenu("research");
  });
  requestAnimationFrame(() => els.mainMenu.querySelector("[data-launch-tab]")?.focus());
}

// Admin and the admin-only sections open only in an admin session.
const adminOnly = (tab) => tab === "admin" || ADMIN_TABS.includes(tab);

function switchTab(tab, options = {}) {
  options ??= {};
  if (!Object.hasOwn(SCREEN_TITLES, tab)) return;
  // The Admin route is not a preview page. It never renders until the
  // server-issued PIN session exists.
  if (tab === "admin" && !state.adminUnlocked) {
    openV2PinPrompt();
    return;
  }
  if (tab !== "admin" && !siteTabAllowed(tab)) {
    const fallback=availableSiteTab(state.currentTab);
    if(fallback&&fallback!==state.currentTab)switchTab(fallback,{history:options.history,scrollY:0});
    showLockedTab(tab);return;
  }
  const changed = state.currentTab !== tab;
  if (changed) screenScroll.set(state.currentTab, window.scrollY);
  state.currentTab = tab;
  const screenTitle = document.getElementById("mobile-screen-title");
  if (screenTitle) screenTitle.textContent = SCREEN_TITLES[tab];
  document.title = `${SCREEN_TITLES[tab]} · PropScout`;
  if (changed && screenHistoryReady && options.history !== false) {
    const url = new URL(location.href);
    url.hash = "";
    url.pathname = "/" + (SCREEN_SLUGS[tab] || tab);
    // A Props player page's mark (MatchupList.jsx) belongs to its own entry: never carried to another screen.
    const { nbaMatchup, ...kept } = history.state || {};
    history.pushState({ ...kept, vortexTab: tab }, "", url);
  }
  els.tabs.querySelectorAll("[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const topBtn = els.tabs.querySelector(`[data-tab="${tab}"]`);
  if (topBtn) moveIndicator(topBtn);

  const bottomNav = document.getElementById("bottom-nav");
  if (bottomNav) {
    bottomNav.querySelectorAll(".bottom-nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  }

  const homeModeSwitch = document.getElementById("home-mode-switch");
  if (homeModeSwitch) {
    const isHomeMode = tab === "research";
    homeModeSwitch.hidden = !isHomeMode;
    homeModeSwitch.querySelectorAll("[data-home-tab]").forEach((b) => {
      b.classList.toggle("active", b.dataset.homeTab === tab);
    });
  }

  els.panelResearch.hidden = tab !== "research";
  els.panelSlate.hidden = tab !== "slate";
  els.panelV2.hidden = tab !== "v2";
  els.panelFinder.hidden = tab !== "finder";
  if (els.panelMoves) els.panelMoves.hidden = tab !== "moves";
  els.panelBuilder.hidden = tab !== "builder";
  els.panelSlip.hidden = tab !== "slip";
  els.panelMoneyline.hidden = tab !== "moneyline";
  if (els.panelBot) els.panelBot.hidden = tab !== "bot";
  if (els.panelSheets) els.panelSheets.hidden = tab !== "sheets";
  if (els.panelPromos) els.panelPromos.hidden = tab !== "promos";
  if (els.panelBets) els.panelBets.hidden = tab !== "bets";
  if (els.panelPredictor) els.panelPredictor.hidden = tab !== "predictor";
  if (els.panelExport) els.panelExport.hidden = tab !== "export";
  els.panelNrfi.hidden = tab !== "nrfi";
  els.panelCommunity.hidden = tab !== "community";
  els.panelAdmin.hidden = tab !== "admin";
  els.panelSaved.hidden = tab !== "saved";
  els.parlayBar.hidden = tab !== "saved" || state.parlaySelection.size === 0;

  const activePanel = document.querySelector(`.tab-panel:not([hidden])`);
  if (activePanel) {
    activePanel.classList.remove("panel-enter");
    requestAnimationFrame(() => activePanel.classList.add("panel-enter"));
  }

  if (tab === "admin" && state.adminUnlocked && !state.adminRecords) loadAdminRecords().catch(() => showToast("Admin reporting unavailable", "warn"));
  if (tab === "saved") renderSavedGrid();
  if (tab === "slate" && !state.slateLoaded) loadSlate();
  if (tab === "v2" && !state.v2BoardLoaded) loadV2Board();
  if (tab === "nrfi" && !state.specialsLoaded) loadSpecialMarkets();
  if (tab === "community") loadCommunityFeed();
  window.dispatchEvent(new CustomEvent("vortex:dock-sync", { detail: { tab, saved: state.savedProps.size } }));
  renderFinderCompareTray();
  if (changed) window.scrollTo({ top: options.scrollY ?? screenScroll.get(tab) ?? 0, behavior: "instant" });
}

function wireAppNavigation() {
  // Back-compat: a link or bookmark carrying the old #tab hash (or a stray
  // hash left over from before this became path-based routing) still lands
  // on the right screen instead of always falling back to research.
  // Opened at the bare address (the home-screen icon's start page): the
  // Finder, not the page that was open when the app was last closed.
  const requestedSlug = location.pathname.slice(1) || location.hash.slice(1);
  const requested = Object.hasOwn(SLUG_TO_TAB, requestedSlug) ? SLUG_TO_TAB[requestedSlug] : requestedSlug;
  const initialTab = Object.hasOwn(SCREEN_TITLES, requested) && (!adminOnly(requested) || state.adminUnlocked) ? requested : state.currentTab;
  const url = new URL(location.href);
  // An old #tab address loses its hash; a page's own hash (/cheat-sheets#hr) keeps it.
  if (!location.pathname.slice(1) || initialTab !== requested) url.hash = "";
  url.pathname = "/" + (SCREEN_SLUGS[initialTab] || initialTab);
  const { nbaMatchup, ...keptState } = history.state || {};
  history.replaceState({ ...keptState, vortexTab: initialTab }, "", url);
  history.scrollRestoration = "manual";
  switchTab(initialTab, { history: false });
  screenHistoryReady = true;
  window.addEventListener("popstate", () => {
    // Reuse each sheet's existing Escape cleanup (including the game-log
    // scroll lock) before changing the screen behind it.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    window.dispatchEvent(new Event("vortex:close-more"));
    els.settingsPanel.hidden = true;
    setManualBetSlipOpen(false);
    const slug = location.pathname.slice(1);
    const route = Object.hasOwn(SLUG_TO_TAB, slug) ? SLUG_TO_TAB[slug] : slug;
    const tab = Object.hasOwn(SCREEN_TITLES, route) && (!adminOnly(route) || state.adminUnlocked) ? route : "finder";
    switchTab(tab, { history: false });
  });

  // A software keyboard must not leave the tab bar floating over the input.
  const viewport = window.visualViewport;
  const syncKeyboard = () => {
    const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]');
    const keyboardOpen = Boolean(editing && viewport && viewport.scale <= 1.05 && window.innerHeight - viewport.height > 140);
    document.body.classList.toggle("mobile-keyboard-open", keyboardOpen);
  };
  viewport?.addEventListener("resize", syncKeyboard);
  document.addEventListener("focusin", syncKeyboard);
  document.addEventListener("focusout", () => requestAnimationFrame(syncKeyboard));
}

window.addEventListener("vortex:switch-tab", (event) => switchTab(event.detail?.tab || "finder"));
window.addEventListener("vortex:dock-ready", () => window.dispatchEvent(new CustomEvent("vortex:dock-sync", { detail: { tab: state.currentTab, saved: state.savedProps.size } })));

function wireSidePanel() {
  let returnFocus = null;
  els.sideMenuToggle.setAttribute("aria-controls", "side-panel");
  els.sideMenuToggle.setAttribute("aria-expanded", "false");
  const close = () => {
    // A menu row can open something else first (Admin's PIN prompt); only
    // hand focus back if it is still in the panel.
    const hadFocus = els.sidePanel.contains(document.activeElement);
    els.sidePanel.hidden = true;
    els.sideScrim.hidden = true;
    els.sideMenuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("side-panel-open");
    window.dispatchEvent(new CustomEvent("vortex:more-sync", { detail: { open: false } }));
    if (hadFocus) returnFocus?.focus({ preventScroll: true });
  };
  // My Slip and the Finder bar's left icon open the panel for the picks
  // (detail.section "pick-builder"); on phones the menu comes first, so
  // bring the Pick Builder up to the top third, leaving the last menu rows
  // in view. The More button opens it at the top.
  const reveal = (section) => {
    const target = section === "pick-builder" && document.getElementById("pick-builder-root");
    if (!target) { els.sidePanel.scrollTop = 0; return; }
    const top = target.getBoundingClientRect().top - els.sidePanel.getBoundingClientRect().top + els.sidePanel.scrollTop;
    els.sidePanel.scrollTop = Math.max(0, top - els.sidePanel.clientHeight * 0.3);
  };
  const open = (event) => {
    returnFocus = document.activeElement;
    els.sidePanel.hidden = false;
    els.sideScrim.hidden = false;
    els.sideMenuToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("side-panel-open");
    els.sidePanel.setAttribute("role", "dialog");
    els.sidePanel.setAttribute("aria-modal", "true");
    window.dispatchEvent(new CustomEvent("vortex:more-sync", { detail: { open: true } }));
    els.sideMenuClose.focus({ preventScroll: true });
    reveal(event?.detail?.section);
  };
  els.sideMenuToggle.addEventListener("click", open);
  window.addEventListener("vortex:open-more", open);
  window.addEventListener("vortex:close-more", () => { if (!els.sidePanel.hidden) close(); });
  // The desktop rail stays usable beside the open panel; going somewhere
  // from it closes the panel like the panel's own links do.
  window.addEventListener("vortex:switch-tab", () => { if (!els.sidePanel.hidden) close(); });
  els.sideMenuClose.addEventListener("click", close); els.sideScrim.addEventListener("click", close);
  els.sidePanel.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const buttons = [...els.sidePanel.querySelectorAll("button:not([disabled])")].filter((button) => button.getClientRects().length);
    const first = buttons[0], last = buttons.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !els.sidePanel.hidden) close(); });
}

function wireSpecialMarkets() {
  els.nrfiRefresh.addEventListener("click", () => loadSpecialMarkets(true));
  els.adminUnlock.addEventListener("click", openV2PinPrompt);
  els.adminResultTabs.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
    state.adminRecordTab = btn.dataset.record;
    els.adminResultTabs.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    renderAdminRecords();
  }));
}

async function loadSpecialMarkets(force = false) {
  if (state.specialsLoaded && !force) return;
  try {
    const res = await fetch("/api/board?view=specials", { cache: "no-store" });
    if (!res.ok) throw new Error("Live markets unavailable");
    state.specialsData = await res.json(); state.specialsLoaded = true;
    renderSpecialMarkets();
  } catch (err) { showToast(err.message, "warn"); }
}

function renderSpecialMarkets() {
  const data = state.specialsData || {};
  const nrfis = data.nrfi || [];
  const nrfiTeam = (abbr) => {
    const id = MLB_TEAM_IDS[String(abbr || "").toUpperCase()];
    const logo = id ? `<img src="https://www.mlbstatic.com/team-logos/${id}.svg" alt="" loading="lazy" onerror="this.remove()">` : "";
    return `<span class="ace-nrfi-team">${logo}<b>${escapeHtml(abbr || "?")}</b></span>`;
  };
  els.nrfiList.innerHTML = nrfis.map((p) => {
    const call = String(p.recommendation || "—").toUpperCase();
    const confidence = String(p.confidence || "READY");
    const rating = Number(p.model_rating || p.confidence_pct);
    return `<article class="ace-nrfi" data-call="${escapeHtml(call.toLowerCase())}" data-confidence="${escapeHtml(confidence.toLowerCase())}">
      <header><span class="ace-nrfi-call">${escapeHtml(call)}</span><span class="ace-nrfi-confidence">${escapeHtml(confidence.charAt(0) + confidence.slice(1).toLowerCase())}</span></header>
      <div class="ace-nrfi-game">${nrfiTeam(p.away_abbr)}<i>@</i>${nrfiTeam(p.home_abbr)}</div>
      <p class="ace-nrfi-pitchers"><span>${escapeHtml(p.away_pitcher || "TBD")}</span><i>vs</i><span>${escapeHtml(p.home_pitcher || "TBD")}</span></p>
      <div class="ace-nrfi-model"><span>Model</span><span class="ace-nrfi-meter" aria-hidden="true"><i style="width:${Number.isFinite(rating) ? Math.max(4, Math.min(100, rating)) : 0}%"></i></span><b>${escapeHtml(Number.isFinite(rating) ? String(rating) : "—")}<small>/100</small></b></div>
      <footer><span class="ace-nrfi-dot" aria-hidden="true"></span>Lineups confirmed · First inning</footer>
    </article>`;
  }).join("");
  els.nrfiEmpty.hidden = nrfis.length > 0;
}

async function loadAdminRecords() {
  if (!document.getElementById("site-controls")?.dataset.loaded) {
    await loadSiteControls();document.getElementById("site-controls").dataset.loaded="1";
  }
  const res = await fetch("/api/board?view=results", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Admin reporting is still locked.");
  const data = await res.json(); state.adminRecords = data.records || {}; state.adminUnlocked = true;
  els.adminResultTabs.hidden = false; els.adminResultsList.hidden = false; renderAdminRecords();
  if (!state.adminLiveTimer) {
    state.adminLiveTimer = window.setInterval(() => {
      if (state.currentTab === "admin" && state.adminUnlocked && !document.hidden) loadAdminRecords().catch(() => {});
    }, 45000);
  }
}

// What the results have taught the model (learning.py): how sure it was
// against how its picks finished, by sport, and the corrections it now makes.
async function loadAdminLearning() {
  const res = await fetch("/api/prediction?action=learning", { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) throw new Error("Learning is unavailable right now.");
  state.adminLearning = await res.json();
  if (state.adminRecordTab === "learning") renderAdminRecords();
}

function renderAdminLearning() {
  const data = state.adminLearning;
  if (!data) {
    els.adminResultsList.innerHTML = "<p class=\"empty-state\">Loading what the model has learned…</p>";
    loadAdminLearning().catch((error) => { els.adminResultsList.innerHTML = `<p class="empty-state">${escapeHtml(error.message)}</p>`; });
    return;
  }
  const pct = (value) => (typeof value === "number" ? `${Math.round(value * 100)}%` : "—");
  const points = (value) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value * 100).toFixed(1)}`;
  const updated = data.at ? new Date(data.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not yet";
  const groups = Object.entries(data.groups || {}).sort(([a], [b]) => (a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b)));
  const summary = `<div class="record-summary"><span><b>${Number(data.picks || 0).toLocaleString()}</b>settled picks</span><span><b>${groups.filter(([name]) => name !== "all").length}</b>sports</span><span><b>${escapeHtml(updated)}</b>last refit</span></div>`;
  if (!groups.length) {
    els.adminResultsList.innerHTML = summary + "<p class=\"empty-state\">Nothing settled yet. The Parlay Builder and Scout Assistant send their top picks each day; once those games are final, the model refits every morning.</p>";
    return;
  }
  const table = ([name, group]) => {
    const rows = (group.points || []).map(([predicted, offset, n, actual]) => {
      const tone = Math.abs(offset) < 0.0005 ? "" : offset > 0 ? "up" : "down";
      return `<tr><td>${pct(predicted)}</td><td>${pct(actual)}</td><td>${Number(n).toLocaleString()}</td><td class="${tone}">${points(offset)}</td></tr>`;
    }).join("");
    return `<article class="learning-group"><h3>${escapeHtml(name === "all" ? "All sports" : name.split("|").map((part, index) => index ? part : part.toUpperCase()).join(" · "))}</h3>
      <table><thead><tr><th>Model said</th><th>Hit</th><th>Picks</th><th>Adjust</th></tr></thead><tbody>${rows}</tbody></table></article>`;
  };
  const tiers = Object.entries(data.tiers || {}).filter(([, cell]) => cell.picks).sort((a, b) => b[1].predicted - a[1].predicted)
    .map(([tier, cell]) => `<div class="admin-result-row"><span>${escapeHtml(tier.charAt(0).toUpperCase() + tier.slice(1))} picks · model said ${pct(cell.predicted)}</span><strong>${pct(cell.actual)} of ${Number(cell.picks).toLocaleString()}</strong></div>`).join("");
  const letters = Object.entries(data.parlays || {}).filter(([, cell]) => cell.slips)
    .map(([letter, cell]) => `<div class="admin-result-row"><span>${escapeHtml(letter === "D" ? "D and F" : letter)} parlays · last ${escapeHtml(String(data.parlayDays || 30))} days</span><strong>${cell.hits} of ${cell.slips} hit</strong></div>`).join("");
  els.adminResultsList.innerHTML = summary
    + `<p class="learning-note">Adjust is in percentage points, applied to every pick the site grades. It moves at most 3 a day and never past 15.</p>`
    + `<div class="learning-groups">${groups.map(table).join("")}</div>`
    + (tiers ? `<h3 class="learning-head">By tier</h3>${tiers}` : "")
    + (letters ? `<h3 class="learning-head">Parlays by grade</h3>${letters}` : "");
}

function renderAdminRecords() {
  if (state.adminRecordTab === "learning") return renderAdminLearning();
  const rows = (state.adminRecords || {})[state.adminRecordTab] || [];
  const settled = rows.filter((r) => r.result === "hit" || r.result === "miss");
  const wins = settled.filter((r) => r.result === "hit").length;
  const rate = settled.length ? `${Math.round((wins / settled.length) * 100)}%` : "—";
  const summary = `<div class="record-summary"><span><b>${wins}-${Math.max(0, settled.length - wins)}</b>record</span><span><b>${rate}</b>hit rate</span><span><b>${settled.length}</b>settled</span></div>`;
  if (state.adminRecordTab === "props" && rows.length) {
    els.adminResultsList.innerHTML = summary + renderLivePropRecords(rows);
    return;
  }
  els.adminResultsList.innerHTML = rows.length ? summary + rows.map((r) => {
    const hit = r.result === "hit"; const label = state.adminRecordTab === "props" ? `${r.player_name} · ${r.side} ${r.line} ${r.stat_type}` : `${r.recommendation} · ${r.away_abbr} @ ${r.home_abbr}`;
    const outcome = state.adminRecordTab === "nrfi" && r.result ? `${hit ? "Hit" : "Miss"} · ${r.first_inning_away_runs ?? "?"}-${r.first_inning_home_runs ?? "?"} after 1` : hit ? "Hit" : r.result === "miss" ? "Miss" : "Pending";
    return `<div class="admin-result-row ${hit ? "hit" : r.result === "miss" ? "miss" : ""}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(outcome)}</strong></div>`;
  }).join("") : "<p class=\"empty-state\">No settled results in this tab yet.</p>";
}

// The search bar / browse chips play a one-time fade-in (`.intro-anim`,
// opacity:0 + `animation ... forwards`) on first load. If that animation is
// ever re-triggered later -- which happens because the research tab panel
// toggles display:none/block when switching tabs -- mobile Safari can drop
// the replay and leave the element stuck invisible at its pre-animation
// opacity:0 until something else forces a re-render. Stripping the class
// once the intro has played means later tab switches never touch the
// animation system again, so there's nothing left to get stuck.
function clearIntroAnimations() {
  setTimeout(() => {
    document.querySelectorAll(".intro-anim").forEach((el) => el.classList.remove("intro-anim"));
  }, 1200);
}

function moveIndicator(btn) {
  if (!btn || !els.tabIndicator) return;
  const tabsRect = els.tabs.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();
  els.tabIndicator.style.width = `${btnRect.width}px`;
  els.tabIndicator.style.transform = `translateX(${btnRect.left - tabsRect.left - 4}px)`;
}

/* ---------- Avatars ---------- */

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function avatarHtml(playerOrProp, size = "") {
  const player = typeof playerOrProp === "string" ? playerOrProp : playerOrProp.player;
  const originalHeadshot = typeof playerOrProp === "object" ? playerOrProp.headshot : null;
  const headshot = originalHeadshot ? originalHeadshot.replace("/headshot/67/current", "/headshot/silo/current") : null;
  const hash = hashString(player);
  const hue = AVATAR_HUES[hash % AVATAR_HUES.length];
  const hue2 = (hue + 40) % 360;
  const initials = initialsFor(player);
  const sizeClass = size ? ` avatar-${size}` : "";
  // Initials render underneath; if the photo loads it covers them, if it
  // fails onerror removes the img and the initials fallback shows through.
  const img = headshot
    ? `<img src="${escapeHtml(headshot)}" alt="" loading="eager" fetchpriority="high" onerror="this.remove()">`
    : "";
  return `<div class="avatar${sizeClass}${headshot ? " avatar-cutout" : ""}">${escapeHtml(initials)}${img}</div>`;
}

function teamLogoHtml(teamId, teamName = "", className = "team-logo") {
  if (!teamId) return "";
  return `<img class="${className}" src="https://www.mlbstatic.com/team-logos/${Number(teamId)}.svg" alt="${escapeHtml(teamName)}" loading="lazy">`;
}

/* ---------- Auth gate (Discord OAuth + Premium/Tester role) ---------- */

async function checkAuth() {
  return initSiteAccess();
}

// Errors are for admins (src/admin-notice.js): where part of a page can't
// load, a member sees a calm line instead of what went wrong.
function forMember(adminText, memberText) {
  return siteIsAdmin() ? adminText : memberText;
}

function showToast(message, variant = "default", detail = "") {
  const toast = document.createElement("div");
  toast.className = `toast${variant === "warn" ? " toast-warn" : ""}`;
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent = variant === "warn" ? "!" : "✓";
  const copy = document.createElement("span");
  copy.className = "toast-copy";
  const title = document.createElement("strong");
  title.textContent = message;
  copy.appendChild(title);
  if (detail) {
    const secondary = document.createElement("small");
    secondary.textContent = detail;
    copy.appendChild(secondary);
  }
  toast.append(icon, copy);
  els.toastStack.appendChild(toast);
  // Always remove on a timer as well as animationend. Jarvis' entrance
  // animation uses !important, which can otherwise prevent toast-out from
  // firing and leave this status card stuck on screen.
  setTimeout(() => {
    toast.classList.add("leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 420);
  }, 1800);
}

/* ---------- Saved props (localStorage) ----------
   Saved entries store the FULL prop object, not just an id — live-looked-up
   props never live in state.props (only static demo entries do), so looking
   them up by id against that array would silently fail to find them. */

function loadSaved() {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Map(arr.map((p) => [p.id, p]));
  } catch {
    return new Map();
  }
}

function persistSaved() {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...state.savedProps.values()]));
}

function isSaved(id) {
  return state.savedProps.has(id);
}

function toggleSave(prop, btnEl) {
  if (isSaved(prop.id)) {
    state.savedProps.delete(prop.id);
    state.parlaySelection.delete(prop.id);
    showToast(`Removed ${prop.player} from the prop builder`, "warn");
  } else {
    if (state.savedProps.size >= 6) {
      showToast("PrizePicks allows up to 6 legs. Remove one from the builder first.", "warn");
      return;
    }
    state.savedProps.set(prop.id, prop);
    showToast("Added to Prop Builder", "default", `${prop.player} · ${prop.side} ${prop.line} ${prop.betType}`);
  }
  persistSaved();
  updateSavedCount();
  if (btnEl) {
    syncSaveButton(btnEl, prop.id);
    btnEl.classList.remove("pop");
    void btnEl.offsetWidth; // restart animation
    btnEl.classList.add("pop");
  }
  if (state.currentTab === "saved") renderSavedGrid();
}

function syncSaveButton(btnEl, id) {
  const saved = isSaved(id);
  btnEl.classList.toggle("saved", saved);
  btnEl.setAttribute("aria-pressed", String(saved));
  btnEl.setAttribute("aria-label", saved ? "Remove from My Slip" : "Add to My Slip");
  const label = btnEl.querySelector(".save-btn-label");
  if (label) label.textContent = saved ? "In My Slip" : "Add to My Slip";
  else if (!btnEl.classList.contains("finder-slip-star")) btnEl.textContent = saved ? "In My Slip" : "Add to My Slip";
}

function updateSavedCount() {
  if (els.savedCount) els.savedCount.textContent = state.savedProps.size;
  const bc = document.getElementById("bottom-saved-count");
  if (bc) {
    bc.textContent = state.savedProps.size;
    bc.hidden = state.savedProps.size === 0;
  }
  window.dispatchEvent(new CustomEvent("vortex:dock-sync", { detail: { tab: state.currentTab, saved: state.savedProps.size } }));
  renderManualBetSlip();
}

// Settings that arrived from the member's account (src/account-sync.js has
// already written them to localStorage): reload whatever this page shows.
window.addEventListener("vortex:account-prefs-applied", (event) => {
  const keys = new Set(event.detail?.keys || []);
  if (keys.has(SAVED_KEY)) {
    state.savedProps = loadSaved();
    for (const id of state.parlaySelection) if (!state.savedProps.has(id)) state.parlaySelection.delete(id);
    updateSavedCount();
    if (state.currentTab === "saved") renderSavedGrid();
    const reportButton = els.reportWrap?.querySelector(".save-btn");
    if (reportButton && currentResearchProp) syncSaveButton(reportButton, currentResearchProp.id);
  }
  if (keys.has(ACCENT_THEME_KEY)) applyEffectiveAccentTheme();
  if (keys.has(ACCENT_PRESETS_KEY) && els.accentPresets) renderAccentPresets();
  if (keys.has(BG_IMAGE_KEY)) {
    const saved = loadBackgroundImage();
    if (els.bgImageUrl) els.bgImageUrl.value = isUploadedBackground(saved.url) ? "" : saved.url;
    applyEffectiveBackground();
  }
  if (keys.has(RECENT_RESEARCH_KEY)) renderRecentSearches();
});

// No minimum display time any more: that hold existed so the old animated
// intro could finish playing, and it now just delayed the site for no reason.
async function finishPrivateLoader() {
  if(document.documentElement.dataset.siteAccess==="granted") els.appShell.classList.remove("app-shell-hidden");
  dismissBootLoader();
}

function propLiveActual(row) {
  const live = row.live || {};
  const key = String(row.market_key || row.stat_type || "").toLowerCase();
  if (key.includes("hits_runs") || key.includes("hits+runs") || key.includes("hrr")) return [live.hrr, "HRR"];
  if (key.includes("total_bases") || key.includes("total bases")) return [live.total_bases, "TB"];
  if (key.includes("pitcher_strikeout") || key === "strikeouts") return [live.strikeouts, "K"];
  if (key.includes("pitcher_out") || key === "outs") return [live.outs, "outs"];
  if (key.includes("hits_allowed")) return [live.hits_allowed, "hits allowed"];
  if (key.includes("earned_run")) return [live.earned_runs, "ER"];
  if (key.includes("home_run")) return [live.home_runs, "HR"];
  if (key.includes("hit")) return [live.hits, "hits"];
  return [row.actual_value, "current"];
}

function livePropState(row, actual) {
  if (row.result === "hit") return ["hit", "Hit"];
  if (row.result === "miss") return ["miss", "Miss"];
  if (row.result === "void") return ["void", "Void"];
  const live = row.live || {};
  const pitcher = /pitcher_|strikeouts|outs|hits allowed|earned runs/i.test(`${row.market_key || ""} ${row.stat_type || ""}`);
  if (pitcher && live.pitcher_replaced && live.is_live) return ["miss", "Pulled · Loss"];
  if (!live.is_live && !live.is_final) return ["pregame", live.detailed || "Pregame"];
  if (actual == null) return ["pending", live.is_final ? "Finalizing" : "Live"];
  const cleared = row.side === "under" ? Number(actual) < Number(row.line) : Number(actual) > Number(row.line);
  const busted = row.side === "under" ? Number(actual) > Number(row.line) : false;
  if (live.is_final) return cleared ? ["hit", "Hit"] : ["miss", "Miss"];
  if (row.side === "over" && cleared) return ["hit", "Cleared"];
  if (busted) return ["miss", "Busted"];
  return ["live", "Live"];
}

function renderLivePropRecords(rows) {
  const ordered = [...rows].sort((a, b) => {
    const rank = (r) => r.live?.is_live ? 0 : (!r.live?.is_final ? 1 : 2);
    return String(b.game_date || "").localeCompare(String(a.game_date || ""))
      || rank(a) - rank(b)
      || String(a.live?.start_time || "").localeCompare(String(b.live?.start_time || ""));
  });
  const groups = new Map();
  ordered.forEach((row) => {
    const date = row.game_date || "Unknown date";
    const key = `${date}|${row.live?.game_key || (row.result ? "settled" : "waiting")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()].map((gameRows) => {
    const game = gameRows[0].live || {};
    const dateTitle = gameRows[0].game_date || "Unknown date";
    const isLive = Boolean(game.is_live);
    const title = game.game_key
      ? `${dateTitle} · ${game.away} ${game.away_score ?? 0}  ·  ${game.home} ${game.home_score ?? 0}`
      : `${dateTitle} · ${gameRows[0].result ? "Settled props" : "Waiting for game data"}`;
    const gameStatus = game.game_key ? (isLive ? `${game.inning || "LIVE"}` : game.is_final ? "FINAL" : game.detailed || "PREGAME") : "";
    const cards = gameRows.map((row) => {
      const live = row.live || {};
      const [actualRaw, unit] = propLiveActual(row);
      const actual = actualRaw == null ? null : Number(actualRaw);
      const [stateClass, stateLabel] = livePropState(row, actual);
      const pitcher = /pitcher_|strikeouts|outs|hits allowed|earned runs/i.test(`${row.market_key || ""} ${row.stat_type || ""}`);
      const direction = String(row.side || "over").toLowerCase();
      const need = actual == null ? null : direction === "over" ? Math.max(0, Math.floor(Number(row.line) - actual) + 1) : Math.max(0, actual - Number(row.line));
      const progress = actual == null ? 0 : Math.min(100, Math.max(5, actual / Math.max(1, Number(row.line) + .5) * 100));
      const tracking = pitcher
        ? `${actual ?? "—"} ${unit}${live.pitch_count ? ` · ${live.pitch_count} pitches` : ""}${live.outs != null ? ` · ${Math.floor(Number(live.outs) / 3)}.${Number(live.outs) % 3} IP` : ""}`
        : `${actual ?? "—"} ${unit}${live.at_bats != null ? ` · ${live.hits ?? 0}/${live.at_bats} batting` : ""}${live.plate_appearances ? ` · ${live.plate_appearances} PA` : ""}`;
      const chase = stateClass === "live" && need ? `Needs ${need} more` : stateClass === "pregame" ? "Not started" : stateLabel;
      const modelMeta = [row.vortex_score != null ? `Score ${row.vortex_score}` : "", row.matchup_score != null ? `Matchup ${Math.round(Number(row.matchup_score))}` : ""].filter(Boolean).join(" · ");
      return `<article class="live-prop-card ${stateClass}"><div class="live-prop-main"><span class="live-prop-name">${escapeHtml(row.player_name)}</span><strong>${escapeHtml(direction)} ${escapeHtml(String(row.line))} ${escapeHtml(row.stat_type)}</strong><small>${escapeHtml(tracking)}${modelMeta ? ` · ${escapeHtml(modelMeta)}` : ""}</small></div><div class="live-prop-meter"><i style="--live-progress:${progress}%"></i></div><div class="live-prop-state"><span>${escapeHtml(stateLabel)}</span><small>${escapeHtml(chase)}</small></div></article>`;
    }).join("");
    return `<section class="live-game-group ${isLive ? "is-live" : ""}"><header><div><span class="live-pulse"></span><strong>${escapeHtml(title)}</strong></div><b>${escapeHtml(gameStatus)}</b></header><div class="live-game-props">${cards}</div></section>`;
  }).join("");
}

/* ---------- Search ---------- */

function wireSearch() {
  document.getElementById("research-home-back")?.addEventListener("click", () => {
    clearTimeout(lineDebounceTimer);
    clearTimeout(searchDebounceTimer);
    lineSelectionToken++;
    searchRequestToken++;
    Object.keys(cmd).forEach((key) => { cmd[key] = null; });
    state.boardResearchContext = null;
    state.v2DeepDiveReturn = null;
    currentResearchProp = null;
    els.playerProfile.hidden = true;
    els.linePicker.hidden = true;
    els.v2BackBtn.hidden = true;
    clearSearchQuery();
    hideResults();
    clearReport();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  document.getElementById("research-search-submit")?.addEventListener("click", () => {
    els.searchInput.focus();
    onSearchInput();
  });
  window.addEventListener("vortex:research-player", ({ detail }) => {
    if (!detail?.name || !Number.isInteger(detail.id)) return;
    const stat = detail.statType ? BOT_STAT_TO_RESEARCH_STAT[detail.statType] : null;
    const isPitcher = detail.statType ? BOT_PITCHER_STATS.has(detail.statType) : false;
    selectPlayer(detail.name, isPitcher ? "P" : detail.position, { autoSelectStat: !stat, playerEntry: { player: detail.name, name: detail.name, playerId: detail.id, teamId: detail.teamId || null, team: detail.team || "", sport: "MLB", headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto/v1/people/${detail.id}/headshot/silo/current` } });
    if (stat) {
      selectStat(stat);
      const side = detail.side === "U" ? "Under" : "Over";
      cmd.side = side;
      els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === side));
      if (Number.isFinite(Number(detail.line))) setLineValue(Number(detail.line), { immediate: true });
    }
    els.emptyState.hidden = true;
    switchTab("research", { scrollY: 0 });
  });
  window.addEventListener("vortex:prefetch-player", ({ detail }) => {
    clearTimeout(researchPrefetchTimer);
    if (!detail?.name) return;
    queueResearchPrefetch({ player: detail.name, playerId: detail.id, teamId: detail.teamId, team: detail.team, sub: detail.position }, {
      stat: BOT_STAT_TO_RESEARCH_STAT[detail.statType], line: detail.line,
      side: detail.side === "U" ? "Under" : "Over",
    });
  });
  els.searchInput.addEventListener("input", onSearchInput);
  els.searchInput.addEventListener("focus", onSearchInput);
  els.searchInput.addEventListener("keydown", onSearchKeydown);
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".search-wrap")) hideResults();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== els.searchInput) {
      e.preventDefault();
      els.searchInput.focus();
    }
  });
  els.profileStats.addEventListener("change", () => selectStat(els.profileStats.value));
}

/** Group all props by player so the dropdown/chips show one row per player. */
function groupByPlayer(props) {
  const map = new Map();
  props.forEach((p) => {
    if (!map.has(p.player)) map.set(p.player, []);
    map.get(p.player).push(p);
  });
  return [...map.entries()];
}

function normalizePlayerSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchPlayers(query) {
  const q = normalizePlayerSearch(query);
  const groups = groupByPlayer(state.props);
  if (!q) return groups.slice(0, 8);
  return groups
    .filter(([player, props]) =>
      [player, props[0].team, props[0].sport].filter(Boolean).some((f) => normalizePlayerSearch(f).includes(q))
    )
    .slice(0, 8);
}

/** Normalizes static demo groups into the same shape live API suggestions use. */
function staticEntriesFor(query) {
  return matchPlayers(query).map(([player, props]) => ({
    kind: "static",
    player,
    team: props[0].team,
    sport: props[0].sport,
    sub: `${props.length} prop${props.length > 1 ? "s" : ""} available`,
    headshot: props[0].headshot || null,
  }));
}

let searchDebounceTimer = null;
let searchRequestToken = 0;
let researchLoaderCleanup = null;
function queueResearchPrefetch(entry, overrides = {}) {
  clearTimeout(researchPrefetchTimer);
  const connection = navigator.connection;
  if (document.documentElement.dataset.siteAccess !== "granted" || connection?.saveData
      || /(^|-)2g$/.test(connection?.effectiveType || "")) return;
  const stat = overrides.stat || (entry.sub === "P" ? PITCHER_STATS[0] : BATTER_STATS[0]);
  const context = { player: entry.player, playerId: entry.playerId || null,
    teamId: entry.teamId || null, teamName: entry.team || "", stat,
    line: overrides.line != null ? Number(overrides.line) : STAT_DEFAULT_LINE[stat] ?? 0.5,
    side: overrides.side || "Over" };
  researchPrefetchTimer = setTimeout(() => researchClient.prefetch(context), 100);
}

function bindResearchPrefetch(node, entry) {
  const warm = () => queueResearchPrefetch(entry);
  const cancel = () => clearTimeout(researchPrefetchTimer);
  node.addEventListener("pointerenter", warm);
  node.addEventListener("focus", warm);
  node.addEventListener("pointerleave", cancel);
  node.addEventListener("blur", cancel);
}
const playerSearchCache = new Map();
let playerCatalog = [];
let catalogPromise;
function warmPlayerCatalog() {
  if (catalogPromise) return catalogPromise;
  const saved = readFinderCache('players', 6 * 60 * 60 * 1000);
  if (saved) playerCatalog = saved;
  catalogPromise = fetch(`${API_PLAYERS_SOURCE}?catalog=1`).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
    playerCatalog = data.players || [];
    writeFinderCache('players', playerCatalog);
    if (els.searchInput?.value.trim().length >= 2) fetchLiveSuggestions(els.searchInput.value);
  }).catch(() => { catalogPromise = null; });
  return catalogPromise;
}

function clearSearchQuery() {
  els.searchInput.value = "";
  renderRecentSearches();
}

const RECENT_RESEARCH_KEY = "krazy-data-recent-research-v1";

function readRecentResearch() {
  try { return JSON.parse(localStorage.getItem(RECENT_RESEARCH_KEY) || "[]").filter(item => item?.player).slice(0, 6); }
  catch (_) { return []; }
}

function rememberResearchPlayer(entry) {
  if (!entry?.player) return;
  const recent = readRecentResearch().filter(item => normalizePlayerSearch(item.player) !== normalizePlayerSearch(entry.player));
  recent.unshift({ player: entry.player, playerId: entry.playerId || null, teamId: entry.teamId || null, team: entry.team || "", sub: entry.sub || "MLB", headshot: entry.headshot || null, kind: "recent" });
  try { localStorage.setItem(RECENT_RESEARCH_KEY, JSON.stringify(recent.slice(0, 6))); } catch (_) {}
  renderRecentSearches();
}

function renderRecentSearches() {
  if (!els.recentSearches) return;
  const recent = readRecentResearch();
  const show = !els.searchInput?.value.trim() && recent.length && els.playerProfile?.hidden;
  els.recentSearches.hidden = !show;
  if (!show) return;
  els.recentSearches.innerHTML = `<div class="recent-searches-head"><span>Recent players</span><button type="button" data-clear-recent>Clear</button></div><div class="recent-player-strip">${recent.map((entry, index) => `<button type="button" class="recent-player" data-recent-index="${index}">${avatarHtml(entry, "sm")}<span><strong>${escapeHtml(entry.player)}</strong><small>${escapeHtml(entry.team || entry.sub || "MLB")}</small></span></button>`).join("")}</div>`;
  els.recentSearches.querySelector("[data-clear-recent]")?.addEventListener("click", () => { localStorage.removeItem(RECENT_RESEARCH_KEY); renderRecentSearches(); });
  els.recentSearches.querySelectorAll("[data-recent-index]").forEach(button => {
    const entry = recent[Number(button.dataset.recentIndex)];
    bindResearchPrefetch(button, entry);
    button.addEventListener("click", () => {
      if (entry) selectPlayer(entry.player, entry.sub, { playerEntry: entry });
    });
  });
}

function onSearchInput() {
  searchRequestToken++;
  const query = els.searchInput.value;
  const isSearchable = query.trim().length >= 2;

  if (!query.trim()) {
    clearTimeout(searchDebounceTimer);
    searchRequestToken++;
    hideResults();
    renderRecentSearches();
    return;
  }
  if (els.recentSearches) els.recentSearches.hidden = true;

  // Static demo matches render instantly; live MLB suggestions follow after
  // a short debounce so we're not firing an API call on every keystroke.
  renderResults(staticEntriesFor(query), { loading: isSearchable });

  clearTimeout(searchDebounceTimer);
  if (!isSearchable) {
    searchRequestToken++; // invalidate any in-flight fetch's result
    return;
  }
  if (playerCatalog.length) fetchLiveSuggestions(query);
  else searchDebounceTimer = setTimeout(() => fetchLiveSuggestions(query), 100);
}

async function fetchLiveSuggestions(query) {
  const token = ++searchRequestToken;
  let livePlayers = [];
  let fetchFailed = false;
  const cacheKey = normalizePlayerSearch(query);
  try {
    if (playerCatalog.length) {
      const key = nameKey(query);
      livePlayers = playerCatalog.filter(p => nameKey(p.name).includes(key)).sort((a,b) => Number(!nameKey(a.name).startsWith(key)) - Number(!nameKey(b.name).startsWith(key))).slice(0,10);
    } else if (playerSearchCache.has(cacheKey)) {
      livePlayers = playerSearchCache.get(cacheKey);
    } else {
      const res = await fetch(`${API_PLAYERS_SOURCE}?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!res.ok) throw new Error("Search unavailable");
      livePlayers = data.players || [];
      if (res.ok) playerSearchCache.set(cacheKey, livePlayers);
    }
  } catch (err) {
    fetchFailed = true;
  }

  if (token !== searchRequestToken) return; // a newer keystroke superseded this fetch

  const staticEntries = staticEntriesFor(query);
  const staticNames = new Set(staticEntries.map((e) => normalizePlayerSearch(e.player)));
  const liveEntries = livePlayers
    .filter((p) => p.name && !staticNames.has(normalizePlayerSearch(p.name)))
    .map((p) => ({
      kind: "live",
      player: p.name,
      team: p.team,
      playerId: p.id,
      teamId: p.team_id,
      sport: "MLB",
      sub: p.position || "MLB",
      headshot: `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${p.id}/headshot/67/current`,
    }));

  renderResults([...staticEntries, ...liveEntries], { loading: false, fetchFailed });
}

function onSearchKeydown(e) {
  const items = els.searchResults?.querySelectorAll(".search-result-item") || [];
  if (!items.length) {
    if (e.key === "Enter" && els.searchInput.value.trim().length > 1) {
      e.preventDefault();
      const query = els.searchInput.value.trim();
      clearSearchQuery();
      hideResults();
      selectPlayer(query);
    }
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    state.activeIndex = Math.min(state.activeIndex + 1, items.length - 1);
    highlightActive(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    state.activeIndex = Math.max(state.activeIndex - 1, 0);
    highlightActive(items);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const idx = state.activeIndex >= 0 ? state.activeIndex : 0;
    items[idx]?.click();
  } else if (e.key === "Escape") {
    hideResults();
    els.searchInput.blur();
  }
}

function highlightActive(items) {
  items.forEach((item, i) => item.classList.toggle("active", i === state.activeIndex));
  items[state.activeIndex]?.dispatchEvent(new Event("focus"));
}

function renderResults(entries, { loading = false, fetchFailed = false } = {}) {
  state.activeIndex = -1;
  els.searchResults.innerHTML = "";
  const query = els.searchInput.value.trim();
  const haveNames = new Set(entries.map((e) => e.player.toLowerCase()));
  const showLiveOption = query.length > 1 && !haveNames.has(query.toLowerCase()) && !loading && (entries.length === 0 || fetchFailed);

  if (entries.length === 0 && !loading && !showLiveOption) {
    hideResults();
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "search-result-item";
    item.style.animationDelay = `${index * 30}ms`;
    item.innerHTML = `
      ${avatarHtml(entry, "sm")}
      <span class="sr-main"><span class="sr-player">${escapeHtml(entry.player)}</span></span>
      ${teamLogoHtml(entry.teamId, entry.team, "sr-team-logo")}
    `;
    const choosePlayer = (event) => {
      event.preventDefault();
      clearTimeout(searchDebounceTimer);
      searchRequestToken++;
      clearSearchQuery();
      hideResults();
      els.searchInput.blur();
      selectPlayer(entry.player, entry.kind === "live" ? entry.sub : null, { playerEntry: entry });
    };
    item.addEventListener("click", choosePlayer);
    bindResearchPrefetch(item, entry);
    els.searchResults.appendChild(item);
  });

  if (loading) {
    const item = document.createElement("li");
    item.className = "search-result-item search-result-loading";
    item.innerHTML = `<span class="loading-pulse"></span><span class="sr-main"><span class="sr-pick">Searching MLB players…</span></span>`;
    els.searchResults.appendChild(item);
  }

  if (showLiveOption) {
    const item = document.createElement("li");
    item.className = "search-result-item search-result-live";
    item.innerHTML = `<span class="sr-main"><span class="sr-player">Search "${escapeHtml(query)}" live</span><span class="sr-pick">${fetchFailed ? "Player search failed — try an exact name" : "No matches yet — try the exact name"}</span></span>`;
    item.addEventListener("click", (event) => {
      event.preventDefault();
      clearTimeout(searchDebounceTimer);
      searchRequestToken++;
      clearSearchQuery();
      hideResults();
      els.searchInput.blur();
      selectPlayer(query);
    });
    els.searchResults.appendChild(item);
  }

  els.searchResults.hidden = false;
}

function hideResults() {
  els.searchResults.hidden = true;
}

// Quick-start suggestions for the "Or jump straight to:" row. These are just
// names, not data -- every lookup still goes through the live API, same as
// typing a name and picking "search live". Static predictions.json now
// ships with zero entries on purpose: any pre-baked demo data risked being
// shown instead of a real live result whenever a stat/line happened to
// match, which was actively misleading (e.g. a fabricated "Rockies"
// matchup appearing for a real Padres game).

function renderBrowseChips() {
  els.browseChips.innerHTML = "";
  SUGGESTED_PLAYERS.forEach((player) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "browse-chip";
    chip.textContent = player;
    bindResearchPrefetch(chip, { player });
    chip.addEventListener("click", () => selectPlayer(player));
    els.browseChips.appendChild(chip);
  });
}

/* ---------- Player profile: stat buttons + slide/type-in line picker ---------- */

const cmd = { player: null, playerId: null, teamId: null, teamName: "", stat: null, line: null, side: null };
const prizePicksLineCache = new Map();
let currentResearchProp = null;
let prizePicksDefaultPending = false;

function wireLinePicker() {
  els.sideToggle.querySelectorAll(".side-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b === btn));
      cmd.side = btn.dataset.side;
      applyLineSelection();
    });
  });

  els.lineSlider.addEventListener("input", () => {
    prizePicksDefaultPending = false;
    setLineValue(Number(els.lineSlider.value));
  });
  els.lineSlider.addEventListener("change", () => {
    setLineValue(Number(els.lineSlider.value), { immediate: true });
  });
  els.lineNumber.addEventListener("change", () => {
    prizePicksDefaultPending = false;
    setLineValue(Number(els.lineNumber.value), { immediate: true });
  });
  els.lineStepDown.addEventListener("click", () => { prizePicksDefaultPending = false; setLineValue(cmd.line - 0.5, { immediate: true }); });
  els.lineStepUp.addEventListener("click", () => { prizePicksDefaultPending = false; setLineValue(cmd.line + 0.5, { immediate: true }); });
  window.addEventListener("vortex:pp-line-pick", (event) => {
    prizePicksDefaultPending = false;
    setLineValue(Number(event.detail.value), { immediate: true });
  });
}

function americanOdds(value) {
  const odds = Number(value);
  return Number.isFinite(odds) ? `${odds > 0 ? "+" : ""}${odds}` : "—";
}

async function loadPrizePicksLines() {
  const opponent = currentResearchProp?.matchup?.opponent || "";
  const key = `${cmd.player}|${cmd.stat}|${opponent}`.toLowerCase();
  els.ppLinesBridge?.setStatus("loading");
  try {
    let data = prizePicksLineCache.get(key);
    if (!data) {
      const url = `${API_SOURCE}?action=prizepicks-lines&player=${encodeURIComponent(cmd.player)}&stat=${encodeURIComponent(cmd.stat)}&opponent=${encodeURIComponent(opponent)}`;
      const response = await fetch(url, { cache: "no-store" });
      data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "PrizePicks lines unavailable");
      prizePicksLineCache.set(key, data);
    }
    const featured = (data.lines || []).find(row => row.featured)?.line;
    const availableLines = (data.lines || []).filter(row => cmd.side === "Under" ? row.ppUnder : row.ppOver);
    if (!availableLines.length) throw new Error(`PrizePicks has not posted ${cmd.side} lines for this player yet.`);
    const currentRow = availableLines.find(row => Math.abs(Number(row.line) - Number(cmd.line)) < .01);
    const tierFor = (row) => {
      const safer = featured != null && (cmd.side === "Over" ? row.line < featured : row.line > featured);
      const boosted = featured != null && (cmd.side === "Over" ? row.line > featured : row.line < featured);
      return row.tier || (row.featured ? "STANDARD" : safer ? "GOBLIN" : boosted ? "DEMON" : "ALT");
    };
    if (`${cmd.player}|${cmd.stat}|${opponent}`.toLowerCase() === key) {
      els.ppLinesBridge?.setLines(availableLines.map(row => ({ value: row.line, tier: tierFor(row) })));
      els.ppLinesBridge?.setValue(currentRow ? String(cmd.line) : "");
      els.ppLinesBridge?.setStatus("ready");
    }
    const stillCurrent = `${cmd.player}|${cmd.stat}|${currentResearchProp?.matchup?.opponent || ""}`.toLowerCase() === key;
    if (stillCurrent && prizePicksDefaultPending && featured != null
        && Math.abs(Number(featured) - Number(cmd.line)) >= .01) {
      prizePicksDefaultPending = false;
      setLineValue(Number(featured), { immediate: true });
    }
  } catch (error) {
    els.ppLinesBridge?.setStatus("error");
  }
}

// "P" -> pitcher-only stats, anything else known -> batter-only stats,
// undefined/null (position not known, e.g. typed-and-Entered names that
// skipped autocomplete) -> both, so a valid option is never hidden just
// because we couldn't confirm the position.
function selectPlayer(player, position, { autoSelectStat = true, viaDeepDive = false, playerEntry = null } = {}) {
  lineSelectionToken++;
  clearTimeout(lineDebounceTimer);
  clearTimeout(researchPrefetchTimer);
  if (!viaDeepDive) {
    state.boardResearchContext = null;
    state.v2DeepDiveReturn = null;
    els.v2BackBtn.hidden = true;
  }
  hideResults();
  rememberResearchPlayer({ ...(playerEntry || {}), player, sub: position || playerEntry?.sub || "MLB" });
  cmd.player = player;
  cmd.playerId = playerEntry?.playerId || null;
  cmd.teamId = playerEntry?.teamId || null;
  cmd.teamName = playerEntry?.team || "";
  cmd.stat = null;
  cmd.line = null;
  cmd.side = null;

  const staticProps = propsForPlayer();
  const first = staticProps[0];

  const profileSource = first || playerEntry || player;
  const profileTeamId = first?.teamId || first?.team_id || playerEntry?.teamId || null;
  const profileTeam = first?.team || playerEntry?.team || "";
  els.profileAvatar.innerHTML = avatarHtml(profileSource, "lg");
  els.profileName.innerHTML = `<span>${escapeHtml(player)}</span>${teamLogoHtml(profileTeamId, profileTeam, "profile-team-logo")}`;
  els.profileSub.textContent = first
    ? `${first.sport} · pick a stat to dial in a line`
    : "MLB · pick a stat to look up a live line";

  // "TWP" = two-way player (e.g. Ohtani) -- genuinely both a hitter and a
  // pitcher, so neither stat set alone is correct; show everything, same
  // as the unknown-position fallback.
  const standardForPosition =
    position === "P" ? PITCHER_STATS :
    position === "TWP" || !position ? STANDARD_STATS :
    BATTER_STATS;

  // Static stats first (instant), then any standard stats not already covered —
  // those fall through to the live API when selected.
  const staticStats = [...new Set(staticProps.map((p) => p.betType))];
  const stats = [...new Set([...staticStats, ...standardForPosition])];

  els.profileStats.innerHTML = "";
  stats.forEach((stat) => {
    const opt = document.createElement("option");
    opt.value = stat;
    opt.textContent = stat;
    els.profileStats.appendChild(opt);
  });
  els.profileStatsBridge?.setOptions(stats);

  els.linePicker.hidden = true;
  els.playerProfile.hidden = false;
  if (els.recentSearches) els.recentSearches.hidden = true;
  clearReport();
  els.playerProfile.scrollIntoView({ behavior: "smooth", block: "nearest" });

  // Auto-select the first stat so the line picker appears immediately
  // instead of requiring an extra click just to see anything (a plain
  // <select> has no "nothing selected" affordance the way a button grid did).
  // Skipped when reopening a saved prop -- openExactProp sets the exact
  // saved stat/line/side itself right after this call, so auto-selecting
  // here would fire one wasted live fetch for the wrong (first) stat.
  if (autoSelectStat && stats.length) selectStat(stats[0]);
}

function selectStat(stat) {
  cmd.stat = stat;
  prizePicksDefaultPending = true;
  currentResearchProp = null;
  els.ppLinesWrap.hidden = true;
  if (els.profileStats.value !== stat) els.profileStats.value = stat;
  els.profileStatsBridge?.setValue(stat);

  const statMatches = propsForPlayer().filter((p) => p.betType === stat);
  const matches = statMatches.filter((p) => p.side === "Over");
  const hasStaticData = statMatches.length > 0;
  const fallbackLine = STAT_DEFAULT_LINE[stat] ?? 0.5;
  const lines = hasStaticData ? statMatches.map((p) => p.line) : [fallbackLine];
  const defaultProp = matches[0] || statMatches[0];
  const availableSides = new Set(statMatches.map((p) => p.side));

  // Only lock out a side when we KNOW (from static data) it has no coverage.
  // For live lookups both sides are always computable, so leave them enabled.
  els.sideToggle.querySelectorAll(".side-btn").forEach((b) => {
    const hasData = !hasStaticData || availableSides.has(b.dataset.side);
    b.disabled = !hasData;
    b.title = hasData ? "" : `No ${b.dataset.side} data for ${stat}`;
  });

  // Slider spans a little past the known lines so there's room to explore.
  // The span scales with the line itself so high-volume stats (Strikeouts
  // routinely opens at 5.5+) get real headroom instead of a flat +/-1.5.
  const span = Math.max(1.5, Math.round(Math.max(...lines) * 0.6 * 2) / 2);
  const min = Math.max(0, Math.min(...lines) - span);
  const max = Math.max(...lines) + span;
  els.lineSlider.min = String(min);
  els.lineSlider.max = String(max);
  els.lineNumber.min = String(min);
  els.lineNumber.max = String(max);

  cmd.side = !hasStaticData || availableSides.has("Over") ? "Over" : defaultProp.side;
  els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === cmd.side));

  els.linePicker.hidden = false;
  setLineValue(defaultProp ? defaultProp.line : lines[0]);
}

// Dragging the slider fires an "input" event per pixel of movement. Running
// applyLineSelection() (which re-renders a loading skeleton, or the whole
// report, on every tick) on each of those made the slider visibly stutter
// mid-drag. The value/fill/number stay perfectly live (cheap, no re-render);
// only the actual lookup is debounced until the drag settles.
function setLineValue(value, { immediate = false } = {}) {
  lineSelectionToken++;
  let min = Number(els.lineSlider.min);
  let max = Number(els.lineSlider.max);
  // The slider's min/max is only a starting guess (STAT_DEFAULT_LINE, or the
  // range around whatever static lines happen to be loaded) -- it's often
  // nowhere near a given player's actual line (e.g. a default guess of 8.5
  // for Fantasy Score puts the floor at 3.5, but plenty of real lines sit
  // well under that). Typing the real sportsbook line or stepping past
  // either edge should widen the range to fit it, never silently reject it.
  const snapped = Math.max(0, Math.round(value * 2) / 2); // snap to 0.5, floor at 0
  if (snapped < min) {
    min = Math.max(0, snapped - 1);
    els.lineSlider.min = String(min);
    els.lineNumber.min = String(min);
  }
  if (snapped > max) {
    max = snapped + 1;
    els.lineSlider.max = String(max);
    els.lineNumber.max = String(max);
  }
  cmd.line = snapped;

  els.lineSlider.value = String(snapped);
  els.lineNumber.value = String(snapped);
  const pct = max > min ? ((snapped - min) / (max - min)) * 100 : 0;
  els.lineSlider.style.setProperty("--fill", `${pct}%`);

  clearTimeout(lineDebounceTimer);
  if (immediate) {
    applyLineSelection();
  } else {
    lineDebounceTimer = setTimeout(applyLineSelection, 120);
  }
}

function withAuthoritativeBoardMatchup(prop, player, stat, line, side) {
  // The board remains authoritative for the official VORTEX pick score/tier.
  // Research keeps the live matchup grade from the restored f4042bf model.
  const boardContext = state.boardResearchContext;
  const sameBoardProp = boardContext
    && boardContext.player.toLowerCase() === String(player).toLowerCase()
    && boardContext.stat === stat
    && Math.abs(Number(boardContext.line) - Number(line)) < 0.01
    && boardContext.side === String(side).toLowerCase();
  if (!sameBoardProp) return prop;
  return {
    ...prop,
    ...(boardContext.vortexScore != null && Number.isFinite(Number(boardContext.vortexScore))
      ? { score: Number(boardContext.vortexScore), tier: boardContext.tier || prop.tier }
      : {}),
  };
}

function applyLineSelection() {
  const match = propsForPlayer().find(
    (p) => canReuseResearch(p) && !state.boardResearchContext && p.betType === cmd.stat && Math.abs(p.line - cmd.line) < 0.01 && p.side === cmd.side
  );

  const token = ++lineSelectionToken; // race guard for fast slider drags

  if (match) {
    els.lineNoData.hidden = true;
    renderReport(withAuthoritativeBoardMatchup(match, cmd.player, cmd.stat, cmd.line, cmd.side));
    return;
  }

  els.lineNoData.hidden = true;
  fetchLivePrediction(cmd.player, cmd.stat, cmd.line, cmd.side, token);
}

async function fetchLivePrediction(player, stat, line, side, token) {
  const context = { player, stat, line, side, playerId: cmd.playerId,
    teamId: cmd.teamId, teamName: cmd.teamName,
    boardRevision: state.boardResearchContext ? JSON.stringify(state.boardResearchContext) : "" };
  const cached = researchClient.peek(context);
  if (cached) {
    renderReport(withAuthoritativeBoardMatchup(cached, player, stat, line, side));
    return;
  }
  renderLoadingState(player, stat, line, side);
  try {
    const result = await researchClient.request(context);
    if (token !== lineSelectionToken) return;
    renderReport(withAuthoritativeBoardMatchup(result, player, stat, line, side));
  } catch (err) {
    if (token !== lineSelectionToken) return;
    const errorMessage = forMember(err.name === "AbortError"
      ? "Research took longer than 15 seconds. Please retry."
      : err.message || "Live research is temporarily unavailable. Please tap the stat to retry.",
    "Research for this stat isn't ready yet. Tap it again in a moment.");
    showNoDataMessage(stat, line, side, errorMessage);
  }
}

function renderLoadingState(player, stat, line, side) {
  parkGameLogOverlay();
  els.reportWrap.querySelector(".report")?.remove();
  removeResearchLoader();
  els.emptyState.hidden = true;

  const skeleton = document.createElement("div");
  els.reportWrap.setAttribute("aria-busy", "true");
  skeleton.className = "report-skeleton";
  const host = document.createElement("div");
  host.className = "research-ai-loader-host";
  skeleton.appendChild(host);
  els.reportWrap.appendChild(skeleton);
  if (typeof window.vortexMountResearchLoader === "function") {
    researchLoaderCleanup = window.vortexMountResearchLoader(host, { player, stat, line, side });
  } else {
    host.innerHTML = `<div class="research-ai-loader" role="status"><strong>Preparing ${escapeHtml(player)} prop research…</strong></div>`;
  }
}

function removeResearchLoader() {
  researchLoaderCleanup?.();
  researchLoaderCleanup = null;
  els.reportWrap.querySelector(".report-skeleton")?.remove();
  els.reportWrap.removeAttribute("aria-busy");
}

function showNoDataMessage(stat, line, side, liveError) {
  clearReport();
  const nearest = propsForPlayer()
    .filter((p) => p.betType === stat)
    .sort((a, b) => Math.abs(a.line - line) - Math.abs(b.line - line))[0];

  els.lineNoData.hidden = false;
  // Server no-game messages are already complete sentences written for the
  // user ("...is currently in the minors (Nashville Sounds) — no MLB game to
  // research.") — show those as-is. Anything without terminal punctuation is
  // a raw failure ("Failed to fetch", "Request failed (500)") that still
  // needs framing.
  els.lineNoData.innerHTML = liveError
    ? (/[.!?]$/.test(liveError.trim())
        ? escapeHtml(liveError.trim())
        : `Live lookup failed for ${escapeHtml(side)} ${line} — ${escapeHtml(liveError)}.`)
    : `No computed analysis for ${escapeHtml(side)} ${line} yet.`;

  if (nearest) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `Jump to ${nearest.side} ${nearest.line} (Score ${nearest.score})`;
    btn.addEventListener("click", () => {
      cmd.side = nearest.side;
      els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === cmd.side));
      setLineValue(nearest.line);
    });
    els.lineNoData.appendChild(btn);
  }
}

function propsForPlayer() {
  return state.props.filter((p) => p.player === cmd.player);
}

/** Once a live result confirms the real player name/team, fix up the profile
 * header (which only had whatever casing the user typed, e.g. "freddie freeman"). */
function syncProfileHeaderWithProp(p) {
  if (!els.playerProfile.hidden && p.player) {
    const nameNode = els.profileName.querySelector("span");
    if (nameNode) nameNode.textContent = p.player;
    else els.profileName.innerHTML = `<span>${escapeHtml(p.player)}</span>`;
    els.profileAvatar.innerHTML = avatarHtml(p, "lg");
    cmd.player = p.player;
  }
}

// #gamelog-overlay starts as a top-level element in index.html and becomes
// a descendant of ".report" the first time mountResearchTabs() moves it
// into the Trend tab. From then on ANY teardown of the report takes the
// overlay down with it, and since it's found by id, a detached one is
// unreachable -- mountResearchTabs() then can't re-add it and the Trend
// tab stays empty for the rest of the session. Park it back on <body>
// before tearing the report down. Every teardown path has to call this;
// renderLoadingState() not doing so is what made the Trend tab vanish at
// seemingly random times, since it runs on every live research fetch
// (the static-match path skips it, which is why it only sometimes broke).
// mountResearchTabs() also keeps its own reference as a second line of
// defence -- see src/report-tabs.js.
function parkGameLogOverlay() {
  // Only MLB's report owns the panel here. While another sport has it
  // mounted (see window.vortexTrendPanel), an MLB teardown running in the
  // background -- clearReport/renderLoadingState fire on flows that are
  // still live even when the MLB surface is hidden -- would rip the node
  // out of that sport's Trend tab and blank it.
  if (!isMlbTrend() || externalTrendHost?.isConnected) return;
  const overlay = document.getElementById("gamelog-overlay");
  if (overlay && overlay.parentElement !== document.body) document.body.appendChild(overlay);
}

function clearReport() {
  parkGameLogOverlay();
  els.reportWrap.querySelector(".report")?.remove();
  removeResearchLoader();
  // Keep the mounted research-home buttons intact when a player or stat changes.
  els.emptyState.hidden = Boolean(cmd.player);
}

/* ---------- Report rendering (Research tab) ---------- */

function renderReport(p) {
  hideResults();
  els.emptyState.hidden = true;
  parkGameLogOverlay();
  els.reportWrap.querySelector(".report")?.remove();
  removeResearchLoader();
  syncProfileHeaderWithProp(p);
  currentResearchProp = p;
  els.ppLinesWrap.hidden = !(p?.matchup?.opponent && cmd.player && cmd.stat);
  if (!els.ppLinesWrap.hidden) {
    els.ppLinesBridge?.setStatus("loading");
    loadPrizePicksLines();
  }

  const node = buildReportNode(p);
  node.classList.add("research-enter");
  mountResearchTabs(node, p);
  els.reportWrap.appendChild(node);
  // mountResearchTabs() may have already selected a tab (e.g. the user's
  // remembered choice from a prior player) while the report was still
  // disconnected from the document -- any 'rr:panel-shown' it fired then
  // couldn't animate anything. Re-fire for whichever panel is visible now
  // that the node is actually on the page.
  const visiblePanel = node.querySelector(".rr-tab-panel:not([hidden])");
  if (visiblePanel) {
    visiblePanel.dispatchEvent(new CustomEvent("rr:panel-shown", { bubbles: true, detail: { key: visiblePanel.dataset.researchPanel } }));
  }

  const saveBtn = node.querySelector(".save-btn");
  syncSaveButton(saveBtn, p.id);
  saveBtn.addEventListener("click", () => toggleSave(p, saveBtn));

  const revealBlocks = node.querySelectorAll("[data-reveal]");
  revealBlocks.forEach(block => block.classList.add("in"));

  requestAnimationFrame(() => {
    countUpScoreNum(node, p.score);
    fillHitRateBars(node, p.hitRates || {});
    fillSparkline(node, p.last5 || [], p.line);
  });

  const expandBtn = node.querySelector(".last5-expand-btn");
  if (p.gameLogChart && Object.keys(p.gameLogChart).length) {
    // The Trend tab's full chart used to only populate once someone clicked
    // this mini row -- now it's the tab's entire content, so it has to be
    // ready the moment the tab exists, not gated behind a click nobody
    // knows to make. The mini row's own click still just jumps to Trend.
    openGameLogModal(p);
    expandBtn.addEventListener("click", () => focusResearchTab("trend"));
  } else {
    expandBtn.classList.add("last5-expand-disabled");
    expandBtn.disabled = true;
  }

  if (state.currentTab === "research") {
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ---------- Expandable game log modal (L5/L10/L15/L20/H2H) ---------- */

let gameLogState = {
  chart: null, line: null, player: "", opponent: "", window: "recent",
  handFilter: "all", venueFilter: "all", handDataLoaded: false, teamId: null,
  stat: "", isPitcher: false, fetchToken: 0, gameCount: 10, season: "all",
  // Which window button is selected, kept separately from gameCount because
  // gameCount gets clamped to however many games survive the filters -- pick
  // L20 with only 6 matching games and gameCount becomes 6, which would
  // otherwise light up "Season" instead of the button actually clicked.
  windowKey: "10",
  filtersOpen: false, animationDirection: "none",
  loading: false, error: '', lineEdited: false, dragging: false,
};
const gameLogDetailsCache = createTrendCache();
const gameLogOddsCache = createTrendCache({ maxAge: 120000 });
const gameLogCustomLines = new Map();
function gameLogLineKey() {
  return `${nameKey(gameLogState.player)}|${gameLogState.stat}`;
}

function snapPropLine(value) {
  return Math.max(0.5, Math.round(Number(value) - 0.5) + 0.5);
}

const GAMELOG_STAT_CODES = {
  "Hits+Runs+RBIs": "HRR", "Total Bases": "TB", "Hits": "H",
  "Home Runs": "HR", "RBIs": "RBI", "Runs Scored": "R",
  "Strikeouts": "SO", "Walks": "BB", "Fantasy Score": "FS",
  "Strikeouts (Pitcher)": "K", "Pitching Outs": "OUTS",
  "Earned Runs Allowed": "ER", "Hits Allowed": "HA", "Walks Allowed": "PBB",
  "Fantasy Score (Pitcher)": "PFS",
  "Stolen Bases": "SB", "Singles": "1B", "Pitches Thrown": "PC", "Pitcher Fantasy Score": "PFS",
  "1st Inning Hits Allowed": "1ST H", "1st Inning Runs Allowed": "1ST R", "1st Inning Pitches Thrown": "1ST PC",
  "1st Inning Walks Allowed": "1ST BB", "1st Inning Strikeouts": "1ST K",
};
// Markets only the Finder's trend panel charts (from the Finder's own
// history, prop-finder-core gameValue). Research's own dropdowns keep
// BATTER_STATS / PITCHER_STATS, which its engine supports.
const FINDER_BATTER_EXTRAS = ["Stolen Bases", "Singles"];
const FINDER_PITCHER_EXTRAS = ["Pitches Thrown", "1st Inning Hits Allowed", "1st Inning Runs Allowed",
  "1st Inning Pitches Thrown", "1st Inning Walks Allowed", "1st Inning Strikeouts"];
const MLB_TEAM_IDS = { ARI:109, AZ:109, ATL:144, BAL:110, BOS:111, CHC:112, CWS:145, CIN:113, CLE:114, COL:115, DET:116, HOU:117, KC:118, LAA:108, LAD:119, MIA:146, MIL:158, MIN:142, NYM:121, NYY:147, OAK:133, PHI:143, PIT:134, SD:135, SEA:136, SF:137, STL:138, TB:139, TEX:140, TOR:141, WSH:120 };
const MLB_TEAM_ABBRS = { 108:"LAA",109:"ARI",110:"BAL",111:"BOS",112:"CHC",113:"CIN",114:"CLE",115:"COL",116:"DET",117:"HOU",118:"KC",119:"LAD",120:"WSH",121:"NYM",133:"ATH",134:"PIT",135:"SD",136:"SEA",137:"SF",138:"STL",139:"TB",140:"TEX",141:"TOR",142:"MIN",143:"PHI",144:"ATL",145:"CWS",146:"MIA",147:"NYY",158:"MIL" };

/* ---------- Sport adapters for the trend panel ----------
 * #gamelog-overlay is a singleton, and its renderers -- renderGameLogChart,
 * renderGameLogTabs, renderGameLogSubfilters, the window bar, the line
 * marker, the odds row -- only ever read gameLogState. They are already
 * sport-agnostic. The only MLB-specific parts are the HEADER (team marks,
 * headshot, matchup logos) and the LOADERS (which endpoints supply the
 * games, the posted-line ladder and the book quotes).
 *
 * So a second sport does NOT get a second trend panel: it mounts this very
 * node (see window.vortexTrendPanel further down) and swaps in its own
 * adapter here. Everything visual stays literally the same code, the same
 * markup and the same CSS.
 */
const MLB_TREND_ADAPTER = {
  sport: "MLB",
  statCode: (stat) => GAMELOG_STAT_CODES[stat] || stat,
  statList() {
    const stats = gameLogState.availableStats || (gameLogState.isPitcher ? PITCHER_STATS : BATTER_STATS);
    // One tab per market, however many spellings of it are listed.
    const seen = new Set();
    return stats.filter((stat) => {
      const market = finderMarket(stat);
      const id = market && `${market.pitcher}:${market.key}`;
      if (!market || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  },
  classify(p) {
    gameLogState.isPitcher = PITCHER_STATS.includes(p.betType) || p.position === "P" || p.isPitcherProp === true || !!finderMarket(p.betType)?.pitcher;
    const twoWay = p.isTwoWay === true || p.position === "TWP" || /shohei\s+ohtani/i.test(p.player || "");
    const base = twoWay ? STANDARD_STATS : (gameLogState.isPitcher ? PITCHER_STATS : BATTER_STATS);
    // Opened from the Finder: its market names, plus the markets only it charts.
    gameLogState.availableStats = externalTrendHost
      ? [...base.map((stat) => finderMarket(stat)?.label || stat),
        ...(twoWay || !gameLogState.isPitcher ? FINDER_BATTER_EXTRAS : []),
        ...(twoWay || gameLogState.isPitcher ? ["Pitcher Fantasy Score", ...FINDER_PITCHER_EXTRAS] : [])]
      : base;
  },
  renderHeader(p) {
    const liveState = document.getElementById("gamelog-live-state");
    const currentStatus = p.live?.status || p.gameStatus || (p.matchup?.lineup ? "Lineup confirmed" : "Pre-game");
    if (liveState) liveState.textContent = currentStatus;
    syncGameLogContext({
      matchup: p.matchup?.opponent ? `vs ${p.matchup.opponent} · performance history` : "Live prop performance explorer",
      status: currentStatus,
    });
    if (els.gamelogPropBadge) els.gamelogPropBadge.textContent = gameLogStatCode(p.betType);
    const teamName = p.teamAbbr || p.teamName || (typeof p.team === "string" ? p.team : p.team?.abbreviation) || cmd.teamName || "";
    const teamId = p.teamId || p.team_id || p.ownTeamId || p.team?.id || cmd.teamId || MLB_TEAM_IDS[String(teamName).toUpperCase()];
    const matchup = matchupGameDetails({ ...p, team_id: p.team_id || teamId, team: p.team || teamName });
    const matchupLogosEl = document.getElementById("gamelog-matchup-logos");
    const marketMatchupEl = document.getElementById("gamelog-market-matchup");
    const marketTimeEl = document.getElementById("gamelog-market-time");
    const lineMovement = document.getElementById("gamelog-line-movement");
    if (lineMovement) lineMovement.hidden = false;
    if (matchupLogosEl) matchupLogosEl.innerHTML = `${matchupGameLogo(matchup.awayId || teamId, matchup.away || teamName)}${matchupGameLogo(matchup.homeId || p.opponentTeamId, matchup.home || p.matchup?.opponent)}`;
    if (marketMatchupEl) marketMatchupEl.textContent = matchup.label || (p.matchup?.opponent ? `vs ${p.matchup.opponent}` : "Matchup pending");
    const matchupDate = Number.isFinite(matchup.timestamp) ? new Date(matchup.timestamp) : null;
    if (marketTimeEl) marketTimeEl.textContent = matchupDate ? matchupDate.toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" }) : "Time TBA";
    if (els.gamelogTeamMark) {
      els.gamelogTeamMark.hidden = !teamName && !teamId;
      els.gamelogTeamMark.innerHTML = teamId
        ? `<img src="https://www.mlbstatic.com/team-logos/${encodeURIComponent(teamId)}.svg" alt="" onerror="this.style.display='none'"><span>${escapeHtml(teamName)}</span>`
        : `<span>${escapeHtml(teamName)}</span>`;
    }
    const cutout = String(p.headshot || "").replace("/headshot/67/current", "/headshot/silo/current");
    els.gamelogPlayerCutout.innerHTML = cutout
      ? `<img src="${escapeHtml(cutout)}" alt="" onerror="this.parentElement.innerHTML=''">`
      : avatarHtml(p, "lg");
  },
};
let trendAdapter = MLB_TREND_ADAPTER;
const isMlbTrend = () => trendAdapter === MLB_TREND_ADAPTER;

function gameLogStatCode(stat) {
  return trendAdapter.statCode(stat);
}

function regradeGameLog(line) {
  gameLogState.chart = gradeTrendChart(gameLogState.chart, line, gameLogState.side);
}

function syncGameLogContext({ matchup, status } = {}) {
  const line = document.getElementById("gamelog-context-line");
  const matchupEl = document.getElementById("gamelog-context-matchup");
  const statusEl = document.getElementById("gamelog-context-status");
  const bookLine = document.getElementById("gamelog-book-line");
  const marketTitle = document.getElementById("gamelog-market-title");
  if (line) line.textContent = `${gameLogStatCode(gameLogState.stat || "Prop")} ${Number(gameLogState.line || 0).toFixed(1)}`;
  if (bookLine) bookLine.textContent = Number(gameLogState.line || 0).toFixed(1);
  if (marketTitle) marketTitle.textContent = String(gameLogState.stat || "Prop performance").replace(/\s*\(Pitcher\)\s*$/i, "");
  renderTrendSave();
  if (matchupEl && matchup !== undefined) matchupEl.textContent = matchup || "Live prop performance explorer";
  if (statusEl && status !== undefined) statusEl.textContent = String(status || "Pre-game").toUpperCase();
}

function setGameLogPreviewLine(value, settle = false, userInitiated = true) {
  const viewportState=captureGameLogViewport();
  const raw = Math.max(0.5, Number(value) || 0.5);
  const line = settle ? snapPropLine(raw) : raw;
  gameLogState.line = line;
  if (userInitiated) {
    gameLogState.lineEdited = true;
    gameLogCustomLines.set(gameLogLineKey(), line);
  }
  els.gamelogLinesBridge?.setValue(String(line));
  if (els.gamelogLineValue) els.gamelogLineValue.textContent = Number(line).toFixed(1);
  syncGameLogContext();
  renderGameLogBookOdds();
  if (settle) {
    regradeGameLog(line);
    renderGameLogTabs();
  }
  renderGameLogChart();
  if (activeFinderProp) {
    activeFinderProp = {...activeFinderProp, player: gameLogState.player, betType: gameLogState.stat, line};
    renderLineMovement(activeFinderProp);
  }
  if (userInitiated) externalTrendConfig?.onLine?.(line);
  restoreGameLogViewport(viewportState);
}

function captureGameLogViewport() {
  const modal=els.gamelogOverlay?.querySelector('.gamelog-modal');
  return {pageY:window.scrollY,overlayTop:els.gamelogOverlay?.scrollTop||0,modal,modalTop:modal?.scrollTop||0,chartLeft:els.gamelogChart?.scrollLeft||0};
}

function restoreGameLogViewport(saved) {
  const restore=()=>{if(!saved)return;if(els.gamelogOverlay)els.gamelogOverlay.scrollTop=saved.overlayTop;if(saved.modal)saved.modal.scrollTop=saved.modalTop;if(els.gamelogChart)els.gamelogChart.scrollLeft=saved.chartLeft;if(!document.body.classList.contains('gamelog-scroll-locked'))window.scrollTo({top:saved.pageY,left:0,behavior:'instant'});};
  restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});
}

function populateGameLogStats() {
  const stats = trendAdapter.statList();
  const existing = [...els.gamelogStatTabs.querySelectorAll('button[data-stat]')];
  if (existing.length === stats.length && existing.every((button,index) => button.dataset.stat === stats[index])) {
    existing.forEach(button => {button.classList.toggle('active',button.dataset.stat===gameLogState.stat);button.setAttribute('aria-pressed',String(button.dataset.stat===gameLogState.stat));});
    syncTrendChipLine();
    return;
  }
  const scrollLeft = els.gamelogStatTabs.scrollLeft;
  els.gamelogStatTabs.innerHTML = trendAdapter.statList().map((stat) => `<button type="button" data-stat="${escapeHtml(stat)}" title="${escapeHtml(stat)}" aria-label="${escapeHtml(stat)}" aria-pressed="${stat === gameLogState.stat}" class="${stat === gameLogState.stat ? "active" : ""}"><b>${escapeHtml(trendChipName(stat))}</b><small data-chip-line>${escapeHtml(trendChipLine(stat))}</small></button>`).join("");
  els.gamelogStatTabs.scrollLeft = scrollLeft;
  syncTrendChipLine();
}
// A chip's name: the stat's code, or a long name shortened the way a
// sportsbook writes it ("Receiving Yards" -> "Rec Yds").
const CHIP_WORDS = [[/\breceiving\b/gi, "Rec"], [/\breceptions\b/gi, "Rec"], [/\brushing\b/gi, "Rush"], [/\bpassing\b/gi, "Pass"],
  [/\byards\b/gi, "Yds"], [/\battempts\b/gi, "Att"], [/\bcompletions\b/gi, "Cmp"], [/\btouchdowns?\b/gi, "TD"],
  [/\binterceptions\b/gi, "INT"], [/\blongest\b/gi, "Long"], [/\breception\b/gi, "Rec"], [/\brebounds\b/gi, "Reb"],
  [/\bassists\b/gi, "Ast"], [/\bpoints\b/gi, "Pts"], [/\bthree pointers made\b/gi, "3PM"], [/\b3-?pointers made\b/gi, "3PM"],
  [/\bfantasy score\b/gi, "Fantasy"], [/\bshots on target\b/gi, "SOT"], [/\bshots on goal\b/gi, "SOG"], [/\bgoalie saves\b/gi, "Saves"],
  [/\bblocked shots\b/gi, "Blocks"], [/\bpasses attempted\b/gi, "Passes"], [/\bturnovers\b/gi, "TO"], [/\bsteals\b/gi, "Stl"]];
function trendChipName(stat) {
  const code = gameLogStatCode(stat);
  if (code !== stat || String(stat).length <= 9) return code;
  return CHIP_WORDS.reduce((text, [pattern, short]) => text.replace(pattern, short), String(stat));
}
// A stat chip's line: the chart's for the stat on it, else the host's posted one.
function trendChipLine(stat) {
  if (stat === gameLogState.stat && Number.isFinite(Number(gameLogState.line))) return Number(gameLogState.line).toFixed(1);
  const posted = externalTrendConfig?.stats?.find((item) => item.label === stat)?.line;
  return Number.isFinite(Number(posted)) && posted !== null && posted !== "" ? Number(posted).toFixed(1) : "";
}
function syncTrendChipLine() {
  els.gamelogStatTabs?.querySelectorAll("button[data-stat]").forEach((button) => {
    const slot = button.querySelector("[data-chip-line]");
    if (slot) slot.textContent = trendChipLine(button.dataset.stat);
  });
}

// The sport-neutral half of switching the panel to another stat: badge,
// title, line readout, which stat tab reads as selected. Every sport's
// loader starts here and only differs in where the GAMES come from.
function syncTrendStatHeader(stat) {
  els.gamelogLineValue.textContent = Number(gameLogState.line || 0).toFixed(1);
  if (els.gamelogPropBadge) els.gamelogPropBadge.textContent = gameLogStatCode(stat);
  els.gamelogTitle.textContent = gameLogState.player || "Player";
  els.gamelogStatTabs?.querySelectorAll('button').forEach(button => {
    button.disabled = false;
    button.classList.toggle('active', button.dataset.stat === stat);
    button.setAttribute('aria-pressed', String(button.dataset.stat === stat));
  });
  syncGameLogContext();
}

async function loadGameLogStat(stat, { initialProp = null } = {}) {
  if (!isMlbTrend()) return trendAdapter.loadStat(stat);
  const token = ++gameLogState.fetchToken;
  const previousPitcher = gameLogState.isPitcher;
  gameLogState.stat = stat;
  gameLogState.isPitcher = !!finderMarket(stat)?.pitcher;
  if (previousPitcher !== gameLogState.isPitcher) gameLogState.handFilter = 'all';
  gameLogState.dragging = false;
  gameLogState.chart = gradeTrendChart(initialProp?.gameLogChart || {}, initialProp?.line);
  gameLogState.error = '';
  gameLogState.loading = true;
  gameLogState.handDataLoaded = false;
  gameLogState.animationDirection = 'none';
  if (gameLogState.window === 'h2h' || gameLogState.windowKey === 'h2h') {
    gameLogState.window = 'recent';
    gameLogState.windowKey = '10';
    gameLogState.gameCount = 10;
  }
  const remembered = gameLogCustomLines.get(gameLogLineKey());
  const requestedLine = Number(initialProp?.line ?? remembered ?? STAT_DEFAULT_LINE[stat] ?? 0.5);
  gameLogState.line = Number.isFinite(requestedLine) ? requestedLine : 0.5;
  gameLogState.lineEdited = initialProp != null || remembered != null;
  if (els.gamelogHandField) els.gamelogHandField.hidden = gameLogState.isPitcher;
  if (activeFinderProp) {
    activeFinderProp = { ...activeFinderProp, player: gameLogState.player, betType: stat, line: gameLogState.line };
    renderLineMovement(activeFinderProp);
  }
  syncTrendStatHeader(stat);
  const context = { player: gameLogState.player, stat, teamId: gameLogState.teamId, opponent: gameLogState.opponent };
  const current = () => token === gameLogState.fetchToken && context.player === gameLogState.player && stat === gameLogState.stat;
  let detailed = false;
  const paint = () => {
    if (!current()) return;
    if (recentGameLogSource().length) gameLogState.loading = false;
    regradeGameLog(gameLogState.line);
    els.glHandFilterBridge?.setDisabled(!gameLogState.handDataLoaded);
    renderGameLogTabs(); renderGameLogChart();
  };
  const accept = (data, isDetail = false) => {
    if (!current() || (!isDetail && detailed)) return;
    detailed ||= isDetail;
    gameLogState.chart = gameLogState.isPitcher ? data : mergeTrendCharts(gameLogState.chart, data);
    gameLogState.handDataLoaded = isDetail;
    if (data.meta?.player_id && !initialProp?.headshot && els.gamelogPlayerCutout) {
      els.gamelogPlayerCutout.innerHTML = `<img src="https://img.mlbstatic.com/mlb-photos/image/upload/w_300/v1/people/${encodeURIComponent(data.meta.player_id)}/headshot/silo/current" alt="">`;
    }
    paint();
  };
  // Raw pitching history contains every supported pitching stat. Recalculate
  // locally; do not replace starts with the detail endpoint's relief games.
  const cachedHistory = finderMarket(stat) ? cachedFinderHistory(context) : null;
  const cachedDetails = gameLogState.isPitcher ? null : gameLogDetailsCache.peek(trendContextKey(context));
  if (cachedDetails) accept(cachedDetails, true);
  else if (cachedHistory) accept(historyChart(cachedHistory, { ...context, line: gameLogState.line }));
  else paint(); // Clear the previous market's bars before any network response.
  const lines = loadGameLogPostedLines(stat, context.player);
  loadGameLogBookOdds(stat, context.player);
  if (!finderMarket(stat)) {
    gameLogState.chart = {};
    gameLogState.loading = false;
    gameLogState.error = 'This market is not supported yet.';
    paint();
    return;
  }
  const requests = [];
  if (!cachedHistory && !cachedDetails) requests.push(requestFinderHistory(context).then(payload => {
    accept(historyChart(payload, { ...context, line: gameLogState.line }));
  }));
  if (!gameLogState.isPitcher && !cachedDetails) requests.push(requestGameLogDetails(context).then(data => accept(data, true)));
  const results = await Promise.allSettled(requests);
  if (!current()) return;
  const wasLoading = gameLogState.loading;
  gameLogState.loading = false;
  if (results.length && results.every(result => result.status === 'rejected') && !recentGameLogSource().length) {
    gameLogState.error = forMember('Could not load this stat. Try again.', 'No games to show for this stat yet.');
  }
  if (requests.length || wasLoading) paint();
  await lines;
}

function requestGameLogDetails(context) {
  return gameLogDetailsCache.request(trendContextKey(context), async () => {
    const url = `/api/game-log-filters?player=${encodeURIComponent(context.player)}&stat=${encodeURIComponent(context.stat)}&line=0.5&season=all` +
      (context.teamId ? `&teamId=${encodeURIComponent(context.teamId)}` : '') +
      (context.opponent ? `&opponent=${encodeURIComponent(context.opponent)}` : '');
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'History unavailable');
    return data;
  });
}

// `adapter` decides which sport this panel is now showing. It defaults to
// MLB so that every existing MLB entry point (a report rendering, the
// pitcher finder, the quick-action sheet, swipe-to-next-prop) automatically
// reclaims the shared panel from whichever sport had it last.
function openGameLogModal(p, adapter = MLB_TREND_ADAPTER) {
  trendAdapter = adapter;
  activeFinderProp = p;
  gameLogState.side = p.side || "Over";
  gameLogState.chart = gradeTrendChart(p.gameLogChart || {}, p.line, gameLogState.side);
  if (!gameLogState.chart.all) {
    gameLogState.chart.all = [...(gameLogState.chart.l20 || gameLogState.chart.l15 || gameLogState.chart.l10 || gameLogState.chart.l5 || [])];
  }
  gameLogState.line = p.line;
  gameLogState.player = p.player;
  gameLogState.stat = p.betType;
  trendAdapter.classify(p);
  gameLogState.opponent = (p.matchup && p.matchup.opponent) || "";
  gameLogState.handFilter = "all";
  gameLogState.venueFilter = "all";
  gameLogState.extraFilters = {};
  // A page may start without preseason games (basketball at tip-off: the
  // last five would be preseason minutes, the Finder's aren't).
  gameLogState.seasonKind = (trendAdapter === EXTERNAL_TREND_ADAPTER && externalTrendConfig?.seasonKind) || "all";
  gameLogState.handDataLoaded = false;
  gameLogState.gameCount = 10;
  gameLogState.windowKey = "10";
  gameLogState.window = "recent";
  // Start with the complete recent sample. Selecting the newest season here
  // could temporarily collapse the chart to one game while the detail request
  // was still loading, which made the modal visibly jump after opening.
  gameLogState.season = "all";
  gameLogState.animationDirection = "initial";
  // Deliberately NOT teamInsightsParams.teamId -- that's the player's own
  // team (for the Team Insights lineup view), while H2H filtering here needs
  // the actual opponent's team id.
  gameLogState.teamId = p.opponentTeamId || null;
  els.gamelogOverlay.hidden = false;
  els.gamelogTitle.textContent = p.player || "Player";
  trendAdapter.renderHeader(p);
  els.gamelogLineValue.textContent = Number(p.line).toFixed(1);
  populateGameLogStats();
  // Filters used to default closed behind a toggle; they're a permanently
  // visible section now, so this just keeps the chart's "filters open"
  // narrower layout applied instead of ever collapsing it.
  setGameLogFiltersOpen(true);
  renderGameLogTabs();
  renderGameLogChart();
  gameLogLayoutSignature = "";
  stabilizeGameLogLayout();

  // Career H2H is loaded lazily for every prop when the explorer opens.
  // Batter props also resolve opposing-starter handedness; pitcher props do
  // not, because one start faces a mixed lineup rather than one pitcher hand.
  const isPitcherProp = gameLogState.isPitcher;
  if (els.gamelogHandField) els.gamelogHandField.hidden = isPitcherProp;
  renderGameLogSubfilters();
  loadGameLogStat(p.betType, { initialProp: p });
  renderLineMovement(p);
}

let postedLinesToken = 0;
let gamelogPostedLinesContext = { stat: null, player: null };
function gamelogLineTier(row) {
  return row.odds_type === 'goblin' ? 'GOBLIN' : row.odds_type === 'demon' ? 'DEMON' : row.odds_type === 'standard' ? 'STANDARD' : 'ALT';
}
async function loadGameLogPostedLines(stat, player = gameLogState.player) {
  const token = ++postedLinesToken;
  const requestToken = gameLogState.fetchToken;
  const current = () => token === postedLinesToken && requestToken === gameLogState.fetchToken && stat === gameLogState.stat && player === gameLogState.player;
  gamelogPostedLinesContext = { stat, player };
  els.gamelogLinesBridge?.setLines([]);
  els.gamelogLinesBridge?.setValue('');
  els.gamelogLinesBridge?.setStatus('loading');
  try {
    const feed = await requestFinderFeed();
    if (!current()) return;
    const rows = feed.filter(row => nameKey(row.player) === nameKey(player) && pitcherFinderStat(row.stat).label === stat && Number.isFinite(Number(row.line))).sort((a,b) => a.line-b.line);
    if (!rows.length) { els.gamelogLinesBridge?.setStatus('empty'); return; }
    const baseline = rows.find(row => (row.odds_type || 'standard') === 'standard') || rows[0];
    // A quote arriving late must not undo a step, drag, or saved custom line.
    if (!gameLogState.lineEdited && Number(baseline.line) !== gameLogState.line) setGameLogPreviewLine(Number(baseline.line), true, false);
    const currentRow = rows.find(row => Number(row.line) === Number(gameLogState.line));
    const unique = [...new Map(rows.map(row => [Number(row.line), row])).values()];
    els.gamelogLinesBridge?.setLines(unique.map(row => ({ value: row.line, tier: gamelogLineTier(row) })));
    els.gamelogLinesBridge?.setValue(currentRow ? String(gameLogState.line) : '');
    els.gamelogLinesBridge?.setStatus('ready');
  } catch (_) { if (current()) els.gamelogLinesBridge?.setStatus('error'); }
}

// Real per-line sportsbook odds, shown as a row of odds pills.
// Keyed by the Odds API's own bookmaker key -- these mirror QUOTE_BOOKS in
// v2/board/odds_client.py, so anything quoted server-side can render here.
//
// Which books actually return a price depends on the market, not on us:
// traditional sportsbooks carry the single-stat markets, while combo
// markets (Hits+Runs+RBIs) are quoted almost exclusively by the DFS
// pick'em and exchange books. Restricting this list to the books we happen
// to hold a logo for meant FanDuel, BetMGM, ESPN Bet and Underdog were
// never shown at all -- so books with no logo asset now fall back to their
// name as a text chip rather than being dropped. A real logo is still
// preferred wherever we have one; nothing here is an invented mark.
//
// PrizePicks stays out of this row on purpose: it's a DFS pick'em product
// with one price per line, not genuine two-sided odds, so it has no real
// Under number to show.
const GAMELOG_ODDS_BOOKS = [
  { key: "draftkings", name: "DraftKings", logo: "/sportsbooks/draftkings.png" },
  { key: "fanduel", name: "FanDuel", logo: "/sportsbooks/fanduel.png" },
  { key: "betmgm", name: "BetMGM", logo: "/sportsbooks/betmgm.png" },
  { key: "espnbet", name: "ESPN Bet", logo: "/sportsbooks/espnbet.png" },
  { key: "underdog", name: "Underdog", logo: "/sportsbooks/underdog.png" },
  { key: "underdogfantasy", name: "Underdog", logo: "/sportsbooks/underdog.png" },
  { key: "draftkings_pick6", name: "DK Pick6", logo: "/sportsbooks/dkpick6.png" },
  { key: "betrivers", name: "BetRivers", logo: "/sportsbooks/betrivers.png" },
  { key: "williamhill_us", name: "Caesars", logo: "/sportsbooks/caesars.png" },
  { key: "fanatics", name: "Fanatics", logo: "/sportsbooks/fanatics.png" },
  { key: "hardrockbet", name: "Hard Rock Bet", logo: "/sportsbooks/hardrockbet.png" },
  { key: "fliff", name: "Fliff", logo: "/sportsbooks/fliff.png" },
  { key: "novig", name: "Novig", logo: "/sportsbooks/novig.png" },
  { key: "prophetx", name: "ProphetX", logo: "/sportsbooks/prophetx.png" },
];
let gamelogBookOddsToken = 0;
let gamelogBookOddsRows = [];
async function loadGameLogBookOdds(stat, player = gameLogState.player) {
  const token = ++gamelogBookOddsToken;
  const requestToken = gameLogState.fetchToken;
  const current = () => token === gamelogBookOddsToken && requestToken === gameLogState.fetchToken && stat === gameLogState.stat && player === gameLogState.player;
  const opponent = gameLogState.opponent || '';
  const key = trendContextKey({ player, stat, opponent });
  gamelogBookOddsRows = gameLogOddsCache.peek(key) || [];
  renderGameLogBookOdds();
  try {
    const url = `${API_SOURCE}?action=prizepicks-lines&player=${encodeURIComponent(player)}&stat=${encodeURIComponent(stat)}&opponent=${encodeURIComponent(opponent)}`;
    const rows = await gameLogOddsCache.request(key, async () => {
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Odds unavailable');
      return data.bookLines?.length ? data.bookLines : (data.lines || []);
    });
    if (!current()) return;
    gamelogBookOddsRows = rows;
  } catch (_) {
    if (!current()) return;
    gamelogBookOddsRows = [];
  }
  renderGameLogBookOdds();
}
// Re-renders from the already-fetched ladder for whatever gameLogState.line
// currently is -- no new fetch needed on every line change (+/-, alt-lines
// picker), same "fetch once per stat, redraw per line" pattern the alt-lines
// Select already uses.
function renderGameLogBookOdds() {
  const row = gamelogBookOddsRows.find((r) => Number(r.line) === Number(gameLogState.line));
  const quotes = [];
  const shown = new Set();
  for (const book of GAMELOG_ODDS_BOOKS) {
    const quote = row?.books?.[book.key];
    const over = quote?.over ?? null;
    const under = quote?.under ?? null;
    if (over == null && under == null) continue;
    // Underdog is reachable under two different bookmaker keys; whichever
    // one the feed uses, only show the book once.
    if (shown.has(book.name)) continue;
    shown.add(book.name);
    quotes.push({ key: book.key, name: book.name, logo: book.logo, over, under });
  }
  // The Finder's player banner shows these same quotes in its own odds row
  // (and hides this one), so it follows every line change the chart makes.
  // (Guarded: tests run this function outside a browser.)
  if (typeof window !== "undefined" && typeof CustomEvent === "function") {
    window.dispatchEvent(new CustomEvent("vortex:trend-odds", {
      detail: { player: gameLogState.player, stat: gameLogState.stat, line: gameLogState.line, books: quotes },
    }));
  }
  if (!els.gamelogOddsRow) return;
  const fmtOdds = (value) => value == null ? "—" : americanOdds(value);
  els.gamelogOddsRow.innerHTML = quotes.map((book) => {
    const mark = book.logo
      ? `<img src="${book.logo}" alt="${escapeHtml(book.name)}" />`
      : `<span class="gamelog-odds-name">${escapeHtml(book.name)}</span>`;
    return `<div class="gamelog-odds-pill" title="${escapeHtml(book.name)}">
      ${mark}
      <div class="gamelog-odds-values">
        <span><b>O</b>${escapeHtml(fmtOdds(book.over))}</span>
        <span><b>U</b>${escapeHtml(fmtOdds(book.under))}</span>
      </div>
    </div>`;
  }).join("");
}


// Filters a host sport can switch on for its chart (config.filters): each
// matches a field on the chart's games. Soccer uses all three, basketball
// Team (the teams he played for, his latest first).
const GL_EXTRA_FILTERS = [["opponent", "Opponent"], ["league", "League"], ["team", "Team"]];
function extraFilterValues(field) {
  const values = recentGameLogSource().map((game) => game[field]).filter(Boolean).map(String);
  return field === "team" ? [...new Set(values.reverse())] : [...new Set(values)].sort();
}
function extraFilterOn(field) {
  return trendAdapter === EXTERNAL_TREND_ADAPTER && Boolean(externalTrendConfig?.filters?.includes(field));
}
// Season part (config.filters "seasonKind"): every game by default (or the
// page's config.seasonKind), every game but the preseason, or only
// preseason, regular season or postseason games.
const GL_KIND_PAIRS = [["all", "All"], ["games", "Regular + Playoffs"], ["preseason", "Preseason"], ["regular", "Regular Season"], ["postseason", "Postseason"]];
const seasonKindOn = () => extraFilterOn("seasonKind");

function filterGames(games) {
  return games.filter((g) => {
    if (gameLogState.season !== "all" && String(g.season || String(g.fullDate || "").slice(0, 4)) !== gameLogState.season) return false;
    const kind = seasonKindOn() ? gameLogState.seasonKind : "all";
    if (kind === "games" ? g.seasonKind === "preseason" : kind && kind !== "all" && g.seasonKind !== kind) return false;
    for (const [field] of GL_EXTRA_FILTERS) {
      const wanted = gameLogState.extraFilters?.[field];
      if (wanted && wanted !== "all" && String(g[field] || "") !== wanted) return false;
    }
    if (gameLogState.handFilter !== "all" && g.oppHand !== gameLogState.handFilter) return false;
    if (gameLogState.venueFilter === "home" && g.isHome !== true) return false;
    if (gameLogState.venueFilter === "road" && g.isHome !== false) return false;
    return true;
  });
}

// components/ui/select.tsx's SelectTrigger resolves its display text with
// labelMap.current.get(value) DURING render, but SelectItem only registers
// each value->label pair in a post-commit useEffect, and labelMap is a ref
// so filling it in later never re-renders the trigger. Any filter the user
// never touches therefore stays stuck rendering the trigger's raw-value
// fallback ("all" instead of "All"). Deferring the value by a frame was
// not a real fix -- requestAnimationFrame doesn't run at all in a
// backgrounded tab, so it could simply never apply. Instead these selects
// use the label AS the value, which makes that raw-value fallback already
// correct no matter when it renders; the pick handlers translate back to
// the internal key that gameLogState/filterGames() expect.
const GL_HAND_PAIRS = [["all", "All"], ["L", "vs LHP"], ["R", "vs RHP"]];
const GL_VENUE_PAIRS = [["all", "All"], ["home", "Home"], ["road", "Road"]];
const seasonLabel = (key) => (key === "all" ? "All" : String(key));
const seasonKey = (label) => (label === "All" ? "all" : String(label));
const pairOptions = (pairs) => pairs.map(([, label]) => ({ value: label, label }));
const labelForKey = (pairs, key) => (pairs.find(([k]) => k === key) || pairs[0])[1];
const keyForLabel = (pairs, label) => (pairs.find(([, l]) => l === label) || pairs[0])[0];
function renderGameLogSubfilters() {
  els.glHandFilterBridge?.setOptions(pairOptions(GL_HAND_PAIRS));
  els.glHandFilterBridge?.setValue(labelForKey(GL_HAND_PAIRS, gameLogState.handFilter));
  els.glVenueFilterBridge?.setOptions(pairOptions(GL_VENUE_PAIRS));
  els.glVenueFilterBridge?.setValue(labelForKey(GL_VENUE_PAIRS, gameLogState.venueFilter));
  const kinds = seasonKindOn();
  if (els.glKindField) els.glKindField.hidden = !kinds;
  // Two "Season" menus would read the same; the year one becomes "Year".
  if (els.glYearLabel) els.glYearLabel.textContent = kinds ? "Year" : "Season";
  if (kinds) {
    els.glKindBridge?.setOptions(pairOptions(GL_KIND_PAIRS));
    els.glKindBridge?.setValue(labelForKey(GL_KIND_PAIRS, gameLogState.seasonKind || "all"));
  }
  for (const [field] of GL_EXTRA_FILTERS) {
    const values = extraFilterOn(field) ? extraFilterValues(field) : [];
    const current = gameLogState.extraFilters?.[field] || "all";
    // Only worth showing with a choice to make (or one already made); a
    // player's team shows even when he's had one, so it's always there.
    const shown = values.length > (field === "team" ? 0 : 1) || current !== "all";
    const fieldEl = els.glExtraFields?.[field];
    if (fieldEl) fieldEl.hidden = !shown;
    if (!shown) continue;
    // Teams carry their logos (Oct 30): a game's own when it has one (soccer).
    const logoOf = (value) => {
      if (field !== "team" && field !== "opponent") return null;
      const game = recentGameLogSource().find((item) => String(item[field] || "") === value) || {};
      return field === "team" ? game.teamLogo || trendTeamLogo(value) : trendTeamLogo(value, game);
    };
    els.glExtraBridges?.[field]?.setOptions(["All", ...values].map((value) => ({ value, label: value, logo: value === "All" ? null : logoOf(value) })));
    els.glExtraBridges?.[field]?.setValue(current === "all" ? "All" : current);
  }
}

// Hit rate + average for one window's worth of games, for the window-tabs
// bar below -- games are already regraded (.over set) by regradeGameLog()
// before this runs.
let trendTilesKey = "";
// The longer windows' figures, for the last tile's menu.
let gameLogMoreWindows = [];
function renderGameLogWindowMenu() {
  const menu = document.getElementById("gamelog-window-menu");
  if (!menu) return;
  // A small menu under its tile, one short row a window (Oct 30: the card
  // it was took the whole phone screen).
  menu.innerHTML = gameLogMoreWindows.map((w) => {
    const active = w.key === gameLogState.windowKey;
    return `<button type="button" role="menuitemradio" aria-checked="${active}" class="${active ? "active" : ""}" data-window="${w.key}" data-tone="${rateTone(w.hitRate)}"><b>${escapeHtml(w.short || w.label)}</b><span>${w.hitRate == null ? "—" : `${w.hitRate}%`}</span><small>${w.avg == null ? "" : `Avg ${trendNumber(Math.round(w.avg * 10) / 10)}`}</small></button>`;
  }).join("");
}
// Under the tile that opened it, kept on screen. Measured from where the menu
// lands at 0,0, so it works whatever box it's positioned in.
function placeGameLogWindowMenu(menu, tile) {
  if (!menu || !tile) return;
  menu.style.top = "0px";
  menu.style.left = "0px";
  const origin = menu.getBoundingClientRect(), at = tile.getBoundingClientRect();
  const room = document.documentElement.clientWidth;
  const left = Math.min(Math.max(8, at.left + at.width / 2 - origin.width / 2), room - origin.width - 8);
  menu.style.left = `${Math.round(left - origin.left)}px`;
  menu.style.top = `${Math.round(at.bottom + 6 - origin.top)}px`;
}
function windowStat(games) {
  if (!games.length) return { hitRate: null, avg: null, hits: 0, games: 0 };
  const hits = games.filter((g) => g.over).length;
  const avg = games.reduce((sum, g) => sum + (Number(g.value) || 0), 0) / games.length;
  return { hitRate: Math.round((hits / games.length) * 100), avg, hits, games: games.length };
}
// A hit rate's tone on the tiles: strong, middling, poor.
const rateTone = (rate) => rate == null ? "none" : rate >= 50 ? "up" : "down";
// The Finder's cut-offs for its hit-rate boxes (UnifiedFinder.jsx tone), so a
// window reads the same color on the trends page as on the board.
const heatTone = (rate) => rate == null ? "none" : rate >= 70 ? "good" : rate >= 45 ? "mid" : "low";
// The season the latest games are from, and how many of the filtered games are in it.
function latestSeason(games) {
  const seasonOf = (game) => String(game.season || String(game.fullDate || "").slice(0, 4));
  const last = games.length ? seasonOf(games[games.length - 1]) : "";
  if (!/^\d{4}$/.test(last)) return { label: "", count: 0 };
  let count = 0;
  for (let i = games.length - 1; i >= 0 && seasonOf(games[i]) === last; i -= 1) count += 1;
  return { label: last, count };
}
// The windows behind the last tile's menu.
const MORE_WINDOWS = ["15", "20", "30", "season"];

function renderGameLogTabs() {
  const filtered = filterGames(recentGameLogSource());
  const max = filtered.length;
  // Keep the requested window as filters/data change. Clamping the stored
  // count to a partial response left L10 showing only 1–5 games after load.
  const year = latestSeason(filtered);
  if (gameLogState.window !== "h2h") {
    const requested = gameLogState.windowKey === "season" ? max : gameLogState.windowKey === "year" ? year.count : Number(gameLogState.windowKey);
    gameLogState.gameCount = Math.max(1, requested || gameLogState.gameCount);
  }
  const h2hGames = filterGames(gameLogState.chart?.h2h || []);

  // One row that both selects the sample size AND shows that window's hit
  // rate/average at a glance (matches a reference trend screen the user
  // pointed to), instead of a plain +/- stepper with no numbers.
  // Every window is always offered. These used to be dropped whenever the
  // filtered sample was smaller than the window (L10/L15/L20 vanished the
  // moment a Season/Matchup/Location filter narrowed things below 10), which
  // made the row reflow and look like data had been lost. A window that asks
  // for more games than the filters matched simply covers all of them --
  // "last 10 games matching these filters" really is those 6 games -- so the
  // figure stays correct; it's flagged as capped so identical-looking rows
  // are explained rather than confusing.
  // The last 5 and 10, a longer window whose menu offers 15, 20, 30 or
  // every game, then head-to-head and this season (the owner's order, Oct 30).
  const longer = (key) => key === "season" ? { key, label: `All (${max})`, short: "All", sample: max, ...windowStat(filtered) }
    : { key, label: `L${key}`, short: `L${key}`, capped: max > 0 && max < Number(key), sample: Math.min(Number(key), max), ...windowStat(filtered.slice(-Number(key))) };
  const more = MORE_WINDOWS.includes(gameLogState.windowKey) ? gameLogState.windowKey : "20";
  const windows = [
    ...["5", "10"].map((key) => longer(key)),
    { ...longer(more), label: longer(more).short, menu: true },
    { key: "h2h", label: "H2H", sample: h2hGames.length, empty: !h2hGames.length, ...windowStat(h2hGames) },
    { key: "year", label: year.label || "Season", sample: year.count, empty: !year.count, ...windowStat(year.count ? filtered.slice(-year.count) : []) },
  ];
  gameLogMoreWindows = MORE_WINDOWS.map(longer);
  if (els.gamelogTabs) {
    // The tiles rise in for a new player or stat, not on every redraw.
    const tilesKey = `${gameLogState.player}|${gameLogState.stat}`;
    els.gamelogTabs.classList.toggle("gl-rise", tilesKey !== trendTilesKey);
    trendTilesKey = tilesKey;
    els.gamelogTabs.innerHTML = windows.map((w, index) => {
      const active = w.key === gameLogState.windowKey;
      // Each window's record over its games and the hit rate, toned.
      const stat = w.hitRate == null ? '<span class="gl-window-rec">0/0</span><span class="gl-window-pct">-</span>'
        : `<span class="gl-window-rec">${w.hits}/${w.games}</span><span class="gl-window-pct">${w.hitRate}%</span>`;
      const titleText = w.key === 'h2h' && gameLogState.chart?.meta?.h2hLabel ? gameLogState.chart.meta.h2hLabel
        : w.capped ? `Only ${w.sample} game${w.sample === 1 ? "" : "s"} match the current filters` : '';
      const title = titleText ? ` title="${escapeHtml(titleText)}"` : '';
      const menu = w.menu ? ' data-window-menu="true" aria-haspopup="menu"' : "";
      const chevron = w.menu ? '<svg class="gl-window-chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg>' : "";
      return `<button type="button" class="${active ? "active" : ""}" aria-pressed="${active}"${w.capped ? ' data-capped="true"' : ""}${w.empty ? " disabled" : ""}${title}${menu} data-window="${w.key}" data-tone="${rateTone(w.hitRate)}" data-heat="${heatTone(w.hitRate)}" style="--i:${index}"><strong>${w.label}${chevron}</strong>${stat}</button>`;
    }).join("");
  }

  const seasons = [...new Set(recentGameLogSource().map((game) => String(game.season || String(game.fullDate || "").slice(0, 4))).filter((season) => /^\d{4}$/.test(season)))].sort().concat("all");
  if (!document.getElementById("gamelog-window-menu")?.hidden) renderGameLogWindowMenu();
  els.gamelogSeasonBridge?.setOptions(seasons.map((season) => ({ value: seasonLabel(season), label: seasonLabel(season) })));
  els.gamelogSeasonBridge?.setValue(seasonLabel(gameLogState.season));
  renderGameLogSubfilters();
}

let gameLogLayoutFrame = 0;
let gameLogLayoutSignature = "";
function stabilizeGameLogLayout() {
  cancelAnimationFrame(gameLogLayoutFrame);
  gameLogLayoutFrame = requestAnimationFrame(() => {
    gameLogLayoutFrame = requestAnimationFrame(() => {
      if (els.gamelogOverlay?.hidden || !els.gamelogChart || gameLogState.dragging) return;
      const rect = els.gamelogChart.getBoundingClientRect();
      const signature = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      if (!rect.width || !rect.height || signature === gameLogLayoutSignature) return;
      gameLogLayoutSignature = signature;
      renderGameLogChart();
    });
  });
}

function formatGameLogDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Date-only ISO strings ("2026-09-11") parse as UTC midnight -- reading
  // them back with local getters rolls the date back a day for anyone west
  // of UTC. Use the UTC getters since there's no time component to localize.
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// A team's logo for the chart's opponent row: the game's own when the host
// gave one (soccer), else the league's logo for its code (MLB by team id,
// ESPN's for the NFL, NBA, WNBA and NHL). Null when there's no telling.
const TREND_LOGO_LEAGUES = { nfl: "nfl", nba: "nba", wnba: "wnba", nhl: "nhl" };
function trendTeamLogo(abbr, game = {}) {
  if (game.opponentLogo) return game.opponentLogo;
  const code = String(abbr || "").toUpperCase();
  if (!code) return null;
  const sport = String(externalTrendConfig?.sport || "MLB").toLowerCase();
  if (sport === "mlb") {
    const id = game.opponentTeamId || MLB_TEAM_IDS[code];
    return id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : null;
  }
  const league = TREND_LOGO_LEAGUES[sport];
  return league ? `https://a.espncdn.com/i/teamlogos/${league}/500/${code.toLowerCase()}.png` : null;
}
// "Dec 28" as two lines under a bar (dates are UTC days, see formatGameLogDate).
function trendDateParts(iso) {
  const d = new Date(iso || "");
  if (Number.isNaN(d.getTime())) return null;
  // A start time (an NBA game's, the next game's) reads as the day it was
  // played where the viewer is, like the game card: in UTC a 7:30 pm
  // Eastern tip is already the next day. A bare date is that date.
  const zone = /T\d{2}:\d{2}/.test(String(iso)) ? undefined : "UTC";
  return [d.toLocaleString("en-US", { month: "short", timeZone: zone }), d.toLocaleString("en-US", { day: "numeric", timeZone: zone })];
}
function trendMedian(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const trendNumber = (value) => Number.isInteger(value) ? String(value) : Number(value).toFixed(1);
// The bars grow in only when the games change (a new player, stat or
// window), not every time the line moves over the same games.
let trendBarsSignature = "";

function trendLogoMarkup(abbr, game) {
  const url = trendTeamLogo(abbr, game);
  const text = escapeHtml(String(abbr || "").slice(0, 3));
  return `<span class="gl-logo${url ? "" : " is-text"}">${url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('is-text');this.remove()">` : ""}<b>${text}</b></span>`;
}
function trendDateMarkup(iso, fallback) {
  const parts = trendDateParts(iso);
  return parts ? `<span class="gl-date"><i>${parts[0]}</i>${parts[1]}</span>` : `<span class="gl-date">${escapeHtml(fallback || "")}</span>`;
}

// A basketball game's card on the trend chart: tap or click a bar (hover
// shows it on a computer) for his line that game, the result, his usage
// rate and who sat out (src/sports/wnba/trend-data.js gameDetails). One
// card floats over the page, beside its bar, so the chart never clips it.
let gameCard = null;
let gameCardPinned = null;
function closeGameCard() {
  if (gameCard) gameCard.hidden = true;
  gameCardPinned = null;
}
// His first quarter or first half, on a 1Q/1H line's game card.
function periodStrip(period) {
  if (!period) return "";
  const parts = [["pts", "PTS"], ["reb", "REB"], ["ast", "AST"], ["tpm", "3PM"]]
    .filter(([key]) => Number.isFinite(period[key])).map(([key, label]) => `<i><b>${period[key]}</b> ${label}</i>`);
  return parts.length ? `<div class="gp-period"><span>${escapeHtml(period.label)}</span>${parts.join("")}</div>` : "";
}
function gameCardMarkup(g) {
  const d = g.details || {};
  const num = (value) => (Number.isFinite(Number(value)) && value !== null && value !== "" ? Number(value) : null);
  const show = (value) => (num(value) == null ? "–" : String(num(value)));
  const pair = (made, tried) => (num(made) == null || num(tried) == null ? ["–", ""] : [`${num(made)}/${num(tried)}`, num(tried) ? `${Math.round((num(made) / num(tried)) * 100)}%` : ""]);
  const focus = new Set(d.focus || []);
  const tile = (key, label, value, sub = "") => `<div class="gp-tile${focus.has(key) ? " is-focus" : ""}"><span>${label}</span><b>${escapeHtml(value)}</b>${sub ? `<small>${escapeHtml(sub)}</small>` : ""}</div>`;
  const rebounds = num(d.oreb) != null && num(d.dreb) != null ? `${num(d.oreb)} OR · ${num(d.dreb)} DR` : "";
  const [fg, fgPct] = pair(d.fgm, d.fga), [tp, tpPct] = pair(d.tpm, d.tpa), [ft, ftPct] = pair(d.ftm, d.fta);
  const date = new Date(g.fullDate || "");
  const day = Number.isNaN(date.getTime()) ? (g.dateLabel || "") : date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const result = d.result ? `<em class="gp-result" data-result="${escapeHtml(String(d.result).toUpperCase().slice(0, 1))}">${escapeHtml(String(d.result).toUpperCase().slice(0, 1))} ${escapeHtml(String(d.score || "").replace("-", "–"))}</em>` : "";
  const role = d.started === true ? "Started" : d.started === false ? "Bench" : "";
  const shortName = (name) => { const parts = String(name || "").split(/\s+/).filter(Boolean); return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : parts[0] || ""; };
  const out = (d.out || []).slice(0, 3);
  return `
    <header>
      ${d.logo ? `<img src="${escapeHtml(d.logo)}" alt="" width="22" height="22" onerror="this.hidden=true">` : ""}
      <div><strong>${g.isHome === false ? "@" : "vs"} ${escapeHtml(g.opponent || "")}</strong><small>${escapeHtml(day)}${role ? ` · ${role}` : ""}</small></div>
      ${result}
    </header>
    <div class="gp-grid">
      ${tile("min", "MIN", show(d.min))}${tile("usg", "USG", num(d.usage) == null ? "–" : `${Math.round(num(d.usage) * 10) / 10}%`)}${tile("pts", "PTS", show(d.pts))}${tile("reb", "REB", show(d.reb), rebounds)}
      ${tile("ast", "AST", show(d.ast))}${tile("to", "TO", show(d.to))}${tile("stl", "STL", show(d.stl))}${tile("blk", "BLK", show(d.blk))}
      ${tile("fg", "FG", fg, fgPct)}${tile("tp", "3PT", tp, tpPct)}${tile("ft", "FT", ft, ftPct)}${tile("pf", "PF", show(d.pf))}
    </div>
    ${periodStrip(d.period)}
    ${out.length ? `<footer><span>Sat out</span>${out.map((person) => `<i title="${escapeHtml(person.name)} · ${escapeHtml(String(person.ppg))} points a game">${escapeHtml(shortName(person.name))} <b>${escapeHtml(String(person.ppg))}</b></i>`).join("")}</footer>` : ""}`;
}
function openGameCard(shell, g, pin) {
  if (!gameCard) {
    gameCard = document.createElement("div");
    gameCard.className = "gl-game-pop";
    gameCard.setAttribute("role", "dialog");
    gameCard.hidden = true;
    document.body.appendChild(gameCard);
    document.addEventListener("click", (event) => {
      if (!gameCard.hidden && !gameCard.contains(event.target) && !event.target.closest?.(".gl-bar-shell")) closeGameCard();
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeGameCard(); });
    window.addEventListener("resize", closeGameCard);
    window.addEventListener("scroll", () => { if (!gameCardPinned) closeGameCard(); }, { passive: true, capture: true });
  }
  gameCard.innerHTML = gameCardMarkup(g);
  gameCard.setAttribute("aria-label", `${g.fullDate || ""} game details`);
  gameCard.hidden = false;
  gameCardPinned = pin ? shell : null;
  const bar = (shell.querySelector(".gl-bar") || shell).getBoundingClientRect();
  const width = gameCard.offsetWidth, height = gameCard.offsetHeight;
  const viewWidth = document.documentElement.clientWidth || window.innerWidth, viewHeight = window.innerHeight;
  // Beside the bar (right, else left); on a phone, above it, centred and kept on screen.
  let left = bar.right + 10;
  let top = bar.top + bar.height / 2 - height / 2;
  if (viewWidth < 600) {
    left = bar.left + bar.width / 2 - width / 2;
    top = bar.top - height - 10;
    if (top < 8) top = bar.bottom + 10;
  } else if (left + width > viewWidth - 8) left = bar.left - width - 10;
  gameCard.style.left = `${Math.round(Math.min(Math.max(8, left), viewWidth - width - 8))}px`;
  gameCard.style.top = `${Math.round(Math.min(Math.max(8, top), viewHeight - height - 8))}px`;
}
function wireGameCard(shell, g) {
  const fine = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  shell.addEventListener("mouseenter", () => { if (fine() && !gameCardPinned) openGameCard(shell, g, false); });
  shell.addEventListener("mouseleave", () => { if (fine() && !gameCardPinned) closeGameCard(); });
  shell.addEventListener("click", () => {
    if (gameCardPinned === shell) closeGameCard();
    else openGameCard(shell, g, true);
  });
  shell.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (gameCardPinned === shell) closeGameCard();
    else openGameCard(shell, g, true);
  });
}

function renderGameLogChart() {
  // Background data may refresh during a pointer gesture. Keep the captured
  // marker mounted until the gesture ends, then paint the latest results.
  if (gameLogState.dragging) return;
  const pool = gameLogPool();
  const games = gameLogState.window === "h2h" ? pool : pool.slice(-gameLogState.gameCount);
  const holder = els.gamelogChart;
  // Where the line and each bar's darker part sat before this paint: when
  // only the line changed, they glide from there to the new line.
  const previousCuts = [...holder.querySelectorAll(".gl-bar")].map((bar) => bar.style.getPropertyValue("--cut"));
  const previousOffset = holder.querySelector(".gl-line-marker")?.style.getPropertyValue("--line-offset") || "";
  holder.classList.toggle('is-loading', gameLogState.loading && !recentGameLogSource().length);
  holder.setAttribute('aria-busy', String(gameLogState.loading));
  holder.dataset.window = gameLogState.window;
  holder.dataset.change = gameLogState.animationDirection;
  holder.innerHTML = "";
  holder.scrollLeft = 0;
  closeGameCard();

  const filterBits = [];
  if (gameLogState.handFilter !== "all") filterBits.push(`vs ${gameLogState.handFilter}HP`);
  if (gameLogState.venueFilter !== "all") filterBits.push(gameLogState.venueFilter === "home" ? "at home" : "on the road");
  if (gameLogState.season !== "all") filterBits.push(gameLogState.season);
  if (seasonKindOn() && gameLogState.seasonKind && gameLogState.seasonKind !== "all") filterBits.push(labelForKey(GL_KIND_PAIRS, gameLogState.seasonKind));
  for (const [field] of GL_EXTRA_FILTERS) {
    const wanted = gameLogState.extraFilters?.[field];
    if (wanted && wanted !== "all") filterBits.push(field === "opponent" ? `vs ${wanted}` : wanted);
  }
  const filterSuffix = filterBits.length ? ` (${filterBits.join(", ")})` : "";

  if (!games.length) {
    const rawLen = pool.length;
    els.gamelogSub.textContent = rawLen
      ? `No games in this window${filterSuffix}.`
      : "No games available for this window.";
    document.getElementById("gamelog-summary-rate").textContent = "—";
    document.getElementById("gamelog-summary-rate-percent").textContent = "—";
    document.getElementById("gamelog-summary-record").textContent = "—";
    document.getElementById("gamelog-summary-average").textContent = "—";
    document.getElementById("gamelog-summary-median").textContent = "—";
    trendBarsSignature = "";
    if (gameLogState.loading) {
      holder.innerHTML = `<div class="gl-loading"><div class="gl-loading-bars" aria-hidden="true">${'<span></span>'.repeat(10)}</div><div role="status" aria-live="polite"><strong>Loading ${escapeHtml(gameLogState.stat)}…</strong><p>You can keep switching stats or adjust the line.</p></div></div>`;
    } else if (gameLogState.error) {
      holder.innerHTML = `<div class="gl-error" role="status"><strong>${escapeHtml(gameLogState.error)}</strong><button type="button" data-trend-retry>Try again</button></div>`;
      holder.querySelector('[data-trend-retry]').addEventListener('click', () => loadGameLogStat(gameLogState.stat));
    } else {
      holder.innerHTML = '<div class="gl-empty" role="status"><strong>No matching games</strong><p>Try another season, matchup, or location.</p></div>';
    }
    return;
  }

  const overCount = games.filter((g) => g.over).length;
  const hitRate = Math.round((overCount / games.length) * 100);
  const average = games.reduce((sum, game) => sum + Number(game.value || 0), 0) / games.length;
  // The chart already communicates the active window and line through its
  // controls; don't duplicate it as a stray right-aligned caption.
  els.gamelogSub.textContent = "";
  document.getElementById("gamelog-summary-rate").textContent = `${overCount}/${games.length}`;
  document.getElementById("gamelog-summary-rate-percent").textContent = `${hitRate}% hit rate`;
  document.getElementById("gamelog-summary-record").textContent = `${overCount}–${games.length - overCount}`;
  document.getElementById("gamelog-summary-average").textContent = trendNumber(Math.round(average * 10) / 10);
  const median = trendMedian(games.map((game) => Number(game.value)));
  document.getElementById("gamelog-summary-median").textContent = median == null ? "—" : trendNumber(median);
  syncTrendChipLine();
  const barsSignature = JSON.stringify([gameLogState.player, gameLogState.stat, games.map((game) => [game.fullDate || game.date, game.value])]);
  const sameBars = barsSignature === trendBarsSignature;
  holder.classList.toggle("gl-grow", !sameBars);
  trendBarsSignature = barsSignature;

  // Scale to the visible sample with a small market-specific floor. The old
  // fixed caps (for example 10 for H+R+RBI) left most of a short chart empty
  // when the visible values only reached 2 or 3.
  const line = gameLogState.line;
  // Match the responsive CSS track height exactly; using a shorter mobile
  // math scale made low lines such as 0.5 float far above the baseline.
  const trackPx = parseFloat(getComputedStyle(holder).getPropertyValue('--gl-track-height')) || 280;
  holder.style.setProperty('--plot-height', `${trackPx}px`);
  const scaleFloors = { "Hits": 3, "Home Runs": 2, "Total Bases": 6, "Hits+Runs+RBIs": 4, "Runs Scored": 2, "RBIs": 3, "Walks": 2, "Strikeouts": 8, "Pitching Outs": 24, "Hits Allowed": 7, "Earned Runs Allowed": 5, "Strikeouts (Pitcher)": 8, "Walks Allowed": 3 };
  // Scale only to the displayed results. Editing the threshold must never
  // resize historical bars or compress them toward the baseline.
  // A game's context number (shots faced behind saves) shares the scale.
  const observedMax = Math.max(...games.map((game) => Math.max(Number(game.value) || 0, Number.isFinite(game.context) ? game.context : 0)), 1);
  const max = Math.max(
    scaleFloors[gameLogState.stat] || 2,
    Math.ceil(observedMax * 1.2),
  );
  const track = document.createElement("div");
  track.className = "gamelog-chart-track";
  // One more column on the end: the game coming up.
  track.style.setProperty("--game-count", String(games.length + 1));
  const mobileChart = window.matchMedia("(max-width: 680px)").matches;
  const mobileWidth = Math.max(12, Math.floor((Math.min(window.innerWidth || 390, 430) - 92) / Math.max(games.length + 1, 1)));
  track.style.setProperty("--bar-width", mobileChart ? `${mobileWidth}px` : games.length > 20 ? "30px" : games.length > 10 ? "38px" : "52px");
  track.dataset.count = String(games.length);
  track.dataset.dense = games.length > 20 ? "true" : "false";
  track.dataset.logo = games.length <= 12 ? "true" : "false";
  // Every window's games always fit on screen at once now (see
  // gamelog-inline.css's equal-fill .gl-col rule) instead of scrolling --
  // but that means a big season sample can shrink each column below the
  // width its date/opponent text needs. Estimate the column width from the
  // chart's real rendered width (not a fixed game-count cutoff, since the
  // same count reads very differently on a phone vs. a wide desktop chart)
  // and hide those labels once columns get too narrow for them.
  const chartWidth = holder.clientWidth || window.innerWidth || 360;
  track.dataset.compact = (chartWidth / Math.max(games.length, 1)) < 34 ? "true" : "false";
  // gamelog-inline.css's equal-fill columns (flex:1 1 0, min-width:0) can
  // shrink to fit any width -- but the gap BETWEEN them was a fixed 8px
  // regardless of count. For a true multi-year season sample (hundreds of
  // games) that fixed gap alone can add up to far more than the chart's
  // whole width (e.g. 300 games x 8px = 2400px), which forces the
  // shrinkable columns down toward 0 width even though nothing else is
  // wrong -- bars vanish while the dashed line/marker (positioned
  // independently) still renders fine. Scale the gap down as the count
  // grows so it can never consume more room than the bars themselves.
  const gapPx = games.length > 80 ? 1 : games.length > 40 ? 2 : games.length > 20 ? 4 : 8;
  track.style.setProperty("--gl-gap", `${gapPx}px`);
  // All can be two seasons -- hundreds of games. Below about 4px a game, the
  // columns round down to nothing on a phone and the chart looks empty, so
  // past that point each bar keeps a fixed width and the bars scroll
  // sideways instead, opening on the latest games. The line and axis stay put.
  const scrolling = chartWidth / Math.max(games.length, 1) < 4;
  track.dataset.scroll = scrolling ? "true" : "false";
  // Where the line crosses each bar: below it the bar is muted, above it
  // bright, so how far a game cleared it shows at a glance.
  const linePx = Number.isFinite(Number(line)) ? (Number(line) / max) * trackPx : 0;
  games.forEach((g, index) => {
    const col = document.createElement("div");
    col.className = "gl-col";
    col.style.setProperty("--i", String(index));
    const heightPx = Math.max(4, (g.value / max) * trackPx);
    const details = g.pitcherDetails || null;
    const opponentId = g.opponentTeamId || MLB_TEAM_IDS[String(g.opponent || "").toUpperCase()];
    const tooltipRows = details ? [
      ["Innings pitched", details.inningsPitched], ["Batters faced", details.battersFaced],
      ["Pitch count", details.pitchCount], ["Walks", details.walks], ["Strikeouts", details.strikeouts],
    ].filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("") : "";
    const fullDate = g.fullDate || g.date || "";
    // An optional context bar drawn behind the result -- the shots a keeper
    // faced behind his saves -- with its own number on top.
    const context = Number.isFinite(g.context) && g.context > Number(g.value) ? g.context : null;
    const contextPx = context == null ? 0 : Math.max(4, (context / max) * trackPx);
    const contextText = context == null ? "" : `, ${g.contextLabel || "of"} ${context}`;
    const aria = `${fullDate}, ${g.opponent || "opponent"}, ${gameLogStatCode(gameLogState.stat)} ${g.value}${contextText}, ${g.over ? "above" : "below"} the ${line} line`;
    col.innerHTML = `
      <div class="gl-track" style="height:${trackPx}px">
        <div class="gl-bar-shell${context == null ? "" : " has-context"}" tabindex="0" ${g.details?.kind === "hoops" ? `role="button" aria-haspopup="dialog" aria-label="${escapeHtml(aria)}. Show the game"` : `role="img" aria-label="${escapeHtml(aria)}" title="${escapeHtml(aria)}"`}>
          ${context == null ? "" : `<div class="gl-bar-context${contextPx - heightPx < 44 ? " is-tight" : ""}" style="height:${contextPx}px" aria-hidden="true"><span>${context}</span></div>`}
          <div class="gl-bar${g.over ? "" : " gl-bar-under"}" style="height:${heightPx}px;--cut:${Math.max(0, Math.min(heightPx, linePx))}px">
            <span class="gl-val">${g.value}</span>
          </div>
          ${details ? `<div class="gl-detail-card" role="tooltip"><header><strong>${escapeHtml(fullDate)}</strong><span>${escapeHtml(g.opponent || "")}</span></header><div class="gl-detail-result">${g.over ? "Cleared" : "Under"} by ${Math.abs(Number(g.value) - Number(gameLogState.line)).toFixed(1)}</div>${tooltipRows}</div>` : ""}
        </div>
      </div>
      ${trendLogoMarkup(g.opponent, g)}
      ${trendDateMarkup(fullDate, g.dateLabel)}
      <span class="gl-opp">${escapeHtml(g.opponentLabel || MLB_TEAM_ABBRS[opponentId] || String(g.opponent || "").slice(0, 4))}</span>
    `;
    const shell = col.querySelector(".gl-bar-shell");
    if (shell && g.details?.kind === "hoops") wireGameCard(shell, g);
    shell?.addEventListener("click", () => {
      if (!window.matchMedia("(hover: none), (pointer: coarse)").matches || !details) return;
      const willOpen = !shell.classList.contains("detail-open");
      holder.querySelectorAll(".gl-bar-shell.detail-open").forEach((item) => item.classList.remove("detail-open"));
      shell.classList.toggle("detail-open", willOpen);
    });
    track.appendChild(col);
  });
  // The game coming up: an open bar, today's opponent and its day.
  const nextOpponent = externalTrendConfig?.opponent || activeFinderProp?.matchup?.opponent || gameLogState.opponent || "";
  const next = document.createElement("div");
  next.className = "gl-col gl-next";
  next.style.setProperty("--i", String(games.length));
  next.innerHTML = `
      <div class="gl-track" style="height:${trackPx}px"><div class="gl-next-bar" aria-hidden="true"><span>?</span></div></div>
      ${trendLogoMarkup(nextOpponent, {})}
      ${trendDateMarkup(externalTrendConfig?.startsAt || activeFinderProp?.startsAt || "", "Next")}
      <span class="gl-opp">${escapeHtml(String(nextOpponent).slice(0, 4) || "Next")}</span>`;
  next.setAttribute("aria-label", `Next game${nextOpponent ? ` vs ${nextOpponent}` : ""}`);
  track.appendChild(next);

  if (typeof line === "number" && line >= 0 && line <= max) {
    const topPx = Math.max(0, trackPx - (line / max) * trackPx);
    const marker = document.createElement("div");
    marker.className = "gl-line-marker";
    marker.style.top = "var(--chart-top, 34px)";
    marker.style.setProperty("--line-offset", `${topPx}px`);
    marker.innerHTML = `<span class="gl-line-tag">${Number(line).toFixed(1)}</span>`;
    marker.setAttribute("role", "slider");
    marker.tabIndex = 0;
    marker.setAttribute("aria-label", "Prop line");
    marker.setAttribute("aria-valuemin", "0.5");
    marker.setAttribute("aria-valuemax", String(max));
    marker.setAttribute("aria-valuenow", String(line));
    marker.setAttribute("aria-orientation", "vertical");
    marker.addEventListener("keydown", (event) => {
      const delta = event.key === "ArrowUp" || event.key === "ArrowRight" ? 1
        : event.key === "ArrowDown" || event.key === "ArrowLeft" ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      setGameLogPreviewLine(Math.max(0.5, Number(gameLogState.line) + delta), true);
      holder.querySelector('.gl-line-marker')?.focus({ preventScroll: true });
    });
    marker.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      gameLogState.dragging = true;
      gameLogState.lineEdited = true;
      marker.setPointerCapture(event.pointerId);
      const dragToken = gameLogState.fetchToken;
      const bounds = track.getBoundingClientRect();
      const bars = [...track.querySelectorAll(".gl-col:not(.gl-next) .gl-bar")];
      const under = /^(under|less)$/i.test(String(gameLogState.side || ""));
      holder.classList.add("is-dragging");
      const update = (ev, settle) => {
        if (dragToken !== gameLogState.fetchToken) return;
        const chartTop = bounds.top;
        const relative = Math.max(0, Math.min(trackPx, chartTop + trackPx - ev.clientY));
        const raw = Math.max(0.5, (relative / trackPx) * max);
        if (settle) {
          setGameLogPreviewLine(raw, true);
        } else {
          const displayLine = snapPropLine(raw);
          marker.style.setProperty("--line-offset", `${Math.max(0, trackPx - (raw / max) * trackPx)}px`);
          marker.querySelector(".gl-line-tag").textContent = displayLine.toFixed(1);
          // Each bar's darker part and its hit or miss follow the line as it moves.
          const linePx = (raw / max) * trackPx;
          bars.forEach((bar, index) => {
            const value = Number(games[index]?.value);
            bar.style.setProperty("--cut", `${Math.max(0, Math.min(parseFloat(bar.style.height) || 0, linePx))}px`);
            bar.classList.toggle("gl-bar-under", !(under ? value < displayLine : value > displayLine));
          });
        }
      };
      // One paint per frame: the line and every shadow move together from
      // the latest pointer position, however fast the finger goes.
      let pending = null, frame = 0;
      const stopFrame = () => { if (frame) cancelAnimationFrame(frame); frame = 0; pending = null; };
      marker.onpointermove = (ev) => {
        pending = ev;
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (pending) update(pending, false); pending = null; });
      };
      marker.onpointerup = (ev) => {
        stopFrame();
        marker.onpointermove = null;
        marker.onpointerup = null;
        gameLogState.dragging = false;
        holder.classList.remove("is-dragging");
        update(ev, true);
      };
      marker.onpointercancel = marker.onlostpointercapture = () => {
        stopFrame();
        if (!gameLogState.dragging) return;
        gameLogState.dragging = false;
        holder.classList.remove("is-dragging");
        renderGameLogChart();
      };
    });
    holder.appendChild(marker);
  }
  if (scrolling) {
    const scroller = document.createElement("div");
    scroller.className = "gl-scroller";
    scroller.appendChild(track);
    holder.appendChild(scroller);
    scroller.scrollLeft = scroller.scrollWidth;
  } else {
    holder.appendChild(track);
  }
  const axis = document.createElement("div");
  axis.className = "gl-y-axis";
  axis.setAttribute("aria-hidden", "true");
  axis.innerHTML = `<span>${Number(max).toFixed(max % 1 ? 1 : 0)}</span><span>${Number(max / 2).toFixed(max % 1 ? 1 : 0)}</span><span>0</span>`;
  holder.appendChild(axis);
  // Same games, new line: start the darker parts and the line where they
  // were and let them glide (trend-edge.css transitions) to where they are now.
  const bars = [...track.querySelectorAll(".gl-col:not(.gl-next) .gl-bar")];
  const marker = holder.querySelector(".gl-line-marker");
  if (sameBars && previousCuts.length === bars.length) {
    const cuts = bars.map((bar) => bar.style.getPropertyValue("--cut"));
    const offset = marker?.style.getPropertyValue("--line-offset") || "";
    bars.forEach((bar, index) => bar.style.setProperty("--cut", previousCuts[index]));
    if (marker && previousOffset) marker.style.setProperty("--line-offset", previousOffset);
    void holder.offsetHeight;
    bars.forEach((bar, index) => bar.style.setProperty("--cut", cuts[index]));
    if (marker && previousOffset) marker.style.setProperty("--line-offset", offset);
  }
  // Never move the viewport as a side effect of rendering. Only direct user
  // input should animate or change the chart position.
  gameLogState.animationDirection = "none";
}

// The save star beside the market title, for a host that keeps picks (the
// Finder: vortexTrendPanel.setSave). The host decides which of its lines
// "this prop" is from the panel's market and line, and whether it is saved.
let trendSave = null;
function trendSaveCurrent() {
  const stat = gameLogState.stat;
  const statKey = externalTrendConfig?.stats?.find((item) => item.label === stat)?.key || "";
  return { stat, statKey, line: Number(gameLogState.line), postedRows: externalTrendConfig?.postedRows };
}
function renderTrendSave() {
  const button = els.gamelogSave;
  if (!button) return;
  button.hidden = !trendSave || Boolean(externalTrendConfig?.researchOnly);
  if (!trendSave || externalTrendConfig?.researchOnly) return;
  const side = trendSave.savedSide?.(trendSaveCurrent()) || null;
  button.setAttribute("aria-pressed", String(Boolean(side)));
  button.dataset.side = side ? String(side).toLowerCase() : "";
  button.setAttribute("aria-label", side ? `In your picks (${side}). Change or remove` : "Save this prop to your picks");
}

function wireGameLogModal() {
  els.gamelogSave?.addEventListener("click", (event) => {
    event.stopPropagation();
    trendSave?.onClick?.(els.gamelogSave, trendSaveCurrent());
  });
  window.addEventListener("orientationchange", stabilizeGameLogLayout);
  window.visualViewport?.addEventListener("resize", stabilizeGameLogLayout);
  window.addEventListener("vortex:gamelog-line-pick", (event) => {
    const { stat, player } = gamelogPostedLinesContext;
    if (stat !== gameLogState.stat || player !== gameLogState.player) return;
    if (player) activeFinderProp = { ...(activeFinderProp || {}), player, betType: stat, line: Number(event.detail.value), side: "Over" };
    setGameLogPreviewLine(Number(event.detail.value), true);
    els.gamelogLinesBridge?.setValue(String(event.detail.value));
  });
  document.fonts?.ready?.then(stabilizeGameLogLayout).catch(() => {});
  if (typeof ResizeObserver === "function") new ResizeObserver(stabilizeGameLogLayout).observe(els.gamelogChart);
  const windowMenu = document.getElementById("gamelog-window-menu");
  const closeWindowMenu = () => { if (windowMenu) windowMenu.hidden = true; els.gamelogTabs?.querySelector("[data-window-menu]")?.setAttribute("aria-expanded", "false"); };
  els.gamelogTabs?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-window]");
    if (!btn) return;
    if (btn.dataset.windowMenu && windowMenu) {
      renderGameLogWindowMenu();
      windowMenu.hidden = !windowMenu.hidden;
      if (!windowMenu.hidden) placeGameLogWindowMenu(windowMenu, btn);
      btn.setAttribute("aria-expanded", String(!windowMenu.hidden));
      return;
    }
    closeWindowMenu();
    setGameLogWindow(btn.dataset.window);
  });
  windowMenu?.addEventListener("click", (event) => {
    if (event.target.closest("[data-window-close]")) return closeWindowMenu();
    const btn = event.target.closest("button[data-window]");
    if (!btn) return;
    closeWindowMenu();
    setGameLogWindow(btn.dataset.window);
  });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && windowMenu && !windowMenu.hidden) closeWindowMenu(); });
  // A tap anywhere else, or the window changing size, closes it.
  document.addEventListener("pointerdown", (event) => {
    if (!windowMenu || windowMenu.hidden || windowMenu.contains(event.target) || event.target.closest?.("[data-window-menu]")) return;
    closeWindowMenu();
  }, true);
  window.addEventListener("resize", () => { if (windowMenu && !windowMenu.hidden) closeWindowMenu(); });
  // These selects carry the label as their value (see renderGameLogSubfilters),
  // so translate back to the internal key filterGames() matches on.
  window.addEventListener("vortex:gamelog-season-pick", (event) => {
    gameLogState.season = seasonKey(event.detail.value);
    if (gameLogState.window === "h2h" || gameLogState.windowKey === "h2h") {
      gameLogState.windowKey = "10";
      gameLogState.gameCount = 10;
    }
    gameLogState.window = "recent";
    gameLogState.animationDirection = "initial";
    renderGameLogTabs(); renderGameLogChart();
  });
  window.addEventListener("vortex:gamelog-hand-pick", (event) => {
    gameLogState.handFilter = keyForLabel(GL_HAND_PAIRS, event.detail.value);
    renderGameLogSubfilters();
    renderGameLogTabs();
    renderGameLogChart();
  });
  window.addEventListener("vortex:gamelog-kind-pick", (event) => {
    gameLogState.seasonKind = keyForLabel(GL_KIND_PAIRS, event.detail?.value);
    renderGameLogSubfilters();
    renderGameLogTabs();
    renderGameLogChart();
  });
  window.addEventListener("vortex:gamelog-extra-pick", (event) => {
    const {field, value} = event.detail || {};
    if (!GL_EXTRA_FILTERS.some(([key]) => key === field)) return;
    gameLogState.extraFilters = {...(gameLogState.extraFilters || {}), [field]: value === "All" ? "all" : String(value)};
    renderGameLogSubfilters();
    renderGameLogTabs();
    renderGameLogChart();
  });
  window.addEventListener("vortex:gamelog-venue-pick", (event) => {
    gameLogState.venueFilter = keyForLabel(GL_VENUE_PAIRS, event.detail.value);
    renderGameLogSubfilters();
    renderGameLogTabs();
    renderGameLogChart();
  });
  els.gamelogStatTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-stat]");
    if (button && !button.disabled) loadGameLogStat(button.dataset.stat);
  });
  els.gamelogLineDown.addEventListener("click", () => setGameLogPreviewLine(gameLogState.line - 1, true));
  els.gamelogLineUp.addEventListener("click", () => setGameLogPreviewLine(gameLogState.line + 1, true));
}

/* ---------- External-sport trend panel (NFL) ----------
 * NFL research mounts THIS panel -- the same #gamelog-overlay node, the
 * same chart, window bar, filters, line stepper, alt-line picker and
 * sportsbook odds row -- into its own Trend tab, instead of carrying a
 * parallel implementation that would drift from the MLB one. The React
 * side owns the data (game logs, posted offers); everything below is the
 * thin sport-specific surface the shared renderers need.
 *
 * The host hands over games already in this panel's own shape:
 *   { value, fullDate, dateLabel, opponent, opponentLabel, isHome, season }
 * which is exactly what filterGames()/renderGameLogChart() already read.
 */
let externalTrendConfig = null;
let externalTrendHost = null;

const EXTERNAL_TREND_ADAPTER = {
  get sport() { return externalTrendConfig?.sport || "NFL"; },
  statCode(stat) {
    return externalTrendConfig?.stats?.find((entry) => entry.label === stat)?.code || stat;
  },
  statList() {
    return (externalTrendConfig?.stats || []).map((entry) => entry.label);
  },
  // No pitcher/batter split outside MLB, and no vs-LHP/RHP data, so the
  // handedness filter is hidden rather than shown permanently disabled.
  classify() {
    gameLogState.isPitcher = false;
    gameLogState.availableStats = null;
  },
  renderHeader(p) {
    const config = externalTrendConfig || {};
    const status = config.status || "Pre-game";
    const liveState = document.getElementById("gamelog-live-state");
    if (liveState) liveState.textContent = status;
    syncGameLogContext({
      matchup: config.opponent ? `vs ${config.opponent} · performance history` : "Live prop performance explorer",
      status,
    });
    if (els.gamelogPropBadge) els.gamelogPropBadge.textContent = gameLogStatCode(p.betType);
    const logoImg = (src) => (src ? `<img src="${escapeHtml(src)}" alt="" onerror="this.style.display='none'">` : "");
    const matchupLogosEl = document.getElementById("gamelog-matchup-logos");
    const marketMatchupEl = document.getElementById("gamelog-market-matchup");
    const marketTimeEl = document.getElementById("gamelog-market-time");
    const lineMovement = document.getElementById("gamelog-line-movement");
    // Line movement is an MLB-only localStorage series (see propLineHistory).
    if (lineMovement) lineMovement.hidden = true;
    if (matchupLogosEl) matchupLogosEl.innerHTML = `${logoImg(config.teamLogo)}${logoImg(config.opponentLogo)}`;
    if (marketMatchupEl) marketMatchupEl.textContent = config.matchupLabel || (config.opponent ? `vs ${config.opponent}` : "Matchup pending");
    if (marketTimeEl) marketTimeEl.textContent = config.kickoffLabel || "Time TBA";
    if (els.gamelogTeamMark) {
      els.gamelogTeamMark.hidden = !config.teamAbbr && !config.teamLogo;
      els.gamelogTeamMark.innerHTML = `${logoImg(config.teamLogo)}<span>${escapeHtml(config.teamAbbr || "")}</span>`;
    }
    els.gamelogPlayerCutout.innerHTML = config.headshot
      ? `<img src="${escapeHtml(config.headshot)}" alt="" onerror="this.parentElement.innerHTML=''">`
      : avatarHtml({ player: p.player }, "lg");
  },
  // Nothing to fetch: the host already loaded this sport's game logs. A tab
  // click for a DIFFERENT stat is reported back so the host can load that
  // stat's logs/offers and return them through vortexTrendPanel.update().
  loadStat(stat) {
    const config = externalTrendConfig;
    if (!config) return;
    const entry = config.stats?.find((item) => item.label === stat);
    if (entry && entry.key !== config.statKey) {
      // Keep the old frame until the host commits the new market atomically.
      config.onStat?.(entry.key);
      return;
    }
    gameLogState.stat = stat;
    gameLogState.dragging = false;
    gameLogState.error = "";
    gameLogState.handDataLoaded = false;
    gameLogState.animationDirection = "none";
    if (els.gamelogHandField) els.gamelogHandField.hidden = true;
    gameLogState.loading = Boolean(config.loading);
    syncTrendStatHeader(stat);
    renderGameLogTabs();
    renderGameLogChart();
  },
};

// Posted-line ladder + book quotes, straight from the host's already-fetched
// offers -- same shape the MLB loaders produce, so the alt-lines Select and
// renderGameLogBookOdds() need no sport branch of their own.
function applyExternalTrendMarket(config) {
  gamelogBookOddsRows = Array.isArray(config.odds) ? config.odds : [];
  gamelogPostedLinesContext = { stat: config.stat, player: config.player };
  const lines = Array.isArray(config.lines) ? config.lines : [];
  const hasCurrent = lines.some((row) => Number(row.value) === Number(gameLogState.line));
  els.gamelogLinesBridge?.setLines(lines);
  els.gamelogLinesBridge?.setValue(hasCurrent ? String(gameLogState.line) : "");
  els.gamelogLinesBridge?.setStatus(config.linesStatus || (lines.length ? "ready" : "empty"));
  renderGameLogBookOdds();
}

// Chips for filters the host applied to config.chart (WNBA's with/without
// teammate choices). The host owns the filtering; a chip only reports it and
// asks the host to drop it.
function renderExternalTrendChips(config) {
  const slot = document.getElementById("gamelog-ext-chips");
  if (!slot) return;
  const chips = Array.isArray(config?.chips) ? config.chips : [];
  slot.hidden = !chips.length;
  const nodes = [];
  if (chips.length && config.chipsNote) {
    const note = document.createElement("span");
    note.className = "gamelog-ext-note";
    note.textContent = config.chipsNote;
    nodes.push(note);
  }
  for (const chip of chips) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gamelog-ext-chip";
    button.dataset.kind = chip.kind || "";
    button.title = chip.title || "";
    button.setAttribute("aria-label", `Remove filter: ${chip.label}`);
    const label = document.createElement("span");
    label.textContent = chip.label;
    const close = document.createElement("span");
    close.className = "gamelog-ext-chip-x";
    close.setAttribute("aria-hidden", "true");
    close.textContent = "×";
    button.append(label, close);
    button.addEventListener("click", () => externalTrendConfig?.onChipRemove?.(chip.key));
    nodes.push(button);
  }
  if (chips.length > 1) {
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "gamelog-ext-clear";
    clear.textContent = "Clear all";
    clear.addEventListener("click", () => externalTrendConfig?.onChipsClear?.());
    nodes.push(clear);
  }
  slot.replaceChildren(...nodes);
}

window.vortexTrendPanel = {
  // Finder hosts MLB's mature chart directly, without navigating away from
  // the unified board. The normal MLB loaders still provide every stat,
  // posted alternative, sportsbook quote and historical filter.
  mountMlb(host, row) {
    const overlay = document.getElementById("gamelog-overlay") || els.gamelogOverlay;
    if (!overlay || !host || !row) return false;
    const source = row.raw || row;
    const prop = pitcherFinderGameLogProp(source);
    prop.headshot = row.headshot || prop.headshot;
    prop.teamAbbr = row.teamAbbr || prop.teamAbbr;
    prop.teamId = row.teamId || prop.teamId;
    prop.opponentTeamId = row.opponentTeamId || prop.opponentTeamId;
    prop.matchup = { ...prop.matchup, opponent: row.opponentAbbr || row.opponent || prop.matchup.opponent };
    prop.side = String(row.direction || 'OVER').toUpperCase() === 'UNDER' ? 'Under' : 'Over';
    if (overlay.parentElement !== host) host.appendChild(overlay);
    externalTrendConfig = null;
    externalTrendHost = host;
    renderExternalTrendChips(null);
    gameLogState.lineEdited = false;
    openGameLogModal(prop, MLB_TREND_ADAPTER);
    return true;
  },
  // Relocates the live panel into `host` -- move, not copy, exactly like
  // mountResearchTabs() does for MLB, so every listener and all state
  // survive. MLB reclaims the node by id the next time a report mounts.
  mount(host, config) {
    const overlay = document.getElementById("gamelog-overlay") || els.gamelogOverlay;
    if (!overlay || !host) return false;
    if (overlay.parentElement !== host) host.appendChild(overlay);
    externalTrendHost = host;
    this.update(config, true);
    return true;
  },
  // What the chart last drew from. The pages rebuild their config whenever
  // anything around them changes (a board refresh hands them new row
  // objects with the same numbers), and redrawing an unchanged chart costs
  // a full style and layout pass on a phone.
  drawn: "",
  signature(config) {
    try {
      return JSON.stringify([config.chart, config.lines, config.odds, config.line, config.side, Boolean(config.loading), config.statKey, config.filters]);
    } catch {
      return String(Math.random());
    }
  },
  update(config, remount = false) {
    if (!config) return;
    const previous = externalTrendConfig;
    if (!remount && previous === config) return;
    const switched = remount || trendAdapter !== EXTERNAL_TREND_ADAPTER
      || previous?.player !== config.player || previous?.sport !== config.sport;
    const marketChanged = previous?.statKey !== config.statKey;
    const signature = this.signature(config);
    const unchanged = !switched && !marketChanged && signature === this.drawn;
    const viewport = !switched && !unchanged ? captureGameLogViewport() : null;
    externalTrendConfig = config;
    this.drawn = signature;
    trendAdapter = EXTERNAL_TREND_ADAPTER;
    if (switched) {
      // A different player or sport starts the panel over: window back to
      // L10, filters cleared, line reset -- same reset MLB gets per prop.
      activeFinderProp = null;
      gameLogState.lineEdited = false;
      openGameLogModal({
        player: config.player,
        betType: config.stat,
        line: config.line,
        side: config.side || "Over",
        gameLogChart: config.chart || {},
        matchup: { opponent: config.opponent || "" },
        teamAbbr: config.teamAbbr || "",
        gameStatus: config.status || "Pre-game",
      }, EXTERNAL_TREND_ADAPTER);
    } else if (!unchanged) {
      if (marketChanged) {
        gameLogState.stat = config.stat;
        gameLogState.line = Number(config.line);
        gameLogState.lineEdited = false;
        gameLogState.error = "";
        gameLogState.dragging = false;
        gameLogState.animationDirection = "none";
        if (activeFinderProp) activeFinderProp = {...activeFinderProp,betType:config.stat,line:config.line,side:config.side||"Over"};
        syncTrendStatHeader(config.stat);
        populateGameLogStats();
      }
      const verifiedLineArrived = Number.isFinite(config.line) && Number(config.line) !== Number(previous?.line);
      if (verifiedLineArrived && !gameLogState.lineEdited) {
        gameLogState.line = Number(config.line);
      }
      gameLogState.loading = Boolean(config.loading);
      gameLogState.side = config.side || "Over";
      gameLogState.chart = gradeTrendChart(config.chart || {}, gameLogState.line, gameLogState.side);
      if (!gameLogState.chart.all) gameLogState.chart.all = [];
      renderGameLogTabs();
      renderGameLogChart();
    }
    // A stat that arrives with his games (an NBA page's Dunks on a night with
    // no Dunks line, WNBAPlayerPage researchRows) adds its chip.
    const statLabels = (entry) => (entry?.stats || []).map((item) => item.label).join("|");
    if (!switched && !marketChanged && statLabels(previous) !== statLabels(config)) populateGameLogStats();
    applyExternalTrendMarket(config);
    renderExternalTrendChips(config);
    if (viewport) restoreGameLogViewport(viewport);
  },
  // Whether `host` has the panel right now: it mounted it last and the
  // node is still inside it (a research report may have moved it since).
  holds(host) {
    const overlay = document.getElementById("gamelog-overlay") || els.gamelogOverlay;
    return Boolean(host && externalTrendHost === host && overlay && host.contains(overlay));
  },
  // Park the shared node back on <body> so a later MLB report can reclaim
  // it (getElementById only ever finds an ATTACHED node -- see
  // parkGameLogOverlay for the bug class this avoids). A page passes its
  // host: if another page has taken the panel since (React can run an old
  // page's cleanup after a new page's mount), it is left alone -- parking
  // it, and clearing the new page's setup, left that page broken and the
  // chart reopened on its own over it.
  unmount(caller) {
    if (caller && caller !== externalTrendHost) return;
    const host = externalTrendHost;
    if (trendAdapter === EXTERNAL_TREND_ADAPTER) trendAdapter = MLB_TREND_ADAPTER;
    externalTrendConfig = null;
    externalTrendHost = null;
    renderExternalTrendChips(null);
    const overlay = document.getElementById("gamelog-overlay") || els.gamelogOverlay;
    // Only park it if this host still holds it. Leaving one sport for the
    // other can run the two teardowns in either order, and parking a node
    // MLB has already mounted into its own Trend tab would blank that tab.
    if (!overlay || !host || !host.contains(overlay)) return;
    overlay.hidden = true;
    document.body.appendChild(overlay);
  },
  // The line lives in gameLogState; the host reads it back after a step,
  // drag or alt-line pick to keep its own "analyzed line" in sync.
  currentLine() { return gameLogState.line; },
  // { savedSide(current), onClick(anchor, current) } shows the save star;
  // null hides it. Called again whenever the host's picks change.
  setSave(save) {
    trendSave = save || null;
    renderTrendSave();
  },
};

/* ---------- Team insights modal (Batting Order & Pitch Arsenal) ---------- */

const TEAM_INSIGHTS_SOURCE = "/api/team-insights";

const teamState = {
  data: null,        // last fetched response, keyed by cacheKey below
  cacheKey: "",       // teamId+pitcherId -- avoids refetching on reopen
  params: null,
  deepReady: false,
  deepLoading: false,
  deepError: "",
  view: "order",      // "order" | "arsenal"
  orderFilter: "season", // "season" | "handL" | "handR" | "pitcher"
  pitchFilter: "",    // selected pitch_type code, "" = first available
  arsenalMode: "pitches", // "pitches" | "arm"
};
const teamInsightsCache = new Map();
const teamInsightsRequests = new Map();

function teamInsightsKey(params) {
  return `${params.teamId}-${params.pitcherId || "none"}-${params.pitcherName || "tbd"}-${params.pitcherHand || "R"}`;
}

function requestTeamInsights(params, detail = "summary") {
  const key = `${teamInsightsKey(params)}:${detail}`;
  if (teamInsightsRequests.has(key)) return teamInsightsRequests.get(key);
  const url = `${TEAM_INSIGHTS_SOURCE}?teamId=${params.teamId}&pitcherId=${params.pitcherId || ""}`
    + `&pitcherName=${encodeURIComponent(params.pitcherName || "")}&pitcherHand=${params.pitcherHand || "R"}`
    + `&detail=${detail}`;
  const request = fetch(url)
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
      return data;
    })
    .finally(() => teamInsightsRequests.delete(key));
  teamInsightsRequests.set(key, request);
  return request;
}

function mergeTeamInsights(summary, matchup) {
  const deepById = new Map((matchup.battingOrder || []).map((row) => [String(row.id), row]));
  return {
    ...summary,
    ...matchup,
    detail: "full",
    battingOrder: (summary.battingOrder || matchup.battingOrder || []).map((row) => ({
      ...row,
      ...(deepById.get(String(row.id)) || {}),
      season: row.season || null,
    })),
  };
}

function prefetchTeamInsights(params) {
  const key = teamInsightsKey(params);
  const cached = teamInsightsCache.get(key) || {};
  if (!cached.summary) fetchTeamInsightsInBackground(params, "summary");
  if (!cached.matchup) fetchTeamInsightsInBackground(params, "filters");
}

function fetchTeamInsightsInBackground(params, detail) {
  const key = teamInsightsKey(params);
  requestTeamInsights(params, detail).then(data => {
    const cached = teamInsightsCache.get(key) || {};
    if (detail === "summary") cached.summary = data;
    else if (detail === "filters") cached.matchup = data;
    else cached.full = data;
    cached.data = mergeTeamInsights(cached.summary || {}, cached.full || cached.matchup || {});
    teamInsightsCache.set(key, cached);
    if (key === teamState.cacheKey) {
      teamState.data = cached.data;
      teamState.deepReady = Boolean(cached.matchup || cached.full);
      renderTeamModal();
    }
  }).catch(() => {});
}

// Fixed thresholds (not "vs this player's own baseline") -- green/red mean
// "statistically strong/weak performance," coloring raw values directly.
// Applied to every filter equally.
function tierClassFor(metric, value) {
  const v = parseFloat(value);
  if (value == null || value === "" || Number.isNaN(v)) return "";
  if (metric === "avg") return v >= 0.27 ? "tt-good" : v <= 0.2 ? "tt-bad" : "";
  if (metric === "ops") return v >= 0.8 ? "tt-good" : v <= 0.65 ? "tt-bad" : "";
  if (metric === "woba") return v >= 0.35 ? "tt-good" : v <= 0.29 ? "tt-bad" : "";
  if (metric === "k_pct") return v <= 20 ? "tt-good" : v >= 30 ? "tt-bad" : "";
  return "";
}

function openTeamModal(params, opponentName) {
  els.teamOverlay.hidden = false;
  els.teamTitle.textContent = opponentName ? `${opponentName} — Team Insights` : "Team Insights";

  const key = teamInsightsKey(params);
  const cached = teamInsightsCache.get(key) || {};
  teamState.cacheKey = key;
  teamState.params = params;
  teamState.data = cached.data || cached.summary || null;
  teamState.deepReady = Boolean(cached.matchup || cached.full);
  teamState.deepLoading = false;
  teamState.deepError = "";
  teamState.orderFilter = "season";
  renderTeamModal(); // shows loading state
  if (!cached.summary) fetchTeamInsights(params, "summary");
  if (!cached.matchup && !cached.full) fetchTeamInsights(params, "filters");
}

function closeTeamModal() {
  els.teamOverlay.hidden = true;
}

async function fetchTeamInsights(params, detail = "summary") {
  const key = teamInsightsKey(params);
  if (detail === "matchup") teamState.deepLoading = true;
  try {
    const data = await requestTeamInsights(params, detail);
    const cached = teamInsightsCache.get(key) || {};
    if (detail === "summary") {
      cached.summary = data;
      cached.data = (cached.full || cached.matchup) ? mergeTeamInsights(data, cached.full || cached.matchup) : data;
    } else if (detail === "filters") {
      cached.matchup = data;
      cached.data = cached.summary ? mergeTeamInsights(cached.summary, data) : data;
    } else {
      cached.full = data;
      cached.data = cached.summary ? mergeTeamInsights(cached.summary, data) : data;
    }
    teamInsightsCache.set(key, cached);
    if (key !== teamState.cacheKey) return;
    teamState.data = cached.data;
    teamState.deepReady = Boolean(cached.matchup || cached.full);
    teamState.deepLoading = false;
    teamState.deepError = "";
    renderTeamModal();
    if (detail === "summary" && !cached.matchup && !cached.full) fetchTeamInsights(params, "filters");
  } catch (err) {
    if (key !== teamState.cacheKey) return;
    teamState.deepLoading = false;
    if (detail === "summary") teamState.data = { error: err.message };
    else teamState.deepError = err.message || "Matchup layer unavailable";
    renderTeamModal();
  }
}

function wireTeamModal() {
  els.teamClose.addEventListener("click", closeTeamModal);
  els.teamOverlay.addEventListener("click", (e) => {
    if (e.target === els.teamOverlay) closeTeamModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.teamOverlay.hidden) closeTeamModal();
  });
  els.teamTabs.querySelectorAll(".team-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      teamState.view = btn.dataset.view;
      if (teamState.view === "arsenal") {
        const cached = teamInsightsCache.get(teamState.cacheKey) || {};
        if (!cached.full && teamState.params) fetchTeamInsights(teamState.params, "matchup");
      }
      renderTeamModal();
    });
  });
  els.orderFilterRow.querySelectorAll(".team-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      teamState.orderFilter = btn.dataset.filter;
      renderTeamModal();
    });
  });
  [els.arsenalModePitches, els.arsenalModeArm].forEach((btn) => {
    btn.addEventListener("click", () => {
      teamState.arsenalMode = btn === els.arsenalModeArm ? "arm" : "pitches";
      renderArsenalMode();
    });
  });
}

function renderArsenalMode() {
  const arm = teamState.arsenalMode === "arm";
  els.arsenalModePitches.classList.toggle("active", !arm);
  els.arsenalModeArm.classList.toggle("active", arm);
  els.arsenalModePitches.setAttribute("aria-selected", String(!arm));
  els.arsenalModeArm.setAttribute("aria-selected", String(arm));
  els.arsenalPitchesPanel.hidden = arm;
  els.arsenalArmPanel.hidden = !arm;
}

function renderTeamModal() {
  els.teamTabs.querySelectorAll(".team-tab").forEach((b) => b.classList.toggle("active", b.dataset.view === teamState.view));
  els.teamViewOrder.hidden = teamState.view !== "order";
  els.teamViewArsenal.hidden = teamState.view !== "arsenal";
  renderArsenalMode();

  const data = teamState.data;
  if (!data) {
    els.orderFilterRow.querySelectorAll('.team-filter:not([data-filter="season"])').forEach((b) => { b.disabled = true; });
    els.teamLineupNote.hidden = true;
    els.orderEmpty.hidden = false;
    els.orderEmpty.innerHTML = teamLoadingMarkup("Reading tonight's roster", "Season lines appear first");
    els.orderTbody.innerHTML = "";
    els.arsenalEmpty.hidden = false;
    els.arsenalEmpty.innerHTML = teamLoadingMarkup("Preparing pitch matchups", "This layer follows the roster");
    els.arsenalTbody.innerHTML = "";
    els.armSlotEmpty.hidden = false;
    els.armSlotEmpty.innerHTML = teamLoadingMarkup("Mapping pitcher arm slot", "Statcast data loads in the background");
    els.armSlotTbody.innerHTML = "";
    return;
  }
  if (data.error || !data.battingOrder || !data.battingOrder.length) {
    els.teamLineupNote.hidden = true;
    const msg = data.error && siteIsAdmin() ? `Couldn't load roster — ${data.error}` : "No roster data available for this team.";
    els.orderEmpty.hidden = false;
    els.orderEmpty.textContent = msg;
    els.orderTbody.innerHTML = "";
    els.arsenalEmpty.hidden = false;
    els.arsenalEmpty.textContent = msg;
    els.arsenalTbody.innerHTML = "";
    els.armSlotEmpty.hidden = false;
    els.armSlotEmpty.textContent = msg;
    els.armSlotTbody.innerHTML = "";
    return;
  }

  els.teamLineupNote.hidden = data.lineupConfirmed !== false;

  renderOrderView(data);
  renderArsenalView(data);
  renderArmSlotView(data);
}

function renderOrderView(data) {
  els.orderEmpty.hidden = true;

  const pitcherBtn = els.orderFilterRow.querySelector('[data-filter="pitcher"]');
  const tonightHand = data.opponentPitcherHand === "L" ? "L" : "R";
  pitcherBtn.textContent = data.opponentPitcherName ? `vs ${data.opponentPitcherName}` : "vs Pitcher";
  pitcherBtn.disabled = !data.opponentPitcherName || !teamState.deepReady;

  // Both hands are always shown side by side (as separate filters) so you
  // can compare a batter's platoon split, not just whichever hand happens
  // to be pitching tonight -- that one gets a small marker for context.
  ["handL", "handR"].forEach((key) => {
    const btn = els.orderFilterRow.querySelector(`[data-filter="${key}"]`);
    const isTonight = (key === "handL" && tonightHand === "L") || (key === "handR" && tonightHand === "R");
    btn.disabled = !teamState.deepReady;
    btn.classList.toggle("tt-tonight", isTonight);
    btn.title = isTonight ? "Tonight's starter throws this hand" : "";
  });

  els.orderFilterRow.querySelectorAll(".team-filter").forEach((b) => {
    b.classList.toggle("active", b.dataset.filter === teamState.orderFilter);
  });

  const fieldFor = { season: "season", handL: "handSplitL", handR: "handSplitR", pitcher: "vsPitcher" }[teamState.orderFilter];
  els.orderVolumeHead.textContent = teamState.orderFilter === "pitcher" ? "H / AB" : "AB";
  els.orderTbody.innerHTML = "";
  data.battingOrder.forEach((row) => {
    const stat = row[fieldFor];
    const tr = document.createElement("tr");
    if (!stat) {
      tr.innerHTML = `
        <td class="tt-player">${teamPlayerCell(row)}</td>
        <td colspan="6" class="tt-nodata">${teamState.orderFilter === "pitcher" ? "No history vs this pitcher" : "No data"}</td>
      `;
    } else {
      tr.innerHTML = `
        <td class="tt-player">${teamPlayerCell(row)}</td>
        <td>${teamState.orderFilter === "pitcher" ? `${stat.hits ?? 0}/${stat.ab ?? 0}` : (stat.ab ?? "—")}</td>
        <td class="${tierClassFor("avg", stat.avg)}">${stat.avg ?? "—"}</td>
        <td>${stat.hr ?? "—"}</td>
        <td>${stat.rbi ?? "—"}</td>
        <td class="${tierClassFor("ops", stat.ops)}">${stat.ops ?? "—"}</td>
        <td class="${tierClassFor("k_pct", stat.k_pct)}">${stat.k_pct != null ? stat.k_pct + "%" : "—"}</td>
      `;
    }
    els.orderTbody.appendChild(tr);
  });
}

function teamPlayerCell(row) {
  const photo = `https://img.mlbstatic.com/mlb-photos/image/upload/w_100,q_auto:best/v1/people/${row.id}/headshot/silo/current`;
  return `<div class="tt-player-card"><span class="tt-order">${row.order}</span><img src="${photo}" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span class="tt-player-copy"><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.position || "MLB")}</small></span></div>`;
}

function formatBattingAverage(value) {
  if (value == null || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toFixed(3).replace(/^0(?=\.)/, "");
}

function renderArsenalView(data) {
  els.arsenalEmpty.hidden = true;
  if (!teamState.deepReady) {
    els.arsenalFilterRow.innerHTML = "";
    els.arsenalTbody.innerHTML = "";
    els.arsenalEmpty.hidden = false;
    els.arsenalEmpty.innerHTML = teamState.deepError
      ? `<span class="team-loader-error">Matchup layer unavailable · ${escapeHtml(teamState.deepError)}</span>`
      : teamLoadingMarkup("Mapping the pitch arsenal", "The batting order is already available");
    return;
  }
  const pitchTypes = data.pitchTypes || [];
  if (!pitchTypes.length) {
    els.arsenalEmpty.hidden = false;
    els.arsenalEmpty.textContent = "No pitch-mix data available for tonight's starter.";
    els.arsenalTbody.innerHTML = "";
    return;
  }
  if (!teamState.pitchFilter || !pitchTypes.some((p) => p.code === teamState.pitchFilter)) {
    teamState.pitchFilter = pitchTypes[0].code;
  }

  els.arsenalFilterRow.innerHTML = "";
  pitchTypes.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "team-filter" + (p.code === teamState.pitchFilter ? " active" : "");
    const usage = Number.isFinite(Number(p.usage)) ? `${Math.round(Number(p.usage))}%` : "—";
    btn.innerHTML = `${escapeHtml(p.code)} <span class="pitch-usage">${usage}</span>`;
    btn.title = `${p.name}${usage !== "—" ? ` · ${usage} usage` : ""}`;
    btn.addEventListener("click", () => {
      teamState.pitchFilter = p.code;
      renderArsenalView(data);
    });
    els.arsenalFilterRow.appendChild(btn);
  });

  const selectedPitch = pitchTypes.find((p) => p.code === teamState.pitchFilter);
  if (els.arsenalSummary) {
    if (selectedPitch) {
      const usage = Number.isFinite(Number(selectedPitch.usage)) ? `${Number(selectedPitch.usage).toFixed(1)}% usage` : "Usage unavailable";
      const speed = Number.isFinite(Number(selectedPitch.speed)) ? ` · ${Number(selectedPitch.speed).toFixed(1)} mph` : "";
      const season = data.source?.season || "Current season";
      els.arsenalSummary.innerHTML = `<div><strong>${escapeHtml(selectedPitch.name || selectedPitch.code)}</strong><small>${escapeHtml(String(season))} pitcher usage</small></div><span>${usage}${speed}</span>`;
    }
  }

  els.arsenalTbody.innerHTML = "";
  (data.pitchRows || []).forEach((row) => {
    const stat = (row.byPitch || {})[teamState.pitchFilter];
    const tr = document.createElement("tr");
    if (!stat) {
      tr.innerHTML = `
        <td class="tt-player">${teamPlayerCell(row)}</td>
        <td colspan="3" class="tt-nodata">No data vs this pitch</td>
      `;
    } else {
      tr.innerHTML = `
        <td class="tt-player">${teamPlayerCell(row)}</td>
        <td>${stat.pa ?? "—"}</td>
        <td class="${tierClassFor("avg", stat.avg)}">${formatBattingAverage(stat.avg)}</td>
        <td class="${tierClassFor("k_pct", stat.k_pct)}">${stat.k_pct != null ? stat.k_pct + "%" : "—"}</td>
      `;
    }
    els.arsenalTbody.appendChild(tr);
  });
}

function renderArmSlotView(data) {
  if (!teamState.deepReady) {
    els.armSlotProfile.innerHTML = "";
    els.armSlotTbody.innerHTML = "";
    els.armSlotEmpty.hidden = false;
    els.armSlotEmpty.innerHTML = teamState.deepError
      ? `<span class="team-loader-error">Arm-slot layer unavailable · ${escapeHtml(teamState.deepError)}</span>`
      : teamLoadingMarkup("Resolving arm-slot performance", "Statcast comparisons are loading now");
    return;
  }
  const slot = data.armSlot;
  els.armSlotTbody.innerHTML = "";
  if (!slot || slot.angle == null) {
    els.armSlotProfile.innerHTML = "";
    els.armSlotEmpty.hidden = false;
    els.armSlotEmpty.textContent = "Arm angle unavailable.";
    return;
  }

  els.armSlotEmpty.hidden = true;
  const releaseHeight = slot.release_z != null ? `${Number(slot.release_z).toFixed(2)} ft release height` : "Release height unavailable";
  els.armSlotProfile.innerHTML = `
    <div class="arm-angle-mark"><strong>${Number(slot.angle).toFixed(1)}°</strong><span>${escapeHtml(slot.label || "Arm slot")}</span></div>
    <div class="arm-slot-copy"><strong>${escapeHtml(data.opponentPitcherName || "Tonight's pitcher")}</strong><span>${escapeHtml(String(slot.season))} Statcast · ${releaseHeight} · ${slot.pitches || "—"} tracked pitches</span><small>Batter results below use PA-ending pitches from the same throwing hand within ${Number(slot.comparison_low).toFixed(1)}°–${Number(slot.comparison_high).toFixed(1)}°.</small></div>
  `;

  (data.armRows || []).forEach((row) => {
    const stat = row.stats;
    const tr = document.createElement("tr");
    if (!stat) {
      tr.innerHTML = `<td class="tt-player">${teamPlayerCell(row)}</td><td colspan="3" class="tt-nodata">No comparable-angle sample</td>`;
    } else {
      const sampleClass = stat.pa < 15 ? "arm-sample-limited" : "";
      tr.innerHTML = `
        <td class="tt-player">${teamPlayerCell(row)}</td>
        <td><strong>${stat.pa}</strong><small class="arm-sample ${sampleClass}">${escapeHtml(stat.sample || "")}</small></td>
        <td class="${tierClassFor("avg", stat.avg)}">${formatBattingAverage(stat.avg)}</td>
        <td class="${tierClassFor("k_pct", stat.k_pct)}">${stat.k_pct != null ? Number(stat.k_pct).toFixed(1) + "%" : "—"}</td>
      `;
    }
    els.armSlotTbody.appendChild(tr);
  });
}

function teamLoadingMarkup(title, detail) {
  return `<span class="team-loader" role="status"><i class="team-loader-radar"><b></b></i>`
    + `<span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span></span>`;
}

/**
 * Rebuilds the player profile + line picker for an exact prop, used when
 * reopening a saved prop or a parlay leg from the Saved tab.
 */
/**
 * Reopens a saved prop by rendering its stored snapshot directly. Deliberately
 * does NOT go through setLineValue()/applyLineSelection() — those search
 * state.props (only the static demo entries) and would either miss a saved
 * live result entirely or trigger a pointless (and possibly different, since
 * stats move) re-fetch instead of showing what was actually saved.
 */
function openExactProp(p) {
  selectPlayer(p.player, null, { autoSelectStat: false }); // builds the profile shell (avatar, stat select)
  cmd.player = p.player;
  cmd.stat = p.betType;
  cmd.line = p.line;
  cmd.side = p.side === "Under" ? "Under" : "Over";

  if (![...els.profileStats.options].some((o) => o.value === p.betType)) {
    const opt = document.createElement("option");
    opt.value = p.betType;
    opt.textContent = p.betType;
    els.profileStats.appendChild(opt);
    els.profileStatsBridge?.setOptions([...els.profileStats.options].map((o) => o.value));
  }
  els.profileStats.value = p.betType;
  els.profileStatsBridge?.setValue(p.betType);

  // Same scaled span as selectStat() — a flat ±1.5 boxed in high lines
  // (e.g. a saved 5.5 K prop could only slide 4–7 after reopening).
  const span = Math.max(1.5, Math.round(p.line * 0.6 * 2) / 2);
  const min = Math.max(0, p.line - span);
  const max = p.line + span;
  els.lineSlider.min = String(min);
  els.lineSlider.max = String(max);
  els.lineNumber.min = String(min);
  els.lineNumber.max = String(max);
  els.lineSlider.value = String(p.line);
  els.lineNumber.value = String(p.line);
  els.lineSlider.style.setProperty("--fill", `${((p.line - min) / (max - min)) * 100}%`);

  els.sideToggle.querySelectorAll(".side-btn").forEach((b) => {
    b.disabled = false;
    b.classList.toggle("active", b.dataset.side === cmd.side);
  });

  els.linePicker.hidden = false;
  els.lineNoData.hidden = true;

  renderReport(p);
}

/**
 * Opens a Finder prop as a full research report, mirroring
 * deepDiveIntoBotProp() -- the already-proven way to jump into Research
 * from a board that lives in another tab.
 *
 * Two earlier attempts got this wrong. Calling openGameLogModal() only
 * repopulated the game-log chart and never rebuilt the report, so the
 * Research tab kept showing whichever player was rendered last. Replacing
 * that with a hand-rolled setup plus applyLineSelection() then left the
 * screen half-initialised, because selectStat() is what resets
 * currentResearchProp, re-arms the PrizePicks line default, syncs the stat
 * picker and works out the line range -- none of which a hand-rolled shell
 * did -- and setLineValue() is what actually kicks off the lookup.
 */
function researchFinderProp(prop) {
  if (!prop) return;
  selectPlayer(prop.player, prop.isPitcherProp ? "P" : null, { autoSelectStat: false });
  // A Finder line can be for a market this player has no static entry for,
  // so the option has to exist before it can be selected.
  if (![...els.profileStats.options].some((o) => o.value === prop.betType)) {
    const opt = document.createElement("option");
    opt.value = prop.betType;
    opt.textContent = prop.betType;
    els.profileStats.appendChild(opt);
    els.profileStatsBridge?.setOptions([...els.profileStats.options].map((o) => o.value));
  }
  selectStat(prop.betType);
  cmd.side = prop.side === "Under" ? "Under" : "Over";
  els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === cmd.side));
  setLineValue(prop.line, { immediate: true });
  switchTab("research", { scrollY: 0 });
  focusResearchTab("trend");
}

function buildReportNode(p) {
  const template = document.getElementById("report-template");
  const node = template.content.firstElementChild.cloneNode(true);
  node.classList.add(p.isPitcherProp === true ? "report-pitcher" : "report-batter");

  node.querySelector(".rt-avatar-slot").innerHTML = avatarHtml(p, "lg");

  fillHeader(node, p);
  fillResearchSnapshot(node, p);
  fillResearchHealth(node, p);
  fillPlayability(node, p);
  fillDecisionPanel(node, p);
  fillFormLadder(node, p);
  fillOpportunity(node, p);
  fillKPath(node, p);
  fillProjection(node, p);
  fillWhyItHits(node, p);
  fillBiggestEdgesRisks(node, p);
  fillPitchArsenal(node, p);
  fillLineupStrip(node, p);
  fillPitcherLineupProfile(node, p);
  fillSplitFactor(node, p);
  fillMatchup(node, p);
  fillNarrative(node, p);
  fillPerformance(node, p);
  fillVsMatchup(node, p);
  fillEnvRisk(node, p);
  fillModelConfirm(node, p);

  return node;
}

function fillHeader(node, p) {
  node.querySelector(".rt-sport").textContent = p.sport || "";
  node.querySelector(".rt-title").textContent = `${p.player} — ${p.side} ${p.line} ${p.betType}`;
  node.querySelector(".rt-sub").textContent =
    `${p.team ? p.team + " · " : ""}${p.location || ""}${p.estHitRate != null ? " · est. " + p.estHitRate + "% hit rate" : ""}`;

  node.querySelector(".score-tier-icon").textContent = p.tierIcon || "";

  node.querySelector(".verdict-pill").textContent = p.verdict || "";
  const verdictParts = String(p.verdictDetail || "").split(/\s*\u00b7\s*/).filter(Boolean);
  node.querySelector(".verdict-detail").innerHTML = verdictParts.map((part) => {
    const splitAt = part.indexOf(":");
    if (splitAt < 0) return `<span class="verdict-metric"><strong>${escapeHtml(part)}</strong></span>`;
    return `<span class="verdict-metric"><small>${escapeHtml(part.slice(0, splitAt))}</small><strong>${escapeHtml(part.slice(splitAt + 1).trim())}</strong></span>`;
  }).join("");

  node.querySelector(".unit-value").textContent = p.unitSize || "—";
}

function fillResearchSnapshot(node, p) {
  const meta = p.researchMeta || {};
  const fc = p.floorCeiling || {};
  const projection = fc.median != null ? fc.median : (p.estHitRate != null ? `${p.estHitRate}%` : "—");
  const l10 = p.hitRates?.l10 != null ? `${p.hitRates.l10}%` : "—";
  const recent = fc.median != null ? `Med ${fc.median}` : "Live log";
  const matchup = p.matchup?.opponent || "—";
  const trend = p.trend || meta.status || "—";
  node.querySelector(".snapshot-projection").textContent = projection;
  node.querySelector(".snapshot-l10").textContent = l10;
  node.querySelector(".snapshot-avg").textContent = recent;
  node.querySelector(".snapshot-matchup").textContent = matchup;
  node.querySelector(".snapshot-trend").textContent = trend.replaceAll("_", " ");
}

function fillResearchHealth(node, p) {
  const block = node.querySelector(".research-health-block");
  const meta = p.researchMeta;
  if (!meta) { block.hidden = true; return; }
  block.hidden = false;
  const status = String(meta.status || "LIMITED");
  const statusEl = block.querySelector(".research-health-status");
  statusEl.textContent = status === "FULL" ? "FULL COVERAGE" : status === "LIMITED" ? "LIMITED COVERAGE" : "PENDING DATA";
  statusEl.className = `research-health-status health-${status.toLowerCase()}`;
  block.querySelector(".research-health-rate").textContent = meta.exactLineRate != null ? `${meta.exactLineRate}%` : "—";
  const range = Array.isArray(meta.historicalRange) ? ` · uncertainty ${meta.historicalRange[0]}–${meta.historicalRange[1]}%` : "";
  block.querySelector(".research-health-label").textContent = `${meta.exactLineLabel || "Exact-line history"} · ${meta.sampleGames || 0} games${range}`;
  block.querySelector(".research-health-note").hidden = true;

  const sources = block.querySelector(".research-health-sources");
  sources.replaceChildren(); sources.hidden = true;
  const limits = block.querySelector(".research-health-limits");
  const limitations = meta.limitations || [];
  limits.replaceChildren();
  limits.hidden = true;
}

function fillPlayability(node, p) {
  const meta = p.researchMeta || {};
  const block = node.querySelector(".playability-block");
  const lineup = p.matchup?.lineup;
  const starter = p.matchup?.pitcher;
  const chips = [
    [lineup ? "Lineup confirmed" : "Lineup pending", !!lineup],
    [starter && !starter.includes("not announced") ? "Starter confirmed" : "Starter pending", !!starter && !starter.includes("not announced")],
    [`${meta.sampleGames || 0}-game exact-line sample`, (meta.sampleGames || 0) >= 12],
    [meta.limitations?.length ? "Research has limits" : "Research complete", !meta.limitations?.length],
  ];
  block.querySelector(".playability-label").textContent = meta.status === "FULL" ? "READY" : "CHECK CONTEXT";
  block.querySelector(".playability-chips").innerHTML = chips.map(([label, good]) => `<span class="${good ? "ready" : "pending"}">${good ? "●" : "○"} ${escapeHtml(label)}</span>`).join("");
}

function fillDecisionPanel(node, p) {
  const meta = p.researchMeta || {};
  const rate = meta.exactLineRate ?? p.estHitRate;
  node.querySelector(".decision-probability").textContent = rate != null ? `${rate}% historical exact-line rate` : "Evidence still building";
  node.querySelector(".decision-detail").textContent = meta.historicalRange ? `${meta.sampleGames} games · ${meta.historicalRange[0]}–${meta.historicalRange[1]}%` : "";
  const marketValue = p.marketProb ?? p.trueProb;
  node.querySelector(".decision-market-value").textContent = marketValue != null ? `${Math.round(marketValue * 100)}% fair probability` : "Price not attached";
  node.querySelector(".decision-market-note").textContent = marketValue != null ? "Market chance" : "No posted odds";
}

function fillFormLadder(node, p) {
  const block = node.querySelector(".form-ladder-block");
  const games = p.gameLogChart?.l10 || [];
  if (!games.length) { block.hidden = true; return; }
  block.hidden = false;
  block.querySelector(".form-ladder-note").textContent = `Line ${p.line}`;
  block.querySelector(".form-ladder").innerHTML = games.map((g) => `<div class="form-game ${g.over ? "hit" : "miss"}" title="${escapeHtml(g.date || "Game")} vs ${escapeHtml(g.opponent || "")}: ${g.value}"><strong>${g.value}</strong><span>${escapeHtml(g.opponent || "—")}</span></div>`).join("");
}

function fillOpportunity(node, p) {
  const block = node.querySelector(".opportunity-block");
  const isPitcher = /Pitcher|Pitching Outs|Hits Allowed|Earned Runs/.test(p.betType || "");
  if (isPitcher) { block.hidden = true; return; }
  const m = p.matchup || {}, re = p.runEnvironment || {};
  const rows = [
    ["Batting order", m.lineup || "Not confirmed"],
    ["Starter", m.pitcher || "Pending"],
    ["Bullpen", m.bullpen || "Not available"],
    ["Team environment", re.projected_runs != null ? `${re.projected_runs} projected runs` : "Not available"],
  ];
  block.hidden = false;
  block.querySelector(".opportunity-grid").innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("");
}

function fillKPath(node, p) {
  const block = node.querySelector(".k-path-block");
  const isK = (p.betType || "").includes("Strikeouts (Pitcher)");
  if (!isK) { block.hidden = true; return; }
  const stats = p.seasonStats || p.season_stats || {};
  const seasonK9 = stats.k_per_9 ?? "—";
  const projection = p.projKs ?? p.proj_ks ?? p.floorCeiling?.median ?? "—";
  const opp = p.oppKpct ?? p.opp_kpct;
  block.hidden = false;
  block.querySelector(".k-path-equation").textContent = `${projection} projected Ks · ${seasonK9} K/9 · ${p.avgIp ?? p.avg_ip ?? "—"} projected innings`;
  const rows = [["Opponent K%", opp != null ? `${opp}%` : "Pending"], ["Recent K/9", p.recentK9 ?? p.recent_k9 ?? "—"], ["Umpire", p.umpName ?? p.ump_name ?? "Pending"], ["Line", p.line]];
  block.querySelector(".k-path-grid").innerHTML = rows.map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("");
}

function fillWhyItHits(node, p) {
  const list = node.querySelector(".why-list");
  (p.whyItHits || []).forEach((line) => {
    const li = document.createElement("li");
    const emoji = line.match(/^[🔥❄️📊📈📉⚠️✅❌🎯💪🧠🎲🏆💡⚡️🌊🌪️🏠✈️🤝]/) ? "" : "✅ ";
    li.textContent = emoji + line;
    list.appendChild(li);
  });
}

function fillConfidenceBreakdown(node, p) {
  const block = node.querySelector(".confidence-block");
  const items = p.confidenceBreakdown || [];
  if (!items.length) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  const holder = block.querySelector(".confidence-rows");
  holder.innerHTML = "";
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "conf-row";
    const pct = Math.max(0, Math.min(100, (item.score / 10) * 100));
    const tone = item.score >= 6.5 ? "good" : item.score <= 3.5 ? "bad" : "mid";
    row.innerHTML = `
      <span class="conf-label">${escapeHtml(item.label)}</span>
      <div class="conf-track"><div class="conf-fill conf-fill-${tone}" style="width:${pct}%"></div></div>
      <span class="conf-score">${item.score.toFixed(1)}</span>
    `;
    holder.appendChild(row);
  });
}

const V2_CATEGORY_LABELS = {
  projection: "Projection", matchup: "Matchup", skill: "Skill", context: "Context",
  form: "Form", variance: "Variance", hidden_edge: "Hidden Edge",
};

function fillScorecardV2(node, p) {
  const block = node.querySelector(".v2-block");
  const sc = p.scorecardV2;
  if (!sc) {
    block.hidden = true;
    return;
  }
  block.hidden = false;

  const labelClass = sc.final_score >= 8.5 ? "v2-elite" : sc.final_score >= 7.5 ? "v2-strong"
    : sc.final_score >= 6.5 ? "v2-lean" : sc.final_score >= 5.5 ? "v2-neutral" : "v2-avoid";
  block.querySelector(".v2-final-score").textContent = sc.final_score.toFixed(2);
  const labelEl = block.querySelector(".v2-final-label");
  labelEl.textContent = sc.label;
  labelEl.className = `v2-final-label ${labelClass}`;
  const agreeEl = block.querySelector(".v2-agreement");
  agreeEl.textContent = sc.agreement_pct != null ? `${sc.agreement_pct}% category agreement` : "";

  const holder = block.querySelector(".v2-cat-rows");
  holder.innerHTML = "";
  Object.entries(V2_CATEGORY_LABELS).forEach(([key, label]) => {
    const cat = sc.categories[key];
    if (!cat) return;
    const pct = Math.max(0, Math.min(100, (cat.score / 10) * 100));
    const tone = cat.score >= 6.5 ? "good" : cat.score <= 3.5 ? "bad" : "mid";
    const weight = sc.weights[key];
    const row = document.createElement("div");
    row.className = "conf-row";
    row.innerHTML = `
      <span class="conf-label">${escapeHtml(label)}${weight ? ` <span class="v2-weight">(${Math.round(weight * 100)}%)</span>` : ""}</span>
      <div class="conf-track"><div class="conf-fill conf-fill-${tone}" style="width:${pct}%"></div></div>
      <span class="conf-score">${cat.score.toFixed(1)}</span>
    `;
    holder.appendChild(row);
  });

  const riskEl = block.querySelector(".v2-risk");
  if (sc.risk_penalty > 0 && sc.risk_reasons && sc.risk_reasons.length) {
    riskEl.hidden = false;
    riskEl.textContent = `Risk penalty: -${sc.risk_penalty} — ${sc.risk_reasons.join(" ")}`;
  } else {
    riskEl.hidden = true;
  }
}

function fillDistribution(node, p) {
  const block = node.querySelector(".distribution-block");
  const dist = p.distribution;
  if (!dist || !dist.buckets || !dist.buckets.length) {
    block.hidden = true;
    return;
  }
  block.hidden = false;

  block.querySelector(".distribution-sub").textContent =
    `Actual outcomes over the last ${dist.gamesSampled} games`;

  const barsHolder = block.querySelector(".distribution-bars");
  barsHolder.innerHTML = "";
  const maxPct = Math.max(...dist.buckets.map((b) => b.pct), 1);
  dist.buckets.forEach((b) => {
    const col = document.createElement("div");
    col.className = "dist-bar-col";
    const heightPct = Math.max(4, (b.pct / maxPct) * 100);
    col.innerHTML = `
      <span class="dist-bar-pct">${b.pct}%</span>
      <div class="dist-bar-track"><div class="dist-bar-fill" style="height:${heightPct}%"></div></div>
      <span class="dist-bar-label">${b.value}</span>
    `;
    barsHolder.appendChild(col);
  });

  block.querySelector(".dist-split-over").style.width = `${dist.overPct}%`;
  block.querySelector(".dist-split-over-label").textContent = `Over: ${dist.overPct}%`;
  block.querySelector(".dist-split-under-label").textContent = `Under: ${dist.underPct}%`;

  const fairEl = block.querySelector(".dist-fair-odds");
  if (dist.fairOverOdds && dist.fairUnderOdds) {
    fairEl.textContent = `Sample-implied fair odds: Over ${dist.fairOverOdds} · Under ${dist.fairUnderOdds} — from these ${dist.gamesSampled} games, not a sportsbook line.`;
    fairEl.hidden = false;
  } else {
    fairEl.hidden = true;
  }
}

function fillPitchArsenal(node, p) {
  const block = node.querySelector(".arsenal-block");
  const pitches = p.pitchArsenal || [];
  if (!pitches.length) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  const holder = block.querySelector(".arsenal-card-grid");
  const starter = p.starterProfile || {};
  const bvp = p.bvpCard || {};
  const splitFallback = bvp.splitFallback || {};
  const colors = ["#00f58a", "#ffad18", "#7a7a7a", "#ff2768", "#35d980", "#ff681f", "#00f58a"];
  const val = (value, fallback = "—") => value === null || value === undefined || value === "" ? fallback : escapeHtml(String(value));
  const rate = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
  const avg = (value) => value === null || value === undefined || value === "" ? "—" : formatBattingAverage(value);
  const teamPitchRows = p.pitcherTeamPitchTypes || [];
  const canonicalPitch = (code) => ({ KC: "CU", FA: "FF" }[String(code || "").toUpperCase()] || String(code || "").toUpperCase());
  const isPitcherCard = p.isPitcherProp === true;
  const blockTitle = block.querySelector(".block-title");
  if (blockTitle) blockTitle.innerHTML = isPitcherCard ? "Lineup vs Pitch Arsenal" : `
    <span class="arsenal-monogram" aria-hidden="true">PA</span>
    <span class="arsenal-title-copy"><small>BVP &amp; PITCH ARSENAL</small><strong>STARTER BREAKDOWN</strong></span>
    <span class="arsenal-title-actions"><b>SZN</b><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m7 10 5 5 5-5"/></svg><i><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z"/><path d="M12 2c-2.8 3-2.8 7 0 10m0 0c2.8 3 2.8 7 0 10M2 12c3-2.8 7-2.8 10 0m0 0c3 2.8 7 2.8 10 0"/></svg></i></span>`;
  const pitcherId = starter.id || "";
  const pitcherPhoto = pitcherId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_160,q_auto:best/v1/people/${pitcherId}/headshot/silo/current`
    : "";
  const pitchGlyph = (index) => {
    const paths = [
      '<circle cx="12" cy="12" r="8"/><path d="M9 5c2 3 2 11 0 14M15 5c-2 3-2 11 0 14"/>',
      '<circle cx="12" cy="12" r="8"/><path d="m7 13 4-4 6 5"/>',
      '<circle cx="12" cy="12" r="8"/><path d="m8 8 8 8m0-8-8 8"/>',
      '<path d="M4 17C6 8 11 5 19 7M4 17c5 2 10 0 15-7"/>',
      '<circle cx="12" cy="12" r="8"/><path d="M8 16c2-7 6-7 8 0"/>',
      '<path d="M4 17c6-1 8-5 9-11m-4 8 4 3 5-8"/>',
      '<path d="M4 15c5 4 11 2 16-6M8 8l4 4 4-5"/>',
    ];
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[index % paths.length]}</svg>`;
  };
  const metricIcon = (kind) => ({
    era:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m12 12 6-6"/></svg>',
    whip:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 8-8"/><path d="M4 5v7h7"/><path d="M12 7v5l3 2"/></svg>',
    k:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 7v10m0-5 6-5m-6 5 6 5"/></svg>',
    bb:'<svg viewBox="0 0 24 24"><path d="M4 17h16M7 17c0-7 2-11 5-11s5 4 5 11"/><path d="M9 10h6"/></svg>',
  }[kind]);
  const pitchPills = pitches.slice(0, 5).map((pitch, index) => `
    <div class="starter-pitch-gauge" style="--pitch-color:${colors[index % colors.length]};--pitch-pct:${Math.max(0, Math.min(100, Number(pitch.pct) || 0))}">
      <span>${escapeHtml(pitch.name)}</span><div><b>${Number(pitch.pct).toFixed(0)}%</b></div>
    </div>
  `).join("");
  const visualPitches = pitches.slice(0, 5);
  const pitchVisual = `<div class="pitch-visual" aria-label="Pitch usage visualization">
    <div class="pitch-zone" aria-hidden="true"><i></i>${visualPitches.map((pitch, index) => {
      const usage = Math.max(0, Math.min(100, Number(pitch.pct) || 0));
      return `<span style="--pitch-color:${colors[index % colors.length]};--x:${20 + ((index * 31) % 63)}%;--y:${18 + ((index * 23) % 66)}%;--size:${Math.max(9, 12 + usage * .22)}px"></span>`;
    }).join("")}</div>
    <div class="pitch-visual-list">${visualPitches.map((pitch, index) => `<div><i style="--pitch-color:${colors[index % colors.length]}"></i><span>${escapeHtml(pitch.name)}</span><b>${Number(pitch.pct || 0).toFixed(0)}%</b><em>${Number.isFinite(Number(pitch.speed)) ? `${Number(pitch.speed).toFixed(1)} mph` : "usage"}</em><small><u style="width:${Math.max(3, Math.min(100, Number(pitch.pct) || 0))}%"></u></small></div>`).join("")}</div>
  </div>`;
  const hasBvp = Number(bvp.ab) > 0;
  const bvpTitle = hasBvp
    ? `CAREER VS ${escapeHtml(String(starter.name || "STARTER").split(" ").slice(-1)[0].toUpperCase())}`
    : `SEASON VS ${escapeHtml(splitFallback.hand || starter.hand || "?")}HP`;
  const bvpSummary = hasBvp
    ? `${bvp.hits || 0}-for-${bvp.ab} · ${bvp.pa || bvp.ab} PA`
    : `${val(splitFallback.pa, "0")} PA · handedness split`;
  const lowerStats = hasBvp
    ? [
        ["AVG", avg(bvp.avg)], ["HR", val(bvp.hr, "0")], ["RBI", val(bvp.rbi, "0")],
        ["BB", val(bvp.bb, "0")], ["K", val(bvp.k, "0")], ["OPS", avg(bvp.ops)],
      ]
    : [
        ["AVG", avg(splitFallback.avg)], ["OPS", avg(splitFallback.ops)], ["HR", val(splitFallback.hr, "0")],
        ["RBI", val(splitFallback.rbi, "0")], ["K%", rate(splitFallback.kPct)], ["PA", val(splitFallback.pa, "0")],
      ];
  const lowerGrid = lowerStats.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
  const pitchRows = pitches.map((pitch, index) => {
    if (isPitcherCard) {
      const team = teamPitchRows.find(row => canonicalPitch(row.pitch_type) === canonicalPitch(pitch.code));
      if (!team || !Number(team.pa)) return "";
      const score = Number(team.lineup_rank);
      const scoreClass = score >= 21 ? "arsenal-rank-struggle" : score <= 10 ? "arsenal-rank-handles" : "arsenal-rank-neutral";
      const sampleClass = team.thin_sample ? "pitch-sample-thin" : "";
      return `<tr>
        <td><i class="pitch-dot" style="--pitch-color:${colors[index % colors.length]}"></i>${escapeHtml(pitch.name)} <small>${Number(pitch.pct).toFixed(0)}%</small></td>
        <td data-label="PA" class="${sampleClass}" title="${team.thin_sample ? "Limited sample — use cautiously" : ""}">${val(team.pa)}</td>
        <td data-label="WHIFF%">${rate(team.whiff_pct)}</td>
        <td data-label="wOBA">${avg(team.woba)}</td>
        <td data-label="HARD-HIT%">${rate(team.hard_hit_pct)}</td>
        <td data-label="MLB RANK" class="arsenal-rank-cell ${scoreClass}">
          <span class="arsenal-rank-meter"><i style="width:${Number.isFinite(score) ? (score / 30) * 100 : 0}%"></i></span>
          <b>${Number.isFinite(score) ? score : "—"}</b>
        </td>
      </tr><tr class="arsenal-row-extra"><td colspan="6">AVG ${avg(team.avg)} · SLG ${avg(team.slg)} · K% ${rate(team.k_pct)}</td></tr>`;
    }
    const vs = pitch.batterVs || {};
    const kClass = Number(vs.kPct) >= 30 ? "arsenal-hot" : "";
    const sampleClass = Number(vs.pa) > 0 && Number(vs.pa) < 10 ? "pitch-sample-thin" : "";
    return `<tr style="--pitch-color:${colors[index % colors.length]}">
      <td><i class="pitch-row-icon">${pitchGlyph(index)}</i>${escapeHtml(pitch.name)}</td>
      <td data-label="FACED" class="${sampleClass}" title="${sampleClass ? "Limited sample — displayed for context only" : ""}">${val(vs.pa)}</td>
      <td data-label="USAGE">${rate(pitch.pct)}</td><td data-label="WHIFF%">${rate(vs.whiffPct)}</td><td data-label="AVG">${avg(vs.avg)}</td><td data-label="SLG">${avg(vs.slg)}</td>
      <td data-label="wOBA">${avg(vs.woba)}</td><td data-label="K%" class="${kClass}">${rate(vs.kPct)}</td>
    </tr>`;
  }).join("");

  if (isPitcherCard) {
    const source = teamPitchRows[0]?.lineup_source || "available hitters";
    const rankedRows = teamPitchRows.filter(row => Number.isFinite(Number(row.lineup_rank)));
    const best = rankedRows.sort((a, b) => Number(b.lineup_rank) - Number(a.lineup_rank))[0];
    const bestPitch = best && pitches.find(pitch => canonicalPitch(pitch.code) === canonicalPitch(best.pitch_type));
    const bestRank = Number(best?.lineup_rank);
    const pitcherFirst = String(starter.name || p.player || "The starter").split(" ")[0];
    const teamShort = String(p.pitcherTeamPitchLabel || "Opponent lineup").replace(/ lineup vs pitch type/i, "");
    const recommendation = best ? `
      <div class="arsenal-recommendation ${bestRank >= 21 ? "is-attack" : bestRank <= 10 ? "is-caution" : "is-neutral"}">
        <span class="arsenal-rec-icon">${bestRank >= 21 ? "✓" : bestRank <= 10 ? "!" : "↗"}</span>
        <div><strong>${bestRank >= 21 ? `${escapeHtml(pitcherFirst)} should attack with ${escapeHtml(bestPitch?.name || best.pitch_name)}` : bestRank <= 10 ? `${escapeHtml(teamShort)} handles this arsenal well` : `${escapeHtml(pitcherFirst)}'s best relative option: ${escapeHtml(bestPitch?.name || best.pitch_name)}`}</strong>
        <p>${escapeHtml(teamShort)} ranks #${bestRank}/30 against this pitch · ${avg(best.woba)} wOBA · ${rate(best.whiff_pct)} whiff${bestPitch ? ` · ${Number(bestPitch.pct).toFixed(0)}% usage` : ""}</p></div>
      </div>` : `<div class="arsenal-recommendation is-neutral"><span class="arsenal-rec-icon">i</span><div><strong>League rank unavailable</strong><p>The official pitch results below are still shown without manufacturing a rank.</p></div></div>`;
    holder.innerHTML = `
      <article class="pitch-type-card pitcher-team-pitch-card">
        <div class="pitch-type-head"><div><p class="arsenal-eyebrow">${escapeHtml(`${teamShort} vs pitch types`)}</p></div><span>SZN</span></div>
        <p class="pitch-rank-explainer">How this lineup handles each pitch. <b>1 handles</b> · <b>30 struggles</b>.</p>
        ${pitchVisual}
        ${recommendation}
        <div class="pitch-rank-scale"><span>1 HANDLES</span><i></i><span>30 STRUGGLES</span></div>
        <div class="pitch-type-scroll"><table><thead><tr><th>PITCH</th><th>KD</th><th>WHIFF%</th><th>wOBA</th><th>HARD-HIT%</th><th>LINEUP RANK</th></tr></thead><tbody>${pitchRows}</tbody></table></div>
        <p class="pitch-type-note">PA and performance use the posted lineup when available, otherwise the active roster. Rank compares the team's full season against all 30 MLB teams using wOBA, whiff avoidance, K avoidance and hard-hit rate. Pitches without a reliable sample are omitted.</p>
      </article>`;
    return;
  }

  holder.innerHTML = `
    <article class="starter-profile-card">
      <p class="arsenal-eyebrow">TONIGHT'S STARTER</p>
      <div class="starter-identity">
        <div class="starter-photo">${pitcherPhoto ? `<img src="${pitcherPhoto}" alt="" onerror="this.style.display='none'">` : "⚾"}</div>
        <div><h4>${val(starter.name, "Tonight's starter")} <span>${val(starter.hand)}HP</span></h4>
        <p>${starter.jerseyNumber ? `#${val(starter.jerseyNumber)} <i></i>` : ""}${starter.gamesStarted ? `${val(starter.gamesStarted)} GS` : "Current season"}${starter.wins !== undefined && starter.losses !== undefined ? ` <i></i> ${val(starter.wins)}-${val(starter.losses)}` : ""}</p></div>
      </div>
      <div class="starter-pitch-gauges">${pitchPills}</div>
      ${pitchVisual}
      <div class="starter-metrics">
        <div>${metricIcon("era")}<span>ERA</span><strong>${val(starter.era)}</strong></div>
        <div>${metricIcon("whip")}<span>WHIP</span><strong>${val(starter.whip)}</strong></div>
        <div>${metricIcon("k")}<span>K/9</span><strong>${val(starter.kPer9)}</strong></div>
        <div>${metricIcon("bb")}<span>BB/9</span><strong>${val(starter.bbPer9)}</strong></div>
      </div>
      <div class="starter-bvp-head"><b>${bvpTitle}</b><span>${bvpSummary}</span></div>
      <div class="starter-bvp-grid">${lowerGrid}</div>

    </article>
    <article class="pitch-type-card">
      <div class="pitch-breakdown-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13h4l2-8 4 14 3-10 2 4h5"/></svg><strong>Pitch Arsenal</strong></div>
      <div class="pitch-type-head"><div><p class="arsenal-eyebrow">${escapeHtml(String(p.player || "BATTER").split(" ").slice(-1)[0].toUpperCase())} VS PITCH TYPE</p></div></div>
      <div class="pitch-type-scroll"><table><thead><tr><th>PITCH TYPE</th><th>THROWN</th><th>USAGE</th><th>WHIFF%</th><th>AVG</th><th>SLG</th><th>wOBA</th><th>K%</th></tr></thead><tbody>${pitchRows}</tbody></table></div>
    </article>`;
}

function fillLineupStrip(node, p) {
  const shell = node.querySelector(".lineup-strip-shell");
  if (!shell || !p.teamInsightsParams) return;
  shell.hidden = false;
  prefetchTeamInsights(p.teamInsightsParams);
  shell.innerHTML = `<div class="lineup-strip-head"><span>Projected lineup</span><small>Loading batting order…</small></div><div class="lineup-strip is-loading">${Array.from({ length: 9 }, (_, i) => `<i style="--i:${i}"></i>`).join("")}</div>`;
  requestTeamInsights(p.teamInsightsParams, "summary").then(data => {
    if (!shell.isConnected) return;
    const rows = (data.battingOrder || []).slice(0, 9);
    if (!rows.length) { shell.hidden = true; return; }
    shell.innerHTML = `<div class="lineup-strip-head"><span>${data.lineupConfirmed ? "Confirmed lineup" : "Projected lineup"}</span><small>${rows.length} hitters · batting order</small></div><div class="lineup-strip">${rows.map(row => `<div class="lineup-player"><b>${row.order}</b><img src="https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${row.id}/headshot/silo/current" alt="${escapeHtml(row.name)}" loading="lazy"><span>${escapeHtml(String(row.name || "").split(" ").slice(-1)[0])}</span><small>${escapeHtml(row.position || "")}</small></div>`).join("")}</div>`;
  }).catch(() => { if (shell.isConnected) shell.hidden = true; });
}

function fillSplitFactor(node, p) {
  const split = p.split || {};
  const cells = node.querySelectorAll(".split-cell");
  cells.forEach(cell => cell.classList.remove("tonight-split"));
  if (p.isHome === true) cells[1]?.classList.add("tonight-split");
  if (p.isHome === false) cells[0]?.classList.add("tonight-split");
  node.querySelector(".road-avg").textContent = split.roadAvg != null ? `${split.roadAvg}` : "—";
  node.querySelector(".road-note").textContent = split.roadOverRate != null ? `📈 ${split.roadOverRate}% over rate` : "";
  node.querySelector(".home-avg").textContent = split.homeAvg != null ? `${split.homeAvg}` : "—";
  node.querySelector(".home-note").textContent = split.homeOverRate != null ? `📈 ${split.homeOverRate}% over rate` : "";
  const tonightVenue = p.isHome === true ? "Home" : p.isHome === false ? "Road" : "";
  node.querySelector(".split-callout").textContent = tonightVenue ? `${tonightVenue} is tonight’s active split.` : "";
  node.querySelector(".volume-note").textContent = split.volume ? `📊 ${split.volume}` : "";
}

function formatMatchupDetail(value) {
  return String(value || "")
    .replace(/(-?\d+\.\d{3,})(?=%)/g, number => `${Number(number).toFixed(1)}`)
    .replace(/(-?\d*\.\d{4,})(?=\s*(?:AVG|OPS|SLG|wOBA|xwOBA)\b)/gi, number => {
      const fixed = Number(number).toFixed(3);
      return Math.abs(Number(number)) < 1 ? fixed.replace(/^(-?)0\./, "$1.") : fixed;
    })
    .replace(/(-?\d+\.\d{4,})/g, number => `${Number(number).toFixed(2)}`)
    .replace(/\b(\d+)\.00(?=\s+(?:innings?|outs?)\b)/gi, "$1");
}

const MATCHUP_GAUGE_CIRCUMFERENCE = 263.89;

// The gauge is built while its tab panel is still hidden (report-tabs.js
// moves it into a `hidden` panel right after) -- a CSS transition started on
// a hidden/disconnected element never plays, so a fill-on-build call here
// would look instant with no animation once the user actually opens the
// Matchup tab. Set the final state immediately (nothing to see yet) and let
// animateMatchupGaugeFill() do the real animated reveal once the panel with
// this card in it actually becomes visible (wired via the 'rr:panel-shown'
// event dispatched from report-tabs.js).
function setMatchupGaugeInstant(scoreCard, score) {
  const fillEl = scoreCard.querySelector(".matchup-gauge-fill");
  const valueEl = scoreCard.querySelector(".matchup-score-value");
  if (!fillEl || !valueEl) return;
  const clamped = Math.max(0, Math.min(100, score));
  const arcLength = MATCHUP_GAUGE_CIRCUMFERENCE * (clamped / 100);
  fillEl.style.transition = "none";
  fillEl.style.strokeDasharray = `${arcLength} ${MATCHUP_GAUGE_CIRCUMFERENCE}`;
  valueEl.textContent = `${Math.round(clamped)}`;
  scoreCard.dataset.score = String(clamped);
}

// Animates the gauge ring's stroke-dasharray and counts the center number
// up to the target score, mirroring the spring/count-up feel of the
// referenced gauge component without pulling in framer-motion for one ring.
function animateMatchupGaugeFill(scoreCard) {
  const fillEl = scoreCard.querySelector(".matchup-gauge-fill");
  const valueEl = scoreCard.querySelector(".matchup-score-value");
  const clamped = Number(scoreCard.dataset.score);
  if (!fillEl || !valueEl || !Number.isFinite(clamped)) return;
  const arcLength = MATCHUP_GAUGE_CIRCUMFERENCE * (clamped / 100);
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    fillEl.style.transition = "none";
    fillEl.style.strokeDasharray = `${arcLength} ${MATCHUP_GAUGE_CIRCUMFERENCE}`;
    valueEl.textContent = `${Math.round(clamped)}`;
    return;
  }
  fillEl.style.transition = "none";
  fillEl.style.strokeDasharray = `0 ${MATCHUP_GAUGE_CIRCUMFERENCE}`;
  valueEl.textContent = "0";
  // Force a style/layout flush between the "0" and target states so the
  // browser has something committed to transition FROM -- two rAFs alone
  // aren't always enough once a style write follows immediately after an
  // element was just unhidden in the same tick.
  void fillEl.getBoundingClientRect();
  requestAnimationFrame(() => {
    fillEl.style.transition = "";
    fillEl.style.strokeDasharray = `${arcLength} ${MATCHUP_GAUGE_CIRCUMFERENCE}`;
  });
  const duration = 1000;
  const start = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    valueEl.textContent = `${Math.round(clamped * eased)}`;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

document.addEventListener("rr:panel-shown", (event) => {
  if (event.detail?.key !== "matchup") return;
  const scoreCard = event.target.querySelector(".matchup-score-card");
  if (scoreCard && !scoreCard.hidden) animateMatchupGaugeFill(scoreCard);
});

function fillMatchup(node, p) {
  const m = p.matchup || {};
  const scoreCard = node.querySelector(".matchup-score-card");
  const score = matchupNumber(p.matchupScore);
  if (scoreCard && Number.isFinite(score)) {
    const fallbackLabel = score >= 85 ? "Elite Matchup" : score >= 75 ? "Strong Matchup" : score >= 65 ? "Favorable" : score >= 55 ? "Slight Edge" : score >= 45 ? "Neutral" : score >= 35 ? "Caution" : "Unfavorable";
    const label = p.matchupLabel || fallbackLabel;
    const tone = score >= 85 ? "elite" : score >= 75 ? "strong" : score >= 65 ? "favorable" : score >= 55 ? "slight" : score >= 45 ? "neutral" : score >= 35 ? "caution" : "unfavorable";
    scoreCard.hidden = false;
    scoreCard.dataset.tone = tone;
    scoreCard.querySelector(".matchup-score-label").textContent = [label, `${Math.round((p.matchupCoverage || 0) * 100)}% data coverage`, matchupUpdatedText(p.matchupContext)].filter(Boolean).join(' · ');
    scoreCard.title = `${p.matchupContext?.source === 'board' ? 'Rating from the latest published board update.' : 'Live research rating.'} Matchup score out of 100, not a win probability.`;
    setMatchupGaugeInstant(scoreCard, score);
    const factors = (p.matchupFactors || []).map(f => {
      const impact = Number(f.impact || 0);
      const signed = `${impact > 0 ? "+" : ""}${impact}`;
      const factorScore = Number(f.score);
      const fill = Number.isFinite(factorScore) ? Math.max(0, Math.min(100, factorScore)) : Math.max(0, Math.min(100, 50 + impact * 4));
      const factorTone = impact > 0 ? "positive" : impact < 0 ? "negative" : "neutral";
      return `<div class="matchup-factor ${factorTone}"><div class="matchup-factor-copy"><b>${escapeHtml(f.name || "Factor")}</b><strong>${signed}</strong><small>${escapeHtml(formatMatchupDetail(f.detail || "Unavailable"))}</small></div><div class="factor-track"><i style="--factor-fill:${fill}%"></i></div></div>`;
    }).join("");
    scoreCard.querySelector(".matchup-score-factors").innerHTML = factors;
  } else if (scoreCard) {
    scoreCard.hidden = true;
  }
  node.querySelector(".matchup-opp").textContent = m.opponent ? `⚔️ Opponent: ${m.opponent}` : "";
  node.querySelector(".matchup-pitcher").textContent = m.pitcher ? `⚾ ${m.pitcher}` : "";

  const bvpEl = node.querySelector(".matchup-bvp");
  if (m.bvp) {
    bvpEl.innerHTML = `<b>🤝 BvP:</b> ${escapeHtml(m.bvp)}${m.bvpNote ? "<br>" + escapeHtml(m.bvpNote) : ""}`;
    bvpEl.hidden = false;
  } else {
    bvpEl.hidden = true;
  }

  node.querySelector(".matchup-leash").textContent = m.leash ? `🪢 ${m.leash}` : "";
  node.querySelector(".matchup-handedness").textContent = m.handedness ? `🖐️ ${m.handedness}` : "";
  node.querySelector(".matchup-lineup").textContent = m.lineup ? `📋 ${m.lineup}` : "";
  node.querySelector(".matchup-bullpen").textContent = m.bullpen ? `🛡️ ${m.bullpen}` : "";

  const teamBtn = node.querySelector(".team-insights-btn");
  if (p.teamInsightsParams) {
    teamBtn.hidden = false;
    // teamInsightsTeamName always names whichever team teamInsightsParams.teamId
    // points at -- the opposing lineup for a pitcher prop, this player's own
    // team for a batter prop. Don't assume it's m.opponent either way.
    teamBtn.textContent = "👀 View Batting Order & Pitch Arsenal →";
    teamBtn.onclick = () => openTeamModal(p.teamInsightsParams, p.teamInsightsTeamName || "");
    // Start the accurate roster/Statcast request after the main card is
    // visible. By the time a user reaches this button, much or all of the
    // modal data is usually ready. The promise is reused on click.
    const warmInsights = () => prefetchTeamInsights(p.teamInsightsParams);
    teamBtn.addEventListener("pointerenter", warmInsights, { once: true });
    teamBtn.addEventListener("focus", warmInsights, { once: true });
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(warmInsights, { timeout: 1200 });
    } else {
      setTimeout(warmInsights, 500);
    }
  } else {
    teamBtn.hidden = true;
  }
}

function fillNarrative(node, p) {
  node.querySelector(".narrative-text").textContent = p.narrative ? `🏆 ${p.narrative}` : "";
}

function fillPerformance(node, p) {
  node.querySelector(".perf-season").textContent = p.seasonLine ? `📈 ${p.seasonLine}` : "";
}

function fillVsMatchup(node, p) {
  const vs = p.vsMatchup || {};

  const h2hEl = node.querySelector(".vs-h2h");
  if (vs.h2h) {
    h2hEl.innerHTML = `<b>🔄 H2H:</b> ${escapeHtml(vs.h2h)}${vs.h2hNote ? "<br>" + escapeHtml(vs.h2hNote) : ""}`;
    h2hEl.hidden = false;
  } else {
    h2hEl.hidden = true;
  }

  node.querySelector(".vs-career").textContent = vs.career ? `📊 ${vs.career}` : "";
  node.querySelector(".vs-season").textContent = vs.season ? `📈 ${vs.season}` : "";
}

function fillEnvRisk(node, p) {
  node.querySelector(".env-text").textContent = p.environment ? `🌤️ ${p.environment}` : "";
  node.querySelector(".env-wind").textContent = p.wind ? `💨 ${p.wind}` : "";
  const runsEl = node.querySelector(".env-runs");
  if (p.runEnvironment && p.runEnvironment.projected_runs != null) {
    const re = p.runEnvironment;
    const diff = re.projected_runs - re.season_runs_pg;
    const dirWord = diff >= 0.3 ? "above" : diff <= -0.3 ? "below" : "in line with";
    runsEl.textContent = `🏟️ Team run environment: ${re.projected_runs} projected runs tonight (season avg ${re.season_runs_pg}) — ${dirWord} their own baseline vs this opposing pitching (${re.opp_blended_era} blended ERA).`;
    runsEl.hidden = false;
  } else {
    runsEl.hidden = true;
  }
  const list = node.querySelector(".risk-list");
  const signals = p.negativeSignals !== undefined ? p.negativeSignals : p.risk;
  const items = signals && signals.length ? signals : ["No major red flags in available data."];
  items.forEach((line) => {
    const li = document.createElement("li");
    li.textContent = line.replace(/\*\*(.+?)\*\*/g, "$1"); // strip Discord-style **bold**
    list.appendChild(li);
  });
}

function fillProjection(node, p) {
  const section = node.querySelector(".projection-block");
  const hasTrend = !!p.trend;
  const fc = p.floorCeiling;
  const hasFc = fc && fc.median != null;
  if (!hasTrend && !hasFc && !p.paDistribution) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const trendEl = section.querySelector(".trend-badge");
  if (hasTrend) {
    const t = p.trend;
    const cls = t === "HOT" ? "trend-hot" : t === "COLD" ? "trend-cold" : t === "WARM" || t === "HEATING UP" ? "trend-warm" : t === "COOLING" ? "trend-cooling" : "trend-neutral";
    const trendEmoji = t === "HOT" ? "🔥 " : t === "COLD" ? "❄️ " : t === "WARM" || t === "HEATING UP" ? "🌡️ " : t === "COOLING" ? "🧊 " : "";
    trendEl.textContent = trendEmoji + t.replace("_", " ");
    trendEl.className = `trend-badge ${cls}`;
    trendEl.hidden = false;
  } else {
    trendEl.hidden = true;
  }

  section.querySelector(".fmc-floor").textContent = hasFc ? fc.floor : "—";
  section.querySelector(".fmc-median").textContent = hasFc ? fc.median : "—";
  section.querySelector(".fmc-ceiling").textContent = hasFc ? fc.ceiling : "—";

  const paWrap = section.querySelector(".pa-dist-wrap");
  if (p.paDistribution && p.paDistribution.buckets && p.paDistribution.buckets.length) {
    const pa = p.paDistribution;
    paWrap.hidden = false;
    paWrap.querySelector(".pa-dist-label").textContent = `Real plate-appearance counts, last ${pa.games_sampled} games — avg ${pa.avg_pa} PA/game.`;
    const barsEl = paWrap.querySelector(".pa-dist-bars");
    barsEl.innerHTML = "";
    pa.buckets.forEach((b) => {
      const row = document.createElement("div");
      row.className = "pa-bar-row";
      row.innerHTML = `
        <span class="pa-bar-label">${escapeHtml(b.pa)} PA</span>
        <div class="pa-bar-track"><div class="pa-bar-fill" style="width:${b.pct}%"></div></div>
        <span class="pa-bar-pct">${b.pct}%</span>
      `;
      barsEl.appendChild(row);
    });
  } else {
    paWrap.hidden = true;
  }
}

function fillBiggestEdgesRisks(node, p) {
  const section = node.querySelector(".biggest-grid");
  const edges = p.biggestEdges || [];
  const risks = p.biggestRisks || [];
  if (!edges.length && !risks.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;

  const edgesList = section.querySelector(".edges-list");
  edgesList.innerHTML = "";
  if (edges.length) {
    edges.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      edgesList.appendChild(li);
    });
  } else {
    edgesList.innerHTML = `<li class="tt-nodata-inline">No standout edges beyond baseline form.</li>`;
  }

  const risksList = section.querySelector(".risks-top-list");
  risksList.innerHTML = "";
  if (risks.length) {
    risks.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line.replace(/\*\*(.+?)\*\*/g, "$1");
      risksList.appendChild(li);
    });
  } else {
    risksList.innerHTML = `<li class="tt-nodata-inline">No major red flags in available data.</li>`;
  }
}

function fillModelConfirm(node, p) {
  node.querySelector(".model-confirm-pill").textContent = "Model Confirms";
  node.querySelector(".model-confirm-detail").textContent = p.modelConfirm || "";
  node.querySelector(".report-timestamp").textContent = formatDate(p.date);
}

/* ---------- Animated fills ---------- */

function countUpScoreNum(node, score) {
  const el = node.querySelector(".score-num");
  const target = Number(score) || 0;
  const start = performance.now();
  const duration = 900;
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(target * eased);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  }
  requestAnimationFrame(tick);
}

function fillHitRateBars(node, rates) {
  const order = ["l5", "l10", "l20"];
  const rows = node.querySelectorAll(".hr-row");
  rows.forEach((row, i) => {
    const key = order[i];
    const val = Number(rates[key]) || 0;
    const fill = row.querySelector(".hr-fill");
    const pctLabel = row.querySelector(".hr-pct");
    pctLabel.textContent = `${val}%`;
    requestAnimationFrame(() => {
      fill.style.width = `${val}%`;
    });
  });
}

function fillSparkline(node, entries, line) {
  const holder = node.querySelector("#sparkline-holder");
  holder.innerHTML = "";
  if (!entries.length) return;

  // Static demo data still ships as plain numbers — normalize both shapes.
  const games = entries.map((e) => (typeof e === "object" && e !== null ? e : { value: e }));
  const max = Math.max(...games.map((g) => g.value), 1);

  games.forEach((g) => {
    const col = document.createElement("div");
    col.className = "spark-col";

    const track = document.createElement("div");
    track.className = "spark-bar-track";

    const bar = document.createElement("div");
    bar.className = "spark-bar";
    // Under the line = red (a miss for the Over), at/above = normal teal.
    if (typeof line === "number" && g.value < line) bar.classList.add("spark-bar-under");

    const valEl = document.createElement("span");
    valEl.className = "spark-val";
    valEl.textContent = g.value;
    bar.appendChild(valEl);
    track.appendChild(bar);
    col.appendChild(track);

    if (g.opponent || g.date) {
      const label = document.createElement("span");
      label.className = "spark-label";
      label.innerHTML = [
        g.opponent ? `<span class="spark-opp">${escapeHtml(g.opponent)}</span>` : "",
        g.date ? `<span class="spark-date">${escapeHtml(g.date)}</span>` : "",
      ].filter(Boolean).join("<br>");
      col.appendChild(label);
    }

    holder.appendChild(col);
    const trackPx = 90;
    const heightPx = Math.max(24, (g.value / max) * trackPx);
    requestAnimationFrame(() => {
      bar.style.height = `${heightPx}px`;
    });
  });

  // Dashed marker for the actual line being researched (e.g. 0.5, 1.5) —
  // positioned against the same fixed 90px track the bars animate within.
  if (typeof line === "number") {
    const trackPx = 90;
    const topPx = Math.max(0, Math.min(trackPx, trackPx - (line / max) * trackPx));
    const marker = document.createElement("div");
    marker.className = "spark-line-marker";
    marker.style.top = `${topPx}px`;
    const tag = document.createElement("span");
    tag.className = "spark-line-tag";
    tag.textContent = line;
    marker.appendChild(tag);
    holder.appendChild(marker);
  }
}

/* ---------- Saved tab ---------- */

function wireSavedToolbar() {
  els.clearSavedBtn.addEventListener("click", () => {
    if (state.savedProps.size === 0) return;
    if (!confirm("Clear all saved props? This can't be undone.")) return;
    state.savedProps.clear();
    state.parlaySelection.clear();
    persistSaved();
    updateSavedCount();
    renderSavedGrid();
    updateParlayBar();
    hideParlayView();
    showToast("Cleared all saved props", "warn");
  });

  els.parlayClearBtn.addEventListener("click", () => {
    state.parlaySelection.clear();
    renderSavedGrid();
    updateParlayBar();
    hideParlayView();
  });

  els.parlayCompareBtn.addEventListener("click", () => {
    if (state.parlaySelection.size < 2) return;
    renderParlayView();
  });
}

function getSavedProps() {
  return [...state.savedProps.values()];
}

function fillPitcherLineupProfile(node, p) {
  const block = node.querySelector(".pitcher-lineup-profile");
  const profile = p.opponentOffense || {};
  const metrics = profile.metrics || [];
  if (!p.isPitcherProp || !metrics.length) {
    block.hidden = true;
    return;
  }

  const keyByMarket = {
    "Strikeouts (Pitcher)": "k_pct",
    "Walks Allowed": "bb_pct",
    "Hits Allowed": "avg",
    "Earned Runs Allowed": "runs_pg",
    "Fantasy Score (Pitcher)": "runs_pg",
  };
  const relevantKey = keyByMarket[p.betType] || "";
  const totals = profile.totals || {};
  const handLabel = profile.pitcher_hand === "L" ? "LHP" : "RHP";
  const number = (value) => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : "—";
  block.hidden = false;
  block.querySelector(".lineup-profile-team").textContent = `${profile.team_name || p.matchup?.opponent || "Opponent"} team baseline`;
  block.querySelector(".lineup-profile-source").textContent = `FULL TEAM · SEASON VS ${handLabel}`;
  block.querySelector(".lineup-profile-rows").innerHTML = metrics.map((metric) => {
    const rank = Math.max(1, Math.min(30, Number(metric.rank) || 30));
    const relevant = metric.key === relevantKey;
    return `<div class="lineup-profile-row edge-${escapeHtml(metric.edge || "neutral")}${relevant ? " is-relevant" : ""}">
      <div class="lineup-metric"><b>${escapeHtml(metric.label || "")}</b><span>#${rank}/30${relevant ? " · key" : ""}</span></div>
      <div class="lineup-rank-track"><i style="width:${(rank / 30) * 100}%"></i></div>
      <div class="lineup-result"><strong>${escapeHtml(metric.display || "—")}</strong><span>${escapeHtml(metric.edge_label || "NEUTRAL")}</span></div>
    </div>`;
  }).join("");
  block.querySelector(".lineup-profile-note").textContent = `vs ${handLabel} · ${number(totals.hits)} H / ${number(totals.at_bats)} AB · ${number(totals.strikeouts)} K · ${number(totals.walks)} BB · ${number(totals.plate_appearances)} PA`;
}

/* ---------- Manual PrizePicks prop builder ---------- */

function setManualBetSlipOpen(open) {
  if (open) renderManualBetSlip();
  window.dispatchEvent(new CustomEvent("vortex:prop-builder-open", { detail: { open } }));
  els.betSlipDrawer?.setAttribute("aria-hidden", "true");
  els.headerBuilderTrigger?.setAttribute("aria-expanded", String(open));
}

// prizepicks_export_core.py matches every Finder league on its live PrizePicks
// board (its LEAGUE_IDS): NBA and college football included.
const SLIP_EXPORT_LEAGUES = new Set(["MLB", "NFL", "NBA", "WNBA", "CFB", "NHL", "SOCCER", "TENNIS", "CS2"]);
const slipLeague = (prop) => String(prop.sport || "MLB").toUpperCase();
const slipModifier = (prop) => String(prop.modifier || prop.oddsType || "standard").toLowerCase();
// Goblin and Demon lines are More-only on PrizePicks.
const slipMoreOnly = (prop) => ["goblin", "demon"].includes(slipModifier(prop));
// A research score was worked out for the side the prop was saved on; once
// the pick is flipped in the Pick Builder that score no longer applies.
const slipScore = (prop) => (prop.scoredSide && prop.scoredSide !== prop.side ? "—" : String(prop.score ?? "—"));
const slipTeamLogo = (prop) => prop.teamLogo
  || (prop.teamId && slipLeague(prop) === "MLB" ? `https://www.mlbstatic.com/team-logos/${Number(prop.teamId)}.svg` : "");

function manualSlipLegPayload(prop) {
  return {
    league: slipLeague(prop),
    player: prop.player,
    // Finder picks carry PrizePicks' own stat name; the label is for display.
    stat: prop.exportStat || prop.betType,
    line: prop.line,
    side: String(prop.side || "over").toLowerCase() === "under" ? "under" : "over",
    // When PrizePicks has moved the line, its current line in the same tier
    // (standard / goblin / demon) is used first.
    modifier: slipModifier(prop),
  };
}

function manualBetSlipStatus(legs) {
  const count = legs.length;
  const blocked = [...new Set(legs.map(slipLeague).filter((league) => !SLIP_EXPORT_LEAGUES.has(league)))];
  if (count === 0) return "Add at least 2 props to export.";
  if (blocked.length) return `PrizePicks export doesn't cover ${blocked.join(", ")} picks yet. Remove them to export.`;
  if (count < 2) return "Add 1 more prop to export.";
  if (count > 6) return "Remove legs until 6 remain.";
  return `${count}-leg slip ready to verify.`;
}

function manualBetSlipCanExport(legs) {
  return legs.length >= 2 && legs.length <= 6 && legs.every((prop) => SLIP_EXPORT_LEAGUES.has(slipLeague(prop)));
}

// True only while the live PrizePicks check is running. Every view reads it
// from here, so a redraw in the middle of an export (the Finder refreshing
// prices, the dropdown opening) can't flip the buttons back early.
let manualSlipExporting = false;
const MANUAL_SLIP_EXPORT_TIMEOUT_MS = 30000;

function syncManualBetSlipUi({ status = "" } = {}) {
  const legs = getSavedProps();
  const detail = {
    legs: legs.map((prop) => ({
      id: String(prop.id),
      player: String(prop.player || "Player"),
      side: String(prop.side || "Over"),
      line: String(prop.line ?? "—"),
      stat: String(prop.betType || "Prop"),
      team: String(prop.team || prop.sport || "MLB"),
      score: slipScore(prop),
      headshot: prop.headshot ? String(prop.headshot).replace("/headshot/67/current", "/headshot/silo/current") : "",
      // Pick Builder (src/PickBuilder.jsx) and the Finder's stars.
      sport: slipLeague(prop),
      finderId: String(prop.finderId || ""),
      teamLogo: slipTeamLogo(prop),
      startsAt: String(prop.startsAt || ""),
      modifier: slipModifier(prop),
      apps: (Array.isArray(prop.apps) ? prop.apps : []).map(({ key, name, over, under }) => ({ key, name, over, under })),
      exportable: SLIP_EXPORT_LEAGUES.has(slipLeague(prop)),
    })),
    status: status || els.betSlipStatus?.textContent || manualBetSlipStatus(legs),
    canExport: manualBetSlipCanExport(legs),
    busy: manualSlipExporting,
    // The PrizePicks link for these exact picks, once one has been made.
    link: freshManualSlipLink(legs),
  };
  window.dispatchEvent(new CustomEvent("vortex:prop-builder-sync", { detail }));
}

function savedPropKey(id) {
  return [...state.savedProps.keys()].find((key) => String(key) === String(id));
}

// Adds a pick on the given side, or moves a saved one to it. The Finder's
// stars and the Pick Builder's Over/Under toggle both come through here, so
// they write to the same list as every other "Add to My Slip".
function setManualBetSlipPick(prop, side) {
  if (!prop?.id) return;
  const pickSide = String(side).toLowerCase() === "under" ? "Under" : "Over";
  const storedKey = savedPropKey(prop.id);
  const saved = storedKey === undefined ? null : state.savedProps.get(storedKey);
  if (pickSide === "Under" && slipMoreOnly(saved || prop)) {
    showToast("Goblin and Demon lines are More only on PrizePicks.", "warn");
    return;
  }
  if (saved) {
    if (saved.side === pickSide) return;
    if (saved.score != null && !saved.scoredSide) saved.scoredSide = saved.side;
    saved.side = pickSide;
    showToast(`Switched to ${pickSide}`, "default", `${saved.player} · ${pickSide} ${saved.line} ${saved.betType}`);
  } else {
    if (state.savedProps.size >= 6) {
      showToast("PrizePicks allows up to 6 legs. Remove one from the builder first.", "warn");
      return;
    }
    state.savedProps.set(prop.id, { ...prop, side: pickSide });
    showToast("Added to Pick Builder", "default", `${prop.player} · ${pickSide} ${prop.line} ${prop.betType}`);
  }
  persistSaved();
  updateSavedCount();
  if (state.currentTab === "saved") renderSavedGrid();
  const reportButton = els.reportWrap.querySelector(".save-btn");
  if (reportButton && currentResearchProp) syncSaveButton(reportButton, currentResearchProp.id);
}

// The Finder re-sends its current prices and start times for saved picks
// whenever its board loads, so the Pick Builder's odds are not left at
// whatever they were when the pick was starred.
function refreshManualBetSlipPicks(updates) {
  let changed = false;
  (Array.isArray(updates) ? updates : []).forEach((update) => {
    const storedKey = savedPropKey(update?.id);
    if (storedKey === undefined) return;
    const saved = state.savedProps.get(storedKey);
    ["apps", "startsAt", "teamLogo", "headshot"].forEach((field) => {
      if (update[field] === undefined || JSON.stringify(saved[field]) === JSON.stringify(update[field])) return;
      saved[field] = update[field];
      changed = true;
    });
  });
  if (!changed) return;
  persistSaved();
  renderManualBetSlip();
}

function removeManualBetSlipLeg(id) {
  const storedKey = [...state.savedProps.keys()].find((key) => String(key) === String(id));
  if (storedKey === undefined) return;
  const prop = state.savedProps.get(storedKey);
  state.savedProps.delete(storedKey);
  state.parlaySelection.delete(storedKey);
  persistSaved();
  updateSavedCount();
  if (state.currentTab === "saved") renderSavedGrid();
  const reportButton = els.reportWrap.querySelector(".save-btn");
  if (reportButton && currentResearchProp) syncSaveButton(reportButton, currentResearchProp.id);
  showToast(`Removed ${prop?.player || "prop"} from the builder`, "warn");
  if (state.savedProps.size === 0) setManualBetSlipOpen(false);
}

function renderManualBetSlip() {
  if (!els.betSlipDrawer) return;
  const legs = getSavedProps();
  const count = legs.length;
  if (els.headerBuilderCount) els.headerBuilderCount.textContent = count;
  els.betSlipHeadline.textContent = `${count} of 6 leg${count === 1 ? "" : "s"}`;
  els.betSlipEmpty.hidden = count > 0;
  els.betSlipLegs.hidden = count === 0;
  els.betSlipClear.disabled = count === 0;
  els.betSlipExport.disabled = manualSlipExporting || !manualBetSlipCanExport(legs);
  if (!manualSlipExporting) {
    els.betSlipStatus.textContent = manualBetSlipStatus(legs);
    els.betSlipExport.textContent = freshManualSlipLink(legs) ? "Open in PrizePicks" : "Export to PrizePicks";
  }
  els.betSlipLegs.innerHTML = legs.map((prop, index) => `
    <article class="bet-slip-leg" style="--slip-delay:${index * 45}ms">
      <span class="bet-slip-rank">${index + 1}</span>
      <div class="bet-slip-avatar">${avatarHtml(prop, "sm")}</div>
      <div class="bet-slip-copy"><strong>${escapeHtml(prop.player)}</strong><span>${escapeHtml(prop.side)} ${escapeHtml(String(prop.line))} ${escapeHtml(prop.betType)}</span><small>${escapeHtml(prop.team || prop.sport || "MLB")} · Score ${escapeHtml(slipScore(prop))}</small></div>
      <button type="button" class="bet-slip-remove" data-slip-remove="${escapeHtml(String(prop.id))}" aria-label="Remove ${escapeHtml(prop.player)}">×</button>
    </article>`).join("");
  els.betSlipLegs.querySelectorAll("[data-slip-remove]").forEach((button) => button.addEventListener("click", () => {
    removeManualBetSlipLeg(button.dataset.slipRemove);
  }));
  syncManualBetSlipUi();
}

// The export goes out on PrizePicks' current lines, so a pick whose line (or
// tier) PrizePicks has moved since it was saved follows it here too.
function applyExportedLines(legs, matches) {
  const changed = [];
  let updated = false;
  (Array.isArray(matches) ? matches : []).forEach((match) => {
    const prop = legs[match.leg];
    const line = Number(match.line);
    const modifier = String(match.oddsType || "standard").toLowerCase();
    if (!prop || !Number.isFinite(line)) return;
    if (Number(prop.line) !== line) changed.push(`${prop.player} ${prop.betType} ${prop.line} → ${line}`);
    if (Number(prop.line) === line && slipModifier(prop) === modifier) return;
    prop.line = line;
    prop.modifier = modifier;
    updated = true;
  });
  if (updated) {
    persistSaved();
    renderManualBetSlip();
  }
  return changed;
}

// The last PrizePicks link for these exact picks (any change to them makes a new one).
let manualSlipLink = null;
const manualSlipSig = (legs) => legs.map((prop) => `${prop.id}:${prop.side}:${prop.line}:${slipModifier(prop)}`).join("|");
const freshManualSlipLink = (legs) => (manualSlipLink && manualSlipLink.sig === manualSlipSig(legs) ? manualSlipLink.url : "");

// Matches every pick to the live PrizePicks board and gets the link that
// opens them there: {url, count, notes} or {error}.
async function requestManualSlipLink(legs) {
  manualSlipExporting = true;
  els.betSlipExport.disabled = true;
  els.betSlipExport.textContent = "Matching live lines…";
  els.betSlipStatus.textContent = "Checking every leg on the live PrizePicks board…";
  syncManualBetSlipUi({ status: els.betSlipStatus.textContent });
  // Never leave the button on "Checking lines…" if the check stalls.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MANUAL_SLIP_EXPORT_TIMEOUT_MS);
  let result;
  try {
    const response = await fetch(API_PRIZEPICKS_EXPORT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ legs: legs.map(manualSlipLegPayload) }),
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload.url) {
      const detail = payload.unmatched?.map((leg) => `${leg.player} ${leg.line} ${leg.stat}`).join("; ");
      throw new Error(detail ? `${payload.error} ${detail}` : (payload.error || "PrizePicks export failed."));
    }
    const changed = applyExportedLines(legs, payload.matches);
    const skipped = (payload.skipped || []).map((leg) => `${leg.player} ${leg.line} ${leg.stat}`);
    result = { url: payload.url, count: payload.matches.length, notes: [
      changed.length ? `Moved to PrizePicks' current line: ${changed.join("; ")}.` : "",
      skipped.length ? `Left out (no longer on PrizePicks): ${skipped.join("; ")}.` : "",
    ].filter(Boolean).join(" ") };
    // The link is for the picks as they are now (a line moved to PrizePicks' is part of them).
    manualSlipLink = { url: payload.url, sig: manualSlipSig(getSavedProps()) };
  } catch (error) {
    // No connection (TypeError) or a non-JSON reply (SyntaxError) get a
    // plain message rather than the browser's own wording.
    result = { error: error.name === "AbortError" ? "PrizePicks took too long to answer. Try again."
      : error instanceof TypeError || error instanceof SyntaxError ? "Couldn't reach PrizePicks. Check your connection and try again."
      : error.message || "PrizePicks export is temporarily unavailable." };
  } finally {
    clearTimeout(timeout);
  }
  // Back to normal as soon as the check is done. On a phone PrizePicks
  // usually opens in its own app and this page stays open behind it, so
  // it must not be left saying "Checking lines…" with Export disabled.
  manualSlipExporting = false;
  els.betSlipExport.textContent = freshManualSlipLink(getSavedProps()) ? "Open in PrizePicks" : "Export to PrizePicks";
  els.betSlipExport.disabled = !manualBetSlipCanExport(getSavedProps());
  return result;
}

function showManualSlipStatus(status) {
  els.betSlipStatus.textContent = status;
  syncManualBetSlipUi({ status });
}
const legsWord = (count) => `${count} live leg${count === 1 ? "" : "s"}`;

// Phones and the home-screen app. There PrizePicks (its app, or Safari)
// comes up over this page and pauses it, so a tab opened before the link is
// ready is never pointed anywhere: it sits blank on "Matching your picks"
// and the app has to be reopened.
const handheldExport = () => window.navigator.standalone === true
  || Boolean(window.matchMedia?.("(display-mode: standalone)").matches || window.matchMedia?.("(pointer: coarse)").matches);

// Export: PrizePicks opens in a new tab (or its app), never in place of
// this page. On a computer the tab is opened right away, while the tap
// still counts (a browser blocks one opened after the line check), and
// pointed at PrizePicks once the lines are matched. On a phone the lines
// are matched here first; Export then becomes Open in PrizePicks, a plain
// link the next tap opens with nothing left waiting on this page.
async function exportManualBetSlip() {
  const legs = getSavedProps();
  if (manualSlipExporting || !manualBetSlipCanExport(legs)) return;
  const ready = freshManualSlipLink(legs);
  if (!ready && handheldExport()) {
    const result = await requestManualSlipLink(legs);
    showManualSlipStatus(result.error || [`${legsWord(result.count)} matched. Tap Open in PrizePicks.`, result.notes].filter(Boolean).join(" "));
    return;
  }
  let tab = null;
  try { tab = window.open(ready || "", "_blank"); } catch { tab = null; }
  try { if (tab) tab.opener = null; } catch { /* already PrizePicks' page */ }
  if (ready) {
    if (!tab) showManualSlipStatus("Your browser blocked the new tab. Use Open in PrizePicks or Copy link.");
    return;
  }
  try { tab?.document.write('<title>PrizePicks</title><p style="font:16px system-ui,sans-serif;padding:24px;color:#555">Matching your picks to PrizePicks…</p>'); } catch { /* not ours to write */ }
  const result = await requestManualSlipLink(legs);
  if (result.error) {
    try { tab?.close(); } catch { /* gone already */ }
    showManualSlipStatus(result.error);
    return;
  }
  if (tab && !tab.closed) tab.location.replace(result.url);
  showManualSlipStatus([
    tab ? `${legsWord(result.count)} sent to PrizePicks in a new tab.` : `${legsWord(result.count)} matched. Your browser blocked the new tab: use Open in PrizePicks or Copy link.`,
    result.notes,
  ].filter(Boolean).join(" "));
}

// Copy link: the same check, then the PrizePicks link on the clipboard to
// open anywhere. Safari only lets a page copy during the tap, so the copy
// starts now and is filled in when the link comes back.
function copyManualBetSlipLink() {
  const legs = getSavedProps();
  if (manualSlipExporting || !manualBetSlipCanExport(legs)) return;
  const ready = freshManualSlipLink(legs);
  let notes = "", count = legs.length;
  const link = ready ? Promise.resolve(ready) : requestManualSlipLink(legs).then((result) => {
    if (result.error) throw new Error(result.error);
    notes = result.notes;
    count = result.count;
    return result.url;
  });
  writeClipboardText(link).then(
    () => showManualSlipStatus([`Link copied (${legsWord(count)}). Paste it in your browser or the PrizePicks app.`, notes].filter(Boolean).join(" ")),
    (error) => link.then(
      (url) => showManualSlipStatus(`Couldn't copy here. Your PrizePicks link: ${url}`),
      () => showManualSlipStatus(error?.message || "PrizePicks export is temporarily unavailable."),
    ),
  );
}

function writeClipboardText(text) {
  if (window.ClipboardItem && navigator.clipboard?.write) {
    try {
      return navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((value) => new Blob([value], { type: "text/plain" })) })])
        .catch(() => text.then((value) => copyTextNow(value)));
    } catch { /* this browser takes text only */ }
  }
  return text.then((value) => copyTextNow(value));
}
async function copyTextNow(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:fixed;top:0;left:0;opacity:0";
  document.body.append(field);
  field.select();
  const copied = document.execCommand("copy");
  field.remove();
  if (!copied) throw new Error("Couldn't copy here.");
}

function clearManualBetSlip() {
  if (!state.savedProps.size || !confirm("Remove every prop from this builder?")) return;
  state.savedProps.clear();
  state.parlaySelection.clear();
  persistSaved();
  updateSavedCount();
  if (state.currentTab === "saved") renderSavedGrid();
  const reportButton = els.reportWrap.querySelector(".save-btn");
  if (reportButton && currentResearchProp) syncSaveButton(reportButton, currentResearchProp.id);
  setManualBetSlipOpen(false);
}

function wireManualBetSlip() {
  els.betSlipClose?.addEventListener("click", () => setManualBetSlipOpen(false));
  els.betSlipScrim?.addEventListener("click", () => setManualBetSlipOpen(false));
  els.betSlipClear?.addEventListener("click", clearManualBetSlip);
  els.betSlipExport.addEventListener("click", exportManualBetSlip);
  window.addEventListener("vortex:toggle-bet-slip", () => {
    window.dispatchEvent(new Event("vortex:prop-builder-toggle"));
  });
  window.addEventListener("vortex:prop-builder-ready", renderManualBetSlip);
  window.addEventListener("vortex:prop-builder-request-sync", renderManualBetSlip);
  window.addEventListener("vortex:prop-builder-remove", (event) => removeManualBetSlipLeg(event.detail?.id));
  window.addEventListener("vortex:prop-builder-clear", clearManualBetSlip);
  window.addEventListener("vortex:prop-builder-export", exportManualBetSlip);
  window.addEventListener("vortex:prop-builder-copy", copyManualBetSlipLink);
  window.addEventListener("vortex:prop-builder-set", (event) => setManualBetSlipPick(event.detail?.prop, event.detail?.side));
  window.addEventListener("vortex:prop-builder-side", (event) => {
    const storedKey = savedPropKey(event.detail?.id);
    if (storedKey !== undefined) setManualBetSlipPick(state.savedProps.get(storedKey), event.detail?.side);
  });
  window.addEventListener("vortex:prop-builder-refresh", (event) => refreshManualBetSlipPicks(event.detail?.updates));
  // Returning from PrizePicks can restore this page from the browser's
  // back/forward cache exactly as it was left; repaint it from the store.
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    manualSlipExporting = false;
    renderManualBetSlip();
  });
  renderManualBetSlip();
}

function renderSavedGrid() {
  const saved = getSavedProps();
  els.savedGrid.innerHTML = "";
  els.savedEmpty.hidden = saved.length > 0;
  els.clearSavedBtn.style.visibility = saved.length ? "visible" : "hidden";

  const template = document.getElementById("saved-card-template");

  saved.forEach((p, i) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.style.animationDelay = `${i * 45}ms`;
    node.classList.toggle("selected", state.parlaySelection.has(p.id));

    node.querySelector(".avatar-slot").innerHTML = avatarHtml(p);
    node.querySelector(".saved-player").textContent = `${p.player}${p.team ? " (" + p.team + ")" : ""}`;
    node.querySelector(".saved-pick").textContent = `${p.side} ${p.line} ${p.betType}`;
    const related = saved.filter((other) => other.id !== p.id && (other.player === p.player || (p.team && other.team === p.team)));
    const correlation = node.querySelector(".saved-correlation");
    correlation.textContent = related.length ? `↗ ${related.length} related saved leg${related.length === 1 ? "" : "s"}` : "";
    correlation.hidden = related.length === 0;
    const tierWord = String(p.tierIcon || "").replace(/[^\p{L}\s]/gu, "").trim();
    node.querySelector(".saved-score").innerHTML = `${tierWord ? `<small>${escapeHtml(tierWord.charAt(0) + tierWord.slice(1).toLowerCase())}</small>` : ""}<b>${escapeHtml(slipScore(p))}</b>`;
    node.querySelector(".saved-sport-tag").textContent = p.sport || "";

    const checkbox = node.querySelector(".saved-checkbox");
    checkbox.checked = state.parlaySelection.has(p.id);
    // Clicking anywhere in the wrapping <label> (the visible checkmark,
    // not just the invisible native input) fires its OWN bubbling click
    // event in addition to the synthetic one the label dispatches on the
    // input -- stopPropagation() on the checkbox alone only silences that
    // synthetic click, not the real one from the label, so the card's
    // click-to-open handler still fired. Stop it at the label too.
    node.querySelector(".saved-select").addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.parlaySelection.add(p.id);
      else state.parlaySelection.delete(p.id);
      node.classList.toggle("selected", checkbox.checked);
      updateParlayBar();
    });

    const removeBtn = node.querySelector(".saved-remove");
    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      node.classList.add("removing");
      state.savedProps.delete(p.id);
      state.parlaySelection.delete(p.id);
      persistSaved();
      updateSavedCount();
      updateParlayBar();
      node.addEventListener(
        "animationend",
        () => {
          node.remove();
          if (getSavedProps().length === 0) els.savedEmpty.hidden = false;
        },
        { once: true }
      );
    });

    node.addEventListener("click", () => {
      // Finder picks (WNBA and the Finder's MLB lines) open in the Finder,
      // which has their trends; MLB Research only knows MLB props.
      if (p.source === "finder") { switchTab("finder", { scrollY: 0 }); return; }
      switchTab("research", { scrollY: 0 });
      openExactProp(p);
    });

    els.savedGrid.appendChild(node);
  });
}

/* ---------- Slate (Attack Board) ---------- */

let slateRequest = null;
const researchToolCache = new Map();
let activeResearchTool = "attack";
let toolRenderToken = 0;
let slateDataCache = null;

function requestSlateData(force = false) {
  if (!force && slateRequest) return slateRequest;
  slateRequest = fetch(force ? `/api/slate?refresh=${Date.now()}` : "/api/slate", {
    cache: force ? "no-store" : "default",
  }).then(async (res) => ({ res, data: await res.json() }));
  slateRequest.catch(() => { slateRequest = null; });
  return slateRequest;
}

function wireSlate() {
  const tools = document.querySelectorAll(".tool-tab");
  const labels = {
    attack: "Attack Board — starting-pitcher and bullpen vulnerability, ranked from the batter's side.",
    parks: "Best Ballparks — live park factors and venue run environment.",
    weather: "Weather + Park — live wind, temperature, roof status, and park context.",
    platoon: "Platoon Matchups — confirmed handedness matchups and season split context.",
    bvp: "BvP Matchups — current-season batter-versus-pitcher results, only where the sample is meaningful.",
    strikeouts: "Strikeout Spots — pitcher K skill, opposing lineup K rate, and projected workload."
  };
  els.slateRefreshBtn.addEventListener("click", () => {
    const activeTool = document.querySelector(".tool-tab.active")?.dataset.tool || "attack";
    activeResearchTool = activeTool;
    const token = ++toolRenderToken;
    if (activeTool === "attack") loadSlate(true, token);
    else loadResearchTool(activeTool, true, token);
  });
  tools.forEach((button) => button.addEventListener("click", () => {
    tools.forEach((item) => item.classList.toggle("active", item === button));
    const tool = button.dataset.tool;
    activeResearchTool = tool;
    const token = ++toolRenderToken;
    els.slateDate.textContent = labels[tool] || labels.attack;
    if (tool === "attack") {
      els.slateRefreshBtn.hidden = false;
      els.slateList.hidden = false;
      els.slateError.hidden = true;
      loadSlate(false, token);
      return;
    }
    loadResearchTool(tool, false, token);
  }));
}

async function loadResearchTool(tool, force = false, token = toolRenderToken) {
    els.slateList.innerHTML = "";
    els.slateList.hidden = true;
    els.slateEmpty.hidden = true;
    els.slateLoading.hidden = true;
    els.slateError.hidden = false;
    els.slateError.className = "tools-source-note";
    const cached = researchToolCache.get(tool);
    if (!force && cached) {
      if (token !== toolRenderToken || activeResearchTool !== tool) return;
      const rows = cached.entries || [];
      els.slateError.innerHTML = rows.length ? rows.map(renderToolCard).join("") : `<strong>${escapeHtml(tool)}</strong><span>No qualifying live data is available yet.</span>`;
      return;
    }
    els.slateError.textContent = force ? "Refreshing live MLB data…" : "Loading live MLB data…";
    const query = force ? `&refresh=${Date.now()}` : "";
    fetch(`/api/slate?tool=${encodeURIComponent(tool)}${query}`, {cache: force ? "no-store" : "default"}).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
      return data;
    }).then(data => {
      researchToolCache.set(tool, data);
      if (token !== toolRenderToken || activeResearchTool !== tool) return;
      const rows = data.entries || [];
      els.slateError.innerHTML = rows.length ? rows.map(renderToolCard).join("") : `<strong>${escapeHtml(tool)}</strong><span>No qualifying live data is available yet. No substitute list is shown.</span>`;
    }).catch((err) => {
      if (token !== toolRenderToken || activeResearchTool !== tool) return;
      els.slateError.textContent = forMember("Live data is temporarily unavailable.", "Nothing to show here yet. Check back soon.");
    });
}

function renderToolCard(row, index) {
  const evidence = (row.evidence || []).map(item => `<div class="tool-evidence"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.detail)}</small></div>`).join("");
  return `<article class="tool-result tool-${escapeHtml(row.tone || "neutral")}">
    <header><div><span class="tool-kicker">#${String(index + 1).padStart(2, "0")} · ${escapeHtml(row.badge || "Live research")}</span><strong>${escapeHtml(row.title)}</strong></div></header>
    <p class="tool-summary">${escapeHtml(row.summary || row.detail || "")}</p>
    <div class="tool-evidence-grid">${evidence}</div>
    ${row.caution ? `<p class="tool-caution">${escapeHtml(row.caution)}</p>` : ""}
  </article>`;
}

async function loadSlate(force = false, token = toolRenderToken) {
  if (state.slateLoaded && !force && slateDataCache) {
    if (token === toolRenderToken && activeResearchTool === "attack") renderSlate(slateDataCache);
    return;
  }

  els.slateLoading.hidden = false;
  els.slateEmpty.hidden = true;
  els.slateError.hidden = true;
  els.slateLoading.innerHTML = `<span class="slate-live-loader"><i></i><b>Preparing the board</b><small>Checking today’s starters and bullpens</small></span>`;
  els.slateList.hidden = false;
  els.slateList.innerHTML = Array.from({ length: 6 }, (_, i) => `
    <div class="slate-row slate-row-loading" style="--loader-index:${i}">
      <span class="slate-load-rank"></span><span class="slate-load-score"></span>
      <span class="slate-load-copy"><i></i><b></b></span><span class="slate-load-pulse"></span>
    </div>`).join("");

  try {
    const { res, data } = await requestSlateData(force);
    if (token !== toolRenderToken || activeResearchTool !== "attack") return;
    els.slateLoading.hidden = true;

    if (!res.ok || data.error) {
      els.slateList.innerHTML = "";
      els.slateError.textContent = data.error || `Request failed (${res.status})`;
      els.slateError.hidden = false;
      return;
    }

    state.slateLoaded = true;
    slateDataCache = data;
    renderSlate(data);
  } catch (err) {
    if (token !== toolRenderToken || activeResearchTool !== "attack") return;
    els.slateLoading.hidden = true;
    els.slateList.innerHTML = "";
    els.slateError.textContent = forMember("Live data is temporarily unavailable.", "Nothing to show here yet. Check back soon.");
    els.slateError.hidden = false;
  }
}

function renderSlate(data) {
  const entries = data.entries || [];
    els.slateDate.textContent = entries.length
      ? `${data.date_label || data.date || "Today"} · Most favorable hitting matchups appear first. Select a matchup for the opposing lineup.`
      : "Today’s most favorable hitting matchups appear first.";

  if (entries.length === 0) {
    els.slateEmpty.hidden = false;
    return;
  }

  els.slateList.innerHTML = "";
  entries.forEach((e, i) => {
    const row = document.createElement("div");
    row.className = "slate-row";
    row.style.animationDelay = `${i * 35}ms`;

    // Higher score = more vulnerable pitcher/bullpen = easier matchup for
    // hitters -- green. Lower score = tougher pitcher -- red.
    const difficultyClass = e.score >= 18 ? "slate-easy" : e.score >= 11 ? "slate-medium" : "slate-hard";
    const matchupLabel = e.score >= 18 ? "Favorable" : e.score >= 11 ? "Balanced" : "Difficult";
    const bullpenTier = String(e.bullpen_tier || "Average").toLowerCase();
    const bullpenLabel = bullpenTier.charAt(0).toUpperCase() + bullpenTier.slice(1);
    const bpText = e.bullpen_known
      ? `${bullpenLabel} · ${e.bullpen_era.toFixed(2)} ERA`
      : "Data unavailable";
    const teamLogo = e.team_id ? `https://www.mlbstatic.com/team-logos/${e.team_id}.svg` : "";
    const opponentLogo = e.opponent_team_id ? `https://www.mlbstatic.com/team-logos/${e.opponent_team_id}.svg` : "";

    row.innerHTML = `
      <span class="slate-player-photo-wrap ${difficultyClass}">
        <img class="slate-player-photo" src="https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${e.pitcher_id}/headshot/silo/current" alt="${escapeHtml(e.pitcher)}" loading="lazy" onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${e.pitcher_id}/headshot/67/current';this.onerror=null;" />
      </span>
      <span class="slate-main">
        <span class="slate-matchup" aria-label="${escapeHtml(e.team || "Pitching team")} versus ${escapeHtml(e.opponent || e.opponent_abbr || "opponent")}">
          ${teamLogo ? `<img src="${teamLogo}" alt="${escapeHtml(e.team || "Pitching team")}" />` : ""}
          <b>vs</b>
          ${opponentLogo ? `<img src="${opponentLogo}" alt="${escapeHtml(e.opponent || e.opponent_abbr || "Opponent")}" />` : ""}
        </span>
        <span class="slate-pitcher">${escapeHtml(e.pitcher)} <span class="slate-hand">· ${escapeHtml(e.hand)}HP</span></span>
        <span class="slate-stats">
          <span><small>ERA</small><b>${e.era.toFixed(2)}</b></span>
          <span><small>HR / 9</small><b>${e.hr9.toFixed(2)}</b></span>
          <span><small>K / 9</small><b>${e.k9.toFixed(2)}</b></span>
          <span><small>Bullpen</small><b>${escapeHtml(bpText)}</b></span>
        </span>
      </span>
      <span class="slate-read ${difficultyClass}"><small>Matchup</small><b>${matchupLabel}</b></span>
    `;
    const insightParams = {
      teamId: e.opponent_team_id,
      pitcherId: e.pitcher_id,
      pitcherName: e.pitcher,
      pitcherHand: e.hand,
    };
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Open ${e.opponent} batting order and matchup insights`);
    row.addEventListener("pointerenter", () => prefetchTeamInsights(insightParams), { once: true });
    row.addEventListener("focus", () => prefetchTeamInsights(insightParams), { once: true });
    row.addEventListener("click", () => openTeamModal(insightParams, e.opponent));
    row.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openTeamModal(insightParams, e.opponent);
    });
    els.slateList.appendChild(row);
  });

  const warm = () => entries.slice(0, 3).forEach((e, i) => setTimeout(() => {
    prefetchTeamInsights({
      teamId: e.opponent_team_id, pitcherId: e.pitcher_id,
      pitcherName: e.pitcher, pitcherHand: e.hand,
    });
  }, i * 450));
  if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 1800 });
  else setTimeout(warm, 500);
}

/* ---------- Props Board (Discord bot mirror) ----------
   The board IS the Discord bot's board: backend/update_board.py mirrors its
   props_board table to the KV store after every engine run, /api/board reads
   it back, and this renders the same fields the bot's /menu embed shows —
   tier, Vortex Score, EV, hit-rate windows, pitcher matchup, BvP, risk. */

function pitcherFinderStat(value) {
  return finderMarket(value) || {key:'unsupported', label:value, short:value, pitcher:false};
}
const finderSelection = {category:'pitchers', modifier:'all', stat:'all', query:''};
const finderCompare = new Map();
let finderVisibleProps = [];
let activeFinderProp = null;
const LINE_HISTORY_KEY = 'vortex-line-history-v1';
function finderPropKey(prop) { return `${nameKey(prop.player)}|${prop.betType}|${Number(prop.line)}`; }
function lineHistoryKey(row) { return `${nameKey(row.player)}|${pitcherFinderStat(row.stat).label}|${String(row.odds_type || 'standard').toLowerCase()}`; }
function recordLineHistory(rows) {
  let history={}; try{history=JSON.parse(localStorage.getItem(LINE_HISTORY_KEY)||'{}');}catch{}
  const now=Date.now(); rows.forEach(row=>{const line=Number(row.line);if(!Number.isFinite(line))return;const key=lineHistoryKey(row),points=Array.isArray(history[key])?history[key]:[],last=points.at(-1);if(!last||Number(last.line)!==line||now-last.at>21600000)points.push({line,at:now});history[key]=points.slice(-16);});
  try{localStorage.setItem(LINE_HISTORY_KEY,JSON.stringify(history));}catch{}
}
function propLineHistory(prop) {try{return JSON.parse(localStorage.getItem(LINE_HISTORY_KEY)||'{}')[`${nameKey(prop.player)}|${prop.betType}|${String(prop.oddsType||'standard').toLowerCase()}`]||[];}catch{return[];}}
function readFinderCache(key, maxAge) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(`finder-v3:${key}`));
    return entry && Date.now() - entry.at < maxAge ? entry.value : null;
  } catch { return null; }
}
function writeFinderCache(key, value) {
  try { sessionStorage.setItem(`finder-v3:${key}`, JSON.stringify({at:Date.now(), value})); } catch {}
}
const finderPlayerHistory = new Map();
const finderHistoryRequests = new Map();
function finderHistoryKey(row) { const market = pitcherFinderStat(row.stat); return `${nameKey(row.player)}|${market.pitcher ? 'pitching' : 'hitting'}${market.firstInning ? '|innings' : ''}`; }
function cachedFinderHistory(row) {
  const key = finderHistoryKey(row);
  const cached = finderPlayerHistory.get(key) || readFinderCache(key, 600000);
  if (cached && Date.now() - cached.updatedAt < 600000) {
    finderPlayerHistory.set(key, cached); return cached;
  }
  return null;
}
async function requestFinderHistory(row) {
  const key = finderHistoryKey(row);
  const cached = cachedFinderHistory(row);
  if (cached) return cached;
  if (!finderHistoryRequests.has(key)) {
    finderHistoryRequests.set(key, fetch(`/api/board?view=prop-history&player=${encodeURIComponent(row.player)}&group=${pitcherFinderStat(row.stat).pitcher ? 'pitching' : 'hitting'}${pitcherFinderStat(row.stat).firstInning ? '&innings=1' : ''}`, { signal: AbortSignal.timeout(30000) })
      .then(async response => { const data = await response.json(); if (!response.ok || data.error) throw new Error(data.error || 'History unavailable');
        finderPlayerHistory.set(key, data); writeFinderCache(key, data); return data; })
      .finally(() => finderHistoryRequests.delete(key)));
  }
  return finderHistoryRequests.get(key);
}
let finderFeedRequest;
let finderFeedAt = 0;
async function requestFinderFeed(force = false) {
  if (!force && state.pitcherFinderLoaded && Date.now() - finderFeedAt < 120000) return state.pitcherFinderProps;
  if (force && finderFeedRequest) { await finderFeedRequest; }
  if (!finderFeedRequest) finderFeedRequest = fetch(`/api/board?view=props${force ? '&refresh=1' : ''}`, {cache:'no-store', signal: AbortSignal.timeout(15000)}).then(async response => {
    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || 'Live lines unavailable');
    state.pitcherFinderProps = (data.props || []).filter(row => finderMarket(row.stat));
    recordLineHistory(state.pitcherFinderProps);
    state.pitcherFinderLoaded = true; finderFeedAt = Date.now();
    writeFinderCache('feed', {props:state.pitcherFinderProps, at:finderFeedAt});
    return state.pitcherFinderProps;
  }).finally(() => {finderFeedRequest = null;});
  return finderFeedRequest;
}

function pitcherFinderBoardMatch(row) {
  const name = String(row.player || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates = [
    ...(state.v2BoardData?.props || []),
    ...(state.v2BoardData?.pitcher_research || []),
  ];
  return candidates.find((p) => String(p.player_name || "").toLowerCase().replace(/[^a-z0-9]/g, "") === name) || null;
}

function pitcherFinderGameLogProp(row) {
  const market = pitcherFinderStat(row.stat);
  const board = pitcherFinderBoardMatch(row);
  const stats = board?.stats || {};
  const playerId = stats.player_id || playerCatalog.find(p => nameKey(p.name) === nameKey(row.player))?.id || "";
  const line = Number(row.line);
  const modifier = String(row.odds_type || "standard").toLowerCase();
  return {
    id: `finder-${nameKey(row.player)}-${nameKey(market.label)}-${line}-${modifier}`,
    player: row.player,
    betType: market.label,
    line,
    side: "Over",
    position: market.pitcher ? "P" : row.position || "",
    isPitcherProp: market.pitcher,
    oddsType: modifier,
    sport: "MLB",
    teamId: stats.team_id || board?.team_id || null,
    teamName: stats.team || board?.team || "",
    teamAbbr: stats.team_abbr || board?.team || "",
    opponentTeamId: stats.opponent_team_id || null,
    matchup: { opponent: stats.opponent || stats.matchup?.opponent || "" },
    headshot: playerId ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${playerId}/headshot/silo/current` : (String(row.headshot || "").startsWith("https://") ? row.headshot : ""),
    gameLogChart: {},
  };
}

function renderPitcherFinder() {
  if (!els.pitcherFinder) return;
  els.pitcherFinderTabs.setAttribute('aria-label', finderSelection.category === 'pitchers' ? 'Pitcher prop type' : 'Batter prop type');
  const markets = finderSelection.category === 'pitchers'
    ? [['all','All stats'],['strikeouts',"K’s"],['outs','Outs'],['hits','Hits'],['earned-runs','ER'],['walks','Walks']]
    : [['all','All stats'],['hrr','HRR'],['hits','Hits'],['tb','TB'],['hr','HR'],['rbi','RBIs'],['runs','Runs'],['strikeouts',"K’s"],['walks','Walks'],['fantasy','Fantasy']];
  els.pitcherFinderTabs.innerHTML = markets.map(([key,label]) => `<button type="button" data-pitcher-filter="${key}" aria-pressed="${finderSelection.stat === key}" class="${finderSelection.stat === key ? 'active' : ''}">${label}</button>`).join('');
  renderPitcherComparison(finderRows(state.pitcherFinderProps, finderSelection));
}

let pitcherComparisonPage = 0;
let pitcherComparisonToken = 0;
const pitcherHistoryCache = new Map();
const pitcherHistoryFailures = new Set();
const pitcherTableFilter = { windows: [], min: 0, max: 100, sort: '', direction: -1 };
function pitcherTableValues(row) {
  const data = pitcherHistoryCache.get(`${finderHistoryKey(row)}|${pitcherFinderStat(row.stat).label}|${Math.floor(Date.now()/600000)}`);
  if (!data) return {};
  const all = data.all || data.l20 || [], recent = all.slice(-10);
  const avg = recent.length ? recent.reduce((sum,g) => sum + Number(g.value),0) / recent.length : null;
  const result = {avg, diff:avg === null ? null : avg - Number(row.line)};
  [5,10,15,20,'h2h'].forEach(size => {
    const games = size === 'h2h' ? data.h2h || [] : all.slice(-size);
    result[size] = games.length ? games.filter(g => Number(g.value) > Number(row.line)).length / games.length * 100 : null;
  });
  return result;
}

function renderPitcherComparison(rows) {
  const token = ++pitcherComparisonToken;
  const sourceRows = rows;
  const active = pitcherTableFilter.windows.length > 0;
  if (active) rows = rows.filter(row => {
    const values = pitcherTableValues(row);
    return pitcherTableFilter.windows.every(key => values[key] != null && values[key] >= pitcherTableFilter.min && values[key] <= pitcherTableFilter.max);
  });
  if (pitcherTableFilter.sort) rows = [...rows].sort((a,b) => {
    const av = pitcherTableValues(a)[pitcherTableFilter.sort], bv = pitcherTableValues(b)[pitcherTableFilter.sort];
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    return (av - bv) * pitcherTableFilter.direction;
  });
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  pitcherComparisonPage = Math.min(pitcherComparisonPage, pages - 1);
  const visible = rows.slice(pitcherComparisonPage * 20, (pitcherComparisonPage + 1) * 20);
  finderVisibleProps = visible.map(pitcherFinderGameLogProp);
  const pendingHistory = sourceRows.filter(row => pitcherTableValues(row).avg === undefined && !pitcherHistoryFailures.has(`${finderHistoryKey(row)}|${pitcherFinderStat(row.stat).label}|${Math.floor(Date.now()/600000)}`)).length;
  els.pitcherFinderCount.textContent = `${rows.length} line${rows.length === 1 ? '' : 's'} · historical More hit rates${pendingHistory && (active || pitcherTableFilter.sort) ? ` · checking ${pendingHistory} samples` : ''}`;
  els.pitcherFinderState.hidden = rows.length > 0;
  if (!rows.length) els.pitcherFinderState.textContent = pendingHistory && active ? 'Checking history against your filters…' : 'No matching active lines. Try another filter.';
  els.pitcherFinderList.innerHTML = `<div class="finder-mobile-sort"><label>Sort lines<select id="finder-sort"><option value="">Player name</option>${[['10','L10'],['5','L5'],['15','L15'],['20','L20'],['h2h','H2H'],['avg','Average'],['diff','Difference']].map(([key,label]) => `<option value="${key}" ${pitcherTableFilter.sort === key ? 'selected' : ''}>${label} · highest first</option>`).join('')}</select></label></div><div class="pitcher-table-scroll"><table class="pitcher-table"><thead><tr><th>Player / line</th><th>App</th><th>Avg L10</th><th>Diff</th><th>L5</th><th>L10</th><th>L15</th><th>L20</th><th>H2H</th></tr></thead><tbody></tbody></table></div><div class="pitcher-pagination"><button type="button" data-page="-1" ${pitcherComparisonPage === 0 ? 'disabled' : ''}>Previous</button><span>Page ${pitcherComparisonPage + 1} / ${pages}</span><button type="button" data-page="1" ${pitcherComparisonPage === pages - 1 ? 'disabled' : ''}>Next</button></div>`;
  els.pitcherFinderList.insertAdjacentHTML('afterbegin', `<details class="rate-filter"><summary><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M7 12h10M10 17h4"/></svg><span>Hit rate</span><b>${active ? `${pitcherTableFilter.min}–${pitcherTableFilter.max}%` : 'Filter'}</b></summary><div class="rate-windows">${[5,10,15,20,'h2h'].map(key => `<label><input type="checkbox" value="${key}" ${pitcherTableFilter.windows.includes(String(key)) ? 'checked' : ''}><span>${key === 'h2h' ? 'H2H' : 'L'+key}</span></label>`).join('')}</div><div class="rate-presets"><button type="button" data-rate-preset="70">70%+</button><button type="button" data-rate-preset="80">80%+</button><button type="button" data-rate-preset="90">90%+</button></div><div class="rate-bounds"><label>Minimum %<input type="number" inputmode="numeric" min="0" max="100" value="${pitcherTableFilter.min}" data-bound="min"></label><label>Maximum %<input type="number" inputmode="numeric" min="0" max="100" value="${pitcherTableFilter.max}" data-bound="max"></label><button type="button" data-rate-apply>Show matches</button><button type="button" data-rate-clear>Clear</button></div><p>All selected windows must match. Missing samples are excluded. Filters and sorting use the full board after history loads.</p></details>`);
  els.pitcherFinderList.querySelector('#finder-sort').onchange = event => {pitcherTableFilter.sort = event.target.value; pitcherTableFilter.direction = -1; pitcherComparisonPage = 0; renderPitcherComparison(sourceRows);};
  const filter = els.pitcherFinderList.querySelector('.rate-filter');
  filter.querySelectorAll('[data-rate-preset]').forEach(button => {button.onclick = () => {filter.querySelector('[data-bound=min]').value = button.dataset.ratePreset; filter.querySelector('[data-bound=max]').value = 100;};});
  filter.querySelector('[data-rate-apply]').onclick = () => {
    pitcherTableFilter.windows = [...filter.querySelectorAll('input:checked')].map(el => el.value);
    const bounds = [...filter.querySelectorAll('[data-bound]')].map(el => Math.max(0,Math.min(100,Number(el.value))));
    pitcherTableFilter.min = Math.min(...bounds); pitcherTableFilter.max = Math.max(...bounds);
    if (!pitcherTableFilter.windows.length) pitcherTableFilter.windows = ['5','10','15','20','h2h'];
    pitcherComparisonPage = 0; renderPitcherComparison(sourceRows);
  };
  filter.querySelector('[data-rate-clear]').onclick = () => {pitcherTableFilter.windows = []; pitcherComparisonPage = 0; renderPitcherComparison(sourceRows);};
  [...els.pitcherFinderList.querySelectorAll('th')].slice(2).forEach((th,index) => {
    const key = ['avg','diff','5','10','15','20','h2h'][index];
    const label = th.textContent;
    th.innerHTML = `<button type="button">${label} ${pitcherTableFilter.sort === key ? (pitcherTableFilter.direction === -1 ? '↓' : '↑') : '↕'}</button>`;
    th.querySelector('button').onclick = () => {pitcherTableFilter.direction = pitcherTableFilter.sort === key ? -pitcherTableFilter.direction : -1; pitcherTableFilter.sort = key; pitcherComparisonPage = 0; renderPitcherComparison(sourceRows);};
  });
  els.pitcherFinderList.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    pitcherComparisonPage += Number(button.dataset.page);
    renderPitcherComparison(sourceRows);
  }));
  const queue = visible.map(row => {
    const tr = document.createElement('tr');
    const prop = pitcherFinderGameLogProp(row);
    const initial = prop.headshot ? `<img class="pitcher-table-photo" src="${escapeHtml(prop.headshot)}" alt="" width="44" height="44">` : `<span class="finder-photo-placeholder" aria-hidden="true">${escapeHtml(row.player.split(' ').map(n => n[0]).slice(0,2).join(''))}</span>`;
    const modifier = String(row.odds_type || 'standard').toLowerCase();
    const modifierIcon = modifier === 'goblin' ? '/prizepicks/goblin.png' : modifier === 'demon' ? '/prizepicks/demon.png' : '';
    const selectedCompare=finderCompare.has(finderPropKey(prop));
    tr.innerHTML = `<td class="finder-player-cell"><button type="button" class="pitcher-table-open">${initial}<span class="finder-player-copy"><b>${escapeHtml(row.player)}</b><span>More ${Number(row.line)} ${escapeHtml(pitcherFinderStat(row.stat).short)}</span><small class="finder-matchup">${escapeHtml(row.team || prop.teamAbbr || 'MLB')} · ${escapeHtml(modifier === 'standard' ? 'Regular line' : row.odds_type || 'Regular line')}</small></span><span class="finder-open-arrow" aria-hidden="true">›</span></button><button type="button" class="finder-compare-button ${selectedCompare?'selected':''}" aria-label="Compare ${escapeHtml(row.player)} ${escapeHtml(pitcherFinderStat(row.stat).short)}" aria-pressed="${selectedCompare}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v18M3 8l5-5 5 5M16 21V3m-5 13 5 5 5-5"/></svg></button><button type="button" class="finder-slip-star" data-requires-tab="saved" aria-label="Add ${escapeHtml(row.player)} to My Slip" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z"/></svg></button></td><td class="finder-app-cell"><img width="24" height="24" src="/prizepicks/logo.png" alt="PrizePicks">${modifierIcon ? `<img width="20" height="20" src="${modifierIcon}" alt="">` : ''}<span>${escapeHtml(modifier === 'standard' ? 'Regular' : row.odds_type || 'Regular')} · ${modifier === 'standard' ? 'More / Less' : 'More only'}</span></td>${['Avg','Diff','L5','L10','L15','L20','H2H'].map(label => `<td class="pitcher-rate" data-label="${label}"><span>…</span></td>`).join('')}`;
    tr.querySelector('img')?.addEventListener('error', event => {event.currentTarget.hidden = true;}, {once:true});
    const star = tr.querySelector('.finder-slip-star');
    syncSaveButton(star, prop.id);
    star.addEventListener('click', event => { event.stopPropagation(); toggleSave(prop, star); });
    const compare=tr.querySelector('.finder-compare-button');compare.addEventListener('click',event=>{event.stopPropagation();toggleFinderCompare(prop,compare);});
    wireFinderHold(tr.querySelector('.pitcher-table-open'),prop);
    tr.querySelector('.pitcher-table-open').addEventListener('click', () => researchFinderProp(prop));
    els.pitcherFinderList.querySelector('tbody').appendChild(tr);
    return {row, prop, tr};
  });
  if (active || pitcherTableFilter.sort) sourceRows.filter(row => !visible.includes(row)).forEach(row => queue.push({row,prop:pitcherFinderGameLogProp(row),tr:document.createElement('tr')}));
  let fetched = false;
  const worker = async () => {
    while (queue.length && token === pitcherComparisonToken) {
      const {row, prop, tr} = queue.shift();
      const key = `${finderHistoryKey(row)}|${prop.betType}|${Math.floor(Date.now()/600000)}`;
      try {
        let data = pitcherHistoryCache.get(key);
        if (!data) {
          if (pitcherHistoryFailures.has(key)) throw new Error('History unavailable');
          const payload = await requestFinderHistory(row);
          data = historyChart(payload, row);
          pitcherHistoryCache.set(key, data);
          fetched = true;
        }
        if (token !== pitcherComparisonToken) return;
        const all = data.all || data.l20 || [];
        const l10 = all.slice(-10);
        const average = l10.length ? l10.reduce((sum,g) => sum + Number(g.value),0) / l10.length : null;
        prop.compareValues={average,diff:average===null?null:average-Number(row.line)};
        const cells = tr.querySelectorAll('.pitcher-rate');
        if (!cells.length) continue;
        cells[0].textContent = average === null ? '—' : average.toFixed(1);
        cells[1].textContent = average === null ? '—' : `${average >= row.line ? '+' : ''}${(average - row.line).toFixed(1)}`;
        [5,10,15,20,'h2h'].forEach((size,index) => {
          const games = size === 'h2h' ? (data.h2h || []) : all.slice(-size);
          const hits = games.filter(g => Number(g.value) > Number(row.line)).length;
          const pct = games.length ? hits / games.length * 100 : null;
          prop.compareValues[size]=pct;
          const cell = cells[index + 2];
          cell.innerHTML = pct === null ? '—' : `<b>${Math.round(pct)}%</b><small>${hits}/${games.length}</small>`;
          cell.dataset.tone = pct === null ? 'empty' : pct >= 70 ? 'good' : pct >= 45 ? 'mid' : 'low';
        });
        prop.gameLogChart = Object.fromEntries(Object.entries(data).filter(([,games]) => Array.isArray(games)).map(([key,games]) => [key,games.map(game => ({...game, over:Number(game.value) > Number(row.line)}))]));
        if (data.meta?.opponent) { prop.matchup.opponent = data.meta.opponent; prop.opponentTeamId = data.meta.opponent_team_id; tr.querySelector('.finder-matchup').textContent = `${row.team || prop.teamAbbr || 'MLB'} · vs ${data.meta.opponent}`; }
        cells[6].title = data.meta?.h2hLabel || 'Recent H2H';
        if (data.meta?.player_id) {
          tr.querySelector('.pitcher-table-photo, .finder-photo-placeholder')?.remove();
          prop.headshot = `https://img.mlbstatic.com/mlb-photos/image/upload/w_120/v1/people/${encodeURIComponent(data.meta.player_id)}/headshot/silo/current`;
          const photo = document.createElement('img'); photo.className = 'pitcher-table-photo'; photo.src = prop.headshot; photo.alt = row.player;
          photo.onerror = () => {photo.onerror = null; photo.src = prop.headshot.replace('/silo/', '/67/');};
          tr.querySelector('.pitcher-table-open').prepend(photo);
        }
      } catch (_) {
        if (!pitcherHistoryFailures.has(key)) {fetched = true; pitcherHistoryFailures.add(key);}
        tr.querySelectorAll('.pitcher-rate').forEach(cell => {cell.textContent = '—'; cell.title = 'History unavailable; open the player to retry';});
      }
    }
  };
  Promise.all(Array.from({length:3}, worker)).then(() => { if (fetched && token === pitcherComparisonToken && (active || pitcherTableFilter.sort)) renderPitcherComparison(sourceRows); });
}

async function loadPitcherFinder(force = false) {
  if (!els.pitcherFinder) return;
  if (force) { pitcherHistoryCache.clear(); pitcherHistoryFailures.clear(); finderPlayerHistory.clear(); pitcherComparisonPage = 0; }
  if (!state.pitcherFinderLoaded) {
    const saved = readFinderCache('feed', 120000);
    if (saved) {state.pitcherFinderProps = saved.props; state.pitcherFinderLoaded = true; finderFeedAt = saved.at;}
  }
  if (state.pitcherFinderLoaded && !els.pitcherFinder.hidden) renderPitcherFinder();
  els.pitcherFinderRefresh.disabled = true;
  try {
    await requestFinderFeed(force);
    if (!els.pitcherFinder.hidden) renderPitcherFinder();
    // Warm the first few players once; all their markets share this response.
    const first = finderRows(state.pitcherFinderProps).slice(0,8);
    const unique = [...new Map(first.map(row => [finderHistoryKey(row),row])).values()].slice(0,3);
    unique.forEach(row => requestFinderHistory(row).catch(() => {}));
  } catch (error) {
    els.pitcherFinderState.hidden = false;
    els.pitcherFinderState.textContent = state.pitcherFinderLoaded
      ? forMember('Showing recently loaded lines. Refresh could not complete.', 'Showing the latest lines.')
      : forMember('Live lines could not load. Tap Refresh to retry.', 'No lines to show yet. Tap Refresh.');
  } finally { els.pitcherFinderRefresh.disabled = false; }
}

function syncPitcherFinderVisibility() {
  const visible = state.boardFilter === "strikeouts";
  els.pitcherFinder.hidden = !visible;
  els.pitcherBoardLabel.hidden = !visible;
  if (visible) {
    renderPitcherFinder();
    loadPitcherFinder();
  }
}

function wireV2Board() {
  ['category','modifier'].forEach(key => document.getElementById(`finder-${key}`).addEventListener('change', event => {
    finderSelection[key] = event.target.value; finderSelection.stat = 'all'; pitcherComparisonPage = 0; renderPitcherFinder();
  }));
  document.getElementById('finder-search').addEventListener('input', event => {finderSelection.query = event.target.value; pitcherComparisonPage = 0; renderPitcherFinder();});
  els.v2RefreshBtn.addEventListener("click", () => loadV2Board(true));
  els.pitcherFinderRefresh.addEventListener("click", () => loadPitcherFinder(true));
  els.pitcherFinderTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-pitcher-filter]");
    if (!button) return;
    finderSelection.stat = button.dataset.pitcherFilter; pitcherComparisonPage = 0;
    renderPitcherFinder();
  });
  els.boardFilterRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-board-filter]");
    if (!btn) return;
    state.boardFilter = btn.dataset.boardFilter;
    state.matchupDisplayLimit = 40;
    els.boardFilterRow.querySelectorAll("button").forEach((b) => {
      b.classList.toggle("active", b === btn);
      b.setAttribute("aria-pressed", String(b === btn));
    });
    syncPitcherFinderVisibility();
    if (state.v2BoardData) renderBotBoard(state.v2BoardData);
  });
  els.matchupGameTrigger.addEventListener("click", () => {
    const willOpen = els.matchupGameMenu.hidden;
    els.matchupGameMenu.hidden = !willOpen;
    els.matchupGameTrigger.setAttribute("aria-expanded", String(willOpen));
    els.matchupGamePicker.classList.toggle("open", willOpen);
  });
  els.matchupGameMenu.addEventListener("click", (event) => {
    const option = event.target.closest("[data-matchup-game]");
    if (!option) return;
    state.matchupGameFilter = option.dataset.matchupGame || "all";
    state.matchupDisplayLimit = 40;
    els.matchupGameMenu.hidden = true;
    els.matchupGameTrigger.setAttribute("aria-expanded", "false");
    els.matchupGamePicker.classList.remove("open");
    if (state.v2BoardData) renderBotBoard(state.v2BoardData);
  });
  document.addEventListener("pointerdown", (event) => {
    if (els.matchupGameMenu.hidden || els.matchupGamePicker.contains(event.target)) return;
    els.matchupGameMenu.hidden = true;
    els.matchupGameTrigger.setAttribute("aria-expanded", "false");
    els.matchupGamePicker.classList.remove("open");
  });

  els.v2BoardList.addEventListener("click", (e) => {
    const closeBtn = e.target.closest(".v2-detail-close");
    if (closeBtn) {
      e.stopPropagation();
      const detail = closeBtn.closest(".v2-detail");
      const row = detail?.previousElementSibling;
      if (detail) detail.hidden = true;
      if (row?.classList.contains("v2-row")) {
        row.classList.remove("v2-open");
        row.setAttribute("aria-expanded", "false");
        row.scrollIntoView({ behavior: "smooth", block: "center" });
        row.focus({ preventScroll: true });
      }
      return;
    }
    const btn = e.target.closest(".v2-deepdive-btn");
    if (!btn) return;
    e.stopPropagation(); // don't also toggle the row's own open/close
    const p = (state.v2RenderedProps || [])[Number(btn.dataset.v2Idx)];
    if (!p) return;
    if (btn.textContent.includes("View Details")) {
      openPlayerDetail(p);
    } else {
      deepDiveIntoBotProp(p);
    }
  });

  els.v2BackBtn.addEventListener("click", () => {
    const returnScroll = state.v2DeepDiveReturn?.scrollY;
    switchTab("v2");
    els.v2BackBtn.hidden = true;
    state.v2DeepDiveReturn = null;
    if (typeof returnScroll === "number") window.scrollTo(0, returnScroll);
  });
}

async function loadV2Board(force = false) {
  if (state.v2BoardLoaded && !force) return;

  els.v2BoardEmpty.hidden = true;
  els.v2BoardError.hidden = true;
  els.v2BoardList.innerHTML = Array.from({ length: 5 }, (_, index) => `<article class="board-card-skeleton" style="--i:${index}" aria-hidden="true"><i></i><div><b></b><span></span><small></small></div><em></em></article>`).join("");
  els.v2RefreshBtn.classList.add("is-loading");
  els.v2RefreshBtn.disabled = true;

  try {
    const res = await fetch("/api/board", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data.error) {
      els.v2BoardList.innerHTML = "";
      els.v2BoardError.innerHTML = `<span class="status-mark status-mark-error" aria-hidden="true"></span><span class="state-copy"><strong>Props are temporarily unavailable</strong><small>Refresh in a moment to try again.</small></span>`;
      els.v2BoardError.hidden = false;
      return;
    }

    state.v2BoardLoaded = true;
    state.v2BoardData = data;
    renderBotBoard(data);
  } catch (err) {
    els.v2BoardList.innerHTML = "";
    els.v2BoardError.innerHTML = `<span class="status-mark status-mark-error" aria-hidden="true"></span><span class="state-copy"><strong>Props are temporarily unavailable</strong><small>Refresh in a moment to try again.</small></span>`;
    els.v2BoardError.hidden = false;
  } finally {
    els.v2RefreshBtn.classList.remove("is-loading");
    els.v2RefreshBtn.disabled = false;
  }
}

// Same tiers (and roughly the same badges) the Discord bot renders.
const BOT_TIER = {
  ELITE:  { badge: "💎 ELITE",  cls: "tier-elite" },
  STRONG: { badge: "💠 STRONG", cls: "tier-strong" },
  GOOD:   { badge: "🔷 GOOD",   cls: "tier-good" },
  LEAN:   { badge: "🔹 LEAN",   cls: "tier-lean" },
  RISKY:  { badge: "⚠️ RISKY",  cls: "tier-risky" },
  FADE:   { badge: "⛔ FADE",   cls: "tier-risky" },
  RESEARCH: { badge: "👁️ MATCHUP", cls: "tier-research" },
};

// The same tiers as words, for the board's cards.
const BOARD_TIER_LABEL = { ELITE: "Elite", STRONG: "Strong", GOOD: "Good", LEAN: "Lean", RISKY: "Risky", FADE: "Fade", RESEARCH: "Matchup" };

// Rows with no stats-tier (no pitcher match / stats card unavailable) never
// show as bare "UNRATED" on the bot — it falls back to a score-based emoji
// (see _score_emoji in vortex.py). Mirror that exact scale here instead of
// inventing a separate "unrated" concept the bot doesn't have.
function botScoreBadge(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return { badge: "⚪ —", cls: "tier-none" };
  if (s >= 10) return { badge: `💎 ${s}`, cls: "tier-elite" };
  if (s >= 6)  return { badge: `🔥 ${s}`, cls: "tier-strong" };
  if (s >= 3)  return { badge: `✅ ${s}`, cls: "tier-good" };
  if (s >= 0)  return { badge: `➡️ ${s}`, cls: "tier-lean" };
  return { badge: `⚠️ ${s}`, cls: "tier-risky" };
}

const SPORT_EMOJI = { MLB: "⚾", NBA: "🏀", WNBA: "🏀", NFL: "🏈", NHL: "🏒" };

function fmtBotEv(p) {
  // The engine stores EV 0.0 when there was no real two-sided de-vig
  // (stats.ev_real=false) — show n/a instead of a fake +0.0%.
  if (p.stats && p.stats.ev_real === false) return "EV n/a";
  const ev = Number(p.ev_percentage) || 0;
  return `EV ${ev >= 0 ? "+" : ""}${ev.toFixed(1)}%`;
}

function boardMatchupLabel(score) {
  const n = matchupNumber(score);
  if (!Number.isFinite(n)) return "";
  if (n >= 85) return "ELITE MATCHUP";
  if (n >= 75) return "STRONG MATCHUP";
  if (n >= 65) return "FAVORABLE";
  if (n >= 55) return "SLIGHT EDGE";
  if (n >= 45) return "NEUTRAL";
  if (n >= 35) return "CAUTION";
  return "UNFAVORABLE";
}

function matchupGameDetails(prop) {
  const stats = prop.stats || {};
  let ownName = stats.team_abbr || stats.team || prop.team_abbr || prop.teamAbbr || prop.teamName || prop.team || "";
  let opponentName = stats.opponent_abbr || stats.opponent || stats.matchup?.opponent || prop.matchup?.opponent || prop.opponent || "";
  const ownId = stats.team_id || prop.team_id || prop.teamId || MLB_TEAM_IDS[String(ownName).toUpperCase()] || null;
  const opponentId = stats.opponent_team_id || prop.opponentTeamId || MLB_TEAM_IDS[String(opponentName).toUpperCase()] || null;
  ownName = MLB_TEAM_ABBRS[ownId] || ownName;
  opponentName = MLB_TEAM_ABBRS[opponentId] || opponentName;
  const isHome = stats.is_home === true || String(stats.is_home).toLowerCase() === "true";
  const away = isHome ? opponentName : ownName;
  const home = isHome ? ownName : opponentName;
  const awayId = isHome ? opponentId : ownId;
  const homeId = isHome ? ownId : opponentId;
  const suppliedTime = prop.commence_time || prop.gameTime || prop.startTime || prop.matchup?.startTime || "";
  const timestamp = Number.isFinite(Date.parse(suppliedTime)) ? Date.parse(suppliedTime) : Number.POSITIVE_INFINITY;
  const gamePk = stats.game_pk || stats.gamePk || prop.game_pk || prop.gamePk;
  const schedule = state.v2BoardData?.games || [];
  const propTime = Date.parse(suppliedTime);
  const opponentText = normalizePlayerSearch(opponentName);
  const scheduled = schedule.find(game => gamePk && String(game.game_pk) === String(gamePk)) || schedule.find(game => {
    const exactTeams = ownId && opponentId && [Number(game.away_id), Number(game.home_id)].includes(Number(ownId)) && [Number(game.away_id), Number(game.home_id)].includes(Number(opponentId));
    const timeClose = Number.isFinite(propTime) && Number.isFinite(Date.parse(game.start_time || "")) && Math.abs(propTime - Date.parse(game.start_time)) < 20 * 60 * 1000;
    const awayMatches = opponentText && [game.away, MLB_TEAM_ABBRS?.[game.away_id]].filter(Boolean).some(name => normalizePlayerSearch(name) === opponentText);
    const homeMatches = opponentText && [game.home, MLB_TEAM_ABBRS?.[game.home_id]].filter(Boolean).some(name => normalizePlayerSearch(name) === opponentText);
    return exactTeams || (timeClose && (awayMatches || homeMatches));
  });
  if (scheduled) {
    const scheduledAway = MLB_TEAM_ABBRS[scheduled.away_id] || scheduled.away;
    const scheduledHome = MLB_TEAM_ABBRS[scheduled.home_id] || scheduled.home;
    return {
      key: String(scheduled.game_pk), label: `${scheduledAway} @ ${scheduledHome}`,
      away: scheduledAway, home: scheduledHome, awayId: scheduled.away_id, homeId: scheduled.home_id,
      opponentName, opponentId, timestamp: Date.parse(scheduled.start_time || suppliedTime),
      commenceTime: scheduled.start_time || suppliedTime,
    };
  }
  const key = String(gamePk || `${away}|${home}|${suppliedTime || "tbd"}`).toLowerCase();
  const label = away && home ? `${away} @ ${home}` : opponentName ? `${isHome ? "vs" : "@"} ${opponentName}` : "Scheduled game";
  return { key, label, away, home, awayId, homeId, opponentName, opponentId, timestamp, commenceTime: suppliedTime };
}

function matchupGameLogo(teamId, teamName) {
  const abbr = String(teamName || "").slice(0, 3).toUpperCase();
  if (!teamId) return abbr ? `<span class="matchup-game-logo-fallback">${escapeHtml(abbr)}</span>` : "";
  return `<span class="matchup-game-logo" data-team-id="${escapeHtml(String(teamId))}"><img src="https://www.mlbstatic.com/team-logos/${encodeURIComponent(teamId)}.svg" alt="${escapeHtml(abbr)}" loading="lazy" onerror="this.nextElementSibling.hidden=false;this.remove()"><small hidden>${escapeHtml(abbr)}</small></span>`;
}

function renderMatchupGamePicker(props) {
  const visible = state.boardFilter === "matchup";
  els.matchupGamePicker.hidden = !visible;
  if (!visible) {
    els.matchupGameMenu.hidden = true;
    els.matchupGameTrigger.setAttribute("aria-expanded", "false");
    return [];
  }
  const gamesByKey = new Map();
  props.forEach((prop) => {
    const game = matchupGameDetails(prop);
    if (!gamesByKey.has(game.key)) gamesByKey.set(game.key, game);
  });
  const games = [...gamesByKey.values()].sort((a, b) => a.timestamp - b.timestamp || `${a.away}${a.home}`.localeCompare(`${b.away}${b.home}`));
  if (state.matchupGameFilter !== "all" && !gamesByKey.has(state.matchupGameFilter)) state.matchupGameFilter = "all";
  const selected = gamesByKey.get(state.matchupGameFilter);
  els.matchupGameLabel.textContent = selected ? selected.label : "All games";
  const triggerIcon = els.matchupGameTrigger.querySelector(".matchup-game-trigger-icon");
  if (triggerIcon) triggerIcon.innerHTML = selected
    ? `<span class="matchup-game-logos trigger-logos">${matchupGameLogo(selected.awayId, selected.away)}${matchupGameLogo(selected.homeId, selected.home)}</span>`
    : `<svg viewBox="0 0 24 24" fill="none"><path d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>`;
  els.matchupGameMeta.textContent = selected && selected.timestamp !== Number.POSITIVE_INFINITY
    ? new Date(selected.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : `${games.length} game${games.length === 1 ? "" : "s"}`;
  const allSelected = state.matchupGameFilter === "all";
  els.matchupGameMenu.innerHTML = `
    <button type="button" class="matchup-game-option${allSelected ? " selected" : ""}" data-matchup-game="all" role="option" aria-selected="${allSelected}">
      <span class="matchup-all-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M4 12h16M4 17h16"/></svg></span>
      <span class="matchup-game-option-copy"><strong>All games</strong><small>Full matchup slate</small></span>
      <span class="matchup-game-count">${games.length}</span>
    </button>
    ${games.map((game) => {
      const selectedGame = game.key === state.matchupGameFilter;
      const time = game.timestamp === Number.POSITIVE_INFINITY ? "Time TBD" : new Date(game.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `<button type="button" class="matchup-game-option${selectedGame ? " selected" : ""}" data-matchup-game="${escapeHtml(game.key)}" role="option" aria-selected="${selectedGame}">
        <span class="matchup-game-logos">${matchupGameLogo(game.awayId, game.away)}${matchupGameLogo(game.homeId, game.home) || matchupGameLogo(game.opponentId, game.opponentName)}</span>
        <span class="matchup-game-option-copy"><strong>${escapeHtml(game.label)}</strong><small>${time}</small></span>
        <svg class="matchup-game-check" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-9"/></svg>
      </button>`;
    }).join("")}`;
  return games;
}

function renderBotBoard(data) {
  const recommendedProps = data.props || [];
  const matchupResearch = data.matchup_research || [];
  const researchPitchers = data.pitcher_research || [];
  const sourceProps = state.boardFilter === "matchup"
    // Matchup is the union of the broad research feed, research-only pitcher
    // rows, and official Strong/Elite props. Replacing official props with
    // matchup_research caused promoted pitchers to disappear from this tab.
    ? [...matchupResearch, ...researchPitchers, ...recommendedProps]
    : state.boardFilter === "strikeouts"
      ? [...recommendedProps, ...researchPitchers]
      : recommendedProps;
  // player_id is optional presentation metadata used for headshots. A scored
  // board row remains valid without it and must still mirror Discord.
  const allProps = sourceProps.map((p, sourceIndex) => ({ ...p, _boardIndex: sourceIndex }));
  renderMatchupGamePicker(allProps.filter((p) => Number.isFinite(matchupNumber(p.stats?.matchup_score))));
  let props = allProps.filter((p) => {
    const filter = state.boardFilter;
    if (filter === "all") return true;
    if (filter === "matchup") return Number.isFinite(matchupNumber(p.stats?.matchup_score));
    return boardStatCategory(p.stat_type) === filter;
  });
  if (state.boardFilter === "matchup" && state.matchupGameFilter !== "all") {
    props = props.filter((prop) => matchupGameDetails(prop).key === state.matchupGameFilter);
  }
  // Sort each view by the score named by that view: Matchup uses the
  // authoritative 0-100 matchup grade; every prop-market tab uses VORTEX.
  props = props.sort((a, b) => {
    const currentMatchup = (p) => Number.isFinite(matchupNumber(p.stats?.matchup_score))
      ? Number(p.stats.matchup_score)
      : -1;
    const matchupDiff = currentMatchup(b) - currentMatchup(a);
    const vortexDiff = (Number(b.vortex_score) || 0) - (Number(a.vortex_score) || 0);
    if (state.boardFilter === "matchup") {
      if (matchupDiff) return matchupDiff;
      if (vortexDiff) return vortexDiff;
      const gameTimeDiff = matchupGameDetails(a).timestamp - matchupGameDetails(b).timestamp;
      if (gameTimeDiff) return gameTimeDiff;
    } else {
      if (vortexDiff) return vortexDiff;
      if (matchupDiff) return matchupDiff;
    }
    const directionalL10 = (p) => {
      const rate = Number(p.stats?.splits?.l10?.rate) || 0;
      return String(p.stats?.side || "over").toLocaleLowerCase() === "under" ? 100 - rate : rate;
    };
    return directionalL10(b) - directionalL10(a);
  });
  if (state.boardFilter === "matchup") {
    // Older cached feeds can contain several markets for one player. Keep
    // the highest-ranked one in the UI as well as deduplicating at publish
    // time, so the fix takes effect immediately after the frontend deploy.
    const seenPlayers = new Set();
    props = props.filter((p) => {
      const key = String(p.player_name || "").trim().toLocaleLowerCase();
      if (!key || seenPlayers.has(key)) return false;
      seenPlayers.add(key);
      return true;
    });
  }
  const totalMatchups = state.boardFilter === "matchup" ? props.length : 0;
  if (state.boardFilter === "matchup") {
    // Always expose every Strong/Elite matchup immediately. Lower grades use
    // progressive batches so a 250-card slate remains smooth on mobile.
    const strongCount = props.filter(p => Number(p.stats?.matchup_score) >= 75).length;
    props = props.slice(0, Math.max(state.matchupDisplayLimit, strongCount));
  }
  props = props.map((p, index) => ({ ...p, _boardIndex: index }));
  state.v2RenderedProps = props;
  const boardUpdatedAt = data.generated_at
    ? new Date(data.generated_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "recently";
  els.v2BoardDate.textContent = props.length
    ? `${state.boardFilter === "matchup" && totalMatchups > props.length ? `${props.length} of ${totalMatchups}` : props.length} ${state.boardFilter === "matchup" ? `matchup${totalMatchups === 1 ? "" : "s"}` : `prop${props.length === 1 ? "" : "s"}`} · updated ${boardUpdatedAt}`
    : "Active board";
  els.v2BoardEmpty.textContent =
    "";
  els.v2BoardList.innerHTML = "";

  if (props.length === 0) {
    els.v2BoardEmpty.innerHTML = `<span class="status-mark" aria-hidden="true"></span><span class="state-copy"><strong>No qualified plays yet</strong><small>The board updates when a prop qualifies.</small></span><button type="button" class="state-refresh" data-empty-refresh>Refresh</button>`;
    els.v2BoardEmpty.hidden = false;
    els.v2BoardEmpty.querySelector("[data-empty-refresh]")?.addEventListener("click", () => loadV2Board(true));
    return;
  }
  els.v2BoardEmpty.hidden = true;

  props.forEach((p, i) => {
    const row = document.createElement("div");
    row.style.animationDelay = `${Math.min(i, 12) * 35}ms`;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");

    const stats = p.stats || {};
    const matchupScore = matchupNumber(stats.matchup_score);
    const matchupCoverage = Number(stats.matchup_coverage);
    // Preserve the f4042bf threshold for labeling limited matchup coverage.
    const lowCoverage = Number.isFinite(matchupCoverage) && matchupCoverage < 0.45;
    const band = !Number.isFinite(matchupScore) ? "none"
      : lowCoverage ? "limited"
      : matchupScore >= 75 ? "strong" : matchupScore >= 65 ? "favorable" : matchupScore >= 55 ? "slight" : matchupScore >= 45 ? "neutral" : matchupScore >= 35 ? "caution" : "unfavorable";
    const matchupText = !Number.isFinite(matchupScore) ? "Matchup not graded"
      : lowCoverage ? `Limited data · ${Math.round(matchupCoverage * 100)}% coverage`
      : boardMatchupLabel(matchupScore).toLowerCase().replace(/^./, (c) => c.toUpperCase());
    const matchupHtml = `<span class="ace-prop-matchup" data-band="${band}">
        <span class="ace-prop-matchup-label">Matchup</span>
        <span class="ace-prop-meter" aria-hidden="true"><i style="width:${Number.isFinite(matchupScore) ? Math.max(4, Math.min(100, matchupScore)) : 0}%"></i></span>
        <span class="ace-prop-matchup-score">${Number.isFinite(matchupScore) ? `<b>${Math.round(matchupScore)}</b>` : ""}<small>${escapeHtml(matchupText)}</small></span>
      </span>`;
    const side = stats.side === "under" ? "Under" : "Over";
    const tier = BOT_TIER[p.tier] || botScoreBadge(p.vortex_score);
    const tierKey = tier.cls.replace("tier-", "");
    const tierText = BOARD_TIER_LABEL[p.tier] || (Number.isFinite(Number(p.vortex_score)) ? `Score ${p.vortex_score}` : "Unrated");
    row.className = "ace-prop v2-row";
    row.dataset.tier = tierKey;

    const playerId = stats.player_id || "";
    let headshotUrl = "";
    if (playerId) {
      if (p.sport === "NBA") {
        headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
      } else {
        headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${playerId}/headshot/silo/current`;
      }
    }
    const headshotHtml = headshotUrl
      ? `<img src="${headshotUrl}" alt="" loading="lazy" onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${playerId}/headshot/67/current'; this.onerror=null;" />`
      : `<span class="ace-prop-initials">${escapeHtml(initialsFor(p.player_name || ""))}</span>`;

    const opponent = stats.opponent || stats.matchup?.opponent || "";
    const team = stats.team_abbr || "";
    const gameTime = p.commence_time ? new Date(p.commence_time) : null;
    const timeStr = gameTime ? gameTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    const isHome = stats.is_home;
    const matchupLine = opponent ? `${team ? `${escapeHtml(team)} ` : ""}${isHome ? "vs" : "@"} ${escapeHtml(opponent)}` : escapeHtml(team);

    const evText = fmtBotEv(p).replace(/^EV /, "");
    const evNumber = Number(p.ev_percentage);
    const evTone = evText === "n/a" || !Number.isFinite(evNumber) || evNumber === 0 ? "" : evNumber > 0 ? "pos" : "neg";
    const l10 = stats.splits?.l10?.rate != null ? `${stats.side === "under" ? 100 - stats.splits.l10.rate : stats.splits.l10.rate}%` : "—";

    row.innerHTML = `
      <span class="ace-prop-top">
        <span class="ace-prop-photo">${headshotHtml}</span>
        <span class="ace-prop-who">
          <span class="ace-prop-name">${escapeHtml(p.player_name)}</span>
          <span class="ace-prop-game">${matchupLine}${timeStr ? `<i aria-hidden="true">·</i>${escapeHtml(timeStr)}` : ""}</span>
        </span>
        <span class="ace-prop-tier">${escapeHtml(tierText)}</span>
      </span>
      <span class="ace-prop-line" data-side="${side.toLowerCase()}"><b>${side}</b><strong>${escapeHtml(String(p.line))}</strong><span>${escapeHtml(p.stat_type)}</span></span>
      <span class="ace-prop-stats">
        <span><small>Score</small><b>${escapeHtml(String(p.vortex_score ?? "—"))}</b></span>
        <span><small>Last 10</small><b>${escapeHtml(l10)}</b></span>
        <span><small>EV</small><b class="${evTone}">${escapeHtml(evText)}</b></span>
      </span>
      ${matchupHtml}
    `;
    const openResearch = () => {
      if (p.sport === "MLB" && BOT_STAT_TO_RESEARCH_STAT[p.stat_type]) {
        deepDiveIntoBotProp(p);
      } else {
        openPlayerDetail(p);
      }
    };
    row.setAttribute("aria-label", `Open ${p.player_name} research`);
    row.addEventListener("click", openResearch);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openResearch(); }
    });
    els.v2BoardList.appendChild(row);
  });
  if (state.boardFilter === "matchup" && props.length < totalMatchups) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "v2-matchup-more";
    more.textContent = `Show 40 more matchups (${totalMatchups - props.length} remaining)`;
    more.addEventListener("click", () => {
      state.matchupDisplayLimit += 40;
      renderBotBoard(state.v2BoardData);
    });
    els.v2BoardList.appendChild(more);
  }
}

function boardStatCategory(statType) {
  const stat = String(statType || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (["hits runs rbis", "hits runs rbi", "hrr", "hrrs"].includes(stat)) return "hrr";
  if (["total bases", "total base", "tb"].includes(stat)) return "total-bases";
  if (["hits", "hit"].includes(stat)) return "hits";
  if (["strikeouts", "strikeout", "pitcher strikeouts", "pitcher strikeout", "ks", "k"].includes(stat)) return "strikeouts";
  if (stat.startsWith("pitcher ") || ["hits allowed", "earned runs", "outs", "pitching outs"].includes(stat)) return "strikeouts";
  return "other";
}

function setGameLogFiltersOpen(open) {
  gameLogState.filtersOpen = Boolean(open);
  clearTimeout(gameLogState.filterCloseTimer);
  if (gameLogState.filtersOpen) {
    if (els.gamelogFilterPanel) {
      els.gamelogFilterPanel.hidden = false;
      els.gamelogFilterPanel.classList.remove("is-closing");
    }
    requestAnimationFrame(() => els.gamelogStudio?.classList.add("filters-open"));
  } else {
    els.gamelogStudio?.classList.remove("filters-open");
    if (els.gamelogFilterPanel && !els.gamelogFilterPanel.hidden) {
      // Hide synchronously so the one-column chart never renders underneath a
      // still-visible drawer during its exit animation.
      els.gamelogFilterPanel.hidden = true;
      els.gamelogFilterPanel.classList.remove("is-closing");
    }
  }
}

function recentGameLogSource() {
  return gameLogState.chart?.all || gameLogState.chart?.l20 || gameLogState.chart?.l15 || gameLogState.chart?.l10 || gameLogState.chart?.l5 || [];
}

function gameLogPool() {
  const source = gameLogState.window === "h2h" ? (gameLogState.chart?.h2h || []) : recentGameLogSource();
  return filterGames(source);
}

function renderLineMovement(prop=activeFinderProp) {
  const card=document.getElementById('gamelog-line-movement'); if(!card||!prop||!isMlbTrend())return;
  const points=propLineHistory(prop), values=points.length?points.map(point=>Number(point.line)):[Number(prop.line)];
  card.querySelector('strong').textContent=values.length>1?`${values[0].toFixed(1)} → ${values.at(-1).toFixed(1)}`:`${Number(prop.line).toFixed(1)} · tracking from now`;
  const min=Math.min(...values)-.5,max=Math.max(...values)+.5,span=Math.max(1,max-min);
  const path=values.map((value,index)=>`${index?'L':'M'} ${values.length===1?50:index/(values.length-1)*100} ${30-(value-min)/span*24}`).join(' ');
  card.querySelector('.line-movement-chart').innerHTML=`<svg viewBox="0 0 100 34" preserveAspectRatio="none" aria-label="Line movement from ${values[0].toFixed(1)} to ${values.at(-1).toFixed(1)}"><path d="${path}"/><circle cx="${values.length===1?50:100}" cy="${30-(values.at(-1)-min)/span*24}" r="2"/></svg>`;
}

function renderFinderCompareTray() {
  const tray=document.getElementById('prop-compare-tray'); if(!tray)return; const props=[...finderCompare.values()];
  tray.hidden=!props.length||state.currentTab!=='v2'; tray.querySelector('span').textContent=`${props.length}/3`;
  tray.querySelector('[data-compare-open]').disabled=props.length<2;
}
function toggleFinderCompare(prop,button) {
  const key=finderPropKey(prop); if(finderCompare.has(key))finderCompare.delete(key);else{if(finderCompare.size>=3)finderCompare.delete(finderCompare.keys().next().value);finderCompare.set(key,prop);}
  button?.classList.toggle('selected',finderCompare.has(key));button?.setAttribute('aria-pressed',String(finderCompare.has(key)));renderFinderCompareTray();
}
function openFinderQuickActions(prop) {
  const sheet=document.getElementById('prop-quick-sheet');sheet.querySelector('h3').textContent=prop.player;sheet.querySelector('p').textContent=`More ${prop.line} ${prop.betType}`;sheet.hidden=false;
  sheet.querySelector('[data-quick=research]').onclick=()=>{sheet.hidden=true;researchFinderProp(prop);};sheet.querySelector('[data-quick=compare]').onclick=()=>{toggleFinderCompare(prop);sheet.hidden=true;};sheet.querySelector('[data-quick=save]').onclick=()=>{toggleSave(prop);sheet.hidden=true;};sheet.querySelector('[data-quick=share]').onclick=()=>{sheet.hidden=true;activeFinderProp=prop;shareGameLogCard();};
}
function wireFinderHold(button,prop) {
  let timer,held=false;button.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')return;held=false;timer=setTimeout(()=>{held=true;openFinderQuickActions(prop);},520);});['pointerup','pointercancel','pointerleave'].forEach(type=>button.addEventListener(type,()=>clearTimeout(timer)));button.addEventListener('click',event=>{if(held){event.preventDefault();event.stopImmediatePropagation();held=false;}},true);button.oncontextmenu=event=>{event.preventDefault();openFinderQuickActions(prop);};
}
function openFinderComparison() {
  const sheet=document.getElementById('prop-comparison-sheet'),props=[...finderCompare.values()];if(props.length<2)return;
  const metric=(prop,key,suffix='%')=>prop.compareValues?.[key]==null?'—':`${key==='diff'&&prop.compareValues[key]>=0?'+':''}${['average','diff'].includes(key)?prop.compareValues[key].toFixed(1):Math.round(prop.compareValues[key])}${suffix}`;
  sheet.querySelector('.comparison-grid').innerHTML=props.map(prop=>`<article><div><strong>${escapeHtml(prop.player)}</strong><span>More ${prop.line} ${escapeHtml(prop.betType)}</span></div><section>${[['AVG','average',''],['DIFF','diff',''],['L5',5,'%'],['L10',10,'%'],['L20',20,'%'],['H2H','h2h','%']].map(([label,key,suffix])=>`<span>${label}<b>${metric(prop,key,suffix)}</b></span>`).join('')}</section><button type="button" data-open-prop="${escapeHtml(finderPropKey(prop))}">Open research</button></article>`).join('');
  sheet.hidden=false;sheet.querySelectorAll('[data-open-prop]').forEach(button=>button.onclick=()=>{sheet.hidden=true;researchFinderProp(finderCompare.get(button.dataset.openProp));});
}
function wireResearchPolish() {
  const researchHead=document.querySelector('#gamelog-overlay .modal-head');
  const placeMobileClose=()=>{if(matchMedia('(max-width:680px)').matches)researchHead.style.setProperty('padding-top','52px','important');else researchHead.style.removeProperty('padding-top');};
  placeMobileClose();window.addEventListener('resize',placeMobileClose,{passive:true});
  const eyeIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>';
  const eyeOffIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.6 6.1A9 9 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M6.6 6.7C3.9 8.4 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
  const movement=document.createElement('section');movement.id='gamelog-line-movement';movement.className='line-movement-card';movement.innerHTML=`<div><span>LINE MOVEMENT</span><strong>Tracking current line</strong></div><div class="line-movement-chart"></div><div class="line-movement-actions"><button type="button" id="gamelog-share-card" aria-label="Share research card"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg></button><button type="button" id="chart-label-toggle" aria-label="Hide chart labels" aria-pressed="true">${eyeIcon}</button></div>`;
  document.querySelector('.gamelog-summary').before(movement);movement.querySelector('#chart-label-toggle').onclick=event=>{const collapsed=els.gamelogOverlay.classList.toggle('chart-labels-collapsed');event.currentTarget.setAttribute('aria-pressed',String(!collapsed));event.currentTarget.setAttribute('aria-label',collapsed?'Show chart labels':'Hide chart labels');event.currentTarget.innerHTML=collapsed?eyeOffIcon:eyeIcon;};
  document.body.insertAdjacentHTML('beforeend','<aside id="prop-compare-tray" class="prop-compare-tray" hidden><span>0/3</span><button type="button" data-compare-open disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v18M3 8l5-5 5 5M16 21V3m-5 13 5 5 5-5"/></svg>Compare props</button><button type="button" data-compare-clear aria-label="Clear comparison"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></aside><section id="prop-comparison-sheet" class="comparison-sheet" role="dialog" aria-modal="true" aria-label="Compare props" hidden><div class="comparison-panel"><header><div><span>SIDE BY SIDE</span><h2>Compare props</h2></div><button type="button" data-compare-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header><div class="comparison-grid"></div></div></section><section id="prop-quick-sheet" class="comparison-sheet quick-sheet" role="dialog" aria-modal="true" aria-label="Prop actions" hidden><div class="comparison-panel"><header><div><h3>Prop</h3><p></p></div><button type="button" data-quick-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header><div class="quick-grid"><button type="button" data-quick="research"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg><span>Open research</span></button><button type="button" data-quick="compare"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v18M3 8l5-5 5 5M16 21V3m-5 13 5 5 5-5"/></svg><span>Add to compare</span></button><button type="button" data-quick="save" data-requires-tab="saved"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2 7.5 14 3 9.6l6.2-.9L12 3Z"/></svg><span>Add to My Slip</span></button><button type="button" data-quick="share"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg><span>Share card</span></button></div></div></section><section id="research-share-sheet" class="comparison-sheet research-share-sheet" role="dialog" aria-modal="true" aria-label="Share research" hidden><div class="comparison-panel"><header><div><span>SHARE STUDIO</span><h2>Create research card</h2></div><button type="button" data-share-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header><div class="share-mode-row"><button type="button" data-share-mode="performance" class="active">Performance</button><button type="button" data-share-mode="trends">Trends</button><button type="button" data-share-mode="matchup">Matchup</button><button type="button" data-share-mode="arsenal">Pitch Arsenal</button></div><div class="share-preview"><span>Building high-resolution card…</span><img alt="Research card preview"></div><div class="share-actions"><button type="button" data-share-download>Save</button><button type="button" data-share-copy>Copy image</button><button type="button" data-share-send>Share</button></div></div></section>');
  document.querySelector('[data-compare-open]').onclick=openFinderComparison;document.querySelector('[data-compare-clear]').onclick=()=>{finderCompare.clear();document.querySelectorAll('.finder-compare-button').forEach(button=>{button.classList.remove('selected');button.setAttribute('aria-pressed','false');});renderFinderCompareTray();};document.querySelector('[data-compare-close]').onclick=()=>document.getElementById('prop-comparison-sheet').hidden=true;
  document.querySelector('[data-quick-close]').onclick=()=>document.getElementById('prop-quick-sheet').hidden=true;
  document.querySelector('[data-share-close]').onclick=()=>document.getElementById('research-share-sheet').hidden=true;
  document.getElementById('gamelog-share-card').onclick=shareGameLogCard;
  const share=document.createElement('button');share.type='button';share.id='gamelog-share';share.setAttribute('aria-label','Share research card');share.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.5-4.4M8.2 13.2l7.5 4.4"/></svg>';share.onclick=shareGameLogCard;document.querySelector('.gamelog-heading').append(share);
  const liveState=document.createElement('span');liveState.id='gamelog-live-state';liveState.className='gamelog-live-state';liveState.textContent='Pre-game';document.querySelector('.gamelog-player-line').append(liveState);
  // Swipe between props: used to close-then-reopen the modal on a timer so
  // the close animation could finish first -- there's no modal to animate
  // shut anymore, so this just repopulates the panel in place.
  let x=0,y=0;document.querySelector('.gamelog-heading').addEventListener('pointerdown',event=>{x=event.clientX;y=event.clientY;});document.querySelector('.gamelog-heading').addEventListener('pointerup',event=>{const dx=event.clientX-x,dy=event.clientY-y;if(Math.abs(dx)<70||Math.abs(dx)<Math.abs(dy)*1.4||finderVisibleProps.length<2)return;let index=finderVisibleProps.findIndex(prop=>finderPropKey(prop)===finderPropKey(activeFinderProp));if(index<0)index=0;openGameLogModal(finderVisibleProps[(index+(dx<0?1:-1)+finderVisibleProps.length)%finderVisibleProps.length]);});
}

async function shareGameLogCard() {
  const prop=activeFinderProp;if(!prop)return;
  const sheet=document.getElementById('research-share-sheet'),preview=sheet.querySelector('.share-preview'),image=preview.querySelector('img');
  sheet.hidden=false;let mode='performance',blob,url,researchProp=prop;
  const hydrate=async()=>{try{const same=currentResearchProp&&nameKey(currentResearchProp.player)===nameKey(prop.player)&&currentResearchProp.betType===prop.betType;if(same)return currentResearchProp;const response=await fetch(`${API_SOURCE}?player=${encodeURIComponent(prop.player)}&stat=${encodeURIComponent(prop.betType)}&line=${Number(gameLogState.line)}&side=over`,{cache:'no-store'});const data=await response.json();if(response.ok&&!data.error)return {...prop,...data,headshot:prop.headshot||data.headshot,oddsType:prop.oddsType||data.oddsType};}catch(_){}return prop;};
  const hydrated=hydrate();
  const rebuild=async()=>{preview.classList.add('loading');preview.querySelector('span').textContent=mode==='matchup'?'Loading live matchup model…':'Building high-resolution card…';researchProp=await hydrated;if(url)URL.revokeObjectURL(url);blob=await buildResearchShareImage(researchProp,mode);url=URL.createObjectURL(blob);image.src=url;preview.classList.remove('loading');};
  sheet.querySelectorAll('[data-share-mode]').forEach(button=>button.onclick=()=>{mode=button.dataset.shareMode;sheet.querySelectorAll('[data-share-mode]').forEach(item=>item.classList.toggle('active',item===button));rebuild();});
  const save=()=>{if(!blob)return;const link=document.createElement('a');link.href=url;link.download=`${nameKey(prop.player)}-${mode}-research.png`;link.click();};
  sheet.querySelector('[data-share-download]').onclick=save;
  sheet.querySelector('[data-share-copy]').onclick=async event=>{if(!blob)return;const button=event.currentTarget,original=button.textContent;try{if(!navigator.clipboard?.write||typeof ClipboardItem==='undefined')throw new Error('unsupported');await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);button.textContent='Copied ✓';}catch(_){button.textContent='Copy unavailable';}setTimeout(()=>button.textContent=original,1600);};
  sheet.querySelector('[data-share-send]').onclick=async()=>{if(!blob)return;const file=new File([blob],`${nameKey(prop.player)}-${mode}-research.png`,{type:'image/png'});try{if(navigator.canShare?.({files:[file]})){await navigator.share({title:`${prop.player} ${mode} research`,files:[file]});return;}}catch(error){if(error?.name==='AbortError')return;}save();};
  await rebuild();
}

async function shareImage(url) {
  if(!url)return null;try{const response=await fetch(url,{mode:'cors'});if(!response.ok)return null;return await createImageBitmap(await response.blob());}catch(_){return null;}
}

async function buildResearchShareImage(prop,mode) {
  const games=gameLogPool().slice(-Math.min(gameLogState.gameCount,20)),line=Number(gameLogState.line),hits=games.filter(game=>Number(game.value)>line).length,avg=games.length?games.reduce((sum,game)=>sum+Number(game.value),0)/games.length:0;
  const canvas=document.createElement('canvas');canvas.width=3840;canvas.height=4800;const c=canvas.getContext('2d');c.scale(3840/2160,4800/2700);const styles=getComputedStyle(document.documentElement),accent=styles.getPropertyValue('--theme-accent').trim()||'#c9ff50';
  const round=(x,y,w,h,r,fill,stroke)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=3;c.stroke();}};
  const text=(value,x,y,size,color='#fff',weight=700,align='left')=>{c.fillStyle=color;c.font=`${weight} ${size}px Inter,system-ui,sans-serif`;c.textAlign=align;c.fillText(String(value),x,y);};
  const wrap=(value,x,y,maxWidth,size,color='#fff',weight=650,lineHeight=size*1.25,maxLines=2)=>{const words=String(value||'').split(/\s+/);let line='',row=0;for(let i=0;i<words.length&&row<maxLines;i++){const next=`${line}${line?' ':''}${words[i]}`;c.font=`${weight} ${size}px Inter,system-ui,sans-serif`;if(c.measureText(next).width>maxWidth&&line){text(line,x,y+row*lineHeight,size,color,weight);line=words[i];row++;}else line=next;}if(line&&row<maxLines)text(line,x,y+row*lineHeight,size,color,weight);};
  const drawContain=(image,x,y,w,h)=>{const iw=image.width||w,ih=image.height||h,scale=Math.min(w/iw,h/ih),dw=iw*scale,dh=ih*scale;c.drawImage(image,x+(w-dw)/2,y+h-dh,dw,dh);};
  const modalHeadshot=document.querySelector('#gamelog-player-cutout img')?.src;const playerUrl=String(modalHeadshot||prop.headshot||'').replace('/headshot/67/current','/headshot/silo/current');const ownTeamId=prop.teamId||MLB_TEAM_IDS[String(prop.teamAbbr||prop.teamName||'').toUpperCase()];const teamUrl=ownTeamId?`/api/mlb-logo?teamId=${ownTeamId}`:'';const opponentId=games.at(-1)?.opponentTeamId||prop.opponentTeamId;const opponentUrl=opponentId?`/api/mlb-logo?teamId=${opponentId}`:'';
  const starterUrl=prop.starterProfile?.id?`https://img.mlbstatic.com/mlb-photos/image/upload/w_500,q_auto:best/v1/people/${encodeURIComponent(prop.starterProfile.id)}/headshot/silo/current`:'';
  const [player,team,opponent,pp,starterPhoto]=await Promise.all([shareImage(playerUrl),shareImage(teamUrl),shareImage(opponentUrl),shareImage('/prizepicks/logo.png'),shareImage(starterUrl)]);
  const gameLogos=await Promise.all(games.map(game=>{const id=game.opponentTeamId||MLB_TEAM_IDS[String(game.opponent||'').toUpperCase()];return shareImage(id?`/api/mlb-logo?teamId=${id}`:'');}));
  const bg=c.createLinearGradient(0,0,2160,2700);bg.addColorStop(0,'#1e1e1e');bg.addColorStop(.45,'#131313');bg.addColorStop(1,'#0a0c0d');c.fillStyle=bg;c.fillRect(0,0,2160,2700);
  const glow=(x,y,r,color)=>{const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);};glow(1760,260,780,'rgba(92,248,178,.24)');glow(180,540,680,'rgba(0,245,138,.18)');glow(420,2480,760,'rgba(0,208,170,.10)');
  c.save();c.globalAlpha=.16;c.strokeStyle='#5cf8b2';c.lineWidth=3;for(let i=0;i<4;i++){c.beginPath();c.moveTo(-100,1880+i*80);c.bezierCurveTo(520,1580+i*70,1260,2260-i*55,2260,1840+i*45);c.stroke();}c.restore();
  round(92,92,1976,2516,68,'rgba(16,19,21,.78)','rgba(92,248,178,.20)');
  round(160,160,1840,116,32,'rgba(255,255,255,.055)');if(pp)c.drawImage(pp,196,188,58,58);text('PROPSCOUT',280,232,39,'#fff',800);text('MLB PLAYER RESEARCH',1960,230,26,'#9d9d9d',700,'right');
  if(player){c.save();c.shadowColor='rgba(0,0,0,.38)';c.shadowBlur=26;c.shadowOffsetY=18;drawContain(player,120,302,490,458);c.restore();}else{round(150,330,430,430,60,'rgba(255,255,255,.035)','rgba(255,255,255,.08)');text(prop.player?.split(' ').map(v=>v[0]).join('').slice(0,2)||'MLB',365,585,100,'#fff',800,'center');}
  if(team){round(480,615,132,132,38,'rgba(255,255,255,.05)','rgba(255,255,255,.1)');drawContain(team,494,629,104,104);}if(opponent){round(625,625,112,112,34,'rgba(255,255,255,.04)','rgba(255,255,255,.09)');drawContain(opponent,639,639,84,84);}
  text(prop.player,650,455,82,'#fff',850);text(`${gameLogState.window==='h2h'?'H2H':`LAST ${games.length}`} · ${gameLogState.stat}`,650,530,30,'#a1a1a1',750);round(650,558,72,72,22,'rgba(255,255,255,.06)','rgba(255,255,255,.12)');c.strokeStyle=accent;c.lineWidth=7;c.lineCap='round';[[672,604,672,589],[686,604,686,575],[700,604,700,566]].forEach(v=>{c.beginPath();c.moveTo(v[0],v[1]);c.lineTo(v[2],v[3]);c.stroke();});text(`MORE ${line.toFixed(1)}`,744,618,62,accent,850);if(pp)c.drawImage(pp,650,660,54,54);text(prop.oddsType==='goblin'?'GOBLIN · MORE ONLY':prop.oddsType==='demon'?'DEMON · MORE ONLY':'PRIZEPICKS · STANDARD',724,703,25,'#c0c0c0',750);if(prop.matchup?.opponent){round(650,742,760,62,22,'rgba(140,140,140,.10)','rgba(140,140,140,.28)');text(`${prop.isHome===false?'AT':'VS'} ${String(prop.matchup.opponent).toUpperCase()}`,684,783,22,'#d6d6d6',800);}
  round(160,850,1840,260,34,'rgba(255,255,255,.018)','rgba(255,255,255,.105)');const metrics=[['HIT RATE',games.length?`${Math.round(hits/games.length*100)}%`:'—'],['RECORD',`${hits}–${games.length-hits}`],['AVERAGE',games.length?avg.toFixed(2):'—']];metrics.forEach(([label,value],i)=>{const x=160+i*613;if(i){c.strokeStyle='rgba(255,255,255,.09)';c.lineWidth=2;c.beginPath();c.moveTo(x,890);c.lineTo(x,1070);c.stroke();}c.fillStyle=i===0?accent:'rgba(255,255,255,.18)';c.fillRect(x+42,884,54,5);text(label,x+42,932,25,'#b8b8b8',780);text(value,x+42,1030,76,i===0?accent:'#fff',850);});
  text(mode==='performance'?'GAME PERFORMANCE':mode==='trends'?'RECENT TRENDS':mode==='arsenal'?'BATTER VS PITCH ARSENAL':'MATCHUP SNAPSHOT',160,1245,30,accent,800);
  if(mode==='arsenal'){
    const starter=prop.starterProfile||{},pitches=(prop.pitchArsenal||[]).slice(0,5),pitchColors=['#00f58a','#ffb000','#7a7a7a','#ff2768','#35d980'];
    round(160,1300,1840,270,38,'rgba(35,35,35,.74)','rgba(0,245,138,.38)');if(starterPhoto)drawContain(starterPhoto,1570,1315,250,238);text('VS',1475,1428,34,accent,850,'center');text(starter.name||'Probable starter',200,1390,48,'#fff',850);text(`${starter.hand||'?'}HP · ${starter.era??'—'} ERA · ${starter.whip??'—'} WHIP`,200,1450,27,'#bdbdbd',700);text(`${starter.kPer9??'—'} K/9 · ${starter.bbPer9??'—'} BB/9`,200,1500,24,'#979797',650);
    text('PITCH',200,1640,21,'#9c9c9c',800);text('USAGE',880,1640,21,'#9c9c9c',800,'right');text('AVG',1115,1640,21,'#9c9c9c',800,'right');text('SLG',1360,1640,21,'#9c9c9c',800,'right');text('wOBA',1595,1640,21,'#9c9c9c',800,'right');text('K%',1900,1640,21,'#9c9c9c',800,'right');
    pitches.forEach((pitch,i)=>{const y=1680+i*142,bv=pitch.batterVs||{},color=pitchColors[i%pitchColors.length];round(160,y,1840,116,24,'rgba(255,255,255,.025)','rgba(255,255,255,.075)');c.fillStyle=color;c.fillRect(160,y,9,116);round(194,y+28,58,58,29,`${color}20`,color);text(String(pitch.code||'P').slice(0,2),223,y+67,18,color,850,'center');text(pitch.name||pitch.code||'Pitch',280,y+70,28,'#fff',800);text(`${Number(pitch.pct||0).toFixed(1)}%`,880,y+70,27,'#e1e1e1',750,'right');text(bv.avg??'—',1115,y+70,27,'#fff',750,'right');text(bv.slg??'—',1360,y+70,27,'#fff',750,'right');text(bv.woba??'—',1595,y+70,27,'#fff',750,'right');text(bv.kPct!=null?`${bv.kPct}%`:'—',1900,y+70,27,Number(bv.kPct)>=30?'#ff6475':'#fff',750,'right');});
    if(!pitches.length){round(160,1680,1840,300,32,'rgba(255,255,255,.025)','rgba(255,255,255,.075)');text('Pitch arsenal data is loading',1080,1845,36,'#adadad',750,'center');}
    text('Current-season batter results against each pitch type',160,2440,23,'#a3a3a3',650);
  }else if(mode==='matchup'){
    const matchup=prop.matchup||{},score=matchupNumber(prop.matchupScore??prop.stats?.matchup_score),scoreValue=Number.isFinite(score)?Math.round(score):null;
    const scoreTone=scoreValue==null?'#a7a7a7':scoreValue>=65?'#35e6a7':scoreValue>=45?'#ffd166':'#ff6475';
    const scoreLabel=prop.matchupLabel||(scoreValue==null?'DATA PENDING':scoreValue>=65?'FAVORABLE':scoreValue>=45?'NEUTRAL':'TOUGH');
    round(160,1300,1840,280,38,'rgba(32,32,32,.96)','rgba(255,255,255,.11)');
    const gauge=c.createLinearGradient(200,0,760,0);gauge.addColorStop(0,'#ff5267');gauge.addColorStop(.5,'#ffd166');gauge.addColorStop(1,'#35e6a7');round(200,1500,560,16,8,'rgba(255,255,255,.08)');if(scoreValue!=null)round(200,1500,Math.max(16,560*scoreValue/100),16,8,gauge);
    text('MATCHUP SCORE',200,1360,23,'#adadad',800);text(scoreValue==null?'—':`${scoreValue}`,200,1460,92,scoreTone,850);text('/100',365,1455,32,'#999999',700);text(scoreLabel,760,1395,39,'#fff',850);text(`${Math.round(Number(prop.matchupCoverage||0)*100)}% DATA COVERAGE`,760,1442,22,'#adadad',750);
    wrap(matchup.pitcher||prop.starterProfile?.name||prop.stats?.pitcher_name||'Probable starter pending',1290,1387,650,35,'#fff',780,44,2);text(matchup.opponent?`VS ${String(matchup.opponent).toUpperCase()}`:'LIVE MATCHUP',1290,1490,22,accent,800);

    const factors=(prop.matchupFactors||prop.stats?.matchup_factors||[]).slice(0,6);text('WHAT DRIVES THE MATCHUP',160,1640,24,'#b8b8b8',800);
    const factorFallback=[['Platoon split',matchup.handedness||'Season handedness split'],['Pitch mix',prop.pitchArsenal?.length?`${prop.pitchArsenal.length} pitch types tracked`:'Arsenal fit pending'],['Recent form','Current-season performance'],['Park factor',matchup.park||'Game environment']];
    const factorRows=(factors.length?factors.map(f=>[f.name,formatMatchupDetail(f.detail),Number(f.impact||0)]):factorFallback.map(f=>[f[0],f[1],null])).slice(0,6);
    factorRows.forEach(([name,detail,impact],i)=>{const col=i%2,row=Math.floor(i/2),x=160+col*925,y=1680+row*170,tone=impact==null?'#a8a8a8':impact>0?'#35e6a7':impact<0?'#ff6475':'#d4d7d8';round(x,y,895,144,28,'rgba(255,255,255,.045)','rgba(255,255,255,.09)');round(x+24,y+28,58,58,18,`${tone}22`,`${tone}66`);text(impact==null?'•':impact>0?'↑':impact<0?'↓':'=',x+53,y+70,31,tone,850,'center');text(name||'Matchup factor',x+104,y+53,28,'#fff',800);wrap(detail||'Live model input',x+104,y+91,650,20,'#adadad',600,25,2);if(impact!=null)text(`${impact>0?'+':''}${impact}`,x+855,y+82,31,tone,850,'right');});

    const split=prop.split||{},arsenal=prop.pitchArsenal||[],bvp=prop.bvpCard||{};const topPitches=arsenal.slice(0,3).map(p=>p.name||p.pitchName||p.type||p.code).filter(Boolean).join(' · ');
    const venueHome=prop.isHome===true,venueRoad=prop.isHome===false,homeText=`${split.homeAvg??'—'} AVG · ${split.homeOverRate??'—'}% over`,roadText=`${split.roadAvg??'—'} AVG · ${split.roadOverRate??'—'}% over`;
    const insights=[
      ['PLATOON',matchup.handedness||bvp.splitFallback?.summary||'Current-season handedness data pending'],
      ['PITCH MIX',topPitches||matchup.arsenal||'Starter arsenal data pending'],
      [venueHome?'HOME · TONIGHT':venueRoad?'AWAY · TONIGHT':'HOME / AWAY',`Home ${homeText}  |  Away ${roadText}`],
      ['BULLPEN',matchup.bullpen||matchup.leash||'Relief context pending']
    ];
    insights.forEach(([label,value],i)=>{const col=i%2,row=Math.floor(i/2),x=160+col*925,y=2210+row*154;round(x,y,895,128,26,'rgba(46,46,46,.76)','rgba(255,255,255,.08)');text(label,x+28,y+43,20,accent,820);wrap(value,x+28,y+82,830,22,'#f4f7f6',650,28,2);});
  }else{
    const max=Math.max(line+1,...games.map(game=>Number(game.value)||0),1),baseY=2270,chartH=760,gap=18,barW=Math.max(42,(1690-gap*Math.max(0,games.length-1))/Math.max(1,games.length));round(160,1300,1840,1100,38,'rgba(12,14,16,.48)','rgba(255,255,255,.085)');
    [0,.5,1].forEach(step=>{const y=baseY-chartH*step;c.strokeStyle='rgba(255,255,255,.055)';c.lineWidth=2;c.beginPath();c.moveTo(220,y);c.lineTo(1940,y);c.stroke();text((max*step).toFixed(max<4?1:0),190,y+8,18,'#767676',650,'right');});
    games.forEach((game,i)=>{const value=Number(game.value)||0,x=235+i*(barW+gap),h=Math.max(12,value/max*chartH),hit=value>line,bar=c.createLinearGradient(0,baseY-h,0,baseY);bar.addColorStop(0,hit?'#35e89b':'#ff6170');bar.addColorStop(1,hit?'#0da75b':'#d92843');round(x,baseY-h,barW,h,Math.min(18,barW/3),bar);round(x+Math.max(0,(barW-56)/2),baseY-h-58,Math.min(56,barW),36,18,hit?'rgba(53,232,155,.14)':'rgba(255,97,112,.14)');text(value,x+barW/2,baseY-h-32,20,'#fff',850,'center');if(gameLogos[i]){round(x+barW/2-25,baseY+18,50,50,25,'rgba(255,255,255,.055)','rgba(255,255,255,.10)');drawContain(gameLogos[i],x+barW/2-19,baseY+24,38,38);}else{text(String(game.opponent||'').slice(0,3).toUpperCase(),x+barW/2,baseY+50,18,'#aaaaaa',800,'center');}});c.strokeStyle=accent;c.lineWidth=4;c.setLineDash([16,12]);const lineY=baseY-line/max*chartH;c.beginPath();c.moveTo(210,lineY);c.lineTo(1950,lineY);c.stroke();c.setLineDash([]);round(1760,lineY-48,180,38,19,'rgba(11,13,14,.9)',accent);text(`${line.toFixed(1)} LINE`,1850,lineY-22,18,accent,850,'center');text(`${hits} CLEARED · ${games.length-hits} MISSED`,1940,2370,20,'#9e9e9e',750,'right');
  }
  text('PROPSCOUT',160,2510,27,'#fff',800);text(`${new Date().toLocaleDateString()} · Research only`,2000,2510,23,'#8d8d8d',600,'right');return await new Promise(resolve=>canvas.toBlob(resolve,'image/png',1));
}

/* ---------- Slip share card ---------- */
// Same idea as the single-player research card above, but for a whole
// saved slip -- a branded image of every leg, made to post to Discord or
// the Community feed rather than screenshot the app's own UI directly.
async function buildSlipShareImage(legs) {
  const scale = 3840 / 2160;
  const rowH = 260, headerH = 560, footerH = 180;
  const logicalH = headerH + legs.length * rowH + footerH;
  const canvas = document.createElement("canvas");
  canvas.width = 3840;
  canvas.height = Math.round(logicalH * scale);
  const c = canvas.getContext("2d");
  c.scale(scale, scale);
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--theme-accent").trim() || "#828282";
  const secondary = styles.getPropertyValue("--theme-secondary").trim() || "#e1e1e1";
  const round = (x, y, w, h, r, fill, stroke, strokeWidth = 3) => { c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = strokeWidth; c.stroke(); } };
  const circle = (x, y, r, fill, stroke, strokeWidth = 3) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = strokeWidth; c.stroke(); } };
  const text = (value, x, y, size, color = "#fff", weight = 700, align = "left") => { c.fillStyle = color; c.font = `${weight} ${size}px Inter,system-ui,sans-serif`; c.textAlign = align; c.fillText(String(value), x, y); };
  const glow = (x, y, r, color) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); };
  const drawContain = (image, x, y, w, h) => { const iw = image.width || w, ih = image.height || h, scaleFit = Math.min(w / iw, h / ih), dw = iw * scaleFit, dh = ih * scaleFit; c.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };
  const clipCircleDraw = (image, cx, cy, r) => { c.save(); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip(); drawContain(image, cx - r, cy - r, r * 2, r * 2); c.restore(); };
  const triangle = (cx, cy, size, up, color) => { c.fillStyle = color; c.beginPath(); if (up) { c.moveTo(cx, cy - size); c.lineTo(cx - size, cy + size * .7); c.lineTo(cx + size, cy + size * .7); } else { c.moveTo(cx, cy + size); c.lineTo(cx - size, cy - size * .7); c.lineTo(cx + size, cy - size * .7); } c.closePath(); c.fill(); };
  const loadImg = async (url) => { if (!url) return null; try { const response = await fetch(url, { mode: "cors" }); if (!response.ok) return null; return await createImageBitmap(await response.blob()); } catch (_) { return null; } };
  const headshots = await Promise.all(legs.map((leg) => loadImg(leg.headshot ? String(leg.headshot).replace("/headshot/67/current", "/headshot/silo/current") : "")));
  const teamLogos = await Promise.all(legs.map((leg) => { const id = leg.teamId || MLB_TEAM_IDS[String(leg.team || "").toUpperCase()]; return loadImg(id ? `/api/mlb-logo?teamId=${id}` : ""); }));

  // Base gradient + ambient glows + faint accent streaks, same technique as
  // the single-player research card, so the two share styles feel like one
  // family instead of two different products.
  const bg = c.createLinearGradient(0, 0, 2160, logicalH);
  bg.addColorStop(0, "#1e1e1e"); bg.addColorStop(.5, "#131313"); bg.addColorStop(1, "#0a0c0d");
  c.fillStyle = bg; c.fillRect(0, 0, 2160, logicalH);
  glow(1820, 140, 720, `${accent}30`);
  glow(160, logicalH - 200, 640, "rgba(122,122,122,.16)");
  c.save(); c.globalAlpha = .14; c.strokeStyle = accent; c.lineWidth = 3;
  for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-100, 260 + i * 90); c.bezierCurveTo(700, 40 + i * 70, 1500, 420 - i * 55, 2260, 120 + i * 45); c.stroke(); }
  c.restore();

  round(80, 80, 2000, logicalH - 160, 64, "rgba(16,19,21,.80)", "rgba(92,248,178,.22)");

  // Header
  round(140, 140, 900, 96, 26, "rgba(255,255,255,.055)");
  const brandDot = c.createLinearGradient(164, 164, 212, 212); brandDot.addColorStop(0, accent); brandDot.addColorStop(1, `color-mix(in srgb, ${accent} 60%, #7a7a7a)`);
  circle(188, 188, 24, brandDot); text("K", 188, 198, 24, "#fff", 900, "center");
  text("PROPSCOUT", 236, 197, 32, "#fff", 800);
  round(1400, 152, 620, 72, 22, "rgba(255,255,255,.045)", "rgba(255,255,255,.10)");
  text(new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), 2000, 197, 26, "#cecece", 700, "right");

  text(`${legs.length}-LEG PARLAY`, 140, 400, 96, "#fff", 850);
  c.fillStyle = accent; c.fillRect(140, 424, 210, 10);
  const sportBadges = [...new Set(legs.map((leg) => leg.sport).filter(Boolean))];
  let badgeX = 140;
  sportBadges.forEach((sport) => { const w = 26 + sport.length * 17; round(badgeX, 460, w, 56, 16, `${accent}22`, `${accent}55`); text(sport.toUpperCase(), badgeX + w / 2, 496, 22, accent, 800, "center"); badgeX += w + 14; });
  text("Research only · not betting advice", 2020, 496, 24, "#999999", 650, "right");
  c.strokeStyle = "rgba(255,255,255,.10)"; c.lineWidth = 2; c.beginPath(); c.moveTo(140, headerH - 30); c.lineTo(2020, headerH - 30); c.stroke();

  legs.forEach((leg, i) => {
    const y = headerH + i * rowH, h = rowH - 34;
    const sideUp = String(leg.side || "over").toLowerCase() !== "under";
    const sideColor = sideUp ? "#35e89b" : "#ff6170";
    const rowFill = c.createLinearGradient(140, y, 2020, y);
    rowFill.addColorStop(0, `${sideColor}14`); rowFill.addColorStop(.18, "rgba(255,255,255,.03)"); rowFill.addColorStop(1, "rgba(255,255,255,.02)");
    round(140, y, 1880, h, 30, rowFill, "rgba(255,255,255,.09)");
    c.fillStyle = sideColor; round(140, y, 10, h, 5, sideColor);
    const cx = 250, cy = y + h / 2, r = 92;
    circle(cx, cy, r + 6, null, `${sideColor}80`, 5);
    if (headshots[i]) { circle(cx, cy, r, "rgba(255,255,255,.05)"); clipCircleDraw(headshots[i], cx, cy, r); }
    else { circle(cx, cy, r, "rgba(255,255,255,.055)"); text((leg.player || "?").split(" ").map((v) => v[0]).join("").slice(0, 2).toUpperCase(), cx, cy + 16, 46, "#fff", 800, "center"); }
    if (teamLogos[i]) { circle(cx + r - 14, cy + r - 14, 38, "#1a1a1a", "rgba(255,255,255,.25)", 4); drawContain(teamLogos[i], cx + r - 14 - 26, cy + r - 14 - 26, 52, 52); }
    const textX = 380;
    text(leg.player || "Player", textX, y + 88, 48, "#fff", 800);
    const meta = [leg.team, leg.sport].filter(Boolean).join(" · ").toUpperCase();
    if (meta) { const mw = c.measureText(meta).width + 32; round(textX, y + 110, mw, 44, 14, "rgba(255,255,255,.06)"); text(meta, textX + 16, y + 140, 21, "#b8b8b8", 750); }
    if (leg.tierIcon || leg.score != null) { const label = `${leg.tierIcon || "⭐"} ${leg.score ?? ""}`.trim(); const tw = c.measureText(label).width + 36; round(textX, y + h - 60, tw, 44, 14, `${accent}1c`, `${accent}45`); text(label, textX + 18, y + h - 30, 22, accent, 800); }

    const pillW = 560, pillX = 1460, pillY = y + h / 2 - 66;
    const pillFill = c.createLinearGradient(pillX, pillY, pillX + pillW, pillY);
    pillFill.addColorStop(0, `${sideColor}26`); pillFill.addColorStop(1, `${sideColor}0d`);
    round(pillX, pillY, pillW, 132, 26, pillFill, `${sideColor}70`, 4);
    triangle(pillX + 66, pillY + 66, 22, sideUp, sideColor);
    text(`${sideUp ? "OVER" : "UNDER"} ${leg.line}`, pillX + 116, pillY + 62, 42, sideColor, 850);
    text(String(leg.betType || "").toUpperCase(), pillX + 116, pillY + 100, 22, "#e1e1e1", 700);
  });

  c.strokeStyle = "rgba(255,255,255,.10)"; c.lineWidth = 2; c.beginPath(); c.moveTo(140, logicalH - footerH + 20); c.lineTo(2020, logicalH - footerH + 20); c.stroke();
  circle(164, logicalH - 96, 20, brandDot); text("K", 164, logicalH - 88, 20, "#fff", 900, "center");
  text("PROPSCOUT", 200, logicalH - 84, 27, "#fff", 800);
  text("Share your own picks — PropScout", 2020, logicalH - 84, 23, secondary || "#a9a9a9", 650, "right");
  return await new Promise((resolve) => canvas.toBlob(resolve, "image/png", 1));
}

async function shareSlipCard() {
  const legs = getSavedProps();
  if (!legs.length) return;
  const sheet = document.getElementById("slip-share-sheet");
  const preview = sheet.querySelector(".share-preview");
  const image = preview.querySelector("img");
  sheet.hidden = false;
  preview.classList.add("loading");
  preview.querySelector("span").textContent = "Building high-resolution card…";
  let blob = await buildSlipShareImage(legs);
  let url = URL.createObjectURL(blob);
  image.src = url;
  preview.classList.remove("loading");
  sheet.querySelector("[data-share-close]").onclick = () => { sheet.hidden = true; };
  const save = () => { if (!blob) return; const link = document.createElement("a"); link.href = url; link.download = `krazy-data-${legs.length}-leg-parlay.png`; link.click(); };
  sheet.querySelector("[data-share-download]").onclick = save;
  sheet.querySelector("[data-share-copy]").onclick = async (event) => {
    if (!blob) return;
    const button = event.currentTarget, original = button.textContent;
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("unsupported");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      button.textContent = "Copied ✓";
    } catch (_) { button.textContent = "Copy unavailable"; }
    setTimeout(() => { button.textContent = original; }, 1600);
  };
  sheet.querySelector("[data-share-send]").onclick = async () => {
    if (!blob) return;
    const file = new File([blob], `krazy-data-${legs.length}-leg-parlay.png`, { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ title: `${legs.length}-leg parlay`, files: [file] }); return; }
    } catch (error) { if (error?.name === "AbortError") return; }
    save();
  };
}

function wireSlipShare() {
  if (!els.shareSlipBtn) return;
  if (!document.getElementById("slip-share-sheet")) {
    document.body.insertAdjacentHTML("beforeend", '<section id="slip-share-sheet" class="comparison-sheet research-share-sheet" role="dialog" aria-modal="true" aria-label="Share slip" hidden><div class="comparison-panel"><header><div><span>SHARE STUDIO</span><h2>Share your slip</h2></div><button type="button" data-share-close aria-label="Close"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header><div class="share-preview"><span>Building high-resolution card…</span><img alt="Slip card preview"></div><div class="share-actions"><button type="button" data-share-download>Save</button><button type="button" data-share-copy>Copy image</button><button type="button" data-share-send>Share</button></div></div></section>');
  }
  els.shareSlipBtn.addEventListener("click", shareSlipCard);
}

function setGameLogCount(value, direction = "initial") {
  const viewportState=captureGameLogViewport();
  const max = Math.max(1, gameLogPool().length);
  gameLogState.gameCount = Math.max(1, Math.min(max, Number(value) || 1));
  gameLogState.window = "recent";
  gameLogState.animationDirection = direction;
  renderGameLogTabs();
  renderGameLogChart();
  restoreGameLogViewport(viewportState);
}

// Click handler for the window-tabs bar (L5/L10/L15/L20/Season/H2H) --
// numeric/Season windows just set the sample size like setGameLogCount()
// always has; H2H is its own toggle since it isn't a sample-size at all.
function setGameLogWindow(key) {
  if (key === "h2h") {
    const viewportState = captureGameLogViewport();
    const toH2H = gameLogState.window !== "h2h";
    gameLogState.window = toH2H ? "h2h" : "recent";
    gameLogState.windowKey = toH2H ? "h2h" : String(gameLogState.gameCount);
    gameLogState.animationDirection = "none";
    renderGameLogTabs();
    renderGameLogChart();
    restoreGameLogViewport(viewportState);
    return;
  }
  gameLogState.windowKey = key;
  const filtered = filterGames(recentGameLogSource());
  setGameLogCount(key === "season" ? filtered.length : key === "year" ? Math.max(1, latestSeason(filtered).count) : Number(key), "none");
}

/* Expanded card — Silas-style emoji-rich format */
function buildBotDetailHtml(p, i) {
  const stats = p.stats || {};
  const splits = stats.splits || {};
  const pitcher = stats.pitcher || {};
  const bvp = stats.bvp || null;
  const sidePfx = stats.side === "under" ? "Under" : "Over";

  const hitEmoji = (rate) => (rate >= 80 ? "🔥" : rate >= 60 ? "✅" : rate >= 40 ? "⚠️" : "❌");
  const fmtRate = (r) =>
    r && typeof r.rate === "number"
      ? `${hitEmoji(r.rate)} ${r.rate}% (${r.hits}/${r.games})`
      : "n/a";

  // Trend line
  const streak = (splits.l5 && splits.l5.streak) || 0;
  const seasonAvg = splits.season_avg != null ? splits.season_avg : null;
  const l5Rate = splits.l5 && typeof splits.l5.rate === "number" ? splits.l5.rate : null;
  const l20Rate = splits.l20 && typeof splits.l20.rate === "number" ? splits.l20.rate : null;
  const trendLine = l5Rate != null && l20Rate != null
    ? `📈 Trending ${l5Rate > l20Rate ? "up" : l5Rate < l20Rate ? "down" : "steady"} — ${l5Rate}% L5 vs ${l20Rate}% L20.`
    : "";

  // Streak line
  const streakLine = streak >= 4
    ? `🔥 Active ${streak}-game hit streak.`
    : streak <= -3
    ? `⚠️ ${Math.abs(streak)}-game miss streak.`
    : "";

  // Season avg line
    const seasonLine = seasonAvg != null
    ? `📊 Season avg ${seasonAvg} over ${splits.games_played ?? "—"} games.`
    : "";

  const l5 = splits.l5?.rate, l10 = splits.l10?.rate, l20 = splits.l20?.rate;
  let html = `<div class="v2-detail-toolbar"><button type="button" class="v2-detail-close" aria-label="Close expanded matchup">× <span>Close</span></button></div><div class="board-analysis-summary">
    <div><span>PRICE</span><strong>${escapeHtml(fmtBotEv(p))}</strong><small>${escapeHtml(p.sportsbook || "Best available")}${typeof stats.best_odds === "number" ? ` · ${stats.best_odds > 0 ? "+" : ""}${stats.best_odds}` : ""}</small></div>
    <div><span>RECENT</span><strong>${typeof l10 === "number" ? `${l10}% L10` : "No sample"}</strong><small>${typeof l5 === "number" ? `${l5}% L5` : "L5 —"}${typeof l20 === "number" ? ` · ${l20}% L20` : ""}</small></div>
    <div><span>MATCHUP</span><strong>${Number.isFinite(matchupNumber(stats.matchup_score)) ? `${Math.round(Number(stats.matchup_score))}/100` : "Not graded"}</strong><small>${escapeHtml(boardMatchupLabel(stats.matchup_score) || "Coverage unavailable")}</small></div>
  </div><div class="board-analysis-case"><div><span>CASE</span><p>${escapeHtml(cleanAnalysisText(p.case_summary || "Model and matchup signals align with this side."))}</p></div><div class="risk"><span>RISK</span><p>${escapeHtml(cleanAnalysisText(p.risk_summary || "No material conflict reported."))}</p></div></div>`;

  if (Number.isFinite(matchupNumber(stats.matchup_score)) && (stats.matchup_factors || []).length) {
    const factors = stats.matchup_factors.slice().sort((a,b) => Math.abs(Number(b.score)-50)-Math.abs(Number(a.score)-50)).slice(0,3).map((factor) => `<div class="board-factor-row"><div><strong>${escapeHtml(factor.name || "Factor")}</strong><small>${escapeHtml(cleanAnalysisText(factor.detail || ""))}</small></div><b>${escapeHtml(String(factor.score ?? "—"))}</b></div>`).join("");
    html += `
      <div class="board-factor-table"><div class="board-factor-head"><span>Key matchup drivers</span><small>Top 3 by signal strength</small></div>${factors}</div>`;
  }

  // Matchup with pitcher
  if (pitcher.name) {
    html += `<div class="board-matchup-line"><span>OPPOSING PITCHER</span><p><strong>${escapeHtml(pitcher.name)}</strong> · ${escapeHtml(pitcher.hand ?? "?")}HP · ERA ${pitcher.era ?? "—"} · FIP ${pitcher.fip ?? "—"} · K/9 ${pitcher.k_per_9 ?? "—"} · HR/9 ${pitcher.hr_per_9 ?? "—"} · WHIP ${pitcher.whip ?? "—"}</p>${stats.platoon_note ? `<small>${escapeHtml(cleanAnalysisText(stats.platoon_note))}</small>` : ""}</div>`;
  }

  // BvP
  if (bvp && bvp.ab >= 5) html += `<div class="board-bvp-line"><span>BvP</span><p>${bvp.ab} AB · AVG ${bvp.avg} · ${bvp.hr} HR · ${bvp.k} K · OPS ${bvp.ops}</p></div>`;

  const canDeepDive = p.sport === "MLB" && BOT_STAT_TO_RESEARCH_STAT[p.stat_type];
  const detailBtns = [];
  detailBtns.push(`<button type="button" class="v2-deepdive-btn" data-v2-idx="${i}" style="margin-right:8px">View Details</button>`);
  if (canDeepDive) {
    detailBtns.push(`<button type="button" class="v2-deepdive-btn" data-v2-idx="${i}">Deep Dive →</button>`);
  }
  html += `<div class="board-analysis-actions">${detailBtns.join("")}</div>`;
  return html;
}

/* Sends a board card's exact player/stat/line/side into the Research tab for
   the full breakdown, and remembers where to snap back to so "Back to Props"
   isn't a dead end. MLB only — Research has no NBA/WNBA pipeline. */
function deepDiveIntoBotProp(p) {
  const stat = BOT_STAT_TO_RESEARCH_STAT[p.stat_type];
  if (!stat || p.sport !== "MLB") return;

  state.v2DeepDiveReturn = { scrollY: window.scrollY };
  const boardStats = p.stats || {};
  state.boardResearchContext = {
    player: p.player_name,
    stat,
    line: Number(p.line),
    side: boardResearchSide(p).toLowerCase(),
    vortexScore: p.vortex_score,
    tier: p.tier,
    matchupScore: boardStats.matchup_score,
    matchupLabel: boardStats.matchup_label,
    matchupCoverage: boardStats.matchup_coverage,
    matchupFactors: boardStats.matchup_factors || [],
    matchupContext: boardStats.matchup_context,
  };
  els.v2BackBtn.hidden = false;

  const isPitcher = BOT_PITCHER_STATS.has(p.stat_type);
  selectPlayer(p.player_name, isPitcher ? "P" : null, { autoSelectStat: false, viaDeepDive: true,
    playerEntry: { player: p.player_name, name: p.player_name, playerId: boardStats.player_id, teamId: boardStats.team_id, sport: "MLB" } });
  selectStat(stat);

  cmd.side = boardResearchSide(p);
  els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === cmd.side));
  setLineValue(p.line, { immediate: true });

  switchTab("research", { scrollY: 0 });
}

/* ---------- V2 Admin panel (hidden, PIN-gated) ---------- */

let v2PinUnmount = null;
function closeV2PinPrompt() {
  v2PinUnmount?.();
  v2PinUnmount = null;
}
function openV2PinPrompt() {
  closeV2PinPrompt();
  const host = document.createElement("div");
  document.body.append(host);
  v2PinUnmount = window.vortexMountAdminPin(host, {
    onClose: () => { closeV2PinPrompt(); host.remove(); },
    onUnlocked: async () => {
      closeV2PinPrompt();
      host.remove();
      try {
        state.adminUnlocked = true;
        await refreshSiteAccess();
        switchTab("admin");
      } catch (err) {
        showToast(err.message || "Could not load admin results.", "warn");
      }
    },
  });
}

function openAdminPanel() {
  els.v2AdminOverlay.hidden = false;
  els.v2AdminKeyMsg.textContent = "";
  els.v2AdminScanMsg.textContent = "";
  refreshAdminKeyStatus();
}

// The admin endpoint always tries to answer in JSON, but a hard platform
// failure (function crash before our handler runs, gateway timeout) comes
// back as Vercel's plain-text error page — res.json() on that throws
// "Unexpected token 'A' …". Fall back to a readable error object instead.
async function readAdminJson(res) {
  try {
    return await res.json();
  } catch {
    return { error: `Server error (HTTP ${res.status}) — check the Vercel function logs.` };
  }
}

async function refreshAdminKeyStatus() {
  els.v2AdminKeyStatus.textContent = "Checking…";
  try {
    const res = await fetch("/api/v2-admin?action=key-status", { credentials: "same-origin" });
    const data = await readAdminJson(res);
    if (!res.ok) {
      els.v2AdminKeyStatus.textContent = data.error || "Could not check key.";
      return;
    }
    if (!data.keySet) {
      els.v2AdminKeyStatus.textContent = "No key set.";
    } else if (data.valid) {
      els.v2AdminKeyStatus.textContent = `Active — ${data.requests_remaining} credits remaining.`;
    } else {
      els.v2AdminKeyStatus.textContent = `Current key is invalid: ${data.error || ""}`;
    }
  } catch (err) {
    els.v2AdminKeyStatus.textContent = "Could not check key.";
  }
}

function wireAdminPanel() {
  els.v2AdminClose.addEventListener("click", () => { els.v2AdminOverlay.hidden = true; });

  els.v2AdminKeySave.addEventListener("click", async () => {
    const key = els.v2AdminKeyInput.value.trim();
    if (!key) return;
    els.v2AdminKeyMsg.textContent = "Testing…";
    els.v2AdminKeyMsg.style.color = "";
    try {
      const res = await fetch("/api/v2-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "key", key }),
      });
      const data = await readAdminJson(res);
      if (!res.ok || !data.saved) {
        els.v2AdminKeyMsg.textContent = data.error || "Key rejected.";
        els.v2AdminKeyMsg.style.color = "#e05d5d";
        return;
      }
      els.v2AdminKeyInput.value = "";
      els.v2AdminKeyMsg.textContent = `Saved. ${data.requests_remaining} credits remaining.`;
      els.v2AdminKeyMsg.style.color = "#35e0c4";
      refreshAdminKeyStatus();
    } catch (err) {
      els.v2AdminKeyMsg.textContent = err.message || "Request failed";
      els.v2AdminKeyMsg.style.color = "#e05d5d";
    }
  });

  // Builds the stored NFL board on demand. Same job as the daily cron, so
  // the props tab can be made instant right now rather than after the next
  // scheduled run.
  els.nflAdminScanBtn?.addEventListener("click", async () => {
    els.nflAdminScanBtn.disabled = true;
    els.nflAdminScanMsg.textContent = "Scanning the NFL slate — this can take up to a minute…";
    els.nflAdminScanMsg.style.color = "";
    try {
      const res = await fetch("/api/v2-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "nfl-scan" }),
      });
      const data = await readAdminJson(res);
      els.nflAdminScanBtn.disabled = false;
      if (!res.ok || !data.ok) {
        els.nflAdminScanMsg.textContent = data.error || "NFL scan failed.";
        els.nflAdminScanMsg.style.color = "#e05d5d";
        return;
      }
      const missed = data.failed ? `, ${data.failed} game${data.failed === 1 ? "" : "s"} failed` : "";
      els.nflAdminScanMsg.textContent = `Done — ${data.games} game${data.games === 1 ? "" : "s"} scanned, ${data.rows} props stored${missed}.`;
      els.nflAdminScanMsg.style.color = "#35e0c4";
    } catch (err) {
      els.nflAdminScanBtn.disabled = false;
      els.nflAdminScanMsg.textContent = err.message || "Request failed";
      els.nflAdminScanMsg.style.color = "#e05d5d";
    }
  });

  els.v2AdminScanBtn.addEventListener("click", async () => {
    els.v2AdminScanBtn.disabled = true;
    els.v2AdminScanMsg.textContent = "Scanning — this can take a minute or two…";
    els.v2AdminScanMsg.style.color = "";
    try {
      const res = await fetch("/api/v2-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "scan" }),
      });
      const data = await readAdminJson(res);
      els.v2AdminScanBtn.disabled = false;
      if (!res.ok || !data.ok) {
        els.v2AdminScanMsg.textContent = data.error || "Scan failed.";
        els.v2AdminScanMsg.style.color = "#e05d5d";
        return;
      }
      els.v2AdminScanMsg.textContent = `Done — ${data.n_props} props found, ${data.n_bait ?? 0} bait props flagged.`;
      els.v2AdminScanMsg.style.color = "#35e0c4";
      state.v2BoardLoaded = false;
      if (state.currentTab === "v2") loadV2Board(true);
    } catch (err) {
      els.v2AdminScanBtn.disabled = false;
      els.v2AdminScanMsg.textContent = err.message || "Request failed";
      els.v2AdminScanMsg.style.color = "#e05d5d";
    }
  });
}

function updateParlayBar() {
  const count = state.parlaySelection.size;
  els.parlayBar.hidden = state.currentTab !== "saved" || count === 0;
  els.parlaySelectedCount.textContent = `${count} selected`;
  els.parlayCompareBtn.disabled = count < 2;
  if (count < 2) hideParlayView();
}

function hideParlayView() {
  els.parlayView.hidden = true;
  els.parlayView.innerHTML = "";
}

function renderParlayView() {
  const legs = getSavedProps().filter((p) => state.parlaySelection.has(p.id));
  if (legs.length < 2) return;

  const combinedHitRate = legs.reduce((acc, p) => acc * ((Number(p.estHitRate) || 0) / 100), 1) * 100;
  const avgScore = legs.reduce((acc, p) => acc + (Number(p.score) || 0), 0) / legs.length;

  els.parlayView.innerHTML = `
    <div class="parlay-summary">
      <span class="parlay-summary-value" id="parlay-combined-value">0%</span>
      <span class="parlay-summary-label">Estimated combined hit rate · ${legs.length}-leg parlay</span>
      <div class="parlay-summary-sub">Avg individual score: ${avgScore.toFixed(1)} · Legs are treated as independent — actual correlation may differ. Expand a leg for its matchup detail.</div>
    </div>
  `;

  legs.forEach((p, i) => {
    const m = p.matchup || {};
    const matchupLines = [
      m.opponent ? `<b>vs ${escapeHtml(m.opponent)}</b>` : "",
      m.pitcher ? escapeHtml(m.pitcher) : "",
      m.bvp ? `BvP: ${escapeHtml(m.bvp)}` : "",
      m.handedness ? escapeHtml(m.handedness) : "",
      p.environment ? escapeHtml(p.environment) : "",
    ].filter(Boolean);

    const leg = document.createElement("div");
    leg.className = "parlay-leg";
    leg.style.animationDelay = `${120 + i * 90}ms`;
    leg.innerHTML = `
      <div class="parlay-leg-head">
        ${avatarHtml(p, "sm")}
        <div class="parlay-leg-text">
          <span class="parlay-leg-player">${escapeHtml(p.player)}</span>
          <span class="parlay-leg-pick">${escapeHtml(p.side)} ${escapeHtml(String(p.line))} ${escapeHtml(p.betType)} · est. ${p.estHitRate ?? "—"}%</span>
        </div>
        <span class="parlay-leg-score">${p.tierIcon || ""} ${p.score ?? "—"}</span>
        <svg class="parlay-leg-caret" width="10" height="6" viewBox="0 0 10 6"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
      </div>
      <div class="parlay-leg-detail">
        <div class="parlay-leg-detail-inner">
          ${matchupLines.length ? `<p class="parlay-leg-matchup">${matchupLines.join("<br>")}</p>` : ""}
          <ul class="bullet-list">
            ${(p.whyItHits || []).slice(0, 4).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
          </ul>
        </div>
      </div>
    `;
    leg.querySelector(".parlay-leg-head").addEventListener("click", () => {
      leg.classList.toggle("expanded");
    });
    els.parlayView.appendChild(leg);
  });

  els.parlayView.hidden = false;
  els.parlayView.scrollIntoView({ behavior: "smooth", block: "nearest" });

  requestAnimationFrame(() => countUpEl("parlay-combined-value", combinedHitRate, { decimals: 1, suffix: "%" }));
}

function countUpEl(id, target, { decimals = 0, duration = 1000, suffix = "" } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = target * eased;
    el.textContent = `${value.toFixed(decimals)}${suffix}`;
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = `${target.toFixed(decimals)}${suffix}`;
  }
  requestAnimationFrame(tick);
}

/* ---------- Player Detail Modal (Silas-style) ---------- */

let pdState = { prop: null, tab: "play" };

function openPlayerDetail(p) {
  pdState.prop = p;
  pdState.tab = "play";

  const overlay = document.getElementById("player-detail-overlay");
  overlay.hidden = false;

  // Hero image
  const heroImg = document.getElementById("pd-hero-img");
  const heroContent = document.getElementById("pd-hero-content");
  const playerId = p.stats?.player_id || "";
  if (playerId) {
    if (p.sport === "NBA") {
      heroImg.src = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
    } else {
      heroImg.src = `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${playerId}/headshot/silo/current`;
    }
    heroImg.alt = p.player_name;
    heroImg.onerror = () => {
      heroImg.onerror = null;
      heroImg.src = `https://img.mlbstatic.com/mlb-photos/image/upload/w_300,q_auto:best/v1/people/${playerId}/headshot/67/current`;
    };
    heroImg.style.display = "";
  } else {
    heroImg.style.display = "none";
  }

  // Tier badge
  const tier = BOT_TIER[p.tier] || botScoreBadge(p.vortex_score);
  document.getElementById("pd-tier-badge").textContent = tier.badge;

  // Name + matchup
  document.getElementById("pd-player-name").textContent = p.player_name;
  const opponent = p.stats?.opponent || p.stats?.matchup?.opponent || "";
  const isHome = p.stats?.is_home;
  const matchupStr = opponent ? (isHome ? `vs ${opponent}` : `@ ${opponent}`) : "";
  const sidePfx = p.stats?.side === "under" ? "U" : "O";
  document.getElementById("pd-matchup").textContent = `${matchupStr}${matchupStr ? " · " : ""}${sidePfx} ${p.line} ${p.stat_type}`;

  // The play tab
  renderPdPlayTab(p);
  renderPdWhyTab(p);
  renderPdChallengeTab(p);
  renderPdBreakdownTab(p);
  updatePdTabs();
}

function pdDecisionDrivers(p) {
  const stats = p.stats || {}, splits = stats.splits || {}, pitcher = stats.pitcher || {};
  const side = stats.side === "under" ? "under" : "over";
  const drivers = [];
  const add = (name, impact, detail, kind = impact >= 0 ? "positive" : "negative", modeled = true) => {
    if (!detail || !Number.isFinite(Number(impact))) return;
    drivers.push({ name, impact: Number(impact), detail, kind, modeled });
  };

  const l10 = Number(splits.l10?.rate), l20 = Number(splits.l20?.rate), l5 = Number(splits.l5?.rate);
  if (Number.isFinite(l10)) add("Recent hit profile", Math.max(-8, Math.min(8, (l10 - 50) / 6)), `${l10}% over the last 10${Number.isFinite(l20) ? ` and ${l20}% over the last 20` : ""}.`);
  if (Number.isFinite(l5) && Number.isFinite(l20)) add("Current form", Math.max(-4, Math.min(4, (l5 - l20) / 8)), `${l5}% L5 versus ${l20}% L20; short-term form is kept below the primary sample.`);
  (stats.matchup_factors || []).forEach((f) => {
    const raw = Number(f.score), weight = Number(f.weight);
    if (!Number.isFinite(raw)) return;
    const centered = raw > 10 ? (raw - 50) / 10 : raw - 5;
    const weightScale = Number.isFinite(weight) ? Math.max(.35, Math.min(1.25, weight / 20)) : 1;
    add(f.name || "Matchup factor", Math.max(-5, Math.min(5, centered * weightScale)), cleanAnalysisText(f.detail || `Matchup component scored ${raw}.`));
  });
  if (pitcher.name) {
    const era = Number(pitcher.era), whip = Number(pitcher.whip), k9 = Number(pitcher.k_per_9);
    let impact = 0;
    if (Number.isFinite(era)) impact += (era - 4.2) * (side === "over" ? 1.5 : -1.5);
    if (Number.isFinite(whip)) impact += (whip - 1.28) * (side === "over" ? 5 : -5);
    if (p.stat_type === "Pitcher Strikeouts" && Number.isFinite(k9)) impact = (k9 - 8.5) * (side === "over" ? 1.3 : -1.3);
    add("Opposing pitcher", Math.max(-6, Math.min(6, impact)), `${pitcher.name}: ${Number.isFinite(era) ? `ERA ${era}` : "ERA unavailable"}${Number.isFinite(whip) ? `, WHIP ${whip}` : ""}.`);
  }
  if (stats.platoon_note) add("Handedness", /favo|edge|advantage/i.test(stats.platoon_note) ? 3 : -2, cleanAnalysisText(stats.platoon_note));
  const bvp = stats.bvp;
  if (bvp && Number(bvp.ab) >= 5) {
    const avg = Number(bvp.avg), sample = Number(bvp.ab);
    const rawImpact = Number.isFinite(avg) ? (avg - .250) * 15 * (side === "over" ? 1 : -1) : 0;
    add("Batter vs. pitcher", Math.max(-2.5, Math.min(2.5, rawImpact)) * Math.min(1, sample / 20), `${sample} AB sample${Number.isFinite(avg) ? ` with a ${avg.toFixed(3)} AVG` : ""}; capped because small BvP samples are noisy.`);
  }
  if (p.risk_summary) add("Known risk", -4, cleanAnalysisText(p.risk_summary), "negative");
  if (stats.market_movement) add("Market movement", 1, String(stats.market_movement));
  if (!drivers.length) add("Model alignment", 1, p.case_summary || "The board model's available signals support this side.");
  return drivers.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
}

function renderPdWhyTab(p) {
  const section = document.getElementById("pd-why-section");
  const drivers = pdDecisionDrivers(p), positives = drivers.filter(d => d.impact >= 0), negatives = drivers.filter(d => d.impact < 0);
  const rows = (items, limit) => items.slice(0, limit).map((d, idx) => `<article class="pd-driver ${d.kind}"><span class="pd-driver-rank">${idx + 1}</span><div><strong>${escapeHtml(d.name)}</strong><p>${escapeHtml(cleanAnalysisText(d.detail))}</p></div><b>${d.impact >= 0 ? "+" : ""}${d.impact.toFixed(1)}</b></article>`).join("");
  section.innerHTML = `<div class="pd-explain-head"><span>MODEL RATIONALE</span><h3>What is driving the pick</h3><p>The strongest inputs are shown first. Scores measure influence on this recommendation.</p></div><div class="pd-driver-group"><h4>Supports the play</h4>${rows(positives,4) || `<p class="pd-empty-note">No strong supporting factor was exposed.</p>`}</div><div class="pd-driver-group"><h4>Pushes against it</h4>${rows(negatives,2) || `<p class="pd-empty-note">No material conflict was reported.</p>`}</div><div class="pd-net-read"><b>READ</b><span>${negatives.length ? "The negative evidence is included, but it is not strong enough to overturn the recommendation." : "The primary inputs point in the same direction."}</span></div>`;
}

const PD_CHALLENGES = [
  ["recent", "Recent form"], ["hand", "Handedness"], ["pitcher", "Pitch matchup"],
  ["bullpen", "Bullpen"], ["opportunity", "Lineup / opportunity"], ["workload", "Pitch count / workload"],
  ["environment", "Weather / park"], ["price", "Price or line"], ["bvp", "Batter vs. pitcher"], ["gut", "Gut feeling"]
];

function evaluatePdChallenge(p, key) {
  const stats = p.stats || {}, drivers = pdDecisionDrivers(p);
  const terms = { recent:/recent|form|l5|l10|l20/i, hand:/hand|platoon/i, pitcher:/pitch|matchup|opposing/i, bullpen:/bullpen/i, opportunity:/lineup|opportunity|plate appearance/i, workload:/workload|pitch count|leash|innings/i, environment:/weather|park|wind/i, price:/market|price|odds|line/i, bvp:/batter vs|bvp/i };
  const matches = drivers.filter(d => terms[key]?.test(`${d.name} ${d.detail}`));
  let status = "NEEDS VERIFICATION", strength = "Unknown", shift = 0, explanation = "PropScout does not currently have a verified input for this concern. Treat it as a wait condition, not an automatic fade.";
  if (key === "gut") {
    status = "NOT QUANTIFIABLE"; strength = "Unverified";
    explanation = "A gut concern is worth noticing, but it cannot overturn the model until you can name the underlying baseball or pricing assumption.";
  } else if (matches.length) {
    const adverse = matches.some(d => d.impact < 0);
    shift = adverse ? Math.min(8, matches.filter(d => d.impact < 0).reduce((n, d) => n + Math.min(4, Math.abs(d.impact)), 0)) : 0;
    strength = adverse ? (shift >= 6 ? "Material" : shift >= 3 ? "Moderate" : "Minor") : "Does not weaken play";
    status = adverse ? "ALREADY MODELED" : "MODELED — NOT A RED FLAG";
    explanation = adverse ? `This concern already reduces the grade through ${matches.filter(d => d.impact < 0).map(d => d.name).join(" and ")}. The remaining evidence still supports the current verdict.` : `Krazy Data already evaluates ${matches.map(d => d.name).join(" and ")}. In the available data, this factor supports the play rather than opposing it.`;
  } else if (["bullpen", "opportunity", "workload", "environment"].includes(key)) {
    strength = "Potentially material";
    explanation = "This can change the play, but the current card does not expose enough verified data to measure it. Confirm the latest information before treating the recommendation as final.";
  } else {
    status = "LOW EVIDENCE"; strength = "Minor";
    explanation = "The current data does not show this as a strong contradiction. Avoid giving it veto power unless you have new, verified information.";
  }
  const base = Number(stats.model_probability ?? stats.probability ?? p.probability);
  const basePct = Number.isFinite(base) ? (base <= 1 ? base * 100 : base) : null;
  const adjusted = basePct == null ? null : Math.max(1, basePct - shift);
  const verdict = status === "NEEDS VERIFICATION" && strength === "Potentially material" ? "WAIT FOR CONFIRMATION" : adjusted != null && adjusted < 55 ? "PASS / EDGE TOO THIN" : "ORIGINAL VERDICT SURVIVES";
  return { status, strength, shift, explanation, basePct, adjusted, verdict };
}

function renderPdChallengeResult(p, key) {
  const result = evaluatePdChallenge(p, key), host = document.getElementById("pd-challenge-result");
  const label = PD_CHALLENGES.find(x => x[0] === key)?.[1] || "Concern";
  host.innerHTML = `<div class="pd-challenge-result"><div class="pd-challenge-status"><span>${escapeHtml(result.status)}</span><b>${escapeHtml(result.strength)}</b></div><h4>${escapeHtml(label)}</h4><p>${escapeHtml(result.explanation)}</p>${result.basePct != null ? `<div class="pd-prob-shift"><span><small>ORIGINAL</small><b>${result.basePct.toFixed(1)}%</b></span><i>→</i><span><small>AFTER REVIEW</small><b>${result.adjusted.toFixed(1)}%</b></span></div>` : ""}<div class="pd-challenge-verdict"><small>CONCLUSION</small><strong>${escapeHtml(result.verdict)}</strong></div></div>`;
}

function renderPdChallengeTab(p) {
  const section = document.getElementById("pd-challenge-section");
  section.innerHTML = `<div class="pd-explain-head"><span>SECOND LOOK</span><h3>Test a concern</h3><p>Select the part of the matchup that gives you pause.</p></div><div class="pd-challenge-grid">${PD_CHALLENGES.map(([key,label]) => `<button type="button" data-pd-challenge="${key}">${escapeHtml(label)}</button>`).join("")}</div><div id="pd-challenge-result" aria-live="polite"><p class="pd-empty-note">Choose a concern to compare it with the model's inputs.</p></div>`;
  section.querySelectorAll("[data-pd-challenge]").forEach(btn => btn.addEventListener("click", () => {
    section.querySelectorAll("[data-pd-challenge]").forEach(b => b.classList.toggle("active", b === btn));
    renderPdChallengeResult(p, btn.dataset.pdChallenge);
  }));
}

function renderPdPlayTab(p) {
  const section = document.getElementById("pd-play-section");
  const stats = p.stats || {};
  const splits = stats.splits || {};
  const pitcher = stats.pitcher || {};
  const bvp = stats.bvp || null;
  const sidePfx = stats.side === "under" ? "Under" : "Over";

  document.getElementById("pd-play-line").textContent = `${sidePfx} ${p.line} ${p.stat_type}`;
  const evText = fmtBotEv(p);
  document.getElementById("pd-play-meta").textContent = `${evText} · ${p.sportsbook || "best price"}`;

  // Case text
  let caseHtml = "";
  const fmtRate = (r) => r && typeof r.rate === "number" ? `<strong>${r.rate}%</strong><small>${r.hits}/${r.games}</small>` : `<strong>—</strong><small>no sample</small>`;

  const hasSplits = ["l5", "l10", "l20"].some((k) => splits[k] && typeof splits[k].rate === "number");
  if (hasSplits) {
    caseHtml += `<div class="pd-rate-head"><span>RECENT RESULTS</span><small>Times this side cleared</small></div><div class="pd-rate-grid"><div><span>L5</span>${fmtRate(splits.l5)}</div><div><span>L10</span>${fmtRate(splits.l10)}</div><div><span>L20</span>${fmtRate(splits.l20)}</div></div>`;
    const streak = splits.l5?.streak || 0;
    if (streak >= 4) caseHtml += `<p class="pd-form-note positive">Active ${streak}-game hit streak</p>`;
    else if (streak <= -3) caseHtml += `<p class="pd-form-note negative">Current ${Math.abs(streak)}-game miss streak</p>`;
    const seasonAvg = splits.season_avg != null ? splits.season_avg : null;
    if (seasonAvg != null) caseHtml += `<p class="pd-season-note"><span>Season average</span><strong>${seasonAvg}</strong></p>`;
  } else if (p.case_summary) {
    caseHtml = `<p class="pd-plain-copy">${escapeHtml(cleanAnalysisText(p.case_summary))}</p>`;
  }

  document.getElementById("pd-case").innerHTML = caseHtml;
}

function renderPdBreakdownTab(p) {
  const section = document.getElementById("pd-breakdown-section");
  const stats = p.stats || {};
  const pitcher = stats.pitcher || {};
  const splits = stats.splits || {};
  let html = "";

  if (p.last5 && p.last5.length) {
    html += `<section class="pd-scout-block"><div class="pd-scout-title">LAST 5 OUTCOMES</div>`;
    const vals = p.last5.map((e) => typeof e === "object" && e !== null ? e.value : e);
    const over = p.side === "Over" || p.side === "over";
    const tagged = vals.map((v) => {
      const hit = over ? v >= p.line : v <= p.line;
      return `<span style="color:${hit ? "var(--success)" : "var(--danger)"};font-weight:600">${v}</span>`;
    });
    html += `<p class="pd-outcomes">${tagged.join("<i></i>")}</p></section>`;
  }

  if (pitcher.name) {
    html += `<section class="pd-scout-block"><div class="pd-scout-title">OPPOSING PITCHER</div><div class="pd-pitcher-line"><strong>${escapeHtml(pitcher.name)}</strong><span>${escapeHtml(pitcher.hand ?? "?")}HP</span></div><div class="pd-stat-line"><span>ERA <b>${pitcher.era ?? "—"}</b></span><span>K/9 <b>${pitcher.k_per_9 ?? "—"}</b></span><span>HR/9 <b>${pitcher.hr_per_9 ?? "—"}</b></span><span>WHIP <b>${pitcher.whip ?? "—"}</b></span></div>`;
    if (stats.platoon_note) html += `<p class="pd-scout-note"><b>Platoon</b>${escapeHtml(cleanAnalysisText(stats.platoon_note))}</p>`;
    html += `</section>`;
  }

  const bvp = stats.bvp || null;
  if (bvp && bvp.ab >= 5) {
    html += `<section class="pd-scout-block"><div class="pd-scout-title">BATTER VS. PITCHER</div><div class="pd-stat-line"><span>AB <b>${bvp.ab}</b></span><span>AVG <b>${bvp.avg}</b></span><span>HR <b>${bvp.hr}</b></span><span>OPS <b>${bvp.ops}</b></span></div></section>`;
  }

  if (stats.trend_signal) {
    const t = String(stats.trend_signal);
    html += `<section class="pd-scout-block"><div class="pd-scout-title">TREND</div><p class="pd-plain-copy">${escapeHtml(cleanAnalysisText(t))}</p></section>`;
  }

  if (p.seasonLine) {
    html += `<p style="margin:8px 0 0"><strong>📋 Season Line:</strong> ${escapeHtml(p.seasonLine)}</p>`;
  }

  if (p.risk_summary) {
    html += `<section class="pd-scout-block risk"><div class="pd-scout-title">PRIMARY RISK</div><p class="pd-plain-copy">${escapeHtml(cleanAnalysisText(p.risk_summary))}</p></section>`;
  }

  if (p.matchup && p.matchup.bullpen) {
    html += `<p style="margin:8px 0 0"><strong>🛡️ Bullpen:</strong> ${escapeHtml(p.matchup.bullpen)}</p>`;
  }
  if (p.matchup && p.matchup.handedness) {
    html += `<p style="margin:4px 0 0"><strong>🖐️ Hand:</strong> ${escapeHtml(p.matchup.handedness)}</p>`;
  }

  if (!html) html = `<p style="color:var(--text-faint)">No breakdown data available.</p>`;
  section.innerHTML = html;
}

function updatePdTabs() {
  document.querySelectorAll(".pd-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pdTab === pdState.tab);
  });
  document.getElementById("pd-play-section").hidden = pdState.tab !== "play";
  document.getElementById("pd-why-section").hidden = pdState.tab !== "why";
  document.getElementById("pd-challenge-section").hidden = pdState.tab !== "challenge";
  document.getElementById("pd-breakdown-section").hidden = pdState.tab !== "breakdown";
}

function wirePlayerDetailModal() {
  const overlay = document.getElementById("player-detail-overlay");
  document.getElementById("pd-close-btn").addEventListener("click", () => { overlay.hidden = true; });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) overlay.hidden = true;
  });

  document.querySelectorAll(".pd-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      pdState.tab = btn.dataset.pdTab;
      updatePdTabs();
    });
  });

  // Tail = save the prop
  document.getElementById("pd-tail-btn").addEventListener("click", () => {
    if (!pdState.prop) return;
    const p = pdState.prop;
    // Build a saved-compatible prop from the board row
    const savedProp = {
      id: `board-${p.player_name}-${p.stat_type}-${p.line}`,
      player: p.player_name,
      betType: BOT_STAT_TO_RESEARCH_STAT[p.stat_type] || p.stat_type,
      line: p.line,
      side: p.stats?.side === "under" ? "Under" : "Over",
      team: p.stats?.team || "",
      sport: p.sport || "MLB",
      score: p.vortex_score,
      tierIcon: (BOT_TIER[p.tier] || botScoreBadge(p.vortex_score)).badge,
      estHitRate: p.stats?.splits?.l10?.rate,
    };
    toggleSave(savedProp, document.getElementById("pd-tail-btn"));
  });
}

/* ---------- Utils ---------- */

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function cleanAnalysisText(value) {
  return String(value ?? "")
    .replace(/\*\*|__|`/g, "")
    .replace(/[⚔️💣⚠️🎯🤝📊📈🔥❄️✅❌🔶]+/gu, " ")
    .replace(/^(why|risk|market)\s*[:—-]\s*/i, "")
    .replace(/platoon edge\s*[—:-]\s*platoon edge\s*[—:-]?\s*/i, "Platoon edge — ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = String(str ?? "");
  return div.innerHTML;
}
