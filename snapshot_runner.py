"""The prop snapshot job (.github/workflows/nba-prop-snapshot.yml, Phase 0
of the NBA prop model work, prop_snapshots.py): GitHub's signed token for
that workflow, on this repository's main branch (github_oidc.py), lets it
read the NBA data a member's Props tab reads and post the grades it works
out. Nothing else: no admin rights, no member's account, no stored secret.

A run makes a few dozen requests with the same token, so a token once
verified is remembered until it expires."""
from __future__ import annotations

import hashlib
import time

AUDIENCE = "aceprops-nba-prop-snapshot"
WORKFLOW = "nba-prop-snapshot.yml"
HEADER = "X-GitHub-OIDC"

_verified: dict = {}


def verified(headers) -> bool:
    """Whether the request carries the snapshot job's current signed token."""
    token = str((headers.get(HEADER) if headers else "") or "")
    if not token:
        return False
    digest = hashlib.sha256(token.encode()).hexdigest()
    now = time.time()
    expires = _verified.get(digest)
    if expires and expires > now:
        return True
    import github_oidc
    claims = github_oidc.verify(token, audience=AUDIENCE, workflow=WORKFLOW)
    if not claims:
        return False
    try:
        expires = float(claims.get("exp") or 0)
    except (TypeError, ValueError):
        expires = 0
    if len(_verified) > 64:
        _verified.clear()
    _verified[digest] = min(expires, now + 15 * 60)
    return True
