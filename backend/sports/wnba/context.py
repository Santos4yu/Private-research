"""Matchup numbers derived from the stored WNBA season (see league.py).

Everything here is arithmetic on finished box scores -- nothing is
estimated or modelled. Where a number needs a judgement call (which
players count toward "defense vs guards", what a zone is), the choice is
written down next to it and repeated to the viewer in the page's notes.
"""
from __future__ import annotations

import re
from collections import defaultdict
from datetime import datetime, timezone

from . import opportunity
from .league import FIELDS, ZONES

# A player's row is [id, starter, *FIELDS].
_I = {name: index + 2 for index, name in enumerate(FIELDS)}

# Every stat the matchup views can show, keyed the way the page asks for it.
STATS = (
    ("pr", "Pts+Rebs", ("pts", "reb")),
    ("pts", "Points", ("pts",)),
    ("reb", "Rebounds", ("reb",)),
    ("ast", "Assists", ("ast",)),
    ("pa", "Pts+Asts", ("pts", "ast")),
    ("ra", "Rebs+Asts", ("reb", "ast")),
    ("pra", "Pts+Rebs+Asts", ("pts", "reb", "ast")),
    ("tpm", "3-PT Made", ("tpm",)),
    ("tpa", "3-PT Attempted", ("tpa",)),
    ("fgm", "FG Made", ("fgm",)),
    ("ftm", "FT Made", ("ftm",)),
    ("stl", "Steals", ("stl",)),
    ("blk", "Blocks", ("blk",)),
    ("bs", "Blks+Stls", ("blk", "stl")),
    ("to", "Turnovers", ("to",)),
    ("pf", "Fouls", ("pf",)),
    ("fga", "FG Attempted", ("fga",)),
    ("fta", "FT Attempted", ("fta",)),
    # Two-pointers: field goals less threes.
    ("twos", "Two Pointers Made", ("fgm", "tpm")),
    ("twosa", "Two Pointers Attempted", ("fga", "tpa")),
    ("oreb", "Offensive Rebounds", ("oreb",)),
    ("dreb", "Defensive Rebounds", ("dreb",)),
    # 1 when 10+ in two of points, rebounds, assists, steals and blocks.
    ("dd", "Double-Double", ("pts", "reb", "ast", "stl", "blk")),
    # 1 when 10+ in three of them.
    ("td", "Triple-Double", ("pts", "reb", "ast", "stl", "blk")),
    ("fs", "Fantasy Score", ("pts", "reb", "ast", "blk", "stl", "to")),
)
STAT_KEYS = tuple(key for key, _, _ in STATS)
_PARTS = {key: parts for key, _, parts in STATS}
# The prop board's market keys, mapped onto the stats above.
MARKET_STAT = {
    "player_points": "pts", "player_rebounds": "reb", "player_assists": "ast", "player_threes": "tpm",
    "player_blocks": "blk", "player_steals": "stl", "player_blocks_steals": "bs", "player_turnovers": "to",
    "player_points_rebounds": "pr", "player_points_assists": "pa", "player_rebounds_assists": "ra",
    "player_points_rebounds_assists": "pra", "player_fantasy_points": "fs",
    # Posted by PrizePicks only (see api/wnba.py _merge_prizepicks).
    "player_threes_attempts": "tpa", "player_field_goals": "fgm", "player_frees_made": "ftm",
    "player_field_goals_attempts": "fga", "player_frees_attempts": "fta", "player_twos": "twos",
    "player_twos_attempts": "twosa", "player_fouls": "pf", "player_offensive_rebounds": "oreb",
    "player_defensive_rebounds": "dreb", "player_double_double": "dd", "player_triple_double": "td",
}
# Same fantasy formula the game-log endpoint uses (api/wnba.py).
_FANTASY = {"pts": 1, "reb": 1.2, "ast": 1.5, "blk": 3, "stl": 3, "to": -1}
POSITIONS = ("G", "F", "C")
WINDOWS = (("szn", None), ("l10", 10), ("l5", 5))
# "Similar players" are starters-level minutes only, for the same reason.
SIMILAR_MIN_MINUTES = 20


def stat_value(row, key):
    parts = _PARTS[key]
    values = [row[_I[part]] for part in parts]
    if any(value is None for value in values):
        return None
    if key == "fs":
        return round(sum(_FANTASY[part] * value for part, value in zip(parts, values)), 1)
    if key in ("twos", "twosa"):
        return values[0] - values[1]
    if key in ("dd", "td"):
        return 1 if sum(value >= 10 for value in values) >= (2 if key == "dd" else 3) else 0
    return sum(values)


def headshot(pid: str, player, league: str = "wnba") -> str:
    """ESPN leaves the headshot off some box scores; its CDN still has one
    for most players at this address (the page hides it if it 404s)."""
    return (player or [None, None, None])[2] or f"https://a.espncdn.com/i/headshots/{league}/players/full/{pid}.png"


def primary_position(player) -> str | None:
    position = str((player or [None, ""])[1] or "").upper()[:1]
    return position if position in POSITIONS else None


def team_games(payload: dict) -> dict:
    """team -> its games in date order, each with its own and the opposing box."""
    by_team = defaultdict(list)
    for game in payload.get("games", {}).values():
        teams = list(game.get("t") or {})
        if len(teams) != 2:
            continue
        for team in teams:
            opponent = teams[1] if teams[0] == team else teams[0]
            by_team[team].append({"id": game["id"], "date": game["date"], "type": game["type"], "season": game.get("season"),
                                  "home": game["home"] == team, "opponent": opponent,
                                  "own": game["t"][team], "opp": game["t"][opponent]})
    for games in by_team.values():
        games.sort(key=lambda game: game["date"] or "")
    return by_team


def _rank(values: dict, ascending: bool) -> dict:
    """team -> rank (1-based) for the teams that have a value. Teams with the
    same value share a rank, and the next rank skips (1, 2, 2, 4)."""
    ordered = sorted((value for value in values.values() if value is not None), reverse=not ascending)
    return {team: ordered.index(value) + 1 for team, value in values.items() if value is not None}


def _round(value, digits=2):
    return None if value is None else round(value, digits)


def defense_vs_position(by_team: dict, players: dict, positions=POSITIONS, bucket=None) -> dict:
    """What each team allows a position a game: everything the opposing
    guards (forwards, centers) put up in a game added together, averaged
    over the team's games -- the usual way it's counted, so the ranks match
    other research sites. A game where the opponent played nobody at the
    position is left out: it says nothing about the defense (Oct 30: counted
    as 0 allowed, about 1 game in 10 at PG, SF or C, it moved teams 1 to 4
    places on average and up to 16 on last season's games). Rank 1 allows
    the least (toughest); the highest rank allows the most. `n` is how many
    opposing players at the position played in those games, `g` how many
    games counted. `bucket(player id)` names the positions a player counts
    at (by default his G / F / C from the box scores)."""
    if bucket is None:
        bucket = lambda pid: (primary_position(players.get(pid)),)
    return position_table(by_team, spot_games(by_team, positions, bucket), positions)


def spot_games(by_team: dict, positions, bucket) -> dict:
    """(team, position) -> the team's games in order, each as what the
    opponents at the position put up: None when nobody there played, else
    {stat: (total, players, their minutes)} and "_n" players."""
    seen_at = {}
    places = lambda pid: seen_at.setdefault(pid, set(bucket(pid)))
    spots = {}
    for team, games in by_team.items():
        for position in positions:
            cells = []
            for game in games:
                at_spot = [row for row in game["opp"]["p"] if row[_I["min"]] and position in places(row[0])]
                if not at_spot:
                    cells.append(None)
                    continue
                cell = {"_n": len(at_spot)}
                for key in STAT_KEYS:
                    values = [(value, row[_I["min"]]) for row in at_spot if (value := stat_value(row, key)) is not None]
                    if values:
                        cell[key] = (sum(value for value, _ in values), len(values), sum(minutes for _, minutes in values))
                cells.append(cell)
            spots[(team, position)] = cells
    return spots


def _view_value(cells: list, key: str, view: str):
    rows = [cell[key] for cell in cells if key in cell]
    if not rows:
        return None
    total = sum(row[0] for row in rows)
    if view == "player":
        return total / sum(row[1] for row in rows)
    if view == "per36":
        minutes = sum(row[2] for row in rows)
        return total / minutes * 36 if minutes else None
    return total / len(rows)


def position_table(by_team: dict, spots: dict, positions, windows=WINDOWS, view: str = "total") -> dict:
    """team -> position -> {stats: {stat: {window: [value, rank]}}, n, g}
    from spot_games, each stat and window ranked on its own across the
    teams (1 allows the least). `view` (VIEWS): total, the position's
    players added up a game; player, a player-game at a time; per36, per
    36 minutes they played."""
    result = {team: {position: {"n": {}, "g": {}, "stats": {}} for position in positions} for team in by_team}
    for position in positions:
        for window, size in windows:
            chosen = {}
            for team in by_team:
                cells = spots[(team, position)]
                chosen[team] = [cell for cell in (cells[-size:] if size else cells) if cell]
            for key in STAT_KEYS:
                values = {team: _view_value(chosen[team], key, view) for team in by_team}
                ranks = _rank(values, ascending=True)
                for team in by_team:
                    result[team][position]["stats"].setdefault(key, {})[window] = [_round(values[team]), ranks.get(team)]
            for team in by_team:
                result[team][position]["n"][window] = sum(cell["_n"] for cell in chosen[team])
                result[team][position]["g"][window] = len(chosen[team])
    return result


# The Finder's Defense vs position, one season at a time (resource=dvp).
# ALL: every opposing player. The NBA splits by PG, SG, SF, PF and C (the
# owner, Oct 30: "make it specific instead of just G C F"). ESPN names almost
# nobody that way -- 99.6% of last season's minutes were played by a G, F or
# C in its box scores, and its rosters read the same -- so a G or F is placed
# by how he plays (split_positions) wherever the rosters don't say.
SPECIFIC = ("PG", "SG", "SF", "PF", "C")
SPECIFIC_SHARE = 0.6
# A 36 minutes: a guard with 5.5 assists or more is the point guard, a
# forward with 7.5 rebounds and blocks or more the power forward. A guard
# who isn't the passer and stands 6'6" or more (ESPN's rosters) plays the
# wing: small forward (Mikal Bridges). Checked on the 2025
# and 2026 seasons' box scores against players whose position is well
# known: guards 67% placed as known on assists alone, 74% with the height;
# a forward's height didn't help (SFs and PFs there both stand about 6'8").
PG_ASSISTS, PF_INSIDE, WING_INCHES = 5.5, 7.5, 78


def inches(height) -> int | None:
    """6'5 (or ESPN's 6' 5") in inches; None when it can't be read."""
    match = re.match(r"\s*(\d+)\s*'\s*(\d+)", str(height or ""))
    return int(match[1]) * 12 + int(match[2]) if match else None


def split_positions(by_team: dict, players: dict, heights: dict | None = None) -> dict:
    """player id -> PG, SG, SF, PF or C, from his own games in `by_team`:
    a G by his assists (and his height, `heights`: id -> inches), an F by
    his rebounds and blocks, a C stays C."""
    heights = heights or {}
    totals = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0])
    for games in by_team.values():
        for game in games:
            for row in game["own"]["p"]:
                total = totals[row[0]]
                for index, field in enumerate(("min", "ast", "reb", "blk")):
                    total[index] += row[_I[field]] or 0
    placed = {}
    for pid, (minutes, ast, reb, blk) in totals.items():
        broad = primary_position(players.get(pid))
        if not minutes or not broad:
            continue
        per = 36 / minutes
        guard = "PG" if ast * per >= PG_ASSISTS else "SF" if (heights.get(str(pid)) or 0) >= WING_INCHES else "SG"
        placed[str(pid)] = {"G": guard, "F": "PF" if (reb + blk) * per >= PF_INSIDE else "SF", "C": "C"}[broad]
    return placed


# The Finder's Defense vs position views and windows (resource=dvp). Total
# (the default, the usual way it's counted): the position's players added up
# a game. Per player: a player-game at a time. Per 36: per 36 minutes they
# played, so a defense isn't judged on how many of them it happened to face.
VIEWS = (("total", "Total"), ("player", "Per player"), ("per36", "Per 36 min"))
DVP_WINDOWS = (("szn", None), ("l15", 15), ("l10", 10), ("l5", 5))


def season_dvp(payload: dict, specific: dict | None = None, split: bool = False, heights: dict | None = None,
               place_from: dict | None = None) -> dict:
    """One stored season's Defense vs position: {positions, specific,
    placed, games, teamCount, through, views: {view: position_table}} and,
    for position_log, `_by_team` and `_places`. `specific` (player id -> PG,
    SG...) is the rosters'; with `split` everyone else is placed by how he
    plays and his height (split_positions, `heights`: id -> inches), read
    from `place_from` when given (a young season with last season's games
    joined, so five games don't decide who's a point guard). PG / SG / SF /
    PF / C when that covers enough of the minutes played (SPECIFIC_SHARE),
    else G / F / C. `placed`: each player's position as counted."""
    by_team = team_games(payload)
    players = payload.get("players") or {}
    specific = {str(pid): pos for pid, pos in (specific or {}).items() if pos in SPECIFIC}
    if split:
        source = place_from or payload
        specific = {**split_positions(team_games(source), {**(source.get("players") or {}), **players}, heights), **specific}
    played = known = 0.0
    for games in by_team.values():
        for game in games:
            for row in game["own"]["p"]:
                minutes = row[_I["min"]] or 0
                played += minutes
                known += minutes if str(row[0]) in specific else 0
    detailed = bool(played) and known / played >= SPECIFIC_SHARE
    if detailed:
        positions = ("ALL",) + SPECIFIC
        # A player the rosters don't place counts in ALL alone (a G could be
        # either guard); centers from the box score count as centers.
        bucket = lambda pid: ("ALL", specific.get(str(pid)) or ("C" if primary_position(players.get(pid)) == "C" else None))
    else:
        positions = ("ALL",) + POSITIONS
        bucket = lambda pid: ("ALL", primary_position(players.get(pid)))
    spots = spot_games(by_team, positions, bucket)
    dates = [game.get("date") for game in (payload.get("games") or {}).values() if game.get("date")]
    return {"season": payload.get("season"), "positions": list(positions), "specific": detailed,
            "games": {team: len(games) for team, games in by_team.items()}, "teamCount": len(by_team),
            "through": max(dates) if dates else None,
            "views": {view: position_table(by_team, spots, positions, DVP_WINDOWS, view) for view, _ in VIEWS},
            "placed": specific if detailed else {}, "_by_team": by_team, "_places": bucket, "_players": players}


# The game-by-game list's stats: the table's, in its order.
LOG_KEYS = STAT_KEYS


def position_log(table: dict, team: str, position: str) -> list:
    """`team`'s games in season_dvp's `table`, newest first, as the
    opponents at `position` played them: {id, date, opponent, home,
    players: [[name, minutes, [each LOG_KEYS stat]]]}. players [] when
    nobody there played (that game is left out of the table)."""
    places = table["_places"]
    log = []
    for game in reversed(table["_by_team"].get(team) or []):
        rows = [row for row in game["opp"]["p"] if row[_I["min"]] and position in places(row[0])]
        log.append({"id": game["id"], "date": game["date"], "opponent": game["opponent"], "home": game["home"],
                    "players": [[_player_name(row[0], table), row[_I["min"]], [stat_value(row, key) for key in LOG_KEYS]]
                                for row in sorted(rows, key=lambda row: -(row[_I["min"]] or 0))]})
    return log


def _player_name(pid, table: dict) -> str:
    return (table.get("_players") or {}).get(pid, [""])[0] or ""


def reconcile(payload: dict) -> dict:
    """The stored box scores checked against themselves and ESPN's
    schedule: each player's points against his shots (2 a field goal, 1
    more a three, 1 a free throw); each team's players' points against
    its final score (the schedule's, when it carries one); no game stored
    twice (same day and teams) and no player twice in a box; and the
    finished games not stored yet. {checked, verified, off: [{id, date,
    team, box, final}], duplicates, missing, through}."""
    games = payload.get("games") or {}
    finals = {str(item.get("id")): item.get("score") or {} for item in payload.get("schedule") or []}
    checked = verified = duplicates = 0
    off, matchups = [], set()
    for game in sorted(games.values(), key=lambda game: game.get("date") or ""):
        matchup = (str(game.get("date") or "")[:10], game.get("home"), game.get("away"))
        duplicates += matchup in matchups
        matchups.add(matchup)
        checked += 1
        final = finals.get(str(game.get("id"))) or {}
        good = True
        for team, side in (game.get("t") or {}).items():
            rows = side.get("p") or []
            ids = [row[0] for row in rows]
            duplicates += len(ids) - len(set(ids))
            box = 0
            for row in rows:
                pts, fgm, tpm, ftm = (row[_I[key]] for key in ("pts", "fgm", "tpm", "ftm"))
                box += pts or 0
                if None not in (pts, fgm, tpm, ftm) and pts != 2 * fgm + tpm + ftm:
                    good = False
                    off.append({"id": game["id"], "date": game.get("date"), "team": team, "player": row[0], "box": pts, "shots": 2 * fgm + tpm + ftm})
            if final.get(team) is not None and box != final[team]:
                good = False
                off.append({"id": game["id"], "date": game.get("date"), "team": team, "box": box, "final": final[team]})
        verified += bool(good and len(final) == 2)
    missing = [item["id"] for item in payload.get("schedule") or [] if item.get("completed") and str(item.get("id")) not in games]
    dates = [game.get("date") for game in games.values() if game.get("date")]
    return {"checked": checked, "verified": verified, "off": off[:20], "offCount": len(off), "duplicates": duplicates,
            "missing": len(missing), "through": max(dates) if dates else None}


def defense_vs_each(by_team: dict, players: dict) -> dict:
    """What each team allows a player at a position a game: every opposing
    guard's (forward's, center's) line against them averaged, a player-game
    at a time -- the way RotoBot reads "vs guards" (11.0 points a game per
    guard, not the 57 they add up to), so the Props tab's matchup score and
    page agree with it. Same shape and ranks as defense_vs_position (rank 1
    allows the least); the Finder keeps reading that one."""
    averages = {}
    for team, games in by_team.items():
        for window, size in WINDOWS:
            chosen = games[-size:] if size else games
            for position in POSITIONS:
                rows = [row for game in chosen for row in game["opp"]["p"]
                        if row[_I["min"]] and primary_position(players.get(row[0])) == position]
                values = {key: [value for row in rows if (value := stat_value(row, key)) is not None] for key in STAT_KEYS}
                averages[(team, position, window)] = {key: sum(found) / len(found) for key, found in values.items() if found}
    result = {team: {position: {"stats": {}} for position in POSITIONS} for team in by_team}
    for position in POSITIONS:
        for window, _ in WINDOWS:
            for key in STAT_KEYS:
                values = {team: averages[(team, position, window)].get(key) for team in by_team}
                ranks = _rank(values, ascending=True)
                for team in by_team:
                    result[team][position]["stats"].setdefault(key, {})[window] = [_round(values[team]), ranks.get(team)]
    return result


def _totals(side) -> dict:
    totals = defaultdict(float)
    for row in side["p"]:
        for key in STAT_KEYS:
            value = stat_value(row, key)
            if value is not None:
                totals[key] += value
        for field in ("fga", "tpa", "fta"):
            if row[_I[field]] is not None:
                totals[field] += row[_I[field]]
    return totals


TEAM_STATS = ("pts", "reb", "ast", "pr", "tpm", "fgm", "ftm", "stl", "blk", "to", "fgPct", "tpPct")


def team_stats(by_team: dict) -> dict:
    """Per-game offense and defense (what opponents score) for every team.

    Offense rank 1 produces the most; defense rank 1 allows the least."""
    offense, defense, games_played = {}, {}, {}
    for team, games in by_team.items():
        own_sum, opp_sum = defaultdict(float), defaultdict(float)
        for game in games:
            for target, side in ((own_sum, game["own"]), (opp_sum, game["opp"])):
                for key, value in _totals(side).items():
                    target[key] += value
        count = len(games) or 1
        games_played[team] = len(games)
        for target, source in ((offense, own_sum), (defense, opp_sum)):
            per_game = {key: source[key] / count for key in STAT_KEYS if key in source}
            per_game["fgPct"] = source["fgm"] / source["fga"] * 100 if source.get("fga") else None
            per_game["tpPct"] = source["tpm"] / source["tpa"] * 100 if source.get("tpa") else None
            target[team] = per_game
    result = {team: {"games": games_played[team], "off": {}, "def": {}} for team in by_team}
    for key in TEAM_STATS:
        off_values = {team: offense[team].get(key) for team in by_team}
        def_values = {team: defense[team].get(key) for team in by_team}
        # Turnovers and fouls are the exception: fewer is the better offense,
        # and forcing more is the better defense.
        fewer_is_better = key == "to"
        off_ranks = _rank(off_values, ascending=fewer_is_better)
        def_ranks = _rank(def_values, ascending=not fewer_is_better)
        for team in by_team:
            result[team]["off"][key] = [_round(off_values[team]), off_ranks.get(team)]
            result[team]["def"][key] = [_round(def_values[team]), def_ranks.get(team)]
    return result


def zone_defense(by_team: dict) -> tuple[dict, dict]:
    """FG% each team allows in each shot zone (rank 1 = lowest, toughest),
    plus the league-wide FG% per zone for reference."""
    allowed = {team: {zone: [0, 0] for zone in ZONES} for team in by_team}
    league = {zone: [0, 0] for zone in ZONES}
    for team, games in by_team.items():
        for game in games:
            for _pid, zone_index, made, attempts in game["opp"].get("z", []):
                zone = ZONES[zone_index]
                allowed[team][zone][0] += made
                allowed[team][zone][1] += attempts
                league[zone][0] += made
                league[zone][1] += attempts
    result = {team: {} for team in by_team}
    for zone in ZONES:
        pct = {team: (made / attempts * 100 if attempts else None) for team, (made, attempts) in
               ((team, allowed[team][zone]) for team in by_team)}
        ranks = _rank(pct, ascending=True)
        for team in by_team:
            games = len(by_team[team]) or 1
            result[team][zone] = [_round(pct[team], 1), ranks.get(team), _round(allowed[team][zone][1] / games, 1)]
    league_pct = {zone: _round(made / attempts * 100, 1) if attempts else None for zone, (made, attempts) in league.items()}
    return result, league_pct


# A roster this short is the off-season's (free agents gone): not used.
FULL_ROSTER = 8
_ROSTER_POSITION = {"PG": "G", "SG": "G", "G": "G", "SF": "F", "PF": "F", "F": "F", "C": "C"}


def _roster_position(value) -> str:
    """ESPN's roster position (PG, SF, G-F...) as G, F or C."""
    text = str(value or "").upper()
    return _ROSTER_POSITION.get(text) or _ROSTER_POSITION.get(text.split("-")[0]) or text[:1]


# Each player's part in his team's last RECENT games (the NBA matchup score's
# who's-out reads): how many he played, his minutes in them, and whether he
# played one of the last three. A player out tonight counts only if he's
# been in the rotation lately -- someone out for weeks is already missing
# from the team's recent games.
RECENT = 10


def _recent_minutes(games: list) -> dict:
    """player id -> (games played of the team's last RECENT, average
    minutes in them, played one of its last three, games played for the
    team this season)."""
    played, minutes, last3, season_games = defaultdict(int), defaultdict(float), set(), defaultdict(int)
    window = games[-RECENT:]
    for index, game in enumerate(window):
        for row in game["own"]["p"]:
            if (row[_I["min"]] or 0) > 0:
                played[row[0]] += 1
                minutes[row[0]] += row[_I["min"]]
                if index >= len(window) - 3:
                    last3.add(row[0])
    season = max((game.get("season") or 0 for game in games), default=0)
    for game in games:
        if (game.get("season") or 0) == season:
            for row in game["own"]["p"]:
                if (row[_I["min"]] or 0) > 0:
                    season_games[row[0]] += 1
    return {pid: (count, minutes[pid] / count, pid in last3, season_games.get(pid, 0)) for pid, count in played.items()}


def _with_recent(entries: list, games: list) -> list:
    recent = _recent_minutes(games)
    for entry in entries:
        count, avg, last3, this_season = recent.get(entry["id"], (0, 0.0, False, 0))
        # playedSzn: his games for this team this season. Early in a season
        # the last 10 reach into last season (Oct 26: three Bucks who hadn't
        # played this season read as "back" for Jaime Jaquez).
        entry.update({"played10": count, "min10": _round(avg, 1), "last3": last3, "playedSzn": this_season})
    return entries


# A starter who sat out one of the team's last SAT_OUT games (rest, the
# second night of a back-to-back) is still a starter.
SAT_OUT = 3


def _starting_five(games: list, by_id: dict) -> list:
    """The team's starters: its last game's five (those still listed in
    `by_id`, id -> {starts, games, min}), unless a regular starter sat that
    game out. Anyone whose latest of the team's last SAT_OUT games was a
    start but who missed its last game competes with that five on how many
    of his own last games he started (Oct 26: Kyrie Irving sat the Spurs
    game, the second of a back-to-back, and read as bench; the fill-in who
    started for him is the one who goes back to the bench)."""
    if not games:
        return []
    last = games[-1]["own"]["p"]
    played_last = {row[0] for row in last}
    chosen = [row[0] for row in last if row[1] and row[0] in by_id]
    latest = {}
    for game in games[-SAT_OUT:]:
        for row in game["own"]["p"]:
            latest[row[0]] = row[1]
    sat = [pid for pid, started in latest.items() if started and pid not in played_last and pid in by_id]
    if not sat:
        return chosen
    share = lambda pid: by_id[pid]["starts"] / by_id[pid]["games"] if by_id[pid].get("games") else 0
    pool = sorted(chosen + sat, key=lambda pid: (-share(pid), pid not in chosen, -(by_id[pid].get("min") or 0)))
    return pool[:5]


def _played_last(games: list) -> set:
    return {row[0] for row in games[-1]["own"]["p"]} if games else set()


def _roster_rotation(team: str, games: list, roster: dict, history: dict, players: dict, size: int, league: str) -> list:
    """The team's players now (`roster`: id -> {name, pos, headshot}), each
    on his own last few games wherever he played them: anyone gone since is
    off, and a newcomer is on before his first game here. The starters are
    the team's last game's who are still here, then whoever started his own
    latest game, most minutes first, to five."""
    entries = []
    for pid, info in roster.items():
        played = history.get(pid, [])[-size:]
        known = players.get(pid) or ["", "", None, None]
        entries.append({"id": pid, "name": info.get("name") or known[0], "pos": known[1] or _roster_position(info.get("pos")),
                        "headshot": info.get("headshot") or headshot(pid, known, league),
                        "min": _round(sum(minutes for _, _, minutes in played) / len(played), 1) if played else 0,
                        "games": len(played), "starts": sum(started for _, started, _ in played), "lastStart": False})
    chosen = _starting_five(games, {entry["id"]: entry for entry in entries})
    others = sorted((entry for entry in entries if entry["id"] not in chosen and history.get(entry["id"]) and history[entry["id"]][-1][1]),
                    key=lambda entry: -entry["min"])
    chosen += [entry["id"] for entry in others][:max(0, 5 - len(chosen))]
    played_last = _played_last(games)
    for entry in entries:
        entry["lastStart"] = entry["id"] in chosen
        # Whether he played the team's last game (the page says so when a starter sat it).
        entry["playedLast"] = entry["id"] in played_last
    return entries


def rotation(by_team: dict, players: dict, size: int = 5, league: str = "wnba", rosters: dict | None = None) -> dict:
    """Who plays, from the last few games: last game's starters first, then
    everyone else by minutes. ESPN publishes no WNBA depth chart, so this is
    the rotation as actually used, not a coach's depth chart. With the
    current `rosters` (team -> {id: {name, pos, headshot}}), a team's chart
    is its players now (_roster_rotation): at the start of a season its
    last games are last season's, and a signing would be missing. Every
    player is listed: an NBA roster runs to 18, and a cut at 13 left a
    regular off his own team's chart (Oct 30: Deandre Ayton, Wizards)."""
    order = {"G": 0, "F": 1, "C": 2}
    result = {}
    # Every player's games, wherever he played them: (date, started, minutes), in order.
    history = defaultdict(list)
    if rosters:
        for games in by_team.values():
            for game in games:
                for row in game["own"]["p"]:
                    history[row[0]].append((game["date"] or "", row[1], row[_I["min"]] or 0))
        for played in history.values():
            played.sort(key=lambda item: item[0])
    for team, games in by_team.items():
        roster = (rosters or {}).get(team) or {}
        if len(roster) >= FULL_ROSTER:
            entries = _with_recent(_roster_rotation(team, games, roster, history, players, size, league), games)
            entries.sort(key=lambda e: (not e["lastStart"], order.get(primary_position([None, e["pos"]]), 3) if e["lastStart"] else 0, -e["min"]))
            result[team] = {"games": min(len(games), size), "lastGame": games[-1]["date"] if games else None, "players": entries}
            continue
        if not games:
            continue
        recent = games[-size:]
        minutes, starts, appearances = defaultdict(float), defaultdict(int), defaultdict(int)
        for game in recent:
            for row in game["own"]["p"]:
                minutes[row[0]] += row[_I["min"]] or 0
                starts[row[0]] += row[1]
                appearances[row[0]] += 1
        entries = []
        for pid in appearances:
            player = players.get(pid) or ["", "", None, None]
            # Traded away since: no longer part of this rotation.
            if player[3] and player[3] != team:
                continue
            entries.append({"id": pid, "name": player[0], "pos": player[1], "headshot": headshot(pid, player, league),
                            "min": _round(minutes[pid] / appearances[pid], 1), "games": appearances[pid],
                            "starts": starts[pid]})
        starters, played_last = set(_starting_five(games, {entry["id"]: entry for entry in entries})), _played_last(games)
        for entry in entries:
            entry.update({"lastStart": entry["id"] in starters, "playedLast": entry["id"] in played_last})
        entries.sort(key=lambda e: (not e["lastStart"], order.get(primary_position([None, e["pos"]]), 3) if e["lastStart"] else 0, -e["min"]))
        result[team] = {"games": len(recent), "lastGame": games[-1]["date"], "players": _with_recent(entries, games)}
    return result


# How far either side of today a team's game dates are kept for rest (the
# page works out back-to-backs and games in a few nights from them).
REST_DAYS = 10


def rest_table(schedule: list, now: datetime | None = None) -> dict:
    """team -> the start times of its games within REST_DAYS of now, in
    order: enough for the page to tell a back-to-back, three games in four
    nights or a long rest before any game this week."""
    now = now or datetime.now(timezone.utc)
    near = {}
    for game in schedule or []:
        try:
            when = datetime.fromisoformat(str(game.get("date")).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        if abs((when - now).total_seconds()) > REST_DAYS * 86400:
            continue
        for team in (game.get("home"), game.get("away")):
            if team:
                near.setdefault(team, []).append(game["date"])
    return {team: sorted(dates) for team, dates in near.items()}


def league_context(payload: dict, rosters: dict | None = None) -> dict:
    from . import scout
    by_team = team_games(payload)
    players = payload.get("players", {})
    zones, league_zones = zone_defense(by_team)
    return {
        "season": payload.get("season"), "builtAt": payload.get("builtAt"),
        "teams": {abbr: {key: team.get(key) for key in ("id", "name", "short", "logo", "color", "altColor")}
                  for abbr, team in (payload.get("teams") or {}).items() if abbr in by_team},
        "teamCount": len(by_team),
        "stats": [[key, label] for key, label, _ in STATS],
        "dvp": defense_vs_position(by_team, players),
        # The same, a player at a time (the Props tab's NBA score and page).
        "dvpEach": defense_vs_each(by_team, players),
        "teamStats": team_stats(by_team),
        # Pace, ratings and the chances each team's games give (opportunity.py).
        "opportunity": opportunity.team_table(by_team),
        "zoneDefense": zones, "leagueZones": league_zones,
        # Shooting each position gets against a defense, and what else it gives up (scout.py).
        "positionShooting": scout.position_shooting(by_team, players), "teamDefense": scout.team_defense(by_team),
        "rotation": rotation(by_team, players, league=payload.get("league") or "wnba", rosters=rosters),
        "rest": rest_table(payload.get("schedule")),
        "games": {team: len(games) for team, games in by_team.items()},
        # Early in a season the numbers above take last season's games too
        # (api/wnba.py, opportunity.blend). The same tables from this
        # season's games alone, for anything that tells a reader how a team
        # is doing now (the write-ups, Oct 25: "is this true data?").
        "thisSeason": this_season_tables(payload, by_team, players) if payload.get("blended") else None,
        # Last season's shot zones alone, for the shot chart's season switch
        # (Oct 26, the owner: see this season and last season apart).
        "lastSeason": last_season_zones(payload, by_team) if payload.get("blended") else None,
    }


def last_season_zones(payload: dict, by_team: dict) -> dict | None:
    """What each defense allowed by shot zone over last season's games alone."""
    season = (payload.get("blended") or [None])[0]
    previous = {team: [game for game in games if game.get("season") == season] for team, games in by_team.items()}
    previous = {team: games for team, games in previous.items() if games}
    if not previous:
        return None
    zones, league_zones = zone_defense(previous)
    return {"season": season, "games": {team: len(games) for team, games in previous.items()}, "teamCount": len(previous),
            "zoneDefense": zones, "leagueZones": league_zones}


def this_season_tables(payload: dict, by_team: dict, players: dict) -> dict | None:
    """The defense tables from this season's games alone, and how many each team has played."""
    season = payload.get("season")
    current = {team: [game for game in games if game.get("season") == season] for team, games in by_team.items()}
    current = {team: games for team, games in current.items() if games}
    if not current:
        return None
    zones, league_zones = zone_defense(current)
    return {"season": season, "games": {team: len(games) for team, games in current.items()}, "teamCount": len(current),
            "dvpEach": defense_vs_each(current, players), "teamStats": team_stats(current),
            "opportunity": opportunity.team_table(current), "zoneDefense": zones, "leagueZones": league_zones}


def _player_rows(by_team: dict) -> dict:
    """player id -> [(game, row)] across the season, for season averages."""
    rows = defaultdict(list)
    for team, games in by_team.items():
        for game in games:
            for row in game["own"]["p"]:
                rows[row[0]].append((game["id"], row))
    return rows


def usage_rate(row: list, team_rows: list) -> float | None:
    """His share of his team's plays while he was on the floor (the usual
    usage rate): his shots, trips to the line and turnovers, against the
    team's, scaled by his minutes. None without minutes or a team box."""
    value = lambda entry, field: entry[_I[field]] or 0
    plays = lambda entry: value(entry, "fga") + 0.44 * value(entry, "fta") + value(entry, "to")
    minutes = value(row, "min")
    team_minutes = sum(value(entry, "min") for entry in team_rows)
    team_plays = sum(plays(entry) for entry in team_rows)
    if not minutes or not team_minutes or not team_plays:
        return None
    return _round(100 * plays(row) * (team_minutes / 5) / (minutes * team_plays), 1)


# A teammate counts as missing from a game when he scored at least this
# much that season, over at least this many games.
OUT_PPG, OUT_GAMES, OUT_SHOWN = 6.0, 3, 3


def game_notes(payloads: list, player_id: str) -> dict:
    """For each stored game the player played: his usage rate, whether he
    started, the teammates who sat it out that mattered (their season
    scoring, most first, and whether they usually start) and the same for
    the other side (`oppOut`), keyed by game id. `payloads` are stored
    seasons, oldest first; any may be missing."""
    notes = {}
    for payload in payloads:
        if not payload:
            continue
        games = list((payload.get("games") or {}).values())
        players = payload.get("players") or {}
        # Points, games and starts over the season, for who mattered.
        scored = defaultdict(lambda: [0.0, 0, 0])
        for game in games:
            for side in (game.get("t") or {}).values():
                for row in side.get("p", []):
                    if row[_I["pts"]] is not None:
                        scored[row[0]][0] += row[_I["pts"]]
                        scored[row[0]][1] += 1
                        scored[row[0]][2] += 1 if row[1] else 0

        # Each player's time with each team: his first and last game listed
        # there (played or not), open-ended while the directory still has
        # him there. A teammate absent from a game in that time sat it out,
        # listed DNP or not in the box score at all (ESPN leaves many
        # injured players off), the way the with / without splits count.
        spans = {}
        for game in games:
            for code, side in (game.get("t") or {}).items():
                for pid in [row[0] for row in side.get("p", [])] + list(side.get("dnp", [])):
                    first, last = spans.get((code, pid), (game["date"], game["date"]))
                    spans[(code, pid)] = (min(first, game["date"]), max(last, game["date"]))
        roster = defaultdict(list)
        for (code, pid), (first, last) in spans.items():
            open_ended = (players.get(pid) or [None, None, None, None])[3] == code
            roster[code].append((pid, first, None if open_ended else last))

        def missing(code: str, side: dict, date: str) -> list:
            out = []
            played_now = {row[0] for row in side.get("p", [])}
            absent = [pid for pid, first, last in roster.get(code, [])
                      if pid not in played_now and first <= date and (last is None or date <= last)]
            for pid in absent:
                points, played, starts = scored.get(pid, (0.0, 0, 0))
                if played >= OUT_GAMES and points / played >= OUT_PPG:
                    person = players.get(pid) or ["", ""]
                    out.append({"id": pid, "name": person[0], "pos": person[1], "ppg": _round(points / played, 1),
                                "starter": starts * 2 >= played})
            out.sort(key=lambda item: -item["ppg"])
            return out[:OUT_SHOWN]

        for game in games:
            sides = game.get("t") or {}
            for team, side in sides.items():
                mine = next((row for row in side.get("p", []) if row[0] == player_id), None)
                if not mine:
                    continue
                other = next(((code, theirs) for code, theirs in sides.items() if code != team), (None, {}))
                notes[str(game["id"])] = {"usage": usage_rate(mine, side["p"]), "started": bool(mine[1]),
                                          "out": missing(team, side, game["date"]), "oppOut": missing(other[0], other[1], game["date"])}
    return notes


def player_context(payload: dict, player_id: str, team: str, opponent: str, market: str, line: float | None,
                   history: dict | None = None) -> dict:
    """`history`: the seasons the with / without splits read (this one and
    last, the two the chart shows), when `payload` holds only this one."""
    by_team = team_games(payload)
    players = payload.get("players", {})
    stat = MARKET_STAT.get(market, "pts")

    # Shot zones: every located attempt this season, for any team, and (with
    # last season's games blended in) each season's apart for the season switch.
    zones = {zone: [0, 0] for zone in ZONES}
    by_season = {str(season): {zone: [0, 0] for zone in ZONES} for season in (payload.get("blended") or [])}
    for games in by_team.values():
        for game in games:
            for pid, zone_index, made, attempts in game["own"].get("z", []):
                if pid == player_id:
                    for table in (zones, by_season.get(str(game.get("season")))):
                        if table is not None:
                            table[ZONES[zone_index]][0] += made
                            table[ZONES[zone_index]][1] += attempts

    # With / without each teammate, over this player's games for `team`
    # (both seasons the chart shows): with, the games the teammate played
    # too; without, the ones he didn't, from his first game listed with the
    # team (before he joined, the player wasn't playing "without" him).
    split_by_team = team_games(history) if history else by_team
    split_players = {**players, **((history or {}).get("players") or {}), **players}
    team_log = [game for game in split_by_team.get(team, [])
                if any(row[0] == player_id for row in game["own"]["p"])]
    mine = {game["id"]: stat_value(next(row for row in game["own"]["p"] if row[0] == player_id), stat)
            for game in team_log}
    first_seen, teammate_minutes, teammate_games = {}, defaultdict(float), defaultdict(int)
    for game in split_by_team.get(team, []):
        for row in game["own"]["p"]:
            first_seen.setdefault(row[0], game["date"])
            teammate_minutes[row[0]] += row[_I["min"]] or 0
            teammate_games[row[0]] += 1
        for pid in game["own"]["dnp"]:
            first_seen.setdefault(pid, game["date"])

    def split(values):
        decided = [value for value in values if value is not None]
        hits = sum(1 for value in decided if line is not None and value > line)
        misses = sum(1 for value in decided if line is not None and value < line)
        return {"games": len(decided), "avg": _round(sum(decided) / len(decided)) if decided else None,
                "hits": hits if line is not None else None, "misses": misses if line is not None else None}

    # His opportunity (opportunity.py): over his games, and in each split.
    his_games = opportunity.games_of(by_team, player_id)
    split_games = opportunity.games_of(split_by_team, player_id) if history else his_games
    impact = []
    for pid, since in first_seen.items():
        player = split_players.get(pid) or ["", "", None, None]
        if pid == player_id or (player[3] and player[3] != team):
            continue
        with_ids, without_ids = [], []
        for game in team_log:
            if game["date"] < since:
                continue
            played = any(row[0] == pid for row in game["own"]["p"])
            (with_ids if played else without_ids).append(game["id"])
        impact.append({"id": pid, "name": player[0], "pos": player[1], "headshot": headshot(pid, player, payload.get("league") or (history or {}).get("league") or "wnba"),
                       "min": _round(teammate_minutes[pid] / teammate_games[pid], 1) if teammate_games[pid] else 0,
                       "with": {**split([mine[g] for g in with_ids]), "gameIds": with_ids, "chances": opportunity.split(split_games, with_ids)},
                       "without": {**split([mine[g] for g in without_ids]), "gameIds": without_ids,
                                   "chances": opportunity.split(split_games, without_ids)}})
    impact.sort(key=lambda item: -(item["min"] or 0))

    # Players like this one against the opponent: every opposing player at a
    # position who played starter minutes against `opponent`, most recent
    # first, measured against their own average in their other games.
    history = _player_rows(by_team)
    similar = {}
    for position in POSITIONS:
        entries = []
        for game in reversed(by_team.get(opponent, [])):
            for row in game["opp"]["p"]:
                minutes = row[_I["min"]]
                if row[0] == player_id or minutes is None or minutes < SIMILAR_MIN_MINUTES:
                    continue
                if primary_position(players.get(row[0])) != position:
                    continue
                value = stat_value(row, stat)
                others = [stat_value(r, stat) for gid, r in history[row[0]] if gid != game["id"]]
                others = [v for v in others if v is not None]
                if value is None or not others:
                    continue
                baseline = sum(others) / len(others)
                player = players.get(row[0]) or ["", "", None, None]
                entries.append({"id": row[0], "name": player[0], "headshot": headshot(row[0], player, payload.get("league") or "wnba"), "team": game["opponent"],
                                "date": game["date"], "gameId": game["id"], "min": minutes,
                                "value": value, "avg": _round(baseline), "diff": _round(value - baseline)})
            if len(entries) >= 10:
                break
        similar[position] = entries[:10]

    player = players.get(player_id) or ["", "", None, None]
    return {"playerId": player_id, "team": team, "opponent": opponent, "market": market, "stat": stat,
            "position": primary_position(player), "line": line,
            "zones": zones, "zoneSeasons": by_season or None, "withWithout": impact, "similar": similar,
            "similarMinMinutes": SIMILAR_MIN_MINUTES, "teamGames": len(team_log),
            "opportunity": opportunity.player_opportunity(his_games),
            # Last season's games are in here too (opportunity.blend) at the start of a season.
            "seasons": payload.get("blended") or [payload.get("season")]}
