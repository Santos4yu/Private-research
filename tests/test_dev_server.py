"""The one-server copy of the site (dev_server.py: Render's Dockerfile and a
PC): vercel.json's address rules and daily jobs, run without Vercel."""
import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load():
    spec = importlib.util.spec_from_file_location("dev_server_under_test", ROOT / "dev_server.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class DevServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = load()

    def test_vercel_rewrites(self):
        rewrite = self.server._rewrite
        self.assertEqual(rewrite("/api/auth/login?next=1"), "/api/session?action=login&next=1")
        self.assertEqual(rewrite("/api/whop/webhook"), "/api/session?action=whop-webhook")
        self.assertEqual(rewrite("/api/nfl/board?week=3"), "/api/nfl?resource=board&week=3")
        self.assertEqual(rewrite("/api/wnba?resource=tonight"), "/api/wnba?resource=tonight")

    def test_every_api_file_has_a_route(self):
        routed = {path.split("/")[-1] for path in self.server.ROUTES}
        files = {path.stem for path in (ROOT / "api").glob("*.py")}
        self.assertEqual(files, routed)

    def test_every_daily_job_is_read_and_due_once_at_its_minute(self):
        jobs = self.server.daily_jobs()
        self.assertEqual(len(jobs), 24)
        hour, minute, path = jobs[0]
        done = set()
        at = datetime(2026, 11, 24, hour, minute, 5, tzinfo=timezone.utc)
        self.assertIn(path, self.server.due_jobs(jobs, at, done))
        # The same minute again (the loop wakes every 20 s): not twice.
        self.assertNotIn(path, self.server.due_jobs(jobs, at.replace(second=45), done))
        # A minute later: nothing for that job.
        later = at.replace(minute=(minute + 1) % 60)
        self.assertNotIn(path, self.server.due_jobs(jobs, later, done))


if __name__ == "__main__":
    unittest.main()
