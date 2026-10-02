# Matchup moneylines v2

This is a provisional, transparent heuristic model—not a trained or calibrated
win predictor, a complete roster/PBP model, or a promise of profitable plays.

## What is implemented

All four current moneyline leagues (NFL, MLB, NHL, WNBA) receive both-team
offense/defense scoring grades, recent-form grades, available personnel and
injury-report context, and opponent-specific matchup grades. Null inputs stay
unavailable. Scores are not win percentages. Tied league scoring rates have
identical percentile grades. Small samples and missing personnel reduce evidence
coverage; prior-season scoring baselines are explicitly disclosed.

An offense-against-opposing-defense scoring baseline replaces at most 20% of the
existing power-rating margin, instead of adding the same scoring differential
twice. Existing rest, injury, head-to-head, platoon, bullpen and goalie factors
remain. Verified neutral fixtures remove home advantage and home/road splits.
MLB starters are fixture-specific (including doubleheaders); unrelated daily
team probables are not silently reused. Probables/likely goalies are not claimed
to be confirmed lineups. MLB starter grade also uses available WHIP, K/9,
BB/9 and HR/9 versus the staff baseline; unavailable metrics are omitted.

The displayed final probability remains market-anchored: a quality-weighted 45%
adjustment toward the average of ratings/matchup and ESPN, capped at 7 percentage
points times evidence coverage. Missing evidence lowers that adjustment. The
separate matchup forecast remains visible alongside market and ESPN views.

## Play policy

Top plays require both the combined and matchup win estimates to exceed 53%,
matchup grade at least 60, at least 50% evidence coverage and three books, positive
raw EV >=3%, and conservative EV >=2%. The conservative probability subtracts a
heuristic uncertainty haircut (NOT a measured statistical interval). Strong and
Elite setups need higher grades, probability, coverage, agreement and EV; Elite
also needs a sharp reference. This policy favors supported projected winners;
it is not intended to capture every potentially valuable underdog.

Size is eighth Kelly using conservative probability, multiplied by coverage,
rounded DOWN to quarter units. Play/Strong/Elite caps are 0.5/0.75/1u while the
model is unvalidated. One unit means 1% bankroll. A size below 0.25u is a lean,
not inflated to a minimum bet. Stale/future/missing best-book timestamps block
recommended bets. Stale offers are excluded when fresh books are available;
stale-only snapshots cannot freeze new forecasts. No loss-chasing or forced daily quota exists. Watch prices
must satisfy the same baseline play and minimum-size arithmetic; they are not
available plays and require a new check when prices change.

## Tracking

The old play ledger and all historical losses remain. New plays carry the model
version and grade/coverage at posting; results and stakes are not rewritten.
Every game's FIRST pregame forecast is frozen separately, including passes.
The existing timer settles those forecasts from verified ESPN finals, in bounded
daily batches. Ties do not enter the two-outcome Brier calculation. Record shows
new-model results separately, all-game Brier versus market baseline, and
predicted-versus-observed frequency bins. No future fit or calibration is
advertised merely because those counters exist.

CLV requires kickoff to have passed and a pregame quote in the last 45 minutes;
pending prices and older observations no longer count as closing samples.

## Limitations / next validation

Offense and defense currently use scoring rates, not EPA, pressure, coverage,
special teams or confirmed full-lineup models. Weather and exact travel effects
are not fabricated. The public sources do not verify every starter; those gaps
are shown and limit confidence. Model views can share information and are not
three statistically independent votes. Neither grades nor bankroll stakes are
empirically calibrated. Prospective results are needed before claiming improved
accuracy/profitability or raising size caps. Do not optimize on the old three
settled picks or delete bad outcomes.

Visual QA fixture: `/tests/moneylines-preview.html` on the local Vite server.
Its numbers are explicitly synthetic and never part of live feeds.
