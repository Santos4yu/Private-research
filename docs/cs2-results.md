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

For a free always-on host, `python tools/collect_cs2_history.py --watch` collects
every two minutes using the same storage. Without `--watch`, it runs one batch.
Persistent storage must be configured; this is the same KV configuration used
by the rest of the Finder, not a new data-provider subscription.

Each job verifies the player's page heading, records its public map links,
and gradually fills up to 80 recent maps. Completed maps are shared across
players and never refetched during backfill. Saved game logs contain at most
40 series. Failed requests preserve completed results and are retried on later
ticks. Cross-worker locks prevent duplicate collection for the same player.

The Finder only reads compact saved histories. It never waits for BO3 scraping
to serve the board. Frontend refresh picks up new saved results every two minutes.

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
