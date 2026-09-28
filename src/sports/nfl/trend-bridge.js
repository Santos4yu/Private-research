// NFL data, reshaped for the SHARED trend panel.
//
// The trend screen NFL shows is not a second implementation -- it is the
// very same #gamelog-overlay node MLB research uses (chart, window bar,
// filters, line stepper, alt-line picker, sportsbook odds row), relocated
// into NFL's Trend tab by TrendHost.jsx. app.js exposes it through
// window.vortexTrendPanel and asks a sport adapter for the few things that
// genuinely differ. This module is the NFL half of that: it converts NFL
// game logs and posted offers into the exact shapes those shared renderers
// already read, so nothing about the panel itself has to know about NFL.
import { gameStatValue } from './nfl-ui-core';
import { NFL_PROP_DEFINITIONS } from './props';

// Short codes for the panel's stat-tab strip -- the same role "HRR", "TB"
// and "K" play on the MLB side. Kept short because the strip is a row of
// small square buttons, not a list of full labels.
export const NFL_STAT_CODES = {
  passing_yards: 'PASS',
  passing_attempts: 'ATT',
  pass_completions: 'CMP',
  passing_touchdowns: 'PTD',
  interceptions: 'INT',
  rushing_yards: 'RUSH',
  rush_attempts: 'CAR',
  passing_rushing_yards: 'P+R',
  receiving_yards: 'REC YD',
  receptions: 'REC',
  targets: 'TGT',
  longest_reception: 'LNG',
  rushing_receiving_yards: 'R+R',
  touchdowns: 'TD',
  fantasy_score: 'FS',
  longest_completion: 'LNG CMP',
  longest_rush: 'LNG RUSH',
  rush_yards_first_5: 'RUSH 5',
  rec_yards_first_2: 'REC 2',
  fg_made: 'FGM',
  fg_attempts: 'FGA',
  fg_yards: 'FG YD',
  kicking_points: 'KP',
  kicker_fantasy: 'K FS',
  longest_fg: 'LNG FG',
  shortest_fg: 'SHT FG',
  pat_attempts: 'PAT',
  sacks_taken: 'SACKED',
  rushing_tds: 'RUSH TD',
  receiving_tds: 'REC TD',
  fumbles_lost: 'FUM',
  pat_made: 'XP',
  punts: 'PUNTS',
  solo_tackles: 'SOLO',
  punts_inside_20: 'IN 20',
  gross_punt_yards: 'PUNT YD',
  punts_50_plus: '50+',
  tackles: 'TKL',
  sacks: 'SACK',
  tackles_for_loss: 'TFL',
  def_interceptions: 'D INT',
};

export function nflStatCode(key) {
  return NFL_STAT_CODES[key] || String(key || '').replaceAll('_', ' ').toUpperCase();
}

// The panel's stat tabs take plain labels and hand the label back on click,
// so each entry carries the NFL prop key alongside it for the round trip.
export function nflStatTabs(definitions) {
  return definitions.map((definition) => ({
    key: definition.key,
    label: definition.label,
    code: nflStatCode(definition.key),
  }));
}

export function nflPropLabel(key) {
  return NFL_PROP_DEFINITIONS.find((definition) => definition.key === key)?.label || key;
}

// One game in the panel's own shape. filterGames()/renderGameLogChart()
// read exactly these fields; `over` is filled in by the panel's own
// gradeTrendChart() once a line is known.
function trendGame(row, propKey) {
  const value = gameStatValue(row, propKey);
  if (!Number.isFinite(value)) return null;
  return {
    value,
    season: String(row.season ?? ''),
    // NFL games are identified by week, not a calendar date. The panel
    // renders `dateLabel` in place of its own M/D formatting when one is
    // supplied, so a column reads "W7" rather than an empty slot.
    dateLabel: Number.isFinite(Number(row.week)) ? `W${row.week}` : '',
    fullDate: row.game_date || row.gameday || '',
    opponent: row.opponent_team_id || '',
    isHome: row.is_home == null ? null : Boolean(row.is_home),
    gameId: row.game_id,
  };
}

// Oldest -> newest, which is the order every window in the panel assumes
// (they all take the LAST n games).
export function nflTrendChart(logs, propKey, opponentId) {
  const all = [...(logs || [])]
    .sort((a, b) => (a.season - b.season) || (a.week - b.week) || String(a.game_id || '').localeCompare(String(b.game_id || '')))
    .map((row) => trendGame(row, propKey))
    .filter(Boolean);
  const chart = { all };
  const h2h = opponentId ? all.filter((game) => game.opponent === opponentId) : [];
  if (h2h.length) {
    chart.h2h = h2h;
    chart.meta = { h2hLabel: `Career vs ${opponentId}` };
  }
  return chart;
}

// Goblins/demons are a PrizePicks concept the panel's alt-line picker
// already renders its own badge for; anything else posted at a value the
// standard ladder doesn't carry is an alternate.
const TIER_RANK = { STANDARD: 3, GOBLIN: 2, DEMON: 2, ALT: 1 };
function offerTier(category) {
  return category === 'GOBLIN' || category === 'DEMON' || category === 'STANDARD' ? category : 'ALT';
}

// The posted-line ladder behind the panel's alt-lines Select: one entry per
// distinct value, tagged with the most specific tier posted at that value.
export function nflLineLadder(offers) {
  const lines = new Map();
  for (const row of offers || []) {
    const value = row.line?.value;
    if (!Number.isFinite(value)) continue;
    const tier = offerTier(row.line.category);
    let current = lines.get(value);
    if (!current) { current = { value, tier, books: [], primaryBook: null, bestPrice: -Infinity }; lines.set(value, current); }
    if (current.primaryBook !== 'prizepicks' && TIER_RANK[tier] > TIER_RANK[current.tier]) current.tier = tier;
    if (!current.books.includes(row.line.bookmaker)) current.books.push(row.line.bookmaker);
    // PrizePicks owns its Goblin/Demon/standard presentation, so it always
    // leads when posted. Otherwise show the book offering the best American
    // price while preserving the complete book count for the availability
    // signal in the menu.
    const price = Number.isFinite(row.line.price) ? row.line.price : -Infinity;
    if (row.line.bookmaker === 'prizepicks') { current.primaryBook = 'prizepicks'; current.tier = tier; }
    else if (current.primaryBook !== 'prizepicks' && price > current.bestPrice) current.primaryBook = row.line.bookmaker;
    if (row.line.bookmaker !== 'prizepicks' && price > current.bestPrice) current.bestPrice = price;
  }
  return [...lines.values()].map(({ bestPrice, ...line }) => line).sort((a, b) => a.value - b.value);
}

// Book quotes per line, keyed by the same bookmaker keys the panel's
// GAMELOG_ODDS_BOOKS list uses (draftkings, fanduel, betmgm, underdog...),
// so the odds row renders NFL prices with no sport branch of its own.
// PrizePicks is deliberately left in -- the panel's own book list decides
// what to show, and it already excludes PrizePicks as a one-sided product.
export function nflOddsRows(offers) {
  const byLine = new Map();
  for (const row of offers || []) {
    const line = row.line;
    if (!Number.isFinite(line?.value)) continue;
    let books = byLine.get(line.value);
    if (!books) { books = {}; byLine.set(line.value, books); }
    const book = books[line.bookmaker] || (books[line.bookmaker] = { over: null, under: null });
    const price = Number.isFinite(line.price) ? line.price : null;
    if (line.direction === 'OVER') book.over = price;
    else if (line.direction === 'UNDER') book.under = price;
  }
  return [...byLine.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, books]) => ({ line: value, books }));
}

// Where to put the line when no book has posted one, so the chart still
// grades instead of showing every bar in one colour: the sample's median,
// snapped to the nearest .5 the way the panel's own stepper snaps.
export function nflDefaultLine(games) {
  const values = (games || []).map((game) => game.value).filter(Number.isFinite).sort((a, b) => a - b);
  if (!values.length) return 0.5;
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return Math.max(0.5, Math.round(median - 0.5) + 0.5);
}
