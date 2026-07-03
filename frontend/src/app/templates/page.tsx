"use client";

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Settings2, Trash2, Loader2, X, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate } from "@/lib/api";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("All");
  
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  
  const [name, setName] = useState("");
  const [schemaJsonStr, setSchemaJsonStr] = useState("{\n  \"type\": \"object\",\n  \"properties\": {\n    \"field_name\": { \"type\": \"string\" }\n  }\n}");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setName("");
    setSchemaJsonStr("{\n  \"type\": \"object\",\n  \"properties\": {\n    \"field_name\": { \"type\": \"string\" }\n  }\n}");
    setShowModal(true);
  };

  const handleCreateTranscription = () => {
    setEditingTemplate(null);
    setName("Layout-Preserving Transcription");
    setSchemaJsonStr(JSON.stringify({
      type: "object",
      properties: {
        full_transcription: {
          type: "string",
          description: "The exact full text of the document preserving all layout, spacing, and paragraphs"
        }
      }
    }, null, 2));
    setShowModal(true);
  };

  const handleEdit = (tpl: any) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setSchemaJsonStr(JSON.stringify(tpl.schema_json, null, 2));
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplate(id);
      await loadTemplates();
    } catch (e) {
      console.error(e);
      alert("Failed to delete template");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    
    let parsedSchema;
    try {
      parsedSchema = JSON.parse(schemaJsonStr);
    } catch (e) {
      alert("Invalid JSON schema format");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, { name, schema_json: parsedSchema });
      } else {
        await createTemplate(name, parsedSchema);
      }
      await loadTemplates();
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    return activeTab === "All" || t.industry === activeTab;
  });

  const tabs = ["All", "Engineering", "Accounting", "Legal", "General"];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Templates & Schemas</h1>
          <p className="text-slate-500 mt-1 font-medium">
            Manage extraction targets and validation rules.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleCreateTranscription}>
            <FileText className="mr-2 h-4 w-4" />
            Transcription Template
          </Button>
          <Button onClick={handleCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </div>

      <div className="flex gap-2 pb-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
             <div key={i} className="h-[150px] rounded-xl bg-slate-100 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((tpl) => (
            <div key={tpl.id} className="card-premium flex flex-col group relative overflow-hidden bg-white">
              <CardHeader className="pb-4 flex-1">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg font-bold tracking-tight text-slate-800">{tpl.name}</CardTitle>
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${
                    tpl.id <= 4 ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tpl.id <= 4 ? 'Built-in' : 'Custom'}
                  </span>
                </div>
                <CardDescription className="text-slate-500 font-medium">
                  {Object.keys(tpl.schema_json?.properties || {}).length} defined fields
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 border-t border-slate-100 flex gap-2 bg-slate-50/50">
                <Button variant="outline" className="flex-1 text-xs h-9 bg-white shadow-sm border-slate-200 hover:bg-slate-50 hover:text-primary transition-all" onClick={() => handleEdit(tpl)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configure
                </Button>
                {tpl.id > 4 && (
                  <Button variant="outline" className="text-xs h-9 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 transition-all" onClick={() => handleDelete(tpl.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingTemplate ? "Edit Template" : "Create New Template"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                <Input 
                  placeholder="e.g. Purchase Order" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">JSON Schema</label>
                <textarea 
                  className="w-full h-64 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                  value={schemaJsonStr}
                  onChange={e => setSchemaJsonStr(e.target.value)}
                  placeholder="{}"
                />
                <p className="text-xs text-slate-400 mt-2">Define the JSON schema for Gemini to extract against.</p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTemplate ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
