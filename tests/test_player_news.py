"""player_news.py: ESPN's player news, read for a line into a few notes."""
import json
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

import player_news

NOW = datetime(2026, 11, 1, 18, tzinfo=timezone.utc)
FEED = {"feed": [
    {"headline": "Podziemski taking more shots", "story": "<p>Brandin Podziemski said he is trying to get up as many shots as he can, "
     "after Stephen Curry told him to stop passing up open looks.</p>", "published": "2026-10-31T22:00:00Z",
     "links": {"web": {"href": "https://espn.com/a"}}, "type": "Rotowire"},
    {"headline": "Curry out Saturday", "description": "Stephen Curry (ankle) is out against the Clippers.", "published": "2026-11-01T15:00:00Z",
     "links": {"web": {"href": "https://espn.com/b"}}},
    {"headline": "Podziemski taking more shots", "story": "a repeat", "published": "2026-10-31T21:00:00Z"},
    {"headline": "Old news", "story": "from last season", "published": "2026-04-01T00:00:00Z"},
    {"headline": "", "story": "", "published": "2026-11-01T00:00:00Z"},
]}


class NewsItemsTests(unittest.TestCase):
    def test_reads_espns_feed(self):
        items = player_news.news_items(FEED, NOW)
        # Newest first; the repeat, the old one and the empty one are left out.
        self.assertEqual([item["headline"] for item in items], ["Curry out Saturday", "Podziemski taking more shots"])
        self.assertEqual(items[1]["text"][:28], "Brandin Podziemski said he i")
        self.assertNotIn("<p>", items[1]["text"])
        self.assertEqual((items[1]["link"], items[1]["source"], items[0]["source"]), ("https://espn.com/a", "RotoWire", "ESPN"))
        self.assertEqual(player_news.news_items({"unexpected": 1}, NOW), [])

    def test_the_nfls_ids_go_through_its_rosters(self):
        from backend.sports.nfl import finder
        with patch.object(finder, "espn_ids", return_value={"00-0039918": "4431611"}) as ids:
            self.assertEqual(player_news.espn_id("nfl", "00-0039918", NOW), "4431611")
        ids.assert_called_once_with(2026)
        self.assertEqual(player_news.espn_id("nba", "4433255"), "4433255")


class NotesTests(unittest.TestCase):
    def setUp(self):
        self.items = player_news.news_items(FEED, NOW)

    def test_notes_point_at_real_items(self):
        answer = {"read": "<b>Curry</b> is out, so Podziemski should shoot more.",
                  "notes": [{"item": 2, "text": "Says he is trying to take as many shots as he can", "tone": "up"},
                            {"item": 1, "text": "Curry out tonight", "tone": "sideways"},
                            {"item": 9, "text": "made up", "tone": "up"}, {"item": "x", "text": "no item"}, {"item": 1, "text": ""}]}
        cleaned = player_news.clean_notes(answer, self.items)
        self.assertEqual(cleaned["read"], "Curry is out, so Podziemski should shoot more.")
        self.assertEqual([(note["text"][:9], note["tone"], note["link"]) for note in cleaned["notes"]],
                         [("Says he i", "up", "https://espn.com/a"), ("Curry out", "flat", "https://espn.com/b")])
        # The date is the item's, never the model's.
        self.assertEqual(cleaned["notes"][0]["published"], self.items[1]["published"])

    def test_read_asks_once_then_keeps_it(self):
        kept = {}
        store = type("Store", (), {"get": lambda self, key: kept.get(key), "set": lambda self, key, value: kept.__setitem__(key, value)})()
        asked = []
        def ask(prompt):
            asked.append(prompt)
            return {"read": "Curry out; more shots for him.", "notes": [{"item": 2, "text": "More shots", "tone": "up"}]}
        with patch.object(player_news, "espn_news", return_value=self.items):
            first = player_news.read("nba", "4433255", "Brandin Podziemski", "GSW", "Points", 16.5, "Nov 1", ask=ask, store=store)
            again = player_news.read("nba", "4433255", "Brandin Podziemski", "GSW", "Points", 16.5, "Nov 1", ask=ask, store=store)
        self.assertEqual((first["summarized"], first["items"], first["read"]), (True, 2, "Curry out; more shots for him."))
        self.assertEqual(again, first)
        self.assertEqual(len(asked), 1)
        # The prompt names the player and the line, and holds only the items.
        self.assertIn("Brandin Podziemski (GSW), Points over 16.5, game Nov 1", asked[0])
        self.assertIn("[2] (2026-10-31) Podziemski taking more shots.", asked[0])
        self.assertTrue(json.loads(next(iter(kept.values())))["value"]["notes"])

    def test_without_a_model_the_headlines_show(self):
        with patch.object(player_news, "espn_news", return_value=self.items):
            found = player_news.read("nba", "1", "P", ask=lambda prompt: None, store=None)
            broken = player_news.read("nba", "2", "P", ask=lambda prompt: 1 / 0, store=None)
        self.assertEqual((found["summarized"], [note["text"] for note in found["notes"]]), (False, ["Curry out Saturday", "Podziemski taking more shots"]))
        self.assertEqual(broken["notes"], found["notes"])
        with patch.object(player_news, "espn_news", return_value=[]):
            self.assertEqual(player_news.read("nba", "3", "P", ask=lambda prompt: {"read": "x"}, store=None),
                             {"read": None, "notes": [], "items": 0, "summarized": False})


if __name__ == "__main__":
    unittest.main()
