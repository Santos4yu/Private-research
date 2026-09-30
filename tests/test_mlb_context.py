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

    def test_context_asks_mlb_four_times_and_caches(self):
        answers = {"/schedule": SCHEDULE, "/people": PEOPLE}
        calls = []

        def fake(path, params):
            calls.append((path, params.get("group")))
            if path == "/teams/stats":
                return HITTING if params["group"] == "hitting" else PITCHING
            return answers[path]

        with mock.patch.object(mlb_context, "mlb", side_effect=fake):
            first = mlb_context.context("2026-09-30")
            second = mlb_context.context("2026-09-30")
        self.assertIs(first, second)
        self.assertEqual(sorted(calls), sorted([("/schedule", None), ("/people", None), ("/teams/stats", "hitting"),
                                                ("/teams/stats", "pitching")]))
        self.assertEqual((first["day"], first["season"]), ("2026-09-30", 2026))


if __name__ == "__main__":
    unittest.main()
