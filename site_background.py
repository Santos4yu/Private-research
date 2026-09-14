"""Server-hosted bytes for the admin's site-wide background photo.

Deliberately kept separate from site_controls.py's JSON settings: that
object is embedded in every visitor's site-status poll response (roughly
every 30s), so the actual image bytes never belong in there -- only a
small, cache-busted reference URL does. This module stores/serves the
bytes themselves, fetched once per browser and cached long-term via
api/v2-admin.py's public `site-background` action.
"""
import base64
import json
import re
import time
from v2.board import store

KEY = 'krazy_data:site_bg_image:v1'
MAX_BYTES = 2 * 1024 * 1024  # generous ceiling; client-side resize keeps real uploads far smaller
DATA_URL_RE = re.compile(r'^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$')


def save_image(data_url):
    match = DATA_URL_RE.match(data_url or '')
    if not match:
        raise ValueError('Expected a JPEG, PNG, or WEBP image')
    content_type, payload = match.group(1), match.group(2)
    try:
        raw = base64.b64decode(payload, validate=True)
    except Exception:
        raise ValueError('Invalid image data')
    if not raw:
        raise ValueError('Invalid image data')
    if len(raw) > MAX_BYTES:
        raise ValueError('Image is too large; please choose a smaller photo')
    version = str(int(time.time()))
    record = json.dumps({'contentType': content_type, 'data': payload, 'version': version})
    if not store.set(KEY, record):
        raise ValueError('Image storage unavailable')
    return version


def clear_image():
    store.set(KEY, '')


def read_image():
    raw = store.get(KEY)
    if not raw:
        return None
    try:
        record = json.loads(raw)
    except ValueError:
        return None
    if not record.get('data'):
        return None
    return record
