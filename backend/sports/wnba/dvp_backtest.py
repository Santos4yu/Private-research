"""Do the depth-chart spots (PG / SG / SF / PF / C) read player props better
than the box score's G / F / C? (Nov 18; the owner: "Run a proper
chronological backtest against our recorded PrizePicks lines ... Do not
claim an edge from small samples.")

A walk forward through the stored season, one US game day at a time. Before
a day, each defense's allowance at each position is only what it allowed in
the games of earlier days (each opposing player's depth-chart spot from his
team's chart read before that game, depth.py); each player's average is
only his earlier games. Then that day's players are read, and only then is
the day added. `audit` counts any read that broke this (it must be 0).

Four predictions for a player-game, each "his average x a matchup factor":
- average: no factor (the baseline);
- gfc: what the opponent allows a player at his ESPN G / F / C, over what
  the league does (as the card counts it);
- five: the same at his depth-chart spot (his team's chart before the game);
- combined: the mean of the gfc and five factors.
Each factor is shrunk toward 1 by the defense's games (FACTOR_GAMES), as a
reader weighs 5 games against 20. All four are scored on the same
player-games: each needs his spot placed (a tie or no chart leaves him out --
`coverage` says how many), 5+ earlier games of his and 5+ of the defense's
at that position.

1. Box scores (10+ minutes): mean absolute error per market, and the five
   vs G / F / C difference with a 95% interval (paired).
2. The Props tab's recorded PrizePicks lines (props_record.py), standard
   lines, pushes left out: how often each model's over / under call was
   right per market with a 95% interval, and five vs G / F / C paired
   (McNemar). Calls on one player-night share him, so intervals are, if
   anything, narrow.
3. Consistency: the same comparisons on the first and second half of the
   days, separately.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from . import context, depth, league

STATS = ("pts", "reb", "ast", "tpm", "pra", "pr", "pa", "ra", "stl", "blk")
MODELS = ("average", "gfc", "five", "combined")
MIN_PLAYER_GAMES = 5
MIN_DEFENSE_GAMES = 5
MIN_MINUTES = 10
FACTOR_GAMES = 10


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

    def factor(self, team, pos, stat):
        games = self.games.get((team, pos), 0)
        if not pos or games < MIN_DEFENSE_GAMES or not self.league_players.get(pos):
            return None
        everyone = self.league[pos][stat] / self.league_players[pos]
        if everyone <= 0:
            return None
        mine = self.sums[(team, pos)][stat] / self.players[(team, pos)]
        weight = games / (games + FACTOR_GAMES)
        return 1 + (mine / everyone - 1) * weight


def walk(payload: dict, index) -> tuple[list, dict, dict]:
    """The scored player-games [{day, pid, stat, actual, average, gfc, five}],
    {(pid, day): row} for the line check, and the audit and coverage counts."""
    players = payload.get("players") or {}
    gfc = {pid: context.primary_position(entry) for pid, entry in players.items()}
    placed = context.place_games(payload, index)
    minute = context._I["min"]
    by_day = defaultdict(list)
    for game in (payload.get("games") or {}).values():
        start = _start(game)
        if start and len(game.get("t") or {}) == 2:
            by_day[_day(start)].append(game)
    history = defaultdict(lambda: defaultdict(float))  # pid -> stat -> total, "_n", "_last" (day)
    allowed = {"gfc": _Allowed(), "five": _Allowed()}
    audit = defaultdict(int)
    coverage = defaultdict(int)
    scored, box = [], {}
    last_added = ""
    for day in sorted(by_day):
        games = by_day[day]
        # Everything in the state so far is from an earlier day.
        audit["daysAfterData"] += 1
        audit["stateFromSameOrLaterDay"] += int(last_added >= day)
        for game in games:
            abbrs = list(game["t"])
            tip = depth.minute_of(game.get("date"))
            for team in abbrs:
                opponent = abbrs[1] if abbrs[0] == team else abbrs[0]
                spots = placed.get((str(game["id"]), team)) or {}
                # Every chart a placement used was read before this game's tip.
                _, read, status = index.chart_before(team, tip)
                if status == "ok":
                    audit["chartsChecked"] += 1
                    audit["chartReadAfterTip"] += int(read >= tip - depth.TIP_MARGIN_MINUTES)
                for row in game["t"][team]["p"]:
                    if not (row[minute] or 0) >= MIN_MINUTES:
                        continue
                    pid = str(row[0])
                    box[(pid, day)] = row
                    past = history.get(pid)
                    if not past or past["_n"] < MIN_PLAYER_GAMES:
                        coverage["playerGamesTooFewEarlierGames"] += 1
                        continue
                    audit["playerHistoryFromSameOrLaterDay"] += int(past["_last"] >= day) if "_last" in past else 0
                    coverage["playerGames"] += 1
                    pos_gfc, found = gfc.get(pid), spots.get(pid) or (None, "none", ())
                    pos_five = found[0]
                    coverage["placed" if pos_five else f"unplaced:{found[1]}"] += 1
                    coverage["withGFC" if pos_gfc else "noGFC"] += 1
                    for stat in STATS:
                        f_gfc = allowed["gfc"].factor(opponent, pos_gfc, stat)
                        f_five = allowed["five"].factor(opponent, pos_five, stat)
                        if f_gfc is None or f_five is None:
                            continue
                        scored.append({"day": day, "pid": pid, "stat": stat, "actual": context.stat_value(row, stat),
                                       "average": past[stat] / past["_n"], "gfc": f_gfc, "five": f_five})
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
                        past["_last"] = day
                        for stat in STATS:
                            past[stat] += context.stat_value(row, stat) or 0
        last_added = day
    return scored, box, {"audit": dict(audit), "coverage": dict(coverage)}


def _predict(entry: dict, model: str) -> float:
    factor = {"average": 1.0, "gfc": entry["gfc"], "five": entry["five"], "combined": (entry["gfc"] + entry["five"]) / 2}[model]
    return entry["average"] * factor


def _interval(values: list) -> list | None:
    """Mean and its 95% interval (normal approximation)."""
    n = len(values)
    if n < 2:
        return None
    mean = sum(values) / n
    sd = math.sqrt(sum((value - mean) ** 2 for value in values) / (n - 1))
    half = 1.96 * sd / math.sqrt(n)
    return [round(mean, 4), round(mean - half, 4), round(mean + half, 4)]


def _wilson(right: int, n: int) -> list | None:
    """A rate in % and its 95% Wilson interval."""
    if not n:
        return None
    p, z = right / n, 1.96
    middle = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return [round(100 * p, 2), round(100 * (middle - half), 2), round(100 * (middle + half), 2)]


def _mcnemar(first_only: int, second_only: int) -> float:
    split = first_only + second_only
    if not split:
        return 1.0
    chi = (abs(first_only - second_only) - 1) ** 2 / split
    return round(math.erfc(math.sqrt(chi / 2)), 4)


def box_score_errors(scored: list) -> dict:
    """Per market (and all): mean absolute error of each model, and five
    minus G / F / C (negative = five closer) with its 95% interval."""
    out = {}
    for stat in ("all",) + STATS:
        rows = [entry for entry in scored if stat == "all" or entry["stat"] == stat]
        if not rows:
            continue
        errors = {model: [abs(entry["actual"] - _predict(entry, model)) for entry in rows] for model in MODELS}
        out[stat] = {"playerGames": len(rows),
                     "mae": {model: round(sum(values) / len(values), 3) for model, values in errors.items()},
                     "fiveMinusGfc": _interval([a - b for a, b in zip(errors["five"], errors["gfc"])]),
                     "combinedMinusGfc": _interval([a - b for a, b in zip(errors["combined"], errors["gfc"])]),
                     "gfcMinusAverage": _interval([a - b for a, b in zip(errors["gfc"], errors["average"])])}
    return out


def line_calls(scored: list, box: dict, reports: dict) -> tuple[list, dict]:
    """The recorded standard lines with a result and all four predictions:
    ([{stat, day, over, calls: {model: over?}}], counts of what was left out)."""
    import props_record
    signal = {(entry["pid"], entry["day"], entry["stat"]): entry for entry in scored}
    calls, left = [], defaultdict(int)
    for day, fields in reports.items():
        for field, kept in fields.items():
            try:
                pid, market, line = field.split("|")
                line = float(line)
            except ValueError:
                left["unreadable"] += 1
                continue
            stat = props_record.MARKETS.get(market)
            modifier = kept[3] if isinstance(kept, list) and len(kept) > 3 else "standard"
            if modifier != "standard":
                left["goblinOrDemon"] += 1
                continue
            row = box.get((pid, day))
            if row is None:
                left["didNotPlay10Minutes"] += 1
                continue
            entry = signal.get((pid, day, stat))
            if entry is None:
                left["notScored"] += 1   # too few earlier games, unplaced, or too few defense games
                continue
            actual = context.stat_value(row, stat)
            if actual is None or actual == line:
                left["push"] += 1
                continue
            calls.append({"stat": stat, "day": day, "over": actual > line,
                          "calls": {model: _predict(entry, model) > line for model in MODELS}})
    return calls, dict(left)


def line_report(calls: list) -> dict:
    out = {}
    for stat in ("all",) + STATS:
        rows = [call for call in calls if stat == "all" or call["stat"] == stat]
        if not rows:
            continue
        right = {model: sum(1 for call in rows if call["calls"][model] == call["over"]) for model in MODELS}
        five_only = sum(1 for call in rows if call["calls"]["five"] == call["over"] and call["calls"]["gfc"] != call["over"])
        gfc_only = sum(1 for call in rows if call["calls"]["gfc"] == call["over"] and call["calls"]["five"] != call["over"])
        out[stat] = {"lines": len(rows), "overRate": _wilson(sum(call["over"] for call in rows), len(rows)),
                     "callsRight": {model: _wilson(count, len(rows)) for model, count in right.items()},
                     "fiveVsGfc": {"fiveRightGfcWrong": five_only, "gfcRightFiveWrong": gfc_only, "pValue": _mcnemar(five_only, gfc_only)}}
    return out


def halves(scored: list, calls: list) -> dict:
    """The same comparisons on the first and second half of the days."""
    days = sorted({entry["day"] for entry in scored})
    if len(days) < 4:
        return {}
    middle = days[len(days) // 2]
    out = {}
    for name, keep in (("first", lambda day: day < middle), ("second", lambda day: day >= middle)):
        part = [entry for entry in scored if keep(entry["day"])]
        lines = [call for call in calls if keep(call["day"])]
        errors = box_score_errors(part).get("all", {})
        out[name] = {"days": [min((e["day"] for e in part), default=None), max((e["day"] for e in part), default=None)],
                     "boxScores": {"playerGames": errors.get("playerGames"), "mae": errors.get("mae"), "fiveMinusGfc": errors.get("fiveMinusGfc")},
                     "lines": line_report(lines).get("all")}
    return out


def run(season: int | None = None) -> dict:
    """The whole backtest on the stored season (the admin test, api/v2-admin.py)."""
    import props_record
    from v2.board import store
    season = season or league.current_season(league="nba")
    payload = league.stored(season, "nba") or {}
    index = depth.index_for(season)
    if not payload.get("games") or not index:
        return {"season": season, "error": "No stored season or no depth charts kept yet."}
    scored, box, checks = walk(payload, index)
    days = sorted({entry["day"] for entry in scored})
    reports = {}
    if days:
        first = datetime.fromisoformat(days[0])
        wanted = [(first + timedelta(days=n)).date().isoformat() for n in range((datetime.fromisoformat(days[-1]) - first).days + 1)]
        pipeline = lambda commands: [entry["result"] for entry in store.pipeline(commands, timeout=8)]
        for chunk in range(0, len(wanted), 20):
            reports.update(props_record.reports(wanted[chunk:chunk + 20], pipeline))
    calls, left = line_calls(scored, box, reports)
    return {"season": season, "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "rules": {"minPlayerGames": MIN_PLAYER_GAMES, "minDefenseGames": MIN_DEFENSE_GAMES, "minMinutes": MIN_MINUTES,
                      "shrinkGames": FACTOR_GAMES, "models": list(MODELS)},
            "days": [days[0], days[-1]] if days else None, "reportDays": len(reports),
            "audit": checks["audit"], "coverage": checks["coverage"],
            "boxScores": box_score_errors(scored),
            "lines": {"used": len(calls), "leftOut": left, "byMarket": line_report(calls)},
            "halves": halves(scored, calls)}
