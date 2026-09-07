"""Business logic for the dashboard domain.

Orchestrates the aggregate queries in ``_aggregates.py``, then assembles
the deterministic AI brief from the result. Mirrors
``src/app/api/dashboard/route.ts``. No LLM call is made — the brief is
computed locally to keep the dashboard fast (per the perf spec).
"""
from __future__ import annotations

import asyncio

from prisma import Prisma

from app.domains.dashboard._aggregates import (
    action_items, category_counts, deadlines, kpi_totals,
    recent_activity, top_senders, trend_14d,
)
from app.domains.dashboard.schemas import (
    AIBrief, AIBriefHighlight, ActionItemRow, CategoryCount, DashboardData,
    DeadlineRow, KPITotals, RecentActivityRow, TopSender, TrendPoint,
)


def build_ai_brief(
    totals: dict[str, int], category_counts: list[dict],
) -> AIBrief:
    """Compose the deterministic AI brief from already-computed aggregates."""
    unread = totals["unread"]
    deadlines_open = totals["deadlinesOpen"]
    senders = totals["senders"]
    important = totals["important"]
    active_sections = sum(1 for c in category_counts if c["count"] > 0)
    top = max(category_counts, key=lambda c: c["count"], default=None)
    summary = (
        f"You have {unread} unread email{'' if unread == 1 else 's'} across "
        f"{active_sections} active sections. {deadlines_open} open deadline"
        f"{'' if deadlines_open == 1 else 's'} need attention"
        + (f', with "{top["name"]}" being your busiest section ({top["count"]}).'
           if top else ".")
    )
    return AIBrief(
        summary=summary,
        highlights=[
            AIBriefHighlight(label="Unread", value=str(unread)),
            AIBriefHighlight(label="Open deadlines", value=str(deadlines_open)),
            AIBriefHighlight(label="Important", value=str(important)),
            AIBriefHighlight(label="Active senders", value=str(senders)),
        ],
    )


async def get_dashboard(db: Prisma, account_id: str) -> DashboardData:
    """Assemble the full dashboard payload (mirrors GET /api/dashboard)."""
    totals, (cat_rows, cat_total), senders, trend, dl_rows, ai_rows, recent = (
        await asyncio.gather(
            kpi_totals(db, account_id),
            category_counts(db, account_id),
            top_senders(db, account_id),
            trend_14d(db, account_id),
            deadlines(db, account_id),
            action_items(db, account_id),
            recent_activity(db, account_id),
        )
    )
    return DashboardData(
        totals=KPITotals(**totals, categories=cat_total),  # type: ignore
        categoryCounts=[CategoryCount(**c) for c in cat_rows],  # type: ignore
        topSenders=[TopSender(**s) for s in senders],  # type: ignore
        trend=[TrendPoint(**t) for t in trend],  # type: ignore
        deadlines=[DeadlineRow(**d) for d in dl_rows],  # type: ignore
        actionItems=[ActionItemRow(**a) for a in ai_rows],  # type: ignore
        recentActivity=[RecentActivityRow(**r) for r in recent],  # type: ignore
        aiBrief=build_ai_brief(totals, cat_rows),  # type: ignore
    )
