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
    card = view(current, roster, opponent, season)
    if card["usual"]["poss"] < ENOUGH:
        last = view(season_matchups(person["id"], season - 1), roster, opponent, season - 1)
        if last["usual"]["poss"] > card["usual"]["poss"]:
            card = last
    return {"player": person, **card}
