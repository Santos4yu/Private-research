export const nameKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const market = (key, label, short, field, pitcher = false) => ({key, label, short, field, pitcher});
const markets = {
  pitcherstrikeouts: market('strikeouts', 'Strikeouts (Pitcher)', "K's", 'strikeOuts', true),
  pitchingouts: market('outs', 'Pitching Outs', 'Outs', 'outs', true),
  hitsallowed: market('hits', 'Hits Allowed', 'Hits allowed', 'hits', true),
  earnedrunsallowed: market('earned-runs', 'Earned Runs Allowed', 'Earned runs', 'earnedRuns', true),
  walksallowed: market('walks', 'Walks Allowed', 'Walks', 'baseOnBalls', true),
  hits: market('hits', 'Hits', 'Hits', 'hits'),
  hitsrunsrbis: market('hrr', 'Hits+Runs+RBIs', 'Hits + Runs + RBIs', 'hrr'),
  totalbases: market('tb', 'Total Bases', 'Total bases', 'totalBases'),
  homeruns: market('hr', 'Home Runs', 'Home runs', 'homeRuns'),
  rbis: market('rbi', 'RBIs', 'RBIs', 'rbi'),
  runsscored: market('runs', 'Runs Scored', 'Runs', 'runs'),
  strikeouts: market('strikeouts', 'Strikeouts', "Batter K's", 'strikeOuts'),
  walks: market('walks', 'Walks', 'Walks', 'baseOnBalls'),
  hitterfantasyscore: market('fantasy', 'Fantasy Score', 'Fantasy score', 'fantasy'),
};
Object.assign(markets, {strikeoutspitcher: markets.pitcherstrikeouts, pitcherwalks: markets.walksallowed,
  pitcherwalksallowed: markets.walksallowed, earnedruns: markets.earnedrunsallowed, outs: markets.pitchingouts,
  runs: markets.runsscored, hitterstrikeouts: markets.strikeouts, fantasyscore: markets.hitterfantasyscore,
  fantasyscorepp: markets.hitterfantasyscore});
export function finderMarket(value) { return markets[nameKey(value)] || null; }
export function finderRows(rows, {category = 'pitchers', modifier = 'all', stat = 'all', query = ''} = {}) {
  const grouped = new Map();
  for (const row of rows) {
    const m = finderMarket(row.stat);
    if (!m || (category === 'pitchers') !== m.pitcher || (stat !== 'all' && m.key !== stat)) continue;
    if (modifier !== 'all' && (row.odds_type || 'standard') !== modifier) continue;
    if (query && !nameKey(row.player).includes(nameKey(query))) continue;
    // Preserve each modifier as a separate choice; alternatives stay in the explorer.
    const key = `${nameKey(row.player)}|${m.key}|${row.odds_type || 'standard'}`;
    const prev = grouped.get(key);
    if (!prev || Number(row.line) < Number(prev.line)) grouped.set(key, row);
  }
  const order = {standard: 0, goblin: 1, demon: 2};
  return [...grouped.values()].sort((a,b) => a.player.localeCompare(b.player) || (order[a.odds_type] ?? 3) - (order[b.odds_type] ?? 3) || a.stat.localeCompare(b.stat));
}
export function gameValue(stat, m) {
  const n = field => Number(stat[field] || 0);
  if (m.field === 'hrr') return n('hits') + n('runs') + n('rbi');
  if (m.field === 'fantasy') {
    const singles = n('hits') - n('doubles') - n('triples') - n('homeRuns');
    return singles * 3 + n('doubles') * 5 + n('triples') * 8 + n('homeRuns') * 10 + n('runs') * 2 + n('rbi') * 2 + n('baseOnBalls') * 2 + n('hitByPitch') * 2 + n('stolenBases') * 5;
  }
  if (m.field === 'outs' && stat.outs == null) {
    const [ip, partial = '0'] = String(stat.inningsPitched || '0').split('.');
    return Number(ip) * 3 + Number(partial);
  }
  if (m.field === 'totalBases' && stat.totalBases == null) return n('hits') + n('doubles') + 2 * n('triples') + 3 * n('homeRuns');
  return stat[m.field] == null ? null : Number(stat[m.field]);
}
export function historyChart(payload, row) {
  const m = finderMarket(row.stat);
  const all = (payload.games || []).map(g => ({value: gameValue(g.stat, m), fullDate: g.date, date: g.date.slice(5).replace('-', '/'),
    season: g.date.slice(0,4), opponent: g.opponent?.name || '', opponentTeamId: g.opponent?.id,
    isHome: g.isHome, home: g.isHome, over: gameValue(g.stat,m) > Number(row.line)})).filter(g => g.value != null);
  return {all, l5: all.slice(-5), l10: all.slice(-10), l15: all.slice(-15), l20: all.slice(-20),
    h2h: all.filter(g => g.opponentTeamId === payload.matchup?.opponent?.id),
    meta: {player_id: payload.player?.id, opponent: payload.matchup?.opponent?.name,
      opponent_team_id: payload.matchup?.opponent?.id, h2hLabel: payload.h2hLabel}};
}
