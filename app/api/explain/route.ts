import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  const { text, type, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback if no key
  if (!apiKey) {
    return NextResponse.json({
      explanation: `"${text}" was flagged as a ${type} because it appears to identify a specific individual and may be considered personally identifiable information (PII) under privacy regulations.`,
      shouldRedact: true,
      error: true
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are a privacy expert reviewing a document for PII redaction.

The following text was flagged as a potential "${type}":
"${text}"

It appears in this context:
"...${context}..."

In 1-2 short sentences, explain:
1. Whether this is genuinely PII that should be redacted before the document is shared externally.
2. Why or why not, using plain language a non-expert reviewer would understand.

Be direct and specific. Do not use bullet points. Do not start with "I".`;

    const result = await model.generateContent(prompt);
    const explanation = result.response.text().trim();

    return NextResponse.json({ explanation, shouldRedact: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      explanation: `"${text}" was flagged as a ${type}. This type of information can identify a specific individual and is typically redacted before documents are shared externally.`,
      shouldRedact: true,
      error: true
    });
  }
}
