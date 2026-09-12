# NFL data provider capability matrix

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
| Team offensive plays | nflverse weekly team stats | Derived | Yes | After processing | Free | High | Pass attempts + carries; documented as a derivation. |
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
