"""The NBA side of the Game Predictor (game_predictor.py): the stored seasons
of ESPN box scores (backend/sports/wnba/league.py) turned into opponent-
adjusted ratings, each team's regulars and what an absence costs, and each
side's best player matchup.

Everything here is the backtested model (tools/game-predictor-backtest):
the settings and weights live in game_predictor.MODELS["nba"]. Definitions,
the same everywhere:

* possessions: each team's FGA - offensive rebounds + turnovers + 0.44 FTA,
  averaged over the two teams (backend/sports/wnba/opportunity.py);
* offensive rating: points per 100 possessions; defensive: allowed per 100;
* pace: possessions a game.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta, timezone

import predictor_ratings as ratings

POSITIONS = ("G", "F", "C")


def _when(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def us_date(moment: datetime):
    """The game's date in the US (ESPN files a late tip under the US date)."""
    return (moment - timedelta(hours=5)).date()


def games_of(payload) -> list:
    """The stored season's finished games, each once, oldest first:
    {id, when, date, home, away, hs, as, poss, lines: {team: [box rows]}}.
    A game missing a side, with no minutes or an impossible possession count
    is left out (never counted as zeros)."""
    from backend.sports.wnba import opportunity
    from backend.sports.wnba.league import FIELDS
    index = {name: i + 2 for i, name in enumerate(FIELDS)}
    out, seen = [], set()
    for game_id, game in ((payload or {}).get("games") or {}).items():
        sides = game.get("t") or {}
        teams = list(sides)
        home = game.get("home")
        if game_id in seen or len(teams) != 2 or home not in teams:
            continue
        away = teams[0] if teams[1] == home else teams[1]
        own, opp = opportunity.side_totals(sides[home]), opportunity.side_totals(sides[away])
        when = _when(game.get("date"))
        if not own["min"] or not opp["min"] or not when:
            continue
        poss = opportunity.possessions(own, opp)
        if poss <= 50:
            continue
        seen.add(game_id)
        out.append({"id": game_id, "when": when, "date": us_date(when), "home": home, "away": away,
                    "hs": own["pts"], "as": opp["pts"], "poss": poss,
                    "lines": {home: sides[home].get("p") or [], away: sides[away].get("p") or []}})
    out.sort(key=lambda g: (g["when"], g["id"]))
    return out, index


def _team_list(games):
    return sorted({g["home"] for g in games} | {g["away"] for g in games})


def rate(games, today, params, prior=None):
    """Ratings as of `today` (games before it only): {mu, hfa, off, def, pace_mu, pace}."""
    past = [g for g in games if g["date"] < today]
    teams = sorted(set(_team_list(past)) | set((prior or {}).get("off") or {}))
    rows, ages = [], []
    for g in past:
        age = (today - g["date"]).days
        rows += [(g["home"], g["away"], 1, 100 * g["hs"] / g["poss"]), (g["away"], g["home"], -1, 100 * g["as"] / g["poss"])]
        ages += [age, age]
    w = ratings.recency(ages, params["half_life"])
    prior = prior or {}
    eff = ratings.solve(rows, w, teams, prior, params["lam"], prior.get("mu", 112.0), prior.get("hfa", 1.5))
    pace_rows = [(r[0], r[1], g["poss"]) for g in past for r in ((g["home"], g["away"]), (g["away"], g["home"]))]
    pace = ratings.solve_pace(pace_rows, w, teams, {"pace": prior.get("pace") or {}}, params["lam"], prior.get("pace_mu", 100.0))
    return {"mu": eff["mu"], "hfa": eff["hfa"], "off": eff["off"], "def": eff["def"], "pace_mu": pace["mu"], "pace": pace["pace"],
            "games": len(past)}


def season_prior(last_games, params) -> dict | None:
    """Last season's ratings at its end, shrunk toward average: this season's prior."""
    if not last_games:
        return None
    end = max(g["date"] for g in last_games) + timedelta(days=1)
    final = rate(last_games, end, params)
    keep, pace_keep = params["keep"], params["pace_keep"]
    return {"mu": final["mu"], "hfa": final["hfa"], "off": {t: v * keep for t, v in final["off"].items()},
            "def": {t: v * keep for t, v in final["def"].items()}, "pace_mu": final["pace_mu"],
            "pace": {t: v * pace_keep for t, v in final["pace"].items()}}


def _gmsc(row, index) -> float:
    v = lambda key: row[index[key]] or 0
    return (v("pts") + 0.4 * v("fgm") - 0.7 * v("fga") - 0.4 * (v("fta") - v("ftm")) + 0.7 * v("oreb") + 0.3 * v("dreb")
            + v("stl") + 0.7 * v("ast") + 0.7 * v("blk") - 0.4 * v("pf") - v("to"))


def team_states(games, index, today, params, players) -> dict:
    """team -> {games, lastDate, lastVenue, recent dates, regulars: {id: player}}.

    A player's value is his Game Score a minute (shrunk toward 0 over
    `shrink_minutes`) times his expected minutes (his last 10 games); how
    much of him the team's ratings already hold is the recency-weighted share
    of the team's last `window` games he played. A player whose latest game
    was for another team is no longer counted for this one."""
    past = [g for g in games if g["date"] < today]
    by_team = defaultdict(list)
    for g in past:
        by_team[g["home"]].append(g)
        by_team[g["away"]].append(g)
    states = {}
    for team, hist in by_team.items():
        recent = hist[-params["window"]:]
        weights = [0.5 ** ((today - g["date"]).days / params["half_life"]) for g in recent]
        total_w = sum(weights) or 1.0
        apps = defaultdict(list)
        for g, wt in zip(recent, weights):
            for row in g["lines"].get(team) or []:
                minutes = row[index["min"]] or 0
                if minutes > 0:
                    apps[str(row[0])].append((g["date"], minutes, _gmsc(row, index), row[index["pts"]] or 0,
                                              row[index["reb"]] or 0, row[index["ast"]] or 0, wt))
        season = defaultdict(lambda: [0, 0.0, 0.0, 0.0, 0.0])
        for g in hist:
            for row in g["lines"].get(team) or []:
                minutes = row[index["min"]] or 0
                if minutes > 0:
                    cell = season[str(row[0])]
                    cell[0] += 1
                    cell[1] += minutes
                    cell[2] += row[index["pts"]] or 0
                    cell[3] += row[index["reb"]] or 0
                    cell[4] += row[index["ast"]] or 0
        regulars = {}
        for pid, lines in apps.items():
            info = players.get(pid) or ["", "", None, team]
            last10 = lines[-10:]
            expected = sum(line[1] for line in last10) / len(last10)
            minutes = sum(line[1] for line in lines)
            per_minute = sum(line[2] for line in lines) / (minutes + params["shrink_minutes"])
            s = season[pid]
            regulars[pid] = {
                "id": pid, "name": info[0], "pos": str(info[1] or "").upper()[:1] if str(info[1] or "").upper()[:1] in POSITIONS else None,
                "headshot": info[2] or f"https://a.espncdn.com/i/headshots/nba/players/full/{pid}.png",
                "here": (info[3] if len(info) > 3 else team) == team,
                "games": len(lines), "minutes": expected, "value": per_minute * expected,
                "reflect": sum(line[6] for line in lines) / total_w,
                "rotation": expected >= params["regular_minutes"] and len(lines) >= 2,
                "recentGames": len(last10), "recentMin": sum(line[1] for line in last10),
                "recent": {k: sum(line[i] for line in last10) for k, i in (("pts", 3), ("reb", 4), ("ast", 5))},
                "season": {"games": s[0], "min": s[1], "pts": s[2], "reb": s[3], "ast": s[4]},
                # His latest game in the window and the team's games since (the matchup card's injuries).
                "lastDate": lines[-1][0].isoformat(), "missed": sum(1 for g in hist if g["date"] > lines[-1][0]),
                "playedLast": hist[-1] is not None and any(str(r[0]) == pid and (r[index["min"]] or 0) > 0 for r in hist[-1]["lines"].get(team) or []),
            }
        last = hist[-1]
        # Its last 10: each game's margin from its side, the opponent, home or away (the matchup card).
        recent_games = [{"date": g["date"].isoformat(), "opponent": g["away"] if g["home"] == team else g["home"], "home": g["home"] == team,
                         "margin": (g["hs"] - g["as"]) if g["home"] == team else (g["as"] - g["hs"])} for g in hist[-10:]]
        states[team] = {"games": len(hist), "lastDate": last["date"], "lastVenue": last["home"],
                        "dates": [g["date"] for g in hist[-6:]], "regulars": regulars, "recent": recent_games}
    return states


def defense_by_position(games, index, players, today) -> dict:
    """team -> position -> stat -> {per36, factor, rank}: what a defense
    allows guards, forwards and centers per 36 minutes this season, against
    the league, the factor shrunk toward 1 on few games (n / (n + 10)).
    Rank 1 allows the most."""
    past = [g for g in games if g["date"] < today]
    allowed = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    league = defaultdict(lambda: defaultdict(float))
    played = defaultdict(int)
    for g in past:
        for team, opponent in ((g["home"], g["away"]), (g["away"], g["home"])):
            played[team] += 1
            for row in g["lines"].get(opponent) or []:
                pos = str((players.get(str(row[0])) or ["", ""])[1] or "").upper()[:1]
                minutes = row[index["min"]] or 0
                if pos not in POSITIONS or minutes <= 0:
                    continue
                for bucket in (allowed[team][pos], league[pos]):
                    bucket["min"] += minutes
                    for stat in ("pts", "reb", "ast"):
                        bucket[stat] += row[index[stat]] or 0
    out = {}
    for pos in POSITIONS:
        for stat in ("pts", "reb", "ast"):
            base = league[pos][stat] / league[pos]["min"] * 36 if league[pos]["min"] else None
            column = {team: cells[pos][stat] / cells[pos]["min"] * 36 for team, cells in allowed.items() if cells[pos]["min"]}
            ordered = sorted(column.values(), reverse=True)
            for team, value in column.items():
                if not base:
                    continue
                n = played[team]
                out.setdefault(team, {}).setdefault(pos, {})[stat] = {"per36": value, "factor": 1 + (value / base - 1) * n / (n + 10),
                                                                     "rank": ordered.index(value) + 1, "teams": len(ordered)}
    return out


# Each arena's city, for travel (km from the last game's city).
CITY = {"ATL": (33.757, -84.396), "BOS": (42.366, -71.062), "BKN": (40.683, -73.976), "CHA": (35.225, -80.839), "CHI": (41.881, -87.674),
        "CLE": (41.496, -81.688), "DAL": (32.790, -96.810), "DEN": (39.749, -105.008), "DET": (42.341, -83.055), "GS": (37.768, -122.388),
        "HOU": (29.751, -95.362), "IND": (39.764, -86.155), "LAC": (33.945, -118.341), "LAL": (34.043, -118.267), "MEM": (35.138, -90.051),
        "MIA": (25.781, -80.188), "MIL": (43.045, -87.917), "MIN": (44.980, -93.276), "NO": (29.949, -90.082), "NY": (40.751, -73.993),
        "OKC": (35.463, -97.515), "ORL": (28.539, -81.384), "PHI": (39.901, -75.172), "PHX": (33.446, -112.071), "POR": (45.532, -122.667),
        "SAC": (38.580, -121.500), "SA": (29.427, -98.437), "TOR": (43.643, -79.379), "UTAH": (40.768, -111.901), "WSH": (38.898, -77.021)}


def km(a, b):
    import math
    if a not in CITY or b not in CITY:
        return None
    (la1, lo1), (la2, lo2) = CITY[a], CITY[b]
    p = math.pi / 180
    h = math.sin((la2 - la1) * p / 2) ** 2 + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((lo2 - lo1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(h))


def rest_of(state, today, venue):
    """Days of rest, back-to-back, three games in four nights and travel (context: tested, not in the number)."""
    if not state:
        return None
    days = (today - state["lastDate"]).days
    in4 = sum(1 for d in state["dates"] if (today - d).days <= 3)
    travel = km(state["lastVenue"], venue) if days <= 3 else 0
    return {"days": days, "b2b": days == 1, "threeInFour": in4 >= 2, "travelKm": round(travel) if travel is not None else None}


def classify(status) -> str:
    """ESPN's status as out (Out, Doubtful, suspended), questionable (Day-To-Day, Questionable, Game Time Decision) or other."""
    text = str(status or "").strip().lower()
    if text in ("out", "doubtful", "suspension", "suspended", "injured reserve", "ir", "out for season"):
        return "out"
    if text in ("day-to-day", "questionable", "gtd", "game time decision", "game-time decision"):
        return "questionable"
    return "other"


def miss_chance(item) -> float:
    """How likely a questionable player sits tonight, from ESPN's status, code
    and note: doubtful 75%, questionable or a game-time decision 50%, probable
    10%, a plain day-to-day 40%. (No history of injury reports to fit these
    on; they're the usual rates for each listing.)"""
    text = " ".join(str(item.get(field) or "") for field in ("status", "code", "comment")).lower()
    if "doubtful" in text:
        return 0.75
    if any(word in text for word in ("questionable", "gtd", "game-time", "game time")):
        return 0.5
    if "probable" in text:
        return 0.1
    return 0.4


def predict(game, rt, states, params, key):
    """The independent prediction: margin (home), total, the parts, who's out and the questionable scenarios.
    None when either team has no ratings."""
    home, away = game["home"]["abbr"], game["away"]["abbr"]
    if home not in rt["off"] or away not in rt["off"]:
        return None
    poss = rt["pace_mu"] + rt["pace"].get(home, 0.0) + rt["pace"].get(away, 0.0)
    eff_h = rt["mu"] + rt["off"][home] + rt["def"][away]
    eff_a = rt["mu"] + rt["off"][away] + rt["def"][home]
    rmargin, rtotal = poss * (eff_h - eff_a) / 100, poss * (eff_h + eff_a) / 100
    injuries = game.get("injuries") or {}
    lost, out, questionable = {}, {}, {}
    for side, abbr in (("home", home), ("away", away)):
        regulars = (states.get(abbr) or {}).get("regulars") or {}
        by_name = {key(p["name"]): p for p in regulars.values()}
        lost[side], out[side], questionable[side] = 0.0, [], []
        for item in injuries.get(abbr) or []:
            kind = classify(item.get("status"))
            player = regulars.get(str(item.get("id") or "")) or by_name.get(key(item.get("name")))
            counted = bool(player and player["rotation"] and player["here"])
            cost = params["injury"] * player["value"] * player["reflect"] if counted else 0.0
            entry = {"name": item.get("name"), "position": item.get("position"), "status": item.get("status"), "kind": kind,
                     "injury": item.get("injury"), "impact": round(cost, 1) if kind != "other" else 0.0,
                     "minutes": round(player["minutes"], 1) if player else None,
                     "inRatings": round(player["reflect"] * 100) if player else None,
                     # What he scores and how long he's been out (the matchup card's injuries).
                     "ppg": round(player["season"]["pts"] / player["season"]["games"], 1) if player and player["season"]["games"] else None,
                     "missed": player.get("missed") if player else None, "since": player.get("lastDate") if player else None,
                     "headshot": player.get("headshot") if player else None}
            if kind == "out" and counted:
                lost[side] += player["value"] * player["reflect"]
            # Nov 9, the owner, on TOR at 74% with Barnes and Quickley day-to-day:
            # a questionable player counts at his chance to sit, not as playing.
            if kind == "questionable" and counted:
                chance = miss_chance(item)
                lost[side] += player["value"] * player["reflect"] * chance
                entry["chance"], entry["expected"] = chance, round(cost * chance, 1)
                if cost >= 0.3:
                    questionable[side].append(entry)
            out[side].append(entry)
        out[side].sort(key=lambda e: ({"out": 0, "questionable": 1}.get(e["kind"], 2), -e["impact"]))
    home_edge = 0.0 if game.get("neutral") else params["home"]
    rated = params["rating"] * rmargin
    hurt = params["injury"] * (lost["away"] - lost["home"])
    margin = rated + hurt + home_edge
    total = params["total_rating"] * rtotal + params["total_injury"] * (lost["home"] + lost["away"]) + params["total_const"]
    net = lambda team: rt["off"][team] - rt["def"][team]
    named = lambda side: ", ".join([f"{e['name']} {e['impact']:.1f}" for e in out[side] if e["kind"] == "out" and e["impact"] > 0]
                                   + [f"{e['name']} {e['expected']:.1f} ({round(e['chance'] * 100)}% to sit)" for e in out[side]
                                      if e["kind"] == "questionable" and e.get("expected", 0) > 0])
    parts = [
        {"key": "ratings", "label": "Team strength (schedule-adjusted)", "points": round(rated, 1),
         "text": f"Net rating {net(home):+.1f} vs {net(away):+.1f} per 100 possessions"},
        {"key": "home", "label": "Home court", "points": round(home_edge, 1), "text": "Neutral floor" if game.get("neutral") else f"{home} at home"},
        {"key": "injuries", "label": "Who's out", "points": round(hurt, 1),
         "text": " · ".join(t for t in (f"{home}: {named('home')}" if named("home") else "", f"{away}: {named('away')}" if named("away") else "") if t) or None},
    ]
    scenarios = []
    for side, sign in (("home", -1), ("away", 1)):
        for entry in questionable[side]:
            scenarios.append({"name": entry["name"], "team": game[side]["abbr"], "status": entry["status"], "chance": entry["chance"],
                              "ifOut": margin + sign * entry["impact"] * (1 - entry["chance"]),
                              "ifIn": margin - sign * entry["impact"] * entry["chance"], "impact": entry["impact"]})
    return {"margin": margin, "total": total, "poss": poss, "rmargin": rmargin, "parts": parts, "out": out, "scenarios": scenarios,
            "effs": {"home": eff_h, "away": eff_a}, "lost": lost}


def best_matchups(game, rt, states, dvp, built, params):
    """Each side's player with the most to gain tonight: per-minute
    production (his last 10 games blended with his season, `rate_minutes`
    of season weight), expected minutes (his last 10, plus a share of the
    minutes of regulars out tonight, at most +6), what this defense allows his
    position per 36 (shrunk on few games), and tonight's pace against his
    team's. Needs 5+ games and 20+ expected minutes."""
    out_names = {side: {e["name"] for e in built["out"][side] if e["kind"] == "out"} for side in ("home", "away")}
    result = {}
    for side, other in (("home", "away"), ("away", "home")):
        abbr, opponent = game[side]["abbr"], game[other]["abbr"]
        regulars = [p for p in ((states.get(abbr) or {}).get("regulars") or {}).values() if p["here"] and p["rotation"]]
        sitting = [p for p in regulars if p["name"] in out_names[side]]
        active = [p for p in regulars if p["name"] not in out_names[side]]
        freed = sum(p["minutes"] for p in sitting)
        active_minutes = sum(p["minutes"] for p in active) or 1.0
        team_pace = rt["pace_mu"] + rt["pace"].get(abbr, 0.0)
        pace = built["poss"] / team_pace if team_pace else 1.0
        best = None
        for p in active:
            s = p["season"]
            if s["games"] < 5 or p["minutes"] < 20 or p["recentGames"] < 3 or not s["min"]:
                continue
            extra = min(6.0, freed * p["minutes"] / active_minutes)
            minutes = p["minutes"] + extra
            spot = ((dvp.get(opponent) or {}).get(p["pos"]) or {})
            proj, season_avg, recent_avg = {}, {}, {}
            for stat in ("pts", "reb", "ast"):
                rate = (p["recent"][stat] + params["rate_minutes"] * s[stat] / s["min"]) / (p["recentMin"] + params["rate_minutes"])
                proj[stat] = rate * minutes * (spot.get(stat) or {}).get("factor", 1.0) * pace
                season_avg[stat] = s[stat] / s["games"]
                recent_avg[stat] = p["recent"][stat] / p["recentGames"]
            gain = (proj["pts"] - season_avg["pts"]) + 1.2 * (proj["reb"] - season_avg["reb"]) + 1.5 * (proj["ast"] - season_avg["ast"])
            if best is None or gain > best[0]:
                best = (gain, p, proj, season_avg, recent_avg, minutes, extra, spot)
        if not best:
            continue
        gain, p, proj, season_avg, recent_avg, minutes, extra, spot = best
        why = []
        stat = max(("pts", "reb", "ast"), key=lambda k: (spot.get(k) or {}).get("factor", 1.0))
        cell = spot.get(stat) or {}
        if cell.get("rank") and cell["rank"] <= 10:
            word = {"pts": "points", "reb": "rebounds", "ast": "assists"}[stat]
            pos = {"G": "guards", "F": "forwards", "C": "centers"}.get(p["pos"], "his position")
            why.append(f"{opponent} allows the {_ordinal(cell['rank'])} most {word} per 36 minutes to {pos}")
        if extra >= 1.5:
            why.append(f"About {extra:.0f} more minutes with {', '.join(sorted(n.split(' ')[-1] for n in out_names[side]))[:60]} out")
        if pace >= 1.02:
            why.append(f"Faster game than {abbr} usually plays ({built['poss']:.0f} possessions)")
        if recent_avg["pts"] >= season_avg["pts"] + 3:
            why.append(f"{recent_avg['pts']:.1f} points a game his last {p['recentGames']}")
        result[side] = {"id": p["id"], "name": p["name"], "position": p["pos"], "headshot": p["headshot"], "team": abbr,
                        "minutes": round(minutes, 1), "season": {k: round(v, 1) for k, v in season_avg.items()},
                        "recent": {k: round(v, 1) for k, v in recent_avg.items()}, "proj": {k: round(v, 1) for k, v in proj.items()},
                        "edge": round(gain, 1), "why": why}
    return result


def _ordinal(n):
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"
