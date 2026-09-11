"""FastAPI domain for Web Push notifications (Python/httpx implementation).

Provides:
  - ``send_push_to_user(user_id, payload)``  — fan-out push to all subscriptions
  - ``send_push_to_account(account_id, ...)`` — resolve user then fan-out

This mirrors the Node.js ``src/lib/push/web-push.ts`` but runs in the
FastAPI (Python) process so the backend can trigger pushes without a round-trip
to the Next.js side.

VAPID keys are read from environment variables:
  ``VAPID_PUBLIC_KEY``   — URL-safe base64 public key
  ``VAPID_PRIVATE_KEY``  — URL-safe base64 private key
  ``VAPID_SUBJECT``      — ``mailto:`` or ``https://`` identifier

Dependencies (add to requirements.txt / pip install):
  ``py-vapid``       — VAPID key handling + header generation
  ``httpx``          — async HTTP for Web Push delivery
"""
from __future__ import annotations

import base64
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

try:
    from py_vapid import Vapid01
    _VAPID_AVAILABLE = True
except ImportError:  # pragma: no cover
    Vapid01 = None  # type: ignore[assignment,misc]
    _VAPID_AVAILABLE = False
    logging.getLogger(__name__).warning(
        "[push] py-vapid not installed — push notifications from FastAPI disabled"
    )

from app.db import db

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
_VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
_VAPID_PUBLIC_KEY  = os.environ.get("VAPID_PUBLIC_KEY", "")
_VAPID_SUBJECT     = os.environ.get("VAPID_SUBJECT", "mailto:noreply@mailscape.app")
_PUSH_ENABLED      = _VAPID_AVAILABLE and bool(_VAPID_PRIVATE_KEY)


@dataclass
class PushPayload:
    """Web Push notification payload."""
    title:     str
    body:      str
    url:       str  = "/"
    tag:       str  = "mailscape"
    important: bool = False
    icon:      str  = "/icon-192.png"
    badge:     str  = "/icon-96.png"

    def to_json(self) -> str:
        return json.dumps({
            "title":     self.title[:80],
            "body":      self.body[:120],
            "url":       self.url,
            "tag":       self.tag,
            "important": self.important,
            "icon":      self.icon,
            "badge":     self.badge,
        })


# ── VAPID auth header generation ──────────────────────────────────────────────

def _vapid_headers(endpoint: str) -> dict[str, str]:
    """Generate VAPID auth headers for the given push endpoint."""
    if not _VAPID_AVAILABLE or not _VAPID_PRIVATE_KEY:
        return {}
    try:
        from py_vapid import Vapid01
        import jwt as _jwt

        audience = _extract_audience(endpoint)
        now      = int(time.time())
        claims   = {
            "aud": audience,
            "exp": now + 43200,  # 12 hours
            "sub": _VAPID_SUBJECT,
        }
        # Sign with VAPID private key (EC P-256)
        vapid = Vapid01.from_string(_VAPID_PRIVATE_KEY)
        token = vapid.sign(claims)
        return {
            "Authorization": f"vapid t={token['Authorization'].split(' t=')[1]}, k={_VAPID_PUBLIC_KEY}",
            "Content-Type": "application/json",
            "Content-Encoding": "aes128gcm",
            "TTL": "86400",
            "Urgency": "high",
        }
    except Exception as exc:  # noqa: BLE001
        logger.error("[push] VAPID header generation failed: %s", exc)
        return {}


def _extract_audience(endpoint: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(endpoint)
    return f"{parsed.scheme}://{parsed.netloc}"


# ── Core send ─────────────────────────────────────────────────────────────────

async def _send_one(
    endpoint: str,
    keys: dict[str, str],
    payload: PushPayload,
    sub_id: str,
) -> bool:
    """Send a single push notification. Returns True on success."""
    if not _PUSH_ENABLED:
        logger.debug("[push] Push disabled (no VAPID config)")
        return False

    headers = _vapid_headers(endpoint)
    if not headers:
        return False

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                endpoint,
                content=payload.to_json().encode(),
                headers=headers,
            )
        if resp.status_code in (200, 201, 202):
            return True
        if resp.status_code in (404, 410):
            # Subscription expired — clean up
            logger.info("[push] Subscription %s expired (%d), removing", sub_id, resp.status_code)
            await _remove_subscription(sub_id)
        else:
            logger.warning("[push] Push failed for %s: HTTP %d", sub_id, resp.status_code)
    except Exception as exc:  # noqa: BLE001
        logger.error("[push] Request error for %s: %s", sub_id, exc)
    return False


async def _remove_subscription(sub_id: str) -> None:
    try:
        await db.pushsubscription.delete(where={"id": sub_id})
    except Exception:  # noqa: BLE001
        pass  # already gone


# ── Public API ────────────────────────────────────────────────────────────────

async def send_push_to_user(user_id: str, payload: PushPayload) -> int:
    """Fan-out push notification to all subscriptions for the given user.

    Returns the number of successful deliveries.
    """
    if not _PUSH_ENABLED:
        return 0

    try:
        subs = await db.pushsubscription.find_many(where={"userId": user_id})
    except Exception as exc:  # noqa: BLE001
        logger.error("[push] Failed to fetch subscriptions for user %s: %s", user_id, exc)
        return 0

    if not subs:
        return 0

    successes = 0
    for sub in subs:
        try:
            keys = json.loads(sub.keysJson) if isinstance(sub.keysJson, str) else sub.keysJson
            ok   = await _send_one(sub.endpoint, keys, payload, sub.id)
            if ok:
                successes += 1
        except Exception as exc:  # noqa: BLE001
            logger.error("[push] Unexpected error for sub %s: %s", sub.id, exc)

    return successes


async def send_push_to_account(account_id: str, payload: PushPayload) -> int:
    """Resolve account → user, then fan-out push notifications."""
    try:
        account = await db.accountconnection.find_unique(
            where={"id": account_id},
            include={"user": True},
        )
        if not account or not account.userId:
            return 0
        return await send_push_to_user(account.userId, payload)
    except Exception as exc:  # noqa: BLE001
        logger.error("[push] Failed to resolve account %s: %s", account_id, exc)
        return 0
