import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Database, RefreshCw } from 'lucide-react';
import { NFLPlayerResearch } from './sports/nfl/SportResearch';
import { createNFLClient } from './sports/nfl/nfl-client';
import './sports/nfl/nfl-research.css';
import MLBFinderContext from './MLBFinderContext';
import MLBSupportingStats from './MLBSupportingStats';
import MLBPlayerGameLog from './MLBPlayerGameLog';

const nflClient = createNFLClient();
const nflSeason = () => new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear();

function MLBTrends({ row, onBack }) {
  const host = useRef(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const panel = window.vortexTrendPanel;
    setAvailable(Boolean(panel?.mountMlb(host.current, row)));
    return () => panel?.unmount();
  }, [row]);
  return <section className="finder-trend-view wnba-trend-page">
    <button type="button" className="wnba-trend-back" aria-label="Back to Finder" onClick={onBack}><ArrowLeft size={17} aria-hidden="true" />Back</button>
    <header className="wnba-trend-title"><div className="wnba-player-cell">
      {row.headshot && <img className="wnba-player-photo" src={row.headshot} alt="" width="56" height="56" />}
      <div><span>MLB TRENDS</span><h1>{row.player}</h1><p>{row.market} · Line {row.line}</p></div>
    </div></header>
    {!available && <div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true" /><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}
    <div className="mlb-finder-workspace"><div className="mlb-trend-main"><div className="wnba-trend-host finder-mlb-trend-host" ref={host} /><MLBSupportingStats key={row.id} row={row}/><MLBPlayerGameLog key={`log-${row.id}`} row={row}/></div><MLBFinderContext key={row.id} row={row}/></div>
  </section>;
}

function NFLTrends({ row, onBack }) {
  const [context, setContext] = useState({ players: [], teams: [], schedules: [], error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const season = String(nflSeason());
    Promise.allSettled([
      nflClient.get('players', { season }),
      nflClient.get('teams', { season }),
      nflClient.get('schedule', { season, seasonType: 'REG' }),
    ]).then(results => {
      if (!active) return;
      const data = results.map(result => result.status === 'fulfilled' ? result.value.data || [] : []);
      setContext({ players: data[0], teams: data[1], schedules: data[2], error: results.some(result => result.status === 'rejected') });
    });
    return () => { active = false; };
  }, [retry]);
  const player = useMemo(() => {
    const source = row.raw || row;
    const profile = context.players.find(item => String(item.id) === String(row.playerId)) || row.playerObject || {};
    return {
      ...profile,
      id: profile.id || row.playerId || source.playerId,
      name: profile.name || row.player || source.playerName,
      position: profile.position || row.position || source.position,
      team_id: profile.team_id || row.teamAbbr || source.teamId,
      headshot_url: profile.headshot_url || row.headshot || '',
      researchProp: row.marketKey || source.propType,
      researchLine: { ...source.line, value: row.line, propType: row.marketKey || source.propType, direction: row.direction || source.line?.direction || source.direction || 'OVER' },
      researchGameId: source.gameId,
      researchMatchup: source.matchupContext || null,
    };
  }, [row, context.players]);
  return <section className="finder-trend-view finder-nfl-trend-view nfl-app-shell">
    {context.error && <div className="wnba-board-message" role="status"><span>Some matchup details could not load. Player trends remain available.</span><button type="button" className="wnba-trend-back" onClick={() => { nflClient.clear(); setRetry(value => value + 1); }}><RefreshCw size={16} aria-hidden="true" />Retry matchup details</button></div>}
    <NFLPlayerResearch key={`${player.id}:${player.researchProp}:${row.line}`} player={player} players={context.players} teams={context.teams} schedules={context.schedules} onBack={onBack} backLabel="Back" />
  </section>;
}

// This host never dispatches navigation events or changes the URL. Closing
// it returns to the same sport, filters and page in the unified Finder.
export function FinderTrendView({ row, playerRows, onBack }) {
  return String(row.sport).toLowerCase() === 'nfl'
    ? <NFLTrends row={row} playerRows={playerRows} onBack={onBack} />
    : <MLBTrends row={row} onBack={onBack} />;
}
