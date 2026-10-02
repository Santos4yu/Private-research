// Operator-only build verification. Never emits keys, tokens, or user data.
import { randomUUID } from 'node:crypto';

if (process.env.WEBSITE_RECOVERY_VERIFY !== '1') throw new Error('Verification must be explicitly enabled');
const base = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const anon = process.env.SUPABASE_ANON_KEY;
if (base !== 'https://ggqihonkbbdhusdaetai.supabase.co' || !secret?.startsWith('sb_secret_') || !anon) {
  throw new Error('Server verification configuration is incomplete');
}
const request = async (path, key, body, token, method = 'POST') => {
  const response = await fetch(base + path, {
    method, headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
  });
  let data; try { data = await response.json(); } catch { data = {}; }
  return { status: response.status, data };
};
const check = (ok, message) => { if (!ok) throw new Error(message); };
let fixtureId;
let app;
try {
  const probe = await request('/rest/v1/rpc/website_storage_pipeline', secret,
    { commands: [['GET', 'krazy_data:site_controls:v1']] });
  check((probe.status === 400 && probe.data.message === 'website_storage_not_ready') || probe.status === 200,
    'Server storage connection failed');
  console.log('Storage verification: privileged gateway connection confirmed');
  if (process.env.WEBSITE_RECOVERY_VERIFY_URL) {
    const target = process.env.WEBSITE_RECOVERY_VERIFY_URL;
    check(target === 'https://private-research-4ie25l94x-zoras-projects-c283c99f.vercel.app', 'Unexpected verification deployment');
    check(process.env.VERCEL_OIDC_TOKEN, 'Build self-access identity missing');
    app = async (path, cookie = '', body) => {
      const response = await fetch(target + path, { redirect: 'manual', headers: {
        'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body ? { 'Content-Type': 'application/json', Origin: target } : {}),
      }, ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
      check(response.headers.get('content-type')?.startsWith('application/json'), 'Protected deployment did not return application JSON');
      return { status: response.status, data: await response.json(), cookies: response.headers.getSetCookie() };
    };
    const status = await app('/api/session?action=site-status');
    if (process.env.WEBSITE_RECOVERY_EXPECT_READY === '1') {
      check(status.status === 200 && status.data.requireLogin === true && status.data.maintenance === true &&
        status.data.registrationOpen === false && status.data.accountsConfigured === true && status.data.isAdmin === false &&
        status.data.disabledTabs?.length === 11 && status.data.disabledFinderSports?.length === 8 && !status.data.temporaryPublicAccess,
        'Restricted application policy failed');
    } else check(status.status === 503 && status.data.code === 'storage_migration_pending', 'Application readiness gate failed');
    for (const cookie of ['', 'vortex_v2_admin=forged-test-token']) {
      const denied = await app('/api/v2-admin?action=site-settings', cookie);
      check(denied.status === 401, 'Unauthenticated admin request was accepted');
    }
    console.log('Storage verification: real application readiness gate and forged/absent admin-cookie denial confirmed');
  }
  const email = 'storage-verification-' + randomUUID() + '@example.invalid';
  const password = randomUUID() + randomUUID();
  const created = await request('/auth/v1/admin/users', secret, { email, password, email_confirm: true });
  fixtureId = created.data.id;
  check(created.status >= 200 && created.status < 300 && fixtureId, 'Disposable identity creation failed');
  const signed = await request('/auth/v1/token?grant_type=password', anon, { email, password });
  check(signed.status === 200 && signed.data.access_token, 'Disposable identity sign-in failed');
  for (const token of [undefined, signed.data.access_token]) {
    for (const [path, body] of [
      ['/rest/v1/rpc/website_storage_pipeline', { commands: [['GET', 'krazy_data:site_controls:v1']] }],
      ['/rest/v1/rpc/website_storage_pin_failure', {}],
    ]) {
      const result = await request(path, anon, body, token);
      check([401, 403].includes(result.status) && result.data.code === '42501', 'Gateway role denial failed');
    }
  }
  console.log('Storage verification: anonymous and actual signed-in member denied both private RPCs');
  if (app && process.env.WEBSITE_RECOVERY_EXPECT_READY === '1') {
    const login = await app('/api/session', '', { action: 'sign-in', email, password });
    check(login.status === 200 && login.cookies.some(c => c.startsWith('vortex_account_access=') && c.includes('HttpOnly') && c.includes('Secure')),
      'Website sign-in or secure cookie verification failed');
    const memberCookie = login.cookies.map(c => c.split(';')[0]).join('; ');
    const memberStatus = await app('/api/session?action=site-status', memberCookie);
    check(memberStatus.status === 200 && memberStatus.data.account?.id === fixtureId && memberStatus.data.isAdmin === false &&
      memberStatus.data.maintenance === true && memberStatus.data.disabledTabs?.length === 11,
      'Signed-in member restriction verification failed');
    for (const cookie of ['', memberCookie]) {
      const denied = await app('/api/v2-admin?action=members', cookie);
      check(denied.status === 401, 'Member or anonymous admin access accepted');
    }
    const admin = await app('/api/v2-admin', '', { action: 'auth', pin: process.env.ADMIN_PIN });
    check(admin.status === 200 && admin.cookies.some(c => c.startsWith('vortex_v2_admin=')), 'Existing admin PIN verification failed');
    const adminPolicy = await app('/api/v2-admin?action=site-settings', admin.cookies.map(c => c.split(';')[0]).join('; '));
    check(adminPolicy.status === 200 && adminPolicy.data.requireLogin === true && adminPolicy.data.disabledTabs?.length === 11,
      'Verified admin settings access failed');
    await request('/rest/v1/rpc/website_storage_pipeline', secret, { commands: [
      ['HDEL', 'krazy_data:members_seen:v1', email], ['HDEL', 'krazy_data:members_first_seen:v1', email],
    ] });
    console.log('Storage verification: real website sign-in, hidden member sections, secure cookies, existing admin PIN and admin-only settings confirmed');
  }
} finally {
  if (fixtureId) {
    const removed = await request('/auth/v1/admin/users/' + fixtureId, secret, undefined, undefined, 'DELETE');
    check(removed.status >= 200 && removed.status < 300, 'Disposable identity cleanup failed');
    console.log('Storage verification: disposable identity removed; original accounts unchanged');
  }
}
