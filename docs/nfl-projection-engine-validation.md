# Phase 6 — NFL prop-specific projection validation

Implemented locally, 2026-09-11. MLB calculations are unchanged. No deployment, invented lines, final distribution, Over/Under probability, betting confidence or TAKE/LEAN/PASS verdict. Outputs are **mean statistics**, not betting recommendations.

## Models and promotion

Twelve position/prop models are enabled as **EXPERIMENTAL**, always with LOW_CONFIDENCE outputs. None is VALIDATED. Four implemented candidates are DISABLED after baseline gates. A disabled model returns NOT_AVAILABLE and null projection in the service/UI, even if its candidate point estimate exists in the validation artifact.

| Position / prop | Selected method and inputs | Promotion |
|---|---|---|
| QB passing yards | Phase 4 attempts × shrunk current-season YPA | EXPERIMENTAL |
| QB completions | Phase 4 attempts × shrunk completion rate | EXPERIMENTAL |
| QB pass attempts | Phase 4 reconciled attempts, distinct from dropbacks | DISABLED |
| QB interceptions | Attempts × strongly regressed INT/attempt | DISABLED |
| QB rush attempts | Non-scramble proxy + scrambles + kneels, individually supported | DISABLED |
| RB rush attempts | Phase 4 reconciled carries; no efficiency bonus | EXPERIMENTAL |
| RB rushing yards | Carries × recency/shrunk YPC + fitted opponent YPC residual effect | EXPERIMENTAL |
| RB receptions | Targets × RB-specific shrunk catch rate | EXPERIMENTAL |
| RB receiving yards | Targets × RB-specific recency/shrunk catch rate × yards/catch | EXPERIMENTAL |
| RB rushing + receiving yards | Exact sum of selected component models | EXPERIMENTAL |
| WR targets | Phase 4 reconciled targets; no arbitrary coverage target bump | EXPERIMENTAL |
| WR receptions | Targets × WR-specific recency/shrunk catch rate | EXPERIMENTAL |
| WR receiving yards | Targets × WR-specific recency/shrunk catch rate × yards/catch | EXPERIMENTAL |
| TE targets | Phase 4 reconciled targets | DISABLED |
| TE receptions | Targets × TE-specific shrunk catch rate | EXPERIMENTAL |
| TE receiving yards | Targets × TE-specific shrunk catch rate × yards/catch | EXPERIMENTAL |

QB passing/rushing TDs and player touchdown models are not built: no validated separate team scoring/red-zone/goal-line process. Longest reception remains unavailable because there is no connected reception-length tail model; YPR is not a maximum. QB rushing yards and passing+rushing yards remain unavailable: scramble/design-proxy opportunity exists, but separate yardage efficiency and exact kneel accounting are not yet implemented/validated. Fantasy remains unavailable until component TD/fumble projections and explicit scoring rules exist. These unsupported branches return NOT_AVAILABLE, not fabricated zero projections.

## Input boundary and data flow

Read the architecture audit, provider matrix, opportunity validation and matchup validation before implementation. Existing Phase 4 remains the source of team plays/dropbacks/rush attempts and reconciled player targets/carries/attempts. The new models **do not rebuild volume**. Historical replay calls those existing functions with prior-week records and performs their roster reconciliation.

Real nflverse weekly box scores supply measured attempts/completions/passing yards/INT, carries/rush yards and targets/receptions/receiving yards. The separate Phase 6 bulk adapter validates fields, season, unique player/game identity, team/week and count invariants. Missing fields remain null. Legitimate negative air-yard share and yardage are preserved, while negative counts and receptions > targets are rejected. This fixes validation locally without changing earlier provider or MLB logic. See [provider matrix](nfl-data-provider-matrix.md) and [nflverse dictionary](https://nflreadr.nflverse.com/articles/dictionary_pbp.html).

Pipeline: Phase 4 opportunity → position-specific baseline efficiency → empirical shrinkage/recency → at most one screened underlying Phase 5 opponent feature → expected statistic. Missing forecast weather, pressure, route/coverage/alignment/charted run concepts and personnel tracking do not become numerical adjustments. Current injury/role uncertainty is inherited from Phase 4; conditional injury scenarios are not collapsed into a single unconditional mean.

Passing efficiency uses official QB yards/attempt, not sacks-as-attempts. Receiving yards decompose target earning, catch rate and yards per catch. Actual depth/YAC and catchability are **not** fully separated by this initial model: charts lack catchable-target, routes and tracking. RB models use RB-only peers and shrinkage, while WR/TE use their own position peers and versions. Third-down/two-minute/route/pressure/checkdown adjustments stay unsupported, rather than copying a WR coverage model onto RBs.

## Efficiency, recency, shrinkage and roles

Efficiency uses only same-season games strictly before the forecast. Opportunity is current-team/role-specific; efficiency can retain earlier same-season games on another team because talent should not reset after a trade or two changed-role games. Position must match. Role changes affect Phase 4 opportunity; they do not automatically establish new talent from two games.

Candidate methods:

1. Historical: opportunity × pooled own unweighted efficiency, without shrinkage.
2. Shrink: exposure-weighted own unweighted efficiency regressed toward empirical same-position peers.
3. Recency: weight numerator and exposure by `exp(-week_age/8)`, then shrink. This reuses Phase 4's stable eight-week scale, not its accelerated changed-role scale, because efficiency changes more conservatively.
4. Opponent: recency/shrink baseline plus one fitted underlying defense feature.

Positional priors exclude the player, use only earlier same-season logs, require eight valid peer players and retain actual peer exposure. Prior strength is four typical positional games of metric exposure (median valid game denominator ×4). INT prior exposure is tripled because rare turnovers are noisy. Effective estimate is `(weighted player numerator + prior exposure × peer rate) / (weighted player exposure + prior exposure)`.

Initial gates: at least four observed Phase 4 opportunity games; efficiency needs four valid rate games plus 40 attempts/carries for YPA/completion/YPC, 20 targets/receptions for catch rate/YPR, or 100 attempts for INT. These are conservative initial eligibility rules, **not optimally calibrated minimums**. No median or predictive distribution is invented. Real zero opportunity stays zero; missing opportunity never becomes zero. Legitimate explosive plays are retained and diluted by exposure and shrinkage, not silently deleted/winsorized. Expected tracking metrics such as RYOE/YACOE are unavailable and cannot justify automatic regression adjustments.

## Opponent and matchup adjustment

Models use Phase 5 raw/adjusted defensive metrics and empirical league references, **never matchup quality/score or defense rank**. Four prior opponent games, valid exposure and fresh observations are required for an opponent effect. Same-season offense-strength residual adjustment and raw-only fallbacks remain labelled as in Phase 5.

For each tested model, feature input is `expected exposure × (defensive rate − league reference) × defensive sample reliability`. Fit a nonnegative constrained coefficient [0,1] on 2023 residual statistic errors relative to the recency/shrink baseline, with at least 200 training observations. No coefficient is fitted on 2024/2025 outcomes. The only retained opponent effect is RB YPC, coefficient **0.9104475355**. It is additive in yardage units, not an arbitrary percentage boost. Missing opponent evidence leaves an explicitly limited baseline, not an invented neutral feature.

Tested but not retained: opponent YPA for QB yards, completion environment for QB/receiver completions/receptions, and YAC environment for receiving yards. No commercial coverage, route, alignment, true-pressure, box or blocking feature exists to ablate. Recency was retained for WR receptions/yards and RB receiving yards; simpler unweighted shrinkage won selection for QB passing yards/completions, TE receptions/yards and RB receptions. Repeated EPA/YPA/success, YPRR/YPT/YPR, and targets/share/TPRR do not stack: opportunity is consumed once, receiving uses one catch/length decomposition and at most one opponent efficiency group.

Count projections reconcile to their opportunities (completions/receptions/INT cannot exceed attempts/targets). Any clipping amount is recorded separately. Combined RB yards equal their selected child projections exactly. Correlation/covariance and median remain null, with shared script/team relationships recorded for Phase 7; independence is not assumed.

## Chronological validation design

Reproduce: `python -m backend.sports.nfl.projections.validate`. [Complete JSON results](nfl-projection-backtest-results.json) contain per-model MAE, median AE, RMSE, bias, counts, availability and error slices by position/week/role/reliability/coverage. Frozen serving policy: `backend/sports/nfl/projections/policy.json`.

Walk forward weeks 6–18 within each season. Build team volume, prior-player role and roster allocations from earlier weeks only; use latest previously observed QB for historical starter gating. Player assignment is latest known **past** assignment, not the final roster. Fit opponent coefficients on 2023. Choose each method on 2024, requiring >=100 predictions. Freeze before 2025 evaluation; final evaluation may disable, never tune/increase/select a new feature. Screening and holdout must improve both matched season-mean and eight-week weighted-mean baselines. Historical opportunity × efficiency is a separate ablation/baseline; volume models coincide with their Phase 4 opportunity baseline and are not claimed as a new efficiency improvement.

For combined RB yards, methods are selected on the component props, then their exact sum is evaluated rather than fitting an independent combined number. It cannot serve if either child is disabled. The final-veto policy still needs another untouched season for prospective post-veto evaluation.

## Per-prop 2025 holdout results

Bias is projected minus actual. Units are the prop's statistic. Availability below is candidate availability among eligible **observed outcome logs**, not all live players/games. Disabled models have **zero serving availability**. The JSON also reports known-history roster availability, which is lower and includes forecast players without an outcome log.

| Model | n | Model MAE | Season mean MAE | Weighted mean MAE | Opportunity × historical efficiency MAE | Bias | Candidate availability | Serving |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| RB rush attempts | 778 | 3.184 | 3.227 | 3.187 | 3.184 | -0.601 | 80.3% | EXPERIMENTAL |
| RB rushing yards | 414 | 27.380 | 27.776 | 27.736 | 27.639 | -3.286 | 42.7% | EXPERIMENTAL |
| RB receptions | 377 | 1.416 | 1.481 | 1.467 | 1.420 | +0.041 | 38.9% | EXPERIMENTAL |
| RB receiving yards | 280 | 14.350 | 15.506 | 15.096 | 14.631 | +0.334 | 28.9% | EXPERIMENTAL |
| RB combined yards | 207 | 34.083 | 34.927 | 34.792 | 34.761 | -3.606 | 21.4% | EXPERIMENTAL |
| WR targets | 1444 | 1.814 | 1.885 | 1.848 | 1.814 | -0.252 | 94.6% | EXPERIMENTAL |
| WR receptions | 939 | 1.596 | 1.658 | 1.636 | 1.604 | -0.039 | 61.5% | EXPERIMENTAL |
| WR receiving yards | 720 | 26.204 | 27.466 | 27.289 | 26.684 | -0.072 | 47.2% | EXPERIMENTAL |
| TE targets | 739 | 1.501 | 1.533 | 1.519 | 1.501 | -0.360 | 96.0% | DISABLED |
| TE receptions | 419 | 1.556 | 1.599 | 1.590 | 1.562 | -0.190 | 54.4% | EXPERIMENTAL |
| TE receiving yards | 341 | 20.480 | 20.704 | 20.837 | 20.508 | -2.259 | 44.3% | EXPERIMENTAL |
| QB pass attempts | 270 | 6.658 | 7.032 | 7.016 | 6.658 | +0.940 | 76.1% | DISABLED |
| QB passing yards | 268 | 57.954 | 58.419 | 59.804 | 58.267 | +6.149 | 75.5% | EXPERIMENTAL |
| QB completions | 268 | 4.754 | 4.988 | 5.009 | 4.778 | +1.002 | 75.5% | EXPERIMENTAL |
| QB interceptions | 264 | 0.677 | 0.681 | 0.677 | 0.682 | -0.006 | 74.4% | DISABLED |
| QB rush attempts | 319 | 1.744 | 1.772 | 1.773 | 1.744 | +0.118 | 89.9% | DISABLED |

The twelve enabled models improve both simple matched baselines in 2024 and 2025. Advanced efficiency methods also improve the historical-efficiency baseline in the 2025 rows above, while counts merely reuse Phase 4. Gains are modest, sometimes tiny; no significance or betting-edge claim. TE targets, QB attempts and QB rush attempts fail a screening-season baseline gate despite better 2025 errors. INT also underperforms the weighted 2025 baseline. Underperformers are retained in the report, disabled in the app, and never renamed improvements.

## Reliability, coverage and weaknesses

Every projection carries role/sample evidence, source/fetch times, Phase 4 version and opportunity freshness, underlying defense freshness, injury certainty, efficiency observations/prior and model version. ALL enabled means remain LOW_CONFIDENCE and EXPERIMENTAL. Missing current injury completeness is not proof of health; severe conditional scenarios return no unconditional mean. No usable opportunity, stale role, invalid identity or critical missing efficiency returns NOT_AVAILABLE. Missing advanced features/weather do not force a fake adjustment.

Selected-player unavailable injury roles still block a mean. When supported teammate scenarios produce different opportunity values, no single mean is produced without scenario probabilities. An unsupported teammate-effect scenario may retain only a **clearly labelled conditional Phase 4 observed-role baseline**, LOW_CONFIDENCE, with the unresolved scenarios preserved; it is not an unconditional injury mixture or assumed healthy roster.

UI coverage is labelled **core input coverage**: it measures supported opportunity/efficiency/opponent groups, not comprehensive injury/tracking coverage or probability. Volume models fully consume the supported Phase 4 count contract but still have unknown injury certainty and low overall status. Yardage models show 50% for opportunity+efficiency, 75% when an opponent feature is supported, with forecast environment missing. Scores or a large point mean cannot raise certainty.

Limitations: corrected end-season data rather than archived pregame snapshots; no historical injury/snap/depth scenarios in the main replay; errors conditional on appearing in weekly outcome logs; no artificial zero for missed games; departed players can dilute allocations until new-team evidence is observed; initial minimums reduce availability substantially; no validated distributions/covariance/medians; negative/long-play outcomes are real; current season early weeks intentionally unavailable. There is no completed prospective player-prop validation, so no model is VALIDATED.

Most useful new data: archived forecast-time roster/depth/injury/active lists, route participation/TPRR/catchable targets and current QB connections, actual pressure/coverage/alignment, charted QB rush/scramble yardage, RYOE/contact/blocking, reception-length distributions, red-zone/goal-line/end-zone team/player scoring opportunity and licensed forecast weather. These should earn their place through ablation, not inflate projections because they sound advanced.

## UI, files and verification

NFL Overview now has a statistic-only projection card and expandable opportunity/efficiency/opponent/environment breakdown with selected position/prop version and EXPERIMENTAL/DISABLED label. Mean values use one decimal, rates one decimal percent. Null medians/intervals stay unavailable. Disabled, missing, non-finite and stale previous-prop responses cannot display a number. Existing cards/semantic tokens, keyboard-operable details and responsive evidence rows are preserved; no MLB or whole-app redesign.

New: `backend/sports/nfl/projections/{__init__,efficiency,models,dataset,service,contracts,validate}.py`, frozen `policy.json`; `src/sports/nfl/{ProjectionPanel.jsx,projection-types.ts,projection-ui.js}`; three projection test files; this document and JSON results.

Modified: existing single `api/nfl.py` adds the projection resource, NFL `SportResearch.jsx` connects Overview and its scoped stylesheet keeps status/version text readable on mobile, architecture/provider docs record Phase 6. Existing NFL cache projection domain is reused; no new serverless function or route rewrite. Phase 4/5 and MLB engines remain unchanged.

## Verification results

- 32 new backend projection/service tests and two new frontend result-gate tests.
- NFL backend suite: **100 passed**.
- Full backend suite: **119 run, 117 passed**, with the same two pre-existing MLB/BvP failures in `test_season_batting.py` observed before Phase 6. MLB files were not changed.
- NFL/prop frontend regression suite: **14 passed**.
- `npx tsc --noEmit`, Python compilation, `git diff --check` and `npm run build`: passed. Existing >500 KB client bundle warning remains.
- No configured lint command; lint success is not claimed. Browser/device visual QA is not claimed for this phase.

Tests cover every supported candidate branch, opportunity preservation, receiver decomposition, position-isolated priors/versions, combined-stat reconciliation, missing/zero/non-finite data, small-sample/role/staleness/injury gates, shrinkage and INT regression, opponent traceability, score independence/correlation control, future/different-season exclusion, prior preaggregation equivalence, disabled/unknown policy, API identity/regular-season/line-side gates, source failures and early unsupported-model return without unnecessary statistics downloads.

Real-source checks: current-season Stafford Week 2 returned NOT_AVAILABLE/null because the opportunity sample was insufficient. A historical 2025 Week 10 Stafford service call returned **265.1 passing yards**, LOW_CONFIDENCE/EXPERIMENTAL, `NFL_QB_PASSING_YARDS_V1`, explicitly conditional on the supplied Phase 4 observed-role baseline with unresolved teammate scenarios. This is a historical service sanity check, not a current forecast or betting recommendation. Full responses serialized without NaN. Validation reruns reproduced the coefficient and per-prop results above.
