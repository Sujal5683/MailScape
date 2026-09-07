"""Conversations domain package.

Routes for the conversation-intelligence layer: list summaries, fetch full
detail with messages + changes, patch status/followUp/importance, and look
up the conversation for a given email. Mirrors
``src/app/api/conversations/**/route.ts`` and
``src/app/api/emails/[messageId]/conversation/route.ts``.
"""
