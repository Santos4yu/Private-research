"""Resolve builder legs to active PrizePicks MLB, NFL, NBA and WNBA projections.

A leg whose line PrizePicks has since moved goes out on PrizePicks' current
line for the same pick (the response says which), and a pick PrizePicks has
taken down is left out -- the rest of the lineup still opens.
"""

import json
import re
import threading
import time
import unicodedata
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests


PRIZEPICKS_PROJECTIONS_URL = (
    "https://partner-api.prizepicks.com/projections"
    "?single_stat=true&league_id={league_id}"
)
PRIZEPICKS_LEAGUES_URL = "https://partner-api.prizepicks.com/leagues"
PRIZEPICKS_APP_URL = "https://app.prizepicks.com/?projections="
# PrizePicks' own league ids. MLB's has always been 2. The others are read
# from the leagues feed by name (_league_id) and these are only fallbacks.
LEAGUE_IDS = {"MLB": "2", "WNBA": "3", "NFL": "9", "NHL": "8", "SOCCER": "82", "NBA": "7", "TENNIS": "5", "CS2": "265"}
_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; VORTEX-Private-Research/1.0)",
}
_CACHE_SECONDS = 120
# How old a feed may be to stand in while PrizePicks is briefly unreachable.
_STALE_SECONDS = 15 * 60
_TIER_ORDER = {"standard": 0, "goblin": 1, "demon": 2}
# The feed can arrive in pages (JSON:API links.next); a full NFL week is
# well over one page's worth of lines.
# Every page of a league's feed is read -- a full NBA or NFL slate runs to
# thousands of lines across every stat and tier, and stopping early dropped
# whole games -- up to this many, and for no longer than _PAGES_BUDGET
# seconds after the first, so a slate too big to read in time still shows
# everything read so far.
_MAX_PAGES = 80
_PAGES_BUDGET = 30
_LEAGUE_CACHE_SECONDS = 6 * 60 * 60
_CACHE_LOCK = threading.Lock()
_PROJECTION_CACHE = {}  # league -> {"loaded_at": float, "rows": list}
_LEAGUE_CACHE = {}  # league -> {"loaded_at": float, "id": str}

_STAT_ALIASES = {
    "hitsrunsrbis": "hitsrunsrbis", "hits": "hits", "totalbases": "totalbases",
    "homeruns": "homeruns", "rbis": "rbis", "runsscored": "runs", "runs": "runs",
    "strikeouts": "hitterstrikeouts", "hitterstrikeouts": "hitterstrikeouts",
    "walks": "walks", "pitcherstrikeouts": "pitcherstrikeouts",
    "strikeoutspitcher": "pitcherstrikeouts", "pitchingouts": "pitchingouts",
    "outs": "pitchingouts", "hitsallowed": "hitsallowed",
    "earnedrunsallowed": "earnedrunsallowed", "earnedruns": "earnedrunsallowed",
    "walksallowed": "pitcherwalks", "pitcherwalksallowed": "pitcherwalks",
    "pitcherwalks": "pitcherwalks",
    # WNBA: the Finder's market names (api/wnba.py MARKETS) on the left,
    # PrizePicks' stat_type spellings ("3-PT Made", "Pts+Rebs+Asts") on the
    # right, so the two meet on one key.
    "points": "points", "rebounds": "rebounds", "assists": "assists",
    "3pointersmade": "3ptmade", "threepointersmade": "3ptmade", "threes": "3ptmade", "3ptmade": "3ptmade",
    "blocks": "blockedshots", "blockedshots": "blockedshots", "steals": "steals",
    "blockssteals": "blksstls", "blksstls": "blksstls", "turnovers": "turnovers",
    "pointsrebounds": "ptsrebs", "ptsrebs": "ptsrebs",
    "pointsassists": "ptsasts", "ptsasts": "ptsasts",
    "reboundsassists": "rebsasts", "rebsasts": "rebsasts",
    "pointsreboundsassists": "ptsrebsasts", "ptsrebsasts": "ptsrebsasts",
    "fantasypoints": "fantasyscore", "fantasyscore": "fantasyscore",
    # PrizePicks calls the MLB one "Hitter Fantasy Score"; the Finder shows
    # "Fantasy Score".
    "hitterfantasyscore": "fantasyscore",
}


def _norm(value):
    ascii_value = unicodedata.normalize("NFKD", str(value or ""))
    ascii_value = ascii_value.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", ascii_value.lower())


def _norm_stat(value):
    normalized = _norm(value)
    return _STAT_ALIASES.get(normalized, normalized)


def _league_of(leg):
    return str(leg.get("league") or leg.get("sport") or "MLB").strip().upper()[:12]


def _league_id(league):
    """PrizePicks' id for ``league``, read from its leagues feed by name.

    MLB keeps its fixed id. For anything else a failed or unexpected leagues
    response falls back to LEAGUE_IDS -- rows are still checked against the
    league name below, so a stale id can only find nothing, never the wrong
    league's lines.
    """
    fallback = LEAGUE_IDS.get(league)
    if league == "MLB":
        return fallback
    now = time.time()
    with _CACHE_LOCK:
        cached = _LEAGUE_CACHE.get(league)
        if cached and now - cached["loaded_at"] < _LEAGUE_CACHE_SECONDS:
            return cached["id"]
    league_id = fallback
    try:
        response = requests.get(PRIZEPICKS_LEAGUES_URL, headers=_HEADERS, timeout=10)
        response.raise_for_status()
        for item in response.json().get("data") or []:
            name = str((item.get("attributes") or {}).get("name") or "").strip().upper()
            if name == league and item.get("id") is not None:
                league_id = str(item["id"])
                break
    except (requests.RequestException, ValueError, AttributeError):
        pass
    if league_id is None:
        # Not one of the boards' leagues, and PrizePicks lists no such league.
        raise ValueError(f"PrizePicks has no {league} board right now.")
    with _CACHE_LOCK:
        _LEAGUE_CACHE[league] = {"loaded_at": now, "id": league_id}
    return league_id


def _shared_projection_cache(league, now):
    try:
        from v2.board import store
        raw = store.get("krazy_data:prizepicks:feed:v1:" + league, timeout=1)
        entry = json.loads(raw) if raw else None
        if (isinstance(entry, dict) and isinstance(entry.get("rows"), list)
                and 0 <= now - float(entry.get("loaded_at", 0)) < _STALE_SECONDS):
            return entry
    except Exception:
        pass
    return None


def _save_shared_projection_cache(league, entry):
    try:
        from v2.board import store
        store.pipeline([["SET", "krazy_data:prizepicks:feed:v1:" + league,
                         json.dumps(entry), "EX", _STALE_SECONDS]], timeout=1)
    except Exception:
        pass


# A promo is a line PrizePicks posts far below the player's real number --
# Anthony Edwards at 0.5 points on a 27.5 night. PrizePicks only lets one
# into an entry. It marks some (flash sales); the rest give themselves away
# by sitting at least this many times under the player's next line on the
# same stat. Nine keeps ordinary low lines out: a 0.5 hits or anytime TD
# under a 1.5 Demon is a regular line, not a promo.
PROMO_GAP = 9


def _mark_promos(rows):
    """Sets row["promo"] on every row: True for a promo line (see PROMO_GAP)."""
    lines = {}
    for row in rows:
        key = (row.get("player_id") or row.get("player"), _norm_stat(row.get("stat")), str(row.get("start_time") or "")[:13])
        lines.setdefault(key, []).append(row)
    for group in lines.values():
        for row in group:
            higher = [other["line"] for other in group if other is not row and other["line"] > row["line"]]
            row["promo"] = bool(row.get("flash")) or (
                row.get("odds_type") == "standard" and row["line"] > 0 and bool(higher) and min(higher) >= PROMO_GAP * row["line"])
    return rows


def _fetch_projection_rows(force=False, league="MLB"):
    """Every active line in ``league``, each marked whether it is a promo."""
    return _mark_promos(_load_projection_rows(force=force, league=league))


def _load_projection_rows(force=False, league="MLB"):
    league = str(league or "MLB").upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9 ]{1,19}", league):
        raise ValueError(f"PrizePicks export does not support {league}.")
    now = time.time()
    with _CACHE_LOCK:
        cached = _PROJECTION_CACHE.get(league)
        if not force and cached and cached["rows"] and now - cached["loaded_at"] < _CACHE_SECONDS:
            return cached["rows"]

    shared = _shared_projection_cache(league, now)
    if shared and (not cached or shared["loaded_at"] > cached["loaded_at"]):
        cached = shared
        with _CACHE_LOCK:
            _PROJECTION_CACHE[league] = shared
    if not force and cached and cached["rows"] and now - cached["loaded_at"] < _CACHE_SECONDS:
        return cached["rows"]
    league_id = _league_id(league)
    try:
        response = requests.get(
            PRIZEPICKS_PROJECTIONS_URL.format(league_id=league_id),
            headers=_HEADERS,
            timeout=25,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("error") or not isinstance(payload.get("data"), list):
            raise RuntimeError(payload.get("error") or "PrizePicks returned an invalid projection feed.")
    except (requests.RequestException, ValueError, RuntimeError):
        # A brief PrizePicks hiccup (a timeout, a rate limit): the last good
        # feed from the past few minutes stands in rather than failing.
        if cached and cached["rows"] and now - cached["loaded_at"] < _STALE_SECONDS:
            return cached["rows"]
        raise
    data, included = list(payload["data"]), list(payload.get("included") or [])
    next_url, pages = (payload.get("links") or {}).get("next"), 1
    started = time.time()
    while next_url and pages < _MAX_PAGES and time.time() - started < _PAGES_BUDGET:
        url = urljoin(PRIZEPICKS_PROJECTIONS_URL, str(next_url))
        if urlparse(url).netloc != urlparse(PRIZEPICKS_PROJECTIONS_URL).netloc:
            break
        try:
            response = requests.get(url, headers=_HEADERS, timeout=25)
            response.raise_for_status()
            page = response.json()
        except (requests.RequestException, ValueError):
            break  # The pages already read still stand.
        if not isinstance(page.get("data"), list):
            break
        data += page["data"]
        included += page.get("included") or []
        next_url, pages = (page.get("links") or {}).get("next"), pages + 1

    players = {
        str(item.get("id")): item.get("attributes") or {}
        for item in included if item.get("type") == "new_player"
    }
    rows = []
    for projection in data:
        attrs = projection.get("attributes") or {}
        relationships = projection.get("relationships") or {}
        row_league_id = str(((relationships.get("league") or {}).get("data") or {}).get("id") or "")
        player_id = str(((relationships.get("new_player") or {}).get("data") or {}).get("id") or "")
        player = players.get(player_id) or {}
        if row_league_id != league_id and str(player.get("league") or "").upper() != league:
            continue
        if attrs.get("status") != "pre_game":
            continue
        if attrs.get("is_live"):
            # Tennis pre-game offers can carry is_live/in_game before kickoff.
            # Only retain that conflicting flag when the recorded start proves
            # it is still upcoming; never admit a genuinely live projection.
            try:
                starts = datetime.fromisoformat(str(attrs.get("start_time") or "").replace("Z", "+00:00")).timestamp()
            except (ValueError, TypeError):
                starts = None
            if league != "TENNIS" or starts is None or starts <= now:
                continue
        odds_type = str(attrs.get("odds_type") or "standard").lower()
        # A line that names its sides must offer More. One that names none
        # is kept: a standard line plays both ways, a Goblin or Demon More only.
        wagers = str(attrs.get("allowed_wager_types") or "").lower()
        if wagers and "over" not in wagers:
            continue
        wagers = wagers or ("over,under" if odds_type == "standard" else "over")
        line = attrs.get("flash_sale_line_score")
        flash = line is not None
        if line is None:
            line = attrs.get("line_score")
        try:
            line = float(line)
        except (TypeError, ValueError):
            continue
        rows.append({
            "id": str(projection.get("id") or ""),
            "league": league,
            "player": str(player.get("display_name") or player.get("name") or ""),
            "player_id": player_id,
            "stat": str(attrs.get("stat_type") or attrs.get("stat_display_name") or ""),
            "line": line,
            "odds_type": odds_type,
            "allowed_wager_types": wagers,
            "updated_at": str(attrs.get("updated_at") or ""),
            "headshot": str(player.get("image_url") or ""),
            "team": str(player.get("team") or ""),
            "team_name": str(player.get("team_name") or player.get("market") or ""),
            "position": str(player.get("position") or ""),
            "start_time": str(attrs.get("start_time") or ""),
            # The opponent on single-player lines; combo lines ("A + B")
            # are flagged so a board can keep them apart.
            "description": str(attrs.get("description") or ""),
            "combo": bool(player.get("combo")) or " + " in str(player.get("display_name") or player.get("name") or ""),
            "flash": flash,
        })
    if not rows:
        raise RuntimeError(f"PrizePicks returned no active {league} projections.")
    with _CACHE_LOCK:
        _PROJECTION_CACHE[league] = {"loaded_at": now, "rows": rows}
    _save_shared_projection_cache(league, {"loaded_at": now, "rows": rows})
    # Every fresh feed, whichever board asked for it, is where the Line
    # Moves page learns a line changed (line_moves.py).
    try:
        import line_moves
        line_moves.observe_prizepicks(league, rows, fetched_at=now)
    except Exception:  # noqa: BLE001 -- never at the cost of the feed itself
        pass
    return rows


def _playable(row, side):
    # Goblin/Demon alternate projections are More-only in the app even when
    # the partner feed's allowed_wager_types field is overly broad.
    if side == "under" and row["odds_type"] in {"goblin", "demon"}:
        return False
    return side in row["allowed_wager_types"]


def _resolve_legs(legs, rows):
    matches, unmatched, used_ids = [], [], set()
    for index, leg in enumerate(legs):
        player = str(leg.get("player") or "").strip()
        stat = str(leg.get("stat") or "").strip()
        side = str(leg.get("side") or "over").strip().lower()
        league = _league_of(leg)
        tier = str(leg.get("modifier") or "").strip().lower()
        try:
            line = float(leg.get("line"))
        except (TypeError, ValueError):
            unmatched.append({"leg": index, "player": player, "stat": stat, "line": leg.get("line"), "reason": "Invalid line"})
            continue
        if side not in {"over", "under"}:
            unmatched.append({"leg": index, "player": player, "stat": stat, "line": line, "reason": "Side must be More or Less"})
            continue
        same_pick = [
            row for row in rows
            if row.get("league", "MLB") == league
            and _norm(row["player"]) == _norm(player)
            and _norm_stat(row["stat"]) == _norm_stat(stat)
            and row["id"] not in used_ids
        ]
        playable = [row for row in same_pick if _playable(row, side)]
        # The saved line when PrizePicks still has it (the saved tier first);
        # otherwise PrizePicks' current line for the same pick -- same tier,
        # then the closest line.
        exact = [row for row in playable if abs(row["line"] - line) < 0.001]
        wanted = tier or "standard"
        if exact:
            exact.sort(key=lambda row: (row["odds_type"] != wanted, _TIER_ORDER.get(row["odds_type"], 3), row["updated_at"]))
            match = exact[0]
        elif playable:
            playable.sort(key=lambda row: (row["odds_type"] != wanted, abs(row["line"] - line),
                                           _TIER_ORDER.get(row["odds_type"], 3), row["updated_at"]))
            match = playable[0]
        else:
            reason = ("PrizePicks only offers More on this pick" if same_pick
                      else "No longer on PrizePicks")
            unmatched.append({"leg": index, "player": player, "stat": stat, "line": line, "reason": reason})
            continue
        used_ids.add(match["id"])
        line_token = f"{match['line']:g}"
        direction_token = "o" if side == "over" else "u"
        matches.append({
            "leg": index, "projectionId": match["id"], "league": league, "player": player, "stat": match["stat"],
            "line": match["line"], "side": "More" if side == "over" else "Less",
            "oddsType": match["odds_type"],
            "changed": abs(match["line"] - line) >= 0.001, "previousLine": line,
            "projectionToken": f"{match['id']}-{direction_token}-{line_token}",
        })
    return matches, unmatched


def build_export(legs):
    """Return ``(http_status, response_body)`` for a validated lineup."""
    if not isinstance(legs, list) or not 2 <= len(legs) <= 6:
        return 400, {"error": "A PrizePicks lineup needs 2 to 6 legs."}
    if any(not isinstance(leg, dict) for leg in legs):
        return 400, {"error": "Every lineup leg must be an object."}
    leagues = sorted({_league_of(leg) for leg in legs})
    unsupported = [league for league in leagues if league not in LEAGUE_IDS]
    if unsupported:
        return 400, {
            "error": f"PrizePicks export supports {', '.join(sorted(LEAGUE_IDS))} picks only. "
                     f"Remove {', '.join(unsupported)} picks first.",
        }
    try:
        rows = [row for league in leagues for row in _fetch_projection_rows(league=league)]
        matches, unmatched = _resolve_legs(legs, rows)
    except (requests.RequestException, RuntimeError, ValueError) as exc:
        return 502, {"error": f"PrizePicks projections are temporarily unavailable: {exc}"}
    if not matches:
        return 409, {
            "error": "None of these picks are on PrizePicks right now.",
            "matched": matches, "unmatched": unmatched,
        }
    # PrizePicks' outcome-level deep links encode both direction and line in
    # each projection token (``<id>-o-1.5`` / ``<id>-u-1.5``). A bare ID
    # lets the app choose a default side and can silently turn More into Less.
    projection_ids = ",".join(match["projectionToken"] for match in matches)
    # Moved lines went out on PrizePicks' current line ("changed"); picks it
    # took down are left out ("skipped"). The lineup opens for review either way.
    return 200, {
        "url": PRIZEPICKS_APP_URL + projection_ids,
        "matches": matches, "changed": [match for match in matches if match["changed"]],
        "skipped": unmatched, "reviewRequired": True,
    }


# ---------------------------------------------------------------- a slip's picture, to PrizePicks

# What a slip may call a league, as PrizePicks names it.
_LEAGUE_ALIASES = {
    "CSGO": "CS2", "CS": "CS2", "COUNTERSTRIKE": "CS2", "COUNTERSTRIKE2": "CS2", "LEAGUEOFLEGENDS": "LOL", "VALORANT": "VAL",
    "DOTA": "DOTA2", "NCAAF": "CFB", "COLLEGEFOOTBALL": "CFB", "NCAAB": "CBB", "NCAAM": "CBB", "COLLEGEBASKETBALL": "CBB",
    "UFC": "MMA", "GOLF": "PGA", "FOOTBALL": "NFL", "BASKETBALL": "NBA", "BASEBALL": "MLB", "HOCKEY": "NHL", "FUTBOL": "SOCCER",
    "EPL": "SOCCER", "MLS": "SOCCER", "UCL": "SOCCER", "LALIGA": "SOCCER", "WTA": "TENNIS", "ATP": "TENNIS", "CALLOFDUTY": "COD",
}
_ACTIVE_LEAGUES = {"loaded_at": 0.0, "names": []}
# How long finding a slip's picks may spend reading PrizePicks' boards.
_FIND_BUDGET = 30


def _squash_league(value):
    return re.sub(r"[^A-Z0-9]", "", str(value or "").upper())


def league_name(value):
    """A league as PrizePicks names it ("CS2", "NBA"), or "" when unsure."""
    text = _squash_league(value)
    return _LEAGUE_ALIASES.get(text, text)[:20] if text else ""


def _active_leagues():
    """The leagues PrizePicks has lines up in right now, as its feed names
    them; each one's id is kept for _league_id on the way."""
    now = time.time()
    if _ACTIVE_LEAGUES["names"] and now - _ACTIVE_LEAGUES["loaded_at"] < 10 * 60:
        return _ACTIVE_LEAGUES["names"]
    names = []
    try:
        response = requests.get(PRIZEPICKS_LEAGUES_URL, headers=_HEADERS, timeout=10)
        response.raise_for_status()
        for item in response.json().get("data") or []:
            attrs = item.get("attributes") or {}
            name = str(attrs.get("name") or "").strip().upper()
            count = attrs.get("projections_count")
            if (not re.fullmatch(r"[A-Z0-9][A-Z0-9 ]{1,19}", name) or item.get("id") is None
                    or attrs.get("active") is False or (count is not None and count <= 0)):
                continue
            names.append(name)
            with _CACHE_LOCK:
                _LEAGUE_CACHE[name] = {"loaded_at": now, "id": str(item["id"])}
    except (requests.RequestException, ValueError, AttributeError, TypeError):
        names = []
    names = list(dict.fromkeys(names)) or list(LEAGUE_IDS)
    _ACTIVE_LEAGUES.update(loaded_at=now, names=names)
    return names


def _board_names(value, active):
    """The boards in `active` a slip's league could be: "CSGO" is CS2,
    "LoL" is LOL; one PrizePicks doesn't list is still tried by name."""
    text = _squash_league(value)
    if not text:
        return []
    wanted = {text, league_name(text)}
    found = [name for name in active if _squash_league(name) in wanted]
    return found or [league_name(text)]


def _words(value):
    ascii_value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode("ascii").lower()
    return [word for word in re.split(r"[^a-z0-9]+", ascii_value) if word and word not in {"jr", "sr", "ii", "iii", "iv"}]


def _alike(a, b):
    """How alike two names are, 0 to 1: the letters and the words."""
    from difflib import SequenceMatcher
    if not a or not b:
        return 0.0
    if _norm(a) == _norm(b):
        return 1.0
    left, right = set(_words(a)), set(_words(b))
    shared = len(left & right) / len(left | right) if left | right else 0.0
    return max(SequenceMatcher(None, _norm(a), _norm(b)).ratio(), shared)


def _player_score(read, listed):
    if _norm(read) == _norm(listed):
        return 1.0
    a, b = _words(read), _words(listed)
    # "J. Brunson" or a cut-off first name: the last name and the first initial.
    if a and b and a[-1] == b[-1] and a[0][:1] == b[0][:1]:
        return 0.93
    return _alike(read, listed)


def _stat_score(read, listed):
    if not read:
        return 0.0
    if _norm_stat(read) == _norm_stat(listed):
        return 1.0
    a, b = _norm(read), _norm(listed)
    if a and b and (a in b or b in a):
        return 0.86
    return _alike(read, listed)


def _find_one(leg, rows):
    """The PrizePicks line a slip's leg is, from `rows`: (row, how sure) or (None, why)."""
    player, stat = str(leg.get("player") or ""), str(leg.get("stat") or leg.get("statName") or "")
    side = "under" if str(leg.get("side") or "").lower() in ("under", "less", "lower") else "over"
    tier = str(leg.get("modifier") or "standard").lower()
    try:
        line = float(leg.get("line"))
    except (TypeError, ValueError):
        line = None
    best, best_key, near_player = None, None, False
    for row in rows:
        if row.get("combo"):
            continue
        who = _player_score(player, row["player"])
        if who < 0.85:
            continue
        near_player = True
        what = max(_stat_score(stat, row["stat"]), _stat_score(leg.get("statName"), row["stat"]))
        if what < 0.6:
            continue
        exact = line is not None and abs(row["line"] - line) < 0.001
        key = (round(who * 0.6 + what * 0.4, 3), exact, _playable(row, side), row["odds_type"] == tier,
               -abs(row["line"] - line) if line is not None else 0, -_TIER_ORDER.get(row["odds_type"], 3))
        if best_key is None or key > best_key:
            best, best_key = row, key
    if best is None:
        return None, ("PrizePicks has this player, but not this stat right now" if near_player
                      else "Not on PrizePicks right now")
    return best, best_key[0]


def find_picks(legs, budget=_FIND_BUDGET):
    """Each leg read off a slip's picture, found on PrizePicks' boards: the
    league the slip shows first, then every league PrizePicks has up, read
    side by side, within `budget` seconds. In the slip's order:
    [{index, read, pick}] or [{index, read, reason}]."""
    from concurrent.futures import ThreadPoolExecutor, wait
    started = time.time()
    boards = {}

    def read_boards(names):
        names = [name for name in dict.fromkeys(names) if name not in boards]
        if not names:
            return
        pool = ThreadPoolExecutor(max_workers=6)
        futures = {pool.submit(_fetch_projection_rows, league=name): name for name in names}
        done, _ = wait(futures, timeout=max(1.0, budget - (time.time() - started)))
        # A board still loading past the budget is left behind, not waited on.
        pool.shutdown(wait=False, cancel_futures=True)
        for future in futures:
            rows = []
            if future in done:
                try:
                    rows = [row for row in future.result() if not row.get("combo")]
                except Exception:  # noqa: BLE001 -- one league's board failing leaves the others
                    rows = []
            boards[futures[future]] = rows

    def search(pick, names):
        for name in names:
            row, score = _find_one(pick["leg"], boards.get(name) or [])
            if row is None:
                # The closer miss says more ("has this player, but not this stat").
                if "player" in score:
                    pick["reason"] = score
            elif not pick["found"] or score > pick["score"]:
                pick.update(found=row, score=score, reason=None)

    picks = [{"leg": leg, "found": None, "score": 0.0, "reason": "Not on PrizePicks right now"} for leg in legs]
    active = _active_leagues()
    named = {id(pick): _board_names(pick["leg"].get("league") or pick["leg"].get("sport"), active)
             for pick in picks}
    read_boards([name for names in named.values() for name in names])
    for pick in picks:
        search(pick, named[id(pick)])
    # Not in the league the slip shows (or it shows none): every other one.
    if any(pick["found"] is None for pick in picks):
        read_boards(active)
        for pick in picks:
            if pick["found"] is None:
                search(pick, [name for name in boards if name not in named[id(pick)]])
    out = []
    for index, pick in enumerate(picks):
        leg, row = pick["leg"], pick["found"]
        side = "under" if str(leg.get("side") or "").lower() in ("under", "less", "lower") else "over"
        entry = {"index": index, "read": {key: leg.get(key) for key in ("player", "stat", "line", "side", "modifier", "league", "sport")}}
        if row is None:
            entry["reason"] = pick["reason"]
        else:
            # PrizePicks only takes More on a Goblin or Demon.
            if not _playable(row, side):
                side = "over"
            try:
                read_line = float(leg.get("line"))
            except (TypeError, ValueError):
                read_line = None
            entry["pick"] = {"projectionId": row["id"], "league": row["league"], "player": row["player"], "stat": row["stat"],
                             "line": row["line"], "oddsType": row["odds_type"], "side": side, "headshot": row.get("headshot") or "",
                             "team": row.get("team") or "", "opponent": row.get("description") or "", "startsAt": row.get("start_time") or "",
                             "sides": [name for name in ("over", "under") if _playable(row, name)],
                             "changed": read_line is not None and abs(row["line"] - read_line) >= 0.001, "sure": round(pick["score"], 2)}
        out.append(entry)
    return out


def picks_url(picks):
    """The PrizePicks link that opens these picks ({projectionId, side, line}), each on its side."""
    tokens = [f"{pick['projectionId']}-{'u' if pick.get('side') == 'under' else 'o'}-{float(pick['line']):g}" for pick in picks]
    return PRIZEPICKS_APP_URL + ",".join(tokens) if tokens else None
