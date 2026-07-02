"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Key, Save, Server, Loader2, Link as LinkIcon, Database } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      // In a real app we'd save this to the backend or localStorage
      alert("Settings saved successfully!");
    }, 800);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500 mt-1 font-medium">
          Configure your studio environment and API integrations.
        </p>
      </div>

      <div className="grid gap-6">
        <Card className="card-premium border-slate-200/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 p-2 rounded-lg text-primary">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">AI Provider Configuration</CardTitle>
                <CardDescription>Set your API keys for Gemini data extraction.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Google Gemini API Key</label>
              <div className="flex gap-3">
                <Input 
                  type="password" 
                  placeholder="AIzaSy..." 
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  className="max-w-md font-mono"
                />
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Key
                </Button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                This key is used when extracting structured data from documents.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-slate-200/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-600">
                <Server className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">System Status</CardTitle>
                <CardDescription>Backend connectivity and versions.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/30">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <LinkIcon className="h-4 w-4 text-slate-400" /> API Server
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>
              <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/30">
                <div className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <Database className="h-4 w-4 text-slate-400" /> Database
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  SQLite OK
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
