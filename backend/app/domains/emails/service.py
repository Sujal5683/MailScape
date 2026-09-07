"""Business logic for the emails domain.

Public surface re-exported from the smaller ``_list`` and ``_mutations``
modules so the router imports a single module. Each function is
account-scoped — every query filters by ``account_id`` from the session.
"""
from __future__ import annotations

from app.domains.emails._list import list_emails
from app.domains.emails._mutations import (
    bulk_action,
    get_email,
    mark_important,
    mark_read,
    snooze,
    star,
)

__all__ = [
    "bulk_action",
    "get_email",
    "list_emails",
    "mark_important",
    "mark_read",
    "snooze",
    "star",
]
