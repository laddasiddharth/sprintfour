"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOCUMENTS, DocumentData } from "@/lib/sample-document";
import { PiiSpan, ManualSpan, CandidateMiss, PiiType } from "@/lib/types";
import { jsPDF } from "jspdf";
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
  const [importedDocs, setImportedDocs] = useState<DocumentData[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const allDocs = useMemo(() => [...DOCUMENTS, ...importedDocs], [importedDocs]);
  const currentDoc = useMemo(() => allDocs.find(d => d.id === selectedDocId) || allDocs[0], [selectedDocId, allDocs]);

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

  const autoAnalyzeRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
    try {
      const savedDocs = localStorage.getItem("conseal-imported-docs");
      if (savedDocs) setImportedDocs(JSON.parse(savedDocs));
      const savedId = localStorage.getItem("conseal-selected-doc-id");
      if (savedId) setSelectedDocId(savedId);
    } catch (e) {
      console.error("Failed to load local state", e);
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem("conseal-imported-docs", JSON.stringify(importedDocs));
      localStorage.setItem("conseal-selected-doc-id", selectedDocId);
    }
  }, [importedDocs, selectedDocId, isClient]);

  useEffect(() => {
    setFocusedId(null);
    setPendingSelection(null);
    setSafeExplanationText(null);
    setImportError(null);

    // Don't auto-analyze until client state is loaded
    if (!isClient) return;

    if (autoAnalyzeRef.current) {
      autoAnalyzeRef.current = false;
      handleAnalyze();
    } else {
      const saved = localStorage.getItem(`conseal-state-${currentDoc.id}`);
      if (saved) {
        // If there's a cached state for this document, automatically open it
        handleAnalyze();
      } else {
        setAppState("idle");
      }
    }
  }, [currentDoc.id, isClient]);

  const handleFileImport = useCallback(async (file: File) => {
    setImportError(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract-text", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || data.error) {
        setImportError(data.error || "Failed to extract text from file.");
        return;
      }
      const newDoc: DocumentData = {
        id: `imported-${Date.now()}`,
        title: file.name,
        text: data.text,
      };
      setImportedDocs(prev => [...prev, newDoc]);
      autoAnalyzeRef.current = true;
      setSelectedDocId(newDoc.id);
    } catch {
      setImportError("An unexpected error occurred. Please try again.");
    } finally {
      setImporting(false);
    }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileImport(file);
  }

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
        confidence: 1,
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
        confidence: 1,
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

  function handleExport() {
    let output = "";
    for (const seg of segments) {
      if (seg.kind === "plain") {
        output += seg.text;
      } else if (seg.kind === "suggested") {
        if (seg.span.status === "rejected") {
          output += seg.text;
        } else {
          output += `[${seg.span.type.toUpperCase()}]`;
        }
      } else if (seg.kind === "manual") {
        output += `[${seg.span.type.toUpperCase()}]`;
      } else if (seg.kind === "candidate") {
        output += seg.text;
      }
    }

    const doc = new jsPDF();
    doc.setFontSize(11);
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // splitTextToSize automatically wraps long text so it fits the PDF width
    const lines = doc.splitTextToSize(output, pageWidth);
    
    let cursorY = margin + 5;
    const lineHeight = 5.5; // Approximate line height for 11pt font in mm

    for (const line of lines) {
      if (cursorY > pageHeight - margin) {
        doc.addPage();
        cursorY = margin + 5;
      }
      doc.text(line, margin, cursorY);
      cursorY += lineHeight;
    }

    doc.save(`redacted-${currentDoc.title || "document"}.pdf`);
  }

  const activeCandidates = candidates.filter((c) => !c.dismissed).length;
  const confirmedCount = spans.filter((s) => s.status === "confirmed").length;
  const rejectedCount = spans.filter((s) => s.status === "rejected").length;

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 bg-paper-dim">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".txt,.md,.csv,.pdf,.doc,.docx,.html,.htm,.rtf,.json,.xml,.log"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileImport(file);
          e.target.value = "";
        }}
      />
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
          onExport={handleExport}
        />

        {appState === "idle" ? (
          <div className="flex flex-col items-center justify-center py-8 md:py-16 text-center animate-fade-in">
            <div className="bg-paper border border-rule rounded-2xl shadow-xl p-6 md:p-10 max-w-lg w-full">
              <h1 className="font-display text-2xl font-semibold text-ink mb-1">Conseal PII Detector</h1>
              <p className="font-data text-sm text-neutral mb-8">Select a sample document or import your own file to begin analysis.</p>

              {/* File drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer border-2 border-dashed rounded-xl px-6 py-8 mb-6 transition-all ${
                  isDragging
                    ? "border-ink bg-ink/5 scale-[1.01]"
                    : "border-rule hover:border-neutral hover:bg-paper-dim/50"
                }`}
              >
                {importing ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-neutral border-t-ink animate-spin" />
                    <span className="font-data text-sm text-neutral">Extracting text…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">📂</span>
                    <p className="font-data text-sm text-ink font-medium">Drop a file here or click to browse</p>
                    <p className="font-data text-[11px] text-neutral">
                      PDF · DOCX · TXT · MD · CSV · HTML · RTF · JSON · XML
                    </p>
                  </div>
                )}
              </div>

              {/* Import error */}
              {importError && (
                <div className="mb-4 flex items-start gap-2 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-left">
                  <span className="text-danger mt-0.5">⚠️</span>
                  <p className="font-data text-xs text-danger">{importError}</p>
                </div>
              )}

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-rule" />
                <span className="font-data text-[11px] text-neutral uppercase tracking-widest">or use sample</span>
                <div className="flex-1 h-px bg-rule" />
              </div>

              <div className="flex flex-col gap-4 text-left">
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full bg-paper border border-rule rounded-lg px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-ink truncate"
                >
                  <optgroup label="Sample Documents">
                    {DOCUMENTS.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.title}</option>
                    ))}
                  </optgroup>
                  {importedDocs.length > 0 && (
                    <optgroup label="Imported Documents">
                      {importedDocs.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>

                <button
                  onClick={handleAnalyze}
                  disabled={importing}
                  className="w-full font-data text-sm bg-ink text-paper px-4 py-3.5 rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-40 disabled:cursor-not-allowed"
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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <p className="font-data text-[11px] text-neutral uppercase tracking-widest break-words">{currentDoc.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importing}
                    className="flex items-center gap-1.5 bg-paper font-data text-xs border border-rule rounded px-2 py-1 text-ink hover:bg-paper-dim transition-colors disabled:opacity-50"
                  >
                    <span className="opacity-70">📂</span>
                    {importing ? "Uploading..." : "Upload File"}
                  </button>
                  <select
                    value={selectedDocId}
                    onChange={(e) => {
                      autoAnalyzeRef.current = true;
                      setSelectedDocId(e.target.value);
                    }}
                    className="bg-paper font-data text-xs border border-rule rounded px-2 py-1 text-ink focus:outline-none focus:ring-1 focus:ring-ink"
                  >
                    <optgroup label="Sample">
                      {DOCUMENTS.map(doc => (
                        <option key={doc.id} value={doc.id}>{doc.title}</option>
                      ))}
                    </optgroup>
                    {importedDocs.length > 0 && (
                      <optgroup label="Imported">
                        {importedDocs.map(doc => (
                          <option key={doc.id} value={doc.id}>{doc.title}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
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
                    <div className="flex items-center gap-3">
                      <select
                        onChange={(e) => confirmManualType(e.target.value as PiiType)}
                        defaultValue=""
                        className="flex-1 font-data text-xs bg-paper border border-rule rounded-md px-3 py-2 text-ink focus:outline-none focus:border-neutral"
                      >
                        <option value="" disabled>Select category...</option>
                        {PII_TYPES.map((t) => (
                          <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => setPendingSelection(null)}
                        className="font-data text-[11px] text-neutral underline hover:text-ink transition-colors"
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
