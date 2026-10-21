"""Who guards him: NBA.com's season matchups, per 75 possessions (nba_matchups.py)."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import nba_matchups  # noqa: E402

ROSTER = [{"id": "1", "name": "Darius Garland", "team": "LAC"}, {"id": "2", "name": "Nique Clifford", "team": "SAC"},
          {"id": "3", "name": "Maxime Raynaud", "team": "SAC"}, {"id": "4", "name": "Jalen Suggs", "team": "ORL"}]


def matchup(pid, name, poss, pts, fgm, fga, tpm=0, tpa=0, ftm=0, fta=0, ast=0, tov=0, gp=1, minutes="2:30", sfl=0):
    return {"DEF_PLAYER_ID": pid, "DEF_PLAYER_NAME": name, "GP": gp, "MATCHUP_MIN": minutes, "PARTIAL_POSS": poss, "PLAYER_PTS": pts,
            "MATCHUP_FGM": fgm, "MATCHUP_FGA": fga, "MATCHUP_FG3M": tpm, "MATCHUP_FG3A": tpa, "MATCHUP_FTM": ftm, "MATCHUP_FTA": fta,
            "MATCHUP_AST": ast, "MATCHUP_TOV": tov, "MATCHUP_BLK": 0, "SFL": sfl}


ROWS = [matchup(2, "Nique Clifford", 30, 9, 4, 10, 1, 4, 0, 0, ast=2, tov=1, gp=2, minutes="5:36"),
        matchup(3, "Maxime Raynaud", 10, 8, 3, 4, ftm=2, fta=2),
        matchup(4, "Jalen Suggs", 110, 30, 12, 26, 3, 9, 3, 4, ast=6, tov=4, gp=3)]


class LineTests(unittest.TestCase):
    def test_per_75_and_shooting(self):
        card = nba_matchups.line(nba_matchups._totals([ROWS[0]]))
        self.assertEqual(card["poss"], 30)
        self.assertEqual(card["pts"], 22.5)            # 9 in 30 possessions, per 75
        self.assertEqual(card["fga"], 25.0)
        self.assertEqual(card["fg"], 40.0)
        self.assertEqual(card["tp"], 25.0)
        self.assertEqual(card["ts"], 45.0)             # 9 / (2 * 10)
        self.assertEqual(card["min"], 5.6)             # "5:36"
        self.assertEqual(card["gp"], 2)

    def test_no_possessions_no_rates(self):
        card = nba_matchups.line(nba_matchups._totals([]))
        self.assertIsNone(card["pts"])
        self.assertIsNone(card["ts"])


class ViewTests(unittest.TestCase):
    def test_opponents_defenders_and_the_likely_one(self):
        card = nba_matchups.view(ROWS, ROSTER, "SAC", 2026)
        self.assertEqual(card["season"], "2025-26")
        self.assertEqual([item["name"] for item in card["defenders"]], ["Jalen Suggs", "Nique Clifford", "Maxime Raynaud"])
        self.assertEqual([item["team"] for item in card["defenders"]], ["ORL", "SAC", "SAC"])
        # Clifford had 30 of SAC's 40 possessions on him, over two games.
        self.assertEqual(card["likely"], {"id": "2", "share": 75, "sure": "likely"})
        # His usual: all 150 possessions together.
        self.assertEqual(card["usual"]["poss"], 150)
        self.assertEqual(card["usual"]["pts"], round(47 / 150 * 75, 1))

    def test_one_game_or_a_split_is_only_possible(self):
        rows = [matchup(2, "Nique Clifford", 12, 4, 2, 5), matchup(3, "Maxime Raynaud", 10, 2, 1, 4)]
        self.assertEqual(nba_matchups.view(rows, ROSTER, "SAC", 2026)["likely"]["sure"], "possible")
        self.assertIsNone(nba_matchups.view(rows, ROSTER, "BOS", 2026)["likely"])


class LookupTests(unittest.TestCase):
    def test_names_and_codes(self):
        self.assertEqual(nba_matchups.season_label(2027), "2026-27")
        self.assertEqual(nba_matchups.team_code("GSW"), "GS")
        self.assertEqual(nba_matchups.find_player(ROSTER, "Darius Garland", "LAC")["id"], "1")
        self.assertEqual(nba_matchups.find_player([{"id": "9", "name": "Nicolas Claxton", "team": "BKN"}], "Nic Claxton", "BKN")["id"], "9")
        self.assertIsNone(nba_matchups.find_player(ROSTER, "Nobody Here", "LAC"))
        self.assertEqual(nba_matchups.current_season(datetime(2026, 10, 20, tzinfo=timezone.utc)), 2026)
        self.assertEqual(nba_matchups.current_season(datetime(2026, 11, 2, tzinfo=timezone.utc)), 2027)

    def test_early_season_falls_back_to_last_season(self):
        thin = [matchup(2, "Nique Clifford", 12, 6, 2, 5)]
        seasons = {2027: thin, 2026: ROWS}
        with patch.object(nba_matchups, "players", return_value=ROSTER), \
             patch.object(nba_matchups, "season_matchups", side_effect=lambda pid, year: seasons[year]):
            card = nba_matchups.defender("Darius Garland", "LAC", "SAC", now=datetime(2026, 11, 2, tzinfo=timezone.utc))
        self.assertEqual(card["season"], "2025-26")
        self.assertEqual(card["player"]["id"], "1")
        self.assertEqual(card["likely"]["id"], "2")

    def test_an_unanswered_season_reads_last_one(self):
        def answered(pid, year):
            if year == 2027:
                raise nba_matchups.Unreachable("no answer")
            return ROWS
        with patch.object(nba_matchups, "players", return_value=ROSTER), \
             patch.object(nba_matchups, "season_matchups", side_effect=answered):
            card = nba_matchups.defender("Darius Garland", "LAC", "SAC", now=datetime(2026, 11, 2, tzinfo=timezone.utc))
        self.assertEqual(card["season"], "2025-26")
        self.assertEqual(card["likely"]["id"], "2")

    def test_nba_com_refusing_is_remembered_briefly(self):
        nba_matchups._memory.clear()
        with patch.object(nba_matchups.requests, "get", side_effect=nba_matchups.requests.ConnectionError("refused")) as get:
            with self.assertRaises(nba_matchups.Unreachable):
                nba_matchups._rows("leagueseasonmatchups", {})
            with self.assertRaises(nba_matchups.Unreachable):
                nba_matchups._rows("leagueseasonmatchups", {})
        self.assertEqual(get.call_count, 1)
        nba_matchups._memory.clear()


if __name__ == "__main__":
    unittest.main()


class PlayTypeTests(unittest.TestCase):
    def setUp(self):
        nba_matchups._memory.clear()

    def synergy(self, endpoint, params):
        self.assertEqual(endpoint, "synergyplaytypes")
        kind, season = params["PlayType"], params["SeasonYear"]
        if params["PlayerOrTeam"] == "P":
            share = {"PRBallHandler": 0.31, "Isolation": 0.12, "Spotup": 0.18, "Cut": 0.02}.get(kind)
            if share is None or season != "2025-26":
                return []
            return [{"PLAYER_NAME": "Anthony Edwards", "TEAM_ABBREVIATION": "MIN", "POSS_PCT": share, "PPP": 1.01, "PERCENTILE": 0.72,
                     "POSS": 20 * share, "GP": 79}]
        return [{"TEAM_ABBREVIATION": code, "PPP": ppp, "POSS_PCT": 0.15} for code, ppp in (("MIA", 0.92), ("IND", 1.08), ("BOS", 0.85))]

    def test_his_play_types_against_how_they_defend_them(self):
        with patch.object(nba_matchups, "_rows", side_effect=self.synergy):
            card = nba_matchups.play_types("Anthony Edwards", "MIN", "MIA", now=datetime(2026, 10, 22, tzinfo=timezone.utc))
        # Too few plays this season: last season's, his main ones only, most used first.
        self.assertEqual(card["season"], "2025-26")
        self.assertEqual([item["type"] for item in card["player"]], ["PRBallHandler", "Spotup", "Isolation"])
        self.assertEqual(card["player"][0]["share"], 31.0)
        self.assertEqual(card["player"][0]["percentile"], 72)
        # Rank 1 allows the most points a play.
        self.assertEqual(card["opponent"]["PRBallHandler"]["rank"], 2)
        self.assertEqual(card["opponent"]["PRBallHandler"]["teams"], 3)

    def test_defenders_shooting_allowed(self):
        rows = [{"CLOSE_DEF_PERSON_ID": 9, "D_FG_PCT": 0.441, "NORMAL_FG_PCT": 0.473, "D_FGA": 9.1, "GP": 70}]
        with patch.object(nba_matchups, "_rows", return_value=rows):
            self.assertEqual(nba_matchups.defense_shooting(2026)["9"], {"dfg": 44.1, "normal": 47.3, "diff": -3.2, "fga": 9.1, "gp": 70})
        with patch.object(nba_matchups, "_rows", side_effect=nba_matchups.Unreachable("no")):
            self.assertEqual(nba_matchups.defense_shooting(2026), {})
