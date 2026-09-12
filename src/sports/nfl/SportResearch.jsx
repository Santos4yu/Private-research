import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BarChart3, CalendarDays, CheckCircle2,
  ChevronRight, CircleGauge, Clock3, CloudSun, Crosshair, Database, Dumbbell, HeartPulse,
  Home, MapPin, Search, Shield, ShieldQuestion, TrendingUp, UserRound, UsersRound, Wind,
} from 'lucide-react';
import { getSelectedSport, setSelectedSport } from '../sport-state';
import { NFL_PROP_DEFINITIONS } from './props';
import { filterNFLPlayers, gameStatValue, NFL_RECENT_KEY, propsForPosition, researchHealth, selectNextGame, summarizeLogs, teamLogoUrl, visibleGame } from './nfl-ui-core';

const SEASON = new Date().getMonth() < 2 ? new Date().getFullYear() - 1 : new Date().getFullYear();
const API = '/api/nfl';
const FEATURED_NAMES = ['Josh Allen', 'Justin Jefferson', 'Bijan Robinson', 'Travis Kelce'];

async function getNFL(resource, params = {}) {
  const query = new URLSearchParams({ season: String(SEASON), ...Object.fromEntries(Object.entries(params).filter(([, value]) => value != null && value !== '')) });
  const response = await fetch(`${API}/${resource}?${query}`, { credentials: 'same-origin' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body.data)) throw new Error(response.status === 401 ? 'Sign in to access live NFL research.' : 'Live NFL data is temporarily unavailable. Try again shortly.');
  return body;
}

function TeamLogo({ team, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  if (!team || failed) return <span className={`nfl-logo-fallback nfl-logo-${size}`} aria-label={team ? `${team} logo unavailable` : 'Team unavailable'}><ShieldQuestion aria-hidden="true" /></span>;
  return <img className={`nfl-team-logo nfl-logo-${size}`} src={teamLogoUrl(team)} alt={`${team} logo`} onError={() => setFailed(true)} />;
}

function PlayerPhoto({ player, featured = false }) {
  const [failed, setFailed] = useState(false);
  if (!player?.headshot_url || failed) return <span className={`nfl-player-fallback ${featured ? 'featured' : ''}`} aria-label="Player image unavailable"><UserRound aria-hidden="true" /></span>;
  return <img className={`nfl-player-photo ${featured ? 'featured' : ''}`} src={player.headshot_url} alt={`${player.name} headshot`} loading="lazy" onError={() => setFailed(true)} />;
}

function LeagueMark({ sport }) {
  return sport === 'mlb'
    ? <span className="sport-league-mark mlb" aria-hidden="true"><img src="/leagues/mlb.svg" alt="" /></span>
    : <span className="sport-league-mark nfl" aria-hidden="true"><img src="/leagues/nfl.svg" alt="" /></span>;
}

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
  try { return JSON.parse(localStorage.getItem(NFL_RECENT_KEY) || '[]'); } catch { return []; }
}

function saveRecent(player) {
  const next = [player, ...readRecent().filter((item) => item.id !== player.id)].slice(0, 6);
  localStorage.setItem(NFL_RECENT_KEY, JSON.stringify(next));
  return next;
}

function FeaturedCard({ player, onOpen }) {
  const last = player.last_name || player.name.split(' ').pop();
  const first = player.first_name || player.name.slice(0, -(last?.length || 0));
  return <button type="button" className="nfl-feature-card" onClick={() => onOpen(player)} aria-label={`Open research for ${player.name}`}>
    <span className="nfl-feature-grid" aria-hidden="true" /><TeamLogo team={player.team_id} size="watermark" />
    <span className="nfl-feature-kicker">PLAYER RESEARCH</span><PlayerPhoto player={player} featured />
    <span className="nfl-feature-copy"><small>{first}</small><strong>{last}</strong><em>{player.position} · {player.team_id || 'FREE AGENT'}</em><span>Open research <ArrowUpRight aria-hidden="true" /></span></span>
  </button>;
}

function NFLHome({ players, teams, loading, error, onOpen }) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(readRecent);
  const normalized = query.trim().toLowerCase();
  const results = filterNFLPlayers(players, query);
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
  return <div className="nfl-home">
    <header className="nfl-home-head"><span>NFL RESEARCH</span><h2>Find the player. Read the role.</h2><p>Real game logs, usage, opponent production, injuries, and game context.</p></header>
    <div className="nfl-player-search">
      <Search aria-hidden="true" /><label htmlFor="nfl-player-search">Search an NFL player</label>
      <input id="nfl-player-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search an NFL player" autoComplete="off" />
      {normalized.length >= 2 && <div className="nfl-search-results" role="listbox" aria-label="NFL players">
        {results.map((player) => <button type="button" role="option" key={player.id} onClick={() => open(player)}><PlayerPhoto player={player} /><span><strong>{player.name}</strong><small>{player.position} · {player.team_id || 'Free agent'}</small></span><TeamLogo team={player.team_id} size="sm" /></button>)}
        {!results.length && !loading && <Notice title="No players found">Try a full first or last name.</Notice>}
      </div>}
    </div>
    {loading && <LoadingCards label="Loading NFL players" />}
    {error && <Notice icon={AlertTriangle} title="NFL players unavailable" tone="error">{error}</Notice>}
    {!loading && !error && <>
      {recent.length > 0 && <section className="nfl-home-section"><div className="nfl-section-title"><div><span>YOUR HISTORY</span><h3>Recent players</h3></div><button type="button" onClick={() => { localStorage.removeItem(NFL_RECENT_KEY); setRecent([]); }}>Clear</button></div><div className="nfl-recent-row">{recent.map((player) => <button type="button" key={player.id} onClick={() => open(player)}><PlayerPhoto player={player} /><span><strong>{player.name}</strong><small>{player.position} · {player.team_id || 'FA'}</small></span></button>)}</div></section>}
      <section className="nfl-home-section"><div className="nfl-section-title"><div><span>START HERE</span><h3>Featured players</h3></div><small>{teams.length} teams connected</small></div><div className="nfl-feature-grid-layout">{featured.map((player) => <FeaturedCard key={player.id} player={player} onOpen={open} />)}</div></section>
      <section className="nfl-tool-strip"><article><CircleGauge aria-hidden="true" /><span><strong>Opportunity</strong><small>Snaps, volume and shares</small></span></article><article><Shield aria-hidden="true" /><span><strong>Opponent</strong><small>Measured defense results</small></span></article><article><HeartPulse aria-hidden="true" /><span><strong>Personnel</strong><small>Current injury reports</small></span></article></section>
    </>}
  </div>;
}

const TAB_ITEMS = [
  ['overview', 'Overview', CircleGauge], ['trend', 'Trend', TrendingUp], ['opportunity', 'Opportunity', Activity],
  ['matchup', 'Matchup', Crosshair], ['opponent', 'Opponent', Shield], ['environment', 'Game', CloudSun],
  ['injuries', 'Injuries', HeartPulse], ['health', 'Health', Database],
];

function Stat({ label, value, suffix = '', unavailable = false }) {
  const shown = unavailable || value == null ? 'NOT AVAILABLE' : `${typeof value === 'number' ? Number(value.toFixed(1)) : value}${suffix}`;
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

function OverviewPanel({ selectedProp, logs }) {
  const summary = summarizeLogs(logs, selectedProp.key);
  return <section className="nfl-panel-stack"><Notice icon={CheckCircle2} title="Measured results only">The projection engine and prop-line provider have not been built. Model fields remain unavailable.</Notice><div className="nfl-stat-grid"><Stat label="Season average" value={summary.average} /><Stat label="Season median" value={summary.median} /><Stat label="Games available" value={summary.games} /><Stat label="Prop line" unavailable /><Stat label="Model projection" unavailable /><Stat label="Projected edge" unavailable /><Stat label="Over probability" unavailable /><Stat label="Under probability" unavailable /><Stat label="Floor / ceiling" unavailable /><Stat label="Model certainty" unavailable /></div></section>;
}

function OpportunityPanel({ player, logs, usage }) {
  const stats = logs.map((log) => log.stats || {});
  const average = (key) => { const values = stats.map((row) => row[key]).filter(Number.isFinite); return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; };
  const avgShare = (key) => average(key) == null ? null : average(key) * 100;
  const snaps = usage?.data || [];
  const snapValues = snaps.map((row) => row.offense_snap_rate).filter(Number.isFinite);
  const snapRate = snapValues.length ? snapValues.reduce((a, b) => a + b, 0) / snapValues.length * 100 : null;
  const common = [<Stat key="snap" label="Snap %" value={snapRate} suffix="%" />];
  if (player.position === 'QB') common.push(<Stat key="att" label="Attempts / game" value={average('attempts')} />, <Stat key="rush" label="Rush attempts / game" value={average('carries')} />, <Stat key="drop" label="Dropbacks" unavailable />, <Stat key="design" label="Designed rushes" unavailable />);
  if (player.position === 'RB') common.push(<Stat key="carry" label="Carries / game" value={average('carries')} />, <Stat key="target" label="Targets / game" value={average('targets')} />, <Stat key="touch" label="Touches / game" value={average('carries') == null && average('receptions') == null ? null : (average('carries') || 0) + (average('receptions') || 0)} />, <Stat key="share" label="Carry share" unavailable />, <Stat key="rz" label="Red-zone usage" unavailable />);
  if (['WR', 'TE'].includes(player.position)) common.push(<Stat key="target" label="Targets / game" value={average('targets')} />, <Stat key="share" label="Target share" value={avgShare('target_share')} suffix="%" />, <Stat key="air" label="Air-yard share" value={avgShare('air_yards_share')} suffix="%" />, <Stat key="route" label="Routes" unavailable />, <Stat key="rr" label="Route participation" unavailable />, <Stat key="tprr" label="TPRR" unavailable />, <Stat key="rz" label="Red-zone target share" unavailable />);
  return <section className="nfl-panel-stack"><div className="nfl-stat-grid">{common}</div><EmptyFeature title="Advanced usage" reason="Routes, designed rushes, and red-zone shares require a current validated provider." /></section>;
}

function MatchupPanel() {
  return <section className="nfl-panel-stack"><Notice icon={Crosshair} title="Matchup model is not built">This page reserves the research structure without presenting a score or probability.</Notice><div className="nfl-stat-grid"><Stat label="Matchup score" unavailable /><Stat label="Usage / role" unavailable /><Stat label="Defense quality" unavailable /><Stat label="Coverage fit" unavailable /><Stat label="Route fit" unavailable /><Stat label="Alignment" unavailable /><Stat label="Trenches" unavailable /><Stat label="Game script" unavailable /><Stat label="Personnel" unavailable /><Stat label="Weather impact" unavailable /></div></section>;
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
  const health = researchHealth({ player, logsStatus: resources.logs?.status, usageStatus: resources.usage?.status, injuryStatus: resources.injuries?.status, scheduleStatus: resources.schedule?.status });
  const checks = [['Player identity', player?.id ? 'AVAILABLE' : 'MISSING'], ['Game logs', resources.logs?.status], ['Usage', resources.usage?.status], ['Injuries', resources.injuries?.status], ['Game context', resources.schedule?.status], ['Weather forecast', 'NOT AVAILABLE'], ['Prop line', 'NOT AVAILABLE']];
  return <section className="nfl-panel-stack"><div className={`nfl-health-score ${health.label.toLowerCase()}`}><Database aria-hidden="true" /><div><span>RESEARCH HEALTH</span><strong>{health.label}</strong><small>{health.coverage}% of currently connected research categories available</small></div></div><div className="nfl-health-list">{checks.map(([label, value]) => <p key={label}><span>{label}</span><strong className={value === 'AVAILABLE' ? 'available' : ''}>{value || 'UNAVAILABLE'}</strong></p>)}</div><p className="nfl-health-foot">Research health measures data completeness and freshness. It does not grade the player or predict a result.</p></section>;
}

function NFLPlayerResearch({ player, teams, schedules, onBack }) {
  const [selectedProp, setSelectedProp] = useState(() => propsForPosition(NFL_PROP_DEFINITIONS, player.position)[0]);
  const [tab, setTab] = useState('overview');
  const [windowKey, setWindowKey] = useState('l5');
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
      Promise.all([player.team_id, opponent].filter(Boolean).map((teamId) => getNFL('injuries', { team: teamId, week: nextGame?.week }))).then((parts) => ({ status: parts.some((part) => part.status === 'AVAILABLE') ? 'AVAILABLE' : 'MISSING', data: parts.flatMap((part) => part.data), fetchedAt: parts[0]?.fetchedAt })),
    ]).then((settled) => {
      if (!active) return;
      const [logs, usage, defense, injuries] = settled.map((item) => item.status === 'fulfilled' ? item.value : ({ status: 'UNRELIABLE', data: [], reason: item.reason?.message }));
      setResources((current) => ({ ...current, logs, usage, defense, injuries }));
      if (logs.status !== 'AVAILABLE') setError(logs.reason || 'Game logs are temporarily unavailable.');
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [player.id, player.team_id, matchup?.opponent?.id, nextGame?.week]);

  const props = propsForPosition(NFL_PROP_DEFINITIONS, player.position);
  const logs = resources.logs?.data || [];
  return <div className="nfl-research-page">
    <button type="button" className="nfl-back" onClick={onBack}><ArrowLeft aria-hidden="true" />NFL research</button>
    <header className="nfl-player-header"><div className="nfl-headshot-wrap"><PlayerPhoto player={player} /></div><div className="nfl-player-identity"><span>PLAYER RESEARCH</span><h2>{player.name}</h2><p>{player.position} · {team?.name || player.team_id || 'Free agent'} <TeamLogo team={player.team_id} size="sm" /></p><div className="nfl-player-chips"><span>{statusLabel(player.status)}</span>{nextGame && matchup && <span>{matchup.location === 'HOME' ? 'vs' : '@'} {matchup.opponent.id} · {new Date(nextGame.starts_at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>}</div></div></header>
    <section className="nfl-prop-selector"><div><span>RESEARCH PROP</span><small>No verified line provider connected</small></div><div role="listbox" aria-label="Player props">{props.map((prop) => <button type="button" role="option" aria-selected={selectedProp.key === prop.key} className={selectedProp.key === prop.key ? 'active' : ''} key={prop.key} onClick={() => setSelectedProp(prop)}><strong>{prop.label}</strong><small>Line unavailable</small></button>)}</div></section>
    <nav className="nfl-research-tabs" aria-label="NFL research sections">{TAB_ITEMS.map(([key, label, Icon]) => <button type="button" key={key} className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><Icon aria-hidden="true" /><span>{label}</span></button>)}</nav>
    {loading && <LoadingCards label="Loading player research" />}
    {error && <Notice icon={AlertTriangle} title="Some player data did not load" tone="error">{error}</Notice>}
    {!loading && <div className="nfl-tab-content">
      {tab === 'overview' && <OverviewPanel selectedProp={selectedProp} logs={logs} />}
      {tab === 'trend' && <TrendPanel logs={logs} selectedProp={selectedProp} windowKey={windowKey} setWindowKey={setWindowKey} next={nextGame ? { game: nextGame, teamId: player.team_id } : null} />}
      {tab === 'opportunity' && <OpportunityPanel player={player} logs={logs} usage={resources.usage} />}
      {tab === 'matchup' && <MatchupPanel />}
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
  const syncUrl = (nextSport, playerId = null, replace = false) => {
    const url = new URL(location.href); url.searchParams.set('sport', nextSport);
    if (nextSport === 'nfl' && playerId) url.searchParams.set('nflPlayer', playerId); else url.searchParams.delete('nflPlayer');
    history[replace ? 'replaceState' : 'pushState']({}, '', url);
  };
  const changeSport = (next) => { setSelectedSport(next); setSport(next); setSelectedPlayer(null); syncUrl(next); window.dispatchEvent(new CustomEvent('vortex:sport-change', { detail: { sport: next } })); };
  const openPlayer = (player) => { setSelectedPlayer(player); syncUrl('nfl', player.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const closePlayer = () => { setSelectedPlayer(null); syncUrl('nfl'); };
  useEffect(() => { document.documentElement.dataset.researchSport = sport; return () => { delete document.documentElement.dataset.researchSport; }; }, [sport]);
  useEffect(() => {
    if (sport !== 'nfl' || players.length) return;
    let active = true; setLoading(true); setError('');
    Promise.all([getNFL('players'), getNFL('teams'), getNFL('schedule', { seasonType: 'REG' })]).then(([playerResult, teamResult, scheduleResult]) => {
      if (!active) return; setPlayers(playerResult.data); setTeams(teamResult.data); setSchedules(scheduleResult.data);
    }).catch((reason) => active && setError(reason.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [sport, players.length]);
  useEffect(() => {
    if (!players.length || sport !== 'nfl') return;
    const requested = new URLSearchParams(location.search).get('nflPlayer');
    if (requested) setSelectedPlayer(players.find((player) => player.id === requested) || null);
    const pop = () => { const params = new URLSearchParams(location.search); const requestedPlayer = params.get('nflPlayer'); setSelectedPlayer(players.find((player) => player.id === requestedPlayer) || null); };
    window.addEventListener('popstate', pop); return () => window.removeEventListener('popstate', pop);
  }, [players, sport]);
  return <><SportSwitcher sport={sport} onChange={changeSport} />{sport === 'nfl' && <div className="nfl-app-shell">{selectedPlayer ? <NFLPlayerResearch player={selectedPlayer} teams={teams} schedules={schedules} onBack={closePlayer} /> : <NFLHome players={players} teams={teams} loading={loading} error={error} onOpen={openPlayer} />}</div>}</>;
}
