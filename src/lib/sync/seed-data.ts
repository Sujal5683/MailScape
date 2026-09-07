// Realistic institutional email corpus.
// These flow through the REAL normalization + rules + classification pipeline.
// This is demo data standing in for the Gmail API source (no real OAuth creds available).

export interface RawEmail {
  providerMessageId: string
  providerThreadId: string
  fromName: string
  fromEmail: string
  toRecipients: { name?: string; email: string }[]
  ccRecipients?: { name?: string; email: string }[]
  subject: string
  bodyText: string
  bodyHtml: string
  receivedAt: string // ISO
  isRead: boolean
  isStarred: boolean
  isImportant: boolean
  // Mailbox bucket flags — optional, default false. Used by the Drafts / Sent /
  // Spam views to surface the appropriate subset. isArchived stays false here
  // (the Archive view is populated via the bulk 'archive' action in the UI).
  isDraft?: boolean
  isSent?: boolean
  isSpam?: boolean
  labels?: string[]
  attachments?: { filename: string; mimeType: string; size: number }[]
}

const iit = 'iitjammu.ac.in'

// Generate ISO timestamps relative to now.
const daysAgo = (d: number, h = 9, m = 0): string => {
  const dt = new Date()
  dt.setDate(dt.getDate() - d)
  dt.setHours(h, m, 0, 0)
  return dt.toISOString()
}

export const SEED_ACCOUNT = {
  providerAccountId: 'demo-1043287562398',
  emailAddress: 'btech2023.cs@iitjammu.ac.in',
  displayName: 'Aarav Sharma',
}

export const SEED_EMAILS: RawEmail[] = [
  // ---------------- Placement ----------------
  {
    providerMessageId: 'msg-placement-1',
    providerThreadId: 'thread-placement-1',
    fromName: 'Placement Office',
    fromEmail: `placement@${iit}`,
    toRecipients: [{ name: 'BTech 2023', email: SEED_ACCOUNT.emailAddress }],
    subject: 'Summer Internship 2025 — Application Window Opens Monday',
    bodyText:
      'Dear Students,\n\nThe Summer Internship 2025 application window opens on Monday at 10:00 AM. ' +
      'Eligibility: CGPA >= 7.5, no active backlogs. Submit your resume and transcript through the placement portal.\n\n' +
      'Deadline to apply: 25th of this month, 11:59 PM.\n\nCompanies visiting this season include Google, Microsoft, Goldman Sachs, and Texas Instruments.\n\n' +
      'Regards,\nPlacement Office\nIIT Jammu',
    bodyHtml:
      '<p>Dear Students,</p><p>The Summer Internship 2025 application window opens on <strong>Monday at 10:00 AM</strong>. ' +
      'Eligibility: CGPA &gt;= 7.5, no active backlogs. Submit your resume and transcript through the placement portal.</p>' +
      '<p><strong>Deadline to apply: 25th of this month, 11:59 PM.</strong></p>' +
      '<p>Companies visiting this season include Google, Microsoft, Goldman Sachs, and Texas Instruments.</p>' +
      '<p>Regards,<br/>Placement Office<br/>IIT Jammu</p>',
    receivedAt: daysAgo(1, 9, 12),
    isRead: false,
    isStarred: true,
    isImportant: true,
    labels: ['inbox', 'important'],
    attachments: [
      { filename: 'Internship_Notice_2025.pdf', mimeType: 'application/pdf', size: 248320 },
      { filename: 'Eligibility_Matrix.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 54200 },
    ],
  },
  {
    providerMessageId: 'msg-placement-2',
    providerThreadId: 'thread-placement-1',
    fromName: 'Placement Office',
    fromEmail: `placement@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Re: Summer Internship 2025 — Pre-Placement Talk Schedule',
    bodyText:
      'A pre-placement talk has been scheduled for this Friday, 4:00 PM, Auditorium 1. ' +
      'Attendance is mandatory for all internship applicants. Bring your student ID card.',
    bodyHtml: '<p>A pre-placement talk has been scheduled for <strong>this Friday, 4:00 PM, Auditorium 1</strong>. ' +
      'Attendance is mandatory for all internship applicants. Bring your student ID card.</p>',
    receivedAt: daysAgo(0, 11, 30),
    isRead: false,
    isStarred: false,
    isImportant: true,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-placement-3',
    providerThreadId: 'thread-placement-2',
    fromName: 'Career Development Cell',
    fromEmail: `cdc@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Resume Workshop — Register by Wednesday',
    bodyText:
      'The Career Development Cell is conducting a resume workshop this Saturday. ' +
      'Limited seats (60). Register on the CDC portal. Topics: ATS-friendly formatting, project highlights, quantifying impact.',
    bodyHtml: '<p>The Career Development Cell is conducting a <strong>resume workshop this Saturday</strong>. ' +
      'Limited seats (60). Register on the CDC portal. Topics: ATS-friendly formatting, project highlights, quantifying impact.</p>',
    receivedAt: daysAgo(2, 14, 5),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-placement-4',
    providerThreadId: 'thread-placement-3',
    fromName: 'Placement Office',
    fromEmail: `placement@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Company-wise Shortlist Released — Check Portal',
    bodyText:
      'The company-wise shortlist for the first round of placements has been released. ' +
      'Check the placement portal for your status. Shortlisted students must confirm participation within 48 hours.',
    bodyHtml: '<p>The company-wise shortlist for the first round of placements has been released. ' +
      'Check the placement portal for your status. Shortlisted students must confirm participation within 48 hours.</p>',
    receivedAt: daysAgo(4, 16, 45),
    isRead: true,
    isStarred: false,
    isImportant: true,
    labels: ['inbox'],
    attachments: [{ filename: 'Shortlist_Round1.pdf', mimeType: 'application/pdf', size: 182400 }],
  },

  // ---------------- Academic ----------------
  {
    providerMessageId: 'msg-academic-1',
    providerThreadId: 'thread-academic-1',
    fromName: 'Academic Office',
    fromEmail: `academic@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    ccRecipients: [{ name: 'Faculty Coordinator', email: `dean.academic@${iit}` }],
    subject: 'Mid-Semester Examination Schedule — Semester 4',
    bodyText:
      'The mid-semester examination schedule for Semester 4 has been finalized. Examinations begin next Monday. ' +
      'Seating arrangements will be published 24 hours before each exam. Report 30 minutes early with your ID card.',
    bodyHtml: '<p>The mid-semester examination schedule for Semester 4 has been finalized. Examinations begin <strong>next Monday</strong>. ' +
      'Seating arrangements will be published 24 hours before each exam. Report 30 minutes early with your ID card.</p>',
    receivedAt: daysAgo(1, 8, 50),
    isRead: false,
    isStarred: true,
    isImportant: true,
    labels: ['inbox', 'important'],
    attachments: [
      { filename: 'MidSem_Schedule_S4.pdf', mimeType: 'application/pdf', size: 96400 },
    ],
  },
  {
    providerMessageId: 'msg-academic-2',
    providerThreadId: 'thread-academic-2',
    fromName: 'Registrar',
    fromEmail: `registrar@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Course Registration Window — Semester 5',
    bodyText:
      'Course registration for Semester 5 opens on the 18th. Review your elective options and discuss with your faculty advisor. ' +
      'Registration closes on the 22nd. Late registration attracts a fee.',
    bodyHtml: '<p>Course registration for Semester 5 opens on the <strong>18th</strong>. Review your elective options and discuss with your faculty advisor. ' +
      'Registration closes on the <strong>22nd</strong>. Late registration attracts a fee.</p>',
    receivedAt: daysAgo(3, 10, 15),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-academic-3',
    providerThreadId: 'thread-academic-2',
    fromName: 'Academic Office',
    fromEmail: `academic@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Re: Course Registration — Elective Prerequisites Updated',
    bodyText:
      'Please note the prerequisites for CS543 (Advanced Machine Learning) have been updated. ' +
      'You must have completed CS343 with a grade of B or higher. Verify your eligibility before registering.',
    bodyHtml: '<p>Please note the prerequisites for <strong>CS543 (Advanced Machine Learning)</strong> have been updated. ' +
      'You must have completed CS343 with a grade of B or higher. Verify your eligibility before registering.</p>',
    receivedAt: daysAgo(3, 13, 22),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-academic-4',
    providerThreadId: 'thread-academic-3',
    fromName: 'Examination Cell',
    fromEmail: `examcell@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Grade Card — Semester 3 Published',
    bodyText:
      'Your grade card for Semester 3 has been published on the academic portal. ' +
      'For re-evaluation requests, submit the form within 7 days along with the prescribed fee.',
    bodyHtml: '<p>Your grade card for Semester 3 has been published on the academic portal. ' +
      'For re-evaluation requests, submit the form within 7 days along with the prescribed fee.</p>',
    receivedAt: daysAgo(6, 9, 5),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
    attachments: [{ filename: 'GradeCard_S3.pdf', mimeType: 'application/pdf', size: 64200 }],
  },

  // ---------------- Professors ----------------
  {
    providerMessageId: 'msg-prof-1',
    providerThreadId: 'thread-prof-1',
    fromName: 'Dr. Rajesh Kumar',
    fromEmail: `rkumar@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Project Meeting — Literature Review Discussion',
    bodyText:
      'Hi Aarav,\n\nLet us meet this Thursday at 3 PM to discuss your literature review draft. ' +
      'Please bring an updated outline and at least 8 references. Focus on transformer architectures for your survey.\n\nBest,\nDr. Kumar',
    bodyHtml: '<p>Hi Aarav,</p><p>Let us meet this <strong>Thursday at 3 PM</strong> to discuss your literature review draft. ' +
      'Please bring an updated outline and at least 8 references. Focus on transformer architectures for your survey.</p><p>Best,<br/>Dr. Kumar</p>',
    receivedAt: daysAgo(0, 15, 30),
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-prof-2',
    providerThreadId: 'thread-prof-1',
    fromName: 'Dr. Rajesh Kumar',
    fromEmail: `rkumar@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Re: Project Meeting — Updated Reference List Attached',
    bodyText:
      'Attaching an updated reference list for your survey. Pay attention to papers 4, 7, and 12 — they form the conceptual backbone. ' +
      'Also, please proofread section 2.3 of your draft; the formalism needs tightening.',
    bodyHtml: '<p>Attaching an updated reference list for your survey. Pay attention to papers 4, 7, and 12 — they form the conceptual backbone. ' +
      'Also, please proofread section 2.3 of your draft; the formalism needs tightening.</p>',
    receivedAt: daysAgo(0, 16, 10),
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
    attachments: [
      { filename: 'References_v2.pdf', mimeType: 'application/pdf', size: 142000 },
      { filename: 'Draft_Survey_v1.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 88400 },
    ],
  },
  {
    providerMessageId: 'msg-prof-3',
    providerThreadId: 'thread-prof-2',
    fromName: 'Prof. Anjali Verma',
    fromEmail: `averma@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'DBMS Assignment 4 — Submission Extension',
    bodyText:
      'The submission deadline for DBMS Assignment 4 has been extended to this Sunday, 11:59 PM. ' +
      'No further extensions. Submit via the course portal with your name and roll number in the filename.',
    bodyHtml: '<p>The submission deadline for DBMS Assignment 4 has been extended to <strong>this Sunday, 11:59 PM</strong>. ' +
      'No further extensions. Submit via the course portal with your name and roll number in the filename.</p>',
    receivedAt: daysAgo(2, 18, 0),
    isRead: true,
    isStarred: false,
    isImportant: true,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-prof-4',
    providerThreadId: 'thread-prof-3',
    fromName: 'Dr. Rajesh Kumar',
    fromEmail: `rkumar@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Recommendation Letter — Please Share Details',
    bodyText:
      'I would be happy to write a recommendation letter for your internship applications. ' +
      'Please share your updated CV, transcript, a list of target companies, and a short note on why you are interested in each. ' +
      'Give me at least two weeks before the first deadline.',
    bodyHtml: '<p>I would be happy to write a recommendation letter for your internship applications. ' +
      'Please share your updated CV, transcript, a list of target companies, and a short note on why you are interested in each. ' +
      'Give me at least two weeks before the first deadline.</p>',
    receivedAt: daysAgo(5, 11, 25),
    isRead: true,
    isStarred: true,
    isImportant: false,
    labels: ['inbox', 'starred'],
  },

  // ---------------- Research ----------------
  {
    providerMessageId: 'msg-research-1',
    providerThreadId: 'thread-research-1',
    fromName: 'Research Cell',
    fromEmail: `research@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'SRIP 2025 — Summer Research Proposals Invited',
    bodyText:
      'The Summer Research Internship Programme (SRIP) 2025 proposals are now invited. ' +
      'Submit a 2-page proposal with your faculty mentor. Stipend: Rs 15,000/month for 8 weeks. ' +
      'Proposal deadline: end of this month.',
    bodyHtml: '<p>The Summer Research Internship Programme (SRIP) 2025 proposals are now invited. ' +
      'Submit a 2-page proposal with your faculty mentor. Stipend: Rs 15,000/month for 8 weeks. ' +
      '<strong>Proposal deadline: end of this month.</strong></p>',
    receivedAt: daysAgo(2, 9, 40),
    isRead: false,
    isStarred: false,
    isImportant: true,
    labels: ['inbox', 'important'],
    attachments: [{ filename: 'SRIP_2025_Guidelines.pdf', mimeType: 'application/pdf', size: 210400 }],
  },
  {
    providerMessageId: 'msg-research-2',
    providerThreadId: 'thread-research-2',
    fromName: 'Central Library',
    fromEmail: `library@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Inter-Library Loan — Your Requested Paper Has Arrived',
    bodyText:
      'The paper you requested via inter-library loan ("Attention Is All You Need", Vaswani et al.) is now available. ' +
      'Collect it from the issue desk within 3 days. Digital copy has been emailed separately for your convenience.',
    bodyHtml: '<p>The paper you requested via inter-library loan (<em>"Attention Is All You Need"</em>, Vaswani et al.) is now available. ' +
      'Collect it from the issue desk within 3 days. Digital copy has been emailed separately for your convenience.</p>',
    receivedAt: daysAgo(7, 14, 0),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-research-3',
    providerThreadId: 'thread-research-3',
    fromName: 'IEEE Student Branch',
    fromEmail: `ieee.sb@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Paper Presentation Contest — Submit Abstract by Friday',
    bodyText:
      'The IEEE Student Branch is organizing a paper presentation contest. Submit a 250-word abstract by this Friday. ' +
      'Top 3 presentations win cash prizes and a chance to present at the section congress.',
    bodyHtml: '<p>The IEEE Student Branch is organizing a paper presentation contest. Submit a 250-word abstract by <strong>this Friday</strong>. ' +
      'Top 3 presentations win cash prizes and a chance to present at the section congress.</p>',
    receivedAt: daysAgo(3, 17, 20),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },

  // ---------------- Student Welfare ----------------
  {
    providerMessageId: 'msg-welfare-1',
    providerThreadId: 'thread-welfare-1',
    fromName: 'Student Welfare Office',
    fromEmail: `swelfare@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Mental Health Awareness Week — Free Counseling Sessions',
    bodyText:
      'As part of Mental Health Awareness Week, the Student Welfare Office is offering free counseling sessions. ' +
      'Book a slot through the wellness portal. All sessions are confidential. Walk-ins also welcome at the wellness center.',
    bodyHtml: '<p>As part of Mental Health Awareness Week, the Student Welfare Office is offering free counseling sessions. ' +
      'Book a slot through the wellness portal. All sessions are confidential. Walk-ins also welcome at the wellness center.</p>',
    receivedAt: daysAgo(1, 10, 0),
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-welfare-2',
    providerThreadId: 'thread-welfare-2',
    fromName: 'Sports Cell',
    fromEmail: `sports@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Inter-Hostel Cricket Tournament — Team Registration Open',
    bodyText:
      'Registrations for the Inter-Hostel Cricket Tournament are open. Each hostel can field 2 teams. ' +
      'Submit your team list to your hostel sports rep by Wednesday. Tournament begins next Monday.',
    bodyHtml: '<p>Registrations for the Inter-Hostel Cricket Tournament are open. Each hostel can field 2 teams. ' +
      'Submit your team list to your hostel sports rep by Wednesday. Tournament begins next Monday.</p>',
    receivedAt: daysAgo(4, 12, 30),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-welfare-3',
    providerThreadId: 'thread-welfare-3',
    fromName: 'Scholarship Cell',
    fromEmail: `scholarship@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Merit-Cum-Means Scholarship — Renewal Application',
    bodyText:
      'Your Merit-Cum-Means scholarship is up for renewal. Submit the renewal form with your latest income certificate ' +
      'and grade card. Last date for submission: 20th of this month.',
    bodyHtml: '<p>Your Merit-Cum-Means scholarship is up for renewal. Submit the renewal form with your latest income certificate ' +
      'and grade card. <strong>Last date for submission: 20th of this month.</strong></p>',
    receivedAt: daysAgo(5, 9, 15),
    isRead: true,
    isStarred: true,
    isImportant: true,
    labels: ['inbox', 'important'],
    attachments: [{ filename: 'MCM_Renewal_Form.pdf', mimeType: 'application/pdf', size: 78600 }],
  },

  // ---------------- Medical ----------------
  {
    providerMessageId: 'msg-medical-1',
    providerThreadId: 'thread-medical-1',
    fromName: 'Medical Center',
    fromEmail: `medical@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Annual Health Check-up — Slot Booking Open',
    bodyText:
      'The annual health check-up for students is scheduled over the next two weeks. Book your slot via the medical portal. ' +
      'Fasting of 10 hours is required for blood tests. Report 15 minutes before your slot.',
    bodyHtml: '<p>The annual health check-up for students is scheduled over the next two weeks. Book your slot via the medical portal. ' +
      'Fasting of 10 hours is required for blood tests. Report 15 minutes before your slot.</p>',
    receivedAt: daysAgo(2, 8, 30),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-medical-2',
    providerThreadId: 'thread-medical-2',
    fromName: 'Medical Center',
    fromEmail: `medical@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Flu Vaccination Drive — Free for Students',
    bodyText:
      'A free flu vaccination drive is being conducted at the Medical Center this Wednesday and Thursday, 10 AM to 4 PM. ' +
      'Bring your student ID. Limited doses available — first come first served.',
    bodyHtml: '<p>A free flu vaccination drive is being conducted at the Medical Center this Wednesday and Thursday, 10 AM to 4 PM. ' +
      'Bring your student ID. Limited doses available — first come first served.</p>',
    receivedAt: daysAgo(8, 11, 0),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },

  // ---------------- Hostel ----------------
  {
    providerMessageId: 'msg-hostel-1',
    providerThreadId: 'thread-hostel-1',
    fromName: 'Hostel Office',
    fromEmail: `hostel@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Room Allotment — Semester 5 (2025-26)',
    bodyText:
      'Room allotment for Semester 5 is now open. Current residents get priority for their existing rooms if they confirm by the 15th. ' +
      'Indicate your preference on the hostel portal. Room swap requests will be entertained after the 20th.',
    bodyHtml: '<p>Room allotment for Semester 5 is now open. Current residents get priority for their existing rooms if they confirm by the <strong>15th</strong>. ' +
      'Indicate your preference on the hostel portal. Room swap requests will be entertained after the 20th.</p>',
    receivedAt: daysAgo(3, 9, 50),
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-hostel-2',
    providerThreadId: 'thread-hostel-2',
    fromName: 'Mess Committee',
    fromEmail: `mess@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Mess Menu Feedback — March 2025',
    bodyText:
      'Please fill the mess menu feedback form for March. Your input directly shapes next month menu. ' +
      'Special dietary requests ( Jain / vegan / gluten-free ) can be indicated in the form.',
    bodyHtml: '<p>Please fill the mess menu feedback form for March. Your input directly shapes next month menu. ' +
      'Special dietary requests (Jain / vegan / gluten-free) can be indicated in the form.</p>',
    receivedAt: daysAgo(6, 19, 0),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-hostel-3',
    providerThreadId: 'thread-hostel-3',
    fromName: 'Hostel Office',
    fromEmail: `hostel@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Hostel Maintenance — Water Supply Interruption Notice',
    bodyText:
      'Water supply in Block B will be interrupted this Saturday from 8 AM to 2 PM for tank cleaning. ' +
      'Please store adequate water in advance. Inconvenience is regretted.',
    bodyHtml: '<p>Water supply in Block B will be interrupted this Saturday from 8 AM to 2 PM for tank cleaning. ' +
      'Please store adequate water in advance. Inconvenience is regretted.</p>',
    receivedAt: daysAgo(9, 7, 45),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },

  // ---------------- Events ----------------
  {
    providerMessageId: 'msg-events-1',
    providerThreadId: 'thread-events-1',
    fromName: 'Cultural Committee',
    fromEmail: `cultural@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Utsav 2025 — Cultural Fest Registrations Open',
    bodyText:
      'Utsav 2025, our annual cultural fest, is back! Registrations for solo and group events are open. ' +
      'Early bird discount on group events until the 14th. Highlights: Battle of Bands, Nukkad Natak, Dance-Off.',
    bodyHtml: '<p>Utsav 2025, our annual cultural fest, is back! Registrations for solo and group events are open. ' +
      'Early bird discount on group events until the <strong>14th</strong>. Highlights: Battle of Bands, Nukkad Natak, Dance-Off.</p>',
    receivedAt: daysAgo(2, 13, 45),
    isRead: false,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-events-2',
    providerThreadId: 'thread-events-2',
    fromName: 'Tech Board',
    fromEmail: `techboard@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Hackathon 2025 — 36 Hours, Rs 1 Lakh Prize Pool',
    bodyText:
      'Hackathon 2025 is here! 36 hours of coding, Rs 1 lakh prize pool, and mentorship from industry experts. ' +
      'Form teams of 2-4. Registration closes this Sunday. Themes: AI for Good, Climate Tech, FinTech.',
    bodyHtml: '<p>Hackathon 2025 is here! 36 hours of coding, Rs 1 lakh prize pool, and mentorship from industry experts. ' +
      'Form teams of 2-4. Registration closes this Sunday. Themes: AI for Good, Climate Tech, FinTech.</p>',
    receivedAt: daysAgo(1, 17, 30),
    isRead: false,
    isStarred: true,
    isImportant: false,
    labels: ['inbox', 'starred'],
  },
  {
    providerMessageId: 'msg-events-3',
    providerThreadId: 'thread-events-3',
    fromName: 'Alumni Cell',
    fromEmail: `alumni@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Alumni Talk Series — Founders of Zomato & Razorpay',
    bodyText:
      'The Alumni Cell is proud to host a talk series featuring founders of Zomato and Razorpay. ' +
      'Date: this Friday, 6 PM, Auditorium 2. Open to all. Q&A session will follow.',
    bodyHtml: '<p>The Alumni Cell is proud to host a talk series featuring founders of Zomato and Razorpay. ' +
      'Date: <strong>this Friday, 6 PM, Auditorium 2</strong>. Open to all. Q&A session will follow.</p>',
    receivedAt: daysAgo(4, 16, 0),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },

  // ---------------- Finance ----------------
  {
    providerMessageId: 'msg-finance-1',
    providerThreadId: 'thread-finance-1',
    fromName: 'Finance Office',
    fromEmail: `finance@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Semester Fee Reminder — Due in 10 Days',
    bodyText:
      'This is a reminder that your Semester 5 fee is due in 10 days. Pay via the fee portal using UPI/Net banking. ' +
      'A late fee of Rs 500/day applies after the due date. Fee structure and receipts are available on the portal.',
    bodyHtml: '<p>This is a reminder that your Semester 5 fee is due in <strong>10 days</strong>. Pay via the fee portal using UPI/Net banking. ' +
      'A late fee of Rs 500/day applies after the due date. Fee structure and receipts are available on the portal.</p>',
    receivedAt: daysAgo(0, 9, 5),
    isRead: false,
    isStarred: true,
    isImportant: true,
    labels: ['inbox', 'important'],
    attachments: [{ filename: 'Fee_Structure_S5.pdf', mimeType: 'application/pdf', size: 54200 }],
  },
  {
    providerMessageId: 'msg-finance-2',
    providerThreadId: 'thread-finance-2',
    fromName: 'Finance Office',
    fromEmail: `finance@${iit}`,
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Mess & Hostel Fee — Payment Receipt',
    bodyText:
      'Your mess and hostel fee for the current month has been received. Receipt number FIN-2025-04321 is attached. ' +
      'Keep this for your records. Any discrepancy should be reported within 7 days.',
    bodyHtml: '<p>Your mess and hostel fee for the current month has been received. Receipt number <strong>FIN-2025-04321</strong> is attached. ' +
      'Keep this for your records. Any discrepancy should be reported within 7 days.</p>',
    receivedAt: daysAgo(10, 10, 30),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
    attachments: [{ filename: 'Receipt_FIN-2025-04321.pdf', mimeType: 'application/pdf', size: 32100 }],
  },

  // ---------------- Others / unmatched ----------------
  {
    providerMessageId: 'msg-other-1',
    providerThreadId: 'thread-other-1',
    fromName: 'Google Workspace',
    fromEmail: 'no-reply@accounts.google.com',
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Security Alert — New Sign-in from a Chrome Device',
    bodyText:
      'A new sign-in to your Google Account from a Chrome device was detected. If this was you, no action is needed. ' +
      'If not, secure your account immediately.',
    bodyHtml: '<p>A new sign-in to your Google Account from a Chrome device was detected. If this was you, no action is needed. ' +
      'If not, secure your account immediately.</p>',
    receivedAt: daysAgo(0, 22, 14),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-other-2',
    providerThreadId: 'thread-other-2',
    fromName: 'GitHub',
    fromEmail: 'noreply@github.com',
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: '[aarav/research-survey] PR #14 needs your review',
    bodyText:
      'Priya requested your review on pull request #14: "Add BERT section to chapter 2". ' +
      'View the changes and leave your feedback.',
    bodyHtml: '<p>Priya requested your review on pull request #14: <em>"Add BERT section to chapter 2"</em>. ' +
      'View the changes and leave your feedback.</p>',
    receivedAt: daysAgo(1, 21, 0),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },
  {
    providerMessageId: 'msg-other-3',
    providerThreadId: 'thread-other-3',
    fromName: 'AWS Educate',
    fromEmail: 'no-reply@awseducate.com',
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'Your AWS Educate credits are expiring soon',
    bodyText:
      'Your AWS Educate credits of $75 are expiring in 14 days. Use them for cloud computing projects before they lapse. ' +
      'Log in to the AWS Educate portal to check usage.',
    bodyHtml: '<p>Your AWS Educate credits of $75 are expiring in 14 days. Use them for cloud computing projects before they lapse. ' +
      'Log in to the AWS Educate portal to check usage.</p>',
    receivedAt: daysAgo(3, 6, 30),
    isRead: true,
    isStarred: false,
    isImportant: false,
    labels: ['inbox'],
  },

  // ---------------- Drafts (saved, not yet sent) ----------------
  // A draft reply to Dr. Rajesh Kumar (the BTech project guide) — the student
  // is iterating on the wording before sending. Drafts surface in the Drafts
  // view via `filter=drafts` (isDraft=true).
  {
    providerMessageId: 'msg-draft-1',
    providerThreadId: 'thread-draft-1',
    fromName: SEED_ACCOUNT.displayName,
    fromEmail: SEED_ACCOUNT.emailAddress,
    toRecipients: [{ name: 'Dr. Rajesh Kumar', email: `rkumar@${iit}` }],
    subject: 'Re: BTech Project — Weekly progress update',
    bodyText:
      'Dear Professor Kumar,\n\nThank you for the feedback on the literature review. I have started ' +
      'incorporating the BERT references you suggested and will share the revised chapter by Friday.\n\n' +
      '[TODO: add the experiment results table — pending the GPU run tonight]\n\n' +
      'Could we schedule a 15-minute sync next week to align on the evaluation metrics? I am flexible ' +
      'Tuesday or Wednesday afternoon.\n\n' +
      'Best regards,\nAarav',
    bodyHtml:
      '<p>Dear Professor Kumar,</p>' +
      '<p>Thank you for the feedback on the literature review. I have started incorporating the BERT ' +
      'references you suggested and will share the revised chapter by Friday.</p>' +
      '<p><em>[TODO: add the experiment results table — pending the GPU run tonight]</em></p>' +
      '<p>Could we schedule a 15-minute sync next week to align on the evaluation metrics? I am flexible ' +
      'Tuesday or Wednesday afternoon.</p>' +
      '<p>Best regards,<br/>Aarav</p>',
    receivedAt: daysAgo(0, 16, 42),
    isRead: true,
    isStarred: false,
    isImportant: false,
    isDraft: true,
    labels: ['draft'],
  },
  {
    providerMessageId: 'msg-draft-2',
    providerThreadId: 'thread-draft-2',
    fromName: SEED_ACCOUNT.displayName,
    fromEmail: SEED_ACCOUNT.emailAddress,
    toRecipients: [{ name: 'Microsoft Recruiters', email: 'careers-india@microsoft.com' }],
    subject: 'Application — Software Engineer Intern (Summer 2025)',
    bodyText:
      'Dear Microsoft Recruitment Team,\n\nI am writing to express my interest in the Software Engineer Intern ' +
      'role for Summer 2025. I am currently a BTech Computer Science student at IIT Jammu with a CGPA of 8.6.\n\n' +
      '[TODO: attach resume + tailor the project highlights paragraph — DSA + systems work]\n\n' +
      'I would welcome the opportunity to contribute to ',
    bodyHtml:
      '<p>Dear Microsoft Recruitment Team,</p>' +
      '<p>I am writing to express my interest in the Software Engineer Intern role for Summer 2025. I am ' +
      'currently a BTech Computer Science student at IIT Jammu with a CGPA of 8.6.</p>' +
      '<p><em>[TODO: attach resume + tailor the project highlights paragraph — DSA + systems work]</em></p>' +
      '<p>I would welcome the opportunity to contribute to </p>',
    receivedAt: daysAgo(1, 20, 15),
    isRead: true,
    isStarred: true,
    isImportant: false,
    isDraft: true,
    labels: ['draft'],
  },

  // ---------------- Sent ----------------
  // A sent email to the placement office confirming internship interest.
  // Surfaces in the Sent view via `filter=sent` (isSent=true).
  {
    providerMessageId: 'msg-sent-1',
    providerThreadId: 'thread-sent-1',
    fromName: SEED_ACCOUNT.displayName,
    fromEmail: SEED_ACCOUNT.emailAddress,
    toRecipients: [{ name: 'Placement Office', email: `placement@${iit}` }],
    ccRecipients: [{ name: 'CDC', email: `cdc@${iit}` }],
    subject: 'Confirmation — Summer Internship 2025 application submitted',
    bodyText:
      'Dear Placement Office,\n\nI have submitted my application for the Summer Internship 2025 program ' +
      'through the placement portal. Application ID: SPL-2025-04321.\n\n' +
      'As requested, I have uploaded my resume, latest transcript, and the eligibility self-declaration form. ' +
      'Please let me know if any additional documents are required.\n\n' +
      'I confirm I will attend the pre-placement talk scheduled for this Friday at 4:00 PM in Auditorium 1.\n\n' +
      'Best regards,\nAarav Sharma\nBTech Computer Science 2023',
    bodyHtml:
      '<p>Dear Placement Office,</p>' +
      '<p>I have submitted my application for the Summer Internship 2025 program through the placement portal. ' +
      'Application ID: <strong>SPL-2025-04321</strong>.</p>' +
      '<p>As requested, I have uploaded my resume, latest transcript, and the eligibility self-declaration form. ' +
      'Please let me know if any additional documents are required.</p>' +
      '<p>I confirm I will attend the pre-placement talk scheduled for this Friday at 4:00 PM in Auditorium 1.</p>' +
      '<p>Best regards,<br/>Aarav Sharma<br/>BTech Computer Science 2023</p>',
    receivedAt: daysAgo(0, 14, 5),
    isRead: true,
    isStarred: false,
    isImportant: false,
    isSent: true,
    labels: ['sent'],
  },

  // ---------------- Spam ----------------
  // A phishing email masquerading as an institutional IT helpdesk. Surfaces in
  // the Spam view via `filter=spam` (isSpam=true). Sender domain is
  // intentionally non-institutional to demonstrate the spam surface.
  {
    providerMessageId: 'msg-spam-1',
    providerThreadId: 'thread-spam-1',
    fromName: 'IIT Jammu IT Helpdesk',
    fromEmail: 'helpdesk@iitjammu-edu-secure.online',
    toRecipients: [{ email: SEED_ACCOUNT.emailAddress }],
    subject: 'URGENT: Your webmail account will be suspended — verify now',
    bodyText:
      'Dear User,\n\nOur records indicate that your webmail account is pending suspension due to suspicious ' +
      'login activity. To avoid losing access to your email, please verify your credentials within 24 hours ' +
      'by signing in at the link below:\n\n' +
      'https://iitjammu-webmail-verify.online/login\n\n' +
      'Failure to verify will result in permanent account deactivation.\n\n' +
      'Regards,\nIT Helpdesk Team',
    bodyHtml:
      '<p>Dear User,</p>' +
      '<p>Our records indicate that your webmail account is pending suspension due to suspicious login ' +
      'activity. To avoid losing access to your email, please verify your credentials within 24 hours by ' +
      'signing in at the link below:</p>' +
      '<p><a href="https://iitjammu-webmail-verify.online/login">https://iitjammu-webmail-verify.online/login</a></p>' +
      '<p>Failure to verify will result in permanent account deactivation.</p>' +
      '<p>Regards,<br/>IT Helpdesk Team</p>',
    receivedAt: daysAgo(0, 5, 18),
    isRead: false,
    isStarred: false,
    isImportant: false,
    isSpam: true,
    labels: ['spam'],
  },
]
