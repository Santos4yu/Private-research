import modelAudit from './model-status.json';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2,
  ChevronRight, CircleGauge, Clock3, CloudSun, Crosshair, Database, Dumbbell, HeartPulse,
  Home, MapPin, Search, Shield, ShieldQuestion, TrendingUp, UserRound, UsersRound, Wind,
} from 'lucide-react';
import { getSelectedSport, setSelectedSport } from '../sport-state';
import { NFL_PROP_DEFINITIONS } from './props';
import { NFLMatchupPanel } from './MatchupPanel';
import { NFLProjectionPanel } from './ProjectionPanel';
import { NFLDistributionPanel } from './DistributionPanel';
import { createNFLClient } from './nfl-client';
import { freshness } from './nfl-client';
import { ModelBadge } from './ModelBadge';
import { NFLValueBoard } from './ValueBoard';
import { NFLDecisionPanel } from './DecisionPanel';
import { filterNFLPlayers, gameStatValue, NFL_RECENT_KEY, propsForPosition, researchHealth, selectNextGame, summarizeLogs, teamLogoUrl, visibleGame } from './nfl-ui-core';

const SEASON = new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear();
const nflClient = createNFLClient();
const FEATURED_NAMES = ['Josh Allen', 'Justin Jefferson', 'Bijan Robinson', 'Travis Kelce'];

function getNFL(resource, params = {}) { return nflClient.get(resource, { season: String(SEASON), ...params }); }

function TeamLogo({ team, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team]);
  if (!team || failed) return <span className={`nfl-logo-fallback nfl-logo-${size}`} aria-label={team ? `${team} logo unavailable` : 'Team unavailable'}><ShieldQuestion aria-hidden="true" /></span>;
  return <img className={`nfl-team-logo nfl-logo-${size}`} src={teamLogoUrl(team)} alt={`${team} logo`} loading="lazy" decoding="async" width="40" height="40" onError={() => setFailed(true)} />;
}

function PlayerPhoto({ player, featured = false }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player?.headshot_url]);
  if (!player?.headshot_url || failed) return <span className={`nfl-player-fallback ${featured ? 'featured' : ''}`} aria-label="Player image unavailable"><UserRound aria-hidden="true" /></span>;
  return <img className={`nfl-player-photo ${featured ? 'featured' : ''}`} src={player.headshot_url} alt={`${player.name} headshot`} loading="lazy" decoding="async" width="200" height="200" onError={() => setFailed(true)} />;
}

function LeagueMark({ sport }) {
  return sport === 'mlb'
    ? <span className="sport-league-mark mlb" aria-hidden="true"><img src="/leagues/mlb.svg" alt="" /></span>
    : <span className="sport-league-mark nfl" aria-hidden="true"><img src="/leagues/nfl.svg" alt="" /></span>;
}

function propModelStatus(position, prop) { return modelAudit.models.find(model => model.position === position && model.propType === prop)?.pointStatus || 'NOT_AVAILABLE'; }

function statusLabel(status) {
  const labels = { ACT: 'Active', ACTIVE: 'Active', INA: 'Inactive', INACTIVE: 'Inactive', RES: 'Reserve', DEV: 'Practice squad', CUT: 'Free agent', IR: 'Injured reserve' };
  return labels[String(status || '').toUpperCase()] || (status ? String(status).replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Status unavailable');
}

function SportSwitcher({ sport, onChange }) {
  return <div className="sport-switch-shell" aria-label="Choose research sport">
    <span>SPORT</span>
    <div className="sport-switch" role="group">
      {['mlb', 'nfl'].map((value) => <button key={value} type="button" aria-pressed={sport === value} className={sport === value ? 'active' : ''} onClick={() => onChange(value)}>
        <LeagueMark sport={value} /><strong>{value.toUpperCase()}</strong>
      </button>)}
    </div>
  </div>;
}

function LoadingCards({ label = 'Loading NFL data' }) {
  return <div className="nfl-loading" role="status" aria-live="polite"><span className="nfl-spinner" /><strong>{label}</strong><div>{[1, 2, 3].map((item) => <i key={item} />)}</div></div>;
}

function Notice({ icon: Icon = Database, title, children, tone = 'muted' }) {
  return <div className={`nfl-notice ${tone}`}><span><Icon aria-hidden="true" /></span><div><strong>{title}</strong>{children && <p>{children}</p>}</div></div>;
}

function readRecent() {
  try { const value = JSON.parse(localStorage.getItem(NFL_RECENT_KEY) || '[]'); return Array.isArray(value) ? value.filter(item => item?.id && item?.name).slice(0,6) : []; } catch { return []; }
}

function saveRecent(player) {
  const next = [player, ...readRecent().filter((item) => item.id !== player.id)].slice(0, 6);
  try { localStorage.setItem(NFL_RECENT_KEY, JSON.stringify(next)); } catch { /* Storage can be disabled; research still opens. */ }
  return next;
}

function FeaturedCard({ player, onOpen }) {
  const last = player.last_name || player.name.split(' ').pop();
  const first = player.first_name || player.name.slice(0, -(last?.length || 0));
  return <button type="button" className="nfl-feature-card" onClick={() => onOpen(player)} aria-label={`Open research for ${player.name}`}>
    {player.team_id && <img className="nfl-feature-watermark" src={teamLogoUrl(player.team_id)} alt="" aria-hidden="true" loading="lazy" decoding="async" width="180" height="180" />}
    <span className="nfl-feature-grid" aria-hidden="true" /><TeamLogo team={player.team_id} size="watermark" />
    <span className="nfl-feature-kicker">PLAYER RESEARCH</span><PlayerPhoto player={player} featured />
    <span className="nfl-feature-copy"><small>{first}</small><strong>{last}</strong><em>{player.position} · {player.team_id || 'FREE AGENT'}</em><span>Open research <ArrowUpRight aria-hidden="true" /></span></span>
  </button>;
}

function NFLHome({ players, teams, loading, error, onOpen }) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(readRecent);
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { const timer = setTimeout(() => { setDebounced(query); setActiveIndex(-1); }, 150); return () => clearTimeout(timer); }, [query]);
  const normalized = debounced.trim().toLowerCase();
  const results = useMemo(() => filterNFLPlayers(players, debounced), [players, debounced]);
  const featured = useMemo(() => {
    const selected = FEATURED_NAMES.map((name) => players.find((player) => player.name === name && player.headshot_url)).filter(Boolean);
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      if (!selected.some((player) => player.position === position)) {
        const fallback = players.find((player) => player.position === position && player.headshot_url && !selected.some((item) => item.id === player.id));
        if (fallback) selected.push(fallback);
      }
    }
    return selected.slice(0, 4);
  }, [players]);
  const open = (player) => { setRecent(saveRecent(player)); onOpen(player); };
  const keySearch = (event) => {
    if (event.key === 'Escape') { setDismissed(true); setActiveIndex(-1); }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setDismissed(false); setActiveIndex(index => results.length ? (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length : -1); }
    if (event.key === 'Enter' && query === debounced && !dismissed && results[activeIndex]) { event.preventDefault(); open(results[activeIndex]); }
  };
  return <div className="nfl-home">
    <header className="nfl-home-head"><span>NFL RESEARCH</span><h2>Find the player. Read the role.</h2><p>Real game logs, usage, opponent production, injuries, and game context.</p></header>
    <div className="nfl-player-search">
      <Search aria-hidden="true" /><label htmlFor="nfl-player-search">Search an NFL player</label>
      <input id="nfl-player-search" type="search" value={query} onChange={(event) => { setQuery(event.target.value); setDismissed(false); }} onKeyDown={keySearch} role="combobox" aria-autocomplete="list" aria-expanded={normalized.length >= 2 && !dismissed} aria-controls="nfl-search-options" aria-activedescendant={activeIndex >= 0 && !dismissed ? `nfl-search-option-${activeIndex}` : undefined} placeholder="Search an NFL player" autoComplete="off" />
      {normalized.length >= 2 && !dismissed && <div id="nfl-search-options" className="nfl-search-results" role="listbox" aria-label="NFL players">
        {results.map((player, index) => <button id={`nfl-search-option-${index}`} aria-selected={activeIndex === index} type="button" role="option" key={player.id} onClick={() => open(player)}><PlayerPhoto player={player} /><span><strong>{player.name}</strong><small>{player.position} · {player.team_id || 'Free agent'}</small></span><TeamLogo team={player.team_id} size="sm" /></button>)}
        {!results.length && !loading && <Notice title="No players found">Try a full first or last name.</Notice>}
      </div>}
    </div>
    {loading && <LoadingCards label="Loading NFL players" />}
    {error && <Notice icon={AlertTriangle} title="NFL players unavailable" tone="error">{error}</Notice>}
    {!loading && players.length > 0 && <>
      {recent.length > 0 && <section className="nfl-home-section"><div className="nfl-section-title"><div><span>YOUR HISTORY</span><h3>Recent players</h3></div><button type="button" onClick={() => { localStorage.removeItem(NFL_RECENT_KEY); setRecent([]); }}>Clear</button></div><div className="nfl-recent-row">{recent.map((player) => <button type="button" key={player.id} onClick={() => open(player)}><PlayerPhoto player={player} /><span><strong>{player.name}</strong><small>{player.position} · {player.team_id || 'FA'}</small></span></button>)}</div></section>}
      <section className="nfl-home-section"><div className="nfl-section-title"><div><span>START HERE</span><h3>Featured players</h3></div><small>{teams.length} teams connected</small></div><div className="nfl-feature-grid-layout">{featured.map((player) => <FeaturedCard key={player.id} player={player} onOpen={open} />)}</div></section>
      <NFLValueBoard load={getNFL} /><section className="nfl-tool-strip"><article><CircleGauge aria-hidden="true" /><span><strong>Opportunity</strong><small>Snaps, volume and shares</small></span></article><article><Shield aria-hidden="true" /><span><strong>Opponent</strong><small>Measured defense results</small></span></article><article><HeartPulse aria-hidden="true" /><span><strong>Personnel</strong><small>Current injury reports</small></span></article></section>
    </>}
  </div>;
}

const TAB_ITEMS = [
  ['overview', 'Overview', CircleGauge], ['trend', 'Trend', TrendingUp], ['opportunity', 'Opportunity', Activity],
  ['matchup', 'Matchup', Crosshair], ['opponent', 'Opponent', Shield], ['environment', 'Game', CloudSun],
  ['injuries', 'Injuries', HeartPulse], ['health', 'Health', Database],
];

function Stat({ label, value, suffix = '', unavailable = false }) {
  const shown = unavailable || value == null || (typeof value === 'number' && !Number.isFinite(value)) ? 'NOT AVAILABLE' : `${typeof value === 'number' ? Number(value.toFixed(1)) : value}${suffix}`;
  return <article className={unavailable || value == null ? 'nfl-stat unavailable' : 'nfl-stat'}><span>{label}</span><strong>{shown}</strong></article>;
}

function EmptyFeature({ title, reason }) { return <Notice icon={Database} title={`${title} unavailable`}>{reason}</Notice>; }

function TrendPanel({ logs, selectedProp, windowKey, setWindowKey, next }) {
  let filtered = [...logs];
  if (windowKey === 'h2h' && next) filtered = filtered.filter((log) => log.opponent_team_id === visibleGame(next.game, next.teamId)?.opponent?.id);
  else if (windowKey !== 'season') filtered = filtered.slice(-Number(windowKey.slice(1)));
  const summary = summarizeLogs(filtered, selectedProp.key);
  const values = filtered.map((log) => gameStatValue(log, selectedProp.key));
  const max = Math.max(1, ...values.filter(Number.isFinite));
  return <section className="nfl-panel-stack">
    <div className="nfl-window-tabs" role="group" aria-label="Game sample">{['l5', 'l10', 'l15', 'l20', 'season', 'h2h'].map((key) => <button key={key} type="button" className={windowKey === key ? 'active' : ''} aria-pressed={windowKey === key} onClick={() => setWindowKey(key)}>{key === 'season' ? 'Season' : key.toUpperCase()}</button>)}</div>
    <div className="nfl-stat-grid four"><Stat label="Games" value={summary.games} /><Stat label="Average" value={summary.average} /><Stat label="Median" value={summary.median} /><Stat label="Hit rate / record" unavailable /></div>
    {!filtered.length ? <Notice title="No games found">There are no matching regular-season logs for this sample.</Notice> : <div className="nfl-chart-card"><div className="nfl-chart-head"><div><span>GAME LOG</span><h3>{selectedProp.label}</h3></div><small>Neutral bars · no verified prop line</small></div><div className="nfl-bars" style={{ '--bar-count': Math.max(filtered.length, 5) }}>{filtered.map((log, index) => { const value = values[index]; return <div className="nfl-bar-column" key={log.game_id}><span>{value ?? '—'}</span><i style={{ height: value == null ? '4px' : `${Math.max(8, (value / max) * 100)}%` }} /><TeamLogo team={log.opponent_team_id} size="xs" /><small>W{log.week}</small></div>; })}</div></div>}
  </section>;
}

function OverviewPanel({ selectedProp, logs, projection }) {
  const summary = summarizeLogs(logs, selectedProp.key);
  return <section className="nfl-panel-stack"><NFLProjectionPanel resource={projection} selectedProp={selectedProp} /><div className="nfl-stat-grid"><Stat label="Season average" value={summary.average} /><Stat label="Season median" value={summary.median} /><Stat label="Games available" value={summary.games} /><Stat label="Prop line" unavailable /><Stat label="Projected edge" unavailable /><Stat label="Over probability" unavailable /><Stat label="Under probability" unavailable /><Stat label="Floor / ceiling" unavailable /><Stat label="Model certainty" unavailable /></div></section>;
}

function OpportunityPanel({ opportunity }) {
  const data = opportunity?.data;
  if (opportunity?.status === 'LOADING') return <LoadingCards label="Building team volume and player opportunity" />;
  const labels = { expectedPlays: 'Expected plays', expectedTeamPassAttempts: 'Team pass attempts', expectedRushAttempts: 'Team rush attempts', expectedCalledRushAttempts: 'Called rushes (excludes scrambles)', expectedDrives: 'Expected offensive drives', expectedTargets: 'Expected targets', expectedCarries: 'Expected carries', expectedTouches: 'Expected touches', expectedPassAttempts: 'Expected pass attempts', expectedRoutes: 'Expected routes', expectedDropbacks: 'Expected dropbacks', expectedDesignedRushes: 'QB designed-rush proxy', expectedScrambles: 'Expected scrambles', expectedSnaps: 'Expected snaps', expectedKneels: 'Expected kneels' };
  if (!data?.player) return <EmptyFeature title="Opportunity estimate unavailable" reason={data?.reason || 'Required team and role inputs unavailable.'} />;
  const script = data.team.gameScript;
  const renderMetrics = (metrics) => <div className="nfl-stat-grid">{Object.entries(metrics).filter(([key]) => labels[key]).map(([key, metric]) => <div className="nfl-opportunity-metric" key={key}><Stat label={labels[key]} value={metric.mean} unavailable={metric.mean == null} /><small>{metric.reliability || metric.reason || metric.status} {metric.sample != null ? `· ${metric.sample} games` : ''}</small>{metric.share != null && <small>Role share {(metric.share * 100).toFixed(1)}%</small>}{metric.standardDeviation != null && <small>Observed variability ±{metric.standardDeviation.toFixed(1)} · not a prediction interval</small>}</div>)}</div>;
  return <section className="nfl-panel-stack">
    <Notice icon={Activity} title="Team volume + player opportunity">{data.player.roleStatus || 'UNCERTAIN'} role · {data.player.status.replaceAll('_', ' ')}. {data.player.reason || 'Volume estimates only; no final prop projection.'}</Notice>
    <h3>Team volume</h3>{renderMetrics(data.team)}
    <h3>Player role and opportunity</h3>{renderMetrics(data.player.metrics)}
    <Notice title="Play accounting">{data.team.accounting}</Notice>
    {script?.status === 'AVAILABLE' ? <div className="nfl-chart-card"><div className="nfl-section-title"><div><span>HISTORICAL SCORE STATES</span><h3>Play-calling profile</h3></div></div><div className="nfl-stat-grid">{Object.entries(script.states).map(([state, row]) => <div className="nfl-script-state" key={state}><strong>{state === 'CLOSE' ? 'Tied / close' : state === 'LEADING' ? 'Leading' : 'Trailing'}</strong><Stat label="Historical exposure" value={row.weight * 100} suffix="%" /><small>Dropback rate {(row.passRate * 100).toFixed(0)}%</small><small>{row.secondsPerPlay == null ? 'Pace unavailable' : `${row.secondsPerPlay.toFixed(0)} seconds between same-drive plays`}</small></div>)}</div><small>Earlier-game exposure; these are not forecast probabilities for this matchup.</small></div> : <EmptyFeature title="Score-state profile" reason={script?.reason || 'Insufficient score-state sample'} />}
    {!!data.scenarios?.length && <div className="nfl-chart-card"><h3>Conditional injury scenarios</h3>{data.scenarios.map((scenario, index) => <div className="nfl-scenario" key={index}><strong>{scenario.condition}</strong><small>{scenario.reason || scenario.status.replaceAll('_', ' ')}</small>{Object.entries(scenario.player?.metrics || {}).filter(([key, metric]) => labels[key] && metric.mean != null).map(([key, metric]) => <p key={key}>{labels[key]}: {metric.mean.toFixed(1)}</p>)}</div>)}<small>Scenario probabilities are unavailable. Confirm status before using conditional estimates.</small></div>}
    <EmptyFeature title="Routes and advanced roles" reason="Snaps are not routes. No validated route provider is connected. Vacated opportunity is redistributed only with verified historical participation evidence." />
    <small>Transformed nflverse data · volume model {data.modelVersion} · {data.fetchedAt ? `fetched ${new Date(data.fetchedAt).toLocaleString()}` : 'freshness unavailable'}</small>
  </section>;
}

function OpponentPanel({ defense, opponent }) {
  const rows = defense?.data || [];
  const avg = (key) => { const values = rows.map((row) => row.stats?.[key]).filter(Number.isFinite); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; };
  return <section className="nfl-panel-stack"><div className="nfl-match-title"><TeamLogo team={opponent?.id} size="lg" /><div><span>OPPONENT DEFENSE</span><h3>{opponent?.name || opponent?.id || 'Opponent pending'}</h3><small>{rows.length ? `${rows.length} regular-season games` : 'No defensive games available'}</small></div></div><div className="nfl-stat-grid"><Stat label="Pass yards allowed / game" value={avg('passing_yards_allowed')} /><Stat label="Pass attempts faced / game" value={avg('pass_attempts_faced')} /><Stat label="Rush yards allowed / game" value={avg('rushing_yards_allowed')} /><Stat label="Rush attempts faced / game" value={avg('rush_attempts_faced')} /><Stat label="Sacks / game" value={avg('sacks')} /><Stat label="Interceptions / game" value={avg('interceptions')} /><Stat label="Points allowed / game" value={avg('points_allowed')} /></div><EmptyFeature title="Coverage and EPA splits" reason="No reliable current free coverage provider is connected." /></section>;
}

function EnvironmentPanel({ game, player }) {
  const context = visibleGame(game, player.team_id);
  if (!game || !context) return <Notice icon={CalendarDays} title="No game found">A current or upcoming game is not available for this player.</Notice>;
  const home = game.home_team; const away = game.away_team;
  return <section className="nfl-panel-stack"><div className="nfl-game-matchup"><div><TeamLogo team={away.id} size="xl" /><strong>{away.id}</strong></div><span><small>WEEK {game.week}</small><b>@</b><em>{new Date(game.starts_at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</em></span><div><TeamLogo team={home.id} size="xl" /><strong>{home.id}</strong></div></div><div className="nfl-context-list"><p><Home aria-hidden="true" /><span>Player location</span><strong>{context.location === 'HOME' ? 'Home' : 'Away'}</strong></p><p><MapPin aria-hidden="true" /><span>Venue</span><strong>{game.venue || 'Not reported'}</strong></p><p><CloudSun aria-hidden="true" /><span>Roof</span><strong>{game.roof || 'Not reported'}</strong></p><p><Wind aria-hidden="true" /><span>Conditions</span><strong>{game.temperature_f == null && game.wind_mph == null ? 'Not available' : `${game.temperature_f ?? '—'}°F · ${game.wind_mph ?? '—'} mph`}</strong></p></div><div className="nfl-stat-grid four"><Stat label="Spread" unavailable /><Stat label="Game total" unavailable /><Stat label="Implied points" unavailable /><Stat label="Expected plays" unavailable /></div></section>;
}

const INJURY_GROUP = { QB: 'Offense', RB: 'Offense', WR: 'Offense', TE: 'Offense', C: 'Offense', G: 'Offense', T: 'Offense', OL: 'Offense', CB: 'Defense', DB: 'Defense', S: 'Defense', LB: 'Defense', EDGE: 'Defense', DE: 'Defense', DT: 'Defense', DL: 'Defense' };
function InjuriesPanel({ injuries }) {
  const rows = injuries?.data || [];
  return <section className="nfl-panel-stack">{['Offense', 'Defense'].map((unit) => { const unitRows = rows.filter((row) => INJURY_GROUP[row.position] === unit); return <div className="nfl-injury-unit" key={unit}><div className="nfl-section-title"><div><span>PERSONNEL</span><h3>{unit}</h3></div><small>{unitRows.length} reports</small></div>{unitRows.length ? unitRows.map((row, index) => <article key={`${row.player_id}-${row.team_id}-${index}`}><span className={`nfl-status-dot ${(row.game_status || '').toLowerCase()}`} /><div><strong>{row.player_name}</strong><small>{row.position} · {row.team_id} · {row.injury || 'Injury not specified'}</small></div><em>{row.game_status || row.practice_status || 'Not reported'}</em></article>) : <Notice title={`No ${unit.toLowerCase()} reports`}>No current injury rows were returned for these teams.</Notice>}</div>; })}</section>;
}

function HealthPanel({ player, resources }) {
  const health = researchHealth({ player, logsStatus: resources.logs?.status, usageStatus: resources.usage?.status, injuryStatus: resources.injuries?.status, scheduleStatus: resources.schedule?.status, opportunityHealth: resources.opportunity?.data?.health || {} });
  const opportunityHealth = resources.opportunity?.data?.health || {};
  const checks = [['Player identity', player?.id ? 'AVAILABLE' : 'MISSING'], ['Data freshness', freshness(resources.logs?.fetchedAt)], ['Game logs', resources.logs?.status], ['Usage', resources.usage?.status], ['Injuries', resources.injuries?.status], ['Game context', resources.schedule?.status], ['Opportunity engine', resources.opportunity?.data?.status], ['Opportunity data', opportunityHealth.opportunityData], ['Role certainty', opportunityHealth.roleCertainty], ['Volume certainty', opportunityHealth.volumeCertainty], ['Sample reliability', opportunityHealth.sampleReliability], ['Injury certainty', opportunityHealth.injuryCertainty], ['Matchup reliability', resources.matchup?.data?.sampleReliability], ['Distribution status', resources.distribution?.data?.promotion || resources.distribution?.data?.status], ['Model health', resources.decision?.data?.health], ['Weather forecast', 'NOT AVAILABLE'], ['Prop line', 'NOT AVAILABLE']];
  return <section className="nfl-panel-stack"><div className={`nfl-health-score ${health.label.toLowerCase()}`}><Database aria-hidden="true" /><div><span>RESEARCH HEALTH</span><strong>{health.label}</strong><small>{health.coverage}% of currently connected research categories available</small></div></div><div className="nfl-health-list">{checks.map(([label, value]) => <p key={label}><span>{label}</span><strong className={value === 'AVAILABLE' ? 'available' : ''}>{value || 'UNAVAILABLE'}</strong></p>)}</div><p className="nfl-health-foot">Research health measures data completeness and freshness. It does not grade the player or predict a result.</p></section>;
}

function NFLPlayerResearch({ player, teams, schedules, onBack }) {
  const [selectedProp, setSelectedProp] = useState(() => propsForPosition(NFL_PROP_DEFINITIONS, player.position)[0]);
  const [tab, setTab] = useState('overview');
  const [windowKey, setWindowKey] = useState('l5');
  const [refreshKey, setRefreshKey] = useState(0);
  const [resources, setResources] = useState({ schedule: { status: 'AVAILABLE', data: schedules } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const nextGame = selectNextGame(schedules, player.team_id);
  const matchup = visibleGame(nextGame, player.team_id);
  const team = teams.find((item) => item.id === player.team_id);

  useEffect(() => {
    let active = true; setLoading(true); setError('');
    const opponent = matchup?.opponent?.id;
    Promise.allSettled([
      getNFL('game-logs', { playerId: player.id, seasonType: 'REG' }),
      getNFL('usage', { playerId: player.id }),
      opponent ? getNFL('defense', { team: opponent, seasonType: 'REG' }) : Promise.resolve({ status: 'MISSING', data: [] }),
      Promise.allSettled([player.team_id, opponent].filter(Boolean).map((teamId) => getNFL('injuries', { team: teamId, week: nextGame?.week }))).then((results) => {
        const parts = results.filter(item => item.status === 'fulfilled').map(item => item.value);
        return { status: results.some(item => item.status === 'rejected') ? 'UNRELIABLE' : parts.some(part => part.status === 'AVAILABLE') ? 'AVAILABLE' : 'MISSING', data: parts.flatMap(part => part.data || []), fetchedAt: parts[0]?.fetchedAt };
      }),
    ]).then((settled) => {
      if (!active) return;
      const [logs, usage, defense, injuries] = settled.map((item) => item.status === 'fulfilled' ? item.value : ({ status: 'UNRELIABLE', data: [], reason: item.reason?.message }));
      setResources((current) => ({ ...current, logs, usage, defense, injuries }));
      if (logs.status !== 'AVAILABLE') setError(logs.reason || 'Game logs are temporarily unavailable.');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [player.id, player.team_id, matchup?.opponent?.id, nextGame?.week, refreshKey]);

  useEffect(() => {
    let active = true;
    setResources((current) => ({ ...current, opportunity: { status: 'LOADING' } }));
    getNFL('opportunity', { playerId: player.id, week: nextGame?.week }).then((opportunity) => {
      if (active) setResources((current) => ({ ...current, opportunity }));
    }).catch(() => {
      if (active) setResources((current) => ({ ...current, opportunity: { data: { status: 'NOT_AVAILABLE', reason: 'Required opportunity sources did not load. No estimate has been fabricated.' } } }));
    });
    return () => { active = false; };
  }, [player.id, nextGame?.week, refreshKey]);

  useEffect(() => {
    if (tab !== 'matchup') return;
    let active = true;
    setResources((current) => ({ ...current, matchup: { status: 'LOADING' } }));
    getNFL('matchup', { playerId: player.id, week: nextGame?.week, prop: selectedProp.key }).then((matchup) => {
      if (active) setResources((current) => ({ ...current, matchup }));
    }).catch(() => {
      if (active) setResources((current) => ({ ...current, matchup: { data: { status: 'NOT_AVAILABLE', reason: 'Required matchup sources did not load. No score was fabricated.' } } }));
    });
    return () => { active = false; };
  }, [tab, player.id, nextGame?.week, selectedProp.key, refreshKey]);

  useEffect(() => {
    if (tab !== 'overview') return;
    let active = true;
    setResources((current) => ({ ...current, projection: { status: 'LOADING' } }));
    getNFL('projection', { playerId: player.id, week: nextGame?.week, prop: selectedProp.key }).then((projection) => {
      if (active) setResources((current) => ({ ...current, projection }));
    }).catch(() => {
      if (active) setResources((current) => ({ ...current, projection: { data: { status: 'NOT_AVAILABLE', reason: 'Required statistical model inputs did not load. No value was fabricated.' } } }));
    });
    setResources((current)=>({...current,distribution:{status:'LOADING'}}));
    setResources(current=>({...current,decision:{status:'LOADING'}}));
    getNFL('decision',{playerId:player.id,position:player.position,prop:selectedProp.key}).then(decision=>{
      if(active)setResources(current=>({...current,decision}));
    }).catch(()=>{if(active)setResources(current=>({...current,decision:{data:null}}));});
    getNFL('distribution',{playerId:player.id,week:nextGame?.week,prop:selectedProp.key}).then((distribution)=>{
      if(active)setResources(current=>({...current,distribution}));
    }).catch(()=>{if(active)setResources(current=>({...current,distribution:{data:{status:'NOT_AVAILABLE'}}}));});
    return () => { active = false; };
  }, [tab, player.id, nextGame?.week, selectedProp.key, refreshKey]);

  const props = propsForPosition(NFL_PROP_DEFINITIONS, player.position);
  const logs = resources.logs?.data || [];
  return <div className="nfl-research-page">
    <button type="button" className="nfl-refresh" onClick={() => { nflClient.clear(); setRefreshKey(key => key + 1); }}>Refresh current research</button>
    <button type="button" className="nfl-back" onClick={onBack}><ArrowLeft aria-hidden="true" />NFL research</button>
    <header className="nfl-player-header"><div className="nfl-headshot-wrap"><PlayerPhoto player={player} /></div><div className="nfl-player-identity"><span>PLAYER RESEARCH</span><h2>{player.name}</h2><p>{player.position} · {team?.name || player.team_id || 'Free agent'} <TeamLogo team={player.team_id} size="sm" /></p><div className="nfl-player-chips"><span>{statusLabel(player.status)}</span>{nextGame && matchup && <span>{matchup.location === 'HOME' ? 'vs' : '@'} {matchup.opponent.id} · {new Date(nextGame.starts_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}</div></div></header>
    <section className="nfl-prop-selector"><div><span>RESEARCH PROP</span><small>No verified line provider connected</small></div><div role="listbox" aria-label="Player props">{props.map((prop) => <button type="button" role="option" aria-selected={selectedProp.key === prop.key} className={selectedProp.key === prop.key ? 'active' : ''} key={prop.key} onClick={() => setSelectedProp(prop)}><strong>{prop.label}</strong><ModelBadge status={propModelStatus(player.position, prop.key)} /><small>Line unavailable</small></button>)}</div></section>
    <nav className="nfl-research-tabs" aria-label="NFL research sections">{TAB_ITEMS.map(([key, label, Icon]) => <button type="button" key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><Icon aria-hidden="true" /><span>{label}</span></button>)}</nav>
    {loading && <LoadingCards label="Loading player research" />}
    {error && <Notice icon={AlertTriangle} title="Some player data did not load" tone="error">{error}</Notice>}
    {!loading && <div className="nfl-tab-content">
      {tab === 'overview' && <OverviewPanel selectedProp={selectedProp} logs={logs} projection={resources.projection} />}
      {tab === 'overview' && <NFLDistributionPanel resource={resources.distribution} propKey={selectedProp.key} />}
      {tab === 'overview' && <NFLDecisionPanel resource={resources.decision} propKey={selectedProp.key} />}
      {tab === 'trend' && <TrendPanel logs={logs} selectedProp={selectedProp} windowKey={windowKey} setWindowKey={setWindowKey} next={nextGame ? { game: nextGame, teamId: player.team_id } : null} />}
      {tab === 'opportunity' && <OpportunityPanel opportunity={resources.opportunity} />}
      {tab === 'matchup' && <NFLMatchupPanel resource={resources.matchup} selectedProp={selectedProp} />}
      {tab === 'opponent' && <OpponentPanel defense={resources.defense} opponent={matchup?.opponent} />}
      {tab === 'environment' && <EnvironmentPanel game={nextGame} player={player} />}
      {tab === 'injuries' && <InjuriesPanel injuries={resources.injuries} />}
      {tab === 'health' && <HealthPanel player={player} resources={resources} />}
    </div>}
  </div>;
}

export function SportResearch() {
  const [sport, setSport] = useState(() => new URLSearchParams(location.search).get('sport') === 'nfl' ? 'nfl' : getSelectedSport());
  const [players, setPlayers] = useState([]); const [teams, setTeams] = useState([]); const [schedules, setSchedules] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const syncUrl = (nextSport, playerId = null, replace = false) => {
    const url = new URL(location.href); url.searchParams.set('sport', nextSport);
    if (nextSport === 'nfl' && playerId) url.searchParams.set('nflPlayer', playerId); else url.searchParams.delete('nflPlayer');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
  };
  const changeSport = (next) => { nflClient.clear(); setSelectedSport(next); setSport(next); setSelectedPlayer(null); syncUrl(next); window.dispatchEvent(new CustomEvent('vortex:sport-change', { detail: { sport: next } })); };
  const openPlayer = (player) => { setSelectedPlayer(player); syncUrl('nfl', player.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const closePlayer = () => { setSelectedPlayer(null); syncUrl('nfl'); };
  useEffect(() => { document.documentElement.dataset.researchSport = sport; return () => { delete document.documentElement.dataset.researchSport; }; }, [sport]);
  useEffect(() => {
    if (sport !== 'nfl') return;
    let active = true; setLoading(true); setError('');
    Promise.allSettled([getNFL('players'), getNFL('teams'), getNFL('schedule', { seasonType: 'REG' })]).then((parts) => {
      if (!active) return;
      const data = parts.map(part => part.status === 'fulfilled' ? part.value.data : []);
      setPlayers(data[0]); setTeams(data[1]); setSchedules(data[2]);
      if (parts.some(part => part.status === 'rejected')) setError('A data source is temporarily unavailable. Unaffected research remains accessible.');
    }).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [sport, reloadKey]);
  useEffect(() => {
    if (!players.length || sport !== 'nfl') return;
    const requested = new URLSearchParams(location.search).get('nflPlayer');
    if (requested) setSelectedPlayer(players.find((player) => player.id === requested) || null);
    const pop = () => { const params = new URLSearchParams(location.search); const requestedPlayer = params.get('nflPlayer'); setSelectedPlayer(players.find((player) => player.id === requestedPlayer) || null); };
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, [players, sport]);
  return <><SportSwitcher sport={sport} onChange={changeSport} />{sport === 'nfl' && <div className="nfl-app-shell">{error && <button className="nfl-refresh" type="button" onClick={() => { nflClient.clear(); setReloadKey(key => key + 1); }}>Retry data sources</button>}{selectedPlayer ? <NFLPlayerResearch key={selectedPlayer.id} player={selectedPlayer} teams={teams} schedules={schedules} onBack={closePlayer} /> : <NFLHome players={players} teams={teams} loading={loading} error={error} onOpen={openPlayer} />}<p className="nfl-disclaimer">Vortex provides statistical research and model estimates. Outcomes are uncertain; projections are not guarantees. Transformed <a href="https://github.com/nflverse/nflverse-data">nflverse data</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.</p></div>}</>;
}
