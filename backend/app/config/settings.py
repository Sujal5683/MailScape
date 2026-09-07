"""Application settings.

Reads configuration from environment variables (and ``.env`` if present).
Required variables are validated at startup; the app fails fast if any
declared required value is missing. Secrets are only required in prod.

Env file lookup order (later files win): ``../.env`` (project root, shared
with the Next.js app), then ``./.env`` (backend-local overrides).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application configuration."""

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Runtime -------------------------------------------------------
    env: Literal["dev", "prod", "test"] = Field(default="dev")
    api_v1_prefix: str = Field(default="/api/v1")
    log_level: str = Field(default="INFO")

    # --- Database (REQUIRED) -------------------------------------------
    database_url: str = Field(..., description="SQLite/Postgres connection string")

    # --- Secrets (optional in dev, required in prod) -------------------
    gemini_api_key: str | None = None
    google_client_id: str | None = None
    google_client_secret: str | None = None
    nextauth_secret: str | None = None
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None

    @model_validator(mode="after")
    def _enforce_prod_secrets(self) -> "Settings":
        """Fail fast in prod if any required secret is missing."""
        if self.env != "prod":
            return self
        required = (
            "gemini_api_key",
            "google_client_id",
            "google_client_secret",
            "nextauth_secret",
            "vapid_public_key",
            "vapid_private_key",
        )
        missing = [n for n in required if not getattr(self, n)]
        if missing:
            raise ValueError(
                f"Missing required secrets in prod env: {', '.join(missing)}"
            )
        return self

    @property
    def is_prod(self) -> bool:
        """True when running in production."""
        return self.env == "prod"

    @property
    def is_dev(self) -> bool:
        """True when running in development."""
        return self.env == "dev"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance (once per process)."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
