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

Sources (nflverse's free season files): play by play, FTN's charting of
every play (blitzers, box count), Pro Football Reference's advanced stats
(pressures, yards after contact, broken tackles) and snap counts. Charting
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
import time
from collections import defaultdict
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from backend.sports.nfl.cache import NFLCacheDomain, cached_nfl
from backend.sports.nfl.services.nflverse import RELEASE, canonical_team

VERSION = "nfl-scout-v1"
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


def _clock(value):
    """'4:32' -> 272 seconds."""
    try:
        minutes, seconds = str(value).split(":")
        return int(minutes) * 60 + int(seconds)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- the table

def summarize(plays, charting, pressured, contact, snaps):
    """The season's scouting table from its parts:

      plays      play-by-play rows (PBP_FIELDS)
      charting   {(game_id, play_id): {"blitz": bool, "box": int | None}}
      pressured  {defense: times opposing quarterbacks were pressured}
      contact    {gsis id: {"carries", "afterContact", "broken"}}
      snaps      {gsis id: [(week, share of offensive snaps), ...]}
    """
    defense = defaultdict(lambda: defaultdict(float))
    offense = defaultdict(lambda: {"games": set(), "drives": {}})
    team_game = defaultdict(lambda: defaultdict(float))   # (team, game) -> targets on charted dropbacks
    player = defaultdict(lambda: {"team": None, "week": -1, "games": {}, "passes": 0, "split": defaultdict(float)})
    for row in plays:
        if str(row.get("season_type")).upper() != "REG" or _flag(row, "two_point_attempt"):
            continue
        game_id, team, against = row.get("game_id"), canonical_team(row.get("posteam")), canonical_team(row.get("defteam"))
        if not game_id or not team or not against:
            continue
        week = int(_num(row.get("week")) or 0)
        chart = charting.get(_play_key(game_id, row.get("play_id")))
        offense[team]["games"].add(game_id)
        drive = row.get("fixed_drive")
        seconds = _clock(row.get("drive_time_of_possession"))
        if _present(drive) and seconds is not None:
            offense[team]["drives"][(game_id, drive)] = seconds

        def who(player_id):
            entry = player[player_id]
            if week >= entry["week"]:
                entry["week"], entry["team"] = week, team
            return entry.setdefault("games", {}).setdefault(game_id, {"week": week, "team": team, "targets": 0, "carries": 0})

        if _flag(row, "qb_dropback"):
            stats = defense[against]
            stats["dropbacks"] += 1
            if chart is not None:
                stats["charted"] += 1
                stats["blitzed"] += chart["blitz"]
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
            rusher = row.get("rusher_player_id")
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

    teams = sorted(set(defense) | set(offense))
    rates = {
        "blitz": {team: _ratio(defense[team]["blitzed"], defense[team]["charted"], 60) for team in teams},
        "pressure": {team: _ratio(pressured.get(team), defense[team]["dropbacks"], 60) if team in pressured else None for team in teams},
        "lightBox": {team: _ratio(defense[team]["light"], defense[team]["boxed"], 40) for team in teams},
        "ypc": {team: _ratio(defense[team]["runYards"], defense[team]["runs"], 40) for team in teams},
        "rushSuccess": {team: _ratio(defense[team]["runSuccess"], defense[team]["runs"], 40) for team in teams},
        "ypa": {team: _ratio(defense[team]["passYards"], defense[team]["attempts"], 60) for team in teams},
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
    weeks = sorted({int(_num(row.get("week")) or 0) for row in plays if str(row.get("season_type")).upper() == "REG"} - {0})
    charted = sorted({key[0] for key in charting})
    return {"teams": table, "league": league, "players": players, "teamCount": len(teams), "weeks": weeks,
            "chartedGames": len(charted), "version": VERSION}


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
            charting[key] = {"blitz": bool(blitzers and blitzers > 0), "box": int(box) if box is not None else None}
    pressured = defaultdict(float)
    for row in _stream(f"{RELEASE}/pfr_advstats/advstats_week_pass_{season}.csv"):
        if str(row.get("game_type")).upper() == "REG" and _num(row.get("times_pressured")) is not None:
            pressured[canonical_team(row.get("opponent"))] += _num(row["times_pressured"])
    from backend.sports.nfl import finder
    by_pfr = {}
    for row in finder.roster_rows(season):
        pfr, gsis = str(row.get("pfr_id") or "").strip(), str(row.get("gsis_id") or "").strip()
        if _present(pfr) and _present(gsis):
            by_pfr[pfr] = gsis
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
    return summarize(plays, charting, dict(pressured), dict(contact), dict(snaps))


def table(season):
    """The season's scouting table, built once and kept (it streams the
    whole play-by-play file)."""
    return cached_nfl(NFLCacheDomain.PLAY_BY_PLAY, (VERSION, "table", season), lambda: build(season))


# ---------------------------------------------------------------- notes

FAMILIES = {
    "passing_yards": ("passing",), "pass_completions": ("passing",), "passing_attempts": ("passing",),
    "passing_touchdowns": ("passing",), "receptions": ("receiving",), "receiving_yards": ("receiving",),
    "targets": ("receiving",), "longest_reception": ("receiving",), "rushing_yards": ("rushing",),
    "rush_attempts": ("rushing",), "rushing_receiving_yards": ("rushing", "receiving"),
}
YARDS = {"passing_yards", "receiving_yards", "rushing_yards", "rushing_receiving_yards", "longest_reception"}


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
    return {family: items for family, items in out.items() if items}


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
                 "rushing": sum(entry.get("carries") or []) >= 10}
        notes = {family: items for family, items in notes_for(scout, player_id, entry["team"], opponent, spread).items() if roles[family]}
        if notes:
            players[player_id] = {"opponent": opponent, "notes": notes}
    return {"season": season, "weeks": scout.get("weeks") or [], "players": players, "builtAt": time.time(), "version": VERSION}
