"""First quarter and first half, per player, from ESPN's play-by-play.

PrizePicks posts first-quarter and first-half lines (points, rebounds,
assists, threes and their combos); the box score only has whole games. The
play-by-play has every basket, free throw, assist and rebound with its
period, so each player's first quarter and first half are added up here.

A game's numbers are only kept when they agree with its box score: every
player's points over the whole game must match exactly, and his rebounds
and assists to within one (ESPN credits a few late). A stat that doesn't
agree is left out of that game rather than guessed.

Each team's record keeps `h`: [[player id, q_pts, q_reb, q_ast, q_tpm,
h_pts, h_reb, h_ast, h_tpm]], None where a stat didn't check out.
"""
from __future__ import annotations

from collections import defaultdict

STATS = ("pts", "reb", "ast", "tpm")
# The board's market keys for each period line, and the slots they add up
# (in a player's `h` row, after his id: quarter 1-4, half 5-8).
PERIOD_FIELDS = {}
for _suffix, _base in (("1q", 1), ("1h", 5)):
    for _key, _parts in (("points", ("pts",)), ("rebounds", ("reb",)), ("assists", ("ast",)), ("threes", ("tpm",)),
                         ("points_rebounds", ("pts", "reb")), ("points_assists", ("pts", "ast")),
                         ("rebounds_assists", ("reb", "ast")), ("points_rebounds_assists", ("pts", "reb", "ast"))):
        PERIOD_FIELDS[f"player_{_key}_{_suffix}"] = tuple(_base + STATS.index(part) for part in _parts)
LABELS = {}
for _key in PERIOD_FIELDS:
    _stat, _period = _key[len("player_"):].rsplit("_", 1)
    _names = {"points": "Points", "rebounds": "Rebounds", "assists": "Assists", "threes": "3-PT Made",
              "points_rebounds": "Pts+Rebs", "points_assists": "Pts+Asts", "rebounds_assists": "Rebs+Asts",
              "points_rebounds_assists": "Pts+Rebs+Asts"}
    LABELS[_key] = f"{_period.upper()} {_names[_stat]}"


def _period(play) -> int:
    value = (play.get("period") or {}).get("number")
    return value if isinstance(value, int) else 0


def _people(play) -> list:
    return [str((person.get("athlete") or {}).get("id") or "") for person in play.get("participants") or []]


def period_lines(summary: dict, record: dict, fields: tuple = ()) -> dict:
    """{team: [[pid, *quarter, *half]]} for the players in `record` (the
    game's stored box: record["t"][team]["p"] rows), checked against the
    box. `fields` names the box row's stat order (league.FIELDS)."""
    plays = summary.get("plays") or []
    if not plays:
        return {}
    index = {name: position + 2 for position, name in enumerate(fields)}
    split = defaultdict(lambda: [0] * 8)
    whole = defaultdict(lambda: [0, 0, 0])  # pts, reb, ast over the game

    def add(pid, slot, amount, period):
        if not pid:
            return
        if slot < 3:
            whole[pid][slot] += amount
        if period == 1:
            split[pid][slot] += amount
        if period in (1, 2):
            split[pid][4 + slot] += amount

    for play in plays:
        period, people = _period(play), _people(play)
        kind = str(((play.get("type") or {}).get("text")) or "").lower()
        if play.get("scoringPlay"):
            value = play.get("scoreValue")
            if value not in (1, 2, 3) or not people or not people[0]:
                continue
            add(people[0], 0, value, period)
            if value == 3:
                add(people[0], 3, 1, period)
            # An assisted basket names the passer second.
            if value in (2, 3) and len(people) > 1 and people[1]:
                add(people[1], 2, 1, period)
        elif "rebound" in kind and people and people[0]:
            add(people[0], 1, 1, period)

    out = {}
    for team, side in (record.get("t") or {}).items():
        rows = side.get("p") or []
        if not rows:
            continue
        # Points must match the box exactly; rebounds and assists within one.
        good = {"pts": True, "reb": True, "ast": True}
        for row in rows:
            pid = row[0]
            box = {stat: row[index[stat]] if stat in index else None for stat in ("pts", "reb", "ast")}
            for slot, stat, slack in ((0, "pts", 0), (1, "reb", 1), (2, "ast", 1)):
                if box[stat] is None or abs(whole[pid][slot] - box[stat]) > slack:
                    good[stat] = False
        if not good["pts"]:
            continue
        lines = []
        for row in rows:
            values = list(split[row[0]])
            for slot, stat in ((1, "reb"), (2, "ast")):
                if not good[stat]:
                    values[slot] = values[4 + slot] = None
            lines.append([row[0], *values])
        out[team] = lines
    return out


# Whole-game markets only the play-by-play counts: the box score's matchup
# tables (context.py) don't cover them, like the period lines above.
DUNKS = "player_dunks"
PLAY_MARKETS = (DUNKS,)


def dunk_counts(summary: dict, record: dict, fields: tuple = ()) -> dict:
    """{team: {player id: made dunks}} for the players in `record`'s box (a
    player who made none isn't listed), from the play-by-play's shot types
    ("Cutting Dunk Shot", "Alley Oop Dunk Shot"...): PrizePicks posts a Dunks
    line and the box score has no dunks. {} without a play-by-play; a team is
    left out when a player's dunks come to more than the twos he made (the
    plays and the box disagree)."""
    plays = summary.get("plays") or []
    if not plays:
        return {}
    made = defaultdict(int)
    for play in plays:
        kind = str(((play.get("type") or {}).get("text")) or "").lower()
        people = _people(play)
        if "dunk" in kind and play.get("scoringPlay") and people and people[0]:
            made[people[0]] += 1
    index = {name: position + 2 for position, name in enumerate(fields)}
    out = {}
    for team, side in (record.get("t") or {}).items():
        rows = side.get("p") or []
        if not rows:
            continue
        twos = {row[0]: (row[index["fgm"]] or 0) - (row[index["tpm"]] or 0) for row in rows} if "fgm" in index and "tpm" in index else None
        if twos is not None and any(made[pid] > made_twos for pid, made_twos in twos.items()):
            continue
        out[team] = {row[0]: made[row[0]] for row in rows if made[row[0]]}
    return out


def values_of(row: list) -> dict:
    """A player's `h` row as the board's period markets ({key: value}),
    leaving out any line whose parts didn't check out."""
    out = {}
    if not row:
        return out
    for key, slots in PERIOD_FIELDS.items():
        parts = [row[slot] for slot in slots]
        if all(isinstance(part, (int, float)) for part in parts):
            out[key] = sum(parts)
    return out
