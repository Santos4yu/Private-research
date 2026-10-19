"""NFL scouting: the matchup reads a film-room breakdown is made of, built
from free data and written as short notes for a prop.

  defense   how often it blitzes (sends more than four), how often it
            pressures the quarterback, how often it plays a light box (six
            or fewer) against the run, the yards a carry and a pass it
            allows, and how often runs succeed against it
  splits    a receiver's share of targets when the defense blitzes and when
            it doesn't, a quarterback's yards an attempt the same two ways,
            a back's yards a carry against light boxes and full ones
  usage     snap share and targets or carries over his last three games
            against the games before
  contact   a back's yards after contact and broken tackles (rank among
            backs)
  script    the spread and the time his team holds the ball
  qb runs   a quarterback's scrambles and designed runs (sneaks among
            them) and what kneel-downs take off his rushing yards; how often
            he's pressured, sacked when pressured and gets away; and what a
            defense gives quarterbacks on the ground: scramble yards, rushing
            yards without kneel-downs, scrambles a dropback, the pressures it
            turns into sacks. Rushing yards under pressure come from the
            NFL's per-play pressure (nflverse participation), once it's out
            for the season; until then last season's (data/nfl).

Sources (nflverse's free season files): play by play, FTN's charting of
every play (blitzers, box count, sneaks, out of the pocket), Pro Football
Reference's advanced stats (pressures, sacks, yards after contact, broken
tackles), snap counts and the NFL's participation file (pressure on a play). Charting
and the advanced stats come out a few days after the games, so the newest
week can be missing; the notes say what they're built on and never guess.

Every note leans one way for the Over: +1 helps it, -1 hurts it, 0 is
context. Its weight (1-3) is how much it should move a grade. The Cheat
Sheets (nfl_sheets.py Best Matchups) and the Slip Analyzer
(src/slip-matchup.js, through /api/nfl?resource=finder-scout) read the same
notes, so a pick reads the same everywhere.
"""
from __future__ import annotations

import csv
import gzip
import io
import json
import time
from collections import defaultdict
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.sports.nfl.cache import NFLCacheDomain, cached_nfl
from backend.sports.nfl.services.nflverse import RELEASE, canonical_team

VERSION = "nfl-scout-v2"
USER_AGENT = {"User-Agent": "KrazyData-NFL-scout/1.0"}
PBP_FIELDS = ("game_id", "play_id", "season_type", "week", "posteam", "defteam", "play_type", "pass_attempt",
              "rush_attempt", "sack", "qb_dropback", "qb_scramble", "qb_kneel", "qb_spike", "two_point_attempt",
              "passer_player_id", "receiver_player_id", "rusher_player_id", "passing_yards", "rushing_yards",
              "success", "fixed_drive", "drive_time_of_possession")
LIGHT_BOX = 6
# Below these a split or a rate says too little to show.
MIN_TEAM_BLITZ_TARGETS = 25
MIN_PLAYER_TARGETS = 10
MIN_BLITZ_ATTEMPTS = 25
MIN_LIGHT_CARRIES = 15
MIN_CONTACT_CARRIES = 20
NEAR = 10          # "6th most" is shown from 1st to 10th either way
EDGE = 8           # a rank this near either end leans the note
MIN_QB_DROPBACKS = 20   # a quarterback, not a trick-play passer
START_DROPBACKS = 10    # a game he played, not a relief series
MIN_QB_GAMES = 3        # games before his own rates say anything
MIN_ESCAPE_PRESSURES = 25


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


def _stream(url, gz=False):
    """Rows of a release file; none when it isn't published (404). Any other
    failure raises, so an outage is never kept as "no data"."""
    try:
        response = urlopen(Request(url, headers=USER_AGENT), timeout=40)
    except HTTPError as error:
        if error.code == 404:
            return []
        raise
    with response:
        raw = gzip.GzipFile(fileobj=response) if gz else response
        return list(csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig")))


def _rows(url, gz=False):
    """A release file a row at a time, for the big ones (the participation
    file runs to 50MB); none when it isn't published."""
    try:
        response = urlopen(Request(url, headers=USER_AGENT), timeout=40)
    except HTTPError as error:
        if error.code == 404:
            return
        raise
    with response:
        raw = gzip.GzipFile(fileobj=response) if gz else response
        yield from csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"))


def _clock(value):
    """'4:32' -> 272 seconds."""
    try:
        minutes, seconds = str(value).split(":")
        return int(minutes) * 60 + int(seconds)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- the table

def summarize(plays, charting, pressured, contact, snaps, sacked=None, qb_pressure=None, pressure_plays=None, last_pressure=None):
    """The season's scouting table from its parts:

      plays      play-by-play rows (PBP_FIELDS)
      charting   {(game_id, play_id): {"blitz": bool, "box": int | None,
                  "sneak": bool, "outside": bool}}
      pressured  {defense: times opposing quarterbacks were pressured}
      contact    {gsis id: {"carries", "afterContact", "broken"}}
      snaps      {gsis id: [(week, share of offensive snaps), ...]}
      sacked     {defense: sacks, as the advanced stats count them}
      qb_pressure {gsis id: {game id: {"pressured", "sacked", "blitzed", "hit"}}}
      pressure_plays {"games": game ids charted, "plays": {(game id, play id)}
                  pressured} -- the participation file, when it's out
      last_pressure {gsis id: last season's runs under pressure} (data/nfl)
    """
    defense = defaultdict(lambda: defaultdict(float))
    offense = defaultdict(lambda: {"games": set(), "drives": {}})
    team_game = defaultdict(lambda: defaultdict(float))   # (team, game) -> targets on charted dropbacks
    player = defaultdict(lambda: {"team": None, "week": -1, "games": {}, "passes": 0, "split": defaultdict(float)})
    # A quarterback's games as a runner and passer, and every designed run by
    # anyone (which of those are a quarterback's is known once the season is
    # read: he's the one with the dropbacks).
    qb = defaultdict(dict)
    designed_by = {}     # (rusher, game) -> runs, yards, sneaks
    defense_games = defaultdict(set)
    charted_pressure = (pressure_plays or {}).get("plays") or set()
    pressure_games = (pressure_plays or {}).get("games") or set()

    def qb_game(player_id, game_id, week, team, against):
        return qb[player_id].setdefault(game_id, {"week": week, "team": team, "opponent": against, "dropbacks": 0, "scrambles": 0,
                                                  "scrambleYards": 0, "kneels": 0, "kneelYards": 0, "sacks": 0, "charted": 0,
                                                  "outside": 0, "pDropbacks": 0, "pScrambles": 0, "pYards": 0, "pSacks": 0})
    for row in plays:
        if str(row.get("season_type")).upper() != "REG" or _flag(row, "two_point_attempt"):
            continue
        game_id, team, against = row.get("game_id"), canonical_team(row.get("posteam")), canonical_team(row.get("defteam"))
        if not game_id or not team or not against:
            continue
        week = int(_num(row.get("week")) or 0)
        key = _play_key(game_id, row.get("play_id"))
        chart = charting.get(key)
        offense[team]["games"].add(game_id)
        defense_games[against].add(game_id)
        drive = row.get("fixed_drive")
        seconds = _clock(row.get("drive_time_of_possession"))
        if _present(drive) and seconds is not None:
            offense[team]["drives"][(game_id, drive)] = seconds

        def who(player_id):
            entry = player[player_id]
            if week >= entry["week"]:
                entry["week"], entry["team"] = week, team
            return entry.setdefault("games", {}).setdefault(game_id, {"week": week, "team": team, "targets": 0, "carries": 0})

        scrambled, knelt, sacked_here = _flag(row, "qb_scramble"), _flag(row, "qb_kneel"), _flag(row, "sack")
        passer, rusher = row.get("passer_player_id"), row.get("rusher_player_id")
        if _flag(row, "qb_dropback"):
            stats = defense[against]
            stats["dropbacks"] += 1
            if chart is not None:
                stats["charted"] += 1
                stats["blitzed"] += chart["blitz"]
            # Whose dropback: the passer's, or on a scramble the runner's.
            mine = passer if _present(passer) else rusher if scrambled and _present(rusher) else None
            if mine:
                game = qb_game(mine, game_id, week, team, against)
                game["dropbacks"] += 1
                game["sacks"] += sacked_here
                if chart is not None:
                    game["charted"] += 1
                    game["outside"] += bool(chart.get("outside"))
                if game_id in pressure_games and key in charted_pressure:
                    game["pDropbacks"] += 1
                    game["pSacks"] += sacked_here
                    if scrambled:
                        game["pScrambles"] += 1
                        game["pYards"] += _num(row.get("rushing_yards")) or 0
        if scrambled and _present(rusher):
            yards = _num(row.get("rushing_yards")) or 0
            game = qb_game(rusher, game_id, week, team, against)
            game["scrambles"] += 1
            game["scrambleYards"] += yards
            defense[against]["qbScrambles"] += 1
            defense[against]["qbScrambleYards"] += yards
        if knelt and _present(rusher):
            game = qb_game(rusher, game_id, week, team, against)
            game["kneels"] += 1
            game["kneelYards"] += _num(row.get("rushing_yards")) or 0
        passed = _flag(row, "pass_attempt") and not _flag(row, "sack") and not _flag(row, "qb_spike")
        if passed:
            yards = _num(row.get("passing_yards")) or 0
            defense[against]["attempts"] += 1
            defense[against]["passYards"] += yards
            passer, receiver = row.get("passer_player_id"), row.get("receiver_player_id")
            if _present(passer):
                who(passer)
                player[passer]["passes"] += 1
                if chart is not None:
                    split = player[passer]["split"]
                    tag = "Blitz" if chart["blitz"] else "Calm"
                    split["att" + tag] += 1
                    split["yds" + tag] += yards
            if _present(receiver):
                who(receiver)["targets"] += 1
            if chart is not None and _present(receiver):
                tag = "blitz" if chart["blitz"] else "calm"
                team_game[(team, game_id)][tag] += 1
                player[receiver]["split"]["t" + tag.title()] += 1
        designed = (_flag(row, "rush_attempt") and str(row.get("play_type")) == "run"
                    and not _flag(row, "qb_scramble") and not _flag(row, "qb_kneel"))
        if designed:
            yards = _num(row.get("rushing_yards")) or 0
            stats = defense[against]
            stats["runs"] += 1
            stats["runYards"] += yards
            stats["runSuccess"] += _flag(row, "success")
            if _present(rusher):
                runs = designed_by.setdefault((rusher, game_id), {"runs": 0, "yards": 0, "sneaks": 0, "week": week, "team": team, "against": against})
                runs["runs"] += 1
                runs["yards"] += yards
                runs["sneaks"] += bool(chart and chart.get("sneak"))
            box = chart["box"] if chart is not None else None
            if box is not None:
                stats["boxed"] += 1
                stats["light"] += box <= LIGHT_BOX
            if _present(rusher):
                who(rusher)["carries"] += 1
                if box is not None:
                    tag = "Light" if box <= LIGHT_BOX else "Full"
                    split = player[rusher]["split"]
                    split["car" + tag] += 1
                    split["ryd" + tag] += yards

    # Quarterbacks: whoever has a season's worth of dropbacks. Their designed
    # runs (sneaks among them) join their games and what each defense allowed.
    quarterbacks = {pid for pid, games in qb.items() if sum(game["dropbacks"] for game in games.values()) >= MIN_QB_DROPBACKS}
    for (rusher, game_id), runs in designed_by.items():
        if rusher not in quarterbacks:
            continue
        game = qb_game(rusher, game_id, runs["week"], runs["team"], runs["against"])
        game["designed"], game["designedYards"], game["sneaks"] = int(runs["runs"]), runs["yards"], int(runs["sneaks"])
        defense[runs["against"]]["qbDesigned"] += runs["runs"]
        defense[runs["against"]]["qbDesignedYards"] += runs["yards"]

    teams = sorted(set(defense) | set(offense))
    games_of = lambda team: len(defense_games[team])
    sacked = sacked or {}
    rates = {
        "blitz": {team: _ratio(defense[team]["blitzed"], defense[team]["charted"], 60) for team in teams},
        "pressure": {team: _ratio(pressured.get(team), defense[team]["dropbacks"], 60) if team in pressured else None for team in teams},
        "lightBox": {team: _ratio(defense[team]["light"], defense[team]["boxed"], 40) for team in teams},
        "ypc": {team: _ratio(defense[team]["runYards"], defense[team]["runs"], 40) for team in teams},
        "rushSuccess": {team: _ratio(defense[team]["runSuccess"], defense[team]["runs"], 40) for team in teams},
        "ypa": {team: _ratio(defense[team]["passYards"], defense[team]["attempts"], 60) for team in teams},
        # What quarterbacks do on the ground against them, a game (kneel-downs left out).
        "qbScrambleYards": {team: _ratio(defense[team]["qbScrambleYards"], games_of(team), 2) for team in teams},
        "qbRushYards": {team: _ratio(defense[team]["qbScrambleYards"] + defense[team]["qbDesignedYards"], games_of(team), 2) for team in teams},
        "scrambleRate": {team: _ratio(defense[team]["qbScrambles"], defense[team]["dropbacks"], 60) for team in teams},
        # The pressures they turn into sacks (both from the advanced stats).
        "sackPerPressure": {team: _ratio(sacked.get(team), pressured.get(team), 20) if team in sacked and team in pressured else None for team in teams},
    }
    possession = {team: (sum(offense[team]["drives"].values()) / len(offense[team]["games"]) if offense[team]["games"] and offense[team]["drives"] else None)
                  for team in teams}
    table = {team: {"def": {key: _cell(values, team) for key, values in rates.items()},
                    "off": {"top": _cell(possession, team)}} for team in teams}
    league = {key: _average(values) for key, values in rates.items()}
    league["top"] = _average(possession)

    backs = {pid: entry for pid, entry in contact.items() if (entry.get("carries") or 0) >= MIN_CONTACT_CARRIES}
    after = _ranks({pid: entry["afterContact"] / entry["carries"] for pid, entry in backs.items()})
    broken = _ranks({pid: entry["broken"] for pid, entry in backs.items()})
    players = {}
    for pid, entry in player.items():
        games = sorted(entry["games"].values(), key=lambda game: game["week"])
        split = entry["split"]
        mine = [game_id for game_id, game in entry["games"].items() if game["team"] == entry["team"]]
        blitz_total = sum(team_game[(entry["team"], game_id)]["blitz"] for game_id in mine)
        calm_total = sum(team_game[(entry["team"], game_id)]["calm"] for game_id in mine)
        out = {"team": entry["team"], "games": len(games), "passes": entry["passes"],
               "targets": [int(game["targets"]) for game in games], "carries": [int(game["carries"]) for game in games]}
        if blitz_total >= MIN_TEAM_BLITZ_TARGETS and calm_total and split["tBlitz"] + split["tCalm"] >= MIN_PLAYER_TARGETS:
            out["targetSplit"] = [split["tBlitz"] / blitz_total, split["tCalm"] / calm_total, int(split["tBlitz"])]
        if split["attBlitz"] >= MIN_BLITZ_ATTEMPTS and split["attCalm"] >= MIN_BLITZ_ATTEMPTS:
            out["passSplit"] = [split["ydsBlitz"] / split["attBlitz"], split["ydsCalm"] / split["attCalm"], int(split["attBlitz"])]
        if split["carLight"] >= MIN_LIGHT_CARRIES and split["carFull"] >= 10:
            out["boxSplit"] = [split["rydLight"] / split["carLight"], split["rydFull"] / split["carFull"], int(split["carLight"])]
        if pid in backs:
            out["contact"] = {"afterContact": backs[pid]["afterContact"] / backs[pid]["carries"], "afterRank": after[pid],
                              "broken": int(backs[pid]["broken"]), "brokenRank": broken[pid], "backs": len(backs)}
        if snaps.get(pid):
            out["snaps"] = [share for _week, share in sorted(snaps[pid])]
        players[pid] = out
    for pid, rushing in _quarterbacks(quarterbacks, qb, qb_pressure or {}, pressure_games, last_pressure or {}).items():
        entry = players.setdefault(pid, {"team": rushing["games"][-1]["team"], "games": len(rushing["games"]), "passes": 0, "targets": [], "carries": []})
        entry["qbRush"] = rushing
    weeks = sorted({int(_num(row.get("week")) or 0) for row in plays if str(row.get("season_type")).upper() == "REG"} - {0})
    charted = sorted({key[0] for key in charting})
    return {"teams": table, "league": league, "players": players, "teamCount": len(teams), "weeks": weeks,
            "chartedGames": len(charted), "version": VERSION}


def _quarterbacks(quarterbacks, qb, qb_pressure, pressure_games, last_pressure):
    """Each quarterback's season as a runner, game by game, with how often he
    gets away when pressured and how often he's sacked, ranked among
    quarterbacks pressured enough to say."""
    out, escapes, sacks = {}, {}, {}
    for pid in quarterbacks:
        games, pressures, sacked, scrambles = [], 0, 0, 0
        for game_id, game in sorted(qb[pid].items(), key=lambda item: item[1]["week"]):
            pfr = (qb_pressure.get(pid) or {}).get(game_id) or {}
            charted = game_id in pressure_games
            games.append({"week": game["week"], "opponent": game["opponent"], "team": game["team"], "dropbacks": game["dropbacks"],
                          "scrambles": game["scrambles"], "scrambleYards": game["scrambleYards"],
                          "designed": game.get("designed", 0), "designedYards": game.get("designedYards", 0), "sneaks": game.get("sneaks", 0),
                          "kneels": game["kneels"], "kneelYards": game["kneelYards"], "sacks": game["sacks"],
                          "pressured": pfr.get("pressured"), "sacked": pfr.get("sacked"), "blitzed": pfr.get("blitzed"), "hit": pfr.get("hit"),
                          "outside": game["outside"] if game["charted"] else None,
                          "underPressure": {"dropbacks": game["pDropbacks"], "scrambles": game["pScrambles"], "yards": game["pYards"],
                                            "sacks": game["pSacks"]} if charted else None})
            if pfr.get("pressured") is not None:
                pressures += pfr["pressured"]
                sacked += pfr.get("sacked") or 0
                scrambles += game["scrambles"]
        if pressures >= MIN_ESCAPE_PRESSURES:
            escapes[pid], sacks[pid] = scrambles / pressures, sacked / pressures
        out[pid] = {"games": games}
        if last_pressure.get(pid):
            out[pid]["lastSeason"] = last_pressure[pid]
    escape_rank, sack_rank = _ranks(escapes), _ranks(sacks)
    for pid in escapes:
        out[pid]["escape"] = [round(escapes[pid], 4), escape_rank[pid], len(escapes)]
        out[pid]["sackRate"] = [round(sacks[pid], 4), sack_rank[pid], len(sacks)]
    return out


def _ratio(top, bottom, minimum):
    return top / bottom if bottom and bottom >= minimum and top is not None else None


def _ranks(values):
    """Rank 1 is the most. Ties share a rank."""
    ordered = sorted((value for value in values.values() if value is not None), reverse=True)
    return {key: ordered.index(value) + 1 for key, value in values.items() if value is not None}


def _cell(values, team):
    value = values.get(team)
    return None if value is None else [round(value, 4), _ranks(values)[team]]


def _average(values):
    known = [value for value in values.values() if value is not None]
    return round(sum(known) / len(known), 4) if known else None


def build(season):
    rows = _stream(f"{RELEASE}/pbp/play_by_play_{season}.csv.gz", gz=True)
    plays = [{key: row.get(key) for key in PBP_FIELDS} for row in rows]
    del rows
    charting = {}
    for row in _stream(f"{RELEASE}/ftn_charting/ftn_charting_{season}.csv"):
        key = _play_key(row.get("nflverse_game_id"), row.get("nflverse_play_id"))
        if key:
            blitzers, box = _num(row.get("n_blitzers")), _num(row.get("n_defense_box"))
            charting[key] = {"blitz": bool(blitzers and blitzers > 0), "box": int(box) if box is not None else None,
                             "sneak": str(row.get("is_qb_sneak")).upper() == "TRUE",
                             "outside": str(row.get("is_qb_out_of_pocket")).upper() == "TRUE"}
    from backend.sports.nfl import finder
    by_pfr = {}
    for row in finder.roster_rows(season):
        pfr, gsis = str(row.get("pfr_id") or "").strip(), str(row.get("gsis_id") or "").strip()
        if _present(pfr) and _present(gsis):
            by_pfr[pfr] = gsis
    # Pressures and sacks: each defense's (what opposing quarterbacks
    # suffered) and each quarterback's, game by game.
    pressured, sacked, qb_pressure = defaultdict(float), defaultdict(float), defaultdict(dict)
    for row in _stream(f"{RELEASE}/pfr_advstats/advstats_week_pass_{season}.csv"):
        if str(row.get("game_type")).upper() != "REG" or _num(row.get("times_pressured")) is None:
            continue
        against = canonical_team(row.get("opponent"))
        pressured[against] += _num(row["times_pressured"])
        sacked[against] += _num(row.get("times_sacked")) or 0
        gsis = by_pfr.get(row.get("pfr_player_id"))
        if gsis and row.get("game_id"):
            qb_pressure[gsis][row["game_id"]] = {key: _num(row.get(field)) for key, field in
                                                 (("pressured", "times_pressured"), ("sacked", "times_sacked"),
                                                  ("blitzed", "times_blitzed"), ("hit", "times_hit"))}
    contact = defaultdict(lambda: {"carries": 0, "afterContact": 0, "broken": 0})
    for row in _stream(f"{RELEASE}/pfr_advstats/advstats_week_rush_{season}.csv"):
        gsis = by_pfr.get(row.get("pfr_player_id"))
        carries = _num(row.get("carries"))
        if gsis and carries and str(row.get("game_type")).upper() == "REG":
            entry = contact[gsis]
            entry["carries"] += carries
            entry["afterContact"] += _num(row.get("rushing_yards_after_contact")) or 0
            entry["broken"] += (_num(row.get("rushing_broken_tackles")) or 0) + (_num(row.get("receiving_broken_tackles")) or 0)
    snaps = defaultdict(list)
    for row in _stream(f"{RELEASE}/snap_counts/snap_counts_{season}.csv"):
        gsis, share = by_pfr.get(row.get("pfr_player_id")), _num(row.get("offense_pct"))
        if gsis and share and str(row.get("game_type")).upper() == "REG":
            snaps[gsis].append((int(_num(row.get("week")) or 0), share))
    return summarize(plays, charting, dict(pressured), dict(contact), dict(snaps), sacked=dict(sacked), qb_pressure=dict(qb_pressure),
                     pressure_plays=pressure_plays(season), last_pressure=last_season_pressure(season - 1))


def pressure_plays(season):
    """The plays the NFL marks as a pressure (nflverse's participation file),
    and the games it covers. Nothing until the season's file is out."""
    games, plays = set(), set()
    for row in _rows(f"{RELEASE}/pbp_participation/pbp_participation_{season}.csv"):
        key = _play_key(row.get("nflverse_game_id"), row.get("play_id"))
        if key is None:
            continue
        games.add(key[0])
        if str(row.get("was_pressure")).upper() == "TRUE":
            plays.add(key)
    return {"games": games, "plays": plays}


PRESSURE_FILE = Path(__file__).resolve().parent / "data" / "nfl" / "qb-pressure-{season}.json"


def last_season_pressure(season):
    """A finished season's runs under pressure for each quarterback
    (tools/build_qb_pressure.py writes it once the season is over)."""
    try:
        return json.loads(PRESSURE_FILE.with_name(PRESSURE_FILE.name.format(season=season)).read_text(encoding="utf-8")).get("players") or {}
    except (OSError, ValueError):
        return {}


def table(season):
    """The season's scouting table, built once and kept (it streams the
    whole play-by-play file)."""
    return cached_nfl(NFLCacheDomain.PLAY_BY_PLAY, (VERSION, "table", season), lambda: build(season))


# What a defense gives quarterbacks, for the player page's card.
QB_DEFENSE = ("qbScrambleYards", "qbRushYards", "scrambleRate", "blitz", "pressure", "sackPerPressure")


def qb_rush(season, player_id, opponent):
    """One quarterback's season as a runner and what this defense gives
    quarterbacks (each with its rank, 1 the most), against the league."""
    scout = table(season)
    me = (scout.get("players") or {}).get(player_id) or {}
    them = ((scout.get("teams") or {}).get(opponent) or {}).get("def") or {}
    league = scout.get("league") or {}
    return {"season": season, "weeks": scout.get("weeks") or [], "teamCount": scout.get("teamCount"), "chartedGames": scout.get("chartedGames"),
            "player": me.get("qbRush"), "opponent": {"team": opponent, **{key: them.get(key) for key in QB_DEFENSE}},
            "league": {key: league.get(key) for key in QB_DEFENSE}, "version": VERSION}


# ---------------------------------------------------------------- notes

FAMILIES = {
    "passing_yards": ("passing",), "pass_completions": ("passing",), "passing_attempts": ("passing",),
    "passing_touchdowns": ("passing",), "receptions": ("receiving",), "receiving_yards": ("receiving",),
    "targets": ("receiving",), "longest_reception": ("receiving",), "rushing_yards": ("rushing",),
    "rush_attempts": ("rushing",), "rushing_receiving_yards": ("rushing", "receiving"),
    "passing_rushing_yards": ("passing", "rushing"), "longest_rush": ("rushing",), "rush_yards_first_5": ("rushing",),
    "first_rush_yards": ("rushing",), "quarters_5_rush_yds": ("rushing",), "halves_25_rush_yds": ("rushing",),
}
YARDS = {"passing_yards", "receiving_yards", "rushing_yards", "rushing_receiving_yards", "longest_reception",
         "passing_rushing_yards", "longest_rush", "rush_yards_first_5", "first_rush_yards", "quarters_5_rush_yds", "halves_25_rush_yds"}


def _ordinal(number):
    return f"{number}{'th' if 11 <= number % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(number % 10, 'th')}"


def _nth(place, word):
    """'the most' for the first, else '6th most'."""
    return f"the {word}" if place == 1 else f"{_ordinal(place)} {word}"


def _where(rank, teams, most="most", least="fewest"):
    """'6th most' / '3rd fewest' near either end, else None."""
    if rank is None or not teams:
        return None
    if rank <= NEAR:
        return _nth(rank, most)
    if teams - rank + 1 <= NEAR:
        return _nth(teams - rank + 1, least)
    return None


def _lean(rank, teams):
    """+1 near the top (the most), -1 near the bottom, 0 between."""
    if rank is None or not teams:
        return 0
    return 1 if rank <= EDGE else -1 if teams - rank + 1 <= EDGE else 0


def _count(number, one, many):
    return f"{number:g} {one if number == 1 else many}"


def _pct(value):
    return f"{round(value * 100)}%"


def _note(key, kind, text, lean=0, weight=1, yards=False):
    return {"key": key, "kind": kind, "text": text, "lean": lean, "weight": weight if lean else 0, "yards": yards}


def _recent(values, label):
    """'Targets the last 3 games: 10, 6, 11', leaning on the change from
    the games before."""
    if len(values) < 4:
        return None
    last, before = values[-3:], values[:-3]
    now, then = sum(last) / 3, sum(before) / len(before)
    change = now / then - 1 if then else 0
    lean = 1 if then and change >= 0.25 else -1 if then and change <= -0.25 else 0
    trend = f" (up from {then:.1f} a game)" if lean > 0 else f" (down from {then:.1f} a game)" if lean < 0 else ""
    return _note(f"recent-{label}", "usage", f"{label.title()} the last 3 games: {', '.join(str(value) for value in last)}{trend}", lean, 1)


def notes_for(scout, player_id, team, opponent, spread=None):
    """{family: [note, ...]} for a player against this opponent. `spread` is
    how many points his team is favored by (negative: the underdog)."""
    me = (scout.get("players") or {}).get(player_id)
    teams = scout.get("teams") or {}
    count = scout.get("teamCount") or len(teams)
    them = (teams.get(opponent) or {}).get("def") or {}
    ours = (teams.get(team) or {}).get("off") or {}
    if not them:
        return {}
    cell = lambda key: them.get(key) or [None, None]
    out = {"passing": [], "receiving": [], "rushing": []}
    blitz, blitz_rank = cell("blitz")
    blitz_where = _where(blitz_rank, count)
    blitz_heavy = blitz_rank is not None and blitz_rank <= NEAR

    # Passing: the pass rush first, then how he handles the blitz.
    pressure, pressure_rank = cell("pressure")
    where = _where(pressure_rank, count)
    if pressure is not None and where:
        out["passing"].append(_note("pressure", "opponent", f"{opponent} pressure the quarterback on {_pct(pressure)} of dropbacks, {where}",
                                    -_lean(pressure_rank, count), 2))
    split = (me or {}).get("passSplit")
    if split and blitz_heavy:
        gap = split[0] - split[1]
        lean = 1 if gap >= 1 else -1 if gap <= -1 else 0
        out["passing"].append(_note("blitz-split", "split", f"Averages {split[0]:.1f} yards an attempt against the blitz, {split[1]:.1f} otherwise; "
                                                            f"{opponent} blitz on {_pct(blitz)} of dropbacks, {blitz_where}", lean, 2))
    ypa, ypa_rank = cell("ypa")
    where = _where(ypa_rank, count)
    if ypa is not None and where:
        note = _note("pass-yards-allowed", "opponent", f"{opponent} allow {ypa:.1f} yards a pass, {where}", _lean(ypa_rank, count), 1, yards=True)
        out["passing"].append(note)
        out["receiving"].append(dict(note))
    if spread is not None and abs(spread) >= 6:
        points = f"{abs(spread):g}"
        out["passing"].append(_note("script", "opponent", f"{points}-point underdog: teams behind throw more" if spread < 0
                                    else f"Favored by {points}: teams ahead throw less", 1 if spread < 0 else -1, 1))
        out["rushing"].append(_note("script", "opponent", f"Favored by {points}: teams ahead lean on the run" if spread > 0
                                    else f"{points}-point underdog: teams behind run less", 1 if spread > 0 else -1, 1))

    # Receiving: his share when they blitz.
    split = (me or {}).get("targetSplit")
    if split and blitz_heavy and split[1] > 0:
        change = split[0] / split[1] - 1
        lean = 1 if change >= 0.1 else -1 if change <= -0.1 else 0
        out["receiving"].append(_note("blitz-split", "split", f"Gets {_pct(split[0])} of targets when the defense blitzes, {_pct(split[1])} when it doesn't; "
                                                              f"{opponent} blitz on {_pct(blitz)} of dropbacks, {blitz_where}", lean, 2))

    # Rushing: what the run defense gives up, the boxes it plays, his contact.
    ypc, ypc_rank = cell("ypc")
    where = _where(ypc_rank, count)
    if ypc is not None and where:
        out["rushing"].append(_note("run-defense", "opponent", f"{opponent} allow {ypc:.1f} yards a carry, {where}", _lean(ypc_rank, count), 2, yards=True))
    success, success_rank = cell("rushSuccess")
    where = _where(success_rank, count, "highest", "lowest")
    if success is not None and where:
        out["rushing"].append(_note("run-success", "opponent", f"Runs succeed on {_pct(success)} of carries against them, {where}", _lean(success_rank, count), 1))
    light, light_rank = cell("lightBox")
    split = (me or {}).get("boxSplit")
    if light is not None and light_rank is not None:
        if light_rank <= NEAR:
            text = f"{opponent} play six or fewer in the box on {_pct(light)} of runs, {_nth(light_rank, 'most')}"
            lean = 0
            if split:
                text += f"; he averages {split[0]:.1f} a carry against those boxes, {split[1]:.1f} against more"
                lean = 1 if split[0] - split[1] >= 0.5 else 0
            out["rushing"].append(_note("light-box", "opponent", text, lean, 1, yards=True))
        elif count - light_rank + 1 <= EDGE:
            out["rushing"].append(_note("light-box", "opponent", f"{opponent} put seven or more in the box on {_pct(1 - light)} of runs, "
                                                                  f"{_nth(count - light_rank + 1, 'most')}", -1, 1, yards=True))
    contact = (me or {}).get("contact")
    if contact and contact["afterRank"] <= NEAR:
        out["rushing"].append(_note("contact", "split", f"{contact['afterContact']:.1f} yards after contact a carry, {_nth(contact['afterRank'], 'most')} among backs"
                                                        f" ({contact['broken']} broken tackle{'' if contact['broken'] == 1 else 's'})", 1 if contact["afterRank"] <= 5 else 0, 1, yards=True))
    top, top_rank = (ours.get("top") or [None, None])
    if top is not None and top_rank is not None and top_rank <= EDGE:
        out["rushing"].append(_note("possession", "opponent", f"{team} hold the ball {int(top // 60)}:{int(top % 60):02d} a game, {_nth(top_rank, 'most')}", 1, 1))

    # Usage: snaps and touches, his last three games against the rest.
    snaps = (me or {}).get("snaps") or []
    if len(snaps) >= 5:
        last, before = sum(snaps[-3:]) / 3, sum(snaps[:-3]) / len(snaps[:-3])
        gap = last - before
        lean = 1 if gap >= 0.08 else -1 if gap <= -0.08 else 0
        if lean:
            note = _note("snaps", "usage", f"Played {_pct(last)} of snaps the last 3 games, {_pct(before)} before", lean, 1)
            out["receiving"].append(note)
            out["rushing"].append(dict(note))
    if me:
        targets = _recent(me.get("targets") or [], "targets")
        carries = _recent(me.get("carries") or [], "carries")
        if targets and sum(me["targets"]) >= MIN_PLAYER_TARGETS:
            out["receiving"].append(targets)
        if carries and sum(me["carries"]) >= MIN_CONTACT_CARRIES:
            out["rushing"].append(carries)
    # A quarterback's runs read their own notes: his scrambles and designed
    # runs, what this defense gives quarterbacks, its blitz and pass rush.
    if (me or {}).get("qbRush"):
        out["rushing"] = _qb_notes(me["qbRush"], opponent, cell, count, spread)
    return {family: items for family, items in out.items() if items}


def _qb_notes(rushing, opponent, cell, count, spread):
    """A quarterback's rushing notes against this defense."""
    games = [game for game in rushing.get("games") or [] if game["dropbacks"] >= START_DROPBACKS]
    if len(games) < MIN_QB_GAMES:
        return []
    n = len(games)
    total = lambda key: sum(game.get(key) or 0 for game in games)
    scrambles, scramble_yards = total("scrambles"), total("scrambleYards")
    designed, designed_yards, sneaks = total("designed"), total("designedYards"), total("sneaks")
    kneels, kneel_yards = total("kneels"), total("kneelYards")
    scrambler = scrambles / n >= 1.5
    # How much the defense's numbers matter: a quarterback who runs for 15+
    # yards a game feels them fully, 7+ by half, a pocket passer not at all.
    rushing_yards = (scramble_yards + designed_yards) / n
    runner = 2 if rushing_yards >= 15 else 1 if rushing_yards >= 7 else 0
    weigh = lambda lean, weight: (lean, min(weight, runner)) if runner else (0, 0)
    out = []
    # His running: how much of it he makes up, and how much is called.
    if scrambles + designed:
        text = (f"Runs {(scrambles + designed) / n:.1f} times a game: {scrambles / n:.1f} scrambles for {scramble_yards / n:.1f} yards, "
                f"{designed / n:.1f} designed runs for {designed_yards / n:.1f}")
        if sneaks:
            text += (f"; {'both' if designed == 2 else 'all ' + format(designed, 'g')} of his designed runs were QB sneaks" if sneaks == designed and designed > 1
                     else f"; his one designed run was a QB sneak" if sneaks == designed
                     else f"; {sneaks:g} of his {designed:g} designed runs {'was a QB sneak' if sneaks == 1 else 'were QB sneaks'}")
        out.append(_note("qb-runs", "usage", text))
    # Kneel-downs count as rushing (and settle the line), but they aren't running.
    if kneels >= 2 and -kneel_yards / n >= 1:
        favored = spread is not None and spread >= 3
        text = (f"Kneel-downs take {abs(kneel_yards) / n:.1f} yards a game off his rushing ({kneels} kneels): "
                f"{(scramble_yards + designed_yards) / n:.1f} a game without them, {(scramble_yards + designed_yards + kneel_yards) / n:.1f} with")
        out.append(_note("qb-kneels", "usage", text + ("; favored teams kneel to finish games" if favored else ""), -1 if favored else 0, 1, yards=True))
    # What this defense gives quarterbacks on the ground.
    value, rank = cell("qbScrambleYards")
    where = _where(rank, count)
    if value is not None and where:
        out.append(_note("qb-scramble-defense", "opponent", f"{opponent} allow {value:.1f} quarterback scramble yards a game, {where}",
                         *weigh(_lean(rank, count), 2 if scrambler else 1), yards=True))
    value, rank = cell("qbRushYards")
    where = _where(rank, count)
    if value is not None and where:
        out.append(_note("qb-rush-defense", "opponent", f"{opponent} allow {value:.1f} rushing yards a game to quarterbacks (kneel-downs left out), {where}",
                         *weigh(_lean(rank, count), 1 if scrambler else 2), yards=True))
    value, rank = cell("scrambleRate")
    where = _where(rank, count)
    if value is not None and where:
        out.append(_note("qb-scramble-rate", "opponent", f"Quarterbacks scramble on {_pct(value)} of dropbacks against {opponent}, {where}", *weigh(_lean(rank, count), 1)))
    # The blitz and the pass rush: a blitz leaves fewer to chase him; pressure
    # makes him run unless it ends in a sack.
    blitz, blitz_rank = cell("blitz")
    if blitz is not None and blitz_rank is not None and blitz_rank <= NEAR and scrambles / n >= 1:
        out.append(_note("qb-blitz", "opponent", f"{opponent} blitz on {_pct(blitz)} of dropbacks, {_nth(blitz_rank, 'most')}: "
                                                 "a blitz leaves fewer defenders to chase a scramble", *weigh(1, 1)))
    escape, sacked = rushing.get("escape"), rushing.get("sackRate")
    escapes = bool(escape and escape[1] <= NEAR)
    pressure, pressure_rank = cell("pressure")
    convert, convert_rank = cell("sackPerPressure")
    low = convert is not None and convert_rank is not None and count - convert_rank + 1 <= EDGE
    high = convert is not None and convert_rank is not None and convert_rank <= EDGE
    if pressure is not None and pressure_rank is not None and pressure_rank <= NEAR:
        text = f"{opponent} pressure the quarterback on {_pct(pressure)} of dropbacks, {_nth(pressure_rank, 'most')}"
        if low:
            text, lean, weight = text + f", but turn only {_pct(convert)} of pressures into sacks ({_nth(count - convert_rank + 1, 'fewest')}): pressured quarterbacks get out and run", 1, 2
        elif high:
            text, lean, weight = text + f", and turn {_pct(convert)} of pressures into sacks ({_nth(convert_rank, 'most')}): plays end before he can run", -1, 2
        else:
            text, lean, weight = text + ": more chances to scramble", 1 if escapes else 0, 1
        out.append(_note("qb-pressure", "opponent", text, *weigh(lean, weight)))
    elif low or high:
        out.append(_note("qb-pressure", "opponent", f"{opponent} turn {_pct(convert)} of pressures into sacks, "
                                                    + (f"{_nth(convert_rank, 'most')}: plays end before he can run" if high
                                                       else f"{_nth(count - convert_rank + 1, 'fewest')}: pressured quarterbacks get out"), *weigh(-1 if high else 1, 1)))
    # How he handles pressure: gets out and runs, or goes down.
    if escape:
        often_sacked = sacked and sacked[1] <= EDGE
        rarely_sacked = sacked and sacked[2] - sacked[1] + 1 <= EDGE
        if escapes or often_sacked or rarely_sacked:
            text = f"Scrambles {round(escape[0] * 100)} times for every 100 times he's pressured"
            text += f", {_nth(escape[1], 'most')} of {escape[2]} quarterbacks" if escapes else ""
            if sacked:
                text += f"; sacked on {_pct(sacked[0])} of pressures"
                text += f", {_nth(sacked[1], 'most')}" if often_sacked else f", {_nth(sacked[2] - sacked[1] + 1, 'fewest')}" if rarely_sacked else ""
            lean = -1 if often_sacked else 1 if escape[1] <= EDGE else 0
            out.append(_note("qb-escape", "split", text, lean, 1))
    # His running under pressure: this season's once it's charted, else last season's.
    charted = [game["underPressure"] for game in games if game.get("underPressure")]
    last = rushing.get("lastSeason")
    if len(charted) >= MIN_QB_GAMES:
        pressured, ran, yards = (sum(item[key] for item in charted) for key in ("dropbacks", "scrambles", "yards"))
        out.append(_note("qb-under-pressure", "split", f"Runs for {yards / len(charted):.1f} yards a game under pressure "
                                                       f"({_count(ran, 'scramble', 'scrambles')} on {pressured} pressured dropbacks)", yards=True))
    elif last and last.get("games"):
        out.append(_note("qb-under-pressure", "split", f"Last season he ran for {last['yards'] / last['games']:.1f} yards a game under pressure "
                                                       f"({_count(last['scrambles'], 'scramble', 'scrambles')} on {last['pressured']} pressured dropbacks)", yards=True))
    # The game script: behind, he drops back more; ahead, he kneels.
    if spread is not None and abs(spread) >= 6:
        points = f"{abs(spread):g}"
        out.append(_note("script", "opponent", f"{points}-point underdog: teams behind drop back more, so more chances to scramble" if spread < 0
                         else f"Favored by {points}: teams ahead drop back less and kneel to finish", 1 if spread < 0 else -1, 1))
    recent = _recent([int(game["scrambles"] + (game.get("designed") or 0)) for game in games], "runs")
    if recent:
        out.append(recent)
    return out


def for_market(notes, market):
    """The notes for one prop: its families', yards-only notes on yards props."""
    seen, out = set(), []
    for family in FAMILIES.get(market, ()):
        for item in notes.get(family, ()):
            if item["key"] in seen or (item["yards"] and market not in YARDS):
                continue
            seen.add(item["key"])
            out.append(item)
    return out


def lean_of(notes):
    """The notes added up for the Over, -1 to 1."""
    total = sum(item["lean"] * item["weight"] for item in notes)
    return max(-6, min(6, total)) / 6


def report(season, games=None):
    """This week's notes for every player who plays: the table read against
    each team's opponent and spread (nfl_sheets.week_games)."""
    scout = table(season)
    if games is None:
        import nfl_sheets
        _week, games = nfl_sheets.week_games(season)
    matchups = {}
    for game in games:
        if game.get("started"):
            continue
        spread = game.get("spread")
        matchups[game["home"]] = (game["away"], spread, game["gameId"])
        matchups[game["away"]] = (game["home"], -spread if spread is not None else None, game["gameId"])
    players = {}
    for player_id, entry in (scout.get("players") or {}).items():
        found = matchups.get(entry.get("team"))
        if not found:
            continue
        opponent, spread, game_id = found
        # Only the props his role has: a passer's, a receiver's, a runner's.
        roles = {"passing": (entry.get("passes") or 0) >= 20, "receiving": sum(entry.get("targets") or []) >= 5,
                 "rushing": sum(entry.get("carries") or []) >= 10 or bool(entry.get("qbRush"))}
        notes = {family: items for family, items in notes_for(scout, player_id, entry["team"], opponent, spread).items() if roles[family]}
        if notes:
            players[player_id] = {"opponent": opponent, "notes": notes}
    return {"season": season, "weeks": scout.get("weeks") or [], "players": players, "builtAt": time.time(), "version": VERSION}
