"""Every hitter's matchup on today's MLB slate, graded the way Research grades
one (backend/matchup_model.py): his split against the starter's hand, the
starter's quality, how he hits the starter's pitch mix, career history
against him, his last 10 games, the park and the weather.

One read for the whole slate, for Krazy Bot (view=mlb-matchups): it shares
the Cheat Sheets' slate (mlb_sheets.slate) and adds the starters' pitch mixes,
Savant's batter-by-pitch-type leaderboard (one download for every hitter),
career batter-vs-pitcher lines and recent game logs.

A hitter is graded three ways, because the pitch-mix fit depends on the
prop: hits read his average against each pitch, total bases and home runs
his slugging, everything else his wOBA. Grades are for the over; the under's
is 100 minus it.
"""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor

import mlb_sheets
from live_props_core import cached

TTL = 20 * 60
FAMILIES = {"hits": "hits", "power": "total_bases", "other": ""}
FIP_CONSTANT = 3.15


def _model():
    mlb_sheets._stats()  # puts backend/ on the path
    import matchup_model
    return matchup_model


def fip(season):
    """FIP from the season line: (13 HR + 3 BB - 2 K) / IP + a league constant."""
    ip, hr, so, bb9 = (season.get(key) for key in ("ip", "hr", "so", "bb9"))
    if not ip or hr is None or so is None or bb9 is None:
        return None
    walks = bb9 * ip / 9
    return round((13 * hr + 3 * walks - 2 * so) / ip + FIP_CONSTANT, 2)


def pitcher_input(starter):
    season = starter.get("season") or {}
    return {"hand": starter.get("throws"), "name": starter.get("name"), "era": season.get("era"),
            "fip": fip(season), "whip": season.get("whip"), "hr_per_9": season.get("hr9")}


def hand_splits(hitter):
    return {hand: {"avg": line.get("avg"), "ops": line.get("ops"), "pa": line.get("pa") or 0}
            for hand, line in (hitter.get("vs") or {}).items() if line}


def last_ten_ops(games):
    """OPS over his last 10 games from the box-score counts (sacrifices count as at-bats)."""
    games = [game for game in games if game.get("pa")][-10:]
    if len(games) < 5:
        return None
    pa = sum(game["pa"] for game in games)
    on = sum(game["hits"] + game["bb"] + game["hbp"] for game in games)
    ab = pa - sum(game["bb"] + game["hbp"] for game in games)
    if pa <= 0 or ab <= 0:
        return None
    return round(on / pa + sum(game["tb"] for game in games) / ab, 3)


def form_input(hitter, games):
    recent, season = last_ten_ops(games), (hitter.get("season") or {}).get("ops")
    if recent is None or not season:
        return {}
    return {"recent_batting_form": {"l10_ops": recent, "season_ops": season, "delta_pct": round((recent / season - 1) * 100, 1)}}


def bvp_input(line):
    ab, hits = int((line or {}).get("ab") or 0), int((line or {}).get("hits") or 0)
    return {"ab": ab, "hits": hits, "avg": round(hits / ab, 3) if ab else 0}


def mix(arsenal, canonical):
    return [{**pitch, "pitch_type": canonical(pitch.get("pitch_type"))} for pitch in arsenal or []]


def grade(model, hitter, starter, games, bvp, arsenal, pitch_results, park, weather):
    """The three grades and the factors behind them for one hitter."""
    out, factors = {}, None
    for family, prop in FAMILIES.items():
        result = model.matchup_score_100(form_input(hitter, games), side="over", pitcher=pitcher_input(starter),
                                         bvp=bvp_input(bvp), park_factor=park or 1.0, weather=weather or {},
                                         arsenal=arsenal, bat_vs_pitch=pitch_results, vs_hand_splits=hand_splits(hitter),
                                         prop_type=prop)
        fit = next((item for item in result["factors"] if item["key"] == "arsenal_fit"), {})
        out[family] = {"score": result["score"], "label": result["label"], "coverage": result["coverage"],
                       "arsenal": {"impact": fit.get("impact"), "detail": fit.get("detail")}}
        if family == "other":
            factors = [{"key": item["key"], "name": item["name"], "impact": item["impact"], "available": item["available"],
                        "detail": item["detail"].replace("L10 OPS", "Last 10 OPS")} for item in result["factors"]]
    return out, factors


def slate_matchups(day=None):
    """Every hitter on the day's slate with his three matchup grades (cached TTL)."""
    data = mlb_sheets.slate(mlb_sheets.resolve_day(day or "today"))

    def load():
        stats_mlb, model = mlb_sheets._stats(), _model()
        rows = mlb_sheets._hitter_rows(data)
        starters = {str(item["starter"]["id"]): item["starter"] for item in rows if item["starter"]}
        jobs = {}
        for item in rows:
            if item["starter"]:
                jobs.setdefault(str(item["starter"]["id"]), []).append(item["hitter"]["id"])

        def arsenal(pitcher_id):
            try:
                return mix(stats_mlb.get_pitcher_arsenal(int(pitcher_id)), stats_mlb._canonical_pitch_type)
            except Exception:
                return []

        def history(job):
            try:
                return stats_mlb.get_career_bvp_batch(job[1], int(job[0])) or {}
            except Exception:
                return {}

        with ThreadPoolExecutor(max_workers=6) as pool:
            arsenals = dict(zip(starters, pool.map(arsenal, starters)))
            careers = dict(zip(jobs, pool.map(history, jobs.items())))
            weathers = dict(zip([game["gamePk"] for game in data["games"]], pool.map(mlb_sheets._weather, data["games"])))
            pitch_table = pool.submit(stats_mlb._load_batter_arsenal_table)
            logs = pool.submit(mlb_sheets._game_logs, data["day"], [item["hitter"]["id"] for item in rows])
            try:
                table = pitch_table.result() or {}
            except Exception:
                table = {}
            try:
                logs = logs.result() or {}
            except Exception:
                logs = {}

        players = {}
        for item in rows:
            hitter, starter, game = item["hitter"], item["starter"], item["game"]
            if not starter or not (hitter.get("season") or {}).get("pa"):
                continue
            key = str(hitter["id"])
            career = careers.get(str(starter["id"]), {})
            bvp = career.get(hitter["id"]) or career.get(key) or {}
            grades, factors = grade(model, hitter, starter, logs.get(key, []), bvp, arsenals.get(str(starter["id"]), []),
                                    [dict(row) for row in table.get(key, [])], mlb_sheets._park(game), weathers.get(game["gamePk"]))
            players[key] = {"id": hitter["id"], "name": hitter["name"], "bats": hitter.get("bats"), "team": item["team"]["abbr"],
                            "opponent": item["opponent"]["abbr"], "gamePk": game["gamePk"], "confirmed": hitter.get("confirmed", False),
                            "pitcher": {"id": starter["id"], "name": starter["name"], "hand": starter.get("throws")},
                            "pitches": [{"name": pitch.get("pitch_name") or pitch.get("pitch_type"), "pct": pitch.get("pct")}
                                        for pitch in arsenals.get(str(starter["id"]), [])[:4]],
                            "grades": grades, "factors": factors,
                            # His career line against today's starter, as numbers (the factor's detail is words).
                            "bvp": {key: bvp.get(key) for key in ("ab", "hits", "hr", "avg", "ops")} if bvp.get("ab") else None}
        return {"day": data["day"], "players": players, "updatedAt": int(time.time() * 1000)}

    return cached(("mlb-prop-matchups", data["day"]), TTL, load)
