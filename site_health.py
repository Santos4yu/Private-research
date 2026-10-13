"""Telling the admin when something breaks, before members notice.

Problems found here are kept for the admin panel's Site health box (the
last 40) and, when ALERT_WEBHOOK_URL is set, posted to that Discord channel.
Each kind of problem is sent at most once every few hours.

Two ways problems are found:

* The daily check (daily(), a Vercel cron -- those are never challenged by
  the firewall). It also repairs what it can: settles finished picks the
  outside timer missed, and re-syncs every Whop membership, which mends any
  webhook that never arrived (and says so, since that means webhooks are
  being missed).
* A light check while members use the site (light_check(), from the
  site-status poll, at most every few minutes per server): the PrizePicks
  line checks. They run every few minutes from an outside timer; when they
  stop, something outside is blocking or has dropped that timer.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone

import requests

ALERTS_KEY = 'krazy_data:site_alerts:v1'
ONCE_KEY = 'krazy_data:site_alert_once:'
KEEP = 40
# How long one kind of problem stays quiet after it is reported.
QUIET_SECONDS = 6 * 3600
# The outside timer checks lines every few minutes; this long without one is a problem.
LINES_STALE_SECONDS = 45 * 60
LIGHT_EVERY_SECONDS = 5 * 60
_light = {'at': 0.0}


def _store():
    from v2.board import store
    return store


def _now():
    return datetime.now(timezone.utc)


def _discord(title, detail):
    url = os.getenv('ALERT_WEBHOOK_URL', '').strip()
    if not url.startswith('https://'):
        return False
    try:
        return requests.post(url, json={'content': f'**Ace Props · {title}**\n{detail}'[:1900]}, timeout=6).ok
    except requests.RequestException:
        return False


def alert(kind, title, detail, quiet=QUIET_SECONDS):
    """Records a problem and sends it on -- unless the same kind was sent
    within `quiet` seconds. True when it went out."""
    store = _store()
    try:
        first = store.pipeline([['SET', ONCE_KEY + kind, '1', 'NX', 'EX', int(quiet)]])[0].get('result')
    except Exception:  # noqa: BLE001 -- storage down is itself reported by the caller
        first = 'OK'
    if first != 'OK':
        return False
    entry = {'kind': kind, 'title': title, 'detail': detail, 'at': _now().isoformat(), 'sent': _discord(title, detail)}
    try:
        store.pipeline([['LPUSH', ALERTS_KEY, json.dumps(entry)], ['LTRIM', ALERTS_KEY, 0, KEEP - 1]])
    except Exception:  # noqa: BLE001
        pass
    return True


def recent():
    try:
        raw = _store().pipeline([['LRANGE', ALERTS_KEY, 0, KEEP - 1]])[0].get('result') or []
    except Exception:  # noqa: BLE001
        return []
    out = []
    for item in raw:
        try:
            out.append(json.loads(item))
        except (TypeError, ValueError):
            continue
    return out


def _parse(value):
    try:
        return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
    except (TypeError, ValueError):
        try:
            return float(value)
        except (TypeError, ValueError):
            return None


def lines_age(now=None):
    """Seconds since the newest PrizePicks line check, or None when unknown."""
    import line_moves
    stamps = [_parse(value) for value in (line_moves.checked() or {}).values()]
    stamps = [stamp for stamp in stamps if stamp]
    return ((now or time.time()) - max(stamps)) if stamps else None


def check_lines(now=None):
    age = lines_age(now)
    if age is not None and age > LINES_STALE_SECONDS:
        minutes = int(age // 60)
        alert('lines-stale', 'Line checks stopped',
              f'PrizePicks lines were last checked {minutes} minutes ago (they normally run every few minutes). '
              'Line Moves, pick alerts and settling results wait on them. If Vercel\'s firewall is challenging '
              'visitors, add a Bypass rule for the timer link (/api/v2-admin with action=moves-tick).')
        return False
    return True


def light_check():
    """Cheap, from the site-status poll: at most every few minutes per server."""
    if time.monotonic() - _light['at'] < LIGHT_EVERY_SECONDS:
        return
    _light['at'] = time.monotonic()
    try:
        check_lines()
    except Exception:  # noqa: BLE001 -- never at the cost of the member's page
        pass


def daily():
    """The daily check: each part of the site, then what can be repaired."""
    report = {}
    store = _store()
    try:
        store.get('krazy_data:site_controls:v1')
        report['storage'] = 'ok'
    except Exception as exc:  # noqa: BLE001
        report['storage'] = 'down'
        alert('storage', 'Storage is unavailable', f'The site\'s storage did not answer the daily check ({type(exc).__name__}). Sign-in and settings depend on it.')
        return report
    try:
        report['lines'] = 'ok' if check_lines() else 'stale'
    except Exception:  # noqa: BLE001
        report['lines'] = 'unknown'
    # Finished picks the outside timer missed: settled here, many games at once.
    try:
        import slip_ledger
        report['settled'] = slip_ledger.tick(limit=40)
    except Exception as exc:  # noqa: BLE001
        report['settled'] = None
        alert('settle', 'Results could not be settled', f'Settling finished picks failed ({type(exc).__name__}). The results record will fall behind.')
    # Whop: the key still works, and every membership matches the site.
    try:
        import whop_billing
        if whop_billing.configured():
            synced = whop_billing.subscribers(sync=True)
            report['whop'] = {'members': synced['counts'].get('total'), 'repaired': synced.get('repaired', 0)}
            if synced.get('repaired'):
                alert('whop-missed', 'Whop messages were missed',
                      f'{synced["repaired"]} membership(s) on Whop did not match the site and were repaired by the daily check. '
                      'Whop\'s webhooks are probably not getting through: check the Vercel firewall Bypass rule for /api/whop/webhook.')
    except Exception as exc:  # noqa: BLE001
        report['whop'] = 'down'
        alert('whop', 'Whop is not answering', f'The daily check could not read memberships from Whop ({type(exc).__name__}). Check WHOP_API_KEY in Vercel.')
    return report


def status(now=None):
    """For the admin panel's Site health box."""
    try:
        age = lines_age(now)
    except Exception:  # noqa: BLE001
        age = None
    return {'alerts': recent(), 'linesAge': age, 'discord': os.getenv('ALERT_WEBHOOK_URL', '').startswith('https://')}
