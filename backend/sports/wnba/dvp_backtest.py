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
2. The Props tab's recorded PrizePicks lines (props_record.py; see
   line_calls for what counts): how often each model's over / under call
   was right per market with a 95% interval, the pairs (McNemar), each
   model by how far its projection sat from the line (bands fixed in
   advance), and whether a matchup factor adds anything beyond the
   player's average and the line (value_beyond: a logistic fit, and one
   fitted on the first half of the days and scored on the second). Props
   on one player-night share him, so intervals are, if anything, narrow.
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
                    if not row[minute]:
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
                                       "average": past[stat] / past["_n"], "gfc": f_gfc, "five": f_five, "minutes": row[minute]})
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
    scored = [entry for entry in scored if (entry.get("minutes") or 0) >= MIN_MINUTES]
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


# The line test (Nov 18, the owner's ten points). Fixed before looking at any
# result, never tuned on these games: the markets reported, the gap bands.
LINE_MARKETS = ("pts", "reb", "ast", "tpm", "pra", "pr", "pa", "ra", "stl", "blk")
GAP_BANDS = ((0.0, 0.05, "<5%"), (0.05, 0.10, "5-10%"), (0.10, 0.20, "10-20%"), (0.20, float("inf"), "20%+"))


def line_calls(scored: list, box: dict, reports: dict) -> tuple[list, dict]:
    """One bet per prop: the Props tab's recorded standard lines (recorded
    only before each game started, props_record.remember), a player's
    market on one night counted once -- when it was recorded at more than
    one line (the line moved), the middle one. A player who didn't play is
    void (left out); a result on the line is a push (left out); a projection
    exactly on the line is no call for that model, so the prop is left out
    for all four. Every prop kept has all four projections, so the models
    are compared on exactly the same props. Returns ([{stat, day, pid, line,
    over, average, projection: {model: value}}], counts left out)."""
    import props_record
    signal = {(entry["pid"], entry["day"], entry["stat"]): entry for entry in scored}
    left = defaultdict(int)
    props = defaultdict(list)   # (pid, day, stat) -> standard lines recorded
    for day, fields in reports.items():
        for field, kept in fields.items():
            try:
                pid, market, line = field.split("|")
                line = float(line)
            except ValueError:
                left["unreadable"] += 1
                continue
            stat = props_record.MARKETS.get(market)
            if stat is None:
                left["otherMarket"] += 1
                continue
            modifier = kept[3] if isinstance(kept, list) and len(kept) > 3 else "standard"
            if modifier != "standard":
                left["goblinOrDemon"] += 1
                continue
            props[(pid, day, stat)].append(line)
    calls = []
    for (pid, day, stat), lines in props.items():
        lines.sort()
        left["snapshotsCollapsed"] += len(lines) - 1
        line = lines[(len(lines) - 1) // 2]
        row = box.get((pid, day))
        if row is None:
            left["voidDidNotPlay"] += 1
            continue
        actual = context.stat_value(row, stat)
        if actual is None:
            left["noResult"] += 1
            continue
        if actual == line:
            left["push"] += 1
            continue
        entry = signal.get((pid, day, stat))
        if entry is None:
            left["notScored"] += 1   # under 5 earlier games, no depth-chart spot, or the defense under 5 games there
            continue
        projection = {model: _predict(entry, model) for model in MODELS}
        if any(value == line for value in projection.values()):
            left["projectionOnLine"] += 1
            continue
        calls.append({"stat": stat, "day": day, "pid": pid, "line": line, "over": actual > line,
                      "average": entry["average"], "projection": projection})
    return calls, dict(left)


def _right(call, model) -> bool:
    return (call["projection"][model] > call["line"]) == call["over"]


def _paired(rows, first, second) -> dict:
    first_only = sum(1 for call in rows if _right(call, first) and not _right(call, second))
    second_only = sum(1 for call in rows if _right(call, second) and not _right(call, first))
    return {f"{first}Only": first_only, f"{second}Only": second_only, "pValue": _mcnemar(first_only, second_only)}


def _bands(rows, model) -> dict:
    out = {}
    for low, high, name in GAP_BANDS:
        band = [call for call in rows if low <= abs(call["projection"][model] - call["line"]) / call["line"] < high]
        out[name] = {"props": len(band), "right": _wilson(sum(_right(call, model) for call in band), len(band))}
    return out


def line_report(calls: list) -> dict:
    """Per market (and all): over rate, each model's calls right with a 95%
    interval, the pairs (McNemar), and each model by how far its projection
    sat from the line."""
    out = {}
    for stat in ("all",) + LINE_MARKETS:
        rows = [call for call in calls if stat == "all" or call["stat"] == stat]
        if not rows:
            out[stat] = {"props": 0}
            continue
        nights = len({(call["pid"], call["day"]) for call in rows})
        out[stat] = {"props": len(rows), "playerNights": nights,
                     "overRate": _wilson(sum(call["over"] for call in rows), len(rows)),
                     "callsRight": {model: _wilson(sum(_right(call, model) for call in rows), len(rows)) for model in MODELS},
                     "paired": {"fiveVsGfc": _paired(rows, "five", "gfc"), "gfcVsAverage": _paired(rows, "gfc", "average"),
                                "fiveVsAverage": _paired(rows, "five", "average"), "combinedVsAverage": _paired(rows, "combined", "average")},
                     "byGap": {model: _bands(rows, model) for model in MODELS}}
    return out


def _solve(matrix, vector):
    """Gaussian elimination for the small systems below."""
    size = len(vector)
    grid = [row[:] + [vector[i]] for i, row in enumerate(matrix)]
    for col in range(size):
        pivot = max(range(col, size), key=lambda r: abs(grid[r][col]))
        if abs(grid[pivot][col]) < 1e-12:
            raise ValueError("singular")
        grid[col], grid[pivot] = grid[pivot], grid[col]
        for r in range(size):
            if r != col:
                factor = grid[r][col] / grid[col][col]
                grid[r] = [a - factor * b for a, b in zip(grid[r], grid[col])]
    return [grid[i][size] / grid[i][i] for i in range(size)]


def _logistic(rows, features):
    """Logistic regression (Newton's method): coefficients, their standard
    errors, and a predict function. `features(call)` -> list (with 1 first)."""
    xs, ys = [features(call) for call in rows], [1.0 if call["over"] else 0.0 for call in rows]
    size = len(xs[0])
    beta = [0.0] * size
    for _ in range(25):
        grad, hess = [0.0] * size, [[0.0] * size for _ in range(size)]
        for x, y in zip(xs, ys):
            p = 1 / (1 + math.exp(-max(-30, min(30, sum(b * v for b, v in zip(beta, x))))))
            for i in range(size):
                grad[i] += (y - p) * x[i]
                for j in range(size):
                    hess[i][j] += p * (1 - p) * x[i] * x[j]
        for i in range(size):
            hess[i][i] += 1e-6   # keeps a constant column from stopping the fit; changes nothing else
        step = _solve(hess, grad)
        beta = [b + d for b, d in zip(beta, step)]
        if max(abs(d) for d in step) < 1e-8:
            break
    errors = []
    for i in range(size):
        unit = [1.0 if j == i else 0.0 for j in range(size)]
        errors.append(math.sqrt(max(_solve(hess, unit)[i], 0.0)))
    predict = lambda call: 1 / (1 + math.exp(-max(-30, min(30, sum(b * v for b, v in zip(beta, features(call)))))))
    return beta, errors, predict


def value_beyond(calls: list) -> dict:
    """Does a matchup factor add anything beyond the player's average and
    the line itself? The outcome (over) on: the average's gap to the line
    ((average - line) / line) and the matchup's own push ((projection -
    average) / line). (1) On all props: the matchup term's coefficient,
    its standard error and p. (2) Out of sample: fitted on the first half
    of the days, scored on the second half (log loss), against the same fit
    without the matchup term."""
    if len(calls) < 60:
        return {"props": len(calls), "note": "too few props to fit"}
    base = lambda call: [1.0, (call["average"] - call["line"]) / call["line"]]
    days = sorted({call["day"] for call in calls})
    middle = days[len(days) // 2]
    train = [call for call in calls if call["day"] < middle]
    test = [call for call in calls if call["day"] >= middle]

    def log_loss(predict, rows):
        return sum(-math.log(max(1e-9, predict(call) if call["over"] else 1 - predict(call))) for call in rows) / len(rows)

    out = {"props": len(calls), "trainProps": len(train), "testProps": len(test), "split": middle}
    try:
        _, _, base_all = _logistic(calls, base)
        _, _, base_train = _logistic(train, base) if len(train) >= 30 else (None, None, None)
    except ValueError:
        return {**out, "note": "the fit did not converge"}
    for model in ("gfc", "five", "combined"):
        with_model = lambda call, m=model: base(call) + [(call["projection"][m] - call["average"]) / call["line"]]
        try:
            beta, errors, _ = _logistic(calls, with_model)
            z = beta[2] / errors[2] if errors[2] else 0.0
            entry = {"coefficient": round(beta[2], 3), "standardError": round(errors[2], 3), "pValue": round(math.erfc(abs(z) / math.sqrt(2)), 4)}
            if base_train and len(train) >= 30 and test:
                _, _, fitted = _logistic(train, with_model)
                entry["outOfSample"] = {"logLossAverageAndLine": round(log_loss(base_train, test), 4),
                                        "logLossWithMatchup": round(log_loss(fitted, test), 4)}
        except ValueError:
            entry = {"note": "the fit did not converge"}
        out[model] = entry
    out["baselineLogLossAllProps"] = round(log_loss(base_all, calls), 4)
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
        report = line_report(lines).get("all", {})
        out[name] = {"days": [min((e["day"] for e in part), default=None), max((e["day"] for e in part), default=None)],
                     "boxScores": {"playerGames": errors.get("playerGames"), "mae": errors.get("mae"), "fiveMinusGfc": errors.get("fiveMinusGfc")},
                     "lines": {"props": report.get("props"), "callsRight": report.get("callsRight")}}
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
            "lines": {"props": len(calls), "leftOut": left, "gapBands": [name for _, _, name in GAP_BANDS],
                      "byMarket": line_report(calls), "valueBeyondAverageAndLine": value_beyond(calls),
                      "recordedBeforeGames": "props_record keeps a line only while its game hasn't started"},
            "halves": halves(scored, calls)}
