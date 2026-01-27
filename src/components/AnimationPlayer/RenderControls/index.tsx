"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorComp } from "./Error";
import { ProgressBar } from "./ProgressBar";
import { DownloadButton } from "./DownloadButton";
import { useRendering } from "../../../helpers/use-rendering";
import { useEffect, useRef } from "react";

export const RenderControls: React.FC<{
  code: string;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
}> = ({ code, durationInFrames, fps, width, height }) => {
  const { renderMedia, state, undo } = useRendering({ code, durationInFrames, fps, width, height });
  const previousPropsRef = useRef({ code, durationInFrames, fps, width, height });

  // Reset rendering state when code, duration, fps, or dimensions change
  useEffect(() => {
    const prev = previousPropsRef.current;
    const hasChanged =
      prev.code !== code ||
      prev.durationInFrames !== durationInFrames ||
      prev.fps !== fps ||
      prev.width !== width ||
      prev.height !== height;

    if (hasChanged && state.status !== "init") {
      undo();
    }
    previousPropsRef.current = { code, durationInFrames, fps, width, height };
  }, [code, durationInFrames, fps, width, height, state.status, undo]);

  if (
    state.status === "init" ||
    state.status === "invoking" ||
    state.status === "error"
  ) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          disabled={state.status === "invoking" || !code}
          loading={state.status === "invoking"}
          onClick={renderMedia}
          className="w-full"
        >
          <Download className="w-4 h-4 mr-2" />
          {state.status === "invoking"
            ? "Starting render..."
            : "Render & Download"}
        </Button>
        {state.status === "error" && (
          <ErrorComp message={state.error.message} />
        )}
      </div>
    );
  }

  if (state.status === "rendering") {
    return <ProgressBar progress={state.progress} />;
  }

  if (state.status === "done") {
    return <DownloadButton state={state} undo={undo} />;
  }

  return null;
};
