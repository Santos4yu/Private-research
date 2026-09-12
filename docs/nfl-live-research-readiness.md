# NFL live lines and early-season research — 2026-09-12

## Delivered

NFL now has a separate real Odds API adapter, `props` / `prop-games` resources in the existing single NFL function, a game-ordered offer browser and selectable current quotes on player research. Offers retain exact provider, player, game, prop, direction, value and timestamp. PrizePicks, Underdog, DraftKings, FanDuel and BetMGM are requested; the UI never relabels sportsbook offers as PrizePicks. Only supported regular O/U markets are mapped. Alternatives, unknown identities, ambiguous names, invalid values and future/missing timestamps are rejected. No invented lines or payout EV.

Opening a posted offer preserves its player, prop, game and analyzed line. Refresh clears selected stale quotes. Quote ages update automatically, with the stricter two-minute freshness threshold. Historical hit/miss/push comparison excludes missing stats and pushes from hit-rate denominators and explicitly compares history with the current quote, rather than claiming historical betting performance. Overview shows model-minus-line statistical difference only when both values exist. The distribution shows a selected-line marker without exposing an uncalibrated probability.

Descriptive history defaults to current and prior regular seasons when the current sample has fewer than twenty games. Explicit season choices never silently backfill. Source failures preserve separately labelled available history; prior games display their season/week. Current schedule, roster, status, injuries and depth remain current-season sources.

## Early-season model inputs

`NFL_EARLY_SEASON_INPUTS_V1` adds prior-season statistical history for forecast weeks 1–4. Both source season and original week remain in metadata. Only current rows before the forecast week and prior regular-season rows enter calculations. Prior weeks map to a consecutive season-week axis ending at zero. This controls recency, not calendar freshness: prior-only defense has reduced freshness/certainty, and prior-season role continuation has LOW certainty. Current-team role shares exclude former-team games. Efficiency retains conservative existing exposure shrinkage, including positional empirical baselines. No new yardage formula or score-to-projection multiplier.

Opportunity cache/model version is `opportunity-v4`; early-season point results use `NFL_<POSITION>_<PROP>_V2_EARLY_SEASON`. Matchup results use `NFL_MATCHUP_V3_EARLY_SEASON`; distributions use `NFL_EARLY_SEASON_DISTRIBUTION_V1`. These candidates are EXPERIMENTAL and cannot inherit validated status from earlier versions. The prior historical validation reports do **not** validate this new input policy. No new backtest performance is claimed. Disabled and unsupported props remain disabled/unavailable. No model has become production-ready; public decisions abstain and the eligible Value Board remains empty.

NFL cache coalesces identical concurrent source requests and prevents cleared in-flight requests from repopulating stale entries. API calls remain isolated from MLB. Paid `props` requests share the heavy request budget. The NFL function receives a 60-second execution allowance without adding another serverless function.

## Verified evidence

- A free NFL events request verified the locally configured credential and mapped 212 real upcoming events.
- A live ATL @ PIT offer request returned 372 verified lines initially and 366 on a later HTTP/API check, across all five requested providers. Changes in offer count are live source changes, not a fixed fixture.
- Real Stafford history returned seventeen 2025 regular-season logs plus one available 2026 log. The week-two opportunity/service check produced approximately 33.4 pass attempts and 256.8 passing yards, labelled LOW_CONFIDENCE/EXPERIMENTAL. This is a source/orchestration check, not a forecast accuracy result.
- Current local API HTTP checks returned 200 for game logs, opportunity, matchup, projection, distribution, game feed, decision gate and Value Board. Missing calibration/production eligibility returned honest unavailable/PASS states.
- Automated QA: 162 NFL backend tests and 26 frontend tests pass; TypeScript and production build pass. Full backend discovery has two unchanged existing MLB/BvP test failures (`104 != 4`, `10 != 0`). No configured lint command. Existing main bundle >500KB warning remains; NFL stays lazily loaded.
- Browser check confirmed real player identity/media, season-labelled history and source-failure states. Final current-server browser/mobile QA was blocked by automatic approval review's usage limit. No full mobile/device certification is claimed.

## Release boundaries

The local credential is in ignored `.env.local`, explicitly excluded from Vercel upload. It is never committed or sent to client code. Deployment must configure `NFL_ODDS_API_KEY` server-side, or have a funded existing environment/stored fallback. A local file does not configure hosted environments. Credential selection bypasses successful free responses whose quota cannot cover the requested markets.

Missing current injury/QB completeness, advanced route/coverage/tracking sources, calibrated real historical lines, prospective validation and durable hosted shadow capture remain release blockers for public paid recommendations. Cold upstream downloads can still be slow; warm requests are cached and coalesced. Some players/games genuinely have no posted provider event or line. Supported research is functional; this is not certification of every NFL prop model.

Main-branch push is authorized by the user. No separate deployment command or model promotion is part of this change.
