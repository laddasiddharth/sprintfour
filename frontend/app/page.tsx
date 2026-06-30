"use client";
// NOTE: jsPDF is only used as a fallback for sample documents.
// Imported documents are redacted server-side (PDF → /api/redact-pdf-export, others → /api/redact-doc).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentData, PiiSpan, ManualSpan, CandidateMiss, PiiType } from "@/lib/types";
import { jsPDF } from "jspdf";
import { findCandidateMisses } from "@/lib/heuristics";
import { buildSegments } from "@/lib/segments";
import DocumentView from "@/components/DocumentView";
import PDFRedactViewer from "@/components/PDFRedactViewer";
import ReviewQueue from "@/components/ReviewQueue";
import StatsBar from "@/components/StatsBar";
import SafeExplanationModal from "@/components/SafeExplanationModal";

interface PendingSelection {
  start: number;
  end: number;
  text: string;
  rect?: DOMRect;
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

  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [importedDocs, setImportedDocs] = useState<DocumentData[]>([]);
  // Maps docId → original File so we can send it to /api/redact-doc on export
  const [importedFiles, setImportedFiles] = useState<Map<string, File>>(new Map());
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const allDocs = useMemo(() => [...importedDocs], [importedDocs]);
  const currentDoc = useMemo(() => allDocs.find(d => d.id === selectedDocId) || allDocs[0] || null, [selectedDocId, allDocs]);

  // Detect if the currently-viewed document is an imported PDF
  const currentFile = useMemo(() => currentDoc ? (importedFiles.get(currentDoc.id) ?? null) : null, [currentDoc, importedFiles]);
  const isPdf = useMemo(() => currentFile?.name.toLowerCase().endsWith(".pdf") ?? false, [currentFile]);

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
  }, []);

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
      setAppState("idle");
    }
  }, [currentDoc?.id, isClient]);

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
      // Store the original File so we can send it to /api/redact-doc on export
      setImportedFiles(prev => new Map(prev).set(newDoc.id, file));
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

    // Clear state and load from API
    setSpans([]);
    setManualSpans([]);
    setCandidates([]);
    setSource(null);
    setNote(undefined);
    setManualCounter(0);
    if (!currentDoc) return;
    await loadDetection(currentDoc.text);
  }

  async function handleRerun() {
    setRerunning(true);
    setSpans([]);
    setManualSpans([]);
    setPendingSelection(null);
    if (!currentDoc) return;
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

  function handleSelectText(start: number, end: number, text: string, rect: DOMRect) {
    setPendingSelection({ start, end, text, rect });
  }

  function handleExplainSafe() {
    if (!pendingSelection || !currentDoc) return;
    const { text, start, end } = pendingSelection;
    const ctxStart = Math.max(0, start - 40);
    const ctxEnd = Math.min(currentDoc.text.length, end + 40);
    const context = currentDoc.text.slice(ctxStart, ctxEnd);
    
    setSafeExplanationText({ text, context, start, end });
    setPendingSelection(null);
  }

  function redactSafeText() {
    if (!safeExplanationText) return;
    setManualSpans((prev) => [
      ...prev,
      {
        id: `manual-${manualCounter}`,
        text: safeExplanationText.text,
        type: "other",
        start: safeExplanationText.start,
        end: safeExplanationText.end,
        addedBy: "sam",
        confidence: 1,
      },
    ]);
    setManualCounter((n) => n + 1);
    setCandidates((prev) =>
      prev.filter(
        (c) => c.end <= safeExplanationText.start || c.start >= safeExplanationText.end,
      ),
    );
    setSafeExplanationText(null);
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
    () => buildSegments(currentDoc?.text || "", spans, manualSpans, candidates),
    [currentDoc?.text, spans, manualSpans, candidates],
  );

  async function handleExport() {
    if (!currentDoc) return;
    const originalFile = importedFiles.get(currentDoc.id);

    // ── Imported file: send to Python backend ────────────────────────────────
    if (originalFile) {
      setExporting(true);
      try {
        // Spans to redact: confirmed + pending (not rejected) + manual
        const redactedSpans = [
          ...spans
            .filter((s) => s.status !== "rejected")
            .map((s) => ({ text: s.text, type: s.type })),
          ...manualSpans.map((s) => ({ text: s.text, type: s.type })),
        ];

        const formData = new FormData();
        formData.append("file", originalFile);
        formData.append("redactions", JSON.stringify(redactedSpans));

        // PDF → PyMuPDF black bars  |  other formats → █ block replacement
        const endpoint = originalFile.name.toLowerCase().endsWith(".pdf")
          ? "/api/redact-pdf-export"
          : "/api/redact-doc";

        const res = await fetch(endpoint, { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Unknown error" }));
          alert(`Export failed: ${err.detail || res.statusText}`);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `redacted-${originalFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Export failed: ${(err as Error).message}`);
      } finally {
        setExporting(false);
      }
      return;
    }

    // ── Sample document: fall back to jsPDF ──────────────────────────────────
    let output = "";
    for (const seg of segments) {
      if (seg.kind === "plain") {
        output += seg.text;
      } else if (seg.kind === "suggested") {
        if (seg.span.status === "rejected") {
          output += seg.text;
        } else {
          output += "[REDACTED]";
        }
      } else if (seg.kind === "manual") {
        output += "[REDACTED]";
      } else if (seg.kind === "candidate") {
        output += seg.text;
      }
    }

    const doc = new jsPDF();
    doc.setFontSize(11);
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const lines = doc.splitTextToSize(output, pageWidth);
    let cursorY = margin + 5;
    const lineHeight = 5.5;

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
    <>
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
      <div className="w-[96%] max-w-[1800px] mx-auto">
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
          exporting={exporting}
        />

        {appState === "idle" ? (
          <div className="flex flex-col items-center justify-center py-8 md:py-16 text-center animate-fade-in">
            <div className="bg-paper border border-rule rounded-2xl shadow-xl p-6 md:p-10 max-w-lg w-full transition-all duration-300 hover:shadow-2xl">
              <h1 className="font-display text-2xl md:text-3xl font-bold bg-gradient-to-br from-ink to-ink-soft bg-clip-text text-transparent mb-2">Conseal PII Detector</h1>
              <p className="font-data text-sm text-neutral mb-8">Upload your file to begin analysis.</p>

              {/* File drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer border-2 border-dashed rounded-xl px-6 py-10 mb-6 transition-all duration-300 ease-out flex flex-col items-center justify-center ${
                  isDragging
                    ? "border-ink bg-ink/5 scale-[1.02] shadow-[inset_0_0_20px_rgba(0,0,0,0.02)] dark:shadow-[inset_0_0_20px_rgba(255,255,255,0.02)]"
                    : "border-rule hover:border-neutral hover:bg-paper-dim/80 hover:shadow-sm"
                }`}
              >
                {importing ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 rounded-full border-2 border-neutral border-t-ink animate-spin" />
                    <span className="font-data text-sm text-neutral tracking-wide">Extracting text…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 transition-transform duration-300 hover:scale-105">
                    <span className="text-4xl">📂</span>
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

              {/* Document selection */}
              {importedDocs.length > 0 && (
                <div className="flex flex-col gap-4 text-left">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-px bg-rule" />
                    <span className="font-data text-[11px] text-neutral uppercase tracking-widest">or select imported</span>
                    <div className="flex-1 h-px bg-rule" />
                  </div>
                  <select
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    className="w-full bg-paper border border-rule rounded-lg px-4 py-3 text-ink focus:outline-none focus:ring-2 focus:ring-ink truncate"
                  >
                    {importedDocs.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.title}</option>
                    ))}
                  </select>
  
                  <button
                    onClick={handleAnalyze}
                    disabled={importing}
                    className="w-full font-data text-sm bg-ink text-paper px-4 py-3.5 rounded-lg hover:opacity-90 transition-opacity font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Analyze Document
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-24 gap-3 animate-fade-in">
            <div className="w-5 h-5 rounded-full border-2 border-neutral border-t-ink animate-spin" />
            <p className="font-data text-sm text-neutral">Running detection…</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start animate-fade-in">
            <div className="w-full">
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
                    {importedDocs.map(doc => (
                      <option key={doc.id} value={doc.id}>{doc.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              {pendingSelection && pendingSelection.rect && (
                <div
                  className="fixed z-50 bg-paper shadow-xl border border-rule rounded-lg px-4 py-3 flex gap-3 items-center"
                  style={{
                    top: pendingSelection.rect.top - 60,
                    left: pendingSelection.rect.left,
                  }}
                >
                  <p className="font-data text-[11px] text-neutral mr-2">
                    Redact this text?
                  </p>
                  <button
                    onClick={() => confirmManualType("other")}
                    className="font-data text-xs bg-ink text-paper px-3 py-1.5 rounded hover:opacity-90"
                  >
                    Redact
                  </button>
                  <button
                    onClick={handleExplainSafe}
                    className="font-data text-xs border border-rule text-ink-soft px-3 py-1.5 rounded hover:border-neutral hover:text-ink transition-colors"
                  >
                    Why wasn't this redacted?
                  </button>
                  <button
                    onClick={() => setPendingSelection(null)}
                    className="font-data text-xs text-neutral hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                {/* ORIGINAL PANE */}
                <div className="relative">
                  {isPdf && currentFile ? (
                    <PDFRedactViewer
                      mode="original"
                      file={currentFile}
                      spans={spans}
                      manualSpans={manualSpans}
                      onConfirm={confirmSpan}
                      onReject={rejectSpan}
                      focusedId={focusedId}
                      onFocus={setFocusedId}
                      onSelectText={handleSelectText}
                    />
                  ) : (
                    <DocumentView
                      mode="original"
                      segments={segments}
                      focusedId={focusedId}
                      onFocus={setFocusedId}
                      onSelectText={handleSelectText}
                      onConfirm={confirmSpan}
                      onReject={rejectSpan}
                      documentText={currentDoc.text}
                    />
                  )}
                </div>

                {/* REDACTED PANE */}
                <div className="relative pointer-events-none">
                  {isPdf && currentFile ? (
                    <PDFRedactViewer
                      mode="redacted"
                      file={currentFile}
                      spans={spans}
                      manualSpans={manualSpans}
                      onConfirm={confirmSpan}
                      onReject={rejectSpan}
                      focusedId={focusedId}
                      onFocus={setFocusedId}
                    />
                  ) : (
                    <DocumentView
                      mode="redacted"
                      segments={segments}
                      focusedId={focusedId}
                      onFocus={setFocusedId}
                      onSelectText={handleSelectText}
                      onConfirm={confirmSpan}
                      onReject={rejectSpan}
                      documentText={currentDoc.text}
                    />
                  )}
                </div>
              </div>
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

      {safeExplanationText && (
        <SafeExplanationModal
          text={safeExplanationText.text}
          context={safeExplanationText.context}
          onRedact={redactSafeText}
          onClose={() => setSafeExplanationText(null)}
        />
      )}
    </>
  );
}
