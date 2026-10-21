"""Who guards him, and how he does against them: NBA.com's season matchups.

NBA.com tracks, for every possession, which defender was on which scorer,
and adds it up per pair over the season (its "season matchups": the
partial possessions, minutes, points, shots, free throws, assists,
turnovers, blocks and shooting fouls). That's free, and the only place it
is: nothing else here has who guarded whom.

For a player this reads every defender he faced, puts each pair on the
same footing (per 75 possessions, about a game), and sets it against his
own season across all of them. Today's opponent's defenders come first,
the one who guarded him most is the likely defender, and how sure that is
depends on how much of the time vs that team it was him.

NBA.com is slow and sometimes refuses servers outright; answers are kept
for hours, a refusal is remembered for a minute, and the page shows
nothing rather than an error to members when it can't be reached.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from datetime import datetime, timezone

import requests

STATS = "https://stats.nba.com/stats"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.nba.com",
    "Referer": "https://www.nba.com/",
    "x-nba-stats-origin": "stats",
    "x-nba-stats-token": "true",
}
TIMEOUT = (4, 8)
PREFIX = "nba:matchups:v1"
IDS_SECONDS = 24 * 3600
MATCHUPS_SECONDS = 6 * 3600
REFUSED_SECONDS = 60
PER = 75
# Too few possessions this season (its first weeks): last season instead.
ENOUGH = 150
# ESPN's codes for the clubs NBA.com spells otherwise.
ESPN_CODE = {"GSW": "GS", "NYK": "NY", "NOP": "NO", "SAS": "SA", "UTA": "UTAH", "WAS": "WSH", "PHO": "PHX", "BRK": "BKN"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}

_memory: dict = {}


class Unreachable(RuntimeError):
    """NBA.com didn't answer, or refused."""


def _store():
    from v2.board import store
    return store


def season_label(end_year: int) -> str:
    """2027 -> "2026-27": NBA.com names a season by both years."""
    return f"{end_year - 1}-{str(end_year)[2:]}"


def current_season(now: datetime | None = None) -> int:
    """The season under way, by the year it ends (late October on)."""
    now = now or datetime.now(timezone.utc)
    return now.year + 1 if (now.month, now.day) >= (10, 21) else now.year


def name_key(name) -> str:
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    words = [word for word in re.sub(r"[^a-z ]+", " ", text.replace("'", "")).split() if word not in SUFFIXES]
    return " ".join(words)


def team_code(value) -> str:
    code = str(value or "").upper()
    return ESPN_CODE.get(code, code)


def _kept(key, seconds, load):
    """`load()`, kept in memory and in the store for `seconds`."""
    now = time.time()
    hit = _memory.get(key)
    if hit and now - hit[0] < seconds:
        return hit[1]
    try:
        raw = _store().get(key)
        saved = json.loads(raw) if raw else None
        if saved and now - saved.get("at", 0) < seconds:
            _memory[key] = (saved["at"], saved["value"])
            return saved["value"]
    except Exception:  # noqa: BLE001 -- the store is a cache, never a reason to fail
        pass
    value = load()
    _memory[key] = (now, value)
    try:
        _store().set(key, json.dumps({"at": now, "value": value}, separators=(",", ":")))
    except Exception:  # noqa: BLE001
        pass
    return value


def _rows(endpoint, params):
    """One NBA.com stats table as dicts: the copy the admin's phone sent
    (nba_relay.py) when there is one, else NBA.com itself. A refusal is
    remembered briefly so a page full of cards doesn't knock on a closed
    door again and again."""
    import nba_relay
    relayed = nba_relay.rows(endpoint, params)
    if relayed is not None:
        return relayed
    refused = _memory.get("refused")
    if refused and time.time() - refused[0] < REFUSED_SECONDS:
        raise Unreachable("NBA.com's matchup data isn't answering right now.")
    try:
        response = requests.get(f"{STATS}/{endpoint}", params=params, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        table = (response.json().get("resultSets") or [{}])[0]
    except (requests.RequestException, ValueError) as error:
        _memory["refused"] = (time.time(), None)
        raise Unreachable("NBA.com's matchup data isn't answering right now.") from error
    headers = table.get("headers") or []
    return [dict(zip(headers, row)) for row in table.get("rowSet") or []]


def players(season: int) -> list:
    """Every player on a roster that season: [{id, name, team}] (ESPN codes)."""
    def load():
        rows = _rows("commonallplayers", {"LeagueID": "00", "Season": season_label(season), "IsOnlyCurrentSeason": "1"})
        return [{"id": str(row.get("PERSON_ID")), "name": row.get("DISPLAY_FIRST_LAST") or "", "team": team_code(row.get("TEAM_ABBREVIATION"))}
                for row in rows if row.get("PERSON_ID")]
    return _kept(f"{PREFIX}:players:{season}", IDS_SECONDS, load)


def find_player(roster: list, name: str, team: str = "") -> dict | None:
    """The roster entry for an ESPN name: the same name (on his team when
    two share it), else the same last name and first initial on his team."""
    wanted = name_key(name)
    if not wanted:
        return None
    same = [person for person in roster if name_key(person["name"]) == wanted]
    if len(same) > 1 and team:
        same = [person for person in same if person["team"] == team_code(team)] or same
    if same:
        return same[0]
    parts = wanted.split()
    close = [person for person in roster if person["team"] == team_code(team)
             and (found := name_key(person["name"]).split()) and found[-1] == parts[-1] and found[0][:1] == parts[0][:1]]
    return close[0] if len(close) == 1 else None


def season_matchups(nba_id: str, season: int) -> list:
    """Every defender he faced that season: NBA.com's rows, as is."""
    def load():
        return _rows("leagueseasonmatchups", {"LeagueID": "00", "Season": season_label(season), "SeasonType": "Regular Season",
                                               "PerMode": "Totals", "OffPlayerID": nba_id})
    return _kept(f"{PREFIX}:off:{season}:{nba_id}", MATCHUPS_SECONDS, load)


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number else None


FIELDS = {"pts": "PLAYER_PTS", "fgm": "MATCHUP_FGM", "fga": "MATCHUP_FGA", "tpm": "MATCHUP_FG3M", "tpa": "MATCHUP_FG3A",
          "ftm": "MATCHUP_FTM", "fta": "MATCHUP_FTA", "ast": "MATCHUP_AST", "tov": "MATCHUP_TOV", "blk": "MATCHUP_BLK", "sfl": "SFL"}


def line(totals: dict) -> dict:
    """Per-75 numbers and shooting from summed counts: {poss, min, gp,
    pts, fga, tpa, fta, ast, tov, blk, sfl (per 75), ts, fg, tp (%)}."""
    poss = totals.get("poss") or 0
    per = lambda key: round(totals[key] / poss * PER, 1) if poss and totals.get(key) is not None else None
    pct = lambda made, tried: round(totals[made] / totals[tried] * 100, 1) if totals.get(tried) else None
    shots = (totals.get("fga") or 0) + 0.44 * (totals.get("fta") or 0)
    return {"poss": round(poss, 1), "min": round(totals.get("min") or 0, 1), "gp": totals.get("gp") or 0,
            **{key: per(key) for key in ("pts", "fga", "tpa", "fta", "ast", "tov", "blk", "sfl")},
            "ts": round(totals["pts"] / (2 * shots) * 100, 1) if shots and totals.get("pts") is not None else None,
            "fg": pct("fgm", "fga"), "tp": pct("tpm", "tpa")}


def _totals(rows):
    totals = {"poss": 0.0, "min": 0.0, "gp": 0, **{key: 0.0 for key in FIELDS}}
    for row in rows:
        totals["poss"] += _number(row.get("PARTIAL_POSS")) or 0
        totals["min"] += _minutes(row.get("MATCHUP_MIN"))
        totals["gp"] += int(_number(row.get("GP")) or 0)
        for key, field in FIELDS.items():
            totals[key] += _number(row.get(field)) or 0
    return totals


def _minutes(value):
    """NBA.com writes matchup time as "5:36" (or as a number of minutes)."""
    if isinstance(value, str) and ":" in value:
        minutes, seconds = value.split(":", 1)
        return (_number(minutes) or 0) + (_number(seconds) or 0) / 60
    return _number(value) or 0


def view(rows: list, roster: list, opponent: str, season: int) -> dict:
    """The card: his season across every defender (`usual`), each defender
    he faced (most possessions first, today's opponent's flagged), and the
    likely defender today with how sure that is."""
    teams = {person["id"]: person["team"] for person in roster}
    opponent = team_code(opponent)
    defenders = []
    for row in rows:
        pid = str(row.get("DEF_PLAYER_ID") or "")
        if not pid:
            continue
        defenders.append({"id": pid, "name": row.get("DEF_PLAYER_NAME") or "", "team": teams.get(pid, ""),
                          **line(_totals([row]))})
    defenders.sort(key=lambda item: -item["poss"])
    theirs = [item for item in defenders if opponent and item["team"] == opponent]
    against = sum(item["poss"] for item in theirs)
    likely = None
    if theirs and theirs[0]["poss"] >= 5:
        share = theirs[0]["poss"] / against if against else 0
        likely = {"id": theirs[0]["id"], "share": round(share * 100),
                  "sure": "likely" if share >= 0.4 and theirs[0]["gp"] >= 2 else "possible"}
    return {"season": season_label(season), "usual": line(_totals(rows)), "opponent": opponent,
            "defenders": defenders, "likely": likely}


def defender(name: str, team: str, opponent: str, now: datetime | None = None) -> dict:
    """The whole card for a player by ESPN name and team: this season once
    it has enough possessions, else last season (its first weeks)."""
    season = current_season(now)
    # Today's rosters say which team each defender is on now.
    roster = players(season) or players(season - 1)
    person = find_player(roster, name, team) or find_player(players(season - 1), name, team)
    if not person:
        return {"player": None, "season": season_label(season), "usual": None, "opponent": team_code(opponent), "defenders": [], "likely": None}
    try:
        current = season_matchups(person["id"], season)
    except Unreachable:
        # This season unanswered: last season's alone.
        current = []
    card, year = view(current, roster, opponent, season), season
    if card["usual"]["poss"] < ENOUGH:
        last = view(season_matchups(person["id"], season - 1), roster, opponent, season - 1)
        if last["usual"]["poss"] > card["usual"]["poss"]:
            card, year = last, season - 1
    # How well each defender holds shooters, the same season.
    shooting = defense_shooting(year)
    for item in card["defenders"]:
        item["shooting"] = shooting.get(item["id"])
    return {"player": person, **card}


# ---------------------------------------------------------------- play types

# NBA.com's play types (synergyplaytypes), in the words the page uses.
PLAY_TYPES = {"PRBallHandler": "Pick & roll ball handler", "Isolation": "Isolation", "Spotup": "Spot-up", "Transition": "Transition",
              "PRRollman": "Pick & roll roll man", "Postup": "Post-up", "Handoff": "Handoff", "Cut": "Cut", "OffScreen": "Off screen",
              "OffRebound": "Putbacks", "Misc": "Other"}
# A play type he runs less than this share of the time isn't worth a line.
PLAY_SHARE = 0.05
# Too few plays this season (its first weeks): last season's instead.
ENOUGH_PLAYS = 60


def _synergy(season: int, kind: str, who: str, grouping: str) -> list:
    return _rows("synergyplaytypes", {"LeagueID": "00", "SeasonYear": season_label(season), "SeasonType": "Regular Season",
                                      "PerMode": "PerGame", "PlayType": kind, "PlayerOrTeam": who, "TypeGrouping": grouping})


def _season_play_types(name: str, team: str, opponent: str, season: int) -> dict:
    """His play types and the opponent's defense of each, for one season."""
    wanted, mine, theirs = name_key(name), [], {}
    for kind, label in PLAY_TYPES.items():
        try:
            players = _synergy(season, kind, "P", "offensive")
        except Unreachable:
            players = []
        rows = [row for row in players if name_key(row.get("PLAYER_NAME")) == wanted]
        if len(rows) > 1 and team:
            rows = [row for row in rows if team_code(row.get("TEAM_ABBREVIATION")) == team_code(team)] or rows
        if rows:
            row = rows[0]
            mine.append({"type": kind, "label": label, "share": _number(row.get("POSS_PCT")), "ppp": _number(row.get("PPP")),
                         "percentile": _number(row.get("PERCENTILE")), "poss": _number(row.get("POSS")), "gp": _number(row.get("GP"))})
        try:
            teams = _synergy(season, kind, "T", "defensive")
        except Unreachable:
            teams = []
        allowed = sorted(((team_code(row.get("TEAM_ABBREVIATION")), _number(row.get("PPP")), _number(row.get("POSS_PCT"))) for row in teams),
                         key=lambda item: -(item[1] if item[1] is not None else -1))
        for rank, (code, ppp, share) in enumerate(allowed, 1):
            if code == team_code(opponent):
                theirs[kind] = {"ppp": ppp, "share": share, "rank": rank, "teams": len(allowed),
                                "league": round(sum(item[1] for item in allowed if item[1] is not None) / max(1, len(allowed)), 3)}
    return {"season": season_label(season), "player": mine, "opponent": theirs}


def play_types(name: str, team: str, opponent: str, now: datetime | None = None) -> dict:
    """How he scores (his play types: how often, points per play, NBA
    percentile) and how the opponent defends each (points per play allowed,
    rank 1 allows the most): this season once he has enough plays, else
    last season. Only the play types he runs at least PLAY_SHARE of the time."""
    season = current_season(now)
    card = _season_play_types(name, team, opponent, season)
    # Plays a game in each type, times his games: his plays this season.
    plays = max((item["gp"] or 0 for item in card["player"]), default=0) * sum(item["poss"] or 0 for item in card["player"])
    if plays < ENOUGH_PLAYS:
        last = _season_play_types(name, team, opponent, season - 1)
        if last["player"]:
            card = last
    card["player"] = sorted((item for item in card["player"] if (item["share"] or 0) >= PLAY_SHARE), key=lambda item: -(item["share"] or 0))
    for item in card["player"]:
        item["share"] = round(item["share"] * 100, 1) if item["share"] is not None else None
        item["percentile"] = round(item["percentile"] * 100) if item["percentile"] is not None else None
    for item in card["opponent"].values():
        item["share"] = round(item["share"] * 100, 1) if item["share"] is not None else None
    card["opponentCode"] = team_code(opponent)
    return card


# ---------------------------------------------------------------- defenders' shooting

# The shooting each defense category reads: (category, made-percent column, usual-percent column).
SHOOTING_PARTS = (("Overall", "D_FG_PCT", "NORMAL_FG_PCT"), ("Less Than 6Ft", "LT_06_PCT", "NS_LT_06_PCT"),
                  ("3 Pointers", "FG3_PCT", "NS_FG3_PCT"))


def _ptdefend(season: int, category: str) -> list:
    return _rows("leaguedashptdefend", {"College": "", "Conference": "", "Country": "", "DateFrom": "", "DateTo": "", "Division": "",
                                        "DraftPick": "", "DraftYear": "", "GameSegment": "", "Height": "", "LastNGames": 0,
                                        "LeagueID": "00", "Location": "", "Month": 0, "OpponentTeamID": 0, "Outcome": "", "PORound": 0,
                                        "PerMode": "PerGame", "Period": 0, "PlayerExperience": "", "PlayerPosition": "",
                                        "Season": season_label(season), "SeasonSegment": "", "SeasonType": "Regular Season",
                                        "StarterBench": "", "TeamID": 0, "VsConference": "", "VsDivision": "", "Weight": "",
                                        "DefenseCategory": category, "PlayerID": ""})


def defense_shooting(season: int) -> dict:
    """Every defender's shooting allowed this season (leaguedashptdefend):
    id -> {dfg, normal, diff, fga, gp} overall, as percentages, with "rim"
    (inside six feet) and "three" ({pct, normal}) when those tables are in.
    Empty when NBA.com's overall table can't be had."""
    out = {}
    for category, made, usual in SHOOTING_PARTS:
        try:
            rows = _ptdefend(season, category)
        except Unreachable:
            if category == "Overall":
                return {}
            continue
        for row in rows:
            pid = str(row.get("CLOSE_DEF_PERSON_ID") or row.get("PLAYER_ID") or "")
            pct, normal = _number(row.get(made)), _number(row.get(usual))
            if not pid or pct is None or normal is None:
                continue
            if category == "Overall":
                out[pid] = {"dfg": round(pct * 100, 1), "normal": round(normal * 100, 1), "diff": round((pct - normal) * 100, 1),
                            "fga": _number(row.get("D_FGA")), "gp": _number(row.get("GP"))}
            elif pid in out:
                out[pid]["rim" if category == "Less Than 6Ft" else "three"] = {"pct": round(pct * 100, 1), "normal": round(normal * 100, 1)}
    return out
