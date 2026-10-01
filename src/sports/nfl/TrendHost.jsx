import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { teamLogoUrl } from './nfl-ui-core';
import { nflStatTabs, nflTrendChart, nflLineLadder, nflOddsRows, nflDefaultLine } from './trend-bridge';

// NFL's Trend tab IS the MLB trend panel.
//
// #gamelog-overlay is a singleton that app.js keeps populated across
// player/prop switches; MLB research relocates it into its own Trend tab
// with mountResearchTabs()'s move-not-copy approach. This does the same
// thing for NFL through window.vortexTrendPanel, so NFL gets that exact
// chart, window bar, filters, line stepper, alt-line picker and sportsbook
// odds row -- the same code and the same CSS, not a lookalike.
//
// Because it is ONE node, it can only live in one place at a time. Parking
// it back on <body> on unmount is what lets a later MLB report reclaim it
// by id (getElementById never finds a detached node -- the bug class
// parkGameLogOverlay() exists for).
export function NFLTrendHost({
  player,
  props: propDefinitions,
  logs,
  offers,
  offersReady,
  selectedProp,
  quote,
  opponent,
  matchupLabel,
  kickoffLabel,
  status,
  loading,
  onStat,
}) {
  const host = useRef(null);
  const config = useMemo(() => {
    const opponentId = opponent || '';
    const chart = nflTrendChart(logs, selectedProp.key, opponentId);
    const lines = nflLineLadder(offers);
    const posted = quote?.propType === selectedProp.key && Number.isFinite(quote?.value) ? quote.value : null;
    return {
      sport: 'NFL',
      player: player.name,
      teamAbbr: player.team_id || '',
      teamLogo: teamLogoUrl(player.team_id),
      opponent: opponentId,
      opponentLogo: teamLogoUrl(opponentId),
      matchupLabel,
      kickoffLabel,
      status,
      headshot: player.headshot_url || null,
      stats: nflStatTabs(propDefinitions),
      statKey: selectedProp.key,
      stat: selectedProp.label,
      side: quote?.direction === 'UNDER' ? 'Under' : 'Over',
      line: posted ?? nflDefaultLine(chart.all),
      chart,
      lines,
      // A ladder that hasn't come back yet must not read as "no lines
      // posted" -- the panel's picker shows a loading state instead.
      linesStatus: !offersReady ? 'loading' : lines.length ? 'ready' : 'empty',
      odds: nflOddsRows(offers),
      loading,
      onStat,
    };
  }, [player, propDefinitions, logs, offers, offersReady, selectedProp, quote, opponent, matchupLabel, kickoffLabel, status, loading, onStat]);

  // Kept in a ref so the mount effect can run exactly once (moving the DOM
  // node) while data changes flow through the update effect below.
  const latest = useRef(config);
  latest.current = config;

  useLayoutEffect(() => {
    const panel = window.vortexTrendPanel;
    if (!panel || !host.current) return undefined;
    panel.mount(host.current, latest.current);
    return () => panel.unmount();
  }, []);

  useLayoutEffect(() => {
    window.vortexTrendPanel?.update(config);
  }, [config]);

  return <div className="nfl-trend-host" ref={host} />;
}
