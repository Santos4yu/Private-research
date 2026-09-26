"""ESPN pregame matchup predictor. Never infer missing projections from odds."""
from datetime import datetime, timezone
from functools import lru_cache
import math
import re
import time
import requests

BASE = "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb"

def key(value):
    value = re.sub(r"[^a-z0-9]", "", str(value or "").lower())
    return {"ath":"oak", "athletics":"oak", "wsh":"wsh", "was":"wsh", "az":"ari", "cws":"chw", "kc":"kc", "kcr":"kc", "sfg":"sf", "sdp":"sd", "tbr":"tb"}.get(value, value)

def identify_event(events, team, opponent, start):
    matches = []
    for event in events:
        competitors = (event.get("competitions") or [{}])[0].get("competitors", [])
        names = [{key(c.get("team", {}).get(field)) for field in ("abbreviation", "displayName", "shortDisplayName", "name")} - {""} for c in competitors]
        if len(names) != 2 or not any(key(team) in names[i] and key(opponent) in names[1-i] for i in (0,1)):
            continue
        try:
            difference = abs((datetime.fromisoformat(event["date"].replace("Z", "+00:00")) - start).total_seconds())
        except (KeyError, ValueError, TypeError):
            continue
        if difference <= 3600:
            matches.append(event)
    # Doubleheaders and ambiguous identities must not silently choose game one.
    return matches[0] if len(matches) == 1 else None

def parse_predictor(summary, event):
    predictor = summary.get("predictor") or {}
    competitors = (event.get("competitions") or [{}])[0].get("competitors", [])
    result = {}
    for side in ("home", "away"):
        competitor = next((c for c in competitors if c.get("homeAway") == side), {})
        team = competitor.get("team") or {}
        projection = predictor.get(side + "Team") or {}
        if not team.get("id") or str(projection.get("id")) != str(team["id"]):
            return None
        try:
            chance = float(projection["gameProjection"])
        except (KeyError, TypeError, ValueError):
            return None
        if not math.isfinite(chance) or not 0 <= chance <= 100:
            return None
        color = str(team.get("color") or "")
        result[side] = {"id":team["id"], "name":team.get("displayName"), "abbr":team.get("abbreviation"), "percent":chance,
                        "logo":team.get("logo"), "color":"#"+color if re.fullmatch(r"[0-9a-fA-F]{6}",color) else ("#488dff" if side=="home" else "#f0b34d"),
                        "record":next((r.get("summary") for r in competitor.get("records",[]) if r.get("type")=="total"),None)}
    if abs(result["home"]["percent"] + result["away"]["percent"] - 100) > 0.3:
        return None
    return {**result, "available":True, "eventId":event["id"], "startsAt":event["date"], "source":"ESPN Analytics", "sourceUrl":f'https://www.espn.com/mlb/game/_/gameId/{event["id"]}', "fetchedAt":datetime.now(timezone.utc).isoformat()}

@lru_cache(maxsize=64)
def _json(resource, query, bucket):
    response=requests.get(BASE+'/'+resource,params=dict(query),timeout=10)
    response.raise_for_status()
    return response.json()

def get_matchup(team, opponent, starts_at):
    start=datetime.fromisoformat(starts_at.replace('Z','+00:00'))
    if start.tzinfo is None:
        raise ValueError('Game start must include timezone')
    start=start.astimezone(timezone.utc)
    bucket=int(time.time()//300)
    scoreboard=_json('scoreboard',(('dates',start.strftime('%Y%m%d')),),bucket)
    event=identify_event(scoreboard.get('events',[]),team,opponent,start)
    if not event:
        return {"available":False,"reason":"ESPN matchup could not be matched to this game."}
    summary=_json('summary',(('event',str(event['id'])),),bucket)
    return parse_predictor(summary,event) or {"available":False,"reason":"ESPN has not provided a pregame predictor for this matchup."}
