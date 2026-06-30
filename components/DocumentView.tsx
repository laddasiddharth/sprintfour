"use client";

import { useEffect, useRef, useState } from "react";
import { Segment } from "@/lib/segments";
import { PiiType } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/ui";
import RedactionModal from "./RedactionModal";

// Colour palette per PII type
const TAG_STYLE: Record<PiiType, string> = {
  name:    "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-700",
  phone:   "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700",
  email:   "bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-700",
  address: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700",
  dob:     "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-700",
  ssn:     "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700",
  other:   "bg-neutral-100 text-neutral-600 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-600",
};

interface ModalState {
  id: string;
  text: string;
  type: PiiType;
  context: string;
  confidence?: number;
}

interface Props {
  segments: Segment[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onSelectText: (start: number, end: number, text: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  documentText: string;
}

export default function DocumentView({
  segments,
  focusedId,
  onFocus,
  onSelectText,
  onConfirm,
  onReject,
  documentText,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [modal, setModal] = useState<ModalState | null>(null);

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
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString();
    if (!text.trim()) return;

    const range = selection.getRangeAt(0);
    const startEl = range.startContainer.parentElement?.closest<HTMLElement>("[data-seg-start]");
    const endEl = range.endContainer.parentElement?.closest<HTMLElement>("[data-seg-start]");

    if (!startEl || !endEl) {
      selection.removeAllRanges();
      return;
    }

    const startBase = parseInt(startEl.dataset.segStart!, 10);
    const endBase = parseInt(endEl.dataset.segStart!, 10);
    
    let start = startBase + range.startOffset;
    let end = endBase + range.endOffset;
    
    if (start > end) {
      const temp = start;
      start = end;
      end = temp;
    }
    
    const realText = documentText.slice(start, end);
    if (!realText.trim()) {
      selection.removeAllRanges();
      return;
    }

    onSelectText(start, end, realText);
    selection.removeAllRanges();
  }

  function openModal(id: string, text: string, type: PiiType, confidence?: number) {
    // Extract ~80 chars of context around the text
    const idx = documentText.indexOf(text);
    const ctxStart = Math.max(0, idx - 40);
    const ctxEnd = Math.min(documentText.length, idx + text.length + 40);
    const context = documentText.slice(ctxStart, ctxEnd);
    setModal({ id, text, type, context, confidence });
    onFocus(id);
  }

  return (
    <>
      <div className="bg-paper border border-rule rounded-lg shadow-[var(--card-shadow)] overflow-hidden">
        {/* Header */}
        <div className="border-b border-rule px-8 py-4 flex items-center justify-between">
          <p className="font-data text-[11px] tracking-widest text-neutral uppercase">
            Document
          </p>
          <span className="font-data text-[10px] text-neutral/60 italic">
            Click a tag to review · Select text to flag missed PII
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
                <span
                  key={i}
                  data-seg-start={seg.start}
                  data-seg-kind="plain"
                  style={{ background: "var(--safe-highlight)" }}
                  className="px-0.5 rounded-sm text-ink"
                >
                  {seg.text}
                </span>
              );
            }

            if (seg.kind === "suggested" || seg.kind === "manual") {
              const id = seg.span.id;
              const status = seg.kind === "suggested" ? seg.span.status : "confirmed";
              const type: PiiType = seg.span.type;
              const confidence = seg.kind === "suggested" ? seg.span.confidence : undefined;
              const isFocused = focusedId === id;
              const tagStyle = TAG_STYLE[type];

              if (status === "rejected") {
                return (
                  <span key={i} data-span-id={id} className="inline-block">
                    <button
                      data-seg-start={seg.start}
                      data-seg-kind="rejected"
                      onClick={() => openModal(id, seg.text, type, confidence)}
                      className={`underline decoration-low-risk decoration-2 underline-offset-2 text-ink-soft cursor-pointer transition-all ${
                        isFocused ? "ring-2 ring-low-risk rounded-sm" : ""
                      }`}
                      title="Marked not PII — click to review"
                    >
                      {seg.text}
                    </button>
                    <span className={`font-data text-[9px] font-semibold uppercase ml-1 px-1.5 py-0.5 rounded-full border ${tagStyle} opacity-50`}>
                      {TYPE_LABEL[type]}
                    </span>
                  </span>
                );
              }

              // Active redaction — show tag instead of solid black box
              return (
                <span
                  key={i}
                  data-span-id={id}
                  className="inline-block"
                >
                  <button
                    data-seg-start={seg.start}
                    data-seg-kind="redacted"
                    onClick={() => openModal(id, seg.text, type, confidence)}
                    title={`${TYPE_LABEL[type]} — click to review`}
                    className={`inline-flex items-center gap-1.5 font-data text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border cursor-pointer transition-all ${tagStyle} ${
                      isFocused ? "ring-2 ring-offset-1 shadow-md scale-105" : "hover:shadow-sm hover:scale-105"
                    } ${seg.kind === "manual" ? "outline outline-2 outline-low-risk outline-offset-1" : ""}`}
                  >
                    <span className="opacity-70">▣</span>
                    {TYPE_LABEL[type]}
                  </button>
                </span>
              );
            }

            // candidate miss — visible text, dotted danger underline
            const isFocused = focusedId === seg.candidate.id;
            return (
              <button
                key={i}
                data-seg-start={seg.start}
                data-seg-kind="candidate"
                data-span-id={seg.candidate.id}
                onClick={() => onFocus(seg.candidate.id)}
                title="Possible missed PII — not flagged by the detector"
                className={`underline decoration-danger decoration-dotted decoration-2 underline-offset-4 cursor-pointer rounded-sm transition-all ${
                  isFocused ? "bg-danger-bg scale-105" : "hover:bg-danger-bg/50"
                }`}
              >
                {seg.text}
              </button>
            );
          })}
        </div>

        {/* Footer legend */}
        <div className="border-t border-rule px-8 py-3 bg-paper-dim/50 flex flex-wrap gap-4">
          {(["name", "phone", "email", "address", "dob", "ssn"] as PiiType[]).map((t) => (
            <span key={t} className={`font-data text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full border ${TAG_STYLE[t]}`}>
              {TYPE_LABEL[t]}
            </span>
          ))}
          <span className="font-data text-[10px] text-neutral italic ml-auto">
            <span className="line-through">text</span> = revealed ·{" "}
            <span style={{ background: "var(--safe-highlight)" }} className="px-0.5 rounded-sm">text</span> = safe ·{" "}
            <span className="underline decoration-dotted decoration-danger">text</span> = possible miss
          </span>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <RedactionModal
          text={modal.text}
          type={modal.type}
          context={modal.context}
          confidence={modal.confidence}
          onConfirm={() => onConfirm(modal.id)}
          onReject={() => onReject(modal.id, "Not PII")}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}
