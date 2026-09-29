"""One-off check of the NHL stats service (third pass)."""
import json
import time
import urllib.parse

import requests

H = {"Accept": "application/json"}
BASE = "https://api.nhle.com/stats/rest/en"


def cut(value, size=1400):
    text = json.dumps(value, default=str)
    return text if len(text) <= size else text[:size] + " ..."


def query(report, cayenne, game=True, limit="-1"):
    url = f"{BASE}/{report}?isAggregate=false&isGame={'true' if game else 'false'}&start=0&limit={limit}&cayenneExp={urllib.parse.quote(cayenne)}"
    started = time.time()
    r = requests.get(url, headers=H, timeout=40)
    data = r.json() if r.ok else {}
    rows = data.get("data") or []
    print(f"   {report} [{cayenne}] -> {r.status_code} {len(r.content)}B {time.time()-started:.1f}s total={data.get('total')} rows={len(rows)}")
    if not r.ok:
        print("   body", r.text[:300])
    return rows


for cayenne in ('teamAbbrev="BOS" and seasonId>=20252026', 'franchiseId=6 and seasonId>=20252026', 'teamId=6 and seasonId>=20252026'):
    rows = query("team/summary", cayenne)
    if rows:
        print("   keys", sorted(rows[0]))
        print("   row", cut(rows[0], 1200))
        break
rows = query("team/realtime", 'teamId=6 and seasonId>=20252026')
if rows:
    print("   keys", sorted(rows[0]))
rows = query("team/faceoffpercentages", 'teamId=6 and seasonId>=20252026')
if rows:
    print("   keys", sorted(rows[0]))
rows = query("team/summary", 'seasonId=20252026 and gameTypeId=2')
print("   league team rows", len(rows))
for days in (21, 45):
    since = time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400))
    query("skater/summary", f'gameDate>="{since}"')
query("skater/summary", 'seasonId=20252026 and gameTypeId=2 and gameDate>="2026-03-15"')
rows = query("skater/summary", 'seasonId>=20252026', game=False)
if rows:
    print("   season row", cut(rows[0], 600))
rows = query("goalie/summary", 'seasonId>=20252026', game=False)
print("   goalie season rows", len(rows))
print("\n===== PrizePicks soccer")
time.sleep(45)
import sys  # noqa: E402
sys.path.insert(0, ".")
from collections import Counter  # noqa: E402
from prizepicks_export_core import _fetch_projection_rows  # noqa: E402
try:
    lines = _fetch_projection_rows(league="SOCCER", force=True)
    stats = Counter(row["stat"] for row in lines if not row.get("combo"))
    print(f"   SOCCER: {len(lines)} lines, {len(stats)} stats")
    for stat, count in sorted(stats.items()):
        print(f"     {stat!r}: {count}")
except Exception as error:  # noqa: BLE001
    print("   SOCCER:", type(error).__name__, error)
