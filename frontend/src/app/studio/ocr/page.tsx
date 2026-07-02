"use client";

import { useState, useEffect, useRef, use } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Save, CheckCircle, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { fetchDocument } from "@/lib/api";
import { DocumentViewer } from "@/components/studio/document-viewer";
import { PipelineStepper } from "@/components/ui/pipeline-stepper";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function OCRStudioContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId") || "";
  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [ocrLines, setOcrLines] = useState<any[]>([]);
  
  // Refs for auto-scrolling
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const doc = await fetchDocument(docId);
        setDocument(doc);
        if (doc && doc.pages && doc.pages.length > 0) {
          const page = doc.pages.find((p: any) => p.page_number === currentPage) || doc.pages[0];
          setOcrLines(page.ocr_json?.pages?.[0]?.lines || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    const interval = setInterval(() => {
      if (document && document.status !== "processing" && document.status !== "uploaded") {
        clearInterval(interval);
      } else {
        loadData();
      }
    }, 2000);

    loadData();

    return () => clearInterval(interval);
  }, [docId, document?.status, currentPage]);

  const handleSave = async () => {
    if (!document) return;
    setSaving(true);
    try {
      const page = document.pages.find((p: any) => p.page_number === currentPage) || document.pages[0];
      const updatedOcrJson = { ...page.ocr_json };
      if (updatedOcrJson.pages && updatedOcrJson.pages.length > 0) {
        updatedOcrJson.pages[0].lines = ocrLines;
      }
      
      await fetch(`http://localhost:8000/api/v1/documents/${document.id}/pages/${currentPage}/text`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ocr_json: updatedOcrJson })
      });
      
      // Show toast ideally, but for now just wait
      setTimeout(() => setSaving(false), 500);
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        window.location.href = `/studio/builder?docId=${document?.id}`;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ocrLines, document, currentPage]);

  if (loading && !document) {
    return <div className="p-8 flex items-center justify-center h-full text-muted-foreground">Loading Document Studio...</div>;
  }
  
  if (document && (document.status === "processing" || document.status === "uploaded")) {
    return <div className="p-8 flex items-center justify-center h-full text-muted-foreground">OCR Processing in background... Please wait.</div>;
  }

  const page = document?.pages?.find((p: any) => p.page_number === currentPage) || document?.pages?.[0];
  const totalPages = document?.pages?.length || 1;
  const linesReviewCount = ocrLines.filter((l: any) => l.needsReview || l.confidence < 0.8).length;

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
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)}>
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span>Page {currentPage} of {totalPages}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)}>
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
          <Link href={`/studio/builder?docId=${document.id}`}>
            <Button>Approve & Continue <ArrowRight className="h-4 w-4 ml-2" /></Button>
          </Link>
        </div>
      </div>

      {/* Side by Side Workspace */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        
        {/* Left: Source Image */}
        <div className="card-premium flex flex-col overflow-hidden bg-slate-50/50">
          <div className="p-3 border-b border-slate-100 bg-white/50 text-sm font-semibold tracking-tight text-slate-700">Source Document</div>
          {page?.image_path ? (
            <DocumentViewer
              imagePath={page.image_path}
              lines={ocrLines}
              imageWidth={page.width}
              imageHeight={page.height}
              hoveredLineIndex={hoveredLineIndex}
              onLineClick={handleLineClick}
              onLineHover={setHoveredLineIndex}
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
            <span>OCR Transcript</span>
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
            <div className="space-y-3 bg-white p-8 shadow-sm border border-slate-200/60 rounded-xl min-h-full font-mono text-sm leading-relaxed text-slate-700">
              {ocrLines.map((line: any, idx: number) => (
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
