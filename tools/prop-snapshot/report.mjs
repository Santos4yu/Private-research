// What the prop snapshot records hold and how the production grades have
// done (the admin's model check, as text): asks the site with the
// workflow's signed token and prints it. Run by the workflow's "report" mode.
// With REPORT_KEY (an RSA public key, base64 DER, given as the run's `key`)
// only ciphertext is printed: in a public repository's logs, the results
// stay readable by whoever holds the private key alone.
import {createCipheriv, createPublicKey, publicEncrypt, randomBytes, constants} from 'node:crypto';
const said = [];
const say = (...parts) => said.push(parts.map(String).join(' '));
const SITE = process.env.SITE || 'https://aceprops.xyz';
const DAYS = Number(process.env.DAYS || 30);
const base = process.env.ACTIONS_ID_TOKEN_REQUEST_URL, bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
const token = (await (await fetch(`${base}&audience=aceprops-nba-prop-snapshot`, {headers: {Authorization: `bearer ${bearer}`}})).json()).value;
const response = await fetch(`${SITE}/api/v2-admin?action=nba-prop-eval&days=${DAYS}&fresh=1`,
  {headers: {'X-GitHub-OIDC': token, 'User-Agent': 'PropScout prop snapshot report (GitHub Actions)'}});
say(`HTTP ${response.status}`);
const body = await response.json().catch(() => ({}));
const {recording = {}, evaluation = {}} = body;
say('=== RECORDING ===');
say(JSON.stringify({status: recording.status, keys: recording.keys, health: (recording.health || []).slice(0, 25)}, null, 1));
for (const day of recording.days || []) say(JSON.stringify(day, null, 1));
say('=== EVALUATION ===');
const trim = side => side && {n: side.n, playerGames: side.playerGames, nights: side.nights, hitRate: side.hitRate, summary: side.summary,
  calibration: side.calibration, ece: side.ece, fit: side.fit, tiers: side.tiers, thresholds: side.thresholds, markets: side.markets, gaps: side.gaps};
for (const name of ['list', 'job']) {
  const source = evaluation[name] || {};
  say(`--- ${name} ---`);
  say(JSON.stringify({lines: source.lines, standard: source.standard, from: source.from, to: source.to, duplicatesRemoved: source.duplicatesRemoved,
    void: source.void, pushes: source.pushes, favored: source.favored, errors: source.errors,
    specials: Object.fromEntries(Object.entries(source.specials || {}).map(([kind, side]) => [kind, side?.n ? {n: side.n, hitRate: side.hitRate, summary: side.summary} : null]))}, null, 1));
  say('OVER', JSON.stringify(trim(source.over), null, 1));
  say('UNDER', JSON.stringify(trim(source.under), null, 1));
}
say(JSON.stringify({error: evaluation.error, generatedAt: evaluation.generatedAt, seconds: evaluation.seconds, baselines: evaluation.baselines}, null, 1));
const text = said.join('\n');
if (process.env.REPORT_KEY) {
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const wrapped = publicEncrypt({key: createPublicKey({key: Buffer.from(process.env.REPORT_KEY, 'base64'), format: 'der', type: 'spki'}),
    padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256'}, key);
  const sealed = Buffer.from(JSON.stringify({k: wrapped.toString('base64'), iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'), d: data.toString('base64')})).toString('base64');
  const parts = sealed.match(/.{1,3000}/g) || [];
  console.log(`HTTP ${response.status}; the report is sealed (${text.length} characters).`);
  parts.forEach((part, index) => console.log(`SEALED ${index + 1}/${parts.length} ${part}`));
} else {
  console.log(text);
}
if (!response.ok) process.exitCode = 1;
