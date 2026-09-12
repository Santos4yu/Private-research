# NFL architecture audit and foundation

## Scope and current architecture

This audit covers the deployed **Priv Research** application. The parent Vortex repository publishes the MLB board payload that this application reads, but its Discord bot and board-scoring engine are outside this first NFL implementation.

The client is a Vite 8 application. React 19 mounts the mobile navigation, research home, tabs, loaders, and selected UI islands from `src/main.jsx`. The main application controller remains `app.js`, which owns navigation state, search, prop selection, research requests, game-log controls, board rendering, local saved props, recent players, and share cards. Styling is split across `styles.css` and focused files under `src/`.

The backend uses Vercel Python serverless handlers under `api/`. They use `BaseHTTPRequestHandler`; this is not FastAPI. `vercel.json` maps authentication routes and configures the build/functions. The local `dev_server.py` mirrors the deployed endpoints.

There is no application relational database in this repository. Board and admin state use Upstash Redis through `v2/board/store.py`. Static JSON and joblib artifacts support the v2 MLB board/model. Browser-only saved props, accent settings, experience state, and recent players use `localStorage`.

Authentication is Discord OAuth in `auth_core.py`, with signed session cookies and a live guild-role check for live data endpoints. The relevant environment variables are `CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_TOKEN`, `WEB_SECRET_KEY`, `VORTEX_GUILD_ID`, `PREMIUM_ROLE_ID`, `TESTER_ROLE_ID`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `ODDS_API_KEY_V2`, `ADMIN_PIN`, `CRON_SECRET`, `OCR_API_KEY`, and `GROQ_API_KEY`.

## Existing MLB research flow

1. **Player** — `app.js` calls `/api/players`; `live_props_core.py` builds a cached active MLB roster from the MLB Stats API. Search results carry MLB player/team IDs and positions.
2. **Prop** — the client selects from MLB batter or pitcher stat lists. `/api/prediction` maps the display label through `STAT_LABEL_TO_PROP_TYPE`.
3. **Line** — the user selects a line or requests current PrizePicks lines. The endpoint maps each MLB prop to a sportsbook market key.
4. **Game logs** — `prediction_core.compute_prediction()` resolves the player/game, then `backend/stats_mlb.py` loads official game logs and exact-line splits. `/api/game-log-filters` performs the deeper filter request separately.
5. **Research** — `compute_prediction()` concurrently collects MLB handedness, Statcast, team history, weather, bullpen, park, umpire, lineup, BvP, and arsenal context with bounded timeouts.
6. **Matchup** — batter grading calls the existing functions in `backend/analyze.py`; pitcher strikeout research additionally uses `pitcher_matchup.py`. Lazy lineup and pitch-mix detail comes from `/api/team-insights`.
7. **Projection** — the existing MLB grading functions and optional v2 joblib inference create the current score/projection fields. Their logic is MLB-specific and remains unchanged.
8. **Verdict** — `prediction_core` formats the chosen side, confidence evidence, matchup score, risks, charts, image metadata, and model output into the JSON contract rendered by `app.js`.

The props board follows a separate read path: the parent Vortex process scores and publishes rows into Upstash; `/api/board` reads that mirror and attaches live records. It does not recompute research.

## Existing models and services

The repository mostly uses dictionaries/JSON rather than central player, team, game, or prop classes. MLB response contracts are assembled in `prediction_core.py`, `backend/research.py`, and `backend/stats_mlb.py`. `v2/common/feature_schema.py`, `v2/inference/`, and `v2/models/` contain the parallel MLB model feature/artifact path.

Current external sources are:

- MLB Stats API through the Cloudflare proxy, with direct MLB fallback in selected lightweight calls.
- Baseball Savant CSV/Statcast endpoints from `backend/stats_mlb.py`.
- The Odds API / PrizePicks-shaped odds responses in the board and line layers.
- Open-Meteo-style weather requests inside the MLB stats service.
- Discord OAuth and guild member APIs.
- Upstash Redis REST for board/config state.
- OCR.space and Groq for slip parsing when configured.

MLB player photos use `img.mlbstatic.com`; MLB team logos use `mlbstatic.com/team-logos` and the same-origin `/api/mlb-logo` proxy for canvas exports. These URL rules must not be reused for NFL entities.

## Shared versus sport-specific

Safe shared application infrastructure:

- Discord authentication and access control.
- Navigation shell, responsive layout primitives, modal behavior, generic skeletons, error surfaces, and loading states.
- Generic chart containers and prop-line controls after they receive sport-neutral data.
- Local preference storage, provided every data-bearing key is scoped by sport.
- Source/freshness/status envelopes and generic request error handling.
- Generic card composition and share/export plumbing once image resolvers are injected by sport.

Must remain sport-specific:

- Player/team/game identifiers and image resolution.
- Prop registries and permitted positions.
- Stat parsing and game-log normalization.
- MLB handedness, BvP, pitch arsenal, bullpen, park, umpire, and batting-order features.
- NFL depth chart, injury, snap, route, target/carry share, defensive scheme, pace, spread, and weather features.
- Feature construction, projection distributions, confidence calibration, thresholds, and verdict logic.
- Provider adapters, cache namespaces, model artifacts, model versions, and training data.

## Added NFL foundation

The added structure is deliberately disconnected from production MLB routes:

```text
src/sports/
  types.ts                 shared sport ID and sourced-data status contract
  sport-state.ts           persisted `mlb | nfl` preference; defaults to MLB
  registry.ts              sport namespaces; NFL remains disabled in production
  nfl/
    types.ts               complete frontend NFL domain contracts
    props.ts               position-aware prop registry and per-prop model IDs
    services.ts            typed ports for every NFL data service
    research.ts            frontend NOT_AVAILABLE result constructor

backend/sports/nfl/
  domain.py                validated NFL boundary types and missing-data states
  props.py                 position-aware backend prop registry
  research.py              pre-model boundary returning NOT_AVAILABLE
  cache.py                 versioned NFL-only cache namespace
  services/
    base.py                normalized provider result and provider protocol

tests/test_nfl_foundation.py
```

The TypeScript contracts define `NFLPlayer`, `NFLTeam`, `NFLGame`, `NFLGameLog`, `NFLProp`, `NFLPropLine`, `NFLInjury`, `NFLDepthChart`, `NFLPlayerUsage`, `NFLTeamUsage`, `NFLDefense`, `NFLWeather`, `NFLGameEnvironment`, `NFLProjection`, and `NFLResearchResult`. Flexible `extras` maps allow additive statistics without weakening the core identity and availability fields.

Each prop definition owns a stable `modelId`. Shared statistical names do not imply shared models: QB and receiver markets can route to separate implementations, while position-wide markets can later be split without changing API keys.

Every provider response must be normalized into `AVAILABLE`, `MISSING`, `UNRELIABLE`, `NOT_APPLICABLE`, or `NOT_AVAILABLE`, with source and timestamps. Validation rejects an `AVAILABLE` result without data and rejects unavailable results carrying a numeric value. Missing values therefore cannot silently turn into zero.

## Proposed NFL data flow

```text
sport-scoped NFL route
  -> provider adapter
  -> response validation and source/freshness envelope
  -> NFL domain objects
  -> sport-scoped cache (`nfl:{provider}:{season}:{week}:...`)
  -> feature builder for one NFL prop key
  -> that prop's versioned projection model
  -> calibrated distribution and side probabilities
  -> NFL confidence/verdict policy
  -> NFLResearchResult
  -> shared presentation primitives
```

Until a provider and a prop model are implemented, `backend/sports/nfl/research.py` returns `NOT_AVAILABLE` with null projection values, probabilities, confidence, and no favorable verdict.

## Recommended future changes

Files to add or minimally change in later phases:

- Add `/api/nfl/players`, `/api/nfl/games`, `/api/nfl/props`, and `/api/nfl/research` handlers that import only `backend.sports.nfl`.
- Add provider-specific adapters below `backend/sports/nfl/services/`; keep raw payloads inside each adapter.
- Add an NFL-namespaced cache service and TTL policy based on data class.
- Add a sport selector in `src/main.jsx` and pass sport into search/home/board components.
- Scope recent-player, search-cache, saved-prop, featured-player, and filter storage by sport before exposing NFL in the UI.
- Add NFL-specific player/team image resolvers rather than branching inside MLB URL helpers.
- Add one feature builder and one model contract per prop family, followed by per-prop calibration.

Files that should not be modified for the NFL engine:

- `backend/analyze.py`
- `backend/stats_mlb.py`
- `backend/research.py`
- `pitcher_matchup.py`
- existing files in `v2/inference/`, `v2/models/`, and `v2/training/`
- existing MLB response formatting in `prediction_core.py`
- existing MLB handlers' behavior in `/api/prediction`, `/api/team-insights`, `/api/game-log-filters`, and `/api/mlb-logo`

The current `app.js` can eventually dispatch by sport at its request boundary, but its MLB rendering logic should not be generalized by adding football conditionals throughout the file. New NFL screens/controllers should consume shared UI primitives and their own response contract.

## Risks and missing requirements

Primary risks are ID collisions, cache-key collisions, accidental zero-defaults, mixing season/week concepts with MLB dates, reusing baseball labels for football, assuming every provider uses the same player/team names, stale injuries/depth charts, post-kickoff prop leakage, and presenting a probability before calibration has been validated.

Before model work, a licensed/reliable NFL data plan is required for:

- canonical players, rosters, teams, schedule, and stable IDs;
- official play/game logs and season totals;
- snap counts, routes, targets, carries, red-zone usage, and depth charts;
- injury and practice participation with timestamps;
- opponent defense by position and scheme/coverage/pressure features;
- venue/dome and weather;
- sportsbook/PrizePicks prop lines and prices;
- historical versions of all inputs for backtesting without look-ahead leakage.

Provider field mappings, update schedules, rate limits, historical depth, corrections policy, licensing, and redistribution rights must be confirmed before selecting adapters. No API response has been assumed in this foundation.

## Implementation phases

1. **Contracts and isolation (this change):** domain/status types, prop registry, provider protocol, persisted sport-state utility, unavailable research boundary, tests, and audit.
2. **Provider evaluation:** select sources, capture documented schemas, implement adapters/validation, canonical ID mapping, freshness policies, and NFL cache namespace.
3. **Read-only NFL experience:** sport selector, NFL search, teams/games, player profiles, game logs, depth/injury/usage views; all model fields remain unavailable.
4. **Feature datasets:** create timestamped historical snapshots and leakage-safe datasets per prop family.
5. **Models incrementally:** begin with one prop, define its features/model/calibration/backtest, then add other props independently.
6. **Board and production hardening:** scheduled refreshes, monitoring, stale-data gates, regression checks for both sports, and gradual NFL rollout.

## Phase 2 provider implementation

The real-data adapter now lives in `backend/sports/nfl/services/nflverse.py`. It normalizes nflverse/nfldata CSV releases for teams, offensive-skill players, schedules, weekly player logs, team game stats, injuries, current depth charts, snap counts, and defensive allowed production. `backend/sports/nfl/identity.py` resolves stable provider IDs and permits normalized-name fallback only for unique players. `backend/sports/nfl/api.py` serializes internal contracts without exposing raw source records.

One authenticated Vercel function, `api/nfl.py`, serves the ready resources. `vercel.json` rewrites `/api/nfl/:resource` to it, preserving clean resource URLs without exceeding the Hobby-plan serverless-function cap. NFL remains disabled in `src/sports/registry.ts`, and none of these endpoints are called by the production UI.

See `docs/nfl-data-provider-matrix.md` for exact field coverage, freshness, source limitations, licensing, and remaining paid-data requirements.

## Phase 3 read-only research UI

The NFL registry is now visible from the Research sport switcher. `src/sports/nfl/SportResearch.jsx` owns the NFL home, real player search, NFL-only recent players, featured players, player header, position-aware prop picker, and the Overview, Trend, Opportunity, Matchup, Opponent, Game, Injuries, and Research Health sections. The component calls only `/api/nfl/*` resources and stores NFL history under an NFL-specific key.

Measured game logs, target and air-yard shares, snaps when an exact PFR crosswalk exists, defensive results, current-week injuries, schedules, venues, roofs, temperature, and wind are displayed when returned by Phase 2. Prop lines, projections, probabilities, matchup scores, routes, coverage, advanced run concepts, forecast precipitation, and betting context render as explicit unavailable states. NFL player URLs use `?sport=nfl&nflPlayer={gsis-id}` without changing the existing MLB hash routes.
## Phase 4 isolated opportunity engine

The `backend/sports/nfl/opportunity.py` volume-only module consumes validated NFL team/player records and returns position-specific opportunity estimates. `allocation.py` reconciles roster capacity and evidence-gates conditional absences. `opportunity_service.py` orchestrates bulk providers concurrently, keeps injury/QB uncertainty explicit and serves `/api/nfl/opportunity` through the existing single NFL handler. `services/play_by_play.py` provides compact validated PBP summaries with a versioned NFL cache. No existing MLB calculations/routes/components were refactored.

NFL Opportunity and Health now display supported volume/role outputs, historical score-state tendencies, source freshness, sample reliability and conditional scenarios. Opportunity loads independently from the remaining research tabs. Football routes, distributions, yardage models and final betting outputs remain unavailable. Review `nfl-opportunity-engine-validation.md` for methodology, chronological 2024/2025 validation and data limits.

## Phase 5 isolated matchup research

`services/matchup_data.py` streams independently validated, field-specific PBP aggregates without changing Phase 4 counting. `matchup_profiles.py` constructs same-season prior-week defensive/offense-strength profiles. `matchup.py` selects prop-specific research features, applies the chronological gate in `matchup_policy.json`, and stores explainable contributions, group caps, reliability, freshness and separate quality/certainty. `matchup_interactions.py` provides tested future charting ports; no missing live coverage/routes/alignment/concepts/pressure are invented.

The existing single NFL API handler serves `/api/nfl/matchup`; NFL `MatchupPanel.jsx` renders supported partial evidence and unavailable components independently of the other tabs. MLB calculations and routes remain unchanged. Read `nfl-matchup-engine-validation.md` for screening results and limitations: this is experimental research evidence, not a full validated matchup model or final prop prediction.

## Phase 6 statistic-only projection boundary

`backend/sports/nfl/projections/` owns separate versioned position/prop models, exposure-shrunk efficiency, validated bulk weekly box scores, walk-forward validation, frozen promotion/feature policy and orchestration. Models consume existing Phase 4 opportunity and underlying Phase 5 defense features; neither MLB nor those engines is rewritten. The old foundation unavailable-result constructor remains a pre-model boundary, while the UI's new `/api/nfl/projection` resource provides mean-statistic outputs independently.

The existing authenticated NFL function handles the new resource without another serverless function. It rejects market lines/sides. NFL Overview shows supported EXPERIMENTAL means with expandable inputs and explicit conditional-role/injury limitations; DISABLED and missing results have no numerical projection. No final distributions, probabilities, confidence or verdict engine exists. See `nfl-projection-engine-validation.md` and its JSON artifact for per-prop holdout errors, availability and disabled models.

## Phase 7B experimental statistical distributions

The existing Phase 7 primitives are preserved. `distribution_engine.py` adds tested
shared football-process candidates and prop-specific empirical forecast residuals;
`validate_distributions.py` captures prior-week forecasts from the optional Phase 6
replay path and performs chronological screening/holdout and convergence checks.
`distribution_service.py` adds summarized NFL-only input-fingerprinted caching,
served by the same authenticated function at `/api/nfl/distribution`. NFL Overview
shows evidence-supported experimental percentiles and histogram markers. Exact
outcome mass remains server-side. No line provider, betting calibration, verdict
or validated overall model is implied. Review the distribution validation report
for all results and point-in-time limitations.

## Phase 8 production gate and prospective shadow tracking

`backend/sports/nfl/production/` audits saved evidence, applies explicit release
requirements, hard-passes all currently ineligible models and prepares validated
decision/Value Board ports. No calibrated current NFL line provider or learned
TAKE thresholds exist: twelve models are SHADOW_ONLY, with zero production-ready.
The local explicit SQLite shadow CLI stores immutable pre-kickoff snapshots and
source-verified final outcomes, while health monitors deduplicated per-version
forecasts. Cloud persistent storage/scheduling is not deployed. The existing NFL
function provides isolated decision/empty-board/admin-health resources. See
`nfl-production-model-validation.md` for exact criteria and remaining blockers.
