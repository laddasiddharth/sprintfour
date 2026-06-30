import { CandidateMiss } from "./types";

// Words that are commonly capitalized but are not personal names — sentence
// starters, doc-structure labels, months/days. Deliberately small and dumb:
// this heuristic is meant to nudge a fast-moving reviewer to double-check a
// handful of spots, not to be a second detector. False positives here are
// expected and fine — the cost of glancing at one extra word is low, the
// cost of a missed name is not.
const STOPWORDS = new Set([
  "RE",
  "Case",
  "File",
  "Intake",
  "Summary",
  "Prepared",
  "Document",
  "Review",
  "Date",
  "Contact",
  "Info",
  "Patient",
  "History",
  "Billing",
  "Information",
  "Primary",
  "Emergency",
  "Insurance",
  "Policy",
  "Holder",
  "Department",
  "Medical",
  "Records",
  "Referral",
  "Notes",
  "She",
  "Her",
  "His",
  "The",
  "Note",
  "Ref",
  "Tell",
  "If",
  "Please",
  "Social",
  "Security",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

interface Range {
  start: number;
  end: number;
}

function overlapsAny(start: number, end: number, ranges: Range[]): boolean {
  return ranges.some((r) => start < r.end && end > r.start);
}

function isSentenceInitial(text: string, wordStart: number): boolean {
  let i = wordStart - 1;
  let hasNewline = false;
  
  while (i >= 0 && /\s/.test(text[i])) {
    if (text[i] === "\n") hasNewline = true;
    i--;
  }
  
  if (i < 0) return true; // start of document
  if (hasNewline) return true; // preceded by a newline
  if (text[i] === ":") return true; // preceded by a colon (e.g. "Subject: ")

  if (text[i] !== ".") return false;
  
  // It's a period. Check if it's part of a title abbreviation (Mr., Ms., Mrs., Dr.)
  const endOfWord = i;
  let startOfWord = i - 1;
  while (startOfWord >= 0 && /[a-zA-Z]/.test(text[startOfWord])) startOfWord--;
  const prevWord = text.slice(startOfWord + 1, endOfWord).toLowerCase();
  
  if (["mr", "ms", "mrs", "dr", "prof"].includes(prevWord)) {
    return false; // It's just a title, not end of sentence
  }

  return true;
}

export function findCandidateMisses(
  text: string,
  coveredRanges: Range[],
): CandidateMiss[] {
  const candidates: CandidateMiss[] = [];
  let n = 0;

  // Unpunctuated digit runs of 7+ — typical of phone numbers typed without
  // separators, which formatted-PII detectors are prone to skip.
  for (const m of text.matchAll(/\b\d{7,}\b/g)) {
    const start = m.index!;
    const end = start + m[0].length;
    if (overlapsAny(start, end, coveredRanges)) continue;
    candidates.push({
      id: `cand-${n++}`,
      text: m[0],
      start,
      end,
      pattern: "digit-sequence",
      dismissed: false,
    });
  }

  // Standalone capitalized words, mid-sentence, not a known non-name word —
  // catches bare first names mentioned without a surname or title.
  for (const m of text.matchAll(/\b[A-Z][a-z]{2,}\b/g)) {
    const word = m[0];
    const start = m.index!;
    const end = start + word.length;
    if (STOPWORDS.has(word)) continue;
    if (isSentenceInitial(text, start)) continue;
    if (overlapsAny(start, end, coveredRanges)) continue;
    candidates.push({
      id: `cand-${n++}`,
      text: word,
      start,
      end,
      pattern: "capitalized-name-like",
      dismissed: false,
    });
  }

  const nameLikeCandidates = candidates.filter(c => c.pattern === "capitalized-name-like");
  if (nameLikeCandidates.length > 15) {
    // If there are too many, this is likely a heavily title-cased document (like a resume or contract).
    // The heuristic will just produce noise, so we suppress these specific candidates.
    return candidates
      .filter(c => c.pattern !== "capitalized-name-like")
      .sort((a, b) => a.start - b.start);
  }

  return candidates.sort((a, b) => a.start - b.start);
}
