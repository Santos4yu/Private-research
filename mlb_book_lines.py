"""Sportsbook and app prices for the Finder's MLB lines, from The Odds API.

PrizePicks' own feed (prizepicks_export_core) is what the Finder lists; this
adds every book's price at the same number -- their main lines and their
alternate lines, which are where a Goblin's or Demon's odds come from -- so
the Over / Under ring has something to read. A book's main line that
PrizePicks does not post becomes a line of its own for a player PrizePicks
lists that day.

Cost: one call per game, billed per market returned for the ten books
(which count as one region), each game at most every half hour, only games
starting in the next day and a half, and never once the account is low --
the same credits feed the MLB props board, WNBA and NFL.
"""
import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from prizepicks_export_core import _norm, _norm_stat

SPORT = "baseball_mlb"
BOOKS = ("underdog", "pick6", "draftkings", "fanduel", "betmgm", "williamhill_us", "espnbet", "fanatics",
         "hardrockbet", "pinnacle")
BOOK_NAMES = {"underdog": "Underdog", "pick6": "DK Pick6", "draftkings": "DraftKings", "fanduel": "FanDuel",
              "betmgm": "BetMGM", "williamhill_us": "Caesars", "espnbet": "ESPN BET", "fanatics": "Fanatics",
              "hardrockbet": "Hard Rock Bet", "pinnacle": "Pinnacle", "betrivers": "BetRivers"}
# The Odds API market -> PrizePicks' name for the same prop.
MARKETS = {
    "pitcher_strikeouts": "Pitcher Strikeouts", "pitcher_hits_allowed": "Hits Allowed",
    "pitcher_earned_runs": "Earned Runs Allowed", "pitcher_outs": "Pitching Outs", "pitcher_walks": "Walks Allowed",
    "batter_hits": "Hits", "batter_total_bases": "Total Bases", "batter_rbis": "RBIs",
    "batter_runs_scored": "Runs", "batter_hits_runs_rbis": "Hits+Runs+RBIs", "batter_home_runs": "Home Runs",
    "batter_singles": "Singles", "batter_walks": "Walks", "batter_strikeouts": "Hitter Strikeouts",
    "batter_stolen_bases": "Stolen Bases",
}
ALTERNATES = {f"{key}_alternate": MARKETS[key] for key in (
    "pitcher_strikeouts", "pitcher_hits_allowed", "pitcher_walks", "batter_hits", "batter_total_bases",
    "batter_rbis", "batter_runs_scored", "batter_home_runs", "batter_singles", "batter_walks", "batter_strikeouts")}
# What the site's MLB odds client (v2/board/odds_client.py) already asks for,
# tried in turn if the provider ever refuses the longer lists.
KNOWN = ("pitcher_strikeouts", "pitcher_hits_allowed", "pitcher_earned_runs", "pitcher_outs", "batter_hits",
         "batter_total_bases", "batter_rbis", "batter_runs_scored", "batter_hits_runs_rbis")
ATTEMPTS = (
    (BOOKS, (*MARKETS, *ALTERNATES)),
    (BOOKS, (*KNOWN, *(f"{key}_alternate" for key in KNOWN if f"{key}_alternate" in ALTERNATES))),
    (("underdog", "draftkings", "fanduel", "betmgm", "espnbet", "betrivers", "pinnacle"), KNOWN),
)
CACHE_SECONDS = 30 * 60
HORIZON_SECONDS = 36 * 3600
CREDIT_FLOOR = 1500
SAME_GAME_SECONDS = 8 * 3600
_memory = {}


def _finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value and abs(value) != float("inf")


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def parse_event(payload, event_id):
    """One game's quotes: each book's Over / Under at each number. A book's
    main line wins over its own alternate at the same number."""
    if not isinstance(payload, dict) or payload.get("id") != event_id or not isinstance(payload.get("bookmakers"), list):
        raise ValueError("MLB odds event/schema mismatch")
    lines = []
    for book in payload["bookmakers"]:
        key = book.get("key") if isinstance(book, dict) else None
        if key not in BOOK_NAMES:
            continue
        quotes = {}
        for market in sorted(book.get("markets") or [], key=lambda item: str(item.get("key", "")).endswith("_alternate")):
            market_key = market.get("key") if isinstance(market, dict) else None
            stat = MARKETS.get(market_key) or ALTERNATES.get(market_key)
            if not stat:
                continue
            seen = {}
            for outcome in market.get("outcomes") or []:
                name, side = str(outcome.get("description") or "").strip(), outcome.get("name")
                point, price = outcome.get("point"), outcome.get("price")
                if not name or side not in ("Over", "Under") or not _finite(point) or point < 0:
                    continue
                spot = (name, stat, float(point))
                if spot in quotes and spot not in seen:
                    continue
                quote = seen.setdefault(spot, quotes.setdefault(spot, {
                    "book": key, "player": name, "stat": stat, "line": float(point), "over": None, "under": None,
                    "alternate": market_key in ALTERNATES}))
                if _finite(price):
                    quote[side.lower()] = price
        lines.extend(quotes.values())
    return lines


def _cached_event(event_id, load):
    now = time.time()
    hit = _memory.get(event_id)
    if hit and now - hit[0] < CACHE_SECONDS:
        return hit[1]
    from v2.board import store
    key = f"krazy_data:mlb:book_lines:v1:{event_id}"
    try:
        envelope = json.loads(store.get(key) or "null")
        if envelope and now - float(envelope.get("at", 0)) < CACHE_SECONDS:
            _memory[event_id] = (float(envelope["at"]), envelope["lines"])
            return envelope["lines"]
    except Exception:  # noqa: BLE001 -- the store is an optimization
        pass
    lines = load()
    _memory[event_id] = (now, lines)
    try:
        store.set(key, json.dumps({"at": now, "lines": lines}))
    except Exception:  # noqa: BLE001
        pass
    return lines


def lines(now=None):
    """Every book's quotes for the games starting in the next day and a
    half, each with its game's start."""
    from v2.board import odds_client
    now = now or time.time()
    response = odds_client._get(f"/sports/{SPORT}/events", {"dateFormat": "iso"})
    remaining = response.headers.get("x-requests-remaining") if hasattr(response, "headers") else None
    if str(remaining).isdigit() and int(remaining) < CREDIT_FLOOR:
        raise RuntimeError(f"Odds API credits are low ({remaining}); sportsbook lines paused")
    events = [event for event in response.json() if isinstance(event, dict) and event.get("id")
              and now < (_timestamp(event.get("commence_time")) or 0) <= now + HORIZON_SECONDS]

    def one(event):
        def load():
            for books, markets in ATTEMPTS:
                try:
                    reply = odds_client._get(f"/sports/{SPORT}/events/{event['id']}/odds", {
                        "bookmakers": ",".join(books), "markets": ",".join(markets), "oddsFormat": "american"})
                    return parse_event(reply.json(), event["id"])
                except RuntimeError:
                    continue
            return []
        try:
            quotes = _cached_event(event["id"], load)
        except Exception:  # noqa: BLE001 -- one game must not sink the rest
            return []
        return [{**quote, "eventId": event["id"], "startsAt": event.get("commence_time")} for quote in quotes]

    with ThreadPoolExecutor(max_workers=6) as pool:
        return [quote for batch in pool.map(one, events) for quote in batch]


def _app(quote):
    return {"key": quote["book"], "name": BOOK_NAMES.get(quote["book"], quote["book"]), "over": quote["over"],
            "under": quote["under"]}


def attach(rows, quotes=None):
    """PrizePicks rows with every book's price at the same number (`apps`),
    plus a row for each book main line PrizePicks does not post, for players
    PrizePicks lists in that game."""
    quotes = lines() if quotes is None else quotes
    groups = {}
    for quote in quotes:
        key = (_norm(quote["player"]), _norm_stat(quote["stat"]), quote["line"])
        group = groups.setdefault(key, {"quote": quote, "apps": {}, "main": False})
        group["main"] = group["main"] or not quote.get("alternate")
        group["apps"].setdefault(quote["book"], _app(quote))
    order = {key: index for index, key in enumerate(BOOK_NAMES)}
    out, posted, players = [], set(), {}
    for row in rows:
        try:
            key = (_norm(row["player"]), _norm_stat(row["stat"]), float(row["line"]))
        except (KeyError, TypeError, ValueError):
            out.append(row)
            continue
        posted.add(key)
        players.setdefault(key[0], row)
        books = sorted((groups.get(key) or {}).get("apps", {}).values(), key=lambda app: order.get(app["key"], 99))
        out.append({**row, "apps": [{"key": "prizepicks", "name": "PrizePicks", "over": None, "under": None}, *books]})
    for key, group in groups.items():
        if key in posted or not group["main"]:
            continue
        ref, quote = players.get(key[0]), group["quote"]
        starts, ref_starts = _timestamp(quote.get("startsAt")), _timestamp((ref or {}).get("start_time"))
        if not ref or not starts or not ref_starts or abs(starts - ref_starts) > SAME_GAME_SECONDS:
            continue
        books = sorted(group["apps"].values(), key=lambda app: order.get(app["key"], 99))
        out.append({"id": f"book:{quote['eventId']}:{key[0]}:{key[1]}:{key[2]:g}", "league": "MLB",
                    "player": ref["player"], "stat": quote["stat"], "line": key[2], "odds_type": "standard",
                    "allowed_wager_types": "", "updated_at": "", "headshot": ref.get("headshot", ""),
                    "team": ref.get("team", ""), "position": ref.get("position", ""), "start_time": quote["startsAt"],
                    "description": ref.get("description", ""), "combo": False, "apps": books, "bookOnly": True})
    return out
