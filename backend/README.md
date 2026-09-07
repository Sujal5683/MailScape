# Institutional Email Intelligence — FastAPI Backend

Clean, modular FastAPI foundation that will **eventually replace** the
existing Next.js API routes. This is **additive**: the Next.js backend
continues to be the primary API during migration.

## Stack

- Python 3.12+
- FastAPI + Uvicorn
- Pydantic v2 (+ `pydantic-settings`)
- Prisma Python client (async) — same `prisma/schema.prisma` as Next.js
- structlog (structured logging)
- slowapi (rate limiting, wired later)

## Layout

```
backend/
├── pyproject.toml
├── Dockerfile
├── README.md
└── app/
    ├── main.py              # FastAPI entry point
    ├── config/settings.py   # Pydantic Settings (env vars)
    ├── db.py                # Prisma client singleton
    ├── api/
    │   ├── deps.py          # get_db / get_session / get_account_id / pagination
    │   └── routes/health.py # GET /health, GET /ready
    ├── core/
    │   ├── security/auth.py        # session resolver (mirrors src/lib/auth.ts)
    │   ├── logging/setup.py        # structlog config + secret redaction
    │   ├── errors/handlers.py      # exception handlers + standard error body
    │   └── middleware/request_id.py
    ├── schemas/common.py    # ApiError, CursorPage[T], PaginationParams
    └── domains/             # (future) per-domain routers/services
```

Every file is single-responsibility and under 120 lines.

## Setup

### 1. Install dependencies

From the `backend/` directory:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

### 2. Configure environment

The settings module loads env vars from **both** `../.env` (project root,
shared with Next.js) and `./.env` (backend-local overrides). The only
required variable is:

```bash
DATABASE_URL=file:/home/z/my-project/db/custom.db
```

This is already set in the project-root `.env`, so the FastAPI app picks it
up automatically when launched from `backend/`.

In production (`ENV=prod`), all secrets must also be set:
`GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`NEXTAUTH_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

### 3. Generate the Prisma Python client

The `prisma` Python package needs its own generator entry in the shared
`prisma/schema.prisma`. Add this block **once** (it does not affect the
existing `prisma-client-js` generator used by Next.js):

```prisma
generator client_py {
  provider = "prisma client py"
  output   = "../backend/.prisma"
}
```

Then generate:

```bash
cd /home/z/my-project
prisma generate
```

> The Next.js backend is unaffected — `prisma generate` produces both
> clients in one pass.

### 4. Run the server

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

- Liveness: <http://localhost:8000/health>
- Readiness: <http://localhost:8000/ready> (checks the DB connection)
- OpenAPI docs: <http://localhost:8000/docs>

### 5. (Optional) Run in Docker

Build from the **project root** so the Dockerfile can access both
`backend/` and the shared `prisma/` schema:

```bash
cd /home/z/my-project
docker build -f backend/Dockerfile -t iei-backend .
docker run --rm -p 8000:8000 --env-file .env iei-backend
```

## Conventions

- **Async everywhere**: all route handlers and DB calls are `async def`.
- **Single error shape**: every error response is
  `{"code", "message", "requestId"}` (see `app/core/errors/handlers.py`).
  Raise `NotFound`, `ValidationFailed`, `PermissionDenied`, or
  `RateLimited` from any handler.
- **Request correlation**: every response carries `X-Request-ID`; the same
  id appears in all log lines for that request.
- **No secret logging**: `structlog` redacts email bodies, tokens, and
  other sensitive keys before any renderer sees them.
- **Account scoping**: every route depends on `get_session()` /
  `get_account_id()` so data is isolated per account (mirrors the Next.js
  `getSession()` contract).

## Migration notes

This is task **16-FP** (foundation). Subsequent tasks will port the 50
Next.js API routes domain-by-domain into `app/domains/<name>/` (router +
service + schemas), each route behaviour-mirroring the Next.js handler but
using the shared Prisma client and the standard error/logging middleware
defined here.
