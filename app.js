/* =========================================================
   Vortex Prop Research — client-side renderer
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
const DATA_SOURCE = "/predictions.json";

/**
 * Live-compute endpoint — used whenever a searched player/stat/line/side
 * isn't already in the static DATA_SOURCE. Same one-line-swap contract:
 * change this and nothing else needs to change, as long as the response
 * matches a single prop object (same shape as one entry in props[]).
 */
const API_SOURCE = "/api/prediction";
const API_PLAYERS_SOURCE = "/api/players";
const API_PRIZEPICKS_EXPORT = "/api/prediction?action=prizepicks-export";
const API_SLIP_ANALYZER = "/api/prediction?action=slip-analyzer";

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
};

const state = {
  props: [],
  activeIndex: -1,
  savedProps: loadSaved(), // Map<id, prop>
  // When Research is opened from a board prop, keep the board refresh's
  // matchup grade authoritative for that exact player/stat/line/side.
  boardResearchContext: null,


  parlaySelection: new Set(),
  currentTab: "research",
  slateLoaded: false,
  v2BoardLoaded: false,
  v2BoardData: null,
  v2RenderedProps: [],
  boardFilter: "all",
  matchupDisplayLimit: 40,
  builderLegs: 2,
  builderMode: "safe",
  builderResult: [],
  builderLocked: new Set(),
  specialsLoaded: false,
  specialsData: null,
  moneylineGamePk: null,
  moneylineSide: "home",
  adminRecords: null,
  adminRecordTab: "props",
  adminUnlocked: false,
  adminLiveTimer: null,
};

const els = {};

const THEME_KEY = "vortex_theme_mode";
const EXPERIENCE_KEY = "private_jarvis_interface";
// Mirrors --bg per data-theme in styles.css -- must be declared before the
// applyTheme() call below (which runs at script top-level, immediately),
// not down near the function definition, or it's a temporal-dead-zone
// ReferenceError the instant this file loads when a top-level call reaches a
// later `const` before the script gets there in top-to-bottom execution.
const THEME_BG = {
  obsidian: "#050505", midnight: "#07101f", forest: "#07130f",
  burgundy: "#16090d", ivory: "#f3efe7", violet: "#100a1c",
  ocean: "#041719", amber: "#1a1005",
};
const LEGACY_THEMES = { dark: "obsidian", grey: "midnight", light: "ivory" };
const initialTheme = localStorage.getItem(THEME_KEY) || "obsidian";
applyTheme(LEGACY_THEMES[initialTheme] || initialTheme);
applyExperience(localStorage.getItem(EXPERIENCE_KEY) === "true");

init();

async function init() {
  const loaderStartedAt = performance.now();
  cacheEls();
  try {
    await checkAuth();
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
    wireTeamModal();
  } catch (err) {
    console.error("wireTeamModal failed:", err);
  }
  try {
    wireChromeAutoHide();
  } catch (err) {
    console.error("wireChromeAutoHide failed:", err);
  }
  wireCardBorderGlow();
  wireTabs();
  wireMainMenu();

  try {
    const res = await fetch(DATA_SOURCE, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${DATA_SOURCE}: ${res.status}`);
    const data = await res.json();
    state.props = data.props || [];
  } catch (err) {
    console.error(err);
    els.emptyState.innerHTML = `<span class="status-mark" aria-hidden="true"></span><span class="state-copy"><strong>Research is temporarily unavailable</strong><small>Try again shortly. The rest of the site remains available.</small></span>`;
    state.props = [];
  }

  clearIntroAnimations();
  wireSearch();
  wireLinePicker();
  renderBrowseChips();
  wireSavedToolbar();
  wireManualBetSlip();
  renderSavedGrid();
  wireSlate();
  wireV2Board();
  wireParlayBuilder();
  wireSlipAnalyzer();
  wireAdminPanel();
  wireSidePanel();
  wireSpecialMarkets();
  wirePlayerDetailModal();
  updateSavedCount();
  updateParlayBar();
  await finishPrivateLoader(loaderStartedAt);
  const warmSlate = () => requestSlateData(false).catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(warmSlate, { timeout: 2200 });
  else setTimeout(warmSlate, 900);
}

function cacheEls() {
  els.searchInput = document.getElementById("search-input");
  els.searchResults = document.getElementById("search-results");
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
  els.profileStatsTrigger = document.getElementById("profile-stats-trigger");
  els.profileStatsTriggerLabel = document.getElementById("profile-stats-trigger-label");
  els.profileStatsMenu = document.getElementById("profile-stats-menu");

  els.linePicker = document.getElementById("line-picker");
  els.sideToggle = document.getElementById("side-toggle");
  els.lineNumber = document.getElementById("line-number");
  els.lineSlider = document.getElementById("line-slider");
  els.lineStepDown = document.getElementById("line-step-down");
  els.lineStepUp = document.getElementById("line-step-up");
  els.lineNoData = document.getElementById("line-no-data");
  els.ppLinesWrap = document.getElementById("pp-lines-wrap");
  els.ppLinesTrigger = document.getElementById("pp-lines-trigger");
  els.ppLinesMenu = document.getElementById("pp-lines-menu");

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
  els.panelBuilder = document.getElementById("panel-builder");
  els.panelSlip = document.getElementById("panel-slip");
  els.panelMoneyline = document.getElementById("panel-moneyline");
  els.panelNrfi = document.getElementById("panel-nrfi");
  els.panelAdmin = document.getElementById("panel-admin");
  els.moneylineList = document.getElementById("moneyline-list");
  els.moneylineEmpty = document.getElementById("moneyline-empty");
  els.nrfiList = document.getElementById("nrfi-list");
  els.nrfiEmpty = document.getElementById("nrfi-empty");
  els.moneylineRefresh = document.getElementById("moneyline-refresh");
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
  els.autoBoardState = document.getElementById("auto-board-state");
  els.autoActiveCadence = document.getElementById("auto-active-cadence");
  els.autoPregameCadence = document.getElementById("auto-pregame-cadence");
  els.autoCreditBudget = document.getElementById("auto-credit-budget");
  els.autoMonthlyReserve = document.getElementById("auto-monthly-reserve");
  els.builderLegButtons = document.getElementById("builder-leg-buttons");
  els.builderModeButtons = document.getElementById("builder-mode-buttons");
  els.builderSameGame = document.getElementById("builder-same-game");
  els.builderGenerate = document.getElementById("builder-generate");
  els.builderStatus = document.getElementById("builder-status");
  els.builderResult = document.getElementById("builder-result");
  els.slipFileInput = document.getElementById("slip-file-input");
  els.slipUploadZone = document.getElementById("slip-upload-zone");
  els.slipFileStatus = document.getElementById("slip-file-status");
  els.slipPasteBtn = document.getElementById("slip-paste-btn");
  els.slipGradeBtn = document.getElementById("slip-grade-btn");
  els.slipAnalysisResult = document.getElementById("slip-analysis-result");

  els.v2PinOverlay = document.getElementById("v2-pin-overlay");
  els.v2PinInput = document.getElementById("v2-pin-input");
  els.v2PinSubmit = document.getElementById("v2-pin-submit");
  els.v2PinClose = document.getElementById("v2-pin-close");
  els.v2PinError = document.getElementById("v2-pin-error");
  els.v2AdminOverlay = document.getElementById("v2-admin-overlay");
  els.v2AdminClose = document.getElementById("v2-admin-close");
  els.v2AdminKeyStatus = document.getElementById("v2-admin-key-status");
  els.v2AdminKeyInput = document.getElementById("v2-admin-key-input");
  els.v2AdminKeySave = document.getElementById("v2-admin-key-save");
  els.v2AdminKeyMsg = document.getElementById("v2-admin-key-msg");
  els.v2AdminScanBtn = document.getElementById("v2-admin-scan-btn");
  els.v2AdminScanMsg = document.getElementById("v2-admin-scan-msg");

  els.savedGrid = document.getElementById("saved-grid");
  els.savedEmpty = document.getElementById("saved-empty");
  els.clearSavedBtn = document.getElementById("clear-saved-btn");

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
  els.modeRow = document.getElementById("mode-row");
  els.gamelogOverlay = document.getElementById("gamelog-overlay");
  els.gamelogTitle = document.getElementById("gamelog-title");
  els.gamelogPropBadge = document.getElementById("gamelog-prop-badge");
  els.gamelogTeamMark = document.getElementById("gamelog-team-mark");
  els.gamelogPlayerCutout = document.getElementById("gamelog-player-cutout");
  els.gamelogClose = document.getElementById("gamelog-close");
  els.gamelogTabs = document.getElementById("gamelog-tabs");
  els.gamelogSub = document.getElementById("gamelog-sub");
  els.gamelogChart = document.getElementById("gamelog-chart");
  els.gamelogSubfilters = document.getElementById("gamelog-subfilters");
  els.glHandFilter = document.getElementById("gl-hand-filter");
  els.glVenueFilter = document.getElementById("gl-venue-filter");
  els.gamelogStatTabs = document.getElementById("gamelog-stat-tabs");
  els.gamelogLineDown = document.getElementById("gamelog-line-down");
  els.gamelogLineUp = document.getElementById("gamelog-line-up");
  els.gamelogLineValue = document.getElementById("gamelog-line-value");
  els.gamelogFilterToggle = document.getElementById("gamelog-filter-toggle");
  els.gamelogFilterClose = document.getElementById("gamelog-filter-close");
  els.gamelogFilterPanel = document.getElementById("gamelog-filter-panel");
  els.gamelogStudio = document.getElementById("gamelog-studio");
  els.gamelogSeasonRow = document.getElementById("gamelog-season-row");
  els.gamelogPresetRow = document.getElementById("gamelog-preset-row");
  els.gamelogGamesDown = document.getElementById("gamelog-games-down");
  els.gamelogGamesUp = document.getElementById("gamelog-games-up");
  els.gamelogGamesCount = document.getElementById("gamelog-games-count");
  els.gamelogWindowLabel = document.getElementById("gamelog-window-label");
  els.gamelogH2HToggle = document.getElementById("gamelog-h2h-toggle");
  els.gamelogFilterCount = document.getElementById("gamelog-filter-count");

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

function applyTheme(mode) {
  document.documentElement.setAttribute("data-theme", mode);
  localStorage.setItem(THEME_KEY, mode);
  document.querySelectorAll(".mode-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  const meta = document.getElementById("theme-color-meta");
  if (meta && THEME_BG[mode]) meta.setAttribute("content", THEME_BG[mode]);
}

const ACCENT_KEY = "vortex_custom_accent";
function hexToRgb(hex) {
  const c = hex.replace("#", "").trim();
  const n = parseInt(c.length === 3 ? c.split("").map(x => x + x).join("") : c, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function applyAccentColor(hex, persist = true) {
  if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return;
  const { r, g, b } = hexToRgb(hex);
  const soft = `color-mix(in srgb, ${hex} 68%, #ffffff)`;
  const dim = `rgba(${r}, ${g}, ${b}, 0.14)`;
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty("--accent-soft", soft);
  document.documentElement.style.setProperty("--accent-dim", dim);
  document.documentElement.setAttribute("data-custom-accent", "true");
  const picker = document.getElementById("accent-color-picker");
  const valEl = document.getElementById("accent-wheel-value");
  if (picker) picker.value = hex;
  if (valEl) valEl.textContent = hex.toUpperCase();
  if (persist) localStorage.setItem(ACCENT_KEY, hex);
}
function resetAccentColor() {
  document.documentElement.style.removeProperty("--accent");
  document.documentElement.style.removeProperty("--accent-soft");
  document.documentElement.style.removeProperty("--accent-dim");
  document.documentElement.removeAttribute("data-custom-accent");
  localStorage.removeItem(ACCENT_KEY);
  const valEl = document.getElementById("accent-wheel-value");
  if (valEl) {
    const comp = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff9d16";
    valEl.textContent = comp.toUpperCase();
    const picker = document.getElementById("accent-color-picker");
    if (picker) picker.value = comp.trim();
  }
}
(() => {
  const saved = localStorage.getItem(ACCENT_KEY);
  if (saved) applyAccentColor(saved, false);
})();

function applyExperience(enabled) {
  document.documentElement.removeAttribute("data-jarvis");
}

/* ---------- Keep navigation out of the way once the reader leaves the top ---------- */

function wireChromeAutoHide() {
  let ticking = false;

  const apply = () => {
    const y = window.scrollY;
    const isMobile = window.matchMedia("(max-width: 700px)").matches;
    els.settingsBtn.classList.toggle("mobile-chrome-hidden", isMobile && y > 2);
    ticking = false;
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(apply);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener("resize", apply);
  apply();
}

/* ---------- Border glow for every card surface ---------- */

const CARD_GLOW_SELECTOR = [
  ".player-profile", ".report-block", ".report-card", ".slate-card",
  ".slate-row", ".saved-card", ".v2-card", ".board-card",
  ".market-card", ".market-page-head",
].join(", ");

function wireCardBorderGlow() {
  const enableGlow = (card) => {
    if (card.classList.contains("border-glow-enabled")) return;
    card.classList.add("border-glow-enabled");
    const glow = document.createElement("span");
    glow.className = "card-border-glow";
    glow.setAttribute("aria-hidden", "true");
    card.append(glow);
  };

  document.querySelectorAll(CARD_GLOW_SELECTOR).forEach(enableGlow);

  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const card = event.target.closest?.(CARD_GLOW_SELECTOR);
    if (!card) return;

    enableGlow(card);
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const distanceToEdge = Math.min(x, y, rect.width - x, rect.height - y);
    const edgeRange = Math.min(76, Math.min(rect.width, rect.height) * 0.35);
    const strength = Math.max(0, 1 - distanceToEdge / edgeRange);

    card.style.setProperty("--border-glow-x", `${x}px`);
    card.style.setProperty("--border-glow-y", `${y}px`);
    card.style.setProperty("--border-glow-strength", strength.toFixed(3));
  }, { passive: true });

  document.addEventListener("pointerout", (event) => {
    const card = event.target.closest?.(CARD_GLOW_SELECTOR);
    if (card && !card.contains(event.relatedTarget)) {
      card.style.setProperty("--border-glow-strength", "0");
    }
  }, { passive: true });
}

function wireSettingsPanel() {
  const savedMode = localStorage.getItem(THEME_KEY) || "obsidian";
  applyTheme(LEGACY_THEMES[savedMode] || savedMode);

  // 5 rapid clicks on the settings gear opens the hidden admin PIN prompt
  // instead of the normal theme panel -- the PIN itself is never checked
  // here, only on the server (api/v2-admin-auth.py).
  let v2ClickTimes = [];
  els.settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const now = Date.now();
    // Window measured from the FIRST click in the run, not a rolling
    // per-click cutoff -- gives 5 real clicks (mouse or trackpad) a full
    // 4 seconds to land instead of resetting after any single gap.
    if (v2ClickTimes.length === 0 || now - v2ClickTimes[0] > 4000) {
      v2ClickTimes = [now];
    } else {
      v2ClickTimes.push(now);
    }
    if (v2ClickTimes.length >= 5) {
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
  els.modeRow.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyTheme(btn.dataset.mode));
  });
  const accentPicker = document.getElementById("accent-color-picker");
  const accentReset = document.getElementById("accent-reset-btn");
  const savedAccent = localStorage.getItem(ACCENT_KEY);
  if (savedAccent && accentPicker) {
    accentPicker.value = savedAccent;
    const valEl = document.getElementById("accent-wheel-value");
    if (valEl) valEl.textContent = savedAccent.toUpperCase();
  } else if (accentPicker) {
    const comp = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff9d16";
    accentPicker.value = comp;
    const valEl = document.getElementById("accent-wheel-value");
    if (valEl) valEl.textContent = comp.toUpperCase();
  }
  if (accentPicker) {
    accentPicker.addEventListener("input", () => applyAccentColor(accentPicker.value));
    accentPicker.addEventListener("change", () => applyAccentColor(accentPicker.value));
  }
  if (accentReset) {
    accentReset.addEventListener("click", () => resetAccentColor());
  }
}

/* ---------- Tabs ---------- */

function wireTabs() {
  if (!els.tabs.dataset.reactTabs) {
    els.tabs.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab, btn));
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

function switchTab(tab) {
  // The Admin route is not a preview page. It never renders until the
  // server-issued PIN session exists.
  if (tab === "admin" && !state.adminUnlocked) {
    openV2PinPrompt();
    return;
  }
  state.currentTab = tab;
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
  els.panelBuilder.hidden = tab !== "builder";
  els.panelSlip.hidden = tab !== "slip";
  els.panelMoneyline.hidden = tab !== "moneyline";
  els.panelNrfi.hidden = tab !== "nrfi";
  els.panelAdmin.hidden = tab !== "admin";
  els.panelSaved.hidden = tab !== "saved";
  els.parlayBar.hidden = tab !== "saved" || state.parlaySelection.size === 0;

  const activePanel = document.querySelector(`.tab-panel:not([hidden])`);
  if (activePanel) {
    activePanel.classList.remove("panel-enter");
    requestAnimationFrame(() => activePanel.classList.add("panel-enter"));
  }

  if (tab === "saved") renderSavedGrid();
  if (tab === "slate" && !state.slateLoaded) loadSlate();
  if (tab === "v2" && !state.v2BoardLoaded) loadV2Board();
  if (tab === "builder" && !state.v2BoardLoaded) loadV2Board();
  if (tab === "nrfi" && !state.specialsLoaded) loadSpecialMarkets();
  document.querySelectorAll(".side-link").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  window.dispatchEvent(new CustomEvent("vortex:dock-sync", { detail: { tab, saved: state.savedProps.size } }));
}

window.addEventListener("vortex:switch-tab", (event) => switchTab(event.detail?.tab || "research"));
window.addEventListener("vortex:dock-ready", () => window.dispatchEvent(new CustomEvent("vortex:dock-sync", { detail: { tab: state.currentTab, saved: state.savedProps.size } })));

function wireSidePanel() {
  els.sideMenuToggle.setAttribute("aria-controls", "side-panel");
  els.sideMenuToggle.setAttribute("aria-expanded", "false");
  const close = () => {
    els.sidePanel.hidden = true;
    els.sideScrim.hidden = true;
    els.sideMenuToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("side-panel-open");
  };
  const open = () => {
    els.sidePanel.hidden = false;
    els.sideScrim.hidden = false;
    els.sideMenuToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("side-panel-open");
    els.sideMenuClose.focus();
  };
  els.sideMenuToggle.addEventListener("click", open);
  els.sideMenuClose.addEventListener("click", close); els.sideScrim.addEventListener("click", close);
  document.querySelectorAll(".side-link").forEach((btn) => btn.addEventListener("click", () => { switchTab(btn.dataset.tab); close(); }));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !els.sidePanel.hidden) close(); });
}

function wireSpecialMarkets() {
  els.moneylineRefresh.addEventListener("click", () => loadSpecialMarkets(true));
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
  // Moneyline v5 is intentionally hidden until the production model feed is ready.
  document.getElementById("moneyline-research").hidden = true;
  els.moneylineEmpty.hidden = true;
  els.nrfiList.innerHTML = nrfis.map((p) => `<article class="market-card"><div class="market-card-top"><span class="market-badge ${p.confidence === "LEAN" ? "lean" : ""}">${escapeHtml(p.confidence || "READY")}</span><span class="market-sport">FIRST INNING</span></div><strong>${escapeHtml(p.recommendation || "—")} <em>${escapeHtml(p.away_abbr || "?")} @ ${escapeHtml(p.home_abbr || "?")}</em></strong><p class="market-matchup">${escapeHtml(p.home_pitcher || "TBD")} vs ${escapeHtml(p.away_pitcher || "TBD")}</p><div class="market-confirmed"><span>LINEUPS</span><b>Confirmed</b><span>MODEL</span><b>${escapeHtml(String(p.model_rating || p.confidence_pct || "—"))}/100</b></div></article>`).join("");
  els.nrfiEmpty.hidden = nrfis.length > 0;
}

function moneylineValue(value, fallback = "—") { return value === null || value === undefined || value === "" ? fallback : escapeHtml(String(value)); }
function moneylineDecimal(value, digits = 2, fallback = "—") { const number = Number(value); return Number.isFinite(number) ? number.toFixed(digits) : fallback; }
function moneylineGameTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Game time TBD" : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

function renderMoneylineResearch(games) {
  const shell = document.getElementById("moneyline-research"), picker = document.getElementById("moneyline-game-picker"), report = document.getElementById("moneyline-report");
  if (!games.length) { shell.hidden = true; picker.innerHTML = ""; report.innerHTML = ""; els.moneylineEmpty.hidden = false; return; }
  shell.hidden = false;
  els.moneylineEmpty.hidden = true;
  if (!games.some((game) => String(game.game_pk) === String(state.moneylineGamePk))) state.moneylineGamePk = games[0].game_pk;
  const game = games.find((item) => String(item.game_pk) === String(state.moneylineGamePk)) || games[0];
  const isV5 = String(game.model_version || "").startsWith("v5-") && Number.isFinite(Number(game.moneyline_score));
  const selected = state.moneylineSide === "away" ? "away" : "home", other = selected === "home" ? "away" : "home";
  const team = game[`${selected}_team`] || (selected === "home" ? game.rec_team : game.opponent), opponent = game[`${other}_team`] || (selected === "home" ? game.opponent : game.rec_team);
  const model = isV5 ? Number(game[`${selected}_pct`]) : NaN, market = Number(game[`${selected}_market_prob`]), edge = Number.isFinite(model) && Number.isFinite(market) ? model - market : null;
  const pitcher = game[`${selected}_pitcher`] || "TBD", oppPitcher = game[`${other}_pitcher`] || "TBD", offense = game[`${selected}_offense`] || {}, bullpen = game[`${selected}_bullpen`] || {};
  const isModelSide = game.rec_is_home === (selected === "home"), readiness = !isV5 ? "V5 refresh required" : game.lineups_confirmed ? "Lineups confirmed" : "Pre-lineup read";
  const factorScores = game.factor_scores || {}, factorDirection = isModelSide ? 1 : -1;
  const signed = (key) => { if (!Object.prototype.hasOwnProperty.call(factorScores, key)) return "—"; const n = Number(factorScores[key]) * factorDirection; return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; };
  const weather = game.weather || {};
  const tier = String(game.tier || "PASS").toUpperCase();
  const actionable = isV5 && game.lineups_confirmed && (tier === "LEAN" || tier === "STRONG");
  const noBetReason = !isV5
    ? "The website is waiting for a fresh v5 expected-runs snapshot from the Vortex bot. Older model data is not presented as a current pick."
    : !game.lineups_confirmed
    ? "Awaiting confirmed lineups and reliable starters. This is research, not a pick."
    : game.volatility === "HIGH"
      ? "No bet — game volatility is too high for a reliable moneyline call."
      : "No bet — the model has not found a qualified, actionable edge.";
  const weatherText = typeof weather === "string" ? weather : (weather.dome ? "Indoor / roof context" : [weather.temperature, weather.speed_mph ? `${weather.speed_mph} mph wind` : ""].filter(Boolean).join(" · ") || "Weather pending");
  picker.innerHTML = games.map((item) => `<button class="ml-game-choice ${String(item.game_pk) === String(game.game_pk) ? "active" : ""}" data-ml-game="${escapeHtml(String(item.game_pk))}"><span>${escapeHtml(item.away_abbr || item.away_team || "AWY")} @ ${escapeHtml(item.home_abbr || item.home_team || "HME")}</span><small>${item.lineups_confirmed ? "confirmed" : "pre-game"}</small></button>`).join("");
  report.innerHTML = `<div class="ml-matchup-head"><div><p class="eyebrow">${readiness.toUpperCase()}</p><h3>${escapeHtml(team)} <span>vs ${escapeHtml(opponent)}</span></h3><p>${escapeHtml(pitcher)} vs ${escapeHtml(oppPitcher)} · ${moneylineGameTime(game.commence_time)}</p></div><div class="ml-side-toggle" role="group" aria-label="Team to research"><button class="${selected === "away" ? "active" : ""}" data-ml-side="away">${escapeHtml(game.away_abbr || "Away")}</button><button class="${selected === "home" ? "active" : ""}" data-ml-side="home">${escapeHtml(game.home_abbr || "Home")}</button></div></div><div class="ml-score-row"><div class="ml-score"><span>MODEL WIN</span><strong>${Number.isFinite(model) ? `${model.toFixed(1)}%` : "—"}</strong><small>${isV5 ? (isModelSide ? "model-selected side" : "your selected side") : "awaiting v5 refresh"}</small></div><div class="ml-score"><span>MARKET</span><strong>${Number.isFinite(market) ? market.toFixed(1) : "—"}%</strong><small>${moneylineValue(game[`${selected}_odds`], "—")} odds</small></div><div class="ml-score ${edge !== null && edge >= 0 ? "positive" : ""}"><span>PRICING GAP</span><strong>${edge === null ? "—" : `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`}</strong><small>${edge !== null && edge >= 0 ? "model above price" : "awaiting current model"}</small></div></div><div class="ml-evidence"><article><span>STARTER</span><strong>${escapeHtml(pitcher)}</strong><p>FIP ${moneylineDecimal(game[`${selected}_fip`])} · opponent: ${escapeHtml(oppPitcher)}</p></article><article><span>TEAM FORM</span><strong>${moneylineValue(game[`${selected}_record`])}</strong><p>${moneylineValue(offense.wrc_plus || offense.wrc)} wRC+ · ${moneylineValue(offense.iso)} ISO · ${moneylineValue(offense.bb_pct)}% BB</p></article><article><span>BULLPEN</span><strong>${moneylineDecimal(bullpen.era)} ERA</strong><p>${moneylineValue(bullpen.fatigued_count, "0")} fatigued arms · late-game context</p></article><article><span>CONTEXT</span><strong>${moneylineDecimal(game.park_factor)} park factor</strong><p>${escapeHtml(game.weather || "Weather not available")}</p></article></div><div class="ml-verdict"><span>${edge !== null && edge >= 0 ? "MODEL LEAN" : "CAUTION"}</span><p>${escapeHtml(game.insight || "The model is weighing starters, team quality, bullpen condition, market price, park and game context.")}</p></div>`;
  const baseScore = isV5 ? Number(game.moneyline_score) : NaN;
  const shownScore = Number.isFinite(baseScore) ? (isModelSide ? baseScore : 100 - baseScore) : null;
  const scoreLabel = shownScore === null ? (isV5 ? "Pending" : "Refresh required") : shownScore >= 67 ? "Favorable" : shownScore <= 33 ? "Unfavorable" : "Neutral";
  const factorRows = (game.moneyline_factors || []).map((factor) => {
    const impact = Number(factor.impact || 0) * (isModelSide ? 1 : -1);
    return `<div class="ml-weight-row"><div><b>${escapeHtml(factor.name || "Factor")}</b><small>${escapeHtml(factor.detail || "")}</small></div><strong>${impact > 0 ? "+" : ""}${impact} / ${moneylineValue(factor.weight, 0)}</strong></div>`;
  }).join("");
  const expectedRuns = Number(game[`${selected}_expected_runs`]);
  const adjusted = isModelSide ? Number(game.adjusted_edge) : (edge === null ? NaN : edge - Number(game.uncertainty_buffer || 0));
  report.insertAdjacentHTML("afterbegin", `<section class="ml-v5-score" data-tone="${scoreLabel.toLowerCase()}"><div class="ml-v5-head"><div><span>MONEYLINE MATCHUP SCORE</span><small>${scoreLabel} · ${Math.round(Number(game.moneyline_coverage || 0) * 100)}% reliable coverage</small></div><strong>${shownScore === null ? "—" : `${Math.round(shownScore)}/100`}</strong></div><div class="ml-v5-track"><i style="width:${shownScore === null ? 0 : shownScore}%"></i></div><div class="ml-v5-projection"><span>Projected runs <b>${Number.isFinite(expectedRuns) ? expectedRuns.toFixed(2) : "—"}</b></span><span>Raw edge <b>${edge === null ? "—" : `${edge >= 0 ? "+" : ""}${edge.toFixed(1)}%`}</b></span><span>Uncertainty-adjusted <b>${Number.isFinite(adjusted) ? `${adjusted >= 0 ? "+" : ""}${adjusted.toFixed(1)}%` : "—"}</b></span></div><div class="ml-weight-list">${factorRows}</div></section>`);
  report.querySelector(".ml-evidence article:last-child p").textContent = weatherText;
  if (!actionable) {
    const verdict = report.querySelector(".ml-verdict");
    verdict.querySelector("span").textContent = !isV5 ? "V5 REFRESH REQUIRED" : game.lineups_confirmed ? "NO BET" : "AWAITING LINEUPS";
    verdict.querySelector("p").textContent = noBetReason;
    verdict.classList.add("ml-no-bet");
    report.querySelector(".ml-score.positive")?.classList.remove("positive");
  }
  report.insertAdjacentHTML("beforeend", `<section class="ml-model-card"><div class="ml-model-head"><div><span>MODEL BREAKDOWN</span><strong>${escapeHtml(game.game_archetype || "Awaiting current model data")}</strong></div><div><span>CONFIDENCE</span><strong>${game.confidence_score === undefined ? "Awaiting refresh" : `${moneylineValue(game.confidence_score)}/100 · ${escapeHtml(game.confidence_band || "—")}`}</strong></div><div><span>VOLATILITY</span><strong class="vol-${String(game.volatility || "low").toLowerCase()}">${game.volatility_score === undefined ? "Awaiting refresh" : `${escapeHtml(game.volatility || "—")} ${moneylineValue(game.volatility_score)}/100`}</strong></div></div><div class="ml-factor-grid">${[["Pitching", "pitching"], ["Offense", "offense"], ["Bullpen", "bullpen"], ["Team form", "team_form"], ["Venue / H2H", "venue"], ["Market value", "market_value"]].map(([label, key]) => { const exists = Object.prototype.hasOwnProperty.call(factorScores, key); const value = Number(factorScores[key]) * factorDirection; return `<div><span>${label}</span><strong class="${exists && value < 0 ? "minus" : exists ? "plus" : ""}">${signed(key)}</strong></div>`; }).join("")}</div><div class="ml-action-row"><div><span>FAIR ODDS</span><strong>${moneylineValue(game.fair_odds)}</strong></div><div><span>STATUS</span><strong>${escapeHtml(game.tier || "PASS")}</strong></div><p>${(game.volatility_reasons || []).length ? escapeHtml(game.volatility_reasons.join(" · ")) : "Run a bot refresh to calculate the current scorecard."}</p></div></section>`);
  const evidence = report.querySelectorAll(".ml-evidence article");
  if (evidence[1]) {
    evidence[1].querySelector("span").textContent = "TEAM QUALITY";
    evidence[1].querySelector("p").textContent = `OPS ${moneylineValue(offense.ops)} · ISO ${moneylineValue(offense.iso)} · season context only`;
  }
  if (evidence[2]) {
    evidence[2].querySelector("p").textContent = bullpen.sample === "l7" && Number(bullpen.total_ip) >= 12
      ? `${moneylineValue(bullpen.total_ip)} relief IP · sample-qualified context`
      : "Short relief sample unavailable — not used to make a pick";
  }
  if (evidence[3]) evidence[3].querySelector("span").textContent = "CONTEXT (NOT SCORED)";

  const modelHead = report.querySelectorAll(".ml-model-head div");
  if (modelHead[1]) modelHead[1].querySelector("span").textContent = "MODEL QUALITY";

  const factorCells = [...report.querySelectorAll(".ml-factor-grid > div")];
  const modelFactors = [
    ["Pitching", "pitching"], null, ["Bullpen", "bullpen"],
    ["Team quality", "team_quality"], null, ["Market value", "market_value"],
  ];
  factorCells.forEach((cell, index) => {
    const factor = modelFactors[index];
    if (!factor) { cell.remove(); return; }
    const [label, key] = factor;
    const exists = Object.prototype.hasOwnProperty.call(factorScores, key);
    const value = Number(factorScores[key]) * factorDirection;
    cell.querySelector("span").textContent = label;
    const score = cell.querySelector("strong");
    score.textContent = signed(key);
    score.className = exists && value < 0 ? "minus" : exists ? "plus" : "";
  });

  const homeStarter = game.home_starter_profile || {}, awayStarter = game.away_starter_profile || {};
  const stat = (profile, key) => moneylineValue(profile[key]);
  const arsenal = (profile) => (profile.arsenal || []).map((pitch) => `${escapeHtml(pitch.pitch_name || pitch.pitch_type || "Pitch")} ${moneylineValue(pitch.pct)}%`).join(" · ") || "Pitch mix pending";
  const recent = (profile) => (profile.recent_starts || []).map((start) => `${escapeHtml(start.ip || "—")} IP · ${moneylineValue(start.k)} K · ${moneylineValue(start.er)} ER`).join("<br>") || "Recent-start log pending";
  report.insertAdjacentHTML("beforeend", `<section class="ml-workbench"><div class="ml-workbench-title"><div><span>RESEARCH WORKBENCH</span><h4>Compare the matchup yourself</h4></div><p>Raw data is separate from the model recommendation.</p></div><div class="ml-research-section"><h5>Starting pitchers</h5><div class="ml-compare"><article><b>${escapeHtml(game.away_abbr || "Away")} · ${escapeHtml(awayStarter.name || game.away_pitcher || "TBD")}</b><div class="ml-stat-lines"><span>ERA <strong>${stat(awayStarter,"era")}</strong></span><span>FIP <strong>${stat(awayStarter,"fip")}</strong></span><span>WHIP <strong>${stat(awayStarter,"whip")}</strong></span><span>K/9 <strong>${stat(awayStarter,"k_per_9")}</strong></span><span>BB/9 <strong>${stat(awayStarter,"bb_per_9")}</strong></span><span>HR/9 <strong>${stat(awayStarter,"hr_per_9")}</strong></span></div><p><em>Arsenal</em> ${arsenal(awayStarter)}</p><p><em>Last starts</em><br>${recent(awayStarter)}</p></article><article><b>${escapeHtml(game.home_abbr || "Home")} · ${escapeHtml(homeStarter.name || game.home_pitcher || "TBD")}</b><div class="ml-stat-lines"><span>ERA <strong>${stat(homeStarter,"era")}</strong></span><span>FIP <strong>${stat(homeStarter,"fip")}</strong></span><span>WHIP <strong>${stat(homeStarter,"whip")}</strong></span><span>K/9 <strong>${stat(homeStarter,"k_per_9")}</strong></span><span>BB/9 <strong>${stat(homeStarter,"bb_per_9")}</strong></span><span>HR/9 <strong>${stat(homeStarter,"hr_per_9")}</strong></span></div><p><em>Arsenal</em> ${arsenal(homeStarter)}</p><p><em>Last starts</em><br>${recent(homeStarter)}</p></article></div></div><div class="ml-research-section"><h5>Offense and bullpen</h5><div class="ml-compare">${[[game.away_abbr || "Away", game.away_offense || {}, game.away_bullpen || {}], [game.home_abbr || "Home", game.home_offense || {}, game.home_bullpen || {}]].map(([abbr, off, pen]) => `<article><b>${escapeHtml(abbr)}</b><div class="ml-stat-lines"><span>wRC+ <strong>${moneylineValue(off.wrc_plus)}</strong></span><span>ISO <strong>${moneylineValue(off.iso)}</strong></span><span>BB% <strong>${moneylineValue(off.bb_pct)}</strong></span><span>K% <strong>${moneylineValue(off.k_pct)}</strong></span><span>Runs/G <strong>${moneylineValue(off.runs_pg)}</strong></span><span>BP ERA <strong>${moneylineValue(pen.era)}</strong></span></div><p><em>Bullpen</em> ${moneylineValue(pen.whip)} WHIP · ${moneylineValue(pen.hr9)} HR/9 · ${moneylineValue(pen.fatigued_count,"0")} fatigued arms</p></article>`).join("")}</div></div><div class="ml-research-section"><h5>Game context</h5><div class="ml-context-data"><span>Park factor <strong>${moneylineValue(game.park_factor)}</strong></span><span>Weather <strong>${escapeHtml(weatherText)}</strong></span><span>Lineups <strong>${game.lineups_confirmed ? "Confirmed" : "Projected"}</strong></span><span>Volatility <strong>${escapeHtml(game.volatility || "—")} ${moneylineValue(game.volatility_score)}/100</strong></span></div></div></section>`);
  const offenseSection = [...report.querySelectorAll(".ml-research-section")].find((section) => section.querySelector("h5")?.textContent === "Offense and bullpen");
  if (offenseSection) {
    const cards = offenseSection.querySelectorAll(".ml-compare article");
    [[game.away_offense || {}, game.away_bullpen || {}], [game.home_offense || {}, game.home_bullpen || {}]].forEach(([off, pen], index) => {
      const card = cards[index];
      if (!card) return;
      const firstMetric = card.querySelector(".ml-stat-lines span");
      if (firstMetric) firstMetric.innerHTML = `OPS <strong>${moneylineValue(off.ops)}</strong>`;
      const bullpenNote = card.querySelector("p");
      if (bullpenNote) bullpenNote.textContent = pen.sample === "l7" && Number(pen.total_ip) >= 12
        ? `Recent relief sample: ${moneylineValue(pen.total_ip)} IP · ${moneylineValue(pen.era)} ERA`
        : "Recent relief sample is not large enough to score.";
    });
  }
  picker.querySelectorAll("[data-ml-game]").forEach((button) => button.addEventListener("click", () => { state.moneylineGamePk = button.dataset.mlGame; renderMoneylineResearch(games); }));
  report.querySelectorAll("[data-ml-side]").forEach((button) => button.addEventListener("click", () => { state.moneylineSide = button.dataset.mlSide; renderMoneylineResearch(games); }));
}

async function loadAdminRecords() {
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

function renderAdminRecords() {
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
    const hit = r.result === "hit"; const label = state.adminRecordTab === "props" ? `${r.player_name} · ${r.side} ${r.line} ${r.stat_type}` : state.adminRecordTab === "moneyline" ? `${r.rec_team} vs ${r.opponent} · ${r.odds}` : `${r.recommendation} · ${r.away_abbr} @ ${r.home_abbr}`;
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
  // Private Research is public. Keep the old OAuth implementation below dormant
  // so no login request, Discord membership check, or account UI is used.
  return;

  // The OAuth callback redirects back here with ?auth=success|denied|error
  // (it can't show a message itself -- it's a bare redirect). Surface it
  // once, then scrub the query param so a refresh doesn't repeat it.
  const params = new URLSearchParams(location.search);
  const authResult = params.get("auth");
  if (authResult) {
    params.delete("auth");
    const clean = location.pathname + (params.toString() ? `?${params}` : "");
    history.replaceState({}, "", clean);
  }

  let data;
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    data = await res.json();
  } catch (err) {
    data = { authenticated: false };
  }

  if (data.authenticated) {
    els.authGate.hidden = true;
    els.userBadge.hidden = false;
    els.userBadgeName.textContent = data.username || "Member";
    els.appShell.classList.remove("app-shell-hidden");
    if (authResult === "success") showToast(`Welcome, ${data.username || "Member"}.`);
    return;
  }

  // Not authenticated: app shell stays hidden (never revealed), only the
  // gate shows. No flash of the app content either way.
  els.userBadge.hidden = true;
  if (authResult === "denied") {
    els.authGateMsg.textContent = "You're signed in with Discord, but don't have Premium/Tester access yet. Join the community role first, then sign in again.";
  } else if (authResult === "error") {
    els.authGateMsg.textContent = "Login didn't go through — please try again.";
  } else {
    els.authGateMsg.textContent = "Members-only research. Sign in with Discord to continue.";
  }
  els.authGate.hidden = false;
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
  const label = btnEl.querySelector(".save-btn-label");
  if (label) label.textContent = saved ? "In Builder" : "Add to Builder";
  else btnEl.textContent = saved ? "in builder" : "add to builder";
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

async function finishPrivateLoader(startedAt) {
  const minimumDisplayMs = 1500;
  const elapsed = performance.now() - startedAt;
  if (elapsed < minimumDisplayMs) {
    await new Promise((resolve) => setTimeout(resolve, minimumDisplayMs - elapsed));
  }

  els.appShell.classList.remove("app-shell-hidden");
  const loader = document.getElementById("boot-loading");
  if (!loader) return;
  loader.classList.add("private-loader-leaving");
  window.setTimeout(() => loader.remove(), 700);
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
        : `${actual ?? "—"} ${unit}${live.at_bats != null ? ` · ${live.hits ?? 0}/${live.at_bats} batting` : ""}${live.plate_appearances ? ` · ${live.plate_appearances} KD` : ""}`;
      const chase = stateClass === "live" && need ? `Needs ${need} more` : stateClass === "pregame" ? "Not started" : stateLabel;
      const modelMeta = [row.vortex_score != null ? `Score ${row.vortex_score}` : "", row.matchup_score != null ? `Matchup ${Math.round(Number(row.matchup_score))}` : ""].filter(Boolean).join(" · ");
      return `<article class="live-prop-card ${stateClass}"><div class="live-prop-main"><span class="live-prop-name">${escapeHtml(row.player_name)}</span><strong>${escapeHtml(direction)} ${escapeHtml(String(row.line))} ${escapeHtml(row.stat_type)}</strong><small>${escapeHtml(tracking)}${modelMeta ? ` · ${escapeHtml(modelMeta)}` : ""}</small></div><div class="live-prop-meter"><i style="--live-progress:${progress}%"></i></div><div class="live-prop-state"><span>${escapeHtml(stateLabel)}</span><small>${escapeHtml(chase)}</small></div></article>`;
    }).join("");
    return `<section class="live-game-group ${isLive ? "is-live" : ""}"><header><div><span class="live-pulse"></span><strong>${escapeHtml(title)}</strong></div><b>${escapeHtml(gameStatus)}</b></header><div class="live-game-props">${cards}</div></section>`;
  }).join("");
}

/* ---------- Search ---------- */

function wireSearch() {
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
  wireStatsDropdown();
}

/**
 * Custom-styled dropdown replacing the stat <select>'s native OS popup
 * (the blue-highlighted browser-default listbox looked out of place next
 * to the rest of the themed UI). The real <select> stays in the DOM,
 * hidden, purely as the value/change-event source everything else reads.
 */
function wireStatsDropdown() {
  els.profileStatsTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    els.profileStatsMenu.hidden ? openStatsMenu() : closeStatsMenu();
  });
  document.addEventListener("click", (e) => {
    if (!els.profileStatsMenu.hidden && !els.profileStatsWrap.contains(e.target)) closeStatsMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.profileStatsMenu.hidden) closeStatsMenu();
  });
}

function openStatsMenu() {
  els.profileStatsMenu.hidden = false;
  els.profileStatsTrigger.classList.add("open");
  syncDropdownScrollLock();
}

function closeStatsMenu() {
  els.profileStatsMenu.hidden = true;
  els.profileStatsTrigger.classList.remove("open");
  syncDropdownScrollLock();
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
const playerSearchCache = new Map();

function clearSearchQuery() {
  els.searchInput.value = "";
}

function onSearchInput() {
  const query = els.searchInput.value;
  const isSearchable = query.trim().length >= 2;

  if (!query.trim()) {
    clearTimeout(searchDebounceTimer);
    searchRequestToken++;
    hideResults();
    return;
  }

  // Static demo matches render instantly; live MLB suggestions follow after
  // a short debounce so we're not firing an API call on every keystroke.
  renderResults(staticEntriesFor(query), { loading: isSearchable });

  clearTimeout(searchDebounceTimer);
  if (!isSearchable) {
    searchRequestToken++; // invalidate any in-flight fetch's result
    return;
  }
  searchDebounceTimer = setTimeout(() => fetchLiveSuggestions(query), 120);
}

async function fetchLiveSuggestions(query) {
  const token = ++searchRequestToken;
  let livePlayers = [];
  let fetchFailed = false;
  const cacheKey = normalizePlayerSearch(query);
  try {
    if (playerSearchCache.has(cacheKey)) {
      livePlayers = playerSearchCache.get(cacheKey);
    } else {
      const res = await fetch(`${API_PLAYERS_SOURCE}?q=${encodeURIComponent(query)}`);
      const data = await res.json();
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
    chip.addEventListener("click", () => selectPlayer(player));
    els.browseChips.appendChild(chip);
  });
}

/* ---------- Player profile: stat buttons + slide/type-in line picker ---------- */

const cmd = { player: null, playerId: null, teamId: null, teamName: "", stat: null, line: null, side: null };
const prizePicksLineCache = new Map();
let currentResearchProp = null;
let prizePicksDefaultPending = false;

function syncDropdownScrollLock() {
  const menuOpen = !els.profileStatsMenu.hidden || !els.ppLinesMenu.hidden;
  document.body.classList.toggle("dropdown-scroll-locked", menuOpen);
}

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
  const togglePrizePicksMenu = () => {
    const opening = els.ppLinesMenu.hidden;
    els.ppLinesMenu.hidden = !opening;
    els.ppLinesTrigger.setAttribute("aria-expanded", String(opening));
    syncDropdownScrollLock();
    if (opening) loadPrizePicksLines();
  };
  els.ppLinesTrigger.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    els.ppLinesTrigger.focus();
    togglePrizePicksMenu();
  });
  els.ppLinesTrigger.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    togglePrizePicksMenu();
  });
  document.addEventListener("click", (event) => {
    if (!els.ppLinesMenu.hidden && !els.ppLinesWrap.contains(event.target)) {
      els.ppLinesMenu.hidden = true;
      els.ppLinesTrigger.setAttribute("aria-expanded", "false");
      syncDropdownScrollLock();
    }
  });
}

function americanOdds(value) {
  const odds = Number(value);
  return Number.isFinite(odds) ? `${odds > 0 ? "+" : ""}${odds}` : "—";
}

async function loadPrizePicksLines() {
  const opponent = currentResearchProp?.matchup?.opponent || "";
  const key = `${cmd.player}|${cmd.stat}|${opponent}`.toLowerCase();
  els.ppLinesMenu.innerHTML = `<div class="pp-lines-state">Loading live PrizePicks lines…</div>`;
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
    if (`${cmd.player}|${cmd.stat}|${opponent}`.toLowerCase() === key) {
      const currentTier = currentRow?.tier || (currentRow?.featured ? "STANDARD" : "ALT");
      const currentTierIcon = currentTier === "GOBLIN" ? "/prizepicks/goblin.png" : currentTier === "DEMON" ? "/prizepicks/demon.png" : "";
      els.ppLinesTrigger.querySelector("b").innerHTML = currentRow
        ? `<span>${cmd.line}</span>${currentTierIcon ? `<img src="${currentTierIcon}" alt="" />` : ""}`
        : "PrizePicks lines";
    }
    els.ppLinesMenu.innerHTML = `<div class="pp-lines-head"><div><span><img src="/prizepicks/logo.png" alt="" /> PrizePicks</span><b>${escapeHtml(cmd.stat)}</b></div></div>` + availableLines.map(row => {
      const selected = Math.abs(Number(row.line) - Number(cmd.line)) < .01;
      const safer = featured != null && (cmd.side === "Over" ? row.line < featured : row.line > featured);
      const boosted = featured != null && (cmd.side === "Over" ? row.line > featured : row.line < featured);
      const tier = row.tier || (row.featured ? "STANDARD" : safer ? "GOBLIN" : boosted ? "DEMON" : "ALT");
      const tierIcon = tier === "GOBLIN" ? "/prizepicks/goblin.png" : tier === "DEMON" ? "/prizepicks/demon.png" : "";
      return `<button type="button" class="pp-line-option ${selected ? "selected" : ""}" data-pp-line="${row.line}"><b>${row.line}</b><span class="pp-line-icons"><img src="/prizepicks/logo.png" alt="PrizePicks" />${tierIcon ? `<img class="pp-creature-icon" src="${tierIcon}" alt="" />` : ""}</span>${selected ? "<i>✓</i>" : ""}</button>`;
    }).join("");
    els.ppLinesMenu.querySelectorAll("[data-pp-line]").forEach(button => button.addEventListener("click", () => {
      prizePicksDefaultPending = false;
      els.ppLinesMenu.hidden = true;
      els.ppLinesTrigger.setAttribute("aria-expanded", "false");
      syncDropdownScrollLock();
      setLineValue(Number(button.dataset.ppLine), { immediate: true });
    }));
    const stillCurrent = `${cmd.player}|${cmd.stat}|${currentResearchProp?.matchup?.opponent || ""}`.toLowerCase() === key;
    if (stillCurrent && prizePicksDefaultPending && featured != null
        && Math.abs(Number(featured) - Number(cmd.line)) >= .01) {
      prizePicksDefaultPending = false;
      setLineValue(Number(featured), { immediate: true });
    }
  } catch (error) {
    els.ppLinesTrigger.querySelector("b").textContent = "Lines unavailable";
    els.ppLinesMenu.innerHTML = `<div class="pp-lines-state error">${escapeHtml(error.message)}</div>`;
  }
}

// "P" -> pitcher-only stats, anything else known -> batter-only stats,
// undefined/null (position not known, e.g. typed-and-Entered names that
// skipped autocomplete) -> both, so a valid option is never hidden just
// because we couldn't confirm the position.
function selectPlayer(player, position, { autoSelectStat = true, viaDeepDive = false, playerEntry = null } = {}) {
  if (!viaDeepDive) {
    state.v2DeepDiveReturn = null;
    els.v2BackBtn.hidden = true;
  }
  hideResults();
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
  els.profileStatsMenu.innerHTML = "";
  stats.forEach((stat) => {
    const opt = document.createElement("option");
    opt.value = stat;
    opt.textContent = stat;
    els.profileStats.appendChild(opt);

    const li = document.createElement("li");
    li.className = "profile-stats-menu-item";
    li.setAttribute("role", "option");
    li.textContent = stat;
    li.addEventListener("click", () => {
      els.profileStats.value = stat;
      closeStatsMenu();
      selectStat(stat);
    });
    els.profileStatsMenu.appendChild(li);
  });

  els.linePicker.hidden = true;
  els.playerProfile.hidden = false;
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
  els.ppLinesMenu.hidden = true;
  syncDropdownScrollLock();
  if (els.profileStats.value !== stat) els.profileStats.value = stat;
  els.profileStatsTriggerLabel.textContent = stat;
  els.profileStatsMenu.querySelectorAll(".profile-stats-menu-item").forEach((li) => {
    li.classList.toggle("active", li.textContent === stat);
  });

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

let lineDebounceTimer = null;

// Dragging the slider fires an "input" event per pixel of movement. Running
// applyLineSelection() (which re-renders a loading skeleton, or the whole
// report, on every tick) on each of those made the slider visibly stutter
// mid-drag. The value/fill/number stay perfectly live (cheap, no re-render);
// only the actual lookup is debounced until the drag settles.
function setLineValue(value, { immediate = false } = {}) {
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

let lineSelectionToken = 0;

function withAuthoritativeBoardMatchup(prop, player, stat, line, side) {
  // The board remains authoritative for the official VORTEX pick score/tier.
  // Matchup is deliberately NOT copied from the board: Research and the
  // Matchup tab both use the current live matchup calculation.
  const boardContext = state.boardResearchContext;
  const sameBoardProp = boardContext
    && boardContext.player.toLowerCase() === String(player).toLowerCase()
    && boardContext.stat === stat
    && Math.abs(Number(boardContext.line) - Number(line)) < 0.01
    && boardContext.side === String(side).toLowerCase();
  if (!sameBoardProp) return prop;
  return {
    ...prop,
    ...(Number.isFinite(Number(boardContext.vortexScore))
      ? { score: Number(boardContext.vortexScore), tier: boardContext.tier || prop.tier }
      : {}),
  };
}

function applyLineSelection() {
  const match = propsForPlayer().find(
    (p) => p.betType === cmd.stat && Math.abs(p.line - cmd.line) < 0.01 && p.side === cmd.side
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
  renderLoadingState(player, stat, line, side);

  let result = null;
  let errorMessage = null;
  const controller = new AbortController();
  const requestTimeout = setTimeout(() => controller.abort(), 15000);
  try {
    // Build this URL the same way as the player-search request. Older iOS
    // WebKit can throw "The string did not match the expected pattern" while
    // constructing URLSearchParams from a record, before fetch ever reaches
    // the API. Explicit encoding is supported by every Safari version that
    // can run the rest of this app and keeps spaces/accents safe.
    const query = [
      ["player", player],
      ["stat", stat],
      ["line", String(line)],
      ["side", side.toLowerCase()],
      ...(cmd.playerId ? [["playerId", String(cmd.playerId)]] : []),
      ...(cmd.teamId ? [["teamId", String(cmd.teamId)]] : []),
      ...(cmd.teamName ? [["team", cmd.teamName]] : []),
    ].map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
    const res = await fetch(`${API_SOURCE}?${query}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      errorMessage = data.error || `Request failed (${res.status})`;
    } else {
      result = data;
    }
  } catch (err) {
    errorMessage = err.name === "AbortError"
      ? "Research took longer than 15 seconds. Please retry."
      : "Live research is temporarily unavailable. Please tap the stat to retry.";
  } finally {
    clearTimeout(requestTimeout);
  }

  if (token !== lineSelectionToken) return; // a newer selection superseded this one

  if (result) {
    renderReport(withAuthoritativeBoardMatchup(result, player, stat, line, side));
    return;
  }

  showNoDataMessage(stat, line, side, errorMessage);
}

function renderLoadingState(player, stat, line, side) {
  els.reportWrap.querySelector(".report")?.remove();
  removeResearchLoader();
  els.emptyState.hidden = true;

  const skeleton = document.createElement("div");
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

const EMPTY_STATE_DEFAULT_HTML = `
  <div class="research-welcome-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none"><circle cx="10.5" cy="10.5" r="5.75" stroke="currentColor" stroke-width="1.5"/><path d="m15 15 4.25 4.25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
  </div>
  <p class="research-welcome-kicker">Player research</p>
  <h2>Start with a player.</h2>
  <p class="research-welcome-copy">Search above to turn a live prop into one clear, matchup-aware view.</p>
  <div class="research-welcome-features" aria-label="Research includes">
    <div><span>01</span><strong>Recent form</strong><small>L5, L10 and L20 trends</small></div>
    <div><span>02</span><strong>Matchup context</strong><small>Splits, opponent and venue</small></div>
    <div><span>03</span><strong>Live lines</strong><small>PrizePicks-ready research</small></div>
  </div>`;

function clearReport() {
  els.reportWrap.querySelector(".report")?.remove();
  removeResearchLoader();
  els.emptyState.hidden = false;
  els.emptyState.classList.add("research-welcome");
  els.emptyState.setAttribute("aria-label", "Player research welcome");
  els.emptyState.innerHTML = EMPTY_STATE_DEFAULT_HTML;
}

/* ---------- Report rendering (Research tab) ---------- */

function renderReport(p) {
  hideResults();
  els.emptyState.hidden = true;
  els.reportWrap.querySelector(".report")?.remove();
  removeResearchLoader();
  syncProfileHeaderWithProp(p);
  currentResearchProp = p;
  els.ppLinesWrap.hidden = !(p?.matchup?.opponent && cmd.player && cmd.stat);
  if (!els.ppLinesWrap.hidden) {
    els.ppLinesTrigger.querySelector("b").textContent = "Checking PrizePicks…";
    loadPrizePicksLines();
  }

  const node = buildReportNode(p);
  els.reportWrap.appendChild(node);

  const saveBtn = node.querySelector(".save-btn");
  syncSaveButton(saveBtn, p.id);
  saveBtn.addEventListener("click", () => toggleSave(p, saveBtn));

  const revealBlocks = node.querySelectorAll("[data-reveal]");
  revealBlocks.forEach((block, i) => {
    setTimeout(() => block.classList.add("in"), 120 + i * 90);
  });

  requestAnimationFrame(() => {
    countUpScoreNum(node, p.score);
    fillHitRateBars(node, p.hitRates || {});
    fillSparkline(node, p.last5 || [], p.line);
  });

  const expandBtn = node.querySelector(".last5-expand-btn");
  if (p.gameLogChart && Object.keys(p.gameLogChart).length) {
    expandBtn.addEventListener("click", () => openGameLogModal(p));
  } else {
    expandBtn.classList.add("last5-expand-disabled");
  }

  if (state.currentTab === "research") {
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ---------- Expandable game log modal (L5/L10/L15/L20/H2H) ---------- */

let gameLogState = {
  chart: null, line: null, player: "", opponent: "", window: "recent",
  handFilter: "all", venueFilter: "all", handDataLoaded: false, teamId: null,
  stat: "", isPitcher: false, fetchToken: 0, gameCount: 5, season: "all",
  filtersOpen: false, animationDirection: "none",
};

function snapPropLine(value) {
  return Math.max(0.5, Math.round(Number(value) - 0.5) + 0.5);
}

const GAMELOG_STAT_CODES = {
  "Hits+Runs+RBIs": "HRR", "Total Bases": "TB", "Hits": "H",
  "Home Runs": "HR", "RBIs": "RBI", "Runs Scored": "R",
  "Strikeouts": "SO", "Walks": "BB", "Fantasy Score": "FS",
  "Strikeouts (Pitcher)": "K", "Pitching Outs": "OUTS",
  "Earned Runs Allowed": "ER", "Hits Allowed": "HA", "Walks Allowed": "BB",
  "Fantasy Score (Pitcher)": "PFS",
};
const MLB_TEAM_IDS = { ARI:109, AZ:109, ATL:144, BAL:110, BOS:111, CHC:112, CWS:145, CIN:113, CLE:114, COL:115, DET:116, HOU:117, KC:118, LAA:108, LAD:119, MIA:146, MIL:158, MIN:142, NYM:121, NYY:147, OAK:133, PHI:143, PIT:134, SD:135, SEA:136, SF:137, STL:138, TB:139, TEX:140, TOR:141, WSH:120 };
let gameLogPageScrollY = 0;

function lockGameLogPageScroll() {
  if (document.body.classList.contains("gamelog-scroll-locked")) return;
  gameLogPageScrollY = window.scrollY;
  document.body.style.setProperty("--gamelog-lock-top", `${-gameLogPageScrollY}px`);
  document.body.classList.add("gamelog-scroll-locked");
}

function unlockGameLogPageScroll() {
  if (!document.body.classList.contains("gamelog-scroll-locked")) return;
  document.body.classList.remove("gamelog-scroll-locked");
  document.body.style.removeProperty("--gamelog-lock-top");
  window.scrollTo(0, gameLogPageScrollY);
}

function gameLogStatCode(stat) {
  return GAMELOG_STAT_CODES[stat] || stat;
}

function regradeGameLog(line) {
  Object.values(gameLogState.chart || {}).forEach((games) => {
    (games || []).forEach((game) => { game.over = Number(game.value) >= line; });
  });
}

function setGameLogPreviewLine(value, settle = false) {
  const raw = Math.max(0.5, Number(value) || 0.5);
  const line = settle ? snapPropLine(raw) : raw;
  gameLogState.line = line;
  if (els.gamelogLineValue) els.gamelogLineValue.textContent = Number(line).toFixed(1);
  if (settle) {
    regradeGameLog(line);
    renderGameLogTabs();
  }
  renderGameLogChart();
}

function populateGameLogStats() {
  const stats = gameLogState.availableStats || (gameLogState.isPitcher ? PITCHER_STATS : BATTER_STATS);
  els.gamelogStatTabs.innerHTML = stats.map((stat) => `<button type="button" data-stat="${escapeHtml(stat)}" class="${stat === gameLogState.stat ? "active" : ""}">${escapeHtml(gameLogStatCode(stat))}</button>`).join("");
}

async function loadGameLogStat(stat) {
  const token = ++gameLogState.fetchToken;
  gameLogState.stat = stat;
  els.gamelogStatTabs?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  els.gamelogChart.classList.add("is-loading");
  els.gamelogTitle.textContent = gameLogState.player || "Player";
  els.gamelogStatTabs?.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.stat === stat));
  try {
    // Each market has its own PrizePicks baseline. Resolve that line before
    // fetching the new log so switching to K/OUTS/etc. never inherits the
    // previous market's number.
    const ppStat = stat.replace(/ \(Pitcher\)$/, "");
    let resolvedPrizePicksLine = false;
    try {
      const pp = await fetch(`/api/prediction?action=prizepicks-lines&player=${encodeURIComponent(gameLogState.player)}&stat=${encodeURIComponent(ppStat)}&opponent=${encodeURIComponent(gameLogState.opponent || "")}`);
      const ppData = await pp.json();
      const posted = (ppData.lines || []).find((row) => row.featured) || (ppData.lines || [])[0];
      if (posted && Number.isFinite(Number(posted.line))) {
        gameLogState.line = Number(posted.line);
        els.gamelogLineValue.textContent = gameLogState.line.toFixed(1);
        resolvedPrizePicksLine = true;
      }
    } catch (_) { /* fall back to the current line when live lines are unavailable */ }
    if (!resolvedPrizePicksLine && Number.isFinite(Number(STAT_DEFAULT_LINE[stat]))) {
      gameLogState.line = STAT_DEFAULT_LINE[stat];
      els.gamelogLineValue.textContent = gameLogState.line.toFixed(1);
    }
    const url = `/api/game-log-filters?player=${encodeURIComponent(gameLogState.player)}&stat=${encodeURIComponent(stat)}&line=${gameLogState.line}&season=all` +
      (gameLogState.teamId ? `&teamId=${gameLogState.teamId}` : "") +
      (gameLogState.opponent ? `&opponent=${encodeURIComponent(gameLogState.opponent)}` : "");
    const res = await fetch(url);
    const data = await res.json();
    if (token !== gameLogState.fetchToken) return;
    if (!res.ok || data.error) throw new Error(data.error || "Unable to load this stat");
    gameLogState.chart = data;
    regradeGameLog(gameLogState.line);
    gameLogState.window = "recent";
  } catch (err) {
    els.gamelogSub.textContent = err.message || "This stat is unavailable right now.";
  } finally {
    if (token === gameLogState.fetchToken) {
      els.gamelogStatTabs?.querySelectorAll("button").forEach((button) => { button.disabled = false; });
      els.gamelogChart.classList.remove("is-loading");
      renderGameLogTabs();
      renderGameLogChart();
    }
  }
}

function openGameLogModal(p) {
  gameLogState.chart = p.gameLogChart || {};
  if (!gameLogState.chart.all) {
    gameLogState.chart.all = [...(gameLogState.chart.l20 || gameLogState.chart.l15 || gameLogState.chart.l10 || gameLogState.chart.l5 || [])];
  }
  gameLogState.line = p.line;
  gameLogState.player = p.player;
  gameLogState.stat = p.betType;
  gameLogState.isPitcher = PITCHER_STATS.includes(p.betType) || p.position === "P" || p.isPitcherProp === true;
  const twoWay = p.isTwoWay === true || p.position === "TWP" || /shohei\s+ohtani/i.test(p.player || "");
  gameLogState.availableStats = twoWay ? STANDARD_STATS : (gameLogState.isPitcher ? PITCHER_STATS : BATTER_STATS);
  gameLogState.opponent = (p.matchup && p.matchup.opponent) || "";
  gameLogState.handFilter = "all";
  gameLogState.venueFilter = "all";
  gameLogState.handDataLoaded = false;
  gameLogState.gameCount = Math.min(5, gameLogState.chart.all.length || 5);
  gameLogState.window = "recent";
  // Start with the complete recent sample. Selecting the newest season here
  // could temporarily collapse the chart to one game while the detail request
  // was still loading, which made the modal visibly jump after opening.
  gameLogState.season = "all";
  gameLogState.filtersOpen = false;
  gameLogState.animationDirection = "initial";
  // Deliberately NOT teamInsightsParams.teamId -- that's the player's own
  // team (for the Team Insights lineup view), while H2H filtering here needs
  // the actual opponent's team id.
  gameLogState.teamId = p.opponentTeamId || null;
  els.gamelogOverlay.hidden = false;
  lockGameLogPageScroll();
  els.gamelogTitle.textContent = p.player || "Player";
  if (els.gamelogPropBadge) els.gamelogPropBadge.textContent = gameLogStatCode(p.betType);
  const teamName = p.teamAbbr || p.teamName || (typeof p.team === "string" ? p.team : p.team?.abbreviation) || "";
  const teamId = p.teamId || p.team_id || p.ownTeamId || p.team?.id || MLB_TEAM_IDS[String(teamName).toUpperCase()];
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
  els.gamelogLineValue.textContent = Number(p.line).toFixed(1);
  populateGameLogStats();
  setGameLogFiltersOpen(false);
  renderGameLogTabs();
  renderGameLogChart();

  // Career H2H is loaded lazily for every prop when the explorer opens.
  // Batter props also resolve opposing-starter handedness; pitcher props do
  // not, because one start faces a mixed lineup rather than one pitcher hand.
  const isPitcherProp = gameLogState.isPitcher;
  els.glHandFilter.hidden = isPitcherProp;
  renderGameLogSubfilters();
  fetchGameLogDetails(p);
}

async function fetchGameLogDetails(p) {
  const requestedStat = p.betType;
  els.glHandFilter.querySelectorAll(".gl-filter-chip").forEach((b) => { b.disabled = true; });
  try {
    const url = `/api/game-log-filters?player=${encodeURIComponent(p.player)}&stat=${encodeURIComponent(p.betType)}&line=${p.line}&season=all` +
      (gameLogState.teamId ? `&teamId=${gameLogState.teamId}` : "") +
      (gameLogState.opponent ? `&opponent=${encodeURIComponent(gameLogState.opponent)}` : "");
    const res = await fetch(url);
    const data = await res.json();
    if (res.ok && !data.error && gameLogState.stat === requestedStat) {
      // Merge per-window, don't replace wholesale -- teamInsightsParams
      // (and so gameLogState.teamId) can be null when the lineup/pitcher
      // isn't confirmed yet, which means THIS fetch can't resolve H2H even
      // though the initial card load already had it. Overwriting the whole
      // chart in that case silently threw away good H2H data the moment
      // this lazy fetch resolved. Only replace windows this fetch actually
      // returned games for; leave everything else as it was.
      for (const key of Object.keys(data)) if (Array.isArray(data[key])) gameLogState.chart[key] = data[key];
      gameLogState.handDataLoaded = true;
      // A background detail refresh must never look like a user-triggered
      // chart transition.
      gameLogState.animationDirection = "none";
    }
  } catch (err) {
    console.error("game-log-filters fetch failed:", err);
  } finally {
    els.glHandFilter.querySelectorAll(".gl-filter-chip").forEach((b) => { b.disabled = false; });
    renderGameLogTabs();
    renderGameLogChart();
  }
}

function closeGameLogModal() {
  els.gamelogOverlay.hidden = true;
  unlockGameLogPageScroll();
}

function filterGames(games) {
  return games.filter((g) => {
    if (gameLogState.season !== "all" && String(g.season || String(g.fullDate || "").slice(0, 4)) !== gameLogState.season) return false;
    if (gameLogState.handFilter !== "all" && g.oppHand !== gameLogState.handFilter) return false;
    if (gameLogState.venueFilter === "home" && g.isHome !== true) return false;
    if (gameLogState.venueFilter === "road" && g.isHome !== false) return false;
    return true;
  });
}

function renderGameLogSubfilters() {
  els.gamelogSubfilters.hidden = false;
  els.glHandFilter.querySelectorAll(".gl-filter-chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.hand === gameLogState.handFilter);
  });
  els.glVenueFilter.querySelectorAll(".gl-filter-chip").forEach((b) => {
    b.classList.toggle("active", b.dataset.venue === gameLogState.venueFilter);
  });
  const activeCount = Number(gameLogState.handFilter !== "all") + Number(gameLogState.venueFilter !== "all") + Number(gameLogState.season !== "all");
  if (els.gamelogFilterCount) {
    els.gamelogFilterCount.hidden = activeCount === 0;
    els.gamelogFilterCount.textContent = activeCount;
  }
}

function renderGameLogTabs() {
  const max = gameLogPool().length;
  if (gameLogState.window !== "h2h") gameLogState.gameCount = Math.max(1, Math.min(gameLogState.gameCount, Math.max(1, max)));
  if (els.gamelogGamesCount) els.gamelogGamesCount.textContent = gameLogState.gameCount;
  if (els.gamelogWindowLabel) els.gamelogWindowLabel.textContent = gameLogState.window === "h2h" ? "Career matchups" : `Last ${gameLogState.gameCount} game${gameLogState.gameCount === 1 ? "" : "s"}`;
  if (els.gamelogGamesDown) els.gamelogGamesDown.disabled = gameLogState.window === "h2h" || gameLogState.gameCount <= 1;
  if (els.gamelogGamesUp) els.gamelogGamesUp.disabled = gameLogState.window === "h2h" || gameLogState.gameCount >= max;
  if (els.gamelogH2HToggle) {
    els.gamelogH2HToggle.hidden = !(gameLogState.chart?.h2h || []).length;
    els.gamelogH2HToggle.classList.toggle("active", gameLogState.window === "h2h");
  }
  const seasons = [...new Set(recentGameLogSource().map((game) => String(game.season || String(game.fullDate || "").slice(0, 4))).filter((season) => /^\d{4}$/.test(season)))].sort().concat("all");
  if (els.gamelogSeasonRow) {
    els.gamelogSeasonRow.innerHTML = seasons.map((season) => `<button type="button" data-season="${season}" class="${gameLogState.season === season ? "active" : ""}">${season === "all" ? "All" : season}</button>`).join("");
  }
  els.gamelogPresetRow?.querySelectorAll("button").forEach((btn) => {
    const value = btn.dataset.games === "max" ? max : Number(btn.dataset.games);
    btn.disabled = !max;
    btn.classList.toggle("active", gameLogState.window !== "h2h" && gameLogState.gameCount === value);
  });
  renderGameLogSubfilters();
}

function renderGameLogChart() {
  const pool = gameLogPool();
  const games = gameLogState.window === "h2h" ? pool : pool.slice(-gameLogState.gameCount);
  const holder = els.gamelogChart;
  holder.dataset.window = gameLogState.window;
  holder.dataset.change = gameLogState.animationDirection;
  holder.innerHTML = "";
  holder.scrollLeft = 0;

  const filterBits = [];
  if (gameLogState.handFilter !== "all") filterBits.push(`vs ${gameLogState.handFilter}HP`);
  if (gameLogState.venueFilter !== "all") filterBits.push(gameLogState.venueFilter === "home" ? "at home" : "on the road");
  if (gameLogState.season !== "all") filterBits.push(gameLogState.season);
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
  document.getElementById("gamelog-summary-average").textContent = average.toFixed(2);

  // Keep the vertical scale anchored to the market, never to the current
  // sample. This stops the prop line from jumping when a bar is added/removed.
  const line = gameLogState.line;
  // Match the responsive CSS track height exactly; using a shorter mobile
  // math scale made low lines such as 0.5 float far above the baseline.
  const trackPx = window.innerWidth <= 430 ? 210 : window.innerWidth <= 900 ? 238 : 280;
  const scaleCaps = { "Hits": 6, "Home Runs": 4, "Total Bases": 12, "Hits+Runs+RBIs": 10, "Runs Scored": 6, "RBIs": 6, "Walks": 5, "Strikeouts": 12, "Pitching Outs": 27, "Hits Allowed": 10, "Earned Runs Allowed": 8, "Strikeouts (Pitcher)": 12, "Walks Allowed": 5 };
  const max = Math.max(scaleCaps[gameLogState.stat] || 10, typeof line === "number" ? Math.ceil(line * 1.6) : 1);
  const track = document.createElement("div");
  track.className = "gamelog-chart-track";
  track.style.setProperty("--game-count", String(games.length));
  track.style.setProperty("--bar-width", games.length > 20 ? "30px" : games.length > 10 ? "38px" : "52px");
  track.dataset.count = String(games.length);
  track.dataset.dense = games.length > 20 ? "true" : "false";
  track.dataset.logo = games.length <= 12 ? "true" : "false";
  games.forEach((g) => {
    const col = document.createElement("div");
    col.className = "gl-col";
    const heightPx = Math.max(4, (g.value / max) * trackPx);
    const details = g.pitcherDetails || null;
    const opponentId = g.opponentTeamId || MLB_TEAM_IDS[String(g.opponent || "").toUpperCase()];
    const tooltipRows = details ? [
      ["Innings pitched", details.inningsPitched], ["Batters faced", details.battersFaced],
      ["Pitch count", details.pitchCount], ["Walks", details.walks], ["Strikeouts", details.strikeouts],
    ].filter(([, value]) => value !== null && value !== undefined && value !== "").map(([label, value]) => `<div><span>${label}</span><strong>${escapeHtml(String(value))}</strong></div>`).join("") : "";
    const fullDate = g.fullDate || g.date || "";
    const aria = `${fullDate}, ${g.opponent || "opponent"}, ${gameLogStatCode(gameLogState.stat)} ${g.value}`;
    col.innerHTML = `
      <div class="gl-track" style="height:${trackPx}px">
        <div class="gl-bar-shell" tabindex="0" role="button" aria-label="${escapeHtml(aria)}">
          <div class="gl-bar${g.over ? "" : " gl-bar-under"}" style="height:${heightPx}px">
            <span class="gl-val">${g.value}</span>
          </div>
          ${details ? `<div class="gl-detail-card" role="tooltip"><header><strong>${escapeHtml(fullDate)}</strong><span>${escapeHtml(g.opponent || "")}</span></header><div class="gl-detail-result">${g.over ? "Cleared" : "Under"} by ${Math.abs(Number(g.value) - Number(gameLogState.line)).toFixed(1)}</div>${tooltipRows}</div>` : ""}
        </div>
      </div>
      ${games.length <= 20 ? `<span class="gl-opponent-logo">${opponentId ? `<img src="https://www.mlbstatic.com/team-logos/${encodeURIComponent(opponentId)}.svg" alt="" loading="lazy" onerror="this.parentElement.textContent='${escapeHtml(String(g.opponent || "").slice(0, 3))}'">` : escapeHtml(String(g.opponent || "").slice(0, 3))}</span>` : ""}
    `;
    const shell = col.querySelector(".gl-bar-shell");
    shell?.addEventListener("click", () => {
      if (!window.matchMedia("(hover: none), (pointer: coarse)").matches || !details) return;
      const willOpen = !shell.classList.contains("detail-open");
      holder.querySelectorAll(".gl-bar-shell.detail-open").forEach((item) => item.classList.remove("detail-open"));
      shell.classList.toggle("detail-open", willOpen);
    });
    track.appendChild(col);
  });

  if (typeof line === "number") {
    const topPx = Math.max(0, trackPx - (line / max) * trackPx);
    const marker = document.createElement("div");
    marker.className = "gl-line-marker";
    marker.style.top = "var(--chart-top, 34px)";
    marker.style.setProperty("--line-offset", `${topPx}px`);
    marker.innerHTML = `<span class="gl-line-tag">${Number(line).toFixed(1)}</span>`;
    marker.setAttribute("role", "slider");
    marker.setAttribute("aria-label", "Drag prop line");
    marker.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      marker.setPointerCapture(event.pointerId);
      const bounds = track.getBoundingClientRect();
      const update = (ev, settle) => {
        const chartTop = bounds.top;
        const relative = Math.max(0, Math.min(trackPx, chartTop + trackPx - ev.clientY));
        const raw = Math.max(0.5, (relative / trackPx) * max);
        if (settle) {
          setGameLogPreviewLine(raw, true);
        } else {
          const displayLine = snapPropLine(raw);
          marker.style.setProperty("--line-offset", `${Math.max(0, trackPx - (raw / max) * trackPx)}px`);
          marker.querySelector(".gl-line-tag").textContent = displayLine.toFixed(1);
        }
      };
      marker.onpointermove = (ev) => update(ev, false);
      marker.onpointerup = (ev) => {
        marker.onpointermove = null;
        marker.onpointerup = null;
        update(ev, true);
      };
      marker.onpointercancel = marker.onpointerup;
    });
    holder.appendChild(marker);
  }
  holder.appendChild(track);
  const axis = document.createElement("div");
  axis.className = "gl-y-axis";
  axis.setAttribute("aria-hidden", "true");
  axis.innerHTML = `<span>${Number(max).toFixed(max % 1 ? 1 : 0)}</span><span>${Number(max / 2).toFixed(max % 1 ? 1 : 0)}</span><span>0</span>`;
  holder.appendChild(axis);
  // Never move the viewport as a side effect of rendering. Only direct user
  // input should animate or change the chart position.
  gameLogState.animationDirection = "none";
}

function wireGameLogModal() {
  els.gamelogClose.addEventListener("click", closeGameLogModal);
  els.gamelogOverlay.addEventListener("click", (e) => {
    if (e.target === els.gamelogOverlay) closeGameLogModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.gamelogOverlay.hidden) closeGameLogModal();
  });
  const wireStableAction = (button, action) => {
    if (!button) return;
    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.dataset.pointerActivated = "true";
      button.blur();
      action();
    };
    button.addEventListener("pointerdown", activate, { passive: false });
    button.addEventListener("click", (event) => {
      if (button.dataset.pointerActivated === "true") {
        delete button.dataset.pointerActivated;
        return;
      }
      activate(event);
    });
  };
  wireStableAction(els.gamelogFilterToggle, () => setGameLogFiltersOpen(!gameLogState.filtersOpen));
  els.gamelogFilterClose?.addEventListener("click", () => setGameLogFiltersOpen(false));
  const wireCountButton = (button, delta, direction) => {
    if (!button) return;
    const activate = (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.dataset.pointerActivated = "true";
      button.blur();
      setGameLogCount(gameLogState.gameCount + delta, direction);
    };
    button.addEventListener("pointerdown", activate, { passive: false });
    // Keep Enter/Space keyboard activation accessible, while ignoring the
    // synthetic click browsers emit after a touch pointerdown.
    button.addEventListener("click", (event) => {
      if (button.dataset.pointerActivated === "true") {
        delete button.dataset.pointerActivated;
        return;
      }
      activate(event);
    });
  };
  wireCountButton(els.gamelogGamesDown, -1, "remove");
  wireCountButton(els.gamelogGamesUp, 1, "add");
  wireStableAction(els.gamelogH2HToggle, () => {
    gameLogState.window = gameLogState.window === "h2h" ? "recent" : "h2h";
    gameLogState.animationDirection = "initial";
    renderGameLogTabs(); renderGameLogChart();
  });
  els.gamelogSeasonRow?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-season]");
    if (!btn) return;
    gameLogState.season = btn.dataset.season;
    gameLogState.window = "recent";
    gameLogState.animationDirection = "initial";
    renderGameLogTabs(); renderGameLogChart();
  });
  els.gamelogPresetRow?.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-games]");
    if (!btn || btn.disabled) return;
    const next = btn.dataset.games === "max" ? gameLogPool().length : Number(btn.dataset.games);
    setGameLogCount(next, next >= gameLogState.gameCount ? "add" : "remove");
  });
  els.glHandFilter.querySelectorAll(".gl-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;
      gameLogState.handFilter = btn.dataset.hand;
      renderGameLogSubfilters();
      renderGameLogTabs();
      renderGameLogChart();
    });
  });
  els.glVenueFilter.querySelectorAll(".gl-filter-chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      gameLogState.venueFilter = btn.dataset.venue;
      renderGameLogSubfilters();
      renderGameLogTabs();
      renderGameLogChart();
    });
  });
  els.gamelogStatTabs?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-stat]");
    if (button && !button.disabled) loadGameLogStat(button.dataset.stat);
  });
  els.gamelogLineDown.addEventListener("click", () => setGameLogPreviewLine(gameLogState.line - 0.5, true));
  els.gamelogLineUp.addEventListener("click", () => setGameLogPreviewLine(gameLogState.line + 0.5, true));
}

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
  if (teamInsightsCache.get(key)?.summary) return;
  requestTeamInsights(params, "summary").then((summary) => {
    const cached = teamInsightsCache.get(key) || {};
    teamInsightsCache.set(key, { ...cached, summary, data: summary });
  }).catch(() => {});
}

// Fixed thresholds (not "vs this player's own baseline") -- green/red mean
// "statistically strong/weak performance," matching how the reference
// screenshots color raw values directly. Applied to every filter equally.
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
  teamState.deepReady = Boolean(cached.matchup);
  teamState.deepLoading = false;
  teamState.deepError = "";
  teamState.orderFilter = "season";
  renderTeamModal(); // shows loading state
  if (!cached.summary) fetchTeamInsights(params, "summary");
  else if (!cached.matchup) fetchTeamInsights(params, "matchup");
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
      cached.data = cached.matchup ? mergeTeamInsights(data, cached.matchup) : data;
    } else {
      cached.matchup = data;
      cached.data = cached.summary ? mergeTeamInsights(cached.summary, data) : data;
    }
    teamInsightsCache.set(key, cached);
    if (key !== teamState.cacheKey) return;
    teamState.data = cached.data;
    teamState.deepReady = Boolean(cached.matchup);
    teamState.deepLoading = false;
    teamState.deepError = "";
    renderTeamModal();
    if (detail === "summary" && !cached.matchup) fetchTeamInsights(params, "matchup");
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
    const msg = data.error ? `Couldn't load roster — ${data.error}` : "No roster data available for this team.";
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
      els.arsenalSummary.innerHTML = `<div><strong>${escapeHtml(selectedPitch.name || selectedPitch.code)}</strong><small>${escapeHtml(String(season))} pitcher usage · MLB Stats API</small></div><span>${usage}${speed}</span>`;
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
    els.armSlotEmpty.textContent = "Official Statcast arm-angle data is not available for this pitcher yet.";
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
  cmd.side = "Over";

  if (![...els.profileStats.options].some((o) => o.value === p.betType)) {
    const opt = document.createElement("option");
    opt.value = p.betType;
    opt.textContent = p.betType;
    els.profileStats.appendChild(opt);
  }
  els.profileStats.value = p.betType;
  els.profileStatsTriggerLabel.textContent = p.betType;
  els.profileStatsMenu.querySelectorAll(".profile-stats-menu-item").forEach((li) => {
    li.classList.toggle("active", li.textContent === p.betType);
  });

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
    b.classList.toggle("active", b.dataset.side === "Over");
  });

  els.linePicker.hidden = false;
  els.lineNoData.hidden = true;

  renderReport(p);
}

function buildReportNode(p) {
  const template = document.getElementById("report-template");
  const node = template.content.firstElementChild.cloneNode(true);

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
  block.querySelector(".research-health-note").textContent = meta.methodNote || "";

  const sources = block.querySelector(".research-health-sources");
  sources.innerHTML = (meta.sources || []).map((source) => `<span>${escapeHtml(source)}</span>`).join("");
  const limits = block.querySelector(".research-health-limits");
  const limitations = meta.limitations || [];
  limits.innerHTML = limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  limits.hidden = limitations.length === 0;
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
  node.querySelector(".decision-detail").textContent = meta.historicalRange ? `Observed range: ${meta.historicalRange[0]}–${meta.historicalRange[1]}% across ${meta.sampleGames} games.` : "Use the full evidence card before deciding.";
  const marketValue = p.marketProb ?? p.trueProb;
  node.querySelector(".decision-market-value").textContent = marketValue != null ? `${Math.round(marketValue * 100)}% fair probability` : "Price not attached";
  node.querySelector(".decision-market-note").textContent = marketValue != null ? "No-vig market context" : "Research-only card — not a priced recommendation.";
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
  const colors = ["#2f7bff", "#ffad18", "#9b4dff", "#ff2768", "#35d980", "#ff681f", "#49cfee"];
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
  const hasBvp = Number(bvp.ab) > 0;
  const bvpTitle = hasBvp
    ? `CAREER VS ${escapeHtml(String(starter.name || "STARTER").split(" ").slice(-1)[0].toUpperCase())}`
    : `SEASON VS ${escapeHtml(splitFallback.hand || starter.hand || "?")}HP`;
  const bvpSummary = hasBvp
    ? `${bvp.hits || 0}-for-${bvp.ab} · ${bvp.pa || bvp.ab} KD`
    : `${val(splitFallback.pa, "0")} KD · handedness split`;
  const lowerStats = hasBvp
    ? [
        ["AVG", avg(bvp.avg)], ["HR", val(bvp.hr, "0")], ["RBI", val(bvp.rbi, "0")],
        ["BB", val(bvp.bb, "0")], ["K", val(bvp.k, "0")], ["OPS", avg(bvp.ops)],
      ]
    : [
        ["AVG", avg(splitFallback.avg)], ["OPS", avg(splitFallback.ops)], ["HR", val(splitFallback.hr, "0")],
        ["RBI", val(splitFallback.rbi, "0")], ["K%", rate(splitFallback.kPct)], ["KD", val(splitFallback.pa, "0")],
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
        <td data-label="KD" class="${sampleClass}" title="${team.thin_sample ? "Limited sample — use cautiously" : ""}">${val(team.pa)}</td>
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
        ${recommendation}
        <div class="pitch-rank-scale"><span>1 HANDLES</span><i></i><span>30 STRUGGLES</span></div>
        <div class="pitch-type-scroll"><table><thead><tr><th>PITCH</th><th>KD</th><th>WHIFF%</th><th>wOBA</th><th>HARD-HIT%</th><th>LINEUP RANK</th></tr></thead><tbody>${pitchRows}</tbody></table></div>
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
      <div class="pitch-breakdown-title"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13h4l2-8 4 14 3-10 2 4h5"/></svg><strong>PITCH ARSENAL BREAKDOWN</strong></div>
      <div class="pitch-type-head"><div><p class="arsenal-eyebrow">${escapeHtml(String(p.player || "BATTER").split(" ").slice(-1)[0].toUpperCase())} VS PITCH TYPE</p></div></div>
      <div class="pitch-type-scroll"><table><thead><tr><th>PITCH TYPE</th><th>THROWN</th><th>USAGE</th><th>WHIFF%</th><th>AVG</th><th>SLG</th><th>wOBA</th><th>K%</th></tr></thead><tbody>${pitchRows}</tbody></table></div>
    </article>`;
}

function fillSplitFactor(node, p) {
  const split = p.split || {};
  node.querySelector(".road-avg").textContent = split.roadAvg != null ? `${split.roadAvg}` : "—";
  node.querySelector(".road-note").textContent = split.roadOverRate != null ? `📈 ${split.roadOverRate}% over rate` : "";
  node.querySelector(".home-avg").textContent = split.homeAvg != null ? `${split.homeAvg}` : "—";
  node.querySelector(".home-note").textContent = split.homeOverRate != null ? `📈 ${split.homeOverRate}% over rate` : "";
  node.querySelector(".split-callout").textContent = split.callout ? `🔍 ${split.callout}` : "";
  node.querySelector(".volume-note").textContent = split.volume ? `📊 ${split.volume}` : "";
}

function fillMatchup(node, p) {
  const m = p.matchup || {};
  const scoreCard = node.querySelector(".matchup-score-card");
  const score = Number(p.matchupScore);
  if (scoreCard && Number.isFinite(score)) {
    const fallbackLabel = score >= 85 ? "Elite Matchup" : score >= 75 ? "Strong Matchup" : score >= 65 ? "Favorable" : score >= 55 ? "Slight Edge" : score >= 45 ? "Neutral" : score >= 35 ? "Caution" : "Unfavorable";
    const label = p.matchupLabel || fallbackLabel;
    const tone = score >= 85 ? "elite" : score >= 75 ? "strong" : score >= 65 ? "favorable" : score >= 55 ? "slight" : score >= 45 ? "neutral" : score >= 35 ? "caution" : "unfavorable";
    scoreCard.hidden = false;
    scoreCard.dataset.tone = tone;
    scoreCard.querySelector(".matchup-score-value").textContent = `${Math.round(score)}/100`;
    scoreCard.querySelector(".matchup-score-label").textContent = `${label} · ${Math.round((p.matchupCoverage || 0) * 100)}% data coverage`;
    scoreCard.querySelector(".matchup-score-fill").style.width = `${Math.max(0, Math.min(100, score))}%`;
    const factors = (p.matchupFactors || []).map(f => {
      const impact = Number(f.impact || 0);
      const signed = `${impact > 0 ? "+" : ""}${impact}`;
      return `<div class="matchup-factor"><div><b>${escapeHtml(f.name || "Factor")}</b><small>${escapeHtml(f.detail || "Unavailable")}</small></div><strong>${signed} / ${Number(f.weight || 0)}</strong></div>`;
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
    const warmInsights = () => requestTeamInsights(p.teamInsightsParams);
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
    paWrap.querySelector(".pa-dist-label").textContent = `Real Krazy Data counts, last ${pa.games_sampled} games — avg ${pa.avg_pa} KD/game.`;
    const barsEl = paWrap.querySelector(".pa-dist-bars");
    barsEl.innerHTML = "";
    pa.buckets.forEach((b) => {
      const row = document.createElement("div");
      row.className = "pa-bar-row";
      row.innerHTML = `
        <span class="pa-bar-label">${escapeHtml(b.pa)} KD</span>
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
  block.querySelector(".lineup-profile-note").textContent = ``;
}

/* ---------- Manual PrizePicks prop builder ---------- */

function setManualBetSlipOpen(open) {
  if (open) renderManualBetSlip();
  window.dispatchEvent(new CustomEvent("vortex:prop-builder-open", { detail: { open } }));
  els.betSlipDrawer?.setAttribute("aria-hidden", "true");
  els.headerBuilderTrigger?.setAttribute("aria-expanded", String(open));
}

function manualSlipLegPayload(prop) {
  return {
    player: prop.player,
    stat: prop.betType,
    line: prop.line,
    side: String(prop.side || "over").toLowerCase() === "under" ? "under" : "over",
  };
}

function manualBetSlipStatus(count) {
  if (count < 2) return "Add 1 more prop to export.";
  if (count > 6) return "Remove legs until 6 remain.";
  return `${count}-leg slip ready to verify.`;
}

function syncManualBetSlipUi({ busy = false, status = "" } = {}) {
  const legs = getSavedProps();
  const count = legs.length;
  const detail = {
    legs: legs.map((prop) => ({
      id: String(prop.id),
      player: String(prop.player || "Player"),
      side: String(prop.side || "Over"),
      line: String(prop.line ?? "—"),
      stat: String(prop.betType || "Prop"),
      team: String(prop.team || prop.sport || "MLB"),
      score: String(prop.score ?? "—"),
      headshot: prop.headshot ? String(prop.headshot).replace("/headshot/67/current", "/headshot/silo/current") : "",
    })),
    status: status || els.betSlipStatus?.textContent || manualBetSlipStatus(count),
    canExport: count >= 2 && count <= 6,
    busy,
  };
  window.dispatchEvent(new CustomEvent("vortex:prop-builder-sync", { detail }));
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
  els.betSlipExport.disabled = count < 2 || count > 6;
  els.betSlipStatus.textContent = manualBetSlipStatus(count);
  els.betSlipLegs.innerHTML = legs.map((prop, index) => `
    <article class="bet-slip-leg" style="--slip-delay:${index * 45}ms">
      <span class="bet-slip-rank">${index + 1}</span>
      <div class="bet-slip-avatar">${avatarHtml(prop, "sm")}</div>
      <div class="bet-slip-copy"><strong>${escapeHtml(prop.player)}</strong><span>${escapeHtml(prop.side)} ${escapeHtml(String(prop.line))} ${escapeHtml(prop.betType)}</span><small>${escapeHtml(prop.team || prop.sport || "MLB")} · Score ${escapeHtml(String(prop.score ?? "—"))}</small></div>
      <button type="button" class="bet-slip-remove" data-slip-remove="${escapeHtml(String(prop.id))}" aria-label="Remove ${escapeHtml(prop.player)}">×</button>
    </article>`).join("");
  els.betSlipLegs.querySelectorAll("[data-slip-remove]").forEach((button) => button.addEventListener("click", () => {
    removeManualBetSlipLeg(button.dataset.slipRemove);
  }));
  syncManualBetSlipUi();
}

async function exportManualBetSlip() {
  const legs = getSavedProps();
  if (legs.length < 2 || legs.length > 6) return;
  const originalLabel = els.betSlipExport.textContent;
  els.betSlipExport.disabled = true;
  els.betSlipExport.textContent = "Matching live lines…";
  els.betSlipStatus.textContent = "Checking every leg on the live PrizePicks board…";
  syncManualBetSlipUi({ busy: true, status: els.betSlipStatus.textContent });
  try {
    const response = await fetch(API_PRIZEPICKS_EXPORT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ legs: legs.map(manualSlipLegPayload) }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.url) {
      const detail = payload.unmatched?.map((leg) => `${leg.player} ${leg.line} ${leg.stat}`).join("; ");
      throw new Error(detail ? `${payload.error} ${detail}` : (payload.error || "PrizePicks export failed."));
    }
    els.betSlipStatus.textContent = `${payload.matches.length} live legs matched. Opening PrizePicks…`;
    syncManualBetSlipUi({ busy: true, status: els.betSlipStatus.textContent });
    window.location.assign(payload.url);
  } catch (error) {
    els.betSlipStatus.textContent = error.message || "PrizePicks export is temporarily unavailable.";
    els.betSlipExport.disabled = false;
    els.betSlipExport.textContent = originalLabel;
    syncManualBetSlipUi({ busy: false, status: els.betSlipStatus.textContent });
  }
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
    node.querySelector(".saved-score").textContent = `${p.tierIcon || ""} ${p.score ?? "—"}`;
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
      switchTab("research", document.querySelector('.tab-btn[data-tab="research"]'));
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
    bvp: "BvP Matchups — career batter-versus-pitcher history, only where the sample is meaningful.",
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
      els.slateError.textContent = "Live data is temporarily unavailable.";
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
    els.slateError.textContent = "Live data is temporarily unavailable.";
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
          <span><small>Starter ERA</small><b>${e.era.toFixed(2)}</b></span>
          <span><small>HR allowed / 9</small><b>${e.hr9.toFixed(2)}</b></span>
          <span><small>Strikeouts / 9</small><b>${e.k9.toFixed(2)}</b></span>
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

function wireV2Board() {
  els.v2RefreshBtn.addEventListener("click", () => loadV2Board(true));
  els.boardFilterRow.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-board-filter]");
    if (!btn) return;
    state.boardFilter = btn.dataset.boardFilter;
    state.matchupDisplayLimit = 40;
    els.boardFilterRow.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    if (state.v2BoardData) renderBotBoard(state.v2BoardData);
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
    switchTab("v2", document.querySelector('.tab-btn[data-tab="v2"]'));
    els.v2BackBtn.hidden = true;
    state.v2DeepDiveReturn = null;
    if (typeof returnScroll === "number") window.scrollTo(0, returnScroll);
  });
}

async function loadV2Board(force = false) {
  if (state.v2BoardLoaded && !force) return;

  els.v2BoardEmpty.hidden = true;
  els.v2BoardError.hidden = true;
  els.v2BoardList.innerHTML = "";
  els.v2RefreshBtn.classList.add("is-loading");
  els.v2RefreshBtn.disabled = true;

  try {
    const res = await fetch("/api/board", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data.error) {
      els.v2BoardError.innerHTML = `<span class="status-mark status-mark-error" aria-hidden="true"></span><span class="state-copy"><strong>Props are temporarily unavailable</strong><small>Refresh in a moment to try again.</small></span>`;
      els.v2BoardError.hidden = false;
      return;
    }

    state.v2BoardLoaded = true;
    state.v2BoardData = data;
    renderBotBoard(data);
  } catch (err) {
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
  const n = Number(score);
  if (!Number.isFinite(n)) return "";
  if (n >= 85) return "ELITE MATCHUP";
  if (n >= 75) return "STRONG MATCHUP";
  if (n >= 65) return "FAVORABLE";
  if (n >= 55) return "SLIGHT EDGE";
  if (n >= 45) return "NEUTRAL";
  if (n >= 35) return "CAUTION";
  return "UNFAVORABLE";
}

let matchupRefreshRun = 0;

async function refreshVisibleMatchupScores(props) {
  const run = ++matchupRefreshRun;
  const refreshable = props.filter((p) => p.sport === "MLB" && BOT_STAT_TO_RESEARCH_STAT[p.stat_type]);
  if (!refreshable.length) return;

  // The board payload is a scan-time snapshot. Research uses the live model,
  // so refresh Matchups with that same endpoint instead of displaying a score
  // that can disagree as soon as Deep Dive is opened.
  refreshable.forEach((p) => {
    p.stats = p.stats || {};
    p.stats._live_matchup_ready = false;
  });
  const queue = [...refreshable];
  let completed = 0;
  // These are independent serverless reads. A wider pool keeps the Matchup
  // view responsive without making users wait for sequential player cards.
  const workers = Array.from({ length: Math.min(12, queue.length) }, async () => {
    while (queue.length && run === matchupRefreshRun && state.boardFilter === "matchup") {
      const p = queue.shift();
      const stat = BOT_STAT_TO_RESEARCH_STAT[p.stat_type];
      const side = p.stats?.side === "under" ? "under" : "over";
      try {
        const url = `${API_SOURCE}?player=${encodeURIComponent(p.player_name)}&stat=${encodeURIComponent(stat)}&line=${p.line}&side=${side}`;
        const res = await fetch(url, { cache: "no-store" });
        const live = await res.json();
        if (!res.ok || live.error || !Number.isFinite(Number(live.matchupScore))) continue;
        Object.assign(p.stats, {
          matchup_score: Number(live.matchupScore),
          matchup_label: live.matchupLabel,
          matchup_coverage: live.matchupCoverage,
          matchup_factors: live.matchupFactors || [],
          _live_matchup_ready: true,
        });
      } catch (_) {
        // Keep the scan-time score when a live lookup is temporarily unavailable.
      } finally {
        completed += 1;
        // Do not hold the whole board behind the slowest request. Publish a
        // progressively improving ranking while the remaining candidates run.
        if (completed % 12 === 0 && run === matchupRefreshRun
            && state.boardFilter === "matchup" && state.v2BoardData) {
          renderBotBoard(state.v2BoardData, { scoresAreLive: true });
        }
      }
    }
  });
  await Promise.all(workers);
  if (run === matchupRefreshRun && state.boardFilter === "matchup" && state.v2BoardData) {
    renderBotBoard(state.v2BoardData, { scoresAreLive: true });
  }
}

function renderBotBoard(data, { scoresAreLive = false } = {}) {
  const recommendedProps = data.props || [];
  const matchupResearch = data.matchup_research || [];
  const researchPitchers = data.pitcher_research || [];
  const sourceProps = state.boardFilter === "matchup"
    ? [...(matchupResearch.length ? matchupResearch : recommendedProps), ...researchPitchers]
    : state.boardFilter === "strikeouts"
      ? [...recommendedProps, ...researchPitchers]
      : recommendedProps;
  // player_id is optional presentation metadata used for headshots. A scored
  // board row remains valid without it and must still mirror Discord.
  const allProps = sourceProps.map((p, sourceIndex) => ({ ...p, _boardIndex: sourceIndex }));
  let props = allProps.filter((p) => {
    const filter = state.boardFilter;
    if (filter === "all") return true;
    if (filter === "matchup") return Number.isFinite(Number(p.stats?.matchup_score));
    return boardStatCategory(p.stat_type) === filter;
  });
  // Sort each view by the score named by that view: Matchup uses the
  // authoritative 0-100 matchup grade; every prop-market tab uses VORTEX.
  props = props.sort((a, b) => {
    const currentMatchup = (p) => p.stats?._live_matchup_ready === true
      ? (Number(p.stats?.matchup_score) || 0)
      : -1;
    const matchupDiff = currentMatchup(b) - currentMatchup(a);
    const vortexDiff = (Number(b.vortex_score) || 0) - (Number(a.vortex_score) || 0);
    if (state.boardFilter === "matchup") {
      if (matchupDiff) return matchupDiff;
      if (vortexDiff) return vortexDiff;
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
  if (state.boardFilter === "matchup" && scoresAreLive) {
    props = props.slice(0, state.matchupDisplayLimit);
  }
  props = props.map((p, index) => ({ ...p, _boardIndex: index }));
  state.v2RenderedProps = props;
  const boardUpdatedAt = data.generated_at
    ? new Date(data.generated_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "recently";
  els.v2BoardDate.textContent = props.length
    ? `${state.boardFilter === "matchup" && scoresAreLive && totalMatchups > props.length ? `${props.length} of ${totalMatchups}` : props.length} ${state.boardFilter === "matchup" ? `matchup${totalMatchups === 1 ? "" : "s"}` : `prop${props.length === 1 ? "" : "s"}`} · updated ${boardUpdatedAt}`
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

  if (state.boardFilter === "matchup" && !scoresAreLive) {
    els.v2BoardDate.textContent += " · calculating current matchup scores…";
    refreshVisibleMatchupScores(props);
  }

  props.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "slate-row v2-row v2-card";
    row.style.animationDelay = `${i * 35}ms`;
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-expanded", "false");

    const stats = p.stats || {};
    const matchupScore = Number(stats.matchup_score);
    const matchupIsCurrent = state.boardFilter !== "matchup" || stats._live_matchup_ready === true;
    const matchupBadge = matchupIsCurrent && Number.isFinite(matchupScore)
      ? `<span class="v2-card-matchup-score" data-band="${matchupScore >= 75 ? "strong" : matchupScore >= 65 ? "favorable" : matchupScore >= 55 ? "slight" : matchupScore >= 45 ? "neutral" : matchupScore >= 35 ? "caution" : "unfavorable"}">MATCHUP ${Math.round(matchupScore)} · ${boardMatchupLabel(matchupScore)}</span>`
      : `<span class="v2-card-matchup-score" data-band="neutral">MATCHUP UNAVAILABLE · TRY REFRESH</span>`;
    const sidePfx = stats.side === "under" ? "U" : "O";
    const tier = BOT_TIER[p.tier] || botScoreBadge(p.vortex_score);
    const sportTag = `${SPORT_EMOJI[p.sport] || "🎯"} ${p.sport || ""}`;

    const playerId = stats.player_id || "";
    let headshotUrl = "";
    if (playerId) {
      if (p.sport === "NBA") {
        headshotUrl = `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`;
      } else {
        headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${playerId}/headshot/silo/current`;
      }
    }
    const sportEmoji = p.sport === "NBA" ? "🏀" : "⚾";
    const headshotHtml = headshotUrl
      ? `<img class="v2-card-headshot" src="${headshotUrl}" alt="" loading="lazy" onerror="this.src='https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${playerId}/headshot/67/current'; this.onerror=null;" />`
      : `<div class="v2-card-headshot v2-card-headshot-fallback">${sportEmoji}</div>`;

    const opponent = stats.opponent || stats.matchup?.opponent || "";
    const gameTime = p.commence_time ? new Date(p.commence_time) : null;
    const timeStr = gameTime ? gameTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    const isHome = stats.is_home;
    const matchupLine = opponent ? (isHome ? `vs ${opponent}` : `@ ${opponent}`) : "";

    const evText = fmtBotEv(p);

    row.innerHTML = `
      ${headshotHtml}
      <span class="v2-card-body">
        <span class="v2-card-top">
          <span class="v2-card-name">${escapeHtml(p.player_name)}</span>
          <span class="v2-card-score">${escapeHtml(tier.badge)}</span>
        </span>
        <span class="v2-card-bottom">
          <span class="v2-card-matchup">${matchupLine}${timeStr ? ` · ${timeStr}` : ""}</span>
          <span class="v2-card-prop">${sidePfx} ${p.line} ${escapeHtml(p.stat_type)}</span>
          <span class="v2-card-ev">${escapeHtml(evText)}</span>
          <span class="v2-card-confidence">KP SCORE ${escapeHtml(String(p.vortex_score ?? "—"))} · ${escapeHtml(stats.splits?.l10?.rate != null ? `${stats.side === "under" ? 100 - stats.splits.l10.rate : stats.splits.l10.rate}% L10` : "sample pending")}</span>
          ${matchupBadge}
        </span>
      </span>
      <span class="v2-chevron" aria-hidden="true">▾</span>
    `;
    const toggle = () => {
      const open = row.classList.toggle("v2-open");
      row.setAttribute("aria-expanded", String(open));
      let detail = row.nextElementSibling;
      if (open) {
        if (!detail || !detail.classList.contains("v2-detail")) {
          detail = document.createElement("div");
          detail.className = "v2-detail";
          detail.innerHTML = buildBotDetailHtml(p, p._boardIndex);
          row.after(detail);
        }
        detail.hidden = false;
      } else if (detail && detail.classList.contains("v2-detail")) {
        detail.hidden = true;
      }
    };
    row.addEventListener("click", toggle);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });
    els.v2BoardList.appendChild(row);
  });
  if (state.boardFilter === "matchup" && scoresAreLive && props.length < totalMatchups) {
    const more = document.createElement("button");
    more.type = "button";
    more.className = "v2-matchup-more";
    more.textContent = `Show 40 more (${totalMatchups - props.length} remaining)`;
    more.addEventListener("click", () => {
      state.matchupDisplayLimit += 40;
      renderBotBoard(state.v2BoardData, { scoresAreLive: true });
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
  return "other";
}

/* ---------- Automatic Parlay Builder ---------- */

const BUILDER_MODES = {
  safe: { label: "Safest", minMatchup: 65, minL10: 65, minL20: 55, minCoverage: .55, maxPerGame: 1 },
  balanced: { label: "Balanced", minMatchup: 55, minL10: 60, minL20: 50, minCoverage: .45, maxPerGame: 1 },
  payout: { label: "Higher payout", minMatchup: 50, minL10: 55, minL20: 48, minCoverage: .40, maxPerGame: 1 },
};

function builderKey(p) {
  return [p.player_name, p.stat_type, p.line, p.stats?.side || "over"].join("|");
}

function builderEffectiveRate(stats, windowName) {
  const directValue = stats[`eff_${windowName}`];
  const direct = directValue == null || directValue === "" ? NaN : Number(directValue);
  if (Number.isFinite(direct)) return direct;
  const rawValue = stats.splits?.[windowName]?.rate;
  const raw = rawValue == null || rawValue === "" ? NaN : Number(rawValue);
  if (!Number.isFinite(raw)) return null;
  return stats.side === "under" ? 100 - raw : raw;
}

function parlayCandidate(p, modeName) {
  const mode = BUILDER_MODES[modeName];
  const stats = p.stats || {};
  const matchup = Number(stats.matchup_score);
  const coverage = Number(stats.matchup_coverage);
  const l10 = builderEffectiveRate(stats, "l10");
  const l20 = builderEffectiveRate(stats, "l20");
  const edge = Number(stats.proj_edge);
  const stability = String(stats.stability_tier || "").toUpperCase();
  const conflicts = stats.matchup_conflicts || [];
  const pitcherMarket = /strikeout|outs|hits allowed|earned runs/i.test(p.stat_type || "");
  const pitcherName = String(stats.pitcher?.name || "").trim();
  const opponent = String(stats.opponent || stats.matchup?.opponent || "").trim();
  const bvp = stats.bvp || {};
  const bvpAb = Number(bvp.ab || 0);
  const bvpHits = Number(bvp.hits || 0);
  const rawBvpAvg = String(bvp.avg ?? "").trim();
  const bvpAvg = rawBvpAvg ? Number(rawBvpAvg.startsWith(".") ? `0${rawBvpAvg}` : rawBvpAvg) : (bvpAb ? bvpHits / bvpAb : NaN);
  const isUnder = stats.side === "under";
  const bvpConflict = !pitcherMarket && bvpAb >= 8 && Number.isFinite(bvpAvg)
    && ((!isUnder && bvpAvg <= .150) || (isUnder && bvpAvg >= .350));
  const confirmed = pitcherMarket
    ? Boolean(stats.player_id && (stats.pitcher?.validated_role || stats.pitcher?.games_started || stats.pitcher?.era))
    : Number.isFinite(Number(stats.lineup_spot ?? stats.lineup_pos));
  const reasons = [];
  if (!["ELITE", "STRONG"].includes(String(p.tier || "").toUpperCase())) reasons.push("tier below Strong");
  if (!Number.isFinite(matchup) || matchup < mode.minMatchup) reasons.push(`matchup below ${mode.minMatchup}`);
  if (!opponent) reasons.push("opponent not resolved");
  if (!pitcherMarket && (!pitcherName || pitcherName.toUpperCase() === "TBD")) reasons.push("starting pitcher not resolved");
  if (!Number.isFinite(coverage) || coverage < mode.minCoverage) reasons.push("thin matchup coverage");
  if (!Number.isFinite(l10) || l10 < mode.minL10) reasons.push(`L10 below ${mode.minL10}%`);
  if (Number.isFinite(l20) && l20 < mode.minL20) reasons.push("L20 does not support the side");
  if (modeName !== "payout" && (!Number.isFinite(edge) || edge <= 0)) reasons.push("no positive projection edge");
  if (modeName === "safe" && ["LOW", "VOLATILE"].includes(stability)) reasons.push("unstable recent values");
  if (!confirmed) reasons.push(pitcherMarket ? "starter role not confirmed" : "lineup spot not confirmed");
  if (conflicts.length) reasons.push("matchup contradiction");
  if (bvpConflict) reasons.push(`${bvpHits}-for-${bvpAb} BvP conflicts with the ${isUnder ? "Under" : "Over"}`);
  if (Number(stats.matchup_adjustment) < 0) reasons.push("matchup grades against the pick");
  if (stats.decision_quality && stats.decision_quality.eligible === false) reasons.push("decision-quality gate failed");
  if (modeName === "safe" && !pitcherMarket && stats.lineup_confirmed !== true) reasons.push("lineup not confirmed");
  if (reasons.length) return { valid: false, reasons };

  const stabilityScore = stability === "HIGH" ? 92 : stability === "MEDIUM" ? 76 : stability === "LOW" ? 52 : 65;
  const projectionScore = Number.isFinite(edge) ? Math.max(35, Math.min(100, 55 + edge * 22)) : 45;
  const longRate = Number.isFinite(l20) ? l20 : l10;
  const bvpBonus = bvpAb >= 8 && Number.isFinite(bvpAvg)
    ? Math.max(-6, Math.min(6, (isUnder ? .250 - bvpAvg : bvpAvg - .250) * 30)) : 0;
  const quality = .30 * l10 + .20 * matchup + .15 * coverage * 100 + .15 * projectionScore + .10 * stabilityScore + .10 * longRate + bvpBonus;
  const reliability = Math.max(.45, Math.min(.95, coverage * (stabilityScore / 100) * (Number.isFinite(l20) ? 1 : .86)));
  const adjustedProb = Math.max(.50, Math.min(.86, (50 + (l10 - 50) * reliability) / 100));
  return {
    valid: true, prop: p, key: builderKey(p), quality: Math.round(quality), adjustedProb,
    matchup, coverage, l10, l20, edge, stability: stability || "UNKNOWN", pitcherMarket,
    gameKey: String(stats.game_pk || `${stats.opponent || "unknown"}|${p.commence_time || "time-pending"}`),
    teamKey: stats.is_home ? "home" : "away",
    pitcherName, opponent,
    bvpSummary: bvpAb >= 4 ? `${bvpHits}-for-${bvpAb} vs ${pitcherName}` : "No meaningful BvP sample",
  };
}

function rankedParlayCandidates(modeName) {
  const rows = (state.v2BoardData?.props || []).map((p) => parlayCandidate(p, modeName)).filter((c) => c.valid);
  return rows.sort((a, b) => {
    if (modeName === "payout") return (Number(b.prop.vortex_score) - Number(a.prop.vortex_score)) || b.quality - a.quality;
    return b.quality - a.quality || b.matchup - a.matchup;
  });
}

function builderCompatible(candidate, selected, allowSameGame, modeName) {
  if (selected.some((leg) => leg.key === candidate.key || leg.prop.player_name === candidate.prop.player_name)) return false;
  const sameGame = selected.filter((leg) => leg.gameKey === candidate.gameKey);
  const maxPerGame = allowSameGame ? (modeName === "safe" ? 2 : 3) : BUILDER_MODES[modeName].maxPerGame;
  if (sameGame.length >= maxPerGame) return false;
  if (sameGame.some((leg) => leg.pitcherMarket !== candidate.pitcherMarket)) return false;
  return true;
}

function selectParlayLegs(excludeKey = "") {
  const candidates = rankedParlayCandidates(state.builderMode);
  const locked = state.builderResult.filter((leg) => state.builderLocked.has(leg.key) && leg.key !== excludeKey);
  const pool = candidates.filter((candidate) => candidate.key !== excludeKey && !locked.some((leg) => leg.key === candidate.key)).slice(0, 24);
  let best = locked.length <= state.builderLegs ? [...locked] : [];
  let bestScore = -Infinity;
  const scoreBuild = (legs) => legs.reduce((sum, leg) => sum + leg.quality + Math.log(leg.adjustedProb) * 8, 0);
  const search = (start, selected) => {
    if (selected.length === state.builderLegs) {
      const score = scoreBuild(selected);
      if (score > bestScore) { bestScore = score; best = [...selected]; }
      return;
    }
    if (selected.length + (pool.length - start) < state.builderLegs) return;
    for (let i = start; i < pool.length; i += 1) {
      const candidate = pool[i];
      if (!builderCompatible(candidate, selected, els.builderSameGame.checked, state.builderMode)) continue;
      selected.push(candidate);
      search(i + 1, selected);
      selected.pop();
    }
  };
  search(0, [...locked]);
  return { selected: best, qualified: candidates.length };
}

function builderCombinedProbability(legs) {
  let probability = legs.reduce((total, leg) => total * leg.adjustedProb, 1);
  const gameCounts = {};
  legs.forEach((leg) => { gameCounts[leg.gameKey] = (gameCounts[leg.gameKey] || 0) + 1; });
  const correlatedExtras = Object.values(gameCounts).reduce((n, count) => n + Math.max(0, count - 1), 0);
  probability *= Math.pow(.92, correlatedExtras) * Math.pow(.98, Math.max(0, legs.length - 2));
  return { probability: probability * 100, correlatedExtras };
}

function renderBuilderResult(qualified = 0) {
  const legs = state.builderResult;
  if (legs.length < state.builderLegs) {
    els.builderResult.hidden = false;
    els.builderResult.innerHTML = `<div class="builder-no-play"><span>NO QUALIFIED BUILD</span><h3>${legs.length} of ${state.builderLegs} legs cleared every gate</h3><p>${qualified} candidate${qualified === 1 ? "" : "s"} qualified individually, but correlation and duplicate-player rules prevented a valid ${state.builderLegs}-leg parlay. Lower the leg count, switch mode, or allow limited same-game legs.</p></div>`;
    els.builderStatus.textContent = "No strong combination is available yet.";
    return;
  }
  const combined = builderCombinedProbability(legs);
  const avgQuality = legs.reduce((sum, leg) => sum + leg.quality, 0) / legs.length;
  const avgCoverage = legs.reduce((sum, leg) => sum + leg.coverage, 0) / legs.length * 100;
  const risk = combined.correlatedExtras ? "Managed" : "Low";
  els.builderResult.hidden = false;
  els.builderResult.innerHTML = `
    <div class="builder-summary">
      <div><span>ESTIMATED PARLAY PROBABILITY</span><strong id="builder-probability">0.0%</strong><small>Reliability-shrunk · not a guaranteed hit rate</small></div>
      <div class="builder-summary-grid"><p><span>AVG LEG QUALITY</span><b>${avgQuality.toFixed(0)}/100</b></p><p><span>DATA COVERAGE</span><b>${avgCoverage.toFixed(0)}%</b></p><p><span>CORRELATION</span><b>${risk}</b></p><p><span>BUILD</span><b>${BUILDER_MODES[state.builderMode].label}</b></p></div>
    </div>
    <div class="builder-legs">${legs.map((leg, index) => builderLegHtml(leg, index)).join("")}</div>
    <div class="builder-footer"><p>Every leg is model-aligned and lineup/starter qualified. PrizePicks will open for final review—this site never submits an entry.</p><div class="builder-footer-actions"><button type="button" id="builder-rebuild">Rebuild unlocked legs</button><button type="button" class="builder-prizepicks" id="builder-prizepicks-export">Open in PrizePicks</button></div></div>`;
  els.builderStatus.textContent = `${legs.length}-leg ${BUILDER_MODES[state.builderMode].label.toLowerCase()} build created from ${qualified} qualified props.`;
  requestAnimationFrame(() => countUpEl("builder-probability", combined.probability, { decimals: 1, suffix: "%", duration: 850 }));
  els.builderResult.querySelectorAll("[data-builder-lock]").forEach((button) => button.addEventListener("click", () => {
    const key = button.dataset.builderLock;
    if (state.builderLocked.has(key)) state.builderLocked.delete(key); else state.builderLocked.add(key);
    renderBuilderResult(qualified);
  }));
  els.builderResult.querySelectorAll("[data-builder-replace]").forEach((button) => button.addEventListener("click", () => {
    const replacedKey = button.dataset.builderReplace;
    const previousLocks = new Set(state.builderLocked);
    state.builderResult.forEach((leg) => {
      if (leg.key !== replacedKey) state.builderLocked.add(leg.key);
    });
    const result = selectParlayLegs(replacedKey);
    state.builderResult = result.selected;
    state.builderLocked = new Set([...previousLocks].filter((key) => state.builderResult.some((leg) => leg.key === key)));
    renderBuilderResult(result.qualified);
  }));
  document.getElementById("builder-rebuild")?.addEventListener("click", () => runParlayBuilder());
  document.getElementById("builder-prizepicks-export")?.addEventListener("click", exportBuilderToPrizePicks);
}

async function exportBuilderToPrizePicks(event) {
  const button = event.currentTarget;
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Matching live lines…";
  els.builderStatus.textContent = "Verifying every leg against the live PrizePicks board…";
  try {
    const response = await fetch(API_PRIZEPICKS_EXPORT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        legs: state.builderResult.map((leg) => ({
          player: leg.prop.player_name,
          stat: BOT_STAT_TO_RESEARCH_STAT[leg.prop.stat_type] || leg.prop.stat_type,
          line: leg.prop.line,
          side: leg.prop.stats?.side === "under" ? "under" : "over",
        })),
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.url) {
      const detail = payload.unmatched?.map((leg) => `${leg.player} ${leg.line} ${leg.stat}`).join("; ");
      throw new Error(detail ? `${payload.error} ${detail}` : (payload.error || "PrizePicks export failed."));
    }
    els.builderStatus.textContent = `${payload.matches.length} live PrizePicks legs matched. Opening your lineup for review…`;
    window.location.assign(payload.url);
  } catch (error) {
    els.builderStatus.textContent = error.message || "PrizePicks export is temporarily unavailable.";
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function builderLegHtml(leg, index) {
  const p = leg.prop, stats = p.stats || {}, locked = state.builderLocked.has(leg.key);
  const side = stats.side === "under" ? "Under" : "Over";
  const photo = `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${stats.player_id}/headshot/silo/current`;
  return `<article class="builder-leg" style="--leg-delay:${index * 80}ms"><div class="builder-leg-rank">${index + 1}</div><img src="${photo}" alt="" loading="lazy" /><div class="builder-leg-main"><div><h3>${escapeHtml(p.player_name)}</h3><span class="builder-anchor">${leg.quality >= 80 ? "ANCHOR" : leg.quality >= 70 ? "CORE" : "SUPPORTING"}</span></div><strong>${side} ${escapeHtml(String(p.line))} ${escapeHtml(p.stat_type)}</strong><p><span>Matchup ${Math.round(leg.matchup)}</span><span>L10 ${Math.round(leg.l10)}%</span><span>L20 ${Number.isFinite(leg.l20) ? `${Math.round(leg.l20)}%` : "—"}</span><span>Edge ${Number.isFinite(leg.edge) ? `${leg.edge >= 0 ? "+" : ""}${leg.edge.toFixed(2)}` : "—"}</span></p><small>${escapeHtml(`${stats.is_home ? "vs" : "@"} ${leg.opponent} · ${leg.pitcherName || "starter verified"} · ${leg.bvpSummary}`)} · ${leg.stability.toLowerCase()} stability · ${Math.round(leg.coverage * 100)}% coverage</small></div><div class="builder-leg-score"><span>LEG SCORE</span><b>${leg.quality}</b><small>${(leg.adjustedProb * 100).toFixed(1)}% adj.</small></div><div class="builder-leg-actions"><button type="button" class="${locked ? "locked" : ""}" data-builder-lock="${escapeHtml(leg.key)}">${locked ? "Locked" : "Lock"}</button><button type="button" data-builder-replace="${escapeHtml(leg.key)}">Replace</button></div></article>`;
}

function runParlayBuilder() {
  els.builderGenerate.classList.add("building");
  els.builderGenerate.disabled = true;
  els.builderStatus.textContent = "Checking matchup alignment, samples, stability, and correlation…";
  setTimeout(() => {
    const result = selectParlayLegs();
    state.builderResult = result.selected;
    els.builderGenerate.classList.remove("building");
    els.builderGenerate.disabled = false;
    renderBuilderResult(result.qualified);
  }, 620);
}

function wireParlayBuilder() {
  els.builderLegButtons.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.builderLegs = Number(button.dataset.legs);
    els.builderLegButtons.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
    state.builderLocked.clear(); state.builderResult = [];
  }));
  els.builderModeButtons.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => {
    state.builderMode = button.dataset.mode;
    els.builderModeButtons.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
    state.builderLocked.clear(); state.builderResult = [];
  }));
  els.builderGenerate.addEventListener("click", async () => {
    if (!state.v2BoardLoaded) await loadV2Board();
    runParlayBuilder();
  });
}

/* ---------- Slip Analyzer ---------- */

let selectedSlipImage = null;

function acceptSlipImage(file) {
  const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!file || !allowed.has(file.type)) {
    selectedSlipImage = null;
    els.slipGradeBtn.disabled = true;
    els.slipFileStatus.textContent = "No image selected";
    if (file) renderSlipError("Use a PNG, JPG, or WEBP screenshot.");
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    selectedSlipImage = null;
    els.slipGradeBtn.disabled = true;
    return renderSlipError("That screenshot is larger than 4 MB. Crop or compress it, then try again.");
  }
  selectedSlipImage = file;
  els.slipGradeBtn.disabled = false;
  els.slipFileStatus.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`;
  els.slipAnalysisResult.innerHTML = "";
}

function renderSlipError(message) {
  els.slipAnalysisResult.innerHTML = `<div class="slip-error" role="alert"><strong>Couldn’t analyze that slip</strong><p>${escapeHtml(message)}</p></div>`;
}

async function pasteSlipFromClipboard() {
  if (!navigator.clipboard?.read) {
    return renderSlipError("This browser blocks the Paste button. Copy the screenshot and press Ctrl+V or Cmd+V on this page instead.");
  }
  try {
    const items = await navigator.clipboard.read();
    const item = items.find((entry) => entry.types.some((type) => type.startsWith("image/")));
    if (!item) return renderSlipError("No image is on the clipboard. Copy the screenshot first, then paste again.");
    const type = item.types.find((value) => value.startsWith("image/"));
    const blob = await item.getType(type);
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    acceptSlipImage(new File([blob], `pasted-slip-${Date.now()}.${ext}`, { type }));
  } catch (_) {
    renderSlipError("Clipboard access was blocked. Click anywhere on this page and press Ctrl+V or Cmd+V instead.");
  }
}

function wireSlipAnalyzer() {
  els.slipFileInput.addEventListener("change", () => acceptSlipImage(els.slipFileInput.files[0]));
  ["dragenter", "dragover"].forEach((name) => els.slipUploadZone.addEventListener(name, (event) => {
    event.preventDefault(); els.slipUploadZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((name) => els.slipUploadZone.addEventListener(name, (event) => {
    event.preventDefault(); els.slipUploadZone.classList.remove("dragging");
  }));
  els.slipUploadZone.addEventListener("drop", (event) => acceptSlipImage(event.dataTransfer.files[0]));
  els.slipUploadZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.slipFileInput.click(); }
  });
  els.slipPasteBtn.addEventListener("click", pasteSlipFromClipboard);
  els.slipGradeBtn.addEventListener("click", gradeSlipImage);
  document.addEventListener("paste", (event) => {
    if (state.currentTab !== "slip") return;
    const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith("image/"));
    if (!item) return;
    event.preventDefault();
    const file = item.getAsFile();
    if (file) acceptSlipImage(new File([file], `pasted-slip-${Date.now()}.png`, { type: file.type }));
  });
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
  if (els.gamelogFilterToggle) els.gamelogFilterToggle.setAttribute("aria-expanded", String(gameLogState.filtersOpen));
}

function recentGameLogSource() {
  return gameLogState.chart?.all || gameLogState.chart?.l20 || gameLogState.chart?.l15 || gameLogState.chart?.l10 || gameLogState.chart?.l5 || [];
}

function gameLogPool() {
  const source = gameLogState.window === "h2h" ? (gameLogState.chart?.h2h || []) : recentGameLogSource();
  return filterGames(source);
}

function setGameLogCount(value, direction = "initial") {
  const max = Math.max(1, gameLogPool().length);
  gameLogState.gameCount = Math.max(1, Math.min(max, Number(value) || 1));
  gameLogState.window = "recent";
  gameLogState.animationDirection = direction;
  renderGameLogTabs();
  renderGameLogChart();
}

async function gradeSlipImage() {
  if (!selectedSlipImage) return;
  els.slipGradeBtn.disabled = true;
  els.slipGradeBtn.textContent = "Analyzing…";
  els.slipAnalysisResult.innerHTML = `<div class="slip-loader"><i></i><div><strong>Building the matchup report</strong><p>Reading 2–6 legs, resolving players, and scoring every live matchup. This can take up to a minute.</p></div></div>`;
  try {
    const response = await fetch(API_SLIP_ANALYZER, { method: "POST", headers: { "Content-Type": selectedSlipImage.type }, body: selectedSlipImage });
    const data = await response.json();
    if (data.authRequired) { await checkAuth(); return; }
    if (!response.ok || data.error) return renderSlipError(data.error || "The slip could not be graded.");
    renderSlipResult(data);
  } catch (_) {
    renderSlipError("The request did not finish. Check your connection and try the screenshot again.");
  } finally {
    els.slipGradeBtn.disabled = false;
    els.slipGradeBtn.textContent = "Detect & grade parlay";
  }
}

function renderSlipResult(data) {
  const legs = (data.legs || []).map((leg, index) => {
    if (leg.error) return `<article class="slip-result-leg error"><span>LEG ${index + 1}</span><p>${escapeHtml(leg.error)}</p></article>`;
    const rates = leg.hitRates || {};
    const matchup = leg.matchup || {};
    const why = (leg.whyItHits || []).slice(0, 3);
    const risks = (leg.risk || []).filter((text) => !/live lookup/i.test(text)).slice(0, 2);
    return `<article class="slip-result-leg"><header><span>LEG ${index + 1}</span><div><h3>${escapeHtml(leg.player)}</h3><p>${escapeHtml(leg.side)} ${escapeHtml(leg.line)} ${escapeHtml(leg.detectedMarket || leg.betType)}${matchup.opponent ? ` · vs ${escapeHtml(matchup.opponent)}` : ""}</p></div><b>${escapeHtml(leg.tier || "—")}</b><strong>${escapeHtml(leg.score ?? "—")}<small>SCORE</small></strong></header><div class="slip-leg-metrics"><span>L5 <b>${escapeHtml(rates.l5 ?? "—")}%</b></span><span>L10 <b>${escapeHtml(rates.l10 ?? "—")}%</b></span><span>L20 <b>${escapeHtml(rates.l20 ?? "—")}%</b></span><span>Leg chance <b>${escapeHtml(leg.legProbability ?? "—")}%</b></span></div><details><summary>Full leg breakdown</summary>${why.length ? `<div><b>WHY IT RATES</b>${why.map((text) => `<p>${escapeHtml(cleanAnalysisText(text))}</p>`).join("")}</div>` : ""}${risks.length ? `<div class="risk"><b>RISK</b>${risks.map((text) => `<p>${escapeHtml(cleanAnalysisText(text))}</p>`).join("")}</div>` : ""}${leg.narrative ? `<div><b>MATCHUP READ</b><p>${escapeHtml(cleanAnalysisText(leg.narrative))}</p></div>` : ""}</details></article>`;
  }).join("");
  els.slipAnalysisResult.innerHTML = `<section class="slip-grade-summary"><div><span>PARLAY GRADE</span><h2>${escapeHtml(data.tier)}</h2><p>${data.gradedCount} legs graded · weakest leg: <b>${escapeHtml(data.weakestLeg || "—")}</b></p></div><div class="slip-parlay-score"><strong>${escapeHtml(data.parlayScore)}</strong><small>PARLAY SCORE</small></div><dl><div><dt>Combined chance</dt><dd>${escapeHtml(data.combinedProbability)}%</dd></div><div><dt>Average L10</dt><dd>${escapeHtml(data.averageL10)}%</dd></div><div><dt>Average leg score</dt><dd>${escapeHtml(data.averageLegScore)}</dd></div></dl></section><div class="slip-result-legs">${legs}</div>${data.gradedCount > 2 ? `<p class="slip-parlay-note">More legs sharply reduce the chance of the full card hitting. Compare this with a two-leg version using the strongest individual scores.</p>` : ""}`;
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
    <div><span>MATCHUP</span><strong>${Number.isFinite(Number(stats.matchup_score)) ? `${Math.round(Number(stats.matchup_score))}/100` : "Not graded"}</strong><small>${escapeHtml(boardMatchupLabel(stats.matchup_score) || "Coverage unavailable")}</small></div>
  </div><div class="board-analysis-case"><div><span>CASE</span><p>${escapeHtml(cleanAnalysisText(p.case_summary || "Model and matchup signals align with this side."))}</p></div><div class="risk"><span>RISK</span><p>${escapeHtml(cleanAnalysisText(p.risk_summary || "No material conflict reported."))}</p></div></div>`;

  if (Number.isFinite(Number(stats.matchup_score)) && (stats.matchup_factors || []).length) {
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
    side: "over",
    vortexScore: p.vortex_score,
    tier: p.tier,
    matchupScore: boardStats.matchup_score,
    matchupLabel: boardStats.matchup_label,
    matchupCoverage: boardStats.matchup_coverage,
    matchupFactors: boardStats.matchup_factors || [],
  };
  els.v2BackBtn.hidden = false;

  const isPitcher = BOT_PITCHER_STATS.has(p.stat_type);
  selectPlayer(p.player_name, isPitcher ? "P" : null, { autoSelectStat: false, viaDeepDive: true });
  selectStat(stat);

  cmd.side = "Over";
  els.sideToggle.querySelectorAll(".side-btn").forEach((b) => b.classList.toggle("active", b.dataset.side === "Over"));
  setLineValue(p.line, { immediate: true });

  switchTab("research", document.querySelector('.tab-btn[data-tab="research"]'));
}

/* ---------- V2 Admin panel (hidden, PIN-gated) ---------- */

function openV2PinPrompt() {
  els.v2PinInput.value = "";
  els.v2PinError.hidden = true;
  els.v2PinOverlay.hidden = false;
  els.v2PinInput.focus();
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
  els.v2PinClose.addEventListener("click", () => { els.v2PinOverlay.hidden = true; });
  els.v2AdminClose.addEventListener("click", () => { els.v2AdminOverlay.hidden = true; });

  const submitPin = async () => {
    const pin = els.v2PinInput.value.trim();
    if (!pin) return;
    try {
      const res = await fetch("/api/v2-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "auth", pin }),
      });
      const data = await readAdminJson(res);
      if (!res.ok || !data.ok) {
        els.v2PinError.textContent = data.error || "Incorrect PIN";
        els.v2PinError.hidden = false;
        return;
      }
      els.v2PinOverlay.hidden = true;
      try {
        await loadAdminRecords();
        switchTab("admin");
      } catch (err) {
        showToast(err.message || "Could not load admin results.", "warn");
      }
    } catch (err) {
      els.v2PinError.textContent = err.message || "Request failed";
      els.v2PinError.hidden = false;
    }
  };
  els.v2PinSubmit.addEventListener("click", submitPin);
  els.v2PinInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitPin(); });

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
  let status = "NEEDS VERIFICATION", strength = "Unknown", shift = 0, explanation = "VORTEX does not currently have a verified input for this concern. Treat it as a wait condition, not an automatic fade.";
  if (key === "gut") {
    status = "NOT QUANTIFIABLE"; strength = "Unverified";
    explanation = "A gut concern is worth noticing, but it cannot overturn the model until you can name the underlying baseball or pricing assumption.";
  } else if (matches.length) {
    const adverse = matches.some(d => d.impact < 0);
    shift = adverse ? Math.min(8, matches.filter(d => d.impact < 0).reduce((n, d) => n + Math.min(4, Math.abs(d.impact)), 0)) : 0;
    strength = adverse ? (shift >= 6 ? "Material" : shift >= 3 ? "Moderate" : "Minor") : "Does not weaken play";
    status = adverse ? "ALREADY MODELED" : "MODELED — NOT A RED FLAG";
    explanation = adverse ? `This concern already reduces the grade through ${matches.filter(d => d.impact < 0).map(d => d.name).join(" and ")}. The remaining evidence still supports the current verdict.` : `VORTEX already evaluates ${matches.map(d => d.name).join(" and ")}. In the available data, this factor supports the play rather than opposing it.`;
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
