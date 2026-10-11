import unittest
from unittest import mock

from backend.sports.nfl import finder
from backend.sports.nfl.cache import clear_nfl_cache


class BoardSeedsPlayerLogTests(unittest.TestCase):
    def setUp(self):
        clear_nfl_cache()
        self.addCleanup(clear_nfl_cache)

    def test_the_log_the_board_built_is_reused_by_the_player_page(self):
        log = {"season": 2026, "player": {"id": "00-1"}, "rows": [], "version": finder.VERSION}
        with mock.patch.object(finder, "_player_log_rows", return_value=log) as build, \
                mock.patch.object(finder, "pbp_values", return_value={}), \
                mock.patch("backend.sports.nfl.cache._kv_get", return_value=None):
            finder.game_values(2026, "00-1", cached=False)
            self.assertIs(finder.player_log(2026, "00-1"), log)
        self.assertEqual(build.call_count, 1)

    def test_a_players_play_by_play_summary_is_built_once(self):
        with mock.patch.object(finder, "_pbp_resource", return_value={"games": {}}) as build, \
                mock.patch("backend.sports.nfl.cache._kv_get", return_value=None), \
                mock.patch("backend.sports.nfl.cache._kv_set"):
            finder.pbp_resource(2026, "00-2")
            finder.pbp_resource(2026, "00-2")
        self.assertEqual(build.call_count, 1)


if __name__ == "__main__":
    unittest.main()
