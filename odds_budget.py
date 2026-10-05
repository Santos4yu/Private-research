"""Shared, fail-closed Odds API budget and durable response cache.

Reservations are conservative: failed/empty calls still consume local allowance.
No credentials or prepared provider URLs are stored or exposed.
"""
import calendar
import hashlib
import json
import math
import os
import secrets
from datetime import datetime, timezone
import requests
from v2.board import store

BASE = "https://api.the-odds-api.com/v4"
PREFIX = "krazy_data:odds_governor:v1:"

class BudgetPaused(RuntimeError):
    def __init__(self):
        super().__init__("Live odds refresh is paused to protect the monthly credit budget. Please try again later.")

def estimate(params):
    markets = len(set(filter(None, params.get("markets", "h2h").split(","))))
    books = set(filter(None, params.get("bookmakers", "").split(",")))
    regions = math.ceil(len(books) / 10) if books else len(set(filter(None, params.get("regions", "us").split(","))))
    return max(1, markets * max(1, regions))

def _response(entry):
    response = requests.Response()
    response.status_code = 200
    response._content = json.dumps(entry["payload"]).encode()
    response.headers.update(entry.get("headers", {}))
    response.headers["x-odds-cache"] = "hit"
    return response

def _ttl(payload, now):
    rows = payload if isinstance(payload, list) else [payload]
    starts = []
    for row in rows:
        if not isinstance(row, dict): continue
        try: starts.append(datetime.fromisoformat(row["commence_time"].replace("Z", "+00:00")).timestamp())
        except (KeyError, TypeError, ValueError): pass
    distance = min(starts, default=now + 86400) - now
    return 3600 if distance <= 6 * 3600 else 3 * 3600 if distance <= 24 * 3600 else 6 * 3600

def guarded_get(session, path, params, key, timeout=15):
    # Schedule and key-validation calls are free; leave their transport intact.
    if not path.endswith("/odds"):
        return session.get(BASE + path, params={**params, "apiKey": key}, timeout=timeout)
    if os.getenv("ODDS_API_PAUSED", "").lower() in ("1", "true", "yes"):
        raise BudgetPaused()
    params = {name: value for name, value in params.items() if name != "apiKey"}
    token = secrets.token_hex(16)
    identity = hashlib.sha256(json.dumps([path, params, hashlib.sha256(key.encode()).hexdigest()], sort_keys=True).encode()).hexdigest()
    cache_key = PREFIX + "cache:" + identity
    # One lease for all site sports/keys: reserves and quota observations cannot race.
    lock = PREFIX + "lock"
    request_lock = cache_key + ":lock"
    request_claimed = False
    try:
        store.require_configured()
        raw = store.get(cache_key)
        if raw:
            entry = json.loads(raw)
            if entry["expires"] > datetime.now(timezone.utc).timestamp(): return _response(entry)
        request_claimed = store.pipeline([["SET", request_lock, token, "NX", "EX", 90]])[0]["result"] == "OK"
        if not request_claimed: raise BudgetPaused()
        claimed = store.pipeline([["SET", lock, token, "NX", "EX", 90]])[0]["result"]
        if claimed != "OK": raise BudgetPaused()
    except Exception:
        if request_claimed:
            try: store.pipeline([["COMPAREDEL", request_lock, token]])
            except Exception: pass
        raise BudgetPaused() from None
    try:
        now = datetime.now(timezone.utc)
        raw = store.get(cache_key)
        if raw:
            entry = json.loads(raw)
            if entry["expires"] > now.timestamp(): return _response(entry)
        state_key = PREFIX + "budget:" + now.strftime("%Y-%m")
        state = json.loads(store.get(state_key) or "{}")
        quota_key = hashlib.sha256(key.encode()).hexdigest()
        quotas = state.setdefault("quotas", {})
        if quota_key not in quotas:
            probe = session.get(BASE + "/sports", params={"apiKey": key}, timeout=timeout)
            if not probe.ok: return probe
            remaining = probe.headers.get("x-requests-remaining")
            if not str(remaining).isdigit(): raise BudgetPaused()
            quotas[quota_key] = int(remaining)
        days = calendar.monthrange(now.year, now.month)[1] - now.day + 1
        reserve = max(0, int(os.getenv("ODDS_CREDIT_RESERVE", "1500")))
        allowance = min(int(os.getenv("ODDS_DAILY_CREDIT_LIMIT", "1000")), max(0, (quotas[quota_key] - reserve) // days))
        day = now.strftime("%Y-%m-%d")
        if state.get("day") != day:
            state.update(day=day, spent=0)
        cost = estimate(params)
        if state["spent"] + cost > allowance or quotas[quota_key] - cost < reserve: raise BudgetPaused()
        state["spent"] += cost
        quotas[quota_key] -= cost
        if not store.set(state_key, json.dumps(state), ex=35*86400): raise BudgetPaused()
        store.pipeline([["COMPAREDEL", lock, token]])
        response = session.get(BASE + path, params={**params, "apiKey": key}, timeout=timeout)
        remaining = response.headers.get("x-requests-remaining")
        if str(remaining).isdigit():
            # Merge into the latest state; never overwrite another reservation.
            claimed = store.pipeline([["SET", lock, token, "NX", "EX", 90]])[0]["result"]
            if claimed == "OK":
                latest = json.loads(store.get(state_key) or "{}")
                latest["quotas"][quota_key] = min(latest["quotas"][quota_key], int(remaining))
                store.set(state_key, json.dumps(latest), ex=35*86400)
                store.pipeline([["COMPAREDEL", lock, token]])
        if response.ok:
            payload = response.json()
            stamp = datetime.now(timezone.utc).timestamp()
            ttl = _ttl(payload, stamp)
            headers = {name: response.headers[name] for name in ("x-requests-remaining", "x-requests-used", "x-requests-last") if name in response.headers}
            store.set(cache_key, json.dumps({"payload": payload, "headers": headers, "expires": stamp+ttl}), ex=ttl)
        return response
    except requests.RequestException:
        raise
    except BudgetPaused:
        raise
    except Exception:
        raise BudgetPaused() from None
    finally:
        try: store.pipeline([["COMPAREDEL", lock, token], ["COMPAREDEL", request_lock, token]])
        except Exception: pass


def cached_get(path, params, key):
    """Finder comparisons may reuse odds, but never buy them or probe quota.

    A cache miss is optional enrichment, not a reason to delay PrizePicks.
    """
    params = {name: value for name, value in params.items() if name != "apiKey"}
    identity = hashlib.sha256(json.dumps([path, params, hashlib.sha256(key.encode()).hexdigest()], sort_keys=True).encode()).hexdigest()
    try:
        raw = store.get(PREFIX + "cache:" + identity, timeout=1)
        entry = json.loads(raw) if raw else None
        if entry and entry["expires"] > datetime.now(timezone.utc).timestamp():
            return _response(entry)
    except Exception:
        pass
    raise BudgetPaused()
