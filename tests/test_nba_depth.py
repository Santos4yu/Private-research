import math
import time
import unittest
from unittest.mock import patch

from backend.sports.wnba import context, depth, league


def row(pid, minutes, pts, reb=0, ast=0):
    values = {"min": minutes, "pts": pts, "reb": reb, "ast": ast, "fgm": 3, "fga": 8, "tpm": 1, "tpa": 3,
              "ftm": 1, "fta": 2, "stl": 1, "blk": 0, "to": 1, "pf": 2, "oreb": 0, "dreb": reb}
    return [pid, 1] + [values[field] for field in league.FIELDS]


def game(gid, date, home, away, home_rows, away_rows, labels=None):
    labels = labels or {}
    return {"id": gid, "date": date, "type": 2, "home": home, "away": away,
            "t": {home: {"p": home_rows, "dnp": [], "z": [], "g": labels.get(home, {})},
                  away: {"p": away_rows, "dnp": [], "z": [], "g": labels.get(away, {})}}}


M = depth.minute_of
# BBB's chart: b1 PG, b2 SG, b3 listed 2nd at both SF and PF (a tie), b4 PF, b5 C.
CHART = {"pg": ["b1"], "sg": ["b2", "b1"], "sf": ["b6", "b3"], "pf": ["b4", "b3"], "c": ["b5"]}
CHART = {slot: [str(100 + int(pid[1:])) for pid in ids] for slot, ids in CHART.items()}
LATER = {**CHART, "pg": ["102"], "sg": ["101"]}  # read after the game: must never count


def store_with(*reads):
    value = depth.empty(2027)
    depth.merge(value, list(reads), "espn")
    return depth.Index(value)


class StoreTests(unittest.TestCase):
    def test_merge_keeps_each_read_once_and_in_time_order(self):
        value = depth.empty(2027)
        self.assertEqual(depth.merge(value, [(200, "BBB", CHART), (100, "BBB", CHART), (200, "BBB", CHART)], "espn"), 2)
        self.assertEqual([read[0] for read in value["snaps"]["BBB"]], [100, 200])
        self.assertEqual(len(value["charts"]), 1)

    def test_a_chart_missing_a_spot_is_refused(self):
        value = depth.empty(2027)
        self.assertEqual(depth.merge(value, [(100, "BBB", {**CHART, "c": []})], "espn"), 0)

    def test_the_chart_read_before_tip_off_counts_never_a_later_one(self):
        tip = M("2026-11-10T00:00Z")
        index = store_with((tip - 600, "BBB", CHART), (tip + 30, "BBB", LATER))
        digest, read, status = index.chart_before("BBB", tip)
        self.assertEqual((index.charts[digest], status), (CHART, "ok"))
        # A read inside the 15 minutes before tip-off doesn't count either.
        index = store_with((tip - 600, "BBB", CHART), (tip - 5, "BBB", LATER))
        self.assertEqual(index.charts[index.chart_before("BBB", tip)[0]], CHART)

    def test_no_chart_or_a_stale_one_places_nobody(self):
        tip = M("2026-11-10T00:00Z")
        self.assertEqual(store_with((tip + 60, "BBB", CHART)).spots("BBB", tip, {}), ({}, "none"))
        self.assertEqual(store_with((tip - 4 * 1440, "BBB", CHART)).spots("BBB", tip, {}), ({}, "stale"))

    def test_import_checks_every_hash_team_and_time(self):
        good = depth.chart_hash(CHART)
        now = int(time.time() // 60)
        body = {"season": 2027, "charts": {good: CHART, "deadbeef0000": CHART},
                "snaps": [[now - 100, "BBB", good], [now - 50, "ZZZ", good], [now + 600, "BBB", good],
                          [now - 40, "BBB", "deadbeef0000"], ["x", "BBB", good]]}
        kept = {}
        with patch.object(league, "team_directory", return_value={"BBB": {"id": "2"}, "AAA": {"id": "1"}}), \
             patch.object(depth, "load", return_value=depth.empty(2027)), \
             patch.object(depth, "save", side_effect=lambda season, value: kept.setdefault("v", value) is not None):
            report = depth.import_snapshots(body, season=2027)
        self.assertEqual((report["added"], report["refused"]), (1, 4))
        self.assertEqual(kept["v"]["snaps"]["BBB"], [[now - 100, good]])
        self.assertEqual(depth.import_snapshots({"season": 2026}, season=2027)["added"], 0)


class SpotTests(unittest.TestCase):
    def setUp(self):
        # AAA hosts BBB twice; BBB's players are placed from BBB's chart.
        self.payload = {"season": 2027, "players": {"103": ["Tied Wing", "F", None, "BBB"], "107": ["Call Up", "G", None, "BBB"]},
                        "games": {
                            "g1": game("g1", "2026-11-10T00:00Z", "AAA", "BBB", [row("a1", 30, 20)],
                                       [row("101", 34, 25, 3, 9), row("102", 30, 18), row("103", 20, 9, 6),
                                        row("104", 28, 12, 9), row("105", 26, 10, 11), row("107", 10, 4)]),
                            "g2": game("g2", "2026-11-12T00:00Z", "AAA", "BBB", [row("a1", 30, 22)],
                                       [row("101", 36, 30, 4, 10), row("102", 30, 14), row("104", 30, 16, 8), row("105", 24, 8, 12)]),
                        }}
        tip = M("2026-11-10T00:00Z")
        self.index = store_with((tip - 600, "BBB", CHART), (tip - 600, "AAA", {slot: ["900"] for slot in depth.SLOTS}),
                                (M("2026-11-12T00:00Z") + 60, "BBB", LATER))

    def test_each_player_counts_once_and_the_unplaced_are_measured(self):
        table = context.season_dvp(self.payload, self.index)
        total = table["views"]["total"]["AAA"]
        # g1: PG 101 25 pts, SG 102 18, PF 104 12, C (DC) 105 10; 103 tied SF/PF with label F (fits both) -> unplaced.
        # g2 uses the g1-era chart (the later read is after its tip), so the same spots.
        self.assertEqual(total["PG"]["stats"]["pts"]["szn"][0], 27.5)
        self.assertEqual(total["SG"]["stats"]["pts"]["szn"][0], 16.0)
        self.assertEqual(total["PF"]["stats"]["pts"]["szn"][0], 14.0)
        self.assertEqual(total["DC"]["stats"]["pts"]["szn"][0], 9.0)
        self.assertIsNone(total["SF"]["stats"]["pts"]["szn"][0])  # nobody placed at SF: games left out
        placed = table["_placed"][("g1", "BBB")]
        self.assertEqual(placed["103"][:2], (None, "tie"))
        self.assertEqual(placed["107"][:2], (None, "not on chart"))
        counted = [pid for pid, found in placed.items() if found[0]]
        self.assertEqual(len(counted), len(set(counted)))
        cover = table["coverage"]["AAA"]
        # SF: 103's 20 minutes may be SF and 107's 10 may be anything; nothing placed there -> share 1.0, flagged.
        self.assertEqual(cover["SF"]["szn"], {"placed": 0, "unsure": 30, "share": 1.0, "flag": True})
        # PG: 34 + 36 placed, 107's 10 unsure -> 12.5%: flagged.
        self.assertEqual(cover["PG"]["szn"]["flag"], True)
        self.assertEqual(cover["PG"]["l5"]["placed"], 70)
        log = context.position_log(table, "AAA", "SF")
        self.assertEqual([entry["unsure"] for entry in log], [[], [["Tied Wing", 20], ["Call Up", 10]]])

    def test_a_tie_is_settled_by_the_games_own_espn_label(self):
        payload = {**self.payload, "games": {"g1": game("g1", "2026-11-10T00:00Z", "AAA", "BBB", [row("a1", 30, 20)],
                                                         [row("103", 20, 9)], labels={"BBB": {"103": "G"}})}}
        chart = {**CHART, "sg": ["102", "103"]}  # 103 2nd at SG, SF and PF; ESPN says G -> SG
        index = store_with((M("2026-11-10T00:00Z") - 600, "BBB", chart))
        placed = context.place_games(payload, index)[("g1", "BBB")]
        self.assertEqual(placed["103"][:2], ("SG", "label"))

    def test_gfc_tables_are_unchanged_by_the_depth_charts(self):
        plain = context.season_dvp(self.payload)
        dated = context.season_dvp(self.payload, self.index)
        for view in plain["views"]:
            for team, entry in plain["views"][view].items():
                for position in ("ALL",) + context.POSITIONS:
                    self.assertEqual(entry[position], dated["views"][view][team][position])
        self.assertEqual(plain["positions"], ["ALL", "G", "F", "C"])
        self.assertEqual(dated["positions"], ["ALL", "G", "F", "C", "PG", "SG", "SF", "PF", "DC"])
        self.assertEqual(context.position_log(plain, "AAA", "G"), context.position_log(dated, "AAA", "G"))

    def test_placement_summary_adds_up_every_played_minute(self):
        table = context.season_dvp(self.payload, self.index)
        summary = table["placement"]
        self.assertEqual(summary["minutes"], 30 + 148 + 30 + 120)
        self.assertAlmostEqual(sum(summary["by"].values()), 1.0, places=3)


class BacktestTests(unittest.TestCase):
    def test_a_day_is_read_only_against_the_days_before_it(self):
        from backend.sports.wnba import dvp_backtest
        chart = {slot: ["901", "902"] if slot == "pg" else ["999"] for slot in depth.SLOTS}
        reads = [(M(when), team, chart) for when in ("2026-11-02T20:00Z", "2026-11-04T20:00Z") for team in ("AAA", "BBB", "CCC")]
        index = store_with(*reads)
        players = {"901": ["One", "G", None, "BBB"], "902": ["Two", "G", None, "CCC"]}
        games = {
            "d1": game("d1", "2026-11-03T00:00Z", "AAA", "BBB", [], [row("901", 30, 10)]),   # AAA allows 10 to a G / PG
            "d1b": game("d1b", "2026-11-03T01:00Z", "DDD", "CCC", [], [row("902", 30, 30)]),  # DDD allows 30
            "d2": game("d2", "2026-11-05T00:00Z", "AAA", "CCC", [], [row("902", 30, 50)]),   # 902 scores 50 on AAA
        }
        with patch.object(dvp_backtest, "MIN_PLAYER_GAMES", 1), patch.object(dvp_backtest, "MIN_DEFENSE_GAMES", 1), \
             patch.object(dvp_backtest, "FACTOR_GAMES", 0):
            scored, _, checks = dvp_backtest.walk({"games": games, "players": players}, index)
        pts = [entry for entry in scored if entry["stat"] == "pts"]
        self.assertEqual(len(pts), 1)
        entry = pts[0]
        # AAA allowed 10 a player before day 2; the league 20: factor 0.5 -- day 2's 50 isn't in it.
        self.assertEqual((entry["pid"], entry["actual"], entry["average"], entry["gfc"], entry["five"]), ("902", 50, 30, 0.5, 0.5))
        self.assertEqual(dvp_backtest._predict(entry, "combined"), 15.0)
        audit = checks["audit"]
        self.assertEqual((audit["stateFromSameOrLaterDay"], audit["chartReadAfterTip"], audit.get("playerHistoryFromSameOrLaterDay", 0)), (0, 0, 0))

    def test_intervals_and_one_bet_per_prop(self):
        from backend.sports.wnba import dvp_backtest
        self.assertEqual(dvp_backtest._wilson(0, 0), None)
        rate, low, high = dvp_backtest._wilson(55, 100)
        self.assertTrue(low < 55 < high and high - low > 15)  # 100 calls: an interval near +/- 10 points
        self.assertEqual(dvp_backtest._mcnemar(0, 0), 1.0)
        entry = {"day": "2026-11-10", "pid": "1", "stat": "pts", "actual": 30, "average": 20, "gfc": 1.1, "five": 0.9, "minutes": 30}
        scored = [entry, {**entry, "pid": "2", "actual": 21}]
        box = {("1", "2026-11-10"): row("1", 30, 30), ("2", "2026-11-10"): row("2", 30, 21)}
        reports = {"2026-11-10": {
            # Player 1's points recorded at three lines (it moved): one bet, the middle line 20.5.
            "1|player_points|19.5": [70, 0.6, "lean", "standard"], "1|player_points|20.5": [70, 0.6, "lean", "standard"],
            "1|player_points|22.5": [70, 0.6, "lean", "standard"],
            "1|player_points|17.5": [70, 0.6, "lean", "goblin"],      # not a standard line
            "2|player_points|21": [70, 0.6, "lean", "standard"],      # landed on it: push
            "3|player_points|10.5": [70, 0.6, "lean", "standard"],    # didn't play: void
        }}
        calls, left = dvp_backtest.line_calls(scored, box, reports)
        self.assertEqual(left, {"goblinOrDemon": 1, "snapshotsCollapsed": 2, "push": 1, "voidDidNotPlay": 1})
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["line"], 20.5)
        self.assertEqual({model: dvp_backtest._right(calls[0], model) for model in dvp_backtest.MODELS},
                         {"average": False, "gfc": True, "five": False, "combined": False})
        report = dvp_backtest.line_report(calls)
        self.assertEqual(report["pts"]["props"], 1)
        self.assertEqual(report["ra"], {"props": 0})
        self.assertEqual(report["pts"]["byGap"]["gfc"]["5-10%"]["props"], 1)  # 22 vs 20.5: 7.3% off the line

    def test_value_beyond_finds_a_real_signal_and_not_a_fake_one(self):
        import random
        from backend.sports.wnba import dvp_backtest
        rng = random.Random(7)
        calls = []
        for n in range(2000):
            day = f"2026-11-{1 + n % 28:02d}"
            push = rng.uniform(-0.2, 0.2)              # a matchup factor's push, as a share of the line
            real = rng.random() < 1 / (1 + math.exp(-8 * push))
            average = 20.0 + rng.uniform(-2, 2)
            calls.append({"day": day, "line": 20.0, "average": average, "over": real, "stat": "pts", "pid": str(n),
                          "projection": {"average": average, "gfc": average + 20.0 * push, "five": average + 20.0 * rng.uniform(-0.2, 0.2),
                                         "combined": average + 10.0 * push}})
        found = dvp_backtest.value_beyond(calls)
        self.assertLess(found["gfc"]["pValue"], 0.001)       # gfc carries the signal
        self.assertGreater(found["five"]["pValue"], 0.01)    # five is noise
        self.assertLess(found["gfc"]["outOfSample"]["logLossWithMatchup"], found["gfc"]["outOfSample"]["logLossAverageAndLine"])


if __name__ == "__main__":
    unittest.main()
