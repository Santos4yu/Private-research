# Phase 7B — NFL distribution and uncertainty validation

Implemented locally. All twelve supported distributions are **EXPERIMENTAL**, and all underlying Phase 6 point models remain **EXPERIMENTAL**. None is VALIDATED. No deployment, betting verdict, invented line or injury probability.

## Historical forecast capture

22,624 forecasts were captured across 2023–2025. The compressed JSONL artifact and forecast manifest retain season/week/game/player/position/team/opponent/prop, Phase 4 volume and role metrics, Phase 6 mean/efficiency/version/coverage, actual outcome and latest input week. Legitimate zeros remain zero; absent outcome logs remain null. Unsupported routes are absent, never inferred from snaps. Information-cutoff timestamp and injury/weather/depth snapshots are null.

This is a prior-week chronological replay of corrected end-season releases, **not perfect point-in-time data**. Point-model policy inherits Phase 6 selection on 2024 and its 2025 veto. Distribution parameters fit 2023; distribution choice uses 2024; 2025 can only disable. No final-holdout tuning. Another untouched season and historical snapshots are needed for stronger validation.

## Method and selection

Candidates: empirical forecast-error residual bootstrap for count/yardage marginals; exact Poisson counts where appropriate; shared football-process beta/binomial opportunities and gamma compound yardage. Gamma/log-normal standalone yardage were not selected because legitimate negative yardage exists; process gamma remains a limited nonnegative candidate. Negative-binomial is not yet fitted; beta-binomial behavior is provided by uncertain beta rates plus binomial draws.

Residual pool is position/prop specific and contains 2023 actual-minus-point-forecast errors. It carries empirical forecast uncertainty and skew, without claiming separately identified parameter variance. It is not a multi-player joint yardage model. Count candidates respect shared simulated team/player capacity. Combined RB yardage is eligible only for the process candidate, never two unrelated marginal resamples.

Selection minimizes 2024 empirical CRPS among candidates with at least 100 eligible forecasts. Final gate needs at least 100 holdout outcomes and inclusive P10/P25/P50/P75/P90 coverage within 20 percentage points of nominal. This deliberately permissive experimental gate is **not calibration validation**. Discrete ties inflate inclusive count coverage; poor count lower-tail coverage is reported, not hidden. CRPS, availability and interval width are reported together.

Historical candidate evaluation uses 512 deterministic draws per forecast. Availability below is conditional on already supported Phase 6 forecasts, not all NFL players. See the JSON artifact for all candidate comparisons; not all candidates use identical eligible samples, a limitation of selection.

| Prop | Point / distribution | Train forecasts | Screen usable | Holdout usable | Method | P10 | P25 | P50 | P75 | P90 | P25–P75 width | CRPS | Availability |
|---|---|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|
| RB.rush_attempts | EXPERIMENTAL / EXPERIMENTAL | 688 | 755 | 778 | residual | 29.8% | 40.7% | 58.5% | 76.6% | 90.6% | 4.38 | 2.329 | 84.4% |
| RB.rushing_yards | EXPERIMENTAL / EXPERIMENTAL | 416 | 439 | 414 | residual | 15.7% | 27.5% | 50.5% | 70.8% | 84.8% | 33.74 | 20.036 | 92.6% |
| RB.receptions | EXPERIMENTAL / EXPERIMENTAL | 392 | 359 | 377 | process | 23.1% | 40.3% | 62.9% | 81.4% | 90.7% | 2.15 | 0.977 | 91.1% |
| RB.receiving_yards | EXPERIMENTAL / EXPERIMENTAL | 304 | 277 | 280 | process | 19.6% | 29.6% | 49.6% | 76.8% | 90.7% | 22.56 | 10.010 | 89.5% |
| RB.rushing_receiving_yards | EXPERIMENTAL / EXPERIMENTAL | 237 | 198 | 207 | process | 15.9% | 29.0% | 51.2% | 69.6% | 82.1% | 40.65 | 24.705 | 92.0% |
| WR.targets | EXPERIMENTAL / EXPERIMENTAL | 1518 | 1413 | 1444 | residual | 25.8% | 42.7% | 61.6% | 79.8% | 91.8% | 2.74 | 1.300 | 78.3% |
| WR.receptions | EXPERIMENTAL / EXPERIMENTAL | 1035 | 985 | 939 | process | 20.4% | 37.5% | 59.6% | 79.0% | 90.6% | 2.45 | 1.119 | 84.0% |
| WR.receiving_yards | EXPERIMENTAL / EXPERIMENTAL | 776 | 757 | 720 | residual | 11.0% | 27.8% | 51.5% | 77.9% | 91.2% | 42.70 | 18.605 | 87.3% |
| TE.targets | DISABLED / DISABLED | — | — | — | — | — | — | — | — | — | — | — | 0% |
| TE.receptions | EXPERIMENTAL / EXPERIMENTAL | 369 | 401 | 419 | process | 18.6% | 32.5% | 55.4% | 80.0% | 90.2% | 2.45 | 1.101 | 84.8% |
| TE.receiving_yards | EXPERIMENTAL / EXPERIMENTAL | 286 | 314 | 341 | residual | 11.1% | 32.3% | 57.8% | 80.9% | 90.3% | 35.51 | 14.715 | 85.2% |
| QB.passing_attempts | DISABLED / DISABLED | — | — | — | — | — | — | — | — | — | — | — | 0% |
| QB.passing_yards | EXPERIMENTAL / EXPERIMENTAL | 272 | 282 | 268 | residual | 8.2% | 27.6% | 51.5% | 78.0% | 92.2% | 98.97 | 41.105 | 94.0% |
| QB.pass_completions | EXPERIMENTAL / EXPERIMENTAL | 272 | 282 | 268 | process | 25.7% | 39.9% | 59.3% | 81.7% | 92.2% | 6.54 | 3.404 | 94.0% |
| QB.interceptions | DISABLED / DISABLED | — | — | — | — | — | — | — | — | — | — | — | 0% |
| QB.rush_attempts | DISABLED / DISABLED | — | — | — | — | — | — | — | — | — | — | — | 0% |

### Additional holdout sharpness and skew diagnostics

| Prop | Mean P10–P90 width | Mean simulated SD | Mean minus median |
|---|---:|---:|---:|
| RB.rush_attempts | 9.32 | 4.05 | 0.92 |
| RB.rushing_yards | 68.80 | 29.47 | 3.70 |
| RB.receptions | 4.11 | 1.63 | 0.21 |
| RB.receiving_yards | 42.83 | 18.18 | 4.55 |
| RB.rushing_receiving_yards | 77.59 | 30.84 | 3.36 |
| WR.targets | 5.50 | 2.31 | 0.47 |
| WR.receptions | 4.66 | 1.85 | 0.22 |
| WR.receiving_yards | 84.74 | 34.52 | 6.10 |
| TE.receptions | 4.62 | 1.85 | 0.23 |
| TE.receiving_yards | 69.33 | 28.87 | 3.75 |
| QB.passing_yards | 189.71 | 78.35 | -3.87 |
| QB.pass_completions | 12.28 | 4.84 | 0.21 |

## Shared state and parameter uncertainty

Simulated total plays vary with Phase 4 observed play SD. Estimated play mean also varies by SD/sqrt(sample). Dropback share and pass-attempt fraction draw beta rates using observed sample exposure. Called rushes occupy remaining non-spike plays. Scrambles use the Phase 4 official-minus-called-rush accounting and occupy non-attempt dropbacks; sacks are the remaining non-attempt dropbacks. Official rush capacity equals called rushes plus scrambles. QB player attempts are drawn separately within team attempts.

Targets and carries use uncertain role shares with effective sample exposure. Changed roles halve effective role exposure without automatically lowering the mean; severe UNCERTAIN role blocks an unconditional distribution. This changed-role rule is an experimental heuristic, not a validated injury response. Catch/completion rates draw beta parameters from real Phase 6 exposure; yardage efficiency draws gamma parameters with exposure-informed variability. Conditional gamma totals depend on simulated opportunities. Full per-play tracking/tail distributions remain unavailable.

RB receiving and rushing share plays/dropbacks/rush capacity in the same draw, then their yardage components sum exactly. A roster multinomial allocation port reconciles player shares to shared capacity and leaves unused capacity unassigned. Complete QB↔receiver yardage coupling is not implemented. Passing+rushing stays unavailable because QB rushing yards is unsupported.

Unresolved injury scenarios have no invented weights and block unconditional distributions. The service returns unavailable conditional-scenario descriptors when alternative opportunity/efficiency is unsupported; it does not fabricate active/out distributions. Complete scenario-specific distributions require supported scenario inputs.

## Convergence and serving performance

Chosen serving count: **25,000**. Tests used 5,000/10,000/25,000/50,000 draws and seeds 11/23/37 for one real holdout forecast per enabled prop. The smallest count passing all contexts was selected. Gate: across-seed diagnostic event probability range ≤1.5 percentage points, mean range ≤5% of statistic scale, P90 range ≤10% of scale. This is numerical convergence, not statistical model certainty.

The threshold is the model mean and is labelled MODEL_MEAN_STATISTICAL_DIAGNOSTIC_NOT_MARKET_LINE. It is not PrizePicks history or betting calibration. Complete means/medians/percentiles/probability runs and runtime are in the results JSON. One context per prop is limited convergence coverage; representative extreme and new-role contexts should be added.

## Service, cache and UI

The existing authenticated single NFL API function adds `/api/nfl/distribution`; it accepts regular-season player/week/prop and rejects line/side inputs. Warm-process NFL cache identity fingerprints football inputs, role/injury context, parameters, seed, point version and distribution version, excluding transient generation/fetch timestamps. Football input changes invalidate it. TTL remains the NFL projection cache policy. Cross-process persistent simulation cache is not implemented.

Only summarized mean/median/percentiles/variance/SD/histogram are sent to the browser. Mean is simulation-derived and separately preserves pointProjectionMean: compound/process mean may differ from the Phase 6 point mean, and residual means include learned forecast bias. Median is never copied from the point mean. Floor=P25 and ceiling=P75, not guarantees. Volatility uses SD/max(1,abs(mean)): LOW <0.35, MEDIUM 0.35–0.75, HIGH ≥0.75. These descriptive labels are not model confidence.

NFL Overview includes experimental distribution cards and a histogram with mean/median/P25/P75 markers. Missing, stale selected-prop responses and unavailable models cannot show distribution numbers. No fake line marker or numeric universal certainty. Role/sample reliability and core coverage remain separate; overall status stays experimental.

## Unavailable props and betting calibration

TE targets, QB attempts, QB interceptions and QB rush attempts remain DISABLED with Phase 6. TDs, longest reception, QB rushing yards, pass+rush yards and fantasy remain NOT_AVAILABLE. No distribution is VALIDATED.

**Betting Brier, calibrated Brier, betting log loss, calibration slope/intercept, probability buckets, Over/Under hit rates, EV and profitability: NOT AVAILABLE — NO HISTORICAL TIMESTAMPED LINE DATA.** No reliable current PrizePicks line feed exists either, so live comparison stays unavailable.

Offline raw over/under/push math and diagnostics are preserved. Future logistic/beta/isotonic calibration artifact transforms require real timestamped-line provenance, a sample gate and a training cutoff preceding evaluated observations. No production curve is fitted, selected or served.

## Verification and limitations

121 NFL backend tests pass; 14 frontend tests pass. TypeScript check and Vite build pass. Full backend baseline retains the same two existing MLB/BvP failures. Existing large client-bundle warning remains. No configured lint command. Browser/device visual QA is not claimed.

Tests cover deterministic simulation, percentile/skew behavior, valid zero/missing distinction, future exclusion, count capacity, called-rush/scramble accounting, shared RB sums, parameter variance, uncertain roles/injury gates, roster reconciliation, CRPS, coverage diagnostics, calibration abstention/cutoffs, summarized caching and invalidation, API line rejection and model status gates.

Weakest areas: permissive experimental percentile gate; count tie effects; inherited final-season point-policy veto; incomplete as-of snapshots; outcome-log conditional availability; pooled residuals do not adapt tails to new roles; process gamma is a simplified candidate and does not model negative per-play yardage or tracking tails; partial opponent features; no validated numeric certainty; unknown current injury completeness; no full multi-player yardage simulation. The process is not a complete drive/play-by-play simulator.

Prioritize timestamped pregame injury/depth/QB/active snapshots, charted rush/route/coverage/pressure and reception-length distributions, and a licensed timestamped historical/current prop-line feed. These are exact blockers to stronger evidence and betting calibration, not reasons to invent values.

New files: distribution_engine.py, distribution_service.py, validate_distributions.py, report_distributions.py, calibration.py, distribution policy/results/forecast artifacts, DistributionPanel.jsx and distribution-engine/service tests. Existing primitives and diagnostic utilities are preserved. Modified: Phase 6 replay gains optional forecast capture; existing single api/nfl.py and NFL SportResearch.jsx integrate summaries; git/deployment ignores exclude the large raw capture. MLB logic is unchanged.
