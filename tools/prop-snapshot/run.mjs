// The prop snapshot job (Phase 0 of the NBA prop model work; prop_snapshots.py).
// Grades every NBA line the Props tab lists with the site's own code -- the
// same modules a member's browser runs, unchanged -- on the data a member's
// tab reads, and posts each line's Over and Under grade, projection,
// DraftKings price, lineup read and the inputs' times to the site.
// .github/workflows/nba-prop-snapshot.yml runs it on a schedule before the
// night's games. It changes nothing on the site.
//
//   node tools/prop-snapshot/run.mjs           grade and post
//   node tools/prop-snapshot/run.mjs --dry     grade and print, post nothing
//
// GitHub's signed token for the workflow (snapshot_runner.py) is its only
// credential. SITE overrides the site's address.
import {createHash} from 'node:crypto';
import {readFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SITE = process.env.SITE || 'https://aceprops.xyz';
const AUDIENCE = 'aceprops-nba-prop-snapshot';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = join(ROOT, 'src');
const DRY = process.argv.includes('--dry');
const startedAt = new Date().toISOString();
const problems = [];
const finite = value => typeof value === 'number' && Number.isFinite(value);
const round = (value, digits = 4) => finite(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null;

// ------------------------------------------------------------ requests

const realFetch = globalThis.fetch;
let token = null, tokenAt = 0;
async function signed() {
  if (token && Date.now() - tokenAt < 4 * 60 * 1000) return token;
  const base = process.env.ACTIONS_ID_TOKEN_REQUEST_URL, bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!base || !bearer) throw new Error('GitHub token unavailable: run inside the workflow');
  const response = await realFetch(`${base}&audience=${AUDIENCE}`, {headers: {Authorization: `bearer ${bearer}`}});
  if (!response.ok) throw new Error(`GitHub token request failed (${response.status})`);
  token = (await response.json()).value;
  tokenAt = Date.now();
  return token;
}

// What each source said and when, as the grades read it.
const seen = {calls: 0, failed: [], times: {}};
const WATCH = [['board', /resource=board|league=nba&fast=1$/], ['league', /resource=league-context/], ['tonight', /resource=tonight/],
  ['books', /resource=book-props/], ['learning', /action=learning/]];
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input), SITE);
  // Browser-only options Node doesn't take.
  const {credentials, cache, ...rest} = init;
  const headers = {...(rest.headers || {}), 'X-GitHub-OIDC': await signed(), 'User-Agent': 'PropScout prop snapshot (GitHub Actions)'};
  seen.calls += 1;
  const response = await realFetch(url, {...rest, headers});
  if (!response.ok) seen.failed.push(`${url.pathname}?${url.searchParams.get('resource') || url.searchParams.get('action') || ''} ${response.status}`);
  const watched = WATCH.find(([, pattern]) => pattern.test(url.search));
  if (watched && response.ok) {
    response.clone().json().then(body => {
      seen.times[watched[0]] = body?.fetchedAt || body?.at || response.headers.get('date');
    }).catch(() => {});
  }
  return response;
};
// A browser's background save (no IndexedDB here) must not stop the run.
process.on('unhandledRejection', error => { problems.push(`Background step failed: ${error?.message || error}`); });

// ------------------------------------------------------------ the model's version

/** Every module the grade imports, followed from the entry points. */
function closure(entries) {
  const found = new Map();
  const visit = file => {
    if (found.has(file) || !existsSync(file)) return;
    const text = readFileSync(file, 'utf8');
    found.set(file, text);
    for (const match of text.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.[^'"]+)['"]/g)) {
      let next = resolve(dirname(file), match[1]);
      if (!/\.(m?js|jsx)$/.test(next)) next = existsSync(`${next}.js`) ? `${next}.js` : `${next}.jsx`;
      visit(next);
    }
  };
  entries.forEach(entry => visit(join(SRC, entry)));
  return found;
}
const ENTRIES = ['nba-props-data.js', 'finder-pool.js', 'props-lines.js', 'unified-finder-data.js', 'nba-matchup-score.js', 'props-grade.js',
  'slip-check.js', 'learning.js', 'book-props.js', 'lineup-role.js'];
const files = closure(ENTRIES);
const modelHash = createHash('sha256');
[...files.keys()].sort().forEach(file => modelHash.update(file.slice(ROOT.length)).update('\0').update(files.get(file)).update('\0'));
const model = {hash: modelHash.digest('hex').slice(0, 12), files: files.size};

// ------------------------------------------------------------ grade

const load = name => import(join(SRC, name));
const [{wanted}, {loadLines}, {pickLines}, {loadFinderDefense, loadTonight}, {spreadScores}, {propGrades, withTonight},
  {gradeLeg, baselineOf}, {loadLearning, learned}, {loadBookProps, bookChance}, {lineupRole}] = await Promise.all(ENTRIES.map(load));

const side = graded => graded && finite(graded.chance) ? [round(graded.chance), round(graded.rawChance), round(graded.trendChance), graded.tier || null,
  graded.capped || null, round(baselineOf(graded)), round(graded.book), round(graded.history), round(graded.read?.projected),
  round(graded.read?.model?.weight), graded.backed ? 1 : 0] : null;

async function main() {
  const board = await loadLines('nba', {only: wanted});
  const rows = pickLines(board.filter(wanted));
  if (!rows.length) {
    // No NBA lines up (a night without games, or all started): nothing to keep.
    console.log(JSON.stringify({lines: 0, board: board.length, note: 'No NBA lines to grade now'}));
    return;
  }
  const [leagueData, tonight] = await Promise.all([loadFinderDefense('nba').catch(error => { problems.push(`League numbers failed: ${error.message}`); return null; }),
    loadTonight().catch(error => { problems.push(`Injury reports failed: ${error.message}`); return null; })]);
  const teams = Object.keys(leagueData?.dvp || {}).length;
  if (teams < 25) problems.push(`League numbers cover ${teams} teams (the list needs 25): grades would wait on a member's tab`);
  // As MatchupList.jsx: tonight's injury reports ride with the league numbers.
  const league = leagueData && tonight?.teams ? {...leagueData, tonight} : leagueData;
  await loadLearning();
  const calibration = learned();
  if (!calibration) problems.push('The calibration (learning.js) did not load: grades are uncalibrated this run');
  const books = await loadBookProps();
  if (!Object.keys(books || {}).length) problems.push('DraftKings prices were not available this run');
  const scores = league ? spreadScores(rows, league) : new Map();
  const grades = league ? propGrades(rows, league) : new Map();

  const out = [];
  let ungraded = 0, mismatched = 0, waiting = 0;
  const errors = new Set();
  const reportTeams = new Set(Object.keys(tonight?.teams || {}));
  const missingReports = new Set();
  for (const listed of rows) {
    if (!listed?.windows && !listed?.gameLog?.length) { waiting += 1; continue; }
    if (!league) continue;
    const row = withTonight(listed, league);
    let over = null, under = null;
    const failed = error => { errors.add(String(error?.message || error).slice(0, 120)); return null; };
    try { over = gradeLeg({side: 'OVER'}, row, {[row.sport]: league}); } catch (error) { over = failed(error); }
    const modifier = String(listed.modifier || 'standard').toLowerCase();
    if (modifier === 'standard') { try { under = gradeLeg({side: 'UNDER'}, row, {[row.sport]: league}); } catch (error) { under = failed(error); } }
    if (!over && !under) { ungraded += 1; continue; }
    // The Over must be the Props list's own (props-grade.js).
    const shown = grades.get(listed.id);
    if (shown && over && (Math.abs(shown.chance - over.chance) > 1e-9 || shown.tier !== over.tier)) mismatched += 1;
    const read = over?.read || under?.read;
    const fitted = read?.model;
    const dk = bookChance(listed, books);
    const role = lineupRole(listed, league);
    if (!reportTeams.has(listed.teamAbbr)) missingReports.add(listed.teamAbbr);
    const mine = (tonight?.teams?.[listed.teamAbbr]?.injuries || []).find(item => String(item.id) === String(listed.playerId));
    const log = listed.gameLog || [];
    out.push({pid: listed.playerId, pl: listed.player, tm: listed.teamAbbr, op: listed.opponent, mk: listed.marketKey, ln: Number(listed.line),
      md: modifier, st: listed.startsAt, pp: String(listed.id || '').replace(/^nba:pp:/, ''), sc: scores.get(listed.id)?.score ?? null,
      o: side(over), u: side(under), pj: round(read?.projection, 3),
      m: fitted ? [round(fitted.usage), round(fitted.rate, 5), round(fitted.recentUsage), read?.games ?? null, round(fitted.prior, 5), round(fitted.weight)] : null,
      dk: dk ? [round(dk.chance), dk.line, dk.over, dk.under, dk.moved ? 1 : 0] : null,
      ro: role ? [role.starter ? 1 : 0, role.sat ? 1 : 0, role.starts, role.games] : null,
      ns: mine ? [mine.status || '', mine.code || ''] : null,
      lg: log.length ? String(log.at(-1)?.date || '').slice(0, 10) : null, gn: log.length});
  }
  if (waiting) problems.push(`${waiting} lines had no game history yet and were not graded`);
  if (ungraded) problems.push(`${ungraded} lines could not be graded${errors.size ? ` (${[...errors].slice(0, 3).join('; ')})` : ''}`);
  if (mismatched) problems.push(`${mismatched} Over grades differed from the Props list's own: check the job's code`);
  if (missingReports.size) problems.push(`No injury report for ${[...missingReports].sort().join(', ')}: their grades read nobody out`);
  if (seen.failed.length) problems.push(`${seen.failed.length} requests failed: ${[...new Set(seen.failed)].slice(0, 6).join('; ')}`);

  const compactTonight = Object.fromEntries(Object.entries(tonight?.teams || {}).map(([team, entry]) => [team,
    {eventId: entry.eventId, startsAt: entry.startsAt, spread: entry.spread, total: entry.total,
      injuries: (entry.injuries || []).map(item => [String(item.id || ''), item.name || '', item.status || '', item.code || ''])}]));
  const body = {action: 'nba-prop-snapshot', startedAt, sha: process.env.GITHUB_SHA || '', model: {...model, calibration: calibration ? `${calibration.version}|${calibration.at || ''}` : ''},
    data: {board: seen.times.board || null, league: seen.times.league || null, tonight: tonight?.fetchedAt || seen.times.tonight || null,
      books: seen.times.books || null, learning: calibration?.at || null, lines: rows.length, graded: out.length, teams, reports: reportTeams.size,
      requests: seen.calls, finished: new Date().toISOString()},
    inputs: {tonight: compactTonight, calibration: calibration ? {version: calibration.version, at: calibration.at, picks: calibration.picks} : null},
    problems, rows: out};
  console.log(JSON.stringify({lines: rows.length, graded: out.length, standard: out.filter(row => row.md === 'standard').length,
    model, data: body.data, problems}, null, 1));
  if (DRY) {
    console.log(JSON.stringify(out.slice(0, 3), null, 1));
    return;
  }
  const response = await realFetch(`${SITE}/api/v2-admin`, {method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-GitHub-OIDC': await signed(), 'User-Agent': 'PropScout prop snapshot (GitHub Actions)'},
    body: JSON.stringify(body)});
  const answer = await response.text();
  console.log(`site: HTTP ${response.status} ${answer.slice(0, 600)}`);
  if (!response.ok) process.exitCode = 1;
}

main().catch(async error => {
  console.error(`Snapshot failed: ${error?.stack || error}`);
  process.exitCode = 1;
  // The site logs why (prop_snapshots.accept_run): a failed run is never silent.
  if (DRY) return;
  try {
    await realFetch(`${SITE}/api/v2-admin`, {method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-GitHub-OIDC': await signed(), 'User-Agent': 'PropScout prop snapshot (GitHub Actions)'},
      body: JSON.stringify({action: 'nba-prop-snapshot', startedAt, sha: process.env.GITHUB_SHA || '', model,
        problems: [...problems, `The run failed: ${String(error?.message || error).slice(0, 200)}`], rows: []})});
  } catch { /* the site's watch logs the missing run */ }
});
