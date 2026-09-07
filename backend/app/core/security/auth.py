"""Session resolution.

Mirrors ``src/lib/auth.ts`` in the Next.js backend. For now we resolve a
stable demo session tied to the seed account so every route is account-scoped
(the spec's isolation requirement). When NextAuth + Google OAuth is wired
up, this module is the single place to swap in the real resolver.

Note on Prisma Python naming: the ``prisma`` Python client converts camelCase
schema fields to snake_case by default (``providerAccountId`` ->
``provider_account_id``). Model accessors use lowercased snake_case
(``AccountConnection`` -> ``db.account_connection``).
"""
from __future__ import annotations

from dataclasses import dataclass

from app.db import db

# Seed account provider id — mirrors SEED_ACCOUNT in
# src/lib/sync/seed-data.ts so the FastAPI process resolves the *same*
# account the Next.js seed pipeline creates.
_SEED_PROVIDER_ACCOUNT_ID = "demo-1043287562398"


@dataclass(frozen=True)
class Session:
    """Resolved caller identity + active account."""

    user_id: str
    account_id: str
    email: str
    name: str | None


_cache: Session | None = None


async def _resolve_seed_account() -> tuple[str, str]:
    """Return ``(account_id, user_id)`` for the demo seed account.

    The Next.js process owns seeding; the FastAPI process just reads whatever
    account is already there. Falls back to *any* account if the demo seed
    id is not present (e.g. a fresh DB migrated by Prisma but not yet
    seeded).
    """
    account = await db.account_connection.find_first(
        where={"providerAccountId": _SEED_PROVIDER_ACCOUNT_ID}
    )
    if account is not None:
        return account.id, account.userId
    fallback = await db.account_connection.find_first()
    if fallback is not None:
        return fallback.id, fallback.userId
    raise RuntimeError(
        "No AccountConnection found — run the Next.js seed first "
        "(start `bun run dev` to trigger `ensureSeedData`)."
    )


async def get_session() -> Session:
    """Resolve and cache the current session (mirrors ``getSession``).

    Returns a stable demo session pointing at the seed account. Cached for
    the lifetime of the process; refresh requires a restart.
    """
    global _cache
    if _cache is not None:
        return _cache
    account_id, user_id = await _resolve_seed_account()
    user = await db.user.find_unique(where={"id": user_id})
    account = await db.account_connection.find_unique(where={"id": account_id})
    if user is None or account is None:
        raise RuntimeError("Session resolution failed — user or account missing")
    _cache = Session(
        user_id=user.id,
        account_id=account.id,
        email=user.email,
        name=user.name,
    )
    return _cache


async def get_account_id() -> str:
    """Convenience: return just the active account id."""
    return (await get_session()).account_id
