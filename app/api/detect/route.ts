import { NextResponse } from "next/server";
import { FALLBACK_DETECTION } from "@/lib/sample-detection";
import { PiiSpan, PiiType } from "@/lib/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a PII detection assistant operating a TWO-TIER detection model. Your job is to identify ALL sensitive information in the document and return a strict JSON array.

## TIER 1 — Primary PII (directly identifies a person)
Use these types for high-sensitivity data:
- PERSON_NAME: Full names, first names used in salutation context
- EMAIL: Email addresses
- PHONE: Phone or fax numbers
- SSN: Social Security Numbers or national ID numbers
- ADDRESS: Physical street addresses, zip codes
- DATE_OF_BIRTH: Birthdates when explicitly labeled as such
- ACCOUNT_NUMBER: Policy numbers, member IDs, account numbers, reference numbers that are EXPLICITLY linked to a named individual (e.g. "your policy number is HX-8821-99", "your account ID is ACC-442"). Flag these even if they look like codes.
- FINANCIAL: Salary, compensation, personal income figures tied to an identified individual (e.g. "$145,000 per year")
- URL: Personal website links, portfolio URLs, social media handles (e.g. "kaushalloya.in", "LinkedIn", "GitHub")

## TIER 2 — Contextual PII (quasi-identifiers, indirectly identifying)
Use these types for information that narrows down identity when combined with other data:
- ORG: Company names, employer names, organization names that appear in a personal document context (e.g. the signing company on an offer letter, the insurance company processing a claim)
- JOB_TITLE: Job titles, roles, positions (e.g. "Senior Claims Adjuster", "VP of People Operations")
- Any other forms of Contextual PII you can identify.

For each PII span found, return:
- "text": the exact substring as it appears in the document
- "type": one of PERSON_NAME, EMAIL, PHONE, SSN, ADDRESS, DATE_OF_BIRTH, ACCOUNT_NUMBER, FINANCIAL, URL, ORG, JOB_TITLE, OTHER
- "startIndex": character index where this text starts (0-based)
- "endIndex": character index where this text ends (exclusive, like slice)
- "confidence": 0–1, how confident you are this is PII of that type
- "reasoning": one plain-English sentence explaining WHY this is flagged

Rules:
1. Be honest about uncertainty — give lower confidence (0.4–0.6) when unsure, and say why.
2. ALWAYS flag Tier 1 PII. Never skip names, SSNs, emails, phones, addresses, or account/policy numbers linked to a person. Assign confidence 0.9–1.0 for these.
3. Flag Tier 2 (ORG, JOB_TITLE) when they appear in a personal document context. You MUST flag EVERY occurrence of the organization name and job title, including in the signature block or header. Assign confidence 0.7–0.8 for these to place them in the Medium confidence band.
4. Flag partial PII (e.g. the last 4 digits of a Social Security Number or account number like "7741") when explicitly identified in the text. Assign lower confidence (0.4–0.6) for partial identifiers.
5. Do NOT flag: generic time durations ("30-day window"), procedural dates not linked to a person's identity, generic prices unlinked to an individual, or State names when used as a legal jurisdiction (e.g. "California employment law").
6. startIndex and endIndex MUST match the exact "text" substring in the document. Verify before returning.
7. Return ONLY the JSON array — no markdown, no explanation, no code fences.`;

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  });
  const text = result.response.text();
  if (!text) throw new Error("No text returned from Gemini API");
  return text;
}

export async function POST(req: Request) {
  const { documentText } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      spans: FALLBACK_DETECTION
        .filter(r => documentText.includes(r.text))
        .map(r => ({ ...r, status: r.confidence >= 0.85 ? "confirmed" : "pending" })),
      source: "fallback",
      note: "No GEMINI_API_KEY set — returning a saved real run. Add a key to .env.local to run live detection.",
    });
  }

  try {
    const prompt = SYSTEM_PROMPT + `\n\nDocument:\n"""\n${documentText}\n"""\n\nReturn format (JSON array only):`;
    const rawText = await callGemini(apiKey, prompt);

    const cleaned = rawText.replace(/^```json\s*|```\s*$/g, "").trim();
    const raw: { text: string; type: string; confidence: number; reasoning?: string }[] = JSON.parse(cleaned);

    const TYPE_MAP: Record<string, PiiType> = {
      PERSON_NAME: "name",
      EMAIL: "email",
      PHONE: "phone",
      SSN: "ssn",
      ADDRESS: "address",
      DATE_OF_BIRTH: "dob",
      ACCOUNT_NUMBER: "account",
      FINANCIAL: "financial",
      URL: "url",
      ORG: "org",
      JOB_TITLE: "job",
      OTHER: "other",
    };

    const spans: PiiSpan[] = raw
      .filter((r) => typeof r.text === "string")
      .map((r) => ({ ...r, text: r.text.trim() }))
      .filter((r) => r.text.length >= 2 && r.text.length < 150)
      .filter((r) => documentText.includes(r.text))
      .map((r, i) => ({
        id: `live-${i}`,
        text: r.text,
        type: TYPE_MAP[r.type] || "other",
        confidence: r.confidence,
        status: r.confidence >= 0.85 ? ("confirmed" as const) : ("pending" as const),
        reasoning: r.reasoning,
      }));

    return NextResponse.json({ spans, source: "live" });
  } catch (err) {
    console.error(err);
    const isRateLimit = (err as Error).message.includes("429");
    return NextResponse.json({
      spans: FALLBACK_DETECTION
        .filter(r => documentText.includes(r.text))
        .map(r => ({ ...r, status: r.confidence >= 0.85 ? "confirmed" : "pending" })),
      source: "fallback",
      note: isRateLimit
        ? "Rate limit exceeded. Please wait a moment and click 're-run live detection'."
        : "Live detection failed. Showing cached results instead.",
    });
  }
}
