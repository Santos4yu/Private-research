"""Research for the Finder's NFL player page (src/sports/nfl/NFLPlayerPage.jsx).

The page is the WNBA/MLB player page's layout with NFL data, and this module
plays the part api/wnba.py's resources play for WNBA: every number is read
from nflverse's published season files -- weekly player and team stats, the
schedule (which carries each game's closing moneyline, spread and total),
depth charts, injury reports, rosters and play-by-play. Nothing is estimated.

Each function returns a finished JSON payload, cached whole (cache.py), so a
warm instance answers from memory and a cold one from the durable store.
Play-by-play is the one heavy file, so what only it can supply (red-zone
targets, longest plays) is a separate resource the page merges in when it
arrives, rather than something every other card waits for.
"""
from __future__ import annotations

import csv
import gzip
import io
from collections import defaultdict
from datetime import datetime, timezone
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from .cache import NFLCacheDomain, cached_nfl
from .services.nflverse import RELEASE, SCHEDULE_URL, TEAM_URL, ProviderError, _source_rows, canonical_team
from .services.research_stats import numeric, prizepicks_fantasy

VERSION = "nfl-finder-v3"
USER_AGENT = {"User-Agent": "KrazyData-NFL-finder/1.0"}

CONFERENCES = {
    "AFC East": ("BUF", "MIA", "NE", "NYJ"), "AFC North": ("BAL", "CIN", "CLE", "PIT"),
    "AFC South": ("HOU", "IND", "JAX", "TEN"), "AFC West": ("DEN", "KC", "LAC", "LV"),
    "NFC East": ("DAL", "NYG", "PHI", "WAS"), "NFC North": ("CHI", "DET", "GB", "MIN"),
    "NFC South": ("ATL", "CAR", "NO", "TB"), "NFC West": ("ARI", "LAR", "SEA", "SF"),
}
DIVISION = {team: division for division, teams in CONFERENCES.items() for team in teams}
TEAM_CODES = tuple(sorted(DIVISION))


def logo(team):
    # The same mark the Finder's rows use (src/sports/nfl/nfl-ui-core.js).
    return f"https://static.www.nfl.com/t_q-best/league/api/clubs/logos/{team}.svg" if team else ""


def _n(row, key):
    return numeric(row.get(key))


def _int(value):
    return int(value) if isinstance(value, float) and value.is_integer() else value


def _sum(row, *keys):
    values = [_n(row, key) for key in keys]
    return None if any(value is None for value in values) else sum(values)


# ------------------------------------------------------------------ sources

def _rows(url):
    try:
        return _source_rows(url)[0]
    except Exception:  # noqa: BLE001 -- a season not published yet has no rows
        return []


def player_rows(season):
    return _rows(f"{RELEASE}/stats_player/stats_player_week_{season}.csv")


_player_index = {}


def player_games(season, player_id):
    """One player's weekly rows. Indexed once per loaded season file, so a
    board with hundreds of players does not rescan every row for each one."""
    rows = player_rows(season)
    cached = _player_index.get(season)
    if not cached or cached[0] is not rows:
        index = defaultdict(list)
        for row in rows:
            index[row.get("player_id")].append(row)
        cached = _player_index[season] = (rows, index)
    return cached[1].get(player_id, [])


def team_rows(season):
    return _rows(f"{RELEASE}/stats_team/stats_team_week_{season}.csv")


def roster_rows(season):
    return _rows(f"{RELEASE}/rosters/roster_{season}.csv")


def schedule_rows():
    return _rows(SCHEDULE_URL)


def team_names(season):
    names = {}
    for row in _rows(TEAM_URL):
        if str(row.get("season")) == str(season) and row.get("full"):
            names[canonical_team(row.get("team"))] = row["full"]
    return names


# ------------------------------------------------------------------ games

SEASON_KIND = {"REG": "regular", "WC": "postseason", "DIV": "postseason", "CON": "postseason", "SB": "postseason"}


def _starts_at(row):
    """Kickoff in UTC. The schedule's times are US Eastern."""
    try:
        local = datetime.strptime(f"{row.get('gameday')} {row.get('gametime') or '00:00'}", "%Y-%m-%d %H:%M")
    except (TypeError, ValueError):
        return None
    # Eastern is UTC-4 from the second Sunday of March to the first Sunday of
    # November; every NFL regular season and postseason game falls on one
    # side of that line or the other, so this is exact for the schedule.
    year = local.year
    march = datetime(year, 3, 8 + (6 - datetime(year, 3, 8).weekday()) % 7, 2)
    november = datetime(year, 11, 1 + (6 - datetime(year, 11, 1).weekday()) % 7, 2)
    offset = 4 if march <= local < november else 5
    return (local.replace(tzinfo=timezone.utc).timestamp() + offset * 3600)


_games_memo = [None, None]


def games_index():
    """game_id -> the schedule row, with its kickoff and a final flag.
    Rebuilt only when the schedule file itself is reloaded."""
    rows = schedule_rows()
    if _games_memo[0] is rows and _games_memo[1] is not None:
        return _games_memo[1]
    index = {}
    for row in rows:
        game_id = row.get("game_id")
        if not game_id or str(row.get("game_type") or "").upper() not in SEASON_KIND:
            continue
        final = row.get("home_score") not in (None, "", "NA") and row.get("away_score") not in (None, "", "NA")
        index[game_id] = {**row, "home": canonical_team(row.get("home_team")), "away": canonical_team(row.get("away_team")),
                          "kickoff": _starts_at(row), "final": final}
    _games_memo[:] = [rows, index]
    return index


def team_view(game, team):
    """One game from `team`'s side: opponent, home/away, result and score."""
    home = game["home"] == team
    opponent = game["away"] if home else game["home"]
    view = {"gameId": game["game_id"], "season": int(game["season"]), "week": int(game["week"]),
            "seasonKind": SEASON_KIND[str(game["game_type"]).upper()], "date": game.get("gameday") or "",
            "team": team, "opponent": opponent, "isHome": home, "result": None, "score": ""}
    if game["final"]:
        own, other = (int(float(game["home_score"])), int(float(game["away_score"])))[:: 1 if home else -1]
        view["result"] = "W" if own > other else "L" if own < other else "T"
        view["score"] = f"{own}-{other}"
    return view


def _team_games(games, season, team, final_only=True):
    return sorted((game for game in games.values() if str(game["season"]) == str(season) and team in (game["home"], game["away"])
                   and (game["final"] or not final_only)), key=lambda game: game["kickoff"] or 0)


# ------------------------------------------------------------------ player values

# A prop market -> the weekly-stats columns it adds up. Longest reception and
# red-zone targets only exist in play-by-play (pbp_extras below).
MARKET_FIELDS = {
    "passing_yards": ("passing_yards",), "passing_attempts": ("attempts",), "pass_completions": ("completions",),
    "passing_touchdowns": ("passing_tds",), "interceptions": ("passing_interceptions",),
    "rushing_yards": ("rushing_yards",), "rush_attempts": ("carries",),
    "passing_rushing_yards": ("passing_yards", "rushing_yards"),
    "receiving_yards": ("receiving_yards",), "receptions": ("receptions",), "targets": ("targets",),
    "rushing_receiving_yards": ("rushing_yards", "receiving_yards"), "touchdowns": ("rushing_tds", "receiving_tds"),
    "sacks_taken": ("sacks_suffered",), "rushing_tds": ("rushing_tds",), "receiving_tds": ("receiving_tds",),
    "fumbles_lost": ("fumbles_lost_total",),
}
BOX_FIELDS = (
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "sacks_suffered",
    "carries", "rushing_yards", "rushing_tds", "receptions", "targets", "receiving_yards", "receiving_tds",
    "def_tackles_solo", "def_tackle_assists", "def_sacks", "def_interceptions", "def_pass_defended",
    "fg_made", "fg_att", "pat_made", "pt_att", "fumbles_lost_total",
)


# PrizePicks' kicker fantasy scoring: 3 points for a field goal under 40
# yards, 4 for 40-49, 5 for 50+, and 1 per extra point.
KICKER_BUCKETS = (("fg_made_0_19", 3), ("fg_made_20_29", 3), ("fg_made_30_39", 3),
                  ("fg_made_40_49", 4), ("fg_made_50_59", 5), ("fg_made_60_", 5))


def _fg_made_distances(row):
    """Each made field goal's distance ("25;43;32")."""
    parts = str(row.get("fg_made_list") or "").replace(",", ";").split(";")
    return [value for value in (numeric(part.strip()) for part in parts) if value is not None]


def _kicking(row):
    made, attempts, pats, pat_attempts = (_n(row, key) for key in ("fg_made", "fg_att", "pat_made", "pat_att"))
    if str(row.get("position") or "").upper() != "K" and not (attempts or pat_attempts):
        return {}
    if attempts is None and pat_attempts is None:
        return {}
    made, attempts, pats, pat_attempts = (value or 0 for value in (made, attempts, pats, pat_attempts))
    distances = _fg_made_distances(row)
    buckets = [_n(row, key) for key, _points in KICKER_BUCKETS]
    if any(count is not None for count in buckets):
        fg_points = sum((count or 0) * points for count, (_key, points) in zip(buckets, KICKER_BUCKETS))
    else:
        fg_points = sum(3 if distance < 40 else 4 if distance < 50 else 5 for distance in distances)
    return {
        "fg_made": made, "fg_attempts": attempts, "pat_attempts": pat_attempts, "pat_made": pats,
        "fg_yards": sum(distances) if distances else (_n(row, "fg_made_distance") or 0),
        "kicking_points": made * 3 + pats, "kicker_fantasy": fg_points + pats,
        "longest_fg": max(distances) if distances else (0 if not made else _n(row, "fg_long")),
        # No made field goal has no shortest one.
        "shortest_fg": min(distances) if distances else None,
    }


def _defense(row):
    solo, with_assist, assists = (_n(row, key) for key in ("def_tackles_solo", "def_tackles_with_assist", "def_tackle_assists"))
    if solo is None and with_assist is None and assists is None:
        return {}
    # Solo tackles plus every assisted one the player took part in -- the
    # combined total a tackles prop settles on.
    return {"tackles": (solo or 0) + (with_assist or 0) + (assists or 0), "solo_tackles": solo or 0, "sacks": _n(row, "def_sacks") or 0,
            "tackles_for_loss": _n(row, "def_tackles_for_loss") or 0,
            "def_interceptions": _n(row, "def_interceptions") or 0}


def market_values(row):
    values = {market: _int(_sum(row, *fields)) for market, fields in MARKET_FIELDS.items()}
    values["fantasy_score"] = prizepicks_fantasy(row)
    values.update({key: _int(value) for key, value in {**_kicking(row), **_defense(row)}.items()})
    return values


def box(row):
    stats = {field: _int(_n(row, field)) for field in BOX_FIELDS}
    stats["fantasy"] = prizepicks_fantasy(row)
    return stats


def _involved(row):
    """Did the player record anything? A row with no stat at all is a
    special-teams snap or an inactive listing, not a game played."""
    return any((_n(row, key) or 0) > 0 for key in (
        "attempts", "carries", "targets", "receptions", "def_tackles_solo", "def_tackle_assists", "def_sacks",
        "fg_att", "pat_att", "pt_att", "punt_returns", "kickoff_returns"))


# ------------------------------------------------------------------ player game log

def player_log(season, player_id):
    """The player's games this season and last, oldest first, with a DNP row
    for each of his team's finished games he missed between appearances."""
    return cached_nfl(NFLCacheDomain.GAME_LOGS, (VERSION, "log", season, player_id),
                      lambda: _player_log_rows(season, player_id))


def _player_log_rows(season, player_id):
    """player_log() without its cache -- the board computes hundreds of these
    at once from files already in memory."""
    games = games_index()
    rows, player = [], None
    for year in (season - 1, season):
        played = [row for row in player_games(year, player_id)
                  if str(row.get("season_type")).upper() in ("REG", "POST") and row.get("game_id")]
        played.sort(key=lambda row: (games.get(row["game_id"], {}).get("kickoff") or 0))
        seen = set()
        for row in played:
            game = games.get(row["game_id"])
            team = canonical_team(row.get("team"))
            if not game or row["game_id"] in seen:
                continue
            seen.add(row["game_id"])
            player = {"id": player_id, "name": row.get("player_display_name") or row.get("player_name") or "",
                      "position": row.get("position") or "", "team": team, "headshot": row.get("headshot_url") or ""}
            rows.append({**team_view(game, team), "dnp": False, "box": box(row), "values": market_values(row)})
        # Missed games: the team he was with at the time, from his first
        # game of the season to his last (or to now, this season).
        if not seen:
            continue
        appearances = [games[game_id] for game_id in seen]
        first = min(game["kickoff"] or 0 for game in appearances)
        last = max(game["kickoff"] or 0 for game in appearances)
        teams = {canonical_team(row.get("team")) for row in played}
        for team in teams:
            for game in _team_games(games, year, team):
                kickoff = game["kickoff"] or 0
                if game["game_id"] in seen or kickoff < first or (kickoff > last and year != season):
                    continue
                # Traded mid-season: only the games while he was there.
                with_team = [row for row in played if canonical_team(row.get("team")) == team]
                span = [games[row["game_id"]]["kickoff"] or 0 for row in with_team if row["game_id"] in games]
                if len(teams) > 1 and not (min(span) <= kickoff <= max(span)):
                    continue
                rows.append({**team_view(game, team), "dnp": True, "box": {}, "values": {}})
    rows.sort(key=lambda row: (row["date"], row["gameId"]))
    return {"season": season, "player": player, "rows": rows, "version": VERSION}


# ------------------------------------------------------------------ play-by-play extras

PBP_FIELDS = ("game_id", "season_type", "posteam", "defteam", "play_type", "yardline_100", "pass_attempt", "sack",
              "complete_pass", "receiver_player_id", "receiving_yards", "rush_attempt", "rusher_player_id",
              "rushing_yards", "two_point_attempt", "passer_player_id", "passing_yards", "punt_attempt",
              "punter_player_id", "kick_distance", "punt_inside_twenty")

# A prop market -> the play-by-play summary field it reads (see
# _aggregate_pbp). A game the file covers but the player had none of counts
# as 0, which is how these props settle.
PBP_MARKETS = {"longest_reception": "longestReception", "longest_rush": "longestRush",
               "longest_completion": "longestCompletion", "rush_yards_first_5": "rushFirst5",
               "rec_yards_first_2": "recFirst2", "punts": "punts", "punts_inside_20": "puntsIn20",
               "gross_punt_yards": "puntYards", "punts_50_plus": "punts50"}


def _team_entry():
    return {"rzTargets": 0, "longestReception": None, "longestRush": None, "longestCompletion": None}


def _aggregate_pbp(records):
    """Per player-game and per team-game numbers that only exist play by
    play. Plays arrive in game order, which is what "first 5 rushes" and
    "first 2 receptions" count."""
    players, teams = defaultdict(dict), defaultdict(dict)

    def player(player_id, game_id, team):
        entry = players[player_id].setdefault(game_id, {"team": team})
        return entry

    def team(team_id, game_id):
        return teams[team_id].setdefault(game_id, _team_entry())

    def high(entry, field, value):
        if value is not None and (entry.get(field) is None or value > entry[field]):
            entry[field] = value

    def present(value):
        return value not in (None, "", "NA")

    for row in records:
        if str(row.get("season_type")).upper() not in ("REG", "POST") or _n(row, "two_point_attempt") == 1:
            continue
        game_id, posteam = row.get("game_id"), canonical_team(row.get("posteam"))
        if not game_id or not posteam:
            continue
        if _n(row, "punt_attempt") == 1:
            punter, distance = row.get("punter_player_id"), _n(row, "kick_distance")
            if present(punter):
                entry = player(punter, game_id, posteam)
                entry["punts"] = entry.get("punts", 0) + 1
                entry["puntYards"] = entry.get("puntYards", 0) + (distance or 0)
                entry["puntsIn20"] = entry.get("puntsIn20", 0) + int(_n(row, "punt_inside_twenty") == 1)
                entry["punts50"] = entry.get("punts50", 0) + int((distance or 0) >= 50)
            team(posteam, game_id)
            continue
        if _n(row, "pass_attempt") == 1 and _n(row, "sack") != 1:
            receiver, passer = row.get("receiver_player_id"), row.get("passer_player_id")
            yardline = _n(row, "yardline_100")
            team_game = team(posteam, game_id)
            if present(receiver) and yardline is not None and yardline <= 20:
                entry = player(receiver, game_id, posteam)
                entry["rzTargets"] = entry.get("rzTargets", 0) + 1
                team_game["rzTargets"] += 1
            if _n(row, "complete_pass") == 1:
                yards = _n(row, "receiving_yards")
                if present(receiver):
                    entry = player(receiver, game_id, posteam)
                    high(entry, "longestReception", yards)
                    if entry.get("catches", 0) < 2:
                        entry["recFirst2"] = entry.get("recFirst2", 0) + (yards or 0)
                    entry["catches"] = entry.get("catches", 0) + 1
                if present(passer):
                    high(player(passer, game_id, posteam), "longestCompletion", _n(row, "passing_yards"))
                high(team_game, "longestCompletion", yards)
        elif _n(row, "rush_attempt") == 1:
            rusher, yards = row.get("rusher_player_id"), _n(row, "rushing_yards")
            team_game = team(posteam, game_id)
            if present(rusher):
                entry = player(rusher, game_id, posteam)
                high(entry, "longestRush", yards)
                if entry.get("rushes", 0) < 5:
                    entry["rushFirst5"] = entry.get("rushFirst5", 0) + (yards or 0)
                entry["rushes"] = entry.get("rushes", 0) + 1
            high(team_game, "longestRush", yards)
    # A team's "Longest Reception" is what a Longest Reception prop adds up
    # across its receivers: each one's longest catch in the game, summed.
    # Its single longest play through the air is Longest Completion.
    for games in players.values():
        for game_id, entry in games.items():
            if entry.get("team") and entry.get("longestReception") is not None:
                team_game = team(entry["team"], game_id)
                team_game["longestReception"] = (team_game["longestReception"] or 0) + entry["longestReception"]
    return {"players": players, "teams": teams}


def pbp_extras(season):
    def load():
        url = f"{RELEASE}/pbp/play_by_play_{season}.csv.gz"
        try:
            with urlopen(Request(url, headers=USER_AGENT), timeout=40) as response:
                reader = csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=response), encoding="utf-8-sig"))
                if not set(PBP_FIELDS).issubset(reader.fieldnames or []):
                    raise ProviderError("Play-by-play is missing a required column")
                result = _aggregate_pbp(reader)
        except HTTPError as error:
            # Not published yet for this season: nothing to add. Anything
            # else (a dropped connection) raises, so an outage is never
            # cached as "no plays".
            if error.code != 404:
                raise
            result = {"players": {}, "teams": {}}
        return {"players": dict(result["players"]), "teams": dict(result["teams"])}
    return cached_nfl(NFLCacheDomain.PLAY_BY_PLAY, (VERSION, "pbp", season), load)


def pbp_values(season, player_id, log=None):
    """gameId -> the play-by-play markets for each game the player played,
    this season and last. Games the file does not cover yet are left out."""
    values = {}
    for row in (log or player_log(season, player_id))["rows"]:
        if row["dnp"]:
            continue
        extras = pbp_extras(row["season"])
        covered = row["gameId"] in extras["teams"].get(row["team"], {})
        entry = extras["players"].get(player_id, {}).get(row["gameId"])
        if entry is None and not covered:
            continue
        entry = entry or {}
        values[row["gameId"]] = {market: entry.get(field) if entry.get(field) is not None else 0
                                 for market, field in PBP_MARKETS.items()}
    return values


def game_values(season, player_id, cached=True):
    """The player's played games, oldest first, each with every market's
    value: weekly stats plus play-by-play."""
    log = player_log(season, player_id) if cached else _player_log_rows(season, player_id)
    extra = pbp_values(season, player_id, log)
    return [{**row, "values": {**row["values"], **extra.get(row["gameId"], {})}}
            for row in log["rows"] if not row["dnp"]]


PBP_TEAM_STATS = (("longest_reception", "Longest Reception", "longestReception"),
                  ("redzone_targets", "Redzone Targets", "rzTargets"),
                  ("longest_rush", "Longest Rush", "longestRush"),
                  ("longest_completion", "Longest Completion", "longestCompletion"))


def pbp_resource(season, player_id):
    """The player's per-game extras for this season and last, plus this
    season's play-by-play team ranks for the Offense vs Defense card."""
    games = {}
    for year in (season - 1, season):
        games.update(pbp_extras(year)["players"].get(player_id, {}))
    teams = pbp_extras(season)["teams"]
    schedule = games_index()
    per_team = defaultdict(lambda: {"off": defaultdict(list), "def": defaultdict(list)})
    for team, team_games in teams.items():
        for game_id, values in team_games.items():
            game = schedule.get(game_id)
            if not game or str(game.get("game_type")).upper() != "REG":
                continue
            opponent = game["away"] if game["home"] == team else game["home"]
            for key, _label, field in PBP_TEAM_STATS:
                if values.get(field) is not None:
                    per_team[team]["off"][key].append(values[field])
                    per_team[opponent]["def"][key].append(values[field])
    stats = {team: {side: {key: sum(values) / len(values) for key, values in per_team[team][side].items() if values}
                    for side in ("off", "def")} for team in per_team}
    return {"season": season, "games": games, "values": pbp_values(season, player_id),
            "teamStats": _ranked(stats, [key for key, *_ in PBP_TEAM_STATS]),
            "stats": [[key, label] for key, label, _field in PBP_TEAM_STATS], "version": VERSION}


# ------------------------------------------------------------------ league

# Offense vs Defense and Rankings: per game, what a team does ("off") and
# what its opponents do against it ("def"). For defensive stats that reads
# the same way round -- a team's sacks, and the sacks its offense gives up.
TEAM_STATS = (
    ("receiving_yards", "Rec Yards", ("receiving_yards",)), ("receptions", "Receptions", ("receptions",)),
    ("targets", "Rec Targets", ("targets",)), ("receiving_tds", "Receiving TDs", ("receiving_tds",)),
    ("passing_yards", "Pass Yards", ("passing_yards",)), ("passing_tds", "Pass TDs", ("passing_tds",)),
    ("attempts", "Pass Attempts", ("attempts",)), ("completions", "Pass Completions", ("completions",)),
    ("interceptions", "Interceptions", ("passing_interceptions",)),
    ("rushing_yards", "Rush Yards", ("rushing_yards",)), ("carries", "Rush Attempts", ("carries",)),
    ("rushing_tds", "Rush TDs", ("rushing_tds",)), ("rush_rec_tds", "Rush+Rec TDs", ("rushing_tds", "receiving_tds")),
    ("rush_rec_yards", "Rush + Rec Yds", ("rushing_yards", "receiving_yards")),
    ("pass_rush_yards", "Pass + Rush Yds", ("passing_yards", "rushing_yards")),
    ("sacks", "Sacks", ("def_sacks",)), ("tackles", "Tackles", ("def_tackles_solo",)),
    ("assists", "Assists", ("def_tackle_assists",)), ("tackles_assists", "Tackles + Assists", ("def_tackles_solo", "def_tackle_assists")),
    ("fg_made", "FG Made", ("fg_made",)), ("pat_made", "Extra Points", ("pat_made",)),
    ("kicking_points", "Kicking Points", None), ("fumbles_lost", "Fumbles Lost", ("fumbles_lost_total",)),
    ("fantasy", "Fantasy Score", None), ("completion_pct", "Completion %", None),
    ("sacks_taken", "Sacks Taken", ("sacks_suffered",)), ("punts", "Punts", ("pt_att",)),
    ("punts_inside_20", "Punts Inside 20", ("pt_inside_20",)),
)


def _team_game_values(row, fantasy):
    values = {}
    for key, _label, fields in TEAM_STATS:
        if fields:
            values[key] = _sum(row, *fields)
    fg, pat = _n(row, "fg_made"), _n(row, "pat_made")
    values["kicking_points"] = None if fg is None or pat is None else fg * 3 + pat
    values["fantasy"] = fantasy
    return values


def _rank(values, reverse):
    """Competition ranking: ties share a rank, the next rank skips."""
    ordered = sorted((value for value in values.values() if value is not None), reverse=reverse)
    return {team: (ordered.index(value) + 1 if value is not None else None) for team, value in values.items()}


def _ranked(stats, keys):
    """{team: {off/def: {key: value}}} -> {team: {off/def: {key: [value, rank]}}}.
    Offense rank 1 does the most; defense rank 1 allows the least."""
    output = {team: {"off": {}, "def": {}} for team in stats}
    for side in ("off", "def"):
        for key in keys:
            column = {team: stats[team][side].get(key) for team in stats}
            ranks = _rank(column, reverse=side == "off")
            for team, value in column.items():
                if value is not None:
                    output[team][side][key] = [round(value, 2), ranks[team]]
    return output


# Defense vs position: what opposing players at a position produce, per
# player who recorded something, against each defense.
DVP_POSITIONS = ("QB", "RB", "WR", "TE", "FB", "K", "DL", "LB", "DB")
DVP_STATS = {
    "QB": ("passing_yards", "passing_tds", "attempts", "completions", "interceptions", "rushing_yards", "fantasy"),
    "RB": ("rushing_yards", "carries", "rushing_tds", "receptions", "receiving_yards", "targets", "rush_rec_yards", "fantasy"),
    "FB": ("rushing_yards", "carries", "receptions", "receiving_yards", "targets", "fantasy"),
    "WR": ("receiving_yards", "receptions", "targets", "receiving_tds", "rushing_yards", "fantasy"),
    "TE": ("receiving_yards", "receptions", "targets", "receiving_tds", "fantasy"),
    "K": ("fg_made", "pat_made", "kicking_points"),
    "DL": ("tackles", "assists", "tackles_assists", "sacks"),
    "LB": ("tackles", "assists", "tackles_assists", "sacks"),
    "DB": ("tackles", "assists", "tackles_assists", "interceptions_def", "pass_defended"),
}
PLAYER_STAT_FIELDS = {
    "passing_yards": ("passing_yards",), "passing_tds": ("passing_tds",), "attempts": ("attempts",),
    "completions": ("completions",), "interceptions": ("passing_interceptions",), "rushing_yards": ("rushing_yards",),
    "carries": ("carries",), "rushing_tds": ("rushing_tds",), "receptions": ("receptions",),
    "receiving_yards": ("receiving_yards",), "targets": ("targets",), "receiving_tds": ("receiving_tds",),
    "rush_rec_yards": ("rushing_yards", "receiving_yards"), "fg_made": ("fg_made",), "pat_made": ("pat_made",),
    "tackles": ("def_tackles_solo",), "assists": ("def_tackle_assists",),
    "tackles_assists": ("def_tackles_solo", "def_tackle_assists"), "sacks": ("def_sacks",),
    "interceptions_def": ("def_interceptions",), "pass_defended": ("def_pass_defended",),
}
STAT_LABELS = {key: label for key, label, _ in TEAM_STATS} | {
    "interceptions_def": "Interceptions", "pass_defended": "Passes Defended", "fantasy": "Fantasy Score",
    "kicking_points": "Kicking Points", "rush_rec_yards": "Rush + Rec Yds",
}


def dvp_position(row):
    position, group = str(row.get("position") or "").upper(), str(row.get("position_group") or "").upper()
    if position in ("QB", "RB", "WR", "TE", "FB", "K"):
        return position
    return group if group in ("DL", "LB", "DB") else None


def _player_stat(row, key):
    if key == "fantasy":
        return prizepicks_fantasy(row)
    if key == "kicking_points":
        fg, pat = _n(row, "fg_made"), _n(row, "pat_made")
        return None if fg is None or pat is None else fg * 3 + pat
    return _sum(row, *PLAYER_STAT_FIELDS[key])


OPPORTUNITY = {"QB": ("attempts", "carries"), "RB": ("carries", "targets"), "FB": ("carries", "targets"),
               "WR": ("targets", "carries"), "TE": ("targets", "carries"), "K": ("fg_att", "pat_att"),
               "DL": ("def_tackles_solo", "def_tackle_assists", "def_sacks"),
               "LB": ("def_tackles_solo", "def_tackle_assists", "def_sacks"),
               "DB": ("def_tackles_solo", "def_tackle_assists", "def_pass_defended", "def_interceptions")}


def _dvp(players, games):
    """{defense: {position: {games, players, stats: {key: {szn: [v, r], l5: [v, r]}}}}}

    Per opposing player who had a real chance at the spot -- a target, carry
    or pass for skill players, a kick for kickers, a tackle for defenders --
    so a receiver who only returned punts doesn't drag the receiver number
    down."""
    # defense -> position -> game_id -> [rows, one per player]
    faced = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for row in players:
        if str(row.get("season_type")).upper() != "REG":
            continue
        position, defense, game = dvp_position(row), canonical_team(row.get("opponent_team")), games.get(row.get("game_id"))
        if not position or not defense or not game or not any((_n(row, key) or 0) > 0 for key in OPPORTUNITY[position]):
            continue
        faced[defense][position][row["game_id"]].append(row)
    output = {}
    for position in DVP_POSITIONS:
        for window in ("szn", "l5"):
            for key in DVP_STATS[position]:
                column = {}
                for defense in TEAM_CODES:
                    by_game = faced[defense][position]
                    game_ids = sorted(by_game, key=lambda game_id: games[game_id]["kickoff"] or 0)
                    if window == "l5":
                        game_ids = game_ids[-5:]
                    values = [value for game_id in game_ids for row in by_game[game_id]
                              if (value := _player_stat(row, key)) is not None]
                    column[defense] = sum(values) / len(values) if values else None
                ranks = _rank(column, reverse=False)
                for defense, value in column.items():
                    if value is None:
                        continue
                    entry = output.setdefault(defense, {}).setdefault(position, {
                        "games": len(faced[defense][position]),
                        "players": sum(len(rows) for rows in faced[defense][position].values()), "stats": {}})
                    entry["stats"].setdefault(key, {})[window] = [round(value, 2), ranks[defense]]
    return output


def _standings(games, season, names):
    record = {team: {"wins": 0, "losses": 0, "ties": 0, "results": []} for team in TEAM_CODES}
    for game in sorted((game for game in games.values() if str(game["season"]) == str(season)
                        and str(game["game_type"]).upper() == "REG" and game["final"]), key=lambda game: game["kickoff"] or 0):
        for team in (game["home"], game["away"]):
            if team not in record:
                continue
            result = team_view(game, team)["result"]
            record[team][{"W": "wins", "L": "losses", "T": "ties"}[result]] += 1
            record[team]["results"].append(result)
    entries = {}
    for team, value in record.items():
        played = value["wins"] + value["losses"] + value["ties"]
        streak = ""
        if value["results"]:
            last = value["results"][-1]
            count = 0
            for result in reversed(value["results"]):
                if result != last:
                    break
                count += 1
            streak = f"{last}{count}"
        entries[team] = {"abbr": team, "name": names.get(team, team), "logo": logo(team), "division": DIVISION[team],
                         "wins": value["wins"], "losses": value["losses"], "ties": value["ties"],
                         "pct": (value["wins"] + value["ties"] / 2) / played if played else 0.0, "streak": streak,
                         "record": f"{value['wins']}-{value['losses']}" + (f"-{value['ties']}" if value["ties"] else "")}
    groups = []
    for conference in ("AFC", "NFC"):
        teams = sorted((entry for entry in entries.values() if entry["division"].startswith(conference)),
                       key=lambda entry: (-entry["pct"], -entry["wins"], entry["losses"], entry["name"]))
        leader = teams[0] if teams else None
        for entry in teams:
            gb = ((leader["wins"] - entry["wins"]) + (entry["losses"] - leader["losses"])) / 2 if leader else 0
            entry["gb"] = "-" if gb <= 0 else (f"{gb:g}")
            entry["pct"] = f"{entry['pct']:.3f}"
        groups.append({"name": conference, "entries": teams})
    return groups, entries


def league(season):
    def load():
        games, names = games_index(), team_names(season)
        players, teams = player_rows(season), team_rows(season)
        fantasy = defaultdict(float)
        fantasy_ok = defaultdict(lambda: True)
        for row in players:
            if str(row.get("season_type")).upper() != "REG":
                continue
            key = (row.get("game_id"), canonical_team(row.get("team")))
            value = prizepicks_fantasy(row)
            if value is None:
                fantasy_ok[key] = False
            else:
                fantasy[key] += value
        by_game = defaultdict(dict)
        for row in teams:
            if str(row.get("season_type")).upper() == "REG" and row.get("game_id") in games:
                team = canonical_team(row.get("team"))
                key = (row["game_id"], team)
                by_game[row["game_id"]][team] = _team_game_values(row, round(fantasy[key], 2) if fantasy_ok[key] and key in fantasy else None)
        sums = {team: {"off": defaultdict(list), "def": defaultdict(list)} for team in TEAM_CODES}
        completion = {team: {"off": [0, 0], "def": [0, 0]} for team in TEAM_CODES}
        pass_run = {team: {"passes": 0, "runs": 0} for team in TEAM_CODES}
        for game_id, sides in by_game.items():
            if len(sides) != 2:
                continue
            (a, a_values), (b, b_values) = sides.items()
            for team, own, other in ((a, a_values, b_values), (b, b_values, a_values)):
                if team not in sums:
                    continue
                for key, value in own.items():
                    if value is not None:
                        sums[team]["off"][key].append(value)
                for key, value in other.items():
                    if value is not None:
                        sums[team]["def"][key].append(value)
                completion[team]["off"][0] += own.get("completions") or 0
                completion[team]["off"][1] += own.get("attempts") or 0
                completion[team]["def"][0] += other.get("completions") or 0
                completion[team]["def"][1] += other.get("attempts") or 0
                # Dropbacks: every pass attempt plus every sack.
                pass_run[team]["passes"] += int((own.get("attempts") or 0) + (own.get("sacks_taken") or 0))
                pass_run[team]["runs"] += int(own.get("carries") or 0)
        averages = {team: {side: {key: sum(values) / len(values) for key, values in sums[team][side].items() if values}
                           for side in ("off", "def")} for team in TEAM_CODES}
        for team in TEAM_CODES:
            for side in ("off", "def"):
                done, attempted = completion[team][side]
                if attempted:
                    averages[team][side]["completion_pct"] = done / attempted * 100
        standings, entries = _standings(games, season, names)
        share = defaultdict(lambda: {"targets": defaultdict(float), "carries": defaultdict(float)})
        who = {}
        for row in players:
            if str(row.get("season_type")).upper() != "REG":
                continue
            team, player_id = canonical_team(row.get("team")), row.get("player_id")
            for field in ("targets", "carries"):
                value = _n(row, field)
                if value:
                    share[team][field][player_id] += value
            who[player_id] = {"id": player_id, "name": row.get("player_display_name") or row.get("player_name") or "",
                              "pos": row.get("position") or "", "headshot": row.get("headshot_url") or ""}
        shares = {}
        for team, fields in share.items():
            shares[team] = {}
            for field, counts in fields.items():
                total = sum(counts.values())
                shares[team][field] = [{**who[player_id], "value": _int(value), "share": value / total * 100}
                                       for player_id, value in sorted(counts.items(), key=lambda item: -item[1]) if total]
        return {
            "season": season, "teamCount": len(TEAM_CODES),
            "teams": {team: {"abbr": team, "name": names.get(team, team), "logo": logo(team), "division": DIVISION[team],
                             "conference": DIVISION[team][:3], "record": entries[team]["record"]} for team in TEAM_CODES},
            "stats": [[key, label] for key, label, _ in TEAM_STATS],
            "teamStats": _ranked(averages, [key for key, *_ in TEAM_STATS]),
            "dvp": _dvp(players, games), "dvpPositions": list(DVP_POSITIONS),
            "dvpStats": {position: [[key, STAT_LABELS[key]] for key in keys] for position, keys in DVP_STATS.items()},
            "standings": standings, "passRun": pass_run, "share": shares, "version": VERSION,
        }
    return cached_nfl(NFLCacheDomain.STATS, (VERSION, "league", season), load)


# ------------------------------------------------------------------ depth charts, injuries

OFFENSE_ORDER = ("QB", "RB", "FB", "WR", "TE")
WR_SIDES = ("Left", "Right", "Slot")
RESERVE = {"R01": "IR", "R48": "IR", "R04": "PUP", "R05": "NFI", "R40": "NFI"}


def _depth_latest(season):
    """Every team's latest published depth chart. The season file is one row
    per player per slot per daily snapshot (~55MB); stream it and keep only
    each team's newest snapshot instead of holding the file in memory."""
    def load():
        url = f"{RELEASE}/depth_charts/depth_charts_{season}.csv"
        latest, keep = {}, defaultdict(list)
        try:
            with urlopen(Request(url, headers=USER_AGENT), timeout=45) as response:
                for row in csv.DictReader(io.TextIOWrapper(response, encoding="utf-8-sig")):
                    team, stamp = canonical_team(row.get("team")), row.get("dt") or ""
                    if not team:
                        continue
                    if team not in latest or stamp > latest[team]:
                        latest[team], keep[team] = stamp, []
                    if stamp == latest[team]:
                        keep[team].append({key: row.get(key) for key in (
                            "player_name", "gsis_id", "pos_grp", "pos_name", "pos_abb", "pos_slot", "pos_rank")})
        except HTTPError as error:
            if error.code != 404:  # an outage must not be cached as "no depth chart"
                raise
            return {}
        return {team: {"updatedAt": latest[team], "rows": rows} for team, rows in keep.items()}
    return cached_nfl(NFLCacheDomain.DEPTH_CHARTS, (VERSION, "depth", season), load)


def _depth_groups(rows, headshots):
    def unit(row):
        if str(row.get("pos_grp")) == "Special Teams":
            return "special"
        return "offense" if str(row.get("pos_abb")).upper() in ("QB", "RB", "FB", "WR", "TE", "LT", "LG", "C", "RG", "RT") else "defense"
    slots = defaultdict(list)
    for row in rows:
        try:
            slot, rank = int(row.get("pos_slot") or 0), int(row.get("pos_rank") or 0)
        except ValueError:
            continue
        slots[(unit(row), slot, str(row.get("pos_abb") or ""))].append((rank, row))
    groups = {"offense": [], "defense": [], "special": []}
    wr_seen = 0
    for (group, slot, abb), members in sorted(slots.items(), key=lambda item: item[0][1]):
        if group == "offense" and abb.upper() not in OFFENSE_ORDER:
            continue
        label = abb
        if abb.upper() == "WR":
            label = f"WR · {WR_SIDES[wr_seen] if wr_seen < len(WR_SIDES) else wr_seen + 1}"
            wr_seen += 1
        players = [{"id": row.get("gsis_id") or "", "name": row.get("player_name") or "",
                    "headshot": headshots.get(row.get("gsis_id") or "", ""), "role": row.get("pos_name") or abb}
                   for _rank, row in sorted(members, key=lambda item: item[0])]
        groups[group].append({"slot": f"{group}:{slot}", "label": label, "position": abb, "players": players})
    order = {position: index for index, position in enumerate(OFFENSE_ORDER)}
    groups["offense"].sort(key=lambda entry: (order.get(entry["position"].upper(), 9), entry["slot"]))
    return groups


def _headshots(season):
    output = {}
    for row in roster_rows(season):
        player_id = str(row.get("gsis_id") or "").strip()
        espn = str(row.get("espn_id") or "").strip()
        photo = (f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn}.png" if espn not in ("", "NA", "0") else "") or row.get("headshot_url") or ""
        if player_id and photo:
            output[player_id] = photo
    return output


def team_context(season, team):
    team = canonical_team(team)

    def load():
        headshots = _headshots(season)
        depth = _depth_latest(season).get(team)
        # The weekly injury report: the latest week that lists this team.
        report = [row for row in _rows(f"{RELEASE}/injuries/injuries_{season}.csv") if canonical_team(row.get("team")) == team]
        week = max((int(row["week"]) for row in report if str(row.get("week") or "").isdigit()), default=None)
        injuries, listed = [], set()
        for row in report:
            if week is None or str(row.get("week")) != str(week):
                continue
            status = row.get("report_status") or ""
            practice = row.get("practice_status") or ""
            if not status and not practice:
                continue
            player_id = row.get("gsis_id") or ""
            listed.add(player_id)
            injuries.append({"id": player_id, "name": row.get("full_name") or "", "position": row.get("position") or "",
                             "headshot": headshots.get(player_id, ""), "status": status or "Practice report",
                             "injury": row.get("report_primary_injury") or row.get("practice_primary_injury") or "",
                             "practice": practice, "week": week})
        # Reserve lists (IR, PUP, NFI) from the latest roster listing.
        latest = {}
        for row in roster_rows(season):
            if canonical_team(row.get("team")) != team:
                continue
            player_id = row.get("gsis_id") or ""
            if player_id and (player_id not in latest or int(row.get("week") or 0) >= int(latest[player_id].get("week") or 0)):
                latest[player_id] = row
        for player_id, row in latest.items():
            code = RESERVE.get(row.get("status_description_abbr") or "")
            if row.get("status") == "RES" and code and player_id not in listed:
                injuries.append({"id": player_id, "name": row.get("full_name") or "", "position": row.get("position") or "",
                                 "headshot": headshots.get(player_id, ""), "status": code, "injury": "", "practice": "",
                                 "week": None})
        weight = {"Out": 0, "IR": 1, "PUP": 2, "NFI": 2, "Doubtful": 3, "Questionable": 4}
        injuries.sort(key=lambda item: (weight.get(item["status"], 5), item["name"]))
        return {"season": season, "team": team, "injuryWeek": week, "injuries": injuries,
                "depth": {"updatedAt": depth["updatedAt"], **_depth_groups(depth["rows"], headshots)} if depth else None,
                "version": VERSION}
    return cached_nfl(NFLCacheDomain.DEPTH_CHARTS, (VERSION, "team", season, team), load)


# ------------------------------------------------------------------ matchup

def _implied(american):
    if american is None:
        return None
    return -american / (-american + 100) if american < 0 else 100 / (american + 100)


def matchup(season, game_id):
    def load():
        games = games_index()
        game = games.get(game_id)
        if not game:
            raise ValueError("Unknown NFL game")
        names = team_names(season)
        _groups, entries = _standings(games, season, names)
        teams = []
        for side in ("away", "home"):
            team = game[side]
            teams.append({"abbr": team, "name": names.get(team, team), "logo": logo(team), "side": side,
                          "record": entries.get(team, {}).get("record", ""), "conference": DIVISION.get(team, "")[:3]})
        away_ml, home_ml = _n(game, "away_moneyline"), _n(game, "home_moneyline")
        # nflverse's spread_line is how many points the HOME team is favored
        # by: -2.5 means the away team gives 2.5.
        spread = _n(game, "spread_line")
        odds = None
        if any(value is not None for value in (away_ml, home_ml, spread, _n(game, "total_line"))):
            odds = {"away": {"moneyline": away_ml, "spread": spread, "spreadOdds": _n(game, "away_spread_odds")},
                    "home": {"moneyline": home_ml, "spread": -spread if spread is not None else None,
                             "spreadOdds": _n(game, "home_spread_odds")},
                    "total": _n(game, "total_line"), "overOdds": _n(game, "over_odds"), "underOdds": _n(game, "under_odds"),
                    "provider": "Sportsbook consensus (nflverse)"}
            away_p, home_p = _implied(away_ml), _implied(home_ml)
            if away_p and home_p:
                odds["noVig"] = {"away": away_p / (away_p + home_p) * 100, "home": home_p / (away_p + home_p) * 100}
        kickoff = game["kickoff"] or 0
        last_five = {}
        for team in (game["away"], game["home"]):
            played = [g for g in games.values() if team in (g["home"], g["away"]) and g["final"] and (g["kickoff"] or 0) < kickoff]
            played.sort(key=lambda g: g["kickoff"] or 0)
            last_five[team] = []
            for g in played[-5:]:
                view = team_view(g, team)
                last_five[team].append({"id": g["game_id"], "date": view["date"], "opponent": view["opponent"],
                                        "opponentLogo": logo(view["opponent"]), "atVs": "vs" if view["isHome"] else "@",
                                        "result": view["result"], "score": view["score"]})
        return {"game": {"id": game_id, "week": int(game["week"]), "startsAt": datetime.fromtimestamp(kickoff, timezone.utc).isoformat() if kickoff else None,
                         "final": game["final"], "divisional": str(game.get("div_game")) == "1"},
                "teams": teams, "odds": odds, "lastFive": last_five,
                "venue": {"name": game.get("stadium") or "", "roof": game.get("roof") or "", "surface": game.get("surface") or ""},
                "weather": {"temp": _n(game, "temp"), "wind": _n(game, "wind")}, "version": VERSION}
    return cached_nfl(NFLCacheDomain.SCHEDULE, (VERSION, "matchup", season, game_id), load)


# ------------------------------------------------------------------ player context

SIMILAR_POSITIONS = ("QB", "RB", "WR", "TE")
USAGE = {"QB": ("attempts", "att"), "RB": ("carries", "car"), "FB": ("carries", "car"), "WR": ("targets", "tgt"), "TE": ("targets", "tgt")}


def _value(row, market):
    if market == "fantasy_score":
        return prizepicks_fantasy(row)
    fields = MARKET_FIELDS.get(market)
    if fields:
        return _sum(row, *fields)
    # Kicking and defense come from the same weekly row; play-by-play
    # markets have no weekly value.
    return {**_kicking(row), **_defense(row)}.get(market)


def player_context(season, player_id, team, opponent, market, line):
    team, opponent = canonical_team(team), canonical_team(opponent)

    def load():
        games = games_index()
        similar = {}
        for year in (season, season - 1):
            rows = [row for row in player_rows(year) if str(row.get("season_type")).upper() in ("REG", "POST") and row.get("game_id") in games]
            by_player = defaultdict(list)
            for row in rows:
                by_player[row.get("player_id")].append(row)
            for position in SIMILAR_POSITIONS:
                if similar.get(position):
                    continue
                usage_field = USAGE[position][0]
                faced = [row for row in rows if canonical_team(row.get("opponent_team")) == opponent
                         and str(row.get("position")).upper() == position and (_n(row, usage_field) or 0) > 0
                         and row.get("player_id") != player_id]
                faced.sort(key=lambda row: -(games[row["game_id"]]["kickoff"] or 0))
                entries = []
                for row in faced[:12]:
                    value = _value(row, market)
                    if value is None:
                        continue
                    others = [v for other in by_player[row.get("player_id")] if other.get("game_id") != row["game_id"]
                              and (v := _value(other, market)) is not None]
                    average = sum(others) / len(others) if others else None
                    entries.append({"id": row.get("player_id"), "name": row.get("player_display_name") or row.get("player_name") or "",
                                    "team": canonical_team(row.get("team")), "headshot": row.get("headshot_url") or "",
                                    "gameId": row["game_id"], "date": games[row["game_id"]].get("gameday") or "", "season": year,
                                    "usage": _int(_n(row, usage_field)), "usageLabel": USAGE[position][1],
                                    "value": _int(value), "avg": average, "diff": value - average if average is not None else None})
                if entries:
                    similar[position] = entries[:10]
        # With / without: his games with this team this season and last,
        # split by whether each teammate also played.
        mine, teammates, usage = {}, defaultdict(lambda: defaultdict(set)), defaultdict(float)
        info = {}
        for year in (season - 1, season):
            for row in player_rows(year):
                if canonical_team(row.get("team")) != team or str(row.get("season_type")).upper() not in ("REG", "POST"):
                    continue
                if row.get("player_id") == player_id:
                    value = _value(row, market)
                    if value is not None:
                        mine[row["game_id"]] = (year, value)
                    continue
                if not _involved(row):
                    continue
                teammates[row.get("player_id")][year].add(row.get("game_id"))
                usage[row.get("player_id")] += sum(_n(row, key) or 0 for key in ("targets", "carries", "attempts", "def_tackles_solo"))
                info[row.get("player_id")] = {"id": row.get("player_id"), "name": row.get("player_display_name") or row.get("player_name") or "",
                                              "pos": row.get("position") or "", "headshot": row.get("headshot_url") or ""}

        def split(game_ids):
            values = [mine[game_id][1] for game_id in game_ids]
            decided = [value for value in values if line is None or value != line]
            hits = sum(1 for value in decided if line is not None and value > line)
            return {"games": len(values), "avg": sum(values) / len(values) if values else None,
                    "hits": hits if line is not None else None, "misses": len(decided) - hits if line is not None else None,
                    "gameIds": sorted(game_ids)}
        with_without = []
        for teammate, seasons in teammates.items():
            base = {game_id for game_id, (year, _value_) in mine.items() if year in seasons}
            if not base:
                continue
            together = {game_id for game_id in base if game_id in seasons[mine[game_id][0]]}
            with_without.append({**info[teammate], "usage": usage[teammate],
                                 "with": split(together), "without": split(base - together)})
        with_without.sort(key=lambda item: -item["usage"])
        return {"season": season, "similar": similar, "withWithout": with_without[:40], "games": len(mine), "version": VERSION}
    return cached_nfl(NFLCacheDomain.STATS, (VERSION, "player", season, player_id, team, opponent, market, line), load)
