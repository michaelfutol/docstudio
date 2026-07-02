"use client";

import React, { useRef, useState, useEffect } from "react";
import { ZoomIn, ZoomOut, MousePointerSquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface OCRLine {
  text: string;
  confidence: number;
  bbox: number[];
  needsReview: boolean;
}

interface DocumentViewerProps {
  imagePath: string;
  lines: OCRLine[];
  imageWidth: number;
  imageHeight: number;
  hoveredLineIndex: number | null;
  onLineClick: (index: number) => void;
  onLineHover: (index: number | null) => void;
}

export function DocumentViewer({
  imagePath,
  lines,
  imageWidth,
  imageHeight,
  hoveredLineIndex,
  onLineClick,
  onLineHover
}: DocumentViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Calculate base scale to fit the image
  useEffect(() => {
    if (!containerRef.current || !imageWidth || !imageHeight) return;
    
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ width, height });
      
      // Calculate fit scale
      const scaleX = (width - 40) / imageWidth;
      const scaleY = (height - 40) / imageHeight;
      const fitScale = Math.min(scaleX, scaleY);
      
      // Only set initial scale once
      if (scale === 1) {
        setScale(fitScale > 0 ? fitScale : 1);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [imageWidth, imageHeight]);

  const handleZoomIn = () => setScale(s => Math.min(s * 1.2, 5));
  const handleZoomOut = () => setScale(s => Math.max(s / 1.2, 0.1));

  // Determine bbox color based on confidence and hover state
  const getBBoxStyle = (line: OCRLine, index: number) => {
    const isHovered = hoveredLineIndex === index;
    
    let borderColor = "rgba(148, 163, 184, 0.4)"; // default slate
    let bgColor = "transparent";

    if (line.confidence < 0.75 || line.needsReview) {
      borderColor = "rgba(248, 113, 113, 0.8)"; // red
      if (isHovered) bgColor = "rgba(248, 113, 113, 0.2)";
    } else if (line.confidence < 0.90) {
      borderColor = "rgba(251, 191, 36, 0.8)"; // amber
      if (isHovered) bgColor = "rgba(251, 191, 36, 0.2)";
    } else {
      borderColor = "rgba(74, 222, 128, 0.6)"; // green
      if (isHovered) bgColor = "rgba(74, 222, 128, 0.2)";
    }

    if (isHovered) {
      borderColor = "rgba(59, 130, 246, 1)"; // solid blue when hovered
      bgColor = "rgba(59, 130, 246, 0.2)";
    }

    return {
      left: line.bbox[0],
      top: line.bbox[1],
      width: line.bbox[2] - line.bbox[0],
      height: line.bbox[3] - line.bbox[1],
      border: `2px solid ${borderColor}`,
      backgroundColor: bgColor,
      cursor: "pointer",
      position: "absolute" as const,
      transition: "all 0.1s ease-in-out"
    };
  };

  return (
    <div className="flex flex-col h-full bg-slate-200/50 relative" ref={containerRef}>
      {/* Toolbar */}
      <div className="absolute bottom-4 right-4 flex gap-1 bg-white p-1 rounded-md shadow-md border border-slate-200 z-10">
        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-8 w-8 text-slate-500">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-center text-xs font-mono text-slate-500 w-12">
          {Math.round(scale * 100)}%
        </div>
        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-8 w-8 text-slate-500">
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      {/* Image Container with Scrolling */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <div 
          className="relative bg-white shadow-lg border border-slate-200 origin-center transition-transform"
          style={{ 
            width: imageWidth, 
            height: imageHeight,
            transform: `scale(${scale})`,
          }}
        >
          {/* Base Image */}
          <img 
            src={`http://localhost:8000/${imagePath.replace(/\\/g, '/')}`} 
            alt="Source Document" 
            className="w-full h-full object-contain pointer-events-none"
          />

          {/* Bounding Boxes Layer */}
          <div className="absolute inset-0">
            {lines?.map((line, idx) => (
              <div
                key={idx}
                style={getBBoxStyle(line, idx)}
                onClick={() => onLineClick(idx)}
                onMouseEnter={() => onLineHover(idx)}
                onMouseLeave={() => onLineHover(null)}
                title={`Conf: ${(line.confidence * 100).toFixed(1)}%`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
