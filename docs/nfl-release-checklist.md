# NFL Phase 9 — release readiness

Local implementation reviewed 2026-09-12. **Not deployed. Not approved for public recommendations or paid model release.** No MLB model changes, fabricated data or model promotions.

## Product and status

The existing Research shell retains its MLB/NFL switcher and transparent league SVGs. NFL contains player search, recent NFL players, featured real-player cards, research tools and a Value Board. Player research retains position-specific props and Overview, Trend, Opportunity, Matchup, Opponent, Game, Injuries and Health tabs. Model badges, an expandable projection explanation, freshness labels, a restrained PASS panel and one research disclaimer make experimental outputs explicit.

| Category | Count | Public recommendations |
|---|---:|---|
| Production ready | 0 | Disabled |
| Experimental models, shadow only | 12 | Disabled |
| Previously disabled candidates | 4 | Disabled |
| Unsupported position/props | 12 | Not available |

The source of truth is `nfl-production-model-validation.md` and its versioned status artifact. The client ships only a compact position/prop/status copy, not historical forecast arrays or full audit evidence. No statistical, distribution or decision methodology was changed.

## Data

- [x] Existing real roster/team/schedule/game-log adapters preserved; their tests pass.
- [x] Missing metrics remain unavailable; supported numerical zeros remain zeros.
- [x] Images use real provider media; logos use proportional transparent SVG assets. Failed images use an icon, never an invented face or abbreviation behind a logo.
- [x] nflverse attribution and CC BY 4.0 link appear in NFL research.
- [x] Existing injury and line capabilities reviewed.
- [ ] Complete current injury/active-list and starting-QB sources verified for release. Injury completeness remains unknown.
- [ ] Reliable current and timestamped historical line feeds. Neither is connected.
- [ ] Forecast weather and supported advanced charting coverage/routes/box/run concepts.

## Models and shadow mode

- [x] Exact model statuses preserved; no model promoted for presentation.
- [x] Disabled models return no projection; unsupported props are labelled NOT AVAILABLE.
- [x] Experimental outputs explicitly labelled; public TAKE/LEAN unavailable.
- [x] Production gate, stale/missing line, injury, role and health tests pass.
- [x] Immutable snapshots, original line/version retention and HIT/MISS/PUSH grading tests pass.
- [x] Existing real local pre-kickoff null-projection shadow event preserved without invented outcome.
- [ ] Durable hosted ledger, prospective scheduler and operational alerts configured. No deployment performed.
- [ ] Sufficient distinct forward outcomes, independent calibration, untouched holdout and learned decision thresholds.

## UI and accessibility

- [x] Search debounced 150ms with arrow navigation, Enter, Escape, listbox selection and combobox labels.
- [x] Existing loading skeletons, errors and empty messages preserved; compact model sections remove large blank minimum heights.
- [x] Home requests settle independently. One failed source does not discard usable roster/team/game data; retry is available.
- [x] Selected player components are keyed by identity, preventing prior-player resource state reuse.
- [x] Image decoding/lazy loading/dimensions, team watermark, focus rings, reduced motion and touch controls implemented.
- [x] Existing distribution histogram includes semantic summary and quantile markers; no fake line marker.
- [x] Value Board filters position/prop/team/game/verdict/status/health and sorting by probability/statistical edge/coverage prepared. It correctly has no eligible rows now.
- [x] Admin health drawer loads only through the existing admin-protected endpoint, showing actual audit metrics/statuses or access/data failure.
- [x] Compiled app opened in the local in-app browser: NFL selected state, search combobox, source-failure message and disclaimer rendered without a crash.
- [ ] Authenticated desktop full research flow visually verified.
- [ ] iPhone 390px, Android 412px, tablet 768px and desktop 1440px visual/overflow/image/chart QA. Responsive CSS was improved, but device visual QA is **not claimed**.
- [ ] Full keyboard/screen-reader and measured contrast audit on authenticated screens.

## Performance and cache

NFL requests coalesce concurrent identical calls, use a 45-second timeout, never cache HTTP failures and cap memory at 120 responses. Keys include resource and sorted season/player/week/prop parameters. Roster/team metadata expire after five minutes; mutable research/personnel/game responses after 30 seconds. NFL switch and explicit refresh clear this cache. Authentication failures clear it. No authenticated research is stored persistently by this client cache. Existing server keys remain NFL-specific and versioned.

HTTP responses use private/no-store so browser HTTP caching cannot defeat explicit refreshes. Source timestamps are displayed; missing/future-invalid timestamps are not presented as fresh. Output labels age every 30 seconds. A refresh re-requests model inputs through existing provider caches and gates; this is not a live injury subscription.

- [x] NFL island split from the main JavaScript entry with React lazy/Suspense.
- [x] Build main JS reduced from pre-Phase9 653.93KB to 602.48KB; NFL chunk approximately 63KB. Total JS grew modestly; splitting is not a total-size reduction.
- [x] Simulation summaries/histograms only; raw simulation arrays and private outcome mass not shipped.
- [x] Cache coalescing/expiry/invalidation/failure and identity separation tests pass.
- [ ] Persistent cross-instance cache and deduplicated cold-start heavy work. Warm-process cache cannot eliminate serverless cold downloads.
- [ ] End-to-end latency budgets on authenticated real research, production network and low-end phones.
- [ ] Immediate provider-change notifications/automatic freshness invalidation for injury/QB/weather/game changes. Manual refresh and TTL are available; not equivalent to push invalidation.
- [ ] Existing large bundle/CSS warning resolved through a separately scoped core-app optimization.

## Security and logging

Existing signed Discord sessions/live-access checks preserved. NFL model-health remains admin-protected. NFL resource names are allowlisted, season/week bounded, query lengths capped, model/decision client overrides rejected and arbitrary provider URLs are not accepted. NFL responses set nosniff and private/no-store. Sanitized structured warnings identify rate/source/model/request failures without raw queries, player identities, cookie tokens or exception text. No secrets were added to the browser.

- [x] Admin authorization regression, query/model boundaries and immutable ledger protections pass.
- [x] Warm-process per-cookie-hash limits: 40 heavy or 120 read requests/minute. Hash stays in bounded memory and is never logged. Independent read/heavy budgets preserve ordinary navigation.
- [x] Rate-limit/recovery tests pass.
- [ ] Distributed rate limiting/WAF. Limits reset on cold start and are not global abuse protection.
- [ ] Deployment-specific OAuth cookie/redirect/session/security headers and Redis permissions audited end to end. Shared auth/Redis were not rewritten.
- [ ] Operational log transport/alerts and review of third-party media usage rights for paid publication.

## QA evidence

- [x] NFL backend: **143 passing tests**.
- [x] Frontend: **18 passing tests**, including client-cache/freshness tests.
- [x] TypeScript: `npx tsc --noEmit` passes.
- [x] Vite production build passes; existing >500KB main-chunk warning remains.
- [x] Full backend discovery: **162 tests, 160 passing, two existing MLB/BvP failures** (`104 != 4`, `10 != 0`). MLB untouched under the task boundary.
- [x] Diff whitespace check passes, apart from normal Git line-ending warnings.
- [ ] Lint: no configured project lint command; no success claimed.
- [ ] Authenticated end-to-end: sport → search → player → prop → logs → opportunity → matchup → projection → distribution. Browser source-failure state checked; full real-data flow is pending authorized authenticated QA.
- [ ] Real-line comparison/verdict E2E cannot complete until a legitimate feed and eligible model exist. Missing line and PASS gates are tested.
- [x] Existing automated NFL isolation/position/cache/recent-player tests pass.
- [ ] Existing MLB authenticated UI routes visually regression-tested. No MLB model/routes changed; only sport-island mounting uses Suspense.

## Files and remaining release blockers

Phase9 additions: `nfl-client.js`, `ModelBadge.jsx`, `Freshness.jsx`, `ValueBoard.jsx`, compact `model-status.json`, NFL request guard, cache/freshness/rate tests and this checklist. Modified NFL research/panels/styles/API serialization/handler, plus the sport-island lazy mount in `src/main.jsx`. Prior phases remain separate existing uncommitted work.

The product supports honest experimental research and local shadow collection. It is **not release-certified**: authenticated device/E2E/security QA, operational durability and data freshness remain open. Public recommendations additionally require production-ready models and real lines. Paid model release additionally requires credible forward/calibration evidence, complete personnel data and validated decision rules. The weakest areas remain current injury/QB completeness, historical as-of evidence, marginal baseline gains, incomplete advanced charting and cold-start performance. None was concealed by the polish.

## Early-season history correction — 2026-09-12

**Subsequent integration:** the descriptive-only model boundary in this section is superseded for forecast weeks 1–4 by the separately versioned experimental history policy documented in [nfl-live-research-readiness.md](nfl-live-research-readiness.md). Current identity/injury/depth sources stay current. Earlier validation does not validate this new input policy, and no candidate is promoted.

The real current-line adapter, game browser, verified quote selection, retrospective line comparison and distribution marker are connected. NFL API integration was checked over HTTP against real sources. Updated QA: 162 NFL backend and 26 frontend tests, type checking and build pass. Existing MLB/BvP failures remain unchanged. Final current-server browser/mobile QA was blocked by automatic approval review's usage limit; full device certification is still pending. Hosted credentials must be verified separately: local `.env.local` is intentionally excluded from Git and Vercel upload.

The original UI requested only 2026 descriptive records. It now defaults to recent regular-season history, loading 2025 when there are fewer than twenty current-season records. Rows are chronologically ordered and deduplicated by season/game; L5/L10/L15/L20 use actual available games across the boundary. Separate 2026-only and 2025-only choices never silently fall back. The season range and each game's season/week are visible. Overview averages and medians explicitly describe this history sample.

Opportunity adds observed targets/carries/attempts/receptions and matched offensive snap baselines from the latest ten available games. These are **descriptive historical averages, not upcoming-game forecasts**. Previous-team games are explicitly historical former roles. Matchup/Opponent show the current opponent's measured prior-season defensive baseline independently of unavailable current advanced scores. Current schedule, injury status, model input season, projections, distributions and decision gates do not roll back. No model version or statistical methodology changed.

Independent request completion now releases game logs without waiting for injuries/defense/usage. A failed current-season source can preserve labelled previous-season records; players without prior NFL history remain empty rather than receiving mock statistics.

Public-source verification: Matthew Stafford GSIS `00-0026498` had one available 2026 regular-season log and seventeen 2025 regular-season logs; 2025 snap records were available. The Giants' 2025 defensive adapter returned seventeen regular-season games with measured passing/rushing/attempt/sack/interception/points fields. These are source-availability checks, not model validation or a claim of complete current data. Five new history tests cover ordering, season selection, backfill, failures and missing versus legitimate zero usage.


## Interactive research beta follow-up

Updated research controls and QA are documented in [nfl-beta-research-qa.md](nfl-beta-research-qa.md). The funded NFL key was written to the NFL-only Upstash setting after explicit approval and verified by readback. The MLB key and model logic were not changed. Public research no longer displays internal decision audit panels; this does not promote any model. After the temporary tool usage interruption, live endpoint checks and local browser interactions completed, including 390/412/768/1280px layout checks. Hosted and physical-device certification remain separate. See the latest QA document for measured results.
