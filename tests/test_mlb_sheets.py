import unittest
from unittest import mock

import mlb_sheets

DAY = "2026-10-03"

SCHEDULE = {"dates": [{"games": [{
    "gamePk": 777, "gameDate": "2026-10-03T17:10:00Z", "gameType": "F", "status": {"detailedState": "Scheduled"},
    "venue": {"name": "Progressive Field"},
    "teams": {
        "away": {"team": {"id": 145, "name": "Chicago White Sox", "abbreviation": "CWS"}, "probablePitcher": {"id": 11, "fullName": "Hagen Smith"}},
        "home": {"team": {"id": 114, "name": "Cleveland Guardians", "abbreviation": "CLE"}, "probablePitcher": {"id": 22, "fullName": "Parker Messick"}}},
    "lineups": {"homePlayers": [{"id": 100 + index} for index in range(9)]},
}]}]}
ROSTER = {"roster": [{"person": {"id": 200 + index}, "position": {"abbreviation": "OF" if index < 9 else "P"}} for index in range(11)]}


def hitter(person_id, name, bats, season, vl=None, vr=None):
    blocks = [{"type": {"displayName": "season"}, "splits": [{"stat": season}]}]
    splits = []
    if vl:
        splits.append({"split": {"code": "vl"}, "stat": vl})
    if vr:
        splits.append({"split": {"code": "vr"}, "stat": vr})
    if splits:
        blocks.append({"type": {"displayName": "statSplits"}, "splits": splits})
    return {"id": person_id, "fullName": name, "batSide": {"code": bats}, "stats": blocks}


def line(pa, hr, avg, slg, ops, so=100, bb=40, games=140, tb=None, hits=None):
    return {"gamesPlayed": games, "plateAppearances": pa, "atBats": pa - bb, "hits": hits or round((pa - bb) * float(avg)), "homeRuns": hr,
            "baseOnBalls": bb, "strikeOuts": so, "avg": avg, "slg": slg, "ops": ops, "obp": "0.330", "totalBases": tb or 0}


START = lambda day, pk, ip, k, er=1, hr=0, opp=114: {"date": day, "game": {"gamePk": pk}, "opponent": {"id": opp}, "isHome": False,
                                                    "stat": {"gamesStarted": 1, "inningsPitched": ip, "strikeOuts": k, "earnedRuns": er,
                                                             "homeRuns": hr, "numberOfPitches": 95, "battersFaced": 24}}
PITCHERS = {"people": [
    {"id": 11, "fullName": "Hagen Smith", "pitchHand": {"code": "L"}, "stats": [
        {"type": {"displayName": "season"}, "splits": [{"stat": {"inningsPitched": "28.0", "battersFaced": 121, "strikeOuts": 42, "baseOnBalls": 16,
                                                                  "hits": 13, "homeRuns": 1, "gamesStarted": 6, "era": "2.25", "avg": ".125", "slg": ".183"}}]},
        {"type": {"displayName": "statSplits"}, "splits": [{"split": {"code": "vr"}, "stat": {"inningsPitched": "18.0", "battersFaced": 78, "homeRuns": 0,
                                                                                            "strikeOuts": 31, "avg": ".092", "slg": ".138", "hits": 6, "baseOnBalls": 13}}]},
        {"type": {"displayName": "gameLog"}, "splits": [START("2026-09-20", 501, "5.0", 8), START("2026-09-26", 502, "4.1", 6),
                                                        {"date": "2026-08-01", "stat": {"gamesStarted": 0, "inningsPitched": "1.0"}}]}]},
    {"id": 22, "fullName": "Parker Messick", "pitchHand": {"code": "L"}, "stats": [
        {"type": {"displayName": "season"}, "splits": [{"stat": {"inningsPitched": "186.1", "battersFaced": 747, "strikeOuts": 193, "baseOnBalls": 49,
                                                                  "hits": 150, "homeRuns": 17, "gamesStarted": 31, "era": "3.40", "avg": ".217", "slg": ".352"}}]},
        {"type": {"displayName": "gameLog"}, "splits": [START("2026-09-21", 601, "6.0", 7, opp=145), START("2026-09-27", 602, "6.1", 5, opp=145)]}]},
]}


def hitters_payload(ids):
    people = []
    for person in ids:
        good = person in (100, 201)
        people.append(hitter(person, f"Player {person}", "L" if person % 2 else "R",
                             line(600, 38 if good else 12, ".280" if good else ".240", ".560" if good else ".390", ".930" if good else ".700"),
                             vl=line(200, 14 if good else 3, ".270", ".540" if good else ".360", ".880"),
                             vr=line(400, 24 if good else 9, ".285", ".570" if good else ".400", ".950")))
    return {"people": people}


def recent_payload(ids):
    return {"people": [{"id": person, "stats": [{"type": {"displayName": "byDateRange"},
                                                 "splits": [{"stat": line(50, 5 if person == 100 else 1, ".340" if person == 100 else ".230",
                                                                          ".760" if person == 100 else ".380", "1.180" if person == 100 else ".690")}]}]}
                       for person in ids]}


def log_payload(ids):
    people = []
    for person in ids:
        games = []
        for index in range(12):
            hits = 1 if person == 201 or index != 4 else 0
            games.append({"date": f"2026-09-{10 + index:02d}", "stat": {"hits": hits, "totalBases": 2 if person == 201 else hits,
                                                                        "homeRuns": 1 if person == 201 and index >= 9 else 0, "baseOnBalls": 0,
                                                                        "hitByPitch": 0, "stolenBases": 0, "strikeOuts": 1, "plateAppearances": 4}})
        people.append({"id": person, "stats": [{"type": {"displayName": "gameLog"}, "splits": games}]})
    return {"people": people}


LINESCORES = lambda team: {"dates": [{"games": [
    {"gamePk": pk, "gameDate": f"2026-09-{day:02d}T23:00:00Z", "status": {"abstractGameState": "Final"},
     "teams": {"home": {"team": {"id": team}}, "away": {"team": {"id": 999}}},
     "linescore": {"innings": [{"home": {"runs": 1 if day % 3 == 0 else 0}, "away": {"runs": 1 if day % 4 == 0 else 0}}]}}
    for pk, day in [(500 + day, day) for day in range(1, 29)]] + [
    {"gamePk": 501 if team == 145 else 601, "gameDate": "2026-09-20T23:00:00Z", "status": {"abstractGameState": "Final"},
     "teams": {"home": {"team": {"id": 999}}, "away": {"team": {"id": team}}},
     "linescore": {"innings": [{"home": {"runs": 0}, "away": {"runs": 0}}]}}]}]}


def fake_mlb(path, params):
    if path == "/schedule" and "teamId" in params:
        return LINESCORES(params["teamId"])
    if path == "/schedule":
        return SCHEDULE
    if path.startswith("/teams/"):
        return ROSTER
    if path == "/people":
        ids = [int(value) for value in params["personIds"].split(",")]
        hydrate = params["hydrate"]
        if "group=[pitching]" in hydrate:
            return {"people": [person for person in PITCHERS["people"] if person["id"] in ids]}
        if "byDateRange" in hydrate:
            return recent_payload(ids)
        if "gameLog" in hydrate:
            return log_payload(ids)
        return hitters_payload(ids)
    raise AssertionError(path)


SAVANT = ('"last_name, first_name",player_id,attempts,avg_hit_angle,max_hit_speed,avg_hit_speed,ev95percent,brl_percent\n'
          '"One, Player",100,300,16.2,115.1,93.4,55.1,18.4\n"Two, Player",201,280,12.0,110.0,89.0,40.0,9.0\n')
WEATHER = {"temp_f": 62, "speed_mph": 11, "effect": "out", "direction_deg": 45, "dome": False, "condition": "Clear", "rain_probability": 1}


class MlbSheetsTest(unittest.TestCase):
    def setUp(self):
        patches = [mock.patch.object(mlb_sheets, "mlb", side_effect=fake_mlb),
                   mock.patch.object(mlb_sheets, "vortex_board_day", return_value=DAY),
                   mock.patch.object(mlb_sheets, "savant", return_value=mlb_sheets.parse_savant(SAVANT)),
                   mock.patch.object(mlb_sheets, "_weather", return_value=WEATHER),
                   mock.patch.object(mlb_sheets, "_park", return_value=0.96),
                   mock.patch.object(mlb_sheets, "_arsenal", return_value=[{"pitch": "Four-seam FB", "pct": 46, "speed": 95.1}]),
                   mock.patch.object(mlb_sheets, "cached", side_effect=lambda key, ttl, loader: loader())]
        for patch in patches:
            patch.start()
            self.addCleanup(patch.stop)

    def test_lines_and_schedule(self):
        games = mlb_sheets.parse_schedule(SCHEDULE)
        self.assertEqual((games[0]["away"]["abbr"], games[0]["home"]["starter"]["name"], len(games[0]["home"]["lineup"])), ("CWS", "Parker Messick", 9))
        hit = mlb_sheets.hitting_line(line(600, 30, ".280", ".520", ".880"))
        self.assertEqual((hit["iso"], hit["hrRate"], hit["kRate"]), (0.24, 0.05, round(100 / 600, 4)))
        arm = mlb_sheets.parse_pitcher(PITCHERS["people"][0])
        self.assertEqual((arm["throws"], arm["season"]["k9"], len(arm["starts"]), arm["starts"][-1]["ip"]), ("L", 13.5, 2, round(4 + 1 / 3, 2)))
        self.assertEqual(arm["vs"]["R"]["kRate"], round(31 / 78, 4))
        self.assertEqual(mlb_sheets.innings("6.2"), 6 + 2 / 3)

    def test_slate_uses_the_posted_lineup_else_the_roster(self):
        data = mlb_sheets.slate(DAY)
        home, away = data["games"][0]["home"], data["games"][0]["away"]
        self.assertTrue(home["confirmed"])
        self.assertEqual(home["hitters"], list(range(100, 109)))
        self.assertFalse(away["confirmed"])
        self.assertEqual(away["hitters"], list(range(200, 209)))  # pitchers left out
        self.assertEqual(data["hitters"]["100"]["vs"]["L"]["hr"], 14)
        self.assertEqual(data["pitchers"]["22"]["throws"], "L")

    def test_hr_sheet_ranks_power_against_the_hand(self):
        result = mlb_sheets.sheet("hr", "today")
        top = result["rows"][0]
        self.assertEqual(top["name"], "Player 100")
        self.assertEqual((top["barrel"], top["hardHit"], top["vsHand"]["hr"], top["pitcher"]["name"]), (18.4, 55.1, 14, "Hagen Smith"))
        self.assertTrue(top["hot"])
        self.assertGreater(top["score"], result["rows"][-1]["score"])
        self.assertEqual(result["games"][0]["home"], "CLE")

    def test_hot_sheet_shows_the_surge(self):
        rows = mlb_sheets.sheet("hot", "today")["rows"]
        self.assertEqual([row["name"] for row in rows], ["Player 100"])
        self.assertEqual((rows[0]["tag"], rows[0]["delta"]["ops"], len(rows[0]["spark"])), ("hot", 0.25, 10))

    def test_matchups_bvp_and_park(self):
        games = mlb_sheets.sheet("matchups", "today")["games"]
        top, bottom = games[0]["halves"]
        self.assertEqual((top["team"], top["pitcher"]["name"], top["pitcher"]["arsenal"][0]["pct"]), ("CWS", "Parker Messick", 46))
        self.assertEqual(bottom["lineup"][0]["name"], "Player 100")   # best against a lefty first
        self.assertEqual(bottom["lineup"][0]["order"], 1)
        self.assertEqual(games[0]["environment"]["windEffect"], "out")
        with mock.patch.object(mlb_sheets._stats(), "get_career_bvp_batch", side_effect=lambda ids, pitcher: {
                ids[0]: {"ab": 20, "hits": 8, "bb": 2, "tb": 16, "hr": 2, "k": 3}, ids[1]: {"ab": 2, "hits": 1, "bb": 0, "tb": 1}}):
            rows = mlb_sheets.sheet("bvp", "today")["rows"]
        self.assertEqual(rows[0]["sample"], "strong")
        self.assertEqual((rows[0]["pa"], rows[0]["avg"], rows[0]["slg"]), (22, 0.4, 0.8))
        self.assertTrue(all(row["pa"] >= 4 for row in rows))
        park = mlb_sheets.sheet("park", "today")["rows"][0]
        self.assertEqual((park["park"], park["temp"], park["windEffect"]), (0.96, 62, "out"))
        self.assertAlmostEqual(park["runs"], round((0.96 * (1 - 8 * 0.0025) * (1 + 11 * 0.004) - 1) * 100, 1))

    def test_environment_without_weather_in_a_dome(self):
        game = {"home": {"name": "Tampa Bay Rays"}}
        with mock.patch.object(mlb_sheets, "_park", return_value=1.0):
            dome = mlb_sheets.environment(game, {"temp_f": 95, "speed_mph": 20, "effect": "out", "dome": True})
        self.assertEqual((dome["runs"], dome["hr"], dome["dome"]), (0.0, 0.0, True))
        with mock.patch.object(mlb_sheets, "_park", return_value=None):
            self.assertIsNone(mlb_sheets.environment(game, None)["runs"])

    def test_nrfi_reads_first_innings(self):
        numbers = mlb_sheets.nrfi_numbers(145, mlb_sheets.parse_first_innings(LINESCORES(145)), [{"gamePk": 501}, {"gamePk": 502}])
        self.assertEqual(numbers["offense"]["games"], 29)
        self.assertEqual((numbers["pitcher"]["starts"], numbers["pitcher"]["season"]), (2, 1.0))
        self.assertGreater(mlb_sheets.nrfi_chance({"season": 0.2, "games": 150}, {"season": 0.2, "games": 150}, {"season": 0.8, "starts": 30}, {"season": 0.8, "starts": 30}),
                           mlb_sheets.nrfi_chance({"season": 0.35, "games": 150}, {"season": 0.35, "games": 150}, {"season": 0.6, "starts": 30}, {"season": 0.6, "starts": 30}))
        self.assertEqual((mlb_sheets.american(0.6), mlb_sheets.american(0.4)), (-150, 150))
        row = mlb_sheets.sheet("nrfi", "today")["rows"][0]
        self.assertIn(row["lean"], ("nrfi", "toss", "yrfi"))
        self.assertEqual((row["away"]["pitcher"]["name"], row["home"]["team"]), ("Hagen Smith", "CLE"))
        self.assertEqual(round(row["chance"] / (1 - row["chance"]) * 100), -row["nrfi"] if row["chance"] >= 0.5 else row["nrfi"])

    def test_strikeouts_and_streaks(self):
        context = {"league": {"kRate": 0.22, "teams": 30, "vs": {"L": {"kRate": 0.23}}},
                   "hitting": {"114": {"kRate": 0.21, "kRateRank": 20, "vs": {"L": {"kRate": 0.26, "kRateRank": 4}}}}}
        with mock.patch("mlb_context.context", return_value=context):
            rows = mlb_sheets.sheet("strikeouts", "today")["rows"]
        smith = next(row for row in rows if row["name"] == "Hagen Smith")
        self.assertEqual((smith["opponentK"], smith["opponentKRank"], smith["avgK"], smith["l5K"]), (0.26, 4, 7.0, 7.0))
        self.assertGreater(smith["projected"], 0)
        streaks = mlb_sheets.sheet("streaks", "today")["streaks"]
        self.assertEqual(streaks["hits"]["rows"][0]["name"], "Player 201")
        self.assertEqual((streaks["hits"]["rows"][0]["streak"], streaks["hits"]["rows"][0]["recent"]), (12, [True] * 10))
        self.assertEqual(streaks["hr"]["rows"][0]["streak"], 3)
        self.assertEqual(mlb_sheets.streak([{"hits": 1}, {"hits": 0}, {"hits": 1}, {"hits": 1}], lambda game: game["hits"] >= 1)[0], 2)

    def test_days_and_unknown_sheets(self):
        self.assertEqual(mlb_sheets.resolve_day("tomorrow"), "2026-10-04")
        with self.assertRaises(ValueError):
            mlb_sheets.resolve_day("2027-01-01")
        with self.assertRaises(ValueError):
            mlb_sheets.sheet("parlays", "today")


if __name__ == "__main__":
    unittest.main()
