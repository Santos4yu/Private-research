"""Writes data/nfl/coverage-<season>.json: a finished season's targets
against man, Cover 3 and split-safety coverage, for every receiver,
quarterback and defense, from nflverse's play by play and the NFL's
participation file. nfl_plays.py reads it as "last season" while the
current season's coverage isn't out yet (it comes after the season ends).

    python3 tools/build_nfl_coverage.py 2025
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import nfl_plays as plays  # noqa: E402
from backend.sports.nfl.services.nflverse import RELEASE  # noqa: E402


def build(season):
    coverage = plays.coverage_of(season)
    if coverage is None:
        raise SystemExit(f"No participation file for {season} yet.")
    weekly = list(plays._read(f"{RELEASE}/stats_player/stats_player_week_{season}.csv", plays.WEEKLY_FIELDS))
    rows = plays._read(f"{RELEASE}/pbp/play_by_play_{season}.csv.gz", plays.PBP_FIELDS, gz=True)
    table = plays.summarize(rows, {}, weekly, coverage=coverage)
    players = {}
    for pid, entry in table["players"].items():
        cells = {kind: {"coverage": entry[kind]["coverage"]} for kind in ("target", "pass") if (entry.get(kind) or {}).get("coverage")}
        if cells:
            players[pid] = {"pos": entry["pos"], **cells}
    defense = {team: {"pass": {"coverage": entry["pass"]["coverage"]}} for team, entry in table["defense"].items()
               if (entry.get("pass") or {}).get("coverage")}
    return {"season": season, "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "players": players, "defense": defense}


if __name__ == "__main__":
    season = int(sys.argv[1])
    payload = build(season)
    path = Path(str(plays.COVERAGE_FILE).format(season=season))
    path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"{path}: {len(payload['players'])} players, {len(payload['defense'])} defenses, {path.stat().st_size} bytes")
