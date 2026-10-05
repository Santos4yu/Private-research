"""Reads a slip screenshot into its legs, for the Slip Analyzer
(api/prediction.py action=slip-analyzer).

Groq's vision model looks at the image itself, so it sees which side of
each pick is chosen (More/Less, Higher/Lower, Over/Under, arrows, the
highlighted button) the way a person does -- reading the screenshot as flat
text first loses exactly that. When the vision model can't be reached, the
screenshot's text (OCR.space) goes to Groq's text model instead.

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

SPORTS = ("mlb", "nba", "wnba", "nfl", "nhl", "soccer")
MAX_LEGS = 8
VISION_MODELS = ("meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct")
TEXT_MODELS = ("llama-3.3-70b-versatile", "llama-3.1-8b-instant")
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
NFL: Pass Yards, Pass TDs, Pass Attempts, Pass Completions, Pass INTs, Rush Yards, Rush Attempts, Receptions, Receiving Yards, Rush + Rec Yds, Pass + Rush Yds, Rush + Rec TDs, Longest Reception, Longest Rush, Fantasy Score, FG Made, Kicking Points, Total Tackles, Sacks
NHL: Points, Goals, Assists, Shots On Goal, Hits, Blocked Shots, Power Play Points, Goalie Saves, Goals Against, Faceoffs Won, Time On Ice, Fantasy Score
Soccer: Shots, Shots On Target, Goals, Assists, Goal + Assist, Passes Attempted, Tackles, Clearances, Goalie Saves, Fouls, Shots Assisted"""

SHAPE = """{"app": "", "entry_type": "", "stake": null, "payout": null, "payout_is_profit": false, "multiplier": null, "skipped": 0,
 "legs": [{"player": "", "team": "", "opponent": "", "sport": "", "stat": "", "stat_name": "", "line": null, "plus": false,
           "side": "", "modifier": "standard", "odds": null, "confidence": 0}]}"""

RULES = f"""Read every player prop leg on the slip, top to bottom. For each leg report what the slip shows:
- player: the player's full name as shown.
- team and opponent: team abbreviations if shown, else "".
- sport: one of mlb, nba, wnba, nfl, nhl, soccer, or "" if unsure. Use league badges, team names and the stat.
- stat: the stat exactly as written on the slip, e.g. "Hits+Runs+RBIs", "Pts+Rebs+Asts", "Shots On Goal".
- stat_name: the same stat using the closest name from the list for that sport below, or "" if none fits.
- line: the number the leg is settled against, e.g. 1.5 or 24.5.
- plus: true only for "N+" style legs ("1+ Hits", "2+ Strikeouts", "Anytime Touchdown" = 1+). Put N in line.
- side: "over" or "under" for THIS leg. More, Higher, Over, O, up arrow, Yes = over. Less, Lower, Under, U, down arrow, No = under.
  On PrizePicks each pick shows More or Less (or an up or down arrow); on Underdog, Higher or Lower; when both buttons
  are visible, the filled or highlighted one is the pick. Legs can differ. If you can't tell, use "".
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
    text = str(text or "").strip()
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


def _ask(models, content):
    client = _groq()
    if client is None:
        return None
    env = os.getenv("GROQ_VISION_MODELS" if isinstance(content, list) else "GROQ_TEXT_MODELS", "")
    for model in [name.strip() for name in env.split(",") if name.strip()] or models:
        for json_mode in (True, False):
            try:
                kwargs = {"model": model, "messages": [{"role": "user", "content": content}],
                          "temperature": 0, "max_completion_tokens": 1800}
                if json_mode:
                    kwargs["response_format"] = {"type": "json_object"}
                answer = parse_json(client.chat.completions.create(**kwargs).choices[0].message.content)
                if isinstance(answer, (dict, list)):
                    return answer
            except Exception as exc:  # noqa: BLE001 -- the next model or mode may work
                print(f"[slip-reader] {model} json={json_mode}: {type(exc).__name__}: {str(exc)[:160]}")
    return None


def _read_vision(data):
    data, mime = fit_image(data)
    url = f"data:{mime};base64,{base64.b64encode(data).decode()}"
    return _ask(VISION_MODELS, [{"type": "text", "text": VISION_PROMPT}, {"type": "image_url", "image_url": {"url": url}}])


def _read_text(data):
    import asyncio
    try:
        from analyze import _ocr_image
    except Exception:
        return None
    text = asyncio.run(_ocr_image(data, mime_of(data) or "image/png"))
    if not isinstance(text, str) or not text.strip():
        return None
    return _ask(TEXT_MODELS, TEXT_PROMPT + text[:6000])


# ---------------------------------------------------------------- normalizing

_OVER = {"over", "more", "higher", "high", "up", "above", "o", "yes", "↑", "▲", "⬆"}
_UNDER = {"under", "less", "lower", "low", "down", "below", "u", "no", "↓", "▼", "⬇"}
_SPORT_WORDS = {
    "mlb": "mlb", "baseball": "mlb", "nba": "nba", "wnba": "wnba", "nfl": "nfl", "nhl": "nhl", "hockey": "nhl",
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


def normalize_leg(raw):
    """A leg as the browser grades it, or None for one that isn't a player prop."""
    if not isinstance(raw, dict):
        return None
    player = _text(raw.get("player") or raw.get("player_name") or raw.get("name"), 60)
    stat = _text(raw.get("stat") or raw.get("market") or raw.get("market_raw"), 60)
    if not player or not stat:
        return None
    plus = bool(raw.get("plus")) or bool(re.search(r"\d\s*\+\s*$|^\s*\d+\s*\+", stat))
    line = number(raw.get("line"))
    if line is None and plus:
        match = re.search(r"(\d+)\s*\+", stat)
        line = float(match.group(1)) if match else 1.0
    side = side_of(raw.get("side"))
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
        "sport": sport_of(raw.get("sport")), "stat": stat, "statName": _text(raw.get("stat_name"), 60),
        "line": line, "plus": plus, "side": side,
        "modifier": modifier if modifier in ("goblin", "demon") else "standard",
        "odds": int(odds) if odds is not None and abs(odds) >= 100 else None,
        "confidence": max(0.0, min(1.0, confidence)) if confidence is not None else None,
    }
    leg["needs"] = [field for field in ("line", "side") if leg[field] is None]
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
    if _groq() is None:
        return {"error": "Reading slips is unavailable right now. Try again in a minute."}
    source, raw = "vision", _read_vision(data)
    if raw is None:
        source, raw = "text", _read_text(data)
    if raw is None:
        return {"error": "Reading slips is unavailable right now. Try again in a minute."}
    slip = normalize(raw)
    if not slip["legs"]:
        return {"error": "No player props were found in that screenshot. Use one that shows each pick's player, stat and line."}
    slip["source"] = source
    return slip
