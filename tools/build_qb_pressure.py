"""Writes data/nfl/qb-pressure-<season>.json: each quarterback's runs under
pressure over a finished season, from nflverse's play by play and the NFL's
per-play pressure (the participation file). nfl_scouting.py reads it as
"last season" while the current season's pressure isn't out yet.

    python3 tools/build_qb_pressure.py 2025
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import nfl_scouting as scouting  # noqa: E402
from backend.sports.nfl.services.nflverse import RELEASE  # noqa: E402


def build(season):
    names, plays = {}, []
    for row in scouting._rows(f"{RELEASE}/pbp/play_by_play_{season}.csv.gz", gz=True):
        for side in ("passer", "rusher"):
            if scouting._present(row.get(f"{side}_player_id")) and scouting._present(row.get(f"{side}_player_name")):
                names[row[f"{side}_player_id"]] = row[f"{side}_player_name"]
        plays.append({key: row.get(key) for key in scouting.PBP_FIELDS})
    pressure = scouting.pressure_plays(season)
    if not pressure["games"]:
        raise SystemExit(f"No participation file for {season} yet.")
    table = scouting.summarize(plays, {}, {}, {}, {}, pressure_plays=pressure)
    players = {}
    for pid, entry in table["players"].items():
        games = [game for game in (entry.get("qbRush") or {}).get("games", [])
                 if game["underPressure"] is not None and game["dropbacks"] >= scouting.START_DROPBACKS]
        if len(games) < scouting.MIN_QB_GAMES:
            continue
        under = [game["underPressure"] for game in games]
        players[pid] = {"name": names.get(pid), "team": games[-1]["team"], "games": len(games),
                        "pressured": sum(item["dropbacks"] for item in under), "scrambles": sum(item["scrambles"] for item in under),
                        "yards": sum(item["yards"] for item in under), "sacks": sum(item["sacks"] for item in under)}
    return {"season": season, "players": dict(sorted(players.items())), "source": "nflverse play by play and participation",
            "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds")}


if __name__ == "__main__":
    season = int(sys.argv[1])
    out = scouting.PRESSURE_FILE.with_name(scouting.PRESSURE_FILE.name.format(season=season))
    out.parent.mkdir(parents=True, exist_ok=True)
    result = build(season)
    out.write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    print(f"{len(result['players'])} quarterbacks -> {out}")
