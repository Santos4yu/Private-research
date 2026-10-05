import io
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
import slip_reader  # noqa: E402

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


class FakeGroq:
    """Answers chat.completions.create with queued replies (str or Exception)."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=reply))])


PRIZEPICKS = {
    "app": "PrizePicks", "entry_type": "Power Play", "stake": 10, "payout": 60, "payout_is_profit": False, "multiplier": None,
    "skipped": 0,
    "legs": [
        {"player": "Aaron Judge", "team": "NYY", "opponent": "BOS", "sport": "MLB", "stat": "Hits+Runs+RBIs",
         "stat_name": "Hits+Runs+RBIs", "line": 2.5, "plus": False, "side": "More", "modifier": "standard", "odds": None, "confidence": 0.95},
        {"player": "A'ja Wilson", "team": "LV", "sport": "wnba", "stat": "Pts+Rebs+Asts", "stat_name": "Pts+Rebs+Asts",
         "line": "38.5", "side": "Less", "modifier": "standard", "confidence": 0.9},
        {"player": "Cale Makar", "team": "COL", "sport": "hockey", "stat": "Shots On Goal", "line": 3.5, "side": "↑",
         "modifier": "Goblin", "confidence": 0.8},
    ],
}


class NormalizeTests(unittest.TestCase):
    def test_a_prizepicks_power_play_reads_each_pick_and_its_side(self):
        slip = slip_reader.normalize(PRIZEPICKS)
        self.assertEqual(slip["app"], {"key": "prizepicks", "name": "PrizePicks"})
        self.assertEqual(slip["entry"], {"type": "power", "stake": 10.0, "payout": 60.0, "multiplier": 6.0})
        judge, wilson, makar = slip["legs"]
        self.assertEqual((judge["player"], judge["sport"], judge["stat"], judge["line"], judge["side"]),
                         ("Aaron Judge", "mlb", "Hits+Runs+RBIs", 2.5, "OVER"))
        self.assertEqual((wilson["line"], wilson["side"], wilson["sport"]), (38.5, "UNDER", "wnba"))
        self.assertEqual((makar["sport"], makar["side"], makar["modifier"]), ("nhl", "OVER", "goblin"))
        self.assertTrue(all(leg["needs"] == [] for leg in slip["legs"]))

    def test_underdog_higher_lower_and_n_plus_legs(self):
        slip = slip_reader.normalize({"app": "Underdog Fantasy", "entry_type": "Flex", "legs": [
            {"player": "Josh Allen", "sport": "NFL", "stat": "Pass Yards", "line": 245.5, "side": "Higher"},
            {"player": "Shohei Ohtani", "sport": "mlb", "stat": "1+ Hits", "line": None, "side": ""},
            {"player": "Ja'Marr Chase", "sport": "nfl", "stat": "Anytime Touchdown", "line": 1, "plus": True, "side": "Yes"},
        ]})
        self.assertEqual(slip["app"]["key"], "underdog")
        self.assertEqual(slip["entry"]["type"], "flex")
        allen, ohtani, chase = slip["legs"]
        self.assertEqual((allen["line"], allen["side"]), (245.5, "OVER"))
        # "N+" is the Over on N - 0.5.
        self.assertEqual((ohtani["line"], ohtani["side"], ohtani["plus"]), (0.5, "OVER", True))
        self.assertEqual((chase["line"], chase["side"]), (0.5, "OVER"))

    def test_a_sportsbook_parlay_keeps_odds_and_profit_payouts(self):
        slip = slip_reader.normalize({"app": "FanDuel Sportsbook", "entry_type": "Same Game Parlay", "stake": 5,
                                      "payout": 47.5, "payout_is_profit": True, "skipped": 1, "legs": [
            {"player": "Connor McDavid", "sport": "nhl", "stat": "Points", "line": 1.5, "side": "Over", "odds": "-130"},
            {"player": "Leon Draisaitl", "sport": "nhl", "stat": "Shots on Goal", "line": 2.5, "side": "U", "odds": 105},
        ]})
        self.assertEqual(slip["app"]["key"], "fanduel")
        self.assertEqual(slip["entry"], {"type": "parlay", "stake": 5.0, "payout": 52.5, "multiplier": 10.5})
        self.assertEqual(slip["skipped"], 1)
        self.assertEqual([leg["odds"] for leg in slip["legs"]], [-130, 105])
        self.assertEqual(slip["legs"][1]["side"], "UNDER")

    def test_nothing_is_guessed(self):
        slip = slip_reader.normalize({"legs": [
            {"player": "Caitlin Clark", "sport": "wnba", "stat": "Assists", "line": 7.5, "side": ""},
            {"player": "Bijan Robinson", "sport": "nfl", "stat": "Rush Yards", "side": "Under"},
            {"player": "", "stat": "Points", "line": 20.5, "side": "over"},
            {"player": "Yankees", "stat": "", "line": -1.5, "side": "over"},
            {"player": "Caitlin Clark", "sport": "wnba", "stat": "Assists", "line": 7.5, "side": ""},
        ]})
        self.assertEqual([leg["player"] for leg in slip["legs"]], ["Caitlin Clark", "Bijan Robinson"])
        self.assertEqual(slip["legs"][0]["needs"], ["side"])
        self.assertEqual(slip["legs"][1]["needs"], ["line"])
        self.assertIsNone(slip["legs"][0]["side"])
        self.assertEqual(slip["entry"], {"type": None, "stake": None, "payout": None, "multiplier": None})
        self.assertIsNone(slip["app"])

    def test_answers_in_code_fences_or_with_prose_still_parse(self):
        self.assertEqual(slip_reader.parse_json('```json\n{"legs": []}\n```'), {"legs": []})
        self.assertEqual(slip_reader.parse_json('Here it is: {"legs": [1]} done'), {"legs": [1]})
        self.assertIsNone(slip_reader.parse_json("no json here"))


class ReadTests(unittest.TestCase):
    def test_the_vision_model_sees_the_image_and_answers_in_json(self):
        fake = FakeGroq(json.dumps(PRIZEPICKS))
        with patch.object(slip_reader, "_groq", return_value=fake):
            slip = slip_reader.read_slip(PNG)
        self.assertEqual(slip["source"], "vision")
        self.assertEqual(len(slip["legs"]), 3)
        call = fake.calls[0]
        self.assertEqual(call["model"], slip_reader.VISION_MODELS[0])
        self.assertEqual(call["response_format"], {"type": "json_object"})
        text, image = call["messages"][0]["content"]
        self.assertIn("More, Higher, Over", text["text"])
        self.assertTrue(image["image_url"]["url"].startswith("data:image/png;base64,"))

    def test_a_failing_model_falls_back_to_the_next_then_to_the_text(self):
        fake = FakeGroq(RuntimeError("down"), RuntimeError("down"), RuntimeError("gone"), "not json",
                        json.dumps({"legs": [{"player": "Aaron Judge", "stat": "Hits", "line": 0.5, "side": "over"}]}))

        async def ocr(data, mime):
            return "Aaron Judge Hits More 0.5"

        with patch.object(slip_reader, "_groq", return_value=fake), patch("analyze._ocr_image", ocr):
            slip = slip_reader.read_slip(PNG)
        self.assertEqual(slip["source"], "text")
        self.assertEqual(slip["legs"][0]["player"], "Aaron Judge")
        self.assertIn("Aaron Judge Hits More 0.5", fake.calls[-1]["messages"][0]["content"])

    def test_clear_errors(self):
        self.assertIn("PNG", slip_reader.read_slip(b"GIF89a....")["error"])
        with patch.object(slip_reader, "_groq", return_value=None):
            self.assertIn("unavailable", slip_reader.read_slip(PNG)["error"])
        with patch.object(slip_reader, "_groq", return_value=FakeGroq(json.dumps({"legs": [], "skipped": 2}))):
            self.assertIn("No player props", slip_reader.read_slip(PNG)["error"])

    def test_a_large_screenshot_is_shrunk_before_sending(self):
        from PIL import Image
        image = Image.effect_noise((1600, 3400), 90).convert("RGB")
        out = io.BytesIO()
        image.save(out, format="PNG")
        data = out.getvalue()
        self.assertGreater(len(data), slip_reader.MAX_IMAGE_BYTES)
        small, mime = slip_reader.fit_image(data)
        self.assertEqual(mime, "image/jpeg")
        self.assertLess(len(small), slip_reader.MAX_IMAGE_BYTES)
        self.assertLessEqual(max(Image.open(io.BytesIO(small)).size), slip_reader.MAX_SIDE)


class RouteTests(unittest.TestCase):
    def test_the_analyzer_returns_the_read_slip(self):
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "api"))
        import importlib.util
        spec = importlib.util.spec_from_file_location("prediction_api", Path(__file__).resolve().parents[1] / "api" / "prediction.py")
        api = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(api)
        with patch.object(slip_reader, "read_slip", return_value={"legs": [{"player": "x"}], "source": "vision"}):
            self.assertEqual(api._analyze_slip(PNG), (200, {"legs": [{"player": "x"}], "source": "vision"}))
        with patch.object(slip_reader, "read_slip", return_value={"error": "No player props were found"}):
            self.assertEqual(api._analyze_slip(PNG)[0], 422)


if __name__ == "__main__":
    unittest.main()
