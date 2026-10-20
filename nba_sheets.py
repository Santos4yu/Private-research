"""NBA cheat sheets: the next slate read two ways.

  pace   every game by the possessions its two teams play to. Two fast
         teams mean more trips, so more shots for everyone on the floor:
         each game's projected possessions and points, each team's pace
         this season and lately, and what the extra trips are worth to the
         players who play the most minutes
  out    every rotation player on the injury report as out or doubtful,
         and what his teammates did in the games he missed (minutes,
         points, rebounds, assists, shots and usage) against their games
         with him

Everything comes from the season store the player pages read
(backend/sports/wnba/league.py: ESPN's box scores, last season's games
under this season's at the start of a season), ESPN's scoreboard and its
league injury report. Nothing is bought. A piece that can't load leaves its
part empty rather than failing a sheet.
"""
from __future__ import annotations

import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from backend.sports.wnba import context, league, opportunity

LEAGUE = "nba"
SHEETS = ("pace", "out")
KEEP_SECONDS = 600
# A game's pace against the league's: "fast" from 1.5% more possessions.
FAST, SLOW = 1.015, 0.985
RECENT = 10
# Who's on the floor for the extra trips: each team's top minutes.
PACE_PLAYERS = 4
PACE_MINUTES = 20.0
# A player who sits counts when he plays real minutes for his team.
ROTATION_MINUTES = 18.0
ROTATION_GAMES = 3
OUT_WORDS = ("out", "doubtful")
# A teammate's numbers without him need a couple of games, and are pulled
# toward his numbers with him by this many.
WITHOUT_GAMES = 2
PRIOR_GAMES = 3
GAINERS = 5
SPLIT_STATS = ("min", "pts", "reb", "ast", "fga", "tpm")
_I = context._I
_memory: dict = {}


def _r(value, digits=1):
    return None if value is None else round(value, digits)


def _num(value):
    return value if isinstance(value, (int, float)) else 0


# ---------------------------------------------------------------- the slate

def _event(event):
    """A scoreboard event as {gameId, startsAt, home, away, started}."""
    import slip_games
    competition = (event.get("competitions") or [{}])[0]
    sides = {side.get("homeAway"): side for side in competition.get("competitors") or []}
    home, away = sides.get("home"), sides.get("away")
    if not home or not away:
        return None
    state = (((competition.get("status") or event.get("status") or {}).get("type") or {}).get("state")) or "pre"
    team = lambda side: slip_games.code(LEAGUE, (side.get("team") or {}).get("abbreviation"))
    return {"gameId": str(event.get("id") or ""), "startsAt": event.get("date"), "home": team(home), "away": team(away),
            "state": state, "started": state != "pre"}


def slate(now: datetime | None = None, scoreboard=None):
    """The next day of games (Eastern): today's while any is still to come
    or under way, else tomorrow's. (day, [game]) with finished games left
    out."""
    import slip_games
    now = now or datetime.now(timezone.utc)
    scoreboard = scoreboard or slip_games._scoreboard
    today = slip_games._eastern_day(now)
    for day in (today, today + timedelta(days=1)):
        try:
            events = (scoreboard(LEAGUE, day) or {}).get("events") or []
        except Exception:  # noqa: BLE001 -- no scoreboard, try the next day
            events = []
        games = [game for game in (_event(event) for event in events) if game and game["state"] != "post"]
        if games:
            games.sort(key=lambda game: game["startsAt"] or "")
            return day.isoformat(), games
    return today.isoformat(), []


def season_payload(now: datetime | None = None) -> dict | None:
    """The season's games, with last season's under them until every team
    has played a few (the same blend the player pages use)."""
    season = league.current_season(now, LEAGUE)
    payload = league.stored(season, LEAGUE)
    games = len((payload or {}).get("games") or {})
    teams = len({team for game in ((payload or {}).get("games") or {}).values() for team in (game.get("t") or {})}) or 1
    if games * 2 / teams < opportunity.BLEND_GAMES:
        previous = league.stored(season - 1, LEAGUE)
        payload = opportunity.blend(previous, payload) if games else previous
    return payload


def _back_to_back(schedule, team, starts_at):
    """Whether `team` played the Eastern day before `starts_at`."""
    import slip_games
    try:
        day = slip_games._eastern_day(datetime.fromisoformat(str(starts_at).replace("Z", "+00:00")))
    except (TypeError, ValueError):
        return False
    for game in schedule or []:
        if team not in (game.get("home"), game.get("away")):
            continue
        try:
            played = slip_games._eastern_day(datetime.fromisoformat(str(game.get("date")).replace("Z", "+00:00")))
        except (TypeError, ValueError):
            continue
        if played == day - timedelta(days=1):
            return True
    return False


# ---------------------------------------------------------------- players

def _player_games(by_team: dict) -> dict:
    """player id -> [(team game, his row)] in date order, for any team."""
    found = defaultdict(list)
    for games in by_team.values():
        for game in games:
            for row in game["own"]["p"]:
                found[row[0]].append((game, row))
    for entries in found.values():
        entries.sort(key=lambda entry: entry[0]["date"] or "")
    return found


def _averages(entries) -> dict:
    """His averages over (game, row) entries: the split stats and usage."""
    if not entries:
        return {}
    out = {stat: _r(sum(_num(row[_I[stat]]) for _, row in entries) / len(entries)) for stat in SPLIT_STATS}
    usages = [context.usage_rate(row, game["own"]["p"]) for game, row in entries]
    usages = [value for value in usages if value is not None]
    out["usg"] = _r(sum(usages) / len(usages)) if usages else None
    out["games"] = len(entries)
    return out


def _who(pid, players, team=None):
    player = players.get(pid) or ["", "", None, None]
    return {"id": pid, "name": player[0], "position": context.primary_position(player) or player[1] or "",
            "team": team or player[3], "headshot": context.headshot(pid, player, LEAGUE)}


def _current(players, pid, team):
    """Whether he's on `team` now (the directory keeps his latest team)."""
    player = players.get(pid)
    return bool(player) and (not player[3] or player[3] == team)


# ---------------------------------------------------------------- pace

def _recent_pace(games, size=RECENT):
    values = []
    for game in games[-size:]:
        own, opp = opportunity.side_totals(game["own"]), opportunity.side_totals(game["opp"])
        if own["min"] and opp["min"]:
            values.append(opportunity.possessions(own, opp))
    return _r(sum(values) / len(values)) if values else None


def _expected_points(offense, defense, possessions):
    """An offense's points at `possessions`: its rating against the other
    defense's, met halfway."""
    ortg, drtg = (offense.get("ortg") or [None])[0], (defense.get("drtg") or [None])[0]
    if ortg is None or drtg is None:
        return None
    return (ortg + drtg) / 2 * possessions / 100


def sheet_pace(ctx):
    table, by_team, players = ctx["table"], ctx["byTeam"], ctx["players"]
    teams, usual = table["teams"], table["league"].get("poss")
    hurt = ctx["hurt"]
    history = _player_games(by_team)
    games, boosted = [], []
    for game in ctx["games"]:
        home, away = teams.get(game["home"]), teams.get(game["away"])
        if not home or not away or not usual or home["poss"][0] is None or away["poss"][0] is None:
            continue
        projected = (home["poss"][0] + away["poss"][0]) / 2
        ratio = projected / usual
        home_points, away_points = _expected_points(home, away, projected), _expected_points(away, home, projected)
        both = home["poss"][0] > usual and away["poss"][0] > usual
        sides = []
        for team, side in ((game["away"], away), (game["home"], home)):
            own_pace = side["poss"][0]
            lift = projected / own_pace - 1 if own_pace else 0
            rotation = (ctx["rotation"].get(team) or {}).get("players") or []
            gainers = []
            for entry in sorted(rotation, key=lambda item: -(item.get("min") or 0)):
                if (entry.get("min") or 0) < PACE_MINUTES or "out" in str(hurt.get(team, {}).get(entry["id"], "")).lower():
                    continue
                recent = _averages(history.get(entry["id"], [])[-RECENT:])
                if not recent:
                    continue
                person = {**_who(entry["id"], players, team), "status": hurt.get(team, {}).get(entry["id"])}
                gain = {"who": person, "gameId": game["gameId"], "startsAt": game["startsAt"],
                        "opponent": game["home"] if team == game["away"] else game["away"], "avg": recent,
                        "lift": _r(lift, 3), "extraPts": _r((recent.get("pts") or 0) * lift), "extraFga": _r((recent.get("fga") or 0) * lift),
                        "extraReb": _r((recent.get("reb") or 0) * lift), "extraAst": _r((recent.get("ast") or 0) * lift),
                        "pace": _r(projected), "paceUp": both}
                gainers.append(gain)
                if len(gainers) >= PACE_PLAYERS:
                    break
            boosted.extend(gainers)
            sides.append({"team": team, "pace": side["poss"][0], "rank": side["poss"][1], "recent": _recent_pace(by_team.get(team, [])),
                          "ortg": (side.get("ortg") or [None])[0], "drtg": (side.get("drtg") or [None])[0],
                          "points": _r(home_points if team == game["home"] else away_points),
                          "backToBack": _back_to_back(ctx["schedule"], team, game["startsAt"]), "players": gainers})
        total = home_points + away_points if home_points is not None and away_points is not None else None
        tier = "fast" if ratio >= FAST else "slow" if ratio <= SLOW else "average"
        games.append({"id": game["gameId"], "gameId": game["gameId"], "startsAt": game["startsAt"], "started": game["started"],
                      "home": game["home"], "away": game["away"], "projected": _r(projected), "league": usual,
                      "versus": _r(ratio - 1, 3), "total": _r(total), "paceUp": both, "tier": tier,
                      "score": max(0, min(100, round(50 + (ratio - 1) * 1250))), "sides": sides})
    games.sort(key=lambda item: -(item["projected"] or 0))
    boosted.sort(key=lambda item: -(item["extraPts"] or 0))
    return {"rows": games, "players": boosted, "teams": table["count"]}


# ---------------------------------------------------------------- teammate out

def _absence(team_games, pid, players, team, history):
    """What happens to `team` without `pid`: his role, his games missed in a
    row, and each current teammate's numbers with and without him."""
    played = [game for game in team_games if any(row[0] == pid for row in game["own"]["p"])]
    if len(played) < ROTATION_GAMES:
        return None
    rows = [next(row for row in game["own"]["p"] if row[0] == pid) for game in played]
    minutes = sum(_num(row[_I["min"]]) for row in rows) / len(rows)
    if minutes < ROTATION_MINUTES:
        return None
    since = played[0]["date"] or ""
    window = [game for game in team_games if (game["date"] or "") >= since]
    played_ids = {game["id"] for game in played}
    missed = 0
    for game in reversed(window):
        if game["id"] in played_ids:
            break
        missed += 1
    role = {**_averages(list(zip(played, rows))), "starts": sum(1 for row in rows if row[1]), "missed": missed}
    role["starter"] = role["starts"] * 2 >= len(rows)
    window_ids = {game["id"]: game for game in window}
    without_ids = set(window_ids) - played_ids
    gainers, bench = [], []
    mates = {row[0] for game in window for row in game["own"]["p"]} - {pid}
    for mate in mates:
        if not _current(players, mate, team):
            continue
        # His games for this team (a player traded in may have faced it before).
        entries = [(game, row) for game, row in history.get(mate, []) if window_ids.get(game["id"]) is game]
        with_entries = [(game, row) for game, row in entries if game["id"] in played_ids]
        without_entries = [(game, row) for game, row in entries if game["id"] in without_ids]
        with_avg, without_avg = _averages(with_entries), _averages(without_entries)
        # A bench player at his spot: who'd take his minutes.
        if with_entries and sum(1 for _, row in with_entries if row[1]) * 2 < len(with_entries):
            bench.append({**_who(mate, players, team), "min": with_avg.get("min")})
        if len(without_entries) < WITHOUT_GAMES or not with_avg or (without_avg.get("min") or 0) < 12:
            continue
        weight = len(without_entries) / (len(without_entries) + PRIOR_GAMES)
        diff = {stat: _r((without_avg.get(stat) or 0) - (with_avg.get(stat) or 0)) for stat in (*SPLIT_STATS, "usg")
                if without_avg.get(stat) is not None and with_avg.get(stat) is not None}
        gain = (diff.get("pts", 0) + 0.7 * diff.get("reb", 0) + 0.9 * diff.get("ast", 0)) * weight
        gainers.append({"who": _who(mate, players, team), "games": len(without_entries), "with": with_avg, "without": without_avg,
                        "diff": diff, "gain": _r(gain, 2)})
    gainers.sort(key=lambda item: -item["gain"])
    # No games without him yet: the players at his spot who'd take the minutes.
    position = context.primary_position(players.get(pid))
    next_up = sorted((item for item in bench if item["position"] == position), key=lambda item: -(item["min"] or 0))[:3]
    return {"role": role, "gainers": [item for item in gainers if item["gain"] > 0][:GAINERS], "sample": len(without_ids),
            "nextUp": next_up}


def sheet_out(ctx):
    import slip_games
    by_team, players, injuries = ctx["byTeam"], ctx["players"], ctx["injuries"]
    history = _player_games(by_team)
    outs, rows = [], []
    for game in ctx["games"]:
        for team, opponent in ((game["away"], game["home"]), (game["home"], game["away"])):
            roster = [{"id": pid, "name": player[0]} for pid, player in players.items() if player[3] == team]
            for entry in injuries.get(team) or []:
                status = str(entry.get("status") or "")
                if not any(word in status.lower() for word in OUT_WORDS):
                    continue
                person = slip_games.find_person(roster, entry.get("name"))
                if not person:
                    continue
                found = _absence(by_team.get(team, []), person["id"], players, team, history)
                if not found:
                    continue
                who = {**_who(person["id"], players, team), "status": status}
                fresh = found["role"]["missed"] == 0
                card = {"id": f"{game['gameId']}:{person['id']}", "gameId": game["gameId"], "startsAt": game["startsAt"],
                        "team": team, "opponent": opponent, "who": who, "role": found["role"], "fresh": fresh,
                        "sample": found["sample"], "gainers": found["gainers"], "nextUp": found["nextUp"]}
                outs.append(card)
                for gain in found["gainers"]:
                    rows.append({"id": f"{card['id']}:{gain['who']['id']}", "gameId": game["gameId"], "startsAt": game["startsAt"],
                                 "team": team, "opponent": opponent, "who": gain["who"], "out": who, "fresh": fresh,
                                 "games": gain["games"], "with": gain["with"], "without": gain["without"], "diff": gain["diff"],
                                 "score": max(0, min(100, round(50 + gain["gain"] * 6)))})
    # The news first: a player sitting for the first time, then the biggest roles.
    outs.sort(key=lambda card: (not card["fresh"], -(card["role"].get("pts") or 0)))
    rows.sort(key=lambda row: -row["score"])
    return {"outs": outs, "rows": rows}


# ---------------------------------------------------------------- building

BUILDERS = {"pace": sheet_pace, "out": sheet_out}


def _hurt(injuries, players):
    """team -> player id -> status, for the injury report's players we know."""
    import slip_games
    found = {}
    for team, entries in (injuries or {}).items():
        roster = [{"id": pid, "name": player[0]} for pid, player in players.items() if player[3] == team]
        for entry in entries:
            person = slip_games.find_person(roster, entry.get("name"))
            if person:
                found.setdefault(team, {})[person["id"]] = entry.get("status")
    return found


def build(name, now=None, payload=None, games=None, injuries=None):
    """The sheet `name` for the next slate. `payload`, `games` and
    `injuries` stand in for the season store, the scoreboard and the
    injury report (tests)."""
    import slip_games
    now = now or datetime.now(timezone.utc)
    day, slate_games = (None, games) if games is not None else slate(now)
    payload = payload if payload is not None else season_payload(now)
    if injuries is None:
        try:
            injuries = slip_games.league_injuries(LEAGUE)
        except Exception:  # noqa: BLE001 -- no report, no outs
            injuries = {}
    by_team = context.team_games(payload or {})
    players = (payload or {}).get("players") or {}
    ctx = {"games": slate_games, "byTeam": by_team, "players": players, "injuries": injuries,
           "table": opportunity.team_table(by_team), "rotation": context.rotation(by_team, players, league=LEAGUE),
           "schedule": (payload or {}).get("schedule") or [], "hurt": _hurt(injuries, players)}
    body = BUILDERS[name](ctx)
    return {"sheet": name, "day": day, "updatedAt": now.isoformat().replace("+00:00", "Z"),
            "seasons": (payload or {}).get("blended") or [(payload or {}).get("season")],
            "games": [{key: game[key] for key in ("gameId", "startsAt", "home", "away", "started")} for game in slate_games], **body}


def sheet(name):
    """A sheet for the next slate, built once and kept ten minutes."""
    if name not in BUILDERS:
        raise ValueError("Unknown sheet")
    slot = int(time.time() // KEEP_SECONDS)
    hit = _memory.get(name)
    if not hit or hit[0] != slot:
        hit = (slot, build(name))
        _memory[name] = hit
    return hit[1]
