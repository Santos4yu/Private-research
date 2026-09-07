"""
Vercel serverless function for player-name autocomplete.

Returns a cached MLB roster for immediate client-side autocomplete,
or substring matches for clients without the catalog yet. Deliberately
does not import the prediction engine.
"""

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from live_props_core import search_players, player_catalog  # noqa: E402
from auth_core import session_from_request_headers  # noqa: E402


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        if not session_from_request_headers(self.headers):
            return self._send(401, {"error": "Sign in with Discord to search players.", "authRequired": True})

        qs = parse_qs(urlparse(self.path).query)
        query = (qs.get("q", [""])[0]).strip()

        try:
            results = player_catalog() if qs.get("catalog") == ["1"] else search_players(query)
        except Exception as exc:  # noqa: BLE001
            return self._send(500, {"error": f"Player search failed: {exc}"})

        return self._send(200, {"players": results})

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
