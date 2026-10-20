"""NBA Cheat Sheets (nba_sheets.py): pace-up games and teammates out, on a
made-up league of four teams."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nba_sheets  # noqa: E402
from backend.sports.wnba import league  # noqa: E402


def box(pid, starter, minutes, pts, fga, reb=4, ast=3, to=2, fta=2, oreb=1):
    values = dict.fromkeys(league.FIELDS, 0)
    values.update(min=minutes, pts=pts, reb=reb, ast=ast, fga=fga, fgm=fga // 2, to=to, fta=fta, ftm=fta, oreb=oreb, dreb=reb - oreb)
    return [pid, starter] + [values[field] for field in league.FIELDS]


# Fast teams take 20 shots a man, slow ones 15.
SHOTS = {"FST": 20, "ZIP": 20, "SLO": 15, "MUD": 15}
PLAYERS = {f"{team}{n}": [f"{team.title()} Player{n}", "G" if n < 3 else "F", None, team] for team in SHOTS for n in range(1, 6)}
PLAYERS["FST1"][0] = "Star One"


def side(team, game_number, sits=()):
    rows = []
    for n in range(1, 6):
        pid = f"{team}{n}"
        if pid in sits:
            continue
        pts = SHOTS[team]
        # FST2 picks up the scoring when FST1 sits.
        if pid == "FST2" and "FST1" in sits:
            pts += 8
        rows.append(box(pid, n <= 5, 32, pts, SHOTS[team]))
    return {"p": rows, "dnp": list(sits)}


def payload():
    pairs = [("FST", "ZIP"), ("SLO", "MUD"), ("FST", "SLO"), ("ZIP", "MUD")] * 3
    games = {}
    for index, (home, away) in enumerate(pairs, 1):
        # Star One sits FST's last two games.
        sits = ("FST1",) if index >= 9 and "FST" in (home, away) else ()
        games[str(index)] = {"id": str(index), "date": f"2026-11-{index:02d}T00:00Z", "type": 2, "home": home, "away": away,
                             "t": {home: side(home, index, sits if home == "FST" else ()), away: side(away, index, sits if away == "FST" else ())}}
    schedule = [{"id": game["id"], "date": game["date"], "home": game["home"], "away": game["away"], "completed": True} for game in games.values()]
    return {"season": 2027, "games": games, "players": PLAYERS, "schedule": schedule}


SLATE = [{"gameId": "a", "startsAt": "2026-11-14T00:00Z", "home": "FST", "away": "ZIP", "started": False},
         {"gameId": "b", "startsAt": "2026-11-14T00:30Z", "home": "SLO", "away": "MUD", "started": False}]
NOW = datetime(2026, 11, 13, 18, tzinfo=timezone.utc)


class PaceTests(unittest.TestCase):
    def test_two_fast_teams_lead_the_sheet(self):
        out = nba_sheets.build("pace", now=NOW, payload=payload(), games=SLATE, injuries={})
        first, second = out["rows"]
        self.assertEqual((first["home"], first["away"]), ("FST", "ZIP"))
        self.assertTrue(first["paceUp"])
        self.assertEqual(first["tier"], "fast")
        self.assertGreater(first["projected"], first["league"])
        self.assertGreater(first["score"], 50)
        self.assertEqual(second["tier"], "slow")
        self.assertFalse(second["paceUp"])
        self.assertLess(second["score"], 50)
        # Each side's top minutes, with what the faster game is worth to them.
        fst = next(item for item in first["sides"] if item["team"] == "FST")
        self.assertEqual(len(fst["players"]), nba_sheets.PACE_PLAYERS)
        self.assertGreater(fst["players"][0]["extraFga"], 0)
        self.assertGreater(first["total"], second["total"])
        # The players list: everyone in a faster game gains, those in a slower one lose.
        self.assertGreater(out["players"][0]["extraPts"], 0)
        self.assertLess(out["players"][-1]["extraPts"], 0)

    def test_an_out_player_is_left_off(self):
        out = nba_sheets.build("pace", now=NOW, payload=payload(), games=SLATE, injuries={"FST": [{"name": "Star One", "status": "Out"}]})
        names = [player["who"]["name"] for player in out["players"]]
        self.assertNotIn("Star One", names)


class OutTests(unittest.TestCase):
    def test_who_gains_when_he_sits(self):
        report = {"FST": [{"name": "Star One", "status": "Out"}], "ZIP": [{"name": "Zip Player3", "status": "Questionable"}]}
        out = nba_sheets.build("out", now=NOW, payload=payload(), games=SLATE, injuries=report)
        self.assertEqual(len(out["outs"]), 1)   # questionable isn't out
        card = out["outs"][0]
        self.assertEqual(card["who"]["name"], "Star One")
        self.assertEqual(card["who"]["status"], "Out")
        self.assertTrue(card["role"]["starter"])
        self.assertEqual(card["role"]["missed"], 2)
        self.assertFalse(card["fresh"])
        self.assertEqual(card["sample"], 2)
        top = card["gainers"][0]
        self.assertEqual(top["who"]["id"], "FST2")
        self.assertEqual(top["games"], 2)
        self.assertEqual(top["with"]["pts"], 20)
        self.assertEqual(top["without"]["pts"], 28)
        self.assertEqual(top["diff"]["pts"], 8)
        # Only the one who gained is listed.
        self.assertEqual([gain["who"]["id"] for gain in card["gainers"]], ["FST2"])
        row = out["rows"][0]
        self.assertEqual((row["who"]["id"], row["out"]["name"], row["opponent"]), ("FST2", "Star One", "ZIP"))
        self.assertGreater(row["score"], 50)

    def test_a_player_who_never_played_is_not_listed(self):
        report = {"FST": [{"name": "Nobody Here", "status": "Out"}]}
        out = nba_sheets.build("out", now=NOW, payload=payload(), games=SLATE, injuries=report)
        self.assertEqual(out["outs"], [])

    def test_unknown_sheet(self):
        with self.assertRaises(ValueError):
            nba_sheets.sheet("nope")


class SlateTests(unittest.TestCase):
    def test_tomorrow_once_today_is_done(self):
        def event(gid, state):
            return {"id": gid, "date": "2026-11-12T00:00Z", "competitions": [{"status": {"type": {"state": state}}, "competitors": [
                {"homeAway": "home", "team": {"abbreviation": "GSW"}}, {"homeAway": "away", "team": {"abbreviation": "NYK"}}]}]}
        boards = {"2026-11-11": {"events": [event("1", "post")]}, "2026-11-12": {"events": [event("2", "pre")]}}
        day, games = nba_sheets.slate(datetime(2026, 11, 11, 18, tzinfo=timezone.utc), scoreboard=lambda sport, day: boards.get(day.isoformat()))
        self.assertEqual(day, "2026-11-12")
        self.assertEqual(games, [{"gameId": "2", "startsAt": "2026-11-12T00:00Z", "home": "GS", "away": "NY", "state": "pre", "started": False}])


if __name__ == "__main__":
    unittest.main()
