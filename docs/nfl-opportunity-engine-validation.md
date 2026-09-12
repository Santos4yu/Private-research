# NFL volume and opportunity engine: Phase 4

Phase 4 implements an isolated volume engine and its UI integration. It does not implement yardage, receptions, touchdowns, final matchup scores, Monte Carlo, Over/Under probability, betting confidence, or verdicts. Nothing was deployed. MLB model logic, routes and components were not changed.

## 1. Team volume methodology

Real [nflverse play-by-play](https://github.com/nflverse/nflverse-data/releases/tag/pbp) is streamed from compressed CSV into compact team/game and player/game summaries. Required identifiers and binary opportunity indicators are validated. Deleted plays, two-point attempts, penalties/no-play records and special teams are excluded. Kneels and spikes are counted explicitly. Team expected plays blends recency-weighted offensive plays and the opponent's allowed offensive plays equally when both exist. Without opponent history, estimates remain low confidence.

True dropbacks include attempts, sacks and scrambles, excluding spikes. Called rush attempts exclude scrambles and include kneels. Team attempts are derived from dropbacks using measured sack and scramble rates, with spikes included in attempts. No underdog/pass-over shortcut is used.

Accounting is **dropbacks + called rushes + spikes = offensive plays**. Official rush attempts include scrambles already counted in dropbacks, so summing dropbacks and official rush attempts would double-count scrambles. The engine exposes both definitions. Team/player attempt caps are enforced even with spikes. Plays and drives use consistent counted-offensive-play definitions; drives containing only special teams or an empty end-half possession are excluded. Expected possessions use that same disclosed definition. Plays/drive is a ratio of supported estimates.

Score-state profiles measure prior-game leading (>7 points), close (-7 through +7), and trailing (<-7) offensive exposure, dropback rate, rush rate and within-drive clock pace. They require four prior games and at least 30 recency-weighted plays in each state. Weak profiles remain unavailable/low confidence. Historical exposure provides the baseline script mix, not calibrated future state probabilities. This phase does not estimate spread-conditioned score transitions, PROE, drive efficiency or a weather effect. Historical pace is descriptive rather than a second adjustment that would double-count observed play volume.

Weekly-only fallback uses attempts + carries + sacks suffered for plays, and leaves true dropbacks and drives unavailable. Missing scramble classification is never silently treated as zero.

## 2. Player opportunity methodology

WR/TE/RB targets use player targets divided by same-game team attempts, multiplied by expected team attempts. Carries use player carries divided by same-game official team carries. QB attempts use observed QB attempt share, distinct from dropbacks. Low-share backups do not receive a starting-QB attempt estimate. A fresh depth chart can identify the starter; otherwise certainty is lowered. Position-specific outputs do not force receiver data into QB schemas.

Exact PFR/GSIS crosswalks connect snap counts. Expected snaps use observed player snaps per counted team play; invalid shares above one are rejected. Snap counts never become fabricated routes. QB scrambles, kneels and non-scramble/non-kneel rushing opportunities use independently observed PBP shares. The latter is labelled a **designed-rush proxy**, because aborted plays are not charted play design. RB receiving/lead-carrier/committee descriptors use observed target/carry shares (receiving: target share >=10% and carry share <40%; lead carrier: carry share >=50%), not a universal RB formula.

## 3. Recency

Observation weight is `exp(-week_age / 8)`. The eight-week scale is an initial modelling choice, not a calibrated optimum. Same-season games strictly before the forecast week are used. Different-team logs are excluded. After a sustained role change the two post-change games use `exp(-week_age / 3)`; verified depth-rank changes cut off games before the effective week. No fixed L3/L5 percentage blend is used.

## 4. Shrinkage and reliability

Shares regress toward the available larger same-player sample with four pseudo-games. After a role change, prior strength falls to one pseudo-game so the old role cannot dominate. No fake league/positional prior is inserted. With no larger sample, one observed game cannot magically create stability: effective sample size below four is LOW, four to below eight is MEDIUM, eight or more is HIGH. Effective sample size is `(sum(weights)^2)/sum(weights^2)`. Opponent reliability can lower team reliability. These grades describe evidence, not betting confidence.

## 5. Role changes

Two recent games with a mean share change of at least 15 percentage points against the earlier sample flag INCREASING/DECREASING. Snap-share changes use the same sustained criterion. Verified timestamped depth-rank changes are mapped to the first affected game week and supersede old role observations. No post-change sample returns unavailable. Depth-chart snapshots after the forecast cutoff are excluded. Unverified event inputs cannot alter estimates. Trade handling excludes former-team games; coaching/QB replacement causality is not invented from box scores. Role stability and sample reliability remain separate.

## 6. Vacated opportunity and roster competition

Target, carry and QB-attempt allocations are reconciled across the roster. Excess is scaled down; missing/unassigned volume stays unassigned. Uncertainty scales with reconciliation. No leftover volume is automatically donated to the next depth-chart player.

Conditional absence redistribution requires at least three verified historical no-offensive-participation games and three recipient observations in those games. Current exact snap records with explicit zero offense snaps can supply evidence; a missing row is never an absence. Multiple inactive players require the intersection of their verified absence games. Recipient shares shrink toward their larger profile and reconcile to team capacity. Weak evidence returns unavailable redistribution while reporting known vacated supported metrics. Routes, air yards and red-zone vacated usage stay unavailable when not modelled. The generic conditional engine accepts verified evidence; the live provider does not fabricate historical injuries.

## 7. Injury scenarios and hard fails

OUT/DOUBTFUL/QUESTIONABLE or uncertain roster status prevents an unconditional player projection. Active and inactive conditional scenarios are separate and have **no probability**. Uncertain teammates can expose conditional inactive scenarios only where absence evidence exists. Missing injury reports do not prove health. Unknown starting QB or injury certainty downgrades an otherwise supported estimate. Unresolved identity/team, no prior team games, no usable role observations, or no role observation within three weeks returns unavailable. The three-week recency gate accommodates a bye and a short absence without projecting a long-stale role. A fresh depth chart conflicting with a player's QB role prevents backup estimates.

The provider's [availability documentation](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) reports its injury source died after 2024. A returned newer file alone is not proof of a complete current injury service; the engine retains UNKNOWN/partial certainty. A licensed reliable injury/active-list source would materially improve this boundary.

## 8. Uncertainty and abnormal games

Team estimates carry weighted observed standard deviation/variance where multiple observations exist. Blended team variance includes between-team mean differences. Player uncertainty combines role-share and team-volume variability under an explicitly approximate independence assumption. Single games have unavailable variance, not zero variance. UI labels variability as **not a prediction interval**. Historical medians are available for directly observed team counts; a player forecast median is not fabricated from a mean share. Overtime and extreme score states are flagged and retained, not silently removed. Early injury, ejection, QB-change causality and unusual-weather exclusions require additional evidence.

## 9. Files

New:

- `backend/sports/nfl/opportunity.py`: team/role/opportunity calculations.
- `backend/sports/nfl/allocation.py`: roster and verified-absence reconciliation.
- `backend/sports/nfl/opportunity_service.py`: concurrent bulk provider orchestration.
- `backend/sports/nfl/opportunity_contracts.py`, `src/sports/nfl/opportunity-types.ts`: volume-only output contracts.
- `backend/sports/nfl/services/play_by_play.py`: validated streaming PBP adapter and compact cache.
- `backend/sports/nfl/validate_opportunity.py`: chronological evaluation.
- `tests/test_nfl_opportunity.py`, `tests/test_nfl_opportunity_service.py`: explicit mock fixtures and invariants.
- This report and `docs/nfl-opportunity-backtest-results.json`.

Modified: existing NFL `api/nfl.py`, cache, nflverse adapter (sacks and optional depth history), NFL UI/core/styles/tests, provider matrix and architecture audit. Existing depth endpoint remains latest-only by default. The API still uses one Vercel function; no route/function proliferation.

## 10. UI and health

Opportunity shows supported expected plays, dropbacks, called/official rush attempts, team attempts/drives, and position-specific snaps/targets/carries/QB attempts/rushing components. It shows role share, role status, sample size/reliability, observed variability, source freshness, script evidence and conditional scenarios. Numbers use sensible one-decimal display rather than full raw floats. Research Health incorporates opportunity data, role, volume and sample certainty. NFL opportunity fetches independently so cold PBP loading cannot block other research tabs.

## 11. Unavailable metrics

Routes, route participation, TPRR, first reads, personnel/scheme adjustments, charted designed runs, reliable current injury completeness, spread-conditioned script forecasts, historical as-of weather and injury snapshots, coverage scores and air-yard/red-zone opportunity projections remain explicit unavailable fields. Expected touches remain unavailable because targets are not receptions; the requested receptions model is deliberately deferred. This is the safe data boundary required by Phase 4, not fabricated completion of unavailable metrics.

## 12. Chronological volume backtests

Reproduce with `python -m backend.sports.nfl.validate_opportunity --season 2024` and `--season 2025`. Parameters were held fixed. Each forecast uses only earlier same-season games. Team evaluation covers weeks 6-18; player evaluation requires four earlier same-team outcome logs. Profiles reconcile the full roster known from earlier logs before scoring. Latest previously observed QB is used for historical starter gating; future depth charts/injuries are never applied.

| Metric | 2024 MAE | 2024 mean baseline | 2025 MAE | 2025 mean baseline |
|---|---:|---:|---:|---:|
| Plays | 6.619 | 6.778 | 6.871 | 7.045 |
| Dropbacks | 6.281 | 6.458 | 6.211 | 6.482 |
| Team rush attempts | 5.769 | 5.866 | 6.218 | 6.376 |
| Team pass attempts | 6.035 | 6.192 | 5.831 | 6.194 |
| Drives | 1.357 | 1.390 | 1.255 | 1.290 |
| Player targets | 1.656 | 1.679 | 1.577 | 1.620 |
| Player carries | 3.039 | 3.160 | 2.973 | 3.064 |
| QB attempts | 7.045 | 7.504 | 6.823 | 7.409 |

Both seasons have 388 team forecasts. Player counts and unavailable counts are in the JSON artifact. **Zero allocation/accounting invariant violations** were found. Routes cannot be backtested without routes. Improvements over the matched historical-mean baseline are modest. Earlier evaluation without the stale-role gate had worse 2024 target error; gating unavailable stale roles changes coverage as well as error, so the final improvement is not a pure accuracy gain. This is not proof that a yardage/betting model is ready.

Limitations: corrected end-season releases rather than true historical as-of snapshots; forecasts are conditional on appearing in outcome logs and do not score missed games; roster membership from past logs may retain departed players; historical snap/depth/absence scenarios are unit-tested but not included in the main backtest. No future observed statistics enter forecasts, but point-in-time provider corrections still require a snapshot store for a production replay.

## 13-15. Tests and checks

48 focused backend tests pass (NFL foundation/opportunity/service plus existing matchup-scoring regressions). 12 frontend tests pass. Type checking, Python compilation, diff whitespace checks and production build pass. The existing >500 KB bundle warning remains. No lint command/configuration is present in package.json, so lint success is not claimed.

Tests cover true PBP dropbacks/sacks/scrambles/deleted plays, plays partition, attempts caps, target/carry roster reconciliation, randomized capacity invariants, role jumps/drops, structural changes, snap projection without invented routes, tiny-sample shrinkage, no future leakage, missing/invalid values, injury uncertainty/conditional scenarios, verified absence gates, no blind redistribution, position-specific outputs, abnormal-game flags, source failure gates and the existing single NFL API route.

Full test discovery retains the two pre-existing MLB season-batting test failures (`104 != 4` and `10 != 0`); these are unrelated and were not changed under the explicit MLB preservation rule. Current-season live service checks confirm one-game estimates remain LOW_CONFIDENCE and no-processed-game teams return NOT_AVAILABLE. UI build is verified; a new mobile browser visual check was not performed.

## 16-17. Weakest parts and useful data

The weakest pieces are simple script exposure rather than predictive score transitions, QB starter/usage uncertainty, one-game current-season samples, small role-change samples, and incomplete current injury/route data. Variance is descriptive/approximate rather than a calibrated distribution. Target accuracy gains are small and conditional on availability gates, not broad evidence of a mature final prop model.

Reliable current injuries and game active lists; timestamped roster/depth snapshots; route participation/TPRR; charted QB designed runs; historical spread and score-state transition datasets; neutral pace/drive-efficiency features; and persisted historical provider versions would improve the next volume iteration. A shared persistent compact-summary cache would also reduce cold serverless downloads across instances; current caches use warm-process memory and a versioned temporary compact file, with no raw PBP sent to clients.
