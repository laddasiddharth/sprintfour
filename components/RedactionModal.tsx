"use client";

import { useEffect, useState, useCallback } from "react";
import { PiiType } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/ui";

const TYPE_COLOR: Record<PiiType, { bg: string; text: string; border: string }> = {
  name:    { bg: "bg-purple-100 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
  phone:   { bg: "bg-blue-100 dark:bg-blue-950",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-300 dark:border-blue-700" },
  email:   { bg: "bg-cyan-100 dark:bg-cyan-950",   text: "text-cyan-700 dark:text-cyan-300",   border: "border-cyan-300 dark:border-cyan-700" },
  address: { bg: "bg-orange-100 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  dob:     { bg: "bg-yellow-100 dark:bg-yellow-950", text: "text-yellow-700 dark:text-yellow-300", border: "border-yellow-300 dark:border-yellow-700" },
  ssn:     { bg: "bg-red-100 dark:bg-red-950",     text: "text-red-700 dark:text-red-300",     border: "border-red-300 dark:border-red-700" },
  other:   { bg: "bg-neutral-100 dark:bg-neutral-800", text: "text-neutral-600 dark:text-neutral-300", border: "border-neutral-300 dark:border-neutral-600" },
};

interface Props {
  text: string;
  type: PiiType;
  context: string;
  confidence?: number;
  onConfirm: () => void;
  onReject: () => void;
  onClose: () => void;
}

export default function RedactionModal({
  text,
  type,
  context,
  confidence,
  onConfirm,
  onReject,
  onClose,
}: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const colors = TYPE_COLOR[type];

  const fetchExplanation = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type, context }),
      });
      const data = await res.json();
      setExplanation(data.explanation);
      if (data.error) setHasError(true);
    } catch {
      setExplanation(`"${text}" appears to be a ${TYPE_LABEL[type]} that could identify a specific individual.`);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [text, type, context]);

  useEffect(() => {
    fetchExplanation();
  }, [fetchExplanation]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Card */}
      <div
        className="bg-paper border border-rule rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        style={{ animation: "modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}
      >
        {/* Header */}
        <div className={`px-6 pt-6 pb-4 border-b border-rule`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`font-data text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}
              >
                {TYPE_LABEL[type]}
              </span>
              {confidence !== undefined && (
                <span className="font-data text-[10px] text-neutral uppercase tracking-wide">
                  {Math.round(confidence * 100)}% confidence
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-neutral hover:text-ink transition-colors text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <p className="font-display text-2xl font-semibold text-ink mt-3 break-words">
            &ldquo;{text}&rdquo;
          </p>
        </div>

        {/* Gemini explanation */}
        <div className="px-6 py-5">
          <p className="font-data text-[11px] text-neutral uppercase tracking-widest mb-2">
            AI Analysis
          </p>
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-neutral border-t-ink animate-spin" />
              <span className="font-data text-sm text-neutral">Asking Gemini…</span>
            </div>
          ) : (
            <div>
              {hasError && (
                <div className="flex items-center gap-1.5 text-danger mb-2">
                  <span className="font-bold text-sm">⚠️</span>
                  <span className="font-data text-[10px] uppercase tracking-wide">API Error (Fallback used)</span>
                </div>
              )}
              <p className="text-sm text-ink-soft leading-relaxed">{explanation}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 font-data text-sm bg-danger text-paper px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            ✓ Yes, redact it
          </button>
          <button
            onClick={() => { onReject(); onClose(); }}
            className="flex-1 font-data text-sm border border-rule text-ink-soft px-4 py-2.5 rounded-lg hover:border-neutral hover:text-ink transition-colors"
          >
            ✕ Reveal — not PII
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
