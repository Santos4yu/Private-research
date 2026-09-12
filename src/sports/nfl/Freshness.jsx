import React, { useEffect, useState } from 'react';
import { freshness } from './nfl-client';
export function NFLFreshness({ timestamp, staleAfter }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  return <small className="nfl-freshness" title={timestamp || 'No source timestamp'}>{freshness(timestamp, now, staleAfter)}</small>;
}
