"""Synthetic inputs confined to tests of WNBA history calculations."""
from datetime import datetime, timedelta, timezone
import unittest
from unittest.mock import patch

from api.wnba import _attach_history, _game_logs, _window


class WNBAFinderHistoryTests(unittest.TestCase):
    def test_pushes_are_not_decisions_and_empty_history_is_unknown(self):
        result = _window([0, 2, 2, 3], 2)
        self.assertEqual(result, {
            "hits": 1, "misses": 1, "pushes": 2, "sample": 4, "hitRate": 50,
        })
        self.assertIsNone(_window([], 2)["hitRate"])
        self.assertIsNone(_window([2, 2], 2)["hitRate"])

    def test_missing_stats_do_not_become_zero_and_h2h_uses_all_history(self):
        logs = [
            {"opponent": "OTHER" if index > 1 else "OPP",
             "values": {"player_points": None if index == 3 else index}}
            for index in range(16)
        ]
        rows = [{
            "playerId": "test-only", "marketKey": "player_points", "line": 5,
            "teamAbbr": "TEAM", "homeTeamAbbr": "OPP", "awayTeamAbbr": "TEAM",
        }]
        with patch("api.wnba._game_logs", return_value={"rows": logs}):
            row = _attach_history(rows, 2026)[0]
        self.assertEqual(row["average"], 10.5)
        self.assertEqual(row["windows"]["l15"]["sample"], 15)
        self.assertEqual(row["windows"]["h2h"]["sample"], 2)
        self.assertEqual(row["windows"]["h2h"]["hitRate"], 0)

    def test_multiple_markets_share_one_player_history_and_failure_stays_unknown(self):
        rows = [
            {"playerId": "test-only", "marketKey": market, "line": 2.5}
            for market in ("player_points", "player_rebounds")
        ]
        with patch("api.wnba._game_logs", side_effect=RuntimeError("test-only unavailable")) as load:
            results = _attach_history(rows, 2026)
        load.assert_called_once_with("test-only", 2026)
        for row in results:
            self.assertIsNone(row["average"])
            self.assertIsNone(row["diff"])
            self.assertIsNone(row["windows"]["l10"]["hitRate"])

    def test_parser_sorts_deduplicates_and_requires_all_combo_components(self):
        data = {
            "names": ["points", "totalRebounds", "assists", "steals", "blocks", "turnovers"],
            "events": {
                "earlier": {"gameDate": "2026-06-01", "opponent": {"abbreviation": "OPP"}},
                "later": {"gameDate": "2026-06-02", "opponent": {"abbreviation": "OTHER"}},
            },
            "seasonTypes": [{"displayName": "Regular Season", "categories": [{"events": [
                {"eventId": "later", "stats": ["20", "4", "--", "0", "1", "2"]},
                {"eventId": "earlier", "stats": ["0", "4", "5", "0", "1", "2"]},
                {"eventId": "earlier", "stats": ["0", "4", "5", "0", "1", "2"]},
            ]}]}],
        }
        with patch("api.wnba.store.get", return_value=None), \
             patch("api.wnba.store.set"), \
             patch("api.wnba._espn_json", return_value=data):
            rows = _game_logs("test-only", 2026)["rows"]
        self.assertEqual([row["gameId"] for row in rows], ["earlier", "later"])
        self.assertEqual(rows[0]["values"]["player_points"], 0)
        self.assertEqual(rows[0]["values"]["player_points_rebounds_assists"], 9)
        self.assertAlmostEqual(rows[0]["values"]["player_fantasy_points"], 13.3)
        self.assertNotIn("player_points_assists", rows[1]["values"])
        self.assertNotIn("player_fantasy_points", rows[1]["values"])


class QuotePairingTests(unittest.TestCase):
    def test_main_and_alternate_quotes_merge_without_inventing_under(self):
        from api.wnba import _board
        from unittest.mock import Mock
        events = [{"id":"fixture", "commence_time":(datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(), "home_team":"Home", "away_team":"Away"}]
        def market(key, side, price):
            return {"key":key,"outcomes":[{"description":"Fixture player","name":side,"point":7.5,"price":price}]}
        payload = {"bookmakers":[
            {"key":"draftkings","markets":[market("player_points_alternate","Over",-180)]},
            {"key":"prizepicks","markets":[market("player_points","Over",-119),market("player_points_alternate","Under",-119)]},
        ]}
        with patch("api.wnba._cached",return_value=None), patch("api.wnba._roster_directory",return_value={"players":{},"teams":{}}), patch("api.wnba._get",side_effect=[Mock(json=lambda:events),Mock(json=lambda:payload)]), patch("api.wnba.store.set"), \
                patch("prizepicks_export_core._fetch_projection_rows", return_value=[]):
            result = _board(include_history=False)
        self.assertEqual(len(result["rows"]),1)
        row = result["rows"][0]
        self.assertEqual(row["apps"][0]["key"],"prizepicks")
        self.assertEqual(row["apps"][0]["under"],-119)
        self.assertIsNone(row["apps"][1]["under"])

    def test_book_main_lines_are_rows_and_alternates_only_add_prices(self):
        from api.wnba import _board
        from unittest.mock import Mock
        events = [{"id":"fixture", "commence_time":(datetime.now(timezone.utc) + timedelta(hours=12)).isoformat(), "home_team":"Home", "away_team":"Away"}]
        def market(key, point, over, under):
            return {"key":key,"outcomes":[{"description":"Fixture player","name":"Over","point":point,"price":over},
                                          {"description":"Fixture player","name":"Under","point":point,"price":under}]}
        payload = {"bookmakers":[
            # FanDuel's main line is its own row; its alternates at 5.5 and
            # 9.5 are no one's line, so they are not rows.
            {"key":"fanduel","markets":[market("player_points",8.5,-120,-110),market("player_points_alternate",5.5,-300,220),
                                        market("player_points_alternate",9.5,110,-140)]},
            {"key":"espnbet","markets":[market("player_points",8.5,-118,-112)]},
        ]}
        with patch("api.wnba._cached",return_value=None), patch("api.wnba._roster_directory",return_value={"players":{},"teams":{}}), patch("api.wnba._get",side_effect=[Mock(json=lambda:events),Mock(json=lambda:payload)]) as get, patch("api.wnba.store.set"), \
                patch("prizepicks_export_core._fetch_projection_rows", return_value=[]):
            result = _board(include_history=False)
        self.assertEqual([(row["line"], [app["key"] for app in row["apps"]]) for row in result["rows"]],
                         [(8.5, ["fanduel", "espnbet"])])
        # Missing direct feed: spend only on the PrizePicks fallback.
        self.assertEqual(get.call_args.args[1]["bookmakers"], "prizepicks")
        self.assertFalse(get.call_args.kwargs["cache_only"])

if __name__ == "__main__":
    unittest.main()


class WNBAPrizePicksLineTests(unittest.TestCase):
    """PrizePicks' feed adds the lines The Odds API does not carry."""

    def test_merge_adds_missing_lines_and_keeps_book_prices(self):
        from datetime import datetime, timezone
        from api.wnba import _merge_prizepicks

        now = datetime(2026, 7, 1, 12, tzinfo=timezone.utc)
        starts = "2026-07-01T23:00:00Z"
        events = [{"id": "e1", "home_team": "Las Vegas Aces", "away_team": "Seattle Storm", "commence_time": starts}]
        directory = {"players": {"a'ja wilson": [{"id": "w1", "team": "Las Vegas Aces", "teamAbbr": "LV", "position": "F"}]},
                     "teams": {"las vegas aces": {"abbr": "LV", "logo": "lv.png"}}}
        existing = {"player": "A'ja Wilson", "marketKey": "player_points", "line": 24.5, "modifier": "standard",
                    "apps": [{"key": "prizepicks", "modifier": "standard"}, {"key": "draftkings", "over": -115}]}
        base = {"player": "A'ja Wilson", "start_time": starts, "odds_type": "standard"}
        lines = [
            {**base, "id": 1, "stat": "Points", "line": 24.5, "odds_type": "goblin"},
            {**base, "id": 2, "stat": "3-PT Attempted", "line": 1.5},
            {**base, "id": 3, "stat": "FG Made", "line": 9.5},
            {**base, "id": 4, "stat": "Free Throws Made", "line": 5.5},
            {**base, "id": 5, "stat": "Personal Fouls", "line": 2.5},
            # A stat with no history yet still shows, under PrizePicks' name.
            {**base, "id": 8, "stat": "Dunks", "line": 0.5},
            {**base, "id": 6, "stat": "Points", "line": 40.5, "combo": True},
            {**base, "id": 7, "stat": "Rebounds", "line": 9.5, "start_time": "2026-07-01T10:00:00Z"},
        ]
        with patch("prizepicks_export_core._fetch_projection_rows", return_value=lines):
            rows = _merge_prizepicks([existing], events, directory, now)
        self.assertEqual(existing["modifier"], "goblin")
        self.assertEqual(existing["apps"][1], {"key": "draftkings", "over": -115})
        added = {row["marketKey"]: row for row in rows[1:]}
        self.assertEqual(set(added), {"player_threes_attempts", "player_field_goals", "player_frees_made", "player_fouls",
                                      "pp:dunks"})
        threes = added["player_threes_attempts"]
        self.assertEqual((threes["market"], threes["playerId"], threes["eventId"], threes["homeTeamAbbr"]),
                         ("3-PT Attempted", "w1", "e1", "LV"))
        self.assertEqual(added["player_fouls"]["market"], "Personal Fouls")
        self.assertEqual(added["pp:dunks"]["market"], "Dunks")

    def test_a_goblin_only_prizepicks_posts_picks_up_the_books_alternate_price(self):
        from datetime import datetime, timezone
        from api.wnba import _merge_prizepicks

        now = datetime(2026, 7, 1, 12, tzinfo=timezone.utc)
        line = {"player": "A'ja Wilson", "start_time": "2026-07-01T23:00:00Z", "id": 1, "stat": "Points", "line": 17.5,
                "odds_type": "goblin"}
        alternates = {("a'ja wilson", "player_points", 17.5): [
            {"key": "draftkings", "name": "DraftKings", "over": -600, "under": None},
            {"key": "prizepicks", "name": "PrizePicks", "over": -137, "under": None}]}
        with patch("prizepicks_export_core._fetch_projection_rows", return_value=[line]):
            rows = _merge_prizepicks([], [], {"players": {}, "teams": {}}, now, alternates)
        self.assertEqual([(app["key"], app["over"]) for app in rows[0]["apps"]], [("prizepicks", None), ("draftkings", -600)])

    def test_merge_leaves_the_board_alone_when_prizepicks_is_down(self):
        from datetime import datetime, timezone
        from api.wnba import _merge_prizepicks

        rows = [{"player": "A", "marketKey": "player_points", "line": 1.5, "apps": []}]
        with patch("prizepicks_export_core._fetch_projection_rows", side_effect=RuntimeError("down")):
            self.assertEqual(_merge_prizepicks(list(rows), [], {"players": {}, "teams": {}}, datetime.now(timezone.utc)), rows)


class FeedOutageTests(unittest.TestCase):
    def test_failed_direct_feed_fetches_prizepicks_alternates_under_budget(self):
        from api import wnba
        from unittest.mock import Mock
        starts = (datetime.now(timezone.utc) + timedelta(hours=12)).isoformat()
        event = {"id":"fixture", "commence_time":starts, "home_team":"Home", "away_team":"Away"}
        def market(key, point, price):
            return {"key":key,"outcomes":[{"description":"Angel Reese","name":"Over","point":point,"price":price}]}
        payload = {"bookmakers":[{"key":"prizepicks","markets":[market("player_points",15.5,-119),market("player_points_alternate",10.5,-119),market("player_points_alternate",20.5,100)]}]}
        with patch.object(wnba,"_cached",return_value=None), patch.object(wnba,"_roster_directory",return_value={"players":{},"teams":{}}), patch.object(wnba,"_get",side_effect=[Mock(json=lambda:[event],headers={}),Mock(json=lambda:payload)]) as fetch, patch("prizepicks_export_core._fetch_projection_rows",side_effect=RuntimeError("429")), patch("line_moves.observe_books"):
            result=wnba._board(include_history=False)
        self.assertEqual({r["modifier"] for r in result["rows"]},{"standard","goblin","demon"})
        self.assertFalse(fetch.call_args.kwargs["cache_only"])
        self.assertEqual(fetch.call_args.args[1]["bookmakers"],"prizepicks")
        self.assertIn("player_points_alternate",fetch.call_args.args[1]["markets"])
