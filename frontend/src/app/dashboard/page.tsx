"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Database, AlertCircle, CheckCircle, Activity, Zap, Trash2, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { fetchProjects, fetchStats, deleteDocument, createProject } from "@/lib/api";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newProjectIndustry, setNewProjectIndustry] = useState("General");
  const [creatingProject, setCreatingProject] = useState(false);

  const loadStats = async () => {
    try {
      const data = await fetchStats();
      setStats(data);
      
      const projData = await fetchProjects();
      setProjects(projData.slice(0, 5)); // Last 5 projects
      
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      await createProject(newProjectName, newProjectDesc, newProjectIndustry);
      await loadStats();
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

  const handleDeleteDocument = async (id: number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDocument(id);
        // Refresh data
        loadStats();
      } catch (e) {
        alert("Failed to delete document");
        console.error(e);
      }
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your document processing tasks.
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {/* Total Documents */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold">{stats?.total_documents || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Across all projects</p>
          </CardContent>
        </Card>

        {/* Needs Review */}
        <Card className="shadow-sm border-amber-100 bg-amber-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-amber-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold text-amber-600">{stats?.pending_review_count || 0}</div>
            )}
            <p className="text-xs text-amber-600/70 mt-1">Pending manual validation</p>
          </CardContent>
        </Card>

        {/* STP Rate */}
        <Card className="shadow-sm border-emerald-100 bg-emerald-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">STP Rate</CardTitle>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-emerald-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold text-emerald-600">
                {((stats?.stp_rate || 0) * 100).toFixed(1)}%
              </div>
            )}
            <p className="text-xs text-emerald-600/70 mt-1">Straight-through processing</p>
          </CardContent>
        </Card>

        {/* Active Templates */}
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Templates</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-8 w-16 bg-slate-200 animate-pulse rounded"></div>
            ) : (
              <div className="text-2xl font-bold">{stats?.total_templates || 0}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Configured schemas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>Your latest document processing projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2">
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-slate-200 animate-pulse rounded"></div>
                      <div className="h-3 w-20 bg-slate-100 animate-pulse rounded"></div>
                    </div>
                    <div className="h-6 w-16 bg-slate-100 animate-pulse rounded-full"></div>
                  </div>
                ))
              ) : projects.length > 0 ? (
                projects.map((project, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none text-slate-800">{project.name}</p>
                      <p className="text-xs text-slate-500">{project.document_count} documents</p>
                    </div>
                    <div className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                      {project.status}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 py-4 text-center">No projects created yet.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest documents added to the pipeline.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="flex gap-3 py-2">
                    <div className="h-8 w-8 bg-slate-200 animate-pulse rounded-full shrink-0"></div>
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-full bg-slate-200 animate-pulse rounded"></div>
                      <div className="h-3 w-24 bg-slate-100 animate-pulse rounded"></div>
                    </div>
                  </div>
                ))
              ) : stats?.recent_documents?.length > 0 ? (
                stats.recent_documents.map((doc: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 py-2 group">
                    <div className="bg-slate-100 p-2 rounded-full text-slate-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
                      <p className="text-xs text-slate-500 capitalize">{doc.status.replace('_', ' ')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link href={doc.status === 'uploaded' || doc.status === 'processing' || doc.status === 'processed' ? `/studio/ocr?docId=${doc.id}` : `/studio/builder?docId=${doc.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs text-primary">View</Button>
                      </Link>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteDocument(doc.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 py-4 text-center">No documents uploaded yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
