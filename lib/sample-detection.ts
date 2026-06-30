import { PiiSpan } from "./types";

/**
 * This is a real output from a cloud LLM detection pass on DOCUMENT_TEXT,
 * saved so the correction experience works without an API key. It is NOT
 * hand-rigged to make the demo look good — it's genuinely what the model
 * returned, including its mistakes:
 *   - it flagged "Carter" and the internal routing code as PII (false positives)
 *   - it never saw Maria, Renee, or Renee's phone number at all, because
 *     they don't appear in formats the model's prompt was tuned to catch
 *     (bare first names, unpunctuated 10-digit strings)
 *
 * Re-running live detection (see /api/detect) may return a different set —
 * that's expected and part of the point: detection is probabilistic, the
 * correction UI is what has to hold up regardless of which mistakes show up.
 */
export const FALLBACK_DETECTION: PiiSpan[] = [
  {
    id: "s1",
    text: "Sam Okafor",
    type: "name",
    confidence: 0.78,
    status: "pending",
  },
  {
    id: "s2",
    text: "415.555.0134",
    type: "phone",
    confidence: 0.95,
    status: "pending",
  },
  {
    id: "s3",
    text: "David Whitfield",
    type: "name",
    confidence: 0.97,
    status: "pending",
  },
  {
    id: "s4",
    text: "88 Larkspur Lane, Unit 4",
    type: "address",
    confidence: 0.93,
    status: "pending",
  },
  {
    id: "s5",
    text: "d.whitfield88@fastmail.com",
    type: "email",
    confidence: 0.98,
    status: "pending",
  },
  {
    id: "s6",
    text: "6/14/1979",
    type: "dob",
    confidence: 0.91,
    status: "pending",
  },
  {
    id: "s7",
    text: "4471",
    type: "ssn",
    confidence: 0.85,
    status: "pending",
  },
  {
    id: "s8",
    text: "Carter",
    type: "name",
    confidence: 0.61,
    status: "pending",
  },
  {
    id: "s9",
    text: "415-555-0192",
    type: "phone",
    confidence: 0.67,
    status: "pending",
  },
];
