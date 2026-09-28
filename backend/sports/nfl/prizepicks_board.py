"""The Finder's NFL lines: PrizePicks' own feed plus the sportsbooks and
other pick'em apps The Odds API carries.

PrizePicks' feed has every market it posts (kickers, punters, defense, first
5 rushes / first 2 catches, goblins and demons). The Odds API adds each
book's main line for the markets it prices: a line several apps share is one
row listing every app's prices, and a line only a sportsbook posts is its
own row. Each line gets its hit rates from nflverse (finder.game_values).

Either source can be down without sinking the board. A PrizePicks line whose
market we cannot chart, or whose player we cannot match, is still shown; it
simply has no hit rates.
"""
from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from math import isfinite, sqrt

from . import finder, markets
from .cache import NFLCacheDomain, cached_nfl
from .services.nflverse import canonical_team

VERSION = "nfl-pp-board-v4"
WINDOWS = (5, 10, 15, 20)
CATEGORY = {"standard": "STANDARD", "goblin": "GOBLIN", "demon": "DEMON"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
# A PrizePicks start time and our schedule's kickoff for the same game.
SAME_GAME_SECONDS = 8 * 3600

# Sportsbooks and apps through The Odds API. Up to 10 bookmakers cost the
# same credits as one; PrizePicks comes from its own feed, so it is not here.
ODDS_BOOKS = ("underdog", "pick6", "draftkings", "fanduel", "betmgm", "williamhill_us", "espnbet", "fanatics",
              "hardrockbet", "pinnacle")
# Asked instead if the provider ever refuses the longer lists: the books and
# markets services/odds.py has always used.
CORE_BOOKS = ("underdog", "draftkings", "fanduel", "betmgm")
BOOK_NAMES = {"prizepicks": "PrizePicks", "underdog": "Underdog", "pick6": "DK Pick6", "draftkings": "DraftKings",
              "fanduel": "FanDuel", "betmgm": "BetMGM", "williamhill_us": "Caesars", "espnbet": "ESPN BET",
              "fanatics": "Fanatics", "hardrockbet": "Hard Rock Bet", "pinnacle": "Pinnacle"}
# The Odds API's NFL player markets -> ours (markets.py).
ODDS_MARKETS = {
    "player_pass_yds": "passing_yards", "player_pass_tds": "passing_touchdowns",
    "player_pass_attempts": "passing_attempts", "player_pass_completions": "pass_completions",
    "player_pass_interceptions": "interceptions", "player_pass_longest_completion": "longest_completion",
    "player_pass_rush_yds": "passing_rushing_yards", "player_rush_yds": "rushing_yards",
    "player_rush_attempts": "rush_attempts", "player_rush_longest": "longest_rush",
    "player_receptions": "receptions", "player_reception_yds": "receiving_yards",
    "player_reception_longest": "longest_reception", "player_rush_reception_yds": "rushing_receiving_yards",
    "player_rush_reception_tds": "touchdowns", "player_kicking_points": "kicking_points",
    "player_field_goals": "fg_made", "player_tackles_assists": "tackles", "player_sacks": "sacks",
    "player_defensive_interceptions": "def_interceptions",
}
# The books' alternate lines ("20+ receiving yards" is Over 19.5) are where a
# Goblin's or Demon's odds come from. They only add prices to a line already
# on the board, never a row of their own. These are the markets the Odds API
# transport (services/odds.py) has always asked alternates for.
ODDS_ALTERNATES = {f"{key}_alternate": ODDS_MARKETS[key] for key in (
    "player_pass_yds", "player_pass_attempts", "player_pass_completions", "player_pass_tds",
    "player_pass_interceptions", "player_rush_yds", "player_rush_attempts", "player_pass_rush_yds",
    "player_reception_yds", "player_receptions", "player_reception_longest", "player_rush_reception_yds",
    "player_rush_reception_tds")}
# The Odds API charges per market returned for each game fetched, so only
# games in the next few days are priced, each at most every half hour
# (cache.py SPORTSBOOK_LINES), and never once the account runs low -- the
# MLB and WNBA boards share the same credits.
ODDS_DAYS = 6
ODDS_CREDIT_FLOOR = 1500


def _finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def _name_key(value):
    parts = re.findall(r"[a-z0-9]+", str(value or "").lower().replace("'", ""))
    if parts and parts[-1] in SUFFIXES:
        parts = parts[:-1]
    return "".join(parts)


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _roster(season):
    """name key -> candidates, every position (kickers, punters, defenders
    included), current season first."""
    by_name = defaultdict(list)
    seen = set()
    for year in (season, season - 1):
        for row in finder.roster_rows(year):
            player_id = str(row.get("gsis_id") or "").strip()
            if not player_id or player_id in ("NA",) or player_id in seen:
                continue
            seen.add(player_id)
            espn = str(row.get("espn_id") or "").strip()
            entry = {"id": player_id, "team": canonical_team(row.get("team")),
                     "position": str(row.get("position") or "").upper(), "name": row.get("full_name") or "",
                     "headshot": f"https://a.espncdn.com/i/headshots/nfl/players/full/{espn}.png"
                     if espn and espn not in ("NA", "0") else (row.get("headshot_url") or "")}
            names = {row.get("full_name"), f"{row.get('football_name') or ''} {row.get('last_name') or ''}",
                     f"{row.get('first_name') or ''} {row.get('last_name') or ''}"}
            for name in names:
                key = _name_key(name)
                if key and entry not in by_name[key]:
                    by_name[key].append(entry)
    return by_name


def _match(roster, name, team):
    candidates = roster.get(_name_key(name), [])
    same_team = [entry for entry in candidates if entry["team"] == team]
    if len(same_team) == 1:
        return same_team[0]
    return candidates[0] if len(candidates) == 1 else None


def _game(games, team, starts):
    """The team's game this line is for."""
    best, best_gap = None, None
    for game in games.values():
        if team not in (game["home"], game["away"]) or game["final"] or not game["kickoff"]:
            continue
        gap = abs(game["kickoff"] - starts) if starts else None
        if starts and gap > SAME_GAME_SECONDS:
            continue
        if best is None or (gap is not None and gap < best_gap):
            best, best_gap = game, gap
    return best


def window(values, line):
    """Hit/miss/push over the given games for a More pick at `line`."""
    if not values:
        return {"hits": 0, "misses": 0, "pushes": 0, "decisions": 0, "hitRate": None, "sample": 0, "average": None}
    pushes = sum(value == line for value in values)
    hits = sum(value > line for value in values)
    decisions = len(values) - pushes
    return {"hits": hits, "misses": decisions - hits, "pushes": pushes, "decisions": decisions,
            "hitRate": hits / decisions * 100 if decisions else None, "sample": len(values),
            "average": sum(values) / len(values)}


def _support(hits, decisions):
    # Wilson lower bound (95%), used only to order the board.
    if not decisions:
        return 0
    z, p = 1.96, hits / decisions
    return (p + z * z / (2 * decisions) - z * sqrt(p * (1 - p) / decisions + z * z / (4 * decisions * decisions))) / (1 + z * z / decisions)


def history_fields(games, market, line, opponent):
    """Windows, streak and support for one line from the player's games."""
    if not market:
        return {"windows": {}, "streak": None, "support": 0, "sample": 0}
    played = [(game, game["values"].get(market)) for game in games]
    values = [value for _game_row, value in played if _finite(value)]
    recent = values[-20:]
    windows = {f"l{n}": window(recent[-n:], line) for n in WINDOWS}
    windows["h2h"] = window([value for game, value in played if _finite(value) and game.get("opponent") == opponent], line)
    streak = 0
    for value in reversed(values):
        if value <= line:
            break
        streak += 1
    l20 = windows["l20"]
    return {"windows": windows, "streak": streak if values else None, "support": _support(l20["hits"], l20["decisions"]),
            "sample": len(recent), "average": windows["l10"]["average"]}


def _projections():
    from prizepicks_export_core import _fetch_projection_rows
    try:
        return _fetch_projection_rows(league="NFL")
    except RuntimeError as error:
        # "no active projections" -- an empty slate, not an outage.
        if "no active" in str(error).lower():
            return []
        raise


def _parse_event_odds(payload, event):
    """One game's player props: each book's Over / Under at each line."""
    if not isinstance(payload, dict) or payload.get("id") != event["eventId"] or not isinstance(payload.get("bookmakers"), list):
        raise ValueError("NFL odds event/schema mismatch")
    lines = []
    for book in payload["bookmakers"]:
        key = book.get("key") if isinstance(book, dict) else None
        if key not in ODDS_BOOKS:
            continue
        quotes = {}
        # Main markets first, so a book's main line wins over its own
        # alternate at the same number.
        for market in sorted(book.get("markets") or [], key=lambda item: str(item.get("key", "")).endswith("_alternate")):
            market_key = market.get("key") if isinstance(market, dict) else None
            ours = ODDS_MARKETS.get(market_key) or ODDS_ALTERNATES.get(market_key)
            if not ours:
                continue
            alternate = market_key in ODDS_ALTERNATES
            seen = {}
            for outcome in market.get("outcomes") or []:
                name, side = str(outcome.get("description") or "").strip(), outcome.get("name")
                point, price = outcome.get("point"), outcome.get("price")
                if not name or side not in ("Over", "Under") or not _finite(point) or point < 0:
                    continue
                spot = (name, ours, float(point))
                if spot in quotes and spot not in seen:
                    continue  # this book's main line is already here
                quote = seen.setdefault(spot, quotes.setdefault(spot, {
                    "book": key, "player": name, "market": ours, "line": float(point), "over": None, "under": None,
                    "updatedAt": market.get("last_update") or book.get("last_update"), "alternate": alternate}))
                if _finite(price):
                    quote[side.lower()] = price
        lines.extend(quotes.values())
    return lines


def _sportsbook_lines(season, now):
    """Every book's lines for the games in the next ODDS_DAYS days, each with
    its game (odds.events maps The Odds API's events onto nflverse games)."""
    from .services import odds
    listing = odds.events(season)
    credits = listing.get("creditsRemaining")
    if credits is not None and credits < ODDS_CREDIT_FLOOR:
        raise RuntimeError(f"Odds API credits are low ({credits}); sportsbook lines paused")
    horizon = now + ODDS_DAYS * 86400
    events = [event for event in listing["data"] if now < (_timestamp(event["startsAt"]) or 0) <= horizon]
    key_id = hashlib.sha256("|".join(odds.credentials()).encode()).hexdigest()[:16]

    def one(event):
        def load():
            def fetch(books, markets):
                return odds._get(f"/sports/{odds.SPORT}/events/{event['eventId']}/odds", {
                    "markets": ",".join(markets), "bookmakers": ",".join(books), "oddsFormat": "american"})
            try:
                response = fetch(ODDS_BOOKS, [*ODDS_MARKETS, *ODDS_ALTERNATES])
            except RuntimeError:
                response = fetch(CORE_BOOKS, list(odds.ALL_MARKETS))
            return _parse_event_odds(response.json(), event)
        try:
            return cached_nfl(NFLCacheDomain.SPORTSBOOK_LINES, (VERSION, event["eventId"], key_id), load)
        except Exception:  # noqa: BLE001 -- one game must not sink the rest
            return []

    with ThreadPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(one, events))
    return [{**line, "event": event} for event, lines in zip(events, results) for line in lines]


def _match_in_game(roster, name, teams):
    candidates = roster.get(_name_key(name), [])
    playing = [entry for entry in candidates if entry["team"] in teams]
    return playing[0] if len(playing) == 1 else None


def _app(key, over=None, under=None, updated=None, modifier="standard"):
    return {"key": key, "name": BOOK_NAMES.get(key, key), "over": over, "under": under, "updatedAt": updated,
            "modifier": modifier}


def build(season, projections=None, now=None, sportsbook_lines=None):
    now = now or datetime.now(timezone.utc).timestamp()
    sources = {}
    if projections is None:
        try:
            projections = _projections()
        except Exception as error:  # noqa: BLE001 -- the sportsbooks' lines still stand
            projections, sources["prizepicksError"] = [], str(error)
    if sportsbook_lines is None:
        try:
            sportsbook_lines = _sportsbook_lines(season, now)
        except Exception as error:  # noqa: BLE001 -- PrizePicks' lines still stand
            sportsbook_lines, sources["sportsbooksError"] = [], str(error)
    games = finder.games_index()
    roster = _roster(season)
    histories = {}
    rows, events = [], {}

    def history_of(player_id):
        if player_id and player_id not in histories:
            try:
                histories[player_id] = finder.game_values(season, player_id, cached=False)
            except Exception:  # noqa: BLE001 -- one player's history must not sink the board
                histories[player_id] = []
        return histories.get(player_id, [])
    for line in projections:
        if line.get("combo"):
            continue
        starts = _timestamp(line.get("start_time"))
        if starts is not None and starts <= now:
            continue
        team = canonical_team(line.get("team"))
        player = _match(roster, line.get("player"), team)
        team = team or (player or {}).get("team")
        position = str(line.get("position") or (player or {}).get("position") or "").upper()
        market = markets.market_for(line.get("stat"), position)
        game = _game(games, team, starts) if team else None
        opponent = (game["away"] if game["home"] == team else game["home"]) if game else canonical_team(line.get("description"))
        category = CATEGORY.get(str(line.get("odds_type") or "standard").lower(), "STANDARD")
        value = line.get("line")
        history = history_fields(history_of((player or {}).get("id")), market, value, opponent)
        game_id = game["game_id"] if game else None
        if game:
            events[game_id] = {"gameId": game_id, "awayTeamId": game["away"], "homeTeamId": game["home"],
                               "startsAt": datetime.fromtimestamp(game["kickoff"], timezone.utc).isoformat()}
        prop_type = market or f"pp:{markets.normalize(line.get('stat'))}"
        rows.append({
            "id": f"pp:{line.get('id')}", "playerId": (player or {}).get("id"), "playerName": line.get("player"),
            "position": position, "headshot": (player or {}).get("headshot") or line.get("headshot") or None,
            "propType": prop_type, "propLabel": line.get("stat"), "teamId": team, "opponentId": opponent,
            "gameId": game_id, "startsAt": datetime.fromtimestamp(starts, timezone.utc).isoformat() if starts else None,
            "line": {"verified": True, "bookmaker": "prizepicks", "platform": "PrizePicks", "category": category,
                     "value": value, "direction": "OVER", "price": None, "updatedAt": line.get("updated_at") or None,
                     "playerId": (player or {}).get("id"), "propType": prop_type, "gameId": game_id},
            "apps": [_app("prizepicks", updated=line.get("updated_at") or None, modifier=category.lower())],
            **history,
        })
    prizepicks_rows = len(rows)

    # Sportsbooks and other apps: a line PrizePicks also posts gains their
    # prices; any other line is its own row.
    by_line = {}
    for row in rows:
        by_line.setdefault((_name_key(row["playerName"]), row["propType"], row["line"]["value"]), row)
    grouped, unmatched = {}, 0
    for quote in sportsbook_lines:
        event = quote["event"]
        key = (_name_key(quote["player"]), quote["market"], quote["line"])
        group = grouped.setdefault(key, {"quote": quote, "event": event, "apps": {}, "main": False})
        group["main"] = group["main"] or not quote.get("alternate")
        group["apps"].setdefault(quote["book"], _app(quote["book"], quote["over"], quote["under"], quote["updatedAt"]))
    for key, group in grouped.items():
        apps = sorted(group["apps"].values(), key=lambda app: ODDS_BOOKS.index(app["key"]))
        existing = by_line.get(key)
        if existing:
            existing["apps"] += [app for app in apps if all(app["key"] != other["key"] for other in existing["apps"])]
            continue
        if not group["main"]:
            continue  # only alternate prices: no line of its own
        quote, event = group["quote"], group["event"]
        teams = (event["homeTeamId"], event["awayTeamId"])
        player = _match_in_game(roster, quote["player"], teams)
        if not player:
            unmatched += 1
            continue
        team, market, value = player["team"], quote["market"], quote["line"]
        opponent = teams[1] if team == teams[0] else teams[0]
        game_id = event["gameId"]
        events[game_id] = {"gameId": game_id, "awayTeamId": event["awayTeamId"], "homeTeamId": event["homeTeamId"],
                           "startsAt": event["startsAt"]}
        first = apps[0]
        rows.append({
            "id": f"odds:{game_id}:{player['id']}:{market}:{value:g}", "playerId": player["id"],
            "playerName": player["name"] or quote["player"], "position": player["position"],
            "headshot": player["headshot"] or None, "propType": market, "propLabel": markets.LABELS.get(market),
            "teamId": team, "opponentId": opponent, "gameId": game_id, "startsAt": event["startsAt"],
            "line": {"verified": True, "bookmaker": first["key"], "platform": first["name"], "category": "STANDARD",
                     "value": value, "direction": "OVER", "price": first["over"], "updatedAt": first["updatedAt"],
                     "playerId": player["id"], "propType": market, "gameId": game_id},
            "apps": apps,
            **history_fields(history_of(player["id"]), market, value, opponent),
        })
    sources.update(prizepicks=prizepicks_rows, sportsbooks=len(rows) - prizepicks_rows, sportsbookQuotes=len(sportsbook_lines),
                   unmatchedPlayers=unmatched)
    if not rows and (sources.get("prizepicksError") or sources.get("sportsbooksError")):
        raise RuntimeError(sources.get("prizepicksError") or sources.get("sportsbooksError"))
    rows.sort(key=lambda row: (row["startsAt"] or "", -row["support"], row["playerName"] or "",
                               markets.ORDER.get(row["propType"], 999), row["line"]["value"]))
    return {"builtAt": datetime.now(timezone.utc).isoformat(), "season": season,
            "source": "prizepicks + the-odds-api + nflverse", "sources": sources,
            "events": sorted(events.values(), key=lambda event: event["startsAt"]), "rows": rows,
            "labels": {key: label for key, label, _code in markets.MARKETS}, "version": VERSION}


def board(season):
    return cached_nfl(NFLCacheDomain.PROPS, (VERSION, "board", season), lambda: build(season))
