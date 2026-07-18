"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell, Search, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `/projects?search=${encodeURIComponent(value)}` : "/projects");
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/60 glass z-10 px-6 sticky top-0">
      <form className="flex items-center gap-4 flex-1" onSubmit={handleSearch}>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9 bg-slate-50/50 border-none shadow-none focus-visible:ring-1 focus-visible:bg-white transition-colors h-9"
            placeholder="Search projects..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </form>
      <div className="flex items-center gap-4">
        <div className="relative">
          <button
            type="button"
            aria-label="Notifications"
            className="text-slate-400 hover:text-slate-600 transition-colors"
            onClick={() => {
              setShowNotifications((current) => !current);
              setShowProfile(false);
            }}
          >
            <Bell className="h-5 w-5" />
          </button>
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <h3 className="font-semibold text-sm">Notifications</h3>
              </div>
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                You&apos;re all caught up.
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-2" />

        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
            onClick={() => {
              setShowProfile((current) => !current);
              setShowNotifications(false);
            }}
          >
            <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-white font-medium text-xs shadow-sm">
              FT
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">FutolTech</span>
              <span className="text-[10px] text-slate-500 font-medium">Document Studio</span>
            </span>
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
              <Link href="/settings" className="w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                System Settings
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
