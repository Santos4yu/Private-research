"""Graded slips and how they finished.

When a member grades a slip in the Slip Analyzer, the browser saves it here
(save): the slip under the member's account (the last 40), and each pick in
that day's ledger, keyed by the pick itself -- player, stat, line, side --
so the same pick graded by two members, or twice, counts once. A pick keeps
the last tier it was given before its game started. The ledger is for the
members' own slips, their alerts and what the model learns (learning.py):
none of it is the site's record.

After the games each pick is settled from the final box score
(slip_games.py, the same readers as the live tracking): hit, miss, push, or
void when he didn't play or the game was called off. The timer does it
(tick), and so does a member opening their slips (history).

The record (the /results page and the record in the app) is only the slips
the admin posts from the Slip Analyzer (record_add) and the finished plays
the admin types in or reads off screenshots (record_enter, record_enter_many),
kept apart from the ledger and settled
the same way: each tier's hits and misses over the last
30 days. Members grading slips never touch it.

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
DUE_AFTER = {"nfl": 3.6, "cfb": 3.8, "nba": 2.8, "wnba": 2.6, "nhl": 3.0, "mlb": 3.4, "soccer": 2.3}
GIVE_UP_AFTER = 48 * 3600
TIERS = ("elite", "strong", "lean", "risky", "fade")
SPORTS = ("nfl", "cfb", "nba", "wnba", "nhl", "mlb", "soccer")
SIDES = ("OVER", "UNDER")
SETTLE_KINDS = ("key", "mlb", "soccer")
# Where a graded pick came from: a member's slip in the Slip Analyzer, the
# Parlay Builder, the Scout Assistant, or the day's top picks the site logs
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
            # The stat it's on, as learning.py keeps its corrections ("rbis").
            "group": re.sub(r"[^a-z0-9+ ]+", " ", _short(raw.get("group"), 40).lower()).strip(),
            # Which model graded it (learning.py BASIS).
            "model": raw.get("model") if raw.get("model") in (1, 2) else 1,
            "position": _short(raw.get("position"), 6), "average": round(average, 2) if average is not None else None,
            "settle": settle, "late": bool(starts and starts <= now)}


# ---------------------------------------------------------------- saving

def save(uid, payload, now=None):
    """Each pick of a graded slip in the ledger (members' slips, not the site's record), and the
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
    The picks stay in the ledger."""
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


def _ledger(days, space="ledger:"):
    reads = _pipeline([["HGETALL", PREFIX + space + day] for day in days])
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


def settle(entries, now, limit=8, space="ledger:"):
    """Settle the entries whose games should be over: {(day, key): pick}
    for the ones that changed. At most `limit` games are read. `space` is
    where they're kept: the ledger, or the admin's record (RECORD)."""
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
            elif pick["sport"] == "cfb" and not player:
                # A college box score lists only who recorded a stat: no
                # catch and not playing look the same, so it isn't called.
                result = "unknown"
            else:
                result = outcome(value, pick["line"], pick["side"])
            changed[(day, person["key"])] = {**pick, "result": result, "value": value, "settledAt": now.isoformat()}
    if changed:
        _pipeline([["HSET", PREFIX + space + day, key, json.dumps(pick, separators=(",", ":"))] for (day, key), pick in changed.items()])
    return changed


# ---------------------------------------------------------------- reading

def record(now=None, entries=None):
    """Each tier's hits and misses over the last RECORD_DAYS: the admin's
    record (RECORD), settled hit or miss."""
    now = now or datetime.now(timezone.utc)
    held = _memory.get("record")
    if entries is None and held and time.time() - held[0] < RECORD_FRESH:
        return held[1]
    rows = entries if entries is not None else _ledger(_days(now, RECORD_DAYS), RECORD)
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
    due on the way), and the site's record (the admin's, RECORD)."""
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
    # Only the admin's record: not the members' parlays (learning.py counts those for the model).
    return {"slips": shown, "record": record(now)}


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


# What the injury report's note says is held back (workload.py's kinds).
HELD = {"snaps": "a snap count", "touches": "a limited number of touches", "minutes": "a minutes limit",
        "icetime": "limited ice time", "pitches": "a pitch count", "innings": "an innings limit", "workload": "a limited workload"}


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
    # Held back today: a snap count, a minutes limit, a pitch count (workload.py).
    limit = (own or {}).get("limit") or {}
    if limit.get("kind") and not limit.get("cleared") and level != "out" and pick.get("side") == "OVER":
        held = HELD.get(limit["kind"], HELD["workload"])
        out.append((f"limit:{limit['kind']}", "Slip update",
                    f"{pick['player']} is expected to be on {held} today. Recheck your {line}."))
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
    try:
        posted = settle(_ledger(_days(now + timedelta(days=1), 4), RECORD), now, limit=limit, space=RECORD)
    except Exception:  # noqa: BLE001 -- settled on the next turn
        posted = {}
    # The prop generator's plays, and the Props tab's picks summed up a day at a time.
    generated, archived = {}, []
    try:
        generated = settle(_ledger(_days(now + timedelta(days=1), 4), GEN), now, limit=limit, space=GEN)
        if generated:
            _memory.pop("generator", None)
    except Exception:  # noqa: BLE001 -- settled on the next turn
        generated = {}
    try:
        archived = archive_board_days(now)
    except Exception:  # noqa: BLE001 -- summed up on the next turn
        archived = []
    if posted:
        _forget()
    news = alerts(entries, now, limit=limit)
    learned = None
    try:
        import learning
        fitted = learning.daily(now)
        learned = {"picks": fitted["picks"], "at": fitted["at"]} if fitted else None
    except Exception:  # noqa: BLE001 -- never at the cost of settling
        learned = None
    return {"settled": len(settled), "record": len(posted), "generator": len(generated), "archived": len(archived), **news, "learned": learned}


# ---------------------------------------------------------------- the admin's record

# The site's record: only the slips the admin posts (record_add), one hash a
# day like the ledger, kept apart from it so no member's grading reaches it.
RECORD = "record:"
RECORD_KEEP_DAYS = 120
RESULTS = ("hit", "miss", "push", "void")


def _forget():
    _memory.pop("record", None)
    _memory.pop("public", None)


def _slip_of(raw):
    """The slip a pick was posted with: {"slip", "slipApp"} -- its picks are
    shown together and the slip counted won or lost -- or {} for a pick on
    its own."""
    raw = raw if isinstance(raw, dict) else {}
    slip = str(raw.get("slip") or raw.get("id") or "").strip().lower()
    if not re.fullmatch(r"[a-z0-9-]{4,40}", slip):
        return {}
    return {"slip": slip, "slipApp": _short(raw.get("slipApp") or raw.get("appName"), 30)}


def record_add(payload, now=None):
    """The picks of a slip the admin graded, onto the record: {added, started}.
    A pick whose game has started isn't taken (the record is picks made before
    the game); one already on the record before its game takes the new tier."""
    now = now or datetime.now(timezone.utc)
    raws = (payload or {}).get("picks") if isinstance(payload, dict) else None
    picks = [pick for pick in (clean_pick(raw, now) for raw in (raws or [])[:8]) if pick]
    if not picks:
        raise ValueError("No graded picks to post.")
    fresh = [pick for pick in picks if not pick["late"]]
    slip = _slip_of(payload)
    entries = []
    for pick in fresh:
        day = _eastern_day(_time(pick["startsAt"]) or now)
        entries.append((day, pick_key(pick, day), pick))
    held = _pipeline([["HGET", PREFIX + RECORD + day, key] for day, key, _ in entries]) if entries else []
    writes = []
    for (day, key, pick), raw in zip(entries, held):
        kept = _load(raw)
        if kept and kept.get("result"):
            continue
        pick = {**{name: value for name, value in pick.items() if name != "late"}, **slip, "owners": [], "result": None, "value": None,
                "alerted": [], "at": (kept or {}).get("at") or now.isoformat()}
        writes.append(["HSET", PREFIX + RECORD + day, key, json.dumps(pick, separators=(",", ":"))])
        writes.append(["EXPIRE", PREFIX + RECORD + day, RECORD_KEEP_DAYS * 86400])
    if writes:
        _pipeline(writes)
    _forget()
    return {"added": len(writes) // 2, "started": len(picks) - len(fresh)}


PHOTO_SPORTS = ("nfl", "nba", "wnba", "mlb", "nhl")
PHOTO_TRIES = 2


def _dress(entries, now, limit=3):
    """Headshots for the record's picks that came without one (read off a
    screenshot or typed in): the player's, from his game's box score, found by
    his team and the day once the game has started. A game that can't be
    found is tried PHOTO_TRIES times. {(day, key): pick} for the changed ones."""
    wanting = [(day, key, pick) for day, key, pick in entries
               if not pick.get("headshot") and pick.get("team") and pick.get("sport") in PHOTO_SPORTS
               and int(pick.get("photoTries") or 0) < PHOTO_TRIES
               and (starts := _time(pick.get("startsAt"))) and starts <= now]
    if not wanting:
        return {}
    by_key = {key: (day, pick) for day, key, pick in wanting}
    items = _game_items([(key, pick) for _, key, pick in wanting])[:limit]
    changed = {}
    for item, view in zip(items, _read_games(items)):
        for person in item["players"]:
            day, pick = by_key[person["key"]]
            found = (view.get("players") or {}).get(person["key"]) if view.get("found") else None
            photo = (found or {}).get("headshot") or ""
            changed[(day, person["key"])] = {**pick, "headshot": photo, "photoTries": int(pick.get("photoTries") or 0) + (0 if photo else 1)}
    if changed:
        _pipeline([["HSET", PREFIX + RECORD + day, key, json.dumps(pick, separators=(",", ":"))] for (day, key), pick in changed.items()])
    return changed


def record_picks(now=None, settle_limit=4):
    """Everything on the record, newest game first, for the admin to look
    over (settling what's due on the way): [{day, key, ...pick}]."""
    now = now or datetime.now(timezone.utc)
    entries = _ledger(_days(now + timedelta(days=3), RECORD_DAYS + 3), RECORD)
    try:
        changed = settle(entries, now, limit=settle_limit, space=RECORD)
    except Exception:  # noqa: BLE001 -- settled on the next look
        changed = {}
    entries = [(day, key, changed.get((day, key), pick)) for day, key, pick in entries]
    try:
        dressed = _dress(entries, now)
    except Exception:  # noqa: BLE001 -- photos come on the next look
        dressed = {}
    if changed or dressed:
        _forget()
    rows = [{"day": day, "key": key, **{name: value for name, value in dressed.get((day, key), pick).items()
                                         if name not in ("owners", "alerted", "settle")}}
            for day, key, pick in entries]
    return sorted(rows, key=lambda row: (row.get("startsAt") or row["day"], row["key"]), reverse=True)


def _record_ref(day, key):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(day or "")) or not re.fullmatch(r"[0-9a-f]{16}", str(key or "")):
        raise ValueError("A record pick is required.")
    return PREFIX + RECORD + day, key


RECORD_BATCH = 40


def _entered(raw, now, days):
    """(day, key, pick) for a finished play the admin typed in or read off a
    screenshot, or ValueError saying what's missing."""
    raw = raw if isinstance(raw, dict) else {}
    day = str(raw.get("day") or "")
    if day not in days:
        raise ValueError(f"Pick a date in the last {RECORD_DAYS} days.")
    sport, side, tier, result = raw.get("sport"), str(raw.get("side") or "").upper(), raw.get("tier"), raw.get("result")
    if sport not in SPORTS:
        raise ValueError("Pick a sport.")
    if side not in SIDES:
        raise ValueError("Pick Over or Under.")
    if tier not in TIERS:
        raise ValueError("Pick a tier.")
    if result not in RESULTS:
        raise ValueError("Pick hit, miss, push or void.")
    player, stat, line = _short(raw.get("player")), _short(raw.get("stat")), _number(raw.get("line"))
    if not player or not stat or line is None:
        raise ValueError("Player, stat and line are required.")
    modifier = _short(raw.get("modifier") or "standard", 12).lower()
    pick = {"sport": sport, "player": player, "playerId": "", "team": _short(raw.get("team"), 8).upper(),
            "opponent": _short(raw.get("opponent"), 8).upper(), "startsAt": f"{day}T23:00:00+00:00", "side": side, "line": line,
            "stat": stat, "modifier": modifier if modifier in ("goblin", "demon") else "standard", "tier": tier, "chance": None,
            "headshot": "", "settle": None, "owners": [], "alerted": [], "result": result, "value": _number(raw.get("value")),
            "manual": True, "entered": True, "at": now.isoformat(), "settledAt": now.isoformat(), **_slip_of(raw)}
    return day, pick_key(pick, day), pick


def record_enter(payload, now=None):
    """A play that already finished, typed in by the admin with its result:
    onto the record as it stands (nothing to settle). Its day is the game's
    date, within the RECORD_DAYS the record shows."""
    now = now or datetime.now(timezone.utc)
    day, key, pick = _entered(payload, now, _days(now, RECORD_DAYS))
    _pipeline([["HSET", PREFIX + RECORD + day, key, json.dumps(pick, separators=(",", ":"))],
               ["EXPIRE", PREFIX + RECORD + day, RECORD_KEEP_DAYS * 86400]])
    _forget()
    return {"day": day, "key": key, "result": pick["result"]}


def record_enter_many(plays, now=None):
    """Finished plays read off the admin's screenshots, each with the result
    the admin gave it, onto the record together: all of them or, when one
    is missing something, none (saying which)."""
    now = now or datetime.now(timezone.utc)
    if not isinstance(plays, list) or not plays:
        raise ValueError("No plays to add.")
    if len(plays) > RECORD_BATCH:
        raise ValueError(f"Add at most {RECORD_BATCH} plays at a time.")
    days, entries = _days(now, RECORD_DAYS), []
    for number, raw in enumerate(plays, 1):
        try:
            entries.append(_entered(raw, now, days))
        except ValueError as exc:
            name = _short((raw or {}).get("player") if isinstance(raw, dict) else "") or f"Play {number}"
            raise ValueError(f"{name}: {exc}") from None
    writes = []
    for day, key, pick in entries:
        writes.append(["HSET", PREFIX + RECORD + day, key, json.dumps(pick, separators=(",", ":"))])
        writes.append(["EXPIRE", PREFIX + RECORD + day, RECORD_KEEP_DAYS * 86400])
    _pipeline(writes)
    _forget()
    return {"added": len(entries), "hits": sum(pick["result"] == "hit" for _, _, pick in entries),
            "misses": sum(pick["result"] == "miss" for _, _, pick in entries)}


def record_group(refs, app=""):
    """Picks already on the record, joined into one slip (added one by one,
    or before slips were kept together): [{day, key}] -> {slip, picks}."""
    refs = [_record_ref(ref.get("day"), ref.get("key")) for ref in (refs or []) if isinstance(ref, dict)][:RECORD_BATCH]
    if len(refs) < 2:
        raise ValueError("Pick at least two plays to make a slip.")
    held = _pipeline([["HGET", name, key] for name, key in refs])
    if not all(isinstance(_load(raw), dict) for raw in held):
        raise ValueError("One of those plays isn't on the record anymore.")
    slip = "g-" + hashlib.sha1("|".join(key for _, key in refs).encode()).hexdigest()[:12]
    _pipeline([["HSET", name, key, json.dumps({**_load(raw), "slip": slip, "slipApp": _short(app, 30)}, separators=(",", ":"))]
               for (name, key), raw in zip(refs, held)])
    _forget()
    return {"slip": slip, "picks": len(refs)}


def record_remove(day, key):
    """Take one pick off the record."""
    name, key = _record_ref(day, key)
    removed = _pipeline([["HDEL", name, key]])[0] or 0
    _forget()
    return {"removed": int(removed)}


def record_set_result(day, key, result, value=None):
    """The admin's own call on a pick: hit, miss, push or void, or None to
    let the box score settle it again."""
    name, key = _record_ref(day, key)
    if result is not None and result not in RESULTS:
        raise ValueError("Result must be hit, miss, push or void.")
    pick = _load(_pipeline([["HGET", name, key]])[0])
    if not isinstance(pick, dict):
        raise ValueError("That pick isn't on the record.")
    if result is None and pick.get("entered"):
        raise ValueError("A play you typed in has no box score to settle from: pick its result.")
    pick = {**pick, "result": result, "value": _number(value) if result else None, "manual": bool(result),
            "settledAt": datetime.now(timezone.utc).isoformat() if result else None}
    _pipeline([["HSET", name, key, json.dumps(pick, separators=(",", ":"))]])
    _forget()
    return {"day": day, "key": key, "result": result}


def record_clear(now=None):
    """Erase the whole record: every day it could hold."""
    now = now or datetime.now(timezone.utc)
    names = [PREFIX + RECORD + day for day in _days(now + timedelta(days=7), RECORD_KEEP_DAYS + 8)]
    removed = sum(int(count or 0) for count in _pipeline([["DEL", *names[start:start + 50]] for start in range(0, len(names), 50)]))
    _forget()
    return {"cleared": removed}


# ---------------------------------------------------------------- public record

PUBLIC_RECENT = 24
# A pick's public face: what was picked and how it finished -- never how it
# was settled.
PUBLIC_FIELDS = ("player", "sport", "stat", "line", "side", "tier", "result", "value", "modifier", "team", "opponent", "headshot")


def _slips(rows):
    """The record's picks as they were posted: each slip's picks together,
    and a pick posted on its own alone, newest first. [(slip, app, [(day, pick)])]."""
    groups = {}
    for day, key, pick in rows:
        group = pick.get("slip") or f"pick:{day}:{key}"
        groups.setdefault(group, []).append((day, pick))
    start = lambda item: (_time(item[1].get("startsAt")) or datetime.min.replace(tzinfo=timezone.utc)).timestamp()  # noqa: E731
    out = [(group if not group.startswith("pick:") else None, next((pick.get("slipApp") for _, pick in picks if pick.get("slipApp")), ""),
            sorted(picks, key=start)) for group, picks in groups.items()]
    return sorted(out, key=lambda item: max(start(entry) for entry in item[2]), reverse=True)


def public_results(now=None, entries=None):
    """The site's record for anyone to see (the /results page): every pick
    the admin posted (RECORD) and settled hit or miss over the last
    RECORD_DAYS -- by tier, by sport, as it built up day by day, each slip won or lost -- and
    the latest finished slips and picks. Only finished games: today's open
    picks stay members-only."""
    now = now or datetime.now(timezone.utc)
    held = _memory.get("public")
    if entries is None and held and time.time() - held[0] < RECORD_FRESH:
        return held[1]
    rows = entries if entries is not None else _ledger(_days(now, RECORD_DAYS), RECORD)
    done = [(day, pick) for day, _, pick in rows if pick.get("tier") in TIERS and pick.get("result") in ("hit", "miss")]

    def tally(picks):
        hits = sum(1 for pick in picks if pick["result"] == "hit")
        decided = len(picks)
        return {"hits": hits, "misses": decided - hits, "picks": decided, "rate": round(hits / decided, 4) if decided else None}

    tiers = {tier: tally([pick for _, pick in done if pick["tier"] == tier]) for tier in TIERS}
    sports = {sport: tally([pick for _, pick in done if pick.get("sport") == sport]) for sport in SPORTS}
    # Slips: won when nothing missed and something hit, lost on a miss; shown
    # once every pick in it has finished.
    finished, won, lost = [], 0, 0
    for slip, app, picks in _slips([row for row in rows if row[2].get("tier") in TIERS]):
        status = _status([pick for _, pick in picks])
        if status == "pending" or not any(pick.get("result") in ("hit", "miss") for _, pick in picks):
            continue
        if slip:
            won, lost = won + (status == "won"), lost + (status == "lost")
        finished.append((slip, app, status, picks))
    import slip_games

    def face(day, pick):
        return {**{field: pick.get(field) for field in PUBLIC_FIELDS}, "day": day,
                "teamLogo": slip_games.team_logo(pick.get("sport"), pick.get("team")),
                "opponentLogo": slip_games.team_logo(pick.get("sport"), pick.get("opponent"))}

    latest, shown = [], 0
    for slip, app, status, picks in finished:
        if shown >= PUBLIC_RECENT:
            break
        shown += len(picks)
        latest.append({"slip": bool(slip), "app": app, "status": status, "day": max(day for day, _ in picks),
                       "picks": [face(day, pick) for day, pick in picks]})
    # The record as it built up, day by day: hits and misses so far, from the
    # first day with a finished pick.
    running, hits, misses = [], 0, 0
    for day in reversed(_days(now, RECORD_DAYS)):
        today = [pick for d, pick in done if d == day]
        if not today and not running:
            continue
        hits += sum(pick["result"] == "hit" for pick in today)
        misses += sum(pick["result"] == "miss" for pick in today)
        running.append({"day": day, "hits": hits, "misses": misses})
    decided = won + lost
    out = {"days": RECORD_DAYS, "tiers": tiers, "all": tally([pick for _, pick in done]),
           "slips": {"won": won, "lost": lost, "slips": decided, "rate": round(won / decided, 4) if decided else None},
           "sports": {sport: counts for sport, counts in sports.items() if counts["picks"]},
           "running": running,
           "latest": latest,
           "at": now.isoformat()}
    if entries is None:
        _memory["public"] = (time.time(), out)
    return out


# ---------------------------------------------------------------- the prop generator's record

# The NBA prop generator's calls (src/prop-gameread.js) as its page shows
# them before the games (Nov 9, the owner: "Is there any way to see our full
# record for the props ... admin only"): one hash a day like the ledger,
# kept a season, settled from the box score the same way. A play takes the
# newer read until its game starts; one the page passes on by then is
# marked dropped and doesn't count (the last call before tip-off stands).
GEN = "gen:"
GEN_KEEP_DAYS = 400
# The first day plays were kept, and the most a page sends at once.
GEN_START = "2026-11-09"
GEN_SEND = 40
STRENGTHS = ("best", "strong", "play")
GEN_MARKETS = ("player_points", "player_rebounds", "player_assists", "player_threes", "player_points_rebounds",
               "player_points_assists", "player_points_rebounds_assists")


def _gen_pick(raw, now):
    """A play from the generator's page, checked: an NBA Over on a regular
    main-stat line before its game, or None."""
    if not isinstance(raw, dict) or raw.get("sport") != "nba" or (raw.get("settle") or {}).get("key") not in GEN_MARKETS:
        return None
    pick = clean_pick({**raw, "side": "OVER", "modifier": "standard", "source": "board"}, now)
    if not pick or pick["late"] or not 0 < pick["line"] < 100:
        return None
    starts = _time(pick["startsAt"])
    if not starts or (starts - now).total_seconds() > 40 * 3600:
        return None
    confidence = _number(raw.get("confidence"))
    projection = _number(raw.get("projection"))
    return {**pick, "strength": raw.get("strength") if raw.get("strength") in STRENGTHS else "play",
            "confidence": int(min(100, max(0, confidence))) if confidence is not None else None,
            "projection": round(projection, 2) if projection is not None else None}


def generator_add(payload, now=None):
    """The generator's calls from a page view: {kept, dropped}. `plays` are
    kept (a kept one takes the newer read until its game starts); `passes`
    already kept as plays are marked dropped, and back if played again."""
    now = now or datetime.now(timezone.utc)
    payload = payload if isinstance(payload, dict) else {}
    plays = [pick for pick in (_gen_pick(raw, now) for raw in (payload.get("plays") or [])[:GEN_SEND]) if pick]
    passes = [pick for pick in (_gen_pick(raw, now) for raw in (payload.get("passes") or [])[:GEN_SEND]) if pick]
    marked = [(pick, False) for pick in plays] + [(pick, True) for pick in passes]
    if not marked:
        return {"kept": 0, "dropped": 0}
    keyed = []
    for pick, dropped in marked:
        day = _eastern_day(_time(pick["startsAt"]) or now)
        keyed.append((day, pick_key(pick, day), pick, dropped))
    reads = _pipeline([["HGET", PREFIX + GEN + day, key] for day, key, _, _ in keyed])
    writes, kept, dropped_count = [], 0, 0
    for (day, key, pick, dropped), raw in zip(keyed, reads):
        held = _load(raw)
        if isinstance(held, dict) and (held.get("result") or held.get("late")):
            continue
        if dropped:
            if not isinstance(held, dict) or held.get("dropped"):
                continue
            entry = {**held, "dropped": True, "droppedAt": now.isoformat()}
            dropped_count += 1
        else:
            entry = {**(held if isinstance(held, dict) else {"at": now.isoformat(), "result": None, "value": None, "owners": [], "alerted": []}),
                     **{name: value for name, value in pick.items() if name != "late"}, "late": False, "dropped": False, "seenAt": now.isoformat()}
            kept += 1
        writes.append(["HSET", PREFIX + GEN + day, key, json.dumps(entry, separators=(",", ":"))])
        writes.append(["EXPIRE", PREFIX + GEN + day, GEN_KEEP_DAYS * 86400])
    if writes:
        _pipeline(writes)
        _memory.pop("generator", None)
    return {"kept": kept, "dropped": dropped_count}


def _gen_days(now):
    first = datetime.fromisoformat(GEN_START).date()
    today = datetime.fromisoformat(_eastern_day(now + timedelta(days=1))).date()
    return [(first + timedelta(days=offset)).isoformat() for offset in range(max(1, (today - first).days + 1))][-GEN_KEEP_DAYS:]


def _tally(picks):
    hits = sum(1 for pick in picks if pick.get("result") == "hit")
    misses = sum(1 for pick in picks if pick.get("result") == "miss")
    decided = hits + misses
    return {"hits": hits, "misses": misses, "picks": decided, "rate": round(hits / decided, 4) if decided else None,
            "pushes": sum(1 for pick in picks if pick.get("result") == "push"), "voids": sum(1 for pick in picks if pick.get("result") == "void")}


GEN_FIELDS = ("player", "playerId", "team", "opponent", "stat", "line", "value", "result", "strength", "confidence", "projection", "chance",
              "headshot", "startsAt")


def generator_record(now=None, entries=None, settle_limit=6):
    """The generator's record: every play kept and not dropped, settled
    (settling what's due on the way): overall, by strength, by stat, the
    last 7 and 30 days, day by day and the latest plays."""
    now = now or datetime.now(timezone.utc)
    held = _memory.get("generator")
    if entries is None and held and time.time() - held[0] < RECORD_FRESH:
        return held[1]
    rows = entries if entries is not None else _ledger(_gen_days(now), GEN)
    if entries is None:
        try:
            changed = settle(rows, now, limit=settle_limit, space=GEN)
            rows = [(day, key, changed.get((day, key), pick)) for day, key, pick in rows]
        except Exception:  # noqa: BLE001 -- settled on the next look
            pass
    plays = [(day, pick) for day, _, pick in rows if not pick.get("dropped")]
    done = [pick for _, pick in plays if pick.get("result")]
    today = datetime.fromisoformat(_eastern_day(now)).date()
    since = lambda days: (today - timedelta(days=days)).isoformat()
    by_day = {}
    for day, pick in plays:
        by_day.setdefault(day, []).append(pick)
    stats = sorted({pick.get("stat") for _, pick in plays if pick.get("stat")})
    latest = sorted(plays, key=lambda item: (item[1].get("startsAt") or "", item[1].get("confidence") or 0), reverse=True)[:40]
    out = {"since": GEN_START, "all": _tally(done),
           "last7": _tally([pick for day, pick in plays if day >= since(7)]), "last30": _tally([pick for day, pick in plays if day >= since(30)]),
           "strengths": {strength: _tally([pick for pick in done if pick.get("strength") == strength]) for strength in STRENGTHS},
           "stats": {stat: _tally([pick for pick in done if pick.get("stat") == stat]) for stat in stats},
           "days": [{"day": day, **_tally(picks)} for day, picks in sorted(by_day.items(), reverse=True)][:45],
           "pending": sum(1 for _, pick in plays if not pick.get("result")),
           "latest": [{**{field: pick.get(field) for field in GEN_FIELDS}, "day": day} for day, pick in latest], "at": now.isoformat()}
    if entries is None:
        _memory["generator"] = (time.time(), out)
    return out


# ---------------------------------------------------------------- the Props tab's own picks, day by day

# The site's top picks it logs for itself (learn: the 'board' source, the
# Props tab's grades as the Parlay Builder and the assistant read them)
# outlive the ledger's LEDGER_DAYS as a small summary a day: each sport's
# tiers, hits and misses (Overs on regular lines). The timer writes a few
# days a turn once they're settled (archive_board_days); the admin's record
# reads them (board_record).
BOARD_DAY = "boardday:"
BOARD_KEEP_DAYS = 800
BOARD_SPAN = 365
BOARD_TIERS = ("elite", "strong", "lean")


def board_day(picks):
    """{sport: {tier: [hits, misses]}} for one day's ledger picks."""
    out = {}
    for pick in picks:
        if pick.get("source") != "board" or pick.get("late") or pick.get("side") != "OVER" or (pick.get("modifier") or "standard") != "standard":
            continue
        if pick.get("tier") not in BOARD_TIERS or pick.get("result") not in ("hit", "miss"):
            continue
        cell = out.setdefault(pick["sport"], {}).setdefault(pick["tier"], [0, 0])
        cell[0 if pick["result"] == "hit" else 1] += 1
    return out


def archive_board_days(now=None, most=3):
    """Up to `most` finished days (2 to LEDGER_DAYS - 1 days back) not yet
    summed up, summed up. Returns the days written."""
    now = now or datetime.now(timezone.utc)
    days = _days(now, LEDGER_DAYS)[2:]
    have = _pipeline([["GET", PREFIX + BOARD_DAY + day] for day in days])
    missing = [day for day, value in zip(days, have) if value is None][:most]
    if not missing:
        return []
    by_day = {}
    for day, _, pick in _ledger(missing):
        by_day.setdefault(day, []).append(pick)
    _pipeline([["SET", PREFIX + BOARD_DAY + day, json.dumps(board_day(by_day.get(day, [])), separators=(",", ":")), "EX", BOARD_KEEP_DAYS * 86400]
               for day in missing])
    return missing


def board_record(now=None):
    """The Props tab's top picks over the days summed up so far: each sport
    and tier, and overall, {sports, tiers, all, days, since, through}."""
    now = now or datetime.now(timezone.utc)
    held = _memory.get("board")
    if held and time.time() - held[0] < RECORD_FRESH:
        return held[1]
    days = _days(now, BOARD_SPAN)[2:]
    values = _pipeline([["GET", PREFIX + BOARD_DAY + day] for day in days])
    kept = [(day, _load(value)) for day, value in zip(days, values) if value is not None]
    count = lambda cells: {"hits": sum(cell[0] for cell in cells), "misses": sum(cell[1] for cell in cells)}
    rate = lambda counts: {**counts, "picks": counts["hits"] + counts["misses"],
                           "rate": round(counts["hits"] / (counts["hits"] + counts["misses"]), 4) if counts["hits"] + counts["misses"] else None}
    cells = [(day, sport, tier, cell) for day, summary in kept if isinstance(summary, dict)
             for sport, tiers in summary.items() if isinstance(tiers, dict) for tier, cell in tiers.items()
             if tier in BOARD_TIERS and isinstance(cell, list) and len(cell) == 2]
    sports = sorted({sport for _, sport, _, _ in cells})
    out = {"all": rate(count([cell for *_, cell in cells])),
           "tiers": {tier: rate(count([cell for _, _, t, cell in cells if t == tier])) for tier in BOARD_TIERS},
           "sports": {sport: {"all": rate(count([cell for _, s, _, cell in cells if s == sport])),
                              **{tier: rate(count([cell for _, s, t, cell in cells if s == sport and t == tier])) for tier in BOARD_TIERS}}
                      for sport in sports},
           "since": min((day for day, _ in kept), default=None), "through": max((day for day, _ in kept), default=None), "days": len(kept)}
    _memory["board"] = (time.time(), out)
    return out
