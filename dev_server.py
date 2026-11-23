"""
The whole site on one computer: the built pages (dist/, `npm run build`) and
every /api/* route on the REAL serverless handlers in api/, with the same
address rules as vercel.json (Nov 23, the owner: "how can i just deploy it
local rn", after Vercel paused the account). Run: `python dev_server.py 8080`
with the settings in a .env file beside it, then open http://localhost:8080.

Originally the local-only dev server for predictions-site.
Serves the static files AND proxies every /api/* route to the REAL Vercel
serverless handlers in api/ (BaseHTTPRequestHandler subclasses) -- so local
testing reflects exactly what's deployed, including the auth gate. Not used
in production; Vercel runs api/*.py directly. Dev tooling only.

(Previously routed prediction/players/team-insights through the
netlify/functions/*.py dict-shaped wrappers instead -- those never carried
the auth gate added to api/*.py, so local testing silently diverged from
production. netlify/functions/ is kept only as non-functional reference,
per this project's established note that Netlify doesn't support Python
functions at all.)
"""

import importlib.util as _ilu
import socketserver
import sys
import traceback
from http.server import SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

API_DIR = Path(__file__).parent / "api"

# The settings: one .env (or .env.local) beside this file, read before any
# handler loads. The site's modules look for theirs in different places
# (some one folder up), so a single file here covers them all.
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent / ".env.local")
except ImportError:
    pass


def _load_handler(rel_path: str):
    """Import an api/*.py handler module by file path -- needed because
    "team-insights.py" has a hyphen, not a valid `import` module name."""
    file_path = API_DIR / rel_path
    mod_name = "api_" + rel_path.replace("/", "_").replace("-", "_").replace(".py", "")
    spec = _ilu.spec_from_file_location(mod_name, file_path)
    mod = _ilu.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.handler


# All routes are Vercel-style: the handler classes ARE BaseHTTPRequestHandler
# subclasses with the identical do_GET(self) signature (self.path/headers/
# wfile/send_response, etc.), so calling the unbound method with OUR request
# instance as self works directly -- no need for a second real socket/request.
ROUTES = {
    "/api/prediction": _load_handler("prediction.py"),
    "/api/game-log-filters": _load_handler("game-log-filters.py"),
    "/api/players": _load_handler("players.py"),
    "/api/team-insights": _load_handler("team-insights.py"),
    "/api/slate": _load_handler("slate.py"),
    "/api/board": _load_handler("board.py"),
    "/api/v2-board": _load_handler("v2-board.py"),
    "/api/v2-admin": _load_handler("v2-admin.py"),
    "/api/nfl": _load_handler("nfl.py"),
    "/api/wnba": _load_handler("wnba.py"),
    "/api/session": _load_handler("session.py"),
    "/api/mlb-logo": _load_handler("mlb-logo.py"),
}


def _rewrite(path: str) -> str:
    """vercel.json's API rewrites, so links work the same as on the live site."""
    parsed = urlparse(path)
    query = ("&" + parsed.query) if parsed.query else ""
    parts = parsed.path.strip("/").split("/")
    if parsed.path.startswith("/api/auth/") and len(parts) == 3:
        return f"/api/session?action={parts[2]}{query}"
    if parsed.path == "/api/whop/webhook":
        return f"/api/session?action=whop-webhook{query}"
    if parsed.path.startswith("/api/nfl/") and len(parts) == 3:
        return f"/api/nfl?resource={parts[2]}{query}"
    return path


class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Production hardening. These headers do not pretend browser code can
        # be hidden, but they prevent framing, MIME sniffing, referrer leaks,
        # unnecessary browser capabilities, and accidental source caching.
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Resource-Policy", "same-site")
        if urlparse(self.path).path == "/index.html" or urlparse(self.path).path == "/":
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def _page_path(self):
        """A page address with no file behind it is the app (index.html), as
        vercel.json's last rewrite does; /results is its own page."""
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            return
        local = Path(self.translate_path(parsed.path))
        if parsed.path != "/" and not local.exists():
            self.path = "/results.html" if parsed.path == "/results" else "/index.html"

    def do_GET(self):
        try:
            self.path = _rewrite(self.path)
            request_path = urlparse(self.path).path
            route_cls = ROUTES.get(request_path)
            if not route_cls:
                self._page_path()
            if route_cls:
                # Naively calling route_cls.do_GET(self) breaks the moment
                # a handler uses its own helper methods (every api/*.py
                # handler has a `_send` method dev_server's own Handler
                # class doesn't define) -- AttributeError. Instead, merge
                # route_cls's methods onto this already-initialized
                # instance by swapping __class__ to a combined type (route
                # methods take priority via MRO); safe here since both are
                # BaseHTTPRequestHandler subclasses sharing the same
                # request-time attributes (wfile, rfile, path, headers...).
                self.__class__ = type("_DispatchHandler", (route_cls, self.__class__), {})
                route_cls.do_GET(self)
                return
            super().do_GET()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass  # client disconnected mid-response — not a server problem
        except Exception:
            traceback.print_exc()
            try:
                self.send_response(500)
                self.end_headers()
            except Exception:
                pass

    def do_POST(self):
        try:
            self.path = _rewrite(self.path)
            route_cls = ROUTES.get(urlparse(self.path).path)
            if route_cls:
                self.__class__ = type("_DispatchHandler", (route_cls, self.__class__), {})
                route_cls.do_POST(self)
                return
            self.send_response(404)
            self.end_headers()
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            pass
        except Exception:
            traceback.print_exc()
            try:
                self.send_response(500)
                self.end_headers()
            except Exception:
                pass

    def log_message(self, fmt, *args):
        # Don't let logging itself blow up on a dead connection.
        try:
            super().log_message(fmt, *args)
        except Exception:
            pass


if __name__ == "__main__":
    import os
    project_root = Path(__file__).parent
    # The built site (npm run build) when there is one, as the live site serves.
    static_root = project_root / "dist" if (project_root / "dist").is_dir() else project_root
    os.chdir(static_root)
    port = int(os.getenv("PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8793))
    print(f"PropScout running: open http://localhost:{port}", flush=True)
    ThreadingHTTPServer(("", port), Handler).serve_forever()
