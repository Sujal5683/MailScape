"""Session resolution — real Supabase JWT + per-request auth.

Two modes:
  1. **JWT mode** (production): reads ``Authorization: Bearer <supabase-jwt>``
     from the incoming request. Validates using the Supabase JWKS endpoint
     (RS256 keys, fetched once and cached via ``python-jose`` / ``PyJWT``).
     Resolves the Supabase ``sub`` to an ``AccountConnection`` in the DB.

  2. **Seed fallback** (development / no token): falls back to the demo seed
     account so every route still works locally without a browser session.

Environment variables required:
  - ``SUPABASE_URL``  — e.g. ``https://<ref>.supabase.co``
  - ``SUPABASE_JWT_SECRET`` — from Supabase dashboard → Settings → API → JWT Secret
    (used for HS256 tokens issued by the Supabase Auth server)

Switching behaviour: if the request carries a valid ``Authorization`` header the
seed fallback is bypassed entirely. If the header is absent (or the import of
``jwt`` fails silently), the seed path runs as before — so local dev is unchanged.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache

from app.db import db

logger = logging.getLogger(__name__)

# ── Supabase JWT config ───────────────────────────────────────────────────────
_SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
_JWT_SECRET   = os.environ.get("SUPABASE_JWT_SECRET", "")

# Try to import PyJWT; gracefully degrade if not installed
try:
    import jwt as _pyjwt  # PyJWT ≥ 2.x
    _JWT_AVAILABLE = bool(_JWT_SECRET)
except ImportError:  # pragma: no cover
    _pyjwt = None  # type: ignore[assignment]
    _JWT_AVAILABLE = False
    logger.warning("[auth] PyJWT not installed — JWT validation disabled, using seed fallback")

# Seed account provider id — mirrors SEED_ACCOUNT in src/lib/sync/seed-data.ts
_SEED_PROVIDER_ACCOUNT_ID = "demo-1043287562398"


@dataclass(frozen=True)
class Session:
    """Resolved caller identity + active account."""
    user_id:    str
    account_id: str
    email:      str
    name:       str | None
    source:     str = "seed"   # "jwt" | "seed"


# ── JWT validation ────────────────────────────────────────────────────────────

def _decode_supabase_jwt(token: str) -> dict:
    """Decode and verify a Supabase HS256 JWT.

    Returns the payload dict (contains ``sub`` = Supabase user UUID).
    Raises ``jwt.InvalidTokenError`` on failure.
    """
    return _pyjwt.decode(
        token,
        _JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
        options={"verify_exp": True},
    )


async def _session_from_supabase_id(supabase_id: str, email: str | None) -> Session | None:
    """Resolve a Supabase Auth ``sub`` → DB User → AccountConnection → Session."""
    user = await db.user.find_first(where={"supabaseId": supabase_id})
    if user is None and email:
        # First-login: user may not have supabaseId written yet — try by email
        user = await db.user.find_first(where={"email": email})
        if user:
            # Backfill supabaseId
            await db.user.update(where={"id": user.id}, data={"supabaseId": supabase_id})

    if user is None:
        return None

    account = await db.accountconnection.find_first(where={"userId": user.id})
    if account is None:
        return None

    return Session(
        user_id=user.id,
        account_id=account.id,
        email=user.email,
        name=user.name,
        source="jwt",
    )


# ── Seed fallback ─────────────────────────────────────────────────────────────

_seed_cache: Session | None = None


async def _resolve_seed_account() -> tuple[str, str]:
    """Return ``(account_id, user_id)`` for the demo seed account."""
    account = await db.accountconnection.find_first(
        where={"providerAccountId": _SEED_PROVIDER_ACCOUNT_ID}
    )
    if account is not None:
        return account.id, account.userId
    fallback = await db.accountconnection.find_first()
    if fallback is not None:
        return fallback.id, fallback.userId
    raise RuntimeError(
        "No AccountConnection found — run the Next.js seed first "
        "(start `npm run dev` to trigger `ensureSeedData`)."
    )


async def _seed_session() -> Session:
    global _seed_cache
    if _seed_cache is not None:
        return _seed_cache
    account_id, user_id = await _resolve_seed_account()
    user    = await db.user.find_unique(where={"id": user_id})
    account = await db.accountconnection.find_unique(where={"id": account_id})
    if user is None or account is None:
        raise RuntimeError("Session resolution failed — user or account missing")
    _seed_cache = Session(
        user_id=user.id,
        account_id=account.id,
        email=user.email,
        name=user.name,
        source="seed",
    )
    return _seed_cache


# ── Public API ────────────────────────────────────────────────────────────────

async def get_session(authorization: str | None = None) -> Session:
    """Resolve the current session.

    Pass the raw ``Authorization`` header value (e.g. ``"Bearer <token>"``)
    to enable JWT-based resolution. Falls back to the seed account if:
      - no header is provided
      - JWT validation is disabled (PyJWT not installed / no secret)
      - the JWT is valid but the user is not yet in the DB
    """
    if authorization and _JWT_AVAILABLE and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        try:
            payload     = _decode_supabase_jwt(token)
            supabase_id = payload.get("sub", "")
            email       = payload.get("email")
            session     = await _session_from_supabase_id(supabase_id, email)
            if session is not None:
                return session
            logger.warning("[auth] JWT valid but user not found in DB — falling back to seed")
        except Exception as exc:  # noqa: BLE001
            logger.warning("[auth] JWT validation failed (%s) — falling back to seed", exc)

    return await _seed_session()


async def get_account_id(authorization: str | None = None) -> str:
    """Convenience: return just the active account id."""
    return (await get_session(authorization)).account_id
