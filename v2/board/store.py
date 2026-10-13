"""Server-only website storage. Explicit Upstash or Supabase selection.

No automatic provider fallback: an empty replacement must never silently
replace visibility rules, authentication limits or admin settings. Supabase
requires the private SQL migration plus a verified original-data import.
"""
import os
import sys
import base64
import zlib
import threading
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[3] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / ".env.local")

KV_URL = os.getenv("KV_REST_API_URL", "")
KV_TOKEN = os.getenv("KV_REST_API_TOKEN", "")
TIMEOUT = 10
STORAGE_BACKEND = os.getenv('WEBSITE_STORAGE_BACKEND', 'upstash').strip().lower()
SUPABASE_URL = os.getenv('SUPABASE_URL', '').rstrip('/')
SUPABASE_STORAGE_KEY = os.getenv('SUPABASE_SECRET_KEY') or os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

# A test run never reaches the live site's storage. Earlier runs wrote fake
# players into it through the NFL cache and read them back, so tests failed
# by the order they ran in -- and live data held test rows. Tests that need
# storage patch in their own (KV_URL, SUPABASE_URL, requests).
# ("python -m unittest" names itself "...python.exe -m unittest" on Windows
# and ".../unittest/__main__.py" elsewhere.)
UNDER_TEST = 'unittest' in str(sys.argv[0] if sys.argv else '') or 'pytest' in sys.modules or os.getenv('ACE_TESTS') == '1'
if UNDER_TEST:
    KV_URL = KV_TOKEN = SUPABASE_URL = SUPABASE_STORAGE_KEY = ''
_CODEC = '~kd-storage-v1:'
_MAX_VALUE_BYTES = 8 * 1024 * 1024


def configured():
    if STORAGE_BACKEND == 'supabase':
        # Never substitute the browser/anonymous key for privileged storage.
        return bool(SUPABASE_URL.startswith('https://') and SUPABASE_STORAGE_KEY)
    return STORAGE_BACKEND == 'upstash' and bool(KV_URL and KV_TOKEN)


def _pack(value):
    value = str(value)
    raw = value.encode('utf-8')
    if len(raw) > _MAX_VALUE_BYTES:
        raise ValueError('Storage value is too large')
    if len(raw) >= 4096:
        compressed = base64.b64encode(zlib.compress(raw, 6)).decode('ascii')
        if len(compressed) + len(_CODEC) + 2 < len(raw):
            return _CODEC + 'z:' + compressed
    # Escape literal codec prefixes; original strings always round-trip.
    return _CODEC + 'r:' + value if value.startswith(_CODEC) else value


def _unpack(value):
    if not isinstance(value, str) or not value.startswith(_CODEC):
        return value
    encoded = value[len(_CODEC):]
    if encoded.startswith('r:'):
        return encoded[2:]
    if not encoded.startswith('z:'):
        raise StorageUnavailable()
    try:
        decoder = zlib.decompressobj()
        raw = decoder.decompress(base64.b64decode(encoded[2:], validate=True), _MAX_VALUE_BYTES + 1)
        if len(raw) > _MAX_VALUE_BYTES or not decoder.eof or decoder.unused_data:
            raise ValueError('Invalid compressed value')
        return raw.decode('utf-8')
    except (ValueError, zlib.error, UnicodeError):
        raise StorageUnavailable() from None

ODDS_KEY_STORAGE_KEY = "vortex_v2:odds_api_key"
BOARD_STORAGE_KEY = "vortex_v2:board_today"


class StorageUnavailable(RuntimeError):
    """Public-safe storage failure; never includes credentials or provider URLs."""
    def __init__(self, code="storage_unavailable", retry_after=15):
        self.code = code
        self.retry_after = retry_after
        message = ("Website storage has reached its service limit. The site owner must restore capacity before access can resume."
                   if code == "storage_capacity" else
                   "Website storage is temporarily unavailable. Please try again shortly.")
        super().__init__(message)

    def payload(self):
        return {"error": str(self), "code": self.code, "retryAfter": self.retry_after}


TOO_LARGE = "storage_request_too_large"
_state_lock = threading.RLock()
_blocked_until = 0
_failure = None
_read_cache = {}


def require_configured():
    if not configured():
        raise StorageUnavailable("storage_not_configured", 60)


def _request(method, path, *, timeout=TIMEOUT, _supabase=False, **kwargs):
    global _blocked_until, _failure
    require_configured()
    with _state_lock:
        if _failure and time.monotonic() < _blocked_until:
            raise StorageUnavailable(_failure.code, max(1, int(_blocked_until - time.monotonic()) + 1))
    try:
        url = SUPABASE_URL if _supabase else KV_URL.rstrip('/')
        headers = {'apikey': SUPABASE_STORAGE_KEY, 'Content-Type': 'application/json'} if _supabase else _headers()
        if _supabase and not SUPABASE_STORAGE_KEY.startswith('sb_secret_'):
            headers['Authorization'] = f'Bearer {SUPABASE_STORAGE_KEY}'
        response = getattr(requests, method)(url + path, headers=headers, timeout=timeout, **kwargs)
        if response.status_code == 413:
            raise StorageUnavailable(TOO_LARGE, 1)
        data = response.json()
        errors = [item.get('error') for item in data if isinstance(item, dict) and item.get('error')] if isinstance(data, list) else [data.get('error')] if isinstance(data, dict) and data.get('error') else []
        if errors or response.status_code >= 400:
            detail = (' '.join(str(item) for item in errors) + ' ' + str(data.get('message', '') if isinstance(data, dict) else '')).lower()
            if 'request size' in detail:
                raise StorageUnavailable(TOO_LARGE, 1)
            if 'website_storage_not_ready' in detail:
                raise StorageUnavailable('storage_migration_pending', 60)
            if 'plan limits' in detail or 'quota' in detail:
                raise StorageUnavailable("storage_capacity", 120)
            if response.status_code in (401, 403):
                raise StorageUnavailable("storage_access_rejected", 60)
            raise StorageUnavailable()
        if not isinstance(data, (dict, list)):
            raise StorageUnavailable()
        with _state_lock:
            _failure = None
            _blocked_until = 0
        return data
    except (requests.RequestException, ValueError, StorageUnavailable) as exc:
        failure = exc if isinstance(exc, StorageUnavailable) else StorageUnavailable()
        if failure.code != TOO_LARGE:  # One oversized save says nothing about storage being down.
            with _state_lock:
                _failure = failure
                _blocked_until = time.monotonic() + failure.retry_after
        raise failure from None


def pipeline(commands, *, timeout=TIMEOUT):
    if STORAGE_BACKEND == 'supabase':
        prepared = []
        for command in commands:
            row = list(command)
            op = str(row[0]).upper()
            # Only payloads, not counters, field names, keys or expiry options.
            positions = ([2] if op in ('SET', 'SETNX') else [3] if op == 'SETEX'
                         else range(3, len(row), 2) if op == 'HSET' else [3] if op == 'HSETNX'
                         else range(2, len(row)) if op == 'LPUSH' else [])
            for position in positions:
                row[position] = _pack(row[position])
            prepared.append(row)
        result = _request('post', '/rest/v1/rpc/website_storage_pipeline',
                          json={'commands': prepared}, timeout=timeout, _supabase=True)
    else:
        translated = [(['EVAL', "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, command[1], command[2]]
                       if str(command[0]).upper() == 'COMPAREDEL' else command) for command in commands]
        result = _request('post', '/pipeline', json=translated, timeout=timeout)
    if not isinstance(result, list) or len(result) != len(commands) or any(not isinstance(item, dict) or 'result' not in item for item in result):
        raise StorageUnavailable()
    if STORAGE_BACKEND == 'supabase':
        for command, entry in zip(commands, result):
            op = str(command[0]).upper()
            if op in ('GET', 'HGET'):
                if entry['result'] is not None and not isinstance(entry['result'], str):
                    raise StorageUnavailable()
                entry['result'] = _unpack(entry['result'])
            elif op in ('MGET', 'LRANGE'):
                if not isinstance(entry['result'], list) or any(value is not None and not isinstance(value, str) for value in entry['result']):
                    raise StorageUnavailable()
                if op == 'MGET' and len(entry['result']) != len(command) - 1:
                    raise StorageUnavailable()
                entry['result'] = [_unpack(value) for value in entry['result']]
            elif op == 'HGETALL':
                flat = entry['result']
                if not isinstance(flat, list) or len(flat) % 2 or any(not isinstance(value, str) for value in flat):
                    raise StorageUnavailable()
                entry['result'] = [value if index % 2 == 0 else _unpack(value) for index, value in enumerate(flat)]
    with _state_lock:
        for command in commands:
            if str(command[0]).upper() not in ('GET', 'MGET', 'HGET', 'HGETALL', 'HLEN', 'LRANGE', 'LLEN', 'PTTL', 'TYPE', 'ZRANGEBYSCORE'):
                for key in (command[1:] if str(command[0]).upper() == 'DEL' else command[1:2]):
                    _read_cache.pop(key, None)
    return result


def _headers() -> dict:
    return {"Authorization": f"Bearer {KV_TOKEN}"}


def get(key: str, *, timeout=TIMEOUT, cache_seconds=0) -> str | None:
    if not configured():
        if STORAGE_BACKEND != 'upstash':
            require_configured()
        return None
    # Opt-in only: authentication counters and lockouts must always be live.
    if cache_seconds:
        with _state_lock:
            cached = _read_cache.get(key)
            if cached and cached[0] > time.monotonic():
                return cached[1]
    data = pipeline([['GET', key]], timeout=timeout)[0] if STORAGE_BACKEND == 'supabase' else _request('get', f'/get/{key}', timeout=timeout)
    if not isinstance(data, dict) or 'result' not in data:
        raise StorageUnavailable()
    value = data['result']
    if cache_seconds and (value is None or isinstance(value, str) and len(value) <= 16384):
        with _state_lock:
            if len(_read_cache) >= 128:
                _read_cache.clear()
            _read_cache[key] = (time.monotonic() + min(float(cache_seconds), 10), value)
    return value


def set(key: str, value: str, *, ex: int | None = None) -> bool:
    """Store `value` with an optional expiry on the selected shared backend."""
    if not configured():
        if STORAGE_BACKEND != 'upstash':
            require_configured()
        return False
    data = (pipeline([['SET', key, value, *(['EX', int(ex)] if ex else [])]])[0]
            if STORAGE_BACKEND == 'supabase' else
            _request('post', f'/set/{key}', data=value.encode('utf-8'), params={"EX": int(ex)} if ex else None))
    if not isinstance(data, dict) or data.get('result') != 'OK':
        raise StorageUnavailable()
    with _state_lock:
        _read_cache.pop(key, None)
    return True


def get_odds_api_key() -> str:
    """The live-swappable odds key. Falls back to .env's ODDS_API_KEY_V2 if
    nothing has been set in the store yet (e.g. right after first deploy)."""
    return get(ODDS_KEY_STORAGE_KEY) or os.getenv("ODDS_API_KEY_V2", "")


def get_odds_api_key_candidates() -> list[str]:
    """Return live and deployment keys in retry order, without duplicates.

    A key saved through the admin panel normally takes precedence. If that
    key later expires or is revoked, callers can still retry the deployment
    key instead of leaving every live-line request permanently broken.
    """
    try:
        stored_key = get(ODDS_KEY_STORAGE_KEY, cache_seconds=10) or ""
    except StorageUnavailable:
        stored_key = ""  # Lines keep working on the deployment key while storage is down.
    env_key = os.getenv("ODDS_API_KEY_V2", "") or ""
    return list(dict.fromkeys(key.strip() for key in (stored_key, env_key) if key.strip()))


def set_odds_api_key(new_key: str) -> bool:
    return set(ODDS_KEY_STORAGE_KEY, new_key)


# ── PIN brute-force protection ──────────────────────────────────────────────
# A 4-digit PIN is only 10,000 combinations -- worthless without a rate
# limit. Tracked globally (not per-IP) in the shared store since this is a
# single-admin panel, not a multi-user login.
PIN_FAIL_COUNT_KEY = "vortex_v2:admin_pin_fail_count"
PIN_LOCK_UNTIL_KEY = "vortex_v2:admin_pin_lock_until"
MAX_PIN_ATTEMPTS = 5
LOCKOUT_SEC = 15 * 60


def is_pin_locked_out() -> tuple[bool, int]:
    require_configured()
    import time
    lock_until = get(PIN_LOCK_UNTIL_KEY)
    if lock_until and float(lock_until) > time.time():
        return True, int(float(lock_until) - time.time())
    return False, 0


def record_pin_failure() -> None:
    require_configured()
    if STORAGE_BACKEND == 'supabase':
        # This entire counter/lock transition is atomic across all instances.
        _request('post', '/rest/v1/rpc/website_storage_pin_failure', json={}, _supabase=True)
        return
    import time
    count = int(get(PIN_FAIL_COUNT_KEY) or 0) + 1
    set(PIN_FAIL_COUNT_KEY, str(count))
    if count >= MAX_PIN_ATTEMPTS:
        set(PIN_LOCK_UNTIL_KEY, str(time.time() + LOCKOUT_SEC))
        set(PIN_FAIL_COUNT_KEY, "0")


def clear_pin_failures() -> None:
    require_configured()
    set(PIN_FAIL_COUNT_KEY, "0")
