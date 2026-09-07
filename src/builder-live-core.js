import {finderMarket, nameKey} from './prop-finder-core.js';

export function liveBuilderProp(live, row, side) {
  if (!live.builderEvidence || nameKey(live.player) !== nameKey(row.player) || Number(live.line) !== Number(row.line)
      || live.side?.toLowerCase() !== side || finderMarket(live.betType)?.label !== finderMarket(row.stat)?.label) return null;
  const e = live.builderEvidence;
  const pitcher = live.isPitcherProp === true;
  const playerId = live.headshot?.match(/people\/(\d+)\//)?.[1] || (pitcher ? live.starterProfile?.id : null);
  return {player_name:live.player, stat_type:live.betType, line:Number(live.line), tier:live.tier?.toUpperCase(),
    vortex_score:live.score, commence_time:e.gameTime, source:'Live analysis', projection_id:row.id,
    stats: {side, player_id:playerId, prop_type:pitcher ? 'pitcher_live' : 'batter_live',
      matchup_score:live.matchupScore, matchup_coverage:live.matchupCoverage,
      matchup_adjustment:live.matchupAdjustment, matchup_conflicts:e.conflicts,
      eff_l10:live.hitRates?.l10, eff_l20:live.hitRates?.l20,
      sample_l10:e.sampleL10, sample_l20:e.sampleL20,
      proj_edge:e.projectionEdge, stability_tier:e.stability, lineup_spot:e.lineupSpot,
      lineup_confirmed:Number(e.lineupSpot) >= 1 && Number(e.lineupSpot) <= 9,
      pitcher:{name:live.starterProfile?.name, validated_role:e.starterConfirmed === true},
      opponent:live.matchup?.opponent, game_pk:e.gameId, is_home:e.isHome,
      decision_quality:e.decisionQuality, bvp:live.bvpCard || {}}};
}

export function historicalSides(row, chart, minRate) {
  const all = chart.all || [];
  if (all.length < 10) return [];
  const sides = row.odds_type === 'standard' && row.allowed_wager_types?.includes('under') ? ['over','under'] : ['over'];
  return sides.map(side => {
    const wins = games => games.filter(g => side === 'over' ? g.value > Number(row.line) : g.value < Number(row.line)).length;
    const l10 = all.slice(-10), l20 = all.slice(-20);
    const rate = wins(l10) / l10.length * 100;
    return {row,side,rate,rank:rate * .6 + wins(l20) / l20.length * 40};
  }).filter(c => c.rate >= minRate);
}
