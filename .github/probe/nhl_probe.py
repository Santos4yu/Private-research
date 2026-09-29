"""One-off check: a cold NHL board load against the live services, done the
way the Finder does it (four teams at a time, waiting out any refusal)."""
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, ".")
import nhl_board  # noqa: E402
import nhl_research as nhl  # noqa: E402

T0 = time.time()
asked = Counter()
real_get = nhl.requests.get
lock = threading.Lock()


def counted(url, *args, **kwargs):
    host = "stats" if "api.nhle.com" in url else "web" if "api-web" in url else "other"
    with lock:
        asked[host] += 1
    return real_get(url, *args, **kwargs)


nhl.requests.get = counted


def say(text):
    print(f"{time.time() - T0:6.1f}s {text}", flush=True)


def patient(label, build, tries=5):
    """As the page does: on a refusal, wait what the server says and ask again."""
    for attempt in range(1, tries + 1):
        try:
            return build()
        except nhl.Busy:
            wait = min(nhl.retry_after(), 65)
            say(f"{label}: busy, waiting {wait}s (try {attempt})")
            time.sleep(wait)
        except Exception as error:  # noqa: BLE001
            say(f"{label}: FAILED {type(error).__name__}: {error}")
            return None
    say(f"{label}: gave up")
    return None


board = patient("board", nhl_board.build)
teams = sorted({(row["team"], row["opponent"]) for row in board["rows"] if row["team"]}) if board else []
say(f"board: {len(board['rows']) if board else 0} rows, {len(teams)} team/opponent pairs, asked {dict(asked)}")


def load(pair):
    log = patient(f"log {pair[0]}", lambda: nhl.team_log(*pair))
    if log:
        say(f"log {pair[0]} vs {pair[1]}: {len(log['games'])} games, complete {log['complete']}, "
            f"{dict(Counter(game['seasonKind'] for game in log['games']))}")
    return log


with ThreadPoolExecutor(max_workers=4) as pool:
    logs = list(pool.map(load, teams))
say(f"logs: {sum(1 for log in logs if log)}/{len(teams)} loaded, asked {dict(asked)}")

first = next((row for row in board["rows"] if row.get("gameId")), None) if board else None
if first:
    game = patient("matchup", lambda: nhl.matchup(first["gameId"], first["homeTeamAbbr"], first["awayTeamAbbr"], first["startsAt"]))
    if game:
        say(f"matchup: {[(team['abbr'], team['record']) for team in game['teams']]} odds {bool(game['odds'])}")
    context = patient("team", lambda: nhl.team_context(first["team"]))
    if context:
        say(f"team {first['team']}: {len(context['injuries'])} injuries, depth {[(row['slot'], len(row['players'])) for row in context['depth']]}")
league = patient("league", nhl.league)
if league:
    say(f"league: {league['teamCount']} teams")
similar = patient("similar", lambda: nhl.similar(first["opponent"], "C", "sog")) if first else None
if similar:
    say(f"similar: {len(similar['entries'])} entries")
say(f"cold load done, asked {dict(asked)}")

# Half an hour on: this season again for every team.
for key in [key for key in nhl._memory if key.startswith(f"nhl:teamrows:{nhl.VERSION}:") and key.endswith(nhl.season_id())]:
    nhl._memory[key] = (time.time() - 3600, nhl._memory[key][1])
before = sum(asked.values())
with ThreadPoolExecutor(max_workers=4) as pool:
    later = list(pool.map(load, teams))
say(f"later: {sum(1 for log in later if log)}/{len(teams)} loaded with {sum(asked.values()) - before} requests")
