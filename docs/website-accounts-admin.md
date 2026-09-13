# Website email accounts and operational controls

## Implemented
Email/password integration through server-only Supabase Auth REST calls: create account, sign in, email confirmation requirement, sign out, refresh, recovery-code verification and password update. No passwords are stored by this application. Access/refresh tokens use HttpOnly Secure SameSite=Strict cookies; browser storage never contains tokens. Account mutations require matching Origin/Host and bounded JSON. Login/signup/recovery attempts have a shared Redis 20-attempt/15-minute counter plus provider protection.

Existing PIN-protected Admin Results now contains persisted website controls: maintenance message/mode, required accounts, registration open/closed, enabled tabs. Members cannot bypass required login using the former public beta identity. Admin PIN sessions bypass maintenance so an operator can restore access. User signups never grant admin privileges. Admin remains the existing independent PIN session, not an email-based admin role yet.

Default policy preserves public beta. Required login cannot be saved before Supabase is configured. Settings are stored under `krazy_data:site_controls:v1` in existing Upstash. Reads enforce changes on requests; browser refreshes policy every 30 seconds. Existing model logic is untouched. Hiding a tab alone does not secure its data; boundaries on research/boards/tools/export endpoints enforce mapped controls. Some APIs serve multiple UI tabs: query actions are mapped where implemented, but saved props are browser-local and tab controls are operational presentation, not per-user data deletion.

## Owner setup required before email accounts work
1. Create/select a Supabase project. Enable Email authentication with confirmation required, minimum password length 8, and email rate limits.
2. Set Supabase Auth Site URL to the actual HTTPS website origin. Allow only that production origin and explicit local/test origins. Configure the signup confirmation email template to show `{{ .Token }}`. Users enter this code on the website using Confirm email. Avoid implicit token links in URL fragments.
3. Configure custom SMTP with a verified sending domain before public registration. Configure the recovery email template to show `{{ .Token }}`; the website accepts an email plus recovery code, then a new password. Test expiration and invalid codes. Default email delivery is not a public launch plan.
4. Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` (publishable/anon project API key) to private Vercel environment settings and `.env.local` for local tests. Never supply a service-role key. Existing `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `WEB_SECRET_KEY`, `ADMIN_PIN` remain server-only. No credentials were provisioned or modified by this change.
5. Deploy/test registration, confirmation, login, refresh, logout and recovery against that actual project. Then enable Require email account in the admin panel. No live email account flow has been verified until project configuration exists.

## Remaining account features
Paid entitlements, account-based admin roles, user suspension, account deletion, cross-device saved research and an admin member directory are separate follow-up work. Current accounts authorize all research when login is required; they do not establish paid membership. No public/paid rollout was performed.

## Checks
Unit tests cover default policy, validation, admin maintenance bypass, feature disabling, same-origin rejection, beta bypass prevention, real account access independent of Discord, unconfirmed sessions, cookie flags and shared rate limiting. Type check/build plus existing regression suites run separately. Provider-level lifecycle tests require actual owner Supabase/SMTP configuration; do not treat mock unit tests as proof of email delivery.

Final local checks: 14 new access/account tests, 184 NFL backend tests, 32 NFL frontend tests, TypeScript and build passed. Full backend suite retains two pre-existing season-batting failures. Browser confirmed unconfigured accounts do not lock out the public website. Live signup/SMTP/admin-save tests were not run; live policy was not changed.
