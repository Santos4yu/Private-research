"""Share pictures' images through this site (api/mlb-logo.py ?src=): the
leagues' own image hosts only, nothing else."""
import importlib.util
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
spec = importlib.util.spec_from_file_location("image_proxy", Path(__file__).resolve().parents[1] / "api" / "mlb-logo.py")
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)


class Reply:
    def __init__(self, status=200, kind="image/png", body=b"png", location=None):
        self.status_code = status
        self.headers = {"Content-Type": kind, **({"Location": location} if location else {})}
        self.is_redirect = location is not None
        self.raw = io.BytesIO(body)
        self.raw.read = (lambda read: lambda size, decode_content=True: read(size))(self.raw.read)


class ProxyTests(unittest.TestCase):
    def test_only_the_leagues_image_hosts(self):
        for url in ("https://a.espncdn.com/i/headshots/nfl/players/full/1.png", "https://assets.nhle.com/mugs/nhl/x.png",
                    "https://img.mlbstatic.com/mlb-photos/x", "https://static.www.nfl.com/logos/LA.svg", "https://cdn.nba.com/x.png"):
            self.assertTrue(proxy.allowed(url), url)
        for url in ("http://a.espncdn.com/x.png", "https://evil.com/x.png", "https://espncdn.com.evil.com/x.png",
                    "https://notespncdn.com/x.png", "file:///etc/passwd", "https://169.254.169.254/latest", ""):
            self.assertFalse(proxy.allowed(url), url)

    def test_an_image_comes_back_with_its_type(self):
        with patch.object(proxy.requests, "get", return_value=Reply(kind="image/png; charset=binary", body=b"\x89PNG")):
            self.assertEqual(proxy.fetch_image("https://a.espncdn.com/x.png"), (b"\x89PNG", "image/png"))

    def test_a_redirect_is_followed_only_to_an_allowed_host(self):
        hops = [Reply(status=302, location="https://a.espncdn.com/y.png"), Reply(body=b"ok")]
        with patch.object(proxy.requests, "get", side_effect=hops) as get:
            self.assertEqual(proxy.fetch_image("https://a.espncdn.com/x.png"), (b"ok", "image/png"))
        self.assertEqual(get.call_count, 2)
        with patch.object(proxy.requests, "get", return_value=Reply(status=302, location="https://evil.com/x.png")) as get:
            self.assertIsNone(proxy.fetch_image("https://a.espncdn.com/x.png"))
        self.assertEqual(get.call_count, 1)

    def test_not_an_image_or_too_big_is_refused(self):
        with patch.object(proxy.requests, "get", return_value=Reply(kind="text/html", body=b"<html>")):
            self.assertIsNone(proxy.fetch_image("https://a.espncdn.com/x.png"))
        with patch.object(proxy.requests, "get", return_value=Reply(body=b"x" * (proxy.MAX_BYTES + 1))):
            self.assertIsNone(proxy.fetch_image("https://a.espncdn.com/x.png"))
        with patch.object(proxy.requests, "get") as get:
            self.assertIsNone(proxy.fetch_image("https://evil.com/x.png"))
        get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
