"""One-off check of nhl_research / nhl_board against the live services."""
import sys
import time
import traceback
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
        print(f"== {label}: FAILED after {time.time() - started:.1f}s")
        traceback.print_exc()
        return None
    print(f"== {label}: ok in {time.time() - started:.1f}s (feed blocked: {nhl._web_blocked[0] > time.time()})")
    return value


log = timed("team_log BOS vs TOR", lambda: nhl.team_log("BOS", "TOR"))
if log:
    games = log["games"]
    print("   games", len(games), "complete", log["complete"], Counter(game["seasonKind"] for game in games))
    print("   first", games[0]["date"], games[0]["score"], "last", games[-1]["date"], games[-1]["opponent"], games[-1]["score"])
    print("   scores", [game["score"] for game in games[-12:]])
    mine = [game for game in games if MCAVOY in game["players"]]
    print("   McAvoy games", len(mine), "last line", mine[-1]["players"][MCAVOY] if mine else None)
    print("   McAvoy info", log["players"].get(MCAVOY))
    print("   vs TOR", [(game["date"], game["score"]) for game in games if game["opponent"] == "TOR"])
    print("   totals", games[-1]["totals"], games[-1]["against"])
for team in ("TOR", "CAR", "FLA"):
    again = timed(f"team_log {team}", lambda team=team: nhl.team_log(team))
    if again:
        print("   games", len(again["games"]), "complete", again["complete"], Counter(game["seasonKind"] for game in again["games"]))
again = timed("team_log BOS again", lambda: nhl.team_log("BOS", "TOR"))
if again:
    print("   games", len(again["games"]), "complete", again["complete"], Counter(game["seasonKind"] for game in again["games"]))

context = timed("team_context BOS", lambda: nhl.team_context("BOS"))
if context:
    print("   injuries", [(item["name"], item["status"], item["id"]) for item in context["injuries"]])
    print("   depth", [(row["slot"], [player["name"] for player in row["players"]]) for row in context["depth"]])
    print("   errors", {key: value for key, value in context.items() if key.endswith("Error")})

table = timed("standings", nhl.standings)
if table:
    print("   teams", len(table), table.get("BOS"))
rows = timed("stats standings", lambda: nhl._stats("team/summary", "seasonId=20252026 and gameTypeId=2", game=False))
if rows:
    print("   rows", len(rows), "mapped", len({nhl._team_code(row) for row in rows} & set(nhl.TEAMS)),
          "unmapped", [row.get("teamFullName") for row in rows if nhl._team_code(row) not in nhl.TEAMS])

people = timed("directory", nhl.directory)
if people:
    print("   players", len(people), people.get(MCAVOY), Counter(player["team"] for player in people.values()).most_common(3))

data = timed("league", nhl.league)
if data:
    print("   teams", data["teamCount"], "BOS sog", data["teams"]["BOS"]["off"]["sog"], "def", data["teams"]["BOS"]["def"]["sog"])
    print("   BOS vs C goals", data["dvp"]["BOS"].get("C", {}).get("goals"), "G saves", data["dvp"]["BOS"].get("G", {}).get("saves"))
    print("   ranks fow l20", sorted((value["off"]["fow"]["l20"][1], code) for code, value in data["teams"].items())[:4])

similar = timed("similar TOR C sog", lambda: nhl.similar("TOR", "C", "sog"))
if similar:
    print("   ", [(entry["name"], entry["team"], entry["date"], entry["value"], entry["avg"]) for entry in similar["entries"][:6]])

board = timed("board", nhl_board.build)
if board:
    rows = board["rows"]
    print("   rows", len(rows), "players matched", sum(1 for row in rows if row["playerId"]), "games", sum(1 for row in rows if row.get("gameId")))
    print("   unmatched", sorted({(row["player"], row["team"]) for row in rows if not row["playerId"]})[:15])
    print("   stats", Counter(row["stat"] for row in rows), "unmapped", Counter(row["stat"] for row in rows if not row["valueKey"]))
    first = next((row for row in rows if row.get("gameId")), None)
    if first:
        game = timed(f"matchup {first['gameId']}", lambda: nhl.matchup(first["gameId"], first["homeTeamAbbr"], first["awayTeamAbbr"], first["startsAt"]))
        if game:
            print("   ", game["game"], [(team["abbr"], team["record"]) for team in game["teams"]], game["odds"])
            print("   last five", {code: [item["score"] for item in items] for code, items in game["lastFive"].items()})
    if rows:
        team = rows[0]["team"]
        started = time.time()
        logs = timed(f"logs for the board's teams ({len({row['team'] for row in rows})})",
                     lambda: {code: nhl.team_log(code)["complete"] for code in sorted({row["team"] for row in rows if row["team"]})})
        print("   ", logs)
