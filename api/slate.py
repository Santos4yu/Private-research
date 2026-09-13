"""
Vercel serverless function for the Attack Board (today's starting-pitcher
matchup difficulty ranking).

Mirrors api/prediction.py's platform-wrapper pattern -- all logic lives in
prediction_core.compute_slate() so it stays in sync with the Discord bot's
/slate command (same underlying stats_mlb data).
"""

import json
import sys
import time
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prediction_core import compute_slate, compute_tool  # noqa: E402
from auth_core import session_with_live_access  # noqa: E402

_CACHE = {}
_CACHE_SECONDS = {
    "weather": 300,
    "attack": 600,
    "parks": 1800,
    "platoon": 900,
    "bvp": 1800,
    "strikeouts": 900,
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        from site_controls import allowed
        if not allowed(self.headers,'slate'):
            return self._send(503, {"error":"This section is temporarily unavailable", "featureDisabled":True})
        if not session_with_live_access(self.headers):
            return self._send(401, {"error": "Sign in with Discord to use live research.", "authRequired": True})

        try:
            query = parse_qs(urlparse(self.path).query)
            tool = query.get("tool", ["attack"])[0]
            force_refresh = "refresh" in query
            cached = _CACHE.get(tool)
            cache_seconds = _CACHE_SECONDS.get(tool, 600)
            if not force_refresh and cached and time.time() - cached[0] < cache_seconds:
                result = cached[1]
            else:
                result = compute_slate() if tool == "attack" else compute_tool(tool)
                _CACHE[tool] = (time.time(), result)
        except Exception as exc:  # noqa: BLE001 — never leak a stack trace to the client
            return self._send(500, {"error": f"Slate lookup failed: {exc}"})

        return self._send(200, result)

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "private, max-age=180, stale-while-revalidate=600")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
