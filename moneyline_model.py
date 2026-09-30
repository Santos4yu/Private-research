"""Krazy Data moneylines: who should win, what that is worth, and where to
get the best price for it.

The model starts from the market, not against it. Sharp sportsbooks set
moneylines from far more information than any public stat line, so the fair
chance of each side is their price with the margin taken out (Pinnacle
counted most; every book's when no sharp book has the game). Our own power ratings -- built only from results, so they are
a second, independent opinion -- may tilt that chance a little, never more
than MAX_TILT. A play is a price at a regular sportsbook that pays more than
that fair chance is worth: a real, measurable edge, not a hunch.

Every play is kept with the price it was posted at, the closing price and the
result (see the record functions below), so the model is judged the way a
sharp bettor is: did it beat the closing line, and did it win money.

Sources: The Odds API (one request per league covers every game and book),
ESPN's scoreboards (logos, records, starters, scores), and for the ratings
nflverse (NFL), MLB's stats service (MLB), the NHL's stats service (NHL) and
the stored WNBA season (WNBA). Nothing here costs more than the Odds API
credit per refresh.
"""
from __future__ import annotations

import json
import math
import os
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

VERSION = "ml-v1"
ODDS = "https://api.the-odds-api.com/v4"
ESPN = "https://site.api.espn.com/apis/site/v2/sports"

# Each league: its Odds API key, ESPN path, how many days ahead to show, and
# the numbers that turn a rating gap into a win chance -- home advantage and
# the spread of final margins, both in the league's own unit.
SPORTS = {
    "nfl": {"name": "NFL", "odds": "americanfootball_nfl", "espn": "football/nfl", "days": 7, "hfa": 1.5, "sd": 13.5, "unit": "points"},
    "mlb": {"name": "MLB", "odds": "baseball_mlb", "espn": "baseball/mlb", "days": 2, "hfa": 0.2, "sd": 4.3, "unit": "runs"},
    "nhl": {"name": "NHL", "odds": "icehockey_nhl", "espn": "hockey/nhl", "days": 2, "hfa": 0.15, "sd": 2.1, "unit": "goals"},
    "wnba": {"name": "WNBA", "odds": "basketball_wnba", "espn": "basketball/wnba", "days": 3, "hfa": 2.5, "sd": 11.5, "unit": "points"},
}
# Ten books is one Odds API credit. Sharp books set the fair price; the rest
# are where a member can actually bet.
SHARP = ("pinnacle", "betonlineag")
BOOKS = {
    "pinnacle": {"name": "Pinnacle", "weight": 3.0, "bettable": False},
    "betonlineag": {"name": "BetOnline", "weight": 1.5, "bettable": False},
    "draftkings": {"name": "DraftKings", "weight": 1.0, "bettable": True},
    "fanduel": {"name": "FanDuel", "weight": 1.0, "bettable": True},
    "betmgm": {"name": "BetMGM", "weight": 1.0, "bettable": True},
    "williamhill_us": {"name": "Caesars", "weight": 1.0, "bettable": True},
    "espnbet": {"name": "ESPN BET", "weight": 1.0, "bettable": True},
    "betrivers": {"name": "BetRivers", "weight": 1.0, "bettable": True},
    "fanatics": {"name": "Fanatics", "weight": 1.0, "bettable": True},
    "hardrockbet": {"name": "Hard Rock", "weight": 1.0, "bettable": True},
}

# How far our view (the ratings with the matchup, and ESPN's model) may move
# the market's chance, and how much of its disagreement it gets.
MAX_TILT = 0.035
TILT_WEIGHT = 0.3
# A play: the best price is worth at least this much at the model's chance,
# and at least break-even at the market's own (our ratings sharpen a play,
# they never make one against the market). Strong plays clear more on both
# and have the ratings on their side.
PLAY_EV = 0.02
STRONG_EV = 0.04
STRONG_MARKET_EV = 0.015
LEAN_EV = 0.01
# An MLB starter's usual innings. In the playoffs starters go shorter and the
# bullpen, pitching on consecutive days, decides more of the game.
STARTER_INNINGS = {"regular": 5.5, "postseason": 4.8}
# Long shots swing too much to call a play, however good the price.
LONGEST_PRICE = 400
# A quarter of the Kelly stake, in units of 1% of a bankroll.
KELLY_SHARE = 0.25
MIN_UNITS, MAX_UNITS = 0.5, 3.0

# Refreshes: a page view reuses odds this fresh; the timer refreshes a league
# this often when it has games coming, and closer to the start for closing
# prices. Below CREDIT_FLOOR remaining the timer stops spending.
ODDS_FRESH = 10 * 60
TIMER_REFRESH = 60 * 60
CLOSE_WINDOW = 45 * 60
CLOSE_REFRESH = 8 * 60
CREDIT_FLOOR = 300
TIMER_DAILY_CAP = 120
PLAYS_KEPT = 600

KEY = "krazy:ml:v1"
_memory: dict = {}


# ---------------------------------------------------------------- storage

def _store():
    from v2.board import store
    return store


def _load(name, default=None):
    try:
        raw = _store().get(f"{KEY}:{name}")
    except Exception:  # noqa: BLE001 -- no store (local runs): this instance's memory
        raw = None
    if raw:
        return json.loads(raw)
    return _memory.get(name, default)


def _save(name, value, ex=None):
    _memory[name] = value
    try:
        _store().set(f"{KEY}:{name}", json.dumps(value, separators=(",", ":")), ex=ex)
    except Exception:  # noqa: BLE001
        pass


# ---------------------------------------------------------------- prices

def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def decimal(american):
    """American odds as the decimal payout per 1 staked (stake included)."""
    if not finite(american) or american == 0 or -100 < american < 100:
        return None
    return 1 + (american / 100 if american > 0 else 100 / -american)


def american(probability):
    """The fair American price of a chance."""
    if not finite(probability) or not 0 < probability < 1:
        return None
    return round(-100 * probability / (1 - probability)) if probability >= 0.5 else round(100 * (1 - probability) / probability)


def devig(home_price, away_price):
    """Both sides' chances with the book's margin taken out (the power
    method: the k that makes p_home^k + p_away^k = 1), which keeps more of
    a favorite's chance than simply scaling would."""
    home, away = decimal(home_price), decimal(away_price)
    if not home or not away:
        return None
    a, b = 1 / home, 1 / away
    if a + b <= 1:
        return a / (a + b)
    low, high = 1.0, 20.0
    for _ in range(60):
        k = (low + high) / 2
        if a ** k + b ** k > 1:
            low = k
        else:
            high = k
    return a ** ((low + high) / 2)


def consensus(books):
    """The market's fair chance for the home side, with the margin taken
    out. The sharp books set it when they have the game (Pinnacle counted
    most): the rest of the market follows their prices, so a regular book
    paying more than them is a real edge. Without them every book counts.
    A book far from the rest (a stale or broken price) is left out."""
    fair = []
    for book in books:
        chance = devig(book.get("home"), book.get("away"))
        if chance is not None:
            fair.append((chance, BOOKS.get(book["key"], {}).get("weight", 1.0), book["key"]))
    if not fair:
        return None, []
    if len(fair) >= 4:
        ordered = sorted(value for value, _, _ in fair)
        middle = ordered[len(ordered) // 2]
        fair = [item for item in fair if abs(item[0] - middle) <= 0.06] or fair
    fair = [item for item in fair if item[2] in SHARP] or fair
    total = sum(weight for _, weight, _ in fair)
    return sum(value * weight for value, weight, _ in fair) / total, [key for _, _, key in fair]


def american_at_least(payout):
    """The shortest American price that pays at least this decimal payout."""
    if not finite(payout) or payout <= 1:
        return None
    if payout >= 2:
        return math.ceil(round((payout - 1) * 100, 6))
    price = -math.floor(round(100 / (payout - 1), 6))
    return price if price <= -100 else None


def best_price(books, side):
    """The best price a member can bet on this side, and where."""
    offers = [(book[side], book["key"]) for book in books
              if BOOKS.get(book["key"], {}).get("bettable") and decimal(book.get(side))]
    if not offers:
        return None
    price, key = max(offers, key=lambda offer: decimal(offer[0]))
    return {"price": price, "book": key, "bookName": BOOKS[key]["name"]}


def units(probability, price):
    """Quarter Kelly, in units of 1% of a bankroll, in half-unit steps."""
    payout = decimal(price)
    if not payout or payout <= 1:
        return 0
    edge = probability * payout - 1
    if edge <= 0:
        return 0
    stake = edge / (payout - 1) * KELLY_SHARE * 100
    return max(MIN_UNITS, min(MAX_UNITS, round(stake * 2) / 2))


# ---------------------------------------------------------------- names

def name_key(value):
    text = unicodedata.normalize("NFKD", str(value or "")).lower()
    return "".join(char for char in text if char.isalnum() and not unicodedata.combining(char))


def same_team(odds_name, full, short=None):
    """Does the Odds API's team name match ESPN's (or a ratings table's)?"""
    a, b = name_key(odds_name), name_key(full)
    if a and a == b:
        return True
    tail = name_key(short) if short else ""
    return bool(tail and len(tail) >= 4 and a.endswith(tail))


# ---------------------------------------------------------------- odds

def _odds_keys():
    keys = []
    try:
        from v2.board.store import get_odds_api_key_candidates
        keys = get_odds_api_key_candidates()
    except Exception:  # noqa: BLE001
        pass
    keys += [os.getenv("ODDS_API_KEY_V2", ""), os.getenv("ODDS_API_KEY", "")]
    return [key for key in dict.fromkeys(keys) if key]


def fetch_odds(sport):
    """Every game's moneyline at every book, in one request (one credit)."""
    config = SPORTS[sport]
    last = None
    for key in _odds_keys():
        try:
            response = requests.get(f"{ODDS}/sports/{config['odds']}/odds", timeout=15, params={
                "apiKey": key, "markets": "h2h", "oddsFormat": "american", "dateFormat": "iso",
                "bookmakers": ",".join(BOOKS)})
        except requests.RequestException:
            continue
        last = response.status_code
        if response.status_code in (401, 429):
            continue
        if not response.ok:
            raise RuntimeError("Moneylines are temporarily unavailable.")
        remaining = response.headers.get("x-requests-remaining")
        return response.json(), int(remaining) if str(remaining).isdigit() else None
    raise RuntimeError("The odds service is out of requests." if last == 429 else "Moneylines are temporarily unavailable.")


def parse_odds(events):
    """The Odds API's events as games: teams, start, and each book's two prices."""
    games = []
    for event in events or []:
        if not isinstance(event, dict) or not event.get("home_team") or not event.get("away_team"):
            continue
        home, away = event["home_team"], event["away_team"]
        books = []
        for book in event.get("bookmakers") or []:
            if book.get("key") not in BOOKS:
                continue
            market = next((item for item in book.get("markets") or [] if item.get("key") == "h2h"), None)
            prices = {outcome.get("name"): outcome.get("price") for outcome in (market or {}).get("outcomes") or []}
            if finite(prices.get(home)) and finite(prices.get(away)):
                books.append({"key": book["key"], "name": BOOKS[book["key"]]["name"], "home": prices[home], "away": prices[away],
                              "updated": book.get("last_update") or (market or {}).get("last_update")})
        if books:
            games.append({"id": event.get("id"), "startsAt": event.get("commence_time"), "homeName": home, "awayName": away,
                          "books": sorted(books, key=lambda book: list(BOOKS).index(book["key"]))})
    return games


# ---------------------------------------------------------------- ESPN

def _espn(path, params):
    response = requests.get(f"{ESPN}/{path}", params=params, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=10)
    response.raise_for_status()
    return response.json()


def _eastern(moment):
    # Eastern time without a timezone database: DST from the second Sunday
    # of March to the first Sunday of November.
    year = moment.year
    march = datetime(year, 3, 8, 7, tzinfo=timezone.utc)
    start = march + timedelta(days=(6 - march.weekday()) % 7)
    november = datetime(year, 11, 1, 6, tzinfo=timezone.utc)
    end = november + timedelta(days=(6 - november.weekday()) % 7)
    return moment - timedelta(hours=4 if start <= moment < end else 5)


def _scoreboard_day(sport, day, fresh=False):
    """One day of ESPN's scoreboard, kept five minutes."""
    key = f"scoreboard:{sport}:{day:%Y%m%d}"
    cached = _memory.get(key)
    if cached and not fresh and time.time() - cached[0] < 300:
        return cached[1]
    payload = _espn(f"{SPORTS[sport]['espn']}/scoreboard", {"dates": f"{day:%Y%m%d}", "limit": 100})
    _memory[key] = (time.time(), payload)
    return payload


def scoreboard(sport, first, last, fresh=False):
    """ESPN's games between two Eastern dates: teams (logo, record, starter),
    status and score. One request a day, side by side -- ESPN can answer a
    date range with no games at all. Fails only when every day does."""
    days = [first + timedelta(days=offset) for offset in range((last - first).days + 1)]

    def read(day):
        try:
            return _scoreboard_day(sport, day, fresh)
        except Exception:  # noqa: BLE001 -- the other days still count
            return None
    with ThreadPoolExecutor(max_workers=6) as pool:
        payloads = list(pool.map(read, days))
    if days and all(payload is None for payload in payloads):
        raise RuntimeError("ESPN's scoreboard is unavailable.")
    games, seen = [], set()
    for event in (event for payload in payloads for event in (payload or {}).get("events") or []):
        if event.get("id") in seen:
            continue
        seen.add(event.get("id"))
        competition = (event.get("competitions") or [{}])[0]
        sides = {}
        for team in competition.get("competitors") or []:
            info = team.get("team") or {}
            probable = (team.get("probables") or [{}])[0].get("athlete") or {}
            sides[team.get("homeAway")] = {
                "name": info.get("displayName"), "short": info.get("shortDisplayName") or info.get("name"),
                "abbr": info.get("abbreviation"), "logo": info.get("logo") or ((info.get("logos") or [{}])[0].get("href")),
                "record": ((team.get("records") or [{}])[0]).get("summary"), "score": team.get("score"),
                "winner": team.get("winner"), "probable": probable.get("displayName") or probable.get("fullName")}
        status = (competition.get("status") or event.get("status") or {}).get("type") or {}
        if "home" in sides and "away" in sides:
            games.append({"id": event.get("id"), "date": event.get("date"), "home": sides["home"], "away": sides["away"],
                          "state": status.get("state"), "completed": bool(status.get("completed")),
                          "detail": status.get("shortDetail") or status.get("detail"),
                          # Playoffs: the round and game ("AL Wild Card - Game 2") and the series ("NYY leads series 1-0").
                          "postseason": (event.get("season") or {}).get("type") == 3,
                          "note": ((competition.get("notes") or [{}])[0]).get("headline"),
                          "series": (competition.get("series") or {}).get("summary")})
    return games


def match_espn(game, espn_games):
    starts = _time(game.get("startsAt"))
    for item in espn_games:
        if not (same_team(game["homeName"], item["home"]["name"], item["home"]["short"])
                and same_team(game["awayName"], item["away"]["name"], item["away"]["short"])):
            continue
        when = _time(item.get("date"))
        if starts and when and abs((starts - when).total_seconds()) > 18 * 3600:
            continue
        return item
    return None


def _time(value):
    try:
        moment = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- ratings

def normal_cdf(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def srs(games, hfa, shrink, rounds=40):
    """Opponent-adjusted ratings (the simple rating system): a team's rating
    is its average margin, home edge removed, plus the average rating of the
    teams it played -- pulled toward zero by `shrink` games of an average
    team. `games` are (home, away, home_margin, weight)."""
    teams = {team for home, away, *_ in games for team in (home, away)}
    rating = dict.fromkeys(teams, 0.0)
    for _ in range(rounds):
        total, weights = dict.fromkeys(teams, 0.0), dict.fromkeys(teams, 0.0)
        for home, away, margin, weight in games:
            adjusted = margin - hfa
            total[home] += weight * (adjusted + rating[away])
            total[away] += weight * (-adjusted + rating[home])
            weights[home] += weight
            weights[away] += weight
        rating = {team: total[team] / (weights[team] + shrink) for team in teams}
        mean = sum(rating.values()) / len(rating) if rating else 0
        rating = {team: value - mean for team, value in rating.items()}
    return rating


def ranked(stats):
    """Each team's points (runs, goals) for and against a game, with ranks:
    1 scores the most, 1 allows the least."""
    teams = [team for team, row in stats.items() if finite(row.get("for")) and finite(row.get("against"))]
    by_for = sorted(teams, key=lambda team: -stats[team]["for"])
    by_against = sorted(teams, key=lambda team: stats[team]["against"])
    return {team: {**stats[team], "forRank": by_for.index(team) + 1, "againstRank": by_against.index(team) + 1, "teams": len(teams)}
            for team in teams}


def nfl_ratings(now):
    """NFL: opponent-adjusted margins from this season and last, recent games
    counting more (a game four months back counts half; last season a third
    as much again; a blowout counts as 21 at most), with each upcoming
    game's rest days, five seasons of meetings, and points for and against."""
    from backend.sports.nfl import finder
    season = now.year if now.month >= 3 else now.year - 1
    names = {}
    for year in range(season - 4, season + 1):
        names.update(finder.team_names(year))
    games, rest, meetings, scoring = [], {}, {}, {}
    for row in finder.schedule_rows():
        try:
            year = int(row.get("season") or 0)
        except (TypeError, ValueError):
            continue
        if year < season - 4 or str(row.get("game_type") or "").upper() not in finder.SEASON_KIND:
            continue
        home, away = names.get(finder.canonical_team(row.get("home_team"))), names.get(finder.canonical_team(row.get("away_team")))
        if not home or not away:
            continue
        try:
            home_score, away_score = float(row["home_score"]), float(row["away_score"])
        except (KeyError, TypeError, ValueError):
            if year == season:
                try:
                    rest[(name_key(home), name_key(away))] = (int(float(row.get("home_rest"))), int(float(row.get("away_rest"))))
                except (TypeError, ValueError):
                    pass
            continue
        pair = tuple(sorted((name_key(home), name_key(away))))
        meetings.setdefault(pair, []).append({"date": row.get("gameday"), "homeName": home, "awayName": away,
                                              "homeScore": home_score, "awayScore": away_score})
        if year >= season - 1:
            kickoff = _time(f"{row.get('gameday')}T17:00:00+00:00")
            age = (now - kickoff).days if kickoff else 365
            weight = 0.5 ** (max(age, 0) / 120) * (1.0 if year == season else 0.33)
            games.append((home, away, max(-21.0, min(21.0, home_score - away_score)), weight))
        bucket = scoring.setdefault(year, {})
        for team, scored, allowed in ((home, home_score, away_score), (away, away_score, home_score)):
            entry = bucket.setdefault(team, [0.0, 0.0, 0])
            entry[0] += scored
            entry[1] += allowed
            entry[2] += 1
    current = scoring.get(season) or {}
    base = current if current and min(entry[2] for entry in current.values()) >= 2 else {
        team: [a + b for a, b in zip(current.get(team, [0.0, 0.0, 0]), scoring.get(season - 1, {}).get(team, [0.0, 0.0, 0]))]
        for team in set(current) | set(scoring.get(season - 1) or {})}
    stats = {team: {"for": entry[0] / entry[2], "against": entry[1] / entry[2]} for team, entry in base.items() if entry[2]}
    for pair in meetings:
        meetings[pair] = sorted(meetings[pair], key=lambda item: item.get("date") or "", reverse=True)[:5]
    return {"teams": srs(games, SPORTS["nfl"]["hfa"], shrink=2.5), "rest": rest, "meetings": meetings, "stats": ranked(stats)}


def mlb_ratings(now):
    """MLB: run differential per game (pulled toward average by 40 games),
    each team's runs for and against, and tonight's starters, lineups and
    staffs (mlb_context) for the matchup factors."""
    from live_props_core import mlb
    import mlb_context
    season = now.year
    payload = mlb("/standings", {"leagueId": "103,104", "season": season, "standingsTypes": "regularSeason", "hydrate": "team"})
    teams, ids, stats, records = {}, {}, {}, {}
    for record in payload.get("records") or []:
        for row in record.get("teamRecords") or []:
            team = row.get("team") or {}
            played = float(row.get("gamesPlayed") or 0)
            if not team.get("name") or not played:
                continue
            splits = {item.get("type"): f"{item.get('wins')}-{item.get('losses')}"
                      for item in (row.get("records") or {}).get("splitRecords") or [] if item.get("type") in ("home", "away")}
            records[team["name"]] = {"id": str(team.get("id")), "abbr": team.get("abbreviation"), "short": team.get("teamName"),
                                     "total": f"{row.get('wins')}-{row.get('losses')}", "home": splits.get("home"), "road": splits.get("away")}
            scored, allowed = float(row.get("runsScored") or 0), float(row.get("runsAllowed") or 0)
            teams[team["name"]] = (scored - allowed) / played * played / (played + 40)
            ids[team["name"]] = str(team.get("id"))
            stats[team["name"]] = {"for": scored / played, "against": allowed / played}
    try:
        context = mlb_context.context()
    except Exception:  # noqa: BLE001 -- ratings still stand without starters
        context = {}
    return {"teams": teams, "ids": ids, "stats": ranked(stats), "records": records, "probables": context.get("probables") or {},
            "staffs": context.get("pitching") or {}, "hitting": context.get("hitting") or {}, "league": context.get("league") or {},
            "season": season}


def starter_edge(ratings, team, innings_share=STARTER_INNINGS["regular"]):
    """Runs a game the probable starter saves (or costs) against his own
    staff: ERA pulled toward the staff's by 40 innings, over his usual
    innings (five and a half; fewer in the playoffs)."""
    team_id = ratings.get("ids", {}).get(team)
    pitcher = ratings.get("probables", {}).get(team_id) if team_id else None
    staff = ratings.get("staffs", {}).get(team_id) if team_id else None
    if not pitcher or not staff or not finite(pitcher.get("era")) or not finite(staff.get("era")):
        return 0.0, pitcher
    innings = pitcher.get("ip") if finite(pitcher.get("ip")) else 0
    era = (pitcher["era"] * innings + staff["era"] * 40) / (innings + 40)
    return max(-0.9, min(0.9, (staff["era"] - era) * innings_share / 9)), pitcher


def nhl_ratings(now):
    """NHL: goal differential per game, this season pulled toward last
    season's (itself pulled a third of the way to average), with goals for
    and against a game."""
    import nhl_research
    season = nhl_research.season_id()
    tables, records = [], {}
    for year in (season, nhl_research.previous_season(season)):
        rows = nhl_research._stats("team/summary", f"seasonId={year} and gameTypeId=2", game=False)
        table = {}
        for row in rows or []:
            name = row.get("teamFullName")
            played = float(row.get("gamesPlayed") or 0)
            if name and played:
                table[name] = (float(row.get("goalsForPerGame") or 0), float(row.get("goalsAgainstPerGame") or 0), played)
                if year == season:
                    records[name] = {"total": f"{row.get('wins')}-{row.get('losses')}-{row.get('otLosses')}"}
        tables.append(table)
    current, previous = tables
    teams, stats = {}, {}
    for name in set(current) | set(previous):
        before = previous.get(name, (0.0, 0.0, 0))
        prior = (before[0] - before[1]) * 0.67
        scored, allowed, played = current.get(name, (0.0, 0.0, 0))
        teams[name] = ((scored - allowed) * played + prior * 25) / (played + 25)
        source = current[name] if played >= 5 else before
        if source[2]:
            stats[name] = {"for": source[0], "against": source[1]}
    return {"teams": teams, "stats": ranked(stats), "records": records}


def wnba_ratings(now):
    """WNBA: points scored less allowed per game (pulled toward average by 8
    games), from the stored season -- never built on a page view."""
    from backend.sports.wnba import context, league
    payload = league.stored(league.current_season())
    if not payload or not payload.get("games"):
        return {"teams": {}}
    table = context.team_stats(context.team_games(payload))
    names = {abbr: team.get("name") for abbr, team in (payload.get("teams") or {}).items()}
    teams, stats = {}, {}
    for abbr, row in table.items():
        played = row.get("games") or 0
        scored, allowed = (row.get("off") or {}).get("pts", [None])[0], (row.get("def") or {}).get("pts", [None])[0]
        if names.get(abbr) and played and finite(scored) and finite(allowed):
            teams[names[abbr]] = (scored - allowed) * played / (played + 8)
            stats[names[abbr]] = {"for": scored, "against": allowed}
    return {"teams": teams, "stats": ranked(stats)}

RATINGS = {"nfl": nfl_ratings, "mlb": mlb_ratings, "nhl": nhl_ratings, "wnba": wnba_ratings}


def ratings(sport, now):
    cached = _memory.get(f"ratings:{sport}")
    if cached and time.time() - cached[0] < 3 * 3600:
        return cached[1]
    try:
        value = RATINGS[sport](now)
    except Exception:  # noqa: BLE001 -- the market alone still prices the game
        value = {"teams": {}}
    _memory[f"ratings:{sport}"] = (time.time(), value)
    return value


def team_rating(table, name):
    """A team's rating by name: the exact name first, else the one whose
    nickname ends the other ("Athletics" / "Oakland Athletics")."""
    table = table or {}
    for team, value in table.items():
        if name_key(team) == name_key(name):
            return value, team
    found = [(value, team) for team, value in table.items()
             if same_team(name, team, team.split()[-1]) or same_team(team, name, name.split()[-1])]
    return found[0] if len(found) == 1 else (None, None)


# ---------------------------------------------------------------- the model

def _team_view(rated, context, side, team, espn_side):
    """One team's column in the matchup: record, home or road record, last
    five, scoring and allowing (with ranks), and the injury report."""
    stats = (rated.get("stats") or {}).get(team) if team else None
    records = (((context or {}).get("sides") or {}).get(side) or {}).get("records") or {}
    form = ((context or {}).get("form") or {}).get(side) or []
    return {"record": records.get("total") or (espn_side or {}).get("record"),
            "venueRecord": records.get("home" if side == "home" else "road"),
            "form": [{"result": game.get("result"), "score": game.get("score"), "opponent": game.get("opponent"), "home": game.get("home")}
                     for game in form],
            # No report read (no ESPN game page) is unknown, not "none listed".
            "stats": stats, "injuries": None if "injuries" not in (context or {}) else [
                player for player in (context["injuries"] or {}).get(side) or []
                if str(player.get("status") or "").lower() in ("out", "doubtful", "questionable", "day-to-day",
                                                               "injured reserve", "suspension")][:6]}


def read_game(sport, game, rated, espn=None, context=None, extras=None, opening=None):
    """One game, priced: the market's fair chance, our view (the ratings
    plus every matchup factor, blended with ESPN's own model), the best price
    on each side, the play (if any), and the matchup behind it."""
    import moneyline_matchup as matchup
    config = SPORTS[sport]
    extras = extras or {}
    fair, used = consensus(game["books"])
    out = {**game, "sport": sport, "fair": None, "model": None, "best": {}, "ev": {}, "pick": None, "reasons": [],
           "sharp": any(key in SHARP for key in used), "booksUsed": len(used), "target": None}
    if espn:
        out["espn"] = espn
    if fair is None:
        return out
    out["fair"] = {"home": fair, "away": 1 - fair, "homeOdds": american(fair), "awayOdds": american(1 - fair)}

    home_rating, home_team = team_rating(rated.get("teams"), game["homeName"])
    away_rating, away_team = team_rating(rated.get("teams"), game["awayName"])
    names = {"home": ((espn or {}).get("home") or {}).get("short") or game["homeName"],
             "away": ((espn or {}).get("away") or {}).get("short") or game["awayName"]}
    context = context or {}
    starts = _time(game.get("startsAt"))
    factors = []
    postseason = bool((espn or {}).get("postseason"))
    innings = STARTER_INNINGS["postseason" if postseason else "regular"]

    def add(item):
        if item and finite(item.get("margin")) and abs(item["margin"]) >= 0.005:
            factors.append(item)

    # The matchup, factor by factor -- each a small change to the margin.
    if sport == "mlb":
        total, notes = 0.0, []
        for side, team in (("home", home_team), ("away", away_team)):
            edge, pitcher = starter_edge(rated, team, innings) if team else (0.0, None)
            if pitcher and pitcher.get("name") and abs(edge) >= 0.05:
                total += edge if side == "home" else -edge
                notes.append(f"{pitcher['name']} ({pitcher['era']:.2f} ERA) {'saves' if edge > 0 else 'costs'} {names[side]} "
                             f"{abs(edge):.2f} runs against their usual starter")
        if notes:
            add(matchup.factor("starter", "Starting pitchers", total, "; ".join(notes)))
        ids = rated.get("ids") or {}
        home_id, away_id = ids.get(home_team), ids.get(away_team)
        # The bullpen's share of the game, and the starter's, against a regular-season game's.
        add(matchup.bullpen(extras.get("bullpens"), home_id, away_id, names,
                            weight=(9 - innings) / (9 - STARTER_INNINGS["regular"])))
        add(matchup.platoon(extras.get("platoon") or {}, rated.get("hitting") or {}, rated.get("probables") or {}, home_id, away_id, names,
                            share=0.6 * innings / STARTER_INNINGS["regular"]))
    if sport == "nfl":
        rest_days = (rated.get("rest") or {}).get((name_key(game["homeName"]), name_key(game["awayName"])))
        if rest_days and rest_days[0] != rest_days[1]:
            rested = "home" if rest_days[0] > rest_days[1] else "away"
            add(matchup.factor("rest", "Rest", max(-2.0, min(2.0, 0.3 * (rest_days[0] - rest_days[1]))),
                               f"{names[rested]} have {abs(rest_days[0] - rest_days[1])} more days of rest"))
        elif context:
            add(matchup.rest(sport, context, starts, names))
    elif context:
        add(matchup.rest(sport, context, starts, names))
    if context:
        ratings_by_side = {"home": home_rating, "away": away_rating}
        # A playoff team's last five include the season's final days, when
        # clinched teams rest their regulars: shown, but not counted.
        if not (sport == "mlb" and postseason):
            add(matchup.form(sport, context, ratings_by_side))
        add(matchup.splits(sport, context, config["sd"]))
        add(matchup.injuries(sport, context, names))
    if sport == "nhl" and extras.get("goalies"):
        tired = {(item.get("detail") or {}).get("tired"): True for item in factors if item["key"] == "rest"}
        add(matchup.goalie(extras["goalies"], home_team, away_team, tired, names))

    # Head to head: nflverse's last five meetings, else this season's series.
    meetings = []
    if sport == "nfl":
        for meeting in (rated.get("meetings") or {}).get(tuple(sorted((name_key(game["homeName"]), name_key(game["awayName"])))), []):
            meetings.append({**meeting, "homeIsHome": name_key(meeting["homeName"]) == name_key(game["homeName"]),
                             "home": meeting["homeName"], "away": meeting["awayName"]})
    elif context.get("series"):
        home_abbr = ((context.get("sides") or {}).get("home") or {}).get("abbr")
        meetings = [{**meeting, "homeIsHome": meeting.get("home") == home_abbr} for meeting in context["series"].get("meetings") or []]

    base = None
    if home_rating is not None and away_rating is not None:
        base = home_rating - away_rating + config["hfa"]
        add(matchup.head_to_head(sport, meetings, game["homeName"], base))
    margin = None if base is None else base + sum(item["margin"] for item in factors)

    # Our view: the ratings with the matchup, and ESPN's own model.
    rating_chance = normal_cdf(margin / config["sd"]) if margin is not None else None
    outside = (context.get("predictor") or {}).get("home")
    views = [value for value in (rating_chance, outside) if value is not None]
    chance = fair
    tilt = 0.0
    if views:
        opinion = sum(views) / len(views)
        tilt = max(-MAX_TILT, min(MAX_TILT, TILT_WEIGHT * (opinion - fair)))
        chance = fair + tilt
    text = None
    if margin is not None:
        leader = game["homeName"] if margin >= 0 else game["awayName"]
        text = (f"Our ratings with the matchup have {leader} by {abs(margin):.1f} {config['unit']} "
                f"({round(max(rating_chance, 1 - rating_chance) * 100)}%)")
    out["model"] = {"home": chance, "away": 1 - chance, "ratingHome": rating_chance, "espnHome": outside, "margin": margin,
                    "base": base, "tilt": tilt, "text": text}
    out["matchup"] = {
        "factors": factors, "unit": config["unit"],
        "espn": context.get("predictor"),
        "teams": {side: _team_view(rated, context, side, team, (espn or {}).get(side))
                  for side, team in (("home", home_team), ("away", away_team))},
        "h2h": {"summary": (context.get("series") or {}).get("summary") if sport != "nfl" else None, "meetings": meetings[:5]},
        "movement": {"open": opening.get("home"), "openedAt": opening.get("at")} if opening else None,
    }
    if sport == "mlb":
        ids = rated.get("ids") or {}
        for side, team in (("home", home_team), ("away", away_team)):
            team_id = ids.get(team)
            view = out["matchup"]["teams"][side]
            view["starter"] = (rated.get("probables") or {}).get(team_id)
            usage = (extras.get("bullpens") or {}).get(team_id)
            view["bullpen"] = round(usage["innings"], 1) if usage else None
    if sport == "nhl":
        goalie = next((item for item in factors if item["key"] == "goalies"), None)
        for note in ((goalie or {}).get("detail") or {}).get("goalies") or []:
            out["matchup"]["teams"][note["side"]]["goalie"] = note
    notes = [item["text"] for item in factors if item.get("text")]

    best_side = None
    out["marketEv"] = {}
    for side in ("home", "away"):
        offer = best_price(game["books"], side)
        probability = chance if side == "home" else 1 - chance
        if not offer:
            continue
        out["best"][side] = offer
        out["ev"][side] = probability * decimal(offer["price"]) - 1
        out["marketEv"][side] = (fair if side == "home" else 1 - fair) * decimal(offer["price"]) - 1
        if best_side is None or out["ev"][side] > out["ev"][best_side]:
            best_side = side

    if best_side:
        ev, market_ev = out["ev"][best_side], out["marketEv"][best_side]
        offer = out["best"][best_side]
        probability = chance if best_side == "home" else 1 - chance
        tilt = out["model"]["tilt"] * (1 if best_side == "home" else -1)
        tier = None
        if ev >= STRONG_EV and market_ev >= STRONG_MARKET_EV and tilt >= -0.005 and out["sharp"] and len(game["books"]) >= 3:
            tier = "strong"
        elif ev >= PLAY_EV and market_ev >= 0 and tilt >= -0.01 and len(game["books"]) >= 3:
            tier = "play"
        elif ev >= LEAN_EV and market_ev >= -0.01:
            tier = "lean"
        if tier in ("strong", "play") and offer["price"] > LONGEST_PRICE:
            tier = "lean"
        if tier:
            team = game["homeName"] if best_side == "home" else game["awayName"]
            out["pick"] = {"side": best_side, "team": team, "tier": tier, "ev": ev, "price": offer["price"], "book": offer["book"],
                           "bookName": offer["bookName"], "probability": probability, "fairOdds": american(probability),
                           "units": units(probability, offer["price"]) if tier != "lean" else 0}

    # Not a play yet: the price that would make one, on the side closest to it.
    if not out["pick"] or out["pick"]["tier"] == "lean":
        targets = []
        for side in ("home", "away"):
            offer = out["best"].get(side)
            sign = 1 if side == "home" else -1
            if not offer or out["model"]["tilt"] * sign < -0.01:
                continue
            fair_side, chance_side = (fair, chance) if side == "home" else (1 - fair, 1 - chance)
            price = american_at_least(max(1 / fair_side, (1 + PLAY_EV) / chance_side))
            if price is None or price > LONGEST_PRICE:
                continue
            gap = 1 / decimal(offer["price"]) - 1 / decimal(price)
            if gap > 0:
                targets.append({"side": side, "price": price, "best": offer["price"], "bookName": offer["bookName"], "gap": gap})
        out["target"] = min(targets, key=lambda item: item["gap"]) if targets else None

    # Why, in numbers.
    reasons = []
    fair_side = fair if (best_side or "home") == "home" else 1 - fair
    side_name = game["homeName"] if (best_side or "home") == "home" else game["awayName"]
    source = " and ".join(BOOKS[key]["name"] for key in used) if out["sharp"] else f"{len(used)} books"
    reasons.append(f"The market has {side_name} at {round(fair_side * 100)}% (fair {_signed(american(fair_side))}), from {source}.")
    if out.get("pick"):
        pick = out["pick"]
        reasons.append(f"{pick['bookName']} pays {_signed(pick['price'])}: worth {pick['ev'] * 100:+.1f}% at a "
                       f"{round(pick['probability'] * 100)}% chance.")
    agree = out["model"]["tilt"] * (1 if (best_side or "home") == "home" else -1)
    verdict = "; together they back this side." if agree >= 0.005 else "; together they lean the other way." if agree <= -0.005 \
        else ", close to the market."
    views = [out["model"]["text"]] if out["model"].get("text") else []
    if out["model"].get("espnHome") is not None:
        espn_side = out["model"]["espnHome"] if (best_side or "home") == "home" else 1 - out["model"]["espnHome"]
        views.append(f"ESPN's model has {side_name} at {round(espn_side * 100)}%")
    if views:
        reasons.append(". ".join(views) + verdict)
    reasons.extend(notes)
    out["reasons"] = reasons
    return out


def _signed(price):
    return "—" if price is None else f"+{price}" if price > 0 else str(price)


# ---------------------------------------------------------------- the board

def board(sport, force=False, now=None):
    """Every upcoming game of one league, priced, with plays recorded."""
    if sport not in SPORTS:
        raise ValueError("Unknown league.")
    now = now or datetime.now(timezone.utc)
    snapshot = _load(f"odds:{sport}")
    fetched = False
    if force or not snapshot or time.time() - snapshot.get("at", 0) > ODDS_FRESH:
        events, remaining = fetch_odds(sport)
        snapshot = {"at": time.time(), "events": events, "remaining": remaining}
        _save(f"odds:{sport}", snapshot, ex=6 * 3600)
        if remaining is not None:
            _save("credits", {"remaining": remaining, "at": time.time()})
        fetched = True
    games = parse_odds(snapshot.get("events"))
    horizon = now + timedelta(days=SPORTS[sport]["days"])
    games = [game for game in games if (_time(game["startsAt"]) or now) <= horizon]

    espn_games = []
    try:
        first = _eastern(now).date()
        espn_games = scoreboard(sport, first - timedelta(days=1), _eastern(horizon).date())
    except Exception:  # noqa: BLE001 -- logos and records are extras
        pass
    rated = ratings(sport, now)
    matched = {game["id"]: match_espn(game, espn_games) for game in games}
    import moneyline_matchup
    pages = moneyline_matchup.contexts(sport, SPORTS[sport]["espn"], [(item or {}).get("id") for item in matched.values()])
    extras = league_extras(sport, rated, now)
    openings = opening_prices(sport, games, now)
    try:
        facts = moneyline_matchup.team_facts(sport, rated, now)
    except Exception:  # noqa: BLE001 -- ESPN's view stands alone
        facts = {}
    read = []
    for game in games:
        espn = matched[game["id"]]
        filled = moneyline_matchup.fill(game, espn, pages.get((espn or {}).get("id")), facts)
        read.append(read_game(sport, game, rated, filled["espn"], filled["context"], extras, openings.get(game["id"])))
    live = [game for game in read if (_time(game["startsAt"]) or now) > now]
    if fetched:
        remember(sport, read, now)
    live.sort(key=lambda game: (game["startsAt"] or "", -(game["pick"] or {}).get("ev", -1)))
    return {"sport": sport, "version": VERSION, "updatedAt": datetime.fromtimestamp(snapshot["at"], timezone.utc).isoformat(),
            "games": live, "plays": sum(1 for game in live if (game["pick"] or {}).get("tier") in ("play", "strong"))}


def league_extras(sport, rated, now):
    """What a league's matchups need beyond each game's page: MLB bullpens
    and lineup splits, NHL goalies. Each is optional."""
    import moneyline_matchup
    out = {}
    jobs = {"mlb": {"bullpens": lambda: moneyline_matchup.mlb_bullpens(now),
                    "platoon": lambda: moneyline_matchup.mlb_platoon(rated.get("season") or now.year)},
            "nhl": {"goalies": moneyline_matchup.nhl_goalies}}.get(sport, {})
    for name, job in jobs.items():
        try:
            out[name] = job()
        except Exception:  # noqa: BLE001 -- the game is still priced without it
            out[name] = None
    return out


def opening_prices(sport, games, now):
    """The first fair price seen for each game, kept so the page can show
    how far the market has moved since."""
    seen = _load(f"open:{sport}", {}) or {}
    changed = False
    for game in games:
        if game["id"] in seen:
            continue
        fair, _ = consensus(game["books"])
        if fair is not None:
            seen[game["id"]] = {"home": fair, "at": now.isoformat()}
            changed = True
    cutoff = (now - timedelta(days=10)).isoformat()
    kept = {key: value for key, value in seen.items() if value.get("at", "") >= cutoff}
    if changed or len(kept) != len(seen):
        _save(f"open:{sport}", kept)
    return kept


def leagues():
    """What each league has on the board, from the last prices (no request)."""
    out = {}
    now = datetime.now(timezone.utc)
    for sport in SPORTS:
        snapshot = _load(f"odds:{sport}") or {}
        horizon = now + timedelta(days=SPORTS[sport]["days"])
        upcoming = [event for event in snapshot.get("events") or [] if now < (_time(event.get("commence_time")) or now) <= horizon]
        out[sport] = {"games": len(upcoming), "checkedAt": snapshot.get("at")}
    return out


# ---------------------------------------------------------------- the record

def _play_id(sport, game, side):
    return f"{sport}:{game['id']}:{side}"


def remember(sport, games, now):
    """Keep every new play, and each open play's latest price as its close
    until the game starts."""
    plays = _load("plays", []) or []
    by_id = {play["id"]: play for play in plays}
    changed = False
    for game in games:
        starts = _time(game["startsAt"])
        if not starts or starts <= now or not game.get("fair"):
            continue
        pick = game.get("pick")
        if pick and pick["tier"] in ("play", "strong"):
            key = _play_id(sport, game, pick["side"])
            if key not in by_id:
                espn = game.get("espn") or {}
                side, other = (pick["side"], "away" if pick["side"] == "home" else "home")
                by_id[key] = {"id": key, "sport": sport, "gameId": game["id"], "startsAt": game["startsAt"], "side": side,
                              "team": pick["team"], "opponent": game[f"{other}Name"],
                              "logo": (espn.get(side) or {}).get("logo"), "abbr": (espn.get(side) or {}).get("abbr"),
                              "opponentAbbr": (espn.get(other) or {}).get("abbr"), "home": side == "home",
                              "price": pick["price"], "book": pick["book"], "bookName": pick["bookName"],
                              "probability": pick["probability"], "fair": game["fair"][side], "ev": pick["ev"],
                              "tier": pick["tier"], "units": pick["units"], "postedAt": now.isoformat(),
                              "close": None, "result": None}
                changed = True
        for side in ("home", "away"):
            play = by_id.get(_play_id(sport, game, side))
            if play and play.get("result") is None:
                offer = game["best"].get(side)
                play["close"] = {"probability": game["fair"][side], "price": offer["price"] if offer else None, "at": now.isoformat()}
                changed = True
    if changed:
        ordered = sorted(by_id.values(), key=lambda play: play.get("startsAt") or "", reverse=True)[:PLAYS_KEPT]
        _save("plays", ordered)


def grade(now=None):
    """Settle every open play whose game should be over, from ESPN's finals."""
    now = now or datetime.now(timezone.utc)
    plays = _load("plays", []) or []
    open_plays = [play for play in plays if play.get("result") is None
                  and (_time(play.get("startsAt")) or now) < now - timedelta(hours=2, minutes=30)]
    if not open_plays:
        return 0
    wanted = {}
    for play in open_plays:
        day = _eastern(_time(play["startsAt"])).date()
        wanted.setdefault(play["sport"], set()).add(day)
    finals = {}
    for sport, days in wanted.items():
        try:
            finals[sport] = scoreboard(sport, min(days) - timedelta(days=1), max(days) + timedelta(days=1), fresh=True)
        except Exception:  # noqa: BLE001 -- tried again on the next tick
            finals[sport] = []
    settled = 0
    for play in open_plays:
        home, away = (play["team"], play["opponent"]) if play["home"] else (play["opponent"], play["team"])
        game = match_espn({"homeName": home, "awayName": away, "startsAt": play["startsAt"]}, finals.get(play["sport"], []))
        if not game or not game.get("completed"):
            if (_time(play["startsAt"]) or now) < now - timedelta(days=3):
                play["result"] = "void"
                settled += 1
            continue
        own, other = game["home" if play["home"] else "away"], game["away" if play["home"] else "home"]
        try:
            mine, theirs = float(own.get("score")), float(other.get("score"))
        except (TypeError, ValueError):
            continue
        play["score"] = f"{int(mine)}-{int(theirs)}"
        play["result"] = "W" if mine > theirs else "L" if mine < theirs else "P"
        payout = decimal(play["price"]) or 1
        play["profit"] = round(play["units"] * (payout - 1), 2) if play["result"] == "W" else -play["units"] if play["result"] == "L" else 0
        play["gradedAt"] = now.isoformat()
        settled += 1
    if settled:
        _save("plays", plays)
    return settled


def clv(play):
    """What the price was worth at the close: positive means it beat the
    closing line."""
    close = (play.get("close") or {}).get("probability")
    payout = decimal(play.get("price"))
    return close * payout - 1 if finite(close) and payout else None


def summary(plays, days=None, now=None):
    """The record: wins, losses, units, return, and how often the price beat
    the close."""
    now = now or datetime.now(timezone.utc)
    if days:
        cutoff = now - timedelta(days=days)
        plays = [play for play in plays if (_time(play.get("startsAt")) or now) >= cutoff]
    graded = [play for play in plays if play.get("result") in ("W", "L", "P")]
    staked = sum(play.get("units") or 0 for play in graded if play["result"] != "P")
    profit = sum(play.get("profit") or 0 for play in graded)
    values = [clv(play) for play in plays if clv(play) is not None and play.get("result") != "void"]
    running, curve = 0.0, []
    for play in sorted(graded, key=lambda play: play.get("startsAt") or ""):
        running += play.get("profit") or 0
        curve.append({"at": play.get("startsAt"), "units": round(running, 2)})
    return {"plays": len(graded), "wins": sum(play["result"] == "W" for play in graded),
            "losses": sum(play["result"] == "L" for play in graded), "pushes": sum(play["result"] == "P" for play in graded),
            "units": round(profit, 2), "roi": profit / staked if staked else None,
            "beatClose": sum(value > 0 for value in values) / len(values) if values else None,
            "clv": sum(values) / len(values) if values else None, "pending": sum(play.get("result") is None for play in plays),
            "curve": curve}


def record(now=None):
    now = now or datetime.now(timezone.utc)
    plays = _load("plays", []) or []
    shown = [{**play, "clv": clv(play)} for play in plays if play.get("result") != "void"][:120]
    return {"summary": summary(plays, days=30, now=now), "allTime": summary(plays, now=now), "plays": shown}


# ---------------------------------------------------------------- the timer

def tick(now=None):
    """Run from the line-check timer: refresh a league when it has games
    coming (hourly) or a play about to start (for its closing price), then
    settle finished plays. Stops spending below CREDIT_FLOOR requests left
    or TIMER_DAILY_CAP refreshes a day."""
    now = now or datetime.now(timezone.utc)
    credits = (_load("credits") or {}).get("remaining")
    spent = _load("spent", {}) or {}
    today = _eastern(now).date().isoformat()
    count = spent.get(today, 0)
    refreshed = []
    plays = _load("plays", []) or []
    for sport in SPORTS:
        if (credits is not None and credits < CREDIT_FLOOR) or count >= TIMER_DAILY_CAP:
            break
        snapshot = _load(f"odds:{sport}") or {}
        age = time.time() - snapshot.get("at", 0)
        closing = any(play["sport"] == sport and play.get("result") is None
                      and timedelta(0) < (_time(play["startsAt"]) or now) - now <= timedelta(seconds=CLOSE_WINDOW) for play in plays)
        upcoming = any(timedelta(0) < (_time(event.get("commence_time")) or now) - now <= timedelta(hours=12)
                       for event in snapshot.get("events") or [])
        # Closing prices near a play's start; hourly with games in the next
        # 12 hours; otherwise every 6 hours to find newly posted games.
        if (closing and age > CLOSE_REFRESH) or (upcoming and age > TIMER_REFRESH) or age > 6 * 3600:
            try:
                board(sport, force=True, now=now)
                refreshed.append(sport)
                count += 1
            except Exception:  # noqa: BLE001 -- the next tick tries again
                pass
    if refreshed:
        _save("spent", {today: count})
    settled = grade(now)
    return {"refreshed": refreshed, "settled": settled}
