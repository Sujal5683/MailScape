# syntax=docker/dockerfile:1.6
#
# Production image for the FastAPI backend.
# Build context = project root. Build with:
#   docker build -f backend/Dockerfile -t iei-backend .
#
# The image runs uvicorn on port 8000 with a non-root user and a curl-based
# healthcheck against GET /health.

FROM python:3.12-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System deps required to build Python wheels (cryptography, etc.) and to
# run the healthcheck (curl).
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libssl-dev curl \
    && rm -rf /var/lib/apt/lists/*

# --- Install Python deps (cached layer) -------------------------------------
COPY backend/pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# --- Application source + shared Prisma schema ------------------------------
COPY backend/app ./app
COPY prisma ./prisma

# Generate the Prisma Python client at build time. This is a no-op until the
# python generator block is added to prisma/schema.prisma (see README); the
# `|| true` keeps the build resilient during early migration.
RUN prisma generate || true

# --- Non-root user + healthcheck --------------------------------------------
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/health || exit 1

ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
