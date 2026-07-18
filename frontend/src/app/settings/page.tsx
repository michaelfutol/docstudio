"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Key, Server, Loader2, RefreshCw, Database, HardDrive } from "lucide-react";
import { fetchSettingsStatus, type SettingsStatus } from "@/lib/api";

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
      ok
        ? "text-emerald-600 bg-emerald-50 border-emerald-100"
        : "text-amber-700 bg-amber-50 border-amber-100"
    }`}>
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await fetchSettingsStatus());
    } catch (caught) {
      setStatus(null);
      setError(caught instanceof Error ? caught.message : "Unable to connect to the backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchSettingsStatus()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to connect to the backend");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">System Settings</h1>
          <p className="text-slate-500 mt-1 font-medium">Live backend, storage, and AI-provider readiness.</p>
        </div>
        <Button variant="outline" onClick={loadStatus} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Backend check failed: {error}
        </div>
      )}

      <Card className="card-premium border-slate-200/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-lg text-primary"><Key className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-lg">AI Provider Configuration</CardTitle>
              <CardDescription>Keys remain server-side and are never exposed in the browser.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
            <span className="text-sm font-medium text-slate-700">Google Gemini</span>
            <StatusBadge ok={Boolean(status?.gemini_configured)} label={status?.gemini_configured ? "Configured" : "Not configured"} />
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
            <span className="text-sm font-medium text-slate-700">OpenRouter</span>
            <StatusBadge ok={Boolean(status?.openrouter_configured)} label={status?.openrouter_configured ? "Configured" : "Not configured"} />
          </div>
          <p className="text-xs text-slate-500">
            Configure <code>GEMINI_API_KEY</code> or <code>OPENROUTER_API_KEY</code> in the backend environment, then restart the API service.
          </p>
        </CardContent>
      </Card>

      <Card className="card-premium border-slate-200/60 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-600"><Server className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-lg">System Status</CardTitle>
              <CardDescription>These values come from a live API health check.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/30">
            <span className="flex items-center gap-2 text-sm font-medium"><Server className="h-4 w-4 text-slate-400" /> API</span>
            <StatusBadge ok={status?.api_status === "connected"} label={status?.api_status === "connected" ? "Connected" : "Offline"} />
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/30">
            <span className="flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4 text-slate-400" /> Database</span>
            <StatusBadge ok={Boolean(status?.database_driver)} label={status?.database_driver || "Unknown"} />
          </div>
          <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/30">
            <span className="flex items-center gap-2 text-sm font-medium"><HardDrive className="h-4 w-4 text-slate-400" /> Uploads</span>
            <StatusBadge ok={Boolean(status?.uploads_writable)} label={status?.uploads_writable ? "Writable" : "Blocked"} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
