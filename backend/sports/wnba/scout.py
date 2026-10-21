"""The NBA player page's scouting cards, from the stored season of box
scores (league.py), like context.py: arithmetic on finished games only.

- position_shooting: how well a position shoots against each defense (FG%,
  3P%, eFG%, free-throw rate, turnover rate), beyond the counting stats
  defense_vs_position already has.
- team_defense: assists and paint points each defense gives up, and the
  share of the other team's misses it rebounds.
- season_table: every player's averages over the stored games.
- faced: the players at a position in a defense's latest games, with what
  they put up and, where line_archive.py kept it, their own line that night.
- peer_ranks: where a player's averages rank among regulars at his position.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta

from .context import _I, POSITIONS, _rank, _round, headshot, primary_position, usage_rate

# A side's shooting, added up from its players' lines.
_SHOT_FIELDS = ("fgm", "fga", "tpm", "tpa", "fta", "to")


def _shooting(totals: dict) -> dict:
    fga, fgm, tpa, tpm, fta, to = (totals[key] for key in ("fga", "fgm", "tpa", "tpm", "fta", "to"))
    plays = fga + 0.44 * fta + to
    return {"fgPct": fgm / fga * 100 if fga else None, "tpPct": tpm / tpa * 100 if tpa else None,
            "efg": (fgm + 0.5 * tpm) / fga * 100 if fga else None,
            # Free throws a shot (0.282 is 28 trips' worth of free throws a 100 shots).
            "ftr": fta / fga if fga else None, "tov": to / plays * 100 if plays else None}


SHOOTING_KEYS = ("fgPct", "tpPct", "efg", "ftr", "tov")


def _table(values: dict, digits: int) -> tuple[dict, dict]:
    """team -> key -> [value, rank] (rank 1 the lowest) and the league's average per key."""
    table, league = defaultdict(dict), {}
    keys = {key for row in values.values() for key in row}
    for key in keys:
        column = {team: row.get(key) for team, row in values.items()}
        ranks = _rank(column, ascending=True)
        present = [value for value in column.values() if value is not None]
        league[key] = _round(sum(present) / len(present), digits) if present else None
        for team in values:
            table[team][key] = [_round(column[team], digits), ranks.get(team)]
    return dict(table), league


def position_shooting(by_team: dict, players: dict) -> dict:
    """What each position shoots against each defense over its games:
    {"teams": {team: {pos: {key: [value, rank]}}}, "league": {pos: {key: value}}}.
    Rank 1 is the lowest number (the toughest, except for turnovers)."""
    teams, league = {team: {} for team in by_team}, {}
    for position in POSITIONS:
        values = {}
        for team, games in by_team.items():
            totals = dict.fromkeys(_SHOT_FIELDS, 0)
            for game in games:
                for row in game["opp"]["p"]:
                    if row[_I["min"]] and primary_position(players.get(row[0])) == position:
                        for key in _SHOT_FIELDS:
                            totals[key] += row[_I[key]] or 0
            values[team] = _shooting(totals)
        table, averages = _table({team: {key: row[key] for key in SHOOTING_KEYS} for team, row in values.items()}, 3)
        for team in by_team:
            teams[team][position] = table.get(team, {})
        league[position] = averages
    return {"teams": teams, "league": league}


def team_defense(by_team: dict) -> dict:
    """Assists and paint points (made shots at the rim and in the paint)
    each defense gives up a game, and the share of the other team's misses
    it rebounds: {"teams": {team: {key: [value, rank]}}, "league": {key: value}}."""
    values = {}
    for team, games in by_team.items():
        ast = dreb = oreb = paint = 0
        paint_games = 0
        for game in games:
            ast += sum(row[_I["ast"]] or 0 for row in game["opp"]["p"])
            dreb += sum(row[_I["dreb"]] or 0 for row in game["own"]["p"])
            oreb += sum(row[_I["oreb"]] or 0 for row in game["opp"]["p"])
            zones = game["opp"].get("z") or []
            if zones:
                paint_games += 1
                # Zone 0 is the restricted area, 1 the rest of the paint (league.ZONES).
                paint += sum(2 * made for _pid, zone, made, _attempts in zones if zone in (0, 1))
        count = len(games)
        values[team] = {"astAllowed": ast / count if count else None,
                        "paintAllowed": paint / paint_games if paint_games else None,
                        "drebPct": dreb / (dreb + oreb) * 100 if dreb + oreb else None}
    teams, league = _table(values, 1)
    return {"teams": teams, "league": league}


# Averages kept for each player (per game), and the ones shown for a game.
_TOTALS = ("min", "pts", "reb", "ast", "tpm", "stl", "blk", "to", "pf", "oreb", "dreb", "fga", "fta")
GAME_STATS = ("pts", "reb", "ast", "tpm", "pra")


def _game_values(row) -> dict:
    value = lambda key: row[_I[key]]
    out = {key: value(key) for key in ("pts", "reb", "ast", "tpm")}
    out["pra"] = None if None in (out["pts"], out["reb"], out["ast"]) else out["pts"] + out["reb"] + out["ast"]
    return out


def season_table(by_team: dict, players: dict) -> dict:
    """player id -> per-game averages over his stored games (minutes played),
    with his usage rate, position, latest team and whether he leads that
    team in scoring or assists."""
    sums = defaultdict(lambda: defaultdict(float))
    seen = {}
    for team, games in by_team.items():
        for game in games:
            for row in game["own"]["p"]:
                if not row[_I["min"]]:
                    continue
                total = sums[row[0]]
                total["gp"] += 1
                for key in _TOTALS:
                    total[key] += row[_I[key]] or 0
                usage = usage_rate(row, game["own"]["p"])
                if usage is not None:
                    total["usage"] += usage
                    total["usageGames"] += 1
                if game["date"] and game["date"] >= seen.get(row[0], ("", ""))[0]:
                    seen[row[0]] = (game["date"], team)
    table = {}
    for pid, total in sums.items():
        games = total["gp"]
        row = {key: total[key] / games for key in _TOTALS}
        row.update(gp=int(games), team=seen.get(pid, ("", None))[1], pos=primary_position(players.get(pid)),
                   usage=total["usage"] / total["usageGames"] if total["usageGames"] else None,
                   pra=row["pts"] + row["reb"] + row["ast"], stlblk=row["stl"] + row["blk"],
                   ts=row["pts"] / (2 * (row["fga"] + 0.44 * row["fta"])) * 100 if row["fga"] + row["fta"] else None)
        table[pid] = row
    # A team's scorer and its playmaker: its most points and most assists a
    # game, over players who've played a fair share of its games.
    by_team_players = defaultdict(list)
    for pid, row in table.items():
        if row["team"] and row["gp"] >= 5:
            by_team_players[row["team"]].append(pid)
    for team, pids in by_team_players.items():
        top = max(pids, key=lambda pid: table[pid]["pts"])
        table[top]["topScorer"] = True
        handler = max(pids, key=lambda pid: table[pid]["ast"])
        if table[handler]["ast"] >= 4:
            table[handler]["handler"] = True
    return table


# Who counts: a game's line is shown only for real minutes.
FACED_MINUTES = 12
FACED_GAMES = 8
HIGH_USAGE = 28.0
# "Similar to him": within this much of his usage rate and scoring.
SIMILAR_USAGE, SIMILAR_POINTS = 4.0, 5.0


def game_day(date: str | None) -> str | None:
    """The US day a game is listed under (its UTC start less six hours), the
    day line_archive.py keeps its lines by."""
    try:
        start = datetime.fromisoformat(str(date).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    if start.tzinfo is None:
        return start.date().isoformat()
    return (start - timedelta(hours=6)).date().isoformat()


def faced(by_team: dict, players: dict, table: dict, opponent: str, me: str | None = None,
          lines=None, league: str = "nba", games: int = FACED_GAMES) -> dict:
    """The players who faced `opponent` in its latest `games` games, by
    position, newest game first: what each put up, his usual, his role
    tags and his own lines that night (lines(day, name) -> {stat: line})."""
    mine = table.get(me) if me else None
    out = {position: [] for position in POSITIONS}
    recent = (by_team.get(opponent) or [])[-games:]
    for game in reversed(recent):
        day = game_day(game["date"])
        for row in game["opp"]["p"]:
            pid = row[0]
            if pid == me or (row[_I["min"]] or 0) < FACED_MINUTES:
                continue
            player = players.get(pid) or ["", "", None, None]
            position = primary_position(player)
            if position not in out:
                continue
            usual = table.get(pid) or {}
            tags = []
            if mine and usual and usual.get("usage") is not None and mine.get("usage") is not None \
                    and abs(usual["usage"] - mine["usage"]) <= SIMILAR_USAGE and abs(usual["pts"] - mine["pts"]) <= SIMILAR_POINTS:
                tags.append("similar")
            if usual.get("handler"):
                tags.append("handler")
            if usual.get("topScorer"):
                tags.append("top")
            if (usual.get("usage") or 0) >= HIGH_USAGE:
                tags.append("usage")
            out[position].append({
                "id": pid, "name": player[0], "headshot": headshot(pid, player, league), "team": game["opponent"],
                "date": (game["date"] or "")[:10], "day": day, "home": not game["home"], "min": _round(row[_I["min"]], 1),
                "usage": usage_rate(row, game["opp"]["p"]), "seasonUsage": _round(usual.get("usage"), 1),
                "values": _game_values(row), "avg": {key: _round(usual.get(key), 1) for key in GAME_STATS},
                "lines": (lines(day, player[0]) if lines and day else None) or {}, "tags": tags})
    return {"games": len(recent), "positions": out}


# The numbers ranked among players at his position: (key, label, digits, more is ranked first).
OFFENSE = (("pts", "PTS", 1), ("ast", "AST", 1), ("reb", "REB", 1), ("tpm", "3PM", 1),
           ("ts", "TS%", 1), ("usage", "USG%", 1), ("min", "MIN", 1), ("to", "TOV", 1))
DEFENSE = (("stl", "STL", 1), ("blk", "BLK", 1), ("stlblk", "STL+BLK", 1),
           ("dreb", "DREB", 1), ("oreb", "OREB", 1), ("pf", "PF", 1))
# A regular: this many minutes a game over this share of the most games anyone played.
REGULAR_MINUTES, REGULAR_SHARE = 20.0, 0.4


def peer_ranks(table: dict, pid: str) -> dict | None:
    """Where his averages rank among the regulars at his position (rank 1
    the most): {"position", "count", "games", "offense": [...], "defense": [...]}.
    None when he has no games stored."""
    mine = table.get(pid)
    if not mine or mine.get("pos") not in POSITIONS:
        return None
    most = max((row["gp"] for row in table.values()), default=0)
    floor = max(5, REGULAR_SHARE * most)
    peers = {key: row for key, row in table.items()
             if row.get("pos") == mine["pos"] and row["gp"] >= floor and row["min"] >= REGULAR_MINUTES}
    peers[pid] = mine

    def tiles(spec):
        out = []
        for key, label, digits in spec:
            column = {key_: row.get(key) for key_, row in peers.items()}
            ranks = _rank(column, ascending=False)
            out.append({"key": key, "label": label, "value": _round(mine.get(key), digits), "rank": ranks.get(pid)})
        return out
    return {"position": mine["pos"], "count": len(peers), "games": mine["gp"], "offense": tiles(OFFENSE), "defense": tiles(DEFENSE)}


def by_name(table: dict, players: dict) -> dict:
    """name key -> the player's averages, for matching NBA.com's names to ESPN's."""
    from .tracking import name_key
    out = {}
    for pid, row in table.items():
        name = (players.get(pid) or [""])[0]
        if name:
            out[name_key(name)] = row
    return out
