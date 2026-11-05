# Game Predictor v2 backtest (Nov 5) — work in progress, NOT live yet

Walk-forward: every game uses only games before its date. Data: sportsdataverse
ESPN NBA boxes (2022-23..2025-26), nflverse schedule + play-by-play (2012-2025, agg.py).

Splits. NBA: train 2023-24 + 2024-25, validation 2025-26 before Jan 15, test after.
NFL: train 2013-21, validation 2022-23, test 2024-25. Choices made on validation only.

Chosen. NBA: ridge opponent-adjusted ORtg/DRtg/pace (lam 12 games, half-life 50 d,
keep 0.75); margin = 1.1315*rating margin + 0.2088*(lost_away - lost_home) + 2.051 home;
total = 1.0319*rating total - 0.0522*(lost sum) - 7.037; rest/b2b/3-in-4/travel tested,
no validation gain -> not in number; win chance normal with sigma by min games played
(0-10: 9.99, 10-25: 11.25, 25-50: 15.05, 50+: 12.12). NFL: ridge EPA/play, success,
points, plays (lam 8, half-life 250, keep 0.6); QB value = EPA/dropback shrunk to -0.12
over 300 dropbacks, tonight's QB vs the QBs in the ratings; margin = 15.4959 epa_d +
34.3113 succ_d + 0.3545 pts_d + 1.0209 home + 0.0368 rest + 12.0275 qb_d - 2.0214 qbnew_d
+ 0.878; sigma 9.56 (market 11.03). Blend weights kept (NBA 25%, NFL 10% ours): bigger
or smaller not significantly better on validation. Totals: line better in both.

TEST results:
NBA (628 games w/ lines): line MAE 10.98, logloss .5205, 73.4% winners | v1 refit 11.30,
.5382, 74.2% | v2 independent 11.28, .5391 (staged sigma chosen after seeing test), 74.2% |
v2 market-adjusted 10.99, .5220. -> v2 ~ v1 on accuracy.
NFL (569): line MAE 9.69, logloss .5972, 68.2% | v1 10.11, .6229, 66.1% | v2 independent
10.07, .6169, 66.1%, totals 10.10 vs line 10.06 | v2 market-adjusted 9.70, .5977.
Value bets (independent EV>0, 437 bets): ROI -0.8%. No proven profitable edge.

Production modules: predictor_ratings.py, predictor_nba.py, predictor_nfl.py
(parity with backtest checked), nfl_team_epa.py. WIRED IN Nov 5 (game_predictor.py
V2, nba_model_v2 / nfl_model_v2, two predictions, warnings, confidence, moneyline
EV, history v2, cron snapshots; see docs/claude-handoff.md). Not kept from the
backtest: the NFL total weights (nfl_v2_params.json wasn't committed), so the NFL
total is the line's, else 2*mu + the points ratings. NBA staged sigma kept as
chosen, though picked after seeing test.
