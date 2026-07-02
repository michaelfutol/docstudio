import React from "react";
import { Check, Loader2 } from "lucide-react";

export type PipelineStage = 
  | "uploaded" 
  | "processing" 
  | "processed" 
  | "extracting" 
  | "pending_review" 
  | "approved" 
  | "exported" 
  | "failed";

interface PipelineStepperProps {
  currentStage: PipelineStage;
}

const STAGES = [
  { id: "uploaded", label: "Uploaded" },
  { id: "processing", label: "OCR" },
  { id: "extracting", label: "Extraction" },
  { id: "pending_review", label: "Review" },
  { id: "approved", label: "Done" },
];

export function PipelineStepper({ currentStage }: PipelineStepperProps) {
  // Map our backend states to the linear visual steps
  const stageIndexMap: Record<PipelineStage, number> = {
    uploaded: 0,
    processing: 1,
    processed: 2, // Next logical step is extraction
    extracting: 2,
    pending_review: 3,
    approved: 4,
    exported: 4,
    failed: -1
  };

  const currentIndex = stageIndexMap[currentStage] ?? 0;

  return (
    <div className="flex items-center w-full max-w-xl">
      {STAGES.map((stage, idx) => {
        const isCompleted = currentStage === "failed" ? false : idx < currentIndex || currentStage === "approved" || currentStage === "exported";
        const isActive = currentStage !== "failed" && idx === currentIndex;
        const isFailed = currentStage === "failed" && idx === currentIndex;

        return (
          <React.Fragment key={stage.id}>
            {/* Step Node */}
            <div className="flex flex-col items-center relative">
              <div 
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 ${
                  isFailed ? "border-red-500 bg-red-50 text-red-600" :
                  isCompleted ? "border-emerald-500 bg-emerald-500 text-white" :
                  isActive ? "border-primary bg-primary/5 text-primary shadow-[0_0_12px_rgba(59,130,246,0.3)]" :
                  "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isActive && (stage.id === "processing" || stage.id === "extracting") ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span className="text-xs font-semibold">{idx + 1}</span>
                )}
              </div>
              <span className={`absolute top-10 text-[10px] font-medium tracking-wide uppercase whitespace-nowrap ${
                isActive ? "text-primary font-bold" : 
                isCompleted ? "text-emerald-600" : 
                isFailed ? "text-red-600" : "text-slate-400"
              }`}>
                {stage.label}
              </span>
            </div>

            {/* Connecting Line */}
            {idx < STAGES.length - 1 && (
              <div className="flex-1 h-[2px] bg-slate-100 mx-2 relative overflow-hidden">
                <div 
                  className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out ${
                    isCompleted ? "w-full bg-emerald-400" : 
                    isActive ? "w-1/2 bg-primary animate-pulse" : "w-0 bg-transparent"
                  }`} 
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
