"""Opponent-adjusted team ratings for the Game Predictor (game_predictor.py).

One rating method for both leagues, the one the backtests used
(tools/game-predictor-backtest): every team-game says how well the offense
did against that defense,

    value = mu + hfa * H + offense[team] + defense[opponent]

(H: +1 at home, -1 away, 0 on a neutral field), solved by weighted ridge
least squares. Recent games weigh more (a half-life in days), and every
rating is pulled toward its prior (last season's, shrunk toward average) by
`lam` games' worth of evidence -- so a team's early-season numbers lean on
last season and its schedule's strength is accounted for (a defense that
faced weak offenses isn't credited for it).
"""
from __future__ import annotations

import math
from datetime import date as Date

import numpy as np


def recency(ages_days, half_life):
    """Weight of a game `ages_days` old: halves every `half_life` days."""
    return np.power(0.5, np.asarray(ages_days, dtype=float) / float(half_life))


def solve(rows, weights, teams, prior=None, lam=8.0, prior_mu=0.0, prior_hfa=0.0, home=True):
    """rows: [(team, opponent, H, value)]; prior: {"off": {team: x}, "def": {team: x}}.

    Returns {"mu", "hfa", "off": {team: x}, "def": {team: x}}. A team with
    no games keeps its prior; with no prior at all, 0 (league average)."""
    teams = list(teams)
    index = {team: i for i, team in enumerate(teams)}
    n = len(teams)
    k = 2 + 2 * n
    prior = prior or {}
    p_off = np.array([(prior.get("off") or {}).get(team, 0.0) for team in teams])
    p_def = np.array([(prior.get("def") or {}).get(team, 0.0) for team in teams])
    kept = [(row, wt) for row, wt in zip(rows, weights) if row[0] in index and row[1] in index]
    rows = [row for row, _ in kept]
    w = np.array([wt for _, wt in kept], dtype=float)
    X = np.zeros((len(rows), k))
    y = np.zeros(len(rows))
    for i, (team, opponent, h, value) in enumerate(rows):
        X[i, 0] = 1.0
        X[i, 1] = h
        X[i, 2 + index[team]] = 1.0
        X[i, 2 + n + index[opponent]] = 1.0
        y[i] = value
    root = np.sqrt(w)
    A = X * root[:, None]
    b = y * root
    # The ratings pulled toward their prior, lam games' worth each.
    P = np.zeros((2 * n, k))
    P[:, 2:] = np.eye(2 * n) * math.sqrt(lam)
    pb = np.concatenate([p_off, p_def]) * math.sqrt(lam)
    # mu barely anchored (so an empty season still solves); home edge anchored
    # at its prior (strongly when the stat has no home edge, like pace).
    anchor_hfa = 1.0 if home else 100.0
    Q = np.zeros((2, k))
    Q[0, 0] = 0.03
    Q[1, 1] = anchor_hfa
    qb = np.array([prior_mu * 0.03, prior_hfa * anchor_hfa])
    x = np.linalg.lstsq(np.vstack([A, P, Q]), np.concatenate([b, pb, qb]), rcond=None)[0]
    return {"mu": float(x[0]), "hfa": float(x[1]),
            "off": {team: float(x[2 + i]) for i, team in enumerate(teams)},
            "def": {team: float(x[2 + n + i]) for i, team in enumerate(teams)}}


def shrink(ratings, keep):
    """Last season's ratings as this season's prior: each pulled toward average."""
    return {"mu": ratings["mu"], "hfa": ratings["hfa"],
            "off": {team: value * keep for team, value in ratings["off"].items()},
            "def": {team: value * keep for team, value in ratings["def"].items()}}


def days_between(a, b) -> int:
    """Whole days from date a to date b (both datetime.date)."""
    return (b - a).days if isinstance(a, Date) and isinstance(b, Date) else 0


def solve_pace(rows, weights, teams, prior=None, lam=8.0, prior_mu=100.0):
    """rows: [(team, opponent, possessions)], each game from both sides:
    possessions = mu + pace[team] + pace[opponent]. Returns {"mu", "pace": {team: x}}."""
    teams = list(teams)
    index = {team: i for i, team in enumerate(teams)}
    n = len(teams)
    prior = prior or {}
    p = np.array([(prior.get("pace") or {}).get(team, 0.0) for team in teams])
    kept = [(row, wt) for row, wt in zip(rows, weights) if row[0] in index and row[1] in index]
    rows = [row for row, _ in kept]
    w = np.array([wt for _, wt in kept], dtype=float)
    X = np.zeros((len(rows), 1 + n))
    y = np.zeros(len(rows))
    for i, (team, opponent, value) in enumerate(rows):
        X[i, 0] = 1.0
        X[i, 1 + index[team]] += 1.0
        X[i, 1 + index[opponent]] += 1.0
        y[i] = value
    root = np.sqrt(w)
    P = np.zeros((n, 1 + n))
    P[:, 1:] = np.eye(n) * math.sqrt(lam)
    Q = np.zeros((1, 1 + n))
    Q[0, 0] = 0.03
    x = np.linalg.lstsq(np.vstack([X * root[:, None], P, Q]), np.concatenate([y * root, p * math.sqrt(lam), [prior_mu * 0.03]]), rcond=None)[0]
    return {"mu": float(x[0]), "pace": {team: float(x[1 + i]) for i, team in enumerate(teams)}}
