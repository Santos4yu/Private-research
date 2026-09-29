"""One-off check: how the NHL's stats service and game feed limit requests."""
import time
import urllib.parse

import requests

H = {"Accept": "application/json"}
STATS = "https://api.nhle.com/stats/rest/en"
WEB = "https://api-web.nhle.com/v1"
T0 = time.time()


def stats(team):
    cay = urllib.parse.quote(f'teamAbbrev="{team}" and seasonId=20252026')
    return f"{STATS}/team/summary?isAggregate=false&isGame=true&start=0&limit=-1&cayenneExp={cay}"


def ask(url, label):
    started = time.time()
    try:
        r = requests.get(url, headers=H, timeout=30)
    except Exception as error:  # noqa: BLE001
        print(f"{time.time() - T0:6.1f}s {label}: {type(error).__name__}")
        return None
    keep = {k: v for k, v in r.headers.items() if any(w in k.lower() for w in ("retry", "rate", "limit", "server", "cf-", "age", "cache", "x-"))}
    print(f"{time.time() - T0:6.1f}s {label}: {r.status_code} in {time.time() - started:.2f}s {keep if r.status_code != 200 else ''}")
    return r.status_code


print("-- first asks")
for label, url in (("stats", stats("BOS")), ("web", f"{WEB}/standings/now")):
    ask(url, label)
teams = ["ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ", "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH",
         "NJD", "NYI", "NYR", "OTT", "PHI", "PIT", "SJS", "SEA", "STL", "TBL", "TOR", "UTA", "VAN", "VGK", "WSH", "WPG"]
print("-- stats until refused (max 150)")
refused_at = None
for index in range(150):
    code = ask(stats(teams[index % 32]), f"stats #{index + 1}")
    if code == 429:
        refused_at = index + 1
        break
print("-- game feed while the stats service refuses")
ask(f"{WEB}/standings/now", "web")
ask(f"{WEB}/roster/BOS/current", "web roster")
if refused_at:
    print("-- waiting for the stats service")
    for _ in range(40):
        time.sleep(15)
        if ask(stats("BOS"), "stats retry") == 200:
            break
print("-- game feed until refused (max 80)")
for index in range(80):
    if ask(f"{WEB}/roster/{teams[index % 32]}/current", f"web #{index + 1}") == 429:
        ask(stats("BOS"), "stats while the feed refuses")
        break
print(f"done in {time.time() - T0:.0f}s")
