"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Settings, Database, FolderKanban, Sparkles } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    { href: "/review", label: "Review Queue", icon: FileText },
    { href: "/templates", label: "Templates", icon: Database },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-slate-900 text-slate-300 border-r border-slate-800">
      <div className="flex h-16 items-center gap-2 border-b border-slate-800 px-6 font-bold text-white">
        <div className="bg-primary/20 p-1.5 rounded-md text-primary">
          <LayoutDashboard className="h-5 w-5" />
        </div>
        <span>DocStudio AI</span>
      </div>
      
      <div className="flex-1 overflow-auto py-6">
        <nav className="grid gap-1 px-3">
          {links.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href));
            const Icon = link.icon;
            
            return (
              <Link 
                key={link.href}
                href={link.href} 
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative overflow-hidden
                  ${isActive 
                    ? "text-white bg-primary/15" 
                    : "hover:text-white hover:bg-white/5"}`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-r-full shadow-[0_0_10px_var(--primary)]" />
                )}
                <Icon className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : "text-slate-500 group-hover:text-slate-300"}`} />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <Link href="/settings" className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 text-sm font-medium transition-colors hover:text-white">
          <Settings className="h-4 w-4 text-slate-500" />
          Settings
        </Link>
      </div>
    </div>
  );
}
