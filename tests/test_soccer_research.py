"""Soccer research: ESPN fixtures, match records, team logs, match context."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import soccer_board  # noqa: E402
import soccer_research as research  # noqa: E402
from tests.soccer_samples import (ARS, CHE, LIV, TOT, arsenal_roster, dated, opponent_roster,  # noqa: E402
                                  scoreboard, summary)


class Offline(unittest.TestCase):
    def setUp(self):
        research._memory.clear()
        patcher = patch.object(research.store, "get", return_value=None)
        patcher.start()
        self.addCleanup(patcher.stop)
        patcher = patch.object(research.store, "set", return_value=True)
        self.saved = patcher.start()
        self.addCleanup(patcher.stop)


class FixtureTests(Offline):
    def test_scoreboard_fixtures_carry_teams_and_no_vig_chances(self):
        from datetime import datetime, timezone
        day = datetime(2026, 9, 29, tzinfo=timezone.utc)
        with patch.object(research, "_get", return_value=scoreboard("900", ARS, CHE, "2026-09-29T14:00Z")) as get:
            [fixture] = research._scoreboard("eng.1", day, day)
        self.assertIn("/eng.1/scoreboard?dates=20260929-20260929", get.call_args.args[0])
        self.assertEqual((fixture["leagueName"], fixture["venue"]), ("English Premier League", "Emirates Stadium"))
        self.assertEqual((fixture["home"]["abbr"], fixture["away"]["abbr"]), ("ARS", "CHE"))
        chances = fixture["odds"]["noVig"]
        self.assertAlmostEqual(sum(chances.values()), 100, delta=0.2)
        self.assertGreater(chances["home"], chances["away"])

    def test_lines_are_pinned_to_their_match_by_team_and_kickoff(self):
        fixtures = [research._fixture(scoreboard("900", ARS, CHE, "2026-09-29T14:00Z")["events"][0], "eng.1", "EPL"),
                    research._fixture(scoreboard("901", LIV, TOT, "2026-09-29T14:00Z")["events"][0], "eng.1", "EPL")]
        chelsea = research.match_fixture("CHE", "ARS", "2026-09-29T14:00:00Z", fixtures)
        self.assertEqual((chelsea["eventId"], chelsea["isHome"], chelsea["team"]["abbr"], chelsea["opponent"]["abbr"]), ("900", False, "CHE", "ARS"))
        # PrizePicks' abbreviation differs from ESPN's: the opponent and the
        # exact kickoff still find it.
        spurs = research.match_fixture("TOT", "LFC", "2026-09-29T14:00:00Z", fixtures, team_name="Tottenham Hotspur")
        self.assertEqual((spurs["eventId"], spurs["isHome"]), ("901", False))
        # A day off: no match.
        self.assertIsNone(research.match_fixture("CHE", "ARS", "2026-09-30T14:00:00Z", fixtures))

    def test_board_rows_carry_their_match(self):
        fixtures = [research._fixture(scoreboard("900", ARS, CHE, "2026-09-29T14:00Z")["events"][0], "eng.1", "EPL")]
        line = {"id": "1", "player": "Bukayo Saka", "team": "ARS", "description": "CHE", "stat": "Shots", "line": 2.5,
                "odds_type": "standard", "start_time": "2026-09-29T14:00:00Z", "position": "F"}
        [row] = soccer_board.build([line], now=1790000000, fixture_list=fixtures)["rows"]
        self.assertEqual((row["eventId"], row["competition"], row["teamId"], row["opponentId"], row["isHome"]), ("900", "eng.1", "359", "363", True))
        self.assertEqual(row["teamLogo"], ARS["logo"])
        self.assertGreater(row["winChance"], 50)


class RecordTests(Offline):
    def test_a_match_becomes_team_stats_and_the_lines_of_who_played(self):
        value = research.record(summary("700", dated(7), ARS, CHE, 2, 1, arsenal_roster(4, 2, goals=1), opponent_roster(5)), "eng.1")
        self.assertTrue(value["completed"])
        self.assertEqual(value["stats"]["359"]["possessionPct"], 58.2)
        players = {player["name"]: player for player in value["players"]["359"]}
        # The unused substitute never played, so he is not in the match.
        self.assertNotIn("Unused Sub", players)
        saka, trossard, raya = players["Bukayo Saka"], players["Leandro Trossard"], players["David Raya"]
        self.assertEqual((saka["s"]["shots"], saka["s"]["sot"], saka["s"]["goals"], saka["s"]["fd"]), (4, 2, 1, 3))
        self.assertEqual((saka["min"], trossard["min"], raya["min"]), (78, 12, 90))
        self.assertEqual((raya["s"]["saves"], raya["s"]["gc"], raya["s"]["sotf"]), (3, 1, 4))
        self.assertNotIn("appearances", saka["s"])


class TeamLogTests(Offline):
    def test_a_teams_log_walks_back_through_each_matchs_form(self):
        upcoming = summary("900", dated(-1), ARS, CHE, 0, 0, [], [], completed=False,
                           form=[{"team": ARS, "events": [{"id": "703", "gameDate": dated(3)}, {"id": "702", "gameDate": dated(10)}]}])
        past = {
            "703": summary("703", dated(3), ARS, LIV, 1, 1, arsenal_roster(3, 1), opponent_roster(4)),
            "702": summary("702", dated(10), TOT, ARS, 0, 2, opponent_roster(6), arsenal_roster(5, 3, goals=2),
                           form=[{"team": ARS, "events": [{"id": "701", "gameDate": dated(17)}]}]),
            "701": summary("701", dated(17), ARS, CHE, 3, 0, arsenal_roster(1, 0, saka_starts=False), opponent_roster(2)),
        }

        def fake_get(url, timeout=10):
            if "/schedule" in url:
                raise RuntimeError("no schedule")
            event = url.rsplit("event=", 1)[1]
            return upcoming if event == "900" else past[event]

        with patch.object(research, "_get", side_effect=fake_get):
            log = research.team_log("359", "900", "eng.1")
        games = log["games"]
        self.assertEqual([game["id"] for game in games], ["701", "702", "703"])
        self.assertEqual(log["team"]["abbr"], "ARS")
        spurs = games[1]
        self.assertEqual((spurs["isHome"], spurs["opponent"]["abbr"], spurs["result"], spurs["score"]), (False, "TOT", "W", "2-0"))
        self.assertEqual(spurs["teamStats"]["possessionPct"], 41.8)
        self.assertEqual(spurs["oppStats"]["possessionPct"], 58.2)
        self.assertEqual({player["name"] for player in spurs["oppPlayers"]}, {"Robert Sanchez", "Cole Palmer"})
        saka = [next(player for player in game["players"] if player["name"] == "Bukayo Saka") for game in games]
        self.assertEqual([player["s"]["shots"] for player in saka], [1, 5, 3])
        self.assertEqual(saka[0]["min"], 30)
        # Finished matches are kept for weeks; the log for a few hours.
        keys = {call.args[0]: call.kwargs.get("ex") for call in self.saved.call_args_list}
        self.assertEqual(keys["soccer:event:v1:701"], 45 * 86400)
        self.assertEqual(keys["soccer:teamlog:v1:359:900"], 3 * 3600)


class MatchTests(Offline):
    def test_match_context_reads_form_h2h_standings_lineups_and_odds(self):
        value = summary("900", dated(-1), ARS, CHE, 0, 0, arsenal_roster(0, 0), opponent_roster(0), completed=False,
                        form=[{"team": ARS, "events": [{"id": "703", "gameDate": dated(3), "atVs": "vs", "gameResult": "D", "score": "1-1",
                                                        "opponent": {"abbreviation": "LIV", "displayName": "Liverpool"}}]}])
        value["headToHeadGames"] = [{"team": ARS, "events": [{"id": "600", "gameDate": dated(200), "atVs": "@", "gameResult": "W", "score": "2-1",
                                                               "opponent": {"abbreviation": "CHE", "displayName": "Chelsea"}}]}]
        value["standings"] = {"groups": [{"header": "Premier League", "standings": {"entries": [
            {"team": "Chelsea", "id": "363", "logo": [{"href": "c.png"}], "stats": [{"name": "rank", "value": 2}, {"name": "points", "value": 13},
                                                                                     {"name": "gamesPlayed", "value": 6}, {"name": "wins", "value": 4}]},
            {"team": "Arsenal", "id": "359", "logo": [{"href": "a.png"}], "stats": [{"name": "rank", "value": 1}, {"name": "points", "value": 15}]}]}}]}
        value["pickcenter"] = [{"provider": {"name": "DraftKings"}, "moneyline": {"home": {"close": {"odds": "-150"}}, "away": {"close": {"odds": "+400"}},
                                                                                   "draw": {"close": {"odds": "+280"}}}}]
        with patch.object(research, "_get", return_value=value):
            context = research.match("900", "eng.1")
        self.assertEqual([team["abbr"] for team in context["teams"]], ["ARS", "CHE"])
        self.assertEqual(context["form"]["359"][0]["result"], "D")
        self.assertEqual(context["h2h"][0]["score"], "2-1")
        self.assertEqual([entry["name"] for entry in context["standings"][0]["entries"]], ["Arsenal", "Chelsea"])
        self.assertEqual(context["lineups"]["359"]["formation"], "4-3-3")
        self.assertEqual(context["odds"]["home"], -150)
        self.assertGreater(context["odds"]["noVig"]["home"], 50)


if __name__ == "__main__":
    unittest.main()
