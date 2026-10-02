# CS2 results collection

Posted lines and completed results are separate feeds. Lines continue through
the existing PrizePicks/Underdog collectors. Results use public BO3 HTML pages,
not private endpoints, cookies, a paid key, or CAPTCHA bypasses.

## Automatic operation

The CS2 board enrolls every current player in the existing persistent store.
The authenticated `moves-tick` timer and `finder-history-cron` run bounded result
collection. Keep the existing external timer active: the hosting cron alone
runs daily, which is not enough for fast initial backfill of a large board.
No new timer secret is required. Timer responses include CS2 progress.

Timers now process up to 12 queued players with at most three concurrent
source requests. A failed map is retried later without blocking other maps.
Every verified ten-player scoreboard is shared with all enrolled players
whose source slugs match it. No fuzzy identity matches are made.

The first pass reads complete kills histories from each public player page:
explicit map numbers and K/D/A are checked against visible rows, completed
round scores, and past start times. Exact headshots still come from full map
scoreboards. A list that does not identify the player's historical team uses
the two-team matchup label; it does not guess an opponent or manufacture H2H.
Full scoreboards upgrade that label to the verified opponent as they arrive.
Timers wait for result work within their hosting budget instead of abandoning
it immediately when another sport finishes first.

For a free always-on host, `python tools/collect_cs2_history.py --watch` collects
every two minutes using the same storage. Without `--watch`, it runs one batch.
`--backfill` runs up to 20 accelerated batches for initial population.
Persistent storage must be configured; this is the same KV configuration used
by the rest of the Finder, not a new data-provider subscription.

Each job verifies the player's page heading, records its public map links,
and gradually fills up to 80 recent maps. Completed maps are shared across
players; incomplete headshot scoreboards are retried fairly rather than treated
as permanently complete. Saved game logs contain at most
40 series. Failed requests preserve completed results and are retried on later
ticks. Cross-worker locks prevent duplicate collection for the same player.

The collector prebuilds a shared board response with posted lines and histories
together. Histories are deduplicated by player instead of repeated per prop.
A current snapshot is served with one storage read and no external provider
requests. Started events are removed on read. Quotes older than fifteen minutes
are refreshed rather than silently re-stamped as current. Browser-persisted
boards still render immediately for returning users. Frontend refresh picks up
new saved results every two minutes. Cold/missing snapshots and network outages
cannot be guaranteed instant, and initial backfill is not the same as page-load
latency.

The source lists kills in one player-page request; headshots require verified
map scoreboards. Therefore a same-map headshot count below its kills count is
incomplete coverage, not a shorter match history. Empty source scoreboards
remain unavailable, never zero-filled or estimated. Map 2 does not exist in
BO1 series; Map 3 is counted only when played. Combined scopes require every
map in that scope. Research-only statistics have no bookmaker line unless a
book posts that exact market for the selected match.

Each bookmaker has a separate fifteen-minute last-successful cache. A provider
failure can reuse that feed only while still recent and pre-game. Reused rows
carry `staleQuote` and their original `quoteAsOf`; board freshness uses the
oldest reused quote rather than re-stamping it as current.

## Accuracy and limitations

- Map order comes from the completed map's explicit `M1`/`M2` scoreboard label,
  never from page order or a guessed map name.
- A Map 1 market needs map 1; Maps 1–2 needs both maps. Map 3 never substitutes.
- Kills, deaths and assists come from the visible ten-player scoreboard.
- Headshots come from primitive fields in public serialized page data. No
  remote JavaScript is executed. Exactly one game-ID roster must match all
  ten visible players' K/D/A, or headshots remain unavailable.
- Identity mismatches, missing players, unfinished maps, incomplete source
  coverage and unsupported stat scopes remain unavailable, not zero.
- Handle-to-slug differences may require a verified alias. No fuzzy identity
  matching is used. Public-page availability is not guaranteed.
- First-time backfill is gradual. L5/L10/etc. show the actual available sample,
  not invented games to reach the requested window size.
- H2H only grades a positively matching opponent; a feed that supplies an
  entire matchup title instead of the opponent does not produce guessed H2H.
- Source attribution remains a compact active BO3 link, as required by its
  public use-of-services page. No explanatory paragraphs are added to the UI.
- This collector does not claim injury, weapon, or global ranking coverage.

Tests: `python -m unittest tests.test_cs2_history tests.test_cs2_board` and
`node --test tests/cs2-finder.test.mjs tests/external-trend-switching.test.mjs`.
