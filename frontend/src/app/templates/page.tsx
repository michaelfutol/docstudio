"use client";

import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Settings2, Trash2, Loader2, X, FileText, Trash } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchTemplates, createTemplate, updateTemplate, deleteTemplate, type JsonObject, type JsonValue, type Template } from "@/lib/api";

interface TemplateField {
  id: string;
  name: string;
  type: string;
  description: string;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function templateFieldCount(template: Template): number {
  const properties = template.schema_json.properties;
  if (!isJsonObject(properties)) return 0;
  const dataSchema = properties.data;
  if (isJsonObject(dataSchema) && isJsonObject(dataSchema.items) && isJsonObject(dataSchema.items.properties)) {
    return Object.keys(dataSchema.items.properties).length;
  }
  return Object.keys(properties).length;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("All");

  useEffect(() => {
    const savedIndustry = localStorage.getItem('selectedIndustry');
    const timer = window.setTimeout(() => {
      if (savedIndustry) setActiveTab(savedIndustry);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  
  const [name, setName] = useState("");
  const [schemaJsonStr, setSchemaJsonStr] = useState("{\n  \"type\": \"object\",\n  \"properties\": {\n    \"field_name\": { \"type\": \"string\" }\n  }\n}");
  const [saving, setSaving] = useState(false);

  const [builderMode, setBuilderMode] = useState<"visual" | "json">("visual");
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [isTable, setIsTable] = useState(false);
  const [templateIndustry, setTemplateIndustry] = useState("General");


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
    setBuilderMode("visual");
    setFields([{ id: Math.random().toString(), name: "field_name", type: "string", description: "" }]);
    setIsTable(false);
    setSchemaJsonStr(`{
  "type": "object",
  "properties": {
    "field_name": { "type": "string" }
  }
}`);
    setTemplateIndustry(activeTab === "All" ? "General" : activeTab);
    setShowModal(true);
  };

  const handleCreateTranscription = () => {
    setEditingTemplate(null);
    setName("Layout-Preserving Transcription");
    setBuilderMode("json");
    setFields([]);
    setIsTable(false);
    setTemplateIndustry(activeTab === "All" ? "General" : activeTab);
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

  const handleEdit = (tpl: Template) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setTemplateIndustry(tpl.industry || "General");
    setSchemaJsonStr(JSON.stringify(tpl.schema_json, null, 2));
    
    // Try to parse into fields
    try {
      const isArray = tpl.schema_json.type === "array";
      const rootProperties = isJsonObject(tpl.schema_json.properties) ? tpl.schema_json.properties : undefined;
      const dataSchema = rootProperties && isJsonObject(rootProperties.data) ? rootProperties.data : undefined;
      const tableItems = dataSchema && isJsonObject(dataSchema.items) ? dataSchema.items : undefined;
      const arrayItems = isJsonObject(tpl.schema_json.items) ? tpl.schema_json.items : undefined;
      const propertiesValue = isArray ? arrayItems?.properties : (tableItems?.properties || rootProperties);
      const props = isJsonObject(propertiesValue) ? propertiesValue : undefined;
      const tableMode = isArray || dataSchema?.type === "array";
      setIsTable(tableMode);

      if (props) {
        const parsedFields = Object.keys(props).map(k => ({
          id: Math.random().toString(),
          name: k,
          type: isJsonObject(props[k]) && typeof props[k].type === "string" ? props[k].type : "string",
          description: isJsonObject(props[k]) && typeof props[k].description === "string" ? props[k].description : ""
        }));
        setFields(parsedFields);
        setBuilderMode("visual");
      } else {
        setBuilderMode("json");
      }
    } catch {
      setBuilderMode("json");
    }
    
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
    
    let parsedSchema: JsonObject;
    if (builderMode === "visual") {
      const properties: JsonObject = {};
      fields.forEach(f => {
        if (f.name.trim()) {
          const definition: JsonObject = { type: f.type };
          if (f.description) definition.description = f.description;
          properties[f.name.trim()] = definition;
        }
      });
      parsedSchema = isTable
        ? { type: "object", properties: { data: { type: "array", items: { type: "object", properties } } } }
        : { type: "object", properties };
    } else {
      try {
        parsedSchema = JSON.parse(schemaJsonStr);
      } catch {
        alert("Invalid JSON schema format");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, {
          name,
          schema_json: parsedSchema,
          industry: templateIndustry,
          validation_rules: { is_tabular: isTable },
        });
      } else {
        await createTemplate(name, parsedSchema, templateIndustry, { is_tabular: isTable });
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
                    tpl.is_builtin ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tpl.is_builtin ? 'Built-in' : 'Custom'}
                  </span>
                </div>
                <CardDescription className="text-slate-500 font-medium">
                  {templateFieldCount(tpl)} defined fields
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 border-t border-slate-100 flex gap-2 bg-slate-50/50">
                <Button variant="outline" className="flex-1 text-xs h-9 bg-white shadow-sm border-slate-200 hover:bg-slate-50 hover:text-primary transition-all" onClick={() => handleEdit(tpl)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configure
                </Button>
                {!tpl.is_builtin && (
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
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                  <Input 
                    placeholder="e.g. Purchase Order" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                  />
                </div>
                <div className="w-1/3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                  <select 
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                    value={templateIndustry}
                    onChange={e => setTemplateIndustry(e.target.value)}
                  >
                    <option value="General">General</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Accounting">Accounting</option>
                    <option value="Legal">Legal</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-100 p-1 rounded-lg w-max mb-4">
                <button 
                  onClick={() => setBuilderMode("visual")} 
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${builderMode === 'visual' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Visual Builder
                </button>
                <button 
                  onClick={() => setBuilderMode("json")} 
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${builderMode === 'json' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  JSON Code
                </button>
              </div>

              {builderMode === 'visual' ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-end mb-2">
                    <p className="text-sm text-slate-500">Define the fields you want the AI to extract.</p>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm hover:bg-slate-50">
                      <input type="checkbox" checked={isTable} onChange={e => setIsTable(e.target.checked)} className="rounded text-primary focus:ring-primary h-4 w-4 cursor-pointer" />
                      Extract as Table (Multiple Rows)
                    </label>
                  </div>
                  <div className="space-y-2 border border-slate-200 rounded-xl bg-slate-50 p-2">
                    {fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="w-1/3">
                          <Input placeholder="Field Name (e.g. vendor_name)" value={field.name} onChange={e => {
                            setFields((current) => current.map((item, itemIndex) => itemIndex === idx ? { ...item, name: e.target.value } : item));
                          }} />
                        </div>
                        <div className="w-1/4">
                          <select 
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm"
                            value={field.type}
                            onChange={e => {
                              setFields((current) => current.map((item, itemIndex) => itemIndex === idx ? { ...item, type: e.target.value } : item));
                            }}
                          >
                            <option value="string">Text (String)</option>
                            <option value="number">Number</option>
                            <option value="boolean">Yes/No (Boolean)</option>
                          </select>
                        </div>
                        <div className="flex-1 flex gap-2">
                          <Input placeholder="Description (Optional)" value={field.description} onChange={e => {
                            setFields((current) => current.map((item, itemIndex) => itemIndex === idx ? { ...item, description: e.target.value } : item));
                          }} />
                          <Button variant="ghost" size="icon" className="text-red-400 hover:bg-red-50 hover:text-red-500 shrink-0" onClick={() => {
                            setFields(fields.filter((_, i) => i !== idx));
                          }}>
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="p-2">
                      <Button variant="secondary" size="sm" onClick={() => setFields([...fields, { id: Math.random().toString(), name: "", type: "string", description: "" }])}>
                        <Plus className="mr-2 h-4 w-4" /> Add Field
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <textarea 
                    className="w-full h-64 p-3 font-mono text-sm bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
                    value={schemaJsonStr}
                    onChange={e => setSchemaJsonStr(e.target.value)}
                    placeholder="{}"
                  />
                  <p className="text-xs text-slate-400 mt-2">Define the JSON schema for Gemini to extract against.</p>
                </div>
              )}
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
