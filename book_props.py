"""DraftKings' NBA player props (Nov 12, the owner on the Props tab: "I want
better props higher hit rate"). The track record showed the matchup score
going over 40-42% in every band: PrizePicks' lines already price the
matchup. A sportsbook's own price on the same player and stat is the
signal they don't: when DraftKings has his over at -150, or his line a
point higher than PrizePicks', the over is the likelier side.

Read from the public feed DraftKings' own pages use (the one the Game
Predictor reads for moneylines, game_predictor.DK_URL): the league's
player-prop categories, then each category's over/under subcategories.
Unofficial, so everything here fails quietly: no feed, no signal.

  props()  {"at", "players": {name key: {stat: [line, over, under, fair]}}}
           with `fair` the over's chance with the book's cut taken out.
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import requests

BASE = "https://sportsbook-nash.draftkings.com/api/sportscontent/dkusnj/v1/leagues/42648"
HEADERS = {"Accept": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
TIMEOUT = 6
# DraftKings' NBA player-prop categories when the league feed doesn't list
# them (points, rebounds, assists, threes, combos, defense).
FALLBACK_CATEGORIES = (1215, 1216, 1217, 1218, 583, 1219)
# Kept this long in KV and in this instance's memory.
KEEP_SECONDS = 5 * 60
KV_KEY = "krazy_data:book-props:v1:nba"
# The props' stats (the site's short keys), combos first so "points +
# rebounds" never reads as points.
STATS = (
    (r"(points|pts)\s*\+\s*(rebounds|reb)\s*\+\s*(assists|ast)|\bpra\b", "pra"),
    (r"(points|pts)\s*\+\s*(rebounds|reb)", "pr"),
    (r"(points|pts)\s*\+\s*(assists|ast)", "pa"),
    (r"(rebounds|reb)\s*\+\s*(assists|ast)", "ra"),
    (r"(steals|stl)\s*\+\s*(blocks|blk)", None),
    (r"three|3-pointer|3pt|3-pt|threes", "tpm"),
    (r"points", "pts"),
    (r"rebounds", "reb"),
    (r"assists", "ast"),
    (r"steals", "stl"),
    (r"blocks", "blk"),
    (r"turnovers", "tov"),
)
_memory: dict = {}


def name_key(name) -> str:
    """"Luka Dončić", "Jaren Jackson Jr." and "jaren jackson" read the same."""
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b\.?", " ", text)
    return re.sub(r"[^a-z]", "", text)


def stat_of(text):
    """The site's stat key for a market or subcategory name ("Points O/U",
    "Pts + Reb + Ast O/U"), else None."""
    text = str(text or "").lower()
    for pattern, key in STATS:
        if re.search(pattern, text):
            return key
    return None


def american(text):
    """DraftKings' odds text ("−150" with its Unicode minus, "+130", "EVEN") as a number."""
    value = str(text if text is not None else "").strip().upper().replace("−", "-").replace("–", "-").replace("+", "")
    if value in ("EVEN", "EV"):
        return 100.0
    try:
        number = float(value)
    except ValueError:
        return None
    return number if abs(number) >= 100 else None


def implied(price):
    return -price / (-price + 100) if price < 0 else 100 / (price + 100)


def fair(over, under):
    """The over's chance with the book's cut taken out (both sides scaled to add to 1)."""
    if over is None or under is None:
        return None
    a, b = implied(over), implied(under)
    return a / (a + b) if a + b > 0 else None


def _side(selection):
    label = str(selection.get("label") or selection.get("outcomeType") or "").strip().lower()
    return "over" if label.startswith("o") else "under" if label.startswith("u") else None


def _player(selection, market):
    for person in selection.get("participants") or []:
        if str(person.get("type") or "").lower() == "player" and person.get("name"):
            return person["name"]
    name = str(market.get("name") or "")
    # "Jalen Brunson Points O/U" -> "Jalen Brunson"
    found = re.match(r"^(.*?)\s+(points|pts|rebounds|reb|assists|ast|threes?|3-pointers|3pt|steals|blocks|turnovers)\b", name, re.I)
    return found.group(1).strip() if found else None


def parse(payload, subcategory_names=None) -> list:
    """One feed's over/under player props: [{player, stat, line, over, under,
    eventId}]. A market counts when it has an over and an under on one line
    for one player; milestones ("20+") and yes/no markets are left out."""
    payload = payload or {}
    subcategory_names = subcategory_names or {}
    markets = {str(market.get("id")): market for market in payload.get("markets") or [] if market.get("id") is not None}
    sides: dict = {}
    for selection in payload.get("selections") or []:
        market = markets.get(str(selection.get("marketId")))
        side = _side(selection)
        if not market or not side:
            continue
        line = selection.get("points")
        price = american((selection.get("displayOdds") or {}).get("american"))
        try:
            line = float(line)
        except (TypeError, ValueError):
            continue
        if price is None:
            continue
        found = sides.setdefault(str(market.get("id")), {"market": market, "line": line})
        found[side] = price
        found.setdefault("player", _player(selection, market))
    out = []
    for item in sides.values():
        market = item["market"]
        kind = (market.get("marketType") or {}).get("name") or subcategory_names.get(str(market.get("subcategoryId"))) or market.get("name")
        stat = stat_of(kind) or stat_of(market.get("name"))
        if not stat or "over" not in item or "under" not in item or not item.get("player"):
            continue
        out.append({"player": item["player"], "stat": stat, "line": item["line"], "over": item["over"], "under": item["under"],
                    "eventId": str(market.get("eventId") or "")})
    return out


def collect(rows) -> dict:
    """{name key: {stat: [line, over, under, fair]}}: a player's main line
    in each stat, the one priced closest to even when there are several."""
    best: dict = {}
    for row in rows:
        chance = fair(row["over"], row["under"])
        if chance is None:
            continue
        slot = best.setdefault(name_key(row["player"]), {})
        old = slot.get(row["stat"])
        if old is None or abs(chance - 0.5) < abs(old[3] - 0.5):
            slot[row["stat"]] = [row["line"], row["over"], row["under"], round(chance, 4)]
    return {key: stats for key, stats in best.items() if key and stats}


def _get(url, get=requests.get):
    try:
        response = get(url, headers=HEADERS, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json()
    except Exception:  # noqa: BLE001 -- no feed, no signal
        return None


def _player_categories(league):
    """The league feed's player-prop categories: [(id, name)]."""
    found = [(item.get("id"), item.get("name")) for item in (league or {}).get("categories") or []
             if item.get("id") is not None and re.search(r"player|points|rebounds|assists|threes|combo|defense", str(item.get("name") or ""), re.I)]
    return found or [(cat, None) for cat in FALLBACK_CATEGORIES]


def read(get=requests.get) -> list:
    """Every NBA over/under player prop on DraftKings now."""
    league = _get(BASE, get)
    categories = _player_categories(league)

    def category(cat):
        payload = _get(f"{BASE}/categories/{cat}", get)
        if not payload:
            return []
        subs = [item for item in payload.get("subcategories") or [] if item.get("id") is not None]
        names = {str(item["id"]): item.get("name") for item in subs}
        rows = parse(payload, names)
        # The category page shows one subcategory; the other over/unders are a read each.
        shown = {str(market.get("subcategoryId")) for market in payload.get("markets") or []}
        wanted = [str(item["id"]) for item in subs
                  if str(item["id"]) not in shown and str(item.get("categoryId", cat)) == str(cat)
                  and re.search(r"o/u|over", str(item.get("name") or ""), re.I) and stat_of(item.get("name"))]
        for sub in wanted[:8]:
            rows += parse(_get(f"{BASE}/categories/{cat}/subcategories/{sub}", get), names)
        return rows

    with ThreadPoolExecutor(max_workers=6) as pool:
        found = [row for rows in pool.map(category, [cat for cat, _ in categories]) for row in rows]
    return found


def props(kv_get=None, kv_set=None, get=requests.get, now=None) -> dict:
    """DraftKings' NBA player props, read at most every KEEP_SECONDS (this
    instance's memory, then KV, then the feed)."""
    now = time.time() if now is None else now
    hit = _memory.get("nba")
    if hit and now - hit[0] < KEEP_SECONDS:
        return hit[1]
    value = None
    if kv_get:
        try:
            kept = kv_get(KV_KEY)
            value = json.loads(kept) if kept else None
        except Exception:  # noqa: BLE001 -- read it fresh
            value = None
    if not value:
        rows = read(get)
        value = {"at": int(now), "players": collect(rows), "count": len(rows)}
        if kv_set and value["players"]:
            try:
                kv_set(KV_KEY, json.dumps(value, separators=(",", ":")), ex=KEEP_SECONDS)
            except Exception:  # noqa: BLE001 -- the next read tries again
                pass
    _memory["nba"] = (now, value)
    return value
