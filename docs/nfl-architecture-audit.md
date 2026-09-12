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
