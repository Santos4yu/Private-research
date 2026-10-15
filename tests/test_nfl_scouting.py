"""NFL scouting (nfl_scouting.py), checked on small hand-made games so every
rate and split can be worked out by hand."""
import unittest

import nfl_scouting as scouting


def play(game, offense, defense, play_id, week, **fields):
    row = {"game_id": game, "play_id": str(play_id), "season_type": "REG", "week": str(week), "posteam": offense,
           "defteam": defense, "play_type": "pass", "pass_attempt": "0", "rush_attempt": "0", "sack": "0",
           "qb_dropback": "0", "qb_scramble": "0", "qb_kneel": "0", "qb_spike": "0", "two_point_attempt": "0",
           "passer_player_id": "NA", "receiver_player_id": "NA", "rusher_player_id": "NA", "passing_yards": "NA",
           "rushing_yards": "NA", "success": "0", "fixed_drive": "1", "drive_time_of_possession": "30:00"}
    row.update({key: str(value) for key, value in fields.items()})
    return row


def season():
    """BUF's offense against MIA (week 1) and NYJ (week 2). MIA blitz half
    of 80 dropbacks, NYJ a fifth. The receiver gets 20 of the 40 blitz
    targets against MIA and 8 of the 40 others; against NYJ 4 of 16 and 16
    of 64. The passer gains 9 a throw against the blitz, 6 otherwise. MIA
    play a light box on 30 of 50 runs (5 yards each; 3 against the full
    ones); NYJ never do (3 a carry)."""
    plays, charting, number = [], {}, 0
    for game, defense, week, blitzes, receiver_blitz, receiver_calm in (("G1", "MIA", 1, 40, 20, 8), ("G2", "NYJ", 2, 16, 4, 16)):
        for index in range(80):
            number += 1
            blitz = index < blitzes
            mine = index < receiver_blitz if blitz else index - blitzes < receiver_calm
            plays.append(play(game, "BUF", defense, number, week, qb_dropback=1, pass_attempt=1, passer_player_id="qb",
                              receiver_player_id="wr" if mine else "te", passing_yards=9 if blitz else 6))
            charting[(game, number)] = {"blitz": blitz, "box": 6}
        for index in range(50):
            number += 1
            light = defense == "MIA" and index < 30
            plays.append(play(game, "BUF", defense, number, week, play_type="run", rush_attempt=1, rusher_player_id="rb",
                              rushing_yards=5 if light else 3, success=1 if light else 0))
            charting[(game, number)] = {"blitz": False, "box": 6 if light else 8}
    return plays, charting


class TableTests(unittest.TestCase):
    def setUp(self):
        plays, charting = season()
        contact = {"rb": {"carries": 100, "afterContact": 250, "broken": 7}}
        snaps = {"wr": [(1, 0.7), (2, 0.9)]}
        self.table = scouting.summarize(plays, charting, {"MIA": 24}, contact, snaps)

    def test_defense_rates_and_ranks(self):
        mia, nyj = self.table["teams"]["MIA"]["def"], self.table["teams"]["NYJ"]["def"]
        self.assertEqual(mia["blitz"], [0.5, 1])
        self.assertEqual(nyj["blitz"], [0.2, 2])
        # Pressures from the advanced stats over the dropbacks they faced.
        self.assertEqual(mia["pressure"], [0.3, 1])
        self.assertIsNone(nyj["pressure"])
        self.assertEqual(mia["lightBox"], [0.6, 1])
        self.assertEqual(mia["ypc"], [round(210 / 50, 4), 1])
        self.assertEqual(nyj["ypc"], [3.0, 2])
        self.assertEqual(mia["rushSuccess"][0], 0.6)
        self.assertEqual(mia["ypa"][0], round((40 * 9 + 40 * 6) / 80, 4))
        self.assertEqual(self.table["teams"]["BUF"]["off"]["top"], [1800.0, 1])
        self.assertEqual(self.table["weeks"], [1, 2])

    def test_player_splits(self):
        players = self.table["players"]
        # 24 of the team's 56 blitz targets, 24 of its 104 others.
        share = players["wr"]["targetSplit"]
        self.assertAlmostEqual(share[0], 24 / 56)
        self.assertAlmostEqual(share[1], 24 / 104)
        self.assertEqual(share[2], 24)
        self.assertEqual(players["qb"]["passSplit"], [9.0, 6.0, 56])
        self.assertEqual(players["rb"]["boxSplit"], [5.0, 3.0, 30])
        self.assertEqual(players["rb"]["contact"]["afterContact"], 2.5)
        self.assertEqual(players["rb"]["carries"], [50, 50])
        self.assertEqual(players["wr"]["targets"], [28, 20])
        self.assertEqual(players["wr"]["snaps"], [0.7, 0.9])

    def test_two_point_tries_and_kneels_never_count(self):
        plays, charting = season()
        plays.append(play("G1", "BUF", "MIA", 999, 1, play_type="run", rush_attempt=1, rusher_player_id="rb", rushing_yards=0, two_point_attempt=1))
        plays.append(play("G1", "BUF", "MIA", 1000, 1, play_type="qb_kneel", rush_attempt=1, rusher_player_id="qb", rushing_yards=-1, qb_kneel=1))
        table = scouting.summarize(plays, charting, {}, {}, {})
        self.assertEqual(table["players"]["rb"]["carries"], [50, 50])
        self.assertEqual(table["teams"]["MIA"]["def"]["ypc"][0], round(210 / 50, 4))


def scout(**defense):
    teams = {"DEN": {"def": defense, "off": {"top": [1700.0, 25]}}, "SEA": {"def": {}, "off": {"top": [1980.0, 3]}}}
    players = {
        "wr": {"team": "SEA", "targetSplit": [0.24, 0.16, 12], "targets": [3, 4, 2, 9, 7, 8], "carries": [], "snaps": [0.6, 0.62, 0.64, 0.8, 0.82, 0.84]},
        "qb": {"team": "SEA", "passSplit": [5.1, 7.4, 40], "targets": [], "carries": []},
        "rb": {"team": "SEA", "boxSplit": [5.2, 3.9, 30], "targets": [], "carries": [15, 14, 16, 21, 20, 22],
               "contact": {"afterContact": 3.4, "afterRank": 4, "broken": 9, "brokenRank": 2, "backs": 40}},
    }
    return {"teams": teams, "players": players, "teamCount": 32}


class NoteTests(unittest.TestCase):
    def setUp(self):
        self.scout = scout(blitz=[0.38, 6], pressure=[0.31, 4], ypa=[7.9, 3], ypc=[4.9, 2], rushSuccess=[0.46, 5], lightBox=[0.64, 3])

    def test_a_receiver_who_gets_more_when_they_blitz(self):
        notes = scouting.for_market(scouting.notes_for(self.scout, "wr", "SEA", "DEN"), "receptions")
        keys = [note["key"] for note in notes]
        self.assertEqual(keys, ["blitz-split", "snaps", "recent-targets"], "yards-only notes stay off a receptions line")
        blitz = notes[0]
        self.assertEqual((blitz["lean"], blitz["weight"]), (1, 2))
        self.assertEqual(blitz["text"], "Gets 24% of targets when the defense blitzes, 16% when it doesn't; DEN blitz on 38% of dropbacks, 6th most")
        self.assertEqual(notes[1]["text"], "Played 82% of snaps the last 3 games, 62% before")
        self.assertEqual(notes[2]["text"], "Targets the last 3 games: 9, 7, 8 (up from 3.0 a game)")
        yards = scouting.for_market(scouting.notes_for(self.scout, "wr", "SEA", "DEN"), "receiving_yards")
        self.assertIn("pass-yards-allowed", [note["key"] for note in yards])
        self.assertAlmostEqual(scouting.lean_of(notes), 4 / 6)

    def test_a_quarterback_against_the_pass_rush_and_the_blitz(self):
        notes = scouting.for_market(scouting.notes_for(self.scout, "qb", "SEA", "DEN", spread=-7), "passing_yards")
        by_key = {note["key"]: note for note in notes}
        self.assertEqual(by_key["pressure"]["text"], "DEN pressure the quarterback on 31% of dropbacks, 4th most")
        self.assertEqual(by_key["pressure"]["lean"], -1)
        self.assertEqual(by_key["blitz-split"]["lean"], -1, "worse against the blitz, and they blitz a lot")
        self.assertEqual(by_key["script"]["text"], "7-point underdog: teams behind throw more")
        self.assertEqual(by_key["script"]["lean"], 1)

    def test_a_back_against_a_soft_run_defense_and_light_boxes(self):
        notes = scouting.for_market(scouting.notes_for(self.scout, "rb", "SEA", "DEN", spread=7), "rushing_yards")
        by_key = {note["key"]: note for note in notes}
        self.assertEqual(by_key["run-defense"]["text"], "DEN allow 4.9 yards a carry, 2nd most")
        self.assertEqual(by_key["light-box"]["text"], "DEN play six or fewer in the box on 64% of runs, 3rd most; "
                                                      "he averages 5.2 a carry against those boxes, 3.9 against more")
        self.assertEqual(by_key["light-box"]["lean"], 1)
        self.assertEqual(by_key["contact"]["text"], "3.4 yards after contact a carry, 4th most among backs (9 broken tackles)")
        self.assertEqual(by_key["possession"]["text"], "SEA hold the ball 33:00 a game, 3rd most")
        self.assertEqual(by_key["script"]["text"], "Favored by 7: teams ahead lean on the run")
        self.assertEqual(by_key["recent-carries"]["lean"], 1)
        # Rush attempts don't read yards-a-carry numbers.
        attempts = [note["key"] for note in scouting.for_market(scouting.notes_for(self.scout, "rb", "SEA", "DEN", spread=7), "rush_attempts")]
        self.assertNotIn("run-defense", attempts)
        self.assertIn("possession", attempts)

    def test_the_middle_of_the_league_says_nothing(self):
        middle = scout(blitz=[0.3, 16], pressure=[0.22, 15], ypa=[7.1, 17], ypc=[4.1, 16], rushSuccess=[0.4, 16], lightBox=[0.45, 16])
        notes = scouting.notes_for(middle, "qb", "SEA", "DEN")
        # Only his own team's time of possession (3rd most) is left.
        self.assertEqual([(family, [note["key"] for note in items]) for family, items in notes.items()], [("rushing", ["possession"])])
        self.assertEqual(scouting.notes_for(middle, "nobody", "SEA", "XXX"), {})

    def test_the_best_rank_reads_the_most(self):
        notes = scouting.notes_for(scout(lightBox=[0.63, 1]), "rb", "SEA", "DEN")
        self.assertTrue(notes["rushing"][0]["text"].startswith("DEN play six or fewer in the box on 63% of runs, the most"))


if __name__ == "__main__":
    unittest.main()
