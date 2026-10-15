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
        self.assertIn("/eng.1/scoreboard?dates=20260929&", get.call_args.args[0])
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

    def test_prizepicks_full_team_names_find_their_match(self):
        aze, lie, bih, tur = (research._team({"id": tid, "abbreviation": abbr, "displayName": name}) for tid, abbr, name in
                              (("1", "AZE", "Azerbaijan"), ("2", "LIE", "Liechtenstein"), ("3", "BIH", "Bosnia-Herzegovina"), ("4", "TUR", "Turkey")))
        fixtures = [{"id": "920", "league": "fifa.worldq.uefa", "leagueName": "WC Qualifying", "date": "2026-10-01T16:00Z",
                     "home": aze, "away": lie, "odds": None},
                    {"id": "921", "league": "uefa.nations", "leagueName": "Nations League", "date": "2026-10-01T18:45Z",
                     "home": bih, "away": tur, "odds": None}]
        found = research.match_fixture("Liechtenstein", "Azerbaijan", "2026-10-01T16:00:00Z", fixtures)
        self.assertEqual((found["eventId"], found["isHome"], found["team"]["abbr"]), ("920", False, "LIE"))
        found = research.match_fixture("Türkiye", "Bosnia and Herzegovina", "2026-10-01T18:45:00Z", fixtures)
        self.assertEqual((found["eventId"], found["team"]["abbr"], found["opponent"]["abbr"]), ("921", "TUR", "BIH"))
        # The board then uses ESPN's codes and a short position.
        line = {"id": "7", "player": "Abdulla Xaybulayev", "team": "Azerbaijan", "description": "Liechtenstein", "stat": "Goals",
                "line": 0.5, "odds_type": "demon", "start_time": "2026-10-01T16:00:00Z", "position": "Midfielder"}
        [row] = soccer_board.build([line], now=1790000000, fixture_list=fixtures)["rows"]
        self.assertEqual((row["team"], row["opponent"], row["teamName"], row["position"], row["eventId"]),
                         ("AZE", "LIE", "Azerbaijan", "M", "920"))

    def test_board_rows_carry_their_match(self):
        fixtures = [research._fixture(scoreboard("900", ARS, CHE, "2026-09-29T14:00Z")["events"][0], "eng.1", "EPL")]
        line = {"id": "1", "player": "Bukayo Saka", "team": "ARS", "description": "CHE", "stat": "Shots", "line": 2.5,
                "odds_type": "standard", "start_time": "2026-09-29T14:00:00Z", "position": "F"}
        [row] = soccer_board.build([line], now=1790000000, fixture_list=fixtures)["rows"]
        self.assertEqual((row["eventId"], row["competition"], row["teamId"], row["opponentId"], row["isHome"]), ("900", "eng.1", "359", "363", True))
        self.assertEqual(row["teamLogo"], ARS["logo"])
        self.assertGreater(row["winChance"], 50)

    def test_full_team_names_match_without_abbreviations(self):
        fixture = research._fixture(scoreboard("900", ARS, CHE, "2026-09-29T14:00Z")["events"][0], "eng.1", "EPL")
        result = research.match_fixture(ARS["displayName"], CHE["displayName"], "2026-09-29T14:00Z", [fixture])
        self.assertEqual(result["team"]["id"], str(ARS["id"]))

    def test_fixture_scan_queries_every_day_separately(self):
        with patch.object(research, "LEAGUES", ("eng.1",)), patch.object(research, "_scoreboard", return_value=[]) as board:
            research.fixtures(1790000000)
        self.assertEqual(board.call_count, research.FIXTURE_DAYS + 1)
        self.assertTrue(all(call.args[1] == call.args[2] for call in board.call_args_list))

    def test_international_fast_path_requires_every_active_fixture(self):
        fixture = research._fixture(scoreboard("900", ARS, CHE, "2026-09-29T14:00Z")["events"][0], "uefa.nations", "Nations")
        line = {"team": "ARS", "description": "CHE", "start_time": "2026-09-29T14:00Z"}
        with patch.object(research, "_scoreboard", return_value=[fixture]), patch.object(research, "fixture_scan", return_value={"fixtures": [fixture], "report": {}}) as full:
            self.assertEqual(soccer_board._fixtures(1790000000, [line])[0], [fixture])
            full.assert_not_called()
            soccer_board._fixtures(1790000000, [{**line, "team": "UNKNOWN", "description": "OTHER"}])
            full.assert_called_once()


class DiagnosticsTests(Offline):
    def test_the_board_says_how_many_lines_found_their_match_and_why_not(self):
        import requests as http
        refused = http.HTTPError("403")
        refused.response = type("Response", (), {"status_code": 403})()
        def scoreboard_for(slug, start, end):
            if slug == "eng.1":
                raise refused
            return []
        line = {"id": "1", "player": "Adam Hlozek", "team": "Czechia", "description": "England", "stat": "Shots", "line": 1.5,
                "odds_type": "goblin", "start_time": "2026-09-29T18:45:00Z", "position": "Attacker"}
        with patch.object(research, "_scoreboard", side_effect=scoreboard_for):
            board = soccer_board.build([line], now=1790000000)
        diagnostics = board["diagnostics"]
        self.assertEqual((diagnostics["fixtures"], diagnostics["lines"], diagnostics["matched"]), (0, 1, 0))
        self.assertEqual(diagnostics["scan"]["errors"], {"HTTP 403": research.FIXTURE_DAYS + 1})
        self.assertEqual(diagnostics["scan"]["requests"], len(research.LEAGUES) * (research.FIXTURE_DAYS + 1))
        self.assertEqual(diagnostics["unmatched"], [{"team": "Czechia", "opponent": "England", "startsAt": "2026-09-29T18:45:00+00:00"}])


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
        self.assertEqual(keys["soccer:teamlog:v2:359:900"], 3 * 3600)


class ClubTests(Offline):
    def test_a_player_away_with_his_country_brings_his_club_matches(self):
        profile = {"athlete": {"id": "2", "team": {"$ref": "http://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1/seasons/2026/teams/359?lang=en"}}}
        self.assertEqual(research._club_from(profile), {"id": "359", "league": "eng.1", "name": ""})
        self.assertEqual(research._club_from({"athlete": {"team": {"id": "359", "displayName": "Arsenal"}, "defaultLeague": {"slug": "eng.1"}}}),
                         {"id": "359", "league": "eng.1", "name": "Arsenal"})
        self.assertIsNone(research._club_from({"athlete": {}}))
        with patch.object(research, "_get", return_value=profile), \
             patch.object(research, "team_log", return_value={"team": {"id": "359"}, "games": [{"id": "1"}]}) as log:
            # England's match: Arsenal's log.
            self.assertEqual(research.club_log("2", "448")["games"], [{"id": "1"}])
            log.assert_called_once_with("359", None, "eng.1")
            # Arsenal's own match: nothing extra.
            self.assertEqual(research.club_log("2", "359"), {"team": None, "games": []})


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
        value["standings"]["groups"][0]["standings"]["entries"][1]["note"] = {"color": "#81D6AC", "description": "Champions League"}
        value["injuries"] = [{"team": CHE, "injuries": [{"athlete": {"id": "51", "displayName": "Cole Palmer", "position": {"abbreviation": "M"}},
                                                          "status": "Day-To-Day", "details": {"type": "Ankle", "fantasyStatus": {"abbreviation": "GTD"}}}]}]
        with patch.object(research, "_get", return_value=value):
            context = research.match("900", "eng.1")
        self.assertEqual(context["standings"][0]["entries"][0]["zone"], "#81D6AC")
        self.assertEqual(context["injuries"]["363"][0], {"id": "51", "name": "Cole Palmer", "headshot": None, "pos": "M", "status": "Day-To-Day",
                                                         "injury": "Ankle", "code": "GTD", "returnDate": None, "comment": None})
        self.assertEqual([team["abbr"] for team in context["teams"]], ["ARS", "CHE"])
        self.assertEqual(context["form"]["359"][0]["result"], "D")
        self.assertEqual(context["h2h"][0]["score"], "2-1")
        self.assertEqual([entry["name"] for entry in context["standings"][0]["entries"]], ["Arsenal", "Chelsea"])
        self.assertEqual(context["lineups"]["359"]["formation"], "4-3-3")
        self.assertEqual(context["odds"]["home"], -150)
        self.assertGreater(context["odds"]["noVig"]["home"], 50)


if __name__ == "__main__":
    unittest.main()


class LeagueTableTest(unittest.TestCase):
    """What every club on the board gives up a match, by position group."""

    def _log(self, team, conceded_shots, keeper_saves, fwd_shots):
        game = {
            "teamStats": {"totalShots": 14, "shotsOnTarget": 5, "possessionPct": 55, "foulsCommitted": 10},
            "oppStats": {"totalShots": conceded_shots, "shotsOnTarget": 4, "possessionPct": 45, "foulsCommitted": 12},
            "goals": 2, "against": 1,
            "players": [{"id": "9", "name": "Star Striker", "pos": "F", "min": 90, "starter": True, "s": {"shots": 5, "sot": 2, "goals": 1}},
                        {"id": "1", "name": "Home Keeper", "pos": "G", "min": 90, "starter": True, "s": {"saves": 3}}],
            "oppPlayers": [{"id": "50", "name": "Their Keeper", "pos": "G", "min": 90, "starter": True, "s": {"saves": keeper_saves, "gc": 2}},
                           {"id": "51", "name": "Their Forward", "pos": "CF-L", "min": 90, "starter": True, "s": {"shots": fwd_shots, "sot": 1}}],
        }
        return {"team": {"id": team, "abbr": f"T{team}", "name": f"Team {team}"}, "games": [game, game]}

    def test_league_table_groups_and_ranks(self):
        logs = {"1": self._log("1", 8, 3, 2), "2": self._log("2", 16, 5, 6)}
        with patch.object(research, "team_log", side_effect=lambda team, event, league: logs[team]):
            table = research.league_table([("1", "e1", "eng.1"), ("2", "e1", "eng.1")], budget=5)
        self.assertTrue(table["complete"])
        self.assertEqual(table["teamCount"], 2)
        one, two = table["teams"]["1"], table["teams"]["2"]
        self.assertEqual(one["abbr"], "T1")
        self.assertEqual(one["allowed"]["shots"], 8)
        self.assertEqual(one["allowedRank"]["shots"], 1)
        self.assertEqual(two["allowedRank"]["shots"], 2)
        # Keepers facing team 1 made 3 saves a match; its forwards' rivals took 2 shots.
        self.assertEqual(one["toGroup"]["GK"]["saves"], 3)
        self.assertEqual(one["toGroup"]["FWD"]["shots"], 2)
        # Every keeper in every match: their own (3 each time) and the ones facing them (3, 3, 5, 5).
        self.assertEqual(table["baseline"]["toGroup"]["GK"]["saves"], 3.5)
        striker = one["players"]["9"]
        self.assertEqual((striker["apps"], striker["starts"]), (2, 2))
        self.assertAlmostEqual(striker["shotShare"], 5 / 14 * 100, places=1)

    def test_position_groups(self):
        self.assertEqual([research.position_group(p) for p in ("G", "CD-L", "DM", "AM-R", "F", "LWB", "SUB")],
                         ["GK", "DEF", "MID", "MID", "FWD", "DEF", None])
