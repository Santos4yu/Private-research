"""Community picks feed -- members post their plays (text + optional photo)
and react to each other's, Discord-style.

Kept as a plain module, not its own api/*.py file, and folded into
api/v2-admin.py's action dispatch -- same reasoning as site_background.py:
Vercel's Hobby plan caps a deployment at 12 serverless functions and this
project is already at 11.

Posts are stored as one JSON list under a single key (same pattern as the
props board and site controls), rather than one Redis key per post -- the
existing store.py wrapper only exposes plain string get/set (no native
list/hash commands), and this feed is capped at MAX_POSTS rather than
expected to grow without bound. Every write is a full read-modify-write of
that list, so two people reacting in the same instant could race and one
update could be lost -- acceptable at this project's scale; a real
multi-writer guarantee would need Redis transactions this thin REST wrapper
doesn't expose.
"""
import base64
import json
import re
import time
import uuid
from v2.board import store

KEY = 'krazy_data:community_feed:v1'
IMAGE_KEY_PREFIX = 'krazy_data:community_image:'
MAX_POSTS = 150
MAX_TEXT_LEN = 500
MAX_IMAGE_BYTES = 2 * 1024 * 1024
REACTIONS = ('🔥', '💰', '💯', '😂', '💀', '🎯')
DATA_URL_RE = re.compile(r'^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$')
IMAGE_ID_RE = re.compile(r'^[0-9a-f]{32}$')


def _read_posts():
    raw = store.get(KEY)
    if not raw:
        return []
    try:
        posts = json.loads(raw)
    except ValueError:
        return []
    return posts if isinstance(posts, list) else []


def _write_posts(posts):
    return store.set(KEY, json.dumps(posts[:MAX_POSTS]))


def list_posts():
    return _read_posts()


def _save_image(data_url):
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
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError('Image is too large; please choose a smaller photo')
    image_id = uuid.uuid4().hex
    record = json.dumps({'contentType': content_type, 'data': payload})
    if not store.set(IMAGE_KEY_PREFIX + image_id, record):
        raise ValueError('Image storage unavailable')
    return image_id


def read_image(image_id):
    if not IMAGE_ID_RE.match(image_id or ''):
        return None
    raw = store.get(IMAGE_KEY_PREFIX + image_id)
    if not raw:
        return None
    try:
        record = json.loads(raw)
    except ValueError:
        return None
    if not record.get('data'):
        return None
    return record


def create_post(author_id, author_name, text, image_data_url=None):
    text = (text or '').strip()
    if not text and not image_data_url:
        raise ValueError('Write something or attach an image')
    if len(text) > MAX_TEXT_LEN:
        raise ValueError(f'Keep it under {MAX_TEXT_LEN} characters')
    image_id = _save_image(image_data_url) if image_data_url else None
    post = {
        'id': uuid.uuid4().hex,
        'authorId': author_id,
        'authorName': (author_name or 'Member').strip()[:60],
        'text': text,
        'imageId': image_id,
        'createdAt': time.time(),
        'reactions': {},
    }
    posts = _read_posts()
    posts.insert(0, post)
    if not _write_posts(posts):
        raise ValueError('Feed storage unavailable')
    return post


def toggle_reaction(post_id, emoji, user_id):
    if emoji not in REACTIONS:
        raise ValueError('Unknown reaction')
    posts = _read_posts()
    post = next((p for p in posts if p['id'] == post_id), None)
    if not post:
        raise ValueError('Post not found')
    reactors = post.setdefault('reactions', {}).setdefault(emoji, [])
    if user_id in reactors:
        reactors.remove(user_id)
        if not reactors:
            del post['reactions'][emoji]
    else:
        reactors.append(user_id)
    if not _write_posts(posts):
        raise ValueError('Feed storage unavailable')
    return post


def delete_post(post_id, requester_id, is_admin):
    posts = _read_posts()
    post = next((p for p in posts if p['id'] == post_id), None)
    if not post:
        raise ValueError('Post not found')
    if not is_admin and post['authorId'] != requester_id:
        raise ValueError('You can only delete your own posts')
    if not _write_posts([p for p in posts if p['id'] != post_id]):
        raise ValueError('Feed storage unavailable')
