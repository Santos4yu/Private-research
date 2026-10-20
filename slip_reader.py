"""Reads a slip screenshot into its legs, for the Slip Analyzer
(api/prediction.py action=slip-analyzer).

Groq's vision model looks at the image itself, so it sees which side of
each pick is chosen (More/Less, Higher/Lower, Over/Under, arrows, the
highlighted button) the way a person does -- reading the screenshot as flat
text first loses exactly that. When Groq can't read it, Google's Gemini
(GEMINI_API_KEY, its free tier) looks at the image instead, and last of all
the screenshot's text (OCR.space) goes to Groq's text model.

Nothing is guessed here. A leg whose line or side can't be read comes back
with `needs` naming what's missing, so the member fills it in; legs that
aren't player props (moneylines, spreads, totals) are left out and counted.
The legs are graded in the browser against the Finder's lines
(src/slip-check.js).
"""
import base64
import io
import json
import os
import re
import time

SPORTS = ("mlb", "nba", "wnba", "nfl", "cfb", "nhl", "soccer")
MAX_LEGS = 8
# Groq retired Llama 4 Scout and Maverick in 2026; Qwen is its vision model now.
VISION_MODELS = ("qwen/qwen3.8-27b", "qwen/qwen3.6-27b", "meta-llama/llama-4-scout-17b-16e-instruct")
TEXT_MODELS = ("llama-3.3-70b-versatile", "openai/gpt-oss-120b", "llama-3.1-8b-instant")
GEMINI_MODELS = ("gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta"
# Groq takes images up to 4 MB as base64; anything bigger is shrunk first.
MAX_IMAGE_BYTES = 2_800_000
MAX_SIDE = 2000

APPS = {
    "prizepicks": "PrizePicks", "underdog": "Underdog", "sleeper": "Sleeper", "pick6": "DraftKings Pick6",
    "betr": "Betr", "parlayplay": "ParlayPlay", "dabble": "Dabble", "chalkboard": "Chalkboard",
    "fanduel": "FanDuel", "draftkings": "DraftKings", "betmgm": "BetMGM", "caesars": "Caesars",
    "espnbet": "ESPN BET", "fanatics": "Fanatics", "hardrock": "Hard Rock Bet", "bet365": "bet365",
    "betrivers": "BetRivers", "pinnacle": "Pinnacle", "bovada": "Bovada",
}

STAT_NAMES = """MLB: Hits, Runs, RBIs, Hits+Runs+RBIs, Total Bases, Home Runs, Singles, Doubles, Walks, Hitter Strikeouts, Stolen Bases, Hitter Fantasy Score, Pitcher Strikeouts, Pitching Outs, Hits Allowed, Earned Runs Allowed, Walks Allowed, Pitches Thrown, Pitcher Fantasy Score, 1st Inning Runs Allowed
NBA and WNBA: Points, Rebounds, Assists, Pts+Rebs+Asts, Pts+Rebs, Pts+Asts, Rebs+Asts, 3-PT Made, 3-PT Attempted, Blks+Stls, Blocked Shots, Steals, Turnovers, FG Made, FG Attempted, Free Throws Made, Fantasy Score, Double-Double
NFL and CFB: Pass Yards, Pass TDs, Pass Attempts, Pass Completions, Pass INTs, Rush Yards, Rush Attempts, Receptions, Receiving Yards, Rush + Rec Yds, Pass + Rush Yds, Rush + Rec TDs, Longest Reception, Longest Rush, Fantasy Score, FG Made, Kicking Points, Total Tackles, Sacks
NHL: Points, Goals, Assists, Shots On Goal, Hits, Blocked Shots, Power Play Points, Goalie Saves, Goals Against, Faceoffs Won, Time On Ice, Fantasy Score
Soccer: Shots, Shots On Target, Goals, Assists, Goal + Assist, Passes Attempted, Tackles, Clearances, Goalie Saves, Fouls, Shots Assisted"""

SHAPE = """{"app": "", "entry_type": "", "stake": null, "payout": null, "payout_is_profit": false, "multiplier": null, "skipped": 0,
 "legs": [{"player": "", "team": "", "opponent": "", "sport": "", "league": "", "stat": "", "stat_name": "", "line": null, "plus": false,
           "side": "", "modifier": "standard", "odds": null, "confidence": 0}]}"""

RULES = f"""Read every player prop leg on the slip, top to bottom. For each leg report what the slip shows:
- player: the player's full name as shown.
- team and opponent: team abbreviations if shown, else "".
- sport: one of mlb, nba, wnba, nfl, cfb (college football), nhl, soccer, or "" if unsure. Use league badges, team names and the stat.
- league: the league the pick is in, as the app names it, in capitals: NBA, WNBA, NFL, MLB, NHL, CFB, CBB, SOCCER, TENNIS,
  CS2, LOL, VAL, DOTA2, COD, MMA, PGA, NASCAR and so on -- whatever the badge, the teams or the stat say. "" if unsure.
- stat: the stat exactly as written on the slip, e.g. "Hits+Runs+RBIs", "Pts+Rebs+Asts", "Shots On Goal".
- stat_name: the same stat using the closest name from the list for that sport below, or "" if none fits.
- line: the number the leg is settled against, e.g. 1.5 or 24.5.
- plus: true only for "N+" style legs ("1+ Hits", "2+ Strikeouts", "Anytime Touchdown" = 1+). Put N in line.
- side: "over" or "under" for THIS leg. More, Higher, Over, O, up arrow, Yes = over. Less, Lower, Under, U, down arrow, No = under.
  On PrizePicks each pick shows More or Less (or an up or down arrow); on Underdog, Higher or Lower; when both buttons
  are visible, the filled or highlighted one is the pick. A bright green More button means over even if Less text is also visible.
  Goblin/demon icons never determine side. Never use an unselected Less button as the side. Legs can differ. If you can't tell, use "".
- modifier: "goblin" or "demon" if that PrizePicks icon is on the leg, else "standard".
- odds: this leg's American odds if shown (e.g. -115), else null.
- confidence: 0 to 1, how sure you are of this leg's player, stat, line and side.
Also report the app or sportsbook name (app), the entry type ("power", "flex", "parlay", "same game parlay" or ""),
the stake, the payout (payout_is_profit true when it is shown as "to win"), and the multiplier if shown (3 for 3x).
Leave out anything that isn't a player prop (moneylines, spreads, game totals, team props) and count those in "skipped".
Never invent a leg or a number you can't see.

Stat names by sport:
{STAT_NAMES}

Answer with JSON only, in this shape:
{SHAPE}"""

VISION_PROMPT = "This is a screenshot of a sports pick'em entry or betting slip (PrizePicks, Underdog, Sleeper, DraftKings Pick6, Betr, ParlayPlay, Dabble, or a sportsbook parlay).\n" + RULES
TEXT_PROMPT = ("Below is the text read from a screenshot of a sports pick'em entry or betting slip. The layout is lost, so "
               "only give a side where the text says it next to that leg; otherwise leave side empty.\n" + RULES + "\n\nTEXT:\n")

# A bet the member placed, for My Bets (read_bet): what went in, what it
# pays or paid, and how it stands. Any kind of bet, not only player props.
BET_SHAPE = """{"app": "", "kind": "", "entry_type": "", "stake": null, "payout": null, "to_win": null, "payout_is_profit": false, "multiplier": null,
 "odds": null, "status": "", "paid": null, "date": "", "sport": "", "amounts": [{"label": "", "amount": null}],
 "legs": [{"player": "", "pick": "", "line": null, "side": "", "result": ""}]}"""

BET_RULES = f"""Report what the screenshot shows about this one bet:
- app: the app or sportsbook name.
- kind: "pickem" for an entry on a pick'em app (PrizePicks, Underdog, Sleeper, Pick6, Betr, ParlayPlay, Dabble),
  "parlay" for a sportsbook bet with two or more legs, "straight" for a sportsbook bet on one thing.
- entry_type: "power", "flex", "parlay", "same game parlay" or "".
- stake: the money put in (entry fee, entry, wager, risk, stake, bet amount), as a number of dollars.
- payout: what the bet pays in total if it wins, stake included ("Payout", "To pay", "Potential payout", "Pays", "Paid").
- to_win: the amount labelled "To win" or "Win", exactly as shown, else null.
- payout_is_profit: true only when a sportsbook shows just the profit.
  On PrizePicks, Underdog and the other pick'em apps every amount paid ("To win", "Payout", "Paid", "$5 -> $15") is the
  whole amount, stake included: put it in payout too and leave payout_is_profit false.
- multiplier: the payout multiplier if shown anywhere ("3x", "5X", "10x Power Play", "Pays 6x"), else null.
- amounts: every dollar amount on the slip with the words right next to it, exactly as written, e.g.
  [{{"label": "2-Pick", "amount": 10}}, {{"label": "Power Play", "amount": 5}}] or [{{"label": "Wager", "amount": 20}}, {{"label": "To Win", "amount": 18.18}}].
  PrizePicks writes an entry as "2-Pick $10" over "$5 Power Play": the "N-Pick" amount is what it pays, the
  "Power Play" or "Flex Play" amount is what was put in.
- odds: the whole bet's American odds if shown (+450, -110), else null.
- status: "won", "lost", "pending" (open, live, in progress, not settled yet), "push" (refunded, void, cancelled,
  tie, reverted) or "cashed_out". Use the slip's own words, badges and colours (a green WIN or check, a red LOSS or X).
- paid: the money actually paid back once settled (won, cashed out, refunded, or a flex entry that paid part),
  else null. A lost bet pays 0.
- date: the date the bet was placed or its games were played, as YYYY-MM-DD, if shown, else "".
- sport: nba, nfl, mlb, nhl, wnba, cfb, cbb, soccer, tennis, golf, mma, esports or other.
- legs: each pick top to bottom: player (or team), pick as written ("Over 24.5 Points", "Knicks -3.5", "More 6.5 Rebounds"),
  line (the number, or null), side ("over", "under" or ""), result ("hit", "miss", "push" or "" if the slip doesn't mark it).
Never invent a number you can't see; use null for anything that isn't there.

Answer with JSON only, in this shape:
{BET_SHAPE}"""

BET_PROMPT = "This is a screenshot of a bet someone placed: a pick'em entry, a sportsbook parlay or a single bet. It may be open or settled.\n" + BET_RULES
BET_TEXT_PROMPT = ("Below is the text read from a screenshot of a bet someone placed. The layout is lost.\n" + BET_RULES + "\n\nTEXT:\n")

_client = None


def _groq():
    global _client
    if _client is None:
        key = os.getenv("GROQ_API_KEY", "")
        if not key:
            return None
        from groq import Groq
        _client = Groq(api_key=key, timeout=25, max_retries=1)
    return _client


def mime_of(data):
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:2] == b"\xff\xd8":
        return "image/jpeg"
    if len(data) > 12 and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def fit_image(data):
    """(bytes, mime) small enough to send: a large screenshot is scaled to
    at most 2000px on its long side and saved as a JPEG under the limit."""
    mime = mime_of(data) or "image/png"
    if len(data) <= MAX_IMAGE_BYTES:
        return data, mime
    try:
        from PIL import Image
        image = Image.open(io.BytesIO(data)).convert("RGB")
        image.thumbnail((MAX_SIDE, MAX_SIDE))
        # Smaller and a little softer until it fits; text stays readable well
        # below this size.
        for quality in (86, 76, 66, 58, 50):
            out = io.BytesIO()
            image.save(out, format="JPEG", quality=quality)
            if out.tell() <= MAX_IMAGE_BYTES:
                break
            image = image.resize((max(1, int(image.width * 0.85)), max(1, int(image.height * 0.85))))
        return out.getvalue(), "image/jpeg"
    except Exception:
        return data, mime


def parse_json(text):
    """The JSON object in a model's answer, tolerating code fences and prose."""
    text = re.sub(r"<think>.*?(?:</think>|$)", "", str(text or ""), flags=re.S).strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except (TypeError, ValueError):
        pass
    start, end = text.find("{"), text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except ValueError:
            return None
    return None


# Model names Groq may use for ones that read images, so a renamed or newer
# vision model is still found.
_VISION_NAMES = re.compile(r"qwen3\.[5-9]|qwen[^/]*-vl|llama-4|scout|maverick|vision|[-_]vl\b|pixtral|gemma-3", re.I)
_SKIP_NAMES = re.compile(r"guard|whisper|tts|playai|distil|prompt", re.I)
_available = {"at": 0.0, "ids": None}


def _model_ids(client):
    """The models this Groq key can use right now (asked at most every 10 minutes)."""
    if _available["ids"] is not None and time.time() - _available["at"] < 600:
        return _available["ids"]
    try:
        ids = [model.id for model in client.models.list().data]
    except Exception:  # noqa: BLE001 -- the named models are tried anyway
        ids = []
    _available.update(at=time.time(), ids=ids)
    return ids


def models_for(client, named, vision):
    """The named models this key has, then any other it has that fits."""
    env = os.getenv("GROQ_VISION_MODELS" if vision else "GROQ_TEXT_MODELS", "")
    named = [name.strip() for name in env.split(",") if name.strip()] or list(named)
    ids = _model_ids(client)
    if not ids:
        return named
    fits = [model for model in ids if not _SKIP_NAMES.search(model)
            and (bool(_VISION_NAMES.search(model)) if vision else bool(re.search(r"llama|gpt-oss|qwen|kimi|gemma", model, re.I)))]
    found = [model for model in named if model in ids] + [model for model in fits if model not in named]
    # Only models this key has: a retired name is never asked for.
    return found[:4]


def _scrub(text):
    """An error message safe to show: no keys, one line, short. A provider's
    JSON error comes down to its status and message."""
    text = re.sub(r"(gsk_|AIza|sk-ant-|sk-)[A-Za-z0-9_\-]{8,}", "[key]", str(text or ""))
    message = re.search(r"""['"]message['"]:\s*['"](.+?)['"](?:,|\})""", text)
    if message:
        code = re.search(r"Error code: (\d+)", text)
        text = f"{code.group(1) + ' ' if code else ''}{message.group(1)}"
    return re.sub(r"\s+", " ", text).strip()[:160]


def _ask(models, content, problems=None):
    client = _groq()
    if client is None:
        return None
    for model in models_for(client, models, isinstance(content, list)):
        last = "no readable answer"
        # Qwen thinks out loud unless told not to; JSON mode first, then plain.
        tries = ([{"json": True, "reasoning_format": "hidden"}] if "qwen" in model.lower() else []) + [{"json": True}, {"json": False}]
        for extra in tries:
            try:
                kwargs = {"model": model, "messages": [{"role": "user", "content": content}],
                          "temperature": 0, "max_completion_tokens": 1800}
                if extra.get("json"):
                    kwargs["response_format"] = {"type": "json_object"}
                if extra.get("reasoning_format"):
                    kwargs["reasoning_format"] = extra["reasoning_format"]
                answer = parse_json(client.chat.completions.create(**kwargs).choices[0].message.content)
                if isinstance(answer, (dict, list)):
                    return answer
            except Exception as exc:  # noqa: BLE001 -- the next model or mode may work
                last = f"{type(exc).__name__}: {_scrub(exc)}"
                print(f"[slip-reader] {model} {extra}: {last}")
                if re.search(r"\b(404|401|403)\b|does not exist|not found|decommissioned", last, re.I):
                    break  # gone or not allowed: no other mode will help
        if problems is not None:
            problems.append(f"Groq {model}: {last}")
    return None


_gemini_available = {"at": 0.0, "names": None}


def _version(name):
    match = re.search(r"(\d+(?:\.\d+)?)", name)
    return float(match.group(1)) if match else 0.0


def gemini_models(key):
    """Gemini models this key can use that read images, newest Flash first."""
    env = os.getenv("GEMINI_MODELS", "")
    named = [name.strip() for name in env.split(",") if name.strip()] or list(GEMINI_MODELS)
    if _gemini_available["names"] is None or time.time() - _gemini_available["at"] > 600:
        names = []
        try:
            import requests
            response = requests.get(f"{GEMINI_URL}/models", headers={"x-goog-api-key": key}, params={"pageSize": 200}, timeout=10)
            if response.ok:
                names = [item.get("name", "").split("/", 1)[-1] for item in response.json().get("models", [])
                         if "generateContent" in (item.get("supportedGenerationMethods") or [])]
        except Exception:  # noqa: BLE001 -- the named models are tried anyway
            names = []
        _gemini_available.update(at=time.time(), names=names)
    names = _gemini_available["names"]
    if not names:
        return named
    if env:
        return [name for name in named if name in names] or named
    # Newest stable Flash first, previews after, so a newer Gemini is used
    # without a code change and a retired one is skipped.
    fits = sorted((name for name in names if "flash" in name and not re.search(r"image|tts|audio|live|embed|thinking|exp", name)),
                  key=lambda name: ("preview" in name, -_version(name), "lite" in name, len(name)))
    return fits or named


def _read_gemini(data, problems, prompt=VISION_PROMPT):
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        return None
    import requests
    data, mime = fit_image(data)
    body = {"contents": [{"role": "user", "parts": [{"text": prompt},
                                                   {"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode()}}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json", "maxOutputTokens": 8192}}
    for model in gemini_models(key)[:4]:
        try:
            response = requests.post(f"{GEMINI_URL}/models/{model}:generateContent", json=body, timeout=40,
                                     headers={"x-goog-api-key": key, "Content-Type": "application/json"})
            if not response.ok:
                message = ""
                try:
                    message = response.json().get("error", {}).get("message", "")
                except ValueError:
                    message = response.text
                problems.append(f"Gemini {model}: HTTP {response.status_code} {_scrub(message)}")
                continue
            parts = ((response.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
            answer = parse_json("".join(part.get("text", "") for part in parts))
            if isinstance(answer, (dict, list)):
                return answer
            problems.append(f"Gemini {model}: no readable answer")
        except Exception as exc:  # noqa: BLE001 -- the next model may work
            problems.append(f"Gemini {model}: {type(exc).__name__}: {_scrub(exc)}")
    return None


def _read_vision(data, problems=None, prompt=VISION_PROMPT):
    data, mime = fit_image(data)
    url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
    return _ask(VISION_MODELS, [{"type": "text", "text": prompt}, {"type": "image_url", "image_url": {"url": url}}], problems)


def _read_text(data, problems=None, prompt=TEXT_PROMPT):
    import asyncio
    try:
        from analyze import _ocr_image
    except Exception:
        return None
    text = asyncio.run(_ocr_image(data, mime_of(data) or "image/png"))
    if not isinstance(text, str) or not text.strip():
        if problems is not None:
            problems.append(f"OCR: {_scrub(text.get('error') if isinstance(text, dict) else 'no text')}")
        return None
    raw = _ask(TEXT_MODELS, prompt + text[:6000], problems)
    if prompt is not TEXT_PROMPT:
        return raw
    # OCR cannot preserve which of two visible buttons is highlighted.
    # Keep the picks, but require side confirmation rather than grading a guess.
    if re.search(r"\b(more|higher|over)\b", text, re.I) and re.search(r"\b(less|lower|under)\b", text, re.I):
        items = raw if isinstance(raw, list) else (raw.get("legs") or raw.get("props") or []) if isinstance(raw, dict) else []
        for leg in items:
            if isinstance(leg, dict): leg["side"] = ""
    return raw


# ---------------------------------------------------------------- normalizing

_OVER = {"over", "more", "higher", "high", "up", "above", "o", "yes", "↑", "▲", "⬆"}
_UNDER = {"under", "less", "lower", "low", "down", "below", "u", "no", "↓", "▼", "⬇"}
_SPORT_WORDS = {
    "mlb": "mlb", "baseball": "mlb", "nba": "nba", "wnba": "wnba", "nfl": "nfl", "nhl": "nhl", "hockey": "nhl",
    "cfb": "cfb", "ncaaf": "cfb", "collegefootball": "cfb", "ncaafootball": "cfb",
    "soccer": "soccer", "epl": "soccer", "premierleague": "soccer", "mls": "soccer", "laliga": "soccer",
    "seriea": "soccer", "bundesliga": "soccer", "ligue1": "soccer", "ucl": "soccer", "championsleague": "soccer",
    "uefachampionsleague": "soccer", "europaleague": "soccer", "fifa": "soccer", "worldcup": "soccer",
}


def _squash(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower())


def number(value):
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) if value == value else None
    match = re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value).replace("−", "-"))
    return float(match.group(0).replace(",", ".")) if match else None


def side_of(value):
    word = str(value or "").strip().lower()
    if word in _OVER or _squash(word) in _OVER:
        return "OVER"
    if word in _UNDER or _squash(word) in _UNDER:
        return "UNDER"
    return None


def sport_of(value):
    return _SPORT_WORDS.get(_squash(value))


def app_of(value):
    key = _squash(value)
    if not key:
        return None
    if "pick6" in key:
        return {"key": "pick6", "name": APPS["pick6"]}
    for app, name in APPS.items():
        if app in key:
            return {"key": app, "name": name}
    return {"key": "other", "name": str(value).strip()[:40]}


def _text(value, limit):
    return re.sub(r"\s+", " ", str(value or "")).strip()[:limit]


_SIDES = r"more|less|higher|lower|over|under"
_SAID_BEFORE = re.compile(rf"^\s*(?P<side>{_SIDES})\s+(?P<line>[-+]?\d+(?:\.\d+)?)?\s*(?P<stat>[A-Za-z].*)$", re.I)
_SAID_AFTER = re.compile(rf"^(?P<stat>.*?[A-Za-z].*?)\s+(?P<side>{_SIDES})(?:\s+(?P<line>[-+]?\d+(?:\.\d+)?))?\s*$", re.I)


def normalize_leg(raw):
    """A leg as the browser grades it, or None for one that isn't a player prop."""
    if not isinstance(raw, dict):
        return None
    player = _text(raw.get("player") or raw.get("player_name") or raw.get("name"), 60)
    stat = _text(raw.get("stat") or raw.get("market") or raw.get("market_raw") or raw.get("stat_name"), 60)
    # A cut-off pick (a player with no stat showing) is kept for the member
    # to fill in; a stat with no player is nothing to grade.
    if not player or len(player) < 3 or not re.search(r"[A-Za-z]", player):
        return None
    if not stat and (len(player.split()) < 2 or (number(raw.get("line")) or 0) < 0):
        return None  # a team or a spread, not a cut-off player pick
    line = number(raw.get("line"))
    side = side_of(raw.get("side"))
    # The pick's side and line read into the stat ("Higher 3.5 Receptions",
    # "Receptions More"): moved to their own fields, so the stat is its name.
    said = _SAID_BEFORE.match(stat) or _SAID_AFTER.match(stat)
    if said and said.group("stat").strip():
        side = side or side_of(said.group("side"))
        line = line if line is not None else number(said.group("line"))
        stat = said.group("stat").strip()
    plus = bool(raw.get("plus")) or bool(re.search(r"\d\s*\+\s*$|^\s*\d+\s*\+", stat))
    if line is None and plus:
        match = re.search(r"(\d+)\s*\+", stat)
        line = float(match.group(1)) if match else 1.0
    if plus:
        # "N+" is the Over on N - 0.5.
        side = side or "OVER"
        if line is not None and line == int(line):
            line = line - 0.5
    modifier = _squash(raw.get("modifier"))
    odds = number(raw.get("odds"))
    confidence = number(raw.get("confidence"))
    leg = {
        "player": player, "team": _text(raw.get("team"), 8).upper(), "opponent": _text(raw.get("opponent"), 8).upper(),
        "sport": sport_of(raw.get("sport")), "league": re.sub(r"[^A-Z0-9]", "", _text(raw.get("league"), 16).upper()),
        "stat": stat, "statName": _text(raw.get("stat_name"), 60),
        "line": line, "plus": plus, "side": side,
        "modifier": modifier if modifier in ("goblin", "demon") else "standard",
        "odds": int(odds) if odds is not None and abs(odds) >= 100 else None,
        "confidence": max(0.0, min(1.0, confidence)) if confidence is not None else None,
    }
    leg["needs"] = [field for field in ("stat", "line", "side") if not leg[field] and leg[field] != 0]
    return leg


def normalize(raw):
    """The slip the browser receives: app, entry and legs."""
    if isinstance(raw, list):
        raw = {"legs": raw}
    if not isinstance(raw, dict):
        return {"legs": []}
    legs, seen = [], set()
    for item in raw.get("legs") or raw.get("props") or []:
        leg = normalize_leg(item)
        if not leg:
            continue
        key = (_squash(leg["player"]), _squash(leg["stat"]), leg["line"], leg["side"])
        if not leg["stat"] and leg["line"] is None and not leg["side"] and any(_squash(other["player"]) == key[0] for other in legs):
            continue
        if key in seen:
            continue
        seen.add(key)
        legs.append(leg)
    stake, payout, multiplier = number(raw.get("stake")), number(raw.get("payout")), number(raw.get("multiplier"))
    if payout is not None and raw.get("payout_is_profit") and stake:
        payout += stake
    if multiplier is None and stake and payout:
        multiplier = round(payout / stake, 2)
    entry_type = _squash(raw.get("entry_type"))
    entry = {"type": {"powerplay": "power", "power": "power", "flexplay": "flex", "flex": "flex", "standard": "power",
                      "parlay": "parlay", "samegameparlay": "parlay", "sgp": "parlay"}.get(entry_type),
             "stake": stake, "payout": payout, "multiplier": multiplier if multiplier and 1 < multiplier < 10000 else None}
    skipped = number(raw.get("skipped"))
    return {"app": app_of(raw.get("app")), "entry": entry, "legs": legs[:MAX_LEGS],
            "skipped": int(skipped) if skipped and skipped > 0 else 0}


def read_slip(data):
    """The slip in this screenshot, or {"error": ...}."""
    if not mime_of(data):
        return {"error": "Use a PNG, JPG or WEBP screenshot."}
    gemini = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    if _groq() is None and not gemini:
        print("[slip-reader] neither GROQ_API_KEY nor GEMINI_API_KEY is set for this deployment")
        return {"error": "Slip reading isn't set up on this server yet.", "reason": "no-key"}
    problems = [] if _groq() is not None else ["Groq: GROQ_API_KEY is not set"]
    if not gemini:
        problems.append("Gemini: GEMINI_API_KEY is not set on this deployment")
    source, raw = "vision", _read_vision(data, problems) if _groq() is not None else None
    if raw is None and gemini:
        source, raw = "vision", _read_gemini(data, problems)
    if raw is None and _groq() is not None:
        source, raw = "text", _read_text(data, problems)
    if raw is None:
        detail = "; ".join(problems)[:900]
        print(f"[slip-reader] every reader failed: {detail}")
        return {"error": "Reading slips is unavailable right now. Try again in a minute.", "reason": "models", "detail": detail}
    slip = normalize(raw)
    if not slip["legs"]:
        return {"error": "No player props were found in that screenshot. Use one that shows each pick's player, stat and line."}
    slip["source"] = source
    if problems:
        # Why the vision readers were passed over, for admins only (api/prediction.py).
        detail = "; ".join(problems)[:900]
        print(f"[slip-reader] read from {source} after: {detail}")
        slip["detail"] = detail
    return slip


# ---------------------------------------------------------------- a bet, for My Bets

PICKEM_APPS = ("prizepicks", "underdog", "sleeper", "pick6", "betr", "parlayplay", "dabble", "chalkboard")
_STATUS = {"won": "win", "win": "win", "winner": "win", "lost": "loss", "loss": "loss", "lose": "loss", "pending": "pending",
           "open": "pending", "live": "pending", "inprogress": "pending", "push": "push", "void": "push", "refunded": "push",
           "cancelled": "push", "canceled": "push", "tie": "push", "reverted": "push", "cashedout": "cashout", "cashout": "cashout"}
# The apps' usual payouts by number of picks, for an entry whose picture
# doesn't show what it pays (goblins, demons and promos change them).
USUAL_PAYOUTS = {
    "prizepicks": {"power": {2: 3, 3: 5, 4: 10, 5: 20, 6: 37.5}, "flex": {3: 3, 4: 6, 5: 10, 6: 25}},
    "underdog": {"power": {2: 3, 3: 6, 4: 10, 5: 20, 6: 35}, "flex": {3: 3, 4: 6, 5: 10, 6: 25}},
}
BET_SPORTS = ("nba", "nfl", "mlb", "nhl", "wnba", "cfb", "cbb", "soccer", "tennis", "golf", "mma", "esports", "other")


def american(decimal):
    """A decimal price as American odds (3.5 -> 250, 1.91 -> -110)."""
    if not decimal or decimal <= 1:
        return None
    return round((decimal - 1) * 100) if decimal >= 2 else round(-100 / (decimal - 1))


# The words next to a dollar amount that say what it is (squashed: no
# spaces, lower case). A pick'em app's "To win" is its whole payout.
_STAKE_WORDS = re.compile(r"powerplay|flexplay|entry|wager|risk|stake|betamount|^bet$|^amount$")
_PAYOUT_WORDS = re.compile(r"\dpick|payout|topay|pays|paid|return|^win$|totalwin")
_TO_WIN_WORDS = re.compile(r"towin|profit")


def _labelled(raw, pickem):
    """(stake, payout, to_win) from the amounts read with their labels."""
    stake = payout = to_win = None
    for item in raw.get("amounts") or []:
        if not isinstance(item, dict):
            continue
        label, amount = _squash(item.get("label")), number(item.get("amount"))
        if not label or amount is None or amount <= 0:
            continue
        if _STAKE_WORDS.search(label) and stake is None:
            stake = amount
        elif _PAYOUT_WORDS.search(label) and payout is None:
            payout = amount
        elif _TO_WIN_WORDS.search(label) and to_win is None:
            if pickem:
                payout = payout or amount
            else:
                to_win = amount
    return stake, payout, to_win


def normalize_bet(raw):
    """A bet as My Bets fills its form in: dollars as read, the payout
    worked out from whatever the slip shows, and its result."""
    if not isinstance(raw, dict):
        return None
    stake, payout, paid = number(raw.get("stake")), number(raw.get("payout")), number(raw.get("paid"))
    to_win = number(raw.get("to_win"))
    # The amounts with their own words beside them say best which is which.
    pickem_app = bool((app_of(raw.get("app")) or {}).get("key") in PICKEM_APPS)
    said_stake, said_payout, said_to_win = _labelled(raw, pickem_app)
    if said_stake is not None:
        stake = said_stake
    if said_payout is not None:
        payout, to_win = said_payout, None
    elif said_to_win is not None:
        to_win, payout = said_to_win, None
    if stake is not None and stake <= 0:
        stake = None
    app = app_of(raw.get("app"))
    kind = _squash(raw.get("kind"))
    # A pick'em app's entry is always a pick'em entry, and every amount it
    # shows as paid is the whole payout ("To win $15" on a $5 entry).
    pickem = bool(app and app["key"] in PICKEM_APPS)
    if pickem:
        kind = "pickem"
        payout = payout or to_win
    else:
        if payout is not None and raw.get("payout_is_profit") and stake:
            payout += stake
        if payout is None and to_win and stake:
            payout = to_win + stake
    if payout is not None and stake and payout <= stake:
        payout = None
    multiplier, odds = number(raw.get("multiplier")), number(raw.get("odds"))
    if odds is not None and -100 < odds < 100:
        odds = None
    legs = []
    for item in (raw.get("legs") or [])[:12]:
        if not isinstance(item, dict):
            continue
        player = _text(item.get("player"), 60)
        pick = _text(item.get("pick") or item.get("stat"), 60)
        if not player and not pick:
            continue
        result = _squash(item.get("result"))
        legs.append({"player": player or pick, "stat": pick if player else "", "line": number(item.get("line")),
                     "side": side_of(item.get("side")) or "", "result": result if result in ("hit", "miss", "push") else None})
    if kind not in ("pickem", "parlay", "straight"):
        kind = "parlay" if len(legs) > 1 else "straight"
    if kind == "pickem":
        odds = None
    # What a win returns per dollar in: the payout over the stake, else the
    # multiplier or the odds the slip shows.
    if stake and payout and payout > stake:
        multiplier = round(payout / stake, 3)
    elif not multiplier and odds:
        multiplier = round(1 + (odds / 100 if odds > 0 else 100 / -odds), 3)
    if multiplier is not None and not 1 < multiplier < 100000:
        multiplier = None
    if kind != "pickem" and multiplier and odds is None:
        odds = american(multiplier)
    # Nothing on the picture says what a pick'em entry pays: the app's usual
    # payout for that many picks, marked as a guess for the member to check.
    estimated = False
    entry_type = _squash(raw.get("entry_type"))
    if kind == "pickem" and not multiplier and payout is None:
        table = USUAL_PAYOUTS.get((app or {}).get("key"), {}).get("flex" if "flex" in entry_type else "power", {})
        if table.get(len(legs)):
            multiplier, estimated = table[len(legs)], True
    if payout is None and stake and multiplier:
        payout = round(stake * multiplier, 2)
    result = _STATUS.get(_squash(raw.get("status")), "pending")
    if result == "loss":
        paid = 0.0
    # A flex entry that paid part, or a bet cashed out: what came back.
    if result == "win" and paid is not None and payout and paid < payout * 0.98:
        result = "cashout"
    if result == "win" and paid is None:
        paid = payout
    if result == "push" and paid is None:
        paid = stake
    day = str(raw.get("date") or "")
    sport = _squash(raw.get("sport"))
    if sport not in BET_SPORTS:
        sports = {sport_of(item.get("sport")) for item in raw.get("legs") or [] if isinstance(item, dict)} - {None, ""}
        sport = sports.pop() if len(sports) == 1 else "other"
    return {"app": app, "kind": kind, "entryType": entry_type or None, "stake": stake, "payout": payout, "estimated": estimated,
            "multiplier": multiplier, "odds": int(odds) if odds is not None else None, "result": result, "paid": paid,
            "date": day if re.fullmatch(r"\d{4}-\d{2}-\d{2}", day) else None, "sport": sport, "legs": legs}


def read_bet(data):
    """The bet in this screenshot (normalize_bet), or {"error": ...}."""
    if not mime_of(data):
        return {"error": "Use a PNG, JPG or WEBP screenshot."}
    gemini = bool(os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
    if _groq() is None and not gemini:
        return {"error": "Reading pictures isn't set up on this server yet.", "reason": "no-key"}
    problems = []
    raw = _read_vision(data, problems, BET_PROMPT) if _groq() is not None else None
    if raw is None and gemini:
        raw = _read_gemini(data, problems, BET_PROMPT)
    if raw is None and _groq() is not None:
        raw = _read_text(data, problems, BET_TEXT_PROMPT)
    if raw is None:
        print(f"[slip-reader] bet: every reader failed: {'; '.join(problems)[:900]}")
        return {"error": "Reading pictures is unavailable right now. Try again in a minute.", "reason": "models"}
    bet = normalize_bet(raw[0] if isinstance(raw, list) and raw else raw)
    if not bet or (bet["stake"] is None and bet["payout"] is None):
        return {"error": "No amount was found in that picture. Use one that shows what you put in and what it pays."}
    return bet
