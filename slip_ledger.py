"""Graded slips and how they finished.

When a member grades a slip in the Slip Analyzer, the browser saves it here
(save): the slip under the member's account (the last 40), and each pick in
that day's ledger, keyed by the pick itself -- player, stat, line, side --
so the same pick graded by two members, or twice, counts once. A pick keeps
the last tier it was given before its game started; a pick graded after
kickoff is kept for the member but left out of the site's record.

After the games each pick is settled from the final box score
(slip_games.py, the same readers as the live tracking): hit, miss, push, or
void when he didn't play or the game was called off. The timer does it
(tick), and so does a member opening their slips (history).

The record: each tier's hits and misses over the last 30 days.

Before the games the timer also re-reads each pending pick's game news and
tells the members who graded it when the player is ruled out or doubtful, or
when a starter at his position is out and he steps into a bigger role.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import time
from datetime import datetime, timedelta, timezone

PREFIX = "krazy_data:slips:v1:"
USER_SLIPS = 40
LEDGER_DAYS = 40
RECORD_DAYS = 30
RECORD_FRESH = 10 * 60
# How long after the start a game is surely over, and when to give up on one.
DUE_AFTER = {"nfl": 3.6, "nba": 2.8, "wnba": 2.6, "nhl": 3.0, "mlb": 3.4, "soccer": 2.3}
GIVE_UP_AFTER = 48 * 3600
TIERS = ("elite", "strong", "lean", "risky", "fade")
SPORTS = ("nfl", "nba", "wnba", "nhl", "mlb", "soccer")
SIDES = ("OVER", "UNDER")
SETTLE_KINDS = ("key", "mlb", "soccer")
# Where a graded pick came from: a member's slip in the Slip Analyzer, the
# Parlay Builder, the Ace Assistant, or the day's top picks the site logs
# for itself so it learns from results every day (learning.py).
SOURCES = ("analyzer", "builder", "assistant", "board")
# The site's own top picks it logs a day, at most.
LEARN_PER_DAY = 600
_memory: dict = {}


def _store():
    from v2.board import store
    return store


def _pipeline(commands):
    return [entry["result"] for entry in _store().pipeline(commands)]


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _time(value):
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _eastern_day(moment):
    import moneyline_model
    return moneyline_model._eastern(moment).date().isoformat()


def _short(value, size=60):
    return str(value or "").strip()[:size]


def _norm(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def pick_key(pick, day):
    """One pick, however many times it's graded: the player, stat, line,
    side and kind of line, on the day of the game."""
    raw = "|".join((pick["sport"], _norm(pick["player"]), _norm(pick["stat"]), f"{pick['line']:g}", pick["side"], pick["modifier"], day))
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def clean_pick(raw, now):
    """A pick from the browser, checked: or None when it can't be kept."""
    if not isinstance(raw, dict) or raw.get("sport") not in SPORTS or raw.get("side") not in SIDES or raw.get("tier") not in TIERS:
        return None
    line, chance = _number(raw.get("line")), _number(raw.get("chance"))
    player, stat = _short(raw.get("player")), _short(raw.get("stat"))
    if line is None or chance is None or not player or not stat:
        return None
    settle = raw.get("settle") if isinstance(raw.get("settle"), dict) else None
    if settle and (settle.get("kind") not in SETTLE_KINDS or not _short(settle.get("key") or settle.get("field"), 40)):
        settle = None
    if settle:
        settle = {"kind": settle["kind"], "key": _short(settle.get("key"), 40), "field": _short(settle.get("field"), 40),
                  "pitcher": bool(settle.get("pitcher"))}
    starts = _time(raw.get("startsAt"))
    average = _number(raw.get("average"))
    return {"sport": raw["sport"], "player": player, "playerId": _short(raw.get("playerId"), 24), "team": _short(raw.get("team"), 8),
            "opponent": _short(raw.get("opponent"), 8), "startsAt": starts.isoformat() if starts else "",
            "gameId": _short(raw.get("gameId"), 20), "eventId": _short(raw.get("eventId"), 20), "teamId": _short(raw.get("teamId"), 12),
            "opponentId": _short(raw.get("opponentId"), 12), "competition": _short(raw.get("competition"), 30),
            "side": raw["side"], "line": line, "stat": stat, "modifier": _short(raw.get("modifier") or "standard", 12).lower(),
            "tier": raw["tier"], "chance": round(min(1, max(0, chance)), 4), "headshot": _short(raw.get("headshot"), 300),
            # The model's own chance, before the corrections learning.py makes:
            # what the next day's corrections are measured against.
            "raw": round(min(1, max(0, _number(raw.get("raw")))), 4) if _number(raw.get("raw")) is not None else round(min(1, max(0, chance)), 4),
            "source": raw.get("source") if raw.get("source") in SOURCES else "analyzer",
            "position": _short(raw.get("position"), 6), "average": round(average, 2) if average is not None else None,
            "settle": settle, "late": bool(starts and starts <= now)}


# ---------------------------------------------------------------- saving

def save(uid, payload, now=None):
    """Each pick of a graded slip in the ledger (the site's record), and the
    slip in `uid`'s list when they track it (payload["track"]): a new id, or
    the same id again after a pick is fixed or swapped. A slip only graded,
    not tracked, adds no owner (no alerts) and nothing to their list."""
    now = now or datetime.now(timezone.utc)
    if not uid or not isinstance(payload, dict):
        raise ValueError("A graded slip is required.")
    slip_id = _short(payload.get("id"), 40)
    if not re.fullmatch(r"[a-z0-9-]{8,40}", slip_id):
        raise ValueError("A slip id is required.")
    picks = [pick for pick in (clean_pick(raw, now) for raw in (payload.get("picks") or [])[:8]) if pick]
    if not picks:
        raise ValueError("No graded picks to keep.")
    store = _store()
    track = payload.get("track", True) is not False
    entries = []
    for pick in picks:
        starts = _time(pick["startsAt"]) or now
        day = _eastern_day(starts)
        key = pick_key(pick, day)
        entries.append((day, key, pick))
    # The ledger: one hash a day; a pick already in it keeps its owners and,
    # once its game has started, the tier it had then. Its owners are those
    # tracking a slip with it (they get its alerts).
    reads = _pipeline([["HGET", PREFIX + "ledger:" + day, key] for day, key, _ in entries])
    writes = []
    for (day, key, pick), raw in zip(entries, reads):
        held = _load(raw)
        if held:
            owners = sorted(set(held.get("owners") or []) | ({str(uid)} if track else set()))[:50]
            if pick["late"] or held.get("result"):
                held["owners"] = owners
                pick = held
            else:
                pick = {**held, **{name: value for name, value in pick.items() if name != "late"}, "late": held.get("late", False) and pick["late"],
                        "owners": owners}
        else:
            pick = {**pick, "owners": [str(uid)] if track else [], "result": None, "value": None, "alerted": [], "at": now.isoformat()}
        writes.append(["HSET", PREFIX + "ledger:" + day, key, json.dumps(pick, separators=(",", ":"))])
        writes.append(["EXPIRE", PREFIX + "ledger:" + day, LEDGER_DAYS * 86400])
    # The site's parlays, for the record by grade: each parlay once a day,
    # graded as it was the first time (learning.py parlay_record).
    letter = _short(payload.get("letter"), 3)
    if letter:
        first = entries[0][0]
        parlay = {"letter": letter, "type": _short(payload.get("type"), 12),
                  "source": payload.get("source") if payload.get("source") in SOURCES else "analyzer",
                  "late": any(pick["late"] for _, _, pick in entries), "at": now.isoformat(),
                  "picks": [{"day": day, "key": key} for day, key, _ in entries]}
        signature = "|".join(sorted(key for _, key, _ in entries))
        writes.append(["HSETNX", PREFIX + "parlays:" + first, signature, json.dumps(parlay, separators=(",", ":"))])
        writes.append(["EXPIRE", PREFIX + "parlays:" + first, LEDGER_DAYS * 86400])
    _pipeline(writes)
    # The member's slips, newest first. The same parlay graded again (the same
    # props, in any order) is the slip already kept, not a new one: it keeps
    # its place, its time and, once a game has started, the grade it had then.
    user_key = PREFIX + "user:" + str(uid)
    slip = {"id": slip_id, "at": now.isoformat(), "app": _short(payload.get("app"), 20), "appName": _short(payload.get("appName"), 30),
            "type": _short(payload.get("type"), 12), "letter": _short(payload.get("letter"), 3),
            "chance": _number(payload.get("chance")), "multiplier": _number(payload.get("multiplier")), "value": _number(payload.get("value")),
            "picks": [{"day": day, "key": key} for day, key, _ in entries]}
    kept = [item for item in (_load(store.get(user_key)) or []) if isinstance(item, dict)]
    twins = [item for item in kept if item.get("id") != slip_id and _parlay(item) == _parlay(slip)]
    same = twins[-1] if twins else None  # the first time it was kept
    mine = same or next((item for item in kept if item.get("id") == slip_id), None)
    if not track:
        # Only graded: their list as it was (saying so when it's a slip they already track).
        return {"id": mine["id"] if mine else slip_id, "picks": len(entries), "tracked": bool(mine), "again": bool(same)}
    if mine:
        started = any(pick["late"] for _, _, pick in entries)
        slip = {**slip, "id": mine["id"], "at": mine.get("at") or slip["at"],
                **({name: mine.get(name) for name in ("type", "letter", "chance", "multiplier", "value")} if same and started else {})}
        kept = [slip if item is mine else item for item in kept
                if item is mine or (item.get("id") != slip_id and not any(item is twin for twin in twins))]
    else:
        kept = [slip, *kept]
    store.set(user_key, json.dumps(kept[:USER_SLIPS], separators=(",", ":")), ex=120 * 86400)
    return {"id": slip["id"], "picks": len(entries), "tracked": True, "again": bool(same)}


def learn(payload, now=None):
    """The day's top picks as the site graded them (the Parlay Builder and Ace
    Assistant send them as they grade the boards), into the ledger to be
    settled and learned from. A pick already there is left as it is, and no
    more than LEARN_PER_DAY are taken a day."""
    now = now or datetime.now(timezone.utc)
    raws = (payload or {}).get("picks") if isinstance(payload, dict) else None
    picks = [pick for pick in (clean_pick({**raw, "source": raw.get("source") or "board"}, now) for raw in (raws or [])[:150]
                               if isinstance(raw, dict)) if pick and not pick["late"]]
    if not picks:
        return {"kept": 0}
    budget = PREFIX + "learned:" + _eastern_day(now)
    used = _pipeline([["INCRBY", budget, len(picks)], ["EXPIRE", budget, 2 * 86400]])[0] or 0
    room = LEARN_PER_DAY - (int(used) - len(picks))
    if room <= 0:
        return {"kept": 0}
    writes = []
    for pick in picks[:room]:
        day = _eastern_day(_time(pick["startsAt"]) or now)
        held = {**pick, "owners": [], "result": None, "value": None, "alerted": [], "at": now.isoformat()}
        writes.append(["HSETNX", PREFIX + "ledger:" + day, pick_key(pick, day), json.dumps(held, separators=(",", ":"))])
        writes.append(["EXPIRE", PREFIX + "ledger:" + day, LEDGER_DAYS * 86400])
    added = _pipeline(writes)[0::2]
    return {"kept": sum(1 for value in added if value)}


def parlays(days):
    """The site's graded parlays on these days: [(day, signature, parlay)]."""
    reads = _pipeline([["HGETALL", PREFIX + "parlays:" + day] for day in days])
    out = []
    for day, flat in zip(days, reads):
        flat = flat or []
        for key, raw in zip(flat[0::2], flat[1::2]):
            parlay = _load(raw)
            if isinstance(parlay, dict):
                out.append((day, key, parlay))
    return out


def remove(uid, slip_id):
    """Stop tracking a slip: off `uid`'s list (with any copy of the same
    parlay), and off its picks' owners where no other slip of theirs has them.
    The picks stay in the site's record."""
    if not uid or not re.fullmatch(r"[a-z0-9-]{8,40}", str(slip_id or "")):
        raise ValueError("A slip id is required.")
    store = _store()
    user_key = PREFIX + "user:" + str(uid)
    kept = [item for item in (_load(store.get(user_key)) or []) if isinstance(item, dict)]
    gone = next((item for item in kept if item.get("id") == slip_id), None)
    if not gone:
        return {"removed": 0}
    left = [item for item in kept if item.get("id") != slip_id and _parlay(item) != _parlay(gone)]
    store.set(user_key, json.dumps(left, separators=(",", ":")), ex=120 * 86400)
    still = {ref.get("key") for item in left for ref in item.get("picks") or [] if isinstance(ref, dict)}
    refs = [(ref.get("day"), ref.get("key")) for ref in gone.get("picks") or []
            if isinstance(ref, dict) and ref.get("day") and ref.get("key") and ref.get("key") not in still]
    if refs:
        reads = _pipeline([["HGET", PREFIX + "ledger:" + day, key] for day, key in refs])
        writes = []
        for (day, key), raw in zip(refs, reads):
            held = _load(raw)
            if held and str(uid) in (held.get("owners") or []):
                held["owners"] = [owner for owner in held["owners"] if owner != str(uid)]
                writes.append(["HSET", PREFIX + "ledger:" + day, key, json.dumps(held, separators=(",", ":"))])
        if writes:
            _pipeline(writes)
    return {"removed": len(kept) - len(left)}


def _parlay(slip):
    """What makes two kept slips the same parlay: the same props (player,
    stat, line, side and kind of line, on the game's day), in any order."""
    return tuple(sorted(ref.get("key") or "" for ref in slip.get("picks") or [] if isinstance(ref, dict)))


def _once(slips):
    """Each parlay once, where it was first kept (newest first)."""
    seen, kept = set(), []
    for slip in reversed(slips):
        if _parlay(slip) not in seen:
            seen.add(_parlay(slip))
            kept.append(slip)
    return kept[::-1]


def _load(raw):
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- settling

def mlb_value(stat, field):
    """An MLB line's number from MLB's box score fields, the way the Finder
    adds them up (src/prop-finder-core.js gameValue)."""
    def n(name):
        return float(stat.get(name) or 0)

    def outs():
        if stat.get("outs") is not None:
            return n("outs")
        whole, _, part = str(stat.get("inningsPitched") or "0").partition(".")
        return float(whole or 0) * 3 + float(part or 0)
    if field == "hrr":
        return n("hits") + n("runs") + n("rbi")
    if field == "runsRbi":
        return n("runs") + n("rbi")
    if field == "extraBaseHits":
        return n("doubles") + n("triples") + n("homeRuns")
    if field == "hitsWalks":
        return n("hits") + n("baseOnBalls")
    singles = n("hits") - n("doubles") - n("triples") - n("homeRuns")
    if field == "fantasy":
        return (singles * 3 + n("doubles") * 5 + n("triples") * 8 + n("homeRuns") * 10 + n("runs") * 2 + n("rbi") * 2
                + n("baseOnBalls") * 2 + n("hitByPitch") * 2 + n("stolenBases") * 5)
    if field == "outs":
        return outs()
    if field == "totalBases" and stat.get("totalBases") is None:
        return n("hits") + n("doubles") + 2 * n("triples") + 3 * n("homeRuns")
    if field == "singles":
        return singles
    if field == "numberOfPitches":
        value = stat.get("numberOfPitches", stat.get("pitchesThrown"))
        return None if value is None else float(value)
    if field == "pitcherFantasy":
        earned = n("earnedRuns")
        return n("wins") * 6 + (4 if outs() >= 18 and earned <= 3 else 0) - earned * 3 + n("strikeOuts") * 3 + outs()
    return None if stat.get(field) is None else float(stat[field])


def value_of(settle, player):
    """The player's final number for the pick's stat, or None when he didn't play."""
    if not settle or not player or player.get("played") is False:
        return None
    line = player.get("line") or {}
    if settle["kind"] == "key":
        value = line.get(settle["key"])
        return _number(value)
    if settle["kind"] == "mlb":
        stat = line.get("pitching" if settle.get("pitcher") else "batting") or {}
        return mlb_value(stat, settle["field"]) if stat else None
    if settle["kind"] == "soccer":
        stats = line.get("s") or {}
        if settle["key"] == "ga":
            goals, assists = _number(stats.get("goals")), _number(stats.get("ast"))
            return goals + assists if goals is not None and assists is not None else None
        if settle["key"] == "min":
            return _number(line.get("min"))
        return _number(stats.get(settle["key"]))
    return None


def outcome(value, line, side):
    if value is None:
        return "void"
    if value == line:
        return "push"
    return "hit" if (value > line) == (side == "OVER") else "miss"


def _game_items(entries):
    """The ledger entries grouped into slip_games requests, one per game."""
    games = {}
    for key, pick in entries:
        group = (pick["sport"], pick.get("eventId") or pick.get("gameId") or "", pick["team"], pick["opponent"], (pick["startsAt"] or "")[:10])
        item = games.setdefault(group, {"sport": pick["sport"], "team": pick["team"], "opponent": pick["opponent"], "startsAt": pick["startsAt"],
                                        "gameId": pick.get("gameId") or "", "eventId": pick.get("eventId") or "", "teamId": pick.get("teamId") or "",
                                        "opponentId": pick.get("opponentId") or "", "competition": pick.get("competition") or "", "players": []})
        if len(item["players"]) < 12:
            item["players"].append({"key": key, "name": pick["player"], "id": "" if pick["sport"] in ("nfl", "soccer") else pick.get("playerId") or ""})
    return list(games.values())


def _read_games(items):
    import slip_games
    views = []
    for start in range(0, len(items), slip_games.MAX_GAMES):
        views.extend(slip_games.read({"games": items[start:start + slip_games.MAX_GAMES]})["games"])
    return views


def _ledger(days):
    reads = _pipeline([["HGETALL", PREFIX + "ledger:" + day] for day in days])
    out = []
    for day, flat in zip(days, reads):
        flat = flat or []
        for key, raw in zip(flat[0::2], flat[1::2]):
            pick = _load(raw)
            if isinstance(pick, dict):
                out.append((day, key, pick))
    return out


def _days(now, back):
    today = datetime.fromisoformat(_eastern_day(now)).date()
    return [(today - timedelta(days=offset)).isoformat() for offset in range(back)]


def settle(entries, now, limit=8):
    """Settle the entries whose games should be over: {(day, key): pick}
    for the ones that changed. At most `limit` games are read."""
    due = []
    for day, key, pick in entries:
        if pick.get("result"):
            continue
        starts = _time(pick.get("startsAt"))
        if not starts or (now - starts).total_seconds() < DUE_AFTER.get(pick["sport"], 3.5) * 3600:
            continue
        due.append((day, key, pick))
    if not due:
        return {}
    by_key = {key: (day, pick) for day, key, pick in due}
    items = _game_items([(key, pick) for _, key, pick in due])[:limit]
    changed = {}
    for item, view in zip(items, _read_games(items)):
        for person in item["players"]:
            day, pick = by_key[person["key"]]
            starts = _time(pick.get("startsAt"))
            overdue = starts and (now - starts).total_seconds() > GIVE_UP_AFTER
            if not view.get("found"):
                if overdue:
                    changed[(day, person["key"])] = {**pick, "result": "unknown"}
                continue
            if view.get("off"):
                changed[(day, person["key"])] = {**pick, "result": "void"}
                continue
            if view.get("state") != "post":
                if overdue:
                    changed[(day, person["key"])] = {**pick, "result": "unknown"}
                continue
            player = (view.get("players") or {}).get(person["key"])
            value = value_of(pick.get("settle"), player) if pick.get("settle") else None
            if not pick.get("settle"):
                result = "unknown"
            else:
                result = outcome(value, pick["line"], pick["side"])
            changed[(day, person["key"])] = {**pick, "result": result, "value": value, "settledAt": now.isoformat()}
    if changed:
        _pipeline([["HSET", PREFIX + "ledger:" + day, key, json.dumps(pick, separators=(",", ":"))] for (day, key), pick in changed.items()])
    return changed


# ---------------------------------------------------------------- reading

def record(now=None, entries=None):
    """Each tier's hits and misses over the last RECORD_DAYS: picks graded
    before their game, settled hit or miss."""
    now = now or datetime.now(timezone.utc)
    held = _memory.get("record")
    if entries is None and held and time.time() - held[0] < RECORD_FRESH:
        return held[1]
    rows = entries if entries is not None else _ledger(_days(now, RECORD_DAYS))
    tiers = {tier: {"hits": 0, "misses": 0} for tier in TIERS}
    for _, _, pick in rows:
        if pick.get("late") or pick.get("result") not in ("hit", "miss") or pick.get("tier") not in tiers:
            continue
        tiers[pick["tier"]]["hits" if pick["result"] == "hit" else "misses"] += 1
    for counts in tiers.values():
        decided = counts["hits"] + counts["misses"]
        counts["picks"] = decided
        counts["rate"] = round(counts["hits"] / decided, 4) if decided else None
    out = {"days": RECORD_DAYS, "tiers": tiers, "picks": sum(counts["picks"] for counts in tiers.values()), "at": now.isoformat()}
    if entries is None:
        _memory["record"] = (time.time(), out)
    return out


def _status(picks):
    """lost once a pick misses, pending while any is undecided, then won
    (void when nothing counted: every pick voided or pushed)."""
    results = [pick.get("result") for pick in picks]
    if "miss" in results:
        return "lost"
    if any(result is None for result in results):
        return "pending"
    return "won" if "hit" in results else "void"


def history(uid, now=None, settle_limit=4):
    """The member's graded slips with each pick's result (settling what's
    due on the way), and the site's record."""
    now = now or datetime.now(timezone.utc)
    slips = _once([slip for slip in (_load(_store().get(PREFIX + "user:" + str(uid))) or []) if isinstance(slip, dict)])
    wanted = sorted({ref["day"] for slip in slips for ref in slip.get("picks") or [] if isinstance(ref, dict) and ref.get("day")})
    ledger = {(day, key): pick for day, key, pick in _ledger(wanted)} if wanted else {}
    mine = [(day, key, pick) for (day, key), pick in ledger.items()
            if any(ref.get("key") == key for slip in slips for ref in slip.get("picks") or [])]
    try:
        for (day, key), pick in settle(mine, now, limit=settle_limit).items():
            ledger[(day, key)] = pick
    except Exception:  # noqa: BLE001 -- results come on the next look
        pass
    shown = []
    for slip in slips:
        picks = []
        for ref in slip.get("picks") or []:
            pick = ledger.get((ref.get("day"), ref.get("key")))
            if pick:
                picks.append({name: pick.get(name) for name in ("player", "stat", "line", "side", "modifier", "tier", "chance", "headshot",
                                                                 "sport", "team", "opponent", "startsAt", "result", "value")})
        if picks:
            hits = sum(pick["result"] == "hit" for pick in picks)
            shown.append({**{name: slip.get(name) for name in ("id", "at", "app", "appName", "type", "letter", "chance", "multiplier", "value")},
                          "picks": picks, "hits": hits, "status": _status(picks)})
    # The site's parlays by their grade, as the daily learning step counted them.
    try:
        import learning
        learned = learning.model(now) or {}
    except Exception:  # noqa: BLE001 -- shown once there's a count
        learned = {}
    return {"slips": shown, "record": {**record(now), "parlays": learned.get("parlays") or {},
                                       "parlayDays": learned.get("parlayDays") or RECORD_DAYS}}


# ---------------------------------------------------------------- the news, before the games

OUT = re.compile(r"\bout\b|injured reserve|\bir\b|\bil\b|\d+-day|suspen|inactive|physically unable|non-football", re.I)
LONG_TERM = re.compile(r"injured reserve|\bir\b|physically unable|\bpup\b|non-football|suspen|\d+-day", re.I)
GROUP = {"HB": "RB", "FB": "RB", "PG": "G", "SG": "G", "SF": "F", "PF": "F"}


def status_level(text):
    text = str(text or "")
    if OUT.search(text):
        return "out"
    if re.search(r"doubt", text, re.I):
        return "doubtful"
    return None


def _group(position):
    position = re.split(r"[-/]", str(position or "").upper())[0]
    return GROUP.get(position, position)


def news_alerts(pick, view):
    """What's changed for a pending pick in its game's news: [(tag, title, body)]."""
    import slip_games
    team = view.get("team")
    report = (view.get("injuries") or {}).get(team) or []
    last = (slip_games.words(pick["player"]) or [pick["player"]])[-1].title()
    line = f"{pick['player']} {'Over' if pick['side'] == 'OVER' else 'Under'} {pick['line']:g} {pick['stat']}"
    out = []
    own = slip_games.find_person(report, pick["player"])
    level = status_level(own.get("status")) if own else None
    if level:
        body = (f"{pick['player']} is listed {own['status']}. Picks on a player who doesn't play are usually voided."
                if level == "out" else f"{pick['player']} is listed Doubtful and may not play. Recheck your {line}.")
        out.append((f"status:{level}", "Slip update", body))
    average = pick.get("average")
    # Hockey skaters share the ice four lines deep: one out doesn't hand another his job (slip-games.js newsFacts).
    one_job = not (pick.get("sport") == "nhl" and _group(pick.get("position")) != "G")
    if one_job and pick.get("position") and average is not None and (average <= 0 or pick["line"] >= 1.4 * average):
        for mate in report:
            if mate is own or _group(mate.get("position")) != _group(pick["position"]) or LONG_TERM.search(str(mate.get("status") or "")):
                continue
            if status_level(mate.get("status")) not in ("out", "doubtful"):
                continue
            name = (slip_games.words(mate.get("name")) or [mate.get("name")])[-1].title()
            out.append((f"role:{_norm(mate.get('name'))}", "Slip update",
                        f"{name} ({mate.get('position')}) is out, so {last} likely steps in. Recheck your {line}."))
            break
    return out


def alerts(entries, now, limit=8):
    """Tell the members who graded a pending pick what changed in its news,
    once per change: {sent, picks}."""
    upcoming = [(day, key, pick) for day, key, pick in entries if not pick.get("result") and pick.get("owners")
                and (starts := _time(pick.get("startsAt"))) and timedelta(0) < starts - now < timedelta(hours=30)]
    if not upcoming:
        return {"sent": 0, "picks": 0}
    by_key = {key: (day, pick) for day, key, pick in upcoming}
    items = _game_items([(key, pick) for _, key, pick in upcoming])[:limit]
    messages, changed = {}, {}
    for item, view in zip(items, _read_games(items)):
        if not view.get("found"):
            continue
        for person in item["players"]:
            day, pick = by_key[person["key"]]
            fresh = [alert for alert in news_alerts(pick, view) if alert[0] not in (pick.get("alerted") or [])]
            if not fresh:
                continue
            for tag, title, body in fresh:
                for owner in pick["owners"]:
                    messages.setdefault(owner, []).append({"title": title, "body": body[:180], "url": "/slip-analyzer",
                                                           "tag": f"slip-{person['key']}"})
            changed[(day, person["key"])] = {**pick, "alerted": [*(pick.get("alerted") or []), *(alert[0] for alert in fresh)]}
    if changed:
        _pipeline([["HSET", PREFIX + "ledger:" + day, key, json.dumps(pick, separators=(",", ":"))] for (day, key), pick in changed.items()])
    sent = 0
    if messages:
        import push_notices
        sent = (push_notices.deliver(messages) or {}).get("sent", 0)
    return {"sent": sent, "picks": len(changed)}


TICK_EVERY = 10 * 60


def tick(now=None, limit=8):
    """The timer's turn (at most every TICK_EVERY): settle what's due, send
    what's changed, and once a day learn from the results (learning.py)."""
    now = now or datetime.now(timezone.utc)
    stamp = PREFIX + "tick"
    if not _pipeline([["SET", stamp, now.isoformat(), "NX", "EX", TICK_EVERY]])[0]:
        last = _time(_store().get(stamp))
        if last and 0 <= (now - last).total_seconds() < TICK_EVERY:
            return {"skipped": True}
        _store().set(stamp, now.isoformat(), ex=TICK_EVERY)
    entries = _ledger(_days(now + timedelta(days=1), 4))
    settled = settle(entries, now, limit=limit)
    entries = [(day, key, settled.get((day, key), pick)) for day, key, pick in entries]
    news = alerts(entries, now, limit=limit)
    learned = None
    try:
        import learning
        fitted = learning.daily(now)
        learned = {"picks": fitted["picks"], "at": fitted["at"]} if fitted else None
    except Exception:  # noqa: BLE001 -- never at the cost of settling
        learned = None
    return {"settled": len(settled), **news, "learned": learned}


# ---------------------------------------------------------------- public record

PUBLIC_TIERS = ("elite", "strong")
PUBLIC_RECENT = 24
PUBLIC_DAYS = 14
# A pick's public face: what was picked and how it finished -- never who
# graded it (owners), nor how it was settled.
PUBLIC_FIELDS = ("player", "sport", "stat", "line", "side", "tier", "result", "value", "modifier", "team", "opponent", "headshot")


def public_results(now=None, entries=None):
    """The site's record for anyone to see (the /results page): Elite and
    Strong picks graded before their games and settled from the final box
    score over the last RECORD_DAYS -- by tier, by sport, by day -- and the
    latest finished ones. Only finished games: today's open picks stay
    members-only."""
    now = now or datetime.now(timezone.utc)
    held = _memory.get("public")
    if entries is None and held and time.time() - held[0] < RECORD_FRESH:
        return held[1]
    rows = entries if entries is not None else _ledger(_days(now, RECORD_DAYS))
    done = [(day, pick) for day, _, pick in rows
            if not pick.get("late") and pick.get("tier") in PUBLIC_TIERS and pick.get("result") in ("hit", "miss")]

    def tally(picks):
        hits = sum(1 for pick in picks if pick["result"] == "hit")
        decided = len(picks)
        return {"hits": hits, "misses": decided - hits, "picks": decided, "rate": round(hits / decided, 4) if decided else None}

    tiers = {tier: tally([pick for _, pick in done if pick["tier"] == tier]) for tier in PUBLIC_TIERS}
    sports = {sport: tally([pick for _, pick in done if pick.get("sport") == sport]) for sport in SPORTS}
    recent_days = _days(now, PUBLIC_DAYS)
    days = [{"day": day, **tally([pick for d, pick in done if d == day])} for day in reversed(recent_days)]
    latest = sorted(done, key=lambda item: (_time(item[1].get("startsAt")) or now).timestamp(), reverse=True)[:PUBLIC_RECENT]
    out = {"days": RECORD_DAYS, "tiers": tiers, "all": tally([pick for _, pick in done]),
           "sports": {sport: counts for sport, counts in sports.items() if counts["picks"]},
           "daily": days,
           "recent": [{**{field: pick.get(field) for field in PUBLIC_FIELDS}, "day": day} for day, pick in latest],
           "at": now.isoformat()}
    if entries is None:
        _memory["public"] = (time.time(), out)
    return out
