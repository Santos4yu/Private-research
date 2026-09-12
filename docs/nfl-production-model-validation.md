# Phase 8 — NFL production validation and decision engine

**Zero models are production-ready.** Twelve supported position/prop models remain experimental and SHADOW_ONLY. Four previously disabled candidates stay disabled; twelve unsupported position/prop combinations remain NOT_AVAILABLE and excluded from production. No model methodology, MLB logic, backtest result or existing model version was rewritten. No deployment.

Read opportunity, matchup, point-projection and distribution validation reports before implementation. This audit uses their saved JSON evidence and preserves all limitations. Slight MAE gains and smooth simulations do not qualify a model for betting decisions.

## Exact production acceptance criteria

These are conservative release requirements, **not empirically learned TAKE probability cutoffs**. They can reject current models; they do not establish profitability or causal model quality.

| Requirement | Gate |
|---|---|
| Point, distribution, calibration | All independently VALIDATED |
| Historical screening / untouched holdout | ≥300 / ≥500 forecasts |
| Forward evidence | ≥300 eligible distinct pre-kickoff forecasts across ≥6 weeks |
| Historical stability | ≥2 seasons plus verified period/role stability |
| Point improvement | ≥5% against season mean, weighted mean and historical-efficiency baseline |
| Bias | abs(bias)/MAE ≤0.10 |
| Roster availability | ≥60% |
| Distribution coverage | maximum percentile error ≤5 percentage points |
| Sharpness | ≤1.10× matched baseline interval width, plus verified CRPS improvement |
| Real-line calibration sample / holdout | ≥1000 / ≥500 |
| Calibration ECE / slope deviation / abs intercept | ≤0.03 / ≤0.20 / ≤0.10 |
| As-of evidence | Verified snapshots, untouched evaluation, real timestamped lines and prospective capture |
| Current health | HEALTHY |

Volume models that merely copy Phase 4 opportunity do not beat their own historical-efficiency baseline; they cannot be called advanced improvements. A future dedicated volume-model release needs its own reviewed comparative evidence. Count inclusive percentiles have tie effects; passing this strict gate requires appropriately reviewed discrete calibration, not hiding the lower-tail excess.

## Model status table

| Prop | Position | Point | Distribution | Calibration | Health | Production |
|---|---|---|---|---|---|---|
| Passing Yards | QB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Passing Attempts | QB | DISABLED | DISABLED | NOT_AVAILABLE | DISABLED | DISABLED |
| Pass Completions | QB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Passing TDs | QB | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Interceptions | QB | DISABLED | DISABLED | NOT_AVAILABLE | DISABLED | DISABLED |
| Rushing Yards | QB | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Rushing Yards | RB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Rush Attempts | QB | DISABLED | DISABLED | NOT_AVAILABLE | DISABLED | DISABLED |
| Rush Attempts | RB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Passing + Rushing Yards | QB | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Receiving Yards | RB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Receiving Yards | TE | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Receiving Yards | WR | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Receptions | RB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Receptions | TE | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Receptions | WR | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Targets | TE | DISABLED | DISABLED | NOT_AVAILABLE | DISABLED | DISABLED |
| Targets | WR | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Longest Reception | TE | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Longest Reception | WR | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Rushing + Receiving Yards | RB | EXPERIMENTAL | EXPERIMENTAL | NOT_AVAILABLE | WATCH | SHADOW_ONLY |
| Touchdowns | RB | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Touchdowns | TE | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Touchdowns | WR | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Fantasy Score | QB | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Fantasy Score | RB | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Fantasy Score | TE | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |
| Fantasy Score | WR | NOT_AVAILABLE | NOT_AVAILABLE | NOT_AVAILABLE | DISABLED | DISABLED |

## Existing point accuracy and samples

Metrics below are saved historical candidate results, not new live performance. Bias is projection minus actual. Disabled candidates remain visible here, but have zero serving availability. Total is 2025 known-roster forecast attempts; eligible logs and holdout sample are separate. Unsupported rows have no measured performance.

| Model | Total attempts | Eligible logs | Screen n | Holdout n | MAE | Median AE | RMSE | Bias | Error SD | Season mean MAE | Weighted mean MAE | Historical efficiency MAE | Roster serving availability |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| QB.passing_yards | 515 | 355 | 282 | 268 | 57.954 | 48.489 | 73.807 | 6.149 | 73.550 | 58.419 | 59.804 | 58.267 | 52.0% |
| QB.passing_attempts | 515 | 355 | 282 | 270 | 6.658 | 5.527 | 8.759 | 0.940 | 8.709 | 7.032 | 7.016 | 6.658 | 0.0% |
| QB.pass_completions | 515 | 355 | 282 | 268 | 4.754 | 4.076 | 6.056 | 1.002 | 5.972 | 4.988 | 5.009 | 4.778 | 52.0% |
| QB.passing_touchdowns | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| QB.interceptions | 515 | 355 | 278 | 264 | 0.677 | 0.599 | 0.832 | -0.006 | 0.832 | 0.681 | 0.677 | 0.682 | 0.0% |
| QB.rushing_yards | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| RB.rushing_yards | 1259 | 969 | 439 | 414 | 27.380 | 20.694 | 36.695 | -3.286 | 36.548 | 27.776 | 27.736 | 27.639 | 32.9% |
| QB.rush_attempts | 515 | 355 | 334 | 319 | 1.744 | 1.459 | 2.221 | 0.118 | 2.218 | 1.772 | 1.773 | 1.744 | 0.0% |
| RB.rush_attempts | 1259 | 969 | 755 | 778 | 3.184 | 2.126 | 4.564 | -0.601 | 4.524 | 3.227 | 3.187 | 3.184 | 61.8% |
| QB.passing_rushing_yards | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| RB.receiving_yards | 1259 | 969 | 277 | 280 | 14.350 | 11.551 | 19.332 | 0.334 | 19.329 | 15.506 | 15.096 | 14.631 | 22.2% |
| TE.receiving_yards | 1092 | 770 | 314 | 341 | 20.480 | 16.538 | 26.479 | -2.259 | 26.382 | 20.704 | 20.837 | 20.508 | 31.2% |
| WR.receiving_yards | 2118 | 1526 | 757 | 720 | 26.204 | 21.012 | 34.209 | -0.072 | 34.209 | 27.466 | 27.289 | 26.684 | 34.0% |
| RB.receptions | 1259 | 969 | 359 | 377 | 1.416 | 1.201 | 1.813 | 0.041 | 1.813 | 1.481 | 1.467 | 1.420 | 29.9% |
| TE.receptions | 1092 | 770 | 401 | 419 | 1.556 | 1.273 | 2.031 | -0.190 | 2.022 | 1.599 | 1.590 | 1.562 | 38.4% |
| WR.receptions | 2118 | 1526 | 985 | 939 | 1.596 | 1.334 | 2.083 | -0.039 | 2.083 | 1.658 | 1.636 | 1.604 | 44.3% |
| TE.targets | 1092 | 770 | 715 | 739 | 1.501 | 1.083 | 2.056 | -0.360 | 2.024 | 1.533 | 1.519 | 1.501 | 0.0% |
| WR.targets | 2118 | 1526 | 1413 | 1444 | 1.814 | 1.360 | 2.489 | -0.252 | 2.476 | 1.885 | 1.848 | 1.814 | 68.2% |
| TE.longest_reception | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| WR.longest_reception | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| RB.rushing_receiving_yards | 1259 | 969 | 198 | 207 | 34.083 | 24.901 | 45.077 | -3.606 | 44.933 | 34.927 | 34.792 | 34.761 | 16.4% |
| RB.touchdowns | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| TE.touchdowns | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| WR.touchdowns | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| QB.fantasy_score | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| RB.fantasy_score | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| TE.fantasy_score | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |
| WR.fantasy_score | 0 | 0 | 0 | 0 | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE | 0.0% |

### Improvement versus baselines

| Model | Season mean | Weighted mean | Opportunity × historical efficiency |
|---|---:|---:|---:|
| QB.passing_yards | 0.80% | 3.09% | 0.54% |
| QB.passing_attempts | 5.31% | 5.11% | 0.00% |
| QB.pass_completions | 4.69% | 5.07% | 0.49% |
| QB.passing_touchdowns | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| QB.interceptions | 0.55% | -0.09% | 0.66% |
| QB.rushing_yards | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| RB.rushing_yards | 1.43% | 1.28% | 0.94% |
| QB.rush_attempts | 1.58% | 1.64% | 0.00% |
| RB.rush_attempts | 1.34% | 0.10% | 0.00% |
| QB.passing_rushing_yards | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| RB.receiving_yards | 7.45% | 4.95% | 1.92% |
| TE.receiving_yards | 1.08% | 1.71% | 0.14% |
| WR.receiving_yards | 4.59% | 3.98% | 1.80% |
| RB.receptions | 4.39% | 3.52% | 0.28% |
| TE.receptions | 2.72% | 2.16% | 0.42% |
| WR.receptions | 3.76% | 2.44% | 0.46% |
| TE.targets | 2.05% | 1.18% | 0.00% |
| WR.targets | 3.71% | 1.80% | 0.00% |
| TE.longest_reception | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| WR.longest_reception | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| RB.rushing_receiving_yards | 2.42% | 2.04% | 1.95% |
| RB.touchdowns | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| TE.touchdowns | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| WR.touchdowns | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| QB.fantasy_score | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| RB.fantasy_score | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| TE.fantasy_score | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |
| WR.fantasy_score | NOT AVAILABLE | NOT AVAILABLE | NOT AVAILABLE |

## Distribution evidence, stability and missing calibration

The status JSON carries each prop’s P10/P25/P50/P75/P90 coverage, inner/outer widths, SD, skew and CRPS from Phase 7B. Full per-week/position/role/sample/coverage error slices are included from Phase 6. Historical replay evaluates weeks 6–18; weeks 1–5 are not validated. Home/away, favorites/underdogs and scoring-environment predictive stability have not been separately validated from archived as-of inputs. StabilityVerified is therefore false/unavailable.

The ±20-point Phase 7B experimental coverage gate is much looser than the new production gate. Combined RB yardage P90 coverage was 82.1%, not 90%. Some count lower tails exceed nominal inclusive coverage substantially. No matched-baseline CRPS/sharpness production proof exists. Corrected releases, inherited 2025 point-policy veto and no untouched prospective season prevent VALIDATED promotion.

**Betting Brier, log loss, ECE, reliability curves, slope/intercept and probability buckets: NOT AVAILABLE — NO HISTORICAL TIMESTAMPED LINE DATA.** No current NFL prop-line provider is connected either. No betting EV, profitability, pick-em payout or joint multi-pick probability is claimed.

## Decision rules and abstention

`NFL_DECISION_RULES_V1` consumes only approved validation, calibrated probabilities, exact current line, projection, coverage, role/injury/QB state and model health. Matchup score, H2H and L5 hit rate are not inputs. TAKE/LEAN require PRODUCTION_READY and a separately VALIDATED decision-threshold artifact learned from legitimate line observations. The shipped artifact is null; **all current decisions PASS/NOT_AVAILABLE**.

Future TAKE/LEAN branches accept explicit validated probability/edge cutoffs rather than hardcoding 60%=TAKE. No experimental LEAN is shown as production-grade. A verified reference probability/source is mandatory: 50% is not assumed to be break-even. Statistical edge=projection−line; probability edge=model probability−verified reference; market edge and EV remain null. Confidence stays LOW today; no numeric confidence exists. Future categorical confidence must belong to reviewed decision evidence.

Hard PASS gates: unresolved identity/team/opponent/prop; unresolved starting QB when material; non-active or unverified injury status; non-STABLE role; uncertain opportunity; missing projection; nonvalidated distribution/calibration; non-HEALTHY health; current coverage <90%; missing/provider-unverified/mismatched line; line age >120 seconds; data age >900 seconds; future timestamps; changed analyzed line; incoherent probabilities; missing decision thresholds/reference.

## Value Board and UI

Backend-ready single-prop rows carry player/team/opponent/game/position/prop, exact analyzed line/direction, projection/median/probability, separate edges, model/version/status/health, role/coverage/confidence and verdict. Only production-approved validated components with verified lines can enter. Sort priority is probability edge, calibrated probability, then coverage. Filters support position, prop, team, game, verdict and minimum probability/edge/coverage. Current Value Board is empty with NOT_AVAILABLE status; no placeholder lines or ranked experimental picks.

The existing single authenticated NFL handler adds decision and value-board resources; model-health evidence requires existing admin access in addition to NFL login. It rejects client-supplied line/probability/status decision overrides. NFL Overview shows PASS, EXPERIMENTAL MODEL/shadow-only and expandable eligibility reasons. Research, projections and distributions stay visible independently. No paid confidence tier is implied.

## Health and drift

Local dashboard monitors distinct player/game/prop forecasts for the active model version in last-50/last-100 and observed season windows. Repeated refresh snapshots do not inflate independent evidence. Pending results do not reduce projection availability or become zeros. Report MAE, median AE, RMSE, bias, error SD, availability and pending-result count. No calibration metrics appear without real line observations.

At least 50 eligible results are required for error alarms. WATCH at rolling MAE/reference ≥1.15; DEGRADED at ≥1.25 or abs rolling bias/reference ≥0.25. Reviewed-reference distribution coverage shifts >15 percentage points also degrade. Unreviewed source/schema or feature-version changes degrade immediately. DEGRADED/WATCH disables verdict eligibility. These are conservative safety alarms, not validated betting-confidence estimates. No forward outcomes means WATCH, never fabricated HEALTHY.

## Immutable shadow snapshots and results

Explicit local SQLite ledger has separate NFL tables, primary-key snapshots, foreign-key results and SQL triggers forbidding updates/deletes. Store server UTC time before verified kickoff; preserve player/game/prop, versions, features/timestamps, line (null if absent), direction/probability, verdict/reasons/risks and distribution. No public TAKE/LEAN in shadow mode. Exact verified snapshot line is never overwritten by result or closing line. Final source/game/outcome are required; absent player log remains missing, not zero. Grade hit/miss/push only if an original real analyzed line exists. Repeated settlement cannot overwrite the original result.

The shadow CLI captures real provider forecasts and data failures, settles official final games, and returns internal health JSON. It is **not scheduled or deployed**. Durable local storage is implemented; serverless cross-host persistent shadow storage, automatic final polling and alerts still require infrastructure configuration. No temporary/memory fallback pretends to be durable.

Commands (operator chooses a durable path):

```text
python -m backend.sports.nfl.production.shadow capture --db <nfl-ledger.sqlite> --season <season> --week <week> --player <GSIS> --prop <prop>
python -m backend.sports.nfl.production.shadow settle --db <nfl-ledger.sqlite> --snapshot <snapshot-id>
python -m backend.sports.nfl.production.shadow health --db <nfl-ledger.sqlite>
python -m backend.sports.nfl.production.report --db <nfl-ledger.sqlite>
```

Real local shadow check: QB.passing_yards: 1 stored snapshot(s), 1 distinct forecast event(s), 0 final eligible outcomes; projection availability 0.0; health WATCH. Insufficient opportunity was retained as a null-projection data failure, not a usable statistical prediction. No actual result or hit rate was invented.

## Versions, checks and release blockers

Existing point/distribution/feature versions remain unchanged because their methodologies were not edited. New gate and decision versions are NFL_PRODUCTION_GATE_V1 and NFL_DECISION_RULES_V1. Snapshots preserve all original versions. A future methodology change needs a new version and reviewed evidence; health filters by version.

Tests: 20 new production tests; **141 NFL backend tests pass**, **14 frontend tests pass**, TypeScript checking and Vite build pass. Full backend suite retains the same two pre-existing MLB/BvP failures; MLB deliberately untouched. Existing large client-bundle warning remains. No configured lint command or claimed browser-device visual QA.

Blockers before paid release: no production-ready model; modest/insufficient baseline gains; no genuine archived as-of injury/depth/QB/weather snapshots; incomplete current injury completeness; no untouched post-veto holdout or sufficient prospective outcomes; insufficient distribution calibration/sharpness proof; no real timestamped historical/current lines; no validated decision thresholds or exact payout/EV rules; no durable cloud shadow deployment/scheduler/alerts. Keeping everything SHADOW_ONLY is the intended honest result.

Files: new production policy/gates/audit/decisions/health/ledger/shadow/service/report modules; production types and DecisionPanel; production tests; status JSON and this report. Existing NFL API and NFL UI gain isolated resources. No MLB model changes or new serverless function. Source performance remains transformed nflverse data under the existing provider attribution/license.
