"""The NFL side of the Game Predictor (game_predictor.py): nflverse's
schedule and play-by-play (nfl_team_epa.py) turned into opponent-adjusted
ratings, quarterback values and each side's best player matchup.

The backtested model (tools/game-predictor-backtest); its settings and
weights live in game_predictor.MODELS["nfl"].

* Ratings, each opponent-adjusted (predictor_ratings.py), this season with
  last season's as the prior: EPA per play, success rate, points and plays
  a game (offense and defense).
* Quarterbacks: a quarterback's value is his EPA per dropback over this
  season and the two before, pulled toward a backup's level
  (`qb_replacement`) by `qb_prior` dropbacks. The team's ratings already
  hold the quarterbacks who played for it this season (weighted by their
  dropbacks), so only the difference between tonight's starter and them
  counts, and a starter new to the team (under a fifth of its dropbacks)
  counts a little more. A backup who has started for weeks is in the
  ratings already; one just inserted is not.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

import predictor_ratings as ratings

KEYS = ("epa", "succ", "pts", "plays")
BASE = {"epa": (0.0, 0.02), "succ": (0.44, 0.005), "pts": (22.0, 1.0), "plays": (62.0, 0.0)}


def _day(epoch):
    return (datetime.fromtimestamp(epoch, timezone.utc) - timedelta(hours=5)).date() if epoch else None


def team_rows(table, games, before=None):
    """Each finished team-game of a season's table, as (date, team, opponent, H, {epa, succ, pts, plays}).
    A game not final in the schedule, or with no plays, is left out."""
    rows = []
    for cell in (table or {}).get("teams") or []:
        if cell.get("side") != "o" or not cell.get("plays"):
            continue
        game = games.get(cell.get("game"))
        if not game or not game.get("final"):
            continue
        date = _day(game.get("kickoff"))
        if date is None or (before is not None and date >= before):
            continue
        team = cell["team"]
        home = game["home"] == team
        opponent = game["away"] if home else game["home"]
        if team not in (game["home"], game["away"]):
            continue
        h = 0 if str(game.get("location") or "").lower() == "neutral" else (1 if home else -1)
        try:
            points = float(game["home_score"] if home else game["away_score"])
        except (TypeError, ValueError):
            continue
        rows.append((date, team, opponent, h, {"epa": cell["epa"] / cell["plays"], "succ": cell["succ"] / cell["plays"],
                                               "pts": points, "plays": cell["plays"]}))
    return rows


def rate(rows, today, params, prior=None):
    """{key: ratings} for EPA, success, points and plays as of `today`."""
    teams = sorted({r[1] for r in rows} | {r[2] for r in rows} | set(((prior or {}).get("epa") or {}).get("off") or {}))
    w = ratings.recency([(today - r[0]).days for r in rows], params["half_life"])
    out = {}
    for key in KEYS:
        p = (prior or {}).get(key) or {}
        mu, hfa = p.get("mu", BASE[key][0]), p.get("hfa", BASE[key][1])
        out[key] = ratings.solve([(r[1], r[2], r[3], r[4][key]) for r in rows], w, teams, p, params["lam"], mu, hfa, home=key != "plays")
    out["games"] = defaultdict(int)
    for r in rows:
        out["games"][r[1]] += 1
    return out


def season_prior(last_rows, params):
    if not last_rows:
        return None
    end = max(r[0] for r in last_rows) + timedelta(days=1)
    final = rate(last_rows, end, params)
    return {key: ratings.shrink(final[key], params["keep"]) for key in KEYS}


def qb_values(tables, games, before, params):
    """qb id -> (value, dropbacks, name): EPA a dropback pulled toward a backup's level."""
    tot = defaultdict(lambda: [0.0, 0.0, ""])
    for table in tables:
        for cell in (table or {}).get("qbs") or []:
            game = games.get(cell.get("game"))
            if not game or not game.get("final") or (_day(game.get("kickoff")) or before) >= before:
                continue
            entry = tot[cell["qb"]]
            entry[0] += cell.get("db") or 0
            entry[1] += cell.get("epa") or 0
            entry[2] = cell.get("name") or entry[2]
    k, repl = params["qb_prior"], params["qb_replacement"]
    return {qb: ((epa + repl * k) / (db + k), db, name) for qb, (db, epa, name) in tot.items()}


def team_quarterbacks(table, games, team, before, half_life):
    """This season's quarterbacks for a team, before the date: {qb: {weight, dropbacks, last3, name}} (5+ dropbacks a game)."""
    out = defaultdict(lambda: {"weight": 0.0, "dropbacks": 0.0, "recent": 0.0, "name": "", "last": None})
    played = []
    for cell in (table or {}).get("qbs") or []:
        game = games.get(cell.get("game"))
        if cell.get("team") != team or not game or not game.get("final"):
            continue
        date = _day(game.get("kickoff"))
        if date is None or date >= before or (cell.get("db") or 0) < 5:
            continue
        played.append((date, cell))
    dates = sorted({d for d, _ in played})[-3:]
    for date, cell in played:
        entry = out[cell["qb"]]
        entry["weight"] += 0.5 ** ((before - date).days / half_life) * cell["db"]
        entry["dropbacks"] += cell["db"]
        entry["name"] = cell.get("name") or entry["name"]
        entry["last"] = max(entry["last"] or date, date)
        if date in dates:
            entry["recent"] += cell["db"]
    return dict(out)


def pick_starter(quarterbacks, last_season, out_names, key):
    """Tonight's quarterback: the one with the most dropbacks in the team's
    last three games who isn't listed out; else this season's most; else
    last season's (with this team). (id, name, how) or (None, None, reason)."""
    usable = lambda qb, info: key(info["name"]) not in out_names
    for label, pool, field in (("recent starter", quarterbacks, "recent"), ("season starter", quarterbacks, "dropbacks"),
                               ("last season", last_season, "dropbacks")):
        ranked = sorted(((qb, info) for qb, info in (pool or {}).items() if info.get(field)), key=lambda item: -item[1][field])
        for qb, info in ranked:
            if usable(qb, info):
                return qb, info["name"], label
    return None, None, "unknown"


def features(game, rt, values, quarterbacks, starters, rest, weather, params):
    """The model's inputs for one game (home first), as in the backtest."""
    h, a = game["home"], game["away"]
    f = {"home1": 0 if game.get("neutral") else 1, "rest": rest}
    for key in KEYS:
        r = rt[key]
        f[f"{key}_h"] = r["off"].get(h, 0.0) + r["def"].get(a, 0.0)
        f[f"{key}_a"] = r["off"].get(a, 0.0) + r["def"].get(h, 0.0)
    repl = params["qb_replacement"]
    for side, team in (("h", h), ("a", a)):
        seen = quarterbacks.get(team) or {}
        total = sum(info["weight"] for info in seen.values())
        window = sum((values.get(qb, (repl,))[0]) * info["weight"] for qb, info in seen.items()) / total if total else None
        qb = starters[team][0]
        tonight = values.get(qb, (repl,))[0] if qb else None
        f[f"qb_{side}"] = (tonight - window) if tonight is not None and window is not None else 0.0
        f[f"qbnew_{side}"] = int(bool(qb) and total > 0 and (seen.get(qb, {}).get("weight", 0.0) / total) < 0.2)
        f[f"qbval_{side}"] = tonight if tonight is not None else repl
    f["windy"] = 0.0 if weather.get("dome") else max(0.0, (weather.get("wind") or 0) - 10)
    f["cold"] = 0.0 if weather.get("dome") else max(0.0, 40 - weather.get("temp", 60))
    f["dome"] = int(bool(weather.get("dome")))
    return f


def predict(f, params):
    """(margin, total, parts). The total is None without the fitted total
    weights (params["total"]): the backtest's weren't kept, and the line's
    total was closer anyway (game_predictor falls back to the points ratings)."""
    m, t = params["margin"], params.get("total")
    margin = (m["epa"] * (f["epa_h"] - f["epa_a"]) + m["succ"] * (f["succ_h"] - f["succ_a"]) + m["pts"] * (f["pts_h"] - f["pts_a"])
              + m["home"] * f["home1"] + m["rest"] * f["rest"] + m["qb"] * (f["qb_h"] - f["qb_a"]) + m["qbnew"] * (f["qbnew_h"] - f["qbnew_a"])
              + m["const"])
    total = (t["pts"] * (f["pts_h"] + f["pts_a"]) + t["epa"] * (f["epa_h"] + f["epa_a"]) + t["succ"] * (f["succ_h"] + f["succ_a"])
             + t["plays"] * (f["plays_h"] + f["plays_a"]) + t["windy"] * f["windy"] + t["cold"] * f["cold"] + t["dome"] * f["dome"]
             + t["qbv"] * (f["qbval_h"] + f["qbval_a"]) + t["const"]) if t else None
    parts = [
        ("ratings", "Team strength (schedule-adjusted)",
         m["epa"] * (f["epa_h"] - f["epa_a"]) + m["succ"] * (f["succ_h"] - f["succ_a"]) + m["pts"] * (f["pts_h"] - f["pts_a"])),
        ("home", "Home field", m["home"] * f["home1"]),
        ("qb", "Quarterbacks", m["qb"] * (f["qb_h"] - f["qb_a"]) + m["qbnew"] * (f["qbnew_h"] - f["qbnew_a"])),
        ("rest", "Rest", m["rest"] * f["rest"]),
    ]
    return margin, total, parts
