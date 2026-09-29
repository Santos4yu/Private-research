"""The projected batting order shown before a team posts its lineup
(backend/stats_mlb.get_all_projected_team_lineups)."""
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT), str(ROOT / "backend")]

import stats_mlb  # noqa: E402

CUBS = 112
TODAY = date(2026, 9, 29)
REGULARS = [(1, "Pete Crow-Armstrong", "CF"), (2, "Seiya Suzuki", "DH"), (3, "Alex Bregman", "3B"),
            (4, "Michael Busch", "1B"), (5, "Ian Happ", "LF"), (6, "Kyle Tucker", "RF"),
            (7, "Dansby Swanson", "SS"), (8, "Nico Hoerner", "2B"), (9, "Miguel Amaya", "C")]
FILL_IN = (10, "Pedro Ramirez", "3B")


def card(players):
    return [{"id": pid, "fullName": name, "battingOrder": f"{slot}00", "position": {"abbreviation": position}}
            for slot, (pid, name, position) in enumerate(players, start=1)]


def schedule(sat_out_days):
    """30 days of Cubs games. On the days in `sat_out_days` (days before
    today) Bregman sits and the fill-in plays third, batting seventh."""
    dates = []
    for days_old in range(1, 31):
        players = list(REGULARS)
        if days_old in sat_out_days:
            players = [player for player in players if player[0] != 3]
            players.insert(6, FILL_IN)
        game = {"teams": {"home": {"team": {"id": CUBS}}, "away": {"team": {"id": 999}}},
                "lineups": {"homePlayers": card(players)}}
        dates.append({"date": (TODAY - timedelta(days=days_old)).isoformat(), "games": [game]})
    return {"dates": dates}


def project(data):
    with patch.object(stats_mlb, "_get", return_value=data):
        return stats_mlb.get_projected_team_lineup(CUBS, before_date=TODAY.isoformat())["lineup"]


class ProjectedLineupTests(unittest.TestCase):
    def test_a_regular_back_from_a_few_days_off_keeps_his_spot(self):
        # Out yesterday, three days ago and five to eight days ago.
        lineup = project(schedule({1, 3, 5, 6, 7, 8}))
        names = [player["name"] for player in lineup]
        self.assertIn("Alex Bregman", names)
        self.assertNotIn("Pedro Ramirez", names)
        self.assertEqual(len(lineup), 9)
        # Batting order follows each player's latest slot.
        self.assertEqual(names[:3], ["Pete Crow-Armstrong", "Seiya Suzuki", "Alex Bregman"])

    def test_one_player_per_position(self):
        # Out the last ten days: the fill-in has the more recent starts and
        # takes third. The regular DH keeps his spot, so there is no second
        # third baseman.
        lineup = project(schedule(set(range(1, 11))))
        names = [player["name"] for player in lineup]
        self.assertEqual(len(lineup), 9)
        self.assertIn("Seiya Suzuki", names)
        self.assertEqual([player["position"] for player in lineup].count("3B"), 1)

    def test_a_second_third_baseman_can_be_the_designated_hitter(self):
        # No regular DH (a different bench bat each day): the third
        # baseman who lost the position still gets in there.
        data = schedule({1, 3, 5, 6, 7, 8})
        for index, entry in enumerate(data["dates"]):
            for player in entry["games"][0]["lineups"]["homePlayers"]:
                if player["id"] == 2:
                    player.update(id=100 + index % 5, fullName=f"Bench {index % 5}")
        names = [player["name"] for player in project(data)]
        self.assertIn("Alex Bregman", names)
        self.assertIn("Pedro Ramirez", names)

    def test_a_player_who_left_the_lineup_for_good_drops_out(self):
        # Replaced twenty days ago and not back since.
        lineup = project(schedule(set(range(1, 21))))
        names = [player["name"] for player in lineup]
        self.assertIn("Pedro Ramirez", names)
        self.assertNotIn("Alex Bregman", names)

    def test_too_few_lineups_projects_nothing(self):
        with patch.object(stats_mlb, "_get", return_value={"dates": []}):
            self.assertEqual(stats_mlb.get_projected_team_lineup(CUBS, before_date=TODAY.isoformat()), {})


if __name__ == "__main__":
    unittest.main()
