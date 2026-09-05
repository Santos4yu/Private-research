import React, { useState } from 'react';
import { ArrowRight, ArrowUpRight, Crosshair, ScanLine, ChartNoAxesCombined } from 'lucide-react';

const go = (tab) => window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab } }));
const players = [
  { name: 'Shohei Ohtani', first: 'Shohei', last: 'Ohtani', id: 660271, position: 'TWP', color: 'blue' },
  { name: 'Aaron Judge', first: 'Aaron', last: 'Judge', id: 592450, position: 'OF', color: 'silver' },
];

function PlayerShortcut({ player }) {
  const [imageFailed, setImageFailed] = useState(false);
  return <button type="button" className={`lab-player lab-player--${player.color}`}
    aria-label={`Research ${player.name}`}
    onClick={() => window.dispatchEvent(new CustomEvent('vortex:research-player', { detail: player }))}>
    <span className="lab-player-grid" aria-hidden="true" />
    <span className="lab-player-watermark" aria-hidden="true">{player.last.slice(0, 1)}</span>
    {!imageFailed && <img className="lab-player-photo" alt="" width="300" height="300"
      src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_480,q_auto,f_auto/v1/people/${player.id}/headshot/silo/current`}
      onError={() => setImageFailed(true)} />}
    <span className="lab-player-copy"><span className="lab-player-tag">PLAYER RESEARCH</span>
      <span className="lab-player-name">{player.first}<strong>{player.last}</strong></span>
      <span className="lab-player-open">Open research <ArrowUpRight size={16} aria-hidden="true" /></span>
    </span>
  </button>;
}

function DiamondArt() {
  return <svg className="lab-tool-art" viewBox="0 0 180 100" fill="none" aria-hidden="true">
    <path d="M24 88A67 67 0 0 1 158 88L91 94Z" fill="currentColor" opacity=".06" />
    <path d="M24 88A67 67 0 0 1 158 88M42 88a49 49 0 0 1 98 0" stroke="currentColor" opacity=".3" strokeDasharray="3 4" />
    <path d="m91 90-29-29 29-29 29 29-29 29Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="m91 90-57-57m57 57 57-57" stroke="currentColor" opacity=".4" />
    <path d="M91 89q-8-44 34-64" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
    <circle cx="125" cy="25" r="5" fill="currentColor" /><circle cx="125" cy="25" r="10" stroke="currentColor" opacity=".3" />
    <path d="m91 30 4 4-4 4-4-4 4-4Zm29 27 4 4-4 4-4-4 4-4ZM62 57l4 4-4 4-4-4 4-4Z" fill="currentColor" />
  </svg>;
}

function TicketArt() {
  return <svg className="lab-tool-art" viewBox="0 0 180 100" fill="none" aria-hidden="true">
    <g transform="rotate(-12 90 55)"><rect x="57" y="9" width="74" height="94" rx="9" fill="currentColor" opacity=".08" />
      <rect x="57" y="9" width="74" height="94" rx="9" stroke="currentColor" opacity=".45" />
      {[32,52,72].map((y) => <g key={y}><circle cx="73" cy={y} r="5" stroke="currentColor" opacity=".7" /><path d={`M87 ${y-2}h28m-28 6h18`} stroke="currentColor" strokeWidth="2" opacity=".4" /></g>)}
    </g><path d="M42 35v-9h9m87 47v9h-9" stroke="currentColor" strokeWidth="2" />
    <path d="M43 59h99" stroke="currentColor" strokeWidth="2" />
  </svg>;
}

export function ResearchHome() {
  return <div className="lab-home">
    <div className="lab-section-heading"><div><span className="lab-eyebrow">THE RESEARCH ROOM</span><h2>Pick a player. Dig deeper.</h2></div><span className="lab-league">MLB</span></div>
    <div className="lab-player-grid-layout">{players.map((player) => <PlayerShortcut key={player.id} player={player} />)}</div>
    <div className="lab-section-heading lab-section-heading--tools"><h2>Your toolkit</h2><span>From context to a card</span></div>
    <div className="lab-tools">
      <button type="button" className="lab-tool lab-tool--green" onClick={() => go('slate')}>
        <span className="lab-tool-top"><span className="lab-icon-box"><Crosshair size={21} aria-hidden="true" /></span><ArrowUpRight size={19} aria-hidden="true" /></span>
        <DiamondArt /><strong>Matchup tools</strong><span>Pitchers, parks & weather</span>
      </button>
      <button type="button" className="lab-tool lab-tool--purple" onClick={() => go('slip')}>
        <span className="lab-tool-top"><span className="lab-icon-box"><ScanLine size={21} aria-hidden="true" /></span><ArrowUpRight size={19} aria-hidden="true" /></span>
        <TicketArt /><strong>Scan a slip</strong><span>A screenshot. A full breakdown.</span>
      </button>
    </div>
    <button type="button" className="lab-board-button" onClick={() => go('v2')}>
      <span className="lab-board-icon"><ChartNoAxesCombined size={24} aria-hidden="true" /></span>
      <span><strong>Explore the prop board</strong><small>Browse the model’s graded plays</small></span>
      <span className="lab-board-arrow"><ArrowRight size={21} aria-hidden="true" /></span>
    </button>
    <p className="lab-home-note"><Crosshair size={12} aria-hidden="true" /> Research first. Make your own call.</p>
  </div>;
}
