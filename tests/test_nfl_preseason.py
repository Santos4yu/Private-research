"""NFL preseason games from ESPN box scores (backend/sports/nfl/preseason.py)."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.sports.nfl import finder, preseason  # noqa: E402
from tests.test_nfl_finder import NoCache, game, stat  # noqa: E402


def athlete(athlete_id, name, *stats):
    first, _, last = name.partition(" ")
    return {"athlete": {"id": athlete_id, "displayName": name, "firstName": first, "lastName": last},
            "stats": list(stats)}


def summary(two_point=False):
    """The parts of ESPN's game summary the reader uses: CHI at CLE, 8/15."""
    chi = {"team": {"abbreviation": "CHI"}, "statistics": [
        {"name": "passing", "keys": ["completions/passingAttempts", "passingYards", "yardsPerPassAttempt",
                                     "passingTouchdowns", "interceptions", "sacks-sackYardsLost", "adjQBR", "QBRating"],
         "athletes": [athlete("11", "Tyson Bagent", "14/21", "163", "7.8", "1", "1", "2-11", "--", "88.0")]},
        {"name": "rushing", "keys": ["rushingAttempts", "rushingYards", "yardsPerRushAttempt", "rushingTouchdowns", "longRushing"],
         "athletes": [athlete("12", "Roschon Johnson", "9", "41", "4.6", "1", "12"),
                      athlete("11", "Tyson Bagent", "2", "-2", "-1.0", "0", "0")]},
        {"name": "receiving", "keys": ["receptions", "receivingYards", "yardsPerReception", "receivingTouchdowns",
                                       "longReception", "receivingTargets"],
         "athletes": [athlete("13", "Luther Burden", "5", "62", "12.4", "1", "28", "7"),
                      athlete("12", "Roschon Johnson", "1", "6", "6.0", "0", "6", "2")]},
        {"name": "fumbles", "keys": ["fumbles", "fumblesLost", "fumblesRecovered"],
         "athletes": [athlete("12", "Roschon Johnson", "1", "1", "0")]},
        {"name": "defensive", "keys": ["totalTackles", "soloTackles", "sacks", "tacklesForLoss", "passesDefended",
                                       "QBHits", "defensiveTouchdowns"],
         "athletes": [athlete("14", "Noah Sewell", "7", "4", "1.5", "2", "1", "2", "0")]},
        {"name": "kicking", "keys": ["fieldGoalsMade/fieldGoalAttempts", "fieldGoalPct", "longFieldGoalMade",
                                     "extraPointsMade/extraPointAttempts", "totalKickingPoints"],
         "athletes": [athlete("15", "Cairo Santos", "2/3", "66.7", "47", "2/2", "8")]},
        {"name": "punting", "keys": ["punts", "puntYards", "grossAvgPuntYards", "touchbacks", "puntsInside20", "longPunt"],
         "athletes": [athlete("16", "Tory Taylor", "4", "187", "46.8", "0", "2", "58")]},
    ]}
    cle = {"team": {"abbreviation": "CLE"}, "statistics": [
        {"name": "punting", "keys": ["punts", "puntYards", "grossAvgPuntYards", "touchbacks", "puntsInside20", "longPunt"],
         "athletes": [athlete("21", "Corey Bojorquez", "5", "231", "46.2", "1", "1", "55")]},
    ]}
    plays = [{"team": {"abbreviation": "CHI"}, "text": "Cairo Santos 47 Yd Field Goal"},
             {"team": {"abbreviation": "CHI"}, "text": "Cairo Santos 33 Yd Field Goal"}]
    if two_point:
        plays.append({"team": {"abbreviation": "CHI"},
                      "text": "Luther Burden 9 Yd pass from Tyson Bagent (Two-Point Pass Conversion - Tyson Bagent to Luther Burden)"})
    drives = {"previous": [
        {"team": {"abbreviation": "CHI"}, "plays": [
            {"text": "T.Taylor punts 58 yards to CLE 12, Center-S.Daly. J.Ford to CLE 20 for 8 yards."},
            {"text": "T.Taylor punts 41 yards to CLE 19, Center-S.Daly, fair catch by J.Ford."}]},
        {"team": {"abbreviation": "CLE"}, "plays": [
            {"text": "C.Bojorquez punts 55 yards to CHI 15, Center-C.Hughlett."}]},
        {"team": {"abbreviation": "CHI"}, "plays": [
            {"text": "T.Taylor punts 50 yards to CLE 10, Center-S.Daly, downed by CHI-J.Blackwell."},
            {"text": "(Punt formation) PENALTY on CLE-M.Harden, Running Into the Kicker, 5 yards, NO PLAY."},
            {"text": "T.Taylor punts 38 yards to CLE 18, Center-S.Daly, out of bounds."}]}]}
    return {"header": {"competitions": [{"date": "2026-08-15T23:00Z", "competitors": [
                {"homeAway": "home", "score": "17", "team": {"abbreviation": "CLE"}},
                {"homeAway": "away", "score": "24", "team": {"abbreviation": "CHI"}}]}]},
            "boxscore": {"players": [chi, cle]}, "scoringPlays": plays, "drives": drives}


class SummaryTests(unittest.TestCase):
    def test_box_score_becomes_weekly_columns(self):
        parsed = preseason.parse_summary(summary())
        self.assertEqual(parsed["game"], {"home": "CLE", "away": "CHI", "homeScore": 17, "awayScore": 24, "date": "2026-08-15"})
        qb = preseason.full_row(parsed["players"]["11"], "QB")
        self.assertEqual((qb["completions"], qb["attempts"], qb["passing_yards"], qb["passing_tds"]), (14, 21, 163, 1))
        self.assertEqual((qb["passing_interceptions"], qb["sacks_suffered"], qb["rushing_yards"]), (1, 2, -2))
        values = finder.market_values(qb)
        self.assertEqual(values["passing_rushing_yards"], 161)
        # 163 * .04 + 4 - 1 - 2 * .1
        self.assertEqual(values["fantasy_score"], 9.32)

    def test_every_market_family(self):
        players = preseason.parse_summary(summary())["players"]
        back = preseason.full_row(players["12"], "RB")
        values = {**finder.market_values(back), **preseason.extra_values(back)}
        self.assertEqual((values["rushing_yards"], values["rush_attempts"], values["receptions"], values["touchdowns"]), (41, 9, 1, 1))
        self.assertEqual((values["fumbles_lost"], values["longest_rush"], values["longest_reception"]), (1, 12, 6))
        receiver = {**finder.market_values(preseason.full_row(players["13"], "WR")), **preseason.extra_values(preseason.full_row(players["13"], "WR"))}
        self.assertEqual((receiver["receiving_yards"], receiver["targets"], receiver["longest_rush"]), (62, 7, 0))
        defender = finder.market_values(preseason.full_row(players["14"], "LB"))
        self.assertEqual((defender["tackles"], defender["solo_tackles"], defender["sacks"]), (7, 4, 1.5))
        punter = preseason.full_row(players["16"], "P")
        self.assertEqual(preseason.extra_values(punter)["punts"], 4)
        self.assertEqual(preseason.extra_values(punter)["gross_punt_yards"], 187)
        self.assertEqual(preseason.extra_values(punter)["punts_inside_20"], 2)
        # 58 and 50 from the play list.
        self.assertEqual(preseason.extra_values(punter)["punts_50_plus"], 2)

    def test_punts_the_plays_do_not_account_for_leave_50_plus_out(self):
        data = summary()
        data["drives"]["previous"][-1]["plays"].pop()
        punter = preseason.full_row(preseason.parse_summary(data)["players"]["16"], "P")
        self.assertIsNone(preseason.extra_values(punter)["punts_50_plus"])
        self.assertEqual(preseason.extra_values(punter)["punts"], 4)

    def test_kicker_distances_come_from_the_scoring_plays(self):
        kicker = preseason.full_row(preseason.parse_summary(summary())["players"]["15"], "K")
        values = {**finder.market_values(kicker), **preseason.extra_values(kicker)}
        self.assertEqual((values["fg_made"], values["pat_made"], values["longest_fg"]), (2, 2, 47))
        # 4 for the 47-yarder, 3 for the 33, 1 per extra point.
        self.assertEqual(values["kicker_fantasy"], 9)

    def test_unreadable_kick_distances_leave_the_kicker_score_out(self):
        data = summary()
        data["scoringPlays"] = []
        kicker = preseason.full_row(preseason.parse_summary(data)["players"]["15"], "K")
        values = {**finder.market_values(kicker), **preseason.extra_values(kicker)}
        self.assertIsNone(values["kicker_fantasy"])
        self.assertEqual(values["kicking_points"], 8)

    def test_unattributed_two_point_try_leaves_fantasy_out(self):
        receiver = preseason.full_row(preseason.parse_summary(summary(two_point=True))["players"]["13"], "WR")
        self.assertIsNone(finder.market_values(receiver)["fantasy_score"])
        self.assertEqual(finder.market_values(receiver)["receiving_yards"], 62)

    def test_team_view(self):
        game_info = {**preseason.parse_summary(summary())["game"], "week": 2}
        view = preseason.team_view("401", game_info, "CHI", 2026)
        self.assertEqual((view["gameId"], view["seasonKind"], view["opponent"], view["isHome"]), ("pre-401", "preseason", "CLE", False))
        self.assertEqual((view["result"], view["score"], view["date"]), ("W", "24-17", "2026-08-15"))


class SeasonTests(unittest.TestCase):
    def setUp(self):
        preseason._memo.clear()
        preseason._players.clear()

    def scoreboard(self, path, params):
        if path == "scoreboard":
            done = {"status": {"type": {"completed": True, "state": "post"}}}
            return {"events": [{"id": "401", **done}] if params["week"] == 2 else
                    [{"id": "402", "status": {"type": {"completed": False, "state": "pre"}}}] if params["week"] == 3 else []}
        self.calls.append(params["event"])
        return summary()

    def test_builds_finished_games_and_keeps_them(self):
        self.calls = []
        with patch.object(preseason, "_get", side_effect=self.scoreboard), patch.object(preseason, "_kv_get", return_value=None), \
                patch.object(preseason, "_kv_set"):
            index = preseason.season_games(2026, now=1_790_000_000)
            games = preseason.player_games(2026, "16")
            self.assertEqual(list(index["games"]), ["401"])
            self.assertEqual(index["games"]["401"]["game"]["week"], 2)
            self.assertEqual(games[0][2]["row"]["punts"], 4)
            # Built an hour later: the finished game is not fetched again.
            preseason.season_games(2026, now=1_790_000_000 + 2 * 60 * 60)
        self.assertEqual(self.calls, ["401"])

    def test_games_not_in_before_the_time_limit_are_fetched_next_time(self):
        import threading
        release = threading.Event()

        def get(path, params):
            if path == "scoreboard":
                done = {"status": {"type": {"completed": True}}}
                return {"events": [{"id": "401", **done}, {"id": "403", **done}] if params["week"] == 1 else []}
            if params["event"] == "403" and not release.is_set():
                release.wait(2)
                raise OSError("too slow")
            return summary()
        with patch.object(preseason, "_get", side_effect=get):
            first = preseason.build(2026, budget=0.2, now=1_790_000_000)
            release.set()
            second = preseason.build(2026, previous=first, now=1_790_000_000)
        self.assertEqual((list(first["games"]), first["complete"]), (["401"], False))
        self.assertEqual((sorted(second["games"]), second["complete"]), (["401", "403"], True))

    def test_espn_down_leaves_preseason_out(self):
        with patch.object(preseason, "_get", side_effect=OSError("blocked")), patch.object(preseason, "_kv_get", return_value=None), \
                patch.object(preseason, "_kv_set"):
            self.assertEqual(preseason.player_games(2026, "16"), [])


class PlayerLogTests(unittest.TestCase):
    def test_preseason_games_join_the_log(self):
        schedule = [game("2026_01_CHI_MIN", 2026, 1, "2026-09-13", "CHI", "MIN", 20, 17)]
        rows = [stat("00-taylor", "2026_01_CHI_MIN", "CHI", "MIN", position="P", group="SPEC")]
        parsed = preseason.parse_summary(summary())
        pre = [("401", {**parsed["game"], "week": 2}, parsed["players"]["16"])]
        with NoCache(), patch.object(finder, "schedule_rows", return_value=schedule), \
                patch.object(finder, "player_rows", side_effect=lambda year: rows if year == 2026 else []), \
                patch.object(finder, "espn_ids", return_value={"00-taylor": "16"}), \
                patch.object(preseason, "player_games", side_effect=lambda year, _id: pre if year == 2026 else []):
            log = finder.player_log(2026, "00-taylor")
            with patch.object(finder, "pbp_extras", return_value={"players": {}, "teams": {"CHI": {"2026_01_CHI_MIN": {}}}}):
                values = finder.game_values(2026, "00-taylor")
        self.assertEqual([(row["date"], row["seasonKind"]) for row in log["rows"]],
                         [("2026-08-15", "preseason"), ("2026-09-13", "regular")])
        self.assertEqual(log["rows"][0]["values"]["punts"], 4)
        self.assertEqual(log["rows"][0]["opponent"], "CLE")
        # Play-by-play fills the regular season game and leaves the preseason one alone.
        self.assertEqual([row["values"]["punts"] for row in values], [4, 0])


if __name__ == "__main__":
    unittest.main()
