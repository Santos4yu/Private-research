# Odds credit controls

All website paid Odds API calls use `odds_budget.guarded_get`: MLB boards and trend ladders, NFL Finder/research/game lines, WNBA, moneylines and the older V2 board. Free schedules and key validation retain their existing transport. Discord bot code outside this site is not covered.

Defaults require no new environment variables:
- `ODDS_DAILY_CREDIT_LIMIT=1000`: total site allowance across all sports and configured keys, per UTC day.
- `ODDS_CREDIT_RESERVE=1500`: credits held back for the rest of the month.
- `ODDS_API_PAUSED=true`: emergency pause of all paid odds access.

The allowance also tightens to `(remaining - reserve) / remaining calendar days`. A free `/sports` probe reads actual quota before the first paid call for each key each UTC month. Provider headers can lower the estimate thereafter. Failed calls retain their reservation conservatively. Calendar reset matches the provider's first-of-month UTC reset, rather than the MLB slate date.

The existing shared store holds monthly reservations, quota observations, request leases and response caches; process restarts do not reset the allowance. Storage failure blocks paid requests. Request identity uses hashes of credentials; no API keys or prepared URLs are persisted. Parallel identical requests cannot both buy odds. Budget reservation uses a short shared lease; a competing request may temporarily return unavailable rather than overspend.

Provider responses cache for one hour within six hours of game time, three hours within 24 hours, six hours farther out. Cached timestamps remain provider timestamps; no expired response is represented as fresh. Empty responses also cache. Boards may display fewer sportsbook prices when the allowance is reached; free stats and PrizePicks feeds continue under their existing handling.

Bulk NFL/MLB/WNBA board requests use standard markets. MLB trend ladders still request alternates on demand through the governor. NFL and WNBA board pricing is limited to 36 hours, matching the existing MLB horizon. NFL games farther away remain available through free schedule data.

Deploy the changed site to activate these controls. Local mocked tests spend no provider credits. Other deployments, the Discord bot, or third-party users of the same key can still consume credits outside this site's daily cap. Rotate the exposed key in the provider dashboard and update every deployment/stored key using it; do not put the replacement in chat.

## PrizePicks loading protection

No changes were made to `prizepicks_export_core.py`, its feed TTL, refresh controls, paging, or line/tier normalization. NBA, soccer and NHL feed loaders and all trend scan/history code are also unchanged.

MLB, NFL and WNBA Finder sportsbook enrichment now uses `cache_only=True`. It reads saved provider responses with a one-second storage timeout and does not buy odds or run the quota probe. Missing comparisons are optional: existing PrizePicks feed loading and error fallbacks continue. Cached odds expire on their original schedule. Paid research and moneyline calls remain governed. Finder no longer replenishes sportsbook odds itself, so comparison coverage can be sparse or absent until another authorized caller populates a matching cache.

Validation is mocked and does not measure live feed latency. Deployment and live speed verification are still required.
