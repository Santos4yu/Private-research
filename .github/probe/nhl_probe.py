"""One-off check of nhl_research / nhl_board against the live services."""
import base64
import json
import sys
import time
import traceback
import zlib
from collections import Counter

sys.path.insert(0, ".")
import nhl_board  # noqa: E402
import nhl_research as nhl  # noqa: E402

MCAVOY = "8479325"


def timed(label, build):
    started = time.time()
    try:
        value = build()
    except Exception:  # noqa: BLE001
        print(f"== {label}: FAILED after {time.time() - started:.1f}s blocked={ {k: round(v - time.time()) for k, v in nhl._blocked.items()} }")
        traceback.print_exc(limit=2)
        return None
    print(f"== {label}: ok in {time.time() - started:.1f}s")
    return value


board = timed("board", nhl_board.build)
teams = sorted({row["team"] for row in board["rows"] if row["team"]}) if board else ["BOS", "TOR"]
print("   rows", len(board["rows"]) if board else 0, "teams", len(teams))
started = time.time()
for team in teams:
    log = timed(f"log {team}", lambda team=team: nhl.team_log(team))
    if log:
        print("   games", len(log["games"]), "complete", log["complete"], dict(Counter(game["seasonKind"] for game in log["games"])))
print(f"   all logs in {time.time() - started:.1f}s")
for year in ("20252026", "20262027"):
    kept = nhl._memory.get(f"nhl:teamrows:{nhl.VERSION}:BOS:{year}")
    if kept:
        text = json.dumps(kept[1], separators=(",", ":"))
        print(f"   BOS {year}: {len(kept[1]['games'])} games, {len(text) // 1024} KB, zipped {len(base64.b64encode(zlib.compress(text.encode(), 6))) // 1024} KB")
log = timed("log BOS vs TOR again", lambda: nhl.team_log("BOS", "TOR"))
if log:
    mine = [game for game in log["games"] if MCAVOY in game["players"]]
    print("   games", len(log["games"]), "McAvoy", len(mine), "vs TOR", [(game["date"], game["score"]) for game in log["games"] if game["opponent"] == "TOR"])
context = timed("team_context BOS", lambda: nhl.team_context("BOS"))
if context:
    print("   depth", [(row["slot"], [player["name"] for player in row["players"]]) for row in context["depth"]])
data = timed("league", nhl.league)
if data:
    print("   teams", data["teamCount"])
similar = timed("similar TOR C sog", lambda: nhl.similar("TOR", "C", "sog"))
if similar:
    print("   entries", len(similar["entries"]))
print("   blocked", {k: round(v - time.time()) for k, v in nhl._blocked.items()})
# Half an hour on: this season again, one request a team when nothing new was played.
for key in [key for key in nhl._memory if key.startswith(f"nhl:teamrows:{nhl.VERSION}:") and key.endswith("20262027")]:
    nhl._memory[key] = (time.time() - 3600, nhl._memory[key][1])
calls = []
real = nhl._stats
nhl._stats = lambda *args, **kwargs: calls.append(args[0]) or real(*args, **kwargs)
started = time.time()
for team in teams:
    timed(f"log {team} later", lambda team=team: nhl.team_log(team))
print(f"   later: {len(calls)} requests {Counter(calls)} in {time.time() - started:.1f}s")
