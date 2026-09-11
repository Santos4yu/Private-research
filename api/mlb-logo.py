"""Same-origin MLB team-logo response for canvas-based share exports."""

from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

import requests


MLB_TEAM_IDS = {
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
    118, 119, 120, 121, 133, 134, 135, 136, 137, 138,
    139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
}


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        raw_id = parse_qs(urlparse(self.path).query).get("teamId", [""])[0]
        try:
            team_id = int(raw_id)
        except (TypeError, ValueError):
            return self._error(400, b"Invalid team ID")
        if team_id not in MLB_TEAM_IDS:
            return self._error(404, b"Unknown MLB team")
        try:
            response = requests.get(
                f"https://www.mlbstatic.com/team-logos/{team_id}.svg",
                timeout=8,
                headers={"User-Agent": "KrazyData/1.0"},
            )
            response.raise_for_status()
        except requests.RequestException:
            return self._error(502, b"Logo unavailable")
        self.send_response(200)
        self.send_header("Content-Type", "image/svg+xml")
        self.send_header("Cache-Control", "public, max-age=86400, s-maxage=604800")
        self.send_header("Content-Length", str(len(response.content)))
        self.end_headers()
        self.wfile.write(response.content)

    def _error(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

