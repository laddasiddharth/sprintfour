import { PiiSpan, ManualSpan, CandidateMiss } from "./types";

export type Segment =
  | { kind: "plain"; text: string; start: number; end: number }
  | { kind: "suggested"; text: string; start: number; end: number; span: PiiSpan }
  | { kind: "manual"; text: string; start: number; end: number; span: ManualSpan }
  | { kind: "candidate"; text: string; start: number; end: number; candidate: CandidateMiss };

interface PositionedRange {
  start: number;
  end: number;
  segment: Segment;
}

export function buildSegments(
  documentText: string,
  spans: PiiSpan[],
  manualSpans: ManualSpan[],
  candidates: CandidateMiss[],
): Segment[] {
  const ranges: PositionedRange[] = [];

  // Group spans by their text so we can find every occurrence in document order.
  // e.g. if Gemini returns "Maria" three times we tag all three positions,
  // not just the first one (which is what a plain indexOf would do).
  const byText = new Map<string, PiiSpan[]>();
  for (const span of spans) {
    const bucket = byText.get(span.text) ?? [];
    bucket.push(span);
    byText.set(span.text, bucket);
  }

  for (const [text, bucket] of byText) {
    let searchFrom = 0;
    for (const span of bucket) {
      const start = documentText.indexOf(text, searchFrom);
      if (start === -1) break; // no more occurrences
      const end = start + text.length;
      ranges.push({
        start,
        end,
        segment: { kind: "suggested", text, start, end, span },
      });
      searchFrom = end; // advance past this occurrence
    }
  }

  for (const m of manualSpans) {
    ranges.push({
      start: m.start,
      end: m.end,
      segment: { kind: "manual", text: m.text, start: m.start, end: m.end, span: m },
    });
  }

  for (const c of candidates) {
    if (c.dismissed) continue;
    ranges.push({
      start: c.start,
      end: c.end,
      segment: { kind: "candidate", text: c.text, start: c.start, end: c.end, candidate: c },
    });
  }

  ranges.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue; // skip overlaps defensively
    if (r.start > cursor) {
      segments.push({
        kind: "plain",
        text: documentText.slice(cursor, r.start),
        start: cursor,
        end: r.start,
      });
    }
    segments.push(r.segment);
    cursor = r.end;
  }
  if (cursor < documentText.length) {
    segments.push({
      kind: "plain",
      text: documentText.slice(cursor),
      start: cursor,
      end: documentText.length,
    });
  }
  return segments;
}
