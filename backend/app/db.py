"""Prisma client singleton.

Uses the ``prisma`` Python client (async). The client is configured to read
the **shared** Prisma schema at ``prisma/schema.prisma`` — the same file the
Next.js backend uses (see task 16-FP design rule: no business-logic
duplication, no schema duplication).

Lifecycle:
- ``connect()`` is awaited on FastAPI startup.
- ``disconnect()`` is awaited on FastAPI shutdown.
- The module-level ``db`` handle is import-safe; routes typically use
  ``get_db()`` from :mod:`app.api.deps`.
"""
from __future__ import annotations

import os
from pathlib import Path

from prisma import Prisma

# Resolve the shared schema relative to this file so the lookup works
# regardless of the process working directory.
_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "prisma" / "schema.prisma"
os.environ.setdefault("PRISMA_SCHEMA", str(_SCHEMA_PATH))

from app.config.settings import settings
os.environ.setdefault("DATABASE_URL", settings.database_url)
# Set DIRECT_URL if provided — Prisma needs this for operations that bypass pgbouncer.
if settings.direct_url:
    os.environ.setdefault("DIRECT_URL", settings.direct_url)

_client: Prisma | None = None


def get_client() -> Prisma:
    """Return the lazily-created Prisma singleton.

    The :class:`Prisma` constructor does not open a connection; the actual
    socket is established by :meth:`Prisma.connect`.
    """
    global _client
    if _client is None:
        _client = Prisma()  # reads DATABASE_URL from env
    return _client


async def connect() -> None:
    """Open the DB connection (called on FastAPI startup)."""
    await get_client().connect()


async def disconnect() -> None:
    """Close the DB connection (called on FastAPI shutdown)."""
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass


# Module-level handle. ``Prisma()`` is cheap; ``connect()`` is what opens
# the socket, so importing ``db`` is safe even before startup.
db = get_client()
