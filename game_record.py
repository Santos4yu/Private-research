"""The Game Predictor's own moneyline record (Nov 9, the owner: "Is there any
way to see our full record for the props and moneylines and can we get the
past ones? I want to be able to see the overall record for admin only tho so
for admin just automatically put it in history").

Every game the model picks is kept on its own, not only the picks members
save: each board read (game_predictor.board, at most every five minutes while
anyone has the page open) and the timer twice a day (v2-admin predictor-cron
step=record) write each game's pick while it's still to start, so the last
one before tip-off is what stands. After the game it's settled from ESPN's
final score: right or wrong, and the units at the moneyline it had.

The season so far is filled in (fill) by replaying each finished game the way
it would have been called the morning of it: the ratings from games before
its date only (nba_context and nfl_context are worked out as of a date), the
line ESPN's pick center has for it. Those are marked `filled`.

One hash per league and season (field: ESPN's event id), so a board read, the
timer and a fill step writing at once never lose each other's games.
"""
from __future__ import annotations

import json
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import game_predictor as gp

KEY = "game-predictor:record:v1:{sport}:{season}"
# One fill step: at most this long (a request has 60 s) and this many games.
FILL_SECONDS = 30
FILL_GAMES = 40
# Games settled per read, and the games the page lists.
SETTLE_MOST = 24
SHOWN = 60
# Called this long before its start when a past game is replayed.
REPLAY_BEFORE = timedelta(hours=2)
CONFIDENCE = ("High", "Medium", "Low")


def _now(now):
    return now or datetime.now(timezone.utc)


def season_of(sport, now=None):
    if sport == "nba":
        from backend.sports.wnba import league
        return league.current_season(league="nba")
    return gp._nfl_season(_now(now))


def key_of(sport, season):
    return KEY.format(sport=sport, season=season)


def _store(store):
    return gp._store() if store is None else store


def entries(sport, season, store=None) -> dict:
    """{event id: entry} kept for the league's season."""
    store = _store(store)
    if not store:
        return {}
    flat = store.pipeline([["HGETALL", key_of(sport, season)]])[0].get("result") or []
    out = {}
    for field, raw in zip(flat[0::2], flat[1::2]):
        try:
            entry = json.loads(raw) if isinstance(raw, str) else raw
        except ValueError:
            continue
        if isinstance(entry, dict):
            out[str(field)] = entry
    return out


def _put(sport, season, items, store):
    if not items or not store:
        return
    command = ["HSET", key_of(sport, season)]
    for entry in items:
        command += [entry["id"], json.dumps(entry, separators=(",", ":"))]
    store.pipeline([command])


def _day(start):
    return (start - timedelta(hours=5)).date().isoformat() if start else None


def entry_of(found, now=None, filled=False) -> dict:
    """One game's pick as the record keeps it: the team, our chance and the
    market's for it, its moneyline then (and what a dollar returns), the
    confidence and who made the call."""
    side = found["winner"]
    market = found.get("market") or {}
    price = (market.get("moneyline") or {}).get(side)
    dec = (1 + price / 100 if price > 0 else 1 + 100 / abs(price)) if price is not None and abs(price) >= 100 else None
    market_chance = (market.get("chance") or {}).get(side)
    start = gp._when(found.get("startsAt"))
    return {"id": str(found["id"]), "sport": found["sport"], "day": _day(start), "startsAt": found.get("startsAt"),
            "home": (found.get("home") or {}).get("abbr"), "away": (found.get("away") or {}).get("abbr"), "side": side,
            "chance": round(found["chance"][side], 4), "market": round(market_chance, 4) if market_chance is not None else None,
            "price": price, "dec": round(dec, 4) if dec else None, "confidence": found.get("confidence"), "by": found.get("pickedBy"),
            "score": found.get("score"), "filled": filled, "at": _now(now).isoformat(), "result": None}


def remember(sport, founds, now=None, store=None) -> int:
    """Each game still to start, its pick kept (replacing the one before:
    the last read before tip-off stands). Returns how many changed."""
    now, store = _now(now), _store(store)
    fresh = [found for found in founds or [] if found and found.get("winner") and gp._still_to_start(found, now)]
    if not fresh or not store:
        return 0
    season = season_of(sport, now)
    held = entries(sport, season, store)
    changed = []
    for found in fresh:
        entry = entry_of(found, now)
        before = held.get(entry["id"])
        if before and before.get("result"):
            continue
        same = before and all(before.get(name) == entry.get(name) for name in ("side", "chance", "market", "price", "confidence"))
        if not same:
            changed.append(entry)
    _put(sport, season, changed, store)
    return len(changed)


def settle_due(sport, season, held, now=None, store=None, finals=None) -> int:
    """The kept games that should be over, settled from their final scores."""
    now, store = _now(now), _store(store)
    due = [entry for entry in held.values() if not entry.get("result") and not entry.get("skipped") and (start := gp._when(entry.get("startsAt")))
           and (now - start).total_seconds() >= gp.SETTLE_AFTER[sport]]
    if not due:
        return 0
    due.sort(key=lambda entry: entry.get("startsAt") or "")
    found = (finals or gp._finals)(sport, [entry["id"] for entry in due][:SETTLE_MOST])
    settled = [gp.settle(entry, found[entry["id"]]) for entry in due if entry["id"] in found]
    for entry in settled:
        held[entry["id"]] = entry
    _put(sport, season, settled, store)
    return len(settled)


# ------------------------------------------------------------------ the season so far

_weeks: dict = {}


def _nfl_week_games(season, kind, week):
    key = (season, kind, week)
    hit = _weeks.get(key)
    if hit and time.time() - hit[0] < 6 * 3600:
        return hit[1]
    board = gp._espn("nfl", "/scoreboard", {"week": week, "seasontype": kind, "dates": season})
    games = []
    for event in board.get("events") or []:
        game = gp._event("nfl", event)
        if game["state"] != "post" or not game["home"] or not game["away"]:
            continue
        competition = (event.get("competitions") or [{}])[0]
        scores = {item.get("homeAway"): gp._num(item.get("score")) for item in competition.get("competitors") or []}
        if scores.get("home") is None or scores.get("away") is None:
            continue
        games.append({"id": game["id"], "when": gp._when(game["startsAt"]), "final": (int(scores["home"]), int(scores["away"]))})
    _weeks[key] = (time.time(), games)
    return games


def past_games(sport, now=None, season=None) -> list:
    """This season's finished games before today, oldest first: [{id, when,
    final (home, away)}]. The NBA's from the stored season (regular season
    and playoffs), the NFL's from ESPN's scoreboard a week at a time."""
    now = _now(now)
    season = season or season_of(sport, now)
    if sport == "nba":
        import predictor_nba
        from backend.sports.wnba import league
        games, _ = predictor_nba.games_of(league.ensure(season, "nba") or {})
        today = predictor_nba.us_date(now)
        return [{"id": str(game["id"]), "when": game["when"], "final": (int(game["hs"]), int(game["as"]))} for game in games if game["date"] < today]
    current = gp._espn("nfl", "/scoreboard")
    kind, week = (current.get("season") or {}).get("type"), (current.get("week") or {}).get("number") or 0
    plan = [(2, number) for number in range(1, (week if kind == 2 else 18) + 1)] + ([(3, number) for number in range(1, week + 1)] if kind == 3 else [])
    out = []
    for kind_now, number in plan:
        try:
            out += _nfl_week_games(season, kind_now, number)
        except Exception:  # noqa: BLE001 -- that week waits for the next step
            continue
    today = _day(now)
    return sorted((game for game in out if game["when"] and _day(game["when"]) < today), key=lambda game: (game["when"], game["id"]))


def replay(sport, game, now=None) -> dict | None:
    """One finished game called the way it would have been before it: its
    ESPN summary, the model as of REPLAY_BEFORE its start, then settled."""
    before = game["when"] - REPLAY_BEFORE
    summary = gp._espn(sport, "/summary", {"event": game["id"]})
    parsed = gp.summary_game(sport, game["id"], summary)
    if not parsed.get("home") or not parsed.get("away"):
        return None
    try:
        built, players = gp._model(sport, parsed, before)
    except Exception:  # noqa: BLE001 -- the line alone still calls it
        built, players = None, {}
    found = gp.prediction(sport, parsed, built, players, before)
    if not found:
        return None
    final = gp.final_of(summary) or game["final"]
    return gp.settle(entry_of(found, now, filled=True), final)


def fill(sport, now=None, store=None, seconds=FILL_SECONDS, most=FILL_GAMES, games=None, replayer=None) -> dict:
    """One step of filling in the season so far: the oldest finished games
    the record doesn't have, a date at a time (the ratings worked out once
    per date), until `seconds` or `most` games. {added, remaining, through}."""
    now, store = _now(now), _store(store)
    started = time.time()
    season = season_of(sport, now)
    held = entries(sport, season, store)
    todo = [game for game in (games if games is not None else past_games(sport, now, season)) if game["id"] not in held]
    if not todo:
        return {"added": 0, "remaining": 0, "through": None}
    run = replayer or (lambda game: replay(sport, game, now))
    by_day = {}
    for game in todo:
        by_day.setdefault(_day(game["when"]), []).append(game)
    added, done, through = 0, 0, None
    for day, games_on in sorted(by_day.items()):
        if done and (time.time() - started > seconds or done + len(games_on) > most):
            break
        if replayer is None:
            try:  # The ratings as of this date, once, before the games share them.
                before = games_on[0]["when"] - REPLAY_BEFORE
                gp._nba_v2(before) if sport == "nba" else gp._nfl_v2(before)
            except Exception:  # noqa: BLE001 -- each game falls back on its own
                pass

        def one(game):
            try:
                # A game there's nothing to call it on is kept as skipped, not tried again every step.
                return run(game) or {"id": game["id"], "day": day, "skipped": True}
            except Exception:  # noqa: BLE001 -- that game is tried again next step
                return None
        with ThreadPoolExecutor(max_workers=6) as pool:
            made = [entry for entry in pool.map(one, games_on) if entry]
        _put(sport, season, made, store)
        added += sum(1 for entry in made if not entry.get("skipped"))
        done += len(games_on)
        through = day
    return {"added": added, "remaining": max(0, len(todo) - done), "through": through}


# ------------------------------------------------------------------ the record

def _tally(items) -> dict:
    wins = sum(1 for entry in items if entry["result"]["correct"])
    units = [entry["result"]["units"] for entry in items if entry["result"].get("units") is not None]
    return {"wins": wins, "losses": len(items) - wins, "pct": round(wins / len(items), 4) if items else None,
            "units": round(sum(units), 2) if units else None, "priced": len(units)}


def summary_of(items, now=None) -> dict:
    """The record of the settled games: overall; the last 7 and 30 days;
    when the model took the market's favorite and when it took the
    underdog; by confidence; day by day (newest first)."""
    now = _now(now)
    items = [entry for entry in items if not entry.get("skipped")]
    # The record is the live picks only: made before the game and kept. The
    # season replay (games before the record began, re-run afterwards with
    # only what was known before each one) is counted apart (Nov 9, the
    # owner: 139 games "thats not true ive only had this like 3 days").
    replayed = [entry for entry in items if entry.get("filled") and (entry.get("result") or {}).get("winner")]
    items = [entry for entry in items if not entry.get("filled")]
    settled = [entry for entry in items if (entry.get("result") or {}).get("winner")]
    today = _day(now)
    since = lambda days: (datetime.fromisoformat(today).date() - timedelta(days=days)).isoformat()
    by_day = {}
    for entry in settled:
        by_day.setdefault(entry.get("day") or "", []).append(entry)
    days = [{"day": day, **_tally(group)} for day, group in sorted(by_day.items(), reverse=True) if day]
    return {"games": len(settled), **_tally(settled),
            "last7": _tally([entry for entry in settled if (entry.get("day") or "") >= since(7)]),
            "last30": _tally([entry for entry in settled if (entry.get("day") or "") >= since(30)]),
            "favorites": _tally([entry for entry in settled if entry.get("market") is not None and entry["market"] >= 0.5]),
            "underdogs": _tally([entry for entry in settled if entry.get("market") is not None and entry["market"] < 0.5]),
            "confidence": {level: _tally([entry for entry in settled if entry.get("confidence") == level]) for level in CONFIDENCE},
            "replay": {"games": len(replayed), **_tally(replayed), "since": min((e["day"] for e in replayed if e.get("day")), default=None),
                       "through": max((e["day"] for e in replayed if e.get("day")), default=None)},
            "since": min((entry["day"] for entry in settled if entry.get("day")), default=None),
            "pending": sum(1 for entry in items if not entry.get("result")), "days": days[:45]}


def read(sport, now=None, store=None, finals=None, remaining=None) -> dict:
    """The admin's record for a league: {sport, season, record, items (newest
    first), remaining (past games still to fill in)}. Settles what's due."""
    now, store = _now(now), _store(store)
    season = season_of(sport, now)
    held = entries(sport, season, store)
    try:
        settle_due(sport, season, held, now, store, finals)
    except Exception:  # noqa: BLE001 -- settled on the next look
        pass
    if remaining is None:
        try:
            remaining = sum(1 for game in past_games(sport, now, season) if game["id"] not in held)
        except Exception:  # noqa: BLE001 -- unknown, the page doesn't fill
            remaining = 0
    items = sorted((entry for entry in held.values() if not entry.get("skipped") and not entry.get("filled")), key=lambda entry: entry.get("startsAt") or "", reverse=True)
    return {"sport": sport, "season": season, "record": summary_of([e for e in held.values() if not e.get("skipped")], now), "items": items[:SHOWN], "remaining": remaining}


def timer(sport, now=None, store=None) -> dict:
    """The timer's turn (predictor-cron step=record): today's games picked
    and kept, what's due settled, and a step of the season so far."""
    now = _now(now)
    out = {"sport": sport}
    try:
        day = gp._us_day(now) if sport == "nba" else None
        board = gp.board(sport, now=now, store=store, day=day)
        out["games"] = len(board.get("games") or [])
    except Exception as exc:  # noqa: BLE001 -- settling and filling still run
        out["boardError"] = type(exc).__name__
    try:
        season = season_of(sport, now)
        out["settled"] = settle_due(sport, season, entries(sport, season, _store(store)), now, store)
    except Exception as exc:  # noqa: BLE001
        out["settleError"] = type(exc).__name__
    try:
        out["fill"] = fill(sport, now, store, seconds=15, most=24)
    except Exception as exc:  # noqa: BLE001
        out["fillError"] = type(exc).__name__
    return out
