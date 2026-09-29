"""One-off check of the NHL stats service (fourth pass): preseason games."""
import time
import urllib.parse

import requests

H = {"Accept": "application/json"}
BASE = "https://api.nhle.com/stats/rest/en"


def query(report, cayenne):
    url = f"{BASE}/{report}?isAggregate=false&isGame=true&start=0&limit=-1&cayenneExp={urllib.parse.quote(cayenne)}"
    r = requests.get(url, headers=H, timeout=40)
    rows = (r.json() if r.ok else {}).get("data") or []
    print(f"   {report} [{cayenne}] -> {r.status_code} rows={len(rows)} dates={sorted({row.get('gameDate') for row in rows})[-6:]}")
    return rows


query("skater/summary", 'teamAbbrev="BOS" and seasonId=20262027 and gameTypeId=1')
query("skater/summary", 'teamAbbrev="BOS" and seasonId>=20252026 and gameTypeId>=1')
query("skater/summary", 'teamAbbrev="BOS" and seasonId=20252026 and gameTypeId=1')
query("goalie/summary", 'teamAbbrev="BOS" and seasonId=20262027 and gameTypeId=1')
rows = query("team/summary", 'teamAbbrev="BOS" and seasonId>=20252026 and gameTypeId>=1')
shootout = [row for row in rows if row.get("winsInShootout") or row.get("otLosses")][:4]
for row in shootout:
    print("   OT/SO row", row["gameId"], row["gameDate"], row["goalsFor"], row["goalsAgainst"], "W", row["wins"], "SOW", row["winsInShootout"], "OTL", row["otLosses"])
club = requests.get("https://api-web.nhle.com/v1/club-schedule-season/BOS/20252026", headers=H, timeout=20).json()
by_id = {g["id"]: g for g in club.get("games", [])}
for row in shootout:
    game = by_id.get(row["gameId"]) or {}
    print("   club", row["gameId"], (game.get("awayTeam") or {}).get("abbrev"), (game.get("awayTeam") or {}).get("score"),
          (game.get("homeTeam") or {}).get("abbrev"), (game.get("homeTeam") or {}).get("score"), game.get("gameOutcome"))
