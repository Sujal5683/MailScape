"""Pydantic schemas for the compose domain.

Mirrors `Recipient`, `Draft` in `src/lib/types.ts` and the send-request
contract implied by `src/app/api/compose/send/route.ts`. The send endpoint
requires ``confirm: True`` — a missing/false flag is rejected with 409
so the client must explicitly opt in to the irreversible send action.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Recipient(BaseModel):
    """One email recipient. ``name`` is optional."""

    email: str
    name: str | None = None


class DraftCreate(BaseModel):
    """Body for POST /compose/drafts."""

    accountId: str | None = None
    to: list[Recipient] = Field(default_factory=list)
    cc: list[Recipient] = Field(default_factory=list)
    subject: str = ""
    body: str = ""


class Draft(BaseModel):
    """Public draft shape returned by POST /compose/drafts."""

    id: str
    accountId: str = Field(alias="accountId")
    toRecipients: list[Recipient] = Field(default_factory=list)
    ccRecipients: list[Recipient] = Field(default_factory=list)
    subject: str | None = None
    body: str | None = None
    createdAt: str
    updatedAt: str

    model_config = ConfigDict(populate_by_name=True)


class SendRequest(BaseModel):
    """Body for POST /compose/send. ``confirm`` MUST be true to proceed."""

    accountId: str | None = None
    to: list[Recipient] = Field(default_factory=list)
    cc: list[Recipient] = Field(default_factory=list)
    subject: str = ""
    body: str = ""
    confirm: bool = False


class SendResponse(BaseModel):
    """Response for POST /compose/send."""

    ok: bool = True
    messageId: str


class RecipientSearchResult(BaseModel):
    """One autocomplete suggestion for the recipient typeahead."""

    name: str | None = None
    email: str
