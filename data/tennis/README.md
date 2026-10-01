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

**Refresh:** the bundled serving statistics are a dated snapshot, not a live
feed. Download the updated free season CSVs and run:

    python tools/import_tennis_history.py /path/to/2025-atp-season.csv /path/to/2026-atp-season.csv /path/to/2025-wta-season.csv /path/to/2026-wta-season.csv

Commit the resulting snapshot to deploy it. The web download uses browser bot
verification; the collector does not bypass that verification. ESPN provides a
free result-only fallback for players absent from this snapshot.
