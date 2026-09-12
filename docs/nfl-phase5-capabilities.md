# Phase 5 capability decisions before implementation

Reviewed the architecture audit, provider matrix, opportunity validation, domain/provider contracts and NFL UI. Existing MLB and Phase 4 calculations will be preserved.

| Category | Metrics | Decision |
|---|---|---|
| A: direct source fields | PBP EPA, success, CPOE, completion, air yards, YAC, sack, QB hit, run location/gap, player IDs; schedule roof/venue; opportunity outputs | Validate and aggregate server-side. QB hits and sacks are not pressure attribution. Run direction/gap is not run concept. |
| B: reliably derivable | EPA/dropback/rush, success rates, YPA/YPC, completion and sack rates, explosive pass >=20/run >=10 rates, stuff <=0 rate, depth/YAC splits, receiver target depth/YAC/efficiency, QB-receiver connections, offense-strength residual adjustments | Keep exposure counts and field-specific missingness. Chronological feature screening before score weight. |
| C: unavailable in connected current providers | Man/zone and coverage families; routes/TPRR/YPRR; alignment; shadow CB assignment; designed run concepts; box counts; RYOE/contact yards/missed tackles; pressure/blitz/time-to-pressure; true OL blocking; personnel groupings; catchability/separation | Explicit unavailable contracts and no numerical live scores. Do not substitute sacks for pressure or directions for concepts. |
| D: provider/commercial evaluation required | Reliable current coverage/routes/alignment/tracking, pressure and blocking charting, first reads, full injury/active lists, forecast rain/snow/gusts | Separate adapter and licensing/freshness validation required. Historical FTN participation is delayed until after the season; no assumption it powers current games. |

Environment and personnel may be context-only: no normal-weather bonus or arbitrary injury points. Script and opportunity remain context, not duplicate quality score contributions. No final projections, probabilities, verdicts or deployment.

Primary sources: [PBP dictionary](https://nflreadr.nflverse.com/articles/dictionary_pbp.html), [update schedule](https://nflreadr.nflverse.com/articles/nflverse_data_schedule.html), [FTN charting dictionary](https://nflreadr.nflverse.com/articles/dictionary_ftn_charting.html). Metrics requiring new providers are capability gaps, not claims that a specific paid vendor has been selected.
