"""NBA games while they're on, from NBA.com's own live feed (Nov 8, the
owner, on a live game: "The live feed is super slow still shows kd
rebound" -- ESPN's play-by-play ran half a minute behind its own clock).

cdn.nba.com/static/json/liveData is what NBA.com's game pages read: the
day's scoreboard, each game's play-by-play and box score, updated within
seconds. (Not stats.nba.com, which turns servers away; that one comes in
through the phone relay.) game_live.extras takes the last play, the run,
the quarter scores and the box score from here when it answers, and stays
on ESPN when it doesn't. The win chance line is ESPN's either way: NBA.com
doesn't publish one.
"""
import re
import time

import requests

import game_predictor as gp

CDN = "https://cdn.nba.com/static/json/liveData"
# How often each part is read at most (seconds), and how long NBA.com is
# left alone after it doesn't answer (so a slow feed never slows the chart).
GAME_SECONDS = 2
BOARD_SECONDS = 5
RESTING = 120
TIMEOUT = 3
# ESPN's abbreviation -> NBA.com's tricode where they differ.
TRICODES = {"GS": "GSW", "NY": "NYK", "SA": "SAS", "NO": "NOP", "UTAH": "UTA", "WSH": "WAS"}
ESPN_ABBR = {code: abbr for abbr, code in TRICODES.items()}
_resting = {"until": 0.0}


def _get(path, seconds):
    if time.time() < _resting["until"]:
        return None

    def load():
        response = requests.get(f"{CDN}{path}", timeout=TIMEOUT,
                                headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0", "Referer": "https://www.nba.com/"})
        response.raise_for_status()
        return response.json()
    try:
        return gp._kept(f"nbalive:{path}", seconds, load)
    except Exception:  # noqa: BLE001 -- ESPN stands in
        _resting["until"] = time.time() + RESTING
        return None


def tricode(abbr) -> str:
    abbr = str(abbr or "").upper()
    return TRICODES.get(abbr, abbr)


def clock_text(value) -> str:
    """NBA.com's ISO clock as a game clock: "PT01M21.00S" -> "1:21",
    "PT00M54.40S" -> "0:54.4" (tenths under a minute, as on TV)."""
    found = re.match(r"PT(\d+)M([\d.]+)S", str(value or ""))
    if not found:
        return str(value or "")
    minutes, seconds = int(found.group(1)), float(found.group(2))
    if minutes == 0 and seconds < 60 and seconds % 1:
        return f"0:{seconds:04.1f}"
    return f"{minutes}:{int(seconds):02d}"


def _minutes(value) -> float:
    found = re.match(r"PT(\d+)M([\d.]+)S", str(value or ""))
    return round(int(found.group(1)) + float(found.group(2)) / 60, 1) if found else 0.0


def _ordinal(period) -> str:
    period = int(period or 1)
    return {1: "1st", 2: "2nd", 3: "3rd", 4: "4th"}.get(period) or ("OT" if period == 5 else f"{period - 4}OT")


def board() -> list:
    return ((_get("/scoreboard/todaysScoreboard_00.json", BOARD_SECONDS) or {}).get("scoreboard") or {}).get("games") or []


def find_game(home_abbr, away_abbr, games=None):
    """NBA.com's game for ESPN's two teams today, or None."""
    home, away = tricode(home_abbr), tricode(away_abbr)
    for game in board() if games is None else games:
        if (game.get("homeTeam") or {}).get("teamTricode") == home and (game.get("awayTeam") or {}).get("teamTricode") == away:
            return game
    return None


def detail(game) -> str | None:
    """ESPN's way of saying it ("0:54.4 - 2nd"), so the page reads both alike."""
    period, clock = game.get("period"), clock_text(game.get("gameClock"))
    if not period or not clock or clock in ("0:00", "0:00.0"):
        return None
    return f"{clock} - {_ordinal(period)}"


def plays(actions) -> list:
    """NBA.com's actions as ESPN-like plays (game_live reads those)."""
    out = []
    for action in actions or []:
        team = action.get("teamTricode")
        out.append({"id": f"n{action.get('actionNumber')}", "period": {"number": action.get("period")},
                    "clock": {"displayValue": clock_text(action.get("clock"))}, "text": action.get("description") or "",
                    "homeScore": action.get("scoreHome"), "awayScore": action.get("scoreAway"),
                    "team": {"abbreviation": ESPN_ABBR.get(team, team)} if team else {}})
    return out


STATS = {"pts": "points", "reb": "reboundsTotal", "ast": "assists", "stl": "steals", "blk": "blocks", "to": "turnovers",
         "pf": "foulsPersonal", "oreb": "reboundsOffensive", "dreb": "reboundsDefensive", "fgm": "fieldGoalsMade",
         "fga": "fieldGoalsAttempted", "tpm": "threePointersMade", "tpa": "threePointersAttempted",
         "ftm": "freeThrowsMade", "fta": "freeThrowsAttempted"}


def box(game) -> dict:
    """NBA.com's box score in game_live.box_score's shape."""
    out = {}
    for side, key in (("home", "homeTeam"), ("away", "awayTeam")):
        people = []
        for player in (game.get(key) or {}).get("players") or []:
            numbers = player.get("statistics") or {}
            stats = {field: gp._num(numbers.get(name)) or 0 for field, name in STATS.items()}
            stats["min"] = _minutes(numbers.get("minutes") or numbers.get("minutesCalculated"))
            pid = player.get("personId")
            people.append({"id": f"n{pid}", "name": player.get("name") or "", "short": player.get("nameI") or player.get("name") or "",
                           "headshot": f"https://cdn.nba.com/headshots/nba/latest/260x190/{pid}.png" if pid else None,
                           "starter": str(player.get("starter")) == "1", "stats": stats,
                           **({"out": True} if str(player.get("status") or "ACTIVE").upper() != "ACTIVE" else {})})
        out[side] = people
    return out


def quarters(game) -> dict | None:
    rows = {side: [gp._num(item.get("score")) for item in (game.get(key) or {}).get("periods") or []]
            for side, key in (("home", "homeTeam"), ("away", "awayTeam"))}
    played = max(int(gp._num(game.get("period")) or 0), 1)
    count = min(played, max(len(rows["home"]), len(rows["away"])))
    if not count:
        return None
    whole = lambda value: int(value) if value is not None and float(value).is_integer() else value
    return {"labels": [f"Q{index + 1}" if index < 4 else ("OT" if index == 4 else f"OT{index - 3}") for index in range(count)],
            "home": [whole(value) for value in rows["home"][:count]], "away": [whole(value) for value in rows["away"][:count]]}


def live(home_abbr, away_abbr) -> dict | None:
    """{plays, box, quarters, home, away (scores), detail} for a game on now,
    from NBA.com; None when it isn't on there or doesn't answer."""
    found = find_game(home_abbr, away_abbr)
    if not found or int(gp._num(found.get("gameStatus")) or 0) != 2:
        return None
    game_id = found.get("gameId")
    actions = ((_get(f"/playbyplay/playbyplay_{game_id}.json", GAME_SECONDS) or {}).get("game") or {}).get("actions")
    scores = ((_get(f"/boxscore/boxscore_{game_id}.json", GAME_SECONDS) or {}).get("game")) or {}
    if not actions and not scores:
        return None
    game = scores or found
    return {"plays": plays(actions), "box": box(scores) if scores else None, "quarters": quarters(scores) if scores else None,
            "home": gp._num((game.get("homeTeam") or {}).get("score")), "away": gp._num((game.get("awayTeam") or {}).get("score")),
            "detail": detail(game), "gameId": game_id}


def scores() -> dict:
    """{(home tricode, away tricode): {home, away, detail, state}} for the games on NBA.com's scoreboard."""
    out = {}
    for game in board():
        state = {1: "pre", 2: "in", 3: "post"}.get(int(gp._num(game.get("gameStatus")) or 0))
        out[((game.get("homeTeam") or {}).get("teamTricode"), (game.get("awayTeam") or {}).get("teamTricode"))] = {
            "home": gp._num((game.get("homeTeam") or {}).get("score")), "away": gp._num((game.get("awayTeam") or {}).get("score")),
            "detail": detail(game), "state": state}
    return out
