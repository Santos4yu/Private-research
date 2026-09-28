import React, { useEffect, useRef, useState } from 'react';
import { Database } from 'lucide-react';
import MLBFinderContext from './MLBFinderContext';
import MLBSupportingStats from './MLBSupportingStats';
import MLBPlayerGameLog from './MLBPlayerGameLog';
import { FinderPlayerBanner } from './FinderPlayerBanner';
import { NFLPlayerPage } from './sports/nfl/NFLPlayerPage';

function MLBTrends({ row, playerRows, onBack }) {
  const host = useRef(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    const panel = window.vortexTrendPanel;
    setAvailable(Boolean(panel?.mountMlb(host.current, row)));
    return () => panel?.unmount();
  }, [row]);
  return <section className="finder-trend-view wnba-trend-page">
    <FinderPlayerBanner row={row} playerRows={playerRows} onBack={onBack} />
    {!available && <div className="wnba-board-message" role="status"><Database size={22} aria-hidden="true" /><strong>Trends could not open</strong><span>Refresh the page to reload player research.</span></div>}
    <div className="mlb-finder-workspace"><div className="mlb-trend-main"><div className="wnba-trend-host finder-mlb-trend-host" ref={host} /><MLBSupportingStats key={row.id} row={row}/><MLBPlayerGameLog key={`log-${row.id}`} row={row}/></div><MLBFinderContext key={row.id} row={row}/></div>
  </section>;
}

// This host never dispatches navigation events or changes the URL. Closing
// it returns to the same sport, filters and page in the unified Finder.
// NFL uses the WNBA/MLB player page layout (sports/nfl/NFLPlayerPage.jsx).
export function FinderTrendView({ row, playerRows, onBack }) {
  return String(row.sport).toLowerCase() === 'nfl'
    ? <NFLPlayerPage row={row} playerRows={playerRows} onBack={onBack} />
    : <MLBTrends row={row} playerRows={playerRows} onBack={onBack} />;
}
