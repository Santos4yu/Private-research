import unittest
from unittest import mock

import mlb_context

SCHEDULE = {"dates": [{"games": [
    {"gamePk": 1, "gameDate": "2026-09-30T23:05:00Z", "teams": {
        "home": {"team": {"id": 116, "name": "Detroit Tigers"}, "probablePitcher": {"id": 669373, "fullName": "Tarik Skubal"}},
        "away": {"team": {"id": 114, "name": "Cleveland Guardians"}}}},
]}]}
PEOPLE = {"people": [{"id": 669373, "fullName": "Tarik Skubal", "pitchHand": {"code": "L"}, "stats": [
    {"splits": [{"stat": {"inningsPitched": "180.1", "era": "2.21", "hits": "130", "baseOnBalls": "35",
                          "strikeOuts": "224", "homeRuns": "15", "gamesStarted": 30}}]}]}]}
HITTING = {"stats": [{"splits": [
    {"team": {"id": 114, "name": "Cleveland Guardians"}, "stat": {"gamesPlayed": 160, "plateAppearances": 6000,
     "strikeOuts": 1500, "baseOnBalls": 480, "homeRuns": 150, "runs": 640, "avg": ".238", "ops": ".680"}},
    {"team": {"id": 116, "name": "Detroit Tigers"}, "stat": {"gamesPlayed": 160, "plateAppearances": 6100,
     "strikeOuts": 1300, "baseOnBalls": 560, "homeRuns": 190, "runs": 760, "avg": ".252", "ops": ".742"}},
]}]}
PITCHING = {"stats": [{"splits": [
    {"team": {"id": 114}, "stat": {"inningsPitched": "1430.0", "era": "3.80", "hits": "1300", "baseOnBalls": "480",
     "strikeOuts": "1400", "homeRuns": "170"}},
    {"team": {"id": 116}, "stat": {"inningsPitched": "1440.2", "era": "3.50", "hits": "1250", "baseOnBalls": "430",
     "strikeOuts": "1450", "homeRuns": "160"}},
]}]}
SPLITS = {"stats": [{"splits": [
    {"team": {"id": 114}, "split": {"code": "vl", "description": "vs Left"}, "stat": {"gamesPlayed": 50, "plateAppearances": 2000,
     "strikeOuts": 540, "baseOnBalls": 150, "homeRuns": 40, "runs": 200, "avg": ".230", "ops": ".650"}},
    {"team": {"id": 114}, "split": {"code": "vr", "description": "vs Right"}, "stat": {"gamesPlayed": 110, "plateAppearances": 4000,
     "strikeOuts": 960, "baseOnBalls": 330, "homeRuns": 110, "runs": 440, "avg": ".242", "ops": ".695"}},
    {"team": {"id": 116}, "split": {"code": "vl"}, "stat": {"gamesPlayed": 50, "plateAppearances": 2000,
     "strikeOuts": 400, "baseOnBalls": 180, "homeRuns": 60, "runs": 250, "avg": ".255", "ops": ".760"}},
]}]}
RECENT = {"stats": [{"splits": [
    {"team": {"id": 114}, "stat": {"gamesPlayed": 9, "plateAppearances": 340, "strikeOuts": 70, "baseOnBalls": 30,
     "homeRuns": 14, "runs": 52, "avg": ".280", "ops": ".810"}},
    {"team": {"id": 116}, "stat": {"gamesPlayed": 9, "plateAppearances": 330, "strikeOuts": 90, "baseOnBalls": 25,
     "homeRuns": 6, "runs": 28, "avg": ".210", "ops": ".600"}},
]}]}
START = lambda day, opp, ip, k, pitches, er=1: {"date": day, "isHome": True, "opponent": {"id": opp},
                                                "stat": {"gamesStarted": 1, "inningsPitched": ip, "strikeOuts": k,
                                                         "numberOfPitches": pitches, "earnedRuns": er}}
PEOPLE_WITH_LOG = {"people": [{"id": 669373, "fullName": "Tarik Skubal", "pitchHand": {"code": "L"}, "stats": [
    {"type": {"displayName": "gameLog"}, "splits": [
        START("2026-09-24", 145, "7.0", 9, 101), START("2026-08-01", 114, "6.0", 8, 95), START("2026-09-02", 120, "6.0", 7, 99),
        START("2026-09-08", 114, "7.0", 9, 97, 2), START("2026-09-13", 118, "5.2", 6, 96), START("2026-09-19", 139, "6.0", 5, 97),
        {"date": "2026-07-01", "opponent": {"id": 147}, "stat": {"gamesStarted": 0, "inningsPitched": "1.0", "strikeOuts": 2}}]},
    {"type": {"displayName": "season"}, "splits": PEOPLE["people"][0]["stats"][0]["splits"]}]}]}


class MlbContextTest(unittest.TestCase):
    def test_innings_read_as_thirds(self):
        self.assertAlmostEqual(mlb_context.innings("180.1"), 180 + 1 / 3)
        self.assertAlmostEqual(mlb_context.innings("6.2"), 6 + 2 / 3)
        self.assertIsNone(mlb_context.innings(None))

    def test_probable_starters_teams_and_league(self):
        payload = mlb_context.build(SCHEDULE, PEOPLE, HITTING, PITCHING)
        skubal = payload["probables"]["116"]
        self.assertEqual((skubal["name"], skubal["hand"], skubal["era"]), ("Tarik Skubal", "L", 2.21))
        self.assertEqual(skubal["whip"], round(165 / (180 + 1 / 3), 2))
        self.assertEqual(skubal["k9"], round(224 * 9 / (180 + 1 / 3), 2))
        # Cleveland has no probable yet: nothing is made up.
        self.assertNotIn("114", payload["probables"])
        cle = payload["hitting"]["114"]
        self.assertEqual((cle["kRate"], cle["avg"], cle["runsPerGame"]), (0.25, 0.238, 4.0))
        self.assertAlmostEqual(payload["league"]["kRate"], round((0.25 + 1300 / 6100) / 2, 4))
        self.assertEqual(payload["pitching"]["116"]["era"], 3.5)
        self.assertEqual(payload["games"][0]["home"], 116)

    def test_context_asks_mlb_once_per_piece_and_caches(self):
        answers = {"/schedule": SCHEDULE, "/people": PEOPLE}
        calls = []

        def fake(path, params):
            calls.append((path, params.get("group"), params.get("stats")))
            if path == "/teams/stats":
                if params["stats"] == "statSplits":
                    self.assertEqual(params["sitCodes"], "vl,vr")
                    return SPLITS
                if params["stats"] == "byDateRange":
                    self.assertEqual((params["startDate"], params["endDate"]), ("2026-09-20", "2026-09-29"))
                    return RECENT
                return HITTING if params["group"] == "hitting" else PITCHING
            if path == "/people":
                self.assertIn("type=[season,gameLog]", params["hydrate"])
            return answers[path]

        with mock.patch.object(mlb_context, "mlb", side_effect=fake):
            first = mlb_context.context("2026-09-30")
            second = mlb_context.context("2026-09-30")
        self.assertIs(first, second)
        self.assertEqual(sorted(calls), sorted([("/schedule", None, None), ("/people", None, None), ("/teams/stats", "hitting", "season"),
                                                ("/teams/stats", "pitching", "season"), ("/teams/stats", "hitting", "statSplits"),
                                                ("/teams/stats", "hitting", "byDateRange")]))
        self.assertEqual((first["day"], first["season"]), ("2026-09-30", 2026))
        self.assertEqual(first["hitting"]["114"]["vs"]["L"]["kRate"], 0.27)

    def test_the_extras_failing_leave_the_season_lines(self):
        def fake(path, params):
            if path == "/teams/stats" and params["stats"] != "season":
                raise TimeoutError("slow")
            if path == "/teams/stats":
                return HITTING if params["group"] == "hitting" else PITCHING
            return {"/schedule": SCHEDULE, "/people": PEOPLE}[path]

        with mock.patch.object(mlb_context, "mlb", side_effect=fake):
            payload = mlb_context.context("2026-09-29")
        self.assertNotIn("vs", payload["hitting"]["114"])
        self.assertEqual(payload["hitting"]["114"]["kRate"], 0.25)
        self.assertIsNone(payload["league"]["recent"])

    def test_lineups_against_each_hand_lately_and_ranked(self):
        payload = mlb_context.build(SCHEDULE, PEOPLE, HITTING, PITCHING, SPLITS, RECENT)
        cle, det = payload["hitting"]["114"], payload["hitting"]["116"]
        self.assertEqual((cle["vs"]["L"]["kRate"], cle["vs"]["R"]["kRate"]), (0.27, 0.24))
        self.assertEqual((cle["vs"]["L"]["kRateRank"], det["vs"]["L"]["kRateRank"]), (1, 2))
        self.assertEqual((cle["recent"]["ops"], cle["recent"]["opsRank"], det["recent"]["opsRank"]), (0.81, 1, 2))
        self.assertEqual((cle["kRateRank"], det["opsRank"]), (1, 1))
        self.assertAlmostEqual(payload["league"]["vs"]["L"]["kRate"], round((0.27 + 0.2) / 2, 4))
        self.assertEqual(payload["league"]["teams"], 2)

    def test_a_starters_recent_work_and_history_against_today(self):
        payload = mlb_context.build(SCHEDULE, PEOPLE_WITH_LOG, HITTING, PITCHING)
        skubal = payload["probables"]["116"]
        self.assertEqual(skubal["era"], 2.21)                       # the season line, not a game's
        self.assertEqual(skubal["opponent"], 114)
        self.assertEqual([start["ip"] for start in skubal["lastStarts"]], [6.0, 7.0, round(5 + 2 / 3, 2), 6.0, 7.0])
        self.assertEqual(skubal["lastStarts"][-1]["date"], "2026-09-24")
        self.assertAlmostEqual(skubal["recentIp"], round((6 + 7 + 5 + 2 / 3 + 6 + 7) / 5, 2))
        self.assertEqual(skubal["recentPitches"], 98.0)
        self.assertEqual(skubal["vsOpponent"], {"starts": 2, "ip": 13.0, "k": 17.0, "er": 3.0})
        season = (180 + 1 / 3) / 30
        weight = 5 / 8
        self.assertEqual(skubal["projectedIp"], round(weight * skubal["recentIp"] + (1 - weight) * season, 1))
        self.assertEqual(mlb_context.projected_innings({"ip": 60, "starts": 10}), 6.0)
        self.assertIsNone(mlb_context.projected_innings({}))


if __name__ == "__main__":
    unittest.main()
