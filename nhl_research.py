"""NHL research for the Finder.

Where the numbers come from:

* The NHL's stats service (api.nhle.com/stats/rest): every player's line in
  every regular season and playoff game -- goals, assists, points, shots on
  goal, shot attempts, hits, blocks, penalty minutes, time on ice, power-play
  and shorthanded points, faceoffs won and lost; a goalie's saves, shots
  faced and goals allowed -- and each team's result. A team's two seasons are
  five requests.
* The NHL's game feed (api-web.nhle.com): the schedule, standings, rosters
  and preseason box scores (the stats service has no preseason). It answers
  about fifty requests a minute and then refuses for a minute, so it is used
  for little, cached, and left alone while it is refusing.
* ESPN: the injury report and each game's odds.

What it serves the Finder:

* team_log() -- a team's recent games (this season and last, preseason and
  playoffs included) with each of its players' lines: the board's hit rates,
  the player page's chart, game log and splits.
* team_context() -- injuries and the depth chart (by recent ice time).
* matchup() -- both teams' records, last five games and the game's odds.
* league() -- every team's per-game numbers for and against over its last 20
  games, ranked, and what each defense allows by position.
* similar() -- other players at a position in their games against a team.
"""
import json
import re
import threading
import time
import unicodedata
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

from v2.board import store

NHL = "https://api-web.nhle.com/v1"
STATS = "https://api.nhle.com/stats/rest/en"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl"
VERSION = "nhl-v2"
LOG_GAMES = 40
ID = re.compile(r"^\d{1,12}$")
HEADERS = {"Accept": "application/json"}

TEAMS = {
    "ANA": "Anaheim Ducks", "BOS": "Boston Bruins", "BUF": "Buffalo Sabres", "CGY": "Calgary Flames",
    "CAR": "Carolina Hurricanes", "CHI": "Chicago Blackhawks", "COL": "Colorado Avalanche", "CBJ": "Columbus Blue Jackets",
    "DAL": "Dallas Stars", "DET": "Detroit Red Wings", "EDM": "Edmonton Oilers", "FLA": "Florida Panthers",
    "LAK": "Los Angeles Kings", "MIN": "Minnesota Wild", "MTL": "Montreal Canadiens", "NSH": "Nashville Predators",
    "NJD": "New Jersey Devils", "NYI": "New York Islanders", "NYR": "New York Rangers", "OTT": "Ottawa Senators",
    "PHI": "Philadelphia Flyers", "PIT": "Pittsburgh Penguins", "SJS": "San Jose Sharks", "SEA": "Seattle Kraken",
    "STL": "St. Louis Blues", "TBL": "Tampa Bay Lightning", "TOR": "Toronto Maple Leafs", "UTA": "Utah Mammoth",
    "VAN": "Vancouver Canucks", "VGK": "Vegas Golden Knights", "WSH": "Washington Capitals", "WPG": "Winnipeg Jets",
}
# The same club under the codes PrizePicks, ESPN and older feeds use.
ALIASES = {"LA": "LAK", "NJ": "NJD", "SJ": "SJS", "TB": "TBL", "WAS": "WSH", "MON": "MTL", "UTAH": "UTA", "ARI": "UTA",
           "PHX": "UTA", "VEG": "VGK", "LV": "VGK", "CLS": "CBJ", "CLB": "CBJ", "NAS": "NSH", "CAL": "CGY", "WIN": "WPG",
           "WPJ": "WPG", "MTR": "MTL"}
DIVISIONS = {
    "Atlantic": ("BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"),
    "Metropolitan": ("CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"),
    "Central": ("CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"),
    "Pacific": ("ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"),
}
KIND = {1: "preseason", 2: "regular", 3: "postseason"}
# The NHL's position codes as the Finder shows them.
POSITION_NAMES = {"L": "LW", "R": "RW"}

# PrizePicks' NHL Fantasy Score. Skaters: 8 a goal, 5 an assist, 1.5 a shot
# on goal and a blocked shot, 2 more for a shorthanded point and 3 for a hat
# trick. Goalies: 6 a win, 0.6 a save, -3 a goal allowed, 4 for a shutout.
SKATER_FANTASY = {"goals": 8, "assists": 5, "sog": 1.5, "blocked": 1.5, "shp": 2}
HAT_TRICK = 3
GOALIE_FANTASY = {"win": 6, "saves": 0.6, "ga": -3, "shutout": 4}

_memory = {}
_lock = threading.Lock()


# ---------------------------------------------------------------- plumbing

class Busy(RuntimeError):
    """The NHL's game feed is refusing requests for now."""


# When the game feed may be asked again (it names the wait when it refuses).
_web_blocked = [0.0]


def _get(url, timeout=20, attempts=3):
    """One JSON read. A server hiccup (5xx, a dropped connection) is asked
    again after a short pause."""
    for attempt in range(attempts):
        try:
            response = requests.get(url, headers=HEADERS, timeout=timeout)
        except (requests.ConnectionError, requests.Timeout):
            if attempt == attempts - 1:
                raise
        else:
            if response.status_code < 500 or attempt == attempts - 1:
                response.raise_for_status()
                return response.json()
        time.sleep(0.6 * (attempt + 1))
    raise RuntimeError("unreachable")


def _web(path, timeout=12):
    """One read from the NHL's game feed. Once it refuses (429), nothing more
    is asked of it until the wait it names has passed."""
    if time.time() < _web_blocked[0]:
        raise Busy(path)
    response = requests.get(f"{NHL}{path}", headers=HEADERS, timeout=timeout)
    if response.status_code == 429:
        _web_blocked[0] = time.time() + (_num(response.headers.get("Retry-After")) or 60)
        raise Busy(path)
    response.raise_for_status()
    return response.json()


def _stats(report, cayenne, game=True):
    """Every row of one stats-service report that matches `cayenne`."""
    url = (f"{STATS}/{report}?isAggregate=false&isGame={'true' if game else 'false'}&start=0&limit=-1"
           f"&cayenneExp={urllib.parse.quote(cayenne)}")
    return (_get(url, timeout=40) or {}).get("data") or []


def _peek(key):
    """A stored value (memory, then KV) whatever its age: (stored at, value) or None."""
    with _lock:
        hit = _memory.get(key)
    if hit:
        return hit
    try:
        raw = store.get(key)
        envelope = json.loads(raw) if raw else None
    except Exception:
        return None
    if not envelope or "value" not in envelope:
        return None
    found = (float(envelope.get("at", 0)), envelope["value"])
    with _lock:
        _memory[key] = found
    return found


def _cached(key, seconds, build, *, keep=None, durable=True, stale=0):
    """build(), kept in memory (and in KV when `durable`) for `seconds`.
    `keep(value)` says whether a value may be stored at all. With `stale`,
    a value up to that many seconds old stands in when build() fails."""
    now = time.time()
    with _lock:
        hit = _memory.get(key)
    if hit and now - hit[0] < seconds:
        return hit[1]
    old = hit
    if durable:
        found = _peek(key) if not hit else None
        if found and now - found[0] < seconds:
            return found[1]
        old = old or found
    try:
        value = build()
    except Exception:
        if stale and old and now - old[0] < stale:
            return old[1]
        raise
    if keep is None or keep(value):
        with _lock:
            _memory[key] = (now, value)
            if len(_memory) > 3000:
                for gone in sorted(_memory, key=lambda item: _memory[item][0])[:800]:
                    _memory.pop(gone, None)
        if durable:
            try:
                store.set(key, json.dumps({"at": now, "value": value}, separators=(",", ":")), ex=int(max(seconds, stale)))
            except Exception:
                pass
    return value


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


def _text(value):
    """The game feed's names come as {"default": "..."}."""
    if isinstance(value, dict):
        return str(value.get("default") or "")
    return str(value or "")


def _num(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def canonical(code):
    code = str(code or "").strip().upper()
    return ALIASES.get(code, code)


def valid_team(code):
    return canonical(code) in TEAMS


def valid_id(value):
    return bool(ID.match(str(value or "")))


def logo(team):
    team = canonical(team)
    return f"https://assets.nhle.com/logos/nhl/svg/{team}_dark.svg" if team else ""


def mug(season, team, player_id):
    """The NHL's headshot for a player in a season's team photo."""
    return f"https://assets.nhle.com/mugs/nhl/{season}/{canonical(team)}/{player_id}.png" if season and team and player_id else ""


def season_id(day=None):
    """The NHL season a day falls in ("20262027" from August 2026 on)."""
    day = day or datetime.now(timezone.utc).date()
    start = day.year if day.month >= 8 else day.year - 1
    return f"{start}{start + 1}"


def previous_season(season):
    start = int(str(season)[:4]) - 1
    return f"{start}{start + 1}"


def season_of(game_id):
    """A game id starts with its season's first year: 2025020426 -> "20252026"."""
    start = int(str(game_id)[:4])
    return f"{start}{start + 1}"


def kind_of(game_id):
    """Its fifth and sixth digits are the game type: 01 preseason, 02
    regular season, 03 playoffs."""
    digits = str(game_id)[4:6]
    return KIND.get(int(digits), "other") if digits.isdigit() else "other"


def _minutes(clock):
    """"17:23" -> 17.38 minutes."""
    try:
        minutes, seconds = str(clock).split(":")
        return round(int(minutes) + int(seconds) / 60, 2)
    except (TypeError, ValueError):
        return None


def _mean(values):
    values = [value for value in values if isinstance(value, (int, float))]
    return round(sum(values) / len(values), 2) if values else None


def _team_code(row):
    """A stats-service row's club: its code, or its full name looked up."""
    if row.get("teamAbbrev"):
        return canonical(row["teamAbbrev"])
    wanted = _norm(row.get("teamFullName"))
    return next((code for code, name in TEAMS.items() if _norm(name) == wanted), "")


# ---------------------------------------------------------------- player lines

def _skater(summary, realtime=None, faceoffs=None):
    """One skater's game from the stats service's summary, real-time
    (hits, blocks, shot attempts) and faceoff rows."""
    toi = _num(summary.get("timeOnIcePerGame"))
    line = {"goals": _num(summary.get("goals")) or 0, "assists": _num(summary.get("assists")) or 0,
            "points": _num(summary.get("points")) or 0, "sog": _num(summary.get("shots")) or 0,
            "pim": _num(summary.get("penaltyMinutes")) or 0, "plus_minus": _num(summary.get("plusMinus")) or 0,
            "ppg": _num(summary.get("ppGoals")) or 0, "ppp": _num(summary.get("ppPoints")) or 0,
            "shp": _num(summary.get("shPoints")) or 0, "toi": round(toi / 60, 2) if toi is not None else None}
    if realtime:
        line.update(hits=_num(realtime.get("hits")) or 0, blocked=_num(realtime.get("blockedShots")) or 0,
                    attempts=_num(realtime.get("totalShotAttempts")))
    # The faceoff report leaves out players who took none.
    faceoffs = faceoffs or {}
    line.update(fow=_num(faceoffs.get("totalFaceoffWins")) or 0, fol=_num(faceoffs.get("totalFaceoffLosses")) or 0,
                faceoffs=_num(faceoffs.get("totalFaceoffs")) or 0)
    return _finish_skater(line)


def _finish_skater(line):
    """Hits + blocks and the fantasy score, once a line has what they need."""
    if isinstance(line.get("hits"), (int, float)) and isinstance(line.get("blocked"), (int, float)):
        line["hits_blocks"] = line["hits"] + line["blocked"]
        if isinstance(line.get("shp"), (int, float)):
            fantasy = sum((line.get(key) or 0) * weight for key, weight in SKATER_FANTASY.items())
            line["fantasy"] = round(fantasy + (HAT_TRICK if line["goals"] >= 3 else 0), 2)
    return line


def _goalie(row):
    """One goalie's game from the stats service's goalie row."""
    toi = _num(row.get("timeOnIce"))
    return _finish_goalie({
        "saves": _num(row.get("saves")) or 0, "shots_against": _num(row.get("shotsAgainst")) or 0,
        "ga": _num(row.get("goalsAgainst")) or 0, "toi": round(toi / 60, 2) if toi is not None else None,
        "starter": bool(row.get("gamesStarted")), "win": 1 if row.get("wins") else 0,
        "shutout": 1 if row.get("shutouts") else 0,
        "decision": "W" if row.get("wins") else "O" if row.get("otLosses") else "L" if row.get("losses") else ""})


def _finish_goalie(line):
    line["fantasy"] = round(sum((line.get(key) or 0) * weight for key, weight in GOALIE_FANTASY.items()), 2)
    return line


def _played(row):
    """A goalie row for a game he actually went into."""
    return bool(row.get("timeOnIce") or row.get("shotsAgainst"))


def _result(row):
    """(result, score, extra) from a team's per-game row. The stats service
    leaves the shootout goal out of the score, so a shootout reads as a tie
    there; the final score counts it."""
    own, other = _num(row.get("goalsFor")), _num(row.get("goalsAgainst"))
    if own is None or other is None:
        return None, "", ""
    extra = ""
    if row.get("winsInShootout"):
        own, extra = own + 1, "SO"
    elif row.get("otLosses") and own == other:
        other, extra = other + 1, "SO"
    elif row.get("otLosses") or (row.get("wins") and not row.get("winsInRegulation")):
        extra = "OT"
    return ("W" if own > other else "L"), f"{own}-{other}{' ' + extra if extra else ''}", extra


def _index(rows):
    return {(str(row.get("gameId")), str(row.get("playerId"))): row for row in rows}


# ---------------------------------------------------------------- team games

TEAM_STATS = ("goals", "assists", "points", "sog", "hits", "blocked", "pim", "fow", "fol", "ppp", "attempts", "fantasy")


def _team_rows(team, season):
    """The team's regular season and playoff games this season and last from
    the stats service: {"games": [...], "players": {id: {name, pos, shoots}}}.
    Kept in memory only (two seasons of lines are large); they are five quick
    requests to build again."""
    def build():
        where = f'teamAbbrev="{team}" and seasonId>={previous_season(season)}'
        reports = ("team/summary", "skater/summary", "skater/realtime", "skater/faceoffwins", "goalie/summary")
        with ThreadPoolExecutor(max_workers=len(reports)) as pool:
            results, summary, realtime, faceoffs, goalies = pool.map(lambda report: _stats(report, where), reports)
        games, players = {}, {}
        for row in results:
            game_id = str(row.get("gameId") or "")
            if not game_id:
                continue
            result, score, extra = _result(row)
            games[game_id] = {"gameId": game_id, "season": season_of(game_id), "seasonKind": kind_of(game_id),
                              "date": str(row.get("gameDate") or "")[:10], "team": team,
                              "opponent": canonical(row.get("opponentTeamAbbrev")), "isHome": row.get("homeRoad") == "H",
                              "result": result, "score": score, "extra": extra, "players": {},
                              "totals": {"goals": _num(row.get("goalsFor")), "sog": _num(row.get("shotsForPerGame"))},
                              "against": {"goals": _num(row.get("goalsAgainst")), "sog": _num(row.get("shotsAgainstPerGame"))}}
        extras, faceoff_rows = _index(realtime), _index(faceoffs)
        for row in summary:
            key = (str(row.get("gameId")), str(row.get("playerId")))
            if key[0] not in games:
                continue
            games[key[0]]["players"][key[1]] = _skater(row, extras.get(key), faceoff_rows.get(key))
            players[key[1]] = {"name": row.get("skaterFullName") or "", "pos": row.get("positionCode") or "",
                               "shoots": row.get("shootsCatches") or "", "season": season_of(key[0])}
        for row in goalies:
            game_id, pid = str(row.get("gameId")), str(row.get("playerId"))
            if game_id in games and _played(row):
                games[game_id]["players"][pid] = _goalie(row)
                players[pid] = {"name": row.get("goalieFullName") or "", "pos": "G", "shoots": row.get("shootsCatches") or "",
                                "season": season_of(game_id)}
        for game in games.values():
            game["totals"] = {**_sum_lines(game["players"]), **game["totals"]}
        return {"games": list(games.values()), "players": players}
    return _cached(f"nhl:teamrows:{VERSION}:{team}:{season}", 20 * 60, build, durable=False)


def team_games(team, day=None):
    """A team's games this season and last, oldest first, each with every one
    of its players' lines: regular season and playoffs from the stats
    service, this preseason from the game feed's box scores."""
    team, season = canonical(team), season_id(day)
    rows = _team_rows(team, season)
    players = {pid: dict(info) for pid, info in rows["players"].items()}
    preseason, complete = _preseason_games(team, season, players)
    games = sorted(rows["games"] + preseason, key=lambda game: (game["date"], game["gameId"]))
    return {"team": team, "games": games, "players": players, "complete": complete}


def _sum_lines(lines):
    totals = {}
    for line in lines.values():
        if "saves" in line:
            continue
        for key in TEAM_STATS:
            value = line.get(key)
            if isinstance(value, (int, float)):
                totals[key] = round(totals.get(key, 0) + value, 2)
    return totals


# ---------------------------------------------------------------- preseason

def _club_schedule(team, season):
    """The team's games in a season from the game feed."""
    def build():
        try:
            payload = _web(f"/club-schedule-season/{team}/{season}")
        except requests.HTTPError as error:
            if error.response is not None and error.response.status_code == 404:
                return []
            raise
        return [{"id": str(item.get("id")), "gameType": int(item.get("gameType") or 0),
                 "date": str(item.get("gameDate") or "")[:10],
                 "final": str(item.get("gameState") or "").upper() in ("OFF", "FINAL")}
                for item in payload.get("games") or []]
    return _cached(f"nhl:club:{VERSION}:{team}:{season}", 3 * 3600, build, stale=7 * 24 * 3600)


# Box scores read per request at most, so a cold start stays well inside the
# game feed's allowance; the rest come on the next look.
PRESEASON_PER_CALL = 6
FOREVER = 400 * 24 * 3600


def _preseason_games(team, season, players):
    """This season's finished preseason games from the game feed's box
    scores (each kept for good once read): (games, complete)."""
    try:
        schedule = [item for item in _club_schedule(team, season) if item["gameType"] == 1 and item["final"]]
    except Exception:  # noqa: BLE001 -- busy or failing: the preseason comes on a later look
        return [], False
    games, missing, fetched = [], 0, 0
    for item in schedule:
        key = f"nhl:box:{VERSION}:{item['id']}"
        found = _peek(key)
        record = found[1] if found else None
        if record is None:
            if fetched >= PRESEASON_PER_CALL or time.time() < _web_blocked[0]:
                missing += 1
                continue
            fetched += 1
            try:
                record = _cached(key, FOREVER, lambda item=item: parse_box(_web(f"/gamecenter/{item['id']}/boxscore")),
                                 keep=lambda value: value["final"])
            except Exception:  # noqa: BLE001 -- busy, or this one game failing
                missing += 1
                continue
        if record["final"]:
            games.append(_box_view(record, team, players))
    return games, missing == 0


def parse_box(box):
    """A game-feed box score -> both teams' lines. It has no power-play
    points, shot attempts or faceoff counts, so those stay blank."""
    home, away = box.get("homeTeam") or {}, box.get("awayTeam") or {}
    record = {"id": str(box.get("id")), "date": str(box.get("gameDate") or "")[:10],
              "home": canonical(home.get("abbrev")), "away": canonical(away.get("abbrev")),
              "homeScore": _num(home.get("score")), "awayScore": _num(away.get("score")),
              "homeSog": _num(home.get("sog")), "awaySog": _num(away.get("sog")),
              "lastPeriod": ((box.get("gameOutcome") or {}).get("lastPeriodType") or ""),
              "final": str(box.get("gameState") or "").upper() in ("OFF", "FINAL"), "lines": {}}
    stats = box.get("playerByGameStats") or {}
    for side, code in (("homeTeam", record["home"]), ("awayTeam", record["away"])):
        groups = stats.get(side) or {}
        for group in ("forwards", "defense"):
            for skater in groups.get(group) or []:
                pid = str(skater.get("playerId") or "")
                if not pid:
                    continue
                line = _finish_skater({
                    "goals": _num(skater.get("goals")) or 0, "assists": _num(skater.get("assists")) or 0,
                    "points": _num(skater.get("points")) or 0, "sog": _num(skater.get("sog", skater.get("shots"))) or 0,
                    "hits": _num(skater.get("hits")) or 0, "blocked": _num(skater.get("blockedShots")) or 0,
                    "pim": _num(skater.get("pim")) or 0, "ppg": _num(skater.get("powerPlayGoals")) or 0,
                    "plus_minus": _num(skater.get("plusMinus")) or 0, "toi": _minutes(skater.get("toi"))})
                record["lines"][pid] = {"team": code, "name": _text(skater.get("name")), "pos": skater.get("position") or "", "line": line}
        for goalie in groups.get("goalies") or []:
            pid = str(goalie.get("playerId") or "")
            made, _, faced = str(goalie.get("saveShotsAgainst") or "").partition("/")
            toi = _minutes(goalie.get("toi"))
            saves = _num(goalie.get("saves")) if goalie.get("saves") is not None else _num(made)
            against = _num(goalie.get("shotsAgainst")) if goalie.get("shotsAgainst") is not None else _num(faced)
            if not pid or (not toi and not against):
                continue  # dressed as the backup, never went in
            ga = _num(goalie.get("goalsAgainst")) or 0
            won = goalie.get("decision") == "W"
            record["lines"][pid] = {"team": code, "name": _text(goalie.get("name")), "pos": "G", "line": _finish_goalie({
                "saves": saves or 0, "shots_against": against or 0, "ga": ga, "toi": toi, "starter": bool(goalie.get("starter")),
                "win": 1 if won else 0, "shutout": 1 if won and ga == 0 and (toi or 0) >= 59 else 0,
                "decision": goalie.get("decision") or ""})}
    return record


def _box_view(record, team, players):
    """A preseason box score from `team`'s side, in the team log's shape."""
    home = record["home"] == team
    own, other = (record["homeScore"], record["awayScore"])[:: 1 if home else -1]
    sog, sog_against = (record.get("homeSog"), record.get("awaySog"))[:: 1 if home else -1]
    extra = record["lastPeriod"] if record["lastPeriod"] in ("OT", "SO") else ""
    lines = {}
    for pid, entry in record["lines"].items():
        if entry["team"] != team:
            continue
        lines[pid] = dict(entry["line"])
        players.setdefault(pid, {"name": entry["name"], "pos": entry["pos"], "shoots": "", "season": season_of(record["id"])})
    scored = own is not None and other is not None
    return {"gameId": record["id"], "season": season_of(record["id"]), "seasonKind": "preseason", "date": record["date"],
            "team": team, "opponent": record["away"] if home else record["home"], "isHome": home,
            "result": ("W" if own > other else "L") if scored else None,
            "score": f"{own}-{other}{' ' + extra if extra else ''}" if scored else "", "extra": extra, "players": lines,
            "totals": {**_sum_lines(lines), "goals": own, "sog": sog}, "against": {"goals": other, "sog": sog_against}}


# ---------------------------------------------------------------- team log

def team_log(team, opponent=None, day=None):
    """The team's last LOG_GAMES games plus every game against `opponent`
    this season and last, with each of its players' lines."""
    team, opponent = canonical(team), canonical(opponent) if opponent else None
    built = team_games(team, day)
    games = built["games"]
    chosen = games[-LOG_GAMES:]
    if opponent:
        ids = {game["gameId"] for game in chosen}
        chosen = sorted([game for game in games if game["gameId"] not in ids and game["opponent"] == opponent] + chosen,
                        key=lambda game: (game["date"], game["gameId"]))
    try:
        current = roster(team)
    except Exception:  # noqa: BLE001 -- the log stands with the NHL's season photos
        current = {}
    players = {}
    for pid, info in built["players"].items():
        known = current.get(pid) or {}
        players[pid] = {"name": info["name"], "pos": info["pos"],
                        "headshot": known.get("headshot") or mug(info.get("season"), team, pid)}
    return {"team": team, "opponent": opponent, "games": chosen, "players": players, "complete": built["complete"],
            "builtAt": time.time(), "version": VERSION}


# ---------------------------------------------------------------- players

def directory(day=None):
    """Every player with an NHL game this season or last: {id: {name, team,
    pos, shoots, season}}, his team being his latest. Two requests to the
    stats service, for matching PrizePicks' names to NHL ids."""
    season = season_id(day)

    def build():
        where = f"seasonId>={previous_season(season)}"
        with ThreadPoolExecutor(max_workers=2) as pool:
            skaters, goalies = pool.map(lambda report: _stats(report, where, game=False), ("skater/summary", "goalie/summary"))
        players = {}
        for row in sorted(skaters + goalies, key=lambda row: str(row.get("seasonId") or "")):
            pid = str(row.get("playerId") or "")
            teams = [canonical(code) for code in str(row.get("teamAbbrevs") or row.get("teamAbbrev") or "").split(",") if code.strip()]
            if pid and teams:
                players[pid] = {"name": row.get("skaterFullName") or row.get("goalieFullName") or "", "team": teams[-1],
                                "pos": "G" if row.get("goalieFullName") else row.get("positionCode") or "",
                                "shoots": row.get("shootsCatches") or "", "season": str(row.get("seasonId") or "")}
        return players
    return _cached(f"nhl:directory:{VERSION}:{season}", 6 * 3600, build, stale=7 * 24 * 3600)


def roster(team):
    """A team's current players from the game feed: {id: {name, pos, number, headshot, shoots}}."""
    team = canonical(team)

    def build():
        payload = _web(f"/roster/{team}/current")
        players = {}
        for group in ("forwards", "defensemen", "goalies"):
            for item in payload.get(group) or []:
                pid = str(item.get("id") or "")
                if pid:
                    players[pid] = {"name": f"{_text(item.get('firstName'))} {_text(item.get('lastName'))}".strip(),
                                    "pos": str(item.get("positionCode") or ""), "number": item.get("sweaterNumber"),
                                    "headshot": item.get("headshot") or "", "shoots": item.get("shootsCatches") or ""}
        return players
    return _cached(f"nhl:roster:{VERSION}:{team}", 6 * 3600, build, stale=7 * 24 * 3600)


def _name_parts(name):
    words = _norm(name).split()
    return " ".join(words), (words[-1] if words else ""), (words[0][:1] if words else "")


def match_player(name, team, rosters):
    """(NHL id, team) for the player PrizePicks names: his full name on his
    team; else the one player there with his last name and first initial
    ("Mitch Marner" / "Mitchell Marner"); else the one player anywhere with
    his full name. `rosters` is {team: {id: {name, ...}}}."""
    full, last, initial = _name_parts(name)
    if not full:
        return None
    team = canonical(team)
    own = rosters.get(team) or {}
    for pid, player in own.items():
        if _name_parts(player["name"])[0] == full:
            return pid, team
    close = [pid for pid, player in own.items() if _name_parts(player["name"])[1:] == (last, initial)]
    if len(close) == 1:
        return close[0], team
    anywhere = [(pid, code) for code, players in rosters.items() if code != team
                for pid, player in players.items() if _name_parts(player["name"])[0] == full]
    return anywhere[0] if len(anywhere) == 1 else None


# ---------------------------------------------------------------- schedule

def schedule_day(day):
    """Every game in the week that starts on `day` (the game feed's own
    week), so one read covers a slate's dates."""
    def build():
        payload = _web(f"/schedule/{day}")
        games = []
        for week in payload.get("gameWeek") or []:
            for item in week.get("games") or []:
                home, away = item.get("homeTeam") or {}, item.get("awayTeam") or {}
                games.append({"id": str(item.get("id")), "gameType": int(item.get("gameType") or 0),
                              "date": week.get("date"), "start": item.get("startTimeUTC"),
                              "home": canonical(home.get("abbrev")), "away": canonical(away.get("abbrev")),
                              "state": item.get("gameState") or ""})
        return games
    return _cached(f"nhl:schedule:{VERSION}:{day}", 10 * 60, build, stale=24 * 3600)


def find_game(team, opponent, starts_at, games):
    """The scheduled game between `team` and `opponent` nearest `starts_at`
    (within the day)."""
    team, opponent = canonical(team), canonical(opponent) if opponent else ""
    best, gap = None, None
    for item in games:
        sides = (item["home"], item["away"])
        if team not in sides or (opponent and opponent not in sides):
            continue
        try:
            distance = abs(datetime.fromisoformat(str(item["start"]).replace("Z", "+00:00")).timestamp() - starts_at)
        except (TypeError, ValueError):
            distance = 10 ** 9
        if distance < 18 * 3600 and (gap is None or distance < gap):
            best, gap = item, distance
    return best


# ---------------------------------------------------------------- injuries and depth

def injuries(team):
    """The team's injury report (ESPN): [{name, position, status, injury, note, date, headshot}]."""
    team = canonical(team)
    wanted = _norm(TEAMS.get(team))

    def build():
        payload = _get(f"{ESPN}/injuries")
        report = []
        for club in payload.get("injuries") or []:
            if _norm(club.get("displayName")) != wanted:
                continue
            for item in club.get("injuries") or []:
                athlete = item.get("athlete") or {}
                details = item.get("details") or {}
                report.append({"name": athlete.get("displayName") or "",
                               "position": ((athlete.get("position") or {}).get("abbreviation") or ""),
                               "status": item.get("status") or ((item.get("type") or {}).get("description") or "").title(),
                               "injury": details.get("type") or details.get("detail") or "",
                               "returnDate": details.get("returnDate") or "",
                               "note": item.get("shortComment") or item.get("longComment") or "",
                               "date": str(item.get("date") or "")[:10],
                               "headshot": ((athlete.get("headshot") or {}).get("href") or "")})
        return report
    return _cached(f"nhl:injuries:{VERSION}:{team}", 15 * 60, build, stale=6 * 3600)


# The lines as a team has been playing them: how many of each position the
# chart shows, top of the lineup first.
DEPTH_SLOTS = (("LW", 4), ("C", 4), ("RW", 4), ("LD", 3), ("RD", 3), ("G", 2))
DEPTH_GAMES = 5


def depth(team, day=None):
    """The team's depth chart from its last five games: each position's
    players by time on ice (goalies by starts), defensemen split left and
    right by the side they shoot from. Players no longer on the team are
    left off when the roster can be read."""
    team = canonical(team)
    built = team_games(team, day)
    recent = built["games"][-DEPTH_GAMES:]
    try:
        current = roster(team)
    except Exception:  # noqa: BLE001 -- the chart stands without the roster check
        current = {}
    toi, starts, last = {}, {}, set()
    for index, game in enumerate(recent):
        for pid, line in game["players"].items():
            if current and pid not in current:
                continue
            toi.setdefault(pid, []).append(line.get("toi") or 0)
            if line.get("starter"):
                starts[pid] = starts.get(pid, 0) + 1
            if index == len(recent) - 1:
                last.add(pid)
    slots = {slot: [] for slot, _count in DEPTH_SLOTS}
    for pid in toi:
        info = {**(built["players"].get(pid) or {}), **{key: value for key, value in (current.get(pid) or {}).items() if value}}
        position = info.get("pos") or ""
        if position == "G":
            slot = "G"
        elif position == "D":
            slot = "RD" if info.get("shoots") == "R" else "LD"
        else:
            slot = {"L": "LW", "R": "RW"}.get(position, "C")
        slots[slot].append(pid)
    rows = []
    for slot, count in DEPTH_SLOTS:
        average = lambda pid: sum(toi[pid]) / len(toi[pid])
        ordered = sorted(slots[slot], key=lambda pid: (starts.get(pid, 0) if slot == "G" else 0, pid in last, average(pid)), reverse=True)
        rows.append({"slot": slot, "players": [
            {"id": pid, "name": (current.get(pid) or {}).get("name") or (built["players"].get(pid) or {}).get("name") or "",
             "headshot": (current.get(pid) or {}).get("headshot") or mug((built["players"].get(pid) or {}).get("season"), team, pid)}
            for pid in ordered[:count]]})
    return rows


def _with_ids(people, team):
    """ESPN's names -> the NHL id and headshot, from the team's players."""
    known = {}
    try:
        known.update({pid: {"name": info["name"], "headshot": mug(info.get("season"), team, pid)}
                      for pid, info in team_games(team)["players"].items()})
    except Exception:  # noqa: BLE001
        pass
    try:
        known.update(roster(team))
    except Exception:  # noqa: BLE001
        pass
    by_name, by_last = {}, {}
    for pid, player in known.items():
        full, last, initial = _name_parts(player["name"])
        by_name[full] = pid
        by_last.setdefault((last, initial), []).append(pid)
    out = []
    for person in people:
        full, last, initial = _name_parts(person.get("name"))
        pid = by_name.get(full)
        if not pid:
            options = by_last.get((last, initial)) or []
            pid = options[0] if len(options) == 1 else None
        out.append({**person, "id": pid, "headshot": (known.get(pid) or {}).get("headshot") or person.get("headshot") or ""})
    return out


def team_context(team_code):
    """Injuries and depth chart for one team, each on its own if the other fails."""
    team_code = canonical(team_code)
    result = {"team": team_code}
    try:
        result["injuries"] = _with_ids(injuries(team_code), team_code)
    except Exception:  # noqa: BLE001
        result["injuries"], result["injuriesError"] = [], True
    try:
        result["depth"] = depth(team_code)
    except Exception:  # noqa: BLE001
        result["depth"], result["depthError"] = [], True
    return result


# ---------------------------------------------------------------- odds

def _odds(game_row):
    """The game's moneyline, puck line and total from ESPN's scoreboard."""
    try:
        start = datetime.fromisoformat(str(game_row["start"]).replace("Z", "+00:00"))
    except (TypeError, ValueError, KeyError):
        return None
    for day in sorted({(start - timedelta(hours=8)).strftime("%Y%m%d"), start.strftime("%Y%m%d")}):
        try:
            board = _cached(f"nhl:espn-board:{VERSION}:{day}", 10 * 60, lambda day=day: _get(f"{ESPN}/scoreboard?dates={day}"), durable=False)
        except Exception:  # noqa: BLE001
            continue
        for event in board.get("events") or []:
            competition = (event.get("competitions") or [{}])[0]
            sides = {item.get("homeAway"): canonical((item.get("team") or {}).get("abbreviation")) for item in competition.get("competitors") or []}
            if sides.get("home") != game_row["home"] or sides.get("away") != game_row["away"]:
                continue
            line = (competition.get("odds") or [None])[0]
            if not line:
                return None
            odds = parse_odds(line)
            return odds if odds["home"]["moneyline"] is not None or odds["total"] is not None else None
    return None


def _odds_number(value):
    """ESPN writes prices as "-130", "+170", "EVEN" and lines as "-1.5",
    "o6.5", "u6.5"."""
    if isinstance(value, (int, float)):
        return value
    text = str(value or "").strip().lower()
    if text in ("even", "ev"):
        return 100
    return _num(text.lstrip("ou+"))


def _close(side, field):
    """ESPN's current number for one side: its closing one, else its opening one."""
    side = side or {}
    for moment in ("close", "current", "open"):
        value = (side.get(moment) or {}).get(field)
        if value not in (None, ""):
            return _odds_number(value)
    return None


def parse_odds(line):
    """The moneyline, puck line and total from one ESPN odds entry, in
    either of the shapes ESPN has used (flat, or moneyline / pointSpread /
    total blocks with open and close numbers)."""
    home, away = line.get("homeTeamOdds") or {}, line.get("awayTeamOdds") or {}
    money, spread_block, total_block = line.get("moneyline") or {}, line.get("pointSpread") or {}, line.get("total") or {}
    spread = _num(line.get("spread"))
    home_line = _close(spread_block.get("home"), "line")
    if home_line is not None:
        spread = home_line
    odds = {"home": {"moneyline": _close(money.get("home"), "odds") if money else _num(home.get("moneyLine")),
                     "spread": spread, "spreadOdds": _close(spread_block.get("home"), "odds") if spread_block else _num(home.get("spreadOdds"))},
            "away": {"moneyline": _close(money.get("away"), "odds") if money else _num(away.get("moneyLine")),
                     "spread": -spread if isinstance(spread, (int, float)) else None,
                     "spreadOdds": _close(spread_block.get("away"), "odds") if spread_block else _num(away.get("spreadOdds"))},
            "total": _close(total_block.get("over"), "line") if total_block else None,
            "overOdds": _close(total_block.get("over"), "odds") if total_block else _num(line.get("overOdds")),
            "underOdds": _close(total_block.get("under"), "odds") if total_block else _num(line.get("underOdds")),
            "provider": ((line.get("provider") or {}).get("name") or "")}
    if odds["total"] is None:
        odds["total"] = _num(line.get("overUnder"))
    odds["noVig"] = _no_vig(odds["away"]["moneyline"], odds["home"]["moneyline"])
    return odds


def _implied(price):
    if not isinstance(price, (int, float)) or price == 0:
        return None
    return 100 / (price + 100) if price > 0 else -price / (-price + 100)


def _no_vig(away, home):
    a, h = _implied(away), _implied(home)
    if a is None or h is None or a + h <= 0:
        return None
    return {"away": round(a / (a + h) * 100, 1), "home": round(h / (a + h) * 100, 1)}


# ---------------------------------------------------------------- matchup

def _division(code):
    return next((name for name, codes in DIVISIONS.items() if code in codes), "")


def standings():
    """Every team's record: the game feed's standings, else the stats
    service's season totals (this regular season, or last before it starts)."""
    def from_feed():
        payload = _web("/standings/now")
        rows = {}
        for item in payload.get("standings") or []:
            code = canonical(_text(item.get("teamAbbrev")))
            rows[code] = {"abbr": code, "name": _text(item.get("teamName")) or TEAMS.get(code, code),
                          "logo": logo(code), "division": item.get("divisionName") or _division(code),
                          "wins": _num(item.get("wins")) or 0, "losses": _num(item.get("losses")) or 0,
                          "otl": _num(item.get("otLosses")) or 0, "points": _num(item.get("points")) or 0,
                          "played": _num(item.get("gamesPlayed")) or 0, "pct": _num(item.get("pointPctg")),
                          "streak": f"{item.get('streakCode') or ''}{item.get('streakCount') or ''}"}
        return rows

    def from_stats():
        season = season_id()
        rows = []
        for year in (season, previous_season(season)):
            rows = _stats("team/summary", f"seasonId={year} and gameTypeId=2", game=False)
            if rows:
                break
        table = {}
        for row in rows:
            code = _team_code(row)
            if code in TEAMS:
                table[code] = {"abbr": code, "name": TEAMS[code], "logo": logo(code), "division": _division(code),
                               "wins": _num(row.get("wins")) or 0, "losses": _num(row.get("losses")) or 0,
                               "otl": _num(row.get("otLosses")) or 0, "points": _num(row.get("points")) or 0,
                               "played": _num(row.get("gamesPlayed")) or 0, "pct": _num(row.get("pointPct")), "streak": ""}
        return table

    def build():
        try:
            table = from_feed()
        except Exception:  # noqa: BLE001 -- the stats service has the records too
            table = {}
        return table or from_stats()
    return _cached(f"nhl:standings:{VERSION}", 30 * 60, build, stale=24 * 3600)


def _scheduled(game_id):
    day = datetime.now(timezone.utc).date()
    for offset in (0, 7):
        for item in schedule_day((day + timedelta(days=offset)).isoformat()):
            if item["id"] == game_id:
                return item
    raise LookupError("game not on the schedule")


def matchup(game_id, home=None, away=None, start=None):
    """Both teams' records, last five games and the game's odds. The Finder
    passes the game's teams and start from its line; without them the game
    is looked up on the schedule."""
    game_id = str(game_id)

    def build():
        if home and away:
            found = {"id": game_id, "home": canonical(home), "away": canonical(away), "start": start,
                     "kind": kind_of(game_id)}
        else:
            item = _scheduled(game_id)
            found = {**item, "kind": KIND.get(item["gameType"], "other")}
        try:
            table = standings()
        except Exception:  # noqa: BLE001
            table = {}
        teams, last_five = [], {}
        for side in ("away", "home"):
            code = found[side]
            entry = table.get(code) or {}
            teams.append({"abbr": code, "name": TEAMS.get(code, code), "logo": logo(code), "side": side,
                          "record": f"{entry['wins']}-{entry['losses']}-{entry['otl']}" if entry else "",
                          "points": entry.get("points"), "division": entry.get("division") or _division(code)})
            try:
                games = team_games(code)["games"]
            except Exception:  # noqa: BLE001 -- the rest of the matchup stands
                games = []
            last_five[code] = [{"gameId": game["gameId"], "date": game["date"], "opponent": game["opponent"],
                                "isHome": game["isHome"], "result": game["result"], "score": game["score"],
                                "seasonKind": game["seasonKind"], "opponentLogo": logo(game["opponent"])} for game in games[-5:]]
        divisional = _division(found["home"]) == _division(found["away"]) != ""
        return {"game": {"id": game_id, "start": found.get("start"), "kind": found["kind"], "divisional": divisional},
                "teams": teams, "lastFive": last_five, "odds": _odds(found), "standings": _standings_groups(table)}
    return _cached(f"nhl:matchup:{VERSION}:{game_id}", 10 * 60, build)


def _standings_groups(table):
    groups = []
    for name, codes in DIVISIONS.items():
        entries = sorted((table[code] for code in codes if code in table),
                         key=lambda entry: (-(entry["points"] or 0), entry["played"] or 0))
        if entries:
            groups.append({"name": name, "entries": entries})
    return groups


# ---------------------------------------------------------------- league

LEAGUE_GAMES = 20
RANK_STATS = (("goals", "Goals"), ("assists", "Assists"), ("points", "Points"), ("sog", "Shots on Goal"),
              ("attempts", "Shot Attempts"), ("hits", "Hits"), ("blocked", "Blocked Shots"), ("fow", "Faceoffs Won"),
              ("fol", "Faceoffs Lost"), ("ppp", "Power Play Points"), ("pim", "Penalty Minutes"),
              ("fantasy", "Fantasy Score"), ("saves", "Goalie Saves"), ("ga", "Goals Allowed"), ("shots_faced", "Shots Faced"))
# What a defense allows to each position, by stat.
DVP_STATS = (("goals", "Goals"), ("assists", "Assists"), ("points", "Points"), ("sog", "Shots on Goal"),
             ("hits", "Hits"), ("blocked", "Blocked Shots"), ("ppp", "Power Play Points"), ("fow", "Faceoffs Won"),
             ("fantasy", "Fantasy Score"))
GOALIE_DVP = (("saves", "Saves"), ("ga", "Goals Allowed"), ("shots_against", "Shots Faced"), ("fantasy", "Fantasy Score"))
DVP_POSITIONS = ("C", "LW", "RW", "D", "G")
_POSITION = {"L": "LW", "R": "RW", "C": "C", "D": "D", "G": "G", "LW": "LW", "RW": "RW"}
WINDOWS = (("l20", LEAGUE_GAMES), ("l10", 10), ("l5", 5))


def _league_rows(day=None):
    """Every team's last LEAGUE_GAMES regular season and playoff games, with
    every player's line in them: {"games": {team: [game ids, oldest first]},
    "lines": {game id: {player id: line}}, "names": {id: name}}. Five
    requests to the stats service; kept in memory for a few hours."""
    season = season_id(day)

    def build():
        by_team = {}
        for row in _stats("team/summary", f"seasonId>={previous_season(season)}"):
            code = _team_code(row)
            if code in TEAMS and row.get("gameId"):
                by_team.setdefault(code, []).append(row)
        chosen, cutoff = {}, None
        for code, rows in by_team.items():
            rows.sort(key=lambda row: (str(row.get("gameDate")), str(row.get("gameId"))))
            recent = rows[-LEAGUE_GAMES:]
            chosen[code] = [str(row["gameId"]) for row in recent]
            first = str(recent[0].get("gameDate"))[:10]
            cutoff = first if cutoff is None or first < cutoff else cutoff
        lines, names = {}, {}
        if cutoff:
            where = f'gameDate>="{cutoff}"'
            reports = ("skater/summary", "skater/realtime", "skater/faceoffwins", "goalie/summary")
            with ThreadPoolExecutor(max_workers=len(reports)) as pool:
                summary, realtime, faceoffs, goalies = pool.map(lambda report: _stats(report, where), reports)
            extras, faceoff_rows = _index(realtime), _index(faceoffs)
            for row in summary:
                key = (str(row.get("gameId")), str(row.get("playerId")))
                line = _skater(row, extras.get(key), faceoff_rows.get(key))
                line.update(team=canonical(row.get("teamAbbrev")), opp=canonical(row.get("opponentTeamAbbrev")),
                            pos=row.get("positionCode") or "", date=str(row.get("gameDate") or "")[:10])
                lines.setdefault(key[0], {})[key[1]] = line
                names[key[1]] = row.get("skaterFullName") or ""
            for row in goalies:
                if not _played(row):
                    continue
                key = (str(row.get("gameId")), str(row.get("playerId")))
                line = _goalie(row)
                line.update(team=canonical(row.get("teamAbbrev")), opp=canonical(row.get("opponentTeamAbbrev")), pos="G",
                            date=str(row.get("gameDate") or "")[:10])
                lines.setdefault(key[0], {})[key[1]] = line
                names[key[1]] = row.get("goalieFullName") or ""
        return {"games": chosen, "lines": lines, "names": names}
    return _cached(f"nhl:leaguerows:{VERSION}:{season}", 3 * 3600, build, durable=False)


def _rank(table, high_first=True):
    """team -> its place in `table` (1 = the most when high_first). Ties share a place."""
    ordered = sorted((team for team in table if table[team] is not None), key=lambda team: table[team], reverse=high_first)
    ranks, previous, place = {}, None, 0
    for index, team in enumerate(ordered, start=1):
        if table[team] != previous:
            place, previous = index, table[team]
        ranks[team] = place
    return ranks


def _team_line(lines, team):
    """A team's totals in one game, from its players' lines."""
    totals = {key: 0 for key, _label in RANK_STATS}
    for line in lines.values():
        if line["team"] != team:
            continue
        if line["pos"] == "G":
            totals["saves"] += line.get("saves") or 0
            totals["shots_faced"] += line.get("shots_against") or 0
            totals["ga"] += line.get("ga") or 0
            continue
        for key, _label in RANK_STATS:
            if key not in ("saves", "shots_faced", "ga") and isinstance(line.get(key), (int, float)):
                totals[key] += line[key]
    totals["fantasy"] = round(totals["fantasy"], 2)
    return totals


def _opponent_in(lines, team):
    return next((line["team"] for line in lines.values() if line["team"] != team), "")


def league(day=None):
    """Every team's per-game numbers for and against over its last 20, 10
    and 5 games, ranked, and what each defense allows by position."""
    def build():
        data = _league_rows(day)
        teams, dvp = {}, {}
        for code, ids in data["games"].items():
            played = [game_id for game_id in ids if game_id in data["lines"]]
            if not played:
                continue
            entry = {"off": {}, "def": {}}
            for name, size in WINDOWS:
                recent = played[-size:]
                own = [_team_line(data["lines"][game_id], code) for game_id in recent]
                other = [_team_line(data["lines"][game_id], _opponent_in(data["lines"][game_id], code)) for game_id in recent]
                for key, _label in RANK_STATS:
                    entry["off"].setdefault(key, {})[name] = [_mean(total[key] for total in own), None]
                    entry["def"].setdefault(key, {})[name] = [_mean(total[key] for total in other), None]
            teams[code] = entry
            dvp[code] = {}
            for position in DVP_POSITIONS:
                per_game = [lines for lines in ([line for line in data["lines"][game_id].values()
                                                 if line["team"] != code and _POSITION.get(line["pos"]) == position] for game_id in played) if lines]
                if per_game:
                    dvp[code][position] = {key: {name: [_mean(sum(line.get(key) or 0 for line in game) for game in per_game[-size:]), None]
                                                 for name, size in WINDOWS}
                                           for key, _label in (GOALIE_DVP if position == "G" else DVP_STATS)}
        # Offense: 1 = the most. Defense and what it allows: 1 = the fewest.
        for side in ("off", "def"):
            for key, _label in RANK_STATS:
                for name, _size in WINDOWS:
                    ranks = _rank({code: teams[code][side][key][name][0] for code in teams}, high_first=(side == "off"))
                    for code in teams:
                        teams[code][side][key][name][1] = ranks.get(code)
        for position in DVP_POSITIONS:
            for key, _label in (GOALIE_DVP if position == "G" else DVP_STATS):
                for name, _size in WINDOWS:
                    table = {code: dvp[code][position][key][name][0] for code in dvp if position in dvp[code]}
                    ranks = _rank(table, high_first=False)
                    for code in table:
                        dvp[code][position][key][name][1] = ranks.get(code)
        return {"teams": teams, "dvp": dvp, "teamCount": len(teams), "stats": [list(item) for item in RANK_STATS],
                "dvpStats": {position: [list(item) for item in (GOALIE_DVP if position == "G" else DVP_STATS)] for position in DVP_POSITIONS},
                "dvpPositions": list(DVP_POSITIONS), "windows": [name for name, _size in WINDOWS],
                "logos": {code: logo(code) for code in TEAMS}, "complete": True, "builtAt": time.time(), "version": VERSION}
    return _cached(f"nhl:league:{VERSION}:{season_id(day)}", 3 * 3600, build, keep=lambda value: value["teamCount"] > 0)


def similar(opponent, position, market, day=None):
    """Other players at `position` in their recent games against `opponent`:
    what they put up in `market`, and their own average over the games the
    league table covers."""
    opponent = canonical(opponent)
    position = _POSITION.get(str(position or "").upper(), str(position or "").upper())
    season = season_id(day)

    def build():
        data = _league_rows(day)
        entries, history = [], {}
        for game_id, lines in data["lines"].items():
            for pid, line in lines.items():
                value = line.get(market)
                if not isinstance(value, (int, float)):
                    continue
                history.setdefault(pid, []).append(value)
                if line["opp"] == opponent and _POSITION.get(line["pos"]) == position:
                    entries.append({"id": pid, "name": data["names"].get(pid) or "", "team": line["team"], "gameId": game_id,
                                    "date": line["date"], "value": value, "toi": line.get("toi"),
                                    "headshot": mug(season_of(game_id), line["team"], pid)})
        entries.sort(key=lambda item: (item["date"], item["value"]), reverse=True)
        entries = entries[:12]
        for entry in entries:
            average = _mean(history.get(entry["id"]) or [])
            entry["avg"] = average
            entry["diff"] = round(entry["value"] - average, 2) if average is not None else None
        return {"opponent": opponent, "position": position, "market": market, "entries": entries}
    return _cached(f"nhl:similar:{VERSION}:{opponent}:{position}:{market}:{season}", 60 * 60, build)
