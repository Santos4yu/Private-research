# Handoff for the next Claude session

Last updated 2026-10-22 (one NBA matchup score; the assistant's play breakdowns). Read this, then CLAUDE.md's rules, before starting.

## Working with the owner

- Explain things in plain words, one step at a time, with the exact taps.
  The owner gets lost easily and usually works from a phone.
- The site is PropScout. Give it its own look. RotoBot and Props Edge
  screenshots are only references for what to show: never copy their
  wording, branding or layout one to one.
- No text on the site that looks AI-made, admin-only or like debug output.
  No "PP" labels and no PickFinder branding.
- Look: colorful but balanced and compact. No uneven layouts or gaps, no
  grey box inside a text field, nothing that looks "AI/futuristic".
- Free data only. The owner won't pay for another API.
- Secrets: never paste a key in chat, a commit or a `VITE_*` variable.
  Server keys live only in Vercel / Supabase env vars, and the anon key is
  never used for storage. Never repeat the cron timer secret or the NBA
  phone-relay link (it works like a password). Don't show the owner's email
  on the site. An Odds API key is rotated in the provider's dashboard and
  updated only in Vercel's env vars.
- New sections start switched off; the owner turns them on in Admin.
- Soccer stays off until the owner enables it in Admin.
- No Unders in the Parlay Builder or the assistant. The removed "line
  check" must not come back.
- The Finder stays as it is. The NBA matchup feature is its own page off
  the Props tab, not part of the Finder.

## How to work in this repo

- Another Claude session may also push to `main`: `git fetch origin main`
  before starting and before pushing.
- Tests: `node --test tests/*.test.mjs` and
  `PYTHONPATH=tests python3 -m unittest discover -s tests -p "test_*.py"`.
  Build: `npx vite build`.
- Browser checks: `npx vite preview --port 5182`, then Playwright
  (Chromium at /opt/pw-browsers) with every `/api/...` call answered from
  made-up data. The live site, ESPN and NBA.com can't be reached from the
  cloud container.
- Global `.unified-finder button{border:0;color:inherit}` beats plain
  button selectors; the NBA page scopes everything under `.nba-mp`.
- The page body has `overflow-x:hidden`, so `position:sticky` doesn't
  stick. Use fixed positioning (see the pinned bar in NbaMatchupPage.jsx).
- Deploy result: `gh api repos/santos4yu/private-research/commits/<sha>/status`.

## Current project: NBA and NFL matchups on the Props tab

Where members find it: Props tab → NBA / NFL / MLB tabs. Each league is
off by default: Admin → Access → Props tab → NBA matchups / NFL matchups
(`site_controls.py` and `src/site-access-core.js` `PROPS_LEAGUES`). Tapping a player opens
his matchup page; the back button (or the phone's back gesture) returns to
the list.

The owner wants this to work like RotoBot's "Analyze Props" (list of
players with a 0-100 matchup score, then a player page with Overview /
Matchup / Stats), in PropScout's own style, showing only the matchups,
not book odds.

### Files

- `src/PropsLeague.jsx`: the NBA / NFL / MLB tabs on the Props tab (only
  the leagues switched on show).
- `src/MatchupList.jsx`: the list both leagues use, given a config
  (`src/NbaMatchups.jsx`, `src/NflMatchups.jsx`: data store, stat tabs,
  score function, player page, words). `src/props-data.js` is the shared
  keep-warm store (`nba-props-data.js`, `nfl-props-data.js` wrap it).
  `src/MatchupPageShell.jsx` is the shared player-page frame (banner,
  pinned bar, tabs) and the "His games" chart.
- `src/nba-matchups.css`: the list. On "All"
  each player shows once, with his best line. Laid out as a page like the
  player page: NBA/MLB and the stat as underlined tabs, search + game +
  sort in one row of 44px controls, column names on wide screens, rows
  split by thin lines (no cards). The whole Props tab hides the site's
  background photo and glow (`styles.css`, next to `.user-bg-layer`): the
  owner wants solid pages there, nothing showing through or floating.
- `src/nba-props-data.js`: keeps the list's lines and league numbers warm
  and saved on the device (IndexedDB), so the tab opens instantly.
  `src/main.jsx` (`warmPropsLeague`) preloads it after the site opens.
- `src/NbaMatchupPage.jsx`: the player page. Full-width banner (team
  colors, team-logo watermark, photo, two-line name, next game), a slim
  bar + tab bar (underlined, attached to the banner) that pin to the top
  on scroll, then Overview (averages, his games vs the line, injuries),
  Matchup, Stats (position ranks, game log by month). The owner wants it
  to read as one page, not floating boxes: sections sit straight on the
  page split by thin lines (`nba-scout.css`, `.mp-body>*+*`); on wider
  screens the whole page is one surface. Don't bring back bordered cards
  or pill tabs there. On a computer (1100px+) it takes up to 1440px (the
  Props tab widens while a player page is open) with a bigger banner and
  each tab in two columns (`.mp-cols`/`.mp-col` in `NbaMatchupPage.jsx`);
  a column with nothing in it gives the other the full width.
- `src/sports/wnba/NbaScout.jsx` + `nba-scout.css`: the Matchup tab's
  cards. MatchupGrade (stat + opponent, G/F/C switch, verdict, number,
  gauge, six stats in a row), then a "Why this score" label, the
  opponent's defense card (team baseline + "vs guards, by stat" with the
  picked stat marked + his games vs them), play types, likely defenders,
  shot chart sheet, vs that team, position ranks.
- `src/nba-matchup-score.js`: the 0-100 score, fitted to RotoBot's grades
  on two of its pages (Oct 2026, see `tests/nba-matchup-score.test.mjs`):
  Dallas for a forward (RotoBot PTS 91, REB 89, AST 90, BLK 89; ours 91,
  89, 91, 89) and Indiana for a guard (RotoBot REB 100, AST 100, BLK 94,
  PTS 100, 3PM 77; ours 100, 100, 94, 98, 80). Like RotoBot's, it's the
  same for every player at a position against a team (his own games vs
  them show beside it, not in it), and a combo is the average of its
  parts. Each read is how far the team sits from the league average in
  standard deviations and adds a fixed number of points per spread to 50
  (`GAINS`): points allowed 16, defensive rating 16, pace 13, what they
  allow his position in the stat 7.5; threes also the 3-point % allowed
  (12), assists also the field-goal % allowed (8), steals also the
  opponent's turnovers (12). Bands: 75+ Strong edge, 60+ Edge, 40+
  Neutral, under 40 Tough. To tune it further, get more RotoBot Matchup
  pages (the G/F/C six-stat row plus "Team baseline" and "Vs position"
  ranks, and the longer list under "Show more") and refit against them.
- Server: `api/wnba.py` (resources `league-context`, `scout`,
  `play-types`, `defender`, `matchup`, `player-context`, `gamelog`),
  `backend/sports/wnba/context.py`, `scout.py`, `opportunity.py`,
  `nba_matchups.py`, `nba_relay.py` (NBA.com tables come in through the
  owner's phone relay).
- Tests: `tests/nba-matchup-score.test.mjs`, `tests/test_nba_scout.py`,
  `tests/test_nba_matchups.py`.

### Recent history

- Last pushed: `2a0fac3`. Full-width banner, pinned bar, pill tabs, grade
  laid out like RotoBot's with "Why this score", score measured from the
  league average, shot zones under 5 tries left uncoloured.
- `5313561`: at the season start (2026-27 began Oct 21) the league numbers
  were built from a few games only, so every row said "Not enough data".
  The server now blends in last season (and answers 503 if it can't read
  it); the client ignores league numbers covering under 25 teams and
  retries every 45 seconds.

- Jersey number in the banner: ESPN's rosters (`api/wnba.py`
  `_roster_directory`, cache key now `nba:v2`) give each NBA row a
  `jersey`; the banner reads "#5 · Timberwolves · Guard".
- "Who guards him" (both the Matchup tab card and the Finder's Defense
  tab): the owner showed RJ Barrett vs Chicago listing Jordan Hawkins,
  who guarded him for New Orleans and only joined the Bulls in Oct 2026,
  and missing Isaac Okoro (RotoBot: Okoro, Giddey, Buzelis). NBA.com's
  season matchups don't say which team a defender was on, so
  `nba_matchups.against()` now splits each pair by the games the
  defender played for each team against him (ESPN box scores,
  `faced_teams()`), over this season and last. The answer's `theirs`
  list (with `share`, `seasons`) is what both cards show, less anyone
  listed Out on tonight's injury report (`src/sports/wnba/defenders.js`).
  The rest of the card (`defenders`, `usual`) is still one season.
- The matchup score vs RotoBot's per-player grades: tested his games vs
  the team, similar players vs the team, defenders, play types and shot
  zones against RotoBot's Dallas guards (Sheppard, Thompson, Smart); none
  explains their player-by-player part, which looks like a trained model.
  The owner was told; the team + position part stays as fitted. Offered,
  not built: a small "his games vs them" piece (narrows the gap ~1 point).

### Also on the site (another session, same week)

- The Finder's NBA/WNBA player page has an Opportunity card first in its
  Matchup tab (`src/sports/wnba/Opportunity.jsx`, `opportunity.js`;
  server `backend/sports/wnba/opportunity.py`, `tracking.py`): minutes,
  usage, shots, rebound and assist shares, pace, what the defense gives
  the stat, and his numbers without each injured teammate. The owner
  asked for it, so it stays in the Finder.
- Finder Analyze has "The opportunity" section: what the line takes at
  his usual rate against what he's been getting.

### One matchup number, and the assistant's breakdowns (Oct 22)

- The owner saw RJ Barrett's matchup at 100 on the Props tab but 60-70 in
  the Slip Analyzer / Parlay Builder: those graded an NBA line with their
  own formula (`slip-matchup.js` matchupCase: 50 plus small pieces for
  defense, pace, rest, form, history). An NBA line's matchup is now the
  Props tab's score and reads (`nba-matchup-score.js`) everywhere: Slip
  Analyzer, Parlay Builder, Finder Analyze, the assistant. The case
  carries `cuts` (that scale's bands: 75 Strong edge, 60 Edge, under 40
  Tough) for the tiers and red flags (`slip-check.js` tierOf,
  `krazy-bot.js` withMatchup) and `pull: 0.5` on the chance. WNBA and the
  other sports keep the old formula and `CUTS`. Test:
  `tests/nba-one-score.test.mjs`.
- The owner sent RotoBot's chat ("best nba props": 5 plays, each with Key
  Analysis / Matchup / Recent Trends / Game Script / Usage & Roles and a
  verdict each) and wants the assistant that smart, in our own style.
  Now: "best NBA props" (plural, no number) asks for 5; a basketball list
  answers with a plays card (`AceCards.jsx` AcePlays, classes `ace-pb-*`;
  `ace-plays` is the side panel's, don't reuse it): the players along the
  top, the picked one broken down by `src/play-breakdown.js` into The
  read, Matchup, Recent form, The game, Role & minutes, each Helps /
  Mixed / Hurts with the numbers in sentences. It shows at once from the
  answer, then again with the research Analyze does (`prop-analyze.js`
  gradeProp: game odds, news, minutes and usage, NBA tracking). A single
  basketball pick ("How's X looking?") opens with the same breakdown.
  Other sports still answer with the plain list. Tests:
  `tests/play-breakdown.test.mjs`, the last test in
  `tests/krazy-bot.test.mjs`.

### NFL on the Props tab (Oct 22)

The owner sent RotoBot's NFL screens (list with hit rate + matchup; player
page with Trends, Matchup, Metrics, Games, News; box count, run concept,
run direction, coverage; RBs vs that defense; defense injuries; a bio
slide) and asked for NFL on the Props tab. Built in phases:

- Phase 1 (pushed, switched off until the owner turns it on): the NFL
  list (PrizePicks' standard lines for QBs, backs, receivers, tight ends,
  from the Finder's NFL board) and a player page
  (`src/NflMatchupPage.jsx`): Overview (last 10 vs season averages, his
  games vs the line, both teams' injury reports), Matchup (grade with a
  tile per stat, the reads behind it, what that defense allows his
  position this season and last 5, his games vs them, their defense's
  injuries), Stats (game log by season with each opponent's rank).
- The score (`src/nfl-matchup-score.js`, rebuilt Oct 22 after the owner
  asked why the list was all 90s and whether target share counts): built
  from a backtest of every 2024 and 2025 player-game with a real role,
  scored with only pre-game data against whether he beat his own average
  (scripts were in the session scratchpad; the method is in the file's
  header). What held up out of sample is all it reads, weighted by its
  log-odds x 140: what the defense allows his position (counted g/(g+4)
  after g games), what it allows every offense, the spread (game script:
  favorites run more and throw less), the team's implied points (the only
  thing that predicted touchdowns) and his role (`league.usage`: his share
  of the targets / carries a game, last season as three games of it). It
  needs `league.usage` and `league.slate` from `finder.league()`
  (`usage_of`, `slate_of`; finder VERSION nfl-finder-v6) and still scores
  on the defense alone without them. About 2.5% of props score 90+ (1.5% on
  the real week-7 board); out of sample those beat their average 7 points
  more often than usual, 75-90 about 3, under 40 3-4 less. Wide receivers'
  matchups barely mattered in the backtest, so their scores sit nearer 50;
  passing TDs and QB rushing had no signal and stay near even. Against
  RotoBot's week-7 grades: Gibbs TD 90 (91), Nacua TD 82 (85), Boutte 36
  (41), Skattebo 20 (25), Kraft 93 (82), Golden 66 (84), Stroud 11 (82:
  Houston are 10.5-point favorites against a stingy pass defense, which
  the backtest says means fewer passing yards). Tests:
  `tests/nfl-matchup-score.test.mjs` on the week-7 fixture (now with
  `usage`, `slate` and each defense's games).
- Phase 2 (done, Oct 22): `nfl_plays.py` builds a season table from
  nflverse (play-by-play streamed, FTN charting, weekly stats, snap counts,
  PFR rushing) and `/api/nfl?resource=finder-plays` serves one player's
  slice; the page shows it in `src/NflPlays.jsx` (words in
  `src/nfl-plays.js`):
  - Matchup tab: "How it plays" (box count, direction, run lane for backs;
    target depth, field area, blitz for receivers; throw depth,
    play-action, blitz for quarterbacks; coverage for all), each split
    folding open under a one-line read, and a bottom line; "Running backs
    vs GB" (everyone at his position who faced them, against his
    PrizePicks line that day where kept, else his average going in).
  - Metrics tab (new, 4th): production, volume and efficiency ranked at his
    position (this season or last), and "Where he does best".
  - The run side reproduces RotoBot's Gibbs page to the carry (light box
    54 car, 289 yds, 11th of 65; GB 2.62 a carry up the middle, the
    fewest): designed runs only; a run at either guard is "middle"; box 6
    or fewer light, 7 base, 8+ stacked; the defense side counts running
    backs only; a player is ranked in a look with 8+ plays there. Locked
    in by `tests/test_nfl_plays.py` RotoBotTests on a real week-6 fixture.
    Production/volume ranks match too. The bars scale with each player's
    own team games (regulars: 1.5 carries+targets a game; efficiency 7
    carries / 3.33 targets / 14 attempts a game), so a bye or a Thursday
    game doesn't move anyone; RotoBot uses flat league weeks, so our pools
    run one or two bigger (89 backs to its 88), same ranks.
    First downs include those by penalty (as RotoBot counts them); dropbacks
    use `passer_id` so scrambles count; ANY/A takes sack yards as stored
    (negative). Fullbacks aren't in "Running backs vs X" (RotoBot lists backs).
    Yards after contact is PFR's (RotoBot's comes from paid charting, so
    it differs).
  - Not in free data: RotoBot's run concepts (outside zone, power...). The
    "run lane" (end / tackle / guard / center, the hole the play-by-play
    logs) stands in, and the page says what it is. Coverage (man, Cover 3,
    split safety) only comes in the NFL participation file, published
    after a season: until 2026's is out the page shows 2025's, labelled
    "2025" (`data/nfl/coverage-2025.json`, rebuild with
    `python3 tools/build_nfl_coverage.py 2025`). Once
    `pbp_participation_2026` exists the table picks it up by itself.
  - Past PrizePicks NFL lines weren't kept, so weeks 1-6 compare each
    player with his average before that game. `line_archive.py` now keeps
    NFL lines too (from Oct 22), so later weeks show real lines.
  - The table is rebuilt daily by a cron (`/api/v2-admin?action=nfl-plays-cron`,
    12:00 UTC, `vercel.json`) into the PLAYS cache (26h; last season's 14
    days); a miss builds it on the request (about 1s locally at week 6).
- Phase 3 (next): bio slide (height, weight, age, experience), news, and
  the assistant's sectioned breakdowns for NFL plays (play-breakdown.js
  is basketball only). RotoBot's Games tab also has a career block
  (half-PPR finish by year) we don't have yet.

### What the owner may ask next

- They compare our numbers with RotoBot's screenshots. Ours won't match
  exactly: RotoBot's formula is private and it uses NBA.com data, while
  ours mostly comes from ESPN box scores. Say so plainly, and fix any
  number that's clearly wrong.
- Not built: a Highlights tab (RotoBot has one). The owner said to leave
  it ("Nothing sir that"); don't bring it up unless they do.
- The shot chart's corner-three counts come from ESPN play-by-play
  coordinates and can differ from NBA.com's.
