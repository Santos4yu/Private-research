"""NFL preseason games for the Finder's player logs.

nflverse publishes regular season and postseason games only. ESPN keeps the
preseason box scores, so this reads them from ESPN's public scoreboard (the
week's games) and each game's summary (its box score), and turns every
player's line into the same weekly-stats columns an nflverse row has. The
finder then scores those rows with the same market_values and box it uses
for regular season games.

A season's preseason is built once and kept: finished games never change,
so only a game that failed to load is fetched again.
"""
from __future__ import annotations

import gzip
import json
import re
import time
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timedelta, timezone
from threading import Lock
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .cache import NFLCacheDomain, _kv_get, _kv_set, nfl_cache_key
from .services.nflverse import canonical_team

VERSION = "nfl-preseason-v1"
SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl"
# The Hall of Fame game is week 1; three more weeks follow it (four, some
# years), so five weeks covers every schedule.
WEEKS = range(1, 6)
# A game summary is most of a megabyte of JSON; gzipped it is a tenth.
HEADERS = {"Accept": "application/json", "Accept-Encoding": "gzip"}
# How long one request spends fetching games it does not have yet. What is
# not in by then is kept for the next request, so a cold start never runs
# past the function's time limit.
BUDGET = 15

# How long a built season stays good: a finished preseason for a week, one
# still being played for an hour, and one with a game that failed to load
# only a few minutes before that game is tried again.
KEEP_FINAL = 7 * 24 * 60 * 60
KEEP_OPEN = 60 * 60
KEEP_RETRY = 2 * 60


def _get(path, params):
    with urlopen(Request(f"{SITE}/{path}?{urlencode(params)}", headers=HEADERS), timeout=15) as response:
        body = response.read()
        if response.headers.get("Content-Encoding") == "gzip" or body[:2] == b"\x1f\x8b":
            body = gzip.decompress(body)
        return json.loads(body.decode("utf-8"))


def _number(value):
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _whole(value):
    return int(value) if isinstance(value, float) and value.is_integer() else value


def _eastern_date(stamp):
    """ESPN's kickoff is UTC; the logs date games in US Eastern like the
    schedule does. Preseason games are all played in August, in daylight
    time (UTC-4)."""
    try:
        moment = datetime.strptime(str(stamp)[:16], "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc)
    except ValueError:
        return str(stamp or "")[:10]
    return (moment - timedelta(hours=4)).strftime("%Y-%m-%d")


# ------------------------------------------------------------------ box score

# A box score column (by its key, or by its label for an older feed) -> the
# nflverse column it fills. "a/b" columns fill two.
COLUMNS = {
    "passing": {"completions/passingAttempts": ("completions", "attempts"), "C/ATT": ("completions", "attempts"),
                "passingYards": "passing_yards", "passingTouchdowns": "passing_tds",
                "interceptions": "passing_interceptions", "sacks-sackYardsLost": ("sacks_suffered", "sack_yards_lost"),
                "SACKS": ("sacks_suffered", "sack_yards_lost")},
    "rushing": {"rushingAttempts": "carries", "CAR": "carries", "rushingYards": "rushing_yards",
                "rushingTouchdowns": "rushing_tds", "longRushing": "longest_rush"},
    "receiving": {"receptions": "receptions", "REC": "receptions", "receivingYards": "receiving_yards",
                  "receivingTouchdowns": "receiving_tds", "longReception": "longest_reception",
                  "receivingTargets": "targets", "TGTS": "targets"},
    "fumbles": {"fumblesLost": "fumbles_lost_total", "LOST": "fumbles_lost_total"},
    "defensive": {"totalTackles": "total_tackles", "TOT": "total_tackles", "soloTackles": "def_tackles_solo",
                  "SOLO": "def_tackles_solo", "sacks": "def_sacks", "tacklesForLoss": "def_tackles_for_loss",
                  "TFL": "def_tackles_for_loss", "passesDefended": "def_pass_defended", "PD": "def_pass_defended",
                  "defensiveTouchdowns": "def_tds"},
    "interceptions": {"interceptions": "def_interceptions", "INT": "def_interceptions"},
    "kickReturns": {"kickReturns": "kickoff_returns", "kickReturnTouchdowns": "kick_return_tds"},
    "puntReturns": {"puntReturns": "punt_returns", "puntReturnTouchdowns": "punt_return_tds"},
    "kicking": {"fieldGoalsMade/fieldGoalAttempts": ("fg_made", "fg_att"), "FG": ("fg_made", "fg_att"),
                "longFieldGoalMade": "fg_long", "extraPointsMade/extraPointAttempts": ("pat_made", "pat_att"),
                "XP": ("pat_made", "pat_att")},
    "punting": {"punts": "punts", "NO": "punts", "puntYards": "gross_punt_yards", "puntsInside20": "punts_inside_20",
                "In 20": "punts_inside_20", "longPunt": "longest_punt"},
}
# Labels shared by several groups ("YDS", "TD", "LONG") only mean one thing
# inside a group, so a label is read only where the group's keys are missing.
LABELS = {
    "passing": {"YDS": "passing_yards", "TD": "passing_tds", "INT": "passing_interceptions"},
    "rushing": {"YDS": "rushing_yards", "TD": "rushing_tds", "LONG": "longest_rush"},
    "receiving": {"YDS": "receiving_yards", "TD": "receiving_tds", "LONG": "longest_reception"},
    "defensive": {"SACKS": "def_sacks", "TD": "def_tds"},
    "kickReturns": {"NO": "kickoff_returns", "TD": "kick_return_tds"},
    "puntReturns": {"NO": "punt_returns", "TD": "punt_return_tds"},
    "kicking": {"LONG": "fg_long"},
    "punting": {"YDS": "gross_punt_yards", "LONG": "longest_punt"},
}
# Columns every player's row carries, 0 when he had none -- as in nflverse,
# where a receiver's row still has passing_yards = 0.
ZERO = (
    "completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "sacks_suffered",
    "carries", "rushing_yards", "rushing_tds", "receptions", "targets", "receiving_yards", "receiving_tds",
    "fumbles_lost_total", "def_tackles_solo", "def_tackle_assists", "def_tackles_with_assist", "def_sacks",
    "def_tackles_for_loss", "def_interceptions", "def_pass_defended", "def_tds", "kickoff_returns", "punt_returns",
    "passing_2pt_conversions", "rushing_2pt_conversions", "receiving_2pt_conversions", "special_teams_tds",
    "fumble_recovery_tds",
)


def _read_group(group, stats):
    """One athlete's line in one box score group -> nflverse columns."""
    name, keys, labels = group.get("name"), group.get("keys") or [], group.get("labels") or []
    columns = COLUMNS.get(name, {})
    fields = {}
    for index, value in enumerate(stats):
        key = keys[index] if index < len(keys) else None
        label = labels[index] if index < len(labels) else None
        target = columns.get(key) if key else None
        if target is None and label:
            target = columns.get(label) if not keys else None
            target = target or (LABELS.get(name, {}).get(label) if not keys else None)
        if target is None:
            continue
        if isinstance(target, tuple):
            parts = re.split(r"[/-]", str(value))
            for field, part in zip(target, parts):
                number = _number(part)
                if number is not None:
                    fields[field] = number
        else:
            number = _number(value)
            if number is not None:
                fields[target] = number
    return fields


def _field_goals(summary):
    """Made field goals from the scoring plays: team -> [(text, yards)]."""
    made = {}
    for play in summary.get("scoringPlays") or []:
        text = str(play.get("text") or "")
        found = re.search(r"(\d+)\s*(?:Yd|yd|Yard|yard)s?\s+Field Goal", text)
        if not found:
            continue
        team = canonical_team(((play.get("team") or {}).get("abbreviation")) or "")
        made.setdefault(team, []).append((text.lower(), int(found.group(1))))
    return made


def _punts(summary):
    """Each punt's distance from the play list: team -> [(text, yards)].
    The box score has a punter's total and longest, not each kick."""
    punts = {}
    for drive in (summary.get("drives") or {}).get("previous") or []:
        team = canonical_team(((drive.get("team") or {}).get("abbreviation")) or "")
        for play in drive.get("plays") or []:
            text = str(play.get("text") or "")
            found = re.search(r"\bpunts (-?\d+) yards?", text)
            if not team or not found or "no play" in text.lower() or "nullified" in text.lower():
                continue
            punts.setdefault(team, []).append((text.lower(), int(found.group(1))))
    return punts


def _two_point_teams(summary):
    """Teams that converted a two-point try. The box score does not say who
    scored it, so fantasy points are left out for that team's game."""
    teams = set()
    for play in summary.get("scoringPlays") or []:
        text = str(play.get("text") or "").lower()
        if "two-point" in text and "fail" not in text and "no good" not in text:
            teams.add(canonical_team(((play.get("team") or {}).get("abbreviation")) or ""))
    return teams


def parse_summary(summary):
    """A game summary -> {"game": ..., "players": {espn athlete id: row}}.
    Each row has nflverse's weekly column names."""
    header = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    sides = {}
    for competitor in header.get("competitors") or []:
        team = canonical_team(((competitor.get("team") or {}).get("abbreviation")) or "")
        if team:
            sides[competitor.get("homeAway")] = {"team": team, "score": _number(competitor.get("score"))}
    home, away = sides.get("home"), sides.get("away")
    if not home or not away:
        return None
    game = {"home": home["team"], "away": away["team"], "homeScore": _whole(home["score"]),
            "awayScore": _whole(away["score"]), "date": _eastern_date(header.get("date"))}
    goals, two_point, punts = _field_goals(summary), _two_point_teams(summary), _punts(summary)
    players = {}
    for side in (summary.get("boxscore") or {}).get("players") or []:
        team = canonical_team(((side.get("team") or {}).get("abbreviation")) or "")
        if not team:
            continue
        for group in side.get("statistics") or []:
            for line in group.get("athletes") or []:
                athlete = line.get("athlete") or {}
                athlete_id = str(athlete.get("id") or "").strip()
                if not athlete_id:
                    continue
                entry = players.setdefault(athlete_id, {"team": team, "name": athlete.get("displayName") or "",
                                                        "last": athlete.get("lastName") or "", "row": {}})
                entry["row"].update(_read_group(group, line.get("stats") or []))
    output = {}
    for athlete_id, entry in players.items():
        row = entry["row"]
        total = row.pop("total_tackles", None)
        if total is not None:
            row["def_tackle_assists"] = max(0, total - (row.get("def_tackles_solo") or 0))
        returns = (row.pop("kick_return_tds", 0) or 0) + (row.pop("punt_return_tds", 0) or 0)
        if returns:
            row["special_teams_tds"] = returns
        if row.get("fg_made"):
            names = [name.lower() for name in (entry["name"], entry["last"]) if name]
            distances = [yards for text, yards in goals.get(entry["team"], []) if any(name in text for name in names)]
            if len(distances) == row["fg_made"]:
                row["fg_made_list"] = ";".join(str(yards) for yards in distances)
        if row.get("punts"):
            # His punts in the play list, by name ("C.Waitman punts 52
            # yards"); counted only when they add up to his box score.
            last = (entry["last"] or entry["name"].split(" ")[-1]).lower()
            kicks = [yards for text, yards in punts.get(entry["team"], []) if last and f"{last} punts" in text]
            if len(kicks) == row["punts"]:
                row["punts_50_plus"] = sum(yards >= 50 for yards in kicks)
        # Stored without the zeros (full_row puts them back), which keeps a
        # season of box scores small enough for the durable store.
        output[athlete_id] = {"team": entry["team"], "name": entry["name"],
                              "row": {key: _whole(value) for key, value in row.items() if value != 0}}
        if entry["team"] in two_point:
            output[athlete_id]["twoPoint"] = True
    return {"game": game, "players": output}


def full_row(entry, position=""):
    """A stored player line -> a complete nflverse-style weekly row."""
    row = {field: 0 for field in ZERO}
    row.update(entry.get("row") or {})
    row["position"] = position
    if entry.get("twoPoint"):
        # Someone on his team converted a two-point try and the box score
        # does not say who, so his fantasy score is unknown.
        row["passing_2pt_conversions"] = None
    if not row.get("fg_made_list") and row.get("fg_made"):
        # Made kicks whose distances could not be read: no kicker score.
        row["fg_made_list"] = None
    return row


def extra_values(row):
    """Markets nflverse only has in play-by-play, read from the box score
    instead. A player with no rush, catch or punt in the game has 0, as the
    play-by-play markets do."""
    values = {"longest_rush": row.get("longest_rush") or 0, "longest_reception": row.get("longest_reception") or 0,
              "punts": row.get("punts") or 0, "gross_punt_yards": row.get("gross_punt_yards") or 0,
              "punts_inside_20": row.get("punts_inside_20") or 0,
              # Unknown when his punts could not be read from the plays.
              "punts_50_plus": row.get("punts_50_plus") if row.get("punts") else 0}
    if not row.get("carries"):
        values["longest_rush"] = 0
    if not row.get("receptions"):
        values["longest_reception"] = 0
    if row.get("fg_made") and not row.get("fg_made_list"):
        values.update(kicker_fantasy=None, fg_yards=None, shortest_fg=None)
    return {key: _whole(value) for key, value in values.items()}


# ------------------------------------------------------------------ season

def _completed(event):
    status = ((event.get("status") or {}).get("type") or {})
    return bool(status.get("completed")) or status.get("state") == "post"


def _events(season):
    """event id -> preseason week, for every finished preseason game."""
    events = {}
    for week in WEEKS:
        board = _get("scoreboard", {"seasontype": 1, "week": week, "dates": season})
        for event in board.get("events") or []:
            if event.get("id") and _completed(event):
                events[str(event["id"])] = week
    return events


def _load_game(event_id, week):
    parsed = parse_summary(_get("summary", {"event": event_id}))
    if parsed is None:
        raise ValueError("summary has no teams")
    parsed["game"]["week"] = week
    return parsed


def build(season, previous=None, now=None, budget=BUDGET):
    """Every finished preseason game this season, by ESPN event id, with
    each player's row. Games already in `previous` are kept, not refetched."""
    now = time.time() if now is None else now
    started = time.monotonic()
    kept = dict((previous or {}).get("games") or {})
    events = _events(season)
    missing = [event_id for event_id in events if event_id not in kept]
    failed = 0
    if missing:
        pool = ThreadPoolExecutor(max_workers=12)
        pending = {pool.submit(_safe, _load_game, event_id, events[event_id]): event_id for event_id in missing}
        while pending:
            left = budget - (time.monotonic() - started)
            done, _ = wait(pending, timeout=max(0, left), return_when=FIRST_COMPLETED)
            if not done:
                break
            for future in done:
                event_id, result = pending.pop(future), future.result()
                if result is None:
                    failed += 1
                else:
                    kept[event_id] = result
        # Out of time: the rest are fetched on a later request.
        failed += len(pending)
        pool.shutdown(wait=False, cancel_futures=True)
    # Preseason is over once the regular season is under way.
    over = datetime.fromtimestamp(now, timezone.utc).strftime("%Y-%m-%d") >= f"{season}-09-15"
    return {"season": season, "games": {key: kept[key] for key in events if key in kept}, "complete": not failed,
            "final": over and not failed, "builtAt": now, "version": VERSION}


def _safe(load, *args):
    try:
        return load(*args)
    except Exception:  # noqa: BLE001 -- one game failing to load is retried later
        return None


def _fresh(index, now):
    if not index or index.get("version") != VERSION:
        return False
    age = now - (index.get("builtAt") or 0)
    if not index.get("complete"):
        return age < KEEP_RETRY
    return age < (KEEP_FINAL if index.get("final") else KEEP_OPEN)


_memo = {}
_players = {}
_lock = Lock()


def season_games(season, now=None):
    """The season's preseason (see build), from memory, the durable store or
    ESPN, in that order. ESPN being down leaves the preseason out rather
    than failing the player's log."""
    now = time.time() if now is None else now
    key = nfl_cache_key(NFLCacheDomain.PLAY_BY_PLAY, "preseason", VERSION, season)
    with _lock:
        index = _memo.get(season)
        if _fresh(index, now):
            return index
        stored = _kv_get(key, KEEP_FINAL)
        if _fresh(stored, now):
            _memo[season] = stored
            return stored
        previous = index or stored
        try:
            index = build(season, previous, now)
        except Exception:  # noqa: BLE001 -- the scoreboard itself did not load
            index = {**(previous or {"season": season, "games": {}}), "complete": False, "final": False,
                     "builtAt": now, "version": VERSION}
        _memo[season] = index
        _players.pop(season, None)
        _kv_set(key, index)
        return index


def player_games(season, espn_id):
    """One ESPN athlete's preseason games: [(event id, game, row)], by date."""
    index = season_games(season)
    cached = _players.get(season)
    if not cached or cached[0] is not index:
        by_player = {}
        for event_id, parsed in index.get("games", {}).items():
            for athlete_id, entry in (parsed.get("players") or {}).items():
                by_player.setdefault(athlete_id, []).append((event_id, parsed["game"], entry))
        for games in by_player.values():
            games.sort(key=lambda item: (item[1].get("date") or "", item[0]))
        cached = _players[season] = (index, by_player)
    return cached[1].get(str(espn_id), [])


def team_view(event_id, game, team, season):
    """The preseason game from `team`'s side, shaped like finder.team_view."""
    home = game["home"] == team
    own, other = (game.get("homeScore"), game.get("awayScore"))[:: 1 if home else -1]
    view = {"gameId": f"pre-{event_id}", "season": int(season), "week": int(game.get("week") or 0),
            "seasonKind": "preseason", "date": game.get("date") or "", "team": team,
            "opponent": game["away"] if home else game["home"], "isHome": home, "result": None, "score": ""}
    if isinstance(own, (int, float)) and isinstance(other, (int, float)):
        view["result"] = "W" if own > other else "L" if own < other else "T"
        view["score"] = f"{int(own)}-{int(other)}"
    return view
