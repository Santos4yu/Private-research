"""PrizePicks export: legs resolve to live projection ids for MLB and WNBA."""
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
        legs = [
            # Only the WNBA1H row has this line.
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "Points", "line": 10.5, "side": "over"},
            # A Goblin line cannot be played Less.
            {"league": "WNBA", "player": "Sabrina Ionescu", "stat": "Points", "line": 20.5, "side": "under"},
        ]
        status, body, _ = self.run_export(legs)
        self.assertEqual(status, 409, body)
        reasons = [item["reason"] for item in body["unmatched"]]
        self.assertEqual(reasons[0], "That exact line is not active on PrizePicks")
        self.assertEqual(reasons[1], "PrizePicks Goblin lines are More-only")

    def test_unsupported_league_is_rejected_before_any_request(self):
        legs = [
            {"league": "NHL", "player": "Connor McDavid", "stat": "Points", "line": 1.5, "side": "over"},
            {"league": "WNBA", "player": "A'ja Wilson", "stat": "Points", "line": 22.5, "side": "over"},
        ]
        status, body, fake = self.run_export(legs)
        self.assertEqual(status, 400)
        self.assertIn("NHL", body["error"])
        self.assertEqual(fake.urls, [])

    def test_mlb_stat_normalization_is_unchanged(self):
        self.assertEqual(export._norm_stat("Pitcher Strikeouts"), "pitcherstrikeouts")
        self.assertEqual(export._norm_stat("Strikeouts"), "hitterstrikeouts")
        self.assertEqual(export._norm_stat("Hits+Runs+RBIs"), "hitsrunsrbis")


if __name__ == "__main__":
    unittest.main()
