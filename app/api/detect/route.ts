import { NextResponse } from "next/server";
import { DOCUMENT_TEXT } from "@/lib/sample-document";
import { FALLBACK_DETECTION } from "@/lib/sample-detection";
import { PiiSpan, PiiType } from "@/lib/types";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a PII detector. Given a document, find every span of text that
identifies a specific real person (names, phone numbers, emails, physical addresses,
dates of birth, SSNs, or similar identifiers). Do not flag case citations, generic
business terms, or internal reference codes unless they identify a person.

Respond with ONLY a JSON array. Each item:
{ "text": "<exact substring from the document>", "type": "name"|"phone"|"email"|"address"|"dob"|"ssn"|"other", "confidence": <0-1 number> }`;

export async function POST(req: Request) {
  const { documentText } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      spans: FALLBACK_DETECTION.filter(r => documentText.includes(r.text)),
      source: "fallback",
      note: "No GEMINI_API_KEY set — returning a saved real run. Add a key to .env.local to run live detection.",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const prompt = SYSTEM_PROMPT + "\n\nDOCUMENT:\n" + documentText;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.response.text();
    if (!text) {
      throw new Error("No text returned from Gemini API");
    }

    const cleaned = text.replace(/^```json\n?|```$/g, "").trim();
    const raw: { text: string; type: PiiType; confidence: number }[] =
      JSON.parse(cleaned);

    const spans: PiiSpan[] = raw
      .filter((r) => documentText.includes(r.text))
      .map((r, i) => ({
        id: `live-${i}`,
        text: r.text,
        type: r.type,
        confidence: r.confidence,
        status: "pending" as const,
      }));

    return NextResponse.json({ spans, source: "live" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      spans: FALLBACK_DETECTION.filter(r => documentText.includes(r.text)),
      source: "fallback",
      note: `Live detection failed (${(err as Error).message}), returning saved run instead.`,
    });
  }
}
