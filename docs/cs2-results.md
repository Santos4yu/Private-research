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

Timers now use a 45-second result budget with up to 24 queued players and at most three concurrent
source requests. A failed map is retried later without blocking other maps.
Every verified ten-player scoreboard is shared with all enrolled players
whose source slugs match it. No fuzzy identity matches are made.

The first pass reads complete kills histories from each public player page:
explicit map numbers and K/D/A are checked against visible rows, completed
round scores, and past start times. Exact headshots still come from full map
scoreboards. A list that does not identify the player's historical team uses
the two-team matchup label; it does not guess an opponent or manufacture H2H.
Full scoreboards upgrade that label to the verified opponent as they arrive.
Public `?page=2` and `?page=3` listings are collected incrementally after verifying
the profile heading and actual new map links. The collector no longer stops at
the first 40 maps. It reads up to 120 recent maps to build the recent 40-series
history; this is not an unlimited career archive. `--listings --backfill` preloads
these pages without waiting on headshot requests. A failed later page retains
earlier verified records, and the audit flags an unfinished listing.
Timers wait for result work within their hosting budget instead of abandoning
it immediately when another sport finishes first.

For a free always-on host, `python tools/collect_cs2_history.py --watch` collects
every two minutes using the same storage. Without `--watch`, it runs one batch.
`--backfill` runs up to 20 accelerated batches for initial population.
Use `--batches N` for a longer initial pass. `--headshots --backfill` stops when
all remaining source pages are deferred; `--watch` then switches to normal polling.
Line feeds are not re-requested before every history batch.
Persistent storage must be configured; this is the same KV configuration used
by the rest of the Finder, not a new data-provider subscription.

Each job verifies the player's page heading, records its public map links,
and gradually fills up to 120 recent maps. Completed maps are shared across
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
The CS2 API also sends lossless gzip when the browser accepts it. Expanding
histories therefore does not require dropping players to keep transfer size
small. Other sports keep their existing response behavior.

The source lists kills in one player-page request; headshots require verified
map scoreboards. Therefore a same-map headshot count below its kills count is
incomplete coverage, not a shorter match history. Empty source scoreboards
remain unavailable, never zero-filled or estimated. Map 2 does not exist in
BO1 series; Map 3 is counted only when played. Combined scopes require every
map in that scope. Research-only statistics have no bookmaker line unless a
book posts that exact market for the selected match.
Combined kills can use verified player-list maps alongside full scoreboards;
an unknown historical team does not discard a positively matched map. Conflicting
verified teams still prevent combining those maps. Combined headshots always
require exact headshots for every included map.

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
  ten visible players' K/D/A, or headshots remain unavailable. After that
  identity check, one player's missing headshots do not discard the other
  players' individually recorded results. Invalid counts remain missing.
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

## Coverage verification

`python tools/collect_cs2_history.py --audit` is read-only. It compares kills and
headshots for the same actually played scope for every active player. It reports
missing histories separately and never calls a two-game sample a complete L15.
Coverage metadata is included with saved player histories. A positive zero
headshot result counts as a real observation; missing values do not.

The shared queue records whether a page has an empty scoreboard, no headshot
fields, a failed validation, a request failure, or a rate limit. Empty source
pages are deferred for six hours; transient failures use bounded backoff and
HTTP 429 respects Retry-After. Deferred pages do not consume the next tick's
entire queue. The per-player collector respects the same source status.
Public pagination failures have a separate saved backoff and audit count.
An empty/repeated later page remains incomplete; it never truncates good history
or gets mislabeled as a complete listing. While those pages are deferred, the
shared headshot queue continues for everyone else. Accelerated backfill does not
bypass source-failure backoff. Timer/collector output includes headshot queue
progress separately from successful player-list requests.

Profile aliases are explicit and verified against their public headings and
posted teams. Existing queued jobs are migrated automatically, and a changed
source identity refreshes its listing instead of retaining an empty six-hour
cache. The verified exceptions include dev1ce/device, frozen/frozen-david-cernansky,
SHOCK/shock-max-kvapil, phzy/phzy-love-smidebrant, robo/robo-nikita-dushin,
b1elany/bielany, MITHPUTTINI/mith, laser/chshekin, Hezz/hezz-cs-go,
Joey/joey-cs-go, destiny/destiny-lucas-bullo and Astralis ryu/ryu_g.
Punctuation-only differences (sirah-, adamS-) use their verified profile slugs.
Unknown or mismatched profiles are not guessed.
