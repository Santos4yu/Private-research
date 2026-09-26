import json
import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs,urlparse
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from auth_core import session_with_live_access
from mlb_matchup import get_matchup

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        from site_controls import allowed
        if not allowed(self.headers,'slate'):
            return self._send(503,{"error":"Research temporarily unavailable."})
        if not session_with_live_access(self.headers):
            return self._send(401,{"error":"Sign in to view MLB research."})
        query=parse_qs(urlparse(self.path).query)
        values=[query.get(k,[''])[0].strip() for k in ('team','opponent','startsAt')]
        if any(not value or len(value)>100 for value in values):
            return self._send(400,{"error":"Team, opponent and game start are required."})
        try:
            result=get_matchup(*values)
        except ValueError:
            return self._send(400,{"error":"Invalid game date or source response."})
        except Exception:
            return self._send(503,{"error":"ESPN predictor is temporarily unavailable."})
        self._send(200,result)
    def _send(self,status,result):
        self.send_response(status)
        self.send_header('Content-Type','application/json')
        self.send_header('Cache-Control','private, max-age=120' if status==200 else 'no-store')
        self.end_headers()
        self.wfile.write(json.dumps(result).encode())
