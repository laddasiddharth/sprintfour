"use client";

/**
 * PDFRedactViewer
 * ---------------
 * Renders a PDF file page-by-page using pdfjs-dist, then overlays black bars
 * at the exact positions of confirmed/pending PII spans.
 *
 * - Pending PII  → semi-transparent dark bar (hover to Confirm / Reject)
 * - Confirmed PII → solid black bar
 * - Rejected PII  → no overlay
 *
 * Positions are computed by matching PII text strings to PDF.js text-item
 * bounding boxes using character-level tracking.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import type { PiiSpan, ManualSpan } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const RENDER_SCALE = 1.5; // canvas resolution multiplier

// ── Types ────────────────────────────────────────────────────────────────────

interface TextBlock {
  str: string;
  x: number;  // canvas px, left edge of baseline
  y: number;  // canvas px, top of glyph
  w: number;  // canvas px, advance width
  h: number;  // canvas px, glyph height
}

interface PDFPage {
  num: number;
  imgUrl: string;
  canvasW: number;
  canvasH: number;
  blocks: TextBlock[];
  text: string; // concatenated text (no separator) for indexOf matching
}

interface OverlayBox {
  key: string;
  spanId: string;
  status: "confirmed" | "pending" | "rejected";
  type: string;
  text: string;
  isManual: boolean;
  pageNum: number;
  // Absolute canvas pixel coords (for % conversion)
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  mode: "original" | "redacted";
  file: File;
  spans: PiiSpan[];
  manualSpans: ManualSpan[];
  focusedId: string | null;
  onFocus: (id: string | null) => void;
  onSelectText?: (start: number, end: number, text: string, rect: DOMRect) => void;
}

// ── Matrix helpers (avoid depending on pdfjs Util API version) ───────────────

function multiplyMatrix(m1: number[], m2: number[]): number[] {
  // [a, b, c, d, e, f]  ←  affine 2D matrix
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PDFRedactViewer({
  mode,
  file,
  spans,
  manualSpans,
  focusedId,
  onFocus,
  onSelectText,
}: Props) {
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const blobUrlsRef = useRef<string[]>([]);

  // ── Load & render PDF ──────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const newUrls: string[] = [];

    async function load() {
      setLoadState("loading");
      setPages([]);

      try {
        // Dynamic import so Next.js doesn't SSR it
        const pdfjs = await import("pdfjs-dist");

        // Use CDN worker — reliable across all bundlers / Next.js versions
        if (!pdfjs.GlobalWorkerOptions.workerSrc) {
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        }

        const arrayBuf = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({
          data: new Uint8Array(arrayBuf),
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        }).promise;

        const result: PDFPage[] = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;

          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: RENDER_SCALE });

          // ── Render page to canvas ──────────────────────────────────────────
          const offscreen = document.createElement("canvas");
          offscreen.width = Math.round(viewport.width);
          offscreen.height = Math.round(viewport.height);
          const ctx = offscreen.getContext("2d")!;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({ canvasContext: ctx, viewport } as any).promise;

          const imgUrl = await new Promise<string>((resolve) => {
            offscreen.toBlob((blob) => {
              const url = URL.createObjectURL(blob!);
              newUrls.push(url);
              resolve(url);
            }, "image/png");
          });

          // ── Extract text blocks with canvas positions ──────────────────────
          const content = await page.getTextContent();
          const blocks: TextBlock[] = [];
          let text = "";

          for (const rawItem of content.items) {
            // Filter to only TextItem (not TextMarkedContent which has no str)
            if (!("str" in rawItem)) continue;
            const item = rawItem as { str: string; transform: number[]; width: number; height: number };
            if (!item.str) continue;

            // Combine viewport transform with item transform →
            // result[4] = canvas x, result[5] = canvas y of baseline
            const tx = multiplyMatrix(
              viewport.transform as unknown as number[],
              item.transform
            );

            const fontH = Math.abs(tx[3]); // scaled font height in canvas px
            const x = tx[4];
            const y = tx[5] - fontH;       // top of the glyph box
            const w = Math.abs(item.width) * RENDER_SCALE; // approx canvas width

            blocks.push({ str: item.str, x, y, w, h: fontH * 1.2 });
          }

          // Sort blocks visually (top-to-bottom, left-to-right)
          blocks.sort((a, b) => {
            if (Math.abs(a.y - b.y) > 5) {
              return a.y - b.y;
            }
            return a.x - b.x;
          });

          text = blocks.map(b => b.str).join("");

          result.push({
            num: pageNum,
            imgUrl,
            canvasW: offscreen.width,
            canvasH: offscreen.height,
            blocks,
            text,
          });

          if (!cancelled) {
            // Progressive update — show pages as they render
            setPages((prev) => [...prev, result[result.length - 1]]);
          }
        }

        if (!cancelled) {
          // Revoke old blob URLs now that new ones are ready
          blobUrlsRef.current.forEach(URL.revokeObjectURL);
          blobUrlsRef.current = newUrls;
          setLoadState("done");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("PDF load error:", err);
          setErrorMsg((err as Error).message || "Unknown error");
          setLoadState("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [file]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(URL.revokeObjectURL);
    };
  }, []);

  // ── Compute overlay boxes ──────────────────────────────────────────────────

  const boxes = useMemo<OverlayBox[]>(() => {
    if (pages.length === 0) return [];

    const result: OverlayBox[] = [];

    function findBoxes(
      id: string,
      text: string,
      type: string,
      status: "confirmed" | "pending" | "rejected",
      isManual: boolean
    ) {
      for (const page of pages) {
        let pStripped = "";
        const pMap: number[] = [];
        for (let i = 0; i < page.text.length; i++) {
          if (!/\s/.test(page.text[i])) {
            pStripped += page.text[i].toLowerCase();
            pMap.push(i);
          }
        }

        const targetStripped = text.replace(/\s+/g, "").toLowerCase();
        if (!targetStripped) continue;

        let fromStripped = 0;
        let occurrence = 0;

        while (true) {
          const idxStripped = pStripped.indexOf(targetStripped, fromStripped);
          if (idxStripped === -1) break;

          const matchStart = pMap[idxStripped];
          const matchEnd = pMap[idxStripped + targetStripped.length - 1] + 1;

          // Walk blocks tracking char positions to find which blocks overlap
          let charPos = 0;
          let minX = Infinity, minY = Infinity;
          let maxX = -Infinity, maxY = -Infinity;
          let found = false;

          for (const block of page.blocks) {
            const bStart = charPos;
            const bEnd = charPos + block.str.length;

            if (bEnd > matchStart && bStart < matchEnd) {
              minX = Math.min(minX, block.x);
              minY = Math.min(minY, block.y);
              maxX = Math.max(maxX, block.x + block.w);
              maxY = Math.max(maxY, block.y + block.h);
              found = true;
            }

            charPos = bEnd;
          }

          if (mode === "redacted" && status === "rejected") return;

          if (found) {
            result.push({
              key: `${id}-p${page.num}-${occurrence}`,
              spanId: id,
              status,
              type,
              text,
              isManual,
              pageNum: page.num,
              x: minX,
              y: minY,
              w: maxX - minX,
              h: maxY - minY,
            });
          }

          fromStripped = idxStripped + 1;
          occurrence++;
        }
      }
    }

    for (const span of spans) {
      findBoxes(span.id, span.text, span.type, span.status, false);
    }
    for (const span of manualSpans) {
      findBoxes(span.id, span.text, span.type, "confirmed", true);
    }

    return result;
  }, [pages, spans, manualSpans, mode]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleMouseUp() {
    if (mode !== "original" || !onSelectText) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || text.length < 2) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    let startNode = range.startContainer;
    if (startNode.nodeType === Node.TEXT_NODE) startNode = startNode.parentNode!;
    
    let el: HTMLElement | null = startNode as HTMLElement;
    while (el && !el.getAttribute("data-global-start") && el.tagName !== "DIV") {
      el = el.parentElement;
    }

    let globalStart = 0;
    if (el) {
      const segStartStr = el.getAttribute("data-global-start");
      if (segStartStr) {
        globalStart = parseInt(segStartStr, 10) + range.startOffset;
      }
    }

    onSelectText(globalStart, globalStart + text.length, text, rect);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadState === "error") {
    return (
      <div className="bg-danger/10 border border-danger/30 rounded-lg p-5">
        <p className="font-data text-sm text-danger font-medium">Failed to render PDF</p>
        <p className="font-data text-xs text-neutral mt-1">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div 
      className="w-full h-full overflow-auto bg-[#e5e5e5] p-4 md:p-8 custom-scrollbar select-text"
      onMouseUp={handleMouseUp}
      ref={containerRef}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Loading shimmer */}
        {loadState === "loading" && pages.length === 0 && (
          <div className="flex items-center gap-3 py-16 animate-fade-in">
            <div className="w-5 h-5 rounded-full border-2 border-neutral border-t-ink animate-spin" />
            <p className="font-data text-sm text-neutral">Rendering PDF…</p>
          </div>
        )}

        {pages.map((page, pageIndex) => {
            // Calculate an approximate global start for this page
            const pageGlobalStart = pages.slice(0, pageIndex).reduce((acc, p) => acc + p.text.length, 0);
            const pageBoxes = boxes.filter((b) => b.pageNum === page.num);

        return (
          <div
            key={page.num}
            className="relative rounded-lg overflow-hidden shadow-2xl ring-1 ring-rule"
            style={{ width: page.canvasW, maxWidth: "100%" }}
          >
            {/* Actual PDF page rendered as image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.imgUrl}
              alt={`Page ${page.num}`}
              className="block w-full select-none"
              draggable={false}
            />

            {/* Transparent Text Layer for Selection */}
            {mode === "original" && (
              <div className="absolute inset-0 text-transparent selection:bg-purple-500/30 selection:text-transparent z-10">
                {page.blocks.map((b, i) => {
                  const left = `${(b.x / page.canvasW) * 100}%`;
                  const top = `${(b.y / page.canvasH) * 100}%`;
                  const width = `${(b.w / page.canvasW) * 100}%`;
                  const height = `${(b.h / page.canvasH) * 100}%`;
                  // We need to find the block's character start within the page text
                  const blockStart = page.blocks.slice(0, i).reduce((acc, curr) => acc + curr.str.length, 0);
                  const globalStart = pageGlobalStart + blockStart;

                  return (
                    <span
                      key={i}
                      data-global-start={globalStart}
                      className="absolute leading-none whitespace-pre flex items-center"
                      style={{ left, top, width, height, fontSize: `${b.h}px`, lineHeight: 1 }}
                    >
                      {b.str}{" "}
                    </span>
                  );
                })}
              </div>
            )}

            {/* PII overlay boxes */}
            <div className="absolute inset-0 pointer-events-none z-20">
              {pageBoxes.map((box) => {
                // Convert absolute canvas px to % for responsive scaling
                const left = `${(box.x / page.canvasW) * 100}%`;
                const top = `${(box.y / page.canvasH) * 100}%`;
                const width = `${(box.w / page.canvasW) * 100}%`;
                const height = `${(box.h / page.canvasH) * 100}%`;

                const isFocused = focusedId === box.spanId;
                const isConfirmed = box.status === "confirmed" || box.isManual;
                const isRejected = box.status === "rejected";
                const isPending = box.status === "pending";

                if (mode === "redacted") {
                  if (isRejected) return null;
                  return (
                    <div
                      key={box.key}
                      className="absolute pointer-events-none bg-black"
                      style={{ left, top, width, height }}
                    />
                  );
                }

                // Original Mode
                let bgColor = "rgba(96, 165, 250, 0.3)"; // default blue-400/30
                let borderColor = "rgba(96, 165, 250, 0.8)";
                if (isRejected) {
                  bgColor = "rgba(239, 68, 68, 0.1)"; // red-500/10
                  borderColor = "rgba(239, 68, 68, 0.5)";
                } else if (isConfirmed) {
                  bgColor = "rgba(34, 197, 94, 0.3)"; // green-500/30
                  borderColor = "rgba(34, 197, 94, 0.8)";
                }

                return (
                  <div
                    key={box.key}
                    className="absolute pointer-events-auto cursor-pointer"
                    style={{
                      left,
                      top,
                      width,
                      height,
                      backgroundColor: bgColor,
                      border: `1px solid ${borderColor}`,
                      borderStyle: isPending ? "dashed" : "solid",
                      outline: isFocused ? "2px solid #60a5fa" : "none",
                      outlineOffset: "1px",
                      transition: "background-color 0.15s",
                    }}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={() => onFocus(isFocused ? null : box.spanId)}
                  >
                  </div>
                );
              })}
            </div>

            {/* Page number badge (multi-page only) */}
            {pages.length > 1 && (
              <div className="absolute bottom-2 right-2 bg-black/50 text-white/80 text-[10px] font-data px-2 py-0.5 rounded">
                {page.num} / {pages.length}
              </div>
            )}

            {/* "still loading" shimmer if more pages coming */}
            {loadState === "loading" && page.num === pages.length && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-ink/30 to-transparent animate-pulse" />
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
