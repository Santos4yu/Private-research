"""Opportunity: the chances a basketball stat comes from, from the stored
season of box scores (league.py) -- arithmetic like context.py, nothing
modelled.

A hit rate says how often a line cleared; these say whether the chances
behind it are there. Points come from shots and free throws, and from how
much of the team's offense runs through him while he plays (usage).
Rebounds come from missed shots: how many get missed while he's on the
floor, and what share of the rebounds he takes. Assists come from his
teammates' baskets: what share of them he sets up while he plays, and how
well they shoot. Threes come from three-point tries. And every one of
them from minutes and the game's pace (possessions).

The shares are the usual box-score estimates (Basketball-Reference's
usage, rebound and assist percentages): a team's minutes over five stand
for the game's length, and his minutes over that for the part of it he was
on the floor. NBA tracking (potential assists, rebound chances) is a
separate source (tracking.py); these work for both leagues.
"""
from __future__ import annotations

from collections import defaultdict

from .league import FIELDS

# A player's row is [id, starter, *FIELDS].
_I = {name: index + 2 for index, name in enumerate(FIELDS)}
_BOX = ("min", "pts", "reb", "ast", "fgm", "fga", "tpm", "tpa", "ftm", "fta", "to", "oreb", "dreb")
# Free throws per possession used up (the usual 0.44).
FT_TRIP = 0.44
# Fewer of a player's games than this this season and last season's join
# them (the start of a season), so the shares aren't a game or two.
BLEND_GAMES = 15
RECENT = 10


def _num(value):
    return value if isinstance(value, (int, float)) else 0


def side_totals(side) -> dict:
    """A team's box in one game, added up from its players' lines."""
    totals = dict.fromkeys(_BOX, 0)
    for row in side.get("p") or []:
        for key in _BOX:
            totals[key] += _num(row[_I[key]])
    return totals


def possessions(own: dict, opp: dict) -> float:
    """The game's possessions: each team's shots, less the offensive
    rebounds that kept a trip going, plus turnovers and free-throw trips,
    averaged over the two teams."""
    trips = lambda box: box["fga"] - box["oreb"] + box["to"] + FT_TRIP * box["fta"]
    return (trips(own) + trips(opp)) / 2


def _round(value, digits=1):
    return None if value is None else round(value, digits)


def _ranks(values: dict) -> dict:
    """team -> rank, 1 the most. Ties share a rank."""
    ordered = sorted((value for value in values.values() if value is not None), reverse=True)
    return {team: ordered.index(value) + 1 for team, value in values.items() if value is not None}


# What each team's games give, a game. `Allowed` is what its opponents did.
TEAM_KEYS = ("poss", "ortg", "drtg", "miss", "missAllowed", "gameMiss", "tpa", "tpaAllowed", "tpPctAllowed",
             "fga", "fgaAllowed", "fta", "ftaAllowed", "fgPctAllowed", "astAllowed", "rebAllowed")


def team_table(by_team: dict) -> dict:
    """Every team's pace, ratings and the chances its games give, with the
    league's average. Rank 1 is always the most (the fastest pace, the most
    points allowed per 100 possessions, the most misses)."""
    values = {}
    for team, games in by_team.items():
        sums, count = defaultdict(float), 0
        for game in games:
            own, opp = side_totals(game["own"]), side_totals(game["opp"])
            if not own["min"] or not opp["min"]:
                continue
            count += 1
            poss = possessions(own, opp)
            sums["poss"] += poss
            sums["pts"] += own["pts"]
            sums["ptsAllowed"] += opp["pts"]
            sums["miss"] += own["fga"] - own["fgm"]
            sums["missAllowed"] += opp["fga"] - opp["fgm"]
            for key, box in (("tpa", own), ("fga", own), ("fta", own)):
                sums[key] += box[key]
            for key, field in (("tpaAllowed", "tpa"), ("fgaAllowed", "fga"), ("ftaAllowed", "fta"), ("astAllowed", "ast"),
                               ("rebAllowed", "reb"), ("tpmAllowed", "tpm"), ("fgmAllowed", "fgm")):
                sums[key] += opp[field]
        if not count:
            continue
        row = {key: sums[key] / count for key in ("poss", "miss", "missAllowed", "tpa", "tpaAllowed", "fga", "fgaAllowed",
                                                   "fta", "ftaAllowed", "astAllowed", "rebAllowed")}
        row["gameMiss"] = row["miss"] + row["missAllowed"]
        row["ortg"] = 100 * sums["pts"] / sums["poss"] if sums["poss"] else None
        row["drtg"] = 100 * sums["ptsAllowed"] / sums["poss"] if sums["poss"] else None
        row["tpPctAllowed"] = 100 * sums["tpmAllowed"] / sums["tpaAllowed"] if sums["tpaAllowed"] else None
        row["fgPctAllowed"] = 100 * sums["fgmAllowed"] / sums["fgaAllowed"] if sums["fgaAllowed"] else None
        row["games"] = count
        values[team] = row
    table = {team: {"games": row["games"]} for team, row in values.items()}
    league = {}
    for key in TEAM_KEYS:
        column = {team: row.get(key) for team, row in values.items()}
        ranks = _ranks(column)
        present = [value for value in column.values() if value is not None]
        league[key] = _round(sum(present) / len(present)) if present else None
        for team in values:
            table[team][key] = [_round(column[team]), ranks.get(team)]
    return {"teams": table, "league": league, "count": len(values)}


def games_of(by_team: dict, player_id: str) -> list:
    """His games (any team), oldest first, each with his line and both boxes."""
    out = []
    for team, games in by_team.items():
        for game in games:
            row = next((row for row in game["own"]["p"] if row[0] == player_id), None)
            if row is not None and _num(row[_I["min"]]) > 0:
                out.append({"game": game, "team": team, "row": row})
    out.sort(key=lambda entry: entry["game"]["date"] or "")
    return out


def _part(entry) -> dict:
    """One game's numbers: his line, and the shares' tops and bottoms."""
    row, game = entry["row"], entry["game"]
    me = {key: _num(row[_I[key]]) for key in _BOX}
    own, opp = side_totals(game["own"]), side_totals(game["opp"])
    length = own["min"] / 5 if own["min"] else 0
    on = me["min"] / length if length else 0
    plays = own["fga"] + FT_TRIP * own["fta"] + own["to"]
    return {**me,
            "usageTop": (me["fga"] + FT_TRIP * me["fta"] + me["to"]) * length, "usageBottom": me["min"] * plays,
            "rebTop": me["reb"] * length, "rebBottom": me["min"] * (own["reb"] + opp["reb"]),
            "orebTop": me["oreb"] * length, "orebBottom": me["min"] * (own["oreb"] + opp["dreb"]),
            "drebTop": me["dreb"] * length, "drebBottom": me["min"] * (own["dreb"] + opp["oreb"]),
            "astTop": me["ast"], "astBottom": max(0.0, on * own["fgm"] - me["fgm"]),
            # Missed shots (both teams) in the part of the game he played.
            "missesOn": on * ((own["fga"] - own["fgm"]) + (opp["fga"] - opp["fgm"])),
            "possOn": on * possessions(own, opp),
            "mateFgm": own["fgm"] - me["fgm"], "mateFga": own["fga"] - me["fga"]}


def summarize(entries: list) -> dict | None:
    """Per-game averages and the shares over a set of his games."""
    if not entries:
        return None
    parts = [_part(entry) for entry in entries]
    total = lambda key: sum(part[key] for part in parts)
    n = len(parts)
    share = lambda top, bottom: _round(100 * total(top) / total(bottom)) if total(bottom) else None
    per_game = {key: _round(total(key) / n) for key in ("min", "pts", "reb", "ast", "fga", "tpa", "tpm", "fta", "to", "oreb", "dreb")}
    return {"games": n, **per_game,
            "usage": share("usageTop", "usageBottom"), "rebShare": share("rebTop", "rebBottom"),
            "orebShare": share("orebTop", "orebBottom"), "drebShare": share("drebTop", "drebBottom"),
            "astShare": share("astTop", "astBottom"),
            "missesOn": _round(total("missesOn") / n), "possOn": _round(total("possOn") / n),
            "mateFg": _round(100 * total("mateFgm") / total("mateFga")) if total("mateFga") else None,
            "tpPct": _round(100 * total("tpm") / total("tpa")) if total("tpa") else None,
            # Per 36 minutes: the rate his minutes multiply.
            "per36": {key: _round(36 * total(key) / total("min")) if total("min") else None for key in ("pts", "reb", "ast", "fga", "tpa", "fta")}}


def player_opportunity(entries: list) -> dict:
    """His opportunity over his games on hand (games_of: the season, or the
    end of last season too when this one is young) and his last ten."""
    seasons = sorted({entry["game"].get("season") for entry in entries if entry["game"].get("season")})
    return {"games": len(entries), "seasons": seasons,
            "szn": summarize(entries), "l10": summarize(entries[-RECENT:]),
            "team": entries[-1]["team"] if entries else None}


def split(entries: list, game_ids) -> dict | None:
    """His opportunity in just these of his games (a with/without split)."""
    wanted = set(game_ids)
    return summarize([entry for entry in entries if entry["game"]["id"] in wanted])


def blend(previous: dict | None, current: dict) -> dict:
    """Last season's games under this season's, for the start of a season.
    Each game keeps its season; this season's player directory wins (where
    each player plays now)."""
    if not previous or not previous.get("games"):
        return current
    games = {}
    for payload in (previous, current):
        for game_id, game in (payload.get("games") or {}).items():
            games[game_id] = {**game, "season": payload.get("season")}
    return {**current, "games": games, "players": {**(previous.get("players") or {}), **(current.get("players") or {})},
            "blended": [previous.get("season"), current.get("season")]}
