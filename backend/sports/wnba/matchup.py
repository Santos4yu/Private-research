"""One game's matchup context, from ESPN's game summary.

The prop board comes from The Odds API, which has its own event ids, so the
game is found on ESPN's scoreboard by its two teams around its start time.
Everything returned is ESPN's own published data: the pregame odds line it
carries (DraftKings), its Matchup Predictor, both teams' last five games,
the conference standings and both injury reports.
"""
from __future__ import annotations

import json
import re
import time
from datetime import datetime, timedelta, timezone

from .league import espn, setex, team_directory

CACHE_SECONDS = 10 * 60
_memory: dict = {}


def _store():
    from v2.board import store
    return store


def _cached(key):
    hit = _memory.get(key)
    if hit and time.time() - hit[0] < CACHE_SECONDS:
        return hit[1]
    try:
        raw = _store().get(key)
        envelope = json.loads(raw) if raw else None
        if envelope and time.time() - float(envelope.get("at", 0)) < CACHE_SECONDS:
            _memory[key] = (float(envelope["at"]), envelope["value"])
            return envelope["value"]
    except Exception:  # noqa: BLE001
        pass
    return None


def _remember(key, value):
    now = time.time()
    _memory[key] = (now, value)
    setex(key, json.dumps({"at": now, "value": value}, separators=(",", ":")), CACHE_SECONDS)


def find_event(home: str, away: str, starts_at: str, league: str = "wnba") -> str | None:
    """ESPN's id for the game between these two teams (abbreviations).

    Remembered once found: a game's id never changes, and finding it can
    take up to three scoreboard requests."""
    key = f"krazy_data:{league}:v1:event:{home}:{away}:{str(starts_at)[:10]}"
    hit = _memory.get(key)
    if hit:
        return hit[1]
    try:
        raw = _store().get(key)
        if raw:
            _memory[key] = (time.time(), raw)
            return raw
    except Exception:  # noqa: BLE001
        pass
    event_id = _find_event(home, away, starts_at, league)
    if event_id:
        _memory[key] = (time.time(), event_id)
        setex(key, event_id, 14 * 24 * 3600)
    return event_id


def _find_event(home: str, away: str, starts_at: str, league: str = "wnba") -> str | None:
    try:
        start = datetime.fromisoformat(str(starts_at).replace("Z", "+00:00"))
    except ValueError:
        return None
    # ESPN files games by US date; a late tip-off is the next day in UTC.
    local = start.astimezone(timezone(timedelta(hours=-4)))
    for offset in (0, -1, 1):
        day = (local + timedelta(days=offset)).strftime("%Y%m%d")
        try:
            events = espn("/scoreboard", {"dates": day}, league=league).get("events", [])
        except Exception:  # noqa: BLE001
            continue
        for event in events:
            sides = {c.get("homeAway"): (c.get("team") or {}).get("abbreviation")
                     for c in (event.get("competitions") or [{}])[0].get("competitors", [])}
            if sides.get("home") == home and sides.get("away") == away:
                return str(event["id"])
    return None


def _number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _implied(moneyline):
    if moneyline is None or abs(moneyline) < 100:
        return None
    return -moneyline / (-moneyline + 100) if moneyline < 0 else 100 / (moneyline + 100)


def _team(competitor):
    team = competitor.get("team") or {}
    records = {record.get("type"): record.get("summary") for record in competitor.get("record") or []}
    logo = next((logo.get("href") for logo in team.get("logos", []) if "default" in logo.get("rel", [])),
                team.get("logo"))
    return {"id": str(team.get("id")), "abbr": team.get("abbreviation"), "name": team.get("displayName"),
            "short": team.get("name"), "logo": logo, "color": team.get("color"),
            "altColor": team.get("alternateColor"),
            "side": competitor.get("homeAway"), "record": records.get("total"),
            "sideRecord": records.get("home") or records.get("road")}


def _odds(summary, teams):
    pick = (summary.get("pickcenter") or [None])[0]
    if not pick:
        return None
    home_odds, away_odds = pick.get("homeTeamOdds") or {}, pick.get("awayTeamOdds") or {}
    spread = _number(pick.get("spread"))
    home_ml, away_ml = _number(home_odds.get("moneyLine")), _number(away_odds.get("moneyLine"))
    result = {
        "provider": (pick.get("provider") or {}).get("name"),
        "total": _number(pick.get("overUnder")),
        "overOdds": _number(pick.get("overOdds")), "underOdds": _number(pick.get("underOdds")),
        "home": {"moneyline": home_ml, "spread": spread, "spreadOdds": _number(home_odds.get("spreadOdds"))},
        "away": {"moneyline": away_ml, "spread": -spread if spread is not None else None,
                 "spreadOdds": _number(away_odds.get("spreadOdds"))},
    }
    # The market's win chances with the bookmaker's margin taken out.
    home_p, away_p = _implied(home_ml), _implied(away_ml)
    if home_p and away_p:
        result["noVig"] = {"home": round(home_p / (home_p + away_p) * 100, 1),
                           "away": round(away_p / (home_p + away_p) * 100, 1)}
    return result


def _own_score_first(score, result):
    """ESPN writes these winner-first ("93-77" for a 77-93 loss, and
    "86-84 OT" with the overtime marker after both numbers)."""
    match = re.match(r"^\s*(\d+)-(\d+)(.*)$", str(score or ""))
    return f"{match[2]}-{match[1]}{match[3]}" if result == "L" and match else score


def _last_five(summary):
    result = {}
    for block in summary.get("lastFiveGames") or []:
        abbr = (block.get("team") or {}).get("abbreviation")
        if not abbr:
            continue
        result[abbr] = [{"id": event.get("id"), "date": event.get("gameDate"), "atVs": event.get("atVs"),
                         "opponent": (event.get("opponent") or {}).get("abbreviation"),
                         "opponentName": (event.get("opponent") or {}).get("displayName"),
                         "opponentLogo": event.get("opponentLogo"), "result": event.get("gameResult"),
                         "score": _own_score_first(event.get("score"), event.get("gameResult"))}
                        for event in block.get("events", [])]
    return result


def _standings(summary, teams_by_id):
    groups = []
    for group in (summary.get("standings") or {}).get("groups", []):
        entries = []
        for entry in (group.get("standings") or {}).get("entries", []):
            stats = {stat.get("name"): stat for stat in entry.get("stats", [])}
            meta = teams_by_id.get(str(entry.get("id"))) or {}
            entries.append({"id": str(entry.get("id")), "abbr": meta.get("abbr"), "name": meta.get("name") or entry.get("team"),
                            "logo": meta.get("logo"),
                            "wins": _number((stats.get("wins") or {}).get("value")),
                            "losses": _number((stats.get("losses") or {}).get("value")),
                            "pct": (stats.get("winPercent") or {}).get("displayValue"),
                            "gb": (stats.get("gamesBehind") or {}).get("displayValue"),
                            "streak": (stats.get("streak") or {}).get("displayValue")})
        header = str(group.get("header") or "")
        name = "East" if "East" in header else "West" if "West" in header else header
        groups.append({"name": name, "entries": entries})
    return groups


def _injuries(summary):
    result = {}
    for block in summary.get("injuries") or []:
        abbr = (block.get("team") or {}).get("abbreviation")
        if not abbr:
            continue
        listed = []
        for item in block.get("injuries", []):
            athlete = item.get("athlete") or {}
            details = item.get("details") or {}
            fantasy = (details.get("fantasyStatus") or {}).get("abbreviation")
            listed.append({"id": str(athlete.get("id") or ""), "name": athlete.get("displayName"),
                           "headshot": (athlete.get("headshot") or {}).get("href"),
                           "position": (athlete.get("position") or {}).get("abbreviation"),
                           "status": item.get("status"), "code": fantasy, "date": item.get("date"),
                           "injury": " ".join(part for part in (details.get("side"), details.get("type")) if part and part != "Not Specified") or None,
                           "detail": details.get("detail") if details.get("detail") not in (None, "Not Specified") else None,
                           "returnDate": details.get("returnDate"),
                           "comment": item.get("longComment") or item.get("shortComment")})
        result[abbr] = listed
    return result


def _series(summary):
    series = (summary.get("seasonseries") or [None])[0]
    if not series:
        return None
    games = []
    for event in series.get("events", []):
        sides = {c.get("homeAway"): c for c in event.get("competitors", [])}
        if "home" not in sides or "away" not in sides:
            continue
        games.append({"date": event.get("date"), "status": event.get("status"),
                      "home": (sides["home"].get("team") or {}).get("abbreviation"), "homeScore": sides["home"].get("score"),
                      "away": (sides["away"].get("team") or {}).get("abbreviation"), "awayScore": sides["away"].get("score")})
    return {"title": series.get("title"), "summary": series.get("summary"), "games": games}


def matchup(event_id: str, league: str = "wnba") -> dict:
    key = f"krazy_data:{league}:v1:matchup:{event_id}"
    cached = _cached(key)
    if cached is not None:
        return cached
    summary = espn("/summary", {"event": event_id}, timeout=20, league=league)
    competition = (summary.get("header") or {}).get("competitions", [{}])[0]
    teams = [_team(c) for c in competition.get("competitors", [])]
    teams.sort(key=lambda team: 0 if team["side"] == "away" else 1)
    predictor = summary.get("predictor") or {}
    home_p = _number((predictor.get("homeTeam") or {}).get("gameProjection"))
    away_p = _number((predictor.get("awayTeam") or {}).get("gameProjection"))
    venue = ((summary.get("gameInfo") or {}).get("venue") or {})
    status = (competition.get("status") or {}).get("type") or {}
    try:
        teams_by_id = {team["id"]: team for team in team_directory(league).values()}
    except Exception:  # noqa: BLE001
        teams_by_id = {}
    value = {
        "eventId": event_id, "startsAt": competition.get("date"),
        "status": {"state": status.get("state"), "detail": status.get("shortDetail") or status.get("detail")},
        "venue": {"name": venue.get("fullName"), "city": (venue.get("address") or {}).get("city"),
                  "state": (venue.get("address") or {}).get("state")},
        "teams": teams,
        "predictor": {"home": home_p, "away": away_p} if home_p is not None and away_p is not None else None,
        "odds": _odds(summary, teams),
        "lastFive": _last_five(summary),
        "standings": _standings(summary, teams_by_id),
        "injuries": _injuries(summary),
        "series": _series(summary),
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }
    _remember(key, value)
    return value
