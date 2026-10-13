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


class CutOffTests(unittest.TestCase):
    def test_a_pick_cut_off_at_the_stat_is_kept_to_fill_in(self):
        slip = slip_reader.normalize({"app": "PrizePicks", "legs": [
            {"player": "Bijan Robinson", "sport": "nfl", "stat": "Rush Yards", "line": 87.5, "side": "More"},
            {"player": "Miguel Vargas", "sport": "mlb", "stat": "", "line": None, "side": "More"},
            {"player": "Breanna Stewart", "sport": "wnba", "stat": "PRA", "line": 34.5, "side": "More"},
            {"player": "", "stat": "Hits", "line": 0.5, "side": "More"},
        ]})
        self.assertEqual([leg["player"] for leg in slip["legs"]], ["Bijan Robinson", "Miguel Vargas", "Breanna Stewart"])
        self.assertEqual(slip["legs"][1]["needs"], ["stat", "line"])
        self.assertEqual(slip["legs"][1]["side"], "OVER")
        self.assertEqual(slip["legs"][2]["needs"], [])


class ModelTests(unittest.TestCase):
    def test_vision_models_this_key_has_are_found_even_when_renamed(self):
        listing = SimpleNamespace(data=[SimpleNamespace(id=name) for name in (
            "llama-3.3-70b-versatile", "meta-llama/llama-4-scout-2026-instruct", "whisper-large-v3", "meta-llama/llama-guard-4-12b")])
        client = SimpleNamespace(models=SimpleNamespace(list=lambda: listing))
        slip_reader._available.update(at=0, ids=None)
        self.assertEqual(slip_reader.models_for(client, slip_reader.VISION_MODELS, True), ["meta-llama/llama-4-scout-2026-instruct"])
        self.assertEqual(slip_reader.models_for(client, slip_reader.TEXT_MODELS, False)[0], "llama-3.3-70b-versatile")
        # Groq's Qwen vision models, this one or a newer one, are found; its text-only Qwen is not.
        listing.data = [SimpleNamespace(id=name) for name in ("qwen/qwen3-32b", "qwen/qwen3.9-30b", "openai/gpt-oss-120b")]
        slip_reader._available.update(at=0, ids=None)
        try:
            self.assertEqual(slip_reader.models_for(client, slip_reader.VISION_MODELS, True), ["qwen/qwen3.9-30b"])
        finally:
            slip_reader._available.update(at=0, ids=None)
        # Without a listing, the named ones are tried.
        slip_reader._available.update(at=0, ids=None)
        broken = SimpleNamespace(models=SimpleNamespace(list=lambda: (_ for _ in ()).throw(RuntimeError("no"))))
        self.assertEqual(slip_reader.models_for(broken, slip_reader.VISION_MODELS, True), list(slip_reader.VISION_MODELS))
        slip_reader._available.update(at=0, ids=None)


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
        gone = "Error code: 404 - {'error': {'message': 'The model `x` does not exist or you do not have access to it.', 'type': 'invalid_request_error'}}"
        fake = FakeGroq(RuntimeError("down"), RuntimeError("down"), RuntimeError("down"), *[RuntimeError(gone)] * 2, "not json",
                        json.dumps({"legs": [{"player": "Aaron Judge", "stat": "Hits", "line": 0.5, "side": "over"}]}))

        async def ocr(data, mime):
            return "Aaron Judge Hits More 0.5"

        with patch.object(slip_reader, "_groq", return_value=fake), patch("analyze._ocr_image", ocr), patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
            slip = slip_reader.read_slip(PNG)
        self.assertEqual(slip["source"], "text")
        self.assertEqual(slip["legs"][0]["player"], "Aaron Judge")
        self.assertIn("Aaron Judge Hits More 0.5", fake.calls[-1]["messages"][0]["content"])
        # Qwen is asked to keep its reasoning to itself; a retired model is asked once, not once per mode.
        self.assertEqual(fake.calls[0]["model"], "qwen/qwen3.8-27b")
        self.assertEqual(fake.calls[0]["reasoning_format"], "hidden")
        self.assertEqual([call["model"] for call in fake.calls[3:5]], ["qwen/qwen3.6-27b", "meta-llama/llama-4-scout-17b-16e-instruct"])
        # Each reason is short, and a missing Gemini key is named.
        self.assertIn("Groq qwen/qwen3.6-27b: RuntimeError: 404 The model `x` does not exist", slip["detail"])
        self.assertNotIn("invalid_request_error", slip["detail"])
        self.assertIn("Gemini: GEMINI_API_KEY is not set", slip["detail"])

    def test_reasoning_before_the_json_is_ignored(self):
        self.assertEqual(slip_reader.parse_json('<think>the slip has {three} legs</think>{"legs": [1, 2, 3]}'), {"legs": [1, 2, 3]})

    def test_clear_errors(self):
        self.assertIn("PNG", slip_reader.read_slip(b"GIF89a....")["error"])
        with patch.object(slip_reader, "_groq", return_value=None):
            self.assertEqual(slip_reader.read_slip(PNG)["reason"], "no-key")
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


class GeminiTests(unittest.TestCase):
    def setUp(self):
        slip_reader._gemini_available.update(at=0, names=None)

    def test_gemini_reads_the_slip_when_groq_cannot(self):
        calls = []

        class Response:
            def __init__(self, status, payload):
                self.status_code, self.payload, self.ok, self.text = status, payload, status < 400, json.dumps(payload)

            def json(self):
                return self.payload

        def get(url, headers=None, params=None, timeout=None):
            return Response(200, {"models": [
                {"name": "models/gemini-3.0-flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-2.0-flash", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/gemini-2.0-flash-preview-image-generation", "supportedGenerationMethods": ["generateContent"]},
                {"name": "models/text-embedding-004", "supportedGenerationMethods": ["embedContent"]}]})

        def post(url, json=None, headers=None, timeout=None):
            calls.append((url, headers, json))
            if "3.0" in url:
                return Response(429, {"error": {"message": "Quota exceeded for key AIzaSyFAKEKEY1234567890"}})
            return Response(200, {"candidates": [{"content": {"parts": [{"text": __import__("json").dumps(PRIZEPICKS)}]}}]})

        groq = FakeGroq(*[RuntimeError("model_not_found")] * 8)
        with patch.object(slip_reader, "_groq", return_value=groq), patch.dict("os.environ", {"GEMINI_API_KEY": "g-key"}), \
             patch("requests.get", get), patch("requests.post", post):
            slip = slip_reader.read_slip(PNG)
        self.assertEqual(slip["source"], "vision")
        self.assertEqual(len(slip["legs"]), 3)
        self.assertIn("model_not_found", slip["detail"])
        # The newest Flash first; the key goes in a header, never the address.
        self.assertIn("gemini-3.0-flash", calls[0][0])
        self.assertIn("gemini-2.0-flash:generateContent", calls[1][0])
        self.assertEqual(calls[1][1]["x-goog-api-key"], "g-key")
        self.assertNotIn("key=", calls[1][0])
        part = calls[1][2]["contents"][0]["parts"][1]["inline_data"]
        self.assertEqual(part["mime_type"], "image/png")

    def test_when_every_reader_fails_the_reasons_are_kept_without_keys(self):
        class Response:
            ok, status_code = False, 403

            def json(self):
                return {"error": {"message": "API key AIzaSyFAKEKEY1234567890 not valid"}}

        async def ocr(data, mime):
            return {"error": "OCR API returned 403"}

        groq = FakeGroq(*[RuntimeError("Invalid API Key gsk_abcdefghijklmnop")] * 12)
        with patch.object(slip_reader, "_groq", return_value=groq), patch.dict("os.environ", {"GEMINI_API_KEY": "g-key"}), \
             patch("requests.get", lambda *a, **k: Response()), patch("requests.post", lambda *a, **k: Response()), \
             patch("analyze._ocr_image", ocr):
            slip = slip_reader.read_slip(PNG)
        self.assertEqual(slip["reason"], "models")
        self.assertIn("Groq", slip["detail"])
        self.assertIn("Gemini gemini-2.5-flash: HTTP 403", slip["detail"])
        self.assertIn("OCR", slip["detail"])
        self.assertNotIn("gsk_abc", slip["detail"])
        self.assertNotIn("AIzaSy", slip["detail"])

    def test_only_an_admin_sees_why(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("prediction_api2", Path(__file__).resolve().parents[1] / "api" / "prediction.py")
        api = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(api)
        failed = {"error": "Reading slips is unavailable right now.", "reason": "models", "detail": "Groq x: 404"}
        with patch.object(slip_reader, "read_slip", return_value=failed):
            self.assertEqual(api._analyze_slip(PNG), (503, {"error": failed["error"]}))
            self.assertEqual(api._analyze_slip(PNG, admin=True)[1]["detail"], "Groq x: 404")
        # Read by a backup reader: the slip reads fine, so nobody sees the
        # readers that were passed over (the server log keeps them).
        read = {"legs": [{"player": "A"}], "source": "text", "detail": "Groq vision: 400"}
        with patch.object(slip_reader, "read_slip", side_effect=lambda data: dict(read)):
            self.assertNotIn("detail", api._analyze_slip(PNG)[1])
            self.assertNotIn("detail", api._analyze_slip(PNG, admin=True)[1])


class ReaderRegressionTests(unittest.TestCase):
    def test_known_catalog_without_vision_does_not_retry_missing_models(self):
        client = SimpleNamespace(models=SimpleNamespace(list=lambda: SimpleNamespace(data=[SimpleNamespace(id="llama-3.3-70b-versatile")])))
        with patch.dict(slip_reader._available, {"at":0,"ids":None}):
            self.assertEqual(slip_reader.models_for(client, slip_reader.VISION_MODELS, True), [])

    def test_current_qwen_vision_model_discovered(self):
        client = SimpleNamespace(models=SimpleNamespace(list=lambda: SimpleNamespace(data=[SimpleNamespace(id="qwen/qwen3.8-27b")])))
        with patch.dict(slip_reader._available, {"at":0,"ids":None}):
            self.assertEqual(slip_reader.models_for(client, slip_reader.VISION_MODELS, True), ["qwen/qwen3.8-27b"])

    def test_ocr_two_buttons_requires_side_confirmation(self):
        async def ocr(*args): return "Austin Hooper 1.5 Rec Targets More Less Chris Sale 4.5 Ks More Less"
        parsed = {"legs":[{"player":"Chris Sale","stat":"Ks","line":4.5,"side":"under","modifier":"goblin"}]}
        def run(coro):
            coro.close()
            return "Austin Hooper 1.5 Rec Targets More Less Chris Sale 4.5 Ks More Less"
        with patch.dict(sys.modules, {"analyze":SimpleNamespace(_ocr_image=ocr)}), patch("asyncio.run",side_effect=run), patch.object(slip_reader,"_ask",return_value=parsed):
            result = slip_reader.normalize(slip_reader._read_text(PNG))
        self.assertIsNone(result["legs"][0]["side"])
        self.assertIn("side", result["legs"][0]["needs"])
        self.assertEqual(result["legs"][0]["line"],4.5)


class StatTextTests(unittest.TestCase):
    def test_a_side_and_line_read_into_the_stat_move_to_their_own_fields(self):
        from slip_reader import normalize_leg
        leg = normalize_leg({"player": "Tre Tucker", "stat": "Higher 3.5 Receptions"})
        self.assertEqual((leg["stat"], leg["line"], leg["side"]), ("Receptions", 3.5, "OVER"))
        leg = normalize_leg({"player": "Jayson Tatum", "stat": "Points Less", "line": 26.5})
        self.assertEqual((leg["stat"], leg["line"], leg["side"]), ("Points", 26.5, "UNDER"))
        # A side already read wins; stats that only start with a number stay whole.
        leg = normalize_leg({"player": "Steph Curry", "stat": "3 Pointers Made", "line": 4.5, "side": "under"})
        self.assertEqual((leg["stat"], leg["side"]), ("3 Pointers Made", "UNDER"))
        leg = normalize_leg({"player": "Mike Washington Jr.", "stat": "25+ Rush Yards"})
        self.assertEqual((leg["stat"], leg["line"], leg["side"]), ("25+ Rush Yards", 24.5, "OVER"))

    def test_nfl_stats_printed_with_a_threshold_or_side_find_their_market(self):
        from backend.sports.nfl import markets
        for stat, market in (("25+ Rush Yards", "rushing_yards"), ("4+ Receptions", "receptions"),
                             ("Higher 3.5 Receptions", "receptions"), ("Receiving Yards 60+", "receiving_yards")):
            self.assertEqual(markets.market_for(stat, "WR"), market, stat)
