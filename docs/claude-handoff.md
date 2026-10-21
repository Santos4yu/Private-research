# Handoff for the next Claude session

Last updated 2026-10-22 (matchup score fitted to RotoBot). Read this, then CLAUDE.md's rules, before starting.

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

## Current project: NBA matchups on the Props tab

Where members find it: Props tab → MLB/NBA switch → NBA. It's off by
default: Admin → Access → Props tab → NBA matchups. Tapping a player opens
his matchup page; the back button (or the phone's back gesture) returns to
the list.

The owner wants this to work like RotoBot's "Analyze Props" (list of
players with a 0-100 matchup score, then a player page with Overview /
Matchup / Stats), in PropScout's own style, showing only the matchups,
not book odds.

### Files

- `src/PropsLeague.jsx`: the MLB/NBA switch on the Props tab.
- `src/NbaMatchups.jsx` + `src/nba-matchups.css`: the NBA list. On "All"
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

### What the owner may ask next

- They compare our numbers with RotoBot's screenshots. Ours won't match
  exactly: RotoBot's formula is private and it uses NBA.com data, while
  ours mostly comes from ESPN box scores. Say so plainly, and fix any
  number that's clearly wrong.
- Not built: a Highlights tab (RotoBot has one). The owner said to leave
  it ("Nothing sir that"); don't bring it up unless they do.
- The shot chart's corner-three counts come from ESPN play-by-play
  coordinates and can differ from NBA.com's.
