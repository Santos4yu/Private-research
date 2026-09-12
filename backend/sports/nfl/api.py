from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime
from enum import Enum

from .services.base import ProviderResult


def _json_value(value):
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    if hasattr(value, "__dataclass_fields__"):
        return {key: _json_value(item) for key, item in asdict(value).items()}
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    return value


def response_payload(result: ProviderResult) -> dict:
    return {
        "status": result.status.value,
        "data": _json_value(result.data),
        "source": result.source,
        "fetchedAt": result.fetched_at.isoformat(),
        "observedAt": result.observed_at.isoformat() if result.observed_at else None,
        "reason": result.reason,
    }


def send_json(handler, status: int, body: dict) -> None:
    if status >= 500:
        from .request_guard import event
        event('source_or_model_unavailable', 'nfl')
    payload = json.dumps(body, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    # Browser HTTP caching must not defeat explicit injury/line/model refreshes.
    handler.send_header("Cache-Control", "private, no-store")
    handler.send_header("X-Content-Type-Options", "nosniff")
    handler.send_header("Content-Length", str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)
