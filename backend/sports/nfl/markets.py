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
    # Ball carriers
    ("rushing_yards", "Rush Yards", "RUSH"),
    ("rush_attempts", "Rush Attempts", "CAR"),
    ("rush_yards_first_5", "Rush Yards in First 5 Attempts", "RUSH 5"),
    ("longest_rush", "Longest Rush", "LNG RUSH"),
    # Receivers
    ("receptions", "Receptions", "REC"),
    ("targets", "Targets", "TGT"),
    ("receiving_yards", "Receiving Yards", "REC YD"),
    ("longest_reception", "Longest Reception", "LNG"),
    ("rec_yards_first_2", "Receiving Yards in First 2 Receptions", "REC 2"),
    ("rushing_receiving_yards", "Rush + Rec Yds", "R+R"),
    ("touchdowns", "Rush + Rec TDs", "TD"),
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
    # Punters
    ("punts_inside_20", "Punts Inside 20", "IN 20"),
    ("gross_punt_yards", "Gross Punt Yards", "PUNT YD"),
    ("punts_50_plus", "50+ Yard Punts", "50+"),
    # Defense
    ("tackles", "Total Tackles", "TKL"),
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
    "anytimetd": "touchdowns", "anytimetouchdown": "touchdowns", "touchdowns": "touchdowns", "tds": "touchdowns",
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


def market_for(stat, position=""):
    """Our market key for a PrizePicks stat_type, or None when we have no
    history for it (the line still shows, just without a chart)."""
    name = normalize(stat)
    position = str(position or "").upper()
    if name in ("int", "ints", "interceptions"):
        return "interceptions" if position == "QB" else "def_interceptions"
    if name in ("fantasyscore", "fantasypoints") and position == "K":
        return "kicker_fantasy"
    if name == "sacks" and position == "QB":
        return None  # Sacks taken -- not charted.
    return ALIASES.get(name)
