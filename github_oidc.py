"""GitHub Actions' signed identity (OIDC), for the few backend actions one
workflow in this repository may call (Nov 18: the NBA depth-chart test,
backend/sports/wnba/depth_probe.py).

A job with `permissions: id-token: write` asks GitHub for a short-lived
token. GitHub signs it (RS256) with keys it publishes at JWKS. Here the
signature is checked against those keys, then the claims: GitHub issued it,
for our audience, from this repository's main branch and the one workflow
file allowed, and it hasn't expired. There is no shared secret to store,
rotate or leak, and a workflow in any other repository (or branch, or file)
gets a token that fails these checks.
"""
from __future__ import annotations

import base64
import json
import time

import requests

ISSUER = "https://token.actions.githubusercontent.com"
JWKS = ISSUER + "/.well-known/jwks"
REPOSITORY = "santos4yu/private-research"
BRANCH = "refs/heads/main"
# Seconds of clock difference allowed between GitHub and us.
LEEWAY = 60
KEYS_SECONDS = 3600

_keys = {"at": 0.0, "keys": {}}


def _b64(part: str) -> bytes:
    return base64.urlsafe_b64decode(part + "=" * (-len(part) % 4))


def _fetch_keys() -> dict:
    data = requests.get(JWKS, timeout=5).json()
    return {key["kid"]: key for key in data.get("keys", []) if key.get("kty") == "RSA" and key.get("kid")}


def _key(kid: str):
    """GitHub's public key `kid`, re-read hourly, or when an unknown key shows
    up (GitHub rotating) -- at most once a minute, so made-up key ids can't
    make every request fetch GitHub's keys."""
    age = time.time() - _keys["at"]
    if age > KEYS_SECONDS or (kid not in _keys["keys"] and age > 60):
        _keys.update(at=time.time(), keys=_fetch_keys())
    return _keys["keys"].get(kid)


def _signed(head: str, body: str, signature: str, jwk: dict) -> bool:
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding, rsa
    numbers = rsa.RSAPublicNumbers(int.from_bytes(_b64(jwk["e"]), "big"), int.from_bytes(_b64(jwk["n"]), "big"))
    try:
        numbers.public_key().verify(_b64(signature), f"{head}.{body}".encode(), padding.PKCS1v15(), hashes.SHA256())
        return True
    except Exception:  # noqa: BLE001 -- any failure to verify is "not signed by GitHub"
        return False


def verify(token: str, *, audience: str, workflow: str, now: float | None = None) -> dict | None:
    """The token's claims when GitHub signed it for `audience`, from this
    repository's main branch and `.github/workflows/<workflow>`, and it is
    current; otherwise None."""
    try:
        head, body, signature = str(token or "").split(".")
        header, claims = json.loads(_b64(head)), json.loads(_b64(body))
    except Exception:  # noqa: BLE001 -- not a token at all
        return None
    if header.get("alg") != "RS256":
        return None
    try:
        jwk = _key(str(header.get("kid") or ""))
    except Exception:  # noqa: BLE001 -- GitHub's keys unreachable: nobody gets in
        return None
    if not jwk or not _signed(head, body, signature, jwk):
        return None
    now = time.time() if now is None else now
    audiences = claims.get("aud") if isinstance(claims.get("aud"), list) else [claims.get("aud")]
    expected = f"{REPOSITORY}/.github/workflows/{workflow}@{BRANCH}"
    try:
        current = float(claims.get("nbf", claims.get("iat", 0))) <= now + LEEWAY and float(claims.get("exp", 0)) > now - LEEWAY
    except (TypeError, ValueError):
        return None
    allowed = (claims.get("iss") == ISSUER and audience in audiences and current
               and str(claims.get("repository") or "").lower() == REPOSITORY
               and claims.get("ref") == BRANCH
               and str(claims.get("workflow_ref") or "").lower() == expected.lower())
    return claims if allowed else None
