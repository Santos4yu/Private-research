"""How an NFL matchup plays (nfl_plays.py): hand-made games whose splits can
be worked out by hand, and real 2026 numbers (weeks 1-6) checked against
RotoBot's published Jahmyr Gibbs page."""
import json
import unittest
from pathlib import Path
from unittest.mock import patch

import nfl_plays as plays

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "nfl-2026-week6-backs.json"


def play(game, offense, defense, play_id, week, **fields):
    row = {"game_id": game, "play_id": str(play_id), "season_type": "REG", "week": str(week), "posteam": offense,
           "defteam": defense, "play_type": "pass", "rush": "0", "pass_attempt": "0", "sack": "0", "qb_dropback": "0",
           "qb_scramble": "0", "qb_kneel": "0", "qb_spike": "0", "two_point_attempt": "0", "rusher_player_id": "NA",
           "receiver_player_id": "NA", "passer_player_id": "NA", "yards_gained": "0", "complete_pass": "0", "air_yards": "NA",
           "yards_after_catch": "NA", "pass_location": "NA", "run_location": "NA", "run_gap": "NA", "yardline_100": "50",
           "first_down": "0", "rush_touchdown": "0", "pass_touchdown": "0", "interception": "0", "epa": "0", "success": "0",
           "cpoe": "NA"}
    row.update({key: str(value) for key, value in fields.items()})
    return row


def run(game, offense, defense, play_id, rusher, yards, location, gap="NA", **fields):
    return play(game, offense, defense, play_id, 1, play_type="run", rush=1, rusher_player_id=rusher, yards_gained=yards,
                run_location=location, run_gap=gap, **fields)


def target(game, offense, defense, play_id, receiver, air, yards, caught=True, **fields):
    return play(game, offense, defense, play_id, 1, qb_dropback=1, pass_attempt=1, passer_player_id="qb", receiver_player_id=receiver,
                air_yards=air, complete_pass=int(caught), yards_gained=yards if caught else 0, **fields)


def weekly(player, position, team="DET", opponent="GB", week=1, **fields):
    row = {"player_id": player, "player_display_name": player.upper(), "position": position, "season_type": "REG", "week": str(week),
           "game_id": f"G{week}", "team": team, "opponent_team": opponent}
    row.update({key: str(value) for key, value in fields.items()})
    return row


class BucketTests(unittest.TestCase):
    def test_box_direction_lane_and_depth(self):
        self.assertEqual([plays.box_of(n) for n in (0, None, 5, 6, 7, 8, 11)], [None, None, "light", "light", "base", "stacked", "stacked"])
        # A run at either guard is up the middle; the lane keeps the hole.
        self.assertEqual(plays.direction_of("left", "guard"), "middle")
        self.assertEqual(plays.direction_of("left", "tackle"), "left")
        self.assertEqual(plays.direction_of("middle", "NA"), "middle")
        self.assertIsNone(plays.direction_of("NA", "NA"))
        self.assertEqual(plays.lane_of("right", "end"), "end")
        self.assertEqual(plays.lane_of("middle", "NA"), "middle")
        self.assertEqual([plays.depth_of(a) for a in (-3, 0, 9, 10, 19, 20, None)],
                         ["behind", "short", "short", "intermediate", "intermediate", "deep", None])


class TableTests(unittest.TestCase):
    """DET's back runs six times against GB (light box twice, base three
    times, one unread box), a quarterback scrambles and kneels (neither is a
    designed run), and a two-point try is left out. GB's defense counts only
    the back's carries."""

    def setUp(self):
        rows = [run("G1", "DET", "GB", 1, "rb", 7, "left", "end"), run("G1", "DET", "GB", 2, "rb", 3, "left", "guard"),
                run("G1", "DET", "GB", 3, "rb", 5, "right", "tackle"), run("G1", "DET", "GB", 4, "rb", 1, "middle"),
                run("G1", "DET", "GB", 5, "rb", 2, "middle", yardline_100=4, rush_touchdown=1, first_down=1),
                run("G1", "DET", "GB", 6, "rb", 6, "right", "end", first_down=1),
                run("G1", "DET", "GB", 7, "qb", 9, "middle"),
                play("G1", "DET", "GB", 8, 1, play_type="run", rush=0, qb_scramble=1, qb_dropback=1, rusher_player_id="qb", yards_gained=12),
                play("G1", "DET", "GB", 9, 1, play_type="qb_kneel", qb_kneel=1, rusher_player_id="qb", yards_gained=-1),
                run("G1", "DET", "GB", 10, "rb", 3, "left", "end", two_point_attempt=1),
                target("G1", "DET", "GB", 11, "rb", -2, 8, yards_after_catch=10),
                target("G1", "DET", "GB", 12, "wr", 25, 30, pass_location="right"),
                target("G1", "DET", "GB", 13, "wr", 12, 0, caught=False, pass_location="middle")]
        charting = {("G1", 1): {"box": 6}, ("G1", 2): {"box": 5}, ("G1", 3): {"box": 7}, ("G1", 4): {"box": 7},
                    ("G1", 5): {"box": 7}, ("G1", 6): {"box": 0},
                    ("G1", 11): {"blitz": True, "pa": False}, ("G1", 12): {"blitz": False, "pa": True}, ("G1", 13): {"blitz": True, "pa": False}}
        stats = [weekly("rb", "RB", carries=6, rushing_yards=24, targets=1, receptions=1, receiving_yards=8, rushing_tds=1, fantasy_points=9.2),
                 weekly("qb", "QB", attempts=3, completions=2, passing_yards=38, carries=2, rushing_yards=21),
                 weekly("wr", "WR", targets=2, receptions=1, receiving_yards=30)]
        self.table = plays.summarize(rows, charting, stats)

    def test_his_runs_by_box_direction_and_lane(self):
        back = self.table["players"]["rb"]["run"]
        self.assertEqual(back["box"], {"light": [2, 10], "base": [3, 8]})   # the unread box is left out
        self.assertEqual(back["direction"], {"left": [1, 7], "middle": [3, 6], "right": [2, 11]})
        self.assertEqual(back["lane"], {"end": [2, 13], "guard": [1, 3], "tackle": [1, 5], "middle": [2, 3]})

    def test_the_defense_counts_backs_only(self):
        gb = self.table["defense"]["GB"]["run"]
        self.assertEqual(gb["direction"], {"left": [1, 7], "middle": [3, 6], "right": [2, 11]})
        # The quarterback's designed run is his own, not GB's against backs.
        self.assertEqual(self.table["players"]["qb"]["run"]["direction"], {"middle": [1, 9]})

    def test_totals_and_targets(self):
        back = self.table["players"]["rb"]["totals"]
        self.assertEqual((back["designed"], back["rzCarries"], back["glCarries"], back["rzTds"], back["firstDowns"]), (6, 1, 1, 1, 2))
        self.assertEqual((back["carries"], back["rushYds"], back["yac"]), (6, 24, 10))
        # Half-PPR: the standard points and half a point a catch.
        self.assertEqual(back["fantasy"], 9.7)
        # His team's designed runs and targets in his games.
        self.assertEqual((back["team:carries"], back["team:targets"]), (7, 3))
        receiver = self.table["players"]["wr"]
        self.assertEqual(receiver["target"]["depth"], {"deep": [1, 1, 30], "intermediate": [1, 0, 0]})
        self.assertEqual(receiver["target"]["area"], {"right": [1, 1, 30], "middle": [1, 0, 0]})
        self.assertEqual(receiver["target"]["blitz"], {"calm": [1, 1, 30], "blitz": [1, 0, 0]})
        self.assertEqual(receiver["totals"]["team:targets:blitz"], 2)
        passer = self.table["players"]["qb"]
        self.assertEqual(passer["pass"]["playAction"], {"nopa": [2, 1, 8], "pa": [1, 1, 30]})
        self.assertEqual(self.table["defense"]["GB"]["pass"]["depth"], {"behind": [1, 1, 8], "deep": [1, 1, 30], "intermediate": [1, 0, 0]})
        self.assertFalse(self.table["coverage"])


def backs():
    return json.loads(FIXTURE.read_text())


class RotoBotTests(unittest.TestCase):
    """2026 weeks 1-6 from nflverse (tests/fixtures/nfl-2026-week6-backs.json:
    every back's runs and Green Bay's), against RotoBot's Gibbs page before
    week 7."""

    def setUp(self):
        self.table = backs()
        self.gibbs = "00-0039139"
        self.peers = {pid: {**entry, "id": pid} for pid, entry in self.table["players"].items()}

    def rows(self, split):
        result = plays.split_rows("run", split, self.peers[self.gibbs], self.peers, self.table["defense"], "GB")
        return {row["key"]: row for row in result["rows"]}

    def test_box_count(self):
        rows = self.rows("box")
        self.assertEqual((rows["light"]["his"]["n"], rows["light"]["his"]["yards"]), (54, 289))
        self.assertEqual((rows["light"]["his"]["rank"], rows["light"]["his"]["of"]), (11, 65))
        self.assertEqual((rows["base"]["his"]["rank"], rows["base"]["his"]["of"]), (16, 64))
        self.assertIsNone(rows["stacked"]["his"]["rank"])            # 7 carries, under 8
        self.assertAlmostEqual(rows["light"]["them"]["share"], 0.522, 3)
        self.assertEqual(rows["light"]["them"]["shareRank"], 8)      # "8th most"
        self.assertEqual(rows["base"]["them"]["shareRank"], 26)      # "7th least" of 32
        self.assertEqual((rows["stacked"]["them"]["shareRank"], rows["stacked"]["them"]["of"]), (21, 31))

    def test_direction(self):
        rows = self.rows("direction")
        self.assertEqual([(rows[key]["his"]["n"], rows[key]["his"]["yards"], rows[key]["his"]["rank"], rows[key]["his"]["of"])
                          for key in ("left", "middle", "right")], [(21, 114, 11, 47), (53, 198, 36, 70), (31, 192, 4, 42)])
        self.assertEqual(round(rows["middle"]["them"]["value"], 2), 2.62)
        self.assertEqual(rows["middle"]["them"]["rank"], 32)         # the fewest
        self.assertEqual((round(rows["left"]["them"]["value"], 2), rows["left"]["them"]["rank"]), (5.52, 7))
        self.assertEqual((round(rows["right"]["them"]["value"], 2), rows["right"]["them"]["rank"]), (4.77, 11))

    def test_production_ranks(self):
        # RotoBot ranks among backs with 9+ carries and targets (1.5 a week);
        # ours asks 1.5 a game of each back's own team, so a back whose team
        # had its bye isn't held to a game he couldn't play: one more back
        # (89, not 88) and one more receiver (16, not 15), the same ranks.
        team_games = {team: info["games"] for team, info in self.table["defense"].items()}
        groups = {group["key"]: {item["key"]: item for item in group["items"]}
                  for group in plays.metrics_for(self.gibbs, self.table["players"][self.gibbs], self.table["players"], "RB", team_games)}
        production = groups["production"]
        self.assertEqual([(production[key]["value"], production[key]["rank"], production[key]["of"]) for key in
                          ("rushTds", "rzTds", "firstDowns", "rec", "recYds", "yac", "rushYds")],
                         [(7, 1, 89), (9, 1, 86), (50, 1, 89), (27, 3, 89), (243, 3, 89), (195, 4, 85), (504, 5, 89)])
        self.assertEqual((groups["volume"]["carries"]["rank"], groups["volume"]["targets"]["rank"]), (6, 4))
        self.assertEqual((groups["rushing"]["ypc"]["rank"], groups["rushing"]["ypc"]["of"]), (8, 39))
        self.assertEqual([groups["receiving"][key]["rank"] for key in ("ypt", "ypr", "catchRate")], [2, 4, 8])
        self.assertEqual(groups["receiving"]["ypt"]["of"], 16)


class MetricTests(unittest.TestCase):
    def test_ranks_fewest_first_and_qualifiers(self):
        players = {"a": {"pos": "QB", "team": "DET", "totals": {"att": 100, "ints": 1, "passYds": 800}},
                   "b": {"pos": "QB", "team": "GB", "totals": {"att": 80, "ints": 4, "passYds": 700}},
                   "c": {"pos": "QB", "team": "GB", "totals": {"att": 5, "ints": 0, "passYds": 40}}}
        # DET have played 6 games, GB 5 (a bye): b needs 70 attempts, a 84.
        team_games = {"DET": 6, "GB": 5}
        groups = {group["key"]: group for group in plays.metrics_for("a", players["a"], players, "QB", team_games)}
        ints = next(item for item in groups["production"]["items"] if item["key"] == "ints")
        # c throws too little to be a regular (1.5 a week); a has the fewest of the rest.
        self.assertEqual((ints["rank"], ints["of"]), (1, 2))
        self.assertEqual(groups["passing"]["need"], {"stat": "att", "min": 84})
        self.assertTrue(groups["passing"]["ranked"])
        cmp_pct = next(item for item in groups["passing"]["items"] if item["key"] == "ypa")
        self.assertEqual(cmp_pct["of"], 2)          # b qualifies on GB's five games
        low = {group["key"]: group for group in plays.metrics_for("c", players["c"], players, "QB", team_games)}
        self.assertFalse(low["passing"]["ranked"])
        self.assertIsNone(low["production"]["items"][0]["rank"])


class FacedTests(unittest.TestCase):
    def test_his_average_going_in_and_his_line_that_day(self):
        rows = [weekly("b1", "RB", team="MIN", week=1, opponent="GB", carries=15, rushing_yards=80, targets=2, receptions=2, receiving_yards=10),
                weekly("b1", "RB", team="MIN", week=2, opponent="CHI", carries=10, rushing_yards=40),
                weekly("b1", "RB", team="MIN", week=3, opponent="DAL", carries=12, rushing_yards=60),
                weekly("b2", "RB", team="CHI", week=3, opponent="GB", carries=18, rushing_yards=50, targets=1, receptions=1, receiving_yards=4),
                weekly("b2", "RB", team="CHI", week=1, opponent="DET", carries=20, rushing_yards=100),
                weekly("b3", "RB", team="CHI", week=3, opponent="GB", carries=1, rushing_yards=3),          # too little of the ball
                weekly("w1", "WR", team="CHI", week=3, opponent="GB", targets=8, receptions=5, receiving_yards=70)]
        dates = {"G1": "2026-09-13", "G3": "2026-09-27"}
        lines = {("2026-09-27", "b2"): {"rushing_yards": 64.5}}
        out = plays.faced_rows(rows, "GB", "RB", dates, lines)
        self.assertEqual([(item["id"], item["week"]) for item in out], [("b2", 3), ("b1", 1)])
        newest, oldest = out
        self.assertEqual(newest["values"]["rushing_yards"], 50)
        self.assertEqual(newest["base"]["rushing_yards"], 100)       # his one game before it
        self.assertEqual(newest["lines"], {"rushing_yards": 64.5})
        self.assertEqual((oldest["base"], oldest["games"]), ({}, 0))  # week 1: nothing before it


class PageTests(unittest.TestCase):
    def test_coverage_falls_back_to_last_season_and_says_so(self):
        current = {"players": {"wr": {"pos": "WR", "team": "DET", "target": {"depth": {"short": [10, 7, 60]}},
                                      "totals": {"targets": 10, "games": 2}}},
                   "defense": {"GB": {"games": 2, "pass": {"depth": {"short": [30, 20, 150]}}}}, "weeks": [1, 2], "coverage": False}
        saved = {"season": 2025, "players": {"wr": {"pos": "WR", "target": {"coverage": {"man": [10, 6, 90], "split": [5, 3, 20]}}}},
                 "defense": {"GB": {"pass": {"coverage": {"man": [40, 25, 300], "cover3": [60, 40, 400]}}}}}
        kept = lambda season: saved if season == 2025 else None
        with patch.object(plays, "table", return_value=current), patch.object(plays, "saved_coverage", side_effect=kept), \
                patch.object(plays, "faced", return_value=None):
            page = plays.for_player(2026, "wr", "GB")
            # Last season's own page reads its own saved file.
            past = plays.for_player(2025, "wr")
        coverage = next(split for split in page["splits"] if split["split"] == "coverage")
        self.assertEqual(coverage["season"], 2025)
        man = coverage["rows"][0]
        self.assertEqual((man["his"]["n"], man["his"]["value"]), (10, 9.0))
        self.assertEqual((man["them"]["n"], man["them"]["share"]), (40, 0.4))
        depth = next(split for split in page["splits"] if split["split"] == "depth")
        self.assertEqual(depth["season"], 2026)
        self.assertEqual(page["player"]["group"], "WR")
        self.assertEqual(next(split for split in past["splits"] if split["split"] == "coverage")["season"], 2025)

    def test_an_unknown_player_or_an_unpublished_season(self):
        with patch.object(plays, "table", return_value={"players": {}, "defense": {}, "weeks": [1]}):
            self.assertIsNone(plays.for_player(2026, "nobody", "GB")["player"])
        with patch.object(plays, "table", side_effect=LookupError("not yet")):
            self.assertIsNone(plays.for_player(2026, "nobody", "GB")["player"])


class RouteTests(unittest.TestCase):
    def call(self, path, **fake):
        import importlib.util
        spec = importlib.util.spec_from_file_location("api_nfl_plays", Path(__file__).resolve().parents[1] / "api/nfl.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        sent = {}
        handler = module.handler.__new__(module.handler)
        handler.path, handler.headers = path, {}
        with patch.object(module, "session_with_live_access", return_value=True), \
                patch("site_controls.finder_sport_allowed", return_value=True), \
                patch.object(plays, "season_now", return_value=2026), \
                patch.object(plays, "for_player", side_effect=lambda *args: {"args": list(args)}), \
                patch.object(module, "send_json", side_effect=lambda _h, status, body: sent.update(status=status, body=body)):
            handler._get()
        return sent

    def test_checks_the_player_opponent_and_season(self):
        self.assertEqual(self.call("/api/nfl?resource=finder-plays&season=2026&playerId=nope")["status"], 400)
        self.assertEqual(self.call("/api/nfl?resource=finder-plays&season=2026&playerId=00-0039139&opponent=gb1")["status"], 400)
        self.assertEqual(self.call("/api/nfl?resource=finder-plays&season=2023&playerId=00-0039139")["status"], 400)
        sent = self.call("/api/nfl?resource=finder-plays&season=2026&playerId=00-0039139&opponent=GB")
        self.assertEqual((sent["status"], sent["body"]["args"]), (200, [2026, "00-0039139", "GB"]))
        sent = self.call("/api/nfl?resource=finder-plays&season=2025&playerId=00-0039139")
        self.assertEqual(sent["body"]["args"], [2025, "00-0039139", None])


class StoreTests(unittest.TestCase):
    def test_a_rebuilt_table_is_read_back_without_building(self):
        from backend.sports.nfl import cache
        cache.clear_nfl_cache()
        size, stored = cache.store_nfl(cache.NFLCacheDomain.PLAYS, ("t", 2026), {"players": {}})
        self.assertGreater(size, 0)
        self.assertFalse(stored)        # no durable store under test: said, not assumed
        self.assertEqual(cache.cached_nfl(cache.NFLCacheDomain.PLAYS, ("t", 2026), lambda: self.fail("rebuilt")), {"players": {}})


if __name__ == "__main__":
    unittest.main()
