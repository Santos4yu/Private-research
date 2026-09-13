# NFL mobile research update — September 13, 2026

## Product changes

The player screen now uses a compact identity header, a horizontally scrollable stat strip, and four research tabs: Trends, Matchup, Usage, Details. Trends contains the real posted-line picker, editable comparison line, More/Less, sample windows, game-count controls, filters, summary and chart in one panel. Filter and comparison state survive switching tabs; a new prop resets to its own data. The home screen has a shorter search header and horizontally scrollable player cards on phones.

Regular, Goblins and Demons are separate PrizePicks categories. The sheet lists each numeric level once; More/Less remain comparison directions. Category assignments come from the existing provider adapter, not the new UI. Unclassified offers are not renamed to Goblins or Demons; they remain available in the broader props browser. Missing categories do not fabricate offers or silently substitute another platform. User-edited numbers/directions remain labelled custom comparisons.

App-owned dialog sheets replace native select elements in NFL research, filters and the props browser. Modal focus containment, Escape, close buttons, backdrop dismissal and return-to-trigger handling are supported. Inputs use 16px mobile text; primary controls have 44px touch targets. Each chart bar remains keyboard-operable and opens real game details. Source attribution remains under Data sources.

Matchup shows the existing prop-specific score first, when supported, with partial coverage clearly visible. Scored factors expand to evidence. Unsupported components, defensive metrics, target-depth context and certainty remain under expandable methodology instead of occupying full cards. Usage shows historical role statistics first; upcoming estimates and injury scenarios remain expandable. Model, opponent, game, injury and health sections are retained in Details. No model promotion, probability or MLB calculation changed.

## Descriptive opponent-volume fallback

`NFL_OPPONENT_VOLUME_CONTEXT_V1` adds a separate historical comparison for passing attempts, called rush attempts, QB rushing attempts and QB rushing yards. It is labelled **Opponent volume / Historical percentile**, never a validated matchup model or probability. It does not feed projections, decisions, or eligibility gates.

- Read only games before the requested week. Existing early-season history supplies explicitly labelled prior-season data.
- Compute each defense's per-game average; require at least four measured games and eight eligible defenses.
- Percentile is the fraction of other defenses below the selected opponent, with ties contributing one half. Equal values return 50. This is a descriptive rank, not a fitted forecast; endpoints are possible.
- Called rushes exclude scrambles, passing attempts exclude spikes, QB rushing excludes kneels. Labels state these differences.
- QB identity requires a roster QB and a recorded dropback. All recorded rusher counts must reconcile to team called rushes plus scrambles before a game contributes. Missing mappings or totals cannot become zero. A verified passer with no rushes can have an observed zero after reconciliation.
- It does not adjust for role, game script, opponent strength, or offseason changes. Passers absent from the roster or without a dropback are not assumed to be known QBs.
- Matchup cache version advances to `nfl-matchup-v4-context`. Other sports and their keys are unchanged.

## Verification

- 176 NFL backend tests passed, including five new descriptive-volume tests: neutral/tied ranks, position-specific accounting, no future games, minimum evidence, missing identities/totals, valid observed zeros and non-mutation.
- 29 NFL frontend tests passed. Added numeric-level deduplication/category isolation and server-rendered sheet/score/unknown-certainty checks.
- TypeScript check and Vite production build passed. Existing shared bundle-size warning remains; the NFL module stays lazy loaded (about 77 KB JS and 13 KB additional CSS, uncompressed).
- Full backend regression: 193/195 passed. The same two pre-existing `test_season_batting` failures remain (`104 != 4`, `10 != 0`); no MLB source was edited.
- Browser checks used real API data at 390×844, 412×915, 768×1024 and 1280×900. Header, tabs and chart stayed within the available content width. Horizontal movement is confined to prop/card rails and long chart samples.
- Verified custom filter sheets and nested location selection. Away-only filtering changed Rodgers' five-game average from 213.8 to 196.6. Choosing the returned 149.5 Goblin line changed the comparison and hit count immediately. These are dated QA observations, not recommendations.
- Verified line edits and a six-game sample survived Matchup → Trends navigation. No native select elements remained in the NFL research DOM.
- The live local QB-rush context returned Atlanta's 17-game, 32-team comparison (3.29 rushes/game, percentile 58), with the official matchup quality still null. This verifies the distinction between descriptive context and model score.

## Remaining limits

This is browser-based mobile QA, not physical iPhone/Android hardware certification. A cold play-by-play source may still take time; unaffected trend research stays usable. Line freshness still expires under the existing rule, and refresh is explicit. Only actually posted categories are available. Advanced coverage/route/tracking gaps and model validation requirements are unchanged. The UI work does not establish production betting-model accuracy.
