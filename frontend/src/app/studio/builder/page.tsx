"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Database, Check, AlertCircle, ArrowRight, Play, Download, FileText, ZoomIn, ZoomOut } from "lucide-react";
import Link from "next/link";
import { fetchTemplates, triggerExtraction, fetchDocument, fetchRecord, API_BASE_URL } from "@/lib/api";
import { DocumentViewer } from "@/components/studio/document-viewer";
import { PipelineStepper } from "@/components/ui/pipeline-stepper";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function BuilderContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get("docId") || "";
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [doc, setDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [sourceZoom, setSourceZoom] = useState(1);

  useEffect(() => {
    async function init() {
      try {
        const [tpls, document] = await Promise.all([
          fetchTemplates(),
          fetchDocument(docId)
        ]);
        setTemplates(tpls);
        setDoc(document);
        if (tpls.length > 0 && tpls[0].id != null) {
          setSelectedTemplateId(tpls[0].id.toString());
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [docId]);

  const handleExtract = async () => {
    if (!selectedTemplateId) return;
    setExtracting(true);
    setExtractedData(null);
    try {
      const res = await triggerExtraction(docId, parseInt(selectedTemplateId));
      
      // Fetch the actual record
      const record = await fetchRecord(res.record_id);
      setExtractedData(record);
      
    } catch (e) {
      console.error(e);
      alert("Extraction failed. Did you add GEMINI_API_KEY?");
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center h-full">Loading Builder...</div>;
  }

  const page = doc?.pages?.find((p: any) => p.page_number === currentPage) || doc?.pages?.[0];
  const ocrLines = page?.ocr_json?.pages?.[0]?.lines || [];

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200/60">
        <div className="flex items-center gap-4">
          <Link href={`/studio/ocr?docId=${docId}`}>
            <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Extraction Builder</h1>
            <p className="text-sm text-muted-foreground">{doc?.filename}</p>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <PipelineStepper currentStage={extractedData ? "pending_review" : (extracting ? "extracting" : "processed")} />
        </div>
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="outline"
            className="border-primary/20 text-primary"
            onClick={() => window.open(`${API_BASE_URL.replace('/api/v1', '')}/api/v1/documents/${docId}/export/searchable-pdf`, '_blank')}
          >
            <Download className="mr-2 h-4 w-4" /> Searchable PDF
          </Button>
          <Button 
            variant="outline"
            className="border-primary/20 text-primary"
            onClick={() => window.open(`${API_BASE_URL.replace('/api/v1', '')}/api/v1/documents/${docId}/export/text`, '_blank')}
          >
            <FileText className="mr-2 h-4 w-4" /> Raw Text
          </Button>
          
          {extractedData && (
            <Link href="/review">
              <Button>Send to Review Queue <ArrowRight className="h-4 w-4 ml-2" /></Button>
            </Link>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
        
        {/* Left: Document Viewer */}
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
              onLineClick={(idx) => setHoveredLineIndex(idx)}
              onLineHover={setHoveredLineIndex}
              scale={sourceZoom}
              setScale={setSourceZoom}
            />
          ) : (
            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-200/50">
              <p className="text-slate-400">No image available</p>
            </div>
          )}
        </div>

        {/* Right: Template & Extraction Results */}
        <div className="flex flex-col gap-4 overflow-hidden min-h-0">
          {/* Top Half: Schema Config */}
          <div className="card-premium p-5 flex flex-col gap-4 shrink-0 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-slate-800">Extraction Schema</h3>
                <p className="text-sm text-slate-500">Select template to map document to JSON.</p>
              </div>
              <Button onClick={handleExtract} disabled={extracting || !selectedTemplateId} size="sm" className="shadow-sm">
                <Play className="mr-2 h-4 w-4" />
                {extracting ? "Running..." : "Extract Data"}
              </Button>
            </div>
            
            <div>
              <select 
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                value={selectedTemplateId}
                onChange={e => setSelectedTemplateId(e.target.value)}
              >
                <option value="" disabled>Select a template...</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Bottom Half: Extracted Results */}
          <div className="card-premium flex-1 flex flex-col overflow-hidden bg-white">
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 text-sm font-semibold tracking-tight text-slate-700 flex justify-between items-center">
              <span>Extraction Result</span>
              {extractedData && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
                    Overall Conf: {(extractedData.confidence * 100).toFixed(1)}%
                  </span>
                  {extractedData.needs_review ? (
                     <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200/50 px-2 py-1 rounded flex items-center gap-1">
                       <AlertCircle className="h-3 w-3" /> Needs Review
                     </span>
                  ) : (
                     <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200/50 px-2 py-1 rounded flex items-center gap-1">
                       <Check className="h-3 w-3" /> Confident
                     </span>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex-1 p-0 overflow-auto bg-slate-50/30">
              {!extractedData && !extracting && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <Database className="h-10 w-10 text-slate-300" />
                  <p className="font-medium text-slate-500 text-sm">Results will appear here.</p>
                </div>
              )}
              
              {extracting && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-5">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="font-medium text-sm animate-pulse">AI is extracting data...</p>
                </div>
              )}

              {extractedData && !extracting && (
                <div className="p-4">
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="px-4 py-2 font-medium w-1/3">Field</th>
                          <th className="px-4 py-2 font-medium">Value</th>
                          <th className="px-4 py-2 font-medium w-16 text-center">Conf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {Object.entries(extractedData.record_data).map(([key, value]) => {
                          if (key === 'field_confidences') return null;
                          const conf = extractedData.record_data.field_confidences?.[key];
                          const isLow = conf < 0.95;
                          return (
                            <tr key={key} className={isLow ? "bg-amber-50/30" : ""}>
                              <td className="px-4 py-3 font-mono text-slate-600">{key}</td>
                              <td className="px-4 py-3">
                                {typeof value === 'object' ? (
                                  <pre className="text-[10px] text-slate-500">{JSON.stringify(value, null, 2)}</pre>
                                ) : (
                                  <span className="text-slate-800 font-medium">{String(value)}</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {conf !== undefined ? (
                                  <span className={`inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-bold ${
                                    conf >= 0.95 ? 'bg-emerald-100 text-emerald-700' :
                                    conf >= 0.80 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {(conf * 100).toFixed(0)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function StructuredDataBuilderPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center h-full">Loading...</div>}>
      <BuilderContent />
    </Suspense>
  );
}
