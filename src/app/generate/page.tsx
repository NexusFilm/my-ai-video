"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import type { NextPage } from "next";
import { useSearchParams } from "next/navigation";
import { Loader2, FolderOpen } from "lucide-react";
import { CodeEditor } from "../../components/CodeEditor";
import { AnimationPlayer } from "../../components/AnimationPlayer";
import { PageLayout } from "../../components/PageLayout";
import {
  PromptInput,
  type StreamPhase,
  type PromptInputRef,
  type GenerationErrorType,
} from "../../components/PromptInput";
import { type UploadedImage } from "../../components/ImageUploader";
import { ProjectsPanel } from "../../components/ProjectsPanel";
import { type Project, projectStorage } from "../../lib/project-storage";
import { Button } from "../../components/ui/button";
import { examples } from "../../examples/code";
import { useAnimationState } from "../../hooks/useAnimationState";

function GeneratePageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") || "";

  // If we have an initial prompt from URL, start in streaming state
  // so syntax highlighting is disabled from the beginning
  const willAutoStart = Boolean(initialPrompt);

  // Get settings from URL params
  const urlAspectRatio = searchParams.get("aspectRatio") as "16:9" | "9:16" | null;
  const urlMotionBlur = searchParams.get("motionBlur");
  const urlPresets = searchParams.get("presets");
  
  // Get images from sessionStorage
  const [uploadedImages] = useState<UploadedImage[]>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("uploadedImages");
      if (stored) {
        sessionStorage.removeItem("uploadedImages"); // Clear after reading
        try {
          return JSON.parse(stored);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [durationInFrames, setDurationInFrames] = useState(
    examples[0]?.durationInFrames || 150,
  );
  const [fps, setFps] = useState(examples[0]?.fps || 30);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">(
    urlAspectRatio || "16:9"
  );
  const [motionBlur, setMotionBlur] = useState(
    urlMotionBlur ? parseInt(urlMotionBlur, 10) : 0
  );
  const [isStreaming, setIsStreaming] = useState(willAutoStart);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>(
    willAutoStart ? "reasoning" : "idle",
  );
  const [prompt, setPrompt] = useState(initialPrompt);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [generationError, setGenerationError] = useState<{
    message: string;
    type: GenerationErrorType;
  } | null>(null);
  const [isRefineMode, setIsRefineMode] = useState(false);
  const selectedPresets = urlPresets ? urlPresets.split(",") : [];
  const [projectsPanelOpen, setProjectsPanelOpen] = useState(false);

  const { code, Component, error, isCompiling, setCode, compileCode } =
    useAnimationState(examples[0]?.code || "");

  // Debounce compilation
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStreamingRef = useRef(isStreaming);
  const codeRef = useRef(code);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;

    // Compile when streaming ends
    if (wasStreaming && !isStreaming) {
      compileCode(codeRef.current);
    }
  }, [isStreaming, compileCode]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setHasGeneratedOnce(true);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Skip compilation while streaming - will compile when streaming ends
      if (isStreamingRef.current) {
        return;
      }

      // Set new debounce
      debounceRef.current = setTimeout(() => {
        compileCode(newCode);
      }, 500);
    },
    [setCode, compileCode],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleStreamingChange = useCallback((streaming: boolean) => {
    setIsStreaming(streaming);
    // Clear errors when starting a new generation
    if (streaming) {
      setGenerationError(null);
    }
  }, []);

  const handleError = useCallback(
    (message: string, type: GenerationErrorType) => {
      setGenerationError({ message, type });
    },
    [],
  );

  // Auto-trigger generation if prompt came from URL
  const promptInputRef = useRef<PromptInputRef>(null);

  useEffect(() => {
    if (initialPrompt && !hasAutoStarted && promptInputRef.current) {
      setHasAutoStarted(true);
      // Small delay to ensure component is mounted
      setTimeout(() => {
        promptInputRef.current?.triggerGeneration();
      }, 100);
    }
  }, [initialPrompt, hasAutoStarted]);

  const handleLoadProject = useCallback((project: Project) => {
    setCode(project.code);
    setPrompt(project.prompt);
    setDurationInFrames(project.settings.durationInFrames);
    setFps(project.settings.fps);
    setAspectRatio(project.settings.aspectRatio);
    setMotionBlur(project.settings.motionBlur);
    setHasGeneratedOnce(true);
    compileCode(project.code);
  }, [setCode, compileCode]);

  // Initialize storage on mount
  useEffect(() => {
    projectStorage.init().catch(console.error);
  }, []);

  return (
    <PageLayout 
      showLogoAsLink
      rightContent={
        <Button
          onClick={() => setProjectsPanelOpen(true)}
          variant="outline"
          size="sm"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Projects
        </Button>
      }
    >
      <div className="flex-1 flex flex-col min-w-0 px-4 md:px-8 lg:px-12 pb-4 md:pb-8 gap-4 md:gap-6 lg:gap-8 h-full overflow-hidden">
        {/* Main content area with editor and player */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8 min-h-0 overflow-hidden">
          {/* Code Editor - scrollable */}
          <div className="flex-1 lg:flex-[3] min-h-[300px] lg:min-h-0 overflow-hidden">
            <CodeEditor
              code={hasGeneratedOnce && !generationError ? code : ""}
              onChange={handleCodeChange}
              isStreaming={isStreaming}
              streamPhase={streamPhase}
            />
          </div>
          
          {/* Video Player - scrollable */}
          <div className="flex-1 lg:flex-[2.5] min-h-[300px] lg:min-h-0 overflow-auto">
            <AnimationPlayer
              Component={generationError ? null : Component}
              durationInFrames={durationInFrames}
              fps={fps}
              aspectRatio={aspectRatio}
              motionBlur={motionBlur}
              onDurationChange={setDurationInFrames}
              onFpsChange={setFps}
              onAspectRatioChange={setAspectRatio}
              onMotionBlurChange={setMotionBlur}
              isCompiling={isCompiling}
              isStreaming={isStreaming}
              error={generationError?.message || error}
              errorType={generationError?.type || "compilation"}
              code={code}
            />
          </div>
        </div>

        {/* Prompt Input at bottom - fixed height */}
        <div className="shrink-0">
          <PromptInput
            ref={promptInputRef}
            onCodeGenerated={handleCodeChange}
            onStreamingChange={handleStreamingChange}
            onStreamPhaseChange={setStreamPhase}
            onError={handleError}
            prompt={prompt}
            onPromptChange={setPrompt}
            currentCode={hasGeneratedOnce ? code : undefined}
            isRefineMode={isRefineMode}
            onRefineModeChange={setIsRefineMode}
            aspectRatio={aspectRatio}
            motionBlur={motionBlur}
            uploadedImages={uploadedImages}
            selectedPresets={selectedPresets}
          />
        </div>
      </div>

      {/* Projects Panel */}
      {projectsPanelOpen && (
        <ProjectsPanel
          currentCode={code}
          currentPrompt={prompt}
          currentSettings={{
            durationInFrames,
            fps,
            aspectRatio,
            motionBlur,
            selectedPresets,
          }}
          onLoadProject={handleLoadProject}
          onClose={() => setProjectsPanelOpen(false)}
        />
      )}
    </PageLayout>
  );
}

function LoadingFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-foreground" />
    </div>
  );
}

const GeneratePage: NextPage = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GeneratePageContent />
    </Suspense>
  );
};

export default GeneratePage;
