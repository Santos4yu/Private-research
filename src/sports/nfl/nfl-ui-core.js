export const NFL_RECENT_KEY = 'krazy-data:recent-players:nfl:v1';

export function teamLogoUrl(abbreviation) {
  const team = String(abbreviation || '').trim().toUpperCase();
  return team ? `https://static.www.nfl.com/t_q-best/league/api/clubs/logos/${encodeURIComponent(team)}.svg` : '';
}

export function propsForPosition(definitions, position) {
  return definitions.filter((definition) => definition.positions.includes(position));
}

export function filterNFLPlayers(players, query, limit = 12) {
  const normalized = String(query || '').trim().toLowerCase();
  if (normalized.length < 2) return [];
  return players.filter((player) => `${player.name} ${player.position} ${player.team_id || ''}`.toLowerCase().includes(normalized)).slice(0, limit);
}

export function visibleGame(game, teamId) {
  if (!game || !teamId) return null;
  if (game.home_team?.id === teamId) return { opponent: game.away_team, location: 'HOME' };
  if (game.away_team?.id === teamId) return { opponent: game.home_team, location: 'AWAY' };
  return null;
}

export function selectNextGame(games, teamId, now = new Date()) {
  const matching = games.filter((game) => visibleGame(game, teamId));
  const future = matching.filter((game) => game.status !== 'FINAL' && new Date(game.starts_at) >= now)
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  return future[0] || matching.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at))[0] || null;
}

export function gameStatValue(log, propKey) {
  const stat = log?.stats || {};
  const values = {
    passing_yards: stat.passing_yards,
    passing_attempts: stat.attempts,
    pass_completions: stat.completions,
    passing_touchdowns: stat.passing_tds,
    interceptions: stat.passing_interceptions,
    rushing_yards: stat.rushing_yards,
    rush_attempts: stat.carries,
    passing_rushing_yards: sumIfPresent(stat.passing_yards, stat.rushing_yards),
    receiving_yards: stat.receiving_yards,
    receptions: stat.receptions,
    targets: stat.targets,
    longest_reception: null,
    rushing_receiving_yards: sumIfPresent(stat.rushing_yards, stat.receiving_yards),
    touchdowns: sumIfPresent(stat.rushing_tds, stat.receiving_tds),
    fantasy_score: stat.fantasy_points_ppr ?? stat.fantasy_points,
  };
  const value = values[propKey];
  return Number.isFinite(value) ? value : null;
}

function sumIfPresent(...values) {
  const available = values.filter(Number.isFinite);
  return available.length ? available.reduce((sum, value) => sum + value, 0) : null;
}

export function summarizeLogs(logs, propKey) {
  const values = logs.map((log) => gameStatValue(log, propKey)).filter(Number.isFinite);
  if (!values.length) return { games: 0, average: null, median: null };
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  const median = ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
  return { games: values.length, average: values.reduce((sum, value) => sum + value, 0) / values.length, median };
}

export function researchHealth({ player, logsStatus, usageStatus, injuryStatus, scheduleStatus, lineAvailable = false, opportunityHealth }) {
  const checks = [Boolean(player?.id), logsStatus === 'AVAILABLE', usageStatus === 'AVAILABLE', injuryStatus === 'AVAILABLE', scheduleStatus === 'AVAILABLE'];
  if (opportunityHealth) checks.push(opportunityHealth.opportunityData === 'STRONG', ['MEDIUM', 'HIGH'].includes(opportunityHealth.roleCertainty), ['MEDIUM', 'HIGH'].includes(opportunityHealth.volumeCertainty), ['MEDIUM', 'HIGH'].includes(opportunityHealth.sampleReliability));
  const available = checks.filter(Boolean).length;
  const label = available >= 5 ? 'STRONG' : available >= 4 ? 'GOOD' : available >= 2 ? 'LIMITED' : 'UNRELIABLE';
  return { label, coverage: Math.round((available / checks.length) * 100), lineAvailable };
}
