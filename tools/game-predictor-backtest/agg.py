"""Stream nflverse play-by-play per season into team-game and QB-game EPA tables."""
import csv, gzip, io, json, sys, urllib.request
from collections import defaultdict
URL="https://github.com/nflverse/nflverse-data/releases/download/pbp/play_by_play_{}.csv.gz"
def f(x):
    try: return float(x)
    except (TypeError, ValueError): return None
def run(season):
    raw=urllib.request.urlopen(urllib.request.Request(URL.format(season),headers={"User-Agent":"Mozilla/5.0"}),timeout=120).read()
    rows=csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=io.BytesIO(raw)),encoding="utf-8"))
    team=defaultdict(lambda: defaultdict(float)); qb=defaultdict(lambda: defaultdict(float)); names={}
    for r in rows:
        pt=r.get("play_type")
        if pt not in ("pass","run") or r.get("qb_kneel")=="1" or r.get("qb_spike")=="1" or r.get("two_point_attempt")=="1": continue
        epa=f(r.get("epa"))
        if epa is None: continue
        g,o,d=r["game_id"],r["posteam"],r["defteam"]
        if not o or not d: continue
        dropback=r.get("qb_dropback")=="1"; succ=f(r.get("success")) or 0
        to=(1 if r.get("interception")=="1" else 0)+(1 if r.get("fumble_lost")=="1" else 0)
        for side,t in (("o",o),("d",d)):
            x=team[(g,t,side)]
            x["plays"]+=1; x["epa"]+=epa; x["succ"]+=succ; x["to"]+=to
            if dropback: x["db"]+=1; x["db_epa"]+=epa
            else: x["rush"]+=1; x["rush_epa"]+=epa
        if dropback and r.get("id"):
            q=qb[(g,o,r["id"])]; q["db"]+=1; q["epa"]+=f(r.get("qb_epa")) if f(r.get("qb_epa")) is not None else epa
            names[r["id"]]=r.get("passer_player_name") or r.get("name") or names.get(r["id"],"")
    out={"team":[{"game":g,"team":t,"side":s,**v} for (g,t,s),v in team.items()],
         "qb":[{"game":g,"team":t,"qb":p,"name":names.get(p,""),**v} for (g,t,p),v in qb.items()]}
    json.dump(out,open(f"pbp_{season}.json","w"))
    print(season,len(out["team"]),len(out["qb"]),flush=True)
for s in sys.argv[1:]: run(int(s))
