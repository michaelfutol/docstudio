"use client";

import { useRouter } from "next/navigation";
import { HardHat, Calculator, Scale, FileText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function IndustryLandingPage() {
  const router = useRouter();

  // If already selected, maybe we want to redirect them? 
  // Let's not auto-redirect so they can change their mind, or maybe we do?
  // Let's keep it simple: forcing them to select on root page is fine, or we can check if it exists.
  
  // Uncomment to auto-redirect if already selected (Optional)
  // useEffect(() => {
  //   const saved = localStorage.getItem('selectedIndustry');
  //   if (saved) router.push('/dashboard');
  // }, []);

  const handleSelect = (industry: string, destination = "/dashboard") => {
    localStorage.setItem('selectedIndustry', industry);
    router.push(destination);
  };

  const industries = [
    {
      id: "Engineering",
      title: "Engineering & Construction",
      desc: "Automatically extract quantities, door schedules, and title blocks from architectural plans.",
      icon: HardHat,
      color: "bg-blue-50 text-blue-600 ring-blue-500/20",
      border: "hover:border-blue-500",
    },
    {
      id: "Accounting",
      title: "Accounting & Finance",
      desc: "Extract vendor line items and totals from messy receipts and invoices instantly.",
      icon: Calculator,
      color: "bg-emerald-50 text-emerald-600 ring-emerald-500/20",
      border: "hover:border-emerald-500",
    },
    {
      id: "Legal",
      title: "Legal & Compliance",
      desc: "Parse contracts, extract key clauses, and digitize case files into searchable databases.",
      icon: Scale,
      color: "bg-amber-50 text-amber-600 ring-amber-500/20",
      border: "hover:border-amber-500",
    },
    {
      id: "General",
      title: "Publishing & General",
      desc: "Recreate books, digitize historical archives, or extract standard text from any document.",
      icon: FileText,
      color: "bg-purple-50 text-purple-600 ring-purple-500/20",
      border: "hover:border-purple-500",
    }
  ];

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-12 animate-in fade-in zoom-in-95 duration-500">
      
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary mb-2">
          Welcome to FutolDoc AI
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900">
          What are you extracting today?
        </h1>
        <p className="text-lg text-slate-500 font-medium">
          Select your industry to load your optimized AI templates and workflows.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 w-full max-w-4xl px-4">
        {industries.map((ind) => {
          const Icon = ind.icon;
          return (
            <button 
              key={ind.id}
              onClick={() => handleSelect(ind.id)}
              className={`group flex flex-col items-start p-6 text-left bg-white rounded-2xl shadow-sm border-2 border-slate-100 transition-all duration-300 hover:shadow-lg ${ind.border} relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 p-6 opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                <ArrowRight className="h-6 w-6 text-slate-400" />
              </div>
              
              <div className={`p-4 rounded-2xl ring-1 mb-6 transition-transform group-hover:scale-110 ${ind.color}`}>
                <Icon className="h-8 w-8" />
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-2">{ind.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {ind.desc}
              </p>
            </button>
          )
        })}
      </div>
      
      <div className="text-center mt-12">
        <Button variant="ghost" onClick={() => handleSelect('All', '/templates')} className="text-slate-400 hover:text-slate-600">
          Skip and view all templates &rarr;
        </Button>
      </div>

    </div>
  );
}
