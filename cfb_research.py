"""College football research for the Finder, from ESPN's public college
football feed (site.api.espn.com -- no key, no cost).

* teams() -- every FBS team: ESPN id, abbreviation, names and logo.
* schedule_day(day) -- the FBS games on a day (the scoreboard).
* roster(team) -- a team's players: ESPN id, name, position, number, photo.
* game(event) -- one game's box score: every player's line on both sides,
  and what each team gained (and so what the other gave up).
* team_log(team, opponent) -- the team's games this season and last, each
  of its players' lines in each: the board's hit rates, the player page.
* find(name, team) -- the player a slip names, as a board row without a line.

A box score lists a player in a category only when he did something in it,
so a player missing from a game's box score may have played without a
catch or a carry, or not played at all. Such games are kept as did-not-play
(the chart and hit rates leave them out), never as zeros. Value keys are
the NFL Finder's market keys (backend/sports/nfl/markets.py), so PrizePicks'
football stat names map the same way for both leagues.
"""
import base64
import json
import re
import threading
import time
import unicodedata
import zlib
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

from v2.board import store

SITE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football"
VERSION = "cfb-v1"
HEADERS = {"Accept": "application/json"}
EASTERN = ZoneInfo("America/New_York")
ID = re.compile(r"^\d{1,8}$")
FBS = 80
# How long building a team's log may spend reading box scores before it
# answers with what it has (marked incomplete, so it isn't kept).
LOG_BUDGET = 35
FOREVER = 400 * 24 * 3600

_memory = {}
_lock = threading.Lock()


# ---------------------------------------------------------------- plumbing

def _get(url, timeout=15, attempts=2):
    """One JSON read; a server hiccup is asked again once."""
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
        time.sleep(0.5 * (attempt + 1))
    raise RuntimeError("unreachable")


def _stored(key):
    try:
        raw = store.get(key)
        envelope = json.loads(raw) if raw else None
        if not envelope:
            return None
        if "z" in envelope:
            return float(envelope.get("at", 0)), json.loads(zlib.decompress(base64.b64decode(envelope["z"])))
        return (float(envelope.get("at", 0)), envelope["value"]) if "value" in envelope else None
    except Exception:
        return None


def _put(key, value, seconds, durable=True):
    now = time.time()
    with _lock:
        _memory[key] = (now, value)
        if len(_memory) > 4000:
            for gone in sorted(_memory, key=lambda item: _memory[item][0])[:1000]:
                _memory.pop(gone, None)
    if durable:
        text = json.dumps(value, separators=(",", ":"))
        envelope = {"at": now, "z": base64.b64encode(zlib.compress(text.encode(), 6)).decode()}
        try:
            store.set(key, json.dumps(envelope, separators=(",", ":")), ex=int(seconds))
        except Exception:
            pass


def _cached(key, seconds, build, *, keep=None, durable=True, stale=0):
    """build(), kept in memory (and in KV when `durable`) for `seconds`. With
    `stale`, a copy up to that old stands in when build() fails."""
    now = time.time()
    with _lock:
        hit = _memory.get(key)
    if not hit and durable:
        hit = _stored(key)
        if hit:
            with _lock:
                _memory[key] = hit
    if hit and now - hit[0] < seconds:
        return hit[1]
    try:
        value = build()
    except Exception:
        if hit and stale and now - hit[0] < stale:
            return hit[1]
        raise
    if keep is None or keep(value):
        _put(key, value, max(seconds, stale), durable=durable)
    return value


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


def _squash(value):
    return _norm(value).replace(" ", "")


def _num(value):
    if isinstance(value, dict):
        value = value.get("value", value.get("displayValue"))
    try:
        number = float(str(value).replace(",", ""))
    except (TypeError, ValueError):
        return None
    return int(number) if number.is_integer() else number


def _pair(value):
    """"20/30" or "1-7" -> (20, 30) or (1, 7); a lone number -> (n, None)."""
    text = str(value or "").strip()
    match = re.match(r"^(-?\d+(?:\.\d+)?)\s*[/-]\s*(-?\d+(?:\.\d+)?)$", text)
    if match:
        return _num(match.group(1)), _num(match.group(2))
    return _num(text), None


def valid_id(value):
    return bool(ID.match(str(value or "")))


def season_of(day=None):
    """The college football season a day falls in: August through January
    is that fall's season (bowl games in January count for the fall before)."""
    day = day or datetime.now(EASTERN).date()
    return day.year if day.month >= 7 else day.year - 1


def logo(team_id):
    return f"https://a.espncdn.com/i/teamlogos/ncaa/500/{team_id}.png" if valid_id(team_id) else ""


def headshot(player_id):
    return f"https://a.espncdn.com/i/headshots/college-football/players/full/{player_id}.png" if valid_id(player_id) else ""


def _eastern_day(stamp):
    """An ESPN start time ("2026-10-17T19:30Z") as its US Eastern date."""
    try:
        moment = datetime.fromisoformat(str(stamp).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return ""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(EASTERN).date().isoformat()


# ---------------------------------------------------------------- teams and games

def _team(raw):
    raw = raw or {}
    tid = str(raw.get("id") or "")
    logos = raw.get("logos") or []
    return {"id": tid, "abbr": str(raw.get("abbreviation") or "").upper(), "name": raw.get("displayName") or "",
            "short": raw.get("shortDisplayName") or "", "location": raw.get("location") or "",
            "nickname": raw.get("name") or "", "logo": raw.get("logo") or (logos[0].get("href") if logos else "") or logo(tid)}


def teams():
    """Every FBS team: {id: team}."""
    def build():
        payload = _get(f"{SITE}/teams?groups={FBS}&limit=400")
        out = {}
        for sport in payload.get("sports") or []:
            for league in sport.get("leagues") or []:
                for item in league.get("teams") or []:
                    team = _team(item.get("team") or item)
                    if team["id"]:
                        out[team["id"]] = team
        return out
    return _cached(f"cfb:teams:{VERSION}", 7 * 86400, build, keep=bool, stale=30 * 86400)


def _event(item):
    """A scoreboard or schedule event -> one game."""
    competition = (item.get("competitions") or [{}])[0]
    sides = {}
    for competitor in competition.get("competitors") or []:
        team = _team(competitor.get("team"))
        team["score"] = _num(competitor.get("score"))
        team["winner"] = competitor.get("winner")
        sides[competitor.get("homeAway")] = team
    if "home" not in sides or "away" not in sides:
        return None
    status = ((competition.get("status") or item.get("status") or {}).get("type") or {})
    season = item.get("season") or {}
    kind = (item.get("seasonType") or {}).get("type") or season.get("type")
    return {"id": str(item.get("id") or competition.get("id") or ""), "start": item.get("date") or competition.get("date") or "",
            "season": _num(season.get("year")), "kind": "postseason" if str(kind) == "3" else "regular",
            "home": sides["home"], "away": sides["away"], "neutral": bool(competition.get("neutralSite")),
            "completed": bool(status.get("completed")), "state": status.get("state") or ""}


def schedule_day(day, seconds=10 * 60):
    """The FBS games on a US Eastern date (a date or "YYYY-MM-DD")."""
    day = day if isinstance(day, date) else date.fromisoformat(str(day))
    key = day.strftime("%Y%m%d")

    def build():
        payload = _get(f"{SITE}/scoreboard?dates={key}&groups={FBS}&limit=400")
        return [game for game in (_event(item) for item in payload.get("events") or []) if game and game["id"]]
    return _cached(f"cfb:day:{VERSION}:{key}", seconds, build, stale=24 * 3600)


def team_schedule(team, season):
    """A team's games in a season, regular season and bowls."""
    current = season == season_of()

    def build():
        games = {}
        for kind in (2, 3):
            try:
                payload = _get(f"{SITE}/teams/{team}/schedule?season={season}&seasontype={kind}")
            except requests.HTTPError:
                continue  # no bowl games (yet) is not a failure
            for item in payload.get("events") or []:
                game = _event(item)
                if game and game["id"]:
                    game["season"] = game["season"] or season
                    if kind == 3:
                        game["kind"] = "postseason"
                    games[game["id"]] = game
        return sorted(games.values(), key=lambda game: game["start"])
    return _cached(f"cfb:schedule:{VERSION}:{team}:{season}", 3 * 3600 if current else 7 * 86400, build,
                   keep=bool, stale=7 * 86400)


def find_game(starts_at, games, team="", team_name="", opponent=""):
    """The game a PrizePicks line belongs to: among those kicking off at its
    start time (else within the day), the one whose team best fits the
    line's team abbreviation or name. (game, "home"|"away") or (None, None)."""
    timed = []
    for game in games:
        try:
            kick = datetime.fromisoformat(str(game["start"]).replace("Z", "+00:00")).timestamp()
        except (TypeError, ValueError):
            continue
        timed.append((abs(kick - starts_at), game))
    close = [game for gap, game in timed if gap <= 30 * 60] or [game for gap, game in timed if gap <= 14 * 3600]
    best, best_score = (None, None), 0.0
    for game in close:
        for side in ("home", "away"):
            score = team_fit(game[side], team, team_name)
            other = game["away" if side == "home" else "home"]
            if opponent:
                score += 0.25 * team_fit(other, opponent, opponent)
            if score > best_score:
                best, best_score = (game, side), score
    return best if best_score >= 0.85 else (None, None)


def team_fit(team, abbr="", name=""):
    """How well an ESPN team fits a pick'em app's abbreviation or school name, 0 to 1."""
    abbr, name = _squash(abbr), _norm(name)
    if not team:
        return 0.0
    if abbr and abbr == _squash(team.get("abbr")):
        return 1.0
    names = {_norm(team.get(field)) for field in ("location", "short", "name")} - {""}
    if name and name in names:
        return 0.95
    if name and _norm(f"{team.get('location')} {team.get('nickname')}") == name:
        return 0.95
    if abbr and abbr in {_squash(item) for item in names}:
        return 0.9
    return 0.0


# ---------------------------------------------------------------- rosters and players

# ESPN position abbreviations -> the board's groups.
POSITIONS = {"QB": "QB", "RB": "RB", "FB": "RB", "TB": "RB", "WR": "WR", "TE": "TE", "PK": "K", "K": "K", "P": "P",
             "LS": "LS", "OL": "OL", "OT": "OL", "OG": "OL", "C": "OL", "G": "OL", "T": "OL",
             "DL": "DL", "DE": "DL", "DT": "DL", "NT": "DL", "LB": "LB", "OLB": "LB", "ILB": "LB", "MLB": "LB",
             "DB": "DB", "CB": "DB", "S": "DB", "SS": "DB", "FS": "DB", "ATH": "ATH"}


def roster(team):
    """A team's players: {id: {name, pos, number, headshot}}."""
    def build():
        payload = _get(f"{SITE}/teams/{team}/roster")
        players = {}
        groups = payload.get("athletes") or []
        for group in groups:
            for item in (group.get("items") if isinstance(group, dict) and "items" in group else [group]) or []:
                pid = str(item.get("id") or "")
                if not pid:
                    continue
                position = str(((item.get("position") or {}).get("abbreviation")) or "").upper()
                players[pid] = {"name": item.get("fullName") or item.get("displayName") or "", "pos": POSITIONS.get(position, position),
                                "number": item.get("jersey") or "", "headshot": (item.get("headshot") or {}).get("href") or headshot(pid)}
        return players
    return _cached(f"cfb:roster:{VERSION}:{team}", 12 * 3600, build, keep=bool, stale=7 * 86400)


_SUFFIX = {"jr", "sr", "ii", "iii", "iv", "v"}


def _name_parts(name):
    words = [word for word in _norm(name).split() if word not in _SUFFIX]
    return " ".join(words), (words[-1] if words else ""), (words[0][:1] if words else "")


def match_player(name, players):
    """The ESPN id of the player a pick'em app names among `players`
    ({id: {name}}): his full name, else the one player with his last name
    and first initial ("Cam Ward" / "Cameron Ward")."""
    full, last, initial = _name_parts(name)
    if not full:
        return None
    exact = [pid for pid, player in players.items() if _name_parts(player.get("name"))[0] == full]
    if len(exact) == 1:
        return exact[0]
    close = [pid for pid, player in players.items() if _name_parts(player.get("name"))[1:] == (last, initial)]
    return close[0] if len(close) == 1 else None


# ---------------------------------------------------------------- box scores

def _group(stats):
    """One box score category -> {key or label: value} for each athlete."""
    keys, labels = stats.get("keys") or [], stats.get("labels") or []
    for entry in stats.get("athletes") or []:
        values = entry.get("stats") or []
        fields = {**{label: value for label, value in zip(labels, values)}, **{key: value for key, value in zip(keys, values)}}
        yield entry.get("athlete") or {}, fields


def _field(fields, key, label):
    value = fields.get(key, fields.get(label))
    return None if value in (None, "", "--", "-") else value


def _values(groups):
    """A player's categories ({"passing": fields, ...}) -> his game's values,
    under the NFL Finder's market keys."""
    passing, rushing, receiving = groups.get("passing"), groups.get("rushing"), groups.get("receiving")
    out = {}
    get = lambda fields, key, label: _num(_field(fields, key, label)) if fields else None
    completions, attempts = _pair(_field(passing, "completions/passingAttempts", "C/ATT")) if passing else (0, 0)
    out.update(pass_completions=completions or 0, passing_attempts=attempts or 0,
               passing_yards=get(passing, "passingYards", "YDS") or 0, passing_touchdowns=get(passing, "passingTouchdowns", "TD") or 0,
               interceptions=get(passing, "interceptions", "INT") or 0)
    sacked = _pair(_field(passing, "sacks-sackYardsLost", "SACKS"))[0] if passing and _field(passing, "sacks-sackYardsLost", "SACKS") else None
    if sacked is not None:
        out["sacks_taken"] = sacked
    out.update(rush_attempts=get(rushing, "rushingAttempts", "CAR") or 0, rushing_yards=get(rushing, "rushingYards", "YDS") or 0,
               rushing_tds=get(rushing, "rushingTouchdowns", "TD") or 0, longest_rush=get(rushing, "longRushing", "LONG") or 0,
               receptions=get(receiving, "receptions", "REC") or 0, receiving_yards=get(receiving, "receivingYards", "YDS") or 0,
               receiving_tds=get(receiving, "receivingTouchdowns", "TD") or 0, longest_reception=get(receiving, "longReception", "LONG") or 0)
    targets = get(receiving, "receivingTargets", "TGTS")
    if targets is not None:
        out["targets"] = targets
    out["fumbles_lost"] = get(groups.get("fumbles"), "fumblesLost", "LOST") or 0
    returns = sum(get(groups.get(kind), key, "TD") or 0 for kind, key in (("kickReturns", "kickReturnTouchdowns"),
                                                                        ("puntReturns", "puntReturnTouchdowns")))
    out["passing_rushing_yards"] = out["passing_yards"] + out["rushing_yards"]
    out["rushing_receiving_yards"] = out["rushing_yards"] + out["receiving_yards"]
    out["touchdowns"] = out["rushing_tds"] + out["receiving_tds"]
    out["pass_rush_rec_tds"] = out["touchdowns"] + out["passing_touchdowns"]
    if out["rush_attempts"]:
        out["yards_per_carry"] = round(out["rushing_yards"] / out["rush_attempts"], 2)
    if out["passing_attempts"]:
        out["completion_pct"] = round(100 * out["pass_completions"] / out["passing_attempts"], 1)
    # PrizePicks' football fantasy scoring; two-point conversions aren't in
    # a box score, so a game with one reads two points short.
    out["fantasy_score"] = round(out["passing_yards"] * 0.04 + out["passing_touchdowns"] * 4 - out["interceptions"]
                                 + out["rushing_yards"] * 0.1 + out["rushing_tds"] * 6 + out["receptions"]
                                 + out["receiving_yards"] * 0.1 + out["receiving_tds"] * 6 - out["fumbles_lost"] + returns * 6, 2)
    defense = groups.get("defensive")
    out.update(tackles=get(defense, "totalTackles", "TOT") or 0, solo_tackles=get(defense, "soloTackles", "SOLO") or 0,
               sacks=get(defense, "sacks", "SACKS") or 0, tackles_for_loss=get(defense, "tacklesForLoss", "TFL") or 0,
               def_interceptions=get(groups.get("interceptions"), "interceptions", "INT") or 0)
    kicking = groups.get("kicking")
    if kicking:
        made, tried = _pair(_field(kicking, "fieldGoalsMade/fieldGoalAttempts", "FG"))
        pats, pat_tries = _pair(_field(kicking, "extraPointsMade/extraPointAttempts", "XP"))
        made, tried, pats, pat_tries = (value or 0 for value in (made, tried, pats, pat_tries))
        points = get(kicking, "totalKickingPoints", "PTS")
        out.update(fg_made=made, fg_attempts=tried, pat_made=pats, pat_attempts=pat_tries,
                   kicking_points=points if points is not None else made * 3 + pats,
                   longest_fg=get(kicking, "longFieldGoalMade", "LONG") or 0)
    punting = groups.get("punting")
    if punting:
        out.update(punts=get(punting, "punts", "NO") or 0, gross_punt_yards=get(punting, "puntYards", "YDS") or 0,
                   punts_inside_20=get(punting, "puntsInside20", "In 20") or 0)
    return out


def _role(groups):
    """A player's position when no roster says it, from what he did."""
    if "passing" in groups:
        return "QB"
    if "kicking" in groups:
        return "K"
    if "punting" in groups:
        return "P"
    if "rushing" in groups and "receiving" not in groups:
        return "RB"
    if "receiving" in groups:
        return "WR"
    if "defensive" in groups or "interceptions" in groups:
        return "DEF"
    return ""


def parse_box(summary):
    """An ESPN game summary -> {lines: {player id: {team, name, headshot,
    pos, values}}, gained: {team id: what that team's offense did}}."""
    box = summary.get("boxscore") or {}
    lines, gained = {}, {}
    for side in box.get("players") or []:
        tid = str((side.get("team") or {}).get("id") or "")
        categories = {}
        for stats in side.get("statistics") or []:
            for athlete, fields in _group(stats):
                pid = str(athlete.get("id") or "")
                if pid:
                    categories.setdefault(pid, ({}, athlete))[0][stats.get("name") or ""] = fields
        for pid, (groups, athlete) in categories.items():
            lines[pid] = {"team": tid, "name": athlete.get("displayName") or "", "number": athlete.get("jersey") or "",
                          "headshot": (athlete.get("headshot") or {}).get("href") or "", "pos": _role(groups), "values": _values(groups)}
    for side in box.get("teams") or []:
        tid = str((side.get("team") or {}).get("id") or "")
        stats = {item.get("name"): item.get("displayValue") for item in side.get("statistics") or []}
        completions, attempts = _pair(stats.get("completionAttempts"))
        mine = [line["values"] for line in lines.values() if line["team"] == tid]
        gained[tid] = {"passYards": _num(stats.get("netPassingYards")), "rushYards": _num(stats.get("rushingYards")),
                       "totalYards": _num(stats.get("totalYards")), "completions": completions, "passAttempts": attempts,
                       "rushAttempts": _num(stats.get("rushingAttempts")),
                       "passTds": sum(values["passing_touchdowns"] for values in mine),
                       "rushTds": sum(values["rushing_tds"] for values in mine)}
    return {"lines": lines, "gained": gained}


def game(event, final=True):
    """One game's parsed box score. A finished game's is kept for good."""
    def build():
        return parse_box(_get(f"{SITE}/summary?event={event}", timeout=20))
    return _cached(f"cfb:game:{VERSION}:{event}", FOREVER if final else 10 * 60, build,
                   keep=lambda value: bool(value.get("lines")))


# ---------------------------------------------------------------- team log

def team_log(team, opponent=None, day=None):
    """The team's finished games this season and last, oldest first, each
    with its players' values, the team's own totals and what it gave up."""
    team = str(team)
    season = season_of(day)
    schedule = []
    for year in (season - 1, season):
        try:
            schedule += [item for item in team_schedule(team, year) if item["completed"]]
        except Exception:  # noqa: BLE001 -- last season alone still gives hit rates
            if year == season:
                raise
    schedule.sort(key=lambda item: item["start"])
    started, records, complete = time.time(), {}, True
    pool = ThreadPoolExecutor(max_workers=8)
    futures = {pool.submit(game, item["id"]): item["id"] for item in schedule}
    done, _ = wait(futures, timeout=LOG_BUDGET)
    pool.shutdown(wait=False, cancel_futures=True)
    for future, event in futures.items():
        try:
            records[event] = future.result() if future in done else None
        except Exception:  # noqa: BLE001 -- one missing box score leaves the rest
            records[event] = None
        complete = complete and records[event] is not None
    try:
        names = roster(team)
    except Exception:  # noqa: BLE001 -- positions then come from what they did
        names = {}
    games, players = [], {}
    for item in schedule:
        record = records.get(item["id"])
        if not record:
            continue
        home = item["home"]["id"] == team
        own, other = (item["home"], item["away"]) if home else (item["away"], item["home"])
        lines = {}
        for pid, line in record["lines"].items():
            if line["team"] != team:
                continue
            lines[pid] = line["values"]
            known = names.get(pid) or {}
            players[pid] = {"name": known.get("name") or line["name"], "pos": known.get("pos") or players.get(pid, {}).get("pos") or line["pos"],
                            "number": known.get("number") or line["number"], "headshot": known.get("headshot") or line["headshot"] or headshot(pid)}
        scored = own.get("score") is not None and other.get("score") is not None
        against = dict(record["gained"].get(other["id"]) or {})
        against["points"] = other.get("score")
        totals = dict(record["gained"].get(team) or {})
        totals["points"] = own.get("score")
        games.append({"gameId": item["id"], "season": item["season"], "seasonKind": item["kind"], "date": _eastern_day(item["start"]),
                      "team": own["abbr"], "teamId": team, "opponent": other["abbr"], "opponentId": other["id"],
                      "opponentLogo": other.get("logo") or logo(other["id"]), "isHome": None if item["neutral"] else home,
                      "result": ("W" if own["score"] > other["score"] else "L" if own["score"] < other["score"] else "T") if scored else None,
                      "score": f"{own['score']}-{other['score']}" if scored else "", "players": lines, "totals": totals, "against": against})
    info = teams().get(team) or {}
    return {"team": info.get("abbr") or (games[-1]["team"] if games else ""), "teamId": team, "opponent": opponent or None,
            "games": games, "players": players, "complete": complete and time.time() - started < LOG_BUDGET,
            "season": season, "builtAt": time.time(), "version": VERSION}


# ---------------------------------------------------------------- slips

DIRECTORY_KEY = f"cfb:directory:{VERSION}"


def remember_players(rows):
    """Every player the board matched, by name, for find() to answer a slip
    after his game has left the board."""
    entries = {}
    for row in rows:
        if row.get("playerId") and row.get("teamId"):
            entries[_name_parts(row.get("player"))[0]] = {key: row.get(key) for key in (
                "player", "playerId", "team", "teamId", "teamName", "teamLogo", "position", "headshot")}
    if not entries:
        return
    try:
        old = _stored(DIRECTORY_KEY)
        merged = {**(old[1] if old else {}), **entries}
        _put(DIRECTORY_KEY, merged, 10 * 86400)
    except Exception:
        pass


def find(name, team=None):
    """The player a slip names, as a board row without a line ([] when no
    one fits): from the players recent boards matched, else his team's roster."""
    full, last, initial = _name_parts(name)
    if not full:
        return []
    found = _stored(DIRECTORY_KEY)
    known = found[1] if found else {}
    if full in known:
        return [known[full]]
    close = [entry for key, entry in known.items() if _name_parts(key)[1:] == (last, initial)]
    if team:
        close = [entry for entry in close if team_fit({"abbr": entry.get("team"), "name": entry.get("teamName")}, team, team)] or close
    if len(close) == 1:
        return [close[0]]
    if not team:
        return []
    fitting = [info for info in teams().values() if team_fit(info, team, team) >= 0.9]
    if len(fitting) != 1:
        return []
    info = fitting[0]
    players = roster(info["id"])
    pid = match_player(name, players)
    if not pid:
        return []
    player = players[pid]
    return [{"player": player["name"] or name, "playerId": pid, "team": info["abbr"], "teamId": info["id"], "teamName": info["name"],
             "teamLogo": info["logo"] or logo(info["id"]), "position": player.get("pos") or None,
             "headshot": player.get("headshot") or headshot(pid)}]
