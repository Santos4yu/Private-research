"""Warm-process NFL protection. No session tokens, queries or identities are logged."""
from collections import OrderedDict
import hashlib
import logging
import threading
import time

LOG = logging.getLogger('vortex.nfl')
_buckets = OrderedDict()
_lock = threading.Lock()

def allow(headers, resource, now=None):
    now = time.monotonic() if now is None else now
    # Hash used only in memory; never recorded. Auth is checked before this guard.
    identity = hashlib.sha256(headers.get('Cookie', '').encode()).hexdigest()
    group = 'heavy' if resource in ('projection', 'distribution', 'matchup', 'opportunity', 'props', 'reception-logs', 'research-board') else 'read'
    key = (identity, group)
    limit = 40 if group == 'heavy' else 120
    with _lock:
        started, count = _buckets.pop(key, (now, 0))
        if now - started >= 60: started, count = now, 0
        permitted = count < limit
        _buckets[key] = (started, count + 1)
        if len(_buckets) > 2048: _buckets.popitem(last=False)
    if not permitted: event('rate_limit', resource)
    return permitted

def event(kind, resource):
    # Both are server constants/allowlisted resources, never exception messages.
    LOG.warning('nfl_event=%s resource=%s', kind, resource)
