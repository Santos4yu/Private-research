"""Authenticated, cached view of today's active PrizePicks pitcher lines."""

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from auth_core import session_with_live_access  # noqa: E402
from prizepicks_export_core import _fetch_projection_rows, _norm_stat  # noqa: E402


PITCHER_MARKETS = {
    "pitcherstrikeouts", "pitchingouts", "hitsallowed",
    "earnedrunsallowed", "pitcherwalks",
}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self._send(200, {})

    def do_GET(self):
        if not session_with_live_access(self.headers):
            return self._send(401, {
                "error": "Sign in with Discord to use live research.",
                "authRequired": True,
            })
        try:
            rows = [row for row in _fetch_projection_rows()
                    if _norm_stat(row.get("stat")) in PITCHER_MARKETS]
            rows.sort(key=lambda row: (
                0 if row.get("odds_type") == "goblin" else 1,
                str(row.get("player") or ""),
                str(row.get("stat") or ""),
                float(row.get("line") or 0),
            ))
            self._send(200, {"props": rows})
        except Exception as exc:
            self._send(502, {"error": f"Active pitcher lines are temporarily unavailable: {exc}"})

    def _send(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "private, max-age=60")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode("utf-8"))
