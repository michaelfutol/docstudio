"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, XCircle, Eye, AlertCircle, Database, Loader2 } from "lucide-react";
import { fetchPendingRecords, updateRecordStatus } from "@/lib/api";

export default function ReviewQueuePage() {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  
  // Keyboard navigation state
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    loadRecords();
  }, []);

  async function loadRecords() {
    try {
      const data = await fetchPendingRecords();
      setRecords(data);
    } catch (err) {
      console.error("Failed to load records:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleAction = useCallback(async (recordId: number, status: string) => {
    setActionLoading(recordId);
    try {
      await updateRecordStatus(recordId, status);
      // Remove from the list after action
      setRecords(prev => {
        const filtered = prev.filter(r => r.id !== recordId);
        // Adjust selected index if needed
        setSelectedIndex(current => Math.min(current, Math.max(0, filtered.length - 1)));
        return filtered;
      });
    } catch (err) {
      console.error("Failed to update record:", err);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const filteredRecords = records.filter(r =>
    r.filename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(r.record_data).toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (filteredRecords.length === 0) return;
      
      const record = filteredRecords[selectedIndex];
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(filteredRecords.length - 1, prev + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setExpandedId(prev => prev === record.id ? null : record.id);
      } else if (e.key === 'a' || e.key === 'A') {
        // Approve
        if (e.target instanceof HTMLInputElement) return; // Don't trigger if typing in search
        e.preventDefault();
        handleAction(record.id, "approved");
      } else if (e.key === 'r' || e.key === 'R') {
        // Reject
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        handleAction(record.id, "rejected");
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredRecords, selectedIndex, handleAction]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="font-medium">Loading Review Queue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 flex flex-col h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-800">Review Queue</h1>
          <p className="text-slate-500 mt-1">
            {records.length} record{records.length !== 1 ? 's' : ''} awaiting human review before export.
            <span className="ml-2 text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">
              Keyboard: ↑↓ to navigate, Enter to expand, A to approve, R to reject
            </span>
          </p>
        </div>
        {records.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={async () => {
                const highConf = records.filter(r => r.confidence >= 0.90);
                for (const r of highConf) {
                  await handleAction(r.id, "approved");
                }
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Bulk Approve High Confidence ({records.filter(r => r.confidence >= 0.90).length})
            </Button>
          </div>
        )}
      </div>

      <div className="card-premium flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex gap-4 bg-white/50">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-10 bg-slate-50 border-slate-200 focus:ring-2 focus:ring-primary/20"
              placeholder="Search records, filenames, extracted data..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setSelectedIndex(0); // reset selection on search
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredRecords.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 py-20">
              <Database className="h-10 w-10 text-slate-300" />
              <p className="font-medium text-slate-500">
                {records.length === 0
                  ? "No records pending review. Upload and extract documents first!"
                  : "No records match your search."
                }
              </p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 sticky top-0 backdrop-blur-sm">
                <tr>
                  <th className="px-6 py-3.5 font-semibold">Record</th>
                  <th className="px-6 py-3.5 font-semibold">Source Document</th>
                  <th className="px-6 py-3.5 font-semibold">Confidence</th>
                  <th className="px-6 py-3.5 font-semibold">Preview</th>
                  <th className="px-6 py-3.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row, idx) => {
                  const isSelected = selectedIndex === idx;
                  const overallConf = row.confidence;
                  
                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`border-b border-slate-50 transition-colors cursor-pointer ${
                          isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-white hover:bg-slate-50'
                        }`}
                        onClick={() => {
                          setSelectedIndex(idx);
                          setExpandedId(expandedId === row.id ? null : row.id);
                        }}
                      >
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                            REC-{String(row.id).padStart(3, '0')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-700">{row.filename}</div>
                          <div className="text-xs text-slate-400">Doc #{row.document_id}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${
                            overallConf >= 0.95 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            overallConf >= 0.80 ? 'bg-amber-100 text-amber-700 border-amber-200' : 
                            'bg-red-100 text-red-700 border-red-200'
                          }`}>
                            {(overallConf * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            {row.needs_review && <AlertCircle className="h-4 w-4 text-amber-500" />}
                            <span className="text-xs truncate max-w-[200px]">
                              {typeof row.record_data === 'object'
                                ? Object.keys(row.record_data).filter(k => k !== 'field_confidences').slice(0, 3).join(', ') + '...'
                                : 'View data'
                              }
                            </span>
                            <Eye className="h-3.5 w-3.5 text-slate-300 ml-1" />
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 w-8"
                              title="Approve (A)"
                              disabled={actionLoading === row.id}
                              onClick={() => handleAction(row.id, "approved")}
                            >
                              {actionLoading === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                              title="Reject (R)"
                              disabled={actionLoading === row.id}
                              onClick={() => handleAction(row.id, "rejected")}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr key={`${row.id}-detail`} className="bg-slate-50/50 shadow-inner">
                          <td colSpan={5} className="px-6 py-4">
                            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                              <h4 className="text-sm font-semibold text-slate-700 mb-3">Extracted Fields</h4>
                              <div className="overflow-hidden border border-slate-100 rounded-lg">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-50 text-slate-500">
                                    <tr>
                                      <th className="px-3 py-2 font-medium w-1/3">Field</th>
                                      <th className="px-3 py-2 font-medium">Value</th>
                                      <th className="px-3 py-2 font-medium w-16 text-center">Conf</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {Object.entries(row.record_data).map(([key, value]) => {
                                      if (key === 'field_confidences') return null;
                                      const conf = row.record_data.field_confidences?.[key];
                                      const isLow = conf < 0.95;
                                      return (
                                        <tr key={key} className={isLow ? "bg-amber-50/30" : ""}>
                                          <td className="px-3 py-2 font-mono text-slate-600">{key}</td>
                                          <td className="px-3 py-2">
                                            {typeof value === 'object' ? (
                                              <pre className="text-[10px] text-slate-500">{JSON.stringify(value, null, 2)}</pre>
                                            ) : (
                                              <span className="text-slate-800 font-medium">{String(value)}</span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-center">
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
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
