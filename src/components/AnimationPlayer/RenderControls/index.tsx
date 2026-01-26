"use client";

import { useEffect, useRef } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorComp } from "./Error";
import { ProgressBar } from "./ProgressBar";
import { DownloadButton } from "./DownloadButton";
import { useRendering } from "../../../helpers/use-rendering";

export const RenderControls: React.FC<{
  code: string;
  durationInFrames: number;
  fps: number;
}> = ({ code, durationInFrames, fps }) => {
  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled
        className="w-full"
        title="Video rendering requires AWS Lambda setup. Use the preview above or copy the code to render locally with 'npx remotion render'"
      >
        <Download className="w-4 h-4 mr-2" />
        Render & Download (Requires AWS)
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Use the preview above or copy code to render locally
      </p>
    </div>
  );
};
