"use client";

import { useState } from "react";
import { UserCircle, Bell, Search, Settings, LogOut } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200/60 glass z-10 px-6 sticky top-0">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input 
            className="pl-9 bg-slate-50/50 border-none shadow-none focus-visible:ring-1 focus-visible:bg-white transition-colors h-9" 
            placeholder="Search documents..." 
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        {/* Notifications */}
        <div className="relative">
          <button 
            className="text-slate-400 hover:text-slate-600 transition-colors relative"
            onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }}
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-100 py-2 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <h3 className="font-semibold text-sm">Notifications</h3>
              </div>
              <div className="px-4 py-6 text-center text-slate-500 text-sm">
                You're all caught up!
              </div>
            </div>
          )}
        </div>
        
        <div className="h-6 w-px bg-slate-200 mx-2"></div>
        
        {/* Profile */}
        <div className="relative">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-white font-medium text-xs shadow-sm">
              JD
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">John Doe</span>
              <span className="text-[10px] text-slate-500 font-medium">Workspace Admin</span>
            </div>
          </div>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-50">
              <button onClick={() => alert("Coming soon!")} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <UserCircle className="w-4 h-4" />
                My Profile
              </button>
              <button onClick={() => alert("Coming soon!")} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button onClick={() => alert("Coming soon!")} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
