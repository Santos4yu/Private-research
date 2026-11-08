"""The Game Predictor: who wins an NBA or NFL game, by how much, the final
score, and where our number and the betting market disagree.

The owner, Nov 5, with another app's simple "pick a game, predict" screens:
"a crazy moneyline predictor for nfl and nba ... finds the edge with free
sources like players injuries who's playing who's out spreads ... blowout
potentials pace defense matchups for each players who has the best edge on
the team for a good game ... include a number prediction on what the bot
thinks the game will end in like 112-96".

Free sources only:
* ESPN's scoreboard and game summary: the schedule, the sportsbook line it
  carries (moneylines, spread, total), its own win projection, both injury
  reports and each team's last five.
* NBA: the stored seasons of ESPN box scores (backend/sports/wnba/league.py).
* NFL: nflverse's schedule (every final score) and its weekly player and
  team stats (backend/sports/nfl/finder.py).

How the number is made, backtested on real games (Nov 5):
* NBA, 2025-26 (979 games with their lines): each team's points scored and
  allowed per 100 possessions and its pace, this season with last season's
  worth NBA prior_games games, met the usual way (home offense against away
  defense, relative to the league), plus home court, back-to-backs, the last
  ten games' form and who is out (each missing regular's average Game Score
  over the last 20 games, times how often he had been playing in them, so a
  player out for weeks is already in the team's numbers). Alone it picked
  74% of the second half's winners (the line 73%) but missed the margin by a
  little more (11.3 points, the line 11.0); a quarter ours and three
  quarters the line did best.
* NFL, 2013-25 (3,562 games): points scored and allowed a game with last
  season's worth four games, home field, rest and a starting quarterback out
  (3.2 points). The line alone was better (66% of winners, ours 63%), so
  ours is a tenth of the final number: it matters when news (a QB ruled out)
  is newer than the line.
* The total is the line's when there is one (ours was no closer), else ours.
* Win chance: the final margin over a normal spread of finals (NBA 12.5
  points, NFL 12), calibrated on the same games; the blowout chance the same
  way (NBA by 15 or more, NFL by 14 or more).

v2 (Nov 5, tools/game-predictor-backtest/README.md; predictor_nba.py,
predictor_nfl.py, predictor_ratings.py): opponent-adjusted ratings fitted
walk-forward (NBA offense, defense and pace; NFL EPA a play, success rate,
points and plays, with each quarterback's value). Each game gets two
predictions: ours alone, and ours blended with the line (V2 "ours" share),
plus data warnings, a confidence level and each moneyline's expected value.
The older numbers above stay as the fallback when v2 can't run (the NFL's
play-by-play tables not built yet, or a failed read).

A member's history is only the picks they save (save_pick, PICKS_KEY; Nov 6,
the owner: "only if I add the prediction"), settled from ESPN's final
scores: right or wrong, and what each won or lost at the moneyline it was
saved at. Each game's chart is the market's chance over time, from every
fresh read of the lines (ODDS_KEY, sample_odds: the slate, the twice-daily
cron, the chart itself), and in a game ESPN's win probability after every
play (chart).
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import time
import unicodedata
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

SPORTS = ("nba", "nfl")
ESPN = "https://site.api.espn.com/apis/site/v2/sports/"
PATHS = {"nba": "basketball/nba", "nfl": "football/nfl"}
MODELS = {
    "nba": {"scale": 0.75, "home": 1.6, "injury": 0.19, "b2b": 1.2, "form": 0.2, "ours": 0.25, "sigma": 12.5,
            "blowout": 15, "blowout_sigma": 15.0, "prior_games": 12, "prior_keep": 0.67, "pace_keep": 0.8,
            "window": 20, "regular_minutes": 12, "unit": "pts"},
    "nfl": {"scale": 1.53, "home": 2.1, "qb": 3.2, "rest": 0.1, "ours": 0.1, "sigma": 12.0,
            "blowout": 14, "blowout_sigma": 13.5, "prior_games": 4, "prior_keep": 0.5, "unit": "pts"},
}
# v2's settings and weights, from the backtest (tools/game-predictor-backtest):
# chosen on validation seasons, then scored once on the test seasons.
V2 = {
    "nba": {"lam": 12, "half_life": 50, "keep": 0.75, "pace_keep": 0.75, "window": 30, "shrink_minutes": 200,
            "regular_minutes": 12, "rate_minutes": 200,
            "rating": 1.1315, "injury": 0.2088, "home": 2.051,
            "total_rating": 1.0319, "total_injury": -0.0522, "total_const": -7.037,
            # Our margin's spread of finals by the fewer games either team has
            # played (early margins are pulled toward last season, so smaller).
            "sigma_by_games": ((10, 9.99), (25, 11.25), (50, 15.05), (None, 12.12)),
            "ours": 0.25, "market_sigma": 12.5, "disagree": 7.0},
    "nfl": {"lam": 8, "half_life": 250, "keep": 0.6, "qb_prior": 300, "qb_replacement": -0.12,
            "margin": {"epa": 15.4959, "succ": 34.3113, "pts": 0.3545, "home": 1.0209, "rest": 0.0368, "qb": 12.0275,
                       "qbnew": -2.0214, "const": 0.878},
            # The fitted total weights weren't kept (the line's total was
            # closer): without a line, the points ratings give the total.
            "total": None, "sigma": 9.56, "ours": 0.10, "market_sigma": 11.03, "disagree": 6.0},
}
# Listed this way, a player is out (ESPN's NBA "Day-To-Day" and the NFL's
# "Questionable" leave him in, the way the rest of the site counts).
OUT_STATUSES = ("out", "doubtful", "suspension", "suspended", "injured reserve", "ir", "pup", "nfi")
SLATE_SECONDS = 5 * 60
SUMMARY_SECONDS = 5 * 60
TABLE_SECONDS = 15 * 60
# Each member's saved picks (only what they save; Nov 6). The site-wide
# histories before it (krazy_data:predictor:v1|v2:history:{sport}) are kept, not shown.
PICKS_KEY = "krazy_data:predictor:v2:picks:{member}:{sport}"
# Each game's market chance over time, for its chart: [[epoch s, home chance, home ML, away ML]].
ODDS_KEY = "krazy_data:predictor:v2:odds:{sport}:{event}"
# A sample is added when the chance moved this much, or this many seconds passed.
ODDS_MOVE, ODDS_EVERY, MAX_ODDS = 0.002, 15 * 60, 400
# The chart's own read of ESPN's summary (the line now, a game's win
# probability). Nov 7, the owner: "On live it should [move] most instantly":
# 3 s (was 20), with the page asking every 4 s in a game.
LIVE_SECONDS = 3
# DraftKings' own odds (Nov 6, the owner: "use draft king odds"): the public
# feed its sportsbook pages read, one league at a time, live before and during
# games (ESPN only copies DraftKings' line every few minutes). Unofficial: if
# it fails or blocks us, ESPN's copy stands.
DK_URL = "https://sportsbook-nash.draftkings.com/api/sportscontent/dkusnj/v1/leagues/{league}"
DK_LEAGUES = {"nba": 42648, "nfl": 88808}
DK_SECONDS = 6
DK_RESTING = 120
PRIOR_KEY = "krazy_data:predictor:v1:nba-prior:{season}"
PRIOR2_KEY = "krazy_data:predictor:v2:nba-prior:{season}"
MAX_HISTORY = 400
# A game is settled once ESPN calls it final; asked about this long after its start.
SETTLE_AFTER = {"nba": 2.5 * 3600, "nfl": 3.5 * 3600}
# Games settled per read of the history (a summary each); the rest wait for the next.
SETTLE_MOST = 16
_memory: dict = {}


def _kept(key, seconds, load):
    """`load()` once per `seconds` per key, in this instance's memory."""
    now = time.time()
    hit = _memory.get(key)
    if hit and now - hit[0] < seconds:
        return hit[1]
    value = load()
    _memory[key] = (now, value)
    if len(_memory) > 200:
        _memory.pop(next(iter(_memory)))
    return value


def _espn(sport, path, params=None):
    response = requests.get(ESPN + PATHS[sport] + path, params=params,
                            headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=12)
    response.raise_for_status()
    return response.json()


def _num(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _when(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def phi(x: float) -> float:
    return 0.5 * (1 + math.erf(x / math.sqrt(2)))


def american(chance):
    """A win chance as American odds (-150, +130)."""
    if chance is None or not 0 < chance < 1:
        return None
    return round(-100 * chance / (1 - chance)) if chance >= 0.5 else round(100 * (1 - chance) / chance)


def implied(moneyline):
    if moneyline is None or abs(moneyline) < 100:
        return None
    return -moneyline / (-moneyline + 100) if moneyline < 0 else 100 / (moneyline + 100)


def _key(name) -> str:
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv)\b", "", text)
    return re.sub(r"[^a-z]", "", text)


def is_out(status) -> bool:
    return str(status or "").strip().lower() in OUT_STATUSES


def _short_key(name) -> str:
    """First initial and last name: nflverse's "P.Mahomes" and ESPN's
    "Patrick Mahomes II" read the same."""
    text = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b\.?", " ", text)
    words = [word for word in re.split(r"[\s.]+", text) if re.sub(r"[^a-z]", "", word)]
    if not words:
        return ""
    return words[0][0] + re.sub(r"[^a-z]", "", words[-1]) if len(words) > 1 else re.sub(r"[^a-z]", "", words[0])


def _warn(level, text) -> dict:
    """A data warning on a prediction: level high (it lowers the confidence), medium or info."""
    return {"level": level, "text": text}


# ------------------------------------------------------------------ the schedule

def _competitor(competitor):
    team = competitor.get("team") or {}
    records = competitor.get("records") or competitor.get("record") or []
    record = next((item.get("summary") for item in records if item.get("type") in ("total", None)), None) if isinstance(records, list) else None
    logo = team.get("logo") or next((item.get("href") for item in team.get("logos") or []), None)
    return {"abbr": team.get("abbreviation"), "name": team.get("displayName"), "short": team.get("shortDisplayName") or team.get("name"),
            "logo": logo, "color": team.get("color"), "alt": team.get("alternateColor"), "record": record,
            "score": _num(competitor.get("score"))}


def _line(raw, sides):
    """A sportsbook line from ESPN (its scoreboard's odds or the summary's
    pick center): the home spread (negative: home favored), the total and
    both moneylines, with the market's win chances with the margin taken out."""
    from backend.sports.wnba import matchup
    teams = [{"side": side, "abbr": (sides.get(side) or {}).get("abbr")} for side in ("away", "home")]
    found = matchup._odds({"pickcenter": [raw]}, teams) if raw else None
    if not found:
        return None
    home, away = found.get("home") or {}, found.get("away") or {}
    # ESPN's newer scoreboard files the moneylines apart: {"moneyline": {"home": {"close": {"odds": "-300"}}}}.
    listed = raw.get("moneyline") if isinstance(raw.get("moneyline"), dict) else {}
    price = lambda side: (found.get(side) or {}).get("moneyline") if (found.get(side) or {}).get("moneyline") is not None else _price(listed.get(side))
    line = {"provider": found.get("provider"), "spread": home.get("spread"), "total": found.get("total"),
            "moneyline": {"home": price("home"), "away": price("away")}, "chance": None}
    # Where the book opened each moneyline ({"open": {"odds": "-218"}}), on the scoreboard's lines.
    opened = {side: _price({"open": (listed.get(side) or {}).get("open")}) for side in ("home", "away")}
    if opened["home"] is not None and opened["away"] is not None:
        line["open"] = opened
    home_p, away_p = implied(line["moneyline"]["home"]), implied(line["moneyline"]["away"])
    if home_p and away_p:
        line["chance"] = {"home": home_p / (home_p + away_p), "away": away_p / (home_p + away_p)}
    if line["spread"] is None and line["total"] is None and not line["chance"]:
        return None
    return line


def _price(entry):
    """American odds from ESPN's {"close": {"odds": "-300"}, "open": ...}; EVEN is +100."""
    for moment in ("close", "current", "open"):
        odds = str(((entry or {}).get(moment) or {}).get("odds") or "").strip().upper()
        if odds == "EVEN":
            return 100.0
        if (value := _num(odds.replace("+", ""))) is not None:
            return value
    return None


def _event(sport, event):
    competition = (event.get("competitions") or [{}])[0]
    sides = {competitor.get("homeAway"): _competitor(competitor) for competitor in competition.get("competitors") or []}
    status = ((competition.get("status") or event.get("status") or {}).get("type") or {})
    return {"id": str(event.get("id")), "sport": sport, "startsAt": event.get("date"), "state": status.get("state"),
            "detail": status.get("shortDetail") or status.get("detail"), "neutral": bool(competition.get("neutralSite")),
            "home": sides.get("home"), "away": sides.get("away"),
            "line": _line((competition.get("odds") or [None])[0], sides)}


def _american(text):
    """DraftKings' American odds text ("−150" with its Unicode minus, "+130", "EVEN") as a number."""
    value = str(text or "").strip().upper().replace("\u2212", "-").replace("\u2013", "-").replace("+", "")
    if value in ("EVEN", "EV"):
        return 100.0
    number = _num(value)
    return number if number is not None and abs(number) >= 100 else None


def parse_dk(payload) -> list:
    """DraftKings' league feed as [{id, start, names {home, away}, moneyline
    {home, away}, live}]: each event with a moneyline for both sides."""
    payload = payload or {}
    events = {str(event.get("id")): event for event in payload.get("events") or [] if event.get("id") is not None}
    markets = {}
    for market in payload.get("markets") or []:
        name = str(market.get("name") or (market.get("marketType") or {}).get("name") or "").strip().lower()
        if name == "moneyline" and str(market.get("eventId")) in events:
            markets[str(market.get("id"))] = str(market["eventId"])
    prices = {}
    for selection in payload.get("selections") or []:
        event_id = markets.get(str(selection.get("marketId")))
        if not event_id:
            continue
        role = str(selection.get("outcomeType") or "").lower()
        if role not in ("home", "away"):
            role = str(((selection.get("participants") or [{}])[0]).get("venueRole") or "").lower()
        price = _american((selection.get("displayOdds") or {}).get("american"))
        if role in ("home", "away") and price is not None:
            prices.setdefault(event_id, {})[role] = price
    out = []
    for event_id, line in prices.items():
        event = events[event_id]
        names = {str(team.get("venueRole") or "").lower(): team.get("name") for team in event.get("participants") or []}
        start = _when(event.get("startEventDate"))
        if "home" in line and "away" in line and names.get("home") and names.get("away") and start:
            out.append({"id": event_id, "start": start, "names": {"home": names["home"], "away": names["away"]}, "moneyline": line,
                        "live": str(event.get("status") or "").upper() in ("STARTED", "LIVE", "IN_PROGRESS")})
    return out


def dk_events(sport) -> list:
    """DraftKings' events with moneylines for a league, read at most every
    DK_SECONDS; [] when it can't be read, and then not tried again for
    DK_RESTING seconds (a page never waits on a feed that's down)."""
    if sport not in DK_LEAGUES:
        return []
    resting = _memory.get(f"dk-down:{sport}")
    if resting and time.time() - resting[0] < DK_RESTING:
        return []

    def load():
        try:
            response = requests.get(DK_URL.format(league=DK_LEAGUES[sport]), timeout=5,
                                    headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
            response.raise_for_status()
            found = parse_dk(response.json())
        except Exception:  # noqa: BLE001 -- ESPN's copy of the line stands
            found = []
        if not found:
            _memory[f"dk-down:{sport}"] = (time.time(), True)
        return found
    return _kept(f"dk:{sport}", DK_SECONDS, load)


def _nick(text) -> str:
    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode().lower())


def _dk_find(game, events):
    """(DraftKings' event for an ESPN game, whether its sides are the other
    way round): both teams' nicknames at the end of DraftKings' names ("ATL
    Hawks", "POR Trail Blazers"), starting within six hours of ESPN's time."""
    start = _when(game.get("startsAt"))
    wanted = {side: _nick((game.get(side) or {}).get("short") or (game.get(side) or {}).get("name")) for side in ("home", "away")}
    if not start or not all(wanted.values()):
        return None, False
    for event in events:
        if abs((event["start"] - start).total_seconds()) > 6 * 3600:
            continue
        names = {side: _nick(event["names"][side]) for side in ("home", "away")}
        if names["home"].endswith(wanted["home"]) and names["away"].endswith(wanted["away"]):
            return event, False
        if names["home"].endswith(wanted["away"]) and names["away"].endswith(wanted["home"]):
            return event, True
    return None, False


def dk_match(game, events):
    """The moneyline {home, away} DraftKings has for an ESPN game (a
    neutral-site game DraftKings lists the other way round turned back to
    ESPN's sides)."""
    event, flipped = _dk_find(game, events)
    if not event:
        return None
    prices = event["moneyline"]
    return {"home": prices["away"], "away": prices["home"]} if flipped else dict(prices)


def with_dk(sport, games, events=None) -> list:
    """Each game's moneyline from DraftKings itself where it has one (the
    market chance worked out again from it); ESPN's spread and total kept."""
    try:
        events = dk_events(sport) if events is None else events
    except Exception:  # noqa: BLE001
        events = []
    if not events:
        return list(games)
    out = []
    for game in games:
        prices = dk_match(game, events)
        home_p, away_p = (implied(prices["home"]), implied(prices["away"])) if prices else (None, None)
        if not home_p or not away_p:
            out.append(game)
            continue
        line = dict(game.get("line") or {"spread": None, "total": None})
        line.update({"provider": "DraftKings", "source": "draftkings", "moneyline": prices,
                     "chance": {"home": home_p / (home_p + away_p), "away": away_p / (home_p + away_p)},
                     "inPlay": bool((_dk_find(game, events)[0] or {}).get("live"))})
        out.append({**game, "line": line})  # a copy: the cached game keeps ESPN's line
    return out


def _us_day(moment: datetime) -> str:
    return (moment - timedelta(hours=5)).strftime("%Y%m%d")


def slate(sport, now=None) -> dict:
    """{sport, games}: the games still to start, and those on now, soonest
    first -- the NBA's today and tomorrow, the NFL's week (the next one too
    once this week's are all played)."""
    now = now or datetime.now(timezone.utc)

    def load():
        if sport == "nba":
            events = []
            for day in (_us_day(now + timedelta(days=offset)) for offset in (0, 1)):
                events += _espn(sport, "/scoreboard", {"dates": day, "limit": 100}).get("events") or []
            return [_event(sport, event) for event in events]
        # ESPN's NFL scoreboard answers a date range with 400 (Nov 5); its
        # plain scoreboard is the current week.
        board = _espn(sport, "/scoreboard")
        games = [_event(sport, event) for event in board.get("events") or []]
        week, kind = (board.get("week") or {}).get("number"), (board.get("season") or {}).get("type")
        if week and kind and not any(game["state"] == "pre" for game in games):
            try:
                games += [_event(sport, event) for event in _espn(sport, "/scoreboard", {"week": week + 1, "seasontype": kind}).get("events") or []]
            except Exception:  # noqa: BLE001 -- this week's list stands
                pass
        return games
    def fresh():
        found = with_dk(sport, load())
        try:  # Every fresh read of the lines is a point on the games' charts.
            sample_odds(sport, found, now=now)
        except Exception:  # noqa: BLE001
            pass
        return found
    # DraftKings' moneylines again on the kept list: its read is seconds old.
    games = with_dk(sport, _kept(f"slate:{sport}:{_us_day(now)}", SLATE_SECONDS, fresh))
    games = [game for game in games if game["home"] and game["away"] and game["state"] in ("pre", "in")]
    games.sort(key=lambda game: game["startsAt"] or "")
    return {"sport": sport, "games": games, "fetchedAt": now.isoformat()}


def _summary(sport, event_id):
    """One game from ESPN's summary: teams, status, line, its projection,
    both injury reports and each team's last five."""
    from backend.sports.wnba import matchup

    def load():
        summary = _espn(sport, "/summary", {"event": event_id})
        competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
        sides = {competitor.get("homeAway"): _competitor(competitor) for competitor in competition.get("competitors") or []}
        status = (competition.get("status") or {}).get("type") or {}
        predictor = summary.get("predictor") or {}
        home_p = _num((predictor.get("homeTeam") or {}).get("gameProjection"))
        away_p = _num((predictor.get("awayTeam") or {}).get("gameProjection"))
        venue = (summary.get("gameInfo") or {}).get("venue") or {}
        return {"id": str(event_id), "sport": sport, "startsAt": competition.get("date"), "state": status.get("state"),
                "detail": status.get("shortDetail") or status.get("detail"), "neutral": bool(competition.get("neutralSite")),
                "venue": venue.get("fullName"), "home": sides.get("home"), "away": sides.get("away"),
                "line": _line((summary.get("pickcenter") or [None])[0], sides),
                "espn": {"home": home_p / 100, "away": away_p / 100} if home_p is not None and away_p is not None else None,
                "injuries": matchup._injuries(summary), "lastFive": matchup._last_five(summary)}
    found = _kept(f"summary:{sport}:{event_id}", SUMMARY_SECONDS, load)
    # DraftKings' moneyline right now (its own read is seconds old, not
    # minutes) for a game still to start: once it's on, the prediction keeps
    # the line it had at tip-off (the chart has the live price).
    return with_dk(sport, [found])[0] if found.get("state") == "pre" else found


# ------------------------------------------------------------------ NBA numbers

def _gmsc(row, index) -> float:
    """Hollinger's Game Score for one box-score line."""
    v = lambda key: row[index[key]] or 0
    return (v("pts") + 0.4 * v("fgm") - 0.7 * v("fga") - 0.4 * (v("fta") - v("ftm")) + 0.7 * v("oreb") + 0.3 * v("dreb")
            + v("stl") + 0.7 * v("ast") + 0.7 * v("blk") - 0.4 * v("pf") - v("to"))


def _nba_games(payload) -> dict:
    """team -> its finished games in order: date, points, allowed, possessions, both boxes."""
    from backend.sports.wnba import context, opportunity
    out = {}
    for team, games in context.team_games(payload or {}).items():
        rows = []
        for game in games:
            own, opp = opportunity.side_totals(game["own"]), opportunity.side_totals(game["opp"])
            if not own["min"] or not opp["min"]:
                continue
            rows.append({"date": game["date"], "pts": own["pts"], "opp": opp["pts"], "poss": opportunity.possessions(own, opp),
                         "own": game["own"].get("p") or [], "against": game["opp"].get("p") or []})
        out[team] = rows
    return out


def _ratings(games: dict) -> tuple[dict, dict]:
    """({team: {ortg, drtg, pace, n}}, league {ortg, pace}) from _nba_games."""
    teams, pts, poss, count = {}, 0.0, 0.0, 0
    for team, rows in games.items():
        if not rows:
            continue
        p = sum(row["poss"] for row in rows)
        teams[team] = {"ortg": 100 * sum(row["pts"] for row in rows) / p, "drtg": 100 * sum(row["opp"] for row in rows) / p,
                       "pace": p / len(rows), "n": len(rows)}
        pts += sum(row["pts"] for row in rows)
        poss += p
        count += len(rows)
    league = {"ortg": 100 * pts / poss, "pace": poss / count} if poss else None
    return teams, league


def _nba_prior(season, load=None, store=None) -> dict | None:
    """Last season's ratings, worked out once and kept (they never change)."""
    key = PRIOR_KEY.format(season=season)
    hit = _memory.get(key)
    if hit:
        return hit[1]
    store = _store() if store is None else store
    try:
        raw = store.get(key) if store else None
        if raw:
            value = json.loads(raw)
            _memory[key] = (time.time(), value)
            return value
    except Exception:  # noqa: BLE001
        pass
    if load is None:
        from backend.sports.wnba import league
        load = lambda: league.stored(season, "nba")
    payload = load()
    if not payload or not payload.get("games"):
        return None
    teams, lg = _ratings(_nba_games(payload))
    value = {"teams": teams, "league": lg}
    _memory[key] = (time.time(), value)
    try:
        if store:
            store.set(key, json.dumps(value, separators=(",", ":")))
    except Exception:  # noqa: BLE001
        pass
    return value


def nba_tables(payload, prior) -> dict:
    """Every team's numbers for tonight: ratings and pace blended with last
    season, last-ten form, its last game's date, its regulars' values and
    what it allows each position per 36 minutes."""
    from backend.sports.wnba import context
    from backend.sports.wnba.league import FIELDS
    model = MODELS["nba"]
    index = {name: i + 2 for i, name in enumerate(FIELDS)}
    games = _nba_games(payload)
    now_teams, now_league = _ratings(games)
    prior_teams = (prior or {}).get("teams") or {}
    prior_league = (prior or {}).get("league") or now_league or {"ortg": 112.0, "pace": 99.0}
    total_games = sum(len(rows) for rows in games.values()) / 2
    league = now_league if now_league and total_games >= 60 else prior_league
    players = (payload or {}).get("players") or {}
    teams = {}
    # This season's teams once it has games (last season's list holds the
    # All-Star teams too), else last season's.
    for team in [team for team in games if games[team]] or list(prior_teams):
        rows = games.get(team) or []
        before = prior_teams.get(team)
        keep, k = model["prior_keep"], model["prior_games"]
        p_ortg = league["ortg"] + ((before["ortg"] - prior_league["ortg"]) * keep if before else 0)
        p_drtg = league["ortg"] + ((before["drtg"] - prior_league["ortg"]) * keep if before else 0)
        p_pace = league["pace"] + ((before["pace"] - prior_league["pace"]) * model["pace_keep"] if before else 0)
        poss = sum(row["poss"] for row in rows)
        weight = k * p_pace
        row = {"games": len(rows),
               "ortg": (100 * sum(r["pts"] for r in rows) + p_ortg * weight) / (poss + weight),
               "drtg": (100 * sum(r["opp"] for r in rows) + p_drtg * weight) / (poss + weight),
               "pace": (poss + k * p_pace) / (len(rows) + k),
               "lastGame": rows[-1]["date"] if rows else None, "form": None, "players": {}}
        recent = rows[-10:]
        if len(recent) >= 5:
            p = sum(r["poss"] for r in recent)
            row["form"] = 100 * (sum(r["pts"] for r in recent) - sum(r["opp"] for r in recent)) / p
            row["last10"] = [sum(1 for r in recent if r["pts"] > r["opp"]), sum(1 for r in recent if r["pts"] < r["opp"])]
        window = rows[-model["window"]:]
        apps = defaultdict(list)
        for game_index, game in enumerate(window):
            for line in game["own"]:
                minutes = line[index["min"]] or 0
                if minutes > 0:
                    apps[str(line[0])].append((game_index, minutes, _gmsc(line, index), line[index["pts"]] or 0,
                                               line[index["reb"]] or 0, line[index["ast"]] or 0))
        for pid, lines in apps.items():
            minutes = sum(line[1] for line in lines) / len(lines)
            info = players.get(pid) or ["", "", None, team]
            row["players"][pid] = {"id": pid, "name": info[0], "pos": context.primary_position(info), "headshot": context.headshot(pid, info, "nba"),
                                   "share": len(lines) / len(window), "games": len(lines), "min": minutes,
                                   "gmsc": sum(line[2] for line in lines) / len(lines),
                                   "pts": sum(line[3] for line in lines) / len(lines), "reb": sum(line[4] for line in lines) / len(lines),
                                   "ast": sum(line[5] for line in lines) / len(lines),
                                   "last5": sum(line[3] for line in lines if line[0] >= len(window) - 5) / max(1, sum(1 for line in lines if line[0] >= len(window) - 5)),
                                   "recent": any(line[0] >= len(window) - 3 for line in lines),
                                   "regular": minutes >= model["regular_minutes"] and len(lines) >= 2}
        teams[team] = row
    # What each defense allows guards, forwards and centers per 36 minutes.
    allowed = {team: {position: defaultdict(float) for position in context.POSITIONS} for team in games}
    league_allowed = {position: defaultdict(float) for position in context.POSITIONS}
    for team, rows in games.items():
        for game in rows:
            for line in game["against"]:
                position = context.primary_position(players.get(str(line[0])))
                minutes = line[index["min"]] or 0
                if not position or minutes <= 0:
                    continue
                for bucket in (allowed[team][position], league_allowed[position]):
                    bucket["min"] += minutes
                    for stat in ("pts", "reb", "ast"):
                        bucket[stat] += line[index[stat]] or 0
    per36 = lambda bucket, stat: bucket[stat] / bucket["min"] * 36 if bucket["min"] else None
    defense = {}
    for position in context.POSITIONS:
        for stat in ("pts", "reb", "ast"):
            base = per36(league_allowed[position], stat)
            column = {team: per36(allowed[team][position], stat) for team in games}
            ranked = sorted((value for value in column.values() if value is not None), reverse=True)
            for team, value in column.items():
                if value is None or not base:
                    continue
                n = len(games[team])
                defense.setdefault(team, {}).setdefault(position, {})[stat] = {
                    "per36": value, "factor": 1 + (value / base - 1) * n / (n + 10), "rank": ranked.index(value) + 1}
    return {"teams": teams, "league": league, "defense": defense, "count": len(games), "season": (payload or {}).get("season")}


def _nba_numbers(now=None):
    from backend.sports.wnba import league
    season = league.current_season(league="nba")
    payload = league.ensure(season, "nba") or {}
    built = (season, payload.get("builtAt"), len(payload.get("games") or {}))
    hit = _memory.get("nba-tables")
    if hit and hit[1][0] == built and time.time() - hit[0] < TABLE_SECONDS:
        return hit[1][1]
    prior = _nba_prior(season - 1)
    tables = nba_tables(payload, prior)
    _memory["nba-tables"] = (time.time(), (built, tables))
    return tables


def _rest_days(last, starts_at) -> int | None:
    last, start = _when(last), _when(starts_at)
    if not last or not start:
        return None
    return ((start - timedelta(hours=5)).date() - (last - timedelta(hours=5)).date()).days


def _rank_of(values: dict, team, high_first=True):
    known = sorted((value for value in values.values() if value is not None), reverse=high_first)
    value = values.get(team)
    return known.index(value) + 1 if value is not None else None


def ordinal(n) -> str:
    if n is None:
        return ""
    return f"{n}{'th' if 11 <= n % 100 <= 13 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


POSITION_WORDS = {"G": "guards", "F": "forwards", "C": "centers"}


def nba_model(game, tables) -> dict:
    """Our own margin and total for one game, with what moved it."""
    model = MODELS["nba"]
    home, away = game["home"]["abbr"], game["away"]["abbr"]
    teams, league = tables["teams"], tables["league"]
    h, a = teams.get(home), teams.get(away)
    if not h or not a:
        return None
    poss = h["pace"] * a["pace"] / league["pace"]
    home_ppp, away_ppp = h["ortg"] * a["drtg"] / league["ortg"], a["ortg"] * h["drtg"] / league["ortg"]
    base = poss * (home_ppp - away_ppp) / 100
    total = poss * (home_ppp + away_ppp) / 100
    injuries = game.get("injuries") or {}
    lost, out = {}, {}
    for side, abbr, row in (("home", home, h), ("away", away, a)):
        lost[side], out[side] = 0.0, []
        by_name = {_key(player["name"]): player for player in row["players"].values()}
        for item in injuries.get(abbr) or []:
            player = row["players"].get(str(item.get("id") or "")) or by_name.get(_key(item.get("name")))
            entry = {"name": item.get("name"), "position": item.get("position"), "status": item.get("status"),
                     "injury": item.get("injury"), "out": is_out(item.get("status")), "impact": 0.0}
            if entry["out"] and player and player["regular"]:
                entry["impact"] = round(model["injury"] * player["share"] * player["gmsc"], 1)
                entry["min"] = round(player["min"], 1)
                entry["pts"] = round(player["pts"], 1)
                lost[side] += player["share"] * player["gmsc"]
            out[side].append(entry)
        out[side].sort(key=lambda entry: (-entry["impact"], not entry["out"]))
    rest = {"home": _rest_days(h.get("lastGame"), game["startsAt"]), "away": _rest_days(a.get("lastGame"), game["startsAt"])}
    b2b = {side: int(days is not None and days <= 1) for side, days in rest.items()}
    form = (h["form"] or 0) - (a["form"] or 0) if h.get("form") is not None and a.get("form") is not None else 0
    home_court = 0 if game.get("neutral") else model["home"]
    parts = [
        ("ratings", "Team ratings", model["scale"] * base,
         f"Net rating {h['ortg'] - h['drtg']:+.1f} vs {a['ortg'] - a['drtg']:+.1f} per 100 possessions"),
        ("home", "Home court", home_court, "Neutral floor" if game.get("neutral") else f"{home} at home"),
        ("injuries", "Who's out", model["injury"] * (lost["away"] - lost["home"]),
         ", ".join(f"{entry['name']} ({abbr}) -{entry['impact']}" for side, abbr in (("home", home), ("away", away))
                   for entry in out[side] if entry["impact"] > 0)[:160] or None),
        ("rest", "Rest", model["b2b"] * (b2b["away"] - b2b["home"]),
         " · ".join(f"{abbr} on a back-to-back" for side, abbr in (("home", home), ("away", away)) if b2b[side]) or None),
        ("form", "Last 10 games", model["form"] * form,
         f"{home} {h['form']:+.1f}, {away} {a['form']:+.1f} net per 100 lately" if form else None),
    ]
    margin = sum(part[2] for part in parts)
    total -= 0.05 * (lost["home"] + lost["away"])
    ortg = {team: row["ortg"] for team, row in teams.items() if row["games"]}
    drtg = {team: row["drtg"] for team, row in teams.items() if row["games"]}
    pace = {team: row["pace"] for team, row in teams.items() if row["games"]}
    profile = lambda abbr, row: {"ortg": [round(row["ortg"], 1), _rank_of(ortg, abbr)], "drtg": [round(row["drtg"], 1), _rank_of(drtg, abbr, high_first=False)],
                                 "pace": [round(row["pace"], 1), _rank_of(pace, abbr)], "net": round(row["ortg"] - row["drtg"], 1),
                                 "last10": row.get("last10"), "games": row["games"]}
    return {"margin": margin, "total": total, "poss": poss, "lost": lost, "out": out, "rest": rest,
            "parts": [{"key": key, "label": label, "points": round(points, 1), "text": text} for key, label, points, text in parts],
            "teams": {"home": profile(home, h), "away": profile(away, a)}, "leaguePace": league["pace"]}


def nba_players(game, tables, built) -> dict:
    """Each side's player with the best matchup tonight: his average
    points, rebounds and assists moved by what this defense allows his
    position per 36 minutes, the game's pace against his team's, and a share
    of what teammates out tonight usually score."""
    teams, defense = tables["teams"], tables["defense"]
    result = {}
    for side, other in (("home", "away"), ("away", "home")):
        abbr, opponent = game[side]["abbr"], game[other]["abbr"]
        row = teams.get(abbr) or {}
        out_names = {_key(entry["name"]) for entry in built["out"][side] if entry["out"]}
        roster = [p for p in (row.get("players") or {}).values() if p["regular"] and p["recent"] and p["min"] >= 22
                  and _key(p["name"]) not in out_names]
        lost_points = sum(p["pts"] * p["share"] for p in (row.get("players") or {}).values()
                          if p["regular"] and _key(p["name"]) in out_names)
        team_points = sum(p["pts"] for p in roster) or 1
        pace = built["poss"] / row["pace"] if row.get("pace") else 1
        best = None
        for player in roster:
            spot = (defense.get(opponent) or {}).get(player["pos"]) or {}
            boost = 0.5 * lost_points * player["pts"] / team_points
            proj = {stat: player[stat] * (spot.get(stat) or {}).get("factor", 1) * pace + (boost if stat == "pts" else 0)
                    for stat in ("pts", "reb", "ast")}
            gain = (proj["pts"] - player["pts"]) + 1.2 * (proj["reb"] - player["reb"]) + 1.5 * (proj["ast"] - player["ast"])
            if best is None or gain > best[0]:
                best = (gain, player, proj, spot, boost)
        if not best:
            continue
        gain, player, proj, spot, boost = best
        why = []
        stat = max(("pts", "reb", "ast"), key=lambda key: (spot.get(key) or {}).get("factor", 1))
        if spot.get(stat) and spot[stat]["rank"] <= 10:
            word = {"pts": "points", "reb": "rebounds", "ast": "assists"}[stat]
            why.append(f"{opponent} allows the {ordinal(spot[stat]['rank'])} most {word} to {POSITION_WORDS.get(player['pos'], 'his position')}")
        if pace >= 1.02:
            why.append(f"Faster game than usual: {built['poss']:.0f} possessions, {abbr} averages {row['pace']:.0f}")
        if boost >= 1:
            names = [entry["name"].split(" ")[-1] for entry in built["out"][side] if entry["out"] and entry["impact"] > 0][:2]
            if names:
                why.append(f"More shots with {' and '.join(names)} out")
        if player["last5"] >= player["pts"] + 3:
            why.append(f"Averaging {player['last5']:.1f} points his last 5")
        result[side] = {"id": player["id"], "name": player["name"], "position": player["pos"], "headshot": player["headshot"],
                        "team": abbr, "avg": {key: round(player[key], 1) for key in ("pts", "reb", "ast")},
                        "proj": {key: round(value, 1) for key, value in proj.items()}, "edge": round(gain, 1), "why": why}
    return result


# ------------------------------------------------------------------ NFL numbers

def _nfl_season(now=None):
    now = now or datetime.now(timezone.utc)
    return now.year if now.month >= 3 else now.year - 1


def nfl_tables(games: dict, season: int, player_rows=(), last_rows=()) -> dict:
    """Every team's points scored and allowed a game (last season's worth
    MODELS prior_games games, a half of it kept), its last game, and its
    main quarterback (most attempts this season, else last season)."""
    from backend.sports.nfl.services.nflverse import canonical_team
    model = MODELS["nfl"]
    finals = lambda year: sorted((g for g in games.values() if str(g.get("season")) == str(year) and g.get("final")),
                                 key=lambda g: g.get("kickoff") or 0)
    score = lambda g, side: _num(g.get(f"{side}_score")) or 0

    def per_team(year):
        out = defaultdict(list)
        for g in finals(year):
            out[g["home"]].append((score(g, "home"), score(g, "away"), g.get("kickoff")))
            out[g["away"]].append((score(g, "away"), score(g, "home"), g.get("kickoff")))
        return out
    before, now = per_team(season - 1), per_team(season)
    league = (sum(x[0] for rows in before.values() for x in rows) / max(1, sum(len(rows) for rows in before.values()))) or 22.5
    teams = {}
    for team in set(before) | set(now):
        rows, last = now.get(team) or [], before.get(team) or []
        pf0 = league + ((sum(x[0] for x in last) / len(last) - league) * model["prior_keep"] if last else 0)
        pa0 = league + ((sum(x[1] for x in last) / len(last) - league) * model["prior_keep"] if last else 0)
        k = model["prior_games"]
        teams[team] = {"games": len(rows), "pf": (sum(x[0] for x in rows) + k * pf0) / (len(rows) + k),
                       "pa": (sum(x[1] for x in rows) + k * pa0) / (len(rows) + k),
                       "pfSeason": sum(x[0] for x in rows) / len(rows) if rows else None,
                       "paSeason": sum(x[1] for x in rows) / len(rows) if rows else None,
                       "lastKickoff": rows[-1][2] if rows else None,
                       "last5": [x[0] > x[1] for x in rows[-5:]]}
    quarterbacks = {}
    for rows in (last_rows, player_rows):
        attempts = defaultdict(lambda: defaultdict(float))
        names = {}
        for row in rows:
            if str(row.get("position") or "").upper() != "QB" or str(row.get("season_type") or "").upper() not in ("REG", "POST"):
                continue
            team = canonical_team(row.get("team"))
            attempts[team][row.get("player_id")] += _num(row.get("attempts")) or 0
            names[row.get("player_id")] = row.get("player_display_name") or row.get("player_name") or ""
        for team, by_player in attempts.items():
            pid = max(by_player, key=by_player.get)
            if by_player[pid] > 0:
                quarterbacks[team] = {"id": pid, "name": names.get(pid, "")}
    return {"teams": teams, "league": league, "qb": quarterbacks, "season": season}


def _nfl_numbers(now=None):
    def load():
        from backend.sports.nfl import finder
        season = _nfl_season(now)
        games = finder.games_index()
        try:
            rows = finder.player_rows(season)
        except Exception:  # noqa: BLE001 -- early in a season the file may not exist yet
            rows = []
        try:
            last = finder.player_rows(season - 1) if not rows else []
        except Exception:  # noqa: BLE001
            last = []
        tables = nfl_tables(games, season, rows, last)
        try:
            tables["league_data"] = finder.league(season)
            tables["rows"] = rows
        except Exception:  # noqa: BLE001 -- the player matchups are left off
            tables["league_data"] = None
        return tables
    return _kept("nfl-tables", TABLE_SECONDS, load)


def nfl_model(game, tables) -> dict | None:
    from backend.sports.nfl.services.nflverse import canonical_team
    model = MODELS["nfl"]
    home, away = canonical_team(game["home"]["abbr"]), canonical_team(game["away"]["abbr"])
    h, a = tables["teams"].get(home), tables["teams"].get(away)
    if not h or not a:
        return None
    net = ((h["pf"] - h["pa"]) - (a["pf"] - a["pa"])) / 2
    injuries = game.get("injuries") or {}
    out, qb_out = {}, {}
    for side, team in (("home", home), ("away", away)):
        quarterback = tables["qb"].get(team) or {}
        qb_out[side] = None
        out[side] = []
        for item in injuries.get(game[side]["abbr"]) or []:
            entry = {"name": item.get("name"), "position": item.get("position"), "status": item.get("status"),
                     "injury": item.get("injury"), "out": is_out(item.get("status")), "impact": 0.0}
            if entry["out"] and str(item.get("position") or "").upper() == "QB" and quarterback and _key(item.get("name")) == _key(quarterback.get("name")):
                entry["impact"] = model["qb"]
                qb_out[side] = item.get("name")
            out[side].append(entry)
        out[side].sort(key=lambda entry: (-entry["impact"], not entry["out"]))
    start = _when(game["startsAt"])
    rest = {}
    for side, row in (("home", h), ("away", a)):
        rest[side] = round((start.timestamp() - row["lastKickoff"]) / 86400) if start and row.get("lastKickoff") else None
    rest_diff = max(-7, min(7, (rest["home"] or 7) - (rest["away"] or 7))) if rest["home"] and rest["away"] else 0
    home_field = 0 if game.get("neutral") else model["home"]
    qb = model["qb"] * ((1 if qb_out["away"] else 0) - (1 if qb_out["home"] else 0))
    parts = [
        ("ratings", "Team ratings", model["scale"] * net,
         f"{home} {h['pf']:.1f} scored / {h['pa']:.1f} allowed, {away} {a['pf']:.1f} / {a['pa']:.1f} a game"),
        ("home", "Home field", home_field, "Neutral site" if game.get("neutral") else f"{home} at home"),
        ("qb", "Quarterback", qb, " · ".join(f"{name} out" for name in (qb_out["home"], qb_out["away"]) if name) or None),
        ("rest", "Rest", model["rest"] * rest_diff, f"{home} {rest['home']} days, {away} {rest['away']} days" if rest_diff else None),
    ]
    margin = sum(part[2] for part in parts)
    total = (h["pf"] + a["pa"]) / 2 + (a["pf"] + h["pa"]) / 2
    pf = {team: row["pfSeason"] for team, row in tables["teams"].items() if row["games"]}
    pa = {team: row["paSeason"] for team, row in tables["teams"].items() if row["games"]}
    profile = lambda team, row: {"pf": [round(row["pfSeason"], 1) if row["pfSeason"] is not None else None, _rank_of(pf, team)],
                                 "pa": [round(row["paSeason"], 1) if row["paSeason"] is not None else None, _rank_of(pa, team, high_first=False)],
                                 "games": row["games"], "qb": (tables["qb"].get(team) or {}).get("name")}
    plays = _nfl_pace(tables.get("league_data"), home, away)
    return {"margin": margin, "total": total, "out": out, "rest": rest, "qbOut": qb_out, "plays": plays,
            "parts": [{"key": key, "label": label, "points": round(points, 1), "text": text} for key, label, points, text in parts],
            "teams": {"home": profile(home, h), "away": profile(away, a)}}


def _nfl_pace(league_data, home, away):
    """Each team's plays a game (passes, sacks and runs) and its rank."""
    stats = (league_data or {}).get("teamStats") or {}
    plays = {}
    for team, sides in stats.items():
        off = sides.get("off") or {}
        values = [(off.get(key) or [None])[0] for key in ("attempts", "carries", "sacks_taken")]
        if values[0] is not None and values[1] is not None:
            plays[team] = sum(value or 0 for value in values)
    if home not in plays or away not in plays:
        return None
    return {"home": [round(plays[home], 1), _rank_of(plays, home)], "away": [round(plays[away], 1), _rank_of(plays, away)],
            "league": round(sum(plays.values()) / len(plays), 1)}


NFL_SKILL = {"QB": ("passing_yards", "Pass yds"), "RB": ("rushing_yards", "Rush yds"), "WR": ("receiving_yards", "Rec yds"),
             "TE": ("receiving_yards", "Rec yds")}
NFL_WORDS = {"QB": "quarterbacks", "RB": "running backs", "WR": "receivers", "TE": "tight ends"}


def nfl_players(game, tables, built) -> dict:
    """Each side's player with the best matchup: his fantasy points a game
    and main yards moved by what this defense allows his position, among its
    quarterback, top two backs by carries and top three targets."""
    from backend.sports.nfl import finder
    from backend.sports.nfl.services.nflverse import canonical_team
    data, rows = tables.get("league_data"), tables.get("rows") or []
    if not data or not rows:
        return {}
    usage, dvp = data.get("usage") or {}, data.get("dvp") or {}
    mine = defaultdict(list)
    info = {}
    for row in rows:
        if str(row.get("season_type") or "").upper() != "REG":
            continue
        mine[row.get("player_id")].append(row)
        info[row.get("player_id")] = row
    league_allowed = {}
    for position in NFL_SKILL:
        values = [((dvp.get(team) or {}).get(position) or {}).get("stats", {}) for team in dvp]
        fantasy = [v["fantasy"]["szn"][0] for v in values if v.get("fantasy", {}).get("szn")]
        yards = [v[NFL_SKILL[position][0]]["szn"][0] for v in values if v.get(NFL_SKILL[position][0], {}).get("szn")]
        league_allowed[position] = (sum(fantasy) / len(fantasy) if fantasy else None, sum(yards) / len(yards) if yards else None)
    result = {}
    for side, other in (("home", "away"), ("away", "home")):
        team, opponent = canonical_team(game[side]["abbr"]), canonical_team(game[other]["abbr"])
        out_names = {_key(entry["name"]) for entry in built["out"][side] if entry["out"]}
        candidates = []
        quarterback = (tables["qb"].get(team) or {}).get("id")
        by_team = [pid for pid, games in mine.items() if games and canonical_team(games[-1].get("team")) == team]
        backs = sorted((pid for pid in by_team if str(info[pid].get("position")).upper() == "RB"), key=lambda pid: -(usage.get(pid) or [0, 0])[1])[:2]
        catchers = sorted((pid for pid in by_team if str(info[pid].get("position")).upper() in ("WR", "TE")), key=lambda pid: -(usage.get(pid) or [0, 0])[0])[:3]
        for pid in ([quarterback] if quarterback in mine else []) + backs + catchers:
            if _key(info[pid].get("player_display_name")) in out_names:
                continue
            candidates.append(pid)
        best = None
        for pid in candidates:
            games, position = mine[pid], str(info[pid].get("position")).upper()
            stat, label = NFL_SKILL[position]
            fantasy = [v for g in games if (v := finder.prizepicks_fantasy(g)) is not None]
            yards = [_num(g.get(stat)) or 0 for g in games]
            if len(fantasy) < 2:
                continue
            spot = ((dvp.get(opponent) or {}).get(position) or {}).get("stats") or {}
            lg_fantasy, lg_yards = league_allowed[position]
            n = (dvp.get(opponent) or {}).get(position, {}).get("games") or 0
            factor = lambda found, base: 1 + ((found / base) - 1) * n / (n + 4) if found is not None and base else 1
            f_factor = factor((spot.get("fantasy") or {}).get("szn", [None])[0], lg_fantasy)
            y_factor = factor((spot.get(stat) or {}).get("szn", [None])[0], lg_yards)
            avg_f, avg_y = sum(fantasy) / len(fantasy), sum(yards) / len(yards)
            gain = avg_f * (f_factor - 1)
            if best is None or gain > best[0]:
                rank = (spot.get("fantasy") or {}).get("szn", [None, None])[1]
                best = (gain, pid, position, label, avg_f, avg_f * f_factor, avg_y, avg_y * y_factor, rank, usage.get(pid))
        if not best:
            continue
        gain, pid, position, label, avg_f, proj_f, avg_y, proj_y, rank, share = best
        teams_count = len(dvp) or 32
        why = []
        if rank and rank >= teams_count - 9:
            why.append(f"{opponent} allows the {ordinal(teams_count - rank + 1)} most fantasy points to {NFL_WORDS[position]}")
        if share and position in ("WR", "TE") and share[0] >= 0.18:
            why.append(f"Gets {share[0] * 100:.0f}% of {team}'s targets")
        if share and position == "RB" and share[1] >= 0.45:
            why.append(f"Gets {share[1] * 100:.0f}% of {team}'s carries")
        row = info[pid]
        result[side] = {"id": pid, "name": row.get("player_display_name") or row.get("player_name"), "position": position,
                        "headshot": row.get("headshot_url") or None, "team": game[side]["abbr"],
                        "avg": {"fantasy": round(avg_f, 1), "yards": round(avg_y, 1)},
                        "proj": {"fantasy": round(proj_f, 1), "yards": round(proj_y, 1)}, "yardsLabel": label,
                        "edge": round(gain, 1), "why": why}
    return result


# ------------------------------------------------------------------ v2 numbers

def _staged_sigma(fewest, stages) -> float:
    for upto, sigma in stages:
        if upto is None or fewest < upto:
            return sigma
    return stages[-1][1]


def _day_text(day) -> str:
    return f"{day:%b} {day.day}"


# This season only (Nov 6, the owner: "use mainly this seasons stats for
# defense and offensive rankings ... these are new teams"): each team's
# offense and defense from this season's games alone (the NBA per 100
# possessions, the NFL per game) with their league ranks, and its record and
# average margin at home and on the road. The model's ratings still start
# from last season and lean on this one more with every game; the ranks the
# page shows are this season's.
#
# Home edge (the owner: "don't just automatically give the team a plus for
# being at home: check are they performing well at home or better away"):
# half of how much better a team does at home than on the road this season,
# pulled toward the usual edge by HOME_SHRINK games (a few games prove
# little: about 5 at home and 5 away moves it a sixth of the way), the home
# team's and the visitor's averaged.
HOME_SHRINK = {"nba": 25, "nfl": 20}


def season_numbers(games, per_100) -> dict:
    """{team: {off, def, offRank, defRank, games, home {w, l, games, margin},
    away {...}}} from this season's finished games [(home, away, home
    points, away points, possessions)]."""
    rows = defaultdict(lambda: {"pts": 0.0, "opp": 0.0, "poss": 0.0, "games": 0,
                                "home": [0, 0, 0, 0.0], "away": [0, 0, 0, 0.0]})
    for home, away, home_pts, away_pts, poss in games:
        for team, own, other, venue in ((home, home_pts, away_pts, "home"), (away, away_pts, home_pts, "away")):
            row = rows[team]
            row["pts"] += own
            row["opp"] += other
            row["poss"] += poss or 0
            row["games"] += 1
            spot = row[venue]
            spot[0] += own > other
            spot[1] += own < other
            spot[2] += 1
            spot[3] += own - other
    out = {}
    for team, row in rows.items():
        base = row["poss"] / 100 if per_100 and row["poss"] else row["games"]
        out[team] = {"off": row["pts"] / base, "def": row["opp"] / base, "games": row["games"],
                     **{venue: {"w": row[venue][0], "l": row[venue][1], "games": row[venue][2],
                                "margin": row[venue][3] / row[venue][2] if row[venue][2] else None} for venue in ("home", "away")}}
    offense, defense = {team: row["off"] for team, row in out.items()}, {team: row["def"] for team, row in out.items()}
    for team, row in out.items():
        row["offRank"], row["defRank"] = _rank_of(offense, team), _rank_of(defense, team, high_first=False)
    return out


def team_profiles(games) -> dict:
    """{team: {season, last10, last5}} from this season's box scores: points
    scored and allowed per 100 possessions, possessions a game, and the four
    factors both ways (effective FG%, turnovers a possession, offensive
    rebound share, free throws per shot), with league ranks for the season;
    the last 10 games' same numbers, record and average margin."""
    from backend.sports.wnba import opportunity
    per = defaultdict(list)
    for g in games:
        lines = g.get("lines") or {}
        boxes = {team: opportunity.side_totals({"p": lines.get(team) or []}) for team in (g["home"], g["away"])}
        for team, other in ((g["home"], g["away"]), (g["away"], g["home"])):
            pts, allowed = (g["hs"], g["as"]) if team == g["home"] else (g["as"], g["hs"])
            per[team].append({"date": g["date"], "poss": g["poss"], "pts": pts, "opp": allowed, "own": boxes[team], "against": boxes[other],
                              "home": team == g["home"], "opponent": other})

    def summary(rows):
        poss = sum(row["poss"] for row in rows) or 1
        total = lambda side, key: sum(row[side][key] for row in rows)
        shots, shots_against = total("own", "fga") or 1, total("against", "fga") or 1
        return {"games": len(rows), "off": 100 * sum(row["pts"] for row in rows) / poss, "def": 100 * sum(row["opp"] for row in rows) / poss,
                "pace": poss / len(rows),
                "efg": (total("own", "fgm") + 0.5 * total("own", "tpm")) / shots,
                "efgAllowed": (total("against", "fgm") + 0.5 * total("against", "tpm")) / shots_against,
                "tov": total("own", "to") / poss, "tovForced": total("against", "to") / poss,
                "orb": total("own", "oreb") / ((total("own", "oreb") + total("against", "dreb")) or 1),
                "orbAllowed": total("against", "oreb") / ((total("against", "oreb") + total("own", "dreb")) or 1),
                "ftr": total("own", "fta") / shots, "ftrAllowed": total("against", "fta") / shots_against,
                "threeRate": total("own", "tpa") / shots, "threePct": total("own", "tpm") / (total("own", "tpa") or 1)}

    out = {}
    for team, rows in per.items():
        rows.sort(key=lambda row: row["date"])
        last = rows[-10:]
        wins = sum(1 for row in last if row["pts"] > row["opp"])
        out[team] = {"season": summary(rows),
                     "last10": {**summary(last), "w": wins, "l": len(last) - wins, "margin": sum(row["pts"] - row["opp"] for row in last) / len(last)},
                     "last5": [{"result": "W" if row["pts"] > row["opp"] else "L", "score": f"{row['pts']:.0f}-{row['opp']:.0f}",
                                "at": "home" if row["home"] else "away", "opponent": row["opponent"]} for row in rows[-5:]]}
    better_high = {"off": True, "def": False, "pace": True, "efg": True, "efgAllowed": False, "tov": False, "tovForced": True,
                   "orb": True, "orbAllowed": False, "ftr": True, "ftrAllowed": False, "threePct": True}
    for key, high in better_high.items():
        values = {team: profile["season"][key] for team, profile in out.items()}
        for team, profile in out.items():
            profile["season"].setdefault("ranks", {})[key] = _rank_of(values, team, high_first=high)
    return out


def own_home_edge(row, usual, shrink) -> float:
    """A team's own home edge: half its home margin less its road margin this season, pulled toward `usual`."""
    home, away = (row or {}).get("home") or {}, (row or {}).get("away") or {}
    if not home.get("games") or not away.get("games"):
        return usual
    raw = (home["margin"] - away["margin"]) / 2
    count = 2 / (1 / home["games"] + 1 / away["games"])
    return usual + count / (count + shrink) * (raw - usual)


def home_edge(season, home, away, usual, shrink) -> float:
    """Tonight's home edge in points: the home team's own and the visitor's, averaged, kept between half and twice the usual."""
    edge = (own_home_edge((season or {}).get(home), usual, shrink) + own_home_edge((season or {}).get(away), usual, shrink)) / 2
    return max(-usual / 2, min(2 * usual, edge))


def _with_home(sport, built, game, season, home, away, usual):
    """The model's flat home edge swapped for tonight's (home_edge), with the
    records behind it for the write-up."""
    rows = season or {}
    splits = lambda team: {venue: (rows.get(team) or {}).get(venue) for venue in ("home", "away")}
    built["homeInfo"] = {"home": splits(home), "away": splits(away), "usual": round(usual, 1)}
    if game.get("neutral"):
        built["homeInfo"]["edge"] = 0.0
        return built
    edge = home_edge(rows, home, away, usual, HOME_SHRINK[sport])
    delta = edge - usual
    built["margin"] += delta
    for scenario in built.get("scenarios") or []:
        scenario["ifOut"] += delta
    built["homeInfo"]["edge"] = round(edge, 1)
    record = lambda spot: f"{spot['w']}-{spot['l']}" if spot else None
    at_home, on_road = record(built["homeInfo"]["home"]["home"]), record(built["homeInfo"]["away"]["away"])
    for part in built.get("parts") or []:
        if part.get("key") == "home":
            part["points"] = round(edge, 1)
            part["text"] = " · ".join(text for text in (f"{home} {at_home} at home" if at_home else f"{home} at home",
                                                         f"{away} {on_road} on the road" if on_road else None) if text)
    return built


def nba_context(payload, prior, today) -> dict:
    """v2's NBA numbers as of `today` (games before it only): the ratings,
    each team's regulars, its results and what defenses allow each position."""
    import predictor_nba
    params = V2["nba"]
    games, index = predictor_nba.games_of(payload)
    players = (payload or {}).get("players") or {}
    past = [g for g in games if g["date"] < today]
    results = defaultdict(list)
    for g in past:
        results[g["home"]].append(g["hs"] > g["as"])
        results[g["away"]].append(g["as"] > g["hs"])
    return {"rt": predictor_nba.rate(games, today, params, prior),
            "seasonTable": season_numbers([(g["home"], g["away"], g["hs"], g["as"], g["poss"]) for g in past], per_100=True),
            "profiles": team_profiles(past),
            "states": predictor_nba.team_states(games, index, today, params, players),
            "dvp": predictor_nba.defense_by_position(games, index, players, today),
            "results": dict(results), "lastDate": past[-1]["date"] if past else None, "today": today, "prior": bool(prior)}


def _nba_v2_prior(season, load=None, store=None) -> dict | None:
    """Last season's v2 ratings at its end, shrunk toward average: worked out once and kept."""
    import predictor_nba
    key = PRIOR2_KEY.format(season=season)
    hit = _memory.get(key)
    if hit:
        return hit[1]
    store = _store() if store is None else store
    try:
        raw = store.get(key) if store else None
        if raw:
            value = json.loads(raw)
            _memory[key] = (time.time(), value)
            return value
    except Exception:  # noqa: BLE001
        pass
    if load is None:
        from backend.sports.wnba import league
        load = lambda: league.stored(season, "nba")
    payload = load()
    if not payload or not payload.get("games"):
        return None
    value = predictor_nba.season_prior(predictor_nba.games_of(payload)[0], V2["nba"])
    if value:
        _memory[key] = (time.time(), value)
        try:
            if store:
                store.set(key, json.dumps(value, separators=(",", ":")))
        except Exception:  # noqa: BLE001
            pass
    return value


def _nba_v2(now=None) -> dict:
    import predictor_nba
    from backend.sports.wnba import league
    now = now or datetime.now(timezone.utc)
    season = league.current_season(league="nba")
    payload = league.ensure(season, "nba") or {}
    today = predictor_nba.us_date(now)
    built = (season, payload.get("builtAt"), len(payload.get("games") or {}), today)
    hit = _memory.get("nba-v2")
    if hit and hit[1][0] == built and time.time() - hit[0] < TABLE_SECONDS:
        return hit[1][1]
    context = nba_context(payload, _nba_v2_prior(season - 1), today)
    _memory["nba-v2"] = (time.time(), (built, context))
    return context


def nba_model_v2(game, context) -> dict | None:
    """v2's NBA margin and total for one game (predictor_nba.predict), with
    the teams side by side, rest, the spread of finals for its win chance
    and its data warnings."""
    import predictor_nba
    params = V2["nba"]
    rt, states = context["rt"], context["states"]
    built = predictor_nba.predict(game, rt, states, params, _key)
    if not built:
        return None
    home, away = game["home"]["abbr"], game["away"]["abbr"]
    start = _when(game.get("startsAt"))
    day = predictor_nba.us_date(start) if start else context["today"]
    for side in ("home", "away"):
        for entry in built["out"][side]:
            entry["out"] = entry["kind"] == "out"
    rest = {side: predictor_nba.rest_of(states.get(game[side]["abbr"]), day, home) for side in ("home", "away")}
    played = {side: (states.get(game[side]["abbr"]) or {}).get("games", 0) for side in ("home", "away")}
    rated = [team for team in rt["off"] if (states.get(team) or {}).get("games")]
    ortg = {team: rt["mu"] + rt["off"][team] for team in rated}
    drtg = {team: rt["mu"] + rt["def"][team] for team in rated}
    pace = {team: rt["pace_mu"] + rt["pace"].get(team, 0.0) for team in rated}

    season = context.get("seasonTable") or {}

    def profile(side):
        abbr = game[side]["abbr"]
        results = (context["results"].get(abbr) or [])[-10:]
        offense, defense, speed = rt["mu"] + rt["off"][abbr], rt["mu"] + rt["def"][abbr], rt["pace_mu"] + rt["pace"].get(abbr, 0.0)
        mine = season.get(abbr) or {}
        if mine.get("games", 0) >= 3:  # this season's own numbers and ranks
            return {"ortg": [round(mine["off"], 1), mine["offRank"]], "drtg": [round(mine["def"], 1), mine["defRank"]],
                    "pace": [round(speed, 1), _rank_of(pace, abbr)], "net": round(mine["off"] - mine["def"], 1), "basis": "season",
                    "last10": [sum(results), len(results) - sum(results)] if len(results) >= 5 else None, "games": played[side]}
        return {"ortg": [round(offense, 1), _rank_of(ortg, abbr)], "drtg": [round(defense, 1), _rank_of(drtg, abbr, high_first=False)],
                "pace": [round(speed, 1), _rank_of(pace, abbr)], "net": round(offense - defense, 1),
                "last10": [sum(results), len(results) - sum(results)] if len(results) >= 5 else None, "games": played[side]}
    fewest = min(played.values())
    warnings = []
    if fewest < 10:
        team = home if played["home"] <= played["away"] else away
        warnings.append(_warn("medium", f"Early season: {team} has played {fewest} games, so its numbers still lean on last season."))
    if not context["prior"] and fewest < 25:
        warnings.append(_warn("medium", "Last season's numbers are missing, so early games count for more than they should."))
    if context["lastDate"] and (context["today"] - context["lastDate"]).days >= 3:
        warnings.append(_warn("medium", f"The box scores stop at {_day_text(context['lastDate'])}: newer games aren't counted yet."))
    for scenario in built["scenarios"]:
        other = away if scenario["team"] == home else home
        warnings.append(_warn("info", f"{scenario['name']} ({scenario['team']}) is {str(scenario['status'] or 'questionable').lower()}: "
                                      f"if he sits, about {scenario['impact']:.1f} points swing to {other}."))
    built.update({"rest": {side: (rest[side] or {}).get("days") for side in rest}, "restInfo": rest,
                  "teams": {"home": profile("home"), "away": profile("away")}, "leaguePace": rt["pace_mu"],
                  "sigma": _staged_sigma(fewest, params["sigma_by_games"]), "model": "v2", "warnings": warnings})
    # For the analysis: each team's profile, the model's own (schedule-adjusted) ratings and how fresh the box scores are.
    profiles = context.get("profiles") or {}
    built["profiles"] = {side: profiles.get(game[side]["abbr"]) for side in ("home", "away")}
    built["adjusted"] = {side: {"off": round(rt["mu"] + rt["off"][game[side]["abbr"]], 1), "def": round(rt["mu"] + rt["def"][game[side]["abbr"]], 1),
                                "net": round(rt["off"][game[side]["abbr"]] - rt["def"][game[side]["abbr"]], 1)} for side in ("home", "away")}
    built["boxScoresThrough"] = context["lastDate"].isoformat() if context.get("lastDate") else None
    return _with_home("nba", built, game, season, home, away, params["home"])


def nba_players_v2(game, context, built) -> dict:
    import predictor_nba
    found = predictor_nba.best_matchups(game, context["rt"], context["states"], context["dvp"], built, V2["nba"])
    for player in found.values():
        player["avg"] = player["season"]
    return found


def nfl_context(table, last, games, today, season) -> dict:
    """v2's NFL numbers as of `today`: the ratings (this season, last season's
    as the prior), every quarterback's value and each team's last kickoff."""
    import predictor_nfl
    params = V2["nfl"]
    rows = predictor_nfl.team_rows(table, games, before=today)
    last_rows = predictor_nfl.team_rows(last, games) if last else []
    prior = predictor_nfl.season_prior(last_rows, params)
    kickoffs = {}
    for game in games.values():
        if str(game.get("season")) == str(season) and game.get("final") and game.get("kickoff"):
            for team in (game["home"], game["away"]):
                kickoffs[team] = max(kickoffs.get(team) or 0, game["kickoff"])
    finals = [(game["home"], game["away"], _num(game.get("home_score")), _num(game.get("away_score")), None) for game in games.values()
              if str(game.get("season")) == str(season) and game.get("final") and str(game.get("game_type") or "REG").upper() == "REG"
              and _num(game.get("home_score")) is not None and _num(game.get("away_score")) is not None]
    return {"rt": predictor_nfl.rate(rows, today, params, prior), "seasonTable": season_numbers(finals, per_100=False),
            "values": predictor_nfl.qb_values([item for item in (last, table) if item], games, today, params),
            "table": table, "last": last, "games": games, "today": today, "season": season,
            "lastEnd": max(r[0] for r in last_rows) + timedelta(days=1) if last_rows else today,
            "lastKickoff": kickoffs, "builtAt": table.get("builtAt"), "prior": bool(prior)}


def _nfl_v2(now=None) -> dict | None:
    """v2's NFL numbers, or None until the daily cron has built this season's
    play-by-play table (a request can't wait on streaming it)."""
    now = now or datetime.now(timezone.utc)
    season, today = _nfl_season(now), (now - timedelta(hours=5)).date()

    def load():
        import nfl_team_epa
        from backend.sports.nfl import finder
        table = nfl_team_epa.stored(season)
        if not table:
            return None
        return nfl_context(table, nfl_team_epa.stored(season - 1), finder.games_index(), today, season)
    return _kept(f"nfl-v2:{season}:{today}", TABLE_SECONDS, load)


def nfl_model_v2(game, context, tables=None) -> dict | None:
    """v2's NFL margin for one game (predictor_nfl): schedule-adjusted EPA,
    success and points, home field, rest and tonight's quarterbacks against
    the ones the ratings saw. The total is the points ratings' (the line's is
    used when there is one)."""
    import predictor_nfl
    from backend.sports.nfl.services.nflverse import canonical_team
    params = V2["nfl"]
    rt, today = context["rt"], context["today"]
    home, away = canonical_team(game["home"]["abbr"]), canonical_team(game["away"]["abbr"])
    if home not in rt["epa"]["off"] or away not in rt["epa"]["off"]:
        return None
    injuries = game.get("injuries") or {}
    out, out_names = {}, {}
    for side, team in (("home", home), ("away", away)):
        out[side] = [{"name": item.get("name"), "position": item.get("position"), "status": item.get("status"),
                      "injury": item.get("injury"), "out": is_out(item.get("status")), "impact": 0.0}
                     for item in injuries.get(game[side]["abbr"]) or []]
        out_names[team] = {_short_key(entry["name"]) for entry in out[side] if entry["out"]}
    quarterbacks = {team: predictor_nfl.team_quarterbacks(context["table"], context["games"], team, today, params["half_life"])
                    for team in (home, away)}
    before = {team: predictor_nfl.team_quarterbacks(context["last"], context["games"], team, context["lastEnd"], params["half_life"])
              if context["last"] else {} for team in (home, away)}
    starters = {team: predictor_nfl.pick_starter(quarterbacks[team], before[team], out_names[team], _short_key) for team in (home, away)}
    healthy = {team: predictor_nfl.pick_starter(quarterbacks[team], before[team], set(), _short_key) for team in (home, away)}
    start = _when(game.get("startsAt"))
    rest = {}
    for side, team in (("home", home), ("away", away)):
        last = context["lastKickoff"].get(team)
        rest[side] = round((start.timestamp() - last) / 86400) if start and last and start.timestamp() > last else None
    rest_diff = (rest["home"] or 7) - (rest["away"] or 7)
    teams = {"home": home, "away": away, "neutral": game.get("neutral")}
    f = predictor_nfl.features(teams, rt, context["values"], quarterbacks, starters, rest_diff, {}, params)
    margin, total, parts = predictor_nfl.predict(f, params)
    if total is None:
        total = 2 * rt["pts"]["mu"] + f["pts_h"] + f["pts_a"]
    # A starting quarterback out: what he'd have been worth tonight.
    for side, team in (("home", home), ("away", away)):
        if healthy[team][0] and healthy[team][0] != starters[team][0]:
            whole = predictor_nfl.predict(predictor_nfl.features(teams, rt, context["values"], quarterbacks, {**starters, team: healthy[team]},
                                                                 rest_diff, {}, params), params)[0]
            for entry in out[side]:
                if entry["out"] and _short_key(entry["name"]) == _short_key(healthy[team][1]):
                    entry["impact"] = round(abs(whole - margin), 1)
        out[side].sort(key=lambda entry: (-entry["impact"], not entry["out"]))
    net = lambda team: rt["epa"]["off"].get(team, 0.0) - rt["epa"]["def"].get(team, 0.0)
    qb_text = lambda team: f"{team} {starters[team][1] or 'unknown'}" + (" (new)" if f["qbnew_h" if team == home else "qbnew_a"] else "")
    texts = {"ratings": f"EPA a play, offense less defense: {home} {net(home):+.2f}, {away} {net(away):+.2f}",
             "home": "Neutral site" if game.get("neutral") else f"{home} at home",
             "qb": f"{qb_text(away)} · {qb_text(home)}",
             "rest": f"{home} {rest['home'] or 7} days, {away} {rest['away'] or 7} days" if rest_diff else None}
    known = [team for team in rt["pts"]["off"] if rt["games"].get(team)]
    scored = {team: rt["pts"]["mu"] + rt["pts"]["off"][team] for team in known}
    allowed = {team: rt["pts"]["mu"] + rt["pts"]["def"][team] for team in known}
    epa_off = {team: rt["epa"]["off"][team] for team in known}
    epa_def = {team: rt["epa"]["def"][team] for team in known}
    table_now = context.get("seasonTable") or {}
    mine = lambda team: table_now.get(team) if (table_now.get(team) or {}).get("games", 0) >= 2 else None
    # Points a game this season and their ranks (the ratings' until a team has played 2 games).
    profile = lambda team: {"pf": [round(mine(team)["off"], 1), mine(team)["offRank"]] if mine(team) else
                                  [round(rt["pts"]["mu"] + rt["pts"]["off"].get(team, 0.0), 1), _rank_of(scored, team)],
                            "pa": [round(mine(team)["def"], 1), mine(team)["defRank"]] if mine(team) else
                                  [round(rt["pts"]["mu"] + rt["pts"]["def"].get(team, 0.0), 1), _rank_of(allowed, team, high_first=False)],
                            "basis": "season" if mine(team) else "ratings",
                            "epaOff": [round(rt["epa"]["off"].get(team, 0.0), 3), _rank_of(epa_off, team)],
                            "epaDef": [round(rt["epa"]["def"].get(team, 0.0), 3), _rank_of(epa_def, team, high_first=False)],
                            "games": rt["games"].get(team, 0), "qb": starters[team][1]}
    warnings = []
    for team in (home, away):
        qb, name, how = starters[team]
        if how == "unknown":
            warnings.append(_warn("high", f"{team}'s starting quarterback is unknown."))
        elif how == "last season":
            warnings.append(_warn("medium", f"{team}'s quarterback is a guess: {name} hasn't started for them this season."))
        elif f["qbnew_h" if team == home else "qbnew_a"]:
            warnings.append(_warn("info", f"{name} has thrown few of {team}'s passes this season: his value comes mostly from other games."))
        if rt["games"].get(team, 0) < 3:
            warnings.append(_warn("medium", f"Early season: {team} has played {rt['games'].get(team, 0)} games, so its numbers lean on last season."))
    built_at = _when(context.get("builtAt"))
    if built_at and start and (start - built_at).days >= 8:
        warnings.append(_warn("medium", f"The play-by-play stops at {_day_text(built_at)}: newer games aren't counted yet."))
    return _with_home("nfl", {"margin": margin, "total": total, "out": out, "rest": rest, "model": "v2", "sigma": params["sigma"], "warnings": warnings,
            "parts": [{"key": key, "label": label, "points": round(points, 1), "text": texts.get(key)} for key, label, points in parts],
            "teams": {"home": profile(home), "away": profile(away)},
            "plays": _nfl_pace((tables or {}).get("league_data"), home, away),
            "starters": {side: {"name": starters[team][1], "how": starters[team][2]} for side, team in (("home", home), ("away", away))},
            "qbOut": {side: healthy[team][1] for side, team in (("home", home), ("away", away))
                      if healthy[team][1] and starters[team][1] and healthy[team][1] != starters[team][1]}},
        game, table_now, home, away, params["margin"]["home"])


def _model(sport, game, now):
    """(built, players): v2's numbers, else the older model's, with a warning saying so."""
    reason = None
    try:
        if sport == "nba":
            context = _nba_v2(now)
            built = nba_model_v2(game, context)
            if built:
                return built, nba_players_v2(game, context, built)
            reason = "unrated"
        else:
            context = _nfl_v2(now)
            if context:
                try:
                    tables = _nfl_numbers(now)
                except Exception:  # noqa: BLE001 -- the player matchups and plays are left off
                    tables = None
                built = nfl_model_v2(game, context, tables)
                if built:
                    return built, (nfl_players(game, tables, built) if tables else {})
                reason = "unrated"
            else:
                reason = "no play-by-play table"
    except Exception as exc:  # noqa: BLE001 -- the older model stands in
        reason = type(exc).__name__
    if sport == "nba":
        tables = _nba_numbers(now)
        built = nba_model(game, tables)
        players = nba_players(game, tables, built) if built else {}
    else:
        tables = _nfl_numbers(now)
        built = nfl_model(game, tables)
        players = nfl_players(game, tables, built) if built else {}
    if built:
        built.update({"model": "v1", "fallback": reason,
                      "warnings": [_warn("medium", "Using the simpler model for this game: the newer ratings aren't ready.")]})
    return built, players


# ------------------------------------------------------------------ the prediction

def _erfinv(y: float) -> float:
    """The inverse error function (Winitzki's approximation, refined by two Newton steps)."""
    a = 0.147
    ln = math.log(1 - y * y)
    x = math.copysign(math.sqrt(math.sqrt((2 / (math.pi * a) + ln / 2) ** 2 - ln / a) - (2 / (math.pi * a) + ln / 2)), y)
    for _ in range(2):
        x -= (math.erf(x) - y) / (2 / math.sqrt(math.pi) * math.exp(-x * x))
    return x


def final_score(margin: float, total: float) -> tuple[int, int]:
    """(home, away) points: the total split by the margin, never a tie."""
    home, away = round((total + margin) / 2), round((total - margin) / 2)
    if home == away:
        home, away = (home + 1, away) if margin >= 0 else (home, away + 1)
    return home, away


def moneyline_ev(prices, chance) -> dict:
    """side -> {price, chance, ev, fair}: what one unit on that moneyline
    returns on average at this win chance (0.05: five cents a dollar), and
    the price that chance is worth."""
    out = {}
    for side in ("home", "away"):
        price, p = (prices or {}).get(side), (chance or {}).get(side)
        if price is None or abs(price) < 100 or p is None:
            continue
        profit = 100 / abs(price) if price < 0 else price / 100
        out[side] = {"price": price, "chance": round(p, 4), "ev": round(p * profit - (1 - p), 4), "fair": american(p)}
    return out


def _call(margin, total):
    """One prediction's shape: winner, chances, the margin, total and final score."""
    return {"margin": round(margin, 1), "total": round(total, 1) if total is not None else None, "winner": "home" if margin >= 0 else "away",
            "score": dict(zip(("home", "away"), final_score(margin, total))) if total is not None else None}


def confidence_of(blend, ours, market_margin, warnings):
    """(High / Medium / Low, why): how sure the blend is, whether our model
    and the line pick the same team, and the data warnings."""
    p = max(blend["chance"].values())
    split = ours is not None and market_margin is not None and (ours["margin"] >= 0) != (market_margin >= 0)
    severe = [item for item in warnings if item["level"] == "high"]
    worry = [item for item in warnings if item["level"] == "medium"]
    why = [f"{p * 100:.0f}% to win"]
    if ours is not None and market_margin is not None:
        why.append("Our model and the line pick different teams" if split else "Our model and the line pick the same team")
    if severe:
        why.append("A data warning")
    elif worry:
        why.append("Data to check")
    if severe or split or p < 0.57:
        return "Low", why
    if p >= 0.7 and not worry and (ours is None or market_margin is not None):
        return "High", why
    return "Medium", why


# ------------------------------------------------------------------ the story
# The Why tab's write-up in plain words (Nov 6, the owner: "for people who
# don't understand like odds ... easy to understand ... include defensive
# rankings, injuries only the injuries that matter"): who we pick and how
# often they'd win, against DraftKings' price; the offense against the
# defense with their league ranks; the player matchup to watch; who's out
# that matters; rest, home and form; and what the confidence means.
POSITION_PLURAL = {"PG": "point guards", "SG": "shooting guards", "SF": "small forwards", "PF": "power forwards", "C": "centers",
                   "G": "guards", "F": "forwards", "QB": "quarterbacks", "RB": "running backs", "WR": "receivers", "TE": "tight ends"}
NFL_KEY_SPOTS = ("QB", "RB", "WR", "TE")


def _the(made, side) -> str:
    team = made.get(side) or {}
    return f"the {team.get('short') or team.get('abbr') or side}"


def _whose(made, side) -> str:
    name = _the(made, side)
    return name + ("'" if name.endswith("s") else "'s")


def _cap(text) -> str:
    return text[:1].upper() + text[1:]


def _price_text(price) -> str:
    return "" if price is None else f"{int(price):+d}"


def _list_text(items) -> str:
    items = [item for item in items if item]
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1] if items else ""


def _team_line(made, win, lose) -> list:
    """The winner's offense against the loser's defense (and the other end),
    with their league ranks."""
    teams = made.get("teams") or {}
    w, l = teams.get(win) or {}, teams.get(lose) or {}
    league = "NBA" if made["sport"] == "nba" else "NFL"
    off_key, def_key = ("ortg", "drtg") if made["sport"] == "nba" else ("pf", "pa")
    unit = "points per 100 possessions" if made["sport"] == "nba" else "points a game"
    have = lambda row, key: isinstance(row.get(key), list) and row[key][0] is not None and row[key][1]
    if not all((have(w, off_key), have(w, def_key), have(l, off_key), have(l, def_key))):
        return []
    one = l[def_key][1] - w[off_key][1]   # the winner's offense against the loser's defense
    two = l[off_key][1] - w[def_key][1]   # the loser's offense against the winner's defense
    lines = []
    unit += " this season" if w.get("basis") == "season" else ""
    attack = (f"{_cap(_whose(made, win))} offense scores {w[off_key][0]:g} {unit} ({ordinal(w[off_key][1])} in the {league}), "
              f"and {_whose(made, lose)} defense allows {l[def_key][0]:g} ({ordinal(l[def_key][1])}).")
    hold = (f"On the other end, {_whose(made, lose)} offense ranks {ordinal(l[off_key][1])} against "
            f"{_whose(made, win)} {ordinal(w[def_key][1])}-ranked defense.")
    if one <= 0 and two <= 0:
        return [f"On paper {_the(made, lose)} rate a little better (offense {ordinal(l[off_key][1])}, defense "
                f"{ordinal(l[def_key][1])}, against {ordinal(w[off_key][1])} and {ordinal(w[def_key][1])}), so this pick leans "
                f"on who's out and where it's played."]
    if one >= two:
        lines.append(attack)
        if two > 0:
            lines.append(hold)
    else:
        lines.append(f"{_cap(_whose(made, win))} defense is the edge: it ranks {ordinal(w[def_key][1])} in the {league}, "
                     f"against {_whose(made, lose)} {ordinal(l[off_key][1])}-ranked offense.")
        if one > 0:
            lines.append(f"And {_whose(made, win)} offense ({ordinal(w[off_key][1])}) faces {_whose(made, lose)} "
                         f"{ordinal(l[def_key][1])}-ranked defense.")
    return [" ".join(lines)]


def _player_line(made, side, other, lead) -> str | None:
    player = (made.get("players") or {}).get(side)
    if not player or not player.get("name"):
        return None
    why = next(iter(player.get("why") or []), None)
    if why:
        abbr = (made.get(other) or {}).get("abbr") or ""
        if abbr and why.startswith(abbr + " "):
            # "WSH allows ..." reads "the Wizards allow ...".
            why = _the(made, other) + why[len(abbr):].replace(" allows ", " allow ", 1)
        why = why[0].lower() + why[1:] if why[:2] != why[:2].upper() else why
    proj, avg = player.get("proj") or {}, player.get("avg") or {}
    if made["sport"] == "nba" and proj.get("pts") is not None:
        number = f"We have him around {proj['pts']:g} points" + (f" (he averages {avg['pts']:g})." if avg.get("pts") is not None else ".")
    elif proj.get("yards") is not None and player.get("yardsLabel"):
        number = f"We have him around {proj['yards']:g} {str(player['yardsLabel']).lower()}."
    else:
        number = ""
    return " ".join(part for part in (f"{lead} {player['name']}" + (f": {why}." if why else "."), number) if part)


def _injury_lines(made, built) -> list:
    """Only who matters: players out who cost their team at least a point
    (the NBA), a starting quarterback out and skill players out (the NFL),
    and the questionable ones who'd swing the game."""
    out, lines = made.get("out") or {}, []
    for side, other in (("away", "home"), ("home", "away")):
        rows = out.get(side) or []
        if made["sport"] == "nba":
            gone = [row for row in rows if row.get("out") and (row.get("impact") or 0) >= 1]
            if gone:
                names = _list_text([row["name"] + (f" ({str(row['injury']).lower()})" if row.get("injury") else "") for row in gone[:3]])
                worth = sum(row["impact"] for row in gone)
                lines.append(f"{_cap(_the(made, side))} are without {names}, worth about {worth:.1f} points a game to them.")
            for row in rows:
                if not row.get("out") and row.get("kind") == "questionable" and (row.get("impact") or 0) >= 1.5:
                    lines.append(f"{row['name']} is questionable for {_the(made, side)}: if he sits, that's about "
                                 f"{row['impact']:.1f} more points for {_the(made, other)}.")
        else:
            starter = ((made.get("starters") or {}).get(side) or {}).get("name")
            missing = ((built or {}).get("qbOut") or {}).get(side)
            if missing and starter:
                lines.append(f"{_cap(_the(made, side))} are without their starting quarterback, {missing}, so "
                             f"{starter} starts. That's the biggest single thing that moves an NFL line.")
            gone = [row["name"] + (f" ({row['position']})" if row.get("position") else "") for row in rows
                    if row.get("out") and str(row.get("position") or "").upper() in NFL_KEY_SPOTS and row.get("name") != missing]
            if gone:
                lines.append(f"Also out for {_the(made, side)}: {_list_text(gone[:3])}.")
    if not lines and (out.get("home") is not None or out.get("away") is not None):
        lines.append("Nobody who matters is out on either side.")
    return lines


def _home_line(made, built) -> str | None:
    """Home court as it stands tonight: both teams' records where they play
    it this season and what that makes the home edge."""
    place = "home court" if made["sport"] == "nba" else "home field"
    if made.get("neutral"):
        return f"It's at a neutral site, so nobody gets {place}."
    info = (built or {}).get("homeInfo") or {}
    edge, usual = info.get("edge"), info.get("usual")
    if edge is None:
        home = {item.get("key"): item for item in made.get("factors") or []}.get("home")
        return (f"{_cap(_the(made, 'home'))} are at home, worth about {abs(home['points']):.1f} points."
                if home and abs(home.get("points") or 0) >= 0.5 else None)
    def split(spot, where):
        return f"{spot['w']}-{spot['l']} {where} ({spot['margin']:+.1f} a game)" if (spot or {}).get("games") else None
    # Each team where it plays tonight first, then its other split: the edge is how much better a team does at home than away.
    lines = []
    for side, first, second in (("home", ("home", "at home"), ("away", "away")), ("away", ("away", "on the road"), ("home", "at home"))):
        spots = info.get(side) or {}
        parts = [text for text in (split(spots.get(first[0]), first[1]), split(spots.get(second[0]), second[1])) if text]
        if parts:
            lines.append(f"{_cap(_the(made, side))}: {', '.join(parts)}.")
    if not lines:
        return f"{_cap(_the(made, 'home'))} are at home, worth about {edge:.1f} points."
    verdict = (f"So {place} counts more than usual tonight: about {edge:.1f} points (usually {usual:.1f})." if edge >= usual + 0.3 else
               f"So {place} counts less than usual tonight: about {edge:.1f} points (usually {usual:.1f})." if edge <= usual - 0.3 else
               f"So {place} counts about as usual: {edge:.1f} points.")
    return f"This season, {lines[0][0].lower()}{lines[0][1:]} " + " ".join(lines[1:] + [verdict])


def _form_line(made, side) -> str | None:
    """How a team has played its last 10 against its season (the NBA's box
    scores): said when the record or the net rating has swung."""
    profile = (made.get("profiles") or {}).get(side) or {}
    season, last = profile.get("season"), profile.get("last10")
    if not season or not last or (last.get("games") or 0) < 6 or (season.get("games") or 0) <= (last.get("games") or 0):
        return None
    net_season, net_last = season["off"] - season["def"], last["off"] - last["def"]
    swing = net_last - net_season
    record = f"{last['w']}-{last['l']}"
    if abs(swing) < 3 and 3 < last["w"] < 7:
        return None
    team = _cap(_the(made, side))
    trend = "better than" if swing > 0 else "worse than"
    end = "defense" if abs(last["def"] - season["def"]) >= abs(last["off"] - season["off"]) else "offense"
    cause = (f"their defense is allowing {last['def']:.1f} per 100 (season {season['def']:.1f})" if end == "defense"
             else f"their offense is scoring {last['off']:.1f} per 100 (season {season['off']:.1f})")
    return (f"{team} are {record} in their last {last['games']} ({last['margin']:+.1f} a game), playing {trend} their season: "
            f"a net rating of {net_last:+.1f} per 100 against {net_season:+.1f}, mostly because {cause}.")


def _extras(made, win, built=None) -> str | None:
    """Rest, home and form, a short sentence each."""
    lose = "away" if win == "home" else "home"
    bits = []
    rest = made.get("rest") or {}
    for side in (win, lose):
        days = rest.get(side)
        if made["sport"] == "nba" and days is not None and days <= 1:
            bits.append(f"{_cap(_the(made, side))} played last night, and tired legs usually cost about a point.")
    factors = {item.get("key"): item for item in made.get("factors") or []}
    if made["sport"] == "nfl" and factors.get("rest") and abs(factors["rest"].get("points") or 0) >= 0.3:
        rested = "home" if factors["rest"]["points"] > 0 else "away"
        days = (made.get("rest") or {})
        if days.get("home") and days.get("away"):
            tired = "away" if rested == "home" else "home"
            bits.append(f"{_cap(_the(made, rested))} had {days[rested]} days to rest, {_the(made, tired)} {days[tired]}.")
    form = ((made.get("teams") or {}).get(win) or {}).get("last10")
    if form and sum(form) >= 8 and (form[0] >= 7 or form[0] <= 3):
        bits.append(f"{_cap(_the(made, win))} have won {form[0]} of their last {sum(form)}.")
    else:
        games = (made.get("lastFive") or {}).get((made.get(win) or {}).get("abbr")) or []
        wins = sum(1 for game in games if game.get("result") == "W")
        if len(games) >= 4 and (wins >= 4 or wins <= 1):
            bits.append(f"{_cap(_the(made, win))} have won {wins} of their last {len(games)}.")
    return " ".join(bits) or None


def _confidence_line(made) -> str:
    win = made["winner"]
    p = made["chance"][win]
    ours, market = made.get("ours"), (made.get("market") or {}).get("chance")
    split = ours and market and (ours["chance"]["home"] >= 0.5) != (market["home"] >= 0.5)
    levels = {item.get("level") for item in made.get("warnings") or []}
    level = made.get("confidence") or "Medium"
    if level == "High":
        reason = "a clear favorite, our model and the betting line pick the same team, and nothing in the data needs checking"
    elif level == "Low":
        reason = ("our model and the betting line pick different teams" if split else
                  "something in the data needs checking first" if "high" in levels else "this one is close to a coin flip")
    else:
        reason = ("a real favorite, but not a lock" if "medium" not in levels else
                  "a favorite, with something in the data worth checking")
    upsets = f"about {max(1, round((1 - p) * 20))} times in 20" if p >= 0.9 else f"about {max(1, round((1 - p) * 10))} times in 10"
    return f"{level} confidence: {reason}. Even at {p * 100:.0f}%, they lose {upsets}."


def story(made, built=None) -> dict | None:
    """The Why tab's write-up: {headline, points [{key, text}]}."""
    win = made.get("winner")
    if win not in ("home", "away"):
        return None
    lose = "away" if win == "home" else "home"
    p = made["chance"][win]
    score = made.get("score") or {}
    headline = (f"We project {_the(made, win)} to beat {_the(made, lose)}"
                + (f", about {score[win]}-{score[lose]}." if score.get(win) is not None and score.get(lose) is not None else "."))
    points = []
    number = f"{p * 100:.0f}"
    often = f"about {round(p * 20)} games in 20" if p >= 0.945 else f"about {min(9, max(1, round(p * 10)))} games in 10"
    chance = f"That's {'an' if number.startswith('8') or number in ('11', '18') else 'a'} {number}% chance: {often}."
    market = made.get("market") or {}
    book = market.get("provider") or "The betting market"
    their = (market.get("chance") or {}).get(win)
    price = (market.get("moneyline") or {}).get(win)
    if their is not None:
        price_text = f" ({_price_text(price)})" if price is not None else ""
        gap = (p - their) * 100
        if their < 0.5:
            chance += (f" {book} has them as the underdog at {their * 100:.0f}%{price_text}, so this is us going against the market: "
                       f"a bigger payout if we're right.")
        elif gap >= 3:
            chance += f" {book} has them at {their * 100:.0f}%{price_text}, so we like them more than the market does. That's value."
        elif gap <= -3:
            chance += (f" {book} has them even higher, at {their * 100:.0f}%{price_text}: we agree on the winner, but the price is "
                       f"steep for what you'd win.")
        else:
            chance += f" {book} has them at {their * 100:.0f}%{price_text}, so we and the market agree."
    points.append({"key": "chance", "text": chance})
    for text in _team_line(made, win, lose):
        points.append({"key": "teams", "text": text})
    for side, other, lead in ((win, lose, "The matchup to watch is"), (lose, win, f"For {_the(made, lose)}, watch")):
        text = _player_line(made, side, other, lead)
        if text:
            points.append({"key": "player", "text": text})
    for text in _injury_lines(made, built):
        points.append({"key": "injuries", "text": text})
    for side in (win, lose):
        text = _form_line(made, side)
        if text:
            points.append({"key": "form", "text": text})
    home_text = _home_line(made, built)
    if home_text:
        points.append({"key": "home", "text": home_text})
    extra = _extras(made, win, built)
    if extra:
        points.append({"key": "extras", "text": extra})
    points.append({"key": "confidence", "text": _confidence_line(made)})
    return {"headline": headline, "points": points}


# ------------------------------------------------------------------ the analysis
# The Why tab's analyst write-up (Nov 7, the owner: "better detail tho like
# are the suns struggling etc", with a brief for a professional NBA
# analysis: the pick, offense vs defense, the matchup that matters, what
# could go wrong, injuries, moneyline value, a verdict). The numbers (the
# pick, implied and no-vig chances, edge, expected return, verdict) are
# worked out here and never by the model; Groq writes the words from a facts
# object made only of the app's own data, and a write-up that quotes a number
# the facts don't hold is thrown away (the plain story stands). NBA only.
ANALYSIS_SECONDS = 30 * 60
ANALYSIS_KEY = "krazy_data:predictor:v2:analysis:{sport}:{event}:{digest}"
ANALYST_BRIEF = """You are the lead NBA quantitative analyst for PropScout, a data-driven sports prediction platform.
Turn the app's NBA game projection, team statistics, player data, injury report and sportsbook odds (the FACTS below) into professional, insightful moneyline analysis.
Do not simply summarize statistics: explain WHY the numbers matter, HOW they interact, and WHAT could change the outcome.

Use ONLY the FACTS. Never invent player projections, injuries, betting lines, rankings, probabilities, records or any other number. Every number you write must appear in the FACTS (percentages may be written as in the FACTS). If something is missing, outdated or uncertain, say so plainly. If the data does not support a conclusion, leave it out.
Do not change the model's probability or score projection. Do not double-count home court: it is already in the model ("homeEdgePoints").
Rankings are 1 = best in the league for that stat. Treat short streaks as context, not proof. Prefer the model's schedule-adjusted ratings ("adjusted") and this season's numbers over raw rankings, and compare the last 10 games with the season to say whether a team is playing better or worse than its season ("is it struggling?").
Distinguish the likely winner from a good bet: "pick.verdict" and "pick.expectedReturnPerDollar" decide value; a high win chance alone is never value. If there is no positive expected return, say there is no betting edge. If the model and market agree, say the prediction is aligned with the market.
Key players: only those in "players" or "injuries"; positional numbers there already account for his minutes. Injuries: only the "injuries" list; never claim everyone important is healthy unless "injuries.reportChecked" is true and the lists are empty.
Style: a professional NBA analyst, natural, confident and precise, easy to understand; clear basketball language and causal explanations; no filler, no "anything can happen", no exaggeration. Plain text, no markdown, no bullet points.

Answer with one JSON object, these keys, each a string (paragraphs separated by a blank line):
"why": 2-3 paragraphs, WHY OUR MODEL FAVORS THEM (the strongest team-level advantages: efficiency, pace, shooting, turnovers, rebounding, free throws, recent form against the season, home and road, and how they interact).
"matchup": 1-2 paragraphs, THE MATCHUP THAT MATTERS (the most influential player or tactical matchup and why it decides the game).
"risk": 1-2 paragraphs, WHAT COULD GO WRONG (the underdog's 2-3 most realistic paths to an upset and the biggest uncertainty in the projection).
"injuries": 1 paragraph, INJURIES AND ROTATION IMPACT (say so if information is missing).
"value": 1 paragraph, MONEYLINE VALUE (the model against the market, the edge and the expected return from "pick").
"verdict": 2-3 sentences, FINAL VERDICT (the predicted winner, then the betting recommendation, kept separate)."""


def pick_block(made) -> dict | None:
    """THE PICK, worked out (never written by the model): the projected
    winner and score, the model's win chance, the moneyline, its implied
    chance with and without the book's margin, the edge (model less no-vig
    market), the expected return on $1 at the offered price and a verdict."""
    win = made.get("winner")
    if win not in ("home", "away"):
        return None
    lose = "away" if win == "home" else "home"
    market = made.get("market") or {}
    prices = market.get("moneyline") or {}
    p = made["chance"][win]
    price = prices.get(win)
    raw = {side: implied(prices.get(side)) for side in ("home", "away")}
    no_vig = (market.get("chance") or {}).get(win) if raw["home"] and raw["away"] else None
    dec = 1 + (price / 100 if price and price > 0 else 100 / abs(price)) if price else None
    expected = p * (dec - 1) - (1 - p) if dec else None
    other = prices.get(lose)
    other_dec = 1 + (other / 100 if other and other > 0 else 100 / abs(other)) if other else None
    other_expected = (1 - p) * (other_dec - 1) - p if other_dec else None
    verdict = ("Insufficient data" if expected is None else "Positive value" if expected > 0.02
               else "Fairly priced" if expected >= -0.02 else "Negative value")
    score = made.get("score") or {}
    return {"winner": (made.get(win) or {}).get("short") or (made.get(win) or {}).get("abbr"), "winnerSide": win,
            "score": {"winner": score.get(win), "loser": score.get(lose)} if score else None,
            "modelChance": round(p, 3), "modelAloneChance": (((made.get("ours") or {}).get("chance") or {}).get(win)),
            "moneyline": price, "underdogMoneyline": other, "book": market.get("provider"),
            "impliedChance": round(raw[win], 3) if raw[win] else None, "noVigChance": round(no_vig, 3) if no_vig is not None else None,
            "edge": round(p - no_vig, 3) if no_vig is not None else None,
            "expectedReturnPerDollar": round(expected, 3) if expected is not None else None,
            "underdogExpectedReturnPerDollar": round(other_expected, 3) if other_expected is not None else None,
            "verdict": verdict, "confidence": made.get("confidence")}


def _pct1(value):
    return None if value is None else round(value * 100, 1)


def _profile_facts(profile, adjusted):
    if not profile:
        return None
    season, last = profile.get("season") or {}, profile.get("last10") or {}
    ranks = season.get("ranks") or {}
    keep = lambda block: {"games": block.get("games"), "offRating": round(block["off"], 1), "defRating": round(block["def"], 1),
                          "netRating": round(block["off"] - block["def"], 1), "possessionsPerGame": round(block["pace"], 1),
                          "effectiveFgPct": _pct1(block["efg"]), "effectiveFgPctAllowed": _pct1(block["efgAllowed"]),
                          "turnoversPer100": _pct1(block["tov"]), "forcedTurnoversPer100": _pct1(block["tovForced"]),
                          "offensiveReboundPct": _pct1(block["orb"]), "offensiveReboundPctAllowed": _pct1(block["orbAllowed"]),
                          "freeThrowsPerShot": _pct1(block["ftr"]), "freeThrowsPerShotAllowed": _pct1(block["ftrAllowed"]),
                          "threePointAttemptShare": _pct1(block["threeRate"]), "threePointPct": _pct1(block["threePct"])}
    return {"season": {**keep(season), "leagueRanks": ranks}, "last10": {**keep(last), "record": f"{last.get('w')}-{last.get('l')}",
            "averageMargin": round(last.get("margin") or 0, 1)}, "last5": profile.get("last5"), "scheduleAdjusted": adjusted}


def analysis_facts(made, built=None) -> dict:
    """Everything the write-up may use, from the app's own data only."""
    teams = {side: {"name": (made.get(side) or {}).get("name"), "short": (made.get(side) or {}).get("short"),
                    "abbr": (made.get(side) or {}).get("abbr"), "record": (made.get(side) or {}).get("record"),
                    "profile": _profile_facts(((made.get("profiles") or {}).get(side)), ((made.get("adjusted") or {}).get(side))),
                    "restDays": (made.get("rest") or {}).get(side),
                    "homeRoad": ((made.get("homeInfo") or {}).get(side))} for side in ("home", "away")}
    factors = {item.get("key"): item for item in made.get("factors") or []}
    out = made.get("out") or {}
    injuries = {side: [{"name": row.get("name"), "status": row.get("status"), "injury": row.get("injury"),
                        "pointsWorthToTeam": row.get("impact")} for row in (out.get(side) or []) if (row.get("impact") or 0) >= 0.5 or row.get("out")][:6]
                for side in ("home", "away")}
    players = {side: {key: value for key, value in (player or {}).items() if key in ("name", "position", "proj", "avg", "why", "team")}
               for side, player in (made.get("players") or {}).items() if player}
    return {"matchup": {"away": teams["away"], "home": teams["home"], "neutralSite": made.get("neutral"), "startsAt": made.get("startsAt")},
            "pick": pick_block(made),
            "projection": {"marginHomeTeam": made.get("margin"), "total": made.get("total"), "score": made.get("score"),
                           "possessions": round(made["possessions"], 1) if made.get("possessions") else None,
                           "modelAlone": {key: (made.get("ours") or {}).get(key) for key in ("winner", "margin", "chance")} if made.get("ours") else None},
            "modelParts": [{"part": item.get("label"), "pointsTowardHome": item.get("points"), "detail": item.get("text")} for item in factors.values()],
            "homeEdgePoints": (factors.get("home") or {}).get("points"),
            "injuries": {**injuries, "reportChecked": out.get("home") is not None and out.get("away") is not None},
            "players": players, "warnings": [item.get("text") for item in made.get("warnings") or []],
            "confidence": {"level": made.get("confidence"), "reasons": made.get("confidenceWhy")},
            "dataNotes": {"boxScoresThrough": made.get("boxScoresThrough"), "gamesPlayed": {side: ((made.get("teams") or {}).get(side) or {}).get("games")
                                                                                          for side in ("home", "away")}}}


_NUMBER = re.compile(r"(?<![\w.])[-+\u2212]?\d+(?:\.\d+)?%?")


def _known_numbers(value, found=None) -> set:
    found = set() if found is None else found
    if isinstance(value, bool):
        return found
    if isinstance(value, (int, float)):
        for number in (value, value * 100, abs(value), abs(value) * 100):
            found.add(round(number, 1))
            found.add(round(number))
    elif isinstance(value, str):
        for token in _NUMBER.findall(value):
            number = float(token.replace("\u2212", "-").rstrip("%"))
            found.update({round(number, 1), round(number), round(abs(number), 1), round(abs(number))})
    elif isinstance(value, dict):
        for item in value.values():
            _known_numbers(item, found)
    elif isinstance(value, (list, tuple)):
        for item in value:
            _known_numbers(item, found)
    return found


def unverified_numbers(text, facts) -> list:
    """Numbers in the write-up the facts don't hold (small counts like "two"
    or "3 quarters" and years are let through)."""
    known = _known_numbers(facts)
    odd = []
    for token in _NUMBER.findall(str(text or "")):
        number = float(token.replace("\u2212", "-").rstrip("%"))
        bare = abs(number)
        if "%" not in token and "." not in token and (bare <= 12 or 2000 <= bare <= 2100):
            continue
        if not any(abs(bare - candidate) <= 0.11 for candidate in known if isinstance(candidate, (int, float))):
            odd.append(token)
    return odd


ANALYSIS_SECTIONS = ("why", "matchup", "risk", "injuries", "value", "verdict")


def write_analysis(facts, ask=None):
    """Groq's write-up of the facts ({section: text}), or None when it can't
    be had or quotes numbers the facts don't hold."""
    if ask is None:
        import slip_reader
        ask = lambda prompt: slip_reader._ask(slip_reader.TEXT_MODELS, prompt)
    prompt = ANALYST_BRIEF + "\n\nFACTS (JSON):\n" + json.dumps(facts, separators=(",", ":"), default=str)
    try:
        answer = ask(prompt)
    except Exception:  # noqa: BLE001
        return None
    if not isinstance(answer, dict):
        return None
    sections = {key: re.sub(r"[*#`]+", "", str(answer.get(key) or "")).strip() for key in ANALYSIS_SECTIONS}
    if sum(1 for text in sections.values() if text) < 4:
        return None
    if len(unverified_numbers(" ".join(sections.values()), facts)) > 2:
        return None
    return sections


def analysis(sport, event_id, now=None, store=None, ask=None) -> dict:
    """{pick, sections, source}: THE PICK worked out, and the analyst's
    sections (source "groq"), or none (source "plain": the page keeps its
    plain write-up). Kept ANALYSIS_SECONDS per game and facts."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    made = predict(sport, event_id, now=now)
    pick = pick_block(made)
    if sport != "nba":
        return {"pick": pick, "sections": None, "source": "plain"}
    facts = analysis_facts(made)
    digest = hashlib.sha1(json.dumps(facts, sort_keys=True, default=str).encode()).hexdigest()[:16]
    key = ANALYSIS_KEY.format(sport=sport, event=event_id, digest=digest)

    def load():
        nonlocal store
        if store is None:
            try:
                store = _store()
            except Exception:  # noqa: BLE001
                store = None
        try:
            raw = store.get(key) if store else None
            kept = json.loads(raw) if raw else None
            if kept and time.time() - float(kept.get("at", 0)) < ANALYSIS_SECONDS:
                return kept["sections"]
        except Exception:  # noqa: BLE001
            pass
        sections = write_analysis(facts, ask)
        if sections and store:
            try:
                store.set(key, json.dumps({"at": time.time(), "sections": sections}, separators=(",", ":")))
            except Exception:  # noqa: BLE001
                pass
        return sections
    sections = _kept(f"analysis:{key}", ANALYSIS_SECONDS, load)
    return {"pick": pick, "sections": sections, "source": "groq" if sections else "plain"}


def prediction(sport, game, built, players=None, now=None) -> dict:
    """The page's prediction for one game (game: _summary; built: the model's
    numbers): ours alone and ours blended with the line ("predictions"), the
    blend's winner, chances and score up front, the moneylines' expected
    value, the data warnings and a confidence level."""
    model, v2 = MODELS[sport], V2[sport]
    line = game.get("line") or {}
    market_margin = -line["spread"] if line.get("spread") is not None else None
    ours = None
    if built:
        sigma = built.get("sigma") or model["sigma"]
        home_p = phi(built["margin"] / sigma)
        ours = {**_call(built["margin"], built.get("total")), "chance": {"home": round(home_p, 4), "away": round(1 - home_p, 4)},
                "model": built.get("model", "v1")}
    # The blend: the line with our share of the difference (or whichever there is).
    if market_margin is not None and built:
        margin, sigma, weight = (1 - v2["ours"]) * market_margin + v2["ours"] * built["margin"], v2["market_sigma"], v2["ours"]
    elif market_margin is not None:
        margin, sigma, weight = market_margin, v2["market_sigma"], 0.0
    elif built:
        margin, sigma, weight = built["margin"], built.get("sigma") or model["sigma"], 1.0
    elif game.get("espn"):
        # ESPN's projection alone, as a margin.
        p = min(0.99, max(0.01, game["espn"]["home"]))
        margin, sigma, weight = model["sigma"] * math.sqrt(2) * _erfinv(2 * p - 1), model["sigma"], None
    else:
        return None
    total = line.get("total") if line.get("total") is not None else (built.get("total") if built else None)
    home_chance = phi(margin / sigma)
    chance = {"home": home_chance, "away": 1 - home_chance}
    blend = {**_call(margin, total), "chance": {side: round(value, 4) for side, value in chance.items()}, "weight": weight}
    winner = blend["winner"]
    market = None
    if line:
        # The moneylines' chances with the margin taken out, else the spread's.
        prices = line.get("moneyline") or {}
        home_p, away_p = implied(prices.get("home")), implied(prices.get("away"))
        market_chance = ({"home": home_p / (home_p + away_p), "away": away_p / (home_p + away_p)} if home_p and away_p
                         else {"home": phi(market_margin / v2["market_sigma"]), "away": 1 - phi(market_margin / v2["market_sigma"])}
                         if market_margin is not None else None)
        market = {**line, "chance": market_chance}
    prices = (market or {}).get("moneyline") or {}
    ev = {"blend": moneyline_ev(prices, blend["chance"]), "ours": moneyline_ev(prices, (ours or {}).get("chance"))}
    best = max((side for side, item in ev["blend"].items() if item["ev"] > 0), key=lambda side: ev["blend"][side]["ev"], default=None)
    ev["best"] = best
    warnings = list((built or {}).get("warnings") or [])
    if built and market_margin is None:
        warnings.append(_warn("medium", "No betting line yet: both predictions are our model alone."))
    elif not built and market_margin is not None:
        warnings.append(_warn("medium", "Our model couldn't rate this game: the prediction is the line's."))
    if built and market_margin is not None and abs(built["margin"] - market_margin) >= v2["disagree"]:
        warnings.append(_warn("high", f"Our model and the line are {abs(built['margin'] - market_margin):.1f} points apart: check for late news."))
    confidence, why = confidence_of(blend, ours, market_margin, warnings)
    # How many of the three views (ours alone, the market, ESPN's) pick the blend's winner.
    views = [view for view in ((ours or {}).get("chance", {}).get("home"), ((market or {}).get("chance") or {}).get("home"),
                               (game.get("espn") or {}).get("home")) if view is not None]
    agree = sum(1 for view in views if (view >= 0.5) == (winner == "home"))
    blow = model["blowout"]
    blowout = phi((abs(margin) - blow) / model["blowout_sigma"]) + phi((-abs(margin) - blow) / model["blowout_sigma"])
    team = lambda side: {key: (game[side] or {}).get(key) for key in ("abbr", "name", "short", "logo", "color", "alt", "record")}
    made = {"sport": sport, "id": game["id"], "startsAt": game.get("startsAt"), "state": game.get("state"), "detail": game.get("detail"),
            "venue": game.get("venue"), "neutral": bool(game.get("neutral")),
            "home": team("home"), "away": team("away"), "winner": winner,
            "chance": blend["chance"], "margin": blend["margin"], "total": blend["total"], "score": blend["score"],
            "predictions": {"ours": ours, "blend": blend}, "model": (built or {}).get("model") or "line",
            "market": market, "espn": game.get("espn"), "ours": ours, "ev": ev, "warnings": warnings,
            "blowout": {"chance": round(blowout, 3), "by": blow, "level": "High" if blowout >= 0.45 else "Medium" if blowout >= 0.3 else "Low"},
            "confidence": confidence, "confidenceWhy": why, "agree": [agree, len(views)],
            "factors": (built or {}).get("parts") or [], "teams": (built or {}).get("teams"), "out": (built or {}).get("out"),
            "rest": (built or {}).get("rest"), "pace": _pace(sport, built), "players": players or {},
            "starters": (built or {}).get("starters"),
            "profiles": (built or {}).get("profiles"), "adjusted": (built or {}).get("adjusted"), "homeInfo": (built or {}).get("homeInfo"),
            "boxScoresThrough": (built or {}).get("boxScoresThrough"), "possessions": (built or {}).get("poss"),
            "lastFive": game.get("lastFive") or {}, "madeAt": (now or datetime.now(timezone.utc)).isoformat()}
    try:
        made["story"] = story(made, built)
    except Exception:  # noqa: BLE001 -- the page shows the numbers without it
        made["story"] = None
    return made


def _pace(sport, built):
    if not built or not built.get("teams"):
        return None
    if sport == "nba":
        possessions, league = built["poss"], built["leaguePace"]
        diff = possessions - league
        return {"value": round(possessions, 1), "league": round(league, 1), "unit": "possessions",
                "level": "Fast" if diff >= 1.5 else "Slow" if diff <= -1.5 else "Average",
                "home": built["teams"]["home"]["pace"], "away": built["teams"]["away"]["pace"]}
    plays = built.get("plays")
    if not plays:
        return None
    combined = (plays["home"][0] + plays["away"][0]) / 2
    return {"value": round(combined, 1), "league": plays["league"], "unit": "plays a team",
            "level": "Fast" if combined - plays["league"] >= 2 else "Slow" if combined - plays["league"] <= -2 else "Average",
            "home": plays["home"], "away": plays["away"]}


def predict(sport, event_id, now=None, store=None) -> dict:
    """Predict one game (ESPN's event id). Nothing is kept: a member saves a
    pick (save_pick) when they want it in their history (Nov 6, the owner:
    "only if I add the prediction")."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)
    game = _summary(sport, event_id)
    if not game.get("home") or not game.get("away"):
        raise LookupError("That game isn't on ESPN's schedule.")
    try:
        built, players = _model(sport, game, now)
    except Exception:  # noqa: BLE001 -- the line and ESPN's projection still make a prediction
        built, players = None, {}
    found = prediction(sport, game, built, players, now)
    if not found:
        raise LookupError("There isn't enough on this game yet to predict it.")
    return found


def _still_to_start(found, now) -> bool:
    start = _when(found.get("startsAt"))
    return found.get("state") == "pre" and bool(start) and start > now


def snapshot(sport, now=None, store=None) -> dict:
    """The cron, twice a day: each game's market chance from the current
    lines, for its chart (sample_odds). No predictions are kept: the
    history is only the picks members save."""
    now = now or datetime.now(timezone.utc)
    store = _store() if store is None else store
    games = slate(sport, now)["games"]
    return {"sport": sport, "games": len(games), "sampled": sample_odds(sport, games, store=store, now=now)}


def _predict_many(sport, games, now, store):
    """[(prediction or None, error name or None)] for each game, four at a time."""
    try:  # The season's numbers once, before the games share them.
        _nba_v2(now) if sport == "nba" else _nfl_v2(now)
    except Exception:  # noqa: BLE001 -- each game falls back on its own
        pass

    def one(game):
        try:
            return predict(sport, game["id"], now=now, store=store), None
        except Exception as exc:  # noqa: BLE001 -- that game is left out
            return None, type(exc).__name__
    with ThreadPoolExecutor(max_workers=4) as pool:
        return list(pool.map(one, games))


# The board: every game still to start (the NBA's today and tomorrow, the
# NFL's week), at most this many, kept this long per league.
BOARD_GAMES = 16
BOARD_SECONDS = 5 * 60


def board_game(found) -> dict:
    """One game on the board (the page's best picks and parlay builder):
    the blend's chances, both moneylines and their value, its confidence,
    and whether it's held back (a high data warning, or no moneylines)."""
    team = lambda side: {key: found[side].get(key) for key in ("abbr", "short", "logo")}
    prices = ((found.get("market") or {}).get("moneyline")) or {}
    high = [item["text"] for item in found.get("warnings") or [] if item["level"] == "high"]
    priced = all(prices.get(side) is not None and abs(prices[side]) >= 100 for side in ("home", "away"))
    return {"id": found["id"], "sport": found["sport"], "startsAt": found["startsAt"], "home": team("home"), "away": team("away"), "winner": found["winner"],
            "chance": found["chance"], "prices": {side: prices.get(side) for side in ("home", "away")},
            "ev": {side: item["ev"] for side, item in ((found.get("ev") or {}).get("blend") or {}).items()},
            "score": found.get("score"), "confidence": found["confidence"], "model": found.get("model"),
            "held": "No moneyline yet" if not priced else high[0] if high else None}


def day_games(sport, day, now=None) -> list:
    """The games on one US date ("YYYYMMDD"): the NBA's scoreboard for that
    date; the NFL's this week and next (its scoreboard won't take a date
    range), on that date."""
    now = now or datetime.now(timezone.utc)

    def load():
        if sport == "nba":
            return [_event(sport, event) for event in _espn(sport, "/scoreboard", {"dates": day, "limit": 100}).get("events") or []]
        board_now = _espn(sport, "/scoreboard")
        games = [_event(sport, event) for event in board_now.get("events") or []]
        week, kind = (board_now.get("week") or {}).get("number"), (board_now.get("season") or {}).get("type")
        if week and kind:
            try:
                games += [_event(sport, event) for event in _espn(sport, "/scoreboard", {"week": week + 1, "seasontype": kind}).get("events") or []]
            except Exception:  # noqa: BLE001 -- this week's games stand
                pass
        return games
    games = with_dk(sport, _kept(f"day:{sport}:{day if sport == 'nba' else _us_day(now)}", SLATE_SECONDS, load))
    on_day = [game for game in games if game["home"] and game["away"] and (start := _when(game["startsAt"])) and _us_day(start) == day]
    return sorted({game["id"]: game for game in on_day}.values(), key=lambda game: game["startsAt"] or "")


def board(sport, now=None, store=None, day=None) -> dict:
    """{sport, day, games}: every game still to start predicted, soonest
    first: the slate's (the NBA's today and tomorrow, the NFL's week), or one
    US date's ("YYYYMMDD", the generator). Nothing is kept."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)

    def load():
        listed = day_games(sport, day, now) if day else slate(sport, now)["games"]
        games = [game for game in listed if game["state"] == "pre" and (start := _when(game["startsAt"])) and start > now]
        results = _predict_many(sport, games[:BOARD_GAMES], now, store)
        made = [found for found, _ in results if found and _still_to_start(found, now)]
        return {"sport": sport, "day": day, "games": [board_game(found) for found in made], "fetchedAt": now.isoformat()}
    return _kept(f"board:{sport}:{day or 'next'}", BOARD_SECONDS, load)


# ------------------------------------------------------------------ the history

def _store():
    try:
        from v2.board import store
        return store
    except Exception:  # noqa: BLE001
        return None


def _member_key(sport, member) -> str:
    return PICKS_KEY.format(member=re.sub(r"[^A-Za-z0-9_.:-]", "", str(member))[:80], sport=sport)


def _read(key, store):
    try:
        raw = store.get(key) if store else None
        value = json.loads(raw) if raw else []
        return value if isinstance(value, list) else []
    except Exception:  # noqa: BLE001
        return []


def _write(key, items, store, most=MAX_HISTORY):
    if store:
        store.set(key, json.dumps(items[:most], separators=(",", ":")))


def pick_entry(found, side, stake=None, now=None) -> dict:
    """A member's pick, as their history keeps it: the team they took, its
    moneyline then (and what a dollar returns), their stake if they gave
    one, our chances for that team (the blend and our model alone) and the
    market's, and the predicted winner and score at the time."""
    team = lambda key: {key2: found[key].get(key2) for key2 in ("abbr", "short", "logo", "color")}
    market = found.get("market") or {}
    price = (market.get("moneyline") or {}).get(side)
    ours = (found.get("predictions") or {}).get("ours")
    dec = (1 + price / 100 if price > 0 else 1 + 100 / abs(price)) if price is not None and abs(price) >= 100 else None
    return {"id": found["id"], "sport": found["sport"], "startsAt": found["startsAt"], "savedAt": (now or datetime.now(timezone.utc)).isoformat(),
            "home": team("home"), "away": team("away"), "side": side, "price": price, "dec": round(dec, 4) if dec else None,
            "stake": round(float(stake), 2) if stake else None, "chance": found["chance"][side],
            "ours": ours["chance"][side] if ours else None, "market": (market.get("chance") or {}).get(side),
            "winner": found["winner"], "score": found["score"], "spread": market.get("spread"), "result": None}


def save_pick(sport, member, event_id, side, stake=None, now=None, store=None) -> dict:
    """Keep a member's pick on a game still to start (one a game: a new one
    replaces it). Returns the entry kept."""
    if sport not in SPORTS or side not in ("home", "away"):
        raise ValueError("Pick a team.")
    if stake is not None and not (0 < float(stake) <= 1_000_000):
        raise ValueError("Enter an amount above zero.")
    now = now or datetime.now(timezone.utc)
    found = predict(sport, event_id, now=now)
    if not _still_to_start(found, now):
        raise LookupError("This game has started: picks close at tip-off.")
    store = _store() if store is None else store
    key = _member_key(sport, member)
    entry = pick_entry(found, side, stake, now)
    items = [item for item in _read(key, store) if item.get("id") != entry["id"]] + [entry]
    items.sort(key=lambda item: item.get("startsAt") or "", reverse=True)
    _write(key, items, store)
    return entry


def remove_pick(sport, member, event_id, store=None) -> bool:
    """Take back a pick on a game still to start."""
    store = _store() if store is None else store
    key = _member_key(sport, member)
    items = _read(key, store)
    kept = [item for item in items if not (item.get("id") == str(event_id) and not item.get("result"))]
    if len(kept) == len(items):
        return False
    _write(key, kept, store)
    return True


def final_of(summary):
    """(home points, away points) when ESPN's summary calls the game final, else None."""
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    if (((competition.get("status") or {}).get("type") or {}).get("state")) != "post":
        return None
    sides = {competitor.get("homeAway"): _num(competitor.get("score")) for competitor in competition.get("competitors") or []}
    if sides.get("home") is None or sides.get("away") is None:
        return None
    return int(sides["home"]), int(sides["away"])


def _finals(sport, event_ids):
    """{event id: (home points, away points)} for the games ESPN calls final,
    a summary each (the same request for both leagues; the NFL's scoreboard
    won't take every date form)."""
    def one(event_id):
        try:
            return event_id, final_of(_espn(sport, "/summary", {"event": event_id}))
        except Exception:  # noqa: BLE001 -- that game waits for the next look
            return event_id, None
    with ThreadPoolExecutor(max_workers=6) as pool:
        return {event_id: final for event_id, final in pool.map(one, event_ids) if final}


def settle(item, final) -> dict:
    """A pick's result once the game is final: right or wrong, and what it
    won or lost (its stake, and one unit, at the moneyline it was saved at)."""
    home, away = final
    winner = "home" if home > away else "away" if away > home else None
    result = {"home": home, "away": away, "winner": winner, "correct": winner is not None and item.get("side") == winner}
    if item.get("score"):
        result["miss"] = abs(item["score"]["home"] - home) + abs(item["score"]["away"] - away)
    dec = item.get("dec")
    if dec:
        # A tie returns the stake.
        result["units"] = 0.0 if winner is None else round(dec - 1, 4) if result["correct"] else -1.0
        if item.get("stake"):
            result["profit"] = round(item["stake"] * result["units"], 2)
    return {**item, "result": result}


def record_summary(items) -> dict:
    settled = [item for item in items if item.get("result") and item["result"].get("winner")]
    correct = sum(1 for item in settled if item["result"]["correct"])
    units = [item["result"]["units"] for item in items if (item.get("result") or {}).get("units") is not None]
    staked = [item for item in items if (item.get("result") or {}).get("profit") is not None]
    return {"games": len(settled), "correct": correct, "pct": correct / len(settled) if settled else None,
            "units": round(sum(units), 2) if units else None,
            "money": {"staked": round(sum(item["stake"] for item in staked), 2), "profit": round(sum(item["result"]["profit"] for item in staked), 2)}
            if staked else None,
            "pending": sum(1 for item in items if not item.get("result"))}


def history(sport, member, now=None, store=None, finals=None) -> dict:
    """{items, record}: a member's saved picks, newest first, the finished
    ones settled from ESPN's final scores."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)
    store = _store() if store is None else store
    key = _member_key(sport, member)
    items = _read(key, store)
    due = [item for item in items if not item.get("result") and (start := _when(item.get("startsAt")))
           and (now - start).total_seconds() >= SETTLE_AFTER[sport]]
    if due:
        found = (finals or _finals)(sport, [item["id"] for item in due][:SETTLE_MOST])
        changed = False
        for index, item in enumerate(items):
            if item in due and item["id"] in found:
                items[index] = settle(item, found[item["id"]])
                changed = True
        if changed:
            try:
                _write(key, items, store)
            except Exception:  # noqa: BLE001
                pass
    return {"sport": sport, "items": items[:80], "record": record_summary(items)}


# ------------------------------------------------------------------ the chart

def sample_odds(sport, games, store=None, now=None) -> int:
    """Each game's market chance (the moneylines with the margin taken out)
    added to its series when it moved or ODDS_EVERY has passed: the charts'
    history, from every fresh read of the lines (the slate, the cron, the
    chart itself). Returns how many series grew."""
    store = _store() if store is None else store
    if not store:
        return 0
    stamp = int((now or datetime.now(timezone.utc)).timestamp())
    grown = 0
    for game in games:
        line = game.get("line") or {}
        chance = (line.get("chance") or {}).get("home")
        if chance is None or game.get("state") == "post":
            continue
        key = ODDS_KEY.format(sport=sport, event=game["id"])
        series = _read(key, store)
        last = series[-1] if series else None
        if last and abs(last[1] - chance) < ODDS_MOVE and stamp - last[0] < ODDS_EVERY:
            continue
        prices = line.get("moneyline") or {}
        series.append([stamp, round(chance, 4), prices.get("home"), prices.get("away")])
        try:
            _write(key, series[-MAX_ODDS:], store, most=MAX_ODDS)
            grown += 1
        except Exception:  # noqa: BLE001 -- the next read tries again
            pass
    return grown


def _live_summary(sport, event_id):
    """ESPN's summary, read at most every LIVE_SECONDS: the line now, the
    state, and in a game its win probability after every play."""
    return _kept(f"live:{sport}:{event_id}", LIVE_SECONDS, lambda: _espn(sport, "/summary", {"event": event_id}))


def live_series(summary, starts_at=None, now=None) -> list:
    """ESPN's in-game win probability as [[epoch seconds, home chance]], one
    a play: each at its play's clock time where ESPN gives one, else spread
    evenly from the start to now."""
    points = (summary or {}).get("winprobability") or []
    if not points:
        return []
    clock = {}
    plays = list((summary or {}).get("plays") or [])
    for drive in (((summary or {}).get("drives") or {}).get("previous") or []) + [((summary or {}).get("drives") or {}).get("current") or {}]:
        plays += drive.get("plays") or []
    for play in plays:
        when = _when(play.get("wallclock"))
        if play.get("id") is not None and when:
            clock[str(play["id"])] = int(when.timestamp())
    start = _when(starts_at)
    first = int(start.timestamp()) if start else None
    last = int((now or datetime.now(timezone.utc)).timestamp())
    out = []
    for index, point in enumerate(points):
        chance = _num(point.get("homeWinPercentage"))
        if chance is None:
            continue
        stamp = clock.get(str(point.get("playId")))
        if stamp is None and first is not None:
            stamp = first + (last - first) * index // max(1, len(points) - 1)
        if stamp is not None:
            out.append([stamp, round(chance, 4)])
    out.sort(key=lambda item: item[0])
    return out


# A game on its own clock (Nov 8, the owner: "How could we make this better
# for live games?", the game-clock chart picked): each play's win chance at
# its time into the game, the quarters marked, so the line fills the chart
# as the game goes.
PERIODS = {"nba": (720, 300), "nfl": (900, 600)}   # a quarter, an overtime (seconds)


def _clock_seconds(text):
    text = str(text or "").strip()
    try:
        if ":" in text:
            minutes, seconds = text.split(":", 1)
            return int(minutes) * 60 + float(seconds)
        return float(text)
    except (TypeError, ValueError):
        return None


def game_elapsed(sport, period, clock) -> float | None:
    """Seconds into the game at a period and its clock (time left in it)."""
    quarter, extra = PERIODS[sport]
    period, left = _num(period), _clock_seconds(clock)
    if not period or period < 1 or left is None:
        return None
    period = int(period)
    if period <= 4:
        return (period - 1) * quarter + max(0.0, quarter - left)
    return 4 * quarter + (period - 5) * extra + max(0.0, extra - left)


def game_clock_series(sport, summary) -> dict | None:
    """{points [[seconds into the game, home chance]], length, periods
    [{at, label}], now}: ESPN's win probability on the game's own clock."""
    if sport not in PERIODS:
        return None
    probability = (summary or {}).get("winprobability") or []
    plays = list((summary or {}).get("plays") or [])
    for drive in (((summary or {}).get("drives") or {}).get("previous") or []) + [((summary or {}).get("drives") or {}).get("current") or {}]:
        plays += drive.get("plays") or []
    at = {}
    for play in plays:
        elapsed = game_elapsed(sport, (play.get("period") or {}).get("number"), (play.get("clock") or {}).get("displayValue"))
        if play.get("id") is not None and elapsed is not None:
            at[str(play["id"])] = elapsed
    points = []
    for point in probability:
        chance, elapsed = _num(point.get("homeWinPercentage")), at.get(str(point.get("playId")))
        if chance is not None and elapsed is not None:
            points.append([round(elapsed, 1), round(chance, 4)])
    points.sort(key=lambda item: item[0])
    if len(points) < 2:
        return None
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    status = competition.get("status") or {}
    quarter, extra = PERIODS[sport]
    period = int(_num(status.get("period")) or 1)
    state = (status.get("type") or {}).get("state")
    now = game_elapsed(sport, period, status.get("displayClock"))
    reach = max(points[-1][0], now or 0)
    overtimes = max(0, period - 4, 0 if reach <= 4 * quarter else int((reach - 4 * quarter - 1e-9) // extra) + 1)
    length = 4 * quarter + overtimes * extra
    periods = [{"at": index * quarter, "label": f"Q{index + 1}"} for index in range(4)]
    periods += [{"at": 4 * quarter + index * extra, "label": "OT" if overtimes == 1 else f"OT{index + 1}"} for index in range(overtimes)]
    return {"points": points, "length": length, "periods": periods, "now": length if state == "post" else now}


def chart(sport, event_id, now=None, store=None) -> dict:
    """One game's chance over time: the market's from its kept samples (and
    the line right now), and in a game ESPN's win probability after every
    play. The page reads it again every few seconds while the game is open."""
    if sport not in SPORTS:
        raise ValueError("Unknown sport")
    now = now or datetime.now(timezone.utc)
    store = _store() if store is None else store
    summary = _live_summary(sport, event_id)
    competition = ((summary.get("header") or {}).get("competitions") or [{}])[0]
    sides = {competitor.get("homeAway"): _competitor(competitor) for competitor in competition.get("competitors") or []}
    if not sides.get("home") or not sides.get("away"):
        raise LookupError("That game isn't on ESPN's schedule.")
    status = (competition.get("status") or {}).get("type") or {}
    game = with_dk(sport, [{"id": str(event_id), "state": status.get("state"), "startsAt": competition.get("date"), "home": sides["home"],
                            "away": sides["away"], "line": _line((summary.get("pickcenter") or [None])[0], sides)}])[0]
    line = game["line"]
    if line and status.get("state") != "post":
        sample_odds(sport, [game], store=store, now=now)
    series = _read(ODDS_KEY.format(sport=sport, event=event_id), store)
    live = live_series(summary, competition.get("date"), now) if status.get("state") in ("in", "post") else []
    clock = game_clock_series(sport, summary) if status.get("state") in ("in", "post") else None
    # In a game and after it: the feed, the swings, who won each stretch and
    # the players' props against their lines (game_live.py).
    extra = {}
    if status.get("state") in ("in", "post"):
        try:
            import game_live
            extra = game_live.extras(sport, summary, competition.get("date"), clock)
        except Exception:  # noqa: BLE001 -- the chart stands without them
            extra = {}
    opened = None
    if status.get("state") == "pre":
        try:  # The slate's lines (ESPN's scoreboard, kept 5 minutes) carry the opening moneylines.
            listed = next((item for item in slate(sport, now)["games"] if item["id"] == str(event_id)), None)
            prices = ((listed or {}).get("line") or {}).get("open")
            home_p, away_p = (implied(prices["home"]), implied(prices["away"])) if prices else (None, None)
            if home_p and away_p:
                opened = {"moneyline": prices, "market": round(home_p / (home_p + away_p), 4)}
        except Exception:  # noqa: BLE001 -- the chart stands without it
            opened = None
    team = lambda side: {key: sides[side].get(key) for key in ("abbr", "short", "logo", "color", "score")}
    return {"id": str(event_id), "sport": sport, "state": status.get("state"), "detail": status.get("shortDetail") or status.get("detail"),
            "startsAt": competition.get("date"), "home": team("home"), "away": team("away"),
            "market": [[point[0], point[1]] for point in series], "live": live,
            "source": (line or {}).get("source") or "espn", "open": opened, "clock": clock,
            "feed": extra.get("feed"), "swings": extra.get("swings"), "momentum": extra.get("momentum"), "props": extra.get("props"),
            "now": {"market": (line or {}).get("chance", {}).get("home") if line else None, "live": live[-1][1] if live else None,
                    "moneyline": (line or {}).get("moneyline"),
                    # In a game, whether the price is DraftKings' in-game one (else it's the pregame line).
                    "priceLive": bool((line or {}).get("source") == "draftkings" and (line or {}).get("inPlay"))},
            "updatedAt": now.isoformat()}
