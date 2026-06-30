import { NextResponse } from "next/server";

// Dynamically import to avoid issues with Next.js edge runtime
// These run in the Node.js runtime only.
export const runtime = "nodejs";

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const filename = file.name.toLowerCase();
    const ext = filename.split(".").pop() ?? "";
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let text = "";

    // ── Plain text formats ───────────────────────────────────────────────────
    if (["txt", "md", "markdown", "csv", "tsv", "log", "json", "xml"].includes(ext)) {
      text = buffer.toString("utf-8");
    }

    // ── HTML ─────────────────────────────────────────────────────────────────
    else if (["html", "htm"].includes(ext)) {
      text = stripHtmlTags(buffer.toString("utf-8"));
    }

    // ── PDF ──────────────────────────────────────────────────────────────────
    else if (ext === "pdf") {
      try {
        const pdfParseModule = await import("pdf-parse-new");
        const pdfParse = pdfParseModule.default || (pdfParseModule as unknown as (buf: Buffer) => Promise<{ text: string }>);
        const result = await pdfParse(buffer);
        text = result.text;
        if (!text.trim()) {
          return NextResponse.json({
            error:
              "This PDF appears to be a scanned image. Text could not be extracted. Please use a text-based PDF.",
          }, { status: 422 });
        }
      } catch (err) {
        console.error("PDF parse error:", err);
        return NextResponse.json({ error: "Failed to extract text from PDF." }, { status: 500 });
      }
    }

    // ── Word Documents (.docx, .doc) ─────────────────────────────────────────
    else if (["docx", "doc"].includes(ext)) {
      try {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
        if (result.messages.length > 0) {
          console.warn("Mammoth warnings:", result.messages);
        }
      } catch (err) {
        console.error("Word parse error:", err);
        return NextResponse.json({ error: "Failed to extract text from Word document." }, { status: 500 });
      }
    }

    // ── RTF ──────────────────────────────────────────────────────────────────
    else if (ext === "rtf") {
      // Basic RTF stripping: remove control words and groups
      text = buffer
        .toString("utf-8")
        .replace(/\{\\[^{}]*\}/g, "")   // remove groups like {\fonttbl...}
        .replace(/\\[a-z]+\d*\s?/g, "") // remove control words like \rtf1 \par
        .replace(/[{}]/g, "")           // remove remaining braces
        .trim();
    }

    // ── Unsupported ──────────────────────────────────────────────────────────
    else {
      return NextResponse.json(
        {
          error: `Unsupported file type ".${ext}". Supported formats: PDF, DOCX, DOC, TXT, MD, CSV, HTML, RTF.`,
        },
        { status: 415 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(
        { error: "The file appears to be empty or contains no readable text." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    console.error("extract-text error:", err);
    return NextResponse.json({ error: "An unexpected error occurred while reading the file." }, { status: 500 });
  }
}
