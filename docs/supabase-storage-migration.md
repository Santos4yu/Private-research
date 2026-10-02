# Supabase storage recovery

The original Upstash database is suspended for monthly bandwidth usage.
Supabase already handles the website's member accounts; website settings,
profiles, notification subscriptions, histories, boards and shared security
counters currently use Upstash. This change prepares the latter for Supabase
PostgreSQL without changing Supabase Auth users or account identifiers.

## Safety boundaries

- `WEBSITE_STORAGE_BACKEND` defaults to `upstash`. Merely deploying this code
  does **not** switch providers, lift the suspension or recover saved data.
- There is no automatic fallback to another/empty database. Selecting an
  unconfigured or unprepared Supabase backend returns a safe storage error.
- The existing sign-in requirement, admin cookie verification, visibility
  rules and per-member restrictions stay in force. `temporary_access.ENABLED`
  remains **False**. No guest/admin bypass is part of this migration.
- Original Upstash data and connections are untouched. No account, key,
  database, subscription or paid plan is created or deleted by the tooling.
- Private tables have RLS enabled, no member/anonymous grants and no public
  policies. Only server-role execution of two restricted routines is granted.
  Both routines have a fixed empty search path. Do not expose
  `website_private` in Supabase's exposed schemas.
- Use a server secret key (`SUPABASE_SECRET_KEY`, preferred) or legacy
  `SUPABASE_SERVICE_ROLE_KEY`. Never use the anonymous key for storage, put
  server keys in `VITE_*`, commit them, or paste them into chat. Existing
  `SUPABASE_ANON_KEY` continues to be used for the account-auth flow only.
- Access metadata is cached for at most ten seconds; expired access settings
  are not served during outages. Authentication counters and PIN lockouts
  are always read live. Failed PIN counting and lock creation are one
  database transaction on Supabase.

## Prepared components

`supabase/migrations/20261002_website_storage.sql` creates the private store,
disabled readiness flag and server-only routines. It does not touch Auth
tables. All website storage callers now use `v2.board.store`, including
profiles, histories, line moves, notifications, basketball caches and tennis
quotas/leases. String, hash, list and tennis sorted-set behavior is preserved.
Expiry cleanup is incremental and expired records are immediately invisible.
Unsupported commands fail the transaction rather than partially applying it.

Large strings/hash fields/list items are compressed before transfer on
Supabase and transparently decoded by the server. Smaller values/counters
are left alone. Original text that resembles the codec prefix is escaped.
Corrupt or oversized compressed records fail safely. Compression is **not**
applied to existing Upstash records and cannot restore access to that service.

The readiness flag cannot be enabled by the website's ordinary storage API.
The database refuses operations until a reviewed import has completed and
the non-expiring visibility policy and member-rule records exist. The server
also rejects missing access records instead of applying open defaults.

## Required before a live cutover

1. Authorized connection to the **existing** Supabase account project, with
   the free plan and its remaining database/egress allowance checked. No
   billing change or paid upgrade is authorized.
2. A readable complete backup from the original Upstash database, including
   `krazy_data:site_controls:v1` and `krazy_data:member_rules:v1`.
   The suspended source currently cannot be exported. This code does not
   invent the missing settings or recover unreadable data. If there is no
   backup, stop: a separately approved, explicitly restricted fresh setup
   would be a different recovery path, not a preserved-data migration.
3. Apply and inspect the schema on Supabase, then verify member/anonymous
   denial using its real REST gateway (local tests do not replace this check).
4. Pause source writers before export and keep them paused through cutover.
   Source SCAN/pipelines are not a point-in-time snapshot while writers run.
   Freeze background jobs/timers too; no dual writes or split backend state.
5. Review the original hidden tabs/sports and member restrictions in the
   private backup. Import tooling requires explicit approval of that policy,
   all visibility lists, and `requireLogin: true`. It won't substitute defaults
   or synthesize an absent member-rule record.
6. Prepare and review the import SQL privately. It refuses a non-empty or
   already-ready destination; any SQL failure rolls the import back. The
   original JSON, hash fields, list order, scores and absolute expiries are
   preserved; expired records are omitted, not granted fresh lifetimes.
7. Apply the reviewed import. It sets a fresh shared fifteen-minute PIN
   lockout (or retains a longer original lock) before admin PIN sign-in resumes.
   Existing admin-cookie verification is not changed.
8. Configure the server key securely in the hosting provider. Preserve
   `WEB_SECRET_KEY`, admin PIN and existing Supabase auth configuration.
   Set `WEBSITE_STORAGE_BACKEND=supabase` only for an approved test deployment
   first. Verify sign-in, hidden sections, member restrictions, admin access,
   board/history counts, profiles, notifications and TTLs end-to-end.
9. Ask for explicit authorization before pushing/deploying the production
   cutover. After destination writes start, do **not** simply switch back to
   stale source settings. Rollback requires a deliberate data reconciliation.

## Private operator tooling

These commands are for an authorized operator, not phone setup instructions
for the site owner. Backups/imports include credentials and member data.
Keep them under the gitignored `.storage-backups/` directory on trusted
storage; do not attach them to chats or publish them as build assets.
The output files must not already exist. The tool makes no destination
requests, deploys nothing, prints only counts/status, and never writes to the
original source.

```powershell
python tools/storage_migration.py export .storage-backups/original.json --source-writers-paused
python tools/storage_migration.py inspect .storage-backups/original.json
python tools/storage_migration.py prepare-import .storage-backups/original.json --output .storage-backups/import.sql --confirm-original-policy
```

Create the private output directory first if absent. A suspended source
causes export to stop; an empty reserved output file may remain. Do not
reinterpret a failed/partial file as a successful backup. The tool supports
its documented JSON format, not arbitrary Redis dumps. It aborts on unknown
key types rather than silently leaving data behind.

## Verification

Python regression tests block network requests and cover backend selection,
no anonymous-key fallback, compression, caller routing, required policy,
rate limits, outages, auth/admin behavior and import validation.
`tests/supabase-storage.test.mjs` executes the actual migration and generated
synthetic import in local PostgreSQL (PGlite), tests denied roles, shared
counter/lease semantics, TTLs, PIN lockouts and import/transaction rollback.
This is not a real Supabase deployment test or a multi-server load test.

The optional local SQL test runtime is isolated/ignored and is not a
production dependency:

```powershell
npm install --prefix .storage-backups/sql-test-runtime --no-save --package-lock=false --ignore-scripts --no-audit --no-fund @electric-sql/pglite
node --test tests/supabase-storage.test.mjs
python -m unittest discover -s tests -p test_supabase_storage.py
```

Without the local PGlite runtime, the SQL test is explicitly skipped.

## Free plan capacity

Supabase's free tier is finite: currently 500 MB database storage and 5 GB
uncached egress. Moving the same repeated uncompressed traffic there could
hit another limit. Compression, the existing short policy cache, ten-minute
member-presence write throttling and the storage-failure cooldown reduce
waste; they do not guarantee a busy paid website will run free indefinitely.
Measure actual compressed traffic, database size and quota headroom before
cutover. Supabase's Auth quota/egress and database limits must also be checked.

Primary references:
[Supabase pricing](https://supabase.com/pricing),
[server versus public keys](https://supabase.com/docs/guides/getting-started/api-keys),
[function privileges and security](https://supabase.com/docs/guides/database/functions),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Approved restricted fresh setup — October 2, 2026

The setup notes below are a chronological operator log. The latest verified
state is recorded in "Production readiness verification" at the end.

The owner explicitly approved a fresh setup with existing Auth accounts
preserved, every section hidden, and old settings/histories unrecovered.
This approval is separate from production push/deployment authorization.

Verified project: `ggqihonkbbdhusdaetai` (Krazy Data), healthy, free organization.
Database size at inspection: 11,537,555 bytes; 49 Auth accounts. Monthly
egress headroom is not exposed by the available connected tools and remains
unverified. No Auth tables or original Upstash records were modified.

Applied `20261002_website_storage.sql` to the existing project. Seeded exactly
three fresh records: explicit site policy, explicit empty member rules with
`originalRulesRecovered: false`, and a fresh fifteen-minute PIN lock.
All tabs/Finder sports are disabled; NFL research is disabled; sign-in is
required; registration is closed; maintenance is enabled. Existing verified
admin access remains governed by the unchanged application checks. Empty
rules grant no member override; maintenance and disabled sections deny access.

The source marker is `approved_restricted_fresh_setup_20261002`, not an
Upstash backup. `ready` remains **false**. Anonymous real REST requests to
both RPCs returned HTTP 401 / PostgreSQL 42501 (permission denied). Catalog
checks confirm both anonymous and authenticated roles cannot use the private
schema, read/write storage, or execute either RPC. Service role may execute
only the two routines and has no direct table access. A real signed-in member
REST test is still required; role checks alone do not replace it.

Security advisor found no storage warnings: its two informational
RLS-without-policy notices are intentional deny-all private tables. Existing
Auth leaked-password protection is disabled; it was not changed.

Remaining gates: secure server-key configuration, signed-in REST denial,
monthly egress capacity, application end-to-end checks, then separate owner
authorization for production push/deployment. No privileged key is available
in local configuration or the connected Supabase toolset. No hosting connector
or authenticated hosting CLI was available in this chat. Do not enable ready
or change the deployed backend until these remaining checks are completed.

### Hosting access follow-up

Owner conditionally authorized deployment: "Deploy it if it’s ready and
working." Vercel plugin discovery confirms installed/enabled, but this chat
exposes no Vercel project, environment, or deployment tool bindings. No
Vercel CLI or local project link exists. A direct dashboard visit redirected
to login; its official Open Vercel Plugin action opened the public plugin
page, without an authenticated project session. Therefore authenticated
hosting access is not verified. No connection secrets were sought in OS or
browser credential stores, and no production configuration was changed.
Readiness remains closed; conditional deployment authorization is retained
for continuation once secure access and verification gates are satisfied.

### Authenticated hosting verification

Official Vercel CLI 62.2.0 now successfully lists production variable names
for `zoras-projects-c283c99f/private-research`. Prior hosting-access blocker
is resolved. Existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `WEB_SECRET_KEY`,
and `ADMIN_PIN` are present. No `SUPABASE_SECRET_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, or `SUPABASE_DB_URL` is configured. Values were
not displayed, pulled, overwritten, or committed. The Supabase connector
offers publishable keys only, no privileged key retrieval.

Remaining secure action: the owner must copy the existing project's server
secret from its Supabase API Keys dashboard directly into a Vercel server
environment variable named `SUPABASE_SECRET_KEY` for this project. Never
use a VITE-prefixed variable or paste it in chat. Configure the same server
key only in Production. Use a protected, unaliased production-environment
deployment for authorized pre-production verification. Keep the backend
selector unchanged until checks pass. No production deploy occurred and
readiness remains false.

### Production readiness verification

The owner saved the existing `SUPABASE_SECRET_KEY` directly in Vercel as a
protected Production-only secret. No secret values were printed, committed,
or made available to preview branches. Authenticated Vercel CLI access is
working. `WEBSITE_STORAGE_BACKEND=supabase` is now saved for Production.

Real gateway checks verified privileged storage access and denied both
private RPCs to anonymous and actual signed-in member identities. The
closed readiness gate and forged/absent admin-cookie rejection passed
through the deployed application. The approved fresh setup's readiness
flag was then enabled. Further real application checks passed: hidden-all
policy, required sign-in, closed registration, secure HttpOnly sign-in
cookies, normal-member restrictions, rejection of member admin requests,
the existing admin PIN, and admin-only settings access. Disposable test
identities were removed; the original 49 Auth accounts remain intact.

Relevant regression checks passed: 171 Python tests and 32 JavaScript/SQL
checks. The frontend production build passed. Unrelated pre-existing
baseball-model test failures are outside this storage recovery scope.

Production deployment remains conditional on a READY final build and live
verification. Keep all sections hidden and maintenance enabled after the
cutover until the owner deliberately selects what to reopen in admin.
The old Upstash settings, profiles and histories have **not** been recovered.
Original Upstash storage remains untouched and suspended. No paid upgrade
was made; monthly Supabase egress headroom remains unverified.
