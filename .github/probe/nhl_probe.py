"""One-off check of the NHL, ESPN and PrizePicks feeds the Finder reads,
run on GitHub's machines (the build sandbox cannot reach them). Prints
what each source actually returns and how the Finder's code handles it."""
import json
import sys
import time
import traceback
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, ".")
NHL = "https://api-web.nhle.com/v1"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl"


def cut(value, size=900):
    text = json.dumps(value, default=str)
    return text if len(text) <= size else text[:size] + " ..."


def get(url):
    started = time.time()
    try:
        response = requests.get(url, headers={"Accept": "application/json"}, timeout=20)
    except Exception as error:  # noqa: BLE001
        print(f"   GET {url} -> {type(error).__name__}: {error}")
        return None
    print(f"   GET {url} -> {response.status_code} {len(response.content)}B {time.time() - started:.1f}s")
    try:
        return response.json() if response.ok else None
    except ValueError:
        print("   (not JSON)", response.text[:200])
        return None


def step(label, run):
    print(f"\n===== {label}")
    started = time.time()
    try:
        value = run()
        print(f"----- {label}: OK in {time.time() - started:.1f}s")
        return value
    except Exception as error:  # noqa: BLE001
        print(f"----- {label}: FAILED in {time.time() - started:.1f}s: {type(error).__name__}: {error}")
        traceback.print_exc(limit=6)
        return None


def nhl_raw():
    week = get(f"{NHL}/schedule/2026-09-29") or {}
    for day in week.get("gameWeek") or []:
        print("   day", day.get("date"), "games", len(day.get("games") or []))
    first = ((week.get("gameWeek") or [{}])[0].get("games") or [{}])[0]
    print("   schedule game:", cut(first, 700))
    club = get(f"{NHL}/club-schedule-season/BOS/20252026") or {}
    games = club.get("games") or []
    print("   BOS 2025-26 games", len(games), "states", Counter(g.get("gameState") for g in games), "types", Counter(g.get("gameType") for g in games))
    print("   last game:", cut(games[-1] if games else {}, 900))
    club2 = get(f"{NHL}/club-schedule-season/BOS/20262027") or {}
    print("   BOS 2026-27 games", len(club2.get("games") or []), Counter(g.get("gameState") for g in club2.get("games") or []))
    final = [g for g in games if g.get("gameState") in ("OFF", "FINAL")]
    game_id = final[-1]["id"] if final else None
    box = get(f"{NHL}/gamecenter/{game_id}/boxscore") or {}
    print("   box keys", sorted(box))
    print("   box gameState", box.get("gameState"), "gameType", box.get("gameType"), "outcome", box.get("gameOutcome"))
    stats = box.get("playerByGameStats") or {}
    print("   playerByGameStats keys", sorted(stats), "home keys", sorted(stats.get("homeTeam") or {}))
    home = stats.get("homeTeam") or {}
    print("   forward:", cut((home.get("forwards") or [{}])[0], 700))
    print("   goalie:", cut((home.get("goalies") or [{}])[0], 700))
    pbp = get(f"{NHL}/gamecenter/{game_id}/play-by-play") or {}
    plays = pbp.get("plays") or []
    print("   pbp keys", sorted(pbp), "plays", len(plays), Counter(p.get("typeDescKey") for p in plays))
    seen = set()
    for play in plays:
        kind = play.get("typeDescKey")
        if kind in ("faceoff", "hit", "blocked-shot", "shot-on-goal", "goal", "missed-shot") and kind not in seen:
            seen.add(kind)
            print(f"   play {kind}:", cut(play, 700))
    print("   rosterSpot:", cut((pbp.get("rosterSpots") or [{}])[0], 400))
    print("   home/away in pbp:", cut(pbp.get("homeTeam"), 300))
    roster = get(f"{NHL}/roster/BOS/current") or {}
    print("   roster keys", sorted(roster), "first:", cut((roster.get("forwards") or [{}])[0], 500))
    table = get(f"{NHL}/standings/now") or {}
    print("   standings", len(table.get("standings") or []), "first:", cut((table.get("standings") or [{}])[0], 900))
    return [g["id"] for g in final[-20:]]


def burst(ids):
    urls = [f"{NHL}/gamecenter/{i}/{part}" for i in ids for part in ("boxscore", "play-by-play")]

    def fetch(url):
        started = time.time()
        try:
            response = requests.get(url, headers={"Accept": "application/json"}, timeout=20)
            return response.status_code, round(time.time() - started, 1)
        except Exception as error:  # noqa: BLE001
            return type(error).__name__, round(time.time() - started, 1)
    with ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(fetch, urls))
    print("   burst of", len(urls), "statuses", Counter(code for code, _ in results), "slowest", max(t for _, t in results))


def espn_raw():
    injuries = get(f"{ESPN}/injuries") or {}
    print("   injuries keys", sorted(injuries), "teams", len(injuries.get("injuries") or []))
    club = (injuries.get("injuries") or [{}])[0]
    print("   injury team:", cut({k: v for k, v in club.items() if k != "injuries"}, 300))
    print("   injury:", cut((club.get("injuries") or [{}])[0], 1200))
    for path in ("teams/bos/depthcharts", "teams/1/depthcharts", "teams/bos"):
        payload = get(f"{ESPN}/{path}") or {}
        print(f"   {path} keys", sorted(payload))
        charts = payload.get("depthchart") or payload.get("depthCharts") or []
        if charts:
            print("   chart:", cut({k: v for k, v in charts[0].items() if k != "positions"}, 300))
            positions = charts[0].get("positions") or {}
            print("   positions", sorted(positions))
            for key, value in list(positions.items())[:2]:
                print(f"   position {key}:", cut(value, 600))
        if path == "teams/bos":
            print("   team:", cut({k: (payload.get("team") or {}).get(k) for k in ("id", "abbreviation", "displayName")}, 300))
    board = get(f"{ESPN}/scoreboard?dates=20260929") or {}
    events = board.get("events") or []
    print("   scoreboard events", len(events))
    if events:
        competition = (events[0].get("competitions") or [{}])[0]
        print("   competitors:", cut([(c.get("homeAway"), (c.get("team") or {}).get("abbreviation")) for c in competition.get("competitors") or []], 300))
        print("   odds:", cut(competition.get("odds"), 1500))


def ours():
    import nhl_research as nhl
    nhl.store.get = lambda key: None
    nhl.store.set = lambda *a, **k: None
    log = step("team_log BOS vs WPG", lambda: nhl.team_log("BOS", "WPG"))
    if log:
        print("   games", len(log["games"]), "complete", log["complete"], "dates", [g["date"] for g in log["games"]][-8:])
        mcavoy = [g["date"] for g in log["games"] if "8479325" in g["players"]]
        print("   McAvoy games", len(mcavoy), mcavoy[-5:])
    step("team_context BOS", lambda: print("   ", cut(nhl.team_context("BOS"), 1500)))
    games = nhl.schedule_day("2026-09-29")
    print("   schedule games", len(games), cut(games[:2], 500))
    if games:
        step("matchup", lambda: print("   ", cut(nhl.matchup(games[0]["id"]), 1500)))
    step("similar WPG D points", lambda: print("   ", cut(nhl.similar("WPG", "D", "points"), 800)))
    step("league", lambda: print("   teams", len(nhl.league()["teams"])))


def prizepicks():
    from prizepicks_export_core import _fetch_projection_rows
    for league in ("NHL", "MLB", "WNBA", "NFL", "SOCCER"):
        def run(league=league):
            rows = _fetch_projection_rows(league=league, force=True)
            stats = Counter(row["stat"] for row in rows if not row.get("combo"))
            print(f"   {league}: {len(rows)} lines, {len(stats)} stats")
            for stat, count in sorted(stats.items()):
                print(f"     {stat!r}: {count}")
        step(f"PrizePicks {league}", run)


ids = step("NHL feed", nhl_raw) or []
step("NHL burst", lambda: burst(ids))
step("ESPN", espn_raw)
step("Finder code", ours)
step("PrizePicks", prizepicks)
