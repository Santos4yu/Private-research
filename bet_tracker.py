"""Each member's own bets: what they staked, at what price, and how it went.

A member logs a bet on My Bets (a PrizePicks or Underdog entry, a
sportsbook parlay or a straight bet), or from a slip they track in the Slip
Analyzer. Bets are kept under the member's account with their unit size:
{"unit": dollars per unit, "bets": [bet, ...]} newest first.

A bet logged from a tracked slip settles itself once the slip does
(slip_ledger.history): a slip that lost is a loss, one that won is a win
at the payout logged. A slip that won with a pick voided or pushed is
marked to check, since the app pays a smaller entry then; the member sets
what it paid. Everything else is the member's to mark.

Profit is in units: a win pays the stake times the payout less the stake
(American odds as their decimal price), a loss costs the stake, a push or
void costs nothing, and a cash out returns what the member says it did.

Each bet keeps the unit size it was placed at ("unit", dollars), so its
dollars stay what they were when the member changes their unit size: a
new size counts for the bets logged after it. A bet kept before bets had
their own size counts at the member's size until it changes, then keeps
the one it had. The member can also put every bet at the new size, for
when the old one was set wrong.
"""
from __future__ import annotations

import json
import math
import re
import secrets
from datetime import datetime, timedelta, timezone

PREFIX = "krazy_data:bets:v1:"
MAX_BETS = 1500
KEEP_SECONDS = 3 * 365 * 86400
KINDS = ("pickem", "parlay", "straight")
RESULTS = ("pending", "win", "loss", "push", "void", "cashout")
SPORTS = ("nba", "nfl", "mlb", "nhl", "wnba", "cfb", "cbb", "soccer", "tennis", "golf", "mma", "esports", "other")
MAX_LEGS = 10
DEFAULT_UNIT = 10.0


def _store():
    from v2.board import store
    return store


def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _short(value, size):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:size]


def _today():
    """Today on the Eastern calendar (when the night's games are)."""
    now = datetime.now(timezone.utc)
    return (now - timedelta(hours=5)).date().isoformat()


def decimal_odds(odds):
    """An American price as a decimal one (+150 -> 2.5, -120 -> 1.833)."""
    odds = _number(odds)
    if odds is None or -100 < odds < 100:
        return None
    return 1 + (odds / 100 if odds > 0 else 100 / -odds)


def multiplier(bet):
    """What a winning bet returns per unit staked."""
    if bet.get("kind") == "pickem":
        return _number(bet.get("payout"))
    return decimal_odds(bet.get("odds"))


def profit(bet):
    """Units won or lost, or None while it's pending."""
    stake = _number(bet.get("stake")) or 0
    result = bet.get("result")
    if result == "win":
        paid = multiplier(bet)
        return round(stake * (paid - 1), 4) if paid else None
    if result == "loss":
        return -stake
    if result in ("push", "void"):
        return 0.0
    if result == "cashout":
        returned = _number(bet.get("returned"))
        return round(returned - stake, 4) if returned is not None else None
    return None


def _leg(raw):
    if not isinstance(raw, dict):
        return None
    player = _short(raw.get("player"), 40)
    if not player:
        return None
    side = str(raw.get("side") or "").upper()
    return {"player": player, "stat": _short(raw.get("stat"), 30), "line": _number(raw.get("line")),
            "side": side if side in ("OVER", "UNDER") else "", "result": raw.get("result") if raw.get("result") in ("hit", "miss", "push", "void") else None}


def clean(raw, now=None):
    """A bet as the member sent it, checked: a ValueError says what's wrong."""
    now = now or datetime.now(timezone.utc)
    if not isinstance(raw, dict):
        raise ValueError("A bet is required.")
    kind = raw.get("kind") if raw.get("kind") in KINDS else "pickem"
    stake = _number(raw.get("stake"))
    if stake is None or not 0 < stake <= 1000:
        raise ValueError("Enter how many units you staked (more than 0).")
    bet = {"kind": kind, "stake": round(stake, 4), "book": _short(raw.get("book"), 24), "title": _short(raw.get("title"), 90),
           "sport": raw.get("sport") if raw.get("sport") in SPORTS else "other",
           "result": raw.get("result") if raw.get("result") in RESULTS else "pending", "note": _short(raw.get("note"), 140)}
    size = _number(raw.get("unit"))
    if size is not None and 0 < size <= 1_000_000:
        bet["unit"] = round(size, 2)
    if kind == "pickem":
        payout = _number(raw.get("payout"))
        if payout is None or not 1 < payout <= 10000:
            raise ValueError("Enter what the entry pays, like 3 for 3x.")
        bet["payout"] = round(payout, 3)
    else:
        odds = _number(raw.get("odds"))
        if decimal_odds(odds) is None or abs(odds) > 1_000_000:
            raise ValueError("Enter the odds, like -110 or +250.")
        bet["odds"] = int(round(odds))
    day = str(raw.get("date") or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        day = _today()
    bet["date"] = day
    if bet["result"] == "cashout":
        returned = _number(raw.get("returned"))
        if returned is None or not 0 <= returned <= 1_000_000:
            raise ValueError("Enter how many units came back.")
        bet["returned"] = round(returned, 4)
    legs = [leg for leg in (_leg(item) for item in (raw.get("legs") or [])[:MAX_LEGS]) if leg]
    if legs:
        bet["legs"] = legs
    slip = str(raw.get("slipId") or "")
    if re.fullmatch(r"[a-z0-9-]{8,40}", slip):
        bet["slipId"] = slip
    if raw.get("check") is True and bet["result"] == "win":
        bet["check"] = True
    if not bet["title"]:
        bet["title"] = ", ".join(leg["player"] for leg in legs[:4]) or "Bet"
    return bet


def _key(uid):
    return PREFIX + str(uid)


def read(uid):
    raw = _store().get(_key(uid))
    try:
        data = json.loads(raw) if raw else {}
    except (TypeError, ValueError):
        data = {}
    bets = [bet for bet in data.get("bets") or [] if isinstance(bet, dict) and bet.get("id")]
    unit = _number(data.get("unit"))
    return {"unit": unit if unit and unit > 0 else DEFAULT_UNIT, "bets": bets}


def _write(uid, data):
    data["bets"] = sorted(data["bets"], key=lambda bet: (bet.get("date") or "", bet.get("at") or ""), reverse=True)[:MAX_BETS]
    _store().set(_key(uid), json.dumps(data, separators=(",", ":")), ex=KEEP_SECONDS)
    return data


def save(uid, raw, now=None):
    """Add a bet, or change one (raw["id"] of one already kept)."""
    now = now or datetime.now(timezone.utc)
    if not uid:
        raise ValueError("Sign in to keep your bets.")
    bet = clean(raw, now)
    data = read(uid)
    wanted = str((raw or {}).get("id") or "")
    held = next((item for item in data["bets"] if item["id"] == wanted), None) if wanted else None
    bet.setdefault("unit", (held or {}).get("unit") or data["unit"])
    if held:
        bet = {**bet, "id": held["id"], "at": held.get("at") or now.isoformat()}
        data["bets"] = [bet if item is held else item for item in data["bets"]]
    else:
        if bet.get("slipId") and any(item.get("slipId") == bet["slipId"] for item in data["bets"]):
            raise ValueError("That slip is already in your bets.")
        bet = {**bet, "id": secrets.token_hex(6), "at": now.isoformat()}
        data["bets"].append(bet)
    _write(uid, data)
    return {"bet": bet}


def remove(uid, bet_id):
    if not uid or not re.fullmatch(r"[a-f0-9]{12}", str(bet_id or "")):
        raise ValueError("A bet is required.")
    data = read(uid)
    left = [bet for bet in data["bets"] if bet["id"] != bet_id]
    removed = len(data["bets"]) - len(left)
    if removed:
        data["bets"] = left
        _write(uid, data)
    return {"removed": removed}


def set_unit(uid, value, every=False):
    """The member's unit size for the bets they log from now on. The bets
    already kept stay at the size they had, or with `every`, all of them
    count at this one (their units the same, their dollars at it)."""
    unit = _number(value)
    if not uid or unit is None or not 0 < unit <= 1_000_000:
        raise ValueError("Enter a unit size in dollars.")
    unit = round(unit, 2)
    data = read(uid)
    for bet in data["bets"]:
        if every:
            bet["unit"] = unit
        else:
            bet.setdefault("unit", data["unit"])
    data["unit"] = unit
    _write(uid, data)
    return {"unit": unit, "older": sum(bet["unit"] != unit for bet in data["bets"])}


def settle_from_slips(bets, slips):
    """Pending bets logged from a tracked slip, settled as the slip did:
    (bets, changed). `slips` are slip_ledger.history's."""
    by_id = {slip.get("id"): slip for slip in slips or [] if isinstance(slip, dict)}
    changed = False
    out = []
    for bet in bets:
        slip = by_id.get(bet.get("slipId"))
        if bet.get("result") != "pending" or not slip or slip.get("status") not in ("won", "lost", "void"):
            out.append(bet)
            continue
        results = {pick.get("result") for pick in slip.get("picks") or []}
        bet = {**bet, "result": {"won": "win", "lost": "loss", "void": "void"}[slip["status"]], "auto": True}
        if bet["result"] == "win" and results & {"void", "push"}:
            # Fewer picks counted: the app pays a smaller entry. The member says what.
            bet["check"] = True
        legs = {(leg.get("player"), leg.get("stat")): leg for leg in bet.get("legs") or []}
        for pick in slip.get("picks") or []:
            leg = legs.get((pick.get("player"), pick.get("stat")))
            if leg is not None:
                leg["result"] = pick.get("result")
        out.append(bet)
        changed = True
    return out, changed


def listing(uid, slips_loader=None):
    """The member's bets and unit size, settling any logged from a tracked
    slip that has finished."""
    data = read(uid)
    if any(bet.get("slipId") and bet.get("result") == "pending" for bet in data["bets"]):
        try:
            if slips_loader is None:
                import slip_ledger
                slips_loader = lambda: slip_ledger.history(uid).get("slips") or []
            bets, changed = settle_from_slips(data["bets"], slips_loader())
            if changed:
                data["bets"] = bets
                _write(uid, data)
        except Exception:  # noqa: BLE001 -- they settle on the next look
            pass
    return {"unit": data["unit"], "bets": [{"unit": data["unit"], **bet, "profit": profit(bet)} for bet in data["bets"]]}
