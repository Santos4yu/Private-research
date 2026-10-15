"""NFL cheat sheets: this week's games read twelve ways.

  best      each game's best matchups at any position: what the defense
            gives up to his position in that stat, his projection against
            the line, his hit rate and the books' chance, in one score
  td        anytime touchdown chances: each player's scoring rate and
            red-zone role against what the defense allows his position,
            scaled by the points his team is expected to score
  firsttd   who scores early: touchdowns on each team's first two drives,
            who scored each game's first touchdown, early-drive usage
  streaks   lines a player keeps clearing, or keeps missing
  zones     where a receiver's targets go (short or deep, left, middle or
            right) against the yards the defense gives up there
  redzone   red-zone trips, each player's share of the work and the
            touchdown chance they add up to
  speed     a player's 40-yard speed against the defenders across from him
  steam     lines that have moved since they opened
  shop      prices better than the other books' consensus, and lines off
            the market's number
  dvp       what every defense allows each position, game by game
  soft      props lined up against the defenses that allow the most
  goblins   PrizePicks goblins and demons the books price at the same number

Everything comes from nflverse's free season files (weekly player stats,
play by play, the schedule with its closing spreads and totals, rosters,
depth charts, injury reports and combine results), the lines the Finder
already loads (PrizePicks and the sportsbooks through The Odds API -- no
extra calls), and the opening numbers line_moves.py records. Nothing is
bought. A missing piece leaves its columns empty rather than failing a sheet.
"""
from __future__ import annotations

import csv
import gzip
import io
import math
import re
import time
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from statistics import median
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.sports.nfl import finder, markets
from backend.sports.nfl.cache import NFLCacheDomain, cached_nfl
from backend.sports.nfl.services.nflverse import RELEASE, canonical_team
from backend.sports.nfl.services.research_stats import numeric, prizepicks_fantasy

VERSION = "nfl-sheets-v1"
SHEETS = ("best", "td", "firsttd", "streaks", "zones", "redzone", "speed", "steam", "shop", "dvp", "soft", "goblins")
SKILL = ("QB", "RB", "WR", "TE")
ZONES = ("short_left", "short_middle", "short_right", "deep_left", "deep_middle", "deep_right")
WINDOWS = (("l3", 3), ("l5", 5), ("l10", 10), ("szn", None))
USER_AGENT = {"User-Agent": "KrazyData-NFL-sheets/1.0"}

# Pick'em apps: PrizePicks' payouts are fixed, and an app quoting the same
# price on both sides says nothing about which is likelier (the Finder's
# bookProbability in src/unified-finder-data.js, which this matches).
PICKEM = {"prizepicks", "underdog", "sleeper", "dabble", "betr", "betr_us_dfs", "pick6", "parlayplay", "chalkboard"}
SHARP_WEIGHT = {"pinnacle": 3}
ONE_SIDED_OVERROUND = 1.08


# ---------------------------------------------------------------- numbers

def _finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _num(row, key):
    return numeric(row.get(key))


def _r(value, digits=1):
    return round(value, digits) if _finite(value) else None


def _clamp(value, low, high):
    return max(low, min(high, value))


def implied(price):
    """American odds -> the chance they imply, margin included."""
    if not _finite(price) or -100 < price < 100:
        return None
    return -price / (-price + 100) if price < 0 else 100 / (price + 100)


def american(chance):
    """A chance -> its fair American price."""
    if not _finite(chance) or not 0 < chance < 1:
        return None
    return round(-100 * chance / (1 - chance)) if chance >= 0.5 else round(100 * (1 - chance) / chance)


def decimal(price):
    if not _finite(price) or -100 < price < 100:
        return None
    return 1 + (price / 100 if price > 0 else 100 / -price)


def power_devig(a, b):
    low, high = 0.05, 20.0
    for _ in range(60):
        k = (low + high) / 2
        if a ** k + b ** k > 1:
            low = k
        else:
            high = k
    return a ** ((low + high) / 2)


def book_chance(app):
    """One book's Over chance with its margin removed, and whether it priced
    both sides."""
    over, under = implied(app.get("over")), implied(app.get("under"))
    if over is not None and under is not None:
        return power_devig(over, under), True
    if over is not None:
        return power_devig(over, max(0.01, ONE_SIDED_OVERROUND - over)), False
    if under is not None:
        return 1 - power_devig(under, max(0.01, ONE_SIDED_OVERROUND - under)), False
    return None


def priced(app):
    return bool(app) and app.get("key") != "prizepicks" and not (
        app.get("key") in PICKEM and app.get("over") == app.get("under"))


def book_probability(apps, leave_out=None):
    """The books' Over chance for a line: each book's margin out, then a
    weighted average (both sides priced counts double, Pinnacle triple,
    a pick'em app half). None when no book prices it."""
    total = weight_sum = 0.0
    books = 0
    for app in apps or []:
        if not priced(app) or app.get("key") == leave_out:
            continue
        found = book_chance(app)
        if not found:
            continue
        chance, two_sided = found
        weight = SHARP_WEIGHT.get(app["key"], 1) * (1 if two_sided else 0.5) * (0.5 if app["key"] in PICKEM else 1)
        total += chance * weight
        weight_sum += weight
        books += 1
    return (total / weight_sum, books) if weight_sum else (None, 0)


def _rank(values, reverse=False):
    """Competition ranking: ties share a rank. Rank 1 is the smallest
    unless `reverse`."""
    ordered = sorted((value for value in values.values() if value is not None), reverse=reverse)
    return {key: (ordered.index(value) + 1 if value is not None else None) for key, value in values.items()}


def norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()
    parts = re.findall(r"[a-z0-9]+", text.replace("'", ""))
    if parts and parts[-1] in ("jr", "sr", "ii", "iii", "iv", "v"):
        parts = parts[:-1]
    return "".join(parts)


# ---------------------------------------------------------------- the week

def season_now(now=None):
    moment = datetime.fromtimestamp(now or time.time(), timezone.utc)
    return moment.year if moment.month >= 3 else moment.year - 1


def _iso(seconds):
    return datetime.fromtimestamp(seconds, timezone.utc).isoformat() if seconds else None


def week_games(season, now=None):
    """This week's games: every game of the earliest week that still has one
    not final. Started games stay listed, flagged."""
    now = now or time.time()
    games = [game for game in finder.games_index().values() if str(game.get("season")) == str(season)]
    waiting = [game for game in games if not game["final"]]
    if not waiting:
        return None, []
    week = min(int(game["week"]) for game in waiting)
    names = finder.team_names(season)
    output = []
    for game in sorted((game for game in games if int(game["week"]) == week), key=lambda game: game["kickoff"] or 0):
        spread, total = numeric(game.get("spread_line")), numeric(game.get("total_line"))
        home_points = away_points = None
        if spread is not None and total is not None:
            # spread_line is how many points the home team is favored by.
            home_points, away_points = (total + spread) / 2, (total - spread) / 2
        output.append({
            "gameId": game["game_id"], "week": week, "away": game["away"], "home": game["home"],
            "awayName": names.get(game["away"], game["away"]), "homeName": names.get(game["home"], game["home"]),
            "startsAt": _iso(game["kickoff"]), "started": bool(game["final"] or (game["kickoff"] and game["kickoff"] <= now)),
            "final": bool(game["final"]), "total": total, "spread": spread,
            "points": {game["home"]: _r(home_points), game["away"]: _r(away_points)},
        })
    return week, output


def _opponents(games):
    """team -> (its game, opponent), for games not yet started."""
    found = {}
    for game in games:
        if game["started"]:
            continue
        found[game["home"]] = (game, game["away"])
        found[game["away"]] = (game, game["home"])
    return found


def _league_points(season):
    """Points a team scores a game this season (final games)."""
    scores = []
    for game in finder.games_index().values():
        if str(game.get("season")) == str(season) and game["final"]:
            for key in ("home_score", "away_score"):
                value = numeric(game.get(key))
                if value is not None:
                    scores.append(value)
    return sum(scores) / len(scores) if len(scores) >= 16 else 22.0


# ---------------------------------------------------------------- people

def people(season):
    """gsis id -> name, team, position, photo, pfr id and roster status, from
    the latest week the roster file lists him."""
    found = {}
    for row in finder.roster_rows(season):
        player_id = str(row.get("gsis_id") or "").strip()
        if not player_id or player_id == "NA":
            continue
        week = numeric(row.get("week")) or 0
        if player_id in found and found[player_id]["_week"] > week:
            continue
        espn = str(row.get("espn_id") or "").strip()
        found[player_id] = {
            "_week": week, "id": player_id, "name": row.get("full_name") or "",
            "team": canonical_team(row.get("team")), "position": str(row.get("position") or "").upper(),
            "headshot": f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn}.png"
            if espn and espn not in ("NA", "0") else (row.get("headshot_url") or ""),
            "pfr": str(row.get("pfr_id") or "").strip(), "status": str(row.get("status") or "").upper(),
        }
    return found


def injuries(season, week):
    """gsis id -> game status ('Out', 'Doubtful', 'Questionable') this week."""
    try:
        from backend.sports.nfl.services import nflverse
        result = nflverse.injuries(season, week)
        rows = result.data or []
    except Exception:  # noqa: BLE001 -- the report is a nicety
        return {}
    return {row.player_id: row.game_status for row in rows if row.game_status}


def available(person, hurt):
    """On the active roster and not ruled out."""
    return bool(person) and person.get("status") in ("ACT", "") and hurt.get(person["id"]) != "Out"


def _who(person, team=None):
    return {"id": person.get("id"), "name": person.get("name"), "team": team or person.get("team"),
            "position": person.get("position"), "headshot": person.get("headshot") or None}


# ---------------------------------------------------------------- weekly stats

STAT_FIELDS = {
    "passing_yards": ("passing_yards",), "passing_tds": ("passing_tds",), "attempts": ("attempts",),
    "completions": ("completions",), "interceptions": ("passing_interceptions",),
    "rushing_yards": ("rushing_yards",), "carries": ("carries",), "receptions": ("receptions",),
    "targets": ("targets",), "receiving_yards": ("receiving_yards",),
    "rush_rec_yards": ("rushing_yards", "receiving_yards"), "rush_rec_tds": ("rushing_tds", "receiving_tds"),
}
DVP_STATS = (
    ("fantasy", "Fantasy pts", SKILL), ("passing_yards", "Pass yds", ("QB",)), ("passing_tds", "Pass TDs", ("QB",)),
    ("completions", "Completions", ("QB",)), ("attempts", "Pass attempts", ("QB",)),
    ("interceptions", "Interceptions", ("QB",)), ("rushing_yards", "Rush yds", ("QB", "RB", "WR")),
    ("carries", "Carries", ("QB", "RB")), ("receptions", "Receptions", ("RB", "WR", "TE")),
    ("targets", "Targets", ("RB", "WR", "TE")), ("receiving_yards", "Rec yds", ("RB", "WR", "TE")),
    ("rush_rec_yards", "Rush + rec yds", ("RB", "WR", "TE")), ("rush_rec_tds", "Rush + rec TDs", SKILL),
)
# A prop market -> the stat its defense-vs-position number is.
MARKET_STAT = {
    "passing_yards": "passing_yards", "passing_touchdowns": "passing_tds", "pass_completions": "completions",
    "passing_attempts": "attempts", "interceptions": "interceptions", "rushing_yards": "rushing_yards",
    "rush_attempts": "carries", "receptions": "receptions", "targets": "targets", "receiving_yards": "receiving_yards",
    "rushing_receiving_yards": "rush_rec_yards", "touchdowns": "rush_rec_tds", "fantasy_score": "fantasy",
}


def stat_value(row, key):
    if key == "fantasy":
        return prizepicks_fantasy(row)
    values = [_num(row, field) for field in STAT_FIELDS[key]]
    return None if any(value is None for value in values) else sum(values)


def season_rows(season):
    return [row for row in finder.player_rows(season) if str(row.get("season_type")).upper() in ("REG", "POST")]


def dvp_table(rows, games):
    """{defense: {position: {stat: {window: [per game, rank]}}}} and the
    league's average per window. What the opposing players at a position
    added up to in each of the defense's games, averaged; a game in which
    nobody at the position did anything counts as zero. Rank 1 allows the
    least, the last rank the most."""
    faced = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for row in rows:
        defense, game = canonical_team(row.get("opponent_team")), games.get(row.get("game_id"))
        if not defense or not game:
            continue
        bucket = faced[defense][row["game_id"]]
        position = str(row.get("position") or "").upper()
        if position in SKILL:
            bucket[position].append(row)
    played = {defense: sorted(by_game, key=lambda game_id: games[game_id]["kickoff"] or 0) for defense, by_game in faced.items()}
    table, league = {}, {}
    for key, _label, positions in DVP_STATS:
        for position in positions:
            for window, size in WINDOWS:
                column = {}
                for defense, game_ids in played.items():
                    chosen = game_ids[-size:] if size else game_ids
                    totals = []
                    for game_id in chosen:
                        values = [stat_value(row, key) for row in faced[defense][game_id][position]]
                        known = [value for value in values if value is not None]
                        if known or not values:
                            totals.append(sum(known))
                    column[defense] = sum(totals) / len(totals) if totals else None
                ranks = _rank(column)
                known = [value for value in column.values() if value is not None]
                league.setdefault(position, {}).setdefault(key, {})[window] = _r(sum(known) / len(known), 2) if known else None
                for defense, value in column.items():
                    if value is not None:
                        table.setdefault(defense, {}).setdefault(position, {}).setdefault(key, {})[window] = [_r(value, 2), ranks[defense]]
    return table, league, {defense: len(game_ids) for defense, game_ids in played.items()}


def player_seasons(rows):
    """gsis id -> games, TDs, carries, targets this season (weekly stats)."""
    found = defaultdict(lambda: {"games": 0, "tds": 0, "carries": 0, "targets": 0, "team": None, "last": ""})
    for row in rows:
        player_id = row.get("player_id")
        if not player_id:
            continue
        entry = found[player_id]
        entry["games"] += 1
        entry["tds"] += (_num(row, "rushing_tds") or 0) + (_num(row, "receiving_tds") or 0)
        entry["carries"] += _num(row, "carries") or 0
        entry["targets"] += _num(row, "targets") or 0
        stamp = f"{int(_num(row, 'week') or 0):02d}"
        if stamp >= entry["last"]:
            entry["last"], entry["team"] = stamp, canonical_team(row.get("team"))
    return found


# ---------------------------------------------------------------- play by play

PBP_FIELDS = ("game_id", "season_type", "posteam", "defteam", "play_type", "yardline_100", "qtr", "fixed_drive",
              "fixed_drive_result", "drive_inside20", "touchdown", "td_team", "td_player_id", "rush_touchdown",
              "pass_touchdown", "rush_attempt", "pass_attempt", "sack", "two_point_attempt", "rusher_player_id",
              "receiver_player_id", "receiving_yards", "pass_length", "pass_location")


def _present(value):
    return value not in (None, "", "NA")


def summarize_pbp(records):
    """The season's play by play reduced to what the sheets read: red-zone
    work and trips, first-two-drive touchdowns and usage, the first
    touchdown of every game, and targets and yards by zone."""
    players = defaultdict(lambda: {"team": None, "rz": [0, 0, 0, 0], "longTds": 0, "firstTd": 0, "q1": [0, 0],
                                   "d2": [0, 0], "zones": {}})
    teams = defaultdict(lambda: {"games": set(), "rz": [0, 0], "q1": [0, 0], "d2": [0, 0], "trips": 0, "tdTrips": 0,
                                 "early": [0, 0, 0, 0], "firstTd": 0, "tds": 0})
    defense = defaultdict(lambda: {"games": set(), "trips": 0, "tdTrips": 0, "early": [0, 0], "zones": {}})
    league_zones = {}
    drives = {}          # (game, team) -> ordered drive ids
    drive_info = {}      # (game, team, drive) -> [inside 20, result, defense]
    first_td = {}        # game -> (team, player, offensive)
    for row in records:
        if str(row.get("season_type")).upper() not in ("REG", "POST"):
            continue
        game, offense, opponent = row.get("game_id"), canonical_team(row.get("posteam")), canonical_team(row.get("defteam"))
        if not game:
            continue
        if _num(row, "touchdown") == 1 and _present(row.get("td_team")) and game not in first_td:
            scorer = canonical_team(row.get("td_team"))
            offensive = (_num(row, "rush_touchdown") == 1 or _num(row, "pass_touchdown") == 1) and scorer == offense
            first_td[game] = (scorer, row.get("td_player_id") if offensive else None, offensive)
        if not offense or not opponent or _num(row, "two_point_attempt") == 1:
            continue
        drive = row.get("fixed_drive")
        if _present(drive):
            order = drives.setdefault((game, offense), [])
            if drive not in order:
                order.append(drive)
            info = drive_info.setdefault((game, offense, drive), [0, "", opponent])
            info[0] = max(info[0], int(_num(row, "drive_inside20") == 1))
            info[1] = row.get("fixed_drive_result") or info[1]
            early = order.index(drive) < 2
        else:
            early = False
        teams[offense]["games"].add(game)
        defense[opponent]["games"].add(game)
        rush = _num(row, "rush_attempt") == 1 and _present(row.get("rusher_player_id"))
        target = (_num(row, "pass_attempt") == 1 and _num(row, "sack") != 1 and _present(row.get("receiver_player_id")))
        if not rush and not target:
            continue
        who = row.get("rusher_player_id") if rush else row.get("receiver_player_id")
        player, team = players[who], teams[offense]
        player["team"] = offense
        slot = 0 if rush else 1
        yardline = _num(row, "yardline_100")
        if yardline is not None and yardline <= 20:
            player["rz"][slot] += 1
            team["rz"][slot] += 1
            if yardline <= 10:
                player["rz"][2] += 1
        if _num(row, "qtr") == 1:
            player["q1"][slot] += 1
            team["q1"][slot] += 1
        if early:
            player["d2"][slot] += 1
            team["d2"][slot] += 1
            team["early"][2 + slot] += 1
        scored = (_num(row, "rush_touchdown") == 1 or _num(row, "pass_touchdown") == 1) and \
            canonical_team(row.get("td_team")) == offense and row.get("td_player_id") == who
        if scored:
            team["tds"] += 1
            if yardline is not None and yardline <= 20:
                player["rz"][3] += 1
            else:
                player["longTds"] += 1
        length, side = row.get("pass_length"), row.get("pass_location")
        if target and length in ("short", "deep") and side in ("left", "middle", "right"):
            zone, yards = f"{length}_{side}", _num(row, "receiving_yards") or 0
            for bucket in (player["zones"], defense[opponent]["zones"], league_zones):
                cell = bucket.setdefault(zone, [0, 0])
                cell[0] += 1
                cell[1] += yards
    # Drives: red-zone trips and first-two-drive touchdowns.
    early_td = {}
    for (game, team, drive), (inside, result, opponent) in drive_info.items():
        touchdown = result == "Touchdown"
        if inside:
            teams[team]["trips"] += 1
            defense[opponent]["trips"] += 1
            if touchdown:
                teams[team]["tdTrips"] += 1
                defense[opponent]["tdTrips"] += 1
        if touchdown and drive in drives.get((game, team), [])[:2]:
            early_td[(game, team)] = True
    for (game, team), order in drives.items():
        opponent = drive_info[(game, team, order[0])][2]
        scored = bool(early_td.get((game, team)))
        teams[team]["early"][0] += 1
        teams[team]["early"][1] += int(scored)
        defense[opponent]["early"][0] += 1
        defense[opponent]["early"][1] += int(scored)
    defensive_first = 0
    for game, (scorer, player_id, offensive) in first_td.items():
        if scorer:
            teams[scorer]["firstTd"] += 1
        if offensive and player_id:
            players[player_id]["firstTd"] += 1
        else:
            defensive_first += 1
    return {
        "players": {key: value for key, value in players.items()},
        "teams": {key: {**value, "games": len(value["games"])} for key, value in teams.items()},
        "defense": {key: {**value, "games": len(value["games"])} for key, value in defense.items()},
        "league": {"zones": league_zones, "games": len(first_td) or 0, "nonOffenseFirst": defensive_first},
    }


def pbp_summary(season):
    def load():
        url = f"{RELEASE}/pbp/play_by_play_{season}.csv.gz"
        try:
            with urlopen(Request(url, headers=USER_AGENT), timeout=45) as response:
                reader = csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=response), encoding="utf-8-sig"))
                if not set(PBP_FIELDS).issubset(reader.fieldnames or []):
                    raise RuntimeError("Play-by-play is missing a column the sheets need")
                return summarize_pbp({key: row.get(key) for key in PBP_FIELDS} for row in reader)
        except HTTPError as error:
            if error.code != 404:  # an outage is never cached as "no plays"
                raise
            return summarize_pbp([])
    return cached_nfl(NFLCacheDomain.PLAY_BY_PLAY, (VERSION, "pbp", season), load)


# ---------------------------------------------------------------- the lines

def board_rows(season):
    """The Finder's NFL lines (prizepicks_board), or none when they can't load."""
    try:
        from backend.sports.nfl import prizepicks_board
        return prizepicks_board.board(season).get("rows") or []
    except Exception:  # noqa: BLE001 -- sheets built from stats still stand
        return []


def _starts(row):
    try:
        return datetime.fromisoformat(str(row.get("startsAt")).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def upcoming(rows, now=None):
    now = now or time.time()
    return [row for row in rows if (_starts(row) or 0) > now]


def category(row):
    return str((row.get("line") or {}).get("category") or "STANDARD").upper()


def line_of(row):
    return (row.get("line") or {}).get("value")


def main_lines(rows):
    """One standard line per player and market: PrizePicks' when it posts
    one, else the line the most books share."""
    best = {}
    for row in rows:
        if category(row) != "STANDARD" or not row.get("propType") or not row.get("playerName"):
            continue
        key = (row.get("playerId") or norm(row.get("playerName")), row["propType"])
        rank = (str(row.get("id", "")).startswith("pp:"), len(row.get("apps") or []))
        if key not in best or rank > best[key][0]:
            best[key] = (rank, row)
    return [row for _rank_value, row in best.values()]


def values_of(row):
    return [game["value"] for game in row.get("gameLog") or [] if _finite(game.get("value"))]


def season_values(row, season):
    start = f"{season}-08-01"
    return [game["value"] for game in row.get("gameLog") or [] if _finite(game.get("value")) and str(game.get("date") or "") >= start]


def rate(values, line, side="over"):
    """Share of games on `side` of the line (pushes left out), and the count."""
    decided = [value for value in values if value != line]
    if not decided:
        return None, 0, 0
    hits = sum((value > line) if side == "over" else (value < line) for value in decided)
    return hits / len(decided), hits, len(decided)


def best_price(row, side="over"):
    found = None
    for app in row.get("apps") or []:
        price = app.get(side)
        if not priced(app) or not _finite(price):
            continue
        if found is None or price > found["price"]:
            found = {"book": app["key"], "name": app.get("name") or app["key"], "price": price}
    return found


def prices(row):
    return [{"book": app["key"], "name": app.get("name") or app["key"], "over": app.get("over"), "under": app.get("under")}
            for app in row.get("apps") or [] if priced(app) and (_finite(app.get("over")) or _finite(app.get("under")))]


def row_who(row, people_index=None):
    person = (people_index or {}).get(row.get("playerId")) or {}
    return {"id": row.get("playerId"), "name": row.get("playerName") or person.get("name"), "team": row.get("teamId"),
            "position": str(row.get("position") or person.get("position") or "").upper(),
            "headshot": row.get("headshot") or person.get("headshot") or None}


def label_of(row):
    return markets.LABELS.get(row.get("propType")) or row.get("propLabel") or row.get("propType")


def _hits(row, season, side="over"):
    values, line = values_of(row), line_of(row)
    output = {}
    for key, size in (("l5", 5), ("l10", 10), ("l20", 20)):
        chance, hits, games = rate(values[-size:], line, side)
        output[key] = {"rate": _r(chance, 3), "hits": hits, "games": games}
    chance, hits, games = rate(season_values(row, season), line, side)
    output["szn"] = {"rate": _r(chance, 3), "hits": hits, "games": games}
    return output


def _game_of(row, games):
    return next((game for game in games if game["gameId"] == row.get("gameId")), None)


# ---------------------------------------------------------------- sheets

def sheet_dvp(ctx):
    table, league, played = ctx["dvp"]
    opponents = {}
    for game in ctx["games"]:
        opponents[game["home"]] = {"opponent": game["away"], "home": True, "startsAt": game["startsAt"], "started": game["started"]}
        opponents[game["away"]] = {"opponent": game["home"], "home": False, "startsAt": game["startsAt"], "started": game["started"]}
    names = finder.team_names(ctx["season"])
    teams = [{"team": team, "name": names.get(team, team), "logo": finder.logo(team), "games": played.get(team, 0),
              **(opponents.get(team) or {"opponent": None})} for team in finder.TEAM_CODES]
    softest = []
    for team, entry in table.items():
        if team not in opponents or opponents[team]["started"]:
            continue
        for position in SKILL:
            cell = ((entry.get(position) or {}).get("fantasy") or {}).get("l5")
            if cell:
                softest.append({"team": team, "position": position, "allowed": cell[0], "rank": cell[1],
                                "opponent": opponents[team]["opponent"]})
    softest.sort(key=lambda item: (-(item["rank"] or 0), -(item["allowed"] or 0)))
    return {"teams": teams, "stats": [{"key": key, "label": label, "positions": list(positions)} for key, label, positions in DVP_STATS],
            "windows": [key for key, _size in WINDOWS], "cells": table, "league": league, "ranked": len(played),
            "softest": softest[:6]}


def _dvp_cell(ctx, defense, position, stat, window="l5"):
    table, league, played = ctx["dvp"]
    cell = (((table.get(defense) or {}).get(position) or {}).get(stat) or {}).get(window)
    average = ((league.get(position) or {}).get(stat) or {}).get(window)
    return (cell[0], cell[1], average, len(played)) if cell else (None, None, average, len(played))


def sheet_soft(ctx):
    rows, season, games = ctx["mains"], ctx["season"], ctx["games"]
    spots = []
    for row in rows:
        stat = MARKET_STAT.get(row.get("propType"))
        who = row_who(row, ctx["people"])
        position = who["position"]
        positions = next((positions for key, _label, positions in DVP_STATS if key == stat), ())
        if not stat or position not in positions or not row.get("opponentId"):
            continue
        allowed, rank, average, teams = _dvp_cell(ctx, row["opponentId"], position, stat, "l5")
        _szn_allowed, szn_rank, _szn_average, _teams = _dvp_cell(ctx, row["opponentId"], position, stat, "szn")
        if rank is None or rank < teams - 7 or not average:
            continue
        hits = _hits(row, season)
        versus = allowed / average - 1
        l10 = hits["l10"]["rate"]
        score = 100 * (0.55 * _clamp(versus / 0.6, 0, 1) + 0.45 * (l10 if l10 is not None else 0.5))
        tier = "elite" if rank >= teams - 1 and (l10 or 0) >= 0.6 else "strong" if (l10 or 0) >= 0.5 else "lean"
        spots.append({"id": row.get("id"), "who": who, "opponent": row["opponentId"], "gameId": row.get("gameId"),
                      "startsAt": row.get("startsAt"), "market": row["propType"], "label": label_of(row),
                      "line": line_of(row), "rank": rank, "sznRank": szn_rank, "teams": teams,
                      "allowed": allowed, "average": average, "versus": _r(versus, 3), "hits": hits,
                      "best": best_price(row), "prices": prices(row), "tier": tier, "score": round(score)})
    spots.sort(key=lambda spot: -spot["score"])
    by_defense = defaultdict(int)
    for spot in spots:
        by_defense[(spot["opponent"], spot["who"]["position"])] += 1
    defenses = [{"team": team, "position": position, "props": count}
                for (team, position), count in sorted(by_defense.items(), key=lambda item: -item[1])[:6]]
    return {"spots": spots, "defenses": defenses}


# The lines Best Matchups reads: the production props. Anytime touchdowns
# have their own sheet, and an Over on interceptions isn't a matchup to want.
BEST_MARKETS = tuple(market for market in MARKET_STAT if market not in ("touchdowns", "interceptions"))


def _mean(values):
    return sum(values) / len(values) if values else None


def _defense_read(ctx, defense, position, stat):
    """What the defense allows the position in this stat against the league:
    its last five (most of the weight) and its season, pulled toward even
    while it has played few games. None when neither is known."""
    l5, rank, average, teams = _dvp_cell(ctx, defense, position, stat, "l5")
    szn, szn_rank, szn_average, _teams = _dvp_cell(ctx, defense, position, stat, "szn")
    parts = [(value / base, weight) for value, base, weight in ((l5, average, 0.6), (szn, szn_average, 0.4))
             if value is not None and base]
    if not parts:
        return None
    ratio = sum(value * weight for value, weight in parts) / sum(weight for _value, weight in parts)
    seen = ctx["dvp"][2].get(defense, 0)
    recent = l5 is not None
    return {"ratio": (ratio * seen + 3) / (seen + 3), "allowed": l5 if recent else szn,
            "average": average if recent else szn_average, "rank": rank if recent else szn_rank,
            "sznRank": szn_rank, "teams": teams}


def sheet_best(ctx):
    """Each game's best matchups: every posted line's More side, at any
    position, read four ways and scored 0-100.

      defense   what the opponent allows his position in that stat against
                the league (the most weight)
      edge      his recent average, moved by that defense and by his team's
                implied points, against the line
      form      how often he has cleared the line, last 10 and season
      market    the books' chance of the Over, their margin out

    The scouting notes (nfl_scouting.py: blitz, pressure, boxes, run
    defense, his splits and usage) move the score up to 12 either way, and
    come with the row. Only defenses that give up more than the league
    average count. One row per player (his best line), and each game's top
    row is marked."""
    import nfl_scouting
    season, opponents = ctx["season"], _opponents(ctx["games"])
    scout = ctx.get("scout")
    league_points = ctx.get("leaguePoints") or 22.0
    found = {}
    for row in ctx["mains"]:
        market, line, team = row.get("propType"), line_of(row), row.get("teamId")
        stat = MARKET_STAT.get(market) if market in BEST_MARKETS else None
        who = row_who(row, ctx["people"])
        positions = next((positions for key, _label, positions in DVP_STATS if key == stat), ())
        if not stat or who["position"] not in positions or not _finite(line) or line <= 0:
            continue
        if ctx["hurt"].get(row.get("playerId")) == "Out":
            continue
        values = values_of(row)
        game = _game_of(row, ctx["games"]) or (opponents.get(team) or (None,))[0]
        if len(values) < 4 or not game or game["started"] or team not in (game["home"], game["away"]):
            continue
        opponent = game["away"] if game["home"] == team else game["home"]
        defense = _defense_read(ctx, opponent, who["position"], stat)
        if not defense or defense["ratio"] <= 1:
            continue
        recent = 0.5 * _mean(values[-5:]) + 0.5 * _mean(values[-10:])
        points = game["points"].get(team)
        script = _clamp(points / league_points, 0.8, 1.2) if points else 1.0
        # A defense's number is the whole position group's, so it moves one
        # player's projection only part of the way.
        projection = recent * (1 + 0.6 * (defense["ratio"] - 1)) * (1 + 0.25 * (script - 1))
        edge = projection / line - 1
        hits = _hits(row, season)
        l10, szn = hits["l10"]["rate"], hits["szn"]["rate"]
        l10 = 0.5 if l10 is None else l10
        form = 0.65 * l10 + 0.35 * (l10 if szn is None else szn)
        chance, books = book_probability(row.get("apps"))
        parts = [(0.35, _clamp((defense["ratio"] - 0.85) / 0.5, 0, 1)), (0.25, _clamp((edge + 0.1) / 0.35, 0, 1)), (0.25, form)]
        if chance is not None:
            parts.append((0.15, _clamp((chance - 0.4) / 0.25, 0, 1)))
        spread = game.get("spread")
        favored = None if spread is None else spread if game["home"] == team else -spread
        notes = nfl_scouting.for_market(nfl_scouting.notes_for(scout, row.get("playerId"), team, opponent, favored), market) if scout else []
        score = 100 * sum(weight * part for weight, part in parts) / sum(weight for weight, _part in parts)
        # The notes move the score up to 12 either way.
        score = round(_clamp(score + 12 * nfl_scouting.lean_of(notes), 0, 100))
        key = row.get("playerId") or norm(who["name"])
        if key in found and found[key]["score"] >= score:
            continue
        found[key] = {"id": row.get("id"), "who": who, "opponent": opponent, "gameId": game["gameId"],
                      "startsAt": row.get("startsAt") or game["startsAt"], "market": market, "label": label_of(row),
                      "line": line, "rank": defense["rank"], "sznRank": defense["sznRank"], "teams": defense["teams"],
                      "allowed": _r(defense["allowed"], 1), "average": _r(defense["average"], 1),
                      "defense": _r(defense["ratio"] - 1, 3), "recent": _r(recent, 1), "projection": _r(projection, 1),
                      "edge": _r(edge, 3), "points": points, "hits": hits, "chance": _r(chance, 3), "books": books,
                      "best": best_price(row), "prices": prices(row), "status": ctx["hurt"].get(row.get("playerId")),
                      "notes": [{"text": note["text"], "lean": note["lean"] if note["weight"] else 0} for note in notes],
                      "tier": "elite" if score >= 75 else "strong" if score >= 60 else "lean", "score": score, "top": False}
    rows = sorted(found.values(), key=lambda item: (-item["score"], -(item["edge"] or 0)))
    marked = set()
    for item in rows:
        if item["gameId"] not in marked:
            marked.add(item["gameId"])
            item["top"] = True
    return {"rows": rows}


def sheet_goblins(ctx):
    rows, season = ctx["upcoming"], ctx["season"]
    mains = {(row.get("playerId"), row.get("propType")): line_of(row) for row in ctx["mains"]}
    lines = []
    for row in rows:
        kind = category(row)
        if kind not in ("GOBLIN", "DEMON"):
            continue
        chance, books = book_probability(row.get("apps"))
        if chance is None:
            continue
        median_price = median([app["over"] for app in row.get("apps") or [] if priced(app) and _finite(app.get("over"))] or [0]) or None
        lines.append({"id": row.get("id"), "who": row_who(row, ctx["people"]), "kind": kind.lower(),
                      "opponent": row.get("opponentId"), "gameId": row.get("gameId"), "startsAt": row.get("startsAt"),
                      "market": row.get("propType"), "label": label_of(row), "line": line_of(row),
                      "main": mains.get((row.get("playerId"), row.get("propType"))), "chance": _r(chance, 3),
                      "books": books, "price": median_price, "hits": _hits(row, season), "prices": prices(row)})
    lines.sort(key=lambda line: -(line["chance"] or 0))
    return {"lines": lines}


def streak(values, line):
    """Games in a row, newest first, over the line and under it."""
    over = under = 0
    for value in reversed(values):
        if value > line and not under:
            over += 1
        elif value < line and not over:
            under += 1
        else:
            break
    return over, under


def sheet_streaks(ctx):
    season, output = ctx["season"], []
    for row in ctx["mains"]:
        values, line = values_of(row), line_of(row)
        if len(values) < 5 or not _finite(line):
            continue
        over, under = streak(values, line)
        # Missing a 0.5 line (no touchdown, no interception) is most games
        # for most players: not a streak worth showing.
        if line <= 0.5:
            under = 0
        side = "under" if under > over else "over"
        run = max(over, under)
        hits = _hits(row, season, side)
        l10, l20, szn = (hits[key]["rate"] for key in ("l10", "l20", "szn"))
        if run < 3 and (l10 or 0) < 0.8:
            continue
        score = 100 * (0.4 * min(run / 10, 1) + 0.3 * (l10 or 0) + 0.2 * (l20 if l20 is not None else l10 or 0)
                       + 0.1 * (szn if szn is not None else l10 or 0))
        tag = ("hot" if side == "over" else "cold") if run >= 5 else "steady" if (l20 or 0) >= 0.75 else None
        recent = [(value > line) if side == "over" else (value < line) for value in values[-10:]]
        output.append({"id": row.get("id"), "who": row_who(row, ctx["people"]), "opponent": row.get("opponentId"),
                       "gameId": row.get("gameId"), "startsAt": row.get("startsAt"), "market": row.get("propType"),
                       "label": label_of(row), "line": line, "side": side, "streak": run, "hits": hits,
                       "recent": recent, "best": best_price(row, side), "tag": tag, "score": round(score)})
    output.sort(key=lambda item: (-item["score"], -item["streak"]))
    return {"rows": output}


def sheet_shop(ctx):
    season, found = ctx["season"], []
    rows = [row for row in ctx["upcoming"] if category(row) == "STANDARD"]
    # A better price at the same number: each book against the others.
    for row in rows:
        apps = [app for app in row.get("apps") or [] if priced(app)]
        if len(apps) < 3:
            continue
        best = None
        for app in apps:
            fair, books = book_probability(apps, leave_out=app["key"])
            if fair is None or books < 2:
                continue
            for side, chance in (("over", fair), ("under", 1 - fair)):
                odds = decimal(app.get(side))
                if odds is None:
                    continue
                edge = chance * odds - 1
                if best is None or edge > best["edge"]:
                    best = {"book": app["key"], "name": app.get("name") or app["key"], "side": side,
                            "price": app[side], "edge": edge, "fair": american(chance), "chance": chance, "books": books}
        if best and best["edge"] >= 0.03:
            found.append({"kind": "price", "id": row.get("id"), "who": row_who(row, ctx["people"]),
                          "opponent": row.get("opponentId"), "gameId": row.get("gameId"), "startsAt": row.get("startsAt"),
                          "market": row.get("propType"), "label": label_of(row), "line": line_of(row),
                          "side": best["side"], "book": best["book"], "bookName": best["name"], "price": best["price"],
                          "fair": best["fair"], "chance": _r(best["chance"], 3), "edge": _r(best["edge"], 3),
                          "books": best["books"], "hits": _hits(row, season, best["side"]), "prices": prices(row)})
    # A number off the market's: one app or book well away from the line
    # most of the others share.
    groups = defaultdict(list)
    for row in rows:
        groups[(row.get("playerId") or norm(row.get("playerName")), row.get("propType"))].append(row)
    for group in groups.values():
        if len(group) < 2:
            continue
        consensus = max(group, key=lambda row: (len([app for app in row.get("apps") or [] if priced(app)]), -abs(line_of(row) or 0)))
        market_books = len([app for app in consensus.get("apps") or [] if priced(app)])
        center = line_of(consensus)
        if market_books < 2 or not _finite(center):
            continue
        fair, _books = book_probability(consensus.get("apps"))
        for row in group:
            value = line_of(row)
            if row is consensus or not _finite(value) or abs(value - center) < max(0.5, 0.04 * abs(center)):
                continue
            side = "over" if value < center else "under"
            names = [app.get("name") or app["key"] for app in row.get("apps") or []]
            at_off, _h1, games_off = rate(values_of(row)[-10:], value, side)
            at_center, _h2, _games = rate(values_of(row)[-10:], center, side)
            found.append({"kind": "line", "id": row.get("id"), "who": row_who(row, ctx["people"]),
                          "opponent": row.get("opponentId"), "gameId": row.get("gameId"), "startsAt": row.get("startsAt"),
                          "market": row.get("propType"), "label": label_of(row), "line": value, "center": center,
                          "gap": _r(abs(value - center), 2), "side": side, "where": names,
                          "price": best_price(row, side), "marketBooks": market_books,
                          "chance": _r(fair if side == "over" else (1 - fair) if fair is not None else None, 3),
                          "l10": _r(at_off, 3), "l10Center": _r(at_center, 3), "games": games_off})
    found.sort(key=lambda item: -(item.get("edge") or (item["gap"] / max(abs(item["center"]), 1)) or 0))
    return {"rows": found}


def _seconds(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def sheet_steam(ctx):
    try:
        import line_moves
        recorded = line_moves.openings("nfl")
        moves = line_moves.recent(("nfl",)).get("moves") or []
        same = line_moves.norm
    except Exception:  # noqa: BLE001 -- no store, no history
        recorded, moves, same = {}, [], norm
    now_hour = int(time.time() // 3600)
    # Each prop's number at each book: where it opened (the recorded
    # opening, or the earliest move seen from it if that came first) and
    # where it is now.
    earliest = {}
    for move in moves:
        if move.get("kind") != "line" or not _finite(move.get("from")):
            continue
        key = (move.get("app"), same(move.get("player")), same(move.get("stat")))
        at = _seconds(move.get("at")) or 0
        if key not in earliest or at < earliest[key][0]:
            earliest[key] = (at, move["from"])
    props, names = defaultdict(dict), {}
    for source in ("pp", "books"):
        data = recorded.get(source) or {}
        for key, values in (data.get("now") or {}).items():
            parts = key.split("|")
            if source == "pp" and len(parts) == 3:
                book, (player, stat, hour) = "prizepicks", parts
                line, over, under = values[0], None, None
                names.setdefault(stat, (data.get("stats") or {}).get(stat))
            elif source == "books" and len(parts) == 4:
                book, player, stat, hour = parts
                line, over, under = values[0], values[1], values[2]
            else:
                continue
            if not hour.isdigit() or int(hour) <= now_hour or not _finite(line):
                continue
            opened = (data.get("open") or {}).get(key)
            open_line, open_over, open_at = (opened[0], opened[1] if source == "books" else None, opened[-1]) if opened else (line, over, time.time())
            before = earliest.get((book, player, stat))
            if before and before[0] < (open_at or 0):
                open_line = before[1]
            props[(player, stat, hour)][book] = {"open": open_line, "now": line, "openOver": open_over, "over": over, "under": under}
    # Faces, teams and the game from the board.
    board = {}
    for row in ctx["upcoming"]:
        for label in (label_of(row), row.get("propLabel")):
            board.setdefault((same(row.get("playerName")), same(label)), row)
    output = []
    for (player, stat, _hour), by_book in props.items():
        row = board.get((player, stat))
        books = {book: entry for book, entry in by_book.items() if book != "prizepicks"}
        moved = [entry["now"] - entry["open"] for entry in books.values() if _finite(entry["open"])]
        pp = by_book.get("prizepicks")
        pp_moved = bool(pp and _finite(pp["open"]) and pp["now"] != pp["open"])
        if not any(moved) and not pp_moved:
            juice_only = [entry for entry in books.values() if implied(entry["over"]) is not None and implied(entry["openOver"]) is not None]
            if not juice_only:
                continue
        change = median(moved) if moved else (pp["now"] - pp["open"] if pp_moved else 0)
        juice = [100 * (implied(entry["over"]) - implied(entry["openOver"])) for entry in books.values()
                 if entry["now"] == entry["open"] and implied(entry["over"]) is not None and implied(entry["openOver"]) is not None]
        juice_change = median(juice) if juice else 0
        if change == 0 and abs(juice_change) < 3 and not pp_moved:
            continue
        direction = "up" if change > 0 or (change == 0 and (juice_change > 0 or (pp_moved and pp["now"] > pp["open"]))) else "down"
        agree = sum((value > 0) if direction == "up" else (value < 0) for value in moved)
        line_now = median([entry["now"] for entry in books.values()]) if books else pp["now"]
        line_open = median([entry["open"] for entry in books.values()]) if books else pp["open"]
        size = abs(change) / max(abs(line_open or 1), 1)
        share = agree / len(moved) if moved else 1.0
        score = round(100 * (0.6 * min(size / 0.08, 1) + 0.25 * share + 0.15 * min(abs(juice_change) / 10, 1)))
        label = (label_of(row) if row else None) or names.get(stat) or stat
        output.append({"who": row_who(row, ctx["people"]) if row else {"name": player, "headshot": None, "team": None, "position": ""},
                       "opponent": (row or {}).get("opponentId"), "gameId": (row or {}).get("gameId"),
                       "startsAt": (row or {}).get("startsAt"), "label": label, "open": line_open, "now": line_now,
                       "change": _r(change, 2), "juice": _r(juice_change, 1), "direction": direction,
                       "books": len(books), "agree": agree,
                       "prizepicks": {"open": pp["open"], "now": pp["now"]} if pp else None,
                       "byBook": [{"book": book, **entry} for book, entry in sorted(by_book.items())],
                       "tag": "steam" if agree >= 2 and share >= 0.5 and score >= 30 else "drift", "score": score})
    output.sort(key=lambda item: -item["score"])
    started = any((recorded.get(source) or {}).get("open") for source in ("pp", "books"))
    return {"rows": output, "recording": not started}


def _defense_tds(ctx, defense, position):
    allowed, rank, average, _teams = _dvp_cell(ctx, defense, position, "rush_rec_tds", "szn")
    return allowed, rank, average


def td_model(ctx):
    """One touchdown model for TD Scorers, First TD and Red Zone, so a
    player's chance reads the same on all three.

    A team's expected rushing and receiving touchdowns are its implied
    points (the closing spread and total) times the league's touchdowns per
    point this season. They are shared among its available players by their
    part of the team's touchdowns, red-zone looks and touches this season,
    tilted toward the positions the defense gives up touchdowns to, and the
    team total is kept. A player's chance of at least one is 1 - e^-expected."""
    seasons, pbp = ctx["seasons"], ctx["pbp"]
    total_tds = sum(entry["tds"] for entry in seasons.values())
    finals = [numeric(game.get(key)) for game in finder.games_index().values()
              if str(game.get("season")) == str(ctx["season"]) and game["final"] for key in ("home_score", "away_score")]
    points = sum(value for value in finals if value is not None)
    per_point = total_tds / points if points and len([value for value in finals if value is not None]) >= 16 else 0.105
    team_totals = defaultdict(lambda: {"tds": 0, "touches": 0, "rz": 0})
    for player_id, entry in seasons.items():
        team = (ctx["people"].get(player_id) or {}).get("team") or entry["team"]
        play = pbp["players"].get(player_id) or {"rz": [0, 0, 0, 0]}
        totals = team_totals[team]
        totals["tds"] += entry["tds"]
        totals["touches"] += entry["carries"] + entry["targets"]
        totals["rz"] += play["rz"][0] + play["rz"][1]
    opponents = _opponents(ctx["games"])
    by_team = defaultdict(list)
    for player_id, entry in seasons.items():
        person = ctx["people"].get(player_id)
        team = (person or {}).get("team")
        if not person or team not in opponents or person["position"] not in SKILL or not available(person, ctx["hurt"]):
            continue
        totals = team_totals[team]
        play = pbp["players"].get(player_id) or {"rz": [0, 0, 0, 0], "longTds": 0, "d2": [0, 0], "q1": [0, 0]}
        looks = play["rz"][0] + play["rz"][1]
        touches = entry["carries"] + entry["targets"]
        if not totals["touches"]:
            continue
        # Touches are the steadiest part of a role, so his touchdown and
        # red-zone shares start from it and move with what he's done (a few
        # games of each count for little).
        steady = touches / totals["touches"]
        share = (0.35 * (entry["tds"] + 3 * steady) / (totals["tds"] + 3)
                 + 0.45 * (looks + 6 * steady) / (totals["rz"] + 6) + 0.20 * steady)
        if share < 0.01:
            continue
        game, opponent = opponents[team]
        allowed, rank, average = _defense_tds(ctx, opponent, person["position"])
        games_seen = ctx["dvp"][2].get(opponent, 0)
        tilt = 1.0
        if allowed is not None and average:
            tilt = _clamp(((allowed * games_seen + average * 4) / (games_seen + 4)) / average, 0.8, 1.25)
        by_team[team].append({"id": player_id, "person": person, "entry": entry, "play": play, "share": share,
                              "tilt": tilt, "game": game, "opponent": opponent, "looks": looks, "touches": touches,
                              "allowed": allowed, "rank": rank, "average": average})
    model = {}
    for team, players in by_team.items():
        game = players[0]["game"]
        points = game["points"].get(team) or ctx["leaguePoints"]
        team_tds = points * per_point
        shares = sum(player["share"] for player in players)
        weighted = sum(player["share"] * player["tilt"] for player in players)
        for player in players:
            # Shares of the available players fill the team (a missing
            # starter's work goes to the others); the tilt moves some
            # between positions without changing the team's total.
            portion = player["share"] / shares if shares else 0
            tilted = player["share"] * player["tilt"] / weighted if weighted else portion
            expected = team_tds * tilted
            model[player["id"]] = {**player, "teamTds": team_tds, "points": points, "portion": portion,
                                   "expected": expected, "chance": 1 - math.exp(-expected)}
    return model, per_point


def _touchdown_lines(ctx):
    return {row.get("playerId"): row for row in ctx["upcoming"]
            if row.get("propType") == "touchdowns" and line_of(row) == 0.5 and category(row) == "STANDARD"}


def sheet_td(ctx):
    model, per_point = td_model(ctx)
    lines = _touchdown_lines(ctx)
    players = []
    for player_id, item in model.items():
        person, entry, play = item["person"], item["entry"], item["play"]
        if item["touches"] / max(entry["games"], 1) < 3:
            continue
        line_row = lines.get(player_id)
        best = best_price(line_row) if line_row else None
        log = values_of(line_row)[-10:] if line_row else []
        team_rz = sum((other["play"]["rz"][0] + other["play"]["rz"][1]) for other in model.values() if other["person"]["team"] == person["team"])
        players.append({"who": _who(person), "gameId": item["game"]["gameId"], "opponent": item["opponent"],
                        "status": ctx["hurt"].get(player_id), "chance": _r(item["chance"], 3), "fair": american(item["chance"]),
                        "expected": _r(item["expected"], 2), "share": _r(item["portion"], 3), "tilt": _r(item["tilt"], 2),
                        "teamTds": _r(item["teamTds"], 2), "teamPoints": item["points"],
                        "best": best, "edge": _r(item["chance"] - implied(best["price"]), 3) if best else None,
                        "tdGames": sum(1 for value in log if value > 0.5) if log else None, "logGames": len(log) or None,
                        "tds": int(entry["tds"]), "games": entry["games"], "rzLooks": item["looks"],
                        "rzShare": _r(item["looks"] / team_rz, 3) if team_rz else None,
                        "touches": _r(item["touches"] / max(entry["games"], 1)), "defenseTds": _r(item["allowed"], 2),
                        "defenseRank": item["rank"], "leagueTds": _r(item["average"], 2)})
    players.sort(key=lambda player: -(player["chance"] or 0))
    cards = []
    for game in ctx["games"]:
        if game["started"]:
            continue
        sides = []
        for team, opponent in ((game["away"], game["home"]), (game["home"], game["away"])):
            leaks = []
            for position in SKILL:
                allowed, rank, average = _defense_tds(ctx, opponent, position)
                leaks.append({"position": position, "allowed": _r(allowed, 2), "rank": rank, "average": _r(average, 2)})
            points = game["points"].get(team)
            sides.append({"team": team, "opponent": opponent, "points": points,
                          "tds": _r((points or ctx["leaguePoints"]) * per_point, 2), "defense": leaks})
        cards.append({"gameId": game["gameId"], "sides": sides})
    return {"players": players, "cards": cards, "perPoint": _r(per_point, 4)}


def sheet_firsttd(ctx):
    pbp = ctx["pbp"]
    model, _per_point = td_model(ctx)
    league = pbp["league"]
    offense_first = 1 - (league["nonOffenseFirst"] / league["games"]) if league["games"] >= 8 else 0.95
    teams, defense = pbp["teams"], pbp["defense"]
    all_early = [entry["early"] for entry in teams.values()]
    league_early = sum(item[1] for item in all_early) / max(sum(item[0] for item in all_early), 1)
    cards = []
    for game in ctx["games"]:
        if game["started"]:
            continue
        sides, weights = [], {}
        for team, opponent in ((game["away"], game["home"]), (game["home"], game["away"])):
            entry = teams.get(team) or {"early": [0, 0, 0, 0], "firstTd": 0, "games": 0, "d2": [0, 0], "rz": [0, 0], "q1": [0, 0]}
            against = defense.get(opponent) or {"early": [0, 0]}
            # Early touchdown rates pulled toward the league's by two games.
            rate_for = (entry["early"][1] + 2 * league_early) / (entry["early"][0] + 2)
            rate_against = (against["early"][1] + 2 * league_early) / (against["early"][0] + 2)
            points = game["points"].get(team) or ctx["leaguePoints"]
            weights[team] = points * (0.5 + rate_for) * (0.5 + rate_against)
            plays = entry["early"][2] + entry["early"][3]
            sides.append({"team": team, "opponent": opponent, "points": game["points"].get(team),
                          "early": _r(entry["early"][1] / entry["early"][0], 3) if entry["early"][0] else None,
                          "earlyGames": entry["early"][0], "earlyTds": entry["early"][1],
                          "allowed": _r(against["early"][1] / against["early"][0], 3) if against["early"][0] else None,
                          "allowedGames": against["early"][0], "allowedTds": against["early"][1],
                          "firstTd": entry["firstTd"], "games": entry["games"],
                          "run": _r(entry["early"][2] / plays, 3) if plays else None})
        total = sum(weights.values())
        for side in sides:
            team = side["team"]
            side["chance"] = _r(offense_first * weights[team] / total, 3) if total else None
            team_entry = teams.get(team) or {"d2": [0, 0], "q1": [0, 0]}
            players = []
            for player_id, item in model.items():
                if item["person"]["team"] != team:
                    continue
                play = item["play"]
                early = sum(play["d2"]) / sum(team_entry["d2"]) if sum(team_entry["d2"]) else None
                q1 = sum(play["q1"]) / sum(team_entry["q1"]) if sum(team_entry["q1"]) else None
                chance = (side["chance"] or 0) * item["expected"] / item["teamTds"] if item["teamTds"] else 0
                players.append({"who": _who(item["person"]), "status": ctx["hurt"].get(player_id), "share": _r(item["expected"] / item["teamTds"], 3),
                                "early": _r(early, 3), "q1": _r(q1, 3), "earlyKind": "rush" if play["d2"][0] >= play["d2"][1] else "target",
                                "firstTd": play.get("firstTd", 0), "games": item["entry"]["games"], "chance": _r(chance, 3),
                                "fair": american(chance)})
            players.sort(key=lambda player: -(player["chance"] or 0))
            side["players"] = [player for player in players if (player["chance"] or 0) >= 0.01][:12]
        cards.append({"gameId": game["gameId"], "sides": sides})
    best = sorted(({"team": side["team"], "opponent": side["opponent"], "early": side["early"], "earlyTds": side["earlyTds"],
                    "earlyGames": side["earlyGames"]} for card in cards for side in card["sides"] if side["early"] is not None),
                  key=lambda item: -(item["early"] or 0))[:5]
    soft = sorted(({"team": side["opponent"], "versus": side["team"], "allowed": side["allowed"]}
                   for card in cards for side in card["sides"] if side["allowed"] is not None),
                  key=lambda item: -(item["allowed"] or 0))[:6]
    return {"cards": cards, "league": _r(league_early, 3), "offenseFirst": _r(offense_first, 3), "bestEarly": best, "softEarly": soft}


def sheet_redzone(ctx):
    pbp = ctx["pbp"]
    model, _per_point = td_model(ctx)
    teams, defense = pbp["teams"], pbp["defense"]
    team_games = sum(entry["games"] for entry in teams.values())
    trips = sum(entry["trips"] for entry in teams.values())
    td_trips = sum(entry["tdTrips"] for entry in teams.values())
    league_trips = trips / team_games if team_games else 3.2
    league_td = td_trips / trips if trips else 0.55
    lines = _touchdown_lines(ctx)
    team_rz = defaultdict(int)
    for player_id, play in pbp["players"].items():
        team_rz[play.get("team")] += play["rz"][0] + play["rz"][1]
    output = []
    for player_id, item in model.items():
        person, entry, play = item["person"], item["entry"], item["play"]
        team, opponent, game = person["team"], item["opponent"], item["game"]
        if not entry["games"] or item["looks"] / entry["games"] < 1:
            continue
        team_entry = teams.get(team) or {"trips": 0, "tdTrips": 0, "games": 0}
        against = defense.get(opponent) or {"trips": 0, "tdTrips": 0, "games": 0}
        line_row = lines.get(player_id)
        best = best_price(line_row) if line_row else None
        output.append({"who": _who(person), "gameId": game["gameId"], "opponent": opponent,
                       "home": game["home"] == team, "status": ctx["hurt"].get(player_id),
                       "share": _r(item["looks"] / team_rz[team], 3) if team_rz[team] else None,
                       "looks": _r(item["looks"] / entry["games"]), "inside10": _r(play["rz"][2] / entry["games"]),
                       "rzTds": play["rz"][3], "games": entry["games"],
                       "teamTrips": _r(team_entry["trips"] / team_entry["games"], 2) if team_entry["games"] else None,
                       "teamRate": _r(team_entry["tdTrips"] / team_entry["trips"], 3) if team_entry["trips"] else None,
                       "allowedTrips": _r(against["trips"] / against["games"], 2) if against["games"] else None,
                       "allowedRate": _r(against["tdTrips"] / against["trips"], 3) if against["trips"] else None,
                       "teamTds": _r(item["teamTds"], 2), "teamPoints": item["points"], "portion": _r(item["expected"] / item["teamTds"], 3),
                       "expected": _r(item["expected"], 2), "chance": _r(item["chance"], 3), "fair": american(item["chance"]),
                       "best": best, "edge": _r(item["chance"] - implied(best["price"]), 3) if best else None,
                       "defenseRank": item["rank"], "defenseTds": _r(item["allowed"], 2)})
    top = max((row["chance"] or 0 for row in output), default=0)
    for row in output:
        row["score"] = round(100 * (row["chance"] or 0) / top) if top else 0
    output.sort(key=lambda row: -(row["chance"] or 0))
    leaky = sorted(({"team": team, "trips": _r(entry["trips"] / entry["games"], 2),
                     "tdRate": _r(entry["tdTrips"] / entry["trips"], 3) if entry["trips"] else None,
                     "tds": _r(entry["tdTrips"] / entry["games"], 2)}
                    for team, entry in defense.items() if entry["games"]), key=lambda item: -(item["tds"] or 0))[:6]
    return {"rows": output, "league": {"trips": _r(league_trips, 2), "tdRate": _r(league_td, 3)}, "leaky": leaky}


def _zone_table(pbp):
    """defense -> zone -> [yards per target, rank (1 = fewest), targets]."""
    league = pbp["league"]["zones"]
    output = {}
    for zone in ZONES:
        column = {}
        for team, entry in pbp["defense"].items():
            cell = entry["zones"].get(zone)
            column[team] = cell[1] / cell[0] if cell and cell[0] >= 5 else None
        ranks = _rank(column)
        for team, value in column.items():
            output.setdefault(team, {})[zone] = [_r(value, 2), ranks[team], (pbp["defense"][team]["zones"].get(zone) or [0])[0]]
    averages = {zone: _r(league[zone][1] / league[zone][0], 2) if league.get(zone) and league[zone][0] else None for zone in ZONES}
    overall = {}
    for team, entry in pbp["defense"].items():
        targets = sum(cell[0] for cell in entry["zones"].values())
        overall[team] = sum(cell[1] for cell in entry["zones"].values()) / targets if targets >= 20 else None
    return output, averages, _rank(overall)


def sheet_zones(ctx):
    pbp = ctx["pbp"]
    table, averages, overall = _zone_table(pbp)
    ranked = len([value for value in overall.values() if value is not None])
    lines = {}
    for row in ctx["mains"]:
        if row.get("propType") == "receiving_yards":
            lines[row.get("playerId")] = row
    opponents = _opponents(ctx["games"])
    output = []
    for player_id, play in pbp["players"].items():
        person = ctx["people"].get(player_id)
        team = (person or {}).get("team")
        if not person or team not in opponents or person["position"] not in ("WR", "TE", "RB") or not available(person, ctx["hurt"]):
            continue
        targets = sum(cell[0] for cell in play["zones"].values())
        if targets < 8:
            continue
        game, opponent = opponents[team]
        defense = table.get(opponent) or {}
        raw, weight, zones = 0.0, 0.0, []
        for zone in ZONES:
            cell = play["zones"].get(zone)
            if not cell:
                continue
            share = cell[0] / targets
            allowed = defense.get(zone) or [None, None, 0]
            if allowed[0] is not None and averages.get(zone):
                raw += share * allowed[0] / averages[zone]
                weight += share
            zones.append({"zone": zone, "share": _r(share, 3), "targets": cell[0], "yards": cell[1],
                          "allowed": allowed[0], "rank": allowed[1], "league": averages.get(zone)})
        if not weight:
            continue
        index = raw / weight
        zones.sort(key=lambda item: -item["share"])
        top = zones[0]
        prime = top["share"] >= 0.25 and top["rank"] is not None and top["rank"] >= ranked - 4
        line_row = lines.get(player_id)
        output.append({"who": _who(person, team), "gameId": game["gameId"], "opponent": opponent,
                       "status": ctx["hurt"].get(player_id), "targets": targets, "zones": zones[:3],
                       "index": _r(index, 3), "score": int(_clamp(round(50 + 100 * (index - 1)), 0, 100)), "prime": prime,
                       "defenseRank": overall.get(opponent), "teams": ranked,
                       "line": line_of(line_row) if line_row else None,
                       "best": best_price(line_row) if line_row else None,
                       "hits": _hits(line_row, ctx["season"]) if line_row else None})
    output.sort(key=lambda item: -item["score"])
    softest = []
    for team, zones in table.items():
        for zone, (allowed, rank, count) in zones.items():
            if rank is not None:
                softest.append({"team": team, "zone": zone, "allowed": allowed, "rank": rank, "targets": count})
    softest.sort(key=lambda item: (-item["rank"], -(item["allowed"] or 0)))
    return {"rows": output, "averages": averages, "softest": softest[:6], "teams": ranked}


# Which defenders line up across from each position (depth chart slots).
COVERAGE = {"WR": ("LCB", "RCB", "NB"), "TE": ("SS", "FS", "MLB", "LILB", "WLB"), "RB": ("MLB", "LILB", "RILB", "WLB", "SLB")}
COVER_COUNT = {"WR": 3, "TE": 3, "RB": 2}


def combine_index():
    def load():
        rows = finder._rows(f"{RELEASE}/combine/combine.csv")
        found = {}
        for row in rows:
            pfr = str(row.get("pfr_id") or "").strip()
            if not pfr or pfr == "NA":
                continue
            found[pfr] = {key: numeric(row.get(key)) for key in ("forty", "vertical", "broad_jump", "cone", "shuttle")}
            found[pfr]["year"] = numeric(row.get("season"))
        return found
    return cached_nfl(NFLCacheDomain.PLAYERS, (VERSION, "combine"), load)


def mph(forty):
    """Average speed over a 40-yard dash."""
    return 40 * 3600 / 1760 / forty if _finite(forty) and forty > 0 else None


def sheet_speed(ctx):
    combine = combine_index()
    by_pfr = {}
    for person in ctx["people"].values():
        if person.get("pfr"):
            by_pfr[person["id"]] = combine.get(person["pfr"])
    try:
        depth = finder._depth_latest(ctx["season"])
    except Exception:  # noqa: BLE001 -- no depth chart, no matchups
        depth = {}
    opponents = _opponents(ctx["games"])
    wanted = {"WR": "receiving_yards", "TE": "receiving_yards", "RB": "rushing_yards"}
    output = []
    for row in ctx["mains"]:
        who = row_who(row, ctx["people"])
        position, team = who["position"], row.get("teamId")
        if wanted.get(position) != row.get("propType") or team not in opponents:
            continue
        times = by_pfr.get(row.get("playerId")) or {}
        speed = mph(times.get("forty"))
        if speed is None:
            continue
        game, opponent = opponents[team]
        rows = (depth.get(opponent) or {}).get("rows") or []
        defenders = []
        for slot in COVERAGE[position]:
            for entry in rows:
                if str(entry.get("pos_abb") or "").upper() == slot and str(entry.get("pos_rank")) == "1":
                    person = ctx["people"].get(entry.get("gsis_id")) or {}
                    if any(item["id"] == entry.get("gsis_id") for item in defenders):
                        continue
                    record = by_pfr.get(entry.get("gsis_id")) or {}
                    defenders.append({"id": entry.get("gsis_id"), "name": entry.get("player_name") or person.get("name"),
                                      "slot": slot, "forty": record.get("forty"), "mph": _r(mph(record.get("forty")), 2),
                                      "headshot": person.get("headshot") or None})
                    break
            if len(defenders) >= COVER_COUNT[position]:
                break
        timed = [item for item in defenders if item["mph"] is not None]
        if not timed:
            continue
        fastest = max(item["mph"] for item in timed)
        edge = speed - fastest
        for item in timed:
            item["edge"] = _r(speed - item["mph"], 2)
        tag = "burner" if edge >= 0.4 else "faster" if edge > 0.1 else "even" if edge >= -0.1 else "slower"
        hits = _hits(row, ctx["season"])
        l10 = hits["l10"]["rate"]
        score = int(_clamp(round(50 + 40 * edge + 20 * ((l10 if l10 is not None else 0.5) - 0.5)), 0, 100))
        output.append({"who": who, "gameId": game["gameId"], "opponent": opponent, "label": label_of(row),
                       "line": line_of(row), "best": best_price(row), "hits": hits, "forty": times.get("forty"),
                       "mph": _r(speed, 2), "vertical": times.get("vertical"), "broad": times.get("broad_jump"),
                       "cone": times.get("cone"), "shuttle": times.get("shuttle"), "defenders": defenders,
                       "faster": sum(1 for item in timed if speed > item["mph"]), "timed": len(timed),
                       "edge": _r(edge, 2), "tag": tag, "score": score})
    output.sort(key=lambda item: -item["score"])
    return {"rows": output}


BUILDERS = {"best": sheet_best, "td": sheet_td, "firsttd": sheet_firsttd, "streaks": sheet_streaks, "zones": sheet_zones,
            "redzone": sheet_redzone, "speed": sheet_speed, "steam": sheet_steam, "shop": sheet_shop,
            "dvp": sheet_dvp, "soft": sheet_soft, "goblins": sheet_goblins}
NEEDS = {"best": ("dvp", "lines", "scout"), "td": ("pbp", "seasons", "dvp", "lines"), "firsttd": ("pbp", "seasons", "dvp"), "streaks": ("lines",),
         "zones": ("pbp", "lines"), "redzone": ("pbp", "seasons", "dvp", "lines"), "speed": ("lines",),
         "steam": ("lines",), "shop": ("lines",), "dvp": ("dvp",), "soft": ("dvp", "lines"), "goblins": ("lines",)}


def context(season, needs, now=None):
    week, games = week_games(season, now)
    ctx = {"season": season, "week": week, "games": games, "people": people(season),
           "hurt": injuries(season, week) if week else {}, "leaguePoints": _league_points(season)}
    if "dvp" in needs or "seasons" in needs:
        rows = season_rows(season)
        if "dvp" in needs:
            ctx["dvp"] = dvp_table(rows, finder.games_index())
        ctx["seasons"] = player_seasons(rows)
    if "pbp" in needs:
        ctx["pbp"] = pbp_summary(season)
    if "scout" in needs:
        try:
            import nfl_scouting
            ctx["scout"] = nfl_scouting.table(season)
        except Exception:  # noqa: BLE001 -- the sheet stands on its other parts
            ctx["scout"] = None
    if "lines" in needs:
        rows = upcoming(board_rows(season), now)
        ctx["upcoming"], ctx["mains"] = rows, main_lines(rows)
    else:
        ctx["upcoming"], ctx["mains"] = [], []
    return ctx


def build(name, season=None, now=None):
    if name not in BUILDERS:
        raise ValueError("Unknown sheet")
    season = season or season_now(now)
    ctx = context(season, NEEDS[name], now)
    body = BUILDERS[name](ctx)
    return {"sheet": name, "season": season, "week": ctx["week"], "games": ctx["games"],
            "updatedAt": datetime.now(timezone.utc).isoformat(), **body}


def sheet(name, season=None):
    """A sheet for this week, built once and kept a few minutes (steam and
    the price sheets move fastest, so they are kept the shortest)."""
    if name not in BUILDERS:
        raise ValueError("Unknown sheet")
    season = season or season_now()
    minute = int(time.time() // (180 if name in ("steam", "shop", "goblins") else 600))
    return cached_nfl(NFLCacheDomain.PROJECTIONS, (VERSION, "sheet", name, season, minute), lambda: build(name, season))
