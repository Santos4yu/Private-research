"""What the news says about one player, for a prop (the Finder player
page's News card).

The owner, Nov 1, with another app's cards (a player saying he's trying to
take more shots, a teammate out, minutes cut in a blowout): "We need
information like this this is super important." Free sources only:

* ESPN's player news (its fantasy game's feed: injury updates, quotes,
  role and minutes notes), the last NEWS_DAYS days.
* Groq's free text models (slip_reader.py) read those items for the line
  in question and write a few short notes, each marked as helping the over
  (up), hurting it (down) or neither (flat), with a one or two sentence
  read. A note always points at the item it came from: its date, source
  and link are ESPN's, never the model's. Without Groq the items' own
  headlines are the notes.

Kept NOTES_SECONDS per player and line in the store, so a page asked by
many members reads ESPN and Groq once.
"""
from __future__ import annotations

import html
import json
import re
import time
from datetime import datetime, timedelta, timezone

import requests

# ESPN's fantasy game for each league (its player news lives there).
GAMES = {"nba": "fba", "wnba": "wfba", "nfl": "ffl", "nhl": "fhl", "mlb": "flb"}
NEWS_URL = "https://site.api.espn.com/apis/fantasy/v2/games/{game}/news/players"
NEWS_DAYS = 21
NEWS_LIMIT = 25
MAX_ITEMS = 12
MAX_NOTES = 6
NOTES_SECONDS = 45 * 60
NEWS_SECONDS = 20 * 60
TONES = ("up", "down", "flat")
_memory: dict = {}


def _kept(key, seconds, load):
    """`load()` once per `seconds` per key, in memory (each warm function)."""
    now = time.time()
    hit = _memory.get(key)
    if hit and now - hit[0] < seconds:
        return hit[1]
    value = load()
    _memory[key] = (now, value)
    if len(_memory) > 400:
        _memory.pop(next(iter(_memory)))
    return value


def _text(value) -> str:
    """Plain text from ESPN's story HTML."""
    text = re.sub(r"<[^>]+>", " ", str(value or ""))
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def _when(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def news_items(payload, now: datetime | None = None) -> list:
    """ESPN's news payload as [{headline, text, published, link, source}],
    newest first, the last NEWS_DAYS days, MAX_ITEMS at most."""
    now = now or datetime.now(timezone.utc)
    raw = payload if isinstance(payload, list) else (payload or {}).get("feed") or (payload or {}).get("articles") or []
    items, seen = [], set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        headline = _text(entry.get("headline") or entry.get("title"))
        body = _text(entry.get("story") or entry.get("description") or "")
        published = _when(entry.get("published") or entry.get("lastModified"))
        if not (headline or body) or not published or now - published > timedelta(days=NEWS_DAYS):
            continue
        key = (headline or body)[:80].lower()
        if key in seen:
            continue
        seen.add(key)
        link = ((entry.get("links") or {}).get("web") or {}).get("href") or None
        source = entry.get("source") or ("RotoWire" if str(entry.get("type") or "").lower() == "rotowire" else "ESPN")
        items.append({"headline": headline, "text": body[:900], "published": published.isoformat(), "link": link, "source": str(source)})
    items.sort(key=lambda item: item["published"], reverse=True)
    return items[:MAX_ITEMS]


def espn_id(sport: str, player_id: str, now: datetime | None = None) -> str:
    """The ESPN athlete id behind a board's player id: the NFL's boards use
    nflverse ids ("00-0033873"), mapped through its rosters
    (backend/sports/nfl/finder.espn_ids); the other leagues' are ESPN's."""
    player_id = str(player_id or "").strip()
    if sport != "nfl" or not player_id.startswith("00-"):
        return player_id
    now = now or datetime.now(timezone.utc)
    from backend.sports.nfl import finder
    return finder.espn_ids(now.year if now.month >= 3 else now.year - 1).get(player_id, "")


def espn_news(sport: str, player_id: str) -> list:
    """The player's ESPN news items (news_items); [] when there are none or ESPN can't be read."""
    player_id = espn_id(sport, player_id)
    game = GAMES.get(sport)
    if not game or not str(player_id or "").strip():
        return []

    def load():
        response = requests.get(NEWS_URL.format(game=game), params={"playerId": str(player_id), "limit": NEWS_LIMIT},
                                headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=10)
        response.raise_for_status()
        return news_items(response.json())
    return _kept(f"espn:{sport}:{player_id}", NEWS_SECONDS, load)


PROMPT = (
    "You write short research notes for a sports bettor about ONE player and ONE prop: {player} ({team}), "
    "{market} over {line}{when}.\n"
    "Use ONLY the numbered news items below. Never add facts, numbers, quotes, injuries or dates that are not in them. "
    "Skip items that say nothing about this player's health, minutes, role, usage, shot volume, mindset, teammates "
    "out or back, or this game (general articles that only mention him: rankings, highlight clips).\n"
    "Answer with JSON only: {{\"read\": \"one or two sentences on what the news means for this prop, or an empty "
    "string when nothing in it bears on it\", \"notes\": [{{\"item\": <the number of the item it comes from>, "
    "\"text\": \"one line under 140 characters, plain words\", \"tone\": \"up\" if it helps the over, \"down\" if it "
    "hurts it, else \"flat\"}}]}}. At most {most} notes, the ones that matter most for this prop first.\n\n"
    "News items, newest first:\n{items}"
)


def _prompt(player, team, market, line, when, items) -> str:
    listed = "\n".join(f"[{index}] ({item['published'][:10]}, {item['source']}) {item['headline']}. {item['text']}" for index, item in enumerate(items, 1))
    return PROMPT.format(player=player, team=team or "", market=market or "this stat", line=line if line not in (None, "") else "?",
                         when=f", game {when}" if when else "", most=MAX_NOTES, items=listed)


def clean_notes(answer, items) -> dict:
    """The model's answer kept to what can be shown: a read under 400
    characters, notes that name a real item (its date, source and link come
    from that item), a known tone, at most MAX_NOTES."""
    answer = answer if isinstance(answer, dict) else {}
    read = _text(answer.get("read"))[:400] or None
    notes = []
    for note in answer.get("notes") or []:
        if not isinstance(note, dict):
            continue
        try:
            index = int(note.get("item"))
        except (TypeError, ValueError):
            continue
        text = _text(note.get("text"))
        if not 1 <= index <= len(items) or not text:
            continue
        item = items[index - 1]
        tone = note.get("tone") if note.get("tone") in TONES else "flat"
        notes.append({"text": text[:180], "tone": tone, "published": item["published"], "source": item["source"], "link": item["link"]})
        if len(notes) >= MAX_NOTES:
            break
    return {"read": read, "notes": notes}


def headlines(items) -> dict:
    """Without a model: the items' own headlines, tone unknown -- RotoWire's
    player updates when there are any (ESPN's feed also carries general
    articles that only mention him: rankings, highlight clips)."""
    updates = [item for item in items if item["source"] == "RotoWire"] or items
    return {"read": None, "notes": [{"text": (item["headline"] or item["text"])[:180], "tone": "flat", "published": item["published"],
                                     "source": item["source"], "link": item["link"]} for item in updates[:MAX_NOTES]]}


def read(sport, player_id, player, team="", market="", line=None, when="", ask=None, store=None) -> dict:
    """{read, notes, items, summarized} for one player and line: ESPN's news
    read by Groq (clean_notes), or the headlines when it can't. `ask(prompt)`
    and `store` are for tests (default: slip_reader's Groq and the site's
    store)."""
    key = f"krazy_data:news:v1:{sport}:{player_id}:{re.sub(r'[^a-z0-9]+', '-', str(market).lower())}:{line}"
    if store is None:
        try:
            from v2.board import store as site_store
            store = site_store
        except Exception:  # noqa: BLE001 -- memory alone, then
            store = None
    try:
        raw = store.get(key) if store else None
        kept = json.loads(raw) if raw else None
        if kept and time.time() - float(kept.get("at", 0)) < NOTES_SECONDS:
            return kept["value"]
    except Exception:  # noqa: BLE001
        pass
    items = espn_news(sport, player_id)
    summarized = False
    if items:
        if ask is None:
            import slip_reader
            ask = lambda prompt: slip_reader._ask(slip_reader.TEXT_MODELS, prompt)
        try:
            answer = ask(_prompt(player, team, market, line, when, items))
        except Exception:  # noqa: BLE001 -- the headlines still help
            answer = None
        notes = clean_notes(answer, items) if answer else None
        summarized = bool(notes and (notes["notes"] or notes["read"]))
        notes = notes if summarized else headlines(items)
    else:
        notes = {"read": None, "notes": []}
    value = {**notes, "items": len(items), "summarized": summarized}
    if store and items:
        try:
            store.set(key, json.dumps({"at": time.time(), "value": value}, separators=(",", ":")))
        except Exception:  # noqa: BLE001
            pass
    return value
