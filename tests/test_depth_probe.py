import base64
import json
import time
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding, rsa

import github_oidc
from backend.sports.wnba import depth_probe


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


class GitHubTokenTests(unittest.TestCase):
    def setUp(self):
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        numbers = self.key.public_key().public_numbers()
        self.jwk = {"kty": "RSA", "kid": "k1", "n": _b64(numbers.n.to_bytes(256, "big")), "e": _b64(numbers.e.to_bytes(3, "big"))}
        patcher = patch.object(github_oidc, "_fetch_keys", return_value={"k1": self.jwk})
        patcher.start()
        self.addCleanup(patcher.stop)
        github_oidc._keys.update(at=0.0, keys={})

    def token(self, key=None, **changes):
        now = time.time()
        claims = {"iss": github_oidc.ISSUER, "aud": "aceprops-nba-depth-test", "repository": "Santos4yu/Private-research",
                  "ref": "refs/heads/main", "workflow_ref": "Santos4yu/Private-research/.github/workflows/nba-depth-test.yml@refs/heads/main",
                  "iat": now, "nbf": now, "exp": now + 300}
        claims.update(changes)
        head = _b64(json.dumps({"alg": "RS256", "kid": "k1"}).encode())
        body = _b64(json.dumps(claims).encode())
        signature = (key or self.key).sign(f"{head}.{body}".encode(), padding.PKCS1v15(), hashes.SHA256())
        return f"{head}.{body}.{_b64(signature)}"

    def verify(self, token):
        return github_oidc.verify(token, audience="aceprops-nba-depth-test", workflow="nba-depth-test.yml")

    def test_genuine_token_from_this_workflow_passes(self):
        self.assertEqual(self.verify(self.token())["ref"], "refs/heads/main")

    def test_other_repository_branch_workflow_or_audience_fails(self):
        self.assertIsNone(self.verify(self.token(repository="someone/else")))
        self.assertIsNone(self.verify(self.token(ref="refs/heads/feature")))
        self.assertIsNone(self.verify(self.token(workflow_ref="Santos4yu/Private-research/.github/workflows/other.yml@refs/heads/main")))
        self.assertIsNone(self.verify(self.token(aud="someone-else")))
        self.assertIsNone(self.verify(self.token(iss="https://example.com")))

    def test_expired_or_not_yet_valid_fails(self):
        self.assertIsNone(self.verify(self.token(exp=time.time() - 600)))
        self.assertIsNone(self.verify(self.token(nbf=time.time() + 600)))

    def test_signed_by_another_key_or_tampered_fails(self):
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.assertIsNone(self.verify(self.token(key=other)))
        head, body, signature = self.token().split(".")
        forged = _b64(json.dumps({**json.loads(base64.urlsafe_b64decode(body + "==")), "repository": "x/y"}).encode())
        self.assertIsNone(self.verify(f"{head}.{forged}.{signature}"))
        self.assertIsNone(self.verify("not-a-token"))
        self.assertIsNone(self.verify(""))


class DepthChartTests(unittest.TestCase):
    def test_parses_the_site_api_shape(self):
        payload = {"depthchart": [{"name": "Depth Chart", "positions": {
            "pg": {"position": {"abbreviation": "PG"}, "athletes": [{"id": "1", "displayName": "A"}, {"id": "2", "displayName": "B"}]},
            "c": {"position": {"abbreviation": "C"}, "athletes": [{"id": "3", "displayName": "C"}]}}}]}
        self.assertEqual(depth_probe.parse(payload), {"pg": [(1, "1", "A"), (2, "2", "B")], "c": [(1, "3", "C")]})

    def test_parses_the_core_api_shape_with_athlete_links(self):
        payload = {"items": [{"positions": {"sf": {"position": {"abbreviation": "SF"}, "athletes": [
            {"slot": 1, "rank": 2, "athlete": {"$ref": "http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/athletes/4065648?lang=en"}}]}}}]}
        self.assertEqual(depth_probe.parse(payload), {"sf": [(2, "4065648", "")]})

    def test_nothing_usable_is_an_empty_chart(self):
        self.assertEqual(depth_probe.parse(None), {})
        self.assertEqual(depth_probe.parse({"error": "x"}), {})

    def test_highest_listing_wins_and_nobody_counts_twice(self):
        chart = {"sf": [(1, "7", "")], "pf": [(3, "7", ""), (1, "8", "")], "c": [(2, "8", "")]}
        self.assertEqual(depth_probe.place(chart, {}), {"7": ("sf", "listed"), "8": ("pf", "listed")})

    def test_a_tie_is_broken_only_by_espns_label_and_otherwise_left_unplaced(self):
        chart = {"pf": [(2, "5", ""), (2, "6", ""), (2, "9", "")], "c": [(2, "5", "")], "sf": [(2, "6", "")], "sg": [(2, "9", "")]}
        placed = depth_probe.place(chart, {"5": "C", "6": "F", "9": "C"})
        self.assertEqual(placed["5"], ("c", "label"))   # tied PF / C, ESPN says C
        self.assertEqual(placed["6"], (None, "tie"))     # tied PF / SF, both forwards: not guessed
        self.assertEqual(placed["9"], (None, "tie"))     # tied SG / PF, ESPN says C: fits neither


if __name__ == "__main__":
    unittest.main()
