# NFL slate research board

Added September 13, 2026. The NFL Props navigation now opens a separate real-line research shortlist; the MLB board/model is unchanged. Player search remains available under Research. Each shortlist card opens the exact player, game, statistic, line and direction in the existing interactive Trends view.

## Method
Fetch mapped upcoming events over seven days, then scan three games concurrently. Request only PrizePicks standard markets (one bookmaker), using the existing verified adapter and NFL cache. No alternate lines are invented; existing research retains its full line ladder.

For each actual posted side, use the most recent 20 complete regular-season logs from the current or previous season on the player's current team. All logs must precede the event season/week. Deduplicate game IDs. Missing values remain missing, combined statistics require every component. Require at least eight non-push games and five recent non-push games. Rank by the 95% Wilson lower bound of historical hit proportion; break ties by recent historical rate. Keep one posted direction per player/stat. This is a descriptive screening method, not an evaluated prediction model or calibrated betting probability. Current-team filtering does not establish an unchanged role.

Exclude inactive roster statuses and known questionable/doubtful/out players in the available injury report. Missing reports are labelled, not inferred healthy. Exclude unsupported longest-reception/fantasy statistics. Fresh verified standard PrizePicks quotes only; the two-minute quote limit and kickoff are rechecked in the API and browser. Pushes appear separately and are excluded from hit denominators.

## Limits
The shortlist is not equivalent to a validated recommendation engine. No production model promotion, betting confidence, TAKE label, or Discord rebuild integration was added. Historical hit records against today's line are not historical betting results. Prior-season roles, unavailable injury reports, and a cold full-slate load remain limitations. Three concurrent workers expose progress and preserve unaffected games on failures. Source caches are per server process, not a durable scheduled rebuild.

## Verification
184 NFL backend tests and 32 NFL frontend tests passed; TypeScript and production build passed. New tests cover future/duplicate games, missing statistics, small samples, freshness, alternate exclusion, current-team/regular-season samples, direction deduplication, global sorting, filters and exact research-link identity. Live Dallas–New York check returned 22 actual PrizePicks research rows with real game logs. Browser verified the Props route, ranked multiple games and 390px layout. Existing main bundle size warning remains.
