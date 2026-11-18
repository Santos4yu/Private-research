# NBA prop model: audit and improvement plan (Nov 18)

Asked for by the owner after the five-position DvP backtest showed no gain.
Nothing here is built yet. Production grading stays untouched until a new
model proves itself out of sample and the owner approves.

## 1. How the current model works

The Props tab's Prop grade (`props-grade.js` → `slip-check.js gradeLeg` →
`smart-slip.js assessLeg` → `judge`) is built from four parts:
- the prop model's projection (`prop-model.js`), about 90% of it;
- his hit rates at tonight's line;
- DraftKings' odds, where we have them;
- a 7% nudge from the matchup score (`nba-matchup-score.js`).

After that it gets the daily calibration correction (`learning.js`) and the
injury caps (`newsCap`), then its tier.

- **Expected minutes** (`expectedUsage`)
  - His last 10 games, recent ones counting more (half-life 4 games).
  - Games under 40% of his usual minutes are dropped. That removes injury
    exits, but foul-trouble nights too.
  - Not used: tonight's lineup, rest or back-to-backs, minutes limits, or a
    teammate being out.
  - The spread changes minutes on its own (`blowout`): starters down, bench up.
- **Per-minute production** (`projectStat`)
  - Recent games count more (half-life 12 games), and the rest of the
    season counts at half weight.
  - The rate is pulled toward the median of tonight's board peers (k per
    stat: points, 50 minutes).
  - `readPick` also adjusts his past games for the defenses he faced:
    trust 0.6, at most ±15%.
- **Usage**
  - In the code, "usage" means minutes (opportunities).
  - True usage rate (`context.usage_rate`) feeds the Scout and notes only,
    not the projection.
- **Injuries** (ESPN's report for tonight)
  - His own status: Out voids the pick. Doubtful costs 6 points and
    Questionable 2 (`newsFacts`), and both cap the tier.
  - A teammate Out or Doubtful (`gameContext`):
    - uses his with/without per-game averages, with at least 2 games
      each way;
    - weighted games/(games+5), Doubtful ×0.6;
    - capped 0.8–1.3, applied to the per-minute rate.
  - The matchup score has two absence reads:
    - "teammates out", for bench players only;
    - "opponent out", for everyone, with a chance to sit by status
      (SITS/CODE_SITS).
  - Its fit (`tools/nba-backtest/build2.py`) used who really sat (hindsight).
    Live, it reads the report.
- **Starting lineups** (`lineup-role.js`)
  - "Starter" means he started the team's last game. Tonight's announced
    lineup isn't used.
  - It only changes labels, the blowout role and the matchup score's
    teammate reads.
- **Recent form**
  - Recency weighting, as above.
  - Hit rates at the line for L5/L10/L15/L20/season, weighted
    10/30/10/15/35%, each pulled toward 50% by 6 games. They make up
    10–20% of the chance.
  - Hot shooting (HOT) is pulled back.
  - The "steady" gate needs L10 ≥55% or DraftKings ≥55%.
- **Opponent**, four separate layers:
  1. the defenses he faced (`readPick`);
  2. the matchup score, fit on 2024-26 against "beat his own average",
     not lines;
  3. the team's expected points from the total and spread (`scoringRatio`,
     ±8%);
  4. blowout risk.
- **Market**
  - DraftKings, with the vig removed: 35–50% of the chance.
  - Else the nearest book line moved to PrizePicks' number.
  - Else none: 0.8 projection, 0.2 hit rates.
- **Calibration** (`learning.py`)
  - Daily offsets by chance band, from picks the site logged.
  - Pulled toward the model (PRIOR 40), 3 points a day at most, capped at 15.
- **Measurement**
  - The Props track record: hit rate by band and tier of what the browser
    showed before tip.
  - Missing: log loss, Brier, calibration, projection error and per-feature
    tests.
  - PTS/PR/PA/PRA of one player-night count separately.

## 2. What our tests already show

Data: recorded standard lines, Oct 30–Nov 17 (`dvp_backtest.py`).
- 5,777 props across 1,180 player-nights.
- Overs hit 47.1%.
- The player-average projection picked the right side 50.6% of the time.
  G/F/C scored 50.8% and five-spot 50.9% (±1.3). Always-Under would have
  scored 52.9%.
- A logistic model on (average − line)/line, fitted on the first half of the
  days, scored a log loss of 0.6965 on the second half. A coin flip scores
  0.6931.
- Conclusion: the line is already a strong projection.
- The production chance itself hasn't been scored this way yet.

## 3. Biggest weaknesses (most important first)

1. **The real thing isn't measured.**
   - No log loss, Brier or calibration of the production chance on all lines.
   - When a grade is recorded depends on when someone had the page open.
   - Correlated combos are counted as separate results.
2. **Minutes are a recent average only.** They don't react to the lineup,
   absences, rest, minutes limits and the spread together.
3. **The injury logic is fragile and untestable.**
   - The with/without splits are tiny (2 games each way).
   - Raw per-game averages are applied to the per-minute rate.
   - A teammate out for several games is counted twice: his absence is
     already in the player's last 10.
   - The fit used hindsight absences.
   - No injury reports are archived.
4. **The line isn't used as information.**
   - The chance starts at 50% while Overs hit about 47%.
   - The gap between projection and line is never calibrated.
5. **Calibration is crude and selection-biased.** It learns only from the
   picks the site logged.
6. **Many hand-tuned layers were never tested together on lines.**
   - Each was tuned against a different target.
   - They can double count, e.g. pace in both the odds total and the matchup.
7. **The prior is "tonight's board peers"**, not players in the same role.
8. **The L5/L10 windows re-count the games the projection already uses.**
   - This adds noise.
   - The L10 gate can block good picks.

## 4. Proposed model

Python, server-side, in shadow only.

- **A. Minutes**
  - Inputs:
    - recent and season minutes, and whether he started last game;
    - the dated depth-chart spot (`depth.py`, read ≥15 minutes before tip);
    - rest, back-to-backs, and games since his return;
    - the spread and his own status;
    - teammates' expected missing minutes by position (the report × the
      chance to sit);
    - a role-change flag.
  - Output: mean, spread, and the chance of a short night.
  - Fit on about 3 seasons of box scores. Absence effects are learned from
    real absences, but always applied (live and in tests) by the pre-game
    report's odds.
- **B. Rates**
  - Per stat, recency-weighted, with empirical-Bayes shrinkage toward the
    same role (position × minutes band × usage tier).
  - Role-change down-weighting (a trade, a new starter).
  - A pooled usage-redistribution effect replaces the per-player splits.
  - One combined opponent factor per stat (pace + defense per possession).
- **C. Distribution**
  - Minutes uncertainty × rate gives a per-stat distribution.
  - Combos are simulated jointly. Output: P(over), P(under) and P(push).
- **D. Market-aware calibration**
  - Combines: the model's chance, the projection−line gap, the stat, and
    DraftKings with the vig removed plus line movement (`line_archive.py`).
  - Walk-forward, refit weekly.
  - Baselines it must beat: each stat's base Over rate, the player average,
    DraftKings, and production.
- **E. Evaluation**
  - Walk forward by US day, with a leak audit on every input's timestamp.
  - One standard line per player-night-stat (the closing line).
    Goblins/Demons are separate, DNPs void, pushes out.
  - Metrics:
    - minutes MAE and stat MAE/RMSE;
    - log loss and Brier;
    - a reliability table with calibration slope and intercept;
    - hit rates at ≥54% and ≥57% with Wilson intervals;
    - return under the payout tables;
    - Over-only results (the Parlay Builder takes no Unders).
  - Correlation: block bootstrap by game night. Top picks are capped at one
    per player-night, and slips are tested with `slip-correlation.js`.
  - Feature gate: a feature is added only if out-of-sample log loss improves
    with a CI that excludes 0 and the sign holds in both halves.
  - Promotion gate:
    - about 7 weeks (about 3,000 player-nights) recorded in advance;
    - beats both production and the market on log loss;
    - calibration slope 0.9–1.1;
    - top-pick hit rate ≥ production's at similar volume;
    - then the owner decides.

## 5. Plan, in order

0. **Start recording and measuring.**
   - Archive injury reports with timestamps several times before tip, on
     the existing timer. Add tonight's starters too, if ESPN shows them
     before tip.
   - Stamp each props-record row with its minutes before tip.
   - An admin report scores production on all recorded lines: log loss,
     Brier, calibration and tiers, against the base rate and the player
     average.
   - One push. Grades unchanged.
1. **Minutes model.**
   - Offline on box scores first, against the last-10 average.
   - Then in shadow.
2. **Rates:** the role prior, usage shift and role changes.
3. **Distribution and market-aware calibration.**
4. **About 7 weeks of shadow running**, with a weekly admin report and
   feature ablations.
   - Layers that don't need injury reports can be replayed on the lines
     recorded since Oct 30, for an early read.
5. **The owner's decision.**

## 6. Data and costs

- **Box scores:**
  - SportsDataverse 2024-25 and 2025-26 (free, already used), plus our
    store for this season.
  - About 70k player-games.
- **Lines:**
  - Our archive since late October: about 300 standard lines and about 60
    player-nights a night.
  - No free past seasons.
- **Injury reports:**
  - ESPN (free): start archiving now.
  - Optional history: the NBA's official injury report PDFs (free; needs
    parsing; terms to check).
- **Lineups:**
  - The dated depth charts (have), plus box-score starter flags for training.
  - Announced starters near tip, if ESPN shows them (to be checked).
- **DraftKings:** only the current Odds API budget. No new spend.
- **Costs:**
  - $0 new data.
  - About 5–6 Vercel pushes in all.
  - Seconds of function time per run, on the existing timer.
  - KV: a few hundred KB a day (estimate).
  - GitHub Actions: under about 100 minutes a month.
  - About 6–8 sessions of work, plus about 7 weeks for the shadow results.
