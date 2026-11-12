"""DraftKings' NBA player props (book_props.py): reading the feed, the fair
over chance and the cache."""
import json
import unittest

import book_props as bp


def feed(markets, selections, subcategories=None, categories=None):
    return {"events": [{"id": "e1"}], "markets": markets, "selections": selections,
            "subcategories": subcategories or [], "categories": categories or []}


def market(mid, name, kind, sub="s1"):
    return {"id": mid, "eventId": "e1", "name": name, "marketType": {"name": kind}, "subcategoryId": sub}


def pick(mid, label, line, price, player=None):
    out = {"marketId": mid, "label": label, "points": line, "displayOdds": {"american": price}}
    if player:
        out["participants"] = [{"name": player, "type": "Player"}]
    return out


class ReadTests(unittest.TestCase):
    def test_stats_combos_first(self):
        self.assertEqual(bp.stat_of("Points O/U"), "pts")
        self.assertEqual(bp.stat_of("Pts + Reb + Ast O/U"), "pra")
        self.assertEqual(bp.stat_of("Points + Rebounds O/U"), "pr")
        self.assertEqual(bp.stat_of("Pts + Ast O/U"), "pa")
        self.assertEqual(bp.stat_of("Threes O/U"), "tpm")
        self.assertEqual(bp.stat_of("3-Pointers Made O/U"), "tpm")
        self.assertIsNone(bp.stat_of("Steals + Blocks O/U"))
        self.assertEqual(bp.stat_of("Blocks O/U"), "blk")

    def test_prices_and_the_fair_chance(self):
        self.assertEqual(bp.american("−150"), -150)
        self.assertEqual(bp.american("+130"), 130)
        self.assertEqual(bp.american("EVEN"), 100)
        self.assertIsNone(bp.american("5"))
        self.assertAlmostEqual(bp.fair(-110, -110), 0.5)
        # -150 / +120: 60% and 45.5% before the cut, 56.9% after.
        self.assertAlmostEqual(bp.fair(-150, 120), 0.6 / (0.6 + 100 / 220), places=4)

    def test_names(self):
        self.assertEqual(bp.name_key("Luka Dončić"), "lukadoncic")
        self.assertEqual(bp.name_key("Jaren Jackson Jr."), bp.name_key("Jaren Jackson"))

    def test_parse_over_unders_only(self):
        payload = feed(
            [market("m1", "Jalen Brunson Points O/U", "Points O/U"), market("m2", "Jalen Brunson Points 25+", "Points Milestones"),
             market("m3", "Josh Hart Pts + Reb + Ast O/U", "Pts + Reb + Ast O/U")],
            [pick("m1", "Over", 26.5, "−140", "Jalen Brunson"), pick("m1", "Under", 26.5, "+110", "Jalen Brunson"),
             pick("m2", "25+", None, "−200", "Jalen Brunson"),
             pick("m3", "Over", 24.5, "−115"), pick("m3", "Under", 24.5, "−105")])
        rows = bp.parse(payload)
        self.assertEqual(sorted((row["player"], row["stat"], row["line"]) for row in rows),
                         [("Jalen Brunson", "pts", 26.5), ("Josh Hart", "pra", 24.5)])
        found = bp.collect(rows)
        self.assertEqual(found["jalenbrunson"]["pts"][:3], [26.5, -140, 110])
        self.assertGreater(found["jalenbrunson"]["pts"][3], 0.55)

    def test_main_line_is_the_one_nearest_even(self):
        rows = [{"player": "A B", "stat": "pts", "line": 20.5, "over": -110, "under": -110},
                {"player": "A B", "stat": "pts", "line": 24.5, "over": 250, "under": -350}]
        self.assertEqual(bp.collect(rows)["ab"]["pts"][0], 20.5)

    def test_subcategories_are_read(self):
        league = {"categories": [{"id": 1215, "name": "Player Points"}, {"id": 4, "name": "Game Lines"}]}
        first = feed([market("m1", "Jalen Brunson Points O/U", "Points O/U", sub="11")],
                     [pick("m1", "Over", 26.5, "−110"), pick("m1", "Under", 26.5, "−110")],
                     subcategories=[{"id": 11, "categoryId": 1215, "name": "Points O/U"}, {"id": 12, "categoryId": 1215, "name": "Threes O/U"},
                                    {"id": 13, "categoryId": 1215, "name": "Points Milestones"}])
        threes = feed([market("t1", "Jalen Brunson Threes O/U", "Threes O/U", sub="12")],
                      [pick("t1", "Over", 2.5, "+120"), pick("t1", "Under", 2.5, "−150")])
        asked = []

        class Reply:
            def __init__(self, body):
                self.body = body

            def raise_for_status(self):
                if self.body is None:
                    raise RuntimeError("down")

            def json(self):
                return self.body

        def get(url, headers=None, timeout=None):
            asked.append(url.replace(bp.BASE, ""))
            return Reply({"": league, "/categories/1215": first, "/categories/1215/subcategories/12": threes}.get(url.replace(bp.BASE, "")))

        rows = bp.read(get)
        self.assertEqual(sorted((row["stat"], row["line"]) for row in rows), [("pts", 26.5), ("tpm", 2.5)])
        self.assertIn("/categories/1215/subcategories/12", asked)
        self.assertNotIn("/categories/1215/subcategories/13", asked)
        self.assertNotIn("/categories/4", asked)

    def test_cache_and_a_dead_feed(self):
        bp._memory.clear()
        kept = {}
        value = bp.props(kv_get=kept.get, kv_set=lambda key, text, ex=None: kept.update({key: text}),
                         get=lambda *a, **k: (_ for _ in ()).throw(RuntimeError("blocked")), now=1000)
        self.assertEqual(value["players"], {})
        self.assertEqual(kept, {})  # nothing kept from a dead feed
        bp._memory.clear()
        kept[bp.KV_KEY] = json.dumps({"at": 900, "players": {"ab": {"pts": [20.5, -110, -110, 0.5]}}})
        self.assertEqual(bp.props(kv_get=kept.get, now=1000)["players"]["ab"]["pts"][0], 20.5)
        bp._memory.clear()


if __name__ == "__main__":
    unittest.main()
