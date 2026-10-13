"""Every NFL prop market the Finder charts, and how PrizePicks names them.

One catalog for the board (prizepicks_board.py), the per-game values
(finder.py) and the player page's stat tabs. Keys that already existed keep
their names, so saved slips and the Research tab still recognize them.
"""
import re

# (key, label, short code for the stat tabs)
MARKETS = (
    # Quarterbacks
    ("passing_yards", "Pass Yards", "PASS"),
    ("passing_touchdowns", "Pass TDs", "PTD"),
    ("passing_attempts", "Pass Attempts", "ATT"),
    ("pass_completions", "Pass Completions", "CMP"),
    ("interceptions", "Pass INTs", "INT"),
    ("longest_completion", "Longest Completion", "LNG CMP"),
    ("passing_rushing_yards", "Pass + Rush Yds", "P+R"),
    ("sacks_taken", "Sacks Taken", "SACKED"),
    ("pass_rush_rec_tds", "Pass + Rush + Rec TDs", "PRR TD"),
    ("completion_pct", "Completion Percentage", "CMP%"),
    ("quarters_25_pass_yds", "Quarters with 25+ Pass Yards", "Q 25+ PASS"),
    # Ball carriers
    ("rushing_yards", "Rush Yards", "RUSH"),
    ("rush_attempts", "Rush Attempts", "CAR"),
    ("rush_yards_first_5", "Rush Yards in First 5 Attempts", "RUSH 5"),
    ("longest_rush", "Longest Rush", "LNG RUSH"),
    ("rushing_tds", "Rush TDs", "RUSH TD"),
    ("yards_per_carry", "Rush Yards Per Carry", "YPC"),
    ("first_rush_yards", "Yards on First Rush Attempt", "1ST RUSH"),
    ("quarters_5_rush_yds", "Quarters with 5+ Rush Yards", "Q 5+ RUSH"),
    ("halves_25_rush_yds", "Halves with 25+ Rush Yards", "H 25+ RUSH"),
    # Receivers
    ("receptions", "Receptions", "REC"),
    ("targets", "Targets", "TGT"),
    ("receiving_yards", "Receiving Yards", "REC YD"),
    ("longest_reception", "Longest Reception", "LNG"),
    ("rec_yards_first_2", "Receiving Yards in First 2 Receptions", "REC 2"),
    ("receiving_tds", "Rec TDs", "REC TD"),
    ("quarters_1_rec", "Quarters with 1+ Reception", "Q 1+ REC"),
    ("quarters_5_rec_yds", "Quarters with 5+ Receiving Yards", "Q 5+ REC YD"),
    ("halves_25_rec_yds", "Halves with 25+ Receiving Yards", "H 25+ REC YD"),
    ("rushing_receiving_yards", "Rush + Rec Yds", "R+R"),
    ("touchdowns", "Rush + Rec TDs", "TD"),
    ("fumbles_lost", "Fumbles Lost", "FUM"),
    ("fantasy_score", "Fantasy Score", "FS"),
    # Kickers
    ("fg_made", "FG Made", "FGM"),
    ("fg_attempts", "FG Attempts", "FGA"),
    ("fg_yards", "FG Yards", "FG YD"),
    ("kicking_points", "Kicking Points", "KP"),
    ("kicker_fantasy", "Kicker Fantasy Score", "K FS"),
    ("longest_fg", "Longest FG Made", "LNG FG"),
    ("shortest_fg", "Shortest FG Made", "SHT FG"),
    ("pat_attempts", "PAT Attempts", "PAT"),
    ("pat_made", "PAT Made", "XP"),
    # Punters
    ("punts", "Punts", "PUNTS"),
    ("punts_inside_20", "Punts Inside 20", "IN 20"),
    ("gross_punt_yards", "Gross Punt Yards", "PUNT YD"),
    ("punts_50_plus", "50+ Yard Punts", "50+"),
    # Defense
    ("tackles", "Total Tackles", "TKL"),
    ("solo_tackles", "Solo Tackles", "SOLO"),
    ("sacks", "Sacks", "SACK"),
    ("tackles_for_loss", "Tackles for Loss", "TFL"),
    ("def_interceptions", "Interceptions", "D INT"),
)
LABELS = {key: label for key, label, _code in MARKETS}
CODES = {key: code for key, _label, code in MARKETS}
ORDER = {key: index for index, (key, *_rest) in enumerate(MARKETS)}

OFFENSE = {"QB", "RB", "FB", "WR", "TE"}
SPECIALISTS = {"K", "P", "LS"}


def normalize(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


# PrizePicks' stat_type spellings (and the variants seen over time), keyed by
# their normalized form. Position-dependent names are resolved below.
ALIASES = {
    "passyards": "passing_yards", "passingyards": "passing_yards", "passyds": "passing_yards",
    "passtds": "passing_touchdowns", "passingtds": "passing_touchdowns", "passtouchdowns": "passing_touchdowns",
    "passingtouchdowns": "passing_touchdowns",
    "passattempts": "passing_attempts", "passingattempts": "passing_attempts", "passatt": "passing_attempts",
    "passcompletions": "pass_completions", "completions": "pass_completions", "passcmp": "pass_completions",
    "passints": "interceptions", "passinterceptions": "interceptions", "intthrown": "interceptions",
    "interceptionsthrown": "interceptions",
    "longestcompletion": "longest_completion", "longestpass": "longest_completion", "longestpasscompletion": "longest_completion",
    "passrushyds": "passing_rushing_yards", "passrushyards": "passing_rushing_yards",
    "passingrushingyards": "passing_rushing_yards", "passingandrushingyards": "passing_rushing_yards",
    "rushyards": "rushing_yards", "rushingyards": "rushing_yards", "rushyds": "rushing_yards",
    "rushattempts": "rush_attempts", "rushingattempts": "rush_attempts", "carries": "rush_attempts", "rushatt": "rush_attempts",
    "rushyardsinfirst5attempts": "rush_yards_first_5", "rushyardsfirst5attempts": "rush_yards_first_5",
    "rushydsinfirst5attempts": "rush_yards_first_5", "rushyardsfirst5": "rush_yards_first_5",
    "longestrush": "longest_rush", "longestrushingattempt": "longest_rush",
    "receptions": "receptions", "rec": "receptions",
    "targets": "targets", "rectargets": "targets", "receivingtargets": "targets",
    "receivingyards": "receiving_yards", "recyards": "receiving_yards", "recyds": "receiving_yards",
    "longestreception": "longest_reception", "longestrec": "longest_reception",
    "receivingyardsinfirst2receptions": "rec_yards_first_2", "recyardsinfirst2receptions": "rec_yards_first_2",
    "receivingyardsfirst2receptions": "rec_yards_first_2", "recydsinfirst2receptions": "rec_yards_first_2",
    "rushrecyds": "rushing_receiving_yards", "rushrecyards": "rushing_receiving_yards",
    "rushingreceivingyards": "rushing_receiving_yards", "rushingandreceivingyards": "rushing_receiving_yards",
    "rushrectds": "touchdowns", "rushingreceivingtds": "touchdowns", "rushingandreceivingtds": "touchdowns",
    "anytimetd": "touchdowns", "anytimetouchdown": "touchdowns", "anytimetds": "touchdowns", "anytimetouchdowns": "touchdowns",
    "passrushrectds": "pass_rush_rec_tds", "passingrushingreceivingtds": "pass_rush_rec_tds", "passrushrectouchdowns": "pass_rush_rec_tds",
    "completionpercentage": "completion_pct", "completionpct": "completion_pct", "cmppct": "completion_pct",
    "rushyardspercarry": "yards_per_carry", "rushingyardspercarry": "yards_per_carry", "yardspercarry": "yards_per_carry",
    "yardsonfirstrushattempt": "first_rush_yards", "rushyardsonfirstattempt": "first_rush_yards", "firstrushattemptyards": "first_rush_yards",
    "quarterswith1reception": "quarters_1_rec", "quarterswith1receptions": "quarters_1_rec",
    "quarterswith5receivingyards": "quarters_5_rec_yds", "quarterswith5recyards": "quarters_5_rec_yds",
    "quarterswith5rushyards": "quarters_5_rush_yds", "quarterswith5rushingyards": "quarters_5_rush_yds",
    "quarterswith25passyards": "quarters_25_pass_yds", "quarterswith25passingyards": "quarters_25_pass_yds",
    "halveswith25receivingyards": "halves_25_rec_yds", "halveswith25recyards": "halves_25_rec_yds",
    "halveswith25rushyards": "halves_25_rush_yds", "halveswith25rushingyards": "halves_25_rush_yds", "touchdowns": "touchdowns", "tds": "touchdowns",
    "fantasyscore": "fantasy_score", "fantasypoints": "fantasy_score",
    "fgmade": "fg_made", "fieldgoalsmade": "fg_made", "fieldgoalmade": "fg_made",
    "fgattempts": "fg_attempts", "fgattempted": "fg_attempts", "fieldgoalattempts": "fg_attempts",
    "fieldgoalsattempted": "fg_attempts",
    "fgyards": "fg_yards", "fgyds": "fg_yards", "fieldgoalyards": "fg_yards", "totalfgyards": "fg_yards",
    "kickingpoints": "kicking_points", "kickingpts": "kicking_points",
    "kickerfantasyscore": "kicker_fantasy", "kfantasyscore": "kicker_fantasy",
    "longestfgmade": "longest_fg", "longestfieldgoalmade": "longest_fg", "longestfg": "longest_fg",
    "shortestfgmade": "shortest_fg", "shortestfieldgoalmade": "shortest_fg", "shortestfg": "shortest_fg",
    "patattempts": "pat_attempts", "patattempted": "pat_attempts", "extrapointattempts": "pat_attempts",
    "xpattempts": "pat_attempts",
    "punts": "punts", "puntattempts": "punts", "totalpunts": "punts", "numberofpunts": "punts",
    "sackstaken": "sacks_taken", "timessacked": "sacks_taken", "qbsackstaken": "sacks_taken",
    "rushtds": "rushing_tds", "rushingtds": "rushing_tds", "rushingtouchdowns": "rushing_tds", "rushtouchdowns": "rushing_tds",
    "rectds": "receiving_tds", "receivingtds": "receiving_tds", "receivingtouchdowns": "receiving_tds",
    "fumbleslost": "fumbles_lost",
    "patmade": "pat_made", "patsmade": "pat_made", "extrapointsmade": "pat_made", "xpmade": "pat_made",
    "solotackles": "solo_tackles",
    "puntsinside20": "punts_inside_20", "puntsinsidethe20": "punts_inside_20",
    "grosspuntyards": "gross_punt_yards", "grosspuntyds": "gross_punt_yards", "puntyards": "gross_punt_yards",
    "50yardpunts": "punts_50_plus", "50ydpunts": "punts_50_plus", "50pluspunts": "punts_50_plus",
    "50pluspuntyards": "punts_50_plus", "puntsof50yards": "punts_50_plus",
    "tacklesast": "tackles", "tacklesassists": "tackles", "tacklesandassists": "tackles", "totaltackles": "tackles",
    "tackles": "tackles",
    "sacks": "sacks", "defensivesacks": "sacks",
    "tacklesforloss": "tackles_for_loss", "tfl": "tackles_for_loss",
    "defensiveinterceptions": "def_interceptions",
}


# What a slip may print around the stat itself: Underdog's "25+ Rush Yards"
# (the Over on 24.5), and the pick's side and line read into the stat
# ("Higher 3.5 Receptions").
_SIDE = r"(?:more|less|higher|lower|over|under|o|u)"
_AROUND = (re.compile(rf"^\s*(?:{_SIDE}\s*)?[-+]?\d+(?:\.\d+)?\s*\+?\s+", re.I), re.compile(r"\s+\d+(?:\.\d+)?\s*\+\s*$"),
           re.compile(rf"^\s*{_SIDE}\s+", re.I), re.compile(rf"\s+{_SIDE}\s*$", re.I))


def bare_stat(stat):
    """The stat's own name, without a threshold, side or line printed with it."""
    text = str(stat or "")
    for pattern in _AROUND:
        text = pattern.sub(" ", text)
    return text.strip() or str(stat or "")


def market_for(stat, position=""):
    """Our market key for a PrizePicks stat_type, or None when we have no
    history for it (the line still shows, just without a chart)."""
    name = normalize(bare_stat(stat))
    position = str(position or "").upper()
    if name in ("int", "ints", "interceptions"):
        return "interceptions" if position == "QB" else "def_interceptions"
    if name in ("fantasyscore", "fantasypoints") and position == "K":
        return "kicker_fantasy"
    if name == "sacks" and position == "QB":
        return "sacks_taken"  # A quarterback's sacks are the ones he took.
    return ALIASES.get(name)
