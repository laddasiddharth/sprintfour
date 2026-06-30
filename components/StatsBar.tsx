"use client";

import { useTheme } from "./ThemeProvider";

interface Props {
  totalSuggested: number;
  confirmed: number;
  rejected: number;
  possibleMisses: number;
  added: number;
  source: "live" | "fallback" | null;
  note?: string;
  onRerun: () => void;
  rerunning: boolean;
  onExport: () => void;
}

export default function StatsBar({
  totalSuggested,
  confirmed,
  rejected,
  possibleMisses,
  added,
  source,
  note,
  onRerun,
  rerunning,
  onExport,
}: Props) {
  const { theme, toggle } = useTheme();
  const allClear =
    possibleMisses === 0 &&
    rejected + confirmed + added === totalSuggested + added;

  return (
    <div className="flex flex-col gap-1 mb-8">
      {/* Top row */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink leading-tight">
            Conseal{" "}
            <span className="text-neutral font-normal">— Correction</span>
          </h1>
          <p className="text-ink-soft text-sm mt-1">
            Fix the tool&apos;s mistakes before this file goes out.
          </p>
        </div>

        <div className="flex items-center gap-5">
          {/* Stats */}
          <div className="flex items-center gap-4 font-data text-xs">
            <Stat label="suggested" value={totalSuggested} />
            <Divider />
            <Stat label="confirmed" value={confirmed} />
            <Divider />
            <Stat label="false positives" value={rejected} tone="low-risk" />
            <Divider />
            <Stat
              label="possible misses"
              value={possibleMisses}
              tone={possibleMisses > 0 ? "danger" : "low-risk"}
            />
            <Divider />
            <Stat label="added by you" value={added} />
          </div>

          {/* Dark mode toggle */}
          <div className="flex items-center gap-2 ml-2">
            <span className="font-data text-[11px] text-neutral select-none">
              {theme === "dark" ? "🌙" : "☀️"}
            </span>
            <button
              className="theme-toggle"
              onClick={toggle}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            />
          </div>
        </div>
      </div>

      {/* Source row */}
      <div className="flex items-center justify-between mt-2 border-t border-rule pt-2">
        <div className="flex items-center gap-2">
          {source && (
            <span
              className={`font-data text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                source === "live"
                  ? "text-low-risk border-low-risk/40 bg-low-risk-bg"
                  : "text-neutral border-rule bg-paper"
              }`}
            >
              {source === "live" ? "● Live" : "○ Saved run"}
            </span>
          )}
          {note && (
            <p className="font-data text-[11px] text-neutral">{note}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={onExport}
            className="font-data text-[11px] text-ink border border-rule px-2 py-0.5 rounded hover:bg-paper-dim transition-colors"
          >
            Export Document
          </button>
          <button
            onClick={onRerun}
            disabled={rerunning}
            className="font-data text-[11px] text-neutral hover:text-ink underline disabled:opacity-50 transition-colors"
          >
            {rerunning ? "running…" : "re-run live detection"}
          </button>
        </div>
      </div>

      {/* All clear banner */}
      {allClear && totalSuggested > 0 && (
        <div className="mt-3 bg-low-risk-bg border border-low-risk/30 rounded-md px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-low-risk text-base">✓</span>
            <p className="font-data text-xs text-low-risk">
              All flagged items resolved. Document ready to send.
            </p>
          </div>
          <button
            onClick={onExport}
            className="font-data text-[11px] uppercase tracking-wider bg-low-risk text-paper px-3 py-1.5 rounded hover:opacity-90 transition-opacity font-bold"
          >
            Download Redacted File
          </button>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <span className="text-rule text-lg select-none">|</span>;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger" | "low-risk";
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "low-risk"
        ? "text-low-risk"
        : "text-ink";
  return (
    <div className="text-right">
      <div className={`text-lg font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="text-neutral uppercase tracking-wide text-[10px]">{label}</div>
    </div>
  );
}
