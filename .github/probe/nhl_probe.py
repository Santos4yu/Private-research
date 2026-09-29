"""One-off check of the NHL, ESPN and PrizePicks feeds (second pass)."""
import json
import sys
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import requests

sys.path.insert(0, ".")
H = {"Accept": "application/json"}


def cut(value, size=1200):
    text = json.dumps(value, default=str)
    return text if len(text) <= size else text[:size] + " ..."


def strip_links(value):
    if isinstance(value, dict):
        return {k: strip_links(v) for k, v in value.items() if k not in ("link", "links", "logos", "team")}
    if isinstance(value, list):
        return [strip_links(v) for v in value]
    return value


def section(name):
    print(f"\n===== {name}", flush=True)


section("NHL stats REST (bulk per team)")
base = "https://api.nhle.com/stats/rest/en"
for report, extra in (("skater/summary", ""), ("skater/realtime", ""), ("skater/faceoffwins", ""), ("goalie/summary", "")):
    for limit in ("100", "-1"):
        url = (f"{base}/{report}?isAggregate=false&isGame=true&start=0&limit={limit}"
               f"&sort=%5B%7B%22property%22:%22gameDate%22,%22direction%22:%22DESC%22%7D%5D"
               f"&cayenneExp=teamAbbrev=%22BOS%22%20and%20seasonId>=20252026")
        started = time.time()
        try:
            r = requests.get(url, headers=H, timeout=30)
            data = r.json() if r.ok else {}
            rows = data.get("data") or []
            print(f"   {report} limit={limit} -> {r.status_code} {len(r.content)}B {time.time()-started:.1f}s total={data.get('total')} rows={len(rows)}")
            if rows and limit == "100":
                print("   keys", sorted(rows[0]))
                print("   row", cut(rows[0], 900))
        except Exception as error:  # noqa: BLE001
            print(f"   {report} limit={limit} -> {type(error).__name__}: {error}")

section("api-web rate limit")
club = requests.get("https://api-web.nhle.com/v1/club-schedule-season/TOR/20252026", headers=H, timeout=20).json()
ids = [g["id"] for g in club.get("games", []) if g.get("gameState") in ("OFF", "FINAL")]
club2 = requests.get("https://api-web.nhle.com/v1/club-schedule-season/MTL/20252026", headers=H, timeout=20).json()
ids += [g["id"] for g in club2.get("games", []) if g.get("gameState") in ("OFF", "FINAL") and g["id"] not in ids]
urls = [f"https://api-web.nhle.com/v1/gamecenter/{i}/boxscore" for i in ids[:160]]
results = []


def fetch(url):
    started = time.time()
    r = requests.get(url, headers=H, timeout=20)
    return (time.time(), r.status_code, r.headers.get("Retry-After"), dict((k, v) for k, v in r.headers.items() if "rate" in k.lower() or "limit" in k.lower()))


t0 = time.time()
with ThreadPoolExecutor(max_workers=6) as pool:
    for stamp, code, retry, limits in pool.map(fetch, urls):
        results.append((round(stamp - t0, 1), code, retry, limits))
first = next((i for i, row in enumerate(results) if row[1] == 429), None)
print("   requests", len(results), "codes", Counter(r[1] for r in results), "first 429 at", first,
      results[first] if first is not None else "", "elapsed", round(time.time() - t0, 1))
print("   rate headers sample", results[0][3], results[-1][3])
for wait in (5, 15, 30, 60):
    time.sleep(wait)
    r = requests.get(urls[0], headers=H, timeout=20)
    print(f"   after +{wait}s -> {r.status_code} Retry-After={r.headers.get('Retry-After')}", flush=True)

section("ESPN odds and NHL summary")
espn = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl"
board = requests.get(f"{espn}/scoreboard?dates=20260929", headers=H, timeout=20).json()
competition = (board.get("events") or [{}])[0].get("competitions", [{}])[0]
odds = (competition.get("odds") or [{}])[0]
print("   odds keys", sorted(odds))
print("   odds", cut(strip_links(odds), 3000))
done = requests.get(f"{espn}/scoreboard?dates=20260926", headers=H, timeout=20).json()
event = next((e for e in done.get("events") or [] if ((e.get("status") or {}).get("type") or {}).get("completed")), None)
if event:
    summary = requests.get(f"{espn}/summary?event={event['id']}", headers=H, timeout=20).json()
    print("   summary keys", sorted(summary))
    for side in (summary.get("boxscore") or {}).get("players") or []:
        for group in side.get("statistics") or []:
            print("   group", group.get("name"), "labels", group.get("labels"), "keys", group.get("keys"))
            print("   athlete", cut((group.get("athletes") or [{}])[0].get("stats"), 300))
        break

section("PrizePicks NFL and soccer stat names")
from prizepicks_export_core import _fetch_projection_rows  # noqa: E402
for league in ("NFL", "SOCCER"):
    time.sleep(12)
    try:
        rows = _fetch_projection_rows(league=league, force=True)
        stats = Counter(row["stat"] for row in rows if not row.get("combo"))
        print(f"   {league}: {len(rows)} lines, {len(stats)} stats")
        for stat, count in sorted(stats.items()):
            print(f"     {stat!r}: {count}")
    except Exception as error:  # noqa: BLE001
        print(f"   {league}: {type(error).__name__}: {error}")
