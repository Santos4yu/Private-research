// The Finder's Analyze: the line on a player's page graded both ways the
// way the Slip Analyzer grades a pick -- today's board for what each
// defense allows, the league's matchup tables, his game's news (the injury
// report, lineups, who's out around him), what the results have taught the
// model -- then slip-check.js gradeLeg on each side. prop-insight.js writes
// it up.
import {loadLines, ENRICH} from './finder-pool.js';
import {loadMatchups, withMatchups} from './slip-matchup.js';
import {withPoolDefense} from './slip-analyst.js';
import {loadLearning} from './learning.js';
import {loadGames, loadTeammates, withGame} from './slip-games.js';
import {gradeLeg, relined, rewindow} from './slip-check.js';
import {loadSoccerOpponents, within} from './unified-finder-data.js';
import {projectStat} from './prop-model.js';
import {hasPlayerContext, leagueOf, playerContextParams, wnbaGet} from './sports/wnba/wnba-research.js';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const aborted = error => error?.name === 'AbortError';
// A part that can't load leaves the rest standing, as on the Slip Analyzer.
const optional = (promise, fallback) => promise.catch(error => { if (aborted(error)) throw error; return fallback; });

/**
 * A basketball player's chances (opportunity.js): his minutes, usage and
 * shares, his splits without each teammate, tonight's injury report and
 * (NBA) the league's tracking. The same requests his page makes, so
 * they're usually answered already. Null when there's no player context.
 */
async function loadOpportunity(row) {
  if (row.sport !== 'nba' && row.sport !== 'wnba') return null;
  const quiet = promise => promise.catch(() => null);
  const [context, matchup, tracking] = await Promise.all([
    hasPlayerContext(row) ? quiet(wnbaGet('player-context', playerContextParams(row))) : null,
    row.homeTeamAbbr && row.awayTeamAbbr && row.startsAt
      ? quiet(wnbaGet('matchup', {home: row.homeTeamAbbr, away: row.awayTeamAbbr, startsAt: row.startsAt, league: leagueOf(row)})) : null,
    row.sport === 'nba' && row.player ? quiet(wnbaGet('player-tracking', {name: row.player, team: row.teamAbbr, league: 'nba'})) : null,
  ]);
  if (!context?.opportunity?.szn) return null;
  return {chances: context.opportunity, withWithout: context.withWithout || [], injuries: matchup?.injuries?.[row.teamAbbr] || [], tracking};
}

const DEFAULTS = {loadLines, loadMatchups, loadLearning, loadGames, loadTeammates, loadSoccerOpponents, loadOpportunity, enrich: sport => ENRICH[sport]};

/**
 * The line at `line` (the one on the chart) for `row`'s player and stat:
 * his own line there when the board has it, else his games re-scored at it.
 */
async function lineAt(row, line, playerRows, {enrich, signal}) {
  if (!finite(line) || line === Number(row.line)) return row.windows ? row : rewindow({...row});
  const listed = playerRows.find(item => item.marketKey === row.marketKey && Number(item.line) === line
    && String(item.modifier || 'standard').toLowerCase() === 'standard' && item.windows);
  return listed || relined(row, line, {enrich, signal});
}

/**
 * {row, over, under}: the line graded on each side (either null when
 * there isn't enough to grade it). `step(key)` hears each stage as it
 * starts: 'games', 'matchup', 'odds', 'news', 'grade'.
 */
export async function gradeProp(row, {line = row?.line, playerRows = [], signal, step = () => {}, deps = {}} = {}) {
  const use = {...DEFAULTS, ...deps};
  const sport = row.sport;
  step('games');
  const enrich = use.enrich(sport);
  const [current, board, tables, , chances] = await Promise.all([
    lineAt(row, Number(line), playerRows, {enrich, signal}),
    optional(use.loadLines(sport, {signal, only: () => false}), []),
    optional(use.loadMatchups([sport], {signal}), {}),
    optional(Promise.resolve().then(() => use.loadLearning()), null),
    optional(Promise.resolve().then(() => use.loadOpportunity(row, {signal})), null),
  ]);
  step('matchup');
  // The board's copy of the line carries what its defense allows (and the
  // books' read moved to PrizePicks' number); his page's carries his games.
  const listed = board.find(item => item.id === current.id);
  let graded = listed ? {...listed, ...current} : current;
  if (sport === 'soccer') await optional(within(use.loadSoccerOpponents([graded], {signal}), 8000), null);
  // What each opponent gave players like him, from every line on the board
  // (slip-analyst.js), as the Slip Analyzer reads it.
  graded = withPoolDefense([graded, ...board.filter(item => item.id !== graded.id)].map(item => withMatchups(item, tables)))[0];
  step('odds');
  step('news');
  try {
    const games = await use.loadGames([{key: 'pick', row: graded}], {signal});
    if (games.pick) {
      const mates = await optional(use.loadTeammates([{key: 'pick', row: withGame(graded, games.pick)}], {signal}), {});
      graded = withGame(graded, {...games.pick, teammates: mates.pick || []});
    }
  } catch (error) { if (aborted(error)) throw error; }
  step('grade');
  // His chances against what the line takes (slip-matchup.js basketball).
  if (chances) {
    let model = null;
    try { model = projectStat(graded); } catch { model = null; }
    graded = {...graded, opportunity: {...chances, projected: model?.unit === 'min' ? model.usage : null}};
  }
  const over = gradeLeg({side: 'OVER'}, graded, tables);
  const standard = String(graded.modifier || 'standard').toLowerCase() === 'standard';
  const under = standard ? gradeLeg({side: 'UNDER'}, graded, tables) : null;
  return {row: graded, over, under};
}
