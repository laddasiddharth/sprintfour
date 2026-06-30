"use client";

import { useEffect, useMemo, useState } from "react";
import { DOCUMENTS } from "@/lib/sample-document";
import { PiiSpan, ManualSpan, CandidateMiss, PiiType } from "@/lib/types";
import { findCandidateMisses } from "@/lib/heuristics";
import { buildSegments } from "@/lib/segments";
import DocumentView from "@/components/DocumentView";
import ReviewQueue from "@/components/ReviewQueue";
import StatsBar from "@/components/StatsBar";
import SafeExplanationModal from "@/components/SafeExplanationModal";
import { PII_TYPES, TYPE_LABEL } from "@/lib/ui";

interface PendingSelection {
  start: number;
  end: number;
  text: string;
}

export default function Home() {
  const [spans, setSpans] = useState<PiiSpan[]>([]);
  const [manualSpans, setManualSpans] = useState<ManualSpan[]>([]);
  const [candidates, setCandidates] = useState<CandidateMiss[]>([]);
  const [source, setSource] = useState<"live" | "fallback" | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [appState, setAppState] = useState<"idle" | "ready">("idle");
  const [loading, setLoading] = useState(false);
  const [rerunning, setRerunning] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [safeExplanationText, setSafeExplanationText] = useState<{text: string, context: string, start: number, end: number} | null>(null);
  const [manualCounter, setManualCounter] = useState(0);

  const [selectedDocId, setSelectedDocId] = useState<string>(DOCUMENTS[0].id);
  
  const currentDoc = useMemo(() => DOCUMENTS.find(d => d.id === selectedDocId) || DOCUMENTS[0], [selectedDocId]);

  async function loadDetection(docText: string) {
    setLoading(true);
    const res = await fetch("/api/detect", { 
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentText: docText })
    });
    const data = await res.json();
    setSpans(data.spans);
    setSource(data.source);
    setNote(data.note);

    const covered: { start: number; end: number }[] = [];
    (data.spans as PiiSpan[]).forEach((s) => {
      let searchFrom = 0;
      while (true) {
        const start = docText.indexOf(s.text, searchFrom);
        if (start === -1) break;
        covered.push({ start, end: start + s.text.length });
        searchFrom = start + s.text.length;
      }
    });

    setCandidates(findCandidateMisses(docText, covered));
    setLoading(false);
  }

  useEffect(() => {
    // When document changes, reset to idle
    setAppState("idle");
    setFocusedId(null);
    setPendingSelection(null);
    setSafeExplanationText(null);
  }, [currentDoc.id]);

  async function handleAnalyze() {
    setLoading(true);
    setAppState("ready");

    const saved = localStorage.getItem(`conseal-state-${currentDoc.id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.docLength !== currentDoc.text.length) {
          throw new Error("Document text changed, cache invalidated");
        }
        setSpans(parsed.spans || []);
        setManualSpans(parsed.manualSpans || []);
        setCandidates(parsed.candidates || []);
        setSource(parsed.source || null);
        setNote(parsed.note);
        setManualCounter(parsed.manualCounter || 0);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }

    // Otherwise, clear state and load from API
    setSpans([]);
    setManualSpans([]);
    setCandidates([]);
    setSource(null);
    setNote(undefined);
    setManualCounter(0);
    await loadDetection(currentDoc.text);
  }

  // Sync state back to localStorage whenever it changes
  useEffect(() => {
    if (appState !== "ready" || loading || rerunning) return;
    localStorage.setItem(
      `conseal-state-${currentDoc.id}`,
      JSON.stringify({
        spans,
        manualSpans,
        candidates,
        source,
        note,
        manualCounter,
        docLength: currentDoc.text.length,
      })
    );
  }, [spans, manualSpans, candidates, source, note, manualCounter, currentDoc.id, currentDoc.text.length, loading, rerunning, appState]);

  async function handleRerun() {
    setRerunning(true);
    localStorage.removeItem(`conseal-state-${currentDoc.id}`);
    setSpans([]);
    setManualSpans([]);
    setPendingSelection(null);
    await loadDetection(currentDoc.text);
    setRerunning(false);
  }

  function confirmSpan(id: string) {
    setSpans((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "confirmed" } : s)),
    );
  }

  function rejectSpan(id: string, reason: string) {
    setSpans((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "rejected", reason } : s)),
    );
  }

  function redactCandidate(id: string, type: PiiType) {
    const candidate = candidates.find((c) => c.id === id);
    if (!candidate) return;
    setManualSpans((prev) => [
      ...prev,
      {
        id: `manual-${manualCounter}`,
        text: candidate.text,
        type,
        start: candidate.start,
        end: candidate.end,
        addedBy: "sam",
      },
    ]);
    setManualCounter((n) => n + 1);
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dismissed: true } : c)),
    );
  }

  function dismissCandidate(id: string) {
    setCandidates((prev) =>
      prev.map((c) => (c.id === id ? { ...c, dismissed: true } : c)),
    );
  }

  function removeManual(id: string) {
    setManualSpans((prev) => prev.filter((m) => m.id !== id));
  }

  function handleSelectText(start: number, end: number, text: string) {
    setPendingSelection({ start, end, text });
  }

  function handleExplainSafe() {
    if (!pendingSelection) return;
    const { text, start, end } = pendingSelection;
    const ctxStart = Math.max(0, start - 40);
    const ctxEnd = Math.min(currentDoc.text.length, end + 40);
    const context = currentDoc.text.slice(ctxStart, ctxEnd);
    
    setSafeExplanationText({ text, context, start, end });
    setPendingSelection(null);
  }

  function confirmManualType(type: PiiType) {
    if (!pendingSelection) return;
    setManualSpans((prev) => [
      ...prev,
      {
        id: `manual-${manualCounter}`,
        text: pendingSelection.text,
        type,
        start: pendingSelection.start,
        end: pendingSelection.end,
        addedBy: "sam",
      },
    ]);
    setManualCounter((n) => n + 1);
    setCandidates((prev) =>
      prev.filter(
        (c) => c.end <= pendingSelection.start || c.start >= pendingSelection.end,
      ),
    );
    setPendingSelection(null);
  }

  const segments = useMemo(
    () => buildSegments(currentDoc.text, spans, manualSpans, candidates),
    [currentDoc.text, spans, manualSpans, candidates],
  );

  const activeCandidates = candidates.filter((c) => !c.dismissed).length;
  const confirmedCount = spans.filter((s) => s.status === "confirmed").length;
  const rejectedCount = spans.filter((s) => s.status === "rejected").length;

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 bg-paper-dim">
      <div className="max-w-6xl mx-auto">
        <StatsBar
          totalSuggested={spans.length}
          confirmed={confirmedCount}
          rejected={rejectedCount}
          possibleMisses={activeCandidates}
          added={manualSpans.length}
          source={source}
          note={note}
          onRerun={handleRerun}
          rerunning={rerunning}
        />

        {appState === "idle" ? (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-fade-in">
            <div className="bg-paper border border-rule rounded-2xl shadow-xl p-10 max-w-md w-full">
              <h1 className="font-display text-2xl font-semibold text-ink mb-2">Conseal PII Detector</h1>
              <p className="font-data text-sm text-neutral mb-8">Select a document to begin analysis.</p>
              
              <div className="flex flex-col gap-4 text-left">
                <label className="font-data text-[11px] uppercase tracking-widest text-neutral font-semibold">
                  Document
                </label>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-lg px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                >
                  {DOCUMENTS.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
                
                <button
                  onClick={handleAnalyze}
                  className="mt-4 w-full font-data text-sm bg-ink text-paper px-4 py-3.5 rounded-lg hover:opacity-90 transition-opacity font-medium"
                >
                  Analyze Document
                </button>
              </div>
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 gap-3 animate-fade-in">
            <div className="w-5 h-5 rounded-full border-2 border-neutral border-t-ink animate-spin" />
            <p className="font-data text-sm text-neutral">Running detection…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start animate-fade-in">
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="font-data text-[11px] text-neutral uppercase tracking-widest">{currentDoc.title}</p>
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="bg-paper font-data text-xs border border-rule rounded px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                >
                  {DOCUMENTS.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.title}</option>
                  ))}
                </select>
              </div>
              <DocumentView
                segments={segments}
                focusedId={focusedId}
                onFocus={setFocusedId}
                onSelectText={handleSelectText}
                onConfirm={confirmSpan}
                onReject={rejectSpan}
                documentText={currentDoc.text}
              />
              {pendingSelection && (
                <div className="mt-4 bg-paper border border-rule rounded-lg p-4 shadow-[var(--card-shadow)] animate-fade-in">
                  <p className="font-data text-xs text-neutral mb-3">
                    Mark &ldquo;<span className="text-ink font-medium">{pendingSelection.text}</span>&rdquo; as:
                  </p>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      {PII_TYPES.map((t) => (
                        <button
                          key={t}
                          onClick={() => confirmManualType(t)}
                          className="font-data text-[11px] bg-ink text-paper px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                        >
                          {TYPE_LABEL[t]}
                        </button>
                      ))}
                      <button
                        onClick={() => setPendingSelection(null)}
                        className="font-data text-[11px] text-neutral underline px-2 hover:text-ink transition-colors"
                      >
                        cancel
                      </button>
                    </div>
                    <div className="border-t border-rule pt-3 mt-1">
                      <button
                        onClick={handleExplainSafe}
                        className="font-data text-[11px] flex items-center gap-1.5 text-neutral hover:text-ink transition-colors"
                      >
                        <span className="opacity-60">✨</span> Why wasn&apos;t this redacted?
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {safeExplanationText && (
                <SafeExplanationModal
                  text={safeExplanationText.text}
                  context={safeExplanationText.context}
                  onRedact={(type) => {
                    setPendingSelection({ start: safeExplanationText.start, end: safeExplanationText.end, text: safeExplanationText.text });
                    setTimeout(() => confirmManualType(type), 0);
                  }}
                  onClose={() => setSafeExplanationText(null)}
                />
              )}
            </div>

            <div className="lg:sticky lg:top-8 bg-paper border border-rule rounded-lg shadow-[var(--card-shadow)] p-5">
              <p className="font-data text-[11px] text-neutral uppercase tracking-widest mb-4 pb-3 border-b border-rule">
                Review Queue
              </p>
              <ReviewQueue
                spans={spans}
                manualSpans={manualSpans}
                candidates={candidates}
                focusedId={focusedId}
                onFocus={setFocusedId}
                onConfirm={confirmSpan}
                onReject={rejectSpan}
                onRedactCandidate={redactCandidate}
                onDismissCandidate={dismissCandidate}
                onRemoveManual={removeManual}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
