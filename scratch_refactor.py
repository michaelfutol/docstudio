import re

file_path = r"d:\projects\Document Intelligence Studio SaaS 06-24-26\frontend\src\app\templates\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

if "Trash," not in content:
    content = content.replace("Trash2, Loader2, X, FileText } from", "Trash2, Loader2, X, FileText, Trash, GripVertical, Settings } from")

state_code = """
  const [builderMode, setBuilderMode] = useState<"visual" | "json">("visual");
  const [fields, setFields] = useState<{id: string, name: string, type: string, description: string}[]>([]);
  const [templateIndustry, setTemplateIndustry] = useState("General");
"""
content = re.sub(r'const \[saving, setSaving\] = useState\(false\);', r'const [saving, setSaving] = useState(false);\n' + state_code, content)

create_new = """  const handleCreateNew = () => {
    setEditingTemplate(null);
    setName("");
    setBuilderMode("visual");
    setFields([{ id: Math.random().toString(), name: "field_name", type: "string", description: "" }]);
    setSchemaJsonStr("{\\n  \\"type\\": \\"object\\",\\n  \\"properties\\": {\\n    \\"field_name\\": { \\"type\\": \\"string\\" }\\n  }\\n}");
    setTemplateIndustry(activeTab === "All" ? "General" : activeTab);
    setShowModal(true);
  };"""
content = re.sub(r'const handleCreateNew = \(\) => \{.*?\};', create_new, content, flags=re.DOTALL)

edit = """  const handleEdit = (tpl: any) => {
    setEditingTemplate(tpl);
    setName(tpl.name);
    setTemplateIndustry(tpl.industry || "General");
    setSchemaJsonStr(JSON.stringify(tpl.schema_json, null, 2));
    
    // Try to parse into fields
    try {
      const props = tpl.schema_json.properties;
      if (props && !tpl.schema_json.properties.data) {
        const parsedFields = Object.keys(props).map(k => ({
          id: Math.random().toString(),
          name: k,
          type: props[k].type || "string",
          description: props[k].description || ""
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
  };"""
content = re.sub(r'const handleEdit = \(tpl: any\) => \{.*?\};', edit, content, flags=re.DOTALL)

save = """  const handleSave = async () => {
    if (!name.trim()) return;
    
    let parsedSchema;
    if (builderMode === "visual") {
      const properties: any = {};
      fields.forEach(f => {
        if (f.name.trim()) {
          properties[f.name.trim()] = { type: f.type };
          if (f.description) properties[f.name.trim()].description = f.description;
        }
      });
      parsedSchema = { type: "object", properties };
    } else {
      try {
        parsedSchema = JSON.parse(schemaJsonStr);
      } catch (e) {
        alert("Invalid JSON schema format");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await updateTemplate(editingTemplate.id, { name, schema_json: parsedSchema, industry: templateIndustry });
      } else {
        await createTemplate(name, parsedSchema, templateIndustry);
      }
      await loadTemplates();
      setShowModal(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save template");
    } finally {
      setSaving(false);
    }
  };"""
content = re.sub(r'const handleSave = async \(\) => \{.*?\};', save, content, flags=re.DOTALL)

modal_ui = """
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
                  </div>
                  <div className="space-y-2 border border-slate-200 rounded-xl bg-slate-50 p-2">
                    {fields.map((field, idx) => (
                      <div key={field.id} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                        <div className="w-1/3">
                          <Input placeholder="Field Name (e.g. vendor_name)" value={field.name} onChange={e => {
                            const newFields = [...fields];
                            newFields[idx].name = e.target.value;
                            setFields(newFields);
                          }} />
                        </div>
                        <div className="w-1/4">
                          <select 
                            className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-md outline-none text-sm"
                            value={field.type}
                            onChange={e => {
                              const newFields = [...fields];
                              newFields[idx].type = e.target.value;
                              setFields(newFields);
                            }}
                          >
                            <option value="string">Text (String)</option>
                            <option value="number">Number</option>
                            <option value="boolean">Yes/No (Boolean)</option>
                          </select>
                        </div>
                        <div className="flex-1 flex gap-2">
                          <Input placeholder="Description (Optional)" value={field.description} onChange={e => {
                            const newFields = [...fields];
                            newFields[idx].description = e.target.value;
                            setFields(newFields);
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
"""

content = re.sub(r'<div className="p-6 space-y-4">.*?</div>\s*<div className="p-4 bg-slate-50', modal_ui + '\n            <div className="p-4 bg-slate-50', content, flags=re.DOTALL)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
