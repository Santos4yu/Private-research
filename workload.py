"""Is a player being held back today? Read from the injury report's notes.

A player can be active and still not get his usual work: a back on a snap
count or a pitch count, a guard on a minutes limit, a starter on an innings
limit in his first start off the injured list, someone the team is easing
back in. The injury report's status says none of that (he isn't Out, often
not even Questionable); its note does. Each note is read here for those
words and turned into a small flag, {kind, cleared, date}. The note itself is
never passed on: it's a publisher's writing, and the flag is all a pick
needs.

`kind` is what's held back: snaps, touches (a football "pitch count"),
minutes, ice time, pitches, innings, or the workload in general. `cleared`
is a note saying the limit is gone ("no restrictions", "full workload").
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

# A note older than this is about another week's game.
FRESH_DAYS = 14

_HIM = r"(?:him|her)"
# (kind, pattern): words that say his work is limited. `None` for the kind
# is filled in by sport (a "pitch count" is carries in football).
LIMITS = (
    ("snaps", r"snap[- ]?counts?\b"),
    ("snaps", r"(?:limited|reduced|capped|restricted|managed) (?:number of )?snaps"),
    ("snaps", r"snaps? (?:will|could|may|might) be (?:limited|capped|managed|monitored|restricted)"),
    (None, r"pitch[- ]?counts?\b"),
    ("pitches", r"pitch (?:limit|cap)\b"),
    ("innings", r"innings? (?:limit|cap|restriction)s?\b"),
    ("innings", r"(?:limited|capped|restricted) to (?:about |around |roughly )?(?:\d+|one|two|three|four|a few) innings"),
    ("minutes", r"minutes?[- ](?:restriction|limit|cap)s?\b"),
    ("minutes", r"(?:restricted|limited|capped) (?:to )?(?:about |around |roughly )?\d+ minutes"),
    ("minutes", r"(?:limited|reduced|restricted) minutes"),
    ("minutes", r"(?:minutes|playing time) (?:will|could|may|might) be (?:limited|monitored|managed|capped|restricted)"),
    ("icetime", r"(?:limited|reduced|restricted) ice time"),
    ("icetime", r"ice time (?:will|could|may|might) be (?:limited|monitored|managed|capped|restricted)"),
    ("touches", r"(?:limited|reduced|light|capped) (?:number of )?(?:carries|touches|targets)"),
    ("workload", r"(?:limited|reduced|light|lighter|capped|restricted|managed) (?:workload|role|usage)"),
    ("workload", r"workload (?:will|could|may|might|is expected to|figures to|is likely to) be (?:limited|managed|monitored|capped|reduced|light|restricted)"),
    ("workload", r"manag(?:e|ed|ing) (?:his|her) (?:workload|snaps|minutes|reps)"),
    ("workload", rf"eas(?:e|ed|ing) {_HIM} (?:back|in)\b"),
    ("workload", r"eased (?:back )?into"),
    ("workload", rf"ramp(?:ed|ing)? {_HIM} up"),
    # Already says "not": never read as a limit lifted.
    ("workload", r"(?:won'?t|will not|isn'?t expected to|is not expected to|not expected to|unlikely to) (?:play|handle|see|get) "
                 r"(?:a |his |her |the )?(?:full|normal|usual|typical|starter'?s) (?:workload|complement|allotment|snaps|minutes|role|load)",
     True),
)
# A limit said not to apply: "no minutes restriction", "full workload".
CLEARED = (
    r"(?:no|without(?: any)?) (?:minutes?|snap|pitch|innings?|playing[- ]time)?[- ]?(?:restrictions?|limitations?|limits?|caps?)\b",
    r"(?:restrictions?|limitations?|limits?) (?:has|have|was|were|is|are) (?:been )?(?:lifted|removed|gone)",
    r"no longer (?:on|under|facing) (?:a |an )?(?:minutes?|snap|pitch|innings?)",
    r"(?:a |his |her )?full workload",
    r"(?:fully|full) (?:cleared|unrestricted)",
)
# A limit phrase with a "no"/"not" just before it says the opposite.
NEGATION = re.compile(r"(?:\b(?:no|not|without|no longer|free of|avoid(?:ed)?)\b|n't\b)[^.;]{0,24}$", re.I)
# "Eased back into practice" is about the week, not the game.
PRACTICE = re.compile(r"^[^.;]{0,20}\bpractice", re.I)

_LIMITS = [(entry[0], re.compile(entry[1], re.I), len(entry) > 2) for entry in LIMITS]
_CLEARED = [re.compile(pattern, re.I) for pattern in CLEARED]


def _kind(kind, sport):
    if kind:
        return kind
    return "touches" if sport in ("nfl", "cfb") else "pitches" if sport == "mlb" else "workload"


def read_limit(text, sport=None):
    """The note's last word on his workload: {kind, cleared} or None.

    The latest mention wins, so "was on a snap count last week but has no
    restrictions now" reads as cleared.
    """
    text = " ".join(str(text or "").split())
    if not text:
        return None
    found = []
    for kind, pattern, negated in _LIMITS:
        for match in pattern.finditer(text):
            if PRACTICE.search(text[match.end():]):
                continue
            before = text[max(0, match.start() - 40):match.start()]
            found.append((match.start(), {"kind": _kind(kind, sport), "cleared": not negated and bool(NEGATION.search(before))}))
    for pattern in _CLEARED:
        for match in pattern.finditer(text):
            if PRACTICE.search(text[match.end():]):
                continue
            # "Won't handle a full workload" is a limit, not one lifted.
            before = text[max(0, match.start() - 40):match.start()]
            found.append((match.start(), {"kind": "workload", "cleared": not NEGATION.search(before)}))
    if not found:
        return None
    found.sort(key=lambda item: item[0])
    last = found[-1][1]
    if last["cleared"]:
        # The limit that was lifted, if the note named one.
        named = [flag["kind"] for _at, flag in found if flag["kind"] != "workload"]
        return {"kind": named[-1] if named else "workload", "cleared": True}
    return dict(last)


def _day(value):
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)


def note_limit(item, sport=None, now=None):
    """The flag for one ESPN injury entry (its shortComment/longComment and
    date), or None: nothing said, or said too long ago to be about today."""
    if not isinstance(item, dict):
        return None
    when = _day(item.get("date"))
    now = now or datetime.now(timezone.utc)
    if when and now - when > timedelta(days=FRESH_DAYS):
        return None
    flag = None
    # The short note is the latest; the long one carries the background.
    for field in ("shortComment", "longComment"):
        flag = read_limit(item.get(field), sport)
        if flag:
            break
    if not flag:
        return None
    if when:
        flag["date"] = when.date().isoformat()
    return flag
