import React, { useEffect, useState } from 'react';
import { matchupNumber, matchupUpdatedText } from './matchup-rating.js';
import { ArrowRight, ArrowUpRight, Crosshair, ScanLine, ChartNoAxesCombined } from 'lucide-react';

const go = (tab) => window.dispatchEvent(new CustomEvent('vortex:switch-tab', { detail: { tab } }));

// Shown whenever the board has no graded matchup yet -- unchanged from
// before, same two players, same fixed blue/silver look.
const FALLBACK_PLAYERS = [
  { name: 'Shohei Ohtani', first: 'Shohei', last: 'Ohtani', id: 660271, position: 'TWP', color: 'blue' },
  { name: 'Aaron Judge', first: 'Aaron', last: 'Judge', id: 592450, position: 'OF', color: 'silver' },
];

const matchupBand = (score) => score >= 75 ? 'strong' : score >= 65 ? 'favorable' : score >= 55 ? 'slight' : score >= 45 ? 'neutral' : score >= 35 ? 'caution' : 'unfavorable';

const teamLogoUrl = (teamId) => teamId ? `https://www.mlbstatic.com/team-logos/${Number(teamId)}.svg` : '';

// Pulls the same /api/board feed the Matchup tab itself reads (data.
// matchup_research), so "top matchup" here is exactly what that tab
// would rank first -- not a second, separately-tuned ranking.
function useTopMatchups() {
  const [players, setPlayers] = useState(null);
  useEffect(() => {
    let active = true;
    fetch('/api/board', { cache: 'no-store' }).then((res) => res.json()).then((data) => {
      if (!active) return;
      const rows = [...(data?.matchup_research || []), ...(data?.pitcher_research || []), ...(data?.props || [])].filter((row) =>
        (row.sport || 'MLB') === 'MLB'
        && Number.isFinite(matchupNumber(row.stats?.matchup_score))
        && Number.isInteger(Number(row.stats?.player_id)));
      rows.sort((a, b) => Number(b.stats.matchup_score) - Number(a.stats.matchup_score));
      const seen = new Set();
      const top = [];
      for (const row of rows) {
        const key = String(row.player_name || '').trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const stats = row.stats || {};
        const [first, ...rest] = String(row.player_name).trim().split(/\s+/);
        const opponentAbbr = stats.opponent_abbr || stats.opponent || stats.matchup?.opponent || '';
        top.push({
          name: row.player_name,
          first,
          last: rest.join(' ') || first,
          id: Number(stats.player_id),
          position: stats.position || '',
          matchupScore: Math.round(Number(stats.matchup_score)),
          matchupLabel: stats.matchup_label,
          matchupContext: stats.matchup_context,
          teamId: stats.team_id || null,
          opponentTeamId: stats.opponent_team_id || null,
          opponentAbbr,
          isHome: Boolean(stats.is_home),
          commenceTime: row.commence_time || null,
          statType: row.stat_type || '',
          line: row.line ?? null,
          side: stats.side === 'under' ? 'U' : 'O',
        });
        if (top.length >= 2) break;
      }
      setPlayers(top);
    }).catch(() => { if (active) setPlayers([]); });
    return () => { active = false; };
  }, []);
  return players;
}

function MatchupCard({ player, accentRank }) {
  const [imageFailed, setImageFailed] = useState(false);
  const gameDate = player.commenceTime ? new Date(player.commenceTime) : null;
  const dateStr = gameDate ? gameDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const matchupLine = player.opponentAbbr ? `${player.isHome ? 'vs' : '@'} ${player.opponentAbbr}` : 'MLB';
  const propLine = player.statType ? `${player.statType}${player.line != null ? ` • ${player.side} ${player.line}` : ''}` : '';
  return <button type="button" className={`lab-matchup-card lab-matchup-card--accent-${accentRank}`}
    aria-label={`Research ${player.name}`}
    onClick={() => window.dispatchEvent(new CustomEvent('vortex:research-player', { detail: player }))}>
    <span className="lab-matchup-head">
      <span className="lab-matchup-context"><b>{matchupLine}</b>{dateStr && <small>{dateStr}</small>}</span>
      <span className="lab-matchup-more" aria-hidden="true">⋮</span>
    </span>
    <span className="lab-matchup-photo-wrap">
      {!imageFailed && <img className="lab-matchup-photo" alt="" width="300" height="300"
        src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_480,q_auto,f_auto/v1/people/${player.id}/headshot/silo/current`}
        onError={() => setImageFailed(true)} />}
    </span>
    <span className="lab-matchup-name">{player.first}<strong>{player.last}</strong></span>
    {propLine && <span className="lab-matchup-prop">{propLine}</span>}
    <span className="lab-matchup-meter">
      <span className="lab-matchup-meter-label">MATCHUP SCORE</span>
      <span className="lab-matchup-meter-track"><span className="lab-matchup-meter-fill" data-band={matchupBand(player.matchupScore)} style={{ width: `${player.matchupScore}%` }} /></span>
      <span className="lab-matchup-meter-score" title={`${player.matchupLabel || 'Matchup rating'} · ${matchupUpdatedText(player.matchupContext)} · Not a win probability`}>{player.matchupScore} <small>/ 100</small></span>
    </span>
    <span className="lab-matchup-foot">
      <span className="lab-matchup-icons">
        {player.teamId && <img className="lab-matchup-icon" src={teamLogoUrl(player.teamId)} alt="" loading="lazy" />}
        {player.opponentTeamId && <img className="lab-matchup-icon" src={teamLogoUrl(player.opponentTeamId)} alt="" loading="lazy" />}
        {!imageFailed && <img className="lab-matchup-icon lab-matchup-icon--head" alt=""
          src={`https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${player.id}/headshot/67/current`} />}
      </span>
      <span className="lab-matchup-open">Open research <ArrowUpRight size={14} aria-hidden="true" /></span>
    </span>
  </button>;
}

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
    <span className="lab-player-copy">
      <span className="lab-player-tag">PLAYER RESEARCH</span>
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
  const topMatchups = useTopMatchups();
  // Three states: still loading (null -- show skeletons, never the
  // fallback players, so Ohtani/Judge don't flash in before the real
  // matchups arrive on every refresh), loaded with real matchups, or
  // loaded-but-empty (only then does the Ohtani/Judge fallback show).
  const isLoading = topMatchups === null;
  const showMatchups = Boolean(topMatchups && topMatchups.length);
  const players = showMatchups ? topMatchups : FALLBACK_PLAYERS;
  return <div className="lab-home">
    <div className="lab-section-heading"><div><span className="lab-eyebrow">THE RESEARCH ROOM</span><h2>{isLoading ? 'Loading today’s matchups…' : showMatchups ? "Today's top matchups." : 'Pick a player. Dig deeper.'}</h2></div><span className="lab-league">MLB</span></div>
    <div className="lab-player-grid-layout">{isLoading
      ? [0, 1].map((i) => <span key={i} className="lab-matchup-card lab-matchup-card--skeleton" aria-hidden="true" />)
      : players.map((player, i) => showMatchups
        ? <MatchupCard key={player.id} player={player} accentRank={i} />
        : <PlayerShortcut key={player.id} player={player} />)}</div>
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
