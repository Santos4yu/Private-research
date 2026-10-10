"""NFL cheat sheets (nfl_sheets.py), checked on small hand-made seasons so
every number can be worked out by hand."""
import math
import time
import unittest
from unittest.mock import patch

import nfl_sheets as sheets


def play(game, offense, defense, drive, **fields):
    row = {"game_id": game, "season_type": "REG", "posteam": offense, "defteam": defense, "fixed_drive": str(drive),
           "fixed_drive_result": "Punt", "drive_inside20": "0", "touchdown": "0", "td_team": "", "td_player_id": "",
           "rush_touchdown": "0", "pass_touchdown": "0", "rush_attempt": "0", "pass_attempt": "0", "sack": "0",
           "two_point_attempt": "0", "rusher_player_id": "", "receiver_player_id": "", "receiving_yards": "",
           "pass_length": "", "pass_location": "", "yardline_100": "50", "qtr": "1", "play_type": "run"}
    row.update({key: str(value) for key, value in fields.items()})
    return row


def season_plays():
    """One game, BUF at MIA. BUF's first drive: a carry from the 30, a
    short-right catch, then a 4-yard touchdown run (red zone). MIA's first
    drive: a punt. BUF's second drive: a 40-yard touchdown catch, deep left.
    MIA's second drive reaches the red zone and settles for a field goal."""
    td = {"fixed_drive_result": "Touchdown", "drive_inside20": 1}
    return [
        play("G1", "BUF", "MIA", 1, rush_attempt=1, rusher_player_id="cook", yardline_100=30, **td),
        play("G1", "BUF", "MIA", 1, pass_attempt=1, receiver_player_id="shakir", receiving_yards=12, pass_length="short",
             pass_location="right", yardline_100=16, play_type="pass", **td),
        play("G1", "BUF", "MIA", 1, rush_attempt=1, rusher_player_id="cook", yardline_100=4, touchdown=1, rush_touchdown=1,
             td_team="BUF", td_player_id="cook", **td),
        play("G1", "MIA", "BUF", 2, rush_attempt=1, rusher_player_id="achane", yardline_100=75),
        play("G1", "BUF", "MIA", 3, pass_attempt=1, receiver_player_id="shakir", receiving_yards=40, pass_length="deep",
             pass_location="left", yardline_100=40, touchdown=1, pass_touchdown=1, td_team="BUF", td_player_id="shakir",
             play_type="pass", fixed_drive_result="Touchdown", qtr=2),
        play("G1", "MIA", "BUF", 4, pass_attempt=1, receiver_player_id="waddle", receiving_yards=0, pass_length="short",
             pass_location="middle", yardline_100=12, play_type="pass", fixed_drive_result="Field goal", drive_inside20=1, qtr=2),
        # A two-point try never counts.
        play("G1", "BUF", "MIA", 3, rush_attempt=1, rusher_player_id="cook", yardline_100=2, two_point_attempt=1),
    ]


class PlayByPlayTests(unittest.TestCase):
    def setUp(self):
        self.summary = sheets.summarize_pbp(season_plays())

    def test_red_zone_work_and_trips(self):
        cook, shakir = self.summary["players"]["cook"], self.summary["players"]["shakir"]
        # [red-zone carries, targets, inside-10 looks, red-zone TDs]
        self.assertEqual(cook["rz"], [1, 0, 1, 1])
        self.assertEqual(shakir["rz"], [0, 1, 0, 0])
        self.assertEqual(shakir["longTds"], 1)
        buf, mia_defense = self.summary["teams"]["BUF"], self.summary["defense"]["MIA"]
        self.assertEqual((buf["trips"], buf["tdTrips"], buf["tds"]), (1, 1, 2))
        self.assertEqual((mia_defense["trips"], mia_defense["tdTrips"]), (1, 1))
        self.assertEqual((self.summary["teams"]["MIA"]["trips"], self.summary["teams"]["MIA"]["tdTrips"]), (1, 0))

    def test_first_two_drives_and_the_first_touchdown(self):
        buf, mia = self.summary["teams"]["BUF"], self.summary["teams"]["MIA"]
        # [games, games with an early TD, early runs, early passes]
        self.assertEqual(buf["early"], [1, 1, 2, 2])
        self.assertEqual(mia["early"][:2], [1, 0])
        self.assertEqual(self.summary["defense"]["MIA"]["early"], [1, 1])
        self.assertEqual((buf["firstTd"], mia["firstTd"]), (1, 0))
        self.assertEqual(self.summary["players"]["cook"]["firstTd"], 1)
        self.assertEqual(self.summary["players"]["cook"]["d2"], [2, 0])

    def test_targets_by_zone(self):
        self.assertEqual(self.summary["players"]["shakir"]["zones"], {"short_right": [1, 12], "deep_left": [1, 40]})
        self.assertEqual(self.summary["defense"]["BUF"]["zones"], {"short_middle": [1, 0]})
        self.assertEqual(self.summary["league"]["zones"]["deep_left"], [1, 40])


class DefenseTableTests(unittest.TestCase):
    def test_per_game_totals_windows_and_ranks(self):
        games = {f"G{n}": {"kickoff": n} for n in range(1, 5)}
        rows = []
        # CLE faced four games; the receivers' yards add up per game.
        for game, yards in (("G1", (50, 30)), ("G2", (20,)), ("G3", (90, 10)), ("G4", (40,))):
            for index, value in enumerate(yards):
                rows.append({"game_id": game, "opponent_team": "CLE", "position": "WR", "player_id": f"{game}{index}",
                             "receiving_yards": value, "receptions": 1, "targets": 1, "rushing_yards": 0})
        # NYJ: two games, a WR in one only (the other counts as zero).
        rows.append({"game_id": "G1", "opponent_team": "NYJ", "position": "WR", "player_id": "x", "receiving_yards": 30,
                     "receptions": 2, "targets": 3, "rushing_yards": 0})
        rows.append({"game_id": "G2", "opponent_team": "NYJ", "position": "TE", "player_id": "y", "receiving_yards": 15,
                     "receptions": 1, "targets": 1, "rushing_yards": 0})
        table, league, played = sheets.dvp_table(rows, games)
        cle = table["CLE"]["WR"]["receiving_yards"]
        self.assertEqual(cle["szn"], [60.0, 2])
        self.assertEqual(cle["l3"], [53.33, 2])
        self.assertEqual(table["NYJ"]["WR"]["receiving_yards"]["szn"], [15.0, 1])
        self.assertEqual(league["WR"]["receiving_yards"]["szn"], 37.5)
        self.assertEqual(played, {"CLE": 4, "NYJ": 2})


class NumbersTests(unittest.TestCase):
    def test_streaks_and_rates(self):
        self.assertEqual(sheets.streak([10, 60, 70, 80], 55.5), (3, 0))
        self.assertEqual(sheets.streak([90, 40, 30], 55.5), (0, 2))
        self.assertEqual(sheets.rate([1, 2, 3, 2], 2, "over"), (0.5, 1, 2))

    def test_book_probability_matches_the_finder(self):
        # -120 / +100: implied .5455 and .5, the power method takes the
        # margin off; src/unified-finder-data.js gives the same .52323.
        chance, books = sheets.book_probability([{"key": "draftkings", "over": -120, "under": 100}])
        self.assertEqual(books, 1)
        self.assertAlmostEqual(chance, 0.5232, places=4)
        # PrizePicks and a pick'em app quoting both sides alike say nothing.
        self.assertEqual(sheets.book_probability([{"key": "prizepicks", "over": None}, {"key": "underdog", "over": -137, "under": -137}]),
                         (None, 0))
        self.assertEqual(sheets.american(0.75), -300)
        self.assertEqual(sheets.american(0.2), 400)


def game(game_id, away, home, points, started=False):
    return {"gameId": game_id, "week": 5, "away": away, "home": home, "startsAt": "2026-10-11T17:00:00+00:00",
            "started": started, "final": False, "points": points}


def person(player_id, team, position, status="ACT"):
    return {"id": player_id, "name": player_id.title(), "team": team, "position": position, "headshot": "", "pfr": "", "status": status}


class TouchdownModelTests(unittest.TestCase):
    def context(self, hurt=None):
        summary = sheets.summarize_pbp([])
        summary["players"] = {
            "cook": {"team": "BUF", "rz": [12, 2, 6, 4], "longTds": 1, "firstTd": 1, "q1": [5, 1], "d2": [6, 1], "zones": {}},
            "kincaid": {"team": "BUF", "rz": [0, 4, 2, 1], "longTds": 0, "firstTd": 0, "q1": [0, 3], "d2": [0, 2], "zones": {}},
            "shakir": {"team": "BUF", "rz": [0, 2, 0, 0], "longTds": 1, "firstTd": 0, "q1": [0, 4], "d2": [0, 3], "zones": {}},
        }
        seasons = {"cook": {"games": 4, "tds": 5, "carries": 70, "targets": 10, "team": "BUF"},
                   "kincaid": {"games": 4, "tds": 1, "carries": 0, "targets": 20, "team": "BUF"},
                   "shakir": {"games": 4, "tds": 1, "carries": 0, "targets": 25, "team": "BUF"}}
        table = {"MIA": {"RB": {"rush_rec_tds": {"szn": [1.5, 30]}}, "TE": {"rush_rec_tds": {"szn": [0.25, 4]}},
                         "WR": {"rush_rec_tds": {"szn": [0.75, 15]}}}}
        league = {"RB": {"rush_rec_tds": {"szn": 0.75}}, "TE": {"rush_rec_tds": {"szn": 0.3}}, "WR": {"rush_rec_tds": {"szn": 0.8}}}
        return {"season": 2026, "week": 5, "games": [game("G5", "MIA", "BUF", {"BUF": 27.0, "MIA": 20.0})],
                "people": {key: person(key, "BUF", position) for key, position in (("cook", "RB"), ("kincaid", "TE"), ("shakir", "WR"))},
                "hurt": hurt or {}, "leaguePoints": 22.0, "dvp": (table, league, {"MIA": 4}), "seasons": seasons,
                "pbp": summary, "upcoming": [], "mains": []}

    def test_team_touchdowns_are_shared_out_and_kept(self):
        with patch.object(sheets.finder, "games_index", return_value={}):
            model, per_point = sheets.td_model(self.context())
        self.assertEqual(per_point, 0.105)
        team = 27.0 * 0.105
        self.assertAlmostEqual(sum(item["expected"] for item in model.values()), team, places=6)
        cook = model["cook"]
        self.assertGreater(cook["expected"], model["shakir"]["expected"])
        self.assertAlmostEqual(cook["chance"], 1 - math.exp(-cook["expected"]))
        # MIA gives up twice the league's touchdowns to backs: Cook's part
        # is tilted up, within its cap.
        self.assertGreater(cook["tilt"], 1)
        self.assertLessEqual(cook["tilt"], 1.25)

    def test_a_player_ruled_out_leaves_his_share_to_the_others(self):
        with patch.object(sheets.finder, "games_index", return_value={}):
            full, _ = sheets.td_model(self.context())
            short, _ = sheets.td_model(self.context(hurt={"cook": "Out"}))
        self.assertNotIn("cook", short)
        self.assertGreater(short["shakir"]["expected"], full["shakir"]["expected"])
        self.assertAlmostEqual(sum(item["expected"] for item in short.values()), 27.0 * 0.105, places=6)

    def test_first_td_chances_follow_the_same_shares(self):
        ctx = self.context()
        ctx["pbp"]["teams"]["BUF"] = {"games": 4, "rz": [14, 8], "q1": [5, 8], "d2": [6, 6], "trips": 14, "tdTrips": 9,
                                      "early": [4, 3, 6, 6], "firstTd": 3, "tds": 9}
        ctx["pbp"]["defense"]["BUF"] = {"games": 4, "trips": 12, "tdTrips": 6, "early": [4, 1], "zones": {}}
        with patch.object(sheets.finder, "games_index", return_value={}):
            body = sheets.sheet_firsttd(ctx)
        away, home = body["cards"][0]["sides"]
        self.assertEqual((away["team"], home["team"]), ("MIA", "BUF"))
        self.assertGreater(home["chance"], away["chance"])
        cook = next(player for player in home["players"] if player["who"]["id"] == "cook")
        self.assertAlmostEqual(cook["chance"], home["chance"] * cook["share"], places=2)


def board_row(row_id, player, market, line, apps, category="STANDARD", values=(), position="WR", team="BUF", opponent="MIA",
              starts="2099-10-11T17:00:00+00:00"):
    return {"id": row_id, "playerId": player, "playerName": player.title(), "position": position, "teamId": team,
            "opponentId": opponent, "gameId": "G5", "startsAt": starts, "propType": market, "propLabel": market,
            "line": {"value": line, "category": category}, "apps": apps,
            "gameLog": [{"value": value, "date": f"2026-09-{10 + index:02d}"} for index, value in enumerate(values)]}


class LineSheetTests(unittest.TestCase):
    def ctx(self, rows, dvp=None):
        upcoming = sheets.upcoming(rows, now=time.time())
        return {"season": 2026, "week": 5, "games": [game("G5", "MIA", "BUF", {"BUF": 27.0, "MIA": 20.0})],
                "people": {}, "hurt": {}, "leaguePoints": 22.0, "upcoming": upcoming, "mains": sheets.main_lines(upcoming),
                "dvp": dvp or ({}, {}, {})}

    def test_soft_spots_only_face_the_eight_softest(self):
        table = {"MIA": {"WR": {"receiving_yards": {"l5": [190.0, 30], "szn": [180.0, 29]}}},
                 "NYJ": {"WR": {"receiving_yards": {"l5": [120.0, 10], "szn": [130.0, 9]}}}}
        league = {"WR": {"receiving_yards": {"l5": 150.0, "szn": 150.0}}}
        rows = [board_row("pp:1", "shakir", "receiving_yards", 45.5, [{"key": "prizepicks"}, {"key": "fanduel", "over": -110, "under": -110}],
                          values=[50, 60, 30, 70, 80, 20, 55, 60, 65, 90]),
                board_row("pp:2", "wilson", "receiving_yards", 60.5, [{"key": "prizepicks"}], opponent="NYJ", values=[70] * 6)]
        body = sheets.sheet_soft(self.ctx(rows, (table, league, {team: 4 for team in ("MIA", "NYJ", *map(str, range(30)))})))
        self.assertEqual([spot["who"]["id"] for spot in body["spots"]], ["shakir"])
        spot = body["spots"][0]
        self.assertEqual((spot["rank"], spot["teams"], spot["versus"]), (30, 32, round(190 / 150 - 1, 3)))
        self.assertEqual(spot["hits"]["l10"], {"rate": 0.8, "hits": 8, "games": 10})
        self.assertEqual(spot["best"]["book"], "fanduel")

    def test_goblins_get_the_books_chance_at_their_number(self):
        rows = [board_row("pp:3", "kincaid", "receiving_yards", 19.5,
                          [{"key": "prizepicks"}, {"key": "draftkings", "over": -400}, {"key": "fanduel", "over": -300, "under": 220}],
                          category="GOBLIN", position="TE", values=[30, 25, 10, 40]),
                board_row("pp:4", "kincaid", "receiving_yards", 34.5, [{"key": "prizepicks"}], position="TE", values=[30, 25, 10, 40])]
        body = sheets.sheet_goblins(self.ctx(rows))
        self.assertEqual(len(body["lines"]), 1)
        line = body["lines"][0]
        self.assertEqual((line["kind"], line["main"], line["books"]), ("goblin", 34.5, 2))
        self.assertGreater(line["chance"], 0.7)
        self.assertEqual(line["hits"]["l5"], {"rate": 0.75, "hits": 3, "games": 4})

    def test_line_shopping_finds_a_better_price_and_an_off_market_number(self):
        apps = [{"key": "draftkings", "over": -115, "under": -105}, {"key": "fanduel", "over": -118, "under": -102},
                {"key": "betmgm", "over": -120, "under": 100}, {"key": "williamhill_us", "over": 125, "under": -150}]
        rows = [board_row("odds:1", "cook", "rushing_yards", 70.5, apps, position="RB", values=[80, 60, 90]),
                board_row("pp:5", "cook", "rushing_yards", 64.5, [{"key": "prizepicks"}], position="RB", values=[80, 60, 90])]
        body = sheets.sheet_shop(self.ctx(rows))
        price = next(row for row in body["rows"] if row["kind"] == "price")
        self.assertEqual((price["book"], price["side"], price["price"]), ("williamhill_us", "over", 125))
        self.assertGreater(price["edge"], 0.1)
        line = next(row for row in body["rows"] if row["kind"] == "line")
        self.assertEqual((line["line"], line["center"], line["side"], line["where"]), (64.5, 70.5, "over", ["prizepicks"]))

    def test_streaks_skip_missed_half_point_lines(self):
        rows = [board_row("pp:6", "cook", "touchdowns", 0.5, [{"key": "prizepicks"}], position="RB", values=[0, 0, 0, 0, 0, 0]),
                board_row("pp:7", "cook", "rushing_yards", 60.5, [{"key": "prizepicks"}], position="RB", values=[40, 70, 75, 80, 90, 65])]
        body = sheets.sheet_streaks(self.ctx(rows))
        self.assertEqual([(row["label"], row["side"], row["streak"]) for row in body["rows"]], [("Rush Yards", "over", 5)])
        self.assertEqual(body["rows"][0]["tag"], "hot")


class SteamTests(unittest.TestCase):
    def test_moves_since_the_open_across_books(self):
        hour = int(time.time() // 3600) + 30
        books = {f"{book}|joshallen|passyards|{hour}": [now, -110, -110, time.time()] for book, now in
                 (("draftkings", 250.5), ("fanduel", 251.5), ("betmgm", 245.5))}
        opened = {f"{book}|joshallen|passyards|{hour}": [245.5, -110, -110, time.time() - 86400] for book in ("draftkings", "fanduel", "betmgm")}
        recorded = {"books": {"open": opened, "now": books, "at": time.time(), "people": {}, "stats": {}},
                    "pp": {"open": {}, "now": {}, "at": None, "people": {}, "stats": {}}}
        import line_moves
        rows = [board_row("odds:9", "josh allen", "passing_yards", 250.5, [], position="QB")]
        rows[0]["playerName"] = "Josh Allen"
        ctx = {"season": 2026, "upcoming": rows, "people": {}}
        with patch.object(line_moves, "openings", return_value=recorded), \
                patch.object(line_moves, "recent", return_value={"moves": [], "checked": {}}), \
                patch.object(sheets, "label_of", return_value="Pass Yards"):
            body = sheets.sheet_steam(ctx)
        self.assertFalse(body["recording"])
        row = body["rows"][0]
        self.assertEqual((row["open"], row["now"], row["change"], row["direction"], row["agree"], row["books"]),
                         (245.5, 250.5, 5.0, "up", 2, 3))
        self.assertEqual(row["tag"], "steam")
        self.assertEqual(row["who"]["name"], "Josh Allen")


if __name__ == "__main__":
    unittest.main()
