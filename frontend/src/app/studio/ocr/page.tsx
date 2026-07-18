"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Save, CheckCircle, AlertTriangle, ArrowRight, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { fetchDocument, updatePageText, type DocumentPage, type OCRLine, type OCRPayload, type StudioDocument } from "@/lib/api";
import { DocumentViewer } from "@/components/studio/document-viewer";
import { PipelineStepper } from "@/components/ui/pipeline-stepper";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function findPage(document: StudioDocument, pageNumber: number): DocumentPage | undefined {
  return document.pages.find((page) => page.page_number === pageNumber) || document.pages[0];
}

function pageLines(page: DocumentPage | undefined): OCRLine[] {
  return page?.ocr_json?.pages?.[0]?.lines || [];
}

function OCRStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId") || "";
  const [document, setDocument] = useState<StudioDocument | null>(null);
  const [loading, setLoading] = useState(Boolean(docId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(docId ? null : "No document was selected");
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ocrLines, setOcrLines] = useState<OCRLine[]>([]);
  
  // Zoom states
  const [sourceZoom, setSourceZoom] = useState(1);
  const [transcriptZoom, setTranscriptZoom] = useState(1);
  
  // Refs for auto-scrolling
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: number | undefined;

    async function loadData() {
      try {
        const doc = await fetchDocument(docId);
        if (cancelled) return;
        setDocument(doc);
        setOcrLines(pageLines(findPage(doc, 1)));
        setError(null);
        if (doc.status === "processing" || doc.status === "uploaded") {
          pollTimer = window.setTimeout(loadData, 2000);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load document");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (docId) void loadData();

    return () => {
      cancelled = true;
      if (pollTimer) window.clearTimeout(pollTimer);
    };
  }, [docId]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!document) return false;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const page = findPage(document, currentPage);
      if (!page) throw new Error("This document has no editable page");
      const updatedOcrJson: OCRPayload = structuredClone(page.ocr_json || { pages: [{}] });
      if (!updatedOcrJson.pages?.length) updatedOcrJson.pages = [{}];
      if (updatedOcrJson.pages[0]) {
        updatedOcrJson.pages[0].lines = ocrLines;
      }
      const textContent = ocrLines.map((line) => line.text.trim()).filter(Boolean).join("\n");
      await updatePageText(document.id, currentPage, updatedOcrJson, textContent);
      setDocument((current) => current ? {
        ...current,
        pages: current.pages.map((item) => item.page_number === currentPage
          ? { ...item, ocr_json: updatedOcrJson, text_content: textContent }
          : item),
      } : current);
      setMessage("Page saved successfully");
      return true;
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : "Failed to save page");
      return false;
    } finally {
      setSaving(false);
    }
  }, [currentPage, document, ocrLines]);

  const handleContinue = useCallback(async () => {
    if (await handleSave()) {
      router.push(`/studio/builder?docId=${document?.id}`);
    }
  }, [document?.id, handleSave, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        void handleContinue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleContinue, handleSave]);

  const handlePageChange = (pageNumber: number) => {
    if (!document) return;
    setCurrentPage(pageNumber);
    setOcrLines(pageLines(findPage(document, pageNumber)));
    setMessage(null);
    setError(null);
  };

  if (loading && !document) {
    return <div className="p-8 flex items-center justify-center h-full text-muted-foreground">Loading FutolDoc AI...</div>;
  }

  if (!document) {
    return <div className="p-8 flex items-center justify-center h-full text-red-600">{error || "Document not found"}</div>;
  }
  
  if (document && (document.status === "processing" || document.status === "uploaded")) {
    return <div className="p-8 flex items-center justify-center h-full text-muted-foreground">OCR Processing in background... Please wait.</div>;
  }

  const page = findPage(document, currentPage);
  const totalPages = document.pages.length || 1;
  const linesReviewCount = ocrLines.filter((line) => line.needsReview || line.confidence < 0.8).length;

  const handleLineChange = (index: number, newText: string) => {
    const newLines = [...ocrLines];
    newLines[index] = { ...newLines[index], text: newText, needsReview: false }; // clear review flag on manual edit
    setOcrLines(newLines);
  };

  const handleLineClick = (index: number) => {
    setHoveredLineIndex(index);
    if (lineRefs.current[index]) {
      lineRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
      lineRefs.current[index]?.querySelector('input')?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{document.filename}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-500" /> Processed</span>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span>Page {currentPage} of {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)}>
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <PipelineStepper currentStage={document?.status || "uploaded"} />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Progress (Ctrl+S)"}
          </Button>
          <Button onClick={handleContinue} disabled={saving}>Approve & Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg border px-4 py-2 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error || message}
        </div>
      )}

      {/* Side by Side Workspace */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        
        {/* Left: Source Image */}
        <div className="card-premium flex flex-col overflow-hidden bg-slate-50/50">
          <div className="p-3 border-b border-slate-100 bg-white/50 text-sm font-semibold tracking-tight text-slate-700 flex justify-between items-center">
            <span>Source Document</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSourceZoom(z => Math.max(0.1, z / 1.2))}><ZoomOut className="h-3 w-3" /></Button>
              <span className="text-xs w-10 text-center font-mono">{Math.round(sourceZoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSourceZoom(z => Math.min(5, z * 1.2))}><ZoomIn className="h-3 w-3" /></Button>
            </div>
          </div>
          {page?.image_path ? (
            <DocumentViewer
              imagePath={page.image_path}
              lines={ocrLines}
              imageWidth={page.width}
              imageHeight={page.height}
              hoveredLineIndex={hoveredLineIndex}
              onLineClick={handleLineClick}
              onLineHover={setHoveredLineIndex}
              scale={sourceZoom}
              setScale={setSourceZoom}
            />
          ) : (
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-200/50">
              <div className="bg-white border border-slate-200/60 shadow-sm w-[400px] h-[600px] flex flex-col items-center justify-center text-slate-400 p-8 text-center rounded-lg">
                <p className="font-medium text-slate-500">Source document image</p>
                <p className="text-xs mt-2">Bounding boxes overlay here</p>
              </div>
            </div>
          )}
        </div>

        {/* Right: Editable OCR Text */}
        <div className="card-premium flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-100 bg-white/50 text-sm font-semibold tracking-tight text-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span>OCR Transcript</span>
              <div className="flex items-center gap-1 ml-4 border-l pl-4">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTranscriptZoom(z => Math.max(0.5, z - 0.25))}><ZoomOut className="h-3 w-3" /></Button>
                <span className="text-xs w-10 text-center font-mono">{Math.round(transcriptZoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setTranscriptZoom(z => Math.min(3, z + 0.25))}><ZoomIn className="h-3 w-3" /></Button>
              </div>
            </div>
            {linesReviewCount > 0 ? (
              <span className="text-xs flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200/50">
                <AlertTriangle className="h-3 w-3" />
                {linesReviewCount} line{linesReviewCount !== 1 ? 's' : ''} need review
              </span>
            ) : (
              <span className="text-xs flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded border border-green-200/50">
                <CheckCircle className="h-3 w-3" />
                All lines confident
              </span>
            )}
          </div>
          <div className="flex-1 p-6 overflow-auto bg-slate-50/30">
            {ocrLines.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <p className="text-slate-500 font-medium mb-2">No readable text detected.</p>
                <p className="text-slate-400 text-sm max-w-sm">If you uploaded an image or scanned document, structured extraction can still read the page image when an AI provider is configured. Click &quot;Approve &amp; Continue&quot; to proceed.</p>
              </div>
            ) : (
              <div 
                className="space-y-3 bg-white p-8 shadow-sm border border-slate-200/60 rounded-xl min-h-full font-mono text-sm leading-relaxed text-slate-700 transition-all origin-top-left"
                style={{ transform: `scale(${transcriptZoom})`, width: `${100 / transcriptZoom}%`, marginBottom: `${(transcriptZoom - 1) * 100}%` }}
              >
                {ocrLines.map((line, idx) => (
                  <div 
                    key={idx} 
                    ref={(el) => { lineRefs.current[idx] = el; }}
                    onMouseEnter={() => setHoveredLineIndex(idx)}
                    onMouseLeave={() => setHoveredLineIndex(null)}
                    className={`p-1.5 rounded-md border-l-[3px] pl-3 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-primary/5 ${
                      hoveredLineIndex === idx ? "bg-primary/5 ring-1 ring-primary/20" : ""
                    } ${
                      line.needsReview || line.confidence < 0.75 
                        ? "border-red-400 bg-red-50/50 hover:bg-red-50 text-red-900" 
                        : line.confidence < 0.90 
                          ? "border-amber-400 hover:bg-amber-50/30"
                          : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input 
                      type="text" 
                      className="w-full bg-transparent outline-none"
                      value={line.text}
                      onChange={(e) => handleLineChange(idx, e.target.value)}
                    />
                    {line.confidence < 0.90 && (
                      <div className="text-[10px] text-slate-400 text-right mt-1 font-sans flex justify-end">
                        <span className={line.confidence < 0.75 ? "text-red-500" : "text-amber-500"}>
                          Conf: {(line.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function OCRStudioPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center h-full text-muted-foreground">Loading...</div>}>
      <OCRStudioContent />
    </Suspense>
  );
}
