# NFL interactive research beta — September 12, 2026

## Delivered behavior

- Player research opens on Trend. Every position-valid historical stat is selectable independently of projection-model eligibility.
- Platform, line type and exact offer selectors support standard, alternate, Goblin and Demon offers. PrizePicks is the default. A missing PrizePicks offer never falls back to a relabelled sportsbook quote.
- The line can be edited with a numeric input, +/- controls and a slider. More/Less updates historical hits, misses and pushes immediately. A modified threshold/direction is labelled Custom line. Reset restores the posted offer.
- L5/L10/L15/L20/Max, a numeric game count and +/- controls change the sample. Individual games can be excluded/restored. Excluding a recent game fills from older eligible history, up to the requested count.
- Filters: season, home/away, opponent, player's historical team, stat-appropriate attempt/carry/target minimum/maximum, and measured offensive snap percentage. Active chips remove filters individually; missing snap data cannot pass a minimum filter.
- Tapping or keyboard-activating a chart bar opens that game's relevant raw statistics. Opponent logos keep aspect ratio. Controls wrap on narrow screens and use 44px touch targets and 16px mobile input text.
- Overview shows recorded averages/medians and supported beta estimates. Internal production-gate panels, disabled-model badges on historical stat selectors and the repetitive disclaimer wall are removed. Source/license attribution remains under collapsed Data sources. No model is promoted and no unsupported betting probability is exposed.

## Data and isolation

The adapter requests 13 documented standard and 13 alternate markets. Category mapping follows [The Odds API's bookmaker conventions](https://the-odds-api.com/sports-odds-data/bookmaker-apis.html) and [market list](https://the-odds-api.com/sports-odds-data/betting-markets.html). A +100 PrizePicks alternate is a Demon; an alternate with an unambiguous standard-price reference is a Goblin. Ambiguity remains labelled Alternate. Only provider-returned Over/Under offers appear.

During this task a live game returned **333 PrizePicks offers: 82 standard, 156 Demons and 95 other alternates** before the Goblin-reference classification was added. Counts change with the feed. This verifies that alternate offers exist, not that every player/stat has a posted line. After tool access recovered, the updated live endpoint returned 334 PrizePicks offers: 80 Standard, 157 Demon, 96 Goblin and one unclassified Alternate. Jefferson 2025 reception history returned 17 games in 3.5 seconds, with 16 reconciled longest-reception values; the unmatched game remains missing. Fantasy values were present in the checked history.

The funded credential was saved to the existing Upstash store under the NFL-only setting after explicit approval, then verified by readback. It is never in the browser bundle or Git. NFL credentials take precedence over legacy shared fallbacks. MLB credentials and calculations are untouched.

Longest reception uses credited play-by-play receiving lengths, reconciled against the weekly reception count and receiving-yard sum. Unreconciled, missing or ambiguous lateral cases remain missing. Known zero receptions plus zero receiving yards yields a measured zero. This is an on-demand `reception-logs` resource within the existing NFL handler, sharing the cached season PBP aggregate. No new serverless function or tail projection model is added.

Fantasy history follows [PrizePicks' published NFL scoring](https://www.prizepicks.com/playbook-article/how-to-play-prizepicks-nfl-fantasy-scoring-system), including its interception/fumble deductions, conversion scoring and special-teams TDs. It does not reuse generic nflverse PPR totals. Missing components or an ambiguous recovery-TD unit prevent calculation. Raw weekly fields are defined by [nflfastR](https://nflfastr.com/reference/nfl_stats_variables.html). Combined yardage/TD historical totals require every component.

## Verification

- 171 NFL backend tests pass, including provider category mapping, malformed prices, credential priority, fantasy scoring/missingness, longest-reception reconciliation and endpoint isolation.
- 28 frontend tests pass, including line/sample/filter calculations, platform/category isolation, SSR component rendering and existing cache/history/model-gate regressions.
- TypeScript check and Vite production build pass. NFL remains a lazy bundle (approximately 75KB uncompressed); the pre-existing main bundle size warning remains.
- Full backend discovery: 190 tests, two existing MLB/BvP failures (`104 != 4` and `10 != 0`) unchanged from the prior checkpoint. No MLB logic was altered to address them.
- No lint script is configured.
- Browser QA completed after the initial tool usage interruption: real Rodgers Standard/Goblin selection updated the trend; changing More 212.5 to Goblin More 149.5 changed the last-five hit rate from 60% to 80%. Custom 250/Less, game count, home filtering, filter removal and individual exclusion all recalculated. Tapping a mobile bar showed its exact stat details. Switching to passing attempts selected real PrizePicks 31.5 and a 35-attempt sample average. No page overflow at 390, 412, 768 or 1280px; the mobile chart was visually inspected and its sizing improved. This is local browser QA, not certification of all hosted/provider scenarios or physical devices.

## Hosted beta follow-up

1. On the hosted site, open NFL, a currently listed player, then switch PrizePicks Standard/Goblin/Demon and confirm the exact offer moves the trend line.
2. Edit the custom line, switch More/Less, change game count, exclude/restore a bar, and apply/remove each filter on phone and desktop.
3. Verify passing, rushing, receiving, combined, fantasy and longest-reception history with real players. Cold play-by-play downloads may be slow.
4. Check unavailable offers and provider failures preserve usable historical research. The Odds API does not supply every PrizePicks in-app category; unsupported markets are not fabricated.
5. Verify the hosted build is current after the main-branch push. No separate deployment command is included.

Model validation, complete current injuries/QB status and calibrated historical-line evidence remain separate blockers to paid betting recommendations. The interactive research changes do not establish model accuracy.
