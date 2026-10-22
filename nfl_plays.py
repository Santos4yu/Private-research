"""How an NFL matchup plays: the looks a defense gives and how a player does
against each, and where he ranks at his position in what he produces. Built
from nflverse's free season files for the Props tab's NFL player page
(src/NflMatchupPage.jsx, through /api/nfl?resource=finder-plays).

  run       a ball carrier's designed runs (no scrambles, kneel-downs or
            two-point tries) by box count (FTN's charting: 6 or fewer in the
            box, 7, 8 or more), by direction (left, middle, right: a run at
            either guard counts as the middle) and by lane (the hole the
            scorer wrote down: end, tackle, guard or middle); and what each
            defense allows running backs the same three ways
  targets   a receiver's targets by depth (air yards: behind the line, 0-9,
            10-19, 20+), by area (left, middle, right) and with or without a
            blitz (five or more rushers), his share of his team's targets
            each way; and a quarterback's attempts the same ways and on
            play-action. Each defense: the throws it faced each way and the
            yards an attempt it allowed
  coverage  targets against man (Cover 0, Cover 1, 2-Man), Cover 3 and split
            safety (Cover 2, 4, 6, 9), from the NFL's participation file. It
            comes out after a season ends, so until then last season's
            stands in (data/nfl/coverage-<season>.json, written by
            tools/build_nfl_coverage.py) and the page says which season
  metrics   production, volume and efficiency, each ranked among his
            position (the regulars: 1.5 carries plus targets, or attempts
            plus carries, a team game; efficiency needs more)
  faced     every player at a position who has faced a defense this season,
            what he put up and his line that day where line_archive.py kept
            it, else his average going in

The run definitions reproduce RotoBot's published numbers to the carry
(Jahmyr Gibbs and Green Bay before 2026 week 7: light box 54 carries, 289
yards, 11th of 65 backs; Green Bay 2.62 a carry up the middle, the fewest).
Only counts are kept ([plays, yards] and the like), and rates and ranks are
worked out when a page asks (for_player), so a season's table stays small
enough for the durable cache.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import math
import time
from collections import defaultdict
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.sports.nfl.cache import NFLCacheDomain, cached_nfl, store_nfl
from backend.sports.nfl.services.nflverse import RELEASE, canonical_team

VERSION = "nfl-plays-v1"
USER_AGENT = {"User-Agent": "KrazyData-NFL-plays/1.0"}
PBP_FIELDS = ("game_id", "play_id", "season_type", "week", "posteam", "defteam", "play_type", "rush", "pass_attempt", "sack",
              "qb_dropback", "qb_scramble", "qb_kneel", "qb_spike", "two_point_attempt", "rusher_player_id", "receiver_player_id",
              "passer_player_id", "passer_id", "yards_gained", "complete_pass", "air_yards", "yards_after_catch", "pass_location", "run_location",
              "run_gap", "yardline_100", "first_down", "rush_touchdown", "pass_touchdown", "interception", "epa", "success", "cpoe")
WEEKLY_FIELDS = ("player_id", "player_display_name", "player_name", "position", "headshot_url", "week", "season_type", "game_id", "team",
                 "opponent_team", "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "sacks_suffered",
                 "sack_yards_lost", "carries", "rushing_yards", "rushing_tds", "receptions", "targets", "receiving_yards", "receiving_tds",
                 "fantasy_points")
COVERAGE_FILE = Path(__file__).resolve().parent / "data" / "nfl" / "coverage-{season}.json"

# The buckets of each split, in the order the page lists them.
RUN_SPLITS = {"box": ("light", "base", "stacked"), "direction": ("left", "middle", "right"),
              "lane": ("end", "tackle", "guard", "middle")}
PASS_SPLITS = {"depth": ("behind", "short", "intermediate", "deep"), "area": ("left", "middle", "right"),
               "blitz": ("blitz", "calm"), "playAction": ("pa", "nopa"), "coverage": ("man", "cover3", "split")}
COVERAGE = {"COVER_0": "man", "COVER_1": "man", "2_MAN": "man", "COVER_3": "cover3",
            "COVER_2": "split", "COVER_4": "split", "COVER_6": "split", "COVER_9": "split"}
# Which splits each position's page reads ("target": his targets, "pass": his throws).
PAGE_SPLITS = {"RB": (("run", "box"), ("run", "direction"), ("run", "lane"), ("target", "depth"), ("target", "coverage")),
               "WR": (("target", "depth"), ("target", "area"), ("target", "blitz"), ("target", "coverage")),
               "TE": (("target", "depth"), ("target", "area"), ("target", "blitz"), ("target", "coverage")),
               "QB": (("pass", "depth"), ("pass", "playAction"), ("pass", "blitz"), ("pass", "coverage"))}
GROUPS = {"QB": "QB", "RB": "RB", "FB": "RB", "WR": "WR", "TE": "TE"}

SPLIT_MIN = 8          # plays in a bucket before his rate there is ranked
PROFILE_MIN = 15       # carries or targets (attempts: 60) before his shares are ranked
REGULAR_PER_WEEK = 1.5  # carries + targets (a quarterback: attempts + carries) a team game to be ranked at all


# ---------------------------------------------------------------- reading

def _num(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


def _flag(row, key):
    return _num(row.get(key)) == 1


def _present(value):
    return value not in (None, "", "NA")


def _play_key(game_id, play_id):
    number = _num(play_id)
    return (game_id, int(number)) if game_id and number is not None else None


def _read(url, fields, gz=False):
    """A release file a row at a time, only `fields` kept (csv.reader with
    the header's positions: a quarter faster than DictReader over the 372
    play-by-play columns, and the whole file is never held). Nothing when it
    isn't published yet (404); any other failure raises, so an outage is
    never kept as "no data"."""
    try:
        response = urlopen(Request(url, headers=USER_AGENT), timeout=40)
    except HTTPError as error:
        if error.code == 404:
            return
        raise
    with response:
        raw = gzip.GzipFile(fileobj=response) if gz else response
        reader = csv.reader(io.TextIOWrapper(raw, encoding="utf-8-sig"))
        header = next(reader, None) or []
        at = {name: index for index, name in enumerate(header)}
        picks = [(field, at[field]) for field in fields if field in at]
        for line in reader:
            yield {field: (line[index] if index < len(line) else "") for field, index in picks}


# ---------------------------------------------------------------- buckets

def box_of(count):
    """6 or fewer in the box is light, 7 base, 8 or more stacked. FTN marks
    a play it couldn't chart 0."""
    if count is None or count <= 0:
        return None
    return "light" if count <= 6 else "base" if count == 7 else "stacked"


def direction_of(location, gap):
    """A run at either guard is up the middle; left and right are the
    tackles and ends."""
    if location == "middle" or gap == "guard":
        return "middle"
    return location if location in ("left", "right") else None


def lane_of(location, gap):
    if location == "middle":
        return "middle"
    return gap if gap in ("end", "tackle", "guard") else None


def depth_of(air):
    if air is None:
        return None
    return "behind" if air < 0 else "short" if air < 10 else "intermediate" if air < 20 else "deep"


def area_of(location):
    return location if location in ("left", "middle", "right") else None


def _add(cells, bucket, *values):
    if bucket is None:
        return
    cell = cells.setdefault(bucket, [0] * len(values))
    for index, value in enumerate(values):
        cell[index] += value


# ---------------------------------------------------------------- the table

# Totals kept at 0: a back's 0 broken tackles is a number, not a missing one.
KEEP_ZERO = {"afterContact", "broken"}
WEEKLY_TOTALS = (("carries", "carries"), ("rushing_yards", "rushYds"), ("rushing_tds", "rushTds"), ("receptions", "rec"),
                 ("targets", "targets"), ("receiving_yards", "recYds"), ("receiving_tds", "recTds"), ("completions", "cmp"),
                 ("attempts", "att"), ("passing_yards", "passYds"), ("passing_tds", "passTds"), ("passing_interceptions", "ints"),
                 ("sacks_suffered", "sacks"), ("sack_yards_lost", "sackYds"), ("fantasy_points", "fantasy"))


def summarize(plays, charting, weekly, coverage=None, snaps=None, contact=None):
    """The season's table from its parts:

      plays     play-by-play rows (PBP_FIELDS), any order
      charting  {(game_id, play_id): {"box": int | None, "blitz": bool,
                "pa": bool}} -- FTN's charting
      weekly    stats_player_week rows (WEEKLY_FIELDS)
      coverage  {(game_id, play_id): "man" | "cover3" | "split" | None} --
                the participation file, when it's out for the season
      snaps     {gsis id: [(game_id, team, share of offensive snaps)]}
      contact   {gsis id: {"afterContact": yards, "broken": tackles}}
    """
    positions, by_player = {}, defaultdict(list)
    for row in weekly:
        if str(row.get("season_type")).upper() == "REG" and _present(row.get("player_id")):
            positions[row["player_id"]] = str(row.get("position") or "").upper()
            by_player[row["player_id"]].append(row)
    new_player = lambda: {"run": {}, "target": {}, "pass": {}, "totals": defaultdict(float), "sides": set()}
    players = defaultdict(new_player)
    defense = defaultdict(lambda: {"run": {}, "pass": {}, "games": set()})
    # (team, game) -> its targets, designed runs and air yards, the targets
    # split by blitz: his share of them comes from the games he played.
    team_game = defaultdict(lambda: defaultdict(float))
    weeks = set()
    for row in plays:
        if str(row.get("season_type")).upper() != "REG" or _flag(row, "two_point_attempt"):
            continue
        game_id, team, against = row.get("game_id"), canonical_team(row.get("posteam")), canonical_team(row.get("defteam"))
        if not game_id or not team or not against:
            continue
        week = int(_num(row.get("week")) or 0)
        if week:
            weeks.add(week)
        key = _play_key(game_id, row.get("play_id"))
        chart = charting.get(key) or {}
        defense[against]["games"].add(game_id)
        side = team_game[(team, game_id)]
        yards = _num(row.get("yards_gained")) or 0
        near = _num(row.get("yardline_100"))
        red_zone = near is not None and near <= 20
        rusher, receiver, passer = row.get("rusher_player_id"), row.get("receiver_player_id"), row.get("passer_player_id")
        play_type = str(row.get("play_type") or "")

        # A designed run: the ball carrier's cells, and a back's against the
        # defense's (RotoBot's "they allow" counts running backs only).
        if play_type == "run" and _flag(row, "rush") and _present(rusher):
            location, gap = str(row.get("run_location") or ""), str(row.get("run_gap") or "")
            buckets = {"box": box_of(_num(chart.get("box"))), "direction": direction_of(location, gap), "lane": lane_of(location, gap)}
            mine = players[rusher]
            mine["sides"].add((team, game_id))
            back = GROUPS.get(positions.get(rusher)) == "RB"
            for split, bucket in buckets.items():
                _add(mine["run"].setdefault(split, {}), bucket, 1, yards)
                if back:
                    _add(defense[against]["run"].setdefault(split, {}), bucket, 1, yards)
            side["carries"] += 1
            totals = mine["totals"]
            totals["designed"] += 1
            totals["rushEpa"] += _num(row.get("epa")) or 0
            totals["rushSuccess"] += _flag(row, "success")
            totals["rzCarries"] += red_zone
            totals["glCarries"] += bool(near is not None and near <= 5)

        # Every run, scrambles too (not kneel-downs): first downs and
        # red-zone touchdowns.
        if _present(rusher) and (play_type == "run" or _flag(row, "qb_scramble")) and not _flag(row, "qb_kneel"):
            totals = players[rusher]["totals"]
            totals["firstDowns"] += _flag(row, "first_down")
            totals["rzTds"] += bool(_flag(row, "rush_touchdown") and red_zone)

        # A quarterback's dropbacks, sacks and scrambles in them (passer_id is
        # the drop-back passer, filled on a scramble where passer_player_id isn't).
        dropper = row.get("passer_id") if _present(row.get("passer_id")) else passer
        if _flag(row, "qb_dropback") and _present(dropper):
            totals = players[dropper]["totals"]
            totals["dropbacks"] += 1
            totals["passEpa"] += _num(row.get("epa")) or 0
            totals["passSuccess"] += _flag(row, "success")

        # A throw (sacks and spikes aren't).
        if _flag(row, "pass_attempt") and not _flag(row, "sack") and not _flag(row, "qb_spike"):
            air = _num(row.get("air_yards"))
            caught = int(_flag(row, "complete_pass"))
            gained = yards if caught else 0
            blitz = None if "blitz" not in chart else "blitz" if chart["blitz"] else "calm"
            play_action = None if "pa" not in chart else "pa" if chart["pa"] else "nopa"
            buckets = {"depth": depth_of(air), "area": area_of(str(row.get("pass_location") or "")), "blitz": blitz,
                       "playAction": play_action, "coverage": coverage.get(key) if coverage is not None else None}
            for split, bucket in buckets.items():
                _add(defense[against]["pass"].setdefault(split, {}), bucket, 1, caught, gained)
            if _present(passer):
                mine = players[passer]
                mine["sides"].add((team, game_id))
                for split, bucket in buckets.items():
                    _add(mine["pass"].setdefault(split, {}), bucket, 1, caught, gained)
                totals = mine["totals"]
                totals["passAir"] += air or 0
                totals["deepAttempts"] += bool(air is not None and air >= 20)
                totals["passFirstDowns"] += _flag(row, "first_down")
                totals["passRzTds"] += bool(_flag(row, "pass_touchdown") and red_zone)
                cpoe = _num(row.get("cpoe"))
                if cpoe is not None:
                    totals["cpoeSum"] += cpoe
                    totals["cpoeCount"] += 1
            if _present(receiver):
                mine = players[receiver]
                mine["sides"].add((team, game_id))
                for split, bucket in buckets.items():
                    if split != "playAction":
                        _add(mine["target"].setdefault(split, {}), bucket, 1, caught, gained)
                totals = mine["totals"]
                totals["pbpTargets"] += 1
                totals["air"] += air or 0
                totals["yac"] += (_num(row.get("yards_after_catch")) or 0) if caught else 0
                totals["recEpa"] += _num(row.get("epa")) or 0
                totals["firstDowns"] += _flag(row, "first_down")
                totals["deepTargets"] += bool(air is not None and air >= 20)
                totals["rzTargets"] += red_zone
                totals["ezTargets"] += bool(air is not None and near is not None and air >= near)
                totals["rzTds"] += bool(_flag(row, "pass_touchdown") and red_zone)
                side["targets"] += 1
                side["air"] += air or 0
                if blitz:
                    side["targets:" + blitz] += 1

    out_players = {}
    for pid in set(players) | set(by_player):
        position = positions.get(pid)
        if GROUPS.get(position) is None:
            continue
        entry, rows = players[pid], by_player.get(pid) or []
        totals = dict(entry["totals"])
        for field, name in WEEKLY_TOTALS:
            totals[name] = sum(_num(row.get(field)) or 0 for row in rows)
        # Half-PPR: the standard points and half a point a catch.
        totals["fantasy"] += totals["rec"] / 2
        played = [row for row in rows if any((_num(row.get(field)) or 0) > 0 for field in ("carries", "targets", "attempts"))]
        totals["games"] = len(played)
        # His team's targets, designed runs and air yards in every game he
        # was in: the games he touched the ball, had a stat line or played
        # an offensive snap.
        sides = set(entry["sides"]) | {(canonical_team(row.get("team")), row.get("game_id")) for row in rows if row.get("game_id")}
        if snaps and snaps.get(pid):
            totals["snapShare"] = sum(share for _game, _team, share in snaps[pid]) / len(snaps[pid])
            sides |= {(canonical_team(team), game_id) for game_id, team, share in snaps[pid] if game_id and share > 0}
        for side_key in sides:
            side = team_game.get(side_key) or {}
            for name in ("targets", "carries", "air", "targets:blitz", "targets:calm"):
                totals["team:" + name] = totals.get("team:" + name, 0) + side.get(name, 0)
        if contact and contact.get(pid):
            totals["afterContact"] = contact[pid].get("afterContact") or 0
            totals["broken"] = contact[pid].get("broken") or 0
        if not (totals["carries"] or totals["targets"] or totals["att"]):
            continue
        latest = max(rows, key=lambda row: _num(row.get("week")) or 0) if rows else {}
        out = {"name": latest.get("player_display_name") or latest.get("player_name") or "", "pos": position,
               "team": canonical_team(latest.get("team")) if latest.get("team") else None,
               "totals": {name: round(value, 3) for name, value in totals.items() if value or name in KEEP_ZERO}}
        for kind in ("run", "target", "pass"):
            if entry[kind]:
                out[kind] = {split: {bucket: [round(value, 2) for value in cell] for bucket, cell in cells.items()}
                             for split, cells in entry[kind].items()}
        out_players[pid] = out
    out_defense = {team: {"games": len(entry["games"]), "run": entry["run"], "pass": entry["pass"]} for team, entry in defense.items()}
    return {"players": out_players, "defense": out_defense, "weeks": sorted(weeks), "coverage": coverage is not None, "version": VERSION}


# ---------------------------------------------------------------- building

def charting_of(season):
    """FTN's charting by play: box count, a blitz (five or more rushers),
    play-action."""
    out = {}
    for row in _read(f"{RELEASE}/ftn_charting/ftn_charting_{season}.csv",
                     ("nflverse_game_id", "nflverse_play_id", "n_defense_box", "n_blitzers", "is_play_action")):
        key = _play_key(row.get("nflverse_game_id"), row.get("nflverse_play_id"))
        if key:
            blitzers = _num(row.get("n_blitzers"))
            out[key] = {"box": _num(row.get("n_defense_box")), "blitz": bool(blitzers and blitzers > 0),
                        "pa": str(row.get("is_play_action")).upper() == "TRUE"}
    return out


def coverage_of(season):
    """{(game, play): "man" | "cover3" | "split" | "other"} from the NFL's
    participation file; None until the season's file is out."""
    out, found = {}, False
    for row in _read(f"{RELEASE}/pbp_participation/pbp_participation_{season}.csv",
                     ("nflverse_game_id", "play_id", "defense_coverage_type")):
        found = True
        key, label = _play_key(row.get("nflverse_game_id"), row.get("play_id")), str(row.get("defense_coverage_type") or "").upper()
        if key and _present(label):
            out[key] = COVERAGE.get(label, "other")
    return out if found else None


def _extras(season):
    """Snap shares and yards after contact (PFR ids, mapped to the
    play-by-play's through the roster). A file not out yet leaves them
    empty; an outage raises like any other, so it isn't kept."""
    ids = {row["pfr_id"]: row["gsis_id"] for row in _read(f"{RELEASE}/rosters/roster_{season}.csv", ("pfr_id", "gsis_id"))
           if _present(row.get("pfr_id")) and _present(row.get("gsis_id"))}
    snaps = defaultdict(list)
    for row in _read(f"{RELEASE}/snap_counts/snap_counts_{season}.csv", ("game_id", "team", "pfr_player_id", "offense_pct", "game_type")):
        gsis, share = ids.get(row.get("pfr_player_id")), _num(row.get("offense_pct"))
        if gsis and share and str(row.get("game_type")).upper() == "REG":
            snaps[gsis].append((row.get("game_id"), row.get("team"), share))
    contact = defaultdict(lambda: {"afterContact": 0, "broken": 0})
    for row in _read(f"{RELEASE}/pfr_advstats/advstats_week_rush_{season}.csv",
                     ("pfr_player_id", "game_type", "rushing_yards_after_contact", "rushing_broken_tackles")):
        gsis = ids.get(row.get("pfr_player_id"))
        if gsis and str(row.get("game_type")).upper() == "REG":
            contact[gsis]["afterContact"] += _num(row.get("rushing_yards_after_contact")) or 0
            contact[gsis]["broken"] += _num(row.get("rushing_broken_tackles")) or 0
    return dict(snaps), dict(contact)


def saved_coverage(season):
    """A finished season's coverage cells (tools/build_nfl_coverage.py), or None."""
    try:
        return json.loads(Path(str(COVERAGE_FILE).format(season=season)).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def build(season):
    weekly = list(_read(f"{RELEASE}/stats_player/stats_player_week_{season}.csv", WEEKLY_FIELDS))
    if not weekly:
        raise LookupError(f"nflverse has no {season} player stats yet")
    charting = charting_of(season)
    # A season the coverage file was kept for doesn't stream the 50MB
    # participation file again.
    coverage = None if saved_coverage(season) else coverage_of(season)
    snaps, contact = _extras(season)
    plays = _read(f"{RELEASE}/pbp/play_by_play_{season}.csv.gz", PBP_FIELDS, gz=True)
    table = summarize(plays, charting, weekly, coverage=coverage, snaps=snaps, contact=contact)
    return {**table, "season": season, "builtAt": time.time()}


def season_now(now=None):
    moment = time.gmtime(now or time.time())
    return moment.tm_year if moment.tm_mon >= 3 else moment.tm_year - 1


def _domain(season):
    return NFLCacheDomain.PLAYS if season >= season_now() else NFLCacheDomain.PLAYS_PAST


def table(season):
    """The season's table, built once a day (refresh, from the daily cron)
    and kept; a past season's for two weeks."""
    return cached_nfl(_domain(season), (VERSION, "table", season), lambda: build(season))


def refresh(season):
    """Build the season's table now and store it (the daily cron), so no
    page waits on the build. Returns (its size in bytes, whether the
    durable copy was written)."""
    value = build(season)
    return store_nfl(_domain(season), (VERSION, "table", season), value)


def coverage_payload(season, current):
    """Where the coverage splits come from: the season's own (its table once
    the participation file is out, or its saved file), else last season's."""
    if current.get("coverage"):
        return season, current
    own = saved_coverage(season)
    if own:
        return season, own
    saved = saved_coverage(season - 1)
    return (season - 1, saved) if saved else (None, None)


# ---------------------------------------------------------------- one page

def _rank(values, key, low=False):
    """1 is the most (with low, the fewest); ties share the better rank."""
    mine = values.get(key)
    if mine is None:
        return None
    return 1 + sum(1 for value in values.values() if value is not None and (value < mine if low else value > mine))


def _rate(top, bottom):
    return top / bottom if bottom else None


def _cells(entry, kind, split):
    return ((entry or {}).get(kind) or {}).get(split) or {}


def split_rows(kind, split, entry, peers, defense, opponent, min_plays=SPLIT_MIN):
    """One split's rows: his plays, share and rate in each bucket (ranked
    among his position with min_plays there), the opponent's share and rate
    allowed (ranked among the defenses that saw any), and the league's."""
    buckets = RUN_SPLITS[split] if kind == "run" else PASS_SPLITS[split]
    side = "run" if kind == "run" else "pass"
    mine = _cells(entry, kind, split)
    total = sum(cell[0] for cell in mine.values())
    teams = {team: _cells(entry_, side, split) for team, entry_ in defense.items()}
    league = defaultdict(lambda: [0, 0, 0])
    for cells in teams.values():
        for bucket, cell in cells.items():
            for index, value in enumerate(cell):
                league[bucket][index] += value
    league_total = sum(cell[0] for cell in league.values())
    team_totals = {team: sum(cell[0] for cell in cells.values()) for team, cells in teams.items()}
    yards = 1 if kind == "run" else 2
    rows = []
    for bucket in buckets:
        cell = mine.get(bucket) or [0, 0, 0]
        rates = {pid: _rate(c[yards], c[0]) for pid, peer in peers.items() if (c := _cells(peer, kind, split).get(bucket)) and c[0] >= min_plays}
        his = {"n": cell[0], "yards": cell[yards], "share": _rate(cell[0], total), "value": _rate(cell[yards], cell[0]),
               "rank": _rank(rates, entry.get("id")) if cell[0] >= min_plays else None, "of": len(rates)}
        if kind != "run":
            his["caught"] = cell[1]
        if kind == "target" and split == "blitz":
            his["teamShare"] = _rate(cell[0], (entry.get("totals") or {}).get(f"team:targets:{bucket}"))
        row = {"key": bucket, "his": his,
               "league": {"share": _rate(league[bucket][0], league_total), "value": _rate(league[bucket][yards], league[bucket][0])}}
        if opponent in teams:
            seen = {team: cells.get(bucket) for team, cells in teams.items() if (cells.get(bucket) or [0])[0] > 0}
            them = teams[opponent].get(bucket) or [0, 0, 0]
            shares = {team: _rate(cell_[0], team_totals[team]) for team, cell_ in seen.items()}
            allowed = {team: _rate(cell_[yards], cell_[0]) for team, cell_ in seen.items()}
            row["them"] = {"n": them[0], "share": _rate(them[0], team_totals[opponent]), "value": _rate(them[yards], them[0]),
                           "shareRank": _rank(shares, opponent), "rank": _rank(allowed, opponent), "of": len(seen)}
        rows.append(row)
    return {"kind": kind, "split": split, "total": total, "rows": rows}


# Each metric: (key, label, format, value from his totals, rank the fewest first).
# Formats: "int", "1" and "2" decimals, "pct" (a share), "signed" (EPA), "signedPct".
def _m(key, label, fmt, read, low=False):
    return {"key": key, "label": label, "format": fmt, "read": read, "low": low}


def _total(name):
    return lambda t: t.get(name, 0)


def _per(top, bottom, scale=1):
    return lambda t: (t.get(top, 0) * scale / t[bottom]) if t.get(bottom) else None


METRICS = {
    "RB": (
        ("production", "Production", None, (
            _m("rushYds", "Rush yards", "int", _total("rushYds")), _m("rushTds", "Rush TDs", "int", _total("rushTds")),
            _m("recYds", "Rec yards", "int", _total("recYds")), _m("rec", "Receptions", "int", _total("rec")),
            _m("recTds", "Rec TDs", "int", _total("recTds")),
            _m("rzTds", "Red-zone TDs", "int", lambda t: t.get("rzTds", 0) if t.get("rzCarries") or t.get("rzTargets") else None),
            _m("firstDowns", "First downs", "int", _total("firstDowns")),
            _m("yac", "Yards after catch", "int", lambda t: t.get("yac", 0) if t.get("rec") else None),
            _m("fantasy", "Fantasy points", "1", _total("fantasy")))),
        ("volume", "Volume", None, (
            _m("carries", "Carries", "int", _total("carries")), _m("targets", "Targets", "int", _total("targets")),
            _m("rushShare", "Share of team runs", "pct", _per("designed", "team:carries")),
            _m("targetShare", "Target share", "pct", _per("pbpTargets", "team:targets")),
            _m("rzTouches", "Red-zone touches", "int", lambda t: t.get("rzCarries", 0) + t.get("rzTargets", 0)),
            _m("glCarries", "Carries inside the 5", "int", _total("glCarries")),
            _m("snapShare", "Snap share", "pct", lambda t: t.get("snapShare")))),
        ("rushing", "Rushing", ("carries", 7), (
            _m("ypc", "Yards a carry", "1", _per("rushYds", "carries")),
            _m("rushSuccess", "Success rate", "pct", _per("rushSuccess", "designed")),
            _m("rushEpa", "EPA a carry", "signed", _per("rushEpa", "designed")),
            _m("afterContact", "After contact, a carry", "1", lambda t: t["afterContact"] / t["carries"] if t.get("carries") and "afterContact" in t else None),
            _m("broken", "Broken tackles", "int", lambda t: t.get("broken") if "afterContact" in t else None))),
        ("receiving", "Receiving", ("targets", 10 / 3), (
            _m("ypt", "Yards a target", "1", _per("recYds", "targets")), _m("ypr", "Yards a catch", "1", _per("recYds", "rec")),
            _m("catchRate", "Catch rate", "pct", _per("rec", "targets")),
            _m("yacPerRec", "After the catch, a catch", "1", _per("yac", "rec")))),
    ),
    "WR": (
        ("production", "Production", None, (
            _m("recYds", "Rec yards", "int", _total("recYds")), _m("rec", "Receptions", "int", _total("rec")),
            _m("recTds", "Rec TDs", "int", _total("recTds")),
            _m("rzTds", "Red-zone TDs", "int", lambda t: t.get("rzTds", 0) if t.get("rzCarries") or t.get("rzTargets") else None),
            _m("firstDowns", "First downs", "int", _total("firstDowns")),
            _m("yac", "Yards after catch", "int", lambda t: t.get("yac", 0) if t.get("rec") else None),
            _m("fantasy", "Fantasy points", "1", _total("fantasy")))),
        ("volume", "Volume", None, (
            _m("targets", "Targets", "int", _total("targets")),
            _m("targetShare", "Target share", "pct", _per("pbpTargets", "team:targets")),
            _m("airShare", "Air-yards share", "pct", _per("air", "team:air")),
            _m("rzTargets", "Red-zone targets", "int", _total("rzTargets")),
            _m("ezTargets", "End-zone targets", "int", _total("ezTargets")),
            _m("deepTargets", "Deep targets (20+)", "int", _total("deepTargets")),
            _m("snapShare", "Snap share", "pct", lambda t: t.get("snapShare")))),
        ("receiving", "Receiving", ("targets", 10 / 3), (
            _m("ypt", "Yards a target", "1", _per("recYds", "targets")), _m("ypr", "Yards a catch", "1", _per("recYds", "rec")),
            _m("catchRate", "Catch rate", "pct", _per("rec", "targets")),
            _m("adot", "Depth of target", "1", _per("air", "pbpTargets")),
            _m("yacPerRec", "After the catch, a catch", "1", _per("yac", "rec")),
            _m("recEpa", "EPA a target", "signed", _per("recEpa", "pbpTargets")))),
    ),
    "QB": (
        ("production", "Production", None, (
            _m("passYds", "Pass yards", "int", _total("passYds")), _m("passTds", "Pass TDs", "int", _total("passTds")),
            _m("ints", "Interceptions", "int", _total("ints"), low=True), _m("cmp", "Completions", "int", _total("cmp")),
            _m("rushYds", "Rush yards", "int", _total("rushYds")), _m("rushTds", "Rush TDs", "int", _total("rushTds")),
            _m("rzTds", "Red-zone TDs", "int", lambda t: t.get("passRzTds", 0) + t.get("rzTds", 0)),
            _m("passFirstDowns", "Passing first downs", "int", _total("passFirstDowns")),
            _m("fantasy", "Fantasy points", "1", _total("fantasy")))),
        ("volume", "Volume", None, (
            _m("att", "Pass attempts", "int", _total("att")), _m("dropbacks", "Dropbacks", "int", _total("dropbacks")),
            _m("carries", "Rush attempts", "int", _total("carries")),
            _m("deepAttempts", "Deep throws (20+)", "int", _total("deepAttempts")))),
        ("passing", "Passing", ("att", 14), (
            _m("cmpPct", "Completion %", "pct", _per("cmp", "att")), _m("ypa", "Yards an attempt", "1", _per("passYds", "att")),
            _m("anya", "Adjusted net yards an attempt", "1",
               lambda t: (t.get("passYds", 0) + 20 * t.get("passTds", 0) - 45 * t.get("ints", 0) - abs(t.get("sackYds", 0))) / (t["att"] + t.get("sacks", 0)) if t.get("att") else None),
            _m("cpoe", "Completion % over expected", "signedPct", lambda t: t["cpoeSum"] / t["cpoeCount"] / 100 if t.get("cpoeCount") else None),
            _m("passEpa", "EPA a dropback", "signed", _per("passEpa", "dropbacks")),
            _m("passSuccess", "Success rate", "pct", _per("passSuccess", "dropbacks")),
            _m("adot", "Depth of throw", "1", _per("passAir", "att")),
            _m("sackRate", "Sack rate", "pct", _per("sacks", "dropbacks"), low=True),
            _m("intRate", "Interception rate", "pct", _per("ints", "att"), low=True))),
    ),
}
METRICS["TE"] = METRICS["WR"]


def _opportunities(totals, group):
    if group == "QB":
        return totals.get("att", 0) + totals.get("carries", 0)
    return totals.get("carries", 0) + totals.get("targets", 0)


def metrics_for(player_id, entry, players, group, team_games, weeks=1):
    """His metrics in groups, each ranked among his position's regulars (or,
    for efficiency, a real workload: each group's per-game bar in METRICS). The bars
    scale with each player's own team's games, so a bye week or a Thursday
    night game doesn't move anyone in or out."""
    games = lambda peer: team_games.get(peer.get("team")) or weeks
    regulars = {pid: peer["totals"] for pid, peer in players.items()
                if GROUPS.get(peer.get("pos")) == group and _opportunities(peer.get("totals") or {}, group) >= REGULAR_PER_WEEK * games(peer)}
    mine = entry.get("totals") or {}
    out = []
    for key, title, qualifier, items in METRICS[group]:
        pool = regulars
        need = None
        if qualifier:
            stat, per_game = qualifier
            need = {"stat": stat, "min": math.ceil(per_game * games(entry) - 1e-9)}
            pool = {pid: totals for pid, totals in regulars.items() if totals.get(stat, 0) >= per_game * games(players[pid]) - 1e-9}
        ranked = player_id in pool
        rows = []
        for metric in items:
            values = {pid: metric["read"](totals) for pid, totals in pool.items()}
            value = metric["read"](mine)
            rows.append({"key": metric["key"], "label": metric["label"], "format": metric["format"], "low": metric["low"],
                         "value": None if value is None else round(value, 4),
                         "rank": _rank(values, player_id, metric["low"]) if ranked else None,
                         "of": sum(1 for found in values.values() if found is not None)})
        out.append({"key": key, "title": title, "need": need, "ranked": ranked, "items": rows})
    return out


def for_player(season, player_id, opponent=None):
    """What his page shows: the splits for his position against `opponent`,
    his metrics, and who at his position has faced `opponent`."""
    try:
        data = table(season)
    except LookupError:
        return {"season": season, "player": None, "version": VERSION}
    players = data.get("players") or {}
    entry = players.get(player_id)
    if not entry:
        return {"season": season, "player": None, "weeks": data.get("weeks") or [], "version": VERSION}
    group = GROUPS[entry["pos"]]
    weeks = max(1, len(data.get("weeks") or []))
    entry = {**entry, "id": player_id}
    peers = {pid: {**peer, "id": pid} for pid, peer in players.items() if GROUPS.get(peer.get("pos")) == group}
    defense = data.get("defense") or {}
    cover_season, cover = coverage_payload(season, data)
    splits = []
    for kind, split in PAGE_SPLITS[group]:
        minimum = 15 if kind == "pass" else SPLIT_MIN
        if split == "coverage":
            if not cover:
                continue
            past = (cover.get("players") or {})
            mine = {**(past.get(player_id) or {}), "id": player_id}
            past_peers = {pid: {**peer, "id": pid} for pid, peer in past.items() if GROUPS.get(peer.get("pos")) == group}
            rows = split_rows(kind, split, mine, past_peers, cover.get("defense") or {}, opponent, minimum)
            splits.append({**rows, "season": cover_season})
            continue
        splits.append({**split_rows(kind, split, entry, peers, defense, opponent, minimum), "season": season})
    payload = {"season": season, "weeks": data.get("weeks") or [], "builtAt": data.get("builtAt"), "version": VERSION,
               "player": {"id": player_id, "name": entry.get("name"), "pos": entry.get("pos"), "group": group, "team": entry.get("team"),
                          "games": (entry.get("totals") or {}).get("games", 0)},
               "opponent": opponent, "splits": splits,
               "metrics": metrics_for(player_id, entry, players, group, {team: info.get("games") for team, info in defense.items()}, weeks)}
    if opponent:
        payload["faced"] = faced(season, opponent, group)
    return payload


# ---------------------------------------------------------------- who faced them

# (our market key, the weekly stats field): the stats a position's lines are in.
FACED_STATS = {"RB": (("rushing_yards", "rushing_yards"), ("rush_attempts", "carries"), ("receiving_yards", "receiving_yards"),
                      ("receptions", "receptions")),
               "WR": (("receiving_yards", "receiving_yards"), ("receptions", "receptions"), ("targets", "targets"),
                      ("receiving_tds", "receiving_tds")),
               "QB": (("passing_yards", "passing_yards"), ("passing_touchdowns", "passing_tds"), ("pass_completions", "completions"),
                      ("rushing_yards", "rushing_yards"))}
FACED_STATS["TE"] = FACED_STATS["WR"]
# A real part in the game: enough of the ball to have had a line.
FACED_USAGE = {"RB": lambda row: (_num(row.get("carries")) or 0) >= 3 or (_num(row.get("targets")) or 0) >= 3,
               "WR": lambda row: (_num(row.get("targets")) or 0) >= 2, "TE": lambda row: (_num(row.get("targets")) or 0) >= 2,
               "QB": lambda row: (_num(row.get("attempts")) or 0) >= 10}


def _archived_lines(days):
    """{(day, name key): {market: line}}: the PrizePicks lines
    line_archive.py kept for those game days (from 2026 week 7 on), keyed
    without a name suffix (PrizePicks and nflverse don't agree on "Jr.")."""
    try:
        import line_archive
        import line_moves
        from backend.sports.nfl.markets import market_for
        from backend.sports.nfl.prizepicks_board import _name_key
    except Exception:  # noqa: BLE001
        return {}
    out = {}
    for day in days:
        try:
            kept = line_archive.lines_on("nfl", day, line_moves._pipeline)
        except Exception:  # noqa: BLE001 -- the games show without their lines
            continue
        for field, line in kept.items():
            name, _, stat = field.partition("|")
            market = market_for(stat)
            if market:
                out.setdefault((day, _name_key(name)), {})[market] = line
    return out


def faced_rows(rows, opponent, group, dates=None, lines=None):
    """Each player at `group` who has faced `opponent`, newest game first:
    what he put up in each stat, his average in his games before it (the
    stand-in when no line was kept) and his line that day where one was."""
    from backend.sports.nfl.prizepicks_board import _name_key
    stats = FACED_STATS[group]
    usage = FACED_USAGE[group]
    regular = [row for row in rows if str(row.get("season_type")).upper() == "REG" and _present(row.get("player_id"))]
    earlier = defaultdict(list)
    for row in regular:
        if usage(row):
            earlier[row["player_id"]].append(row)
    out = []
    for row in regular:
        if canonical_team(row.get("opponent_team")) != opponent or str(row.get("position") or "").upper() != group or not usage(row):
            continue
        week = _num(row.get("week")) or 0
        before = [other for other in earlier[row["player_id"]] if (_num(other.get("week")) or 0) < week]
        day = (dates or {}).get(row.get("game_id"))
        name = row.get("player_display_name") or row.get("player_name") or ""
        kept = (lines or {}).get((day, _name_key(name))) or {}
        values, base, line = {}, {}, {}
        for market, field in stats:
            values[market] = _num(row.get(field)) or 0
            if before:
                base[market] = round(sum(_num(other.get(field)) or 0 for other in before) / len(before), 2)
            if market in kept:
                line[market] = kept[market]
        out.append({"id": row["player_id"], "name": name, "team": canonical_team(row.get("team")), "week": int(week),
                    "gameId": row.get("game_id"), "date": day, "headshot": row.get("headshot_url") or "",
                    "values": values, "base": base, "games": len(before), "lines": line})
    main = stats[0][0]
    out.sort(key=lambda item: (-item["week"], -item["values"][main]))
    return out


def faced(season, opponent, group):
    def load():
        from backend.sports.nfl import finder
        rows = finder.player_rows(season)
        if not rows:
            return None
        games = finder.games_index()
        dates = {game_id: game.get("gameday") for game_id, game in games.items()}
        mine = [row for row in rows if canonical_team(row.get("opponent_team")) == opponent]
        days = {dates.get(row.get("game_id")) for row in mine} - {None, ""}
        return {"position": group, "stats": [market for market, _field in FACED_STATS[group]],
                "rows": faced_rows(rows, opponent, group, dates, _archived_lines(sorted(days)))}
    return cached_nfl(NFLCacheDomain.STATS, (VERSION, "faced", season, opponent, group), load)
