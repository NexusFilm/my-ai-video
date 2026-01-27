"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import type { NextPage } from "next";
import { useSearchParams } from "next/navigation";
import { Loader2, FolderOpen, Sparkles, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
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
  const [generationProgress, setGenerationProgress] = useState<{
    percent: number;
    current: number;
    total: number;
  } | null>(null);
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
  
  // Agent Brain state
  const [autoHealEnabled, setAutoHealEnabled] = useState(true);
  const [autoFixCount, setAutoFixCount] = useState(0);
  const [agentStatus, setAgentStatus] = useState<"idle" | "monitoring" | "fixing">("idle");
  const MAX_AUTO_RETRIES = 2;

  const { code, Component, error, isCompiling, setCode, compileCode } =
    useAnimationState(examples[0]?.code || "");

  // Debounce compilation
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStreamingRef = useRef(isStreaming);
  const codeRef = useRef(code);
  const justFinishedGenerationRef = useRef(false);

  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  useEffect(() => {
    const wasStreaming = isStreamingRef.current;
    isStreamingRef.current = isStreaming;

    // Reset agent when starting new generation
    if (isStreaming) {
      setAgentStatus("monitoring");
      // Only reset retry count if this is a fresh user prompt, not a fix attempt
      // We can infer it's a fix attempt if we are in "fixing" status
      if (agentStatus !== "fixing") {
        setAutoFixCount(0);
      }
    }

    // Compile when streaming ends
    if (wasStreaming && !isStreaming) {
      compileCode(codeRef.current);
      justFinishedGenerationRef.current = true;
      
      // Check for errors after a brief delay to allow compilation to finish
      // and state to update
      setTimeout(() => {
        if (justFinishedGenerationRef.current) {
          justFinishedGenerationRef.current = false;
        }
      }, 2000);
    }
  }, [isStreaming, compileCode, agentStatus]);

  // Agent Brain: Auto-heal errors
  useEffect(() => {
    // Only auto-heal if enabled, not streaming, not compiling, and valid retry count
    if (!autoHealEnabled || isStreaming || isCompiling || autoFixCount >= MAX_AUTO_RETRIES) {
      if (!isStreaming && agentStatus === "fixing") {
        setAgentStatus("idle");
      }
      return;
    }

    // Check if we have an error (either compilation or generation API error)
    const currentError = generationError?.message || error;
    
    // Only fix errors that appear right after generation (to avoid interrupting manual editing)
    if (currentError && justFinishedGenerationRef.current) {
      console.log("Agent detected error, attempting auto-fix...", currentError);
      
      // Mark generation as handled so we don't loop immediately
      justFinishedGenerationRef.current = false;
      
      setAgentStatus("fixing");
      setAutoFixCount(prev => prev + 1);
      
      // Trigger the fix
      promptInputRef.current?.triggerFix(code, currentError);
      
      // Show a toast or status would be nice here, but we'll use the agent status indicator
    } else if (!currentError && !isStreaming) {
      setAgentStatus("idle");
    }
  }, [
    autoHealEnabled,
    isStreaming, 
    isCompiling, 
    error, 
    generationError, 
    autoFixCount, 
    code,
    agentStatus
  ]);

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setHasGeneratedOnce(true);

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // If user edits manually, stop auto-fixing logic for this session
      if (!isStreamingRef.current) {
        justFinishedGenerationRef.current = false;
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
      if (!streaming) {
        setGenerationProgress(null);
      }
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

    const handleProgressChange = useCallback((percent: number, total: number, current: number) => {
      setGenerationProgress({ percent, total, current });
    }, []);

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

  // Agent Status Indicator component
  const AgentStatusIndicator = (
    <button
      onClick={() => setAutoHealEnabled(!autoHealEnabled)}
      className={`relative rounded-full px-3 py-1 flex items-center gap-2 text-xs font-medium transition-all ${
        !autoHealEnabled
          ? "bg-gray-500/10 text-gray-500 border border-gray-500/20"
          : agentStatus === "fixing" 
          ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" 
          : agentStatus === "monitoring"
          ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
          : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
      }`}
      title={autoHealEnabled ? "Click to disable auto-heal" : "Click to enable auto-heal"}
    >
      {!autoHealEnabled ? (
        <>
          <AlertCircle className="w-3 h-3" />
          <span>Agent Off</span>
        </>
      ) : agentStatus === "fixing" ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Agent Fixing...</span>
        </>
      ) : agentStatus === "monitoring" ? (
        <>
          <Sparkles className="w-3 h-3" />
          <span>Agent Monitoring</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3 h-3" />
                  generationProgress={generationProgress}
          <span>System Healthy</span>
        </>
      )}
    </button>
  );

  return (
    <PageLayout 
      showLogoAsLink
      rightContent={
        <div className="flex items-center gap-3">
          {/* Agent Status Indicator */}
          {AgentStatusIndicator}

          <Button
            onClick={() => setProjectsPanelOpen(true)}
            variant="outline"
            size="sm"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Projects
          </Button>
        </div>
      }
    >
      <div className="flex flex-col min-w-0 px-4 md:px-8 lg:px-12 pb-8 gap-6">
        {/* Main content area with editor and player */}
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6 lg:gap-8">
          {/* Code Editor */}
          <div className="flex-1 lg:flex-[3] h-[500px] lg:h-[600px]">
            <CodeEditor
              code={hasGeneratedOnce && !generationError ? code : ""}
              onChange={handleCodeChange}
              isStreaming={isStreaming}
              streamPhase={streamPhase}
              generationProgress={generationProgress}
            />
          </div>
          
          {/* Video Player */}
          <div className="flex-1 lg:flex-[2.5] min-h-[400px]">
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

        {/* Prompt Input at bottom */}
        <div className="mt-4 relative">
          <PromptInput
            ref={promptInputRef}
            onCodeGenerated={handleCodeChange}
            onStreamingChange={handleStreamingChange}
            onStreamPhaseChange={setStreamPhase}
            onProgressChange={handleProgressChange}
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
          
          {/* Auto-fix helper */}
          {generationError && (
            <div className="mt-4 flex justify-center">
              <Button
                size="sm"
                variant="destructive"
                className="shadow-lg"
                onClick={() => {
                  promptInputRef.current?.triggerFix(code, generationError.message);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  Auto-Fix Error
                </div>
              </Button>
            </div>
          )}
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
