"""Paid access through Whop.

Whop runs the payment itself: the pricing page embeds Whop's checkout, so
card numbers, Apple Pay and Cash App never touch this site. This module does
the three things around it:

1. Pricing -- reads the plans named in WHOP_PLAN_IDS from Whop, so the prices
   shown on the site are always the prices Whop charges.
2. Checkout -- starts a Whop checkout session carrying the member's account
   id, so the subscription that comes out of it is tied to their account
   even if they use a different email at Whop.
3. Access -- Whop's webhooks say when a membership starts, renews or ends.
   Each one is verified, then the membership is fetched from Whop's API
   (the webhook body is never trusted on its own) and recorded against the
   account. has_paid_access() is what the site checks.

Paid access is only enforced while the admin panel's "Require a paid
subscription" switch is on (site_controls.py paidAccess).

Environment:
  WHOP_API_KEY         Company API key (Whop dashboard -> Developer).
  WHOP_WEBHOOK_SECRET  The webhook's signing secret.
  WHOP_PLAN_IDS        plan_ ids to offer, comma separated, in display order.
  WHOP_API_BASE        Optional. https://sandbox-api.whop.com/api/v1 for tests.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / '.env.local')

API_BASE_DEFAULT = 'https://api.whop.com/api/v1'
ACCOUNT_KEY = 'krazy_data:billing:account:'
EMAIL_KEY = 'krazy_data:billing:email:'
# Statuses Whop still counts as a paying member. "canceling" is a member who
# cancelled but whose paid period hasn't run out; "past_due" is a renewal
# Whop is still retrying, so a declined card doesn't lock someone out mid-day.
ACTIVE_STATUSES = ('active', 'trialing', 'canceling', 'past_due')
# Webhooks older or newer than this are refused (replay protection).
WEBHOOK_TOLERANCE_SECONDS = 5 * 60
# A record whose paid period ended this long ago is re-checked with Whop, in
# case the webhook that ended it never arrived.
STALE_GRACE_SECONDS = 24 * 3600
RECHECK_EVERY_SECONDS = 15 * 60
# Every data request asks for the member's access, so a warm instance reuses
# the answer briefly. A cancellation reaches every request within this long.
ACCESS_FRESH_SECONDS = 30
PLANS_FRESH_SECONDS = 10 * 60
_ID = re.compile(r'^[a-z]+_[A-Za-z0-9]{4,64}$')


class BillingUnavailable(RuntimeError):
    """Whop couldn't be reached, or isn't set up."""


def _api_key():return os.getenv('WHOP_API_KEY', '').strip()
def _api_base():return (os.getenv('WHOP_API_BASE') or API_BASE_DEFAULT).rstrip('/')
def plan_ids():
    ids = [part.strip() for part in os.getenv('WHOP_PLAN_IDS', '').split(',')]
    return [plan for plan in dict.fromkeys(ids) if plan.startswith('plan_') and _ID.match(plan)]
def configured():return bool(_api_key() and plan_ids())
def webhook_configured():return bool(os.getenv('WHOP_WEBHOOK_SECRET', '').strip())


def _call(method, path, body=None):
    if not _api_key():raise BillingUnavailable('Payments are not set up yet')
    try:
        response = requests.request(method, _api_base() + path, json=body, timeout=12,
                                    headers={'Authorization': 'Bearer ' + _api_key(), 'Content-Type': 'application/json'})
    except requests.RequestException as exc:
        raise BillingUnavailable('Payments are unavailable right now') from exc
    if response.status_code == 404:return None
    if not response.ok:raise BillingUnavailable('Payments are unavailable right now')
    try:return response.json()
    except ValueError as exc:raise BillingUnavailable('Payments are unavailable right now') from exc


def _store():
    from v2.board import store
    return store


def _email(value):
    from site_members import normalize_email
    return normalize_email(value)


# --- Pricing ---------------------------------------------------------------

_plans_cache = {'at': 0.0, 'value': None}
PERIOD_NAMES = ((range(6, 9), 'week', 'Weekly'), (range(28, 32), 'month', 'Monthly'), (range(88, 93), '3 months', 'Quarterly'),
                (range(180, 185), '6 months', '6 Months'), (range(364, 367), 'year', 'Annual'))


# A named billing period's length in months, for the per-month price.
MONTHS = {'month': 1, '3 months': 3, '6 months': 6, 'year': 12}


def _period(days):
    for span, unit, label in PERIOD_NAMES:
        if days in span:return unit, label
    return f'{days} days', f'Every {days} days'


def _plan_view(plan):
    days = plan.get('billing_period') if plan.get('plan_type') == 'renewal' else None
    price = plan.get('renewal_price') if days else plan.get('initial_price')
    try:price = round(float(price), 2)
    except (TypeError, ValueError):return None
    unit, label = _period(int(days)) if days else ('one time', 'One time')
    # Named by billing period, not the plan's Whop title: those are often
    # empty or auto-generated, and the pricing page needs short, even names.
    return {'id': plan['id'], 'label': label, 'price': price,
            'currency': str(plan.get('currency') or 'usd').upper(), 'period': unit,
            'monthly': round(price / MONTHS[unit], 2) if days and unit in MONTHS else round(price / (int(days) / 30.4375), 2) if days else None,
            'trialDays': plan.get('trial_period_days') or 0}


def plans():
    """The plans on offer, as the pricing page shows them. Plans Whop can't
    describe are left out rather than shown with a made-up price."""
    now = time.monotonic()
    if _plans_cache['value'] is not None and now - _plans_cache['at'] < PLANS_FRESH_SECONDS:
        return _plans_cache['value']
    views = []
    for plan_id in plan_ids():
        plan = _call('GET', f'/plans/{plan_id}')
        view = _plan_view(plan) if isinstance(plan, dict) and plan.get('id') == plan_id else None
        if view:views.append(view)
    # "Save 33%" against the plan that costs the most per month.
    dearest = max((view['monthly'] for view in views if view['monthly']), default=None)
    for view in views:
        saving = 1 - view['monthly'] / dearest if dearest and view['monthly'] else 0
        view['savePercent'] = round(saving * 100) if saving >= 0.05 else 0
    _plans_cache.update(at=now, value=views)
    return views


# --- Checkout --------------------------------------------------------------

def start_checkout(account, plan_id, return_url):
    """A Whop checkout session (ch_...) for this member and plan. The session
    carries their account id, and the membership it creates inherits it."""
    if plan_id not in plan_ids():raise ValueError('Choose one of the plans shown')
    uid = str((account or {}).get('id') or '')
    if not uid:raise ValueError('Sign in to subscribe')
    body = {'plan_id': plan_id, 'metadata': {'ace_account_id': uid, 'ace_email': _email(account.get('email'))}}
    if return_url:body['redirect_url'] = return_url
    data = _call('POST', '/checkout_configurations', body)
    session = (data or {}).get('id')
    if not isinstance(session, str) or not session.startswith('ch_'):raise BillingUnavailable('Checkout could not be started')
    return session


# --- Webhooks --------------------------------------------------------------

def _signing_keys(secret):
    """Whop signs with its secret exactly as issued. Standard Webhooks
    secrets ("whsec_<base64>") sign with the decoded bytes instead, so both
    readings of the one secret are tried."""
    keys = [secret.encode('utf-8')]
    if secret.startswith('whsec_'):
        try:keys.append(base64.b64decode(secret[len('whsec_'):]))
        except ValueError:pass
    return keys


def verify_webhook(headers, raw_body, now=None):
    """The event, if these headers carry a valid, recent Whop signature for
    exactly this body. Raises ValueError otherwise."""
    secret = os.getenv('WHOP_WEBHOOK_SECRET', '').strip()
    if not secret:raise ValueError('Webhook secret not configured')
    webhook_id = headers.get('webhook-id') or ''
    stamp = headers.get('webhook-timestamp') or ''
    signatures = headers.get('webhook-signature') or ''
    try:sent_at = int(stamp)
    except ValueError:raise ValueError('Invalid webhook timestamp') from None
    if not webhook_id or abs((now or time.time()) - sent_at) > WEBHOOK_TOLERANCE_SECONDS:raise ValueError('Webhook too old or missing id')
    signed = f'{webhook_id}.{stamp}.'.encode('utf-8') + raw_body
    expected = [base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode() for key in _signing_keys(secret)]
    offered = [part.split(',', 1)[1] for part in signatures.split() if part.startswith('v1,')]
    if not any(hmac.compare_digest(sig, want) for sig in offered for want in expected):raise ValueError('Invalid webhook signature')
    try:event = json.loads(raw_body)
    except ValueError:raise ValueError('Invalid webhook body') from None
    if not isinstance(event, dict):raise ValueError('Invalid webhook body')
    return event


def _membership_id(event):
    data = event.get('data') if isinstance(event.get('data'), dict) else {}
    for value in (data.get('id'), (data.get('membership') or {}).get('id') if isinstance(data.get('membership'), dict) else None,
                  data.get('membership_id')):
        if isinstance(value, str) and value.startswith('mem_'):return value
    return None


def handle_event(event):
    """Brings the member's access in line with a webhook. Whatever the event
    says, the membership is re-read from Whop and that is what's recorded.
    Returns the record saved, or None when the event isn't about access."""
    kind = str(event.get('type') or '')
    if not (kind.startswith('membership') or kind.startswith('payment')):return None
    membership_id = _membership_id(event)
    return sync_membership(membership_id) if membership_id else None


# --- Access records --------------------------------------------------------

def _record(membership):
    # Whop's live API sends plan_id, current_period_end and user_id; its
    # reference shows plan{}, renewal_period_end and user{}. Either is read.
    user = membership.get('user') if isinstance(membership.get('user'), dict) else {}
    plan = membership.get('plan') if isinstance(membership.get('plan'), dict) else {}
    metadata = membership.get('metadata') if isinstance(membership.get('metadata'), dict) else {}
    status = str(membership.get('status') or '')
    return {'membershipId': membership.get('id'), 'status': status, 'active': status in ACTIVE_STATUSES,
            'planId': plan.get('id') or membership.get('plan_id'),
            'renewsAt': membership.get('renewal_period_end') or membership.get('current_period_end'),
            'cancelAtPeriodEnd': bool(membership.get('cancel_at_period_end')),
            'manageUrl': membership.get('manage_url') if str(membership.get('manage_url') or '').startswith('https://') else None,
            'accountId': str(metadata.get('ace_account_id') or '') or None,
            'email': _email(metadata.get('ace_email')) or _email(user.get('email')) or None,
            'checkedAt': time.time()}


def _keys(record):
    keys = []
    if record.get('accountId'):keys.append(ACCOUNT_KEY + record['accountId'])
    if record.get('email'):keys.append(EMAIL_KEY + record['email'])
    return keys


def _save(record):
    """Records a membership under its account and its email. A member with
    two memberships keeps access while either is live: an ended one never
    overwrites a live one held under a different membership."""
    store = _store()
    for key in _keys(record):
        current = _load(key)
        if current and current.get('active') and not record['active'] and current.get('membershipId') != record['membershipId']:
            continue
        store.set(key, json.dumps(record))
    _access_cache.clear()
    return record


def _load(key):
    raw = _store().get(key)
    if not raw:return None
    try:value = json.loads(raw)
    except ValueError:return None
    return value if isinstance(value, dict) else None


def sync_membership(membership_id):
    membership = _call('GET', f'/memberships/{membership_id}')
    if not isinstance(membership, dict) or membership.get('id') != membership_id:return None
    return _save(_record(membership))


def confirm_payment(account, payment_id):
    """Right after checkout, before the webhook lands: looks the payment up
    and records its membership -- only when that payment belongs to this
    member (their account id on the checkout, or their email)."""
    if not isinstance(payment_id, str) or not _ID.match(payment_id):raise ValueError('Unknown payment')
    payment = _call('GET', f'/payments/{payment_id}')
    if not isinstance(payment, dict):raise ValueError('Unknown payment')
    membership_id = (payment.get('membership') or {}).get('id') if isinstance(payment.get('membership'), dict) else None
    if not membership_id:return None
    record = sync_membership(membership_id)
    if not record:return None
    mine = record.get('accountId') == str(account.get('id')) or (not record.get('accountId') and record.get('email') == _email(account.get('email')))
    return record if mine else None


_access_cache = {}


def _parse_time(value):
    if not value:return None
    try:return datetime.fromisoformat(str(value).replace('Z', '+00:00')).timestamp()
    except ValueError:
        try:return float(value)
        except (TypeError, ValueError):return None


def _fresh(record):
    """Re-reads a record from Whop when its paid period ended a while ago and
    it still says active -- the webhook that ended it may never have come."""
    ended = _parse_time(record.get('renewsAt'))
    if (record.get('active') and ended and time.time() - ended > STALE_GRACE_SECONDS
            and time.time() - float(record.get('checkedAt') or 0) > RECHECK_EVERY_SECONDS and record.get('membershipId')):
        try:return sync_membership(record['membershipId']) or {**record, 'active': False}
        except BillingUnavailable:return record
    return record


def subscription(account):
    """This member's subscription record (or None): looked up by account,
    then by email for a purchase made on Whop directly."""
    if not account or not account.get('id'):return None
    cache_key = str(account.get('id'))
    hit = _access_cache.get(cache_key)
    if hit and time.monotonic() - hit[0] < ACCESS_FRESH_SECONDS:return hit[1]
    record = None
    for key in (ACCOUNT_KEY + cache_key, EMAIL_KEY + _email(account.get('email')) if _email(account.get('email')) else None):
        found = _load(key) if key else None
        if found and (not record or (found.get('active') and not record.get('active'))):record = found
        if record and record.get('active'):break
    record = _fresh(record) if record else None
    _access_cache[cache_key] = (time.monotonic(), record)
    if len(_access_cache) > 4096:_access_cache.pop(next(iter(_access_cache)))
    return record


def public_subscription(record):
    """What the member's own page may see about their subscription."""
    if not record:return None
    return {key: record.get(key) for key in ('status', 'active', 'planId', 'renewsAt', 'cancelAtPeriodEnd', 'manageUrl')}


def has_paid_access(account):
    """Whether a signed-in member gets in while the site requires a paid
    subscription: an active Whop membership, or comped by the admin."""
    if not account:return False
    from site_members import read_rules, rule_for
    rule = rule_for(read_rules(), account)
    if rule and rule.get('comped'):return True
    record = subscription(account)
    return bool(record and record.get('active'))


# --- The admin's subscriber list -------------------------------------------

LIST_PAGE = 100
LIST_MOST = 2000


def _promo_id(membership):
    promo = membership.get('promo_code')
    return promo.get('id') if isinstance(promo, dict) else None


def _all_memberships():
    """Every membership on the company, newest first, page by page."""
    out, after = [], None
    while len(out) < LIST_MOST:
        query = f'/memberships?first={LIST_PAGE}' + (f'&after={after}' if after else '')
        page = _call('GET', query) or {}
        out += [item for item in page.get('data') or [] if isinstance(item, dict) and item.get('id')]
        info = page.get('page_info') or {}
        after = info.get('end_cursor')
        if not info.get('has_next_page') or not after:
            break
    return out


def subscribers(sync=False):
    """Everyone with a Whop membership, for the admin panel: plan, status,
    when it renews or ends, and which PropScout account it unlocks. `sync`
    also records each one, which mends any webhook that never arrived."""
    labels = {}
    try:
        labels = {plan['id']: plan for plan in plans()}
    except BillingUnavailable:
        pass
    rows, saved, repaired = [], 0, 0
    for membership in _all_memberships():
        record = _record(membership)
        if sync and (record.get('accountId') or record.get('email')):
            # On the site already, with the same standing? If not, a webhook
            # about it never arrived.
            held = _load(_keys(record)[0])
            if not held or held.get('membershipId') == record['membershipId'] and (held.get('status'), held.get('active')) != (record['status'], record['active']):
                repaired += 1
            _save(record)
            saved += 1
        plan = labels.get(record['planId']) or {}
        rows.append({**{key: record.get(key) for key in ('membershipId', 'status', 'active', 'planId', 'renewsAt', 'cancelAtPeriodEnd', 'accountId', 'email')},
                     'plan': plan.get('label'), 'price': plan.get('price'), 'period': plan.get('period'), 'monthly': plan.get('monthly'),
                     'createdAt': membership.get('created_at'), 'canceledAt': membership.get('canceled_at'),
                     'promo': bool(membership.get('promo_code_id') or _promo_id(membership))})
    counts = {status: sum(1 for row in rows if row['status'] == status) for status in ('active', 'trialing', 'canceling', 'past_due')}
    # What the paying members bring in a month, at full price (promo codes
    # and trials aside), for a rough sense of it.
    paying = [row for row in rows if row['status'] in ('active', 'canceling', 'past_due') and row.get('monthly')]
    return {'members': rows, 'counts': {**counts, 'total': len(rows), 'live': sum(1 for row in rows if row['active'])},
            'monthly': round(sum(row['monthly'] for row in paying), 2), 'synced': saved if sync else None,
            'repaired': repaired if sync else None}
