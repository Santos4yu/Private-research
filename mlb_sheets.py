"""MLB cheat sheets: the day's slate read eight ways.

One shared slate per day -- the games, each team's starter, its hitters
(the posted lineup, else the active roster), their season lines and their
splits against left- and right-handed pitching, and each starter's season,
splits and game log -- then each sheet adds only what it needs:

  hr          power hitters for home run props (Statcast contact quality,
              ISO and slugging against the starter's hand, park, weather)
  hot         hitters whose last 14 days run well above their season
  matchups    each starter against the lineup he faces, game by game
  bvp         career batter-versus-pitcher numbers for today's matchups
  nrfi        first-inning scoring: each starter's scoreless-first rate,
              each offense's first-inning scoring, and a model chance
  park        ballparks and weather for every game
  strikeouts  starters' strikeout profiles against today's lineup
  streaks     active streaks (hits, on base, total bases, HR, walks, steals)

Everything comes from MLB's own stats service (live_props_core.mlb), the
Baseball Savant batter leaderboard and Open-Meteo weather (both free, no
key); nothing is bought. Missing pieces leave their columns empty rather
than failing a sheet.
"""
import csv
import io
from concurrent.futures import ThreadPoolExecutor
from datetime import date as Date, timedelta

from live_props_core import cached, mlb
from backend.vortextime import vortex_board_day

SHEETS = ("hr", "hot", "matchups", "bvp", "nrfi", "park", "strikeouts", "streaks")
SLATE_TTL = 15 * 60
SHEET_TTL = 15 * 60
RECENT_DAYS = 14
LOG_DAYS = 30
CHUNK = 40


# ---------------------------------------------------------------- numbers

def _number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number not in (float("inf"), float("-inf")) else None


def innings(value):
    """MLB writes innings as whole.outs: "6.2" is six and two thirds."""
    number = _number(value)
    if number is None:
        return None
    whole = int(number)
    return whole + round((number - whole) * 10) / 3


def _ratio(part, whole, digits=3):
    part, whole = _number(part), _number(whole)
    return round(part / whole, digits) if part is not None and whole else None


def _clamp(value, low, high):
    return max(low, min(high, value))


def _scale(value, low, high):
    """0..1 for where `value` sits between low and high (None stays None)."""
    if value is None:
        return None
    return _clamp((value - low) / (high - low), 0.0, 1.0)


def _weighted(parts):
    """A 0-100 score from (share 0..1 or None, weight) pairs, ignoring the missing ones."""
    present = [(share, weight) for share, weight in parts if share is not None]
    total = sum(weight for _, weight in present)
    return round(100 * sum(share * weight for share, weight in present) / total) if total else None


def hitting_line(stat):
    """A hitter's (or a split's) line in the rates the sheets show."""
    stat = stat or {}
    pa, ab = _number(stat.get("plateAppearances")), _number(stat.get("atBats"))
    hits, hr = _number(stat.get("hits")), _number(stat.get("homeRuns"))
    avg, slg = _number(stat.get("avg")), _number(stat.get("slg"))
    return {
        "games": _number(stat.get("gamesPlayed")), "pa": pa, "ab": ab, "hits": hits, "hr": hr,
        "doubles": _number(stat.get("doubles")), "triples": _number(stat.get("triples")),
        "bb": _number(stat.get("baseOnBalls")), "so": _number(stat.get("strikeOuts")), "sb": _number(stat.get("stolenBases")),
        "tb": _number(stat.get("totalBases")), "rbi": _number(stat.get("rbi")),
        "avg": avg, "obp": _number(stat.get("obp")), "slg": slg, "ops": _number(stat.get("ops")),
        "iso": round(slg - avg, 3) if slg is not None and avg is not None else None,
        "hrRate": _ratio(hr, pa, 4), "kRate": _ratio(stat.get("strikeOuts"), pa, 4), "bbRate": _ratio(stat.get("baseOnBalls"), pa, 4),
    }


def pitching_line(stat):
    """A pitcher's (or a split's) line: rates per nine, per batter and allowed."""
    stat = stat or {}
    pitched = innings(stat.get("inningsPitched"))
    faced = _number(stat.get("battersFaced"))
    hits, walks = _number(stat.get("hits")), _number(stat.get("baseOnBalls"))
    per_nine = lambda key: round(_number(stat.get(key)) * 9 / pitched, 2) if pitched and _number(stat.get(key)) is not None else None
    avg, slg = _number(stat.get("avg")), _number(stat.get("slg"))
    return {
        "ip": round(pitched, 2) if pitched is not None else None, "bf": faced, "starts": _number(stat.get("gamesStarted")),
        "era": _number(stat.get("era")), "whip": round((hits + walks) / pitched, 2) if pitched and hits is not None and walks is not None else _number(stat.get("whip")),
        "k9": per_nine("strikeOuts"), "bb9": per_nine("baseOnBalls"), "hr9": per_nine("homeRuns"),
        "hr": _number(stat.get("homeRuns")), "so": _number(stat.get("strikeOuts")),
        "kRate": _ratio(stat.get("strikeOuts"), faced, 4), "bbRate": _ratio(stat.get("baseOnBalls"), faced, 4),
        "avg": avg, "obp": _number(stat.get("obp")), "slg": slg, "ops": _number(stat.get("ops")),
        "iso": round(slg - avg, 3) if slg is not None and avg is not None else None,
    }


# ---------------------------------------------------------------- MLB reads

def _stats():
    """backend/stats_mlb.py, imported the way prediction_core does (one shared cache)."""
    import sys
    from pathlib import Path
    folder = str(Path(__file__).resolve().parent / "backend")
    if folder not in sys.path:
        sys.path.insert(0, folder)
    import stats_mlb
    return stats_mlb


def _blocks(person):
    """A person's stat blocks by type: season, statsplits, gamelog, bydaterange."""
    found = {}
    for block in person.get("stats", []) or []:
        kind = ((block.get("type") or {}).get("displayName") or "season").lower()
        found.setdefault(kind, []).extend(block.get("splits", []) or [])
    return found


def _people(ids, hydrate):
    """MLB's people endpoint for many ids at once, in chunks, in parallel."""
    ids = sorted({int(value) for value in ids if value})
    chunks = [ids[index:index + CHUNK] for index in range(0, len(ids), CHUNK)]
    if not chunks:
        return []

    def one(chunk):
        try:
            return mlb("/people", {"personIds": ",".join(map(str, chunk)), "hydrate": hydrate}).get("people", []) or []
        except Exception:
            return []

    with ThreadPoolExecutor(max_workers=min(4, len(chunks))) as pool:
        return [person for found in pool.map(one, chunks) for person in found]


def parse_schedule(payload):
    """The day's games: teams, start, venue, probable starters and any posted lineups."""
    games = []
    for day in payload.get("dates", []) or []:
        for game in day.get("games", []) or []:
            teams = game.get("teams") or {}
            sides = {}
            for key in ("away", "home"):
                side = teams.get(key) or {}
                team = side.get("team") or {}
                probable = side.get("probablePitcher") or {}
                sides[key] = {"id": team.get("id"), "name": team.get("name"), "abbr": team.get("abbreviation") or team.get("teamCode", "").upper() or None,
                              "starter": {"id": probable["id"], "name": probable.get("fullName")} if probable.get("id") else None}
            lineups = game.get("lineups") or {}
            for key, field in (("away", "awayPlayers"), ("home", "homePlayers")):
                sides[key]["lineup"] = [player.get("id") for player in lineups.get(field) or [] if player.get("id")]
            venue = game.get("venue") or {}
            games.append({"gamePk": game.get("gamePk"), "startsAt": game.get("gameDate"),
                          "status": (game.get("status") or {}).get("detailedState"), "gameType": game.get("gameType"),
                          "venue": venue.get("name"), "away": sides["away"], "home": sides["home"]})
    return games


def _roster(team_id):
    try:
        payload = mlb(f"/teams/{team_id}/roster", {"rosterType": "active"})
    except Exception:
        return []
    return [row["person"]["id"] for row in payload.get("roster", []) or []
            if (row.get("position") or {}).get("abbreviation") != "P" and (row.get("person") or {}).get("id")]


def parse_hitter(person):
    blocks = _blocks(person)
    season = (blocks.get("season") or [{}])[0].get("stat") or {}
    vs = {}
    for split in blocks.get("statsplits", []) or []:
        code = ((split.get("split") or {}).get("code") or "").lower()
        if code in ("vl", "vr"):
            vs["L" if code == "vl" else "R"] = hitting_line(split.get("stat"))
    return {"id": person.get("id"), "name": person.get("fullName"), "bats": (person.get("batSide") or {}).get("code"),
            "season": hitting_line(season), "vs": vs}


def parse_pitcher(person):
    blocks = _blocks(person)
    season = (blocks.get("season") or [{}])[0].get("stat") or {}
    vs = {}
    for split in blocks.get("statsplits", []) or []:
        code = ((split.get("split") or {}).get("code") or "").lower()
        if code in ("vl", "vr"):
            vs["L" if code == "vl" else "R"] = pitching_line(split.get("stat"))
    starts = []
    for split in blocks.get("gamelog", []) or []:
        stat = split.get("stat") or {}
        if not (_number(stat.get("gamesStarted")) or 0) >= 1:
            continue
        starts.append({"date": str(split.get("date") or "")[:10] or None, "gamePk": (split.get("game") or {}).get("gamePk"),
                       "opponent": (split.get("opponent") or {}).get("id"), "home": split.get("isHome") if isinstance(split.get("isHome"), bool) else None,
                       "ip": round(innings(stat.get("inningsPitched")) or 0, 2), "k": _number(stat.get("strikeOuts")) or 0,
                       "pitches": _number(stat.get("numberOfPitches") or stat.get("pitchesThrown")), "er": _number(stat.get("earnedRuns")) or 0,
                       "hr": _number(stat.get("homeRuns")) or 0, "bf": _number(stat.get("battersFaced"))})
    starts.sort(key=lambda start: start["date"] or "")
    return {"id": person.get("id"), "name": person.get("fullName"), "throws": (person.get("pitchHand") or {}).get("code"),
            "season": pitching_line(season), "vs": vs, "starts": starts}


def slate(day=None):
    """The day's games with every starter and hitter read (shared by all sheets)."""
    day = day or vortex_board_day()
    season = int(day[:4])

    def load():
        games = parse_schedule(mlb("/schedule", {"sportId": 1, "date": day, "hydrate": "probablePitcher,lineups,team,venue"}))
        hitter_ids, confirmed = {}, {}
        rosters = {}
        need_roster = [side["id"] for game in games for side in (game["away"], game["home"]) if side["id"] and len(side["lineup"]) < 9]
        if need_roster:
            with ThreadPoolExecutor(max_workers=min(6, len(need_roster))) as pool:
                rosters = dict(zip(need_roster, pool.map(_roster, need_roster)))
        for game in games:
            for side in (game["away"], game["home"]):
                if not side["id"]:
                    continue
                posted = len(side["lineup"]) >= 9
                ids = side["lineup"] if posted else rosters.get(side["id"], [])
                side["hitters"] = list(dict.fromkeys(ids))
                side["confirmed"] = posted
                for player in side["hitters"]:
                    hitter_ids[player] = side["id"]
                    confirmed[player] = posted
        pitcher_ids = [side["starter"]["id"] for game in games for side in (game["away"], game["home"]) if side.get("starter")]
        with ThreadPoolExecutor(max_workers=2) as pool:
            hitters = pool.submit(_people, list(hitter_ids), f"stats(group=[hitting],type=[season,statSplits],sitCodes=[vl,vr],season={season})")
            pitchers = pool.submit(_people, pitcher_ids, f"stats(group=[pitching],type=[season,statSplits,gameLog],sitCodes=[vl,vr],season={season})")
            hitters, pitchers = hitters.result(), pitchers.result()
        return {"day": day, "season": season, "games": games,
                "hitters": {str(person["id"]): {**parse_hitter(person), "teamId": hitter_ids.get(person["id"]), "confirmed": confirmed.get(person["id"], False)}
                            for person in hitters if person.get("id")},
                "pitchers": {str(person["id"]): parse_pitcher(person) for person in pitchers if person.get("id")}}

    return cached(("mlb-sheets-slate", day), SLATE_TTL, load)


# ---------------------------------------------------------------- extras

def _recent(day, ids):
    """Each hitter's last RECENT_DAYS days (byDateRange), before today."""
    today = Date.fromisoformat(day)
    hydrate = (f"stats(group=[hitting],type=[byDateRange],startDate={(today - timedelta(days=RECENT_DAYS)).isoformat()},"
               f"endDate={(today - timedelta(days=1)).isoformat()},season={today.year})")
    return {str(person["id"]): hitting_line(((_blocks(person).get("bydaterange") or [{}])[0]).get("stat"))
            for person in _people(ids, hydrate) if person.get("id")}


def _game_logs(day, ids):
    """Each hitter's games over the last LOG_DAYS days, oldest first."""
    today = Date.fromisoformat(day)
    hydrate = (f"stats(group=[hitting],type=[gameLog],startDate={(today - timedelta(days=LOG_DAYS)).isoformat()},"
               f"endDate={(today - timedelta(days=1)).isoformat()},season={today.year})")
    logs = {}
    for person in _people(ids, hydrate):
        games = []
        for split in _blocks(person).get("gamelog", []) or []:
            stat = split.get("stat") or {}
            games.append({"date": str(split.get("date") or "")[:10], "hits": _number(stat.get("hits")) or 0, "tb": _number(stat.get("totalBases")) or 0,
                          "hr": _number(stat.get("homeRuns")) or 0, "bb": _number(stat.get("baseOnBalls")) or 0, "hbp": _number(stat.get("hitByPitch")) or 0,
                          "sb": _number(stat.get("stolenBases")) or 0, "so": _number(stat.get("strikeOuts")) or 0, "pa": _number(stat.get("plateAppearances")) or 0})
        logs[str(person.get("id"))] = sorted(games, key=lambda game: game["date"])[-20:]
    return logs


def parse_savant(text):
    """Baseball Savant's batter leaderboard CSV, keyed by MLB player id."""
    found = {}
    for row in csv.DictReader(io.StringIO(text)):
        player = (row.get("player_id") or "").strip()
        if not player:
            continue
        found[player] = {"barrel": _number(row.get("brl_percent")), "hardHit": _number(row.get("ev95percent")),
                         "ev": _number(row.get("avg_hit_speed")), "la": _number(row.get("avg_hit_angle")),
                         "maxEv": _number(row.get("max_hit_speed")), "bbe": _number(row.get("attempts"))}
    return found


def savant(season):
    """Barrel %, hard-hit %, exit velocity and launch angle for every batter (daily)."""
    def load():
        try:
            import requests
            response = requests.get("https://baseballsavant.mlb.com/leaderboard/statcast",
                                    params={"type": "batter", "year": season, "position": "", "team": "", "min": 10, "csv": "true"},
                                    headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
            return parse_savant(response.content.decode("utf-8-sig")) if response.status_code == 200 else {}
        except Exception:
            return {}
    return cached(("mlb-sheets-savant", season), 6 * 3600, load)


def _weather(game):
    try:
        stats_mlb = _stats()
        found = stats_mlb.get_game_weather(game["home"]["abbr"] or "", game["startsAt"] or "", game["gamePk"])
        return None if not found or found.get("error") else found
    except Exception:
        return None


def _park(game):
    try:
        stats_mlb = _stats()
        return stats_mlb.PARK_FACTOR.get(game["home"]["name"] or "")
    except Exception:
        return None


def environment(game, weather):
    """A game's run and home-run environment from its park and the weather.

    The park is its runs factor; the weather's part is an estimate: warm air
    carries the ball (about a quarter of a percent of runs per degree over
    70F, three times that for home runs) and wind blowing out helps (in
    hurts) by about one percent of home runs per mph. A dome or closed roof
    has no weather.
    """
    park = _park(game)
    out = {"park": park, "runs": None, "hr": None, "temp": None, "wind": None, "windEffect": None, "dome": False,
           "condition": None, "precip": None}
    if weather:
        dome = bool(weather.get("dome") or str(weather.get("roof_status") or "").lower() in ("closed", "dome"))
        out.update({"temp": _number(weather.get("temp_f")), "wind": _number(weather.get("speed_mph")), "windEffect": weather.get("effect"),
                    "dome": dome, "roof": weather.get("roof_type") or weather.get("roof_status"), "condition": weather.get("condition"),
                    "precip": _number(weather.get("rain_probability")), "direction": _number(weather.get("direction_deg"))})
    runs, hr = (park or 1.0), (park or 1.0) ** 1.3
    if not out["dome"] and out["temp"] is not None:
        runs *= 1 + (out["temp"] - 70) * 0.0025
        hr *= 1 + (out["temp"] - 70) * 0.0075
    if not out["dome"] and out["wind"] is not None and out["windEffect"] in ("out", "in"):
        push = out["wind"] * (1 if out["windEffect"] == "out" else -1)
        runs *= 1 + push * 0.004
        hr *= 1 + push * 0.01
    if park is None and not weather:
        return out
    out["runs"] = round((runs - 1) * 100, 1)
    out["hr"] = round((hr - 1) * 100, 1)
    return out


def _sides(game):
    """(batting side, opposing starter side) for both halves of a game."""
    return ((game["away"], game["home"]), (game["home"], game["away"]))


def _hitter_rows(data, extra=None):
    """Every hitter in the slate with whom he faces today."""
    rows = []
    for game in data["games"]:
        for side, other in _sides(game):
            starter = data["pitchers"].get(str((other.get("starter") or {}).get("id")))
            for player in side.get("hitters", []):
                hitter = data["hitters"].get(str(player))
                if not hitter:
                    continue
                rows.append({"hitter": hitter, "team": side, "opponent": other, "starter": starter, "game": game})
    return rows


def _face(hitter, side, other, starter, game):
    hand = (starter or {}).get("throws")
    return {"id": hitter["id"], "name": hitter["name"], "bats": hitter["bats"], "team": side["abbr"], "teamId": side["id"],
            "opponent": other["abbr"], "opponentId": other["id"], "home": side is game["home"], "startsAt": game["startsAt"], "gamePk": game["gamePk"],
            "confirmed": hitter.get("confirmed", False),
            "pitcher": {"id": starter["id"], "name": starter["name"], "throws": hand} if starter else None}


# ---------------------------------------------------------------- sheets

def sheet_hr(data):
    """Home run props: power, contact quality, the split against today's hand, park and weather."""
    stat = savant(data["season"])
    recent = _recent(data["day"], list(data["hitters"]))
    weather = {game["gamePk"]: environment(game, _weather(game)) for game in data["games"]}
    rows = []
    for item in _hitter_rows(data):
        hitter, starter, game = item["hitter"], item["starter"], item["game"]
        season = hitter["season"]
        if not season.get("pa") or season["pa"] < 40:
            continue
        hand = (starter or {}).get("throws")
        split = hitter["vs"].get(hand) if hand else None
        contact = stat.get(str(hitter["id"]), {})
        lately = recent.get(str(hitter["id"])) or {}
        env = weather.get(game["gamePk"]) or {}
        allowed = (starter or {}).get("vs", {}).get("L" if hitter["bats"] == "L" else "R") if starter else None
        hot = bool(lately.get("pa") and lately["pa"] >= 15 and ((lately.get("hr") or 0) >= 3 or (lately.get("iso") or 0) >= (season.get("iso") or 0) + 0.08))
        score = _weighted([
            (_scale(contact.get("barrel"), 4, 20), 0.26),
            (_scale((split or {}).get("iso") if split and (split.get("pa") or 0) >= 40 else season.get("iso"), 0.09, 0.32), 0.2),
            (_scale(season.get("hrRate"), 0.01, 0.075), 0.16),
            (_scale(contact.get("hardHit"), 30, 58), 0.1),
            (_scale((starter or {}).get("season", {}).get("hr9"), 0.6, 1.8) if starter else None, 0.1),
            (_scale((allowed or {}).get("slg"), 0.33, 0.52) if allowed and (allowed.get("bf") or 0) >= 60 else None, 0.08),
            (_scale(env.get("hr"), -15, 25), 0.1),
        ])
        rows.append({**_face(hitter, item["team"], item["opponent"], starter, game),
                     "hr": season.get("hr"), "pa": season.get("pa"), "slg": season.get("slg"), "iso": season.get("iso"), "hrRate": season.get("hrRate"),
                     "vsHand": {key: (split or {}).get(key) for key in ("pa", "hr", "slg", "iso", "ops")} if split else None,
                     "barrel": contact.get("barrel"), "hardHit": contact.get("hardHit"), "ev": contact.get("ev"), "la": contact.get("la"),
                     "recent": {key: lately.get(key) for key in ("pa", "hr", "ops", "iso")} if lately.get("pa") else None,
                     "hot": hot, "park": env.get("hr"), "score": score})
    rows.sort(key=lambda row: -(row["score"] or 0))
    return {"rows": rows[:120]}


def sheet_hot(data):
    """Hitters whose last 14 days run well above their season."""
    recent = _recent(data["day"], list(data["hitters"]))
    logs = _game_logs(data["day"], list(data["hitters"]))
    rows = []
    for item in _hitter_rows(data):
        hitter = item["hitter"]
        lately, season = recent.get(str(hitter["id"])) or {}, hitter["season"]
        if not lately.get("pa") or lately["pa"] < 15 or not season.get("pa") or season["pa"] < 60:
            continue
        delta = lambda key: round(lately[key] - season[key], 3) if lately.get(key) is not None and season.get(key) is not None else None
        ops, iso, avg = delta("ops"), delta("iso"), delta("avg")
        score = _weighted([(_scale(ops, -0.05, 0.45), 0.45), (_scale(iso, -0.03, 0.25), 0.3), (_scale(lately.get("hr"), 0, 6), 0.15),
                           (_scale(-(delta("kRate") or 0), -0.06, 0.08), 0.1)])
        tag = "hot" if (ops or 0) >= 0.25 else "warm" if (ops or 0) >= 0.12 else None
        if tag is None:
            continue
        games = logs.get(str(hitter["id"]), [])[-10:]
        rows.append({**_face(hitter, item["team"], item["opponent"], item["starter"], item["game"]),
                     "pa": lately.get("pa"), "avg": lately.get("avg"), "ops": lately.get("ops"), "iso": lately.get("iso"), "hr": lately.get("hr"),
                     "delta": {"avg": avg, "ops": ops, "iso": iso, "kRate": delta("kRate")}, "seasonOps": season.get("ops"),
                     "spark": [game["tb"] for game in games], "tag": tag, "score": score})
    rows.sort(key=lambda row: -(row["score"] or 0))
    return {"rows": rows[:80], "days": RECENT_DAYS}


def _arsenal(pitcher_id):
    try:
        stats_mlb = _stats()
        return [{"pitch": item.get("pitch_name") or item.get("pitch_type"), "pct": item.get("pct"), "speed": item.get("avg_speed")}
                for item in stats_mlb.get_pitcher_arsenal(int(pitcher_id))[:6]]
    except Exception:
        return []


def sheet_matchups(data):
    """Each starter against the lineup he faces, with the game's park and weather."""
    games = []
    starters = [side["starter"]["id"] for game in data["games"] for side in (game["away"], game["home"]) if side.get("starter")]
    with ThreadPoolExecutor(max_workers=6) as pool:
        mixes = dict(zip(starters, pool.map(_arsenal, starters))) if starters else {}
        weathers = dict(zip([game["gamePk"] for game in data["games"]], pool.map(_weather, data["games"])))
    for game in data["games"]:
        env = environment(game, weathers.get(game["gamePk"]))
        halves = []
        for side, other in _sides(game):
            starter = data["pitchers"].get(str((other.get("starter") or {}).get("id")))
            if not starter:
                halves.append({"pitcher": None, "team": side["abbr"], "lineup": []})
                continue
            hand = starter.get("throws")
            lineup = []
            for order, player in enumerate(side.get("hitters", []), 1):
                hitter = data["hitters"].get(str(player))
                if not hitter:
                    continue
                split = hitter["vs"].get(hand) or {}
                score = _weighted([(_scale(split.get("iso"), 0.08, 0.3), 0.35), (_scale(split.get("ops"), 0.6, 0.95), 0.35),
                                   (_scale(split.get("hrRate"), 0.01, 0.07), 0.2), (_scale(-(split.get("kRate") or 0.22), -0.32, -0.14), 0.1)]) if split.get("pa") else None
                lineup.append({"id": hitter["id"], "name": hitter["name"], "bats": hitter["bats"], "order": order if side.get("confirmed") else None,
                               **{key: split.get(key) for key in ("pa", "hr", "avg", "obp", "slg", "iso", "ops", "kRate", "bbRate")}, "score": score})
            lineup.sort(key=lambda row: -(row["score"] or -1))
            recent = starter["starts"][-3:]
            halves.append({"team": side["abbr"], "teamId": side["id"], "confirmed": side.get("confirmed", False),
                           "pitcher": {"id": starter["id"], "name": starter["name"], "throws": hand, "team": other["abbr"], "season": starter["season"],
                                       "vs": starter["vs"], "arsenal": mixes.get(starter["id"], []),
                                       "last3": {"ip": round(sum(start["ip"] for start in recent), 1), "hr": sum(start["hr"] for start in recent),
                                                 "k": sum(start["k"] for start in recent)} if recent else None},
                           "lineup": lineup})
        games.append({"gamePk": game["gamePk"], "startsAt": game["startsAt"], "venue": game["venue"], "away": game["away"]["abbr"], "home": game["home"]["abbr"],
                      "awayId": game["away"]["id"], "homeId": game["home"]["id"], "environment": env, "halves": halves})
    return {"games": games}


def bvp_tag(pa):
    return "strong" if pa >= 20 else "moderate" if pa >= 8 else "limited"


def bvp_row(found):
    """A career batter-vs-pitcher line with its rates and a score that trusts big samples more."""
    ab, hits, bb, tb = (_number(found.get(key)) or 0 for key in ("ab", "hits", "bb", "tb"))
    pa = ab + bb
    avg = hits / ab if ab else None
    obp = (hits + bb) / pa if pa else None
    slg = tb / ab if ab else None
    ops = obp + slg if obp is not None and slg is not None else None
    regressed = (ops * pa + 0.72 * 15) / (pa + 15) if ops is not None else None
    return {"pa": int(pa), "ab": int(ab), "hits": int(hits), "hr": int(_number(found.get("hr")) or 0), "so": int(_number(found.get("k")) or 0), "bb": int(bb),
            "avg": round(avg, 3) if avg is not None else None, "obp": round(obp, 3) if obp is not None else None,
            "slg": round(slg, 3) if slg is not None else None, "ops": round(ops, 3) if ops is not None else None,
            "sample": bvp_tag(pa), "score": round(100 * _scale(regressed, 0.55, 1.05)) if regressed is not None else None}


def sheet_bvp(data):
    """Career batter-vs-pitcher numbers for today's matchups (at least 4 plate appearances)."""
    stats_mlb = _stats()
    jobs = []
    for game in data["games"]:
        for side, other in _sides(game):
            starter = data["pitchers"].get(str((other.get("starter") or {}).get("id")))
            if starter and side.get("hitters"):
                jobs.append((game, side, other, starter))
    with ThreadPoolExecutor(max_workers=4) as pool:
        found = list(pool.map(lambda job: stats_mlb.get_career_bvp_batch(job[1]["hitters"], job[3]["id"]), jobs))
    rows = []
    for (game, side, other, starter), lines in zip(jobs, found):
        for player, line in (lines or {}).items():
            hitter = data["hitters"].get(str(player))
            if not hitter:
                continue
            row = bvp_row(line)
            if row["pa"] < 4:
                continue
            rows.append({**_face(hitter, side, other, starter, game), **row})
    rows.sort(key=lambda row: -(row["score"] or 0))
    return {"rows": rows[:100]}


def first_innings(team_id, season):
    """A team's regular-season games with the runs each side scored in the first inning."""
    def load():
        try:
            payload = mlb("/schedule", {"sportId": 1, "teamId": team_id, "season": season, "gameType": "R", "hydrate": "linescore"})
        except Exception:
            return []
        return parse_first_innings(payload)
    return cached(("mlb-sheets-first", team_id, season), 6 * 3600, load)


def parse_first_innings(payload):
    games = []
    for day in payload.get("dates", []) or []:
        for game in day.get("games", []) or []:
            if (game.get("status") or {}).get("abstractGameState") != "Final":
                continue
            first = ((game.get("linescore") or {}).get("innings") or [None])[0]
            if not first:
                continue
            teams = game.get("teams") or {}
            games.append({"gamePk": game.get("gamePk"), "date": str(game.get("gameDate") or "")[:10],
                          "home": ((teams.get("home") or {}).get("team") or {}).get("id"), "away": ((teams.get("away") or {}).get("team") or {}).get("id"),
                          "homeRuns": _number((first.get("home") or {}).get("runs")) or 0, "awayRuns": _number((first.get("away") or {}).get("runs")) or 0})
    return sorted(games, key=lambda game: game["date"])


def nrfi_numbers(team_id, games, starts):
    """A team's first-inning scoring (season, last 10) and, for its starter, the
    share of his starts with no run in the first (season, last 5, last 10)."""
    scored = [(game["homeRuns"] if game["home"] == team_id else game["awayRuns"]) > 0 for game in games if team_id in (game["home"], game["away"])]
    by_game = {game["gamePk"]: game for game in games}
    clean = []
    for start in starts or []:
        game = by_game.get(start.get("gamePk"))
        if not game:
            continue
        allowed = game["awayRuns"] if game["home"] == team_id else game["homeRuns"]
        clean.append(allowed == 0)
    share = lambda values: round(sum(values) / len(values), 3) if values else None
    return {"offense": {"season": share(scored), "l10": share(scored[-10:]), "games": len(scored)},
            "pitcher": {"season": share(clean), "l5": share(clean[-5:]), "l10": share(clean[-10:]), "starts": len(clean),
                        "last": clean[-1] if clean else None}}


def nrfi_chance(away_offense, home_offense, away_pitcher, home_pitcher, league=0.27, runs_env=0.0):
    """The chance neither team scores in the first.

    Each half-inning's chance of a run blends the offense's first-inning
    scoring rate with how often the pitcher it faces gives one up, each
    pulled toward the league rate by its sample, then nudged by the park
    and weather.
    """
    def side(offense, pitcher):
        parts = []
        if offense.get("season") is not None:
            games = offense.get("games") or 0
            parts.append(((offense["season"] * games + league * 20) / (games + 20), 1.0))
        if pitcher.get("season") is not None:
            starts = pitcher.get("starts") or 0
            yes = 1 - pitcher["season"]
            parts.append(((yes * starts + league * 8) / (starts + 8), 1.0))
        chance = sum(value * weight for value, weight in parts) / sum(weight for _, weight in parts) if parts else league
        return _clamp(chance * (1 + (runs_env or 0) / 100 * 0.6), 0.05, 0.6)
    top, bottom = side(away_offense, home_pitcher), side(home_offense, away_pitcher)
    return round((1 - top) * (1 - bottom), 3)


def american(chance):
    if not chance or chance <= 0 or chance >= 1:
        return None
    return -round(chance / (1 - chance) * 100) if chance >= 0.5 else round((1 - chance) / chance * 100)


def sheet_nrfi(data):
    """First innings: each starter's scoreless-first rate, each offense's scoring, a model chance."""
    teams = {side["id"] for game in data["games"] for side in (game["away"], game["home"]) if side["id"]}
    with ThreadPoolExecutor(max_workers=6) as pool:
        lines = dict(zip(teams, pool.map(lambda team: first_innings(team, data["season"]), teams))) if teams else {}
        weathers = dict(zip([game["gamePk"] for game in data["games"]], pool.map(_weather, data["games"])))
    every = [game for games in lines.values() for game in games]
    seen, halves = set(), []
    for game in every:
        if game["gamePk"] not in seen:
            seen.add(game["gamePk"])
            halves += [game["homeRuns"] > 0, game["awayRuns"] > 0]
    league = round(sum(halves) / len(halves), 3) if len(halves) > 200 else 0.27
    rows = []
    for game in data["games"]:
        env = environment(game, weathers.get(game["gamePk"]))
        sides = {}
        for key in ("away", "home"):
            side = game[key]
            starter = data["pitchers"].get(str((side.get("starter") or {}).get("id")))
            numbers = nrfi_numbers(side["id"], lines.get(side["id"], []), (starter or {}).get("starts"))
            sides[key] = {"team": side["abbr"], "teamId": side["id"], "offense": numbers["offense"],
                          "pitcher": {**numbers["pitcher"], "id": starter["id"], "name": starter["name"], "throws": starter["throws"]} if starter else None}
        chance = nrfi_chance(sides["away"]["offense"], sides["home"]["offense"], (sides["away"]["pitcher"] or {}), (sides["home"]["pitcher"] or {}),
                             league, env.get("runs"))
        # The lean reads the percent people see (55.6% shows as 56%, a lean).
        shown = round(chance * 100)
        lean = "nrfi" if shown >= 56 else "yrfi" if shown <= 46 else "toss"
        rows.append({"gamePk": game["gamePk"], "startsAt": game["startsAt"], "venue": game["venue"], **sides,
                     "chance": chance, "nrfi": american(chance), "yrfi": american(1 - chance), "lean": lean,
                     "environment": {key: env.get(key) for key in ("park", "runs", "temp", "dome", "condition", "windEffect", "wind")}})
    rows.sort(key=lambda row: -row["chance"])
    return {"rows": rows, "league": league}


def sheet_park(data):
    """Ballparks and weather for every game, best for hitters first."""
    with ThreadPoolExecutor(max_workers=6) as pool:
        weathers = dict(zip([game["gamePk"] for game in data["games"]], pool.map(_weather, data["games"])))
    rows = []
    for game in data["games"]:
        env = environment(game, weathers.get(game["gamePk"]))
        rows.append({"gamePk": game["gamePk"], "startsAt": game["startsAt"], "venue": game["venue"],
                     "away": game["away"]["abbr"], "home": game["home"]["abbr"], "awayId": game["away"]["id"], "homeId": game["home"]["id"],
                     "starters": [(game[key].get("starter") or {}).get("name") for key in ("away", "home")], **env})
    rows.sort(key=lambda row: -(row["runs"] or 0))
    return {"rows": rows}


def sheet_strikeouts(data):
    """Starters' strikeout profiles against the lineup they face today."""
    try:
        import mlb_context
        context = mlb_context.context(data["day"])
    except Exception:
        context = {}
    league = (context.get("league") or {})
    rows = []
    for game in data["games"]:
        for key, other_key in (("away", "home"), ("home", "away")):
            side, other = game[key], game[other_key]
            starter = data["pitchers"].get(str((side.get("starter") or {}).get("id")))
            if not starter:
                continue
            season, starts = starter["season"], starter["starts"]
            hand = starter["throws"]
            lineup = (context.get("hitting") or {}).get(str(other["id"])) or {}
            split = (lineup.get("vs") or {}).get(hand) or {}
            opp_k = split.get("kRate") if split.get("kRate") is not None else lineup.get("kRate")
            opp_rank = split.get("kRateRank") if split.get("kRate") is not None else lineup.get("kRateRank")
            league_k = ((league.get("vs") or {}).get(hand) or {}).get("kRate") or league.get("kRate") or 0.22
            last5 = starts[-5:]
            avg_k = round(season["so"] / season["starts"], 1) if season.get("so") is not None and season.get("starts") else None
            l5_k = round(sum(start["k"] for start in last5) / len(last5), 1) if last5 else None
            ip = round(sum(start["ip"] for start in last5) / len(last5), 1) if last5 else None
            if ip is not None and season.get("ip") and season.get("starts"):
                weight = len(last5) / (len(last5) + 3)
                ip = round(weight * ip + (1 - weight) * season["ip"] / season["starts"], 1)
            per_batter = season.get("kRate")
            projected = round(per_batter * (ip or 5.5) * 4.25 * ((opp_k or league_k) / league_k), 1) if per_batter else None
            score = _weighted([(_scale(per_batter, 0.17, 0.33), 0.35), (_scale(opp_k, 0.19, 0.27), 0.25), (_scale(l5_k, 3, 9), 0.2), (_scale(ip, 4.5, 6.8), 0.2)])
            rows.append({"id": starter["id"], "name": starter["name"], "throws": hand, "team": side["abbr"], "teamId": side["id"],
                         "opponent": other["abbr"], "opponentId": other["id"], "home": key == "home", "startsAt": game["startsAt"], "gamePk": game["gamePk"],
                         "k9": season.get("k9"), "kRate": per_batter, "avgK": avg_k, "l5K": l5_k, "ip": ip, "projected": projected,
                         "opponentK": opp_k, "opponentKRank": opp_rank, "leagueK": league_k, "teams": league.get("teams") or 30,
                         "starts": [{"date": start["date"], "k": start["k"], "ip": start["ip"], "pitches": start["pitches"]} for start in last5],
                         "score": score})
    rows.sort(key=lambda row: -(row["score"] or 0))
    return {"rows": rows}


STREAKS = {
    "hits": ("1+ hits", lambda game: game["hits"] >= 1),
    "onbase": ("On base", lambda game: game["hits"] + game["bb"] + game["hbp"] >= 1),
    "tb2": ("2+ total bases", lambda game: game["tb"] >= 2),
    "hr": ("1+ HR", lambda game: game["hr"] >= 1),
    "bb": ("1+ walk", lambda game: game["bb"] >= 1),
    "sb": ("1+ steal", lambda game: game["sb"] >= 1),
    "k": ("1+ strikeout", lambda game: game["so"] >= 1),
}


def streak(games, test):
    """How many of the most recent games in a row pass `test`, and the last ten as hit/miss."""
    played = [game for game in games if game.get("pa", 1) > 0]
    count = 0
    for game in reversed(played):
        if not test(game):
            break
        count += 1
    return count, [bool(test(game)) for game in played[-10:]]


def sheet_streaks(data):
    """Active streaks for today's hitters, longest first, by kind."""
    logs = _game_logs(data["day"], list(data["hitters"]))
    out = {}
    faces = {str(item["hitter"]["id"]): item for item in _hitter_rows(data)}
    for key, (label, test) in STREAKS.items():
        rows = []
        for player, games in logs.items():
            item = faces.get(player)
            if not item:
                continue
            count, recent = streak(games, test)
            if count >= (2 if key in ("hr", "sb") else 3):
                rows.append({**_face(item["hitter"], item["team"], item["opponent"], item["starter"], item["game"]), "streak": count, "recent": recent})
        rows.sort(key=lambda row: (-row["streak"], row["name"] or ""))
        out[key] = {"label": label, "rows": rows[:16]}
    return {"streaks": out}


BUILDERS = {"hr": sheet_hr, "hot": sheet_hot, "matchups": sheet_matchups, "bvp": sheet_bvp, "nrfi": sheet_nrfi,
            "park": sheet_park, "strikeouts": sheet_strikeouts, "streaks": sheet_streaks}


def resolve_day(value):
    """'today' (the board's day), 'tomorrow', or an ISO date within a week of today."""
    today = Date.fromisoformat(vortex_board_day())
    if value in (None, "", "today"):
        return today.isoformat()
    if value == "tomorrow":
        return (today + timedelta(days=1)).isoformat()
    try:
        asked = Date.fromisoformat(value)
    except ValueError:
        raise ValueError("Unknown day")
    if abs((asked - today).days) > 7:
        raise ValueError("Unknown day")
    return asked.isoformat()


def sheet(name, day=None):
    """One sheet for one day, built once and kept for SHEET_TTL."""
    if name not in BUILDERS:
        raise ValueError("Unknown sheet")
    day = resolve_day(day)

    def load():
        import time
        data = slate(day)
        games = [{"gamePk": game["gamePk"], "startsAt": game["startsAt"], "away": game["away"]["abbr"], "home": game["home"]["abbr"],
                  "awayId": game["away"]["id"], "homeId": game["home"]["id"], "venue": game["venue"],
                  "confirmed": bool(game["away"].get("confirmed") and game["home"].get("confirmed"))} for game in data["games"]]
        return {"sheet": name, "day": day, "games": games, "updatedAt": int(time.time() * 1000), **BUILDERS[name](data)}

    return cached(("mlb-sheet", name, day), SHEET_TTL, load)
