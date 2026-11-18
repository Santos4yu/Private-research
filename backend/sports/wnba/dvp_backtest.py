"""Do the depth-chart spots (PG / SG / SF / PF / C) read player props better
than the box score's G / F / C? (Nov 18; the owner: "measure whether the
more specific positions improve player-prop prediction accuracy".)

A walk forward through the stored season, one US game day at a time: before
a day, each defense's allowance at each position is only what it allowed in
the games before that day (the depth-chart spot of each opposing player from
the chart read before his game, depth.py); then that day's players are read
against it, and only then are that day's games added. Nothing from a later
game is ever used.

For a player-game: his average before the day x the matchup factor (what the
opponent allows a player at his position / what the league does), the factor
shrunk toward 1 by the defense's games (FACTOR_GAMES), as a reader would
weigh 5 games against 20. G / F / C uses his ESPN label (as the card does);
the spots use his own team's chart before the game. Both systems are scored
on the same player-games: those where each has a position, the player 5+
earlier games, and the defense 5+ games with someone at that position.

1. Box scores, every such player-game with 10+ minutes: mean absolute error
   of each system's prediction (and of his average alone).
2. Real lines -- the Props tab's record of what it showed before each game
   (props_record.py), standard lines only, pushes left out: how often each
   system's over / under call beats the line, the paired split (one right
   where the other was wrong), and the over rate against the 10 softest and
   the 10 toughest defenses at his position.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from . import context, depth, league

STATS = ("pts", "reb", "ast", "tpm", "pr", "pa", "ra", "pra")
MIN_PLAYER_GAMES = 5
MIN_DEFENSE_GAMES = 5
MIN_MINUTES = 10
FACTOR_GAMES = 10
TIERS = 10


def _day(start: float) -> str:
    import props_record
    return props_record.day_of(start)


def _start(game) -> float | None:
    minute = depth.minute_of(game.get("date"))
    return None if minute is None else minute * 60


class _Allowed:
    """What each defense allowed opposing players at each position, game by game."""

    def __init__(self):
        self.sums = defaultdict(lambda: defaultdict(float))   # (team, pos) -> stat -> total
        self.players = defaultdict(int)                        # (team, pos) -> player-games
        self.games = defaultdict(int)                          # (team, pos) -> games with someone there
        self.league = defaultdict(lambda: defaultdict(float))  # pos -> stat -> total
        self.league_players = defaultdict(int)

    def add(self, team, pos, rows):
        if not pos or not rows:
            return
        self.games[(team, pos)] += 1
        for row in rows:
            self.players[(team, pos)] += 1
            self.league_players[pos] += 1
            for stat in STATS:
                value = context.stat_value(row, stat) or 0
                self.sums[(team, pos)][stat] += value
                self.league[pos][stat] += value

    def per_player(self, team, pos, stat):
        count = self.players.get((team, pos))
        return self.sums[(team, pos)][stat] / count if count else None

    def factor(self, team, pos, stat):
        games = self.games.get((team, pos), 0)
        if not pos or games < MIN_DEFENSE_GAMES or not self.league_players.get(pos):
            return None
        mine, everyone = self.per_player(team, pos, stat), self.league[pos][stat] / self.league_players[pos]
        if mine is None or everyone <= 0:
            return None
        weight = games / (games + FACTOR_GAMES)
        return 1 + (mine / everyone - 1) * weight

    def rank(self, team, pos, stat, teams):
        """1 = allows the least (toughest) among teams with enough games."""
        values = {other: self.per_player(other, pos, stat) for other in teams if self.games.get((other, pos), 0) >= MIN_DEFENSE_GAMES}
        values = {other: value for other, value in values.items() if value is not None}
        if team not in values:
            return None, len(values)
        return 1 + sum(1 for value in values.values() if value < values[team]), len(values)


def walk(payload: dict, index) -> tuple[list, dict]:
    """The scored player-games [(day, pid, stat, actual, average, gfc factor,
    five factor, (gfc rank, teams ranked), (five rank, teams ranked))] and
    {(pid, day): row} for the line check."""
    players = payload.get("players") or {}
    gfc = {pid: context.primary_position(entry) for pid, entry in players.items()}
    placed = context.place_games(payload, index)
    minute = context._I["min"]
    by_day = defaultdict(list)
    for game in (payload.get("games") or {}).values():
        start = _start(game)
        if start and len(game.get("t") or {}) == 2:
            by_day[_day(start)].append(game)
    history = defaultdict(lambda: defaultdict(float))  # pid -> stat -> total, "_n"
    allowed = {"gfc": _Allowed(), "five": _Allowed()}
    teams = sorted({abbr for games in by_day.values() for game in games for abbr in game["t"]})
    scored, box = [], {}
    for day in sorted(by_day):
        games = by_day[day]
        for game in games:
            abbrs = list(game["t"])
            for team in abbrs:
                opponent = abbrs[1] if abbrs[0] == team else abbrs[0]
                spots = placed.get((str(game["id"]), team)) or {}
                for row in game["t"][team]["p"]:
                    if not (row[minute] or 0) >= MIN_MINUTES:
                        continue
                    pid = str(row[0])
                    box[(pid, day)] = row
                    past = history.get(pid)
                    if not past or past["_n"] < MIN_PLAYER_GAMES:
                        continue
                    pos_gfc, pos_five = gfc.get(pid), (spots.get(pid) or (None,))[0]
                    for stat in STATS:
                        f_gfc = allowed["gfc"].factor(opponent, pos_gfc, stat)
                        f_five = allowed["five"].factor(opponent, pos_five, stat)
                        if f_gfc is None or f_five is None:
                            continue
                        r_gfc, n_gfc = allowed["gfc"].rank(opponent, pos_gfc, stat, teams)
                        r_five, n_five = allowed["five"].rank(opponent, pos_five, stat, teams)
                        scored.append((day, pid, stat, context.stat_value(row, stat), past[stat] / past["_n"], f_gfc, f_five,
                                       (r_gfc, n_gfc), (r_five, n_five)))
        # Only now does the day count.
        for game in games:
            abbrs = list(game["t"])
            for team in abbrs:
                opponent = abbrs[1] if abbrs[0] == team else abbrs[0]
                rows = [row for row in game["t"][opponent]["p"] if row[minute]]
                spots = placed.get((str(game["id"]), opponent)) or {}
                for scheme, pos_of in (("gfc", lambda pid: gfc.get(pid)), ("five", lambda pid: (spots.get(pid) or (None,))[0])):
                    groups = defaultdict(list)
                    for row in rows:
                        groups[pos_of(str(row[0]))].append(row)
                    for pos, members in groups.items():
                        allowed[scheme].add(team, pos, members)
                for row in game["t"][team]["p"]:
                    if row[minute]:
                        past = history[str(row[0])]
                        past["_n"] += 1
                        for stat in STATS:
                            past[stat] += context.stat_value(row, stat) or 0
    return scored, box


def _rate(part, whole):
    return round(100 * part / whole, 2) if whole else None


def box_score_errors(scored: list) -> dict:
    out = {}
    for stat in (None,) + STATS:
        rows = [row for row in scored if stat is None or row[2] == stat]
        if not rows:
            continue
        base = sum(abs(actual - avg) for _, _, _, actual, avg, *_ in rows) / len(rows)
        e_gfc = [abs(actual - avg * f_gfc) for _, _, _, actual, avg, f_gfc, *_ in rows]
        e_five = [abs(actual - avg * f_five) for _, _, _, actual, avg, _, f_five, *_ in rows]
        out[stat or "all"] = {"playerGames": len(rows), "maeAverageOnly": round(base, 3),
                              "maeGFC": round(sum(e_gfc) / len(rows), 3), "maeFive": round(sum(e_five) / len(rows), 3),
                              "fiveCloser": _rate(sum(1 for a, b in zip(e_five, e_gfc) if a < b), len(rows)),
                              "gfcCloser": _rate(sum(1 for a, b in zip(e_five, e_gfc) if b < a), len(rows))}
    return out


def line_calls(scored: list, box: dict, reports: dict) -> dict:
    """Over / under calls against the Props tab's recorded lines."""
    import props_record
    signal = {(pid, day, stat): (avg, f_gfc, f_five, r_gfc, r_five) for day, pid, stat, _, avg, f_gfc, f_five, r_gfc, r_five in scored}
    calls = []
    for day, fields in reports.items():
        for field, kept in fields.items():
            try:
                pid, market, line = field.split("|")
                line = float(line)
            except ValueError:
                continue
            stat = props_record.MARKETS.get(market)
            modifier = kept[3] if isinstance(kept, list) and len(kept) > 3 else "standard"
            found = signal.get((pid, day, stat))
            row = box.get((pid, day))
            if stat not in STATS or modifier != "standard" or not found or row is None:
                continue
            actual = context.stat_value(row, stat)
            if actual is None or actual == line:
                continue
            avg, f_gfc, f_five, r_gfc, r_five = found
            calls.append((actual > line, avg > line, avg * f_gfc > line, avg * f_five > line, r_gfc, r_five, None, stat))
    if not calls:
        return {"lines": 0}
    total = len(calls)

    def right(i):
        return sum(1 for call in calls if call[i] == call[0])

    gfc_only = sum(1 for call in calls if call[2] == call[0] and call[3] != call[0])
    five_only = sum(1 for call in calls if call[3] == call[0] and call[2] != call[0])
    # McNemar's test on the paired calls (continuity-corrected chi-square, 1 df).
    split = gfc_only + five_only
    chi = (abs(gfc_only - five_only) - 1) ** 2 / split if split else 0.0
    p_value = math.erfc(math.sqrt(chi / 2)) if split else 1.0

    def tiers(i):
        # call[i] = (rank, teams ranked); 1 = allows the least.
        soft = [call for call in calls if call[i][0] and call[i][0] > call[i][1] - TIERS]
        tough = [call for call in calls if call[i][0] and call[i][0] <= TIERS]
        return {"softest10": {"lines": len(soft), "overRate": _rate(sum(c[0] for c in soft), len(soft))},
                "toughest10": {"lines": len(tough), "overRate": _rate(sum(c[0] for c in tough), len(tough))}}

    return {"lines": total, "overRate": _rate(sum(call[0] for call in calls), total),
            "callsRight": {"averageOnly": _rate(right(1), total), "gfc": _rate(right(2), total), "five": _rate(right(3), total)},
            "paired": {"gfcRightFiveWrong": gfc_only, "fiveRightGfcWrong": five_only, "pValue": round(p_value, 4)},
            "byTier": {"gfc": tiers(4), "five": tiers(5)},
            "byStat": {stat: {"lines": len(rows), "gfc": _rate(sum(1 for c in rows if c[2] == c[0]), len(rows)),
                              "five": _rate(sum(1 for c in rows if c[3] == c[0]), len(rows))}
                       for stat in STATS if (rows := [call for call in calls if call[7] == stat])}}


def run(season: int | None = None) -> dict:
    """Both tests on the stored season (the admin test, api/v2-admin.py)."""
    import props_record
    from v2.board import store
    season = season or league.current_season(league="nba")
    payload = league.stored(season, "nba") or {}
    index = depth.index_for(season)
    if not payload.get("games") or not index:
        return {"season": season, "error": "No stored season or no depth charts kept yet."}
    scored, box = walk(payload, index)
    days = sorted({day for day, *_ in scored})
    reports = {}
    if days:
        first = datetime.fromisoformat(days[0])
        wanted = [(first + timedelta(days=n)).date().isoformat() for n in range((datetime.fromisoformat(days[-1]) - first).days + 1)]
        pipeline = lambda commands: [entry["result"] for entry in store.pipeline(commands, timeout=8)]
        for chunk in range(0, len(wanted), 20):
            reports.update(props_record.reports(wanted[chunk:chunk + 20], pipeline))
    return {"season": season, "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "rules": {"minPlayerGames": MIN_PLAYER_GAMES, "minDefenseGames": MIN_DEFENSE_GAMES, "minMinutes": MIN_MINUTES,
                      "shrinkGames": FACTOR_GAMES, "tiers": TIERS},
            "days": [days[0], days[-1]] if days else None, "reportDays": len(reports),
            "boxScores": box_score_errors(scored), "lines": line_calls(scored, box, reports)}
