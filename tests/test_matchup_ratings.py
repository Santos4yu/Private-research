import copy
from datetime import datetime, timedelta, timezone
import unittest
import json
from unittest.mock import patch

from matchup_ratings import HITTER_WEIGHTS, VERSION, finalize, prepare_board, reconcile_research


def factors(scores=None, confidence=1):
    return [dict(key=key, score=(scores or {}).get(key, 50), weight=weight,
                 impact=999, available=True, confidence=confidence)
            for key, weight in HITTER_WEIGHTS.items()]


def board():
    return dict(date="2026-09-19", generated_at=datetime.now(timezone.utc).isoformat(), props=[dict(
        sport="MLB", player_name="Example", stat_type="Hits", line=.5,
        stats=dict(player_id=1, game_pk=2, opponent_team_id=3, pitcher={"pitcher_id": 4},
                   side="under", matchup_score=100, matchup_label="ELITE",
                   matchup_coverage=1, matchup_factors=factors({"handedness": 100, "pitcher_quality": 90})))])


class MatchupRatingsTests(unittest.TestCase):
    def test_weights_are_a_mean_not_double_strength_edges(self):
        rating = finalize(factors({"handedness": 100, "pitcher_quality": 90}))
        # .23*100 + .22*90 + .55*50 = 70.3, not the old 90.6.
        self.assertEqual(rating["score"], 70)
        self.assertEqual(rating["label"], "Favorable")
        self.assertAlmostEqual(sum(row["impact"] for row in rating["factors"]), 20.3)

    def test_neutral_and_extremes(self):
        self.assertEqual(finalize(factors())["score"], 50)
        self.assertEqual(finalize(factors(dict.fromkeys(HITTER_WEIGHTS, 100)))["score"], 97)
        self.assertEqual(finalize(factors(dict.fromkeys(HITTER_WEIGHTS, 0)))["score"], 3)

    def test_sparse_and_unknown_values_cannot_be_elite(self):
        rating = finalize([dict(key="handedness", score=100, confidence=.1, available=True)])
        self.assertLess(rating["score"], 75)
        self.assertLess(rating["coverage"], .1)
        self.assertIn("Limited data", rating["label"])
        for invalid in (None, "", "NaN", "Infinity", -1, 101):
            self.assertIsNone(finalize([dict(key="handedness", score=invalid, confidence=1)])["score"])

    def test_missing_is_unavailable_and_real_zero_is_preserved(self):
        self.assertIsNone(finalize([])["score"])
        rating = finalize(factors({"handedness": 0}))
        self.assertEqual(rating["score"], 38)

    def test_duplicate_factors_do_not_double_count(self):
        values = factors({"handedness": 100})
        self.assertEqual(finalize(values)["score"], finalize(values + values)["score"])

    def test_pitcher_raw_confidence_shrinks_once(self):
        rating = finalize([dict(key="skill", score=100, weight=20, confidence=.2)], hitter=False, raw_scores=True)
        self.assertEqual(rating["score"], 52)
        self.assertEqual(rating["coverage"], .04)

    def test_processing_a_pitcher_snapshot_twice_does_not_shrink_it_twice(self):
        source = board()
        row = source["props"][0]
        row["stat_type"] = "Strikeouts"
        row["stats"]["is_pitcher"] = True
        row["stats"]["matchup_factors"] = [dict(key="skill", score=100, weight=20, confidence=.2)]
        once = prepare_board(source)
        self.assertEqual(once, prepare_board(once))

    def test_board_ignores_published_100_and_does_not_mutate_storage(self):
        source = board()
        ready = prepare_board(source)
        self.assertEqual(source["props"][0]["stats"]["matchup_score"], 100)
        self.assertEqual(ready["props"][0]["stats"]["matchup_score"], 70)

    def test_exact_board_and_research_snapshot_match(self):
        ready = prepare_board(board())
        stats = ready["props"][0]["stats"]
        live = dict(matchupScore=97, matchupContext=stats["matchup_context"])
        result = reconcile_research(live, ready, stat="Hits")
        for suffix in ("score", "label", "coverage", "factors", "version"):
            self.assertEqual(result["matchup" + suffix.title()], stats["matchup_" + suffix])
        self.assertEqual(live["matchupScore"], 97)

    def test_changed_side_line_player_game_opponent_or_pitcher_uses_live(self):
        ready = prepare_board(board())
        context = ready["props"][0]["stats"]["matchup_context"]
        for key, value in dict(side="over", line=1.5, playerId=99, gameId=99, opponentId=99, pitcherId=99).items():
            live = dict(matchupScore=61, matchupContext={**context, key: value})
            self.assertEqual(reconcile_research(live, ready, stat="Hits"), live, key)
        live = dict(matchupScore=61, matchupContext=context)
        self.assertEqual(reconcile_research(live, ready, stat="Total Bases"), live)

    def test_missing_context_or_stale_board_not_rated(self):
        for key in ("player_id", "game_pk", "opponent_team_id", "pitcher", "side"):
            source = board()
            source["props"][0]["stats"].pop(key)
            self.assertIsNone(prepare_board(source)["props"][0]["stats"]["matchup_score"], key)
        source = board()
        source["generated_at"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        self.assertIsNone(prepare_board(source)["props"][0]["stats"]["matchup_score"])

    def test_schedule_starter_change_invalidates_snapshot(self):
        games = [dict(game_pk=2, home_id=3, home_pitcher_id=4, away_id=5)]
        self.assertEqual(prepare_board(board(), games)["props"][0]["stats"]["matchup_score"], 70)
        games[0]["home_pitcher_id"] = 9
        self.assertIsNone(prepare_board(board(), games)["props"][0]["stats"]["matchup_score"])

    def test_duplicates_across_collections_share_one_rating(self):
        source = board()
        source["matchup_research"] = copy.deepcopy(source["props"])
        source["matchup_research"][0]["stats"]["matchup_factors"] = factors(dict.fromkeys(HITTER_WEIGHTS, 100))
        ready = prepare_board(source)
        self.assertEqual(ready["props"][0]["stats"]["matchup_score"], ready["matchup_research"][0]["stats"]["matchup_score"])

    def test_endpoints_preserve_published_board_and_live_research_ratings(self):
        from api import board as board_api, prediction as prediction_api
        from prediction_core import _matchup_provenance, MATCHUP_VERSION
        source = board()
        live = _matchup_provenance(
            dict(matchupScore=97, matchupLabel="Elite Matchup", matchupCoverage=.85,
                 matchupFactors=[dict(key="handedness", impact=11)]),
            1, dict(game_pk=2, opp_team_id=3, pitcher_id=4), .5, "under", "Hits",
        )
        games = [dict(game_pk=2, home_id=3, home_pitcher_id=4, away_id=5)]
        def invoke(module, path):
            request = object.__new__(module.handler)
            request.path, request.headers = path, {}
            response = []
            request._send = lambda status, payload: response.append((status, payload))
            request.do_GET()
            return response[0]
        with patch("site_controls.allowed", return_value=True), \
             patch.object(board_api, "session_with_live_access", return_value=True), \
             patch.object(prediction_api, "session_with_live_access", return_value=True), \
             patch.object(board_api, "_schedule_games", return_value=games), \
             patch.object(board_api.store, "get", side_effect=lambda key, **kwargs: json.dumps(source)) as read_board, \
             patch.object(prediction_api, "compute_prediction", return_value=live) as compute, \
             patch.dict(prediction_api._PREDICTION_CACHE, {}, clear=True):
            query = "/api/prediction?player=Example&stat=Hits&line=0.5&side=under&playerId=1"
            status, first = invoke(prediction_api, query)
            self.assertEqual(status, 200)
            self.assertEqual(first, live)
            self.assertEqual(first["matchupVersion"], MATCHUP_VERSION)
            self.assertEqual(first["matchupContext"]["source"], "live")
            read_board.assert_not_called()
            _, displayed = invoke(board_api, "/api/board")
            self.assertEqual(displayed["props"], source["props"])
            self.assertEqual(displayed["props"][0]["stats"]["matchup_score"], 100)
            source["props"][0]["stats"]["matchup_factors"] = factors()
            _, second = invoke(prediction_api, query)
            self.assertEqual(second, {**live, "cached": True})
            read_board.assert_called_once_with(board_api.BOT_BOARD_KEY)
            self.assertEqual(compute.call_count, 1)


if __name__ == "__main__":
    unittest.main()
