"use client";

import { useEffect, useState, useCallback } from "react";
import { PiiType } from "@/lib/types";
import { PII_TYPES, TYPE_LABEL } from "@/lib/ui";

interface Props {
  text: string;
  context: string;
  onRedact: (type: PiiType) => void;
  onClose: () => void;
}

export default function SafeExplanationModal({ text, context, onRedact, onClose }: Props) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showTypes, setShowTypes] = useState(false);

  const fetchExplanation = useCallback(async () => {
    setLoading(true);
    setHasError(false);
    try {
      const res = await fetch("/api/explain-safe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, context }),
      });
      const data = await res.json();
      setExplanation(data.explanation);
      if (data.error) setHasError(true);
    } catch {
      setExplanation(`"${text}" was not flagged as PII. It likely appears to be a generic term or business information that does not identify a specific private individual.`);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, [text, context]);

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
        <div className="px-6 pt-6 pb-4 border-b border-rule bg-safe-bg dark:bg-green-950/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-data text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full border bg-green-100 text-green-800 border-green-300 dark:bg-green-900/60 dark:text-green-300 dark:border-green-700">
                MARKED SAFE
              </span>
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
        <div className="px-6 pb-6">
          {showTypes ? (
            <div>
              <p className="font-data text-xs text-neutral mb-3">Redact as:</p>
              <div className="flex flex-wrap gap-2">
                {PII_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => { onRedact(t); onClose(); }}
                    className="font-data text-[11px] uppercase tracking-wider bg-ink text-paper px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                  >
                    {TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 font-data text-sm bg-ink text-paper px-4 py-2.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
              >
                Got it, leave visible
              </button>
              <button
                onClick={() => setShowTypes(true)}
                className="flex-1 font-data text-sm border border-rule text-ink-soft px-4 py-2.5 rounded-lg hover:border-neutral hover:text-ink transition-colors"
              >
                I disagree, redact it
              </button>
            </div>
          )}
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
