"use client";

import React from "react";

interface StreamingOverlayProps {
  visible: boolean;
  message?: string;
  progress?: {
    percent: number;
    current: number;
    total: number;
  } | null;
}

export const StreamingOverlay: React.FC<StreamingOverlayProps> = ({
  visible,
  message = "Generating code...",
  progress = null,
}) => {
  if (!visible) return null;

  return (
    <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center pointer-events-none">
      <div className="flex flex-col gap-3 bg-background-editor px-6 py-4 rounded-lg border border-border min-w-[300px]">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-foreground text-sm font-sans">{message}</span>
        </div>
        
        {progress && (
          <div className="space-y-2">
            {/* Progress Bar */}
            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            
            {/* Line Count Info */}
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{progress.current} / ~{progress.total} lines</span>
              <span className="font-mono font-semibold text-primary">{progress.percent}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
