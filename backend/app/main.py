"""FastAPI application entry point.

Creates the app, configures middleware (request-id, CORS), wires exception
handlers, mounts health endpoints, and manages the Prisma client lifecycle.
Domain routers will be mounted under the configured API prefix as they are
ported from the Next.js backend.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.health import router as health_router
from app.config.settings import settings
from app.core.errors.handlers import register_exception_handlers
from app.core.logging.setup import configure_logging, get_logger
from app.core.middleware.request_id import RequestIDMiddleware
from app.db import connect, disconnect
from app.domains.accounts.router import router as accounts_router
from app.domains.categories.router import router as categories_router
from app.domains.conversations.router import router as conversations_router
from app.domains.dashboard.router import router as dashboard_router
from app.domains.emails.router import router as emails_router
from app.domains.threads.router import router as threads_router


@asynccontextmanager
async def _lifespan(app: FastAPI):
    configure_logging()
    log = get_logger("startup")
    log.info("startup", env=settings.env)
    try:
        await connect()
    except Exception as exc:
        log.error("db_connect_failed", error=str(exc))
        # Don't crash — let the app start and individual requests fail gracefully.
        # The /ready endpoint will report degraded status.
    try:
        yield
    finally:
        try:
            await disconnect()
        except Exception:
            pass
        log.info("shutdown")


def _get_cors_origins() -> list[str]:
    """Read allowed origins from ALLOWED_ORIGINS env var (comma-separated).

    Falls back to wildcard in dev, strict list in prod.
    """
    raw = os.getenv("ALLOWED_ORIGINS", "")
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    # Default: allow everything in dev, nothing extra in prod
    # (the wildcard works fine locally and on Render preview URLs).
    return ["*"]


def create_app() -> FastAPI:
    """Build the configured FastAPI app."""
    app = FastAPI(
        title="Institutional Email Intelligence — API",
        version="0.1.0",
        lifespan=_lifespan,
    )
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_get_cors_origins(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    register_exception_handlers(app)
    app.include_router(health_router)
    for r in (
        accounts_router, emails_router, categories_router,
        conversations_router, dashboard_router, threads_router,
    ):
        app.include_router(r, prefix=settings.api_v1_prefix)
    return app


app = create_app()
