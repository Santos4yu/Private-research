import unittest
from backend.sports.nfl.request_guard import allow

class GuardTests(unittest.TestCase):
    def test_paid_props_share_the_heavy_budget(self):
        headers={'Cookie':'test-only-paid-lines'}
        self.assertTrue(all(allow(headers,'props',now=0) for _ in range(40)))
        self.assertFalse(allow(headers,'props',now=1))
    def test_heavy_limit_and_recovery(self):
        headers={'Cookie':'test-only-heavy'}
        self.assertTrue(all(allow(headers,'distribution',now=0) for _ in range(40)))
        self.assertFalse(allow(headers,'distribution',now=1))
        self.assertTrue(allow(headers,'distribution',now=61))
    def test_independent_light_budget(self):
        headers={'Cookie':'test-only-light'}
        for _ in range(40): allow(headers,'projection',now=0)
        self.assertTrue(allow(headers,'players',now=0))
