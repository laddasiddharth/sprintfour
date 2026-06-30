import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: Request) {
  const { text, context } = await req.json();
  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback if no key
  if (!apiKey) {
    return NextResponse.json({
      explanation: `"${text}" was evaluated by the tool but not flagged. It likely appears to be a generic term, a business name, or lacks enough context to be confidently identified as a person's private information.`,
      error: true
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

    const prompt = `You are a privacy expert reviewing a document for PII redaction.

The following text was left VISIBLE (not redacted):
"${text}"

It appears in this context:
"...${context}..."

The user is worried this might be sensitive PII that was missed. 
In 1-2 short sentences, explain why a PII detector might have considered this "safe" to leave visible. For example, is it a case citation? A generic business term? Or just ordinary vocabulary?

Be direct and specific. Do not use bullet points. Do not start with "I".`;

    const result = await model.generateContent(prompt);
    const explanation = result.response.text().trim();

    return NextResponse.json({ explanation });
  } catch (err) {
    console.error(err);
    return NextResponse.json({
      explanation: `"${text}" was not flagged as PII. It likely appears to be a generic term or business information that does not identify a specific private individual.`,
      error: true
    });
  }
}
