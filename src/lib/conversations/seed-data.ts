/**
 * Conversation seed data — multi-message institutional email conversations
 * that demonstrate the conversation intelligence feature.
 *
 * These flow through the REAL normalization → classification → conversation
 * resolution pipeline, just like all other seed emails.
 */

import type { RawEmail } from '@/lib/sync/seed-data'

const daysAgo = (d: number, h = 9, m = 0): string => {
  const dt = new Date()
  dt.setDate(dt.getDate() - d)
  dt.setHours(h, m, 0, 0)
  return dt.toISOString()
}

const iit = 'iitjammu.ac.in'

/**
 * Conversation 1: Internship at ABC Corp — 4 messages across 2 threads.
 * Thread A: Initial announcement + student query + eligibility clarification.
 * Thread B: Updated deadline reminder (separate thread, same conversation).
 */
export const CONVERSATION_SEED_EMAILS: RawEmail[] = [
  // ---- Conversation 1, Thread A: 3 messages ----
  {
    providerMessageId: 'msg-conv1-a1',
    providerThreadId: 'thread-conv1-a',
    fromName: 'Placement Office',
    fromEmail: `placement@${iit}`,
    toRecipients: [{ email: 'btech2023.cs@iitjammu.ac.in' }],
    subject: 'Internship Opportunity — ABC Corp',
    bodyText:
      'Dear Students,\n\nABC Corp is offering a Summer 2025 internship for B.Tech students. ' +
      'Eligibility: CGPA >= 6.5, all branches. Deadline: 10 September. ' +
      'Location: Bangalore. ' +
      'Submit your resume via the placement portal.\n\nRegards,\nPlacement Office',
    bodyHtml:
      '<p>Dear Students,</p><p>ABC Corp is offering a Summer 2025 internship for B.Tech students. ' +
      '<strong>Eligibility: CGPA &gt;= 6.5, all branches. Deadline: 10 September. Location: Bangalore.</strong> ' +
      'Submit your resume via the placement portal.</p><p>Regards,<br/>Placement Office</p>',
    receivedAt: daysAgo(5, 10, 0),
    isRead: true,
    isStarred: false,
    isImportant: true,
    labels: ['inbox', 'important'],
  },
  {
    providerMessageId: 'msg-conv1-a2',
    providerThreadId: 'thread-conv1-a',
    fromName: 'Aarav Sharma',
    fromEmail: 'btech2023.cs@iitjammu.ac.in',
    toRecipients: [{ email: `placement@${iit}` }],
    subject: 'Re: Internship Opportunity — ABC Corp',
    bodyText:
      'Dear Placement Office,\n\nCould you clarify if Civil Engineering students are eligible for this internship? ' +
      'The announcement says "all branches" but I wanted to confirm.\n\nAlso, is the CGPA requirement 6.5 or 7.0?\n\nRegards,\nAarav',
    bodyHtml:
      '<p>Dear Placement Office,</p><p>Could you clarify if Civil Engineering students are eligible for this internship? ' +
      'The announcement says "all branches" but I wanted to confirm.</p><p>Also, is the CGPA requirement 6.5 or 7.0?</p><p>Regards,<br/>Aarav</p>',
    receivedAt: daysAgo(4, 14, 30),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox', 'sent'],
    isSent: true,
  },
  {
    providerMessageId: 'msg-conv1-a3',
    providerThreadId: 'thread-conv1-a',
    fromName: 'Placement Office',
    fromEmail: `placement@${iit}`,
    toRecipients: [{ email: 'btech2023.cs@iitjammu.ac.in' }],
    subject: 'Re: Internship Opportunity — ABC Corp',
    bodyText:
      'Dear Aarav,\n\nYes, Civil Engineering students are eligible. ' +
      'Updated eligibility: CGPA >= 7.0 (revised from 6.5). ' +
      'All branches are welcome to apply.\n\nRegards,\nPlacement Office',
    bodyHtml:
      '<p>Dear Aarav,</p><p>Yes, Civil Engineering students are eligible. ' +
      '<strong>Updated eligibility: CGPA &gt;= 7.0 (revised from 6.5).</strong> ' +
      'All branches are welcome to apply.</p><p>Regards,<br/>Placement Office</p>',
    receivedAt: daysAgo(3, 11, 0),
    isRead: false,
    isStarred: false,
    isImportant: true,
    labels: ['inbox', 'important'],
  },

  // ---- Conversation 1, Thread B: separate thread, same conversation (reminder) ----
  {
    providerMessageId: 'msg-conv1-b1',
    providerThreadId: 'thread-conv1-b',
    fromName: 'Placement Office',
    fromEmail: `placement@${iit}`,
    toRecipients: [{ email: 'btech2023.cs@iitjammu.ac.in' }],
    subject: 'Reminder: ABC Corp Internship Deadline Updated',
    bodyText:
      'Dear Students,\n\nThis is a reminder that the ABC Corp internship deadline has been updated. ' +
      'New deadline: 7 September (earlier was 10 September). ' +
      'Eligibility: CGPA >= 7.0, all branches. Location: Bangalore. ' +
      'Please apply immediately if you haven\'t already.\n\nRegards,\nPlacement Office',
    bodyHtml:
      '<p>Dear Students,</p><p>This is a reminder that the ABC Corp internship deadline has been updated. ' +
      '<strong>New deadline: 7 September (earlier was 10 September).</strong> ' +
      'Eligibility: CGPA &gt;= 7.0, all branches. Location: Bangalore. ' +
      'Please apply immediately if you haven\'t already.</p><p>Regards,<br/>Placement Office</p>',
    receivedAt: daysAgo(1, 16, 0),
    isRead: false,
    isStarred: true,
    isImportant: true,
    labels: ['inbox', 'important'],
    attachments: [{ filename: 'Updated_Eligibility.pdf', mimeType: 'application/pdf', size: 45000 }],
  },

  // ---- Conversation 2: Professor project discussion — 3 messages in 1 thread ----
  {
    providerMessageId: 'msg-conv2-1',
    providerThreadId: 'thread-conv2',
    fromName: 'Dr. Rajesh Kumar',
    fromEmail: `rkumar@${iit}`,
    toRecipients: [{ email: 'btech2023.cs@iitjammu.ac.in' }],
    subject: 'Research Project — Transformer Architecture Survey',
    bodyText:
      'Hi Aarav,\n\nI\'d like you to work on a survey of transformer architectures for your semester project. ' +
      'Focus on attention mechanisms, positional encoding, and efficiency improvements. ' +
      'Submit a 2-page proposal by 15 September.\n\nBest,\nDr. Kumar',
    bodyHtml:
      '<p>Hi Aarav,</p><p>I\'d like you to work on a survey of transformer architectures for your semester project. ' +
      'Focus on attention mechanisms, positional encoding, and efficiency improvements. ' +
      'Submit a 2-page proposal by 15 September.</p><p>Best,<br/>Dr. Kumar</p>',
    receivedAt: daysAgo(6, 9, 0),
    isRead: true,
    isStarred: true,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-conv2-2',
    providerThreadId: 'thread-conv2',
    fromName: 'Aarav Sharma',
    fromEmail: 'btech2023.cs@iitjammu.ac.in',
    toRecipients: [{ email: `rkumar@${iit}` }],
    subject: 'Re: Research Project — Transformer Architecture Survey',
    bodyText:
      'Dear Dr. Kumar,\n\nThank you for the opportunity. I\'ve started reading the Vaswani et al. paper. ' +
      'Should I also cover recent efficient architectures like Linformer and Performer? ' +
      'Also, can the proposal deadline be extended to 18 September?\n\nRegards,\nAarav',
    bodyHtml:
      '<p>Dear Dr. Kumar,</p><p>Thank you for the opportunity. I\'ve started reading the Vaswani et al. paper. ' +
      'Should I also cover recent efficient architectures like Linformer and Performer? ' +
      'Also, can the proposal deadline be extended to 18 September?</p><p>Regards,<br/>Aarav</p>',
    receivedAt: daysAgo(5, 20, 0),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox', 'sent'],
    isSent: true,
  },
  {
    providerMessageId: 'msg-conv2-3',
    providerThreadId: 'thread-conv2',
    fromName: 'Dr. Rajesh Kumar',
    fromEmail: `rkumar@${iit}`,
    toRecipients: [{ email: 'btech2023.cs@iitjammu.ac.in' }],
    subject: 'Re: Research Project — Transformer Architecture Survey',
    bodyText:
      'Hi Aarav,\n\nYes, please cover Linformer and Performer as well. ' +
      'Updated proposal deadline: 18 September (extended from 15 September). ' +
      'Bring an outline to our Thursday meeting.\n\nBest,\nDr. Kumar',
    bodyHtml:
      '<p>Hi Aarav,</p><p>Yes, please cover Linformer and Performer as well. ' +
      '<strong>Updated proposal deadline: 18 September (extended from 15 September).</strong> ' +
      'Bring an outline to our Thursday meeting.</p><p>Best,<br/>Dr. Kumar</p>',
    receivedAt: daysAgo(4, 8, 30),
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
]
