"""NHL research for the Finder, from the NHL's own public stats feed
(api-web.nhle.com) and ESPN's hockey feed.

* game() -- one finished game, reduced to every player's line: the box score
  (goals, assists, shots on goal, hits, blocks, time on ice, a goalie's saves)
  plus what only the play-by-play has (faceoffs won, power-play and
  shorthanded points, each period's goals, points and shots). Finished games
  never change, so each is kept for weeks.
* team_log() -- a team's recent games (this season and last, preseason and
  playoffs included) with each of its players' lines: the board's hit rates,
  the player page's chart, game log and splits all read it.
* team() -- injuries and the depth chart (ESPN).
* matchup() -- both teams' records, last five, the game's odds.
* league() -- every team's per-game numbers for and against, ranked, and what
  each defense allows to each position.
"""
import json
import re
import threading
import time
import unicodedata
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta, timezone

import requests

from v2.board import store

NHL = "https://api-web.nhle.com/v1"
ESPN = "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl"
VERSION = "nhl-v1"
LOG_GAMES = 40
ID = re.compile(r"^\d{1,12}$")
TEAM_CODE = re.compile(r"^[A-Z]{2,4}$")

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
ESPN_CODES = {"LAK": "LA", "NJD": "NJ", "SJS": "SJ", "TBL": "TB", "UTA": "UTAH"}
DIVISIONS = {
    "Atlantic": ("BOS", "BUF", "DET", "FLA", "MTL", "OTT", "TBL", "TOR"),
    "Metropolitan": ("CAR", "CBJ", "NJD", "NYI", "NYR", "PHI", "PIT", "WSH"),
    "Central": ("CHI", "COL", "DAL", "MIN", "NSH", "STL", "UTA", "WPG"),
    "Pacific": ("ANA", "CGY", "EDM", "LAK", "SJS", "SEA", "VAN", "VGK"),
}
KIND = {1: "preseason", 2: "regular", 3: "postseason"}

# PrizePicks' NHL Fantasy Score. Skaters: 8 a goal, 5 an assist, 1.5 a shot
# on goal and a blocked shot, 2 more for a shorthanded point, 1.5 a shootout
# goal and 3 for a hat trick. Goalies: 6 a win, 0.6 a save, -3 a goal
# allowed and 4 for a shutout.
SKATER_FANTASY = {"goals": 8, "assists": 5, "sog": 1.5, "blocked": 1.5, "shp": 2, "so_goals": 1.5}
HAT_TRICK = 3
GOALIE_FANTASY = {"win": 6, "saves": 0.6, "ga": -3, "shutout": 4}

_memory = {}
_lock = threading.Lock()


# ---------------------------------------------------------------- plumbing

def _get(url, timeout=12):
    response = requests.get(url, headers={"Accept": "application/json"}, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _cached(key, seconds, build, *, keep=None):
    """build(), kept in memory and in KV for `seconds`. `keep(value)` says
    whether a value may be stored at all (an unfinished game may not)."""
    now = time.time()
    with _lock:
        hit = _memory.get(key)
        if hit and now - hit[0] < seconds:
            return hit[1]
    try:
        raw = store.get(key)
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < seconds:
            with _lock:
                _memory[key] = (float(envelope["at"]), envelope["value"])
            return envelope["value"]
    except Exception:
        pass
    value = build()
    if keep is None or keep(value):
        with _lock:
            _memory[key] = (now, value)
            if len(_memory) > 4000:
                for stale in sorted(_memory, key=lambda item: _memory[item][0])[:1000]:
                    _memory.pop(stale, None)
        try:
            store.set(key, json.dumps({"at": now, "value": value}, separators=(",", ":")), ex=int(seconds))
        except Exception:
            pass
    return value


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


def _text(value):
    """The NHL feed's names come as {"default": "..."}."""
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


def _minutes(clock):
    """"17:23" -> 17.38 minutes."""
    try:
        minutes, seconds = str(clock).split(":")
        return round(int(minutes) + int(seconds) / 60, 2)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- one game

def _strength(code, home_scored):
    """"pp", "sh" or "ev" for the scoring team, from the play's situation
    code: away goalie, away skaters, home skaters, home goalie ("1451" is
    four away skaters against five: a home power play). A pulled goalie's
    extra attacker does not make a power play."""
    digits = str(code or "")
    if len(digits) != 4 or not digits.isdigit():
        return "ev"
    away_goalie, away_skaters, home_skaters, home_goalie = (int(d) for d in digits)
    away = away_skaters - (1 if away_goalie == 0 else 0)
    home = home_skaters - (1 if home_goalie == 0 else 0)
    own, other = (home, away) if home_scored else (away, home)
    return "pp" if own > other else "sh" if own < other else "ev"


def _period_seconds(clock):
    try:
        minutes, seconds = str(clock).split(":")
        return int(minutes) * 60 + int(seconds)
    except (TypeError, ValueError):
        return None


def _add(entry, key, amount=1):
    entry[key] = entry.get(key, 0) + amount


def parse_game(box, pbp):
    """A finished game's box score and play-by-play -> one record."""
    home, away = box.get("homeTeam") or {}, box.get("awayTeam") or {}
    home_code, away_code = canonical(home.get("abbrev")), canonical(away.get("abbrev"))
    game_type = int(box.get("gameType") or 0)
    record = {
        "id": str(box.get("id")), "season": str(box.get("season") or ""), "gameType": game_type,
        "kind": KIND.get(game_type, "other"), "date": str(box.get("gameDate") or "")[:10],
        "start": box.get("startTimeUTC"), "home": home_code, "away": away_code,
        "homeScore": _num(home.get("score")), "awayScore": _num(away.get("score")),
        "lastPeriod": ((box.get("gameOutcome") or {}).get("lastPeriodType") or ""),
        "state": box.get("gameState") or "", "players": {}, "version": VERSION,
    }
    players = record["players"]
    stats = box.get("playerByGameStats") or {}
    for side, code in (("homeTeam", home_code), ("awayTeam", away_code)):
        groups = stats.get(side) or {}
        for group in ("forwards", "defense"):
            for skater in groups.get(group) or []:
                pid = str(skater.get("playerId") or "")
                if not pid:
                    continue
                players[pid] = {
                    "team": code, "name": _text(skater.get("name")), "pos": str(skater.get("position") or ""),
                    "number": skater.get("sweaterNumber"), "goals": _num(skater.get("goals")) or 0,
                    "assists": _num(skater.get("assists")) or 0, "points": _num(skater.get("points")) or 0,
                    "sog": _num(skater.get("sog", skater.get("shots"))) or 0, "hits": _num(skater.get("hits")) or 0,
                    "blocked": _num(skater.get("blockedShots")) or 0, "pim": _num(skater.get("pim")) or 0,
                    "ppg": _num(skater.get("powerPlayGoals")) or 0, "plus_minus": _num(skater.get("plusMinus")) or 0,
                    "toi": _minutes(skater.get("toi")), "shifts": _num(skater.get("shifts")),
                }
        for goalie in groups.get("goalies") or []:
            pid = str(goalie.get("playerId") or "")
            if not pid:
                continue
            saves, against = _num(goalie.get("saves")), _num(goalie.get("shotsAgainst"))
            if saves is None or against is None:
                made, _, faced = str(goalie.get("saveShotsAgainst") or "").partition("/")
                saves = saves if saves is not None else _num(made)
                against = against if against is not None else _num(faced)
            toi = _minutes(goalie.get("toi"))
            if not toi and not against:
                continue  # dressed as the backup, never went in
            players[pid] = {
                "team": code, "name": _text(goalie.get("name")), "pos": "G", "number": goalie.get("sweaterNumber"),
                "saves": saves or 0, "shots_against": against or 0, "ga": _num(goalie.get("goalsAgainst")) or 0,
                "toi": toi, "starter": bool(goalie.get("starter")), "decision": goalie.get("decision") or "",
            }
    _add_plays(record, pbp or {})
    for entry in players.values():
        _finish(entry, record)
    return record


def _add_plays(record, pbp):
    """What only the play-by-play has: faceoffs, power-play and shorthanded
    points, each period's numbers, missed shots, shootout goals."""
    players = record["players"]
    ids = {}
    for side in ("homeTeam", "awayTeam"):
        team = pbp.get(side) or {}
        if team.get("id") is not None:
            ids[team["id"]] = canonical(team.get("abbrev"))
    home_code = record["home"]
    names = {}
    for spot in pbp.get("rosterSpots") or []:
        pid = str(spot.get("playerId") or "")
        if pid:
            names[pid] = f"{_text(spot.get('firstName'))} {_text(spot.get('lastName'))}".strip()
    for pid, full in names.items():
        if pid in players and full:
            players[pid]["fullName"] = full

    def entry(pid):
        return players.get(str(pid)) if pid is not None else None

    plays = pbp.get("plays") or []
    record["plays"] = bool(plays)
    for play in plays:
        kind = play.get("typeDescKey")
        details = play.get("details") or {}
        period = (play.get("periodDescriptor") or {})
        number, period_type = int(period.get("number") or 0), str(period.get("periodType") or "REG")
        if period_type == "SO":
            if kind == "goal" and entry(details.get("scoringPlayerId")) is not None:
                _add(entry(details["scoringPlayerId"]), "so_goals")
            continue
        slot = f"_{number}p" if 1 <= number <= 3 else "_ot"
        if kind == "faceoff":
            won, lost = entry(details.get("winningPlayerId")), entry(details.get("losingPlayerId"))
            if won is not None:
                _add(won, "fow")
            if lost is not None:
                _add(lost, "fol")
        elif kind in ("shot-on-goal", "goal"):
            shooter = entry(details.get("shootingPlayerId") or details.get("scoringPlayerId"))
            if shooter is not None:
                _add(shooter, "sog" + slot)
            goalie = entry(details.get("goalieInNetId"))
            if goalie is not None:
                _add(goalie, "faced" + slot)
                if kind == "goal":
                    _add(goalie, "ga" + slot)
                    seconds = _period_seconds(play.get("timeInPeriod"))
                    if number == 1 and seconds is not None and seconds < 600:
                        _add(goalie, "ga_first10")
            if kind == "goal":
                home_scored = ids.get(details.get("eventOwnerTeamId")) == home_code
                strength = _strength(play.get("situationCode"), home_scored)
                scorer = entry(details.get("scoringPlayerId"))
                helpers = [entry(details.get(key)) for key in ("assist1PlayerId", "assist2PlayerId")]
                for who, stat in [(scorer, "goals")] + [(helper, "assists") for helper in helpers]:
                    if who is None:
                        continue
                    _add(who, stat + slot)
                    _add(who, "points" + slot)
                    if strength == "pp":
                        _add(who, "ppp_pbp")
                    elif strength == "sh":
                        _add(who, "shp")
        elif kind == "missed-shot":
            shooter = entry(details.get("shootingPlayerId"))
            if shooter is not None:
                _add(shooter, "missed")
        elif kind == "blocked-shot":
            shooter = entry(details.get("shootingPlayerId"))
            if shooter is not None:
                _add(shooter, "was_blocked")


def _finish(entry, record):
    """Totals and fantasy score for one player's game."""
    if entry["pos"] == "G":
        for slot in ("_1p", "_2p", "_3p"):
            faced, against = entry.pop("faced" + slot, 0), entry.get("ga" + slot, 0)
            entry["saves" + slot] = faced - against
            entry.setdefault("ga" + slot, 0)
        entry.pop("faced_ot", None)
        entry.setdefault("ga_first10", 0)
        team_won = _won(record, entry["team"])
        entry["win"] = 1 if entry.get("decision") == "W" else 0
        # A shutout: the whole game in net, no goal allowed.
        entry["shutout"] = 1 if entry["ga"] == 0 and entry.get("starter") and team_won and (entry.get("toi") or 0) >= 59 else 0
        entry["fantasy"] = round(sum(entry.get(key, 0) * weight for key, weight in GOALIE_FANTASY.items()), 2)
        return
    if record.get("plays"):
        for slot in ("_1p", "_2p", "_3p"):
            for stat in ("goals", "assists", "points", "sog"):
                entry.setdefault(stat + slot, 0)
        entry["fow"], entry["fol"] = entry.get("fow", 0), entry.get("fol", 0)
        entry["faceoffs"] = entry["fow"] + entry["fol"]
        entry["ppp"] = entry.pop("ppp_pbp", 0)
        entry["shp"] = entry.get("shp", 0)
        entry["so_goals"] = entry.get("so_goals", 0)
        entry["attempts"] = entry["sog"] + entry.pop("missed", 0) + entry.pop("was_blocked", 0)
        fantasy = sum(entry.get(key, 0) * weight for key, weight in SKATER_FANTASY.items())
        entry["fantasy"] = round(fantasy + (HAT_TRICK if entry["goals"] >= 3 else 0), 2)
    for key in [key for key in entry if key.endswith("_ot")]:
        entry.pop(key)
    entry["hits_blocks"] = entry["hits"] + entry["blocked"]


def _won(record, team):
    own, other = (record["homeScore"], record["awayScore"])[:: 1 if record["home"] == team else -1]
    return own is not None and other is not None and own > other


def _final(state):
    return str(state or "").upper() in ("OFF", "FINAL")


def game(game_id):
    """One game's record (parse_game), kept for weeks once it is final."""
    def build():
        base = f"{NHL}/gamecenter/{game_id}"
        box = _get(f"{base}/boxscore")
        try:
            pbp = _get(f"{base}/play-by-play")
        except Exception:  # noqa: BLE001 -- the box score alone still counts most stats
            pbp = {}
        return parse_game(box, pbp)
    return _cached(f"nhl:game:{VERSION}:{game_id}", 45 * 24 * 3600, build,
                   keep=lambda value: _final(value.get("state")) and value.get("plays"))


# ---------------------------------------------------------------- schedules

def club_schedule(team, season):
    """A team's games in a season: [{id, gameType, date, home, away, scores, final}]."""
    team = canonical(team)

    def build():
        try:
            payload = _get(f"{NHL}/club-schedule-season/{team}/{season}")
        except requests.HTTPError as error:
            if error.response is not None and error.response.status_code == 404:
                return []
            raise
        games = []
        for item in payload.get("games") or []:
            home, away = item.get("homeTeam") or {}, item.get("awayTeam") or {}
            games.append({"id": str(item.get("id")), "gameType": int(item.get("gameType") or 0),
                          "date": str(item.get("gameDate") or "")[:10], "start": item.get("startTimeUTC"),
                          "home": canonical(home.get("abbrev")), "away": canonical(away.get("abbrev")),
                          "homeScore": _num(home.get("score")), "awayScore": _num(away.get("score")),
                          "lastPeriod": ((item.get("gameOutcome") or {}).get("lastPeriodType") or ""),
                          "final": _final(item.get("gameState"))})
        return [item for item in games if item["gameType"] in KIND]
    return _cached(f"nhl:club:{VERSION}:{team}:{season}", 20 * 60, build)


def schedule_day(day):
    """Every game in the week that starts on `day` (the NHL feed's own
    week), so one read covers a slate's dates."""
    def build():
        payload = _get(f"{NHL}/schedule/{day}")
        games = []
        for week in payload.get("gameWeek") or []:
            for item in week.get("games") or []:
                home, away = item.get("homeTeam") or {}, item.get("awayTeam") or {}
                games.append({"id": str(item.get("id")), "gameType": int(item.get("gameType") or 0),
                              "date": week.get("date"), "start": item.get("startTimeUTC"),
                              "home": canonical(home.get("abbrev")), "away": canonical(away.get("abbrev")),
                              "state": item.get("gameState") or ""})
        return games
    return _cached(f"nhl:schedule:{VERSION}:{day}", 10 * 60, build)


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


# ---------------------------------------------------------------- rosters

def roster(team):
    """A team's current players: {id: {name, first, last, pos, number, headshot}}."""
    team = canonical(team)

    def build():
        payload = _get(f"{NHL}/roster/{team}/current")
        players = {}
        for group in ("forwards", "defensemen", "goalies"):
            for item in payload.get(group) or []:
                pid = str(item.get("id") or "")
                if not pid:
                    continue
                first, last = _text(item.get("firstName")), _text(item.get("lastName"))
                players[pid] = {"name": f"{first} {last}".strip(), "first": first, "last": last,
                                "pos": str(item.get("positionCode") or ""), "number": item.get("sweaterNumber"),
                                "headshot": item.get("headshot") or ""}
        return players
    return _cached(f"nhl:roster:{VERSION}:{team}", 6 * 3600, build)


def match_player(name, team, rosters):
    """The NHL id of the player PrizePicks names, on his team's roster first."""
    wanted = _norm(name)
    if not wanted:
        return None
    words = wanted.split()
    order = [canonical(team)] + [code for code in rosters if code != canonical(team)]
    for strict in (True, False):
        for code in order:
            for pid, player in (rosters.get(code) or {}).items():
                full = _norm(player["name"])
                if full == wanted:
                    return pid, code
                if not strict and code == canonical(team) and words:
                    # "Mitch Marner" / "Mitchell Marner": same last name and
                    # first initial on the same team.
                    last, first = _norm(player["last"]), _norm(player["first"])
                    if last and words[-1] == last.split()[-1] and first[:1] == words[0][:1]:
                        return pid, code
    return None


# ---------------------------------------------------------------- team log

BUDGET = 20


def _load_games(ids, budget=BUDGET):
    """game() for each id, in parallel, for up to `budget` seconds. Games not
    in by then are left for the next request."""
    records, started = {}, time.monotonic()
    if not ids:
        return records, True
    pool = ThreadPoolExecutor(max_workers=12)
    pending = {pool.submit(_safe_game, game_id): game_id for game_id in ids}
    while pending:
        done, _ = wait(pending, timeout=max(0, budget - (time.monotonic() - started)), return_when=FIRST_COMPLETED)
        if not done:
            break
        for future in done:
            game_id, record = pending.pop(future), future.result()
            if record is not None:
                records[game_id] = record
    complete = not pending and len(records) == len(ids)
    pool.shutdown(wait=False, cancel_futures=True)
    return records, complete


def _safe_game(game_id):
    try:
        return game(game_id)
    except Exception:  # noqa: BLE001 -- one game failing leaves it out, not the log
        return None


def finished_games(team, day=None):
    """The team's finished games this season and last, oldest first."""
    season = season_id(day)
    games = [item for year in (previous_season(season), season) for item in club_schedule(team, year) if item["final"]]
    games.sort(key=lambda item: (item["date"], item["id"]))
    return games


def recent_games(team, opponent=None, limit=LOG_GAMES, day=None):
    """The team's finished games, oldest first: the last `limit` across this
    season and last, plus every game against `opponent` in those seasons."""
    team, opponent = canonical(team), canonical(opponent) if opponent else None
    games = finished_games(team, day)
    chosen = games[-limit:]
    if opponent:
        ids = {item["id"] for item in chosen}
        chosen = [item for item in games if item["id"] not in ids and opponent in (item["home"], item["away"])] + chosen
        chosen.sort(key=lambda item: (item["date"], item["id"]))
    return chosen


def _view(record, team):
    """The game from `team`'s side."""
    home = record["home"] == team
    own, other = (record["homeScore"], record["awayScore"])[:: 1 if home else -1]
    result = None
    if own is not None and other is not None:
        result = "W" if own > other else "L"
    extra = record.get("lastPeriod") if record.get("lastPeriod") in ("OT", "SO") else ""
    return {"gameId": record["id"], "season": record["season"], "seasonKind": record["kind"], "date": record["date"],
            "team": team, "opponent": record["away"] if home else record["home"], "isHome": home, "result": result,
            "score": f"{own}-{other}{' ' + extra if extra else ''}" if own is not None and other is not None else "",
            "extra": extra}


TEAM_STATS = ("goals", "assists", "points", "sog", "hits", "blocked", "pim", "fow", "fol", "ppp", "attempts", "fantasy", "toi")


def _team_totals(record, team):
    totals = {key: 0 for key in TEAM_STATS}
    saves = against = 0
    for entry in record["players"].values():
        if entry["team"] != team:
            continue
        if entry["pos"] == "G":
            saves += entry.get("saves") or 0
            against += entry.get("shots_against") or 0
            continue
        for key in TEAM_STATS:
            value = entry.get(key)
            if isinstance(value, (int, float)):
                totals[key] += value
    totals["saves"], totals["shots_faced"] = saves, against
    totals["ga"] = record["awayScore"] if record["home"] == team else record["homeScore"]
    totals["toi"] = round(totals["toi"], 1)
    totals["fantasy"] = round(totals["fantasy"], 2)
    return totals


def team_log(team, opponent=None, day=None):
    """The team's recent games (recent_games) with each of its players'
    lines and both sides' team totals."""
    team, opponent = canonical(team), canonical(opponent) if opponent else None

    def build():
        chosen = recent_games(team, opponent, day=day)
        records, complete = _load_games([item["id"] for item in chosen])
        games, players = [], {}
        for item in chosen:
            record = records.get(item["id"])
            if not record:
                continue
            other = record["away"] if record["home"] == team else record["home"]
            lines = {}
            for pid, entry in record["players"].items():
                if entry["team"] != team:
                    continue
                lines[pid] = {key: value for key, value in entry.items() if key not in ("team", "name", "fullName", "number", "pos")}
                known = players.setdefault(pid, {"name": entry.get("fullName") or entry["name"], "pos": entry["pos"]})
                known["name"] = entry.get("fullName") or known["name"]
                known["pos"] = entry["pos"] or known["pos"]
            games.append({**_view(record, team), "players": lines, "totals": _team_totals(record, team),
                          "against": _team_totals(record, other)})
        try:
            current = roster(team)
        except Exception:  # noqa: BLE001 -- the log stands without headshots
            current = {}
        for pid, player in current.items():
            known = players.setdefault(pid, {"name": player["name"], "pos": player["pos"]})
            known.update(name=player["name"], headshot=player["headshot"], number=player["number"], current=True)
        return {"team": team, "opponent": opponent, "games": games, "players": players, "complete": complete,
                "builtAt": time.time(), "version": VERSION}
    return _cached(f"nhl:teamlog:{VERSION}:{team}:{opponent or '-'}:{season_id(day)}", 30 * 60, build,
                   keep=lambda value: value.get("complete"))


# ---------------------------------------------------------------- ESPN

def _espn_team(team):
    team = canonical(team)
    return ESPN_CODES.get(team, team).lower()


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
    return _cached(f"nhl:injuries:{VERSION}:{team}", 15 * 60, build)


DEPTH_SLOTS = (("lw", "LW"), ("c", "C"), ("rw", "RW"), ("ld", "LD"), ("rd", "RD"), ("g", "G"))


def depth(team):
    """The team's depth chart (ESPN): [{slot, players: [{name, headshot}]}]."""
    team = canonical(team)

    def build():
        payload = _get(f"{ESPN}/teams/{_espn_team(team)}/depthcharts")
        charts = payload.get("depthchart") or payload.get("depthCharts") or []
        positions = {}
        for chart in charts:
            for key, value in (chart.get("positions") or {}).items():
                positions.setdefault(str(key).lower(), value)
        rows = []
        for key, label in DEPTH_SLOTS:
            athletes = (positions.get(key) or {}).get("athletes") or []
            rows.append({"slot": label, "players": [{"name": athlete.get("displayName") or athlete.get("fullName") or "",
                                                     "headshot": ((athlete.get("headshot") or {}).get("href") or "")}
                                                    for athlete in athletes if athlete.get("displayName") or athlete.get("fullName")][:3]})
        return rows
    return _cached(f"nhl:depth:{VERSION}:{team}", 6 * 3600, build)


def _with_ids(people, team):
    """ESPN names -> the NHL id and headshot from the team's roster."""
    try:
        current = roster(team)
    except Exception:  # noqa: BLE001
        current = {}
    by_name = {_norm(player["name"]): (pid, player) for pid, player in current.items()}
    by_last = {}
    for pid, player in current.items():
        by_last.setdefault((_norm(player["last"]), _norm(player["first"])[:1]), []).append((pid, player))
    out = []
    for person in people:
        name = _norm(person.get("name"))
        found = by_name.get(name)
        if not found and name:
            words = name.split()
            options = by_last.get((words[-1], words[0][:1])) or []
            found = options[0] if len(options) == 1 else None
        pid, player = found or (None, None)
        out.append({**person, "id": pid, "headshot": (player or {}).get("headshot") or person.get("headshot") or ""})
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
        result["depth"] = [{**row, "players": _with_ids(row["players"], team_code)} for row in depth(team_code)]
    except Exception:  # noqa: BLE001
        result["depth"], result["depthError"] = [], True
    return result


def _odds(game_row):
    """The game's moneyline, puck line and total from ESPN's scoreboard."""
    try:
        start = datetime.fromisoformat(str(game_row["start"]).replace("Z", "+00:00"))
    except (TypeError, ValueError, KeyError):
        return None
    for day in {(start - timedelta(hours=8)).strftime("%Y%m%d"), start.strftime("%Y%m%d")}:
        try:
            board = _cached(f"nhl:espn-board:{VERSION}:{day}", 10 * 60, lambda: _get(f"{ESPN}/scoreboard?dates={day}"))
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
            home, away = line.get("homeTeamOdds") or {}, line.get("awayTeamOdds") or {}
            spread = _num(line.get("spread"))
            odds = {"home": {"moneyline": _num(home.get("moneyLine")), "spread": spread, "spreadOdds": _num(home.get("spreadOdds"))},
                    "away": {"moneyline": _num(away.get("moneyLine")), "spread": -spread if isinstance(spread, (int, float)) else None,
                             "spreadOdds": _num(away.get("spreadOdds"))},
                    "total": _num(line.get("overUnder")), "overOdds": _num(line.get("overOdds")), "underOdds": _num(line.get("underOdds")),
                    "provider": ((line.get("provider") or {}).get("name") or "")}
            odds["noVig"] = _no_vig(odds["away"]["moneyline"], odds["home"]["moneyline"])
            return odds
    return None


def _implied(price):
    if not isinstance(price, (int, float)) or price == 0:
        return None
    return 100 / (price + 100) if price > 0 else -price / (-price + 100)


def _no_vig(away, home):
    a, h = _implied(away), _implied(home)
    if a is None or h is None or a + h <= 0:
        return None
    return {"away": round(a / (a + h) * 100, 1), "home": round(h / (a + h) * 100, 1)}


def standings():
    """Every team's record and place (the NHL's standings)."""
    def build():
        payload = _get(f"{NHL}/standings/now")
        rows = {}
        for item in payload.get("standings") or []:
            code = canonical(_text(item.get("teamAbbrev")))
            rows[code] = {"abbr": code, "name": _text(item.get("teamName")) or TEAMS.get(code, code),
                          "logo": logo(code), "division": item.get("divisionName") or "",
                          "conference": item.get("conferenceName") or "",
                          "wins": _num(item.get("wins")) or 0, "losses": _num(item.get("losses")) or 0,
                          "otl": _num(item.get("otLosses")) or 0, "points": _num(item.get("points")) or 0,
                          "played": _num(item.get("gamesPlayed")) or 0, "pct": _num(item.get("pointPctg")),
                          "streak": f"{item.get('streakCode') or ''}{item.get('streakCount') or ''}",
                          "divisionRank": _num(item.get("divisionSequence")), "leagueRank": _num(item.get("leagueSequence"))}
        return rows
    return _cached(f"nhl:standings:{VERSION}", 30 * 60, build)


def matchup(game_id):
    """Both teams' records, last five games and the game's odds."""
    game_id = str(game_id)

    def build():
        found = None
        day = datetime.now(timezone.utc).date()
        for offset in (0, 7):
            for item in schedule_day((day + timedelta(days=offset)).isoformat()):
                if item["id"] == game_id:
                    found = item
            if found:
                break
        if not found:
            raise LookupError("game not on the schedule")
        try:
            table = standings()
        except Exception:  # noqa: BLE001
            table = {}
        teams = []
        for side in ("away", "home"):
            code = found[side]
            entry = table.get(code) or {}
            record = f"{entry['wins']}-{entry['losses']}-{entry['otl']}" if entry else ""
            teams.append({"abbr": code, "name": TEAMS.get(code, code), "logo": logo(code), "side": side, "record": record,
                          "points": entry.get("points"), "division": entry.get("division") or ""})
        last_five = {}
        for code in (found["away"], found["home"]):
            games = finished_games(code, day)
            last_five[code] = [{**_view({"id": item["id"], "season": "", "kind": KIND.get(item["gameType"], "other"),
                                         "date": item["date"], "home": item["home"], "away": item["away"],
                                         "homeScore": item["homeScore"], "awayScore": item["awayScore"],
                                         "lastPeriod": item["lastPeriod"]}, code),
                                "opponentLogo": logo(item["away"] if item["home"] == code else item["home"])} for item in games[-5:]]
        divisional = any(found["home"] in group and found["away"] in group for group in DIVISIONS.values())
        return {"game": {"id": game_id, "start": found["start"], "kind": KIND.get(found["gameType"], "other"),
                         "divisional": divisional}, "teams": teams, "lastFive": last_five, "odds": _odds(found),
                "standings": _standings_groups(table)}
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
# What a defense allows to each position, by skater stat.
DVP_STATS = (("goals", "Goals"), ("assists", "Assists"), ("points", "Points"), ("sog", "Shots on Goal"),
             ("hits", "Hits"), ("blocked", "Blocked Shots"), ("ppp", "Power Play Points"), ("fantasy", "Fantasy Score"))
GOALIE_DVP = (("saves", "Saves"), ("ga", "Goals Allowed"), ("shots_against", "Shots Faced"), ("fantasy", "Fantasy Score"))
DVP_POSITIONS = ("C", "LW", "RW", "D", "G")
_POSITION = {"L": "LW", "R": "RW", "C": "C", "D": "D", "G": "G", "LW": "LW", "RW": "RW"}


def _mean(values):
    values = [value for value in values if isinstance(value, (int, float))]
    return round(sum(values) / len(values), 2) if values else None


def _rank(table, key, high_first=True):
    """team -> rank of table[team][key] (1 = most)."""
    ordered = sorted((team for team in table if table[team].get(key) is not None),
                     key=lambda team: table[team][key], reverse=high_first)
    ranks, previous, place = {}, None, 0
    for index, team in enumerate(ordered, start=1):
        if table[team][key] != previous:
            place, previous = index, table[team][key]
        ranks[team] = place
    return ranks


def league(day=None):
    """Every team's last LEAGUE_GAMES games: per-game numbers for and against
    (L20, L10, L5) with ranks, and what each defense allows by position."""
    def build():
        with ThreadPoolExecutor(max_workers=8) as pool:
            schedules = dict(zip(TEAMS, pool.map(lambda code: finished_games(code, day), TEAMS)))
        chosen = {code: [item["id"] for item in games[-LEAGUE_GAMES:]] for code, games in schedules.items()}
        records, complete = _load_games(sorted({game_id for ids in chosen.values() for game_id in ids}), budget=35)
        windows = {"l20": LEAGUE_GAMES, "l10": 10, "l5": 5}
        teams, dvp = {}, {}
        for code, ids in chosen.items():
            played = [records[game_id] for game_id in ids if game_id in records]
            if not played:
                continue
            entry = {"off": {}, "def": {}}
            for name, size in windows.items():
                recent = played[-size:]
                own = [_team_totals(record, code) for record in recent]
                other = [_team_totals(record, record["away"] if record["home"] == code else record["home"]) for record in recent]
                for key, _label in RANK_STATS:
                    entry["off"].setdefault(key, {})[name] = [_mean(total.get(key) for total in own), None]
                    entry["def"].setdefault(key, {})[name] = [_mean(total.get(key) for total in other), None]
            teams[code] = entry
            # Defense vs position: the opposing players' lines in these games.
            by_position = {}
            for record in played:
                for pid, line in record["players"].items():
                    if line["team"] == code:
                        continue
                    position = _POSITION.get(line["pos"])
                    if not position:
                        continue
                    by_position.setdefault(position, {}).setdefault(record["id"], []).append(line)
            dvp[code] = {}
            for position, per_game in by_position.items():
                stats = GOALIE_DVP if position == "G" else DVP_STATS
                ordered_games = [record["id"] for record in played if record["id"] in per_game]
                cells = {}
                for key, _label in stats:
                    cells[key] = {}
                    for name, size in (("l20", LEAGUE_GAMES), ("l10", 10), ("l5", 5)):
                        sums = [sum((line.get(key) or 0) for line in per_game[game_id]) for game_id in ordered_games[-size:]]
                        cells[key][name] = [_mean(sums), None]
                dvp[code][position] = cells
        # Offense ranks: most first. Defense ranks: 1 = allows the fewest.
        for side in ("off", "def"):
            for key, _label in RANK_STATS:
                for name in windows:
                    table = {code: {"v": teams[code][side][key][name][0]} for code in teams}
                    ranks = _rank(table, "v", high_first=(side == "off"))
                    for code in teams:
                        teams[code][side][key][name][1] = ranks.get(code)
        for position in DVP_POSITIONS:
            stats = GOALIE_DVP if position == "G" else DVP_STATS
            for key, _label in stats:
                for name in windows:
                    table = {code: {"v": dvp[code][position][key][name][0]} for code in dvp if position in dvp[code]}
                    # 1 = allows the most (weakest defense).
                    ranks = _rank(table, "v", high_first=True)
                    for code in table:
                        dvp[code][position][key][name][1] = ranks.get(code)
        return {"teams": teams, "dvp": dvp, "teamCount": len(teams), "stats": [list(item) for item in RANK_STATS],
                "dvpStats": {position: [list(item) for item in (GOALIE_DVP if position == "G" else DVP_STATS)] for position in DVP_POSITIONS},
                "dvpPositions": list(DVP_POSITIONS), "windows": list(windows), "logos": {code: logo(code) for code in TEAMS},
                "complete": complete, "builtAt": time.time(), "version": VERSION}
    return _cached(f"nhl:league:{VERSION}:{season_id(day)}", 3 * 3600, build, keep=lambda value: value.get("complete"))


def similar(opponent, position, market, day=None):
    """Other players at `position` in their games against `opponent`: what
    they put up in `market` and their own average over their recent games."""
    opponent = canonical(opponent)
    position = _POSITION.get(str(position or "").upper(), str(position or "").upper())

    def build():
        log = team_log(opponent, day=day)
        records, _ = _load_games([item["gameId"] for item in log["games"][-15:]])
        entries = []
        for record in records.values():
            for pid, line in record["players"].items():
                if line["team"] == opponent or _POSITION.get(line["pos"]) != position:
                    continue
                value = line.get(market)
                if not isinstance(value, (int, float)):
                    continue
                entries.append({"id": pid, "name": line.get("fullName") or line["name"], "team": line["team"],
                                "gameId": record["id"], "date": record["date"], "value": value,
                                "toi": line.get("toi"), "headshot": mug(record["season"], line["team"], pid)})
        entries.sort(key=lambda item: item["date"], reverse=True)
        entries = entries[:12]
        # Each one's own average over his team's last ten games.
        codes = sorted({entry["team"] for entry in entries})
        with ThreadPoolExecutor(max_workers=6) as pool:
            recent = dict(zip(codes, pool.map(lambda code: [item["id"] for item in finished_games(code, day)[-10:]], codes)))
        records, _ = _load_games(sorted({game_id for ids in recent.values() for game_id in ids}), budget=15)
        for entry in entries:
            values = [records[game_id]["players"][entry["id"]].get(market) for game_id in recent.get(entry["team"], [])
                      if game_id in records and entry["id"] in records[game_id]["players"]]
            average = _mean(values)
            entry["avg"] = average
            entry["diff"] = round(entry["value"] - average, 2) if average is not None else None
        return {"opponent": opponent, "position": position, "market": market, "entries": entries}
    return _cached(f"nhl:similar:{VERSION}:{opponent}:{position}:{market}:{season_id(day)}", 60 * 60, build)
