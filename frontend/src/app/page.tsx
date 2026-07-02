"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Plus, Database, AlertCircle, CheckCircle, Activity, Zap } from "lucide-react";
import Link from "next/link";
import { fetchProjects, fetchStats } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
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
    }
    loadStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your document processing tasks.
          </p>
        </div>
        <Link href="/projects">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>
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
                  <div key={i} className="flex items-center gap-3 py-2">
                    <div className="bg-slate-100 p-2 rounded-full text-slate-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.filename}</p>
                      <p className="text-xs text-slate-500 capitalize">{doc.status.replace('_', ' ')}</p>
                    </div>
                    <Link href={doc.status === 'uploaded' || doc.status === 'processing' || doc.status === 'processed' ? `/studio/ocr?docId=${doc.id}` : `/studio/builder?docId=${doc.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs text-primary">View</Button>
                    </Link>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 py-4 text-center">No documents uploaded yet.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
