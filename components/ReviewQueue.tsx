"use client";

import { useState } from "react";
import { PiiSpan, ManualSpan, CandidateMiss, PiiType } from "@/lib/types";
import { TYPE_LABEL, confidenceLabel, PII_TYPES } from "@/lib/ui";

const LOW_CONFIDENCE_THRESHOLD = 0.75;

interface Props {
  spans: PiiSpan[];
  manualSpans: ManualSpan[];
  candidates: CandidateMiss[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  onConfirm: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onRedactCandidate: (id: string, type: PiiType) => void;
  onDismissCandidate: (id: string) => void;
  onRemoveManual: (id: string) => void;
}

function SectionLabel({ children, count, color = "text-neutral" }: { children: string; count: number; color?: string }) {
  return (
    <div className="flex items-center justify-between px-1 mb-2">
      <p className={`font-data text-[11px] tracking-widest uppercase font-medium ${color}`}>
        {children}
      </p>
      <span className={`font-data text-[11px] px-2 py-0.5 rounded-full bg-paper border border-rule ${color}`}>
        {count}
      </span>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <p className="font-data text-xs text-neutral/60 px-1 italic">{children}</p>
  );
}

export default function ReviewQueue({
  spans,
  manualSpans,
  candidates,
  focusedId,
  onFocus,
  onConfirm,
  onReject,
  onRedactCandidate,
  onDismissCandidate,
  onRemoveManual,
}: Props) {
  const [redactingId, setRedactingId] = useState<string | null>(null);

  const activeCandidates = candidates.filter((c) => !c.dismissed);
  const pending = spans.filter((s) => s.status === "pending");
  const lowConfidence = pending
    .filter((s) => s.confidence < LOW_CONFIDENCE_THRESHOLD)
    .sort((a, b) => a.confidence - b.confidence);
  const highConfidence = pending
    .filter((s) => s.confidence >= LOW_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.confidence - a.confidence);
  const rejected = spans.filter((s) => s.status === "rejected");

  return (
    <div className="flex flex-col gap-6">

      {/* ── Possible misses ─────────────────────────────────────────── */}
      <section>
        <SectionLabel count={activeCandidates.length} color="text-danger">
          Possible misses
        </SectionLabel>
        {activeCandidates.length === 0 ? (
          <EmptyState>Nothing flagged.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {activeCandidates.map((c) => (
              <div
                key={c.id}
                onClick={() => onFocus(c.id)}
                className={`bg-danger-bg border rounded-lg p-3 cursor-pointer transition-all ${
                  focusedId === c.id
                    ? "border-danger ring-2 ring-danger/30 shadow-lg shadow-danger/10"
                    : "border-danger/25 hover:border-danger/50 hover:shadow-md hover:shadow-danger/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-data text-sm text-danger font-semibold">
                    {c.text}
                  </span>
                  <span className="font-data text-[10px] text-danger/60 uppercase tracking-wide bg-danger/10 px-2 py-0.5 rounded-full">
                    {c.pattern === "digit-sequence" ? "looks like a number" : "looks like a name"}
                  </span>
                </div>
                {redactingId === c.id ? (
                  <div className="flex items-center gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                    <select
                      onChange={(e) => {
                        onRedactCandidate(c.id, e.target.value as PiiType);
                        setRedactingId(null);
                      }}
                      defaultValue=""
                      className="flex-1 font-data text-xs bg-paper border border-danger/30 rounded-md px-2 py-1.5 text-ink focus:outline-none focus:border-danger/60"
                    >
                      <option value="" disabled>Select category...</option>
                      {PII_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setRedactingId(null)}
                      className="font-data text-[11px] text-danger/70 hover:text-danger underline px-1"
                    >
                      cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRedactingId(c.id);
                      }}
                      className="font-data text-[11px] bg-danger text-paper px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                    >
                      Redact
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDismissCandidate(c.id);
                      }}
                      className="font-data text-[11px] border border-danger/40 text-danger px-3 py-1.5 rounded-md hover:bg-danger/10 transition-colors"
                    >
                      Not PII
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Low-confidence redactions ───────────────────────────────── */}
      <section>
        <SectionLabel count={lowConfidence.length} color="text-low-risk">
          Low-confidence redactions
        </SectionLabel>
        {lowConfidence.length === 0 ? (
          <EmptyState>Nothing to review.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            {lowConfidence.map((s) => (
              <div
                key={s.id}
                onClick={() => onFocus(s.id)}
                className={`bg-low-risk-bg border rounded-lg p-3 cursor-pointer transition-all ${
                  focusedId === s.id
                    ? "border-low-risk ring-2 ring-low-risk/30 shadow-lg shadow-low-risk/10"
                    : "border-low-risk/25 hover:border-low-risk/50 hover:shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="font-data text-sm text-low-risk font-semibold">
                    {s.text}
                  </span>
                  <span className="font-data text-[10px] text-low-risk/60 uppercase tracking-wide">
                    {TYPE_LABEL[s.type]} · {confidenceLabel(s.confidence)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirm(s.id);
                    }}
                    className="font-data text-[11px] bg-ink text-paper px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                  >
                    Keep redacted
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReject(s.id, "Not PII");
                    }}
                    className="font-data text-[11px] border border-low-risk/40 text-low-risk px-3 py-1.5 rounded-md hover:bg-low-risk/10 transition-colors"
                  >
                    Reveal — not PII
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── High-confidence redactions ──────────────────────────────── */}
      <section>
        <SectionLabel count={highConfidence.length} color="text-neutral">
          High-confidence redactions
        </SectionLabel>
        {highConfidence.length === 0 ? (
          <EmptyState>None pending.</EmptyState>
        ) : (
          <div className="flex flex-col gap-1.5">
            {highConfidence.map((s) => (
              <div
                key={s.id}
                onClick={() => onFocus(s.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg bg-paper border cursor-pointer transition-all ${
                  focusedId === s.id
                    ? "border-neutral ring-2 ring-neutral/20 shadow-md"
                    : "border-rule hover:border-neutral/40 hover:shadow-sm"
                }`}
              >
                <div>
                  <span className="font-data text-xs text-ink-soft font-medium">{s.text}</span>
                  <span className="font-data text-[10px] text-neutral ml-2">
                    {TYPE_LABEL[s.type]} · {confidenceLabel(s.confidence)}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfirm(s.id);
                  }}
                  className="font-data text-[11px] text-neutral hover:text-low-risk underline transition-colors"
                >
                  confirm
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Added by you ────────────────────────────────────────────── */}
      {manualSpans.length > 0 && (
        <section>
          <SectionLabel count={manualSpans.length} color="text-neutral">
            Added by you
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {manualSpans.map((m) => (
              <div
                key={m.id}
                onClick={() => onFocus(m.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg bg-paper border border-low-risk/30 cursor-pointer transition-all ${
                  focusedId === m.id
                    ? "ring-2 ring-low-risk/40 shadow-md"
                    : "hover:border-low-risk/50 hover:shadow-sm"
                }`}
              >
                <span className="font-data text-xs text-ink-soft">
                  {TYPE_LABEL[m.type]} ·{" "}
                  <span className="text-low-risk">{m.text}</span>
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveManual(m.id);
                  }}
                  className="font-data text-[11px] text-neutral hover:text-danger underline transition-colors"
                >
                  undo
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Rejected log ────────────────────────────────────────────── */}
      {rejected.length > 0 && (
        <section>
          <SectionLabel count={rejected.length} color="text-neutral">
            Marked not PII
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {rejected.map((s) => (
              <div
                key={s.id}
                onClick={() => onFocus(s.id)}
                className="px-3 py-2.5 rounded-lg bg-paper border border-rule cursor-pointer hover:border-neutral/40 hover:shadow-sm transition-all opacity-60 hover:opacity-100"
              >
                <span className="font-data text-xs text-ink-soft">
                  {s.text}
                  {s.reason && (
                    <span className="text-neutral ml-1">— {s.reason}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
