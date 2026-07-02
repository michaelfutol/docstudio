import { UserCircle, Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function Header() {
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
        <button className="text-slate-400 hover:text-slate-600 transition-colors relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
        </button>
        <div className="h-6 w-px bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-white font-medium text-xs shadow-sm">
            JD
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">John Doe</span>
            <span className="text-[10px] text-slate-500 font-medium">Workspace Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
