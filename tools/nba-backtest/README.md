# NBA matchup score backtest

The scripts behind `src/nba-matchup-score.js`'s weights. Not part of the site.

Data: sportsdataverse's ESPN box scores (`player_box_YYYY.csv`,
`team_box_YYYY.csv`; 2024 is read for last season's averages), in the
folder `NBA_DATA` names. Needs pandas, numpy and scikit-learn.

1. `build.py`: every 2024-25 and 2025-26 regular-season player-game with
   15+ minutes, the opponent's reads as they stood that morning, and
   whether he beat his own average → `games.pkl`.
2. `build2.py`: who's out on each side (recent rotation players who sat),
   back-to-backs, the opponent's last 10 games → `extra.pkl`.
3. `fit5.py`: each new read on its own, per season (does its sign hold?).
4. `fit7.py`: the final reads fitted together, absences centred on a
   usual night; prints the weights, centres and scale K
   (`weights_v2.json`) and the out-of-sample bands.
5. `h2h.py` / `h2h2.py`: threes and blocks, his last three games against
   them (the meetings read), and its weight on the current scale.
6. `combos.py`: combos as the even average of their parts vs weighted by
   his stat mix (even read better).

7. `chances.py`: the rebound and assist chance numbers (misses, crashing,
   baskets allowed, % assisted): do they predict overs on top of the score?

Run from this folder (`fit*.py` read the `.pkl` files and each other).
