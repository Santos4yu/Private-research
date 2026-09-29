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
  stolenbases: market('sb', 'Stolen Bases', 'Stolen bases', 'stolenBases'),
  singles: market('singles', 'Singles', 'Singles', 'singles'),
  doubles: market('doubles', 'Doubles', 'Doubles', 'doubles'),
  triples: market('triples', 'Triples', 'Triples', 'triples'),
  runsrbis: market('runs-rbis', 'Runs+RBIs', 'Runs + RBIs', 'runsRbi'),
  extrabasehits: market('xbh', 'Extra Base Hits', 'Extra-base hits', 'extraBaseHits'),
  hitswalks: market('hits-walks', 'Hits+Walks', 'Hits + walks', 'hitsWalks'),
  runsallowed: market('runs-allowed', 'Runs Allowed', 'Runs allowed', 'runs', true),
  homerunsallowed: market('hr-allowed', 'Home Runs Allowed', 'Home runs allowed', 'homeRuns', true),
  battersfaced: market('batters-faced', 'Batters Faced', 'Batters faced', 'battersFaced', true),
  pitchesthrown: market('pitches', 'Pitches Thrown', 'Pitches', 'numberOfPitches', true),
  pitcherfantasyscore: market('pitcher-fantasy', 'Pitcher Fantasy Score', 'Pitcher fantasy', 'pitcherFantasy', true),
  // Read per start from the game's line score and play-by-play
  // (live_props_core.first_inning), so their history asks for it.
  '1stinninghitsallowed': {...market('first-hits', '1st Inning Hits Allowed', '1st-inning hits', 'firstInningHits', true), firstInning: true},
  '1stinningrunsallowed': {...market('first-runs', '1st Inning Runs Allowed', '1st-inning runs', 'firstInningRuns', true), firstInning: true},
  '1stinningpitchesthrown': {...market('first-pitches', '1st Inning Pitches Thrown', '1st-inning pitches', 'firstInningPitches', true), firstInning: true},
  '1stinningwalksallowed': {...market('first-walks', '1st Inning Walks Allowed', '1st-inning walks', 'firstInningWalks', true), firstInning: true},
  '1stinningstrikeouts': {...market('first-ks', '1st Inning Strikeouts', "1st-inning K's", 'firstInningStrikeouts', true), firstInning: true},
};
Object.assign(markets, {strikeoutspitcher: markets.pitcherstrikeouts, pitcherwalks: markets.walksallowed,
  pitcherwalksallowed: markets.walksallowed, earnedruns: markets.earnedrunsallowed, outs: markets.pitchingouts,
  runs: markets.runsscored, hitterstrikeouts: markets.strikeouts, fantasyscore: markets.hitterfantasyscore,
  fantasyscorepp: markets.hitterfantasyscore, stolenbase: markets.stolenbases, sb: markets.stolenbases,
  pitchcount: markets.pitchesthrown, pitches: markets.pitchesthrown,
  batterwalks: markets.walks, hitterwalks: markets.walks, walksdrawn: markets.walks, runsrbi: markets.runsrbis,
  xbh: markets.extrabasehits, hitsplusrunsplusrbis: markets.hitsrunsrbis, hitsrunsrbi: markets.hitsrunsrbis,
  batterfantasyscore: markets.hitterfantasyscore, strikeoutsthrown: markets.pitcherstrikeouts, outsrecorded: markets.pitchingouts,
  hrallowed: markets.homerunsallowed, totalrunsallowed: markets.runsallowed, fantasyscorepitcher: markets.pitcherfantasyscore,
  pitchingfantasyscore: markets.pitcherfantasyscore,
  firstinninghitsallowed: markets['1stinninghitsallowed'], hitsallowed1stinning: markets['1stinninghitsallowed'],
  firstinningrunsallowed: markets['1stinningrunsallowed'], runsallowed1stinning: markets['1stinningrunsallowed'],
  '1stinningruns': markets['1stinningrunsallowed'], norunfirstinning: markets['1stinningrunsallowed'], nrfi: markets['1stinningrunsallowed'],
  firstinningpitchesthrown: markets['1stinningpitchesthrown'], pitchesthrown1stinning: markets['1stinningpitchesthrown'],
  '1stinningpitches': markets['1stinningpitchesthrown'],
  firstinningwalksallowed: markets['1stinningwalksallowed'], '1stinningwalks': markets['1stinningwalksallowed'],
  firstinningstrikeouts: markets['1stinningstrikeouts'], '1stinningpitcherstrikeouts': markets['1stinningstrikeouts']});
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
  if (m.field === 'runsRbi') return n('runs') + n('rbi');
  if (m.field === 'extraBaseHits') return n('doubles') + n('triples') + n('homeRuns');
  if (m.field === 'hitsWalks') return n('hits') + n('baseOnBalls');
  if (m.field === 'fantasy') {
    const singles = n('hits') - n('doubles') - n('triples') - n('homeRuns');
    return singles * 3 + n('doubles') * 5 + n('triples') * 8 + n('homeRuns') * 10 + n('runs') * 2 + n('rbi') * 2 + n('baseOnBalls') * 2 + n('hitByPitch') * 2 + n('stolenBases') * 5;
  }
  if (m.field === 'outs' && stat.outs == null) {
    const [ip, partial = '0'] = String(stat.inningsPitched || '0').split('.');
    return Number(ip) * 3 + Number(partial);
  }
  if (m.field === 'totalBases' && stat.totalBases == null) return n('hits') + n('doubles') + 2 * n('triples') + 3 * n('homeRuns');
  if (m.field === 'singles') return n('hits') - n('doubles') - n('triples') - n('homeRuns');
  if (m.field === 'numberOfPitches') { const pitches = stat.numberOfPitches ?? stat.pitchesThrown; return pitches == null ? null : Number(pitches); }
  if (m.field === 'pitcherFantasy') {
    // PrizePicks' pitcher scoring: win 6, quality start 4, earned run -3,
    // strikeout 3, out 1.
    const outs = gameValue(stat, {field: 'outs'});
    const earned = n('earnedRuns');
    return n('wins') * 6 + (outs >= 18 && earned <= 3 ? 4 : 0) - earned * 3 + n('strikeOuts') * 3 + outs;
  }
  return stat[m.field] == null ? null : Number(stat[m.field]);
}
export function historyChart(payload, row) {
  const m = finderMarket(row.stat);
  const opponentId = row.teamId || payload.matchup?.opponent?.id;
  const all = (payload.games || []).map(g => ({gameId: g.gameId ?? g.gamePk, value: gameValue(g.stat, m), fullDate: g.date, date: g.date.slice(5).replace('-', '/'),
    season: g.date.slice(0,4), opponent: g.opponent?.name || '', opponentTeamId: g.opponent?.id,
    isHome: g.isHome, home: g.isHome, over: gameValue(g.stat,m) > Number(row.line),
    ...(m.pitcher ? {pitcherDetails: {inningsPitched: g.stat.inningsPitched, battersFaced: g.stat.battersFaced,
      pitchCount: g.stat.numberOfPitches, walks: g.stat.baseOnBalls, strikeouts: g.stat.strikeOuts}} : {}),
  })).filter(g => g.value != null);
  return {all, l5: all.slice(-5), l10: all.slice(-10), l15: all.slice(-15), l20: all.slice(-20),
    h2h: opponentId == null ? [] : all.filter(g => String(g.opponentTeamId) === String(opponentId)),
    meta: {player_id: payload.player?.id, opponent: row.opponent || payload.matchup?.opponent?.name,
      opponent_team_id: opponentId, h2hLabel: payload.h2hLabel}};
}
