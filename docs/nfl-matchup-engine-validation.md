# Phase 5 — NFL matchup engine validation

Implemented locally, 2026-09-11. No deployment, final prop projection, probability or betting verdict. MLB model files remain untouched. This is a **partial, experimental research engine**, not a validated full matchup model.

## Implemented data and boundaries

The separate NFL PBP adapter validates schema, identities, binary indicators and numeric fields before streaming compact aggregates. Only regular-season offensive pass/run plays are used; deleted plays, two-point plays, kneels and spikes are excluded. Missing numeric fields do not become zero. Each metric retains its own sum, valid exposure count and number of games. Source URL, transformation version, fetch time and source modification time accompany outputs. Warm-process and temporary-file caches hold aggregates for 30 minutes; NFL matchup responses have separate 10-minute keys including season, week, player and prop.

Defensive diagnostics: EPA/dropback, pass success, YPA, completion rate, CPOE, explosive-pass rate (gain >=20), YAC/completion, sacks/dropback, scrambles/dropback, EPA/called rush, run success, YPC, explosive-run rate (gain >=10), stuff rate (gain <=0), target depth. Called-run metrics exclude scrambles; the QB rushing branch never reuses the RB defense score. Pass attempts exclude sacks even when the source pass-attempt indicator includes them.

Player diagnostics: measured target efficiency, catch rate, target depth/deep-target frequency, YAC, rushing efficiency, explosive runs and QB sack/scramble behavior. Descriptive short/intermediate/deep exposure, left/middle/right run splits and current-QB-to-receiver connections are retained with samples. These are **not** routes, run concepts, catchability or first-read charting and carry no independent score weight.

| Requested area | Production implementation |
|---|---|
| Coverage / man-zone | NOT AVAILABLE. Frequency weighting, separate QB/player metric normalization and split shrinkage ports are unit-tested only. No live charting adapter. |
| Routes | NOT AVAILABLE. Tested matched player/defense interaction port; no inferred routes or YPRR. |
| Alignment / individual CB | NOT AVAILABLE. Tested alignment port; no assumed shadow matchups. |
| Run concepts / box / RYOE | NOT AVAILABLE. Tested comparable player/defense/blocking concept port. Direction remains descriptive. |
| Trenches | Limited sack-rate evidence from offense and defense; explicitly not a full OL/DL blocking model. |
| Pressure / blitz | NOT AVAILABLE. Tested actual-pressure exposure port; sacks and QB hits never masquerade as pressure rate. |
| YAC | Defensive YAC evidence gated by actual receiver YAC share and reception sample. Experimental interaction. |
| Explosives | Run-explosive defensive signal retained; pass-explosive score disabled by validation. |
| Game script | Consumes Phase 4 team/player opportunity and historical score-state profile as context. No second bonus or claimed forecast state probabilities. |
| Personnel | Provider availability and named injury reports with affected component categories; no arbitrary points. Current injury completeness remains uncertain. |
| Environment | Roof/venue context. No timestamped forecast adapter, no weather score and no normal-weather bonus. |

Coverage, route concepts, alignment, box counts, RYOE/contact yards, missed tackles, separation, first reads, detailed pressure/blitz, blocking grades, shadow assignments and personnel packages require evaluated new charting/tracking providers, potentially commercial licensing. No vendor or API response has been invented. Weather needs a forecast provider; complete current injuries need a reliable active-report source. See [capability assessment](nfl-phase5-capabilities.md), [PBP dictionary](https://nflreadr.nflverse.com/articles/dictionary_pbp.html), [provider schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html), and [historical charting dictionary](https://nflreadr.nflverse.com/articles/dictionary_ftn_charting.html). Historical participation availability does not establish current coverage availability.

## Opponent adjustment

Every forecast uses earlier weeks in the same season. For each defense allowance, estimate the opposing offense's prior rate from at least two earlier games excluding that defense. Stabilize that rate with one typical game's exposure at the empirical league mean. The defense residual is observed allowance minus stabilized offensive strength. Add the exposure-weighted residual to the forecast-time league mean after at least three eligible adjusted games. Otherwise explicitly label RAW_ONLY.

The league stabilization mean uses all games available before the forecast, not the historical matchup's original information snapshot. It never uses the forecast outcome. This is a forecast-time offense-strength residual estimate, **not** individual QB/receiver adjustment or a causal rating. Adjusted coverage is exposed, and raw/adjusted metrics both remain inspectable.

## Scoring, samples and correlation controls

Scored metrics require four prior defensive games, a valid metric sample, and at least eight defenses with a non-degenerate same-season reference distribution. Let `z` be oriented metric distance from the empirical defensive mean in standard deviations. Weak defense is favorable; sack rate has reversed direction.

`reliability = exposure / (exposure + 4 × typical game exposure)`

`score = 50 + 50 × tanh(z / 2) × reliability`

This bounded research transform makes 50 neutral and pulls small samples toward neutral. It is not fitted hit probability. The four-game prior is a documented regularization choice, not a measured optimal constant. Reliability categories are HIGH >=0.75, MEDIUM >=0.50, otherwise LOW. Freshness is 1 for opponent observations within two weeks, 0.5 within three, and 0 beyond three; stale observations cannot generate a score.

Component certainty is reliability × freshness × (0.5 + 0.5 × adjusted exposure coverage). Sack-only trench coverage is conservatively 20% because actual protection/pressure charting is absent, and its certainty is reduced accordingly. Offense and defense sack evidence each receive half of that component. This coverage factor is a disclosure convention, not a calibrated probability. Receiver YAC score movement is scaled by measured YAC share of catch yards and `receptions/(receptions+20)`, requiring at least three player games. Those interaction constants/blends are experimental and not independently validated.

Prop selection is explicit: receiving efficiency, receiving volume, passing efficiency, rushing efficiency and QB rushing have separate feature selection. Attempts/targets/carries consume opportunity context, not a reused efficiency number. Compound, fantasy and generic TD branches remain unscored until separate branch composition exists. Passing TD/interception pages expose only passing-environment context; no TD/interception outcome model exists.

EPA, YAC and explosive efficiency share **one capped group**. Sack context forms another group. Supported components share their group; supported groups share the composite. Correlated metrics do not become multiple independent votes. Each input stores raw and adjusted values, reference, normalized value, weight, reliability, sample and final contribution. Group contributions reconstruct the composite exactly.

Scored-component coverage is the sum of supported component coverage divided by all twelve requested component slots. Overall certainty is average supported certainty multiplied by that coverage. Missing slots never become numerical neutral observations. Quality remains partial evidence and every scored overall result is LOW_CONFIDENCE. Quality and certainty are separate; opportunity limitations are explicit risks and quality never increases projected opportunity.

## Chronological validation

Reproducible command: `python -m backend.sports.nfl.validate_matchup`. Results: [JSON artifact](nfl-matchup-backtest-results.json); production gate: `backend/sports/nfl/matchup_policy.json`.

Train single-feature diagnostic slopes on 2023. Screen features on a separate 2024 season; require a positive slope, at least 100 observations and improvement over the offense's own prior-rate baseline. Freeze selection before 2025 evaluation. Final evaluation can only disable, never tune or increase a feature. Each feature has 388 eligible team-game observations per season. Forecast features use only earlier weeks; outcomes are evaluated afterward. Minimum four prior offense/defense games and forecast week >=6.

| Feature / outcome | 2024 baseline MAE | 2024 feature MAE | 2025 baseline MAE | 2025 feature MAE | Score enabled |
|---|---:|---:|---:|---:|---|
| Pass EPA / YPA | 1.471741 | 1.490814 | 1.460771 | 1.440207 | No |
| Run EPA / YPC | 1.032285 | 1.025093 | 1.117753 | 1.113539 | Yes |
| Completion rate | 0.074665 | 0.074816 | 0.073123 | 0.071533 | No |
| Sack rate | 0.037955 | 0.037936 | 0.038714 | 0.038529 | Yes |
| YAC/completion | 1.378420 | 1.377431 | 1.449211 | 1.439780 | Yes |
| Explosive-pass rate | 0.044002 | 0.044175 | 0.043743 | 0.043907 | No |
| Explosive-run rate | 0.054055 | 0.053906 | 0.057531 | 0.057154 | Yes |

Rate MAE is in fractions, not percentage points. Gains are small; no statistical-significance or betting-edge claim. Rejected metrics stay visible as diagnostics. The final-veto policy still needs another untouched season for prospective validation.

This tests **individual team-level features**, not the composite transform, offense/defense sack blend, receiver YAC gating, individual player efficiencies or commercial charting interactions. Historical corrected releases are not archived as-of injury/depth/provider snapshots. Coverage/route/alignment/run-concept/true-pressure historical predictive validation is blocked by missing connected data, so those live scores remain unavailable. Additional player-level holdout and prospective snapshot validation are required before Phase 6 uses these interactions as strong evidence.

## UI and verification

NFL Matchup now shows selected-prop quality, certainty, scored-component coverage, twelve component cards, contributing evidence, actual edges/risks, raw/adjusted defensive diagnostics, target-depth and current-QB connection context, personnel/environment and freshness. Scores are rounded to integers; percentages and metrics use appropriate precision. Missing values read NOT AVAILABLE. Layout uses the existing NFL cards, mobile single-column evidence, keyboard focus and expandable details; no app redesign. Visual browser/device QA has not been performed in this phase.

Real source checks: 2026 Matthew Stafford Week 2 returned NOT_AVAILABLE/null quality/null certainty/0 coverage, correctly refusing an insufficient early-season defensive sample. An end-to-end provider/opportunity/injury service check serialized without NaN. Historical 2025 Saquon Barkley Week 10 returned partial quality 48/100, certainty 10/100, scored-component coverage 17%; no inference of a hit chance.

Tests: 23 new Phase 5 tests cover defense normalization, bounded neutral scores, invalid references, frequency weighting, small-sample shrinkage, route/alignment/concept required evidence, true-pressure requirements, chronology/opponent adjustment, missing advanced data, prop-specific selection/QB isolation, validation gates, freshness, group reconstruction, certainty, no silent zero, no final projection fields, single API dispatch, identity/position/regular-season validation and safe provider failures.

- NFL backend suite: **68 passed**.
- Frontend NFL/prop regression suite: **12 passed**.
- Full backend suite: **87 run, 85 passed**, same two pre-existing MLB/BvP failures in `test_season_batting.py`; MLB code deliberately unchanged.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed; existing >500 KB bundle warning remains.
- No configured lint script in this repository; no lint success is claimed.

## Files and follow-up

New: `matchup.py`, `matchup_profiles.py`, `matchup_interactions.py`, `matchup_service.py`, `matchup_contracts.py`, `matchup_policy.json`, `services/matchup_data.py`, `validate_matchup.py` under `backend/sports/nfl/`; `src/sports/nfl/MatchupPanel.jsx`, `matchup-types.ts`; two matchup test files; this report, capability assessment and JSON validation artifact.

Modified for Phase 5: existing single `api/nfl.py` handler, NFL cache enum, NFL `SportResearch.jsx` and stylesheet, provider matrix and architecture audit. Phase 4 files already present in the working tree are preserved; they are not MLB changes. No new serverless function or route rewrite.

Weakest areas: scarce current-season evidence; absent tracking/charting and complete injury feeds; tiny feature-validation improvements; unvalidated player-specific composite interactions; conservative coverage convention; no durable cross-process snapshot cache; no shadow/OL protection/true-pressure modeling. Prioritize licensed/current charting with exposure counts, reliable active and injury snapshots, actual route/coverage/pressure/blocking data, forecast weather, archived forecast-time inputs and player-level out-of-sample efficiency validation. Do not add display metrics merely because they sound advanced.
