"""Same-origin images for canvas-based share exports.

A canvas can only be saved when every picture drawn on it is same-origin
(or its host allows it, which the leagues' image hosts don't), so share
pictures load their logos and headshots through here:

GET ?teamId=147        -- an MLB team logo
GET ?src=https://...   -- a player headshot or team logo from one of the
                          leagues' own image hosts (IMAGE_HOSTS), nothing else

It's one function rather than a new one because the deployment is at
Vercel's function limit (see api/v2-admin.py).
"""

from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urljoin, urlparse

import requests


MLB_TEAM_IDS = {
    108, 109, 110, 111, 112, 113, 114, 115, 116, 117,
    118, 119, 120, 121, 133, 134, 135, 136, 137, 138,
    139, 140, 141, 142, 143, 144, 145, 146, 147, 158,
}
# Where the site's headshots and logos come from; a host is allowed with any
# of its subdomains.
IMAGE_HOSTS = ("espncdn.com", "mlbstatic.com", "nhle.com", "nfl.com", "nba.com", "wnba.com", "prizepicks.com")
MAX_BYTES = 3 * 1024 * 1024
MAX_HOPS = 3


def allowed(url):
    """Whether `url` is an https image on one of IMAGE_HOSTS."""
    parsed = urlparse(str(url or ""))
    host = (parsed.hostname or "").lower()
    return parsed.scheme == "https" and any(host == name or host.endswith("." + name) for name in IMAGE_HOSTS)


def fetch_image(url):
    """(bytes, content type) of an allowed image, following a redirect only
    to another allowed host; None when it isn't one or can't be had."""
    for _ in range(MAX_HOPS):
        if not allowed(url):
            return None
        try:
            response = requests.get(url, timeout=8, headers={"User-Agent": "PropScout/1.0"}, allow_redirects=False, stream=True)
        except requests.RequestException:
            return None
        if response.is_redirect:
            url = urljoin(url, response.headers.get("Location", ""))
            continue
        kind = (response.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if response.status_code != 200 or not kind.startswith("image/"):
            return None
        body = response.raw.read(MAX_BYTES + 1, decode_content=True)
        return (body, kind) if len(body) <= MAX_BYTES else None
    return None


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        source = query.get("src", [""])[0]
        if source:
            found = fetch_image(source)
            if not found:
                return self._error(404 if not allowed(source) else 502, b"Image unavailable")
            return self._image(*found)
        raw_id = query.get("teamId", [""])[0]
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
        return self._image(response.content, "image/svg+xml")

    def _image(self, body, kind):
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Cache-Control", "public, max-age=86400, s-maxage=604800")
        self.send_header("X-Content-Type-Options", "nosniff")
        # Served from this site, an SVG opened on its own must not run anything.
        self.send_header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
