"""A private connectivity test for ESPN's live NBA depth charts (Nov 18).

The owner wants Defense vs position split PG / SG / SF / PF / C as well as
G / F / C, from real dated positions, never guessed. ESPN's box scores only
say G, F or C, so the five spots have to come from ESPN's depth charts.
Before building anything this answers, from the site's own servers:

- does ESPN answer for all 30 teams, and with all five spots;
- how many of the players in our stored box scores those charts name, by
  ESPN athlete id (the same ids the box scores use);
- how each player would be placed by the rule the feature would use: his
  highest listing (lowest depth number) is his spot; a tie between spots at
  that listing is broken only by ESPN's own G / F / C label for him; a tie
  still left, or a player on no chart, is left unplaced -- never guessed.

Nothing on the site reads this; the five-position view isn't built. Runs
from api/v2-admin.py (?action=nba-depth-test): an admin session, Vercel's
daily cron, or the repository's "NBA depth chart test" workflow
(github_oidc.py). The latest result and the last runs are kept in the store.
"""
from __future__ import annotations

import json
import re
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

from . import context, league

SLOTS = ("pg", "sg", "sf", "pf", "c")
FAMILY = {"pg": "G", "sg": "G", "sf": "F", "pf": "F", "c": "C"}
# ESPN's site API answers with names; the core API is tried when it doesn't.
SITE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{team}/depthcharts"
CORE = "https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/{season}/teams/{team}/depthcharts"
TIMEOUT = (3, 7)
WORKERS = 15
# Each team's last few games: who it plays now, to set against today's chart.
RECENT_GAMES = 5
RESULT_KEY = "krazy_data:nba:v1:depth-probe"
RUNS_KEY = "krazy_data:nba:v1:depth-probe-runs"
KEEP_SECONDS = 30 * 86400
KEEP_RUNS = 20
_ATHLETE = re.compile(r"/athletes/(\d+)")


def _get(url: str):
    started = time.monotonic()
    try:
        response = requests.get(url, headers={"Accept": "application/json"}, timeout=TIMEOUT)
        info = {"status": response.status_code, "ms": int((time.monotonic() - started) * 1000), "bytes": len(response.content)}
        return (response.json() if response.status_code == 200 else None), info
    except Exception as exc:  # noqa: BLE001 -- reported, never raised
        return None, {"status": None, "error": type(exc).__name__, "ms": int((time.monotonic() - started) * 1000)}


def parse(payload) -> dict:
    """{slot: [(rank, athlete id, name)]} from either of ESPN's shapes: the
    site API's depthchart[].positions or the core API's items[].positions
    (athletes as $ref links). The first group with positions is the chart."""
    payload = payload if isinstance(payload, dict) else {}
    groups = payload.get("depthchart") or payload.get("items") or []
    if isinstance(groups, dict):
        groups = [groups]
    for group in groups:
        chart = {}
        for key, entry in ((group or {}).get("positions") or {}).items():
            entry = entry if isinstance(entry, dict) else {}
            abbr = str((entry.get("position") or {}).get("abbreviation") or "").lower()
            slot = abbr if abbr in SLOTS else str(key).lower()
            if slot not in SLOTS:
                continue
            for index, athlete in enumerate(entry.get("athletes") or []):
                athlete = athlete if isinstance(athlete, dict) else {}
                inner = athlete.get("athlete") if isinstance(athlete.get("athlete"), dict) else {}
                aid = athlete.get("id") or inner.get("id")
                if not aid:
                    found = _ATHLETE.search(str(inner.get("$ref") or athlete.get("$ref") or ""))
                    aid = found.group(1) if found else None
                if not aid:
                    continue
                rank = athlete.get("rank")
                rank = int(rank) if str(rank).isdigit() else index + 1
                chart.setdefault(slot, []).append((rank, str(aid), athlete.get("displayName") or inner.get("displayName") or ""))
        if chart:
            return chart
    return {}


def place(chart: dict, labels: dict) -> dict:
    """athlete id -> (spot or None, how): "listed" (one spot at his highest
    listing), "label" (a tie there broken by ESPN's G / F / C for him), or
    "tie" (still tied: left unplaced). `labels`: id -> "G" / "F" / "C"."""
    listings = {}
    for slot, rows in chart.items():
        for rank, aid, _ in rows:
            listings.setdefault(aid, []).append((rank, slot))
    placed = {}
    for aid, found in listings.items():
        top = min(rank for rank, _ in found)
        tops = sorted({slot for rank, slot in found if rank == top}, key=SLOTS.index)
        if len(tops) == 1:
            placed[aid] = (tops[0], "listed")
            continue
        fit = [slot for slot in tops if FAMILY[slot] == labels.get(aid)]
        placed[aid] = (fit[0], "label") if len(fit) == 1 else (None, "tie")
    return placed


def _team(abbr: str, team_id: str, season: int) -> dict:
    tried = []
    for name, url in (("site", SITE.format(team=team_id)), ("core", CORE.format(season=season, team=team_id))):
        payload, info = _get(url)
        chart = parse(payload)
        tried.append({"source": name, **info, "keys": sorted(payload)[:12] if isinstance(payload, dict) else None})
        if all(chart.get(slot) for slot in SLOTS):
            return {"abbr": abbr, "source": name, "chart": chart, "tried": tried}
    return {"abbr": abbr, "source": None, "chart": chart, "tried": tried}


def _labels(players: dict) -> dict:
    return {pid: str((entry or [None, ""])[1] or "").upper()[:1] for pid, entry in players.items()}


def run(trigger: str) -> dict:
    """Ask ESPN for every team's chart now and set them against our stored
    season. The result is kept (RESULT_KEY) and returned."""
    started = time.monotonic()
    season = league.current_season(league="nba")
    teams = league.team_directory("nba")
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        fetched = list(pool.map(lambda abbr: _team(abbr, teams[abbr]["id"], season), sorted(teams)))
    espn_seconds = round(time.monotonic() - started, 1)
    payload = league.stored(season, "nba") or {}
    players = payload.get("players") or {}
    labels = _labels(players)
    charts = {item["abbr"]: item["chart"] for item in fetched}
    on_chart = {abbr: {aid for rows in chart.values() for _, aid, _ in rows} for abbr, chart in charts.items()}
    anywhere = set().union(*on_chart.values()) if on_chart else set()
    placements = {abbr: place(chart, labels) for abbr, chart in charts.items()}

    # Each team's last RECENT_GAMES games against today's chart.
    minute = context._I["min"]
    recent = Counter()
    unmatched = Counter()
    by_team = context.team_games(payload)
    for abbr, games in by_team.items():
        for game in games[-RECENT_GAMES:]:
            for row in game["own"]["p"]:
                minutes = row[minute] or 0
                if not minutes:
                    continue
                aid = str(row[0])
                spot, how = placements.get(abbr, {}).get(aid, (None, "not on chart"))
                recent["games"] += 1
                recent["minutes"] += minutes
                recent[f"games:{how}"] += 1
                recent[f"minutes:{how}"] += minutes
                if how == "not on chart":
                    unmatched[(players.get(aid, [""])[0] or aid, abbr)] += minutes
    # Every played row this season: is the id on any team's chart today?
    season_rows = season_hits = 0
    for game in (payload.get("games") or {}).values():
        for side in (game.get("t") or {}).values():
            for row in side.get("p") or []:
                if row[minute]:
                    season_rows += 1
                    season_hits += str(row[0]) in anywhere

    def share(part, whole):
        return round(100 * part / whole, 2) if whole else None

    team_rows = []
    for item in fetched:
        chart = item["chart"]
        slots = {slot: len(chart.get(slot) or []) for slot in SLOTS}
        listed = Counter(aid for rows in chart.values() for _, aid, _ in rows)
        hows = Counter(how for _, how in placements[item["abbr"]].values())
        team_rows.append({
            "team": item["abbr"], "source": item["source"], "complete": all(slots.values()), "slots": slots,
            "players": len(listed), "multiSpot": sum(1 for count in listed.values() if count > 1),
            "placed": {how: hows.get(how, 0) for how in ("listed", "label", "tie")},
            "starters": {slot: (chart.get(slot) or [(0, "", "")])[0][2] for slot in SLOTS},
            "tried": item["tried"],
        })
    complete = sum(1 for row in team_rows if row["complete"])
    stored_dates = [game.get("date") for game in (payload.get("games") or {}).values() if game.get("date")]
    result = {
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "trigger": trigger, "season": season,
        "ok": complete == len(team_rows) == 30,
        "teams": len(team_rows), "teamsComplete": complete,
        "sources": dict(Counter(row["source"] or "none" for row in team_rows)),
        "espnSeconds": espn_seconds, "seconds": round(time.monotonic() - started, 1),
        "stored": {"games": len(payload.get("games") or {}), "players": len(players),
                   "through": max(stored_dates) if stored_dates else None, "builtAt": payload.get("builtAt")},
        "recent": {
            "window": f"each team's last {RECENT_GAMES} games", "playerGames": recent["games"], "minutes": round(recent["minutes"]),
            "onTeamChart": {"playerGames": share(recent["games"] - recent["games:not on chart"], recent["games"]),
                            "minutes": share(recent["minutes"] - recent["minutes:not on chart"], recent["minutes"])},
            "minutesBy": {how: share(recent[f"minutes:{how}"], recent["minutes"]) for how in ("listed", "label", "tie", "not on chart")},
            "notOnChart": [{"player": name, "team": abbr, "minutes": round(minutes)} for (name, abbr), minutes in unmatched.most_common(15)],
        },
        "seasonIds": {"playerGames": season_rows, "onAnyChartToday": share(season_hits, season_rows)},
        "teamRows": team_rows,
        "charts": {abbr: {slot: [aid for _, aid, _ in sorted(rows)] for slot, rows in chart.items()} for abbr, chart in charts.items()},
    }
    _keep(result)
    return result


def _keep(result: dict) -> None:
    from v2.board import store
    try:
        store.set(RESULT_KEY, json.dumps(result), ex=KEEP_SECONDS)
        runs = json.loads(store.get(RUNS_KEY) or "[]")
        runs.insert(0, {key: result[key] for key in ("at", "trigger", "ok", "teamsComplete", "seconds")})
        store.set(RUNS_KEY, json.dumps(runs[:KEEP_RUNS]), ex=KEEP_SECONDS)
    except Exception:  # noqa: BLE001 -- a test result that can't be kept is still returned
        pass


def status() -> dict:
    """The kept result's time and summary, and the last runs (cron, workflow, admin)."""
    from v2.board import store
    try:
        latest = json.loads(store.get(RESULT_KEY) or "null")
        runs = json.loads(store.get(RUNS_KEY) or "[]")
    except Exception as exc:  # noqa: BLE001
        return {"error": type(exc).__name__}
    summary = {key: latest.get(key) for key in ("at", "trigger", "ok", "teamsComplete", "sources", "seconds")} if latest else None
    return {"latest": summary, "runs": runs}


def games_export() -> dict:
    """Every played row of the stored season, for setting SportsDataverse's
    dated charts against our own box scores: rows [game id, date, team,
    athlete id, minutes] and each player's ESPN G / F / C label."""
    season = league.current_season(league="nba")
    payload = league.stored(season, "nba") or {}
    minute = context._I["min"]
    rows = []
    for game in (payload.get("games") or {}).values():
        for team, side in (game.get("t") or {}).items():
            for row in side.get("p") or []:
                if row[minute]:
                    rows.append([game.get("id"), game.get("date"), team, str(row[0]), row[minute]])
    return {"season": season, "rows": rows, "labels": _labels(payload.get("players") or {}),
            "teams": {abbr: info.get("id") for abbr, info in league.team_directory("nba").items()}}
