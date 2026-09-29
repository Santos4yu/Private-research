"""The Finder's NFL lines: PrizePicks' stat names, the kicker / defense /
play-by-play values each market settles on, and the board built from them."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.sports.nfl import finder, markets, prizepicks_board  # noqa: E402


class MarketNameTests(unittest.TestCase):
    def test_prizepicks_names_map_to_markets(self):
        cases = {
            "Pass Yards": "passing_yards", "Pass Attempts": "passing_attempts", "Pass Completions": "pass_completions",
            "Longest Completion": "longest_completion", "Rush Yards in First 5 Attempts": "rush_yards_first_5",
            "Longest Rush": "longest_rush", "Receiving Yards in First 2 Receptions": "rec_yards_first_2",
            "Longest Reception": "longest_reception", "Rush+Rec TDs": "touchdowns", "Targets": "targets",
            "FG Made": "fg_made", "Kicking Points": "kicking_points", "Longest FG Made": "longest_fg",
            "Shortest FG Made": "shortest_fg", "PAT Attempts": "pat_attempts", "Punts Inside 20": "punts_inside_20",
            "Gross Punt Yards": "gross_punt_yards", "50+ Yard Punts": "punts_50_plus", "Tackles+Ast": "tackles",
            "Tackles for Loss": "tackles_for_loss", "Punts": "punts", "Sacks Taken": "sacks_taken", "Rush TDs": "rushing_tds",
            "Rec TDs": "receiving_tds", "Fumbles Lost": "fumbles_lost", "PAT Made": "pat_made", "Solo Tackles": "solo_tackles",
            "Anytime TDs": "touchdowns", "Pass+Rush+Rec TDs": "pass_rush_rec_tds", "Completion Percentage": "completion_pct",
            "Rush Yards Per Carry": "yards_per_carry", "Yards on First Rush Attempt": "first_rush_yards",
            "Quarters with 1+ Reception": "quarters_1_rec", "Quarters with 5+ Receiving Yards": "quarters_5_rec_yds",
            "Quarters with 5+ Rush Yards": "quarters_5_rush_yds", "Quarters with 25+ Pass Yards": "quarters_25_pass_yds",
            "Halves with 25+ Receiving Yards": "halves_25_rec_yds", "Halves with 25+ Rush Yards": "halves_25_rush_yds",
        }
        for stat, market in cases.items():
            self.assertEqual(markets.market_for(stat, "WR"), market, stat)
        self.assertTrue(set(cases.values()) <= set(markets.LABELS))

    def test_position_decides_the_ambiguous_names(self):
        self.assertEqual(markets.market_for("INT", "QB"), "interceptions")
        self.assertEqual(markets.market_for("INT", "CB"), "def_interceptions")
        self.assertEqual(markets.market_for("Fantasy Score", "K"), "kicker_fantasy")
        self.assertEqual(markets.market_for("Fantasy Score", "RB"), "fantasy_score")
        self.assertEqual(markets.market_for("Sacks", "LB"), "sacks")
        self.assertEqual(markets.market_for("Sacks", "QB"), "sacks_taken")
        self.assertIsNone(markets.market_for("Pass Air Yards", "QB"))


class WeeklyValueTests(unittest.TestCase):
    def test_kicker_values_from_the_made_list(self):
        row = {"position": "K", "fg_made": "3", "fg_att": "4", "pat_made": "2", "pat_att": "3",
               "fg_made_list": "25;43;52", "fg_made_20_29": "1", "fg_made_40_49": "1", "fg_made_50_59": "1"}
        values = finder._kicking(row)
        self.assertEqual((values["fg_made"], values["fg_attempts"], values["pat_attempts"]), (3, 4, 3))
        self.assertEqual((values["fg_yards"], values["longest_fg"], values["shortest_fg"]), (120, 52, 25))
        self.assertEqual(values["kicking_points"], 3 * 3 + 2)
        # 3 + 4 + 5 for the field goals, 1 per extra point.
        self.assertEqual(values["kicker_fantasy"], 12 + 2)

    def test_kicker_without_a_made_field_goal_has_no_shortest(self):
        values = finder._kicking({"position": "K", "fg_made": "0", "fg_att": "1", "pat_made": "4", "pat_att": "4"})
        self.assertEqual((values["fg_made"], values["longest_fg"], values["kicker_fantasy"]), (0, 0, 4))
        self.assertIsNone(values["shortest_fg"])
        # A receiver's row carries no kicking values at all.
        self.assertEqual(finder._kicking({"position": "WR", "fg_att": "", "pat_att": ""}), {})

    def test_total_tackles_count_every_assisted_tackle(self):
        values = finder._defense({"def_tackles_solo": "5", "def_tackles_with_assist": "1", "def_tackle_assists": "3",
                                  "def_sacks": "1.5", "def_tackles_for_loss": "2", "def_interceptions": "1"})
        self.assertEqual(values, {"tackles": 9, "solo_tackles": 5, "sacks": 1.5, "tackles_for_loss": 2, "def_interceptions": 1})
        self.assertEqual(finder._defense({}), {})
        self.assertEqual(finder._value({"def_tackles_solo": "2", "def_tackle_assists": "1"}, "tackles"), 3)


class PlayByPlayTests(unittest.TestCase):
    def play(self, **values):
        base = {"game_id": "g1", "season_type": "REG", "posteam": "PIT", "defteam": "CLE", "yardline_100": "50",
                "pass_attempt": "0", "sack": "0", "complete_pass": "0", "rush_attempt": "0", "two_point_attempt": "0",
                "punt_attempt": "0"}
        return base | {key: str(value) for key, value in values.items()}

    def test_first_rushes_first_catches_and_longest_completion(self):
        rushes = [self.play(rush_attempt=1, rusher_player_id="r1", rushing_yards=yards) for yards in (4, -2, 11, 3, 6, 40)]
        catches = [self.play(pass_attempt=1, complete_pass=1, receiver_player_id="w1", passer_player_id="q1",
                             receiving_yards=yards, passing_yards=yards) for yards in (9, 15, 30)]
        result = finder._aggregate_pbp(rushes + catches)
        rusher, receiver, passer = (result["players"][pid]["g1"] for pid in ("r1", "w1", "q1"))
        # Only the first five carries; the 40-yarder was the sixth.
        self.assertEqual((rusher["rushFirst5"], rusher["longestRush"]), (22, 40))
        self.assertEqual((receiver["recFirst2"], receiver["longestReception"]), (24, 30))
        self.assertEqual(passer["longestCompletion"], 30)

    def test_quarters_halves_and_first_rush(self):
        plays = [self.play(qtr=1, rush_attempt=1, rusher_player_id="r1", rushing_yards=3),
                 self.play(qtr=1, rush_attempt=1, rusher_player_id="r1", rushing_yards=9),
                 self.play(qtr=2, pass_attempt=1, complete_pass=1, receiver_player_id="w1", passer_player_id="q1", receiving_yards=12, passing_yards=12),
                 self.play(qtr=2, pass_attempt=1, complete_pass=1, receiver_player_id="w1", passer_player_id="q1", receiving_yards=15, passing_yards=15),
                 self.play(qtr=3, rush_attempt=1, rusher_player_id="r1", rushing_yards=4),
                 self.play(qtr=4, pass_attempt=1, complete_pass=1, receiver_player_id="w1", passer_player_id="q1", receiving_yards=3, passing_yards=3),
                 # Overtime counts toward the second half, never as a quarter.
                 self.play(qtr=5, rush_attempt=1, rusher_player_id="r1", rushing_yards=22)]
        players = finder._aggregate_pbp(plays)["players"]
        rusher, receiver, passer = players["r1"]["g1"], players["w1"]["g1"], players["q1"]["g1"]
        self.assertEqual(rusher["firstRush"], 3)
        self.assertEqual((rusher["quartersRushYds5"], rusher["halvesRushYds25"]), (1, 1))
        self.assertEqual((receiver["quartersRec1"], receiver["quartersRecYds5"], receiver["halvesRecYds25"]), (2, 1, 1))
        self.assertEqual(passer["quartersPassYds25"], 1)
        self.assertNotIn("byQuarter", rusher)

    def test_ratios_only_when_he_threw_or_ran(self):
        values = finder.market_values({"completions": "18", "attempts": "30", "rushing_yards": "45", "carries": "10",
                                       "passing_tds": "2", "rushing_tds": "1", "receiving_tds": "0"})
        self.assertEqual((values["completion_pct"], values["yards_per_carry"], values["pass_rush_rec_tds"]), (60.0, 4.5, 3))
        self.assertIsNone(finder.market_values({"attempts": "0", "carries": "0"})["completion_pct"])

    def test_punts(self):
        punts = [self.play(punt_attempt=1, punter_player_id="p1", kick_distance=distance, punt_inside_twenty=inside)
                 for distance, inside in ((52, 0), (38, 1), (47, 1))]
        punter = finder._aggregate_pbp(punts)["players"]["p1"]["g1"]
        self.assertEqual((punter["punts"], punter["puntYards"], punter["puntsIn20"], punter["punts50"]), (3, 137, 2, 1))

    def test_a_covered_game_without_the_play_settles_at_zero(self):
        log = {"rows": [{"dnp": False, "season": 2026, "gameId": "g1", "team": "PIT"},
                        {"dnp": False, "season": 2026, "gameId": "g2", "team": "PIT"},
                        {"dnp": True, "season": 2026, "gameId": "g3", "team": "PIT"}]}
        extras = {"players": {"w1": {"g1": {"longestReception": 22, "recFirst2": 30}}},
                  "teams": {"PIT": {"g1": {}, "g2": {}}}}
        with patch.object(finder, "pbp_extras", return_value=extras):
            values = finder.pbp_values(2026, "w1", log)
        self.assertEqual(set(values), {"g1", "g2"})
        self.assertEqual((values["g1"]["longest_reception"], values["g1"]["rec_yards_first_2"]), (22, 30))
        self.assertEqual((values["g2"]["longest_reception"], values["g2"]["punts_inside_20"]), (0, 0))


class BoardTests(unittest.TestCase):
    def test_weekly_markets_settle_on_their_columns(self):
        row = {"position": "QB", "sacks_suffered": "3", "rushing_tds": "1", "receiving_tds": "0", "fumbles_lost_total": "1",
               "def_tackles_solo": "4", "def_tackles_with_assist": "1", "def_tackle_assists": "2"}
        values = finder.market_values(row)
        self.assertEqual((values["sacks_taken"], values["rushing_tds"], values["receiving_tds"], values["fumbles_lost"]), (3, 1, 0, 1))
        self.assertEqual((values["solo_tackles"], values["tackles"]), (4, 7))
        kicker = finder.market_values({"position": "K", "fg_made": "2", "fg_att": "2", "pat_made": "3", "pat_att": "3", "fg_made_list": "30;41"})
        self.assertEqual(kicker["pat_made"], 3)
        # Punts come from play by play, like the other punting markets.
        self.assertEqual(finder.PBP_MARKETS["punts"], "punts")

    def test_history_windows_streak_and_h2h(self):
        games = [{"opponent": "CLE" if index % 2 else "BAL", "values": {"receptions": value}}
                 for index, value in enumerate([2, 6, 5, 3, 7, 8])]
        fields = prizepicks_board.history_fields(games, "receptions", 4.5, "CLE")
        self.assertEqual(fields["streak"], 2)
        self.assertEqual((fields["windows"]["l5"]["hits"], fields["windows"]["l5"]["decisions"]), (4, 5))
        self.assertEqual(fields["windows"]["h2h"]["sample"], 3)
        self.assertEqual(fields["sample"], 6)
        self.assertEqual(prizepicks_board.history_fields(games, None, 4.5, "CLE")["windows"], {})

    def test_board_keeps_every_line_and_skips_combos_and_started_games(self):
        now = datetime(2026, 9, 20, 12, tzinfo=timezone.utc).timestamp()
        kickoff = datetime(2026, 9, 20, 17, tzinfo=timezone.utc)
        games = {"2026_03_PIT_CLE": {"game_id": "2026_03_PIT_CLE", "home": "CLE", "away": "PIT", "final": False,
                                     "kickoff": kickoff.timestamp()}}
        roster = [{"gsis_id": "00-1", "full_name": "Chris Boswell", "team": "PIT", "position": "K", "espn_id": "17372"},
                  {"gsis_id": "00-2", "full_name": "DK Metcalf", "team": "PIT", "position": "WR", "espn_id": "4047650"}]
        history = {"00-1": [{"opponent": "CLE", "values": {"fg_made": value}} for value in (1, 3, 2)],
                   "00-2": [{"opponent": "BAL", "values": {"receptions": value}} for value in (5, 4)]}
        starts = kickoff.isoformat()
        line = {"team": "PIT", "start_time": starts, "odds_type": "standard", "updated_at": "2026-09-20T11:00:00Z"}
        projections = [
            {**line, "id": 1, "player": "Chris Boswell", "position": "K", "stat": "FG Made", "line": 1.5},
            {**line, "id": 2, "player": "Chris Boswell", "position": "K", "stat": "Fantasy Score", "line": 7.5, "odds_type": "goblin"},
            {**line, "id": 3, "player": "DK Metcalf", "position": "WR", "stat": "Receptions", "line": 4.5},
            {**line, "id": 4, "player": "DK Metcalf", "position": "WR", "stat": "Receiving Air Yards", "line": 60.5},
            {**line, "id": 5, "player": "DK Metcalf + Boswell", "stat": "Receptions", "line": 9.5, "combo": True},
            {**line, "id": 6, "player": "DK Metcalf", "stat": "Receptions", "line": 3.5,
             "start_time": "2026-09-20T11:00:00+00:00"},
        ]
        with patch.object(finder, "games_index", return_value=games), \
                patch.object(finder, "roster_rows", side_effect=lambda year: roster if year == 2026 else []), \
                patch.object(finder, "game_values", side_effect=lambda _season, pid, cached=True: history[pid]) as values:
            result = prizepicks_board.build(2026, projections, now=now, sportsbook_lines=[])
        rows = {row["id"]: row for row in result["rows"]}
        self.assertEqual(set(rows), {"pp:1", "pp:2", "pp:3", "pp:4"})
        # One history load per player, whatever the number of lines.
        self.assertEqual(values.call_count, 2)
        kicker = rows["pp:1"]
        self.assertEqual((kicker["propType"], kicker["playerId"], kicker["opponentId"], kicker["gameId"]),
                         ("fg_made", "00-1", "CLE", "2026_03_PIT_CLE"))
        self.assertEqual(kicker["windows"]["l5"]["hits"], 2)
        self.assertEqual(kicker["windows"]["h2h"]["sample"], 3)
        self.assertIn("17372", kicker["headshot"])
        self.assertEqual((rows["pp:2"]["propType"], rows["pp:2"]["line"]["category"]), ("kicker_fantasy", "GOBLIN"))
        self.assertEqual((rows["pp:3"]["propLabel"], rows["pp:3"]["line"]["bookmaker"]), ("Receptions", "prizepicks"))
        # A market we cannot chart still shows, under PrizePicks' own name.
        self.assertEqual((rows["pp:4"]["propType"], rows["pp:4"]["propLabel"]), ("pp:receivingairyards", "Receiving Air Yards"))
        self.assertEqual(rows["pp:4"]["windows"], {})
        self.assertEqual([event["gameId"] for event in result["events"]], ["2026_03_PIT_CLE"])

    def setup_game(self):
        self.now = datetime(2026, 9, 20, 12, tzinfo=timezone.utc).timestamp()
        kickoff = datetime(2026, 9, 20, 17, tzinfo=timezone.utc)
        self.starts = kickoff.isoformat()
        self.games = {"2026_03_PIT_CLE": {"game_id": "2026_03_PIT_CLE", "home": "CLE", "away": "PIT", "final": False,
                                          "kickoff": kickoff.timestamp()}}
        self.event = {"eventId": "e1", "gameId": "2026_03_PIT_CLE", "homeTeamId": "CLE", "awayTeamId": "PIT",
                      "startsAt": self.starts}
        self.roster = [{"gsis_id": "00-2", "full_name": "DK Metcalf", "team": "PIT", "position": "WR", "espn_id": "4047650"},
                       {"gsis_id": "00-3", "full_name": "Jerry Jeudy", "team": "CLE", "position": "WR", "espn_id": "1"}]

    def run_board(self, projections, sportsbook_lines):
        with patch.object(finder, "games_index", return_value=self.games), \
                patch.object(finder, "roster_rows", side_effect=lambda year: self.roster if year == 2026 else []), \
                patch.object(finder, "game_values", return_value=[{"opponent": "CLE", "values": {"receptions": 5, "receiving_yards": 60}}]):
            return prizepicks_board.build(2026, projections, now=self.now, sportsbook_lines=sportsbook_lines)

    def quote(self, book, player, market, line, over, under):
        return {"book": book, "player": player, "market": market, "line": line, "over": over, "under": under,
                "updatedAt": "2026-09-20T11:00:00Z", "event": self.event}

    def test_sportsbook_lines_join_prizepicks_or_stand_alone(self):
        self.setup_game()
        projections = [{"id": 3, "player": "DK Metcalf", "position": "WR", "stat": "Receptions", "line": 4.5, "team": "PIT",
                        "start_time": self.starts, "odds_type": "standard", "updated_at": ""}]
        lines = [self.quote("draftkings", "DK Metcalf", "receptions", 4.5, -125, -105),
                 self.quote("fanduel", "DK Metcalf", "receptions", 4.5, -130, 100),
                 # Only the sportsbooks post this one: its own row.
                 self.quote("fanduel", "DK Metcalf", "receiving_yards", 52.5, -115, -115),
                 self.quote("draftkings", "Jerry Jeudy", "receptions", 3.5, 105, -135),
                 # Nobody on either team by this name: left out.
                 self.quote("fanduel", "Someone Else", "receptions", 2.5, -110, -110)]
        result = self.run_board(projections, lines)
        rows = {(row["playerName"], row["propType"], row["line"]["value"]): row for row in result["rows"]}
        joined = rows[("DK Metcalf", "receptions", 4.5)]
        self.assertEqual([app["key"] for app in joined["apps"]], ["prizepicks", "draftkings", "fanduel"])
        self.assertEqual((joined["apps"][1]["over"], joined["apps"][1]["under"]), (-125, -105))
        yards = rows[("DK Metcalf", "receiving_yards", 52.5)]
        self.assertEqual((yards["propLabel"], yards["line"]["bookmaker"], yards["opponentId"], yards["teamId"]),
                         ("Receiving Yards", "fanduel", "CLE", "PIT"))
        self.assertEqual(yards["windows"]["l5"]["hits"], 1)
        jeudy = rows[("Jerry Jeudy", "receptions", 3.5)]
        self.assertEqual((jeudy["teamId"], jeudy["opponentId"]), ("CLE", "PIT"))
        self.assertEqual(len(rows), 3)
        self.assertEqual((result["sources"]["prizepicks"], result["sources"]["sportsbooks"], result["sources"]["unmatchedPlayers"]), (1, 2, 1))

    def test_either_source_can_fail_alone(self):
        self.setup_game()
        line = [self.quote("draftkings", "DK Metcalf", "receptions", 4.5, -125, -105)]
        with patch.object(prizepicks_board, "_projections", side_effect=RuntimeError("PrizePicks down")):
            result = self.run_board(None, line)
        self.assertEqual(len(result["rows"]), 1)
        self.assertEqual(result["sources"]["prizepicksError"], "PrizePicks down")
        with patch.object(prizepicks_board, "_projections", side_effect=RuntimeError("PrizePicks down")), \
                patch.object(prizepicks_board, "_sportsbook_lines", side_effect=RuntimeError("no key")), \
                self.assertRaises(RuntimeError):
            self.run_board(None, None)

    def test_event_odds_parse_each_books_over_and_under(self):
        event = {"eventId": "e1"}
        payload = {"id": "e1", "bookmakers": [
            {"key": "draftkings", "last_update": "t", "markets": [{"key": "player_receptions", "outcomes": [
                {"name": "Over", "description": "DK Metcalf", "point": 4.5, "price": -125},
                {"name": "Under", "description": "DK Metcalf", "point": 4.5, "price": -105}]},
                {"key": "player_anytime_td", "outcomes": [{"name": "Yes", "description": "DK Metcalf", "price": 150}]}]},
            {"key": "prizepicks", "markets": [{"key": "player_receptions", "outcomes": [
                {"name": "Over", "description": "DK Metcalf", "point": 4.5, "price": -137}]}]}]}
        lines = prizepicks_board._parse_event_odds(payload, event)
        self.assertEqual(lines, [{"book": "draftkings", "player": "DK Metcalf", "market": "receptions", "line": 4.5,
                                  "over": -125, "under": -105, "updatedAt": "t", "alternate": False}])
        with self.assertRaises(ValueError):
            prizepicks_board._parse_event_odds({"id": "other", "bookmakers": []}, event)

    def test_alternate_lines_price_goblins_but_are_never_rows(self):
        event = {"eventId": "e1"}
        def outcome(side, point, price):
            return {"name": side, "description": "DK Metcalf", "point": point, "price": price}
        payload = {"id": "e1", "bookmakers": [{"key": "fanduel", "markets": [
            {"key": "player_reception_yds_alternate", "outcomes": [outcome("Over", 44.5, -130), outcome("Over", 19.5, -900)]},
            {"key": "player_reception_yds", "outcomes": [outcome("Over", 44.5, -115), outcome("Under", 44.5, -115)]}]}]}
        lines = {(line["line"], line["alternate"]): (line["over"], line["under"]) for line in prizepicks_board._parse_event_odds(payload, event)}
        # The main line wins over the same book's alternate at that number.
        self.assertEqual(lines, {(44.5, False): (-115, -115), (19.5, True): (-900, None)})
        self.setup_game()
        goblin = [{"id": 9, "player": "DK Metcalf", "position": "WR", "stat": "Receiving Yards", "line": 19.5, "team": "PIT",
                   "start_time": self.starts, "odds_type": "goblin", "updated_at": ""}]
        quotes = [{**self.quote("fanduel", "DK Metcalf", "receiving_yards", 19.5, -900, None), "alternate": True},
                  {**self.quote("draftkings", "DK Metcalf", "receiving_yards", 69.5, 400, None), "alternate": True}]
        result = self.run_board(goblin, quotes)
        self.assertEqual(len(result["rows"]), 1)
        self.assertEqual([(app["key"], app["over"]) for app in result["rows"][0]["apps"]], [("prizepicks", None), ("fanduel", -900)])

    def test_sportsbook_fetch_stays_in_window_and_above_the_credit_floor(self):
        from backend.sports.nfl.services import odds
        now = datetime(2026, 9, 28, 12, tzinfo=timezone.utc).timestamp()
        soon = {"eventId": "a", "startsAt": "2026-09-29T00:15:00+00:00"}
        later = {"eventId": "b", "startsAt": "2026-10-12T17:00:00+00:00"}
        payload = {"id": "a", "bookmakers": []}
        calls = []

        def get(path, params):
            calls.append((path, params))
            return type("R", (), {"json": lambda self: payload})()
        passthrough = lambda _domain, _parts, loader, **_: loader()
        with patch.object(odds, "events", return_value={"data": [soon, later], "creditsRemaining": 90000}), \
                patch.object(odds, "credentials", return_value=["k"]), patch.object(odds, "_get", side_effect=get), \
                patch.object(prizepicks_board, "cached_nfl", side_effect=passthrough):
            self.assertEqual(prizepicks_board._sportsbook_lines(2026, now), [])
        self.assertEqual([path.split("/")[4] for path, _ in calls], ["a"])
        self.assertEqual(len(calls[0][1]["bookmakers"].split(",")), 10)
        with patch.object(odds, "events", return_value={"data": [soon], "creditsRemaining": 200}), \
                self.assertRaises(RuntimeError):
            prizepicks_board._sportsbook_lines(2026, now)

    def test_same_name_on_two_teams_matches_by_team(self):
        roster = {"joshallen": [{"id": "a", "team": "BUF"}, {"id": "b", "team": "JAX"}]}
        self.assertEqual(prizepicks_board._match(roster, "Josh Allen", "JAX")["id"], "b")
        self.assertIsNone(prizepicks_board._match(roster, "Josh Allen", "NYJ"))
        self.assertEqual(prizepicks_board._name_key("Marvin Harrison Jr."), "marvinharrison")


if __name__ == "__main__":
    unittest.main()
