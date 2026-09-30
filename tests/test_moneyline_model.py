import unittest
from datetime import datetime, timedelta, timezone
from unittest import mock

import moneyline_model as ml

NOW = datetime(2026, 10, 4, 15, 0, tzinfo=timezone.utc)
KICK = (NOW + timedelta(hours=2)).isoformat().replace("+00:00", "Z")


def book(key, home, away):
    return {"key": key, "title": key, "last_update": KICK, "markets": [{"key": "h2h", "outcomes": [
        {"name": "Kansas City Chiefs", "price": home}, {"name": "Buffalo Bills", "price": away}]}]}


EVENT = {"id": "evt1", "commence_time": KICK, "home_team": "Kansas City Chiefs", "away_team": "Buffalo Bills", "bookmakers": [
    book("pinnacle", -150, 135), book("betonlineag", -152, 132), book("draftkings", -155, 130),
    book("fanduel", -148, 128), book("betmgm", -160, 135), book("espnbet", -130, 110), book("williamhill_us", -155, 130),
    book("unknownbook", -300, 250)]}
ESPN = {"events": [{"id": "401", "date": KICK, "competitions": [{
    "status": {"type": {"state": "pre", "completed": False, "shortDetail": "Sun 1:00 PM"}},
    "competitors": [
        {"homeAway": "home", "score": "0", "team": {"displayName": "Kansas City Chiefs", "shortDisplayName": "Chiefs", "abbreviation": "KC", "logo": "kc.png"},
         "records": [{"summary": "3-0"}]},
        {"homeAway": "away", "score": "0", "team": {"displayName": "Buffalo Bills", "shortDisplayName": "Bills", "abbreviation": "BUF", "logo": "buf.png"},
         "records": [{"summary": "2-1"}]}]}]}]}


class PricesTest(unittest.TestCase):
    def test_prices_and_devig(self):
        self.assertEqual(ml.decimal(-110), 1 + 100 / 110)
        self.assertEqual(ml.decimal(150), 2.5)
        self.assertIsNone(ml.decimal(50))
        self.assertEqual((ml.american(0.6), ml.american(0.4)), (-150, 150))
        self.assertAlmostEqual(ml.devig(-110, -110), 0.5)
        # The power method keeps more of a heavy favorite's chance than scaling.
        a, b = 1 / ml.decimal(-400), 1 / ml.decimal(300)
        self.assertGreater(ml.devig(-400, 300), a / (a + b))

    def test_consensus_weights_sharp_books_and_drops_a_broken_one(self):
        books = [{"key": "pinnacle", "home": -150, "away": 135}, {"key": "draftkings", "home": -150, "away": 130},
                 {"key": "fanduel", "home": -148, "away": 128}, {"key": "betmgm", "home": 300, "away": -400}]
        fair, used = ml.consensus(books)
        self.assertNotIn("betmgm", used)
        self.assertTrue(0.57 < fair < 0.59, fair)
        # Pinnacle counts three times: the consensus sits nearest its number.
        self.assertLess(abs(fair - ml.devig(-150, 135)), abs(fair - ml.devig(-148, 128)))

    def test_best_price_is_somewhere_a_member_can_bet(self):
        books = [{"key": "pinnacle", "home": -120, "away": 110}, {"key": "draftkings", "home": -130, "away": 105},
                 {"key": "fanduel", "home": -125, "away": 102}]
        self.assertEqual(ml.best_price(books, "home"), {"price": -125, "book": "fanduel", "bookName": "FanDuel"})
        self.assertEqual(ml.best_price(books, "away")["book"], "draftkings")

    def test_units_are_a_quarter_kelly(self):
        self.assertEqual(ml.units(0.55, 100), 2.5)   # edge 10% at even money: 10% Kelly, 2.5% a quarter
        self.assertEqual(ml.units(0.5, -110), 0)
        self.assertEqual(ml.units(0.9, 100), 3.0)    # capped
        self.assertEqual(ml.units(0.505, 100), 0.5)  # floored


class RatingsTest(unittest.TestCase):
    def test_srs_recovers_team_strength_and_removes_home_edge(self):
        truth = {"A": 6, "B": 2, "C": -3, "D": -5}
        games = [(h, a, truth[h] - truth[a] + 2, 1.0) for h in truth for a in truth if h != a]
        rating = ml.srs(games, hfa=2, shrink=0)
        for team, value in truth.items():
            self.assertAlmostEqual(rating[team], value, places=3)
        shrunk = ml.srs(games, hfa=2, shrink=6)
        self.assertLess(abs(shrunk["A"]), 6)

    def test_team_names_match_across_sources(self):
        self.assertTrue(ml.same_team("Montréal Canadiens", "Montreal Canadiens"))
        self.assertTrue(ml.same_team("St Louis Blues", "St. Louis Blues"))
        self.assertTrue(ml.same_team("Oakland Athletics", "Athletics", "Athletics"))
        self.assertFalse(ml.same_team("Boston Red Sox", "Chicago White Sox", "White Sox"))
        self.assertEqual(ml.team_rating({"Athletics": 0.3, "Chicago Cubs": 0.1}, "Oakland Athletics"), (0.3, "Athletics"))

    def test_mlb_starter_against_his_own_staff(self):
        rated = {"ids": {"Detroit Tigers": "116"}, "probables": {"116": {"name": "Tarik Skubal", "era": 2.2, "ip": 180}},
                 "staffs": {"116": {"era": 3.9}}}
        edge, pitcher = ml.starter_edge(rated, "Detroit Tigers")
        self.assertTrue(0.8 < edge <= 0.9, edge)
        self.assertEqual(pitcher["name"], "Tarik Skubal")
        self.assertEqual(ml.starter_edge(rated, "Cleveland Guardians")[0], 0.0)


class ModelTest(unittest.TestCase):
    def test_a_game_priced_and_a_play_found(self):
        [game] = ml.parse_odds([EVENT])
        self.assertEqual([item["key"] for item in game["books"]][:2], ["pinnacle", "betonlineag"])
        self.assertNotIn("unknownbook", [item["key"] for item in game["books"]])
        rated = {"teams": {"Kansas City Chiefs": 4.0, "Buffalo Bills": 1.0}, "rest": {}}
        read = ml.read_game("nfl", game, rated)
        self.assertTrue(0.57 < read["fair"]["home"] < 0.6)
        # ESPN BET's -130 on the Chiefs beats a ~58% fair chance.
        pick = read["pick"]
        self.assertEqual((pick["side"], pick["book"], pick["price"]), ("home", "espnbet", -130))
        self.assertGreater(pick["ev"], ml.PLAY_EV)
        self.assertIn(pick["tier"], ("play", "strong"))
        self.assertGreater(pick["units"], 0)
        # The ratings tilt the chance, never by more than the cap.
        self.assertLessEqual(abs(read["model"]["tilt"]), ml.MAX_TILT)
        self.assertIn("Our ratings have Kansas City Chiefs by", read["model"]["text"])
        self.assertTrue(read["reasons"][0].startswith("The market has Kansas City Chiefs at"))
        self.assertIn("ESPN BET pays -130", read["reasons"][1])

    def test_no_play_when_every_price_is_fair(self):
        event = {**EVENT, "bookmakers": [book("pinnacle", -150, 135), book("draftkings", -160, 135), book("fanduel", -158, 132)]}
        [game] = ml.parse_odds([event])
        read = ml.read_game("nfl", game, {"teams": {}})
        self.assertIsNone(read["pick"])
        self.assertIsNone(read["model"]["text"])

    def test_ratings_leaning_the_other_way_block_a_play(self):
        [game] = ml.parse_odds([EVENT])
        read = ml.read_game("nfl", game, {"teams": {"Kansas City Chiefs": -6.0, "Buffalo Bills": 6.0}, "rest": {}})
        # Not the Chiefs (the ratings argue), and not the Bills either: their
        # best price is no better than the market's fair one.
        self.assertNotIn((read["pick"] or {}).get("tier"), ("play", "strong"))
        self.assertLess(read["marketEv"]["away"], 0)


class BoardAndRecordTest(unittest.TestCase):
    def setUp(self):
        ml._memory.clear()

    def board(self, events, now=NOW):
        with mock.patch.object(ml, "fetch_odds", return_value=(events, 5000)), \
                mock.patch.object(ml, "_espn", return_value=ESPN), \
                mock.patch.object(ml, "ratings", return_value={"teams": {"Kansas City Chiefs": 4.0, "Buffalo Bills": 1.0}, "rest": {}}):
            return ml.board("nfl", force=True, now=now)

    def test_board_records_the_play_and_keeps_its_close(self):
        result = self.board([EVENT])
        [game] = result["games"]
        self.assertEqual((game["espn"]["home"]["abbr"], game["espn"]["home"]["record"]), ("KC", "3-0"))
        self.assertEqual(result["plays"], 1)
        [play] = ml._memory["plays"]
        self.assertEqual((play["team"], play["price"], play["bookName"]), ("Kansas City Chiefs", -130, "ESPN BET"))
        # Later, ESPN BET moves to -150: the play keeps -130, its close moves.
        later = {**EVENT, "bookmakers": [book(key, -150 if key == "espnbet" else home, away)
                                         for key, home, away in [("pinnacle", -165, 145), ("draftkings", -170, 145), ("espnbet", 0, 125)]]}
        self.board([later], now=NOW + timedelta(minutes=90))
        [play] = ml._memory["plays"]
        self.assertEqual(play["price"], -130)
        self.assertEqual(play["close"]["price"], -150)
        self.assertGreater(ml.clv(play), 0)   # -130 beat a ~62% close

    def test_grading_and_the_record(self):
        self.board([EVENT])
        final = {"events": [{**ESPN["events"][0], "competitions": [{**ESPN["events"][0]["competitions"][0],
                  "status": {"type": {"state": "post", "completed": True}},
                  "competitors": [{**ESPN["events"][0]["competitions"][0]["competitors"][0], "score": "27"},
                                  {**ESPN["events"][0]["competitions"][0]["competitors"][1], "score": "20"}]}]}]}
        with mock.patch.object(ml, "_espn", return_value=final):
            self.assertEqual(ml.grade(NOW + timedelta(hours=6)), 1)
        [play] = ml._memory["plays"]
        self.assertEqual((play["result"], play["score"]), ("W", "27-20"))
        self.assertAlmostEqual(play["profit"], round(play["units"] * 100 / 130, 2))
        result = ml.record(NOW + timedelta(hours=6))
        self.assertEqual((result["summary"]["wins"], result["summary"]["losses"]), (1, 0))
        self.assertGreater(result["summary"]["units"], 0)
        self.assertEqual(len(result["summary"]["curve"]), 1)

    def test_the_timer_refreshes_before_the_start_and_settles_after(self):
        self.board([EVENT])
        ml._memory["odds:nfl"]["at"] -= 20 * 60
        for sport in ("mlb", "nhl", "wnba"):
            ml._memory[f"odds:{sport}"] = {"at": ml.time.time(), "events": []}
        with mock.patch.object(ml, "board") as refresh, mock.patch.object(ml, "grade", return_value=0):
            result = ml.tick(NOW + timedelta(hours=1, minutes=30))
        refresh.assert_called_once()
        self.assertEqual(result["refreshed"], ["nfl"])
        # Out of requests: nothing is spent.
        ml._memory["credits"] = {"remaining": 10}
        with mock.patch.object(ml, "board") as refresh, mock.patch.object(ml, "grade", return_value=0):
            ml.tick(NOW + timedelta(hours=1, minutes=30))
        refresh.assert_not_called()


if __name__ == "__main__":
    unittest.main()
