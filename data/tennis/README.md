# Tennis history

`history.json.gz` is a normalized snapshot of the free 2025 and 2026 ATP/WTA
season files downloaded from https://tennisdata.app/downloads/ on September 30,
2026. It includes Challenger matches. The provider explicitly permits use of
these files on its download page. Match and player IDs stay source-specific.

Covered fields: individual set scores, games won/lost, total games, sets,
first-set games, tiebreaks, aces, double faults, service/return points won
percentages, break-point conversion/saved percentages, surface, opponent rank,
tournament, round and closing match-winner odds, where reported.

Fantasy score uses PrizePicks' published tennis formula: 10 + games won - games
lost + 3 * (sets won - sets lost) + 0.5 * (aces - double faults).
Source: https://www.prizepicks.com/playbook-article/learner-tien-vs-frances-tiafoe-prediction-pick-cincinnati-open-tuesday-august-18

**Missing fields:** exact break-points-won counts, handedness, height, UTR and
indoor/outdoor court distinction. Conversion percentages are never substituted
for break counts. Missing aces/double faults also keep fantasy score missing.

**Automatic refresh:** `tennis_live.py` supplements this historical snapshot
with completed matches from the free Tennis API ATP/WTA/ITF RapidAPI tier.
The working detail route is `/tennis/v2/{tour}/h2h/match-stats/{tournament}/{p1}/{p2}`;
the documented `/matches/{id}/stats` alias returned 404 in verification.
Real results and serving/break counts were verified September 30, 2026.

New finals are saved in the existing private KV store (not the deployment
filesystem), merged with this snapshot and read by Finder/Slip Builder.
Discovery covers the preceding seven days, both tours, with pagination.
Players on the current PrizePicks board or visited in Finder are enrolled;
this is not an unrestricted all-tour live feed. Only fully completed matches
are graded. Missing fields remain missing, and missing serving stats are retried
after six hours, up to three attempts. No universal stat coverage is promised.

Vercel's daily `tennis-cron-scan` runs at 08:00 UTC. The existing authenticated
line-moves timer and history reads also drain the persistent queue, with result
discovery throttled to every six hours. Daily scheduling alone means next-day
updates; the external timer/page visits can update sooner, after source publication.
Set `CRON_SECRET` in Vercel for authenticated cron requests (the handler otherwise
uses the project's existing Vercel cron markers). Inspect the `tennis` field in
the line-moves timer response for progress.

The daily API budget is capped at 40 reserved calls via Redis INCR, below the
documented 50/day free limit; manual calls using the same key consume the
remaining allowance. Heavy slates/backfill can queue beyond that budget.
Stored history survives quota exhaustion, retries, and upstream failures.
Keep a hard free-plan limit enabled at the provider; do not enable paid overages.
The API key is stored privately in KV by `tools/setup_tennis_auto.py`; environment
variable `TENNIS_RAPIDAPI_KEY` takes precedence. Never commit the key.

**Historical seed rebuild only:** the bundled serving statistics remain a dated
snapshot. The download provider's terms prohibit automated extraction, so no
CSV scraper is scheduled. For an authorized historical rebuild, run:

    python tools/import_tennis_history.py /path/to/2025-atp-season.csv /path/to/2026-atp-season.csv /path/to/2025-wta-season.csv /path/to/2026-wta-season.csv

Commit the resulting snapshot to deploy it. The web download uses browser bot
verification; the collector does not bypass that verification. ESPN provides a
free result-only fallback for players absent from this snapshot.
