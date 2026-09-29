"""PrizePicks export: legs resolve to live projection ids for MLB, NFL and WNBA."""
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import prizepicks_export_core as export  # noqa: E402


def projection(pid, league_id, player_id, stat, line, odds_type="standard", wagers="over,under"):
    return {
        "id": pid, "type": "projection",
        "attributes": {
            "status": "pre_game", "is_live": False, "stat_type": stat, "line_score": line,
            "odds_type": odds_type, "allowed_wager_types": wagers,
            "updated_at": "2026-09-28T12:00:00Z", "start_time": "2026-09-28T19:00:00-04:00",
        },
        "relationships": {
            "league": {"data": {"id": league_id, "type": "league"}},
            "new_player": {"data": {"id": player_id, "type": "new_player"}},
        },
    }


def player(pid, name, league):
    return {"id": pid, "type": "new_player", "attributes": {"display_name": name, "league": league, "team": "LVA"}}


MLB_FEED = {
    "data": [projection("9001", "2", "p1", "Total Bases", 1.5)],
    "included": [player("p1", "Aaron Judge", "MLB")],
}
WNBA_FEED = {
    "data": [
        projection("7001", "3", "w1", "Pts+Rebs+Asts", 38.5),
        projection("7002", "3", "w2", "3-PT Made", 2.5),
        projection("7003", "3", "w2", "Points", 20.5, odds_type="goblin", wagers="over"),
        # A first-half market from another league id, same player: never matched.
        projection("7004", "31", "w3", "Points", 10.5),
    ],
    "included": [
        player("w1", "A'ja Wilson", "WNBA"), player("w2", "Sabrina Ionescu", "WNBA"),
        player("w3", "Sabrina Ionescu", "WNBA1H"),
    ],
}
LEAGUES_FEED = {"data": [
    {"id": "2", "type": "league", "attributes": {"name": "MLB"}},
    {"id": "3", "type": "league", "attributes": {"name": "WNBA"}},
    {"id": "31", "type": "league", "attributes": {"name": "WNBA1H"}},
]}


def response(payload, status=200):
    mock = Mock()
    mock.json.return_value = payload
    mock.raise_for_status.side_effect = None if status < 400 else export.requests.HTTPError(str(status))
    return mock


class FakePrizePicks:
    def __init__(self, leagues=LEAGUES_FEED, feeds=None):
        self.leagues = leagues
        self.feeds = feeds or {"2": MLB_FEED, "3": WNBA_FEED}
        self.urls = []

    def __call__(self, url, **_kwargs):
        self.urls.append(url)
        if url == export.PRIZEPICKS_LEAGUES_URL:
            if isinstance(self.leagues, Exception):
                raise self.leagues
            return response(self.leagues)
        league_id = parse_qs(urlparse(url).query)["league_id"][0]
        return response(self.feeds.get(league_id, {"data": [], "included": []}))


class PrizePicksExportTests(unittest.TestCase):
    def setUp(self):
        export._PROJECTION_CACHE.clear()
        export._LEAGUE_CACHE.clear()

    def run_export(self, legs, fake=None):
        fake = fake or FakePrizePicks()
        with patch.object(export.requests, "get", side_effect=fake):
            status, body = export.build_export(legs)
        return status, body, fake

    def test_mlb_legs_without_a_league_keep_working(self):
        legs = [
            {"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "over"},
            {"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "under"},
        ]
        fake = FakePrizePicks(feeds={"2": {"data": MLB_FEED["data"] + [
            projection("9002", "2", "p1", "Total Bases", 1.5)], "included": MLB_FEED["included"]}})
        status, body, fake = self.run_export(legs, fake)
        self.assertEqual(status, 200, body)
        self.assertEqual(body["url"], export.PRIZEPICKS_APP_URL + "9001-o-1.5,9002-u-1.5")
        # MLB never needs the leagues lookup.
        self.assertNotIn(export.PRIZEPICKS_LEAGUES_URL, fake.urls)
        self.assertTrue(all("league_id=2" in url for url in fake.urls))

    def test_wnba_legs_match_prizepicks_stat_names_and_sides(self):
        legs = [
            {"league": "WNBA", "player": "A'ja Wilson", "stat": "Points + Rebounds + Assists", "line": 38.5, "side": "under"},
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "3-Pointers Made", "line": 2.5, "side": "over"},
        ]
        status, body, fake = self.run_export(legs)
        self.assertEqual(status, 200, body)
        self.assertEqual(body["url"], export.PRIZEPICKS_APP_URL + "7001-u-38.5,7002-o-2.5")
        self.assertEqual([match["league"] for match in body["matches"]], ["WNBA", "WNBA"])
        self.assertEqual(body["matches"][0]["side"], "Less")
        self.assertTrue(any("league_id=3" in url for url in fake.urls))

    def test_mixed_lineup_fetches_each_league_once(self):
        legs = [
            {"sport": "MLB", "player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "over"},
            {"sport": "wnba", "player": "Aja Wilson", "stat": "Points + Rebounds + Assists", "line": 38.5, "side": "over"},
        ]
        status, body, fake = self.run_export(legs)
        self.assertEqual(status, 200, body)
        self.assertEqual(body["url"], export.PRIZEPICKS_APP_URL + "9001-o-1.5,7001-o-38.5")
        projection_urls = [url for url in fake.urls if url != export.PRIZEPICKS_LEAGUES_URL]
        self.assertEqual(len(projection_urls), 2)

    def test_wnba_league_id_comes_from_the_leagues_feed(self):
        moved = {"data": [{"id": "44", "type": "league", "attributes": {"name": "WNBA"}}]}
        feed = {"data": [projection("5001", "44", "w1", "Rebounds", 9.5),
                         projection("5002", "44", "w2", "Assists", 6.5)],
                "included": WNBA_FEED["included"]}
        legs = [
            {"league": "WNBA", "player": "A'ja Wilson", "stat": "Rebounds", "line": 9.5, "side": "over"},
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "Assists", "line": 6.5, "side": "over"},
        ]
        status, body, fake = self.run_export(legs, FakePrizePicks(leagues=moved, feeds={"44": feed}))
        self.assertEqual(status, 200, body)
        self.assertTrue(any("league_id=44" in url for url in fake.urls))

    def test_leagues_feed_failure_falls_back_to_the_known_id(self):
        legs = [
            {"league": "WNBA", "player": "A'ja Wilson", "stat": "Pts+Rebs+Asts", "line": 38.5, "side": "over"},
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "3-PT Made", "line": 2.5, "side": "over"},
        ]
        fake = FakePrizePicks(leagues=export.requests.ConnectionError("down"))
        status, body, fake = self.run_export(legs, fake)
        self.assertEqual(status, 200, body)
        self.assertTrue(any("league_id=3" in url for url in fake.urls))

    def test_other_leagues_rows_and_more_only_tiers_are_not_matched(self):
        # A Goblin line cannot be played Less, and the WNBA1H row is another
        # league's line: nothing is left to export.
        legs = [
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "Points", "line": 20.5, "side": "under"},
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "Rebounds", "line": 4.5, "side": "over"},
        ]
        status, body, _ = self.run_export(legs)
        self.assertEqual(status, 409, body)
        reasons = [item["reason"] for item in body["unmatched"]]
        self.assertEqual(reasons, ["PrizePicks only offers More on this pick", "No longer on PrizePicks"])

    def test_a_moved_line_exports_on_prizepicks_current_line(self):
        feed = {"data": [projection("8001", "2", "k1", "Pitcher Strikeouts", 6.5),
                         projection("8002", "2", "k1", "Pitcher Strikeouts", 3.5, odds_type="goblin", wagers="over"),
                         projection("8003", "2", "k1", "Pitcher Strikeouts", 8.5, odds_type="demon", wagers="over"),
                         projection("9001", "2", "p1", "Total Bases", 1.5)],
                "included": [player("k1", "Michael King", "MLB"), player("p1", "Aaron Judge", "MLB")]}
        legs = [
            # Saved as a 2.5 Goblin; PrizePicks' Goblin is now 3.5.
            {"player": "Michael King", "stat": "Pitcher Strikeouts", "line": 2.5, "side": "over", "modifier": "goblin"},
            {"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "over"},
        ]
        status, body, _ = self.run_export(legs, FakePrizePicks(feeds={"2": feed}))
        self.assertEqual(status, 200, body)
        self.assertEqual(body["url"], export.PRIZEPICKS_APP_URL + "8002-o-3.5,9001-o-1.5")
        king = body["matches"][0]
        self.assertEqual((king["leg"], king["line"], king["oddsType"], king["changed"], king["previousLine"]),
                         (0, 3.5, "goblin", True, 2.5))
        self.assertEqual([match["leg"] for match in body["changed"]], [0])
        self.assertFalse(body["matches"][1]["changed"])
        # A Less pick moves to the standard line, the only one playable Less.
        legs[0].update(side="under")
        status, body, _ = self.run_export(legs, FakePrizePicks(feeds={"2": feed}))
        self.assertEqual(body["matches"][0]["projectionToken"], "8001-u-6.5")

    def test_a_removed_pick_is_left_out_and_the_rest_still_exports(self):
        legs = [
            {"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "over"},
            {"player": "Juan Soto", "stat": "Hits", "line": 0.5, "side": "over"},
        ]
        status, body, _ = self.run_export(legs)
        self.assertEqual(status, 200, body)
        self.assertEqual(body["url"], export.PRIZEPICKS_APP_URL + "9001-o-1.5")
        self.assertEqual([(leg["leg"], leg["player"], leg["reason"]) for leg in body["skipped"]],
                         [(1, "Juan Soto", "No longer on PrizePicks")])

    def test_the_saved_tier_is_kept_when_two_tiers_share_a_line(self):
        feed = {"data": [projection("6001", "2", "p1", "Hits+Runs+RBIs", 0.5),
                         projection("6002", "2", "p1", "Hits+Runs+RBIs", 0.5, odds_type="goblin", wagers="over"),
                         projection("9001", "2", "p2", "Total Bases", 1.5)],
                "included": [player("p1", "Fernando Tatis Jr.", "MLB"), player("p2", "Aaron Judge", "MLB")]}
        legs = [{"player": "Fernando Tatis Jr.", "stat": "Hits+Runs+RBIs", "line": 0.5, "side": "over", "modifier": "goblin"},
                {"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "over"}]
        status, body, _ = self.run_export(legs, FakePrizePicks(feeds={"2": feed}))
        self.assertEqual(status, 200, body)
        self.assertEqual(body["matches"][0]["projectionId"], "6002")

    def test_a_brief_outage_uses_the_last_good_feed(self):
        legs = [{"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "over"},
                {"player": "Aaron Judge", "stat": "Total Bases", "line": 1.5, "side": "under"}]
        feed = {"2": {"data": MLB_FEED["data"] + [projection("9002", "2", "p1", "Total Bases", 1.5)],
                      "included": MLB_FEED["included"]}}
        self.assertEqual(self.run_export(legs, FakePrizePicks(feeds=feed))[0], 200)
        # Past the 2-minute cache, PrizePicks times out: the feed from a
        # few minutes ago still exports.
        export._PROJECTION_CACHE["MLB"]["loaded_at"] -= 300
        with patch.object(export.requests, "get", side_effect=export.requests.Timeout("slow")):
            status, body = export.build_export(legs)
        self.assertEqual(status, 200, body)
        # Too old to trust: the outage is reported.
        export._PROJECTION_CACHE["MLB"]["loaded_at"] -= 3600
        with patch.object(export.requests, "get", side_effect=export.requests.Timeout("slow")):
            status, body = export.build_export(legs)
        self.assertEqual(status, 502, body)

    def test_unsupported_league_is_rejected_before_any_request(self):
        legs = [
            {"league": "NBA", "player": "Shai Gilgeous-Alexander", "stat": "Points", "line": 30.5, "side": "over"},
            {"league": "WNBA", "player": "A'ja Wilson", "stat": "Points", "line": 22.5, "side": "over"},
        ]
        status, body, fake = self.run_export(legs)
        self.assertEqual(status, 400)
        self.assertIn("NBA", body["error"])
        self.assertEqual(fake.urls, [])

    def test_every_page_of_the_feed_is_read(self):
        first = {"data": [projection("9001", "2", "p1", "Total Bases", 1.5)], "included": [player("p1", "Aaron Judge", "MLB")],
                 "links": {"next": "/projections?single_stat=true&league_id=2&page=2"}}
        second = {"data": [projection("9002", "2", "p2", "Hits", 0.5)], "included": [player("p2", "Juan Soto", "MLB")],
                  "links": {"next": None}}
        urls = []

        def get(url, **_kwargs):
            urls.append(url)
            return response(second if "page=2" in url else first)
        with patch.object(export.requests, "get", side_effect=get):
            rows = export._fetch_projection_rows(force=True)
        self.assertEqual([row["player"] for row in rows], ["Aaron Judge", "Juan Soto"])
        self.assertEqual(urls[1], "https://partner-api.prizepicks.com/projections?single_stat=true&league_id=2&page=2")
        # A next link to another site is never followed.
        first["links"]["next"] = "https://elsewhere.example/projections?page=2"
        urls.clear()
        with patch.object(export.requests, "get", side_effect=get):
            rows = export._fetch_projection_rows(force=True)
        self.assertEqual(len(urls), 1)

    def test_a_line_that_names_no_sides_is_kept(self):
        standard = projection("9001", "2", "p1", "Total Bases", 1.5)
        goblin = projection("9002", "2", "p1", "Total Bases", 0.5, odds_type="goblin")
        under_only = projection("9003", "2", "p1", "Hits", 0.5, wagers="under")
        for item in (standard, goblin):
            del item["attributes"]["allowed_wager_types"]
        feed = {"data": [standard, goblin, under_only], "included": [player("p1", "Aaron Judge", "MLB")]}
        with patch.object(export.requests, "get", return_value=response(feed)):
            rows = export._fetch_projection_rows(force=True)
        self.assertEqual([(row["id"], row["allowed_wager_types"]) for row in rows],
                         [("9001", "over,under"), ("9002", "over")])

    def test_mlb_stat_normalization_is_unchanged(self):
        self.assertEqual(export._norm_stat("Pitcher Strikeouts"), "pitcherstrikeouts")
        self.assertEqual(export._norm_stat("Strikeouts"), "hitterstrikeouts")
        self.assertEqual(export._norm_stat("Hits+Runs+RBIs"), "hitsrunsrbis")


if __name__ == "__main__":
    unittest.main()


class ExportRouteTests(unittest.TestCase):
    """Which site switch closes the export (api/prediction.py do_POST)."""

    def post(self, path, **patches):
        import io
        import json
        from api import prediction
        body = json.dumps({"legs": []}).encode()
        handler = prediction.handler.__new__(prediction.handler)
        handler.path, handler.headers = path, {"Content-Length": str(len(body)), "Content-Type": "application/json"}
        handler.rfile = io.BytesIO(body)
        sent = {}
        with patch("site_controls.allowed", side_effect=lambda _headers, tab=None, sport=None: tab != "builder") as gate, \
                patch.object(prediction, "session_with_live_access", return_value=True), \
                patch.object(prediction.handler, "_send", lambda _self, status, payload: sent.update(status=status, body=payload)):
            handler.do_POST()
        return sent, gate

    def test_pick_builder_export_does_not_follow_the_parlay_switch(self):
        # Parlay (tab "builder") is switched off in this test.
        sent, gate = self.post("/api/prediction?action=prizepicks-export")
        self.assertEqual(gate.call_args.args[1], None)
        # Past the gate: the empty lineup is what gets rejected.
        self.assertEqual(sent["status"], 400)
        sent, gate = self.post("/api/prediction?action=prizepicks-export&from=parlay")
        self.assertEqual(gate.call_args.args[1], "builder")
        self.assertEqual((sent["status"], sent["body"].get("featureDisabled")), (503, True))
