"""Soccer research for the Finder, from ESPN's public soccer feed.

Three things, all keyed on ESPN's own ids:

* fixtures() -- every upcoming match in the competitions PrizePicks covers,
  so each PrizePicks line can be pinned to its match (match_fixture).
* team_log() -- a team's recent matches: the team's and its opponent's
  match stats, and every player's line in them. The board's hit rates, the
  player page's chart and game log, Team Comparison and Similar all read it.
* match() -- the match's own context: form, head to head, standings,
  lineups and the moneyline.

Finished matches never change, so each one is reduced to a small record
and kept for weeks; everything else is kept for minutes.
"""
import json
import re
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import requests

from v2.board import store

ESPN = "https://site.api.espn.com/apis/site/v2/sports/soccer"
# The competitions scanned for fixtures -- the ones PrizePicks posts lines
# for. A slug ESPN doesn't know just comes back empty.
LEAGUES = (
    "eng.1", "eng.2", "eng.fa", "eng.league_cup", "esp.1", "esp.copa_del_rey", "ger.1", "ger.dfb_pokal",
    "ita.1", "ita.coppa_italia", "fra.1", "fra.coupe_de_france", "ned.1", "por.1", "sco.1", "bel.1", "tur.1",
    "ksa.1", "usa.1", "usa.nwsl", "mex.1", "bra.1", "arg.1", "uefa.champions", "uefa.europa",
    "uefa.europa.conf", "uefa.nations", "uefa.euroq", "uefa.wchampions", "fifa.friendly", "fifa.worldq.uefa",
    "fifa.worldq.conmebol", "fifa.worldq.concacaf", "fifa.worldq.afc", "fifa.worldq.caf", "fifa.world",
    "fifa.cwc", "conmebol.libertadores", "conmebol.sudamericana", "concacaf.champions",
    "concacaf.nations.league", "concacaf.gold",
)
SLUG = re.compile(r"^[a-z0-9._]{2,40}$")
ID = re.compile(r"^\d{1,12}$")
LOG_GAMES = 20
FIXTURE_DAYS = 4

# ESPN's per-player match stats, under the keys the Finder uses. Any other
# number ESPN adds later is kept under its own name.
PLAYER_STATS = {
    "totalGoals": "goals", "goalAssists": "ast", "totalShots": "shots", "shotsOnTarget": "sot",
    "saves": "saves", "goalsConceded": "gc", "shotsFaced": "sotf", "foulsCommitted": "fouls",
    "foulsSuffered": "fd", "offsides": "off", "yellowCards": "yc", "redCards": "rc", "ownGoals": "og",
    "totalPasses": "passAtt", "accuratePasses": "passes", "totalTackles": "tackles", "effectiveTackles": "tacklesWon",
    "totalClearance": "clear", "totalCrosses": "cross", "accurateCrosses": "crossAcc", "touches": "touch",
    "shotAssists": "sa", "keyPasses": "sa", "totalDribbles": "drib", "dribbles": "drib", "interceptions": "int",
    "blockedShots": "blk",
}
SKIP_STATS = {"appearances", "subIns"}

_memory = {}
_lock = threading.Lock()


# ---------------------------------------------------------------- plumbing

def _get(url, timeout=10):
    response = requests.get(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"}, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _cached(key, seconds, build, *, keep=None):
    """build(), kept in memory and in KV for `seconds`. `keep(value)` says
    whether a value may be stored at all (an unfinished match may not)."""
    now = time.time()
    with _lock:
        hit = _memory.get(key)
        if hit and now - hit[0] < seconds:
            return hit[1]
    try:
        raw = store.get(key)
        envelope = json.loads(raw) if raw else None
        if envelope and now - float(envelope.get("at", 0)) < seconds:
            with _lock:
                _memory[key] = (float(envelope["at"]), envelope["value"])
            return envelope["value"]
    except Exception:
        pass
    value = build()
    if keep is None or keep(value):
        with _lock:
            _memory[key] = (now, value)
            if len(_memory) > 2000:
                for stale in sorted(_memory, key=lambda item: _memory[item][0])[:500]:
                    _memory.pop(stale, None)
        try:
            store.set(key, json.dumps({"at": now, "value": value}, separators=(",", ":")), ex=int(seconds))
        except Exception:
            pass
    return value


def _norm(value):
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]", " ", text.casefold()).split())


_CLUB_WORDS = {"fc", "cf", "sc", "afc", "ac", "club", "de", "the", "cd", "ud", "sv", "fk", "sk", "bk", "if", "calcio", "1", "04", "05", "09"}


def _name_words(value):
    return {word for word in _norm(value).split() if word not in _CLUB_WORDS and len(word) > 1}


def _number(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace("%", "").strip())
    except (TypeError, ValueError):
        return None


def _timestamp(value):
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _logo(team):
    if team.get("logo"):
        return team["logo"]
    for logo in team.get("logos") or []:
        if logo.get("href"):
            return logo["href"]
    return None


def _team(raw):
    raw = raw or {}
    return {"id": str(raw.get("id") or ""), "abbr": raw.get("abbreviation") or "", "name": raw.get("displayName") or raw.get("name") or "",
            "short": raw.get("shortDisplayName") or raw.get("displayName") or "", "logo": _logo(raw),
            "color": raw.get("color"), "altColor": raw.get("alternateColor")}


def valid_slug(value):
    return bool(SLUG.match(str(value or "")))


def valid_id(value):
    return bool(ID.match(str(value or "")))


# ---------------------------------------------------------------- odds

def _american(value):
    number = _number(value)
    return number if number is not None and abs(number) >= 100 else None


def _chance(price):
    return -price / (-price + 100) if price < 0 else 100 / (price + 100)


def three_way(home, draw, away):
    """No-vig home / draw / away chances (percent) from American moneylines."""
    prices = [_american(home), _american(draw), _american(away)]
    if prices[0] is None or prices[2] is None:
        return None
    raw = [_chance(price) if price is not None else None for price in prices]
    total = sum(value for value in raw if value is not None)
    return {side: round(value / total * 100, 1) if value is not None else None
            for side, value in zip(("home", "draw", "away"), raw)}


def _odds(raw):
    if not isinstance(raw, dict):
        return None

    def line(side):
        # Newer feeds nest the price (moneyline.home.close.odds); older ones
        # put it on homeTeamOdds.moneyLine.
        nested = ((raw.get("moneyline") or {}).get(side) or {})
        price = (nested.get("close") or nested.get("open") or {}).get("odds")
        if price is None:
            price = (raw.get(f"{side}TeamOdds") or raw.get(f"{side}Odds") or {}).get("moneyLine")
        return _american(price)

    home, draw, away = line("home"), line("draw"), line("away")
    if home is None and away is None:
        return None
    provider = (raw.get("provider") or {}).get("name")
    return {"provider": provider, "home": home, "draw": draw, "away": away, "noVig": three_way(home, draw, away)}


# ---------------------------------------------------------------- fixtures

def _fixture(event, slug, league_name):
    competition = (event.get("competitions") or [{}])[0]
    sides = {}
    for competitor in competition.get("competitors") or []:
        side = competitor.get("homeAway")
        if side in ("home", "away"):
            sides[side] = {**_team(competitor.get("team")), "record": ((competitor.get("records") or [{}])[0]).get("summary"),
                           "form": competitor.get("form")}
    if len(sides) != 2:
        return None
    status = ((competition.get("status") or event.get("status") or {}).get("type") or {})
    venue = competition.get("venue") or {}
    return {"id": str(event.get("id")), "league": slug, "leagueName": league_name, "date": event.get("date") or competition.get("date"),
            "state": status.get("state"), "home": sides["home"], "away": sides["away"],
            "odds": _odds((competition.get("odds") or [None])[0]),
            "venue": venue.get("fullName"), "city": (venue.get("address") or {}).get("city")}


def _scoreboard(slug, start, end):
    data = _get(f"{ESPN}/{slug}/scoreboard?dates={start:%Y%m%d}-{end:%Y%m%d}&limit=300")
    league = (data.get("leagues") or [{}])[0]
    name = league.get("name") or league.get("abbreviation") or slug
    fixtures = []
    for event in data.get("events") or []:
        fixture = _fixture(event, slug, name)
        if fixture:
            fixtures.append(fixture)
    return fixtures


def fixtures(now=None):
    """Upcoming and live matches over the next few days, every competition."""
    def build():
        today = datetime.fromtimestamp(now or time.time(), timezone.utc) - timedelta(hours=6)
        end = today + timedelta(days=FIXTURE_DAYS)

        def load(slug):
            try:
                return _scoreboard(slug, today, end)
            except Exception:
                return []

        with ThreadPoolExecutor(max_workers=12) as pool:
            found = [fixture for batch in pool.map(load, LEAGUES) for fixture in batch]
        unique = {}
        for fixture in found:
            unique.setdefault(fixture["id"], fixture)
        return sorted(unique.values(), key=lambda item: item.get("date") or "")
    return _cached("soccer:fixtures:v1", 10 * 60, build, keep=lambda value: bool(value))


def _side_score(side, abbr, name):
    score = 0
    if abbr and side.get("abbr") and abbr.upper() == side["abbr"].upper():
        score += 3
    words = _name_words(name)
    if words:
        theirs = _name_words(side.get("name")) | _name_words(side.get("short"))
        overlap = len(words & theirs)
        if overlap:
            score += 2 if overlap == len(words) else 1
    return score


def match_fixture(team, opponent, starts_at, fixture_list, team_name=None):
    """The ESPN match a PrizePicks line belongs to, and which side is the
    player's: the match starting within a few hours whose teams best match
    the line's team and opponent (by abbreviation, then by name)."""
    starts = _timestamp(starts_at)
    best = None
    for fixture in fixture_list:
        when = _timestamp(fixture.get("date"))
        if starts is not None and when is not None and abs(when - starts) > 3 * 3600:
            continue
        for side, other in (("home", "away"), ("away", "home")):
            mine = _side_score(fixture[side], team, team_name)
            theirs = _side_score(fixture[other], opponent, None)
            if not mine and not theirs:
                continue
            # One side known and the kickoff exact is enough; otherwise both.
            close = starts is not None and when is not None and abs(when - starts) <= 20 * 60
            if not (mine and theirs) and not close:
                continue
            score = (mine + theirs, -(abs(when - starts) if starts is not None and when is not None else 0))
            if best is None or score > best[0]:
                best = (score, fixture, side)
    if not best:
        return None
    _, fixture, side = best
    other = "away" if side == "home" else "home"
    chance = (fixture.get("odds") or {}).get("noVig") or {}
    return {"eventId": fixture["id"], "league": fixture["league"], "leagueName": fixture["leagueName"],
            "isHome": side == "home", "team": fixture[side], "opponent": fixture[other],
            "homeTeam": fixture["home"], "awayTeam": fixture["away"], "winChance": chance.get(side), "drawChance": chance.get("draw")}


# ---------------------------------------------------------------- match records

def _clock_minute(clock):
    """ESPN's match clock ("67'", "90'+3'") as a minute."""
    text = str((clock or {}).get("displayValue") or "")
    parts = [int(part) for part in re.findall(r"\d+", text)]
    if parts:
        return sum(parts[:2])
    seconds = _number((clock or {}).get("value"))
    return round(seconds / 60) if seconds is not None else None


def _did_sub(value):
    return bool(value.get("didSub")) if isinstance(value, dict) else bool(value)


def _player(entry, length):
    athlete = entry.get("athlete") or {}
    stats = {}
    for stat in entry.get("stats") or []:
        name = stat.get("name")
        value = _number(stat.get("value"))
        if not name or name in SKIP_STATS or value is None:
            continue
        stats[PLAYER_STATS.get(name, name)] = value
    starter = bool(entry.get("starter"))
    came_on, went_off = _did_sub(entry.get("subbedIn")), _did_sub(entry.get("subbedOut"))
    if not starter and not came_on:
        return None
    # When he came on and went off: his substitution plays, or the clock on
    # ESPN's subbedIn / subbedOut objects.
    subs = [play for play in entry.get("plays") or [] if play.get("substitution")]
    if not subs:
        subs = [value for value in (entry.get("subbedIn"), entry.get("subbedOut")) if isinstance(value, dict) and value.get("didSub")]
    moments = [_clock_minute(item.get("clock")) for item in subs]
    moments = [minute for minute in moments if minute is not None]
    on = 0 if starter else (moments[0] if moments else None)
    off = length
    if went_off:
        later = moments[1:] if not starter else moments
        off = later[0] if later else None
    minutes = max(0, min(length, off) - on) if on is not None and off is not None else None
    position = entry.get("position") or {}
    return {"id": str(athlete.get("id") or ""), "name": athlete.get("displayName") or athlete.get("fullName") or "",
            "pos": position.get("abbreviation") or position.get("name") or "", "starter": starter,
            "jersey": entry.get("jersey"), "min": minutes, "s": stats}


def _form_events(summary):
    found = {}
    for block in ((summary.get("boxscore") or {}).get("form") or []):
        team_id = str(((block.get("team") or {}).get("id")) or "")
        found[team_id] = [{"id": str(event.get("id")), "date": event.get("gameDate") or event.get("date"),
                           "league": event.get("leagueSlug") or None}
                          for event in block.get("events") or [] if event.get("id")]
    return found


def record(summary, slug):
    """A finished (or live) match reduced to what the Finder reads."""
    header = summary.get("header") or {}
    competition = (header.get("competitions") or [{}])[0]
    status = ((competition.get("status") or {}).get("type") or {})
    detail = " ".join(str(status.get(key) or "") for key in ("name", "detail", "shortDetail")).upper()
    length = 120 if ("AET" in detail or "PEN" in detail or "EXTRA" in detail) else 90
    teams = []
    for competitor in competition.get("competitors") or []:
        teams.append({**_team(competitor.get("team")), "side": competitor.get("homeAway"),
                      "score": _number(competitor.get("score")), "winner": competitor.get("winner")})
    stats = {}
    for block in ((summary.get("boxscore") or {}).get("teams") or []):
        team_id = str(((block.get("team") or {}).get("id")) or "")
        values = {}
        for stat in block.get("statistics") or []:
            number = _number(stat.get("displayValue") if stat.get("displayValue") is not None else stat.get("value"))
            if stat.get("name") and number is not None:
                values[stat["name"]] = number
        stats[team_id] = values
    players = {}
    for roster in summary.get("rosters") or []:
        team_id = str(((roster.get("team") or {}).get("id")) or "")
        lineup = [player for player in (_player(entry, length) for entry in roster.get("roster") or []) if player]
        players[team_id] = lineup
    league = header.get("league") or {}
    return {"id": str(header.get("id") or competition.get("id") or ""), "date": competition.get("date"),
            "league": league.get("slug") or slug, "leagueName": league.get("name") or league.get("abbreviation") or "",
            "completed": bool(status.get("completed")), "teams": teams, "stats": stats, "players": players,
            "form": _form_events(summary)}


def _summary(event_id, slug):
    for league in dict.fromkeys([slug or "all", "all"]):
        try:
            return _get(f"{ESPN}/{league}/summary?event={event_id}", timeout=12), league
        except Exception:
            continue
    raise RuntimeError("ESPN has no summary for this match.")


def event_record(event_id, slug=None):
    def build():
        summary, league = _summary(event_id, slug)
        return record(summary, league)
    # A finished match is kept for weeks; one still being played, briefly.
    value = _cached(f"soccer:event:v1:{event_id}", 45 * 86400, build, keep=lambda value: value.get("completed"))
    return value


# ---------------------------------------------------------------- team logs

def _schedule_events(team_id, slug, before):
    found = {}
    for league in dict.fromkeys([slug, "all"]):
        if not league:
            continue
        try:
            data = _get(f"{ESPN}/{league}/teams/{team_id}/schedule")
        except Exception:
            continue
        for event in data.get("events") or []:
            competition = (event.get("competitions") or [{}])[0]
            state = (((competition.get("status") or event.get("status") or {}).get("type")) or {})
            when = _timestamp(event.get("date"))
            if not state.get("completed") or when is None or when >= before:
                continue
            event_league = ((event.get("league") or {}).get("slug")) or league
            found[str(event.get("id"))] = {"id": str(event.get("id")), "date": event.get("date"), "league": event_league}
    return found


def _game_for(record_value, team_id):
    mine = next((team for team in record_value["teams"] if team["id"] == team_id), None)
    other = next((team for team in record_value["teams"] if team["id"] != team_id), None)
    if not mine or not other:
        return None
    goals, against = mine.get("score"), other.get("score")
    result = None
    if goals is not None and against is not None:
        result = "W" if goals > against else "L" if goals < against else "D"
    return {"id": record_value["id"], "date": record_value["date"], "league": record_value["league"], "leagueName": record_value["leagueName"],
            "isHome": mine.get("side") == "home", "opponent": {key: other.get(key) for key in ("id", "abbr", "name", "logo")},
            "goals": goals, "against": against, "result": result,
            "score": f"{int(goals)}-{int(against)}" if goals is not None and against is not None else None,
            "teamStats": record_value["stats"].get(team_id, {}), "oppStats": record_value["stats"].get(other["id"], {}),
            "players": record_value["players"].get(team_id, []), "oppPlayers": record_value["players"].get(other["id"], [])}


def team_log(team_id, event_id=None, slug=None, games=LOG_GAMES):
    """The team's last `games` finished matches before this one, newest last."""
    def build():
        before = time.time() + 3600
        known = {}
        if event_id:
            try:
                current = _summary(event_id, slug)[0]
                when = _timestamp(((current.get("header") or {}).get("competitions") or [{}])[0].get("date"))
                before = when or before
                for item in _form_events(current).get(team_id, []):
                    known.setdefault(item["id"], {**item, "league": item.get("league") or slug})
            except Exception:
                pass
        known.update({key: value for key, value in _schedule_events(team_id, slug, before).items() if key not in known})
        records, chained = {}, set()

        def load(item):
            try:
                return event_record(item["id"], item.get("league"))
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=8) as pool:
            for _ in range(5):
                wanted = sorted((item for key, item in known.items() if key not in records),
                                key=lambda item: item.get("date") or "", reverse=True)[:max(0, games - len(records))]
                for item, value in zip(wanted, pool.map(load, wanted)):
                    records[item["id"]] = value
                usable = [value for value in records.values() if value and value.get("completed")]
                if len(usable) >= games:
                    break
                # Walk further back through the oldest match's own form.
                oldest = sorted((value for value in usable if value["id"] not in chained), key=lambda value: value.get("date") or "")
                if not oldest:
                    break
                grew = False
                for value in oldest[:2]:
                    chained.add(value["id"])
                    for item in value.get("form", {}).get(team_id, []):
                        when = _timestamp(item.get("date"))
                        if item["id"] not in known and (when is None or when < before):
                            known[item["id"]] = {**item, "league": item.get("league") or value.get("league")}
                            grew = True
                if not grew:
                    break
        played = [value for value in records.values() if value and value.get("completed") and (_timestamp(value.get("date")) or 0) < before]
        played.sort(key=lambda value: value.get("date") or "")
        rows = [game for game in (_game_for(value, team_id) for value in played[-games:]) if game]
        team = None
        for value in played:
            team = next((item for item in value["teams"] if item["id"] == team_id), None) or team
        return {"team": {key: (team or {}).get(key) for key in ("id", "abbr", "name", "logo", "color", "altColor")},
                "games": rows, "builtAt": datetime.now(timezone.utc).isoformat()}
    return _cached(f"soccer:teamlog:v1:{team_id}:{event_id or 'latest'}", 3 * 3600, build, keep=lambda value: bool(value["games"]))


# ---------------------------------------------------------------- club matches

_TEAM_REF = re.compile(r"/leagues/([a-z0-9._]+)/(?:.*/)?teams/(\d+)|/teams/(\d+)")


def _club_from(data):
    athlete = data.get("athlete") if isinstance(data.get("athlete"), dict) else data
    team = athlete.get("team") or {}
    league = ((athlete.get("defaultLeague") or {}).get("slug")) or None
    team_id = str(team.get("id") or "")
    ref = team.get("$ref") or ""
    found = _TEAM_REF.search(ref) if ref else None
    if found:
        league = league or found.group(1)
        team_id = team_id or found.group(2) or found.group(3) or ""
    if not team_id:
        return None
    return {"id": team_id, "league": league if league and valid_slug(league) else None,
            "name": team.get("displayName") or team.get("name") or ""}


def athlete_club(athlete_id):
    """The club an ESPN player plays for (its id and league), from his ESPN
    profile; {} when ESPN doesn't say."""
    def build():
        for url in (f"https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/{athlete_id}",
                    f"https://sports.core.api.espn.com/v2/sports/soccer/athletes/{athlete_id}"):
            try:
                found = _club_from(_get(url))
            except Exception:
                continue
            if found:
                return found
        return {}
    return _cached(f"soccer:club:v1:{athlete_id}", 86400, build, keep=lambda value: bool(value))


def club_log(athlete_id, team_id):
    """His club's recent matches when he is away with his country (the
    match's own team is `team_id`); nothing when the club is that team."""
    club = athlete_club(athlete_id)
    if not club or club["id"] == str(team_id):
        return {"team": None, "games": []}
    return team_log(club["id"], None, club.get("league"))


# ---------------------------------------------------------------- match context

def _form_rows(block):
    rows = []
    for event in block.get("events") or []:
        opponent = event.get("opponent") or {}
        rows.append({"id": str(event.get("id") or ""), "date": event.get("gameDate") or event.get("date"),
                     "atVs": event.get("atVs") or "", "opponent": opponent.get("abbreviation") or opponent.get("displayName") or "",
                     "opponentName": opponent.get("displayName") or "", "opponentLogo": _logo(opponent),
                     "result": event.get("gameResult") or "", "score": event.get("score") or "",
                     "league": event.get("leagueName") or event.get("leagueAbbreviation") or ""})
    return rows


def _standings(summary):
    groups = []
    raw = summary.get("standings") or {}
    for group in raw.get("groups") or []:
        entries = []
        for entry in ((group.get("standings") or {}).get("entries") or []):
            team = entry.get("team")
            name = team.get("displayName") if isinstance(team, dict) else team
            stats = {stat.get("name") or stat.get("type"): _number(stat.get("value") if stat.get("value") is not None else stat.get("displayValue"))
                     for stat in entry.get("stats") or []}
            logos = entry.get("logo") or (team.get("logos") if isinstance(team, dict) else None) or []
            entries.append({"id": str(entry.get("id") or (team.get("id") if isinstance(team, dict) else "") or ""), "name": name or "",
                            "logo": logos[0].get("href") if logos and isinstance(logos[0], dict) else None,
                            "rank": stats.get("rank"), "played": stats.get("gamesPlayed"), "wins": stats.get("wins"),
                            "draws": stats.get("ties"), "losses": stats.get("losses"),
                            "gd": stats.get("pointDifferential"), "points": stats.get("points")})
        entries.sort(key=lambda item: (item["rank"] is None, item["rank"] or 0))
        if entries:
            groups.append({"name": group.get("header") or group.get("name") or "", "entries": entries})
    return groups


def _lineups(summary):
    lineups = {}
    for roster in summary.get("rosters") or []:
        team_id = str(((roster.get("team") or {}).get("id")) or "")
        players = []
        for entry in roster.get("roster") or []:
            athlete, position = entry.get("athlete") or {}, entry.get("position") or {}
            players.append({"id": str(athlete.get("id") or ""), "name": athlete.get("displayName") or "", "jersey": entry.get("jersey"),
                            "pos": position.get("abbreviation") or "", "starter": bool(entry.get("starter")),
                            "place": entry.get("formationPlace")})
        if players:
            lineups[team_id] = {"formation": roster.get("formation"), "players": players}
    return lineups


def match(event_id, slug=None):
    def build():
        summary, league = _summary(event_id, slug)
        header = summary.get("header") or {}
        competition = (header.get("competitions") or [{}])[0]
        teams = [{**_team(item.get("team")), "side": item.get("homeAway"), "record": ((item.get("record") or [{}])[0]).get("summary") if isinstance(item.get("record"), list) else None}
                 for item in competition.get("competitors") or []]
        teams.sort(key=lambda team: team.get("side") != "home")
        form = {}
        for block in ((summary.get("boxscore") or {}).get("form") or []):
            form[str(((block.get("team") or {}).get("id")) or "")] = _form_rows(block)[:5]
        h2h = []
        for block in summary.get("headToHeadGames") or []:
            h2h.extend(_form_rows(block))
        odds = None
        for candidate in (summary.get("pickcenter") or []) + (competition.get("odds") or []):
            odds = _odds(candidate)
            if odds:
                break
        info = summary.get("gameInfo") or {}
        venue = info.get("venue") or {}
        status = ((competition.get("status") or {}).get("type") or {})
        return {"id": str(event_id), "league": (header.get("league") or {}).get("slug") or league,
                "leagueName": (header.get("league") or {}).get("name") or "", "date": competition.get("date"),
                "status": status.get("shortDetail") or status.get("detail"), "teams": teams, "form": form,
                "h2h": h2h[:10], "standings": _standings(summary), "lineups": _lineups(summary), "odds": odds,
                "venue": {"name": venue.get("fullName"), "city": (venue.get("address") or {}).get("city")}}
    return _cached(f"soccer:match:v1:{event_id}", 15 * 60, build)
