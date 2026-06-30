export interface DocumentData {
  id: string;
  title: string;
  text: string;
}

export const DOCUMENTS: DocumentData[] = [
  {
    id: "doc-1",
    title: "Case File 2291-B — Intake Summary",
    text: `RE: Case File 2291-B — Intake Summary

Prepared for: Sam Okafor, Document Review
Date: March 3, 2026

Maria called this morning regarding the Henderson matter. She asked that we forward the signed release to her directly rather than through the firm's intake line. Her direct number is 415.555.0134, though she said evenings are better than the office line.

The client, David Whitfield, resides at 88 Larkspur Lane, Unit 4, and can be reached at d.whitfield88@fastmail.com for any follow-up. His date of birth is 6/14/1979, and his Social Security number on file ends in 4471.

Note for the file: as the precedent in Johnson v. Carter established, intake notes are discoverable, so avoid speculative language in summaries.

Ref# 415-555-0192 should be cited on all correspondence related to this file going forward; it is the internal routing code, not a contact number.

If Maria can't be reached, her assistant Renee can be reached weekdays at 6505550199. Tell Maria I'll have the signed copy to her by Friday.`,
  },
  {
    id: "doc-2",
    title: "HR Incident Report - Q3-042",
    text: `CONFIDENTIAL - INTERNAL HR USE ONLY
Incident Report ID: Q3-042
Date of Incident: September 12, 2025

Reporting Party: Alex Chen, Senior Developer (achen.eng@internal.company.com)
Subject: Unprofessional behavior in team channel

Summary:
On Tuesday, Alex reported that a contractor, Julian Rossi, made inappropriate comments during the weekly sprint planning meeting. Julian can be reached for a statement at 206-555-8933. The incident was witnessed by the engineering manager, Sarah, who confirmed the details via Slack.

Julian's home address on file is 1024 Syntax Blvd, Apt 3B, Seattle, WA 98104. We need to send a formal written warning to this address by end of week. 

Please note that Julian's contract agency requires us to copy them on all disciplinary actions. Send copies to hr-disputes@techstaffing.net. Julian's employee ID is 884-21-99A.

Next Steps:
HR Director Michael T. will schedule a follow-up call with Alex on Friday. Michael's direct extension is x4492.`,
  },
  {
    id: "doc-3",
    title: "Medical Intake Form - Patient 8911",
    text: `PATIENT INTAKE SUMMARY - Dr. Aris Thorne's Clinic

Patient Name: Clara Jenkins
DOB: 11-04-1982
File #: MED-8911-CJ

Patient presented today complaining of persistent migraines over the last three weeks. She noted that over-the-counter medication (Ibuprofen 400mg) has not been effective.

Primary Contact Info:
Phone: (312) 555-0144
Emergency Contact: Husband, Thomas Jenkins, reachable at 312-555-0988.

Patient History:
Clara has a history of hypertension, managed with Lisinopril. She recently moved to 455 River North Ave, Chicago. 

Billing Information:
Primary Insurance: BlueShield Co.
Policy Holder: Clara Jenkins
Member ID: BS-8472910-X
SSN on file for billing: ***-**-2918

Notes:
Referral sent to neurology department at Memorial Hospital. Dr. Ramirez will follow up. Send patient records to records@memorialneuro.org.`,
  },
  {
    id: "doc-4",
    title: "Customer Support Escalation #9021",
    text: `TICKET: #9021
PRIORITY: HIGH
AGENT: Support Rep 4 (J. Alvarez)

Customer contacted us extremely frustrated about a double charge on their recent hardware purchase. 

Customer details:
Name: Elena Rostova
Account Email: elena.r.design@studio.co.uk
Shipping Address: 42 High Street, Flat 2, London UK

Transcript Excerpt:
Elena: "I've been charged twice for the same laptop! My bank is showing two pending transactions for $1,499."
Agent: "I apologize for the inconvenience. Let me look up your account. Is the best phone number to reach you still +44 7700 900077?"
Elena: "Yes, or you can call my office line at +44 20 7946 0958."

Resolution:
I identified a glitch in the payment gateway. Refund processed for the duplicate charge. Sent confirmation to elena.r.design@studio.co.uk. The payment reference was PR-994102-X. No further action needed.`,
  },
  {
    id: "doc-5",
    title: "Lease Agreement Summary - Unit 4B",
    text: `RESIDENTIAL LEASE SUMMARY
Property: Pine View Apartments

Tenant 1: Marcus Vance
Tenant 2: Priya Patel

Term: 12 months, beginning 01/01/2026.
Rent: $2,450 / month

Contact Information provided on application:
Marcus: 512.555.0192 | mvance_arch@gmail.com
Priya: 512.555.9934 | p.patel.med@university.edu

Guarantor Information:
Guarantor: Robert Vance (Father of Marcus)
Address: 77 Oak Creek Drive, Austin TX
Phone: (512) 555-3811
Guarantor SSN: 991-XX-4412

Notes:
Security deposit of $2,450 received via wire transfer (Trace #WT-881293). Keys to be picked up by Priya on the 1st. If maintenance issues arise, tenants are instructed to text the on-call super at 512-555-0010.`,
  },
  {
    id: "doc-6",
    title: "Financial Audit - Account 771-A",
    text: `AUDIT PRE-REPORT
Target: Account 771-A (Personal Wealth Management)
Auditor: E. Stanton
Date: 04/15/2026

During the Q1 review of high-net-worth accounts, anomalies were flagged in Account 771-A belonging to Mr. Gregory Houseman.

Account Details:
Primary Holder: Gregory Houseman
DOB: Feb 12, 1965
Registered Address: 10 Downing Way, Estate 4, Greenwich CT

Findings:
Three unverified wire transfers were sent to an offshore holding company on March 4th. The authorizing signature on file appears inconsistent. 
Contacted Mr. Houseman's personal assistant, Sylvia, to verify the transactions. Sylvia stated Mr. Houseman was traveling at the time. Her number is 203-555-8172.

Compliance requires us to freeze the account pending a verbal confirmation. E-mailed formal notice to ghouseman@wealth.net and cc'd his attorney at legal@benson-law.com.

Account freeze override code is 88102. Do not share this code outside the compliance department.`,
  }
];

// Fallback to the first document if a single import is still used somewhere 
// (though we will update the app to use the array instead).
export const DOCUMENT_TITLE = DOCUMENTS[0].title;
export const DOCUMENT_TEXT = DOCUMENTS[0].text;
