"""Filter builders + post-filter helpers for structured search.

The structured-search route assembles a Prisma `where` clause from the
SearchFilters payload, but three filters cannot be expressed as Prisma
predicates against SQLite: `labels` (JSON-in-TEXT), `timeFrom/timeTo`
(time-of-day inside a timestamp), and `attachmentType` (attachment-mime
substring). These are applied post-query in Python — mirroring the
Next.js route's post-filter logic exactly.
"""
from __future__ import annotations

import json
from datetime import datetime

from app.domains.search.schemas import SearchFilters


def build_where(account_id: str, f: SearchFilters) -> dict:
    """Build the Prisma `where` clause from structured filters."""
    where: dict = {"accountId": account_id}
    or_clauses: list[dict] = []
    if f.query:
        or_clauses += [
            {"subject": {"contains": f.query}}, {"snippet": {"contains": f.query}},
            {"bodyText": {"contains": f.query}}, {"fromEmail": {"contains": f.query}},
            {"fromName": {"contains": f.query}},
        ]
    if f.sender:
        or_clauses += [{"fromEmail": {"contains": f.sender}}, {"fromName": {"contains": f.sender}}]
    if or_clauses:
        where["OR"] = or_clauses
    if f.isRead is not None:
        where["isRead"] = f.isRead
    if f.isStarred is not None:
        where["isStarred"] = f.isStarred
    if f.isImportant is not None:
        where["isImportant"] = f.isImportant
    if f.hasAttachment is not None:
        where["hasAttachment"] = f.hasAttachment
    if not f.includeSpam:
        where["isSpam"] = False
    if not f.includeDrafts:
        where["isDraft"] = False
    if not f.includeSent:
        where["isSent"] = False
    if not f.includeArchived:
        where["isArchived"] = False
    if f.categoryIds:
        where["memberships"] = {"some": {"categoryId": {"in": f.categoryIds}}}
    if f.dateFrom or f.dateTo:
        rng: dict = {}
        if f.dateFrom:
            rng["gte"] = datetime.fromisoformat(f.dateFrom)
        if f.dateTo:
            rng["lte"] = datetime.fromisoformat(f.dateTo)
        where["receivedAt"] = rng
    return where


def post_filter(rows: list, f: SearchFilters) -> list:
    """Apply SQLite-unfriendly filters: labels, time-of-day, attachment type."""
    out = rows
    if f.labels:
        wanted = set(f.labels)
        out = [r for r in out if wanted.intersection(_safe_labels(r.labels))]
    if f.timeFrom and f.timeTo:
        fh, fm = (int(x) for x in f.timeFrom.split(":"))
        th, tm = (int(x) for x in f.timeTo.split(":"))
        out = [r for r in out if _in_window(r.receivedAt, fh, fm, th, tm)]
    if f.attachmentType:
        needle = f.attachmentType.lower()
        out = [r for r in out if any(needle in a.mimeType.lower() for a in r.attachments)]
    return out


def _safe_labels(raw: str) -> list[str]:
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except Exception:
        return []


def _in_window(when, fh: int, fm: int, th: int, tm: int) -> bool:
    if when is None:
        return False
    mins = when.hour * 60 + when.minute
    return fh * 60 + fm <= mins <= th * 60 + tm
