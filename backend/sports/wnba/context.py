"""Matchup numbers derived from the stored WNBA season (see league.py).

Everything here is arithmetic on finished box scores -- nothing is
estimated or modelled. Where a number needs a judgement call (which
players count toward "defense vs guards", what a zone is), the choice is
written down next to it and repeated to the viewer in the page's notes.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone

from . import opportunity
from .league import FIELDS, ZONES

# A player's row is [id, starter, *FIELDS].
_I = {name: index + 2 for index, name in enumerate(FIELDS)}

# Every stat the matchup views can show, keyed the way the page asks for it.
STATS = (
    ("pr", "Pts+Rebs", ("pts", "reb")),
    ("pts", "Points", ("pts",)),
    ("reb", "Rebounds", ("reb",)),
    ("ast", "Assists", ("ast",)),
    ("pa", "Pts+Asts", ("pts", "ast")),
    ("ra", "Rebs+Asts", ("reb", "ast")),
    ("pra", "Pts+Rebs+Asts", ("pts", "reb", "ast")),
    ("tpm", "3-PT Made", ("tpm",)),
    ("tpa", "3-PT Attempted", ("tpa",)),
    ("fgm", "FG Made", ("fgm",)),
    ("ftm", "FT Made", ("ftm",)),
    ("stl", "Steals", ("stl",)),
    ("blk", "Blocks", ("blk",)),
    ("bs", "Blks+Stls", ("blk", "stl")),
    ("to", "Turnovers", ("to",)),
    ("pf", "Fouls", ("pf",)),
    ("fga", "FG Attempted", ("fga",)),
    ("fta", "FT Attempted", ("fta",)),
    # Two-pointers: field goals less threes.
    ("twos", "Two Pointers Made", ("fgm", "tpm")),
    ("twosa", "Two Pointers Attempted", ("fga", "tpa")),
    ("oreb", "Offensive Rebounds", ("oreb",)),
    ("dreb", "Defensive Rebounds", ("dreb",)),
    # 1 when 10+ in two of points, rebounds, assists, steals and blocks.
    ("dd", "Double-Double", ("pts", "reb", "ast", "stl", "blk")),
    # 1 when 10+ in three of them.
    ("td", "Triple-Double", ("pts", "reb", "ast", "stl", "blk")),
    ("fs", "Fantasy Score", ("pts", "reb", "ast", "blk", "stl", "to")),
)
STAT_KEYS = tuple(key for key, _, _ in STATS)
_PARTS = {key: parts for key, _, parts in STATS}
# The prop board's market keys, mapped onto the stats above.
MARKET_STAT = {
    "player_points": "pts", "player_rebounds": "reb", "player_assists": "ast", "player_threes": "tpm",
    "player_blocks": "blk", "player_steals": "stl", "player_blocks_steals": "bs", "player_turnovers": "to",
    "player_points_rebounds": "pr", "player_points_assists": "pa", "player_rebounds_assists": "ra",
    "player_points_rebounds_assists": "pra", "player_fantasy_points": "fs",
    # Posted by PrizePicks only (see api/wnba.py _merge_prizepicks).
    "player_threes_attempts": "tpa", "player_field_goals": "fgm", "player_frees_made": "ftm",
    "player_field_goals_attempts": "fga", "player_frees_attempts": "fta", "player_twos": "twos",
    "player_twos_attempts": "twosa", "player_fouls": "pf", "player_offensive_rebounds": "oreb",
    "player_defensive_rebounds": "dreb", "player_double_double": "dd", "player_triple_double": "td",
}
# Same fantasy formula the game-log endpoint uses (api/wnba.py).
_FANTASY = {"pts": 1, "reb": 1.2, "ast": 1.5, "blk": 3, "stl": 3, "to": -1}
POSITIONS = ("G", "F", "C")
WINDOWS = (("szn", None), ("l10", 10), ("l5", 5))
# "Similar players" are starters-level minutes only, for the same reason.
SIMILAR_MIN_MINUTES = 20


def stat_value(row, key):
    parts = _PARTS[key]
    values = [row[_I[part]] for part in parts]
    if any(value is None for value in values):
        return None
    if key == "fs":
        return round(sum(_FANTASY[part] * value for part, value in zip(parts, values)), 1)
    if key in ("twos", "twosa"):
        return values[0] - values[1]
    if key in ("dd", "td"):
        return 1 if sum(value >= 10 for value in values) >= (2 if key == "dd" else 3) else 0
    return sum(values)


def headshot(pid: str, player, league: str = "wnba") -> str:
    """ESPN leaves the headshot off some box scores; its CDN still has one
    for most players at this address (the page hides it if it 404s)."""
    return (player or [None, None, None])[2] or f"https://a.espncdn.com/i/headshots/{league}/players/full/{pid}.png"


def primary_position(player) -> str | None:
    position = str((player or [None, ""])[1] or "").upper()[:1]
    return position if position in POSITIONS else None


def team_games(payload: dict) -> dict:
    """team -> its games in date order, each with its own and the opposing box."""
    by_team = defaultdict(list)
    for game in payload.get("games", {}).values():
        teams = list(game.get("t") or {})
        if len(teams) != 2:
            continue
        for team in teams:
            opponent = teams[1] if teams[0] == team else teams[0]
            by_team[team].append({"id": game["id"], "date": game["date"], "type": game["type"], "season": game.get("season"),
                                  "home": game["home"] == team, "opponent": opponent,
                                  "own": game["t"][team], "opp": game["t"][opponent]})
    for games in by_team.values():
        games.sort(key=lambda game: game["date"] or "")
    return by_team


def _rank(values: dict, ascending: bool) -> dict:
    """team -> rank (1-based) for the teams that have a value. Teams with the
    same value share a rank, and the next rank skips (1, 2, 2, 4)."""
    ordered = sorted((value for value in values.values() if value is not None), reverse=not ascending)
    return {team: ordered.index(value) + 1 for team, value in values.items() if value is not None}


def _round(value, digits=2):
    return None if value is None else round(value, digits)


def defense_vs_position(by_team: dict, players: dict) -> dict:
    """What each team allows a position a game: everything the opposing
    guards (forwards, centers) put up in a game added together, averaged
    over the team's games -- the usual way it's counted, so the ranks match
    other research sites. Rank 1 allows the least (toughest); the highest
    rank allows the most. `n` is how many opposing players at the position
    played in those games."""
    averages = {}
    samples = {}
    for team, games in by_team.items():
        for window, size in WINDOWS:
            chosen = games[-size:] if size else games
            for position in POSITIONS:
                totals, seen = defaultdict(list), 0
                for game in chosen:
                    at_spot = [row for row in game["opp"]["p"]
                               if row[_I["min"]] and primary_position(players.get(row[0])) == position]
                    seen += len(at_spot)
                    for key in STAT_KEYS:
                        values = [value for row in at_spot if (value := stat_value(row, key)) is not None]
                        # Nobody at the position played: nothing allowed to it that game.
                        if values or not at_spot:
                            totals[key].append(sum(values))
                averages[(team, position, window)] = {key: sum(values) / len(values) for key, values in totals.items() if values}
                samples[(team, position, window)] = seen
    result = {team: {position: {"n": {}, "stats": {}} for position in POSITIONS} for team in by_team}
    for position in POSITIONS:
        for window, _ in WINDOWS:
            for key in STAT_KEYS:
                values = {team: averages[(team, position, window)].get(key) for team in by_team}
                ranks = _rank(values, ascending=True)
                for team in by_team:
                    cell = result[team][position]["stats"].setdefault(key, {})
                    cell[window] = [_round(values[team]), ranks.get(team)]
            for team in by_team:
                result[team][position]["n"][window] = samples[(team, position, window)]
    return result


def defense_vs_each(by_team: dict, players: dict) -> dict:
    """What each team allows a player at a position a game: every opposing
    guard's (forward's, center's) line against them averaged, a player-game
    at a time -- the way RotoBot reads "vs guards" (11.0 points a game per
    guard, not the 57 they add up to), so the Props tab's matchup score and
    page agree with it. Same shape and ranks as defense_vs_position (rank 1
    allows the least); the Finder keeps reading that one."""
    averages = {}
    for team, games in by_team.items():
        for window, size in WINDOWS:
            chosen = games[-size:] if size else games
            for position in POSITIONS:
                rows = [row for game in chosen for row in game["opp"]["p"]
                        if row[_I["min"]] and primary_position(players.get(row[0])) == position]
                values = {key: [value for row in rows if (value := stat_value(row, key)) is not None] for key in STAT_KEYS}
                averages[(team, position, window)] = {key: sum(found) / len(found) for key, found in values.items() if found}
    result = {team: {position: {"stats": {}} for position in POSITIONS} for team in by_team}
    for position in POSITIONS:
        for window, _ in WINDOWS:
            for key in STAT_KEYS:
                values = {team: averages[(team, position, window)].get(key) for team in by_team}
                ranks = _rank(values, ascending=True)
                for team in by_team:
                    result[team][position]["stats"].setdefault(key, {})[window] = [_round(values[team]), ranks.get(team)]
    return result


def _totals(side) -> dict:
    totals = defaultdict(float)
    for row in side["p"]:
        for key in STAT_KEYS:
            value = stat_value(row, key)
            if value is not None:
                totals[key] += value
        for field in ("fga", "tpa", "fta"):
            if row[_I[field]] is not None:
                totals[field] += row[_I[field]]
    return totals


TEAM_STATS = ("pts", "reb", "ast", "pr", "tpm", "fgm", "ftm", "stl", "blk", "to", "fgPct", "tpPct")


def team_stats(by_team: dict) -> dict:
    """Per-game offense and defense (what opponents score) for every team.

    Offense rank 1 produces the most; defense rank 1 allows the least."""
    offense, defense, games_played = {}, {}, {}
    for team, games in by_team.items():
        own_sum, opp_sum = defaultdict(float), defaultdict(float)
        for game in games:
            for target, side in ((own_sum, game["own"]), (opp_sum, game["opp"])):
                for key, value in _totals(side).items():
                    target[key] += value
        count = len(games) or 1
        games_played[team] = len(games)
        for target, source in ((offense, own_sum), (defense, opp_sum)):
            per_game = {key: source[key] / count for key in STAT_KEYS if key in source}
            per_game["fgPct"] = source["fgm"] / source["fga"] * 100 if source.get("fga") else None
            per_game["tpPct"] = source["tpm"] / source["tpa"] * 100 if source.get("tpa") else None
            target[team] = per_game
    result = {team: {"games": games_played[team], "off": {}, "def": {}} for team in by_team}
    for key in TEAM_STATS:
        off_values = {team: offense[team].get(key) for team in by_team}
        def_values = {team: defense[team].get(key) for team in by_team}
        # Turnovers and fouls are the exception: fewer is the better offense,
        # and forcing more is the better defense.
        fewer_is_better = key == "to"
        off_ranks = _rank(off_values, ascending=fewer_is_better)
        def_ranks = _rank(def_values, ascending=not fewer_is_better)
        for team in by_team:
            result[team]["off"][key] = [_round(off_values[team]), off_ranks.get(team)]
            result[team]["def"][key] = [_round(def_values[team]), def_ranks.get(team)]
    return result


def zone_defense(by_team: dict) -> tuple[dict, dict]:
    """FG% each team allows in each shot zone (rank 1 = lowest, toughest),
    plus the league-wide FG% per zone for reference."""
    allowed = {team: {zone: [0, 0] for zone in ZONES} for team in by_team}
    league = {zone: [0, 0] for zone in ZONES}
    for team, games in by_team.items():
        for game in games:
            for _pid, zone_index, made, attempts in game["opp"].get("z", []):
                zone = ZONES[zone_index]
                allowed[team][zone][0] += made
                allowed[team][zone][1] += attempts
                league[zone][0] += made
                league[zone][1] += attempts
    result = {team: {} for team in by_team}
    for zone in ZONES:
        pct = {team: (made / attempts * 100 if attempts else None) for team, (made, attempts) in
               ((team, allowed[team][zone]) for team in by_team)}
        ranks = _rank(pct, ascending=True)
        for team in by_team:
            games = len(by_team[team]) or 1
            result[team][zone] = [_round(pct[team], 1), ranks.get(team), _round(allowed[team][zone][1] / games, 1)]
    league_pct = {zone: _round(made / attempts * 100, 1) if attempts else None for zone, (made, attempts) in league.items()}
    return result, league_pct


# A roster this short is the off-season's (free agents gone): not used.
FULL_ROSTER = 8
_ROSTER_POSITION = {"PG": "G", "SG": "G", "G": "G", "SF": "F", "PF": "F", "F": "F", "C": "C"}


def _roster_position(value) -> str:
    """ESPN's roster position (PG, SF, G-F...) as G, F or C."""
    text = str(value or "").upper()
    return _ROSTER_POSITION.get(text) or _ROSTER_POSITION.get(text.split("-")[0]) or text[:1]


# Each player's part in his team's last RECENT games (the NBA matchup score's
# who's-out reads): how many he played, his minutes in them, and whether he
# played one of the last three. A player out tonight counts only if he's
# been in the rotation lately -- someone out for weeks is already missing
# from the team's recent games.
RECENT = 10


def _recent_minutes(games: list) -> dict:
    """player id -> (games played of the team's last RECENT, average
    minutes in them, played one of its last three)."""
    played, minutes, last3 = defaultdict(int), defaultdict(float), set()
    window = games[-RECENT:]
    for index, game in enumerate(window):
        for row in game["own"]["p"]:
            if (row[_I["min"]] or 0) > 0:
                played[row[0]] += 1
                minutes[row[0]] += row[_I["min"]]
                if index >= len(window) - 3:
                    last3.add(row[0])
    return {pid: (count, minutes[pid] / count, pid in last3) for pid, count in played.items()}


def _with_recent(entries: list, games: list) -> list:
    recent = _recent_minutes(games)
    for entry in entries:
        count, avg, last3 = recent.get(entry["id"], (0, 0.0, False))
        entry.update({"played10": count, "min10": _round(avg, 1), "last3": last3})
    return entries


def _roster_rotation(team: str, games: list, roster: dict, history: dict, players: dict, size: int, league: str) -> list:
    """The team's players now (`roster`: id -> {name, pos, headshot}), each
    on his own last few games wherever he played them: anyone gone since is
    off, and a newcomer is on before his first game here. The starters are
    the team's last game's who are still here, then whoever started his own
    latest game, most minutes first, to five."""
    entries = []
    for pid, info in roster.items():
        played = history.get(pid, [])[-size:]
        known = players.get(pid) or ["", "", None, None]
        entries.append({"id": pid, "name": info.get("name") or known[0], "pos": known[1] or _roster_position(info.get("pos")),
                        "headshot": info.get("headshot") or headshot(pid, known, league),
                        "min": _round(sum(minutes for _, _, minutes in played) / len(played), 1) if played else 0,
                        "games": len(played), "starts": sum(started for _, started, _ in played), "lastStart": False})
    chosen = [row[0] for row in games[-1]["own"]["p"] if row[1] and row[0] in roster] if games else []
    others = sorted((entry for entry in entries if entry["id"] not in chosen and history.get(entry["id"]) and history[entry["id"]][-1][1]),
                    key=lambda entry: -entry["min"])
    chosen += [entry["id"] for entry in others][:max(0, 5 - len(chosen))]
    for entry in entries:
        entry["lastStart"] = entry["id"] in chosen
    return entries


def rotation(by_team: dict, players: dict, size: int = 5, league: str = "wnba", rosters: dict | None = None) -> dict:
    """Who plays, from the last few games: last game's starters first, then
    everyone else by minutes. ESPN publishes no WNBA depth chart, so this is
    the rotation as actually used, not a coach's depth chart. With the
    current `rosters` (team -> {id: {name, pos, headshot}}), a team's chart
    is its players now (_roster_rotation): at the start of a season its
    last games are last season's, and a signing would be missing."""
    order = {"G": 0, "F": 1, "C": 2}
    result = {}
    # Every player's games, wherever he played them: (date, started, minutes), in order.
    history = defaultdict(list)
    if rosters:
        for games in by_team.values():
            for game in games:
                for row in game["own"]["p"]:
                    history[row[0]].append((game["date"] or "", row[1], row[_I["min"]] or 0))
        for played in history.values():
            played.sort(key=lambda item: item[0])
    for team, games in by_team.items():
        roster = (rosters or {}).get(team) or {}
        if len(roster) >= FULL_ROSTER:
            entries = _with_recent(_roster_rotation(team, games, roster, history, players, size, league), games)
            entries.sort(key=lambda e: (not e["lastStart"], order.get(primary_position([None, e["pos"]]), 3) if e["lastStart"] else 0, -e["min"]))
            result[team] = {"games": min(len(games), size), "lastGame": games[-1]["date"] if games else None, "players": entries[:13]}
            continue
        if not games:
            continue
        recent = games[-size:]
        minutes, starts, appearances = defaultdict(float), defaultdict(int), defaultdict(int)
        for game in recent:
            for row in game["own"]["p"]:
                minutes[row[0]] += row[_I["min"]] or 0
                starts[row[0]] += row[1]
                appearances[row[0]] += 1
        last = games[-1]["own"]
        last_starters = {row[0] for row in last["p"] if row[1]}
        entries = []
        for pid in appearances:
            player = players.get(pid) or ["", "", None, None]
            # Traded away since: no longer part of this rotation.
            if player[3] and player[3] != team:
                continue
            entries.append({"id": pid, "name": player[0], "pos": player[1], "headshot": headshot(pid, player, league),
                            "min": _round(minutes[pid] / appearances[pid], 1), "games": appearances[pid],
                            "starts": starts[pid], "lastStart": pid in last_starters})
        entries.sort(key=lambda e: (not e["lastStart"], order.get(primary_position([None, e["pos"]]), 3) if e["lastStart"] else 0, -e["min"]))
        result[team] = {"games": len(recent), "lastGame": games[-1]["date"], "players": _with_recent(entries[:13], games)}
    return result


# How far either side of today a team's game dates are kept for rest (the
# page works out back-to-backs and games in a few nights from them).
REST_DAYS = 10


def rest_table(schedule: list, now: datetime | None = None) -> dict:
    """team -> the start times of its games within REST_DAYS of now, in
    order: enough for the page to tell a back-to-back, three games in four
    nights or a long rest before any game this week."""
    now = now or datetime.now(timezone.utc)
    near = {}
    for game in schedule or []:
        try:
            when = datetime.fromisoformat(str(game.get("date")).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            continue
        if abs((when - now).total_seconds()) > REST_DAYS * 86400:
            continue
        for team in (game.get("home"), game.get("away")):
            if team:
                near.setdefault(team, []).append(game["date"])
    return {team: sorted(dates) for team, dates in near.items()}


def league_context(payload: dict, rosters: dict | None = None) -> dict:
    from . import scout
    by_team = team_games(payload)
    players = payload.get("players", {})
    zones, league_zones = zone_defense(by_team)
    return {
        "season": payload.get("season"), "builtAt": payload.get("builtAt"),
        "teams": {abbr: {key: team.get(key) for key in ("id", "name", "short", "logo", "color", "altColor")}
                  for abbr, team in (payload.get("teams") or {}).items() if abbr in by_team},
        "teamCount": len(by_team),
        "stats": [[key, label] for key, label, _ in STATS],
        "dvp": defense_vs_position(by_team, players),
        # The same, a player at a time (the Props tab's NBA score and page).
        "dvpEach": defense_vs_each(by_team, players),
        "teamStats": team_stats(by_team),
        # Pace, ratings and the chances each team's games give (opportunity.py).
        "opportunity": opportunity.team_table(by_team),
        "zoneDefense": zones, "leagueZones": league_zones,
        # Shooting each position gets against a defense, and what else it gives up (scout.py).
        "positionShooting": scout.position_shooting(by_team, players), "teamDefense": scout.team_defense(by_team),
        "rotation": rotation(by_team, players, league=payload.get("league") or "wnba", rosters=rosters),
        "rest": rest_table(payload.get("schedule")),
        "games": {team: len(games) for team, games in by_team.items()},
        # Early in a season the numbers above take last season's games too
        # (api/wnba.py, opportunity.blend). The same tables from this
        # season's games alone, for anything that tells a reader how a team
        # is doing now (the write-ups, Oct 25: "is this true data?").
        "thisSeason": this_season_tables(payload, by_team, players) if payload.get("blended") else None,
    }


def this_season_tables(payload: dict, by_team: dict, players: dict) -> dict | None:
    """The defense tables from this season's games alone, and how many each team has played."""
    season = payload.get("season")
    current = {team: [game for game in games if game.get("season") == season] for team, games in by_team.items()}
    current = {team: games for team, games in current.items() if games}
    if not current:
        return None
    zones, league_zones = zone_defense(current)
    return {"season": season, "games": {team: len(games) for team, games in current.items()}, "teamCount": len(current),
            "dvpEach": defense_vs_each(current, players), "teamStats": team_stats(current),
            "opportunity": opportunity.team_table(current), "zoneDefense": zones, "leagueZones": league_zones}


def _player_rows(by_team: dict) -> dict:
    """player id -> [(game, row)] across the season, for season averages."""
    rows = defaultdict(list)
    for team, games in by_team.items():
        for game in games:
            for row in game["own"]["p"]:
                rows[row[0]].append((game["id"], row))
    return rows


def usage_rate(row: list, team_rows: list) -> float | None:
    """His share of his team's plays while he was on the floor (the usual
    usage rate): his shots, trips to the line and turnovers, against the
    team's, scaled by his minutes. None without minutes or a team box."""
    value = lambda entry, field: entry[_I[field]] or 0
    plays = lambda entry: value(entry, "fga") + 0.44 * value(entry, "fta") + value(entry, "to")
    minutes = value(row, "min")
    team_minutes = sum(value(entry, "min") for entry in team_rows)
    team_plays = sum(plays(entry) for entry in team_rows)
    if not minutes or not team_minutes or not team_plays:
        return None
    return _round(100 * plays(row) * (team_minutes / 5) / (minutes * team_plays), 1)


# A teammate counts as missing from a game when he scored at least this
# much that season, over at least this many games.
OUT_PPG, OUT_GAMES, OUT_SHOWN = 6.0, 3, 3


def game_notes(payloads: list, player_id: str) -> dict:
    """For each stored game the player played: his usage rate, whether he
    started, and the teammates who sat it out that mattered (their season
    scoring, most first), keyed by game id. `payloads` are stored seasons,
    oldest first; any may be missing."""
    notes = {}
    for payload in payloads:
        if not payload:
            continue
        games = list((payload.get("games") or {}).values())
        players = payload.get("players") or {}
        scored = defaultdict(lambda: [0.0, 0])
        for game in games:
            for side in (game.get("t") or {}).values():
                for row in side.get("p", []):
                    if row[_I["pts"]] is not None:
                        scored[row[0]][0] += row[_I["pts"]]
                        scored[row[0]][1] += 1
        for game in games:
            for side in (game.get("t") or {}).values():
                mine = next((row for row in side.get("p", []) if row[0] == player_id), None)
                if not mine:
                    continue
                out = []
                for pid in side.get("dnp", []):
                    points, played = scored.get(pid, (0.0, 0))
                    if played >= OUT_GAMES and points / played >= OUT_PPG:
                        person = players.get(pid) or ["", ""]
                        out.append({"id": pid, "name": person[0], "pos": person[1], "ppg": _round(points / played, 1)})
                out.sort(key=lambda item: -item["ppg"])
                notes[str(game["id"])] = {"usage": usage_rate(mine, side["p"]), "started": bool(mine[1]), "out": out[:OUT_SHOWN]}
    return notes


def player_context(payload: dict, player_id: str, team: str, opponent: str, market: str, line: float | None) -> dict:
    by_team = team_games(payload)
    players = payload.get("players", {})
    stat = MARKET_STAT.get(market, "pts")

    # Shot zones: every located attempt this season, for any team.
    zones = {zone: [0, 0] for zone in ZONES}
    for games in by_team.values():
        for game in games:
            for pid, zone_index, made, attempts in game["own"].get("z", []):
                if pid == player_id:
                    zones[ZONES[zone_index]][0] += made
                    zones[ZONES[zone_index]][1] += attempts

    # With / without each teammate, over this player's games for `team`.
    team_log = [game for game in by_team.get(team, [])
                if any(row[0] == player_id for row in game["own"]["p"])]
    mine = {game["id"]: stat_value(next(row for row in game["own"]["p"] if row[0] == player_id), stat)
            for game in team_log}
    first_seen, teammate_minutes, teammate_games = {}, defaultdict(float), defaultdict(int)
    for game in by_team.get(team, []):
        for row in game["own"]["p"]:
            first_seen.setdefault(row[0], game["date"])
            teammate_minutes[row[0]] += row[_I["min"]] or 0
            teammate_games[row[0]] += 1
        for pid in game["own"]["dnp"]:
            first_seen.setdefault(pid, game["date"])

    def split(values):
        decided = [value for value in values if value is not None]
        hits = sum(1 for value in decided if line is not None and value > line)
        misses = sum(1 for value in decided if line is not None and value < line)
        return {"games": len(decided), "avg": _round(sum(decided) / len(decided)) if decided else None,
                "hits": hits if line is not None else None, "misses": misses if line is not None else None}

    # His opportunity (opportunity.py): over his games, and in each split.
    his_games = opportunity.games_of(by_team, player_id)
    impact = []
    for pid, since in first_seen.items():
        player = players.get(pid) or ["", "", None, None]
        if pid == player_id or (player[3] and player[3] != team):
            continue
        with_ids, without_ids = [], []
        for game in team_log:
            if game["date"] < since:
                continue
            played = any(row[0] == pid for row in game["own"]["p"])
            (with_ids if played else without_ids).append(game["id"])
        impact.append({"id": pid, "name": player[0], "pos": player[1], "headshot": headshot(pid, player, payload.get("league") or "wnba"),
                       "min": _round(teammate_minutes[pid] / teammate_games[pid], 1) if teammate_games[pid] else 0,
                       "with": {**split([mine[g] for g in with_ids]), "gameIds": with_ids, "chances": opportunity.split(his_games, with_ids)},
                       "without": {**split([mine[g] for g in without_ids]), "gameIds": without_ids,
                                   "chances": opportunity.split(his_games, without_ids)}})
    impact.sort(key=lambda item: -(item["min"] or 0))

    # Players like this one against the opponent: every opposing player at a
    # position who played starter minutes against `opponent`, most recent
    # first, measured against their own average in their other games.
    history = _player_rows(by_team)
    similar = {}
    for position in POSITIONS:
        entries = []
        for game in reversed(by_team.get(opponent, [])):
            for row in game["opp"]["p"]:
                minutes = row[_I["min"]]
                if row[0] == player_id or minutes is None or minutes < SIMILAR_MIN_MINUTES:
                    continue
                if primary_position(players.get(row[0])) != position:
                    continue
                value = stat_value(row, stat)
                others = [stat_value(r, stat) for gid, r in history[row[0]] if gid != game["id"]]
                others = [v for v in others if v is not None]
                if value is None or not others:
                    continue
                baseline = sum(others) / len(others)
                player = players.get(row[0]) or ["", "", None, None]
                entries.append({"id": row[0], "name": player[0], "headshot": headshot(row[0], player, payload.get("league") or "wnba"), "team": game["opponent"],
                                "date": game["date"], "gameId": game["id"], "min": minutes,
                                "value": value, "avg": _round(baseline), "diff": _round(value - baseline)})
            if len(entries) >= 10:
                break
        similar[position] = entries[:10]

    player = players.get(player_id) or ["", "", None, None]
    return {"playerId": player_id, "team": team, "opponent": opponent, "market": market, "stat": stat,
            "position": primary_position(player), "line": line,
            "zones": zones, "withWithout": impact, "similar": similar,
            "similarMinMinutes": SIMILAR_MIN_MINUTES, "teamGames": len(team_log),
            "opportunity": opportunity.player_opportunity(his_games),
            # Last season's games are in here too (opportunity.blend) at the start of a season.
            "seasons": payload.get("blended") or [payload.get("season")]}
