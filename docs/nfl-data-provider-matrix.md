# NFL data provider capability matrix

## Live-line integration update — 2026-09-12

`services/odds.py` now supplies real current NFL event/prop offers through the existing funded Odds API connection, with an optional dedicated server-only `NFL_ODDS_API_KEY`. Supported regular market keys are mapped explicitly to position-compatible NFL props. PrizePicks, Underdog and three sportsbook sources retain distinct labels. Version 2 also requests the documented alternate markets. PrizePicks +100 alternates are labelled Demons; alternates matching an unambiguous standard-market default price are labelled Goblins. Others remain Alternate. Only returned directions are displayed; none are synthesized. The dedicated NFL Upstash credential is now configured with explicit user approval, without modifying the MLB setting. Schema, event/kickoff, GSIS identity, current team, numerical values and timestamps are validated; ambiguous/unmapped players are rejected. Missing offers remain unavailable. Quotes cache for two minutes with concurrent request coalescing, a paid-request rate budget and secret-safe transport errors.

Live offers support research comparison, not calibrated betting recommendations. Genuine historical lines, exact payout rules and production-ready models remain unavailable. Early-season statistical inputs use labelled current/prior data through a new experimental version without treating historical injury/depth as current. See [nfl-live-research-readiness.md](nfl-live-research-readiness.md).

Phase 7B adds no external provider. Its distributions derive from existing
validated nflverse weekly/PBP records, Phase 4 opportunity and Phase 6 means.
At the original Phase 7B checkpoint there were no reliable current/historical PrizePicks lines; the current-line gap is now addressed, while historical lines remain unavailable. There are still no
complete as-of injury scenarios or advanced tracking tails. Statistical
distribution validation is separate from betting calibration; the latter remains
NOT_AVAILABLE. See `nfl-distribution-calibration-validation.md`.

## Selected sources

Phase 2 uses the versioned CSV assets published by [nflverse-data](https://github.com/nflverse/nflverse-data/releases) and the maintained [nfldata](https://github.com/nflverse/nfldata) team/schedule files. The adapters fetch server-side, validate every record, normalize team aliases and stable GSIS player IDs, and return only internal NFL contracts.

nflverse-data is licensed CC BY 4.0. Any production display or redistribution must preserve attribution, link the source/license, and indicate transformed fields. NFL, team, and player trademarks and publicity rights are separate from the dataset license. nflverse is a community project and is not an official live NFL API.

Open-Meteo was evaluated but not selected. Its free API is limited to non-commercial use; this application has premium/subscription access. A commercial weather plan or another authorized source is required before adding forecast weather.

## Capability matrix

| Data field | Source | Available | Historical | Live | Cost | Reliability | Notes |
|---|---|---:|---:|---:|---|---|---|
| Teams and abbreviations | nfldata `teams.csv` | Yes | Yes | No | Free | High | Season-aware; normalized to current internal abbreviations. |
| Player identity and position | nflverse season rosters | Yes | Yes | Daily-ish | Free | High | GSIS ID is canonical; external IDs retained for exact joins. |
| Team assignment/status | nflverse season rosters | Yes | Yes | Daily-ish | Free | Medium-high | Trades/status changes depend on upstream roster refresh. |
| Schedule/game IDs | nfldata `games.csv` | Yes | Yes | Updated | Free | High | Explicit season, week, game type, teams, date, venue. |
| Game status | nfldata schedule/results | Partial | Yes | Not play-by-play live | Free | Medium | Final inferred only when both scores exist; no fabricated in-progress state. |
| Player game logs | nflverse weekly player stats | Yes | Since 1999 for stats release | Daily after games | Free | High | Explicit `REG`/`POST`; preseason kept separate. |
| Pass attempts/completions/yards/TD/INT | nflverse weekly player stats | Yes | Yes | After processing | Free | High | Direct fields. |
| Rush attempts/yards/TD | nflverse weekly player stats | Yes | Yes | After processing | Free | High | Direct fields; negative yards are valid measurements. |
| Targets/receptions/receiving yards/TD | nflverse weekly player stats | Yes | Yes | After processing | Free | High | Direct fields. |
| Longest reception | — | No | — | — | — | — | Not present in selected weekly stats; remains missing. |
| Team offensive plays | nflverse weekly team stats / PBP | Derived | Yes | After processing | Free | High | Attempts + carries + sacks suffered; Phase 4 PBP validates the counted-play partition. |
| Team pass/rush production | nflverse weekly team stats | Yes | Yes | After processing | Free | High | Direct fields. |
| Team points | nfldata schedule/results | Yes | Yes | After result update | Free | High | Joined by game ID; absent before scores are posted. |
| Drives | — | No | Possible from play-by-play | No | Free processing | Medium | Not implemented; requires a PBP adapter. |
| Snap count/snap % | nflverse snap-count release | Yes | Yes | Polled after games | Free | Medium-high | Uses PFR player ID; only exposed when that exact ID is requested. |
| Routes | — | No current source | Limited historical charting | No | Commercial/current source needed | — | Must remain missing. |
| Route participation | — | No current source | Derivable only with route data | No | Commercial/current source needed | — | Must remain missing. |
| Targets/target share | nflverse weekly player stats | Yes | Yes | After processing | Free | High | Target share is directly published; missing stays null. |
| Carry share | nflverse player + team stats | Derivable | Yes | After processing | Free | High | Not yet exposed; requires exact game/team join. |
| Touches | nflverse weekly player stats | Derivable | Yes | After processing | Free | High | Carries + receptions; no model use yet. |
| Red-zone usage | nflverse play-by-play | Derivable | Yes | Delayed | Free processing | Medium-high | Not implemented in this phase. |
| Injuries | nflverse injury reports | Yes | Since 2009 | Periodic | Free | Medium-high | Report/practice statuses preserved verbatim; source lacks a per-row report timestamp. |
| Practice participation | nflverse injury reports | Yes | Yes | Periodic | Free | Medium-high | Direct text field. |
| Depth charts | nflverse depth charts | Yes | 2025+ normalized | Periodic | Free | Medium | Current ESPN-derived rows have timestamps; legacy rows without a trustworthy update time are not presented as current. |
| Passing/rushing yards allowed | nflverse weekly team stats | Derived | Yes | After processing | Free | High | Opponent offense joined by game ID. |
| Attempts faced | nflverse weekly team stats | Derived | Yes | After processing | Free | High | Opponent attempts/carries. |
| Sacks/interceptions | nflverse weekly team stats | Yes | Yes | After processing | Free | High | Credited defensive fields. |
| Points allowed | nfldata schedule/results | Yes | Yes | After result update | Free | High | Joined by game ID. |
| Venue/roof/dome | nfldata schedule | Yes | Yes | Schedule updates | Free | High | Direct schedule fields. |
| Temperature/wind | nfldata schedule | Partial | Yes | Not a forecast feed | Free | Medium | Often absent for future games; never replaced with zero. |
| Precipitation | — | No | — | — | Commercial weather source needed | — | Selected schedule source does not include it. |
| Forecast weather timestamp | — | No | — | — | Commercial weather source needed | — | GitHub fetch time is not a weather observation time. |
| Sportsbook/PrizePicks props | — | No authorized NFL provider | — | — | Provider required | — | No production endpoint; no fabricated lines. |
| EPA | nflverse player/team stats and PBP | Yes | Yes | Delayed | Free | High | Available, but not exposed to research/model yet. |
| Pressure metrics | NGS/PFR-derived releases | Partial | Historical | Delayed | Terms/source-specific | Medium | Requires separate evaluation and adapter; unavailable in current service. |
| Coverage splits | — | No reliable current free source | Limited charting | No | Commercial source needed | — | Unavailable. |
| TPRR | — | Derivable only with routes | Limited | No | Commercial/current source needed | — | Unavailable. |
| First-read share | — | No | — | No | Commercial source needed | — | Unavailable. |
| Air-yard share | nflverse weekly player stats | Yes | Yes | After processing | Free | High | Direct field. |
| Route types | — | No reliable current free source | Limited charting | No | Commercial source needed | — | Unavailable. |
| Run concepts/box counts | nflverse FTN participation | Historical subset | 2023-2025 subset | No | Attribution/share-alike restrictions | Medium | Not used; unsuitable for current-week production without further licensing review. |

## Cache policy

All keys use `krazy_data:nfl:v1:{domain}:{source-version}:{season}:{qualifiers}`. This prevents collisions with existing MLB caches and permits schema-wide invalidation by moving from `v1` to `v2`.

| Domain | TTL |
|---|---:|
| Teams | 24 hours |
| Players/rosters | 6 hours |
| Schedule | 15 minutes |
| Player/team game stats | 30 minutes |
| Usage/snap counts | 30 minutes |
| Injuries | 10 minutes |
| Depth charts | 30 minutes |
| Defense | 30 minutes |
| Schedule weather context | 10 minutes |
| Props | 2 minutes once a provider exists |

The current cache is per warm serverless process. A cold process revalidates from the source. Large upstream CSV files are not copied into the existing board KV because that would compete with MLB board storage and can exceed practical KV payload sizes. Future persistent caching should store normalized slices under the same NFL namespace.

Upstream data is naturally invalidated by TTL. Historical completed seasons may later receive immutable, longer-lived keys. Provider failures are not cached as successful data. HTTP 429 returns `UNRELIABLE`; malformed/unavailable sources return `MISSING`; neither becomes an empty numeric value.

## Source precedence

1. nflverse season roster is authoritative for current player/team assignment and provider ID crosswalks.
2. GSIS ID is the canonical player key. Exact provider IDs are preferred; normalized names are allowed only when unique and may be constrained by team.
3. nfldata supplies canonical team identities and schedule/results.
4. nflverse weekly player/team stats supply measured box-score statistics.
5. No second statistical source is merged in Phase 2, so conflicting stat-source precedence is intentionally deferred.
## Phase 4 volume inputs

`services/play_by_play.py` adds validated streaming PBP aggregates: real dropbacks, scrambles, sacks, called/official rushes, kneels/spikes, offensive drives, score-state exposure and within-drive clock pace. Definitions follow the [nflverse dictionary](https://nflreadr.nflverse.com/articles/dictionary_pbp.html); deleted/no-play/special-teams and two-point plays are excluded. Source/version/fetch metadata and optional disk/warm-process cache accompany compact summaries. Raw full-season PBP never reaches the browser.

The NFL depth adapter can retain timestamped history for role-change detection while existing callers remain latest-only by default. Exact-crosswalk snap counts support expected snaps and verified historical zero-offensive-participation scenarios. Missing snap rows are not absences. Routes remain unsupported; no snap-to-route conversion exists. Non-scramble QB rushing is labelled a proxy rather than charted design.

The [upstream availability schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html) says its injury source died after 2024. Newer returned files do not guarantee complete current coverage. Opportunity injury certainty remains unknown/partial, and unresolved players receive conditional scenarios without probabilities. Missing data cannot become a confident projection.

See `nfl-opportunity-engine-validation.md` and the JSON backtest artifact for exact methodology, output coverage and current accuracy. Earlier matrix entries describing unimplemented PBP/drive derivations are superseded by this Phase 4 section; advanced route, personnel and forecast-weather fields remain unavailable.

## Phase 5 matchup capabilities

Separate `services/matchup_data.py` validates PBP into same-season defensive, player, target-depth, run-direction and QB-receiver aggregates with field-specific valid exposures. Derived EPA, success, completion/CPOE, YPA/YPC, YAC, sacks, stuff and explosive rates are available diagnostics. Offense-strength residual adjustment uses earlier games with explicit raw-only fallback. A chronological validation policy enables only retained research features; quality is always partial and certainty reflects unsupported components.

Current coverage/man-zone, routes, alignment/shadow defenders, true pressure/blitz/blocking, run concepts/box/contact/RYOE, tracking and personnel grouping scores remain unavailable. Future provider-neutral interaction ports are tests and architecture, not live data. Personnel and roof/venue are context only; incomplete current injuries and missing forecast weather cannot produce points. Source URL/version/fetch/observed timestamps and isolated NFL caches accompany responses. See `nfl-phase5-capabilities.md` and `nfl-matchup-engine-validation.md` for exact direct/derived/unavailable/commercial requirements, normalization and holdout results.

## Phase 6 projection data

The new `projections/dataset.py` uses the same public weekly stats release with strict season/player/game/count validation and explicit missingness. Negative air-yard shares are preserved as legitimate measurements. Position-specific priors exclude the player and future weeks. No new vendor or line provider is added. Phase 4 volume and Phase 5 underlying defense aggregates feed independent versioned mean-statistic models. Opponent effects require held-out improvement; coverage/tracking/weather/TD/tail gaps are not fabricated. Unknown teammate effects can supply a labelled conditional observed-role baseline, while selected-player or supported conflicting-volume scenarios remain unavailable without a mixture model. Forecast distributions, medians and betting outputs remain unimplemented. Projection source/version/freshness and existing isolated NFL cache keys are retained; full validation is in `nfl-projection-engine-validation.md`.
