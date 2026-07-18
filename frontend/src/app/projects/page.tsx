"use client";

import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Folder, Download, UploadCloud, Loader2, X, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { uploadDocument, fetchProjects, createProject, exportProject, deleteProject, type Project } from "@/lib/api";
import { ExportModal } from "@/components/ui/export-modal";

export default function ProjectsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  
  useEffect(() => {
    const savedIndustry = localStorage.getItem('selectedIndustry');
    const requestedSearch = new URLSearchParams(window.location.search).get("search");
    const timer = window.setTimeout(() => {
      if (savedIndustry) setActiveTab(savedIndustry);
      if (requestedSearch) setSearchQuery(requestedSearch);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectIndustry, setNewProjectIndustry] = useState("General");
  const [creatingProject, setCreatingProject] = useState(false);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportProjectId, setExportProjectId] = useState<number | null>(null);
  const [exportProjectName, setExportProjectName] = useState("");

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleUploadClick = (projectId: number) => {
    setActiveProjectId(projectId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProjectId) return;

    try {
      setUploading(true);
      setUploadProgress(0);
      const data = await uploadDocument(file, activeProjectId, (percent) => {
        setUploadProgress(percent);
      });
      
      if (data.document_id) {
        router.push(`/studio/ocr?docId=${data.document_id}`);
      }
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload document");
    } finally {
      setUploading(false);
      setActiveProjectId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      await createProject(newProjectName, newProjectDesc, newProjectIndustry);
      await loadProjects();
      setShowCreateModal(false);
      setNewProjectName("");
      setNewProjectDesc("");
      setNewProjectIndustry("General");
    } catch (e) {
      console.error(e);
      alert("Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleExportClick = (projectId: number, projectName: string) => {
    setExportProjectId(projectId);
    setExportProjectName(projectName);
    setExportModalOpen(true);
  };

  const handleExportSubmit = async (format: string) => {
    if (!exportProjectId) return;
    try {
      const blob = await exportProject(exportProjectId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportProjectName.replace(/\s+/g, '_')}_export.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to export project");
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (confirm("Are you sure you want to delete this project and all its documents?")) {
      try {
        await deleteProject(projectId);
        await loadProjects();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to delete project");
      }
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "All" || p.industry === activeTab;
    return matchesSearch && matchesTab;
  });

  const tabs = ["All", "Engineering", "Accounting", "Legal", "General"];

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 relative">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Projects</h1>
          <p className="text-slate-500 mt-1 font-medium">
            Organize your document batches for extraction and export.
          </p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileChange}
            accept="application/pdf,image/*"
          />
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
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

      <div className="flex gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200/60">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input 
            className="pl-10 border-none shadow-none focus-visible:ring-0 text-base" 
            placeholder="Search your projects..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
             <div key={i} className="h-[200px] rounded-xl bg-slate-100 animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <div key={project.id} className="card-premium flex flex-col group relative overflow-hidden bg-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 group-hover:bg-primary/10 transition-colors" />
              <CardHeader className="pb-4 flex-1">
                <div className="flex justify-between items-start">
                  <div className="bg-primary/10 p-2.5 rounded-xl text-primary ring-1 ring-primary/20">
                    <Folder className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${project.status === 'Active' ? 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/20' : 'bg-slate-100 text-slate-600 ring-1 ring-slate-400/20'}`}>
                      {project.status}
                    </span>
                    <button 
                      onClick={(e) => { e.preventDefault(); handleDeleteProject(project.id); }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <CardTitle className="mt-5 text-xl font-bold tracking-tight text-slate-800 line-clamp-1" title={project.name}>{project.name}</CardTitle>
                <CardDescription className="text-slate-500 font-medium mt-1">{project.document_count} documents</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 border-t border-slate-100 flex justify-between gap-3 bg-slate-50/50">
                <Button 
                  variant="outline" 
                  className="flex-1 text-xs h-9 bg-white shadow-sm border-slate-200 hover:bg-slate-50 hover:text-primary transition-all relative overflow-hidden" 
                  onClick={() => handleUploadClick(project.id)}
                  disabled={uploading}
                >
                  {uploading && activeProjectId === project.id ? (
                    <>
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-primary/10 transition-all duration-200" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                      <Loader2 className="mr-2 h-4 w-4 animate-spin relative z-10" />
                      <span className="relative z-10">{uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-1 text-xs h-9 shadow-sm hover:opacity-90 transition-opacity"
                  onClick={() => handleExportClick(project.id, project.name)}
                  disabled={project.document_count === 0}
                >
                  <Download className="mr-2 h-4 w-4" /> Export
                </Button>
              </CardContent>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              No projects found.
            </div>
          )}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">Create New Project</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
                <Input 
                  placeholder="e.g. Supplier Invoices Q3" 
                  value={newProjectName} 
                  onChange={e => setNewProjectName(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
                <Input 
                  placeholder="Brief description of documents" 
                  value={newProjectDesc} 
                  onChange={e => setNewProjectDesc(e.target.value)} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Industry Category</label>
                <select 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                  value={newProjectIndustry}
                  onChange={e => setNewProjectIndustry(e.target.value)}
                >
                  <option value="General">General</option>
                  <option value="Engineering">Engineering</option>
                  <option value="Accounting">Accounting</option>
                  <option value="Legal">Legal</option>
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creatingProject}>Cancel</Button>
              <Button onClick={handleCreateProject} disabled={creatingProject || !newProjectName.trim()}>
                {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      <ExportModal 
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title={`Export ${exportProjectName}`}
        description="Download all approved records from this project."
        onExport={handleExportSubmit}
      />
    </div>
  );
}
