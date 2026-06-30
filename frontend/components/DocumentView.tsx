"use client";

import { useEffect, useRef } from "react";
import { Segment } from "@/lib/segments";

// Single color for all highlights
const TAG_STYLE = "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700";

interface Props {
  mode: "original" | "redacted";
  segments: Segment[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onSelectText: (start: number, end: number, text: string, rect: DOMRect) => void;
}

export default function DocumentView({
  mode,
  segments,
  focusedId,
  onFocus,
  onSelectText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth scroll to focused span
  useEffect(() => {
    if (!focusedId || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(
      `[data-span-id="${focusedId}"]`,
    );
    if (!el) return;

    const start = el.getBoundingClientRect().top + window.scrollY;
    const target = start - window.innerHeight / 2 + el.offsetHeight / 2;
    const startY = window.scrollY;
    const distance = target - startY;
    const duration = 600;
    let startTime: number | null = null;

    function easeInOut(t: number) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function step(ts: number) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const progress = Math.min(elapsed / duration, 1);
      window.scrollTo(0, startY + distance * easeInOut(progress));
      if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, [focusedId]);



  function handleMouseUp() {
    if (mode !== "original") return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    let startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentNode!;
    
    // Walk up to find data-seg-start
    let el: HTMLElement | null = startNode as HTMLElement;
    while (el && !el.getAttribute("data-seg-start") && el !== containerRef.current) {
      el = el.parentElement;
    }
    
    if (!el) return;
    const segStartStr = el.getAttribute("data-seg-start");
    if (!segStartStr) return;

    const segStart = parseInt(segStartStr, 10);
    const globalStart = segStart + range.startOffset;

    onSelectText(globalStart, globalStart + text.length, text, rect);
  }

  return (
    <>
      <div className="bg-paper border border-rule rounded-lg shadow-[var(--card-shadow)] overflow-hidden">
        {/* Header */}
        <div className="border-b border-rule px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <p className="font-data text-[11px] tracking-widest text-neutral uppercase">
            {mode === "original" ? "Original Document" : "Redacted Preview"}
          </p>
          <span className="font-data text-[10px] text-neutral italic">
            {mode === "original"
              ? "Click a highlight to review · Select text to manually redact"
              : "Solid black blocks show final redactions"}
          </span>
        </div>

        {/* Body */}
        <div
          ref={containerRef}
          onMouseUp={handleMouseUp}
          className="px-8 py-8 font-display text-[17px] leading-[1.9] whitespace-pre-wrap text-ink select-text"
        >
          {segments.map((seg, i) => {
            if (seg.kind === "plain") {
              return (
                <span key={i} data-seg-start={seg.start}>
                  {seg.text}
                </span>
              );
            }

            if (seg.kind === "suggested" || seg.kind === "manual") {
              const spanId = seg.kind === "suggested" ? seg.span.id : (seg as { span: { id: string } }).span.id;
              const status = seg.kind === "suggested" ? seg.span.status : "confirmed";
              const isRejected = status === "rejected";
              
              if (mode === "redacted") {
                if (isRejected) {
                  return (
                    <span key={i} data-seg-start={seg.start}>
                      {seg.text}
                    </span>
                  );
                }
                return (
                  <span
                    key={i}
                    data-seg-start={seg.start}
                    className="bg-black text-black select-none"
                    title="Redacted"
                  >
                    {"█".repeat(seg.text.length)}
                  </span>
                );
              }

              // Original Mode
              const isFocused = focusedId === spanId;
              const isPending = status === "pending";
              const style = TAG_STYLE;
              
              if (isRejected) {
                return (
                  <span
                    key={i}
                    data-span-id={spanId}
                    data-seg-start={seg.start}
                    className="line-through decoration-red-500/50 decoration-2 opacity-60 cursor-pointer"
                    onClick={() => onFocus(spanId)}
                  >
                    {seg.text}
                  </span>
                );
              }

              return (
                <span
                  key={i}
                  data-span-id={spanId}
                  data-seg-start={seg.start}
                  className={`
                    relative group cursor-pointer rounded px-0.5 border-b-2
                    ${isFocused ? "ring-2 ring-blue-400 bg-blue-50/50 border-blue-400" : ""}
                    ${isPending ? "border-dashed opacity-80" : "border-solid"}
                    ${style}
                  `}
                  onClick={() => onFocus(spanId)}
                >
                  {seg.text}
                </span>
              );
            }

            if (seg.kind === "candidate") {
              if (mode === "redacted") {
                return (
                  <span key={i} data-seg-start={seg.start}>
                    {seg.text}
                  </span>
                );
              }
              const isFocused = focusedId === seg.candidate.id;
              return (
                <span
                  key={i}
                  data-span-id={seg.candidate.id}
                  data-seg-start={seg.start}
                  className={`
                    bg-orange-100 text-orange-900 border border-orange-300 rounded px-0.5 cursor-pointer
                    ${isFocused ? "ring-2 ring-blue-400" : ""}
                  `}
                  onClick={() => onFocus(seg.candidate.id)}
                  title="Candidate Miss"
                >
                  {seg.text}
                </span>
              );
            }
          })}
        </div>
      </div>
    </>
  );
}
