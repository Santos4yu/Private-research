"""Learning from results: how sure the site said each pick was, against how
the picks actually finished, and the small corrections that close the gap.

Every graded pick goes into the ledger (slip_ledger.py) with the chance the
model gave it before its game, and is settled from the box score after.
Once a day (the timer's tick), the settled picks of the last LEARN_DAYS are
grouped by sport and by how sure the model was (55-60%, 60-65%...), and
each group's actual hit rate is set against its predicted one. Where the
model has been too sure, its chances come down; where it has been too
modest, they go up. The browser applies the result to every pick it grades
(src/learning.js), on every page alike.

Safety rails, so a few results can't throw it off:
- a group counts only with MIN_PICKS settled picks; until then it borrows the
  all-sports correction, and that needs MIN_PICKS too;
- results are pulled toward what the model said (PRIOR picks' worth), so a
  correction grows as the evidence does;
- a correction moves at most STEP a day, and never past CAP;
- picks graded after their start, pushes, voids and players who didn't play
  don't count.

The picks are learned from by their raw chance (before any correction), so
each day's corrections are measured against the model itself, not against
the previous day's corrections.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone

VERSION = 1
# Which model graded a pick. The prop model (src/prop-model.js) has read
# MLB, NBA, WNBA and NHL picks since BASIS 2; their picks graded before it
# came from another model, so they aren't learned from, and corrections fit
# on them don't carry over.
BASIS = 2
PROP_SPORTS = ("mlb", "nba", "wnba", "nhl")
LEARN_DAYS = 60
RECORD_DAYS = 30
# Edges of the chance bands, as the model gave them.
BANDS = (0.0, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 1.0)
MIN_PICKS = 25
PRIOR = 40
# How far a sport's own results count against the all-sports correction:
# its picks over its picks plus this many.
SPORT_WEIGHT = 100
STEP = 0.03
CAP = 0.15
REFIT_AFTER = 20 * 3600
LETTER_GROUPS = ("A", "B", "C", "D")

_memory: dict = {}


def _store():
    from v2.board import store
    return store


def _key():
    import slip_ledger
    return slip_ledger.PREFIX + "learning"


def _band(chance):
    for low, high in zip(BANDS, BANDS[1:]):
        if low <= chance < high:
            return low
    return BANDS[-2]


def _counted(pick):
    """A settled pick graded before its game: (raw chance, hit) or None."""
    if not isinstance(pick, dict) or pick.get("late") or pick.get("result") not in ("hit", "miss"):
        return None
    raw = pick.get("raw") if isinstance(pick.get("raw"), (int, float)) else pick.get("chance")
    if not isinstance(raw, (int, float)) or not 0 < raw < 1:
        return None
    return float(raw), pick["result"] == "hit"


def _current(pick):
    """Whether a pick was graded by today's model."""
    return pick.get("sport") not in PROP_SPORTS or pick.get("model") == BASIS


def _bands(picks):
    """Each chance band's picks: {band: [n, hits, sum of predicted]}."""
    out = {}
    for raw, hit in picks:
        cell = out.setdefault(_band(raw), [0, 0, 0.0])
        cell[0] += 1
        cell[1] += hit
        cell[2] += raw
    return out


def _offset(n, hits, predicted):
    """How far off the model was in a band, pulled toward no correction."""
    expected = predicted / n
    return (hits + PRIOR * expected) / (n + PRIOR) - expected


def _clamp(value, low, high):
    return max(low, min(high, value))


def fit(entries, previous=None, now=None):
    """The corrections from settled ledger entries ([(day, key, pick)]):
    {version, at, picks, groups: {sport|'all': {points: [[predicted, offset, n, actual]]}},
    tiers, sports}. `previous` (yesterday's) limits how far each moves."""
    now = now or datetime.now(timezone.utc)
    by_sport = {}
    tiers = {}
    for _, _, pick in entries:
        counted = _counted(pick)
        if not counted or not _current(pick):
            continue
        by_sport.setdefault(pick.get("sport") or "other", []).append(counted)
        by_sport.setdefault("all", []).append(counted)
        tier = pick.get("tier")
        if tier:
            cell = tiers.setdefault(tier, {"picks": 0, "hits": 0, "predicted": 0.0})
            cell["picks"] += 1
            cell["hits"] += counted[1]
            cell["predicted"] += counted[0]
    for cell in tiers.values():
        cell["predicted"] = round(cell["predicted"] / cell["picks"], 4)
        cell["actual"] = round(cell["hits"] / cell["picks"], 4)

    old = ((previous or {}).get("groups") or {}) if (previous or {}).get("basis") == BASIS else {}

    def held(group, band):
        for predicted, offset, *_ in (old.get(group) or {}).get("points") or []:
            if _band(predicted) == band:
                return offset
        return 0.0

    shared = _bands(by_sport.get("all", []))
    groups = {}
    for group, picks in by_sport.items():
        cells = _bands(picks)
        points = []
        for band in sorted(cells):
            n, hits, predicted = cells[band]
            everyone = shared.get(band)
            base = _offset(*everyone) if everyone and everyone[0] >= MIN_PICKS else 0.0
            if group == "all":
                target = base
            elif n >= MIN_PICKS:
                weight = n / (n + SPORT_WEIGHT)
                target = weight * _offset(n, hits, predicted) + (1 - weight) * base
            else:
                target = base
            before = held(group, band)
            offset = _clamp(before + _clamp(target - before, -STEP, STEP), -CAP, CAP)
            points.append([round(predicted / n, 4), round(offset, 4), n, round(hits / n, 4)])
        groups[group] = {"points": points, "picks": len(picks), "hits": sum(hit for _, hit in picks)}
    return {"version": VERSION, "basis": BASIS, "at": now.isoformat(), "days": LEARN_DAYS, "picks": len(by_sport.get("all", [])),
            "groups": groups, "tiers": tiers}


def parlay_record(parlays, results):
    """Graded parlays by their letter's group (A, B, C, D and F): how many had
    every pick hit, of those whose picks are all settled. `parlays` is
    [(day, sig, slip)], `results` {(day, key): result}."""
    out = {group: {"hits": 0, "misses": 0} for group in LETTER_GROUPS}
    for _, _, slip in parlays:
        letter = str(slip.get("letter") or "")[:1].upper()
        group = "D" if letter in ("D", "F") else letter
        if group not in out or slip.get("late"):
            continue
        finished = [results.get((ref.get("day"), ref.get("key"))) for ref in slip.get("picks") or [] if isinstance(ref, dict)]
        if not finished or any(result not in ("hit", "miss", "push", "void") for result in finished):
            continue
        counted = [result for result in finished if result in ("hit", "miss")]
        if not counted:
            continue
        out[group]["hits" if all(result == "hit" for result in counted) else "misses"] += 1
    for cell in out.values():
        decided = cell["hits"] + cell["misses"]
        cell["slips"] = decided
        cell["rate"] = round(cell["hits"] / decided, 4) if decided else None
    return out


def model(now=None):
    """The corrections the browser applies, refit when a day old."""
    held = _memory.get("model")
    if held and time.time() - held[0] < 600:
        return held[1]
    raw = None
    try:
        raw = _store().get(_key())
    except Exception:  # noqa: BLE001 -- no corrections is the model as it is
        raw = None
    found = None
    if raw:
        try:
            found = json.loads(raw)
        except (TypeError, ValueError):
            found = None
    _memory["model"] = (time.time(), found)
    return found


def daily(now=None, force=False):
    """The timer's daily turn: refit from the last LEARN_DAYS when the stored
    model is a day old. Returns the model, or None when it wasn't due."""
    import slip_ledger
    now = now or datetime.now(timezone.utc)
    previous = model(now)
    if previous and not force:
        try:
            age = (now - datetime.fromisoformat(previous["at"])).total_seconds()
        except (KeyError, TypeError, ValueError):
            age = REFIT_AFTER
        if age < REFIT_AFTER:
            return None
    entries = slip_ledger._ledger(slip_ledger._days(now, LEARN_DAYS))
    fitted = fit(entries, previous, now)
    results = {(day, key): pick.get("result") for day, key, pick in entries}
    fitted["parlays"] = parlay_record(slip_ledger.parlays(slip_ledger._days(now, RECORD_DAYS)), results)
    fitted["parlayDays"] = RECORD_DAYS
    _store().set(_key(), json.dumps(fitted, separators=(",", ":")), ex=14 * 86400)
    _memory["model"] = (time.time(), fitted)
    return fitted
