// What the prop snapshot records hold and how the production grades have
// done (the admin's model check, as text): asks the site with the
// workflow's signed token and prints it. Run by the workflow's "report" mode.
const SITE = process.env.SITE || 'https://aceprops.xyz';
const DAYS = Number(process.env.DAYS || 30);
const base = process.env.ACTIONS_ID_TOKEN_REQUEST_URL, bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const token = (await (await fetch(`${base}&audience=aceprops-nba-prop-snapshot`, {headers: {Authorization: `bearer ${bearer}`}})).json()).value;
const response = await fetch(`${SITE}/api/v2-admin?action=nba-prop-eval&days=${DAYS}&fresh=1`,
  {headers: {'X-GitHub-OIDC': token, 'User-Agent': 'PropScout prop snapshot report (GitHub Actions)'}});
console.log(`HTTP ${response.status}`);
const body = await response.json().catch(() => ({}));
const {recording = {}, evaluation = {}} = body;
console.log('=== RECORDING ===');
console.log(JSON.stringify({status: recording.status, keys: recording.keys, health: (recording.health || []).slice(0, 25)}, null, 1));
for (const day of recording.days || []) console.log(JSON.stringify(day, null, 1));
console.log('=== EVALUATION ===');
const trim = side => side && {n: side.n, playerGames: side.playerGames, nights: side.nights, hitRate: side.hitRate, summary: side.summary,
  calibration: side.calibration, ece: side.ece, fit: side.fit, tiers: side.tiers, thresholds: side.thresholds, markets: side.markets, gaps: side.gaps};
for (const name of ['list', 'job']) {
  const source = evaluation[name] || {};
  console.log(`--- ${name} ---`);
  console.log(JSON.stringify({lines: source.lines, standard: source.standard, from: source.from, to: source.to, duplicatesRemoved: source.duplicatesRemoved,
    void: source.void, pushes: source.pushes, favored: source.favored, errors: source.errors,
    specials: Object.fromEntries(Object.entries(source.specials || {}).map(([kind, side]) => [kind, side?.n ? {n: side.n, hitRate: side.hitRate, summary: side.summary} : null]))}, null, 1));
  console.log('OVER', JSON.stringify(trim(source.over), null, 1));
  console.log('UNDER', JSON.stringify(trim(source.under), null, 1));
}
console.log(JSON.stringify({error: evaluation.error, generatedAt: evaluation.generatedAt, seconds: evaluation.seconds, baselines: evaluation.baselines}, null, 1));
if (!response.ok) process.exitCode = 1;
