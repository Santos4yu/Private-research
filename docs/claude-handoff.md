# Handoff for the next Claude session

Last updated 2026-11-08 (Game Predictor live games: a game on its own clock, then the feed, live props, our pick live, swings, stretches, alerts and live games first in the list; before that, Game Predictor: each game its own page with tabs, the pick full screen; picks only when saved, Kalshi-style markets, swipe up to save, live charts; redesigned as one full page with a day-by-day moneyline generator; best picks and parlay builder; v2 live: two predictions, warnings, EV, daily snapshots; the Game Predictor: NBA and NFL winners, final scores, edges and a settled history, a new section that starts off; before that the News card, the parlay builder and slip fixes, and Defense vs position). Read this, then CLAUDE.md's rules, before starting.

## Working with the owner

- Explain things in plain words, one step at a time, with the exact taps.
  The owner gets lost easily and usually works from a phone.
- The site is PropScout. Give it its own look. RotoBot and Props Edge
  screenshots are only references for what to show: never copy their
  wording, branding or layout one to one.
- No text on the site that looks AI-made, admin-only or like debug output.
  No "PP" labels and no PickFinder branding.
- No explanatory footnotes (Oct 24, the owner: "remove all these things
  like this" about a grey "Green: among the most... Red: among the
  fewest..." note). All `nd-foot` notes on the NBA/NFL player pages and
  the Finder's matchup card, the Props list's long how-it-works line and
  the track record's note are gone. Explain in labels, the Why panels and
  the read texts instead; don't add fine print under cards.
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
- The Finder keeps its features and data. The NBA matchup feature is its
  own page off the Props tab, not part of the Finder. Its look is the
  owner's to change (Oct 27 phone cards, Oct 30 computer board).

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
- Open apps update themselves (Oct 22): every build bakes its id into the
  bundle and writes `/version.json` (`vite.config.js`); `src/app-update.js`
  checks it when the app comes back to the front (reloads at once) and every
  5 minutes (reloads after 3 untouched), at most once a release per 10
  minutes. Scores are worked out on the phone, so without this a phone kept
  old scores until the app was fully closed. Phones on a build from before
  this need one full close and reopen to pick it up.

### Oct 27: phone dock like YouTube's new one

- The owner sent YouTube's new floating dock: "I want a nice dock like
  this". `src/MobileNavigation.jsx` + the dock block in `src/mobile-app.css`:
  icons only (the names stay for screen readers, `.mobile-sr-only`), a
  glass capsule (light tint .46, blur 20px, a thin light rim, soft
  shadow), and a lighter pill behind the current tab that slides with a
  small spring when the tab changes (`use-ink.js`, which now takes a
  selector: `[aria-current=page]` here). My Slip's count is a red badge.
  Same five slots and the same hide-on-scroll as before. Headless
  Chromium here doesn't render the blur reliably; phones do.
- Then: "I want the bar to be glass like the yt one and thin like it not a
  plastic foggy look". Now 54px tall (was 64), 4px inset, almost no tint
  (rgba .16) with a light blur (5px, saturate 175%, brightness .92), a
  bright rim and a soft sheen gradient across the top; icons 25px with a
  faint drop shadow so they read over any content. Keep it clear glass:
  more tint or blur is what made it look foggy.

### Nov 8 (b): live games, all seven ideas (feed, props, pick, swings, stretches, alerts, list)

- The owner, offered seven ideas for live games after the game-clock chart
  (a live feed, a live prop tracker, how our pick is doing, biggest swings,
  a momentum strip, close-game alerts, a live list view): "Yes add all".
- Server: `game_live.py` (new), all from the ESPN summary the chart already
  reads every 3 s. `game_predictor.chart` adds `feed` (last play {text,
  when, side}, `run` {side, points}: unanswered points, NBA 7+ / NFL 10+;
  `quarters` from the linescores; `leaders`: NBA top two scorers, NFL top
  passer / rusher / receiver; `lead`: each team's biggest lead), `swings`
  (the 2-3 plays that moved ESPN's chance most, 5%+, 90 s / 150 s apart;
  the final buzzer's jump to 0/100% left out), `momentum` (points each team
  scored per stretch: NBA 3 min, OT 2.5; NFL 5 min) and `props`. Each part
  stands alone: one failing is null, the chart still answers.
- Props: the lines come down at tip-off, so they come from
  `line_archive.lines_on` (the last number each NBA/NFL line had before its
  game, kept by game day; read every 2 minutes), matched to the box score
  by name without Jr./III (`person_key`). NBA stats from the box score's
  keys (as wnba/league.py), NFL from `nfl/preseason._read_group`. Stat
  names: `NBA_PROPS` (incl. PrizePicks' fantasy score: pts 1, reb 1.2, ast
  1.5, blk/stl 3, TO -1), `NFL_PROPS` via `nfl/markets.market_for`. NFL
  players show once they're in the box score (ESPN leaves out a receiver
  with no catch yet).
- `action=game-live` (`game_live.live_list`): the scoreboard every 15 s
  (NBA: yesterday's too until 6 am ET, for late tips) and each game on now's
  chance line cut to ~40 points.
- Page: the Chance tab in a game: one alert line at the top
  (`liveAlert`: within 5 (NFL one score) in the last 5:00 of the 4th/OT; a
  comeback from 15+ (NFL 14+) to within 5/7; the pregame underdog (market
  under 40%) ahead from Q2; after the game, an upset), swing rings on the
  chart (tap: the play and how much it moved), the stretches strip under the
  chart (home above the line, away below), the last play and the run under
  it, and "Our pick, live": "72% before the game → 48% now", "Down 6"
  (`pickStatus`; final: "Won 112-104"). A new tab after Chance, "Live" ("Recap"
  after): score by quarter, top players, biggest swings, player props (count
  / line, a bar, "Needs 3" / "Hit" / "Missed" / "Push"; the first eight,
  then "Show all"). The list: "Live now" at the top (`liveFirst`), each with
  both scores, the time left and a sparkline of the team ahead's chance.
- Checked on made-up data (Playwright, phone): list, Chance, swing tip,
  Live tab, no sideways scroll, no errors. The GitHub check now prints the
  feed, swings, stretches against the final score, the box score and the
  live list for a real finished game. Not yet seen live: a real in-game
  feed and props with real archived lines (the check has no KV store).

### Nov 8: live games on the game's own clock; pregame prices say so

- The owner, with a live HOU @ PHX page: "How could we make this better for
  live games?" Offered: a game-clock chart, a live feed (last play, runs,
  quarter scores, top scorers), a live prop tracker, "how our pick is
  doing". Picked: the game-clock chart. Also fixed unasked: the price
  buttons showed the pregame line (HOU 70¢ -264) next to a live 53%.
- `game_clock_series(sport, summary)`: each ESPN win-probability point at
  its play's time into the game (`game_elapsed`: NBA quarters 720 s, OT 300;
  NFL 900 / 600; from each play's period and clock, NBA `plays`, NFL
  `drives`), the game's length (grows with each overtime), the periods
  (Q1-Q4, OT / OT2...) and the time now. On the chart as `chart.clock`.
- `TwoLineChart` in a game with a clock: x runs 0 to the game's length, a
  dashed line between quarters, their names under the chart (the one being
  played in white), the line stops where the game is (`chartPath` takes
  `toEnd: false`), the dots and the team labels there; a touch reads
  "Q2 4:00 left" (`gameClockText`). Without a clock (no play times), as
  before on clock time.
- Prices in a game: `with_dk` marks `inPlay` from DraftKings' event status
  (`parse_dk` "live": STARTED / LIVE / IN_PROGRESS, not yet seen on a live
  game), the chart's `now.priceLive`. Not in-play: the buttons read
  "Pregame -264" with no cents. The GitHub check prints a finished game's
  game-clock series.
- Shipped as 23ced04 (deployed). Its GitHub check failed on a bad indent in
  the new game-clock print (the workflow only, not the site). Fixed and
  committed, but not pushed: per CLAUDE.md, it goes out with the next site
  change. After that push, run the check and read the "game clock:" lines
  (NBA and NFL finals: points, length 2880 / 3600, Q1-Q4). Real ESPN plays
  were already seen to carry `period.number` and `clock.displayValue`.

### Nov 7: the Why tab's analyst write-up (worked-out pick + Groq sections, checked)

- The owner: "On the write up part I want better detail tho like are the
  suns struggling etc", with a full brief for a professional NBA moneyline
  analysis (the pick block, why, the matchup that matters, what could go
  wrong, injuries, moneyline value, final verdict; only the app's data, no
  invented numbers, value separate from the likely winner, NO BETTING EDGE
  when there is none). The brief is `ANALYST_BRIEF` in game_predictor.py.
- New data (NBA): `team_profiles` (in `nba_context`, from the stored
  season's box scores): per team, the season's and the last 10 games'
  points scored / allowed per 100, possessions a game and the four factors
  both ways (eFG%, turnovers per possession, offensive rebound share, free
  throws per shot, three-point share and %), league ranks for the season,
  the last 10's record and margin, the last 5 results. `nba_model_v2` adds
  `profiles`, `adjusted` (the model's schedule-adjusted ratings) and
  `boxScoresThrough`; `prediction` passes them on with `homeInfo` and
  `possessions`.
- `pick_block(made)`: the numbers, never the model's: winner, score, model
  chance, the moneyline, implied chance with and without the vig, edge
  (model less no-vig), expected return on $1 at the price (and the
  underdog's), verdict (> +2% Positive value, within ±2% Fairly priced,
  below Negative value, no price Insufficient data).
- `analysis_facts` -> `write_analysis` (Groq through slip_reader._ask, JSON
  with why / matchup / risk / injuries / value / verdict) ->
  `unverified_numbers`: any write-up quoting more than 2 numbers the facts
  don't hold (small counts and years aside) is thrown away. `analysis()`
  keeps it 30 min per game and facts digest (store + memory);
  GET action=game-analysis. NFL: the pick only (the plain write-up stays).
- The plain write-up (`story`) gained a "Form" point (`_form_line`): the
  last 10's record and margin and its net rating against the season's, and
  which end changed ("are the Suns struggling").
- Page: the Why tab loads the analysis when first opened ("Writing the
  analysis…"): THE PICK as rows with the verdict, then the six sections;
  without sections, the plain write-up. Not seen live yet: Groq's answer
  (GROQ_API_KEY is in Vercel only); sections on an NBA game's Why tab mean
  Groq wrote and passed the check, the plain write-up means it didn't.

### Nov 7: the Game Predictor's Generator controls, cleaner

- The owner, with the Generator tab: "Make this look cleaner". It was
  four rows: big two-line day tiles, two segmented controls (league,
  order), a Payout / Legs switch and its chips.
- Now two rows: the days as one line of words ("Today", "Tomorrow",
  "Sun 8"; `dayName`) on a gliding soft pill, then three small pills
  (`ChipMenu`): league (NBA / NFL / NBA + NFL), order (Most likely / Best
  value) and parlays (one list: "Pays 2x or more"... under "By payout",
  "2 legs"... under "By legs"; the pill reads "Pays 2x+" or "3 legs"). A
  pill opens a short list under it (the last one opens to the left),
  closes on a pick, outside tap or Escape. `Chips` is gone.
- No games left today: "No games left today" and a "See tomorrow" button.

### Nov 7: the Finder player page tighter on a phone (and no PrizePicks card)

- Then, of the PrizePicks card (logo + goblin) under the player: "Let's
  remove this so it's more compacted". FinderPlayerBanner.jsx `pickCard`:
  the card only on the older layout; the v2 page's line picker already
  shows PrizePicks and the tier. A night with sportsbook odds still shows
  their cards (and the market-chance card); with none, no odds row at all
  (the stats panel starts under the player, ~48px higher).

- The owner, beside PickFinder's page: "Ours needs to be way more compact
  look at the difference". finder-player-v2.css, the "Nov 7" phone block
  at the end: odds cards 46px (logos 30), tabs 38px (smaller badges),
  title 18px, buttons and filter fields 34px (labels 11.5px), the windows
  ~60px (12px text, no wrapping: "Avg 16.3" broke onto two lines beside
  "L20 ⌄"), the bars' track 170px (`--gl-track-height`, was 196) with 20px
  logos and smaller dates, 8-10px between blocks. Measured in a 390px
  Chromium: the panel ends at 672px (was 777px); the chart and the
  average fit on one screen with the research tabs showing.

### Nov 7: Game Predictor live games refresh every few seconds

- The owner, with a live WSH @ ATL page (WSH up 30-28 late in the 1st, ATL
  69%): "Is this correct? On live it should [move] most instantly".
- Correct: the live line is ESPN's own win probability after each play,
  which starts from the pregame odds (ATL was a ~70% favorite), so a team
  down 2 in the 1st can still be the favorite. The buttons' price is
  DraftKings' (live: it had moved from -241 pregame to -324).
- It lagged up to ~35 s: the page asked every 15 s and the server kept
  ESPN's answer 20 s. Now `useChart` asks every 4 s in a game (60 s
  before), `LIVE_SECONDS` 3, `DK_SECONDS` 6. More function calls while a
  game page is open (one every 4 s per viewer); ESPN's own feed still
  trails the TV by a few seconds.
- The header's clock reads period first (`liveText`: "54.7 - 1st" ->
  "1st · 0:54.7").

### Nov 6 (Finder player page, round 2): the page after PickFinder's layout; Game Predictor list solid

- The owner: "you didn't make the finder layout like pickfidner" (only the
  filters had changed), and of the Game Predictor's list: "fix the see
  through background on this aswell".
- Game Predictor: `.gp-list-bg` (a fixed, solid `--ace-bg` layer first in
  `.game-predictor`, under the accent glow), like the game page's
  `.gp-page-bg`. Checked: it covers the screen.
- Finder player page (finder-player-v2.css, "Nov 6 (b)" section at the end;
  layout only, our colors):
  - The odds: cards (60px, 14px corners), each book's logo with its O and
    U stacked; the market-chance card's O in green, U in red.
  - The stats: folder tabs, the line in a badge beside the name; the picked
    tab is filled with the panel's color, its badge white (the old
    underline, `box-shadow: inset 0 -2px`, is off).
  - Phone: one panel from the stats to the averages, `.gamelog-modal::before`
    as a grid item over `tabs-start / summary-end` (needs `align-self:
    stretch`: the grid aligns items to the start, which left it 0px tall),
    #171717 on the page's #0e0e0e; the tabs on a #121212 strip along its
    top.
  - The line stepper framed (one group, hairlines between); the windows on
    a darker strip, left aligned, "HR 100%" and "Avg 5.6" both in the
    rate's color (`.gl-window-avg` is an older class with !important
    colors and sizes elsewhere, hence the !important here); the chart's
    numbers plain over the bars (`.gl-val`, no pill).
- Not done from their page: quarter / half buttons by the title, split bars
  (OREB / DREB), the "Supporting stats" section; the owner was offered them.

### Nov 6 (Finder player page): More filters (minutes, days rest); filters and windows after PickFinder's layout

- The owner, with PickFinder's player page and its filter sheet (Minutes
  Played range, Days Rest "(Upcoming: 1 day)", Spread): "I want this and
  also I want the finder to look like this this design is clean just with
  out colors but I like their design more". Layout only: no PickFinder
  name, colors or wording.
- More filters (app.js, after `filterGames`): `gameLogState.minRange`
  ([low, high] or null) and `restFilter` ("any" or a bucket), reset for a
  new player. Minutes: the game card's `details.min` (basketball; the field
  hides when no game has minutes). Rest: `restGap` (days since his previous
  game in the log, cached per chart), `restBucket`: basketball and the rest
  count days off (0 back-to-back, 1, 2, 3+), football the days between
  (short week 6 or less, normal 7, extra 8+). `upcomingRestText`: tonight's
  from the config's `startsAt`. Spread isn't offered: there are no past
  game lines to filter by (free data).
- The sheet: `#gl-more` (index.html) last in the filter row, a sliders
  button with a count when on; `#gl-more-pop` moves to `<body>` on first
  use (the panels around the filters clip it) and sits under the button,
  or over it with no room; two range inputs on one track, rest chips,
  Reset. Shown on the Finder's player pages only (`EXTERNAL_TREND_ADAPTER`).
  Gotcha: a chip is redrawn during its own click, so outside-click closing
  checks `composedPath()`, not `contains`.
- Layout (finder-player-v2.css, the Nov 6 section at the end): each filter
  its name above a 40px soft field, all on one row with the button
  (`flex: 1 1 0`, the season part 1.6; the grid needed
  `grid-template-columns: minmax(0, 1fr)` and `justify-content: stretch`
  or an older `space-between` shrank the field to its text). The season
  part's "Regular + Playoffs" is now "No preseason". The windows show the
  hit rate and "Avg 5.6" (the record moved to the tooltip).
- Checked in Chromium, phone and computer (the mock can open a player's
  page again once its matchup answer is an error: the Win predictor reads
  `teams` from it).

### Nov 6 (Finder): the phone board as one full page, solid, no frame

- The owner, with a phone screenshot of the NFL Finder: "I want this to be
  full page not floating please and I don't want a transparent background
  it shouldn't the see through either I need a sleek clean redesign that
  looks high quality".
- `src/finder-phone.css` (loaded last by UnifiedFinder.jsx; phones only,
  rules carry `html:root body` to win over finder-cards / finder-board /
  unified-finder.css). The computer board is unchanged.
  - The page: `.unified-finder::before` is now a fixed, full-screen solid
    layer (`--ace-bg`) inside the Finder's own stacking layer. It replaces
    the old accent glow over the top 200px (unified-finder.css set its
    `height`, hence `height: auto` here). `::after` is the same color under
    the status bar and iOS's glass band (`--site-status-inset`) so the list
    never scrolls through it; not on a player's page (its banner reaches up
    there on purpose).
  - The board: no border, radius, frame or margins; each prop a full-width
    row with a hairline inset 14px from both edges, no alternating shade.
  - The sort buttons stay at the top while the list scrolls (sticky under
    the status inset): words with a soft fill under the sorted one, no
    outlines. Sticky needed `overflow-x: clip` (not `hidden`) on html and
    body while the Finder is open: "hidden" made them scroll boxes that
    never scroll, so nothing could stick.
  - The controls: soft filled fields, no outlines; the filter row scrolls
    to the screen's edge.
- Then: "now this is just see through" on a player's page. The site showed
  through there because unified-finder.css hides `.unified-finder::before`
  on `.finder-detail-active` (it was the glow) and the first version of
  this file had set the Finder's own background to none. Now the Finder's
  background is the solid color too and `::before` is `display: block
  !important` on every page.
- Checked in a 390px Chromium: solid page, the bar stuck at the top after
  scrolling, no sideways overflow, the computer board unchanged; with the
  player-page class on, the solid layer and background are there. The mock
  data here can't open a player's page (a TypeError, the same on the code
  from before this change).

### Nov 6 (share): moneyline picks and parlays as a picture to send

- The owner, with a sportsbook's "3 Pick Parlay" screenshot: "a nice
  copyable image the website gives when I do moneyline wither it's a
  straight or parlay this is how I send my current parlays".
- `src/game-share.js`: `drawMoneyline({legs, stake})` draws the site's own
  card on a canvas, 1080 wide and as tall as its legs: "Moneyline" or
  "3-Pick Parlay" with the total odds and "pays 2.04x", then each leg (the
  game and its time, the team's logo through `viaSite`, now exported from
  slip-share.js so the canvas can be saved, the team, "Moneyline", its odds
  and our chance), then Amount / To win / Payout (dollars, or units when no
  amount), and the site's name as on the other share cards (`SITE`).
  `cardText` holds the words (tested). `shareMoneyline` hands it to a
  phone's share sheet (the picture alone, so Copy copies the picture), else
  copies it to a computer's clipboard ("Copied"), else downloads it.
- `ShareButton` (GamePredictor.jsx) on the saved pick screen, the
  generator's "Most likely to win" pick and each parlay (an icon only on
  phones). On the saved screen it's just the icon in the top right corner,
  opposite the close button (the owner: "remove that and use the little
  share icon ... on the top corner"; it was a big button over Done). The saved screen's Payout now reads "1.40 units" when no amount
  was entered (it was a dash).
- Not changed yet: the saved screen still says "You picked"; the owner was
  offered "Locked in" + "Mavericks to win" and other wordings, no answer yet.

### Nov 6 (latest of all): home edge from the records, this season's ranks, the DraftKings-style chart

- The owner: "don't just automatically give the team a plus for being at
  home check are they performing well at home? Or are they performing
  better away and also make sure we use mainly this seasons stats for
  defense and offensive rankings". And, of DraftKings' game chart: "look how
  nice theirs looks love that".
- `season_numbers` (game_predictor): each team's offense and defense from
  this season's finished games only (NBA: per 100 possessions from the
  stored season's box scores; NFL: points a game from the nflverse games
  index, regular season), league ranks, and its record and average margin
  at home and on the road. On the contexts as `seasonTable` (not "season":
  the NFL context already has `season`, the year).
- Ranks: the teams' `ortg` / `drtg` (NBA, after 3 games) and `pf` / `pa`
  (NFL, after 2) are now this season's numbers, `basis: "season"`; the
  write-up says "this season". The model's ratings are unchanged (they
  start from last season and lean on this one more every game, as
  backtested); only what the page shows as ranks changed.
- Home edge: `_with_home` swaps the model's flat home edge (NBA 2.05, NFL
  1.02 points) for tonight's: each team's own edge, half its home margin
  less its road margin this season, pulled toward the usual by
  `HOME_SHRINK` games (NBA 25, NFL 20; 5 home and 5 road games move it a
  sixth of the way), the home team's and the visitor's averaged, kept
  between half and twice the usual. Moves the margin, the questionable
  scenarios and the "Home court" part ("ATL 1-4 at home · WSH 1-4 on the
  road"). Not backtested (a few games are mostly noise, hence the pull).
  The write-up's "Home and away" point gives each team's record and margin
  where it plays tonight and in its other split (the first version showed
  only "0-3 at home" next to "about the usual edge", which read as a
  contradiction when the team is even worse away), then whether home court
  counts more or less than usual tonight.
- Chart (`TwoLineChart`): after DraftKings' layout, our own colors: dotted
  rules every 15 points (the range snapped to them, at least 35-65%) with
  the numbers down the right, each line running on to now at the latest
  price with a dot at its end, then the team in a small label in its color
  (`inkOn` picks dark or white text) and the chance big under it.

### Nov 6 (after final): "these aren't draft king odds" and "why are the lines just flat?"

- They were DraftKings' odds: the owner's DraftKings screenshot showed WAS
  +199 / ATL -241, spread 6.5, total 230.5, the same as the Odds tab. The
  page showed them only as a chance (32% / 68%) and cents, Polymarket-style,
  so they didn't look like DraftKings'. Now each price button also shows
  DraftKings' own odds under the cents (`.gp-buy small`), the Odds tab's
  section is "DraftKings moneylines", and a note under the chart names the
  book.
- Flat: DraftKings hadn't moved that game's price all day (-241 / +199 at
  06:26 UTC and still at 16:48 UTC in their app). Pre-game moneylines often
  sit for hours; in a game the chart is ESPN's win probability, play by play.
  The note under the chart (`marketNote`, core) now says so: "DraftKings ·
  ATL opened -218, now -241" when it moved from its opening price, "no
  change since it opened", or "no change since 1:26 AM" (`steadySince`, from
  our own samples) when the opening price isn't known.
- Opening prices: `_line` keeps ESPN's scoreboard `moneyline.{home,away}.open`
  as `line.open` (the summary's pick center doesn't carry it), and `chart()`
  reads it from the slate (`chart.open` {moneyline, market}) for a game still
  to start. The GitHub check prints each slate game's opening line.

### Nov 6 (final): Game Predictor — a tighter game page with its own background; Why in plain words

- The owner, with screenshots of WSH @ ATL: "Compact this all a little more
  and let's get a background tho so it's not just transparent also for
  people who don't understand like odds and other stuff in the why let's
  make a detailed ways to read and understand write up ... include
  defensive rankings injuries only the injuries that matter".
- Background: `.gp-page-bg` (a sibling of `.gp-page`, fixed, z-index -1
  inside `.game-predictor`'s own layer, not inside the animated page: a
  transform there would pin it to the page) is the site's dark with each
  team's color soft in its top corner. Checked: it covers the viewport.
- Tighter: smaller header, team rows (32px logos, 24px chances), tabs (42px),
  chart 150px (was 210), price buttons 48px (was 58), "Our pick" and the
  sections' spacing. The whole Chance tab fits on a phone screen.
- Colors: ATL and WSH are both red on ESPN, so both lines and buttons were
  red. `_competitor` now keeps ESPN's `alternateColor` (`alt`, passed on by
  `prediction`), and `pairColors` (core) swaps the away team to it when the
  two look alike (redmean distance under 150), else the home team's, else
  gray; a near-black second color isn't used.
- Why, top: "the short version", written by the server
  (`game_predictor.story`, on every prediction as `story` {headline,
  points [{key, text}]}): who we pick and the score; the chance in "games in
  10" against DraftKings' price (more / less / agree / against the market);
  the winner's offense against the loser's defense with league ranks (or the
  defense end if that's the bigger edge; "on paper the other team rates
  better" when neither is); the player to watch on each side (the best
  matchup's first reason, "WSH allows" turned into "the Wizards allow");
  injuries that matter (NBA: out and worth 1+ point, questionable worth
  1.5+; NFL: a starting QB out from the new `qbOut` on `nfl_model_v2`, and
  QB / RB / WR / TE out); rest, home and form; what the confidence means and
  how often a team at that chance still loses. The page labels each point.
- Then "Check first" (without the questionable "if he sits" lines, already in
  the story), "Injuries that matter" (`keyInjuries`; the rest is a count),
  "What moves our number", and "New to odds? How to read these numbers"
  (closed until tapped; `readGuide` with this game's own numbers: the % and
  ¢, the moneyline, what $10 pays, our pick against the price, value,
  confidence, spread, total).

### Nov 6 (newest): Game Predictor — moneylines straight from DraftKings

- The owner asked where the free odds come from (ESPN's copy of DraftKings'
  line, refreshed every few minutes), then: "Yeah use draft king odds".
- `game_predictor.py`: `dk_events(sport)` reads DraftKings' own public league
  feed (`DK_URL`, the one its sportsbook pages read; `DK_LEAGUES` NBA 42648,
  NFL 88808), at most every 15 s (`DK_SECONDS`); `parse_dk` keeps each game
  with a "Moneyline" market priced on both sides (its American odds use a
  Unicode minus; "EVEN" is +100). `dk_match` pairs it with ESPN's game by
  both nicknames at the end of DraftKings' names ("POR Trail Blazers" ends
  with ESPN's short name) within six hours, a neutral-site game listed the
  other way round turned back. `with_dk` puts DraftKings' moneyline and its
  no-vig chance on the line (`source: "draftkings"`), keeps ESPN's spread and
  total, and returns copies (the cached ESPN games aren't changed).
- Used everywhere a line is read: the slate (again after its 5-minute
  cache), the generator's days, a game's summary (so predictions, EV and the
  blend use DraftKings' price) and the chart (`chart.source`); the chart's
  15-second polls sample it, so the market line moves with DraftKings.
- Unofficial feed: if it fails, blocks us or matches nothing, ESPN's line
  stands and DraftKings isn't tried again for 2 minutes (`DK_RESTING`), so no
  page waits on it. The container can't reach DraftKings (proxy 403); the
  GitHub check (`game-predictor-check.yml`) has a step that reads it and
  prints the matches.
- Checked on GitHub after the push (Nov 6): DraftKings answered 200 for
  both leagues (NBA 9 games, NFL 27, markets named Moneyline / Spread /
  Total, selections `outcomeType` Home / Away), and every game on the slate
  matched (8 of 8 each), the page's line marked `draftkings`. Right then
  the prices equalled ESPN's copy; the difference is that ours is seconds
  old. The live site (Vercel) can't be read from here without a member
  login; if DraftKings blocks Vercel, the page quietly keeps ESPN's line.

### Nov 6 (last): Game Predictor — each game its own page with tabs; the pick full screen

- The owner, with Polymarket screenshots: "Make them a page when we click on
  it not a dropdown ... not a bunch of useless information ... not just a
  long scroll down page ... keep the odds and % seperate like make tabs in
  the game page ... the slide up should be a full screen".
- Predict's list rows open `GamePage` (no drawer): a back arrow and
  "AWAY @ HOME" with the time or "Live · Q2 5:00", the two teams with their
  chance now in team color (live win probability, else the latest market,
  else the prediction; `chancesNow`) and the score live, then tabs:
  Chance (`TwoLineChart`: both teams' lines in their colors, the latest at
  each end, a touch readout of both; two big price buttons; "Our pick" with
  confidence and the final score), Odds (moneyline value, the line, our model
  vs with the line, the buttons), Why (check first, what moves the number,
  who's out), Players (best matchups, side by side). Gone: the pace / blowout
  facts and the confidence-reasons line.
- Back: the page pushes a history entry marked `gpGame` (as MatchupList's
  `nbaMatchup`), so the phone's back closes it; the list's scroll comes back.
  Careful: inside `GamePredictor` the name `history` is the picks state, so
  the browser's is always `window.history` (the first try silently failed on
  that).
- `PickScreen` (portaled, fixed, full screen, slides up): close, the team
  "to win", the amount in big numbers with +$10/25/50/100 and a keypad (or
  the keyboard), "To win" in green, then `SwipeBar`, a team-colored bar at the
  bottom ("Swipe up to pick BOS"; drag up 90 px; Enter / Space). Saved, the
  whole screen turns the team's color: "You picked Celtics", amount, odds,
  to win, payout, Done.
- Then: "I want this swipe thing to actually move up and down smoothly".
  `SwipeBar` writes `--lift` straight to the bar each frame (no React render
  per move), no transition while `data-dragging`, rubber-banded below rest
  and past the line (110 px), "Release to pick ATL" past it, flies up then
  saves, springs back short of it; its color runs on below it (`::after`).
  The real reason it never moved on phones: styles.css
  `button:active:not(:disabled){transform:scale(.965)}` replaced the lift
  while the finger was down; `.gp-screen .gp-swipebar` now sets its own
  transform with !important.

### Nov 6 (latest): Game Predictor — picks only when saved, Kalshi-style markets, swipe up to save, live charts

- The owner: "I don't want To automatically add props to the history make
  it only if I add the prediction ... a Kalshi look ... the poly market
  swipe up to buy thing that would save it to the history ... the % graph
  ... use espn and make sure it auto updates ... live odds for free".
- Nothing is kept automatically any more: `predict` and `board` keep
  nothing, and the cron's `snapshot` only samples odds. A member's history
  is their own saved picks: `save_pick` / `remove_pick` (POST
  `action=game-save` {sport, event, side, stake?} / `game-remove`, routed
  in api/prediction.py `do_POST` → `_game_predictor_post`, member from
  `_member_id`), `PICKS_KEY = krazy_data:predictor:v2:picks:{member}:{sport}`.
  One pick a game (a new save replaces it); a pick closes at tip-off; a
  pending pick can be removed. Settled with `units` (at its saved
  moneyline) and `profit` (if a stake was given); the record has W-L,
  units, money staked / profit, pending. The old site-wide histories
  (`...:v1|v2:history:{sport}`) are left in the store, not shown.
- Charts: `sample_odds` keeps each game's market chance (no-vig moneyline)
  under `ODDS_KEY = krazy_data:predictor:v2:odds:{sport}:{event}` when it
  moves 0.2 points or every 15 minutes, from every fresh slate read, the
  cron and the chart itself. `chart(sport, event)` (GET `game-chart`)
  reads ESPN's summary at most every 20 s: the line now, the kept series,
  and in a game ESPN's win probability after every play (`live_series`,
  each at its play's wallclock, else spread from tip-off to now). The page
  polls it every 15 s live, 60 s before (paused while hidden). Free, but
  only as live as ESPN's lines (they update every few minutes); tick-by-tick
  sportsbook odds would need a paid feed. The GitHub check now prints a
  finished game's win probability and a game to come's pickcenter + chart.
- Page: the open game shows a Market section after the winner: the
  predicted winner's market chance now and its move, the chart (a step
  line; our pick as a dashed line; a touch / hover readout; a pulsing dot;
  live: "Live · Q2 5:00" and the score), then each team with our chance and
  a price button in cents (team-tinted). The button opens `PickSheet`
  (portaled to body; slides up, drag the grab bar down or tap outside to
  close): price, our chance, value, an amount with +$10/25/50/100, to win
  and payout, and `SwipeUp` (drag the knob up past 84 px; a tap nudges it;
  Enter / Space saves). History is "Your picks" with remove buttons.

### Nov 6 (later): Game Predictor redesigned as one full page; a day-by-day generator

- The owner, with a phone screenshot: "this all looks super cheap ... I hate
  how it's all floating I want to look like a full page not random floating
  islands use nicer buttons and layout smooth visuals and effects ... a
  moneyline generator for certain days like ... tmrw or another day or today
  ... for what sports or a mix".
- src/GamePredictor.jsx rewritten, src/game-predictor.css rewritten: no
  outlined cards anywhere. A header (title, record, league with a gliding
  pill, `Segmented` on use-ink.js) over a soft accent glow (`.gp-aurora`,
  radial-masked so it never shows an edge; `.game-predictor` is
  `overflow-x: clip` so it can't widen the page), then tabs Predict /
  Generator / History (sliding underline; the last tab is remembered in
  `game-predictor-view`).
  - Predict: the slate by day ("Today", "Tomorrow", weekday); tapping a game
    opens its prediction in place (grid-rows drawer) and scrolls to it; the
    old "Select a game" menu and "Predict winner" button are gone. The
    prediction is flat sections split by hairlines: the winner (with a glow
    in the team's ESPN color), the score, the chance bar (grows in), facts,
    line / total / ESPN, our model and with the line, moneyline value, check
    first, what moves the number, who's out, best matchups, side by side.
  - Generator: a day strip (today and six more, `dayOptions`), NBA / NFL /
    Both, Most likely / Best value, Payout (2x+ to 10x+) or Legs (2 to 4).
    Both leagues load as two `game-board` calls merged (`mergeBoards`); legs
    then show their league. The most likely winner that day leads, the next
    five under it, then the top three parlays with a chance meter.
  - History: the record as big numbers, then the list.
  - Motion: rise-in with a stagger, gliding pills, drawer, growing bars, a
    slow drift on the glow, shimmer while loading; all off under
    prefers-reduced-motion.
- Server: `game_predictor.day_games(sport, day)` (NBA: that date's
  scoreboard; NFL: this week's and next week's boards, kept to that US
  date) and `board(sport, day=...)` (cached per day). api/prediction.py
  `game-board&day=YYYYMMDD` takes the US East's yesterday to a week ahead
  (the member's own today, whatever their time zone).

### Nov 6: Game Predictor — best picks and a moneyline parlay builder

- The owner: "give me the best most confident game to win and like I can do
  a pair for example if I want least 2x my money or 2 legs it'll give me the
  correct valued moneylines".
- Server: `game_predictor.board(sport)` (action=game-board): every game still
  to start (the slate's pre games, at most BOARD_GAMES 16), predicted four at a
  time (`_predict_many`, shared with `snapshot`), each kept for the record
  too, cached 5 minutes. `board_game` keeps the blend's chances, both
  moneylines, each side's value, confidence, and `held` ("No moneyline yet",
  or the first high warning) so the builder leaves it out.
- Page: "Best picks and parlays" under Predict opens a card: "Most likely to
  win" (the highest blend chance), the next four, then "Build a parlay":
  Payout (2x+, 3x+, 5x+, 10x+; 2 to 4 legs) or Legs (2, 3, 4), ordered Most
  likely (chance to hit) or Best value (a dollar's average return). One leg a
  game, either side of it; games taken as independent; top 3 shown with pays
  (x and American), chance to hit and value. Math in game-predictor-core.js
  (`decimal`, `boardLegs`, `likeliest`, `parlays`), tested.
- Honest note for the owner: the blend's chances sit close to the market's,
  so parlays usually show negative value (each leg's vig multiplies).

### Nov 5 (latest): Game Predictor v2 live — two predictions, warnings, EV, snapshots

- The owner pasted the v2 to-do list ("wire the new models in ... two
  predictions per game, our model alone and blended with the line, plus
  data-quality warnings, a confidence rating, and moneyline EV"; "build the
  NFL EPA tables daily, and save a snapshot of every game automatically").
- game_predictor.py `V2` holds the backtest's settings and weights (README in
  tools/game-predictor-backtest). NBA: `nba_context` (predictor_nba rate /
  team_states / defense_by_position, last season's v2 prior kept under
  `krazy_data:predictor:v2:nba-prior:{season}`), `nba_model_v2`,
  `nba_players_v2`. NFL: `nfl_context` from `nfl_team_epa.stored(season)` and
  last season's, `nfl_model_v2` (starters by `pick_starter`; nflverse names
  are "P.Mahomes", so injuries match on `_short_key`, first initial + last
  name; a starter out gets an impact = the margin with him minus without).
  NFL total: the line's, else 2*mu + the points ratings (the fitted total
  weights weren't kept).
- `_model` tries v2 and falls back to the v1 numbers (still in the file)
  with a warning "Using the simpler model..." and `fallback` = why
  (e.g. "no play-by-play table" before the cron's first run, or an
  exception name). The response has `model` ("v2" / "v1" / "line").
- `prediction()`: `predictions.ours` (our margin, total, score, chance with
  its own sigma: NBA staged by games played, NFL 9.56) and
  `predictions.blend` (line + V2 "ours" share: NBA 25%, NFL 10%; chance
  with the market sigma, NBA 12.5, NFL 11.03). The top-level winner /
  chance / score are the blend's. `ev.blend` / `ev.ours`: each moneyline's
  expected value a unit at that chance, `ev.best` the blend's best above 0.
  `warnings` [{level high/medium/info, text}]: early season, box scores or
  play-by-play stale, last season missing, questionable regulars (the swing
  if he sits), QB unknown / a guess / new, no line, the line and ours 7
  (NBA) / 6 (NFL) points apart (high). `confidence` High/Medium/Low from the
  blend's chance, whether ours and the line pick the same team, and the
  warnings; `confidenceWhy` says why. The old `edge` is gone.
- History: new key `krazy_data:predictor:v2:history:{sport}` (v1's kept, not
  shown). Entries add `model`, `ours` (pick), `bet` (the best +EV
  moneyline, one unit) and `confidence`; the record adds `ours` and `bets`
  (count, units, roi). `record_many` saves several in one write.
- Crons (api/v2-admin.py `predictor-cron`, vercel.json): `step=epa` 12:30
  UTC builds this season's NFL table; `step=epa-last` 12:50 builds last
  season's if not kept; `step=snapshot` 16:40 and 22:40 UTC predicts every
  game in the next 36 hours in both leagues (`snapshot`) and settles.
- Page: "Our model" and "With the line" side by side under the verdict,
  "Moneyline value" (each side: price, EV, chance, fair price, our model's
  EV), a "Check first" card for the warnings, confidence reasons under the
  tags; History adds "Our model alone" and "Value bets" (units). NFL side by
  side adds EPA a play / allowed.
- Not checked live from here: ESPN, nflverse and the stored NBA seasons
  aren't reachable from the container. The GitHub "Game predictor check"
  workflow (run by hand) now also builds the NFL tables from nflverse and
  prints v2 for this week's games. numpy comes from requirements.txt (first
  live use of it); if it ever failed, every game would say "simpler model".

### Nov 5 (later): Game Predictor v2 — backtest done, production half built

- The owner asked for a full upgrade (data checks, opponent-adjusted NBA, EPA NFL,
  two predictions, calibration, EV, auto history). Stopped at their request (usage).
  Everything measured and what is left: `tools/game-predictor-backtest/README.md`.
  New modules there are not imported by the site yet.

### Nov 5: the Game Predictor (NBA and NFL winners, scores and edges)

- The owner, with another app's "select a game, predict winner, history"
  screens: a moneyline predictor for the NBA and NFL from free sources
  (who's out, spreads, blowout chance, pace, matchups, each team's best
  player edge) that ends with a final score like "112-96". A new section,
  **Game Predictor** (tab key `predictor`, URL `/game-predictor`), behind
  its own switch in Admin's section list. It starts **off** (not in
  `tabsSeen`); admins always see it.
- Server: `game_predictor.py`, routed through `api/prediction.py`
  (`action=game-slate|game-predict|game-history&sport=nba|nfl`; the site
  is at Vercel's 12-function limit, so no new `api/*.py`). ESPN's
  scoreboard and summary give the schedule, the DraftKings line
  (spread, total, moneylines; `_price` also reads ESPN's newer
  `moneyline.home.close.odds`), ESPN's projection, both injury reports and
  each team's last five. NBA numbers come from the stored seasons
  (`league.ensure`, last season's ratings kept once under
  `krazy_data:predictor:v1:nba-prior:{season}`); NFL from nflverse
  (`finder.games_index`, `player_rows`, `league`).
- The model, backtested on real games (scripts in the session scratchpad,
  not in the repo):
  - NBA, 2025-26, 979 games with lines: ORtg / DRtg / pace this season with
    last season worth 12 games, met the usual way, + home court 1.6, a
    back-to-back 1.2, last-10 net x 0.2, and who's out (0.19 x each
    regular's Game Score over the last 20 games x how often he played in
    them, so a long absence is already in the team's numbers). Alone: 74%
    of second-half winners (line 73%), margin miss 11.3 vs the line's 11.0.
    Final = 75% line + 25% ours (did best). The site's own code replayed
    over the season: final 11.06 vs line 11.08 margin miss.
  - NFL, 2013-25, 3,562 games: points for / against with last season worth
    4 games, home 2.1, rest, starting QB out 3.2 (the team's most-attempts
    QB listed Out). The line was clearly better (66% vs 63%), so final =
    90% line + 10% ours.
  - Total: the line's (ours was no closer), else ours. Win chance: normal,
    NBA sigma 12.5, NFL 12; blowout (NBA 15+, NFL 14+) with 15 / 13.5,
    calibrated on the same games.
  - **Edge** = only our own disagreement: how far our part moves the
    line's chance, laid on the moneyline's no-vig chance; 2% or more shows
    "Moneyline edge" with the price and our fair price. (Comparing our
    spread-based chance straight to the moneyline invented edges from the
    spread/price gap.)
- Best matchup on each team: NBA, rotation players (22+ min, playing
  lately, not out) — pts / reb / ast x what the defense allows his G / F /
  C per 36 (shrunk on few games) x the game's pace vs his team's, plus half
  of the out teammates' points by scoring share; NFL, the QB, top 2 backs
  by carries, top 3 targets — fantasy and main yards x the defense's
  allowed to the position.
- History: every prediction made before tip-off is kept (latest one per
  game, `krazy_data:predictor:v1:history:{sport}`, 400 max) and settled
  when the history is read, a game's ESPN summary each (16 a read), with
  picks right, how often the market's favorite won (to compare), and how
  far off the score was.
- ESPN's NFL scoreboard answers a date range (`dates=A-B`) with 400: the
  NFL slate is its plain scoreboard (the current week), plus `week=N+1`
  once this week is all played. The NBA's is today's and tomorrow's dates.
- Page: `src/GamePredictor.jsx`, `src/game-predictor-core.js` (words and
  numbers, tested), `src/game-predictor.css`. Wired like My Bets:
  `site_controls.TABS`, `site-access.js` names + slug, `site-access-core`,
  `navTabs` (Crosshair), sidebar Discover group, dock item + icon,
  `app.js` titles / slugs / panel, `index.html` panel, `main.jsx` mount,
  `site-access.css` hidden rule.
- `.github/workflows/game-predictor-check.yml` (run by hand) prints ESPN's
  slates and one summary per league, since the container can't reach ESPN.
- Same day, the owner's phone: the title sat under the clock ("Not mobile
  friendly it's bugged"). The panel now pads its top by
  `--site-status-inset` on phones, as My Bets does (Playwright doesn't
  emulate the inset: set `--site-status-inset` to ~94px in the preview to
  check a page).
- Checked live (the GitHub check, Nov 5): 11 NBA and 15 NFL games with
  DraftKings lines, ESPN projections and injury reports; NBA finals settle.
  Known limit: the NFL's "main QB" is this season's most attempts, so a
  backup who has been starting (BAL's Huntley while Jackson was hurt)
  counts as the starter; at a tenth of the final number it moves it about
  0.3 points.
- Next ideas: an automatic daily snapshot so the history covers every game
  (now only games someone predicted), questionable players at part weight,
  NFL injuries beyond the QB, and checking the record after a few weeks.

### Nov 1: a News card on the Finder player page (ESPN news, Groq notes)

- The owner, with LineCrush's "Vibes" cards (a player saying he's trying to
  take more shots, teammates out, minutes cut in a blowout, each tagged up
  or down with its source and age): "We need information like this this is
  super important." LineCrush reads tweets, podcasts and press
  conferences; free here means ESPN's player news.
- player_news.py: ESPN's fantasy player news
  (site.api.espn.com/apis/fantasy/v2/games/{fba|wfba|ffl|fhl|flb}/news/players
  ?playerId=, `feed`), the last NEWS_DAYS (21) days, MAX_ITEMS (12);
  Groq's free text models (slip_reader._ask, TEXT_MODELS) read them for the
  line into {read, notes: [{text, tone up/down/flat}]}. clean_notes keeps a
  note only when it names a real item, whose date, source and link it
  takes (never the model's). Without Groq, the headlines. NFL ids
  (00-...) go through finder.espn_ids. Kept 45 min per player and line in
  the store (krazy_data:news:v1:...).
- api/prediction.py GET action=player-news (sport, playerId, player, team,
  market, line, when). src/PlayerNews.jsx: the card (read, then one row a
  note with a thumbs up / down / dash, age, source, link), a "News" tab
  last in the NBA / WNBA and NFL player pages' research tabs.
- Switch: site_controls RESEARCH_SECTIONS ('news'), `disabledResearch`,
  `researchSeen`; starts OFF (owner's rule); admins see it; the admin
  screen's new "Research" fieldset turns it on.
- .github/workflows/espn-news-check.yml (run by hand) prints what ESPN
  answers for a few players: the container can't reach ESPN, so the feed's
  shape is confirmed there, not here. Run Nov 1: `feed` with headline,
  story, published, type, links.web.href, as read; RotoWire player updates
  ("Curry (rest) won't play Sunday...") mixed with general ESPN articles
  that only mention the player (rankings, highlight clips). The prompt
  marks each item's source and says to skip those; without Groq the
  headlines are RotoWire's updates first. Not yet seen: Groq's answer on
  the live site (GROQ_API_KEY is in Vercel only) -- an admin's News tab is
  the check: notes with thumbs up / down = Groq; dashes only = headlines.

### Nov 1: the parlay builder said "No games" for sports still loading

- "Why does the generator show no games for nfl nhl and others": the
  builder (SmartSlip.jsx, /builder) loads each sport's board on its own,
  but its "…" only showed while no board at all was in; the first one (the
  NBA's, the quickest) turned every sport still loading to "No games", and
  a board that failed (the NHL turns requests away for a minute when asked
  too often) stayed "No games" with no second try.
- Now `slate.pending` / `slate.failed` per sport: a chip reads "…" until
  its own board is in; the Games and Players steps wait while a chosen
  sport is pending; a failed board is asked again up to BOARD_TRIES (3),
  after the server's retryAfter or BOARD_RETRY_SECONDS (5, 20). A board
  that never comes back reads "No games" / "Off today" for members (an
  off-season league can answer with an error) and "Didn't load" for admins.
  Checked in the browser with an NFL board 4 s slow, an NHL board refused
  once, and CFB down.
- (Stopping `vite preview` with `pkill -f "vite preview"` kills the shell
  running that command too -- its command line matches. Stop it on its own.)

### Nov 1: the slip's "teammate is out" lines, long-term and backups left off

- The owner, on a graded Mahomes pick ("Smith (RB) is out: Mahomes averages
  224.8 Pass+Rush Yds without Smith (4 games) ... 290.9 with Smith"), with
  the Chiefs' depth chart showing nobody out: "its not correct look no
  body is out". The back is off the depth chart (a long-term absence) and
  barely played; his split mostly compared last season to this one.
- slip-games.js newsFacts: a teammate on a long-term list (injured
  reserve, PUP, suspension, N-day IL) or not due back for LONG_TERM_DAYS
  (14) or more by ESPN's return date never makes a line, split or not (it
  used to be left off only without a split). A football teammate needs
  ROLE_TOUCHES (5) targets, carries, passes or tackles a game when he
  played (the split's `usage` over its `with.games`; loadTeammates now
  keeps `usage`). slip_games.py _entry keeps ESPN's details.returnDate as
  `returns`.

### Oct 30: Defense vs position is G / F / C again (the owner's call)

- "Let's just go back to the G F AND C I think it's better than just
  guessing." The card's positions are ALL, G, F and C, as ESPN's box scores
  list players; the views (Total / Per player / Per 36), the four windows,
  the game list, the "L10 (5)" labels and the box-score check all stay.
- Removed with it: context.split_positions / inches / PG_ASSISTS /
  PF_INSIDE / WING_INCHES / SPECIFIC, season_dvp's specific / split /
  heights / place_from / sources (season_dvp(payload) now), api's ESPN
  fantasy-list reader (_espn_positions, _fantasy_positions), the roster
  height in _team_rosters, the admin "positions" line, and the
  espn-positions-check workflow. The sections below about the PG / SG /
  SF / PF / C split and ESPN's fantasy list are history; if the owner asks
  for specific positions again, ESPN's fantasy list (lm-api-reads.fantasy.
  espn.com .../fba/seasons/{year}/players, view players_wl,
  x-fantasy-filter filterActive; defaultPositionId 1-5 = PG..C) answered
  from GitHub's machines with 1,099 players, but was never confirmed from
  Vercel.

### Oct 30: ESPN's own positions for Defense vs position

- The owner compared Miami vs SGs (ours 11.0 rebounds, 29th; PropsEdge 7.8,
  22nd), asked for an audit (every player, ESPN position, rebounds, date;
  PGs or SFs counted as SGs; double counting; total or per player), then:
  "it's just not accurate". The audit: no double counting; the rank is the
  total a game (all SGs added up); every player counted was ESPN "G", and
  our SG label was a guess (Kyrie Irving at 5.0 assists a 36 read as SG;
  6'5" wings Javonte Green, Sion James, Dort, Wiggins too).
- api/wnba.py _espn_positions(season): ESPN's fantasy player list
  (lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/{season}/players,
  view players_wl, x-fantasy-filter filterActive), defaultPositionId 1-5 =
  PG SG SF PF C, same ids as the box scores. Kept a day in the store
  (krazy_data:nba:espn_positions:{season}); a failure retries after 30 min
  and the card falls back to split_positions (the estimate). It is passed
  as `specific`, so it wins over the estimate; season_dvp's `sources` says
  the share of minutes ESPN placed vs estimated, and admins see it on the
  card's check line (amber under 80% ESPN).
- .github/workflows/espn-positions-check.yml (run by hand) prints the list
  from GitHub's machines (`POS,<season>,<id>,<position>,<name>`) -- the
  container can't reach ESPN. Not yet confirmed that Vercel reaches the
  fantasy host: the admin line shows it (0% ESPN = not reached).

### Oct 30: Defense vs position rebuilt (views, L15, game list, box-score check)

- The owner pasted a ChatGPT spec (total / per-player / per-36 views,
  Season/L15/L10/L5, sample labels, game-by-game audit, dedup, freshness,
  reconciliation against ESPN, keep the frontend). Audit first:
  - Already right: ESPN box scores, every player with minutes (bench too),
    each stat and window ranked on its own, rank 1 = allows the least.
  - Fixed earlier today: games with nobody at the position counted as 0.
  - Was missing: L15; any way to see the games behind a number (Miami 30th
    vs SGs = Anthony Edwards' 10 rebounds on Oct 21); a window shorter than
    its name (L10 on 5 games) looked like a real L10; no "through" date;
    no check that the stored box scores add up; positions read off five
    games early in a season (Schroder as an SG).
  - The prop analysis already has the spec's inputs (nba-matchup-score.js:
    minutes, recent form, pace, rebound/assist chances, who's out or back),
    so nothing was rebuilt there.
- context.py: spot_games (one pass: each team-game as what the position
  put up, None when nobody played) feeds position_table(view, windows).
  defense_vs_position (league-context, the board's Defense column) is the
  same numbers as before plus `g` (games counted). season_dvp builds VIEWS
  total / player / per36 over DVP_WINDOWS szn / l15 / l10 / l5, `through`,
  and `place_from` (a young NBA season places players on last season's
  games too, opportunity.blend, under BLEND_GAMES a team).
  position_log(table, team, position): the games newest first, each
  counted player's line (LOG_KEYS = STAT_KEYS), [] when nobody played.
  reconcile(payload): each player's points vs his shots, each team's
  players' points vs the final score, the same game stored twice, a player
  twice in a box, finished games not stored.
- league.py: the schedule listing keeps each finished game's `score`
  (_score reads the scoreboard's "112" and a team schedule's {value}), so
  the check runs from the next build on; stored games get it then too.
- api/wnba.py _dvp(league, season, position, playerId, view, team): adds
  view / views / windows / played (finished games per team, from the
  schedule) / through / log (the asked team's) / audit.
- The card: a View menu (Total, Per player, Per 36 min), SZN L15 L10 L5,
  a window the team hasn't filled reads "L10 (5)" and is dimmed, a stat
  opens its games, the note says "5 games" or "5 of 6 games" and "thru
  Oct 29"; the Matchup pill hides on phones so four windows fit (the ranks'
  colors carry it). Admins see "Box scores: N of M games match ESPN's final
  scores" (amber with anything off, doubled or not stored).
- Checked on real ESPN data (sportsdataverse player_box / team_box): 2025-26
  1,224 of 1,231 games match; the 7 are Bulls games where ESPN's box has a
  blank player row (82 of 91 points, Feb 1), a real ESPN gap the check now
  shows. 2026-27 so far: 71 of 71. Building a full season's tables takes
  about 2 s, once per build (memoized on builtAt).

### Oct 30: Defense vs position, checked on real games and corrected

- The owner asked whether the ranks are right for each stat. Run on the
  2025-26 regular season's ESPN box scores (hoopR's player_box files): every
  team's ALL points allowed matched the real scoreboard (biggest gap 0.14),
  and every stat ranks on its own. Two fixes, both in context.py:
- defense_vs_position leaves out a game where the opponent played nobody at
  the position. It counted as 0 allowed: about 1 game in 10 at PG, SF and C,
  moving teams 1-4 places on average and up to 16. A team that never faced
  the position has no number and no rank. This is also the G / F / C table
  in league-context (the Finder board's Defense column, slip-matchup).
- split_positions reads height too: a guard under 5.5 assists a 36 who
  stands 6'6" or more is an SF (Mikal Bridges). `inches()` reads "6'5" and
  ESPN's 6' 5"; heights come from the roster directory (_team_rosters now
  carries `height`). Guards placed as known 67% -> 74%; forwards unchanged
  (height doesn't split SF from PF). Minutes by position last season now
  PG 18%, SG 21%, SF 28%, PF 18%, C 14% (SG was 32%, SF 17%).
- The heights for checking came from sportsdataverse-data's release
  `espn_nba_rosters/rosters_{year}.csv` (ESPN itself is blocked here).

### Oct 30: the player page's back arrow was under the phone's clock

- "I can't get out the prop page the back arrow and the header are all the
  way at the top and I can't scroll to click" (iPhone home-screen app).
  finder-player-v2.css's phone rule gave `.finder-trend-view.fp2` a 0 top
  padding (and 24px at the foot), beating unified-finder.css's detail
  padding, so the top bar sat under the status bar and iOS's blur band,
  where taps don't reach the page. It now starts below
  `--site-status-inset` (+10px) and ends clear of the dock
  (`--app-bottom` + 18px), like the site's other phone pages. Checked with
  Chromium's safe-area override (59px top): the arrow sits at 107px, below
  the 95px band, and goes back.

### Oct 30: hit-rate tiles, small menus, PG / SG / SF / PF / C defense

- The owner, from a phone: the L20 tile's "Game history" card "takes the
  whole screen"; tiles "L5-20 then h2H then the 2027"; logos on the Team
  menu; the alt-lines menu without "1 BOOK" or the Goblin / Demon words,
  icons kept, smaller; the Defense vs position menu "specific instead of
  just G C F".
- app.js renderGameLogTabs: L5, L10, L20 (its menu), H2H, this season. The
  menu (#gamelog-window-menu) is a small dropdown now, one short row a
  window, placed under its tile by placeGameLogWindowMenu (measured from
  where it lands at 0,0, so whatever box holds it); a tap elsewhere or a
  resize closes it. Its old card styles in trend-edge.css are gone, and
  finder-player-v2.css no longer gives it the tiles' grid area.
- main.jsx: an option can carry `logo` (OptionWithLogo); app.js sends team
  logos for the Team and Opponent filters (a game's own logo first, then
  trendTeamLogo). AltLinesSelectHost rows are the line and LinePrimaryMark
  only (book logo, or PrizePicks + Goblin / Demon); the tier is in the
  row's aria-label. `.pp-select-line-tier` styles removed.
- Defense vs position: ESPN gives G, F or C for 99.6% of last season's
  minutes (box scores; its rosters read the same), so the PG / SG / SF / PF
  split never had enough to go on and fell back to G / F / C.
  context.split_positions places each NBA G / F by how he plays, a 36
  minutes: 5.5+ assists PG else SG; 7.5+ rebounds and blocks PF else SF
  (checked on the 2025-26 box scores, about 4 in 5 known players placed as
  known; Brunson, Luka PG, Edwards SG, LeBron SF, Giannis, Tatum PF). A
  roster's own PG / SG... still wins. season_dvp(split=True) for the NBA
  only; the WNBA stays G / F / C. `placed` gives the player's own spot.
  SG runs large (a third of the minutes): ESPN files wings like Bridges and
  Nesmith as G.

### Oct 30: the site froze coming back to its tab; depth charts cut players

- "EVERYTIME i switch tabs ... and come back its just frozen and refreshing
  wont help". Cause (Finder, a player page open): coming back reloads every
  league's board (UnifiedFinder's refresh on visibilitychange,
  `load(key,true)`), and a refreshed board renders as a transition. While
  it waited, the soccer-only effect on `allRows` still called `setSelected`
  for every sport; React then replayed the waiting `setBoards` updaters,
  each replay built new board objects, `allRows` changed, the player page's
  trend-panel config changed, app.js's panel set state again, the effect
  fired again: an endless render loop, so the tab locked up (and Chrome
  kept the hung renderer for a reload). Fixed twice over: the board
  updaters go through `once()` (same boards in, same boards out), and the
  effect returns early unless a soccer page is open. Checked with headless
  hide/show, Chrome's freeze and both, three rounds each, on the player
  page, the list and home: answers and taps every time. Found with an
  unminified build (`vite build --minify false`) and a counter in React's
  `dispatchSetState`, which named the looping setState by call site.
- Coming back when a new release is out reloads the site (app-update.js);
  that used to drop you on the list. The reload now fires
  `vortex:update-reload` first, the Finder saves the open player for the
  tab (sessionStorage `finder:reopen`, a minute), and the reload opens it
  again through the link path (`keepOpenPlayer` / `takeOpenPlayer` in
  unified-finder-data.js).
- "also missing players on the depth chart" (Deandre Ayton missing from the
  Wizards' chart on his own page): `rotation()` cut every team to 13 and an
  NBA roster runs to 18. It now lists everyone (the other readers of
  `rotation.players` filter on minutes, so a deep bench changes nothing
  there). The Finder's depth card also adds the page's own player to his
  team's chart when the rosters haven't caught up with a trade yet.

### Oct 30: defense rankings by season and position; older H2H games

- The owner compared PropsEdge (Nesmith vs MIA H2H 6 games, ours 2; their
  Defensive Rankings with Season / position / team menus) and said "ours is
  wrong". Ours wasn't miscounted: the Finder's Defense vs position card read
  the league numbers that blend last season in while a team has played under
  15 games (opportunity.blend), under this season's name ("2027"), and split
  G / F / C only. The Props matchup page's card counts this season alone, so
  the two disagreed (DET vs forwards 3rd fewest blended, 2nd most in 5 games).
  ESPN's NBA box scores label almost everyone G / F / C (2025-26: 26.5k rows,
  ~100 PG/SG/SF/PF), so the first-letter rule (`primary_position`) is fine.
- Now `resource=dvp` (api/wnba.py `_dvp`, context.py `season_dvp`): one
  stored season alone, one position, every team; seasons offered back to
  DVP_SEASONS (4) where stored (2027 and 2026 today: older NBA seasons were
  never stored). The NBA splits ALL / PG / SG / SF / PF / C, the positions
  from ESPN's team rosters (`_team_rosters`, current rosters: a player no
  longer on one counts only in ALL, a box-score C still in C); if the rosters
  place under 60% of the minutes, ALL / G / F / C. `defense_vs_position` takes
  `positions` and `bucket`. The card (WNBAFinderContext DefenseVsPosition):
  three small menus (Season "26/27 Season", Position, vs team with logos),
  the player's own position first, the note "26/27 · 5 games" for the picked
  defense; the last table stays up while another loads.
- H2H: the Finder's NBA player page asks `resource=gamelog&deep=1`, two
  seasons before the usual two (OLDER_SEASONS; full-game lines only, no
  quarters / dunks / game cards there; cached a week). The board's batches
  and the Props matchup page (its meetings read was backtested on two
  seasons) stay at two.
- Dates: the chart's bar labels read UTC (app.js `trendDateParts`), so an
  NBA game at 7:30 pm Eastern showed the next day (Dec 28 for Dec 27) and the
  next game Oct 31 for Fri Oct 30. A timestamp now reads in the viewer's time
  zone, like the game card; a bare date stays as written.

### Oct 30: every sport's Finder player page on the NBA page's layout

- The owner, with screenshots of the rebuilt NBA page: "grab the same exact
  code layout ... and apply it for all the sports". `src/FinderPlayerLayout.jsx`
  is that layout, lifted out of WNBAPlayerPage: the v2 top bar, the chart with
  his own sections under it on tabs, the sport's research panel on the right
  with one tab row (one row of every tab on a phone). Every page uses it:
  NBA / WNBA, MLB and tennis (FinderTrendView.jsx), NFL, CFB, NHL, soccer,
  CS2. His sections: Game log / Stats (all), Depth (NBA, NHL, NFL, CFB), Usage
  (NFL, CFB). Each research panel (MLB/NFL/CFB/NHL/Soccer/Tennis
  FinderContext) takes `tab` from the page and exports its tab list
  (`MLB_TABS`...); without `tab` it keeps its own row. The sport classes stay
  on the page (`nfl-player-page`...) for their cards' styles. CS2's "recorded
  results" note is a plain line under the chart now. Checked in the browser
  with made-up data for every sport, phone and computer.
- NBA Defense tab: Defense vs position first, Who guards him under it (the
  owner: "put it under the defense vs position ... flipped").
- With / without (the owner: "make sure when i use a filter with/out player
  it gives the actual games"): the NBA filter itself was right (Gordon's
  "W/O Braun" games line up with Braun's ankle and Gordon's own hamstring
  absences), but the game card's "Sat out" only named players ESPN listed as
  DNP; an injured player left off the box score never showed, so the card
  looked like it contradicted the filter. `context.game_notes` now counts a
  teammate absent from a game during his time with the team (first to last
  game listed there, open-ended while the directory still has him there),
  the way the splits do. The NBA splits now always read last season too
  (`player_context(history=...)`, the two seasons the chart shows; before,
  past a team's 15th game they dropped last season). NHL, CFB, soccer
  (client) and NFL (server) no longer count games from before a teammate
  joined as "without" him; soccer's unused subs aren't "with".

### Oct 30: the NBA / WNBA Finder player page, rebuilt

- The owner: "new buttons new everything ... new placements ... nice and
  mobile friendly and user friendly easy to navigate and see data nothing
  complex". All the data stays; only this page (`.fp2`, WNBAPlayerPage.jsx
  + `src/finder-player-v2.css`); every other sport took this layout the
  same day (see above).
- Top bar (FinderPlayerBanner `layout="v2"`): back, photo, name, position,
  team logo, game and time; account button on a phone. No brand logo, no
  team watermark, no Trends / Matchup / Depth switch.
- Then the owner: "hate how the buttons are so close to the line buttons
  are also ugly and i hate how to bottom is just empty", and with a
  PickFinder trends screenshot: "see how they make their trends all clean
  nice buttons and layout perfectly placed we need it like this". Only its
  layout idea was used (no branding, no wording).
- The chart column now, top to bottom: the odds as soft chips (the panel's
  "Odds" label hidden); stat tabs (words with their lines, underlined when
  picked); a title, "Points" with "More 21.5" in green (red for Less), tier
  icon and price; one row of small even buttons (36px, 9px corners, soft
  fill): the panel's own line - / + (unhidden; it drives the title through
  `vortex:trend-odds`), PrizePicks lines, save star, Analyze (portaled into
  `.gamelog-toolbar-head`); the filters as soft chips under them. On a
  computer the hit-rate windows sit as one compact block to the right of
  those rows (label, % in its color, record; the picked one lit). Then the
  chart, Average and Median, then Game log / Stats / Depth tabs under the
  chart (`.fp2-his`, so the bottom isn't empty).
- Phone: one column in the same order, the buttons on one line (the lines
  select takes what's left), the filters sharing their lines evenly, the
  windows an even row over the chart.
- Then: the hit-rate block "thin like" the phone's (a wide, flat strip:
  the windows evenly spread, 42% of the chart column, centred beside the
  title, buttons and filters). And a Team filter: "when someone wants to
  see H2H stats we want to see stats from the current team not from 2
  years ago when they were on another team ... the dropdown should only
  show the teams he was in". Each ESPN game-log row now carries `team`
  (api/wnba.py `_game_logs`, ESPN's event `team.abbreviation`, else his
  side by homeTeamId / awayTeamId and an id seen as an opponent; cache key
  v7), the chart's games keep it (trend-data.js), and the page turns on
  the panel's existing Team filter (`filters: ['seasonKind','team']`). In
  app.js the Team menu lists his teams latest first and shows even with
  one team. It narrows the chart and every window, H2H included (not the
  Game log table). ESPN couldn't be reached from the container, so the
  `team` field was checked only against the test; if the menu doesn't
  show on the live site, ESPN's events lack `team` and the fallback
  missed (his current team is never an opponent).
- Phone filters: two even rows (Season and Year, Location and Team).
- The research column (computer): Matchup, Defense, Shooting, Similar,
  Injuries, Rankings (WNBAFinderContext takes `tab` from the page and
  hides its own tab row). Under 1051px it's one tab row with all nine
  (`.fp2-tabs-all`, Game log / Stats / Depth included). Every section stays
  mounted and is hidden when not picked (instant, keeps its state).
- Win predictor is now two teams with their chances and one split bar
  (`wp-*`), not a ring. Cards are soft panels without outlines.
- How: the chart is app.js's shared trend panel (#gamelog-overlay) moved
  into the page; v2 places its parts with grid areas on `.gamelog-modal`
  (`.gamelog-workbench` is `display: contents`, `.gamelog-toolbar` forced
  back to block: a phone rule had made it `contents`, which spilled the
  line controls over the bet). Its rules carry
  `#gamelog-overlay#gamelog-overlay.trend-edge` to outrank the panel's own
  last layer (gamelog-premium / trend-edge rules), with !important where
  those use it; grid-area and grid-template need !important too.

### Oct 30: the colors are the site's own colors now, not a tint

- The owner, on a green pick: "this all just looks like a tint tho its not
  even the actual website color?" The first build laid a see-through
  layer (screen blend) over everything: photos, numbers and all got
  washed, and a bright color flattened every panel into one. Replaced:
- `build/look-surfaces.mjs` (a PostCSS plugin in vite.config.js) rewrites
  every grey in every stylesheet (~3,980) into
  `color-mix(in srgb,var(--ls) keep%,#lifted)`, worked out so that on the
  site's own #0A0A0A it is exactly the grey it was (checked: Black
  screenshots match the old build pixel for pixel, apart from clock
  times). Grey text (color/fill/stroke, or custom properties named like
  text: muted, faint, dim, label...) follows `--lst` instead. A grey is
  channels within 14 (or a fifth of the brightest, for #626A74-like
  blue-greys), #040404-#E6E6E6. Only 7 colors are set from JS.
- Dark colors: `--ls` = the page color; `--lst` = the page color lightened
  just enough that the dimmest text (#606060) keeps its contrast on black
  (`textOn`). White text, colored numbers, photos stay put.
- Light colors: the site still flips (invert + hue-rotate + brightness on
  `html`), but `--ls` is set BEFORE the flip (`beforeFlip`) so the flipped
  greys land on the color; no layer, so photos aren't tinted. Light pages
  stay at relative luminance >= 0.5 (green/red numbers stay readable);
  dark pages <= 0.1.
- Gradients: `.look-grad-layer` (index.html, fixed, z-index -1, twice the
  screen, swaying transform) is the page behind everything for light and
  dark (pre-flip colors on light); page-wide backgrounds are cleared
  (body, #app-shell, .hero, .tab-panel, .unified-finder, and the Props
  tab's own #app-shell rule outranked); cards sit in the two colors'
  middle (`--ls`). The `html::after` layer and `data-look-lift` are gone.
- The look saved for the head script is now {mode, page, surface, text,
  grad, layer, page2, still}.

### Oct 30: account-sheet colors tint the site; swaying gradients

- The owner: "make it so those colors on the account setting can also
  change the website colors and add like a gradient color option ...
  like that discord gradient look where the color like sways".
- Account sheet (AccountSheet.jsx): a Color dot is the accent AND a tint
  of the whole site (`tintOf`: 16% of the color on the dark page, or on
  white when the site is light; White is the plain page). A new Gradient
  row (site-look.js `GRADIENTS`: Aurora, Candy, Sunset, Ocean, Grape,
  Mint, Lime, Ember; + opens Settings). The sheet talks to app.js through
  `window.propscoutColors` (`current`, `pickColor`, `pickGradient`) and
  listens for `propscout:colors`, so it saves and syncs like Settings.
- Settings: Gradient chips (Off first), From / To pickers, a Sway switch.
  The accent object carries `grad: [from, to] | null` and `sway`; a
  Background swatch turns the gradient off; the gradient follows the
  background's dark or light (30% of each color on the page).
- (Replaced, see the section above.) How it was: `data-look-grad` made the `html::after` layer twice the screen's
  size with a 115deg band of the two colors' layers, swaying on a 16s
  transform (no repaint); the name (`.vortex-sidebar-me-text > b`,
  `.as-name`) gets the raw colors as moving gradient text. Still with
  Sway off (`data-look-still`) or reduced motion. The head script applies
  gradients before the first paint too.
- A strong color on a light site can't always be drawn exactly (the flip
  clips it): `lookOf` then reports the nearest color it draws. Very
  bright yellows look duller in the light-mode color pickers (flipped
  twice).

### Oct 30: a Background color for the whole site (Settings)

- The owner: "a new color setting that changes EVERYTHING ... incase i
  dont want to use black i can use white grey pink different brightness
  etc i want cool customizations". Settings, Accent studio: Background
  (10 swatches: Black, Graphite, Navy, Forest, Plum, Pink, White, Light
  grey, Blush, Sky, plus Custom, a color picker) and Brightness (-30 to
  +30) replace the old Background tint slider. Per device, saved in the
  accent object (`vortex_custom_accents`: `base`, `bright` and the
  worked-out `look`), so it syncs with the account and goes in presets.
- (Replaced by the build-time greys, see above.) How it was (most pages paint their own dark colors, so theme variables can't
  reach them): `src/site-look.js` + `src/site-look.css`. A dark color is
  a full-screen `html::after` layer in screen blend (`data-look-lift`,
  `--look-lift`); a light color flips the site (`data-look="light"`:
  invert + hue-rotate(180deg) + brightness(1.0408) on `html`), with
  photos, logos, video and canvas flipped back and PropScout's white logo
  and mark left to flip to black. The layer's color is solved so the page
  lands on the picked color: checked in Chromium, every swatch within 1
  shade (tests/site-look.test.mjs does the math). Readability limits: a
  dark page never lighter than ~#4C4C4C, a light one never darker than
  ~#C6C6C6. Black can't go darker than the site's own #0A0A0A.
- Gotchas: modal dialogs are drawn in the top layer, outside `html`'s
  filter, so `dialog:modal` takes its own copy in light mode (and gets no
  tint layer). In light mode the color pickers, preset previews and the
  account sheet's color dots flip back so they show the real color. The
  `:where()` on the image rule matters: an ID inside `:is()` outranked the
  logo exception. `index.html`'s head has an inline script that applies
  the saved look before the first paint (no black flash on a light site).
- An old Background tint is turned into the background it made
  (`withBackground` in app.js), so nobody's colors jump. The admin's
  "everyone sees this" theme still sends only the accents and tint
  (`site_controls.py` checks those fields); its tint now shows as a
  background the same way. A site-wide background for everyone would
  need `site_controls.py` to accept `base` / `bright`: a next step if the
  owner asks.
- Also fixed: Settings showed an empty notice bar under "Make it yours."
  (`.site-appearance-notice` had display:flex over `hidden`).
- Light mode limits: emoji in text flip too (darker); an element's own
  CSS filter on an image gives way to the flip-back.

### Oct 30: the computer Finder board, open and fuller

- The owner, on a 2560-wide screen: "make it more fuller clean and higher
  quality it looks so low quality right now and isnt pleasing to research
  with". Computer only (min-width 761px); the phone cards are unchanged
  apart from the sort chips' new words.
- No frame: the bar, controls and board sit on the page (`--fb-page` =
  `--theme-bg`, which the sticky column titles use so they don't show as
  a strip). The page cap is 1880px (was 1700, `unified-finder.css` top).
- `finder-desk.css` (bar and controls, rewritten): sports as words with
  logos, the picked one on a soft fill; search and Apps as soft 44px
  fields; the filters as soft chips as wide as their words, Saved and
  reset at the row's end. No outlines anywhere.
- `finder-board.css` computer block (rewritten): rows 66px on faint rules,
  hover shade, rows ease in (`--i` from Row's index); 44px photos; the
  line 18px with More green / Less red; Defense, L10 avg and Streak
  numbers colored for the pick (Row's `defTone` / `avgTone`: a defense
  in the most-allowed third is good for a More, the fewest-allowed third
  for a Less); each hit rate is its % in its color, the record beside it
  and a 4px bar filled to the rate (fills in on show) instead of the
  gradient boxes. Titles in words: Defense, L10 avg, Streak, Season (the
  phone cards still say SZN). Pagination soft, the rows-per-page select
  no longer has a box inside a box (its trigger has min-w 160px from the
  shared Select: override it).
- The player trends page opened from the board is unchanged (it still
  has its older boxed tiles); offer it as a next step if the owner wants
  it to match.

### Oct 28: are our New Orleans vs centers ranks right? (yes)

- The owner showed Jokić PR vs NO: ours "each center 11.8 points (1st
  most)" and a 96, another app "22.7, 7th most", and ChatGPT calling our
  "22.7 · #1 / 4.0 · #1" unverified (getBettor 22.7 #25, NBA House 32.3 #1).
  Recounted from sportsdataverse's box scores (same files as the Kings
  check below; drop the WORLD / STARS / STRIPES All-Star teams):
  - Both seasons, 85 games (what the score reads): each center 11.9 pts
    1st most, 7.7 reb 1st; all centers together 18.4 3rd, 11.9 2nd.
  - This season, 3 games (Zubac 16/15/0, Hayes 17/5/2, Jokić himself
    35/15/10 on Oct 24): each center 22.7 / 11.7 / 4.0, 1st most in all
    three; together the same numbers but 3rd / 10th / 6th, because NO's
    opponents played one center a game while other teams faced two or
    three. The other apps add all centers together (their own position
    lists), so 22.7 lands 6th-7th there.
  No bug: each source counts differently. Nothing changed on the site.

### Oct 28: Props tab, matchup page and Pick Builder redesigned; save to slip

- The owner (screenshots of the list, the matchup page and the Pick
  Builder): "redesign this whole thing make it look nicer and easier to
  research DONT REMOVE DATA ... ONLY DO A VISUAL REDESIGN AND NOTHING
  SHOULD LOOK ALIKE ... also add a button to save a prop to our bet slip
  and redesign the Pick Builder and make it easier to navigate it".
- The look (all three), after two misses the same day: a first stat-sheet
  take (Barlow Condensed capitals, neon solid score blocks, white pill
  switches) got "straight AI slop ... not professional or polished at
  all", and a calmer boxed one got "the thing i dont like is how boxy
  things are ... it all looks like low quality components". What's live
  is open: no outlines anywhere. The site's Inter in sentence case,
  numbers tabular; tabs are words with an underline (the Props tab's
  glides, `use-ink.js`); switches, filters and chips are words whose picked
  one sits on a soft pill; the list's rows lie on the page between faint
  rules; scores are colored numbers (75+ green, 60-74 soft green, 40-59
  grey, under 40 coral), no badge; the only containers are soft fills with
  no border (the preview, the matchup page's sections, the opened soft
  spots / track record, the Pick Builder); nothing boxed inside them
  (number tiles are just label + number). The list page is capped at
  1480px and centered (`#props-league-root:not([data-page=player])`, the
  player page's CSS lifts the cap for itself, 1560px). Don't bring back
  borders, condensed capitals or solid neon blocks.
- Props list (`src/MatchupList.jsx`, `src/nba-matchups.css` rewritten):
  title, search, a Slip button with the count (opens the Pick Builder) and
  refresh across the top; the games as stubs (a strip, sideways on a
  phone, wrapping on a computer; the old game dropdown and sidebar list
  are gone); the stat tabs show how many props each has; on a computer Sort /
  Lines / Players and Soft spots / Track record sit in the open on one row
  (a phone keeps the Filters button). Rows: the Last 10 bars now go up or
  down from his line by how far over or under he went; L5 / L20 / season
  join Last 10 when the list is 920px+ wide (container queries on
  `.nm-table`); the rank sits on the photo on a phone. The preview beside
  the list (1500px+) has Save to slip and Open his matchup page right
  under the line and score, and a + on each of his other lines.
- Save to slip (`src/SlipToggle.jsx`, `slip-toggle.css`): a + on every row,
  in the preview, on the matchup page's lines and in its pinned bar. It
  puts the line on the one slip as More (`finderSlipProp`, the same ids as
  the Finder's stars, so a line saved in both places is one pick) and
  takes it off again; app.js shows its usual toast. One `useSlipIds` per
  page, handed down.
- Matchup page (`src/MatchupPageShell.jsx` Hero, Oct 28 block at the end of
  `src/sports/wnba/nba-scout.css`; the old banner rules are deleted): the
  banner is a player card (photo on a tile of his team's color, name,
  facts, next game) with "His lines tonight" (one per stat, of this line's
  kind, each with its +). NBA and NFL pass `lines` and their stat names to
  the shell. Every section is its own panel on a 12px grid (10px on a
  phone); the stat tiles are cells split by hairlines; the grade's score
  is a solid badge (`data-tone` on `.ng-score`, NbaScout and the NFL page)
  over a ticked tough-to-soft scale.
- Pick Builder (`src/PickBuilder.jsx`, the panel half of
  `src/pick-builder.css`; the Finder star menu above it is untouched), then
  "I want a nicer builder like high quality looking": a slip with no
  outlines. A ticket mark and the title over "3 of 6 picks" and six slots;
  each pick a row (photo with his team's logo, name and game, the x), its
  line large with an Over / Under switch beside it (Over first, green with
  an up arrow; Under red with a down arrow), the books' prices as a quiet
  line under it ("Standard" / the tier / the price); Export full width (a
  dim surface until it can export), Copy link and Clear as quiet buttons,
  all held at the bottom while the list scrolls. In the desktop rail the
  links step aside while it's open; its "Menu" button closes it.
- Checked with fixture data at 1600, 1280 and 390 wide.


- The owner: "i hate this desktop layout design its like low down ... i
  want a normal page thats higher up". From 761px the Props tab drops the
  site banner (`.hero`, 133px) and its page padding goes 56px -> 14px, as
  the Finder, Cheat Sheets, Line Moves and the rest already do
  (`src/nba-matchups.css`, top). The league tabs now sit at 14px and the
  list frame at 67px (was 242px). Phones unchanged.

### Oct 28: a new Props concept, dropped

- The owner liked LineCrush's page (the site shown in a tablet and a phone)
  and asked for something as eye-catching. Three mockups (a card deck, a
  clipboard, an arena board) got "yeah i hate those designs". They then
  picked only the device frame: the Props tab inside a tablet or phone
  frame on a computer, with a Tablet / Phone / Full page switch. It was
  built (the site at `/props?device=1` in an iframe) but the owner called
  it off before it shipped: "ok lets just give up on that". Nothing was
  pushed. Don't bring the idea back unless they do.

### Oct 27: Finder cards without boxes; Lines tab on the NBA player page

- The owner, on the phone Finder: "I don't like how it's just squares ...
  the prop strips where it shows the prop and the trends last 5,10,15
  etc it's like rectangles where they are placed in". Phone rules only
  (`src/finder-board.css`, max-width 760px; the computer table is
  unchanged): DEF / AVG L10 / STREAK are plain numbers with thin rules
  between (no grey strip), and each hit rate is its label, the % in its
  colour, the record, and a thin bar filled to the rate (`--rate`, which
  Heat in UnifiedFinder.jsx already set) instead of a coloured box. Both
  cells need `justify-items` / `justify-content: start`: the computer
  rules centre them and Chromium applies justify-items to block cells too.
  (The old standing note "the Finder stays as is" is overridden by the
  owner here, for these cards' look.)
- "put the line movement in its own tab in the matchup page ... so it's
  not in the way of other research": a fifth tab, Lines
  (`NbaMatchupPage.jsx` TABS), holds `LineMovement`; it left Overview. On
  a computer it's a section (`mp-sec-lines`) in the research column. Five
  tabs fit a phone: `.mp-tabs[data-count="5"]` shrinks the labels
  (MatchupPageShell.jsx sets data-count).

### Oct 27: Line movement on the NBA player page

- The owner asked "Where is the line movement" (idea 5); first version had
  a "His line by game" chart under tonight's moves. Then: "Remove the
  bottom his line by game ... make the line movement better more sleek and
  compact add actual icons and logos ... premium like polished". Now
  `LineMovement` in `src/sports/wnba/NbaFacts.jsx`, first under His games:
  header with the PrizePicks logo (`/prizepicks/logo.png`) and how long ago
  the NBA lines were last checked; one grouped list of tonight's lines that
  moved (page's own first, accent edge): a toned mark (trending up / down,
  pulled), the stat with "N moves · time" or "Pulled time", a small step
  chart of its path, the number now with "+1 from 21.5", a tap for each
  move's time on a dot timeline; a line pulled tonight (off the board)
  still shows, struck through; the unmoved ones as "Steady" chips.
- Server: `/api/wnba?league=nba&resource=line-history&player=` returns
  `moves` (`line_moves.player_moves`: every move still on the list, 1500
  across sports, so a busy day's early moves can roll off) and `checked`
  (`line_moves.checked()['nba']`). The by-game closing numbers and
  `line_archive.player_lines` were removed with the chart. Nothing new is
  recorded. Tests in tests/test_line_moves.py.

### Oct 27: Home / away, Minutes & shots, Rest on the NBA player page

- The owner picked 4 of 6 ideas (1-4; 5 line history and 6 spread/total
  not asked for yet). `src/sports/wnba/NbaFacts.jsx`, on Overview under
  His games (phone: after His games; computer: in the games section):
  - Home / away: the prop's stat over the row's line at home and on the
    road, hits/games, % and average; this season once it has 10 games,
    else both seasons the log holds (the note says which); "Tonight" on
    tonight's side.
  - Minutes & shots: last 10 games' minutes as bars with a dashed line at
    his usual minutes, then a table of Minutes / Shots (FGA) / Threes (3PA)
    / Free throws (FTA) for L5, L10 and SZN. SZN is "Last SZN" until this
    season has 5 games. L5/L10 go green/red at 12% and half a unit from it.
  - Rest (beside the injury report): both teams, Back-to-back / 3rd game in
    4 nights / N days off, last played, plays again tomorrow. From
    `league.rest`; `restBefore` moved to `src/rest.js` (slip-matchup.js
    re-exports it) with a new `nextGameIn` (tests/nba-rest.test.mjs).

### Oct 27: Depth tab redone

- The owner didn't like the first version (slot rows of wrapping chips:
  G, G, F, F, C, which also put Castle at C and Wembanyama at F, and
  outlined Champagnie as "him"). `NbaDepth.jsx` now: STARTERS, last game's
  five as photo tiles (5 across from 560px, 3 over 2 on phones so
  Wembanyama / Antetokounmpo fit; a hyphenated name may wrap), position
  letter + minutes; BENCH, everyone else with minutes, most first, a
  minutes bar (full = 40) and the number; INJURY REPORT, report entries
  with no minutes lately or not in the rotation, with the injury. Tonight's
  status on every player, sitting players faded, "Next up for <starter>"
  on the bench player at the sitting starter's position (then the nearest)
  with the most minutes. Minutes are the rotation's `min` (his last 5
  games), matching the card's note. His own tile/row is outlined, matched
  on id and name together, then name, then id (`lineup` in NbaDepth.jsx):
  the board's id and the box score's can disagree. Healthy players with no
  minutes are left out. The slot layout (`depthRows`) stays for the
  Finder only.

### Oct 27: the line on the player page's chart

- The owner sent Wembanyama H2H: a 28 drawn under the 27.5 dashed line.
  The line was placed right; the tallest bar was short. Its number above
  it made the column too tall, so flexbox shrank the bar (about 9% fewer
  pixels per point than the others). `.nba-mp .mp-bars>:is(span,button)>*`
  now has `flex-shrink:0` (the number sits in `--mp-bars-room`), and the
  2px dashed line is centred on its value (`translateY(50%)`). Measured in
  the browser: same pixels per point on every bar, line within 0.1px.

### Oct 27: double-click a Props row to open his page

- The owner: "make it so when i double click it opens the prop and i dont
  have to click the open his matchup page". On the big-screen Props list
  (list + preview, 1500px and up) one click still picks the row for the
  preview; a double-click on the row opens his matchup page
  (`PropRow` in `src/MatchupList.jsx`, `onDoubleClick`). Phones and
  smaller computers are unchanged: one tap already opens the page.

### Oct 27: Depth tab on the NBA player page

- The owner: "can we add a depths thing here" (the Overview / Matchup /
  Stats tabs). New 4th tab "Depth" (phones) and a Depth part in the
  computer dashboard (column 1 on a big monitor, column 2 below that):
  `src/sports/wnba/NbaDepth.jsx` DepthCard, his team / tonight's opponent
  switch, five slot rows (G, G, F, F, C): last game's starter first, the
  bench by minutes (min10, else the rotation's min), tonight's report on
  each player (Out / Doubtful / GTD...), "Next up" for the first healthy
  player behind a starter who sits tonight, his own chip outlined. The
  rows come from `src/sports/wnba/depth.js` `depthRows`, moved out of the
  Finder's WNBAPlayerPage.jsx (which now imports it; same behaviour) and
  given a position reader: the NBA page passes `positionCode` so PG/SG read
  as guards.

### Oct 27: tap a game on the player page's chart

- The owner: "make this look nicer ... the trends closer to each other ...
  when I click on them show the info like the Finder ... minutes ... the
  starters who were out and did he start or not ... I need to know if it
  matches tonight's matchup". `MatchupPageShell.jsx` Trend: bar columns
  are at most 54px and centered (L5 no longer spreads across the card),
  solid colors, opponent with @ for away and the date under each bar. On
  the NBA page (`notes` + `tonight` props from NbaMatchupPage.jsx) a bar is
  a button; the picked game (default the latest) shows under the chart in
  `GamePanel`: opponent, date, his number vs the line, W/L and score,
  Started / Bench (with "same as tonight" or tonight's role when
  lineup-role knows it), usage, MIN/PTS/REB/AST/3PM/STL/BLK/TO (the line's
  stats outlined), FG/3PT/FT, then who sat on his team and on theirs (season
  points, "starter" if he usually starts) with "Out tonight too" / "GTD
  tonight" from tonight's injury report, and for this season's games "Out
  tonight, not out this game: ..." for his teammates.
- Server: `context.game_notes` (resource=game-notes, also the Finder's game
  cards) now marks each player who sat with `starter` (started half his
  games) and adds `oppOut`, the other side's who sat, same rule (6+ points
  a game over 3+ games, top 3). NFL's chart is unchanged (no notes).

### Oct 27: the Props list on a computer, list + preview

- The owner ("make a better layout design", screenshot at ~2000px wide):
  from 1900px the list had been two columns of rows that read 1 left,
  2 right, with wide gaps across each row. Now (`MatchupList.jsx`
  `Preview`, "Big screen" block at the end of `nba-matchups.css`):
  - Always one ranked list (the two-column rule is gone).
  - From 1500px (`picking`), a preview of the picked prop sits beside the
    list and stays in view while it scrolls: photo, team, game, the line,
    the matchup with its label, his last 10 games as bars against the line
    (opponents under them), L5 / L10 / L20 / season hit rates, what made
    the score (the same `Reads` as a row's Why), his other lines tonight
    (each with its score; a tap shows that one) and "Open his matchup
    page". A row click picks instead of opening the page; rows have no Why
    arrow there. Below 1500px nothing changed (a row opens the page).
  - For the preview to stay in view, `position:sticky` had to work: on the
    Props tab from 1100px the page body is `overflow-x:clip;
    overflow-y:visible` (site-wide it's `hidden/auto`, which stops sticky).
    Phones are untouched.

### Oct 27: whose Kings numbers are right (ours vs RotoBot)

- The owner showed Wembanyama vs SAC: ours "121.1 allowed, 4th most",
  RotoBot "124.0, 6th most", and forwards 11.2 points (4th most) vs 43.0
  (12th fewest). Checked on sportsdataverse's box scores (reachable at
  github.com/sportsdataverse/sportsdataverse-data/releases/download/
  espn_nba_team_boxscores/team_box_YYYY.csv, and espn_nba_player_boxscores/
  player_box_YYYY.csv; 2027 = the 2026-27 season; no pandas here, use csv):
  - The Kings' last season + this season (85 games): 121.1, 4th most = ours.
  - This season alone (3 games): 124.0, 6th most, pace 103.5 = RotoBot's.
  - RotoBot's "vs forwards" is all forwards together, this season only (our
    count: points 44.3, assists 9.3, steals 3.3, near its 43.0 / 9.3 / 3.3);
    ours is each forward, both seasons.
  Both right, different games. The defense card (`TheirDefense`) now has a
  This season / Both seasons switch (shares the shot chart's saved choice,
  `propscout:shot-season`; 'last' shows Both there) and says how many games
  ("3 games", "85 games, last season included"). This season hides the
  "Shooting and more" rows (kept for the whole sample only). The score
  still reads both seasons until teams have 15 games.

### Oct 27: the Props tab, premium but plain

- The owner: only they will have the Props tab now ("make it feel admin and
  premium ... surprise me"). A first try (gold "Private" pill, pulsing
  live dot, a stats strip, glowing score rings, gradient title, court-line
  art) got: "I don't want it to look like it was made with AI, I don't want
  the futuristic look, I want nice looking animations not AI slop". Don't
  bring any of those back: no glows (text-shadow / glow box-shadows), no
  gradient text, no animation that loops forever, no decorative line art,
  no gold badges, no KPI strips. Think sports app (solid colors, team
  colors, plain type), with short motion that has a job.
- What stayed (`src/MatchupList.jsx`, "Clean" block at the end of
  `src/nba-matchups.css`):
  - Title with "Updated 8:44 PM · 140 props" under it.
  - League and stat tabs share one underline that glides to the picked tab
    (`src/use-ink.js`).
  - Soft spots (`SoftSpots`): every defense on the board by stat, the
    average matchup of the props against it, as a flat colored table.
    Phone: teams down, stats across; computer: teams across. A tap lists
    only the props against that defense in that stat, with an "Against
    CHI's defense" chip to clear it (`facing`; picking a game clears it).
    It and the track record are two buttons side by side; both start
    closed, the device keeps which was left open (`props-fold`).
  - Rows: a rank column (top three in white), the matchup number with its
    bar as before (its glows and the 90+ pulse removed), Last 10 with ten
    small bars of his games against tonight's line (`Spark`, `row.gameLog`).
  - Rows ease in (6px, 35ms apart), bars fill, panels fade open.
  - The list's background is a plain dark gradient now (the accent and
    green glows are gone). The player page keeps its team-color wash; its
    gauge glow is gone.

### Oct 25: cleaner list, full rosters neutral

- The owner: the list looked crowded ("hitting and prop grade and blowout
  stuff"), wanted just the matchup like RotoBot. Rows now show the photo,
  name, line, game, a big matchup number with a bar under it, and a quiet
  Last 10 (`5/10`). Gone from rows: Prop grade column and sort, Hitting
  pill, Blowout mark, Starter/Bench, "Strong edge" text, "% over". Sort is
  Matchup | Last 10. The Why panel keeps the blowout and role notes; the
  track record shows matchup bands only. Prop grades are still computed
  and still reported to the track record in the background.
- The owner: Reaves @ UTA (the league's softest defense) read 44 for
  points. Cause: with nobody out on either team, the who's-out reads took
  up to ~38 points off (centred on a usual night's minutes out). Now only
  minutes out beyond a usual night count (`beyond()` in
  nba-matchup-score.js); a clean report adds nothing and shows no line.
  This shifts ordinary nights up versus the backtest's bands, so the
  out-of-sample numbers in the file's header are no longer exact: watch
  the track record. If it should be re-fitted, the backtest is in
  `tools/nba-backtest/`.
- Same night, the owner: Reaves @ UTA still only 79 ("his matchup is
  great"). On the backtest's scale a defense alone topped out in the low
  80s; the 90s were left to injury nights. Now each stat's opponent reads
  are stretched (`STRETCH` in nba-matchup-score.js) so an opponent 1.65
  spreads soft on all of them reads 97. On last season's numbers the
  opponent alone now spans about 1-98, median 49, ~8% at 90+. The
  backtest's own number is kept as `calibrated` and is what the Analyzer's
  chances and tiers read (slip-matchup.js `odds`, slip-check.js), so the
  stretch changes what members see, not the model's chances.
- Then: a starter (lineup-role.js: started his team's last game) is
  scored on the opponent alone. His teammates out / back reads are left
  out for him; a bench player still reads them; the opponent's players out
  count for everyone. A who's-out line that adds 0 points isn't shown.
  Checked on last season's numbers: every stat and combo scores 0-100,
  medians 42-52, 2-14% at 90+.
- Slip Analyzer speed (the owner: "buggy and takes forever loading to
  give a rating"). Server (slip_reader.py `read_slip`): the screenshot
  readers ran one after another with 25-40 s timeouts each, so a slow Groq
  could run past the 60 s function limit and fail after a minute. They now
  race (`race()`, as `read_bet` does): Groq vision, Gemini beside it after
  8 s (SLIP_HEAD_START) or a failure, then the OCR text read; first answer
  wins, 45 s at most (SLIP_DEADLINE). Page (SlipAnalyzer.jsx `run`): it
  waited for every league's board (all 7) before grading; now only the
  leagues on the slip (all of them only when a leg's league wasn't read),
  each held to 12 s, other boards used if already in; matchups held to
  8 s, learning to 3 s, each pick to 15 s (then graded from the board
  without the lookup). The ~1.7 s of deliberate pauses between steps are
  gone. 4 errors in tests/test_slip_reader.py are older (they import
  analyze.py / api modules this container can't load).
- Filters on the Props list (the owner: only regular lines and starters,
  or only Demons, or quick Goblins). Two switches under sort: Lines
  (Regular / Goblins / Demons / All, default Regular) and, where the
  league knows starters (the NBA's rotation), Players (All players /
  Starters / Bench; one the rotation doesn't list shows under neither).
  Both remembered on the device per league (`props-kind:<league>`,
  `props-role:<league>`). The store now keeps one line of each kind per
  player and stat (props-lines.js `pickLines`: the standard, the highest
  Goblin, the lowest Demon); `mainLines` keeps the old rule (standard,
  else lowest Demon, never a Goblin) and is what the track record gets, so
  its rates stay comparable. Goblins show PrizePicks' goblin icon beside
  the line, as Demons do. Hit rates now load for those extra lines too.
- Look (the owner: "animations ... colors ... not just black and
  boring"). Pages stay solid and dark; color comes from the content.
  List: each row washed faintly in the player's team color (league.teams
  color) with a team strip and a ring on the photo; scores glow in their
  tone, 90+ pulse softly; the first 14 rows slide in one after another and
  count their scores up (`src/count-up.jsx`), bars fill; Why unfolds;
  Goblins/Demons chips green/red. Player page: accent from his team
  (`--mp-accent` mixed with white), banner eases in, each tab's sections
  fade up, averages count up on a team-tinted wash, chart bars grow one by
  one (good green, miss pink), the gauge knob slides to its score, tiles
  pop in tinted by tone, defense bars grow from the middle. Everything is
  in the "Personality" blocks at the end of nba-matchups.css and
  nba-scout.css, off with reduced motion; entrance animations use
  `backwards` fill so nothing keeps a transform.
- Background (the owner: "a nicer background, not just plain black").
  The NBA/NFL Props pages now paint #app-shell edge to edge (the panel goes
  clear): the list a deep slate with soft accent and green glows from the
  top, a player page his team's color glowing from the top and tinting the
  page all the way down (MatchupPageShell sets `--props-team` on
  #app-shell), both with a fine grain. The banner fades into it and the tab
  bar is clear, frosted when pinned. Rules at the end of nba-matchups.css
  (Background) and nba-scout.css. The site's background photo and glow
  still stay off on the Props tab; this replaces the flat black only.
- Compact top (the owner: "I see all buttons then I have to scroll down
  to see props"). Title row is one line (the blurb, now shorter, only on
  wider screens) with a small refresh; one row of 40px controls: search,
  game, and a Filters button (badge = how many are set away from the
  usual). Sort / Lines / Players open under it as a small panel; when it's
  closed, the ones set show as green chips that clear with a tap. Stat tabs,
  track record (one line) and the table sit tighter. Rules in the "Compact
  top" block at the end of nba-matchups.css.
- Desktop (the owner: "not a good layout for pc ... a small centered
  floating ui"). From 1100px (`src/use-wide.js`), the NBA/NFL Props panel
  takes the screen's width (to 2200px). List: a sidebar on the left
  (title, search, Sort / Lines / Players always open, every game listed
  with logos, time and count) and the table filling the rest; two columns
  of props from 1900px. NBA player page: no floating card; a big banner,
  then every section at once in panels (`.mp-dash`): grade + why |
  averages, his games, injuries | research (shot / rebound / assist
  charts, play types, defenders, vs them), then position ranks + game log;
  three columns from 1500px, two below. The tabs become pills that jump
  to each part and light the one in view. Phones and tablets keep tabs.
  NFL player page still uses the old two-column tabbed layout (wider now).
  Rules in the "Desktop" blocks at the end of nba-matchups.css and
  nba-scout.css. tests/slip-matchup.test.mjs's NHL test fails by date
  (its fixture's last game is now "first game back"), not from this work.
- Desktop, round 2 (the owner: "I don't want it just floating, I want a
  template on it ... I don't like these gaps"; his screenshot showed the
  page still in the site's narrow container). Both the list and the NBA
  player page are now one framed surface (border, rounded corners, solid
  dark fill) that breaks out of the container to the screen's width:
  `width:var(--frame)` with `--frame:min(2200px,100vw - 80px)` and
  `margin-left:calc(50% - var(--frame)/2)` (assumes the panel is centered,
  as .tab-panel is). Player page: banner at the top of the frame, a bar
  with the section pills, then columns split by thin lines, each column
  its own stack (`.mp-dcol` > `.mp-part`), so no holes: 3 columns from
  1500px (grade + ranks | season, his games, injuries, game log |
  research), 2 below (grade + ranks + research | the rest). List: the
  sidebar is the frame's left pane.
- Pop-ups (the owner: the shot chart opened from the bottom on a computer,
  and the page under any pop-up still scrolled). `src/scroll-lock.js`
  (`lockScroll` / `useScrollLock`, counted, keeps the scrollbar's width as
  padding) now holds the page still under the NBA chart sheets, the
  Analyze pop-up and My Bets' form. From 761px the chart sheets open in
  the middle over a blurred page (`.mp-sheet-panel[data-kind]`), the shot
  chart 1180px wide with the court beside its zones from 1000px; phones
  keep the sheet rising from the bottom. Focus starts on Close; Escape
  closes. Use useScrollLock for any new pop-up.
- Back arrow bug (the owner: back from a player page went to the Parlay
  Builder). A history entry left from before a reload (app-update.js
  reloads after each release; app.js keeps `...history.state` on load)
  still said `nbaMatchup`, so back trusted it and went one page too far.
  MatchupList.jsx now marks each pushed entry with a token made when this
  visit opened it (`opened` ref); only that token counts, a stale one is
  cleared on load, and back without it just closes the page.
- Back arrow, round 2 (the owner: "sometimes" still another page, phone
  and PC). app.js's tab switch did `pushState({...history.state})`, so a
  player page left open while visiting another tab put its mark on that
  tab's entry; back trusted it. app.js (tab switch and first load) and
  CheatSheets.jsx no longer carry `nbaMatchup`, and MatchupList.jsx only
  calls history.back() when `history.length` is what it was right after
  the page opened; otherwise the arrow just closes the page.
- Write-ups for Discord (the owner's community posts, admins only:
  `siteIsAdmin()`). A "Write-up" button on an NBA player page's banner
  opens WriteupSheet.jsx: pick one of his lines, "Add to post" (legs from
  several players' pages gather in a slip kept on the device, at most 6),
  title (PLAY / MINI NUKE / NUKE / EXCLUSIVE PLAY / LOCK), units,
  confidence, reasons per leg, an editable text box and "Copy for
  Discord". src/writeup.js `legFacts` builds only reasons FOR the over,
  strongest first: what they allow his position (dvpEach), their defense /
  pace, rebounds and FG% allowed (misses to clean up), assists and threes
  allowed, his best shot zone vs their zone defense, his rebound / assist
  chances and 3PA volume (player-context opportunity), his last 10 / last
  5 / games vs them against the line, how similar players did vs them
  (player-context similar), teammates and their players out tonight.
  `formatPost` writes ## title, **bold** legs, • reasons, -# small lines.
  No odds (the site has none). Tests: tests/writeup.test.mjs.
- Write-ups, round 2 (the owner: different emojis, not a copy of the
  posts he showed; fewer numbers, explained for people who don't know
  sports). Reasons are plain sentences with at most a place ("3rd most")
  or "8 of his last 10", never decimals; teams by name ("the Heat").
  PropScout's own layout: `## 🔎 PropScout PICK · 2-Leg Parlay`, a -#
  details line (sport, units, confidence), each leg as a ### heading with
  its reasons in > quotes, each starting with its own emoji (🎯 position,
  🛡️ defense, 💨 pace, 🧲 / 🧱 rebounds, 🤝 assists, 🏹 threes, 📍 zones,
  📈 / 🌡️ form, 🔁 vs them, 👀 similar players, 🚑 who's out), a -# grade
  line and a -# sign-off. Labels: PICK / TOP PICK / BEST BET / LEAN /
  SLEEPER. Don't bring back ☢️, "Write-Up 📝", "Confidence Rating ⭐" or
  "BOL & React": those were the other account's. Slip key is now v2.
- Write-ups, round 3 (the owner posts in a general community, not his
  own): the post is only the analysis. No PropScout name, no matchup
  grades, no sign-off: `## 🏀 NBA PICK` (· N-Leg Parlay), an optional -#
  units / confidence line, then each leg's ### heading and > reasons.
  The pop-up was under the phone's dock (.tab-panel's z-index:2 caps
  anything inside it): NbaMatchupPage now renders its pop-ups through a
  portal on document.body inside `.nba-mp.mp-layer` (a frameless wrapper
  so the page's colors still apply). Write-up screen rebuilt: his lines
  as small cards, the leg with Add, the parlay's legs as chips, one row
  of options, a Discord-look preview (or Edit text) and a Copy bar stuck
  to the bottom (safe-area aware), nearly full screen on a phone.
- Write-ups, round 4: Goblin and Demon lines are their own choices in the
  write-up (icon on the card, "(Goblin)" after the leg's line, key
  player|market|kind), with a +/- stepper to move the line. New reasons
  from his games against the line, strongest first and never repeating
  each other: never under all season (N for N), N straight overs (6+),
  never under in his last 5, never under vs them (2+ games), and how far
  above the line he's been averaging (rounded), then the plain counts only
  where a streak doesn't already cover them.
- Write-up accuracy (the owner checked a post against PropsEdge and
  another AI: "is this true data?"). Three real problems, fixed:
  1. Early in a season league-context blends ALL of last season's games
     in until teams average 15 (BLEND_GAMES): ranks were mostly last
     season's. context.py `this_season_tables` now sends `thisSeason`
     (dvpEach, teamStats, opportunity, zoneDefense, games per team) when
     blended; writeup.js reads it, says "so far this season", and says no
     team numbers for a team with under 3 games. The matchup SCORE still
     reads the blended numbers on purpose (steadier).
  2. ESPN's status can say Out while its fantasy code says GTD (Cooper
     Flagg). _nba_tonight now sends `code`; nba-matchup-score.js
     `CODE_SITS` lets the code decide (GTD 0.5, Q/DTD 0.35, D 0.8, OUT 1).
     This also lowers scores that counted a GTD player as fully out.
  3. Position: writeup.js reads ESPN's position (league.rotation) before
     the props app's (Diabate is a C, PrizePicks said F). The score still
     uses the row's position.
  Still different from PropsEdge by design: we count each player at a
  position (G/F/C), they count the position's total by PG/SG/SF/PF/C.
- Write-ups, round 5: a "Compare him to" Guards / Forwards / Centers
  switch (starts on ESPN's position, else the line's; the writer's pick
  wins: Diabate still came out as a forward). Streak lines never repeat:
  a run reaching back past this season is said once ("..., every game
  this season included"), else "never under all season (N for N)".
- Write-ups, round 6 (the owner: lead with what they give up, not "they
  play fast"; hated Davion's emojis; injuries only when sure and it
  matters). "Give up" reasons lead: his position in the stat, then each
  part of a combo on its own (dvp-pts / dvp-reb / dvp-ast) and points per
  game allowed (teamStats); "the most" / "the 3rd most". Pace is filler
  (weight 1, top 4 only). Form emojis: ✅ straight / last 5, 💯 all
  season, 📊 averaging above the line, 📈 counts, 🆚 vs them, 📋 out.
  Injuries only when ruled out (code/status OUT, not GTD/Q), 24+ minutes,
  and at his spot (or 30+ minutes on his team; their center for a
  rebounding line).
- Write-ups, round 7: a combo's part gets its own line only when it ranks
  3+ spots worse than the combo (no "6th most points" beside "7th most
  PRA"); the vs-them line needs 2+ games and most of them over (no "1 of
  2"). The owner hand-edits titles ("2 MAN · (2x)"), writes "PRA" and
  dropped "(Goblin)": ask before making those the defaults.
- Matchup score, ranked (the owner: "sometimes I don't get why some
  matchups are high or low": P.J. Washington's 3PM vs MIA read 96 while
  MIA allow forwards an ordinary number of threes). The earlier STRETCH
  (opponent reads x~3) is gone: one read could carry a score (threes read
  only 3PA allowed, which MIA's pace inflates). Now (nba-matchup-score.js
  `opponentSide`, `rankedComposites`): each team's opponent reads as a
  weighted average of softness (backtest weights), with what they allow
  his position always POSITION_SHARE (0.4) of it; the 30 teams ranked
  (cached per league object, per stat + position): softest ~98, middle
  50, toughest ~2; his own reads (who's out, meetings) added on top in the
  backtest's points through the tanh curve. `calibrated` (Analyzer odds)
  unchanged. Shown read points are each read's share of the ranked
  score. On last season's numbers P.J. vs MIA went 79/84/63/84/36/77 ->
  75/88/52/68/45/65 (RotoBot 67/70/55/75/53/85); every stat spreads 2-98,
  10% at 90+. The Matchup tab's "Tonight" card is now "What moved it":
  every part (opponent's and tonight's) with its effect, biggest first.
- Matchup score, round 2 (P.J.'s 3PM still 92 live: MIA's 3PA allowed
  +30 and ONE game vs them +18). A single meeting is now shown beside the
  score, not counted (meetingsRead, n < 2); POSITION_SHARE 0.5; "What
  moved it" always lists what they allow his position.
- Jaime Jaquez (Oct 26): "Teammates back -43" for three Bucks who hadn't
  played this season, and no Starter label though he starts. Fixes: the
  rotation now sends `playedSzn` (his games for the team this season,
  context.py `_recent_minutes`); backTonight needs playedSzn >= 1 (early
  in a season the last 10 games reach into last season). Teammate in/out
  reads apply only to a KNOWN bench player (lineupRole starter === false),
  not an unknown role. lineup-role.js `rotationPlayer` falls back to the
  name without Jr./Sr./II/III when the line's id doesn't match (likely why
  Jaquez Jr. wasn't found; his #24 was missing too). An attempt to add
  players missing from ESPN's roster was dropped: it kept departed players.
- Jaquez, round 2: his shot zones and rebound chances were empty. Cause:
  api/wnba.py `_norm` kept name suffixes, so PrizePicks' "Jaime Jaquez"
  never matched ESPN's "Jaime Jaquez Jr.": no ESPN id on his rows (no
  player-context, jersey, role). `_norm` now drops jr/sr/ii/iii/iv/v (names
  of 3+ words) and reads curly apostrophes; the saved directory keys moved
  to v3 (ROSTER_KEYS) so it rebuilds with the new keys.
- Kyrie Irving read "Bench" (Oct 26): he sat Dallas's last game (rest, a
  back-to-back's second night) and the five came from that game alone.
  context.py `_starting_five`: a player whose latest of the team's last 3
  games (SAT_OUT) was a start but who missed its last game competes with
  that game's five on his own start share (then: started last game, then
  minutes); the fill-in starter drops to Bench. Both rotation paths. New
  `playedLast` field; lineupRole adds `sat` ("he sat out the team's last
  one"), and returns null (neither filter) for someone back after missing
  3+ games who'd started most of his own games before.
- Shot chart season switch (Oct 26: the owner compared RotoBot's this-
  season-only chart with ours, which blends last season in until 15
  games). ShotZones (NbaScout.jsx) shows This season / Last season / Both
  (default Both, remembered on the device: localStorage
  'propscout:shot-season') when the league context has `thisSeason` and
  the new `lastSeason` (context.py `last_season_zones`: zone tables only)
  and player-context has the new `zoneSeasons` ({season: zones}). The
  detail line says "this season"/"last season". Desktop pop-up grid rows
  moved down one for it.
- npm's registry wasn't reachable from the container this session, so no
  `vite build` ran here: checked with esbuild + Playwright on a harness
  page and the JS tests (4 failures there are older, missing packages).

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
- NBA matchup score v3 (Oct 24, owner: "build everything you think is
  best to get our matchups most accurate"). Same backtest, new reads
  (scripts now in `tools/nba-backtest/`, README there; data from
  sportsdataverse's GitHub releases):
  - Who's out: a team's recent rotation players (3+ of its last 10 games,
    one of its last 3, 15+ minutes in them) who sat. Per 30 minutes his
    teammates had out at his position, he beat his average far more often
    (log-odds x 245: points +71/+75 in the two seasons, threes +40/+50,
    assists +65/+44), elsewhere less (+48/+55 points); the opponent's out
    a little (their center for rebounds +26/+21). By far the strongest
    read. Centred on a usual night (`OUT_CENTRES`: about 12 minutes out
    at a guard's position, 17 elsewhere), so nobody out reads a bit
    below. Fitted together, defense flipped sign for rebounds and assists
    (dropped there); last-10-games defense added (`recent`, small);
    back-to-backs too unsteady (opponent's for rebounds only, left out:
    the Analyzer's rest facts cover it); combos weighted by his stat mix
    read worse than the even average (kept even).
  - New scale K 133 (weights in `WEIGHTS`; meetings refitted 70.6 / 45.6).
    Out of sample: 90+ (2.6%) +13.5 points of % over usual, 75-89 +6.9,
    60-74 +2.6, 40-59 even, 25-39 -2.8, under 25 (10.8%) -7.0; best tenth
    vs worst tenth 15 points apart (8 before; points 20, PRA 26). Without
    tonight's report the opponent alone ranges about 18-83.
  - Live: `resource=tonight` (api/wnba.py `_nba_tonight`: each game's
    ESPN injury report via matchup.py, 5 min; a game whose report lists
    nobody is unknown, not healthy) and league-context `rotation` players'
    `played10`/`min10`/`last3` (context.py `_recent_minutes`) and
    opportunity `ptsAllowed10`/`drtg10`. `outTonight` counts Out /
    Suspended fully, Doubtful 0.8, Questionable / Day-To-Day 0.35 (public
    rates; the backtest counted who actually sat). ESPN positions
    (PG/SG/SF/PF) go through `positionCode` (positionOf alone read PG as
    F). The list and the Analyzer load tonight's reports (props-data.js
    `refreshTonight`, slip-matchup.js `loadMatchups`); never saved on the
    device. In the Analyzer the teammates read is marked counted when the
    prop model has used a teammate's absence (`mate:` keys).
  - Shown: list Why ("His teammates out", "Their players out", "Their last
    10 games") and a "Tonight" block on the player page under Why this
    score; footnotes rewritten.
  - Track record (`props_record.py`, `src/props-record.js`): the NBA list
    POSTs what it shows (`resource=props-log`, at most every 10 min per
    tab, games still to come; KV `krazy:props-record:v1:nba:<day>`), and
    `resource=props-record&days=14` grades it against the stored season's
    box scores by score band and Prop tier (pushes left out of rates). The
    list shows it once a band has 20 props. This is the real test against
    PrizePicks' lines (which already price injury news): watch whether
    75+ and Elite beat ~54% over the next weeks, and refit if not.
- Hit-rate round (Oct 24, owner: "make money ... really good hit rate",
  then "Do everything"). Five pieces, each backtested first (scripts 8-12
  in `tools/nba-backtest/`):
  - Teammate back (`nba-matchup-score.js` `backTonight`, read `back`,
    "Teammates back"): a rotation player (20+ min over 5+ games) who
    missed his team's last 3 but played one of its last 10, not listed
    out tonight (questionable counts 0.65). Per 30 of his minutes at the
    player's position about -20 points on the 133 scale (rebounds -31,
    blocks -20), elsewhere -9 (`WEIGHTS` backPos/backOther, centred on
    `BACK_CENTRES`). Signs held in both seasons. Skipped when the team's
    last game is over 20 days old (a season's first game reads last
    season's games). Newcomers (no games for this team in its last 10)
    don't count.
  - Hot shooting (`prop-model.js` `HOT`, `shootingContext`; history ->
    `unified-finder-data.js` `shootingForm`, on NBA rows as `shooting`):
    a projection on recent rates runs ahead of hot shooters. Points x
    (1 - 0.54 hotFg - 0.49 hot3), threes x (1 - 1.67 hot3), combos with
    points by points' share, held to +-12%. Same in both seasons. Against
    his season average hot shooting points the other way (real form), so
    it's a projection fix, not a matchup read.
  - Game line: `nba-odds-history.yml` (by hand) got ESPN lines for 980
    games, all 2025-26 (ESPN kept none for 2024-25), so tested on the
    season's two halves. Starters (28+ min) lose 1.3 minutes at a 10-13
    point spread and 2.8 past 13 but only come in ~2% under projection;
    bench players (15-28 min) beat projection in points, assists and
    threes by 3-4% at 7-13 and 7% past 13. `prop-model.js` `blowoutOf`
    replaced the old guessed cut. The team's expected points (the old
    `scoringRatio`) held up: +2-6% per 10 over usual, kept as is.
    `_nba_tonight` now sends each team's `spread` and `total`;
    `props-grade.js` `withTonight` gives list rows that line as their
    game's odds, and a 10+ spread shows "Blowout risk" (starter) or
    "Blowout boost" (bench) under the Prop grade, with a line in Why.
    `matchup.py` `_odds` now flips ESPN's spread when `details` names the
    other side as favorite.
  - Hitting mark (`props-record.js` `hittingTiers`): the record now keeps
    what each prop needed (`priced`, `pricedRate`, `needed` per band and
    tier). A tier whose props went over more than they needed, by one
    standard error, over 40+ props, gets "Hitting" under its grade and a
    line in Why; the record's grade table shows "Needed".
  - Slip correlations (`slip-correlation.js`): measured on every pair of
    rotation players in a game. Teammates' points ~0 (was -0.05),
    opponents' points ~0.01 (was +0.08: removed), assists with a
    teammate's scoring +0.045 (was 0.08, now under the "together"
    threshold, so smart slips no longer seek those pairs), two centers'
    rebounds -0.06 (avoided), other boards 0. One player's two lines:
    points/threes 0.48, points/rebounds 0.21, assists/rebounds 0.165,
    points/assists 0.15, threes with either 0.09.
- Rebound and assist research (Oct 24, owner: points has shot zones vs
  their zone defense, rebounds and assists only "5th most allowed"). On
  the NBA player page's Matchup tab, beside "Where he scores", two doors
  open sheets (`NbaScout.jsx` ChancesLink / Chances, math in
  `src/sports/wnba/chances.js`): "Where his rebounds come from" (tonight's
  misses on each end: their misses they don't get back and his team's
  misses it gets back, each team's usual met halfway, against his team's
  usual game, his own defensive / offensive boards moved by as much; his
  shares; why they allow what they do: misses, how hard they crash, how
  weak their glass is; who's out with his splits) and "Where his assists
  come from" (his team's baskets and the share assisted, halfway with
  what the opponent allows; his assist share and teammates' shooting;
  baskets allowed, % of baskets assisted against them, FG% allowed). The
  prop's own stat's door comes first. New team-table keys (opportunity.py):
  fgm, fgmAllowed, orebPct, orebAllowedPct, assistedPct, assistedAllowed.
  Backtested first (scratchpad chances.py): alone they line up with overs
  (fgm allowed top vs bottom third +6.1, % assisted allowed +3.9, game
  misses +2.6, their weak glass +2.8) but add nothing on top of
  rebounds/assists allowed, so they explain the score, not join it; the
  sheets say "Arithmetic, not a pick". The without-a-teammate average
  shows only on the prop's own stat's sheet (player-context's split is
  in the prop's market).
- `src/nba-matchup-score.js`: the 0-100 score, rebuilt Oct 22 on a
  backtest like NFL's (the owner's call, after RotoBot's per-player grades
  proved impossible to explain): every 2024-25 and 2025-26 player-game with
  15+ minutes, the opponent read as it stood that morning, against whether
  he beat his own average (season so far, last season worth 10 games). A
  read counts only where its sign held in both seasons; weights are the
  log-odds x 245 (2.5% of props at 90+), score 50 + 50 tanh(points/50).
  Weights a spread (`WEIGHTS`): points defense 19 (points allowed and per
  100 possessions as one read), pace 12, position 3.5; rebounds defense 6,
  position 6, rebounds allowed 18.5; assists defense 5, pace 7.5, position
  13, assists allowed 18; threes only the threes they let teams take 22;
  steals defense 10, position 6, their turnovers 18.5; blocks defense 7,
  pace 9, position 17.5. Out of sample: 90+ (3% of props) beat their
  average 4.4 points of % more often than usual, 75-89 +3.7, 60-74 +2.3,
  40-59 even, 25-39 -2.3, under 25 -3.9. The RotoBot-fitted weights before
  it put 19% at 90+ (+3.3) and 30% under 25. Findings: "vs position" a
  player at a time (`dvpEach`, RotoBot's way) beat the position's total
  and tied per-minute; FG% allowed pointed the wrong way for assists and
  3P% allowed predicted nothing, so neither is read. OKC guards vs Denver
  on last season's numbers: PTS 56, REB 44, AST 62, 3PM 72, STL 25, BLK 66
  (Denver turn it over the fewest). Backtest scripts aren't in the repo
  (ESPN box scores from sportsdataverse's GitHub releases, reachable from
  the container). RotoBot comparisons, for the record: its Denver numbers
  match ours to the decimal, but it gives each guard its own grade
  (points: McCain 89, Wallace 73, SGA 63) and nothing on its pages explains
  that: not his games against them, players like him, his averages, or
  who guards him (McCain and Wallace share Murray). Not chased further.
- Threes and blocks also read his own record (`MEETINGS` in
  `nba-matchup-score.js`, owner's call Oct 22): his last three games
  against the opponent in the two-season history (`meetingsOf` in
  `unified-finder-data.js`; board rows carry it as `row.meetings` from
  `applyWnbaHistory`, the player page works it out from the history, saved
  rows without it reload), against his usual (this season, last season
  worth 10 games): ln((made + 0.5) / (games x usual + 0.5)) x n/(n+3),
  centred (-0.095 threes, -0.114 blocks), weights 80 and 51. Backtested
  with his last-10 form held: consistent in both seasons for threes and
  blocks only (points, rebounds, assists, steals flipped). The log form
  was picked over a ratio for calibration (ratio scored 40-59 props +3).
  It shows as a "Why" line and as "His games against them · Counted in
  this score" on the page. Last season's OKC guards vs Denver, threes:
  McCain 89, Wallace 89, SGA 71, Caruso 89, no meetings 72 (RotoBot 91,
  91, 84, 72). Recent form (last 10 vs his average) predicted far more
  than any matchup read, but lines price it in; it isn't in the score.
- Props lists' lines (owner's rule, Oct 22; `src/props-lines.js`, NBA and
  NFL): one line per player and stat, the standard one; a stat PrizePicks
  posts only as Demons shows its lowest Demon (marked "Demon" in red); a
  Goblin never shows.
- Dunks (Oct 23): PrizePicks' NBA "Dunks" lines had no history (the box
  score has no dunks), so the Finder showed them blank. Now
  `periods.dunk_counts` counts made dunks from ESPN's play-by-play shot types
  ("Cutting Dunk Shot", "Alley Oop Dunk Shot"...; ~12,000 made in 2025-26,
  Zubac 1.7 a game) into each stored game side as `dk` ({pid: n}, None when
  the plays and box disagree), `backfill_periods` fills older games newest
  first on the moves timer (every few minutes; it now runs beside the
  line checks from the start instead of waiting behind them, which mostly
  starved it), and `api/wnba.py _with_periods` adds
  `player_dunks` to his game logs (absent, not 0, for a game not counted).
  The market is `player_dunks` ("Dunks"); context/matchup tables don't cover
  it (`periods.PLAY_MARKETS`), so no matchup score or player-context for it.
  The owner still couldn't research dunks after that (the catch-up hadn't
  reached the games yet), so opening a player's research page
  (`resource=gamelog`, `_with_saved_dunks(fill=True)`) now counts his 15
  most recent games still without dunks on the spot (ESPN summaries, 8 at
  once, 8s cap) and saves each game for everyone in it to the KV hash
  `krazy_data:nba:v1:dunks` (game id -> {pid: n}, 0s included; {} when
  neither team could be counted, so it isn't fetched again; a game without
  plays yet isn't saved). The Finder's batch (`gamelogs`) only reads that
  hash, it never fetches. Dunks has its own tab ("DNK", after B+S) in
  `trend-data.js WNBA_STATS`.
  Checked on PrizePicks' live partner feed (Oct 23, hand-run workflow
  `.github/workflows/prizepicks-check.yml`, GitHub's machines can reach it;
  pause between asks or it answers 429): league 7 "NBA" carried 9,554
  lines incl. 52 "Dunks", but none for Zubac (his 59 lines: Points,
  Rebounds, Assists, combos, Blocks, Steals, Turnovers, Fantasy). PrizePicks
  keeps quarters/halves in their own leagues (NBA1Q 192: 1,061 lines of
  Points/Rebounds/Assists; NBA1H 84; NBA2H 80; NBA4Q 149), which
  `_nba_board` never reads (it reads league 7 only), so the board has no
  NBA 1Q/1H lines although periods.py could chart them. Not fixed yet.
  PrizePicks posts Dunks only some nights (the owner's Zubac page had no
  Dunks tab), so an NBA page now offers Dunks from his game logs on a night
  with no Dunks line (`trend-data.js researchRows`, `researchOnly` rows):
  chip with no line, chart starting at the half nearest his last-10 average
  (adjustable with -/+, lines menu "No lines"), banner "Dunks · No
  PrizePicks line tonight" and no Analyze. The shared panel (`app.js`
  vortexTrendPanel.update) now redraws its chips when the stat list
  changes without a market change (they used to stay as first drawn).
- Props lists are a clean table (Oct 24; the owner had picked cards on Oct
  23, then "hate the cards look", and chose the table over grouping by
  game or the old list; `MatchupList.jsx` PropRow, `.nm-table`): headings
  once (Player, Line, Matchup, Last 10, Prop grade; the last three sort,
  like the sort buttons), one slim row per prop (61px desktop, ~71px phone),
  each number with its meaning under it, an arrow column for Why, which
  opens under the row. Rows and headings share `--nm-cols`, so the columns
  line up (checked at 360/393/1440). On phones the line goes under the
  name, the headings shorten (Match, L10, Prop) and the position is
  dropped from the game line. Don't bring back boxes or tiles.
  Oct 24, from the owner: Starter or Bench at the front of each NBA row's
  game line and in the matchup page header (`src/lineup-role.js`, from
  league-context `rotation`: lastStart = in the five who started his team's
  last game; it's not tonight's announced lineup, the Why says so). A
  Demon shows PrizePicks' Demon icon (`public/prizepicks/demon-64.png`, a
  5 KB copy of the 286 KB original) instead of the word. The owner asked
  why a 43% Demon was "Elite": the grade measures the chance against what
  the line needs (`slip-check.js baselineOf`: 50% regular; Demon/Goblin the
  books' chance at that line where priced, else 35% / 70%), so Prop shows
  "needs 35%" under a Demon's or Goblin's grade and the Why spells it out
  (`props-grade.js` returns `needs` and `priced`). The game menu is our own
  (GamePicker: logos, time, prop count, keys, outside tap) and a game is its
  two teams on the day, so lines posted at 6:30 and 6:40 are one game.
  Photos: `src/photo-url.js` asks ESPN's resizer for 208x152 (the 1040px
  originals came out jagged in 44-52px circles), falling back to the full
  photo, then initials. The resizer URL couldn't be checked from the
  container (ESPN blocked): if photos show initials live, check it first.
- Prop grade on the Props lists (Oct 22, `src/props-grade.js`): a third
  number a row, the over at tonight's line as the Analyzer grades it
  (`slip-check.js gradeLeg`: prop model on his games and role, the matchup
  case on top, `learning.js` calibration, Demons against what they pay),
  without tonight's game news (the player page / Analyze add that). Shown
  as a chance with the tier (Elite..Fade), sortable ("Prop grade"),
  explained first in Why. It's what RotoBot's "matchup" number really is
  (its assistant says it mixes form, role, odds, injuries and a
  projection), kept beside our pure matchup score. Not backtestable on
  free data (no past PrizePicks lines). Phone layout: four cells a row,
  checked at 360/393px.
- "Who guards him" on the Props page: his pts/75 against a defender with
  under 25 possessions is grey and never the "toughest" (McCain read 73.8
  against Braun on about 16).
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
